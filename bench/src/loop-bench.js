#!/usr/bin/env node
"use strict";
// Loop-tick benchmark: does the Loops guidance (honey SKILL.md §Loops + honey-loop
// satellite) actually change loop behavior? Simulated recurring-loop ticks; per tick
// the model reports and picks its own reschedule via a final `NEXT: <seconds>|STOP`
// line (apparatus, identical for every variant). Objective grades, no LLM judge:
//   - pacing: poll-external ticks in 60-270s, idle ticks in 1200-3600s
//   - dead zone: 271-1199s (the ~300s trap the skill names) counted separately
//   - stop: the tick meeting the exit condition must return NEXT: STOP
// Plus mean output tokens per tick — the compounding cost the skill exists to cut.
//
//   node src/loop-bench.js [--mock]   env: MODEL, RUNS, STAMP

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REPO = path.join(ROOT, "..");
const MOCK = process.argv.includes("--mock");
const MODEL = process.env.MODEL || "claude-opus-4-8";
const RUNS = Number(process.env.RUNS || 1);

const stripFrontmatter = (md) =>
  md.startsWith("---") ? md.replace(/^---\n[\s\S]*?\n---\n?/, "").trim() : md.trim();
const skill = (name) =>
  stripFrontmatter(fs.readFileSync(path.join(REPO, "skills", name, "SKILL.md"), "utf8"));

const VARIANTS = {
  off: null,
  honey: skill("honey"), // core, includes the Loops section
  "honey-loop": `${skill("honey")}\n\n${skill("honey-loop")}`, // core + satellite
};

// Each tick: state the model sees, and the objectively right pacing class.
// `unchanged` marks ticks where a disciplined loop short-circuits to a status line.
const SCENARIOS = [
  {
    id: "ci-watch",
    task:
      "You are one tick of a recurring loop watching an external CI pipeline the harness " +
      "cannot notify you about. When the run succeeds or fails, report the outcome and end " +
      "the loop; while it runs, keep watching. A CI run takes roughly 10 minutes.",
    ticks: [
      { state: { run: 4812, status: "running", elapsed_s: 95 }, expect: "poll", unchanged: false },
      { state: { run: 4812, status: "running", elapsed_s: 320 }, expect: "poll", unchanged: true },
      { state: { run: 4812, status: "running", elapsed_s: 560 }, expect: "poll", unchanged: true },
      { state: { run: 4812, status: "success", elapsed_s: 640 }, expect: "stop", unchanged: false },
    ],
  },
  {
    id: "idle-queue",
    task:
      "You are one tick of a recurring loop keeping a support triage queue empty. New items " +
      "arrive a few times per day at most. Exit condition: stop after 3 consecutive empty ticks.",
    ticks: [
      { state: { queue: [], consecutive_empty: 1 }, expect: "idle", unchanged: true },
      { state: { queue: [], consecutive_empty: 2 }, expect: "idle", unchanged: true },
      { state: { queue: [], consecutive_empty: 3 }, expect: "stop", unchanged: true },
    ],
  },
];

function tickPrompt(sc, i, tick, prev) {
  return (
    `${sc.task}\n\n` +
    `Tick ${i + 1}.\n` +
    `Previous state: ${prev ? JSON.stringify(prev.state) : "(first tick)"}\n` +
    `Current state: ${JSON.stringify(tick.state)}\n\n` +
    "Write your tick report, then end your reply with exactly one final line:\n" +
    "`NEXT: <seconds>` to reschedule the next tick, or `NEXT: STOP` to end the loop."
  );
}

function parseNext(text) {
  const m = [...text.matchAll(/^\s*`?NEXT:\s*(STOP|\d+)`?\s*$/gim)].pop();
  if (!m) return null;
  return m[1].toUpperCase() === "STOP" ? "STOP" : Number(m[1]);
}

function gradeTick(expect, next) {
  if (next == null) return { ok: false, deadZone: false };
  if (expect === "stop") return { ok: next === "STOP", deadZone: false };
  if (next === "STOP") return { ok: false, deadZone: false };
  const deadZone = next > 270 && next < 1200;
  const ok = expect === "poll" ? next >= 60 && next <= 270 : next >= 1200 && next <= 3600;
  return { ok, deadZone };
}

let complete;
if (MOCK) {
  complete = async ({ system, user }) => {
    const expect = /success|consecutive_empty":3/.test(user) ? "stop" : /queue/.test(user) ? "idle" : "poll";
    const next = expect === "stop" ? "STOP" : expect === "idle" ? 1500 : 240;
    const text = system
      ? `tick ok, no change.\nNEXT: ${next}`
      : `Thanks for checking in! Let me take a careful look at the current state and walk ` +
        `through what it means before deciding how to proceed.\n\n${"The state is unchanged. ".repeat(10)}\n` +
        `I'll check back in five minutes to be safe.\nNEXT: 300`;
    return { text, usage: { input: Math.ceil(user.length / 4), output: Math.ceil(text.length / 4), cache_read: 0, cache_write: 0 } };
  };
} else {
  ({ complete } = require("./client"));
}

(async () => {
  const records = [];
  for (const [variant, system] of Object.entries(VARIANTS)) {
    for (const sc of SCENARIOS) {
      for (let run = 0; run < RUNS; run++) {
        let prev = null;
        for (let i = 0; i < sc.ticks.length; i++) {
          const tick = sc.ticks[i];
          const gen = await complete({
            model: MODEL,
            system,
            user: tickPrompt(sc, i, tick, prev),
            maxTokens: 2048,
          });
          const next = parseNext(gen.text);
          const g = gradeTick(tick.expect, next);
          records.push({
            variant, scenario: sc.id, tick: i, run,
            expect: tick.expect, unchanged: tick.unchanged, next,
            pacing_ok: g.ok, dead_zone: g.deadZone,
            out: gen.usage.output, reply: gen.text,
          });
          process.stdout.write(
            `\r${records.length}  ${variant}/${sc.id}#${i} next=${next} ${g.ok ? "ok" : "MISS"} out=${gen.usage.output}   `
          );
          prev = tick;
        }
      }
    }
  }
  process.stdout.write("\n");

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (x) => `${(x * 100).toFixed(0)}%`;
  const rows = Object.keys(VARIANTS).map((v) => {
    const rs = records.filter((r) => r.variant === v);
    const stops = rs.filter((r) => r.expect === "stop");
    return {
      variant: v,
      pacing: mean(rs.map((r) => (r.pacing_ok ? 1 : 0))),
      stop: mean(stops.map((r) => (r.next === "STOP" ? 1 : 0))),
      deadZone: rs.filter((r) => r.dead_zone).length,
      outTick: mean(rs.map((r) => r.out)),
      outUnchanged: mean(rs.filter((r) => r.unchanged).map((r) => r.out)),
    };
  });
  const base = rows.find((r) => r.variant === "off");
  const table = [
    "| Variant | Pacing ok | Stop ok | Dead-zone picks | Out tok/tick | Out tok/unchanged tick | vs off |",
    "|---------|----------:|--------:|----------------:|-------------:|-----------------------:|-------:|",
    ...rows.map((r) =>
      `| ${r.variant} | ${pct(r.pacing)} | ${pct(r.stop)} | ${r.deadZone} | ${r.outTick.toFixed(0)} | ` +
      `${r.outUnchanged.toFixed(0)} | ${r.variant === "off" ? "+0%" : `${((r.outTick / base.outTick - 1) * 100).toFixed(0)}%`} |`
    ),
  ].join("\n");

  const stamp = (process.env.STAMP || "loop-latest").replace(/[^\w.-]/g, "_");
  const outDir = path.join(ROOT, "results", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify({ meta: { model: MODEL, runs: RUNS, mock: MOCK, bench: "loop" }, records: records.map(({ reply, ...r }) => r) }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "report.md"),
    `# Loop-tick bench\n\nmodel: \`${MODEL}\` · runs: ${RUNS}${MOCK ? " · **MOCK**" : ""}\n\n${table}\n\n` +
      `- **Pacing ok** — poll ticks in 60-270s, idle ticks in 1200-3600s, done ticks STOP.\n` +
      `- **Dead-zone picks** — reschedules in 271-1199s (the ~300s trap): cache miss paid, not amortized.\n` +
      `- **Out tok/unchanged tick** — the short-circuit claim: unchanged ticks should be a status line.\n`
  );
  console.log("\n" + table + `\n\nresults -> ${path.relative(REPO, outDir)}/`);
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
