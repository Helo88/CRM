"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleAlert, Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmActionButton } from "@/app/admin/users/ConfirmActionButton";
import {
  addInternalNote,
  editInternalNote,
  uploadAttachments,
  replaceIdDocument,
  deleteAttachment,
  type UploadActionState,
} from "./actions";

interface HydratedPerson {
  id: string;
  name: string;
}

export interface HydratedAttachment {
  id: string;
  fileName: string;
  size: number | null;
  url: string;
  uploadedAt: string;
  uploader: HydratedPerson | null;
}

export interface HydratedNote {
  id: string;
  text: string;
  createdAt: string;
  author: HydratedPerson | null;
}

const INITIAL_STATE: UploadActionState = { error: null };

function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Clears an uncontrolled form after a successful submission (no error on a
// non-initial state) without ever clearing it on the very first render —
// safe here specifically because these forms always start empty (add-only,
// never pre-filled with server data), unlike a profile-edit form.
function useResetOnSuccess(ref: React.RefObject<HTMLFormElement | null>, state: UploadActionState) {
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!state.error) {
      ref.current?.reset();
    }
  }, [state]);
}

// A single note, editable in place — any staff who can add a note can also
// correct one (same customers:manage gate on the backend); no delete, by
// direct instruction.
function NoteItem({ customerId, note }: { customerId: string; note: HydratedNote }) {
  const t = useTranslations("CustomerProfile");
  const [isEditing, setIsEditing] = useState(false);
  const editAction = editInternalNote.bind(null, customerId, note.id);
  const [state, formAction, pending] = useActionState(editAction, INITIAL_STATE);
  const wasPending = useRef(pending);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setIsEditing(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (isEditing) {
    return (
      <li className="rounded-xl border border-border p-3">
        <form action={formAction} className="flex flex-col gap-2">
          <Textarea name="text" defaultValue={note.text} disabled={pending} required />
          {state.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t("savingNote") : t("saveNote")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setIsEditing(false)}>
              {t("cancelEdit")}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
        <span>{note.author?.name ?? t("unknownAuthor")}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span>{new Date(note.createdAt).toLocaleString()}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={t("editNote")}
            aria-label={t("editNote")}
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm whitespace-pre-wrap">{note.text}</p>
    </li>
  );
}

// A single general attachment, deletable — any staff who can upload one can
// also remove it (same customers:manage gate on the backend).
// ConfirmActionButton already owns the pending/error state around onConfirm,
// so this stays a thin wrapper.
function AttachmentItem({
  customerId,
  attachment,
}: {
  customerId: string;
  attachment: HydratedAttachment;
}) {
  const t = useTranslations("CustomerProfile");

  return (
    <li className="flex items-center gap-2">
      <a
        href={`/api/customers/${customerId}/attachments/${attachment.id}`}
        target="_blank"
        rel="noreferrer"
        className="flex flex-1 flex-col gap-0.5 rounded-xl border border-border p-3 text-sm hover:bg-muted/40"
      >
        <span className="font-medium text-primary">{attachment.fileName}</span>
        <span className="text-xs text-muted-foreground">
          {formatSize(attachment.size)} · {attachment.uploader?.name ?? t("unknownAuthor")} ·{" "}
          {new Date(attachment.uploadedAt).toLocaleDateString()}
        </span>
      </a>
      <ConfirmActionButton
        icon={<Trash2 className="size-4" />}
        label={t("deleteAttachment")}
        destructive
        confirmTitle={t("deleteAttachmentConfirmTitle")}
        confirmBody={t("deleteAttachmentConfirmBody")}
        confirmActionLabel={t("deleteAttachmentConfirmAction")}
        cancelLabel={t("deleteAttachmentCancel")}
        onConfirm={() => deleteAttachment(customerId, attachment.id)}
      />
    </li>
  );
}

// Staff-facing Step 2 (Story 7): chronological notes + add-note, the
// single-slot ID document (with replace), and the accumulating general
// attachments list. Rendered only when the profile response includes
// internalNotes — see CustomerProfileForm.tsx.
export function InternalStep({
  customerId,
  notes,
  attachments,
  idDocument,
}: {
  customerId: string;
  notes: HydratedNote[];
  attachments: HydratedAttachment[];
  idDocument: HydratedAttachment | null;
}) {
  const t = useTranslations("CustomerProfile");

  const noteAction = addInternalNote.bind(null, customerId);
  const [noteState, noteFormAction, notePending] = useActionState(noteAction, INITIAL_STATE);
  const noteFormRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(noteFormRef, noteState);

  const attachAction = uploadAttachments.bind(null, customerId);
  const [attachState, attachFormAction, attachPending] = useActionState(attachAction, INITIAL_STATE);
  const attachFormRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(attachFormRef, attachState);

  const idAction = replaceIdDocument.bind(null, customerId);
  const [idState, idFormAction, idPending] = useActionState(idAction, INITIAL_STATE);
  const idFormRef = useRef<HTMLFormElement>(null);
  useResetOnSuccess(idFormRef, idState);

  return (
    <div className="flex flex-col gap-6 px-6 pb-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{t("notesHeading")}</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
        ) : (
          <ul className="flex max-h-56 flex-col gap-3 overflow-y-auto">
            {notes.map((note) => (
              <NoteItem key={note.id} customerId={customerId} note={note} />
            ))}
          </ul>
        )}
        <form ref={noteFormRef} action={noteFormAction} className="flex flex-col gap-2">
          <Textarea name="text" placeholder={t("addNotePlaceholder")} disabled={notePending} required />
          {noteState.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{noteState.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="sm" disabled={notePending} className="self-start">
            {notePending ? t("addingNote") : t("addNote")}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">{t("idDocumentHeading")}</h3>
        {idDocument ? (
          <a
            href={`/api/customers/${customerId}/id-document`}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-0.5 rounded-xl border border-border p-3 text-sm hover:bg-muted/40"
          >
            <span className="font-medium text-primary">{idDocument.fileName}</span>
            <span className="text-xs text-muted-foreground">
              {formatSize(idDocument.size)} · {idDocument.uploader?.name ?? t("unknownAuthor")} ·{" "}
              {new Date(idDocument.uploadedAt).toLocaleDateString()}
            </span>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noIdDocument")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("idDocumentReplaceWarning")}</p>
        <p className="text-xs text-muted-foreground">{t("idDocumentAcceptedTypes")}</p>
        {/* Kept in sync by hand with backend/src/middleware/upload.ts's
            ID_DOCUMENT_ACCEPTED_TYPES — jpg/png/pdf only, not "any image". */}
        <form ref={idFormRef} action={idFormAction} className="flex flex-col gap-2">
          <Input
            type="file"
            name="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            disabled={idPending}
            required
          />
          {idState.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{idState.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="sm" disabled={idPending} className="self-start">
            {idPending ? t("uploadingIdDocument") : t("uploadIdDocument")}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">{t("attachmentsHeading")}</h3>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAttachments")}</p>
        ) : (
          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {attachments.map((attachment) => (
              <AttachmentItem key={attachment.id} customerId={customerId} attachment={attachment} />
            ))}
          </ul>
        )}
        <form ref={attachFormRef} action={attachFormAction} className="flex flex-col gap-2">
          <Input type="file" name="files" multiple disabled={attachPending} required />
          {attachState.error && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{attachState.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="sm" disabled={attachPending} className="self-start">
            {attachPending ? t("uploadingFiles") : t("uploadFiles")}
          </Button>
        </form>
      </section>
    </div>
  );
}
