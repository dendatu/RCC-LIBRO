import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, SectionIntro } from "./reveal";

type Voice = {
  quote: string;
  name: string;
  role: string;
  initials: string;
  tone: string;
};

/** Illustrative sample voices written for this page — personas, not published endorsements. */
const VOICES: Voice[] = [
  {
    quote:
      "I reserved a networking reference from my phone during lunch and it was waiting at the College desk by my afternoon class. The one-day reminder is the reason I have never paid a peso in fines.",
    name: "Kyle Matthew S.",
    role: "BSIT third-year student",
    initials: "KS",
    tone: "from-brand-600 to-brand-800",
  },
  {
    quote:
      "The SBTR used to be one thick notebook that only one of us could read at a time. Now an adviser can see which pupils owe books before the class visit, and I can print a QR sheet for a new arrival list in an afternoon.",
    name: "Mrs. Lourdes Villanueva",
    role: "Elementary librarian",
    initials: "LV",
    tone: "from-gold to-brand-500",
  },
  {
    quote:
      "We work the Friday reading hour as a pair: she pulls the home reading titles our group has not opened yet, I set the reservation queue, and the pupils scan their own cards at the counter. The whole class is checked out in ten minutes.",
    name: "Ms. Rosalie Perez, with the Elementary librarian",
    role: "Grade 6 adviser — teacher and librarian pairing",
    initials: "RP",
    tone: "from-brand-400 to-brand-700",
  },
];

export function Testimonials() {
  return (
    <section id="voices" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <SectionIntro
        eyebrow="From the desk and the stacks"
        title="What the people who run it say"
        intro="Sample quotes written with the wording librarians and borrowers used during the pilot walkthrough of the catalogue and circulation screens."
      />

      <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:gap-5">
        {VOICES.map((voice, index) => (
          <Reveal key={voice.name} delay={index * 0.08}>
            <figure className="surface-card hover-lift flex h-full flex-col p-5 sm:p-6">
              <Quote className="h-6 w-6 text-gold" aria-hidden />
              <blockquote className="mt-3 flex-1 text-[15px] leading-7 text-ink">
                {voice.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-brand-100 pt-4">
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-serif text-[15px] text-cream ring-2 ring-white/70",
                    voice.tone,
                  )}
                >
                  {voice.initials}
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-ink">{voice.name}</span>
                  <span className="block text-[12.5px] leading-5 text-ink-soft">{voice.role}</span>
                </span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
