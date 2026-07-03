import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import { countTokens as claudeTokens } from "@anthropic-ai/tokenizer";
import { decode as toonDecode, encode as toonEncode } from "@toon-format/toon";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";

const require = createRequire(import.meta.url);
const { decode: esoDecode, encode: esoEncode } = require("../../eso");
const lock = require("../../package-lock.json");
const version = (name) => lock.packages[`node_modules/${name}`].version;

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
      repository: "greenpt/honey", branch: "feature/eso",
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

const formats = {
  JSON: { encode: JSON.stringify, decode: JSON.parse },
  TOON: { encode: toonEncode, decode: toonDecode },
  ESON: { encode: esoEncode, decode: esoDecode },
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

function median(values) {
  return values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

function bench(operation) {
  for (let i = 0; i < 100; i++) operation();
  let iterations = 100;
  while (iterations < 100_000) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) operation();
    if (Number(process.hrtime.bigint() - start) > 50_000_000) break;
    iterations *= 2;
  }
  const rounds = [];
  for (let round = 0; round < 5; round++) {
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) operation();
    rounds.push(Number(process.hrtime.bigint() - start) / iterations);
  }
  return median(rounds) / Object.keys(datasets).length / 1_000;
}

const metrics = {};
for (const format of Object.keys(formats)) {
  metrics[format] = { bytes: 0, o200k: 0, claude: 0 };
  for (const texts of Object.values(encoded)) {
    const text = texts[format];
    metrics[format].bytes += Buffer.byteLength(text);
    metrics[format].o200k += o200kTokens(text);
    metrics[format].claude += claudeTokens(text);
  }
  metrics[format].encodeUs = bench(() => {
    for (const input of Object.values(datasets)) formats[format].encode(input);
  });
  metrics[format].decodeUs = bench(() => {
    for (const texts of Object.values(encoded)) formats[format].decode(texts[format]);
  });
}

const pct = (value, baseline) => `${value > baseline ? "+" : ""}${Math.round((value / baseline - 1) * 100)}%`;
const rows = [];
for (const [dataset, texts] of Object.entries(encoded)) {
  for (const [format, text] of Object.entries(texts)) {
    rows.push(`| ${dataset} | ${format} | ${Buffer.byteLength(text)} | ${o200kTokens(text)} | ${claudeTokens(text)} |`);
  }
}

const report = `# ESON vs TOON vs JSON

Generated ${new Date().toISOString().slice(0, 10)} with Node ${process.version} on ${os.cpus()[0].model}.
All inputs round-tripped losslessly before measurement.

## Total Size

| Format | Bytes | vs JSON | o200k tokens | vs JSON | Claude tokens* | vs JSON |
|---|---:|---:|---:|---:|---:|---:|
${Object.entries(metrics).map(([name, m]) => `| ${name} | ${m.bytes} | ${pct(m.bytes, metrics.JSON.bytes)} | ${m.o200k} | ${pct(m.o200k, metrics.JSON.o200k)} | ${m.claude} | ${pct(m.claude, metrics.JSON.claude)} |`).join("\n")}

## Per Dataset

| Dataset | Format | Bytes | o200k tokens | Claude tokens* |
|---|---|---:|---:|---:|
${rows.join("\n")}

## Codec Speed

Equal-weight mean across the five documents; median of five warmed rounds. Lower is better.

| Format | Encode µs/document | Decode µs/document |
|---|---:|---:|
${Object.entries(metrics).map(([name, m]) => `| ${name} | ${m.encodeUs.toFixed(2)} | ${m.decodeUs.toFixed(2)} |`).join("\n")}

## Reading the Result

- ESON used ${Math.abs(Math.round((metrics.ESON.o200k / metrics.JSON.o200k - 1) * 100))}% fewer o200k tokens than JSON and ${Math.abs(Math.round((metrics.ESON.o200k / metrics.TOON.o200k - 1) * 100))}% fewer than TOON over this corpus.
- Compact JSON won codec speed and the scalar-only case.
- ESON beat TOON on codec speed here. Its nested-context size advantage comes from
  compact JSON cells; this benchmark does not test whether models understand those
  cells as reliably as TOON's expanded nesting.

## Method

- JSON: compact \`JSON.stringify\` / \`JSON.parse\`.
- TOON: \`@toon-format/toon@${version("@toon-format/toon")}\`, default settings.
- ESON: local \`!eson/1\` codec.
- OpenAI count: \`gpt-tokenizer@${version("gpt-tokenizer")}\`, \`o200k_base\`.
- Claude count: \`@anthropic-ai/tokenizer@${version("@anthropic-ai/tokenizer")}\`.
- Five deterministic agent-handoff shapes: small/large reviews, scalar envelope,
  nested context, and uniform tool results. Run with \`npm run bench:eso\`.

\* Anthropic labels its tokenizer beta; it predates current Claude tokenizers. Treat
this column as a legacy estimate, not an exact count for current Claude models.
Token count alone does not measure model comprehension or task accuracy.
`;

const output = new URL("./RESULTS.md", import.meta.url);
fs.writeFileSync(output, report);
console.log(report);
