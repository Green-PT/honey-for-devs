import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";
import { decode as toonDecode, encode as toonEncode } from "@toon-format/toon";

const require = createRequire(import.meta.url);
const { complete } = require("../src/client.js");
const { decode: esfDecode, encode: esfEncode } = require("../../esf");

// Hard mode. The standard comprehension test saturates (capable models hit 100% on a
// small doc), so it cannot discriminate quality. This stresses the operations most
// likely to break positional/tab formats: precise deep indexing in a long record block,
// column-matching (find by one field, read another), aggregation across all rows, and
// extraction from nested JSON cells. Bigger block = more chances to miscount a row.

const N = 50;
const sev = (i) => ["high", "medium", "low", "high", "medium"][i % 5];
// No field encodes the row's position: module/line/ticket numbers are offset so they
// never equal the 1-indexed position. This isolates "can the model count to row K"
// from "can it pattern-match a label that happens to equal K" (the v1 flaw).
const findings = Array.from({ length: N }, (_, i) => ({
  severity: sev(i),
  file: `src/area-${i % 7}/module-${1000 + i}.js`,
  line: 200 + i * 3,
  owner: `team-${["auth", "api", "ui", "data"][i % 4]}`,
  ticket: `T-${4200 + i * 11}`,
  message: `Review item ${(i * 7) % 13}: tighten validation`,
}));
const document = {
  from: "reviewer", to: "implementer", kind: "code_review", id: "rev-9001",
  findings,
  budget: { max_tokens: 8192, temperature: 0, nested: { retries: 3, mode: "strict" } },
  meta: { complete: false, tags: ["security", "api", "perf"] },
};

const norm = (s) => String(s).toLowerCase().replace(/[\s."'`]+/g, " ").trim();
const idx = 37; // 1-indexed target deep in the block
const lineTarget = 200 + 29 * 3; // 287 -> finding index 29 (unique)
const byLine = findings.find((f) => f.line === lineTarget);
const ticketTarget = `T-${4200 + 41 * 11}`; // index 41, unique key lookup
const byTicket = findings.find((f) => f.ticket === ticketTarget);
const highCount = findings.filter((f) => f.severity === "high").length;
const questions = [
  { q: `In findings, what is the \`file\` of finding number ${idx} (1-indexed, by position)? Answer with only the path.`,
    a: findings[idx - 1].file, probes: "deep-index" },
  { q: `In findings, what is the \`owner\` of finding number ${idx} (1-indexed, by position)? Answer with only the value.`,
    a: findings[idx - 1].owner, probes: "deep-index" },
  { q: `In findings, what is the \`owner\` of the finding whose \`ticket\` is ${ticketTarget}? Answer with only the value.`,
    a: byTicket.owner, probes: "key-lookup" },
  { q: `In findings, what is the \`severity\` of the finding whose \`ticket\` is ${ticketTarget}? Answer with one word.`,
    a: byTicket.severity, probes: "key-lookup" },
  { q: `In findings, what is the \`message\` of the finding whose \`line\` is ${lineTarget}? Answer with only the message text.`,
    a: byLine.message, probes: "column-match" },
  { q: `In findings, what is the \`severity\` of the finding whose \`line\` is ${lineTarget}? Answer with one word.`,
    a: byLine.severity, probes: "column-match" },
  { q: 'How many findings have `severity` equal to "high"? Answer with only the number.',
    a: String(highCount), probes: "aggregate" },
  { q: "How many findings are there in total? Answer with only the number.",
    a: String(N), probes: "aggregate" },
  { q: "What is `budget.nested.retries`? Answer with only the number.",
    a: String(document.budget.nested.retries), probes: "nested-cell" },
  { q: "What is `budget.nested.mode`? Answer with one word.",
    a: document.budget.nested.mode, probes: "nested-cell" },
  { q: "What is the THIRD item in `meta.tags`? Answer with only that word.",
    a: document.meta.tags[2], probes: "nested-array" },
  { q: "What is `budget.max_tokens`? Answer with only the number.",
    a: String(document.budget.max_tokens), probes: "nested-cell" },
];

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
  JSON: (d) => JSON.stringify(d),
  "JSON-columnar": (d) => JSON.stringify(colEncode(d)),
  TOON: (d) => toonEncode(d),
  ESF: (d) => esfEncode(d),
};
assert.deepEqual(JSON.parse(formats.JSON(document)), document);
assert.deepEqual(colDecode(JSON.parse(formats["JSON-columnar"](document))), document);
assert.deepEqual(toonDecode(formats.TOON(document)), document);
assert.deepEqual(esfDecode(formats.ESF(document)), document);

const models = (process.env.ESF_MODELS || "claude-haiku-4-5-20251001,gpt-4.1-mini")
  .split(",").map((m) => m.trim()).filter(Boolean);
const repeats = Number(process.env.ESF_REPEATS || 3);
const system =
  "You read a structured agent-to-agent message and answer a question about it. " +
  "The message may be in JSON, columnar JSON, TOON, or ESF (a compact tab-delimited format " +
  "where a schema line like name[N]{a,b} is followed by N tab-separated rows). " +
  "Answer with ONLY the requested value, no explanation, no punctuation, no units.";

async function ask(model, encoded, question) {
  const { text } = await complete({ model, system, user: `MESSAGE:\n${encoded}\n\nQUESTION: ${question}`, maxTokens: 64 });
  return text.trim();
}

const results = {};
for (const [format, enc] of Object.entries(formats)) {
  results[format] = { tokens: o200kTokens(enc(document)), correct: 0, total: 0, byProbe: {}, misses: [] };
}
for (const model of models) {
  for (const [format, enc] of Object.entries(formats)) {
    const encoded = enc(document);
    for (const item of questions) {
      for (let r = 0; r < repeats; r++) {
        let got;
        try { got = await ask(model, encoded, item.q); } catch (e) { got = `ERROR: ${e.message}`; }
        const ok = norm(got) === norm(item.a) || norm(got).split(" ").includes(norm(item.a));
        const R = results[format];
        R.total += 1; R.byProbe[item.probes] = R.byProbe[item.probes] || { c: 0, t: 0 };
        R.byProbe[item.probes].t += 1;
        if (ok) { R.correct += 1; R.byProbe[item.probes].c += 1; }
        else R.misses.push({ model, probes: item.probes, want: item.a, got });
      }
    }
  }
}

const pct = (c, t) => (t ? `${((c / t) * 100).toFixed(0)}%` : "n/a");
const probeKeys = [...new Set(questions.map((q) => q.probes))];
let report = `# ESF Comprehension — HARD MODE\n\n`;
report += `Models: ${models.join(", ")} · ${repeats} repeats · ${questions.length} questions · ${N}-record block.\n`;
report += `Stresses deep indexing, column-matching, aggregation, and nested-cell extraction.\n\n`;
report += `| Format | o200k tokens | Accuracy | ${probeKeys.join(" | ")} |\n|---|---:|---:|${probeKeys.map(() => "---:").join("|")}|\n`;
for (const [format, r] of Object.entries(results)) {
  const cells = probeKeys.map((p) => pct(r.byProbe[p]?.c || 0, r.byProbe[p]?.t || 0));
  report += `| ${format} | ${r.tokens} | ${pct(r.correct, r.total)} | ${cells.join(" | ")} |\n`;
}
const misses = Object.entries(results).flatMap(([f, r]) => r.misses.map((m) => ({ format: f, ...m })));
if (misses.length) {
  report += `\n## Misses (${misses.length})\n\n| Format | Model | Probes | Wanted | Got |\n|---|---|---|---|---|\n`;
  for (const m of misses.slice(0, 60)) {
    report += `| ${m.format} | ${m.model} | ${m.probes} | \`${m.want}\` | \`${String(m.got).slice(0, 40)}\` |\n`;
  }
}
fs.writeFileSync(new URL("./COMPREHENSION-HARD.md", import.meta.url), report);
console.log(report);
