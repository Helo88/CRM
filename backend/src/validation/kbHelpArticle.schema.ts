import { z } from "zod";
import {
  KB_CATEGORY_SLUGS,
  ARTICLE_TITLE_MAX_LENGTH,
  ARTICLE_SUMMARY_MAX_LENGTH,
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_SLUG_MAX_LENGTH,
  ARTICLE_SLUG_PATTERN,
} from "../constants/kb";
import { paginationQuerySchema, objectIdSchema } from "./common";

export const articleIdParamsSchema = z.object({ id: objectIdSchema("Invalid article id") });

export const articleSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(ARTICLE_SLUG_PATTERN, "Invalid article slug")
    .max(ARTICLE_SLUG_MAX_LENGTH),
});

const localizedFieldSchema = (max: number, label: string) =>
  z
    .object({
      en: z.string().trim().max(max, `${label} (English) must be at most ${max} characters`).optional().default(""),
      ar: z.string().trim().max(max, `${label} (Arabic) must be at most ${max} characters`).optional().default(""),
    })
    .refine((v) => Boolean(v.en || v.ar), { message: `${label} is required in at least one language` });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(ARTICLE_SLUG_PATTERN, "Slug may only contain lowercase letters, numbers and hyphens")
  .max(ARTICLE_SLUG_MAX_LENGTH)
  .optional();

export const createHelpArticleBodySchema = z.object({
  title: localizedFieldSchema(ARTICLE_TITLE_MAX_LENGTH, "title"),
  summary: localizedFieldSchema(ARTICLE_SUMMARY_MAX_LENGTH, "summary"),
  body: localizedFieldSchema(ARTICLE_BODY_MAX_LENGTH, "body"),
  category: z.enum(KB_CATEGORY_SLUGS, { error: "category must be one of the knowledge-base categories" }),
  // Omitted → the service generates one from the English title.
  slug: slugSchema,
});

export const updateHelpArticleBodySchema = z
  .object({
    title: localizedFieldSchema(ARTICLE_TITLE_MAX_LENGTH, "title").optional(),
    summary: localizedFieldSchema(ARTICLE_SUMMARY_MAX_LENGTH, "summary").optional(),
    body: localizedFieldSchema(ARTICLE_BODY_MAX_LENGTH, "body").optional(),
    category: z.enum(KB_CATEGORY_SLUGS).optional(),
    slug: slugSchema,
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No changes supplied" });

export const ALLOWED_ARTICLE_SORT_KEYS = ["createdAt", "updatedAt"] as const;

export const listHelpArticlesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  category: z.enum(KB_CATEGORY_SLUGS).optional(),
  sort: z
    .string()
    .regex(
      new RegExp(`^-?(${ALLOWED_ARTICLE_SORT_KEYS.join("|")})$`),
      `sort must be one of: ${ALLOWED_ARTICLE_SORT_KEYS.join(", ")}, optionally prefixed with -`
    )
    .optional(),
});

export const listPublicHelpArticlesQuerySchema = paginationQuerySchema.extend({
  category: z.enum(KB_CATEGORY_SLUGS).optional(),
});

export const translateArticleFieldBodySchema = z
  .object({
    field: z.enum(["title", "summary", "body"]),
    from: z.enum(["en", "ar"]),
    to: z.enum(["en", "ar"]),
    text: z.string().trim().min(1, "text is required").max(ARTICLE_BODY_MAX_LENGTH),
  })
  .refine((v) => v.from !== v.to, { message: "from and to must differ" });
