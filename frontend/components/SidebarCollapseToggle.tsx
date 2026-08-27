"use client";

import { useRouter } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SIDEBAR_COLLAPSED_COOKIE } from "@/lib/sidebar";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// One consistent icon regardless of state, not a left/right-pointing pair —
// those read ambiguously once the sidebar can sit on either side (RTL).
export function SidebarCollapseToggle({
  collapsed,
  expandLabel,
  collapseLabel,
}: {
  collapsed: boolean;
  expandLabel: string;
  collapseLabel: string;
}) {
  const router = useRouter();

  function toggle() {
    const next = !collapsed;
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={collapsed ? expandLabel : collapseLabel}
      aria-pressed={collapsed}
    >
      <PanelLeft className="size-4" />
    </Button>
  );
}
