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

// Routes below are still 501 stubs (their implementation stories haven't
// executed yet) — RBAC runs before the handler body, so a wrong-role call
// must see 403, and a right-role call sees 501 (proving RBAC passed through
// to the stub), not the reverse. POST /api/v1/tickets (Story 8, then Story
// 57's staff mode) is intentionally NOT in this matrix — it graduated out of
// this DB-less suite entirely once its staff branch started routing through
// requirePermission, a real DB-backed check (hasPermission/isActiveAccount,
// see backend/src/services/permissions.ts). This file deliberately has no
// MongoMemoryServer/mongoose.connect at all, so calling that with no live
// connection would buffer/hang rather than cleanly 403. Its full 401/403/201
// coverage now lives in tests/routes/ticket.routes.test.ts. POST
// /api/v1/conversations (Story 14) graduated the same way once it started
// hitting a real Conversation.create() DB call — its full 401/403/201
// coverage now lives in tests/routes/conversation.routes.test.ts. GET
// /api/v1/tickets (Story 60) graduated the same way once it started
// querying Ticket.find()/countDocuments() for real — its full 401/200
// coverage (every role is let in, scope narrows inside the handler) now
// lives in tests/routes/ticket.routes.test.ts too.
describe("RBAC across mounted routes", () => {
  it.each([
    ["post", "/api/v1/conversations/abc/escalate", { none: 401, customer: 501, agent: 403, admin: 403 }],
  ] as const)("%s %s", async (method, path, expected) => {
    for (const [tokenKey, expectedStatus] of Object.entries(expected) as [keyof typeof AUTH, number][]) {
      const res = await call(method, path, tokenKey);
      expect(res.status).toBe(expectedStatus);
    }
  });

  it("401 responses carry the requireAuth error body", async () => {
    const res = await call("post", "/api/v1/conversations/abc/escalate", "none");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Missing or invalid Authorization header" });
  });

  it("403 responses carry the requireRole error body", async () => {
    const res = await call("post", "/api/v1/conversations/abc/escalate", "agent");
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
