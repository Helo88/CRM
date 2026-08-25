import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import type { JwtPayload } from "../middleware/auth";
import jwt from "jsonwebtoken";

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);
}

interface RegisterBody {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

// auth feature, Story 1: create a customer account (self-service sign-up is
// always role "customer" — agent/admin accounts are created by an admin,
// Story 44). Auto-logs the customer in by returning a JWT on success.
router.post("/register", async (req: Request<unknown, unknown, RegisterBody>, res: Response) => {
  const { name, email, password, phone } = req.body ?? {};

  if (!name || !email || !password) {
    res.status(400).json({ error: "name, email, and password are required" });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  let user;
  try {
    user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role: "customer",
      phone,
    });
  } catch (err) {
    // Guards the race between the findOne check above and this insert — the
    // unique index on User.email (models/User.ts line 60) is the
    // authoritative constraint; this only turns a raw MongoServerError into
    // a clean 409.
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    throw err;
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// auth feature, Story 2: log in with email/password for any role. Invalid
// credentials always return the same generic error — whether the email or
// the password was wrong, or the account is deactivated — so a caller can't
// enumerate registered emails or account status.
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ sub: user.id, role: user.role });
  res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

export default router;
