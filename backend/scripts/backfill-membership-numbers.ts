// One-off migration: assigns a membershipNumber to every existing user
// created before that field existed (see src/models/User.ts's pre("validate")
// hook, which only fires for NEW documents). Processes oldest-first so
// seniority order is preserved in the sequence. Safe to re-run — skips
// anyone who already has one.
import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models/User";
import { nextSequence } from "../src/models/Counter";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  await mongoose.connect(uri);

  const users = await User.find({
    $or: [{ membershipNumber: { $exists: false } }, { membershipNumber: null }],
  }).sort({ createdAt: 1 });

  for (const user of users) {
    const seq = await nextSequence("membershipNumber");
    user.membershipNumber = String(seq).padStart(10, "0");
    await user.save();
    console.log(`[backfill-membership-numbers] ${user.email} -> ${user.membershipNumber}`);
  }

  console.log(`[backfill-membership-numbers] done, ${users.length} account(s) updated`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[backfill-membership-numbers] failed:", err);
  process.exit(1);
});
