from solution import parse_pagination

assert parse_pagination({}) == {"page": 1, "page_size": 20}
assert parse_pagination({"page": "3", "page_size": "50"}) == {"page": 3, "page_size": 50}
assert parse_pagination({"page_size": "500"}) == {"page": 1, "page_size": 100}  # clamped
for bad in ({"page": "0"}, {"page": "abc"}, {"page": "-1"}, {"page_size": "0"}):
    try:
        parse_pagination(bad)
        assert False, f"expected ValueError for {bad}"
    except ValueError:
        pass
print("ok")
