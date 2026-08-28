"use client";

import { useEffect, useState } from "react";

export function Typewriter({ text, speedMs = 35 }: { text: string; speedMs?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => setCount(0), [text]);

  useEffect(() => {
    if (count >= text.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), speedMs);
    return () => clearTimeout(id);
  }, [count, text, speedMs]);

  return (
    <span className="relative">
      <span aria-hidden="true">
        {text.slice(0, count)}
        <span className="bg-primary animate-pulse ms-0.5 inline-block h-[1em] w-px translate-y-[0.15em]" />
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
