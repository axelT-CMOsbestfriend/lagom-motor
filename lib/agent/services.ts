import crypto from "crypto";
import { normalizeUrl } from "../crawler";
import { parseMediaPlanInput, type MediaPlanInput } from "../media/input";
import { newMediaPlanRecord, runMediaPlan } from "../media/run";
import type { MediaPlanRecord } from "../media/view";
import { runPipeline } from "../pipeline";
import { runSeoAudit, type SeoAudit } from "../seo/run";
import { getAnalysis, saveAnalysis } from "../store";
import type { AnalysisRecord, HealthCheck } from "../types";
import { friendlyError } from "../errors";
import { refundQuota } from "./keys";
import { getOrder, markStale, saveOrder, type Order, type ServiceId } from "./orders";

// Lagom HQ tjänster: vad de heter, vad de kräver och hur de körs.
// En order är ett färdigt resultat som kunden betalar för, inte timmar.

export const SERVICES: Record<ServiceId, { tool: string; name: string; description: string; etaMinutes: number }> = {
  health_check: {
    tool: "order_health_check",
    name: "Marknadspiloten – Marknadshälsokoll",
    description:
      "Läser bolagets webbplats och letar upp de tre närmaste konkurrenterna. Resultatet: styrkor och gap med källa, konkurrentjämförelse och en prioriterad 30/60/90-dagarsplan.",
    etaMinutes: 3,
  },
  media_plan: {
    tool: "order_media_plan",
    name: "Mediapiloten – Mediaplan",
    description:
      "Tre mediaplaner för budgeten, simulerade mot en syntetisk svensk panel byggd på SCB och Mediebarometern. Resultatet: räckvidd och frekvens per plan, kanalfördelning i kronor, rekommenderad plan med motivering och risker.",
    etaMinutes: 1,
  },
  seo_audit: {
    tool: "order_seo_audit",
    name: "SEO-audit",
    description:
      "Teknisk on-page-audit, laddtid (PageSpeed), AI-synlighet i köpfrågor och sökordsförslag. Resultatet: betyg 0–100 per del och de tio åtgärder som ger mest effekt per arbetstimme.",
    etaMinutes: 4,
  },
};

export interface HealthCheckInput {
  companyName: string;
  websiteUrl: string;
  industry: string;
  goal: string;
}
export type MediaPlanOrderInput = MediaPlanInput & Pick<HealthCheckInput, "companyName" | "industry" | "goal">;
export interface SeoInput {
  websiteUrl: string;
  companyName?: string;
  location?: string;
}

// Kontrolleras innan ordern skapas, så att agenten kan rätta och försöka igen
// utan att det kostar kvot. Returnerar ett felmeddelande eller null.
export function validateInput(service: ServiceId, input: Record<string, unknown>): string | null {
  const url = (v: unknown) => {
    try {
      normalizeUrl(String(v ?? ""));
      return true;
    } catch {
      return false;
    }
  };
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  if (service === "health_check") {
    if (!text(input.companyName) || !text(input.goal)) return "companyName och goal krävs";
    if (!url(input.websiteUrl)) return "websiteUrl ser inte ut som en giltig webbadress";
    return null;
  }
  if (service === "media_plan") {
    if (!text(input.companyName) || !text(input.goal)) return "companyName och goal krävs";
    const parsed = parseMediaPlanInput(input);
    return parsed.ok ? null : parsed.error;
  }
  return url(input.websiteUrl) ? null : "websiteUrl ser inte ut som en giltig webbadress";
}

function newAnalysis(brief: AnalysisRecord["brief"]): AnalysisRecord {
  return {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    status: "pending",
    statusMessage: "Startar analysen…",
    brief,
    crawl: null,
    healthCheck: null,
    error: null,
  };
}

// Startar hälsokollet. Det blir klart i ett senare serveranrop (se
// lib/pipeline.ts), så ordern följer analysen i stället för att vänta på den.
async function startHealthCheckOrder(order: Order): Promise<void> {
  const input = order.input as HealthCheckInput;
  const record = newAnalysis({
    companyName: input.companyName.trim(),
    websiteUrl: input.websiteUrl.trim(),
    industry: (input.industry ?? "").trim(),
    goal: input.goal.trim(),
    followUps: [],
  });
  await saveAnalysis(record);
  order.analysisId = record.id;
  await saveOrder(order);
  await runPipeline(record.id);
}

async function runMediaPlanOrder(order: Order): Promise<MediaPlanRecord> {
  const input = order.input as MediaPlanOrderInput;
  const parsed = parseMediaPlanInput(input);
  if (!parsed.ok) throw new Error(parsed.error);
  // Mediaplanen hänger på en analys, precis som i webbappen. Här finns
  // inget hälsokoll, så analysen skapas direkt som klar.
  const record = newAnalysis({
    companyName: input.companyName.trim(),
    websiteUrl: "",
    industry: (input.industry ?? "").trim(),
    goal: input.goal.trim(),
    followUps: [],
  });
  record.status = "done";
  record.statusMessage = "Klart!";
  record.mediaPlan = newMediaPlanRecord(parsed.input);
  await saveAnalysis(record);
  order.analysisId = record.id;
  await saveOrder(order);
  await runMediaPlan(record.id);
  const mp = (await getAnalysis(record.id))?.mediaPlan;
  if (!mp || mp.status !== "done") throw new Error(mp?.error ?? "Mediaplanen blev inte klar");
  return mp;
}

// Kör en order till slut. Kastar aldrig: fel sparas på ordern och kvoten
// räknas tillbaka, eftersom kunden inte ska betala för något vi inte levererat.
export async function runOrder(orderId: string): Promise<void> {
  const order = await getOrder(orderId);
  if (!order || order.status !== "queued") return;
  order.status = "running";
  order.startedAt = new Date().toISOString();
  await saveOrder(order);
  try {
    if (order.service === "health_check") {
      await startHealthCheckOrder(order);
      // Lokalt är analysen redan klar här; på Vercel blir den det senare
      await settleOrder(order);
      return;
    }
    if (order.service === "media_plan") order.result = await runMediaPlanOrder(order);
    else order.result = await runSeoAudit(order.input as SeoInput);
    order.status = "done";
  } catch (err) {
    console.error(`Order ${order.id} (${order.service}) misslyckades:`, err);
    order.status = "error";
    order.error = `${friendlyError(err)} ${REFUNDED}`;
    await refundQuota(order.apiKeyId);
  }
  order.finishedAt = new Date().toISOString();
  await saveOrder(order);
}

const REFUNDED = "Beställningen har inte dragits från kvoten.";

// Ett hälsokoll är klart när dess analys är klar
async function syncHealthCheck(order: Order): Promise<Order> {
  if (order.service !== "health_check" || order.status !== "running" || !order.analysisId) return order;
  const record = await getAnalysis(order.analysisId);
  if (record?.status === "done" && record.healthCheck) {
    const done: Order = { ...order, status: "done", result: record.healthCheck, finishedAt: new Date().toISOString() };
    await saveOrder(done);
    return done;
  }
  if (record?.status === "error") {
    const failed: Order = {
      ...order,
      status: "error",
      error: `${friendlyError(new Error(record.error ?? ""))} ${REFUNDED}`,
      finishedAt: new Date().toISOString(),
    };
    await saveOrder(failed);
    await refundQuota(order.apiKeyId);
    return failed;
  }
  return order;
}

// Uppdaterar en order innan den visas: ett hälsokoll följer sin analys, och
// ett jobb som plattformen dödat markeras som fel och räknas tillbaka till
// kvoten. Ändrar bara något första gången, så inget räknas tillbaka två gånger.
export async function settleOrder(order: Order): Promise<Order> {
  const synced = await syncHealthCheck(order);
  const settled = markStale(synced);
  if (settled.status === synced.status) return synced;
  settled.error = `${settled.error} ${REFUNDED}`;
  await saveOrder(settled);
  await refundQuota(settled.apiKeyId);
  return settled;
}

// ---------- Det agenten får tillbaka ----------

function healthCheckMarkdown(hc: HealthCheck): string {
  return [
    "# Marknadshälsokoll",
    hc.summary,
    "",
    "## Gap",
    ...hc.gaps.map((g) => `- **${g.title}**: ${g.detail} ${g.why}`),
    "",
    "## Konkurrenter",
    ...hc.competitors.map((c) => `- **${c.name}** (${c.url}): ${c.yourOpening}`),
    "",
    "## Plan",
    ...hc.plan.flatMap((p) => [`### ${p.period} dagar`, ...p.items.map((i) => `- ${i.heading}: ${i.detail}`)]),
  ].join("\n");
}

const pct = (x: number) => `${Math.round(x * 100)} %`;
// Små belopp, som kostnad per nådd person, får två decimaler så att de inte blir 0 kr
const kr = (x: number) =>
  `${x < 10 ? x.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(x).toLocaleString("sv-SE")} kr`;

// Agenten behöver planerna, inte prickarna och kurvan som webbvyn ritar
function compactMediaPlan(mp: MediaPlanRecord) {
  return {
    input: mp.input,
    recommendedPlanId: mp.explanation?.recommendedPlanId ?? null,
    summary: mp.explanation?.summary ?? null,
    risks: mp.explanation?.risks ?? [],
    plans: (mp.view?.plans ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      strategy: p.strategy,
      reach: p.reach,
      effectiveReach: p.effectiveReach,
      avgFrequency: p.avgFrequency,
      costPerReachedSek: p.costPerReachedSek,
      channels: p.channels.map((c) => ({ channel: c.channel, label: c.label, budgetSek: c.budgetSek })),
    })),
    unverifiedAssumptions: mp.view?.unverifiedAssumptions ?? [],
  };
}

function mediaPlanMarkdown(mp: ReturnType<typeof compactMediaPlan>): string {
  return [
    "# Mediaplan",
    mp.summary ?? "",
    "",
    ...mp.plans.flatMap((p) => [
      `## ${p.name}${p.id === mp.recommendedPlanId ? " (rekommenderad)" : ""}`,
      `Räckvidd ${pct(p.reach.mid)} (${pct(p.reach.low)}–${pct(p.reach.high)}), snittfrekvens ${p.avgFrequency.toFixed(1)}, ${kr(p.costPerReachedSek)} per nådd person`,
      ...p.channels.map((c) => `- ${c.label}: ${kr(c.budgetSek)}`),
      "",
    ]),
    mp.risks.length ? "## Risker" : "",
    ...mp.risks.map((r) => `- ${r}`),
  ].join("\n");
}

export function orderView(order: Order, baseUrl: string) {
  const o = markStale(order);
  const base = {
    order_id: o.id,
    service: o.service,
    status: o.status,
    created_at: o.createdAt,
    finished_at: o.finishedAt,
  };
  if (o.status === "error") return { ...base, error: o.error };
  if (o.status !== "done") {
    return { ...base, message: `Arbetar. Fråga igen om cirka ${SERVICES[o.service].etaMinutes} minut(er).` };
  }
  if (o.service === "health_check") {
    const hc = o.result as HealthCheck;
    return { ...base, summary: healthCheckMarkdown(hc), result: hc, web_url: `${baseUrl}/analys/${o.analysisId}` };
  }
  if (o.service === "media_plan") {
    const mp = compactMediaPlan(o.result as MediaPlanRecord);
    return { ...base, summary: mediaPlanMarkdown(mp), result: mp, web_url: `${baseUrl}/analys/${o.analysisId}/mediaplan` };
  }
  const seo = o.result as SeoAudit;
  return { ...base, summary: seo.summaryMarkdown, result: seo };
}
