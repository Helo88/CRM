import { z } from "zod";
import { KB_CATEGORY_SLUGS, FAQ_QUESTION_MAX_LENGTH, FAQ_ANSWER_MAX_LENGTH } from "../constants/kb";
import { paginationQuerySchema, objectIdSchema } from "./common";

export const faqIdParamsSchema = z.object({ id: objectIdSchema("Invalid FAQ id") });

const localizedFieldSchema = (max: number, label: string) =>
  z
    .object({
      en: z.string().trim().max(max, `${label} (English) must be at most ${max} characters`).optional().default(""),
      ar: z.string().trim().max(max, `${label} (Arabic) must be at most ${max} characters`).optional().default(""),
    })
    .refine((v) => Boolean(v.en || v.ar), { message: `${label} is required in at least one language` });

export const createFaqBodySchema = z.object({
  question: localizedFieldSchema(FAQ_QUESTION_MAX_LENGTH, "question"),
  answer: localizedFieldSchema(FAQ_ANSWER_MAX_LENGTH, "answer"),
  category: z.enum(KB_CATEGORY_SLUGS, { error: "category must be one of the knowledge-base categories" }),
});

export const updateFaqBodySchema = z
  .object({
    question: localizedFieldSchema(FAQ_QUESTION_MAX_LENGTH, "question").optional(),
    answer: localizedFieldSchema(FAQ_ANSWER_MAX_LENGTH, "answer").optional(),
    category: z.enum(KB_CATEGORY_SLUGS).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes supplied" });

export const ALLOWED_FAQ_SORT_KEYS = ["createdAt", "updatedAt"] as const;

export const listFaqsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.enum(KB_CATEGORY_SLUGS).optional(),
  sort: z
    .string()
    .regex(
      new RegExp(`^-?(${ALLOWED_FAQ_SORT_KEYS.join("|")})$`),
      `sort must be one of: ${ALLOWED_FAQ_SORT_KEYS.join(", ")}, optionally prefixed with -`
    )
    .optional(),
});

// Public browse (Story 31 consumes this) — no admin-only fields here.
export const listPublicFaqsQuerySchema = paginationQuerySchema.extend({
  category: z.enum(KB_CATEGORY_SLUGS).optional(),
});

export const translateFaqFieldBodySchema = z
  .object({
    field: z.enum(["question", "answer"]),
    from: z.enum(["en", "ar"]),
    to: z.enum(["en", "ar"]),
    text: z.string().trim().min(1, "text is required").max(FAQ_ANSWER_MAX_LENGTH),
  })
  .refine((v) => v.from !== v.to, { message: "from and to must differ" });
