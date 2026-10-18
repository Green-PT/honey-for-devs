// Every manifest a host reads must carry package.json's version, so a release can't ship
// half-bumped (before 1.4.0 they ranged 1.1.0–1.3.1).
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MANIFESTS = [
  "gemini-extension.json",
  ".qoder-plugin/plugin.json",
  "plugins/honey/.codex-plugin/plugin.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  ".agents/plugins/marketplace.json",
  ".devin-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  "package-lock.json",
];

test("every manifest carries package.json's version", () => {
  const want = require(path.join(ROOT, "package.json")).version;
  for (const f of MANIFESTS) {
    const found = [...fs.readFileSync(path.join(ROOT, f), "utf8").matchAll(/"version":\s*"(\d+\.\d+\.\d+)"/g)].map((m) => m[1]);
    assert.ok(found.length, `${f}: no version field`);
    // package-lock lists dependency versions too; only its own (first two) entries are ours.
    for (const v of f === "package-lock.json" ? found.slice(0, 2) : found) assert.equal(v, want, `${f}: ${v} != ${want}`);
  }
});
