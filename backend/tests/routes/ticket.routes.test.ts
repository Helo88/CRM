import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import * as emailService from "../../src/services/email.service";

const app = createApp();
let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("ticket-routes-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Ticket.deleteMany({});
});

function tokenFor(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET as string);
}

async function seedUser(
  overrides: Partial<{ role: string; email: string; name: string; permissions: string[]; isActive: boolean }> = {}
) {
  const user = await User.create({
    name: overrides.name ?? "Test Customer",
    email: overrides.email ?? `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "customer",
    permissions: overrides.permissions ?? [],
    isActive: overrides.isActive ?? true,
  });
  return { user, token: tokenFor({ id: user.id, role: user.role }) };
}

describe("POST /api/v1/tickets (Story 8)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app)
      .post("/api/v1/tickets")
      .send({ subject: "Help", description: "It's broken" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-customer caller without tickets:create_for_customer", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when subject is missing", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ description: "It's broken" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help" });
    expect(res.status).toBe(400);
  });

  it("creates a ticket with status new, no category/assignedAgent, and sends an acknowledgment email", async () => {
    const sendEmailMock = vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user, token } = await seedUser({ email: "customer@example.com" });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Login broken", description: "Cannot sign in since this morning" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ subject: "Login broken", status: "new" });
    expect(res.body.id).toBeTruthy();

    const ticket = await Ticket.findById(res.body.id);
    expect(ticket).not.toBeNull();
    expect(ticket!.customer.toString()).toBe(user.id);
    expect(ticket!.category).toBeNull();
    expect(ticket!.assignedAgent).toBeNull();
    expect(ticket!.priority).toBe("medium");

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "customer@example.com" }));
  });

  it("still creates the ticket and returns 201 when the acknowledgment email fails to send", async () => {
    vi.spyOn(emailService, "sendEmail").mockRejectedValue(new Error("SMTP down"));
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Login broken", description: "Cannot sign in since this morning" });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket).not.toBeNull();
  });
});

describe("POST /api/v1/tickets — staff mode (Story 57)", () => {
  it("lets an agent with tickets:create_for_customer create a ticket for an existing customer", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user: pickedCustomer } = await seedUser({ email: "picked@example.com" });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:create_for_customer"] });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "Billing issue reported by phone",
        description: "Customer called in about a duplicate charge.",
        customerId: pickedCustomer.id,
        category: "billing",
        priority: "high",
      });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket).not.toBeNull();
    expect(ticket!.customer.toString()).toBe(pickedCustomer.id);
    expect(ticket!.priority).toBe("high");
    expect(ticket!.category).toBe("billing");
    expect(ticket!.status).toBe("new");
    expect(ticket!.assignedAgent).toBeNull();
  });

  it("lets an admin create a ticket for a customer without any explicit permission grant (implicit admin pass)", async () => {
    // Regression test for the bug caught during plan review: calling
    // hasPermission() directly (instead of through requirePermission) would
    // incorrectly 403 an admin, whose `permissions` array is normally empty.
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user: pickedCustomer } = await seedUser({ email: "picked-by-admin@example.com" });
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({
        subject: "Opened by admin",
        description: "Reported in person at the front desk.",
        customerId: pickedCustomer.id,
      });

    expect(res.status).toBe(201);
  });

  it("returns 400 when customerId is not a valid ObjectId", async () => {
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:create_for_customer"] });
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "x", description: "y", customerId: "not-an-object-id" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when customerId refers to a staff account rather than a customer", async () => {
    const { user: otherAgent } = await seedUser({ role: "agent" });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "x", description: "y", customerId: otherAgent.id });
    expect(res.status).toBe(400);
  });

  it("returns 400 when customerId refers to a deactivated customer", async () => {
    const { user: inactiveCustomer } = await seedUser({ isActive: false });
    const { token } = await seedUser({ role: "admin" });
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "x", description: "y", customerId: inactiveCustomer.id });
    expect(res.status).toBe(400);
  });

  it("does not send any email when notifyCustomer is false (or omitted)", async () => {
    const sendEmailMock = vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user: pickedCustomer } = await seedUser();
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "x", description: "y", customerId: pickedCustomer.id, notifyCustomer: false });

    expect(res.status).toBe(201);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("sends a notify email to the picked customer when notifyCustomer is true, and still returns 201 if it throws", async () => {
    const sendEmailMock = vi.spyOn(emailService, "sendEmail").mockRejectedValue(new Error("SMTP down"));
    const { user: pickedCustomer } = await seedUser({ email: "notify-me@example.com" });
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "x", description: "y", customerId: pickedCustomer.id, notifyCustomer: true });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "notify-me@example.com" }));
  });
});
