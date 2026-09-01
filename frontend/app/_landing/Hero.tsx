"use client";

import { Typewriter } from "@/components/Typewriter";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheckIcon } from "./icons";
import styles from "./landing.module.css";

export interface HeroCopy {
  eyebrow: string;
  headlineLead: string;
  headlineEmphasis: string;
  sub: string;
  ctaPrimary: string;
  ctaSecondary: string;
  note: string;
  meta1: string;
  meta2: string;
  meta3: string;
  slaCaption: string;
  annotationThreshold: string;
  annotationHandoff: string;
  ticketStatusAtRisk: string;
  ticketTitle: string;
  ticketTagBilling: string;
  ticketTagHigh: string;
  ticketDueLabel: string;
  chatTitle: string;
  chatStatusActive: string;
  chatTagAi: string;
  chatMsg1: string;
  chatHandoff: string;
  chatTagAgent: string;
  chatMsg2: string;
  chatMsg3: string;
  toast: string;
}

// Hero entrance choreography, ported from the artifact's script: a double
// requestAnimationFrame before adding the "play" class, so the initial
// (hidden) state paints first and the staggered CSS animations actually
// play instead of skipping straight to their end state.
export function Hero({ copy }: { copy: HeroCopy }) {
  const [playing, setPlaying] = useState(false);
  const [showTypewriter, setShowTypewriter] = useState(false);

  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPlaying(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Coordinated with, not competing against, the eyebrow's own entrance:
  // that pill fades in via CSS (.heroEyebrowStagger, 0.6s animation + 0.05s
  // delay = fully visible ~0.65s after `playing`). Only mounting Typewriter
  // once that's finished means the pill appears first, whole and settled,
  // then its text types out inside it — not two uncoordinated animations
  // firing at once.
  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => setShowTypewriter(true), 680);
    return () => clearTimeout(id);
  }, [playing]);

  function scrollToSolution(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById("solution");
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth" });
  }

  return (
    // Not a <header>: SiteHeader (rendered from RootLayout on every page)
    // is already this page's <header>/banner landmark. A second top-level
    // <header> here would compute to a duplicate role="banner".
    <div className={styles.hero} id="top">
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={cn(styles.wrap, styles.heroGrid, styles.heroAnim, playing && styles.play)}>
        <div>
          <div className={cn(styles.eyebrow, styles.heroEyebrowStagger)}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            {/* The hidden sizer reserves the pill's final width from the
                first frame (so it doesn't visibly grow as characters type
                in). A plain sr-only fallback covers the gap between first
                paint and the typewriter mounting (including the initial
                server-rendered HTML, where showTypewriter starts false) so
                the text is never accessibly absent; Typewriter carries its
                own sr-only copy once it takes over, so the wrapper around
                it must NOT be aria-hidden or that would suppress it too. */}
            <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
              <span aria-hidden="true" style={{ visibility: "hidden" }}>
                {copy.eyebrow}
              </span>
              {!showTypewriter && <span className="sr-only">{copy.eyebrow}</span>}
              <span style={{ position: "absolute", insetInlineStart: 0, top: 0, whiteSpace: "nowrap" }}>
                {showTypewriter ? <Typewriter text={copy.eyebrow} /> : null}
              </span>
            </span>
          </div>
          <h1 className={cn(styles.heroTitle, styles.heroTitleStagger)}>
            {copy.headlineLead}
            <em className={styles.heroEmphasis}>{copy.headlineEmphasis}</em>
          </h1>
          <p className={cn(styles.heroSub, styles.heroSubStagger,"mt-5!")}>{copy.sub}</p>
          <div className={cn(styles.heroActions, styles.heroActionsStagger)}>
            <Link href="/register" className={cn(styles.btn, styles.btnPrimary)}>
              {copy.ctaPrimary}
            </Link>
            <a href="#solution" onClick={scrollToSolution} className={cn(styles.btn, styles.btnGhost)}>
              {copy.ctaSecondary} ↓
            </a>
          </div>
          <div className={cn(styles.heroNote, styles.heroNoteStagger)}>
            <span className={styles.heroNoteDot} aria-hidden="true" />
            <span>{copy.note}</span>
          </div>
          <div className={cn(styles.heroMeta, styles.heroMetaStagger)}>
            <div className={styles.heroMetaItem}>
              <CircleCheckIcon />
              {copy.meta1}
            </div>
            <div className={styles.heroMetaItem}>
              <CircleCheckIcon />
              {copy.meta2}
            </div>
            <div className={styles.heroMetaItem}>
              <CircleCheckIcon />
              {copy.meta3}
            </div>
          </div>
        </div>

        <div className={styles.heroStageOuter}>
          <div className={styles.stage}>
            <div className={cn(styles.panel, styles.slaRingCard)} aria-hidden="true">
              <div className={styles.ring}>
                <span className={styles.ringValue}>86%</span>
              </div>
              <small className={styles.slaRingCaption}>{copy.slaCaption}</small>
            </div>

            <div className={cn(styles.annot, styles.annotThreshold)} aria-hidden="true">
              <i className={styles.annotDot} />
              {copy.annotationThreshold}
            </div>
            <div className={cn(styles.annot, styles.annotHandoff)} aria-hidden="true">
              <i className={styles.annotDot} style={{ background: "var(--ai)" }} />
              {copy.annotationHandoff}
            </div>

            <div className={cn(styles.panel, styles.ticketCard)} aria-hidden="true">
              <div className={styles.tkTop}>
                <span className={styles.ticketId}>TKT-2481</span>
                <span className={cn(styles.badge, styles.badgeWarning)}>{copy.ticketStatusAtRisk}</span>
              </div>
              <h4>{copy.ticketTitle}</h4>
              <div className={styles.tkTags}>
                <span className={styles.tkTag}>{copy.ticketTagBilling}</span>
                <span className={styles.tkTag}>{copy.ticketTagHigh}</span>
              </div>
              <div className={styles.tkSla}>
                <span className={styles.tkAssignee}>
                  <span
                    className={cn(styles.avatar, styles.avatarAgent)}
                    style={{ width: 16, height: 16, fontSize: 8 }}
                  >
                    S
                  </span>
                  Sara
                </span>
                {copy.ticketDueLabel} <b>00:41:12</b>
              </div>
            </div>

            <div className={cn(styles.panel, styles.chatPanel)}>
              <div className={styles.chatHead}>
                <span className={cn(styles.avatar, styles.avatarAi)}>AI</span>
                <div>
                  <div className={styles.chatHeadName}>{copy.chatTitle}</div>
                  <div className={styles.chatHeadSub}>{copy.chatStatusActive}</div>
                </div>
              </div>
              <div className={styles.chatBody}>
                <div className={cn(styles.msg, styles.msgIn, styles.msg1)}>
                  <span className={cn(styles.msgTag, styles.msgTagAi)}>{copy.chatTagAi}</span>
                  {copy.chatMsg1}
                </div>
                <div className={cn(styles.typing, styles.typing1)}>
                  <span />
                  <span />
                  <span />
                </div>
                <div className={cn(styles.handoffRow, styles.handoff1)}>
                  <span className={styles.handoffLine} />
                  {copy.chatHandoff}
                  <span className={styles.handoffLine} />
                </div>
                <div className={cn(styles.msg, styles.msgIn, styles.msg2)}>
                  <span className={cn(styles.msgTag, styles.msgTagAgent)}>{copy.chatTagAgent}</span>
                  {copy.chatMsg2}
                </div>
                <div className={cn(styles.msg, styles.msgOut, styles.msg3)}>{copy.chatMsg3}</div>
              </div>
              <div className={styles.composer} aria-hidden="true">
                <div className={styles.composerLine} />
                <div className={styles.composerSend} />
              </div>
            </div>

            <div className={cn(styles.panel, styles.toast)} aria-hidden="true">
              <span className={styles.toastDot} />
              {copy.toast}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
