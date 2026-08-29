import { getTranslations } from "next-intl/server";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

// platform Story 59: one reusable pagination control, built alongside its
// first consumer (ticket-management Story 60's ticket queue/list — see that
// story's merged-scope intake) so later list views (customer roster, KB
// articles, reports) can adopt it without rework. Server-driven: every
// control is a plain <Link> to a caller-supplied href, no client state.
interface ListPaginationProps {
  total: number;
  page: number;
  limit: number;
  hrefForPage: (page: number) => string;
}

const PAGE_WINDOW = 2;

export async function ListPagination({ total, page, limit, hrefForPage }: ListPaginationProps) {
  if (total === 0) return null;

  const t = await getTranslations("Pagination");
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const start = Math.max(1, page - PAGE_WINDOW);
  const end = Math.min(totalPages, page + PAGE_WINDOW);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-muted-foreground">{t("showing", { from, to, total })}</p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={hrefForPage(Math.max(1, page - 1))}
              text={t("previous")}
              className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
              aria-disabled={page <= 1}
            />
          </PaginationItem>
          {start > 1 && (
            <>
              <PaginationItem>
                <PaginationLink href={hrefForPage(1)}>1</PaginationLink>
              </PaginationItem>
              {start > 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
            </>
          )}
          {pages.map((p) => (
            <PaginationItem key={p}>
              <PaginationLink href={hrefForPage(p)} isActive={p === page}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          {end < totalPages && (
            <>
              {end < totalPages - 1 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink href={hrefForPage(totalPages)}>{totalPages}</PaginationLink>
              </PaginationItem>
            </>
          )}
          <PaginationItem>
            <PaginationNext
              href={hrefForPage(Math.min(totalPages, page + 1))}
              text={t("next")}
              className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
              aria-disabled={page >= totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
