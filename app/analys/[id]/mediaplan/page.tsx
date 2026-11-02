"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import Result from "@/components/mediaplan/Result";
import Setup from "@/components/mediaplan/Setup";
import { inProgress, logEvent } from "@/components/mediaplan/shared";
import { DEFAULT_TARGET, guessTarget } from "@/lib/media/guess";
import type { MediaPlanInput } from "@/lib/media/input";
import type { MediaPlanRecord } from "@/lib/media/view";
import type { AnalysisRecord } from "@/lib/types";

export default function MediaplanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [record, setRecord] = useState<AnalysisRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const viewedLogged = useRef(false);

  // Hämtar analysen och fortsätter fråga så länge mediaplanen räknas fram
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const res = await fetch(`/api/analyses/${id}`);
      if (!active) return;
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: AnalysisRecord = await res.json();
      setRecord(data);
      if (inProgress(data.mediaPlan)) timer = setTimeout(poll, 2000);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, pollKey]);

  const mp: MediaPlanRecord | null = record?.mediaPlan ?? null;

  useEffect(() => {
    if (mp?.status === "done" && !viewedLogged.current) {
      viewedLogged.current = true;
      logEvent("mediaplan_viewed", id);
    }
  }, [mp?.status, id]);

  async function submit(input: MediaPlanInput) {
    setError(null);
    const res = await fetch(`/api/analyses/${id}/mediaplan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Något gick fel");
      return;
    }
    viewedLogged.current = false;
    setRecord((r) => (r ? { ...r, mediaPlan: data.mediaPlan } : r));
    setEditing(false);
    setPollKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  }

  const back = (
    <Link
      href={`/analys/${id}`}
      className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]"
    >
      <ArrowLeft className="h-4 w-4" /> Tillbaka till hälsokollet
    </Link>
  );

  if (notFound) {
    return (
      <p className="text-center text-[var(--color-muted-foreground)]">
        Analysen hittades inte.{" "}
        <Link href="/" className="text-[var(--color-accent)] underline">
          Starta en ny
        </Link>
      </p>
    );
  }
  if (!record) {
    return <p className="text-center text-[var(--color-muted-foreground)]">Laddar…</p>;
  }
  if (record.status !== "done") {
    return (
      <div className="mx-auto max-w-md text-center">
        {back}
        <p className="text-[var(--color-secondary)]">
          Hälsokollet är inte klart än. Mediaplanen bygger på det, så vänta tills det är färdigt.
        </p>
      </div>
    );
  }

  const guess = guessTarget(record.brief);
  const initial: MediaPlanInput = mp?.input ?? {
    budgetSek: 100_000,
    weeks: 8,
    ageMin: guess.ageMin,
    ageMax: guess.ageMax,
    genders: guess.genders,
    businessModel: "b2c",
  };

  // Mediaplaner från den första versionen saknar kurvan och prickarna
  const outdated = mp?.view && (!mp.view.curve || !mp.view.people);

  return (
    <div className="-mx-2 sm:mx-0 lg:-mx-16">
      {back}
      {editing || !mp || outdated ? (
        <>
          {outdated && !editing && (
            <p className="mb-6 rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-secondary)]">
              Den här mediaplanen gjordes med en äldre version. Räkna om den för att se det nya
              upplägget.
            </p>
          )}
          <Setup
            analysisId={id}
            initial={initial}
            guess={mp ? null : guess.fromBrief ? guess : DEFAULT_TARGET}
            onSubmit={submit}
            onCancel={mp && !outdated ? () => setEditing(false) : undefined}
            error={error}
          />
        </>
      ) : mp.status === "running" || !mp.view ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <LoaderCircle className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
          <p className="text-lg text-[var(--color-primary)]">Simulerar planerna mot 2 000 personer…</p>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Tre planer för {mp.input.budgetSek.toLocaleString("sv-SE")} kr och flera budgetnivåer.
          </p>
        </div>
      ) : (
        <Result
          key={mp.startedAt}
          analysisId={id}
          mp={mp}
          onEdit={() => setEditing(true)}
          onRecompute={(budgetSek) => submit({ ...mp.input, budgetSek })}
        />
      )}
    </div>
  );
}
