"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listActiveTicketCategories } from "../new/actions";
import { UNSPECIFIED_CATEGORY } from "../new/constants";
import { updateTicketCategory, updateTicketPriority, reassignTicket, listAssignableAgents } from "./actions";

type Priority = "low" | "medium" | "high" | "urgent";

const PRIORITY_KEY: Record<Priority, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
  urgent: "priorityUrgent",
};

const UNASSIGNED_VALUE = "__unassigned__";

// Story 9's sidebar: Category/Priority selects that save immediately on
// change (no submit button), same "edit one field inline" shape as
// RenameCategoryDialog.tsx. Each select is disabled when the viewer lacks
// the field's own permission — checked independently, since one viewer
// could hold either key without the other.
export function TicketDetailSidebar({
  ticketId,
  category,
  priority,
  assignedAgent,
  canCategorize,
  canChangePriority,
  canReassign,
  viewerIsUnrestrictedReassigner,
}: {
  ticketId: string;
  category: string | null;
  priority: Priority;
  assignedAgent: { id: string; name: string } | null;
  canCategorize: boolean;
  canChangePriority: boolean;
  canReassign: boolean;
  // Story 25's availability rule: admin/sub-admin may reassign to any active
  // agent regardless of isOnline; a plain agent holding tickets:reassign is
  // restricted to another agent currently online. This only changes which
  // options are disabled in the dropdown below — the backend re-validates
  // regardless (see ticket.routes.ts's PATCH /:id).
  viewerIsUnrestrictedReassigner: boolean;
}) {
  const t = useTranslations("TicketDetail");

  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryValue, setCategoryValue] = useState(category ?? UNSPECIFIED_CATEGORY);
  const [priorityValue, setPriorityValue] = useState<Priority>(priority);
  const [categoryMessage, setCategoryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [priorityMessage, setPriorityMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [categoryPending, startCategoryTransition] = useTransition();
  const [priorityPending, startPriorityTransition] = useTransition();

  const [agents, setAgents] = useState<{ id: string; name: string; isOnline: boolean }[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(canReassign);
  const [assignedAgentValue, setAssignedAgentValue] = useState(assignedAgent?.id ?? UNASSIGNED_VALUE);
  const [assignedAgentMessage, setAssignedAgentMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [assignedAgentPending, startAssignedAgentTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listActiveTicketCategories().then((result) => {
      if (!cancelled) {
        setCategories(result);
        setCategoriesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canReassign) return;
    let cancelled = false;
    listAssignableAgents().then((result) => {
      if (!cancelled) {
        setAgents(result);
        setAgentsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canReassign]);

  function handleCategoryChange(next: string) {
    const previous = categoryValue;
    setCategoryValue(next);
    setCategoryMessage(null);
    startCategoryTransition(async () => {
      const result = await updateTicketCategory(ticketId, next === UNSPECIFIED_CATEGORY ? null : next);
      if (result.error) {
        setCategoryValue(previous);
        setCategoryMessage({ type: "error", text: result.error });
      } else {
        setCategoryMessage({ type: "success", text: t("changeSaved") });
      }
    });
  }

  function handlePriorityChange(next: Priority) {
    const previous = priorityValue;
    setPriorityValue(next);
    setPriorityMessage(null);
    startPriorityTransition(async () => {
      const result = await updateTicketPriority(ticketId, next);
      if (result.error) {
        setPriorityValue(previous);
        setPriorityMessage({ type: "error", text: result.error });
      } else {
        setPriorityMessage({ type: "success", text: t("changeSaved") });
      }
    });
  }

  function handleAssignedAgentChange(next: string) {
    const previous = assignedAgentValue;
    setAssignedAgentValue(next);
    setAssignedAgentMessage(null);
    startAssignedAgentTransition(async () => {
      const result = await reassignTicket(ticketId, next === UNASSIGNED_VALUE ? null : next);
      if (result.error) {
        setAssignedAgentValue(previous);
        setAssignedAgentMessage({ type: "error", text: result.error });
      } else {
        setAssignedAgentMessage({ type: "success", text: t("changeSaved") });
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-category">{t("category")}</Label>
        <Select
          value={categoryValue}
          onValueChange={handleCategoryChange}
          disabled={!canCategorize || categoriesLoading || categoryPending}
        >
          <SelectTrigger id="ticket-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSPECIFIED_CATEGORY}>{t("categoryUnspecified")}</SelectItem>
            {categories.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {categoryMessage && (
          <p className={`text-xs ${categoryMessage.type === "error" ? "text-destructive" : "text-success"}`}>
            {categoryMessage.text}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-priority">{t("priority")}</Label>
        <Select
          value={priorityValue}
          onValueChange={(v) => handlePriorityChange(v as Priority)}
          disabled={!canChangePriority || priorityPending}
        >
          <SelectTrigger id="ticket-priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PRIORITY_KEY) as Priority[]).map((p) => (
              <SelectItem key={p} value={p}>
                {t(PRIORITY_KEY[p])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {priorityMessage && (
          <p className={`text-xs ${priorityMessage.type === "error" ? "text-destructive" : "text-success"}`}>
            {priorityMessage.text}
          </p>
        )}
      </div>

      {canReassign && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ticket-assigned-agent">{t("assignedAgentLabel")}</Label>
          <Select
            value={assignedAgentValue}
            onValueChange={handleAssignedAgentChange}
            disabled={agentsLoading || assignedAgentPending}
          >
            <SelectTrigger id="ticket-assigned-agent" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_VALUE}>{t("unassignedOption")}</SelectItem>
              {agents.map((agent) => (
                <SelectItem
                  key={agent.id}
                  value={agent.id}
                  disabled={!viewerIsUnrestrictedReassigner && !agent.isOnline}
                >
                  {agent.name}
                  {!agent.isOnline ? ` — ${t("agentOfflineHint")}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignedAgentMessage && (
            <p className={`text-xs ${assignedAgentMessage.type === "error" ? "text-destructive" : "text-success"}`}>
              {assignedAgentMessage.text}
            </p>
          )}
        </div>
      )}
    </>
  );
}
