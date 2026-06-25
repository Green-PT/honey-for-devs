// Token bench for the deterministic input precompressor. No API.
// Measures input-token reduction (real tokenizer) per prompt, full vs compressed.
//   node bench/input/tokens.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { encode } from "gpt-tokenizer";

const require = createRequire(import.meta.url);
const { compress } = require("../../hooks/precompress.js");

const corpus = JSON.parse(readFileSync(new URL("./corpus.json", import.meta.url)));
const tok = (s) => encode(s).length;

let fullSum = 0,
  compSum = 0;
const rows = corpus.map((c) => {
  const { text } = compress(c.prompt);
  const f = tok(c.prompt),
    g = tok(text);
  fullSum += f;
  compSum += g;
  return { id: c.id, full: f, comp: g, cut: ((1 - g / f) * 100).toFixed(0) + "%" };
});

const w = (s, n) => String(s).padEnd(n);
console.log(w("id", 18) + w("full", 7) + w("comp", 7) + "cut");
for (const r of rows) console.log(w(r.id, 18) + w(r.full, 7) + w(r.comp, 7) + r.cut);
const total = ((1 - compSum / fullSum) * 100).toFixed(1);
console.log("-".repeat(36));
console.log(w("TOTAL", 18) + w(fullSum, 7) + w(compSum, 7) + total + "%");
console.log(`\nmedian cut: ${median(rows.map((r) => parseFloat(r.cut)))}%`);

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
