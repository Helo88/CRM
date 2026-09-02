import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { SlaTarget } from "../../src/models/SlaTarget";
import {
  computeSlaStatus,
  resolveTicketSlaTargets,
  resolveConversationSlaTargets,
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
