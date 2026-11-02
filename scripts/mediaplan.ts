// npm run mediaplan                 visar planerna och fakta
// npm run mediaplan -- --claude     låter också Claude välja och motivera, och frågar panelen
// npm run mediaplan -- --spela-in   som --claude, och sparar svaren som testfixturer
import { writeFileSync } from "node:fs";
import { MODEL } from "../lib/claude";
import { CHANNELS } from "../lib/media/channels";
import { askPanel, explainPlans } from "../lib/media/explain";
import { generatePlans } from "../lib/media/planner";
import {
  FIXTURE_BRIEF,
  FIXTURE_REQUEST,
} from "../tests/fixtures/mediaplan/request";

const record = process.argv.includes("--spela-in");
const useClaude = record || process.argv.includes("--claude");

const pct = (x: number) => `${Math.round(x * 100)} %`;
const result = generatePlans(FIXTURE_REQUEST);

console.log(
  `${FIXTURE_BRIEF.companyName}, ${FIXTURE_REQUEST.budgetSek.toLocaleString("sv-SE")} kr, ` +
    `${FIXTURE_REQUEST.target.ageMin}–${FIXTURE_REQUEST.target.ageMax} år\n`,
);
for (const p of result.plans) {
  const { low, mid, high } = p.simulation;
  console.log(`▸ ${p.name}${p.sameAs ? ` (samma som ${p.sameAs})` : ""}`);
  console.log(`  ${p.strategy}`);
  console.log(
    `  1+: ${pct(mid.reachShare)} (${pct(low.reachShare)}–${pct(high.reachShare)})  ` +
      `3+: ${pct(mid.effectiveReachShare)}  regler: ${p.ruleIds.join(", ")}`,
  );
  for (const a of p.simulation.plan.allocations) {
    console.log(
      `    ${CHANNELS[a.channel].label.padEnd(16)} ${a.budgetSek.toLocaleString("sv-SE")} kr`,
    );
  }
  console.log();
}

async function runClaude() {
  const explanation = await explainPlans(result, FIXTURE_BRIEF);
  console.log(
    `Claude rekommenderar: ${explanation.recommendedPlanId}\n${explanation.summary}\n`,
  );
  for (const r of explanation.channelReasons) {
    console.log(
      `  ${r.planId}/${r.channel}: ${r.reason} [${[...r.ruleIds, ...r.factIds].join(", ")}]`,
    );
  }
  for (const r of explanation.rejectedPlans) {
    console.log(`  Inte ${r.planId}: ${r.reason} [${r.ruleIds.join(", ")}]`);
  }
  console.log(`  Risker: ${explanation.risks.join(" | ")}\n`);

  const recommended = result.plans.find(
    (p) => p.id === explanation.recommendedPlanId,
  )!;
  const planChannels = recommended.simulation.plan.allocations.map(
    (a) => a.channel,
  );
  const panel = await askPanel(result.panel, planChannels, FIXTURE_BRIEF);
  for (const a of panel.answers) {
    const p = panel.personas.find((x) => x.id === a.personaId)!;
    console.log(
      `  ${p.gender}, ${p.age} år [${a.noticedIn.join(", ") || "nås inte"}]: ${a.quote}`,
    );
  }

  if (record) {
    const origin = `Inspelat ${new Date().toISOString().slice(0, 10)} med ${MODEL}`;
    const dir = "tests/fixtures/mediaplan";
    writeFileSync(
      `${dir}/forklaring.json`,
      JSON.stringify({ _ursprung: origin, ...explanation }, null, 2) + "\n",
    );
    if (explanation.recommendedPlanId === "rackvidd") {
      writeFileSync(
        `${dir}/panelsvar.json`,
        JSON.stringify({ _ursprung: origin, answers: panel.answers }, null, 2) +
          "\n",
      );
    } else {
      console.log(
        "\nPanelsvaren sparas inte: testerna förutsätter panelurvalet för Nå flest.",
      );
    }
    console.log(`\nSparat i ${dir}. Kör npm test för att kontrollera.`);
  }
}

if (useClaude) {
  runClaude().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  console.log(
    "Kör med --claude för att låta Claude välja plan och fråga panelen.",
  );
}
