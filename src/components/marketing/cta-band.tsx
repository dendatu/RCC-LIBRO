import { ArrowRight, Search } from "lucide-react";
import { MarketingButton } from "./button";
import { Reveal } from "./reveal";

export function CtaBand() {
  return (
    <section aria-labelledby="cta-heading" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
      <Reveal>
        <div className="paper-texture relative overflow-hidden rounded-[1.75rem] border border-brand-100 px-5 py-10 text-center sm:px-10 sm:py-14">
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
            aria-hidden
          />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">
            Ready when you are
          </p>
          <h2
            id="cta-heading"
            className="mx-auto mt-3 max-w-2xl font-serif text-3xl leading-tight text-ink text-balance sm:text-4xl"
          >
            Get a card, then let the catalogue do the shelving
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-ink-soft">
            Register with your RCC e-mail address to open a Student Book Tracer Record, or look
            through the holdings first — the public search needs no account at all.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MarketingButton href="/register" size="lg" className="w-full sm:w-auto">
              Get a library card
              <ArrowRight className="h-4 w-4" aria-hidden />
            </MarketingButton>
            <MarketingButton href="/catalog" variant="outline" size="lg" className="w-full sm:w-auto">
              <Search className="h-4 w-4 text-brand-500" aria-hidden />
              Browse the OPAC
            </MarketingButton>
          </div>

          <p className="mt-6 text-[12.5px] text-ink-soft">
            Questions about a fine, a lost title or a reservation? Write to the desk at{" "}
            <a
              href="mailto:library@rcc.edu.ph"
              className="font-medium text-brand-700 underline decoration-brand-200 underline-offset-4 hover:decoration-brand-500"
            >
              library@rcc.edu.ph
            </a>
            .
          </p>
        </div>
      </Reveal>
    </section>
  );
}
