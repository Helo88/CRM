"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Paperclip } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { sendTicketReply } from "./actions";

// Story 56: sends immediately on click (no page navigation) — same
// direct-server-action-call shape as TicketDetailSidebar.tsx's
// updateTicketCategory/updateTicketPriority, not useActionState+<form>,
// since state (drafted text, selected files, success/error) is cleared or
// kept based on the action's actual result rather than eagerly on click.
export function TicketReplyComposer({ ticketId }: { ticketId: string }) {
  const t = useTranslations("TicketDetail");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setJustSent(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("text", trimmed);
      files.forEach((file) => formData.append("files", file));
      const result = await sendTicketReply(ticketId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setText("");
        setFiles([]);
        setJustSent(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setJustSent(false);
        }}
        placeholder={t("replyPlaceholder")}
        rows={3}
        maxLength={4000}
        disabled={pending}
      />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-muted-foreground"
            >
              <Paperclip className="size-3" />
              {file.name}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!error && justSent && <p className="text-xs text-success">{t("replySent")}</p>}
      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="size-4" />
          {t("replyAttach")}
        </Button>
        <Button type="button" size="sm" disabled={pending || text.trim().length === 0} onClick={handleSend}>
          {pending ? t("replySendPending") : t("replySend")}
        </Button>
      </div>
    </div>
  );
}
