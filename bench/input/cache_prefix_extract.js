#!/usr/bin/env node
"use strict";
// Adapter for cache_prefix_probe.py: reconstruct the per-turn block list from a real
// Claude Code transcript. A request is assembled before each assistant turn, so for each
// assistant message we emit {turn, blocks} where blocks = the ordered message prefix up to
// that point (each message → a stable "role:hash" token). The system+tools header is
// unobservable from a transcript, so it's a single constant block — this measures MESSAGE
// prefix drift, not header drift (which a plugin can neither see nor fix anyway).
//   node cache_prefix_extract.js <transcript.jsonl> > session.jsonl
const fs = require("fs");
const crypto = require("crypto");
const h = (s) => "msg:" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

const path = process.argv[2];
if (!path) { console.error("usage: cache_prefix_extract.js <transcript.jsonl>"); process.exit(1); }

const HEADER = "SYSTEM+TOOLS(opaque)"; // constant: unobservable header, assumed stable
const msgs = []; // growing list of message-block tokens, in transcript order
let turn = 0;
for (const line of fs.readFileSync(path, "utf8").split("\n")) {
  if (!line.trim()) continue;
  let o; try { o = JSON.parse(line); } catch { continue; }
  if (o.type !== "user" && o.type !== "assistant") continue;
  if (!o.message || !o.message.content) continue;
  // an assistant turn = a point where a request was assembled from the prefix BEFORE it
  if (o.type === "assistant") {
    process.stdout.write(JSON.stringify({ turn: turn++, blocks: [HEADER, ...msgs] }) + "\n");
  }
  // then append this message to the running prefix
  msgs.push(h(JSON.stringify(o.message.content)));
}
