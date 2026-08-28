import fs from "fs";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { customerFilePath } from "../../src/middleware/upload";

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

async function seedUser(
  overrides: Partial<{ role: string; email: string; name: string; permissions: string[] }> = {}
) {
  const user = await User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "customer",
    permissions: overrides.permissions ?? [],
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("POST /api/v1/customers (Story 55)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/v1/customers")
      .send({ name: "New Customer", email: "new-customer@example.com", password: "password123" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a customer caller", async () => {
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Customer", email: "new-customer@example.com", password: "password123" });
    expect(res.status).toBe(403);
  });

  it("lets an agent create a customer with role always 'customer', never exposing passwordHash", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Walk-in", email: "walk-in@example.com", phone: "+201012345678", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("customer");
    expect(res.body.name).toBe("Walk-in");
    expect(res.body.phone).toBe("+201012345678");
    expect(res.body).not.toHaveProperty("passwordHash");

    const created = await User.findOne({ email: "walk-in@example.com" });
    expect(created?.role).toBe("customer");
  });

  it("the created customer can actually log in with the password given", async () => {
    const { token } = await seedUser({ role: "admin" });
    await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Walk-in", email: "loginable@example.com", password: "password123" });

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "loginable@example.com", password: "password123" });
    expect(loginRes.status).toBe(200);
  });

  it("returns 400 when name/email/password are missing", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Missing Fields" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for a too-short password", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Short Pw", email: "short-pw@example.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid phone", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Bad Phone", email: "bad-phone@example.com", phone: "abc", password: "password123" });
    expect(res.status).toBe(400);
  });

  // Regression: the old generic "7-15 digits" rule accepted this — a local
  // Egyptian number missing its leading 0, so not actually a real number.
  it("returns 400 for a 10-digit number missing the leading 0 (was wrongly accepted before)", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "No Leading Zero", email: "no-leading-zero@example.com", phone: "1032017366", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("accepts a real Egyptian mobile number in local and international format", async () => {
    const { token } = await seedUser({ role: "agent" });
    const local = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Local Format", email: "local-format@example.com", phone: "01032017366", password: "password123" });
    expect(local.status).toBe(201);

    const intl = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Intl Format", email: "intl-format@example.com", phone: "+201032017366", password: "password123" });
    expect(intl.status).toBe(201);
  });

  it("returns 409 for a duplicate email", async () => {
    const { user: existing } = await seedUser({ email: "taken-2@example.com" });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Dup", email: existing.email, password: "password123" });
    expect(res.status).toBe(409);
  });
});

// security-admin Story 46: subadmin is newly allowed here, delegable via
// customers:manage — agent and admin access must stay UNCHANGED from before
// this story (no regression against Story 55's already-working behavior).
describe("GET/POST /api/v1/customers — Story 46 permission gating", () => {
  it("agent passes with no customers:manage grant at all (no regression)", async () => {
    const { token } = await seedUser({ role: "agent" });
    const resGet = await request(app).get("/api/v1/customers").set("Authorization", `Bearer ${token}`);
    expect(resGet.status).toBe(200);

    const resPost = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Walk-in", email: "agent-unaffected@example.com", password: "password123" });
    expect(resPost.status).toBe(201);
  });

  it("admin passes with no customers:manage grant at all (no regression)", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/customers").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("subadmin is rejected without customers:manage", async () => {
    const { token } = await seedUser({ role: "subadmin" });
    const resGet = await request(app).get("/api/v1/customers").set("Authorization", `Bearer ${token}`);
    expect(resGet.status).toBe(403);

    const resPost = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope", email: "subadmin-no-permission@example.com", password: "password123" });
    expect(resPost.status).toBe(403);
  });

  it("subadmin is allowed once granted customers:manage on THEIR OWN account", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: ["customers:manage"] });
    const resGet = await request(app).get("/api/v1/customers").set("Authorization", `Bearer ${token}`);
    expect(resGet.status).toBe(200);

    const resPost = await request(app)
      .post("/api/v1/customers")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Delegated", email: "subadmin-granted@example.com", password: "password123" });
    expect(resPost.status).toBe(201);
  });

  it("a DIFFERENT subadmin without the grant is unaffected (per-individual, not per-role)", async () => {
    await seedUser({ role: "subadmin", permissions: ["customers:manage"] });
    const { token: plainSubadminToken } = await seedUser({ role: "subadmin" });
    const res = await request(app).get("/api/v1/customers").set("Authorization", `Bearer ${plainSubadminToken}`);
    expect(res.status).toBe(403);
  });
});

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

  it("lets a customer read their own profile — notes never included, attachments/idDocument are (Story 7)", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app).get(`/api/v1/customers/${user.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("passwordHash");
    expect(res.body).not.toHaveProperty("internalNotes");
    expect(res.body).toHaveProperty("attachments");
    expect(res.body).toHaveProperty("idDocument");
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

  it("lets a subadmin delegated customers:manage read a customer — same scope as the roster", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "subadmin", permissions: ["customers:manage"] });
    const res = await request(app).get(`/api/v1/customers/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("returns 403 for a subadmin without customers:manage", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "subadmin" });
    const res = await request(app).get(`/api/v1/customers/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/v1/customers/:id", () => {
  it("lets a customer patch their own name/phone/preferredLanguage", async () => {
    const { user, token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .patch(`/api/v1/customers/${user.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Updated Name", phone: "+201012345678", preferredLanguage: "ar" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.phone).toBe("+201012345678");
    expect(res.body.preferredLanguage).toBe("ar");
  });

  it("subadmin holding customers:manage can patch a customer; without it, 403 (Story 7 gap closed)", async () => {
    const { user: target } = await seedUser({ role: "customer" });
    const { token: grantedToken } = await seedUser({ role: "subadmin", permissions: ["customers:manage"] });
    const granted = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${grantedToken}`)
      .send({ name: "Renamed By Subadmin" });
    expect(granted.status).toBe(200);
    expect(granted.body.name).toBe("Renamed By Subadmin");

    const { token: plainToken } = await seedUser({ role: "subadmin" });
    const denied = await request(app)
      .patch(`/api/v1/customers/${target.id}`)
      .set("Authorization", `Bearer ${plainToken}`)
      .send({ name: "Should Be Rejected" });
    expect(denied.status).toBe(403);
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

describe("internal notes (Story 7)", () => {
  it("a customer viewer gets 403 (notes are staff-only writes)", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Should be rejected" });
    expect(res.status).toBe(403);
  });

  it("agent can add a note; response has the hydrated author name", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token, user: agent } = await seedUser({ role: "agent", name: "Agent Smith" });
    const res = await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Called about a billing issue." });
    expect(res.status).toBe(201);
    expect(res.body.text).toBe("Called about a billing issue.");
    expect(res.body.author).toEqual({ id: agent.id, name: "Agent Smith" });
  });

  it("agent's subsequent GET /:id includes the note, newest first, with hydrated author", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent", name: "Agent Smith" });
    await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "First note" });
    await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Second note" });

    const res = await request(app).get(`/api/v1/customers/${customer.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.internalNotes).toHaveLength(2);
    expect(res.body.internalNotes[0].text).toBe("Second note");
    expect(res.body.internalNotes[0].author.name).toBe("Agent Smith");
  });

  it("customer's own GET /:id never includes internalNotes", async () => {
    const { user: customer, token } = await seedUser({ role: "customer" });
    const { token: agentToken } = await seedUser({ role: "agent" });
    await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${agentToken}`)
      .send({ text: "A note the customer must never see" });

    const res = await request(app).get(`/api/v1/customers/${customer.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("internalNotes");
  });

  it("subadmin holding customers:manage can add a note; without it, 403", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token: grantedToken } = await seedUser({ role: "subadmin", permissions: ["customers:manage"] });
    const { token: plainToken } = await seedUser({ role: "subadmin" });

    const granted = await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${grantedToken}`)
      .send({ text: "Delegated note" });
    expect(granted.status).toBe(201);

    const denied = await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${plainToken}`)
      .send({ text: "Should be rejected" });
    expect(denied.status).toBe(403);
  });

  it("rejects empty text and text over 4000 characters", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });

    const empty = await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "   " });
    expect(empty.status).toBe(400);

    const tooLong = await request(app)
      .post(`/api/v1/customers/${customer.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "a".repeat(4001) });
    expect(tooLong.status).toBe(400);
  });
});

describe("general attachments (Story 7)", () => {
  it("a customer viewer gets 403 (uploads are staff-only writes)", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("contents"), "file.txt");
    expect(res.status).toBe(403);
  });

  it("agent uploads two files; response includes both, hydrated, pointing at the protected route", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token, user: agent } = await seedUser({ role: "agent", name: "Agent Smith" });

    const res = await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("file one contents"), "one.txt")
      .attach("files", Buffer.from("file two contents"), "two.txt");

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    for (const entry of res.body) {
      expect(entry).toHaveProperty("fileName");
      expect(entry).toHaveProperty("size");
      expect(entry.uploader).toEqual({ id: agent.id, name: "Agent Smith" });
      expect(entry.url).toBe(`/api/v1/customers/${customer.id}/attachments/${entry.id}`);
    }
  });

  it("a different customer (not staff, not the owner) gets 403; unauthenticated gets 401", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    const uploadRes = await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("contents"), "file.txt");
    const attachmentUrl = uploadRes.body[0].url;

    const { token: otherCustomerToken } = await seedUser({ role: "customer" });
    const forbidden = await request(app).get(attachmentUrl).set("Authorization", `Bearer ${otherCustomerToken}`);
    expect(forbidden.status).toBe(403);

    const unauthenticated = await request(app).get(attachmentUrl);
    expect(unauthenticated.status).toBe(401);
  });

  it("repeated uploads accumulate", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("first"), "first.txt");
    await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", Buffer.from("second"), "second.txt");

    const res = await request(app).get(`/api/v1/customers/${customer.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.attachments).toHaveLength(2);
  });

  it("a file over 10 MB is rejected with 413", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    const oversized = Buffer.alloc(11 * 1024 * 1024, "x");
    const res = await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${token}`)
      .attach("files", oversized, "too-big.bin");
    expect(res.status).toBe(413);
  });

  it("customer's own GET /:id includes their own attachments (not omitted)", async () => {
    const { user: customer, token } = await seedUser({ role: "customer" });
    const { token: agentToken } = await seedUser({ role: "agent" });
    await request(app)
      .post(`/api/v1/customers/${customer.id}/attachments`)
      .set("Authorization", `Bearer ${agentToken}`)
      .attach("files", Buffer.from("contents"), "file.txt");

    const res = await request(app).get(`/api/v1/customers/${customer.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.attachments).toHaveLength(1);
  });
});

describe("ID document (Story 7)", () => {
  it("a customer viewer gets 403 (replacement is a staff-only write)", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .put(`/api/v1/customers/${customer.id}/id-document`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("%PDF-1.4 contents"), "id.pdf");
    expect(res.status).toBe(403);
  });

  it("agent uploads a PDF; PUT /:id/id-document returns the hydrated document", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token, user: agent } = await seedUser({ role: "agent", name: "Agent Smith" });
    const res = await request(app)
      .put(`/api/v1/customers/${customer.id}/id-document`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("%PDF-1.4 fake pdf contents"), "id.pdf");
    expect(res.status).toBe(200);
    expect(res.body.fileName).toBe("id.pdf");
    expect(res.body.uploader).toEqual({ id: agent.id, name: "Agent Smith" });
  });

  it("a second upload replaces the first — the first stored file is deleted from disk", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });

    const first = await request(app)
      .put(`/api/v1/customers/${customer.id}/id-document`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("%PDF-1.4 first"), "first.pdf");
    const firstUser = await User.findById(customer.id);
    const firstPath = customerFilePath(customer.id, firstUser!.idDocument!.storageFileName);
    expect(fs.existsSync(firstPath)).toBe(true);

    const second = await request(app)
      .put(`/api/v1/customers/${customer.id}/id-document`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("%PDF-1.4 second"), "second.pdf");
    expect(second.status).toBe(200);
    expect(second.body.fileName).toBe("second.pdf");
    expect(second.body.id).not.toBe(first.body.id);

    // Best-effort cleanup runs after the response is sent (fire-and-forget) —
    // give it a tick to complete before asserting the file is gone.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fs.existsSync(firstPath)).toBe(false);
  });

  it("uploading a text file is rejected 400 UNSUPPORTED_FILE_TYPE", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .put(`/api/v1/customers/${customer.id}/id-document`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("plain text"), "not-allowed.txt");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("customer's own GET /:id includes their own idDocument", async () => {
    const { user: customer, token } = await seedUser({ role: "customer" });
    const { token: agentToken } = await seedUser({ role: "agent" });
    await request(app)
      .put(`/api/v1/customers/${customer.id}/id-document`)
      .set("Authorization", `Bearer ${agentToken}`)
      .attach("file", Buffer.from("%PDF-1.4 contents"), "id.pdf");

    const res = await request(app).get(`/api/v1/customers/${customer.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.idDocument).not.toBeNull();
    expect(res.body.idDocument.fileName).toBe("id.pdf");
  });
});
