import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { NewCustomerForm } from "./NewCustomerForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NewCustomer");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// USER_STORIES.md customer-management Story 55. No backend call happens on
// load (just a form), so there's no natural 401/403 response to gate on like
// the list/detail pages have — permissions are checked directly from the
// access token here instead, mirroring customer.routes.ts's POST /
// (staffOrDelegatedSubadmin("customers:manage")) exactly: admin
// unconditional, agent/subadmin need the grant. Still just a UI nicety: that
// backend check is what really enforces this.
export default async function NewCustomerPage({
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
      redirect("/api/session/refresh?next=/customers/new");
    }
    redirect("/");
  }

  const { role, permissions = [] } = peekJwtPayload(accessToken);
  const canCreateCustomer = role === "admin" || permissions.includes("customers:manage");
  if (!canCreateCustomer) {
    redirect("/customers");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <NewCustomerForm />
    </main>
  );
}
