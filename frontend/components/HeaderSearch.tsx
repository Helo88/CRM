"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { visibleStaffNavItems, visibleStaffActionItems } from "@/lib/staffNav";
import { CUSTOMER_SEARCH_ITEMS } from "@/lib/customerSearch";

// Real quick-nav-and-action search (not decorative) — jumps to pages
// (Customers/Accounts/...) and quick-create actions (New ticket/New
// customer/...) via ⌘K or a click. No fake results. Takes only plain
// serializable props (variant/role) and resolves the actual item list
// (staffNav.ts / customerSearch.ts) itself — those lists carry Lucide icon
// component references, which cannot cross the Server-to-Client prop
// boundary from SiteHeader (a Server Component); only primitives can.
export function HeaderSearch({ variant, role }: { variant: "staff" | "customer"; role?: string }) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const items =
    variant === "staff"
      ? [...visibleStaffNavItems(role), ...visibleStaffActionItems(role)]
      : CUSTOMER_SEARCH_ITEMS;
  const labeledItems = items.map((item) => ({ ...item, label: t(item.key) }));
  const matches = query.trim()
    ? labeledItems.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : labeledItems;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div className="relative hidden sm:block">
      <div className="flex h-9 w-40 items-center gap-2 rounded-xl border border-input bg-muted/40 px-3 text-sm text-muted-foreground shadow-soft transition-colors focus-within:border-ring focus-within:bg-card sm:w-52 lg:w-64">
        <Search className="size-4 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) go(matches[0].href);
            if (e.key === "Escape") inputRef.current?.blur();
          }}
          placeholder={t("searchPlaceholderShort")}
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
          aria-label={t("search")}
        />
        <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </div>
      {open && matches.length > 0 && (
        <ul className="absolute start-0 top-full z-30 mt-1.5 w-full min-w-48 overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-card">
          {matches.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(item.href)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm hover:bg-muted"
              >
                <item.icon className="size-4 text-muted-foreground" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
