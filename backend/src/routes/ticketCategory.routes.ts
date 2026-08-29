import express, { Request, Response } from "express";
import mongoose from "mongoose";
import { requireAuth, requirePermission } from "../middleware/auth";
import { TicketCategory, ITicketCategory, TICKET_CATEGORY_NAME_MAX_LENGTH } from "../models/TicketCategory";

const router = express.Router();

function toCategoryResponse(category: ITicketCategory) {
  return {
    id: category.id,
    name: category.name,
    active: category.active,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

// Case-insensitive lookup matching the model's collation-aware unique
// index — used on both create (new name) and rename (name changing).
function findByNameCaseInsensitive(name: string, excludeId?: string) {
  const filter: Record<string, unknown> = { name };
  if (excludeId) filter._id = { $ne: excludeId };
  return TicketCategory.findOne(filter).collation({ locale: "en", strength: 2 });
}

// Story 58: admin-editable ticket category list backing Story 9's
// categorize-a-ticket picker and Story 57's staff-create-for-customer form
// (neither is wired up to this list yet — that's their own job). No
// customer path — every mutation here is staff-only, gated on
// tickets:manage_categories (admin/system-configuration tier, same as
// config:edit/sla:configure).
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const filter = req.query.active === "true" ? { active: true } : {};
  const categories = await TicketCategory.find(filter).sort({ name: 1 });
  res.status(200).json(categories.map(toCategoryResponse));
});

interface CreateTicketCategoryBody {
  name?: string;
}

router.post(
  "/",
  requireAuth,
  requirePermission("tickets:manage_categories"),
  async (req: Request<unknown, unknown, CreateTicketCategoryBody>, res: Response) => {
    const name = (req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (name.length > TICKET_CATEGORY_NAME_MAX_LENGTH) {
      res.status(400).json({ error: `name must be at most ${TICKET_CATEGORY_NAME_MAX_LENGTH} characters` });
      return;
    }

    const existing = await findByNameCaseInsensitive(name);
    if (existing) {
      if (!existing.active) {
        res
          .status(409)
          .json({ error: "A category with that name exists but is inactive. Reactivate it instead." });
        return;
      }
      res.status(409).json({ error: "A category with that name already exists." });
      return;
    }

    let category;
    try {
      category = await TicketCategory.create({ name });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "A category with that name already exists." });
        return;
      }
      throw err;
    }

    res.status(201).json(toCategoryResponse(category));
  }
);

interface UpdateTicketCategoryBody {
  name?: string;
  active?: boolean;
}

router.patch(
  "/:id",
  requireAuth,
  requirePermission("tickets:manage_categories"),
  async (req: Request<{ id: string }, unknown, UpdateTicketCategoryBody>, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    const category = await TicketCategory.findById(req.params.id);
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const { name, active } = req.body ?? {};

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        res.status(400).json({ error: "name is required" });
        return;
      }
      if (trimmedName.length > TICKET_CATEGORY_NAME_MAX_LENGTH) {
        res.status(400).json({ error: `name must be at most ${TICKET_CATEGORY_NAME_MAX_LENGTH} characters` });
        return;
      }
      const existing = await findByNameCaseInsensitive(trimmedName, category.id);
      if (existing) {
        res.status(409).json({ error: "A category with that name already exists." });
        return;
      }
      category.name = trimmedName;
    }

    if (active !== undefined) {
      category.active = active;
    }

    await category.save();
    res.status(200).json(toCategoryResponse(category));
  }
);

export default router;
