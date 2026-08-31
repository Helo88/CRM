# ticket-management — plan overview

Entry point for the **ticket-management** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| _add rows as stories are planned_ |
| 10 | `10-story-get-support-choose-a-ticket-or-live-chat.md` | Get support — choose a ticket or live chat | get-support-choose-a-ticket-or-live-chat | — |
| 11 | `11-story-submit-a-ticket-comment-problem.md` | Submit a ticket (comment/problem) | submit-a-ticket-comment-problem | Story 53 (`10-story-get-support-choose-a-ticket-or-live-chat.md`) |
| 12 | `12-story-create-a-ticket-on-behalf-of-a-customer.md` | Create a ticket on behalf of a customer | create-a-ticket-on-behalf-of-a-customer | — |
| 13 | `13-story-manage-ticket-categories-and-priorities.md` | Manage ticket categories and priorities | manage-ticket-categories-and-priorities | — |
| 14 | `14-story-categorize-and-prioritize-a-ticket.md` | Categorize and prioritize a ticket | categorize-and-prioritize-a-ticket | — |
| 15 | `15-story-reply-to-a-ticket.md` | Reply to a ticket | reply-to-a-ticket | Story 8/57 (ticket exists); Story 9 (`14-story-categorize-and-prioritize-a-ticket.md`, extends the same `/tickets/[id]` page) |
| 18 | `18-story-view-and-filter-the-ticket-queue.md` | View and filter the ticket queue | view-and-filter-the-ticket-queue | — |
| 20 | `20-story-auto-assign-a-ticket-to-an-available-agent.md` | Auto-assign a ticket to an available agent | auto-assign-a-ticket-to-an-available-agent | — |
| 26 | `26-story-in-app-notifications-for-ticket-events.md` | In-app notifications for ticket events | in-app-notifications-for-ticket-events | — |
| 28 | `28-story-update-ticket-status.md` | Update ticket status | update-ticket-status | — |
| 29 | `29-story-status-quick-filter-chips-on-the-ticket-queue.md` | Status quick-filter chips on the ticket queue | status-quick-filter-chips-on-the-ticket-queue | — |

## Dependency notes

Story 15 inlines the "New/In Progress → Answered" status transition directly (no call into a Story 11 endpoint) since Story 11 (Update ticket status) has not been planned yet — when Story 11 lands, it should treat that inline transition as existing behavior to preserve, per the two stories' mutual-dependency note in the reply-to-a-ticket intake.
