import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { AuditLog } from "../../src/models/AuditLog";

// security-admin Story 47: proof-of-pattern audit-log wiring into the 3
// concrete call sites — login success/failure (auth.routes.ts), permission
// grant/revoke and staff activate/deactivate (admin.routes.ts).
const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("audit-wiring-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await AuditLog.deleteMany({});
});

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

async function seedUser(
  overrides: Partial<{
    role: string;
    email: string;
    name: string;
    isActive: boolean;
    permissions: string[];
    password: string;
  }> = {}
) {
  const passwordHash = await bcrypt.hash(overrides.password ?? "password123", 4);
  const user = await User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash,
    role: overrides.role ?? "customer",
    isActive: overrides.isActive ?? true,
    permissions: overrides.permissions ?? [],
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("POST /api/v1/auth/login audit wiring", () => {
  it("records a login_success entry on successful login", async () => {
    const { user } = await seedUser({ email: "success@example.com", password: "password123" });
    const res = await request(app).post("/api/v1/auth/login").send({ email: "success@example.com", password: "password123" });
    expect(res.status).toBe(200);

    const entries = await AuditLog.find({});
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("login_success");
    expect(String(entries[0].actor)).toBe(String(user._id));
  });

  it("records a login_failed entry with actor null and attemptedEmail for an unknown email", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "whatever123" });
    expect(res.status).toBe(401);

    const entries = await AuditLog.find({});
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("login_failed");
    expect(entries[0].actor).toBeNull();
    expect(entries[0].metadata.reason).toBe("unknown_email");
    expect(entries[0].metadata.attemptedEmail).toBe("nobody@example.com");
  });

  it("records a login_failed entry with reason wrong_password for an existing user", async () => {
    const { user } = await seedUser({ email: "wrongpw@example.com", password: "correct-password" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "wrongpw@example.com", password: "incorrect-password" });
    expect(res.status).toBe(401);

    const entries = await AuditLog.find({});
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("login_failed");
    expect(entries[0].metadata.reason).toBe("wrong_password");
    expect(String(entries[0].actor)).toBe(String(user._id));
  });

  it("records a login_failed entry with reason account_deactivated for a correct password on a deactivated account", async () => {
    await seedUser({ email: "deactivated@example.com", password: "password123", isActive: false });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "deactivated@example.com", password: "password123" });
    expect(res.status).toBe(403);

    const entries = await AuditLog.find({});
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("login_failed");
    expect(entries[0].metadata.reason).toBe("account_deactivated");
  });
});

describe("PATCH /api/v1/admin/users/:id audit wiring (permission changes)", () => {
  it("records a permissions_changed entry with before/after metadata", async () => {
    const { token } = await seedUser({ role: "admin" });
    const { user: target } = await seedUser({ role: "agent", permissions: ["reports:view"] });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissions: ["tickets:reassign"] });
    expect(res.status).toBe(200);

    const entries = await AuditLog.find({ action: "permissions_changed" });
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata.before).toEqual(["reports:view"]);
    expect(entries[0].metadata.after).toEqual(["tickets:reassign"]);
    expect(String(entries[0].targetId)).toBe(String(target._id));
  });

  it("does not record a permissions_changed entry when only name/email/role are edited", async () => {
    const { token } = await seedUser({ role: "admin" });
    const { user: target } = await seedUser({ role: "agent" });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed" });
    expect(res.status).toBe(200);

    const entries = await AuditLog.find({ action: "permissions_changed" });
    expect(entries).toHaveLength(0);
  });
});

describe("PATCH /api/v1/admin/users/:id/(de)activate audit wiring", () => {
  it("records a staff_deactivated entry", async () => {
    const { token } = await seedUser({ role: "admin" });
    const { user: target } = await seedUser({ role: "agent" });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const entries = await AuditLog.find({ action: "staff_deactivated" });
    expect(entries).toHaveLength(1);
    expect(String(entries[0].targetId)).toBe(String(target._id));
  });

  it("records a staff_activated entry", async () => {
    const { token } = await seedUser({ role: "admin" });
    const { user: target } = await seedUser({ role: "agent", isActive: false });

    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/activate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);

    const entries = await AuditLog.find({ action: "staff_activated" });
    expect(entries).toHaveLength(1);
    expect(String(entries[0].targetId)).toBe(String(target._id));
  });
});
