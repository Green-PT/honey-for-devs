Write a Python function `merge_intervals(intervals)` that merges all overlapping intervals and
returns a new, sorted list of `[start, end]` pairs.

Input is a list of `[start, end]` pairs (ints or floats), not necessarily sorted; each has
`start <= end`. Intervals that merely **touch** (e.g. `[1, 3]` and `[3, 5]`) count as
overlapping and must merge into `[1, 5]`. Return `[]` for empty input. Do **not** mutate the
input list or its inner lists.

Example: `merge_intervals([[1,3],[2,6],[8,10],[3,4]])` → `[[1, 6], [8, 10]]`.

Put it in a single Python code block. It will be imported as `from solution import merge_intervals`.
