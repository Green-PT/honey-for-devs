# Efficient Structured Format (ESF) 1

ESF is a compact, lossless wire format for agent handoffs. It optimizes the common
shape: a small envelope plus uniform record arrays. It is UTF-8, line-oriented,
streamable, and deliberately narrower than JSON.

```esf
!esf/1
from=reviewer
to=implementer
kind=code_review
findings[2]{severity,file,line,message}
high\tsrc/auth.js\t42\ttoken never expires
medium\tsrc/api.js\t18\tmissing rate limit
meta{complete,retry}
true\tnull
```

## Grammar

```text
document = "!esf/1" LF entry*
entry    = name "=" cell LF
         | name "[" count "]" ("{" fields "}")? LF row{count}
         | name "{" fields "}" LF row
fields   = name *("," name)
row      = cell *(TAB cell) LF
name     = ALPHA / "_", then ALPHA / DIGIT / "_" / "." / "-"
```

- `name=value` encodes a scalar.
- `name[N]` encodes `N` scalar rows.
- `name[N]{a,b}` encodes `N` records; the schema appears once.
- `name{a,b}` encodes one record.
- Cells use JSON for `null`, booleans, numbers, arrays, objects, empty strings,
  ambiguous strings, or strings containing tabs/newlines. Other strings are bare.
- The root is an object. Names are unique. Record rows must have exactly the
  declared fields, in order. Counts are checksums: truncated or extra rows fail.
- An empty object is `name{}` followed by one empty line; an empty array is
  `name[0]` with no rows. Both round-trip.
- Names must match the grammar above. Keys with spaces or non-ASCII characters are
  rejected at encode time, not escaped — ESF assumes code-controlled identifiers.
- Numbers are finite JSON numbers. Negative zero collapses to `0` inside nested JSON
  cells, matching `JSON.stringify`; ESF inherits JSON's number semantics. Duplicate
  names/fields and mixed record schemas are invalid.

## Agent Contract

Use `from`, `to`, `kind`, and `id` when routing matters. Put repeated work items in
record arrays. Keep auth, money, migrations, deletion, and other irreversible
instructions in JSON validated against an application schema; compactness is not
worth an ambiguous high-impact action.

ESF does not replace JSON for public APIs, deeply nested data, signatures, or
untrusted input. Version changes require a new header such as `!esf/2`.
