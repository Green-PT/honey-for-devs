from solution import slugify

assert slugify("Hello, World!") == "hello-world"
assert slugify("  Foo   Bar  ") == "foo-bar"
assert slugify("C++ Guide") == "c-guide"
assert slugify("--already--slug--") == "already-slug"
assert slugify("") == ""
assert slugify("MixedCASE123") == "mixedcase123"
print("ok")
