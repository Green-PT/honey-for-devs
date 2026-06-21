#!/usr/bin/env node
"use strict";
// Re-run the web grader against saved raw replies and update results.json in place.
// Judge scores and token usage are unchanged (grader-independent) — only passed/grade_detail
// are recomputed. Lets you fix the checklist without re-spending on the API.
//   node src/regrade-web.js web48
const fs = require("fs");
const path = require("path");
const { extractCode } = require("./extract");
const { gradeWeb } = require("./grade-web");

const ROOT = path.join(__dirname, "..");
const stamp = process.argv[2];
if (!stamp) {
  console.error("usage: node src/regrade-web.js <stamp>");
  process.exit(1);
}
const dir = path.join(ROOT, "results", stamp);
const j = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));

const metaCache = {};
const taskMeta = (id) =>
  (metaCache[id] ||= JSON.parse(
    fs.readFileSync(path.join(ROOT, "tasks", id, "meta.json"), "utf8")
  ));

let changed = 0;
for (const r of j.records) {
  if ((r.type || "") !== "web") continue;
  const raw = fs.readFileSync(path.join(dir, "raw", `${r.variant}__${r.task}__r${r.run}.md`), "utf8");
  let code = extractCode(raw, "html");
  if (!/<(html|body|main|section|div)\b/i.test(code)) code = raw;
  const g = gradeWeb({ meta: taskMeta(r.task) }, code);
  if (r.passed !== g.passed || r.grade_detail !== g.detail) changed++;
  r.passed = g.passed;
  r.grade_detail = g.detail;
}
fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify(j, null, 2));
console.log(`regraded ${stamp}: ${changed} cells changed`);
