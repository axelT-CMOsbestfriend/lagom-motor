import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANNELS } from "../../lib/media/channels";
import {
  MIN_PENETRATION,
  generatePlans,
  maxChannelsFor,
  penetration,
  type PlanRequest,
} from "../../lib/media/planner";
import { getRule } from "../../lib/media/rules";
import { FIXTURE_REQUEST } from "../fixtures/mediaplan/request";

const b2c = generatePlans(FIXTURE_REQUEST);
const seniors = generatePlans({
  budgetSek: 60_000,
  target: { ageMin: 55, ageMax: 79, genders: ["kvinna", "man"] },
  businessModel: "b2c",
});
const b2b = generatePlans({
  budgetSek: 300_000,
  target: { ageMin: 30, ageMax: 60, genders: ["kvinna", "man"] },
  businessModel: "b2b",
  competitorChannels: ["linkedin"],
});
const all = [b2c, seniors, b2b];

const byId = (r: ReturnType<typeof generatePlans>, id: string) =>
  r.plans.find((p) => p.id === id)!;

test("tre planer, var och en håller budgeten exakt", () => {
  for (const r of all) {
    assert.deepEqual(r.plans.map((p) => p.id), ["rackvidd", "aktivering", "luckan"]);
    for (const p of r.plans) {
      assert.equal(p.simulation.totalBudgetSek, r.request.budgetSek, p.id);
    }
  }
});

test("planerna skiljer sig, eller är uttryckligen markerade som identiska", () => {
  for (const r of all) {
    const keys = r.plans.map((p) =>
      JSON.stringify(
        [...p.simulation.plan.allocations].sort((a, b) => a.channel.localeCompare(b.channel))
      )
    );
    for (let i = 0; i < keys.length; i++) {
      for (let j = 0; j < i; j++) {
        if (keys[i] === keys[j]) assert.equal(r.plans[i].sameAs, r.plans[j].id);
      }
    }
  }
  // Exempelförfrågan ska ge tre olika planer
  assert.ok(b2c.plans.every((p) => p.sameAs === null));
});

test("utan konkurrenter blir Där konkurrenterna inte är samma som Nå flest och markeras så", () => {
  const r = generatePlans({ ...FIXTURE_REQUEST, competitorChannels: [] });
  assert.equal(byId(r, "luckan").sameAs, "rackvidd");
});

test("varje plan är bäst på det den optimeras för", () => {
  for (const r of all) {
    const reach = byId(r, "rackvidd").simulation.mid;
    const act = byId(r, "aktivering").simulation.mid;
    const gap = byId(r, "luckan").simulation.mid;
    assert.ok(reach.reachShare >= act.reachShare && reach.reachShare >= gap.reachShare);
    assert.ok(act.exposuresUpTo3 >= reach.exposuresUpTo3 && act.exposuresUpTo3 >= gap.exposuresUpTo3);
  }
});

test("antal kanaler följer H-02", () => {
  assert.equal(maxChannelsFor(10_000), 1);
  assert.equal(maxChannelsFor(60_000), 2);
  assert.equal(maxChannelsFor(10_000_000), 5);
  for (const r of all) {
    for (const p of r.plans) {
      assert.ok(p.simulation.plan.allocations.length <= r.maxChannels, `${p.id}`);
    }
  }
});

test("kanaler under H-01-tröskeln och Linkedin för B2C används aldrig", () => {
  for (const r of all) {
    for (const p of r.plans) {
      for (const a of p.simulation.plan.allocations) {
        assert.ok(penetration(r.request.target, a.channel) >= MIN_PENETRATION, a.channel);
        if (r.request.businessModel === "b2c") assert.notEqual(a.channel, "linkedin");
      }
    }
  }
  assert.ok(b2c.excluded.some((e) => e.channel === "tiktok"));
});

test("Aktivering använder bara riktbara kanaler, Luckan undviker konkurrenterna", () => {
  for (const r of all) {
    for (const a of byId(r, "aktivering").simulation.plan.allocations) {
      assert.ok(CHANNELS[a.channel].targetable, a.channel);
    }
    for (const a of byId(r, "luckan").simulation.plan.allocations) {
      assert.ok(!r.competitorChannels.includes(a.channel), a.channel);
    }
  }
  assert.ok(b2c.competitorChannelsAssumed);
  assert.ok(!b2b.competitorChannelsAssumed);
});

test("planernas regel-ID:n finns i regelboken", () => {
  for (const p of b2c.plans) {
    for (const id of p.ruleIds) assert.ok(getRule(id), id);
  }
});

test("fakta: unika ID:n och ett fakta per kanal med budget", () => {
  for (const r of all) {
    const ids = r.facts.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const p of r.plans) {
      for (const a of p.simulation.plan.allocations) {
        assert.ok(ids.includes(`F-${p.id}-${a.channel}`), `${p.id}/${a.channel}`);
      }
      assert.ok(ids.includes(`F-${p.id}-RACKVIDD`));
    }
  }
});

test("samma förfrågan ger samma planer", () => {
  const again = generatePlans(FIXTURE_REQUEST);
  assert.deepEqual(
    again.plans.map((p) => p.simulation.plan.allocations),
    b2c.plans.map((p) => p.simulation.plan.allocations)
  );
});

test("ogiltig budget ger fel", () => {
  const bad: PlanRequest = { ...FIXTURE_REQUEST, budgetSek: 0 };
  assert.throws(() => generatePlans(bad));
});
