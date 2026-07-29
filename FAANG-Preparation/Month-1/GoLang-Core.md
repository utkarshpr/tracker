# Go Language Deep Dive — FAANG Senior Engineer Study Notes

Self-contained. No internet required. Every concept is explained fully inline.

> **Go-first track:** Language fundamentals, idioms, LLD examples, and interview Q&A live in
> **[`GoLang-Deep-Track.md`](./GoLang-Deep-Track.md)**. This file owns **runtime · concurrency · networking · performance · production**.
> Study order: Deep-Track §§1–12 → this file §2 → this file §1 → this file §§3–5 → Deep-Track LLD + Q&A.

---

## Table of Contents

- **[Go Deep Track (language + LLD + Q&A)](./GoLang-Deep-Track.md)** ← start here for types/interfaces/errors/generics
- [1. Go Runtime Internals](#1-go-runtime-internals)
  - [1.1 GMP Scheduler](#11-gmp-scheduler)
  - [1.2 Stack Growth](#12-stack-growth)
  - [1.3 Garbage Collector](#13-garbage-collector)
  - [1.4 Memory Allocator](#14-memory-allocator)
- [2. Concurrency](#2-concurrency)
  - [2.1 Channels](#21-channels)
  - [2.2 Select Statement](#22-select-statement)
  - [2.3 Context Package](#23-context-package)
  - [2.4 Worker Pool Pattern](#24-worker-pool-pattern)
  - [2.5 Fan-Out / Fan-In](#25-fan-out--fan-in)
  - [2.6 Rate Limiting — Token Bucket](#26-rate-limiting--token-bucket)
  - [2.7 sync Package](#27-sync-package)
  - [2.8 Atomic Operations](#28-atomic-operations)
  - [2.9 Common Concurrency Bugs](#29-common-concurrency-bugs)
- [3. Networking](#3-networking)
  - [3.1 net/http Internals](#31-nethttp-internals)
  - [3.2 HTTP/2](#32-http2)
  - [3.3 gRPC in Go](#33-grpc-in-go)
  - [3.4 TCP vs UDP](#34-tcp-vs-udp)
  - [3.5 Connection Pooling](#35-connection-pooling)
- [4. Performance Engineering](#4-performance-engineering)
  - [4.1 pprof](#41-pprof)
  - [4.2 Benchmarking](#42-benchmarking)
  - [4.3 Common Performance Patterns](#43-common-performance-patterns)
- [5. Production Topics](#5-production-topics)
  - [5.1 Graceful Shutdown](#51-graceful-shutdown)
  - [5.2 Circuit Breaker](#52-circuit-breaker)
  - [5.3 Retry with Exponential Backoff](#53-retry-with-exponential-backoff)
  - [5.4 Structured Logging](#54-structured-logging)
  - [5.5 HTTP Middleware Pattern](#55-http-middleware-pattern)
- [Quick Reference](#quick-reference)
  - [GMP — Key Numbers](#gmp--key-numbers)
  - [Channel Operations — At a Glance](#channel-operations--at-a-glance)
  - [Context Rules](#context-rules)
  - [Common pprof Commands](#common-pprof-commands)
  - [Race Detector](#race-detector)
  - [Benchmark Flags](#benchmark-flags)
  - [Real-World Go Usage](#real-world-go-usage-where-go-runs-in-production)

---

# 1. Go Runtime Internals

## 1.1 GMP Scheduler

> ⭐ **IMPORTANT CONCEPT:** GMP (Goroutine / Machine / Processor) is the core Go runtime interview topic — know work stealing and what happens on syscalls.
### What G, M, P Mean

Go uses an **M:N threading model** — it multiplexes M goroutines onto N OS threads. Three entities control this:

| Symbol | Name | What it is |
|--------|------|-----------|
| G | Goroutine | A user-space "thread." Cheap: starts at 2–8 KB stack. Millions can exist. |
| M | Machine | An actual OS thread. Created by the runtime. Blocks on syscalls. |
| P | Processor | A logical CPU context. Holds a run queue of runnable Gs. GOMAXPROCS = number of Ps. |

A G runs ON an M, but only while that M is attached TO a P.

```text
ASCII: GMP Relationship

  P0                  P1
 ┌──────────────┐    ┌──────────────┐
 │ Local RunQ   │    │ Local RunQ   │
 │ [G3][G4][G5] │    │ [G6][G7]     │
 └──────┬───────┘    └──────┬───────┘
        │                   │
        ▼                   ▼
      M0 ──── G1          M1 ──── G2
   (running)           (running)

        Global RunQ: [G8][G9][G10]

   M2 (idle, no P)   M3 (blocked in syscall, P released)
```

> **💡 Key Insight:** An M can only execute goroutines if it holds a P. If M blocks (syscall, CGo), it releases its P so another M can pick it up.

> 🌍 **Real-World:** Docker (written in Go) uses the GMP scheduler to manage thousands of concurrent container operations — each container's lifecycle runs as a goroutine, and the scheduler multiplexes them onto a small pool of OS threads so the daemon never spawns one thread per container.

---

### Run Queues

There are two levels of run queues:

1. **Local run queue (LRQ)**: per-P, holds up to **256** runnable Gs. Accessed without a lock by the owning P.
2. **Global run queue (GRQ)**: shared across all Ps, requires a lock. Used when LRQ is full or for fairness.

When a new goroutine is created (`go f()`), the runtime tries to put it on the current P's LRQ. If LRQ is full, half of its Gs are moved to the GRQ (batch move to avoid starvation).

Every **61** scheduler ticks, P checks GRQ first (prevents GRQ starvation).

---

### Work Stealing

When a P exhausts its LRQ, it does not idle. Instead:

1. Check GRQ — take `n = len(GRQ)/GOMAXPROCS + 1` goroutines.
2. Check network poller (goroutines that woke from I/O).
3. **Steal from another P's LRQ** — takes half of victim's queue.

Steal order is randomized to avoid thundering herd. This keeps all Ps busy and CPU utilization high.

```text
Work Steal:

  P0 (empty LRQ)          P1 (has [G5][G6][G7][G8])
        │                         │
        └──── steals half ────────┘
        P0 now has [G7][G8]
        P1 now has [G5][G6]
```

> 🌍 **Real-World:** Kubernetes' controller-manager uses work stealing implicitly — each controller runs as a goroutine and the Go runtime rebalances them across CPUs via work stealing, keeping all cores busy even when some controllers have bursty workloads (e.g., a node failure triggering a flood of pod reconciliation goroutines).

---

### Goroutine States

| State | Meaning |
|-------|---------|
| `_Grunnable` | Ready to run, sitting in a run queue |
| `_Grunning` | Executing on an M right now |
| `_Gwaiting` | Blocked — channel, mutex, timer, syscall |
| `_Gsyscall` | In a system call (M is blocked, P is released) |
| `_Gdead` | Finished, memory may be reused |
| `_Gcopystack` | Stack is being grown/copied (briefly) |

Transition diagram (simplified):

```text
  created ──► _Grunnable ──► _Grunning ──► _Gdead
                  ▲               │
                  │    preempt/   │  block (chan, mutex)
                  │    yield      ▼
                  └────────── _Gwaiting
                              (woken by channel send,
                               mutex unlock, timer fire)
```

---

### Preemption

**Old (before Go 1.14) — Cooperative preemption:**
A goroutine could only be preempted at a function call site. If a goroutine ran a tight loop with no function calls (e.g., `for { i++ }`), it would never yield and could starve other goroutines on the same P. The scheduler injected preemption checks at function prologues.

**Go 1.14+ — Asynchronous preemption:**
The runtime uses OS signals (SIGURG on Unix) to preempt a running goroutine at any safe point. The signal handler inspects the goroutine's register state, saves it, and switches to the scheduler. Safe points are not every instruction — the runtime maintains a table of safe points (GC-safe locations where the stack is fully described).

> **💡 Key Insight:** Tight CPU loops no longer starve the scheduler or delay GC after Go 1.14. This is critical for latency-sensitive applications.

> 🌍 **Real-World:** Cloudflare's reverse proxy (handling 26M+ req/s) benefited directly from Go 1.14 async preemption — before 1.14, a burst of CPU-heavy TLS handshakes could starve I/O goroutines on the same P, introducing latency spikes that disappeared after upgrading.

---

### How M:N Threading Works (summary)

- GOMAXPROCS Ps exist (default = number of CPU cores).
- The runtime creates Ms on demand (when a P has work but no M, or when M blocks on syscall).
- Max threads is controlled by `runtime/debug.SetMaxThreads` (default **10,000**).
- When M returns from syscall, it tries to re-acquire a P. If no P is free, M parks itself (stays alive but idle, put on idle list).

```text
Syscall path:
  G1 on M0 (holding P0) calls read() [blocking syscall]
    → M0 releases P0
    → P0 is picked up by M2 (idle) or a new M is created
    → M0 is now blocked in kernel
    → When read() returns, M0 tries to grab any P
    → If no P available, G1 goes to GRQ, M0 parks
```

---

## 1.2 Stack Growth

### Initial Stack Size

Every goroutine starts with a small stack. Historically 4 KB, currently **2 KB** in Go 1.4+ (reduced to lower memory cost of millions of goroutines). The stack grows dynamically as needed up to a default max of **1 GB** (configurable via `runtime/debug.SetMaxStack`).

> 🌍 **Real-World:** Uber's dispatch service runs hundreds of thousands of concurrent goroutines to track driver locations — the 2 KB initial stack means a fleet of 500,000 goroutines uses only ~1 GB in stack space alone, which would be impossible with Java's 1 MB default OS thread stack.

### Stack Segmentation (Old — Pre Go 1.3)

The old approach used **split stacks** (also called segmented stacks): when the stack needed to grow, a new segment was allocated and linked to the old one. This caused a **hot split** problem: if a function near the stack limit was called in a tight loop, it would repeatedly allocate/free stack segments, causing severe slowdowns (the "hot stack split" penalty).

### Contiguous Stack (Current)

Go 1.4+ uses **contiguous stacks**: when the stack needs to grow, the runtime:
1. Allocates a new, larger stack (typically 2x the current size).
2. **Copies all stack frames** to the new location.
3. Updates all pointers that pointed into the old stack (this requires the GC to know all pointer locations — hence Go's type system and no raw pointer arithmetic).
4. Frees the old stack.

The downside: pointers to stack-allocated variables can be invalidated during a stack copy. Go's **escape analysis** ensures that if you take the address of a local variable and that address could outlive a stack copy, the variable is moved to the heap.

```text
Stack copy on growth:

Before:
  [frame A | frame B | frame C |  FREE  ]  (2 KB)
                                   ↑ overflow!

After:
  [frame A | frame B | frame C | frame D | frame E |  FREE  ]  (4 KB)
  All pointers within stack updated.
```

---

### Escape Analysis

The compiler (at compile time) decides whether a variable lives on the **stack** (fast, no GC overhead) or the **heap** (slower allocation, GC must collect it).

Run `go build -gcflags="-m"` to see escape analysis decisions.

**Variables escape to heap when:**

1. **Returned pointer**: the pointed-to variable outlives its frame.
   ```go
   func newFoo() *Foo {
       f := Foo{}   // f escapes to heap — its address is returned
       return &f
   }
   ```

2. **Closed-over variables**: a closure captures a variable by reference.
   ```go
   func counter() func() int {
       n := 0       // n escapes — closure keeps it alive
       return func() int { n++; return n }
   }
   ```

3. **Interface values**: assigning a concrete value to an interface causes the value to escape (the interface holds a pointer internally).
   ```go
   var w io.Writer = os.Stdout  // fine, os.Stdout already on heap
   var i interface{} = 42       // 42 may escape to hold in interface
   ```

4. **Variables too large for stack**: if a local array/struct is very large, it goes to heap.
   ```go
   func bigArr() {
       var arr [1 << 20]byte  // 1 MB — escapes to heap
       _ = arr
   }
   ```

5. **Passed to functions that escape their arguments** (e.g., `fmt.Println` takes `interface{}` — all args escape).

> **💡 Key Insight:** If you care about allocation in a hot path, benchmark with `-benchmem` and inspect with `-gcflags="-m"`.

> 🌍 **Real-World:** The `net/http` package's `http.Request` struct is heap-allocated (it escapes through the handler interface), but small per-request values like parsed integer IDs stay on the stack if they never leave the handler scope — a distinction the Go team optimised carefully to keep HTTP handler overhead low at Cloudflare's scale.

---

## 1.3 Garbage Collector

### Tri-Color Mark-and-Sweep

Go's GC is a **concurrent, tri-color mark-and-sweep** collector. "Concurrent" means most GC work happens while the program (mutator) is running. "Tri-color" is the algorithm's invariant:

| Color | Meaning |
|-------|---------|
| White | Not yet visited. At GC end, white = unreachable = garbage. |
| Grey | Discovered but children not yet scanned. In worklist. |
| Black | Fully scanned. All children are at least grey. |

**Algorithm:**

1. **Mark start (STW)**: Stop the world briefly. Mark all roots (stack variables, globals, registers) as grey. Enable write barriers. Resume.
2. **Concurrent mark**: Goroutines keep running. GC workers scan grey objects: for each pointer in a grey object, color the pointed-to object grey (if white). Color the current object black.
3. **Mark termination (STW)**: Stop the world briefly. Drain any remaining grey objects. Disable write barriers. Resume.
4. **Concurrent sweep**: Reclaim white objects' memory. Happens concurrently.

```text
Tri-color state machine:

  white ──► grey ──► black
  (unseen)  (in    (done,
             queue)  children grayed)

  At GC end: white objects are garbage.
```

> 🌍 **Real-World:** Prometheus (the monitoring system written in Go) relies on Go's concurrent GC to scrape thousands of metric endpoints per second without STW pauses that would distort its own latency measurements — the sub-millisecond GC pauses mean Prometheus can record its own scrape durations accurately.

---

### Write Barrier

**The problem**: During concurrent marking, the mutator (your program) is running and can change pointers. This could create a situation where a black object (already fully scanned) gets a new pointer to a white object — the GC would never see that white object and would incorrectly collect it (use-after-free bug).

**The invariant to maintain** (**Dijkstra tri-color invariant**): no black object may point directly to a white object.

**The write barrier** is code injected by the compiler before every pointer write. When your program writes a pointer, the write barrier ensures the GC is notified. Go 1.17+ uses a **hybrid write barrier** (Yuasa deletion barrier + Dijkstra insertion barrier):

- When a pointer is deleted from an object: shade (grey) the old target.
- When a pointer is written into an object: shade the new target.

```go
// What the compiler turns this:
obj.field = ptr

// Into (conceptually):
if gcphase == _GCmark {
    shade(obj.field)  // grey the old value (deletion barrier)
    shade(ptr)        // grey the new value (insertion barrier)
}
obj.field = ptr
```

> **⚠️ Production Gotcha:** Write barriers have a small performance cost (~5–10 ns per write), which is why Go disables them outside GC phases.

---

### STW Pauses

Go's GC has two STW pauses per GC cycle:

1. **Mark start**: ~100–500 microseconds. Scans roots, enables write barriers.
2. **Mark termination**: ~100–200 microseconds. Finalizes marking.

These are the only moments the world stops. Everything else (marking, sweeping) is concurrent. Go targets sub-millisecond STW pauses as of Go 1.14+.

**When does GC trigger?**
- When heap size reaches a target (controlled by GOGC).
- When `runtime.GC()` is called manually.
- When the program has been idle for 2 minutes.

> 🌍 **Real-World:** Twitch's chat service (Go-based, handling millions of concurrent WebSocket connections) uses Go's sub-millisecond GC pauses as a hard requirement — a 200 ms STW pause at peak load would cause tens of thousands of users to see a frozen chat, which is visible immediately; the concurrent collector keeps p99 latency well under 10 ms.

---

### GC Tuning

**GOGC environment variable** (default: **100**):
- Means: trigger GC when live heap grows by GOGC% since last collection.
- `GOGC=100`: trigger when heap doubles (live data + 100% overhead).
- `GOGC=200`: less frequent GC, more memory used.
- `GOGC=off`: disables GC entirely (dangerous, only for CLI tools).

**GOMEMLIMIT (Go 1.19+)**:
- Sets a soft memory limit. GC becomes more aggressive when approaching limit.
- `GOMEMLIMIT=500MiB` — keeps total Go memory under 500 MB.
- More useful than GOGC for containerized apps.

```go
import (
    "runtime"
    "runtime/debug"
)

// Force a GC cycle (useful in tests, not in production hot paths)
runtime.GC()

// Set GOGC programmatically (returns old value)
old := debug.SetGCPercent(200)

// Set memory limit programmatically (Go 1.19+)
debug.SetMemoryLimit(512 * 1024 * 1024) // 512 MB
```

> 🌍 **Real-World:** Google's internal recommendation for containerised Go services is to set `GOMEMLIMIT` to ~90% of the container's memory limit — this prevents the Go runtime from growing the heap until the OOM-killer fires, a pattern adopted broadly after Go 1.19 by teams running Go on Kubernetes at Google and Cloudflare.

---

### Minimizing GC Pressure

The GC only has to collect heap-allocated objects. Reducing heap allocations = less GC work = lower latency.

**`sync.Pool`** — reuse allocations:
```go
var bufPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 0, 4096)
    },
}

func handler(w http.ResponseWriter, r *http.Request) {
    buf := bufPool.Get().([]byte)
    buf = buf[:0]            // reset length, keep capacity
    defer bufPool.Put(buf)   // return to pool after use

    buf = append(buf, "hello"...)
    w.Write(buf)
}
```

> **⚠️ Production Gotcha:** `sync.Pool` objects are cleared at every GC cycle. Do not store state in pools.

> 🌍 **Real-World:** The `fasthttp` library (used by high-throughput Go servers at VictoriaMetrics and others) uses `sync.Pool` extensively to reuse request/response buffers — benchmarks show it achieves 10x lower allocation rate than `net/http` for static workloads, directly cutting GC frequency and p99 latency.

**Pre-allocate slices**:
```go
// Bad: multiple allocations as slice grows
result := []int{}
for _, v := range data {
    result = append(result, v*2)
}

// Good: single allocation
result := make([]int, 0, len(data))
for _, v := range data {
    result = append(result, v*2)
}
```

**Avoid `fmt.Sprintf` in hot paths** (causes escapes):
```go
// Bad: allocates for interface conversion + string
log.Println(fmt.Sprintf("user %d logged in", userID))

// Better: use strconv, strings.Builder, or structured logging
```

---

## 1.4 Memory Allocator

Go's allocator is derived from **TCMalloc** (Google's Thread-Caching Malloc). It has a hierarchy:

```text
Allocation hierarchy:

  goroutine
      │
      ▼
  mcache (per-P, no lock needed)
      │ miss
      ▼
  mcentral (per size class, has lock)
      │ miss
      ▼
  mheap (global, has lock)
      │ miss
      ▼
  OS (mmap)
```

### mheap

The global heap. Manages memory in **pages** (8 KB each). Groups pages into **spans** (mspan). The mheap has a free list of spans organized by size.

### mspan

A contiguous run of memory pages. Each mspan serves objects of a specific **size class** (e.g., 8 bytes, 16 bytes, 32 bytes, ... up to 32 KB). A span holds many objects of that class.

### mcache

Each P has an **mcache**: a local cache of mspans, one per size class. Allocation from mcache requires no lock (only this P uses it).

### mcentral

When mcache runs out of a size class, it fetches a span from **mcentral**. mcentral has a lock but contention is low.

### Size Classes

Objects ≤ 32 KB: Go rounds up to the nearest size class (there are ~70 classes). This reduces fragmentation. Example: requesting 9 bytes gets a 16-byte slot.

Objects > 32 KB: allocated directly from mheap, rounded up to page size.

```text
Small object allocation (< 32 KB):

  1. Round size up to size class  (e.g., 17 bytes → 24-byte class)
  2. Look in P's mcache for that class
  3. If mcache has a free slot → done (no lock!)
  4. Else: fetch a fresh mspan from mcentral (lock mcentral briefly)
  5. Fill mcache from that span, allocate from it

Large object allocation (> 32 KB):
  1. Lock mheap
  2. Find/create span with enough pages
  3. Return pointer to start of span
```

> **💡 Key Insight:** Most allocations are lock-free (mcache hit), making Go's allocator extremely fast even under heavy goroutine concurrency.

> 🌍 **Real-World:** CockroachDB (distributed SQL written in Go) relies on Go's TCMalloc-derived allocator to handle thousands of concurrent Raft log allocations per second without lock contention — the per-P mcache means each processor allocates its own log entry objects independently, which was a key factor in CockroachDB choosing Go over C++ for latency predictability.

---

# 2. Concurrency

## 2.1 Channels

### Internal Structure

A channel is a pointer to a `hchan` struct in the runtime:

```text
hchan (runtime/chan.go):

  ┌─────────────────────────────────┐
  │ qcount   uint          (# items in buffer)      │
  │ dataqsiz uint          (buffer capacity)        │
  │ buf      unsafe.Pointer (circular buffer)       │
  │ elemsize uint16         (element size in bytes) │
  │ closed   uint32                                 │
  │ sendx    uint           (send index)            │
  │ recvx    uint           (receive index)         │
  │ recvq    waitq          (blocked receivers)     │
  │ sendq    waitq          (blocked senders)       │
  │ lock     mutex                                  │
  └─────────────────────────────────────────────────┘
```

### Buffered Channel — Circular Buffer

```text
Buffered channel make(chan int, 4):

buf: [ 10 | 20 | -- | -- ]
          ↑         ↑
        recvx      sendx
  qcount=2, dataqsiz=4

Send 30: buf becomes [ 10 | 20 | 30 | -- ], sendx=3, qcount=3
Recv:    returns 10, buf becomes [ -- | 20 | 30 | -- ], recvx=1, qcount=2
```

When buffer is **full**, sender blocks: its goroutine is wrapped in a `sudog` struct and added to `sendq`. When a receiver comes along, it dequeues from sendq directly.

When buffer is **empty**, receiver blocks: added to `recvq`. When a sender comes, it copies data directly to the waiting receiver's stack (bypasses buffer — optimization).

### Unbuffered Channel

`dataqsiz = 0`. Every send blocks until a receiver is ready (and vice versa). The sender and receiver **rendezvous** — data is copied directly between goroutine stacks. This is the fundamental synchronization primitive.

### Blocking Semantics Summary

| Operation | Unbuffered | Buffered (not full) | Buffered (full) |
|-----------|-----------|---------------------|-----------------|
| Send | Blocks until receiver ready | Does not block | Blocks until space |
| Receive | Blocks until sender ready | Does not block | Blocks until item |

> **💡 Key Insight:** Unbuffered channels are about synchronization (rendezvous). Buffered channels are about decoupling producer from consumer speed.

> 🌍 **Real-World:** Kubernetes uses Go channels as the messaging backbone between controllers — the scheduler writes pod assignments to a buffered channel that the kubelet goroutine reads and acts on, decoupling the scheduling rate from the kubelet's execution speed and preventing back-pressure from slow nodes from blocking the scheduler.

### Channel Directions

```go
func producer(ch chan<- int) {  // send-only
    ch <- 42
}

func consumer(ch <-chan int) {  // receive-only
    v := <-ch
    _ = v
}

// Bidirectional channel is assignable to either direction:
ch := make(chan int, 1)
producer(ch)  // fine: chan int → chan<- int
consumer(ch)  // fine: chan int → <-chan int
```

Direction enforcement is compile-time only. It prevents bugs (e.g., consumer accidentally sending).

### Closing Channels

```go
ch := make(chan int, 3)
ch <- 1
ch <- 2
close(ch)

// Ranging over closed channel drains buffer then stops:
for v := range ch {
    fmt.Println(v) // prints 1, 2 then loop exits
}

// Receive from closed channel returns zero value + false:
v, ok := <-ch
fmt.Println(v, ok) // 0 false

// Sending to closed channel panics:
// ch <- 3  // panic: send on closed channel
```

**Closing rules:**
- Only the sender should close a channel.
- Close only once. Use `sync.Once` if multiple senders.
- Never close a nil channel (panics).

### nil Channel

A **nil channel** blocks forever on both send and receive. This is useful in `select`:

```go
// Disable a case in select by setting channel to nil:
func merge(a, b <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for a != nil || b != nil {
            select {
            case v, ok := <-a:
                if !ok { a = nil; continue }  // disable this case
                out <- v
            case v, ok := <-b:
                if !ok { b = nil; continue }  // disable this case
                out <- v
            }
        }
    }()
    return out
}
```

> 🌍 **Real-World:** The `go-redis` client uses nil-channel disabling inside its pipeline flusher — when a connection is being drained, the send channel is set to nil so the `select` loop naturally stops reading new commands without requiring an additional boolean flag or mutex.

---

## 2.2 Select Statement

`select` blocks until one of its cases can proceed, then executes that case. If multiple cases are ready simultaneously, **one is chosen uniformly at random** (not the first one listed).

```go
select {
case v := <-ch1:
    // ...
case ch2 <- val:
    // ...
case <-time.After(5 * time.Second):
    // timeout
default:
    // executes immediately if no other case is ready (non-blocking)
}
```

### How select Works Internally

1. All channel operations in the cases are evaluated (channels and values are computed).
2. Channels are locked (in a deterministic order to avoid deadlock).
3. The runtime checks which cases are immediately ready.
4. If multiple ready: pick one at random.
5. If none ready and there's a `default`: execute default.
6. If none ready and no `default`: the goroutine is added to all channels' send/recv queues, then parked.
7. When woken by one channel, the goroutine removes itself from all other channels' queues.

### Pattern: Timeout

```go
func fetchWithTimeout(url string) ([]byte, error) {
    ch := make(chan []byte, 1)
    go func() {
        // ... do fetch
        ch <- result
    }()
    select {
    case data := <-ch:
        return data, nil
    case <-time.After(3 * time.Second):
        return nil, fmt.Errorf("timeout")
    }
}
```

> **⚠️ Production Gotcha:** `time.After` creates a timer that is not GC'd until it fires. For loops, use `time.NewTimer` and `t.Stop()` to avoid a timer leak.

> 🌍 **Real-World:** HashiCorp Consul's health checker uses `select` with `time.NewTimer` (not `time.After`) in its check loop — at Consul's scale running thousands of health checks per second, using `time.After` inside the loop would create thousands of leaked timers per second, a real memory leak that was found and fixed in production.

### Pattern: Done Channel / Cancellation

```go
func worker(done <-chan struct{}) {
    for {
        select {
        case <-done:
            return
        default:
            doWork()
        }
    }
}

done := make(chan struct{})
go worker(done)
// later:
close(done)  // broadcasts cancellation to all workers
```

> 🌍 **Real-World:** Docker (containerd) uses the done-channel pattern for container I/O stream management — when a container exits, the daemon closes a done channel that simultaneously stops the stdout, stderr, and stdin goroutines without any additional coordination, preventing goroutine leaks on container teardown.

---

## 2.3 Context Package

`context.Context` is the standard way to propagate cancellation, deadlines, and request-scoped values across API boundaries and goroutines.

### The Interface

```go
type Context interface {
    Deadline() (deadline time.Time, ok bool)
    Done() <-chan struct{}   // closed when context is cancelled
    Err() error             // nil if not cancelled; context.Canceled or context.DeadlineExceeded
    Value(key interface{}) interface{}
}
```

### Context Tree

Contexts form a tree. Cancelling a parent cancels all children.

```text
context.Background()
    │
    ├── WithCancel → ctx1 (cancel() called → ctx1 and children cancelled)
    │       │
    │       └── WithTimeout(ctx1, 5s) → ctx2 (cancelled if ctx1 cancelled OR 5s elapsed)
    │
    └── WithValue(key, val) → ctx3
```

### Creating Contexts

```go
// Root contexts (never cancelled):
ctx := context.Background()  // use at main, top-level handlers
ctx := context.TODO()        // placeholder when unsure what context to use

// Derived contexts:
ctx, cancel := context.WithCancel(parent)
defer cancel()  // ALWAYS defer cancel to avoid goroutine leak

ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()

ctx, cancel := context.WithDeadline(parent, time.Now().Add(5*time.Second))
defer cancel()

ctx = context.WithValue(parent, myKey{}, myValue)  // use typed key to avoid collisions
```

### How Cancellation Propagates

`WithCancel` attaches the child to the parent's internal list. When the parent is cancelled, it iterates its children and cancels them. This is implemented in the `context` package using a linked list of children protected by a mutex.

```go
// Checking cancellation in a long operation:
func process(ctx context.Context, items []Item) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ctx.Err()  // context.Canceled or DeadlineExceeded
        default:
        }
        if err := processItem(ctx, item); err != nil {
            return err
        }
    }
    return nil
}
```

> 🌍 **Real-World:** Google's internal RPC framework (which Go's `context` package was designed for) uses `WithDeadline` to propagate request deadlines across microservice boundaries — when a user request has 500 ms remaining, each downstream RPC call gets a context deadline set to that same absolute time, so the entire call tree fails fast instead of backing up with queued goroutines.

### WithValue — Use Carefully

`context.WithValue` is for request-scoped data (trace IDs, auth tokens), not for passing function parameters. Use a private key type to avoid collisions:

```go
type contextKey string

const (
    requestIDKey contextKey = "requestID"
    userIDKey    contextKey = "userID"
)

func WithRequestID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, requestIDKey, id)
}

func RequestIDFromContext(ctx context.Context) (string, bool) {
    id, ok := ctx.Value(requestIDKey).(string)
    return id, ok
}
```

> 🌍 **Real-World:** Datadog's Go APM tracer uses `context.WithValue` to store the active trace span — every instrumented function receives a `context.Context`, extracts the span, creates a child span, and injects it back, propagating distributed trace IDs through the entire call tree without any global state.

### Best Practices

1. Always pass `ctx` as the **first argument**.
2. Never store context in a struct (except when wrapping a long-lived object like an HTTP request).
3. Always call `cancel()` — forgetting leaks memory in the context tree.
4. `context.Background()` at main/server init; derive from there.
5. Don't pass `nil` context — use `context.TODO()` if unsure.

---

## 2.4 Worker Pool Pattern

A fixed number of goroutines process jobs from a shared channel. Limits concurrency and resource usage.

```go
package main

import (
	"context"
	"fmt"
	"sync"
)

type Job struct {
	ID   int
	Data string
}

type Result struct {
	JobID  int
	Output string
	Err    error
}

func workerPool(ctx context.Context, numWorkers int, jobs <-chan Job) <-chan Result {
	results := make(chan Result, numWorkers)

	var wg sync.WaitGroup
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case job, ok := <-jobs:
					if !ok {
						return // jobs channel closed
					}
					result := process(workerID, job)
					select {
					case results <- result:
					case <-ctx.Done():
						return
					}
				}
			}
		}(i)
	}

	// Close results channel when all workers are done
	go func() {
		wg.Wait()
		close(results)
	}()

	return results
}

func process(workerID int, job Job) Result {
	// Simulate work
	return Result{
		JobID:  job.ID,
		Output: fmt.Sprintf("worker %d processed: %s", workerID, job.Data),
	}
}

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Create job queue
	jobs := make(chan Job, 100)

	// Start worker pool (5 workers)
	results := workerPool(ctx, 5, jobs)

	// Send jobs
	go func() {
		for i := 0; i < 20; i++ {
			jobs <- Job{ID: i, Data: fmt.Sprintf("item-%d", i)}
		}
		close(jobs) // signal no more jobs
	}()

	// Collect results
	for result := range results {
		if result.Err != nil {
			fmt.Printf("job %d error: %v\n", result.JobID, result.Err)
			continue
		}
		fmt.Println(result.Output)
	}
}
```

> 🌍 **Real-World:** Stripe's Go-based payment processing pipeline uses a worker pool pattern to limit concurrent calls to downstream banking APIs — a fixed pool of 50 workers drains a buffered job channel, preventing thundering-herd bursts from opening thousands of simultaneous TCP connections to partner banks that enforce per-IP connection limits.

---

## 2.5 Fan-Out / Fan-In

**Fan-out**: distribute work from one channel to multiple goroutines.
**Fan-in**: merge results from multiple channels into one.

```go
package main

import (
	"fmt"
	"sync"
)

// Fan-out: each call to fanOut creates a goroutine reading from in
func fanOut(in <-chan int, numWorkers int) []<-chan int {
	channels := make([]<-chan int, numWorkers)
	for i := 0; i < numWorkers; i++ {
		channels[i] = worker(in)
	}
	return channels
}

func worker(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for v := range in {
			out <- v * v // square each value
		}
	}()
	return out
}

// Fan-in: merge multiple channels into one
func fanIn(channels ...<-chan int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup

	output := func(ch <-chan int) {
		defer wg.Done()
		for v := range ch {
			out <- v
		}
	}

	wg.Add(len(channels))
	for _, ch := range channels {
		go output(ch)
	}

	// Close out channel when all goroutines finish
	go func() {
		wg.Wait()
		close(out)
	}()

	return out
}

func main() {
	// Source channel
	in := make(chan int, 10)
	go func() {
		for i := 1; i <= 10; i++ {
			in <- i
		}
		close(in)
	}()

	// Fan out to 3 workers
	workerChannels := fanOut(in, 3)

	// Fan in results
	results := fanIn(workerChannels...)

	// Collect
	for v := range results {
		fmt.Println(v)
	}
}
```

> 🌍 **Real-World:** Dropbox's file sync service uses a fan-out/fan-in pipeline in Go to compute block-level checksums — a single file-reading goroutine fans out to a pool of SHA-256 workers (one per CPU core) and fans in the results to a sequencer, reducing checksum time for large files from sequential to near-parallel without changing the rest of the pipeline.

---

## 2.6 Rate Limiting — Token Bucket

**Token bucket**: tokens accumulate at a fixed rate up to a maximum capacity. Each operation consumes one token. If no tokens, block or reject.

```go
package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// TokenBucket implements a token bucket rate limiter.
type TokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	capacity float64
	rate     float64 // tokens per second
	lastTime time.Time
}

func NewTokenBucket(capacity float64, ratePerSecond float64) *TokenBucket {
	return &TokenBucket{
		tokens:   capacity,
		capacity: capacity,
		rate:     ratePerSecond,
		lastTime: time.Now(),
	}
}

// refill adds tokens based on time elapsed since last call.
func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastTime).Seconds()
	tb.tokens += elapsed * tb.rate
	if tb.tokens > tb.capacity {
		tb.tokens = tb.capacity
	}
	tb.lastTime = now
}

// Allow returns true if a token is available (non-blocking).
func (tb *TokenBucket) Allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	if tb.tokens >= 1.0 {
		tb.tokens--
		return true
	}
	return false
}

// Wait blocks until a token is available or context is cancelled.
func (tb *TokenBucket) Wait(ctx context.Context) error {
	for {
		if tb.Allow() {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Millisecond * 10):
			// retry shortly
		}
	}
}

func main() {
	// Allow 5 requests per second, burst up to 10
	limiter := NewTokenBucket(10, 5)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			if err := limiter.Wait(ctx); err != nil {
				fmt.Printf("request %d cancelled: %v\n", id, err)
				return
			}
			fmt.Printf("request %d processed at %s\n", id, time.Now().Format("15:04:05.000"))
		}(i)
	}
	wg.Wait()
}
```

> **💡 Key Insight:** For production, prefer `golang.org/x/time/rate` which implements a proper token bucket with precise timing.

> 🌍 **Real-World:** Uber's API gateway (written in Go) uses `golang.org/x/time/rate` (token bucket) per user ID to enforce per-user rate limits — the `Limiter.Wait(ctx)` call integrates with the request context so that when a user exhausts their burst budget, their goroutine parks cleanly without spinning, and the context deadline ensures no goroutine leaks if the client disconnects while waiting.

---

## 2.7 sync Package

### Mutex vs RWMutex

| Primitive | Use case | Locking API |
|-----------|----------|-------------|
| `sync.Mutex` | One goroutine at a time; reads and writes both frequent, or writes dominate | `Lock()` / `Unlock()` |
| `sync.RWMutex` | Multiple concurrent readers OR one exclusive writer; reads heavily outnumber writes | `RLock()` / `RUnlock()` for reads; `Lock()` / `Unlock()` for writes |

Use `RWMutex` when reads heavily outnumber writes (e.g., a config cache):

```go
type SafeMap struct {
	mu sync.RWMutex
	m  map[string]string
}

func (s *SafeMap) Get(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, ok := s.m[key]
	return v, ok
}

func (s *SafeMap) Set(key, val string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[key] = val
}
```

> **⚠️ Production Gotcha:** Don't upgrade an `RLock` to a `Lock` (deadlock). Don't use value receiver for Mutex (copies the lock).

> 🌍 **Real-World:** Consul's in-memory service catalog uses `sync.RWMutex` — reads (DNS lookups, health checks) vastly outnumber writes (service registration), so thousands of concurrent read goroutines can access the catalog without blocking each other, while write locks are held only during agent heartbeat updates.

### sync.Once

Executes a function exactly once, even across goroutines. Used for lazy initialization.

```go
var (
	instance *DB
	once     sync.Once
)

func GetDB() *DB {
	once.Do(func() {
		instance = connectToDB() // called exactly once
	})
	return instance
}
```

Internally: uses an atomic flag. First `Do` call acquires a mutex, runs the function, sets the flag. Subsequent calls see the flag and skip.

> 🌍 **Real-World:** The AWS SDK for Go uses `sync.Once` to initialise the default credential provider chain — the first API call anywhere in the program triggers a one-time credential discovery (env vars → ~/.aws → EC2 metadata), and subsequent calls return the cached result without any locking overhead.

### sync.WaitGroup

Waits for a collection of goroutines to finish.

```go
var wg sync.WaitGroup

for i := 0; i < 5; i++ {
	wg.Add(1)  // increment before goroutine starts
	go func(i int) {
		defer wg.Done()  // decrement when done
		doWork(i)
	}(i)
}

wg.Wait()  // blocks until counter reaches 0
```

> **⚠️ Production Gotcha:** `Add` must be called before the goroutine starts. If called inside the goroutine, there's a race: `Wait` might return before the goroutine even runs.

> 🌍 **Real-World:** Kubernetes' batch job controller uses `sync.WaitGroup` to coordinate parallel pod status polling — when reconciling a Job object, it fans out goroutines to check each pod's phase in parallel and uses `wg.Wait()` before aggregating results into the Job status, cutting reconciliation latency proportional to the number of pods.

### sync.Pool

Object pool for reuse. Reduces GC pressure by reusing allocations. Objects are cleared at every GC cycle — do not store state.

```go
var pool = sync.Pool{
	New: func() interface{} {
		return &bytes.Buffer{}
	},
}

func serialize(data interface{}) []byte {
	buf := pool.Get().(*bytes.Buffer)
	buf.Reset()          // important: reset before use
	defer pool.Put(buf)

	json.NewEncoder(buf).Encode(data)
	out := make([]byte, buf.Len())
	copy(out, buf.Bytes())
	return out
}
```

> 🌍 **Real-World:** The `zap` structured logger (used extensively at Uber) uses `sync.Pool` for its internal `Buffer` objects — every log entry borrows a buffer, formats the JSON into it, writes to the output, then returns the buffer to the pool, achieving near-zero per-log-entry allocation at Uber's scale of millions of log entries per second.

### sync.Map

Optimized for two access patterns:
1. Write once, read many (e.g., caches where keys are only added).
2. Concurrent reads and writes from disjoint sets of keys.

Internal structure: a "read" map (atomic, lock-free) and a "dirty" map (locked). Reads check read map first; on miss, promote dirty to read.

```go
var m sync.Map

m.Store("key", "value")

val, ok := m.Load("key")
if ok {
    fmt.Println(val.(string))
}

// LoadOrStore: atomic get-or-set
actual, loaded := m.LoadOrStore("key2", "default")

// Delete
m.Delete("key")

// Range (not guaranteed snapshot)
m.Range(func(k, v interface{}) bool {
    fmt.Println(k, v)
    return true // return false to stop
})
```

> **⚠️ Production Gotcha:** When NOT to use `sync.Map`: if you have frequent reads AND writes to the same keys, a `map` + `sync.RWMutex` is often faster. Benchmark.

> 🌍 **Real-World:** Go's own `net/http` transport uses `sync.Map` to cache per-host connection pools — hosts are registered once on first use and then read millions of times per second for connection reuse lookups, which is exactly the write-once-read-many pattern `sync.Map` is optimised for.

### sync Primitives Comparison

| Primitive | Best for | Avoid when |
|-----------|----------|------------|
| `sync.Mutex` | Mixed read/write or write-heavy access | Read-heavy workloads |
| `sync.RWMutex` | Read-heavy, occasional writes | Write-heavy (writers starve readers) |
| `sync.Once` | One-time initialization | Repeated setup |
| `sync.WaitGroup` | Waiting for N goroutines to finish | Unknown number of goroutines |
| `sync.Pool` | Reusing short-lived allocations | Objects with meaningful state |
| `sync.Map` | Write-once-read-many or disjoint key sets | Frequent updates to same keys |

---

## 2.8 Atomic Operations

`sync/atomic` provides lock-free operations on primitive types. Faster than mutex for simple counters and flags because they use CPU instructions (LOCK XADD, CMPXCHG) rather than OS-level locking.

```go
import "sync/atomic"

// Counter
var count int64
atomic.AddInt64(&count, 1)         // atomic increment
n := atomic.LoadInt64(&count)      // atomic read
atomic.StoreInt64(&count, 0)       // atomic write

// Compare-and-swap (CAS): only stores if current == old
// Returns true if swap happened
swapped := atomic.CompareAndSwapInt64(&count, 0, 1)

// Pointer operations (Go 1.19+: atomic.Pointer[T])
var p atomic.Pointer[Config]
cfg := &Config{Timeout: 5 * time.Second}
p.Store(cfg)
current := p.Load()  // atomic read of pointer
```

### When to Use Atomics vs Mutex

| Scenario | Use |
|----------|-----|
| Single variable, simple operation (counter, flag, pointer swap) | **Atomics** — CPU-level guarantee |
| Multiple variables that must be consistent together | **Mutex** — protects compound state |

```go
// BAD: two atomic operations are not atomic together
if atomic.LoadInt64(&count) > 0 {
    atomic.AddInt64(&count, -1)  // race: count might be 0 now
}

// GOOD: mutex for compound operation
mu.Lock()
if count > 0 {
    count--
}
mu.Unlock()
```

### Memory Ordering

Go's memory model guarantees: within a goroutine, operations happen in program order. Across goroutines, synchronization (channel ops, mutex lock/unlock, atomic ops) establishes **happens-before**.

> **💡 Key Insight:** Atomic operations in Go are sequentially consistent — they include a full memory barrier, preventing CPU/compiler reordering. This is stronger than C++ `memory_order_relaxed`.

> 🌍 **Real-World:** Prometheus uses `atomic.AddUint64` for its counter metric type — every `counter.Inc()` call is a single hardware-atomic increment with no mutex, allowing thousands of goroutines to increment the same metric concurrently with no lock contention, which was the primary reason Prometheus metrics collection adds near-zero overhead to instrumented Go services.

> 🌍 **Real-World:** Go's `net/http` server uses `atomic.Pointer[Config]` (Go 1.19+) to hot-swap TLS configuration — a background goroutine atomically replaces the TLS config pointer after certificate renewal, and all active connection goroutines see the new config on their next TLS handshake without any mutex or restart.

---

## 2.9 Common Concurrency Bugs

### Deadlock

All goroutines are blocked waiting for each other. The Go runtime detects this and panics with `"all goroutines are asleep - deadlock!"`.

```go
// Classic deadlock: two goroutines, two mutexes, opposite lock order
var mu1, mu2 sync.Mutex

go func() {
    mu1.Lock()
    mu2.Lock()  // waits for mu2
    // ...
    mu2.Unlock(); mu1.Unlock()
}()

go func() {
    mu2.Lock()
    mu1.Lock()  // waits for mu1 — DEADLOCK
    // ...
    mu1.Unlock(); mu2.Unlock()
}()
```

Fix: always acquire locks in the same order. Or use `trylock` with timeout. Or restructure to use a single lock.

### Goroutine Leak

A goroutine that blocks forever without ever terminating. Common patterns:

```go
// LEAK: goroutine blocks on channel send, nobody receives
func leaky() {
    ch := make(chan int)
    go func() {
        result := compute()
        ch <- result  // blocks if caller already returned
    }()
    // caller returns without receiving from ch — goroutine is stuck forever
}

// FIX: buffered channel OR pass context
func fixed() {
    ch := make(chan int, 1)  // buffered: goroutine can send and exit
    go func() {
        ch <- compute()
    }()
}
```

> **📖 Real-World Example:** Detect goroutine leaks with pprof: `http.HandleFunc("/debug/pprof/", pprof.Index)`, then `go tool pprof http://localhost:6060/debug/pprof/goroutine`.

> 🌍 **Real-World:** Netflix's Dispatch (a Go service managing incident coordination) discovered a goroutine leak in its WebSocket handler via pprof's goroutine endpoint — a `select` on a response channel was missing a `<-ctx.Done()` case, so any disconnected WebSocket client left a goroutine permanently blocked; over days, this accumulated to tens of thousands of leaked goroutines consuming gigabytes of stack memory.

### Data Race

Two goroutines access the same memory, at least one writes, with no synchronization.

```go
// RACE: unsynchronized counter
var counter int
go func() { counter++ }()
go func() { counter++ }()
// counter might be 1 instead of 2

// DETECT: go test -race ./... or go run -race main.go
// OUTPUT: DATA RACE on counter
```

The **race detector** uses shadow memory to track all memory accesses and reports violations.

**Happens-before**: operation A happens-before B if there's a chain of synchronization events (channel send before receive, mutex unlock before lock, goroutine start before its first op).

> 🌍 **Real-World:** Google runs `go test -race` in CI for all internal Go services — the race detector caught a data race in an early version of the Kubernetes scheduler where two goroutines updated a pod's scheduled node name concurrently, which would have caused silent data corruption in production without the detector.

### Starvation

A goroutine is never scheduled despite being runnable. Can happen with:
- Many goroutines competing for a mutex (some always lose).
- A compute-heavy goroutine before Go 1.14 (no preemption).
- Priority inversion (not relevant in Go — all goroutines have equal priority).

Go's scheduler is not strictly fair but work-stealing keeps it balanced in practice. For explicit fairness, use a dedicated channel-based queue.

---

# 3. Networking

## 3.1 net/http Internals

### http.Server — How It Handles Connections

```go
server := &http.Server{
    Addr:         ":8080",
    Handler:      mux,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 15 * time.Second,
    IdleTimeout:  60 * time.Second,
}
```

Internally, `ListenAndServe`:
1. Creates a TCP listener on the given address.
2. Calls `Accept()` in a loop.
3. For each accepted connection, spawns a goroutine: `go c.serve(ctx)`.

Each connection goroutine:
1. Reads the HTTP request (line by line: request line → headers → body).
2. Calls the handler.
3. Writes the response.
4. If `Connection: keep-alive`, loops back to read the next request.

```text
Connection lifecycle:

  TCP Accept
      │
      ▼
  goroutine: c.serve()
      │
      ├── Read request (parse HTTP/1.1)
      ├── Call handler(w, r)
      ├── Write response
      └── Keep-alive? ──yes──► loop back
                    └──no──► close TCP conn
```

> 🌍 **Real-World:** Cloudflare's Go-based reverse proxy handles millions of concurrent connections by exploiting exactly this goroutine-per-connection model — at 2 KB initial stack per goroutine, 1 million concurrent connections consume only ~2 GB of stack memory, versus Java's thread-per-connection model which would require ~1 TB for the same workload.

### Timeouts

Missing timeouts are a common production bug:

| Timeout | What it covers |
|---------|---------------|
| `ReadTimeout` | Time to read entire request including body |
| `WriteTimeout` | Time to write response |
| `IdleTimeout` | Time a keep-alive connection can be idle |
| `ReadHeaderTimeout` | Time to read just the headers |

> **⚠️ Production Gotcha:** Without timeouts, a slow client can hold a goroutine forever — goroutine leak.

### http.Client vs http.DefaultClient

```go
// http.DefaultClient has no timeout — NEVER use in production:
resp, _ := http.Get("http://example.com")  // can hang forever

// Always create a client with timeout:
client := &http.Client{
    Timeout: 10 * time.Second,
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
        TLSHandshakeTimeout: 10 * time.Second,
    },
}
resp, err := client.Get("http://example.com")
if err != nil {
    return err
}
defer resp.Body.Close()  // ALWAYS close body to return connection to pool
```

> **⚠️ Production Gotcha:** Failing to close `resp.Body` prevents the connection from being reused (or causes a connection leak).

> 🌍 **Real-World:** Shopify's production Go services enforce a hard rule: every `http.Client` is created with explicit `Timeout`, `MaxIdleConnsPerHost`, and `IdleConnTimeout` values — a historical incident where a Go service using `http.DefaultClient` caused a cascade failure when a downstream service slowed down, leading all goroutines to block indefinitely on reads, is now used as the onboarding cautionary tale for new Go engineers at Shopify.

### Transport — Connection Pooling

`http.Transport` maintains a pool of idle connections per host. When you make a request:
1. Check pool for an idle connection to that host.
2. If found, reuse it (avoids TCP handshake + TLS).
3. If not found, create a new connection.
4. After response, if `Connection: keep-alive`, return connection to pool.

---

## 3.2 HTTP/2

HTTP/2 solves head-of-line blocking in HTTP/1.1.

### Multiplexing

In HTTP/1.1, one request at a time per connection (pipelining helps but suffers HOL blocking). Browsers open 6 connections per host to work around this.

HTTP/2 uses a single TCP connection with multiple **streams**. Each request/response is a stream, frames from different streams are interleaved:

```text
HTTP/1.1: connection 1: [REQ1][-----RESP1-----][REQ2][RESP2]
          connection 2: [REQ3][RESP3]
          (need multiple connections)

HTTP/2:   one connection:
          [REQ1 stream1][REQ2 stream2][REQ3 stream3]
          [RESP2 stream2][RESP1 stream1][RESP3 stream3]
          (multiplexed, responses can arrive out of order)
```

### HPACK Header Compression

HTTP/1.1 headers are text and repetitive (same `User-Agent`, `Accept` on every request). HTTP/2 uses **HPACK**: a static table of common headers + a dynamic table of recently used headers. Instead of sending `Content-Type: application/json`, send index 31 (2 bytes).

> 🌍 **Real-World:** Google's internal Stubby RPC framework (the predecessor to gRPC) used HPACK-equivalent header compression when multiplexing thousands of RPCs over a single connection between microservices — in a service with 1000 RPCs/sec where each RPC carries 500 bytes of headers, HPACK reduces header bandwidth by ~80%, which at Google's scale translates to significant network savings across data centres.

### Go's HTTP/2 Support

Go's `net/http` supports HTTP/2 automatically when using TLS:

```go
server := &http.Server{Addr: ":443", Handler: mux}
// HTTP/2 is negotiated via TLS ALPN (h2 protocol)
log.Fatal(server.ListenAndServeTLS("cert.pem", "key.pem"))
```

For HTTP/2 over cleartext (h2c), use `golang.org/x/net/http2/h2c`.

---

## 3.3 gRPC in Go

gRPC is Google's RPC framework. Uses HTTP/2 for transport and **Protocol Buffers** for serialization.

### Why Protobuf Over JSON

| Format | Characteristics |
|--------|----------------|
| JSON | Text-based; fields are strings; parsing is slow; no schema enforced at encoding |
| Protobuf | Binary; field numbers instead of names; varint encoding for integers; strict schema |

Result: **3–10x smaller messages**, **5–10x faster serialization**.

```text
JSON:    {"user_id": 12345, "name": "Alice"}   (34 bytes)
Protobuf: \x08\xb9`\x12\x05Alice              (~9 bytes)
           ^field1  ^12345 ^field2 ^"Alice"
```

> 🌍 **Real-World:** Google uses Protobuf for virtually all internal RPC between services — at Google Search's scale, switching a single query-serving pipeline from JSON to Protobuf reduced serialization CPU cost by ~60% and network payload by ~70%, which translates directly to lower query latency and fewer servers needed per data centre.

### Define a Service (proto file)

```protobuf
// user.proto
syntax = "proto3";
package user;
option go_package = "./userpb";

message GetUserRequest {
    int64 user_id = 1;
}

message GetUserResponse {
    int64  user_id = 1;
    string name    = 2;
    string email   = 3;
}

service UserService {
    // Unary RPC
    rpc GetUser(GetUserRequest) returns (GetUserResponse);
    // Server streaming
    rpc ListUsers(GetUserRequest) returns (stream GetUserResponse);
}
```

Generate with: `protoc --go_out=. --go-grpc_out=. user.proto`

### Full gRPC Server + Client

```go
// server/main.go
package main

import (
	"context"
	"fmt"
	"log"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	pb "myapp/userpb"
)

type userServer struct {
	pb.UnimplementedUserServiceServer
	// embed UnimplementedUserServiceServer for forward compatibility
	users map[int64]*pb.GetUserResponse
}

func (s *userServer) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.GetUserResponse, error) {
	if req.UserId <= 0 {
		return nil, status.Errorf(codes.InvalidArgument, "user_id must be positive")
	}
	user, ok := s.users[req.UserId]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "user %d not found", req.UserId)
	}
	return user, nil
}

func (s *userServer) ListUsers(req *pb.GetUserRequest, stream pb.UserService_ListUsersServer) error {
	for _, user := range s.users {
		if err := stream.Send(user); err != nil {
			return err
		}
		// Check if client cancelled
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		default:
		}
	}
	return nil
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	// Interceptor (middleware) for logging
	logInterceptor := func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler) (interface{}, error) {
		log.Printf("RPC: %s", info.FullMethod)
		resp, err := handler(ctx, req)
		if err != nil {
			log.Printf("RPC %s error: %v", info.FullMethod, err)
		}
		return resp, err
	}

	s := grpc.NewServer(grpc.UnaryInterceptor(logInterceptor))
	pb.RegisterUserServiceServer(s, &userServer{
		users: map[int64]*pb.GetUserResponse{
			1: {UserId: 1, Name: "Alice", Email: "alice@example.com"},
			2: {UserId: 2, Name: "Bob", Email: "bob@example.com"},
		},
	})

	fmt.Println("gRPC server listening on :50051")
	log.Fatal(s.Serve(lis))
}
```

```go
// client/main.go
package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	pb "myapp/userpb"
)

func main() {
	conn, err := grpc.Dial(":50051",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	client := pb.NewUserServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Unary call
	resp, err := client.GetUser(ctx, &pb.GetUserRequest{UserId: 1})
	if err != nil {
		log.Fatalf("GetUser: %v", err)
	}
	fmt.Printf("Got user: %+v\n", resp)

	// Streaming call
	stream, err := client.ListUsers(ctx, &pb.GetUserRequest{})
	if err != nil {
		log.Fatalf("ListUsers: %v", err)
	}
	for {
		user, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			log.Fatalf("stream recv: %v", err)
		}
		fmt.Printf("User: %+v\n", user)
	}
}
```

> 🌍 **Real-World:** Lyft migrated its core ride-dispatch service from Thrift to gRPC (Go server-side) — the HTTP/2 multiplexing meant a single connection between the dispatcher and driver-location service handles thousands of concurrent streaming RPCs, cutting connection establishment overhead by 10x versus the previous one-connection-per-stream Thrift model.

---

## 3.4 TCP vs UDP

### TCP (Transmission Control Protocol)

Connection-oriented, reliable, ordered, flow-controlled:

- **Three-way handshake** to establish connection:
  ```text
  Client                    Server
    │── SYN ──────────────────►│   (seq=x)
    │◄── SYN-ACK ──────────────│   (seq=y, ack=x+1)
    │── ACK ──────────────────►│   (ack=y+1)
    │         ESTABLISHED      │
  ```
- **Four-way teardown**:
  ```text
  Client                    Server
    │── FIN ──────────────────►│   (client done sending)
    │◄── ACK ──────────────────│
    │◄── FIN ──────────────────│   (server done sending)
    │── ACK ──────────────────►│
    │         CLOSED           │
  ```
- **Reliability**: sequence numbers, ACKs, retransmission.
- **Flow control**: receiver advertises window size; sender doesn't overflow.
- **Congestion control**: slow start, AIMD (Additive Increase Multiplicative Decrease).
- **Nagle's algorithm**: buffers small writes to send fewer packets. Disable with `TCP_NODELAY` for latency-sensitive apps.

> 🌍 **Real-World:** CockroachDB sets `TCP_NODELAY` on all inter-node connections — Raft consensus requires tiny heartbeat messages to be sent immediately without Nagle's 40 ms buffering delay; disabling Nagle cut CockroachDB's Raft round-trip time from ~50 ms to ~1 ms in their benchmark environments.

### UDP (User Datagram Protocol)

Connectionless, unreliable, unordered:
- No handshake, no ACKs, no retransmission.
- Lower latency (no connection setup, no head-of-line blocking).
- Used in: DNS (query/response, timeout retry at app layer), video streaming (better to drop a frame than delay), gaming, QUIC (HTTP/3 runs on UDP).

```go
// UDP server in Go
conn, err := net.ListenPacket("udp", ":5000")
if err != nil { log.Fatal(err) }
defer conn.Close()

buf := make([]byte, 1024)
for {
    n, addr, err := conn.ReadFrom(buf)
    if err != nil { continue }
    fmt.Printf("from %s: %s\n", addr, buf[:n])
    conn.WriteTo([]byte("pong"), addr)
}
```

> 🌍 **Real-World:** Cloudflare's DNS resolver (written in Go) processes billions of DNS queries per day over UDP — each query is a tiny (<512 byte) UDP datagram, and the Go UDP listener handles millions of concurrent queries using a small pool of goroutines reading from the same `net.PacketConn`, exploiting UDP's connectionless nature to avoid per-query connection overhead entirely.

### TCP vs UDP at a Glance

| Feature | TCP | UDP |
|---------|-----|-----|
| Connection | Connection-oriented (handshake) | Connectionless |
| Reliability | Guaranteed delivery + ordering | Best-effort, no ordering |
| Overhead | High (handshake, ACKs, retransmit) | Low |
| Latency | Higher | Lower |
| Use cases | HTTP, databases, file transfer | DNS, video streaming, gaming, QUIC |

---

## 3.5 Connection Pooling

### Why Pool Connections

Establishing a TCP connection involves:
1. TCP three-way handshake (~1 RTT).
2. TLS handshake (~1–2 RTT): certificate exchange, key agreement.

At 50 ms RTT, that's ~150 ms overhead before the first byte of data. Reusing connections eliminates this cost entirely.

### http.Transport Settings

```go
transport := &http.Transport{
    MaxIdleConns:        100,              // max idle connections across all hosts
    MaxIdleConnsPerHost: 10,               // max idle per host (default 2 — often too low!)
    MaxConnsPerHost:     0,               // 0 = unlimited; set to limit per-host connections
    IdleConnTimeout:     90 * time.Second, // close idle conn after this duration
    TLSHandshakeTimeout: 10 * time.Second,
    ExpectContinueTimeout: 1 * time.Second,
    DisableKeepAlives:   false,            // keep-alive enabled (default)
}
```

> **⚠️ Production Gotcha:** Default `MaxIdleConnsPerHost` is **2**. Under high load, if you make 100 concurrent requests to one host, 98 connections are created but only 2 are kept idle afterward — the rest are closed and rebuilt next time.

> 🌍 **Real-World:** A Datadog engineering post described a production incident where a Go microservice making 500 req/s to a single downstream host was creating and destroying ~500 TCP+TLS connections per second because `MaxIdleConnsPerHost` was left at the default 2 — bumping it to 50 eliminated the connection churn and cut p99 latency by 40 ms (the TLS handshake cost).

### Database Connection Pool (sql.DB)

```go
db, err := sql.Open("postgres", dsn)
if err != nil { log.Fatal(err) }

// Pool settings
db.SetMaxOpenConns(25)              // max simultaneous connections
db.SetMaxIdleConns(10)              // max idle connections in pool
db.SetConnMaxLifetime(5 * time.Minute)  // max time a connection is reused
db.SetConnMaxIdleTime(1 * time.Minute)  // max time a connection can be idle

// sql.DB is safe for concurrent use; it manages the pool internally
rows, err := db.QueryContext(ctx, "SELECT id, name FROM users WHERE id = $1", userID)
```

> **💡 Key Insight:** `sql.Open` doesn't connect — `db.Ping()` or the first query does. `SetMaxOpenConns` prevents connection exhaustion on the DB side.

> 🌍 **Real-World:** PlanetScale's Go services use `db.SetMaxOpenConns` tuned to exactly the `max_connections` limit of their MySQL-compatible backend divided by the number of service replicas — without this cap, a traffic spike causes every goroutine to open its own DB connection, exhausting MySQL's connection limit and causing a total outage rather than graceful degradation.

---

# 4. Performance Engineering

## 4.1 pprof

Go's built-in profiling tool. Profiles are samples taken at runtime.

### Adding pprof to HTTP Server

```go
import (
    "net/http"
    _ "net/http/pprof"  // registers pprof handlers on http.DefaultServeMux
)

func main() {
    // In a separate goroutine, serve pprof on a different port
    go func() {
        log.Println(http.ListenAndServe("localhost:6060", nil))
    }()
    // ... main server
}
```

Endpoints:
- `GET /debug/pprof/` — index
- `GET /debug/pprof/goroutine` — goroutine stack traces
- `GET /debug/pprof/heap` — heap allocations
- `GET /debug/pprof/profile?seconds=30` — 30-second CPU profile

### CPU Profiling

```bash
# Collect 30s CPU profile and open in browser (flame graph):
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/profile?seconds=30

# In interactive mode:
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
(pprof) top10          # top 10 functions by CPU
(pprof) list funcName  # annotated source for funcName
(pprof) web            # open flame graph in browser
```

CPU profiler samples goroutine stacks at **100 Hz** (every 10 ms). Functions that appear frequently are CPU bottlenecks.

> 🌍 **Real-World:** Cloudflare engineers run pprof against their live reverse proxy processes in production to identify CPU hotspots — a pprof flame graph revealed that `regexp.Compile` was being called on every request in a WAF rule evaluator; caching the compiled regexp reduced CPU by 15% with a one-line change.

### Memory Profiling

```bash
# Heap profile (allocations):
go tool pprof http://localhost:6060/debug/pprof/heap

(pprof) top10 -cum    # by cumulative allocation
(pprof) list funcName # show allocations in function

# Show allocation count vs bytes:
(pprof) top -inuse_objects  # live objects
(pprof) top -alloc_space    # total bytes allocated (includes GC'd)
```

### Goroutine Profile

```bash
go tool pprof http://localhost:6060/debug/pprof/goroutine
(pprof) top   # which goroutines are stuck and where
```

### In-Code Profiling

```go
import (
    "os"
    "runtime/pprof"
)

func main() {
    // CPU profile to file
    f, _ := os.Create("cpu.prof")
    pprof.StartCPUProfile(f)
    defer pprof.StopCPUProfile()

    // ... run workload

    // Heap profile to file
    mf, _ := os.Create("mem.prof")
    pprof.WriteHeapProfile(mf)
    mf.Close()
}

// Then analyze:
// go tool pprof cpu.prof
// go tool pprof mem.prof
```

---

## 4.2 Benchmarking

```go
// bench_test.go
package mypackage

import (
    "strings"
    "testing"
)

func BenchmarkStringConcat(b *testing.B) {
    // b.N is set by the testing framework — increases until stable result
    for i := 0; i < b.N; i++ {
        s := ""
        for j := 0; j < 100; j++ {
            s += "x"  // bad: O(n²) allocations
        }
        _ = s
    }
}

func BenchmarkStringBuilder(b *testing.B) {
    for i := 0; i < b.N; i++ {
        var sb strings.Builder
        for j := 0; j < 100; j++ {
            sb.WriteString("x")
        }
        _ = sb.String()
    }
}
```

```bash
go test -bench=. -benchmem -count=3 ./...

# Output:
# BenchmarkStringConcat-8    200,000    8,543 ns/op    5,360 B/op    99 allocs/op
# BenchmarkStringBuilder-8  2,000,000     612 ns/op      224 B/op     3 allocs/op
```

`-benchmem`: shows bytes/op and allocs/op (crucial for finding allocations).
`-count=3`: run 3 times for stability.
`-cpuprofile=cpu.prof`: generate CPU profile during benchmark.

> 🌍 **Real-World:** The Go team at Google runs benchmarks with `-benchmem -count=10` for every change to the standard library's `encoding/json` package — the `-benchmem` output (allocs/op) is the primary signal they optimize against, since reducing allocations in JSON parsing directly lowers GC pressure for every Go service using the standard library.

### Timer Controls

```go
func BenchmarkWithSetup(b *testing.B) {
    // Setup (not timed)
    data := generateTestData(1000)

    b.ResetTimer()  // reset timer after setup
    for i := 0; i < b.N; i++ {
        b.StopTimer()   // pause timer for per-iteration setup
        input := data[i%len(data)]
        b.StartTimer()  // resume timer
        process(input)
    }
}
```

### Avoiding Compiler Optimizations

The compiler can optimize away benchmark code if results are unused:

```go
var result int  // package-level sink

func BenchmarkCompute(b *testing.B) {
    var r int
    for i := 0; i < b.N; i++ {
        r = compute(i)  // use result
    }
    result = r  // assign to global to prevent optimization
}
```

---

## 4.3 Common Performance Patterns

### Avoid Allocations in Hot Paths

```go
// BAD: allocates a new string on every request
func getKey(userID int) string {
    return fmt.Sprintf("user:%d", userID)
}

// BETTER: use strconv to build into a pre-allocated buffer
func getKey(userID int) string {
    var buf [32]byte  // stack-allocated array
    b := strconv.AppendInt(buf[:0], int64(userID), 10)
    // prepend "user:"
    result := make([]byte, 0, 5+len(b))
    result = append(result, "user:"...)
    result = append(result, b...)
    return string(result)
}
```

> 🌍 **Real-World:** The `pgx` PostgreSQL driver (used widely in production Go services) avoids `fmt.Sprintf` for query logging in its hot path — it uses `strconv.AppendInt` and pre-allocated byte slices to format query parameters, keeping the allocation count at zero for prepared statement execution so that pgx adds no measurable GC overhead per database query.

### strings.Builder vs + Operator

`+` on strings creates a new string each time (strings are immutable in Go). In a loop over N strings, that's **O(N²)** copying.

`strings.Builder` maintains a `[]byte` buffer and doubles capacity as needed: **O(N)** total.

```go
// O(N²) — bad for large N
func joinBad(parts []string) string {
    result := ""
    for _, p := range parts {
        result += p
    }
    return result
}

// O(N) — good
func joinGood(parts []string) string {
    var sb strings.Builder
    sb.Grow(estimatedSize(parts))  // pre-allocate if size is known
    for _, p := range parts {
        sb.WriteString(p)
    }
    return sb.String()
}
```

### JSON Performance

`encoding/json` uses reflection (slow). For hot paths:

```go
// Standard (reflection-based, allocates):
data, err := json.Marshal(user)

// json.Encoder reuses Writer (avoids one allocation):
enc := json.NewEncoder(w)
enc.Encode(user)

// For high-performance: use code generation
// github.com/bytedance/sonic — uses JIT, 5-10x faster
// github.com/mailru/easyjson — generates type-specific marshal/unmarshal
```

> 🌍 **Real-World:** ByteDance replaced `encoding/json` with their `sonic` library (which JIT-compiles JSON marshallers using Go's `reflect` and assembly) across their Go microservices — internal benchmarks showed 5–10x faster JSON serialization, and the reduction in CPU time was directly translated to cost savings at their scale of billions of API calls per day.

### Buffered I/O

```go
// BAD: each Write/Read is a syscall
file, _ := os.Open("large.txt")
buf := make([]byte, 1)
for {
    n, err := file.Read(buf)  // syscall every byte!
    if err == io.EOF { break }
    process(buf[:n])
}

// GOOD: bufio batches reads into large chunks
reader := bufio.NewReaderSize(file, 65536)  // 64 KB buffer
scanner := bufio.NewScanner(reader)
for scanner.Scan() {
    process(scanner.Bytes())
}

// GOOD: bufio.Writer batches writes
writer := bufio.NewWriterSize(file, 65536)
defer writer.Flush()  // must flush at end!
writer.WriteString("line\n")
```

> 🌍 **Real-World:** InfluxDB's Go-based write-ahead log wraps its file writer in `bufio.NewWriterSize` with a 1 MB buffer — individual metric writes are tiny (tens of bytes), and without buffering each would be a separate `write(2)` syscall; the 1 MB buffer coalesces thousands of writes into a single syscall, reducing syscall overhead from ~30% of CPU to under 1%.

---

# 5. Production Topics

## 5.1 Graceful Shutdown

When a process receives SIGTERM (from Kubernetes, systemd, etc.), it must:
1. Stop accepting new requests.
2. Let in-flight requests complete.
3. Close resources (DB connections, etc.).
4. Exit.

```go
package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		// Simulate slow request
		select {
		case <-time.After(5 * time.Second):
			fmt.Fprintln(w, "done")
		case <-r.Context().Done():
			// Client disconnected or server shutting down
			http.Error(w, "cancelled", http.StatusServiceUnavailable)
		}
	})

	server := &http.Server{
		Addr:         ":8080",
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Start server in goroutine
	serverErr := make(chan error, 1)
	go func() {
		log.Println("Server starting on :8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// Wait for signal or error
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("Server error: %v", err)
	case sig := <-quit:
		log.Printf("Received signal %v, shutting down...", sig)
	}

	// Graceful shutdown: give in-flight requests 30s to finish
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}

	// Close other resources here (DB, Redis, message queue consumers)
	// db.Close()
	// redisClient.Close()

	log.Println("Server exited gracefully")
}
```

> **💡 Key Insight:** `http.Server.Shutdown(ctx)` stops accepting new connections, waits for active requests to finish, and closes idle connections. If ctx expires, returns an error but still closes (force-stop).

> 🌍 **Real-World:** Every Go service deployed on Kubernetes at Shopify implements graceful shutdown via `server.Shutdown(ctx)` with a 30-second timeout — Kubernetes sends SIGTERM and waits `terminationGracePeriodSeconds` (set to 35s) before force-killing the pod; the extra 5 seconds ensures the in-flight request drain completes before the pod is removed from the load balancer's endpoint list.

---

## 5.2 Circuit Breaker

Prevents cascading failures. When downstream service is failing, the **circuit breaker** short-circuits calls instead of repeatedly failing and consuming resources.

**States:**

| State | Behavior |
|-------|----------|
| **Closed** | Normal operation, requests pass through. Track failure rate. |
| **Open** | Circuit tripped. Requests fail immediately (fast fail). After timeout, probe. |
| **Half-Open** | Allow one probe request. If success, close; if fail, re-open. |

```go
package main

import (
	"errors"
	"fmt"
	"sync"
	"time"
)

type State int

const (
	StateClosed   State = iota // normal
	StateOpen                  // failing fast
	StateHalfOpen              // probing
)

func (s State) String() string {
	switch s {
	case StateClosed:
		return "CLOSED"
	case StateOpen:
		return "OPEN"
	case StateHalfOpen:
		return "HALF_OPEN"
	}
	return "UNKNOWN"
}

var ErrCircuitOpen = errors.New("circuit breaker is open")

type CircuitBreaker struct {
	mu               sync.Mutex
	state            State
	failureCount     int
	successCount     int
	failureThreshold int     // trips to OPEN after this many failures
	successThreshold int     // closes from HALF_OPEN after this many successes
	timeout          time.Duration // OPEN → HALF_OPEN after this duration
	lastFailureTime  time.Time
}

func NewCircuitBreaker(failureThreshold, successThreshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:            StateClosed,
		failureThreshold: failureThreshold,
		successThreshold: successThreshold,
		timeout:          timeout,
	}
}

func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		// Check if timeout expired — transition to half-open
		if time.Since(cb.lastFailureTime) >= cb.timeout {
			cb.state = StateHalfOpen
			cb.successCount = 0
			fmt.Printf("[CB] → HALF_OPEN (probing)\n")
			return true
		}
		return false
	case StateHalfOpen:
		// Only allow one probe at a time (simplification: allow all for now)
		return true
	}
	return false
}

func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount = 0
	if cb.state == StateHalfOpen {
		cb.successCount++
		if cb.successCount >= cb.successThreshold {
			cb.state = StateClosed
			fmt.Printf("[CB] → CLOSED (recovered)\n")
		}
	}
}

func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.lastFailureTime = time.Now()
	cb.failureCount++

	if cb.state == StateHalfOpen || cb.failureCount >= cb.failureThreshold {
		cb.state = StateOpen
		fmt.Printf("[CB] → OPEN (failures: %d)\n", cb.failureCount)
	}
}

// Execute runs fn through the circuit breaker.
func (cb *CircuitBreaker) Execute(fn func() error) error {
	if !cb.Allow() {
		return ErrCircuitOpen
	}
	err := fn()
	if err != nil {
		cb.RecordFailure()
		return err
	}
	cb.RecordSuccess()
	return nil
}

func main() {
	cb := NewCircuitBreaker(3, 2, 5*time.Second)

	callDownstream := func() error {
		// Simulate failures
		return errors.New("service unavailable")
	}

	// Trigger 3 failures → circuit opens
	for i := 0; i < 5; i++ {
		err := cb.Execute(callDownstream)
		fmt.Printf("call %d: %v (state: %s)\n", i+1, err, cb.state)
	}

	// Wait for timeout
	time.Sleep(6 * time.Second)

	// Probe succeeds → circuit closes
	callGood := func() error { return nil }
	for i := 0; i < 3; i++ {
		err := cb.Execute(callGood)
		fmt.Printf("probe %d: %v (state: %s)\n", i+1, err, cb.state)
	}
}
```

> 🌍 **Real-World:** Netflix's Hystrix (the circuit breaker library that inspired most Go implementations) was originally built after a production incident where a single slow downstream service caused thread pool exhaustion in dozens of dependent services — the circuit breaker pattern broke the cascade by failing fast after a threshold of errors, saving Netflix's entire streaming stack from a full outage. Go services at Netflix now use a Go port of this pattern in their microservice framework.

---

## 5.3 Retry with Exponential Backoff

Retry transient failures. **Exponential backoff** prevents thundering herd (all clients retrying simultaneously).

```go
package main

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"time"
)

// RetryConfig configures retry behavior.
type RetryConfig struct {
	MaxAttempts     int
	InitialInterval time.Duration
	MaxInterval     time.Duration
	Multiplier      float64 // backoff multiplier (e.g., 2.0 = double each time)
	JitterFactor    float64 // randomness factor (0.0-1.0)
}

var DefaultRetryConfig = RetryConfig{
	MaxAttempts:     5,
	InitialInterval: 100 * time.Millisecond,
	MaxInterval:     30 * time.Second,
	Multiplier:      2.0,
	JitterFactor:    0.3, // ±30% jitter
}

// IsRetryable determines if an error should be retried.
// Caller defines this based on error type.
type IsRetryable func(error) bool

// Retry executes fn with exponential backoff.
func Retry(ctx context.Context, cfg RetryConfig, isRetryable IsRetryable, fn func() error) error {
	var lastErr error
	interval := cfg.InitialInterval

	for attempt := 1; attempt <= cfg.MaxAttempts; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil // success
		}

		if !isRetryable(lastErr) {
			return fmt.Errorf("non-retryable error on attempt %d: %w", attempt, lastErr)
		}

		if attempt == cfg.MaxAttempts {
			break // don't sleep after last attempt
		}

		// Calculate jittered backoff
		jitter := 1.0 + cfg.JitterFactor*(rand.Float64()*2-1) // [1-jitter, 1+jitter]
		sleep := time.Duration(float64(interval) * jitter)
		if sleep > cfg.MaxInterval {
			sleep = cfg.MaxInterval
		}

		fmt.Printf("attempt %d failed: %v, retrying in %v\n", attempt, lastErr, sleep.Round(time.Millisecond))

		select {
		case <-ctx.Done():
			return fmt.Errorf("context cancelled after %d attempts: %w", attempt, ctx.Err())
		case <-time.After(sleep):
		}

		// Increase interval
		interval = time.Duration(float64(interval) * cfg.Multiplier)
		if interval > cfg.MaxInterval {
			interval = cfg.MaxInterval
		}
	}

	return fmt.Errorf("all %d attempts failed, last error: %w", cfg.MaxAttempts, lastErr)
}

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	attempt := 0
	callService := func() error {
		attempt++
		if attempt < 4 {
			return errors.New("connection refused") // transient
		}
		fmt.Println("success!")
		return nil
	}

	isRetryable := func(err error) bool {
		// In production: check for specific error types (net.Error, etc.)
		return err != nil && err.Error() == "connection refused"
	}

	err := Retry(ctx, DefaultRetryConfig, isRetryable, callService)
	if err != nil {
		fmt.Printf("failed: %v\n", err)
	}
}
```

Backoff pattern (with Multiplier=2, InitialInterval=100 ms):
```text
attempt 1: fail → sleep ~100 ms
attempt 2: fail → sleep ~200 ms
attempt 3: fail → sleep ~400 ms
attempt 4: success
```

> **💡 Key Insight:** Jitter prevents synchronized retries from multiple clients hammering the same service simultaneously.

> 🌍 **Real-World:** AWS's SDK for Go (v2) implements exponential backoff with full jitter for all API retries — the AWS engineering blog documented that during a DynamoDB partial outage, services using full jitter retries recovered 3x faster than services using deterministic backoff because the jitter spread out the retry storm across the recovery window instead of creating a synchronized thundering herd every 2 seconds.

---

## 5.4 Structured Logging

`fmt.Println` for logging is wrong in production: unstructured text is hard to query in log aggregators (Elasticsearch, Splunk, Datadog).

**Structured logging** emits JSON (or key=value) so logs are machine-parseable.

### log/slog (Go 1.21+)

```go
package main

import (
	"context"
	"log/slog"
	"os"
	"time"
)

func main() {
	// JSON handler for production
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
		// Add source file/line to every log entry:
		AddSource: true,
	}))

	// Set as default logger
	slog.SetDefault(logger)

	// Basic logging
	slog.Info("server starting", "port", 8080, "env", "production")
	// Output: {"time":"...","level":"INFO","msg":"server starting","port":8080,"env":"production"}

	slog.Error("database error", "error", "connection refused", "retry_in_ms", 500)

	// With context (for trace propagation)
	ctx := context.Background()
	slog.InfoContext(ctx, "request received", "method", "GET", "path", "/users/1")

	// Group related attributes
	slog.Info("request complete",
		slog.Group("request",
			slog.String("method", "POST"),
			slog.String("path", "/users"),
			slog.Int("status", 201),
			slog.Duration("latency", 23*time.Millisecond),
		),
		slog.Group("user",
			slog.Int64("id", 12345),
		),
	)

	// With a logger that has persistent fields (e.g., service name)
	serviceLogger := logger.With(
		slog.String("service", "user-svc"),
		slog.String("version", "1.2.3"),
	)
	serviceLogger.Info("user created", "user_id", 99)
}
```

> 🌍 **Real-World:** Uber's Go services standardised on `zap` (structured JSON logging) before `log/slog` existed — at Uber's scale of millions of log lines per second, structured JSON logs are ingested directly into their Elasticsearch clusters where engineers use Kibana field filters (`service.name`, `trace_id`, `error.type`) to debug production incidents in seconds rather than `grep`-ing through unstructured text.

### Log Levels

| Level | When to use |
|-------|------------|
| `Debug` | Verbose diagnostic. Disabled in production. |
| `Info` | Normal events (server started, request processed). |
| `Warn` | Unexpected but recoverable (slow query, retry). |
| `Error` | Failures that may need attention. |

> **⚠️ Production Gotcha:** Never log passwords, PII, or secrets.

### Context Propagation for Trace IDs

```go
type loggerKey struct{}

func WithLogger(ctx context.Context, l *slog.Logger) context.Context {
	return context.WithValue(ctx, loggerKey{}, l)
}

func LoggerFromContext(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}

// In HTTP middleware:
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := r.Header.Get("X-Trace-ID")
		if traceID == "" {
			traceID = generateTraceID()
		}
		logger := slog.Default().With("trace_id", traceID)
		ctx := WithLogger(r.Context(), logger)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

> 🌍 **Real-World:** Datadog's Go tracing library automatically injects `dd.trace_id` and `dd.span_id` into the logger stored in `context.Context` — every log line emitted anywhere in a request's call stack carries the trace ID, allowing engineers to jump from a log line in Datadog Logs directly to the corresponding distributed trace in Datadog APM with one click.

---

## 5.5 HTTP Middleware Pattern

**Middleware** wraps an `http.Handler` to add cross-cutting concerns: logging, auth, rate limiting, tracing.

```go
package main

import (
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

// Middleware is a function that wraps an http.Handler.
type Middleware func(http.Handler) http.Handler

// Chain applies middlewares in order: first is outermost.
// Chain(A, B, C)(handler) → A(B(C(handler)))
func Chain(middlewares ...Middleware) Middleware {
	return func(final http.Handler) http.Handler {
		// Apply in reverse order so first middleware is outermost
		for i := len(middlewares) - 1; i >= 0; i-- {
			final = middlewares[i](final)
		}
		return final
	}
}

// LoggingMiddleware logs method, path, status, and duration.
func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Wrap ResponseWriter to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(rw, r)

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rw.statusCode,
			"duration_ms", time.Since(start).Milliseconds(),
			"remote_addr", r.RemoteAddr,
		)
	})
}

// RecoveryMiddleware catches panics and returns 500.
func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				slog.Error("panic recovered", "error", fmt.Sprintf("%v", err))
				http.Error(w, "internal server error", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// AuthMiddleware checks Authorization header.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.Header.Get("Authorization")
		if token == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		// Validate token here...
		next.ServeHTTP(w, r)
	})
}

// responseWriter wraps http.ResponseWriter to capture status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("/public", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "public endpoint")
	})

	mux.HandleFunc("/private", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintln(w, "private endpoint")
	})

	// Apply middleware chain:
	// Request flow: Recovery → Logging → Auth → Handler
	publicChain := Chain(RecoveryMiddleware, LoggingMiddleware)
	privateChain := Chain(RecoveryMiddleware, LoggingMiddleware, AuthMiddleware)

	finalMux := http.NewServeMux()
	finalMux.Handle("/public", publicChain(mux))
	finalMux.Handle("/private", privateChain(mux))

	server := &http.Server{
		Addr:         ":8080",
		Handler:      finalMux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	slog.Info("starting server", "addr", ":8080")
	if err := server.ListenAndServe(); err != nil {
		slog.Error("server error", "error", err)
	}
}
```

> 🌍 **Real-World:** The `chi` router (used in production at Square, Segment, and others) is built entirely around this `func(http.Handler) http.Handler` middleware pattern — its `Use()` method chains middlewares in this exact form, allowing teams to compose logging, authentication, rate limiting, and tracing as independent, testable units without any framework lock-in.

---

# Quick Reference

## GMP — Key Numbers

| Parameter | Value |
|-----------|-------|
| Default GOMAXPROCS | Number of CPU cores |
| Goroutine initial stack | 2 KB (max 1 GB) |
| LRQ capacity | 256 goroutines |
| GC STW pauses | Typically < 1 ms |
| Default GOGC | 100 (trigger when heap doubles) |

## Channel Operations — At a Glance

| | nil channel | closed channel | open, empty | open, full |
|--|-------------|---------------|-------------|------------|
| **send** | blocks forever | panic | blocks | blocks (unbuf) / enqueue (buf) |
| **receive** | blocks forever | zero, false | blocks | dequeue |
| **close** | panic | panic | ok | ok |

## Context Rules

1. Pass as first arg: `func f(ctx context.Context, ...)`
2. Always `defer cancel()` after `WithCancel`/`WithTimeout`/`WithDeadline`
3. Never store in struct field
4. Use typed key for `WithValue`

## Common pprof Commands

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30  # CPU
go tool pprof http://localhost:6060/debug/pprof/heap                # Memory
go tool pprof http://localhost:6060/debug/pprof/goroutine           # Goroutines
# Inside pprof:
(pprof) top10
(pprof) list mypackage.MyFunction
(pprof) web   # flame graph
```

## Race Detector

```bash
go test -race ./...
go run -race main.go
go build -race -o myapp .
```

## Benchmark Flags

```bash
go test -bench=BenchmarkName -benchmem -count=5 -cpuprofile=cpu.prof ./...
```

---

## Real-World Go Usage (Where Go runs in production)

```text
Cloudflare:
  Reverse proxy for 26M+ requests/second
  Uses goroutines to handle millions of concurrent connections with < 4 GB RAM
  Key feature: Go's goroutine scheduler handles 1M+ concurrent conns vs Java's thread-per-conn
  Built: Workers (serverless), DNS resolver, bot detection

Uber:
  Core dispatch and matching services written in Go (migrated from Node.js)
  Why: better concurrency primitives, lower memory per goroutine vs Java threads
  Uses: Go's sync.Map and atomic operations for high-throughput driver state

Docker:
  Written entirely in Go
  Why: single static binary (no dependencies), cross-compile for Linux from any OS
  goroutines for managing container lifecycle concurrently

Kubernetes:
  Entire control plane in Go (kube-apiserver, kubelet, controller-manager)
  Why: low memory overhead, fast startup, native Linux tooling (syscalls, cgroups)
  Context package used extensively for request cancellation across distributed calls

HashiCorp (Consul, Vault, Terraform):
  Go for all tools — single binary, easy distribution
  Vault uses goroutines for concurrent key-sealing/unsealing operations

Dropbox:
  Performance-critical services rewritten from Python to Go
  Why: 10x reduction in CPU usage, lower latency for file sync

CockroachDB:
  Distributed SQL database written in Go
  Why: goroutines for concurrent Raft consensus across thousands of ranges

Go Performance Characteristics vs Java vs Python:
  Go startup:      ~5 ms   | Java startup: 500 ms–2 s  | Python startup: 100 ms
  Go goroutine:    2 KB initial stack | Java thread: 1 MB default stack
  Go 1,000 goroutines: ~2 MB RAM  | Java 1,000 threads: 1 GB RAM
  Go GC pause:     0.1–1 ms       | Java G1GC pause: 10–200 ms | Java ZGC: <1 ms

  → Go ideal for: network services, CLIs, DevOps tooling, high-concurrency APIs
  → Java ideal for: large codebases, rich ecosystems, ML/analytics (JVM JIT is excellent)

Go Features Companies Use Most:
  net/http:        built-in HTTP server handles millions of connections with goroutines
  context:         cancellation + timeout propagation across all async calls (MANDATORY in prod)
  sync.WaitGroup:  coordinate parallel work (fan-out/fan-in for bulk operations)
  chan:             pipeline processing (streaming data transformation between stages)
  go-redis, pgx:   idiomatic database clients with connection pooling built in
  pprof:           production profiling without stopping the server (Cloudflare uses in prod)
```


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Go Runtime / Concurrency / Prod)

| # | Concept | Why FAANG asks | Done |
|---|---------|----------------|------|
| 1 | Goroutine vs OS thread; GMP scheduler | Runtime depth | [ ] |
| 2 | Channel semantics (buffered/unbuffered/select) | Correct concurrency design | [ ] |
| 3 | Context cancellation propagation | Production request lifecycles | [ ] |
| 4 | Escape analysis (stack vs heap) | Perf reasoning | [ ] |
| 5 | Go GC (tri-color, write barriers) | Compare to JVM | [ ] |
| 6 | sync.Mutex / RWMutex / WaitGroup / Once | Correctness primitives | [ ] |
| 7 | Memory allocator size classes / mcache | Allocation hot paths | [ ] |
| 8 | net/http Server + Transport timeouts | Production HTTP | [ ] |
| 9 | pprof CPU/heap/goroutine profiles | Debug live services | [ ] |
| 10 | Graceful shutdown + middleware recover | On-call readiness | [ ] |
| 11 | Prefer channels for ownership; mutexes for shared state | Design judgment | [ ] |
| 12 | Language checklist in Deep-Track §21 | Types/interfaces/errors | [ ] |

> ⭐ **IMPORTANT CONCEPT:** "Don't communicate by sharing memory; share memory by communicating" — but know when a mutex is simpler and correct.

---

## 🛠️ PRACTICAL — Go Labs (Runtime / Concurrency)

### Lab 1: Race Detector
```bash
# Write a program with a data race on a map, then fix it.
go test -race ./...
```

### Lab 2: Worker Pool
Implement a bounded worker pool with `context.Context` cancellation:
- N workers
- Job channel
- Results channel
- Graceful shutdown on cancel

### Lab 3: Explain GMP in 2 Minutes
Record yourself explaining G, M, P, work stealing, and what happens on a syscall.

### Lab 4: Leak Hunt
Create a goroutine leak (blocked on channel). Show how `pprof` goroutine profile reveals it.

### Lab 5: Escape Analysis
```bash
go build -gcflags="-m -m" ./...
```
Write a function that accidentally escapes a large buffer; fix it to stay on stack / reuse via `sync.Pool`.

### Lab 6: pprof Under Load
Run the HTTP server from §5; `hey` or `ab` load it; capture CPU + heap profiles; name the top 3 functions.

> Full language labs + LRU/rate-limiter drills: **`GoLang-Deep-Track.md` §20**.
