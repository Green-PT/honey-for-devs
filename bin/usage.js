#!/usr/bin/env node
// honey-usage — actual token usage of local AI coding apps, with approximate USD
// (bench/pricing.json) and served CO2 (hooks/eco.js EcoLogits port).
//
// Apps: claude (Claude Code), codex (Codex CLI), opencode (OpenCode).
// Only apps with data on this machine are scanned; missing roots are skipped.
//
//   honey-usage [--json] [--daily] [--client claude,codex,opencode]
//               [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--today] [--help]
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const eco = require("../hooks/eco.js");

const pricing = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "bench", "pricing.json"), "utf8")
);

// mirrors bench/src/report.js (bench/ isn't shipped; only its pricing.json is)
function rateFor(model) {
  const hit = pricing.rates.find((r) => String(model).toLowerCase().includes(r.match));
  return hit || pricing._default;
}

function dollars(model, { input = 0, cache_write = 0, cache_read = 0, output = 0 }) {
  const r = rateFor(model);
  const cw = r.cache_write ?? pricing._default.cache_write;
  const cr = r.cache_read ?? pricing._default.cache_read;
  return (input * r.in + cache_write * r.in * cw + cache_read * r.in * cr + output * r.out) / 1e6;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

// Claude Code assistant lines repeat across retries/continuations with identical
// usage — count each (message.id, requestId) once via the caller's `seen` set.
function parseAssistant(line, seen) {
  if (!line.includes('"type":"assistant"')) return null;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    return null;
  }
  const m = rec.message;
  const u = m && m.usage;
  if (rec.type !== "assistant" || !u || !m.model || m.model === "<synthetic>") return null;
  const key = m.id + ":" + (rec.requestId || "");
  if (seen.has(key)) return null;
  seen.add(key);
  return {
    model: m.model,
    ts: Date.parse(rec.timestamp) || null,
    input: u.input_tokens || 0,
    output: u.output_tokens || 0,
    cacheRead: u.cache_read_input_tokens || 0,
    cacheWrite: u.cache_creation_input_tokens || 0,
  };
}

function scanClaude(root) {
  const recs = [];
  const seen = new Set();
  for (const file of walk(path.join(root, "projects"))) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      const r = parseAssistant(line, seen);
      if (r) recs.push({ app: "claude", cost: null, ...r });
    }
  }
  return recs;
}

// Codex: model comes from turn_context (can change mid-file); usage from
// token_count events' last_token_usage. cached_input_tokens is a subset of
// input_tokens, so split it out to price cache reads at the cached rate.
function scanCodex(root) {
  const recs = [];
  for (const file of walk(path.join(root, "sessions"))) {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    let model = null;
    for (const line of text.split("\n")) {
      const isTurn = line.includes('"turn_context"');
      if (!isTurn && !line.includes('"token_count"')) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      const p = rec.payload || {};
      if (isTurn) {
        if (p.model) model = p.model;
        continue;
      }
      const l = p.info && p.info.last_token_usage;
      if (!l) continue;
      const cached = l.cached_input_tokens || 0;
      recs.push({
        app: "codex",
        model: model || "gpt-5-codex",
        ts: Date.parse(rec.timestamp) || null,
        input: Math.max(0, (l.input_tokens || 0) - cached),
        output: l.output_tokens || 0,
        cacheRead: cached,
        cacheWrite: 0,
        cost: null,
      });
    }
  }
  return recs;
}

// OpenCode: sqlite db read via the system sqlite3 (ships with macOS). Messages
// embed their exact cost and tokens; `input` already excludes cache reads and
// `reasoning` is billed as output.
function scanOpencode(db) {
  if (!fs.existsSync(db)) return [];
  const q = (sql) =>
    execFileSync("sqlite3", ["-readonly", "-json", db, sql], {
      encoding: "utf8",
      maxBuffer: 1 << 28,
    });
  let out;
  try {
    // OpenCode v2 replaced `message` with `session_message`; the legacy table
    // stops at the migration. Read exactly one: migrated rows are in both, so
    // reading both counts them twice.
    const tables = new Set(
      JSON.parse(q("select name from sqlite_master where type='table'") || "[]").map((r) => r.name),
    );
    out = q(
      tables.has("session_message")
        ? "select data from session_message where type='assistant'"
        : "select data from message",
    );
  } catch (e) {
    const why = e.code === "ENOENT" ? "sqlite3 not found" : String(e.message).split("\n")[0];
    process.stderr.write(`honey-usage: skipping opencode (${why})\n`);
    return [];
  }
  if (!out.trim()) return [];
  const recs = [];
  for (const row of JSON.parse(out)) {
    let d;
    try {
      d = JSON.parse(row.data);
    } catch {
      continue;
    }
    // v2 keeps the role in the `type` column, so only v1 rows carry `role`.
    if ((d.role && d.role !== "assistant") || !d.tokens) continue;
    const t = d.tokens;
    recs.push({
      app: "opencode",
      model: d.modelID || (d.model && d.model.id) || "unknown",
      ts: (d.time && d.time.created) || null,
      input: t.input || 0,
      output: (t.output || 0) + (t.reasoning || 0),
      cacheRead: (t.cache && t.cache.read) || 0,
      cacheWrite: (t.cache && t.cache.write) || 0,
      cost: typeof d.cost === "number" && d.cost > 0 ? d.cost : null,
    });
  }
  return recs;
}

// Savings ledger: hooks/honey-session.js appends {ts, transcript_path, mode}
// per Honey session start. Savings is claimed ONLY for these sessions — the
// modeled counterfactual needs to know Honey was active and in which mode.
// Dedup by transcript path (resume re-fires SessionStart); last mode wins.
function ledgerSessions(dir) {
  let text;
  try {
    text = fs.readFileSync(path.join(dir, ".honey-usage-ledger.jsonl"), "utf8");
  } catch {
    return [];
  }
  const byTx = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (e.transcript_path && e.mode) byTx.set(e.transcript_path, e);
    } catch {}
  }
  return [...byTx.values()];
}

function scanSavings(dir) {
  const recs = [];
  const seen = new Set();
  let since = null;
  for (const s of ledgerSessions(dir)) {
    if (s.ts && (!since || s.ts < since)) since = s.ts;
    let text;
    try {
      text = fs.readFileSync(s.transcript_path, "utf8");
    } catch {
      continue; // transcript deleted since — nothing to claim
    }
    for (const line of text.split("\n")) {
      const r = parseAssistant(line, seen);
      if (r) recs.push({ mode: s.mode, model: r.model, ts: r.ts, output: r.output, tx: s.transcript_path });
    }
  }
  return { recs, trackedSince: since };
}

// One row per mode+model with a committed bench stamp; models without one get
// no savings claim (they'd be an invented counterfactual) and are footnoted.
function aggregateSavings(recs) {
  const cfg = eco.loadConfig();
  const groups = new Map();
  for (const r of recs) {
    const k = r.mode + " " + r.model;
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { mode: r.mode, model: r.model, output: 0, txs: new Set() }));
    g.output += r.output;
    g.txs.add(r.tx);
  }
  const rows = [];
  const labels = new Set();
  const skipped = { output: 0, models: new Set() };
  const totals = { sessions: 0, output: 0, savedTokens: 0, savedUsd: 0, savedGco2: 0 };
  for (const g of groups.values()) {
    const sv = eco.savingsInfo(cfg, g.mode, g.model);
    if (!sv || !(sv.k > 0)) {
      skipped.output += g.output;
      skipped.models.add(g.model);
      continue;
    }
    const savedTokens = g.output * sv.k;
    const row = {
      mode: g.mode,
      model: g.model,
      sessions: g.txs.size,
      output: g.output,
      savedTokens,
      savedUsd: dollars(g.model, { output: savedTokens }),
      savedGco2: eco.estimate(g.model, savedTokens, cfg).gco2,
    };
    labels.add(sv.label);
    rows.push(row);
    for (const f of Object.keys(totals)) totals[f] += row[f];
  }
  rows.sort((a, b) => (a.mode + a.model < b.mode + b.model ? -1 : 1));
  return { rows, totals, labels: [...labels], skipped };
}

function renderSavings(sv, trackedSince) {
  const heads = ["MODE", "MODEL", "SESSIONS", "OUTPUT", "SAVED-TOK", "SAVED-USD", "SAVED-CO2"];
  const line = (r) => [
    String(r.mode ?? "total"), String(r.model ?? ""), fmtN(r.sessions), fmtN(r.output),
    fmtN(Math.round(r.savedTokens)), "$" + r.savedUsd.toFixed(2), fmtG(r.savedGco2),
  ];
  const table = [heads, ...sv.rows.map(line), line(sv.totals)];
  const w = heads.map((_, i) => Math.max(...table.map((r) => r[i].length)));
  const out = table.map((r) =>
    r.map((c, i) => (i < 2 ? c.padEnd(w[i]) : c.padStart(w[i]))).join("  ").trimEnd()
  );
  out.splice(out.length - 1, 0, out[0].replace(/./g, "-"));
  if (trackedSince) out.push(`tracked since ${day(trackedSince)} (Honey sessions only)`);
  else out.push("no tracked Honey sessions yet — the ledger starts with the first Honey session after install");
  for (const l of sv.labels) out.push("est. " + l);
  if (sv.skipped.output)
    out.push(
      `${fmtN(sv.skipped.output)} output tokens (${[...sv.skipped.models].join(", ")}) ` +
        "have no committed bench stamp — no savings claimed"
    );
  return out.join("\n");
}

// Local calendar day — usage reports should follow the user's clock, not UTC.
function day(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function aggregate(records, keys) {
  const groups = new Map();
  for (const rec of records) {
    if (keys.includes("day")) rec.day = rec.ts ? day(rec.ts) : "unknown";
    const k = keys.map((f) => rec[f]).join(" ");
    let g = groups.get(k);
    if (!g) {
      g = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 };
      for (const f of keys) g[f] = rec[f];
      groups.set(k, g);
    }
    g.input += rec.input;
    g.output += rec.output;
    g.cacheRead += rec.cacheRead;
    g.cacheWrite += rec.cacheWrite;
    g.usd += rec.cost != null
      ? rec.cost
      : dollars(rec.model, {
          input: rec.input,
          cache_write: rec.cacheWrite,
          cache_read: rec.cacheRead,
          output: rec.output,
        });
  }
  const cfg = eco.loadConfig();
  const rows = [...groups.values()];
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0, gco2: 0 };
  for (const r of rows) {
    r.gco2 = eco.estimate(r.model, r.output, cfg).gco2;
    for (const f of Object.keys(totals)) totals[f] += r[f];
  }
  rows.sort((a, b) => keys.map((f) => a[f]).join() < keys.map((f) => b[f]).join() ? -1 : 1);
  return { rows, totals };
}

const fmtN = (n) => n.toLocaleString("en-US");
const fmtG = (g) => (g >= 1000 ? (g / 1000).toFixed(2) + "kg" : g.toFixed(1) + "g");

function render(rows, totals, keys) {
  const heads = [...keys.map((k) => k.toUpperCase()), "INPUT", "OUTPUT", "CACHE-R", "CACHE-W", "USD", "CO2"];
  const line = (r) => [
    ...keys.map((k, i) => String(r[k] ?? (i === 0 ? "total" : ""))),
    fmtN(r.input), fmtN(r.output), fmtN(r.cacheRead), fmtN(r.cacheWrite),
    "$" + r.usd.toFixed(2), fmtG(r.gco2),
  ];
  const table = [heads, ...rows.map(line), line(totals)];
  const w = heads.map((_, i) => Math.max(...table.map((r) => r[i].length)));
  const out = table.map((r) =>
    r.map((c, i) => (i < keys.length ? c.padEnd(w[i]) : c.padStart(w[i]))).join("  ").trimEnd()
  );
  out.splice(out.length - 1, 0, out[0].replace(/./g, "-"));
  return out.join("\n");
}

const USAGE = `Usage: honey-usage [--json] [--daily] [--client claude,codex,opencode]
                   [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--today]
                   [--savings] [--help]

Reads actual token usage from local app data:
  claude    $CLAUDE_CONFIG_DIR or ~/.claude  (projects/**/*.jsonl)
  codex     $CODEX_HOME or ~/.codex          (sessions/**/*.jsonl)
  opencode  ($XDG_DATA_HOME or ~/.local/share)/opencode/opencode.db  (needs sqlite3)

Costs are approximate (bench/pricing.json; unknown models use its _default rate;
OpenCode rows use the app's own recorded cost). CO2 is the served EcoLogits
estimate from output tokens (hooks/eco.js).

--savings reports modeled Honey savings, only for Claude Code sessions the
SessionStart hook recorded in $CLAUDE_CONFIG_DIR/.honey-usage-ledger.jsonl
(so only since Honey was installed), and only for models with a committed
bench stamp. Combines with --json/--since/--until/--today, not --client/--daily.`;

const APPS = ["claude", "codex", "opencode"];

function main() {
  const argv = process.argv.slice(2);
  const opts = { clients: [], since: null, until: null, json: false, daily: false };
  const fail = (msg) => {
    process.stderr.write((msg ? msg + "\n" : "") + USAGE + "\n");
    process.exit(1);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(USAGE);
      return;
    } else if (a === "--json") opts.json = true;
    else if (a === "--savings") opts.savings = true;
    else if (a === "--daily") opts.daily = true;
    else if (a === "--today") opts.since = day(Date.now());
    else if (a === "--client") opts.clients.push(...String(argv[++i] || "").split(","));
    else if (a === "--since" || a === "--until") {
      const v = argv[++i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v || "")) fail(`honey-usage: bad date for ${a}: ${v}`);
      opts[a.slice(2)] = v;
    } else fail(`honey-usage: unknown argument: ${a}`);
  }
  for (const c of opts.clients) if (!APPS.includes(c)) fail(`honey-usage: unknown client: ${c}`);
  const want = (c) => opts.clients.length === 0 || opts.clients.includes(c);

  const home = os.homedir();
  const inRange = (r) => {
    if (!opts.since && !opts.until) return true;
    if (!r.ts) return false;
    const d = day(r.ts);
    return (!opts.since || d >= opts.since) && (!opts.until || d <= opts.until);
  };

  if (opts.savings) {
    if (opts.clients.length || opts.daily)
      fail("honey-usage: --savings does not combine with --client/--daily");
    const dir = process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude");
    const { recs, trackedSince } = scanSavings(dir);
    const sv = aggregateSavings(recs.filter(inRange));
    if (opts.json) console.log(JSON.stringify({ ...sv, skipped: { output: sv.skipped.output, models: [...sv.skipped.models] }, trackedSince }, null, 2));
    else console.log(renderSavings(sv, trackedSince));
    return;
  }
  let records = [];
  if (want("claude"))
    records.push(...scanClaude(process.env.CLAUDE_CONFIG_DIR || path.join(home, ".claude")));
  if (want("codex"))
    records.push(...scanCodex(process.env.CODEX_HOME || path.join(home, ".codex")));
  if (want("opencode"))
    records.push(...scanOpencode(path.join(
      process.env.XDG_DATA_HOME || path.join(home, ".local", "share"),
      "opencode", "opencode.db"
    )));

  records = records.filter(inRange);

  const keys = opts.daily ? ["day", "app", "model"] : ["app", "model"];
  const { rows, totals } = aggregate(records, keys);
  if (opts.json) console.log(JSON.stringify({ rows, totals }, null, 2));
  else console.log(render(rows, totals, keys));
}

module.exports = { scanClaude, scanCodex, scanOpencode, aggregate, dollars, day, render };
if (require.main === module) main();
