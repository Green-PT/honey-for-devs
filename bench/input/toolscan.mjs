// Scan real tool results: how many are large arrays CCR could crush, and how much it'd save.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { encode } from "gpt-tokenizer";
const require = createRequire(import.meta.url);
const { crush } = require("../../eso/ccr.js");
// override with PROJECT_DIR=~/.claude/projects/<slug> for any clone
const D = process.env.PROJECT_DIR ||
  join(process.env.HOME, ".claude/projects/-Users-robertkeus-Development-honey-by-greenpt");
if (!existsSync(D)) { console.error(`no transcript dir: ${D} (set PROJECT_DIR)`); process.exit(1); }
const tok = s => encode(typeof s==="string"?s:JSON.stringify(s)).length;

let total=0, totalTok=0, big=0, jsonArr=0, jsonArrTok=0, jsonArrSaved=0, lineHeavy=0, lineTok=0;
const sizes=[];
for (const f of readdirSync(D).filter(f=>f.endsWith(".jsonl"))) {
  for (const line of readFileSync(join(D,f),"utf8").split("\n")) {
    if (!line.trim()) continue;
    let o; try{o=JSON.parse(line);}catch{continue;}
    if (o.type!=="user"||!o.message) continue;
    const c=o.message.content;
    if (!Array.isArray(c)) continue;
    for (const b of c) {
      if (b.type!=="tool_result") continue;
      let text = typeof b.content==="string" ? b.content
        : Array.isArray(b.content) ? b.content.filter(x=>x.type==="text").map(x=>x.text).join("\n") : "";
      if (!text) continue;
      total++; const t=tok(text); totalTok+=t; sizes.push(t);
      if (t>=500) big++;
      // try parse as JSON array (whole or first [...] block)
      let arr=null;
      try { const j=JSON.parse(text); if(Array.isArray(j)) arr=j; } catch {}
      if (arr && arr.length>=5) {
        jsonArr++; jsonArrTok+=t;
        try { const {view,dropped}=crush(arr); if(dropped>0) jsonArrSaved += t - tok(view); } catch {}
      }
      // line-oriented heavy text (logs/grep): >=20 lines, would need a line-mode crusher
      const lines=text.split("\n").filter(Boolean);
      if (lines.length>=20 && t>=500) { lineHeavy++; lineTok+=t; }
    }
  }
}
sizes.sort((a,b)=>a-b);
const sum=sizes.reduce((a,b)=>a+b,0);
console.log(`tool results total:          ${total}   (${totalTok} tokens, ${(totalTok/1000).toFixed(0)}k)`);
console.log(`  >=500 tokens (big):        ${big}`);
console.log(`  parse as JSON array >=5:   ${jsonArr}   (${jsonArrTok} tok)  <- CCR works directly`);
console.log(`     CCR would save here:    ${jsonArrSaved} tok  (${(100*jsonArrSaved/(totalTok||1)).toFixed(1)}% of all tool tokens)`);
console.log(`  line-heavy text >=20 lines:${lineHeavy}   (${lineTok} tok)  <- needs a line-mode crusher`);
console.log(`  potential if line-mode ~60%:~${Math.round(lineTok*0.6)} tok (${(100*lineTok*0.6/(totalTok||1)).toFixed(1)}% of tool tokens)`);
console.log(`median tool result: ${sizes[Math.floor(sizes.length/2)]} tok   p90: ${sizes[Math.floor(sizes.length*0.9)]} tok   max: ${sizes[sizes.length-1]} tok`);
