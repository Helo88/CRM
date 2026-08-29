// One-off dev bootstrap: inserts a demo customer account directly into
// MongoDB, so the frontend's "Fill demo credentials" button on /login
// (frontend/app/login/LoginForm.tsx) always has a real account to sign into.
// Same pattern as seed-admin.ts. Safe to re-run — skips if it already exists.
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

const BCRYPT_SALT_ROUNDS = 10;

const DEMO_CUSTOMER = { name: "Demo Customer", email: "demo@azmsquad.com", password: "Demo@12345" };

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }
  await mongoose.connect(uri);

  const existing = await User.findOne({ email: DEMO_CUSTOMER.email });
  if (existing) {
    console.log(`[seed-demo-customer] ${DEMO_CUSTOMER.email} already exists (role: ${existing.role}) — skipping`);
  } else {
    const passwordHash = await bcrypt.hash(DEMO_CUSTOMER.password, BCRYPT_SALT_ROUNDS);
    await User.create({
      name: DEMO_CUSTOMER.name,
      email: DEMO_CUSTOMER.email,
      passwordHash,
      role: "customer",
    });
    console.log(`[seed-demo-customer] created ${DEMO_CUSTOMER.email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed-demo-customer] failed:", err);
  process.exit(1);
});
