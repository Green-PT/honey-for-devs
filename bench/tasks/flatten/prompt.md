Write a Python function `flatten(nested)` that returns a single flat list containing every
non-list element of `nested`, in left-to-right order, however deeply the lists are nested.

Treat lists and tuples as nestable; everything else (ints, strings, etc.) is a leaf — do not
iterate into strings. Example: `flatten([1, [2, (3, 4)], [[5]]])` → `[1, 2, 3, 4, 5]`.

Put it in a single Python code block. It will be imported as `from solution import flatten`.
