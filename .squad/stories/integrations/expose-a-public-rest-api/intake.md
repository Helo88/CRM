# Story intake

- Folder: `.squad/stories/integrations/expose-a-public-rest-api/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Integrations
- **Feature slug (folder under `plans/`):** `integrations`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `48` *(Story 48 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `integrations`

---

## Title

```
Expose a public REST API
```

---

## Acceptance criteria

```
- API is authenticated (e.g. API keys or the same JWT scheme) and
  rate-limited.
- Supports core operations: create/read/update tickets, chats, and
  customers.
- API is documented (e.g. OpenAPI/Swagger) so integrators can self-serve.
```

---

## Description

```
As a developer, I want to use a documented API to read/write tickets and
customer data, so that the platform can be integrated with other tools
now or later.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** ticket-management, customer-management, live-chat — the core resources this API exposes already have internal endpoints by this point in the build order.
- **Depends on code areas or other stories:** All existing `/api/v1/*` routes (tickets, customers, conversations).

## Extra notes (optional)

- Per `CLAUDE.md`'s scope notes: "only this platform's own REST API is built now... keep resource IDs stable and boundaries clean so [ERP integrations] can be added later" — this story is likely about DOCUMENTING and hardening the existing `/api/v1/*` surface (rate limiting, API-key auth as an alternative to JWT for machine clients) rather than building an entirely separate parallel API.
- "API keys OR the same JWT scheme" — reusing JWT auth (`requireAuth`) for machine clients is simplest; a dedicated API-key mechanism is a larger addition (key generation/storage/rotation, a new `ApiKey` model) — note this as a real scope decision rather than silently picking the heavier option.
- Rate limiting: no existing rate-limit middleware in this codebase — a well-known npm package (e.g. `express-rate-limit`) is the standard choice; note it as a new dependency.
- OpenAPI/Swagger documentation: no existing API-doc tooling — introducing one (e.g. generating from route/type annotations, or hand-written) is a real scope decision to make explicit.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.

## Out of scope

- ERP or other external-system connectors — per `CLAUDE.md`, explicitly deferred, not part of this story.
