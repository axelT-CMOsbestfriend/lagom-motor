import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMediaPlanInput, requestFromInput } from "../../lib/media/input";
import { generatePlans } from "../../lib/media/planner";

function plan(body: Record<string, unknown>) {
  const r = parseMediaPlanInput({ weeks: 4, ageMin: 25, ageMax: 64, genders: ["kvinna", "man"], businessModel: "b2c", ...body });
  assert.ok(r.ok, r.ok ? "" : r.error);
  if (!r.ok) throw new Error();
  return generatePlans(requestFromInput(r.input));
}

test("lokal frisör i Uppsala planeras mot Uppsala län, inte hela Sverige", () => {
  const sverige = plan({ budgetSek: 20_000 });
  const uppsala = plan({ budgetSek: 20_000, region: "uppsala" });
  assert.ok(uppsala.panel.targetPopulation < sverige.panel.targetPopulation * 0.05);
  assert.ok(uppsala.facts.some((f) => f.id === "F-GEO"));
  assert.ok(!uppsala.candidates.includes("tv4") && !uppsala.candidates.includes("reklamradio"));
});

test("B2B får Linkedin och aldrig Snapchat eller Tiktok", () => {
  const r = plan({ budgetSek: 50_000, businessModel: "b2b" });
  for (const p of r.plans) {
    const channels = p.simulation.plan.allocations.map((a) => a.channel);
    assert.ok(channels.includes("linkedin"), p.id);
    assert.ok(!channels.includes("snapchat") && !channels.includes("tiktok"), p.id);
  }
});

test("sök får sin del av budgeten först", () => {
  const r = plan({ budgetSek: 100_000 });
  assert.equal(r.search?.budgetSek, 40_000);
  assert.equal(r.displayBudgetSek, 60_000);
  for (const p of r.plans) assert.ok(p.simulation.totalBudgetSek <= 60_000);
});

test("perioden påverkar planen via frekvenstaket", () => {
  const kort = plan({ budgetSek: 200_000, weeks: 1, ageMin: 25, ageMax: 44, region: "uppsala" });
  const lang = plan({ budgetSek: 200_000, weeks: 12, ageMin: 25, ageMax: 44, region: "uppsala" });
  const spent = (r: ReturnType<typeof plan>) => r.plans[0].simulation.totalBudgetSek;
  assert.ok(spent(kort) < spent(lang), `${spent(kort)} < ${spent(lang)}`);
  assert.ok(kort.facts.some((f) => f.id.endsWith("-OANVAND")));
});

test("för liten budget ger råd i stället för bara ett nej", () => {
  const r = parseMediaPlanInput({ budgetSek: 5000, weeks: 4, ageMin: 25, ageMax: 44, genders: ["man"], businessModel: "b2c" });
  assert.ok(!r.ok);
  if (!r.ok) assert.match(r.error, /sökannonser/);
});
