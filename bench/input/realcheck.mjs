// Reality check: run the precompressor on REAL human-typed prompts pulled from local
// Claude Code transcripts, and measure the actual token cut. Answers "does this fire on
// real traffic?" — vs the hand-written verbose corpus. No API.
//   node bench/input/realcheck.mjs                  # default project transcript dir
//   PROJECT_DIR=~/.claude/projects/<slug> node bench/input/realcheck.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { encode } from "gpt-tokenizer";
const require = createRequire(import.meta.url);
const { compress } = require("../../hooks/precompress.js");

const D = process.env.PROJECT_DIR ||
  join(process.env.HOME, ".claude/projects/-Users-robertkeus-Development-honey-by-greenpt");
if (!existsSync(D)) { console.error(`no transcript dir: ${D}`); process.exit(1); }
const tok = (s) => encode(s).length;

let prompts = [];
for (const f of readdirSync(D).filter((f) => f.endsWith(".jsonl"))) {
  for (const line of readFileSync(join(D, f), "utf8").split("\n")) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (o.type !== "user" || !o.message) continue;
    const c = o.message.content;
    let text = null;
    if (typeof c === "string") text = c;
    else if (Array.isArray(c) && !c.some((b) => b.type === "tool_result")) {
      const t = c.filter((b) => b.type === "text").map((b) => b.text);
      if (t.length) text = t.join("\n");
    }
    if (!text) continue;
    const s = text.trim();
    if (s.length < 8) continue;
    if (/^<(command-|local-command|user-)/.test(s)) continue; // slash-command envelopes
    if (text.includes("<system-reminder>") || text.includes("hook success")) continue; // injected
    prompts.push(text);
  }
}
prompts = [...new Set(prompts)]; // drop exact resends

let full = 0, comp = 0, eligible = 0;
const cuts = [];
for (const p of prompts) {
  const f = tok(p), g = tok(compress(p).text);
  full += f; comp += g;
  const cut = f ? (1 - g / f) * 100 : 0;
  cuts.push(cut);
  if (cut >= 3) eligible++;
}
cuts.sort((a, b) => a - b);
const med = cuts.length ? cuts[Math.floor(cuts.length / 2)] : 0;
const mean = cuts.reduce((a, b) => a + b, 0) / (cuts.length || 1);
const pad = (n) => String(n).padStart(7);
console.log(`real human-typed prompts (deduped): ${prompts.length}`);
console.log(`total prompt tokens:       ${pad(full)}`);
console.log(`after precompress:         ${pad(comp)}   ->  total cut ${(100 * (1 - comp / full)).toFixed(1)}%`);
console.log(`median per-prompt cut:     ${pad(med.toFixed(1))}%   (mean ${mean.toFixed(1)}%)`);
console.log(`prompts cutting >=3%:      ${pad(eligible)}   (${(100 * eligible / prompts.length).toFixed(0)}%)`);
console.log(`prompts cutting 0%:        ${pad(cuts.filter((x) => x < 0.5).length)}`);
console.log(`absolute tokens saved:     ${pad(full - comp)}   (across all ${prompts.length})`);
