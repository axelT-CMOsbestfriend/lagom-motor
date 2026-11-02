import crypto from "crypto";
import { getDoc, putDoc } from "./db";
import type { AnalysisRecord, EventName, LoggedEvent } from "./types";

export async function saveAnalysis(record: AnalysisRecord): Promise<void> {
  await putDoc("analyses", record.id, record);
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  return getDoc<AnalysisRecord>("analyses", id);
}

// Varje event är ett eget dokument. Då kan två samtidiga anrop aldrig
// skriva över varandra, vilket den gamla gemensamma loggfilen kunde.
export async function logEvent(
  name: EventName,
  analysisId: string | null,
  detail?: string
): Promise<void> {
  const event: LoggedEvent = {
    name,
    analysisId,
    timestamp: new Date().toISOString(),
  };
  if (detail) event.detail = detail;
  const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  try {
    await putDoc("events", id, event);
  } catch (err) {
    console.error("Kunde inte logga event:", err);
  }
}
