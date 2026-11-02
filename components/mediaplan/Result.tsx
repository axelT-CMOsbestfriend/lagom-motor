"use client";

import { useRef, useState } from "react";
import { Briefcase, CalendarDays, ChevronDown, LoaderCircle, Users, Wallet } from "lucide-react";
import { computedReasons, followUps } from "@/lib/media/answers";
import { CHANNELS } from "@/lib/media/channels";
import { kr, listSv, of100, ore, people, times } from "@/lib/media/format";
import type { PlanId } from "@/lib/media/planner";
import { formatSource, getRule } from "@/lib/media/rules";
import type { MediaPlanRecord, MediaPlanView, PlanView } from "@/lib/media/view";
import BudgetCurve from "./BudgetCurve";
import DotPanel from "./DotPanel";
import FollowUps from "./FollowUps";
import NextStep, { useCopyLink } from "./NextStep";
import { gendersText } from "./Setup";
import {
  PLAN_BLURB,
  Row,
  SEGMENT_COLORS,
  card,
  chipButton,
  eyebrow,
  logEvent,
  primaryButton,
  secondaryButton,
} from "./shared";

function Working({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm text-[var(--color-secondary)]">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

function Sources({ ruleIds }: { ruleIds: string[] }) {
  const rules = ruleIds.map(getRule).filter((r) => r !== undefined);
  if (rules.length === 0) return null;
  return (
    <details className="group mt-1 text-sm">
      <summary className="cursor-pointer list-none text-[13px] font-semibold text-[var(--color-muted-foreground)] [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">+ Källor</span>
        <span className="hidden group-open:inline">– Källor</span>
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[var(--color-secondary)]">
        {rules.map((r) => (
          <li key={r.id}>
            <b className="block text-[var(--color-primary)]">
              {r.kind === "heuristik" ? "Tumregel (ska valideras)" : formatSource(r.source)}
            </b>
            {r.claim}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Tiles({ plan }: { plan: PlanView }) {
  const tiles = [
    ["Når", `${of100(plan.reach.mid)} av 100`, `${of100(plan.reach.low)}–${of100(plan.reach.high)} beroende på pris`],
    ["Upprepning", times(plan.avgFrequency), "i snitt, för dem som ser den"],
    ["Kostnad", ore(plan.costPerReachedSek), "per person som nås"],
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {tiles.map(([head, value, note], i) => (
        <div
          key={head}
          className={`overflow-hidden rounded-xl border border-[var(--color-border)] bg-white ${i === 2 ? "col-span-2 sm:col-span-1" : ""}`}
        >
          <div className="bg-[var(--color-primary)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-on-primary)]">
            {head}
          </div>
          <div className="px-2.5 pb-3 pt-2">
            <b
              className="block text-[28px] leading-none text-[var(--color-primary)] lining-nums tabular-nums"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
            >
              {value}
            </b>
            <span className="mt-1 block text-xs leading-snug text-[var(--color-muted-foreground)]">{note}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Allocation({ plan }: { plan: PlanView }) {
  const channels = [...plan.channels].sort((a, b) => b.budgetSek - a.budgetSek);
  return (
    <div className={card}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <b className="text-[var(--color-primary)]">Så fördelas pengarna</b>
        <span className="text-[13px] text-[var(--color-muted-foreground)] tabular-nums">{kr(plan.totalBudgetSek)}</span>
      </div>
      <div className="mb-3.5 flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-[var(--color-muted)]" aria-hidden="true">
        {channels.map((c, k) => (
          <div
            key={c.channel}
            style={{ flexBasis: `${(c.budgetSek / plan.totalBudgetSek) * 100}%`, background: SEGMENT_COLORS[k] }}
          />
        ))}
      </div>
      <ul className="space-y-2.5">
        {channels.map((c, k) => (
          <li key={c.channel} className="grid grid-cols-[12px_1fr_auto] items-baseline gap-2.5">
            <span className="h-3 w-3 self-center rounded-[3px]" style={{ background: SEGMENT_COLORS[k] }} />
            <span className="font-semibold text-[var(--color-primary)]">
              {c.label}
              <small className="block text-[13px] font-normal text-[var(--color-muted-foreground)]">
                når {of100(c.reachShare)} av 100
                {c.targetShareOfImpressions < 0.95 &&
                  `, ${of100(c.targetShareOfImpressions)} av 100 visningar i målgruppen`}
              </small>
            </span>
            <span className="font-semibold text-[var(--color-primary)] tabular-nums">{kr(c.budgetSek)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Certainty({ mp, view, plan }: { mp: MediaPlanRecord; view: MediaPlanView; plan: PlanView }) {
  const items = [
    "Medievanorna är uppmätta: Mediebarometern 2024 och SCB.",
    `Priserna per visning är uppskattade. Därför kan räckvidden bli ${of100(plan.reach.low)}–${of100(plan.reach.high)} av 100.`,
    ...(mp.explanation?.risks ?? []),
    ...(view.competitorChannelsAssumed &&
    !(mp.explanation?.risks ?? []).some((r) => /konkurrent/i.test(r))
      ? [`Konkurrenternas kanaler är inte uppmätta ännu. Vi antar ${listSv(view.competitorChannels.map((c) => CHANNELS[c].label))}.`]
      : []),
    ...view.excluded.map(
      (e) => `${e.label} är inte med: bara ${of100(e.penetration)} av 100 i målgruppen använder den dagligen.`
    ),
    "Sökannonser ingår inte ännu.",
  ];
  return (
    <aside className={card}>
      <p className={eyebrow}>Hur säkra är vi?</p>
      <span
        className="text-2xl text-[var(--color-primary)]"
        style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
      >
        Ganska säkra
      </span>
      <div className="my-2.5 flex gap-1.5" aria-hidden="true">
        <i className="h-2 flex-1 rounded-full bg-[var(--color-primary)]" />
        <i className="h-2 flex-1 rounded-full bg-[var(--color-primary)]" />
        <i className="h-2 flex-1 rounded-full bg-[var(--color-muted)]" />
      </div>
      <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--color-secondary)]">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {view.unverifiedAssumptions.length > 0 && (
        <details className="group mt-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-[var(--color-muted-foreground)] [&::-webkit-details-marker]:hidden">
            Alla antaganden i modellen
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-[var(--color-secondary)]">
            {view.unverifiedAssumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

export default function Result({
  analysisId,
  mp,
  onEdit,
  onRecompute,
}: {
  analysisId: string;
  mp: MediaPlanRecord;
  onEdit: () => void;
  onRecompute: (budgetSek: number) => void;
}) {
  const view = mp.view!;
  const explanation = mp.explanation;
  const recommendedId = explanation?.recommendedPlanId ?? null;
  const committedIdx = Math.max(0, view.curve.findIndex((p) => p.budgetSek === mp.input.budgetSek));

  const [idx, setIdx] = useState(committedIdx);
  const [planChoice, setPlanChoice] = useState<PlanId | null>(null);
  const [selChoice, setSelChoice] = useState<string | null>(null);
  const explored = useRef(false);
  const { copied, copy } = useCopyLink(analysisId);


  const point = view.curve[idx];
  const planId = planChoice ?? recommendedId ?? "rackvidd";
  const plan = point.plans.find((p) => p.id === planId) ?? point.plans[0];
  const atCommitted = point.budgetSek === mp.input.budgetSek;
  const explained = atCommitted && explanation !== null;
  const showsRecommendation = explained && plan.id === recommendedId;
  const answers = showsRecommendation && mp.panel ? mp.panel.answers : null;

  const isReached = (id: string) => plan.reached[view.people.findIndex((p) => p.id === id)] === 1;
  const firstReached = view.people[plan.reached.indexOf(1)]?.id;
  const reachedAnswer = answers?.find((a) => isReached(a.personaId))?.personaId;
  const selected =
    selChoice ?? reachedAnswer ?? answers?.[0]?.personaId ?? firstReached ?? view.people[0].id;

  function changeBudget(i: number) {
    setIdx(i);
    if (!explored.current) {
      explored.current = true;
      logEvent("mediaplan_budget_explored", analysisId);
    }
  }

  const topChannels = [...plan.channels]
    .sort((a, b) => b.budgetSek - a.budgetSek)
    .slice(0, 2)
    .map((c) => c.label);
  const input = mp.input;

  return (
    <div className="animate-rise space-y-10">
      <section className="grid items-start gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <p className={eyebrow}>Din mediaplan</p>
          <h1 className="text-balance text-4xl leading-[1.03] text-[var(--color-primary)] sm:text-[56px]">
            Lägg pengarna på {listSv(topChannels)}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-[var(--color-secondary)]">
            Då ser ungefär{" "}
            <strong className="text-[var(--color-primary)]">{of100(plan.reach.mid)} av 100</strong> i
            din målgrupp annonsen, runt {people(plan.reach.mid * view.targetPopulation)} personer.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button type="button" onClick={copy} className={primaryButton}>
              {copied ? "Länken är kopierad" : "Kopiera länken till planen"}
            </button>
            <a href="#nasta-steg" className={secondaryButton}>
              Boka genomgång
            </a>
          </div>
        </div>

        <div className={card}>
          <p className={eyebrow}>Förutsättningar</p>
          <ul>
            <Row
              icon={<Users className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              label="Målgrupp"
              value={`${input.ageMin}–${input.ageMax} år, ${gendersText(input.genders)}`}
              action={<button type="button" className={chipButton} onClick={onEdit}>Ändra</button>}
            />
            <Row
              icon={<Briefcase className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              label="Ni säljer främst till"
              value={input.businessModel === "b2c" ? "Konsumenter" : "Företag"}
              action={<button type="button" className={chipButton} onClick={onEdit}>Ändra</button>}
            />
            <Row
              icon={<CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              label="Period"
              value={`${input.weeks} veckor`}
              action={<button type="button" className={chipButton} onClick={onEdit}>Ändra</button>}
            />
            <Row
              icon={<Wallet className="h-[18px] w-[18px]" strokeWidth={1.75} />}
              label="Budget"
              value={kr(input.budgetSek)}
              action={
                <a href="#budgetkurva" className={chipButton}>
                  Ändra
                </a>
              }
            />
          </ul>
        </div>
      </section>

      {mp.status === "explaining" && <Working text="Din marknadschef väljer plan och skriver motiveringen…" />}
      {mp.status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Motiveringen kunde inte tas fram: {mp.error} Siffrorna nedan är ändå framräknade.
          <button type="button" onClick={() => onRecompute(input.budgetSek)} className="ml-2 font-semibold underline">
            Försök igen
          </button>
        </div>
      )}

      <div role="tablist" aria-label="Välj plan" className="grid gap-2.5 md:grid-cols-3">
        {point.plans.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={p.id === plan.id}
            onClick={() => setPlanChoice(p.id)}
            className={`relative grid content-start gap-0.5 rounded-xl border bg-white px-3.5 py-3 text-left transition ${
              p.id === plan.id
                ? "border-[var(--color-primary)] shadow-[inset_0_0_0_1px_var(--color-primary)]"
                : "border-[var(--color-border)] hover:border-[var(--color-secondary)]"
            }`}
          >
            {p.id === recommendedId && atCommitted && (
              <span className="absolute -top-2.5 right-3 rounded-full bg-[var(--color-highlight)] px-2 py-px text-[11px] font-bold text-[var(--color-primary)]">
                Rekommenderas
              </span>
            )}
            <span className="font-bold text-[var(--color-primary)]">{p.name}</span>
            <span className="text-[13px] leading-snug text-[var(--color-muted-foreground)]">{PLAN_BLURB[p.id]}</span>
            {p.sameAs && (
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">
                Blir samma som {point.plans.find((x) => x.id === p.sameAs)?.name} med den här budgeten
              </span>
            )}
            <span
              className="mt-1.5 text-[22px] leading-none text-[var(--color-primary)] lining-nums tabular-nums"
              style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 600 }}
            >
              {of100(p.reach.mid)} av 100
            </span>
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_1fr]">
        <DotPanel
          people={view.people}
          plan={plan}
          answers={answers}
          selected={selected}
          onSelect={setSelChoice}
        />
        <div className="grid gap-4">
          <Tiles plan={plan} />
          <BudgetCurve
            curve={view.curve}
            planId={plan.id}
            index={idx}
            committedBudget={input.budgetSek}
            onChange={changeBudget}
          />
          <Allocation plan={plan} />
        </div>
      </div>

      <div className="grid items-start gap-7 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="text-3xl text-[var(--color-primary)]">Därför den här planen</h2>
          {!atCommitted && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm">
              <span className="flex-1 text-[var(--color-secondary)]">
                Din marknadschefs motivering gäller {kr(input.budgetSek)}. Här är siffrorna för{" "}
                {kr(point.budgetSek)}.
              </span>
              <button type="button" className={primaryButton} onClick={() => onRecompute(point.budgetSek)}>
                Räkna om med {kr(point.budgetSek)}
              </button>
            </div>
          )}

          {showsRecommendation && explanation ? (
            <>
              <p className="mb-4 mt-2 max-w-prose text-[var(--color-secondary)]">{explanation.summary}</p>
              <ul className="space-y-3.5">
                {explanation.channelReasons
                  .filter((r) => r.planId === plan.id)
                  .map((r) => (
                    <li key={r.channel} className="border-b border-[var(--color-border)] pb-3.5">
                      <b className="text-[var(--color-primary)]">
                        {plan.channels.find((c) => c.channel === r.channel)?.label}
                      </b>
                      <p className="mt-1">{r.reason}</p>
                      <Sources ruleIds={r.ruleIds} />
                    </li>
                  ))}
              </ul>
              <div className="mt-6">
                <h3 className="mb-2 text-2xl text-[var(--color-primary)]">Varför inte de andra?</h3>
                {explanation.rejectedPlans.map((r) => (
                  <p key={r.planId} className="mb-2 text-[15px]">
                    <b className="text-[var(--color-primary)]">
                      {point.plans.find((p) => p.id === r.planId)?.name}.
                    </b>{" "}
                    {r.reason}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 mt-2 text-sm text-[var(--color-muted-foreground)]">
                {explained && recommendedId
                  ? `Din marknadschef rekommenderar ${point.plans.find((p) => p.id === recommendedId)?.name}. Så här ser den här planen ut enligt simuleringen.`
                  : "Räknat av simuleringen."}
              </p>
              {explained && explanation && (
                <p className="mb-4 text-[15px]">
                  {explanation.rejectedPlans.find((r) => r.planId === plan.id)?.reason}
                </p>
              )}
              <ul className="space-y-3.5">
                {computedReasons(view, plan).map((r) => (
                  <li key={r.channel} className="border-b border-[var(--color-border)] pb-3.5">
                    <b className="text-[var(--color-primary)]">{r.label}</b>
                    <p className="mt-1">{r.text}</p>
                    <Sources ruleIds={plan.ruleIds.filter((id) => getRule(id)?.kind === "forskning").slice(0, 2)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <Certainty mp={mp} view={view} plan={plan} />
      </div>

      <FollowUps analysisId={analysisId} questions={followUps(view, plan, input)} />

      <NextStep analysisId={analysisId} />

      <p className="max-w-prose border-t border-[var(--color-border)] pt-4 text-[13px] text-[var(--color-muted-foreground)]">
        Siffrorna kommer från en simulering: 2 000 syntetiska personer med medievanor från
        Mediebarometern 2024 och befolkning från SCB. Personernas citat är skrivna av Claude utifrån
        deras medievanor och ska läsas som hypoteser, inte som svar från riktiga kunder.
      </p>
    </div>
  );
}
