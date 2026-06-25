#!/usr/bin/env python3
"""Measure cacheable-prefix headroom across turns of a real session.

CacheAligner is only worth building if the assembled prompt prefix drifts
between turns. If Claude Code's cache_control already holds the prefix stable,
this reports ~full stable prefix and CacheAligner is a no-op — don't build it.

Input: a JSONL transcript, one assembled request per line, in turn order:
  {"turn": 0, "blocks": ["<system>", "<tool_defs>", "<msg0>", ...]}
Each "blocks" entry is a content block as sent to the provider, in order.
Adapt extract_blocks() to your harness's request dump.

NOTE: a plugin cannot observe the true assembled provider request (no hook sees
it). cache_prefix_extract.js reconstructs the MESSAGE prefix from a transcript —
it captures message-block drift but treats the system+tools header as opaque
(unobservable from the plugin side). Read the verdict with that limit in mind.

Output: per-turn divergence point + a verdict.
"""
import sys, json, hashlib


def h(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:12]


def load(path):
    turns = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                turns.append(json.loads(line))
    turns.sort(key=lambda t: t["turn"])
    return turns


def common_prefix_blocks(a, b):
    """Count of leading blocks identical between two turns' block lists."""
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def main(path):
    turns = load(path)
    if len(turns) < 2:
        sys.exit("need >=2 turns to measure drift")

    print(f"session: {len(turns)} turns\n")
    print(f"{'turn pair':<12}{'matched':<10}{'prev len':<10}{'drift?':<8}{'first drift block':<22}")
    print("-" * 62)

    # Drift = a block that existed in the previous turn changed or moved, i.e.
    # the common prefix ends BEFORE the previous turn's length. Matching all of
    # prev's blocks and then having more is just conversation growth, not drift —
    # cache_control re-caches the longer prefix fine.
    drift_seen = False
    worst_stable_of_prev = None
    for i in range(1, len(turns)):
        prev, cur = turns[i - 1]["blocks"], turns[i]["blocks"]
        n = common_prefix_blocks(prev, cur)
        is_drift = n < len(prev)
        if is_drift:
            drift_seen = True
            first_drift = f"block[{n}] {h(cur[n]) if n < len(cur) else '(truncated)'}"
        else:
            first_drift = "(none — growth only)"
        # what fraction of the PREVIOUS turn's prefix survived into this one
        frac = 100 * n // len(prev) if prev else 100
        worst_stable_of_prev = frac if worst_stable_of_prev is None else min(worst_stable_of_prev, frac)
        print(f"{i-1}->{i:<9}{n:<10}{len(prev):<10}{('YES' if is_drift else 'no'):<8}{first_drift:<22}")

    print("\nverdict:")
    if not drift_seen:
        print("  NO DRIFT — every prior block is reused unchanged; turns only append.")
        print("  cache_control already holds the prefix stable. CacheAligner is a no-op here.")
        print("  Do NOT build a proxy for it.")
    else:
        print(f"  DRIFT FOUND — worst case, only {worst_stable_of_prev}% of the previous")
        print(f"  turn's prefix survived unchanged. Everything from the first drift block")
        print(f"  onward re-pays full input price each turn instead of hitting cache.")
        print(f"  CacheAligner has headroom: pin the drifting block to the tail.")
        print(f"  (Common causes: regenerated system block, reordered tool defs, injected timestamp/turn counter.)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: cache_prefix_probe.py <session.jsonl>")
    main(sys.argv[1])
