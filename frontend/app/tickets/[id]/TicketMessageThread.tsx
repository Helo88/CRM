import { getTranslations } from "next-intl/server";
import { Paperclip } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { TicketMessage } from "./page";

// Story 56: read-only thread renderer — customer's original message is
// rendered separately (as the ticket's subject/description, already on the
// page); this only renders real Message rows, oldest first (server already
// sorts them). Internal notes (Message.internal: true) would render here
// too once agent-workspace Story 24 ships, but this story never creates any.
export async function TicketMessageThread({ messages, ticketId }: { messages: TicketMessage[]; ticketId: string }) {
  const t = await getTranslations("TicketDetail");

  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("threadEmpty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => {
        const initial = (message.sender?.name.trim().charAt(0) || "?").toUpperCase();
        return (
          <div key={message.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback className="bg-accent text-accent-foreground">{initial}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{message.sender?.name ?? t("thread")}</span>
              {message.senderType === "agent" && !message.internal && (
                <Badge variant="outline" className="text-[10px]">
                  {t("sentByEmail")}
                </Badge>
              )}
              <span dir="ltr" className="ms-auto text-xs text-muted-foreground">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{message.text}</p>
            {message.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={`/api/tickets/${ticketId}/messages/${message.id}/attachments/${attachment.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <Paperclip className="size-3" />
                    {attachment.fileName}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
