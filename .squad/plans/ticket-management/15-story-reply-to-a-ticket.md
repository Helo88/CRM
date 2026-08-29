# Story 15 — Reply to a ticket

**Correction applied during planning (verified against real code, not assumed from the intake):** the intake's dependency note says "Agent can attach files to a reply, same as a customer can when submitting (Story 8)." Read `backend/src/validation/ticket.schema.ts`'s `createTicketBodySchema` (lines 24–39) and `frontend/app/tickets/new/SubmitTicketForm.tsx` in full — **neither has any attachment/file field**. Story 8 shipped without the "attachments are optional" bullet from its own original acceptance criteria (`USER_STORIES.md` Story 8). That gap is **not** fixed by this plan (out of scope — it's Story 8's own gap, not this story's), but this story's own attachment support does **not** depend on it existing; it's built fresh here per this story's own acceptance criterion ("Agent can attach files to a reply").

**Second correction:** the intake says "This story does NOT need a new model, just a new endpoint." True for `Message` itself, but read `backend/src/models/Message.ts` lines 6–9: `IMessageAttachment` only has `fileName`/`url` — no field to locate the file on disk for a protected download (contrast `backend/src/models/User.ts`'s `IAttachment`, lines 8–26, which has `storageFileName`/`size` for exactly this reason, added when Story 7 built the same kind of protected file download). This plan extends `IMessageAttachment` additively (new optional-at-the-type-level-but-always-populated-going-forward fields) — not a new model, but not a zero-change reuse either.

**Third correction:** the intake lists only the reply-send endpoint. Rendering the reply composer against the thread shown in the attached mockup (`agent-detail-thread.png`) requires a way to **read** the thread too — there is no existing "list messages for a ticket" endpoint anywhere in the codebase (confirmed: `grep -rn "parentType" backend/src/routes/` matches nothing). This plan adds `GET /api/v1/tickets/:id/messages` alongside the `POST` the intake specifies, since the UI outcome the intake describes ("a reply composer on the ticket detail view") cannot exist without it.

---

## Prerequisites

- Story 8/57 done: tickets exist (`backend/src/models/Ticket.ts`).
- Story 9 done (this session): `/tickets/[id]` page exists (`frontend/app/tickets/[id]/page.tsx`), `GET`/`PATCH /api/v1/tickets/:id` exist (`backend/src/routes/ticket.routes.ts`). This story extends that same page — it does not create a second ticket-detail route, per that page's own comment (`frontend/app/tickets/[id]/page.tsx` lines 37–39: "Story 56 (reply) and Story 11 (status) extend this same page later rather than forking a second one").
- Story 7 done: `backend/src/middleware/upload.ts` and `backend/src/routes/customer.routes.ts`'s notes/attachments endpoints (lines 390–497) are the direct precedent this story's ticket-scoped upload follows.
- **Story 11 (Update ticket status) is NOT built yet.** Per the intake's own dependency note, this story inlines the "→ Answered" transition directly on `Ticket.status` (a plain field assignment, no state-machine abstraction) rather than waiting on or calling into a Story 11 endpoint that doesn't exist. When Story 11 is planned, it should treat this inline transition as the existing behavior to preserve, not something to route around.

---

## Story Goal

1. An agent (or admin/subadmin holding `tickets:reply`) can write a reply on `/tickets/[id]`, optionally attaching files, and send it. The reply is emailed to `Ticket.customer`'s address, stored as a `Message`, and — unless the ticket is already `"closed"` — flips `Ticket.status` to `"answered"`.
2. The same page renders the ticket's message thread (every non-internal `Message` for that ticket, oldest first) above the composer, each entry showing sender name, "Sent by email" label, timestamp, text, and any attachments as downloadable links — matching `.squad/stories/ticket-management/reply-to-a-ticket/attachments/agent-detail-thread.png`.
3. `GET /api/v1/tickets/:id/messages` (new) backs the thread read. `POST /api/v1/tickets/:id/messages` (new) creates the reply.
4. A new `tickets:reply` permission key gates sending (day-to-day agent action, not sub-admin-only, matching `tickets:categorize`/`tickets:change_priority`'s tier).

**Not in scope:**

- Internal notes (`Message.internal: true`) — `agent-workspace` Story 24. This story's endpoints accept/return the `internal` field generically (so Story 24 can reuse them) but this story's own UI only ever creates `internal: false` messages and the intake's mockup's internal-note bubble is not built here.
- The customer viewing this same thread — `customer-portal` Story 36. No customer-facing route is added in this story.
- The customer replying back into an open ticket — confirmed not in the backlog (`.squad/stories/ticket-management/reply-to-a-ticket/attachments/customer-detail-readonly.png`'s own footer: "a new issue means a new ticket for now").
- Editable status/category/priority controls in the same panel as the composer (Stories 11, 9 — 9 already shipped separately in `TicketDetailSidebar.tsx`).
- Quick/canned replies (`agent-workspace` Story 23) — the mockup's "uses a quick reply (Story 23)" hint is not built here; the composer is a plain textarea.
- Pagination of the message thread — `Message`'s existing index (`{ parentType: 1, parentId: 1, createdAt: 1 }`, `Message.ts` line 50) is efficient for a single `find().sort()`; a ticket's thread is not expected to grow into a list-view-scale problem the way `Story 60`'s ticket queue is.
- Fixing Story 8's missing attachment-on-submit gap (see correction above).

---

## Context — Read These Files First

1. `backend/src/models/Message.ts` (53 lines, whole file) — `IMessageAttachment` (lines 6–9), `IMessage` (lines 17–27), the inline `attachments` array definition (lines 40–45), the compound index (line 50). This story extends the attachment shape in place.
2. `backend/src/models/User.ts` — `IAttachment` (lines 8–26) and `attachmentSchema` (lines 85–94) are the exact precedent for the fields `IMessageAttachment` is missing (`storageFileName`, `size`).
3. `backend/src/middleware/upload.ts` (134 lines, whole file) — `UPLOAD_ROOT`/`customerUploadDir` (lines 7–14), `storage` (`multer.diskStorage`, lines 52–64: opaque `crypto.randomUUID()` filename, never derived from client input), `uploadGeneralAttachments` (lines 87–90: unrestricted type, `.array("files", 10)`), `withMulterErrorHandling` (lines 100–122: maps `LIMIT_FILE_SIZE`/`UNSUPPORTED_FILE_TYPE` to `{status, message}` for `errorHandler.ts`), `customerFilePath` (lines 131–133). This story adds a ticket-scoped equivalent of each, not a reuse of the customer one (its `destination` callback reads `req.params.id` as a **customer** id).
4. `backend/src/middleware/errorHandler.ts` (whole file, 12 lines) — confirms the `{status, message}` → `{error: message}` contract `withMulterErrorHandling` targets.
5. `backend/src/services/email.service.ts` (76 lines, whole file) — `SendEmailInput` (lines 28–33, no attachment support today), `sendEmail` (lines 61–75, calls `t.sendMail`, which already accepts a `nodemailer` `attachments: [{filename, path}]` array — this story adds that field straight through). `renderEmailHtml` (lines 42–59) is the shared branded-email shell to reuse for the reply notification.
6. `backend/src/constants/permissions.ts` (86 lines, whole file, current state after Story 9) — `PERMISSION_KEYS` (lines 13–38, `"tickets:change_priority"` is the last `tickets:*` entry at line 32), `DEFAULT_PERMISSIONS_BY_ROLE.agent` (lines 76–83).
7. `backend/src/validation/ticket.schema.ts` (56 lines, whole file, current state after Story 9) — `DESCRIPTION_MAX_LENGTH` (line 5), `requiredString` import (line 2) — this story's reply-text schema follows the exact same shape as `createTicketBodySchema`'s `description` field (lines 30–33).
8. `backend/src/routes/ticket.routes.ts` (299 lines, whole file, current state after Story 9) — `callerHasPermission` is **not** needed here (single-permission action, unlike Story 9's dual-field `PATCH`) — use `requirePermission("tickets:reply")` as route middleware directly, per `[[feedback_every_route_needs_permission]]`. `toTicketDetailResponse`/`TicketDetailFields` (lines 171–192) and the `GET`/`PATCH /:id` handlers (lines 196–296) are the precedent for populate-then-respond shape. New routes go above `export default router;` (line 298).
9. `backend/src/routes/customer.routes.ts` — `POST /:id/notes` (lines 390–419, JSON body + `validateBody`) and `POST /:id/attachments` (lines 457–497, `uploadGeneralAttachments` + manual `req.files` handling, `IAttachment[]` mapping with a `url` built from the new document's own `_id`) are the two precedents this story's single combined endpoint (text + optional files together) merges. `GET /:id/attachments/:attachmentId` (lines 334–359, `requireAuth` + an in-handler ownership/role check, `res.download(customerFilePath(...), attachment.fileName, ...)`, 404-on-error) is the precedent for the new protected download route.
10. `backend/tests/routes/ticket.routes.test.ts` — `seedUser`/`tokenFor` helpers (lines 28–44), `seedTicket` helper (added in Story 9, near the end of the file) — reuse both; add a `seedTicketCategory`-style local helper only if needed (not expected here).
11. `frontend/app/tickets/[id]/page.tsx` (152 lines, whole file, current state after Story 9) — `TicketDetailResponse` interface (lines 17–27), the main `<Card>` block showing subject/description/customer (lines 111–124) — the new thread + composer render **below** the description block, inside the same left-column `<Card>` (or as a sibling `<Card>` directly under it — see Task 6), not inside the right-hand sidebar `<Card>` (that one stays Story 9's Category/Priority/Status panel, lines 126–147).
12. `frontend/app/tickets/[id]/actions.ts` (65 lines, whole file, current state after Story 9) — `TicketDetailActionState` (lines 9–11), `getBearerToken` (lines 13–18, reused as-is), `patchTicket`'s 401-retry shape (lines 20–53) — the new reply action follows the same retry shape but posts `FormData`, not JSON.
13. `frontend/app/customers/[id]/actions.ts` — `doMultipartRequest` (lines 146–190): the exact precedent for forwarding a multipart `FormData` (never setting `Content-Type` manually) with one 401-retry. `uploadAttachments` (lines 236–245) is the thin wrapper shape to mirror.
14. `frontend/lib/customerFileProxy.ts` (49 lines, whole file) — `proxyCustomerFile(backendPath)` (lines 15–48) is **fully generic** despite its name (takes any backend path, reads the session cookie, retries once on 401, streams the response through) — reuse directly for ticket-message-attachment downloads rather than duplicating it. Do not rename it in this story (shared file, out of scope).
15. `frontend/app/api/customers/[id]/attachments/[attachmentId]/route.ts` (11 lines, whole file) — the exact shape of the thin Route Handler wrapper around `proxyCustomerFile` to mirror for the new ticket-attachment proxy route.
16. `frontend/app/customers/[id]/AttachmentsGalleryStep.tsx` — `fileKind`/`IMAGE_EXTENSIONS` (lines 5–12) is a reusable-by-copy pattern for picking an icon per attachment in the thread view (this story does not import this file directly — it is customer-profile-scoped — but matches its icon logic).
17. `frontend/messages/en.json` lines 459–482 and `frontend/messages/ar.json` lines 459–482 — current `TicketDetail` namespace (Story 9). New keys are added inside this same block, both files, same change.
18. `frontend/messages/en.json` lines 402–403 — `unsupportedFileType`/`fileTooLarge` strings (currently under `CustomerProfile`) — this story adds its own copies under `TicketDetail` (namespaces don't share keys across sections in this codebase — see Story 9's plan note on reusing `NewTicket`'s priority strings by duplicating the value, not the namespace).
19. `.squad/stories/ticket-management/reply-to-a-ticket/attachments/agent-detail-thread.png` — the staff thread view: customer's original message bubble (with an attachment chip), an internal-note bubble (dashed amber border, "INTERNAL NOTE · NOT VISIBLE TO CUSTOMER" — **not built in this story**, shown only for layout reference), an agent-reply bubble ("SENT BY EMAIL" label), and the composer (textarea + "Attach file" + "Send reply" button).
20. `.squad/stories/ticket-management/reply-to-a-ticket/attachments/customer-detail-readonly.png` — confirms no customer-facing work is needed in this story.

---

## Backend Tasks

### 1 — Extend `IMessageAttachment` with a storage locator

**File: `backend/src/models/Message.ts`**

Replace lines 6–9 and 40–45:

```ts
export interface IMessageAttachment {
  fileName: string;
  // The PROTECTED route path the frontend links to (e.g.
  // /api/v1/tickets/<ticketId>/messages/<messageId>/attachments/<attachmentId>)
  // — never a raw filesystem path. Same reasoning as User.ts's IAttachment.
  url: string;
  // The opaque on-disk filename multer generated at upload time (see
  // backend/src/middleware/upload.ts's ticket-scoped storage) — internal
  // only, never included in any API response.
  storageFileName: string;
  // Bytes, populated server-side from multer's file.size.
  size: number;
}
```

```ts
    attachments: [
      {
        fileName: { type: String, required: true },
        url: { type: String, required: true },
        storageFileName: { type: String, required: true },
        size: { type: Number, required: true },
      },
    ],
```

No migration needed — no `Message` documents with attachments exist yet (this is the first feature to populate this array).

### 2 — Ticket-scoped upload middleware

**File: `backend/src/middleware/upload.ts`**

Add, after `customerFilePath` (currently ends line 133), mirroring lines 7–14, 52–64, and 87–90 exactly but keyed on a ticket id instead of a customer id:

```ts
const TICKET_UPLOAD_ROOT = path.join(process.cwd(), "uploads", "tickets");

function ticketUploadDir(ticketId: string): string {
  const dir = path.join(TICKET_UPLOAD_ROOT, ticketId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const ticketMessageStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const ticketId = req.params.id;
    if (typeof ticketId !== "string") {
      cb(new Error("Invalid ticket id"), "");
      return;
    }
    cb(null, ticketUploadDir(ticketId));
  },
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

// Reply attachments stay type-unrestricted, same reasoning as
// uploadGeneralAttachments above (only size + count are capped).
const uploadTicketMessageAttachmentsMiddleware = multer({
  storage: ticketMessageStorage,
  limits: { fileSize: MAX_FILE_SIZE },
}).array("files", 10);

export const uploadTicketMessageAttachments = withMulterErrorHandling(uploadTicketMessageAttachmentsMiddleware);

export function ticketFilePath(ticketId: string, storageFileName: string): string {
  return path.join(TICKET_UPLOAD_ROOT, ticketId, storageFileName);
}
```

Note: unlike `customerUploadDir`'s filename callback (which restricts the extension to `ID_DOCUMENT_ACCEPTED_TYPES` for the ID-document slot only), this uses `path.extname(file.originalname)` directly — same as how `uploadGeneralAttachments`'s filename callback already behaves for unrestricted general attachments (`extensionFor` only applies to the ID-document filter path).

### 3 — Add `tickets:reply` permission

**File: `backend/src/constants/permissions.ts`**

Insert after line 32 (`"tickets:change_priority",`):

```ts
  "tickets:reply",
```

Add to `DEFAULT_PERMISSIONS_BY_ROLE.agent` (lines 76–83), alongside the existing keys:

```ts
  agent: [
    "tickets:reassign",
    "reports:view",
    "ai:override_category",
    "tickets:create_for_customer",
    "tickets:categorize",
    "tickets:change_priority",
    "tickets:reply",
  ],
```

Do **not** add to `SUBADMIN_ONLY_PERMISSIONS` — same day-to-day-agent-action reasoning as the two Story 9 keys.

### 4 — Reply body schema

**File: `backend/src/validation/ticket.schema.ts`**

Add after `updateTicketBodySchema` (currently ends line 55):

```ts
export const REPLY_TEXT_MAX_LENGTH = DESCRIPTION_MAX_LENGTH;

// Story 56: the reply-text field of POST /:id/messages. Multer parses the
// multipart body before this runs (see ticket.routes.ts), so this is used
// via an inline `.safeParse(req.body)` there, never `validateBody` —
// validateBody assumes req.body is already the full request payload, but
// multer's own body-parsing populates req.body with only the non-file
// fields as strings, which this schema is shaped to match.
export const replyToTicketBodySchema = z.object({
  text: requiredString("reply text is required").max(
    REPLY_TEXT_MAX_LENGTH,
    `reply text must be at most ${REPLY_TEXT_MAX_LENGTH} characters`
  ),
});
```

### 5 — Extend `email.service.ts` to support attachments

**File: `backend/src/services/email.service.ts`**

Replace `SendEmailInput` (lines 28–33):

```ts
interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Nodemailer reads the file straight off disk via `path` — used by the
  // ticket-reply email (Story 56) so an attached file is actually
  // delivered to the customer, not just stored for in-app viewing.
  attachments?: { filename: string; path: string }[];
}
```

Update `sendEmail` (lines 61–75) to pass `attachments` through:

```ts
export async function sendEmail({ to, subject, text, html, attachments }: SendEmailInput) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dry-run] to=${to} subject="${subject}"\n${text}`);
    return { dryRun: true };
  }

  return t.sendMail({
    from: process.env.SMTP_FROM || "AzmSquad Support <support@example.com>",
    to,
    subject,
    text,
    html,
    attachments,
  });
}
```

### 6 — `GET`/`POST /api/v1/tickets/:id/messages` + protected attachment download

**File: `backend/src/routes/ticket.routes.ts`**

Add these imports (alongside the existing ones, lines 1–12):

```ts
import fs from "fs";
import { Message, IMessage } from "../models/Message";
import { uploadTicketMessageAttachments, ticketFilePath } from "../middleware/upload";
import { replyToTicketBodySchema } from "../validation/ticket.schema";
```

Insert above `export default router;` (currently line 298), after the Story 9 `PATCH /:id` handler (ends line 296):

```ts
interface MessageSenderFields {
  id: string;
  name: string;
}

function toMessageResponse(message: IMessage, sender: MessageSenderFields | null) {
  return {
    id: message._id.toString(),
    text: message.text,
    senderType: message.senderType,
    sender,
    internal: message.internal,
    attachments: message.attachments.map((a) => ({
      id: (a as unknown as { _id: Types.ObjectId })._id.toString(),
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
router.get(
  "/:id/messages",
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

    const messages = await Message.find({ parentType: "ticket", parentId: ticket._id })
      .sort({ createdAt: 1 })
      .populate<{ senderId: { _id: Types.ObjectId; name: string } | null }>("senderId", "name");

    res.status(200).json(
      messages.map((m) =>
        toMessageResponse(
          m,
          m.senderId ? { id: (m.senderId as unknown as { _id: Types.ObjectId; name: string })._id.toString(), name: (m.senderId as unknown as { name: string }).name } : null
        )
      )
    );
  }
);

// Story 56: write a reply, email it to the customer, store it, and flip
// status to "answered" unless the ticket is already closed. uploadTicketMessageAttachments
// runs BEFORE the permission check so multer has parsed req.body/req.files
// first (see the schema's own comment on why validateBody isn't used here) —
// this mirrors customer.routes.ts's POST /:id/attachments ordering.
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
    const messageId = new Types.ObjectId();
    const attachments = files.map((file) => ({
      _id: new Types.ObjectId(),
      fileName: file.originalname,
      storageFileName: file.filename,
      size: file.size,
      // Filled in with the real message id below, once it's known.
      url: "",
    }));

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

    message.attachments.forEach((a, i) => {
      a.url = `/api/v1/tickets/${ticket.id}/messages/${message.id}/attachments/${message.attachments[i]._id}`;
    });
    await message.save();

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
        attachments: files.map((file) => ({ filename: file.originalname, path: ticketFilePath(ticket.id, file.filename) })),
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
// /:id/attachments/:attachmentId (lines 334–359) — never express.static.
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
    const attachment = message.attachments.find((a) => String((a as unknown as { _id: Types.ObjectId })._id) === req.params.attachmentId);
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
```

**Note on the two-step attachment `url` write:** `Message.create()` needs to run first to get a real `_id` for the URL (matches `customer.routes.ts`'s `POST /:id/attachments`, lines 478–489, which builds each entry's `_id` client-side with `new Types.ObjectId()` before the parent `.save()` — this route does the same for `message._id`, but the per-attachment `_id` still needs a second write since the URL embeds the **message's** id, not just the attachment's). This is a real extra `.save()` — acceptable for a low-frequency write path (one reply at a time), not worth optimizing further in this pass.

---

## Frontend Tasks

### 7 — Extend the ticket detail page to fetch the thread

**File: `frontend/app/tickets/[id]/page.tsx`**

Replace the single `fetch` (lines 70–73) with a parallel fetch of both the ticket and its messages:

```ts
  const [ticketRes, messagesRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/tickets/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
    fetch(`${API_URL}/api/v1/tickets/${id}/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }),
  ]);
  const res = ticketRes;
```

Keep the existing 401/403/404/`!res.ok` handling (lines 75–99) unchanged — it already only inspects `res` (now `ticketRes`). After `const ticket: TicketDetailResponse = await res.json();` (line 101), add:

```ts
  const messages: TicketMessage[] = messagesRes.ok ? await messagesRes.json() : [];
  const canReply = isViewerAdmin || viewerPermissions.includes("tickets:reply");
```

(`isViewerAdmin`/`viewerPermissions` already exist at lines 102, 65.) Add the `TicketMessage` interface next to `TicketDetailResponse` (lines 17–27):

```ts
interface TicketMessageAttachment {
  id: string;
  fileName: string;
  size: number;
  url: string;
}

interface TicketMessage {
  id: string;
  text: string;
  senderType: "customer" | "agent" | "ai" | "system";
  sender: { id: string; name: string } | null;
  internal: boolean;
  attachments: TicketMessageAttachment[];
  createdAt: string;
}
```

Inside the left-column `<Card>` (lines 111–124), after the existing `CardContent` block's customer line (line 122, before the closing `</CardContent>`), add the thread + composer:

```tsx
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("thread")}</span>
                <TicketMessageThread messages={messages} ticketId={ticket.id} emptyLabel={t("threadEmpty")} />
                {canReply && <TicketReplyComposer ticketId={ticket.id} />}
              </div>
```

Add imports for `TicketMessageThread` and `TicketReplyComposer` alongside the existing `TicketDetailSidebar` import (line 10).

### 8 — Thread renderer

**Create file: `frontend/app/tickets/[id]/TicketMessageThread.tsx`**

Server Component (no interactivity — matches the read-only bubbles in `agent-detail-thread.png`, minus the internal-note bubble which is out of scope). Each bubble: rounded card, sender initial avatar (reuse the two-letter-initial pattern already used elsewhere — see `frontend/components/UserMenu.tsx` if a shared initial helper exists; otherwise inline `name.slice(0,2).toUpperCase()`), sender name, a "Sent by email" badge (`Badge` from `@/components/ui/badge`, `variant="outline"`) when `senderType === "agent" && !internal`, timestamp (`new Date(createdAt).toLocaleString()`), the message text (`whitespace-pre-wrap`), and attachment chips linking to `/api/tickets/${ticketId}/messages/${message.id}/attachments/${attachment.id}` (the frontend proxy route from Task 10, not the backend `url` field directly — same reasoning as `AttachmentsGalleryStep.tsx`'s comment on why: a plain link can't carry the bearer token).

```tsx
import { useTranslations } from "next-intl";
```

— do **not** import this; this is a Server Component, so use `getTranslations("TicketDetail")` (`next-intl/server`) instead, `await`ed at the top of the function, same as `page.tsx`.

### 9 — Reply composer

**Create file: `frontend/app/tickets/[id]/TicketReplyComposer.tsx`**

Client Component. `useActionState` bound to `sendTicketReply` (Task 11), a controlled `<Textarea>` (per CLAUDE.md's "Forms backed by Server Actions" — controlled, not `defaultValue`, since a failed submission must not silently blank the drafted reply), a file `<input type="file" multiple>` styled as an "Attach file" button (matches the mockup), and a submit button. On successful submit, clear the textarea and file input and reset `useActionState`'s implicit re-render (the existing `revalidatePath` in the action already refreshes the thread). Show `state.error` in an `Alert` (same pattern as `SubmitTicketForm.tsx` lines 253–258).

Form submission builds `FormData` manually (`text` field + each selected `File` appended under the key `"files"`, matching the backend's multer `.array("files", 10)`) rather than relying on native form serialization, since the file input and textarea are both controlled.

### 10 — Server action + attachment download proxy

**File: `frontend/app/tickets/[id]/actions.ts`**

Add a multipart helper mirroring `customers/[id]/actions.ts`'s `doMultipartRequest` (lines 146–190), scoped to the `TicketDetail` namespace:

```ts
export interface SendTicketReplyState {
  error: string | null;
}

export async function sendTicketReply(
  ticketId: string,
  _prevState: SendTicketReplyState,
  formData: FormData
): Promise<SendTicketReplyState> {
  const t = await getTranslations("TicketDetail");
  const token = await getBearerToken();
  if (!token) {
    return { error: t("changeFailed") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets/${ticketId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}` },
      body: formData,
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: t("changeFailed") };
    }
    res = await doFetch(refreshedToken);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    if (res.status === 403) return { error: t("noAccess") };
    if (data?.error === "UNSUPPORTED_FILE_TYPE") return { error: t("unsupportedFileType") };
    if (res.status === 413) return { error: t("fileTooLarge") };
    return { error: t("changeFailed") };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { error: null };
}
```

**Create file: `frontend/app/api/tickets/[id]/messages/[messageId]/attachments/[attachmentId]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { proxyCustomerFile } from "@/lib/customerFileProxy";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string; attachmentId: string }> }
) {
  const { id, messageId, attachmentId } = await params;
  return proxyCustomerFile(`/api/v1/tickets/${id}/messages/${messageId}/attachments/${attachmentId}`);
}
```

(Reusing `proxyCustomerFile` as-is — see Context item 14 on why this is safe despite the name.)

### 11 — i18n

**Files: `frontend/messages/en.json`, `frontend/messages/ar.json`**

Add inside the existing `TicketDetail` block (lines 459–481 in both files, before the closing `}`):

```json
    "thread": "Conversation",
    "threadEmpty": "No replies yet.",
    "sentByEmail": "Sent by email",
    "replyPlaceholder": "Write a reply — it's emailed to the customer on send",
    "replyAttach": "Attach file",
    "replySend": "Send reply",
    "replySendPending": "Sending…",
    "replySent": "Reply sent.",
    "unsupportedFileType": "That file type isn't supported here.",
    "fileTooLarge": "That file is larger than the 3MB limit."
```

Arabic equivalents (add to `ar.json`'s `TicketDetail` block in the same change):

```json
    "thread": "المحادثة",
    "threadEmpty": "لا توجد ردود بعد.",
    "sentByEmail": "تم الإرسال عبر البريد الإلكتروني",
    "replyPlaceholder": "اكتب ردًا — سيتم إرساله للعميل عبر البريد الإلكتروني عند الإرسال",
    "replyAttach": "إرفاق ملف",
    "replySend": "إرسال الرد",
    "replySendPending": "جارٍ الإرسال…",
    "replySent": "تم إرسال الرد.",
    "unsupportedFileType": "نوع هذا الملف غير مدعوم هنا.",
    "fileTooLarge": "حجم هذا الملف أكبر من الحد المسموح به (3 ميجابايت)."
```

Verify key-set parity the same way Story 9 did: `node -e` diff of both `TicketDetail` blocks.

---

## Edge Cases & Failure Modes

- **Reply on an already-`closed` ticket** — message is still created and emailed; `Ticket.status` is left untouched (enforced by the `if (ticket.status !== "closed")` guard in Task 6's `POST` handler), per the acceptance criterion's literal wording ("unless the agent has already closed it").
- **Empty reply text** — `400` from `replyToTicketBodySchema`'s `requiredString`, same message contract as every other validated route.
- **Reply with no attachments** — `files` is `[]`; `attachments: []` on the created `Message`; email sent with no `attachments` entries. Valid, not an error.
- **More than 10 files** — multer's `.array("files", 10)` limit rejects the request; `withMulterErrorHandling` currently only special-cases `LIMIT_FILE_SIZE` and the custom `UNSUPPORTED_FILE_TYPE` message — a `LIMIT_UNEXPECTED_FILE` (multer's code for exceeding the array count) falls through to `next(err)` as a generic 500. Documented here as a known gap inherited from the existing `withMulterErrorHandling` (same gap already exists for `uploadGeneralAttachments`, not introduced by this story) — not fixed in this pass.
- **File exceeds 3MB** — `413`, same `withMulterErrorHandling` mapping already proven by `customer.routes.ts`'s attachments route.
- **Malformed/nonexistent ticket id on `POST`/`GET .../messages`** — `404 { error: "Ticket not found" }`, same `Types.ObjectId.isValid` idiom used everywhere else in this file.
- **Malformed/nonexistent message id or attachment id on the download route** — `404 { error: "Attachment not found" }`.
- **Caller lacks `tickets:reply`** — `403` via `requirePermission`, before multer even runs (`requirePermission` is listed before `uploadTicketMessageAttachments` in the middleware chain) — an unauthorized caller's files are never written to disk.
- **Deactivated agent** — `requirePermission`'s live `isActive` re-check applies, same as every other permission-gated route.
- **SMTP failure sending the reply** — caught, logged, does **not** fail the request or roll back the already-created `Message`/status change — same reasoning as `POST /`'s acknowledgment email (lines 136–142).
- **Customer's email bounces or the customer's account is later deactivated** — out of scope; this story only calls `sendEmail`, it does not verify deliverability.
- **Concurrent replies from two agents on the same ticket** — last `.save()` wins on `Ticket.status`; both messages persist independently in `Message` (no lock needed — each `POST` only touches its own new `Message` document plus a single-field `Ticket.status` write).
- **Bilingual UI** — composer/thread strings are translated (`TicketDetail` namespace); message `text` itself is free-form user input in whatever language the agent/customer typed, rendered as-is in either locale, same as ticket category names already are (Story 9).

---

## Test Plan

1. **`backend/tests/constants/permissions.test.ts`** — extend with a `describe("tickets:reply (Story 56)")` block (mirroring Story 9's `describe` block): key is in `PERMISSION_KEYS`, **not** in `SUBADMIN_ONLY_PERMISSIONS`, **is** in `DEFAULT_PERMISSIONS_BY_ROLE.agent`.
2. **`backend/tests/routes/ticket.routes.test.ts`** — new `describe("GET /api/v1/tickets/:id/messages (Story 56)")`:
   - `401` without a token; `403` for a customer; `404` for malformed/nonexistent ticket id.
   - `200` with an empty array for a ticket with no messages.
   - `200` returns messages sorted oldest-first, with populated `sender.name`.
3. **`describe("POST /api/v1/tickets/:id/messages (Story 56)")`:**
   - `401` without a token; `403` for a caller lacking `tickets:reply`; `404` for malformed/nonexistent ticket id.
   - `400` when `text` is missing/empty.
   - `201` creates a `Message` with `senderType: "agent"`, `internal: false`, and calls `sendEmail` (mock `emailService.sendEmail`, assert `to` is the ticket customer's email) — same mocking pattern as `ticket.routes.test.ts`'s existing `POST /` tests (`vi.spyOn(emailService, "sendEmail")`).
   - `201` still succeeds and the `Message` still persists when `sendEmail` rejects (mock `mockRejectedValue`) — mirrors the existing "still creates the ticket... when the acknowledgment email fails" test.
   - Sending a reply on a ticket with `status: "new"` flips it to `"answered"`.
   - Sending a reply on a ticket with `status: "closed"` (seed one directly via `Ticket.create({..., status: "closed"})`) leaves it `"closed"`.
   - Sending a reply with an attached file (supertest's `.attach("files", Buffer.from("test"), "note.txt")`) creates a `Message` whose `attachments[0].fileName === "note.txt"` and whose `attachments[0].url` matches the `/api/v1/tickets/:id/messages/:messageId/attachments/:attachmentId` shape; the file exists on disk at the path `ticketFilePath` resolves to.
   - Admin can reply with no explicit `tickets:reply` grant (implicit admin pass).
   - Deactivated agent holding `tickets:reply` gets `403`.
4. **`describe("GET /api/v1/tickets/:id/messages/:messageId/attachments/:attachmentId (Story 56)")`:**
   - `404` for a malformed/nonexistent ticket id, message id, or attachment id.
   - `200` streams the correct file for a valid triple (assert `res.body` byte-equal to the uploaded buffer, or assert response headers/status only if byte comparison is impractical in the existing test harness — check how, if at all, `customer.routes.test.ts` asserts downloaded content and match that).
5. **Regression:** existing `POST /api/v1/tickets` tests (Story 8/57) and Story 9's `GET`/`PATCH /:id` tests unaffected by the new imports/routes in `ticket.routes.ts`.
6. No frontend test runner exists yet (per `CLAUDE.md`) — cover the frontend via the manual smoke steps below.

---

## Verification Steps

1. **Backend builds:** `npm run build` in `backend/`.
2. **Backend tests:** `npm test` in `backend/` — all new + existing suites pass.
3. **Frontend builds:** `npm run build` in `frontend/` — no missing-i18n-key warnings.
4. **Locale parity:** diff `TicketDetail` key sets between `en.json`/`ar.json`.
5. **Manual smoke:** as the seeded agent, open a ticket's detail page, send a reply with and without an attachment, confirm the reply appears in the thread immediately (`revalidatePath`), confirm the ticket's status badge flips to "Answered", confirm the attachment link downloads the correct file, and check the backend console for the dry-run email log (or a real inbox if SMTP is configured) showing the reply text and, when attached, the file.
6. **Regression:** `/tickets/[id]`'s Story 9 Category/Priority selects still work; `/tickets/new`, `/admin/ticket-categories`, `/dashboard` still load.

---

## Done Criteria

- [ ] `tickets:reply` added to `PERMISSION_KEYS` and `DEFAULT_PERMISSIONS_BY_ROLE.agent`; not added to `SUBADMIN_ONLY_PERMISSIONS`.
- [ ] `IMessageAttachment` extended with `storageFileName`/`size`, mirroring `User.ts`'s `IAttachment`.
- [ ] Ticket-scoped upload middleware (`uploadTicketMessageAttachments`, `ticketFilePath`) added to `upload.ts`, distinct from the customer-scoped one.
- [ ] `email.service.ts`'s `sendEmail` supports an optional `attachments` array, passed straight to `nodemailer`.
- [ ] `GET /api/v1/tickets/:id/messages` exists (staff-only, oldest-first, populated sender name).
- [ ] `POST /api/v1/tickets/:id/messages` exists — creates a `Message`, emails the customer (with any attached files), and flips `Ticket.status` to `"answered"` unless already `"closed"` — gated by `requirePermission("tickets:reply")`.
- [ ] `GET /api/v1/tickets/:id/messages/:messageId/attachments/:attachmentId` exists as a protected download (never `express.static`).
- [ ] `/tickets/[id]` renders the message thread and, for a viewer holding `tickets:reply`, a working reply composer (text + optional files) that saves immediately and refreshes the thread.
- [ ] Frontend attachment links go through a new `/api/tickets/[id]/messages/[messageId]/attachments/[attachmentId]` proxy route (reusing `proxyCustomerFile`), never the backend `url` directly.
- [ ] i18n keys added to both `en.json` and `ar.json` under the existing `TicketDetail` namespace.
- [ ] All new backend tests pass; existing suite (236 tests as of Story 9) unaffected.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 11 (Update ticket status) or the live-chat feature.**
