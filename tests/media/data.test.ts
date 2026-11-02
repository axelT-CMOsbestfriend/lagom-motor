import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGE_GROUPS,
  CHANNEL_IDS,
  MEDIEBAROMETERN_2024,
  type ReachTable,
} from "../../lib/media/data/mediebarometern-2024";
import { SCB_BEFOLKNING_2025 } from "../../lib/media/data/scb-befolkning-2025";
import { CHANNELS } from "../../lib/media/channels";

test("varje kanal har källa och värden mellan 0 och 100", () => {
  for (const id of CHANNEL_IDS) {
    const table: ReachTable = MEDIEBAROMETERN_2024[id];
    assert.match(table.source, /Mediebarometern 2024.*s\. \d+/, id);
    for (const group of AGE_GROUPS) {
      for (const v of Object.values(table.byGroup[group])) {
        assert.ok(v >= 0 && v <= 100, `${id} ${group}: ${v}`);
      }
    }
  }
});

// Fångar avskrivningsfel: kvinnor och män viktat efter SCB:s befolkning ska
// hamna nära Mediebarometerns "totalt" för gruppen
test("kvinna/man stämmer med totalt per åldersgrupp (±2,5 procentenheter)", () => {
  for (const id of CHANNEL_IDS) {
    const table: ReachTable = MEDIEBAROMETERN_2024[id];
    for (const group of AGE_GROUPS) {
      const bands = SCB_BEFOLKNING_2025.filter((b) => b.group === group);
      const women = bands.reduce((s, b) => s + b.kvinna, 0);
      const men = bands.reduce((s, b) => s + b.man, 0);
      const cell = table.byGroup[group];
      const weighted = (cell.kvinna * women + cell.man * men) / (women + men);
      assert.ok(
        Math.abs(weighted - cell.totalt) <= 2.5,
        `${id} ${group}: viktat ${weighted.toFixed(1)} mot totalt ${cell.totalt}`
      );
    }
  }
});

test("SCB-banden är sammanhängande och täcker 15–84 år", () => {
  assert.equal(SCB_BEFOLKNING_2025[0].from, 15);
  assert.equal(SCB_BEFOLKNING_2025.at(-1)?.to, 84);
  for (let i = 1; i < SCB_BEFOLKNING_2025.length; i++) {
    assert.equal(SCB_BEFOLKNING_2025[i].from, SCB_BEFOLKNING_2025[i - 1].to + 1);
  }
});

test("alla kanaler har ett CPM-intervall och ett antagande", () => {
  for (const id of CHANNEL_IDS) {
    const spec = CHANNELS[id];
    assert.equal(spec.id, id);
    assert.ok(spec.cpmSek.low > 0 && spec.cpmSek.low <= spec.cpmSek.high, id);
    assert.equal(spec.cpmAssumption.id, `cpm-${id}`);
  }
});
