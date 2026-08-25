import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { requireAuth, requireRole } from "../../src/middleware/auth";
import type { UserRole } from "../../src/models/User";

function signToken(role: string) {
  return jwt.sign({ sub: "user-123", role }, process.env.JWT_SECRET as string);
}

function buildApp(...allowedRoles: UserRole[]) {
  const app = express();
  app.get("/restricted", requireAuth, requireRole(...allowedRoles), (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

async function callAs(app: express.Express, role: string) {
  return request(app).get("/restricted").set("Authorization", `Bearer ${signToken(role)}`);
}

describe("requireRole", () => {
  it("requireRole('customer') allows only customer", async () => {
    const app = buildApp("customer");
    expect((await callAs(app, "customer")).status).toBe(200);
    expect((await callAs(app, "agent")).status).toBe(403);
    expect((await callAs(app, "admin")).status).toBe(403);
  });

  it("requireRole('agent','admin') allows agent and admin, rejects customer", async () => {
    const app = buildApp("agent", "admin");
    expect((await callAs(app, "customer")).status).toBe(403);
    expect((await callAs(app, "agent")).status).toBe(200);
    expect((await callAs(app, "admin")).status).toBe(200);
  });

  it("requireRole('admin') allows only admin", async () => {
    const app = buildApp("admin");
    expect((await callAs(app, "customer")).status).toBe(403);
    expect((await callAs(app, "agent")).status).toBe(403);
    expect((await callAs(app, "admin")).status).toBe(200);
  });

  it("returns the exact 403 error body", async () => {
    const app = buildApp("admin");
    const res = await callAs(app, "customer");
    expect(res.body).toEqual({ error: "You do not have permission to perform this action" });
  });

  it("rejects a token with an unexpected role value not in the allow-list", async () => {
    const app = buildApp("customer", "agent", "admin");
    const res = await callAs(app, "superadmin");
    expect(res.status).toBe(403);
  });

  it("fails closed with 403 when used without a preceding requireAuth", async () => {
    const app = express();
    app.get("/no-auth-first", requireRole("admin"), (req, res) => {
      res.status(200).json({ ok: true });
    });
    const res = await request(app).get("/no-auth-first");
    expect(res.status).toBe(403);
  });
});
