"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { API_URL, SESSION_COOKIE } from "@/lib/auth";
import { refreshSession } from "@/lib/session";
import { UNSPECIFIED_CATEGORY } from "./constants";

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

  // "unspecified" is a real, always-present dropdown choice (not an empty
  // placeholder) for both customer and staff — maps to no category at all.
  const resolvedCategory = category === UNSPECIFIED_CATEGORY ? undefined : category;

  const body =
    mode === "staff"
      ? { subject, description, customerId, category: resolvedCategory, priority, notifyCustomer }
      : { subject, description, category: resolvedCategory };

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

  return { error: null, referenceNumber: data.reference };
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

// Backs the staff-mode category dropdown (Story 57, wired up to real data
// now that Story 58 exists — this form originally shipped with a free-text
// category input plus a "free-text until Story 58 ships" hint, per its own
// original scope note). Ticket.category is a name-copied string, not an
// ObjectId reference (see backend/src/models/TicketCategory.ts), so the
// dropdown's value is the category's name, not its id.
export async function listActiveTicketCategories(): Promise<string[]> {
  const cookieStore = await cookies();
  let token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    token = (await refreshSession()) ?? undefined;
  }
  if (!token) {
    return [];
  }

  const doFetch = (bearer: string) =>
    fetch(`${API_URL}/api/v1/ticket-categories?active=true`, {
      headers: { Authorization: `Bearer ${bearer}` },
      cache: "no-store",
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    const refreshedToken = await refreshSession();
    if (!refreshedToken) return [];
    res = await doFetch(refreshedToken);
  }
  if (!res.ok) return [];

  const data: { name: string }[] = await res.json();
  return data.map((c) => c.name);
}
