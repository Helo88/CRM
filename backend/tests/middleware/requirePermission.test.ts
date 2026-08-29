import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { requireAuth, requirePermission } from "../../src/middleware/auth";
import { User } from "../../src/models/User";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("require-permission-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

async function seedUser(role: string, permissions: string[] = []) {
  const user = await User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role,
    permissions,
  });
  return user;
}

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

function buildApp() {
  const app = express();
  app.get("/restricted", requireAuth, requirePermission("staff:view_list"), (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

async function callAsToken(app: express.Express, token?: string) {
  const req = request(app).get("/restricted");
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

describe("requirePermission", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await callAsToken(buildApp());
    expect(res.status).toBe(401);
  });

  it("admin always passes, regardless of their own permissions field", async () => {
    const admin = await seedUser("admin");
    const res = await callAsToken(buildApp(), tokenFor({ id: admin.id, role: admin.role }));
    expect(res.status).toBe(200);
  });

  it("rejects 'customer' outright, without a DB lookup", async () => {
    // Deliberately using a token whose sub does not exist in the DB —
    // proves customer is rejected by role alone, never reaching hasPermission.
    const res = await callAsToken(buildApp(), jwt.sign({ sub: "000000000000000000000000", role: "customer" }, process.env.JWT_SECRET as string));
    expect(res.status).toBe(403);
  });

  it("rejects an unexpected role value not in the recognized set", async () => {
    const res = await callAsToken(
      buildApp(),
      jwt.sign({ sub: "000000000000000000000000", role: "superadmin" }, process.env.JWT_SECRET as string)
    );
    expect(res.status).toBe(403);
  });

  it("agent passes when the key is in THEIR OWN permissions array", async () => {
    const agent = await seedUser("agent", ["staff:view_list"]);
    const res = await callAsToken(buildApp(), tokenFor({ id: agent.id, role: agent.role }));
    expect(res.status).toBe(200);
  });

  it("agent is rejected when the key is not in their permissions array", async () => {
    const agent = await seedUser("agent", ["reports:view"]);
    const res = await callAsToken(buildApp(), tokenFor({ id: agent.id, role: agent.role }));
    expect(res.status).toBe(403);
  });

  it("one agent's grant does not affect another agent (per-individual, not per-role)", async () => {
    const grantedAgent = await seedUser("agent", ["staff:view_list"]);
    const plainAgent = await seedUser("agent", []);
    const resGranted = await callAsToken(buildApp(), tokenFor({ id: grantedAgent.id, role: grantedAgent.role }));
    const resPlain = await callAsToken(buildApp(), tokenFor({ id: plainAgent.id, role: plainAgent.role }));
    expect(resGranted.status).toBe(200);
    expect(resPlain.status).toBe(403);
  });

  it("subadmin with an empty permissions array is rejected for every key", async () => {
    const subadmin = await seedUser("subadmin", []);
    const res = await callAsToken(buildApp(), tokenFor({ id: subadmin.id, role: subadmin.role }));
    expect(res.status).toBe(403);
  });

  it("subadmin passes once granted the key on their own account", async () => {
    const subadmin = await seedUser("subadmin", ["staff:view_list"]);
    const res = await callAsToken(buildApp(), tokenFor({ id: subadmin.id, role: subadmin.role }));
    expect(res.status).toBe(200);
  });

  it("fails closed with 401 when used without a preceding requireAuth", async () => {
    const app = express();
    app.get("/no-auth-first", requirePermission("staff:view_list"), (req, res) => {
      res.status(200).json({ ok: true });
    });
    const res = await request(app).get("/no-auth-first");
    expect(res.status).toBe(401);
  });
});
