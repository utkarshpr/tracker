# Go Deep Track — Language, Idioms, LLD & Interview Mastery

> **Your primary language track.** Pair with `GoLang-Core.md` (runtime, concurrency, networking, production).
> Self-contained. Every concept has a runnable mental model + interview angle.
> Code targets **Go 1.22+** (generics, `log/slog`, `slices`/`maps` std helpers where noted).

---

## How This Track Works

| Week | Focus | Primary file |
|------|-------|--------------|
| 1 | Types, slices, maps, strings, methods | This file §§1–5 |
| 2 | Interfaces, embedding, errors, generics | This file §§6–9 |
| 3 | Concurrency mastery + bugs | `GoLang-Core.md` §2 + `Concurrency.md` |
| 4 | Runtime (GMP/GC/escape) + pprof | `GoLang-Core.md` §1 + §4 |
| 5 | net/http, gRPC, production patterns | `GoLang-Core.md` §3 + §5 |
| 6 | LLD in Go + interview drills | This file §§12–14 |

**Daily Go block (night, 2h) — forever until interviews:**
```text
30 min  Read one ⭐ section; rewrite in your words
45 min  Type / run the example (or break it on purpose)
30 min  Explain aloud (record) OR answer 5 interview Qs
15 min  Check off Important Concepts below
```

> ⭐ **IMPORTANT CONCEPT:** FAANG Go interviews test **judgment** (channel vs mutex, pointer vs value, interface boundaries) more than syntax trivia.

---

## Table of Contents

1. [Mental Model of a Go Program](#1-mental-model-of-a-go-program)
2. [Types, Zero Values, Declarations](#2-types-zero-values-declarations)
3. [Pointers vs Values](#3-pointers-vs-values)
4. [Slices — Internals and Gotchas](#4-slices--internals-and-gotchas)
5. [Maps — Internals and Gotchas](#5-maps--internals-and-gotchas)
6. [Strings, Bytes, Runes](#6-strings-bytes-runes)
7. [Methods and Receivers](#7-methods-and-receivers)
8. [Interfaces Deep Dive](#8-interfaces-deep-dive)
9. [Composition and Embedding](#9-composition-and-embedding)
10. [defer, panic, recover](#10-defer-panic-recover)
11. [Errors — Production Patterns](#11-errors--production-patterns)
12. [Generics](#12-generics)
13. [Packages, Modules, init](#13-packages-modules-init)
14. [Testing Mastery](#14-testing-mastery)
15. [Idiomatic Patterns](#15-idiomatic-patterns)
16. [errgroup, singleflight, semaphore](#16-errgroup-singleflight-semaphore)
17. [LLD in Go — Full Examples](#17-lld-in-go--full-examples)
18. [Go vs Java — Interview Contrast](#18-go-vs-java--interview-contrast)
19. [Interview Q&A Bank](#19-interview-qa-bank)
20. [Extended Labs](#20-extended-labs)
21. [Important Concepts Checklist](#21-important-concepts-checklist)

---

## 1. Mental Model of a Go Program

```text
Source .go
   → parser/typecheck
   → SSA + escape analysis (stack vs heap)
   → machine code
   → runtime: GMP scheduler + GC + netpoller

main.main runs in a goroutine (G).
GOMAXPROCS Ps schedule runnable Gs onto Ms (OS threads).
Blocking syscall → M keeps the G blocked, P is handed to another M.
Network I/O → netpoller; G parks without blocking an OS thread.
```

> ⭐ **IMPORTANT CONCEPT:** A goroutine is **not** an OS thread. Cheap stack (starts ~2KB), multiplexed by the runtime. Saying "thread" in a Go interview loses signal.

> 🛠️ **PRACTICAL:** Draw GMP on paper from memory. Narrate what happens when `http.Get` waits on the network.

---

## 2. Types, Zero Values, Declarations

### Zero Values (always defined)

| Type | Zero |
|------|------|
| `bool` | `false` |
| `int*` / `uint*` / `float*` / `complex*` | `0` |
| `string` | `""` |
| pointer / slice / map / chan / func / interface | `nil` |
| struct | each field zeroed |
| array | each element zeroed |

```go
var n int          // 0
var s string       // ""
var p *User        // nil
var xs []int       // nil slice (len=0, cap=0) — usable in range/append
var m map[string]int // nil map — read OK (zero), write PANICS
var ch chan int    // nil channel — send/recv block forever
```

> ⭐ **IMPORTANT CONCEPT:** `nil` slice is fine to `append`/`range`; `nil` map **panics on write**. Always `make(map[...]...)` before insert.

### Short declaration vs var

```go
x := 10          // type inferred, must be new name in at least one variable
x, err := f()    // redeclaration of x allowed if err is new
var y int = 10   // explicit; prefer := inside functions
const Max = 100  // compile-time; can be untyped
```

### Typed vs untyped constants

```go
const Pi = 3.14159          // untyped float — convertible freely
const Pi64 float64 = 3.14   // typed

var f32 float32 = Pi        // OK
// var f32 float32 = Pi64   // compile error without conversion
```

### iota for enum-like sets

```go
type Status int

const (
    StatusUnknown Status = iota // 0
    StatusPending               // 1
    StatusActive                // 2
    StatusClosed                // 3
)

func (s Status) String() string {
    switch s {
    case StatusPending:
        return "pending"
    case StatusActive:
        return "active"
    case StatusClosed:
        return "closed"
    default:
        return "unknown"
    }
}
```

> 💡 Prefer typed constants over raw ints in APIs — clearer and harder to mix up.

---

## 3. Pointers vs Values

```go
type Counter struct{ n int }

func (c Counter) IncValue()  { c.n++ }      // operates on copy — caller unchanged
func (c *Counter) IncPtr()   { c.n++ }      // mutates caller

func demo() {
    c := Counter{}
    c.IncValue()
    fmt.Println(c.n) // 0
    c.IncPtr()
    fmt.Println(c.n) // 1
}
```

### When to use pointer receivers

```text
Use *T when:
  - method mutates the receiver
  - struct is large (avoid copy)
  - consistency: if ANY method needs *T, usually all should use *T
  - you need to satisfy an interface with *T methods only

Use T when:
  - immutable / small value types (time.Time style)
  - no mutation
```

> ⭐ **IMPORTANT CONCEPT:** Interface satisfaction is exact: if methods are on `*T`, a `T` value does **not** implement the interface. `var _ iface = (*T)(nil)` compile-time check.

```go
type Stringer interface{ String() string }

type ID int
func (id *ID) String() string { return fmt.Sprintf("%d", *id) }

// var s Stringer = ID(5)   // FAIL: ID lacks String
var s Stringer = new(ID)     // OK
```

### Passing slices/maps

```go
// Slice header is a small value (ptr, len, cap) — passed by value,
// but points at shared array → mutations to elements are visible.
func set(xs []int) { xs[0] = 99 }

// Re-slicing / append that reallocates is NOT visible to caller
func appendLocal(xs []int) { xs = append(xs, 1) } // caller's xs unchanged
```

---

## 4. Slices — Internals and Gotchas

> ⭐ **IMPORTANT CONCEPT:** A slice is a **header** `(ptr, len, cap)` over an array. Most slice bugs are shared backing arrays + unexpected `append` growth.

```text
xs := make([]int, 3, 6)
header: ptr → [0][0][0]|_|_|_|
         len=3  cap=6
```

### Full examples of classic bugs

```go
package main

import "fmt"

func main() {
    // GOTCHA 1: subslice shares backing array
    a := []int{1, 2, 3, 4}
    b := a[:2]       // len=2 cap=4 — still points at a's array
    b = append(b, 9) // writes into a[2]!
    fmt.Println(a)   // [1 2 9 4]  ← surprise

    // FIX: full slice expression forces cap = len
    a = []int{1, 2, 3, 4}
    b = a[:2:2]      // len=2 cap=2
    b = append(b, 9) // allocates new array
    fmt.Println(a)   // [1 2 3 4] safe

    // GOTCHA 2: append may or may not reallocate
    s := make([]int, 0, 2)
    s1 := append(s, 1)
    s2 := append(s, 2) // same backing → overwrites
    fmt.Println(s1, s2) // often [2] [2] — nondeterministic-looking

    // FIX: never reuse slice after uncertain append; prefer copy
    s = make([]int, 0, 2)
    s1 = append(s[:0:0], 1) // or clone
}
```

### Efficient growth

```go
// Pre-size when length known
out := make([]int, 0, len(in))
for _, v := range in {
    if keep(v) {
        out = append(out, v)
    }
}

// Copy to shrink capacity (release big backing array)
func compact(xs []int) []int {
    y := make([]int, len(xs))
    copy(y, xs)
    return y
}
```

### 3-index slice

```go
a[low:high:max] // len = high-low, cap = max-low
```

> 🛠️ **PRACTICAL:** Write a function `SafeSubslice(xs []int, i, j int) []int` that returns an independent copy of `xs[i:j]`.

---

## 5. Maps — Internals and Gotchas

```go
m := make(map[string]int, 100) // hint: buckets for ~100 entries
m["a"] = 1
v, ok := m["a"] // comma-ok
delete(m, "a")

for k, v := range m { // iteration order is RANDOMIZED
    _, _ = k, v
}
```

> ⭐ **IMPORTANT CONCEPT:** Maps are **not concurrency-safe**. Concurrent read+write → fatal race (`fatal error: concurrent map read and map write`). Use `sync.Mutex` or `sync.Map` (read-mostly).

```go
type SafeCache struct {
    mu sync.RWMutex
    m  map[string]string
}

func (c *SafeCache) Get(k string) (string, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    v, ok := c.m[k]
    return v, ok
}

func (c *SafeCache) Set(k, v string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.m[k] = v
}
```

### Map key rules

```text
Key must be comparable: == defined
OK:   string, int, pointers, structs of comparables, arrays of comparables
NOT:  slices, maps, functions
```

### nil map

```go
var m map[string]int
fmt.Println(m["x"]) // 0 — OK
// m["x"] = 1       // panic: assignment to entry in nil map
```

---

## 6. Strings, Bytes, Runes

```text
string = immutable sequence of bytes (often UTF-8)
rune   = int32 code point
byte   = uint8
```

```go
s := "Go语言"
fmt.Println(len(s))              // bytes, NOT characters
fmt.Println(utf8.RuneCountInString(s))

for i, r := range s {            // iterates runes
    fmt.Printf("%d %c\n", i, r)  // i is byte index
}

b := []byte(s) // copy
s2 := string(b) // copy
```

### Builder for concatenation

```go
var b strings.Builder
b.Grow(n)
for _, p := range parts {
    b.WriteString(p)
}
out := b.String()
```

> ⚠️ `s = s + x` in a loop is O(n²) allocations — use `strings.Builder` or `bytes.Buffer`.

---

## 7. Methods and Receivers

```go
type Account struct {
    ID      string
    Balance int64
}

func (a *Account) Deposit(cents int64) {
    a.Balance += cents
}

func (a Account) Snapshot() Account { // value: return immutable copy
    return a
}
```

### Method sets (critical for interfaces)

```text
Type T  has methods with receiver T
Type *T has methods with receiver T AND *T

So *T is a superset. If interface requires a mutating method on *T,
only *T (or values that addressable) work.
```

---

## 8. Interfaces Deep Dive

> ⭐ **IMPORTANT CONCEPT:** Interfaces are satisfied **implicitly**. Design small interfaces (`io.Reader`, `error`) at the **consumer** side.

### iface / eface (runtime)

```text
eface (empty interface / any):
  type eface struct { _type *_type; data unsafe.Pointer }

iface (non-empty interface):
  type iface struct { tab *itab; data unsafe.Pointer }
  itab = type info + function pointers for interface methods
```

```go
var r io.Reader = bytes.NewBufferString("hi")
// r holds (itab for *bytes.Buffer→Reader, pointer to buffer)

var x any = 7
// x holds (type info for int, data)
```

### nil interface gotcha

```go
func check(err error) {
    if err != nil {
        fmt.Println("err:", err)
    }
}

type MyErr struct{ Msg string }
func (e *MyErr) Error() string { return e.Msg }

func main() {
    var e *MyErr = nil
    var err error = e // interface is NOT nil — type set, data nil
    check(err)        // prints err: <nil>  — STILL enters if err != nil!
}
```

> ⭐ **IMPORTANT CONCEPT:** An interface value is nil only if **both** type and value are nil. Returning a nil concrete pointer as `error` is a classic production bug.

```go
// BAD
func f() error {
    var e *MyErr
    if bad {
        e = &MyErr{"x"}
    }
    return e // returns typed nil
}

// GOOD
func f() error {
    if bad {
        return &MyErr{"x"}
    }
    return nil
}
```

### Accept interfaces, return structs

```go
// Good API shape
func NewUserService(db UserRepository, log *slog.Logger) *UserService

// Consumer defines what it needs
type UserRepository interface {
    Find(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, u *User) error
}
```

### Type assert / type switch

```go
switch v := anyVal.(type) {
case int:
    fmt.Println("int", v)
case string:
    fmt.Println("string", v)
default:
    fmt.Printf("other %T\n", v)
}

s, ok := anyVal.(string) // comma-ok avoids panic
```

---

## 9. Composition and Embedding

Go has **no inheritance**. Embed for composition:

```go
type Logger struct{}

func (Logger) Info(msg string) { fmt.Println("INFO", msg) }

type Server struct {
    Logger // embedded — methods promoted
    Addr   string
}

func demo() {
    s := Server{Addr: ":8080"}
    s.Info("up") // promoted from Logger
}
```

### Embedding vs field

```go
type Bad struct {
    log Logger // NOT embedded — must use bad.log.Info
}
```

> 💡 Embedding for "is-a-like" method promotion; named field when you need multiple of same type or clearer ownership.

### Decorators via embedding interfaces

```go
type Store interface {
    Get(ctx context.Context, k string) (string, error)
}

type TracingStore struct {
    Store // embed interface
}

func (t TracingStore) Get(ctx context.Context, k string) (string, error) {
    start := time.Now()
    v, err := t.Store.Get(ctx, k)
    slog.Info("get", "key", k, "dur", time.Since(start), "err", err)
    return v, err
}
```

---

## 10. defer, panic, recover

### defer rules

```go
func f() {
    defer fmt.Println(1)
    defer fmt.Println(2)
    // prints 2 then 1 — LIFO
}

// Arguments evaluated IMMEDIATELY
func g() {
    x := 1
    defer fmt.Println(x) // prints 1, not 2
    x = 2
}

// Closure captures variable
func h() {
    x := 1
    defer func() { fmt.Println(x) }() // prints 2
    x = 2
}
```

### defer in loops — classic leak

```go
for _, f := range files {
    fh, _ := os.Open(f)
    defer fh.Close() // closes only when function returns — FD leak
}

// FIX
for _, f := range files {
    func() {
        fh, err := os.Open(f)
        if err != nil { return }
        defer fh.Close()
        // use fh
    }()
}
```

### panic / recover

```go
func mustParse(s string) int {
    n, err := strconv.Atoi(s)
    if err != nil {
        panic(err) // OK in init / impossible paths; avoid in libs
    }
    return n
}

func safeHandler(h http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if rec := recover(); rec != nil {
                slog.Error("panic", "recover", rec, "stack", string(debug.Stack()))
                http.Error(w, "internal error", 500)
            }
        }()
        h.ServeHTTP(w, r)
    })
}
```

> ⭐ **IMPORTANT CONCEPT:** Prefer `error` returns. `panic` for truly unrecoverable programmer mistakes. Always `recover` at goroutine boundaries (HTTP handlers, workers) so one panic doesn't kill the process.

---

## 11. Errors — Production Patterns

> ⭐ **IMPORTANT CONCEPT:** Errors are values. Wrap with `%w`, inspect with `errors.Is` / `errors.As`. Don't compare strings.

### Sentinel + wrapping

```go
var ErrNotFound = errors.New("not found")

func FindUser(id string) (*User, error) {
    u, err := db.Query(id)
    if err != nil {
        return nil, fmt.Errorf("FindUser id=%s: %w", id, err)
    }
    if u == nil {
        return nil, fmt.Errorf("FindUser id=%s: %w", id, ErrNotFound)
    }
    return u, nil
}

func handler() {
    _, err := FindUser("42")
    if errors.Is(err, ErrNotFound) {
        // 404
        return
    }
    if err != nil {
        // 500
        return
    }
}
```

### Custom error types

```go
type ValidationError struct {
    Field string
    Msg   string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Msg)
}

func parse(req Req) error {
    if req.Email == "" {
        return &ValidationError{Field: "email", Msg: "required"}
    }
    return nil
}

func handle(err error) {
    var ve *ValidationError
    if errors.As(err, &ve) {
        fmt.Println(ve.Field, ve.Msg)
    }
}
```

### Multiple errors (Go 1.20+)

```go
err := errors.Join(err1, err2)
```

### Anti-patterns

```go
// BAD: lose type information
return errors.New(err.Error())

// BAD: panic for expected failure
if err != nil { panic(err) }

// BAD: ignore
_ = rows.Close()

// GOOD
if err := rows.Close(); err != nil {
    return fmt.Errorf("close rows: %w", err)
}
```

---

## 12. Generics

```go
func Map[T any, U any](in []T, f func(T) U) []U {
    out := make([]U, len(in))
    for i, v := range in {
        out[i] = f(v)
    }
    return out
}

func Max[T cmp.Ordered](a, b T) T {
    if a > b {
        return a
    }
    return b
}

type Set[T comparable] map[T]struct{}

func NewSet[T comparable](items ...T) Set[T] {
    s := make(Set[T], len(items))
    for _, x := range items {
        s[x] = struct{}{}
    }
    return s
}

func (s Set[T]) Has(x T) bool {
    _, ok := s[x]
    return ok
}
```

### Constraints

```go
type Number interface {
    ~int | ~int64 | ~float64
}

func Sum[T Number](xs []T) T {
    var total T
    for _, x := range xs {
        total += x
    }
    return total
}
```

> 💡 Don't force generics everywhere — interfaces often clearer for behavior; generics shine for containers/algorithms.

---

## 13. Packages, Modules, init

```text
module example.com/shop

go 1.22

require (
    github.com/jackc/pgx/v5 v5.x
)
```

```go
package users // directory name should match

// Exported: User, New
// unexported: validate

func init() {
    // runs before main, per package; avoid heavy side effects
}
```

### Import cycles — forbidden

```text
package a imports b; b imports a → compile error
Fix: extract shared types to package c, or define interfaces in consumer.
```

---

## 14. Testing Mastery

### Table-driven tests

```go
func TestMax(t *testing.T) {
    tests := []struct {
        name string
        a, b int
        want int
    }{
        {"a bigger", 5, 2, 5},
        {"b bigger", 1, 9, 9},
        {"equal", 3, 3, 3},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := Max(tt.a, tt.b)
            if got != tt.want {
                t.Fatalf("Max(%d,%d)=%d want %d", tt.a, tt.b, got, tt.want)
            }
        })
    }
}
```

### httptest

```go
func TestHandler(t *testing.T) {
    h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprint(w, "ok")
    })
    req := httptest.NewRequest(http.MethodGet, "/", nil)
    rr := httptest.NewRecorder()
    h.ServeHTTP(rr, req)
    if rr.Code != 200 || rr.Body.String() != "ok" {
        t.Fatalf("got %d %q", rr.Code, rr.Body.String())
    }
}
```

### Fuzzing (Go 1.18+)

```go
func FuzzParse(f *testing.F) {
    f.Add("42")
    f.Fuzz(func(t *testing.T, s string) {
        _, _ = strconv.Atoi(s) // must not panic
    })
}
```

### Race + coverage

```bash
go test -race -count=1 ./...
go test -coverprofile=c.out ./... && go tool cover -html=c.out
```

---

## 15. Idiomatic Patterns

### Functional options

```go
type Server struct {
    addr    string
    timeout time.Duration
}

type Option func(*Server)

func WithAddr(a string) Option {
    return func(s *Server) { s.addr = a }
}

func WithTimeout(d time.Duration) Option {
    return func(s *Server) { s.timeout = d }
}

func NewServer(opts ...Option) *Server {
    s := &Server{addr: ":8080", timeout: 5 * time.Second} // defaults
    for _, opt := range opts {
        opt(s)
    }
    return s
}

// usage: NewServer(WithAddr(":9090"), WithTimeout(time.Second))
```

### Constructor + private fields

```go
type Pool struct {
    size int
    // unexported fields force NewPool
}

func NewPool(size int) (*Pool, error) {
    if size <= 0 {
        return nil, errors.New("size must be > 0")
    }
    return &Pool{size: size}, nil
}
```

### Context as first parameter

```go
func (s *Service) Create(ctx context.Context, in CreateInput) (*Order, error)
```

---

## 16. errgroup, singleflight, semaphore

### errgroup — fan-out with cancel

```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) ([][]byte, error) {
    g, ctx := errgroup.WithContext(ctx)
    out := make([][]byte, len(urls))
    for i, u := range urls {
        i, u := i, u
        g.Go(func() error {
            b, err := get(ctx, u)
            if err != nil {
                return err
            }
            out[i] = b
            return nil
        })
    }
    return out, g.Wait() // first error cancels ctx
}
```

### singleflight — coalesce identical work

```go
import "golang.org/x/sync/singleflight"

var group singleflight.Group

func getUser(ctx context.Context, id string) (*User, error) {
    v, err, _ := group.Do(id, func() (any, error) {
        return db.FindUser(ctx, id) // only one in-flight per id
    })
    if err != nil {
        return nil, err
    }
    return v.(*User), nil
}
```

> ⭐ **IMPORTANT CONCEPT:** `singleflight` prevents cache stampede — classic senior interview answer for thundering herd on cache miss.

### semaphore — bound concurrency

```go
import "golang.org/x/sync/semaphore"

sem := semaphore.NewWeighted(10)
for _, job := range jobs {
    if err := sem.Acquire(ctx, 1); err != nil {
        return err
    }
    go func(job Job) {
        defer sem.Release(1)
        process(job)
    }(job)
}
```

---

## 17. LLD in Go — Full Examples

### 17.1 Thread-safe LRU Cache

```go
package lru

import "sync"

type node struct {
    key, val  string
    prev, next *node
}

type Cache struct {
    mu       sync.Mutex
    cap      int
    items    map[string]*node
    head, tail *node // dummy ends of DLL
}

func New(capacity int) *Cache {
    c := &Cache{
        cap:   capacity,
        items: make(map[string]*node, capacity),
        head:  &node{},
        tail:  &node{},
    }
    c.head.next = c.tail
    c.tail.prev = c.head
    return c
}

func (c *Cache) Get(key string) (string, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    n, ok := c.items[key]
    if !ok {
        return "", false
    }
    c.moveToFront(n)
    return n.val, true
}

func (c *Cache) Put(key, val string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if n, ok := c.items[key]; ok {
        n.val = val
        c.moveToFront(n)
        return
    }
    n := &node{key: key, val: val}
    c.items[key] = n
    c.insertFront(n)
    if len(c.items) > c.cap {
        victim := c.tail.prev
        c.remove(victim)
        delete(c.items, victim.key)
    }
}

func (c *Cache) moveToFront(n *node) {
    c.remove(n)
    c.insertFront(n)
}

func (c *Cache) insertFront(n *node) {
    n.next = c.head.next
    n.prev = c.head
    c.head.next.prev = n
    c.head.next = n
}

func (c *Cache) remove(n *node) {
    n.prev.next = n.next
    n.next.prev = n.prev
}
```

> 🛠️ **PRACTICAL:** Add `TTL` expiry and a `Len()` method; write table tests + `-race`.

### 17.2 Token Bucket Rate Limiter

```go
package ratelimit

import (
    "sync"
    "time"
)

type Limiter struct {
    mu         sync.Mutex
    rate       float64 // tokens per second
    burst      float64
    tokens     float64
    last       time.Time
}

func New(rate, burst float64) *Limiter {
    return &Limiter{rate: rate, burst: burst, tokens: burst, last: time.Now()}
}

func (l *Limiter) Allow() bool {
    l.mu.Lock()
    defer l.mu.Unlock()
    now := time.Now()
    elapsed := now.Sub(l.last).Seconds()
    l.last = now
    l.tokens += elapsed * l.rate
    if l.tokens > l.burst {
        l.tokens = l.burst
    }
    if l.tokens < 1 {
        return false
    }
    l.tokens--
    return true
}
```

### 17.3 Worker Pool with Context

```go
package pool

import (
    "context"
    "sync"
)

func Run[T any](ctx context.Context, workers int, jobs <-chan T, fn func(context.Context, T) error) error {
    var wg sync.WaitGroup
    errCh := make(chan error, 1)

    worker := func() {
        defer wg.Done()
        for {
            select {
            case <-ctx.Done():
                return
            case job, ok := <-jobs:
                if !ok {
                    return
                }
                if err := fn(ctx, job); err != nil {
                    select {
                    case errCh <- err:
                    default:
                    }
                    return
                }
            }
        }
    }

    wg.Add(workers)
    for i := 0; i < workers; i++ {
        go worker()
    }

    done := make(chan struct{})
    go func() {
        wg.Wait()
        close(done)
    }()

    select {
    case err := <-errCh:
        return err
    case <-done:
        return nil
    case <-ctx.Done():
        <-done
        return ctx.Err()
    }
}
```

### 17.4 Notification service (Strategy + Observer sketch)

```go
package notify

import "context"

type Channel interface {
    Send(ctx context.Context, userID, body string) error
}

type Email struct{}
func (Email) Send(ctx context.Context, userID, body string) error { /* SMTP */ return nil }

type SMS struct{}
func (SMS) Send(ctx context.Context, userID, body string) error { /* Twilio */ return nil }

type Service struct {
    channels []Channel
}

func (s *Service) Notify(ctx context.Context, userID, body string) error {
    for _, ch := range s.channels {
        if err := ch.Send(ctx, userID, body); err != nil {
            return err
        }
    }
    return nil
}

// Add Push without modifying Email/SMS — just append Channel impl.
```

> ⭐ **IMPORTANT CONCEPT:** In Go LLD, **small interfaces + composition** replace inheritance-heavy Java designs. Name the pattern (Strategy/Decorator) but show Go idioms.

---

## 18. Go vs Java — Interview Contrast

| Topic | Go | Java |
|-------|----|------|
| Concurrency unit | goroutine (~2KB) | thread / virtual thread |
| Inheritance | none — embed + interfaces | class hierarchy |
| Errors | values (`error`) | exceptions |
| Generics | since 1.18 | mature |
| GC pauses | typically sub-ms | G1/ZGC tunable |
| Distribution | static binary | JVM + classpath |
| Nil safety | nil interfaces gotcha | NullPointerException |
| Variance | invariant | wildcards |

**When interviewer asks "why Go for this service?"**
```text
High concurrency networking, simple deploy (one binary), fast compile,
explicit concurrency, small ops footprint — tradeoff: smaller ecosystem
than JVM for some domains, generics still younger.
```

---

## 19. Interview Q&A Bank

### Runtime & concurrency

**Q1. Explain GMP.**  
G=goroutine, M=OS thread, P=logical processor/run queue. M needs P to run G. Work stealing; syscall releases P.

**Q2. Buffered vs unbuffered channel?**  
Unbuffered: sync rendezvous. Buffered: async until full. Capacity 0 vs N.

**Q3. What does `close` do? Who closes?**  
Signals no more sends. Sender closes. Recv from closed → zero, `ok=false`. Double close / close nil → panic. Send on closed → panic.

**Q4. nil channel in select?**  
Ops on nil channel block forever — used to disable a select case.

**Q5. Mutex vs channel?**  
Shared memory + lock for state protection; channel for ownership transfer / pipelines / signaling. Don't be dogmatic.

**Q6. Why WaitGroup.Add before go?**  
Race with Wait — may return before workers start.

**Q7. Detect goroutine leak?**  
`pprof` goroutine profile; leak test with `runtime.NumGoroutine`; always pair spawn with cancel/timeout.

**Q8. Escape analysis?**  
If address leaves stack frame / stored in heap object → heap alloc. `go build -gcflags=-m`.

**Q9. GOGC?**  
Target heap growth percent after GC (default 100). Lower → more GC, less memory; higher → opposite.

**Q10. Happens-before via channel?**  
Send happens-before corresponding receive completes.

### Language

**Q11. Why nil interface bug?**  
Typed nil inside interface ≠ nil interface.

**Q12. Slice vs array?**  
Array fixed size value type; slice header over array.

**Q13. Make vs new?**  
`make` for slice/map/chan (initialized runtime structures). `new(T)` → `*T` zeroed.

**Q14. Pointer vs value receiver?**  
Mutation/large struct → pointer; consistency of method set.

**Q15. How does embedding differ from inheritance?**  
No polymorphism via subclass; promotion of methods; is-a not enforced.

**Q16. errors.Is vs == ?**  
Wrapping breaks `==`; `Is` unwraps chain.

**Q17. Defer in loop?**  
Deferred until function exit — use inner function.

**Q18. Map iteration order?**  
Randomized intentionally.

**Q19. String immutability?**  
Byte sequence immutable; conversion to `[]byte` copies.

**Q20. Comparable map keys?**  
Must support `==`; no slices/maps/funcs as keys.

### Production

**Q21. Graceful shutdown?**  
Signal → `Server.Shutdown(ctx)` → drain → cancel workers.

**Q22. Context timeout on outbound HTTP?**  
`http.NewRequestWithContext`; also set Transport timeouts.

**Q23. Race detector in CI?**  
`go test -race` on PRs; slower but catches heisenbugs.

**Q24. sync.Map when?**  
Read-mostly, key space append-mostly; else Mutex+map.

**Q25. sync.Pool pitfalls?**  
Can be wiped by GC; don't assume persistence; Get may return nil.

---

## 20. Extended Labs

### Lab A — Break then fix (1h)
1. Write program with shared map race; confirm `go run -race` fails.  
2. Fix with `RWMutex`.  
3. Fix cache stampede with `singleflight`.

### Lab B — Slice forensics (45m)
Reproduce shared-backing `append` bug; fix with full slice expression; write tests.

### Lab C — Interface nil (30m)
Reproduce typed-nil `error` bug; write a lint-style test that fails the bad return.

### Lab D — LRU + Rate limiter (2h)
Implement §§17.1–17.2 with table tests and `-race`. Benchmark `Get` with `-benchmem`.

### Lab E — HTTP service (2h)
`net/http` server + middleware (log, recover, request-id) + graceful shutdown from `GoLang-Core.md`. pprof on `:6060`.

### Lab F — Explain cold (ongoing)
Weekly: record 3×2-min talks — GMP, channels vs mutex, escape analysis.

---

## 21. Important Concepts Checklist

### Language
- [ ] Zero values; nil slice vs nil map
- [ ] Slice header; shared backing; full slice expression
- [ ] Map not concurrency-safe; randomized range
- [ ] Pointer vs value receivers + method sets
- [ ] Implicit interfaces; accept interfaces return structs
- [ ] Typed-nil interface / error bug
- [ ] defer LIFO + defer-in-loop trap
- [ ] error wrap `%w` + Is/As
- [ ] Generics for containers; interfaces for behavior
- [ ] Functional options constructors

### Concurrency (also Core file)
- [ ] GMP + work stealing + syscall
- [ ] Channel semantics table (nil/closed/full)
- [ ] select + timeout/cancel patterns
- [ ] Context first arg; never store in struct
- [ ] WaitGroup Add-before-go
- [ ] race detector workflow
- [ ] singleflight for stampede
- [ ] errgroup cancellation

### Production
- [ ] Graceful Shutdown
- [ ] pprof CPU/heap/goroutine
- [ ] slog structured logging
- [ ] Middleware recover
- [ ] http.Transport pooling

### LLD in Go
- [ ] LRU with mutex
- [ ] Token bucket
- [ ] Worker pool + ctx
- [ ] Strategy via small interfaces

> ⭐ **IMPORTANT CONCEPT:** You are "Go-ready" for FAANG when you can implement LRU/worker-pool under a timer, explain GMP without notes, and debug a race with `-race` + pprof.
