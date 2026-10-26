"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, CalendarClock, CircleDollarSign, ExternalLink, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/member/status-pill";
import { SECTION_META } from "@/lib/constants";
import { daysUntil, formatDate, formatPeso, relativeDue, toneFromKey } from "@/lib/utils";
import type { MemberLoan } from "@/server/data/member";

type Urgency = {
  label: string;
  badge: "destructive" | "warning" | "gold" | "success";
  accent: string;
};

function urgencyFor(loan: MemberLoan): Urgency {
  const diff = daysUntil(loan.due_date);
  if (loan.is_overdue || diff < 0) {
    return { label: relativeDue(loan.due_date), badge: "destructive", accent: "bg-danger" };
  }
  if (diff === 0) {
    return { label: "Due today", badge: "warning", accent: "bg-warning" };
  }
  if (diff <= 3) {
    return { label: relativeDue(loan.due_date), badge: "gold", accent: "bg-gold" };
  }
  return { label: relativeDue(loan.due_date), badge: "success", accent: "bg-success" };
}

function bookHref(loan: MemberLoan) {
  return loan.copy?.barcode ? `/book/${encodeURIComponent(loan.copy.barcode)}` : "/dashboard/catalog";
}

function Cover({ loan }: { loan: MemberLoan }) {
  const tone = toneFromKey(loan.book?.accession_number ?? loan.id);
  if (loan.book?.cover_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={loan.book.cover_image_url}
        alt=""
        className="size-14 shrink-0 rounded-lg border border-border object-cover"
      />
    );
  }
  return (
    <span
      className={`flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tone} text-cream`}
      aria-hidden="true"
    >
      <BookOpen className="size-5" />
    </span>
  );
}

export function LoanList({ loans, mode = "open" }: { loans: MemberLoan[]; mode?: "open" | "past" }) {
  return (
    <ul className="space-y-3">
      {loans.map((loan, index) => {
        const urgency = urgencyFor(loan);
        const section = loan.section ? SECTION_META[loan.section] : null;
        return (
          <motion.li
            key={loan.id}
            id={mode === "open" ? loan.id : undefined}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
            className="scroll-mt-28"
          >
            <article
              className={`surface-card hover-lift relative overflow-hidden p-4 pl-5 ${
                mode === "open" && urgency.badge === "destructive" ? "border-danger/35" : ""
              }`}
            >
              <span
                className={`absolute inset-y-0 left-0 w-1 ${
                  mode === "open" ? urgency.accent : "bg-brand-200"
                }`}
                aria-hidden="true"
              />
              <div className="flex items-start gap-3">
                <Cover loan={loan} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-serif text-base font-semibold text-ink">
                        <Link
                          href={bookHref(loan)}
                          className="underline-offset-4 hover:text-brand-700 hover:underline"
                        >
                          {loan.book?.title ?? "Retired catalogue record"}
                        </Link>
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {loan.book?.author ?? "Author unrecorded"} · accession{" "}
                        <span className="font-mono">{loan.book?.accession_number ?? "—"}</span>
                        {loan.book?.call_number ? ` · ${loan.book.call_number}` : ""}
                      </p>
                    </div>
                    {mode === "open" ? (
                      <Badge variant={urgency.badge}>
                        <CalendarClock className="size-3" />
                        {urgency.label}
                      </Badge>
                    ) : (
                      <StatusPill status={loan.status} />
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{loan.reference_no}</span>
                    {section ? (
                      <span className={`rounded-full px-2 py-0.5 font-medium ${section.hue}`}>
                        {section.label}
                      </span>
                    ) : null}
                    <span>Borrowed {formatDate(loan.date_borrowed)}</span>
                    <span>Due {formatDate(loan.due_date)}</span>
                    {mode === "past" && loan.date_returned ? (
                      <span>Returned {formatDate(loan.date_returned)}</span>
                    ) : null}
                    {loan.is_overdue && loan.overdue_days > 0 ? (
                      <span className="font-medium text-danger">
                        {loan.overdue_days} day{loan.overdue_days === 1 ? "" : "s"} late
                      </span>
                    ) : null}
                    {Number(loan.fine_charged) > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-warning">
                        <CircleDollarSign className="size-3" />
                        {formatPeso(loan.fine_charged)} charged
                      </span>
                    ) : null}
                  </div>

                  {mode === "open" ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Hourglass className="size-3" />
                        Renewal {loan.renewals_used} of {loan.max_renewals} · ask the circulation desk
                      </span>
                      <Link
                        href={bookHref(loan)}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
                      >
                        Open title record <ExternalLink className="size-3" />
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          </motion.li>
        );
      })}
    </ul>
  );
}
