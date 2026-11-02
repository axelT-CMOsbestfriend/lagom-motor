import { CHANNELS, MODEL_ASSUMPTIONS, NBD_K, type Assumption } from "./channels";
import type { ChannelId } from "./data/mediebarometern-2024";
import { ALL_ADULTS, channelAudience, type Panel } from "./panel";

export interface Allocation {
  channel: ChannelId;
  budgetSek: number;
}

export interface MediaPlan {
  name: string;
  allocations: Allocation[];
}

export interface ChannelResult {
  channel: ChannelId;
  budgetSek: number;
  impressions: number;
  // Andel av visningarna som hamnar hos målgruppen (1 − spill)
  targetShareOfImpressions: number;
  // Genomsnittligt antal visningar per målgruppsperson som använder kanalen
  exposuresPerUser: number;
  // Andel av målgruppen som nås minst en gång av just denna kanal
  reachShare: number;
}

export interface Scenario {
  reachShare: number; // minst 1 visning
  effectiveReachShare: number; // minst 3 visningar
  // Snitt av min(exponeringar, 3) per person i målgruppen, 0–3. Belönar
  // varje visning fram till tröskeln men inte visningar därefter.
  exposuresUpTo3: number;
  reachedPeople: number;
  avgFrequency: number; // bland de nådda
  costPerReachedSek: number;
  channels: ChannelResult[];
}

export interface SimulationResult {
  plan: MediaPlan;
  totalBudgetSek: number;
  targetPopulation: number;
  // low = dyra CPM:er, high = billiga CPM:er, mid = mittpunkten
  low: Scenario;
  mid: Scenario;
  high: Scenario;
  assumptions: Assumption[];
}

// Sannolikheten för 0, 1 och 2 exponeringar givet medelvärde lambda,
// negativ binomialfördelning med formparameter k
export function nbdHead(lambda: number, k: number = NBD_K): [number, number, number] {
  if (lambda <= 0) return [1, 0, 0];
  const q = lambda / (lambda + k);
  const p0 = Math.pow(k / (lambda + k), k);
  const p1 = p0 * k * q;
  const p2 = (p1 * (k + 1) * q) / 2;
  return [p0, p1, p2];
}

function mergeAllocations(allocations: Allocation[]): Allocation[] {
  const byChannel = new Map<ChannelId, number>();
  for (const a of allocations) {
    if (!(a.budgetSek >= 0)) {
      throw new Error(`Ogiltig budget för ${a.channel}: ${a.budgetSek}`);
    }
    if (!(a.channel in CHANNELS)) {
      throw new Error(`Okänd kanal: ${a.channel}`);
    }
    byChannel.set(a.channel, (byChannel.get(a.channel) ?? 0) + a.budgetSek);
  }
  return [...byChannel].map(([channel, budgetSek]) => ({ channel, budgetSek }));
}

function runScenario(
  panel: Panel,
  allocations: Allocation[],
  pickCpm: (range: { low: number; high: number }) => number
): Scenario {
  const lambdas = new Map<ChannelId, number>();
  const partial = allocations.map((a) => {
    const spec = CHANNELS[a.channel];
    const impressions = (a.budgetSek / pickCpm(spec.cpmSek)) * 1000;
    const inTarget = channelAudience(panel.target, a.channel);
    let lambda = 0;
    let impressionsInTarget = 0;
    if (inTarget > 0 && impressions > 0) {
      if (spec.targetable) {
        lambda = impressions / inTarget;
        impressionsInTarget = impressions;
      } else {
        // Ej riktbar kanal: visningarna sprids över hela den vuxna publiken
        lambda = impressions / channelAudience(ALL_ADULTS, a.channel);
        impressionsInTarget = Math.min(impressions, lambda * inTarget);
      }
    }
    lambdas.set(a.channel, lambda);
    return {
      channel: a.channel,
      budgetSek: a.budgetSek,
      impressions,
      targetShareOfImpressions: impressions > 0 ? impressionsInTarget / impressions : 0,
      exposuresPerUser: lambda,
    };
  });

  const n = panel.personas.length;
  let reachSum = 0;
  let effectiveSum = 0;
  let upTo3Sum = 0;
  let exposureSum = 0;
  const channelReachSum = new Map<ChannelId, number>();

  for (const persona of panel.personas) {
    // Fördelning av totalt antal exposeringar, trunkerad vid 0, 1, 2
    let dist: [number, number, number] = [1, 0, 0];
    for (const channel of persona.channels) {
      const lambda = lambdas.get(channel);
      if (!lambda) continue;
      const [q0, q1, q2] = nbdHead(lambda);
      dist = [
        dist[0] * q0,
        dist[0] * q1 + dist[1] * q0,
        dist[0] * q2 + dist[1] * q1 + dist[2] * q0,
      ];
      exposureSum += lambda;
      channelReachSum.set(channel, (channelReachSum.get(channel) ?? 0) + (1 - q0));
    }
    reachSum += 1 - dist[0];
    const threePlus = 1 - dist[0] - dist[1] - dist[2];
    effectiveSum += threePlus;
    upTo3Sum += dist[1] + 2 * dist[2] + 3 * threePlus;
  }

  const reachShare = n > 0 ? reachSum / n : 0;
  const reachedPeople = reachShare * panel.targetPopulation;
  const totalBudget = allocations.reduce((s, a) => s + a.budgetSek, 0);

  return {
    reachShare,
    effectiveReachShare: n > 0 ? effectiveSum / n : 0,
    exposuresUpTo3: n > 0 ? upTo3Sum / n : 0,
    reachedPeople,
    avgFrequency: reachSum > 0 ? exposureSum / reachSum : 0,
    costPerReachedSek: reachedPeople > 0 ? totalBudget / reachedPeople : Infinity,
    channels: partial.map((c) => ({
      ...c,
      reachShare: n > 0 ? (channelReachSum.get(c.channel) ?? 0) / n : 0,
    })),
  };
}

// Bara mittscenariot. Används i optimeringen, där bara det behövs.
export function simulateMid(panel: Panel, allocations: Allocation[]): Scenario {
  return runScenario(panel, mergeAllocations(allocations), (r) => (r.low + r.high) / 2);
}

export function simulatePlan(panel: Panel, plan: MediaPlan): SimulationResult {
  const allocations = mergeAllocations(plan.allocations);
  const used = allocations.filter((a) => a.budgetSek > 0).map((a) => a.channel);

  return {
    plan,
    totalBudgetSek: allocations.reduce((s, a) => s + a.budgetSek, 0),
    targetPopulation: panel.targetPopulation,
    low: runScenario(panel, allocations, (r) => r.high),
    mid: runScenario(panel, allocations, (r) => (r.low + r.high) / 2),
    high: runScenario(panel, allocations, (r) => r.low),
    assumptions: [
      ...MODEL_ASSUMPTIONS,
      ...used.map((c) => CHANNELS[c].cpmAssumption),
    ],
  };
}
