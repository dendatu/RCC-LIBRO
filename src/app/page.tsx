import type { Metadata } from "next";
import { SiteFooter } from "@/components/marketing/footer";
import { SiteHeader } from "@/components/marketing/header";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SectionsGuide } from "@/components/marketing/sections-guide";
import { StatsBand } from "@/components/marketing/stats-band";
import { BranchCards } from "@/components/marketing/branch-cards";
import { Testimonials } from "@/components/marketing/testimonials";
import { CtaBand } from "@/components/marketing/cta-band";

export const metadata: Metadata = {
  title: "RCC LIBRO — Library Inventory and Book Recording Organizer",
  description:
    "One searchable catalogue for the Elementary, High School and College & Graduate School libraries of Republic Central Colleges, Angeles City Campus: OPAC search, digital SBTR, QR loans, automatic fines and due-date reminders.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main id="main" className="flex-1">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <SectionsGuide />
        <StatsBand />
        <BranchCards />
        <Testimonials />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}
