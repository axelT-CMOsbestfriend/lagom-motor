import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHANNEL_IDS,
  dailyReach,
  AGE_GROUPS,
  GENDERS,
} from "../../lib/media/data/mediebarometern-2024";
import {
  ALL_ADULTS,
  createPanel,
  populationOf,
  targetCells,
} from "../../lib/media/panel";

test("hela vuxna befolkningen 15–84 år är rimlig (7,5–9 miljoner)", () => {
  const pop = populationOf(ALL_ADULTS);
  assert.ok(pop > 7_500_000 && pop < 9_000_000, String(pop));
});

test("delvis överlappande femårsklass räknas proportionellt", () => {
  // 30–32 år = 3 av 5 år i bandet 30–34
  const cells = targetCells({ ageMin: 30, ageMax: 32, genders: ["kvinna"] });
  assert.equal(cells.length, 1);
  assert.ok(Math.abs(cells[0].population - 365_142 * 0.6) < 1);
});

test("geoShare skalar målgruppen", () => {
  const full = populationOf({ ageMin: 25, ageMax: 44, genders: ["man"] });
  const half = populationOf({ ageMin: 25, ageMax: 44, genders: ["man"], geoShare: 0.5 });
  assert.ok(Math.abs(half - full / 2) < 1);
});

test("ogiltig målgrupp ger tydligt fel", () => {
  assert.throws(() => createPanel({ ageMin: 10, ageMax: 30, genders: ["man"] }));
  assert.throws(() => createPanel({ ageMin: 40, ageMax: 30, genders: ["man"] }));
  assert.throws(() => createPanel({ ageMin: 20, ageMax: 30, genders: [] }));
  assert.throws(() =>
    createPanel({ ageMin: 20, ageMax: 30, genders: ["man"], geoShare: 0 })
  );
});

test("samma seed ger samma panel, annan seed ger en annan", () => {
  const a = createPanel(ALL_ADULTS, { size: 300, seed: 42 });
  const b = createPanel(ALL_ADULTS, { size: 300, seed: 42 });
  const c = createPanel(ALL_ADULTS, { size: 300, seed: 43 });
  assert.deepEqual(a.personas, b.personas);
  assert.notDeepEqual(a.personas, c.personas);
});

test("alla personer ligger inom målgruppen", () => {
  const target = { ageMin: 27, ageMax: 41, genders: ["kvinna" as const] };
  const panel = createPanel(target, { size: 1000 });
  for (const p of panel.personas) {
    assert.equal(p.gender, "kvinna");
    assert.ok(p.age >= 27 && p.age <= 41, String(p.age));
  }
});

// Kärnkravet: panelens medievanor ska motsvara Mediebarometern
test("kalibrering: kanalanvändning per cell inom ±3 procentenheter", () => {
  const panel = createPanel(ALL_ADULTS, { size: 20_000, seed: 7 });
  for (const group of AGE_GROUPS) {
    for (const gender of GENDERS) {
      const members = panel.personas.filter(
        (p) => p.ageGroup === group && p.gender === gender
      );
      assert.ok(members.length > 500, `${group} ${gender}: ${members.length}`);
      for (const channel of CHANNEL_IDS) {
        const observed =
          members.filter((p) => p.channels.includes(channel)).length / members.length;
        const expected = dailyReach(channel, group, gender);
        assert.ok(
          Math.abs(observed - expected) <= 0.03,
          `${channel} ${group} ${gender}: ${observed.toFixed(3)} mot ${expected}`
        );
      }
    }
  }
});

test("panelens åldersfördelning följer SCB (±2 procentenheter per grupp)", () => {
  const panel = createPanel(ALL_ADULTS, { size: 20_000, seed: 7 });
  const total = populationOf(ALL_ADULTS);
  for (const group of AGE_GROUPS) {
    const expected =
      targetCells(ALL_ADULTS)
        .filter((c) => c.band.group === group)
        .reduce((s, c) => s + c.population, 0) / total;
    const observed =
      panel.personas.filter((p) => p.ageGroup === group).length / panel.personas.length;
    assert.ok(Math.abs(observed - expected) <= 0.02, `${group}: ${observed} mot ${expected}`);
  }
});
