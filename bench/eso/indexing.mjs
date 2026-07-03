import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";
import { encode as toonEncode } from "@toon-format/toon";

const require = createRequire(import.meta.url);
const { complete } = require("../src/client.js");
const { encode: esoEncode } = require("../../eso");

// The format shootout found ONE real quality gap: every format fails positional access
// ("the Nth row") and counting-across-rows. Those are model limitations, not format ones.
// Question: can a better STRUCTURE fix them cheaply? Hypothesis: an explicit row-number
// column (`n`) lets the model match position directly and read the last n as the count.
// This measures whether numbering rows buys accuracy, and what it costs in tokens.

const N = 50;
const sev = (i) => ["high", "medium", "low", "high", "medium"][i % 5];
const baseFindings = Array.from({ length: N }, (_, i) => ({
  severity: sev(i),
  file: `src/area-${i % 7}/module-${1000 + i}.js`,
  line: 200 + i * 3,
  owner: `team-${["auth", "api", "ui", "data"][i % 4]}`,
  ticket: `T-${4200 + i * 11}`,
}));
// Indexed variant: prepend a 1-based position field `n` to every record.
const idxFindings = baseFindings.map((f, i) => ({ n: i + 1, ...f }));
const doc = (findings) => ({ from: "reviewer", to: "implementer", kind: "code_review", findings });

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

const variants = {
  "JSON": { doc: doc(baseFindings), enc: (d) => JSON.stringify(d), indexed: false },
  "columnar": { doc: doc(baseFindings), enc: (d) => JSON.stringify(colEncode(d)), indexed: false },
  "columnar+n": { doc: doc(idxFindings), enc: (d) => JSON.stringify(colEncode(d)), indexed: true },
  "TOON": { doc: doc(baseFindings), enc: toonEncode, indexed: false },
  "ESON": { doc: doc(baseFindings), enc: esoEncode, indexed: false },
  "ESON+n": { doc: doc(idxFindings), enc: esoEncode, indexed: true },
};

const norm = (s) => String(s).toLowerCase().replace(/[\s."'`]+/g, " ").trim();
const pos = 37; // 1-indexed position
const ticketTarget = `T-${4200 + 41 * 11}`;
const byTicket = baseFindings.find((f) => f.ticket === ticketTarget);
const highCount = baseFindings.filter((f) => f.severity === "high").length;
const questions = [
  { q: `What is the \`owner\` of finding number ${pos} (1-indexed by position)? Answer with only the value.`,
    a: baseFindings[pos - 1].owner, probes: "deep-index" },
  { q: `What is the \`file\` of finding number ${pos} (1-indexed by position)? Answer with only the path.`,
    a: baseFindings[pos - 1].file, probes: "deep-index" },
  { q: "How many findings are there in total? Answer with only the number.",
    a: String(N), probes: "count-total" },
  { q: 'How many findings have `severity` equal to "high"? Answer with only the number.',
    a: String(highCount), probes: "count-match" },
  { q: `What is the \`owner\` of the finding whose \`ticket\` is ${ticketTarget}? Answer with only the value.`,
    a: byTicket.owner, probes: "key-lookup" },
];

const models = (process.env.ESO_MODELS || "claude-haiku-4-5-20251001,gpt-4.1-mini")
  .split(",").map((m) => m.trim()).filter(Boolean);
const repeats = Number(process.env.ESO_REPEATS || 3);
const baseSys =
  "You read a structured agent-to-agent message and answer a question about it. " +
  "Formats: JSON, columnar JSON ({\"#c\":cols,\"#r\":rows}), TOON, or ESON (compact, a schema " +
  "line name[N]{a,b} then N tab-separated rows). Answer with ONLY the requested value, no prose.";
const idxNote = " Each finding record has an `n` field giving its 1-based position in the list.";

async function ask(model, system, encoded, question) {
  const { text } = await complete({ model, system, user: `MESSAGE:\n${encoded}\n\nQUESTION: ${question}`, maxTokens: 64 });
  return text.trim();
}

const results = {};
for (const [name, v] of Object.entries(variants)) results[name] = { tokens: o200kTokens(v.enc(v.doc)), byProbe: {}, correct: 0, total: 0 };

for (const model of models) {
  for (const [name, v] of Object.entries(variants)) {
    const encoded = v.enc(v.doc);
    const system = baseSys + (v.indexed ? idxNote : "");
    for (const item of questions) {
      for (let r = 0; r < repeats; r++) {
        let got;
        try { got = await ask(model, system, encoded, item.q); } catch (e) { got = `ERROR: ${e.message}`; }
        const ok = norm(got) === norm(item.a) || norm(got).split(" ").includes(norm(item.a));
        const R = results[name];
        R.total += 1; R.byProbe[item.probes] = R.byProbe[item.probes] || { c: 0, t: 0 };
        R.byProbe[item.probes].t += 1;
        if (ok) { R.correct += 1; R.byProbe[item.probes].c += 1; }
      }
    }
  }
}

const pct = (c, t) => (t ? `${((c / t) * 100).toFixed(0)}%` : "n/a");
const probes = [...new Set(questions.map((q) => q.probes))];
const baseTok = results.JSON.tokens;
let report = `# Does numbering rows make a better structure?\n\n`;
report += `Models: ${models.join(", ")} · ${repeats} repeats · ${N}-record doc. \`+n\` = explicit position column.\n\n`;
report += `| Variant | o200k tokens | vs JSON | Accuracy | ${probes.join(" | ")} |\n|---|---:|---:|---:|${probes.map(() => "---:").join("|")}|\n`;
for (const [name, r] of Object.entries(results)) {
  const cells = probes.map((p) => pct(r.byProbe[p]?.c || 0, r.byProbe[p]?.t || 0));
  const vs = `${r.tokens > baseTok ? "+" : ""}${Math.round((r.tokens / baseTok - 1) * 100)}%`;
  report += `| ${name} | ${r.tokens} | ${vs} | ${pct(r.correct, r.total)} | ${cells.join(" | ")} |\n`;
}
report += `\nDeep-index and count-total should jump for \`+n\` variants if numbering helps;\n`;
report += `the token delta vs the un-numbered variant is the price of that robustness.\n`;
fs.writeFileSync(new URL("./INDEXING.md", import.meta.url), report);
console.log(report);
