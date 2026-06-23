"use strict";
// User-facing showcase: run ONE landing-page prompt through honey/ponytail/caveman over the
// real `claude` CLI, save each rendered page, and build an HTML comparison (live iframes +
// metrics) you open in a browser. Same clean control as cli-bench.js (no Honey hook leakage).

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { gradeWeb } = require("./grade-web");
const eco = require("../../hooks/eco");

const ROOT = path.resolve(__dirname, "../..");
const MODEL = process.env.MODEL || "claude-opus-4-8";
const OUT = process.env.OUT || path.join(os.homedir(), "Desktop", "greenpt-landing");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "honeyshow-"));

const PROMPT = process.env.PROMPT ||
  `Create a landing page for greenpt.com — a privacy-first, low-carbon European AI gateway ` +
  `(a sustainable ChatGPT/LLM-API alternative hosted on green energy in the EU).\n\n` +
  `Single self-contained index.html with inline CSS (no external files or frameworks). Include: ` +
  `a sticky top nav with the product name and a CTA button; a hero with headline, subhead, and ` +
  `primary CTA; a features section with three feature cards; a simple pricing section; and a footer. ` +
  `Make it look polished and on-brand (green, sustainable). Put the whole page in one HTML code block.`;

const VARIANTS = {
  honey: fs.readFileSync(path.join(ROOT, "skills/honey/SKILL.md"), "utf8"),
  ponytail: fs.readFileSync(path.join(ROOT, "bench/variants/ponytail.md"), "utf8"),
  caveman: fs.readFileSync(path.join(ROOT, "bench/variants/caveman.md"), "utf8"),
};
const CHECKS = ["doctype", "title", "viewport", "h1", "nav", "footer", "css", "cta", "img_alt", "responsive"];

function gen(prompt, system) {
  const args = ["-p", prompt, "--setting-sources", "project", "--output-format", "json", "--model", MODEL];
  if (system) args.push("--append-system-prompt", system);
  const d = JSON.parse(execFileSync("claude", args, { cwd: WORK, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  if (d.is_error) throw new Error(`CLI: ${d.result}`);
  const u = d.usage || {};
  return { text: d.result || "", out: u.output_tokens || 0, cost: d.total_cost_usd || 0, ms: d.duration_ms || 0 };
}
const htmlBlock = (t) => { const m = t.match(/```(?:html)?\s*([\s\S]*?)```/i); return (m ? m[1] : t).trim(); };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

(function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const order = ["honey", "ponytail", "caveman"];
  const results = {};
  for (const v of order) {
    process.stdout.write(`generating ${v}...\n`);
    const g = gen(PROMPT, VARIANTS[v]);
    const html = htmlBlock(g.text);
    fs.writeFileSync(path.join(OUT, `${v}.html`), html);
    const grade = gradeWeb({ meta: { checks: CHECKS } }, html);
    results[v] = { out: g.out, cost: g.cost, bytes: html.length, ms: g.ms,
      passed: grade.passed, detail: grade.detail, co2: eco.estimate(MODEL, g.out).gco2 };
    process.stdout.write(`  ${v}: out=${g.out} bytes=${html.length} pass=${grade.passed} ${grade.detail}\n`);
  }

  const card = (v) => {
    const r = results[v];
    return `<section class="card">
      <header><h2>${v}</h2>
        <p class="meta">${r.out} out-tok · ${r.bytes} bytes · ${r.co2.toFixed(1)} g CO₂ · $${r.cost.toFixed(3)} ·
        <span class="${r.passed ? "ok" : "bad"}">${r.passed ? "✓ all checks" : "✗ " + esc(r.detail)}</span></p>
      </header>
      <iframe src="${v}.html" title="${v} landing page" loading="lazy"></iframe>
      <a class="open" href="${v}.html" target="_blank">open ${v}.html ↗</a>
    </section>`;
  };

  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>greenpt.com landing — honey vs ponytail vs caveman</title>
<style>
  :root{--bg:#0e1512;--fg:#e8f0ec;--mut:#9fb3aa;--line:#22302a;--ok:#4ade80;--bad:#f87171;--accent:#34d399}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}
  header.top{padding:28px 24px;border-bottom:1px solid var(--line)}
  header.top h1{margin:0;font-size:1.4rem}
  header.top p{margin:6px 0 0;color:var(--mut)}
  .grid{display:grid;gap:20px;padding:24px;grid-template-columns:repeat(auto-fit,minmax(360px,1fr))}
  .card{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#121b17;display:flex;flex-direction:column}
  .card header{padding:14px 16px;border-bottom:1px solid var(--line)}
  .card h2{margin:0;text-transform:capitalize;color:var(--accent)}
  .meta{margin:6px 0 0;font-size:.82rem;color:var(--mut)}
  .ok{color:var(--ok)}.bad{color:var(--bad)}
  iframe{width:100%;height:560px;border:0;background:#fff}
  .open{display:block;padding:10px 16px;color:var(--accent);text-decoration:none;font-size:.85rem;border-top:1px solid var(--line)}
  .open:hover{background:#16221d}
</style></head>
<body>
<header class="top">
  <h1>greenpt.com landing page — 3 skills, same prompt, real <code>claude</code> CLI</h1>
  <p>Model <code>${MODEL}</code>. Each panel is the live page that variant generated. Metrics are output tokens / bytes / CO₂ / cost. Honey wins only if it stays fully passing while cutting volume.</p>
</header>
<div class="grid">
  ${order.map(card).join("\n")}
</div>
</body></html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), page);
  process.stdout.write(`\nWrote ${path.join(OUT, "index.html")} (+ ${order.map((v) => v + ".html").join(", ")})\n`);
})();
