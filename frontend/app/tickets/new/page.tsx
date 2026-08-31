import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { StaffSidebar } from "@/components/StaffSidebar";
import { SubmitTicketForm } from "./SubmitTicketForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NewTicket");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// USER_STORIES.md ticket-management Story 8 (customer self-service) and
// Story 57 (staff creating a ticket on a customer's behalf) — same route,
// same form component, mode picked by role. Form-only page, no backend GET
// on load, so the role gate reads the access token directly (same pattern as
// frontend/app/customers/new/page.tsx) rather than settings/page.tsx's
// fetch-then-401 pattern. The backend's requireAuth + customerOrPermitted
// (ticket.routes.ts) is what actually enforces this — in particular, a
// staff role reaching this page does NOT guarantee they hold
// tickets:create_for_customer (permissions live on the User doc, not the
// JWT); the server 403 surfaces as a "not permitted" alert in the form.
export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ _refreshed?: string }>;
}) {
  const { _refreshed } = await searchParams;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SESSION_COOKIE)?.value;
  const hasRefreshToken = Boolean(cookieStore.get(REFRESH_COOKIE)?.value);

  if (!accessToken) {
    if (hasRefreshToken && !_refreshed) {
      redirect("/api/session/refresh?next=/tickets/new");
    }
    redirect("/");
  }

  const { role } = peekJwtPayload(accessToken);
  if (role !== "customer" && role !== "agent" && role !== "admin" && role !== "subadmin") {
    redirect("/dashboard");
  }

  if (role === "customer") {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <SubmitTicketForm mode="customer" />
      </main>
    );
  }

  // Staff mode gets the same persistent StaffSidebar rail every other staff
  // page has (tickets queue, ticket detail, dashboard, ...) — this form was
  // previously the one staff-reachable page missing it entirely.
  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar active="tickets" />
      <main className="flex min-w-0 flex-1 items-center justify-center p-8">
        <SubmitTicketForm mode="staff" />
      </main>
    </div>
  );
}
