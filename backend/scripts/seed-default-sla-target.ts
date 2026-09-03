// One-off / idempotent bootstrap: ensures the mandatory default SLA target
// row (priority: null, category: null) exists. sla-automation Story 26's
// resolver treats a missing default row as a hard misconfiguration error,
// so this must run at least once per environment before any ticket is
// created. Safe to re-run — $setOnInsert only writes on first insert.
import "dotenv/config";
import mongoose from "mongoose";
import { SlaTarget } from "../src/models/SlaTarget";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  await mongoose.connect(uri);

  const result = await SlaTarget.updateOne(
    { priority: null, category: null },
    { $setOnInsert: { responseMinutes: 60, resolutionMinutes: 8 * 60 } },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log("[seed-default-sla-target] created default SLA target (60m response / 8h resolution)");
  } else {
    console.log("[seed-default-sla-target] default SLA target already exists — skipping");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed-default-sla-target] failed:", err);
  process.exit(1);
});
