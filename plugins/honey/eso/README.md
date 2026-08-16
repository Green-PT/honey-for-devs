# ESON — Efficient Structured Object Notation

> Vendored copy. ESON's canonical home is
> **[Green-PT/honey-eson](https://github.com/Green-PT/honey-eson)** — normative spec,
> JS + Python reference implementations, conformance vectors, canonical LLM primer,
> Wire Profile, and negotiation. This directory tracks its JS implementation so the
> honey plugin runs dependency-free.

A compact, lossless **serialization format** for agent-to-agent messages, optimized for
the metric that matters when the reader is an LLM: **tokens, not bytes**. It targets the
common handoff shape — a small envelope plus uniform record arrays — and stays text,
line-oriented, and round-trip exact.

```eso
!eson/1
from=reviewer
to=implementer
kind=code_review
findings[2]{severity,file,line,message}
high	src/auth.js	42	token never expires
medium	src/api.js	18	missing rate limit
```

## Not a protocol — a wire format

ESON is the encoding layer that sits **under** a transport/protocol like
[MCP](https://modelcontextprotocol.io) or [A2A](https://google.github.io/A2A/), not a
replacement for them. It defines how a message *body* is serialized; it does not define
RPC, correlation, acks, capability negotiation, or transport. Use it for the payload of a
message another agent will read, where token cost dominates.

MessagePack, Protobuf, and CBOR optimize **byte** size and tokenize *worse* (binary →
noisy tokens). ESON optimizes for the model's tokenizer while staying parseable and
diff-able. The nearest sibling is [TOON](https://github.com/toon-format/toon).

## Numbers

Token efficiency vs compact JSON, 5 handoff documents, `o200k` (`npm run bench:formats`):

| Format | Valid JSON? | vs compact JSON |
|---|:--:|---:|
| JSON (pretty) — models' unprompted default | yes | **+55%** |
| JSON (compact) | yes | 0% |
| TOON | no | −20% |
| JSON (columnar) | yes | −22% |
| **ESON** | no | **−28%** |

Comprehension (Claude Haiku 4.5 + GPT-4.1-mini, 50-record doc): ESON **ties** JSON at 100%
on every realistic access pattern (key-lookup, column-match, nested-cell, nested-array).
Positional access ("the Nth row") and in-context counting fail across *all* formats — a
model limit, not ESON's. Aggregate in code, address records by key. See
[../bench/eso/VERDICT.md](../bench/eso/VERDICT.md).

## When to use it

**Good fit** — envelope + uniform record array, read by a model:
- Tool-result payloads (search/grep hits, DB rows, log lines, vector-search results). The
  `[N]` row count is a checksum that catches truncation.
- Orchestrator↔worker handoffs: task queues, work-item batches, result aggregation.
- Eval / LLM-judge batches.

**Reach for plain JSON instead** — deeply nested data, public/untrusted I/O, tiny or
scalar-only messages (the format primer costs more than it saves), and any irreversible
instruction (auth, money, migrations, deletes) which should stay schema-validated JSON.

## Use

```js
const { encode, decode, tryDecode } = require("./eso");

const wire = encode({ from: "a", to: "b", items: [{ id: 1, ok: true }] });
const back = decode(wire);              // throws on malformed input
const res  = tryDecode(wire);           // { ok: true, value } | { ok: false, error }
```

CLI (reads stdin, writes stdout):

```sh
eso encode < message.json    # JSON → ESON
eso decode < message.eso     # ESON → JSON
```

## Contract

- **Root is an object. Names are code-controlled** — keys with spaces or non-ASCII chars
  are rejected at encode time, not escaped.
- **One schema per record array.** A heterogeneous batch (mixed message/event types) must
  be split into one array per type.
- **Counts are checksums** — a truncated or padded array fails to decode. Verify on read.
- **Large integers round-trip** as `BigInt` (encode → bare digits; decode of an
  out-of-safe-range integer → `BigInt`). Prefer **string ids** in JSON-bridge pipelines:
  the CLI's `encode` reads via `JSON.parse`, which corrupts big-int literals before ESON
  sees them. `BigInt` nested inside a JSON cell is rejected — keep large ids top-level or
  as record fields.

Full grammar and edge cases: [SPEC.md](SPEC.md).
