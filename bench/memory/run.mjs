// Honey memory — offline cold-start benchmark.
//
// honey-memory is an INPUT-side skill: a committed memory file (PROJECT.md /
// CLAUDE.md) replaces the rediscovery an agent re-pays every cold session
// (re-grepping the same files to re-learn where things live, the build command,
// why X is shaped Y). So the axis is context tokens at cold start, not response
// size.
//
//   node bench/memory/run.mjs                          # inline fixture (default gate)
//   node bench/memory/run.mjs <repoDir> [memFile] [questions.json]   # real repo
//
// Reproducible — no API, no model. For each cold-start question we measure:
//   rediscovery = tokens of the source files an agent must read to answer cold
//   memory      = tokens of the memory file (read once per session)
// and gate correctness: every asked fact must be present in the memory file, and
// the "why/decision" facts must be ABSENT from all source (proving intent is not
// recoverable from code — memory is its only source, not merely a cheaper one).
//
// Exits non-zero if memory loses on greppable facts, drops an asked fact, or if
// an intent fact turns out to be recoverable from source (unfair fixture).

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { countTokens as claudeTokens } from "@anthropic-ai/tokenizer";
import { countTokens as o200kTokens } from "gpt-tokenizer/encoding/o200k_base";

const tok = (s) => ({ claude: claudeTokens(s), gpt: o200kTokens(s) });
const pct = (a, b) => Math.round(((a - b) / b) * 100);

// --- Measurement + gate + report (shared by fixture and real-repo modes) ---
// memText: the memory file's content.
// questions: [{q, kind:"greppable"|"intent", files:[paths], answer:string}]
// readFile(path) -> source text. intentHits(answer) -> repo-wide occurrence count.
function bench({ label, memText, questions, readFile, intentHits }) {
  const memTok = tok(memText);
  const greppable = questions.filter((x) => x.kind === "greppable");
  const intent = questions.filter((x) => x.kind === "intent");

  // Rediscovery: distinct source files an agent must pull into context to answer
  // every greppable question cold (a file read once serves all questions this
  // session). This is what memory replaces, and it recurs every cold session.
  const neededFiles = [...new Set(greppable.flatMap((x) => x.files))];
  const discTok = tok(neededFiles.map(readFile).join("\n"));

  // --- Correctness gate ---
  const fail = [];
  for (const x of questions)
    if (!memText.includes(x.answer))
      fail.push(`memory omits answer to "${x.q}" (${x.answer})`);
  for (const x of greppable)
    if (!x.files.some((f) => readFile(f).includes(x.answer)))
      fail.push(`unfair fixture: "${x.answer}" not in source for "${x.q}"`);
  for (const x of intent)
    if (intentHits(x.answer) > 0)
      fail.push(`intent fact recoverable from source: "${x.q}"`);

  // --- Report ---
  console.log(`# Honey memory — cold-start benchmark (${label})\n`);
  console.log(`Memory file: ${memTok.claude} Claude tok. ${questions.length} cold-start ` +
    `questions (${greppable.length} greppable, ${intent.length} intent), ` +
    `${neededFiles.length} distinct source files to rediscover.\n`);

  console.log("## Per cold session — context tokens to answer the greppable facts\n");
  console.log("| Path | Claude tok | GPT tok |");
  console.log("|---|---:|---:|");
  console.log(`| Rediscover from source (${neededFiles.length} files) | ${discTok.claude} | ${discTok.gpt} |`);
  console.log(`| Read memory file once | ${memTok.claude} | ${memTok.gpt} |`);
  console.log(`| **Δ per session** | **${pct(memTok.claude, discTok.claude)}%** | **${pct(memTok.gpt, discTok.gpt)}%** |`);

  console.log("\nMemory is read once per session, source is re-grepped every cold session,");
  console.log("so the saving recurs. The more facts reused per session, the better memory");
  console.log("does; on a tiny question set a large always-loaded file can lose (the index");
  console.log("tax) — that crossover is the honest boundary of the skill.\n");

  if (intent.length) {
    console.log("## Intent facts — the part memory uniquely enables\n");
    for (const x of intent)
      console.log(`- "${x.q}" — **not recoverable from source** (0 repo-wide hits); memory is the only source.`);
    console.log("");
  }

  console.log("## Correctness gate\n");
  if (fail.length) {
    for (const f of fail) console.log(`- ❌ ${f}`);
    console.log("\nFAILED.");
    process.exit(1);
  }
  console.log(`- ✅ all ${questions.length} asked facts present in the memory file`);
  console.log(`- ✅ all ${greppable.length} greppable facts derivable from their source (fair fixture)`);
  console.log(`- ✅ all ${intent.length} intent facts absent from source (memory is their only source)`);
  assert(memTok.claude < discTok.claude, "memory must beat rediscovery on greppable facts");
  console.log("\nAll checks passed.");
}

// --- Real-repo mode: node run.mjs <repoDir> [memFile] [questions.json] ------

const repoDir = process.argv[2];
if (repoDir) {
  const memFile = process.argv[3] || "CLAUDE.md";
  const qFile = process.argv[4] ||
    new URL(`./questions.${path.basename(repoDir)}.json`, import.meta.url);
  const memText = readFileSync(path.join(repoDir, memFile), "utf8");
  const questions = JSON.parse(readFileSync(qFile, "utf8"));
  const readFile = (rel) => readFileSync(path.join(repoDir, rel), "utf8");
  // Repo-wide absence check via grep (fixed string), excluding the memory file
  // and vendored/build dirs. Exit code 1 = no match = absent = good.
  const intentHits = (answer) => {
    try {
      const out = execFileSync("grep", [
        "-rIF", "--binary-files=without-match",
        "--exclude-dir=node_modules", "--exclude-dir=.git",
        "--exclude-dir=build", "--exclude-dir=.react-router", "--exclude-dir=dist",
        `--exclude=${memFile}`, answer, ".",
      ], { cwd: repoDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
      return out.split("\n").filter(Boolean).length;
    } catch (e) {
      if (e.status === 1) return 0; // grep: no matches
      throw e;
    }
  };
  bench({ label: `${path.basename(repoDir)}/${memFile}`, memText, questions, readFile, intentHits });
  process.exit(process.exitCode || 0);
}

// --- Fixture mode (default committed gate) ----------------------------------

const SRC = {
  "src/app.js": `import express from "express";
import { requireAuth } from "./middleware/auth.js";
import { router as adminRouter } from "./routes/admin.js";
import { router as publicRouter } from "./routes/public.js";

// Application entrypoint. Public routes are open; everything under /admin is
// gated by requireAuth, which checks the session cookie and the user role.
export function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/", publicRouter);
  app.use("/admin", requireAuth, adminRouter);
  return app;
}
`,
  "src/middleware/auth.js": `import { verifySession } from "../lib/session.js";

// requireAuth: the single choke point for authorization. Reject unless the
// session is valid AND the user has the "admin" role. Used on /admin in app.js.
export function requireAuth(req, res, next) {
  const sess = verifySession(req.cookies?.sid);
  if (!sess) return res.status(401).json({ error: "no session" });
  if (sess.role !== "admin") return res.status(403).json({ error: "forbidden" });
  req.user = sess.user;
  next();
}
`,
  "src/lib/cache.js": `// In-memory response cache. TTL is fixed at 300 seconds.
const TTL_SECONDS = 300;
const store = new Map();

export function get(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_SECONDS * 1000) { store.delete(key); return null; }
  return hit.value;
}

export function set(key, value) {
  store.set(key, { value, at: Date.now() });
}
`,
  "src/lib/session.js": `// Session verification against the signed cookie. Returns null if invalid.
import { unsign } from "./crypto.js";
export function verifySession(sid) {
  if (!sid) return null;
  try { return JSON.parse(unsign(sid)); } catch { return null; }
}
`,
  "package.json": `{
  "name": "fixture-service",
  "scripts": {
    "dev": "node --watch src/server.js",
    "test": "vitest run",
    "build": "esbuild src/server.js --bundle --outfile=dist/server.js"
  },
  "dependencies": { "express": "^4.19.0" },
  "devDependencies": { "vitest": "^1.6.0", "esbuild": "^0.21.0" }
}
`,
  "Makefile": `.PHONY: test build deploy
test:
\tnpm test
build:
\tnpm run build
deploy: build
\t./scripts/deploy.sh dist/server.js
`,
};

const PROJECT_MD = `# Project memory — fixture-service

## Architecture
- Entry: \`src/app.js\` \`createApp()\`. Public routes open; \`/admin\` gated.
- Authz choke point: \`requireAuth\` in \`src/middleware/auth.js\` — valid session
  AND \`role === "admin"\`. The only place authz is enforced.
- Sessions: signed cookie \`sid\` → \`verifySession\` (\`src/lib/session.js\`).

## Build / test / run
- Test: \`make test\` (→ \`vitest run\`). Build: \`make build\` (esbuild bundle).
- Deploy: \`make deploy\` runs \`scripts/deploy.sh\` on the bundle — build first.

## Decisions (intent — not in the code)
- Cache TTL fixed at 300s because the upstream feed refreshes every 5 min;
  shorter just re-fetches unchanged data, longer serves stale prices.
- Authz is one middleware on purpose: a prior per-route-check version leaked an
  unguarded /admin/export endpoint, so it was collapsed to a single choke point.
`;

const FIXTURE_Q = [
  { q: "What guards the /admin routes?", kind: "greppable",
    files: ["src/app.js", "src/middleware/auth.js"], answer: "requireAuth" },
  { q: "What role is required for admin access?", kind: "greppable",
    files: ["src/middleware/auth.js"], answer: "admin" },
  { q: "How do I run the tests?", kind: "greppable",
    files: ["package.json", "Makefile"], answer: "vitest" },
  { q: "How is a session validated?", kind: "greppable",
    files: ["src/lib/session.js"], answer: "verifySession" },
  { q: "Why is the cache TTL 300 seconds?", kind: "intent",
    files: [], answer: "upstream feed refreshes every 5 min" },
  { q: "Why is authz a single middleware instead of per-route?", kind: "intent",
    files: [], answer: "/admin/export" },
];

const allSrc = Object.values(SRC).join("\n");
bench({
  label: "fixture",
  memText: PROJECT_MD,
  questions: FIXTURE_Q,
  readFile: (f) => SRC[f],
  intentHits: (answer) => (allSrc.includes(answer) ? 1 : 0),
});
