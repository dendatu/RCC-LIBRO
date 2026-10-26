import { SiteFooter } from "@/components/marketing/footer";
import { SiteHeader } from "@/components/marketing/header";

/** Shared shell for the public marketing and reference pages. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
