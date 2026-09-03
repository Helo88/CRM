import { NextRequest } from "next/server";
import { proxyCustomerFile } from "@/lib/customerFileProxy";

// Same reasoning as app/api/tickets/[id]/messages/[messageId]/attachments/[attachmentId]/route.ts:
// the bearer token lives only in an httpOnly cookie, so a plain <a href>
// can't reach the backend's protected export route directly.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyCustomerFile(`/api/v1/tickets/${id}/history/export`);
}
