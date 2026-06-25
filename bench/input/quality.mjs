// Output-quality gate for the input precompressor, on the bench we built.
// Does the model produce as-good OUTPUT from the COMPRESSED prompt as from the FULL prompt?
// Two signals:
//   - objective: extract the reply's code and run the task's REAL unit test (grade.js) — pass/fail
//   - judge: panel scores each reply against the ORIGINAL prompt (any drop = info lost in compression)
//
//   ANTHROPIC_API_KEY=... OPENAI_API_KEY=... node bench/input/quality.mjs
//   node bench/input/quality.mjs --mock      # offline pipeline check, no API
//
// Env: MODEL (default claude-opus-4-8), JUDGE_MODELS (comma list = panel median), RUNS.
import { readFileSync, existsSync, appendFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { encode } from "gpt-tokenizer";

const require = createRequire(import.meta.url);
const { compress } = require("../../hooks/precompress.js");
const { extractInfo } = require("../src/extract.js");
const { grade } = require("../src/grade.js");

const HERE = dirname(fileURLToPath(import.meta.url));
const TASKS = join(HERE, "..", "tasks");
const MOCK = process.argv.includes("--mock");
const MODEL = process.env.MODEL || "claude-opus-4-8";
const RUNS = Number(process.env.RUNS || 1);
const JUDGES = (process.env.JUDGE_MODELS || MODEL).split(",").map((s) => s.trim()).filter(Boolean);

let complete, judge;
if (MOCK) {
  // Stand-in: echo a code block with the task's reference so the real grader passes.
  complete = async ({ user, _ref }) => ({ text: `\`\`\`\n${_ref || "x"}\n\`\`\``, usage: { input: encode(user).length, output: 20 } });
  judge = async ({ candidateOutput }) => ({ score: 95 - (candidateOutput.length % 3), note: "mock" });
} else {
  ({ complete } = require("../src/client.js"));
  ({ judge } = require("../src/judge.js"));
}

// load a bench task (meta + test path + lang) by id, or null if it has no grader
function loadTask(id) {
  if (!id) return null;
  const base = join(TASKS, id);
  const metaPath = join(base, "meta.json");
  if (!existsSync(metaPath)) return null;
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  return { meta, testPath: join(base, meta.test_file), refPath: join(base, `reference.${meta.lang === "python" ? "py" : "js"}`) };
}

const corpus = JSON.parse(readFileSync(join(HERE, process.env.CORPUS || "corpus.json")));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const panelScore = async (taskPrompt, candidateOutput) =>
  median((await Promise.all(JUDGES.map((m) => judge({ model: m, taskPrompt, candidateOutput, type: "code" })))).map((r) => r.score));

const pct = (xs) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) + "%" : "—");
const CKPT = join(HERE, "full-run.jsonl"); // durable per-row checkpoint (survives a kill)
writeFileSync(CKPT, "");

async function runOne(c) {
  const task = loadTask(c.task);
  const lang = task ? (task.meta.lang === "python" ? "python" : "javascript") : "javascript";
  const ref = task && MOCK ? readFileSync(task.refPath, "utf8").trim() : null;
  const { text: comp } = compress(c.prompt);
  const fullTok = encode(c.prompt).length, compTok = encode(comp).length;

  let sf = [], sc = [], pf = [], pc = [];
  for (let r = 0; r < RUNS; r++) {
    const [rf, rc] = await Promise.all([
      complete({ model: MODEL, system: null, user: c.prompt, maxTokens: 1024, _ref: ref }),
      complete({ model: MODEL, system: null, user: comp, maxTokens: 1024, _ref: ref }),
    ]);
    sf.push(await panelScore(c.prompt, rf.text));
    sc.push(await panelScore(c.prompt, rc.text));
    if (task) {
      pf.push(grade(task, extractInfo(rf.text, lang).code).passed ? 1 : 0);
      pc.push(grade(task, extractInfo(rc.text, lang).code).passed ? 1 : 0);
    }
  }
  return {
    id: c.id, graded: !!task,
    cut: ((1 - compTok / fullTok) * 100).toFixed(0) + "%",
    passF: pct(pf), passC: pct(pc),
    jf: median(sf), jc: median(sc), delta: median(sc) - median(sf),
  };
}

// limited-concurrency map so 20 prompts don't run fully serial; stream + checkpoint each row
async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

const w = (s, n) => String(s).padEnd(n);
console.log(`${MOCK ? "[MOCK] " : ""}model=${MODEL} judge=${JUDGES.join("+")} runs=${RUNS}  (graded=objective unit test)\n`);
let done = 0;
const rows = await pmap(corpus, MOCK ? 8 : 5, async (c) => {
  const r = await runOne(c);
  appendFileSync(CKPT, JSON.stringify(r) + "\n");
  console.error(`[${++done}/${corpus.length}] ${r.id} cut=${r.cut} test ${r.passF}->${r.passC} judge ${r.jf}->${r.jc}`);
  return r;
});
console.log(w("id", 18) + w("cut", 6) + w("test_full", 11) + w("test_comp", 11) + w("judge_f", 9) + w("judge_c", 9) + "Δ");
for (const r of rows)
  console.log(w(r.id, 18) + w(r.cut, 6) + w(r.passF, 11) + w(r.passC, 11) + w(r.jf, 9) + w(r.jc, 9) + (r.delta >= 0 ? "+" : "") + r.delta);

const graded = rows.filter((r) => r.graded);
const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const passF = avg(graded.map((r) => parseInt(r.passF)));
const passC = avg(graded.map((r) => parseInt(r.passC)));
const cuts = rows.map((r) => parseFloat(r.cut)), deltas = rows.map((r) => r.delta);
console.log("-".repeat(73));
console.log(
  `median input cut: ${median(cuts)}%   ` +
    `test-pass full→comp: ${graded.length ? `${passF}%→${passC}%` : "n/a (judge-only)"}   ` +
    `median judge Δ: ${median(deltas) >= 0 ? "+" : ""}${median(deltas)}   worst judge drop: ${Math.min(...deltas)}`
);

// Gate: meaningful cut, judge within noise, and — only when tasks carry the contract — objective
// test-pass not lower. Paraphrased prompts have no graded tasks, so the objective term is skipped
// (grading a prompt that lacks the export contract measures the missing contract, not compression).
const objectiveOk = graded.length === 0 || passC >= passF - 5;
const pass = median(cuts) >= 10 && objectiveOk && median(deltas) >= -2 && Math.min(...deltas) >= -8;
console.log(`\nGATE: ${pass ? "PASS ✅" : "FAIL ❌"}  (cut≥10% · judge Δ≥−2 · worst≥−8${graded.length ? " · test-pass≥full−5" : ""})`);
process.exitCode = pass ? 0 : 1;
