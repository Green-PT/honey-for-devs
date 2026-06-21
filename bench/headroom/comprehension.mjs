import fs from "node:fs";
import { createRequire } from "node:module";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";

const require = createRequire(import.meta.url);
const { complete } = require("../src/client.js");
const { crush, strip, isSentinel } = require("../../eso/ccr.js");

// CCR is lossy. Token savings are settled by run.mjs; this measures the half that
// matters for lossy compaction: with the crushed view (and a retrieve escape
// hatch), can a model still answer? Three conditions × three question classes:
//   full              — whole array in context (baseline, expect ~100%)
//   crushed           — sampled view only; quantifies what dropping costs
//   crushed+retrieve  — view + a RETRIEVE escape hatch; tests the CCR premise
// Classes: SIGNAL (answer in a kept anomaly), DROPPED (answer offloaded),
// AGGREGATE (derivable from kept rows + the sentinel's dropped count).

// 90-row log: mostly "info", "error" anomalies at a few ids (kept as
// change-points), unique message per row. Deterministic — no randomness.
const ERRORS = new Set([3, 31, 58, 86]);
const logs = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  level: ERRORS.has(i) ? "error" : "info",
  message: `event ${i} on worker ${i % 5}`,
}));

const { view } = crush(logs);
const keptIds = new Set(strip(view).map((r) => r.id));
const droppedInfo = logs.find((r) => r.level === "info" && !keptIds.has(r.id));
const keptErrors = logs.filter((r) => r.level === "error" && keptIds.has(r.id));
if (!droppedInfo || keptErrors.length < 2) throw new Error("corpus did not produce a dropped-info row and ≥2 kept-error rows");

const norm = (s) => String(s).toLowerCase().replace(/[\s."'`]+/g, " ").trim();
const hit = (got, a) => norm(got) === norm(a) || norm(got).split(" ").includes(norm(a));

// SIGNAL = lookup of a kept anomaly row. AGGREGATE = derivable from kept rows +
// sentinel count (includes counting tasks, a known model weakness — kept here to
// separate that from CCR loss). DROPPED = answer offloaded; only retrieve recovers.
const questions = [
  { cls: "SIGNAL", q: `What is the \`message\` of the row whose \`id\` is ${keptErrors[0].id}? Answer with only that string.`, a: keptErrors[0].message },
  { cls: "SIGNAL", q: `What is the \`message\` of the row whose \`id\` is ${keptErrors[1].id}? Answer with only that string.`, a: keptErrors[1].message },
  { cls: "AGGREGATE", q: `How many rows have \`level\` "error"? Answer with only the number.`, a: String(ERRORS.size) },
  { cls: "AGGREGATE", q: `How many rows are in the original log in total? Answer with only the number.`, a: String(logs.length) },
  { cls: "DROPPED", q: `What is the \`message\` of the row whose \`id\` is ${droppedInfo.id}? Answer with only that string.`, a: droppedInfo.message },
  { cls: "DROPPED", q: `What is the \`level\` of the row whose \`id\` is ${droppedInfo.id}? Answer with one word.`, a: droppedInfo.level },
];

const fullText = JSON.stringify(logs);
const viewText = JSON.stringify(view);

const baseSys =
  "You read a JSON array of log rows and answer a question. " +
  "Answer with ONLY the requested value — no explanation, no punctuation, no units.";
const ccrSys =
  baseSys +
  " The array may be CRUSHED: a sampled subset plus a sentinel " +
  '{"_ccr":"<<ccr:HASH N_rows_offloaded>>"} meaning N further rows exist but are not shown.';
const retrieveSys =
  ccrSys +
  " If the crushed view does not contain the information needed to answer, " +
  "reply with exactly the single word RETRIEVE and nothing else.";

const models = (process.env.ESO_MODELS || "claude-opus-4-8,gpt-5.5")
  .split(",").map((m) => m.trim()).filter(Boolean);
const repeats = Number(process.env.ESO_REPEATS || 1);

async function ask(model, system, text, q) {
  const { text: out } = await complete({ model, system, user: `LOG:\n${text}\n\nQUESTION: ${q}`, maxTokens: 64 });
  return out.trim();
}

// condition runners return { got, retrieved }
const conditions = {
  full: (model, q) => ask(model, baseSys, fullText, q).then((got) => ({ got, retrieved: false })),
  crushed: (model, q) => ask(model, ccrSys, viewText, q).then((got) => ({ got, retrieved: false })),
  "crushed+retrieve": async (model, q) => {
    const first = await ask(model, retrieveSys, viewText, q);
    if (norm(first) === "retrieve") return { got: await ask(model, baseSys, fullText, q), retrieved: true };
    return { got: first, retrieved: false };
  },
};

const stats = {};
for (const c of Object.keys(conditions)) {
  stats[c] = { byCls: {}, retrieved: 0, total: 0, misses: [] };
  for (const { cls } of questions) stats[c].byCls[cls] ??= { correct: 0, total: 0 };
}

for (const model of models) {
  for (const [cname, run] of Object.entries(conditions)) {
    for (const item of questions) {
      for (let r = 0; r < repeats; r++) {
        let got, retrieved = false;
        try { ({ got, retrieved } = await run(model, item.q)); }
        catch (e) { got = `ERROR: ${e.message}`; }
        const ok = hit(got, item.a);
        const s = stats[cname];
        s.total += 1; if (retrieved) s.retrieved += 1;
        s.byCls[item.cls].total += 1;
        if (ok) s.byCls[item.cls].correct += 1;
        else s.misses.push({ model, cls: item.cls, want: item.a, got });
      }
    }
  }
}

const pct = (c, t) => (t ? `${((c / t) * 100).toFixed(0)}%` : "n/a");
const classes = [...new Set(questions.map((q) => q.cls))];
let report = `# CCR Comprehension — does the crushed view still answer?\n\n`;
report += `Models: ${models.join(", ")} · ${repeats} repeat(s) · ${questions.length} questions over a 90-row log.\n`;
report += `Tokens (o200k): full ${o200kTokens(fullText)} → crushed ${o200kTokens(viewText)} (${Math.round((o200kTokens(viewText) / o200kTokens(fullText) - 1) * 100)}%). `;
report += `Kept ${strip(view).length} rows, dropped ${logs.length - strip(view).length}.\n\n`;
report += `| Condition | ${classes.join(" | ")} | Overall | Retrieve rate |\n|---|${classes.map(() => "---:").join("|")}|---:|---:|\n`;
for (const [cname, s] of Object.entries(stats)) {
  const cells = classes.map((cl) => pct(s.byCls[cl].correct, s.byCls[cl].total));
  const oc = classes.reduce((a, cl) => a + s.byCls[cl].correct, 0);
  const ot = classes.reduce((a, cl) => a + s.byCls[cl].total, 0);
  report += `| ${cname} | ${cells.join(" | ")} | ${pct(oc, ot)} | ${pct(s.retrieved, s.total)} |\n`;
}
const misses = Object.entries(stats).flatMap(([c, s]) => s.misses.map((m) => ({ cond: c, ...m })));
if (misses.length) {
  report += `\n## Misses\n\n| Condition | Model | Class | Wanted | Got |\n|---|---|---|---|---|\n`;
  for (const m of misses) report += `| ${m.cond} | ${m.model} | ${m.cls} | \`${m.want}\` | \`${String(m.got).slice(0, 40)}\` |\n`;
}
report += `\nRun: \`ESO_MODELS=... ESO_REPEATS=3 node bench/headroom/comprehension.mjs\`. Requires API keys.\n`;

fs.writeFileSync(new URL("./COMPREHENSION.md", import.meta.url), report);
console.log(report);
