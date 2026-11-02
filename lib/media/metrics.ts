import type { LoggedEvent } from "../types";

// Krav 13 i docs/mediaplan-mal.md: mediaplanen får lägga högst 2 minuter
// på flödet, räknat från att formuläret börjar fyllas i till att planen visas
export const MAX_EXTRA_SECONDS = 120;

export interface MediaPlanTiming {
  analysisId: string;
  formSeconds: number | null; // första fältet → skickat
  waitSeconds: number | null; // skickat → planen visas
  totalSeconds: number | null;
}

function first(events: LoggedEvent[], name: LoggedEvent["name"]): number | null {
  const e = events.find((x) => x.name === name);
  return e ? Date.parse(e.timestamp) : null;
}

const seconds = (from: number | null, to: number | null) =>
  from !== null && to !== null && to >= from ? (to - from) / 1000 : null;

export function mediaPlanTimings(events: LoggedEvent[]): MediaPlanTiming[] {
  const byAnalysis = new Map<string, LoggedEvent[]>();
  for (const e of events) {
    if (!e.analysisId || !e.name.startsWith("mediaplan_")) continue;
    byAnalysis.set(e.analysisId, [...(byAnalysis.get(e.analysisId) ?? []), e]);
  }
  return [...byAnalysis].map(([analysisId, list]) => {
    const sorted = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const opened = first(sorted, "mediaplan_form_opened");
    const started = first(sorted, "mediaplan_started");
    const viewed = first(sorted, "mediaplan_viewed");
    return {
      analysisId,
      formSeconds: seconds(opened, started),
      waitSeconds: seconds(started, viewed),
      totalSeconds: seconds(opened, viewed),
    };
  });
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
