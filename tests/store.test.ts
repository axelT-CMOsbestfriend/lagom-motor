import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("samtidiga events går inte förlorade", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mp-store-"));
  const cwd = process.cwd();
  process.chdir(dir); // filbackenden lägger data/ i arbetskatalogen
  try {
    const { logEvent } = await import("../lib/store");
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => logEvent("mediaplan_viewed", `a${i}`))
    );
    const files = readdirSync(path.join(dir, "data/events")).filter((f) => f.endsWith(".json"));
    assert.equal(files.length, 50);
  } finally {
    process.chdir(cwd);
  }
});
