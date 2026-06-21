#!/usr/bin/env node
"use strict";
// Re-run the code grader against saved raw replies and update results.json in place. Lets you
// fix extraction/grading without re-spending on the API. Judge/usage are left untouched.
//   node src/regrade-code.js opus48 code2
const fs = require("fs");
const path = require("path");
const { extractCode } = require("./extract");
const { grade } = require("./grade");

const ROOT = path.join(__dirname, "..");
const metaCache = {};
const taskOf = (id) => {
  if (!metaCache[id]) {
    const base = path.join(ROOT, "tasks", id);
    const meta = JSON.parse(fs.readFileSync(path.join(base, "meta.json"), "utf8"));
    metaCache[id] = { meta, testPath: meta.test_file ? path.join(base, meta.test_file) : null };
  }
  return metaCache[id];
};

for (const stamp of process.argv.slice(2)) {
  const dir = path.join(ROOT, "results", stamp);
  const j = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
  let changed = 0;
  for (const r of j.records) {
    if ((r.type || "code") === "web") continue;
    const task = taskOf(r.task);
    const lang = task.meta.lang === "python" ? "python" : "javascript";
    const raw = fs.readFileSync(path.join(dir, "raw", `${r.variant}__${r.task}__r${r.run}.md`), "utf8");
    const g = grade(task, extractCode(raw, lang));
    if (r.passed !== g.passed) changed++;
    r.passed = g.passed;
    r.grade_detail = g.detail;
  }
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify(j, null, 2));
  console.log(`regraded ${stamp}: ${changed} cells changed`);
}
