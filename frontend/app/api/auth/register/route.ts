import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";

// BFF proxy for registration — same pattern as login/route.ts: the backend's
// JWT never reaches the browser directly, only via this httpOnly cookie.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const backendRes = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(data, { status: backendRes.status });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return NextResponse.json({ user: data.user }, { status: backendRes.status });
}
