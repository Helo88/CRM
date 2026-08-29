// One-off migration: assigns a ticketNumber to every existing ticket created
// before that field existed (see src/models/Ticket.ts's pre("validate") hook,
// which only fires for NEW documents). Processes oldest-first so creation
// order is preserved in the sequence. Safe to re-run — skips anyone who
// already has one.
import "dotenv/config";
import mongoose from "mongoose";
import { Ticket } from "../src/models/Ticket";
import { nextSequence } from "../src/models/Counter";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  await mongoose.connect(uri);

  const tickets = await Ticket.find({
    $or: [{ ticketNumber: { $exists: false } }, { ticketNumber: null }],
  }).sort({ createdAt: 1 });

  for (const ticket of tickets) {
    ticket.ticketNumber = await nextSequence("ticketNumber");
    await ticket.save();
    console.log(`[backfill-ticket-numbers] ${ticket.id} -> TCK-${ticket.ticketNumber}`);
  }

  console.log(`[backfill-ticket-numbers] done, ${tickets.length} ticket(s) updated`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[backfill-ticket-numbers] failed:", err);
  process.exit(1);
});
