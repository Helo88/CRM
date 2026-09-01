import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { Hero, type HeroCopy } from "./_landing/Hero";
import {
  ProblemSection,
  SolutionSection,
  ProductSection,
  WorkflowSection,
  ValueSection,
  BilingualSection,
  CtaSection,
  FooterSection,
} from "./_landing/sections";
import styles from "./_landing/landing.module.css";

// Display and data/mono faces for the landing page only (the "Warm Stone"
// design system) — scoped via .variable on the page wrapper below, not
// applied to <html>/<body> in layout.tsx, so the rest of the app keeps
// Inter as its only face. Body text reuses --font-sans (Inter), already
// loaded once, site-wide, in layout.tsx.
const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
});
const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: { absolute: t("title") }, description: t("tagline") };
}

export default async function Home() {
  const t = await getTranslations("Home.Hero");
  const heroCopy: HeroCopy = {
    eyebrow: t("eyebrow"),
    headlineLead: t("headlineLead"),
    headlineEmphasis: t("headlineEmphasis"),
    sub: t("sub"),
    ctaPrimary: t("ctaPrimary"),
    ctaSecondary: t("ctaSecondary"),
    note: t("note"),
    meta1: t("meta1"),
    meta2: t("meta2"),
    meta3: t("meta3"),
    slaCaption: t("slaCaption"),
    annotationThreshold: t("annotationThreshold"),
    annotationHandoff: t("annotationHandoff"),
    ticketStatusAtRisk: t("ticketStatusAtRisk"),
    ticketTitle: t("ticketTitle"),
    ticketTagBilling: t("ticketTagBilling"),
    ticketTagHigh: t("ticketTagHigh"),
    ticketDueLabel: t("ticketDueLabel"),
    chatTitle: t("chatTitle"),
    chatStatusActive: t("chatStatusActive"),
    chatTagAi: t("chatTagAi"),
    chatMsg1: t("chatMsg1"),
    chatHandoff: t("chatHandoff"),
    chatTagAgent: t("chatTagAgent"),
    chatMsg2: t("chatMsg2"),
    chatMsg3: t("chatMsg3"),
    toast: t("toast"),
  };

  return (
    <div className={cn(styles.page, displayFont.variable, monoFont.variable)}>
      <main>
        <Hero copy={heroCopy} />
        <ProblemSection />
        <SolutionSection />
        <ProductSection />
        <WorkflowSection />
        <ValueSection />
        <BilingualSection />
        <CtaSection />
      </main>
      <FooterSection />
    </div>
  );
}
