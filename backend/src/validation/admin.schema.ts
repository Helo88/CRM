import { z } from "zod";
import { PERMISSION_KEYS } from "../constants/permissions";
import { emailSchema, passwordSchema, paginationQuerySchema, requiredString, userIdParamsSchema } from "./common";

export const staffIdParamsSchema = userIdParamsSchema;

const SEARCH_QUERY_MAX_LENGTH = 200;

export const ALLOWED_STAFF_SORT_KEYS = ["createdAt", "name"] as const;

// Query params for GET / (the staff/agent/admin roster) — filters added at
// the user's direct request, mirroring ticket.schema.ts's
// listTicketsQuerySchema pattern. `role` here is any roster TARGET
// (agent/admin/subadmin), unlike creatableRoleSchema below which excludes
// "admin" — admin accounts are visible in the roster even though they can't
// be created through this router.
export const listStaffAccountsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH).optional(),
  role: z.enum(["agent", "admin", "subadmin"]).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  isOnline: z.enum(["true", "false"]).optional(),
  sort: z
    .string()
    .regex(
      new RegExp(`^-?(${ALLOWED_STAFF_SORT_KEYS.join("|")})$`),
      `sort must be one of: ${ALLOWED_STAFF_SORT_KEYS.join(", ")}, optionally prefixed with -`
    )
    .optional(),
});

// "admin" is a valid STAFF_ROLE (a roster target) but never a CREATABLE one
// — see admin.routes.ts's CREATABLE_STAFF_ROLES comment. Kept as its own
// enum here (not shared with the roster's STAFF_ROLES) for that reason.
const creatableRoleSchema = z.enum(["agent", "subadmin"], {
  error: "role must be one of: agent, subadmin",
});

// Only validates that every key is one of the fixed permission-key strings
// (shape). The further "subadmin-only keys can't go on an agent" rule
// depends on the target role, which isn't known from this field alone — see
// filterPermissionsForRole in admin.routes.ts for that business-rule check.
const permissionsSchema = z
  .array(z.enum(PERMISSION_KEYS), {
    error: "permissions must be an array of valid permission keys",
  })
  .transform((keys) => Array.from(new Set(keys)))
  .optional();

export const createStaffAccountBodySchema = z.object({
  name: requiredString("name is required"),
  email: emailSchema(),
  password: passwordSchema(),
  role: creatableRoleSchema,
  permissions: permissionsSchema,
});

export const updateStaffAccountBodySchema = z.object({
  name: requiredString("name must be a non-empty string").optional(),
  email: emailSchema().optional(),
  role: creatableRoleSchema.optional(),
  permissions: permissionsSchema,
});
