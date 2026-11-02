import { test } from "node:test";
import assert from "node:assert/strict";
import { RULES, RULE_IDS, getRule, type Rule } from "../../lib/media/rules";

const rules = RULES as readonly Rule[];

test("regel-ID:n är unika", () => {
  assert.equal(new Set(RULE_IDS).size, RULE_IDS.length);
});

test("ingen regel utan källa", () => {
  for (const r of rules) {
    assert.ok(r.source.author.trim().length > 0, `${r.id}: författare`);
    assert.ok(r.source.title.trim().length > 0, `${r.id}: titel`);
    assert.ok(r.claim.trim().length > 20, `${r.id}: påstående`);
    assert.ok(r.implication.trim().length > 20, `${r.id}: innebörd`);
  }
});

test("forskning och data har årtal, heuristik är märkt som ovaliderad", () => {
  for (const r of rules) {
    if (r.kind === "heuristik") {
      assert.match(r.source.title, /valideras/, r.id);
    } else {
      assert.ok(r.source.year !== null && r.source.year > 1900, `${r.id}: årtal`);
    }
  }
});

test("getRule hittar bara regler som finns", () => {
  assert.equal(getRule("BF-01")?.id, "BF-01");
  assert.equal(getRule("BF-99"), undefined);
});
