import { Building, Clock, Users } from "lucide-react";
import { LIBRARY_BRANCHES } from "@/lib/constants";
import { MarketingPill } from "./button";
import { Reveal, SectionIntro } from "./reveal";

type BranchDetail = {
  code: string;
  name: string;
  readers: string;
  description: string;
  highlights: string[];
  hours: string;
  floor: string;
};

const DETAILS: Record<string, BranchDetail> = {
  EL: {
    code: "EL",
    name: LIBRARY_BRANCHES[0].name,
    readers: "Kinder to Grade 6",
    description:
      "The brightest room in the campus. Picture books, early readers, home reading titles and Filipino children's fiction sit low enough for a six-year-old to reach, and every pupil's SBTR begins here.",
    highlights: [
      "Home Reading and bilingual picture books",
      "Scheduled class visits with the adviser",
      "First SBTR and library card issued",
    ],
    hours: "7:30 a.m. – 4:30 p.m.",
    floor: "Ground floor, Elementary building",
  },
  HS: {
    code: "HS",
    name: LIBRARY_BRANCHES[1].name,
    readers: "Junior and Senior High",
    description:
      "Young-adult fiction, Filipiniana for subject projects and the reference aids behind the school paper. Reserve titles for research subjects are held on the shelf by the counter, and study carrels open during breaks.",
    highlights: [
      "Filipiniana and young-adult fiction",
      "Reserve shelf for subject projects",
      "Quiet study carrels at break time",
    ],
    hours: "7:30 a.m. – 5:00 p.m.",
    floor: "Second floor, High School building",
  },
  CGS: {
    code: "CGS",
    name: LIBRARY_BRANCHES[2].name,
    readers: "College and Graduate School",
    description:
      "The main branch and the circulation counter for the catalogue terminal. Programme references for BSIT, BEED, BSED, BSCE, BSA, BSHM and BSTM, bound periodicals, theses and published research output.",
    highlights: [
      "Programme references and journals",
      "Theses and research output collection",
      "Catalogue terminal and fine desk",
    ],
    hours: "7:30 a.m. – 6:00 p.m.",
    floor: "Main building, second floor",
  },
};

export function BranchCards() {
  const branches = Object.values(DETAILS);

  return (
    <section id="branches" className="border-t border-brand-100 bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionIntro
          eyebrow="Where the books live"
          title="Three branches, one membership"
          intro="A card works in every branch. A hold placed against the College library can be collected where it is easiest to reach, and the catalogue always says which shelf the copy sits on."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:gap-5">
          {branches.map((branch, index) => (
            <Reveal key={branch.code} delay={index * 0.07}>
              <article className="surface-card hover-lift relative flex h-full flex-col overflow-hidden p-5 sm:p-6">
                <div
                  className="absolute inset-x-0 top-0 h-24 opacity-90"
                  aria-hidden
                  style={{
                    backgroundImage:
                      "linear-gradient(160deg, rgba(212,163,115,0.32) 0%, rgba(245,240,230,0.05) 58%, transparent 100%)",
                  }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-1 font-serif text-[13px] tracking-[0.14em] text-cream">
                    {branch.code}
                  </span>
                  <MarketingPill tone="muted">{branch.readers}</MarketingPill>
                </div>

                <h3 className="relative mt-4 text-[19px] leading-snug text-ink">{branch.name}</h3>
                <p className="relative mt-2 flex-1 text-[14px] leading-6 text-ink-soft">
                  {branch.description}
                </p>

                <ul className="relative mt-4 space-y-1.5 text-[13px] leading-5 text-ink">
                  {branch.highlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>

                <dl className="relative mt-5 grid gap-2 border-t border-brand-100 pt-4 text-[12px] text-ink-soft">
                  <div className="flex items-center gap-2">
                    <Building className="h-3.5 w-3.5 text-brand-500" aria-hidden />
                    <dt className="sr-only">Location</dt>
                    <dd>{branch.floor}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-brand-500" aria-hidden />
                    <dt className="sr-only">Opening hours</dt>
                    <dd>{branch.hours}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-brand-500" aria-hidden />
                    <dt className="sr-only">Coverage</dt>
                    <dd>{branch.readers}</dd>
                  </div>
                </dl>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
