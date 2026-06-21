def parse_pagination(params):
    def pos_int(value, name):
        try:
            n = int(value)
        except (ValueError, TypeError):
            raise ValueError(f"{name} must be an integer")
        if n < 1:
            raise ValueError(f"{name} must be >= 1")
        return n

    page = pos_int(params.get("page", 1), "page")
    page_size = min(pos_int(params.get("page_size", 20), "page_size"), 100)
    return {"page": page, "page_size": page_size}
