Write a Python function `parse_pagination(params)` for an API endpoint. `params` is a dict that
may contain `"page"` and `"page_size"` as strings (e.g. from a query string).

- Default `page` is 1 and default `page_size` is 20 when absent.
- Both must be positive integers (>= 1); reject anything else (non-integer, zero, negative) by
  raising `ValueError`.
- Clamp `page_size` to a maximum of 100.
- Return a dict `{"page": <int>, "page_size": <int>}`.

Put it in a single Python code block. It will be imported as `from solution import parse_pagination`.
