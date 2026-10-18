# External tasks (Exercism)

`tasks/` was written by the Honey authors. This folder is not: 21 Python exercises from
[exercism/python](https://github.com/exercism/python) at `6105f6d` (MIT, see
`LICENSE-exercism`), each with Exercism's own instructions, stub, unittest suite and example
solution (`reference.py`).

Selection rule, fixed before any run: practice exercises with difficulty 3–6 (62), sorted by
slug, every 3rd one (21), kept only if the example solution passes its own tests in a folder
holding just the two files (21 of 21 did). Nothing was added or removed by hand.

```bash
TASKS_DIR=tasks-ext node src/verify-tests.js
TASKS_DIR=tasks-ext STAMP=<stamp> node src/run.js
```

Exercism exercises are public and widely solved, so models may have seen them; that biases
every arm equally and leaves the paired comparison intact.
