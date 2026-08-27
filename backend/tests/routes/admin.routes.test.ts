import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("admin-routes-test"));
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
  overrides: Partial<{
    role: string;
    email: string;
    name: string;
    isActive: boolean;
    isOnline: boolean;
    isDeleted: boolean;
    permissions: string[];
  }> = {}
) {
  const user = await User.create({
    name: overrides.name ?? "Test User",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "customer",
    isActive: overrides.isActive ?? true,
    isOnline: overrides.isOnline ?? false,
    isDeleted: overrides.isDeleted ?? false,
    permissions: overrides.permissions ?? [],
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("GET /api/v1/admin/users (Story 45)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/admin/users");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a customer or agent token", async () => {
    const { token: customerToken } = await seedUser({ role: "customer" });
    const resCustomer = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${customerToken}`);
    expect(resCustomer.status).toBe(403);

    const { token: agentToken } = await seedUser({ role: "agent" });
    const resAgent = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${agentToken}`);
    expect(resAgent.status).toBe(403);
  });

  it("returns a paginated roster of staff accounts only, with permissions, never exposing passwordHash", async () => {
    await seedUser({ role: "agent", email: "agent@example.com", permissions: ["tickets:reassign"] });
    await seedUser({ role: "admin", email: "admin@example.com" });
    await seedUser({ role: "subadmin", email: "subadmin@example.com" });
    await seedUser({ role: "customer", email: "customer@example.com" });
    const { token } = await seedUser({ role: "admin", email: "caller@example.com" });

    const res = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4); // agent, admin, subadmin, caller — not the customer
    const byEmail = Object.fromEntries(res.body.users.map((u: { email: string }) => [u.email, u]));
    expect(byEmail["agent@example.com"].permissions).toEqual(["tickets:reassign"]);
    expect(byEmail["customer@example.com"]).toBeUndefined();
    res.body.users.forEach((u: Record<string, unknown>) => expect(u).not.toHaveProperty("passwordHash"));
  });

  it("excludes soft-deleted accounts", async () => {
    await seedUser({ role: "agent", email: "deleted-agent@example.com", isDeleted: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);
    const emails = res.body.users.map((u: { email: string }) => u.email);
    expect(emails).not.toContain("deleted-agent@example.com");
  });
});

describe("GET /api/v1/admin/users/:id (Story 45)", () => {
  it("returns a single staff account's detail, including permissions", async () => {
    const { user: target } = await seedUser({ role: "agent", permissions: ["reports:view"] });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get(`/api/v1/admin/users/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.permissions).toEqual(["reports:view"]);
  });

  it("returns 404 for a soft-deleted account", async () => {
    const { user: target } = await seedUser({ role: "agent", isDeleted: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).get(`/api/v1/admin/users/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/admin/users (Story 45)", () => {
  it("returns 401 without a token, 403 for a non-admin", async () => {
    const res401 = await request(app)
      .post("/api/v1/admin/users")
      .send({ name: "New Agent", email: "new-agent@example.com", password: "password123", role: "agent" });
    expect(res401.status).toBe(401);

    const { token } = await seedUser({ role: "agent" });
    const res403 = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Agent", email: "new-agent-2@example.com", password: "password123", role: "agent" });
    expect(res403.status).toBe(403);
  });

  it("creates an agent account with a hashed password and the given permissions", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "New Agent",
        email: "new-agent@example.com",
        password: "password123",
        role: "agent",
        permissions: ["tickets:reassign", "reports:view"],
      });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("agent");
    expect(res.body.permissions.sort()).toEqual(["reports:view", "tickets:reassign"]);
    expect(res.body).not.toHaveProperty("passwordHash");

    const created = await User.findOne({ email: "new-agent@example.com" });
    expect(created?.role).toBe("agent");
    expect(await bcrypt.compare("password123", created!.passwordHash)).toBe(true);
  });

  it("defaults to no permissions when omitted", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Agent", email: "no-perms@example.com", password: "password123", role: "agent" });
    expect(res.status).toBe(201);
    expect(res.body.permissions).toEqual([]);
  });

  it("rejects an unknown permission key", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Bad Perms",
        email: "bad-perms@example.com",
        password: "password123",
        role: "agent",
        permissions: ["not:a-real-key"],
      });
    expect(res.status).toBe(400);
  });

  it("creates a sub-admin account", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Subadmin", email: "new-subadmin@example.com", password: "password123", role: "subadmin" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("subadmin");
  });

  it("rejects role: 'customer'", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope", email: "nope-customer@example.com", password: "password123", role: "customer" });
    expect(res.status).toBe(400);
  });

  it("rejects role: 'admin' — there is no in-app way to create a full admin account", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope", email: "nope-admin@example.com", password: "password123", role: "admin" });
    expect(res.status).toBe(400);

    const created = await User.findOne({ email: "nope-admin@example.com" });
    expect(created).toBeNull();
  });

  it("rejects a missing or too-short password", async () => {
    const { token } = await seedUser({ role: "admin" });
    const resMissing = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "No Password", email: "no-password@example.com", role: "agent" });
    expect(resMissing.status).toBe(400);

    const resShort = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Short Pw", email: "short-pw@example.com", password: "short", role: "agent" });
    expect(resShort.status).toBe(400);
  });

  it("returns 409 for a duplicate email", async () => {
    const { user: existing } = await seedUser({ role: "agent", email: "taken@example.com" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Dup", email: existing.email, password: "password123", role: "agent" });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/v1/admin/users/:id (edit, Story 46 addendum)", () => {
  it("returns 401 without a token, 403 for a non-admin without users:manage", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const res401 = await request(app).patch(`/api/v1/admin/users/${target.id}`).send({ name: "Nope" });
    expect(res401.status).toBe(401);

    const { token } = await seedUser({ role: "agent" });
    const res403 = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope" });
    expect(res403.status).toBe(403);
  });

  it("admin can edit an agent's name, email, role, and permissions", async () => {
    const { user: target } = await seedUser({ role: "agent", permissions: ["reports:view"] });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Renamed Agent",
        email: "renamed-agent@example.com",
        role: "subadmin",
        permissions: ["users:manage"],
      });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Agent");
    expect(res.body.email).toBe("renamed-agent@example.com");
    expect(res.body.role).toBe("subadmin");
    expect(res.body.permissions).toEqual(["users:manage"]);
  });

  it("partial update only touches the provided fields", async () => {
    const { user: target } = await seedUser({ role: "agent", name: "Original Name", permissions: ["reports:view"] });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissions: ["users:manage"] });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Original Name");
    expect(res.body.permissions).toEqual(["users:manage"]);
  });

  it("cannot edit an admin account", async () => {
    const { user: target } = await seedUser({ role: "admin" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope" });
    expect(res.status).toBe(400);
  });

  it("cannot edit role to 'admin'", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "admin" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown permission key", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissions: ["not:a-real-key"] });
    expect(res.status).toBe(400);
  });

  it("returns 409 when editing to an email already in use", async () => {
    const { user: other } = await seedUser({ role: "agent", email: "already-taken@example.com" });
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ email: other.email });
    expect(res.status).toBe(409);
  });

  it("subadmin granted users:manage can edit an agent's permissions", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "subadmin", permissions: ["users:manage"] });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ permissions: ["tickets:reassign"] });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/v1/admin/users/:id/deactivate (Story 45)", () => {
  it("returns 401 without a token, 403 for a non-admin", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const res401 = await request(app).patch(`/api/v1/admin/users/${target.id}/deactivate`);
    expect(res401.status).toBe(401);

    const { token } = await seedUser({ role: "agent" });
    const res403 = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res403.status).toBe(403);
  });

  it("deactivates an agent and forces isOnline false", async () => {
    const { user: target } = await seedUser({ role: "agent", isActive: true, isOnline: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(res.body.isOnline).toBe(false);

    const refetched = await User.findById(target.id);
    expect(refetched?.isActive).toBe(false);
    expect(refetched?.isOnline).toBe(false);
  });

  it("deactivates a sub-admin without touching isOnline", async () => {
    const { user: target } = await seedUser({ role: "subadmin", isActive: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(res.body.isOnline).toBe(false); // schema default, never explicitly set true here
  });

  it("deactivates an admin account (only reachable by a true admin caller today)", async () => {
    const { user: target } = await seedUser({ role: "admin", isActive: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it("returns 404 for a customer id (indistinguishable from a nonexistent id)", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${customer.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a nonexistent id", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch("/api/v1/admin/users/000000000000000000000000/deactivate")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch("/api/v1/admin/users/not-an-id/deactivate")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("is idempotent when the account is already inactive", async () => {
    const { user: target } = await seedUser({ role: "agent", isActive: false, isOnline: false });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });
});

describe("PATCH /api/v1/admin/users/:id/activate (Story 45 addendum)", () => {
  it("reactivates a deactivated agent", async () => {
    const { user: target } = await seedUser({ role: "agent", isActive: false });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/activate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it("subadmin without users:manage cannot activate", async () => {
    const { user: target } = await seedUser({ role: "agent", isActive: false });
    const { token } = await seedUser({ role: "subadmin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/activate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("subadmin with users:manage cannot activate an admin account — same cap as deactivate", async () => {
    const { user: target } = await seedUser({ role: "admin", isActive: false });
    const { token } = await seedUser({ role: "subadmin", permissions: ["users:manage"] });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/activate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/v1/admin/users/:id (soft delete, Story 45 addendum)", () => {
  it("returns 401 without a token, 403 for a non-admin", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const res401 = await request(app).delete(`/api/v1/admin/users/${target.id}`);
    expect(res401.status).toBe(401);

    const { token } = await seedUser({ role: "agent" });
    const res403 = await request(app).delete(`/api/v1/admin/users/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res403.status).toBe(403);
  });

  it("soft-deletes an agent — hidden from roster, but the document remains", async () => {
    const { user: target } = await seedUser({ role: "agent", isActive: true, isOnline: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).delete(`/api/v1/admin/users/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const refetched = await User.findById(target.id);
    expect(refetched).not.toBeNull();
    expect(refetched?.isDeleted).toBe(true);
    expect(refetched?.isActive).toBe(false);
    expect(refetched?.isOnline).toBe(false);

    const rosterRes = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);
    expect(rosterRes.body.users.map((u: { id: string }) => u.id)).not.toContain(target.id);
  });

  it("subadmin with users:manage CANNOT delete an existing admin account — the load-bearing cap", async () => {
    const { user: adminTarget } = await seedUser({ role: "admin" });
    const { token } = await seedUser({ role: "subadmin", permissions: ["users:manage"] });
    const res = await request(app)
      .delete(`/api/v1/admin/users/${adminTarget.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);

    const refetched = await User.findById(adminTarget.id);
    expect(refetched?.isDeleted).toBe(false);
  });

  it("a true admin can delete an existing admin account, unaffected by the cap", async () => {
    const { user: adminTarget } = await seedUser({ role: "admin" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .delete(`/api/v1/admin/users/${adminTarget.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("returns 404 when deleting an already-deleted account", async () => {
    const { user: target } = await seedUser({ role: "agent", isDeleted: true });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app).delete(`/api/v1/admin/users/${target.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// security-admin Story 46: permissions are granted PER INDIVIDUAL agent/
// sub-admin account, not per role. Except acting on an existing "admin"
// account, which stays admin-only forever, regardless of the permission.
// This is the load-bearing cap the whole delegation design depends on.
describe("Story 46 permission gating on /api/v1/admin/users* (per-individual)", () => {
  it("subadmin without users:manage is rejected on GET/POST/PATCH, same as before this story", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "subadmin" });

    expect((await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`)).status).toBe(403);
    expect(
      (
        await request(app)
          .post("/api/v1/admin/users")
          .set("Authorization", `Bearer ${token}`)
          .send({ name: "Nope", email: "subadmin-no-perm@example.com", password: "password123", role: "agent" })
      ).status
    ).toBe(403);
    expect(
      (await request(app).patch(`/api/v1/admin/users/${target.id}/deactivate`).set("Authorization", `Bearer ${token}`))
        .status
    ).toBe(403);
  });

  it("subadmin granted users:manage on THEIR OWN account can view, create, and deactivate", async () => {
    const { user: target } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "subadmin", permissions: ["users:manage"] });

    const resGet = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);
    expect(resGet.status).toBe(200);

    const resPost = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Delegated Hire", email: "delegated-hire@example.com", password: "password123", role: "agent" });
    expect(resPost.status).toBe(201);

    const resPatch = await request(app)
      .patch(`/api/v1/admin/users/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(resPatch.status).toBe(200);
  });

  it("a DIFFERENT subadmin without the grant is unaffected (per-individual, not per-role)", async () => {
    await seedUser({ role: "subadmin", permissions: ["users:manage"] });
    const { token: plainSubadminToken } = await seedUser({ role: "subadmin" });
    const res = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${plainSubadminToken}`);
    expect(res.status).toBe(403);
  });

  it("subadmin with users:manage still CANNOT create role: 'admin' (no cap needed — it's simply not creatable)", async () => {
    const { token } = await seedUser({ role: "subadmin", permissions: ["users:manage"] });
    const res = await request(app)
      .post("/api/v1/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Nope", email: "subadmin-cant-make-admin@example.com", password: "password123", role: "admin" });
    expect(res.status).toBe(400);
  });

  it("subadmin with users:manage CANNOT deactivate an existing admin account — the load-bearing cap", async () => {
    const { user: adminTarget } = await seedUser({ role: "admin" });
    const { token } = await seedUser({ role: "subadmin", permissions: ["users:manage"] });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminTarget.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);

    const refetched = await User.findById(adminTarget.id);
    expect(refetched?.isActive).toBe(true); // untouched
  });

  it("a true admin can still deactivate an existing admin account, unaffected by the cap", async () => {
    const { user: adminTarget } = await seedUser({ role: "admin" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .patch(`/api/v1/admin/users/${adminTarget.id}/deactivate`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("agent granted users:manage on their own account can also be delegated (permission is not subadmin-exclusive)", async () => {
    const { token } = await seedUser({ role: "agent", permissions: ["users:manage"] });
    const res = await request(app).get("/api/v1/admin/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
