import { useTranslations } from "next-intl";
import { FileText, File as FileIcon } from "lucide-react";
import type { HydratedAttachment } from "./InternalStep";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

function fileKind(fileName: string): "image" | "pdf" | "other" {
  const lower = fileName.toLowerCase();
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "image";
  if (lower.endsWith(".pdf")) return "pdf";
  return "other";
}

interface GalleryItem extends HydratedAttachment {
  href: string;
}

// Read-only Step 2 for a customer viewing their OWN profile (Story 7) — no
// uploader name, no note content, no upload controls. Rendered only when
// the profile response has no internalNotes key at all (see
// CustomerProfileForm.tsx); attachments/idDocument being present is what
// this component actually displays. Links go through this app's own proxy
// routes (see frontend/lib/customerFileProxy.ts), not the backend's raw
// `url` field directly — a plain browser request can't attach the bearer
// token the backend's file routes require.
export function AttachmentsGalleryStep({
  customerId,
  attachments,
  idDocument,
}: {
  customerId: string;
  attachments: HydratedAttachment[];
  idDocument: HydratedAttachment | null;
}) {
  const t = useTranslations("CustomerProfile");
  const items: GalleryItem[] = [
    ...(idDocument ? [{ ...idDocument, href: `/api/customers/${customerId}/id-document` }] : []),
    ...attachments.map((a) => ({ ...a, href: `/api/customers/${customerId}/attachments/${a.id}` })),
  ].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  if (items.length === 0) {
    return <p className="px-6 pb-6 text-sm text-muted-foreground">{t("noDocuments")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-6 pb-6 sm:grid-cols-3">
      {items.map((item) => {
        const kind = fileKind(item.fileName);
        const label = t("galleryTileLabel", { fileName: item.fileName, date: new Date(item.uploadedAt).toLocaleDateString() });
        return (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="group flex flex-col overflow-hidden rounded-xl border border-border transition-colors hover:border-primary/40"
          >
            <div className="flex aspect-square items-center justify-center bg-muted/40">
              {kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.href} alt={item.fileName} className="size-full object-cover" />
              ) : kind === "pdf" ? (
                <FileText className="size-8 text-muted-foreground" />
              ) : (
                <FileIcon className="size-8 text-muted-foreground" />
              )}
            </div>
            <div className="p-2">
              <p className="truncate text-xs font-medium">{item.fileName}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(item.uploadedAt).toLocaleDateString()}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
