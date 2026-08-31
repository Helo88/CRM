"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { listAssignableAgents, reassignTicket, type AssignableAgent } from "./[id]/actions";

// Story 25: replaces the disabled "Coming soon" Repeat-icon stub in the
// ticket queue. Agents are fetched lazily on first open (not for every row
// on server render) — the same data source and reassign action the ticket
// detail sidebar's Select uses.
export function ReassignAgentMenu({
  ticketId,
  currentAgentId,
  viewerIsUnrestrictedReassigner,
}: {
  ticketId: string;
  currentAgentId: string | null;
  viewerIsUnrestrictedReassigner: boolean;
}) {
  const t = useTranslations("Tickets");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<AssignableAgent[] | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && agents === null) {
      listAssignableAgents().then(setAgents);
    }
  }

  function handlePick(agentId: string | null) {
    startTransition(async () => {
      await reassignTicket(ticketId, agentId);
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title={t("reassign")}
          disabled={pending}
          className="text-muted-foreground hover:bg-muted"
        >
          <Repeat className="size-4" />
          <span className="sr-only">{t("reassign")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handlePick(null)} disabled={currentAgentId === null}>
          {t("unassignedOption")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {agents === null ? (
          <DropdownMenuLabel className="font-normal text-muted-foreground">{t("loading")}</DropdownMenuLabel>
        ) : agents.length === 0 ? (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            {t("noAssignableAgents")}
          </DropdownMenuLabel>
        ) : (
          agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onSelect={() => handlePick(agent.id)}
              disabled={agent.id === currentAgentId || (!viewerIsUnrestrictedReassigner && !agent.isOnline)}
            >
              {agent.name}
              {!agent.isOnline ? ` — ${t("agentOfflineHint")}` : ""}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
