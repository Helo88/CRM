import { Types } from "mongoose";
import { User } from "../models/User";
import { Ticket } from "../models/Ticket";
import { Conversation } from "../models/Conversation";
import type { PermissionKey } from "../constants/permissions";

// Open statuses count against an agent's "current load" for the
// least-busy tiebreaker below. "answered" and "closed" tickets do not
// occupy an agent's attention, so they are excluded.
const OPEN_STATUSES = ["new", "in_progress", "escalated"] as const;

// Only "with_agent" conversations occupy an agent's attention for the same
// tiebreak — "ai_handling"/"escalated" have no agent yet, "resolved" is done.
const OPEN_CONVERSATION_STATUSES = ["with_agent"] as const;

/**
 * Story 10 (ticket-management) + Story 17 (live-chat) share this picker.
 * Returns the _id of the online agent with the fewest currently-open
 * assigned tickets + conversations, breaking ties by oldest createdAt.
 * Returns null when no agent matches — the caller decides whether
 * "unassigned" is fatal.
 *
 * `requiredPermission`, when given, narrows candidates to agents holding
 * that permission — used by the live-chat caller below to pass
 * `"chats:manage"` so an agent who's had chat access revoked stops
 * receiving new chat assignments without affecting their ticket
 * eligibility (tickets have no equivalent gate, so that caller omits it).
 * The least-busy tiebreak still counts an agent's TOTAL load (tickets +
 * conversations) regardless of this filter — narrowing candidates doesn't
 * change what "busy" means.
 */
export async function pickNextAvailableAgent(requiredPermission?: PermissionKey): Promise<Types.ObjectId | null> {
  const filter: Record<string, unknown> = {
    role: "agent",
    isOnline: true,
    isActive: true,
    isDeleted: false,
  };
  if (requiredPermission) filter.permissions = requiredPermission;

  const candidates = await User.find(filter)
    .select("_id createdAt")
    .sort({ createdAt: 1 })
    .lean();

  if (candidates.length === 0) return null;

  const ids = candidates.map((u) => u._id);
  const [ticketLoadCounts, conversationLoadCounts] = await Promise.all([
    Ticket.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { assignedAgent: { $in: ids }, status: { $in: [...OPEN_STATUSES] } } },
      { $group: { _id: "$assignedAgent", count: { $sum: 1 } } },
    ]),
    Conversation.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { assignedAgent: { $in: ids }, status: { $in: [...OPEN_CONVERSATION_STATUSES] } } },
      { $group: { _id: "$assignedAgent", count: { $sum: 1 } } },
    ]),
  ]);

  const loadById = new Map<string, number>();
  for (const row of ticketLoadCounts) {
    loadById.set(String(row._id), (loadById.get(String(row._id)) ?? 0) + row.count);
  }
  for (const row of conversationLoadCounts) {
    loadById.set(String(row._id), (loadById.get(String(row._id)) ?? 0) + row.count);
  }

  let best = candidates[0];
  let bestLoad = loadById.get(String(best._id)) ?? 0;
  for (const c of candidates.slice(1)) {
    const load = loadById.get(String(c._id)) ?? 0;
    if (load < bestLoad) {
      best = c;
      bestLoad = load;
    }
  }
  return best._id;
}

// Serializes pickAndClaimAgentForConversation calls within this Node
// process, so two near-simultaneous escalations can't both read the same
// "least busy" snapshot before either has claimed. Single-node correctness
// only — a multi-node deployment would need a distributed lock instead;
// out of scope for this story.
let assignmentMutex: Promise<unknown> = Promise.resolve();

/**
 * Story 17 (live-chat auto-assign): pick an online agent and atomically
 * claim `conversationId` for them in a single write, flipping the
 * conversation from "escalated" to "with_agent". Returns the assigned
 * agent id, or null when no agent is online (caller emits the "no agent
 * available" hint and reverts the conversation) or the conversation was
 * claimed/changed by someone else in the meantime.
 *
 * Concurrency: serialised via assignmentMutex above so two simultaneous
 * escalations cannot both land on the same agent. The findOneAndUpdate
 * below additionally guards on `{ _id, status: "escalated", assignedAgent:
 * null }` so a stale claim is a no-op instead of an overwrite.
 */
export async function pickAndClaimAgentForConversation(
  conversationId: Types.ObjectId | string
): Promise<Types.ObjectId | null> {
  const run = assignmentMutex.then(async () => {
    const pickedId = await pickNextAvailableAgent("chats:manage");
    if (!pickedId) return null;

    const claimed = await Conversation.findOneAndUpdate(
      { _id: conversationId, status: "escalated", assignedAgent: null },
      { $set: { status: "with_agent", assignedAgent: pickedId } },
      { new: true }
    );
    return claimed ? pickedId : null;
  });
  // Keep the mutex chain alive regardless of this call's outcome so a
  // rejection here never wedges every later caller.
  assignmentMutex = run.catch(() => undefined);
  return run;
}
