#!/usr/bin/env python3
"""Authoritative session CO2 report using the real EcoLogits package.

The statusline uses a fast JS port; this runs genai-impact/ecologits itself for
the full breakdown (usage + embodied + primary energy) plus Honey savings.

    pip install ecologits
    python scripts/eco_report.py [--transcript PATH]

Without --transcript it picks the newest *.jsonl under ~/.claude/projects.
Params, grid, and savings come from hooks/eco-config.json (shared with the badge).
"""
import argparse, glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CFG = json.load(open(os.path.join(HERE, "..", "hooks", "eco-config.json")))
REG = json.load(open(os.path.join(HERE, "..", "hooks", "eco-models.json")))["models"]


def resolve(model):
    """Params from EcoLogits' registry: exact -> alias substring -> default."""
    mid = model or ""
    if mid in REG:
        return REG[mid]
    low = mid.lower()
    for a in CFG["aliases"]:
        if any(s in low for s in a["match"]) and a["registry"] in REG:
            return REG[a["registry"]]
    return REG[CFG["default_alias"]]


def newest_transcript():
    base = os.path.expanduser("~/.claude/projects")
    files = glob.glob(os.path.join(base, "**", "*.jsonl"), recursive=True)
    return max(files, key=os.path.getmtime) if files else None


def output_tokens_by_model(path):
    per = {}
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line).get("message") or {}
        except json.JSONDecodeError:
            continue
        if msg.get("role") == "assistant" and msg.get("usage"):
            per[msg.get("model")] = per.get(msg.get("model"), 0) + msg["usage"].get("output_tokens", 0)
    return per


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--transcript")
    ap.add_argument("--mode", default="full", help="honey mode for savings (lite/full/ultra)")
    args = ap.parse_args()

    try:
        from ecologits.impacts.llm import compute_llm_impacts
    except ImportError:
        sys.exit("ecologits not installed — run: pip install ecologits")

    tx = args.transcript or newest_transcript()
    if not tx or not os.path.exists(tx):
        sys.exit("no transcript found")

    grids = CFG["grids_gco2_per_kwh"]
    ADPE, PE = 7.4e-8, 9.99  # EcoLogits world-mix defaults for ADPe / primary energy
    R = CFG["savings_vs_baseline"].get(args.mode, 0)

    per = output_tokens_by_model(tx)
    energy = gwp = tokens = 0.0
    print(f"transcript : {tx}")
    for model, out in per.items():
        if not out:
            continue
        p = resolve(model)
        grid = grids.get(p["provider"], grids["default"]) / 1000  # kgCO2eq/kWh
        r = compute_llm_impacts(p["active"], p["total"], out, ADPE, PE, grid)
        energy += _mean(r.energy.value)
        gwp += _mean(r.gwp.value)
        tokens += out
        print(f"  {model:32} {out:>8,} tok  {p['provider']:9} @{grids.get(p['provider'], grids['default'])}g/kWh  -> {_mean(r.gwp.value)*1000:.2f} g")
    k = R / (1 - R) if R < 1 else 0
    print(f"output tok : {int(tokens):,}")
    print(f"energy     : {energy*1000:.2f} Wh")
    print(f"CO2eq      : {gwp*1000:.2f} g  (usage + embodied)")
    print(f"saved (~{int(R*100)}% vs no-Honey): {gwp*1000*k:.2f} g CO2eq")


def _mean(v):
    return getattr(v, "mean", v)


if __name__ == "__main__":
    main()
