import { CHANNELS } from "./channels";
import { CHANNEL_IDS, type ChannelId } from "./data/mediebarometern-2024";
import {
  channelAudience,
  createPanel,
  populationOf,
  type Panel,
  type TargetGroup,
} from "./panel";
import {
  simulateMid,
  simulatePlan,
  type Allocation,
  type Scenario,
  type SimulationResult,
} from "./reach";
import type { RuleId } from "./rules";

export type PlanId = "rackvidd" | "aktivering" | "luckan";
export const PLAN_IDS: PlanId[] = ["rackvidd", "aktivering", "luckan"];

export interface PlanRequest {
  budgetSek: number;
  target: TargetGroup;
  businessModel: "b2c" | "b2b";
  // Kanaler där konkurrenterna syns. Utelämnat = antagande (se nedan).
  competitorChannels?: ChannelId[];
  panelSize?: number;
  seed?: number;
}

export interface GeneratedPlan {
  id: PlanId;
  name: string;
  strategy: string;
  ruleIds: RuleId[];
  // Satt om planen blev identisk med en annan plan
  sameAs: PlanId | null;
  simulation: SimulationResult;
}

export interface Fact {
  id: string;
  text: string;
}

export interface PlanningResult {
  request: PlanRequest;
  panel: Panel;
  candidates: ChannelId[];
  excluded: { channel: ChannelId; penetration: number }[];
  competitorChannels: ChannelId[];
  competitorChannelsAssumed: boolean;
  maxChannels: number;
  plans: GeneratedPlan[];
  facts: Fact[];
}

// H-01 och H-02 i regelboken
export const MIN_PENETRATION = 0.15;
export const SEK_PER_CHANNEL = 25_000;
export const MAX_CHANNELS = 5;
const STEPS = 20;

// Utan signaler från annonsbiblioteken antar vi att konkurrenterna finns där
// småbolag oftast annonserar
const DEFAULT_COMPETITOR_CHANNELS: Record<PlanRequest["businessModel"], ChannelId[]> = {
  b2c: ["facebook", "instagram"],
  b2b: ["linkedin", "facebook"],
};

export function penetration(target: TargetGroup, channel: ChannelId): number {
  return channelAudience(target, channel) / populationOf(target);
}

export function maxChannelsFor(budgetSek: number): number {
  return Math.max(1, Math.min(MAX_CHANNELS, Math.floor(budgetSek / SEK_PER_CHANNEL)));
}

// Girig optimering: lägg budgeten i 20 steg, varje steg där det ökar målet mest
export function optimize(
  panel: Panel,
  budgetSek: number,
  allowed: ChannelId[],
  maxChannels: number,
  objective: (s: Scenario) => number
): Allocation[] {
  if (allowed.length === 0) return [];
  const step = Math.floor(budgetSek / STEPS);
  const budgets = new Map<ChannelId, number>();

  const score = (b: Map<ChannelId, number>) =>
    objective(
      simulateMid(
        panel,
        [...b].map(([channel, budget]) => ({ channel, budgetSek: budget }))
      )
    );

  for (let i = 0; i < STEPS; i++) {
    let best: ChannelId | null = null;
    let bestScore = -Infinity;
    for (const channel of allowed) {
      if (!budgets.has(channel) && budgets.size >= maxChannels) continue;
      const trial = new Map(budgets);
      trial.set(channel, (trial.get(channel) ?? 0) + step);
      const s = score(trial);
      if (s > bestScore + 1e-12) {
        bestScore = s;
        best = channel;
      }
    }
    if (best === null) break;
    budgets.set(best, (budgets.get(best) ?? 0) + step);
  }

  // Lägg avrundningsresten på den största posten så att summan blir exakt
  const allocations = [...budgets]
    .map(([channel, budget]) => ({ channel, budgetSek: budget }))
    .sort((a, b) => b.budgetSek - a.budgetSek);
  const rest = budgetSek - allocations.reduce((s, a) => s + a.budgetSek, 0);
  if (allocations.length > 0) allocations[0].budgetSek += rest;
  return allocations;
}

function sameAllocations(a: Allocation[], b: Allocation[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((x) => [x.channel, x.budgetSek]));
  return b.every((x) => map.get(x.channel) === x.budgetSek);
}

const av100 = (x: number) => `${Math.round(x * 100)} av 100`;
const share = (x: number) => `${Math.round(x * 100)}`;
const kr = (x: number) => `${Math.round(x).toLocaleString("sv-SE")} kr`;
const ore = (x: number) =>
  `${x.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

function buildFacts(
  req: PlanRequest,
  targetPopulation: number,
  candidates: ChannelId[],
  excluded: PlanningResult["excluded"],
  competitorChannels: ChannelId[],
  competitorChannelsAssumed: boolean,
  plans: GeneratedPlan[]
): Fact[] {
  const facts: Fact[] = [
    {
      id: "F-MALGRUPP",
      text: `Målgruppen är ${req.target.ageMin}–${req.target.ageMax} år och omfattar ${Math.round(targetPopulation).toLocaleString("sv-SE")} personer.`,
    },
    {
      id: "F-BUDGET",
      text: `Budgeten är ${kr(req.budgetSek)}, vilket enligt H-02 räcker till högst ${maxChannelsFor(req.budgetSek)} kanaler.`,
    },
    {
      id: "F-KONKURRENTER",
      text: competitorChannelsAssumed
        ? `Konkurrenternas kanaler är inte uppmätta. Antagande: de finns i ${competitorChannels.map((c) => CHANNELS[c].label).join(" och ")}.`
        : `Konkurrenterna syns i ${competitorChannels.map((c) => CHANNELS[c].label).join(", ")}.`,
    },
  ];

  for (const channel of candidates) {
    facts.push({
      id: `F-PEN-${channel}`,
      text: `${av100(penetration(req.target, channel))} i målgruppen använder ${CHANNELS[channel].label} en vanlig dag (Mediebarometern 2024).`,
    });
  }
  for (const { channel, penetration: p } of excluded) {
    facts.push({
      id: `F-UTE-${channel}`,
      text: `${CHANNELS[channel].label} används av bara ${av100(p)} i målgruppen en vanlig dag och är utesluten enligt H-01.`,
    });
  }

  for (const plan of plans) {
    const { low, mid, high } = plan.simulation;
    facts.push(
      {
        id: `F-${plan.id}-RACKVIDD`,
        text: `Planen ${plan.name} når ${av100(mid.reachShare)} i målgruppen minst en gång (spann ${share(low.reachShare)}–${av100(high.reachShare)}).`,
      },
      {
        id: `F-${plan.id}-3PLUS`,
        text: `Planen ${plan.name} når ${av100(mid.effectiveReachShare)} i målgruppen minst tre gånger (spann ${share(low.effectiveReachShare)}–${av100(high.effectiveReachShare)}).`,
      },
      {
        id: `F-${plan.id}-KOSTNAD`,
        text: `Planen ${plan.name} kostar ${ore(mid.costPerReachedSek)} per nådd person, med snittfrekvens ${mid.avgFrequency.toFixed(1).replace(".", ",")} bland de nådda.`,
      }
    );
    for (const c of mid.channels) {
      facts.push({
        id: `F-${plan.id}-${c.channel}`,
        text: `I planen ${plan.name} får ${CHANNELS[c.channel].label} ${kr(c.budgetSek)}, når ${av100(c.reachShare)} i målgruppen, och ${share(c.targetShareOfImpressions)} av 100 visningar hamnar i målgruppen.`,
      });
    }
  }
  return facts;
}

export function generatePlans(req: PlanRequest): PlanningResult {
  if (!(req.budgetSek > 0)) throw new Error("Budgeten måste vara större än 0");
  const panel = createPanel(req.target, { size: req.panelSize ?? 2000, seed: req.seed ?? 1 });

  const all = CHANNEL_IDS.filter((c) => req.businessModel === "b2b" || c !== "linkedin");
  const candidates: ChannelId[] = [];
  const excluded: PlanningResult["excluded"] = [];
  for (const channel of all) {
    const p = penetration(req.target, channel);
    if (p >= MIN_PENETRATION) candidates.push(channel);
    else excluded.push({ channel, penetration: p });
  }

  const competitorChannelsAssumed = req.competitorChannels === undefined;
  const competitorChannels =
    req.competitorChannels ?? DEFAULT_COMPETITOR_CHANNELS[req.businessModel];
  const maxChannels = maxChannelsFor(req.budgetSek);

  const build = (
    id: PlanId,
    name: string,
    strategy: string,
    ruleIds: RuleId[],
    allowed: ChannelId[],
    objective: (s: Scenario) => number
  ): GeneratedPlan => {
    const allocations = optimize(panel, req.budgetSek, allowed, maxChannels, objective);
    return {
      id,
      name,
      strategy,
      ruleIds,
      sameAs: null,
      simulation: simulatePlan(panel, { name, allocations }),
    };
  };

  const gapChannels = candidates.filter((c) => !competitorChannels.includes(c));

  const plans = [
    build(
      "rackvidd",
      "Nå flest",
      "Budgeten läggs där den når flest unika personer i målgruppen.",
      ["EB-01", "BF-01", "NBD-01", "DATA-01", "DATA-02", "H-01", "H-02"],
      candidates,
      (s) => s.reachShare
    ),
    build(
      "aktivering",
      "Sälj nu",
      "Budgeten läggs i riktbara kanaler och optimeras mot upprepning: varje visning upp till den tredje per person räknas, visningar därutöver gör det inte.",
      ["FREQ-01", "BF-03", "DATA-02", "H-01", "H-02"],
      candidates.filter((c) => CHANNELS[c].targetable),
      (s) => s.exposuresUpTo3
    ),
    build(
      "luckan",
      "Där konkurrenterna inte är",
      "Budgeten läggs där den når flest, men bara i kanaler där konkurrenterna inte syns.",
      ["ESOV-01", "EB-01", "EB-02", "H-01", "H-02"],
      gapChannels.length > 0 ? gapChannels : candidates,
      (s) => s.reachShare
    ),
  ];

  for (let i = 1; i < plans.length; i++) {
    for (let j = 0; j < i; j++) {
      if (
        plans[i].sameAs === null &&
        sameAllocations(plans[i].simulation.plan.allocations, plans[j].simulation.plan.allocations)
      ) {
        plans[i].sameAs = plans[j].id;
      }
    }
  }

  return {
    request: req,
    panel,
    candidates,
    excluded,
    competitorChannels,
    competitorChannelsAssumed,
    maxChannels,
    plans,
    facts: buildFacts(
      req,
      panel.targetPopulation,
      candidates,
      excluded,
      competitorChannels,
      competitorChannelsAssumed,
      plans
    ),
  };
}
