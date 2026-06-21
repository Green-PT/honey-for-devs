import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";
import { decode as toonDecode, encode as toonEncode } from "@toon-format/toon";

const require = createRequire(import.meta.url);
const { complete } = require("../src/client.js");
const { decode: esfDecode, encode: esfEncode } = require("../../esf");

// Token efficiency is settled by run.mjs. This harness measures the other half of
// "efficient vs quality": can a model actually READ each format and answer questions
// that require parsing scalars, record arrays, AND nested values? ESF's nested values
// are compact JSON cells, so the nested questions are where it is most at risk.

const finding = (i) => ({
  severity: ["high", "medium", "low"][i % 3],
  file: `src/module-${i}.js`,
  line: 10 + i,
  message: `Finding ${i}: validate input before operation ${i}`,
});

const document = {
  from: "orchestrator",
  to: "implementer",
  kind: "code_review",
  id: "review-2026-0042",
  findings: Array.from({ length: 12 }, (_, i) => finding(i)),
  context: {
    repository: "greenpt/honey",
    branch: "feature/esf",
    constraints: ["no new runtime dependencies", "preserve public API"],
    environment: { runtime: "node", version: 22 },
  },
  meta: { complete: false, retry: null, tags: ["security", "api"] },
};

// Every answer is machine-checkable against the source object. Mix of altitudes:
// scalar envelope, deep record-array indexing, and the nested JSON-cell values.
const norm = (s) => String(s).toLowerCase().replace(/[\s."'`]+/g, " ").trim();
const questions = [
  { q: "What is the value of the top-level field `id`? Answer with only that value.",
    a: document.id, probes: "scalar" },
  { q: "In `findings`, what is the `severity` of the finding whose `line` is 17? Answer with one word.",
    a: document.findings.find((f) => f.line === 17).severity, probes: "record-array" },
  { q: "In `findings`, what is the `file` of the 9th finding (1-indexed)? Answer with only the path.",
    a: document.findings[8].file, probes: "record-array" },
  { q: "How many entries are in `findings`? Answer with only the number.",
    a: String(document.findings.length), probes: "record-array" },
  { q: "What is `context.environment.version`? Answer with only the number.",
    a: String(document.context.environment.version), probes: "nested" },
  { q: "What is `context.environment.runtime`? Answer with one word.",
    a: document.context.environment.runtime, probes: "nested" },
  { q: "How many items are in `context.constraints`? Answer with only the number.",
    a: String(document.context.constraints.length), probes: "nested-array" },
  { q: "What is the SECOND item in `context.constraints`? Answer with only that string.",
    a: document.context.constraints[1], probes: "nested-array" },
  { q: "What is the value of `meta.retry`? Answer with one word.",
    a: "null", probes: "nested" },
  { q: "Is `meta.complete` true or false? Answer with one word.",
    a: "false", probes: "nested" },
];

// Columnar JSON: uniform record arrays -> {"#c":[cols],"#r":[rows]}, still valid JSON.
const isRec = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const colEncode = (v) => {
  if (Array.isArray(v)) {
    if (v.length > 1 && v.every(isRec)) {
      const cols = Object.keys(v[0]);
      if (v.every((r) => { const k = Object.keys(r); return k.length === cols.length && k.every((x, i) => x === cols[i]); })) {
        return { "#c": cols, "#r": v.map((r) => cols.map((c) => colEncode(r[c]))) };
      }
    }
    return v.map(colEncode);
  }
  return isRec(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, colEncode(x)])) : v;
};
const colDecode = (v) => {
  if (Array.isArray(v)) return v.map(colDecode);
  if (isRec(v)) {
    if (Array.isArray(v["#c"]) && Array.isArray(v["#r"])) {
      return v["#r"].map((row) => Object.fromEntries(v["#c"].map((c, i) => [c, colDecode(row[i])])));
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, colDecode(x)]));
  }
  return v;
};

const formats = {
  JSON: (d) => JSON.stringify(d, null, 0),
  "JSON-columnar": (d) => JSON.stringify(colEncode(d)),
  TOON: (d) => toonEncode(d),
  ESF: (d) => esfEncode(d),
};
// Sanity: every format must round-trip this document before we trust any answer.
assert.deepEqual(JSON.parse(formats.JSON(document)), document);
assert.deepEqual(colDecode(JSON.parse(formats["JSON-columnar"](document))), document);
assert.deepEqual(toonDecode(formats.TOON(document)), document);
assert.deepEqual(esfDecode(formats.ESF(document)), document);

const models = (process.env.ESF_MODELS || "claude-haiku-4-5-20251001,gpt-4.1-mini")
  .split(",").map((m) => m.trim()).filter(Boolean);
const repeats = Number(process.env.ESF_REPEATS || 1);

const system =
  "You read a structured agent-to-agent message and answer a question about it. " +
  "The message may be in JSON, TOON, or ESF (a compact tab-delimited format). " +
  "Answer with ONLY the requested value, no explanation, no punctuation, no units.";

async function ask(model, encoded, question) {
  const { text } = await complete({
    model,
    system,
    user: `MESSAGE:\n${encoded}\n\nQUESTION: ${question}`,
    maxTokens: 64,
  });
  return text.trim();
}

const results = {};
for (const [format, enc] of Object.entries(formats)) {
  results[format] = { tokens: o200kTokens(enc(document)), correct: 0, total: 0, misses: [] };
}

for (const model of models) {
  for (const [format, enc] of Object.entries(formats)) {
    const encoded = enc(document);
    for (const item of questions) {
      for (let r = 0; r < repeats; r++) {
        let got;
        try { got = await ask(model, encoded, item.q); }
        catch (e) { got = `ERROR: ${e.message}`; }
        const ok = norm(got) === norm(item.a) || norm(got).split(" ").includes(norm(item.a));
        results[format].total += 1;
        if (ok) results[format].correct += 1;
        else results[format].misses.push({ model, probes: item.probes, want: item.a, got });
      }
    }
  }
}

const pct = (c, t) => (t ? `${((c / t) * 100).toFixed(1)}%` : "n/a");
let report = `# ESF Comprehension vs TOON vs JSON\n\n`;
report += `Models: ${models.join(", ")} · ${repeats} repeat(s) · ${questions.length} questions.\n`;
report += `Each answer is checked against the source object. Accuracy is the quality axis;\n`;
report += `tokens are the efficiency axis. The best format maximizes accuracy per token.\n\n`;
report += `| Format | o200k tokens | Accuracy | Correct/Total |\n|---|---:|---:|---:|\n`;
for (const [format, r] of Object.entries(results)) {
  report += `| ${format} | ${r.tokens} | ${pct(r.correct, r.total)} | ${r.correct}/${r.total} |\n`;
}
const misses = Object.entries(results).flatMap(([f, r]) => r.misses.map((m) => ({ format: f, ...m })));
if (misses.length) {
  report += `\n## Misses\n\n| Format | Model | Probes | Wanted | Got |\n|---|---|---|---|---|\n`;
  for (const m of misses) {
    report += `| ${m.format} | ${m.model} | ${m.probes} | \`${m.want}\` | \`${String(m.got).slice(0, 40)}\` |\n`;
  }
}
report += `\nRun with \`ESF_MODELS=... ESF_REPEATS=3 node bench/esf/comprehension.mjs\`. Requires an API key.\n`;

fs.writeFileSync(new URL("./COMPREHENSION.md", import.meta.url), report);
console.log(report);
