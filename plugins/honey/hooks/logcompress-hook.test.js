"use strict";
// End-to-end tests for the entry-time GC hook: spawn it as Claude Code would,
// feed PostToolUse JSON on stdin, assert on stdout + the CCR cache.
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HOOK = path.join(__dirname, "logcompress-hook.js");
const ESO = path.join(__dirname, "..", "bin", "eso.js");

function runHook(toolOutput, { mode = "full" } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "honey-gc-test-"));
  const ccrDir = path.join(tmp, "ccr");
  fs.writeFileSync(path.join(tmp, ".honey-active"), mode);
  const stdout = execFileSync("node", [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_response: { stdout: toolOutput } }),
    env: { ...process.env, CLAUDE_CONFIG_DIR: tmp, HONEY_CCR_DIR: ccrDir },
    encoding: "utf8",
  });
  return { stdout, ccrDir };
}

const bigArray = Array.from({ length: 50 }, (_, i) => ({
  id: i, level: i === 37 ? "error" : "info", msg: `event ${i} on worker ${i % 4}`,
}));
const bigArrayJson = JSON.stringify(bigArray);

test("big uniform JSON array is crushed, stashed, and retrievable", () => {
  const { stdout, ccrDir } = runHook(bigArrayJson);
  const out = JSON.parse(stdout).hookSpecificOutput;
  assert.strictEqual(out.hookEventName, "PostToolUse");

  const [viewJson, note] = out.updatedToolOutput.split("\n[honey: ");
  const view = JSON.parse(viewJson);
  assert.ok(view.length < bigArray.length, "view is smaller than the original");
  assert.ok(view.some((r) => r.id === 37), "anomaly row survives the crush");
  assert.ok(view.some((r) => typeof r._ccr === "string"), "sentinel present");

  const hash = note.match(/eson retrieve ([0-9a-f]{16})/)[1];
  const restored = execFileSync("node", [ESO, "retrieve", hash], {
    env: { ...process.env, HONEY_CCR_DIR: ccrDir },
    encoding: "utf8",
  });
  assert.deepStrictEqual(JSON.parse(restored), bigArray, "retrieve restores the original");
});

test("small output passes through untouched", () => {
  const { stdout } = runHook(JSON.stringify([{ a: 1 }, { a: 2 }]));
  assert.strictEqual(stdout, "");
});

test("honey off → passthrough even for big arrays", () => {
  const { stdout } = runHook(bigArrayJson, { mode: "off" });
  assert.strictEqual(stdout, "");
});

test("guard entry file stays parseable on old node (no ??/?./arrows/templates/bare catch)", () => {
  const src = fs.readFileSync(HOOK, "utf8").replace(/\/\/[^\n]*/g, ""); // strip comments
  for (const [re, what] of [
    [/\?\?/, "nullish coalescing"],
    [/\?\./, "optional chaining"],
    [/=>/, "arrow function"],
    [/`/, "template literal"],
    [/catch\s*\{/, "optional catch binding"],
    [/\b(const|let)\b/, "const/let"],
  ]) {
    assert.ok(!re.test(src), `guard must not use ${what} — old node fails at parse`);
  }
});

test("repetitive non-JSON text falls back to line collapse", () => {
  const lines = Array.from({ length: 40 }, () => "retrying connection to db-01...").join("\n");
  const { stdout } = runHook(lines);
  const out = JSON.parse(stdout).hookSpecificOutput.updatedToolOutput;
  assert.match(out, /⟨×40⟩/);
  assert.match(out, /eson retrieve [0-9a-f]{16}/);
});
