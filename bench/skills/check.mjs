// Honey skills — live behavioral benchmark.
//
// For each model-dependent skill: run the SAME task with no skill (baseline) and
// with the skill as system prompt, measure output tokens from the API usage, and
// apply an OBJECTIVE check (did it actually do the thing). One run each — this is
// a "does it work + how much does it save" probe, not a leaderboard.
//
//   ANTHROPIC_API_KEY=sk-... node bench/skills/check.mjs
//
// Skills tested live here: honey (core), honey-review, honey-compress,
// hive-reviewer, honey-hive (routing). hive-scout / hive-builder need real tool
// access (file search / edits) so they can't be bare-API benchmarked — their
// numbers come from the offline format gate (bench/hive) + the live relay run.
// honey-eco / honey-gain are deterministic (no model) and tested separately.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const KEY = process.env.ANTHROPIC_API_KEY;
const OPUS = "claude-opus-4-8";
const HAIKU = "claude-haiku-4-5-20251001";
if (!KEY) { console.error("set ANTHROPIC_API_KEY"); process.exit(1); }

// Skill/agent body with YAML frontmatter stripped.
function body(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), "utf8");
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

async function ask(model, system, user, max = 1500) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: max,
      ...(system ? { system } : {}),
      messages: [{ role: "user", content: user }],
    }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return { text: j.content.map((b) => b.text || "").join(""), out: j.usage.output_tokens };
}

// Extract the first JSON object from a reply (skilled agents may still fence it).
function firstJSON(t) {
  const m = t.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// --- Task inputs ----------------------------------------------------------

const REVIEW_DIFF = `Review this diff. Report what to cut.
\`\`\`diff
+def flatten(xs):
+    out = []
+    for x in xs:
+        if isinstance(x, list):
+            for y in flatten(x):
+                out.append(y)
+        else:
+            out.append(x)
+    return out
+
+def scale(n, factor, unused_opts=None):   # unused_opts never read
+    return n * factor
\`\`\``;

const VERBOSE_DOC = `Compress this project memory file.
---
# Project rules
Please always make sure that you run the test suite before committing any code. [R1:tests-before-commit]
It is really important that you never, ever commit secrets or API keys to the repository. [R2:no-secrets]
When you write database migrations, you must make them reversible so they can be rolled back. [R3:reversible-migrations]
Try to use TypeScript strict mode for all new files that you create going forward. [R4:strict-mode]
All user input coming from the network should be validated at the boundary before use. [R5:validate-input]
We prefer small, focused pull requests over giant ones that change everything at once. [R6:small-prs]
---
Keep every rule. The tags like [R1:...] mark distinct rules — preserve all of them.`;

const FINDINGS = `You are a code-review subagent. Return your findings to the orchestrator agent. Findings:
- id F1, severity H, file app/auth.js, line 42, rule no-rate-limit, "login lacks rate limiting"
- id F2, severity M, file src/db.js, line 88, rule sql-string, "query built by string concat"
- id F3, severity L, file src/util.js, line 12, rule unused-var, "tmp is unused"
- id F4, severity H, file app/api.js, line 130, rule missing-authz, "admin route has no authz"
- id F5, severity M, file src/cache.js, line 55, rule stale-ttl, "cache TTL never refreshed"
- id F6, severity L, file src/log.js, line 7, rule console-log, "stray console.log"
- id F7, severity H, file src/upload.js, line 200, rule path-traversal, "filename not sanitized"
- id F8, severity M, file app/form.js, line 64, rule no-validation, "email not validated"
- id F9, severity L, file src/style.css, line 3, rule unused-class, ".btn-old unused"
- id F10, severity M, file src/api.js, line 99, rule n-plus-one, "N+1 query in loop"`;

// --- Benchmark cases ------------------------------------------------------
// Each: baseline (no skill) vs skilled, measure tokens, objective check on skilled.

const CASES = [
  {
    name: "honey (core)", model: OPUS, system: body("skills/honey/SKILL.md"),
    user: "Write a Python function flatten(xs) that flattens an arbitrarily nested list of ints.",
    check: (t) => ({ pass: /def\s+flatten/.test(t), note: /def\s+flatten/.test(t) ? "produced flatten()" : "no function" }),
  },
  {
    name: "honey-review", model: OPUS, system: body("skills/honey-review/SKILL.md"),
    user: REVIEW_DIFF,
    check: (t) => {
      const bloat = /flatten|itertools|chain/i.test(t);
      const param = /unused|opts|param/i.test(t);
      return { pass: bloat && param, note: `${bloat ? "✓flatten" : "✗flatten"} ${param ? "✓unused-param" : "✗unused-param"}` };
    },
  },
  {
    name: "honey-compress", model: OPUS, system: body("skills/honey-compress/SKILL.md"),
    user: VERBOSE_DOC, inputSide: true, // benefit is smaller re-read file, not smaller response — Δ here is N/A
    check: (t) => {
      const kws = [/test/i, /secret|key/i, /revers|migrat/i, /strict|typescript/i, /valid/i, /pull request|small.*PR|focused/i];
      const kept = kws.filter((re) => re.test(t)).length;
      return { pass: kept === 6, note: `${kept}/6 rules preserved` };
    },
  },
  {
    name: "hive-reviewer", model: HAIKU, system: body("agents/hive-reviewer.md"),
    user: FINDINGS, baselineUser: FINDINGS,
    check: (t) => {
      const j = firstJSON(t);
      const n = j && (j.r ? j.r.length : Array.isArray(j.findings) ? j.findings.length : 0);
      return { pass: n === 10, note: j ? `recovered ${n}/10 findings, valid JSON` : "no parseable JSON" };
    },
  },
];

// honey-hive is a router — probe its decisions, no baseline/tokens.
const ROUTING = [
  { q: "Scenario: I need to find every caller of requireAuth() across a 300-file repo. Delegate to a hive subagent, or work inline? Answer with one word: delegate or inline.", want: /delegate/i },
  { q: "Scenario: fix a typo on line 3 of README.md, a file already open in context. Delegate to a hive subagent, or work inline? Answer with one word: delegate or inline.", want: /inline/i },
];

// --- Run ------------------------------------------------------------------

console.log("# Honey skills — live behavioral benchmark\n");
console.log("| Skill | Model | Baseline tok | Skilled tok | Δ tok | Works? | Check |");
console.log("|---|---|---:|---:|---:|:--:|---|");

for (const c of CASES) {
  try {
    const skl = await ask(c.model, c.system, c.user);
    const v = c.check(skl.text);
    const mdl = c.model.includes("haiku") ? "haiku" : "opus";
    if (c.inputSide) {
      // Input-side skill: response-token delta is the wrong axis. Report correctness only.
      console.log(`| ${c.name} | ${mdl} | n/a | ${skl.out} | n/a¹ | ${v.pass ? "✅" : "❌"} | ${v.note} |`);
    } else {
      const base = await ask(c.model, null, c.baselineUser || c.user);
      const d = Math.round(((skl.out - base.out) / base.out) * 100);
      console.log(`| ${c.name} | ${mdl} | ${base.out} | ${skl.out} | ${d > 0 ? "+" : ""}${d}% | ${v.pass ? "✅" : "❌"} | ${v.note} |`);
    }
    if (!v.pass) process.exitCode = 1;
  } catch (e) {
    console.log(`| ${c.name} | — | — | — | — | ⚠️ | ${e.message} |`);
    process.exitCode = 1;
  }
}

console.log("\n¹ honey-compress is an input-side skill: it shrinks a file re-read every session, so the one-time response is *larger* by design. Its win is fewer input tokens on every future load; the gate here is lossless rule preservation.");

console.log("\n## honey-hive routing decisions\n");
const hiveBody = body("skills/honey-hive/SKILL.md");
for (const r of ROUTING) {
  try {
    const a = await ask(HAIKU, hiveBody, r.q, 20);
    const pass = r.want.test(a.text);
    console.log(`- ${pass ? "✅" : "❌"} \`${a.text.trim().slice(0, 20)}\` — expected ${r.want.source}`);
    if (!pass) process.exitCode = 1;
  } catch (e) {
    console.log(`- ⚠️ ${e.message}`); process.exitCode = 1;
  }
}

console.log(process.exitCode ? "\nSome checks FAILED." : "\nAll live checks passed.");
