import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("customer-routes-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

async function seedUser(overrides: Partial<{ role: string; email: string; name: string }> = {}) {
  const user = await User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "customer",
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("GET /api/v1/customers/:id", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/customers/000000000000000000000000");
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed id", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app).get("/api/v1/customers/not-an-id").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("lets a customer read their own profile, omitting internal fields", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app).get(`/api/v1/customers/${user.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("internalNotes");
    expect(res.body).not.toHaveProperty("attachments");
    expect(res.body.ticketHistoryUrl).toBe(`/api/v1/customers/${user.id}/history`);
  });

  it("returns 403 when a customer reads another customer", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app).get(`/api/v1/customers/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("lets an agent read any customer", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app).get(`/api/v1/customers/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("lets an admin read an agent (staff reading staff is allowed for GET)", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get(`/api/v1/customers/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/v1/customers/:id", () => {
  it("lets a customer patch their own name/phone/preferredLanguage", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .patch(`/api/v1/customers/${user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name", phone: "+15551234567", preferredLanguage: "ar" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.phone).toBe("+15551234567");
    expect(res.body.preferredLanguage).toBe("ar");
  });

  it("returns 403 when a customer patches another customer", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope" });
    expect(res.status).toBe(403);
  });

  it("lets an agent patch a customer", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Agent Edited" });
    expect(res.status).toBe(200);
  });

  it("returns 403 when an agent patches another agent (staff-on-staff blocked)", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope" });
    expect(res.status).toBe(403);
  });

  it("rejects a non-editable field like role", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .patch(`/api/v1/customers/${user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when a customer tries to change their own email here (Story 5 bypass fix)", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .patch(`/api/v1/customers/${user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@example.com" });
    expect(res.status).toBe(400);
  });

  it("returns 409 when staff PATCHes a customer's email to one already in use", async () => {
    const { user: other } = await seedUser({ role: "customer", email: "taken@example.com" });
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "taken@example.com" });
    expect(res.status).toBe(409);
    expect(other.email).toBe("taken@example.com");
  });

  it("lets staff change a customer's email immediately (different trust boundary than self-edit)", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "corrected@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("corrected@example.com");
  });

  it("returns 400 for an empty body", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app).patch(`/api/v1/customers/${user.id}`).set("Authorization", `Bearer ${token}`).send({});
    expect(res.status).toBe(400);
  });

  it("clears phone when set to null", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .patch(`/api/v1/customers/${user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: null });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBeNull();
  });
});
