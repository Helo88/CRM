"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

interface DemoStrings {
  aiMsg: string;
  handoff: string;
  agentMsg: string;
}

export interface BilingualDemoCopy {
  previewLabel: string;
  langEn: string;
  langAr: string;
  // The message-tag labels ("AI agent" / "Sara · Agent") come from the same
  // strings the hero composition uses and, matching the source artifact,
  // don't toggle with this demo's language switch — only the message
  // bodies and the handoff line do, via `en`/`ar` below.
  chatTagAi: string;
  chatTagAgent: string;
  en: DemoStrings;
  ar: DemoStrings;
}

// Deliberate deviation from the artifact: the artifact (a static, English-only
// mockup) always started this demo in English. Here, since the site actually
// has a current locale, it defaults to matching it — an Arabic-browsing
// visitor sees the demo already in Arabic rather than always in English.
export function BilingualDemo({ copy, initialLang }: { copy: BilingualDemoCopy; initialLang: "en" | "ar" }) {
  const [lang, setLang] = useState<"en" | "ar">(initialLang);
  const demo = copy[lang];

  return (
    <div className={styles.langDemo}>
      <div className={styles.langDemoHead}>
        <span className={styles.langDemoLabel}>{copy.previewLabel}</span>
        <div className={styles.langSwitch}>
          <button
            type="button"
            className={cn(lang === "en" && styles.langSwitchActive)}
            aria-pressed={lang === "en"}
            onClick={() => setLang("en")}
          >
            {copy.langEn}
          </button>
          <button
            type="button"
            className={cn(lang === "ar" && styles.langSwitchActive)}
            aria-pressed={lang === "ar"}
            onClick={() => setLang("ar")}
          >
            {copy.langAr}
          </button>
        </div>
      </div>
      <div dir={lang === "ar" ? "rtl" : "ltr"}>
        <div className={styles.chatBody} style={{ gap: 10, padding: 0 }}>
          <div className={cn(styles.msg, styles.msgIn)}>
            <span className={cn(styles.msgTag, styles.msgTagAi)}>{copy.chatTagAi}</span>
            <span>{demo.aiMsg}</span>
          </div>
          <div className={styles.handoffRow}>
            <span className={styles.handoffLine} />
            <span>{demo.handoff}</span>
            <span className={styles.handoffLine} />
          </div>
          <div className={cn(styles.msg, styles.msgIn)}>
            <span className={cn(styles.msgTag, styles.msgTagAgent)}>{copy.chatTagAgent}</span>
            <span>{demo.agentMsg}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
