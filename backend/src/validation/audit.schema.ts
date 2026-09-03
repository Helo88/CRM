import { z } from "zod";
import { AUDIT_ACTIONS } from "../models/AuditLog";
import { paginationQuerySchema, flexibleDateSchema } from "./common";

const SEARCH_QUERY_MAX_LENGTH = 200;

const AUDIT_CATEGORIES = ["auth", "permissions", "staff"] as const;

// Mirrors admin.schema.ts's listStaffAccountsQuerySchema — pagination +
// q (free-text actor name/email search) + a createdAt date range, same
// shape as ticket.schema.ts's createdFrom/createdTo (see ticket.routes.ts's
// GET / handler). Two independent filters narrow by action-granularity:
// `category` (auth/permissions/staff — matches the chosen UI's "filter by
// action-category" framing, a short 3-option Select) and `action` (the 5
// concrete action strings, more precise, exposed for API completeness/tests
// even though the frontend filter bar only surfaces `category`).
export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH).optional(),
  action: z.enum(AUDIT_ACTIONS as [string, ...string[]]).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  dateFrom: flexibleDateSchema().optional(),
  dateTo: flexibleDateSchema().optional(),
});
