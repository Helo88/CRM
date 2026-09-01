"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CirclePlus, Download, MessageSquare, RefreshCw, StickyNote } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listActiveTicketCategories } from "../new/actions";
import { UNSPECIFIED_CATEGORY } from "../new/constants";
import {
  updateTicketCategory,
  updateTicketPriority,
  updateTicketStatus,
  reassignTicket,
  listAssignableAgents,
  escalateTicket,
  listEscalationTargets,
  type EscalationTarget,
  type TicketHistoryEvent,
} from "./actions";

type Priority = "low" | "medium" | "high" | "urgent";
type ManualStatus = "new" | "in_progress" | "answered" | "closed";
// The ticket's actual status can also be "escalated" (Story 12) — accepted
// here so this component's prop type matches the page's full TicketStatus
// without narrowing it, even though the select below only ever offers the
// four manual options (escalation is its own action, below).
type Status = ManualStatus | "escalated";

const PRIORITY_KEY: Record<Priority, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
  urgent: "priorityUrgent",
};

// ticket-management Story 11: "escalated" is deliberately absent from the
// pickable options — it's set exclusively by the dedicated Escalate action
// below (Story 12), never by picking it from this dropdown. The current
// value can still legitimately BE "escalated" now that Story 12 ships; see
// the disabled item rendered for that case where this is used.
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

// ticket-management Story 13: "Recent activity" teaser shows the last 5
// events, reverse-chronological; "View full history" expands to every event
// in the same styling.
const RECENT_ACTIVITY_TEASER_COUNT = 5;

const HISTORY_EVENT_ICON: Record<TicketHistoryEvent["kind"], typeof CirclePlus> = {
  created: CirclePlus,
  status_changed: RefreshCw,
  reply_posted: MessageSquare,
  internal_note_added: StickyNote,
};

// Unlike STATUS_KEY above (pickable manual options only), a status_changed
// event's `data.to` can legitimately be "escalated" (Story 12's dedicated
// endpoint writes it), so this history-only map covers all five values.
const FULL_STATUS_KEY: Record<Status, string> = { ...STATUS_KEY, escalated: "statusEscalated" };

// The export button is a plain downloadable link, not a fetch — the
// response is a `Content-Disposition: attachment`, so a same-tab navigation
// is enough (same reasoning as the message-attachment links in
// TicketMessageThread.tsx). Routed through the frontend's own proxy route
// (app/api/tickets/[id]/history/export/route.ts) since the bearer token
// lives only in an httpOnly cookie a plain <a href> can't attach. A plain
// sync helper, not a server action — "use server" files (actions.ts) may
// only export async functions, so this stays here instead.
function getTicketHistoryExportUrl(ticketId: string): string {
  return `/api/tickets/${ticketId}/history/export`;
}

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
  escalatedTo,
  currentUserId,
  canCategorize,
  canChangePriority,
  canReassign,
  canChangeStatus,
  canCloseReopen,
  canEscalate,
  isLocked,
  viewerIsUnrestrictedReassigner,
  events,
  canExportHistory,
}: {
  ticketId: string;
  status: Status;
  category: string | null;
  priority: Priority;
  assignedAgent: { id: string; name: string } | null;
  // ticket-management Story 12: who the ticket is currently escalated to, if
  // it is — null whenever status !== "escalated".
  escalatedTo: { id: string; name: string } | null;
  // So the Assigned Agent / Escalated To fields can read "You" instead of
  // the viewer's own name — same convention StaffTicketQueue.tsx's queue
  // table already uses for "assignedToYou".
  currentUserId?: string;
  canCategorize: boolean;
  canChangePriority: boolean;
  canReassign: boolean;
  canChangeStatus: boolean;
  canCloseReopen: boolean;
  canEscalate: boolean;
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
  // ticket-management Story 13: pre-fetched server-side (page.tsx) alongside
  // the ticket/messages fetches — [] on any failure, never blocks the page.
  events: TicketHistoryEvent[];
  // Story 13: sub-admin-tier (tickets:export_history) — every staff role
  // sees the "Recent activity"/"View full history" section, only this
  // subset also sees the export anchor.
  canExportHistory: boolean;
}) {
  const t = useTranslations("TicketDetail");
  const [historyExpanded, setHistoryExpanded] = useState(false);

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

  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateTargets, setEscalateTargets] = useState<EscalationTarget[] | null>(null);
  const [escalateSelected, setEscalateSelected] = useState<string>("");
  const [escalateError, setEscalateError] = useState<string | null>(null);
  const [escalatePending, startEscalateTransition] = useTransition();
  const [escalatedToValue, setEscalatedToValue] = useState(escalatedTo);

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

  function handleEscalateOpenChange(next: boolean) {
    setEscalateOpen(next);
    if (next) {
      setEscalateSelected("");
      setEscalateError(null);
      if (escalateTargets === null) {
        listEscalationTargets().then(setEscalateTargets);
      }
    }
  }

  function handleEscalateConfirm() {
    if (!escalateSelected) return;
    const target = escalateTargets?.find((t) => t.id === escalateSelected);
    setEscalateError(null);
    startEscalateTransition(async () => {
      const result = await escalateTicket(ticketId, escalateSelected);
      if (result.error) {
        setEscalateError(result.error);
      } else {
        setEscalateOpen(false);
        setStatusValue("escalated");
        if (target) setEscalatedToValue({ id: target.id, name: target.name });
      }
    });
  }

  function historyEventLabel(event: TicketHistoryEvent): string {
    const name = event.actor?.name ?? t("history.unknownUser");
    switch (event.kind) {
      case "created":
        return t("history.event.created", { name });
      case "status_changed": {
        const to = event.data.to as Status;
        return t("history.event.statusChanged", { name, status: t(FULL_STATUS_KEY[to] ?? "statusNew") });
      }
      case "reply_posted":
        return t("history.event.replyPosted", { name });
      case "internal_note_added":
        return t("history.event.internalNoteAdded", { name });
    }
  }

  const reverseChronologicalEvents = [...events].reverse();
  const visibleEvents = historyExpanded ? reverseChronologicalEvents : reverseChronologicalEvents.slice(0, RECENT_ACTIVITY_TEASER_COUNT);

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
            {/* Story 12: "escalated" isn't a pickable manual option (only
                escalateTicket sets it), but it's now a reachable current
                value — render it disabled so SelectValue has a matching item
                to render the label from, instead of going blank. */}
            {statusValue === "escalated" && (
              <SelectItem value="escalated" disabled>
                {t("statusEscalated")}
              </SelectItem>
            )}
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
                  {agent.id === currentUserId ? t("youLabel") : agent.name}
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

      {/* ticket-management Story 12: manual escalation to a senior agent or
          admin. Escalating a closed ticket is rejected server-side (409), so
          the trigger is hidden once isLocked, same as Category/Priority/
          Assigned Agent above — a fresh escalation only makes sense on a
          ticket that's still open. */}
      {escalatedToValue ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t("escalatedToLabel")}</Label>
          <p className="text-sm font-medium text-destructive">
            {escalatedToValue.id === currentUserId ? t("youLabel") : escalatedToValue.name}
          </p>
        </div>
      ) : (
        canEscalate &&
        !isLocked && (
          <Dialog open={escalateOpen} onOpenChange={handleEscalateOpenChange}>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive">
                {t("escalateButton")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("escalateDialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Label htmlFor="escalate-target">{t("escalateTargetLabel")}</Label>
                <Select value={escalateSelected} onValueChange={setEscalateSelected} disabled={escalatePending}>
                  <SelectTrigger id="escalate-target" className="w-full">
                    <SelectValue placeholder={t("escalateTargetPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {escalateTargets === null ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("loading")}</div>
                    ) : escalateTargets.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">{t("noEscalationTargets")}</div>
                    ) : (
                      escalateTargets.map((target) => (
                        <SelectItem key={target.id} value={target.id}>
                          {target.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {escalateError && <p className="text-sm text-destructive">{escalateError}</p>}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEscalateOpen(false)}>
                  {t("escalateCancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!escalateSelected || escalatePending}
                  onClick={handleEscalateConfirm}
                >
                  {escalatePending ? t("escalateConfirmPending") : t("escalateConfirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex items-center justify-between">
          <Label>{t("history.sectionTitle")}</Label>
          {historyExpanded && canExportHistory && (
            <a
              href={getTicketHistoryExportUrl(ticketId)}
              download
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <Download className="size-3" />
              {t("history.exportButton")}
            </a>
          )}
        </div>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("history.empty")}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {visibleEvents.map((event, index) => {
                const Icon = HISTORY_EVENT_ICON[event.kind];
                return (
                  <li key={`${event.kind}-${event.at}-${index}`} className="flex items-start gap-2 text-xs">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-foreground">{historyEventLabel(event)}</span>
                      <span dir="ltr" className="text-muted-foreground">
                        {new Date(event.at).toLocaleString()}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {/* Always rendered once there's at least one event (even just
                "created") — Story 13's edge case explicitly keeps this
                visible on a short timeline too, since it's also what
                reveals the export anchor above for a sub-admin. */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start px-0 text-xs"
              onClick={() => setHistoryExpanded((prev) => !prev)}
            >
              {historyExpanded ? t("history.collapse") : t("history.viewFull")}
            </Button>
          </>
        )}
      </div>
    </>
  );
}
