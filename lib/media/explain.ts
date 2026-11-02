import type Anthropic from "@anthropic-ai/sdk";
import { MODEL, getClient, textFrom } from "../claude";
import type { Brief } from "../types";
import { CHANNELS } from "./channels";
import { CHANNEL_IDS, type ChannelId } from "./data/mediebarometern-2024";
import type { Panel, Persona } from "./panel";
import { PLAN_IDS, type PlanId, type PlanningResult } from "./planner";
import { RULES, RULE_IDS, formatSource, getRule, type Rule } from "./rules";

export type BriefContext = Pick<Brief, "companyName" | "industry" | "goal">;

// ---------- Förklaringen ----------

export interface Reason {
  reason: string;
  ruleIds: string[];
  factIds: string[];
}

export interface Explanation {
  recommendedPlanId: PlanId;
  summary: string;
  channelReasons: (Reason & { planId: PlanId; channel: ChannelId })[];
  rejectedPlans: (Reason & { planId: PlanId })[];
  risks: string[];
}

const reasonProperties = {
  reason: { type: "string" },
  ruleIds: { type: "array", items: { type: "string", enum: RULE_IDS } },
  factIds: { type: "array", items: { type: "string" } },
};

export const EXPLANATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendedPlanId", "summary", "channelReasons", "rejectedPlans", "risks"],
  properties: {
    recommendedPlanId: { type: "string", enum: PLAN_IDS },
    summary: { type: "string" },
    channelReasons: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["planId", "channel", "reason", "ruleIds", "factIds"],
        properties: {
          planId: { type: "string", enum: PLAN_IDS },
          channel: { type: "string", enum: CHANNEL_IDS },
          ...reasonProperties,
        },
      },
    },
    rejectedPlans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["planId", "reason", "ruleIds", "factIds"],
        properties: {
          planId: { type: "string", enum: PLAN_IDS },
          ...reasonProperties,
        },
      },
    },
    risks: { type: "array", items: { type: "string" } },
  },
};

// Andelar skrivs som "X av 100" men Claude kan också skriva procent.
// Valideringen jämför talen, inte formen.
const SHARES = [/(\d+(?:,\d+)?)\s?%/g, /(\d+)\s+av\s+100\b/g];

function percentagesIn(text: string): string[] {
  return SHARES.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]));
}

// Varje procentsats i texten måste finnas i något av de citerade fakta
function checkNumbers(text: string, cited: string[], where: string, errors: string[]) {
  const allowed = new Set(cited.flatMap(percentagesIn));
  for (const n of percentagesIn(text)) {
    if (!allowed.has(n)) {
      errors.push(`${where}: andelen ${n} finns inte i de citerade fakta`);
    }
  }
}

function checkReason(
  r: Reason,
  factText: Map<string, string>,
  where: string,
  errors: string[]
) {
  if (r.ruleIds.length === 0) errors.push(`${where}: saknar regel-ID`);
  for (const id of r.ruleIds) {
    if (!getRule(id)) errors.push(`${where}: okänd regel ${id}`);
  }
  if (r.factIds.length === 0) errors.push(`${where}: saknar fakta-ID`);
  const cited: string[] = [];
  for (const id of r.factIds) {
    const text = factText.get(id);
    if (text === undefined) errors.push(`${where}: okänt fakta-ID ${id}`);
    else cited.push(text);
  }
  checkNumbers(r.reason, cited, where, errors);
}

export function validateExplanation(e: Explanation, result: PlanningResult): string[] {
  const errors: string[] = [];
  const factText = new Map(result.facts.map((f) => [f.id, f.text]));
  const plans = new Map(result.plans.map((p) => [p.id, p]));
  const budgeted = (planId: PlanId) =>
    new Set(
      plans
        .get(planId)
        ?.simulation.plan.allocations.filter((a) => a.budgetSek > 0)
        .map((a) => a.channel) ?? []
    );

  if (!plans.has(e.recommendedPlanId)) {
    errors.push(`okänd rekommenderad plan ${e.recommendedPlanId}`);
    return errors;
  }

  for (const [i, r] of e.channelReasons.entries()) {
    const where = `channelReasons[${i}] (${r.planId}/${r.channel})`;
    if (!budgeted(r.planId).has(r.channel)) {
      errors.push(`${where}: kanalen har ingen budget i planen`);
    }
    checkReason(r, factText, where, errors);
  }

  for (const channel of budgeted(e.recommendedPlanId)) {
    const covered = e.channelReasons.some(
      (r) => r.planId === e.recommendedPlanId && r.channel === channel
    );
    if (!covered) errors.push(`kanalen ${channel} i den rekommenderade planen saknar motivering`);
  }

  for (const id of PLAN_IDS) {
    if (id === e.recommendedPlanId) continue;
    if (!e.rejectedPlans.some((r) => r.planId === id)) {
      errors.push(`planen ${id} saknar motivering till varför den inte valdes`);
    }
  }
  for (const [i, r] of e.rejectedPlans.entries()) {
    const where = `rejectedPlans[${i}] (${r.planId})`;
    if (r.planId === e.recommendedPlanId) errors.push(`${where}: är den rekommenderade planen`);
    checkReason(r, factText, where, errors);
  }

  checkNumbers(e.summary, result.facts.map((f) => f.text), "summary", errors);
  return errors;
}

function describeRule(r: Rule): string {
  return `${r.id} [${r.kind}] ${r.claim} Innebär: ${r.implication} Källa: ${formatSource(r.source)}`;
}

export function buildExplainPrompt(result: PlanningResult, brief?: BriefContext) {
  const system = [
    "Du är en erfaren svensk mediestrateg som förklarar en mediaplan för ett litet bolag.",
    "Du får tre planer som redan är framräknade av en simulering, en regelbok och en lista med fakta. Välj den plan som passar bolaget bäst och förklara varför.",
    "",
    "REGLER FÖR SVARET:",
    "- Varje motivering ska hänvisa till minst ett regel-ID ur regelboken och minst ett fakta-ID ur faktalistan.",
    "- Använd bara siffror som står i de fakta du hänvisar till. Hitta aldrig på egna siffror.",
    "- Skriv andelar som \"X av 100\", inte i procent, precis som i faktalistan.",
    "- Motivera varje kanal med budget i den plan du rekommenderar. Förklara också kort varför de två andra planerna inte valdes.",
    "- Regler märkta [heuristik] är tumregler, inte forskning. Presentera dem så.",
    "- Om två planer är nästan lika bra, säg det rakt ut.",
    "- CPM-nivåerna bakom simuleringen är inte verifierade. Nämn det under risker.",
    "- Skriv enkel svenska utan byråjargong, som till en kollega.",
  ].join("\n");

  const plans = result.plans.map((p) => {
    const lines = p.simulation.plan.allocations
      .map((a) => `  - ${CHANNELS[a.channel].label} (${a.channel}): ${a.budgetSek.toLocaleString("sv-SE")} kr`)
      .join("\n");
    const same = p.sameAs ? ` OBS: identisk med planen ${p.sameAs}.` : "";
    return `${p.id}: ${p.name}. ${p.strategy}${same}\n  Bygger på: ${p.ruleIds.join(", ")}\n${lines}`;
  });

  const briefLines = brief
    ? [`Bolag: ${brief.companyName}`, `Bransch: ${brief.industry}`, `Mål: ${brief.goal}`]
    : [];

  const user = [
    "BOLAGET:",
    ...briefLines,
    `Affärsmodell: ${result.request.businessModel === "b2b" ? "B2B" : "B2C"}`,
    "",
    "PLANERNA:",
    ...plans,
    "",
    "REGELBOK:",
    ...(RULES as readonly Rule[]).map(describeRule),
    "",
    "FAKTA (hänvisa med ID):",
    ...result.facts.map((f) => `${f.id}: ${f.text}`),
  ].join("\n");

  return { system, user };
}

// ---------- Panelsvaren ----------

export interface PanelAnswer {
  personaId: string;
  noticedIn: ChannelId[];
  moment: string;
  quote: string;
}

export const PANEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["personaId", "noticedIn", "moment", "quote"],
        properties: {
          personaId: { type: "string" },
          noticedIn: { type: "array", items: { type: "string", enum: CHANNEL_IDS } },
          moment: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
};

// Deterministiskt urval: personer som använder någon av planens kanaler,
// hämtade i tur och ordning från varje ålders- och könsgrupp, plus en
// person som inte nås av planen alls
export function selectPersonas(panel: Panel, planChannels: ChannelId[], n = 6): Persona[] {
  const uses = (p: Persona) => p.channels.some((c) => planChannels.includes(c));
  const buckets = new Map<string, Persona[]>();
  for (const p of panel.personas.filter(uses)) {
    const key = `${p.ageGroup}-${p.gender}`;
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
  }
  const queues = [...buckets.values()];
  const chosen: Persona[] = [];
  for (let round = 0; chosen.length < n - 1 && queues.some((q) => q.length > round); round++) {
    for (const q of queues) {
      if (chosen.length < n - 1 && q[round]) chosen.push(q[round]);
    }
  }
  const outside = panel.personas.find((p) => !uses(p));
  if (outside) chosen.push(outside);
  return chosen;
}

export function validatePanelAnswers(
  answers: PanelAnswer[],
  personas: Persona[],
  planChannels: ChannelId[]
): string[] {
  const errors: string[] = [];
  const byId = new Map(personas.map((p) => [p.id, p]));
  const seen = new Set<string>();
  for (const a of answers) {
    const persona = byId.get(a.personaId);
    if (!persona) {
      errors.push(`${a.personaId}: finns inte i urvalet`);
      continue;
    }
    if (seen.has(a.personaId)) errors.push(`${a.personaId}: svarar mer än en gång`);
    seen.add(a.personaId);
    for (const c of a.noticedIn) {
      if (!persona.channels.includes(c)) errors.push(`${a.personaId}: använder inte ${c}`);
      else if (!planChannels.includes(c)) errors.push(`${a.personaId}: ${c} ingår inte i planen`);
    }
    if (/\d/.test(a.quote) || /\d/.test(a.moment)) {
      errors.push(`${a.personaId}: svaret innehåller siffror`);
    }
  }
  for (const p of personas) {
    if (!seen.has(p.id)) errors.push(`${p.id}: saknar svar`);
  }
  return errors;
}

export function buildPanelPrompt(
  personas: Persona[],
  planChannels: ChannelId[],
  brief?: BriefContext
) {
  const system = [
    "Du spelar personer ur en syntetisk panel. Deras ålder, kön och medievanor kommer från svensk mediestatistik och får inte ändras.",
    "Svara i jag-form som varje person, med vardaglig svenska, en till två meningar.",
    "- noticedIn får bara innehålla kanaler som personen använder OCH som ingår i kampanjen.",
    "- Om personen troligen inte skulle märka kampanjen, eller inte bry sig, säg det ärligt.",
    "- Skriv inga siffror, procentsatser eller årtal.",
  ].join("\n");

  const label = (c: ChannelId) => `${CHANNELS[c].label} (${c})`;
  const people = personas.map((p) => {
    const inPlan = p.channels.filter((c) => planChannels.includes(c));
    return [
      `${p.id}: ${p.gender}, ${p.age} år.`,
      `  Använder en vanlig dag: ${p.channels.map(label).join(", ") || "inga av de mätta kanalerna"}.`,
      `  Av kampanjens kanaler: ${inPlan.map(label).join(", ") || "ingen"}.`,
    ].join("\n");
  });

  const user = [
    brief
      ? `Kampanjen kommer från ${brief.companyName} (${brief.industry}). Målet är: ${brief.goal}`
      : "Kampanjen kommer från ett litet svenskt bolag.",
    `Kampanjen syns i: ${planChannels.map(label).join(", ")}.`,
    "",
    "Svara för varje person: var skulle du lägga märke till kampanjen, i vilken situation, och vad skulle få dig att bry dig eller strunta i den?",
    "",
    ...people,
  ].join("\n");

  return { system, user };
}

// ---------- Anropen ----------

async function callJson<T>(
  client: Anthropic,
  system: string,
  messages: Anthropic.MessageParam[],
  schema: Record<string, unknown>
): Promise<{ value: T; raw: string }> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages,
    output_config: { format: { type: "json_schema", schema } },
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new Error(`Claude avbröt svaret (${response.stop_reason})`);
  }
  const raw = textFrom(response);
  return { value: JSON.parse(raw) as T, raw };
}

// Ett underkänt svar skickas tillbaka en gång med felen. Underkänns det
// igen kastas ett fel hellre än att visa en motivering som inte håller.
async function withValidation<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  validate: (value: T) => string[],
  client: Anthropic
): Promise<T> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  const first = await callJson<T>(client, system, messages, schema);
  const errors = validate(first.value);
  if (errors.length === 0) return first.value;

  const second = await callJson<T>(
    client,
    system,
    [
      ...messages,
      { role: "assistant", content: first.raw },
      {
        role: "user",
        content: `Svaret underkändes av valideringen:\n${errors.map((e) => `- ${e}`).join("\n")}\nSkicka ett rättat svar.`,
      },
    ],
    schema
  );
  const remaining = validate(second.value);
  if (remaining.length > 0) {
    throw new Error(`Claudes svar underkändes två gånger:\n${remaining.join("\n")}`);
  }
  return second.value;
}

export async function explainPlans(
  result: PlanningResult,
  brief?: BriefContext,
  client: Anthropic = getClient()
): Promise<Explanation> {
  const { system, user } = buildExplainPrompt(result, brief);
  return withValidation<Explanation>(
    system,
    user,
    EXPLANATION_SCHEMA,
    (e) => validateExplanation(e, result),
    client
  );
}

export async function askPanel(
  panel: Panel,
  planChannels: ChannelId[],
  brief?: BriefContext,
  client: Anthropic = getClient()
): Promise<{ personas: Persona[]; answers: PanelAnswer[] }> {
  const personas = selectPersonas(panel, planChannels);
  const { system, user } = buildPanelPrompt(personas, planChannels, brief);
  const { answers } = await withValidation<{ answers: PanelAnswer[] }>(
    system,
    user,
    PANEL_SCHEMA,
    (v) => validatePanelAnswers(v.answers, personas, planChannels),
    client
  );
  return { personas, answers };
}
