from solution import column_sum

csv = "name,amount\nalice,10\nbob,5.5\ncarol,4.5\n"
assert column_sum(csv, "amount") == 20.0

# quoted field containing a comma must not break parsing
csv2 = 'item,price\n"widget, deluxe",100\n"gizmo",50\n'
assert column_sum(csv2, "price") == 150.0

# missing column -> KeyError
try:
    column_sum(csv, "nope")
    assert False, "expected KeyError"
except KeyError:
    pass
print("ok")
