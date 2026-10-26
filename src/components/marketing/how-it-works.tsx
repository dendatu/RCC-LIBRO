import { ClipboardCheck, KeyRound, ScanQrCode, UserCheck } from "lucide-react";
import { Reveal, SectionIntro } from "./reveal";

const STEPS = [
  {
    icon: KeyRound,
    title: "Sign in with Google or e-mail",
    body: "Use your RCC account so the library can match you to your class and adviser, or an e-mail address you control. One click, no password to remember.",
  },
  {
    icon: UserCheck,
    title: "Complete your profile and SBTR",
    body: "Confirm your name, grade level or programme and section, then add a contact number. The system opens your Student Book Tracer Record and prints your library card.",
  },
  {
    icon: ScanQrCode,
    title: "Scan a QR or search the catalogue",
    body: "Search the OPAC for a title, or scan the QR sticker on the spine at the desk to see the copy, its branch, shelf location and availability.",
  },
  {
    icon: ClipboardCheck,
    title: "Borrow, get reminded, return on time",
    body: "Three titles for seven days. Notices arrive seven, three and one day before the due date, and your record clears the moment the librarian checks the item in.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-brand-100 bg-parchment">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <SectionIntro
          eyebrow="How it works"
          title="Four steps from a rainy afternoon to a book in your bag"
          intro="The borrower journey is deliberately short. Everything the desk needs — standing, SBTR, shelf location — is already on the screen."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <article className="surface-card hover-lift relative flex h-full flex-col p-5 sm:p-6">
                <span
                  className="font-serif text-4xl leading-none text-brand-200"
                  aria-hidden
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-cream">
                  <step.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <h3 className="mt-4 text-[16px] leading-snug text-ink">
                  <span className="sr-only">{`Step ${index + 1}: `}</span>
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-6 text-ink-soft">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <div className="surface-card mt-6 flex flex-col gap-4 bg-white/70 p-5 sm:flex-row sm:items-start sm:p-6">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-brand-800">
              <ClipboardCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-[16px] text-ink">On the staff side</h3>
              <p className="mt-2 text-[14px] leading-7 text-ink-soft">
                Librarians issue and check in loans by scanning the copy, run shelf checks against
                the accession list, mark a copy Lost or Damaged, and answer the reservation queue
                from one screen. Administrators approve penalty waivers, publish the borrowing
                policy, add branches and staff accounts, and export the termly holdings report that
                goes to the college. Every action is stamped with the user, role and time, so the
                record stays defensible during an inventory count.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
