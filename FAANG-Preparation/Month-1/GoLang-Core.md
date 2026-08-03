# GoLang Deep Track

> A self-contained, production-oriented handbook for Go 1.22+. Examples use only the standard library unless stated otherwise.

## How to use this handbook

Read Parts I–IV in order, then use the later chapters as a reference. Every chapter follows the same lens: *what it is*, *how it works*, *how it is represented*, *how it fails*, and *how it behaves in production*. Verify version-sensitive runtime details against the Go release notes for the compiler you deploy.

## Table of contents

1. [Introduction and setup](#1-introduction-and-setup)
2. [Program structure, packages, and modules](#2-program-structure-packages-and-modules)
3. [Values: variables, constants, and types](#3-values-variables-constants-and-types)
4. [Control flow and functions](#4-control-flow-and-functions)
5. [Arrays, slices, strings, and maps](#5-arrays-slices-strings-and-maps)
6. [Pointers, structs, methods, and embedding](#6-pointers-structs-methods-and-embedding)
7. [Interfaces, errors, and panics](#7-interfaces-errors-and-panics)
8. [Memory, allocation, and escape analysis](#8-memory-allocation-and-escape-analysis)
9. [Goroutines, scheduler, and context](#9-goroutines-scheduler-and-context)
10. [Channels and concurrency patterns](#10-channels-and-concurrency-patterns)
11. [Locks, atomics, and sync primitives](#11-locks-atomics-and-sync-primitives)
12. [Runtime internals and garbage collection](#12-runtime-internals-and-garbage-collection)
13. [Files, I/O, and serialization](#13-files-io-and-serialization)
14. [Networking: HTTP, APIs, and gRPC](#14-networking-http-apis-and-grpc)
15. [Testing, fuzzing, and benchmarking](#15-testing-fuzzing-and-benchmarking)
16. [Generics and reflection](#16-generics-and-reflection)
17. [Performance and observability](#17-performance-and-observability)
18. [Production engineering](#18-production-engineering)
19. [Design patterns and low-level design](#19-design-patterns-and-low-level-design)
20. [Interview preparation and exercises](#20-interview-preparation-and-exercises)
21. [Cheat sheet](#21-cheat-sheet)
22. [Deep topic atlas](#22-deep-topic-atlas)
23. [Extended production blueprints](#23-extended-production-blueprints)
24. [Design patterns and LLD examples](#24-design-patterns-and-lld-examples)
25. [Large interview bank](#25-large-interview-bank)
26. [Capstone projects](#26-capstone-projects)
27. [1 Cr+ senior Go interview track](#27-1-cr-senior-go-interview-track)

---

## 1. Introduction and setup

Go is a compiled, statically typed language designed around simple composition, fast builds, explicit errors, and inexpensive concurrency. Its toolchain formats (`gofmt`), tests, builds, and documents code consistently.

```bash
go version
mkdir inventory && cd inventory
go mod init example.com/inventory
go run .
go test ./...
go vet ./...
```

```go
// main.go
package main

import "fmt"

func main() { fmt.Println("hello, Go") }
```

The compiler starts at `main.main`, type-checks imports, lowers functions to machine code, and links a single executable. A Go binary normally carries its runtime and GC; cross-compilation is often as simple as `GOOS=linux GOARCH=amd64 go build`.

```
source ──> parser/type checker ──> compiler ──> linker ──> executable
                                                    │
                                                Go runtime
```

**Practice.** Keep `go.mod` committed, run `go fmt ./...` and `go test ./...` in CI, and prefer a supported Go release. Avoid `GOPATH`-era assumptions and vendoring unless your delivery environment needs it.

**Interview check.** *Why does Go favor explicit error returns?* Errors are ordinary values: callers decide whether to retry, translate, log, or return them, avoiding invisible exception control flow.

### Practical setup for serious Go work

A professional Go workspace should make common operations boring.

```bash
go env
go version
go mod tidy
go fmt ./...
go test ./...
go test -race ./...
go vet ./...
go list ./...
```

Recommended local loop:

```text
edit -> gofmt -> focused test -> package test -> race test for concurrency -> commit
```

Important tools:

- `gofmt`: canonical formatting.
- `go test`: tests and benchmarks.
- `go vet`: suspicious code patterns.
- `go test -race`: data race detection.
- `go test -bench`: benchmarks.
- `go tool pprof`: profiling.
- `go doc`: local documentation.

Project start checklist:

- Choose module path.
- Create `cmd/<app>` for executables.
- Keep business logic outside `main`.
- Add a `Makefile` or task runner only if it adds value.
- Add CI for format, test, vet, and race where practical.

Senior interview Q&A:

Q: Why is Go tooling considered a strength?  
A: Formatting, testing, benchmarking, documentation, modules, cross-compilation, and profiling are built into the default toolchain, reducing project-specific ceremony.

Exercise: Create a fresh module with a CLI, a library package, tests, a benchmark, and a small README showing commands.

## 2. Program structure, packages, and modules

A package is a directory of `.go` files with one package name. Identifiers beginning with an upper-case Unicode letter are exported. A module is a versioned collection of packages rooted by `go.mod`.

```go
// user/user.go
package user
type User struct { ID string } // exported type and field
func New(id string) User { return User{ID: id} }
```

```go
import (
    "context"
    "example.com/inventory/user"
)
```

Imports form a directed acyclic graph: import cycles are rejected, which encourages a one-way dependency structure. `internal/` packages may be imported only by code under their parent tree. Put interfaces near their consumers, not automatically beside implementations.

```
cmd/api ──> internal/httpapi ──> internal/service ──> internal/store
                                      │
                                      └──────────────> domain
```

**Pitfalls.** `init()` ordering across files should not be business logic; it obscures dependencies. Do not use `replace` in a released module. Pin direct dependencies with `go get module@version`, review `go mod tidy` diffs, and commit `go.sum`.

### Package design that scales

A good Go package has a clear reason to exist. Avoid packages named only by technical layer if they become junk drawers.

Weak:

```text
helpers
utils
common
models
```

Better:

```text
order
payment
inventory
postgres
httpapi
config
```

Package dependency direction:

```text
cmd/api
  -> internal/httpapi
      -> internal/order
          -> internal/payment
          -> internal/store
```

Rules:

- `main` wires dependencies.
- Transport packages translate HTTP/gRPC into use-case calls.
- Domain/use-case packages own business rules.
- Adapter packages own SQL, Redis, HTTP clients, Kafka, etc.
- Interfaces usually live with consumers.

### `init` and package initialization

Initialization order:

```text
imported packages initialize first
package variables initialize
init functions run
main.main runs
```

Use `init` rarely:

- Registering database drivers.
- Registering metrics collectors.
- Test setup in narrow cases.

Avoid:

- Reading production config.
- Opening DB connections.
- Starting goroutines.
- Doing network calls.

### Modules and versioning

Module commands:

```bash
go get example.com/mod@v1.2.3
go list -m all
go mod why github.com/some/dependency
go mod graph
go mod tidy
```

Semantic import versioning matters for v2+ modules:

```go
import "example.com/lib/v2"
```

Senior interview Q&A:

Q: How do you break an import cycle?  
A: Move shared abstractions downward, define interfaces at the consumer, split packages by dependency direction, or move orchestration to a higher-level package.

Exercise: Take a package cycle and refactor it by moving an interface to the consuming package.

## 3. Values: variables, constants, and types

```go
var n int = 3
short := "inside a function" // inferred
const limit = 10              // untyped constant until context needs a type

type Status string
const ( Pending Status = "pending"; Paid Status = "paid" )
```

Go has booleans, signed/unsigned integers, floats, complexes, strings, pointers, functions, interfaces, maps, channels, slices, arrays, and structs. `int` is word-sized; never use it for a protocol or persisted field whose width matters. Conversions are explicit: `int64(n)`.

Values are copied on assignment and argument passing. A slice, map, channel, pointer, function, and interface value may *refer to* shared storage, so copying its header does not necessarily make data independent.

```go
var zero time.Time // useful zero value
var p *int         // nil
if p != nil { fmt.Println(*p) }
```

**Memory note.** A struct contains its fields inline, with padding for alignment. Field order can affect size; measure with `unsafe.Sizeof` only when memory is demonstrably important. A zero value should be usable where possible.

**Exercise.** Define `type Money int64` in minor units; add methods that reject overflow rather than using `float64` for currency.

### Type system essentials

Defined type:

```go
type UserID string
```

Alias:

```go
type MyString = string
```

Defined types create a new type identity. Aliases do not.

```go
type Celsius float64
type Fahrenheit float64

func Convert(c Celsius) Fahrenheit {
    return Fahrenheit(c*9/5 + 32)
}
```

This prevents mixing units accidentally.

### Zero value design

Good zero values are usable:

```go
var b bytes.Buffer
b.WriteString("hello")

var mu sync.Mutex
mu.Lock()
mu.Unlock()
```

Bad zero value design:

```go
type Client struct {
    baseURL string
}

func (c Client) Get() error {
    // empty baseURL fails later in confusing way
}
```

Use a constructor when invariants are required.

```go
func NewClient(baseURL string) (*Client, error) {
    if baseURL == "" {
        return nil, errors.New("baseURL required")
    }
    return &Client{baseURL: baseURL}, nil
}
```

### Constants and enums

```go
type OrderStatus string

const (
    OrderPending OrderStatus = "pending"
    OrderPaid    OrderStatus = "paid"
    OrderFailed  OrderStatus = "failed"
)

func (s OrderStatus) Valid() bool {
    switch s {
    case OrderPending, OrderPaid, OrderFailed:
        return true
    default:
        return false
    }
}
```

Interview Q&A:

Q: Why use domain-specific types like `UserID`?  
A: They document intent, prevent accidental mixing, and allow methods/validation around domain values.

Exercise: Implement `OrderStatus` with validation, JSON unmarshalling, and tests for invalid values.

## 4. Control flow and functions

```go
func Clamp(x, lo, hi int) int {
    if x < lo { return lo }
    if x > hi { return hi }
    return x
}

for i := 0; i < 3; i++ { fmt.Println(i) }
for _, r := range "Go" { fmt.Printf("%c\n", r) }

switch day := time.Now().Weekday(); day {
case time.Saturday, time.Sunday: fmt.Println("weekend")
default: fmt.Println("weekday")
}
```

`if` and `switch` can include a short initialization. `defer` schedules a call when the surrounding function returns; its arguments are evaluated immediately. Use it for paired cleanup, but remember it runs after a return value is assigned and can add cost in hot loops.

```go
func read(path string) (_ []byte, err error) {
    f, err := os.Open(path); if err != nil { return nil, err }
    defer func() { err = errors.Join(err, f.Close()) }()
    return io.ReadAll(f)
}
```

Named returns are useful for a small deferred error join, not as default style. Go lacks `while`: `for condition {}` is the while loop. No implicit fallthrough exists in a `switch`; use `fallthrough` rarely.

### Function design

Prefer functions that make ownership and errors clear.

```go
func ParseUserID(s string) (UserID, error) {
    if s == "" {
        return "", errors.New("empty user id")
    }
    return UserID(s), nil
}
```

Return values should tell the caller what happened:

```go
func FindUser(ctx context.Context, id UserID) (User, bool, error)
```

This can be useful when “not found” is not exceptional. In many production APIs, a sentinel error is better because it composes through layers:

```go
var ErrNotFound = errors.New("not found")
```

### Defer details

Arguments are evaluated immediately:

```go
func main() {
    x := 1
    defer fmt.Println(x)
    x = 2
}
```

Prints `1`.

Deferred closures capture variables:

```go
func main() {
    x := 1
    defer func() { fmt.Println(x) }()
    x = 2
}
```

Prints `2`.

### Loops and range

Range behavior:

```go
for i, v := range xs {
    fmt.Println(i, v)
}
```

`v` is a copy of the element. To mutate, use index:

```go
for i := range xs {
    xs[i].Active = true
}
```

### Practical patterns

Guard clauses keep Go readable:

```go
func CreateOrder(ctx context.Context, cmd CreateOrder) (Order, error) {
    if len(cmd.Items) == 0 {
        return Order{}, ErrInvalid
    }
    if err := validateUser(ctx, cmd.UserID); err != nil {
        return Order{}, err
    }
    return buildOrder(cmd), nil
}
```

Interview Q&A:

Q: When are named return values useful?  
A: For small functions where names clarify meaning, or when a deferred closure needs to modify the returned error. Avoid using them as a default habit.

Exercise: Write a function that opens two files, copies data, and correctly joins close errors with operation errors.

## 5. Arrays, slices, strings, and maps

### Arrays and slices

An array’s length is part of its type (`[3]int`); arrays copy on assignment. A slice is a small descriptor over an array.

```
slice header                 backing array
data ────────────────┐       [ 10 | 20 | 30 | 40 ]
len: 2               │         ^         ^
cap: 4               └─────────┘         └─ capacity end
```

```go
s := []int{10, 20, 30}
s = append(s, 40)              // may allocate a new backing array
view := s[1:3]                 // shares backing storage
clone := append([]int(nil), s...)
for i := range s { s[i] *= 2 } // mutate by index
```

Appending beyond capacity reallocates and copies; never retain assumptions about an old slice alias after append. A tiny view can retain a huge backing array: copy the required bytes if the source should be released. `clear(s)` zeroes elements; it does not change length.

### Strings and maps

A string is immutable bytes, usually UTF-8. `len` counts bytes; `range` decodes runes. Invalid UTF-8 is replaced with `RuneError` during ranging.

```go
for i, r := range "café" { fmt.Println(i, r) }
parts := strings.Fields("  hello  go ")

m := map[string]int{"open": 1}
v, ok := m["missing"] // zero value plus presence flag
m["open"]++
delete(m, "open")
```

Maps are hash tables managed by the runtime. Their iteration order is deliberately unspecified; sort keys for deterministic output. Map reads are safe concurrently only when **no goroutine writes**. A nil map can be read but panics on assignment; allocate with `make`.

**Interview check.** *Why is `for _, v := range s { &v }` dangerous?* `v` is the per-iteration value copy; take `&s[i]` when you need the element’s address. Current Go gives range variables per-iteration scope, but `v` is still a copy.

### Slice operations in practice

Clone:

```go
copyOfS := append([]T(nil), s...)
```

Delete without preserving order:

```go
s[i] = s[len(s)-1]
s[len(s)-1] = zero
s = s[:len(s)-1]
```

Delete preserving order:

```go
copy(s[i:], s[i+1:])
s[len(s)-1] = zero
s = s[:len(s)-1]
```

Insert:

```go
s = append(s, zero)
copy(s[i+1:], s[i:])
s[i] = v
```

Memory hygiene matters when elements contain pointers:

```go
var zero T
s[len(s)-1] = zero
```

### Map patterns

Set:

```go
type Set[T comparable] map[T]struct{}
```

Counting:

```go
counts[word]++
```

Group by:

```go
groups[key] = append(groups[key], item)
```

Deterministic output:

```go
keys := make([]string, 0, len(m))
for k := range m {
    keys = append(keys, k)
}
sort.Strings(keys)
for _, k := range keys {
    fmt.Println(k, m[k])
}
```

### String building

```go
var b strings.Builder
b.Grow(128)
for _, part := range parts {
    b.WriteString(part)
}
out := b.String()
```

Use `bytes.Buffer` for bytes and `strings.Builder` for strings.

Interview Q&A:

Q: Why can appending to one slice modify another?  
A: They may share the same backing array.

Q: Why is map iteration order random?  
A: The runtime deliberately does not guarantee order, which prevents code from depending on implementation details.

Exercises:

1. Implement slice delete preserving order and not preserving order.
2. Build deterministic JSON output from a map by sorting keys.
3. Write a function that safely returns the first 1KB of a huge byte slice without retaining the original.

## 6. Pointers, structs, methods, and embedding

```go
type Counter struct { n int }
func (c *Counter) Inc() { c.n++ }
func (c Counter) Value() int { return c.n }

type Logger struct{}
func (Logger) Log(s string) { fmt.Println(s) }
type Service struct { Logger; name string } // promoted Log method
```

Use a pointer receiver when mutation is intended, copying is costly, or the type contains a lock. Keep receiver choice consistent: mixing pointer and value receivers changes method sets. The compiler may automatically take an address for an addressable value (`c.Inc()`), but an interface assignment does not gain missing pointer methods.

Embedding is composition, not inheritance. `Service` has a `Logger`; it is not a `Logger`. Prefer explicit fields when promotion would make ownership unclear.

```
Counter value                  *Counter
[ n: 5 ]                ───>   [ n: 5 ]
copied on assignment            shared mutable object
```

**Pitfall.** Never copy a `sync.Mutex` after first use; therefore a struct containing one should almost always have pointer methods.

### Pointer fundamentals

A pointer stores the address of a value.

```go
x := 10
p := &x
*p = 20
fmt.Println(x) // 20
```

Nil pointers must be checked before dereference:

```go
var u *User
if u != nil {
    fmt.Println(u.Name)
}
```

Use pointers when identity or mutation matters. Do not use pointers everywhere by default; value types often produce simpler and faster code.

### Struct design

Constructor with invariants:

```go
type Email string

func NewEmail(s string) (Email, error) {
    if !strings.Contains(s, "@") {
        return "", errors.New("invalid email")
    }
    return Email(strings.ToLower(s)), nil
}
```

Avoid public fields when they can break invariants:

```go
type Account struct {
    balance int64
}

func (a *Account) Deposit(n int64) error {
    if n <= 0 {
        return errors.New("amount must be positive")
    }
    a.balance += n
    return nil
}
```

### Method receiver decision

Use pointer receiver:

- Method mutates receiver.
- Receiver is large.
- Receiver contains a lock.
- Receiver has identity.
- Consistency requires all methods to use pointer.

Use value receiver:

- Receiver is small.
- Receiver is immutable.
- Method returns derived data.
- Copy semantics are desirable.

### Embedding pitfalls

Embedding can accidentally expose methods.

```go
type DB struct{}
func (DB) DropAllTables() {}

type Service struct {
    DB
}
```

Now `Service` exposes `DropAllTables`. Prefer named fields when promotion is risky.

```go
type Service struct {
    db DB
}
```

Interview Q&A:

Q: Why should a struct with `sync.Mutex` usually use pointer receivers?  
A: Copying the struct copies the mutex, which is invalid after use and can break synchronization.

Q: Is embedding inheritance?  
A: No. It is composition with promoted fields/methods.

Exercises:

1. Build an immutable `Money` struct with methods for add/subtract.
2. Create a struct with a mutex and demonstrate why copying it is dangerous.
3. Refactor an embedded dependency into an explicit named field.

## 7. Interfaces, errors, and panics

An interface is satisfied implicitly by a method set. Keep interfaces small and behavior-shaped.

```go
type Reader interface { Read([]byte) (int, error) }
type UserStore interface { Find(context.Context, string) (User, error) }

var ErrNotFound = errors.New("user not found")
func lookup(id string) error { return fmt.Errorf("lookup %q: %w", id, ErrNotFound) }
if errors.Is(lookup("42"), ErrNotFound) { /* map to 404 */ }
```

Conceptually, an interface holds a dynamic type and dynamic value:

```
interface value
[ type metadata | data pointer/value ]
```

An interface is nil only if both are absent. This surprises code that returns a typed nil pointer as `error`; return literal `nil` when there is no error. Use type assertions with the comma-ok form or type switches at boundaries.

```go
if s, ok := v.(fmt.Stringer); ok { fmt.Println(s.String()) }
```

Errors are expected operational failures. Wrap with context using `%w`; callers can use `errors.Is` and `errors.As`. `panic` signals broken invariants or unrecoverable startup failure, not invalid request input. A `recover` belongs at a process boundary (for example HTTP middleware), where it logs a stack and returns a safe response.

### Interface fundamentals

An interface describes behavior. A concrete type implements an interface implicitly when its method set contains the required methods.

```go
type Notifier interface {
    Notify(context.Context, Message) error
}

type EmailNotifier struct {
    client *http.Client
}

func (e *EmailNotifier) Notify(ctx context.Context, msg Message) error {
    return sendEmail(ctx, e.client, msg)
}
```

No `implements` keyword is required. This is structural typing.

```text
interface requirement:
  Notify(context.Context, Message) error

concrete type:
  EmailNotifier has Notify(context.Context, Message) error

result:
  EmailNotifier implements Notifier
```

Best practice:

- Keep interfaces small.
- Define interfaces where they are consumed.
- Accept interfaces when useful.
- Return concrete types from constructors.
- Do not create interfaces only because “testing may need it someday.”

### Method sets

Method sets matter for interface satisfaction.

```go
type Counter struct {
    n int
}

func (c Counter) Value() int {
    return c.n
}

func (c *Counter) Inc() {
    c.n++
}
```

Method sets:

```text
Counter  has: Value
*Counter has: Value, Inc
```

So:

```go
type Incrementer interface {
    Inc()
}

var c Counter
// var _ Incrementer = c  // does not compile
var _ Incrementer = &c    // ok
```

Interview point: values can call pointer receiver methods when addressable, but interface satisfaction still follows method sets.

### Interface value internals

Conceptually:

```text
interface value
+----------------+----------------+
| dynamic type   | dynamic value  |
+----------------+----------------+
```

For non-empty interfaces, the runtime also needs method table information. You do not usually need the exact internal structure, but you must understand the dynamic type/value pair.

Typed nil problem:

```go
type AppError struct {
    Message string
}

func (e *AppError) Error() string {
    return e.Message
}

func bad() error {
    var err *AppError = nil
    return err
}

func main() {
    if bad() != nil {
        fmt.Println("non-nil error")
    }
}
```

Why?

```text
error interface:
  dynamic type  = *AppError
  dynamic value = nil

interface itself is not nil
```

Correct:

```go
func good() error {
    var err *AppError = nil
    if err == nil {
        return nil
    }
    return err
}
```

### Type assertions and type switches

Use comma-ok form:

```go
if s, ok := v.(fmt.Stringer); ok {
    fmt.Println(s.String())
}
```

Avoid panic form unless you are certain:

```go
s := v.(string) // panics if v is not string
```

Type switch:

```go
func Format(v any) string {
    switch x := v.(type) {
    case nil:
        return "<nil>"
    case string:
        return x
    case fmt.Stringer:
        return x.String()
    case error:
        return x.Error()
    default:
        return fmt.Sprintf("%v", x)
    }
}
```

Use type switches at boundaries: decoding, logging, adapters, CLI formatting. Avoid using them as a replacement for good domain modeling.

### Empty interface and `any`

`any` is an alias for `interface{}`.

```go
func Print(v any) {
    fmt.Println(v)
}
```

Use `any` when the value is truly dynamic:

- JSON-like arbitrary data.
- Logging fields.
- Generic containers before type parameters are possible.
- Reflection boundaries.

Avoid `any` when a real type or small interface communicates intent better.

Bad:

```go
func Save(ctx context.Context, data any) error
```

Better:

```go
func SaveOrder(ctx context.Context, order Order) error
```

### Designing interfaces for production

Good interface:

```go
type UserFinder interface {
    FindUser(context.Context, UserID) (User, error)
}
```

Bad interface:

```go
type UserRepository interface {
    Create(context.Context, User) error
    Update(context.Context, User) error
    Delete(context.Context, UserID) error
    Find(context.Context, UserID) (User, error)
    FindByEmail(context.Context, string) (User, error)
    List(context.Context, Filter) ([]User, error)
    Count(context.Context, Filter) (int, error)
}
```

The large interface may be appropriate inside a package, but it is often too broad for consumers. A service that only needs `FindByEmail` should not depend on everything.

Consumer-owned interface:

```go
type RegisterService struct {
    users interface {
        FindByEmail(context.Context, string) (User, error)
        Save(context.Context, User) error
    }
}
```

### Error fundamentals

An error is any value implementing:

```go
type error interface {
    Error() string
}
```

Sentinel error:

```go
var ErrNotFound = errors.New("not found")
```

Typed error:

```go
type ValidationError struct {
    Field string
    Rule  string
}

func (e ValidationError) Error() string {
    return e.Field + ": " + e.Rule
}
```

Wrapping:

```go
func LoadUser(ctx context.Context, id UserID) (User, error) {
    user, err := store.Find(ctx, id)
    if err != nil {
        return User{}, fmt.Errorf("load user %s: %w", id, err)
    }
    return user, nil
}
```

Check:

```go
if errors.Is(err, ErrNotFound) {
    return http.StatusNotFound
}

var ve ValidationError
if errors.As(err, &ve) {
    return http.StatusBadRequest
}
```

### Error design by layer

```text
database layer:
  translates driver errors into storage/domain errors

service layer:
  adds use-case context and preserves matchable errors

transport layer:
  maps errors to HTTP/gRPC responses

boundary:
  logs once with request metadata
```

Example:

```go
func (h Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    user, err := h.svc.GetUser(r.Context(), parseID(r))
    if err != nil {
        h.writeError(w, r, err)
        return
    }
    writeJSON(w, http.StatusOK, user)
}

func (h Handler) writeError(w http.ResponseWriter, r *http.Request, err error) {
    status := http.StatusInternalServerError
    code := "internal"

    switch {
    case errors.Is(err, ErrNotFound):
        status = http.StatusNotFound
        code = "not_found"
    case errors.Is(err, ErrInvalid):
        status = http.StatusBadRequest
        code = "invalid"
    }

    h.logger.Error("request failed",
        "path", r.URL.Path,
        "status", status,
        "err", err,
    )

    writeJSON(w, status, map[string]string{"error": code})
}
```

### `errors.Join`

Use `errors.Join` when multiple errors are relevant.

```go
func CloseAll(closers ...io.Closer) error {
    var errs []error
    for _, c := range closers {
        if err := c.Close(); err != nil {
            errs = append(errs, err)
        }
    }
    return errors.Join(errs...)
}
```

`errors.Is` and `errors.As` work through joined errors.

### Panic and recover

`panic` is for broken invariants and unrecoverable programmer errors, not normal invalid input.

Good panic:

```go
func MustParseTemplate(s string) *template.Template {
    t, err := template.New("x").Parse(s)
    if err != nil {
        panic(err)
    }
    return t
}
```

Bad panic:

```go
func CreateUser(email string) User {
    if email == "" {
        panic("email required") // bad for normal user input
    }
    return User{Email: email}
}
```

Use error:

```go
func CreateUser(email string) (User, error) {
    if email == "" {
        return User{}, ErrInvalid
    }
    return User{Email: email}, nil
}
```

Recover at boundaries:

```go
func Recover(next http.Handler, logger *slog.Logger) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if v := recover(); v != nil {
                logger.Error("panic recovered",
                    "panic", v,
                    "path", r.URL.Path,
                    "stack", string(debug.Stack()),
                )
                http.Error(w, "internal error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

Recover only works inside a deferred function in the same goroutine.

### Common problems

Problem: giant interfaces.

Fix:

- Split by consumer need.
- Keep interface methods behavior-focused.
- Accept concrete types inside a package when abstraction adds no value.

Problem: losing error context.

Bad:

```go
if err != nil {
    return err
}
```

Better:

```go
if err != nil {
    return fmt.Errorf("create order: %w", err)
}
```

Problem: logging too much.

Bad:

```go
logger.Error("db failed", "err", err)
return fmt.Errorf("save user: %w", err)
```

If every layer logs, one failure becomes noisy. Prefer wrapping inside and logging at a boundary.

### Interview Q&A

Q: How does Go implement polymorphism?  
A: Through interfaces satisfied implicitly by method sets.

Q: Why should interfaces be small?  
A: Small interfaces reduce coupling and make consumers depend only on behavior they need.

Q: What is the typed nil error problem?  
A: Returning a nil concrete pointer as an error creates a non-nil interface because the dynamic type is present.

Q: Difference between `errors.Is` and `errors.As`?  
A: `Is` checks whether an error matches a target. `As` extracts an error of a specific type.

Q: When should you use panic?  
A: For broken invariants, impossible programmer errors, or startup failure where continuing is unsafe.

Exercises:

1. Refactor a large repository interface into consumer-owned interfaces.
2. Create a typed validation error and map it to HTTP 400 using `errors.As`.
3. Reproduce the typed nil error bug and fix it.
4. Write panic recovery middleware with stack logging.
5. Build an error mapping layer for REST and gRPC responses.

## 8. Memory, allocation, and escape analysis

Each goroutine begins with a small growable stack. The compiler decides whether a value can remain on a stack or must escape to the heap; this is a correctness optimization, not a promise about source-level `new`.

```go
func local() int { x := 7; return x } // normally stack
func escapes() *int { x := 7; return &x } // x outlives frame: heap candidate
```

```
goroutine stack                 heap
[ frame: x=7 ]     ──address──> [ x=7 ]
                                     │
                                  traced by GC
```

Inspect decisions with `go build -gcflags='-m=2'`; treat output as a diagnostic, not a target. Interface conversions, closures, unknown calls, and returned addresses can lead to escape. Heap allocation is often fine; reduce allocations only after profiling. `new(T)` returns `*T`; `make` initializes slices/maps/channels.

**Best practices.** Avoid `unsafe` except for constrained interop or measured low-level work. Do not store `uintptr` as a long-lived object reference—the GC does not treat it as a pointer.

### Memory model at a practical level

Go memory is not something you manually free, but you still design object lifetime.

Important areas:

```text
stack: function frames for each goroutine
heap: objects that outlive stack frames or cannot be proven local
globals: package-level variables
runtime memory: scheduler, timers, channels, maps, metadata
```

Each goroutine has its own stack.

```text
goroutine A stack       goroutine B stack
  handler frame           worker frame
  local variables         local variables
       |                       |
       v                       v
       shared heap objects if referenced
```

The garbage collector traces reachable heap objects. It does not know your business intent. If something is still reachable through a map, slice, goroutine, global, or closure, it stays alive.

### Stack versus heap

Stack allocation is cheap because it is tied to function calls. Heap allocation is more flexible but requires GC management.

```go
func StackCandidate() User {
    u := User{Name: "A"}
    return u
}

func HeapCandidate() *User {
    u := User{Name: "A"}
    return &u
}
```

But source shape alone does not guarantee placement. The compiler decides.

```text
source code -> escape analysis -> stack or heap decision
```

### Escape analysis

Escape analysis asks: can this value be safely kept inside the current stack frame, or might it be needed after the frame returns?

Common escape causes:

- Returning a pointer to a local variable.
- Storing a value in an interface.
- Capturing variables in closures that outlive the frame.
- Appending to a slice whose backing array must outlive the frame.
- Passing values to functions the compiler cannot analyze.
- Sharing values with goroutines.

Example:

```go
func MakeReader(data []byte) io.Reader {
    return bytes.NewReader(data) // returned as interface; may escape
}
```

Closure escape:

```go
func Counter() func() int {
    n := 0
    return func() int {
        n++
        return n
    }
}
```

`n` must live after `Counter` returns.

Goroutine escape:

```go
func Start() {
    msg := "hello"
    go func() {
        fmt.Println(msg)
    }()
}
```

The goroutine may run after `Start` returns, so captured data may escape.

Inspect:

```bash
go build -gcflags="-m=2" ./...
```

Read output as hints, not as a goal. Correctness and clarity come first.

### `new` versus `make`

`new(T)` allocates zero value of `T` and returns `*T`.

```go
p := new(User)
p.Name = "A"
```

`make` initializes slices, maps, and channels.

```go
xs := make([]int, 0, 100)
m := make(map[string]int, 100)
ch := make(chan Job, 10)
```

Interview point: `new` does not necessarily mean heap allocation. The compiler can keep it on stack if it does not escape.

### Value versus pointer

Use values when:

- The value is small.
- It is immutable or copied intentionally.
- You want better locality.
- You want to reduce heap allocation and GC scanning.

Use pointers when:

- You need mutation.
- The value is large and copying is expensive.
- The value has identity.
- The type contains sync primitives and must not be copied.
- You need optional nil.

Example:

```go
type Money struct {
    Currency string
    Cents    int64
}

func (m Money) Add(other Money) (Money, error) {
    if m.Currency != other.Currency {
        return Money{}, errors.New("currency mismatch")
    }
    return Money{Currency: m.Currency, Cents: m.Cents + other.Cents}, nil
}
```

`Money` is a good value type.

### Struct layout and alignment

Fields are aligned for CPU access. Field order can change struct size.

```go
type A struct {
    Flag bool
    N    int64
    Code bool
}

type B struct {
    N    int64
    Flag bool
    Code bool
}
```

Concept:

```text
A: bool + padding + int64 + bool + padding
B: int64 + bool + bool + padding
```

Measure:

```go
fmt.Println(unsafe.Sizeof(A{}))
fmt.Println(unsafe.Sizeof(B{}))
```

Do not contort business structs prematurely. This matters more in millions of objects or hot memory paths.

### Slice memory retention

Slice header:

```text
data pointer | len | cap
```

Problem:

```go
func ReadHeader(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    return data[:128], nil // whole file stays alive
}
```

Fix:

```go
func ReadHeader(path string) ([]byte, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }
    n := min(128, len(data))
    out := make([]byte, n)
    copy(out, data[:n])
    return out, nil
}
```

This is a common senior interview memory question.

### Map memory behavior

Maps grow and maintain buckets internally. Deleting keys does not always immediately return memory to the OS.

```go
for k := range m {
    delete(m, k)
}
```

If a map had a huge peak and will remain mostly empty, create a new map:

```go
m = make(map[string]Value, expectedSize)
```

Maps also retain values as long as keys remain. Caches need bounds.

### Interface allocation behavior

Storing concrete values into interfaces can cause boxing.

```go
func Log(v any) {
    fmt.Println(v)
}
```

This is fine in normal code. In hot paths, interface conversion may allocate depending on value and escape.

Senior answer:

```text
I do not avoid interfaces everywhere. I check benchmark allocation output first.
If interface boxing appears in a hot path, I consider generics, concrete functions,
or changing ownership.
```

### Reducing allocations practically

Preallocate:

```go
out := make([]DTO, 0, len(users))
for _, u := range users {
    out = append(out, toDTO(u))
}
```

Reuse builders:

```go
var b strings.Builder
b.Grow(128)
b.WriteString("user:")
b.WriteString(id)
return b.String()
```

Avoid repeated conversions:

```go
// Bad if repeated in hot loop
key := string(bytesKey)
```

Stream instead of buffering:

```go
if _, err := io.Copy(w, r); err != nil {
    return err
}
```

Use `sync.Pool` only after profiling:

```go
var pool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
```

### Unsafe and uintptr

`unsafe.Pointer` bypasses type safety. `uintptr` is an integer, not a GC-tracked pointer.

Danger:

```go
addr := uintptr(unsafe.Pointer(p))
// GC does not treat addr as keeping p alive
```

Use `unsafe` only for:

- Low-level library work.
- Interop.
- Measured performance cases.
- Code with tight tests and comments explaining invariants.

### Memory debugging workflow

Scenario: memory keeps growing.

Steps:

```text
1. Check RSS, heap in-use, allocation rate, goroutine count.
2. Capture heap profile.
3. Capture goroutine profile.
4. Compare before/after load.
5. Identify retaining paths.
6. Look for caches, maps, slices, goroutines, globals.
7. Fix ownership or bounds.
8. Verify with the same workload.
```

Commands:

```bash
go test -bench . -benchmem ./...
go test -run '^$' -bench . -memprofile mem.out ./pkg
go tool pprof mem.out
go tool pprof http://localhost:6060/debug/pprof/heap
```

### Interview Q&A

Q: What is escape analysis?  
A: Compiler analysis that decides whether a value can stay on the stack or must move to the heap.

Q: Does returning a pointer always mean bad performance?  
A: No. It may be correct and cheap enough. Measure if it is in a hot path.

Q: Why can a small slice retain a large array?  
A: The slice header points into the backing array, so the whole array remains reachable.

Q: Why can pointer-heavy code be slower?  
A: More heap objects, more GC scan work, more indirection, and worse cache locality.

Q: What does `allocs/op` tell you?  
A: How many heap allocations happen per benchmark operation.

Exercises:

1. Write two constructors, one returning value and one returning pointer; inspect escape output.
2. Create a large slice retention bug and prove it with a heap profile.
3. Reorder struct fields and measure size.
4. Benchmark `strings.Builder` versus repeated `+` concatenation.
5. Reduce allocations in a JSON transformation function and compare `benchmem`.

## 9. Goroutines, scheduler, and context

`go f()` starts a lightweight goroutine. The runtime multiplexes goroutines (G) on operating-system threads (M) through logical processors (P). `GOMAXPROCS` determines available P values and defaults to an environment-aware runtime value.

```
G1 G2 G3 ── runnable queues ──> P0 ──> M0 ──> OS thread
                                  P1 ──> M1 ──> OS thread
```

```go
func fetch(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    if err != nil { return nil, err }
    resp, err := http.DefaultClient.Do(req); if err != nil { return nil, err }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body)
}
```

Pass `context.Context` as the first parameter; do not store it in structs. Use `WithTimeout`/`WithCancel`, call the returned cancel function, and select on `ctx.Done()` in blocking work. Context carries cancellation/deadlines/request-scoped metadata, not optional function parameters or service dependencies.

**Leak rule.** Every goroutine must have a bounded lifetime and an owner responsible for cancellation and waiting.

### Goroutine lifecycle in real systems

A goroutine should not be treated as “fire and forget.” In production Go, every goroutine needs a lifecycle contract.

```text
created -> runnable -> running -> blocked/waiting -> runnable -> exit
```

For every goroutine, answer:

- Who starts it?
- Who cancels it?
- Who waits for it?
- What resources does it hold?
- Can it block forever?
- What happens during shutdown?
- Is its concurrency bounded?

Bad pattern:

```go
func handler(w http.ResponseWriter, r *http.Request) {
    go sendEmail(r.Context(), "user@example.com")
    w.WriteHeader(http.StatusAccepted)
}
```

Why this is dangerous:

- The request context may be canceled as soon as handler returns.
- The goroutine is not awaited.
- Failure is not observed.
- During shutdown, this work may be abandoned.

Better pattern: put background work into a managed queue.

```go
type EmailQueue interface {
    Enqueue(context.Context, EmailJob) error
}

func handler(q EmailQueue) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        job := EmailJob{To: "user@example.com"}
        if err := q.Enqueue(r.Context(), job); err != nil {
            http.Error(w, "enqueue failed", http.StatusServiceUnavailable)
            return
        }
        w.WriteHeader(http.StatusAccepted)
    }
}
```

### Scheduler deep theory

The Go scheduler maps many goroutines onto fewer OS threads.

```text
G = goroutine
M = OS thread
P = processor token needed to execute Go code

G local queue -> P -> M -> CPU
```

Important concepts:

- A P owns a local run queue.
- Idle P values can steal work from other P queues.
- `GOMAXPROCS` controls how many P values can run Go code at once.
- Goroutines blocked on channels or mutexes are parked.
- Network operations use the runtime netpoller when possible.
- Blocking syscalls may cause the runtime to create or reuse another M.
- Goroutine stacks start small and grow dynamically.

Useful mental model:

```text
goroutines are cheap to create
but not free to schedule, stack, retain, debug, or coordinate
```

### Context deep theory

`context.Context` is for cancellation, deadlines, and request-scoped values.

```go
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
defer cancel()
```

Context tree:

```text
root context
  -> request context
      -> database timeout context
      -> external API timeout context
      -> worker subtask context
```

Canceling a parent cancels children. Canceling a child does not cancel the parent.

Correct function shape:

```go
func LoadUser(ctx context.Context, id string) (User, error) {
    row := db.QueryRowContext(ctx, "select id, email from users where id=$1", id)
    return scanUser(row)
}
```

Wrong uses:

- Passing `nil` context.
- Storing context in a struct for long-term use.
- Using context values for optional parameters.
- Creating `context.Background()` inside request work.
- Ignoring `ctx.Done()` in loops.

### Cancellable loop pattern

```go
func Poll(ctx context.Context, interval time.Duration, fn func(context.Context) error) error {
    ticker := time.NewTicker(interval)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-ticker.C:
            if err := fn(ctx); err != nil {
                return err
            }
        }
    }
}
```

### Goroutine leak debugging

Symptoms:

- Goroutine count keeps rising.
- Memory grows because goroutines retain references.
- Shutdown hangs.
- Profiles show many goroutines stuck on channel send/receive.

Tools:

```bash
curl http://localhost:6060/debug/pprof/goroutine?debug=2
go tool pprof http://localhost:6060/debug/pprof/goroutine
go tool trace trace.out
```

Common stuck states:

```text
chan send
chan receive
select
sync.Mutex.Lock
IO wait
semacquire
```

Interview Q&A:

Q: Why is “fire and forget” dangerous in Go?  
A: Because the goroutine may outlive its owner, leak resources, hide errors, ignore shutdown, or block forever.

Q: What does `GOMAXPROCS` control?  
A: The number of P values, which bounds the number of goroutines executing Go code simultaneously.

Q: Does context cancellation stop a DB query?  
A: It can if the driver and method support context, such as `QueryContext`; otherwise the code must cooperate.

Exercises:

1. Write a managed background worker that starts on service boot and exits on shutdown.
2. Create a goroutine leak intentionally, capture a goroutine profile, then fix it.
3. Implement request fan-out to three services with context cancellation and bounded concurrency.
4. Write tests proving a loop stops when context is canceled.

### Request fan-out pattern

Fan-out is common in senior Go interviews: one request needs data from multiple dependencies.

Bad:

```go
func LoadDashboard(ctx context.Context, userID string) (Dashboard, error) {
    profileCh := make(chan Profile)
    ordersCh := make(chan []Order)

    go func() { profileCh <- loadProfile(ctx, userID) }()
    go func() { ordersCh <- loadOrders(ctx, userID) }()

    return Dashboard{
        Profile: <-profileCh,
        Orders:  <-ordersCh,
    }, nil
}
```

Problems:

- No error handling.
- Sends can block if caller returns early.
- No cancellation on first failure.
- No timeout per dependency.

Better:

```go
func LoadDashboard(ctx context.Context, userID string) (Dashboard, error) {
    ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
    defer cancel()

    var (
        profile Profile
        orders  []Order
    )

    g, ctx := errgroup.WithContext(ctx)

    g.Go(func() error {
        p, err := loadProfile(ctx, userID)
        if err != nil {
            return fmt.Errorf("load profile: %w", err)
        }
        profile = p
        return nil
    })

    g.Go(func() error {
        o, err := loadOrders(ctx, userID)
        if err != nil {
            return fmt.Errorf("load orders: %w", err)
        }
        orders = o
        return nil
    })

    if err := g.Wait(); err != nil {
        return Dashboard{}, err
    }

    return Dashboard{Profile: profile, Orders: orders}, nil
}
```

Notes:

- `errgroup` cancels sibling work on first error.
- Each dependency receives the derived context.
- Variables are written by separate goroutines and read after `Wait`, which is safe because `Wait` synchronizes completion.

### Bounded fan-out

When input is large, do not start one goroutine per item.

```go
func EnrichUsers(ctx context.Context, users []User, limit int) ([]User, error) {
    if limit <= 0 {
        return nil, errors.New("limit must be positive")
    }

    out := make([]User, len(users))
    sem := make(chan struct{}, limit)
    g, ctx := errgroup.WithContext(ctx)

    for i, user := range users {
        i, user := i, user

        select {
        case sem <- struct{}{}:
        case <-ctx.Done():
            return nil, ctx.Err()
        }

        g.Go(func() error {
            defer func() { <-sem }()

            enriched, err := enrichUser(ctx, user)
            if err != nil {
                return err
            }
            out[i] = enriched
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }
    return out, nil
}
```

Senior discussion:

- Limit should reflect dependency capacity.
- Preserves order by writing to `out[i]`.
- Each goroutine writes a unique index, avoiding data race on element.
- The slice header is shared but not mutated concurrently.

### Service-level worker lifecycle

Long-lived workers should be managed explicitly.

```go
type WorkerGroup struct {
    cancel context.CancelFunc
    wg     sync.WaitGroup
}

func StartWorkers(parent context.Context, n int, run func(context.Context, int)) *WorkerGroup {
    ctx, cancel := context.WithCancel(parent)
    g := &WorkerGroup{cancel: cancel}

    g.wg.Add(n)
    for i := 0; i < n; i++ {
        i := i
        go func() {
            defer g.wg.Done()
            run(ctx, i)
        }()
    }

    return g
}

func (g *WorkerGroup) Stop() {
    g.cancel()
}

func (g *WorkerGroup) Wait() {
    g.wg.Wait()
}
```

Shutdown flow:

```text
signal received
  -> cancel worker context
  -> stop accepting new jobs
  -> workers finish current job or deadline expires
  -> wait
```

### Context values

Use context values sparingly for request-scoped metadata that crosses API boundaries.

Good:

```go
type requestIDKey struct{}

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey{}, id)
}

func RequestID(ctx context.Context) (string, bool) {
    id, ok := ctx.Value(requestIDKey{}).(string)
    return id, ok
}
```

Bad:

```go
ctx = context.WithValue(ctx, "db", db)
ctx = context.WithValue(ctx, "limit", 100)
```

Context is not dependency injection and not optional parameters.

### Common senior mistakes

- Using request context for work that must continue after response.
- Using background context and losing cancellation.
- Forgetting to call cancel, leaking timers.
- Passing nil context.
- Starting a goroutine without a wait path.
- Making concurrency unbounded.
- Holding large request objects inside long-lived goroutines.
- Swallowing `ctx.Err()` and returning unrelated errors.

### More interview Q&A

Q: How do you choose goroutine count for workers?  
A: Based on bottleneck capacity. CPU-bound work may use CPU count; DB or HTTP work should respect pool/connection/downstream limits.

Q: Why should you call cancel even if timeout will expire?  
A: It releases resources associated with the context timer early.

Q: Can context values be used for loggers?  
A: Sometimes request IDs or trace IDs belong in context, but service dependencies and general loggers should usually be explicit dependencies.

Q: What happens if the parent context is canceled?  
A: All child contexts are canceled, and operations observing them should return.

## 10. Channels and concurrency patterns

Channels are typed synchronization primitives. They are not just queues. A channel is best when goroutines need to communicate ownership, stream values, coordinate completion, or apply backpressure.

### Channel basics

Syntax:

```go
ch := make(chan int)      // unbuffered
buf := make(chan int, 10) // buffered

ch <- 10       // send
v := <-ch      // receive
v, ok := <-ch  // receive with closed-channel check
close(ch)      // signal no more values
```

Directional channels make APIs safer:

```go
func producer(out chan<- Job) {}
func consumer(in <-chan Job) {}
```

Unbuffered channel:

```text
sender goroutine ---- waits until receive ---- receiver goroutine
```

Buffered channel:

```text
sender -> [ slot ][ slot ][ slot ] -> receiver
             capacity = 3
```

Channel operation table:

```text
operation           nil channel       open channel             closed channel
send                blocks forever    sends or blocks          panic
receive             blocks forever    receives or blocks       zero value, ok=false after buffer drains
close               panic             closes channel           panic
range               blocks forever    reads until closed       exits after drain
```

Important rules:

- The sender normally closes the channel.
- Receivers should not close a shared input channel.
- Closing means “no more values will be sent.”
- Closing is a broadcast to receivers.
- Sending to a closed channel panics.
- Receiving from a closed channel is always ready.
- A nil channel can disable a `select` case.

### Runtime behavior

A channel value points to a runtime channel structure. Conceptually it contains:

```text
channel header
  element type
  buffer pointer
  buffer capacity
  send queue
  receive queue
  lock
```

When a goroutine sends:

```text
if receiver waiting:
    copy value directly to receiver
else if buffer has space:
    copy value into buffer
else:
    park sender goroutine in send queue
```

When a goroutine receives:

```text
if sender waiting:
    receive value and wake sender
else if buffer has value:
    copy value from buffer
else:
    park receiver goroutine in receive queue
```

Performance note: channel operations synchronize goroutines and copy values. They are powerful, but not free. For protecting shared maps or counters, a mutex is often simpler and faster.

### Basic producer-consumer example

```go
type Job struct {
    ID int
}

func producer(ctx context.Context, out chan<- Job, total int) error {
    defer close(out)

    for i := 0; i < total; i++ {
        job := Job{ID: i}
        select {
        case out <- job:
        case <-ctx.Done():
            return ctx.Err()
        }
    }
    return nil
}

func consumer(ctx context.Context, in <-chan Job) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case job, ok := <-in:
            if !ok {
                return nil
            }
            fmt.Println("processing", job.ID)
        }
    }
}
```

Why this is correct:

- Producer owns closing `out`.
- Consumer checks `ok`.
- Both sides respect cancellation.
- Sends cannot block forever after cancellation.

### `select` patterns

`select` waits until one case can proceed. If multiple cases are ready, Go chooses pseudo-randomly.

```go
select {
case v := <-in:
    use(v)
case out <- value:
    sent()
case <-ctx.Done():
    return ctx.Err()
}
```

Non-blocking receive:

```go
select {
case v := <-ch:
    use(v)
default:
    // no value available
}
```

Use `default` carefully. In loops, it can create a busy spin:

```go
for {
    select {
    case v := <-ch:
        use(v)
    default:
        // bad: loop can burn CPU
    }
}
```

Better:

```go
for {
    select {
    case v := <-ch:
        use(v)
    case <-ctx.Done():
        return
    }
}
```

Priority cancellation pattern:

```go
select {
case <-ctx.Done():
    return ctx.Err()
default:
}

select {
case <-ctx.Done():
    return ctx.Err()
case job := <-jobs:
    return handle(job)
}
```

### Pipeline pattern

A pipeline is a chain of stages connected by channels.

```text
input -> stage 1 -> stage 2 -> stage 3 -> output
```

Example: numbers -> square -> print.

```go
func Generate(ctx context.Context, nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, n := range nums {
            select {
            case out <- n:
            case <-ctx.Done():
                return
            }
        }
    }()
    return out
}

func Square(ctx context.Context, in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for {
            select {
            case <-ctx.Done():
                return
            case n, ok := <-in:
                if !ok {
                    return
                }
                select {
                case out <- n * n:
                case <-ctx.Done():
                    return
                }
            }
        }
    }()
    return out
}
```

Pipeline rules:

- Each stage owns closing its output.
- Each stage must stop when input closes.
- Each stage must stop when context is canceled.
- Sends to the next stage must be cancellation-aware.

Problem: caller reads only one result.

```go
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

out := Square(ctx, Generate(ctx, 1, 2, 3, 4))
fmt.Println(<-out)
cancel()
```

Without cancellation, upstream goroutines can block forever trying to send values nobody will receive.

### Fan-out and fan-in

Fan-out sends work to multiple workers. Fan-in merges multiple outputs.

```text
              worker 1
jobs channel -> worker 2 -> results channel
              worker 3
```

Fan-in implementation:

```go
func Merge[T any](ctx context.Context, inputs ...<-chan T) <-chan T {
    out := make(chan T)
    var wg sync.WaitGroup

    wg.Add(len(inputs))
    for _, input := range inputs {
        input := input
        go func() {
            defer wg.Done()
            for {
                select {
                case <-ctx.Done():
                    return
                case v, ok := <-input:
                    if !ok {
                        return
                    }
                    select {
                    case out <- v:
                    case <-ctx.Done():
                        return
                    }
                }
            }
        }()
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}
```

Correctness notes:

- `out` closes only after all input-draining goroutines exit.
- Each send to `out` respects cancellation.
- The caller must cancel the context if it stops reading early.

### Worker pool topic

A worker pool limits concurrency. This matters because “one goroutine per job” can overload the database, HTTP dependency, CPU, memory, or file descriptors.

Use a worker pool when:

- You have many jobs.
- Each job does I/O or CPU work.
- Downstream capacity is limited.
- You need bounded memory and backpressure.
- You need controlled shutdown.

Architecture:

```text
producer -> bounded jobs channel -> N workers -> results/errors
                |
                v
        backpressure when full
```

### Worker pool example: basic

```go
type Job struct {
    ID int
}

type Result struct {
    JobID int
    Value string
}

func RunWorkerPool(ctx context.Context, jobs []Job, workerCount int) ([]Result, error) {
    if workerCount <= 0 {
        return nil, errors.New("workerCount must be positive")
    }

    jobCh := make(chan Job)
    resultCh := make(chan Result)
    errCh := make(chan error, 1)

    var wg sync.WaitGroup
    worker := func() {
        defer wg.Done()
        for {
            select {
            case <-ctx.Done():
                return
            case job, ok := <-jobCh:
                if !ok {
                    return
                }
                result, err := processJob(ctx, job)
                if err != nil {
                    select {
                    case errCh <- err:
                    default:
                    }
                    return
                }
                select {
                case resultCh <- result:
                case <-ctx.Done():
                    return
                }
            }
        }
    }

    wg.Add(workerCount)
    for i := 0; i < workerCount; i++ {
        go worker()
    }

    go func() {
        defer close(jobCh)
        for _, job := range jobs {
            select {
            case jobCh <- job:
            case <-ctx.Done():
                return
            }
        }
    }()

    go func() {
        wg.Wait()
        close(resultCh)
    }()

    results := make([]Result, 0, len(jobs))
    for {
        select {
        case err := <-errCh:
            return nil, err
        case <-ctx.Done():
            return nil, ctx.Err()
        case result, ok := <-resultCh:
            if !ok {
                return results, nil
            }
            results = append(results, result)
        }
    }
}
```

This version demonstrates the moving parts, but in production you usually want cancellation on first error. The next version adds that.

### Worker pool example: cancel on first error

```go
func ProcessJobs(ctx context.Context, jobs []Job, workerCount int) ([]Result, error) {
    if workerCount <= 0 {
        return nil, errors.New("workerCount must be positive")
    }

    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    jobCh := make(chan Job)
    resultCh := make(chan Result)
    errCh := make(chan error, 1)

    var wg sync.WaitGroup
    wg.Add(workerCount)
    for i := 0; i < workerCount; i++ {
        go func(workerID int) {
            defer wg.Done()
            for {
                select {
                case <-ctx.Done():
                    return
                case job, ok := <-jobCh:
                    if !ok {
                        return
                    }

                    result, err := processJob(ctx, job)
                    if err != nil {
                        select {
                        case errCh <- fmt.Errorf("worker %d job %d: %w", workerID, job.ID, err):
                            cancel()
                        default:
                        }
                        return
                    }

                    select {
                    case resultCh <- result:
                    case <-ctx.Done():
                        return
                    }
                }
            }
        }(i)
    }

    go func() {
        defer close(jobCh)
        for _, job := range jobs {
            select {
            case jobCh <- job:
            case <-ctx.Done():
                return
            }
        }
    }()

    go func() {
        wg.Wait()
        close(resultCh)
    }()

    results := make([]Result, 0, len(jobs))
    for {
        select {
        case err := <-errCh:
            cancel()
            return nil, err
        case <-ctx.Done():
            if err := ctx.Err(); err != context.Canceled {
                return nil, err
            }
        case result, ok := <-resultCh:
            if !ok {
                return results, nil
            }
            results = append(results, result)
        }
    }
}
```

Production notes:

- `workerCount` should reflect downstream capacity, not CPU count blindly.
- If jobs call a DB, consider DB pool size.
- If jobs call HTTP, configure client timeouts and connection limits.
- If ordering matters, include original index and sort or place results by index.
- If partial success is allowed, collect per-job errors instead of canceling all.

### Worker pool problem: preserving order

Problem: worker pools return results in completion order, not input order.

Fix: attach index.

```go
type IndexedJob struct {
    Index int
    Job   Job
}

type IndexedResult struct {
    Index  int
    Result Result
}
```

Then write by index:

```go
ordered := make([]Result, len(jobs))
for r := range resultCh {
    ordered[r.Index] = r.Result
}
```

Interview explanation:

```text
Concurrency changes completion order. If API contract requires input order,
carry the original index through the worker pool and reconstruct output order.
```

### Worker pool problem: goroutine leak on early return

Bad:

```go
func Bad(jobs []Job) error {
    ch := make(chan Result)
    for _, job := range jobs {
        go func(job Job) {
            ch <- mustProcess(job)
        }(job)
    }
    return errors.New("failed early")
}
```

The goroutines may block forever sending to `ch`.

Fix:

- Use context cancellation.
- Use bounded workers.
- Ensure sends are cancellation-aware.
- Drain results or stop workers.

### Worker pool problem: closing channel from multiple workers

Bad:

```go
for i := 0; i < n; i++ {
    go func() {
        defer close(results) // panic: multiple goroutines can close
        work()
    }()
}
```

Correct:

```go
var wg sync.WaitGroup
wg.Add(n)
for i := 0; i < n; i++ {
    go func() {
        defer wg.Done()
        work()
    }()
}

go func() {
    wg.Wait()
    close(results)
}()
```

Only one goroutine closes `results`, after all senders are finished.

### Semaphore pattern

For simple bounded parallelism, use a buffered channel as a semaphore.

```go
func FetchAll(ctx context.Context, urls []string, limit int) error {
    sem := make(chan struct{}, limit)
    errCh := make(chan error, 1)
    var wg sync.WaitGroup

    for _, url := range urls {
        url := url

        select {
        case sem <- struct{}{}:
        case <-ctx.Done():
            return ctx.Err()
        }

        wg.Add(1)
        go func() {
            defer wg.Done()
            defer func() { <-sem }()

            if err := fetch(ctx, url); err != nil {
                select {
                case errCh <- err:
                default:
                }
            }
        }()
    }

    done := make(chan struct{})
    go func() {
        wg.Wait()
        close(done)
    }()

    select {
    case <-done:
        return nil
    case err := <-errCh:
        return err
    case <-ctx.Done():
        return ctx.Err()
    }
}
```

Use this when you do not need a full job queue, only a limit on concurrent goroutines.

### Timeout pattern

Prefer context deadlines for request-scoped work:

```go
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
defer cancel()
```

Inside select:

```go
select {
case result := <-resultCh:
    return result, nil
case <-ctx.Done():
    return Result{}, ctx.Err()
}
```

Avoid repeated `time.After` in hot loops:

```go
for {
    select {
    case <-time.After(time.Second):
        // allocates a new timer each loop
    }
}
```

Use a ticker:

```go
ticker := time.NewTicker(time.Second)
defer ticker.Stop()

for {
    select {
    case <-ticker.C:
        heartbeat()
    case <-ctx.Done():
        return
    }
}
```

### Common interview problems and senior answers

Problem: implement producer-consumer.

Expected points:

- Producer closes jobs channel.
- Consumers range over jobs.
- Use `WaitGroup` to wait for consumers.
- Close results only after all consumers exit.
- Add context if caller can cancel.

Problem: implement worker pool.

Expected points:

- Bounded worker count.
- Jobs channel.
- Result channel.
- Error propagation.
- Cancellation.
- No goroutine leaks.
- Optional ordered results.

Problem: stop after first success.

Pattern:

```go
func FirstSuccess(ctx context.Context, tasks []Task) (Result, error) {
    ctx, cancel := context.WithCancel(ctx)
    defer cancel()

    resultCh := make(chan Result, 1)
    errCh := make(chan error, len(tasks))

    for _, task := range tasks {
        task := task
        go func() {
            result, err := task.Run(ctx)
            if err != nil {
                errCh <- err
                return
            }
            select {
            case resultCh <- result:
                cancel()
            case <-ctx.Done():
            }
        }()
    }

    var errs []error
    for range tasks {
        select {
        case result := <-resultCh:
            return result, nil
        case err := <-errCh:
            errs = append(errs, err)
        case <-ctx.Done():
            return Result{}, ctx.Err()
        }
    }
    return Result{}, errors.Join(errs...)
}
```

Discussion:

- `resultCh` is buffered so the winning goroutine is not blocked if caller is selecting.
- `cancel()` asks other tasks to stop.
- This assumes each task respects context.

Problem: rate limit using channel.

```go
func RateLimited(ctx context.Context, in <-chan Job, every time.Duration) <-chan Job {
    out := make(chan Job)
    ticker := time.NewTicker(every)

    go func() {
        defer close(out)
        defer ticker.Stop()

        for {
            select {
            case <-ctx.Done():
                return
            case job, ok := <-in:
                if !ok {
                    return
                }
                select {
                case <-ticker.C:
                case <-ctx.Done():
                    return
                }
                select {
                case out <- job:
                case <-ctx.Done():
                    return
                }
            }
        }
    }()

    return out
}
```

### Common bugs

Deadlock: no receiver.

```go
ch := make(chan int)
ch <- 1 // blocks forever in same goroutine
```

Send on closed channel:

```go
close(ch)
ch <- 1 // panic
```

Range never ends:

```go
for v := range ch {
    use(v)
}
```

This loop exits only when `ch` is closed.

Closed channel in select spins:

```go
for {
    select {
    case v := <-closedCh:
        use(v) // always ready, can spin forever on zero values
    }
}
```

Fix:

```go
v, ok := <-ch
if !ok {
    ch = nil // disable select case
    continue
}
```

### Best practices

- Use channels for communication, ownership transfer, pipelines, and backpressure.
- Use mutexes for protecting shared state.
- Keep channel ownership clear.
- Make sends cancellation-aware when receivers may leave.
- Use directional channels in function signatures.
- Bound worker pools.
- Choose buffer size deliberately.
- Close output channels from the goroutine that owns sending.
- Add tests for cancellation, early return, and slow consumers.

### Performance considerations

- Channel operations involve synchronization.
- Large values sent through channels are copied; send pointers only when ownership is clear.
- Buffered channels can reduce blocking but increase memory and hide backpressure.
- Too many goroutines can increase scheduling and memory overhead.
- Worker count should match the bottleneck: CPU, DB pool, HTTP dependency, or disk.
- For counters or maps, mutex or atomic operations may be better.

### Interview Q&A

Q: What is the difference between buffered and unbuffered channels?  
A: Unbuffered channels require sender and receiver rendezvous. Buffered channels allow sends until capacity is full.

Q: Who should close a channel?  
A: Usually the sender, because the sender knows when no more values will be sent.

Q: What happens when receiving from a closed channel?  
A: It receives buffered values first, then returns the zero value with `ok=false`.

Q: What happens when sending to a closed channel?  
A: The program panics.

Q: How do you avoid goroutine leaks in pipelines?  
A: Propagate context cancellation, make sends cancellation-aware, and ensure every goroutine has an exit path.

Q: When is a worker pool better than spawning one goroutine per job?  
A: When resources must be bounded, downstream capacity is limited, or the input size can be large.

Q: How do you preserve order in a worker pool?  
A: Attach input indexes to jobs and place results back by index.

Q: When should you use a mutex instead of a channel?  
A: When the problem is protecting shared memory rather than communicating work or ownership.

### Exercises

1. Implement a producer-consumer pipeline that reads lines from a file and validates JSON concurrently.
2. Implement a worker pool that cancels all workers on first error.
3. Extend the worker pool to preserve input order.
4. Write a fan-in function for N channels with context cancellation.
5. Write a test that proves your pipeline does not leak goroutines when the caller reads only one result.
6. Implement a semaphore-based HTTP fetcher with a maximum concurrency limit.
7. Fix a select loop that spins after one input channel closes.
8. Benchmark channel-based counter increments versus mutex and atomic counters.

## 11. Locks, atomics, and sync primitives

Use a mutex for compound state transitions; atomics are appropriate for independent simple values and require a clear invariant.

```go
type Cache struct { mu sync.RWMutex; m map[string]string }
func (c *Cache) Get(k string) (string, bool) { c.mu.RLock(); defer c.mu.RUnlock(); v, ok := c.m[k]; return v, ok }
func (c *Cache) Put(k, v string) { c.mu.Lock(); defer c.mu.Unlock(); c.m[k] = v }
```

`Mutex` establishes a happens-before relationship from unlock to later lock. `RWMutex` helps only when reads are frequent and sufficiently long; it may be slower under write-heavy contention. `sync.Once` initializes one time; `WaitGroup` waits for a known set of tasks (call `Add` before starting); `sync.Pool` is an optional allocation cache whose contents may disappear at GC.

```go
var requests atomic.Uint64
requests.Add(1)
```

Run `go test -race ./...` regularly. The race detector finds many unsynchronized conflicting accesses, but a clean run does not prove race freedom.

### Mutex theory

A mutex protects a critical section. The main idea is not “lock the variable”; it is “protect the invariant.”

```go
type Inventory struct {
    mu           sync.Mutex
    total        int
    available    int
    reservations map[string]int
}
```

The invariant might be:

```text
available >= 0
sum(reservations) + available == total
```

Because the invariant spans multiple fields, a mutex is better than separate atomics.

```go
func (i *Inventory) Reserve(id string, qty int) error {
    i.mu.Lock()
    defer i.mu.Unlock()

    if qty <= 0 {
        return errors.New("qty must be positive")
    }
    if i.available < qty {
        return errors.New("not enough stock")
    }
    i.available -= qty
    i.reservations[id] = qty
    return nil
}
```

### `sync.RWMutex`

`RWMutex` allows many readers or one writer.

```go
type Registry struct {
    mu sync.RWMutex
    m  map[string]Handler
}

func (r *Registry) Get(name string) (Handler, bool) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    h, ok := r.m[name]
    return h, ok
}

func (r *Registry) Set(name string, h Handler) {
    r.mu.Lock()
    defer r.mu.Unlock()
    r.m[name] = h
}
```

Use `RWMutex` when:

- Reads dominate writes.
- Read sections are long enough to matter.
- Writers are not frequently blocked by readers.
- Measurement shows benefit.

Do not use it automatically. A normal `Mutex` is often simpler and faster.

### `sync.WaitGroup`

`WaitGroup` waits for a known number of goroutines.

```go
var wg sync.WaitGroup

for _, item := range items {
    item := item
    wg.Add(1)
    go func() {
        defer wg.Done()
        process(item)
    }()
}

wg.Wait()
```

Rules:

- Call `Add` before starting the goroutine.
- Each goroutine calls `Done` exactly once.
- Do not copy a `WaitGroup` after use.
- A `WaitGroup` does not propagate errors; combine with an error channel or `errgroup`.

Bad:

```go
go func() {
    wg.Add(1) // race with Wait
    defer wg.Done()
    work()
}()
wg.Wait()
```

### `sync.Once`

`Once` runs initialization once.

```go
type LazyConfig struct {
    once sync.Once
    cfg  Config
    err  error
}

func (l *LazyConfig) Get() (Config, error) {
    l.once.Do(func() {
        l.cfg, l.err = loadConfig()
    })
    return l.cfg, l.err
}
```

Pitfall: if initialization fails, `Once` still considers it done. If retries are required, design a different primitive.

### `sync.Cond`

`Cond` lets goroutines wait until a condition becomes true.

```go
type BlockingQueue struct {
    mu   sync.Mutex
    cond *sync.Cond
    jobs []Job
}

func NewBlockingQueue() *BlockingQueue {
    q := &BlockingQueue{}
    q.cond = sync.NewCond(&q.mu)
    return q
}

func (q *BlockingQueue) Push(j Job) {
    q.mu.Lock()
    q.jobs = append(q.jobs, j)
    q.cond.Signal()
    q.mu.Unlock()
}

func (q *BlockingQueue) Pop() Job {
    q.mu.Lock()
    defer q.mu.Unlock()

    for len(q.jobs) == 0 {
        q.cond.Wait()
    }

    j := q.jobs[0]
    q.jobs[0] = Job{}
    q.jobs = q.jobs[1:]
    return j
}
```

Use a `for` loop, not `if`, because wakeups do not guarantee the condition is still true.

### Atomics

Atomics are useful for independent counters, flags, and advanced lock-free structures.

```go
type Stats struct {
    requests atomic.Int64
    failures atomic.Int64
}

func (s *Stats) Record(err error) {
    s.requests.Add(1)
    if err != nil {
        s.failures.Add(1)
    }
}
```

Bad atomic design:

```go
var available atomic.Int64
var reserved atomic.Int64
```

If `available + reserved == total` is an invariant, use a mutex. Atomics do not automatically protect relationships across fields.

### `sync.Pool`

`sync.Pool` is a temporary object reuse mechanism.

```go
var bufPool = sync.Pool{
    New: func() any {
        b := make([]byte, 0, 64*1024)
        return &b
    },
}

func useBuffer() {
    p := bufPool.Get().(*[]byte)
    b := (*p)[:0]
    defer func() {
        *p = b[:0]
        bufPool.Put(p)
    }()
}
```

Rules:

- Pool contents may disappear at any GC.
- Do not use it as a cache.
- Reset objects before putting them back.
- Be careful with sensitive data.
- Use only after profiling shows allocation pressure.

### Memory model essentials

Happens-before relationships make writes visible across goroutines.

```text
mutex unlock -> later lock on same mutex
channel send -> corresponding receive
channel close -> receive observing close
goroutine creation -> start of goroutine
atomic operation -> synchronization for atomic variable
```

Data race:

```go
var n int

go func() { n++ }()
go func() { n++ }()
```

Fix:

```go
var n atomic.Int64
go func() { n.Add(1) }()
go func() { n.Add(1) }()
```

### Debugging synchronization problems

Commands:

```bash
go test -race ./...
go test -run TestName -race -count=100 ./pkg
go test -mutexprofile mutex.out ./pkg
go tool pprof mutex.out
go test -blockprofile block.out ./pkg
go tool pprof block.out
```

Common problems:

- Deadlock from inconsistent lock order.
- Lock held during I/O.
- `RWMutex` writer starvation symptoms.
- `WaitGroup` counter mismatch.
- Atomic and non-atomic mixed access.
- Copying structs that contain locks.

Interview Q&A:

Q: When would you use a mutex instead of a channel?  
A: When protecting shared state and invariants. Channels are better for communication and ownership transfer.

Q: Why can `RWMutex` be slower than `Mutex`?  
A: It has more bookkeeping and can suffer under write contention or short critical sections.

Q: What is `sync.Pool` not suitable for?  
A: Durable caching or objects that must remain available; GC can clear pool contents.

Exercises:

1. Implement a thread-safe inventory reservation store.
2. Replace a channel-based map owner with a mutex-based map and benchmark both.
3. Add mutex and block profiling to a contended test.
4. Build a concurrent counter with mutex, atomic, and channel versions; compare.

## 12. Runtime internals and garbage collection

The runtime uses a concurrent, tracing, non-moving garbage collector. It marks reachable heap objects from roots (stacks, globals, registers), then reclaims unreachable objects. Write barriers preserve correctness while marking continues concurrently with the program.

```
roots ──> object A ──> object B
  │                        ↑
  └──> object C      unreachable objects are swept
```

GC cost is mainly proportional to live heap and pointer scanning, rather than allocation count alone. Short pauses still exist for coordination. Reduce retention first: release large buffers, bound caches, avoid pointer-rich object graphs where a compact value representation fits. Do **not** call `runtime.GC()` in normal request paths.

The allocator serves small objects from per-P caches and larger objects from heap spans. Details change by release; depend on semantics, not internal structures. `GODEBUG=gctrace=1` and `runtime/metrics` help diagnose, while `pprof` should guide actual fixes.

### Runtime responsibilities

The Go runtime is linked into normal Go binaries. It provides:

- Goroutine scheduling.
- Stack growth.
- Heap allocation.
- Garbage collection.
- Channel operations.
- Map operations.
- Timer management.
- Network polling.
- Panic/defer/recover machinery.
- Reflection metadata support.

This is why a small Go binary still includes runtime behavior beyond your application code.

### Stack growth

Goroutines start with small stacks that grow as needed.

```text
goroutine stack
  frame A
  frame B
  frame C

if more stack needed:
  allocate larger stack
  copy frames
  update pointers
```

This makes goroutines cheap compared with OS threads, but not free. A leaked goroutine also leaks its stack and references from that stack.

### Allocation path mental model

Small objects are allocated from runtime-managed spans and per-P caches.

```text
new object
  -> size class
  -> per-P mcache
  -> mcentral span
  -> heap arena
```

Large objects go through a different path and may require larger spans.

Practical meaning:

- Many tiny allocations can increase allocation rate.
- Pointer-heavy allocations increase GC scan work.
- Large allocations may affect heap growth and latency.
- Retained objects are usually more harmful than short-lived garbage.

### Escape analysis and runtime cost

The compiler decides stack versus heap placement.

```go
func Local() int {
    x := 10
    return x // stack
}

func Escapes() *int {
    x := 10
    return &x // heap
}
```

Inspect:

```bash
go build -gcflags="-m=2" ./...
```

Do not blindly rewrite code because something escapes. Ask:

- Is this allocation in a hot path?
- Does it affect latency or memory?
- Can ownership be simpler?
- Would changing it make code worse?

### GC phases

Simplified GC flow:

```text
1. mark setup
2. concurrent mark
3. mark assists from allocating goroutines if needed
4. mark termination
5. sweep unused spans
```

Tri-color marking:

```text
white = not yet reached
gray  = reached but children not scanned
black = reached and children scanned
```

Write barriers keep the object graph correct while the application mutates pointers during concurrent marking.

### What GC scans

The collector starts from roots:

- Goroutine stacks.
- Global variables.
- Runtime metadata.
- Registers.

Then it follows pointers into heap objects.

```text
root -> object with pointers -> more objects
root -> []byte              -> no pointer scan inside bytes
root -> []*User             -> scan many pointers
```

Pointer-free data can be cheaper to scan. This is why value layout and pointer count can matter in high-performance systems.

### Allocation, retention, scan pressure

Senior distinction:

```text
allocation pressure = how fast objects are created
retention pressure  = how much memory remains reachable
scan pressure       = how many pointers GC must inspect
```

Example:

```go
type PointerHeavy struct {
    A *int
    B *string
    C *[]byte
}

type Compact struct {
    A int
    B [32]byte
}
```

The pointer-heavy version may create more objects and more scan work.

### Memory leak patterns

Subslice retention:

```go
func BadHeader(file []byte) []byte {
    return file[:128] // keeps full file alive
}
```

Fix:

```go
func Header(file []byte) []byte {
    n := min(128, len(file))
    out := make([]byte, n)
    copy(out, file[:n])
    return out
}
```

Unbounded cache:

```go
var users = map[string]*User{} // grows forever
```

Fix:

- Add capacity.
- Add TTL.
- Add eviction.
- Track size metrics.

Goroutine retention:

```go
func Bad(req *Request) {
    go func() {
        <-make(chan struct{})
        fmt.Println(req.ID)
    }()
}
```

The goroutine keeps `req` reachable forever.

### GC tuning

`GOGC` controls heap growth target relative to live heap. `GOMEMLIMIT` gives the runtime a soft memory limit.

Examples:

```bash
GOGC=100 ./app
GOMEMLIMIT=1GiB ./app
GODEBUG=gctrace=1 ./app
```

Tuning rules:

- First reduce retention and allocation hot spots.
- Use `GOMEMLIMIT` in containers to avoid memory surprises.
- Avoid `runtime.GC()` in request paths.
- Measure before and after.

### Runtime diagnostics

Use:

```bash
go test -bench . -benchmem ./...
go test -memprofile mem.out -bench . ./pkg
go tool pprof mem.out
go tool pprof http://localhost:6060/debug/pprof/heap
go tool pprof http://localhost:6060/debug/pprof/allocs
go tool trace trace.out
```

Profile interpretation:

- Heap in-use shows retained memory.
- Alloc profile shows allocation sites.
- Goroutine profile shows leaks and blocking.
- Trace shows scheduling, syscalls, GC, and goroutine lifetimes.

Interview Q&A:

Q: What is the difference between heap allocation and retained heap?  
A: Allocation is object creation. Retained heap is memory still reachable and therefore not collectible.

Q: Why can pointers increase GC cost?  
A: The GC must scan pointers and follow reachable object graphs.

Q: Why should you avoid `runtime.GC()` in request paths?  
A: It forces global GC work and can hurt latency; fix allocation or retention instead.

Q: How would you debug rising memory usage?  
A: Compare heap in-use, allocation rate, goroutine count, capture heap/goroutine profiles, inspect retaining paths, fix ownership/bounds, then verify.

Exercises:

1. Write a benchmark that retains a subslice of a large byte slice; inspect heap.
2. Fix the subslice retention and compare memory.
3. Create a cache with TTL and capacity bounds.
4. Use `-gcflags=-m=2` on a package and explain three escapes.
5. Capture a heap profile before and after reducing allocations.

## 13. Files, I/O, and serialization

Go I/O is built around small interfaces: `io.Reader`, `io.Writer`, `io.Closer`, and `io.Seeker`. Stream instead of `ReadAll` for unbounded input.

```go
func CopyAtomic(dst string, r io.Reader) (err error) {
    tmp, err := os.CreateTemp(filepath.Dir(dst), ".upload-*"); if err != nil { return err }
    name := tmp.Name()
    defer func() { _ = os.Remove(name) }()
    if _, err = io.Copy(tmp, r); err != nil { tmp.Close(); return err }
    if err = tmp.Sync(); err != nil { tmp.Close(); return err }
    if err = tmp.Close(); err != nil { return err }
    return os.Rename(name, dst) // atomic when same filesystem
}
```

```go
type Event struct { ID string `json:"id"`; At time.Time `json:"at"` }
dec := json.NewDecoder(r)
dec.DisallowUnknownFields()
var e Event
if err := dec.Decode(&e); err != nil { return err }
```

Always close resources you opened. Limit untrusted input with `io.LimitReader` or `http.MaxBytesReader`; validate decoded data separately. File permissions are affected by umask. `os.Rename` atomicity, `Sync`, and directory syncing have OS/filesystem-specific durability semantics—document the guarantee your application needs.

**Pitfalls.** `bufio.Scanner` has a token-size limit; set its buffer or use `Reader` for long records. Never build file paths from user strings without constraining traversal and symlinks.

### I/O interface model

Go I/O is powerful because of tiny interfaces.

```go
type Reader interface {
    Read([]byte) (int, error)
}

type Writer interface {
    Write([]byte) (int, error)
}
```

Composition:

```text
file -> bufio.Reader -> gzip.Reader -> json.Decoder
```

Example:

```go
func DecodeGzipJSON[T any](r io.Reader, out *T) error {
    gz, err := gzip.NewReader(r)
    if err != nil {
        return err
    }
    defer gz.Close()

    dec := json.NewDecoder(gz)
    dec.DisallowUnknownFields()
    return dec.Decode(out)
}
```

### Streaming versus buffering

Bad for unbounded input:

```go
data, err := io.ReadAll(r)
```

Better:

```go
scanner := bufio.NewScanner(r)
for scanner.Scan() {
    line := scanner.Text()
    process(line)
}
if err := scanner.Err(); err != nil {
    return err
}
```

For long lines:

```go
scanner.Buffer(make([]byte, 64*1024), 10*1024*1024)
```

Or use `bufio.Reader`.

### Filesystem safety

Use `filepath.Clean`, `filepath.Join`, and strict base directories.

```go
func SafeJoin(base, name string) (string, error) {
    cleaned := filepath.Clean(name)
    if strings.Contains(cleaned, "..") || filepath.IsAbs(cleaned) {
        return "", errors.New("invalid path")
    }
    return filepath.Join(base, cleaned), nil
}
```

Production concerns:

- Path traversal.
- Symlink attacks.
- Partial writes.
- Disk full.
- Permissions and umask.
- Atomic rename only on same filesystem.
- Durability requires careful `Sync` behavior.

### Serialization contracts

JSON tags are API contracts.

```go
type CreateUserRequest struct {
    Email string `json:"email"`
    Name  string `json:"name"`
}
```

Validation is separate from decoding:

```go
func (r CreateUserRequest) Validate() error {
    if r.Email == "" {
        return errors.New("email required")
    }
    return nil
}
```

Interview Q&A:

Q: Why stream large files?  
A: To bound memory and start processing before the full input is loaded.

Q: Why check close errors?  
A: Some writers flush on close; ignoring close can hide data loss.

Q: Why use `DisallowUnknownFields`?  
A: It rejects unexpected JSON fields, useful for strict APIs.

Exercises:

1. Build a streaming CSV-to-JSON converter.
2. Implement atomic file write with temp file and rename.
3. Add request body size limits to an upload endpoint.
4. Test long-line scanner behavior.

## 14. Networking: HTTP, APIs, and gRPC

### HTTP server

```go
func health(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { http.Error(w, "method not allowed", 405); return }
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

srv := &http.Server{
    Addr: ":8080", Handler: http.HandlerFunc(health),
    ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second,
    WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
}
```

`net/http` serves requests concurrently. Always set server timeouts, enforce request-body limits, authenticate and authorize before sensitive work, and propagate request context to every downstream call. Reuse an `http.Client` and its transport; do not create one per request. Close response bodies so connections can be reused.

```go
client := &http.Client{Timeout: 10 * time.Second}
resp, err := client.Do(req)
if err != nil { return err }
defer resp.Body.Close()
if resp.StatusCode/100 != 2 { return fmt.Errorf("unexpected status: %s", resp.Status) }
```

### API and gRPC design

Use resource-oriented routes, stable error shapes, pagination, idempotency keys for retryable writes, and versioning with a published compatibility policy. For gRPC, define protobuf messages with field numbers that are never reused; prefer adding optional fields over changing meaning. Set deadlines on every RPC, map domain errors to appropriate transport status, and configure bounded retries with backoff only for idempotent operations.

### HTTP server production details

Configure timeouts:

```go
srv := &http.Server{
    Addr:              ":8080",
    Handler:           router,
    ReadHeaderTimeout: 5 * time.Second,
    ReadTimeout:       15 * time.Second,
    WriteTimeout:      30 * time.Second,
    IdleTimeout:       60 * time.Second,
}
```

Why:

- `ReadHeaderTimeout` protects against slowloris-style clients.
- `ReadTimeout` bounds reading request bodies.
- `WriteTimeout` bounds response writing.
- `IdleTimeout` controls keep-alive idle connections.

Middleware chain:

```text
request id -> logging -> recovery -> auth -> body limit -> handler
```

Example body limit:

```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
```

### HTTP client production details

Reuse clients.

```go
client := &http.Client{
    Timeout: 5 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 20,
        IdleConnTimeout:     90 * time.Second,
    },
}
```

Rules:

- Use `NewRequestWithContext`.
- Close response body.
- Check status codes.
- Retry only safe/idempotent operations.
- Add circuit breaking or bulkheading for fragile dependencies.

### API design checklist

- Stable JSON shape.
- Explicit error codes.
- Pagination.
- Filtering and sorting rules.
- Idempotency for create/payment operations.
- Versioning policy.
- Authentication and authorization.
- Rate limits.
- Observability fields.

Error response:

```json
{
  "error": {
    "code": "not_found",
    "message": "user not found"
  }
}
```

### gRPC design notes

For gRPC:

- Always set deadlines.
- Use interceptors for auth, logging, recovery, metrics.
- Keep protobuf field numbers stable.
- Never reuse removed field numbers.
- Use status codes intentionally.
- Avoid huge messages; stream when appropriate.

Interview Q&A:

Q: Why should you not create an HTTP client per request?  
A: It prevents connection reuse and can exhaust resources.

Q: What is the difference between authentication and authorization?  
A: Authentication proves identity; authorization checks permission for an action.

Exercises:

1. Build HTTP middleware for request ID, recovery, logging, and body limit.
2. Write an HTTP client wrapper with retries and context deadlines.
3. Design error mapping from domain errors to HTTP and gRPC status.

## 15. Testing, fuzzing, and benchmarking

```go
func TestClamp(t *testing.T) {
    cases := []struct { name string; in, want int }{{"low", -1, 0}, {"middle", 4, 4}}
    for _, tc := range cases { t.Run(tc.name, func(t *testing.T) {
        if got := Clamp(tc.in, 0, 10); got != tc.want { t.Fatalf("got %d, want %d", got, tc.want) }
    }) }
}

func FuzzParseID(f *testing.F) { f.Add("abc"); f.Fuzz(func(t *testing.T, s string) { _, _ = ParseID(s) }) }

func BenchmarkEncode(b *testing.B) { value := Event{ID:"1"}; b.ReportAllocs(); for b.Loop() { _, _ = json.Marshal(value) } }
```

Tests should be deterministic and behavior-focused. Use `t.TempDir`, `t.Setenv`, and injected clocks/transports to isolate side effects. Parallel subtests must not mutate shared state. Favor fakes for your own interfaces; use integration tests for SQL, queues, and protocols where mocks would merely reimplement reality.

Commands: `go test ./...`, `go test -race ./...`, `go test -cover ./...`, `go test -run TestName -count=1`, `go test -bench=. -benchmem ./...`, and `go test -fuzz=FuzzParseID`.

**Benchmark rule.** Benchmark realistic inputs, prevent optimizer elimination by consuming results, compare before/after repeatedly (`benchstat`), and profile before optimizing.

### Table-driven tests

```go
func TestParseStatus(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        want    Status
        wantErr bool
    }{
        {"paid", "paid", StatusPaid, false},
        {"invalid", "x", "", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := ParseStatus(tt.input)
            if tt.wantErr {
                if err == nil {
                    t.Fatal("expected error")
                }
                return
            }
            if err != nil {
                t.Fatal(err)
            }
            if got != tt.want {
                t.Fatalf("got %q want %q", got, tt.want)
            }
        })
    }
}
```

### Testing HTTP

```go
req := httptest.NewRequest(http.MethodGet, "/users/123", nil)
rr := httptest.NewRecorder()

handler.ServeHTTP(rr, req)

if rr.Code != http.StatusOK {
    t.Fatalf("status=%d", rr.Code)
}
```

Use `httptest.Server` when testing clients:

```go
srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
}))
defer srv.Close()
```

### Testing concurrency

Rules:

- Test cancellation.
- Test early return.
- Test slow consumers.
- Run race detector.
- Avoid sleeps; use channels or fake clocks.

```go
done := make(chan struct{})
go func() {
    defer close(done)
    worker(ctx)
}()

cancel()

select {
case <-done:
case <-time.After(time.Second):
    t.Fatal("worker did not exit")
}
```

### Fuzzing

Use fuzzing for parsers, decoders, validators, and state machines.

```go
func FuzzEmail(f *testing.F) {
    f.Add("a@example.com")
    f.Fuzz(func(t *testing.T, s string) {
        _, _ = ParseEmail(s)
    })
}
```

### Benchmarking

```go
var sink Result

func BenchmarkProcess(b *testing.B) {
    input := makeInput()
    b.ReportAllocs()
    for i := 0; i < b.N; i++ {
        sink = Process(input)
    }
}
```

Pitfalls:

- Benchmarking tiny unrealistic inputs.
- Letting compiler remove unused work.
- Comparing single noisy runs.
- Optimizing without profile evidence.

Interview Q&A:

Q: What does `t.Helper()` do?  
A: It marks helper functions so failure locations point to the caller.

Q: What does race detector prove?  
A: It detects races exercised during the run, not all possible races.

Exercises:

1. Write table tests for a parser.
2. Test an HTTP handler and HTTP client.
3. Write a cancellation test for a worker.
4. Add a fuzz test to a URL parser.
5. Benchmark and reduce allocations in a hot function.

## 16. Generics and reflection

Generics are compile-time parameterization. Constraints describe permitted operations.

```go
func Contains[T comparable](xs []T, want T) bool {
    for _, x := range xs { if x == want { return true } }
    return false
}

type Number interface { ~int | ~int64 | ~float64 }
func Sum[T Number](xs []T) (out T) { for _, x := range xs { out += x }; return }
```

Use generics for algorithms that are genuinely type-independent (collections, numeric helpers), not to conceal unrelated domain types. `comparable` permits equality but not ordering. Generic code is type-checked per instantiation; implementation strategy is compiler-dependent, so benchmark rather than assuming overhead.

Reflection inspects runtime type/value metadata and is useful in serializers, validators, and framework boundaries. It is less type-safe and may allocate or panic when misused.

```go
v := reflect.ValueOf(x)
if v.Kind() == reflect.Ptr && !v.IsNil() { v = v.Elem() }
```

Prefer interfaces, type switches, and generated code for normal application logic. Never call `Elem`, `Interface`, or `Set` without checking the required kind/addressability/export rules.

### Generics use cases

Good use cases:

- Sets.
- Stacks/queues.
- Mapping/filtering helpers in internal code.
- Numeric algorithms.
- Type-safe caches.

Example set:

```go
type Set[T comparable] map[T]struct{}

func NewSet[T comparable](items ...T) Set[T] {
    s := make(Set[T], len(items))
    for _, item := range items {
        s[item] = struct{}{}
    }
    return s
}

func (s Set[T]) Has(v T) bool {
    _, ok := s[v]
    return ok
}
```

Constraint with underlying type:

```go
type Integer interface {
    ~int | ~int32 | ~int64
}
```

`~int` allows defined types whose underlying type is `int`.

### When not to use generics

Avoid generics when:

- A simple interface is clearer.
- Domain types need different behavior.
- The abstraction hides business meaning.
- Call sites become harder to read.

Bad:

```go
func Do[T any](x T) T
```

No useful meaning.

### Reflection practical safety

Reflection requires kind checks.

```go
func IsZeroStruct(v any) bool {
    rv := reflect.ValueOf(v)
    if rv.Kind() == reflect.Ptr {
        if rv.IsNil() {
            return true
        }
        rv = rv.Elem()
    }
    if rv.Kind() != reflect.Struct {
        return false
    }
    return rv.IsZero()
}
```

Reflection pitfalls:

- Panic on invalid kind.
- Cannot set unexported fields normally.
- Loses compile-time guarantees.
- Can allocate and be slower.

Interview Q&A:

Q: What is `comparable`?  
A: A constraint for types that support `==` and `!=`, including map keys.

Q: When is reflection appropriate?  
A: At framework boundaries such as JSON, validators, ORMs, and generic tooling where static typing cannot express the operation cleanly.

Exercises:

1. Implement generic `Set[T comparable]`.
2. Implement generic stack and queue.
3. Write a reflection-based validator for `required` struct tags.
4. Benchmark reflection metadata caching.

## 17. Performance and observability

Start from a measurable service objective, reproduce load, and profile the bottleneck.

```go
import _ "net/http/pprof"
// expose pprof only on an authenticated/internal listener
```

```bash
go test -cpuprofile cpu.out -memprofile mem.out -bench . ./pkg
go tool pprof cpu.out
go tool trace trace.out
```

CPU profiles identify where time is spent; heap profiles distinguish allocation from retained memory; block and mutex profiles reveal contention; execution traces show goroutine scheduling. Prefer algorithmic improvements, fewer round trips, batching, and bounded concurrency before micro-optimizations. `strings.Builder`, preallocation (`make([]T, 0, n)`), and buffer reuse can help measured hot paths.

Instrument logs (structured and redacted), metrics (rates, errors, latency, saturation), and traces (cross-service causality). Do not use high-cardinality IDs as metric labels. Every request should carry a correlation/trace ID; secrets, tokens, and raw personal data should not appear in logs.

### Performance workflow

Do not start with clever code. Start with a loop:

```text
1. Define the target: P95 latency, throughput, CPU, memory, cost.
2. Reproduce workload: realistic data and concurrency.
3. Capture baseline: benchmark, profile, metrics.
4. Form one hypothesis.
5. Change one thing.
6. Compare using the same workload.
7. Keep, revert, or continue.
```

Example:

```bash
go test -bench=BenchmarkEncode -benchmem -count=10 ./internal/codec
```

Use repeated runs because benchmarks can be noisy.

### CPU profiling

CPU profile answers: where does CPU time go?

```bash
go test -bench . -cpuprofile cpu.out ./internal/parser
go tool pprof cpu.out
```

Inside pprof:

```text
top
list FunctionName
web
```

Typical CPU issues:

- Inefficient algorithms.
- Excess JSON reflection.
- Regex in hot path.
- Lock contention showing as runtime/sync overhead.
- Compression/encryption hotspots.
- Excessive logging.

### Memory profiling

Memory profiles answer two related but different questions.

```text
inuse_space: what is retained now?
alloc_space: where allocations were created over time?
```

Commands:

```bash
go test -bench . -memprofile mem.out ./internal/processor
go tool pprof mem.out
```

Common memory wins:

- Avoid retaining large backing arrays.
- Preallocate slices/maps when size is known.
- Reuse buffers only in measured hot paths.
- Avoid `map[string]any` for hot structured data.
- Stream large payloads instead of building huge byte slices.

### Mutex and block profiling

Enable profiles in tests:

```bash
go test -run TestLoad -mutexprofile mutex.out -blockprofile block.out ./internal/service
go tool pprof mutex.out
go tool pprof block.out
```

Mutex profile shows lock contention. Block profile shows goroutines blocked on synchronization operations such as channel send/receive and mutexes.

Fix strategies:

- Reduce critical section size.
- Avoid I/O while holding locks.
- Shard hot maps.
- Replace shared state with ownership transfer when clearer.
- Reduce unnecessary fan-in bottlenecks.

### Execution tracing

`go tool trace` is useful when the question is about scheduling, blocking, network, syscalls, or goroutine lifetimes.

```bash
go test -run TestScenario -trace trace.out ./internal/service
go tool trace trace.out
```

Use trace when:

- Goroutines are blocked unexpectedly.
- Latency is high but CPU is low.
- You suspect scheduler, syscall, GC, or network waiting.
- You need to see lifecycle timing.

### Observability model

Logs, metrics, traces, and profiles answer different questions.

```text
logs     -> what happened?
metrics  -> how often, how much, how bad?
traces   -> where did one request spend time?
profiles -> where does this process spend CPU/memory/blocking?
```

Minimum metrics for a Go HTTP service:

- Request count by route, method, status.
- Request latency histogram.
- Error count.
- Panic count.
- External HTTP latency and failures.
- DB pool open/in-use/wait counts.
- Goroutine count.
- Heap in use.
- Allocation rate.
- GC cycles and pause summaries.
- Worker queue depth.

Avoid high-cardinality labels:

```text
bad:  user_id, order_id, raw_url, email
good: route_template, status_code, dependency_name, error_class
```

### Logging

Use structured logs.

```go
logger.Info("order created",
    "request_id", requestID,
    "order_id", order.ID,
    "user_id_hash", hashUserID(order.UserID),
    "amount", order.Amount,
)
```

Rules:

- Log at boundaries.
- Add request ID or trace ID.
- Do not log secrets.
- Use stable field names.
- Avoid logging full request/response bodies by default.
- Do not log and return the same error at every layer.

### Tracing

Trace important boundaries:

```text
HTTP handler
  -> auth check
  -> DB query
  -> payment provider call
  -> queue publish
```

Good span attributes:

- Route template.
- Dependency name.
- Query class, not raw query with secrets.
- Retry count.
- Error class.

Bad span attributes:

- Raw tokens.
- Full request body.
- Unbounded user-provided strings.

### Senior performance scenario

Question:

```text
P99 latency doubled after a deployment. What do you do?
```

Strong answer:

```text
I first check whether traffic, errors, or dependency latency changed. Then I compare
dashboards before and after deploy: route latency, DB pool waits, downstream calls,
CPU, heap, GC, goroutine count, queue depth, and saturation. If impact is high,
I roll back while preserving evidence. Then I capture CPU/heap/mutex/block profiles
and traces under representative load. I identify whether the issue is CPU, waiting,
memory/GC, lock contention, or dependency saturation. After a fix, I verify with the
same workload and add regression coverage or alerts.
```

### Practical optimization examples

Preallocate:

```go
out := make([]UserDTO, 0, len(users))
for _, u := range users {
    out = append(out, convert(u))
}
```

Avoid repeated conversions:

```go
// Bad in hot path
for _, b := range keys {
    count[string(b)]++
}
```

Stream:

```go
enc := json.NewEncoder(w)
for _, item := range items {
    if err := enc.Encode(item); err != nil {
        return err
    }
}
```

Bound concurrency:

```go
limit := make(chan struct{}, 20)
```

Choose `20` because of dependency capacity, not vibes.

### Interview Q&A

Q: What is the difference between CPU profile and trace?  
A: CPU profile shows where CPU samples are spent. Trace shows timeline behavior: goroutines, blocking, syscalls, network, GC, and scheduler events.

Q: Why can latency be high when CPU is low?  
A: Work may be blocked on locks, channels, DB, network, queues, or rate limits.

Q: What is saturation?  
A: A resource nearing capacity, such as DB pool waits, full queues, high CPU, memory limit pressure, or exhausted connection pools.

Q: Why are high-cardinality metrics dangerous?  
A: They create too many time series, increasing cost and making queries slow or unstable.

Exercises:

1. Benchmark JSON encoding of structs versus `map[string]any`.
2. Add pprof to a local service on an internal-only port.
3. Create lock contention intentionally and inspect a mutex profile.
4. Use block profile to find goroutines stuck on channel sends.
5. Create a dashboard checklist for a Go API.

## 18. Production engineering

### Service lifecycle

```go
func main() {
    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer stop()
    srv := newServer()
    go func() { if err := srv.ListenAndServe(); err != http.ErrServerClosed { log.Fatal(err) } }()
    <-ctx.Done()
    shut, cancel := context.WithTimeout(context.Background(), 20*time.Second); defer cancel()
    if err := srv.Shutdown(shut); err != nil { log.Printf("shutdown: %v", err) }
}
```

Configuration comes from explicit environment variables/files/secrets, is validated at startup, and never silently falls back from a production secret to an insecure default. Health checks differ: *liveness* means the process can recover by restart; *readiness* means it can accept traffic. Make startup, graceful shutdown, and in-flight request draining intentional.

For databases: use context deadlines, parameterized queries, migrations reviewed as production code, connection pool limits, transactions with clear isolation assumptions, and idempotent consumers/outbox patterns for external events. Retry only transient failures, with exponential backoff, jitter, a deadline, and a bound. Circuit breaking, queues, rate limiting, and bulkheads prevent cascading failure.

**Security baseline.** Least-privilege credentials; TLS; dependency scanning; request/body/time limits; authentication plus authorization; validation at every trust boundary; secret rotation; immutable audit records where required. `go vet`, static analysis, tests, and reproducible builds belong in CI.

### Production service lifecycle

A production Go service should have a deliberate lifecycle.

```text
boot
  -> parse config
  -> validate config
  -> initialize logger/metrics/tracing
  -> connect dependencies
  -> warm required caches if needed
  -> start HTTP/gRPC listeners
  -> start background workers
  -> mark readiness true
  -> serve traffic
  -> receive shutdown signal
  -> mark readiness false
  -> stop accepting new traffic
  -> drain in-flight requests
  -> stop workers
  -> close dependencies
  -> exit
```

Graceful shutdown with HTTP plus workers:

```go
func Run(ctx context.Context, srv *http.Server, workers *WorkerGroup) error {
    ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    errCh := make(chan error, 1)
    go func() {
        if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
            errCh <- err
            return
        }
        errCh <- nil
    }()

    select {
    case <-ctx.Done():
    case err := <-errCh:
        return err
    }

    shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
    defer cancel()

    workers.Stop()
    if err := srv.Shutdown(shutdownCtx); err != nil {
        return err
    }
    return workers.Wait(shutdownCtx)
}
```

### Health checks

Liveness and readiness are different.

```text
liveness: should the process be restarted?
readiness: should traffic be sent here?
```

Good readiness may check:

- Config loaded.
- Required dependencies reachable.
- DB pool usable.
- Migrations compatible.
- Worker dependencies ready.
- Service not shutting down.

Bad readiness:

```text
return 200 if process is alive
```

That is liveness, not readiness.

### Configuration

Production config rules:

- Validate at startup.
- Fail fast on missing required values.
- Never silently use insecure production defaults.
- Keep secrets out of logs.
- Make timeouts and pool sizes explicit.
- Separate config from code.

```go
type Config struct {
    Env             string
    Addr            string
    DatabaseURL     string
    ShutdownTimeout time.Duration
    ReadTimeout     time.Duration
}

func (c Config) Validate() error {
    if c.Env == "prod" && c.DatabaseURL == "" {
        return errors.New("DATABASE_URL is required in prod")
    }
    if c.ShutdownTimeout <= 0 {
        return errors.New("shutdown timeout must be positive")
    }
    return nil
}
```

### Database production concerns

`sql.DB` is a pool.

```go
db.SetMaxOpenConns(30)
db.SetMaxIdleConns(30)
db.SetConnMaxLifetime(30 * time.Minute)
```

Track:

- Open connections.
- In-use connections.
- Idle connections.
- Wait count.
- Wait duration.
- Query latency.
- Transaction duration.

Transaction rules:

- Keep transactions short.
- Do not call slow external services inside transactions unless absolutely required.
- Use context deadlines.
- Use isolation levels intentionally.
- Use unique constraints for idempotency and invariants.
- Check `rows.Err()`.
- Close rows.

### Resilience patterns

Timeout:

```go
ctx, cancel := context.WithTimeout(parent, 2*time.Second)
defer cancel()
```

Retry with rules:

```text
retry only transient errors
retry only idempotent operations or operations with idempotency key
use exponential backoff
add jitter
respect caller deadline
set max attempts
```

Circuit breaker:

```text
closed -> normal calls
open -> fail fast
half-open -> test limited calls
```

Bulkhead:

```text
dependency A has its own worker/concurrency limit
dependency B has its own worker/concurrency limit
failure in A cannot consume all resources
```

### Idempotency

High-quality backend systems are designed for retries.

```text
client sends Idempotency-Key
  -> server stores request hash and response
  -> retry with same key returns same response
  -> same key with different request is rejected
```

Table:

```text
idempotency_keys
  key
  request_hash
  status
  response_body
  created_at
```

Use cases:

- Payments.
- Order creation.
- External provider calls.
- Queue consumers.
- Webhook handlers.

### Outbox pattern

Problem: you update DB and publish an event. One can succeed while the other fails.

Outbox solution:

```text
transaction:
  update business table
  insert outbox event

background publisher:
  read unpublished outbox events
  publish to broker
  mark published
```

Benefits:

- Local DB state and event record commit atomically.
- Publisher can retry.
- Consumers should still be idempotent.

### Security production checklist

- Authentication at boundary.
- Authorization near business action.
- Validate input.
- Limit request bodies.
- Use parameterized SQL.
- Use TLS.
- Protect admin/pprof endpoints.
- Redact secrets in logs.
- Rotate credentials.
- Keep dependencies patched.
- Audit sensitive actions.

### Incident response

Production incident loop:

```text
detect -> triage -> mitigate -> diagnose -> fix -> verify -> postmortem
```

Senior behavior:

- Roll back when user impact is high and diagnosis is uncertain.
- Preserve evidence.
- Communicate status clearly.
- Separate mitigation from root cause fix.
- Add alerts/tests/docs after resolution.

Interview Q&A:

Q: What should happen during graceful shutdown?  
A: Readiness false, stop accepting new work, allow in-flight work to finish with deadline, stop workers, close dependencies.

Q: How do you avoid retry storms?  
A: Bound retries, use backoff and jitter, respect deadlines, add circuit breakers, and avoid retrying non-idempotent operations.

Q: Why is idempotency important?  
A: Networks fail ambiguously; clients retry. Idempotency prevents duplicate side effects.

Exercises:

1. Add graceful shutdown to an HTTP service with background workers.
2. Implement readiness that turns false during shutdown.
3. Design idempotent order creation.
4. Implement outbox tables and a publisher loop.
5. Add DB pool metrics to a service checklist.

## 19. Design patterns and low-level design

Go favors composition, functions, and small interfaces over class hierarchies.

### Functional options

```go
type Client struct { timeout time.Duration; baseURL string }
type Option func(*Client) error
func WithTimeout(d time.Duration) Option { return func(c *Client) error { if d <= 0 { return errors.New("timeout") }; c.timeout=d; return nil } }
func NewClient(opts ...Option) (*Client, error) { c:=&Client{timeout:5*time.Second}; for _, o:=range opts { if err:=o(c); err!=nil{return nil,err} }; return c,nil }
```

Use this when configuration is optional and likely to grow; avoid it for required arguments that should stay obvious in the constructor signature.

### Repository/service boundary

```go
type OrderStore interface { Save(context.Context, Order) error }
type OrderService struct { store OrderStore; clock func() time.Time }
func (s OrderService) Place(ctx context.Context, o Order) error {
    if o.ID == "" || len(o.Items) == 0 { return errors.New("invalid order") }
    o.CreatedAt = s.clock(); return s.store.Save(ctx, o)
}
```

Keep domain rules in the service/domain layer; adapters implement storage and transport. The interface sits with `OrderService`, which makes unit testing straightforward without making the entire application abstract.

### LLD: rate limiter

Token bucket state: capacity `C`, refill rate `r`, tokens `t`, last update. On a request, refill `min(C, t + r*elapsed)`; allow only if `t >= cost`, then decrement. Per-key limiters need bounded cardinality and eviction; a distributed limiter needs an atomic backend operation (for example Lua in Redis) and must define behavior when that backend is unavailable.

```
request -> authenticate -> key -> token bucket -> allow/reject
                                  |       ^
                                  └ refill┘
```

### LLD: job queue

Persist jobs before acknowledging submission, claim work atomically, make handlers idempotent, record attempts, and place exhausted jobs in a dead-letter workflow. Visibility timeouts require heartbeats or leases; at-least-once delivery means duplicates are normal, not exceptional.

### How to approach LLD in Go

For senior Go interviews, do not jump straight to code. Start with invariants.

```text
1. Clarify requirements.
2. Define API.
3. Define data structures.
4. Define invariants.
5. Define concurrency strategy.
6. Define error behavior.
7. Define observability.
8. Define tests.
9. Discuss tradeoffs.
```

Good Go LLD is usually:

- Small interfaces.
- Concrete structs.
- Clear ownership.
- Explicit errors.
- Bounded resources.
- Context-aware I/O.
- Simple synchronization.

### Pattern: constructor with validation

```go
type TokenBucket struct {
    mu       sync.Mutex
    capacity float64
    tokens   float64
    rate     float64
    last     time.Time
    now      func() time.Time
}

func NewTokenBucket(capacity, rate float64, now func() time.Time) (*TokenBucket, error) {
    if capacity <= 0 {
        return nil, errors.New("capacity must be positive")
    }
    if rate <= 0 {
        return nil, errors.New("rate must be positive")
    }
    if now == nil {
        now = time.Now
    }
    t := now()
    return &TokenBucket{
        capacity: capacity,
        tokens:   capacity,
        rate:     rate,
        last:     t,
        now:      now,
    }, nil
}
```

Why this is senior:

- Invalid states are rejected early.
- Clock is injectable for tests.
- State is unexported.
- Mutex protects bucket invariants.

### LLD: token bucket implementation

```go
func (b *TokenBucket) Allow(cost float64) bool {
    b.mu.Lock()
    defer b.mu.Unlock()

    if cost <= 0 {
        return false
    }

    now := b.now()
    elapsed := now.Sub(b.last).Seconds()
    b.last = now

    b.tokens = math.Min(b.capacity, b.tokens+elapsed*b.rate)
    if b.tokens < cost {
        return false
    }
    b.tokens -= cost
    return true
}
```

Invariants:

```text
0 <= tokens <= capacity
rate > 0
capacity > 0
last moves forward according to clock
all mutation happens under lock
```

Interview discussion:

- Per-key limiters need a map and eviction.
- Distributed limiters need atomic central state.
- Redis Lua can perform refill and decrement atomically.
- Fail-open versus fail-closed is a product decision.

### LLD: LRU cache

Data structure:

```text
map[K]*list.Element
doubly linked list of entries
front = most recently used
back = least recently used
```

Implementation sketch:

```go
type entry[K comparable, V any] struct {
    key   K
    value V
}

type LRU[K comparable, V any] struct {
    mu       sync.Mutex
    capacity int
    ll       *list.List
    items    map[K]*list.Element
}

func NewLRU[K comparable, V any](capacity int) (*LRU[K, V], error) {
    if capacity <= 0 {
        return nil, errors.New("capacity must be positive")
    }
    return &LRU[K, V]{
        capacity: capacity,
        ll:       list.New(),
        items:    make(map[K]*list.Element, capacity),
    }, nil
}

func (c *LRU[K, V]) Get(k K) (V, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()

    if elem, ok := c.items[k]; ok {
        c.ll.MoveToFront(elem)
        return elem.Value.(entry[K, V]).value, true
    }
    var zero V
    return zero, false
}
```

Invariants:

- Every map key points to exactly one list element.
- Every list element has a matching map key.
- List length never exceeds capacity.
- All map and list mutations happen under one lock.

Pitfalls:

- Forgetting to delete map key on eviction.
- Returning mutable values without ownership rules.
- Using two locks for map and list and breaking invariants.

### LLD: idempotent API

Use for payments, order creation, webhooks, and retries.

Flow:

```text
request with Idempotency-Key
  -> hash request body
  -> begin transaction
  -> check existing key
      -> same hash: return stored response
      -> different hash: reject
  -> perform business operation
  -> store response with key
  -> commit
```

Key table:

```text
idempotency_key
request_hash
status_code
response_body
created_at
expires_at
```

Go service boundary:

```go
type IdempotencyStore interface {
    Load(context.Context, string) (StoredResponse, error)
    Save(context.Context, IdempotencyRecord) error
}
```

Senior tradeoffs:

- How long should keys live?
- What if response contains user-specific authorization data?
- Should failed requests be stored?
- What if DB commit succeeds but response write fails?

### LLD: file upload service

Requirements:

- Limit upload size.
- Stream to disk/object storage.
- Validate file type.
- Compute checksum while streaming.
- Store metadata.
- Make final write atomic where possible.
- Clean temp files on failure.

Flow:

```text
HTTP request
  -> auth
  -> MaxBytesReader
  -> stream to temp file
  -> hash while streaming
  -> fsync/close
  -> rename final path
  -> save metadata
```

Go pattern:

```go
func SaveUpload(dst string, r io.Reader, limit int64) (string, error) {
    limited := io.LimitReader(r, limit)
    h := sha256.New()
    tee := io.TeeReader(limited, h)

    tmp, err := os.CreateTemp(filepath.Dir(dst), ".upload-*")
    if err != nil {
        return "", err
    }
    tmpName := tmp.Name()
    defer os.Remove(tmpName)

    if _, err := io.Copy(tmp, tee); err != nil {
        tmp.Close()
        return "", err
    }
    if err := tmp.Close(); err != nil {
        return "", err
    }
    if err := os.Rename(tmpName, dst); err != nil {
        return "", err
    }
    return hex.EncodeToString(h.Sum(nil)), nil
}
```

Interview tradeoffs:

- Local disk versus object storage.
- Virus scanning.
- Async processing.
- Metadata transaction ordering.
- Cleanup after partial failure.
- Download authorization.

### LLD: notification service

Design:

```text
API -> notification request -> DB record -> outbox -> worker -> provider
```

Why outbox:

- Request should persist intent.
- Provider call can fail.
- Worker can retry.
- Duplicate sends need idempotency/provider keys.

Interfaces:

```go
type NotificationStore interface {
    Create(context.Context, Notification) error
    MarkSent(context.Context, string) error
    MarkFailed(context.Context, string, error) error
}

type Sender interface {
    Send(context.Context, Notification) error
}
```

Observability:

- Send latency.
- Provider error rate.
- Retry count.
- Dead-letter count.
- Queue depth.

### LLD interview problems to practice

Practice these until you can explain data structures and failure modes clearly:

- LRU cache.
- TTL cache.
- Token bucket rate limiter.
- Worker pool.
- Durable job queue.
- URL shortener.
- File upload service.
- Idempotent payment API.
- Inventory reservation system.
- Notification service.
- Metrics ingestion pipeline.

For each problem, write:

```text
API
data model
invariants
concurrency model
error behavior
observability
tests
tradeoffs
```

### LLD exercises

1. Implement a generic LRU cache with tests for eviction order.
2. Add TTL to the cache and inject a fake clock.
3. Implement a token bucket with per-key limiters and cleanup.
4. Design idempotent order creation with SQL uniqueness constraints.
5. Design a file upload service and list every failure point.
6. Implement a notification outbox worker with retry and dead-letter.

### Senior deep dive: goroutines, scheduler, and context

For a 5-year Go developer, it is not enough to say “goroutines are lightweight.” You should understand what makes them cheap, when they become expensive, and how their lifetime is controlled.

Goroutines are scheduled by the Go runtime, not directly by the operating system. The scheduler uses the G-M-P model:

```text
G = goroutine: user-level execution unit
M = machine: OS thread
P = processor: runtime resource required to execute Go code

               global run queue
                     |
                     v
local run queue -> P0 -> M0 -> CPU
local run queue -> P1 -> M1 -> CPU
```

`GOMAXPROCS` controls how many P values can execute Go code simultaneously. If `GOMAXPROCS=4`, at most four goroutines run Go code at the same instant, though many more may be runnable, blocked, or waiting on I/O.

Scheduler states:

```text
new -> runnable -> running -> waiting
                  ^   |
                  |   v
              preempted / syscall / channel / timer / network poller
```

Important runtime behavior:

- A goroutine starts with a small stack that grows and shrinks as needed.
- Blocking channel operations park goroutines.
- Blocking network I/O normally integrates with the runtime network poller.
- Blocking syscalls can cause the runtime to detach the P and keep other goroutines moving.
- Work stealing lets an idle P steal runnable goroutines from another P.
- Preemption prevents long-running goroutines from starving the scheduler.

Context is not a scheduler primitive. It is a cancellation and deadline propagation API. The scheduler does not kill a goroutine because its context is canceled; the goroutine must observe cancellation.

```go
func Worker(ctx context.Context, jobs <-chan Job, results chan<- Result) error {
    for {
        select {
        case <-ctx.Done():
            return ctx.Err()
        case job, ok := <-jobs:
            if !ok {
                return nil
            }
            result, err := job.Run(ctx)
            if err != nil {
                return err
            }
            select {
            case results <- result:
            case <-ctx.Done():
                return ctx.Err()
            }
        }
    }
}
```

Senior-level pitfalls:

- Starting goroutines inside request handlers without a clear owner.
- Using `context.Background()` inside request-scoped work.
- Ignoring cancellation during sends to result channels.
- Assuming `go func()` makes slow work faster when the bottleneck is DB pool, CPU, or remote service capacity.
- Creating unbounded fan-out from user input.
- Forgetting to stop tickers and timers.
- Leaking goroutines that wait forever on channels no one will close.

Goroutine leak example:

```go
func BadSearch(ctx context.Context, q string) <-chan Result {
    out := make(chan Result)
    go func() {
        result := slowSearch(q)
        out <- result // can block forever if caller returns early
    }()
    return out
}
```

Fixed:

```go
func GoodSearch(ctx context.Context, q string) <-chan Result {
    out := make(chan Result, 1)
    go func() {
        defer close(out)
        result := slowSearch(q)
        select {
        case out <- result:
        case <-ctx.Done():
        }
    }()
    return out
}
```

Interview prompts:

- Explain G-M-P scheduling.
- What happens when a goroutine blocks on network I/O?
- Why is `GOMAXPROCS` not the same as number of goroutines?
- How do you detect goroutine leaks?
- Why does context cancellation not stop a goroutine automatically?
- How would you design graceful shutdown for workers?

Strong answer pattern: describe ownership, cancellation, bounded concurrency, backpressure, and waiting. A senior answer talks about the lifecycle of every goroutine, not only how to start it.

### Senior deep dive: channels and concurrency patterns

Channels are synchronization tools, not generic queues. They shine when ownership or events move between goroutines.

Channel operation matrix:

```text
operation              nil channel       open channel              closed channel
send                   blocks forever    sends or blocks           panic
receive                blocks forever    receives or blocks        zero value, ok=false after drain
close                  panic             closes                    panic
range                  blocks forever    receives until closed     ends after drain
```

Unbuffered channel:

```text
sender waits <---- rendezvous ----> receiver waits
```

Buffered channel:

```text
sender -> [ buffer capacity N ] -> receiver
```

A buffer is not a worker pool. It is a small shock absorber. If producers can permanently outpace consumers, a buffer only delays failure.

Fan-out/fan-in:

```go
func FanOut(ctx context.Context, in <-chan Job, workers int) <-chan Result {
    out := make(chan Result)
    var wg sync.WaitGroup

    worker := func() {
        defer wg.Done()
        for {
            select {
            case <-ctx.Done():
                return
            case job, ok := <-in:
                if !ok {
                    return
                }
                result := job.Process()
                select {
                case out <- result:
                case <-ctx.Done():
                    return
                }
            }
        }
    }

    wg.Add(workers)
    for i := 0; i < workers; i++ {
        go worker()
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}
```

Pipeline rule:

```text
stage owns closing its output
stage drains or cancels its input
stage exits on context cancellation
```

`select` details:

- If multiple cases are ready, one is chosen pseudo-randomly.
- `default` makes the select non-blocking.
- A nil channel disables its case.
- A closed channel is always ready to receive.

Priority select pattern:

```go
select {
case <-ctx.Done():
    return ctx.Err()
default:
}

select {
case <-ctx.Done():
    return ctx.Err()
case job := <-jobs:
    return handle(job)
}
```

This checks cancellation first, then performs normal blocking work.

Backpressure design:

```text
incoming request
  -> bounded queue
  -> fixed workers
  -> dependency with known capacity
  -> reject / timeout when full
```

Senior-level pitfalls:

- Closing a channel from the receiver.
- Sending after close because multiple senders do not coordinate ownership.
- Using `time.After` in loops and creating many timers.
- Adding `default` and accidentally creating a busy loop.
- Forgetting that receiving from a closed channel returns immediately forever.
- Treating channel close as “free memory cleanup”; it is a signal.

Interview prompts:

- How do you stop a pipeline early without leaking goroutines?
- How do you merge N channels safely?
- When is a mutex better than a channel?
- What happens if a closed channel is inside a `select`?
- How do you implement bounded parallelism?

Senior answer pattern: choose channels when the model is ownership transfer, event delivery, or cancellation-aware coordination. Choose locks when the model is protecting shared state.

### Senior deep dive: locks, atomics, and sync primitives

The central question is not “mutex or atomic?” The question is: what invariant must remain true while concurrent code runs?

Mutex protects compound invariants:

```go
type Account struct {
    mu      sync.Mutex
    balance int64
    holds   map[string]int64
}

func (a *Account) Reserve(id string, amount int64) error {
    a.mu.Lock()
    defer a.mu.Unlock()

    if amount <= 0 {
        return errors.New("amount must be positive")
    }
    if a.balance < amount {
        return errors.New("insufficient funds")
    }
    a.balance -= amount
    a.holds[id] = amount
    return nil
}
```

An atomic counter is good for one independent value:

```go
type Metrics struct {
    requests atomic.Int64
    failures atomic.Int64
}

func (m *Metrics) Record(err error) {
    m.requests.Add(1)
    if err != nil {
        m.failures.Add(1)
    }
}
```

But atomics are poor for multi-field invariants:

```go
// Bad idea: these two values can be observed inconsistently.
var available atomic.Int64
var reserved atomic.Int64
```

Use `sync.RWMutex` only when:

- Reads dominate writes.
- Read critical sections are meaningfully expensive.
- The lock is not constantly upgraded or contended by writers.
- Measurement shows benefit.

`sync.Once`:

```go
type LazyClient struct {
    once sync.Once
    c    *http.Client
}

func (l *LazyClient) Client() *http.Client {
    l.once.Do(func() {
        l.c = &http.Client{Timeout: 10 * time.Second}
    })
    return l.c
}
```

`sync.Cond` is useful when goroutines must wait for a condition protected by a lock.

```go
type Queue struct {
    mu   sync.Mutex
    cond *sync.Cond
    xs   []Job
}

func NewQueue() *Queue {
    q := &Queue{}
    q.cond = sync.NewCond(&q.mu)
    return q
}

func (q *Queue) Push(j Job) {
    q.mu.Lock()
    q.xs = append(q.xs, j)
    q.cond.Signal()
    q.mu.Unlock()
}

func (q *Queue) Pop() Job {
    q.mu.Lock()
    defer q.mu.Unlock()
    for len(q.xs) == 0 {
        q.cond.Wait()
    }
    j := q.xs[0]
    q.xs[0] = Job{}
    q.xs = q.xs[1:]
    return j
}
```

Memory model interview must-knows:

- Unlock happens-before a later lock on the same mutex.
- A send happens-before the corresponding receive.
- Closing a channel happens-before a receive that observes close.
- Atomic operations provide synchronization for that atomic variable.
- Data-race-free programs behave predictably.

Senior-level pitfalls:

- Copying a mutex, wait group, or condition after use.
- Calling `wg.Add(1)` inside the goroutine instead of before starting it.
- Holding locks while doing HTTP, DB, filesystem, or logging work.
- Mixing atomic and normal access to the same variable.
- Using `sync.Map` as a default map replacement.
- Assuming `RWMutex` is always faster.

Interview prompts:

- Explain happens-before.
- Why can a program with data races behave strangely even if it “works locally”?
- When would you use `sync.Map`?
- How do you debug lock contention?
- What is false sharing and why can it hurt atomic-heavy code?

Senior answer pattern: identify the shared state, define the invariant, pick the synchronization primitive that protects that invariant clearly, then measure contention.

### Senior deep dive: runtime internals and garbage collection

The Go runtime is part of every normal Go binary. It provides scheduling, memory allocation, garbage collection, timers, maps, channels, defer/panic, reflection support, and network polling.

Allocator overview:

```text
small object allocation
  goroutine asks runtime
  -> P-local cache
  -> span
  -> heap arena

large object allocation
  -> runtime heap path
  -> one or more spans
```

GC overview:

```text
1. brief stop-the-world setup
2. concurrent marking
3. write barriers keep graph correct
4. mark termination
5. sweeping and reuse
```

Tri-color marking:

```text
white = not yet proven reachable
gray  = reachable, children not scanned
black = reachable, children scanned
```

GC roots:

- Goroutine stacks.
- Global variables.
- Runtime metadata.
- Registers.
- Finalizer queues and other runtime-managed references.

What makes GC expensive:

- Large live heap.
- Pointer-rich object graphs.
- High allocation rate.
- Retained objects through caches, maps, goroutines, and slices.
- Too many long-lived objects promoted into the live set.

The most important distinction:

```text
allocation pressure = how fast new objects are created
retention pressure  = how much memory remains reachable
scan pressure       = how many pointers the GC must trace
```

Reducing retained heap usually matters more than randomly reducing small allocations.

Common memory leak patterns:

```go
// 1. Tiny slice keeps huge backing array alive.
func Header(buf []byte) []byte {
    return buf[:100]
}

// 2. Map cache grows forever.
var cache = map[string]*User{}

// 3. Goroutine retains request data forever.
go func() {
    <-neverClosed
    use(bigRequest)
}()
```

Fixed slice retention:

```go
func HeaderCopy(buf []byte) []byte {
    out := make([]byte, min(100, len(buf)))
    copy(out, buf)
    return out
}
```

`sync.Pool`:

- Good for hot temporary objects.
- Cleared at GC cycles.
- Not a cache with durability guarantees.
- Dangerous for sensitive data unless reset carefully.

```go
var buffers = sync.Pool{
    New: func() any {
        b := make([]byte, 0, 64*1024)
        return &b
    },
}
```

Runtime diagnostics:

```bash
GODEBUG=gctrace=1 ./app
go tool pprof heap.out
go tool pprof allocs.out
go tool trace trace.out
```

Senior-level pitfalls:

- Calling `runtime.GC()` in request paths.
- Assuming heap profile `inuse_space` and allocation profile answer the same question.
- Optimizing allocation count while retaining huge live data.
- Keeping pointers in large structs where values would reduce scan work.
- Depending on runtime internals that can change between Go releases.

Interview prompts:

- Explain stack versus heap in Go.
- What is escape analysis?
- Why can a pointer-heavy design slow down Go?
- How does a tiny subslice retain a big array?
- What is the difference between heap allocation and retained heap?
- How would you investigate rising memory usage in production?

Senior answer pattern: start with symptoms, capture heap and goroutine profiles, distinguish allocation from retention, identify retaining paths, fix ownership or bounds, then verify with before/after profiles.

### Senior deep dive: performance and observability

Senior Go performance work is not “make code clever.” It is disciplined measurement.

Performance loop:

```text
define SLO -> reproduce workload -> benchmark/profile -> identify bottleneck -> change one thing -> compare -> keep or revert
```

Profiles:

```text
cpu profile      where CPU time is spent
heap inuse       what memory is currently retained
heap allocs      where allocations are created
mutex profile    lock contention
block profile    goroutines blocked on sync/channel
trace            scheduling, syscalls, network, GC, goroutine lifetimes
```

Benchmark rules:

```go
func BenchmarkBuildResponse(b *testing.B) {
    input := makeTestInput()
    b.ReportAllocs()
    b.ResetTimer()

    for i := 0; i < b.N; i++ {
        got := BuildResponse(input)
        if len(got.Items) == 0 {
            b.Fatal("unexpected empty response")
        }
    }
}
```

Avoid benchmark traps:

- Benchmarking unrealistic tiny inputs.
- Letting compiler eliminate unused results.
- Comparing noisy results without repeated runs.
- Ignoring allocations.
- Optimizing a non-hot path.

Common Go performance wins:

- Preallocate slices and maps.
- Avoid repeated `string`/`[]byte` conversions.
- Stream large payloads.
- Avoid `map[string]any` in hot JSON paths.
- Use value slices instead of pointer slices when ownership is simple.
- Batch database and network calls.
- Bound concurrency to dependency capacity.
- Remove lock contention by sharding or changing ownership.

Observability for Go services:

```text
RED: rate, errors, duration
USE: utilization, saturation, errors
```

Minimum metrics:

- HTTP request count by route, method, status.
- Request latency histogram.
- External dependency latency and error count.
- DB pool open/in-use/wait counts.
- Goroutine count.
- Heap in use.
- GC pause and cycle metrics.
- Queue depth and worker failures.

Logging rules:

- Use structured logs.
- Include request ID or trace ID.
- Do not log secrets or raw tokens.
- Log errors once at boundaries.
- Use stable field names.

Tracing rules:

- Trace cross-service requests.
- Add spans around DB, HTTP, queue, and expensive internal operations.
- Do not put high-cardinality raw data everywhere.
- Sample deliberately.

Senior interview incident scenario:

```text
P95 latency doubled after deployment.
What do you do?
```

Strong answer:

1. Compare dashboards before and after deployment.
2. Check request rate, error rate, saturation, DB pool waits, downstream latency.
3. Capture CPU, heap, goroutine, mutex, and block profiles.
4. Check traces for changed critical path.
5. Roll back if user impact is high and diagnosis is not immediate.
6. Reproduce in staging or load test.
7. Patch the root cause and add regression tests/alerts.

Interview prompts:

- Difference between CPU and wall-clock latency?
- How do you find lock contention?
- What does `allocs/op` tell you?
- Why can lowering allocations improve latency?
- When would you use `go tool trace` instead of pprof?

### Senior deep dive: production engineering

Production Go is mostly about bounding failure.

Service lifecycle:

```text
start
  -> load config
  -> validate config
  -> initialize logger/metrics/tracing
  -> connect dependencies
  -> run migrations separately or safely
  -> start listeners/workers
  -> readiness true
  -> receive shutdown signal
  -> readiness false
  -> stop accepting work
  -> drain in-flight work
  -> close dependencies
  -> exit
```

Graceful shutdown detail:

```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer stop()

srvErr := make(chan error, 1)
go func() {
    srvErr <- srv.ListenAndServe()
}()

select {
case <-ctx.Done():
case err := <-srvErr:
    if !errors.Is(err, http.ErrServerClosed) {
        return err
    }
}

shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
defer cancel()
return srv.Shutdown(shutdownCtx)
```

Readiness versus liveness:

```text
liveness: should the orchestrator restart me?
readiness: should the load balancer send me traffic?
```

Dependency rules:

- Every network call has a timeout.
- Every retry has a budget and jitter.
- Every queue has a maximum depth or rejection path.
- Every worker has shutdown behavior.
- Every database pool has limits.
- Every external write has idempotency if clients may retry.

Database production details:

- Keep transactions short.
- Do not call external services inside a DB transaction.
- Know isolation requirements.
- Use unique constraints for idempotency and invariants.
- Track DB pool waits as a saturation signal.
- Handle migrations as a deploy risk.

Deployment safety:

- Backward-compatible schema migrations.
- Feature flags for risky behavior changes.
- Rollback plan.
- Versioned APIs.
- Alerts tied to user impact, not only process health.

Senior-level pitfalls:

- Health check says OK while DB pool is exhausted.
- Readiness stays true during shutdown.
- Retries amplify an outage.
- Workers stop without finishing or releasing leases.
- Logs contain tokens or personal data.
- Migrations lock large tables during peak traffic.
- Config defaults silently point production at local services.

Interview prompts:

- Design graceful shutdown for HTTP plus background workers.
- How do you avoid retry storms?
- How do you roll out a database migration safely?
- What should readiness check?
- What metrics indicate saturation?

### Senior deep dive: design patterns and low-level design

A 5-year Go interview often tests whether you can design simple systems with clear ownership, not whether you know many pattern names.

Design principles:

- Keep interfaces small.
- Put interfaces at the consumer side.
- Return concrete types from constructors.
- Keep domain rules away from transport and storage.
- Make concurrency ownership explicit.
- Make failure modes part of the design.
- Prefer boring data structures with clear invariants.

LLD checklist:

```text
requirements
  -> APIs
  -> data model
  -> invariants
  -> concurrency model
  -> persistence model
  -> failure handling
  -> observability
  -> tests
  -> tradeoffs
```

Example: in-memory expiring cache.

```go
type Cache[K comparable, V any] struct {
    mu    sync.Mutex
    now   func() time.Time
    items map[K]cacheItem[V]
}

type cacheItem[V any] struct {
    value     V
    expiresAt time.Time
}

func (c *Cache[K, V]) Get(k K) (V, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()

    item, ok := c.items[k]
    if !ok || c.now().After(item.expiresAt) {
        var zero V
        delete(c.items, k)
        return zero, false
    }
    return item.value, true
}
```

Discussion points:

- Mutex protects map and expiry invariant together.
- Injected clock makes tests deterministic.
- Lazy eviction is simple but expired items may remain until accessed.
- Background eviction needs a goroutine lifecycle.
- Returning `V` can expose mutable values depending on type.

Example: idempotent order creation.

```text
client sends Idempotency-Key
  -> service validates request
  -> transaction checks existing key
  -> if exists, return stored response
  -> else create order and store response under key
  -> commit
```

Schema concept:

```text
idempotency_keys
  key unique
  request_hash
  response_body
  status_code
  created_at
```

Important tradeoffs:

- Same key with different request body should be rejected.
- Key records need retention policy.
- Stored response must not leak stale authorization context.
- Unique constraint is the real concurrency protection.

Example: worker pool design.

```text
submitter -> bounded queue -> N workers -> handler -> ack/retry/dead-letter
```

Questions to answer:

- What happens when queue is full?
- Are jobs at-most-once or at-least-once?
- How are duplicates handled?
- What is the retry policy?
- How are stuck jobs recovered?
- How does shutdown work?
- What metrics exist?

Example: rate limiter LLD.

```text
local limiter:
  map[key]*bucket protected by mutex
  cleanup old buckets

distributed limiter:
  Redis key per actor
  Lua script for atomic refill/check/decrement
  TTL for inactive keys
```

Interview prompts:

- Design an LRU cache in Go.
- Design a worker pool with retries and shutdown.
- Design a URL shortener.
- Design a rate limiter for multiple service instances.
- Design an idempotent payment API.
- Design a file upload service with atomic writes.

Senior answer pattern: present invariants first, then data structures, then synchronization, then failure modes, then observability and tests.

## 20. Interview preparation and exercises

### High-value questions with answers

1. **Slice versus array?** An array has fixed length in its type and copies as a value. A slice is a descriptor (pointer, length, capacity) over an array.
2. **What is a nil interface?** Both dynamic type and dynamic value are absent. An interface containing a nil `*T` is non-nil.
3. **Who closes a channel?** Normally the sending side, once no further values will be sent. Receivers do not close a shared input channel.
4. **What does `defer` capture?** Deferred call arguments are evaluated when `defer` executes; the call runs as the function exits.
5. **What does the race detector prove?** It detects races exercised by that run; it does not prove the absence of all races.
6. **Why pass context?** To carry cancellation/deadline and request-scoped metadata across API boundaries, preventing wasted work and leaks.
7. **What is escape analysis?** Compiler analysis deciding whether a value’s lifetime requires heap allocation rather than stack allocation.
8. **Why must HTTP response bodies be closed?** Closing allows the transport to release or reuse the underlying connection.
9. **Mutex or channel?** Use a mutex to protect shared state; a channel when communicating ownership/events or coordinating pipelines. Choose the clearest invariant.
10. **How do you reduce GC pressure?** Profile retention/allocation, remove unnecessary object lifetimes and pointer-heavy structures, batch/reuse only in measured hot paths.

### Exercises

1. Implement `ParseID(string) (uint64, error)` with strict validation and table tests.
2. Build a cancellable pipeline that reads lines, validates JSON, and writes accepted records without goroutine leaks.
3. Write an LRU cache with a mutex, capacity bound, and race-detector test.
4. Create an HTTP client wrapper with retries for idempotent requests, deadline awareness, jitter, and tests using `httptest`.
5. Implement a worker pool that returns the first error and proves all workers exit.
6. Profile a deliberately allocation-heavy encoder; improve it only after recording benchmark and profile evidence.
7. Design an order API: idempotent create, pagination, error schema, authz, SQL transaction boundary, and graceful shutdown behavior.

### Answer rubric

A strong solution states invariants, handles cancellation and error paths, bounds resources, tests edge cases, documents tradeoffs, and measures performance claims. A polished implementation that leaks goroutines or accepts unbounded input is not production-ready.

### Senior interview preparation map

Prepare in layers:

```text
language basics
  -> concurrency
  -> runtime/memory
  -> production engineering
  -> LLD/system design
  -> production stories
```

For each topic, prepare:

- Definition.
- Code example.
- Common bug.
- Production incident angle.
- Debugging method.
- Tradeoff.

Example:

```text
Topic: channels
Definition: typed synchronization primitive.
Code: worker pool/fan-in.
Bug: goroutine leak from blocked send.
Debug: goroutine and block profiles.
Tradeoff: channel for ownership transfer, mutex for shared state.
```

### Behavioral story format

Use:

```text
Context -> Problem -> Action -> Tradeoff -> Result -> Learning
```

Example:

```text
Context: Go ingestion service processing large files.
Problem: memory grew after large uploads.
Action: captured heap profiles and found subslices retaining full files.
Tradeoff: copied header bytes, adding tiny CPU cost to release huge backing arrays.
Result: heap in-use dropped and GC frequency reduced.
Learning: added memory-retention tests and profile checklist.
```

### Mock interview drills

1. Explain the Go scheduler in two minutes.
2. Debug a goroutine leak from a code snippet.
3. Design an LRU cache with TTL.
4. Design an idempotent payment API.
5. Explain `errors.Is`, `errors.As`, and typed nil.
6. Investigate P99 latency increase.
7. Explain stack versus heap and escape analysis.
8. Build a worker pool with cancellation.

## 21. Cheat sheet

```go
// construct
s := make([]T, 0, n); m := make(map[K]V, n); ch := make(chan T, n)
// clone
s2 := append([]T(nil), s...); maps.Copy(m2, m1)
// error wrapping/checking
err = fmt.Errorf("op: %w", err); errors.Is(err, target); errors.As(err, &typed)
// cancellation
ctx, cancel := context.WithTimeout(parent, d); defer cancel()
// synchronization
mu.Lock(); defer mu.Unlock(); wg.Add(1); go func(){ defer wg.Done() }(); wg.Wait()
// test and inspect
// gofmt -w . && go test -race ./... && go vet ./...
```

### Pre-merge checklist

- Is every external operation bounded by a context deadline or explicit limit?
- Are goroutines cancellable, awaited, and unable to block forever sending results?
- Are errors contextual, actionable, and mapped safely at the boundary?
- Are shared values synchronized and tests run with `-race`?
- Are inputs validated, secrets redacted, and authz checked?
- Is the change covered by focused tests and, for performance claims, a benchmark/profile?
- Are logs, metrics, traces, rollout, and rollback considerations understood?

### Senior revision cheat sheet

Concurrency:

```text
goroutine owner + cancel + wait
channel sender closes
mutex protects invariant
atomic protects independent value
context signals, does not kill
```

Memory:

```text
stack: frame-local
heap: escaped/reachable
allocation: object creation
retention: still reachable
scan: pointer graph cost
```

Errors:

```text
wrap with %w
match with errors.Is
extract with errors.As
log once at boundary
panic only for broken invariants
```

HTTP:

```text
server timeouts
client timeouts
close response bodies
limit request bodies
map domain errors safely
```

Production:

```text
readiness false before shutdown
drain in-flight work
idempotency for retries
outbox for DB + event consistency
metrics for saturation
```

### Quick commands

```bash
go fmt ./...
go test ./...
go test -race ./...
go test -bench . -benchmem ./...
go test -cpuprofile cpu.out -memprofile mem.out -bench . ./pkg
go tool pprof cpu.out
go tool trace trace.out
go build -gcflags="-m=2" ./...
```

---

## 22. Deep topic atlas

Use this chapter as the dense reference layer. Each section follows the same practical lens: syntax, compiler/runtime behavior, memory shape, production guidance, pitfalls, performance, interview checks, and exercises.

### 22.1 Go philosophy and execution model

Go is a compiled, garbage-collected, statically typed language built for service software, CLIs, systems tools, and network programs. Its core design favors readable control flow, explicit errors, structural composition, and fast tooling.

```go
package main

import "fmt"

func main() {
    fmt.Println("hello")
}
```

Compiler/runtime flow:

```text
.go files
  -> lexer/parser
  -> type checker
  -> SSA compiler
  -> linker
  -> binary containing user code + Go runtime
```

The runtime provides goroutine scheduling, stack growth, heap allocation, garbage collection, maps, channels, timers, panic/defer handling, and network polling.

Production example: a Go service can run as one binary with no application server. That binary should still have configuration validation, observability, graceful shutdown, health checks, and dependency timeouts.

Best practices:

- Prefer simple packages and plain functions.
- Push dependencies toward edges, not into domain code.
- Use the standard library first, then add dependencies when they carry real weight.
- Keep error handling explicit and contextual.

Pitfalls:

- Translating class-heavy architecture directly into Go.
- Building framework layers before the problem needs them.
- Hiding all failures behind generic `"internal error"` values.

Performance considerations:

- Fast compilation helps iteration, but runtime speed still depends on allocation patterns, I/O boundaries, data layout, and concurrency design.
- The cheapest optimization is often choosing the right data ownership model.

Interview Q&A:

Q: Why is Go called simple but still production-capable?  
A: The language surface is small, but the runtime, compiler, tooling, scheduler, GC, standard library, and deployment model are serious engineering infrastructure.

Exercise: Build a small CLI that reads JSON from stdin, validates it, writes normalized JSON to stdout, and returns correct exit codes.

### 22.2 Modules, packages, imports, and visibility

A module is a versioned collection of packages rooted at `go.mod`. A package is one directory of `.go` files compiled together. A symbol is exported when it starts with an upper-case letter.

```text
shop/
  go.mod
  cmd/api/main.go
  internal/order/service.go
  internal/postgres/order_store.go
  pkg/money/money.go
```

```go
module example.com/shop

go 1.22

require github.com/google/uuid v1.6.0
```

Compiler behavior:

- Imports form a directed acyclic graph.
- Import cycles are rejected at compile time.
- Files in the same package share package-level declarations.
- `_test.go` files are compiled only for tests.

Visibility rules:

- `Name` is exported.
- `name` is package-private.
- Packages under `internal/` can only be imported by code under the parent tree.

Production example:

```text
cmd/api -> internal/httpapi -> internal/order -> internal/postgres
                              -> internal/payment
```

Best practices:

- Keep `cmd/*` thin.
- Put interfaces where they are consumed.
- Use `internal/` for application-private code.
- Commit `go.mod` and `go.sum`.

Pitfalls:

- Leaving local `replace` directives in committed code.
- Creating package cycles through convenience imports.
- Turning `pkg/` into a dumping ground.

Interview Q&A:

Q: What does `go mod tidy` do?  
A: It adds missing module requirements and removes unused ones based on package imports and tests.

Exercise: Refactor a single-file API into `cmd`, `internal/config`, `internal/httpapi`, `internal/service`, and `internal/store`.

### 22.3 Scope, declarations, shadowing, and semicolon insertion

Go has package, file, block, and universe scopes. Semicolons are inserted by the lexer, which is why brace placement is not arbitrary.

```go
func example(flag bool) error {
    value := 1
    if value := value + 1; flag {
        fmt.Println(value) // inner value
    }
    fmt.Println(value) // outer value
    return nil
}
```

Compiler behavior:

- Unused local variables and imports are compile errors.
- Shadowing is legal.
- Short declaration `:=` must introduce at least one new variable in the current scope.

Pitfall:

```go
f, err := os.Open(path)
if err != nil {
    return err
}
defer f.Close()

if data, err := io.ReadAll(f); err != nil {
    return err
} else {
    _ = data
}
```

This is valid, but the inner `err` is different. Shadowing is not evil, but accidental shadowing near named returns or deferred closures is dangerous.

Best practices:

- Keep scopes small.
- Avoid package-level mutable state.
- Use explicit assignment when shadowing would confuse readers.

Interview Q&A:

Q: Why does `if x := f(); x > 0 {}` limit `x` to the `if`?  
A: The initializer creates a variable scoped to the `if` statement and its branches.

Exercise: Find and remove confusing shadowing from a package without changing behavior.

### 22.4 Values, zero values, constants, and type identity

Every variable has a type and a zero value.

```go
var n int           // 0
var s string        // ""
var p *User         // nil
var xs []string     // nil slice
var m map[string]int // nil map
var mu sync.Mutex   // ready to use
```

Constants are compile-time values. Untyped constants adapt to context.

```go
const max = 1 << 20
const statusPaid Status = "paid"

type Status string
```

Compiler behavior:

- Defined types have distinct identities even if their underlying type is the same.
- Assignments between distinct defined types need explicit conversion.
- Constants can exceed machine word sizes until given a concrete type.

Memory behavior:

- Values are copied on assignment.
- Copying a slice, map, channel, function, pointer, or interface copies a header/reference-like value; underlying data may be shared.

Best practices:

- Design useful zero values.
- Use domain-specific types for IDs, statuses, money, and units.
- Avoid `float64` for currency.

Pitfalls:

- Writing to a nil map.
- Treating nil and empty slices as identical in JSON contracts.
- Using `int` for persisted protocol widths.

Interview Q&A:

Q: Is Go pass-by-reference?  
A: No. Go passes values. Some values, such as slices and maps, contain references to shared backing data.

Exercise: Implement `Money` as minor units with currency, validation, addition, comparison, and JSON encoding.

### 22.5 Strings, bytes, runes, and Unicode

A string is an immutable byte sequence. Go source is UTF-8, and strings often contain UTF-8, but the type itself stores bytes.

```go
s := "Go语言"
fmt.Println(len(s)) // bytes

for i, r := range s {
    fmt.Printf("byte=%d rune=%c\n", i, r)
}
```

Memory layout:

```text
string header
+---------+-----+
| data *  | len |
+---------+-----+
     |
     v
immutable bytes
```

Runtime behavior:

- `s[i]` returns a byte.
- `range s` decodes UTF-8 into runes.
- `string([]byte)` copies.
- `[]byte(string)` copies.

Production example:

```go
func TruncateRunes(s string, max int) string {
    if max < 0 {
        max = 0
    }
    count := 0
    for i := range s {
        if count == max {
            return s[:i]
        }
        count++
    }
    return s
}
```

Best practices:

- Use `strings.Builder` for repeated string construction.
- Validate user-visible text with Unicode in mind.
- Treat byte length and character count as different concepts.

Pitfalls:

- Splitting UTF-8 in the middle of a code point.
- Using regex for simple prefix/suffix checks.
- Repeated `+=` concatenation in hot loops.

Interview Q&A:

Q: What is a `rune`?  
A: An alias for `int32`, conventionally used for a Unicode code point.

Exercise: Write a slug validator that accepts ASCII lowercase, digits, and hyphens, with table tests.

### 22.6 Arrays, slices, capacity, and retention

Arrays have fixed length in their type. Slices are descriptors over arrays.

```go
arr := [3]int{1, 2, 3}
xs := arr[:2]
```

Slice layout:

```text
slice header
+---------+-----+-----+
| data *  | len | cap |
+---------+-----+-----+
     |
     v
backing array: [1][2][3][...]
```

`append` may reuse the backing array or allocate a new one.

```go
a := []int{1, 2, 3}
b := append(a[:1], 99)
fmt.Println(a, b) // shared backing array can surprise you
```

Production example:

```go
func Clone[T any](in []T) []T {
    if in == nil {
        return nil
    }
    out := make([]T, len(in))
    copy(out, in)
    return out
}
```

Memory retention pitfall:

```go
func FirstKB(file []byte) []byte {
    return file[:1024] // keeps entire file backing array alive
}

func FirstKBCopy(file []byte) []byte {
    out := make([]byte, 1024)
    copy(out, file)
    return out
}
```

Best practices:

- Preallocate when size is known.
- Use full slice expressions to limit capacity when needed: `s[:n:n]`.
- Copy when ownership must be independent.

Interview Q&A:

Q: Why must you use `s = append(s, v)`?  
A: Because `append` returns the possibly new slice header.

Exercise: Implement a bounded queue with slices and prove old elements are not retained after dequeue.

### 22.7 Maps and hashing

Maps are hash tables. Reads from nil maps are allowed; writes panic.

```go
counts := make(map[string]int, 128)
counts["go"]++
v, ok := counts["rust"]
delete(counts, "old")
```

Conceptual layout:

```text
map header
  -> bucket array
       bucket: hashes + keys + values + overflow pointer
```

Runtime behavior:

- Hash selects a bucket.
- Equality selects a key inside the bucket.
- Growth gradually evacuates buckets.
- Iteration order is deliberately unspecified.

Concurrency:

- Concurrent reads are fine only when there are no writes.
- Concurrent read/write without synchronization is unsafe.

Production example:

```go
type SafeMap[K comparable, V any] struct {
    mu sync.RWMutex
    m  map[K]V
}

func (s *SafeMap[K, V]) Get(k K) (V, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    v, ok := s.m[k]
    return v, ok
}
```

Pitfalls:

- Taking `&m[k]`; map elements are not addressable.
- Relying on iteration order.
- Using mutable or non-comparable keys.

Interview Q&A:

Q: Why are map values not addressable?  
A: The runtime may move values during map growth, so an address could become invalid.

Exercise: Build a TTL cache with mutex protection, eviction, and tests using a fake clock.

### 22.8 Structs, memory alignment, methods, and embedding

Struct fields are laid out inline with padding for alignment.

```go
type Bad struct {
    A bool
    B int64
    C bool
}

type Better struct {
    B int64
    A bool
    C bool
}
```

Memory sketch:

```text
Bad:    A _ _ _ _ _ _ _ B B B B B B B B C _ _ _ _ _ _ _
Better: B B B B B B B B A C _ _ _ _ _ _
```

Methods:

```go
type Counter struct{ n int64 }

func (c *Counter) Inc() { c.n++ }
func (c Counter) Value() int64 { return c.n }
```

Pointer receiver method sets are available to addressable values, but interface satisfaction depends on method sets precisely.

Best practices:

- Use pointer receivers for mutation, large structs, or types containing sync primitives.
- Do not copy a struct containing a mutex after first use.
- Keep embedded fields intentional.

Pitfalls:

- Treating embedding as inheritance.
- Exporting fields that should remain invariant.
- Optimizing field order before measuring.

Interview Q&A:

Q: Does embedding create a subtype relationship?  
A: No. It promotes methods and fields, but the embedded struct is still composition.

Exercise: Implement an immutable `UserID` and `Email` type with validation constructors.

### 22.9 Functions, closures, defer, panic, and recover

Functions are values. Closures capture variables.

```go
func Adder(base int) func(int) int {
    return func(x int) int { return base + x }
}
```

`defer` evaluates arguments immediately and runs calls at function exit in LIFO order.

```go
func Read(path string) (err error) {
    f, err := os.Open(path)
    if err != nil {
        return err
    }
    defer func() {
        if closeErr := f.Close(); err == nil {
            err = closeErr
        }
    }()
    return process(f)
}
```

Panic flow:

```text
panic
  -> run deferred calls in current frame
  -> unwind caller frames
  -> recover only inside deferred function in same goroutine
```

Best practices:

- Use panic for programmer errors and impossible states, not normal validation.
- Put cleanup defer near acquisition.
- Recover at goroutine or server boundaries only when you can produce a safe response.

Pitfalls:

- Calling `recover` outside a deferred function.
- Ignoring close errors on files that flush on close.
- Deferring inside very hot loops without measuring.

Interview Q&A:

Q: What order do deferred calls run in?  
A: Last in, first out.

Exercise: Write a transaction helper that rolls back on error or panic and commits only on success.

### 22.10 Interfaces, typed nil, and polymorphism

Interfaces are structural contracts.

```go
type Store interface {
    Save(context.Context, Order) error
}
```

Interface value layout:

```text
interface value
+-------------+--------+
| type info * | data * |
+-------------+--------+
```

Typed nil:

```go
type MyErr struct{}
func (*MyErr) Error() string { return "boom" }

func bad() error {
    var e *MyErr = nil
    return e // non-nil error interface
}
```

Best practices:

- Accept interfaces, return concrete types.
- Keep interfaces small.
- Define interfaces at consumer boundaries.
- Use `any` only when the value is genuinely dynamic.

Pitfalls:

- Giant interfaces generated for mocks.
- Returning typed nil errors.
- Hiding concrete behavior behind unnecessary abstraction.

Performance:

- Interface calls may prevent inlining in some cases.
- Boxing values into interfaces can allocate.
- Measure before replacing clear interfaces.

Interview Q&A:

Q: How does a type implement an interface in Go?  
A: Implicitly, by having the required methods.

Exercise: Design a payment gateway interface used by an order service and test it with a small fake.

### 22.11 Error design

Errors should carry enough context for operators and enough structure for callers.

```go
var ErrNotFound = errors.New("not found")

func Load(ctx context.Context, id string) (*User, error) {
    u, err := query(ctx, id)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("load user %s: %w", id, ErrNotFound)
    }
    if err != nil {
        return nil, fmt.Errorf("load user %s: %w", id, err)
    }
    return u, nil
}
```

Use:

- `errors.Is` for sentinel matching.
- `errors.As` for typed errors.
- `%w` when callers should unwrap.
- `errors.Join` for multiple relevant errors.

Production API mapping:

```go
func statusFor(err error) int {
    switch {
    case errors.Is(err, ErrNotFound):
        return http.StatusNotFound
    case errors.Is(err, ErrInvalid):
        return http.StatusBadRequest
    default:
        return http.StatusInternalServerError
    }
}
```

Pitfalls:

- Logging and returning errors at every layer.
- Losing context with bare `return err`.
- Wrapping errors whose concrete details should not escape an API boundary.

Interview Q&A:

Q: Where should errors usually be logged?  
A: At a boundary, once, after inner layers have added useful context.

Exercise: Build a domain error package with not found, invalid, conflict, and unauthorized cases.

### 22.12 Context and cancellation

`context.Context` carries cancellation, deadlines, and request metadata.

```go
func Search(ctx context.Context, q string) ([]Result, error) {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint(q), nil)
    if err != nil {
        return nil, err
    }
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    return decode(resp.Body)
}
```

Cancellation graph:

```text
parent ctx canceled
     |
     v
child ctx Done closes
     |
     v
database/http/channel selects unblock
```

Best practices:

- Context first parameter.
- Never store context in a long-lived struct.
- Always call cancel for derived contexts.
- Use values for request-scoped metadata only.

Pitfalls:

- Using `context.Background()` inside request handling.
- Putting optional function parameters into context.
- Starting goroutines that never observe `ctx.Done()`.

Interview Q&A:

Q: Does context kill goroutines?  
A: No. It only signals. Goroutines must return cooperatively.

Exercise: Implement fan-out search across three services with early cancellation.

### 22.13 Goroutines and scheduler internals

A goroutine is a lightweight runtime-managed execution unit. It starts with a small stack and grows as needed.

Scheduler model:

```text
G: goroutine
M: OS thread
P: processor resource

local run queue -> P -> M -> CPU
global run queue -> work stealing -> P
```

Runtime behavior:

- Blocking network I/O integrates with the network poller.
- Blocking syscalls may detach an M from a P so other goroutines can run.
- Preemption allows long-running goroutines to yield.
- Stacks grow by copying when needed.

Production example:

```go
func Start(ctx context.Context, fn func(context.Context) error) <-chan error {
    errCh := make(chan error, 1)
    go func() {
        defer close(errCh)
        errCh <- fn(ctx)
    }()
    return errCh
}
```

Best practices:

- Know who owns goroutine lifetime.
- Bound goroutines created from requests.
- Propagate context.
- Wait for workers during shutdown.

Pitfalls:

- Goroutine leaks from blocked sends.
- Unbounded fan-out.
- Assuming goroutines are free because they are cheap.

Interview Q&A:

Q: What is a goroutine leak?  
A: A goroutine that remains blocked or running after its work is no longer useful, retaining memory or resources.

Exercise: Write a test that starts a worker, cancels context, and verifies the worker exits.

### 22.14 Channels, select, pipelines, and backpressure

Channels are typed synchronization queues.

```go
jobs := make(chan Job)
results := make(chan Result, 32)
```

States:

```text
nil channel: send/receive blocks forever
open channel: normal synchronization
closed channel: receive drains buffer then ok=false
send to closed channel: panic
```

Pipeline pattern:

```go
func Map[T, U any](ctx context.Context, in <-chan T, fn func(T) U) <-chan U {
    out := make(chan U)
    go func() {
        defer close(out)
        for {
            select {
            case <-ctx.Done():
                return
            case v, ok := <-in:
                if !ok {
                    return
                }
                select {
                case out <- fn(v):
                case <-ctx.Done():
                    return
                }
            }
        }
    }()
    return out
}
```

Best practices:

- The sending side usually closes.
- Use buffered channels deliberately, not as infinite queues.
- Add cancellation to every pipeline stage.
- Prefer directional channel types in APIs.

Pitfalls:

- Closing from receivers.
- Forgetting to drain or cancel upstream producers.
- Using channels where a mutex would be simpler.

Interview Q&A:

Q: How can nil channels help in `select`?  
A: Assigning a channel variable to nil disables that case because operations on nil channels block forever.

Exercise: Implement fan-in that merges N channels and exits on context cancellation.

### 22.15 Synchronization and the memory model

Synchronization creates happens-before relationships. Without such ordering, concurrent read/write of the same memory is a race.

```go
var x int
done := make(chan struct{})

go func() {
    x = 42
    close(done)
}()

<-done
fmt.Println(x) // safe: close happens before receive observes it
```

Synchronization tools:

- `sync.Mutex` for exclusive access.
- `sync.RWMutex` for read-heavy cases after measuring.
- `sync.Once` for one-time initialization.
- `sync.Cond` for condition waiting.
- `sync/atomic` for low-level counters and flags.
- Channels for communication and ownership transfer.

Atomic example:

```go
var requests atomic.Int64
requests.Add(1)
fmt.Println(requests.Load())
```

Pitfalls:

- Copying locks after use.
- Mixing atomic and non-atomic access.
- Holding locks during network calls.
- Assuming `time.Sleep` synchronizes memory.

Interview Q&A:

Q: What does the race detector prove?  
A: It reports races observed during that execution. It does not prove all possible executions are race-free.

Exercise: Build a concurrent metrics registry and run it under the race detector.

### 22.16 Heap, stack, escape analysis, and GC

The compiler decides whether values live on a goroutine stack or heap.

```go
func NewUser(name string) *User {
    u := User{Name: name}
    return &u // escapes
}
```

Escape analysis reasons:

- Returning a pointer to a local.
- Storing data in an interface.
- Capturing variables in long-lived closures.
- Passing values to code the compiler cannot fully analyze.

Memory picture:

```text
goroutine stack
  frame handler
    slice header ----+
                    |
heap                v
  backing array [objects...]
  map buckets
  escaped structs
```

GC model:

```text
roots -> mark reachable objects -> sweep unreachable spans -> reuse memory
```

Tuning:

- `GOGC` controls target heap growth.
- `GOMEMLIMIT` sets a soft memory target.
- Allocation reduction is usually better than knob tuning.

Pitfalls:

- Tiny slices retaining huge arrays.
- Unbounded caches.
- Overusing pointers and increasing live heap.

Interview Q&A:

Q: Does `new(T)` always allocate on the heap?  
A: No. Escape analysis may keep it on the stack.

Exercise: Use `go test -bench . -benchmem` to reduce allocations in a parser.

### 22.17 Generics and constraints

Generics add type parameters to functions and types.

```go
func Max[T ~int | ~int64 | ~float64](a, b T) T {
    if a > b {
        return a
    }
    return b
}
```

Constraint concepts:

- `any` means no required operations.
- `comparable` permits `==`, `!=`, and map keys.
- `~T` permits types whose underlying type is `T`.
- Type unions permit a set of allowed underlying types.

Production example:

```go
type Set[T comparable] map[T]struct{}

func (s Set[T]) Add(v T) { s[v] = struct{}{} }
func (s Set[T]) Has(v T) bool {
    _, ok := s[v]
    return ok
}
```

Best practices:

- Use generics for algorithms and containers.
- Keep constraints as small as possible.
- Do not use generics to avoid writing two clear functions.

Pitfalls:

- Overly clever constraints.
- Generic APIs that leak implementation complexity.
- Assuming generics are always zero-cost or always slow.

Interview Q&A:

Q: What does `~int` mean in a constraint?  
A: It allows any type whose underlying type is `int`, not only the predeclared `int` type.

Exercise: Implement generic `Map`, `Filter`, and `Reduce`, then decide where they improve or hurt readability.

### 22.18 Reflection and unsafe

Reflection inspects types and values at runtime.

```go
func TypeName(v any) string {
    if v == nil {
        return "<nil>"
    }
    return reflect.TypeOf(v).String()
}
```

Reflection is used by JSON, ORMs, validators, loggers, and dependency injection tools. It trades compile-time guarantees for flexibility.

Pitfalls:

- Panics from invalid `reflect.Value` operations.
- Slow paths from repeated reflection.
- Bypassing type safety.

`unsafe` bypasses Go's type and memory safety. Use it only in narrow, heavily tested, documented code where the performance or systems need is real.

Best practices:

- Prefer interfaces and generics before reflection.
- Cache reflection metadata if used in hot paths.
- Keep unsafe code isolated.

Interview Q&A:

Q: Why can reflection be slower?  
A: It works through runtime type metadata and dynamic operations that the compiler cannot optimize like ordinary static code.

Exercise: Write a struct tag validator with reflection, then cache field metadata.

### 22.19 File handling and serialization

Use streaming for large data and exact formats for public contracts.

```go
func CountLines(r io.Reader) (int, error) {
    scanner := bufio.NewScanner(r)
    count := 0
    for scanner.Scan() {
        count++
    }
    return count, scanner.Err()
}
```

File rules:

- Close files.
- Check scanner errors.
- Be careful with `bufio.Scanner` token size limits.
- Use `filepath` for filesystem paths.
- Avoid loading huge files entirely when streaming works.

JSON strict decoding:

```go
dec := json.NewDecoder(r)
dec.DisallowUnknownFields()
var req Request
if err := dec.Decode(&req); err != nil {
    return err
}
```

Pitfalls:

- Ignoring close errors on writers.
- Unbounded request bodies.
- Treating JSON `omitempty` as always harmless.

Interview Q&A:

Q: Why might `bufio.Scanner` fail on long lines?  
A: It has a maximum token size unless you configure a larger buffer.

Exercise: Build a CSV-to-JSON converter that streams rows, validates fields, and reports line numbers.

### 22.20 Networking, HTTP, APIs, and gRPC design

`net/http` is production-grade, but defaults must be configured.

```go
srv := &http.Server{
    Addr:              ":8080",
    Handler:           mux,
    ReadHeaderTimeout: 5 * time.Second,
    ReadTimeout:       10 * time.Second,
    WriteTimeout:      30 * time.Second,
    IdleTimeout:       60 * time.Second,
}
```

HTTP client:

```go
client := &http.Client{Timeout: 5 * time.Second}
req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
if err != nil {
    return err
}
resp, err := client.Do(req)
if err != nil {
    return err
}
defer resp.Body.Close()
```

API design:

- Use stable request/response schemas.
- Validate inputs at boundaries.
- Map domain errors to safe status codes.
- Support pagination for collections.
- Use idempotency keys for retryable writes.

gRPC design:

- Put deadlines on calls.
- Use interceptors for auth, logging, metrics, and recovery.
- Keep protobuf fields backward compatible.
- Avoid changing field numbers or meanings.

Pitfalls:

- Default HTTP client with no timeout.
- Not closing response bodies.
- Returning raw internal errors.
- Unbounded request body reads.

Interview Q&A:

Q: Why close an HTTP response body?  
A: It releases resources and allows connection reuse.

Exercise: Build an HTTP client wrapper with timeout, retry for idempotent methods, jitter, and tests using `httptest`.

### 22.21 Testing, fuzzing, benchmarks, and examples

Testing pyramid in Go:

```text
many unit tests
some integration tests
few end-to-end tests
benchmarks for hot paths
fuzz tests for parsers/validators
```

Table test:

```go
func TestNormalize(t *testing.T) {
    tests := []struct {
        name string
        in   string
        want string
    }{
        {"trim", " go ", "go"},
        {"lower", "GO", "go"},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            if got := Normalize(tt.in); got != tt.want {
                t.Fatalf("got %q want %q", got, tt.want)
            }
        })
    }
}
```

Benchmark:

```go
func BenchmarkNormalize(b *testing.B) {
    for i := 0; i < b.N; i++ {
        _ = Normalize(" Go ")
    }
}
```

Fuzz:

```go
func FuzzParseID(f *testing.F) {
    f.Add("123")
    f.Fuzz(func(t *testing.T, s string) {
        _, _ = ParseID(s)
    })
}
```

Best practices:

- Prefer behavior tests over implementation tests.
- Use small fakes rather than huge generated mocks.
- Test cancellation and error paths.
- Run race detector for concurrent code.

Interview Q&A:

Q: What does `t.Helper()` do?  
A: It marks a helper so failure line numbers point to the caller.

Exercise: Add fuzz tests to a URL parser and fix crashes or invalid accepts.

### 22.22 Performance and observability

Performance work starts with measurement.

```bash
go test -bench . -benchmem
go test -bench . -cpuprofile cpu.out -memprofile mem.out
go tool pprof cpu.out
```

Common bottlenecks:

- Excess allocations.
- Lock contention.
- Slow external dependencies.
- JSON encoding/decoding.
- Unbounded concurrency.
- Poor data locality.

Observability signals:

- Logs: what happened.
- Metrics: how often and how much.
- Traces: where time went across boundaries.
- Profiles: where CPU and memory go inside the process.

Pitfalls:

- Optimizing without a baseline.
- Measuring only happy-path local inputs.
- Adding high-cardinality metric labels.
- Leaving pprof publicly exposed.

Interview Q&A:

Q: What does `allocs/op` show?  
A: Number of heap allocations per benchmark operation.

Exercise: Profile a JSON endpoint under load and reduce allocations without changing its response contract.

---

## 23. Extended production blueprints

### 23.1 Production HTTP service blueprint

Recommended layout:

```text
cmd/api/main.go
internal/config
internal/httpapi
internal/middleware
internal/domain
internal/usecase
internal/postgres
internal/observability
```

Startup flow:

```text
load config -> validate -> logger -> dependencies -> services -> router -> server -> graceful shutdown
```

Minimal server:

```go
func main() {
    logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

    mux := http.NewServeMux()
    mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte("ok"))
    })

    srv := &http.Server{
        Addr:              ":8080",
        Handler:           mux,
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout:       10 * time.Second,
        WriteTimeout:      30 * time.Second,
        IdleTimeout:       60 * time.Second,
    }

    errCh := make(chan error, 1)
    go func() {
        logger.Info("server starting", "addr", srv.Addr)
        errCh <- srv.ListenAndServe()
    }()

    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

    select {
    case sig := <-sigCh:
        logger.Info("shutdown signal", "signal", sig.String())
    case err := <-errCh:
        if !errors.Is(err, http.ErrServerClosed) {
            logger.Error("server failed", "err", err)
        }
    }

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        logger.Error("shutdown failed", "err", err)
    }
}
```

Checklist:

- Timeouts on server and clients.
- Graceful shutdown.
- Request IDs.
- Panic recovery.
- Structured logs.
- Health and readiness endpoints.
- Metrics around external calls.
- Clear error mapping.

### 23.2 Clean architecture in Go

Clean Go architecture is not about folders; it is about dependency direction.

```text
transport -> application service -> domain -> repository interface
                                      ^
                                      |
                              repository implementation
```

Example:

```go
type OrderRepository interface {
    Save(context.Context, Order) error
}

type OrderService struct {
    repo OrderRepository
}

func (s *OrderService) Place(ctx context.Context, cmd PlaceOrder) (Order, error) {
    order, err := NewOrder(cmd.UserID, cmd.Items)
    if err != nil {
        return Order{}, err
    }
    if err := s.repo.Save(ctx, order); err != nil {
        return Order{}, fmt.Errorf("save order: %w", err)
    }
    return order, nil
}
```

Best practices:

- Domain should not import HTTP or SQL packages.
- Interfaces should be small and consumer-owned.
- Keep transaction boundaries explicit.
- Avoid generic repository methods that hide domain meaning.

### 23.3 Configuration and secrets

```go
type Config struct {
    Env         string
    Addr        string
    DatabaseURL string
}

func LoadConfig() (Config, error) {
    cfg := Config{
        Env:         getenv("APP_ENV", "dev"),
        Addr:        getenv("ADDR", ":8080"),
        DatabaseURL: os.Getenv("DATABASE_URL"),
    }
    if cfg.DatabaseURL == "" {
        return Config{}, errors.New("DATABASE_URL is required")
    }
    return cfg, nil
}
```

Rules:

- Validate once at startup.
- Do not log secrets.
- Prefer explicit fields to loose maps.
- Keep defaults visible.
- Separate build-time and runtime configuration.

### 23.4 Resilience patterns

```text
timeout: bound waiting
retry: repeat transient safe failures
backoff: slow repeated attempts
circuit breaker: stop calling broken dependency temporarily
rate limit: protect capacity
bulkhead: isolate one dependency from consuming all resources
idempotency: make repeated writes safe
```

Retry skeleton:

```go
func Retry(ctx context.Context, attempts int, base time.Duration, fn func(context.Context) error) error {
    var err error
    for i := 0; i < attempts; i++ {
        if err = fn(ctx); err == nil {
            return nil
        }
        wait := base * time.Duration(1<<i)
        timer := time.NewTimer(wait)
        select {
        case <-ctx.Done():
            timer.Stop()
            return ctx.Err()
        case <-timer.C:
        }
    }
    return err
}
```

Pitfalls:

- Retrying non-idempotent writes.
- Retrying validation errors.
- Retrying beyond the caller deadline.
- Forgetting jitter in large fleets.

### 23.5 Security baseline

Baseline:

- Validate every external input.
- Limit body sizes.
- Use parameterized SQL.
- Set secure cookies deliberately.
- Use TLS.
- Keep secrets out of source and logs.
- Return safe error messages.
- Keep dependencies current.
- Add authorization checks near business operations.

Body limit:

```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
```

Parameterized query:

```go
row := db.QueryRowContext(ctx, "select id, email from users where id = $1", id)
```

Pitfalls:

- Trusting forwarded headers without proxy controls.
- Logging raw tokens.
- Concatenating SQL.
- Allowing unbounded JSON decode.

### 23.6 Database patterns

`sql.DB` is a pool. Configure it.

```go
db.SetMaxOpenConns(25)
db.SetMaxIdleConns(25)
db.SetConnMaxLifetime(30 * time.Minute)
```

Transaction helper:

```go
func WithTx(ctx context.Context, db *sql.DB, fn func(*sql.Tx) error) error {
    tx, err := db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()
    if err := fn(tx); err != nil {
        return err
    }
    return tx.Commit()
}
```

Pitfalls:

- Not closing rows.
- Not checking `rows.Err`.
- Holding transactions while calling external services.
- Opening pools per request.

### 23.7 Background jobs

Job state:

```text
queued -> claimed -> acked
             |
             v
          retrying -> queued
             |
             v
        dead-lettered
```

Worker requirements:

- Claim atomically.
- Handle duplicates.
- Use idempotency.
- Retry with backoff.
- Dead-letter exhausted jobs.
- Respect context cancellation.
- Expose queue metrics.

### 23.8 Library API design

Functional options:

```go
type Client struct {
    baseURL string
    http    *http.Client
}

type Option func(*Client)

func WithHTTPClient(h *http.Client) Option {
    return func(c *Client) {
        c.http = h
    }
}

func NewClient(baseURL string, opts ...Option) *Client {
    c := &Client{
        baseURL: strings.TrimRight(baseURL, "/"),
        http:    &http.Client{Timeout: 10 * time.Second},
    }
    for _, opt := range opts {
        opt(c)
    }
    return c
}
```

Best practices:

- Document concurrency safety.
- Accept context on I/O methods.
- Return concrete types from constructors.
- Avoid exposing mutable fields unless they are deliberately part of the API.

---

## 24. Design patterns and LLD examples

### 24.1 Functional options

Useful when a constructor has optional settings and you want stable call sites.

```go
type Server struct {
    addr    string
    timeout time.Duration
}

type ServerOption func(*Server)

func WithTimeout(d time.Duration) ServerOption {
    return func(s *Server) { s.timeout = d }
}
```

Pitfall: options can hide validation. Validate after applying all options.

### 24.2 Repository plus service

The repository hides persistence. The service owns business rules.

```go
type UserRepo interface {
    FindByEmail(context.Context, string) (User, error)
    Save(context.Context, User) error
}

type RegisterService struct {
    repo UserRepo
}
```

Pitfall: do not create a repository per database table automatically. Model behavior, not storage furniture.

### 24.3 Strategy

```go
type PriceRule interface {
    Apply(Money) Money
}

type PercentageDiscount struct{ Percent int }
func (p PercentageDiscount) Apply(m Money) Money { return m.PercentOff(p.Percent) }
```

Use for interchangeable algorithms.

### 24.4 Adapter

Wrap external APIs behind your internal shape.

```go
type EmailSender interface {
    SendWelcome(context.Context, Email) error
}

type SESAdapter struct{ client *ses.Client }
```

This keeps vendor APIs out of domain logic.

### 24.5 Token bucket rate limiter

State:

```text
capacity C
refill rate R tokens/sec
current tokens T
last refill time L
```

Algorithm:

```text
elapsed = now - L
T = min(C, T + elapsed * R)
if T >= cost: T -= cost, allow
else: reject
```

Concurrency: protect state with a mutex or perform update atomically in Redis/Lua for distributed use.

### 24.6 LRU cache

Data structure:

```text
map[key]*node + doubly linked list

front = most recent
back  = least recent
```

Operations:

- `Get`: map lookup, move node to front.
- `Set`: update existing or insert new front node.
- Evict: remove back node when capacity exceeded.

Pitfalls:

- Forgetting to delete evicted keys from map.
- Returning mutable internal values without ownership rules.
- No lock around list and map together.

### 24.7 Job queue

At-least-once delivery means duplicates are normal.

Design must include:

- Idempotency key.
- Visibility timeout.
- Retry schedule.
- Dead-letter storage.
- Worker shutdown.
- Metrics.

### 24.8 URL shortener

Core components:

```text
POST /links -> validate URL -> generate code -> store mapping
GET /{code} -> lookup -> redirect -> async analytics
```

LLD questions:

- Random code or hash?
- How to handle collisions?
- How to prevent malicious URLs?
- How to rate limit creation?
- How to expire links?

### 24.9 Inventory reservation system

State transition:

```text
available stock
  -> reserved
  -> committed
  -> released on cancel/timeout
```

Important invariants:

- Stock cannot go negative.
- Reservations expire.
- Commit is idempotent.
- Concurrent reservations are serialized per product.

### 24.10 Distributed rate limiter

For a distributed limiter, local mutex state is not enough. Use a central atomic operation.

```text
service instance A \
service instance B  -> Redis Lua script -> allow/reject
service instance C /
```

Tradeoffs:

- Fail open favors availability.
- Fail closed favors protection.
- Hot keys may overload central storage.
- Clock consistency matters.

---

## 25. Large interview bank

### 25.1 Core questions

Q1: What is the zero value of a slice?  
A: `nil`, with length and capacity zero. You can append to it.

Q2: What is the zero value of a map?  
A: `nil`. Reads work, writes panic.

Q3: Difference between `make` and `new`?  
A: `new(T)` returns `*T` to a zero value. `make` initializes slices, maps, and channels and returns the value.

Q4: Array versus slice?  
A: An array has fixed length in its type. A slice is a header pointing to part of an array.

Q5: Why does `append` return a slice?  
A: It may allocate a new backing array and return a new header.

Q6: Can slices be compared?  
A: Only to `nil`.

Q7: Can structs be map keys?  
A: Yes, if all fields are comparable.

Q8: What is a method set?  
A: The methods associated with a type, used for method calls and interface satisfaction.

Q9: Pointer receiver versus value receiver?  
A: Pointer can mutate and avoids copying; value is useful for immutable or small types.

Q10: What is embedding?  
A: Composition that promotes fields and methods; not inheritance.

### 25.2 Interfaces and errors

Q11: How does a type implement an interface?  
A: Implicitly, by defining the required methods.

Q12: Why can an interface containing nil be non-nil?  
A: The interface has dynamic type and value; if type is set, it is non-nil.

Q13: What does `errors.Is` do?  
A: Checks whether an error matches a target through wrapping.

Q14: What does `errors.As` do?  
A: Extracts a typed error through wrapping.

Q15: When should you wrap errors?  
A: When callers need both context and access to the underlying error.

Q16: Where should errors be logged?  
A: Usually once at a boundary.

Q17: Panic versus error?  
A: Errors are expected failure values. Panics are for programmer errors or unrecoverable invariants.

Q18: What does recover do?  
A: Stops a panic when called inside a deferred function in the same goroutine.

### 25.3 Concurrency

Q19: What is a goroutine?  
A: A lightweight runtime-scheduled execution unit.

Q20: What is a goroutine leak?  
A: A goroutine that keeps running or blocking after it is no longer needed.

Q21: What happens when receiving from a closed channel?  
A: Remaining buffered values are received first; then zero value and `ok=false`.

Q22: What happens when sending to a closed channel?  
A: Panic.

Q23: What does a nil channel do?  
A: Send and receive block forever.

Q24: Mutex or channel?  
A: Mutex for shared state; channel for communication, ownership transfer, pipelines, and backpressure.

Q25: What is a data race?  
A: Concurrent access to same memory, at least one write, with no synchronization.

Q26: Does `time.Sleep` synchronize memory?  
A: No.

Q27: What is backpressure?  
A: A mechanism that slows producers when consumers or dependencies cannot keep up.

Q28: Does context kill goroutines?  
A: No, it signals cancellation.

### 25.4 Runtime and performance

Q29: What is escape analysis?  
A: Compiler analysis that decides stack versus heap placement.

Q30: Does `new` always allocate on heap?  
A: No.

Q31: What is GC pressure?  
A: Allocation and retention behavior that increases garbage collector work.

Q32: What is `GOGC`?  
A: A setting controlling target heap growth relative to live heap.

Q33: What is bounds-check elimination?  
A: Compiler removal of index checks after proving safety.

Q34: Why can pointers hurt performance?  
A: More heap allocation, GC work, indirection, and cache misses.

Q35: What does `-benchmem` show?  
A: Allocations and bytes allocated per operation.

Q36: Why profile first?  
A: Bottlenecks are often not where intuition says they are.

### 25.5 Production and networking

Q37: Why set HTTP server timeouts?  
A: To prevent slow or malicious clients from consuming resources indefinitely.

Q38: Why close response bodies?  
A: To release resources and allow connection reuse.

Q39: Readiness versus liveness?  
A: Liveness means the process is alive. Readiness means it can serve traffic.

Q40: What is graceful shutdown?  
A: Stop accepting new work, finish in-flight work within a deadline, then exit.

Q41: What is idempotency?  
A: Repeating the operation has the same effect.

Q42: Why use parameterized SQL?  
A: To prevent SQL injection and separate query structure from values.

Q43: What is structured logging?  
A: Logs with stable key-value fields.

Q44: What is high cardinality in metrics?  
A: Too many unique label values, such as user IDs, causing storage and query problems.

### 25.6 Generics, reflection, and design

Q45: What is `any`?  
A: Alias for `interface{}`.

Q46: What is `comparable`?  
A: Constraint for types that can use `==` and `!=`.

Q47: What does `~int` mean in a constraint?  
A: Any type whose underlying type is `int`.

Q48: When should you use generics?  
A: Reusable type-safe algorithms and containers.

Q49: When should you avoid generics?  
A: When they make code harder to understand than simple explicit code.

Q50: What is reflection?  
A: Runtime type and value inspection.

Q51: Why is reflection risky?  
A: It can panic, is slower, and loses compile-time guarantees.

Q52: Where should interfaces live?  
A: Usually with the consumer.

### 25.7 Scenario questions

Q53: A service leaks memory after reading large files. What do you check?  
A: Heap profiles, retained subslices, unbounded caches, goroutine leaks, and unclosed resources.

Q54: A map crashes under load. Why?  
A: Likely concurrent read/write without synchronization.

Q55: Tests are flaky around time. Fix?  
A: Inject a fake clock or use channels instead of sleeps.

Q56: API duplicates orders during retries. Fix?  
A: Idempotency keys and transactionally stored request outcomes.

Q57: Handler latency spikes during dependency outage. Fix?  
A: Timeouts, circuit breaker, bounded concurrency, and backpressure.

Q58: GC time rises after a cache feature. Why?  
A: Cache may grow live heap or retain objects too long.

Q59: CPU profile shows JSON hot path. Options?  
A: Reduce payloads, stream, avoid `map[string]any`, reuse buffers carefully, or test specialized encoders.

Q60: How do you review a Go service before production?  
A: Check timeouts, cancellation, logs, metrics, graceful shutdown, race safety, input limits, error mapping, config validation, and tests.

---

## 26. Capstone projects

### 26.1 Concurrent log processor

Build a CLI that streams huge logs, parses lines, aggregates metrics, and writes JSON.

Requirements:

- Stream input with `bufio`.
- Support gzip.
- Use bounded parser workers.
- Aggregate by status, route, and minute.
- Preserve deterministic output.
- Benchmark parser allocations.
- Test malformed lines and cancellation.

Design:

```text
reader -> line channel -> parser workers -> event channel -> aggregator -> JSON writer
```

### 26.2 HTTP inventory service

Build an inventory API with products, reservations, commit, cancel, and expiry.

Endpoints:

```text
POST /products
GET  /products/{id}
POST /reservations
POST /reservations/{id}/commit
POST /reservations/{id}/cancel
GET  /healthz
GET  /readyz
```

Required ideas:

- Domain invariants.
- Repository interface.
- In-memory store with mutex.
- Idempotency key.
- Context-aware service methods.
- HTTP integration tests.
- Race detector run.

### 26.3 Durable job queue

Implement:

- Enqueue.
- Claim.
- Ack.
- Retry with backoff.
- Dead-letter after max attempts.
- Worker pool.
- Metrics.
- Graceful shutdown.

State:

```text
queued -> claimed -> acked
             |
             v
          retrying -> queued
             |
             v
        dead-lettered
```

### 26.4 Generic LRU cache

Build:

```go
type Cache[K comparable, V any] struct {}
```

Requirements:

- O(1) `Get`, `Set`, `Delete`.
- Map plus doubly linked list.
- Capacity limit.
- Optional TTL.
- Thread-safe variant.
- Benchmarks and race tests.

### 26.5 URL shortener

Build:

- `POST /links`.
- `GET /{code}` redirect.
- URL validation.
- Collision handling.
- Rate limiting.
- Storage interface.
- Async analytics.
- Structured logs and metrics.

Design questions:

- Random or deterministic codes?
- How are collisions handled?
- How are abusive URLs blocked?
- How are hot redirects cached?

### 26.6 Distributed rate limiter

Implement a local token bucket, then design Redis-backed atomic behavior.

Tradeoffs:

- Fail open versus fail closed.
- Hot key pressure.
- Clock consistency.
- Burst size.
- Retry-after calculation.
- Observability.

### 26.7 Final mastery rubric

For each capstone, score:

- Correctness.
- Simplicity.
- Resource bounds.
- Race safety.
- Cancellation behavior.
- Memory behavior.
- Tests.
- Benchmarks where relevant.
- Production readiness.
- Quality of design explanation.

Final challenge: choose one capstone, write a short design doc, implement it, run tests with race detector, profile one hot path, and explain every tradeoff as if you are in a senior Go interview.

### Capstone deliverable format

For every capstone, produce:

```text
README.md
  problem statement
  API examples
  design decisions
  tradeoffs
  how to run
  how to test

docs/design.md
  requirements
  non-goals
  data model
  concurrency model
  failure handling
  observability

tests
  unit tests
  integration tests where useful
  race test for concurrent paths
  benchmark for hot path
```

### Capstone scoring guide

Score yourself from 1 to 5:

- Correctness under normal cases.
- Edge-case handling.
- Error clarity.
- Concurrency safety.
- Cancellation behavior.
- Memory behavior.
- Test quality.
- Benchmark/profile evidence.
- Production readiness.
- Explanation quality.

Senior-level capstone answers should include:

```text
why this design?
what can fail?
what is bounded?
what is observable?
what is tested?
what would change at 10x scale?
```

### Recommended portfolio order

Build in this order:

1. Generic LRU cache: data structures, generics, mutexes.
2. Worker pool/job queue: goroutines, channels, cancellation.
3. HTTP inventory service: APIs, domain, tests, graceful shutdown.
4. Log processor: streaming I/O, memory, benchmarks.
5. Rate limiter: LLD, distributed design, tradeoffs.
6. Idempotent order/payment design: production system thinking.

This gives you stories for coding, LLD, system design, performance, and production ownership.

---

## 27. 1 Cr+ senior Go interview track

This chapter is written for a Go developer with 5+ years of experience targeting high-paying senior, lead, principal-track, or high-growth backend roles. At this level, interviewers do not only check whether you know goroutines, channels, GC, or interfaces. They check whether you can own a service, diagnose production incidents, make tradeoffs, mentor others, and design systems that survive real traffic.

### 27.1 What companies expect at this compensation level

For 1 Cr+ packages, the signal is usually a mix of:

- Deep Go language and runtime understanding.
- Strong backend system design.
- Production ownership.
- Performance debugging.
- Reliability and incident response.
- Database and distributed systems judgment.
- Clear communication under ambiguity.
- Ability to lead projects without hiding behind titles.

The interviewer is asking:

```text
Can this person own a critical backend service?
Can this person reduce production risk?
Can this person debug what others cannot?
Can this person improve team engineering quality?
Can this person design simple systems that scale?
Can this person explain tradeoffs clearly?
```

At this level, weak answers sound like tutorials. Strong answers sound like production experience.

Weak:

```text
Goroutines are lightweight threads. Channels are used for communication.
```

Strong:

```text
I use goroutines when I can define ownership, cancellation, and backpressure.
For request fan-out, I bound concurrency based on downstream capacity, pass request context,
and ensure result sends cannot block after cancellation. I also watch goroutine count,
queue depth, dependency latency, and DB pool waits in production.
```

### 27.2 Senior Go interview answer framework

Use this structure for most senior questions:

```text
1. Define the invariant or goal.
2. Explain the simple design first.
3. State concurrency and ownership rules.
4. Discuss failure modes.
5. Add observability.
6. Mention tests and verification.
7. State tradeoffs.
```

Example question: “How would you design a worker pool?”

Senior answer:

```text
I would start by defining the workload and delivery guarantee. If jobs are in memory,
I can use a bounded channel and fixed workers. If jobs must survive process restart,
I need durable storage with claim, ack, retry, visibility timeout, and dead-letter states.

For the Go implementation, I would pass context into every worker, close the job channel
from the producer side, wait using a WaitGroup, and make result sends cancellation-aware.
The queue must be bounded so producers receive backpressure instead of creating unlimited
goroutines. I would expose queue depth, processing latency, failures, retries, and worker count.
Tests should cover cancellation, retries, duplicate processing, full queue behavior, and shutdown.
```

Notice the answer moves from code to operating behavior. That is what senior interviewers look for.

### 27.3 Must-master Go topics for senior compensation

Priority map:

```text
Tier 1: concurrency, context, channels, mutexes, memory model
Tier 2: runtime, GC, escape analysis, pprof, trace
Tier 3: HTTP, DB pools, production lifecycle, resilience
Tier 4: generics, reflection, package design, testing strategy
Tier 5: distributed systems, LLD, incident stories, leadership
```

For every Tier 1 and Tier 2 topic, prepare:

- One clean definition.
- One production bug you can describe.
- One code pattern.
- One pitfall.
- One debugging method.
- One tradeoff.

Example for channels:

```text
Definition: typed synchronization primitive.
Bug: pipeline leaked goroutines when caller returned early.
Pattern: context-aware fan-in/fan-out.
Pitfall: receiver closing shared channel.
Debug: goroutine profile and block profile.
Tradeoff: channel for ownership transfer, mutex for shared state.
```

### 27.4 How to talk about goroutines like a senior

A senior answer should mention lifecycle.

Checklist:

- Who starts the goroutine?
- Who cancels it?
- Who waits for it?
- Can it block forever?
- Does it capture large request data?
- Does it hold a lock during blocking work?
- Is concurrency bounded?
- Is the downstream dependency able to handle the parallelism?

Production pattern:

```go
type Group struct {
    ctx    context.Context
    cancel context.CancelFunc
    wg     sync.WaitGroup
    err    atomic.Pointer[error]
}

func NewGroup(parent context.Context) *Group {
    ctx, cancel := context.WithCancel(parent)
    return &Group{ctx: ctx, cancel: cancel}
}

func (g *Group) Go(fn func(context.Context) error) {
    g.wg.Add(1)
    go func() {
        defer g.wg.Done()
        if err := fn(g.ctx); err != nil {
            g.err.Store(&err)
            g.cancel()
        }
    }()
}

func (g *Group) Wait() error {
    g.wg.Wait()
    g.cancel()
    if p := g.err.Load(); p != nil {
        return *p
    }
    return nil
}
```

In real code, `golang.org/x/sync/errgroup` is usually preferred, but being able to discuss the mechanics shows understanding.

Interview phrasing:

```text
I do not start goroutines casually. Every goroutine has an owner, a cancellation path,
and a wait path. For request-scoped goroutines, the request context controls lifetime.
For service-level workers, shutdown context controls lifetime. If a goroutine sends to a
channel, that send must also be cancellation-aware.
```

### 27.5 How to talk about channels like a senior

Senior channel answers must include ownership and close rules.

Core rules:

- The sender closes the channel.
- Receivers should not close a channel they do not own.
- Multiple senders need coordination before close.
- Closed channels are always ready for receive.
- Nil channels can disable select cases.
- Buffers are not unbounded queues.

Example interview problem: “Merge multiple channels.”

```go
func Merge[T any](ctx context.Context, inputs ...<-chan T) <-chan T {
    out := make(chan T)
    var wg sync.WaitGroup

    wg.Add(len(inputs))
    for _, input := range inputs {
        input := input
        go func() {
            defer wg.Done()
            for {
                select {
                case <-ctx.Done():
                    return
                case v, ok := <-input:
                    if !ok {
                        return
                    }
                    select {
                    case out <- v:
                    case <-ctx.Done():
                        return
                    }
                }
            }
        }()
    }

    go func() {
        wg.Wait()
        close(out)
    }()

    return out
}
```

What to explain:

- Each input has one draining goroutine.
- Output is closed only after all input goroutines finish.
- Sends to output respect cancellation.
- If caller stops reading without canceling, goroutines may block; caller must own cancellation.

That last sentence is the senior signal. You name the contract.

### 27.6 How to talk about mutexes, atomics, and memory model

Senior interviewers look for invariant thinking.

Say:

```text
I choose the synchronization primitive based on the invariant. If multiple fields must
change together, I use a mutex. If one independent counter or flag needs concurrent access,
I may use atomics. If ownership is transferred between goroutines, a channel can be clearer.
```

Example: why atomics are not enough:

```go
type Inventory struct {
    available atomic.Int64
    reserved  atomic.Int64
}
```

This is suspicious because the invariant probably spans both values:

```text
available + reserved = total
available must never go negative
reservation ID must map to amount
```

Use a mutex:

```go
type Inventory struct {
    mu           sync.Mutex
    total        int64
    available    int64
    reservations map[string]int64
}
```

Memory model senior phrasing:

```text
Without a happens-before relation, another goroutine is not guaranteed to observe writes
in the order I expect. Mutex unlock/lock, channel send/receive, channel close/receive,
and atomic operations are common synchronization edges.
```

Debugging contention:

- Enable mutex profile.
- Inspect block profile.
- Check pprof for time in `sync.(*Mutex).Lock`.
- Reduce critical section size.
- Avoid I/O while locked.
- Shard state if one lock is hot.
- Consider ownership model changes before clever lock-free code.

### 27.7 How to talk about GC, memory, and escape analysis

A senior engineer distinguishes allocation, retention, and scan cost.

```text
Allocation: how fast objects are created.
Retention: how much remains reachable.
Scan cost: how much pointer-containing memory GC must walk.
```

Interview story template:

```text
We saw memory grow after a feature rollout. I first checked whether RSS, heap in-use,
and allocation rate moved together. Then I captured heap profiles and goroutine profiles.
The heap profile showed large byte slices retained through a cache. The code kept a
small slice header pointing into a full uploaded file. We fixed it by copying the required
header bytes and bounding the cache. After rollout, heap in-use and GC frequency dropped.
```

This is a strong senior story because it includes symptom, tool, root cause, fix, and verification.

Escape analysis answer:

```text
Escape analysis is the compiler pass that decides whether a value can live on the stack
or must live on the heap. Returning a pointer to a local value, storing values in interfaces,
or capturing variables in long-lived closures can cause escape. But `new` or `&T{}` does
not automatically mean heap allocation; the compiler decides.
```

Debugging commands:

```bash
go build -gcflags="-m=2" ./...
go test -bench . -benchmem ./...
go test -run '^$' -bench . -memprofile mem.out ./...
go tool pprof mem.out
```

What not to say:

```text
Go is garbage collected, so memory is automatic.
```

Better:

```text
The GC handles reclamation of unreachable objects, but I still need to manage object
lifetime, cache bounds, goroutine lifetime, and large backing arrays carefully.
```

### 27.8 How to talk about performance like a senior

Use a measurement-first loop:

```text
SLO -> workload -> profile -> hypothesis -> change -> compare -> monitor
```

Example answer for “API latency increased”:

```text
I would first separate user-facing latency from internal CPU time. I would check request
rate, error rate, P95/P99 latency, DB pool waits, downstream latency, goroutine count,
heap usage, and GC cycles. If CPU increased, I would capture CPU profiles. If latency
increased without CPU, I would inspect blocking, mutex, DB, network, and trace data.
I would rollback quickly if impact is high and root cause is not obvious.
```

Performance toolkit:

```text
benchmark: local function-level measurement
cpu profile: where CPU time goes
heap profile: retained memory or allocation sites
mutex profile: lock contention
block profile: goroutines blocked on sync/channel
trace: scheduler, network, syscalls, GC, goroutine lifecycle
metrics: production trend and saturation
logs: event context
traces: request path across services
```

High-paying interview signal: talk about saturation, not only latency.

Saturation examples:

- DB pool wait count rising.
- Worker queue depth rising.
- Goroutine count rising.
- CPU near limit.
- Heap approaching memory limit.
- External dependency latency increasing.
- Kafka consumer lag increasing.
- HTTP client connection pool exhausted.

Senior performance tradeoffs:

- Preallocation improves allocation behavior but can waste memory if guessed poorly.
- Buffer pooling can reduce allocations but complicates ownership and data safety.
- More goroutines can improve I/O overlap but overload dependencies.
- Caching reduces latency but increases memory, invalidation complexity, and stale data risk.
- Sharding locks reduces contention but increases implementation complexity.

### 27.9 Production ownership stories to prepare

For 1 Cr+ interviews, prepare 5-7 real stories. Each story should fit this shape:

```text
Context: what system and scale?
Problem: what broke or needed improvement?
Action: what did you personally do?
Tradeoff: what options did you reject and why?
Result: measurable improvement.
Learning: what changed afterward?
```

Story categories:

- Reduced latency.
- Reduced memory or GC pressure.
- Fixed goroutine leak.
- Improved reliability during dependency outage.
- Designed idempotent write path.
- Led migration without downtime.
- Improved observability.
- Simplified architecture.
- Mentored team into better Go practices.

Example strong story:

```text
Our order API P99 latency jumped from 400ms to 1.8s during payment provider slowness.
I found retries were not bounded by request deadline and fan-out was creating too many
goroutines per request. We added per-call timeouts, idempotency keys, retry budget with
jitter, and a bounded worker pool aligned to provider capacity. We also added dependency
latency metrics and circuit breaker alerts. P99 returned below 500ms during the next
provider incident, and error behavior became predictable.
```

This says: production, diagnosis, Go concurrency, resilience, measurement.

### 27.10 System design expectations for senior Go roles

Senior Go roles often combine coding and system design. You should be ready to design:

- URL shortener.
- Rate limiter.
- Job queue.
- Notification service.
- Payment/order service.
- File upload service.
- Metrics ingestion service.
- Log processing pipeline.
- Real-time chat backend.
- Inventory reservation system.
- API gateway or middleware platform.

Answer structure:

```text
1. Clarify requirements and scale.
2. Define APIs.
3. Define data model.
4. State consistency needs.
5. Choose storage.
6. Define concurrency model.
7. Define failure handling.
8. Add observability.
9. Discuss security.
10. Explain tradeoffs and evolution.
```

Example: payment API senior notes:

```text
Must support idempotency keys.
Must avoid double charge.
Must persist state transitions.
External provider calls need timeout and retry policy.
DB transaction should not remain open while waiting on provider unless design requires it.
Webhook handling must be idempotent.
Audit trail is required.
Sensitive data must not be logged.
```

State machine:

```text
created -> authorization_pending -> authorized -> captured
                         |              |
                         v              v
                      failed        refunded
```

Go-specific implementation discussion:

- Use context deadlines for provider calls.
- Use small interfaces for provider adapters.
- Use transaction boundaries around local state changes.
- Use worker queue/outbox for async provider workflows.
- Use structured logs with payment ID and request ID.
- Use metrics for provider latency, failures, retries, and state counts.

### 27.11 LLD answer frameworks for Go

For low-level design, write down invariants before code.

LRU cache:

```text
Invariant:
map has one entry per linked-list node.
front is most recently used.
back is least recently used.
len <= capacity.
all map and list mutations happen under same lock.
```

Worker pool:

```text
Invariant:
no more than N jobs execute concurrently.
producer sees backpressure when queue is full.
workers exit on context cancellation.
results are not sent after caller cancellation.
```

Rate limiter:

```text
Invariant:
tokens never exceed capacity.
tokens never go below zero.
refill uses elapsed time since last update.
per-key limiter count is bounded by eviction.
```

Idempotency:

```text
Invariant:
same key + same request returns same response.
same key + different request is rejected.
business operation and idempotency record are committed atomically.
```

For each LLD, mention:

- Data structures.
- Locking strategy.
- API shape.
- Error behavior.
- Tests.
- Metrics.
- Memory bounds.

### 27.12 Senior Go coding round checklist

Before writing code:

- Confirm input constraints.
- Confirm error behavior.
- Confirm concurrency requirements.
- Confirm whether order matters.
- Confirm memory limits.
- Confirm expected API.

While coding:

- Keep types small and named.
- Handle errors immediately.
- Avoid global mutable state.
- Use table tests mentally.
- Keep concurrency cancellation-aware.
- Prefer clarity over clever generic helpers.

Before saying done:

- Walk through empty input.
- Walk through invalid input.
- Walk through large input.
- Walk through cancellation if concurrent.
- Walk through race safety.
- Walk through memory retention.
- State complexity.

Good senior closing:

```text
The implementation is O(n) time and O(k) memory where k is the number of active keys.
The map and list are protected by one mutex because the invariant spans both structures.
For production I would add capacity metrics, eviction counters, and race-detector tests.
```

### 27.13 Compensation-oriented preparation plan

Four-week plan:

```text
Week 1: Go runtime, concurrency, memory model, pprof, trace
Week 2: production engineering, HTTP, DB pools, resilience, observability
Week 3: LLD systems: cache, limiter, queue, idempotency, inventory
Week 4: mock interviews, incident stories, resume/project sharpening
```

Daily routine:

- 45 minutes: one deep Go topic.
- 45 minutes: one coding or LLD problem.
- 30 minutes: explain one production story aloud.
- 20 minutes: revise notes into crisp interview answers.

Projects that create strong interview proof:

- High-throughput log processor with profiling report.
- Production-grade HTTP service with graceful shutdown and observability.
- Durable job queue with retries and dead letters.
- Generic LRU cache with benchmarks and race tests.
- Distributed rate limiter design with local implementation.
- Idempotent payment/order service design.

Resume bullets should show business and engineering outcome:

```text
Reduced P99 latency of Go order API from 1.8s to 420ms by bounding fan-out,
adding provider timeouts, and optimizing DB pool saturation.

Reduced heap usage by 38% in Go ingestion service by fixing slice retention,
bounding cache growth, and validating changes with pprof heap profiles.

Designed idempotent payment workflow using transactional request keys and
asynchronous outbox processing, eliminating duplicate charge incidents.
```

### 27.14 Questions you should ask interviewers

High-signal questions:

- What are the highest-traffic Go services owned by this team?
- What are the main production failure modes today?
- How do you measure service reliability?
- What is the expected ownership scope for this role?
- How are incidents reviewed?
- What are the biggest technical debts in the Go codebase?
- How does the team handle migrations and backward compatibility?
- What does success look like in the first 6 months?

These questions position you as someone thinking about ownership, not only joining as a ticket-taker.

### 27.15 Final senior readiness checklist

You are ready for strong senior Go interviews when you can confidently explain:

- G-M-P scheduler model.
- Context cancellation and goroutine ownership.
- Channel close/send/receive behavior.
- Mutex versus channel tradeoffs.
- Happens-before and data races.
- Escape analysis and stack versus heap.
- GC cost: allocation, retention, pointer scanning.
- pprof CPU, heap, mutex, block profiles.
- `go tool trace` use cases.
- HTTP server/client timeout design.
- DB pool behavior and transaction boundaries.
- Idempotency and retry safety.
- Graceful shutdown for HTTP plus workers.
- Observability: logs, metrics, traces, profiles.
- LLD of cache, queue, limiter, URL shortener, payment flow.
- Real production stories with metrics and tradeoffs.

Final mindset:

```text
At 5+ years, you are not selling syntax knowledge.
You are selling judgment: how you keep Go systems correct, fast, observable,
secure, and maintainable under real production pressure.
```

---

This handbook intentionally emphasizes stable language semantics and engineering decisions. For precise package APIs and release-specific compiler/runtime behavior, consult the Go standard library documentation and the release notes for the exact Go version you operate.
