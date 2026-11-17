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
  // Kampanjens längd. Styr frekvenstaket (H-05). Saknas = inget tak.
  weeks?: number;
  // Lägg en del av budgeten i sökannonser före räckviddskanalerna (H-04)
  includeSearch?: boolean;
  regionLabel?: string;
}

export interface SearchBudget {
  budgetSek: number;
  share: number;
  note: string;
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
  search: SearchBudget | null;
  displayBudgetSek: number;
}

export const SEARCH_SHARE: Record<PlanRequest["businessModel"], number> = { b2c: 0.4, b2b: 0.3 };
export const B2B_LINKEDIN_MIN_SHARE = 0.4;
export const MAX_EXPOSURES_PER_WEEK = 2;
const B2B_EXCLUDED: ChannelId[] = ["snapchat", "tiktok"];

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
  objective: (s: Scenario) => number,
  options: { maxExposuresPerUser?: number; fixed?: Allocation[] } = {}
): Allocation[] {
  if (allowed.length === 0) return [];
  const budgets = new Map<ChannelId, number>();
  for (const f of options.fixed ?? []) budgets.set(f.channel, f.budgetSek);
  const fixedTotal = [...budgets.values()].reduce((s, b) => s + b, 0);
  const step = Math.floor((budgetSek - fixedTotal) / STEPS);
  const cap = options.maxExposuresPerUser ?? Infinity;

  const simulate = (b: Map<ChannelId, number>) =>
    simulateMid(
      panel,
      [...b].map(([channel, budget]) => ({ channel, budgetSek: budget }))
    );

  let spent = fixedTotal;
  for (let i = 0; i < STEPS && step > 0; i++) {
    let best: ChannelId | null = null;
    let bestScore = -Infinity;
    for (const channel of allowed) {
      if (!budgets.has(channel) && budgets.size >= maxChannels) continue;
      const trial = new Map(budgets);
      trial.set(channel, (trial.get(channel) ?? 0) + step);
      const scenario = simulate(trial);
      // Frekvenstaket: kanalen är mättad och får inte mer
      const c = scenario.channels.find((x) => x.channel === channel);
      if (c && c.exposuresPerUser > cap) continue;
      const s = objective(scenario);
      if (s > bestScore + 1e-12) {
        bestScore = s;
        best = channel;
      }
    }
    if (best === null) break;
    budgets.set(best, (budgets.get(best) ?? 0) + step);
    spent += step;
  }

  const allocations = [...budgets]
    .map(([channel, budget]) => ({ channel, budgetSek: budget }))
    .sort((a, b) => b.budgetSek - a.budgetSek);
  // Avrundningsresten läggs på den största posten, men bara om hela
  // budgeten gick åt. Stoppade taket optimeringen lämnas resten oanvänd.
  const rest = budgetSek - spent;
  if (allocations.length > 0 && rest < step * 1.5 + 1) allocations[0].budgetSek += rest;
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
  plans: GeneratedPlan[],
  displayBudget: number = req.budgetSek
): Fact[] {
  const facts: Fact[] = [
    {
      id: "F-MALGRUPP",
      text: `Målgruppen är ${req.target.ageMin}–${req.target.ageMax} år och omfattar ${Math.round(targetPopulation).toLocaleString("sv-SE")} personer.`,
    },
    {
      id: "F-BUDGET",
      text: `Budgeten för räckviddskanalerna är ${kr(displayBudget)}, vilket enligt H-02 räcker till högst ${maxChannelsFor(displayBudget)} kanaler.`,
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

function extraFacts(req: PlanRequest, search: SearchBudget | null, plans: GeneratedPlan[], displayBudget: number): Fact[] {
  const facts: Fact[] = [];
  if (req.regionLabel) {
    facts.push({ id: "F-GEO", text: `Målgruppen är avgränsad till ${req.regionLabel}. Rikstäckande kanaler som inte kan riktas geografiskt (tablå-tv, nationell radio, tidningar) är därför inte med.` });
  }
  if (search) {
    facts.push({ id: "F-SOK", text: `${kr(search.budgetSek)} (${Math.round(search.share * 100)} av 100 kr) läggs i Google-sök enligt H-04. ${search.note}` });
  }
  if (req.weeks) {
    facts.push({ id: "F-PERIOD", text: `Kampanjen pågår i ${req.weeks} veckor. Ingen kanal får mer än ${MAX_EXPOSURES_PER_WEEK * req.weeks} visningar per person i snitt (H-05).` });
  }
  for (const plan of plans) {
    const unused = displayBudget - plan.simulation.totalBudgetSek;
    if (unused > displayBudget * 0.05) {
      facts.push({ id: `F-${plan.id}-OANVAND`, text: `I planen ${plan.name} är ${kr(unused)} oanvända, eftersom kanalerna redan är mättade enligt H-05.` });
    }
  }
  return facts;
}

export function generatePlans(req: PlanRequest): PlanningResult {
  if (!(req.budgetSek > 0)) throw new Error("Budgeten måste vara större än 0");
  const panel = createPanel(req.target, { size: req.panelSize ?? 2000, seed: req.seed ?? 1 });
  const b2b = req.businessModel === "b2b";

  // H-04: sökannonser tas ur budgeten först
  const searchShare = req.includeSearch ? SEARCH_SHARE[req.businessModel] : 0;
  const searchBudget = Math.round(req.budgetSek * searchShare);
  const displayBudget = req.budgetSek - searchBudget;
  const search: SearchBudget | null = req.includeSearch
    ? {
        budgetSek: searchBudget,
        share: searchShare,
        note: "Google-sök på era viktigaste tjänste- och produktord. Räknas inte i räckviddssimuleringen, eftersom sök når dem som redan letar.",
      }
    : null;

  const all = CHANNEL_IDS.filter((c) =>
    b2b ? !(req.includeSearch && B2B_EXCLUDED.includes(c)) : c !== "linkedin"
  );
  const candidates: ChannelId[] = [];
  const excluded: PlanningResult["excluded"] = [];
  const regional = (req.target.geoShare ?? 1) < 1;
  for (const channel of all) {
    // Kanaler som inte går att rikta köps rikstäckande. För en regional
    // målgrupp hamnar nästan allt utanför området, så de tas inte med.
    if (regional && !CHANNELS[channel].targetable) continue;
    const p = penetration(req.target, channel);
    // H-03: Linkedin tas alltid med för B2B, även under H-01-tröskeln
    if (p >= MIN_PENETRATION || (b2b && channel === "linkedin" && req.includeSearch)) candidates.push(channel);
    else excluded.push({ channel, penetration: p });
  }
  const maxExposuresPerUser = req.weeks ? MAX_EXPOSURES_PER_WEEK * req.weeks : undefined;
  const fixed: Allocation[] =
    b2b && req.includeSearch && candidates.includes("linkedin")
      ? [{ channel: "linkedin", budgetSek: Math.round(displayBudget * B2B_LINKEDIN_MIN_SHARE) }]
      : [];

  const competitorChannelsAssumed = req.competitorChannels === undefined;
  const competitorChannels =
    req.competitorChannels ?? DEFAULT_COMPETITOR_CHANNELS[req.businessModel];
  const maxChannels = maxChannelsFor(displayBudget);

  const build = (
    id: PlanId,
    name: string,
    strategy: string,
    ruleIds: RuleId[],
    allowed: ChannelId[],
    objective: (s: Scenario) => number
  ): GeneratedPlan => {
    // H-03 gäller i alla planer, så Linkedin får alltid vara med
    const withFixed = [...new Set([...allowed, ...fixed.map((f) => f.channel)])];
    const allocations = optimize(panel, displayBudget, withFixed, maxChannels, objective, {
      maxExposuresPerUser,
      fixed,
    });
    return {
      id,
      name,
      strategy,
      ruleIds,
      sameAs: null,
      simulation: simulatePlan(panel, { name, allocations }),
    };
  };

  const extraRules: RuleId[] = [
    ...(b2b && req.includeSearch ? (["H-03"] as RuleId[]) : []),
    ...(req.includeSearch ? (["H-04"] as RuleId[]) : []),
    ...(maxExposuresPerUser ? (["H-05"] as RuleId[]) : []),
  ];
  const gapChannels = candidates.filter((c) => !competitorChannels.includes(c));

  const plans = [
    build(
      "rackvidd",
      "Nå flest",
      "Budgeten läggs där den når flest unika personer i målgruppen.",
      ["EB-01", "BF-01", "NBD-01", "DATA-01", "DATA-02", "H-01", "H-02", ...extraRules],
      candidates,
      (s) => s.reachShare
    ),
    build(
      "aktivering",
      "Sälj nu",
      "Budgeten läggs i riktbara kanaler och optimeras mot upprepning: varje visning upp till den tredje per person räknas, visningar därutöver gör det inte.",
      ["FREQ-01", "BF-03", "DATA-02", "H-01", "H-02", ...extraRules],
      candidates.filter((c) => CHANNELS[c].targetable),
      (s) => s.exposuresUpTo3
    ),
    build(
      "luckan",
      "Där konkurrenterna inte är",
      "Budgeten läggs där den når flest, men bara i kanaler där konkurrenterna inte syns.",
      ["ESOV-01", "EB-01", "EB-02", "H-01", "H-02", ...extraRules],
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
    search,
    displayBudgetSek: displayBudget,
    facts: [
      ...buildFacts(
        req,
        panel.targetPopulation,
        candidates,
        excluded,
        competitorChannels,
        competitorChannelsAssumed,
        plans,
        displayBudget
      ),
      ...extraFacts(req, search, plans, displayBudget),
    ],
  };
}
