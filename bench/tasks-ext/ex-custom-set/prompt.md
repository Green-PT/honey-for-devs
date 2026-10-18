# Instructions

Create a custom set type.

Sometimes it is necessary to define a custom data structure of some type, like a set.
In this exercise you will define your own set.
How it works internally doesn't matter, as long as it behaves like a set of unique elements.

Implement it in Python, starting from this stub:

```python
class CustomSet:
    def __init__(self, elements=[]):
        pass

    def isempty(self):
        pass

    def __contains__(self, element):
        pass

    def issubset(self, other):
        pass

    def isdisjoint(self, other):
        pass

    def __eq__(self, other):
        pass

    def add(self, element):
        pass

    def intersection(self, other):
        pass

    def __sub__(self, other):
        pass

    def __add__(self, other):
        pass
```

Put the whole solution in a single Python code block. It will be saved as `custom_set.py` and imported by a hidden unittest suite.
