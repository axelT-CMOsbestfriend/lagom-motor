// Kör: npm run simulera
// Jämför tre exempelplaner mot samma syntetiska panel och skriver ut
// räckvidd, frekvens och kostnad per nådd person.
import { CHANNELS } from "../lib/media/channels";
import { createPanel, type TargetGroup } from "../lib/media/panel";
import { simulatePlan, type MediaPlan } from "../lib/media/reach";

const target: TargetGroup = { ageMin: 25, ageMax: 44, genders: ["kvinna", "man"] };

const plans: MediaPlan[] = [
  {
    name: "Räckvidd först",
    allocations: [
      { channel: "tv4", budgetSek: 80_000 },
      { channel: "youtube", budgetSek: 60_000 },
      { channel: "facebook", budgetSek: 30_000 },
      { channel: "instagram", budgetSek: 30_000 },
    ],
  },
  {
    name: "Tungt på sociala medier",
    allocations: [
      { channel: "facebook", budgetSek: 90_000 },
      { channel: "instagram", budgetSek: 90_000 },
      { channel: "tiktok", budgetSek: 20_000 },
    ],
  },
  {
    name: "Ljud och nyheter",
    allocations: [
      { channel: "reklamradio", budgetSek: 70_000 },
      { channel: "podd", budgetSek: 50_000 },
      { channel: "kvallstidning", budgetSek: 40_000 },
      { channel: "instagram", budgetSek: 40_000 },
    ],
  },
];

const pct = (x: number) => `${Math.round(x * 100)} %`;
const kr = (x: number) => `${x.toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kr`;
const people = (x: number) => Math.round(x).toLocaleString("sv-SE");

const panel = createPanel(target, { size: 5000, seed: 1 });
console.log(
  `Målgrupp: ${target.ageMin}–${target.ageMax} år, ${target.genders.join(" och ")}, ` +
    `${people(panel.targetPopulation)} personer. Panel: ${panel.personas.length} syntetiska personer.\n`
);

for (const plan of plans) {
  const r = simulatePlan(panel, plan);
  console.log(`▸ ${plan.name} (${kr(r.totalBudgetSek)})`);
  console.log(
    `  Räckvidd 1+: ${pct(r.low.reachShare)}–${pct(r.high.reachShare)} ` +
      `(mitt ${pct(r.mid.reachShare)}, ${people(r.mid.reachedPeople)} personer)`
  );
  console.log(`  Räckvidd 3+: ${pct(r.low.effectiveReachShare)}–${pct(r.high.effectiveReachShare)}`);
  console.log(`  Snittfrekvens bland nådda: ${r.mid.avgFrequency.toFixed(1)}`);
  console.log(`  Kostnad per nådd person: ${kr(r.mid.costPerReachedSek)}`);
  for (const c of r.mid.channels) {
    console.log(
      `    ${CHANNELS[c.channel].label.padEnd(16)} ${pct(c.reachShare).padStart(5)} nådda, ` +
        `${pct(c.targetShareOfImpressions).padStart(5)} av visningarna i målgruppen`
    );
  }
  console.log();
}

console.log("Overifierade antaganden i körningen:");
const unverified = new Map<string, string>();
for (const plan of plans) {
  for (const a of simulatePlan(panel, plan).assumptions) {
    if (!a.verified) unverified.set(a.id, a.text);
  }
}
for (const text of unverified.values()) console.log(`  - ${text}`);
