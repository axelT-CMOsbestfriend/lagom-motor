import { test } from "node:test";
import assert from "node:assert/strict";
import { CHANNELS } from "../../lib/media/channels";
import { dailyReach } from "../../lib/media/data/mediebarometern-2024";
import { channelAudience, createPanel, type TargetGroup } from "../../lib/media/panel";
import { nbdHead, simulatePlan, type MediaPlan } from "../../lib/media/reach";

const TARGET_25_44: TargetGroup = { ageMin: 25, ageMax: 44, genders: ["kvinna", "man"] };
const panel = createPanel(TARGET_25_44, { size: 5000, seed: 3 });

function plan(allocations: MediaPlan["allocations"]): MediaPlan {
  return { name: "test", allocations };
}

test("NBD med k=1: medelvärde 1 ger 50 % noll exponeringar", () => {
  const [p0, p1, p2] = nbdHead(1, 1);
  assert.ok(Math.abs(p0 - 0.5) < 1e-12);
  assert.ok(Math.abs(p1 - 0.25) < 1e-12);
  assert.ok(Math.abs(p2 - 0.125) < 1e-12);
  assert.deepEqual(nbdHead(0), [1, 0, 0]);
});

test("NBD närmar sig Poisson när k blir stort", () => {
  const [p0] = nbdHead(2, 1e6);
  assert.ok(Math.abs(p0 - Math.exp(-2)) < 1e-4);
});

// Handräknat fall: visningar = antal Facebookanvändare i målgruppen ⇒
// 1 exponering i snitt ⇒ hälften av användarna nås (k = 1)
test("känt svar: Facebook mot kvinnor 25–29 år", () => {
  const target: TargetGroup = { ageMin: 25, ageMax: 29, genders: ["kvinna"] };
  const p = createPanel(target, { size: 20_000, seed: 11 });
  const audience = channelAudience(target, "facebook");
  const cpmMid = (CHANNELS.facebook.cpmSek.low + CHANNELS.facebook.cpmSek.high) / 2;
  const result = simulatePlan(p, plan([{ channel: "facebook", budgetSek: (audience * cpmMid) / 1000 }]));
  const expected = dailyReach("facebook", "25-44", "kvinna") * 0.5;
  assert.ok(Math.abs(result.mid.reachShare - expected) < 0.015, `${result.mid.reachShare} mot ${expected}`);
  assert.ok(Math.abs(result.mid.avgFrequency - 2) < 1e-9);
  assert.equal(result.mid.channels[0].targetShareOfImpressions, 1);
});

test("noll budget ger noll räckvidd", () => {
  const r = simulatePlan(panel, plan([{ channel: "instagram", budgetSek: 0 }]));
  assert.equal(r.mid.reachShare, 0);
  assert.equal(r.mid.effectiveReachShare, 0);
});

test("räckvidd ökar med budget men avtagande (dubbel budget < dubbel räckvidd)", () => {
  const reach = (budget: number) =>
    simulatePlan(panel, plan([{ channel: "instagram", budgetSek: budget }])).mid.reachShare;
  const r50 = reach(50_000);
  const r100 = reach(100_000);
  const r200 = reach(200_000);
  assert.ok(r50 < r100 && r100 < r200);
  assert.ok(r200 < 2 * r100);
});

test("en kanal kan aldrig nå fler än de som använder den", () => {
  const users =
    panel.personas.filter((p) => p.channels.includes("linkedin")).length / panel.personas.length;
  const r = simulatePlan(panel, plan([{ channel: "linkedin", budgetSek: 50_000_000 }]));
  assert.ok(r.mid.reachShare <= users + 1e-9);
  assert.ok(r.mid.reachShare > users * 0.95);
});

test("effektiv räckvidd (3+) är alltid lägre än räckvidd (1+)", () => {
  const r = simulatePlan(
    panel,
    plan([
      { channel: "facebook", budgetSek: 80_000 },
      { channel: "youtube", budgetSek: 60_000 },
      { channel: "reklamradio", budgetSek: 60_000 },
    ])
  );
  for (const s of [r.low, r.mid, r.high]) {
    assert.ok(s.effectiveReachShare < s.reachShare);
  }
});

test("dyra CPM:er ger lägre räckvidd än billiga (low ≤ mid ≤ high)", () => {
  const r = simulatePlan(panel, plan([{ channel: "tiktok", budgetSek: 100_000 }]));
  assert.ok(r.low.reachShare <= r.mid.reachShare && r.mid.reachShare <= r.high.reachShare);
});

test("ej riktbar kanal har spill, riktbar har inget", () => {
  const r = simulatePlan(
    panel,
    plan([
      { channel: "tv4", budgetSek: 100_000 },
      { channel: "instagram", budgetSek: 100_000 },
    ])
  );
  const tv4 = r.mid.channels.find((c) => c.channel === "tv4")!;
  const ig = r.mid.channels.find((c) => c.channel === "instagram")!;
  assert.ok(tv4.targetShareOfImpressions > 0.05 && tv4.targetShareOfImpressions < 0.5);
  assert.equal(ig.targetShareOfImpressions, 1);
});

test("Tiktok når inte pensionärer oavsett budget", () => {
  const seniors = createPanel({ ageMin: 65, ageMax: 84, genders: ["kvinna", "man"] }, { size: 5000 });
  const r = simulatePlan(seniors, plan([{ channel: "tiktok", budgetSek: 10_000_000 }]));
  assert.ok(r.mid.reachShare < 0.04, String(r.mid.reachShare));
});

test("två kanaler når fler än var och en, men färre än summan (dubbelräkning)", () => {
  const fb = simulatePlan(panel, plan([{ channel: "facebook", budgetSek: 100_000 }])).mid.reachShare;
  const yt = simulatePlan(panel, plan([{ channel: "youtube", budgetSek: 100_000 }])).mid.reachShare;
  const both = simulatePlan(
    panel,
    plan([
      { channel: "facebook", budgetSek: 100_000 },
      { channel: "youtube", budgetSek: 100_000 },
    ])
  ).mid.reachShare;
  assert.ok(both > Math.max(fb, yt));
  assert.ok(both < fb + yt);
});

test("dubbla rader för samma kanal slås ihop", () => {
  const split = simulatePlan(
    panel,
    plan([
      { channel: "snapchat", budgetSek: 30_000 },
      { channel: "snapchat", budgetSek: 20_000 },
    ])
  );
  const single = simulatePlan(panel, plan([{ channel: "snapchat", budgetSek: 50_000 }]));
  assert.equal(split.mid.reachShare, single.mid.reachShare);
  assert.equal(split.mid.channels.length, 1);
});

test("resultatet redovisar overifierade CPM-antaganden för använda kanaler", () => {
  const r = simulatePlan(
    panel,
    plan([
      { channel: "podd", budgetSek: 40_000 },
      { channel: "tv4play", budgetSek: 0 },
    ])
  );
  const ids = r.assumptions.map((a) => a.id);
  assert.ok(ids.includes("cpm-podd"));
  assert.ok(!ids.includes("cpm-tv4play"));
  assert.ok(r.assumptions.some((a) => !a.verified));
});

test("ogiltig budget och okänd kanal ger fel", () => {
  assert.throws(() => simulatePlan(panel, plan([{ channel: "facebook", budgetSek: -1 }])));
  assert.throws(() =>
    simulatePlan(panel, plan([{ channel: "myspace" as never, budgetSek: 1000 }]))
  );
});
