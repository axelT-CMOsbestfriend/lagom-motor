// Kompakt, serialiserbar bild av planeringen. Sparas i analysen och visas
// i klienten. Hela panelen (tusentals personer) sparas inte, bara de 100
// personer som visas som prickar.
import { CHANNELS } from "./channels";
import type { ChannelId, Gender } from "./data/mediebarometern-2024";
import type { Explanation, PanelAnswer } from "./explain";
import type { MediaPlanInput } from "./input";
import type { Panel, Persona } from "./panel";
import { penetration, type Fact, type GeneratedPlan, type PlanId, type PlanningResult } from "./planner";
import { nbdHead, simulateMid, type ChannelResult } from "./reach";

export const DOT_COUNT = 100;

export interface Span {
  low: number;
  mid: number;
  high: number;
}

export interface ChannelView {
  channel: ChannelId;
  label: string;
  budgetSek: number;
  reachShare: number;
  targetShareOfImpressions: number;
}

export interface PersonView {
  id: string;
  age: number;
  gender: Gender;
  channels: ChannelId[];
}

export interface PlanView {
  id: PlanId;
  name: string;
  strategy: string;
  ruleIds: string[];
  sameAs: PlanId | null;
  totalBudgetSek: number;
  reach: Span;
  effectiveReach: Span;
  avgFrequency: number;
  costPerReachedSek: number;
  channels: ChannelView[];
  // 1 om personen på samma plats i `people` nås, annars 0
  reached: number[];
  // Räckvidden om hela budgeten läggs i planens största kanal
  topChannelOnly: { channel: ChannelId; label: string; reachShare: number } | null;
}

export interface CurvePoint {
  budgetSek: number;
  plans: PlanView[];
}

export interface MediaPlanView {
  targetPopulation: number;
  maxChannels: number;
  plans: PlanView[];
  facts: Fact[];
  people: PersonView[];
  curve: CurvePoint[];
  // Andel av målgruppen som använder kanalen en vanlig dag
  penetration: Partial<Record<ChannelId, number>>;
  excluded: { channel: ChannelId; label: string; penetration: number }[];
  competitorChannels: ChannelId[];
  competitorChannelsAssumed: boolean;
  unverifiedAssumptions: string[];
}

export type MediaPlanStatus = "running" | "explaining" | "done" | "error";

export interface MediaPlanRecord {
  status: MediaPlanStatus;
  input: MediaPlanInput;
  startedAt: string;
  finishedAt: string | null;
  view: MediaPlanView | null;
  explanation: Explanation | null;
  panel: { personas: Persona[]; answers: PanelAnswer[] } | null;
  panelError: string | null;
  error: string | null;
}

// Panelen som visas: de första 100 personerna. Samma seed ger samma
// personer för alla budgetnivåer, så prickarna står still när budgeten ändras.
export function displayedPanel(panel: Panel): Panel {
  return { ...panel, personas: panel.personas.slice(0, DOT_COUNT) };
}

// Vilka av de visade personerna som nås: de med högst sannolikhet att nås,
// lika många som planens räckvidd i hela panelen, så att prickarna alltid
// stämmer med siffran "X av 100"
export function reachedDots(
  personas: Persona[],
  channels: ChannelResult[],
  reachShare: number
): number[] {
  const lambda = new Map(channels.map((c) => [c.channel, c.exposuresPerUser]));
  const probability = personas.map((p) => {
    let none = 1;
    for (const c of p.channels) {
      const l = lambda.get(c);
      if (l) none *= nbdHead(l)[0];
    }
    return 1 - none;
  });
  const count = Math.round(reachShare * personas.length);
  const order = probability
    .map((p, i) => [p, i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const reached = new Array(personas.length).fill(0);
  for (const [, i] of order.slice(0, count)) reached[i] = 1;
  return reached;
}

function planView(p: GeneratedPlan, panel: Panel): PlanView {
  const { low, mid, high } = p.simulation;
  const shown = displayedPanel(panel).personas;
  const biggest = [...mid.channels].sort((a, b) => b.budgetSek - a.budgetSek)[0];
  const topChannelOnly =
    biggest && mid.channels.length > 1
      ? {
          channel: biggest.channel,
          label: CHANNELS[biggest.channel].label,
          reachShare: simulateMid(panel, [
            { channel: biggest.channel, budgetSek: p.simulation.totalBudgetSek },
          ]).reachShare,
        }
      : null;

  return {
    id: p.id,
    name: p.name,
    strategy: p.strategy,
    ruleIds: [...p.ruleIds],
    sameAs: p.sameAs,
    totalBudgetSek: p.simulation.totalBudgetSek,
    reach: { low: low.reachShare, mid: mid.reachShare, high: high.reachShare },
    effectiveReach: {
      low: low.effectiveReachShare,
      mid: mid.effectiveReachShare,
      high: high.effectiveReachShare,
    },
    avgFrequency: mid.avgFrequency,
    costPerReachedSek: mid.costPerReachedSek,
    channels: mid.channels.map((c) => ({
      channel: c.channel,
      label: CHANNELS[c.channel].label,
      budgetSek: c.budgetSek,
      reachShare: c.reachShare,
      targetShareOfImpressions: c.targetShareOfImpressions,
    })),
    reached: reachedDots(shown, mid.channels, mid.reachShare),
    topChannelOnly,
  };
}

// `curve` är samma förfrågan räknad för flera budgetnivåer (se curve.ts).
// Den valda budgeten ska finnas med bland dem.
export function toView(result: PlanningResult, curve: PlanningResult[] = [result]): MediaPlanView {
  const unverified = new Map<string, string>();
  for (const plan of result.plans) {
    for (const a of plan.simulation.assumptions) {
      if (!a.verified) unverified.set(a.id, a.text);
    }
  }

  const plans = result.plans.map((p) => planView(p, result.panel));
  const points = [...curve]
    .sort((a, b) => a.request.budgetSek - b.request.budgetSek)
    .map((r) => ({
      budgetSek: r.request.budgetSek,
      plans: r === result ? plans : r.plans.map((p) => planView(p, r.panel)),
    }));

  return {
    targetPopulation: result.panel.targetPopulation,
    maxChannels: result.maxChannels,
    plans,
    facts: result.facts,
    people: displayedPanel(result.panel).personas.map((p) => ({
      id: p.id,
      age: p.age,
      gender: p.gender,
      channels: p.channels,
    })),
    curve: points,
    penetration: Object.fromEntries(
      [...result.candidates, ...result.excluded.map((e) => e.channel)].map((c) => [
        c,
        penetration(result.request.target, c),
      ])
    ),
    excluded: result.excluded.map((e) => ({
      channel: e.channel,
      label: CHANNELS[e.channel].label,
      penetration: e.penetration,
    })),
    competitorChannels: result.competitorChannels,
    competitorChannelsAssumed: result.competitorChannelsAssumed,
    unverifiedAssumptions: [...unverified.values()],
  };
}
