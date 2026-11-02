import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("putDoc och getDoc sparar och läser samma dokument", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "mp-db-"));
  const cwd = process.cwd();
  process.chdir(dir); // filbackenden lägger data/ i arbetskatalogen
  try {
    const { putDoc, getDoc } = await import("../lib/db");
    await putDoc("orders", "abc-123", { status: "queued", n: 1 });
    assert.deepEqual(await getDoc("orders", "abc-123"), { status: "queued", n: 1 });
    assert.equal(await getDoc("orders", "finns-inte"), null);
    assert.equal(await getDoc("orders", "../etc/passwd"), null);
  } finally {
    process.chdir(cwd);
  }
});
