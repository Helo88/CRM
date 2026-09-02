import type { TicketPriority } from "../models/Ticket";
import { SlaTarget } from "../models/SlaTarget";

// sla-automation Story 26 (track SLA timers): resolves the deadline
// timestamps a Ticket/Conversation gets stamped with at creation time, and
// derives the on-read status ("on_track" | "at_risk" | "breached") from
// those timestamps. No scheduler, no persistence of the derived status —
// see the story plan for why (Story 27 owns proactive breach handling).

export type SlaStatus = "on_track" | "at_risk" | "breached";

export interface ResolvedTicketSlaTargets {
  responseTargetAt: Date;
  resolutionTargetAt: Date;
}

export interface ResolvedConversationSlaTargets {
  responseTargetAt: Date;
}

// Surfaced instead of a generic Error so callers/tests can tell "SLA
// configuration is missing" apart from any other failure. Route handlers
// don't catch this specially — it propagates to `next(err)` and becomes a
// 500, which is the intended behavior: a missing default SlaTarget row is
// an ops misconfiguration, not something to silently paper over.
export class SlaTargetNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlaTargetNotConfiguredError";
  }
}

// Story 25's documented match precedence (backend/src/models/SlaTarget.ts):
//   1. exact (priority, category)
//   2. (priority, null)
//   3. (null, category)
//   4. (null, null)  <- mandatory default row
async function findApplicableSlaTarget(input: { priority: TicketPriority | null; category: string | null }) {
  const { priority, category } = input;

  const attempts: Array<{ priority: TicketPriority | null; category: string | null }> = [];
  if (priority !== null && category !== null) attempts.push({ priority, category });
  if (priority !== null) attempts.push({ priority, category: null });
  if (category !== null) attempts.push({ priority: null, category });
  attempts.push({ priority: null, category: null });

  for (const attempt of attempts) {
    const target = await SlaTarget.findOne(attempt);
    if (target) return target;
  }

  throw new SlaTargetNotConfiguredError(
    "No default SLA target is configured. An admin must create the (priority=null, category=null) row before tickets/conversations can be created."
  );
}

export async function resolveTicketSlaTargets(input: {
  category: string | null;
  priority: TicketPriority;
  now?: Date;
}): Promise<ResolvedTicketSlaTargets> {
  const now = input.now ?? new Date();
  const target = await findApplicableSlaTarget({ priority: input.priority, category: input.category });
  return {
    responseTargetAt: new Date(now.getTime() + target.responseMinutes * 60_000),
    resolutionTargetAt: new Date(now.getTime() + target.resolutionMinutes * 60_000),
  };
}

// Chats have no priority/category dimension to match on — they always
// resolve against the default (null, null) row.
export async function resolveConversationSlaTargets(input: {
  now?: Date;
}): Promise<ResolvedConversationSlaTargets> {
  const now = input.now ?? new Date();
  const target = await findApplicableSlaTarget({ priority: null, category: null });
  return {
    responseTargetAt: new Date(now.getTime() + target.responseMinutes * 60_000),
  };
}

// 15 minutes. Not admin-configurable in this story — SlaSystemSettings.atRiskPercent
// (backend/src/models/SlaSystemSettings.ts) is Story 27's monitor-scan tuning, a
// separate concern from this on-read status derivation.
const AT_RISK_THRESHOLD_MS = 15 * 60 * 1000;

// Pausing the response-target clock while a ticket is "answered" (waiting on
// the customer) is a stretch goal: it needs accumulated paused-duration
// accounting (a new schema field) to be correct, which is out of scope for
// this story. Leave this false; flipping it without adding that accounting
// produces wrong at-risk/breach timing. See sla-automation Story 26's plan.
export const SLA_PAUSE_ON_ANSWERED = false as const;

// Pure derivation, no I/O. Missing targets (both undefined) read as
// "on_track" so tickets/conversations created before this story shipped
// don't get misreported as breached.
//
// Known limitation (sla-automation Story 26): a closed/escalated ticket's
// status is not frozen at close time — this compute-on-read model keeps
// evaluating against `now`, so a closed ticket can flip to "breached" after
// the fact even though nobody can act on it anymore. Freezing a snapshot at
// close would need persistence this story deliberately doesn't add.
export function computeSlaStatus(input: {
  responseTargetAt?: Date | null;
  resolutionTargetAt?: Date | null;
  currentStatus?: string;
  now?: Date;
}): SlaStatus {
  const { responseTargetAt, resolutionTargetAt, currentStatus } = input;
  const now = input.now ?? new Date();

  if (!responseTargetAt && !resolutionTargetAt) return "on_track";

  if (resolutionTargetAt && now.getTime() >= resolutionTargetAt.getTime()) {
    return "breached";
  }

  const responseIgnored = SLA_PAUSE_ON_ANSWERED && currentStatus === "answered";

  if (!responseIgnored && responseTargetAt && now.getTime() >= responseTargetAt.getTime()) {
    return "breached";
  }

  const remaining: Date[] = [];
  if (resolutionTargetAt) remaining.push(resolutionTargetAt);
  if (!responseIgnored && responseTargetAt) remaining.push(responseTargetAt);
  if (remaining.length === 0) return "on_track";

  const nearest = remaining.reduce((a, b) => (a.getTime() < b.getTime() ? a : b));
  if (nearest.getTime() - now.getTime() <= AT_RISK_THRESHOLD_MS) return "at_risk";

  return "on_track";
}
