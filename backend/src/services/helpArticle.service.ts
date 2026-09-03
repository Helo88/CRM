import { HelpArticle, IHelpArticle } from "../models/HelpArticle";
import { ILocalizedText } from "../models/localizedText";
import type { KbCategorySlug } from "../constants/kb";
import { ARTICLE_SLUG_MAX_LENGTH } from "../constants/kb";

/**
 * The one place help-article mutation logic lives — mirrors faq.service.ts
 * exactly (see its header comment). Route handlers never touch
 * `HelpArticle` directly for a write.
 */

export class HelpArticleValidationError extends Error {}

export interface CreateHelpArticleInput {
  title: ILocalizedText;
  summary: ILocalizedText;
  body: ILocalizedText;
  category: KbCategorySlug;
  slug?: string;
  actorId: string;
}

export interface UpdateHelpArticleInput {
  title?: ILocalizedText;
  summary?: ILocalizedText;
  body?: ILocalizedText;
  category?: KbCategorySlug;
  slug?: string;
  actorId: string;
}

function findBySlugCaseInsensitive(slug: string, excludeId?: string) {
  const filter: Record<string, unknown> = { slug };
  if (excludeId) filter._id = { $ne: excludeId };
  return HelpArticle.findOne(filter).collation({ locale: "en", strength: 2 });
}

// Lowercase, strip diacritics, replace anything non [a-z0-9] with a hyphen,
// collapse/trim hyphens, bound the length. Empty result (e.g. an
// Arabic-only title) falls back to a random slug rather than attempting
// transliteration.
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ARTICLE_SLUG_MAX_LENGTH);
  return base || `article-${Math.random().toString(16).slice(2, 10)}`;
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  for (let attempt = 1; attempt <= 20; attempt++) {
    const existing = await findBySlugCaseInsensitive(candidate);
    if (!existing) return candidate;
    candidate = `${base}-${attempt + 1}`;
  }
  return `article-${Math.random().toString(16).slice(2, 10)}`;
}

export async function createHelpArticle(input: CreateHelpArticleInput): Promise<IHelpArticle> {
  let slug: string;
  if (input.slug) {
    if (await findBySlugCaseInsensitive(input.slug)) {
      throw new HelpArticleValidationError("An article with that URL slug already exists");
    }
    slug = input.slug;
  } else {
    slug = await generateUniqueSlug(input.title.en || input.title.ar);
  }

  try {
    return await HelpArticle.create({
      slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new HelpArticleValidationError("An article with that URL slug already exists");
    }
    throw err;
  }
}

export async function updateHelpArticle(id: string, input: UpdateHelpArticleInput): Promise<IHelpArticle | null> {
  const article = await HelpArticle.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!article) return null;

  if (input.slug !== undefined && input.slug !== article.slug) {
    if (await findBySlugCaseInsensitive(input.slug, article.id)) {
      throw new HelpArticleValidationError("An article with that URL slug already exists");
    }
    article.slug = input.slug;
  }
  if (input.title !== undefined) article.title = input.title;
  if (input.summary !== undefined) article.summary = input.summary;
  if (input.body !== undefined) article.body = input.body;
  if (input.category !== undefined) article.category = input.category;
  article.updatedBy = input.actorId as unknown as IHelpArticle["updatedBy"];

  try {
    await article.save();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new HelpArticleValidationError("An article with that URL slug already exists");
    }
    throw err;
  }
  return article;
}

export async function softDeleteHelpArticle(id: string, actorId: string): Promise<IHelpArticle | null> {
  const article = await HelpArticle.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!article) return null;
  article.isDeleted = true;
  article.updatedBy = actorId as unknown as IHelpArticle["updatedBy"];
  await article.save();
  return article;
}
