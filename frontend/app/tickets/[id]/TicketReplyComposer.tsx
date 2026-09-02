"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, CircleAlert, Lock, Paperclip, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  sendTicketReply,
  postInternalNote,
  listInternalNoteTagTargets,
  type InternalNoteTagTarget,
} from "./actions";

const MAX_NOTE_LENGTH = 4000;
// Mirrors MAX_INTERNAL_NOTE_TAGS in backend/src/validation/ticket.schema.ts —
// the server rejects a 21st tag with a 400; this just stops the picker from
// letting a user build a request that can only fail.
const MAX_TAGS = 20;

// Story 56: sends immediately on click (no page navigation) — same
// direct-server-action-call shape as TicketDetailSidebar.tsx's
// updateTicketCategory/updateTicketPriority, not useActionState+<form>,
// since state (drafted text, selected files, success/error) is cleared or
// kept based on the action's actual result rather than eagerly on click.
//
// agent-workspace Story 24 wraps this in a two-tab shell: "Reply to
// customer" (unchanged) and "Internal note" (agent-only, never emailed,
// never seen by the customer). The tabs only appear when the viewer actually
// holds tickets:post_internal_note — an account with only tickets:reply sees
// exactly the composer it saw before this story.
export function TicketReplyComposer({
  ticketId,
  canReply = true,
  canPostInternalNote = false,
}: {
  ticketId: string;
  canReply?: boolean;
  canPostInternalNote?: boolean;
}) {
  const t = useTranslations("TicketDetail");

  // Only one of the two is available: render it bare, no tab strip to pick
  // between a single option.
  if (!canPostInternalNote) {
    return (
      <div className="border-t border-border pt-4">
        <ReplyTab ticketId={ticketId} />
      </div>
    );
  }
  if (!canReply) {
    return (
      <div className="border-t border-border pt-4">
        <InternalNoteTab ticketId={ticketId} />
      </div>
    );
  }

  return (
    <Tabs defaultValue="reply" className="border-t border-border pt-4">
      <TabsList>
        <TabsTrigger value="reply">{t("composerReplyTab")}</TabsTrigger>
        <TabsTrigger value="internal">{t("internalNotes.tab")}</TabsTrigger>
      </TabsList>
      <TabsContent value="reply">
        <ReplyTab ticketId={ticketId} />
      </TabsContent>
      <TabsContent value="internal">
        <InternalNoteTab ticketId={ticketId} />
      </TabsContent>
    </Tabs>
  );
}

function ReplyTab({ ticketId }: { ticketId: string }) {
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
    <div className="flex flex-col gap-2">
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

// agent-workspace Story 24: the internal-note half of the composer. No file
// attachments (the backend endpoint takes JSON, not multipart — notes are
// short team annotations, not deliverables) and no "sent by email" anything:
// posting one changes nothing the customer can observe.
function InternalNoteTab({ ticketId }: { ticketId: string }) {
  const t = useTranslations("TicketDetail");
  const [text, setText] = useState("");
  const [tagged, setTagged] = useState<InternalNoteTagTarget[]>([]);
  const [candidates, setCandidates] = useState<InternalNoteTagTarget[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagErrors, setTagErrors] = useState<Record<string, string>>({});
  const [justPosted, setJustPosted] = useState(false);
  const [pending, startTransition] = useTransition();

  // Fetched once, lazily, the first time the picker is opened — a staff
  // roster is small and rarely changes mid-session, and an agent who only
  // ever writes untagged notes never pays for the request at all.
  useEffect(() => {
    if (!pickerOpen || candidatesLoaded) return;
    let cancelled = false;
    void (async () => {
      const targets = await listInternalNoteTagTargets();
      if (cancelled) return;
      setCandidates(targets);
      setCandidatesLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, candidatesLoaded]);

  function toggleTag(target: InternalNoteTagTarget) {
    setTagErrors({});
    setTagged((current) =>
      current.some((u) => u.id === target.id)
        ? current.filter((u) => u.id !== target.id)
        : current.length >= MAX_TAGS
          ? current
          : [...current, target]
    );
  }

  function handlePost() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);
    setTagErrors({});
    setJustPosted(false);
    startTransition(async () => {
      const result = await postInternalNote(ticketId, {
        text: trimmed,
        taggedUserIds: tagged.map((u) => u.id),
      });
      if (result.error) {
        setError(result.error);
        setTagErrors(result.taggedUserIdErrors ?? {});
      } else {
        setText("");
        setTagged([]);
        setJustPosted(true);
      }
    });
  }

  // Role labels are duplicated per section throughout messages/*.json (see
  // AdminUsersList/NewStaffAccount) rather than shared — kept consistent
  // with that here instead of introducing a cross-section reference.
  const roleLabel = (role: InternalNoteTagTarget["role"]) =>
    t(
      role === "admin"
        ? "internalNotes.roleAdmin"
        : role === "subadmin"
          ? "internalNotes.roleSubadmin"
          : "internalNotes.roleAgent"
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 border-s-4 border-s-warning bg-warning/5 ps-3 pt-1">
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <Lock className="size-3.5" aria-hidden="true" />
          {t("internalNotes.helper")}
        </p>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setJustPosted(false);
          }}
          placeholder={t("internalNotes.placeholder")}
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          disabled={pending}
          aria-label={t("internalNotes.tab")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                role="combobox"
                aria-expanded={pickerOpen}
                disabled={pending}
                className="font-normal"
              >
                {t("internalNotes.tagLabel")}
                <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0">
              <Command>
                <CommandInput placeholder={t("internalNotes.tagSearchPlaceholder")} />
                <CommandList>
                  <CommandEmpty>{candidatesLoaded ? t("internalNotes.noColleagues") : t("loading")}</CommandEmpty>
                  <CommandGroup>
                    {candidates.map((c) => {
                      const selected = tagged.some((u) => u.id === c.id);
                      return (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.role}`}
                          onSelect={() => toggleTag(c)}
                          disabled={!selected && tagged.length >= MAX_TAGS}
                        >
                          <Check className={cn("me-2 size-4", selected ? "opacity-100" : "opacity-0")} />
                          <span className="flex flex-col overflow-hidden">
                            <span className="truncate">{c.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{roleLabel(c.role)}</span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {tagged.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t("internalNotes.noTagsYet")}</span>
          ) : (
            tagged.map((u) => (
              <Badge
                key={u.id}
                variant="outline"
                className={cn(
                  "gap-1 border-warning/40 bg-warning/10 text-warning",
                  tagErrors[u.id] && "border-destructive/50 bg-destructive/10 text-destructive"
                )}
              >
                {u.name}
                <button
                  type="button"
                  onClick={() => toggleTag(u)}
                  disabled={pending}
                  aria-label={t("internalNotes.removeTag", { name: u.name })}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
        {Object.entries(tagErrors).map(([id, message]) => {
          const name = tagged.find((u) => u.id === id)?.name ?? id;
          return (
            <p key={id} className="text-xs text-destructive">
              {name}: {message}
            </p>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {!error && justPosted && <p className="text-xs text-success">{t("internalNotes.posted")}</p>}

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={pending || text.trim().length === 0} onClick={handlePost}>
          {pending ? t("internalNotes.postPending") : t("internalNotes.post")}
        </Button>
      </div>
    </div>
  );
}
