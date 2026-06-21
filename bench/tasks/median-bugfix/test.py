from solution import median

assert median([3, 1, 2]) == 2
assert median([1, 2, 3, 4]) == 2.5          # even -> average of middles
assert median([4, 1, 3, 2]) == 2.5          # unsorted even
assert median([5]) == 5

# must not mutate caller's list
src = [3, 1, 2]
median(src)
assert src == [3, 1, 2], "median mutated its argument"
print("ok")
