#!/usr/bin/env node
"use strict";
// Real benchmark runner: baseline / caveman / ponytail / honey.
// For each task × variant × run: generate a reply, extract + execute the code (objective
// pass/fail), score it with an LLM judge, and measure tokens, CO₂, and $.
//
//   node src/run.js                 # live; needs ANTHROPIC_API_KEY
//   node src/run.js --mock          # no API, validates the whole pipeline for free
//   MODEL=claude-opus-4-8 RUNS=3 node src/run.js --variants honey,baseline --tasks flatten
//
// Env: MODEL, JUDGE_MODELS (comma list = panel), RUNS, THINKING (token budget, 0=off), CONCURRENCY.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { extractInfo } = require("./extract");
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
const ALL_VARIANTS = ["baseline", "caveman", "ponytail", "honey", "honey-design"];
// honey-design is an opt-in user-facing variant; exclude it from the default sweep
// (it only makes sense on web tasks) — request it explicitly with --variants.
const DEFAULT_VARIANTS = ALL_VARIANTS.filter((v) => v !== "honey-design");
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
  const dir = path.join(ROOT, "tasks");
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
    maxTokens: type === "web" ? 8192 : 4096, // full pages need headroom
    thinking: THINKING,
  });

  const common = {
    variant: variantName,
    task: task.meta.id,
    category: task.meta.category,
    type,
    run,
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
    return { ...common, passed: sc.passed, accuracy: sc.accuracy, grade_detail: sc.detail, judge: null };
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

  // build the full work list (variant × task × run)
  const cells = [];
  for (const v of VARIANTS)
    for (const task of tasks) for (let r = 0; r < RUNS; r++) cells.push({ v, task, r });

  console.log(
    `${MOCK ? "[MOCK] " : ""}model=${MODEL} judge=${JUDGE_MODELS.join("+")} variants=${VARIANTS.join(",")} ` +
      `tasks=${tasks.length} runs=${RUNS} thinking=${THINKING} -> ${cells.length} generations`
  );

  let done = 0;
  const records = await pmap(cells, MOCK ? 16 : CONCURRENCY, async (c) => {
    const rec = await runCell(c.task, c.v, systems[c.v], c.r);
    done++;
    process.stdout.write(
      `\r${done}/${cells.length}  ${c.v}/${c.task.meta.id}#${c.r} ` +
        `${rec.passed ? "pass" : "FAIL"} judge=${rec.judge} out=${rec.usage.output}        `
    );
    return rec;
  });
  process.stdout.write("\n");

  // persist
  const stamp = (process.env.STAMP || "latest").replace(/[^\w.-]/g, "_");
  const outDir = path.join(ROOT, "results", stamp);
  fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "systems"), { recursive: true });
  for (const rec of records) {
    const f = path.join(outDir, "raw", `${rec.variant}__${rec.task}__r${rec.run}.md`);
    fs.writeFileSync(f, rec.reply);
  }
  for (const [v, s] of Object.entries(systems)) if (s) fs.writeFileSync(path.join(outDir, "systems", `${v}.md`), s);
  const slim = records.map(({ reply, ...r }) => r);
  const meta = {
    model: MODEL,
    judge: JUDGE_MODELS,
    judge_rubric: process.env.JUDGE_RUBRIC || "plain",
    runs: RUNS,
    thinking: THINKING,
    mock: MOCK,
    variant_hashes: variantHashes,
  };
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ meta, records: slim }, null, 2));

  const { aggregate, table } = require("./report");
  const rows = aggregate(records, ALL_VARIANTS.filter((v) => VARIANTS.includes(v)), MODEL);
  const tbl = table(rows, ALL_VARIANTS.filter((v) => VARIANTS.includes(v)));
  const md =
    `# Honey benchmark results\n\n` +
    `model: \`${MODEL}\` · judge: \`${JUDGE_MODELS.join("+")}\` · tasks: ${tasks.length} · runs: ${RUNS}` +
    `${THINKING ? ` · thinking: ${THINKING}` : ""}${MOCK ? " · **MOCK**" : ""}\n\n` +
    `${tbl}\n\n` +
    `- **Tests pass** — objective: extracted code run against unit tests.\n` +
    `- **Judge ±sd** — LLM-as-judge (0-100, panel median) with per-record stdev. A judge gap\n` +
    `  inside ±sd is noise, not a quality win. Rubric: \`${process.env.JUDGE_RUBRIC || "plain"}\`.\n` +
    `- **Output tok / Output vs base** — the headline lever: tokens each skill directly\n` +
    `  controls. Caching-independent.\n` +
    `- **$ (cached)** — steady state: skill prompt prompt-cached (≈10% input cost on repeat\n` +
    `  tasks). **$ (cold)** — first-turn worst case: skill prompt billed as fresh input. Real\n` +
    `  cost sits between, nearer cached as a session lengthens. Rates in \`bench/pricing.json\`.\n` +
    `- **CO₂** via EcoLogits port (\`hooks/eco.js\`), from output tokens.\n`;
  fs.writeFileSync(path.join(outDir, "report.md"), md);

  console.log("\n" + tbl + "\n");
  console.log(`results -> ${path.relative(REPO, outDir)}/`);
})().catch((e) => {
  console.error("\n" + e.stack || e);
  process.exit(1);
});
