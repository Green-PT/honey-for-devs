def flatten(nested):
    out = []
    for x in nested:
        if isinstance(x, (list, tuple)):
            out.extend(flatten(x))
        else:
            out.append(x)
    return out
