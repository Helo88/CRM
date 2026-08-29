import { z } from "zod";
import { TICKET_CATEGORY_NAME_MAX_LENGTH } from "../models/TicketCategory";
import { requiredString } from "./common";

const nameSchema = requiredString("name is required").max(
  TICKET_CATEGORY_NAME_MAX_LENGTH,
  `name must be at most ${TICKET_CATEGORY_NAME_MAX_LENGTH} characters`
);

export const createTicketCategoryBodySchema = z.object({
  name: nameSchema,
});

export const updateTicketCategoryBodySchema = z.object({
  name: nameSchema.optional(),
  active: z.boolean().optional(),
});
