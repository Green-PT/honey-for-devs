#!/usr/bin/env node
"use strict";
// Subagent-dispatch benchmark: does injecting the Honey directive (what
// hooks/honey-subagent.js adds via SubagentStart) cut a dispatched worker's output
// without hurting correctness? Same code tasks and grade() as the main bench; the
// only difference between variants is the directive appended to the dispatch prompt.
//
//   node src/dispatch-bench.js [--mock]   env: MODEL, RUNS, CONCURRENCY, STAMP

const fs = require("fs");
const path = require("path");
const { extractInfo } = require("./extract");
const { grade } = require("./grade");
const { WORKER } = require("../../hooks/honey-subagent");

const ROOT = path.join(__dirname, "..");
const REPO = path.join(ROOT, "..");
const MOCK = process.argv.includes("--mock");
const MODEL = process.env.MODEL || "claude-opus-4-8";
const RUNS = Number(process.env.RUNS || 1);
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);

// The subagent frame is apparatus, identical for both variants; the directive is the lever.
const SYSTEM =
  "You are a subagent dispatched by an orchestrator agent inside a coding harness. " +
  "Complete the task below and return your result to the orchestrator.";
const VARIANTS = {
  plain: (prompt) => prompt,
  directive: (prompt) => `${prompt}\n\n${WORKER}`,
};

function loadTasks() {
  const dir = path.join(ROOT, "tasks");
  return fs
    .readdirSync(dir)
    .filter((d) => fs.existsSync(path.join(dir, d, "meta.json")))
    .map((d) => {
      const base = path.join(dir, d);
      const meta = JSON.parse(fs.readFileSync(path.join(base, "meta.json"), "utf8"));
      return {
        meta,
        prompt: fs.readFileSync(path.join(base, "prompt.md"), "utf8").trim(),
        testPath: meta.test_file ? path.join(base, meta.test_file) : null,
        refPath: path.join(base, `reference.${meta.lang === "python" ? "py" : "js"}`),
      };
    })
    .filter((t) => !t.meta.type || t.meta.type === "code"); // code tier only: objective grade
}

let complete;
if (MOCK) {
  complete = async ({ user }) => {
    const task = loadTasks().find((t) => user.includes(t.prompt.slice(0, 60)));
    const prose = /Apply Honey/.test(user)
      ? "Done."
      : "I completed the task as requested. Here is a detailed walkthrough of my approach, " +
        "the edge cases I considered, and how each part of the implementation works.";
    const text = `${prose}\n\n\`\`\`${task.meta.lang}\n${fs.readFileSync(task.refPath, "utf8").trim()}\n\`\`\`\n`;
    return { text, usage: { input: Math.ceil(user.length / 4), output: Math.ceil(text.length / 4), cache_read: 0, cache_write: 0 } };
  };
} else {
  ({ complete } = require("./client"));
}

async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

(async () => {
  const tasks = loadTasks();
  const cells = [];
  for (const variant of Object.keys(VARIANTS))
    for (const task of tasks) for (let r = 0; r < RUNS; r++) cells.push({ variant, task, r });
  console.log(`${MOCK ? "[MOCK] " : ""}model=${MODEL} tasks=${tasks.length} runs=${RUNS} -> ${cells.length} generations`);

  let done = 0;
  const records = await pmap(cells, MOCK ? 1 : CONCURRENCY, async ({ variant, task, r }) => {
    const gen = await complete({
      model: MODEL,
      system: SYSTEM,
      user: VARIANTS[variant](task.prompt),
      maxTokens: 4096,
    });
    const lang = task.meta.lang === "python" ? "python" : "javascript";
    const g = grade(task, extractInfo(gen.text, lang).code);
    done++;
    process.stdout.write(`\r${done}/${cells.length}  ${variant}/${task.meta.id}#${r} ${g.passed ? "pass" : "FAIL"} out=${gen.usage.output}   `);
    return { variant, task: task.meta.id, run: r, passed: g.passed, grade_detail: g.detail, usage: gen.usage, reply: gen.text };
  });
  process.stdout.write("\n");

  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const rows = Object.keys(VARIANTS).map((v) => {
    const rs = records.filter((r) => r.variant === v);
    return { variant: v, pass: mean(rs.map((r) => (r.passed ? 1 : 0))), out: rs.reduce((a, r) => a + r.usage.output, 0) };
  });
  const base = rows.find((r) => r.variant === "plain");
  const table = [
    "| Variant | Tests pass | Output tok | vs plain |",
    "|---------|-----------:|-----------:|---------:|",
    ...rows.map(
      (r) =>
        `| ${r.variant} | ${(r.pass * 100).toFixed(0)}% | ${r.out.toLocaleString()} | ` +
        `${r.variant === "plain" ? "+0%" : `${((r.out / base.out - 1) * 100).toFixed(0)}%`} |`
    ),
  ].join("\n");

  const stamp = (process.env.STAMP || "dispatch-latest").replace(/[^\w.-]/g, "_");
  const outDir = path.join(ROOT, "results", stamp);
  fs.mkdirSync(path.join(outDir, "raw"), { recursive: true });
  for (const rec of records)
    fs.writeFileSync(path.join(outDir, "raw", `${rec.variant}__${rec.task}__r${rec.run}.md`), rec.reply);
  fs.writeFileSync(
    path.join(outDir, "results.json"),
    JSON.stringify(
      { meta: { model: MODEL, runs: RUNS, mock: MOCK, bench: "dispatch" }, records: records.map(({ reply, ...r }) => r) },
      null, 2
    )
  );
  fs.writeFileSync(
    path.join(outDir, "report.md"),
    `# Subagent-dispatch bench\n\nmodel: \`${MODEL}\` · runs: ${RUNS}${MOCK ? " · **MOCK**" : ""}\n\n${table}\n\n` +
      `- \`plain\` — task dispatched as-is (a subagent with no inherited Honey hook).\n` +
      `- \`directive\` — the worker directive \`hooks/honey-subagent.js\` injects via SubagentStart.\n` +
      `- Same \`grade()\` as the main bench: extracted code must pass the task's unit test.\n`
  );
  console.log("\n" + table + `\n\nresults -> ${path.relative(REPO, outDir)}/`);
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(1);
});
