import express, { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { requireAuth, requirePermission } from "../middleware/auth";
import { Ticket } from "../models/Ticket";
import { User } from "../models/User";
import { sendEmail, renderEmailHtml } from "../services/email.service";
import type { PermissionKey } from "../constants/permissions";

const router = express.Router();

const SUBJECT_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 4000;
const CATEGORY_MAX_LENGTH = 100;
const ALLOWED_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

interface CreateTicketBody {
  subject?: string;
  description?: string;
  // Staff-mode fields (Story 57) — only honored when the caller's role is
  // not "customer".
  customerId?: string;
  category?: string | null;
  priority?: (typeof ALLOWED_PRIORITIES)[number];
  notifyCustomer?: boolean;
}

// A customer needs no permission concept at all (self-service, Story 8);
// every other role goes through the real requirePermission middleware,
// which already has the correct admin-implicit-pass / agent-and-subadmin
// DB-backed check (see middleware/auth.ts) — calling hasPermission directly
// here would incorrectly reject admin, whose permissions array is normally
// empty.
function customerOrPermitted(key: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user!.role === "customer") {
      next();
      return;
    }
    requirePermission(key)(req, res, next);
  };
}

// Story 8: customer submits their own ticket, created with status "new" and
// no category/assignedAgent (Stories 9/10 assign those later). Story 57:
// staff (agent/admin/subadmin holding tickets:create_for_customer) opens a
// ticket on behalf of an existing customer, additionally setting category
// (free-text until Story 58) and priority up front, with an optional
// notify-customer email. See
// .squad/plans/ticket-management/11-story-submit-a-ticket-comment-problem.md
// and .squad/plans/ticket-management/12-story-create-a-ticket-on-behalf-of-a-customer.md.
router.post(
  "/",
  requireAuth,
  customerOrPermitted("tickets:create_for_customer"),
  async (req: Request<unknown, unknown, CreateTicketBody>, res: Response) => {
    const isStaffCreated = req.user!.role !== "customer";

    const subject = (req.body?.subject ?? "").trim();
    const description = (req.body?.description ?? "").trim();

    if (!subject || !description) {
      res.status(400).json({ error: "subject and description are required" });
      return;
    }
    if (subject.length > SUBJECT_MAX_LENGTH) {
      res.status(400).json({ error: `subject must be at most ${SUBJECT_MAX_LENGTH} characters` });
      return;
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      res.status(400).json({ error: `description must be at most ${DESCRIPTION_MAX_LENGTH} characters` });
      return;
    }

    let category: string | null = null;
    let priority: (typeof ALLOWED_PRIORITIES)[number] = "medium";
    let notifyCustomer = false;
    let customer;

    if (isStaffCreated) {
      const customerId = req.body?.customerId;
      if (!customerId || !Types.ObjectId.isValid(customerId)) {
        res.status(400).json({ error: "customerId does not match an active customer" });
        return;
      }
      customer = await User.findById(customerId);
      if (!customer || customer.role !== "customer" || !customer.isActive) {
        res.status(400).json({ error: "customerId does not match an active customer" });
        return;
      }

      if (req.body?.category) {
        const trimmedCategory = req.body.category.trim();
        if (trimmedCategory.length > CATEGORY_MAX_LENGTH) {
          res.status(400).json({ error: `category must be at most ${CATEGORY_MAX_LENGTH} characters` });
          return;
        }
        category = trimmedCategory || null;
      }

      if (req.body?.priority !== undefined) {
        if (!ALLOWED_PRIORITIES.includes(req.body.priority)) {
          res.status(400).json({ error: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` });
          return;
        }
        priority = req.body.priority;
      }

      notifyCustomer = req.body?.notifyCustomer === true;
    } else {
      customer = await User.findById(req.user!.id);
      if (!customer) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
    }

    const ticket = await Ticket.create({
      subject,
      description,
      customer: customer._id,
      category,
      priority,
    });

    const referenceNumber = ticket._id.toString();
    const shouldSendEmail = !isStaffCreated || notifyCustomer;

    if (shouldSendEmail) {
      try {
        if (isStaffCreated) {
          await sendEmail({
            to: customer.email,
            subject: `A ticket was opened on your behalf — #${referenceNumber}`,
            text: `Hi ${customer.name},\n\nA member of our team opened a ticket on your behalf: "${subject}".\n\nYour reference number is ${referenceNumber}.\n\n— AzmSquad Support`,
            html: renderEmailHtml({
              heading: "A ticket was opened on your behalf",
              bodyHtml: `Hi ${customer.name},<br><br>A member of our team opened a ticket on your behalf: "<strong>${subject}</strong>".<br><br>Your reference number is <strong>${referenceNumber}</strong>.`,
              ctaText: "Back to support",
              ctaUrl: `${CLIENT_ORIGIN}/support`,
            }),
          });
        } else {
          await sendEmail({
            to: customer.email,
            subject: `We've received your ticket — #${referenceNumber}`,
            text: `Hi ${customer.name},\n\nWe've received your ticket "${subject}" and a member of our team will get back to you by email.\n\nYour reference number is ${referenceNumber}.\n\n— AzmSquad Support`,
            html: renderEmailHtml({
              heading: "We've received your ticket",
              bodyHtml: `Hi ${customer.name},<br><br>We've received your ticket "<strong>${subject}</strong>" and a member of our team will get back to you by email.<br><br>Your reference number is <strong>${referenceNumber}</strong>.`,
              ctaText: "Back to support",
              ctaUrl: `${CLIENT_ORIGIN}/support`,
            }),
          });
        }
      } catch (err) {
        // Acknowledgment/notification email is a nicety, not the source of
        // truth — the ticket already exists. Never fail the request over an
        // SMTP hiccup (same reasoning CLAUDE.md gives for Gemini calls,
        // generalized to email).
        console.error("[tickets] acknowledgment email failed", err);
      }
    }

    res.status(201).json({
      id: referenceNumber,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
    });
  }
);

// TODO (ticket-management feature, Story 13 / customer-portal Story 35-36):
// GET / — list tickets (scoped to the caller: their own if customer, assigned if
// agent, all if admin).
router.get("/", requireAuth, (req: Request, res: Response) => {
  res.status(501).json({ error: "Not implemented — see USER_STORIES.md ticket-management Story 13" });
});

export default router;
