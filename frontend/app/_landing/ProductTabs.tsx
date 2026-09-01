"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

export interface ProductTabsCopy {
  tabAgent: string;
  tabTicket: string;
  tabAdmin: string;
  agentSideUnified: string;
  agentSideChats: string;
  agentSideTickets: string;
  agentSideQuickReplies: string;
  agentRow1Subject: string;
  agentRow1Meta: string;
  agentRow1Status: string;
  agentRow2Subject: string;
  agentRow2Meta: string;
  agentRow2Status: string;
  agentRow3Subject: string;
  agentRow3Meta: string;
  agentRow3Status: string;
  agentRow4Subject: string;
  agentRow4Meta: string;
  agentRow4Status: string;
  ticketSideDetails: string;
  ticketSideConversation: string;
  ticketSideNotes: string;
  ticketSideHistory: string;
  ticketDetailSubject: string;
  ticketDetailMeta: string;
  ticketDetailStatus: string;
  ticketDetailCustomerLine: string;
  ticketDetailAgentLine: string;
  ticketDetailSentByEmail: string;
  adminSideTickets: string;
  adminSideAgents: string;
  adminSideSla: string;
  adminSideAuditLog: string;
  adminOnTrack: string;
  adminAtRisk: string;
  adminBreached: string;
  adminActivityLine: string;
  adminActivityMeta: string;
}

type TabKey = "agent" | "ticket" | "admin";

export function ProductTabs({ copy }: { copy: ProductTabsCopy }) {
  const [active, setActive] = useState<TabKey>("agent");

  return (
    <div>
      <div className={styles.productTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={active === "agent"}
          className={cn(styles.ptab, active === "agent" && styles.ptabActive)}
          onClick={() => setActive("agent")}
        >
          {copy.tabAgent}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "ticket"}
          className={cn(styles.ptab, active === "ticket" && styles.ptabActive)}
          onClick={() => setActive("ticket")}
        >
          {copy.tabTicket}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "admin"}
          className={cn(styles.ptab, active === "admin" && styles.ptabActive)}
          onClick={() => setActive("admin")}
        >
          {copy.tabAdmin}
        </button>
      </div>

      {active === "agent" && (
        <div className={styles.pview} role="tabpanel">
          <div className={styles.pvSide}>
            <div className={cn(styles.pvSideItem, styles.pvSideItemOn)}>{copy.agentSideUnified}</div>
            <div className={styles.pvSideItem}>{copy.agentSideChats}</div>
            <div className={styles.pvSideItem}>{copy.agentSideTickets}</div>
            <div className={styles.pvSideItem}>{copy.agentSideQuickReplies}</div>
          </div>
          <div className={styles.pvMain}>
            <div className={styles.pvRow}>
              <div>
                <div className={styles.pvSubject}>{copy.agentRow1Subject}</div>
                <div className={cn(styles.pvId, styles.mono)}>{copy.agentRow1Meta}</div>
              </div>
              <span className={cn(styles.badge, styles.badgeDestructive)}>{copy.agentRow1Status}</span>
            </div>
            <div className={styles.pvRow}>
              <div>
                <div className={styles.pvSubject}>{copy.agentRow2Subject}</div>
                <div className={cn(styles.pvId, styles.mono)}>{copy.agentRow2Meta}</div>
              </div>
              <span className={cn(styles.badge, styles.badgeWarning)}>{copy.agentRow2Status}</span>
            </div>
            <div className={styles.pvRow}>
              <div>
                <div className={styles.pvSubject}>{copy.agentRow3Subject}</div>
                <div className={cn(styles.pvId, styles.mono)}>{copy.agentRow3Meta}</div>
              </div>
              <span className={cn(styles.badge, styles.badgeWarning)}>{copy.agentRow3Status}</span>
            </div>
            <div className={styles.pvRow}>
              <div>
                <div className={styles.pvSubject}>{copy.agentRow4Subject}</div>
                <div className={cn(styles.pvId, styles.mono)}>{copy.agentRow4Meta}</div>
              </div>
              <span className={cn(styles.badge, styles.badgeSuccess)}>{copy.agentRow4Status}</span>
            </div>
          </div>
        </div>
      )}

      {active === "ticket" && (
        <div className={styles.pview} role="tabpanel">
          <div className={styles.pvSide}>
            <div className={styles.pvSideItem}>{copy.ticketSideDetails}</div>
            <div className={cn(styles.pvSideItem, styles.pvSideItemOn)}>{copy.ticketSideConversation}</div>
            <div className={styles.pvSideItem}>{copy.ticketSideNotes}</div>
            <div className={styles.pvSideItem}>{copy.ticketSideHistory}</div>
          </div>
          <div className={styles.pvMain}>
            <div className={styles.pvRow}>
              <div>
                <div className={styles.pvSubject}>{copy.ticketDetailSubject}</div>
                <div className={cn(styles.pvId, styles.mono)}>{copy.ticketDetailMeta}</div>
              </div>
              <span className={cn(styles.badge, styles.badgeWarning)}>{copy.ticketDetailStatus}</span>
            </div>
            <div className={styles.pvRow}>
              <div className={styles.pvSubject} style={{ fontWeight: 500 }}>
                {copy.ticketDetailCustomerLine}
              </div>
            </div>
            <div className={styles.pvRow}>
              <div className={styles.pvSubject} style={{ fontWeight: 500 }}>
                {copy.ticketDetailAgentLine}
              </div>
              <span className={cn(styles.badge, styles.badgeMuted)}>{copy.ticketDetailSentByEmail}</span>
            </div>
          </div>
        </div>
      )}

      {active === "admin" && (
        <div className={styles.pview} role="tabpanel">
          <div className={styles.pvSide}>
            <div className={styles.pvSideItem}>{copy.adminSideTickets}</div>
            <div className={styles.pvSideItem}>{copy.adminSideAgents}</div>
            <div className={cn(styles.pvSideItem, styles.pvSideItemOn)}>{copy.adminSideSla}</div>
            <div className={styles.pvSideItem}>{copy.adminSideAuditLog}</div>
          </div>
          <div className={styles.pvMain}>
            <div className={styles.pvRow}>
              <div className={styles.pvSubject}>{copy.adminOnTrack}</div>
              <span className={styles.mono} style={{ color: "var(--success)", fontWeight: 600 }}>
                86%
              </span>
            </div>
            <div className={styles.pvRow}>
              <div className={styles.pvSubject}>{copy.adminAtRisk}</div>
              <span className={styles.mono} style={{ color: "var(--warning)", fontWeight: 600 }}>
                9%
              </span>
            </div>
            <div className={styles.pvRow}>
              <div className={styles.pvSubject}>{copy.adminBreached}</div>
              <span className={styles.mono} style={{ color: "var(--destructive)", fontWeight: 600 }}>
                5%
              </span>
            </div>
            <div className={styles.pvRow}>
              <div className={styles.pvSubject}>{copy.adminActivityLine}</div>
              <span className={cn(styles.pvId, styles.mono)}>{copy.adminActivityMeta}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
