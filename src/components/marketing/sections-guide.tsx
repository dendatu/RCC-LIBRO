import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BookOpen, Hourglass, Lock } from "lucide-react";
import { POLICY_SUMMARY, SECTION_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { MarketingPill } from "./button";
import { Reveal, SectionIntro } from "./reveal";

const REFERENCE_ITEMS = [
  "Tagalog–English and English dictionaries",
  "Encyclopedias and school almanacs",
  "Philippine and world atlases",
];

const PERIODICAL_ITEMS = [
  "Magazines",
  "National and local newspapers",
  "Academic journals and research bulletins",
  "Clippings and cuttings files",
];

const GROUPS = [
  {
    key: "Circulation",
    title: "Circulation Section",
    blurb: "Titles that leave the library on a loan.",
    tone: "success" as const,
    badge: "Borrowable",
    icon: BookOpen,
    sections: Object.entries(SECTION_META).filter(([, meta]) => meta.group === "Circulation"),
    extras: [],
  },
  {
    key: "Reference",
    title: "Reference Section",
    blurb: "Consulted at the table; never checked out.",
    tone: "warning" as const,
    badge: "Library use only",
    icon: Lock,
    sections: Object.entries(SECTION_META).filter(([, meta]) => meta.group === "Reference"),
    extras: REFERENCE_ITEMS,
  },
  {
    key: "Periodicals",
    title: "Periodicals",
    blurb: "Current issues on the rack, bound back issues in the stack.",
    tone: "warning" as const,
    badge: "Library use only",
    icon: Lock,
    sections: Object.entries(SECTION_META).filter(([, meta]) => meta.group === "Periodicals"),
    extras: PERIODICAL_ITEMS,
  },
];

export function SectionsGuide() {
  return (
    <section id="sections" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionIntro
        eyebrow="Inside the library"
        title="Three sections, three sets of rules"
        intro="RCC arranges its holdings by how freely they travel. LIBRO carries that distinction into search results, shelf labels and the loan check itself."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:gap-5">
        {GROUPS.map((group, index) => (
          <Reveal key={group.key} delay={index * 0.07}>
            <article className="surface-card hover-lift flex h-full flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg text-ink">{group.title}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-ink-soft">{group.blurb}</p>
                </div>
                <MarketingPill tone={group.tone}>
                  <group.icon className="h-3.5 w-3.5" aria-hidden />
                  {group.badge}
                </MarketingPill>
              </div>

              <dl className="mt-4 space-y-3 border-t border-brand-100 pt-4">
                {group.sections.map(([key, meta]) => (
                  <div key={key}>
                    <dt className="text-[14px] font-medium text-ink">{meta.label}</dt>
                    <dd className="mt-0.5 text-[13px] leading-5 text-ink-soft">{meta.rule}</dd>
                  </div>
                ))}
              </dl>

              {group.extras.length ? (
                <ul className="mt-4 space-y-1.5 border-t border-brand-100 pt-4 text-[13px] text-ink-soft">
                  {group.extras.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.15}>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl text-ink">Borrowing rules at a glance</h3>
              <MarketingPill tone="brand">
                <Hourglass className="h-3.5 w-3.5" aria-hidden />
                Seven-day cycle
              </MarketingPill>
            </div>

            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {POLICY_SUMMARY.map((rule) => (
                <li key={rule.title} className="flex gap-3 rounded-xl bg-cream/70 p-3.5 ring-1 ring-brand-100">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium text-ink">{rule.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-ink-soft">{rule.body}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-start gap-3 rounded-xl bg-danger/8 p-3.5 ring-1 ring-danger/20">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <p className="text-[13px] leading-5 text-ink-soft">
                The desk refuses a loan when a member already holds three active books, when the SBTR
                is not on file, or when a penalty is still unsettled. Nothing is argued at the counter
                — the screen states the reason.
              </p>
            </div>

            <Link
              href="/policies"
              className={cn(
                "mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-brand-700",
                "underline decoration-brand-200 underline-offset-4 hover:decoration-brand-500",
              )}
            >
              Read the full borrowing policy and fine schedule
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="surface-card flex flex-col justify-between bg-brand-800 p-5 text-cream sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-soft">
                Reserve shelf
              </p>
              <h3 className="mt-3 font-serif text-2xl leading-snug text-cream">
                One hour in the library — or overnight from 4 p.m.
              </h3>
              <p className="mt-3 text-[14px] leading-7 text-cream/80">
                Reserve titles are set aside for coursework. Read one for an hour at the tables. From
                four in the afternoon the same copy may go home with you, due back at the start of the
                next school day.
              </p>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-cream/15 pt-5">
              <div>
                <dt className="text-[12px] uppercase tracking-[0.14em] text-cream/60">In-library</dt>
                <dd className="mt-1 font-serif text-xl text-cream">60 minutes</dd>
              </div>
              <div>
                <dt className="text-[12px] uppercase tracking-[0.14em] text-cream/60">Overdue</dt>
                <dd className="mt-1 font-serif text-xl text-cream">PHP 2.00 / hour</dd>
              </div>
            </dl>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
