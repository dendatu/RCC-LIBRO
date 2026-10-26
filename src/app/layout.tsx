import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { APP_NAME, APP_TAGLINE, INSTITUTION } from "@/lib/constants";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME} is the library inventory, catalogue and borrowing system of ${INSTITUTION}. Search three branch collections, borrow with a digital SBTR, and track due dates and fines automatically.`,
  applicationName: APP_NAME,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description:
      "RCC LIBRO digitalises the Republic Central Colleges library: OPAC search, QR-coded circulation, digital SBTR, automatic fines and due-date reminders.",
    type: "website",
    siteName: APP_NAME,
  },
  twitter: { card: "summary_large_image", title: APP_NAME, description: APP_TAGLINE },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#6F4E37",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
