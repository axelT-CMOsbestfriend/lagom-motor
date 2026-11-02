import type { Metadata } from "next";
import { Cormorant_Garamond, Karla } from "next/font/google";
import { Compass } from "lucide-react";
import "./globals.css";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Marknadspiloten – Din AI-marknadschef",
  description:
    "Brief in. Gap-analys, konkurrentkoll och en konkret plan ut – gratis att börja, enkelt att förstå.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`${karla.variable} ${cormorant.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2.5">
              <Compass
                className="h-5 w-5 text-[var(--color-primary)]"
                strokeWidth={1.75}
              />
              <span
                className="text-2xl leading-none text-[var(--color-primary)]"
                style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}
              >
                Marknadspiloten
              </span>
            </a>
            <span className="rounded-full border border-[var(--color-border)] bg-white/60 px-2.5 py-1 text-xs font-medium text-[var(--color-secondary)]">
              Prototyp
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
          {children}
        </main>
        <footer className="border-t border-[var(--color-border)] py-6 text-center text-sm text-[var(--color-muted-foreground)]">
          Marknadsföring för alla – inte bara de som har råd med en byrå.
        </footer>
      </body>
    </html>
  );
}
