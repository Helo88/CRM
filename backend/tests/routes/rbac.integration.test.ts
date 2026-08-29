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

// This file deliberately has no MongoMemoryServer/mongoose.connect at all,
// so any route that now makes a real DB call (POST /api/v1/tickets, POST
// /api/v1/conversations, GET /api/v1/tickets) graduated out of this DB-less
// matrix once its story shipped — their full 401/403/2xx coverage lives in
// tests/routes/ticket.routes.test.ts and tests/routes/conversation.routes.test.ts
// instead. There are currently no remaining 501-stub routes left to matrix-test
// here (POST /:id/escalate, the last one, was removed by Story 16 — escalation
// is socket-only now, see tests/sockets/chat.socket.test.ts).
describe("RBAC across mounted routes", () => {
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
