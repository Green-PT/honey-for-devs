#!/usr/bin/env node
"use strict";
// Re-score saved replies with one or more judge models — no regeneration. Tests whether a
// quality delta is real or an artifact of a single (self-preferring) judge.
//   JUDGE_MODELS=claude-sonnet-4-6,claude-haiku-4-5-20251001 node src/rejudge.js opus48 median-bugfix
const fs = require("fs");
const path = require("path");
const { judge } = require("./judge");

const ROOT = path.join(__dirname, "..");
const ORDER = ["baseline", "caveman", "ponytail", "honey"];
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const [stamp, taskId] = process.argv.slice(2);
const judges = (process.env.JUDGE_MODELS || "claude-sonnet-4-6").split(",").map((s) => s.trim());
if (!stamp || !taskId) {
  console.error("usage: [JUDGE_MODELS=a,b] node src/rejudge.js <stamp> <task>");
  process.exit(1);
}

const base = path.join(ROOT, "tasks", taskId);
const meta = JSON.parse(fs.readFileSync(path.join(base, "meta.json"), "utf8"));
const prompt = fs.readFileSync(path.join(base, "prompt.md"), "utf8").trim();
const type = meta.type === "web" ? "web" : "code";
const dir = path.join(ROOT, "results", stamp);

(async () => {
  const orig = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8")).records.filter(
    (r) => r.task === taskId
  );
  const runs = [...new Set(orig.map((r) => r.run))].sort();

  // collect scores: model -> variant -> [scores]
  const scores = {};
  for (const jm of judges) {
    scores[jm] = {};
    for (const v of ORDER) {
      scores[jm][v] = [];
      for (const run of runs) {
        const raw = fs.readFileSync(path.join(dir, "raw", `${v}__${taskId}__r${run}.md`), "utf8");
        const { score } = await judge({ model: jm, taskPrompt: prompt, candidateOutput: raw, type });
        if (score != null) scores[jm][v].push(score);
      }
    }
  }

  // original (opus self-judge) means for reference
  const origMean = {};
  for (const v of ORDER) origMean[v] = mean(orig.filter((r) => r.variant === v).map((r) => r.judge));

  const cols = ["MODEL", ...ORDER];
  console.log(`\n${taskId} — judge means (n=${runs.length} per cell)\n`);
  console.log(cols.map((c, i) => (i ? c.padStart(11) : c.padEnd(34))).join(""));
  const row = (label, get) =>
    console.log([label.padEnd(34), ...ORDER.map((v) => get(v).toFixed(0).padStart(11))].join(""));
  row("opus-4-8 (original self-judge)", (v) => origMean[v]);
  for (const jm of judges) row(jm, (v) => mean(scores[jm][v]));
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
