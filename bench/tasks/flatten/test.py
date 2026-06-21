from solution import flatten

assert flatten([1, [2, (3, 4)], [[5]]]) == [1, 2, 3, 4, 5]
assert flatten([]) == []
assert flatten([1, 2, 3]) == [1, 2, 3]
assert flatten([[[[7]]]]) == [7]
# strings are leaves, not iterated
assert flatten(["ab", ["cd", ["ef"]]]) == ["ab", "cd", "ef"]
assert flatten([1, [], [2, []], 3]) == [1, 2, 3]
print("ok")
