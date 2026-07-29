# Python Core — Complete Study Notes (Basics → CPython Internals)

Self-contained. No internet needed. Every concept explained fully inline.

---

## Table of Contents

1. [Python Basics & Memory Model](#1-python-basics--memory-model)
   - [1.1 CPython Architecture](#11-cpython-architecture)
   - [1.2 Everything is an Object](#12-everything-is-an-object)
   - [1.3 The Global Interpreter Lock (GIL)](#13-the-global-interpreter-lock-gil)
   - [1.4 Reference Counting](#14-reference-counting)
2. [Data Structures — Internals & Complexity](#2-data-structures--internals--complexity)
   - [2.1 List (Dynamic Array)](#21-list-dynamic-array)
   - [2.2 Dict (Hash Map)](#22-dict-hash-map)
   - [2.3 Set (Hash Set)](#23-set-hash-set)
   - [2.4 Tuple (Immutable Sequence)](#24-tuple-immutable-sequence)
   - [2.5 deque, heapq, OrderedDict](#25-deque-heapq-ordereddict)
3. [Python OOP](#3-python-oop)
   - [3.1 Method Resolution Order (MRO)](#31-method-resolution-order-mro)
   - [3.2 Dunder Methods](#32-dunder-methods)
   - [3.3 Descriptors](#33-descriptors)
   - [3.4 Metaclasses](#34-metaclasses)
   - [3.5 Abstract Base Classes](#35-abstract-base-classes)
4. [Decorators & Context Managers](#4-decorators--context-managers)
   - [4.1 Decorators Deep Dive](#41-decorators-deep-dive)
   - [4.2 Class Decorators](#42-class-decorators)
   - [4.3 Context Managers](#43-context-managers)
5. [Generators & Iterators](#5-generators--iterators)
   - [5.1 Iterator Protocol](#51-iterator-protocol)
   - [5.2 Generators](#52-generators)
   - [5.3 Generator send/throw/close](#53-generator-sendthrowclose)
   - [5.4 itertools](#54-itertools)
6. [Concurrency](#6-concurrency)
   - [6.1 Threading](#61-threading)
   - [6.2 Multiprocessing](#62-multiprocessing)
   - [6.3 asyncio — Event Loop Internals](#63-asyncio--event-loop-internals)
   - [6.4 async/await Patterns](#64-asyncawait-patterns)
   - [6.5 Choosing the Right Tool](#65-choosing-the-right-tool)
7. [Python Memory Management](#7-python-memory-management)
   - [7.1 CPython Memory Allocator](#71-cpython-memory-allocator)
   - [7.2 Cyclic Garbage Collector](#72-cyclic-garbage-collector)
   - [7.3 Memory Leaks in Python](#73-memory-leaks-in-python)
   - [7.4 tracemalloc & objgraph](#74-tracemalloc--objgraph)
8. [Python Internals](#8-python-internals)
   - [8.1 Bytecode & dis module](#81-bytecode--dis-module)
   - [8.2 Frame Objects](#82-frame-objects)
   - [8.3 __slots__](#83-__slots__)
   - [8.4 String Interning](#84-string-interning)
   - [8.5 Small Integer Cache](#85-small-integer-cache)
9. [FastAPI & Django Internals](#9-fastapi--django-internals)
   - [9.1 FastAPI Request Lifecycle](#91-fastapi-request-lifecycle)
   - [9.2 Django Request Lifecycle](#92-django-request-lifecycle)
   - [9.3 Django ORM Internals](#93-django-orm-internals)
   - [9.4 Middleware Patterns](#94-middleware-patterns)
10. [Python Performance](#10-python-performance)
    - [10.1 Profiling](#101-profiling)
    - [10.2 Caching Strategies](#102-caching-strategies)
    - [10.3 NumPy Vectorization](#103-numpy-vectorization)
    - [10.4 C Extensions & Cython Hints](#104-c-extensions--cython-hints)
11. [Common Python Interview Traps](#11-common-python-interview-traps)
    - [11.1 Mutable Default Arguments](#111-mutable-default-arguments)
    - [11.2 Late Binding Closures](#112-late-binding-closures)
    - [11.3 GIL Misconceptions](#113-gil-misconceptions)
    - [11.4 is vs ==](#114-is-vs-)
    - [11.5 Copy vs Deep Copy](#115-copy-vs-deep-copy)
    - [11.6 Exception Handling Gotchas](#116-exception-handling-gotchas)
12. [Production Patterns](#12-production-patterns)
    - [12.1 Type Hints & mypy](#121-type-hints--mypy)
    - [12.2 dataclasses](#122-dataclasses)
    - [12.3 Pydantic](#123-pydantic)
    - [12.4 ContextVar for Async](#124-contextvar-for-async)
    - [12.5 Structured Logging](#125-structured-logging)

---

## 1. Python Basics & Memory Model

### 1.1 CPython Architecture

CPython (the reference implementation) compiles Python source to bytecode, then interprets it with a stack-based virtual machine.

```text
Source (.py)
     │
     ▼  compile()
Bytecode (.pyc)  ← AST → CFG → bytecode
     │
     ▼  CPython VM (ceval.c)
Execution (eval loop — giant switch statement on opcodes)
```

```text
CPython Layers:

┌─────────────────────────────────────────┐
│  Python Source Code  (your .py files)   │
├─────────────────────────────────────────┤
│  Tokenizer → Parser → AST              │
├─────────────────────────────────────────┤
│  Compiler → Code Objects (bytecode)    │
├─────────────────────────────────────────┤
│  CPython Eval Loop (ceval.c)           │
│  - Frame stack per call                 │
│  - Operand stack (value stack)          │
├─────────────────────────────────────────┤
│  Object Model (PyObject*)              │
├─────────────────────────────────────────┤
│  Memory Allocator (pymalloc)           │
├─────────────────────────────────────────┤
│  OS / libc / malloc                    │
└─────────────────────────────────────────┘
```

**Key files in CPython source:**
- `Objects/` — implementation of all built-in types
- `Python/ceval.c` — the main eval loop
- `Python/compile.c` — AST → bytecode
- `Modules/` — stdlib C extensions

> **💡 Key Insight:** CPython is NOT just an interpreter. It has a full compilation pipeline (tokenize → parse → compile to bytecode). The "interpreter" part is only the final stage. This is why `import` caches `.pyc` files — it skips the first three stages on subsequent loads.

> 🌍 **Real-World:** Dropbox ran one of the largest CPython deployments in the world — their entire backend and desktop sync client were Python. They built custom CPython extensions and profiled `ceval.c` directly to squeeze performance from the eval loop, eventually migrating hot paths to mypy-typed Python and Rust. Understanding CPython's layered architecture was essential to their optimization work.

---

### 1.2 Everything is an Object

In CPython, every Python value is a `PyObject` — a C struct with at minimum:

```text
PyObject:
┌──────────────────┐
│  ob_refcnt       │  ← reference count (Py_ssize_t)
│  *ob_type        │  ← pointer to type object (PyTypeObject)
└──────────────────┘

PyLongObject (int):
┌──────────────────┐
│  ob_refcnt       │
│  *ob_type        │  → &PyLong_Type
│  ob_digit[]      │  ← arbitrary precision digits
└──────────────────┘
```

This means even `int`, `bool`, `None`, `True`, `False` are heap-allocated C structs. Python integers are arbitrary precision — no overflow. The cost: every operation involves pointer dereferences and reference count updates.

```python
import sys
x = 42
print(sys.getsizeof(x))       # 28 bytes — PyObject overhead + digit storage
print(sys.getsizeof(2**100))  # larger — more digits needed
print(type(x).__mro__)        # (<class 'int'>, <class 'object'>)
print(id(x))                  # memory address of the PyObject
```

> **💡 Key Insight:** `id(obj)` returns the memory address of the underlying `PyObject*`. This is why `id` values are only meaningful while the object is alive — CPython can reuse the same address after an object is deleted.

> 🌍 **Real-World:** NumPy and PyTorch store large tensor data as raw C arrays, bypassing CPython's `PyObject` per-element overhead entirely. A NumPy array of 1 million floats stores 8 MB of contiguous C doubles — not 1 million 28-byte Python float objects. This is why vectorized NumPy is orders of magnitude more memory-efficient than a Python list of floats.

---

### 1.3 The Global Interpreter Lock (GIL)

The GIL is a mutex in CPython that allows only **one thread** to execute Python bytecode at a time.

```text
GIL State Machine:

Thread 1 ──────[HOLDS GIL]──────────────────── [DROPS GIL] ──────
                                                        │
Thread 2 ──── [waiting] ────────────────────── [HOLDS GIL] ──────

GIL is released:
  - Every 100 bytecode instructions (Python 2) / every 5ms (Python 3.2+)
  - During I/O operations (socket read/write, file I/O)
  - During C extension calls that explicitly release it (numpy, hashlib)
```

**Why does the GIL exist?**

CPython's memory management is not thread-safe. Reference counting (the mechanism that tracks when to free objects) requires atomic increment/decrement on every object access. Without the GIL, two threads could simultaneously decrement a refcount to zero, causing a double-free. The GIL was simpler than making every object operation thread-safe.

```python
import threading
import time

counter = 0

def increment():
    global counter
    for _ in range(1_000_000):
        counter += 1  # NOT atomic — read-increment-write, but GIL makes it safe

t1 = threading.Thread(target=increment)
t2 = threading.Thread(target=increment)
t1.start(); t2.start()
t1.join(); t2.join()
# counter is usually 2_000_000 — GIL serializes the bytecode
# but NOT guaranteed! counter += 1 is 4 bytecodes, GIL can switch mid-way
```

**GIL impact by task type:**

```text
CPU-bound tasks:
  Thread 1: [compute][GIL switch][wait][compute]...
  Thread 2: [wait][GIL switch][compute][wait]...
  → Effectively single-threaded. Use multiprocessing instead.

I/O-bound tasks:
  Thread 1: [send I/O call → GIL released][wait for OS]
  Thread 2: [GIL acquired][compute][...]
  → True parallelism! I/O releases GIL, other threads run.
```

> **💡 Key Insight:** Python 3.13 introduced a "free-threaded" CPython build (`--disable-gil`). It's experimental and has ~40% overhead for single-threaded code. The GIL won't disappear overnight from production; expect 5+ years of ecosystem transition.

> 🌍 **Real-World:** Instagram's engineering team (running Django at massive scale) famously wrote that the GIL was their friend for I/O-bound Django request handling — the GIL was released on every database call and network I/O, letting hundreds of threads serve requests concurrently on a single process. They scaled by running many gunicorn workers (multiprocessing), not many threads per worker, precisely because of GIL limitations on CPU work.

---

### 1.4 Reference Counting

Every `PyObject` has `ob_refcnt`. When it hits 0, the object is immediately deallocated.

```python
import sys

a = []          # refcount = 1
b = a           # refcount = 2
del a           # refcount = 1
b.append(1)     # still alive
del b           # refcount = 0 → __del__ called → memory freed

print(sys.getrefcount([]))  # always at least 1 — getrefcount arg creates a temporary ref
```

**Reference count changes:**

```text
refcount increases when:
  - Object assigned to a variable:      x = obj
  - Object added to a container:        lst.append(obj)
  - Object passed as argument:          func(obj)
  - Object returned from function:      return obj

refcount decreases when:
  - Variable goes out of scope
  - Variable reassigned:                x = something_else
  - del x
  - Container loses element:            lst.pop()
  - Function returns (local vars freed)
```

**Weakness: cycles**

```python
# Reference counting alone can't free cycles
a = {}
b = {}
a['b'] = b   # b.refcount = 2
b['a'] = a   # a.refcount = 2
del a        # a.refcount = 1 (still held by b['a'])
del b        # b.refcount = 1 (still held by a['b'])
# Neither reaches 0 → memory leak without cycle GC
```

This is why CPython also has a **cyclic garbage collector** (covered in Section 7).

> 🌍 **Real-World:** CPython's reference counting gives Cython and C extension authors deterministic object lifetimes — when a `Py_DECREF` call drops the count to zero, memory is freed immediately, not at a later GC pause. This predictability is why libraries like `lxml` (used by Scrapy and many scrapers) can expose C-level XML tree nodes to Python without large GC pauses disrupting parsing throughput.

---

## 2. Data Structures — Internals & Complexity

### 2.1 List (Dynamic Array)

CPython `list` is a **dynamic array of `PyObject*` pointers**.

```text
list internals:
┌──────────────────────────────────────────────┐
│  PyListObject                                │
│  ob_refcnt: 1                               │
│  ob_type: &PyList_Type                      │
│  ob_size: 3          ← current length       │
│  allocated: 4        ← capacity (slots)     │
│  *ob_item:  ─────────────────────────────▶  │
└──────────────────────────────────────────────┘
                         ┌────┬────┬────┬────┐
                         │ *a │ *b │ *c │ ·  │  ← array of pointers
                         └────┴────┴────┴────┘
                            ↓    ↓    ↓
                         PyObject PyObject PyObject
```

**Growth pattern** — when capacity is exhausted, over-allocates:

```python
# CPython growth formula (Objects/listobject.c):
# new_allocated = (size >> 3) + (3 if size < 9 else 6) + size
# Roughly: 0, 4, 8, 16, 25, 35, 46, 58, 72, 88...

import sys
lst = []
sizes = []
for i in range(20):
    lst.append(i)
    sizes.append(sys.getsizeof(lst))
# You'll see capacity jumps at 4, 8, 16, etc.
```

**Time Complexities:**

```text
Operation          Average    Worst     Notes
──────────────────────────────────────────────────────
append(x)          O(1)*      O(n)      *amortized; resize is O(n)
insert(i, x)       O(n)       O(n)      shifts elements right
pop()              O(1)       O(1)      removes last
pop(i)             O(n)       O(n)      shifts elements left
del lst[i]         O(n)       O(n)      same as pop(i)
lst[i]             O(1)       O(1)      direct pointer arithmetic
len(lst)           O(1)       O(1)      stored in ob_size
x in lst           O(n)       O(n)      linear scan
lst.sort()         O(n log n) O(n log n) Timsort; O(n) if nearly sorted
lst + lst2         O(n+m)     O(n+m)    creates new list
lst * k            O(nk)      O(nk)     creates new list
lst[i:j]           O(j-i)     O(n)      creates new list
```

> **💡 Key Insight:** `list.sort()` uses **Timsort** — a hybrid of merge sort and insertion sort. It finds natural runs in the data and merges them. Best case O(n) on already-sorted data. Timsort was invented for CPython and later adopted by Java's `Arrays.sort()` for objects.

> 🌍 **Real-World:** Spotify's recommendation pipeline uses Python lists as intermediate buffers when assembling ranked track results — appending scored candidates O(1) amortized, then sorting once with Timsort O(n log n). The nearly-sorted property of Timsort is especially valuable when re-ranking an already-ordered candidate set with a small number of new signals, giving near-O(n) performance.

```python
# Common interview pattern: list as stack (O(1) push/pop)
stack = []
stack.append(1)   # push
stack.pop()       # pop — O(1), use this

# NOT a queue — O(n) pop from front
queue_bad = []
queue_bad.pop(0)  # O(n) — shifts all elements left

# Use collections.deque for O(1) both ends
from collections import deque
q = deque()
q.append(1)       # O(1) right push
q.appendleft(0)   # O(1) left push
q.pop()           # O(1) right pop
q.popleft()       # O(1) left pop
```

---

### 2.2 Dict (Hash Map)

Python `dict` is an **open-addressing hash table** with compact storage (Python 3.6+).

```text
Pre-3.6 dict (sparse table):
┌────┬──────┬────────┬────────┐
│hash│ key* │ value* │ (empty)│  ← slots, 2/3 max load factor
└────┴──────┴────────┴────────┘

Python 3.6+ dict (compact + indices):
Indices array (small ints):          Entries array (dense):
┌───┬───┬───┬───┬───┬───┬───┬───┐   ┌────┬──────┬────────┐
│ - │ 0 │ - │ 1 │ - │ 2 │ - │ - │   │hash│  key │  value │  entry 0
└───┴───┴───┴───┴───┴───┴───┴───┘   ├────┼──────┼────────┤
  index array (8 slots for 3 items)  │hash│  key │  value │  entry 1
                                     ├────┼──────┼────────┤
  indices[slot] → entry index        │hash│  key │  value │  entry 2
```

**Benefits of compact dict:**
1. Insertion order preserved (official since Python 3.7)
2. Better cache locality — entries are contiguous
3. Smaller memory for iteration

**Hash collision resolution** — open addressing with pseudo-random probing:

```python
# Slot selection formula (simplified):
# slot = hash(key) % table_size
# On collision: slot = (5*slot + 1 + perturb) % table_size
#               perturb >>= 5

# Perturbation uses all bits of the hash to spread collisions
```

**Time Complexities:**

```text
Operation        Average    Worst     Notes
──────────────────────────────────────────────────────
d[key]           O(1)       O(n)      worst if all keys hash to same slot
d[key] = val     O(1)       O(n)
del d[key]       O(1)       O(n)
key in d         O(1)       O(n)
len(d)           O(1)       O(1)
d.keys()         O(1)       O(1)      returns view, not copy
d.values()       O(1)       O(1)      returns view
d.items()        O(1)       O(1)      returns view
d.get(k, def)    O(1)       O(n)
d.update(d2)     O(len d2)  O(n)
dict(d)          O(n)       O(n)      copy
```

```python
# Key must be hashable — implements __hash__ and __eq__
# Unhashable types: list, dict, set (mutable containers)
d = {}
d[[1,2]] = "x"   # TypeError: unhashable type: 'list'
d[(1,2)] = "x"   # OK — tuple is hashable (if elements are hashable)

# Custom class: default hash is id-based
class Point:
    def __init__(self, x, y): self.x, self.y = x, y
    def __hash__(self): return hash((self.x, self.y))
    def __eq__(self, other): return (self.x, self.y) == (other.x, other.y)

# GOTCHA: if you define __eq__ without __hash__, Python sets __hash__ = None
# making instances unhashable!
```

> **💡 Key Insight:** Dict resizes when load factor exceeds 2/3. The resize doubles the table size. This is an O(n) operation but amortized O(1) per insertion. The resize also re-hashes all entries (because `slot = hash % new_size` changes).

> 🌍 **Real-World:** Python's `dict` insertion-order guarantee (Python 3.7+) is used by Django's ORM `QuerySet.values()` — the returned row dicts preserve column order matching the SQL `SELECT` clause, making it safe to rely on order when constructing CSV exports or mapping to APIs. Before 3.7, Django had to use `OrderedDict` explicitly for this guarantee.

**dict vs defaultdict vs Counter:**

```python
from collections import defaultdict, Counter

# defaultdict: never KeyError, auto-creates missing keys
word_count = defaultdict(int)
for word in words:
    word_count[word] += 1  # no KeyError if word not in dict

# Counter: specialized for counting, extra methods
c = Counter(['a', 'b', 'a', 'c', 'a'])
c.most_common(2)   # [('a', 3), ('b', 1)]
c['a'] + c['z']   # 3 + 0 = 3 (missing keys return 0)

# dict merge operators (Python 3.9+)
d1 = {'a': 1}
d2 = {'b': 2}
merged = d1 | d2        # {'a': 1, 'b': 2}
d1 |= d2                # in-place
```

---

### 2.3 Set (Hash Set)

`set` is essentially a dict with only keys (no values). Shares the same hash table implementation.

```python
s = {1, 2, 3}
s.add(4)          # O(1) average
s.remove(4)       # O(1) average, KeyError if missing
s.discard(4)      # O(1) average, no error if missing
4 in s            # O(1) average ← key advantage over list

# Set operations — all O(len(s) + len(t)) except subset checks
a = {1, 2, 3}
b = {2, 3, 4}
a | b             # union: {1, 2, 3, 4}
a & b             # intersection: {2, 3}
a - b             # difference: {1}
a ^ b             # symmetric difference: {1, 4}
a <= b            # subset check: False
a.isdisjoint(b)   # True if no common elements: False
```

**frozenset** — immutable, hashable, can be dict key or set element:

```python
fs = frozenset([1, 2, 3])
d = {fs: "frozen"}   # OK
s = {frozenset([1,2]), frozenset([3,4])}  # set of sets
```

---

### 2.4 Tuple (Immutable Sequence)

Tuples are like lists but immutable. CPython can optimize tuple literals.

```text
tuple internals:
┌──────────────────────┐
│  PyTupleObject       │
│  ob_refcnt           │
│  *ob_type            │
│  ob_size: 3          │
│  ob_item[0]: *a      │  ← fixed-size inline array
│  ob_item[1]: *b      │
│  ob_item[2]: *c      │
└──────────────────────┘
```

```python
# Tuple packing/unpacking
t = 1, 2, 3         # packing (parentheses optional)
a, b, c = t         # unpacking
first, *rest = t    # extended unpacking: first=1, rest=[2,3]
a, b = b, a         # swap via tuple — creates tuple on right, unpacks to left

# Named tuples — self-documenting tuples
from collections import namedtuple
Point = namedtuple('Point', ['x', 'y'])
p = Point(1, 2)
p.x, p.y    # 1, 2
p[0], p[1]  # 1, 2 — still a tuple

# typing.NamedTuple — class-based, with type hints
from typing import NamedTuple
class Point(NamedTuple):
    x: float
    y: float
    label: str = ""  # default value
```

> **💡 Key Insight:** Tuples with only immutable elements are hashable. CPython caches empty tuples and single-element tuples as singletons. `()` is always the same object. Small tuples created by constants in code are interned. This makes tuples much cheaper than lists in tight loops.

> 🌍 **Real-World:** Redis-py (the Python client for Redis) uses tuples as dict keys for pipeline command caching — `(command_name, *args)` tuples are hashable and can be stored in a `dict` to deduplicate or batch commands. Tuples' immutability guarantees no accidental mutation of cached keys, a critical property in multi-threaded request pipelines.

---

### 2.5 deque, heapq, OrderedDict

**collections.deque — O(1) both ends:**

```python
from collections import deque
d = deque(maxlen=3)   # bounded deque — auto-evicts from opposite end
d.append(1)
d.append(2)
d.append(3)
d.append(4)    # evicts 1 → deque([2, 3, 4])
# Great for sliding window, BFS, LRU cache

# deque is a doubly-linked list of fixed-size blocks
# Indexing d[i] is O(n) — walk the blocks. Use list for random access.
```

**heapq — min-heap on a list:**

```python
import heapq

h = []
heapq.heappush(h, 5)
heapq.heappush(h, 1)
heapq.heappush(h, 3)
heapq.heappop(h)    # returns 1 — minimum
heapq.heappushpop(h, 0)  # push then pop — more efficient than two ops

# Max-heap trick: negate values
heapq.heappush(h, -5)

# heapify: O(n) — convert list to heap in-place
lst = [3, 1, 4, 1, 5]
heapq.heapify(lst)   # O(n) — note: NOT sort

# nlargest / nsmallest: efficient for small k
heapq.nlargest(3, lst)   # O(n log k)
heapq.nsmallest(3, lst)  # O(n log k)
```

**heapq complexity:**
```text
heappush:    O(log n)
heappop:     O(log n)
heapify:     O(n)       ← key difference from inserting one by one O(n log n)
nlargest(k): O(n log k)
```

> 🌍 **Real-World:** Apache Airflow's task scheduler uses a min-heap (via Python's `heapq`) to maintain the priority queue of tasks ready for execution — tasks with the earliest scheduled start time are popped first in O(log n). The `heapify` O(n) initialization is used at scheduler startup to restore the heap from the persisted task database without the O(n log n) cost of individual inserts.

> 🌍 **Real-World:** Python's `collections.deque` is the backing data structure for BFS in graph traversal libraries like NetworkX. When Google's internal Python tooling traverses dependency graphs for build systems, `deque.popleft()` in O(1) versus `list.pop(0)` in O(n) makes a measurable difference at graph sizes of millions of nodes.

---

## 3. Python OOP

### 3.1 Method Resolution Order (MRO)

Python uses **C3 Linearization** (C3 superclass linearization) to determine method lookup order in multiple inheritance.

```python
class A:
    def method(self): print("A")

class B(A):
    def method(self): print("B")

class C(A):
    def method(self): print("C")

class D(B, C):
    pass

D.method(D())   # prints "B"
print(D.__mro__)
# (<class 'D'>, <class 'B'>, <class 'C'>, <class 'A'>, <class 'object'>)
```

**C3 Linearization Algorithm:**

```text
MRO(D) = D + merge(MRO(B), MRO(C), [B, C])
MRO(B) = [B, A, object]
MRO(C) = [C, A, object]

merge([B, A, object], [C, A, object], [B, C]):
  Take head of first list = B.
  B is not in tail of any other list → take B.
  Result so far: [D, B]
  
  merge([A, object], [C, A, object], [C]):
  Take head = A.
  A IS in tail of [C, A, object] → skip.
  Try next list: head = C.
  C is not in tail of any other list → take C.
  Result so far: [D, B, C]
  
  merge([A, object], [A, object], []):
  Take A → then object
  
Final MRO: [D, B, C, A, object]
```

```python
# Diamond problem — classic test
class O: pass
class X(O): pass
class Y(O): pass
class Z(X, Y): pass

Z.__mro__
# (Z, X, Y, O, object)
# O appears once, after all subclasses

# super() follows MRO — NOT just parent class
class Base:
    def greet(self): print("Base")

class Left(Base):
    def greet(self):
        print("Left")
        super().greet()   # calls next in MRO, not necessarily Base directly

class Right(Base):
    def greet(self):
        print("Right")
        super().greet()

class Child(Left, Right):
    def greet(self):
        super().greet()

Child().greet()
# Prints: Left, Right, Base — cooperative multiple inheritance via super()
# MRO: Child → Left → Right → Base
```

> **💡 Key Insight:** `super()` is NOT `parent_class`. It returns a proxy that delegates to the **next class in the MRO** of the instance's actual type. This enables cooperative multiple inheritance — every class calls `super()` and the entire chain executes exactly once.

> 🌍 **Real-World:** Django's class-based views (CBV) rely entirely on MRO and cooperative `super()` calls. `LoginRequiredMixin` and `PermissionRequiredMixin` each call `super().dispatch()` — when combined as `class MyView(LoginRequiredMixin, PermissionRequiredMixin, View)`, C3 MRO ensures authentication runs before permission checks, in declaration order, without any mixin knowing about the others.

---

### 3.2 Dunder Methods

Dunder (double underscore) methods are the Python data model — they let your objects integrate with Python syntax.

```python
class Vector:
    def __init__(self, x, y):
        self.x, self.y = x, y

    # Representation
    def __repr__(self):     # for developers: eval(repr(v)) should recreate object ideally
        return f"Vector({self.x}, {self.y})"

    def __str__(self):      # for users: str(v), print(v)
        return f"({self.x}, {self.y})"

    # Arithmetic operators
    def __add__(self, other):
        return Vector(self.x + other.x, self.y + other.y)

    def __radd__(self, other):   # called when left operand doesn't support +
        return self.__add__(other)

    def __iadd__(self, other):   # in-place +=
        self.x += other.x
        self.y += other.y
        return self

    def __mul__(self, scalar):   # v * 3
        return Vector(self.x * scalar, self.y * scalar)

    def __rmul__(self, scalar):  # 3 * v
        return self.__mul__(scalar)

    def __neg__(self):           # -v
        return Vector(-self.x, -self.y)

    # Comparison
    def __eq__(self, other):
        return (self.x, self.y) == (other.x, other.y)

    def __lt__(self, other):     # enables sorting
        return (self.x**2 + self.y**2) < (other.x**2 + other.y**2)

    def __hash__(self):          # required if __eq__ defined, for use in sets/dicts
        return hash((self.x, self.y))

    # Container protocol
    def __len__(self):           # len(v)
        return 2

    def __getitem__(self, idx):  # v[0], v[1]
        return (self.x, self.y)[idx]

    def __iter__(self):          # for component in v
        yield self.x
        yield self.y

    def __contains__(self, val): # val in v
        return val in (self.x, self.y)

    # Callable
    def __call__(self, *args):   # v(args) — makes instance callable
        return self.x * args[0] + self.y * args[1]

    # Context manager
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return False  # don't suppress exceptions

    # Attribute access
    def __getattr__(self, name):     # called when normal lookup fails
        raise AttributeError(f"No attribute {name}")

    def __setattr__(self, name, val):  # called on every attribute set
        super().__setattr__(name, val)

    # Memory
    def __sizeof__(self):
        return object.__sizeof__(self) + self.x.__sizeof__() + self.y.__sizeof__()
```

> 🌍 **Real-World:** SQLAlchemy's ORM uses `__eq__`, `__ne__`, `__lt__`, `__gt__` on Column objects to produce SQL expressions rather than Python booleans — `User.age > 18` returns a `BinaryExpression` object, not `True/False`. This is the same dunder override trick that lets NumPy's `arr > 0` return an array of booleans instead of a single Python bool.

**Key dunder methods for interviews:**

```text
Category         Dunder               Triggered by
──────────────────────────────────────────────────────────────
Creation         __new__              object creation (before __init__)
Init             __init__             object initialization
Deletion         __del__              object garbage collected
Repr             __repr__             repr(obj)
Str              __str__              str(obj), print(obj)
Hash             __hash__             hash(obj), dict keys, set members
Equality         __eq__               obj == other
Ordering         __lt__,__gt__,...    comparisons, sorting
Arithmetic       __add__,__mul__,...  +, *, -, /, //
Container        __len__,__getitem__  len(), [], iteration
Iterator         __iter__,__next__    for loops, iter()
Context Mgr      __enter__,__exit__   with statement
Attribute        __getattr__          obj.nonexistent
Descriptor       __get__,__set__      attribute access on descriptors
```

**`__new__` vs `__init__`:**

```python
class Singleton:
    _instance = None

    def __new__(cls, *args, **kwargs):
        # __new__ creates the object; called before __init__
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, value):
        self.value = value  # called every time, even for existing instance!

a = Singleton(1)
b = Singleton(2)
assert a is b        # True — same object
assert a.value == 2  # __init__ ran again on existing object
```

---

### 3.3 Descriptors

A descriptor is any object that defines `__get__`, `__set__`, or `__delete__`. They implement the mechanism behind `property`, `classmethod`, `staticmethod`, and `__slots__`.

```text
Attribute Lookup Order (for instance.attr):
1. Data descriptors from type (define __set__ or __delete__)
2. Instance __dict__
3. Non-data descriptors from type (only __get__) and other class attrs
```

```python
class Validator:
    """Data descriptor — validates values on set."""
    def __set_name__(self, owner, name):
        self.name = name
        self.storage_name = '_' + name

    def __get__(self, obj, objtype=None):
        if obj is None:
            return self   # accessed on class, return descriptor itself
        return getattr(obj, self.storage_name, None)

    def __set__(self, obj, value):
        if not isinstance(value, (int, float)):
            raise TypeError(f"{self.name} must be numeric")
        if value < 0:
            raise ValueError(f"{self.name} must be non-negative")
        setattr(obj, self.storage_name, value)

class Circle:
    radius = Validator()   # descriptor instance stored on class

    def __init__(self, radius):
        self.radius = radius   # triggers Validator.__set__

c = Circle(5)
c.radius = -1   # raises ValueError
```

**`property` is a built-in descriptor:**

```python
class Temperature:
    def __init__(self, celsius):
        self._celsius = celsius

    @property
    def fahrenheit(self):
        return self._celsius * 9/5 + 32

    @fahrenheit.setter
    def fahrenheit(self, value):
        self._celsius = (value - 32) * 5/9

    @fahrenheit.deleter
    def fahrenheit(self):
        del self._celsius

t = Temperature(100)
t.fahrenheit        # 212.0 — triggers __get__
t.fahrenheit = 32   # triggers __set__, sets _celsius = 0
```

> **💡 Key Insight:** `property` is implemented as a data descriptor in C. When you access `obj.attr` and `attr` is a data descriptor on the class, the descriptor's `__get__` is called instead of returning from `obj.__dict__`. This is why property getters intercept attribute access even when the instance `__dict__` has a same-named key.

> 🌍 **Real-World:** Django's `Model` fields (e.g., `CharField`, `IntegerField`) are implemented as descriptors — `User.name` on the class returns the field descriptor itself (for query building), while `user_instance.name` calls `__get__` with the instance and returns the actual string value from the instance's `__dict__`. This single descriptor protocol powers both ORM query construction and instance attribute access.

---

### 3.4 Metaclasses

A metaclass is the class of a class. `type` is the default metaclass — it creates class objects.

```text
Instance of:
  obj        is instance of    MyClass      (type(obj) is MyClass)
  MyClass    is instance of    type         (type(MyClass) is type)
  type       is instance of    type         (type(type) is type — type is its own metaclass)

  MyClass    is also instance of   object   (metaclass hierarchy separate from class hierarchy)
```

```python
# Creating a class with type() directly:
# type(name, bases, namespace)
MyClass = type('MyClass', (object,), {
    'x': 42,
    'hello': lambda self: f"Hello, x={self.x}"
})
obj = MyClass()
obj.hello()   # "Hello, x=42"

# Custom metaclass — intercepts class creation
class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        # __call__ is invoked when class is called: MyClass(...)
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Database(metaclass=SingletonMeta):
    def __init__(self, url):
        self.url = url

db1 = Database("postgres://...")
db2 = Database("mysql://...")
assert db1 is db2   # same instance

# Metaclass hooks
class TracingMeta(type):
    def __new__(mcs, name, bases, namespace):
        # called when class body is parsed
        print(f"Creating class {name}")
        # Add logging to all methods
        for key, val in namespace.items():
            if callable(val) and not key.startswith('_'):
                namespace[key] = mcs._trace(val)
        return super().__new__(mcs, name, bases, namespace)

    def __init__(cls, name, bases, namespace):
        # called after __new__ — class object exists
        super().__init__(name, bases, namespace)

    def __prepare__(mcs, name, bases):
        # called before class body is executed — returns the namespace dict
        # Return OrderedDict to preserve definition order (useful for ORMs)
        return {}

    @staticmethod
    def _trace(func):
        def wrapper(*args, **kwargs):
            print(f"Calling {func.__name__}")
            return func(*args, **kwargs)
        return wrapper
```

**Real-world metaclass use cases:**

```text
Django ORM:  ModelBase metaclass reads field descriptors, builds SQL schema
SQLAlchemy:  DeclarativeMeta registers models in a mapper registry
Pydantic:    ModelMetaclass validates field annotations, builds validators
ABCMeta:     Tracks abstract methods, prevents instantiation of abstract classes
Enum:        EnumMeta creates enumeration classes
```

> **💡 Key Insight:** Most metaclass use cases are better served by `__init_subclass__` (Python 3.6+) or class decorators. Only use metaclasses when you need to control `__prepare__` (the namespace), or when you need every class in a hierarchy to participate without decoration. Django and SQLAlchemy are justified — they genuinely need to inspect field declarations at class creation time.

> 🌍 **Real-World:** Pydantic v1's `ModelMetaclass` intercepts class creation to inspect all annotated fields, build validators, and generate `__init__`/`__repr__`/`__eq__` — all at import time, not instantiation time. FastAPI leverages this so that `class UserRequest(BaseModel): name: str` generates an OpenAPI schema and request validator with zero extra boilerplate. Pydantic v2 replaced the metaclass with a Rust-backed `__init_subclass__` hook for ~5x faster model creation.

---

### 3.5 Abstract Base Classes

```python
from abc import ABC, abstractmethod, abstractproperty

class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """Subclasses MUST implement this."""
        ...

    @abstractmethod
    def perimeter(self) -> float: ...

    @property
    @abstractmethod
    def name(self) -> str: ...

    def describe(self):   # concrete method — shared implementation
        return f"{self.name}: area={self.area():.2f}"

class Circle(Shape):
    def __init__(self, r): self.r = r
    def area(self): return 3.14159 * self.r ** 2
    def perimeter(self): return 2 * 3.14159 * self.r
    @property
    def name(self): return "Circle"

Shape()     # TypeError: Can't instantiate abstract class
Circle(5)   # OK

# Virtual subclassing — register without inheriting
class MyList:
    def __len__(self): return 0
    def __getitem__(self, i): raise IndexError

from collections.abc import Sequence
Sequence.register(MyList)
isinstance(MyList(), Sequence)   # True — without inheriting Sequence
```

> 🌍 **Real-World:** Python's `collections.abc` module uses `ABCMeta` and virtual subclassing so that `isinstance([], Sequence)` returns `True` even though `list` doesn't inherit from `Sequence` — it just implements the right methods. FastAPI uses `isinstance(response, Response)` checks with ABCs internally to decide whether to serialize a return value or pass it through directly.

---

## 4. Decorators & Context Managers

### 4.1 Decorators Deep Dive

A decorator is a callable that takes a function and returns a (usually modified) function.

```python
# Basic decorator — manual form
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("before")
        result = func(*args, **kwargs)
        print("after")
        return result
    return wrapper

@my_decorator
def greet(name):
    print(f"Hello, {name}")

# Exactly equivalent to:
greet = my_decorator(greet)
```

**Preserving metadata with functools.wraps:**

```python
import functools

def timer(func):
    @functools.wraps(func)   # copies __name__, __doc__, __annotations__, etc.
    def wrapper(*args, **kwargs):
        import time
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

# Without @wraps: greet.__name__ == "wrapper" — breaks debugging, introspection
# With @wraps:    greet.__name__ == "greet"
```

**Decorator with arguments — factory pattern:**

```python
def retry(max_attempts=3, exceptions=(Exception,), delay=0.1):
    """Retry decorator with configurable attempts."""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import time
            last_exc = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt < max_attempts - 1:
                        time.sleep(delay * (2 ** attempt))  # exponential backoff
            raise last_exc
        return wrapper
    return decorator

@retry(max_attempts=3, exceptions=(ConnectionError,), delay=0.5)
def fetch_data(url):
    ...
```

**Stacking decorators:**

```python
@timer
@retry(max_attempts=3)
@cache
def expensive_operation(x):
    ...

# Applied bottom-up, executed top-down:
# expensive_operation = timer(retry(3)(cache(expensive_operation)))
# Call order: timer.wrapper → retry.wrapper → cache.wrapper → original
```

**Decorator with optional arguments:**

```python
def log(func=None, *, level="INFO"):
    """Works as @log and @log(level="DEBUG")"""
    if func is None:
        # Called with arguments: @log(level="DEBUG") → returns decorator
        return functools.partial(log, level=level)
    # Called without arguments: @log → func is the decorated function
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"[{level}] Calling {func.__name__}")
        return func(*args, **kwargs)
    return wrapper

@log              # works
@log(level="DEBUG")  # also works
```

> 🌍 **Real-World:** Apache Airflow uses Python decorators (`@dag`, `@task`) to define entire ETL pipelines — metadata about the DAG (schedule, retries, timeouts) is captured at import time when Python parses the `@dag` decorator, not at execution time. Celery uses `@app.task` similarly: the decorator registers the function in a task registry at module load, so workers can discover tasks by name without importing the call site.

---

### 4.2 Class Decorators

```python
# Class used as decorator
class memoize:
    def __init__(self, func):
        self.func = func
        self.cache = {}
        functools.update_wrapper(self, func)

    def __call__(self, *args):
        if args not in self.cache:
            self.cache[args] = self.func(*args)
        return self.cache[args]

    def clear(self):
        self.cache.clear()

@memoize
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

# Decorator that modifies a class
def add_repr(cls):
    def __repr__(self):
        attrs = ', '.join(f'{k}={v!r}' for k, v in vars(self).items())
        return f'{cls.__name__}({attrs})'
    cls.__repr__ = __repr__
    return cls

@add_repr
class Point:
    def __init__(self, x, y):
        self.x, self.y = x, y

Point(1, 2)   # Point(x=1, y=2)
```

> 🌍 **Real-World:** Python's `@dataclass` decorator (stdlib) is itself a class decorator that inspects `__annotations__` at class definition time and injects `__init__`, `__repr__`, and `__eq__` methods. Attrs (used heavily at large companies like Bloomberg) applies the same pattern but with more control over slots, validators, and converters — all injected by a class decorator, keeping the class body clean.

---

### 4.3 Context Managers

Context managers define setup/teardown logic for `with` blocks.

```python
# Class-based context manager
class ManagedFile:
    def __init__(self, path, mode):
        self.path = path
        self.mode = mode
        self.file = None

    def __enter__(self):
        self.file = open(self.path, self.mode)
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.file:
            self.file.close()
        # Return True to suppress the exception
        # Return False/None to re-raise the exception
        if exc_type is FileNotFoundError:
            print(f"File not found: {self.path}")
            return True  # suppress
        return False

with ManagedFile('data.txt', 'r') as f:
    data = f.read()
```

**contextlib.contextmanager — generator-based:**

```python
from contextlib import contextmanager, asynccontextmanager
import time

@contextmanager
def timer(label=""):
    start = time.perf_counter()
    try:
        yield   # code in 'with' block runs here
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.4f}s")

with timer("database query"):
    result = db.execute("SELECT ...")

# Async context manager
@asynccontextmanager
async def db_transaction(conn):
    async with conn.begin() as tx:
        try:
            yield tx
        except Exception:
            await tx.rollback()
            raise
        else:
            await tx.commit()

# contextlib utilities
from contextlib import suppress, nullcontext, ExitStack

with suppress(FileNotFoundError):
    os.remove('temp.txt')   # ignored if file doesn't exist

# ExitStack — dynamic number of context managers
with ExitStack() as stack:
    files = [stack.enter_context(open(f)) for f in file_list]
    # all files closed on exit, even if some open() calls fail
```

> **💡 Key Insight:** `__exit__` receives exception info (`exc_type, exc_val, exc_tb`). If `__exit__` returns a truthy value, the exception is **suppressed**. This is how `suppress()` works — it catches the exception in `__exit__` and returns `True`. Most context managers should return `False` to let exceptions propagate.

> 🌍 **Real-World:** TensorFlow and PyTorch use Python's `__enter__`/`__exit__` context managers for gradient tape scopes (`with tf.GradientTape()` and `with torch.no_grad()`) — ensuring GPU memory for intermediate activations is released even if a training step raises an exception mid-forward-pass. SQLAlchemy's `with session.begin()` uses the same pattern to guarantee transaction rollback on any exception, preventing partial writes to the database.

---

## 5. Generators & Iterators

### 5.1 Iterator Protocol

An **iterable** has `__iter__()`. An **iterator** has both `__iter__()` and `__next__()`.

```text
for x in iterable:
    body

# Desugars to:
_iter = iter(iterable)     # calls iterable.__iter__()
while True:
    try:
        x = next(_iter)    # calls _iter.__next__()
        body
    except StopIteration:
        break
```

```python
class CountDown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):    # makes it iterable (returns itself as iterator)
        return self

    def __next__(self):    # makes it an iterator
        if self.current <= 0:
            raise StopIteration
        self.current -= 1
        return self.current + 1

for n in CountDown(3):
    print(n)   # 3, 2, 1
```

**Iterable vs Iterator distinction matters:**

```python
lst = [1, 2, 3]
it = iter(lst)   # lst is iterable, it is iterator

list(it)    # [1, 2, 3]
list(it)    # []  — iterator is exhausted!
list(lst)   # [1, 2, 3]  — iterable creates fresh iterator each time

# Iterators are one-use; iterables can create multiple iterators
```

> 🌍 **Real-World:** Django's `QuerySet` implements `__iter__` but is NOT a one-shot iterator — it caches results internally and can be iterated multiple times. By contrast, `QuerySet.iterator()` returns a true one-shot iterator that streams rows from the database without caching, used by Instagram and Pinterest when iterating over millions of rows for data migrations to avoid loading the entire result set into RAM.

---

### 5.2 Generators

A generator function returns a generator object — lazy evaluation.

```python
def fibonacci():
    a, b = 0, 1
    while True:
        yield a        # suspends here, returns a
        a, b = b, a + b

gen = fibonacci()
[next(gen) for _ in range(10)]  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
```

**Generator internals:**

```text
Generator object state machine:
                        ┌──────────────────────┐
           next()       │  SUSPENDED           │  next() / send()
  ──────────────────▶   │  (at yield point)    │  ────────────────▶
                        │                      │
         StopIteration  │  Frame object:       │  return / fall off end
  ◀────────────────────  │  - local variables   │  ◀────────────────────
                        │  - current bytecode  │
                        │  - value stack       │
                        └──────────────────────┘
```

```python
# Generator expression — memory efficient
total = sum(x**2 for x in range(10**6))  # no list created!
# vs list comprehension: sum([x**2 for x in range(10**6)])  # 8MB list

# Comparison
import sys
gen_expr = (x**2 for x in range(1000))
lst_comp = [x**2 for x in range(1000)]
sys.getsizeof(gen_expr)   # 112 bytes — just the generator object
sys.getsizeof(lst_comp)   # ~9000 bytes — full list

# yield from — delegate to sub-generator
def chain(*iterables):
    for it in iterables:
        yield from it   # equivalent to: for item in it: yield item

list(chain([1,2], [3,4], [5]))   # [1, 2, 3, 4, 5]

# yield from also pipes send/throw/return through
def accumulate():
    total = 0
    while True:
        value = yield total
        if value is None:
            break
        total += value
```

> 🌍 **Real-World:** Instagram (running Django/Python) uses Python generators for database query pagination — iterating over millions of user records for feed ranking or notifications without loading them all into memory. Scrapy (the web scraping framework used at scale by data teams at Airbnb and others) models its entire request/response pipeline as a chain of generators, yielding `Request` and `Item` objects lazily so memory stays flat regardless of crawl depth.

---

### 5.3 Generator send/throw/close

Generators are coroutines — two-way communication channels.

```python
def running_average():
    total = 0
    count = 0
    avg = None
    while True:
        value = yield avg    # yield sends current avg out, receives new value
        if value is None:
            return avg       # StopIteration with value
        total += value
        count += 1
        avg = total / count

gen = running_average()
next(gen)          # prime the generator — advance to first yield; returns None
gen.send(10)       # sends 10 into yield, returns 10.0
gen.send(20)       # returns 15.0
gen.send(30)       # returns 20.0

# throw — inject exception at yield point
def safe_gen():
    try:
        yield 1
        yield 2
    except ValueError as e:
        print(f"Caught: {e}")
        yield -1

g = safe_gen()
next(g)              # 1
g.throw(ValueError, "bad value")  # prints "Caught: bad value", returns -1

# close — inject GeneratorExit at yield point
def resource_gen():
    print("acquiring resource")
    try:
        yield
    finally:
        print("releasing resource")  # runs on close()

g = resource_gen()
next(g)    # "acquiring resource"
g.close()  # "releasing resource" — GeneratorExit injected at yield
```

> **💡 Key Insight:** The `finally` block in a generator runs when `close()` is called or when the generator is garbage collected. This makes generators safe for resource management. `yield from` properly propagates `close()` and `throw()` to sub-generators.

> 🌍 **Real-World:** Python's `asyncio` event loop was originally built on top of generator `send()`/`throw()` — early coroutines were written with `@asyncio.coroutine` and `yield from` before `async`/`await` syntax existed. The `throw()` mechanism is still used internally today: when you cancel an asyncio `Task`, the event loop calls `coro.throw(CancelledError)` to inject the cancellation at the current `await` suspension point, triggering `finally` cleanup blocks reliably.

---

### 5.4 itertools

```python
import itertools

# Infinite iterators
itertools.count(10, 2)          # 10, 12, 14, 16...
itertools.cycle([1, 2, 3])      # 1, 2, 3, 1, 2, 3...
itertools.repeat(5, times=3)    # 5, 5, 5

# Combinatorics
list(itertools.combinations([1,2,3], 2))      # [(1,2),(1,3),(2,3)] — no repeats
list(itertools.permutations([1,2,3], 2))      # [(1,2),(1,3),(2,1),(2,3),(3,1),(3,2)]
list(itertools.combinations_with_replacement([1,2], 2))  # [(1,1),(1,2),(2,2)]
list(itertools.product([1,2], [3,4]))         # [(1,3),(1,4),(2,3),(2,4)]

# Chaining and slicing
itertools.chain([1,2], [3,4], [5])            # 1,2,3,4,5
itertools.chain.from_iterable([[1,2],[3,4]])  # 1,2,3,4 — flatten one level
itertools.islice(count(), 5)                  # first 5 of infinite sequence
itertools.takewhile(lambda x: x < 5, count()) # take while condition true
itertools.dropwhile(lambda x: x < 5, [1,2,3,5,4,6])  # [5,4,6]

# Grouping
data = [('a', 1), ('a', 2), ('b', 3), ('b', 4)]
for key, group in itertools.groupby(data, key=lambda x: x[0]):
    print(key, list(group))
# GOTCHA: groupby only groups consecutive equal elements — must sort first!

# accumulate — running total/product
list(itertools.accumulate([1,2,3,4,5]))              # [1,3,6,10,15]
list(itertools.accumulate([1,2,3,4,5], lambda a,b: a*b))  # [1,2,6,24,120]

# zip_longest
list(itertools.zip_longest([1,2,3], [4,5], fillvalue=0))  # [(1,4),(2,5),(3,0)]

# pairwise (Python 3.10+)
list(itertools.pairwise([1,2,3,4]))   # [(1,2),(2,3),(3,4)]
```

> 🌍 **Real-World:** Pandas' `groupby` operation mirrors `itertools.groupby` conceptually but operates on sorted DataFrames in memory — data engineering pipelines at companies like Uber and Lyft use `itertools.groupby` directly when streaming sorted records from Kafka or S3 to group GPS pings by driver ID without loading all records into a DataFrame first. `itertools.chain.from_iterable` is commonly used to flatten paginated API responses into a single lazy stream.

---

## 6. Concurrency

### 6.1 Threading

Python threads are OS threads. The GIL prevents parallel CPU execution but allows parallel I/O.

```python
import threading
import queue
import time

# Basic thread
def worker(name, duration):
    print(f"Thread {name} starting")
    time.sleep(duration)   # GIL released during sleep
    print(f"Thread {name} done")

threads = [threading.Thread(target=worker, args=(i, 1)) for i in range(5)]
for t in threads: t.start()
for t in threads: t.join()

# Thread with return value — use queue or list
results = []
lock = threading.Lock()

def fetch_and_store(url, results, lock):
    data = fetch(url)
    with lock:
        results.append(data)

# ThreadPoolExecutor — preferred high-level API
from concurrent.futures import ThreadPoolExecutor, as_completed

def download(url):
    return requests.get(url).text

urls = ["http://example.com/1", "http://example.com/2", ...]

with ThreadPoolExecutor(max_workers=10) as executor:
    # submit() returns Future objects
    futures = {executor.submit(download, url): url for url in urls}

    for future in as_completed(futures):
        url = futures[future]
        try:
            result = future.result()
        except Exception as e:
            print(f"{url} raised {e}")

# map() — simpler, order preserved
with ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(download, urls, timeout=30))
```

**Threading synchronization:**

```python
# Lock — mutual exclusion
lock = threading.Lock()
with lock:
    shared_state += 1

# RLock — reentrant lock (same thread can acquire multiple times)
rlock = threading.RLock()

# Semaphore — limit concurrent access
semaphore = threading.Semaphore(5)  # max 5 concurrent
with semaphore:
    access_database()

# Event — thread signaling
event = threading.Event()

def producer():
    produce_data()
    event.set()   # signal consumers

def consumer():
    event.wait()  # block until set
    consume_data()

# Condition — complex coordination
condition = threading.Condition()

def producer():
    with condition:
        produce_item()
        condition.notify_all()

def consumer():
    with condition:
        condition.wait()   # releases lock and waits for notify
        consume_item()

# Barrier — synchronize N threads at a checkpoint
barrier = threading.Barrier(3)
def phase_one():
    do_work()
    barrier.wait()   # all 3 threads must reach here before any proceeds
    do_phase_two()
```

> **💡 Key Insight:** `threading.local()` creates thread-local storage — each thread has its own copy of the variable. Used by Flask's `g` object, SQLAlchemy's session, and many ORMs to keep per-thread state without locks.

```python
local_data = threading.local()

def worker():
    local_data.conn = db.connect()  # each thread has its own .conn
    process(local_data.conn)
    local_data.conn.close()
```

> 🌍 **Real-World:** Gunicorn's sync workers (used to serve Flask/Django at companies like Pinterest and Twilio) use `threading.local()` to store per-request database connections. Each worker thread gets its own connection object, avoiding the need for a connection pool lock on every query. Flask's `current_app` and `g` proxies are implemented using `werkzeug.local.Local`, which uses `threading.local()` under the hood.

---

### 6.2 Multiprocessing

Bypasses the GIL — true parallelism for CPU-bound work.

```python
from multiprocessing import Process, Pool, Queue, Pipe, Manager
import multiprocessing as mp

# Process — similar to Thread API
def cpu_task(n):
    return sum(i**2 for i in range(n))

p = Process(target=cpu_task, args=(10**7,))
p.start()
p.join()

# Pool — process pool with work distribution
with mp.Pool(processes=mp.cpu_count()) as pool:
    results = pool.map(cpu_task, [10**6, 10**7, 10**8])
    # map: blocking, ordered results
    
    # imap: lazy iterator
    for result in pool.imap(cpu_task, range(10), chunksize=2):
        print(result)
    
    # starmap: multiple args
    results = pool.starmap(pow, [(2, 10), (3, 5), (4, 3)])

# ProcessPoolExecutor — concurrent.futures interface
from concurrent.futures import ProcessPoolExecutor

with ProcessPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(cpu_task, n) for n in range(10)]
    results = [f.result() for f in futures]
```

**Inter-process communication:**

```python
# Queue — process-safe FIFO
q = mp.Queue()

def producer(q):
    for i in range(5):
        q.put(i)
    q.put(None)  # sentinel

def consumer(q):
    while True:
        item = q.get()
        if item is None: break
        process(item)

# Pipe — bidirectional or unidirectional
parent_conn, child_conn = mp.Pipe()

# Manager — shared state across processes (uses a server process)
with mp.Manager() as manager:
    shared_dict = manager.dict()
    shared_list = manager.list()
    # Slower than shared memory — goes through IPC
```

**Shared memory (Python 3.8+):**

```python
from multiprocessing import shared_memory
import numpy as np

# Create shared memory block
shm = shared_memory.SharedMemory(create=True, size=1024)
# Attach array to shared memory
arr = np.ndarray((100,), dtype=np.float64, buffer=shm.buf)
arr[:] = np.random.random(100)

# In another process:
existing_shm = shared_memory.SharedMemory(name=shm.name)
arr2 = np.ndarray((100,), dtype=np.float64, buffer=existing_shm.buf)
# arr and arr2 point to same memory — no serialization!
shm.close()
shm.unlink()  # must explicitly clean up
```

> **💡 Key Insight:** `multiprocessing.Pool.map()` pickles arguments and return values. Large objects (big numpy arrays, large dicts) have significant pickle overhead. Use `shared_memory` or memory-mapped files for large data. Also, `fork` on macOS/Linux creates a copy of the parent process — locks held in the parent are in a bad state in the child. Prefer `spawn` start method for safety.

```python
# Set start method at module level
if __name__ == '__main__':
    mp.set_start_method('spawn')   # safe, slower
    # 'fork': fast, risky with threads/locks
    # 'forkserver': compromise
```

> 🌍 **Real-World:** Google's internal Python ML training pipelines use `multiprocessing` with `spawn` start method and shared memory (`multiprocessing.shared_memory`) to distribute large NumPy arrays across worker processes without pickling cost. Celery (task queue used at Reddit, Instagram, and thousands of others) spawns worker processes using `multiprocessing` with `fork`-safe initialization via `celery.signals.worker_process_init` to re-establish database connections after forking, working around the fork-lock hazard.

---

### 6.3 asyncio — Event Loop Internals

asyncio uses a **single-threaded event loop** with cooperative multitasking via coroutines.

```text
asyncio Event Loop Architecture:

┌─────────────────────────────────────────────────────┐
│                  Event Loop                         │
│                                                     │
│  Ready Queue:  [task1, task2, task3]               │
│                        │                           │
│  I/O Poller:  epoll / kqueue / select              │
│    - Watches file descriptors for readiness        │
│    - When FD ready → wake waiting coroutine        │
│                                                     │
│  Timer Heap:  [(deadline, callback), ...]          │
│    - asyncio.sleep → registers timer callback      │
│                                                     │
│  Run Loop (simplified):                            │
│  1. Run all ready callbacks from ready queue       │
│  2. Poll I/O (with timeout = next timer deadline)  │
│  3. Process I/O callbacks (add to ready queue)     │
│  4. Process expired timers                         │
│  5. Go to 1                                        │
└─────────────────────────────────────────────────────┘
```

**Coroutine mechanics:**

```python
import asyncio

async def fetch(session, url):       # coroutine function
    async with session.get(url) as resp:  # suspends here waiting for I/O
        return await resp.text()          # suspends here waiting for I/O

# async def function returns a coroutine object when called
coro = fetch(session, url)    # NOT executed yet — just creates coroutine object
result = await coro           # schedule and run, suspend caller until done

# await desugars to:
# 1. Call coro.__await__() to get iterator
# 2. Yield iterator values up to event loop
# 3. Resume when event loop sends result back
```

```text
Coroutine execution flow:

main()
  ├── await fetch(url1)   ─── suspends ──▶ [event loop gets control]
  │                                              │
  │                                         I/O poller
  │                                         waits for socket
  │                                              │
  ◀────────────────── resumes ──────── socket ready
  │
  ├── await fetch(url2)   ─── suspends ──▶ [event loop]
  ...
```

> 🌍 **Real-World:** Discord's Python backend used a single `asyncio` event loop to handle millions of concurrent WebSocket connections — each connection is a coroutine suspended at `await websocket.recv()`, consuming only ~2KB of RAM when idle, versus ~1MB for a dedicated OS thread. This is how asyncio enables 100,000+ concurrent connections on a single process where a threading model would exhaust memory.

---

### 6.4 async/await Patterns

```python
import asyncio
import aiohttp

# Basic async/await
async def main():
    async with aiohttp.ClientSession() as session:
        result = await fetch(session, "http://example.com")
    return result

asyncio.run(main())   # Python 3.7+

# Concurrent execution — asyncio.gather
async def main():
    urls = ["http://example.com/1", "http://example.com/2", ...]
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
        # All tasks run concurrently on same thread
        # Error handling:
        results = await asyncio.gather(*tasks, return_exceptions=True)
        # Returns exceptions as values instead of raising

# asyncio.create_task — fire and forget, runs immediately
async def main():
    task1 = asyncio.create_task(coroutine1())
    task2 = asyncio.create_task(coroutine2())
    # tasks are already running (scheduled) even before await
    result1 = await task1
    result2 = await task2

# asyncio.wait — more control than gather
done, pending = await asyncio.wait(
    tasks,
    timeout=5.0,
    return_when=asyncio.FIRST_COMPLETED  # or ALL_COMPLETED, FIRST_EXCEPTION
)
for task in pending:
    task.cancel()

# Semaphore — limit concurrency
async def fetch_limited(semaphore, session, url):
    async with semaphore:
        return await fetch(session, url)

sem = asyncio.Semaphore(10)   # max 10 concurrent requests
tasks = [fetch_limited(sem, session, url) for url in urls]
results = await asyncio.gather(*tasks)

# async generators
async def arange(start, stop, step=1):
    current = start
    while current < stop:
        yield current
        await asyncio.sleep(0)   # yield control
        current += step

async for i in arange(0, 10):
    print(i)

# async context manager without class
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    # startup
    db = await connect_db()
    app.state.db = db
    yield
    # shutdown
    await db.close()
```

**Running sync code in async context:**

```python
import asyncio

async def main():
    loop = asyncio.get_event_loop()

    # Run blocking I/O in thread pool — doesn't block event loop
    result = await loop.run_in_executor(None, blocking_io_func, arg)

    # Run CPU-bound in process pool
    with ProcessPoolExecutor() as pool:
        result = await loop.run_in_executor(pool, cpu_bound_func, arg)

    # asyncio.to_thread (Python 3.9+) — cleaner
    result = await asyncio.to_thread(blocking_func, arg)
```

> **💡 Key Insight:** `await` does NOT make code parallel — it makes it concurrent. All coroutines run on **one thread**. "Concurrent" means tasks interleave at suspension points (`await`). If you block the event loop (no `await`, sleep with `time.sleep`), ALL other coroutines freeze. Never call blocking functions without `run_in_executor`.

> 🌍 **Real-World:** Uber's Python microservices use `asyncio.gather()` to fan out simultaneous calls to multiple downstream services (pricing, surge, driver location) and collect results — turning 3 sequential 50ms API calls (150ms total) into 3 concurrent calls (~50ms total). Stripe's API server uses `asyncio.wait(tasks, timeout=...)` with `FIRST_COMPLETED` to implement race-to-first-success patterns across redundant payment processor endpoints.

---

### 6.5 Choosing the Right Tool

```text
Task Type          Best Tool              Why
────────────────────────────────────────────────────────────────────
I/O bound,         asyncio                Single thread, no GIL overhead,
many connections   (async/await)          can handle 10k+ connections

I/O bound,         threading              Simpler, GIL released during I/O
few connections    (ThreadPoolExecutor)   Compatible with sync libraries

CPU bound          multiprocessing        Bypasses GIL, true parallelism
                   (ProcessPoolExecutor)

CPU bound,         Cython/C ext,          GIL released in C extensions
needs Python GIL   numba, numpy           numpy releases GIL for array ops

Mixed I/O+CPU      asyncio + run_in_       Event loop for I/O,
                   executor(ProcessPool)   processes for CPU work
```

> 🌍 **Real-World:** Netflix's Python-based chaos engineering tooling (Chaos Monkey Python port) uses `ThreadPoolExecutor` for I/O-bound AWS API calls (terminating instances, checking health) and `ProcessPoolExecutor` for CPU-bound log analysis — exactly matching the "few I/O connections → threads, CPU-bound → processes" heuristic. Their runbooks note that trying to use threads for CPU-intensive analysis caused GIL contention and 3x slowdowns versus the process pool approach.

---

## 7. Python Memory Management

### 7.1 CPython Memory Allocator

CPython uses a layered allocator:

```text
Memory Allocation Layers:

Layer 3:  Object-specific allocators
          PyLong_New(), PyList_New(), etc.
          Uses free lists for common small objects (ints, floats, dicts, lists)

Layer 2:  pymalloc (Python's small object allocator)
          Handles allocations ≤ 512 bytes
          ┌──────────────────────────────────────┐
          │  Arena (256KB from OS)              │
          │  ┌──────────┬──────────┬──────────┐ │
          │  │  Pool    │  Pool    │  Pool    │ │
          │  │ (4KB ea) │ (4KB ea) │ (4KB ea) │ │
          │  │ [8-byte] │[16-byte] │[24-byte] │ │  ← size class blocks
          │  │  blocks  │  blocks  │  blocks  │ │
          │  └──────────┴──────────┴──────────┘ │
          └──────────────────────────────────────┘

Layer 1:  C malloc (libc) — for large objects > 512 bytes

Layer 0:  OS VirtualAlloc / mmap
```

**Free lists** — CPython recycles common objects:

```python
# Small integers [-5, 256] are cached permanently
a = 256
b = 256
a is b    # True — same object from cache

a = 257
b = 257
a is b    # False — new objects (in CPython, may be True in same code block)

# None, True, False are singletons
None is None   # always True
True is True   # always True

# float free list — last ~255 freed floats are reused
# list free list — last ~80 freed empty lists are reused
# dict free list — last ~80 freed empty dicts are reused
```

> 🌍 **Real-World:** CPython's pymalloc small-object allocator (handling allocations ≤ 512 bytes) is critical to Django's performance — every request creates hundreds of small objects (QuerySet wrappers, form fields, middleware context dicts) that all fall in the pymalloc fast path. When Disqus scaled Django to serve 8 billion page views per month, profiling showed pymalloc arena management was a bottleneck for short-lived request objects; they tuned GC thresholds and used `__slots__` on hot model classes to reduce allocation pressure.

---

### 7.2 Cyclic Garbage Collector

Handles reference cycles that reference counting can't free.

```text
Cyclic GC — Tri-color Mark & Sweep on "container" objects only:

Generation 0 (youngest):  new objects → collected frequently (~every 700 allocations)
Generation 1 (middle):    survived gen 0 → collected less often
Generation 2 (oldest):    long-lived objects → collected rarely

Threshold defaults: (700, 10, 10)
  gen 0: collect when (allocs - deallocs) > 700
  gen 1: collect when gen 0 collected > 10 times
  gen 2: collect when gen 1 collected > 10 times
```

```python
import gc

# Manual control
gc.collect()         # force collection of all generations
gc.collect(0)        # collect generation 0 only
gc.get_threshold()   # (700, 10, 10) defaults
gc.set_threshold(1000, 15, 15)  # tune for workload
gc.disable()         # disable cyclic GC (reference counting still works)

# Debugging
gc.set_debug(gc.DEBUG_LEAK)
gc.collect()
# gc.garbage — list of uncollectable objects (objects with __del__ in cycles)

# Find what's keeping objects alive
gc.get_referrers(obj)   # what holds references to obj
gc.get_referents(obj)   # what obj holds references to

# Context: objects with __del__ in reference cycles
# Python 3.4+: PEP 442 — __del__ objects in cycles CAN be collected
# Before 3.4: they went to gc.garbage and were never freed
```

> 🌍 **Real-World:** Instagram's engineering team disabled CPython's cyclic garbage collector (`gc.disable()`) in their Django workers after profiling revealed that GC pauses were causing request latency spikes — they determined their code had no reference cycles (all objects freed deterministically by reference counting), so the GC was pure overhead. They published this finding in 2017, noting a ~10% throughput improvement. This is a known production technique: verify no cycles exist, then disable GC for latency-sensitive services.

---

### 7.3 Memory Leaks in Python

Common memory leak patterns:

```python
# 1. Growing cache without eviction
_cache = {}
def get_data(key):
    if key not in _cache:
        _cache[key] = fetch_from_db(key)  # never evicted → grows forever
    return _cache[key]
# Fix: use functools.lru_cache or a maxsize dict (OrderedDict with trimming)

# 2. Unclosed file/socket/DB connections
f = open('file.txt')
data = f.read()
# forgot f.close() → file descriptor leak
# Fix: use with statement

# 3. Event listeners / callbacks never unregistered
class EventEmitter:
    def __init__(self):
        self.listeners = []
    def on(self, callback):
        self.listeners.append(callback)  # strong reference to callback

emitter = EventEmitter()
def handler():
    pass
emitter.on(handler)
# Even if 'handler' variable deleted, emitter.listeners holds reference
# Fix: use weakref.WeakSet or weakref.ref for listeners

import weakref
class EventEmitter:
    def __init__(self):
        self.listeners = weakref.WeakSet()

# 4. ThreadLocal / ContextVar not cleaned up
# 5. Closures capturing large objects
def make_handler(large_data):
    def handler(request):
        # large_data captured in closure — stays alive as long as handler
        return process(request, large_data)
    return handler

# 6. Circular references with __del__  (pre-3.4)
class Node:
    def __del__(self):
        print("deleted")

a = Node()
b = Node()
a.ref = b
b.ref = a
del a, b   # cyclic GC handles this in 3.4+, but __del__ delays collection
```

> 🌍 **Real-World:** Pinterest's Python backend hit a memory leak caused by a global `_cache` dict storing user recommendation objects that referenced back to the cache (pattern #1 + #3 combined). The fix was replacing the plain dict with `functools.lru_cache(maxsize=10000)` — capped size with LRU eviction. Twisted (the async networking framework) historically suffered from callback/errback reference cycles keeping large request objects alive; they introduced `weakref`-based listener registries to break the cycles.

---

### 7.4 tracemalloc & objgraph

```python
import tracemalloc

tracemalloc.start()

# ... run your code ...

snapshot = tracemalloc.take_snapshot()
top_stats = snapshot.statistics('lineno')
for stat in top_stats[:10]:
    print(stat)

# Compare two snapshots to find leaks
snapshot1 = tracemalloc.take_snapshot()
# ... run more code ...
snapshot2 = tracemalloc.take_snapshot()
top_stats = snapshot2.compare_to(snapshot1, 'lineno')

# objgraph — visualize object graph
import objgraph
objgraph.show_most_common_types(limit=10)
objgraph.show_growth()   # what grew since last call

# Find what's keeping an object alive
chain = objgraph.find_backref_chain(my_obj, objgraph.is_proper_module)
objgraph.show_backrefs(my_obj, max_depth=3)  # graphviz visualization
```

> 🌍 **Real-World:** Dropbox used `tracemalloc` and `objgraph` to diagnose a memory growth bug in their Python sync daemon — `objgraph.show_growth()` revealed that `Frame` objects were accumulating, eventually tracing the leak to a logging handler that held references to exception tracebacks (which contain frames). The fix was calling `traceback.clear_frames(tb)` when logging exceptions. This is now a recommended pattern for long-running Python daemons.

---

## 8. Python Internals

### 8.1 Bytecode & dis module

```python
import dis

def example(x, y):
    if x > y:
        return x - y
    return y - x

dis.dis(example)
```

```text
Output:
  2           0 LOAD_FAST                0 (x)
              2 LOAD_FAST                1 (y)
              4 COMPARE_OP               4 (>)
              6 POP_JUMP_IF_FALSE       12

  3           8 LOAD_FAST                0 (x)
             10 LOAD_FAST                1 (y)
             12 BINARY_SUBTRACT
             14 RETURN_VALUE

  4     >>   16 LOAD_FAST                1 (y)
             18 LOAD_FAST                0 (x)
             20 BINARY_SUBTRACT
             22 RETURN_VALUE
```

```python
# Code objects carry bytecode + metadata
code = example.__code__
code.co_code        # raw bytecode bytes
code.co_consts      # constants (None, numbers, strings)
code.co_varnames    # local variable names
code.co_filename    # source file
code.co_firstlineno # line number
code.co_flags       # flags (coroutine? generator?)
code.co_stacksize   # max value stack depth needed

# Inspect function attributes
example.__defaults__      # default argument values
example.__annotations__   # type hints
example.__globals__       # the module's global namespace dict
example.__closure__       # closure cells (for nested functions)
```

**CPython's eval loop:**

```text
Python/ceval.c — _PyEval_EvalFrameDefault():
  Infinite loop:
    opcode = *next_instr++
    switch (opcode):
      case LOAD_FAST:
          push(fastlocals[oparg])
      case BINARY_ADD:
          right = pop()
          left  = pop()
          result = left + right   // calls left.__add__(right)
          push(result)
      case CALL_FUNCTION:
          ...
      ... 150+ opcodes
```

> 🌍 **Real-World:** Python 3.11's `dis` module reveals new `RESUME`, `PUSH_NULL`, and `PRECALL` opcodes introduced for the CPython 3.11 specializing adaptive interpreter — hot bytecodes are rewritten in-place to specialized fast versions (e.g., `LOAD_ATTR` becomes `LOAD_ATTR_INSTANCE_VALUE` after a few executions). This adaptive specialization is how CPython 3.11 achieved a ~25% performance improvement over 3.10 without changing Python semantics. Tools like `py-spy` at Cloudflare read live bytecode offsets from process memory to produce profiler flame graphs without instrumenting code.

---

### 8.2 Frame Objects

Each function call creates a **frame object** holding execution state.

```python
import sys

def inner():
    frame = sys._getframe()         # current frame
    print(frame.f_code.co_name)    # "inner"
    print(frame.f_locals)          # local variables dict
    caller = frame.f_back          # caller's frame
    print(caller.f_code.co_name)   # "outer"
    print(caller.f_lineno)         # line number in caller

def outer():
    x = 42
    inner()

outer()
```

```text
Call Stack as Frame Chain:

outer() frame:
  f_code → outer's code object
  f_locals: {'x': 42}
  f_back → module frame

inner() frame:
  f_code → inner's code object
  f_locals: {'frame': <frame>}
  f_back → outer() frame
  f_lasti: last bytecode index
  f_lineno: current line
```

**Tracing — how debuggers and coverage tools work:**

```python
import sys

def trace_calls(frame, event, arg):
    if event == 'call':
        print(f"Calling {frame.f_code.co_name}")
    elif event == 'return':
        print(f"Returning from {frame.f_code.co_name}: {arg}")
    return trace_calls   # return self to continue tracing

sys.settrace(trace_calls)
some_function()
sys.settrace(None)   # disable
```

> 🌍 **Real-World:** Coverage.py (used in CI/CD pipelines at Google, Facebook, and virtually every Python project) uses `sys.settrace()` to intercept every line execution and record which lines were reached. PyCharm's debugger and `pdb` use `sys.settrace()` to implement breakpoints — when a line matches a breakpoint, the trace function pauses execution and hands control to the debugger. The overhead of `sys.settrace()` is why coverage runs are ~2-5x slower than normal execution.

---

### 8.3 __slots__

`__slots__` replaces the per-instance `__dict__` with fixed-size C-level attribute storage.

```python
class Point:
    __slots__ = ('x', 'y')   # only these attributes allowed

    def __init__(self, x, y):
        self.x, self.y = x, y

# Benefits:
p = Point(1, 2)
import sys
sys.getsizeof(p)    # ~56 bytes

class PointDict:
    def __init__(self, x, y): self.x, self.y = x, y

pd = PointDict(1, 2)
sys.getsizeof(pd)   # ~48 bytes for object, PLUS __dict__ = ~232 bytes total

# slots: no __dict__ → no dynamic attribute creation
p.z = 3   # AttributeError: 'Point' object has no attribute 'z'

# slots in inheritance — tricky
class Base:
    __slots__ = ('x',)

class Child(Base):
    __slots__ = ('y',)   # MUST redeclare __slots__ in each class
    # If Child forgets __slots__, it gets __dict__ anyway
    # Both 'x' slot and __dict__ exist — slots savings lost
```

**When to use `__slots__`:**
- Creating millions of small objects (sensor data, graph nodes, time series)
- Objects with known, fixed attributes
- Micro-optimization — reduces memory by ~30-40% per instance

> **💡 Key Insight:** `__slots__` also speeds up attribute access — slots are direct offsets into the object's memory layout, not dict lookups. But they prevent `weakref` by default (add `'__weakref__'` to slots if needed) and complicate `pickle`/`copy`. Use only when profiling shows memory is the bottleneck.

> 🌍 **Real-World:** PyPy and MicroPython use `__slots__`-equivalent compact object layouts by default for all user-defined classes. In CPython, Pydantic v2 uses `__slots__ = True` on `dataclass`-style models by default — when serving millions of request models per day at companies running FastAPI (like Robinhood, Lyft), the ~40% per-instance memory reduction from slots translates to meaningfully lower RSS and fewer GC cycles under load.

---

### 8.4 String Interning

CPython interns (caches) some strings to avoid redundant allocations.

```python
# Automatically interned:
# - Compile-time string constants that look like identifiers (alphanumeric, _)
a = "hello"
b = "hello"
a is b    # True — interned at compile time

a = "hello world"   # has space
b = "hello world"
a is b    # False in general (implementation-dependent)

# Explicit interning
import sys
a = sys.intern("my long string!")
b = sys.intern("my long string!")
a is b    # True

# Use case: dict keys that are repeated strings
# interned keys reduce dict lookup to pointer comparison (vs full string comparison)
```

> 🌍 **Real-World:** Django's ORM uses string interning for field names — every `User.objects.filter(username=...)` call references the string `"username"` which CPython automatically interns as an identifier-like string. This means thousands of ORM calls per second reuse the same string object for dict lookups rather than allocating new ones. CPython's attribute access (`obj.attr_name`) also relies on interning — `LOAD_ATTR` bytecode does a pointer comparison against the interned attribute name rather than a full string hash + compare.

---

### 8.5 Small Integer Cache

CPython pre-allocates integer objects for values in `[-5, 256]`.

```python
a = 100; b = 100; a is b    # True — cached
a = 257; b = 257; a is b    # False — new objects

# BUT: in same code block, CPython may optimize
# (same literal in same code block may be same object)
# Don't rely on this — use == not is for value comparison

# None, True, False are singletons
None is None   # always True
not not 1 is True   # True

# GOTCHA in interviews:
x = 1000
y = 1000
x is y   # possibly False! Use == for value comparison always
```

> 🌍 **Real-World:** The small integer cache [-5, 256] is why CPython's `True == 1` and `True is 1` are both `True` — `True` is literally the integer object `1` in CPython (`PyBool_Type` inherits from `PyLong_Type`). This trips up interview candidates writing `if response_code is 200` — it works in testing (200 is in cache range) but would silently fail for codes like `404` or `500` in some Python implementations, since those are outside the cache range.

---

## 9. FastAPI & Django Internals

### 9.1 FastAPI Request Lifecycle

FastAPI is built on **Starlette** (ASGI framework) and **Pydantic** for validation.

```text
FastAPI Request Lifecycle:

HTTP Request (bytes)
       │
       ▼
   uvicorn / hypercorn (ASGI server)
   - Parses HTTP/1.1 or HTTP/2
   - Creates ASGI scope dict
       │
       ▼
   Starlette ASGI app
   - Middleware stack (outermost to innermost)
       │
       ▼
   FastAPI Router
   - URL matching (Starlette Router)
       │
       ▼
   Dependency Injection (FastAPI DI)
   - Resolves all Depends() recursively
   - Runs generator dependencies (yield for cleanup)
       │
       ▼
   Request body parsing
   - Pydantic model validation
   - JSON parsing
       │
       ▼
   Path operation function (your handler)
       │
       ▼
   Response serialization
   - Pydantic .dict() + jsonable_encoder
   - JSONResponse(content=...) 
       │
       ▼
   Middleware stack (response path)
       │
       ▼
   HTTP Response (bytes) → client
```

```python
from fastapi import FastAPI, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Annotated

app = FastAPI()

# Dependency injection
async def get_db():
    db = SessionLocal()
    try:
        yield db          # generator dependency — cleanup runs after response
    finally:
        db.close()

# Type annotations drive OpenAPI schema generation
class Item(BaseModel):
    name: str
    price: float
    in_stock: bool = True

@app.post("/items/{item_id}")
async def create_item(
    item_id: int,                    # path parameter — auto-validated as int
    item: Item,                      # request body — Pydantic validation
    q: str | None = None,            # optional query param
    db = Depends(get_db),            # dependency injection
    current_user = Depends(get_current_user),
):
    return item

# Middleware — ASGI middleware
@app.middleware("http")
async def add_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = str(elapsed)
    return response

# Lifespan events (replaces @app.on_event)
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    await connect_db()
    yield
    # shutdown
    await disconnect_db()

app = FastAPI(lifespan=lifespan)
```

**Background tasks:**

```python
from fastapi import BackgroundTasks

def send_email(email: str, message: str):
    # Runs after response sent
    smtp.send(email, message)

@app.post("/notify")
async def notify(background_tasks: BackgroundTasks, email: str):
    background_tasks.add_task(send_email, email, "Hello!")
    return {"status": "queued"}
```

> 🌍 **Real-World:** Microsoft uses FastAPI internally for several Azure ML serving endpoints — Pydantic's request validation in the FastAPI lifecycle catches malformed tensor shapes and wrong dtypes at the HTTP boundary before they reach model inference code, giving clear 422 validation errors instead of cryptic numpy shape mismatches deep in the stack. Uber's internal Python API gateway uses FastAPI's dependency injection (`Depends()`) to implement a centralized auth layer — every endpoint gets `current_user` injected without repeating auth logic.

---

### 9.2 Django Request Lifecycle

```text
Django Request Lifecycle:

Browser → HTTP Request
       │
       ▼
   WSGI/ASGI server (gunicorn/uvicorn)
       │
       ▼
   Django WSGI application (WSGIHandler)
       │
       ▼
   Request Middleware (process_request)
   [SecurityMiddleware, SessionMiddleware, ...]
       │
       ▼
   URL Router (urls.py)
   - URLconf resolves path to view function
       │
       ▼
   View Middleware (process_view)
       │
       ▼
   View function / Class-based View
   - DRF ViewSet / APIView if using DRF
       │
       ▼
   Template rendering (if applicable)
       │
       ▼
   Response Middleware (process_response)  ← reverse order
       │
       ▼
   HTTP Response → Browser
```

```python
# settings.py MIDDLEWARE order is critical
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',      # first
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',  # last
]
# process_request runs top-down
# process_response runs bottom-up (onion model)
```

> 🌍 **Real-World:** Disqus scaled Django to serve over 500 million users by adding custom middleware for request ID propagation, distributed tracing (injecting `X-Request-ID` headers), and rate limiting — all without touching a single view function. The middleware onion model means `SecurityMiddleware` runs first on every request, enforcing HTTPS redirects and HSTS headers before any application logic executes, providing a single enforcement point across thousands of views.

---

### 9.3 Django ORM Internals

```python
# QuerySets are lazy — no SQL until evaluated
users = User.objects.filter(active=True)  # no query yet
users = users.order_by('name')            # no query yet
users = users[:10]                        # no query yet
list(users)                              # SQL executed NOW

# When QuerySets are evaluated:
list(qs), for x in qs, qs[i], bool(qs), len(qs), repr(qs)

# QuerySet methods that hit DB immediately:
qs.get(), qs.create(), qs.update(), qs.delete()
qs.exists(), qs.count(), qs.aggregate()

# N+1 problem and solutions
# BAD: N+1 — 1 query for posts + N queries for authors
posts = Post.objects.all()
for post in posts:
    print(post.author.name)   # each access = 1 query

# GOOD: select_related — JOIN for ForeignKey/OneToOne
posts = Post.objects.select_related('author').all()  # 1 query

# GOOD: prefetch_related — separate query + Python join for M2M
posts = Post.objects.prefetch_related('tags').all()  # 2 queries

# Complex prefetch
from django.db.models import Prefetch
posts = Post.objects.prefetch_related(
    Prefetch('comments', queryset=Comment.objects.filter(approved=True))
)

# Annotations — computed fields in SQL
from django.db.models import Count, Avg, F, Q, ExpressionWrapper, fields

authors = Author.objects.annotate(
    post_count=Count('posts'),
    avg_length=Avg('posts__word_count')
)

# F expressions — reference field values in queries (avoids Python round-trip)
# BAD:
for product in Product.objects.all():
    product.views += 1
    product.save()  # N queries

# GOOD:
Product.objects.update(views=F('views') + 1)  # 1 query, atomic

# Q objects — complex WHERE clauses
from django.db.models import Q
User.objects.filter(
    Q(first_name='John') | Q(last_name='Doe'),
    Q(active=True) & ~Q(banned=True)
)
```

> **💡 Key Insight:** `QuerySet.update()` bypasses model `save()` and signals (`post_save`, `pre_save`). If you have custom logic in `save()` or use signals, you must iterate and save. Also, `update()` doesn't call `full_clean()` — no model-level validation.

> 🌍 **Real-World:** Instagram uses `select_related` and `prefetch_related` extensively to keep their Django feed queries down to a predictable number of SQL queries per request — their engineering blog documented reducing a feed endpoint from 47 queries (N+1 for each media item's owner, tags, and like count) to 3 queries using `select_related('owner').prefetch_related('tags').annotate(like_count=Count('likes'))`. The `F()` expression trick (`views=F('views')+1`) is critical for their like/view counters to avoid read-modify-write races at high concurrency.

---

### 9.4 Middleware Patterns

```python
# Django middleware
class TimingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response  # next middleware or view

    def __call__(self, request):
        # Code before view
        start = time.perf_counter()

        response = self.get_response(request)  # calls next in chain

        # Code after view
        elapsed = time.perf_counter() - start
        response['X-Processing-Time'] = f"{elapsed:.4f}"
        return response

    def process_exception(self, request, exception):
        # Optional: handle exceptions
        logger.error(f"Unhandled exception: {exception}")
        return None  # re-raise; return Response to suppress

# FastAPI / Starlette middleware
from starlette.middleware.base import BaseHTTPMiddleware

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        token = request.headers.get("Authorization")
        if not token:
            return Response("Unauthorized", status_code=401)
        request.state.user = decode_token(token)
        response = await call_next(request)
        return response
```

> 🌍 **Real-World:** Sentry (the error tracking platform, built on Django) implements their rate-limiting and data ingestion quotas entirely as Django middleware — the middleware layer reads project quotas from Redis before any view logic runs, rejecting over-quota requests with a `429` in microseconds without touching the database. Their `process_exception` hook in middleware is how Sentry captures unhandled Django exceptions before Django's own error response is generated.

---

## 10. Python Performance

### 10.1 Profiling

```python
# cProfile — deterministic profiler (low overhead)
import cProfile
import pstats
import io

pr = cProfile.Profile()
pr.enable()
your_function()
pr.disable()

# Print stats
s = io.StringIO()
ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
ps.print_stats(20)    # top 20 functions
print(s.getvalue())

# Command line
# python -m cProfile -s cumtime your_script.py
# python -m cProfile -o output.prof your_script.py
# python -m pstats output.prof

# snakeviz — graphical profile viewer
# pip install snakeviz
# snakeviz output.prof

# line_profiler — line-by-line timing
# pip install line_profiler
# @profile decorator, then: kernprof -l -v script.py

from line_profiler import LineProfiler
lp = LineProfiler()
lp.add_function(your_function)
lp.run('your_function(args)')
lp.print_stats()

# memory_profiler — line-by-line memory
# @profile decorator, then: python -m memory_profiler script.py

# py-spy — sampling profiler (no code changes, minimal overhead)
# py-spy top --pid <PID>
# py-spy record -o profile.svg -- python script.py
```

**timeit for micro-benchmarks:**

```python
import timeit

# Quick one-liner
timeit.timeit("'-'.join(str(n) for n in range(100))", number=10000)

# Better: setup + stmt
setup = "from mymodule import my_func"
stmt = "my_func(1000)"
timeit.timeit(stmt, setup=setup, number=10000)

# In IPython/Jupyter:
# %timeit my_function(args)
# %memit my_function(args)   # requires memory_profiler
```

> 🌍 **Real-World:** The CPython core team uses `pyperf` (a benchmarking suite wrapping `timeit`) to measure regression/improvement across Python versions — the pyperformance benchmark suite is the official benchmark used to validate that Python 3.11's ~25% speed claim was real. Spotify's data engineering team uses `py-spy` (a sampling profiler) in production on their Luigi pipeline workers without code changes, attaching to live PIDs to identify why certain stages block for seconds on shuffle operations.

---

### 10.2 Caching Strategies

```python
from functools import lru_cache, cache

# lru_cache — LRU eviction, fixed size
@lru_cache(maxsize=128)
def fib(n):
    if n < 2: return n
    return fib(n-1) + fib(n-2)

fib.cache_info()    # CacheInfo(hits=..., misses=..., maxsize=128, currsize=...)
fib.cache_clear()   # invalidate all

# cache (Python 3.9+) — unbounded LRU (equivalent to lru_cache(maxsize=None))
@cache
def factorial(n):
    return n * factorial(n-1) if n > 1 else 1

# lru_cache gotchas:
# - Arguments must be hashable
# - Works on methods but captures 'self' — different instances = separate caches
# - Memory leak on instance methods — lru_cache holds strong ref to self
#   Fix: use methodtools.lru_cache or cache on class

# cachetools — more eviction policies
from cachetools import TTLCache, LFUCache, LRUCache

ttl_cache = TTLCache(maxsize=100, ttl=300)  # expires after 5 min
ttl_cache['key'] = 'value'

# redis-py for distributed caching
import redis
r = redis.Redis()
r.setex('key', 300, 'value')   # TTL = 300 seconds
value = r.get('key')
```

> 🌍 **Real-World:** Airbnb's Python pricing service uses `functools.lru_cache` on expensive geo-lookup functions (mapping lat/lng to neighborhood/price zones) — with `maxsize=4096`, the cache covers the hot spots (tourist districts) and avoids re-computing the same geo-joins repeatedly within a request window. For distributed caching, their search service uses Redis with TTL caching (`r.setex()`) for search result pages — cached at the Python layer before results are assembled, giving sub-millisecond response times for popular search queries.

---

### 10.3 NumPy Vectorization

```python
import numpy as np

# SLOW: Python loop
def sum_squares_slow(n):
    return sum(i**2 for i in range(n))

# FAST: NumPy vectorized (C loop, releases GIL)
def sum_squares_fast(n):
    return np.sum(np.arange(n)**2)

# ~100x faster for large n

# NumPy broadcasting — operations on different-shaped arrays
a = np.array([[1], [2], [3]])    # shape (3, 1)
b = np.array([10, 20, 30])       # shape (3,) → broadcast to (1, 3)
a + b                             # shape (3, 3) — outer addition

# Avoiding copies with views
arr = np.arange(100)
view = arr[10:50]    # view — shares data, no copy
copy = arr[10:50].copy()  # explicit copy

arr[10] = 999
view[0]   # 999 — reflects change
copy[0]   # still 10

# Memory layout matters for cache performance
C_contiguous = np.zeros((1000, 1000), order='C')   # row-major
F_contiguous = np.zeros((1000, 1000), order='F')   # column-major (Fortran)

# Iterating rows: C order is faster (rows contiguous in memory)
# np operations default to C order

# dtype optimization
arr_f64 = np.zeros(10**6, dtype=np.float64)   # 8MB
arr_f32 = np.zeros(10**6, dtype=np.float32)   # 4MB — faster for GPU/SIMD
arr_int = np.zeros(10**6, dtype=np.int32)     # 4MB

# Universal functions (ufuncs) — element-wise, C speed, parallel SIMD
np.add, np.multiply, np.sqrt, np.log, np.exp
np.add.reduce([1,2,3,4])    # cumulative sum = 10
np.add.outer([1,2], [3,4])  # outer product
```

> 🌍 **Real-World:** Google's DeepMind and OpenAI use NumPy vectorization as the baseline computation layer — model rollouts, reward normalization, and advantage estimation in RL training loops are written as NumPy broadcasting operations rather than Python loops, keeping the GIL released during the C-level computation. NumPy's `float32` arrays (4MB vs 8MB for `float64`) are standard in ML pipelines because most GPU hardware (NVIDIA Tensor Cores) operates natively at FP32, and halving RAM usage doubles how many samples fit in CPU cache.

---

### 10.4 C Extensions & Cython Hints

```python
# ctypes — call C functions from Python
import ctypes

lib = ctypes.CDLL("./mylib.so")
lib.add.argtypes = [ctypes.c_int, ctypes.c_int]
lib.add.restype = ctypes.c_int
result = lib.add(3, 4)   # calls C function

# cffi — more Pythonic C bindings
from cffi import FFI
ffi = FFI()
ffi.cdef("int add(int, int);")
lib = ffi.dlopen("./mylib.so")
lib.add(3, 4)

# Cython hints — things that speed up Cython code:
# cdef int x = 0          — C typed variable, no PyObject
# cdef double[:] arr       — typed memoryview (no GIL needed)
# with nogil:              — release GIL for C-only code
#     c_function()
# cpdef vs cdef vs def:
#   def   — Python visible, Python calling convention
#   cdef  — C speed, NOT visible to Python
#   cpdef — both, with virtual dispatch overhead

# Numba — JIT compilation for numeric code
from numba import jit, prange

@jit(nopython=True, parallel=True)
def parallel_sum(arr):
    total = 0.0
    for i in prange(len(arr)):   # parallel range
        total += arr[i]
    return total

# First call: compile (slow). Subsequent: fast C code.
```

> 🌍 **Real-World:** Cython powers SciPy's inner computation loops (FFT, linear algebra) and is used by lxml, Pillow, and gevent — all critical production libraries. Numba is used by NASA's astropy library and Nvidia's RAPIDS data science platform for GPU-accelerated Python analytics, letting data scientists write Python loops that JIT-compile to CUDA kernels. Cloudflare's Python-based WAF rules engine uses cffi to call into a Rust library for pattern matching, getting C speed with Python's ease of rule authoring.

---

## 11. Common Python Interview Traps

### 11.1 Mutable Default Arguments

```python
# THE classic Python gotcha
def append_to(element, to=[]):   # BAD: list created ONCE at function definition
    to.append(element)
    return to

append_to(1)   # [1]
append_to(2)   # [1, 2]  ← NOT [2]! Same list object reused!
append_to(3)   # [1, 2, 3]

# WHY: default values are stored in function.__defaults__
# They are evaluated ONCE when the def statement executes, not on each call

# FIX: use None as sentinel
def append_to(element, to=None):
    if to is None:
        to = []
    to.append(element)
    return to

# This also applies to dicts, sets, and any mutable object as default
def make_config(settings={}):  # BAD
def make_config(settings=None):  # GOOD
    if settings is None: settings = {}
```

> 🌍 **Real-World:** This bug has appeared in production Django views and Flask route handlers at numerous companies — a shared mutable default list or dict accumulates state across requests when a view helper is called without explicitly passing the argument. Flask's documentation explicitly warns against it, and Python's official style guide (PEP 8) mandates the `None`-sentinel pattern. It also surfaces in data science code: a Pandas processing function with `def process(df, cols=[])` will accumulate column names across calls if the caller ever mutates the default.

---

### 11.2 Late Binding Closures

```python
# TRAP
funcs = []
for i in range(5):
    funcs.append(lambda: i)   # captures variable 'i', not its value

[f() for f in funcs]   # [4, 4, 4, 4, 4] — all see i=4, the final value

# WHY: lambda captures 'i' by REFERENCE (closure over the variable, not value)
# By the time lambdas are called, the loop has finished and i=4

# FIX 1: default argument captures value at definition time
funcs = [lambda x=i: x for i in range(5)]
[f() for f in funcs]   # [0, 1, 2, 3, 4]

# FIX 2: functools.partial
import functools
def make_adder(x): return x
funcs = [functools.partial(make_adder, i) for i in range(5)]

# FIX 3: immediately-invoked lambda (unusual but works)
funcs = [(lambda x: lambda: x)(i) for i in range(5)]

# Same trap with dict comprehensions — NO, dict comps don't have this issue
# because each iteration creates a new scope (for the generator)

# Same trap in class bodies:
class Foo:
    x = 10
    methods = [lambda: x for _ in range(3)]  # NameError! 'x' not in local scope
    # class body is NOT a closure scope for lambdas
```

> 🌍 **Real-World:** Late binding closures in event-driven GUI code (Tkinter, wxPython) is a classic Python bug — `button_i.command = lambda: handle(i)` in a loop where all buttons call `handle` with the last `i`. The `functools.partial` fix is the standard solution documented in Python's official FAQ. In JavaScript, the equivalent `var` vs `let` scoping issue in loops is so common it drove the `let` keyword into ES6. React's `useCallback` and Vue's template refs exist partly to address this same late-binding-in-loop pattern in frontend code.

---

### 11.3 GIL Misconceptions

```python
# MISCONCEPTION 1: "The GIL makes Python thread-safe"
# WRONG: The GIL only ensures bytecode executes atomically per instruction
# Multi-instruction operations are NOT atomic

counter = 0
def increment():
    global counter
    for _ in range(100000):
        counter += 1   # READ counter, ADD 1, WRITE counter — 3 bytecodes!
        # GIL can be released between any two bytecodes

# Run with 2 threads → counter < 200000 is possible

# MISCONCEPTION 2: "GIL prevents all race conditions"
# WRONG: It prevents C-level memory corruption, not logical races
# Any multi-step operation can race

shared_list = []
def append_if_not_full():
    if len(shared_list) < 10:       # GIL released between these two lines
        shared_list.append("item")  # another thread may have appended
# shared_list can have > 10 items

# MISCONCEPTION 3: "Threading is useless in Python"
# WRONG: Threading is excellent for I/O-bound work
# Web scraping, database queries, file I/O → threads provide real speedup

# MISCONCEPTION 4: "The GIL is always held"
# WRONG: GIL is released during:
# - I/O operations (socket, file, pipe)
# - C extension calls that release it (numpy, hashlib, zlib)
# - time.sleep()
# - Every ~5ms (sys.getswitchinterval()) to give other threads a chance

import sys
sys.getswitchinterval()   # 0.005 (5ms)
sys.setswitchinterval(0.01)  # increase for CPU-bound, decrease for I/O responsiveness
```

> 🌍 **Real-World:** A notorious production bug at a trading firm involved Python threads incrementing a shared counter — the engineers assumed the GIL made it safe (Misconception #1), but `counter += 1` compiles to LOAD, BINARY_ADD, STORE — three bytecodes across which the GIL can switch. The counter ended up 15% below expected after a high-throughput trading session. The fix was `threading.Lock()`. NumPy's internal C code explicitly calls `Py_BEGIN_ALLOW_THREADS` / `Py_END_ALLOW_THREADS` around array operations to release the GIL, which is why `np.dot()` on large matrices runs in parallel across CPU cores on multi-threaded NumPy builds.

---

### 11.4 is vs ==

```python
# is: identity — same object in memory (same id())
# ==: equality — same value (__eq__ method)

a = [1, 2, 3]
b = [1, 2, 3]
a == b    # True — same value
a is b    # False — different objects

a = b = [1, 2, 3]
a is b    # True — same object

# Correct uses of 'is':
x is None      # CORRECT — None is a singleton
x is True      # CORRECT — True is a singleton
x is False     # CORRECT — False is a singleton

# WRONG uses of 'is':
x = "hello"
x is "hello"   # May be True due to interning, but UNDEFINED BEHAVIOR
x = 42
x is 42        # May be True for [-5, 256], False outside — UNDEFINED
```

> 🌍 **Real-World:** Python's `flake8` linter includes rule `E712` ("comparison to True should be `if cond is True:` or `if cond:`") and `E711` ("comparison to None should be `if x is None:`") — these rules exist because production Django and Flask code bases frequently misuse `== None` or `== True`, which can be accidentally satisfied by objects implementing `__eq__`. SQLAlchemy Column expressions override `__eq__` to return SQL clauses, so `column == None` produces `IS NULL` SQL (intentional), but `column is None` checks Python object identity (almost always wrong and a bug).

---

### 11.5 Copy vs Deep Copy

```python
import copy

original = {'name': 'Alice', 'scores': [1, 2, 3]}

# Assignment — no copy, just another name for same object
ref = original
ref['name'] = 'Bob'
original['name']   # 'Bob' — same object!

# Shallow copy — new outer object, same inner references
shallow = original.copy()        # dict shallow copy
shallow = copy.copy(original)    # generic shallow copy
shallow = {**original}           # dict unpacking = shallow copy
shallow = list(original)         # if original is a list

shallow['name'] = 'Charlie'
original['name']   # still 'Bob' — name is a new binding in shallow

shallow['scores'].append(4)
original['scores']  # [1, 2, 3, 4] — SHARED reference to inner list!

# Deep copy — recursively copies everything
deep = copy.deepcopy(original)
deep['scores'].append(99)
original['scores']  # unchanged

# Custom copy behavior
class MyObj:
    def __copy__(self):
        new = MyObj()
        new.__dict__.update(self.__dict__)
        return new

    def __deepcopy__(self, memo):
        new = MyObj()
        memo[id(self)] = new   # memo prevents infinite loops with cycles
        for k, v in self.__dict__.items():
            setattr(new, k, copy.deepcopy(v, memo))
        return new
```

> 🌍 **Real-World:** Celery serializes task arguments using pickle (or JSON), which is essentially a deep copy operation — passing a large nested dict to a task incurs a full deep-copy cost on both the sending and receiving end. This is why Celery best practices recommend passing only primitive IDs (e.g., `user_id=42`) rather than full model objects, letting the worker re-fetch from the database. Django's `QuerySet` deliberately does NOT support deep copy across process boundaries — you cannot pass a queryset to a Celery task (it's not picklable), enforcing the correct pattern.

---

### 11.6 Exception Handling Gotchas

```python
# TRAP 1: Bare except catches EVERYTHING including KeyboardInterrupt, SystemExit
try:
    risky()
except:           # BAD — catches Ctrl+C, sys.exit(), etc.
    pass

try:
    risky()
except Exception:  # BETTER — misses SystemExit, KeyboardInterrupt
    pass

except BaseException:  # catches EVERYTHING — rarely appropriate

# TRAP 2: Exception variable deleted after except block
try:
    raise ValueError("oops")
except ValueError as e:
    err = e   # save it before block ends
# 'e' is deleted here (CPython clears it to break reference cycles)
# but 'err' still exists

# TRAP 3: finally changes return value
def tricky():
    try:
        return 1
    finally:
        return 2   # overrides the return 1!

tricky()   # 2 — finally return wins

# TRAP 4: Exception chaining
try:
    json.loads("invalid")
except json.JSONDecodeError as e:
    raise RuntimeError("Parse failed") from e   # explicit chaining
    # raise RuntimeError("Parse failed")         # implicit chaining via __context__
    # raise RuntimeError("Parse failed") from None  # suppress chaining

# TRAP 5: Modifying loop variable in except
for item in items:
    try:
        process(item)
    except Exception as item:   # SHADOWS loop variable!
        pass   # 'item' is now the exception object after this block

# TRAP 6: assert statements disabled with -O flag
assert validate(data), "Invalid data"  # Skipped in optimized mode!
# Use explicit if/raise for production validation
```

> 🌍 **Real-World:** The bare `except:` trap (Trap #1) has caused silent failures in production at multiple companies — a Celery worker swallowing `KeyboardInterrupt` prevented graceful shutdown, causing in-flight tasks to be lost. Sentry's Python SDK wraps `sys.excepthook` to catch all unhandled exceptions; their SDK documentation explicitly warns to never use bare `except:` because it prevents Sentry from seeing the exception. The `finally: return` override (Trap #3) has bitten Django view code where a `finally` block returning an error response accidentally suppressed a re-raised exception, logging nothing about the original failure.

---

## 12. Production Patterns

### 12.1 Type Hints & mypy

```python
from typing import (
    Optional, Union, List, Dict, Tuple, Set,
    Callable, TypeVar, Generic, Protocol,
    Any, Final, Literal, TypedDict,
    overload, cast
)

# Python 3.10+ preferred syntax
def process(items: list[int]) -> dict[str, int]:
    return {str(i): i**2 for i in items}

# Optional
def find(key: str) -> str | None:   # Python 3.10+
    ...

# Callable
Handler = Callable[[Request, Response], None]
def register(handler: Handler) -> None: ...

# TypeVar — generic functions
T = TypeVar('T')
def first(items: list[T]) -> T:
    return items[0]

# Generic classes
class Stack(Generic[T]):
    def __init__(self) -> None:
        self._items: list[T] = []
    def push(self, item: T) -> None:
        self._items.append(item)
    def pop(self) -> T:
        return self._items.pop()

# Protocol — structural subtyping (duck typing with types)
from typing import Protocol

class Drawable(Protocol):
    def draw(self) -> None: ...
    def resize(self, factor: float) -> None: ...

def render(shape: Drawable) -> None:
    shape.draw()   # works for any object with draw() method

# TypedDict — typed dict structure
class Config(TypedDict):
    host: str
    port: int
    debug: bool

config: Config = {"host": "localhost", "port": 8080, "debug": False}

# Literal — constrained string/int values
Mode = Literal["read", "write", "append"]
def open_file(path: str, mode: Mode) -> None: ...

# Final — constants
MAX_RETRIES: Final = 3
MAX_RETRIES = 4   # mypy error

# overload — different signatures for same function
@overload
def process(x: int) -> int: ...
@overload
def process(x: str) -> str: ...
def process(x):
    if isinstance(x, int): return x * 2
    return x.upper()
```

> 🌍 **Real-World:** Dropbox's codebase (4 million lines of Python) adopted mypy and type hints across their entire codebase as a company-wide initiative — they found that mypy caught ~15% of bugs before code review. Microsoft's Python VS Code extension, Pylance, is built on Pyright (their type checker) and uses `Protocol` for structural typing to check duck-typed interfaces without requiring inheritance — critical for typing plugin systems where third-party code can't inherit from your base classes. Google's internal Python style guide mandates type hints on all new Python 3 code, enforced by their internal Tricorder static analysis system.

---

### 12.2 dataclasses

```python
from dataclasses import dataclass, field, asdict, astuple, replace
from typing import ClassVar

@dataclass
class Point:
    x: float
    y: float
    z: float = 0.0   # default value

    def distance(self) -> float:
        return (self.x**2 + self.y**2 + self.z**2) ** 0.5

# Auto-generated: __init__, __repr__, __eq__

@dataclass(order=True)    # generates __lt__, __le__, __gt__, __ge__
@dataclass(frozen=True)   # immutable — __hash__ generated, __setattr__ raises
@dataclass(slots=True)    # Python 3.10+ — uses __slots__

# field() for complex defaults
@dataclass
class Config:
    name: str
    tags: list[str] = field(default_factory=list)  # CORRECT — new list each time
    metadata: dict = field(default_factory=dict)
    _id: int = field(default=0, repr=False, compare=False, hash=False)
    VERSION: ClassVar[str] = "1.0"   # class variable, not included in __init__

# Post-init processing
@dataclass
class Temperature:
    celsius: float
    fahrenheit: float = field(init=False)

    def __post_init__(self):
        self.fahrenheit = self.celsius * 9/5 + 32

# Utility functions
p = Point(1, 2, 3)
asdict(p)        # {'x': 1, 'y': 2, 'z': 3}
astuple(p)       # (1, 2, 3)
replace(p, x=10) # Point(x=10, y=2, z=3) — new instance with field replaced
```

> 🌍 **Real-World:** Python's `@dataclass` was inspired by attrs, which is used at Bloomberg LP for financial instrument modeling — thousands of `Instrument`, `Position`, and `Trade` dataclass-like objects created per second in trading pipelines. `frozen=True` dataclasses are used as dict keys and set members in deduplication logic (they're hashable), and `slots=True` (Python 3.10+) reduces per-instance memory by ~40% on classes with many instances. The `replace()` function mirrors Rust's struct update syntax and is used in functional-style state management where immutability is required.

---

### 12.3 Pydantic

Pydantic uses Python type hints for data validation and serialization.

```python
from pydantic import BaseModel, Field, validator, root_validator, model_validator
from pydantic import EmailStr, HttpUrl, constr, conint
from typing import Optional
import pydantic

# Pydantic v2 (current)
class User(BaseModel):
    id: int
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    age: int = Field(ge=0, le=150)
    tags: list[str] = []
    metadata: dict[str, str] = {}

# Validation
user = User(id=1, name="Alice", email="alice@example.com", age=30)
user.model_dump()       # dict output
user.model_dump_json()  # JSON string
user.model_fields_set   # {'id', 'name', 'email', 'age'} — not 'tags', 'metadata'

# Parsing
user = User.model_validate({'id': '1', 'name': 'Alice', ...})  # coerces '1' → 1
user = User.model_validate_json('{"id": 1, ...}')

# Custom validators (v2 syntax)
from pydantic import field_validator, model_validator

class Order(BaseModel):
    items: list[str]
    quantity: int

    @field_validator('items')
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("items cannot be empty")
        return v

    @model_validator(mode='after')
    def check_consistency(self):
        if self.quantity > len(self.items) * 10:
            raise ValueError("quantity too high for item count")
        return self

# Settings management
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str = "redis://localhost:6379"
    debug: bool = False
    max_connections: int = 10

    model_config = {
        "env_prefix": "APP_",       # reads APP_DATABASE_URL etc.
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

settings = Settings()   # reads from environment + .env file
```

> **💡 Key Insight:** Pydantic v2 is rewritten in Rust (pydantic-core). Validation is ~5-50x faster than v1. The `@validator` decorator from v1 is replaced by `@field_validator` in v2. `model_dump()` replaces `.dict()`, `model_validate()` replaces `.parse_obj()`. Know the v2 API for current interviews.

> 🌍 **Real-World:** OpenAI's public API Python SDK uses Pydantic v2 models for all request/response types — every `ChatCompletion`, `Message`, and `Tool` object is a Pydantic model that validates the JSON response from the API server. FastAPI (used by Spotify, Lyft, and Microsoft internally) generates OpenAPI 3.0 schemas directly from Pydantic models at startup — one class definition becomes both your runtime validator and your API documentation with zero duplication. The `pydantic-settings` `BaseSettings` class is the standard pattern for 12-factor app configuration at companies like HashiCorp and Stripe's Python services.

---

### 12.4 ContextVar for Async

`threading.local()` doesn't work in async contexts — multiple coroutines share the same thread. Use `contextvars.ContextVar`.

```python
from contextvars import ContextVar, copy_context
import asyncio

# Request-scoped storage in async code
request_id: ContextVar[str] = ContextVar('request_id', default='')
current_user: ContextVar[dict] = ContextVar('current_user')

# Middleware sets context variables
async def request_middleware(request, call_next):
    # Each request gets its own copy of context
    token = request_id.set(generate_id())
    try:
        response = await call_next(request)
        return response
    finally:
        request_id.reset(token)   # restore previous value

# Anywhere in the call chain
async def handler():
    rid = request_id.get()   # gets THIS request's ID, not another's
    log.info(f"[{rid}] Processing request")

# Context is automatically inherited by tasks
async def main():
    request_id.set("req-123")

    async def worker():
        print(request_id.get())  # "req-123" — inherited from parent context

    # asyncio.create_task copies the context
    task = asyncio.create_task(worker())
    await task
    # task runs in a COPY of the context — changes in task don't affect parent

# copy_context() — explicit context capture
ctx = copy_context()
ctx.run(some_function)   # runs function in copied context
```

> 🌍 **Real-World:** FastAPI's recommended pattern for request tracing uses `ContextVar` — a middleware sets `request_id_var.set(str(uuid4()))` for every incoming request, and any async handler or downstream coroutine can call `request_id_var.get()` without threading concerns. Structlog (used at Stripe and many fintechs) integrates with `contextvars` via `structlog.contextvars.bind_contextvars(request_id=rid)` — all log lines emitted during that async request automatically include the request ID without passing it through every function signature.

---

### 12.5 Structured Logging

```python
import logging
import json
import sys
from datetime import datetime, timezone

# Standard logging hierarchy
# Logger → Handler → Formatter → output

# Basic structured JSON logging
class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        # Include extra fields
        for key, val in record.__dict__.items():
            if key not in logging.LogRecord.__dict__ and not key.startswith('_'):
                log_data[key] = val
        return json.dumps(log_data)

def setup_logging(level=logging.INFO):
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(handler)

logger = logging.getLogger(__name__)
setup_logging()

# Usage with extra context
logger.info("Request processed", extra={
    "request_id": "abc123",
    "user_id": 42,
    "duration_ms": 145
})

# structlog — production-grade structured logging
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,   # include ContextVar values
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

log = structlog.get_logger()

# Bind context that appears in all subsequent log calls
log = log.bind(request_id="abc123", user_id=42)
log.info("started processing")
log.info("step complete", step=1)
log.error("failed", error=str(exc))
```

> 🌍 **Real-World:** Stripe's Python backend emits structured JSON logs that feed into Splunk and their internal observability platform — every log line includes `request_id`, `user_id`, `endpoint`, and `duration_ms` as first-class JSON fields, enabling SQL-style queries like `SELECT * FROM logs WHERE endpoint='/v1/charges' AND duration_ms > 500`. This is only possible with structured logging; plain string messages can't be reliably parsed at scale. Datadog's Python APM agent instruments Python's `logging` module to automatically inject `dd.trace_id` and `dd.span_id` into every log record, correlating logs with distributed traces without any application code changes.

---

## Quick Reference

### Complexity Cheat Sheet

```text
Built-in          Operation               Complexity
────────────────────────────────────────────────────────
list              append                  O(1) amortized
list              insert(0, x)            O(n)
list              pop()                   O(1)
list              pop(0)                  O(n)
list              x in list              O(n)
list              sort()                  O(n log n)
dict              get/set/del             O(1) avg
dict              x in dict              O(1) avg
set               add/remove             O(1) avg
set               x in set               O(1) avg
set               a & b (intersection)   O(min(len(a), len(b)))
set               a | b (union)          O(len(a) + len(b))
deque             appendleft/popleft     O(1)
heapq             heappush/heappop       O(log n)
heapq             heapify                O(n)
sorted()          any sequence           O(n log n)
str               s in string            O(n*m) — use re or str.find
```

### GIL Rules

```text
GIL is HELD during:       Python bytecode execution
GIL is RELEASED during:   I/O calls, time.sleep(), C extensions that release it

Use threads for:           I/O-bound (web requests, DB, file I/O)
Use processes for:         CPU-bound (ML, data processing, image manipulation)
Use asyncio for:           High-concurrency I/O (1000s of connections)
```

### asyncio Gotchas

```text
NEVER:  time.sleep() in async code → use asyncio.sleep()
NEVER:  requests.get() in async code → use aiohttp
NEVER:  synchronous file I/O in hot path → use aiofiles or run_in_executor
ALWAYS: await coroutines, don't just call them
ALWAYS: use asyncio.create_task() to run concurrently, not just await sequentially
```

### MRO Quick Algorithm (C3)

```text
MRO(C(B1, B2)) = [C] + merge(MRO(B1), MRO(B2), [B1, B2])
merge: repeatedly take the head of the first list if it doesn't appear in the
       tail of any other list; if it does, try the next list's head.
```

### Python Version Key Features

```text
3.7:  dict ordered by insertion (official), dataclasses, breakpoint()
3.8:  walrus operator :=, positional-only params /, f-string = specifier
3.9:  list[int] / dict[str, int] type hints (no need to import), dict merge |
3.10: match/case, X | Y union types in isinstance(), structural pattern matching
3.11: ~25% speed improvement, tomllib, ExceptionGroup
3.12: f-string improvements, @override decorator, type parameter syntax
3.13: free-threaded mode (--disable-gil, experimental), JIT compiler (experimental)
```

---

*Self-contained reference. All examples runnable with standard CPython 3.10+.*


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Python)

| # | Concept | Why | Done |
|---|---------|-----|------|
| 1 | GIL implications | Concurrency expectations | [ ] |
| 2 | Mutable default args trap | Classic bug | [ ] |
| 3 | List/dict/set complexity | Algorithmic interviews | [ ] |
| 4 | Generators / iterators | Memory-efficient pipelines | [ ] |
| 5 | Decorators & context managers | Production Python | [ ] |
| 6 | asyncio event loop model | Async services | [ ] |
| 7 | multiprocessing vs threading | CPU vs I/O | [ ] |
| 8 | dataclasses / typing | Clean APIs | [ ] |
| 9 | GIL + NumPy release patterns | Perf nuance | [ ] |
| 10 | Packaging / venv basics | Engineering hygiene | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Threading ≠ parallelism in CPython for CPU-bound work — use multiprocessing or native extensions.

---

## 🛠️ PRACTICAL — Python Labs

### Lab 1: GIL Demo
CPU-bound loop in threads vs processes — measure wall time. Explain results.

### Lab 2: Async Fan-out
`asyncio.gather` 50 HTTP calls (or mocked sleeps). Show cancellation with timeout.

### Lab 3: Interview Traps
Predict output of mutable-default and late-binding-closure snippets before running.
