#!/usr/bin/env node
"use strict";
// Regression gate: compare a candidate result stamp against a reference stamp and
// exit non-zero if any shared variant regressed. Makes "SKILL.md changed" mean
// "the numbers were re-verified", instead of hoping someone eyeballs report.md.
//
//   node src/gate.js <candidate-stamp> <reference-stamp>
//
// Thresholds (env):
//   GATE_TESTS   max allowed test-pass drop, fraction        (default 0.02)
//   GATE_JUDGE   max allowed judge-median drop, points       (default 5)
//   GATE_OUTPUT  max allowed shrink of a variant's output-vs-baseline
//                reduction, fraction points                  (default 0.10)
//
// Only variants present in BOTH stamps are compared; judge/output rules need a
// baseline in both. Mock stamps gate against mock, live against live — mixing
// the two is meaningless and rejected.

const fs = require("fs");
const path = require("path");
const { aggregate } = require("./report");

const GATE_TESTS = Number(process.env.GATE_TESTS ?? 0.02);
const GATE_JUDGE = Number(process.env.GATE_JUDGE ?? 5);
const GATE_OUTPUT = Number(process.env.GATE_OUTPUT ?? 0.1);

const [cand, ref] = process.argv.slice(2);
if (!cand || !ref) {
  console.error("usage: node src/gate.js <candidate-stamp> <reference-stamp>");
  process.exit(2);
}

function load(stamp) {
  const file = path.join(__dirname, "..", "results", stamp, "results.json");
  const { meta, records } = JSON.parse(fs.readFileSync(file, "utf8"));
  const variants = [...new Set(records.map((r) => r.variant))];
  return { meta, rows: aggregate(records, variants, meta.model), variants };
}

const c = load(cand);
const r = load(ref);
if (Boolean(c.meta.mock) !== Boolean(r.meta.mock)) {
  console.error(`refusing to gate mock against live (${cand} mock=${!!c.meta.mock}, ${ref} mock=${!!r.meta.mock})`);
  process.exit(2);
}

// output-vs-baseline reduction, e.g. honey at -49% -> 0.49; null without a baseline
function reduction(rows, v) {
  const b = rows.baseline;
  return b && v !== "baseline" && b.output ? 1 - rows[v].output / b.output : null;
}

const shared = c.variants.filter((v) => r.variants.includes(v));
const failures = [];
const lines = [
  `gate: ${cand} vs ${ref} (model ${c.meta.model} vs ${r.meta.model})`,
  `| Variant | Tests Δ | Judge Δ | Out-vs-base Δ |`,
  `|---------|--------:|--------:|--------------:|`,
];

for (const v of shared) {
  const cv = c.rows[v];
  const rv = r.rows[v];
  const testsD = cv.passRate - rv.passRate;
  const judgeD = cv.judge - rv.judge;
  const cRed = reduction(c.rows, v);
  const rRed = reduction(r.rows, v);
  const redD = cRed != null && rRed != null ? cRed - rRed : null;

  if (testsD < -GATE_TESTS) failures.push(`${v}: tests ${(rv.passRate * 100).toFixed(0)}% -> ${(cv.passRate * 100).toFixed(0)}%`);
  if (judgeD < -GATE_JUDGE) failures.push(`${v}: judge ${rv.judge.toFixed(0)} -> ${cv.judge.toFixed(0)}`);
  if (redD != null && redD < -GATE_OUTPUT)
    failures.push(`${v}: output reduction ${(rRed * 100).toFixed(0)}% -> ${(cRed * 100).toFixed(0)}%`);

  lines.push(
    `| ${v} | ${(testsD * 100).toFixed(0)}pt | ${judgeD.toFixed(1)} | ${redD == null ? "—" : `${(redD * 100).toFixed(0)}pt`} |`
  );
}

console.log(lines.join("\n"));
if (failures.length) {
  console.error(`\nREGRESSION (thresholds: tests ${GATE_TESTS}, judge ${GATE_JUDGE}, output ${GATE_OUTPUT}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\nOK — no regression in ${shared.length} shared variants`);
