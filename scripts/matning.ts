// npm run matning
// Krav 13: hur lång tid mediaplanen lägger på flödet, ur data/events/
import { readdirSync, readFileSync } from "node:fs";
import { MAX_EXTRA_SECONDS, median, mediaPlanTimings } from "../lib/media/metrics";
import type { LoggedEvent } from "../lib/types";

let events: LoggedEvent[] = [];
try {
  events = readdirSync("data/events")
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(`data/events/${f}`, "utf8")) as LoggedEvent)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
} catch {
  console.log("Ingen eventlogg ännu (data/events/ saknas).");
  process.exit(0);
}

const timings = mediaPlanTimings(events);
if (timings.length === 0) {
  console.log("Inga mediaplaner i eventloggen ännu.");
  process.exit(0);
}

const s = (x: number | null) => (x === null ? "  –" : `${Math.round(x)} s`.padStart(5));
console.log("Analys     Formulär  Väntan  Totalt");
for (const t of timings) {
  const flag = t.totalSeconds !== null && t.totalSeconds > MAX_EXTRA_SECONDS ? "  ⚠ över 2 min" : "";
  console.log(`${t.analysisId.padEnd(10)} ${s(t.formSeconds)}   ${s(t.waitSeconds)}  ${s(t.totalSeconds)}${flag}`);
}

const totals = timings.flatMap((t) => (t.totalSeconds === null ? [] : [t.totalSeconds]));
const med = median(totals);
console.log(
  `\nMedian totalt: ${med === null ? "–" : `${Math.round(med)} s`} (${totals.length} kompletta). ` +
    `Krav: högst ${MAX_EXTRA_SECONDS} s. ${med !== null && med <= MAX_EXTRA_SECONDS ? "Uppfyllt." : "Inte uppfyllt än."}`
);
