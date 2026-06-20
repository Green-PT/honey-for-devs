#!/usr/bin/env node
"use strict";
// Per-use-case breakdown: one small table per task, across all variants.
//   node src/bytask.js opus48 web48 code2
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ORDER = ["baseline", "caveman", "ponytail", "honey"];
const WEB_CATS = new Set(["landing-page", "ui-component"]);
const typeOf = (r) => r.type || (WEB_CATS.has(r.category) ? "web" : "code");
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const stamps = process.argv.slice(2);
if (!stamps.length) {
  console.error("usage: node src/bytask.js <stamp> [<stamp> ...]");
  process.exit(1);
}

let model = "";
const records = [];
for (const s of stamps) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, "results", s, "results.json"), "utf8"));
  model = model || j.meta.model;
  records.push(...j.records);
}

// group: task -> variant -> rows
const tasks = {};
for (const r of records) {
  const t = (tasks[r.task] ||= { category: r.category, type: typeOf(r), v: {} });
  (t.v[r.variant] ||= []).push(r);
}

// order tasks: code first then web, each alphabetical
const order = Object.keys(tasks).sort((a, b) => {
  const ta = tasks[a].type === "web" ? 1 : 0;
  const tb = tasks[b].type === "web" ? 1 : 0;
  return ta - tb || a.localeCompare(b);
});

let md = `# Per-use-case results\n\nmodel: \`${model}\` · sources: ${stamps.join(", ")}\n\n`;
md += `Output Δ and judge Δ are vs **baseline** for that task. "Tests" = unit test (code) or `;
md += `structural/a11y checklist (web).\n`;

for (const id of order) {
  const t = tasks[id];
  const base = t.v.baseline || [];
  const baseOut = mean(base.map((r) => r.usage.output)) || 0;
  const baseJudge = mean(base.filter((r) => r.judge != null).map((r) => r.judge)) || 0;
  const hasPanel = (t.v.baseline || []).some((r) => r.judge_min != null);
  md += `\n### ${id}  \`${t.type}\` · ${t.category}\n\n`;
  md += `| Variant | Tests | Judge${hasPanel ? " (panel range)" : ""} | Judge Δ | Output tok | Output Δ |\n`;
  md += `|---------|------:|------:|--------:|-----------:|---------:|\n`;
  for (const v of ORDER) {
    const rs = t.v[v];
    if (!rs || !rs.length) continue;
    const pass = Math.round(100 * mean(rs.map((r) => (r.passed ? 1 : 0))));
    const judged = rs.filter((r) => r.judge != null);
    const judge = mean(judged.map((r) => r.judge));
    const out = mean(rs.map((r) => r.usage.output));
    const jd = baseJudge ? Math.round(judge - baseJudge) : 0;
    const od = baseOut ? Math.round(100 * (out / baseOut - 1)) : 0;
    const jdS = v === "baseline" ? "—" : `${jd >= 0 ? "+" : ""}${jd}`;
    const odS = v === "baseline" ? "—" : `${od >= 0 ? "+" : ""}${od}%`;
    let jCell = judge.toFixed(0);
    if (hasPanel) {
      const lo = Math.min(...rs.filter((r) => r.judge_min != null).map((r) => r.judge_min));
      const hi = Math.max(...rs.filter((r) => r.judge_max != null).map((r) => r.judge_max));
      jCell += ` (${lo}–${hi})`;
    }
    md += `| ${v} | ${pass}% | ${jCell} | ${jdS} | ${Math.round(out).toLocaleString()} | ${odS} |\n`;
  }
}

const out = path.join(ROOT, "results", "by-task.md");
fs.writeFileSync(out, md);
console.log(md);
console.log(`written -> ${path.relative(path.join(ROOT, ".."), out)}`);
