import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth";
import { Ticket, ITicket } from "../models/Ticket";
import { Message, IMessage } from "../models/Message";
import { User } from "../models/User";
import { sendEmail, renderEmailHtml } from "../services/email.service";
import { pickNextAvailableAgent } from "../services/assignment.service";
import type { PermissionKey } from "../constants/permissions";
import { hasPermission, isActiveAccount } from "../services/permissions";
import { validateBody } from "../middleware/validate";
import {
  createTicketBodySchema,
  updateTicketBodySchema,
  replyToTicketBodySchema,
  listTicketsQuerySchema,
  ALLOWED_PRIORITIES,
} from "../validation/ticket.schema";
import { findByNameCaseInsensitive } from "./ticketCategory.routes";
import { uploadTicketMessageAttachments, ticketFilePath } from "../middleware/upload";

const router = express.Router();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

interface CreateTicketBody extends z.infer<typeof createTicketBodySchema> {
  // Staff-mode fields (Story 57) — only honored when the caller's role is
  // not "customer". Kept out of createTicketBodySchema since their
  // required-ness/validity depends on req.user's role, not the body shape
  // alone — see the inline checks below.
  customerId?: string;
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
// no category (Story 9 assigns that later); Story 10 auto-assigns an agent
// right after creation, below. Story 57:
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
  validateBody(createTicketBodySchema),
  async (req: Request<unknown, unknown, CreateTicketBody>, res: Response) => {
    const isStaffCreated = req.user!.role !== "customer";

    // Category is settable by both a customer (picking "unspecified" when
    // unsure — the frontend sends nothing in that case) and staff, unlike
    // priority/customerId/notifyCustomer, which stay staff-only.
    const { subject, description, category } = req.body;

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

    // Story 60: a human-friendly "TCK-<n>" reference for anything shown to a
    // person (email text, the submission confirmation, list/detail rows) —
    // distinct from `ticket._id`, which stays the real routing id below.
    const referenceNumber = `TCK-${ticket.ticketNumber}`;
    const shouldSendEmail = !isStaffCreated || notifyCustomer;

    // Story 10: attempt to auto-assign to an online agent (least-busy,
    // oldest-createdAt tiebreak). Never fail creation on a missing agent
    // or a DB hiccup — the ticket is the source of truth; assignment is a
    // best-effort side effect (same reasoning as the acknowledgment email
    // below).
    let assignedAgentId: Types.ObjectId | null = null;
    try {
      assignedAgentId = await pickNextAvailableAgent();
      if (assignedAgentId) {
        ticket.assignedAgent = assignedAgentId;
        await ticket.save();
      }
    } catch (err) {
      console.error("[tickets] auto-assignment failed", err);
    }

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

    if (assignedAgentId) {
      try {
        const agent = await User.findById(assignedAgentId).select("name email");
        if (agent) {
          await sendEmail({
            to: agent.email,
            subject: `New ticket assigned to you — #${referenceNumber}`,
            text: `Hi ${agent.name},\n\nA new ticket "${subject}" has been assigned to you.\n\nReference: ${referenceNumber}\n\n— AzmSquad Support`,
            html: renderEmailHtml({
              heading: "New ticket assigned to you",
              bodyHtml: `Hi ${agent.name},<br><br>A new ticket "<strong>${subject}</strong>" has been assigned to you.<br><br>Reference: <strong>${referenceNumber}</strong>.`,
              ctaText: "Open ticket",
              ctaUrl: `${CLIENT_ORIGIN}/tickets/${ticket._id.toString()}`,
            }),
          });
        }
      } catch (err) {
        console.error("[tickets] assignment notification email failed", err);
      }
    }

    res.status(201).json({
      id: ticket._id.toString(),
      reference: referenceNumber,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
    });
  }
);

// Story 60 (merged with customer-portal Story 36 "track ticket status from
// the portal" and platform Story 59 "paginate list views" — see that story's
// intake for why these three ship together): GET / lists tickets, scoped to
// the caller. requireAuth only at the middleware level — all three roles are
// let in, the actual scope narrowing happens inside the handler because it
// depends on `tickets:view_all`, which callerHasPermission below already
// checks the same way PATCH /:id does.
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid query" });
    return;
  }
  const { page, limit, status, category, priority, sort } = parsed.data;

  const filter: Record<string, unknown> = {};
  let sortSpec: Record<string, 1 | -1> = { updatedAt: -1 };

  if (req.user!.role === "customer") {
    // Customer branch: always their own tickets, always newest-updated-first.
    // Status is the one filter a customer can apply (decided with the user
    // during Story 60 kickoff, extending the original merged-scope note) —
    // category/priority/sort stay staff-only concepts and are ignored here.
    filter.customer = new Types.ObjectId(req.user!.id);
    if (status) filter.status = status;
  } else {
    // Staff branch: apply filters, then scope-enforce server-side — never
    // trust a client-supplied "show all" flag.
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    if (!(await callerHasPermission(req, "tickets:view_all"))) {
      filter.assignedAgent = new Types.ObjectId(req.user!.id);
    }

    if (sort) {
      const descending = sort.startsWith("-");
      const key = (descending ? sort.slice(1) : sort) as "updatedAt" | "status" | "category" | "priority";
      sortSpec = { [key]: descending ? -1 : 1 };
    }
  }

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ customer: { _id: Types.ObjectId; name: string; email: string } }>("customer", "name email")
      .populate<{ assignedAgent: { _id: Types.ObjectId; name: string } | null }>("assignedAgent", "name"),
    Ticket.countDocuments(filter),
  ]);

  res.status(200).json({
    tickets: tickets.map((ticket) => toTicketListItem(ticket)),
    total,
    page,
    limit,
  });
});

// Mirrors ticketCategory.routes.ts's callerHasPermission exactly (admin
// implicit-pass + live isActive check; agent/subadmin get a live DB-backed
// hasPermission check) — duplicated rather than imported since it's a
// 4-line helper and importing route-internal helpers across files adds
// more coupling than it saves.
async function callerHasPermission(req: Request, key: PermissionKey): Promise<boolean> {
  if (req.user!.role === "admin") return isActiveAccount(req.user!.id);
  return hasPermission(req.user!.id, key);
}

// Populate() replaces `customer` with the populated document, so this takes
// only the fields it actually reads off `ticket` rather than the full
// ITicket (whose `customer: Types.ObjectId` no longer matches after populate).
type TicketDetailFields = Pick<
  ITicket,
  | "ticketNumber"
  | "subject"
  | "description"
  | "status"
  | "category"
  | "priority"
  | "assignedAgent"
  | "createdAt"
  | "updatedAt"
> & { _id: Types.ObjectId };

function toTicketDetailResponse(ticket: TicketDetailFields, customer: { id: string; name: string; email: string }) {
  return {
    id: ticket._id.toString(),
    reference: `TCK-${ticket.ticketNumber}`,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    category: ticket.category,
    priority: ticket.priority,
    customer,
    assignedAgent: ticket.assignedAgent,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

// Story 60: one row of GET /'s paginated list — a narrower shape than
// toTicketDetailResponse (no description, populated customer/assignedAgent
// already carried by the query above rather than a second lookup).
type TicketListFields = Pick<
  ITicket,
  "ticketNumber" | "subject" | "status" | "category" | "priority" | "createdAt" | "updatedAt"
> & {
  _id: Types.ObjectId;
  customer: { _id: Types.ObjectId; name: string; email: string };
  assignedAgent: { _id: Types.ObjectId; name: string } | null;
};

function toTicketListItem(ticket: TicketListFields) {
  return {
    id: ticket._id.toString(),
    reference: `TCK-${ticket.ticketNumber}`,
    subject: ticket.subject,
    status: ticket.status,
    category: ticket.category,
    priority: ticket.priority,
    customer: { id: ticket.customer._id.toString(), name: ticket.customer.name, email: ticket.customer.email },
    assignedAgent: ticket.assignedAgent
      ? { id: ticket.assignedAgent._id.toString(), name: ticket.assignedAgent.name }
      : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}

// Story 9: single-ticket detail read, backing the ticket-detail page.
// Story 60 added the customer branch: a customer may read their OWN ticket
// (read-only — no category/priority edits, no reply, enforced by never
// giving customers write routes below, not by anything in this handler).
router.get(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin", "customer"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const ticket = await Ticket.findById(req.params.id).populate<{
      customer: { _id: Types.ObjectId; name: string; email: string };
    }>("customer", "name email");
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    // 404, never 403 — a customer probing a foreign ticket id must not be
    // able to tell "forbidden" (ticket exists) apart from "not found".
    if (req.user!.role === "customer" && ticket.customer._id.toString() !== req.user!.id) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.status(200).json(
      toTicketDetailResponse(ticket, {
        id: ticket.customer._id.toString(),
        name: ticket.customer.name,
        email: ticket.customer.email,
      })
    );
  }
);

// Story 9: change category and/or priority on an existing ticket. One
// endpoint, not two — mirrors ticketCategory.routes.ts's PATCH /:id, which
// also handles multiple independently-permissioned fields in one request.
// requirePermission can't gate this route at the middleware level since the
// required key depends on which fields are present in this specific
// request body.
router.patch(
  "/:id",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Presence is checked against the RAW body, not the parsed result —
    // categoryFieldSchema's transform turns an absent key into `null`, same
    // as it does for POST /'s creation case, which would otherwise make
    // "field omitted" indistinguishable from "field explicitly cleared."
    const rawBody = (req.body ?? {}) as Record<string, unknown>;
    const parsed = updateTicketBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    const { category, priority } = parsed.data;

    if ("category" in rawBody && !(await callerHasPermission(req, "tickets:categorize"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    if ("priority" in rawBody && !(await callerHasPermission(req, "tickets:change_priority"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }

    if ("category" in rawBody) {
      if (category === null) {
        ticket.category = null;
      } else {
        const existing = await findByNameCaseInsensitive(category);
        if (!existing || !existing.active) {
          res.status(400).json({ error: "category does not match an active ticket category" });
          return;
        }
        ticket.category = existing.name; // canonical stored casing, not the caller's
      }
      console.info(`[tickets] ${req.params.id} category changed by ${req.user!.id} to ${ticket.category}`);
    }

    if ("priority" in rawBody) {
      ticket.priority = priority!;
      console.info(`[tickets] ${req.params.id} priority changed by ${req.user!.id} to ${priority}`);
    }

    await ticket.save();
    const populated = await ticket.populate<{ customer: { _id: Types.ObjectId; name: string; email: string } }>(
      "customer",
      "name email"
    );
    res.status(200).json(
      toTicketDetailResponse(populated, {
        id: populated.customer._id.toString(),
        name: populated.customer.name,
        email: populated.customer.email,
      })
    );
  }
);

interface MessageSenderFields {
  id: string;
  name: string;
}

// Populate() replaces `senderId` with the populated document in the GET
// .../messages listing, so this takes only the fields it actually reads off
// `message` rather than the full IMessage (whose `senderId: Types.ObjectId
// | null` no longer matches after populate) — same reasoning as
// TicketDetailFields above.
type MessageFields = Pick<IMessage, "text" | "senderType" | "internal" | "attachments" | "createdAt"> & {
  _id: Types.ObjectId;
};

function toMessageResponse(message: MessageFields, sender: MessageSenderFields | null) {
  return {
    id: message._id.toString(),
    text: message.text,
    senderType: message.senderType,
    sender,
    internal: message.internal,
    attachments: message.attachments.map((a) => ({
      id: a._id.toString(),
      fileName: a.fileName,
      size: a.size,
      url: a.url,
    })),
    createdAt: message.createdAt,
  };
}

// Story 56: the ticket's message thread — any staff role that can view the
// ticket (GET /:id) can also view its thread, no separate permission (same
// reasoning as GET /:id itself: read access isn't gated per-action here).
// Story 60 added the customer branch: same ownership rule as GET /:id
// (404-not-403), plus internal notes are excluded from the response —
// `internal: true` is agent-only per Message.ts's own doc comment, never
// shown to the customer.
router.get(
  "/:id/messages",
  requireAuth,
  requireRole("agent", "admin", "subadmin", "customer"),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const ticket = await Ticket.findById(req.params.id).select("customer");
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const isCustomerCaller = req.user!.role === "customer";
    if (isCustomerCaller && ticket.customer.toString() !== req.user!.id) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const filter: Record<string, unknown> = { parentType: "ticket", parentId: ticket._id };
    if (isCustomerCaller) {
      filter.internal = { $ne: true };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: 1 })
      .populate<{ senderId: { _id: Types.ObjectId; name: string } | null }>("senderId", "name");

    res.status(200).json(
      messages.map((m) =>
        toMessageResponse(m, m.senderId ? { id: m.senderId._id.toString(), name: m.senderId.name } : null)
      )
    );
  }
);

// Story 56: write a reply, email it to the customer, store it, and flip
// status to "answered" unless the ticket is already closed.
// uploadTicketMessageAttachments runs after the permission check so an
// unauthorized caller's files are never written to disk, then parses
// req.body/req.files before the handler runs (see the schema's own comment
// on why validateBody isn't used here) — mirrors customer.routes.ts's POST
// /:id/attachments ordering.
router.post(
  "/:id/messages",
  requireAuth,
  requirePermission("tickets:reply"),
  uploadTicketMessageAttachments,
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const ticket = await Ticket.findById(req.params.id).populate<{
      customer: { _id: Types.ObjectId; name: string; email: string };
    }>("customer", "name email");
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const parsed = replyToTicketBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    const { text } = parsed.data;

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    // Generated up front (rather than left to Mongoose) so each attachment's
    // `url` — which embeds both ids — can be computed before Message.create()
    // runs; `url` is `required: true`, so a create-then-patch-with-the-real-
    // url two-step would fail validation on the initial empty placeholder.
    const messageId = new Types.ObjectId();
    const attachments = files.map((file) => {
      const attachmentId = new Types.ObjectId();
      return {
        _id: attachmentId,
        fileName: file.originalname,
        storageFileName: file.filename,
        size: file.size,
        url: `/api/v1/tickets/${ticket.id}/messages/${messageId}/attachments/${attachmentId}`,
      };
    });

    const message = await Message.create({
      _id: messageId,
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: req.user!.id,
      text,
      internal: false,
      attachments,
    });

    if (ticket.status !== "closed") {
      ticket.status = "answered";
      await ticket.save();
    }

    try {
      await sendEmail({
        to: ticket.customer.email,
        subject: `Re: ${ticket.subject} — #${ticket.id}`,
        text,
        html: renderEmailHtml({
          heading: "New reply on your ticket",
          bodyHtml: `Hi ${ticket.customer.name},<br><br>${text.replace(/\n/g, "<br>")}`,
          ctaText: "Back to support",
          ctaUrl: `${CLIENT_ORIGIN}/support`,
        }),
        attachments: files.map((file) => ({
          filename: file.originalname,
          path: ticketFilePath(ticket.id, file.filename),
        })),
      });
    } catch (err) {
      // Same reasoning as POST /'s acknowledgment email — the reply is
      // already saved; an SMTP hiccup must not fail or roll back the request.
      console.error("[tickets] reply email failed", err);
    }

    const sender = await User.findById(req.user!.id, { name: 1 });
    res.status(201).json(toMessageResponse(message, sender ? { id: sender.id, name: sender.name } : null));
  }
);

// Protected download, same reasoning as customer.routes.ts's GET
// /:id/attachments/:attachmentId — never express.static.
router.get(
  "/:id/messages/:messageId/attachments/:attachmentId",
  requireAuth,
  requireRole("agent", "admin", "subadmin"),
  async (req: Request<{ id: string; messageId: string; attachmentId: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id) || !Types.ObjectId.isValid(req.params.messageId)) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    const message = await Message.findOne({
      _id: req.params.messageId,
      parentType: "ticket",
      parentId: req.params.id,
    });
    if (!message) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    const attachment = message.attachments.find((a) => String(a._id) === req.params.attachmentId);
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    res.download(ticketFilePath(req.params.id, attachment.storageFileName), attachment.fileName, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
    });
  }
);

export default router;
