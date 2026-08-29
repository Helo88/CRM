import Link from "next/link";
import { Eye } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ListPagination } from "@/components/ListPagination";
import { formatDateTime } from "@/lib/utils";
import { CustomerStatusFilter } from "./CustomerStatusFilter";

export interface CustomerTicketRow {
  id: string;
  reference: string;
  subject: string;
  status: "new" | "in_progress" | "answered" | "escalated" | "closed";
  updatedAt: string;
}

interface CustomerTicketListProps {
  tickets: CustomerTicketRow[];
  total: number;
  page: number;
  limit: number;
  currentQuery: string;
}

const STATUS_KEY: Record<CustomerTicketRow["status"], string> = {
  new: "statusNew",
  in_progress: "statusInProgress",
  answered: "statusAnswered",
  escalated: "statusEscalated",
  closed: "statusClosed",
};

const STATUS_BADGE_CLASS: Record<CustomerTicketRow["status"], string> = {
  new: "border-transparent bg-muted text-muted-foreground",
  in_progress: "border-transparent bg-warning/10 text-warning",
  answered: "border-transparent bg-success/10 text-success",
  escalated: "border-transparent bg-destructive/10 text-destructive",
  closed: "border-transparent bg-muted text-muted-foreground",
};

// Story 60 (merged customer-portal Story 36): the customer branch of
// /tickets — their own tickets only, status filter + last-updated +
// an explicit "view" action (an eye icon, not an implicit clickable
// row/text — decided with the user: a customer may not realize plain text
// is a link when it's the only interactive element on the row).
export async function CustomerTicketList({ tickets, total, page, limit, currentQuery }: CustomerTicketListProps) {
  const t = await getTranslations("Tickets");

  function hrefForPage(nextPage: number) {
    const params = new URLSearchParams(currentQuery);
    params.set("page", String(nextPage));
    return `/tickets?${params.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-6 text-xl font-bold tracking-tight md:text-2xl">{t("customerHeading")}</h1>

      <CustomerStatusFilter />

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          {currentQuery ? (
            <p className="text-muted-foreground">{t("empty")}</p>
          ) : (
            <>
              <p className="text-muted-foreground">{t("customerEmpty")}</p>
              <Button asChild size="sm">
                <Link href="/support">{t("customerEmptyCta")}</Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{ticket.reference}</span>
                  <Badge variant="outline" className={STATUS_BADGE_CLASS[ticket.status]}>
                    {t(STATUS_KEY[ticket.status])}
                  </Badge>
                </div>
                <p className="mt-1 font-medium">{ticket.subject}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{formatDateTime(ticket.updatedAt)}</p>
                  <Button asChild variant="ghost" size="icon" title={t("viewDetails")} className="text-primary hover:bg-primary/10 hover:text-primary">
                    <Link href={`/tickets/${ticket.id}`}>
                      <Eye className="size-4" />
                      <span className="sr-only">{t("viewDetails")}</span>
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnReference")}</TableHead>
                  <TableHead>{t("columnSubject")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnUpdated")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{ticket.reference}</TableCell>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE_CLASS[ticket.status]}>
                        {t(STATUS_KEY[ticket.status])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(ticket.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        title={t("viewDetails")}
                        className="text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Link href={`/tickets/${ticket.id}`}>
                          <Eye className="size-4" />
                          <span className="sr-only">{t("viewDetails")}</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <div className="mt-4">
        <ListPagination total={total} page={page} limit={limit} hrefForPage={hrefForPage} />
      </div>
    </div>
  );
}
