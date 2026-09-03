import { redirect } from "next/navigation";

// The shell (layout.tsx) has no content of its own — landing on the bare
// root redirects to its first tab. Lets the sidebar's pinned nav item link
// to a stable parent path (so activeStaffNavKey's prefix match highlights
// it on every tab) without needing its own page.
export default function SystemConfigurationIndexRedirect() {
  redirect("/admin/system-configuration/categories");
}
