import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SlaTarget } from "../../src/models/SlaTarget";
import { Ticket } from "../../src/models/Ticket";
import {
  computeSlaStatus,
  resolveTicketSlaTargets,
  resolveConversationSlaTargets,
  recomputeTicketSla,
  SlaTargetNotConfiguredError,
  SLA_PAUSE_ON_ANSWERED,
} from "../../src/services/sla.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("sla-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await SlaTarget.deleteMany({});
});

describe("computeSlaStatus (sla-automation Story 26)", () => {
  it("both targets undefined -> on_track", () => {
    expect(computeSlaStatus({})).toBe("on_track");
  });

  it("now past resolutionTargetAt -> breached", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const status = computeSlaStatus({
      responseTargetAt: new Date("2026-01-01T10:00:00Z"),
      resolutionTargetAt: new Date("2026-01-01T11:00:00Z"),
      now,
    });
    expect(status).toBe("breached");
  });

  it("now within AT_RISK_THRESHOLD_MS of responseTargetAt -> at_risk", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const status = computeSlaStatus({
      responseTargetAt: new Date("2026-01-01T10:10:00Z"),
      resolutionTargetAt: new Date("2026-01-02T10:00:00Z"),
      now,
    });
    expect(status).toBe("at_risk");
  });

  it("now well before both targets -> on_track", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = computeSlaStatus({
      responseTargetAt: new Date("2026-01-01T05:00:00Z"),
      resolutionTargetAt: new Date("2026-01-02T00:00:00Z"),
      now,
    });
    expect(status).toBe("on_track");
  });

  it("chat variant (only responseTargetAt), past deadline -> breached", () => {
    const now = new Date("2026-01-01T10:01:00Z");
    const status = computeSlaStatus({
      responseTargetAt: new Date("2026-01-01T10:00:00Z"),
      now,
    });
    expect(status).toBe("breached");
  });

  it("chat variant well before deadline -> on_track", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const status = computeSlaStatus({
      responseTargetAt: new Date("2026-01-01T05:00:00Z"),
      now,
    });
    expect(status).toBe("on_track");
  });

  // SLA_PAUSE_ON_ANSWERED is a compile-time constant this story leaves
  // false — flipping it needs paused-duration accounting that doesn't exist
  // yet (see sla.service.ts). Not exercised here; this just guards against
  // someone flipping the flag without adding that accounting.
  it.skip("SLA_PAUSE_ON_ANSWERED = true ignores the response target while status is answered (not implemented this story)", () => {
    expect(SLA_PAUSE_ON_ANSWERED).toBe(true);
  });

  it("SLA_PAUSE_ON_ANSWERED defaults to false", () => {
    expect(SLA_PAUSE_ON_ANSWERED).toBe(false);
  });
});

describe("resolveTicketSlaTargets / resolveConversationSlaTargets", () => {
  it("resolves an exact (priority, category) match over the default row", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });
    await SlaTarget.create({ priority: "urgent", category: "Billing", responseMinutes: 5, resolutionMinutes: 30 });

    const now = new Date("2026-01-01T00:00:00Z");
    const result = await resolveTicketSlaTargets({ priority: "urgent", category: "Billing", now });

    expect(result.responseTargetAt.toISOString()).toBe("2026-01-01T00:05:00.000Z");
    expect(result.resolutionTargetAt.toISOString()).toBe("2026-01-01T00:30:00.000Z");
  });

  it("falls back to the (priority, null) row when no exact category match exists", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });
    await SlaTarget.create({ priority: "high", category: null, responseMinutes: 15, resolutionMinutes: 60 });

    const now = new Date("2026-01-01T00:00:00Z");
    const result = await resolveTicketSlaTargets({ priority: "high", category: "Unmapped category", now });

    expect(result.responseTargetAt.toISOString()).toBe("2026-01-01T00:15:00.000Z");
  });

  it("falls back to the (null, null) default row when nothing else matches", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });

    const now = new Date("2026-01-01T00:00:00Z");
    const result = await resolveTicketSlaTargets({ priority: "medium", category: null, now });

    expect(result.responseTargetAt.toISOString()).toBe("2026-01-01T01:00:00.000Z");
    expect(result.resolutionTargetAt.toISOString()).toBe("2026-01-01T08:00:00.000Z");
  });

  it("throws SlaTargetNotConfiguredError when no default row exists", async () => {
    await expect(resolveTicketSlaTargets({ priority: "medium", category: null })).rejects.toThrow(
      SlaTargetNotConfiguredError
    );
  });

  it("resolveConversationSlaTargets has no resolutionTargetAt and uses the default row", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });

    const now = new Date("2026-01-01T00:00:00Z");
    const result = await resolveConversationSlaTargets({ now });

    expect(result.responseTargetAt.toISOString()).toBe("2026-01-01T01:00:00.000Z");
    expect((result as { resolutionTargetAt?: Date }).resolutionTargetAt).toBeUndefined();
  });
});

describe("recomputeTicketSla (gap fix: priority/category can change post-creation via PATCH /tickets/:id)", () => {
  // Mongoose's `timestamps: true` marks `createdAt` immutable after insert —
  // any later `.set()`/direct assignment is silently ignored (verified: even
  // findByIdAndUpdate can't move it). So these assertions check the targets
  // against the ticket's REAL createdAt via arithmetic, rather than trying
  // to force createdAt to a fixed literal for a hardcoded-ISO-string check.
  async function seedTicket(overrides: Partial<{ category: string | null; priority: string }> = {}) {
    return Ticket.create({
      subject: "s",
      description: "d",
      customer: new mongoose.Types.ObjectId(),
      category: overrides.category ?? null,
      priority: overrides.priority ?? "medium",
      sla: {
        responseTargetAt: new Date(Date.now() + 60 * 60_000),
        resolutionTargetAt: new Date(Date.now() + 480 * 60_000),
        breached: false,
        atRiskAlerted: true,
      },
    });
  }

  it("recomputes both targets anchored on the ticket's createdAt (not the moment recompute runs) when priority now matches a stricter target", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });
    await SlaTarget.create({ priority: "high", category: null, responseMinutes: 5, resolutionMinutes: 15 });

    const ticket = await seedTicket({ priority: "medium" });
    ticket.priority = "high";
    await recomputeTicketSla(ticket);

    expect(ticket.sla.responseTargetAt!.getTime()).toBe(ticket.createdAt.getTime() + 5 * 60_000);
    expect(ticket.sla.resolutionTargetAt!.getTime()).toBe(ticket.createdAt.getTime() + 15 * 60_000);
  });

  it("resets atRiskAlerted to false so the monitor re-evaluates against the new target", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });

    const ticket = await seedTicket();
    expect(ticket.sla.atRiskAlerted).toBe(true);

    await recomputeTicketSla(ticket);

    expect(ticket.sla.atRiskAlerted).toBe(false);
  });

  it("picks up a category change the same way", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });
    await SlaTarget.create({ priority: null, category: "Billing", responseMinutes: 20, resolutionMinutes: 90 });

    const ticket = await seedTicket({ category: null });
    ticket.category = "Billing";
    await recomputeTicketSla(ticket);

    expect(ticket.sla.responseTargetAt!.getTime()).toBe(ticket.createdAt.getTime() + 20 * 60_000);
    expect(ticket.sla.resolutionTargetAt!.getTime()).toBe(ticket.createdAt.getTime() + 90 * 60_000);
  });

  it("is a no-op when the ticket is already breached — never un-breaches an escalated ticket", async () => {
    await SlaTarget.create({ priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 });
    await SlaTarget.create({ priority: "high", category: null, responseMinutes: 5, resolutionMinutes: 15 });

    const ticket = await seedTicket({ priority: "medium" });
    ticket.sla.breached = true;
    const before = { response: ticket.sla.responseTargetAt, resolution: ticket.sla.resolutionTargetAt };
    ticket.priority = "high";

    await recomputeTicketSla(ticket);

    expect(ticket.sla.responseTargetAt).toEqual(before.response);
    expect(ticket.sla.resolutionTargetAt).toEqual(before.resolution);
    expect(ticket.sla.breached).toBe(true);
  });
});
