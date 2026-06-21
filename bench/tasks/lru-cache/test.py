from solution import LRUCache

c = LRUCache(2)
c.put(1, 1)
c.put(2, 2)
assert c.get(1) == 1            # 1 used, 2 is now LRU
c.put(3, 3)                     # evicts 2
assert c.get(2) == -1
c.put(4, 4)                     # evicts 1 (3 and 1 present; 1 is LRU)
assert c.get(1) == -1
assert c.get(3) == 3
assert c.get(4) == 4

# update counts as use
d = LRUCache(2)
d.put(1, 1)
d.put(2, 2)
d.put(1, 10)                    # 1 updated -> 2 is LRU
d.put(3, 3)                     # evicts 2
assert d.get(2) == -1
assert d.get(1) == 10
assert d.get(3) == 3

# absent key
assert LRUCache(1).get(99) == -1

print("ok")
