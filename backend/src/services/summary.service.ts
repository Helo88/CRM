import { Ticket } from "../models/Ticket";
import { Conversation } from "../models/Conversation";
import { Message } from "../models/Message";
import { generateText } from "./gemini.service";

/**
 * ai-features Story 32 ("Summarize a ticket or chat"): a one-click,
 * never-persisted summary of a ticket/conversation thread, built on the
 * shared Gemini wrapper (gemini.service.ts) the same way live-chat's
 * liveChatAi.service.ts is. Each call is a fresh Gemini request — there is
 * no caching/versioning here by design (Regenerate on the frontend just
 * calls this again).
 */

export interface SummaryResult {
  ok: true;
  summary: string;
}

export interface SummaryError {
  ok: false;
  reason: "not_enough_messages" | "ai_unavailable";
}

export type SummaryOutcome = SummaryResult | SummaryError;

const MIN_MESSAGES = 2;
const TRANSCRIPT_LIMIT = 50;
const SUMMARY_TIMEOUT_MS = 15_000;

const SENDER_LABELS: Record<string, string> = {
  customer: "Customer",
  ai: "AI",
  system: "System",
};

function roleLabel(senderType: string, internal: boolean): string {
  if (senderType === "agent") return internal ? "Agent (internal note)" : "Agent";
  return SENDER_LABELS[senderType] ?? senderType;
}

interface TranscriptMessage {
  createdAt: Date;
  senderType: string;
  internal: boolean;
  text: string;
}

function buildTranscript(messages: TranscriptMessage[]): string {
  const truncated = messages.length > TRANSCRIPT_LIMIT;
  const slice = truncated ? messages.slice(messages.length - TRANSCRIPT_LIMIT) : messages;
  const lines = slice.map(
    (m) => `[${m.createdAt.toISOString()}] ${roleLabel(m.senderType, m.internal)}: ${m.text}`
  );
  if (truncated) lines.unshift("[transcript truncated to last 50 messages]");
  return lines.join("\n");
}

function buildPrompt(contextLine: string, transcript: string): string {
  return [
    "You are summarizing a customer-support thread for the agent handling it.",
    contextLine,
    "",
    "Transcript:",
    transcript,
    "",
    "Produce exactly three short labelled sections (max ~40 words each):",
    "Issue: what the customer is reporting.",
    "What's been tried: actions/replies from agents or the AI so far.",
    "Current status: open questions, unresolved blockers, or the last state.",
    "",
    "Reply in plain text. Do not use markdown. Do not invent facts not present in the transcript.",
  ].join("\n");
}

async function callSummaryModel(contextLine: string, transcript: string): Promise<SummaryOutcome> {
  const prompt = buildPrompt(contextLine, transcript);
  const result = await generateText(prompt, { timeoutMs: SUMMARY_TIMEOUT_MS });
  if (!result || result.trim().length === 0) {
    return { ok: false, reason: "ai_unavailable" };
  }
  return { ok: true, summary: result.trim() };
}

export async function summarizeTicket(ticketId: string): Promise<SummaryOutcome> {
  try {
    const ticket = await Ticket.findById(ticketId).select("ticketNumber subject status priority");
    if (!ticket) return { ok: false, reason: "not_enough_messages" };

    const messages = await Message.find({ parentType: "ticket", parentId: ticketId })
      .sort({ createdAt: 1 })
      .lean();
    if (messages.length < MIN_MESSAGES) return { ok: false, reason: "not_enough_messages" };

    const contextLine = `Ticket #${ticket.ticketNumber} — "${ticket.subject}" (status: ${ticket.status}, priority: ${ticket.priority}).`;
    return await callSummaryModel(contextLine, buildTranscript(messages));
  } catch (err) {
    console.error("[summary] summarizeTicket failed:", (err as Error).message);
    return { ok: false, reason: "ai_unavailable" };
  }
}

export async function summarizeConversation(conversationId: string): Promise<SummaryOutcome> {
  try {
    const conversation = await Conversation.findById(conversationId).select("status");
    if (!conversation) return { ok: false, reason: "not_enough_messages" };

    const messages = await Message.find({ parentType: "conversation", parentId: conversationId })
      .sort({ createdAt: 1 })
      .lean();
    if (messages.length < MIN_MESSAGES) return { ok: false, reason: "not_enough_messages" };

    const contextLine = `Live chat conversation (status: ${conversation.status}).`;
    return await callSummaryModel(contextLine, buildTranscript(messages));
  } catch (err) {
    console.error("[summary] summarizeConversation failed:", (err as Error).message);
    return { ok: false, reason: "ai_unavailable" };
  }
}
