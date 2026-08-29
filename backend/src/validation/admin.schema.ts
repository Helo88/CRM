import { z } from "zod";
import { PERMISSION_KEYS } from "../constants/permissions";
import { emailSchema, passwordSchema, requiredString, userIdParamsSchema } from "./common";

export const staffIdParamsSchema = userIdParamsSchema;

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
