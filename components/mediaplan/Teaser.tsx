"use client";

import Link from "next/link";
import { ArrowRight, Megaphone } from "lucide-react";
import { kr, listSv, of100 } from "@/lib/media/format";
import type { AnalysisRecord } from "@/lib/types";

// Kort på rapportsidan som leder vidare till mediaplanen
export default function MediaplanTeaser({ record }: { record: AnalysisRecord }) {
  const mp = record.mediaPlan;
  const recommended =
    mp?.view?.plans.find((p) => p.id === (mp.explanation?.recommendedPlanId ?? "rackvidd")) ?? null;
  const href = `/analys/${record.id}/mediaplan`;

  return (
    <section className="grid items-center gap-5 rounded-2xl bg-[var(--color-primary)] p-6 text-[var(--color-on-primary)] sm:grid-cols-[auto_1fr_auto] sm:p-7">
      <span className="hidden h-12 w-12 place-items-center rounded-full bg-[var(--color-highlight)] text-[var(--color-primary)] sm:grid">
        <Megaphone className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.09em] opacity-70">Nästa steg</p>
        {recommended ? (
          <>
            <h2 className="text-2xl sm:text-3xl">
              Lägg pengarna på{" "}
              {listSv(
                [...recommended.channels]
                  .sort((a, b) => b.budgetSek - a.budgetSek)
                  .slice(0, 2)
                  .map((c) => c.label)
              )}
            </h2>
            <p className="mt-1 opacity-80">
              Din mediaplan för {kr(recommended.totalBudgetSek)} når {of100(recommended.reach.mid)} av
              100 i målgruppen.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl sm:text-3xl">Var ska pengarna läggas?</h2>
            <p className="mt-1 opacity-80">
              Få tre mediaplaner för din budget, simulerade mot 2 000 personer med svenskarnas
              medievanor.
            </p>
          </>
        )}
      </div>
      <Link
        href={href}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-highlight)] px-4 py-2.5 font-semibold text-[var(--color-primary)] transition hover:opacity-90"
      >
        {mp ? "Öppna mediaplanen" : "Ta fram din mediaplan"} <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
