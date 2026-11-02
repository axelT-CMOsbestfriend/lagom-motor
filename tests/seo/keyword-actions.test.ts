import { test } from "node:test";
import assert from "node:assert/strict";
import { keywordActions } from "../../lib/seo/run";

const kw = (keyword: string, targetPage: string, volume: string, pageExists = false) => ({
  keyword,
  intent: "köp" as const,
  targetPage,
  pageExists,
  volume: `uppskattning: ${volume}`,
});

test("sökord till samma sida blir en åtgärd, och befintliga sidor byggs ut", () => {
  const actions = keywordActions(
    [kw("varumärkesstrategi konsult", "/kontakt", "medel"), kw("anlita varumärkesstrateg", "/kontakt", "låg"), kw("geo-test gratis", "/verktyg/geo-test", "medel")],
    new Set(["/", "/kontakt"])
  );
  assert.equal(actions.length, 2);
  const kontakt = actions.find((a) => a.title.includes("/kontakt"))!;
  assert.match(kontakt.title, /^Bygg ut sidan \/kontakt så att den täcker "varumärkesstrategi konsult", "anlita varumärkesstrateg"/);
  assert.equal(kontakt.effortHours, 2);
  assert.match(actions.find((a) => a.title.includes("geo-test"))!.title, /^Skapa sidan/);
});

test("högst tre sökordsåtgärder, de med störst volym först", () => {
  const actions = keywordActions(
    ["/a", "/b", "/c", "/d", "/e"].map((p, i) => kw(`ord ${i}`, p, i === 4 ? "hög" : "låg")),
    new Set()
  );
  assert.equal(actions.length, 3);
  assert.match(actions[0].title, /\/e/);
});

test("sökord som redan täcks eller saknar köpavsikt ger ingen åtgärd", () => {
  const info = { ...kw("vad är seo", "/blogg", "hög"), intent: "info" as const };
  assert.deepEqual(keywordActions([kw("finns redan", "/", "hög", true), info], new Set(["/"])), []);
});
