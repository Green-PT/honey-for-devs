#!/usr/bin/env node
"use strict";
// Re-score every judged record of a stamp from its saved raw replies and write the panel
// back into results.json — no regeneration. Use after a judge-side apparatus fix.
//   JUDGE_MODELS=a,b,c node src/rejudge-stamp.js <stamp>
const fs = require("fs");
const path = require("path");
const { judge } = require("./judge");

const ROOT = path.join(__dirname, "..");
const stamp = process.argv[2];
const MODELS = (process.env.JUDGE_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!stamp || !MODELS.length) {
  console.error("usage: JUDGE_MODELS=a,b,c node src/rejudge-stamp.js <stamp>");
  process.exit(1);
}
const dir = path.join(ROOT, "results", stamp);
const file = path.join(dir, "results.json");
const j = JSON.parse(fs.readFileSync(file, "utf8"));
const prompts = {};
const promptOf = (id) =>
  (prompts[id] = prompts[id] || fs.readFileSync(path.join(ROOT, j.meta.tasks_dir || "tasks", id, "prompt.md"), "utf8").trim());
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return !s.length ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

(async () => {
  const todo = j.records.filter((r) => r.type !== "relay");
  let i = 0, done = 0, nulls = 0;
  const worker = async () => {
    while (i < todo.length) {
      const r = todo[i++];
      const raw = fs.readFileSync(path.join(dir, "raw", `${r.variant}__${r.task}__r${r.run}.md`), "utf8");
      const panel = await Promise.all(MODELS.map((m) =>
        judge({ model: m, taskPrompt: promptOf(r.task), candidateOutput: raw, type: r.type || "code" })
          .then((x) => ({ model: m, ...x }))));
      const scores = panel.map((p) => p.score).filter((s) => s != null);
      nulls += panel.length - scores.length;
      Object.assign(r, {
        judge: median(scores),
        judge_min: scores.length ? Math.min(...scores) : null,
        judge_max: scores.length ? Math.max(...scores) : null,
        judges: Object.fromEntries(panel.map((p) => [p.model, p.score])),
        judge_note: panel[0] ? panel[0].note : "",
      });
      fs.writeFileSync(file, JSON.stringify(j, null, 2)); // checkpoint every record
      process.stdout.write(`\r${++done}/${todo.length} null scores: ${nulls}   `);
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.CONCURRENCY || 6) }, worker));
  console.log(`\nrejudged ${stamp}: ${done} records, ${nulls} null scores`);
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
