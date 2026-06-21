Write a Python function `format_bytes(n)` that formats a non-negative integer byte count as a
human-readable string using binary units (1 unit = 1024 of the previous): B, KB, MB, GB, TB, PB.

- Below 1024 bytes: `"<n> B"` (no decimals), e.g. `format_bytes(500) == "500 B"`.
- Otherwise one decimal place and the largest unit that keeps the value below 1024, e.g.
  `format_bytes(1536) == "1.5 KB"`, `format_bytes(1048576) == "1.0 MB"`.

Put it in a single Python code block. It will be imported as `from solution import format_bytes`.
