import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import { Notification } from "../../src/models/Notification";
import { escalateTicket, InvalidEscalationTargetError } from "../../src/services/ticketEscalation.service";
import { InvalidStatusTransitionError } from "../../src/services/ticketStatus.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("ticket-escalation-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Ticket.deleteMany({});
  await Notification.deleteMany({});
});

async function seedUser(overrides: Partial<{ role: string; isActive: boolean; isDeleted: boolean }> = {}) {
  return User.create({
    name: "Test User",
    email: `user-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "agent",
    isActive: overrides.isActive ?? true,
    isDeleted: overrides.isDeleted ?? false,
  });
}

async function seedTicket(status = "new") {
  const customer = await seedUser({ role: "customer" });
  return Ticket.create({
    subject: "Something is broken",
    description: "Details here",
    customer: customer._id,
    status,
  });
}

describe("escalateTicket (ticket-management Story 12)", () => {
  it("sets status to escalated and escalatedTo, appending a statusHistory entry", async () => {
    const ticket = await seedTicket("in_progress");
    const target = await seedUser({ role: "admin" });
    const changedBy = new mongoose.Types.ObjectId();

    const result = await escalateTicket({
      ticket,
      escalatedToUserId: target._id,
      changedBy,
      reason: "manual",
    });

    expect(result.status).toBe("escalated");
    expect(result.escalatedTo?.toString()).toBe(target.id);
    expect(result.statusHistory).toHaveLength(1);
    expect(result.statusHistory[0]).toMatchObject({ status: "escalated", changedBy });
  });

  it("notifies the target and fans out an oversight notification to admins", async () => {
    const ticket = await seedTicket();
    const target = await seedUser({ role: "agent" });
    const admin = await seedUser({ role: "admin" });
    const changedBy = new mongoose.Types.ObjectId();

    await escalateTicket({ ticket, escalatedToUserId: target._id, changedBy, reason: "manual" });

    const targetNotifications = await Notification.find({ recipient: target._id });
    expect(targetNotifications).toHaveLength(1);
    expect(targetNotifications[0].type).toBe("ticket_escalated");

    const oversightNotifications = await Notification.find({ recipient: admin._id });
    expect(oversightNotifications).toHaveLength(1);
    expect(oversightNotifications[0].type).toBe("ticket_escalated");
  });

  it("does not touch assignedAgent, category, or priority", async () => {
    const assignedAgent = await seedUser({ role: "agent" });
    const ticket = await seedTicket();
    ticket.assignedAgent = assignedAgent._id;
    ticket.category = "billing";
    ticket.priority = "high";
    await ticket.save();

    const target = await seedUser({ role: "admin" });
    await escalateTicket({
      ticket,
      escalatedToUserId: target._id,
      changedBy: new mongoose.Types.ObjectId(),
      reason: "manual",
    });

    expect(ticket.assignedAgent?.toString()).toBe(assignedAgent.id);
    expect(ticket.category).toBe("billing");
    expect(ticket.priority).toBe("high");
  });

  it("rejects a target with role customer", async () => {
    const ticket = await seedTicket();
    const target = await seedUser({ role: "customer" });

    await expect(
      escalateTicket({
        ticket,
        escalatedToUserId: target._id,
        changedBy: new mongoose.Types.ObjectId(),
        reason: "manual",
      })
    ).rejects.toThrow(InvalidEscalationTargetError);
  });

  it("rejects a deactivated target", async () => {
    const ticket = await seedTicket();
    const target = await seedUser({ role: "agent", isActive: false });

    await expect(
      escalateTicket({
        ticket,
        escalatedToUserId: target._id,
        changedBy: new mongoose.Types.ObjectId(),
        reason: "manual",
      })
    ).rejects.toThrow(InvalidEscalationTargetError);
  });

  it("rejects a soft-deleted target", async () => {
    const ticket = await seedTicket();
    const target = await seedUser({ role: "agent", isDeleted: true });

    await expect(
      escalateTicket({
        ticket,
        escalatedToUserId: target._id,
        changedBy: new mongoose.Types.ObjectId(),
        reason: "manual",
      })
    ).rejects.toThrow(InvalidEscalationTargetError);
  });

  it("rejects self-escalation", async () => {
    const ticket = await seedTicket();
    const actor = new mongoose.Types.ObjectId();

    await expect(
      escalateTicket({ ticket, escalatedToUserId: actor, changedBy: actor, reason: "manual" })
    ).rejects.toThrow(InvalidEscalationTargetError);
  });

  it("rejects escalating a closed ticket", async () => {
    const ticket = await seedTicket("closed");
    const target = await seedUser({ role: "admin" });

    await expect(
      escalateTicket({
        ticket,
        escalatedToUserId: target._id,
        changedBy: new mongoose.Types.ObjectId(),
        reason: "manual",
      })
    ).rejects.toThrow(InvalidStatusTransitionError);
  });

  it("passes reason 'sla_breach' down to applyStatusTransition as 'auto_escalation'", async () => {
    const ticket = await seedTicket();
    const target = await seedUser({ role: "admin" });

    await escalateTicket({
      ticket,
      escalatedToUserId: target._id,
      changedBy: new mongoose.Types.ObjectId(),
      reason: "sla_breach",
    });

    expect(ticket.status).toBe("escalated");
  });
});
