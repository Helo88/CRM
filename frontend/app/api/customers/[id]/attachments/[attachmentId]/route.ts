import { NextRequest } from "next/server";
import { proxyCustomerFile } from "@/lib/customerFileProxy";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  return proxyCustomerFile(`/api/v1/customers/${id}/attachments/${attachmentId}`);
}
