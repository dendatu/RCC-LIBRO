import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { APP_NAME, APP_TAGLINE, INSTITUTION, PUBLIC_NAV } from "@/lib/constants";

const ACCOUNT_LINKS = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Get a library card" },
  { href: "/policies#fines", label: "Fines and penalties" },
  { href: "/about#roles", label: "Who uses LIBRO" },
];

const HELP_LINKS = [
  { href: "/catalog", label: "Public catalogue (OPAC)" },
  { href: "/policies", label: "Borrowing policy" },
  { href: "/about", label: "About the library" },
];

/** Shared public footer for the landing page and the (public) route group. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-brand-100 bg-ink text-cream/80">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <p className="font-serif text-2xl text-cream">{APP_NAME}</p>
            <p className="mt-1 text-[13px] text-cream/60">{APP_TAGLINE}</p>
            <p className="mt-4 max-w-xs text-[13px] leading-6 text-cream/70">
              One catalogue and one loan record for the Elementary, High School and College &amp;
              Graduate School libraries of {INSTITUTION}.
            </p>
          </div>

          <nav aria-labelledby="footer-explore">
            <h2 id="footer-explore" className="text-[13px] font-semibold uppercase tracking-[0.18em] text-gold">
              Explore
            </h2>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-cream/75 transition-colors hover:text-gold">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className="text-[13px] font-semibold uppercase tracking-[0.18em] text-gold">
              Services
            </h2>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {HELP_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-cream/75 transition-colors hover:text-gold">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-gold">
              Library desk
            </h2>
            <ul className="mt-4 space-y-3 text-[14px] leading-6">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold/80" aria-hidden />
                <span>
                  {INSTITUTION}
                  <br />
                  Republic–Sto. Deus Crossing, Angeles City, Pampanga
                </span>
              </li>
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold/80" aria-hidden />
                <a href="mailto:library@rcc.edu.ph" className="transition-colors hover:text-gold">
                  library@rcc.edu.ph
                </a>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold/80" aria-hidden />
                <a href="tel:+63458033000" className="transition-colors hover:text-gold">
                  (045) 803 3000
                </a>
              </li>
            </ul>
            <p className="mt-4 text-[12px] leading-5 text-cream/55">
              Open Monday to Friday, 7:30 a.m. – 5:00 p.m. Reserve titles are released for take-home
              from 4:00 p.m.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-cream/10 pt-6 text-[13px] text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {INSTITUTION.replace(" — Angeles City Campus", "")}. All rights reserved.
          </p>
          <p>RCC LIBRO is the official library inventory and book recording system of the college.</p>
        </div>

        <nav aria-label="Account links" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {ACCOUNT_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="text-cream/60 transition-colors hover:text-gold">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
