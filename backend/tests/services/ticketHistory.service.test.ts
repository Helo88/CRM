import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import { Message } from "../../src/models/Message";
import { buildTicketHistory, TicketNotFoundError } from "../../src/services/ticketHistory.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("ticket-history-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Ticket.deleteMany({});
  await Message.deleteMany({});
});

async function seedCustomer() {
  return User.create({
    name: "Cara Customer",
    email: `customer-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant",
    role: "customer",
  });
}

async function seedAgent(name = "Aaron Agent") {
  return User.create({
    name,
    email: `agent-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant",
    role: "agent",
  });
}

describe("buildTicketHistory (ticket-management Story 13)", () => {
  it("throws TicketNotFoundError for a nonexistent ticket", async () => {
    await expect(buildTicketHistory(new mongoose.Types.ObjectId())).rejects.toBeInstanceOf(TicketNotFoundError);
  });

  it("returns exactly one 'created' event for a ticket with no other activity", async () => {
    const customer = await seedCustomer();
    const ticket = await Ticket.create({
      subject: "Login broken",
      description: "Details",
      customer: customer._id,
      statusHistory: [],
    });

    const events = await buildTicketHistory(ticket._id);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: "created",
      actor: { id: customer.id, name: customer.name, role: "customer" },
      data: { ticketNumber: ticket.ticketNumber, subject: "Login broken" },
    });
  });

  it("orders created, status-change, reply, and internal-note events chronologically", async () => {
    const customer = await seedCustomer();
    const agent = await seedAgent();
    const base = Date.now();
    const ticket = await Ticket.create({
      subject: "Payment failed",
      description: "Details",
      customer: customer._id,
      statusHistory: [
        { status: "in_progress", changedBy: agent._id, changedAt: new Date(base + 1000) },
        { status: "answered", changedBy: agent._id, changedAt: new Date(base + 3000) },
      ],
    });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "Public reply",
      internal: false,
      createdAt: new Date(base + 2000),
    });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "Internal note",
      internal: true,
      createdAt: new Date(base + 4000),
    });

    const events = await buildTicketHistory(ticket._id);

    expect(events.map((e) => e.kind)).toEqual([
      "created",
      "status_changed",
      "reply_posted",
      "status_changed",
      "internal_note_added",
    ]);
    expect(events[1].data).toMatchObject({ to: "in_progress" });
    expect(events[3].data).toMatchObject({ to: "answered" });
  });

  it("filters out internal_note_added events when viewerRole is customer", async () => {
    const customer = await seedCustomer();
    const agent = await seedAgent();
    const ticket = await Ticket.create({ subject: "S", description: "D", customer: customer._id });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "Internal only",
      internal: true,
    });

    const events = await buildTicketHistory(ticket._id, { viewerRole: "customer" });

    expect(events.some((e) => e.kind === "internal_note_added")).toBe(false);
  });

  it("includes internal_note_added events for a staff viewer", async () => {
    const customer = await seedCustomer();
    const agent = await seedAgent();
    const ticket = await Ticket.create({ subject: "S", description: "D", customer: customer._id });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: agent._id,
      text: "Internal only",
      internal: true,
    });

    const events = await buildTicketHistory(ticket._id, { viewerRole: "agent" });

    expect(events.some((e) => e.kind === "internal_note_added")).toBe(true);
  });

  it("yields actor: null for a status-change entry whose changedBy user no longer exists", async () => {
    const customer = await seedCustomer();
    const deletedUserId = new mongoose.Types.ObjectId();
    const ticket = await Ticket.create({
      subject: "S",
      description: "D",
      customer: customer._id,
      statusHistory: [{ status: "in_progress", changedBy: deletedUserId, changedAt: new Date() }],
    });

    const events = await buildTicketHistory(ticket._id);

    const statusEvent = events.find((e) => e.kind === "status_changed");
    expect(statusEvent?.actor).toBeNull();
  });

  it("yields actor: null for a message whose sender no longer exists", async () => {
    const customer = await seedCustomer();
    const ticket = await Ticket.create({ subject: "S", description: "D", customer: customer._id });
    await Message.create({
      parentType: "ticket",
      parentId: ticket._id,
      senderType: "agent",
      senderId: new mongoose.Types.ObjectId(),
      text: "Orphaned reply",
      internal: false,
    });

    const events = await buildTicketHistory(ticket._id);

    const replyEvent = events.find((e) => e.kind === "reply_posted");
    expect(replyEvent?.actor).toBeNull();
  });

  it("emits category_changed, priority_changed, and assignee_changed events from their history arrays", async () => {
    const customer = await seedCustomer();
    const admin = await seedAgent("Ann Admin");
    const targetAgent = await seedAgent("Target Agent");
    const base = Date.now();
    const ticket = await Ticket.create({
      subject: "S",
      description: "D",
      customer: customer._id,
      categoryHistory: [{ category: "Billing", changedBy: admin._id, changedAt: new Date(base + 1000) }],
      priorityHistory: [{ priority: "high", changedBy: admin._id, changedAt: new Date(base + 2000) }],
      assignedAgentHistory: [
        { assignedAgent: targetAgent._id, changedBy: admin._id, changedAt: new Date(base + 3000) },
      ],
    });

    const events = await buildTicketHistory(ticket._id);

    const categoryEvent = events.find((e) => e.kind === "category_changed");
    expect(categoryEvent).toMatchObject({
      actor: { id: admin.id, name: "Ann Admin" },
      data: { to: "Billing" },
    });

    const priorityEvent = events.find((e) => e.kind === "priority_changed");
    expect(priorityEvent).toMatchObject({
      actor: { id: admin.id, name: "Ann Admin" },
      data: { to: "high" },
    });

    const assigneeEvent = events.find((e) => e.kind === "assignee_changed");
    expect(assigneeEvent).toMatchObject({
      actor: { id: admin.id, name: "Ann Admin" },
      data: { to: { id: targetAgent.id, name: "Target Agent" } },
    });
  });

  it("emits an assignee_changed event with data.to: null when unassigned", async () => {
    const customer = await seedCustomer();
    const admin = await seedAgent("Ann Admin");
    const ticket = await Ticket.create({
      subject: "S",
      description: "D",
      customer: customer._id,
      assignedAgentHistory: [{ assignedAgent: null, changedBy: admin._id, changedAt: new Date() }],
    });

    const events = await buildTicketHistory(ticket._id);

    const assigneeEvent = events.find((e) => e.kind === "assignee_changed");
    expect(assigneeEvent?.data).toEqual({ to: null });
  });

  it("uses createdBy (not customer) as the 'created' event's actor for a staff-created ticket, and carries createdVia", async () => {
    const customer = await seedCustomer();
    const staffCreator = await seedAgent("Staffer Sam");
    const ticket = await Ticket.create({
      subject: "S",
      description: "D",
      customer: customer._id,
      createdBy: staffCreator._id,
      createdVia: "phone",
    });

    const events = await buildTicketHistory(ticket._id);

    const createdEvent = events.find((e) => e.kind === "created");
    expect(createdEvent?.actor).toMatchObject({ id: staffCreator.id, name: "Staffer Sam", role: "agent" });
    expect(createdEvent?.data).toMatchObject({ createdVia: "phone" });
  });

  it("falls back to the customer as the 'created' event's actor when createdBy is null (legacy ticket)", async () => {
    const customer = await seedCustomer();
    const ticket = await Ticket.create({ subject: "S", description: "D", customer: customer._id });

    const events = await buildTicketHistory(ticket._id);

    const createdEvent = events.find((e) => e.kind === "created");
    expect(createdEvent?.actor).toMatchObject({ id: customer.id, name: customer.name, role: "customer" });
    expect(createdEvent?.data).toMatchObject({ createdVia: null });
  });

  it("emits chat_participant_joined/left events from chatPresenceHistory, in order, with a populated actor", async () => {
    const customer = await seedCustomer();
    const agent = await seedAgent("Priya Presence");
    const base = Date.now();
    const ticket = await Ticket.create({
      subject: "S",
      description: "D",
      customer: customer._id,
      chatPresenceHistory: [
        { event: "joined", user: agent._id, at: new Date(base + 1000) },
        { event: "left", user: agent._id, at: new Date(base + 2000) },
      ],
    });

    const events = await buildTicketHistory(ticket._id);

    const chatEvents = events.filter((e) => e.kind === "chat_participant_joined" || e.kind === "chat_participant_left");
    expect(chatEvents.map((e) => e.kind)).toEqual(["chat_participant_joined", "chat_participant_left"]);
    expect(chatEvents[0].actor).toMatchObject({ id: agent.id, name: "Priya Presence", role: "agent" });
    expect(chatEvents[0].data).toEqual({});
  });
});
