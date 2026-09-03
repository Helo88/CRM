import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { StaffSidebar } from "@/components/StaffSidebar";
import { SystemConfigurationTabs } from "./SystemConfigurationTabs";

export async function generateMetadata() {
  const t = await getTranslations("SystemConfiguration");
  return { title: t("heading"), robots: { index: false, follow: false } };
}

// sla-automation Story 25 (define SLA targets), Frontend Task 7a: shared
// shell over /admin/system-configuration/* — one route for settings that
// used to (or would have) lived on separate top-level admin pages: ticket
// categories, SLA targets, the quick-reply library, and eventually branding.
// Each tab is a real, independently server-rendered page.tsx under this
// layout, not a client-side panel swap — see SystemConfigurationTabs.tsx.
export default async function SystemConfigurationLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("SystemConfiguration");

  return (
    <div className="flex min-h-[calc(100vh-57px)]">
      <StaffSidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subheading")}</p>
        </div>
        <div className="mb-6">
          <SystemConfigurationTabs />
        </div>
        {children}
      </main>
    </div>
  );
}
