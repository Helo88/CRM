import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

// Shared by the two customer-file proxy routes (attachments, id-document).
// The backend's file routes require Authorization: Bearer — the token lives
// only in an httpOnly cookie, never readable by client JS, so a plain
// <img src>/<a href> can't reach the backend directly (wrong origin, and no
// way to attach the header even if the origin were right). This Route
// Handler is the one place that can read the cookie AND respond to a raw
// browser GET, so it reads the token server-side, re-fetches with a
// refreshed one once on 401 (same retry shape used elsewhere), and streams
// the backend's response straight through.
export async function proxyCustomerFile(backendPath: string): Promise<NextResponse> {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}${backendPath}`, { headers: { Authorization: `Bearer ${bearer}` } });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
    }
    res = await doFetch(refreshed);
  }

  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Not found" }, { status: res.status || 404 });
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? "attachment",
    },
  });
}
