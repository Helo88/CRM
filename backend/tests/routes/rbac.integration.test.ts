import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app";

const app = createApp();

function tokenFor(role: string) {
  return jwt.sign({ sub: "user-123", role }, process.env.JWT_SECRET as string);
}

const AUTH = {
  none: undefined,
  customer: tokenFor("customer"),
  agent: tokenFor("agent"),
  admin: tokenFor("admin"),
} as const;

async function call(method: "get" | "post", path: string, tokenKey: keyof typeof AUTH) {
  const req = request(app)[method](path);
  const token = AUTH[tokenKey];
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

// Routes below are still 501 stubs (ticket-management/live-chat implementation
// stories haven't executed yet) — RBAC runs before the handler body, so a
// wrong-role call must see 403, and a right-role call sees 501 (proving RBAC
// passed through to the stub), not the reverse.
describe("RBAC across mounted routes", () => {
  it.each([
    ["post", "/api/v1/tickets", { none: 401, customer: 501, agent: 403, admin: 403 }],
    ["get", "/api/v1/tickets", { none: 401, customer: 501, agent: 501, admin: 501 }],
    ["post", "/api/v1/conversations", { none: 401, customer: 501, agent: 403, admin: 403 }],
    ["post", "/api/v1/conversations/abc/escalate", { none: 401, customer: 501, agent: 403, admin: 403 }],
  ] as const)("%s %s", async (method, path, expected) => {
    for (const [tokenKey, expectedStatus] of Object.entries(expected) as [keyof typeof AUTH, number][]) {
      const res = await call(method, path, tokenKey);
      expect(res.status).toBe(expectedStatus);
    }
  });

  it("401 responses carry the requireAuth error body", async () => {
    const res = await call("get", "/api/v1/tickets", "none");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Missing or invalid Authorization header" });
  });

  it("403 responses carry the requireRole error body", async () => {
    const res = await call("post", "/api/v1/tickets", "agent");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "You do not have permission to perform this action" });
  });

  // /register and /login are intentionally public (they're the entry points
  // that MINT tokens) — this suite proves they are never RBAC-gated, without
  // depending on a live MongoDB connection: an empty body fails validation
  // synchronously, before either handler makes any DB call.
  describe("auth entry points are not RBAC-protected", () => {
    it.each(["none", "customer", "agent", "admin"] as const)(
      "POST /api/v1/auth/register never 401s from missing auth (as %s)",
      async (tokenKey) => {
        const res = await call("post", "/api/v1/auth/register", tokenKey);
        expect(res.status).not.toBe(401);
        expect(res.status).toBe(400); // empty body → validation error, not RBAC
      }
    );

    it.each(["none", "customer", "agent", "admin"] as const)(
      "POST /api/v1/auth/login is unaffected by any existing token (as %s)",
      async (tokenKey) => {
        const res = await call("post", "/api/v1/auth/login", tokenKey);
        // Login's OWN business logic returns 401 for missing credentials —
        // this is NOT requireAuth's 401; the point of this test is that the
        // status is IDENTICAL regardless of whether a bearer token is sent,
        // proving no RBAC middleware sits in front of this route.
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid email or password" });
      }
    );
  });
});
