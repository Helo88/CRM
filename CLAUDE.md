# CLAUDE.md — Project Context for AI-Assisted Development

This file is read automatically by Claude Code (and should be treated as authoritative context by any AI agent working in this repo, including squad-kit's planner). It's the "ground rules" file: what this project is, what stack it's built on, and the conventions every story's implementation should follow. `USER_STORIES.md` is the "what to build" backlog; this file is the "how things are built here" reference. Read both before planning or implementing any story.

## What this project is

A standalone customer service web platform (not attached to any product/e-commerce catalog — think of the support/live-chat experience inside an app like Talabat, built on its own). Customers sign up, log in, and either start a live chat or submit a ticket (a written comment/problem). Live chat is answered first by an AI agent and escalates to a human agent when needed; tickets are answered by a human agent and delivered by email. Admins manage agents, configuration, and have full visibility across the system.

**Personas:** Customer · Human Agent · Admin · AI Agent (a system actor powered by Google Gemini — not a login-able account)

## Tech stack (decided — follow this, don't introduce alternatives without discussion)

- **Backend:** Node.js + Express, in `backend/`, written in **TypeScript** (compiled via `tsc`, run in dev via `tsx watch`). Prefer explicit interfaces for models, request bodies, and service inputs/outputs over `any`. Mongoose documents are typed via `Document`-extending interfaces (see `src/models/`).
- **Database:** MongoDB via Mongoose. Chosen over SQLite because the core of this app is high-frequency real-time chat writes and flexible conversation/ticket documents, which fit MongoDB's document model better than a single-writer relational file.
- **Real-time:** Socket.io, mounted on the same Express HTTP server, for live chat.
- **Auth:** JWT-based sessions (issued by the backend), passwords hashed with bcrypt. Roles: `customer`, `agent`, `admin`. The AI agent is not a user account — it's invoked server-side as a service. See "Frontend auth (session handling)" below for how the frontend carries this session — the JWT is never stored in browser-readable storage.
- **AI integration:** Google Gemini API, free tier, via the `@google/generative-ai` SDK. The Gemini API key lives only in backend environment variables — never sent to or called from the frontend. Used for: the customer-facing chat bot (first responder in live chat), ticket/chat summaries, suggested replies for agents, automatic categorization, and suggested knowledge-base solutions. Wrap every Gemini call with a timeout and a graceful fallback message — never let a customer-facing flow hang on an external API call.
- **Email:** Nodemailer, SMTP credentials from environment variables, used for ticket acknowledgments and agent replies delivered by email.
- **Frontend:** Next.js (App Router) + React, written in **TypeScript** (`.tsx`/`.ts`), in `frontend/`, as a separate app/service from the backend — not a Next.js monolith. Talks to the backend over REST (via its own server-side BFF layer — see below, not directly from browser JS for anything authenticated) and a Socket.io client connection for live chat.
- **i18n:** The customer-facing UI (and ideally agent/admin UI) must support Arabic and English, including right-to-left layout for Arabic. Don't hardcode English-only strings in components — route all user-facing text through the i18n layer from the start (the library is already wired in; see "i18n (internationalization)" below).

## Frontend auth (session handling)

The session JWT is **never** stored in browser-readable storage (no `localStorage`, no client-readable cookie) — it lives only in an `httpOnly` cookie (`SESSION_COOKIE` in `frontend/lib/auth.ts`), set by the frontend's own Backend-for-Frontend (BFF) layer. This is the Next.js-documented pattern for this exact situation (separate backend origin, App Router): [nextjs.org/docs/app/guides/backend-for-frontend](https://nextjs.org/docs/app/guides/backend-for-frontend).

- **Auth handshake:** `frontend/app/api/auth/{login,register,logout}/route.ts` — Route Handlers that call the real backend (`POST /api/v1/auth/...`), then set/clear the `httpOnly` cookie on the Next.js response. The backend's JSON response (which includes the raw JWT) never reaches the browser directly for these calls.
- **Route protection:** `frontend/proxy.ts` (Next.js 16's renamed `middleware.ts` — the file convention is `proxy.ts`, exported function is `proxy`, **not** `middleware`; using the old name is deprecated and will warn at build time) does a presence-only check on the cookie and redirects unauthenticated requests before a protected page renders. This is a UX convenience, not the real security boundary — keep it a "thin proxy" (redirects/rewrites only) per Next.js 16's guidance, not JWT verification; the backend's `requireAuth` is what actually verifies the token's signature, on every request, regardless of what the proxy did.
- **Authenticated pages:** Server Components that `await cookies()`, read the session cookie, and call the backend server-side (`Authorization: Bearer <token>`) — see `frontend/app/settings/page.tsx` for the pattern. Never pass the token down to a Client Component.
- **Authenticated mutations from a Client Component:** Server Actions (`"use server"`, e.g. `frontend/app/settings/actions.ts`) that read the cookie server-side and call the backend — not a client-side `fetch` to the backend's origin. `useActionState` (React 19) wires a Server Action to a form for pending/error/success state.
- Server-to-server calls (a Route Handler/Server Component/Server Action calling the Express backend) aren't subject to browser CORS — no `credentials`/CORS config needed for that leg; the backend's `cors()` config only matters if something ever calls it directly from a browser again, which authenticated flows should not do.

## i18n (internationalization)

The frontend uses **next-intl** (`frontend/i18n/request.ts`, `frontend/messages/en.json`, wired via `withNextIntl(...)` in `frontend/next.config.js` and `NextIntlClientProvider` in `frontend/app/layout.tsx`). This was set up early — not deferred to Story 49 — specifically so no component ever needs its hardcoded strings retrofitted into message keys after the fact; only the retrofit for the *first* few components (home, login, register, settings) had to happen once, when this was introduced.

- **Every new component with user-facing text adds a key to `frontend/messages/en.json`** and reads it with `useTranslations("SectionName")` (Client Components) or `getTranslations("SectionName")` (Server Components, Server Actions, Route Handlers) from `next-intl`/`next-intl/server`. Never inline an English string directly in JSX.
- **Locale is currently hardcoded to `"en"`** in `frontend/i18n/request.ts` — there is no `messages/ar.json`, no locale switcher, and no `[locale]` routing segment yet. That's intentionally Story 49's scope ("Bilingual Arabic & English UI"): add `ar.json` (translate every key already collected in `en.json`), wire real locale detection/switching, and flip `app/layout.tsx`'s hardcoded `dir="ltr"`/`lang="en"` to the real locale. Story 49 should not need to touch any component *other* than the locale-detection/switching mechanism itself, since every string is already behind a message key.
- Keep section names in `en.json` matching the feature/page they belong to (`Home`, `Login`, `Register`, `Settings`, ...) so the file stays navigable as it grows across all 51 stories.

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
- **Palette:** primary is a muted violet/indigo (`--primary: #5B4FD6` light / `#8E85E6` dark), neutrals are slate-toned, and there are dedicated semantic status tokens beyond shadcn's defaults — `--success`/`--success-foreground` (green, "on track" / resolved), `--warning`/`--warning-foreground` (amber, SLA at-risk), `--destructive`/`--destructive-foreground` (red, SLA breached). Use these three for any SLA/ticket-status indicator so status color stays consistent across the whole app — don't invent new status colors per feature.
- **Dark mode is the default.** `RootLayout` (`frontend/app/layout.tsx`) puts the `dark` class on `<html>` unconditionally, so the app renders with `.dark`'s tokens (`frontend/app/globals.css`) on first load — not `prefers-color-scheme`-driven, not opt-in. The `:root` (light) tokens are still fully defined and kept in sync with every dark-token change, so a future light/dark toggle is a matter of swapping the class, not re-deriving a palette.
- **Font:** Plus Jakarta Sans (`next/font/google`, wired in `frontend/app/layout.tsx` as `--font-sans`) — not Inter/Roboto/Geist. One font family, no separate display face needed for this dashboard-style UI.
- **RTL:** `frontend/components.json` has `"rtl": true`, and `RootLayout` wraps the app in Radix's `Direction.Provider` (from the unified `radix-ui` package) so direction-aware components (select, dropdown-menu, etc.) open correctly once the real `dir` value is wired up in Story 49. The `dir`/`lang` values in `app/layout.tsx` are still hardcoded to `"ltr"`/`"en"` pending that story — don't remove the `Direction.Provider` wiring, just replace the hardcoded value with the real locale when Story 49 is implemented.
- Two style directions (this shadcn one vs. an Ant Design-style alternative) were mocked up and compared before deciding — shadcn/ui was the chosen direction. Don't reintroduce the Ant Design-style density/table-heavy pattern without discussion.

## Testing

The backend's test runner is **Vitest**, not Jest — introduced by the `auth` feature's Story 3 (role-based access control) plan. `ts-jest` does not work with this project's `typescript@^7.0.2`: it fails to install (peer-dependency range doesn't cover TS 7.x) and, even forced past that, cannot invoke TS7's compiler API at all, so no test would ever run. Vitest transforms TypeScript via `esbuild` — the same tool this project's dev server (`tsx`) already uses — so it has no dependency on TypeScript's compiler API and isn't affected. Config: `backend/vitest.config.ts` (`globals: true`, so `describe`/`it`/`expect` don't need per-file imports), tests under `backend/tests/`, run via `npm test` (`vitest run`). `backend/tsconfig.json`'s `include` covers `tests/**/*.ts` alongside `src/**/*.ts` so `npm run typecheck` actually checks test files. Use `supertest` for HTTP-level route tests against `createApp()` from `backend/src/app.ts`.

No test runner exists in `frontend/` yet — cross that bridge with the same reasoning (esbuild-based tools, matching Next.js's own Turbopack/esbuild toolchain) rather than defaulting to Jest there either.

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

- **Every story that adds or changes a persona-facing backend capability ships its frontend UI in the same story.** "Backend-only, frontend is a later story" is not an acceptable way to scope a story — it was tried once (Stories 1-2, deferring the sign-up/login forms to an unspecified future "customer portal" story that never actually existed), and it left the platform with working auth endpoints and no way for a human to reach them. The only stories allowed to be backend-only are ones with no persona-facing surface at all (e.g. an internal cron job, a webhook receiver, a data-migration script) — anything a customer/agent/admin would need to click through must include the page(s)/component(s) for it, not just the API.
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
