# Story 8 — Submit a ticket (comment/problem)

## Prerequisites

- Story 53 completed ([`10-story-get-support-choose-a-ticket-or-live-chat.md`](./10-story-get-support-choose-a-ticket-or-live-chat.md)): `/support` links its "Submit ticket" card to `/tickets/new` (`frontend/app/support/page.tsx:77`). This story is what makes that link resolve instead of 404ing.
- Auth (Stories 1–3) completed: `requireAuth` / `requireRole` in `backend/src/middleware/auth.ts` are the guardrails reused here; `frontend/lib/jwt.ts`'s `peekJwtPayload` and the httpOnly-cookie session pattern (`SESSION_COOKIE`/`REFRESH_COOKIE` in `frontend/lib/auth.ts`) are reused for the page's auth gate.
- Coordinate with whoever picks up **Story 57** ("Create a ticket on behalf of a customer") before restructuring anything here later — it extends this exact form/handler with staff-only fields (customer picker, priority, notify-customer toggle), it does not duplicate it. Nothing in this story needs to pre-build for that; just don't couple the implementation so tightly to "the caller is always the ticket's own customer" that Story 57 can't parameterize it.

---

## Story Goal

Let a signed-in customer submit a written ticket (subject + description) from a real form, and get back both an in-app confirmation with a reference number and an acknowledgment email.

Concrete outcomes:

1. A signed-in customer visiting `/tickets/new` sees a form with a **subject** field and a **description** field (attachments are **not** built in this pass — see "Attachments" under Product rules below for why).
2. Submitting a valid form creates a `Ticket` document with `status: "new"`, `customer` set to the caller, and Mongoose's existing schema defaults (`category: null`, `priority: "medium"`) — nothing else is set.
3. On success, the page shows an in-app confirmation containing a reference number (the created ticket's Mongo `_id`) instead of redirecting away — there is no ticket-detail page yet (that's Story 13), so there is nowhere else useful to send the customer.
4. The customer also receives an acknowledgment email containing the same reference number. A failure to send that email does **not** fail the request — the ticket is already the source of truth once created; the customer still sees their in-app confirmation. This generalizes CLAUDE.md's "never let a customer-facing flow hang on an external call" rule (written there for Gemini) to this email send.
5. All copy is served through `next-intl` in both **en** and **ar**.
6. The page exports real `Metadata` (title, `noindex` — internal/authenticated page, not a public marketing page).

**Not in scope** (per the intake and `USER_STORIES.md` sequencing):
- Category/priority assignment (Story 9).
- Auto-assignment to an agent (Story 10).
- Any status transition beyond the initial `"new"` (Story 11).
- Staff-mode creation on a customer's behalf (Story 57).
- File attachments on a ticket (see Product rules below).

---

## Context — Read These Files First

1. `backend/src/models/Ticket.ts` — the whole file (56 lines). Confirm `ITicket`'s fields (`subject`, `description`, `customer`, `assignedAgent`, `category`, `priority`, `status`) and their schema defaults (`priority: "medium"` at line 38, `status: "new"` at lines 39–43, `category: null` at line 37). No schema changes are needed for this story — every field the acceptance criteria needs already exists and already defaults correctly.
2. `backend/src/routes/ticket.routes.ts` — the whole file (21 lines). `POST /` (lines 9–11) is a `501` stub already wrapped in `requireAuth, requireRole("customer")` — implement inside that exact handler, do not change the route path or its auth wrapper. Leave the `GET /` stub (lines 16–18, Story 13) untouched.
3. `backend/src/routes/customer.routes.ts` — read the `POST /` handler at **lines 198–247** as the precedent for this story's validation/response style: destructure the body, inline `if (!field) res.status(400)...` checks (no `zod` on the backend anywhere in this repo — grep confirms zero matches — so don't introduce it here either), then `Model.create(...)`, then `res.status(201).json(...)`.
4. `backend/src/middleware/auth.ts` — `requireAuth` (lines 46–62) attaches `req.user = { id, role, name }` only (**no `email`** — confirmed against `backend/src/types/express.d.ts`). The handler must `User.findById(req.user!.id)` to get the customer's current `name`/`email` for the acknowledgment email; don't trust a stale JWT claim for it.
5. `backend/src/services/email.service.ts` — the whole file (76 lines). Use `sendEmail` (lines 61–75) and `renderEmailHtml` (lines 42–59) exactly as `backend/src/routes/me.routes.ts:102–113` calls them (read that call site too) — same two-arg shape (`text` + `html: renderEmailHtml({...})`), same `heading`/`bodyHtml`/`ctaText`/`ctaUrl` fields. `sendEmail` never throws in dev (`SMTP_HOST` unset → dry-run log, see `email.service.ts:13-16`); wrap the call in try/catch and swallow (log, don't fail the request) so this story doesn't accidentally re-copy `me.routes.ts`'s "roll back and 502" pattern, which is wrong here per Story Goal point 4.
6. `backend/src/app.ts` — confirm `POST /api/v1/tickets` is already mounted (line 23: `app.use("/api/v1/tickets", ticketRoutes)`). No change needed.
7. `backend/tests/routes/customer.routes.test.ts` — read the whole file for the exact test-harness pattern: `createApp()` (line 10), `MongoMemoryServer` setup in `beforeAll`/`afterAll` (lines 13–21), the `tokenFor`/`seedUser` helpers (lines 27–42). Copy this scaffolding into the new ticket test file rather than inventing a different one.
8. `backend/tests/routes/me.routes.test.ts` — grep for `vi.spyOn(emailService, "sendEmail")` (lines 74, 88, 117, 133) for the exact pattern to mock/assert the email send from a test, including `import * as emailService from "../../src/services/email.service"` (line 7).
9. `frontend/app/customers/new/page.tsx` — the whole file (46 lines). This is the closest existing precedent for `/tickets/new`: a page that renders **only a form** with no backend `GET` on load, so it gates access by decoding the JWT locally (`peekJwtPayload`, lines 6, 36) rather than `settings/page.tsx`'s fetch-then-check-401 pattern. Reuse this exact shape: cookie presence check + silent-refresh redirect (lines 29–34, matches `frontend/app/settings/page.tsx`'s convention), then `peekJwtPayload(accessToken).role`. Here the check is inverted — redirect away if the role is **not** `"customer"` (staff have their own future entry point via Story 57), landing on `/dashboard` (matching `10-story-get-support-choose-a-ticket-or-live-chat.md`'s convention of sending misplaced staff there), not `/customers` (that page's redirect target is only relevant to that page).
10. `frontend/app/customers/new/actions.ts` — the whole file (84 lines). Precedent for the Server Action shape: `zod` schema (line 11–16) + `safeParse` + `fieldErrors` (lines 28–46), cookie read + `refreshSession()` fallback (lines 48–55), a `doFetch`/401-retry-once closure (lines 60–74, matches `frontend/app/settings/actions.ts:20-46`'s reasoning for why a Server Action retries inline instead of redirecting). **Difference for this story:** `createCustomer` ends with `redirect("/customers")` on success (line 83) — this story's action must **not** redirect; it returns a success state carrying the reference number so the page can render the confirmation in place (see Story Goal point 3).
11. `frontend/app/customers/new/NewCustomerForm.tsx` — the whole file (115 lines). Precedent for the Client Component shape: `useActionState` (line 19), controlled inputs via `useState` (lines 21–24, and see `LoginForm.tsx`'s comment on why — CLAUDE.md's "Forms backed by Server Actions"), the `Card`/`CardHeader`/`CardContent`/`CardFooter` composition (`@/components/ui/card`), `Alert`/`AlertDescription` for the top-level error (`@/components/ui/alert`).
12. `frontend/components/ui/textarea.tsx` — confirmed already installed; use it for the description field (multi-line, unlike every existing form's single-line `Input`s).
13. `frontend/lib/auth.ts` — exports `SESSION_COOKIE`, `REFRESH_COOKIE`, `API_URL` used by the page/action.
14. `frontend/lib/jwt.ts` — `peekJwtPayload` (lines 5–12+) returns `{ id?, role?, name?, email?, permissions?, membershipNumber? }` decoded client-unverified from the access token; used the same way `customers/new/page.tsx:36` does.
15. `frontend/messages/en.json` — find the `Support` section (line 347) and the `NewCustomer` section (line 138) as the two closest sibling namespaces (destination page and nearest form-page precedent, respectively). Add a new top-level **`NewTicket`** section with the same shape as `NewCustomer`'s (heading/subheading/field labels/submit/error keys) plus confirmation-specific keys (see Frontend Task 3). Update `frontend/messages/ar.json` with the identical key set in the same change — CLAUDE.md requires this, and the project's own convention note says these two files must never drift.
16. `backend/.env.example` — confirm `CLIENT_ORIGIN` (already used by `app.ts`'s `cors()` call) is the right env var for building the acknowledgment email's CTA link back into the app (there is no ticket-detail page yet — Story 13 — so the CTA link's only safe, real destination today is `/support`, the page this story's form is reached from).

---

## Product rules (from story)

- **Current behavior:** `POST /api/v1/tickets` returns `501`. No ticket can be created by any customer today.
- **New behavior:** A customer-authenticated `POST /api/v1/tickets` with a non-empty `subject` and `description` creates a `Ticket` with `status: "new"`, `customer` set to the caller, `category: null`, `priority: "medium"`, `assignedAgent: null` (all via existing schema defaults — the handler does not set these explicitly). Response is `201` with the created ticket's `id` (used as the reference number), `subject`, `status`, `createdAt`.
- **Reference number:** the ticket's own MongoDB `_id` string, used as-is. There is no separate ticket-numbering scheme anywhere in the schema (confirmed — `Ticket.ts` has no sequence/counter field, unlike `User.ts`'s `membershipNumber` which uses `Counter.ts`'s `nextSequence()`). Inventing a shorter derived reference here would be a new, unbacked numbering scheme — explicitly flagged in the intake as something not to do without noting the decision, so this story doesn't do it.
- **Attachments:** the acceptance criteria says attachments are optional to *fill in*, not that file upload must be built. `Ticket.ts` has no attachments field today (checked — unlike `User.ts`'s `attachments: IAttachment[]` / `idDocument` pattern built for customer-management Story 7). Adding real file-upload support here (schema field, `multer` wiring, an authenticated download route, frontend upload UI) is a materially separate scope from "capture a subject and description," so this story ships **without** an attachments field or control, and this is the explicit, noted design decision the intake asked for. A future story can add a `Ticket.attachments` array following the exact `User.ts` `IAttachment`/`attachmentSchema` precedent if this becomes a real requirement later.
- **Auto-assignment / categorization:** explicitly out of scope (Stories 9 and 10) — the handler must not set `assignedAgent` or `category` itself.

---

## Backend Tasks

### 1 — Implement `POST /` in `ticket.routes.ts`

File: `backend/src/routes/ticket.routes.ts`

Replace the `501` stub (current lines 6–11) with a real handler on the same route/middleware signature:

```ts
import express, { Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { Ticket } from "../models/Ticket";
import { User } from "../models/User";
import { sendEmail, renderEmailHtml } from "../services/email.service";

const router = express.Router();

const SUBJECT_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

interface CreateTicketBody {
  subject?: string;
  description?: string;
}

router.post(
  "/",
  requireAuth,
  requireRole("customer"),
  async (req: Request<unknown, unknown, CreateTicketBody>, res: Response) => {
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

    const customer = await User.findById(req.user!.id);
    if (!customer) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const ticket = await Ticket.create({
      subject,
      description,
      customer: customer._id,
    });

    const referenceNumber = ticket._id.toString();

    try {
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
    } catch (err) {
      // Acknowledgment email is a nicety, not the source of truth — the
      // ticket already exists. Never fail the customer's submission over an
      // SMTP hiccup (CLAUDE.md: never let a customer-facing flow hang on an
      // external call — same reasoning as the Gemini-call rule, generalized
      // to email).
      console.error("[tickets] acknowledgment email failed", err);
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
```

**Do not** touch the `GET /` stub or the router mount in `app.ts` — both are already correct.

---

## Frontend Tasks

### 1 — Page: `frontend/app/tickets/new/page.tsx` (new file)

Follow `frontend/app/customers/new/page.tsx`'s exact shape:

```tsx
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { SubmitTicketForm } from "./SubmitTicketForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NewTicket");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/tickets/new");
    }
    redirect("/");
  }

  const { role } = peekJwtPayload(accessToken);
  if (role !== "customer") {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <SubmitTicketForm />
    </main>
  );
}
```

### 2 — Server Action: `frontend/app/tickets/new/actions.ts` (new file)

Follow `frontend/app/customers/new/actions.ts`'s shape, but return a success state (reference number) instead of redirecting:

```ts
"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

const submitTicketSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
});

export interface SubmitTicketActionState {
  error: string | null;
  fieldErrors?: { subject?: string; description?: string };
  referenceNumber?: string;
}

export async function submitTicket(
  _prevState: SubmitTicketActionState,
  formData: FormData
): Promise<SubmitTicketActionState> {
  const t = await getTranslations("NewTicket");
  const parsed = submitTicketSchema.safeParse({
    subject: formData.get("subject"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        subject: fieldErrors.subject ? t("subjectRequired") : undefined,
        description: fieldErrors.description ? t("descriptionRequired") : undefined,
      },
    };
  }

  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: t("notSignedIn") };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(parsed.data),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  const data = await res.json();

  if (!res.ok) {
    return { error: data.error ?? t("genericError") };
  }

  return { error: null, referenceNumber: data.id };
}
```

### 3 — Form: `frontend/app/tickets/new/SubmitTicketForm.tsx` (new file)

Follow `NewCustomerForm.tsx`'s composition (`Card`/`CardHeader`/`CardContent`/`CardFooter`, controlled `Input`, `Alert` for the top-level error), with two differences:
- A `Textarea` (`@/components/ui/textarea`) for `description` instead of a second `Input`.
- When `state.referenceNumber` is set, render a confirmation panel (heading + reference number + a `Link` back to `/support`) **in place of** the form — do not redirect (there is no ticket-detail page to redirect to yet).

```tsx
"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { submitTicket, type SubmitTicketActionState } from "./actions";

const INITIAL_STATE: SubmitTicketActionState = { error: null };

export function SubmitTicketForm() {
  const t = useTranslations("NewTicket");
  const [state, formAction, pending] = useActionState(submitTicket, INITIAL_STATE);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  if (state.referenceNumber) {
    return (
      <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
        <CardHeader className="items-center gap-2 pt-6 text-center">
          <CircleCheck className="size-10 text-success" />
          <CardTitle className="text-2xl font-bold tracking-tight">{t("confirmedHeading")}</CardTitle>
          <CardDescription className="text-balance">{t("confirmedBody")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-1 pb-6 text-center">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("referenceLabel")}</span>
          <span className="font-mono text-sm">{state.referenceNumber}</span>
        </CardContent>
        <CardFooter className="justify-center border-t-0 bg-transparent pt-1">
          <Link href="/support" className="text-sm text-primary underline-offset-4 hover:underline">
            {t("backToSupport")}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md rounded-[28px] rounded-ss-none border-none shadow-pop ring-1 ring-foreground/10">
      <CardHeader className="items-center gap-1 pt-6 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">{t("heading")}</CardTitle>
        <CardDescription className="text-balance">{t("subheading")}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">{t("subject")}</Label>
            <Input
              id="subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.subject)}
              maxLength={200}
              required
            />
            {state.fieldErrors?.subject && <p className="text-sm text-destructive">{state.fieldErrors.subject}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{t("description")}</Label>
            <Textarea
              id="description"
              name="description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={Boolean(state.fieldErrors?.description)}
              maxLength={4000}
              required
            />
            {state.fieldErrors?.description && (
              <p className="text-sm text-destructive">{state.fieldErrors.description}</p>
            )}
          </div>
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="border-t-0 bg-transparent pt-1">
          <Button type="submit" disabled={pending} className="w-full transition-transform active:scale-[0.98]">
            {pending ? t("submitPending") : t("submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
```

### 4 — i18n: `frontend/messages/en.json` and `frontend/messages/ar.json`

Add a new top-level `NewTicket` section (English shown; add the matching Arabic in the same change):

```json
"NewTicket": {
  "heading": "Submit a ticket",
  "subheading": "Describe your issue and we'll follow up by email.",
  "subject": "Subject",
  "description": "Description",
  "submit": "Submit ticket",
  "submitPending": "Submitting…",
  "subjectRequired": "Subject is required",
  "descriptionRequired": "Description is required",
  "notSignedIn": "You need to be signed in to submit a ticket.",
  "genericError": "Something went wrong. Please try again.",
  "confirmedHeading": "Ticket submitted",
  "confirmedBody": "We'll email you when an agent replies.",
  "referenceLabel": "Reference number",
  "backToSupport": "Back to support"
}
```

No changes needed to the existing `Support` section — `frontend/app/support/page.tsx:77` already points at `/tickets/new`.

---

## Edge Cases & Failure Modes

- **Empty/whitespace-only subject or description** → both frontend (`zod` `.min(1)` after `.trim()` in `actions.ts`) and backend (`ticket.routes.ts`'s trimmed-empty check) reject it — the backend check exists independently because this endpoint can be called directly, not just through this form.
- **Subject/description over the length cap** → `400` from the backend (`SUBJECT_MAX_LENGTH`/`DESCRIPTION_MAX_LENGTH`); the frontend's `zod` schema and `maxLength` attributes catch it earlier, but the backend is the real enforcement point per CLAUDE.md's "Validate with zod inside the Server Action" note — that note covers the frontend leg only; the backend has no `zod` anywhere (confirmed) and uses the same inline-check style as `customer.routes.ts`.
- **No access-token cookie (routine ~15 min into a session)** → same silent-refresh-then-home redirect as `customers/new/page.tsx` / `support/page.tsx`, guarded by the one-shot `_refreshed` param.
- **Signed in as agent/admin/subadmin** → redirected to `/dashboard` before the form renders (`page.tsx`'s `peekJwtPayload` check). The backend's `requireRole("customer")` is the real enforcement if someone `POST`s directly.
- **Access token stale by the time of submission (routine, session lasts longer than 15 min)** → the Server Action's 401-retry-once (`actions.ts`, matching `customers/new/actions.ts:67-74`) refreshes and retries transparently; if the refresh token is also dead, `t("notSignedIn")` is shown inline rather than losing the user's typed content (this is exactly the scenario CLAUDE.md's "Forms backed by Server Actions" section warns about — controlled inputs mean a failed submission doesn't blank the fields).
- **SMTP down / `sendEmail` throws** → caught and logged server-side (`ticket.routes.ts`'s try/catch); the ticket is still created and the customer still gets their in-app confirmation and reference number. Covered by Test Plan item 5.
- **`SMTP_HOST` unset (local dev)** → `sendEmail` dry-runs (logs, doesn't throw) per `email.service.ts:13-16` — the acknowledgment "send" always appears to succeed in local dev; this is existing, expected behavior, not something this story changes.
- **Customer record deleted/missing between JWT issue and this request** (edge case, e.g. account deletion elsewhere) → `User.findById` returns `null`; handler responds `401` rather than crashing on `customer.email`.
- **RTL layout (Arabic)** → the form and confirmation panel must render correctly under `dir="rtl"`; use the same logical-property patterns (`ps-*`/`start-*`) already used by `NewCustomerForm.tsx`.
- **Missing translation key** → `next-intl` throws in dev; add `en.json` and `ar.json` in the same commit (see Context item 15).

---

## Test Plan

1. **New file `backend/tests/routes/ticket.routes.test.ts`** — copy the harness from `customer.routes.test.ts` (`createApp()`, `MongoMemoryServer`, `tokenFor`/`seedUser` helpers). Add:
   - `POST /api/v1/tickets` returns `401` without a token.
   - `POST /api/v1/tickets` returns `403` for a caller seeded with `role: "agent"` (or `"admin"`) — confirms `requireRole("customer")` is unchanged.
   - `POST /api/v1/tickets` returns `400` when `subject` is missing/blank, and separately when `description` is missing/blank.
   - `POST /api/v1/tickets` with a valid body, seeded as a `customer`, returns `201` with `id`/`subject`/`status: "new"`/`createdAt`, and a follow-up `Ticket.findById` confirms `customer` matches the seeded user's id, `assignedAgent: null`, `category: null`, `priority: "medium"`.
   - `vi.spyOn(emailService, "sendEmail")` (pattern from `me.routes.test.ts:74`) asserts it's called once with `to` equal to the seeded customer's email.
   - `vi.spyOn(emailService, "sendEmail").mockRejectedValue(new Error("SMTP down"))` (pattern from `me.routes.test.ts:118`) then asserts the endpoint **still** returns `201` (this is the behavior this story deliberately inverts from `me.routes.ts`'s roll-back-and-502 pattern — see Context item 5).
2. **Manual smoke — happy path:** Sign in as the seeded demo customer (`backend/scripts/seed-demo-customer.ts`), visit `/support`, click "Submit ticket", fill in subject/description, submit. Verify the confirmation panel shows a reference number and the ticket exists in MongoDB with `status: "new"`.
3. **Manual smoke — validation:** Submit with an empty subject or description; verify inline field errors appear without blanking the other field (controlled-input regression check).
4. **Manual smoke — auth guard:** Sign in as the seeded admin (`backend/scripts/seed-admin.ts`), navigate directly to `/tickets/new` → redirected to `/dashboard`.
5. **Manual smoke — locale:** Toggle to Arabic, reload `/tickets/new`, verify all strings (including the confirmation panel) switch and RTL renders correctly.
6. **Regression:** `/support`'s "Submit ticket" link now resolves instead of 404ing; existing routes (`/dashboard`, `/customers`, `/settings`) still render.

---

## Verification Steps

1. **Backend builds and typechecks:** From `backend/`, run `npm run typecheck` and `npm run build`.
2. **Backend tests pass:** From `backend/`, run `npm test` — the new `ticket.routes.test.ts` file plus the full existing suite (169 tests as of the last recorded run in `10-story-get-support-choose-a-ticket-or-live-chat.md`) must pass.
3. **Frontend builds:** From `frontend/`, run `npm run build`. Must complete with no TypeScript errors and no `next-intl` "missing key" warnings.
4. **Locale parity check:** Diff the top-level key sets of `frontend/messages/en.json` and `frontend/messages/ar.json` — identical, both containing the new `NewTicket` object with the same shape.
5. **Frontend runs:** From `frontend/`, run `npm run dev`; walk through Test Plan items 2–5 above against `http://localhost:3000`.
6. **Regression:** Manually visit `/dashboard`, `/customers`, `/settings`, `/support`, `/login` and confirm they still render as before.

---

## Done Criteria

- [x] `POST /api/v1/tickets` creates a `Ticket` with `status: "new"`, `customer` set to the caller, and schema-default `category`/`priority`/`assignedAgent` — no auto-assignment or categorization logic added. Verified live: created ticket's Mongo document has `category: null`, `priority: "medium"`, `assignedAgent: null`, `customer` matching the caller's id.
- [x] The endpoint sends an acknowledgment email (via `email.service.ts`'s `sendEmail`/`renderEmailHtml`) containing the reference number; a failed send does not fail the request. Verified live (real SMTP configured in `backend/.env`, no error logged) and by test (`ticket.routes.test.ts`'s SMTP-failure case still returns 201).
- [x] `frontend/app/tickets/new/page.tsx` exists as a Server Component, gated the same way `frontend/app/customers/new/page.tsx` is (silent-refresh redirect, then `peekJwtPayload` role check), redirecting any non-`"customer"` role to `/dashboard`. Verified live: unauthenticated request to `/tickets/new` redirects (307) to `/`.
- [x] The page renders a form with `subject` and `description` fields only (no attachments control — explicit, noted design decision, see Product rules).
- [x] Submitting successfully shows an in-app confirmation with the reference number, in place of the form, without redirecting.
- [x] Every user-facing string is served through `next-intl` under a new `NewTicket` namespace present in both `frontend/messages/en.json` and `frontend/messages/ar.json`. Key-set parity checked programmatically (`node -e` diff of both files' `NewTicket` keys).
- [x] The page exports real `Metadata` (`title` from translations, `robots: { index: false, follow: false }`).
- [x] New backend tests in `backend/tests/routes/ticket.routes.test.ts` cover auth, validation, successful creation, and the email-failure-doesn't-fail-the-request case. Also updated `rbac.integration.test.ts`'s matrix row (`customer` now expects `400`, not the old `501` stub response) now that the route has real validation behind `requireRole`.
- [x] `npm run build`/`npm test` pass in `backend/` (175 tests, up from 169); `npm run build` passes in `frontend/` (`/tickets/new` listed as a real route) — no regressions.

**Not visually verified:** no headless-browser tool was available in this session, so the actual form UI (typing into fields, clicking submit, the confirmation panel's appearance, RTL rendering) was not clicked through in a real browser — only verified via direct API calls (`curl`) against the running dev servers and a MongoDB read of the resulting document. Recommend a manual pass through Test Plan items 2–5 before considering this fully done.

**STOP HERE. Report to the user and wait for confirmation before proceeding to the next story.**
