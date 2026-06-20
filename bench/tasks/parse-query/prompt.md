Write a JavaScript function `parseQuery(qs)` that parses a URL query string into an object.

- Leading `?` is optional and ignored.
- Percent-encoding is decoded (`%20` → space) and `+` means space.
- A key that appears more than once collects its values into an array, in order.
- A key with no `=` (e.g. `flag`) maps to an empty string `""`.
- Empty input returns `{}`.

Example: `parseQuery("?a=1&b=hi%20there&a=2&flag")` →
`{ a: ["1", "2"], b: "hi there", flag: "" }`.

Put it in a single JavaScript code block and `module.exports = parseQuery` (or
`module.exports = { parseQuery }`). It will be required from `./solution.js`.
