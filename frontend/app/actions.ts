"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_URL, REFRESH_COOKIE } from "@/lib/auth";
import { clearSessionCookies } from "@/lib/session";

export async function logout() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort server-side revocation — local logout must still
      // succeed even if this call fails (network blip, backend down).
    }
  }

  await clearSessionCookies();
  redirect("/");
}
