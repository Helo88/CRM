# Story intake

- Folder: `.squad/stories/customer-portal/browse-faqs-from-the-portal/intake.md`

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Customer Portal
- **Feature slug (folder under `plans/`):** `customer-portal`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `37` *(Story 37 in USER_STORIES.md)*
- **Work item type:** `User Story`
- **Status:** `Not started`
- **Assignee:** ``
- **Labels:** `customer-portal`

---

## Title

```
Browse FAQs from the portal
```

---

## Acceptance criteria

```
- Knowledge base is accessible directly from the portal home screen.
- Portal suggests relevant articles before the customer finishes submitting
  a new ticket.
- FAQs display in the customer's selected language (English/Arabic).
```

---

## Description

```
As a customer, I want to browse or search FAQs/articles from within the
portal, so that I can try to solve my own issue before submitting a
ticket.
```

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |

None.

---

## Dependencies

- **Blocked by / related ids:** knowledge-base (Stories 28-30) — nothing to browse without published FAQs/articles and Story 30's search. This is the customer-facing FRONTEND consumer of those already-built backend endpoints.
- **Depends on code areas or other stories:** `FAQ`/`Article` models and their published-only customer-facing read endpoints (Story 28/29), Story 30's search endpoint.

## Extra notes (optional)

- This story is primarily FRONTEND — the backend read endpoints already exist from Stories 28-30 (customer-visible = published-only, per those stories' own access rules). Build the portal UI (FAQ list/search page) using the shadcn/ui design system already established.
- "Suggests relevant articles before submitting a ticket" — as the customer types a subject/description in the new-ticket form (Story 8's UI, if built), fire Story 30's search with the in-progress text and show top matches. This is a UI enhancement to the ticket-submission flow, not a new backend endpoint (reuse Story 30's search as-is).
- "In the customer's selected language" ties to Story 49 (`platform`, bilingual UI) — a much later feature. Until Story 49 wires up real locale switching, default to English and structure the FAQ display component to read from the bilingual `{ en, ar }` content shape Stories 28/29 established, so swapping in real locale detection later is a small change, not a rebuild.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.
- Public or `requireRole("customer")` reads, matching however Stories 28-30 scoped their customer-facing endpoints.

## Out of scope

- FAQ/article authoring (Stories 28-29, separate, already-planned stories) — this story only consumes/displays.
- Real locale switching (Story 49, separate, much later feature) — structure for it, don't build it.
