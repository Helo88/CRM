import { z } from "zod";
import { requiredString } from "./common";

export const SUBJECT_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 4000;
export const CATEGORY_MAX_LENGTH = 100;

const REQUIRED_MESSAGE = "subject and description are required";

// Only the fields every caller (customer or staff) can set are covered here
// — customerId/priority/notifyCustomer are staff-only, conditional on
// req.user's role (not known to a body-shape schema), and stay validated
// inline in ticket.routes.ts exactly as before.
export const createTicketBodySchema = z
  .object({
    subject: requiredString(REQUIRED_MESSAGE).max(
      SUBJECT_MAX_LENGTH,
      `subject must be at most ${SUBJECT_MAX_LENGTH} characters`
    ),
    description: requiredString(REQUIRED_MESSAGE).max(
      DESCRIPTION_MAX_LENGTH,
      `description must be at most ${DESCRIPTION_MAX_LENGTH} characters`
    ),
    category: z
      .string()
      .trim()
      .max(CATEGORY_MAX_LENGTH, `category must be at most ${CATEGORY_MAX_LENGTH} characters`)
      .nullable()
      .optional()
      .transform((val) => (val ? val : null)),
  })
  // customerId/priority/notifyCustomer are staff-only fields this schema
  // doesn't know about (see ticket.routes.ts) — passthrough so validateBody
  // replacing req.body with the parsed result doesn't silently drop them.
  .passthrough();
