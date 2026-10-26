import {
  ChartNoAxesColumn,
  BellRing,
  Layers,
  NotebookText,
  QrCode,
  SearchCode,
  ShieldCheck,
  TicketCheck,
  Coins,
} from "lucide-react";
import { Reveal, SectionIntro } from "./reveal";

type Feature = {
  icon: React.ElementType;
  title: string;
  body: string;
  note: string;
};

const FEATURES: Feature[] = [
  {
    icon: Layers,
    title: "Multi-branch inventory",
    body: "One catalogue across the Elementary, High School and College & Graduate School libraries, with each copy tied to a branch, shelf and accession number.",
    note: "Three shelves, one record",
  },
  {
    icon: NotebookText,
    title: "Digital SBTR",
    body: "The Student Book Tracer Record lives in the system: titles a learner has borrowed, returns cleared, and any outstanding penalty, visible to the class adviser and the librarian.",
    note: "Replaces the paper tracer book",
  },
  {
    icon: QrCode,
    title: "QR code on every title",
    body: "Each catalogued copy carries a printed QR sticker. Scan it at the desk to open the item, check the shelf location and issue or return the loan in one pass.",
    note: "Print-ready QR sheets",
  },
  {
    icon: SearchCode,
    title: "OPAC public search",
    body: "Anyone on campus can search by title, author, subject or call number and see whether a copy is on the shelf before walking to the stacks.",
    note: "Open to borrowers and visitors",
  },
  {
    icon: Coins,
    title: "Automatic fine calculator",
    body: "Overdue fines are computed for the exact number of days late — weekends and holidays included — and reserve overruns at the hourly rate, then posted to the member account.",
    note: "PHP 1.00 per day · PHP 2.00 per hour",
  },
  {
    icon: BellRing,
    title: "Due-date e-mail reminders",
    body: "Borrowers get a courteous notice seven, three and one day before a loan is due, and a follow-up the morning after the due date if the item is still out.",
    note: "7 · 3 · 1 day lead times",
  },
  {
    icon: TicketCheck,
    title: "Online reservations",
    body: "Place a hold on a borrowed title from your phone. The queue is respected, the next copy in frees itself to you, and unclaimed holds expire on the shelf.",
    note: "Holds queue at the desk",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Borrowers see their own loans and fines. Librarians issue, return and shelf-check. Administrators approve waivers, manage staff and publish policy.",
    note: "Borrower · Librarian · Administrator",
  },
  {
    icon: ChartNoAxesColumn,
    title: "Analytics dashboard",
    body: "Loans per branch, most-requested titles, overdue trends and reservation demand — the numbers the library needs for its annual report to the college.",
    note: "Termly and yearly views",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionIntro
        eyebrow="What the system does"
        title="Built around the way a college library actually runs"
        intro="Circulation, reference and periodicals all follow the RCC rules, so the desk never has to reinterpret policy and the borrower always knows where they stand."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {FEATURES.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 0.05}>
            <FeatureCard feature={feature} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <article className="surface-card hover-lift flex h-full flex-col p-5 sm:p-6">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-[17px] leading-snug text-ink">{feature.title}</h3>
      <p className="mt-2 flex-1 text-[14px] leading-6 text-ink-soft">{feature.body}</p>
      <p className="mt-4 border-t border-brand-100 pt-3 text-[12px] font-medium uppercase tracking-[0.12em] text-brand-500">
        {feature.note}
      </p>
    </article>
  );
}
