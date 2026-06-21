#!/usr/bin/env node
"use strict";
// Sanity check: every task's reference solution must pass its own grader. Catches a
// broken test or signature before you spend API tokens. Run: npm run verify-tests
const fs = require("fs");
const path = require("path");
const { grade } = require("./grade");

const dir = path.join(__dirname, "..", "tasks");
let bad = 0;
for (const d of fs.readdirSync(dir)) {
  const metaPath = path.join(dir, d, "meta.json");
  if (!fs.existsSync(metaPath)) continue;
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (meta.type === "web" || meta.type === "relay") {
    console.log(`SKIP  ${d} (${meta.type}: no executable reference)`);
    continue;
  }
  const refPath = path.join(dir, d, `reference.${meta.lang === "python" ? "py" : "js"}`);
  const code = fs.readFileSync(refPath, "utf8");
  const r = grade({ meta, testPath: path.join(dir, d, meta.test_file) }, code);
  console.log(`${r.passed ? "PASS" : "FAIL"}  ${d}${r.passed ? "" : "\n      " + r.detail}`);
  if (!r.passed) bad++;
}
process.exit(bad ? 1 : 0);
