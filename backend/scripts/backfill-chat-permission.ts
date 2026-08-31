// One-off migration: grants the new chats:manage permission to every
// existing "agent" account. Before this permission existed, live chat was
// gated by a bare `requireRole("agent", "admin")` — every agent already had
// unconditional chat access. Without this backfill, flipping that gate to
// requirePermission("chats:manage") would silently lock every
// already-created agent out of live chat the moment this ships, since
// permissions are stored per-account and never retroactively defaulted (see
// constants/permissions.ts's DEFAULT_PERMISSIONS_BY_ROLE comment — that list
// only pre-fills the admin UI's create-account stepper, it isn't applied to
// existing documents). Sub-admins are untouched here: they never had chat
// access before this permission existed, so there's no prior behavior to
// preserve for that role — an admin grants chats:manage to a sub-admin
// explicitly, same as any other permission. Safe to re-run — $addToSet is a
// no-op for an agent who already has it.
import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models/User";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  await mongoose.connect(uri);

  const result = await User.updateMany(
    { role: "agent", permissions: { $ne: "chats:manage" } },
    { $addToSet: { permissions: "chats:manage" } }
  );

  console.log(`[backfill-chat-permission] done, ${result.modifiedCount} agent account(s) updated`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[backfill-chat-permission] failed:", err);
  process.exit(1);
});
