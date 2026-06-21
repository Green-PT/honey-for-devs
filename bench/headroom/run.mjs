// Headroom SmartCrusher benchmark, measured with the SAME tokenizers as the
// format shootout (bench/eso/formats.mjs). Two parts:
//
//   PART A — REAL: replay the 17 recorded Rust-core SmartCrusher fixtures
//     (tests/parity/fixtures/smart_crusher) and measure input.content →
//     output.compressed token reduction. These outputs are byte-for-byte
//     what the shipped Rust crusher produces; we only re-tokenize them.
//
//   PART B — MODELED: apply SmartCrusher's documented selection algorithm
//     (first 30% + last 15% + change-points, cap 15 items, CCR sentinel)
//     to the two shootout datasets large enough to trigger it. This shows
//     what headroom would do to YOUR corpus. Clearly lossy (rows dropped).
//
// SmartCrusher is LOSSY: it drops array rows and offloads them to a local
// CCR cache, leaving a {"_ccr_dropped":"<<ccr:HASH N_rows_offloaded>>"}
// sentinel the model can call a tool to expand. So token deltas here are
// NOT comparable to the lossless TOON/ESF/columnar deltas — different axis.

import fs from "node:fs";
import { countTokens as claudeTokens } from "@anthropic-ai/tokenizer";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";

const FIX = new URL("./fixtures/", import.meta.url);
const tok = (s) => ({ o: o200kTokens(s), c: claudeTokens(s) });
const pct = (a, b) => `${a > b ? "+" : ""}${Math.round((a / b - 1) * 100)}%`;

// ─── PART A: real recorded fixtures ────────────────────────────────────────
const rows = [];
let sumInO = 0, sumOutO = 0, sumInC = 0, sumOutC = 0;
for (const f of fs.readdirSync(FIX).filter((f) => f.endsWith(".json"))) {
  const d = JSON.parse(fs.readFileSync(new URL(f, FIX)));
  // input.content is the raw string fed to the crusher; output.compressed
  // is what it returned (a JSON string, or the original on passthrough).
  const inText = typeof d.input === "string" ? d.input : d.input.content;
  const out = d.output;
  const outText = typeof out === "string" ? out : (out.compressed ?? out.content ?? JSON.stringify(out));
  if (inText == null || outText == null) continue;
  const i = tok(inText), o = tok(outText);
  sumInO += i.o; sumOutO += o.o; sumInC += i.c; sumOutC += o.c;
  rows.push({ label: d.label, inO: i.o, outO: o.o, d: pct(o.o, i.o), crushed: outText !== inText });
}
rows.sort((a, b) => a.inO - b.inO);

// ─── PART B: model SmartCrusher on the shootout corpus ──────────────────────
const finding = (i) => ({
  severity: ["high", "medium", "low"][i % 3],
  file: `src/module-${i}.js`, line: 10 + i,
  message: `Finding ${i}: validate input before operation ${i}`,
});
const corpus = {
  "large review (100 findings)": Array.from({ length: 100 }, (_, i) => finding(i)),
  "tool results (25 results)": Array.from({ length: 25 }, (_, i) => ({
    rank: i + 1, source: `docs-${i}.example`, score: +(0.99 - i / 100).toFixed(2),
    title: `Result ${i} for structured agent communication`,
    excerpt: `Relevant passage ${i} containing the requested technical evidence.`,
  })),
};

// Faithful model of the documented Rust defaults:
//   min_items_to_analyze=5, max_items_after_crush=15,
//   first_fraction=0.3, last_fraction=0.15, preserve_change_points=true.
// Change-point = item whose first "category-ish" field value differs from
// the previous item's (mirrors the fixtures: every `warn`/`error` row kept).
function smartCrushModel(arr) {
  const n = arr.length;
  if (n < 5) return { kept: arr, dropped: 0, sentinel: false };
  const keep = new Set();
  const head = Math.max(1, Math.floor(n * 0.3));
  const tail = Math.max(1, Math.floor(n * 0.15));
  for (let i = 0; i < head; i++) keep.add(i);
  for (let i = n - tail; i < n; i++) keep.add(i);
  // change-points on the first string field that looks categorical
  const catKey = Object.keys(arr[0]).find((k) => typeof arr[0][k] === "string");
  if (catKey) {
    for (let i = 1; i < n; i++) if (arr[i][catKey] !== arr[i - 1][catKey]) { keep.add(i); keep.add(i - 1); }
  }
  let idx = [...keep].sort((a, b) => a - b);
  if (idx.length > 15) { // cap: keep evenly spaced 15
    const step = idx.length / 15;
    idx = Array.from({ length: 15 }, (_, k) => idx[Math.floor(k * step)]);
  }
  const kept = idx.map((i) => arr[i]);
  const dropped = n - kept.length;
  if (dropped > 0) kept.push({ _ccr_dropped: `<<ccr:0000000000000000 ${dropped}_rows_offloaded>>` });
  return { kept, dropped, sentinel: dropped > 0 };
}

const partB = [];
for (const [name, arr] of Object.entries(corpus)) {
  const base = JSON.stringify(arr);
  const { kept, dropped } = smartCrushModel(arr);
  const crushed = JSON.stringify(kept);
  partB.push({ name, n: arr.length, baseO: o200kTokens(base), outO: o200kTokens(crushed),
    d: pct(o200kTokens(crushed), o200kTokens(base)), dropped });
}

// ─── report ────────────────────────────────────────────────────────────────
let r = `# Headroom SmartCrusher — measured on honey's tokenizers\n\n`;
r += `Generated ${new Date().toISOString().slice(0, 10)}. o200k = gpt-tokenizer; Claude = @anthropic-ai/tokenizer.\n`;
r += `SmartCrusher is LOSSY (drops rows → CCR cache). Deltas are NOT comparable to lossless TOON/ESF/columnar.\n\n`;

r += `## Part A — real recorded Rust-core fixtures (input → crushed output)\n\n`;
r += `| Fixture | in o200k | out o200k | Δ | crushed? |\n|---|---:|---:|---:|:--:|\n`;
for (const x of rows) r += `| ${x.label} | ${x.inO} | ${x.outO} | ${x.d} | ${x.crushed ? "yes" : "passthrough"} |\n`;
r += `| **TOTAL** | **${sumInO}** | **${sumOutO}** | **${pct(sumOutO, sumInO)}** | (o200k) |\n`;
r += `| **TOTAL** | **${sumInC}** | **${sumOutC}** | **${pct(sumOutC, sumInC)}** | (Claude) |\n\n`;

r += `## Part B — modeled on the shootout corpus (only ≥5-item uniform arrays trigger)\n\n`;
r += `| Dataset | items | compact JSON o200k | crushed o200k | Δ | rows dropped→CCR |\n|---|---:|---:|---:|---:|---:|\n`;
for (const x of partB) r += `| ${x.name} | ${x.n} | ${x.baseO} | ${x.outO} | ${x.d} | ${x.dropped} |\n`;
r += `\nThe other 3 shootout datasets (small review=3 findings, scalar envelope, nested context) are **passthrough** — below the 5-item / 200-token gate.\n`;

fs.writeFileSync(new URL("./RESULTS.md", import.meta.url), r);
console.log(r);
