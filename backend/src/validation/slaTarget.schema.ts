import { z } from "zod";
import { TICKET_CATEGORY_NAME_MAX_LENGTH } from "../models/TicketCategory";

const priorityEnum = z.enum(["low", "medium", "high", "urgent"]).nullable();
const categorySchema = z.string().trim().min(1).max(TICKET_CATEGORY_NAME_MAX_LENGTH).nullable();
const minutesSchema = z.number().int().positive();

export const createSlaTargetBodySchema = z
  .object({
    priority: priorityEnum.default(null),
    category: categorySchema.default(null),
    responseMinutes: minutesSchema,
    resolutionMinutes: minutesSchema,
  })
  .refine((v) => v.resolutionMinutes >= v.responseMinutes, {
    message: "resolutionMinutes must be greater than or equal to responseMinutes",
    path: ["resolutionMinutes"],
  });

export const updateSlaTargetBodySchema = z
  .object({
    priority: priorityEnum.optional(),
    category: categorySchema.optional(),
    responseMinutes: minutesSchema.optional(),
    resolutionMinutes: minutesSchema.optional(),
  })
  .refine(
    (v) =>
      v.responseMinutes === undefined ||
      v.resolutionMinutes === undefined ||
      v.resolutionMinutes >= v.responseMinutes,
    { message: "resolutionMinutes must be greater than or equal to responseMinutes", path: ["resolutionMinutes"] }
  );

export const updateSlaSystemSettingsBodySchema = z
  .object({
    atRiskPercent: z.number().int().min(1).max(99).optional(),
    scanIntervalMinutes: z.number().int().min(1).max(60).optional(),
  })
  .refine((v) => v.atRiskPercent !== undefined || v.scanIntervalMinutes !== undefined, {
    message: "at least one of atRiskPercent, scanIntervalMinutes is required",
  });
