import { redirect } from "next/navigation";

// sla-automation Story 25, Frontend Task 7a: ticket categories moved under
// the /admin/system-configuration shell. This stub keeps any existing
// bookmark/link working instead of 404ing.
export default function TicketCategoriesRedirect() {
  redirect("/admin/system-configuration/categories");
}
