import { NextRequest } from "next/server";
import { proxyCustomerFile } from "@/lib/customerFileProxy";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyCustomerFile(`/api/v1/customers/${id}/id-document/file`);
}
