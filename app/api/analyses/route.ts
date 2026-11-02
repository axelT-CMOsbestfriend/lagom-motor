import { after } from "next/server";
import crypto from "crypto";
import type { AnalysisRecord, Brief } from "@/lib/types";
import { logEvent, saveAnalysis } from "@/lib/store";
import { runPipeline } from "@/lib/pipeline";
import { normalizeUrl } from "@/lib/crawler";

export async function POST(request: Request) {
  const body = await request.json();
  const brief: Brief = {
    companyName: String(body?.companyName ?? "").trim(),
    websiteUrl: String(body?.websiteUrl ?? "").trim(),
    industry: String(body?.industry ?? "").trim(),
    goal: String(body?.goal ?? "").trim(),
    followUps: Array.isArray(body?.followUps) ? body.followUps : [],
  };

  if (!brief.companyName || !brief.websiteUrl || !brief.goal) {
    return Response.json(
      { error: "Företagsnamn, webbplats och mål krävs" },
      { status: 400 }
    );
  }
  try {
    normalizeUrl(brief.websiteUrl);
  } catch {
    return Response.json(
      { error: "Webbplatsadressen ser inte giltig ut" },
      { status: 400 }
    );
  }

  const record: AnalysisRecord = {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: new Date().toISOString(),
    status: "pending",
    statusMessage: "Startar analysen…",
    brief,
    crawl: null,
    healthCheck: null,
    error: null,
  };
  await saveAnalysis(record);
  await logEvent("brief_completed", record.id);

  after(() =>
    runPipeline(record.id).catch((err) =>
      console.error(`Pipeline ${record.id} kraschade:`, err)
    )
  );

  return Response.json({ id: record.id });
}
