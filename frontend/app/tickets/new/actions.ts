"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";

const submitTicketSchema = z.object({
  mode: z.enum(["customer", "staff"]),
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(4000),
  customerId: z.string().trim().optional(),
  category: z.string().trim().max(100).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  notifyCustomer: z.boolean().optional(),
});

export interface SubmitTicketActionState {
  error: string | null;
  fieldErrors?: { subject?: string; description?: string; customerId?: string; priority?: string };
  referenceNumber?: string;
}

export async function submitTicket(
  _prevState: SubmitTicketActionState,
  formData: FormData
): Promise<SubmitTicketActionState> {
  const t = await getTranslations("NewTicket");
  const parsed = submitTicketSchema.safeParse({
    mode: formData.get("mode"),
    subject: formData.get("subject"),
    description: formData.get("description"),
    customerId: formData.get("customerId") || undefined,
    category: formData.get("category") || undefined,
    priority: formData.get("priority") || undefined,
    notifyCustomer: formData.get("notifyCustomer") === "true",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      error: null,
      fieldErrors: {
        subject: fieldErrors.subject ? t("subjectRequired") : undefined,
        description: fieldErrors.description ? t("descriptionRequired") : undefined,
      },
    };
  }

  const { mode, subject, description, customerId, category, priority, notifyCustomer } = parsed.data;

  if (mode === "staff" && !customerId) {
    return { error: null, fieldErrors: { customerId: t("customerRequired") } };
  }

  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { error: t("notSignedIn") };
  }

  const body =
    mode === "staff"
      ? { subject, description, customerId, category, priority, notifyCustomer }
      : { subject, description };

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { error: t("notSignedIn") };
    }
    res = await doFetch(refreshedToken);
  }

  const data = await res.json();

  if (!res.ok) {
    if (res.status === 403) {
      return { error: t("notPermitted") };
    }
    return { error: data.error ?? t("genericError") };
  }

  return { error: null, referenceNumber: data.id };
}

export interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

export interface ListCustomersResult {
  customers: CustomerOption[];
  forbidden: boolean;
}

// Backs the staff-mode customer picker (Story 57). Reuses the existing
// paginated roster endpoint (customer-management Story 55) rather than a
// new search endpoint — first page only, the combobox filters client-side
// over these results. TODO: server-side search once the roster grows past
// one page in practice.
export async function listCustomersForPicker(): Promise<ListCustomersResult> {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return { customers: [], forbidden: true };
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/customers?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) {
      return { customers: [], forbidden: true };
    }
    res = await doFetch(refreshedToken);
  }
  if (res.status === 403) {
    return { customers: [], forbidden: true };
  }
  if (!res.ok) {
    return { customers: [], forbidden: false };
  }

  const data: { customers: { id: string; name: string; email: string }[] } = await res.json();
  return {
    customers: data.customers.map((c) => ({ id: c.id, name: c.name, email: c.email })),
    forbidden: false,
  };
}
