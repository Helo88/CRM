# SEED_DEMO_DATA_PROMPT.md — Prompt for a full realistic demo-data seed

> **Status: spec only, not implemented.** This file is a prompt to hand to an
> AI coding agent (or a human) in a *future* session — nobody should run it
> automatically just because it exists. It describes the target end-state
> for a "Seed Demo Data" feature: a script (and, later, an admin-triggered
> endpoint) that wipes this project's database and repopulates it with
> realistic, high-volume demo data so the app can be explored, demoed, or
> used to test AI ticket/chat summarization against genuinely long history.
>
> Read `CLAUDE.md` first — this prompt assumes and must follow every
> convention in it (TypeScript strict mode, services layer, i18n bilingual
> content, permission model, SLA model, etc.). Where this prompt is silent
> on a detail, CLAUDE.md and the existing models/routes win.

## Why this exists

`backend/scripts/seed-admin.ts` and `backend/scripts/seed-demo-customer.ts`
each create exactly one or two accounts — enough for the "Fill demo
credentials" / "Fill admin credentials" buttons on `/login`
(`frontend/app/login/LoginForm.tsx`) to have something real to sign into,
but nowhere near enough data to demo the product convincingly or to
exercise AI summarization (`backend/src/services/summary.service.ts`)
against anything longer than a two-message thread. This prompt is the spec
for the *next* script up: one that produces a fully populated, story-rich
database.

## Goal

A single idempotent-by-intent script (safe to re-run because it always
starts by wiping, not by upserting) that:

1. **Wipes every collection** this app owns (see "Collections to wipe"
   below) — but never touches collections/databases outside this app's
   `MONGODB_URI`.
2. **Recreates baseline reference data**: SLA targets, ticket categories,
   admin accounts.
3. **Creates a realistic cast of accounts**: several agents, several
   customers, at least the two standing admins.
4. **Runs ~10 distinct "successful scenario" ticket lifecycles** — each one
   a coherent story with a believable status/priority/category/assignment
   history, not just random field values.
5. **Runs several long live-chat conversations** — long enough (dozens of
   messages, spanning AI-only, AI-then-escalated, and resolved-by-agent
   conversations) to be a meaningful summarization test case.
6. **Seeds the knowledge base** — FAQs and help articles in *every*
   `KB_CATEGORY_SLUGS` category (`backend/src/constants/kb.ts`), bilingual
   (`en` + `ar`) per the existing `ILocalizedText` shape.
7. Leaves the database in a state where `summary.service.ts`'s ticket and
   chat summarization can be exercised against real, long, multi-turn
   history — not synthetic one-liners.

## Collections to wipe

Every model under `backend/src/models/`: `User`, `Ticket`, `Conversation`,
`Message`, `Faq`, `HelpArticle`, `TicketCategory`, `SlaTarget`,
`SlaTargetHistory`, `SlaSystemSettings`, `Notification`, `RefreshFamily`,
`Counter`. Wipe `Counter` too (or reset the specific sequences it holds) so
`ticketNumber`/`membershipNumber` restart cleanly rather than picking up
from wherever a previous run left off.

Do **not** wipe anything outside these collections, and do not touch a
database other than the one `MONGODB_URI` points at — never assume a
specific database name.

## Accounts to create

- **Admins**: keep `seed-admin.ts`'s two accounts
  (`admin@azmsquad.com` / `Admin@12345`, `admin2@azmsquad.com` /
  `Admin@12345`) so the login page's "Fill admin credentials" button keeps
  working unchanged.
- **Demo customer**: keep `seed-demo-customer.ts`'s account
  (`demo@azmsquad.com` / `Demo@12345`) so "Fill demo credentials" keeps
  working unchanged.
- **~6-10 additional agents**: varied names, `isOnline` mixed true/false,
  varied `permissions` (per `backend/src/constants/permissions.ts`) so the
  security-admin permission model has something realistic to show —
  not every agent should have every permission.
- **~15-25 additional customers**: varied names/emails/`preferredLanguage`
  (mix `en`/`ar`), a few with `internalNotes` and an `idDocument` attached,
  a couple with `isActive: false` (to exercise deactivation displays).
- At least one **subadmin** account, permissioned distinctly from a regular
  agent, so the four-role model (customer/agent/admin/subadmin — see
  `.squad/plans` for the security-admin permission model) has a real
  example.

All passwords bcrypt-hashed via `bcrypt.hash(..., 10)`, same as the
existing seed scripts. Use a consistent, documented password convention
for the generated accounts (e.g. `Name@12345`) so a human exploring the
seeded data can actually log in as any of them, and print the full
email/password list to the console when the script finishes.

## Reference data

- **Ticket categories** (`TicketCategory`): a realistic set (e.g. Billing,
  Technical Issue, Account Access, Feature Request, General Inquiry,
  Shipping/Delivery, Refunds) — all `active: true`, one left `active:
  false` to exercise the "deactivated but still referenced by an old
  ticket" case described in `TicketCategory.ts`'s own comments.
- **SLA targets** (`SlaTarget`) per priority/category combination that
  `sla.service.ts` expects, plus `SlaSystemSettings` — mirror whatever
  `seed-default-sla-target.ts` already establishes rather than inventing a
  new shape.

## The ~10 ticket scenarios

Each scenario is a *coherent story*, not just a randomly-populated
document. For each one, pick a customer, an agent, a category, and walk
the ticket through a believable sequence of real state transitions —
building out `statusHistory`, `categoryHistory`, `priorityHistory`,
`assignedAgentHistory`, and (where relevant) `chatPresenceHistory` and
`slaHistory` with distinct, sequential timestamps (spread over hours/days,
not all `Date.now()`), each entry's `changedBy` a real user, not a random
ObjectId. Attach a real `Message` thread per ticket (several messages,
customer/agent alternating, at least one with an attachment) — this
message thread is what ticket summarization actually reads.

Suggested spread across the 10 (adjust as needed, but keep the variety —
the point is exercising every status/priority/SLA branch, not 10 near-
identical tickets):

1. Straightforward low-priority ticket, opened → answered → closed same day,
   no reassignment, no SLA risk.
2. Urgent ticket that breaches its SLA (`sla.breached: true`, an
   `slaHistory` entry with `event: "breached"`) before an agent responds.
3. Ticket reassigned twice between agents (`assignedAgentHistory` with 3
   entries) before resolution — e.g. wrong-department misroute corrected
   twice.
4. Ticket that changes category and priority mid-life (billing →
   technical, medium → high) as the real problem surfaces.
5. Escalated ticket (`status: "escalated"`, `escalatedTo` set) with a
   `slaHistory` "at_risk" entry before the escalation.
6. Ticket created via `createdVia: "ai"` with `sourceConversation` pointing
   at one of the live-chat conversations below (customer accepted the AI's
   "open a ticket" suggestion).
7. Ticket created via `createdVia: "phone"` (staff-logged on behalf of a
   customer who called in), `createdBy` set to the logging agent.
8. Long-running ticket spanning several days with 8+ back-and-forth
   messages, several status changes (new → in_progress → answered →
   in_progress → answered → closed) — the richest summarization test case.
9. Ticket with an attachment-heavy thread (screenshots/log files on both
   customer and agent messages).
10. Recently reopened ticket: closed, then reopened
    (`in_progress`/`new` after `closed`) with a fresh `statusHistory`
    entry, simulating a customer replying to a "resolved" ticket.

## Long live-chat conversations

Create at least 4-6 `Conversation` + `Message` threads, covering:

- One resolved entirely by the AI (`status: "resolved"`, all messages
  `senderType: "ai"`/`"customer"`, no agent ever assigned) — short-to-medium
  length.
- One escalated to a human (`status: "with_agent"`, `assignedAgent` set,
  `agentJoinedAnnounced: true`) with AI messages early in the thread and
  agent messages taking over later — this is the shape
  `agentJoinedAnnounced` exists to distinguish.
- At least two **long** conversations (30+ messages each) mixing AI and
  agent turns, at least one `aiKbSuggestion` pointing at a real seeded
  `Faq`/`HelpArticle` id, and at least one `aiTicketSuggestion` — this is
  the primary target for testing chat summarization against real volume.
- One that breaches its `sla.responseTargetAt` (`sla.breached: true`).

Timestamps on `Message.createdAt` should be spread realistically (seconds
to minutes apart within a burst, sometimes hours between customer replies)
— not all identical, since summarization and any "conversation duration"
UI reads real elapsed time.

## Knowledge base: FAQs + help articles per category

For **every** slug in `KB_CATEGORY_SLUGS` (`getting-started`,
`account-and-profile`, `tickets-and-support`, `live-chat`,
`billing-and-payments`, `troubleshooting`, `privacy-and-security`):

- At least 3-5 `Faq` documents, each with a real bilingual `question`/
  `answer` pair (not placeholder lorem ipsum — write genuine, plausible
  support-FAQ content for a customer-service platform), `createdBy` set to
  a seeded admin/agent.
- At least 2-3 `HelpArticle` documents per category, each with a unique
  `slug`, bilingual `title`/`summary`/markdown `body` (a few real
  paragraphs with at least one heading and one list, since `body` renders
  through `react-markdown`), `createdBy` set.

This is what makes ai-features Story 34 (AI-suggested KB content) and the
public Help Center demoable with real content instead of an empty state.

## Implementation notes

- New file: `backend/scripts/seed-demo-full.ts`, same pattern as the
  existing scripts (`dotenv/config`, connect via `MONGODB_URI`, disconnect
  at the end, `main().catch(...)` with `process.exit(1)` on failure).
- New `package.json` script: `"seed:demo-full": "tsx scripts/seed-demo-full.ts"`.
- Guard the wipe behind an explicit environment check
  (`NODE_ENV !== "production"`, matching this repo's existing dev-only
  tooling conventions) so it can never accidentally run against a
  production `MONGODB_URI`.
- Keep it deterministic enough to be readable (a fixed cast of named
  customers/agents/scenarios, per "Accounts to create" and "The ~10 ticket
  scenarios" above) rather than fully randomized — the point is a
  convincing demo/test dataset a human can navigate and reason about, not
  fuzz-test volume.
- If/when this becomes the backend for the frontend's "Seed Demo Data"
  button (see `frontend/app/login/LoginForm.tsx`), it should be wrapped by
  an admin-only, permissioned route (per CLAUDE.md's "every route needs a
  permission" convention) that shells out to (or reuses the same logic as)
  this script — a destructive, whole-database action like this must never
  be reachable without auth, even in a dev build.
