import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BadgeCheck, Banknote, BookOpen, Lock } from "lucide-react";
import { MarketingPill } from "@/components/marketing/button";
import { PageHeader, Prose } from "@/components/marketing/page-header";
import { Reveal } from "@/components/marketing/reveal";
import { SECTION_META } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Borrowing policy and fines — RCC LIBRO",
  description:
    "The official circulation rules of the Republic Central Colleges libraries: SBTR requirement, three titles for seven days, PHP 1.00 per day overdue, reserve shelf rules, and the fine schedule for lost or damaged books.",
};

const ELIGIBILITY = [
  {
    icon: BookOpen,
    title: "Students",
    tone: "brand" as const,
    body: "A learner may borrow only with an active Student Book Tracer Record (SBTR) on file. The SBTR is opened the first time the pupil or college register is verified at the desk, and it travels with the student across all three branches.",
  },
  {
    icon: BadgeCheck,
    title: "Faculty and staff",
    tone: "success" as const,
    body: "Faculty borrow against a department ID and the same three-title limit. Books requested for a class are issued to the teacher, whose record — not the pupils’ — carries the loan.",
  },
  {
    icon: Lock,
    title: "Visitors",
    tone: "muted" as const,
    body: "Guests may use the reading rooms and the public catalogue. Reference works, periodicals and clippings stay in the library for everyone, including cardholders.",
  },
];

const ENTITLEMENTS = [
  {
    section: "General Collection, Filipiniana, Home Reading, Fiction",
    travels: "Take home",
    loan: "3 titles · 7 days",
    penalty: "PHP 1.00 per day late",
  },
  {
    section: "Newly Acquired Books",
    travels: "Take home",
    loan: "3 titles · 7 days",
    penalty: "PHP 1.00 per day late",
  },
  {
    section: "Reserve Books",
    travels: "In-library, or take home from 4:00 p.m.",
    loan: "1 hour · overnight to next school day",
    penalty: "PHP 2.00 per hour late",
  },
  {
    section: "Research Output",
    travels: "Consultation loan with librarian approval",
    loan: "As approved per title",
    penalty: "PHP 1.00 per day late",
  },
  {
    section: "Reference (dictionaries, encyclopedias, atlases)",
    travels: "Library use only",
    loan: "Not issued",
    penalty: "No loan, no fine",
  },
  {
    section: "Periodicals (magazines, newspapers, journals, clippings)",
    travels: "Library use only",
    loan: "Not issued",
    penalty: "No loan, no fine",
  },
];

const FINES = [
  {
    item: "Overdue book",
    rate: "PHP 1.00 per day",
    basis: "Charged per title, per calendar day after the due date. Weekends and holidays count.",
    tone: "warning" as const,
  },
  {
    item: "Overdue reserve book (take-home)",
    rate: "PHP 2.00 per hour",
    basis: "Charged from the start of the next school day until the copy is checked in at the desk.",
    tone: "warning" as const,
  },
  {
    item: "Lost book",
    rate: "Replacement cost + PHP 150.00",
    basis: "The current shelf price of the same edition, plus a fixed PHP 150.00 processing fee for cataloguing and the QR sticker.",
    tone: "danger" as const,
  },
  {
    item: "Damaged book",
    rate: "50% of acquisition price",
    basis: "Torn or written pages, a broken binding, water or tape damage: half of the price the college paid for that copy.",
    tone: "danger" as const,
  },
  {
    item: "Overdue notice, unpaid balance",
    rate: "Loan privilege suspended",
    basis: "An unsettled penalty holds new loans and reservations until the account is cleared or waived.",
    tone: "info" as const,
  },
];

const WORKFLOW = [
  {
    title: "Report it at the desk",
    body: "Tell the librarian the same day a title is misplaced, soaked, or returned with torn pages. Bring the card number or the QR sticker; the copy is identified without the book in hand.",
  },
  {
    title: "The copy is marked Lost or Damaged",
    body: "The librarian changes the copy status in LIBRO. The title stays in the catalogue so searchers see other copies, and the item is pulled from the shelf list for inventory.",
  },
  {
    title: "Penalty is assessed",
    body: "LIBRO posts the amount to your account: replacement cost plus the PHP 150.00 processing fee for a lost copy, or half the acquisition price for a damaged one, alongside any overdue days already accrued.",
  },
  {
    title: "Settle in cash or have it waived",
    body: "Pay at the circulation desk and the system records an official settlement, or an Administrator reviews the case — a borrowed copy stolen from a bag, a shelving error found in the next count — and waives the penalty in writing with a reason on file.",
  },
  {
    title: "Borrowing privilege is restored",
    body: "Once the balance is cleared or waived, the block lifts immediately: pending reservations resume their place in the queue, and loans can be issued again that same afternoon.",
  },
];

const QUESTIONS = [
  {
    q: "Do weekends and holidays count in a fine?",
    a: "Yes. The seven-day loan runs on calendar days, and PHP 1.00 accrues for every day a title is late, including Saturdays, Sundays, breaks and holidays. A due date that falls on a closure is still the due date.",
  },
  {
    q: "Can I renew a book?",
    a: "Ask at the desk with the copy and your card. If no hold is waiting, the librarian renews it once for another seven days; the SBTR and your e-mail reminder both update.",
  },
  {
    q: "What if I have not finished a reserve title?",
    a: "Return it before 4:00 p.m. and take the same copy out again the next morning for another hour. From 4:00 p.m. you may bring it home, due at the start of the next school day.",
  },
  {
    q: "My account says suspended, but I returned everything.",
    a: "Bring the books to the desk for a shelf check. A copy that was never scanned in keeps the loan open. The librarian corrects the record and the block lifts without a fine when the error is on our side.",
  },
];

export default function PoliciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Circulation rules"
        title="Borrowing policy of the RCC libraries"
        intro="These are the desk rules of Republic Central Colleges — Angeles City Campus — written out so a borrower, an adviser and a librarian read the same numbers. The system enforces them; the policy says why."
        breadcrumb={[
          { href: "/", label: "Home" },
          { href: "/policies", label: "Policies" },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <section id="eligibility" aria-labelledby="eligibility-heading" className="scroll-mt-24">
            <h2 id="eligibility-heading" className="text-2xl text-ink sm:text-3xl">
              Who may borrow, and on what record
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              A loan is always tied to a person, never to a class list. LIBRO releases a book only to
              the member whose card or SBTR is scanned at the counter.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {ELIGIBILITY.map((item) => (
                <article key={item.title} className="surface-card hover-lift p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <item.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[17px] text-ink">{item.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-ink-soft">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="entitlements" aria-labelledby="entitlements-heading" className="mt-14 scroll-mt-24">
            <h2 id="entitlements-heading" className="text-2xl text-ink sm:text-3xl">
              What each section allows
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              Maximum holding at one time: three titles. Reference works and periodicals are consulted
              in the reading room and are never issued, so they cannot be overdue.
            </p>

            <ScrollFrame label="Loan entitlements by section">
              <table className="w-full min-w-[46rem] border-collapse text-left text-[14px]">
                <caption className="sr-only">
                  Loan entitlements by library section: whether the title leaves the library, the loan
                  period, and the overdue penalty.
                </caption>
                <thead>
                  <tr className="border-b border-brand-200 bg-cream/70 text-[12px] uppercase tracking-[0.12em] text-brand-700">
                    <th scope="col" className="py-3 pr-4 font-semibold">Section</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Travels</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Loan period</th>
                    <th scope="col" className="py-3 font-semibold">Overdue penalty</th>
                  </tr>
                </thead>
                <tbody>
                  {ENTITLEMENTS.map((row) => (
                    <tr key={row.section} className="border-b border-brand-100 align-top last:border-0">
                      <th scope="row" className="py-3.5 pr-4 font-medium text-ink">
                        {row.section}
                      </th>
                      <td className="py-3.5 pr-4 text-ink-soft">{row.travels}</td>
                      <td className="py-3.5 pr-4 text-ink-soft">{row.loan}</td>
                      <td className="py-3.5 text-ink-soft">{row.penalty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFrame>

            <p className="mt-4 text-[13px] leading-6 text-ink-soft">
              Borrowing is refused when a member already holds three active books, when the SBTR is not
              on file, or when the account carries an unresolved penalty. The desk screen states which
              of the three reasons applied.
            </p>
          </section>
        </Reveal>

        <Reveal>
          <section id="fines" aria-labelledby="fines-heading" className="mt-14 scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="fines-heading" className="text-2xl text-ink sm:text-3xl">
                Fine schedule
              </h2>
              <MarketingPill tone="gold">
                <Banknote className="h-3.5 w-3.5" aria-hidden />
                Settlement in cash at the desk
              </MarketingPill>
            </div>

            <ScrollFrame label="Fine schedule">
              <table className="w-full min-w-[44rem] border-collapse text-left text-[14px]">
                <caption className="sr-only">
                  Fines: overdue rate, reserve overdue rate, lost book, damaged book and the effect of
                  an unpaid balance.
                </caption>
                <thead>
                  <tr className="border-b border-brand-200 bg-cream/70 text-[12px] uppercase tracking-[0.12em] text-brand-700">
                    <th scope="col" className="py-3 pr-4 font-semibold">Charge</th>
                    <th scope="col" className="py-3 pr-4 font-semibold">Rate</th>
                    <th scope="col" className="py-3 font-semibold">How it is computed</th>
                  </tr>
                </thead>
                <tbody>
                  {FINES.map((fine) => (
                    <tr key={fine.item} className="border-b border-brand-100 align-top last:border-0">
                      <th scope="row" className="py-3.5 pr-4 font-medium text-ink">
                        {fine.item}
                      </th>
                      <td className="py-3.5 pr-4">
                        <MarketingPill tone={fine.tone}>{fine.rate}</MarketingPill>
                      </td>
                      <td className="py-3.5 text-ink-soft">{fine.basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFrame>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="surface-card bg-brand-800 p-5 text-cream">
                <h3 className="font-serif text-lg text-cream">Reserve shelf, in plain terms</h3>
                <p className="mt-2 text-[14px] leading-7 text-cream/85">
                  A reserve title is read for one hour at the tables. From 4:00 p.m. the same copy may be
                  taken home, due back at the start of the next school day — every hour past that is
                  charged at PHP 2.00, because another class is waiting for it in the first period.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-[0.875rem] bg-danger/8 p-5 ring-1 ring-danger/20">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
                <p className="text-[14px] leading-7 text-ink-soft">
                  <strong className="text-ink">Fines are not a revenue line.</strong> They exist to move
                  books back onto the shelf. A penalty you cannot pay this term is exactly the conversation
                  an Administrator is there to have — in writing, with the reason recorded on your account.
                </p>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="lost-damaged" aria-labelledby="workflow-heading" className="mt-14 scroll-mt-24">
            <h2 id="workflow-heading" className="text-2xl text-ink sm:text-3xl">
              Lost or damaged book workflow
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              Five steps, and the block on your card is lifted by the last one. Nothing here is decided
              verbally at the counter; every step is stamped with the user, role and time.
            </p>

            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {WORKFLOW.map((step, index) => (
                <li key={step.title} className="surface-card hover-lift flex h-full flex-col p-5">
                  <span className="font-serif text-3xl leading-none text-brand-200" aria-hidden>
                    {index + 1}
                  </span>
                  <h3 className="mt-2 text-[15px] leading-snug text-ink">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>
        </Reveal>

        <Reveal>
          <section id="sections-reference" aria-labelledby="sections-heading" className="mt-14 scroll-mt-24">
            <h2 id="sections-heading" className="text-2xl text-ink sm:text-3xl">
              Section labels used at the desk
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              The same wording appears in the catalogue, on shelf tags and in the loan screen, so a member
              can match what they read here to what they see on the shelf.
            </p>

            <div className="surface-card mt-6 divide-y divide-brand-100">
              {Object.entries(SECTION_META).map(([key, meta]) => (
                <div key={key} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6">
                  <h3 className="w-full max-w-xs shrink-0 text-[15px] font-medium text-ink">{meta.label}</h3>
                  <p className="flex-1 text-[14px] leading-6 text-ink-soft">{meta.rule}</p>
                  <MarketingPill tone={meta.borrowable ? "success" : "warning"} className="shrink-0">
                    {meta.borrowable ? "Circulating" : "Library use only"}
                  </MarketingPill>
                </div>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="questions" aria-labelledby="questions-heading" className="mt-14 scroll-mt-24">
            <h2 id="questions-heading" className="text-2xl text-ink sm:text-3xl">
              Questions the desk hears most
            </h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {QUESTIONS.map((item) => (
                <div key={item.q} className="surface-card p-5">
                  <dt className="text-[15px] font-medium leading-snug text-ink">{item.q}</dt>
                  <dd className="mt-2 text-[14px] leading-6 text-ink-soft">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        <Reveal>
          <div className="surface-card mt-14 flex flex-col gap-4 bg-cream/70 p-6 sm:flex-row sm:items-center sm:justify-between">
            <Prose>
              <h3 className="mt-0 text-[17px]">Policy still belongs to the librarian, not the software</h3>
              <p className="mt-1 text-[14px] leading-6 text-ink-soft">
                This page mirrors the circulation rules issued by the library. Where the system and the desk
                disagree, the desk decides and the Administrator records the correction.{" "}
                <Link href="/about" className="inline-flex items-center gap-1">
                  How the roles are split
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </p>
            </Prose>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href="/register"
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-medium text-cream transition-colors hover:bg-brand-700"
              >
                Get a library card
              </Link>
              <Link
                href="/catalog"
                className="text-[13px] text-ink-soft underline decoration-brand-200 underline-offset-4 hover:text-brand-800"
              >
                Check the catalogue first
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </>
  );
}

/** Keyboard-scrollable wrapper so wide tables stay usable on a phone. */
function ScrollFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={`${label} (scrollable)`}
      className="surface-card mt-6 overflow-x-auto p-4 outline-offset-4 focus-visible:outline-2 sm:p-5"
    >
      {children}
    </div>
  );
}
