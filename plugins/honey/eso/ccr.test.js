"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { crush, strip, isSentinel, hashOf } = require("./ccr");

const logs = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  level: i % 7 === 0 ? "warn" : "info",
  message: `seq ${i}`,
}));

test("crushes a large redundant array and leaves one sentinel", () => {
  const { view, hash, dropped } = crush(logs);
  assert.ok(view.length <= 16, `view ${view.length} should be capped`);
  assert.equal(dropped, logs.length - (view.length - 1));
  assert.equal(view.filter(isSentinel).length, 1);
  assert.equal(view.at(-1)[require("./ccr").SENTINEL_KEY], `<<ccr:${hash} ${dropped}_rows_offloaded>>`);
});

test("keeps change-points (every warn row survives sampling)", () => {
  const kept = strip(crush(logs).view);
  const warns = kept.filter((r) => r.level === "warn").length;
  assert.ok(warns >= 5, `expected several warn rows kept, got ${warns}`);
});

test("passes through arrays below minItems untouched", () => {
  const small = logs.slice(0, 3);
  const { view, hash, dropped } = crush(small);
  assert.equal(view, small);
  assert.equal(hash, null);
  assert.equal(dropped, 0);
});

test("strip removes sentinels, leaving uniform records", () => {
  const cleaned = strip(crush(logs).view);
  assert.ok(cleaned.every((r) => "id" in r));
});

test("rejects non-array input", () => {
  assert.throws(() => crush({ not: "an array" }), TypeError);
});

test("hash is stable for identical input", () => {
  assert.equal(hashOf(logs), hashOf(logs.slice()));
});

test("CLI crush caches originals and retrieve restores them losslessly", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccr-"));
  const bin = path.join(__dirname, "..", "bin", "eso.js");
  const env = { ...process.env, HONEY_CCR_DIR: dir };
  const view = JSON.parse(execFileSync("node", [bin, "crush"], { input: JSON.stringify(logs), env }));
  const sentinel = view.find(isSentinel)[require("./ccr").SENTINEL_KEY];
  const hash = sentinel.match(/<<ccr:(\w+) /)[1];
  const restored = JSON.parse(execFileSync("node", [bin, "retrieve", hash], { env }));
  assert.deepEqual(restored, logs);
  fs.rmSync(dir, { recursive: true, force: true });
});
