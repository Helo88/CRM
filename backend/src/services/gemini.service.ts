import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Wraps all Google Gemini calls (free tier) behind one place, per CLAUDE.md's rule
 * that external integrations only get called from src/services/.
 *
 * Powers: live-chat Story 15 (customer-facing chatbot), and the ai-features feature
 * (Stories 31-34: summaries, suggested replies, auto-categorization, suggested KB
 * solutions). Each of those is a distinct prompt/use-case built on top of this client —
 * this file only sets up the shared client + a safe call wrapper; the prompts
 * themselves belong to each story's implementation.
 */

const client = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const DEFAULT_TIMEOUT_MS = 10_000;

interface GenerateTextOptions {
  timeoutMs?: number;
  /**
   * Model sampling temperature. Left unset (provider default, ~1.0 — fine for
   * open-ended chat/summaries) unless a caller has a task where creative
   * drift is actively harmful — e.g. suggestTranslation in kbAi.service.ts,
   * where a high temperature on a short/ambiguous input (a single word like
   * "eat") let the model invent a plausible-sounding but unrelated
   * customer-support phrase instead of translating the literal text.
   */
  temperature?: number;
}

/**
 * Calls Gemini with a hard timeout and never throws — callers get either the text
 * response or null, so a customer-facing flow (e.g. live chat) can always fall back
 * to a "AI is unavailable, connecting you to an agent" message instead of hanging.
 */
export async function generateText(
  prompt: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, temperature }: GenerateTextOptions = {}
): Promise<string | null> {
  if (!client) {
    console.warn("[gemini] GEMINI_API_KEY not set — skipping call");
    return null;
  }

  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    ...(temperature !== undefined ? { generationConfig: { temperature } } : {}),
  });

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

  try {
    const result = await Promise.race([model.generateContent(prompt), timeout]);
    if (!result) return null; // timed out
    return result.response.text();
  } catch (err) {
    console.error("[gemini] call failed:", (err as Error).message);
    return null;
  }
}
