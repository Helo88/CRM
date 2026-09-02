"use client";

import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, MouseEvent } from "react";

// In-page anchor links (`#solution`, `#product`, ...) with a smooth scroll,
// implemented locally rather than via a global `html { scroll-behavior:
// smooth }` rule — that global CSS property would affect every page's
// scrolling, not just this one, which is out of this page's scope.
// When the target section doesn't exist on the current page (e.g. clicking
// a landing-page nav link from /register), navigates to the home page
// with the hash so the user lands at the right section.
export function SmoothAnchor({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const router = useRouter();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!href || !href.startsWith("#")) return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    } else {
      e.preventDefault();
      router.push("/" + href);
    }
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
