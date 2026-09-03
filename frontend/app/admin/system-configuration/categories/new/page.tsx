import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE, REFRESH_COOKIE } from "@/lib/auth";
import { peekJwtPayload } from "@/lib/jwt";
import { NewTicketCategoryForm } from "./NewTicketCategoryForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NewTicketCategory");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// Reachable by a true admin or a sub-admin delegated tickets:categories_create
// (the same key the POST itself requires) — checked directly from the
// access token, same UI-nicety caveat as admin/users/new/page.tsx:
// requirePermission on the actual POST is what really enforces this.
export default async function NewTicketCategoryPage({
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
      redirect("/api/session/refresh?next=/admin/system-configuration/categories/new");
    }
    redirect("/");
  }

  const { role, permissions = [] } = peekJwtPayload(accessToken);
  if (role !== "admin" && !permissions.includes("tickets:categories_create")) {
    redirect("/dashboard");
  }

  return (
    <main className="flex items-center justify-center p-8">
      <NewTicketCategoryForm />
    </main>
  );
}
