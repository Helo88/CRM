import { NextRequest } from "next/server";
import { proxyCustomerFile } from "@/lib/customerFileProxy";

// Reuses proxyCustomerFile (frontend/lib/customerFileProxy.ts) — despite the
// name, it's fully generic: any backend path, cookie-based bearer token,
// one 401-retry, streams the response through. Same reasoning as the
// customer-attachments proxy route it mirrors.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string; attachmentId: string }> }
) {
  const { id, messageId, attachmentId } = await params;
  return proxyCustomerFile(`/api/v1/tickets/${id}/messages/${messageId}/attachments/${attachmentId}`);
}
