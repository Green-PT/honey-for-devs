Write a Python function `column_sum(csv_text, column)` that parses `csv_text` (a string of CSV
with a header row) and returns the sum of the named `column` as a float.

Values in the column are numeric. Handle quoted fields containing commas correctly (standard CSV
quoting). If the column name is not in the header, raise `KeyError`.

Put it in a single Python code block. It will be imported as `from solution import column_sum`.
