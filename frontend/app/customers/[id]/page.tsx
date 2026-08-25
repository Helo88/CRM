import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { CustomerProfileForm } from "./CustomerProfileForm";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    redirect("/");
  }

  const t = await getTranslations("CustomerProfile");
  const res = await fetch(`${API_URL}/api/v1/customers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
        <p className="text-muted-foreground">{t("notFound")}</p>
      </main>
    );
  }

  const profile = await res.json();

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center p-8">
      <CustomerProfileForm profile={profile} />
    </main>
  );
}
