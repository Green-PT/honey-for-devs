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

const SENTINEL_KEY = "_ccr";
const DEFAULTS = { minItems: 5, maxItems: 15, firstFraction: 0.3, lastFraction: 0.15 };

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSentinel(item) {
  return isRecord(item) && typeof item[SENTINEL_KEY] === "string";
}

function hashOf(array) {
  return crypto.createHash("sha256").update(JSON.stringify(array)).digest("hex").slice(0, 16);
}

function evenly(items, k) {
  if (items.length <= k) return items;
  const step = items.length / k;
  return Array.from({ length: k }, (_, i) => items[Math.floor(i * step)]);
}

// Change-points on the first string field — the rows a log is read for (a
// `warn` between `info`s). Both sides of each transition.
function changePoints(array) {
  if (!isRecord(array[0])) return [];
  const key = Object.keys(array[0]).find((k) => typeof array[0][k] === "string");
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
