"use strict";
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { memoryIssues, fidelity, MEMORY_LINES } = require("../bin/check");
const { compress } = require("../hooks/precompress");

test("memory: flags each broken pattern once, and nothing in a healthy file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "honey-check-"));
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "real.js"), "");
  const mem = path.join(root, "memory");
  fs.mkdirSync(mem);
  fs.writeFileSync(path.join(mem, "kept.md"), "x");
  fs.writeFileSync(path.join(mem, "orphan.md"), "x");
  const index = ["- [Kept](kept.md) — fine", "- [Gone](gone.md) — dead"];
  while (index.length <= MEMORY_LINES) index.push(`- entry ${index.length}`);
  fs.writeFileSync(path.join(mem, "MEMORY.md"), index.join("\n"));
  const rule = "Always run the full test suite before you commit anything.";
  fs.writeFileSync(path.join(root, "CLAUDE.md"), [
    "@./missing.md", "@AGENTS.md", "Email me@example.com and @someone.",
    "See `src/real.js` and `src/gone.js`.", "We removed `src/old.js` on purpose.",
    "```", "@./in-a-code-block.md", "```", rule,
  ].join("\n"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), `- ${rule}`);

  const issues = memoryIssues([path.join(root, "CLAUDE.md"), path.join(root, "AGENTS.md"), path.join(mem, "MEMORY.md")], root);
  const kinds = issues.map((x) => x.kind).sort();
  assert.deepStrictEqual(kinds, ["broken-import", "dead-link", "duplicate", "orphan", "stale-path", "truncated"], JSON.stringify(issues, null, 1));
  assert.match(issues.find((x) => x.kind === "stale-path").msg, /src\/gone\.js/);
  assert.strictEqual(issues.find((x) => x.kind === "truncated").line, MEMORY_LINES + 1);
});

test("fidelity: a faithful, smaller rewrite passes", () => {
  const original = "Please note that you should never push to `main`. Always run `npm test` (takes about 40 seconds) first. Docs: https://example.com/x";
  const rewritten = "Never push to `main`. Always run `npm test` (~40 seconds) first. Docs: https://example.com/x";
  assert.deepStrictEqual(fidelity(original, rewritten).problems, []);
});

test("fidelity: lost numbers, code, negations, safety words and growth all fail", () => {
  const original = "Never delete the `prod` table. Retry 3 times. Do not log tokens.";
  const problems = fidelity(original, "Retry the `prod` table, and feel free to log tokens freely, many many times over.").problems.join("\n");
  assert.match(problems, /number lost: 3/);
  assert.match(problems, /negations dropped/);
  assert.match(problems, /safety words dropped/);
  assert.match(problems, /not smaller/);
  assert.match(fidelity("Run `a`.", "Run it.").problems.join(), /inline code lost: `a`/);
});

test("precompress keeps every fact honey-check guards", () => {
  for (const input of [
    "Hi! Please could you basically fix `parseQuery()` — it must never return null, thanks!",
    "Honestly, just run `pytest -q` 3 times; don't touch https://example.com/api or the secrets file.",
  ]) {
    const { problems } = fidelity(input, compress(input).text);
    assert.deepStrictEqual(problems, [], input);
  }
});
