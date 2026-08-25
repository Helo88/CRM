import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { SettingsForm } from "./SettingsForm";

// Server Component: reads the httpOnly session cookie server-side and calls
// the backend directly — the JWT never reaches client-side JavaScript.
// middleware.ts already redirects unauthenticated requests before this
// renders; the check here is defense in depth, not the only gate.
export default async function SettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    redirect("/");
  }

  const res = await fetch(`${API_URL}/api/v1/me/contact`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    redirect("/");
  }
  const contact = await res.json();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <SettingsForm contact={contact} />
    </main>
  );
}
