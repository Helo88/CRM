import { z } from "zod";
import { objectIdSchema, requiredString } from "./common";

// Empty for now — this story creates a bare conversation. Later stories may
// accept an initial subject/topic here; keep the shape open for extension.
export const createConversationSchema = z.object({}).strict();

// Used server-side to validate the shape of an inbound conversation:message
// socket payload before touching the DB. Text is required, trimmed, non-empty.
export const conversationMessagePayloadSchema = z.object({
  conversationId: objectIdSchema("Invalid conversation id"),
  text: requiredString("Message text is required"),
});
