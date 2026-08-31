import { z } from "zod";
import { isValidPhone } from "../utils/phone";
import { emailSchema } from "./common";

// Format-only — "this is already your current email" / "email already in
// use" / the confirm-email send both depend on the loaded user document and
// stay inline in me.routes.ts.
export const contactBodySchema = z.object({
  phone: z
    .string({ error: "phone must be a string" })
    .trim()
    .refine((val) => val === "" || isValidPhone(val), { message: "phone must be a valid phone number" })
    .transform((val) => (val === "" ? undefined : val))
    .optional(),
  email: emailSchema("valid email is required").optional(),
});

export const availabilityBodySchema = z.object({
  isOnline: z.boolean({ error: "isOnline must be a boolean" }),
});

// Backs the "view all notifications" history page. All fields optional and
// only meaningfully used together — GET /me/notifications switches into
// full-history mode (paginated, date-filterable, newest-first) whenever
// ANY of these is present; with none present it keeps its original
// bell-dropdown behavior (unread-first, capped at 50, plain array) so that
// existing caller is untouched.
export const notificationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  from: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional(),
  to: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).optional(),
});
