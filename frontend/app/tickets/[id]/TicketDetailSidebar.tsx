"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listActiveTicketCategories } from "../new/actions";
import { UNSPECIFIED_CATEGORY } from "../new/constants";
import {
  updateTicketCategory,
  updateTicketPriority,
  updateTicketStatus,
  reassignTicket,
  listAssignableAgents,
} from "./actions";

type Priority = "low" | "medium" | "high" | "urgent";
type ManualStatus = "new" | "in_progress" | "answered" | "closed";
// The ticket's actual status can also be "escalated" (Story 12, not
// reachable yet — nothing sets it today) — accepted here so this
// component's prop type matches the page's full TicketStatus without
// narrowing it, even though the select below only ever offers the four
// manual options.
type Status = ManualStatus | "escalated";

const PRIORITY_KEY: Record<Priority, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
  urgent: "priorityUrgent",
};

// ticket-management Story 11: "escalated" is deliberately absent — it isn't
// a valid manual target of this select (Story 12 owns that transition), and
// nothing sets a ticket to "escalated" yet, so the current value is always
// one of these four in practice.
const STATUS_OPTIONS: ManualStatus[] = ["new", "in_progress", "answered", "closed"];

const STATUS_KEY: Record<ManualStatus, string> = {
  new: "statusNew",
  in_progress: "statusInProgress",
  answered: "statusAnswered",
  closed: "statusClosed",
};

// Story 11's permission split: closing/reopening needs tickets:close_reopen
// specifically; the three "open" states need tickets:change_status. Once a
// ticket is closed, only a close_reopen holder can touch this field at all
// (reopening is their call, not change_status's) — the backend re-validates
// the actual transition graph regardless of what this disables, same as the
// Assigned Agent select's online-only restriction below.
function isStatusOptionDisabled(
  option: ManualStatus,
  isLocked: boolean,
  canChangeStatus: boolean,
  canCloseReopen: boolean
): boolean {
  if (option === "closed") return !canCloseReopen;
  return isLocked ? !canCloseReopen : !canChangeStatus;
}

const UNASSIGNED_VALUE = "__unassigned__";

// Story 9's sidebar: Category/Priority selects that save immediately on
// change (no submit button), same "edit one field inline" shape as
// RenameCategoryDialog.tsx. Each select is disabled when the viewer lacks
// the field's own permission — checked independently, since one viewer
// could hold either key without the other.
export function TicketDetailSidebar({
  ticketId,
  status,
  category,
  priority,
  assignedAgent,
  canCategorize,
  canChangePriority,
  canReassign,
  canChangeStatus,
  canCloseReopen,
  isLocked,
  viewerIsUnrestrictedReassigner,
}: {
  ticketId: string;
  status: Status;
  category: string | null;
  priority: Priority;
  assignedAgent: { id: string; name: string } | null;
  canCategorize: boolean;
  canChangePriority: boolean;
  canReassign: boolean;
  canChangeStatus: boolean;
  canCloseReopen: boolean;
  // Story 11: true when the ticket's current status is "closed" — forces
  // Category/Priority/Assigned Agent to lock regardless of their own
  // permission booleans above. Status itself is exempt (see
  // isStatusOptionDisabled) so a canCloseReopen holder can still reopen it.
  isLocked: boolean;
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
  const [statusValue, setStatusValue] = useState<Status>(status);
  const [categoryMessage, setCategoryMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [priorityMessage, setPriorityMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [categoryPending, startCategoryTransition] = useTransition();
  const [priorityPending, startPriorityTransition] = useTransition();
  const [statusPending, startStatusTransition] = useTransition();

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

  function handleStatusChange(next: ManualStatus) {
    const previous = statusValue;
    setStatusValue(next);
    setStatusMessage(null);
    startStatusTransition(async () => {
      const result = await updateTicketStatus(ticketId, next);
      if (result.error) {
        setStatusValue(previous);
        setStatusMessage({ type: "error", text: result.error });
      } else {
        setStatusMessage({ type: "success", text: t("changeSaved") });
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
        <Label htmlFor="ticket-status">{t("status")}</Label>
        <Select
          value={statusValue}
          onValueChange={(v) => handleStatusChange(v as ManualStatus)}
          disabled={(!canChangeStatus && !canCloseReopen) || statusPending}
        >
          <SelectTrigger id="ticket-status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem
                key={option}
                value={option}
                disabled={isStatusOptionDisabled(option, isLocked, canChangeStatus, canCloseReopen)}
              >
                {t(STATUS_KEY[option])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statusMessage && (
          <p className={`text-xs ${statusMessage.type === "error" ? "text-destructive" : "text-success"}`}>
            {statusMessage.text}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ticket-category">{t("category")}</Label>
        <Select
          value={categoryValue}
          onValueChange={handleCategoryChange}
          disabled={!canCategorize || categoriesLoading || categoryPending || isLocked}
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
          disabled={!canChangePriority || priorityPending || isLocked}
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
            disabled={agentsLoading || assignedAgentPending || isLocked}
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
