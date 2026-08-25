# CLAUDE.md — Project Context for AI-Assisted Development

This file is read automatically by Claude Code (and should be treated as authoritative context by any AI agent working in this repo, including squad-kit's planner). It's the "ground rules" file: what this project is, what stack it's built on, and the conventions every story's implementation should follow. `USER_STORIES.md` is the "what to build" backlog; this file is the "how things are built here" reference. Read both before planning or implementing any story.

## What this project is

A standalone customer service web platform (not attached to any product/e-commerce catalog — think of the support/live-chat experience inside an app like Talabat, built on its own). Customers sign up, log in, and either start a live chat or submit a ticket (a written comment/problem). Live chat is answered first by an AI agent and escalates to a human agent when needed; tickets are answered by a human agent and delivered by email. Admins manage agents, configuration, and have full visibility across the system.

**Personas:** Customer · Human Agent · Admin · AI Agent (a system actor powered by Google Gemini — not a login-able account)

## Tech stack (decided — follow this, don't introduce alternatives without discussion)

- **Backend:** Node.js + Express, in `backend/`, written in **TypeScript** (compiled via `tsc`, run in dev via `tsx watch`). Prefer explicit interfaces for models, request bodies, and service inputs/outputs over `any`. Mongoose documents are typed via `Document`-extending interfaces (see `src/models/`).
- **Database:** MongoDB via Mongoose. Chosen over SQLite because the core of this app is high-frequency real-time chat writes and flexible conversation/ticket documents, which fit MongoDB's document model better than a single-writer relational file.
- **Real-time:** Socket.io, mounted on the same Express HTTP server, for live chat.
- **Auth:** JWT-based sessions, passwords hashed with bcrypt. Roles: `customer`, `agent`, `admin`. The AI agent is not a user account — it's invoked server-side as a service.
- **AI integration:** Google Gemini API, free tier, via the `@google/generative-ai` SDK. The Gemini API key lives only in backend environment variables — never sent to or called from the frontend. Used for: the customer-facing chat bot (first responder in live chat), ticket/chat summaries, suggested replies for agents, automatic categorization, and suggested knowledge-base solutions. Wrap every Gemini call with a timeout and a graceful fallback message — never let a customer-facing flow hang on an external API call.
- **Email:** Nodemailer, SMTP credentials from environment variables, used for ticket acknowledgments and agent replies delivered by email.
- **Frontend:** Next.js (App Router) + React, written in **TypeScript** (`.tsx`/`.ts`), in `frontend/`, as a separate app/service from the backend — not a Next.js monolith. It talks to the backend over REST for normal requests and a Socket.io client connection for live chat.
- **i18n:** The customer-facing UI (and ideally agent/admin UI) must support Arabic and English, including right-to-left layout for Arabic. Don't hardcode English-only strings in components — route all user-facing text through the i18n layer from the start.

## Dependency freshness policy

- Never pick a package version from training knowledge — it's likely stale. Before adding or upgrading any dependency, check the real npm registry: `npm view <package> version` for the latest, and for anything load-bearing (`next`, `react`, `react-dom`, `mongoose`, `express`, `socket.io`, `typescript`, `tailwindcss`, or anything else central to the stack) also run `npm view <package> dist-tags --json` to confirm you're reading the `latest` tag rather than accidentally picking up `next`/`canary`/`rc`/`beta`.
- Before bumping a load-bearing package, check `npm view <package>@<version> peerDependencies engines --json` and cross-reference against the other side of the stack (backend vs. frontend) and the Node version actually installed (`node --version`). Pick versions that are mutually compatible, not just individually "latest".
- If the newest major of a package requires a higher Node version than what's installed, pin to the newest version compatible with the installed Node instead of forcing the upgrade — document the tradeoff (see "Current pinned exceptions" below) rather than silently downgrading or leaving it unexplained.
- After any dependency bump, run `npm run typecheck` and `npm run build` in `backend/`, and `npm run build` in `frontend/` (both, if the change touches a shared dep like `typescript` or `@types/node`) before considering the upgrade done. Fix any breakage as part of the same change — never leave a half-upgraded lockfile.

### Current pinned exceptions

- **mongoose is pinned to the 8.x line (`^8.24.4`), not the 9.x latest.** mongoose 9.x requires Node `>=20.19.0`; the environment's installed Node is `20.15.0`. mongoose 8.24.4 requires only Node `>=16.20.1` and is otherwise the newest available on that line. Revisit once the installed Node is upgraded to `>=20.19.0`.

## Design system

The frontend uses **shadcn/ui** (Radix primitives + Tailwind v4) — don't introduce another component library or hand-roll primitives that already exist here. Base config lives in `frontend/components.json`; installed primitives are in `frontend/components/ui/`.

- **Add a new primitive** with `npx shadcn@latest add <component>` from `frontend/` — don't hand-write a component shadcn already ships (button, card, badge, avatar, input, textarea, switch, tabs, separator, select, dropdown-menu, table, scroll-area, label are already installed).
- **Theme tokens** live as CSS custom properties in `frontend/app/globals.css` (`:root` / `.dark`), mapped into Tailwind utilities via the `@theme inline` block. Use the token utilities (`bg-primary`, `text-muted-foreground`, `bg-success`, ...) — never hardcode a hex color in a component.
- **Palette:** primary is a muted violet/indigo (`--primary: #5B4FD6`), neutrals are slate-toned, and there are dedicated semantic status tokens beyond shadcn's defaults — `--success`/`--success-foreground` (green, "on track" / resolved), `--warning`/`--warning-foreground` (amber, SLA at-risk), `--destructive`/`--destructive-foreground` (red, SLA breached). Use these three for any SLA/ticket-status indicator so status color stays consistent across the whole app — don't invent new status colors per feature.
- **Font:** Plus Jakarta Sans (`next/font/google`, wired in `frontend/app/layout.tsx` as `--font-sans`) — not Inter/Roboto/Geist. One font family, no separate display face needed for this dashboard-style UI.
- **RTL:** `frontend/components.json` has `"rtl": true`, and `RootLayout` wraps the app in Radix's `Direction.Provider` (from the unified `radix-ui` package) so direction-aware components (select, dropdown-menu, etc.) open correctly once the real `dir` value is wired up in Story 49. The `dir`/`lang` values in `app/layout.tsx` are still hardcoded to `"ltr"`/`"en"` pending that story — don't remove the `Direction.Provider` wiring, just replace the hardcoded value with the real locale when Story 49 is implemented.
- Two style directions (this shadcn one vs. an Ant Design-style alternative) were mocked up and compared before deciding — shadcn/ui was the chosen direction. Don't reintroduce the Ant Design-style density/table-heavy pattern without discussion.

## Repo layout

```
backend/
  src/
    config/      # DB connection, env loading
    models/      # Mongoose schemas (User, Ticket, Conversation, Message, ...)
    middleware/  # auth (JWT verify + role check), error handling
    routes/      # Express route definitions
    services/    # gemini.service.js, email.service.js — external integrations live here, never called directly from routes/controllers
    sockets/     # Socket.io event handlers for live chat
    app.js       # Express app setup (middleware, routes)
    server.js    # entry point: starts HTTP server + Socket.io
frontend/
  app/           # Next.js App Router pages/layouts
  public/
USER_STORIES.md  # the backlog — source of truth for what to build, organized by squad-kit feature
```

## Conventions

- REST endpoints are versioned under `/api/v1/...` and grouped by resource (`/tickets`, `/conversations`, `/customers`, `/auth`, `/admin/...`).
- Every route that isn't public passes through the `auth` middleware, which verifies the JWT and checks role before the handler runs. Don't re-implement role checks ad hoc inside handlers.
- External integrations (Gemini, email/SMTP) are only ever called from `src/services/`, never directly from a route or socket handler — this keeps them mockable/testable and keeps API keys out of business logic.
- Environment variables are the only place secrets/config live (`.env`, never committed — see `.env.example` for the required keys). This includes `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, and SMTP credentials.
- Use async/await throughout; avoid mixing callback-style Mongoose/Node APIs with promises.
- Both `tsconfig.json`s have `strict` mode on. Don't disable it or sprinkle `any` to make errors go away — extend the relevant interface instead (e.g. `src/types/express.d.ts` for `req.user`, or a model's `I...` interface).

## Scope notes (read before assuming something is out of scope)

The full requirements are in `USER_STORIES.md`, grouped into 13 squad-kit features covering nearly the entire original requirements brief. Three things are intentionally deferred but designed to be added later without a rebuild — don't accidentally foreclose them:

- **Channels:** only email and live chat are implemented. Don't build WhatsApp/SMS/web-form *external* channel connectors.
- **Integrations:** only this platform's own REST API is built now. Don't build ERP connectors — but keep resource IDs stable and boundaries clean so one can be added later.
- **Multi-department / multi-branch:** not built as a feature yet. Don't hardcode assumptions (e.g. a single implicit branch) that would make adding this later require a schema rewrite.

## Recommended build order

Follow the feature order in `USER_STORIES.md`'s intro: `auth` → `customer-management` → `ticket-management` + `live-chat` (parallel) → `sla-automation` → `agent-workspace` → `knowledge-base` → `ai-features` → `customer-portal` → `security-admin` → `reports-management` → `integrations` → `platform`. Later features assume earlier ones' models/endpoints exist — in particular, `knowledge-base` is built before `ai-features` because Story 34 (AI-suggested KB solutions) needs real KB content to suggest from.
