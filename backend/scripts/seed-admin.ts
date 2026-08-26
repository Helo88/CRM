// One-off dev bootstrap: inserts admin accounts directly into MongoDB.
// Needed because self-service /register always creates role "customer"
// (backend/src/routes/auth.routes.ts) and the in-app "admin creates
// agent/admin accounts" feature (USER_STORIES.md Story 45) isn't built yet.
// Safe to re-run — skips any email that already exists.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

const BCRYPT_SALT_ROUNDS = 10;

const ADMINS = [
  { name: "Admin One", email: "admin@azmsquad.com", password: "Admin@12345" },
  { name: "Admin Two", email: "admin2@azmsquad.com", password: "Admin@12345" },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  await mongoose.connect(uri);

  for (const admin of ADMINS) {
    const existing = await User.findOne({ email: admin.email });
    if (existing) {
      console.log(`[seed-admin] ${admin.email} already exists (role: ${existing.role}) — skipping`);
      continue;
    }
    const passwordHash = await bcrypt.hash(admin.password, BCRYPT_SALT_ROUNDS);
    await User.create({
      name: admin.name,
      email: admin.email,
      passwordHash,
      role: "admin",
    });
    console.log(`[seed-admin] created ${admin.email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed-admin] failed:", err);
  process.exit(1);
});
