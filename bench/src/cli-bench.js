"use strict";
// CLI-driven benchmark: drives the real `claude` CLI (subscription auth), not the API.
// Clean control via `--setting-sources project` from a settings-free temp cwd, so the
// user's Honey hooks don't leak into non-Honey variants (probed: clean->NO, default->YES).
// Each variant gets ONLY its skill via --append-system-prompt.
//
// Three parts: A landing-page (web grader), B findings-relay (agent->agent round-trip),
// C CCR (full-vs-crushed receiver: token reduction + accuracy parity on signal rows).

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { gradeWeb } = require("./grade-web");
const { receiverPrompt, parseAnswers, scoreRelay } = require("./relay");
const { crush, strip } = require("../../eso/ccr");
const eco = require("../../hooks/eco");

const ROOT = path.resolve(__dirname, "../..");
const MODEL = process.env.MODEL || "claude-opus-4-8";
const RUNS = Number(process.env.RUNS || 3);
const OUT = process.env.OUT || path.join(os.homedir(), "Desktop", "honey-cli-bench");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "honeybench-"));

const VARIANTS = {
  honey: fs.readFileSync(path.join(ROOT, "skills/honey/SKILL.md"), "utf8"),
  ponytail: fs.readFileSync(path.join(ROOT, "bench/variants/ponytail.md"), "utf8"),
  caveman: fs.readFileSync(path.join(ROOT, "bench/variants/caveman.md"), "utf8"),
};

// One CLI generation. Returns { text, usage:{input,output,cache_read,cache_write}, cost, ms }.
// system === null -> no append (clean receiver). On error throws with the CLI message.
function gen(prompt, system) {
  const args = ["-p", prompt, "--setting-sources", "project",
    "--output-format", "json", "--model", MODEL];
  if (system) args.push("--append-system-prompt", system);
  const raw = execFileSync("claude", args, {
    cwd: WORK, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const d = JSON.parse(raw);
  if (d.is_error) throw new Error(`CLI: ${d.result}`);
  const u = d.usage || {};
  const cache_read = u.cache_read_input_tokens || 0;
  const cache_write = u.cache_creation_input_tokens || 0;
  return {
    text: d.result || "",
    usage: {
      input: u.input_tokens || 0,
      // total input the model actually read this turn — the payload lands in the cache
      // buckets, not input_tokens, so CCR's reduction is only visible in the sum.
      inputTotal: (u.input_tokens || 0) + cache_read + cache_write,
      output: u.output_tokens || 0,
      cache_read,
      cache_write,
    },
    cost: d.total_cost_usd || 0,
    ms: d.duration_ms || 0,
  };
}

function firstCodeBlock(text) {
  const m = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : text.trim();
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};
const co2 = (out) => eco.estimate(MODEL, out).gco2;

const log = (...a) => process.stdout.write(a.join(" ") + "\n");

// ---- Part A: landing-page (web) -------------------------------------------------
function partA() {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "bench/tasks/landing-page/meta.json"), "utf8"));
  const prompt = fs.readFileSync(path.join(ROOT, "bench/tasks/landing-page/prompt.md"), "utf8");
  const task = { meta };
  const rows = {};
  log("\n== Part A: landing-page (web) ==");
  for (const v of Object.keys(VARIANTS)) {
    const samples = [];
    for (let r = 0; r < RUNS; r++) {
      const g = gen(prompt, VARIANTS[v]);
      const html = firstCodeBlock(g.text);
      const grade = gradeWeb(task, html);
      samples.push({ out: g.usage.output, in: g.usage.input, cost: g.cost, ms: g.ms,
        passed: grade.passed, failedCount: grade.failedCount || 0, checks: grade.checks,
        bytes: html.length });
      log(`  ${v} run${r + 1}: out=${g.usage.output} pass=${grade.passed} checks=${grade.checks - (grade.failedCount||0)}/${grade.checks} ${grade.detail}`);
    }
    rows[v] = {
      out: median(samples.map((s) => s.out)),
      in: median(samples.map((s) => s.in)),
      bytes: median(samples.map((s) => s.bytes)),
      passRate: samples.filter((s) => s.passed).length / samples.length,
      checks: samples[0].checks,
      cost: median(samples.map((s) => s.cost)),
      samples,
    };
  }
  return rows;
}

// ---- Part B: findings-relay (agent -> agent) ------------------------------------
function partB() {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "bench/tasks/findings-relay/meta.json"), "utf8"));
  const prompt = fs.readFileSync(path.join(ROOT, "bench/tasks/findings-relay/prompt.md"), "utf8");
  const rows = {};
  log("\n== Part B: findings-relay (agent->agent, 6 queries) ==");
  for (const v of Object.keys(VARIANTS)) {
    const samples = [];
    for (let r = 0; r < RUNS; r++) {
      const g = gen(prompt, VARIANTS[v]);          // variant encodes the handoff
      const handoff = firstCodeBlock(g.text);
      const recv = gen(receiverPrompt(handoff, meta.queries), null); // neutral receiver
      const answers = parseAnswers(recv.text, meta.queries.length);
      const sc = scoreRelay(answers, meta.queries);
      samples.push({ out: g.usage.output, in: g.usage.input, cost: g.cost,
        handoffBytes: handoff.length, accuracy: sc.accuracy, passed: sc.passed, detail: sc.detail,
        recvOut: recv.usage.output });
      log(`  ${v} run${r + 1}: handoff_out=${g.usage.output} bytes=${handoff.length} acc=${(sc.accuracy*100).toFixed(0)}% ${sc.detail}`);
    }
    rows[v] = {
      out: median(samples.map((s) => s.out)),
      handoffBytes: median(samples.map((s) => s.handoffBytes)),
      accuracy: median(samples.map((s) => s.accuracy)),
      passRate: samples.filter((s) => s.passed).length / samples.length,
      cost: median(samples.map((s) => s.cost)),
      samples,
    };
  }
  return rows;
}

// ---- Part C: CCR (full vs crushed receiver) -------------------------------------
// 200 redundant log rows with periodic warn/error anomalies. Receiver answers
// questions answerable from the kept signal (endpoints + anomalies). Compares
// input tokens and accuracy: full array vs CCR view.
function ccrLogs(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    level: i === 0 ? "info" : i === n - 1 ? "error" : i % 23 === 0 ? "warn" : "info",
    code: 200 + (i % 23 === 0 ? 100 : 0),
    msg: `request ${i} handled`,
  }));
}
function ccrQuestions(logs) {
  const warns = logs.filter((r) => r.level === "warn").map((r) => r.id);
  const last = logs[logs.length - 1];
  return [
    { q: "What is the level of the LAST log row? Answer with one word.", a: last.level },
    { q: "What is the id of the first row? Answer with just the number.", a: "0" },
    { q: "Are there any rows with level 'warn'? Answer yes or no.", a: "yes" },
    { q: `What is the level of the row with id ${warns[1]}? Answer with one word.`, a: "warn" },
  ];
}
function partC() {
  log("\n== Part C: CCR (compress-cache-retrieve) full vs crushed ==");
  const N = 200;
  const logs = ccrLogs(N);
  const qs = ccrQuestions(logs);
  const { view, dropped } = crush(logs, { maxItems: 15 });
  const kept = strip(view).length;
  const full = JSON.stringify(logs);
  const crushed = JSON.stringify(view);
  log(`  array: ${N} rows -> CCR view kept ${kept} + sentinel, dropped ${dropped} (${(crushed.length/full.length*100).toFixed(0)}% of bytes)`);
  const ask = (payload, tag) =>
    receiverPrompt(payload, qs).replace("the message below", `the ${tag} log array below`);
  const samples = { full: [], crushed: [] };
  for (let r = 0; r < RUNS; r++) {
    for (const [mode, payload, tag] of [["full", full, "full"], ["crushed", crushed, "crushed"]]) {
      const g = gen(ask(payload, tag), null);
      const ans = parseAnswers(g.text, qs.length);
      const sc = scoreRelay(ans, qs);
      samples[mode].push({ in: g.usage.inputTotal, out: g.usage.output, cost: g.cost,
        accuracy: sc.accuracy, detail: sc.detail });
      log(`  ${mode} run${r + 1}: in=${g.usage.inputTotal} acc=${(sc.accuracy*100).toFixed(0)}% ${sc.detail}`);
    }
  }
  const agg = (m) => ({
    in: median(samples[m].map((s) => s.in)),
    out: median(samples[m].map((s) => s.out)),
    accuracy: median(samples[m].map((s) => s.accuracy)),
    cost: median(samples[m].map((s) => s.cost)),
  });
  return {
    N, kept, dropped, fullBytes: full.length, crushedBytes: crushed.length,
    full: agg("full"), crushed: agg("crushed"), samples,
  };
}

// ---- report ---------------------------------------------------------------------
function pct(a, b) { return b ? `${((1 - a / b) * 100).toFixed(0)}%` : "—"; }
// signed delta of a vs honey-baseline, e.g. "+136%" or "-23%"
function vsHoney(x, h) {
  if (x === h) return "—";
  const d = ((x - h) / h) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`;
}

function writeReport(A, B, C, started) {
  fs.mkdirSync(OUT, { recursive: true });
  const base = VARIANTS.honey ? null : null; // honey is the reference; deltas vs ponytail/caveman shown raw
  const order = ["honey", "ponytail", "caveman"];
  const L = [];
  L.push(`# Honey CLI benchmark`);
  L.push(``);
  L.push(`Real \`claude\` CLI (model \`${MODEL}\`), ${RUNS} runs/cell, medians. Clean control: \`--setting-sources project\` from a settings-free temp cwd (no Honey hook leakage). Variants via \`--append-system-prompt\`. Started ${started}.`);
  L.push(``);
  L.push(`Headline = **output tokens** (the volume each skill controls). CO₂ via the repo's EcoLogits port.`);
  // Part A
  L.push(`\n## A · Landing page (user-facing web)`);
  L.push(`\n| variant | out tok | vs honey | checks pass | pass-rate | bytes | CO₂ g/reply | $/reply |`);
  L.push(`|---|--:|--:|--:|--:|--:|--:|--:|`);
  for (const v of order) {
    const r = A[v];
    L.push(`| ${v} | ${r.out} | ${vsHoney(r.out, A.honey.out)} | ${r.checks}/${r.checks} (${(r.passRate*100).toFixed(0)}%) | ${(r.passRate*100).toFixed(0)}% | ${Math.round(r.bytes)} | ${co2(r.out).toFixed(3)} | ${r.cost.toFixed(4)} |`);
  }
  L.push(`\nAll variants must pass every required check (doctype, title, viewport, h1, nav, footer, css, cta, img_alt) — Honey wins only if it stays fully passing while cutting tokens.`);
  // Part B
  L.push(`\n## B · Agent→agent handoff (findings-relay)`);
  L.push(`\nVariant encodes the handoff; a neutral clean-CLI receiver answers 6 queries from it alone. Accuracy = silent-misparse check (a too-clever format loses points).`);
  L.push(`\n| variant | handoff out tok | vs honey | accuracy | pass-rate | bytes | CO₂ g | $/reply |`);
  L.push(`|---|--:|--:|--:|--:|--:|--:|--:|`);
  for (const v of order) {
    const r = B[v];
    L.push(`| ${v} | ${r.out} | ${vsHoney(r.out, B.honey.out)} | ${(r.accuracy*100).toFixed(0)}% | ${(r.passRate*100).toFixed(0)}% | ${Math.round(r.handoffBytes)} | ${co2(r.out).toFixed(3)} | ${r.cost.toFixed(4)} |`);
  }
  // Part C
  L.push(`\n## C · CCR — compress-cache-retrieve (the "memory thing")`);
  L.push(`\n${C.N}-row redundant log array → CCR keeps ${C.kept} signal rows + 1 sentinel, drops ${C.dropped}. Receiver answers questions answerable from kept rows (endpoints + anomalies).`);
  L.push(`\n| payload | input tok | accuracy | bytes | $/reply |`);
  L.push(`|---|--:|--:|--:|--:|`);
  L.push(`| full array | ${C.full.in} | ${(C.full.accuracy*100).toFixed(0)}% | ${C.fullBytes} | ${C.full.cost.toFixed(4)} |`);
  L.push(`| CCR view | ${C.crushed.in} | ${(C.crushed.accuracy*100).toFixed(0)}% | ${C.crushedBytes} | ${C.crushed.cost.toFixed(4)} |`);
  L.push(`| **reduction** | **${pct(C.crushed.in, C.full.in)}** input tokens | parity if equal | ${pct(C.crushedBytes, C.fullBytes)} bytes | ${pct(C.crushed.cost, C.full.cost)} |`);
  L.push(`\nCCR is lossy-but-recoverable: questions about *dropped* rows would need a hash retrieval (not available to a plain CLI receiver) — by design. Here every question targets a kept signal row, so parity = the kept sample carries the answers.`);
  L.push(``);
  const md = L.join("\n");
  fs.writeFileSync(path.join(OUT, "report.md"), md);
  fs.writeFileSync(path.join(OUT, "raw.json"), JSON.stringify({ model: MODEL, runs: RUNS, started, A, B, C }, null, 2));
  return md;
}

(function main() {
  const started = new Date().toISOString();
  log(`Honey CLI bench · model=${MODEL} runs=${RUNS} work=${WORK}`);
  // PART=C reuses saved A/B from the prior full run (don't regenerate long web pages).
  if (process.env.PART === "C") {
    const prev = JSON.parse(fs.readFileSync(path.join(OUT, "raw.json"), "utf8"));
    const C = partC();
    const md = writeReport(prev.A, prev.B, C, prev.started);
    log(`\nWrote ${path.join(OUT, "report.md")} and raw.json`);
    log("\n" + md);
    return;
  }
  const A = partA();
  const B = partB();
  const C = partC();
  const md = writeReport(A, B, C, started);
  log(`\nWrote ${path.join(OUT, "report.md")} and raw.json`);
  log("\n" + md);
})();
