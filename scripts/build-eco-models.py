#!/usr/bin/env python3
"""Export EcoLogits' model registry to hooks/eco-models.json.

This is the source of truth for model params (active/total billions) — EcoLogits'
data, not ours. Run after `pip install ecologits` to refresh:

    python scripts/build-eco-models.py

The JS badge reads the generated JSON so it needs no Python at runtime.
"""
import json, os
from ecologits.model_repository import models

OUT = os.path.join(os.path.dirname(__file__), "..", "hooks", "eco-models.json")


def mean(v):
    return None if v is None else getattr(v, "mean", v)


def norm_provider(p):
    s = str(p).split(".")[-1].lower()
    if "anthropic" in s:
        return "anthropic"
    if "openai" in s:
        return "openai"
    if "google" in s or "gemini" in s:
        return "google"
    return s


out = {}
for m in models.list_models():
    arch = getattr(m, "architecture", None)
    par = getattr(arch, "parameters", None) if arch else None
    if not par:
        continue
    a, t = mean(getattr(par, "active", None)), mean(getattr(par, "total", None))
    if a is None or t is None:
        continue
    out[m.name] = {"active": a, "total": t, "provider": norm_provider(m.provider)}

with open(OUT, "w") as f:
    json.dump({"_source": "EcoLogits model_repository (genai-impact/ecologits)", "models": out}, f, indent=0)
    f.write("\n")
print(f"wrote {len(out)} models -> {os.path.relpath(OUT)}")
