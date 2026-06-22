"use strict";

// CCR — Compress-Cache-Retrieve for high-volume, redundant array tool output.
// Lossy-but-recoverable: keep an informative sample of an array's items, drop
// the rest, leave a sentinel naming a hash the originals are cached under. The
// agent retrieves the full array by hash when it needs a dropped row.
//
// Pure module — no fs. The file cache lives in bin/eso.js (crush/retrieve),
// matching eso/index.js's no-side-effects rule. Borrows SmartCrusher's
// selection (headroom): head fraction + tail fraction + change-points, capped.

const crypto = require("node:crypto");
const { isRecord } = require("./index");

const SENTINEL_KEY = "_ccr";
const SENTINEL_RE = /^<<ccr:[0-9a-f]{16} \d+_rows_offloaded>>$/;
const DEFAULTS = { minItems: 5, maxItems: 15, firstFraction: 0.3, lastFraction: 0.15 };

// Match the marker shape, not just the key — real data carrying a `_ccr` string
// must not be mistaken for a sentinel and dropped by strip().
function isSentinel(item) {
  return isRecord(item) && typeof item[SENTINEL_KEY] === "string" &&
    SENTINEL_RE.test(item[SENTINEL_KEY]);
}

function hashOf(array) {
  return crypto.createHash("sha256").update(JSON.stringify(array)).digest("hex").slice(0, 16);
}

function evenly(items, k) {
  if (items.length <= k) return items;
  const step = items.length / k;
  return Array.from({ length: k }, (_, i) => items[Math.floor(i * step)]);
}

// The categorical string field to watch for transitions — the lowest-cardinality
// one (a `level` of warn/info), not a per-row unique id whose every pair would
// look like a change and burn the anomaly budget on noise.
function changeKey(array) {
  const first = array.find(isRecord);
  if (!first) return null;
  const counts = Object.keys(first)
    .filter((k) => typeof first[k] === "string")
    .map((k) => [k, new Set(array.filter(isRecord).map((r) => r[k])).size])
    .filter(([, card]) => card > 1)
    .sort((a, b) => a[1] - b[1]);
  return counts.length ? counts[0][0] : null;
}

// Change-points on that field — the rows a log is read for (a `warn` between
// `info`s). Both sides of each transition.
function changePoints(array) {
  const key = changeKey(array);
  if (!key) return [];
  const cp = new Set();
  for (let i = 1; i < array.length; i++) {
    const prev = array[i - 1];
    const cur = array[i];
    if (isRecord(prev) && isRecord(cur) && prev[key] !== cur[key]) {
      cp.add(i - 1);
      cp.add(i);
    }
  }
  return [...cp].sort((a, b) => a - b);
}

// Within a `maxItems` budget: keep the endpoints as anchors, spend the rest on
// anomalies first (the signal), then backfill with head/tail context. Anomalies
// are preserved preferentially instead of being diluted by even downsampling.
function selectIndices(array, cfg) {
  const n = array.length;
  const keep = new Set([0, n - 1]);

  for (const i of evenly(changePoints(array), cfg.maxItems - keep.size)) {
    if (keep.size >= cfg.maxItems) break;
    keep.add(i);
  }

  const head = Math.max(1, Math.floor(n * cfg.firstFraction));
  const tail = Math.max(1, Math.floor(n * cfg.lastFraction));
  const filler = [];
  for (let i = 0; i < head; i++) filler.push(i);
  for (let i = n - tail; i < n; i++) filler.push(i);
  for (const i of evenly(filler, cfg.maxItems)) {
    if (keep.size >= cfg.maxItems) break;
    keep.add(i);
  }

  return [...keep].sort((a, b) => a - b);
}

// crush(array) -> { view, hash, dropped }
//   view    : sampled items + a sentinel `{_ccr:"<<ccr:HASH N_rows_offloaded>>"}`
//   hash    : cache key for the originals, or null when nothing was dropped
//   dropped : count of items offloaded
// Passthrough (view === array, hash null) below minItems or when selection
// keeps everything — never inflates a small payload.
function crush(array, options) {
  if (!Array.isArray(array)) throw new TypeError("ccr.crush expects an array");
  const cfg = { ...DEFAULTS, ...options };
  if (array.length < cfg.minItems) return { view: array, hash: null, dropped: 0 };

  const idx = selectIndices(array, cfg);
  if (idx.length >= array.length) return { view: array, hash: null, dropped: 0 };

  const hash = hashOf(array);
  const dropped = array.length - idx.length;
  const view = idx.map((i) => array[i]);
  view.push({ [SENTINEL_KEY]: `<<ccr:${hash} ${dropped}_rows_offloaded>>` });
  return { view, hash, dropped };
}

// Drop sentinels from a crushed view so callers iterating records don't trip
// on the marker (mirrors headroom's strip_ccr_sentinels).
function strip(view) {
  return Array.isArray(view) ? view.filter((x) => !isSentinel(x)) : view;
}

module.exports = { crush, strip, isSentinel, hashOf, SENTINEL_KEY, DEFAULTS };
