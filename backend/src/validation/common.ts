import { z } from "zod";
import mongoose from "mongoose";
import { isValidPhone } from "../utils/phone";

export const MIN_PASSWORD_LENGTH = 8;

// Matches the ad hoc `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` regex previously
// duplicated across auth/admin/customer/me routes — kept as a refinement
// (not zod's built-in `.email()`) so the accepted-address shape doesn't
// silently change during this migration.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredString(message: string) {
  return z.string({ error: message }).trim().min(1, message);
}

// Shared by every paginated list route (customers, admin/users, and
// ticket.schema.ts's listTicketsQuerySchema, which extends its own inline
// copy predating this) so the page/limit contract can't drift between them.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const objectIdSchema = (message = "Invalid id") =>
  z.string({ error: message }).refine((val) => mongoose.isValidObjectId(val), { message });

// Accepts either a plain date ("2026-01-31") or a full ISO datetime with
// offset — every from/to date-range query param in the app (notifications
// history, ticket list) uses this same shape so the frontend's date-only
// pickers and any future datetime-precise caller both work unmodified.
export const flexibleDateSchema = () => z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

// Shared by every `:id`-as-a-user-document route (admin staff accounts,
// customer profiles) — same format check, same message, in every one of them.
export const userIdParamsSchema = z.object({ id: objectIdSchema("Invalid user id") });

export const emailSchema = (message = "valid email is required") =>
  z
    .string({ error: message })
    .trim()
    .toLowerCase()
    .refine((val) => EMAIL_FORMAT.test(val), { message });

export const passwordSchema = (requiredMessage = "password is required") =>
  z
    .string({ error: requiredMessage })
    .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);

// Trims and accepts "" (callers decide whether empty means "omitted"/"clear").
export const optionalPhoneSchema = (message = "phone must be a valid phone number") =>
  z
    .string({ error: message })
    .trim()
    .refine((val) => val === "" || isValidPhone(val), { message });
