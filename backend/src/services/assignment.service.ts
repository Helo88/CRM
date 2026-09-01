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
 * Story 10 (ticket-management): auto-assign a new ticket to the online
 * agent with the fewest currently-open assigned tickets + conversations,
 * breaking ties by oldest createdAt. Returns null when no agent matches —
 * the caller decides whether "unassigned" is fatal.
 *
 * Live-chat used to share this picker for auto-assigning an escalated
 * conversation (Story 17's `pickAndClaimAgentForConversation`, since
 * removed) — chat assignment is now an explicit staff action (the "Join
 * chat" button in chat.socket.ts's conversation:claim handler), not an
 * automatic pick. `OPEN_CONVERSATION_STATUSES` below still counts an
 * agent's currently-claimed live chats toward their TOTAL load for ticket
 * auto-assignment purposes — someone mid-chat is genuinely busier, even
 * though nothing here picks a chat's claimant anymore.
 *
 * `requiredPermission`, when given, narrows candidates to agents holding
 * that permission. Currently unused (ticket auto-assign omits it — tickets
 * have no equivalent gate) but left in place since narrowing candidates by
 * permission is a generically useful capability of this picker, not
 * something specific to the now-removed chat caller.
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
