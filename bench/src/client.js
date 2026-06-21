"use strict";
// Minimal Anthropic Messages client over fetch (Node 18+ global fetch) — no SDK dep,
// matching the repo's zero-dependency style. Reads ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL.

const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");

async function complete({ model, system, user, maxTokens = 4096, thinking = 0 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: user }],
  };
  // Cache the skill system prompt: in real agentic use it's loaded once per session, not
  // re-billed per task. cache_control makes repeat calls read it at ~10% input cost.
  if (system) body.system = [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
  if (thinking > 0) {
    body.thinking = { type: "enabled", budget_tokens: thinking };
    body.max_tokens = maxTokens + thinking; // max_tokens must exceed the thinking budget
  }

  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const u = data.usage || {};
  return {
    text,
    usage: {
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      // cache fields are reported but not added into billed totals here
      cache_read: u.cache_read_input_tokens || 0,
      cache_write: u.cache_creation_input_tokens || 0,
    },
  };
}

module.exports = { complete };
