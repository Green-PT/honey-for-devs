# Instructions

Your task is to, given a diagram, determine which plants each child in the kindergarten class is responsible for.

There are 12 children in the class:

- Alice, Bob, Charlie, David, Eve, Fred, Ginny, Harriet, Ileana, Joseph, Kincaid, and Larry.

Four different types of seeds are planted:

| Plant  | Diagram encoding |
| ------ | ---------------- |
| Grass  | G                |
| Clover | C                |
| Radish | R                |
| Violet | V                |

Each child gets four cups, two on each row:

```text
[window][window][window]
........................ # each dot represents a cup
........................
```

Their teacher assigns cups to the children alphabetically by their names, which means that Alice comes first and Larry comes last.

Here is an example diagram representing Alice's plants:

```text
[window][window][window]
VR......................
RG......................
```

In the first row, nearest the windows, she has a violet and a radish.
In the second row she has a radish and some grass.

Your program will be given the plants from left-to-right starting with the row nearest the windows.
From this, it should be able to determine which plants belong to each student.

For example, if it's told that the garden looks like so:

```text
[window][window][window]
VRCGVVRVCGGCCGVRGCVCGCGV
VRCCCGCRRGVCGCRVVCVGCGCV
```

Then if asked for Alice's plants, it should provide:

- Violets, radishes, violets, radishes

While asking for Bob's plants would yield:

- Clover, grass, clover, clover

# Instructions append

## How this exercise is structured on the Python track

The tests for this exercise expect your program to be implemented as a Garden [`class`][classes in python] (_see also [concept:python/classes]()_).
If you are unfamiliar with classes in Python, this [Real Python tutorial][how-to-make-a-class] could be a good additional place to start.

Your `class` should implement a [`method`][methods] called `plants`, which takes a student's name as an argument and returns the `list` of plant names belonging to that student.


## Constructors

Creating the example garden:

```python
[window][window][window]
VRCGVVRVCGGCCGVRGCVCGCGV
VRCCCGCRRGVCGCRVVCVGCGCV
```

would, in the tests, be represented as `Garden("VRCGVVRVCGGCCGVRGCVCGCGV\nVRCCCGCRRGVCGCRVVCVGCGCV")`.

To make this representation work, your `class` will need to implement an [`__init__()`][init] [special method][special-methods].
If you're not familiar with `__init__()` or [_constructors_][what-is-a-constructor], [class and instance objects][class vs instance objects in python] from the Python docs gives a more detailed explanation.


## Default Parameters

In some tests, a `list` of students is passed as an argument to `__init__()`.
This should override the twelve student roster provided in the problem statement.
Both of these statements need to work with your `__init__()` method:


```Python
# Make a garden based on the default 12-student roster.
Garden("VRCGVVRVCGGCCGVRGCVCGCGV\nVRCCCGCRRGVCGCRVVCVGCGCV") 

# Make a garden based on a 2-student roster.
Garden("VRCC\nVCGG", students=["Valorie", "Raven"]) 
```

One approach is to make the student `list` a [default argument][default argument values]; the Python docs describe `default parameters` in depth while explaining [function definitions][function definitions].


[class vs instance objects in python]: https://docs.python.org/3/tutorial/classes.html#class-objects
[classes in python]: https://docs.python.org/3/tutorial/classes.html#a-first-look-at-classes
[default argument values]: https://docs.python.org/3/tutorial/controlflow.html#default-argument-values
[function definitions]: https://docs.python.org/3/reference/compound_stmts.html#function-definitions
[how-to-make-a-class]: https://realpython.com/python3-object-oriented-programming/#how-to-define-a-class-in-python
[init]: https://docs.python.org/3/reference/datamodel.html#object.__init__
[methods]: https://docs.python.org/3/tutorial/classes.html#class-definition-syntax
[special-methods]: https://docs.python.org/3.11/reference/datamodel.html#special-method-names
[what-is-a-constructor]: https://en.wikipedia.org/wiki/Constructor_(object-oriented_programming)

Implement it in Python, starting from this stub:

```python
class Garden:
    def __init__(self, diagram, students):
        pass
```

Put the whole solution in a single Python code block. It will be saved as `kindergarten_garden.py` and imported by a hidden unittest suite.
