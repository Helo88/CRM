import express, { Request, Response } from "express";
import { validateParams } from "../middleware/validate";
import { Faq } from "../models/Faq";
import { HelpArticle } from "../models/HelpArticle";
import { listPublicFaqsQuerySchema } from "../validation/kbFaq.schema";
import { listPublicHelpArticlesQuerySchema, articleSlugParamsSchema } from "../validation/kbHelpArticle.schema";

// PUBLIC — no requireAuth, no requirePermission, deliberately (knowledge-base
// Story 31: a visitor who can self-serve never opens a ticket). Lives in its
// OWN router, separate from the admin routers, on purpose: the "a
// soft-deleted document must never leave this process" invariant is then one
// small unauthenticated file that does nothing else, instead of a
// conditional branch inside an admin router where a later edit could widen
// it by accident. Every query here hardcodes { isDeleted: { $ne: true } } —
// not caller-controllable, no query parameter relaxes it.
//
// These are the first unauthenticated data endpoints in this codebase.
// There is no rate-limiting middleware anywhere to inherit; the exposure is
// low (non-sensitive content, a bounded enum + pagination query surface,
// nothing free-text that's regex-injectable) so this router does not invent
// one — flagged for a future platform-level story.

const router = express.Router();

router.get("/faqs", async (req: Request, res: Response) => {
  const parsed = listPublicFaqsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }
  const { page, limit, category } = parsed.data;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (category) filter.category = category;

  const [faqs, total] = await Promise.all([
    Faq.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Faq.countDocuments(filter),
  ]);

  res.status(200).json({
    faqs: faqs.map((f) => ({
      id: f.id,
      question: { en: f.question.en, ar: f.question.ar },
      answer: { en: f.answer.en, ar: f.answer.ar },
      category: f.category,
      updatedAt: f.updatedAt,
    })),
    total,
    page,
    limit,
  });
});

router.get("/articles", async (req: Request, res: Response) => {
  const parsed = listPublicHelpArticlesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }
  const { page, limit, category } = parsed.data;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (category) filter.category = category;

  const [articles, total] = await Promise.all([
    HelpArticle.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
    HelpArticle.countDocuments(filter),
  ]);

  res.status(200).json({
    articles: articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: { en: a.title.en, ar: a.title.ar },
      summary: { en: a.summary.en, ar: a.summary.ar },
      category: a.category,
      updatedAt: a.updatedAt,
    })),
    total,
    page,
    limit,
  });
});

router.get(
  "/articles/:slug",
  validateParams(articleSlugParamsSchema),
  async (req: Request<{ slug: string }>, res: Response) => {
    const article = await HelpArticle.findOne({ slug: req.params.slug, isDeleted: { $ne: true } }).collation({
      locale: "en",
      strength: 2,
    });
    // A draft (there are none any more) and a soft-deleted/unknown slug all
    // 404 identically — no existence signal for a URL that doesn't resolve.
    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.status(200).json({
      id: article.id,
      slug: article.slug,
      title: { en: article.title.en, ar: article.title.ar },
      summary: { en: article.summary.en, ar: article.summary.ar },
      body: { en: article.body.en, ar: article.body.ar },
      category: article.category,
      updatedAt: article.updatedAt,
    });
  }
);

export default router;
