import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import { applyStatusTransition, InvalidStatusTransitionError } from "../../src/services/ticketStatus.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("ticket-status-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Ticket.deleteMany({});
});

async function seedTicket(status: string) {
  const customer = await User.create({
    name: "Customer",
    email: `customer-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: "customer",
  });
  return Ticket.create({
    subject: "Something is broken",
    description: "Details here",
    customer: customer._id,
    status,
  });
}

describe("applyStatusTransition (ticket-management Story 11)", () => {
  it.each([
    ["new", "in_progress"],
    ["new", "answered"],
    ["new", "closed"],
    ["in_progress", "answered"],
    ["in_progress", "closed"],
    ["in_progress", "new"],
    ["answered", "in_progress"],
    ["answered", "closed"],
    ["closed", "in_progress"],
  ])("allows %s -> %s, appending a statusHistory entry", async (from, to) => {
    const ticket = await seedTicket(from);
    const changedBy = new mongoose.Types.ObjectId();

    const result = await applyStatusTransition({
      ticket,
      nextStatus: to as never,
      changedBy,
      reason: "manual",
    });

    expect(result.status).toBe(to);
    expect(result.statusHistory).toHaveLength(1);
    expect(result.statusHistory[0]).toMatchObject({ status: to, changedBy });
    expect(result.statusHistory[0].changedAt).toBeInstanceOf(Date);

    const persisted = await Ticket.findById(ticket.id);
    expect(persisted!.status).toBe(to);
    expect(persisted!.statusHistory).toHaveLength(1);
  });

  it.each([
    ["closed", "answered"],
    ["closed", "new"],
    ["new", "escalated"],
    ["escalated", "new"],
    ["escalated", "closed"],
  ])("rejects %s -> %s with InvalidStatusTransitionError", async (from, to) => {
    const ticket = await seedTicket(from);
    const changedBy = new mongoose.Types.ObjectId();

    await expect(
      applyStatusTransition({ ticket, nextStatus: to as never, changedBy, reason: "manual" })
    ).rejects.toThrow(InvalidStatusTransitionError);

    const persisted = await Ticket.findById(ticket.id);
    expect(persisted!.status).toBe(from);
    expect(persisted!.statusHistory).toHaveLength(0);
  });

  it("no-ops on a same-state transition: returns the ticket unchanged, no new history entry", async () => {
    const ticket = await seedTicket("in_progress");
    const changedBy = new mongoose.Types.ObjectId();

    const result = await applyStatusTransition({
      ticket,
      nextStatus: "in_progress",
      changedBy,
      reason: "manual",
    });

    expect(result.status).toBe("in_progress");
    expect(result.statusHistory).toHaveLength(0);
  });

  it("carries from/to/reason on the thrown error", async () => {
    const ticket = await seedTicket("closed");
    const changedBy = new mongoose.Types.ObjectId();

    try {
      await applyStatusTransition({ ticket, nextStatus: "answered", changedBy, reason: "auto_reply" });
      throw new Error("expected applyStatusTransition to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStatusTransitionError);
      const typed = err as InvalidStatusTransitionError;
      expect(typed.from).toBe("closed");
      expect(typed.to).toBe("answered");
      expect(typed.reason).toBe("auto_reply");
    }
  });
});
