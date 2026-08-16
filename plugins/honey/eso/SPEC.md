# ESON — Efficient Structured Object Notation, version 1.1

ESON is a compact, lossless, line-oriented text encoding for structured payloads
whose reader is a language model or a program — typically agent-to-agent
handoffs. It optimizes the common shape: a small envelope of scalars plus
uniform record arrays. It is UTF-8 and deliberately narrower than JSON.

The key words MUST, MUST NOT, SHOULD, and MAY are to be interpreted as in
RFC 2119. Version 1.1 is additive over 1.0: the wire header stays `!eson/1`;
1.0 documents remain valid except where they used a record array whose first
field is named `n` (now reserved, §5).

```eson
!eson/1
from=reviewer
to=implementer
kind=code_review
findings[2]{n,severity,file,line,message}
1	high	src/auth.js	42	token never expires
2	medium	src/api.js	18	missing rate limit
meta{complete,retry}
true	null
```

## 1. Grammar

```text
document = "!eson/1" LF entry*
entry    = name "=" cell LF                          ; scalar
         | name "[" count "]" LF row{count}          ; scalar array
         | name "[" count "]" "{" fields "}" LF row{count}   ; record array
         | name "{" fields "}" LF row                ; single record
fields   = name *("," name)
row      = cell *(TAB cell) LF
name     = (ALPHA / "_") *(ALPHA / DIGIT / "_" / "." / "-")
count    = 1*DIGIT
```

- The document root is an object; top-level `name`s MUST be unique.
- Record rows MUST have exactly the declared fields, in declared order.
  Field names within one section MUST be unique.
- Encoders MUST terminate the document with a final LF. Decoders SHOULD accept
  a missing final LF and MUST accept CRLF line endings (normalized to LF).
- An empty array is `name[0]` with no rows. An empty object is `name{}`
  followed by one empty row line. That empty line is significant; transports
  that strip blank lines corrupt empty objects — see §7.

## 2. Cells

A cell is one of:

- **bare string** — used iff the string is non-empty, has no leading/trailing
  whitespace, contains no TAB, CR, or LF, does not parse as a JSON number, is
  not `null`/`true`/`false`, and does not start with `"`, `[`, or `{`.
- **JSON value** — everything else: `null`, booleans, numbers, quoted strings,
  and nested arrays/objects as compact (unindented) JSON text.

Decoding a cell: `null`/`true`/`false` and JSON numbers decode as those
values; text starting with `"`, `[`, or `{` MUST parse as JSON (a parse
failure rejects the document); anything else is the bare string itself.

## 3. Numbers

- Numbers MUST be finite. Non-finite values reject at encode time.
- **Integers are arbitrary precision.** A bare integer cell MUST round-trip
  exactly regardless of magnitude; implementations MUST NOT route integer
  literals through a binary float (e.g. `9007199254740993` must not corrupt to
  `…992`). Hosts use their native big-integer type (JavaScript `BigInt`,
  Python `int`). Inside nested JSON cells, integers beyond IEEE-754 exactness
  are NOT protected — keep large ids as top-level or record fields.
- Fractional/exponent numbers carry IEEE-754 double semantics, as in JSON.

## 4. Names

Names (top-level and field) MUST match the `name` production. Keys with
spaces, non-ASCII characters, or a leading digit are rejected at encode time,
not escaped — ESON assumes code-controlled identifiers. Payload *data* is
unrestricted (any Unicode string encodes as a cell).

## 5. The reserved `n` field (positional access)

Language models cannot reliably address "the Nth row" in any un-numbered
format — measured 0–17% accuracy even on frontier models, in ESON, JSON, and
columnar JSON alike. An explicit row number restores it to 100% for ~6–9%
more tokens.

Version 1.1 therefore reserves the field name `n` **when it is the first
field of a record array**:

- Its cells MUST be the 1-based, sequential row numbers (`1..count`).
- Decoders MUST reject a document where they are not — like the `[count]`
  checksum, a broken sequence means rows were dropped, duplicated, or
  reordered in transit.
- Encoders SHOULD offer an option to number record arrays (reference
  implementations: `encode(value, {number: true})` / `encode(value, number=True)`).
- `n` in any other position (non-first field, single records, scalars) is
  ordinary data.

Producers SHOULD number record arrays whenever a model may address rows
positionally, and omit `n` in pure key-lookup pipelines.

## 6. Agent contract

- Use `from`, `to`, `kind`, and `id` top-level fields when routing matters.
- Put repeated work items in record arrays. One array carries one schema; a
  heterogeneous batch MUST be split into one array per type.
- Address records by stable key, never by ordinal — unless you ship the
  reserved `n` field (§5).
- Never ask a model to count or aggregate rows; filtered counting scores ~0%
  in every format, including plain JSON. Aggregate in code and send the result.
- Treat `[count]` (and `n`, when present) as checksums on read.

## 7. Scope and carve-outs

ESON does not replace JSON for public APIs, deeply nested data, signatures, or
untrusted input. Keep auth, money, migrations, deletion, and other
irreversible instructions in JSON validated against an application schema;
compactness is not worth an ambiguous high-impact action. Transports that
strip or collapse blank lines (some templating and chat layers) corrupt empty
objects (§1); when in doubt, avoid `{}` payloads or wrap the document.

## 8. Versioning and conformance

- The header names the wire version. Incompatible changes require `!eson/2`;
  decoders MUST reject headers they do not support.
- An implementation conforms iff it passes `vectors/vectors.json`: canonical
  encoding for `valid` (byte-equal), lossless decoding for `valid` and
  `decode_only`, and rejection of every `invalid` document.
- Suggested media type: `text/vnd.eson`; suggested extension: `.eson`.
