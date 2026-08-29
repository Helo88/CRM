import { Types } from "mongoose";
import { User } from "../models/User";
import { Ticket } from "../models/Ticket";

// Open statuses count against an agent's "current load" for the
// least-busy tiebreaker below. "answered" and "closed" tickets do not
// occupy an agent's attention, so they are excluded.
const OPEN_STATUSES = ["new", "in_progress", "escalated"] as const;

/**
 * Story 10 (ticket-management) + reused by Story 17 (live-chat).
 * Returns the _id of the online agent with the fewest currently-open
 * assigned tickets, breaking ties by oldest createdAt. Returns null when
 * no agent matches — the caller decides whether "unassigned" is fatal.
 *
 * NOTE: `isOnline` only flips to `true` after Story 21 ships the agent
 * availability toggle. Until then this function will return null for
 * every call — that is the intended, expected transient state, not a
 * bug to work around with a fake availability signal.
 */
export async function pickNextAvailableAgent(): Promise<Types.ObjectId | null> {
  const candidates = await User.find({
    role: "agent",
    isOnline: true,
    isActive: true,
    isDeleted: false,
  })
    .select("_id createdAt")
    .sort({ createdAt: 1 })
    .lean();

  if (candidates.length === 0) return null;

  const ids = candidates.map((u) => u._id);
  const loadCounts = await Ticket.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { assignedAgent: { $in: ids }, status: { $in: [...OPEN_STATUSES] } } },
    { $group: { _id: "$assignedAgent", count: { $sum: 1 } } },
  ]);

  const loadById = new Map(loadCounts.map((row) => [String(row._id), row.count]));

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
