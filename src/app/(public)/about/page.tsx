import type { Metadata } from "next";
import Link from "next/link";
import {
  Accessibility,
  ArrowUpRight,
  HeartHandshake,
  Landmark,
  LibraryBig,
  MonitorSmartphone,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { MarketingPill } from "@/components/marketing/button";
import { PageHeader } from "@/components/marketing/page-header";
import { Reveal, SectionIntro } from "@/components/marketing/reveal";
import { LIBRARY_BRANCHES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About RCC LIBRO — the library system of Republic Central Colleges",
  description:
    "The mission, the three branch libraries, the Borrower, Librarian and Administrator roles, and the accessibility and responsiveness commitments behind RCC LIBRO.",
};

const PILLARS = [
  {
    icon: LibraryBig,
    title: "Every title findable",
    body: "A book that cannot be found is a book the college did not pay for. Each copy carries a call number, a branch, a shelf and a QR sticker, and the public catalogue shows the same facts a librarian sees.",
  },
  {
    icon: HeartHandshake,
    title: "Reading as a service, not a test",
    body: "The interface is written for a Grade 4 pupil and a graduate student in the same sentence set. No hidden rules, no surprises at the counter, no fine you were not told about.",
  },
  {
    icon: Landmark,
    title: "One record for the college",
    body: "Elementary, High School and College & Graduate School holdings sit in a single inventory, so the accession list, the SBTR and the termly report agree with one another.",
  },
];

const ROLES = [
  {
    slug: "Borrower",
    icon: UserCheck,
    tone: "brand" as const,
    summary: "Students and faculty, from Kinder to the Graduate School.",
    can: [
      "Search the catalogue and see real shelf availability",
      "Hold up to three titles and track each due date",
      "Reserve a borrowed copy and join the queue",
      "Read their own SBTR, loan history and penalty balance",
      "Receive due-date notices seven, three and one day ahead",
    ],
  },
  {
    slug: "Librarian",
    icon: Users,
    tone: "success" as const,
    summary: "The staff who run the counter, the shelves and the inventory count.",
    can: [
      "Issue and check in loans by scanning a copy or a card",
      "Register titles and copies, print QR and spine stickers",
      "Mark a copy Lost, Damaged or under maintenance",
      "Work the reservation queue and shelf-check a branch",
      "Post a penalty and explain the calculation line by line",
    ],
  },
  {
    slug: "Administrator",
    icon: ShieldCheck,
    tone: "gold" as const,
    summary: "The library head and the college offices that own the policy.",
    can: [
      "Publish the borrowing policy and fine schedule",
      "Waive a penalty, with the reason recorded on the account",
      "Add branches, sections, staff accounts and roles",
      "Read analytics across all three branches",
      "Export holdings, circulation and penalty reports",
    ],
  },
];

const ACCESSIBILITY = [
  {
    icon: Accessibility,
    title: "Usable by keyboard and by a screen reader",
    body: "Landmarks for the header, main region and footer; one heading path per page; visible focus rings in the brand brown; decorative artwork marked as hidden from assistive technology; tables with captions and header scopes. Colour is never the only signal — every status label also carries its word.",
  },
  {
    icon: MonitorSmartphone,
    title: "Built for the phone in a pupil’s pocket",
    body: "Mobile-first layout that widens to the catalogue terminal at the counter. Tables scroll inside their own labelled region instead of breaking the page, tap targets stay at least 44 pixels, and long loan lists reflow into cards on a small screen.",
  },
  {
    icon: ArrowUpRight,
    title: "Calm motion, honest speed",
    body: "Scroll reveals fade and rise once, and are reduced when the operating system asks for reduced motion. No auto-playing carousels, no parallax that fights a reader. Text is real text, so it scales with the browser setting and prints cleanly for the SBTR sheet.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About the system"
        title="A college library, kept in one book — the digital one"
        intro="RCC LIBRO is the Library Inventory and Book Recording Organizer of Republic Central Colleges, Angeles City Campus. It exists to make the shelves of three branches behave like one library for the people who read from them."
        breadcrumb={[
          { href: "/", label: "Home" },
          { href: "/about", label: "About" },
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <section aria-labelledby="mission-heading">
            <SectionIntro
              eyebrow="Mission"
              title="Put the right title in the right hands, and say plainly when it is due"
              intro="The library service of a college is measured in how often a reader leaves with something. LIBRO removes the three frictions that stop that: not knowing a title is held, not knowing which branch holds it, and not knowing when it must come back."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {PILLARS.map((pillar) => (
                <article key={pillar.title} className="surface-card hover-lift p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                    <pillar.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[17px] text-ink">{pillar.title}</h3>
                  <p className="mt-2 text-[14px] leading-6 text-ink-soft">{pillar.body}</p>
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="branches" aria-labelledby="about-branches-heading" className="mt-16 scroll-mt-24">
            <h2 id="about-branches-heading" className="text-2xl text-ink sm:text-3xl">
              The three branches
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              One card, one catalogue, three rooms with different readers. A branch carries its own shelf
              list and opening hours, and shares the member record with the other two.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {BRANCH_COPY.map((branch) => (
                <article key={branch.code} className="surface-card hover-lift flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[18px] leading-snug text-ink">{branch.name}</h3>
                    <MarketingPill tone="brand">{branch.code}</MarketingPill>
                  </div>
                  <p className="mt-1 text-[12.5px] font-medium uppercase tracking-[0.14em] text-brand-500">
                    {branch.readers}
                  </p>
                  <p className="mt-3 flex-1 text-[14px] leading-6 text-ink-soft">{branch.body}</p>
                  <p className="mt-4 border-t border-brand-100 pt-3 text-[13px] text-ink-soft">
                    {branch.note}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </Reveal>

        <Reveal>
          <section id="roles" aria-labelledby="roles-heading" className="mt-16 scroll-mt-24">
            <h2 id="roles-heading" className="text-2xl text-ink sm:text-3xl">
              Three roles, three points of view
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              Access is granted by role, never by guesswork. A borrower sees their own record; a librarian
              sees the branch; an administrator sees the college and owns the policy.
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {ROLES.map((role) => (
                <article key={role.slug} className="surface-card flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-cream">
                      <role.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-[18px] leading-tight text-ink">{role.slug}</h3>
                      <p className="text-[12.5px] leading-5 text-ink-soft">{role.summary}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-500">
                    In LIBRO they can
                  </p>
                  <ul className="mt-3 space-y-2 text-[14px] leading-6 text-ink-soft">
                    {role.can.map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <p className="mt-5 text-[13px] leading-6 text-ink-soft">
              Roles are assigned by the library head. A staff member may hold more than one role; the
              interface always shows the highest one in use, and every write action is stamped with the
              account and time behind it.
            </p>
          </section>
        </Reveal>

        <Reveal>
          <section
            id="accessibility"
            aria-labelledby="accessibility-heading"
            className="mt-16 scroll-mt-24"
          >
            <h2 id="accessibility-heading" className="text-2xl text-ink sm:text-3xl">
              Accessibility and responsiveness
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-soft">
              The library serves readers who use a phone, a terminal, a screen reader or a browser zoom of
              200 percent. These are the commitments the interface is built against, and the note we would
              like a reader to hold us to.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {ACCESSIBILITY.map((item) => (
                <article key={item.title} className="surface-card p-5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gold-soft text-brand-800">
                    <item.icon className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-[16px] leading-snug text-ink">{item.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">{item.body}</p>
                </article>
              ))}
            </div>

            <div className="surface-card mt-6 flex flex-col gap-3 bg-cream/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[14px] leading-6 text-ink-soft">
                Found a barrier — a screen that will not shrink, a label a reader cannot hear? Tell the desk
                and it becomes a ticket.
              </p>
              <Link
                href="/policies"
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-500"
              >
                Read the borrowing policy
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </section>
        </Reveal>
      </div>
    </>
  );
}

/** Branch descriptions kept beside the codes published in the catalogue. */
const BRANCH_COPY = [
  {
    code: LIBRARY_BRANCHES[0].code,
    name: LIBRARY_BRANCHES[0].name,
    readers: "Kinder to Grade 6",
    body: "Low shelves, picture spines and a bilingual reading corner. Home Reading titles and Filipino children’s fiction are issued here, and a pupil’s SBTR is opened the first time they visit with their adviser.",
    note: "Class visits are scheduled with the adviser; loans follow the pupil home.",
  },
  {
    code: LIBRARY_BRANCHES[1].code,
    name: LIBRARY_BRANCHES[1].name,
    readers: "Junior and Senior High",
    body: "Young-adult fiction, Filipiniana for subject projects and the reference aids behind the school paper. The reserve shelf is busiest here, because research subjects set titles by the hour.",
    note: "Study carrels open during breaks; reserve titles are held by the counter.",
  },
  {
    code: LIBRARY_BRANCHES[2].code,
    name: LIBRARY_BRANCHES[2].name,
    readers: "College and Graduate School",
    body: "The main branch and the circulation counter for the catalogue terminal: programme references for BSIT, BEED, BSED, BSCE, BSA, BSHM and BSTM, bound periodicals, theses and published research output.",
    note: "Home of the Filipiniana shelf and the college’s research collection.",
  },
];
