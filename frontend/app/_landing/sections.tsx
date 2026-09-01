import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";
import { Reveal } from "./Reveal";
import { SmoothAnchor } from "./SmoothAnchor";
import { ProductTabs } from "./ProductTabs";
import { BilingualDemo } from "./BilingualDemo";
import { CheckIcon, AiAgentIcon, HumanAgentIcon, MailIcon } from "./icons";
import styles from "./landing.module.css";

export async function ProblemSection() {
  const t = await getTranslations("Home.Problem");
  return (
    <section id="problem" className={styles.section}>
      <div className={styles.wrap}>
        <Reveal>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("kicker")}</span>
            <h2>{t("heading")}</h2>
          </div>
        </Reveal>
        <Reveal>
          <p className={styles.problemLead}>{t("lead")}</p>
        </Reveal>
        <Reveal>
          <div className={styles.problemGrid}>
            <div className={styles.problemItem}>
              <span className={styles.problemItemLabel}>{t("item1Label")}</span>
              <h3>{t("item1Title")}</h3>
              <p>{t("item1Body")}</p>
            </div>
            <div className={styles.problemItem}>
              <span className={styles.problemItemLabel}>{t("item2Label")}</span>
              <h3>{t("item2Title")}</h3>
              <p>{t("item2Body")}</p>
            </div>
            <div className={styles.problemItem}>
              <span className={styles.problemItemLabel}>{t("item3Label")}</span>
              <h3>{t("item3Title")}</h3>
              <p>{t("item3Body")}</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export async function SolutionSection() {
  const t = await getTranslations("Home.Solution");
  return (
    <section id="solution" className={cn(styles.section, styles.sectionAlt)}>
      <div className={styles.wrap}>
        <Reveal>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("kicker")}</span>
            <h2>{t("heading")}</h2>
          </div>
        </Reveal>
        <div className={styles.mech}>
          <Reveal>
            {/* The artifact bolds specific mid-sentence phrases in this
                copy (e.g. "escalates to a human agent"). The extracted
                Home.Solution.para1-4 keys are plain strings with no
                markup, so that inline emphasis isn't reproducible without
                inventing which words to bold — rendered plain here; see
                report for this flagged as a deviation. */}
            <div className={styles.mechCopy}>
              <p>{t("para1")}</p>
              <p>{t("para2")}</p>
              <p>{t("para3")}</p>
              <p>{t("para4")}</p>
            </div>
          </Reveal>
          <Reveal>
            <div className={styles.route}>
              <div className={styles.routeStep}>
                <span className={cn(styles.routeIco, styles.routeIcoAi)}>
                  <AiAgentIcon />
                </span>
                <div className={styles.routeBody}>
                  <b>{t("step1Title")}</b>
                  <span>{t("step1Body")}</span>
                </div>
              </div>
              <div className={styles.routeStep}>
                <span className={cn(styles.routeIco, styles.routeIcoHuman)}>
                  <HumanAgentIcon />
                </span>
                <div className={styles.routeBody}>
                  <b>{t("step2Title")}</b>
                  <span>{t("step2Body")}</span>
                </div>
              </div>
              <div className={styles.routeStep}>
                <span className={cn(styles.routeIco, styles.routeIcoMail)}>
                  <MailIcon />
                </span>
                <div className={styles.routeBody}>
                  <b>{t("step3Title")}</b>
                  <span>{t("step3Body")}</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export async function ProductSection() {
  const t = await getTranslations("Home.Product");
  const copy = {
    tabAgent: t("tabAgent"),
    tabTicket: t("tabTicket"),
    tabAdmin: t("tabAdmin"),
    agentSideUnified: t("agentSideUnified"),
    agentSideChats: t("agentSideChats"),
    agentSideTickets: t("agentSideTickets"),
    agentSideQuickReplies: t("agentSideQuickReplies"),
    agentRow1Subject: t("agentRow1Subject"),
    agentRow1Meta: t("agentRow1Meta"),
    agentRow1Status: t("agentRow1Status"),
    agentRow2Subject: t("agentRow2Subject"),
    agentRow2Meta: t("agentRow2Meta"),
    agentRow2Status: t("agentRow2Status"),
    agentRow3Subject: t("agentRow3Subject"),
    agentRow3Meta: t("agentRow3Meta"),
    agentRow3Status: t("agentRow3Status"),
    agentRow4Subject: t("agentRow4Subject"),
    agentRow4Meta: t("agentRow4Meta"),
    agentRow4Status: t("agentRow4Status"),
    ticketSideDetails: t("ticketSideDetails"),
    ticketSideConversation: t("ticketSideConversation"),
    ticketSideNotes: t("ticketSideNotes"),
    ticketSideHistory: t("ticketSideHistory"),
    ticketDetailSubject: t("ticketDetailSubject"),
    ticketDetailMeta: t("ticketDetailMeta"),
    ticketDetailStatus: t("ticketDetailStatus"),
    ticketDetailCustomerLine: t("ticketDetailCustomerLine"),
    ticketDetailAgentLine: t("ticketDetailAgentLine"),
    ticketDetailSentByEmail: t("ticketDetailSentByEmail"),
    adminSideTickets: t("adminSideTickets"),
    adminSideAgents: t("adminSideAgents"),
    adminSideSla: t("adminSideSla"),
    adminSideAuditLog: t("adminSideAuditLog"),
    adminOnTrack: t("adminOnTrack"),
    adminAtRisk: t("adminAtRisk"),
    adminBreached: t("adminBreached"),
    adminActivityLine: t("adminActivityLine"),
    adminActivityMeta: t("adminActivityMeta"),
  };

  return (
    <section id="product" className={styles.section}>
      <div className={styles.wrap}>
        <Reveal>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("kicker")}</span>
            <h2>{t("heading")}</h2>
            <p>{t("sub")}</p>
          </div>
        </Reveal>
        <Reveal>
          <ProductTabs copy={copy} />
        </Reveal>
      </div>
    </section>
  );
}

export async function WorkflowSection() {
  const t = await getTranslations("Home.Workflow");
  const steps = [1, 2, 3, 4, 5, 6] as const;
  return (
    <section id="workflow" className={cn(styles.section, styles.sectionAlt)}>
      <div className={styles.wrap}>
        <Reveal>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("kicker")}</span>
            <h2>{t("heading")}</h2>
          </div>
        </Reveal>
        <Reveal>
          <div className={styles.flow}>
            <div className={styles.flowTrack} aria-hidden="true">
              {steps.map((n) => (
                <i key={n} style={{ insetInlineStart: `${(n - 1) * 20}%` }} />
              ))}
            </div>
            {steps.map((n) => (
              <div className={styles.flowStep} key={n}>
                <span className={styles.flowNum}>{String(n).padStart(2, "0")}</span>
                <h4>{t(`step${n}Title`)}</h4>
                <p>{t(`step${n}Body`)}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export async function ValueSection() {
  const t = await getTranslations("Home.Value");
  return (
    <section id="value" className={styles.section}>
      <div className={styles.wrap}>
        <Reveal>
          <div className={styles.sectionHead}>
            <span className={styles.kicker}>{t("kicker")}</span>
            <h2>{t("heading")}</h2>
          </div>
        </Reveal>
        <Reveal>
          <div className={styles.personaGrid}>
            <div className={styles.persona}>
              <span className={styles.personaTag}>{t("customerTag")}</span>
              <h3>{t("customerTitle")}</h3>
              <ul className={styles.personaList}>
                <li>
                  <CheckIcon />
                  {t("customerLi1")}
                </li>
                <li>
                  <CheckIcon />
                  {t("customerLi2")}
                </li>
                <li>
                  <CheckIcon />
                  {t("customerLi3")}
                </li>
              </ul>
            </div>
            <div className={styles.persona}>
              <span className={styles.personaTag}>{t("agentTag")}</span>
              <h3>{t("agentTitle")}</h3>
              <ul className={styles.personaList}>
                <li>
                  <CheckIcon />
                  {t("agentLi1")}
                </li>
                <li>
                  <CheckIcon />
                  {t("agentLi2")}
                </li>
                <li>
                  <CheckIcon />
                  {t("agentLi3")}
                </li>
              </ul>
            </div>
            <div className={styles.persona}>
              <span className={styles.personaTag}>{t("adminTag")}</span>
              <h3>{t("adminTitle")}</h3>
              <ul className={styles.personaList}>
                <li>
                  <CheckIcon />
                  {t("adminLi1")}
                </li>
                <li>
                  <CheckIcon />
                  {t("adminLi2")}
                </li>
                <li>
                  <CheckIcon />
                  {t("adminLi3")}
                </li>
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export async function BilingualSection() {
  const t = await getTranslations("Home.Bilingual");
  const tHero = await getTranslations("Home.Hero");
  const locale = await getLocale();

  const copy = {
    previewLabel: t("previewLabel"),
    langEn: t("langEn"),
    langAr: t("langAr"),
    chatTagAi: tHero("chatTagAi"),
    chatTagAgent: tHero("chatTagAgent"),
    en: {
      aiMsg: enMessages.Home.Bilingual.demoAiMsg,
      handoff: enMessages.Home.Bilingual.demoHandoff,
      agentMsg: enMessages.Home.Bilingual.demoAgentMsg,
    },
    ar: {
      aiMsg: arMessages.Home.Bilingual.demoAiMsg,
      handoff: arMessages.Home.Bilingual.demoHandoff,
      agentMsg: arMessages.Home.Bilingual.demoAgentMsg,
    },
  };

  return (
    <section id="bilingual" className={cn(styles.section, styles.sectionAlt)}>
      <div className={cn(styles.wrap, styles.bilingual)}>
        <Reveal>
          <div>
            <span className={styles.kicker}>{t("kicker")}</span>
            <h2 className={styles.bilingualHeading}>{t("heading")}</h2>
            <p className={styles.bilingualBody}>{t("body")}</p>
          </div>
        </Reveal>
        <Reveal>
          <BilingualDemo copy={copy} initialLang={locale === "ar" ? "ar" : "en"} />
        </Reveal>
      </div>
    </section>
  );
}

export async function CtaSection() {
  const t = await getTranslations("Home.Cta");
  return (
    <section id="cta" className={styles.section}>
      <div className={styles.wrap}>
        <Reveal className={styles.ctaBand}>
          <span className={styles.kicker}>{t("kicker")}</span>
          <h2>{t("heading")}</h2>
          <p>{t("body")}</p>
          <div className={styles.ctaActions}>
            <Link href="/register" className={cn(styles.btn, styles.btnPrimary)}>
              {t("primary")}
            </Link>
            <Link href="/login" className={cn(styles.btn, styles.btnGhost)}>
              {t("secondary")}
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export async function FooterSection() {
  const tNav = await getTranslations("Home.Nav");
  const tFooter = await getTranslations("Home.Footer");
  return (
    <footer className={styles.footer}>
      <div className={cn(styles.wrap, styles.footRow)}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          {tNav("brand")}
        </Link>
        <nav className={styles.footLinks}>
          <SmoothAnchor href="#solution">{tFooter("howItWorks")}</SmoothAnchor>
          <SmoothAnchor href="#product">{tFooter("product")}</SmoothAnchor>
          <SmoothAnchor href="#value">{tFooter("whoItsFor")}</SmoothAnchor>
        </nav>
      </div>
    </footer>
  );
}
