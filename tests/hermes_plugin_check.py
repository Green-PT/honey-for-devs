"""Behaviour check for the Hermes plugin (.hermes/__init__.py) against a stand-in for
Hermes' plugin context. Run by tests/hermes-plugin.test.js; exits non-zero on failure."""

import importlib.util
import sys
from pathlib import Path

PLUGIN = Path(__file__).resolve().parent.parent / ".hermes"


def load():
    spec = importlib.util.spec_from_file_location("honey_hermes_plugin", PLUGIN / "__init__.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class OldCtx:
    """Hermes before register_system_prompt_section."""

    def __init__(self):
        self.sections, self.hooks, self.commands, self.skills = {}, {}, {}, {}

    def register_hook(self, name, fn):
        self.hooks[name] = fn

    def register_command(self, name, fn, **_):
        self.commands[name] = fn

    def register_skill(self, name, path, description=""):
        assert Path(path).is_file(), path
        self.skills[name] = description


class Ctx(OldCtx):
    def register_system_prompt_section(self, id, content, *, position, max_chars):
        self.sections[id] = (content, max_chars)


mod = load()
ctx = Ctx()
mod.register(ctx)

on_disk = sorted(p.name for p in (PLUGIN / "skills").iterdir() if (p / "SKILL.md").is_file())
assert sorted(ctx.skills) == on_disk, (sorted(ctx.skills), on_disk)
assert all(ctx.skills.values()), "every skill needs a description for the skill catalogue"

content, max_chars = ctx.sections["honey.core"]
text = content({})
assert (PLUGIN / "COMPACT.md").read_text(encoding="utf-8").strip() in text
assert len(text) <= max_chars, len(text)
assert all(f"honey:{n}" in text for n in on_disk)

# A skill that runs bin/check.js finds it two directories above its SKILL.md.
for name in on_disk:
    if "bin/check.js" in (PLUGIN / "skills" / name / "SKILL.md").read_text(encoding="utf-8"):
        assert (PLUGIN / "skills" / name / ".." / ".." / "bin" / "check.js").resolve().is_file(), name

hook, honey = ctx.hooks["pre_llm_call"], ctx.commands["honey"]
assert hook(is_first_turn=True) is None, "default level adds nothing per turn"
assert "ultra" in honey("ultra") and "ultra" in hook()["context"]
honey("off")
assert "off" in hook()["context"].lower()
assert honey("bogus").startswith("Usage")
honey("full")
assert hook() is None

old = OldCtx()
load().register(old)
assert text in old.hooks["pre_llm_call"](is_first_turn=True)["context"]
assert old.hooks["pre_llm_call"](is_first_turn=False) is None
old.commands["honey"]("off")
assert "HONEY (I Shrunk" not in old.hooks["pre_llm_call"](is_first_turn=True)["context"], "off sends no directive"

print("ok: hermes plugin")
sys.exit(0)
