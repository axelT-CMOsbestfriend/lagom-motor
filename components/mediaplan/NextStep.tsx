"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { logEvent } from "./shared";

export function useCopyLink(analysisId: string) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    logEvent("mediaplan_link_copied", analysisId);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Kopiera länken:", window.location.href);
    }
  }
  return { copied, copy };
}

// Sista steget: köra själv eller ta hjälp. Bokningen är ett test av
// värdetrappan, precis som lås upp-knapparna i hälsokollet.
export default function NextStep({ analysisId }: { analysisId: string }) {
  const [booked, setBooked] = useState(false);
  const { copied, copy } = useCopyLink(analysisId);

  return (
    <section
      id="nasta-steg"
      className="grid scroll-mt-24 items-center gap-5 rounded-3xl bg-[var(--color-primary)] p-7 text-[var(--color-on-primary)] md:grid-cols-[1fr_auto]"
    >
      {booked ? (
        <div className="flex items-start gap-3 md:col-span-2">
          <CircleCheck className="mt-1 h-6 w-6 flex-none text-[var(--color-highlight)]" />
          <div>
            <h2 className="text-3xl">Tack för intresset!</h2>
            <p className="mt-1 max-w-xl opacity-80">
              Marknadspiloten är i prototypfas och bokningen är inte igång än. Ditt intresse är
              noterat, och vi hör av oss så snart du kan boka en genomgång.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-3xl">Redo att köra?</h2>
            <p className="mt-1 max-w-xl opacity-80">
              Spara länken och kör planen själv, eller boka 30 minuter så går vi igenom den
              tillsammans och sätter upp kampanjerna.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 md:justify-end">
            <button
              type="button"
              onClick={() => {
                logEvent("mediaplan_booking_clicked", analysisId);
                setBooked(true);
              }}
              className="rounded-lg bg-[var(--color-highlight)] px-4 py-2.5 font-semibold text-[var(--color-primary)] transition hover:opacity-90"
            >
              Boka genomgång
            </button>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-[var(--color-on-primary)] px-4 py-2.5 font-semibold transition hover:bg-white/10"
            >
              {copied ? "Länken är kopierad" : "Kopiera länken"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
