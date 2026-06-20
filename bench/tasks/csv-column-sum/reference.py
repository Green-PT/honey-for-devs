import csv, io

def column_sum(csv_text, column):
    reader = csv.DictReader(io.StringIO(csv_text))
    if column not in (reader.fieldnames or []):
        raise KeyError(column)
    return sum(float(row[column]) for row in reader)
