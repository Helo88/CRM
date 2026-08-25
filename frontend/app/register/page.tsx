import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

// Server Component: redirects an already-signed-in visitor away, same guard
// pattern as login/page.tsx. The form itself is a Client Component only for
// useActionState's pending/error UI — the actual mutation runs server-side
// via the "register" Server Action (./actions.ts).
export default async function RegisterPage() {
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE)?.value) {
    redirect("/settings");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <RegisterForm />
    </main>
  );
}
