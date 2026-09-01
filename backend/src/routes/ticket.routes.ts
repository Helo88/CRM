import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth";
import { Ticket, ITicket, TicketStatus } from "../models/Ticket";
import { Message, IMessage } from "../models/Message";
import { User } from "../models/User";
import { Conversation } from "../models/Conversation";
import { sendEmail, renderEmailHtml } from "../services/email.service";
import { pickNextAvailableAgent } from "../services/assignment.service";
import { createTicketNotification, notifyTicketOversight } from "../services/notification.service";
import type { PermissionKey } from "../constants/permissions";
import { hasPermission, isActiveAccount } from "../services/permissions";
import { validateBody } from "../middleware/validate";
import { escapeRegex } from "../utils/regex";
import {
  createTicketBodySchema,
  updateTicketBodySchema,
  updateTicketStatusSchema,
  escalateTicketBodySchema,
  replyToTicketBodySchema,
  listTicketsQuerySchema,
  ALLOWED_PRIORITIES,
} from "../validation/ticket.schema";
import { findByNameCaseInsensitive } from "./ticketCategory.routes";
import { uploadTicketMessageAttachments, ticketFilePath } from "../middleware/upload";
import { applyStatusTransition, InvalidStatusTransitionError } from "../services/ticketStatus.service";
import { escalateTicket, InvalidEscalationTargetError } from "../services/ticketEscalation.service";

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

      // tickets:create_for_customer alone only covers creating with defaults
      // (no category, priority "medium") — setting either to something
      // non-default up front needs the same per-field permission PATCH /:id
      // already requires to change them later (see callerHasPermission
      // below, defined further down this file but hoisted). `category` is
      // already transform-normalized to null when omitted/blank by
      // createTicketBodySchema, so a truthy check is equivalent to "was a
      // real category provided."
      if (category && !(await callerHasPermission(req, "tickets:categorize"))) {
        res.status(403).json({ error: "You do not have permission to perform this action" });
        return;
      }

      if (req.body?.priority !== undefined) {
        if (!ALLOWED_PRIORITIES.includes(req.body.priority)) {
          res.status(400).json({ error: `priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}` });
          return;
        }
        if (!(await callerHasPermission(req, "tickets:change_priority"))) {
          res.status(403).json({ error: "You do not have permission to perform this action" });
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

    // Story 62: accepting the AI's "open a ticket" suggestion from a live
    // chat sends the conversation id along — verify it exists and belongs
    // to this same customer before linking it, so one customer can't graft
    // their ticket onto another's conversation.
    let sourceConversationId: Types.ObjectId | null = null;
    if (req.body?.sourceConversation) {
      const conversation = await Conversation.findById(req.body.sourceConversation);
      if (!conversation || conversation.customer.toString() !== customer._id.toString()) {
        res.status(403).json({ error: "You do not have permission to link this conversation" });
        return;
      }
      sourceConversationId = conversation._id;
    }

    // ticket-management Story 11: seed the audit trail with the creation
    // itself — the staff creator on behalf of a customer (Story 57), or the
    // customer themself for a self-submitted ticket.
    const creatorId = isStaffCreated ? new Types.ObjectId(req.user!.id) : customer._id;
    const ticket = await Ticket.create({
      subject,
      description,
      customer: customer._id,
      category,
      priority,
      sourceConversation: sourceConversationId,
      statusHistory: [{ status: "new", changedBy: creatorId, changedAt: new Date() }],
    });

    // Story 60: a human-friendly "TCK-<n>" reference for anything shown to a
    // person (email text, the submission confirmation, list/detail rows) —
    // distinct from `ticket._id`, which stays the real routing id below.
    const referenceNumber = `TCK-${ticket.ticketNumber}`;
    const shouldSendEmail = !isStaffCreated || notifyCustomer;

    // Oversight nudge: every new ticket, regardless of how it was created or
    // whether auto-assignment below succeeds, is visible to admins/permitted
    // subadmins immediately — best effort, same reasoning as every other
    // notification/email in this handler (never fails ticket creation).
    await notifyTicketOversight({ type: "ticket_created", ticketId: ticket._id });

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
        // Story 54: in-app nudge alongside the assignment email below — best
        // effort, same reasoning as that email (never fails ticket creation).
        await createTicketNotification({ recipient: assignedAgentId, type: "ticket_assigned", ticketId: ticket._id });
        await notifyTicketOversight({ type: "ticket_auto_assigned", ticketId: ticket._id });
      } else {
        // No agent was online to pick up the ticket at all — leaving it
        // silently unassigned means nobody finds out until someone happens
        // to look at the queue. Oversight needs the nudge since manual
        // reassignment (Story 25) is the only way this ticket gets an agent.
        await notifyTicketOversight({ type: "ticket_needs_assignment", ticketId: ticket._id });
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
  const { page, limit, status, category, priority, sort, createdFrom, createdTo, updatedFrom, updatedTo, q } =
    parsed.data;
  const searchRegex = q ? new RegExp(escapeRegex(q), "i") : null;

  const filter: Record<string, unknown> = {};
  let sortSpec: Record<string, 1 | -1> = { updatedAt: -1 };
  // ticket-management (Plan 29 — status quick-filter chips): the same scope
  // as `filter`, minus `status`, so the chip row's per-status counts reflect
  // the category/priority/permission scoping currently applied without also
  // being narrowed by whichever status chip happens to be selected. Stays
  // null for the customer branch — no chips there (Story 60's decision that
  // the customer list skips filter/sort UI entirely still holds).
  let countFilter: Record<string, unknown> | null = null;

  if (req.user!.role === "customer") {
    // Customer branch: always their own tickets, always newest-updated-first.
    // Status is the one filter a customer can apply (decided with the user
    // during Story 60 kickoff, extending the original merged-scope note) —
    // category/priority/sort stay staff-only concepts and are ignored here.
    filter.customer = new Types.ObjectId(req.user!.id);
    if (status) filter.status = status;
    if (searchRegex) filter.subject = searchRegex;
  } else {
    // Staff branch: apply filters, then scope-enforce server-side — never
    // trust a client-supplied "show all" flag.
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    // Two independent date-range pairs (not one "date field" toggle) — a
    // caller can filter by createdAt and updatedAt at once.
    if (createdFrom || createdTo) {
      filter.createdAt = {
        ...(createdFrom ? { $gte: new Date(createdFrom) } : {}),
        ...(createdTo ? { $lte: new Date(createdTo) } : {}),
      };
    }
    if (updatedFrom || updatedTo) {
      filter.updatedAt = {
        ...(updatedFrom ? { $gte: new Date(updatedFrom) } : {}),
        ...(updatedTo ? { $lte: new Date(updatedTo) } : {}),
      };
    }

    if (!(await callerHasPermission(req, "tickets:view_all"))) {
      filter.assignedAgent = new Types.ObjectId(req.user!.id);
    }

    // Subject lives on Ticket; customer/agent names live on the referenced
    // User documents, so a same-collection regex can't reach them — resolve
    // matching User ids first, then match tickets by subject OR either
    // reference pointing at one of those ids.
    if (searchRegex) {
      const matchedUsers = await User.find({ name: searchRegex }, { _id: 1 }).lean();
      const matchedUserIds = matchedUsers.map((u) => u._id);
      filter.$or = [
        { subject: searchRegex },
        ...(matchedUserIds.length
          ? [{ customer: { $in: matchedUserIds } }, { assignedAgent: { $in: matchedUserIds } }]
          : []),
      ];
    }

    countFilter = { ...filter };
    if (status) filter.status = status;

    if (sort) {
      const descending = sort.startsWith("-");
      const key = (descending ? sort.slice(1) : sort) as "updatedAt" | "status" | "category" | "priority";
      sortSpec = { [key]: descending ? -1 : 1 };
    }
  }

  const [tickets, total, countsAgg] = await Promise.all([
    Ticket.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ customer: { _id: Types.ObjectId; name: string; email: string } }>("customer", "name email")
      .populate<{ assignedAgent: { _id: Types.ObjectId; name: string } | null }>("assignedAgent", "name"),
    Ticket.countDocuments(filter),
    countFilter
      ? Ticket.aggregate<{ _id: TicketStatus; count: number }>([
          { $match: countFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
      : Promise.resolve(null),
  ]);

  // Piggybacked onto this same response rather than a second endpoint — a
  // status-chip click already refetches this list on every change, so a
  // separate `GET .../status-counts` would double the round-trips for no
  // benefit; the extra cost here is one aggregation alongside the query this
  // route already runs.
  let statusCounts: Record<TicketStatus, number> | undefined;
  if (countsAgg) {
    statusCounts = { new: 0, in_progress: 0, answered: 0, escalated: 0, closed: 0 };
    for (const row of countsAgg) statusCounts[row._id] = row.count;
  }

  res.status(200).json({
    tickets: tickets.map((ticket) => toTicketListItem(ticket)),
    total,
    page,
    limit,
    ...(statusCounts ? { statusCounts } : {}),
  });
});

// Mirrors ticketCategory.routes.ts's callerHasPermission exactly (admin
// implicit-pass + live isActive check; agent/subadmin get a live DB-backed
// hasPermission check) — duplicated rather than imported since it's a
// 4-line helper and importing route-internal helpers across files adds
// more coupling than it saves.
async function callerHasPermission(req: Pick<Request, "user">, key: PermissionKey): Promise<boolean> {
  if (req.user!.role === "admin") return isActiveAccount(req.user!.id);
  return hasPermission(req.user!.id, key);
}

// Story 25 (agent-workspace): backs the reassign dropdown, both on the
// ticket-detail page and inline in the queue table. Registered before
// GET /:id below so Express doesn't swallow this path as an :id — deliberately
// its own minimal endpoint (id + name only) rather than reusing
// GET /admin/users?role=agent: that one is gated on staff:view_list, which a
// sub-admin holding only tickets:reassign has no reason to also hold (same
// "narrow, ticket-scoped" reasoning ticketCategory.routes.ts already gives
// for not routing category management through the much later `platform`
// feature). Every active agent is returned regardless of isOnline — manual
// reassignment is explicitly for handing a ticket to someone offline, unlike
// auto-assignment (assignment.service.ts), which only ever considers online
// agents. `isOnline` rides along so the frontend can grey out offline
// targets for a plain-agent caller (who is restricted to online targets —
// see PATCH /:id below), while admin/sub-admin see every option enabled.
router.get(
  "/assignable-agents",
  requireAuth,
  requirePermission("tickets:reassign"),
  async (_req: Request, res: Response) => {
    const agents = await User.find({ role: "agent", isActive: true, isDeleted: false })
      .select("_id name isOnline")
      .sort({ name: 1 })
      .lean();
    res
      .status(200)
      .json(agents.map((a) => ({ id: a._id.toString(), name: a.name, isOnline: Boolean(a.isOnline) })));
  }
);

// Story 12: backs the "Escalate ticket" target picker. Unlike
// /assignable-agents above (agents only, for reassignment), an escalation
// target may be an agent, admin, or subadmin — "a senior agent or admin" per
// the story — so this is its own endpoint rather than widening
// /assignable-agents' role filter for an unrelated caller. Excludes the
// caller themself (self-escalation is rejected server-side anyway, but
// there's no reason to offer it as an option).
router.get(
  "/escalation-targets",
  requireAuth,
  requirePermission("tickets:escalate"),
  async (req: Request, res: Response) => {
    const targets = await User.find({
      _id: { $ne: req.user!.id },
      role: { $in: ["agent", "admin", "subadmin"] },
      isActive: true,
      isDeleted: false,
    })
      .select("_id name role")
      .sort({ name: 1 })
      .lean();
    res.status(200).json(targets.map((u) => ({ id: u._id.toString(), name: u.name, role: u.role })));
  }
);

// Populate() replaces `customer`/`assignedAgent` with the populated document,
// so this takes only the fields it actually reads off `ticket` rather than
// the full ITicket (whose `customer`/`assignedAgent: Types.ObjectId | null`
// no longer match after populate).
type TicketDetailFields = Pick<
  ITicket,
  "ticketNumber" | "subject" | "description" | "status" | "category" | "priority" | "createdAt" | "updatedAt"
> & {
  _id: Types.ObjectId;
  assignedAgent: { _id: Types.ObjectId; name: string } | null;
  // ticket-management Story 12: populated (not the raw ObjectId) so the
  // sidebar can render "Escalated to <name>" without a second round trip —
  // same reasoning as assignedAgent above.
  escalatedTo: { _id: Types.ObjectId; name: string } | null;
};

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
    assignedAgent: ticket.assignedAgent
      ? { id: ticket.assignedAgent._id.toString(), name: ticket.assignedAgent.name }
      : null,
    escalatedTo: ticket.escalatedTo ? { id: ticket.escalatedTo._id.toString(), name: ticket.escalatedTo.name } : null,
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
    const ticket = await Ticket.findById(req.params.id)
      .populate<{
        customer: { _id: Types.ObjectId; name: string; email: string };
      }>("customer", "name email")
      .populate<{
        assignedAgent: { _id: Types.ObjectId; name: string } | null;
      }>("assignedAgent", "name")
      .populate<{
        escalatedTo: { _id: Types.ObjectId; name: string } | null;
      }>("escalatedTo", "name");
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
    const { category, priority, assignedAgent } = parsed.data;

    if ("category" in rawBody && !(await callerHasPermission(req, "tickets:categorize"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    if ("priority" in rawBody && !(await callerHasPermission(req, "tickets:change_priority"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    if ("assignedAgent" in rawBody && !(await callerHasPermission(req, "tickets:reassign"))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }

    // Story 25: manual reassignment. `previousAgentId`/`newAgentId` are
    // tracked separately from the mutation so the notifications after
    // save() only fire on an actual change, not a no-op "reassign to the
    // same agent" — and so both the outgoing and incoming assignee can be
    // notified independently.
    let previousAgentId: Types.ObjectId | null = null;
    let newAgentId: Types.ObjectId | null = null;
    if ("assignedAgent" in rawBody) {
      previousAgentId = ticket.assignedAgent;
      if (assignedAgent === null) {
        ticket.assignedAgent = null;
      } else {
        // Availability rule: admin/sub-admin may reassign to any active
        // agent regardless of isOnline — that's the whole point of a manual
        // reassign (handing off from/to someone offline). A plain agent
        // holding tickets:reassign (peer-level reassignment) is restricted
        // to another agent currently marked online, unlike admin/sub-admin —
        // matches USER_STORIES.md Story 25's own distinction.
        const isUnrestrictedCaller = req.user!.role === "admin" || req.user!.role === "subadmin";
        const targetAgent = await User.findOne({
          _id: assignedAgent,
          role: "agent",
          isActive: true,
          isDeleted: false,
        }).select("_id isOnline");
        if (!targetAgent) {
          res.status(400).json({ error: "assignedAgent does not match an active agent" });
          return;
        }
        if (!isUnrestrictedCaller && !targetAgent.isOnline) {
          res.status(400).json({ error: "assignedAgent must be online for you to reassign to them" });
          return;
        }
        if (String(ticket.assignedAgent) !== String(targetAgent._id)) {
          newAgentId = targetAgent._id;
        }
        ticket.assignedAgent = targetAgent._id;
      }
      console.info(
        `[ticket-reassigned] ticket=${req.params.id} from=${previousAgentId ?? "null"} to=${ticket.assignedAgent ?? "null"} by=${req.user!.id} at=${new Date().toISOString()}`
      );
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

    // Story 25/54: notify both sides of an actual reassignment — best
    // effort, same reasoning as the auto-assignment notification in POST /
    // above (never fails the reassignment itself). previousAgentId only
    // fires when it existed and differs from the new one, so unassigning an
    // already-unassigned ticket (or reassigning to the same agent) is a
    // silent no-op, not a spurious notification.
    if (newAgentId) {
      await createTicketNotification({ recipient: newAgentId, type: "ticket_reassigned", ticketId: ticket._id });
    }
    if (previousAgentId && String(previousAgentId) !== String(newAgentId ?? ticket.assignedAgent)) {
      await createTicketNotification({ recipient: previousAgentId, type: "ticket_unassigned", ticketId: ticket._id });
    }

    // A single multi-path populate() call, not two chained calls — Document
    // (unlike Query) doesn't reliably carry a merged generic across a second
    // `.populate()` invoked on the first call's resolved result.
    const populated = await ticket.populate<{
      customer: { _id: Types.ObjectId; name: string; email: string };
      assignedAgent: { _id: Types.ObjectId; name: string } | null;
      escalatedTo: { _id: Types.ObjectId; name: string } | null;
    }>([
      { path: "customer", select: "name email" },
      { path: "assignedAgent", select: "name" },
      { path: "escalatedTo", select: "name" },
    ]);
    res.status(200).json(
      toTicketDetailResponse(populated, {
        id: populated.customer._id.toString(),
        name: populated.customer.name,
        email: populated.customer.email,
      })
    );
  }
);

// ticket-management Story 11: move a ticket through New -> In Progress ->
// Answered -> Closed (and reopen back to In Progress). Two permission keys,
// not one, per the intake's split rationale: tickets:change_status covers
// the three "open" states, tickets:close_reopen specifically covers closing
// and reopening — so an account can be granted routine status flips without
// also getting authority to close/reopen, or vice versa. requirePermission
// can't gate this route at the middleware level (same reasoning as PATCH
// /:id above) since which key applies depends on BOTH the target status AND
// the ticket's CURRENT status (reopening a closed ticket needs
// close_reopen even though "in_progress" alone would otherwise only need
// change_status). Uses callerHasPermission, never a bare hasPermission call,
// so admin's implicit pass still works — admin holds no stored permission
// grants at all (see the customerOrPermitted comment above for the same
// warning already written down for this file). A customer caller is
// rejected here too: customerOrPermitted isn't used because a customer has
// no legitimate reason to reach this route at all (unlike POST / above),
// and callerHasPermission already returns false for a role with neither key
// stored — no separate customer branch needed.
//
// TODO: replies (POST /:id/messages below) and reassignment (PATCH /:id
// above) still succeed on a closed ticket — this story doesn't add that
// guard (closed-ticket lockdown is enforced in the frontend for now; see
// ticket-management/update-ticket-status's plan for the scope decision).
router.patch(
  "/:id/status",
  requireAuth,
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const parsed = updateTicketStatusSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }
    const { status: nextStatus } = parsed.data;

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const isCloseOrReopen = nextStatus === "closed" || ticket.status === "closed";
    const requiredKey: PermissionKey = isCloseOrReopen ? "tickets:close_reopen" : "tickets:change_status";
    if (!(await callerHasPermission(req, requiredKey))) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }

    const wasClosed = ticket.status === "closed";

    try {
      await applyStatusTransition({
        ticket,
        nextStatus,
        changedBy: new Types.ObjectId(req.user!.id),
        reason: "manual",
      });
    } catch (err) {
      if (err instanceof InvalidStatusTransitionError) {
        res.status(400).json({ error: "invalid_status_transition", from: err.from, to: err.to });
        return;
      }
      throw err;
    }

    // Reopening is oversight-worthy on its own (unlike a routine reassignment
    // above, which only notifies the two agents involved) — a ticket coming
    // back from "closed" is more consequential. Both conditions are needed:
    // wasClosed alone isn't enough — a same-state closed -> closed PATCH is
    // a no-op inside applyStatusTransition (returns early, no mutation, no
    // error), so it still reaches this line; checking ticket.status is no
    // longer "closed" rules that case out.
    if (wasClosed && ticket.status !== "closed") {
      await notifyTicketOversight({ type: "ticket_reopened_oversight", ticketId: ticket._id });
      if (ticket.assignedAgent) {
        await createTicketNotification({
          recipient: ticket.assignedAgent,
          type: "ticket_reopened",
          ticketId: ticket._id,
        });
      }
    }

    const populated = await ticket.populate<{
      customer: { _id: Types.ObjectId; name: string; email: string };
      assignedAgent: { _id: Types.ObjectId; name: string } | null;
      escalatedTo: { _id: Types.ObjectId; name: string } | null;
    }>([
      { path: "customer", select: "name email" },
      { path: "assignedAgent", select: "name" },
      { path: "escalatedTo", select: "name" },
    ]);
    res.status(200).json(
      toTicketDetailResponse(populated, {
        id: populated.customer._id.toString(),
        name: populated.customer.name,
        email: populated.customer.email,
      })
    );
  }
);

// ticket-management Story 12: manual escalation to a senior agent or admin.
// A dedicated endpoint, not a value PATCH /:id/status accepts — the escalate
// action also writes `escalatedTo` and fires notifications, neither of which
// generic status-transition handler above knows about (see
// ticketEscalation.service.ts). ALLOWED_MANUAL_STATUSES still rejects a
// direct PATCH /:id/status { status: "escalated" } request, so this is the
// only way in.
router.post(
  "/:id/escalate",
  requireAuth,
  requirePermission("tickets:escalate"),
  validateBody(escalateTicketBodySchema),
  async (req: Request<{ id: string }>, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const { escalatedTo } = req.body as { escalatedTo: string };

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Idempotent on a repeat click to the same target (no new notification,
    // no history entry); re-escalating to a DIFFERENT target is rejected —
    // that's a follow-up "re-escalate" story's call, not silently overwritten
    // here.
    if (ticket.status === "escalated") {
      if (String(ticket.escalatedTo) === escalatedTo) {
        const populated = await ticket.populate<{
          customer: { _id: Types.ObjectId; name: string; email: string };
          assignedAgent: { _id: Types.ObjectId; name: string } | null;
          escalatedTo: { _id: Types.ObjectId; name: string } | null;
        }>([
          { path: "customer", select: "name email" },
          { path: "assignedAgent", select: "name" },
          { path: "escalatedTo", select: "name" },
        ]);
        res.status(200).json(
          toTicketDetailResponse(populated, {
            id: populated.customer._id.toString(),
            name: populated.customer.name,
            email: populated.customer.email,
          })
        );
        return;
      }
      res.status(409).json({ error: "Ticket is already escalated" });
      return;
    }

    try {
      await escalateTicket({
        ticket,
        escalatedToUserId: new Types.ObjectId(escalatedTo),
        changedBy: new Types.ObjectId(req.user!.id),
        reason: "manual",
      });
    } catch (err) {
      if (err instanceof InvalidEscalationTargetError) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof InvalidStatusTransitionError) {
        res.status(409).json({ error: "Ticket cannot be escalated from its current status" });
        return;
      }
      throw err;
    }

    const populated = await ticket.populate<{
      customer: { _id: Types.ObjectId; name: string; email: string };
      assignedAgent: { _id: Types.ObjectId; name: string } | null;
      escalatedTo: { _id: Types.ObjectId; name: string } | null;
    }>([
      { path: "customer", select: "name email" },
      { path: "assignedAgent", select: "name" },
      { path: "escalatedTo", select: "name" },
    ]);
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

    // ticket-management Story 11: route the automatic "answered" flip
    // through the same audited helper the manual PATCH /:id/status uses, so
    // this — the single most common status change — also lands in
    // statusHistory instead of only the manual path being logged. Guarded
    // the same way the pre-Story-11 code was: skip entirely on a closed
    // ticket (replies are still allowed there, per the TODO above — status
    // just doesn't flip). applyStatusTransition would otherwise reject
    // "closed" -> "answered" as an illegal transition.
    if (ticket.status !== "closed") {
      await applyStatusTransition({
        ticket,
        nextStatus: "answered",
        changedBy: new Types.ObjectId(req.user!.id),
        reason: "auto_reply",
      });
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
