"use client";

import { use, useEffect, useRef, useState } from "react";
import type { AnalysisRecord } from "@/lib/types";
import Bollplanket from "@/components/Bollplanket";
import MediaplanTeaser from "@/components/mediaplan/Teaser";
import {
  TrendingUp,
  Target,
  Radar,
  Map as MapIcon,
  Lock,
  Check,
  CircleCheck,
} from "lucide-react";

function logEvent(
  name: string,
  analysisId: string | null = null,
  detail?: string
) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, analysisId, detail }),
  }).catch(() => {});
}

const PROGRESS_STEPS: { key: string; label: string }[] = [
  { key: "pending", label: "Startar analysen" },
  { key: "crawling", label: "Läser in din webbplats" },
  { key: "analyzing", label: "Analyserar och letar upp konkurrenter" },
  { key: "done", label: "Sammanställer ditt Marknadshälsokoll" },
];

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const viewLogged = useRef(false);

  useEffect(() => {
    let active = true;
    async function poll() {
      const res = await fetch(`/api/analyses/${id}`);
      if (!active) return;
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: AnalysisRecord = await res.json();
      setRecord(data);
      if (data.status !== "done" && data.status !== "error") {
        setTimeout(poll, 2000);
      }
    }
    poll();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (record?.status === "done" && !viewLogged.current) {
      viewLogged.current = true;
      logEvent("healthcheck_viewed", record.id);
    }
  }, [record]);

  if (notFound) {
    return (
      <p className="text-center text-[var(--color-muted-foreground)]">
        Analysen hittades inte.{" "}
        <a href="/" className="text-[var(--color-accent)] underline">
          Starta en ny
        </a>
      </p>
    );
  }
  if (!record) {
    return (
      <p className="text-center text-[var(--color-muted-foreground)]">Laddar…</p>
    );
  }
  if (record.status === "error") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold text-red-800">
          Analysen gick inte att slutföra
        </h1>
        <p className="mb-4 text-sm text-red-700">{record.error}</p>
        <a href="/" className="text-sm text-[var(--color-accent)] underline">
          Prova igen med en annan webbplats
        </a>
      </div>
    );
  }
  if (record.status !== "done" || !record.healthCheck) {
    return <ProgressView record={record} />;
  }
  return <ReportView record={record} />;
}

function ProgressView({ record }: { record: AnalysisRecord }) {
  const currentIdx = PROGRESS_STEPS.findIndex((s) => s.key === record.status);
  return (
    <div className="animate-rise mx-auto max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl text-[var(--color-primary)]">
        Analyserar {record.brief.companyName}
      </h1>
      <p className="mb-6 text-sm text-[var(--color-muted-foreground)]">
        Detta tar normalt ett par minuter. Din marknadschef jobbar…
      </p>
      <ol className="space-y-3">
        {PROGRESS_STEPS.map((step, i) => {
          const state =
            i < currentIdx ? "done" : i === currentIdx ? "active" : "waiting";
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  state === "done"
                    ? "bg-emerald-100 text-emerald-700"
                    : state === "active"
                      ? "animate-pulse bg-[var(--color-accent)] text-[var(--color-on-primary)]"
                      : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                }`}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={
                  state === "waiting"
                    ? "text-[var(--color-muted-foreground)]"
                    : "text-[var(--color-primary)]"
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionHeading({
  Icon,
  color,
  children,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xl text-[var(--color-primary)]">
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      {children}
    </h2>
  );
}

function ReportView({ record }: { record: AnalysisRecord }) {
  const hc = record.healthCheck!;
  return (
    <div className="animate-rise space-y-9">
      <div>
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-accent)]">
          Marknadshälsokoll · Gratis
        </p>
        <h1 className="mb-3 text-3xl text-[var(--color-primary)]">
          {record.brief.companyName}
        </h1>
        <p className="max-w-2xl text-[var(--color-secondary)]">{hc.summary}</p>
      </div>

      <section>
        <SectionHeading
          Icon={TrendingUp}
          color="bg-emerald-50 text-emerald-700"
        >
          Styrkor
        </SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          {hc.strengths.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"
            >
              <div className="font-semibold text-[var(--color-primary)]">
                {s.title}
              </div>
              <p className="mt-1 text-sm text-[var(--color-secondary)]">
                {s.detail}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                Baserat på: {s.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading Icon={Target} color="bg-amber-50 text-amber-700">
          Gap att åtgärda
        </SectionHeading>
        <div className="space-y-3">
          {hc.gaps.map((g, i) => (
            <div
              key={i}
              className="rounded-xl border border-amber-200 bg-amber-50/40 p-4"
            >
              <div className="font-semibold text-[var(--color-primary)]">
                {g.title}
              </div>
              <p className="mt-1 text-sm text-[var(--color-secondary)]">
                {g.detail}
              </p>
              <p className="mt-2 text-sm text-[var(--color-secondary)]">
                <span className="font-medium text-[var(--color-primary)]">
                  Varför det spelar roll:
                </span>{" "}
                {g.why}
              </p>
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                Baserat på: {g.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading Icon={Radar} color="bg-[var(--color-muted)] text-[var(--color-accent)]">
          Konkurrentöversikt
        </SectionHeading>
        <p className="-mt-1 mb-3 text-sm text-[var(--color-muted-foreground)]">
          Topp 3, översiktligt. Djupanalys av 5–10 konkurrenter ingår i Pro.
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          {hc.competitors.map((c, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--color-border)] bg-white p-4"
            >
              <div className="font-semibold text-[var(--color-primary)]">
                {c.name}
              </div>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--color-accent)] underline"
              >
                {c.url}
              </a>
              <p className="mt-2 text-sm text-[var(--color-secondary)]">
                {c.overview}
              </p>
              <p className="mt-2 text-sm text-[var(--color-secondary)]">
                <span className="font-medium text-[var(--color-primary)]">
                  Deras försprång:
                </span>{" "}
                {c.theirEdge}
              </p>
              <p className="mt-1 text-sm text-emerald-700">
                <span className="font-medium">Din lucka:</span> {c.yourOpening}
              </p>
            </div>
          ))}
        </div>
      </section>

      <MediaplanTeaser record={record} />

      <Bollplanket record={record} />

      <LockedPlan record={record} />
    </div>
  );
}

function LockedPlan({ record }: { record: AnalysisRecord }) {
  const [chosenOffer, setChosenOffer] = useState<string | null>(null);
  const [addBump, setAddBump] = useState(false);
  const hc = record.healthCheck!;

  function choose(detail: string) {
    logEvent("unlock_clicked", record.id, detail);
    setChosenOffer(detail);
  }

  const reportPrice = addBump ? 349 : 249;
  const reportDetail = addBump ? "report_bump_349" : "report_249";

  return (
    <section className="relative">
      <SectionHeading Icon={MapIcon} color="bg-[var(--color-muted)] text-[var(--color-primary)]">
        Din action plan – 30/60/90 dagar
      </SectionHeading>
      <p className="-mt-1 mb-4 text-sm text-[var(--color-muted-foreground)]">
        Rubrikerna är gratis. Hela planen – med konkreta steg och motiveringar –
        låser du upp nedan.
      </p>

      <div className="space-y-4">
        {hc.plan.map((phase) => (
          <div
            key={phase.period}
            className="rounded-xl border border-[var(--color-border)] bg-white p-5"
          >
            <h3 className="mb-3 text-lg text-[var(--color-primary)]">
              Första {phase.period} dagarna
            </h3>
            <ul className="space-y-3">
              {phase.items.map((item, i) => (
                <li key={i}>
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]">
                    <span className="text-[var(--color-muted-foreground)]">
                      {i + 1}.
                    </span>
                    {item.heading}
                    <Lock className="h-3 w-3 text-[var(--color-muted-foreground)]" />
                  </div>
                  <p className="mt-1 select-none text-sm text-[var(--color-muted-foreground)] blur-sm">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {chosenOffer ? (
        <div className="mt-6 rounded-2xl border-2 border-[var(--color-accent)] bg-white p-8 text-center shadow-md">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-accent)]">
            <CircleCheck className="h-6 w-6" />
          </span>
          <h3 className="mb-2 text-xl text-[var(--color-primary)]">
            Tack för intresset!
          </h3>
          <p className="mx-auto max-w-md text-sm text-[var(--color-secondary)]">
            Marknadspiloten är i prototypfas och betalning är inte igång än. Vi
            hör av oss så snart du kan låsa upp – ditt intresse är noterat och
            hjälper oss prioritera vad vi bygger härnäst.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Attraction offer – engångsköp */}
            <div className="relative rounded-2xl border-2 border-[var(--color-accent)] bg-white p-6 shadow-md">
              <span className="absolute -top-3 left-6 rounded-full bg-[var(--color-accent)] px-3 py-0.5 text-xs font-semibold text-[var(--color-on-primary)]">
                Kom igång direkt
              </span>
              <h3 className="mb-1 text-lg text-[var(--color-primary)]">
                Fullständig rapport
              </h3>
              <p className="mb-3 text-3xl font-bold text-[var(--color-primary)]">
                {reportPrice} kr{" "}
                <span className="text-sm font-normal text-[var(--color-muted-foreground)]">
                  engångs
                </span>
              </p>
              <ul className="mb-4 space-y-1.5 text-sm text-[var(--color-secondary)]">
                {[
                  "Hela 30/60/90-planen med motiveringar",
                  "Exportera som PDF att dela internt",
                  "Ingen prenumeration, inget att säga upp",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={addBump}
                  onChange={(e) => setAddBump(e.target.checked)}
                  className="mt-0.5 accent-[var(--color-accent)]"
                />
                <span className="text-[var(--color-secondary)]">
                  <span className="font-medium text-[var(--color-primary)]">
                    +100 kr:
                  </span>{" "}
                  djupanalys av 5–10 konkurrenter i stället för topp 3
                </span>
              </label>
              <button
                onClick={() => choose(reportDetail)}
                className="w-full rounded-lg bg-[var(--color-accent)] py-3 font-medium text-[var(--color-on-primary)] transition hover:bg-[var(--color-accent-hover)]"
              >
                Lås upp för {reportPrice} kr
              </button>
              <p className="mt-2 text-center text-xs text-[var(--color-muted-foreground)]">
                Känns det inte träffsäkert? Pengarna tillbaka inom 7 dagar.
              </p>
            </div>

            {/* Upsell – prenumeration */}
            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Hellre löpande?
              </p>
              <h3 className="mb-1 text-lg text-[var(--color-primary)]">Pro</h3>
              <p className="mb-3 text-3xl font-bold text-[var(--color-primary)]">
                399 kr{" "}
                <span className="text-sm font-normal text-[var(--color-muted-foreground)]">
                  /mån
                </span>
              </p>
              <ul className="mb-4 space-y-1.5 text-sm text-[var(--color-secondary)]">
                {[
                  "Allt i rapporten – varje månad",
                  "Obegränsat Bollplank med din AI-CMO",
                  "Djupanalys av 5–10 konkurrenter",
                  "Månatlig omanalys och trendbevakning",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choose("pro_399")}
                className="w-full rounded-lg border border-[var(--color-accent)] py-3 font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-muted)]"
              >
                Starta Pro
              </button>
              <p className="mt-2 text-center text-xs text-[var(--color-muted-foreground)]">
                Avsluta när du vill. Ingen bindningstid.
              </p>
            </div>
          </div>

          {/* Downsell */}
          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/50 p-4 text-sm sm:flex-row">
            <span className="text-[var(--color-secondary)]">
              Inte redo att låsa upp allt? Bolla vidare med din AI-CMO i 24
              timmar för{" "}
              <span className="font-medium text-[var(--color-primary)]">
                99 kr
              </span>
              .
            </span>
            <button
              onClick={() => choose("downsell_99")}
              className="shrink-0 rounded-lg bg-white px-4 py-2 font-medium text-[var(--color-accent)] ring-1 ring-inset ring-[var(--color-border)] transition hover:bg-[var(--color-muted)]"
            >
              Bolla en gång – 99 kr
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
