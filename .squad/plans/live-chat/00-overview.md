# live-chat — plan overview

Entry point for the **live-chat** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| _add rows as stories are planned_ |
| 16 | `16-story-start-a-live-chat.md` | Start a live chat | start-a-live-chat | — |
| 17 | `17-story-ai-agent-responds-first-google-gemini.md` | AI agent responds first (Google Gemini) | ai-agent-responds-first-google-gemini | — |
| 21 | `21-story-escalate-to-a-human-agent.md` | Escalate to a human agent | escalate-to-a-human-agent | — |
| 22 | `22-story-auto-assign-an-escalated-chat-to-an-available-agent.md` | Auto-assign an escalated chat to an available agent | auto-assign-an-escalated-chat-to-an-available-agent | — |
| 23 | `23-story-agent-replies-to-a-live-chat-in-real-time.md` | Agent replies to a live chat in real time | agent-replies-to-a-live-chat-in-real-time | — |
| 24 | `24-story-ai-agent-suggests-opening-a-ticket.md` | AI agent suggests opening a ticket | ai-agent-suggests-opening-a-ticket | — |
| 25 | `25-story-close-a-live-chat-conversation.md` | Close a live chat conversation | close-a-live-chat-conversation | — |
| 41 | `41-story-show-which-staff-member-is-already-handling-a-live-chat.md` | Show which staff member is already handling a live chat | show-which-staff-member-is-already-handling-a-live-chat | Story 18, Story 62, ticket-management Story 13/63 |

## Dependency notes

- Story 41 extends `backend/src/sockets/chat.socket.ts` (Story 18's join/message handlers) and `backend/src/services/ticketHistory.service.ts` + `backend/src/models/Ticket.ts` (ticket-management Stories 13/63's history pattern and Story 62's `sourceConversation` link) — see that story's own `## Prerequisites` for exact line references. It does not touch the separate "notify available agents when a chat needs a human" story (unplanned as of this writing; see `.squad/stories/live-chat/notify-available-agents-when-a-chat-needs-a-human/intake.md`).
