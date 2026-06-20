This `median` function is wrong for even-length inputs (it returns the lower-middle element
instead of the average of the two middle elements) and it mutates the caller's list. Fix both.

```python
def median(nums):
    nums.sort()
    return nums[len(nums) // 2]
```

Keep the signature `median(nums)`. Return a float average for even-length input. Put the
fixed version in a single Python code block. It will be imported as `from solution import median`.
