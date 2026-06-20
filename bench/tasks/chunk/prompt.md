Write a JavaScript function `chunk(array, size)` that splits `array` into consecutive
sub-arrays of length `size`, with the final chunk holding the remainder.

- `chunk([1,2,3,4,5], 2)` → `[[1,2],[3,4],[5]]`.
- `size` is a positive integer; the original array is not mutated.
- An empty array returns `[]`.

Put it in a single JavaScript code block and `module.exports = chunk` (or
`module.exports = { chunk }`). It will be required from `./solution.js`.
