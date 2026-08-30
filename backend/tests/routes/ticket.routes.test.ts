import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../../src/app";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import { TicketCategory } from "../../src/models/TicketCategory";
import { Message } from "../../src/models/Message";
import { Conversation } from "../../src/models/Conversation";
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
  await TicketCategory.deleteMany({});
  await Message.deleteMany({});
  await Conversation.deleteMany({});
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

  it("lets a customer set a category on their own ticket (frontend now offers this, not just staff)", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Billing question", description: "Charged twice", category: "Billing" });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.category).toBe("Billing");
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

async function seedOnlineAgent(overrides: Partial<{ email: string }> = {}) {
  return User.create({
    name: "Available Agent",
    email: overrides.email ?? `agent-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: "agent",
    isOnline: true,
    isActive: true,
  });
}

describe("POST /api/v1/tickets — auto-assignment (Story 10)", () => {
  it("assigns the newly created ticket to an online agent", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const agent = await seedOnlineAgent();
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken" });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.assignedAgent?.toString()).toBe(agent.id);
  });

  it("leaves assignedAgent null when no agent is online", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken" });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.assignedAgent).toBeNull();
  });

  it("sends an assignment email to the picked agent", async () => {
    const sendEmailMock = vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const agent = await seedOnlineAgent({ email: "agent@example.com" });
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken" });

    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: agent.email, subject: expect.stringContaining("New ticket assigned to you") })
    );
  });

  it("still returns 201 when the assignment notification email throws", async () => {
    vi.spyOn(emailService, "sendEmail")
      .mockResolvedValueOnce({ dryRun: true }) // acknowledgment email to the customer
      .mockRejectedValueOnce(new Error("SMTP down")); // assignment email to the agent
    await seedOnlineAgent();
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken" });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.assignedAgent).not.toBeNull();
  });

  it("auto-assigns on the staff-created branch too", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const agent = await seedOnlineAgent();
    const { user: pickedCustomer } = await seedUser({ email: "picked@example.com" });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:create_for_customer"] });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken", customerId: pickedCustomer.id });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.assignedAgent?.toString()).toBe(agent.id);
  });
});

describe("POST /api/v1/tickets — sourceConversation (Story 62)", () => {
  it("persists sourceConversation when it belongs to the caller", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user, token } = await seedUser();
    const conversation = await Conversation.create({ customer: user._id, status: "ai_handling" });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken", sourceConversation: conversation.id });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.sourceConversation?.toString()).toBe(conversation.id);
  });

  it("returns 403 when sourceConversation belongs to a different customer", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user: owner } = await seedUser();
    const { token: otherToken } = await seedUser();
    const conversation = await Conversation.create({ customer: owner._id, status: "ai_handling" });

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ subject: "Help", description: "It's broken", sourceConversation: conversation.id });

    expect(res.status).toBe(403);
    expect(await Ticket.countDocuments()).toBe(0);
  });

  it("returns 400 for a malformed sourceConversation", async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken", sourceConversation: "not-an-object-id" });

    expect(res.status).toBe(400);
  });

  it("still creates a ticket with sourceConversation null when omitted (backward-compat)", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { token } = await seedUser();

    const res = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${token}`)
      .send({ subject: "Help", description: "It's broken" });

    expect(res.status).toBe(201);
    const ticket = await Ticket.findById(res.body.id);
    expect(ticket!.sourceConversation).toBeNull();
  });
});

async function seedTicket(overrides: Partial<{ category: string | null; priority: string }> = {}) {
  const { user: customer } = await seedUser();
  return Ticket.create({
    subject: "Something is broken",
    description: "Details here",
    customer: customer._id,
    category: overrides.category ?? null,
    priority: overrides.priority ?? "medium",
  });
}

describe("GET /api/v1/tickets/:id (Story 9)", () => {
  it("returns 401 without a token", async () => {
    const ticket = await seedTicket();
    const res = await request(app).get(`/api/v1/tickets/${ticket.id}`);
    expect(res.status).toBe(401);
  });

  it("returns 404 (not 403) for a customer who doesn't own the ticket (Story 60)", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app).get(`/api/v1/tickets/${ticket.id}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed id", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app).get("/api/v1/tickets/not-an-object-id").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a well-formed but nonexistent id", async () => {
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .get(`/api/v1/tickets/${new mongoose.Types.ObjectId().toHexString()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 200 for an agent, with the populated customer name/email", async () => {
    const ticket = await seedTicket();
    const populatedCustomer = await User.findById(ticket.customer);
    const { token } = await seedUser({ role: "agent" });

    const res = await request(app).get(`/api/v1/tickets/${ticket.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: ticket.id,
      subject: ticket.subject,
      customer: { name: populatedCustomer!.name, email: populatedCustomer!.email },
    });
  });
});

describe("PATCH /api/v1/tickets/:id (Story 9)", () => {
  it("sets category to an existing active category name (case-insensitive input), storing the canonical name", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:categorize"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "billing" });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("Billing");
    const stored = await Ticket.findById(ticket.id);
    expect(stored!.category).toBe("Billing");
  });

  it("clears category when set to null", async () => {
    const ticket = await seedTicket({ category: "Billing" });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:categorize"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: null });

    expect(res.status).toBe(200);
    expect(res.body.category).toBeNull();
  });

  it("clears category when set to an empty string", async () => {
    const ticket = await seedTicket({ category: "Billing" });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:categorize"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "" });

    expect(res.status).toBe(200);
    expect(res.body.category).toBeNull();
  });

  it("returns 400 for a category name not in the active list (nonexistent)", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:categorize"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Nonexistent" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a category name that exists but is inactive", async () => {
    await TicketCategory.create({ name: "Retired", active: false });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:categorize"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Retired" });

    expect(res.status).toBe(400);
  });

  it.each(["low", "medium", "high", "urgent"])("returns 200 setting priority to %s", async (priority) => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:change_priority"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority });

    expect(res.status).toBe(200);
    expect(res.body.priority).toBe(priority);
  });

  it("returns 400 for an invalid priority value", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:change_priority"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "not-a-priority" });

    expect(res.status).toBe(400);
  });

  it("sets both category and priority together", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({
      role: "agent",
      permissions: ["tickets:categorize", "tickets:change_priority"],
    });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Billing", priority: "urgent" });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("Billing");
    expect(res.body.priority).toBe("urgent");
  });

  it("leaves category untouched when only priority is sent (partial-update regression)", async () => {
    const ticket = await seedTicket({ category: "Billing", priority: "low" });
    const { token } = await seedUser({
      role: "agent",
      permissions: ["tickets:categorize", "tickets:change_priority"],
    });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("Billing");
    expect(res.body.priority).toBe("high");
  });

  it("leaves priority untouched when only category is sent (partial-update regression)", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const ticket = await seedTicket({ category: null, priority: "urgent" });
    const { token } = await seedUser({
      role: "agent",
      permissions: ["tickets:categorize", "tickets:change_priority"],
    });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Billing" });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("Billing");
    expect(res.body.priority).toBe("urgent");
  });

  it("returns 403 when caller lacks tickets:categorize and sends category, even holding tickets:change_priority", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:change_priority"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Billing" });

    expect(res.status).toBe(403);
  });

  it("returns 403 when caller lacks tickets:change_priority and sends priority", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:categorize"] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });

    expect(res.status).toBe(403);
  });

  it("returns 403 for a customer", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "customer" });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });

    expect(res.status).toBe(403);
  });

  it("returns 403 for an agent lacking both keys", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: [] });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Billing" });

    expect(res.status).toBe(403);
  });

  it("returns 404 for a malformed id", async () => {
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:change_priority"] });
    const res = await request(app)
      .patch("/api/v1/tickets/not-an-object-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a well-formed but nonexistent id", async () => {
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:change_priority"] });
    const res = await request(app)
      .patch(`/api/v1/tickets/${new mongoose.Types.ObjectId().toHexString()}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });
    expect(res.status).toBe(404);
  });

  it("lets an admin change both fields with no explicit permission grant (implicit admin pass)", async () => {
    await TicketCategory.create({ name: "Billing", active: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ category: "Billing", priority: "urgent" });

    expect(res.status).toBe(200);
    expect(res.body.category).toBe("Billing");
    expect(res.body.priority).toBe("urgent");
  });

  it("returns 403 for a deactivated agent holding both keys (isActive re-check)", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({
      role: "agent",
      permissions: ["tickets:categorize", "tickets:change_priority"],
      isActive: false,
    });

    const res = await request(app)
      .patch(`/api/v1/tickets/${ticket.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ priority: "high" });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/tickets/:id/messages (Story 56)", () => {
  it("returns 401 without a token", async () => {
    const ticket = await seedTicket();
    const res = await request(app).get(`/api/v1/tickets/${ticket.id}/messages`);
    expect(res.status).toBe(401);
  });

  it("returns 404 (not 403) for a customer who doesn't own the ticket (Story 60)", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "customer" });
    const res = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed or nonexistent ticket id", async () => {
    const { token } = await seedUser({ role: "agent" });
    const malformed = await request(app)
      .get("/api/v1/tickets/not-an-object-id/messages")
      .set("Authorization", `Bearer ${token}`);
    expect(malformed.status).toBe(404);

    const nonexistent = await request(app)
      .get(`/api/v1/tickets/${new mongoose.Types.ObjectId().toHexString()}/messages`)
      .set("Authorization", `Bearer ${token}`);
    expect(nonexistent.status).toBe(404);
  });

  it("returns an empty array for a ticket with no messages", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent" });
    const res = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns messages oldest-first, with populated sender name", async () => {
    const ticket = await seedTicket();
    const { user: agent, token } = await seedUser({ role: "agent", name: "Agent Smith" });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "first",
      internal: false,
      attachments: [],
      createdAt: new Date(Date.now() - 60_000),
    });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "second",
      internal: false,
      attachments: [],
    });

    const res = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].text).toBe("first");
    expect(res.body[1].text).toBe("second");
    expect(res.body[0].sender).toEqual({ id: agent.id, name: "Agent Smith" });
  });
});

describe("POST /api/v1/tickets/:id/messages (Story 56)", () => {
  it("returns 401 without a token", async () => {
    const ticket = await seedTicket();
    const res = await request(app).post(`/api/v1/tickets/${ticket.id}/messages`).send({ text: "hi" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a caller lacking tickets:reply", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: [] });
    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a malformed or nonexistent ticket id", async () => {
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });
    const malformed = await request(app)
      .post("/api/v1/tickets/not-an-object-id/messages")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });
    expect(malformed.status).toBe(404);

    const nonexistent = await request(app)
      .post(`/api/v1/tickets/${new mongoose.Types.ObjectId().toHexString()}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });
    expect(nonexistent.status).toBe(404);
  });

  it("returns 400 when text is missing or empty", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });

    const missing = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(missing.status).toBe(400);

    const empty = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "" });
    expect(empty.status).toBe(400);
  });

  it("creates a Message and emails the customer", async () => {
    const sendEmailMock = vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const ticket = await seedTicket();
    const customer = await User.findById(ticket.customer);
    const { token, user: agent } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Thanks for reaching out, here's an update." });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe("Thanks for reaching out, here's an update.");
    expect(res.body.senderType).toBe("agent");
    expect(res.body.internal).toBe(false);

    const stored = await Message.findOne({ parentType: "ticket", parentId: ticket._id });
    expect(stored).not.toBeNull();
    expect(stored!.senderId!.toString()).toBe(agent.id);

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: customer!.email }));
  });

  it("still creates the Message and returns 201 when the reply email fails to send", async () => {
    vi.spyOn(emailService, "sendEmail").mockRejectedValue(new Error("SMTP down"));
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });

    expect(res.status).toBe(201);
    const stored = await Message.findOne({ parentType: "ticket", parentId: ticket._id });
    expect(stored).not.toBeNull();
  });

  it("flips a New/In Progress ticket to Answered", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });

    expect(res.status).toBe(201);
    const stored = await Ticket.findById(ticket.id);
    expect(stored!.status).toBe("answered");
  });

  it("leaves a closed ticket closed", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const { user: customer } = await seedUser();
    const closedTicket = await Ticket.create({
      subject: "Already handled",
      description: "Resolved earlier",
      customer: customer._id,
      status: "closed",
    });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });

    const res = await request(app)
      .post(`/api/v1/tickets/${closedTicket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Following up after closing." });

    expect(res.status).toBe(201);
    const stored = await Ticket.findById(closedTicket.id);
    expect(stored!.status).toBe("closed");
  });

  it("creates a Message with an attachment, stored on disk and downloadable", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("text", "See attached.")
      .attach("files", Buffer.from("note contents"), "note.txt");

    expect(res.status).toBe(201);
    expect(res.body.attachments).toHaveLength(1);
    expect(res.body.attachments[0].fileName).toBe("note.txt");
    expect(res.body.attachments[0].url).toBe(
      `/api/v1/tickets/${ticket.id}/messages/${res.body.id}/attachments/${res.body.attachments[0].id}`
    );

    const download = await request(app)
      .get(res.body.attachments[0].url)
      .set("Authorization", `Bearer ${token}`);
    expect(download.status).toBe(200);
    expect(download.text).toBe("note contents");
  });

  it("lets an admin reply with no explicit tickets:reply grant (implicit admin pass)", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "admin" });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });

    expect(res.status).toBe(201);
  });

  it("returns 403 for a deactivated agent holding tickets:reply (isActive re-check)", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"], isActive: false });

    const res = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "hi" });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/v1/tickets/:id/messages/:messageId/attachments/:attachmentId (Story 56)", () => {
  it("returns 404 for a malformed or nonexistent ticket/message/attachment id", async () => {
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent" });

    const malformedTicket = await request(app)
      .get(`/api/v1/tickets/not-an-object-id/messages/${new mongoose.Types.ObjectId().toHexString()}/attachments/${new mongoose.Types.ObjectId().toHexString()}`)
      .set("Authorization", `Bearer ${token}`);
    expect(malformedTicket.status).toBe(404);

    const nonexistentMessage = await request(app)
      .get(
        `/api/v1/tickets/${ticket.id}/messages/${new mongoose.Types.ObjectId().toHexString()}/attachments/${new mongoose.Types.ObjectId().toHexString()}`
      )
      .set("Authorization", `Bearer ${token}`);
    expect(nonexistentMessage.status).toBe(404);
  });

  it("returns 404 for an attachment id that doesn't belong to the message", async () => {
    vi.spyOn(emailService, "sendEmail").mockResolvedValue({ dryRun: true });
    const ticket = await seedTicket();
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:reply"] });
    const created = await request(app)
      .post(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${token}`)
      .field("text", "See attached.")
      .attach("files", Buffer.from("contents"), "file.txt");

    const wrongAttachmentId = await request(app)
      .get(
        `/api/v1/tickets/${ticket.id}/messages/${created.body.id}/attachments/${new mongoose.Types.ObjectId().toHexString()}`
      )
      .set("Authorization", `Bearer ${token}`);
    expect(wrongAttachmentId.status).toBe(404);
  });
});

// Story 60 (merged with customer-portal Story 36, platform Story 59).
async function seedTicketFor(
  customerId: string,
  overrides: Partial<{ status: string; category: string | null; priority: string; assignedAgent: string }> = {}
) {
  return Ticket.create({
    subject: "Something is broken",
    description: "Details here",
    customer: customerId,
    status: overrides.status ?? "new",
    category: overrides.category ?? null,
    priority: overrides.priority ?? "medium",
    assignedAgent: overrides.assignedAgent ?? null,
  });
}

describe("GET /api/v1/tickets (Story 60)", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/tickets");
    expect(res.status).toBe(401);
  });

  it("scopes a customer to only their own tickets, ignoring a client-supplied customer filter", async () => {
    const { user: customerA, token: tokenA } = await seedUser({ role: "customer" });
    const { user: customerB } = await seedUser({ role: "customer" });
    await seedTicketFor(customerA.id);
    await seedTicketFor(customerA.id);
    await seedTicketFor(customerB.id);

    const res = await request(app)
      .get(`/api/v1/tickets?customer=${customerB.id}`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.tickets).toHaveLength(2);
    for (const row of res.body.tickets) {
      expect(row.customer.id).toBe(customerA.id);
    }
  });

  it("scopes an agent without tickets:view_all to only their assigned tickets", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { user: agent1, token: token1 } = await seedUser({ role: "agent" });
    const { user: agent2 } = await seedUser({ role: "agent" });
    await seedTicketFor(customer.id, { assignedAgent: agent1.id });
    await seedTicketFor(customer.id, { assignedAgent: agent2.id });

    const res = await request(app).get("/api/v1/tickets").set("Authorization", `Bearer ${token1}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.tickets[0].assignedAgent.id).toBe(agent1.id);
  });

  it("shows every ticket, with assignedAgent populated, for an agent granted tickets:view_all", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { user: agent1 } = await seedUser({ role: "agent" });
    const { user: agent2, token: token2 } = await seedUser({
      role: "agent",
      permissions: ["tickets:view_all"],
    });
    await seedTicketFor(customer.id, { assignedAgent: agent1.id });
    await seedTicketFor(customer.id, { assignedAgent: agent2.id });

    const res = await request(app).get("/api/v1/tickets").set("Authorization", `Bearer ${token2}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it("filters by status, category, and priority (staff caller)", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:view_all"] });
    await seedTicketFor(customer.id, { status: "new", category: "Billing", priority: "low" });
    await seedTicketFor(customer.id, { status: "closed", category: "Technical", priority: "urgent" });

    const res = await request(app)
      .get("/api/v1/tickets?status=closed&category=Technical&priority=urgent")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.tickets[0].status).toBe("closed");
  });

  it("rejects an unsupported sort key with 400", async () => {
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:view_all"] });
    const res = await request(app).get("/api/v1/tickets?sort=notarealfield").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("paginates results and reports total/page/limit", async () => {
    const { user: customer } = await seedUser({ role: "customer" });
    const { token } = await seedUser({ role: "agent", permissions: ["tickets:view_all"] });
    for (let i = 0; i < 25; i++) {
      await seedTicketFor(customer.id);
    }

    const res = await request(app).get("/api/v1/tickets?page=2&limit=10").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(25);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
    expect(res.body.tickets).toHaveLength(10);
  });

  it("includes a human-friendly TCK-<n> reference on each row", async () => {
    const { user: customer, token } = await seedUser({ role: "customer" });
    await seedTicketFor(customer.id);

    const res = await request(app).get("/api/v1/tickets").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tickets[0].reference).toMatch(/^TCK-\d+$/);
  });

  it("lets a customer filter their own list by status", async () => {
    const { user: customer, token } = await seedUser({ role: "customer" });
    await seedTicketFor(customer.id, { status: "new" });
    await seedTicketFor(customer.id, { status: "closed" });

    const res = await request(app)
      .get("/api/v1/tickets?status=closed")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.tickets[0].status).toBe("closed");
  });
});

describe("GET /api/v1/tickets/:id — customer ownership branch (Story 60)", () => {
  it("lets a customer read their own ticket", async () => {
    const { user: customer, token } = await seedUser({ role: "customer" });
    const ticket = await seedTicketFor(customer.id);

    const res = await request(app).get(`/api/v1/tickets/${ticket.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticket.id);
    expect(res.body.reference).toMatch(/^TCK-\d+$/);
  });
});

describe("GET /api/v1/tickets/:id/messages — customer ownership + internal filtering (Story 60)", () => {
  it("excludes internal: true messages for a customer, but an agent still sees them", async () => {
    const { user: customer, token: customerToken } = await seedUser({ role: "customer" });
    const { user: agent, token: agentToken } = await seedUser({ role: "agent" });
    const ticket = await seedTicketFor(customer.id);
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "public reply",
      internal: false,
    });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "internal note, staff only",
      internal: true,
    });

    const customerRes = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${customerToken}`);
    expect(customerRes.status).toBe(200);
    expect(customerRes.body).toHaveLength(1);
    expect(customerRes.body[0].text).toBe("public reply");

    const agentRes = await request(app)
      .get(`/api/v1/tickets/${ticket.id}/messages`)
      .set("Authorization", `Bearer ${agentToken}`);
    expect(agentRes.status).toBe(200);
    expect(agentRes.body).toHaveLength(2);
  });
});
