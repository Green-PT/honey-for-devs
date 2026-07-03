import { createRequire } from "node:module";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";
import { encode as toonEncode } from "@toon-format/toon";

const require = createRequire(import.meta.url);
const { encode: esoEncode } = require("../../eso");

// ESON's token win over columnar JSON is only real AFTER you pay to teach the model the
// format (a primer in the system prompt). Columnar JSON needs almost no primer (it's JSON).
// This accounts for that: minimal-but-sufficient primers, their token cost, and the
// break-even message count where ESON's per-message savings overcome its primer overhead.

const primers = {
  JSON: "", // models already know JSON; no dedicated primer needed.
  columnar:
    "Record arrays are columnar JSON: an object {\"#c\":[column names],\"#r\":[[row values],...]} " +
    "encodes a list of records sharing those columns. Rebuild each record by zipping #c with a #r row.",
  ESON:
    "Messages use ESON, a compact text format. The first line is the magic header !eson/1. " +
    "Then entries: `name=value` is a scalar (bare strings are unquoted; null, booleans, numbers, " +
    "and ambiguous or tab/newline strings use JSON). `name[N]{f1,f2}` declares N records sharing " +
    "fields f1,f2; each following line is one record with TAB-separated cells in field order. " +
    "`name[N]` is N scalar rows. `name{f1,f2}` is a single record. Nested objects and arrays " +
    "appear as JSON text inside a cell.",
};

// Per-message savings come from the real corpus (the 5 handoff docs), ESON vs columnar JSON.
const finding = (i) => ({ severity: ["high", "medium", "low"][i % 3], file: `src/module-${i}.js`, line: 10 + i, message: `Finding ${i}: validate input before operation ${i}` });
const datasets = {
  "small review": { from: "reviewer", to: "implementer", kind: "code_review", findings: Array.from({ length: 3 }, (_, i) => finding(i)), meta: { complete: true, retry: null, tags: ["security", "api"] } },
  "large review": { from: "reviewer", to: "implementer", kind: "code_review", id: "review-2026-0042", findings: Array.from({ length: 100 }, (_, i) => finding(i)) },
  "scalar envelope": { from: "planner", to: "worker", kind: "task", id: "task-7", priority: 2, blocking: false, instruction: "Run the focused tests and report failures" },
  "tool results": { from: "search-agent", to: "synthesis-agent", kind: "tool_results", results: Array.from({ length: 25 }, (_, i) => ({ rank: i + 1, source: `docs-${i}.example`, score: +(0.99 - i / 100).toFixed(2), title: `Result ${i} for structured agent communication`, excerpt: `Relevant passage ${i} containing the requested technical evidence.` })) },
};

const isRec = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const colEncode = (v) => {
  if (Array.isArray(v)) {
    if (v.length > 1 && v.every(isRec)) {
      const cols = Object.keys(v[0]);
      if (v.every((r) => { const k = Object.keys(r); return k.length === cols.length && k.every((x, i) => x === cols[i]); })) return { "#c": cols, "#r": v.map((r) => cols.map((c) => colEncode(r[c]))) };
    }
    return v.map(colEncode);
  }
  return isRec(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, colEncode(x)])) : v;
};

const primerTok = Object.fromEntries(Object.entries(primers).map(([k, v]) => [k, o200kTokens(v)]));
const pExtra = primerTok.ESON - primerTok.columnar; // extra one-time tokens ESON needs vs columnar

console.log("# Primer cost & ESON-vs-columnar break-even\n");
console.log("## One-time primer cost (system prompt, cacheable)\n");
console.log("| Format | Primer tokens |");
console.log("|---|---:|");
for (const [k, t] of Object.entries(primerTok)) console.log(`| ${k} | ${t} |`);
console.log(`\nESO needs **${pExtra}** more primer tokens than columnar JSON (one-time, cacheable).\n`);

console.log("## Per-message savings: ESON vs columnar JSON\n");
console.log("| Message shape | ESON tok | columnar tok | ESON saves |");
console.log("|---|---:|---:|---:|");
let totalEso = 0, totalCol = 0;
for (const [name, d] of Object.entries(datasets)) {
  const e = o200kTokens(esoEncode(d));
  const c = o200kTokens(JSON.stringify(colEncode(d)));
  totalEso += e; totalCol += c;
  console.log(`| ${name} | ${e} | ${c} | ${c - e > 0 ? "+" : ""}${c - e} |`);
}
const avgSave = (totalCol - totalEso) / Object.keys(datasets).length;
console.log(`\nAverage saving **${avgSave.toFixed(0)} tok/message** (range shows it is shape-dependent — scalar envelopes can be negative).\n`);

console.log("## Break-even (how many messages before ESON nets ahead of columnar)\n");
const breakeven = (save, cacheFactor) => {
  // cached: extra primer billed as p once at full + p*cacheFactor each later turn.
  // net(M) = save*M - p*(1 + cacheFactor*(M-1)); solve net>=0.
  // M >= p*(1 - cacheFactor) / (save - p*cacheFactor)
  const denom = save - pExtra * cacheFactor;
  if (denom <= 0) return Infinity;
  return Math.max(1, Math.ceil((pExtra * (1 - cacheFactor)) / denom));
};
console.log("| Scenario | Break-even messages |");
console.log("|---|---:|");
console.log(`| No prompt cache (primer re-sent every call) | ${breakeven(avgSave, 1) === Infinity ? "never" : breakeven(avgSave, 1)} |`);
console.log(`| Prompt cache at 10% read cost | ${breakeven(avgSave, 0.1)} |`);
console.log(`| Primer truly amortized (read ~free) | ${breakeven(avgSave, 0)} |`);
console.log(`\nWith average ${avgSave.toFixed(0)} tok/msg saving and a ${pExtra}-token extra primer:`);
console.log(`a cached agent pipeline recovers ESON's primer in a handful of messages; a low-volume`);
console.log(`or scalar-heavy one may never recover it. The decision is volume × message-shape.`);
