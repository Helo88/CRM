import { Message } from "../models/Message";
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
  "and helpfully to the customer's latest message, in at most 2-3 short sentences.";

export async function getAiReply(conversationId: string): Promise<string | null> {
  try {
    const history = await Message.find({ parentType: "conversation", parentId: conversationId })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();
    history.reverse();

    const transcript = history
      .filter((message) => !message.internal && message.senderType !== "system")
      .map((message) => `${SENDER_LABELS[message.senderType] ?? message.senderType}: ${message.text}`)
      .join("\n");

    const prompt = `${SYSTEM_PREAMBLE}\n\n${transcript}\nAI Agent:`;

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
