#!/usr/bin/env node
"use strict";
// Harness benchmark: run each code task THROUGH the Cline CLI (its real agent loop, tool defs,
// context management) instead of one API call (src/run.js). Measures end-to-end agentic token
// cost INCLUDING the harness — the layer Cline's SDK rebuild targets. Tokens come from Cline's
// `run_result.aggregateUsage` (cumulative across turns).
//
//   ANTHROPIC_API_KEY=… node src/cline-bench.js --tasks flatten --runs 1
//   node src/cline-bench.js --honey off,compact,full        # payload axis
//   CLINE_BIN=/path/to/nightly/cline node src/cline-bench.js # stable-vs-nightly axis
//   node src/cline-bench.js --resume                         # skip cells already in results.json
//
// Honey is injected as a Cline rule (.clinerules/honey.md), NOT a system-prompt override, so
// Cline's harness prompt stays intact and we measure Honey *on top of* the harness. Payloads:
//   off     — no rule (control)
//   compact — skills/honey/cline-rule.md (the per-turn-cheap operational core; recommended)
//   full    — skills/honey/SKILL.md (whole skill; re-sent every turn, inflates input)
//
// Env: MODEL, PROVIDER (default anthropic), JUDGE_MODELS, RUNS, CLINE_TIMEOUT, CLINE_BIN, STAMP.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { grade } = require("./grade");
const eco = require("../../hooks/eco");

const ROOT = path.join(__dirname, "..");
const REPO = path.join(ROOT, "..");
const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : d;
};

const MODEL = process.env.MODEL || "claude-opus-4-8";
const PROVIDER = process.env.PROVIDER || "anthropic";
const KEY = process.env.ANTHROPIC_API_KEY || process.env.CLINE_KEY;
const CLINE_BIN = process.env.CLINE_BIN || "cline"; // point at a nightly build for the version axis
const RUNS = Number(process.env.RUNS || flag("runs", "1"));
const TIMEOUT = Number(process.env.CLINE_TIMEOUT || flag("timeout", "300"));
const RESUME = args.includes("--resume");
// payload axis: off | compact | full (default off,compact — full is opt-in, it inflates input)
const VARIANTS = (flag("honey", "off,compact")).split(",").map((s) => s.trim()).filter(Boolean);
const TASK_FILTER = flag("tasks") ? new Set(flag("tasks").split(",").map((s) => s.trim())) : null;
const JUDGE_MODELS = (process.env.JUDGE_MODELS || process.env.JUDGE_MODEL || MODEL)
  .split(",").map((s) => s.trim()).filter(Boolean);

if (!KEY) throw new Error("ANTHROPIC_API_KEY (or CLINE_KEY) is not set");

const PAYLOAD = {
  compact: path.join(REPO, "skills", "honey", "cline-rule.md"),
  full: path.join(REPO, "skills", "honey", "SKILL.md"),
};
const ruleText = (v) => (v === "off" ? null : fs.readFileSync(PAYLOAD[v], "utf8"));
const { judge } = require("./judge");

// code tasks only: agentic grading reads the file Cline writes, then runs the task's test.
function loadTasks() {
  const dir = path.join(ROOT, "tasks");
  return fs.readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "meta.json")))
    .map((d) => JSON.parse(fs.readFileSync(path.join(dir, d, "meta.json"), "utf8")))
    .filter((m) => m.solution_file && m.test_cmd && m.type !== "web" && m.type !== "relay")
    .filter((m) => !TASK_FILTER || TASK_FILTER.has(m.id))
    .map((m) => ({
      meta: m,
      prompt: fs.readFileSync(path.join(dir, m.id, "prompt.md"), "utf8").trim(),
      testPath: path.join(dir, m.id, m.test_file),
    }));
}

// Parse Cline's --json NDJSON. The final `run_result` event carries cumulative usage + text.
function parseCline(stdout) {
  let rr = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === "run_result") rr = o;
  }
  if (!rr) return null;
  const u = rr.aggregateUsage || rr.usage || {};
  return {
    text: rr.text || "",
    iterations: rr.iterations || null,
    finishReason: rr.finishReason || null,
    usage: {
      input: u.inputTokens || 0,
      output: u.outputTokens || 0,
      cache_read: u.cacheReadTokens || 0,
      cache_write: u.cacheWriteTokens || 0,
    },
    cost: u.totalCost ?? null,
  };
}

function runCline(prompt, cwd) {
  const r = spawnSync(
    CLINE_BIN,
    ["--json", "--auto-approve", "true", "-t", String(TIMEOUT),
     "-c", cwd, "-P", PROVIDER, "-m", MODEL, "-k", KEY, prompt],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: (TIMEOUT + 30) * 1000 }
  );
  return { stdout: r.stdout || "", stderr: r.stderr || "", status: r.status };
}

const cfg = eco.loadConfig();

async function runCell(task, variant, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cline-${task.meta.id}-`));
  try {
    const rule = ruleText(variant);
    if (rule) {
      fs.mkdirSync(path.join(dir, ".clinerules"), { recursive: true });
      fs.writeFileSync(path.join(dir, ".clinerules", "honey.md"), rule);
    }
    // Steer the agentic loop to write the graded file (the task prompts assume a code block).
    const prompt = `${task.prompt}\n\nCreate the file \`${task.meta.solution_file}\` in the current directory with your solution.`;
    const { stdout, stderr, status } = runCline(prompt, dir);
    const parsed = parseCline(stdout);
    if (!parsed) {
      return { variant, task: task.meta.id, type: "code", run, passed: false,
        grade_detail: `no run_result (status ${status}): ${(stderr || stdout).slice(-200)}`,
        usage: { input: 0, output: 0, cache_read: 0, cache_write: 0 }, gco2: 0, judge: null };
    }

    const solPath = path.join(dir, task.meta.solution_file);
    const code = fs.existsSync(solPath) ? fs.readFileSync(solPath, "utf8") : "";
    const g = grade(task, code); // reuses the exact same test execution as src/run.js

    const panel = await Promise.all(JUDGE_MODELS.map((m) =>
      judge({ model: m, taskPrompt: task.prompt, candidateOutput: code || parsed.text, type: "code" })
        .then((r) => ({ model: m, ...r })).catch(() => ({ model: m, score: null }))));
    const scores = panel.map((p) => p.score).filter((s) => s != null);

    return {
      variant, task: task.meta.id, category: task.meta.category, type: "code", run,
      usage: parsed.usage, cost: parsed.cost, iterations: parsed.iterations,
      gco2: eco.estimate(MODEL, parsed.usage.output, cfg).gco2,
      passed: g.passed, grade_detail: g.detail,
      judge: median(scores), judges: Object.fromEntries(panel.map((p) => [p.model, p.score])),
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const cellKey = (v, t, r) => `${v}__${t}__r${r}`;

(async () => {
  const tasks = loadTasks();
  const stamp = (process.env.STAMP || "cline").replace(/[^\w.-]/g, "_");
  const outDir = path.join(ROOT, "results", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "results.json");

  // resume: agentic runs are expensive and get killed; reload prior records and skip their cells.
  let records = [];
  if (RESUME && fs.existsSync(outFile)) {
    try { records = JSON.parse(fs.readFileSync(outFile, "utf8")).records || []; } catch {}
  }
  const done = new Set(records.map((r) => cellKey(r.variant, r.task, r.run)));

  const meta = { harness: "cline", cline_bin: CLINE_BIN, model: MODEL, provider: PROVIDER, runs: RUNS, variants: VARIANTS };
  const persist = () => fs.writeFileSync(outFile, JSON.stringify({ meta, records }, null, 2));

  const cells = [];
  for (const v of VARIANTS) for (const t of tasks) for (let r = 0; r < RUNS; r++)
    if (!done.has(cellKey(v, t.meta.id, r))) cells.push({ v, t, r });

  console.log(`harness=cline bin=${CLINE_BIN} model=${MODEL} provider=${PROVIDER} variants=${VARIANTS.join(",")} ` +
    `tasks=${tasks.length} runs=${RUNS} -> ${cells.length} new agent runs` +
    (done.size ? ` (${done.size} resumed)` : ""));

  let n = 0;
  for (const c of cells) { // serial: agentic runs are heavy and each spawns its own process
    const rec = await runCell(c.t, c.v, c.r);
    records.push(rec);
    persist(); // checkpoint every cell — a kill never loses completed work
    console.log(`${++n}/${cells.length}  cline-${c.v}/${c.t.meta.id}#${c.r} ` +
      `${rec.passed ? "pass" : "FAIL"} judge=${rec.judge} in=${rec.usage.input} out=${rec.usage.output} ` +
      `iters=${rec.iterations ?? "-"}`);
  }

  printSummary(records, VARIANTS);
  console.log(`\nresults -> ${path.relative(REPO, outFile)}`);
})().catch((e) => { console.error("\n" + (e.stack || e)); process.exit(1); });

// cache-aware $ — same model as src/report.js: cached input (rule re-read) bills at 10% of
// fresh. cached = steady state (rule prompt-cached after turn 1); cold = every turn billed fresh.
// Cline reports input = fresh, cache_read = cached portion, so they bracket the real cost.
function printSummary(records, variants) {
  const pricing = JSON.parse(fs.readFileSync(path.join(ROOT, "pricing.json"), "utf8"));
  const rate = pricing.rates.find((r) => MODEL.toLowerCase().includes(r.match)) || pricing._default;
  const dollars = (freshIn, cacheIn, out) => (freshIn * rate.in + cacheIn * rate.in * 0.1 + out * rate.out) / 1e6;
  const by = {};
  for (const r of records) (by[r.variant] ??= []).push(r);
  const mean = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0);
  console.log("\nvariant   n  pass%  judge  in(avg)  out(avg)  $cached  $cold");
  for (const v of variants) {
    const rs = by[v] || [];
    if (!rs.length) continue;
    const pass = Math.round(100 * rs.filter((x) => x.passed).length / rs.length);
    const j = rs.map((x) => x.judge).filter((x) => x != null);
    const cached = mean(rs, (x) => dollars(x.usage.input, x.usage.cache_read, x.usage.output));
    const cold = mean(rs, (x) => dollars(x.usage.input + x.usage.cache_read, 0, x.usage.output));
    console.log(`${v.padEnd(8)} ${String(rs.length).padStart(2)}  ${String(pass).padStart(4)}  ` +
      `${String(j.length ? median(j) : "-").padStart(5)}  ${String(Math.round(mean(rs, (x) => x.usage.input))).padStart(7)}  ` +
      `${String(Math.round(mean(rs, (x) => x.usage.output))).padStart(7)}  ` +
      `${cached.toFixed(4)}  ${cold.toFixed(4)}`);
  }
}
