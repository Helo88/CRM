# Story 41 — Show which staff member is already handling a live chat

> **Superseded-by-implementation note:** this plan was originally written for a soft, visibility-only presence signal (see the "Not in scope" list below the original Story Goal) with no enforcement. Mid-implementation the user redirected the design to a hard exclusive claim/lock instead — every staff role (agent/subadmin/admin) must click "Join chat" before replying, and only one person can hold a conversation at a time. The sections below have been rewritten to describe what was actually built, not the original softer design, so this file stays a trustworthy record. The related sibling story (`notify-available-agents-when-a-chat-needs-a-human`) was implemented in the same session and is described here too since the two ended up interlocking (the old per-agent auto-assign this story's claim mechanic replaces was also that sibling's original notification trigger).

## Prerequisites

- **Story 18** (agent or admin replies to a live chat in real time) — this story replaces Story 18's "any admin can jump into any chat, any assignedAgent can reply" model with an explicit claim requirement, no role bypass.
- **Story 17** (auto-assign an escalated chat to an available agent) — **removed**. `assignment.service.ts`'s `pickAndClaimAgentForConversation` (and its serializing mutex) no longer exists; `pickNextAvailableAgent` itself is untouched and still backs ticket auto-assignment.
- **Story 62** (AI agent suggests opening a ticket) — `Ticket.sourceConversation` is the link the ticket-history criterion reads.
- **ticket-management Story 13 / Story 63** — `ticketHistory.service.ts` / `TicketDetailSidebar.tsx`'s existing "one history-event kind per concern, one array on `Ticket`" pattern, extended with two new kinds.

---

## Story Goal (as built)

1. **Claiming replaces auto-assignment.** `conversation:escalate` no longer picks an agent — it only flips status to `"escalated"`, persists a `"system"`-sender acknowledgment message, and notifies every eligible staff member (`notifyChatOversight`, `chat_needs_agent`, unconditionally — no more "only if nobody was online" branch, since nothing is auto-picked anymore).
2. **Explicit "Join chat" / "Leave chat" buttons** in `AgentChatPanel.tsx`, for agent, subadmin, and admin alike — no role gets a bypass. Backed by two new socket events:
   - `conversation:claim` — atomic on `{ assignedAgent: null }`; rejects if someone else already holds it, if the caller isn't eligible (admin always; agent/subadmin only with `chats:manage`), or if the conversation is resolved. On success, sets `assignedAgent`/status `"with_agent"`, broadcasts `conversation:claimed`, and (on the first-ever claim) fires the existing customer-facing `conversation:assigned` "a support agent has joined" hint — no longer inferred from someone's first message.
   - `conversation:unclaim` — only the current claimant can release their own claim; reverts to `assignedAgent: null`, status `"escalated"`, broadcasts `conversation:unclaimed`.
3. **Replying requires holding the claim.** `conversation:message`'s authorization for a non-customer sender is now `isClaimant` (exact match on `assignedAgent`), not the broader `isAuthorizedOnConversation` — a staff member who can *view* a chat (any `chats:manage` holder, or an admin) cannot send until they've claimed it.
4. **Viewing is broader than claiming.** `isAuthorizedOnConversation` (gates `conversation:join`/`conversation:close`) was widened so any agent holding `chats:manage` can view *any* conversation, not just one already assigned to them — otherwise a plain agent could never see an unclaimed chat to decide whether to claim it. `GET /api/v1/conversations`'s list filter for a plain agent was widened the same way: their own claimed chats **plus** every unclaimed one, never another agent's claimed chat.
5. **Abandoned claims release automatically.** A `disconnecting`/`disconnect` pair on the socket (capture conversation rooms before Socket.io removes the socket from them, act after) releases any claim the disconnecting user held, exactly like clicking "Leave chat" — so a crashed tab/dropped connection never locks a chat forever.
6. **Visible in both places asked for:** the chat detail page (`AgentChatPanel.tsx`'s claim banner + Join/Leave buttons) and the `/chats` list (`chats/page.tsx`'s new "Handled by" column, populated server-side via `assignedAgent`).
7. **Ticket-history recording**, per the original ask: a staff claim/unclaim (including the disconnect-triggered auto-release) is recorded on any ticket whose `sourceConversation` points at that conversation, as new `chat_participant_joined`/`chat_participant_left` history events — same shape as the four existing `*History` arrays on `Ticket`.

**Out of scope (unchanged from the original plan):**
- Any admin override to force-release someone else's claim (only the claimant themself, or their own disconnect, releases it).
- Deduplicating/debouncing rapid claim/release pairs in the ticket-history timeline.

---

## What actually changed, file by file

### Backend

- **`backend/src/sockets/chat.socket.ts`** — the bulk of the work:
  - `io.use`: `socket.data.user` now carries `name` (from the verified JWT), not just `{ id, role }`.
  - `isAuthorizedOnConversation`: widened for `role === "agent"` to `assignedAgent === them OR hasPermission("chats:manage")` (was: assignedAgent only).
  - New `isClaimant(user, conversation)` — exact `assignedAgent` match, no role bypass. Gates `conversation:message` for any non-customer sender.
  - New `canClaimConversation(user)` — admin always; agent/subadmin via `hasPermission("chats:manage")`.
  - New `recordChatPresenceEventOnTicket(conversationId, event, userId)` — `Ticket.updateMany({ sourceConversation }, { $push: { chatPresenceHistory: {...} } })`, best-effort/non-throwing.
  - `conversation:escalate` — dropped the `pickAndClaimAgentForConversation` call entirely; always sends the ack message and always calls `notifyChatOversight`.
  - New `conversation:claim` / `conversation:unclaim` handlers (see Story Goal above for their exact semantics).
  - `conversation:message` — authorization check changed from `isAuthorizedOnConversation` to `isOwnCustomer || isClaimant`.
  - `disconnecting`/`disconnect` — now a real pair (was a bare log line): captures `conversation:*` rooms pre-leave, releases any held claim post-leave, records the "left" ticket-history event, broadcasts `conversation:unclaimed`.
- **`backend/src/models/Notification.ts`** — `ticketId`/`conversationId` are both now nullable (a notification carries exactly one); `NotificationType` gained `chat_needs_agent` and briefly gained then **dropped** `chat_assigned` (no auto-assign left to notify about — a self-initiated claim needs no "you got assigned" notification).
- **`backend/src/services/notification.service.ts`** — added `notifyChatOversight` (broadcasts to every admin + every agent/subadmin holding `chats:manage`, not just an oversight-tier subset — anyone eligible to claim should hear about it). `createChatNotification` was added then removed in the same session once claiming replaced auto-assign.
- **`backend/src/services/assignment.service.ts`** — `pickAndClaimAgentForConversation` and its serializing mutex **removed**. `pickNextAvailableAgent` is untouched and still used by ticket auto-assignment.
- **`backend/src/models/Ticket.ts`** — added `ITicketChatPresenceHistoryEntry` (`{ event: "joined" | "left"; user; at }`) and the `chatPresenceHistory` array field, same shape/defaults as the four existing `*History` arrays.
- **`backend/src/services/ticketHistory.service.ts`** — `TicketHistoryEventKind` gained `chat_participant_joined`/`chat_participant_left`; `buildTicketHistory` folds `chatPresenceHistory` entries into the batched actor lookup and the emitted event list.
- **`backend/src/routes/conversation.routes.ts`** — `GET /` populates `assignedAgent` (name) and widens the plain-agent filter to `{ assignedAgent: me } OR { assignedAgent: null }`; `GET /:id` populates `assignedAgent` too, but only **after** the `callerAuthorizedOnConversation` check (which compares `assignedAgent` as a raw ObjectId — running it against an already-populated object would silently break it).
- **`backend/src/validation/conversation.schema.ts`** — added `conversationClaimPayloadSchema`, shared by both `conversation:claim` and `conversation:unclaim`.

### Frontend

- **`frontend/app/chats/[id]/AgentChatPanel.tsx`** — new `ChatClaimant` type + `initialClaimant` prop; claim banner (unclaimed / claimed-by-you / claimed-by-X) with Join/Leave buttons; composer disabled unless the viewer is the current claimant; a `claimError` state kept separate from the connection-level `errorMessage` so a claim conflict doesn't tear down the whole panel (only a pre-join failure does that).
- **`frontend/app/chats/[id]/page.tsx`** — `ConversationDetail` gained `assignedAgent`; derives `initialClaimant` from it.
- **`frontend/app/chats/page.tsx`** — `assignedAgent` type changed from a bare id string to `{ _id, name } | null`; new "Handled by" column.
- **`frontend/app/chat/LiveChatPanel.tsx`** (customer side) — the `noAgentAvailable` state/UI/handler and the `conversation:no-agent-available` listener were removed entirely (that event no longer exists — escalation no longer attempts an immediate pick that can "fail"). `conversation:assigned` handling is unchanged; it still just flips `escalationState` to `"assigned"`, now triggered by a claim instead of a first message.
- **`frontend/app/tickets/[id]/actions.ts`, `TicketDetailSidebar.tsx`** — `chat_participant_joined`/`chat_participant_left` added to the `kind` union, `HISTORY_EVENT_ICON` (`LogIn`/`LogOut`), and `historyEventLabel`'s switch.
- **`frontend/messages/en.json` / `ar.json`** — added `joinChat`, `leaveChat`, `chatUnclaimed`, `chatClaimedByYou`, `chatClaimedBy`, `joinToReplyPlaceholder`, `columnHandledBy`, `unclaimedRow`, `TicketDetail.history.event.chatParticipantJoined/Left`; removed `noAgentAvailableTitle/Body`, `noAgentKeepChattingAi`, `noAgentClose`, and (after the `chat_assigned` type was dropped) `notificationChatAssigned`.

---

## Edge Cases & Failure Modes

- **Claim race between two staff members** — MongoDB's single-document `findOneAndUpdate({ assignedAgent: null }, ...)` is the race-free boundary; the loser gets `"This chat is already being handled by another staff member."` No serializing mutex needed (unlike the old auto-pick, which had to serialize its own read-then-write).
- **Claimant's tab crashes / network drops** — the `disconnecting`/`disconnect` pair auto-releases the claim; nothing stays locked forever.
- **A message-send raced by a concurrent unclaim** — surfaces as a `claimError` in `AgentChatPanel.tsx`, not a connection-level error; the composer re-disables itself once the next `conversation:unclaimed`/`conversation:claimed` broadcast lands.
- **Conversation has no linked ticket** — `Ticket.updateMany` matches zero documents; no error, nothing recorded (the common case — most chats never spawn a ticket).
- **Customer's own join/leave** — never recorded to ticket history and never treated as a claim (customers can't claim at all — `canClaimConversation` returns `false` for role `"customer"`).

---

## Test Plan (as implemented)

All in `backend/tests/sockets/chat.socket.test.ts` unless noted:

1. `describe("chat.socket.ts conversation:claim / conversation:unclaim")` — claim success + `conversation:assigned` fired once; second claimant rejected; customer rejected; agent-without-`chats:manage` rejected (both at join and at claim); admin has no bypass for replying pre-claim; unclaim success + reverts to `"escalated"`; unclaim rejected from a non-claimant; disconnect auto-releases; ticket-history joined/left pair recorded.
2. `describe("chat.socket.ts escalate (Story 16)")` — new test: escalation sends the ack (`senderType: "system"`) and a `chat_needs_agent` notification to every eligible recipient (admin, online-and-eligible agent, offline-but-eligible agent), and *not* to an ineligible agent.
3. `backend/tests/services/ticketHistory.service.test.ts` — new test asserting `chat_participant_joined`/`left` events, in order, with a populated actor.
4. `backend/tests/services/assignment.service.test.ts` — the `pickAndClaimAgentForConversation` describe block removed; `pickNextAvailableAgent`'s own tests untouched.
5. `backend/tests/routes/conversation.routes.test.ts` — the agent-scoped list test rewritten to assert the union (own-claimed + unclaimed, never another agent's claimed chat).

---

## Verification Steps

1. **Backend builds:** `npm run build` in `backend/` — clean.
2. **Backend tests:** `npm test` in `backend/` — 525 tests passing (full suite, not just the touched files).
3. **Frontend builds:** `npm run build` in `frontend/` — clean, no missing i18n keys.
4. **Frontend typecheck:** `npx tsc --noEmit` in `frontend/` — clean.

---

## Done Criteria

- [x] `conversation:claim`/`conversation:unclaim` implemented with atomic, race-free claiming and no role bypass.
- [x] `AgentChatPanel.tsx` has Join/Leave buttons; composer gated on holding the claim; claim conflicts don't tear down the connection.
- [x] `/chats` list shows a "Handled by" column.
- [x] Disconnect auto-releases an abandoned claim.
- [x] Ticket-history records claim/release (including disconnect-triggered ones) when a ticket exists with `sourceConversation` pointing at the conversation.
- [x] Story 17's auto-assign (`pickAndClaimAgentForConversation`) fully removed; `pickNextAvailableAgent` (ticket auto-assign) untouched.
- [x] Sibling story's `chat_needs_agent` notification now fires on every escalation, to every admin/subadmin/agent holding `chats:manage` — not just when nobody was online.
- [x] All tests passing (525 backend tests), both frontend and backend typecheck/build clean.
- [x] `.squad/plans/live-chat/00-overview.md` row present for this story.
