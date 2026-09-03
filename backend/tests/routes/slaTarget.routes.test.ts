import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { SlaTarget } from "../../src/models/SlaTarget";
import { SlaTargetHistory } from "../../src/models/SlaTargetHistory";
import { SlaSystemSettings } from "../../src/models/SlaSystemSettings";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("sla-target-routes-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await SlaTarget.deleteMany({});
  await SlaTargetHistory.deleteMany({});
  await SlaSystemSettings.deleteMany({});
});

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

async function seedUser(overrides: Partial<{ role: string; email: string; permissions: string[] }> = {}) {
  const user = await User.create({
    name: "Test User",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "admin",
    permissions: overrides.permissions ?? [],
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

const DEFAULT_ROW = { priority: null, category: null, responseMinutes: 60, resolutionMinutes: 480 };

describe("GET /api/v1/sla-targets (sla-automation Story 25)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/sla-targets");
    expect(res.status).toBe(401);
  });

  it("returns 403 without sla:targets_view", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: [] });
    const res = await request(app).get("/api/v1/sla-targets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns an empty array before the seed row exists", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/sla-targets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns the seed wildcard row after it's created, flagged isDefault", async () => {
    await SlaTarget.create(DEFAULT_ROW);
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/sla-targets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ priority: null, category: null, isDefault: true });
  });

  it("a subadmin with sla:targets_view sees the list", async () => {
    await SlaTarget.create(DEFAULT_ROW);
    const { token } = await seedUser({ role: "subadmin", permissions: ["sla:targets_view"] });
    const res = await request(app).get("/api/v1/sla-targets").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v1/sla-targets", () => {
  it("creates a (priority, category) row as admin and writes a create history row", async () => {
    const { user, token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/sla-targets")
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "urgent", category: "Billing", responseMinutes: 15, resolutionMinutes: 120 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ priority: "urgent", category: "Billing", isDefault: false });

    const history = await SlaTargetHistory.find();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ action: "create", before: null });
    expect(history[0].changedBy.toString()).toBe(user.id);
  });

  it("returns 403 for an agent", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/sla-targets")
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 15, resolutionMinutes: 120 });
    expect(res.status).toBe(403);
  });

  it("returns 403 for a subadmin without sla:targets_edit", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: ["sla:targets_view"] });
    const res = await request(app)
      .post("/api/v1/sla-targets")
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 15, resolutionMinutes: 120 });
    expect(res.status).toBe(403);
  });

  it("returns 409 on a duplicate (priority, category) pair", async () => {
    await SlaTarget.create({ priority: "urgent", category: null, responseMinutes: 15, resolutionMinutes: 120 });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/sla-targets")
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "urgent", responseMinutes: 20, resolutionMinutes: 200 });
    expect(res.status).toBe(409);
  });

  it("returns 400 when resolutionMinutes < responseMinutes", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/sla-targets")
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 120, resolutionMinutes: 60 });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/v1/sla-targets/:id", () => {
  it("updates minutes and writes an update history row with before/after", async () => {
    const target = await SlaTarget.create({
      priority: "high",
      category: "Billing",
      responseMinutes: 30,
      resolutionMinutes: 240,
    });
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app)
      .patch(`/api/v1/sla-targets/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 45 });
    expect(res.status).toBe(200);
    expect(res.body.responseMinutes).toBe(45);

    const history = await SlaTargetHistory.find();
    expect(history).toHaveLength(1);
    expect(history[0].action).toBe("update");
    expect(history[0].before?.responseMinutes).toBe(30);
    expect(history[0].after?.responseMinutes).toBe(45);
  });

  it("no-ops fine when the default row's priority is patched to null (already null)", async () => {
    const target = await SlaTarget.create(DEFAULT_ROW);
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/sla-targets/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: null });
    expect(res.status).toBe(200);
  });

  it("returns 400 moving the default row's priority to a non-null value", async () => {
    const target = await SlaTarget.create(DEFAULT_ROW);
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/sla-targets/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/default sla target must remain/i);
  });

  it("returns 404 for an unknown id", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/sla-targets/${new mongoose.Types.ObjectId().toHexString()}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 10 });
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 500) for a malformed ObjectId", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch("/api/v1/sla-targets/not-an-object-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 10 });
    expect(res.status).toBe(404);
  });

  it("deactivated admin is 403 on mutation (regression guard)", async () => {
    const target = await SlaTarget.create(DEFAULT_ROW);
    const { user, token } = await seedUser({ role: "admin" });
    user.isActive = false;
    await user.save();
    const res = await request(app)
      .patch(`/api/v1/sla-targets/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ responseMinutes: 10 });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/v1/sla-targets/:id", () => {
  it("deletes a non-default row and writes a delete history row", async () => {
    const target = await SlaTarget.create({
      priority: "urgent",
      category: null,
      responseMinutes: 15,
      resolutionMinutes: 120,
    });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).delete(`/api/v1/sla-targets/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const history = await SlaTargetHistory.find();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ action: "delete", after: null });
  });

  it("refuses to delete the default row", async () => {
    const target = await SlaTarget.create(DEFAULT_ROW);
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).delete(`/api/v1/sla-targets/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 for an agent", async () => {
    const target = await SlaTarget.create({
      priority: "urgent",
      category: null,
      responseMinutes: 15,
      resolutionMinutes: 120,
    });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app).delete(`/api/v1/sla-targets/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/sla-targets/history", () => {
  it("returns 403 without sla:targets_view", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: [] });
    const res = await request(app).get("/api/v1/sla-targets/history").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns most-recent-first, capped at 200, populating changedBy", async () => {
    const { user, token } = await seedUser({ role: "admin" });
    const target = await SlaTarget.create(DEFAULT_ROW);
    await SlaTargetHistory.create({
      target: target._id,
      action: "create",
      before: null,
      after: DEFAULT_ROW,
      changedBy: user._id,
      changedAt: new Date(Date.now() - 1000),
    });
    await SlaTargetHistory.create({
      target: target._id,
      action: "update",
      before: DEFAULT_ROW,
      after: { ...DEFAULT_ROW, responseMinutes: 90 },
      changedBy: user._id,
      changedAt: new Date(),
    });

    const res = await request(app).get("/api/v1/sla-targets/history").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].action).toBe("update");
    expect(res.body[0].changedBy).toMatchObject({ name: user.name });
  });
});

describe("GET/PATCH /api/v1/sla-targets/settings (sla-automation Story 27 tuning)", () => {
  it("GET returns fallback defaults before any admin has saved settings", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/sla-targets/settings").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ atRiskPercent: 75, scanIntervalMinutes: 1 });
  });

  it("GET/PATCH both require sla:configure, not sla:targets_view/edit", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: ["sla:targets_view", "sla:targets_edit"] });
    const getRes = await request(app).get("/api/v1/sla-targets/settings").set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(403);
    const patchRes = await request(app)
      .patch("/api/v1/sla-targets/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ atRiskPercent: 80 });
    expect(patchRes.status).toBe(403);
  });

  it("PATCH updates and persists, and a later GET reflects it", async () => {
    const { token } = await seedUser({ role: "admin" });
    const patchRes = await request(app)
      .patch("/api/v1/sla-targets/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ atRiskPercent: 80, scanIntervalMinutes: 5 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body).toEqual({ atRiskPercent: 80, scanIntervalMinutes: 5 });

    const getRes = await request(app).get("/api/v1/sla-targets/settings").set("Authorization", `Bearer ${token}`);
    expect(getRes.body).toEqual({ atRiskPercent: 80, scanIntervalMinutes: 5 });
  });

  it("PATCH with neither field is 400", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch("/api/v1/sla-targets/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
