import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { requireAuth } from "../../src/middleware/auth";
import type { UserRole } from "../../src/models/User";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.get("/protected", requireAuth, (req, res) => {
    res.status(200).json({ user: req.user });
  });
  return app;
}

function signToken(payload: Record<string, unknown>, secret = process.env.JWT_SECRET as string) {
  return jwt.sign(payload, secret);
}

describe("requireAuth", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(buildApp()).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Missing or invalid Authorization header" });
  });

  it("returns 401 when the header does not start with 'Bearer '", async () => {
    const res = await request(buildApp()).get("/protected").set("Authorization", "Token abc");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Missing or invalid Authorization header" });
  });

  it("returns 401 when the token is malformed", async () => {
    const res = await request(buildApp()).get("/protected").set("Authorization", "Bearer not.a.jwt");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
  });

  it("returns 401 when the token is signed with a different secret", async () => {
    const token = signToken({ sub: "u1", role: "customer" }, "wrong-secret");
    const res = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
  });

  it("returns 401 when the token is expired", async () => {
    const token = signToken({ sub: "u1", role: "customer", exp: Math.floor(Date.now() / 1000) - 10 });
    const res = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid or expired token" });
  });

  it.each<UserRole>(["customer", "agent", "admin"])(
    "returns 200 and attaches req.user for a valid %s token",
    async (role) => {
      const token = signToken({ sub: "user-123", role });
      const res = await request(buildApp()).get("/protected").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({ id: "user-123", role });
    }
  );

  it("reads role only from the verified JWT payload, never body/query/headers", async () => {
    const token = signToken({ sub: "user-123", role: "customer" });
    const res = await request(buildApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Role", "admin")
      .query({ role: "admin" })
      .send({ role: "admin" });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("customer");
  });
});
