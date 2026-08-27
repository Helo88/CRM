import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import * as emailService from "../../src/services/email.service";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("me-routes-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  vi.restoreAllMocks();
});

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

async function seedUser(email = "current@example.com") {
  const user = await User.create({
    name: "Test User",
    email,
    passwordHash: "irrelevant-for-these-tests",
    role: "customer",
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("GET /api/v1/me/contact", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/me/contact");
    expect(res.status).toBe(401);
  });

  it("returns the caller's own contact info", async () => {
    const { token, user } = await seedUser();
    const res = await request(app).get("/api/v1/me/contact").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ phone: null, email: user.email, pendingEmail: null });
  });
});

describe("PATCH /api/v1/me/contact", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).patch("/api/v1/me/contact").send({ phone: "+201012345678" });
    expect(res.status).toBe(401);
  });

  it("updates phone immediately", async () => {
    const { token, user } = await seedUser();
    const res = await request(app)
      .patch("/api/v1/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+201012345678" });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe("+201012345678");
    const reloaded = await User.findById(user.id);
    expect(reloaded!.phone).toBe("+201012345678");
  });

  it("requests an email change: sets pendingEmail, leaves email unchanged, sends confirmation", async () => {
    const sendEmailMock = vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { token, user } = await seedUser();
    const res = await request(app)
      .patch("/api/v1/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.pendingEmail).toBe("new@example.com");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "new@example.com" }));
  });

  it("accepts an email with surrounding whitespace (validated after trim)", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { token } = await seedUser();
    const res = await request(app)
      .patch("/api/v1/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "  new@example.com  " });
    expect(res.status).toBe(200);
    expect(res.body.pendingEmail).toBe("new@example.com");
  });

  it("rejects when new email equals current email", async () => {
    const { token, user } = await seedUser();
    const res = await request(app)
      .patch("/api/v1/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: user.email });
    expect(res.status).toBe(400);
  });

  it("returns 409 when the new email is already in use by another user", async () => {
    await seedUser("taken@example.com");
    const { token } = await seedUser("me@example.com");
    const res = await request(app)
      .patch("/api/v1/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "taken@example.com" });
    expect(res.status).toBe(409);
  });

  it("rolls back pendingEmail/token when sendEmail fails", async () => {
    vi.spyOn(emailService, "sendEmail").mockRejectedValue(new Error("SMTP down"));
    const { token, user } = await seedUser();
    const res = await request(app)
      .patch("/api/v1/me/contact")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@example.com" });
    expect(res.status).toBe(502);
    const reloaded = await User.findById(user.id);
    expect(reloaded!.pendingEmail).toBeNull();
    expect(reloaded!.emailConfirmToken).toBeNull();
  });
});

describe("GET /api/v1/me/email/confirm", () => {
  async function requestEmailChange(newEmail: string) {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { token, user } = await seedUser();
    await request(app).patch("/api/v1/me/contact").set("Authorization", `Bearer ${token}`).send({ email: newEmail });
    const reloaded = await User.findById(user.id);
    return { userId: user.id, token: reloaded!.emailConfirmToken as string };
  }

  // This is a link a human clicks from an email client, not an API call —
  // it redirects to the frontend's public /email-confirmed landing page
  // (with a status query param) rather than returning JSON. See
  // me.routes.ts's GET /email/confirm handler.
  it("confirms a valid token: redirects with status=success, swaps email, clears pending fields", async () => {
    const { userId, token } = await requestEmailChange("new@example.com");
    const res = await request(app).get(`/api/v1/me/email/confirm?token=${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("status=success");
    expect(res.headers.location).toContain(encodeURIComponent("new@example.com"));
    const reloaded = await User.findById(userId);
    expect(reloaded!.email).toBe("new@example.com");
    expect(reloaded!.pendingEmail).toBeNull();
    expect(reloaded!.emailConfirmToken).toBeNull();
  });

  it("redirects with status=invalid for an expired token", async () => {
    const { userId } = await requestEmailChange("new@example.com");
    await User.findByIdAndUpdate(userId, { emailConfirmTokenExpiresAt: new Date(Date.now() - 1000) });
    const reloaded = await User.findById(userId);
    const res = await request(app).get(`/api/v1/me/email/confirm?token=${reloaded!.emailConfirmToken}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("status=invalid");
  });

  it("redirects with status=invalid for an unknown token", async () => {
    const res = await request(app).get("/api/v1/me/email/confirm?token=does-not-exist");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("status=invalid");
  });

  it("redirects with status=conflict when the pending email was confirmed by another account first (race)", async () => {
    const { userId, token } = await requestEmailChange("race@example.com");
    // Simulate another account having confirmed the same address in the
    // TOCTOU window between this test's setup and the confirm call.
    await seedUser("race@example.com");
    const res = await request(app).get(`/api/v1/me/email/confirm?token=${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("status=conflict");
    const reloaded = await User.findById(userId);
    expect(reloaded!.pendingEmail).toBeNull();
  });
});
