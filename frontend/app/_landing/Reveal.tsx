"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

// Scroll-triggered fade/rise, ported from the artifact's shared
// IntersectionObserver (threshold 0.1, rootMargin "0px 0px -60px 0px",
// reveals once then stops observing). Purely behavioral — this only ever
// carries the reveal opacity/transform, never layout classes; the section
// puts its own layout class on a child element.
export function Reveal({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(styles.reveal, inView && styles.in, className)}>
      {children}
    </div>
  );
}
