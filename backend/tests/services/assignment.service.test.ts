import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../../src/models/User";
import { Ticket } from "../../src/models/Ticket";
import { pickNextAvailableAgent } from "../../src/services/assignment.service";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri("assignment-service-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Ticket.deleteMany({});
});

async function seedAgent(overrides: Partial<{ isOnline: boolean; isActive: boolean; isDeleted: boolean; role: string; createdAt: Date }> = {}) {
  const user = await User.create({
    name: "Agent",
    email: `agent-${new mongoose.Types.ObjectId().toHexString()}@example.com`,
    passwordHash: "irrelevant-for-these-tests",
    role: overrides.role ?? "agent",
    isOnline: overrides.isOnline ?? true,
    isActive: overrides.isActive ?? true,
    isDeleted: overrides.isDeleted ?? false,
  });
  if (overrides.createdAt) {
    await User.updateOne({ _id: user._id }, { $set: { createdAt: overrides.createdAt } });
  }
  return user;
}

async function seedTicket(assignedAgent: mongoose.Types.ObjectId, status: string) {
  await Ticket.create({
    subject: "s",
    description: "d",
    customer: new mongoose.Types.ObjectId(),
    assignedAgent,
    status,
  });
}

describe("assignment.service.ts pickNextAvailableAgent (Story 10)", () => {
  it("returns null when no agent is online", async () => {
    await seedAgent({ isOnline: false });
    expect(await pickNextAvailableAgent()).toBeNull();
  });

  it("returns null when the only online agent is inactive", async () => {
    await seedAgent({ isOnline: true, isActive: false });
    expect(await pickNextAvailableAgent()).toBeNull();
  });

  it("returns null when the only online agent is soft-deleted", async () => {
    await seedAgent({ isOnline: true, isDeleted: true });
    expect(await pickNextAvailableAgent()).toBeNull();
  });

  it("returns null when the only online user has role=customer", async () => {
    await seedAgent({ isOnline: true, role: "customer" });
    expect(await pickNextAvailableAgent()).toBeNull();
  });

  it("picks the sole online agent when only one qualifies", async () => {
    const agent = await seedAgent();
    const picked = await pickNextAvailableAgent();
    expect(picked?.toString()).toBe(agent.id);
  });

  it("picks the least-busy online agent among two", async () => {
    const busy = await seedAgent();
    const free = await seedAgent();
    await seedTicket(busy._id, "new");
    await seedTicket(busy._id, "in_progress");
    await seedTicket(busy._id, "escalated");
    await seedTicket(free._id, "new");

    const picked = await pickNextAvailableAgent();
    expect(picked?.toString()).toBe(free.id);
  });

  it("does not count closed/answered tickets toward load", async () => {
    const busy = await seedAgent();
    const looksBusyButIsnt = await seedAgent();
    await seedTicket(busy._id, "new");
    await seedTicket(looksBusyButIsnt._id, "closed");
    await seedTicket(looksBusyButIsnt._id, "answered");
    await seedTicket(looksBusyButIsnt._id, "closed");

    // looksBusyButIsnt has more Ticket documents overall, but zero *open*
    // ones — if closed/answered wrongly counted toward load, `busy` (1 open)
    // would incorrectly look less loaded than 0. Assert the real winner.
    const picked = await pickNextAvailableAgent();
    expect(picked?.toString()).toBe(looksBusyButIsnt.id);
  });

  it("breaks ties by oldest createdAt when load is equal", async () => {
    const older = await seedAgent({ createdAt: new Date("2020-01-01") });
    const newer = await seedAgent({ createdAt: new Date("2024-01-01") });

    const picked = await pickNextAvailableAgent();
    expect(picked?.toString()).toBe(older.id);
    expect(picked?.toString()).not.toBe(newer.id);
  });
});
