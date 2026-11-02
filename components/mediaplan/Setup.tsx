"use client";

import { useRef, useState } from "react";
import { Briefcase, CalendarDays, Users, Wallet } from "lucide-react";
import { kr } from "@/lib/media/format";
import type { MediaPlanInput } from "@/lib/media/input";
import type { TargetGuess } from "@/lib/media/guess";
import {
  Row,
  card,
  chipButton,
  eyebrow,
  logEvent,
  primaryButton,
} from "./shared";

const BUDGET_STEPS = [
  10_000, 15_000, 20_000, 30_000, 40_000, 50_000, 75_000, 100_000, 150_000, 200_000,
  300_000, 400_000, 500_000, 750_000, 1_000_000,
];
const WEEKS = [2, 4, 6, 8, 12, 26];

function nearestStep(budget: number): number {
  let best = 0;
  BUDGET_STEPS.forEach((b, i) => {
    if (Math.abs(b - budget) < Math.abs(BUDGET_STEPS[best] - budget)) best = i;
  });
  return best;
}

export function gendersText(genders: MediaPlanInput["genders"]): string {
  if (genders.length === 2) return "kvinnor och män";
  return genders[0] === "kvinna" ? "kvinnor" : "män";
}

const seg = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
    active
      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
      : "text-[var(--color-secondary)] hover:bg-[var(--color-muted)]"
  }`;

export default function Setup({
  analysisId,
  initial,
  guess,
  onSubmit,
  onCancel,
  error,
}: {
  analysisId: string;
  initial: MediaPlanInput;
  guess: TargetGuess | null;
  onSubmit: (input: MediaPlanInput) => Promise<void>;
  onCancel?: () => void;
  error: string | null;
}) {
  const [v, setV] = useState(initial);
  const [budgetIdx, setBudgetIdx] = useState(nearestStep(initial.budgetSek));
  const [editTarget, setEditTarget] = useState(false);
  const [confirmed, setConfirmed] = useState(guess === null);
  const [sending, setSending] = useState(false);
  const opened = useRef(false);

  function touched() {
    if (!opened.current) {
      opened.current = true;
      logEvent("mediaplan_form_opened", analysisId);
    }
  }

  const budgetSek = BUDGET_STEPS[budgetIdx];
  const gendersValue = v.genders.length === 2 ? "alla" : v.genders[0];

  return (
    <div className="animate-rise grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className={eyebrow}>Mediaplan</p>
        <h1 className="text-4xl leading-[1.05] text-[var(--color-primary)] sm:text-5xl">
          Var ska pengarna läggas?
        </h1>
        <p className="mt-4 max-w-md text-lg text-[var(--color-secondary)]">
          Bekräfta förutsättningarna så räknar vi fram tre planer för din budget. Varje plan
          testas mot 2 000 syntetiska personer med svenskarnas medievanor.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-[var(--color-secondary)]">
          <li>Medievanorna kommer från Mediebarometern 2024 och SCB.</li>
          <li>Din AI-marknadschef väljer en plan och förklarar varför, med källor.</li>
          <li>Tar ungefär en halv minut.</li>
        </ul>
      </div>

      <form
        onFocus={touched}
        onPointerDown={touched}
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          await onSubmit({ ...v, budgetSek });
          setSending(false);
        }}
        className={card}
      >
        <p className={eyebrow}>Förutsättningar</p>
        <ul>
          <Row
            icon={<Users className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            label="Målgrupp"
            value={`${v.ageMin}–${v.ageMax} år, ${gendersText(v.genders)}`}
            action={
              <button type="button" className={chipButton} onClick={() => setEditTarget((x) => !x)}>
                {editTarget ? "Klar" : "Ändra"}
              </button>
            }
          >
            {!confirmed && !editTarget && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-muted)] px-3 py-2 text-[13px]">
                <span className="flex-1 text-[var(--color-secondary)]">
                  {guess?.fromBrief
                    ? "Gissat utifrån din brief. Stämmer det?"
                    : "Vi utgår från en bred målgrupp. Stämmer det?"}
                </span>
                <button type="button" className={chipButton} onClick={() => setConfirmed(true)}>
                  Ja
                </button>
              </div>
            )}
            {editTarget && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">Från ålder</span>
                  <input
                    id="mp-age-min"
                    type="number"
                    min={15}
                    max={84}
                    value={v.ageMin}
                    onChange={(e) => setV({ ...v, ageMin: Number(e.target.value) })}
                    className="w-16 rounded-md border border-[var(--color-border)] px-2 py-1.5 tabular-nums"
                  />
                </label>
                <span className="text-[var(--color-muted-foreground)]">–</span>
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">Till ålder</span>
                  <input
                    id="mp-age-max"
                    type="number"
                    min={15}
                    max={84}
                    value={v.ageMax}
                    onChange={(e) => setV({ ...v, ageMax: Number(e.target.value) })}
                    className="w-16 rounded-md border border-[var(--color-border)] px-2 py-1.5 tabular-nums"
                  />
                </label>
                <span className="text-sm text-[var(--color-muted-foreground)]">år</span>
                <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5">
                  {(
                    [
                      ["alla", "Alla"],
                      ["kvinna", "Kvinnor"],
                      ["man", "Män"],
                    ] as const
                  ).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      className={seg(gendersValue === value)}
                      onClick={() =>
                        setV({ ...v, genders: value === "alla" ? ["kvinna", "man"] : [value] })
                      }
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Row>
          <Row
            icon={<Briefcase className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            label="Ni säljer främst till"
            value={v.businessModel === "b2c" ? "Konsumenter" : "Företag"}
            action={
              <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-white p-0.5">
                {(
                  [
                    ["b2c", "Konsumenter"],
                    ["b2b", "Företag"],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    className={seg(v.businessModel === value)}
                    onClick={() => setV({ ...v, businessModel: value })}
                  >
                    {text}
                  </button>
                ))}
              </div>
            }
          />
          <Row
            icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            label="Period"
            value={`${v.weeks} veckor`}
            action={
              <select
                aria-label="Period"
                value={v.weeks}
                onChange={(e) => setV({ ...v, weeks: Number(e.target.value) })}
                className="rounded-full bg-[var(--color-muted)] px-3 py-1 text-[13px] font-bold text-[var(--color-primary)]"
              >
                {WEEKS.map((w) => (
                  <option key={w} value={w}>
                    {w} veckor
                  </option>
                ))}
              </select>
            }
          />
          <Row
            icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />}
            label="Budget för annonsering"
            value={kr(budgetSek)}
          >
            <input
              id="mp-budget"
              aria-label="Budget"
              type="range"
              min={0}
              max={BUDGET_STEPS.length - 1}
              value={budgetIdx}
              onChange={(e) => setBudgetIdx(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-muted-foreground)] tabular-nums">
              <span>{kr(BUDGET_STEPS[0])}</span>
              <span>{kr(BUDGET_STEPS[BUDGET_STEPS.length - 1])}</span>
            </div>
          </Row>
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={sending} className={primaryButton}>
            {sending ? "Startar…" : "Ta fram min mediaplan"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-[var(--color-muted-foreground)] underline"
            >
              Avbryt
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-[var(--color-destructive)]">{error}</p>}
      </form>
    </div>
  );
}
