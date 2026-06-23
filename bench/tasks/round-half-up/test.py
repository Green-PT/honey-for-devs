from solution import round_half_up


def eq(a, b):
    assert a == b, (a, b)


eq(round_half_up(0.5), 1.0)
eq(round_half_up(1.5), 2.0)      # banker's round() gives 2 here too, but...
eq(round_half_up(2.5), 3.0)      # ...banker's round(2.5) == 2 -> fails naive delegation
eq(round_half_up(-0.5), -1.0)
eq(round_half_up(-2.5), -3.0)
eq(round_half_up(3.14159, 2), 3.14)
eq(round_half_up(2.675, 2), 2.68)  # binary-float trap: round(2.675,2) == 2.67
print("ok")
