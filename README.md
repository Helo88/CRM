# AzmSquad Customer Service Platform

A standalone customer-service web app (Talabat-live-chat style): customers sign up, log in, and either start a live chat (AI agent first, escalates to a human) or submit a ticket (answered by a human agent, delivered by email). Admins manage agents, configuration, and have full visibility.

- **What to build:** [`USER_STORIES.md`](./USER_STORIES.md) — the full backlog, organized by squad-kit feature.
- **How things are built here:** [`CLAUDE.md`](./CLAUDE.md) — stack, conventions, and scope notes. Read this before implementing any story.

## Repo layout

```
backend/    Node.js + Express + MongoDB + Socket.io API and real-time server
frontend/   Next.js app (separate service, talks to backend over REST + Socket.io)
```

## Running locally

```bash
# Backend
cd backend
cp .env.example .env   # fill in MongoDB URI, JWT secret, Gemini API key, SMTP creds
npm install
npm run dev             # http://localhost:4000 — try GET /api/v1/health

# Frontend (separate terminal)
cd frontend
cp .env.local.example .env.local
npm install
npm run dev             # http://localhost:3000
```

Requires a running MongoDB instance (local `mongod`, Docker, or a free-tier Atlas cluster) for `MONGODB_URI`, and a [Google AI Studio](https://aistudio.google.com/) API key for `GEMINI_API_KEY` (free tier).

## Using squad-kit

Each feature in `USER_STORIES.md` maps to one squad-kit feature folder:

```bash
squad new-story <feature-slug> --title "<Story Title>"
```

Paste that story's **User Story** + **Acceptance Criteria** into the generated `intake.md`, then run squad-kit's plan/execute steps. Recommended feature order is in `USER_STORIES.md`'s intro and repeated in `CLAUDE.md`.
