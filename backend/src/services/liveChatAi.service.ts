import { Message } from "../models/Message";
import { Conversation } from "../models/Conversation";
import { generateText } from "./gemini.service";

/**
 * Builds the Gemini prompt for live-chat Story 15 (AI agent responds first)
 * from recent conversation history, and returns the AI's reply text.
 * Kept separate from gemini.service.ts, which stays a generic client shared
 * with the unrelated ai-features stories.
 */

const HISTORY_LIMIT = 20;

const SENDER_LABELS: Record<string, string> = {
  customer: "Customer",
  ai: "AI Agent",
  agent: "Agent",
};

const SYSTEM_PREAMBLE =
  "You are the AI support agent for a customer service platform. Reply concisely " +
  "and helpfully to the customer's latest message, in at most 2-3 short sentences. " +
  "The customer is already signed in and identified below -- never ask them for " +
  "their name, account/membership number, or email to 'verify' or 'look up' their " +
  "account; you already have it. Only ask for details specific to the problem " +
  "itself (e.g. an order number, a screenshot, steps to reproduce).";

async function fetchTranscript(conversationId: string): Promise<string> {
  const history = await Message.find({ parentType: "conversation", parentId: conversationId })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .lean();
  history.reverse();

  return history
    .filter((message) => !message.internal && message.senderType !== "system")
    .map((message) => `${SENDER_LABELS[message.senderType] ?? message.senderType}: ${message.text}`)
    .join("\n");
}

// The customer is already authenticated for the whole chat session -- feed
// their identity into the prompt so the AI never has to ask for it (the gap
// that prompted this: without this, Gemini had no way to know who it was
// talking to and asked for an account number mid-conversation). Best-effort:
// a lookup failure just means the identity line is omitted, never a hard
// failure of the AI reply itself.
async function fetchCustomerContext(conversationId: string): Promise<string> {
  try {
    const conversation = await Conversation.findById(conversationId).populate<{
      customer: { name: string; membershipNumber: string } | null;
    }>("customer", "name membershipNumber");
    const customer = conversation?.customer;
    if (!customer) return "";
    return `Customer identity (already verified, do not ask for this again): name "${customer.name}", membership number ${customer.membershipNumber}.\n\n`;
  } catch {
    return "";
  }
}

export async function getAiReply(conversationId: string): Promise<string | null> {
  try {
    const [customerContext, transcript] = await Promise.all([
      fetchCustomerContext(conversationId),
      fetchTranscript(conversationId),
    ]);
    const prompt = `${SYSTEM_PREAMBLE}\n\n${customerContext}${transcript}\nAI Agent:`;

    const reply = await generateText(prompt);
    if (!reply || reply.trim().length === 0) {
      return null;
    }
    return reply.trim();
  } catch (err) {
    console.error("[liveChatAi] getAiReply failed:", (err as Error).message);
    return null;
  }
}

export interface TicketSuggestion {
  subject: string;
  description: string;
}

// Story 62 (live-chat): a second, smaller, single-purpose Gemini call run in
// parallel with getAiReply — kept separate so getAiReply's plain-text
// contract stays stable and each call can independently timeout/fallback
// per CLAUDE.md's "wrap every Gemini call with a timeout and a graceful
// fallback." Deliberately NOT parsed out of the main reply's text (no
// sentinel/marker parsing of free-form prose).
const SUGGESTION_SYSTEM_PREAMBLE =
  "You are a triage classifier for a customer service live chat. Decide whether " +
  "the customer's issue would be better handled as a written support ticket " +
  "instead of continuing this chat -- for example, it needs a long written " +
  "follow-up, file attachments, or is otherwise beyond what a quick chat reply " +
  "can resolve. Respond with ONLY strict JSON, no markdown, no commentary, in " +
  'exactly this shape: {"suggest": boolean, "subject": string, "description": ' +
  'string}. When suggest is false, subject and description may be empty ' +
  "strings. Keep subject under 100 characters. Write subject/description in " +
  "the same language the customer is writing in.";

function parseSuggestionJson(raw: string): { suggest: boolean; subject: string; description: string } | null {
  try {
    // Gemini sometimes wraps JSON in a markdown code fence despite
    // instructions not to -- strip that defensively before parsing.
    const stripped = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(stripped);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.suggest !== "boolean" ||
      typeof parsed.subject !== "string" ||
      typeof parsed.description !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Returns a ticket suggestion when the classifier decides this conversation
 * would be better handled as a ticket, or null otherwise (including on any
 * failure/timeout/malformed output -- never blocks the customer). Skips the
 * Gemini call entirely once the customer has declined a suggestion this
 * conversation (`alreadyDeclined`), per Story 62's "do not re-suggest" rule.
 */
export async function evaluateTicketSuggestion(
  conversationId: string,
  alreadyDeclined: boolean
): Promise<TicketSuggestion | null> {
  if (alreadyDeclined) return null;

  try {
    const [customerContext, transcript] = await Promise.all([
      fetchCustomerContext(conversationId),
      fetchTranscript(conversationId),
    ]);
    const prompt = `${SUGGESTION_SYSTEM_PREAMBLE}\n\n${customerContext}Conversation so far:\n${transcript}`;

    const raw = await generateText(prompt);
    if (!raw) return null;

    const parsed = parseSuggestionJson(raw);
    if (!parsed || !parsed.suggest) return null;

    return { subject: parsed.subject.trim(), description: parsed.description.trim() };
  } catch (err) {
    console.error("[liveChatAi] evaluateTicketSuggestion failed:", (err as Error).message);
    return null;
  }
}
