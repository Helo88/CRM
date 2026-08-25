import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE)?.value) {
    redirect("/settings");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <LoginForm />
    </main>
  );
}
