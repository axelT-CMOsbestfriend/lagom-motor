import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "../lib/claude";

test("rå radbrytningar och tabbar inuti strängar tolkas ändå", () => {
  const raw = 'Här är svaret:\n{"summary": "Rad ett\nrad två\tmed tabb", "gaps": [{"title": "Citat \\"inne\\""}]}';
  const parsed = extractJson<{ summary: string; gaps: { title: string }[] }>(raw);
  assert.equal(parsed.summary, "Rad ett\nrad två\tmed tabb");
  assert.equal(parsed.gaps[0].title, 'Citat "inne"');
});

test("giltig JSON med radbrytningar mellan fälten lämnas orörd", () => {
  assert.deepEqual(extractJson('{\n  "a": 1,\n  "b": "x\\ny"\n}'), { a: 1, b: "x\ny" });
});

test("svar helt utan JSON ger ett tydligt fel", () => {
  assert.throws(() => extractJson("inget här"), /inget giltigt JSON-svar/);
});
