"use strict";
// Endpoint tests for bin/usage.js against tests/fixtures/usage. The OpenCode
// sqlite fixture is built at run time (no binary in git); those cases skip
// when the system sqlite3 is absent.
const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFileSync } = require("child_process");

const BIN = path.join(__dirname, "..", "bin", "usage.js");
const FX = path.join(__dirname, "fixtures", "usage");
const { dollars, day } = require(BIN);

let HAS_SQLITE = true;
try {
  execFileSync("sqlite3", ["--version"], { stdio: "ignore" });
} catch {
  HAS_SQLITE = false;
}

let dataDir; // XDG_DATA_HOME containing opencode/opencode.db
let emptyDir;

before(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "honey-usage-"));
  dataDir = path.join(tmp, "data");
  emptyDir = path.join(tmp, "empty");
  fs.mkdirSync(path.join(dataDir, "opencode"), { recursive: true });
  fs.mkdirSync(emptyDir);
  if (!HAS_SQLITE) return;
  const row = (id, d) => `INSERT INTO message VALUES('${id}','s1',0,0,'${JSON.stringify(d)}');`;
  const sql = [
    "CREATE TABLE message(id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null);",
    row("m1", { role: "assistant", cost: 0.5, tokens: { input: 100, output: 10, reasoning: 5, cache: { write: 20, read: 30 } }, modelID: "glm-5.2", providerID: "x", time: { created: Date.UTC(2026, 0, 1, 12) } }),
    row("m2", { role: "assistant", cost: 0, tokens: { input: 200, output: 40, reasoning: 0, cache: { write: 0, read: 0 } }, modelID: "claude-sonnet-5", providerID: "x", time: { created: Date.UTC(2026, 0, 2, 12) } }),
    row("m3", { role: "user", time: { created: Date.UTC(2026, 0, 1, 12) } }),
  ].join("\n");
  execFileSync("sqlite3", [path.join(dataDir, "opencode", "opencode.db"), sql]);
});

function run(args, envOverrides) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      TZ: "UTC",
      CLAUDE_CONFIG_DIR: path.join(FX, "claude"),
      CODEX_HOME: path.join(FX, "codex"),
      XDG_DATA_HOME: dataDir,
      ...envOverrides,
    },
  });
}

const rowsJson = (args, env) => {
  const r = run(["--json", ...args], env);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// Fixture expectations:
//   claude claude-opus-5: input 110, output 220, cacheR 1000, cacheW 50 (dup + synthetic skipped)
//   codex  gpt-5.5:       input 400 (1000-600), output 50, cacheR 600
//   opencode glm-5.2:     input 100, output 15 (10+5), cacheR 30, cacheW 20, cost 0.5 embedded
//   opencode claude-sonnet-5: input 200, output 40, cost computed

test("default table: totals row, dedup once, synthetic skipped", (t) => {
  if (!HAS_SQLITE) return t.skip("no sqlite3");
  const r = run([]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /claude\s+claude-opus-5\s+110\s+220\s+1,000\s+50/);
  assert.match(r.stdout, /codex\s+gpt-5\.5\s+400\s+50\s+600\s+0/);
  assert.match(r.stdout, /opencode\s+glm-5\.2\s+100\s+15\s+30\s+20\s+\$0\.50/);
  assert.match(r.stdout, /total\s+810\s+325\s+1,630\s+70\s+\$0\.51/);
});

test("--json: exact per-app numbers, usd math, gco2 present", (t) => {
  const { rows } = rowsJson([]);
  const claude = rows.find((r) => r.app === "claude");
  assert.deepEqual(
    { model: claude.model, input: claude.input, output: claude.output, cacheRead: claude.cacheRead, cacheWrite: claude.cacheWrite },
    { model: "claude-opus-5", input: 110, output: 220, cacheRead: 1000, cacheWrite: 50 }
  );
  close(claude.usd, (110 * 5 + 50 * 5 * 1.25 + 1000 * 5 * 0.1 + 220 * 25) / 1e6);
  const codex = rows.find((r) => r.app === "codex");
  assert.equal(codex.input, 400); // input_tokens - cached_input_tokens
  assert.equal(codex.cacheRead, 600);
  close(codex.usd, (400 * 2.5 + 600 * 2.5 * 0.1 + 50 * 15) / 1e6);
  for (const r of rows) assert.ok(r.gco2 > 0, `gco2 missing for ${r.app}/${r.model}`);
  if (!HAS_SQLITE) return t.skip("no sqlite3 — opencode rows unchecked");
  const glm = rows.find((r) => r.model === "glm-5.2");
  assert.equal(glm.output, 15); // output + reasoning
  close(glm.usd, 0.5); // embedded cost wins
  close(rows.find((r) => r.model === "claude-sonnet-5").usd, (200 * 2 + 40 * 10) / 1e6);
});

test("--daily: day rows ascending, combines with --json", (t) => {
  if (!HAS_SQLITE) return t.skip("no sqlite3");
  const { rows } = rowsJson(["--daily"]);
  const days = rows.map((r) => r.day);
  assert.deepEqual([...new Set(days)], ["2026-01-01", "2026-01-02"]);
  assert.deepEqual(days, [...days].sort());
  assert.equal(rows.find((r) => r.day === "2026-01-01" && r.app === "claude").input, 100);
  const table = run(["--daily"]);
  assert.match(table.stdout, /^DAY\s+APP\s+MODEL/, "day column first");
});

test("--client filters apps; unknown client exits 1", () => {
  const only = rowsJson(["--client", "codex"]).rows;
  assert.deepEqual([...new Set(only.map((r) => r.app))], ["codex"]);
  const two = rowsJson(["--client", "claude,opencode"]).rows;
  assert.ok(!two.some((r) => r.app === "codex"));
  const bad = run(["--client", "cursor"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown client/);
});

test("--since/--until inclusive on local day; --today empty for old fixtures", () => {
  assert.equal(rowsJson(["--client", "claude", "--since", "2026-01-02"]).totals.input, 10);
  assert.equal(rowsJson(["--client", "claude", "--until", "2026-01-01"]).totals.input, 100);
  assert.equal(rowsJson(["--client", "claude", "--since", "2026-01-01", "--until", "2026-01-02"]).totals.input, 110);
  assert.equal(rowsJson(["--today"]).rows.length, 0);
  const bad = run(["--since", "01-02-2026"]);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /bad date/);
});

test("--help exits 0; unknown flag exits 1 with usage on stderr", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage: honey-usage/);
  const bogus = run(["--bogus"]);
  assert.equal(bogus.status, 1);
  assert.match(bogus.stderr, /Usage: honey-usage/);
});

test("missing roots: everything skipped, exit 0, empty rows", () => {
  const { rows, totals } = rowsJson([], {
    CLAUDE_CONFIG_DIR: emptyDir,
    CODEX_HOME: emptyDir,
    XDG_DATA_HOME: emptyDir,
  });
  assert.deepEqual(rows, []);
  assert.equal(totals.input, 0);
});

test("sqlite3 absent: opencode skipped with warning, others still reported", (t) => {
  if (!HAS_SQLITE) return t.skip("no sqlite3 to hide");
  const r = run(["--json"], { PATH: "" });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /skipping opencode/);
  const rows = JSON.parse(r.stdout).rows;
  assert.ok(rows.some((x) => x.app === "claude"));
  assert.ok(!rows.some((x) => x.app === "opencode"));
});

// --savings expectations: ledger covers s1+s2 (mode full) -> claude-opus-5
// output 220 (dedup), k = R/(1-R) with R from the committed stamp for "opus";
// a transcript with an unstamped model gets no claim, only a footnote.
const ecfg = require("../hooks/eco-config.json");
const K_OPUS = (() => {
  const R = ecfg.savings_provenance.by_model.opus.ratio;
  return R / (1 - R);
})();

let savingsCfg; // CLAUDE_CONFIG_DIR holding the ledger

before(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "honey-savings-"));
  savingsCfg = tmp;
  const mystery = path.join(tmp, "mystery.jsonl");
  fs.writeFileSync(
    mystery,
    JSON.stringify({ type: "assistant", timestamp: "2026-01-01T10:00:00.000Z", requestId: "req_m", message: { id: "msg_m", model: "mystery-9", usage: { input_tokens: 1, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }) + "\n"
  );
  const lines = [
    { ts: Date.UTC(2026, 0, 1), transcript_path: path.join(FX, "claude", "projects", "proj-a", "s1.jsonl"), mode: "full" },
    { ts: Date.UTC(2026, 0, 2), transcript_path: path.join(FX, "claude", "projects", "proj-b", "s2.jsonl"), mode: "full" },
    { ts: Date.UTC(2026, 0, 3), transcript_path: path.join(tmp, "gone.jsonl"), mode: "full" }, // deleted transcript
    { ts: Date.UTC(2026, 0, 4), transcript_path: mystery, mode: "full" },
  ];
  fs.writeFileSync(path.join(tmp, ".honey-usage-ledger.jsonl"), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
});

test("--savings: ledger-gated, stamp-gated, dedup holds; unstamped models footnoted", () => {
  const r = run(["--savings", "--json"], { CLAUDE_CONFIG_DIR: savingsCfg });
  assert.equal(r.status, 0, r.stderr);
  const sv = JSON.parse(r.stdout);
  assert.equal(sv.rows.length, 1);
  const row = sv.rows[0];
  assert.equal(row.model, "claude-opus-5");
  assert.equal(row.mode, "full");
  assert.equal(row.output, 220); // m1 counted once across s1+s2, m2 once
  assert.equal(row.sessions, 2);
  close(row.savedTokens, 220 * K_OPUS);
  close(row.savedUsd, dollars("claude-opus-5", { output: 220 * K_OPUS }));
  assert.ok(row.savedGco2 > 0);
  assert.deepEqual(sv.skipped, { output: 100, models: ["mystery-9"] });
  assert.equal(sv.trackedSince, Date.UTC(2026, 0, 1));
  assert.ok(sv.labels[0].includes("not measured"));
  const table = run(["--savings"], { CLAUDE_CONFIG_DIR: savingsCfg });
  assert.match(table.stdout, /tracked since 2026-01-01/);
  assert.match(table.stdout, /no committed bench stamp — no savings claimed/);
});

test("--savings: honors date filters, rejects --client/--daily", () => {
  const sv = JSON.parse(run(["--savings", "--json", "--since", "2026-01-02"], { CLAUDE_CONFIG_DIR: savingsCfg }).stdout);
  assert.equal(sv.rows[0].output, 20); // only m2's day
  assert.equal(run(["--savings", "--client", "codex"]).status, 1);
  assert.equal(run(["--savings", "--daily"]).status, 1);
});

test("--savings: no ledger -> empty report, exit 0", () => {
  const r = run(["--savings"], { CLAUDE_CONFIG_DIR: emptyDir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no tracked Honey sessions yet/);
});

test("SessionStart hook appends a ledger line when Honey is active", () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), "honey-hook-"));
  fs.writeFileSync(path.join(cfg, ".honey-active"), "full\n");
  const r = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "honey-session.js")], {
    encoding: "utf8",
    input: JSON.stringify({ session_id: "s", transcript_path: "/tmp/x.jsonl" }),
    env: { ...process.env, CLAUDE_CONFIG_DIR: cfg },
  });
  assert.equal(r.status, 0, r.stderr);
  const entry = JSON.parse(fs.readFileSync(path.join(cfg, ".honey-usage-ledger.jsonl"), "utf8").trim());
  assert.equal(entry.transcript_path, "/tmp/x.jsonl");
  assert.equal(entry.mode, "full");
  assert.ok(entry.ts > 0);
});

test("unit: dollars() rates and cache multipliers mirror bench/pricing.json", () => {
  close(dollars("claude-opus-5", { input: 1e6 }), 5.0);
  close(dollars("claude-opus-5", { cache_write: 1e6 }), 5.0 * 1.25); // _default multiplier
  close(dollars("gpt-5.5", { cache_write: 1e6 }), 2.5 * 1.0); // row's own multiplier
  close(dollars("gpt-5.5", { cache_read: 1e6 }), 2.5 * 0.1);
  close(dollars("some-unknown-model", { input: 1e6, output: 1e6 }), 3.0 + 15.0); // _default
});

test("unit: day() is local-time YYYY-MM-DD", () => {
  const ts = Date.UTC(2026, 0, 2, 12);
  const d = new Date(ts);
  const expect = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  assert.equal(day(ts), expect);
  assert.match(day(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
});
