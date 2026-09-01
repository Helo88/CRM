"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

// In-page anchor links (`#solution`, `#product`, ...) with a smooth scroll,
// implemented locally rather than via a global `html { scroll-behavior:
// smooth }` rule — that global CSS property would affect every page's
// scrolling, not just this one, which is out of this page's scope.
export function SmoothAnchor({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!href || !href.startsWith("#")) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
