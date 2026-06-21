import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import { countTokens as claudeTokens } from "@anthropic-ai/tokenizer";
import { decode as toonDecode, encode as toonEncode } from "@toon-format/toon";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";

const require = createRequire(import.meta.url);
const { decode: esfDecode, encode: esfEncode } = require("../../esf");
const lock = require("../../package-lock.json");
const version = (name) => lock.packages[`node_modules/${name}`].version;

// Broaden the field beyond JSON/TOON/ESF. The question this answers: is a custom
// format (ESF) actually worth it for agent-to-agent messages, or does "just compress
// the JSON" (columnar JSON — still valid JSON, parseable by every model and stdlib)
// capture most of the win at a fraction of the quality risk?
//
// Binary formats (CBOR, MessagePack, protobuf) are excluded on purpose: they tokenize
// terribly for LLMs (no learned merges over arbitrary bytes), so they are irrelevant to
// agent-to-agent communication where the wire is a token stream, not a socket.

const finding = (i) => ({
  severity: ["high", "medium", "low"][i % 3],
  file: `src/module-${i}.js`,
  line: 10 + i,
  message: `Finding ${i}: validate input before operation ${i}`,
});

const datasets = {
  "small review": {
    from: "reviewer", to: "implementer", kind: "code_review",
    findings: Array.from({ length: 3 }, (_, i) => finding(i)),
    meta: { complete: true, retry: null, tags: ["security", "api"] },
  },
  "large review": {
    from: "reviewer", to: "implementer", kind: "code_review", id: "review-2026-0042",
    findings: Array.from({ length: 100 }, (_, i) => finding(i)),
  },
  "scalar envelope": {
    from: "planner", to: "worker", kind: "task", id: "task-7",
    priority: 2, blocking: false, instruction: "Run the focused tests and report failures",
  },
  "nested context": {
    from: "orchestrator", to: "worker", kind: "implementation",
    context: {
      repository: "greenpt/honey", branch: "feature/esf",
      constraints: ["no new runtime dependencies", "preserve public API"],
      environment: { runtime: "node", version: 22 },
    },
    steps: Array.from({ length: 8 }, (_, i) => ({
      id: i + 1, status: i < 3 ? "done" : "pending",
      input: { path: `src/module-${i}.js`, symbols: [`run${i}`, `verify${i}`] },
    })),
  },
  "tool results": {
    from: "search-agent", to: "synthesis-agent", kind: "tool_results",
    results: Array.from({ length: 25 }, (_, i) => ({
      rank: i + 1, source: `docs-${i}.example`, score: +(0.99 - i / 100).toFixed(2),
      title: `Result ${i} for structured agent communication`,
      excerpt: `Relevant passage ${i} containing the requested technical evidence.`,
    })),
  },
};

// --- Columnar JSON ("compressed JSON") ------------------------------------
// Lossless transform: a uniform array of records becomes {"#c":[cols],"#r":[[...]]}.
// Stays valid JSON, so any model/stdlib parses it; only the key-repetition is removed.
const isRec = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function colEncode(v) {
  if (Array.isArray(v)) {
    if (v.length > 1 && v.every(isRec)) {
      const cols = Object.keys(v[0]);
      const uniform = v.every((r) => {
        const k = Object.keys(r);
        return k.length === cols.length && k.every((x, i) => x === cols[i]);
      });
      if (uniform) return { "#c": cols, "#r": v.map((r) => cols.map((c) => colEncode(r[c]))) };
    }
    return v.map(colEncode);
  }
  if (isRec(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, colEncode(x)]));
  return v;
}
function colDecode(v) {
  if (Array.isArray(v)) return v.map(colDecode);
  if (isRec(v)) {
    if (Array.isArray(v["#c"]) && Array.isArray(v["#r"])) {
      return v["#r"].map((row) => Object.fromEntries(v["#c"].map((c, i) => [c, colDecode(row[i])])));
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, colDecode(x)]));
  }
  return v;
}

const formats = {
  "JSON (compact)": { encode: (d) => JSON.stringify(d), decode: JSON.parse },
  "JSON (pretty)": { encode: (d) => JSON.stringify(d, null, 2), decode: JSON.parse },
  "JSON (columnar)": { encode: (d) => JSON.stringify(colEncode(d)), decode: (s) => colDecode(JSON.parse(s)) },
  TOON: { encode: toonEncode, decode: toonDecode },
  ESF: { encode: esfEncode, decode: esfDecode },
};

const encoded = {};
for (const [dataset, input] of Object.entries(datasets)) {
  encoded[dataset] = {};
  for (const [format, codec] of Object.entries(formats)) {
    const text = codec.encode(input);
    assert.deepEqual(codec.decode(text), input, `${format} failed ${dataset} round-trip`);
    encoded[dataset][format] = text;
  }
}

const metrics = {};
for (const format of Object.keys(formats)) {
  metrics[format] = { bytes: 0, o200k: 0, claude: 0 };
  for (const texts of Object.values(encoded)) {
    metrics[format].bytes += Buffer.byteLength(texts[format]);
    metrics[format].o200k += o200kTokens(texts[format]);
    metrics[format].claude += claudeTokens(texts[format]);
  }
}

const base = metrics["JSON (compact)"];
const pct = (v, b) => `${v > b ? "+" : ""}${Math.round((v / b - 1) * 100)}%`;

const perDataset = [];
for (const [dataset, texts] of Object.entries(encoded)) {
  for (const [format, text] of Object.entries(texts)) {
    perDataset.push(`| ${dataset} | ${format} | ${Buffer.byteLength(text)} | ${o200kTokens(text)} | ${pct(o200kTokens(text), o200kTokens(texts["JSON (compact)"]))} |`);
  }
}

const report = `# Agent-to-Agent Format Shootout

Generated ${new Date().toISOString().slice(0, 10)} with Node ${process.version} on ${os.cpus()[0].model}.
All formats round-tripped losslessly before measurement. Lower tokens = cheaper; valid
JSON = no custom parser and lower comprehension risk. Token count is efficiency, not quality.

## Total (5 agent-handoff documents)

| Format | Valid JSON? | Bytes | o200k tokens | vs JSON | Claude tokens* | vs JSON |
|---|:--:|---:|---:|---:|---:|---:|
${Object.entries(metrics).map(([n, m]) => `| ${n} | ${n.startsWith("JSON") ? "yes" : "no"} | ${m.bytes} | ${m.o200k} | ${pct(m.o200k, base.o200k)} | ${m.claude} | ${pct(m.claude, base.claude)} |`).join("\n")}

## Per Dataset (o200k tokens)

| Dataset | Format | Bytes | o200k tokens | vs JSON |
|---|---|---:|---:|---:|
${perDataset.join("\n")}

## Reading the Result

- **JSON (pretty)** is the realistic baseline models emit unprompted — the most wasteful.
- **JSON (columnar)** keeps full JSON validity (every model + stdlib parses it) while
  deduping record keys. It captures most of the structural win with near-zero quality risk.
- **TOON / ESF** drop JSON punctuation too, so they edge columnar JSON on tokens, but
  require a custom parser and put comprehension at stake — the axis this size bench cannot
  measure. See \`comprehension.mjs\` (needs an API key) for that half.
- The efficiency gap between columnar JSON and ESF is the price of leaving JSON-land.
  If that gap is small, "just compress the JSON" may be the better quality-adjusted choice.

## Method

- TOON: \`@toon-format/toon@${version("@toon-format/toon")}\`. ESF: local \`!esf/1\` codec.
- Columnar JSON: uniform record arrays → \`{"#c":[cols],"#r":[rows]}\`, still valid JSON.
- OpenAI count: \`gpt-tokenizer@${version("gpt-tokenizer")}\` o200k_base. Claude: \`@anthropic-ai/tokenizer@${version("@anthropic-ai/tokenizer")}\`.
- Run with \`npm run bench:formats\`.

\* Anthropic's tokenizer is a legacy estimate, not an exact count for current Claude models.
`;

fs.writeFileSync(new URL("./FORMATS.md", import.meta.url), report);
console.log(report);
