import crypto from "crypto";
import { crawlSite } from "./crawler";
import { researchCompetitors, runHealthCheck } from "./claude";
import { getAnalysis, saveAnalysis } from "./store";
import type { AnalysisRecord } from "./types";

// Hälsokollet körs i två steg, i var sitt serveranrop när det körs på Vercel.
// Steg 1 läser sajten och letar konkurrenter med webbsökning, steg 2 skriver
// analysen. Var för sig håller de sig under taket på 300 sekunder per anrop.

type Continue = (analysisId: string) => Promise<void>;

async function fail(record: AnalysisRecord, err: unknown) {
  console.error(`Analys ${record.id} misslyckades:`, err);
  record.status = "error";
  record.error = err instanceof Error ? err.message : String(err);
  record.statusMessage = "Något gick fel";
  await saveAnalysis(record);
}

// Lösenordet för det interna anropet till steg 2. Det härleds från en hemlighet
// som servern redan har, så ingen ny miljövariabel behövs.
export function jobToken(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.ANTHROPIC_API_KEY ?? "lokal";
  return crypto.createHash("sha256").update(`lagom-jobb:${secret}`).digest("hex");
}

// På Vercel startar steg 2 i ett nytt serveranrop med egen tidsgräns. Lokalt
// finns ingen sådan gräns, så där körs steget direkt.
async function continueInNewRequest(analysisId: string): Promise<void> {
  const base =
    process.env.PUBLIC_BASE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null);
  if (!process.env.VERCEL || !base) return runAnalysisStep(analysisId);
  const res = await fetch(`${base}/api/analyses/${analysisId}/continue`, {
    method: "POST",
    headers: { "x-job-token": jobToken() },
  });
  if (!res.ok) throw new Error(`Kunde inte starta analyssteget (${res.status})`);
}

export async function runPipeline(analysisId: string, next: Continue = continueInNewRequest): Promise<void> {
  const record = await getAnalysis(analysisId);
  if (!record) return;

  try {
    record.status = "crawling";
    record.statusMessage = "Läser in din webbplats…";
    await saveAnalysis(record);

    record.crawl = await crawlSite(record.brief.websiteUrl);

    record.status = "analyzing";
    record.statusMessage = "Letar upp konkurrenter…";
    await saveAnalysis(record);

    record.research = await researchCompetitors(record.brief, record.crawl);
    record.statusMessage = "Analyserar marknadsföringen…";
    await saveAnalysis(record);
  } catch (err) {
    await fail(record, err);
    return;
  }

  try {
    await next(analysisId);
  } catch (err) {
    await fail(record, err);
  }
}

export async function runAnalysisStep(analysisId: string): Promise<void> {
  const record = await getAnalysis(analysisId);
  if (!record || record.status !== "analyzing" || !record.crawl || !record.research) return;
  try {
    record.healthCheck = await runHealthCheck(record.brief, record.crawl, record.research);
    record.status = "done";
    record.statusMessage = "Klart!";
    await saveAnalysis(record);
  } catch (err) {
    await fail(record, err);
  }
}
