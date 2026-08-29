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
