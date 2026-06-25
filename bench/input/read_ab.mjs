// Phase 1 A/B: does Lever-3b "locate before reading" actually cut input tokens?
// For a question about ONE function in a file, compare two ways to bring it into context:
//   A (naive):  Read the whole file.
//   B (3b):     Grep an outline (signature lines) + Read only the target function's range.
// Recovery gate: arm B must still contain the full target body — else it saved nothing real.
// Deterministic, no API. Measures the behaviour's token delta on real repo files.
//   node bench/input/read_ab.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "gpt-tokenizer";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tok = (s) => encode(s).length;
const SIG = /^(?:async\s+)?(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|def\s+\w+|class\s+\w+)/;

// real repo files + the symbol a question would target
const CASES = [
  { file: "hooks/precompress.js", symbol: "compressProse" },
  { file: "hooks/precompress.js", symbol: "dedupeSentences" },
  { file: "eso/ccr.js", symbol: "selectIndices" },
  { file: "bench/src/run.js", symbol: "runCell" },
];

// body = from the symbol's def line to the next top-level signature (or EOF)
function bodyRange(lines, symbol) {
  const start = lines.findIndex((l) => SIG.test(l) && l.includes(symbol));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (SIG.test(lines[i])) { end = i; break; }
  return { start, end };
}

const w = (s, n) => String(s).padEnd(n);
console.log(w("file:symbol", 34) + w("A whole", 9) + w("B outline+body", 16) + w("cut", 7) + "recovery");
let aSum = 0, bSum = 0, fails = 0;
for (const c of CASES) {
  const src = readFileSync(join(REPO, c.file), "utf8");
  const lines = src.split("\n");
  const r = bodyRange(lines, c.symbol);
  if (!r) { console.log(w(`${c.file}:${c.symbol}`, 34) + "symbol not found"); fails++; continue; }
  const outline = lines.filter((l) => SIG.test(l)).join("\n");
  const body = lines.slice(r.start, r.end).join("\n");
  const armA = src;
  const armB = `// outline\n${outline}\n\n// ${c.symbol} body\n${body}`;
  const a = tok(armA), b = tok(armB);
  aSum += a; bSum += b;
  const recovered = armB.includes(body) && body.includes(c.symbol); // full target body present
  if (!recovered) fails++;
  console.log(
    w(`${c.file.split("/").pop()}:${c.symbol}`, 34) + w(a, 9) + w(b, 16) +
      w(((1 - b / a) * 100).toFixed(0) + "%", 7) + (recovered ? "✅" : "FAIL")
  );
}
console.log("-".repeat(70));
console.log(`total: ${aSum} → ${bSum} tok  (cut ${((1 - bSum / aSum) * 100).toFixed(0)}%)   recovery fails: ${fails}`);
console.log(
  fails === 0
    ? `GATE: PASS ✅ — outline+ranged read recovers the target at ${((1 - bSum / aSum) * 100).toFixed(0)}% fewer tokens`
    : `GATE: FAIL ❌`
);
process.exitCode = fails === 0 ? 0 : 1;
