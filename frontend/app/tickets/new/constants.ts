// Shared between SubmitTicketForm.tsx (client) and actions.ts ("use server"
// — which can only export async functions, so this small constant lives in
// its own plain module rather than either of those). The sentinel value for
// "no category chosen, unsure which fits" — a real, always-present option
// in the dropdown rather than an empty/placeholder state, per design.
export const UNSPECIFIED_CATEGORY = "unspecified";
