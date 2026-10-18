# Instructions

Given a string representing a matrix of numbers, return the rows and columns of that matrix.

So given a string with embedded newlines like:

```text
9 8 7
5 3 2
6 6 7
```

representing this matrix:

```text
    1  2  3
  |---------
1 | 9  8  7
2 | 5  3  2
3 | 6  6  7
```

your code should be able to spit out:

- A list of the rows, reading each row left-to-right while moving top-to-bottom across the rows,
- A list of the columns, reading each column top-to-bottom while moving from left-to-right.

The rows for our example matrix:

- 9, 8, 7
- 5, 3, 2
- 6, 6, 7

And its columns:

- 9, 5, 6
- 8, 3, 6
- 7, 2, 7

# Instructions append

## How this exercise is structured on the Python track

The tests for this exercise expect you to create a Matrix [`class`][classes] (_see also [concept:python/classes]()_).
This is different from _using_ a Matrix object from a third-party library such as [Numpy][numpy-matrix], which is not supported.
 _Don't worry, it's not as complicated as you think!_
 For more starting points and details on `classes` and data structures, take a look at the resources below:


-   [**A First Look at Classes**](https://docs.python.org/3/tutorial/classes.html#a-first-look-at-classes) from the Python 3 documentation. 
-   [**How to Define a Class in Python**](https://realpython.com/python3-object-oriented-programming/#how-to-define-a-class-in-python) from the Real Python website.  
-   [**Data Structures in Python**](https://docs.python.org/3/tutorial/datastructures.html) from the Python 3 documentation.

[numpy-matrix]: https://numpy.org/doc/stable/reference/generated/numpy.matrix.html

Implement it in Python, starting from this stub:

```python
class Matrix:
    def __init__(self, matrix_string):
        pass

    def row(self, index):
        pass

    def column(self, index):
        pass
```

Put the whole solution in a single Python code block. It will be saved as `matrix.py` and imported by a hidden unittest suite.
