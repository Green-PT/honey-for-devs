from solution import merge_intervals


def eq(a, b):
    assert a == b, (a, b)


eq(merge_intervals([]), [])
eq(merge_intervals([[1, 4]]), [[1, 4]])
eq(merge_intervals([[1, 3], [2, 6], [8, 10], [3, 4]]), [[1, 6], [8, 10]])
eq(merge_intervals([[1, 3], [3, 5]]), [[1, 5]])              # touching -> merge
eq(merge_intervals([[5, 6], [1, 2], [3, 4]]), [[1, 2], [3, 4], [5, 6]])  # unsorted, disjoint
eq(merge_intervals([[-5, -1], [-3, 0], [2, 3]]), [[-5, 0], [2, 3]])      # negatives
src = [[2, 6], [1, 3]]
merge_intervals(src)
assert src == [[2, 6], [1, 3]], src                          # input not mutated
print("ok")
