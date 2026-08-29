import { z } from "zod";
import { emailSchema, optionalPhoneSchema, passwordSchema, requiredString } from "./common";

// Only /register goes through zod here — /login, /refresh, and /logout
// deliberately keep their hand-rolled checks (see auth.routes.ts): those
// return a generic 401 by design, to avoid distinguishing "malformed
// request" from "wrong credentials"/"invalid token" for an
// anti-enumeration/anti-probing reason a generic 400 shape-validator would
// undermine.
export const registerBodySchema = z.object({
  name: requiredString("name is required"),
  email: emailSchema("valid email is required"),
  password: passwordSchema("password is required"),
  phone: optionalPhoneSchema().optional(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
