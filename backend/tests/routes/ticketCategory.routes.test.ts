import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { TicketCategory } from "../../src/models/TicketCategory";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("ticket-category-routes-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await TicketCategory.deleteMany({});
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

describe("GET /api/v1/ticket-categories (Story 58)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/ticket-categories");
    expect(res.status).toBe(401);
  });

  it("?active=true is open to any authenticated role — a plain customer can read the picker list", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    await TicketCategory.create({ name: "Old category", active: false });
    const { token } = await seedUser({ role: "customer" });

    const res = await request(app)
      .get("/api/v1/ticket-categories?active=true")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Billing");
  });

  it("the default (full) list requires tickets:categories_view — a plain customer is 403", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "customer" });

    const res = await request(app).get("/api/v1/ticket-categories").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("an admin sees the full list (active and inactive), serialized without __v/_id", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    await TicketCategory.create({ name: "Old category", active: false });
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app).get("/api/v1/ticket-categories").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).not.toHaveProperty("__v");
    expect(res.body[0]).not.toHaveProperty("_id");
  });

  it("a subadmin with tickets:categories_view sees the full list", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "subadmin", permissions: ["tickets:categories_view"] });

    const res = await request(app).get("/api/v1/ticket-categories").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("a subadmin without tickets:categories_view is 403 on the full list", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: [] });
    const res = await request(app).get("/api/v1/ticket-categories").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/v1/ticket-categories (Story 58)", () => {
  it("lets an admin create a category", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Billing", active: true });
  });

  it("returns 403 for an agent (never holds tickets:categories_create)", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing" });
    expect(res.status).toBe(403);
  });

  it("lets a subadmin with tickets:categories_create create a category", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: ["tickets:categories_create"] });
    const res = await request(app)
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing" });
    expect(res.status).toBe(201);
  });

  it("returns 403 for a subadmin without tickets:categories_create", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: [] });
    const res = await request(app)
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing" });
    expect(res.status).toBe(403);
  });

  it("returns 409 for a case-insensitive duplicate name", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "billing" });
    expect(res.status).toBe(409);
  });

  it("returns 409 with a reactivate hint when the duplicate is inactive", async () => {
    await TicketCategory.create({ name: "Billing", active: false });
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/ticket-categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "billing" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/reactivate/i);
  });
});

describe("PATCH /api/v1/ticket-categories/:id (Story 58)", () => {
  it("renames a category (admin, implicit pass)", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing (finance)" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Billing (finance)");
  });

  it("returns 403 renaming without tickets:categories_edit", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "subadmin", permissions: [] });
    const res = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing (finance)" });
    expect(res.status).toBe(403);
  });

  it("lets a subadmin with only tickets:categories_edit rename (but not toggle status)", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "subadmin", permissions: ["tickets:categories_edit"] });

    const renameRes = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing (finance)" });
    expect(renameRes.status).toBe(200);

    const toggleRes = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(toggleRes.status).toBe(403);
  });

  it("returns 409 when renaming to a name that collides with another row", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const other = await TicketCategory.create({ name: "Technical", active: true });
    const { token } = await seedUser();
    const res = await request(app)
      .patch(`/api/v1/ticket-categories/${other.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "billing" });
    expect(res.status).toBe(409);
  });

  it("toggles active off (admin, implicit pass), and the deactivated row no longer appears in ?active=true", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "admin" });

    const patchRes = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.active).toBe(false);

    const listRes = await request(app)
      .get("/api/v1/ticket-categories?active=true")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.body).toHaveLength(0);
  });

  it("returns 403 toggling status without tickets:categories_toggle_status", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "subadmin", permissions: [] });
    const res = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(res.status).toBe(403);
  });

  it("lets a subadmin with only tickets:categories_toggle_status toggle (but not rename)", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser({ role: "subadmin", permissions: ["tickets:categories_toggle_status"] });

    const toggleRes = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false });
    expect(toggleRes.status).toBe(200);

    const renameRes = await request(app)
      .patch(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Billing (finance)" });
    expect(renameRes.status).toBe(403);
  });

  it("returns 404 for an unknown id", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .patch(`/api/v1/ticket-categories/${new mongoose.Types.ObjectId().toHexString()}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Whatever" });
    expect(res.status).toBe(404);
  });

  it("returns 404 (not 500) for a malformed ObjectId", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .patch("/api/v1/ticket-categories/not-an-object-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Whatever" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/ticket-categories/:id (Story 58 regression)", () => {
  it("returns 404 — the collection is soft-delete-only, no DELETE route exists", async () => {
    const category = await TicketCategory.create({ name: "Billing", active: true });
    const { token } = await seedUser();
    const res = await request(app)
      .delete(`/api/v1/ticket-categories/${category.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
