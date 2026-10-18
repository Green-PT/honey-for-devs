#!/usr/bin/env node
"use strict";
// Real benchmark runner: baseline / caveman / ponytail / honey.
// For each task × variant × run: generate a reply, extract + execute the code (objective
// pass/fail), score it with an LLM judge, and measure tokens, CO₂, and $.
//
//   node src/run.js                 # live; needs ANTHROPIC_API_KEY
//   node src/run.js --mock          # no API, validates the whole pipeline for free
//   MODEL=claude-opus-4-8 RUNS=3 node src/run.js --variants honey,baseline --tasks flatten
//   node src/run.js --resume        # continue an aborted run: skip cells already in results.json
//
// Env: MODEL, JUDGE_MODELS (comma list = panel), RUNS, THINKING (token budget, 0=off), CONCURRENCY.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { extractInfo, loc } = require("./extract");
const { grade } = require("./grade");
const { gradeWeb } = require("./grade-web");
const { receiverPrompt, parseAnswers, scoreRelay } = require("./relay");
const eco = require("../../hooks/eco");

const ROOT = path.join(__dirname, "..");
const REPO = path.join(ROOT, "..");
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const MOCK = args.includes("--mock");
const RESUME = args.includes("--resume"); // skip cells already checkpointed in results.json
const MODEL = process.env.MODEL || "claude-opus-4-8";
const RECEIVER_MODEL = process.env.RECEIVER_MODEL || MODEL; // neutral decoder for relay tasks
// Judge panel: median of N models cancels single-judge self-preference and noise.
// Default to the model under test; pass JUDGE_MODELS=a,b,c for a panel.
const JUDGE_MODELS = (process.env.JUDGE_MODELS || process.env.JUDGE_MODEL || MODEL)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const RUNS = Number(process.env.RUNS || 1);
const THINKING = Number(process.env.THINKING || 0);
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
// TASKS_DIR=tasks-ext runs the external suite (Exercism, picked by rule — see tasks-ext/README.md).
const TASKS_DIR = process.env.TASKS_DIR || "tasks";
const JUDGE_NULL_MAX = Number(process.env.JUDGE_NULL_MAX ?? 0.05); // max share of empty judge seats
const ALL_VARIANTS = ["baseline", "caveman", "ponytail", "honey", "honey-design", "honey-lean", "honey-noclose"];
// Both are opt-in, excluded from the default sweep — request with --variants.
//   honey-design: user-facing satellite, only meaningful on web tasks.
//   honey-lean:   candidate replacement for the core skill, not a satellite — 781 tokens
//     vs honey's 3607. Tests the 2026 vendor guidance that prompts written for prior
//     models are too prescriptive for current ones (OpenAI measured leaner system
//     prompts at +10–15% eval with 41–66% fewer tokens; Anthropic says prior-model
//     prompts "reduce output quality" on Fable 5). If it wins, honey becomes lean —
//     this does not ship as a second skill. See ../METHODOLOGY.md § Lean-prompt ablation.
//   honey-noclose: the shipped skill minus the one closing-line rule ("name what you
//     skipped or didn't verify"). See ../METHODOLOGY.md § Closing-line ablation.
const OPT_IN = new Set(["honey-design", "honey-lean", "honey-noclose"]);
const DEFAULT_VARIANTS = ALL_VARIANTS.filter((v) => !OPT_IN.has(v));
const VARIANTS = (flag("variants") || DEFAULT_VARIANTS.join(",")).split(",").map((s) => s.trim());
const TASK_FILTER = flag("tasks") ? new Set(flag("tasks").split(",").map((s) => s.trim())) : null;

// --- variant system prompts ----------------------------------------------------
function stripFrontmatter(md) {
  return md.startsWith("---") ? md.replace(/^---\n[\s\S]*?\n---\n?/, "").trim() : md.trim();
}
function loadVariant(name) {
  if (name === "baseline") return null; // control: no skill
  // honey and honey-design load their shipped SKILL.md directly — single source of
  // truth, no copy in variants/ to drift. Other variants are pinned in variants/.
  const file =
    name === "honey" || name === "honey-design"
      ? path.join(REPO, "skills", name, "SKILL.md")
      : path.join(ROOT, "variants", `${name}.md`);
  return stripFrontmatter(fs.readFileSync(file, "utf8"));
}

// --- tasks ---------------------------------------------------------------------
function loadTasks() {
  const dir = path.join(ROOT, TASKS_DIR);
  return fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "meta.json")))
    .filter((d) => !TASK_FILTER || TASK_FILTER.has(d))
    .map((d) => {
      const base = path.join(dir, d);
      const meta = JSON.parse(fs.readFileSync(path.join(base, "meta.json"), "utf8"));
      return {
        meta,
        prompt: fs.readFileSync(path.join(base, "prompt.md"), "utf8").trim(),
        testPath: meta.test_file ? path.join(base, meta.test_file) : null,
        refPath:
          meta.type === "web" || meta.type === "relay"
            ? null
            : path.join(base, `reference.${meta.lang === "python" ? "py" : "js"}`),
      };
    });
}

// mock needs the current task + variant in scope; runCell sets these before each call
let MOCK_TASK = null;
let MOCK_VARIANT = "baseline";

// --- model + judge (live or mock) ----------------------------------------------
let complete, judge;
let seedMockCache = () => {}; // resume: mark variants whose system was already billed fresh
if (MOCK) {
  // Deterministic stand-in: returns the reference solution wrapped in prose whose
  // length scales by variant, so token deltas and the pipeline are exercised offline.
  const PROSE = {
    baseline:
      "Great question! Here is a complete, well-structured solution. I have carefully " +
      "considered the edge cases described in the prompt and implemented the function " +
      "accordingly. Below is the code, followed by a short explanation of how it works.",
    caveman: "Solution:",
    ponytail: "Minimal, stdlib where possible:",
    honey: "Solution:",
  };
  const STUB_HTML =
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Mock</title>' +
    "<style>@media(max-width:600px){body{font-size:14px}}</style></head>" +
    '<body><header><nav>nav</nav></header><main><section><h1>Hero</h1>' +
    '<button class="cta">Get started</button></section><section>Features</section>' +
    "<section>Pricing</section></main><footer>©</footer></body></html>";
  const cachedSystems = new Set(); // simulate prompt caching: system billed fresh once per variant
  seedMockCache = (v) => cachedSystems.add(v);
  complete = async ({ system, user }) => {
    // relay: encode call echoes the data; receiver call returns ground-truth answers
    if (MOCK_TASK.meta.type === "relay") {
      const text = /received a handoff/.test(user)
        ? JSON.stringify(MOCK_TASK.meta.queries.map((q) => q.a))
        : `handoff: ${MOCK_TASK.prompt.slice(0, 60)}`;
      const sysTok = system ? Math.ceil(system.length / 4) : 0;
      return { text, usage: { input: sysTok + Math.ceil(user.length / 4), output: Math.ceil(text.length / 4), cache_read: 0, cache_write: 0 } };
    }
    const body =
      MOCK_TASK.meta.type === "web"
        ? STUB_HTML
        : fs.readFileSync(MOCK_TASK.refPath, "utf8").trim();
    const text = `${PROSE[MOCK_VARIANT]}\n\n\`\`\`${MOCK_TASK.meta.lang}\n${body}\n\`\`\`\n`;
    const sysTok = system ? Math.ceil(system.length / 4) : 0;
    const cached = system && cachedSystems.has(MOCK_VARIANT);
    if (system) cachedSystems.add(MOCK_VARIANT);
    return {
      text,
      usage: {
        input: (cached ? 0 : sysTok) + Math.ceil(user.length / 4),
        output: Math.ceil(text.length / 4),
        cache_read: cached ? sysTok : 0,
        cache_write: 0,
      },
    };
  };
  judge = async () => ({ score: 95, note: "mock" });
} else {
  ({ complete } = require("./client"));
  ({ judge } = require("./judge"));
}

// --- concurrency ---------------------------------------------------------------
async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

// --- one cell ------------------------------------------------------------------
const cfg = eco.loadConfig();

async function runCell(task, variantName, system, run) {
  MOCK_TASK = task;
  MOCK_VARIANT = variantName;
  const type = task.meta.type === "web" ? "web" : task.meta.type === "relay" ? "relay" : "code";
  const gen = await complete({
    model: MODEL,
    system,
    user: task.prompt,
    // Web pages need headroom. MAX_TOKENS overrides: models where thinking is on by
    // default (Opus 5, Fable 5) spend part of this budget thinking, so the same number
    // buys less answer than on Opus 4.8 — raise it when comparing across those.
    maxTokens: Number(process.env.MAX_TOKENS || 0) || (type === "web" ? 8192 : 4096),
    thinking: THINKING,
  });

  const common = {
    variant: variantName,
    task: task.meta.id,
    category: task.meta.category,
    type,
    run,
    stop_reason: gen.stop_reason ?? null, // "max_tokens" = truncated; not a real token saving
    usage: gen.usage,
    gco2: eco.estimate(MODEL, gen.usage.output, cfg).gco2,
    reply: gen.text,
  };

  // Agent-to-agent: a neutral receiver decodes the handoff; quality = lossless recovery.
  // No prose/design judge — the round-trip IS the quality measure.
  if (type === "relay") {
    MOCK_TASK = task; // re-pin for mock: set synchronously right before the receiver call
    const rec = await complete({
      model: RECEIVER_MODEL,
      system: null,
      user: receiverPrompt(gen.text, task.meta.queries),
      maxTokens: 600,
    });
    const sc = scoreRelay(parseAnswers(rec.text, task.meta.queries.length), task.meta.queries);
    return {
      ...common,
      passed: sc.passed,
      accuracy: sc.accuracy,
      grade_detail: sc.detail,
      receiver_stop: rec.stop_reason ?? null, // a refusing receiver is apparatus failure, not a variant's fault
      judge: null,
    };
  }

  const lang = task.meta.lang === "python" ? "python" : type === "web" ? "html" : "javascript";
  const ex = extractInfo(gen.text, lang);
  let code = ex.code;
  if (type === "web" && !/<(html|body|main|section|div)\b/i.test(code)) code = gen.text; // raw, unfenced HTML
  const g = type === "web" ? gradeWeb(task, code) : grade(task, code);

  // judge panel: score with each model, headline = median (robust to one harsh/lenient judge)
  const panel = await Promise.all(
    JUDGE_MODELS.map((m) =>
      judge({ model: m, taskPrompt: task.prompt, candidateOutput: gen.text, type })
        .then((r) => ({ model: m, ...r }))
    )
  );
  const scores = panel.map((p) => p.score).filter((s) => s != null);
  return {
    ...common,
    passed: g.passed,
    grade_detail: g.detail,
    nblocks: ex.nblocks,
    loc: loc(code), // Lever 1 measured directly, not proxied through output tokens
    judge: median(scores),
    judge_min: scores.length ? Math.min(...scores) : null,
    judge_max: scores.length ? Math.max(...scores) : null,
    judges: Object.fromEntries(panel.map((p) => [p.model, p.score])),
    judge_note: panel[0] ? panel[0].note : "",
  };
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// --- main ----------------------------------------------------------------------
const cellKey = (v, t, r) => `${v}__${t}__r${r}`;

(async () => {
  const tasks = loadTasks();
  const systems = Object.fromEntries(VARIANTS.map((v) => [v, loadVariant(v)]));
  // Pin every variant's exact system prompt this run: hash it and snapshot the resolved text
  // (below). honey loads live from skills/, so without this the comparison drifts as the skill
  // is edited — the hash makes "which honey vs which competitors" reproducible per result set.
  const variantHashes = Object.fromEntries(
    Object.entries(systems).map(([v, s]) => [
      v,
      s ? crypto.createHash("sha256").update(s).digest("hex").slice(0, 12) : null,
    ])
  );

  // Mock gets its own default so a pipeline check never overwrites a live local stamp.
  const stamp = (process.env.STAMP || (MOCK ? "mock-latest" : "latest")).replace(/[^\w.-]/g, "_");
  const outDir = path.join(ROOT, "results", stamp);
  // A live stamp is paid for: never overwrite one without --resume, and never let two runs
  // write one at once (two sessions sharing STAMP=full-opus55 interleaved raw/ and records).
  if (!MOCK && !RESUME && fs.existsSync(path.join(outDir, "results.json")))
    throw new Error(`results/${stamp} already holds a run — use --resume to continue it, or a fresh STAMP`);
  fs.mkdirSync(outDir, { recursive: true });
  const lock = path.join(outDir, ".lock");
  try {
    fs.writeFileSync(lock, String(process.pid), { flag: "wx" });
  } catch {
    const pid = Number(fs.readFileSync(lock, "utf8"));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    if (alive) throw new Error(`results/${stamp} is being written by pid ${pid} — use a fresh STAMP`);
    fs.writeFileSync(lock, String(process.pid)); // stale lock from a dead run
  }
  process.on("exit", () => { try { fs.unlinkSync(lock); } catch {} });
  fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "systems"), { recursive: true });
  for (const [v, s] of Object.entries(systems)) if (s) fs.writeFileSync(path.join(outDir, "systems", `${v}.md`), s);
  const outFile = path.join(outDir, "results.json");

  // resume: paid generations are expensive; reload prior records and skip their cells.
  // Refuse to mix result sets the hashes exist to keep apart.
  let records = [];
  if (RESUME && fs.existsSync(outFile)) {
    let prior = null;
    try { prior = JSON.parse(fs.readFileSync(outFile, "utf8")); } catch {}
    if (prior) {
      const pm = prior.meta || {};
      const stale =
        pm.model !== MODEL ||
        !!pm.mock !== MOCK ||
        VARIANTS.some((v) => v in (pm.variant_hashes || {}) && pm.variant_hashes[v] !== variantHashes[v]);
      if (stale)
        throw new Error(
          `--resume: ${path.relative(REPO, outFile)} came from a different model/mock/variant prompt — use a fresh STAMP`
        );
      records = prior.records || [];
    }
  }
  const done = new Set(records.map((r) => cellKey(r.variant, r.task, r.run)));
  for (const v of new Set(records.map((r) => r.variant))) seedMockCache(v);

  const meta = {
    model: MODEL,
    receiver: RECEIVER_MODEL,
    judge: JUDGE_MODELS,
    judge_rubric: process.env.JUDGE_RUBRIC || "plain",
    runs: RUNS,
    thinking: THINKING,
    mock: MOCK,
    variant_hashes: variantHashes,
    tasks_dir: TASKS_DIR,
  };
  const persist = () => fs.writeFileSync(outFile, JSON.stringify({ meta, records }, null, 2));

  // build the work list (variant × task × run), minus already-checkpointed cells
  const cells = [];
  for (const v of VARIANTS)
    for (const task of tasks)
      for (let r = 0; r < RUNS; r++)
        if (!done.has(cellKey(v, task.meta.id, r))) cells.push({ v, task, r });

  console.log(
    `${MOCK ? "[MOCK] " : ""}model=${MODEL} judge=${JUDGE_MODELS.join("+")} variants=${VARIANTS.join(",")} ` +
      `tasks=${tasks.length} runs=${RUNS} thinking=${THINKING} -> ${cells.length} generations` +
      (done.size ? ` (${done.size} resumed)` : "")
  );

  let n = 0;
  await pmap(cells, MOCK ? 16 : CONCURRENCY, async (c) => {
    const { reply, ...rec } = await runCell(c.task, c.v, systems[c.v], c.r);
    fs.writeFileSync(path.join(outDir, "raw", `${rec.variant}__${rec.task}__r${rec.run}.md`), reply);
    records.push(rec);
    persist(); // checkpoint every cell — an abort never loses paid generations
    n++;
    process.stdout.write(
      `\r${n}/${cells.length}  ${c.v}/${c.task.meta.id}#${c.r} ` +
        `${rec.passed ? "pass" : "FAIL"} judge=${rec.judge} out=${rec.usage.output}        `
    );
  });
  process.stdout.write("\n");
  persist(); // covers the 0-new-cells case and refreshes meta

  const { aggregate, table, pairedTable, refusalSummary } = require("./report");
  const refNote = refusalSummary(records);
  if (refNote) console.log(`\n⚠ ${refNote}`);
  const shown = ALL_VARIANTS.filter((v) => VARIANTS.includes(v));
  const rows = aggregate(records, shown, MODEL);
  const tbl = table(rows, shown);
  const ptbl = pairedTable(records, shown, MODEL);
  const md =
    `# Honey benchmark results\n\n` +
    `model: \`${MODEL}\` · judge: \`${JUDGE_MODELS.join("+")}\` · tasks: ${tasks.length} · runs: ${RUNS}` +
    `${THINKING ? ` · thinking: ${THINKING}` : ""}${MOCK ? " · **MOCK**" : ""}\n\n` +
    (refNote ? `> ⚠ ${refNote}\n\n` : "") +
    `## Paired (headline)\n\n${ptbl}\n\n` +
    `Every Δ is a **per-task** delta vs \`baseline\`: runs collapse by median, tasks pair up,\n` +
    `and the column is the median of those paired deltas. \`p\` is a two-sided Wilcoxon\n` +
    `signed-rank test (\`—\` when fewer than 6 non-tied tasks — no significance is claimed there).\n` +
    `\`(ns)\` marks a delta that misses p<0.05: a tie, not a win. **Judge W/L/T** counts tasks\n` +
    `where the variant scored above / below / level with baseline, tested with an exact sign\n` +
    `test — the right test for ordinal, noisy judge scores, and one a mean-of-means can hide.\n\n` +
    `- **Δ output** — the headline lever: volume each skill directly controls, caching-independent.\n` +
    `- **Δ new-input** — fresh + cache-creation tokens, the class where a skill prompt *costs*.\n` +
    `  Cache reads are excluded: they bill at a tenth and dominate a long session regardless.\n` +
    `- **Δ cost** — all four token classes at \`bench/pricing.json\` rates.\n\n` +
    `## Arm totals\n\n${tbl}\n\n` +
    `Volumes and absolute costs. The *vs base* column here is a ratio of sums and is\n` +
    `outlier-sensitive — one long task can drive it; prefer the paired table above.\n\n` +
    `- **Tests pass** — objective: extracted code run against unit tests.\n` +
    `- **Judge ±sd** — LLM-as-judge (0-100, panel median) with per-record stdev. A judge gap\n` +
    `  inside ±sd is noise, not a quality win. Rubric: \`${process.env.JUDGE_RUBRIC || "plain"}\`.\n` +
    `- **$ (cached)** — steady state: cache reads at ≈10% of input, cache *creation* charged.\n` +
    `  **$ (cold)** — first-turn worst case: every input token billed fresh. Real cost sits\n` +
    `  between, nearer cached as a session lengthens. Rates in \`bench/pricing.json\`.\n` +
    `- **CO₂** via EcoLogits port (\`hooks/eco.js\`), from output tokens.\n`;
  fs.writeFileSync(path.join(outDir, "report.md"), md);

  console.log("\n" + ptbl + "\n\n" + tbl + "\n");
  console.log(`results -> ${path.relative(REPO, outDir)}/`);

  // A judge that silently returns no score blanks the quality column (judge.js once had a
  // 200-token budget that thinking models spent before the JSON). Results are kept; the exit
  // code says they need a re-judge (src/rejudge-stamp.js) before the judge column is quoted.
  const seats = records.flatMap((r) => Object.values(r.judges || {}));
  const nulls = seats.filter((s) => s == null).length;
  if (seats.length && nulls / seats.length > JUDGE_NULL_MAX) {
    console.error(`judge: ${nulls}/${seats.length} seats returned no score (> ${JUDGE_NULL_MAX * 100}%)`);
    process.exitCode = 1;
  }
})().catch((e) => {
  console.error("\n" + e.stack || e);
  process.exit(1);
});
