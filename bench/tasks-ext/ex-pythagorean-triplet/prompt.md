# Description

A Pythagorean triplet is a set of three natural numbers, {a, b, c}, for which,

```text
a² + b² = c²
```

and such that,

```text
a < b < c
```

For example,

```text
3² + 4² = 5².
```

Given an input integer N, find all Pythagorean triplets for which `a + b + c = N`.

For example, with N = 1000, there is exactly one Pythagorean triplet for which `a + b + c = 1000`: `{200, 375, 425}`.

# Instructions append

~~~~exercism/note

The description above mentions [_mathematical sets_][math-sets], but also that a Pythagorean Triplet {a, b, c} _**must**_ be ordered such that a < b < c (_ascending order_). 

This makes Python's [`set` type][python-sets] unsuited to this exercise, since it is inherently _unordered_. 
You should return a [`list`][python-list] of `list`s instead (_e.g. `[[a, b, c]]`_). 
You can generate the triplets themselves in whichever order you would like, as the enclosing `list`'s order will be ignored in the tests. 

[math-sets]: https://en.wikipedia.org/wiki/Set_(mathematics)
[python-sets]: https://docs.python.org/3/tutorial/datastructures.html#sets
[python-list]: https://docs.python.org/3/tutorial/datastructures.html#more-on-lists
~~~~

Implement it in Python, starting from this stub:

```python
def triplets_with_sum(number):
    pass
```

Put the whole solution in a single Python code block. It will be saved as `pythagorean_triplet.py` and imported by a hidden unittest suite.
