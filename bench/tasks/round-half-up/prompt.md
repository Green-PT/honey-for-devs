Write a Python function `round_half_up(x, ndigits=0)` that rounds `x` to `ndigits` decimal
places, rounding halves **away from zero** — so `2.5` → `3` and `-2.5` → `-3`. This is *not*
Python's built-in `round`, which uses banker's rounding (round-half-to-even) and is also
subject to binary-float representation error.

Return a float. Examples:
- `round_half_up(0.5)` → `1.0`
- `round_half_up(2.5)` → `3.0`
- `round_half_up(-1.5)` → `-2.0`
- `round_half_up(3.14159, 2)` → `3.14`
- `round_half_up(2.675, 2)` → `2.68`

Put it in a single Python code block. It will be imported as `from solution import round_half_up`.
