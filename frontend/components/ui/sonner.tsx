"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Not next-themes-based like shadcn's stock generator output — this project
// resolves theme server-side from a cookie (see RootLayout) and passes it
// down as a plain prop, same as every other theme-aware component here
// (ThemeToggleButton, etc.). Maps sonner's semantic CSS variables to this
// project's actual design tokens (app/globals.css) instead of sonner's
// built-in `richColors` palette, which doesn't match the app's amber/warm
// palette at all.
export function Toaster({ theme, ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--success)",
          "--success-text": "var(--success-foreground)",
          "--success-border": "var(--success)",
          "--warning-bg": "var(--warning)",
          "--warning-text": "var(--warning-foreground)",
          "--warning-border": "var(--warning)",
          "--error-bg": "var(--destructive)",
          "--error-text": "var(--destructive-foreground)",
          "--error-border": "var(--destructive)",
        } as CSSProperties
      }
      {...props}
    />
  );
}
