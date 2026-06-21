def format_bytes(n):
    if n < 1024:
        return f"{n} B"
    size = float(n)
    units = ["KB", "MB", "GB", "TB", "PB"]
    for u in units:
        size /= 1024
        if size < 1024 or u == units[-1]:
            return f"{size:.1f} {u}"
