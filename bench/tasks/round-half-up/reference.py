from decimal import Decimal, ROUND_HALF_UP


def round_half_up(x, ndigits=0):
    q = Decimal(1).scaleb(-ndigits)
    return float(Decimal(str(x)).quantize(q, rounding=ROUND_HALF_UP))
