# Concurrency — Complete Study Notes

> **Self-contained. No internet needed.**
> Covers: Primitives → Atomics → Go Patterns → Memory Model → Deadlock → Concurrent Data Structures

---

## Table of Contents

| # | Topic |
|---|-------|
| 1 | [Basics — Concurrency vs Parallelism](#1-basics) |
| 2 | [Synchronization Primitives](#2-synchronization-primitives) |
| 3 | [Atomic Operations](#3-atomic-operations) |
| 4 | [Go Concurrency Patterns](#4-go-concurrency-patterns) |
| 5 | [Memory Model and Hardware](#5-memory-model-and-hardware) |
| 6 | [Deadlock, Livelock, Starvation](#6-deadlock-livelock-starvation) |
| 7 | [Concurrent Data Structures](#7-concurrent-data-structures) |
| 8 | [Java vs Go Concurrency Comparison](#8-java-vs-go-concurrency--interview-comparison) |
| 9 | [Interview Coding Drills](#9-interview-coding-drills) |
| 10 | [Common Interview Q&A](#10-common-concurrency-interview-questions-with-answers) |
| 11 | [Practical Labs](#11-practical-labs) |
| 12 | [Important Concepts Checklist](#12-important-concepts-checklist) |

---

## 1. Basics

> ⭐ **IMPORTANT CONCEPT:** Concurrency bugs come from shared mutable state without synchronization — eliminate sharing or synchronize every access path.

### Concurrency vs Parallelism

| | Concurrency | Parallelism |
|--|-------------|-------------|
| Definition | Multiple tasks making progress, not necessarily at the same time | Multiple tasks executing simultaneously |
| Requires | Time-slicing (1 core is enough) | Multiple cores |
| About | **Structure** of the program | **Execution** of the program |

> **💡 Go's mantra:** "Don't communicate by sharing memory; share memory by communicating."

### Why Concurrency Is Hard

- **Non-determinism**: execution order depends on the OS scheduler, not your code
- **Shared mutable state**: two threads reading and writing the same variable without sync = undefined behavior
- **Partial failures**: one goroutine can panic while others continue

### Race Condition

> ⭐ **IMPORTANT CONCEPT:** A race exists whenever two goroutines/threads access shared mutable state and at least one writes — without a happens-before edge. `count++` is three ops (read → add → write); the race window is between any two of those.

```go
// balance = 1000
// Thread A reads 1000, Thread B reads 1000
// A writes 1100, B writes 1100  → balance = 1100 (lost update!)

// count++ is NOT atomic: it's read → increment → write (3 ops)
// Race window exists between any two
```

> 🌍 **Real-World:** The 2003 Northeast blackout was partly caused by a race condition in the alarm monitoring software — a software bug allowed a race between the alarm suppression and display threads, causing system operators to not be alerted to a critical power line sag until it was too late. At the software level, a famous race condition affected the Therac-25 radiation therapy machine: a concurrent access bug in its control software caused it to deliver lethal doses of radiation to patients when commands were entered quickly, demonstrating that race conditions in safety-critical systems can be fatal.

---

## 2. Synchronization Primitives

### Mutex
```go
var mu      sync.Mutex
var balance int

func Deposit(amount int) {
    mu.Lock()
    defer mu.Unlock() // ALWAYS defer — prevents forgetting on every return path
    balance += amount
}
```

> ⭐ **IMPORTANT CONCEPT:** Mutex gotchas that fail interviews and prod: (1) Go's `sync.Mutex` is **NOT reentrant** — double `Lock()` from the same goroutine deadlocks; (2) never hold a mutex across I/O (DB/HTTP) — you serialize all waiters behind network latency; (3) unlock on every return path (`defer Unlock()`).

> **⚠️ Production gotcha:** Go's `sync.Mutex` is **NOT reentrant**. Calling `Lock()` twice from the same goroutine → deadlock.
> Holding a mutex during I/O (DB call, HTTP) blocks all goroutines waiting for that lock.

> 🌍 **Real-World:** Java's `synchronized` keyword uses a per-object mutex (monitor lock) — the JVM's object header stores lock state. When a Servlet handles concurrent HTTP requests, `synchronized` on a shared `HashMap` serializes all requests through the lock, creating a throughput bottleneck. Instagram discovered this in their early Python backend: a `threading.Lock` protecting their user session cache was held during a Redis call (I/O), causing all other threads to queue behind it during cache misses, limiting throughput to ~50 req/s on a 32-core server that should have handled 10,000 req/s.

### RWMutex
```go
var rwmu   sync.RWMutex
var config = map[string]string{}

func ReadConfig(key string) string {
    rwmu.RLock()          // multiple readers allowed simultaneously
    defer rwmu.RUnlock()
    return config[key]
}

func WriteConfig(key, value string) {
    rwmu.Lock()           // exclusive — blocks all readers AND writers
    defer rwmu.Unlock()
    config[key] = value
}
```

Use when reads are far more frequent than writes (config, routing tables, lookup caches).

> **💡** One pending `Lock()` blocks new `RLock()` calls to prevent writer starvation.

> 🌍 **Real-World:** Nginx uses a similar reader-writer lock pattern for its configuration hot-reload — hundreds of worker processes are continuously reading the routing configuration (shared read lock), and when an operator runs `nginx -s reload`, a single write lock is briefly acquired to swap in the new configuration. Without RWMutex semantics, each configuration reload would block all in-flight requests; with it, only the brief write-lock acquisition (microseconds) causes any delay.

### sync.WaitGroup
```go
var wg sync.WaitGroup

for i := 0; i < 10; i++ {
    wg.Add(1) // MUST call Add BEFORE spawning goroutine
    go func(n int) {
        defer wg.Done()
        process(n)
    }(i)
}
wg.Wait() // blocks until counter reaches 0
```

> ⭐ **IMPORTANT CONCEPT:** WaitGroup rule: `Add` **before** `go`. `Add` inside the goroutine races with `Wait` — `Wait` can see counter 0 and return before any worker starts.

> **⚠️ Common mistake:** `wg.Add(1)` inside the goroutine body creates a race between `Add` and `Wait`.

> 🌍 **Real-World:** Go's `sync.WaitGroup` is used extensively in parallel data pipeline stages — Cloudflare's Go-based DNS resolver uses WaitGroup to fan out DNS queries to multiple upstream resolvers in parallel and wait for the first successful response (plus cancellation of the remaining), reducing query latency from sequential 100ms+ to parallel 20–30ms.

### sync.Once
```go
var (
    dbOnce sync.Once
    db     *sql.DB
)

func GetDB() *sql.DB {
    dbOnce.Do(func() {
        // Runs exactly once even with 1,000 concurrent callers
        // All other callers block until this completes
        db, _ = sql.Open("postgres", dsn)
    })
    return db
}
```

> 🌍 **Real-World:** Go's `sync.Once` is the standard implementation of the singleton pattern in concurrent code — Docker's daemon uses `sync.Once` to initialize its container registry exactly once regardless of how many goroutines call it concurrently at startup. The double-checked locking pattern (common in Java) is notoriously error-prone due to memory reordering; `sync.Once` provides the same guarantee with correct memory barrier semantics built in.

### sync.Pool
```go
var bufPool = sync.Pool{
    New: func() interface{} {
        return new(bytes.Buffer)
    },
}

func Handler(w http.ResponseWriter, r *http.Request) {
    buf := bufPool.Get().(*bytes.Buffer)
    buf.Reset()
    defer bufPool.Put(buf) // return to pool instead of GC

    buf.WriteString("response body")
    w.Write(buf.Bytes())
}
```

> **💡** Reduces GC pressure in hot paths (HTTP handlers, parsers, encoders).
> Objects **may be GC'd** between `Get` calls — pool is a free list, not a cache.
> Per-P (processor) pooling means no lock contention when allocating.

> 🌍 **Real-World:** The Go standard library's `encoding/json` package uses `sync.Pool` for its internal encoder buffers — without pooling, each `json.Marshal` call allocates a new buffer, generating megabytes of garbage per second under high throughput and triggering frequent GC pauses. Fasthttp (the high-performance HTTP framework used by Cloudflare) uses `sync.Pool` for request and response objects, achieving 10× lower GC overhead than the standard `net/http` package at the cost of more complex object lifecycle management.

### Semaphore via Buffered Channel
```go
// Limit concurrent DB connections to 10
sem := make(chan struct{}, 10)

func QueryDB(query string) {
    sem <- struct{}{}         // acquire (blocks when full)
    defer func() { <-sem }() // release
    db.Exec(query)
}
```

> 🌍 **Real-World:** Go's buffered channel semaphore is used in production crawlers and API clients to enforce concurrency limits — GitHub's Go-based Dependabot uses a semaphore of size 20 to limit concurrent repository scans, preventing it from exhausting GitHub API rate limits (5,000 req/hr per token) while still processing repositories as fast as possible. Without the semaphore, 10,000 goroutines launching simultaneously would burst all 5,000 API calls in seconds, hitting the rate limit and then processing nothing for the rest of the hour.

---

## 3. Atomic Operations

### Compare-And-Swap (CAS)

Hardware instruction: `if memory[addr] == expected { memory[addr] = new; return true }`

```go
import "sync/atomic"

var counter int64

// Safe increment without mutex
atomic.AddInt64(&counter, 1)

// CAS loop — lock-free update
func lockFreeIncrement(val *int64) {
    for {
        old := atomic.LoadInt64(val)
        if atomic.CompareAndSwapInt64(val, old, old+1) {
            return // success
        }
        // CAS failed (another goroutine changed val) → retry
    }
}
```

> 🌍 **Real-World:** Go's `sync/atomic` package's `AddInt64` compiles to a single `LOCK XADD` x86 instruction — no mutex, no context switch, just a CPU-level atomic memory operation. Prometheus's metrics library uses `atomic.AddInt64` for all counter increments, allowing thousands of goroutines to simultaneously increment the same metric counter (e.g., HTTP request count) without any lock contention, even at 1M+ requests/second.

### Atomics vs Mutex

| Use Atomics | Use Mutex |
|-------------|-----------|
| Single variable, simple ops | Multiple variables updated together |
| Counters, flags, pointer swaps | Complex invariants |
| No allocation, no sleep | Need to hold lock across calls |

### ABA Problem
```text
Thread A reads value A
Thread B changes A → B → A (back to A)
Thread A's CAS succeeds (value is still A) but state has changed!
```
**Fix:** tagged pointer — CAS on `(value, version)`. Version increments on every swap.

> 🌍 **Real-World:** Java's `AtomicStampedReference` exists specifically to solve the ABA problem — it wraps a value with an integer stamp (version number) and performs CAS on the `(reference, stamp)` pair atomically. Lock-free queue implementations in Java's `java.util.concurrent` use stamped references to prevent the ABA problem where a node could be dequeued, reused, and re-enqueued at the same memory address, fooling a CAS that only checks the pointer value.

### Lock-Free Stack
```go
type Node struct {
    val  int
    next unsafe.Pointer
}

type Stack struct {
    top unsafe.Pointer
}

func (s *Stack) Push(val int) {
    n := &Node{val: val}
    for {
        top := atomic.LoadPointer(&s.top)
        n.next = top
        if atomic.CompareAndSwapPointer(&s.top, top, unsafe.Pointer(n)) {
            return
        }
    }
}
```

> 🌍 **Real-World:** The LMAX Disruptor uses a lock-free ring buffer with CAS-based sequence number updates for its producer/consumer coordination — instead of a mutex-protected queue, producers CAS on the sequence number to "claim" a slot in the ring buffer. This achieves 25M+ events/second on commodity hardware, used by high-frequency trading firms where a mutex would add microseconds of latency per trade that are unacceptable when competing for price priority on exchanges.

---

## 4. Go Concurrency Patterns

### Worker Pool
```go
func WorkerPool(ctx context.Context, numWorkers int, jobs <-chan int) <-chan int {
    results := make(chan int, 100)
    var wg sync.WaitGroup

    for i := 0; i < numWorkers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for {
                select {
                case job, ok := <-jobs:
                    if !ok {
                        return
                    }
                    results <- job * 2
                case <-ctx.Done():
                    return
                }
            }
        }()
    }

    go func() {
        wg.Wait()
        close(results)
    }()

    return results
}
```

> 🌍 **Real-World:** Docker's image build engine uses a worker pool pattern for parallel layer downloads — when pulling a Docker image with 20 layers, a worker pool of 5 goroutines downloads layers concurrently, reducing pull time from sequential 60 seconds to parallel 15 seconds. The pool size is tunable: too few workers underutilizes network bandwidth; too many saturates it and causes connection throttling from registry servers.

### Fan-Out / Fan-In
```go
// Fan-out: one channel → multiple workers
func fanOut(in <-chan int, n int) []<-chan int {
    outs := make([]<-chan int, n)
    for i := 0; i < n; i++ {
        ch := make(chan int)
        outs[i] = ch
        go func(out chan<- int) {
            defer close(out)
            for v := range in {
                out <- v
            }
        }(ch)
    }
    return outs
}

// Fan-in: multiple channels → one merged channel
func fanIn(channels ...<-chan int) <-chan int {
    merged := make(chan int)
    var wg sync.WaitGroup
    for _, ch := range channels {
        wg.Add(1)
        go func(c <-chan int) {
            defer wg.Done()
            for v := range c {
                merged <- v
            }
        }(ch)
    }
    go func() { wg.Wait(); close(merged) }()
    return merged
}
```

> 🌍 **Real-World:** Google's MapReduce is the canonical fan-out/fan-in pattern at distributed scale — the Map phase fans out input data to thousands of mapper workers in parallel, and the Reduce phase fans in their outputs to a smaller set of reducers. Go's channel-based fan-out/fan-in is the single-process analogue: Kubernetes' controller manager fans out reconciliation tasks to multiple worker goroutines (one per resource type) and fans in their results to a shared event recorder.

### Pipeline
```go
func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for _, n := range nums {
            out <- n
        }
    }()
    return out
}

func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for n := range in {
            out <- n * n
        }
    }()
    return out
}

// Usage: compose stages
for n := range square(square(generate(2, 3, 4))) {
    fmt.Println(n) // 16, 81, 256
}
```

> 🌍 **Real-World:** Netflix's video encoding pipeline uses a multi-stage pipeline pattern — raw video is passed through: demux → decode → scene detection → per-encoding-profile-encode → package → upload. Each stage is a separate process communicating via queues (Kafka), and stages run concurrently on different workers, so while one scene is being encoded, the next is being decoded and the previous is being packaged. This pipeline keeps all CPU cores busy and saturates disk/network I/O simultaneously, maximizing encoding throughput.

---

## 5. Memory Model and Hardware

### The Hardware Problem
```text
Core 0: x = 1; y = 1;
Core 1: if y == 1 { print(x) }  // can print 0!
```
Why: CPU store buffer, out-of-order execution, cache coherence. Core 0 may reorder writes, or Core 1 may see them in a different order.

> 🌍 **Real-World:** The x86 memory model allows store-load reordering (a store followed by a load of a different address can be observed out-of-order by another CPU). The Java Memory Model (JMM) specification was written specifically to give Java programs portable correctness guarantees despite these CPU-level reorderings — the JVM inserts `MFENCE` instructions (memory fences) at `volatile` reads/writes and `synchronized` block entry/exit to prevent reordering across those points.

### Go Memory Model — Happens-Before Guarantees

> ⭐ **IMPORTANT CONCEPT:** Correctness is not "looks sequential on my laptop" — it is **happens-before**. Without a sync edge (channel, mutex unlock→lock, `atomic`, `Once`, goroutine start), another goroutine is allowed to see stale/reordered writes forever.

These operations establish a **happens-before** relationship. Writes before them are visible to reads after them:

| Operation | Happens-Before |
|-----------|----------------|
| `go f()` launch | `f` starts executing |
| Channel send | Corresponding receive completes |
| `close(ch)` | Receive of zero value from channel |
| `sync.Mutex.Unlock()` | Next `Lock()` |
| `sync.Once.Do()` completion | Any other `Do()` returns |

```go
// SAFE: channel establishes happens-before
var result int
done := make(chan struct{})
go func() {
    result = 42   // happens-before close(done)
    close(done)
}()
<-done
fmt.Println(result) // guaranteed to see 42

// UNSAFE: no happens-before between goroutines
var x int
go func() { x = 42 }()
fmt.Println(x) // data race! may print 0 or 42
```

> 🌍 **Real-World:** Go's race detector (`go test -race`) uses ThreadSanitizer (TSan) to dynamically detect happens-before violations — Uber's engineering team runs all Go services with race detection in a shadow production environment, where a copy of production traffic is replayed. They have found race conditions in production code paths that only triggered under specific timing conditions, such as a race between a request goroutine and a background cache refresh goroutine that produced corrupted response data for ~0.001% of requests.

### False Sharing
```go
// BAD: counter1 and counter2 share the same 64-byte cache line
type BadCounters struct {
    c1 int64 // 8 bytes
    c2 int64 // 8 bytes — same cache line!
}
// Core 0 writing c1 and Core 1 writing c2 → cache line bounces between cores

// GOOD: pad to force separate cache lines
type PaddedCounter struct {
    value int64
    _     [56]byte // pad to 64 bytes total
}
type GoodCounters struct {
    c1 PaddedCounter
    c2 PaddedCounter
}
```

> **💡 Real-world impact:** LMAX Disruptor pads sequence numbers to separate cache lines. This alone produces 10x+ throughput improvement on multi-core hardware.

> 🌍 **Real-World:** The Linux kernel's per-CPU data structures are carefully aligned to cache line boundaries — the `task_struct` (process descriptor) fields that are frequently written by the scheduler are placed in the first cache line, while read-only fields like the process name are in separate cache lines. This prevents false sharing where scheduling one CPU's task invalidates the cache line holding another CPU's scheduling data. Java's `@Contended` annotation (added in JDK 8) does the same thing automatically, and the JDK uses it internally on `ForkJoinPool` work queues to prevent false sharing between worker threads.

---

## 6. Deadlock, Livelock, Starvation

### Deadlock

> ⭐ **IMPORTANT CONCEPT:** Deadlock requires **all four** Coffman conditions simultaneously. Break any one (usually lock ordering → no circular wait) and deadlock is impossible. Interview answers that only say "use timeouts" are incomplete without naming these conditions.

Four necessary conditions (ALL must hold simultaneously):

| Condition | Description |
|-----------|-------------|
| Mutual exclusion | Resource held by only one at a time |
| Hold and wait | Holding one resource while waiting for another |
| No preemption | Can't forcibly take a resource away |
| Circular wait | T1 waits for T2, T2 waits for T1 |

```go
var mu1, mu2 sync.Mutex

// Goroutine A: mu1.Lock() → mu2.Lock()
// Goroutine B: mu2.Lock() → mu1.Lock()  ← DEADLOCK

// Fix: always acquire locks in the same global order
// Always: mu1 first, then mu2
```

> **💡** Go runtime detects when ALL goroutines are blocked → panics with "all goroutines are asleep - deadlock!"

**Breaking deadlock:**
- **Lock ordering**: establish a global consistent lock acquisition order
- **Lock timeout**: `mu.TryLock()` with fallback
- **Lock-free algorithms**: CAS-based, no mutex needed

> 🌍 **Real-World:** The 2003 Oracle database deadlock bug affected financial systems — Oracle's internal lock manager had a scenario where two concurrent DML operations on related tables with foreign keys could deadlock each other. Oracle's detection mechanism would roll back one transaction with `ORA-00060: deadlock detected`, but high-throughput order management systems at banks experienced enough frequency that engineers had to redesign their transaction ordering to always acquire row locks in primary-key order, eliminating the circular wait condition.

### Livelock
Goroutines keep changing state in response to each other but make no progress. Not blocked — just stuck. Like two people in a hallway who both step aside in the same direction repeatedly.

**Fix:** Randomized backoff before retrying.

> 🌍 **Real-World:** Ethernet's CSMA/CD (Carrier Sense Multiple Access with Collision Detection) protocol had a livelock risk in early implementations — two stations that simultaneously detected a collision would both wait a fixed time and retry simultaneously, colliding again, indefinitely. The fix (binary exponential backoff with randomization) was specifically designed to prevent livelock: each collision doubles the maximum wait window, and each station picks a random wait within that window, statistically separating their retry attempts.

### Starvation
A goroutine never gets CPU time because others always get priority.

Common causes:
- `sync.RWMutex` with constant writers — readers are perpetually blocked
- Goroutines with tight CPU loops (no I/O or channel ops to yield)

> 🌍 **Real-World:** Java's `ReentrantReadWriteLock` has a "fair" mode specifically to prevent writer starvation — in the default non-fair mode, a constant stream of readers can prevent a writer from ever acquiring the write lock (read starvation of writers). In fair mode, the lock uses a FIFO queue: if a writer is waiting, new readers must also wait behind it, ensuring the writer gets its turn. PostgreSQL's `VACUUM` process historically suffered from starvation on busy tables — in PostgreSQL 14, "autovacuum_vacuum_cost_delay" was redesigned to allow autovacuum to run more aggressively on tables with high dead-tuple accumulation, preventing starvation of the cleanup process.

---

## 7. Concurrent Data Structures

### Java ConcurrentHashMap

> ⭐ **IMPORTANT CONCEPT:** `ConcurrentHashMap` (Java) vs `sync.Map` (Go): CHM is the default concurrent map for mixed read/write workloads (bucket-level locking / CAS). `sync.Map` wins only for **read-mostly / write-once** caches — high write rates make the dirty-map promotion expensive. Don't reach for `sync.Map` by default.

- **Java 7**: 16 segments, each with its own lock (16-way parallelism)
- **Java 8+**: CAS for empty bucket insertion, `synchronized` only on bucket head node
- Reads: mostly lock-free (volatile)
- Far better than `Collections.synchronizedMap` (single full-map lock)

> 🌍 **Real-World:** Java's `ConcurrentHashMap` uses lock striping (segment-level locks in Java 7, bucket-level in Java 8) — a 16-segment `ConcurrentHashMap` allows 16 threads to write concurrently without blocking each other. LinkedIn's Kafka broker uses `ConcurrentHashMap` for its in-memory partition metadata — thousands of producer and consumer threads concurrently read partition leader information and update in-sync replica sets, and `ConcurrentHashMap`'s lock-free reads allow this without any serialization bottleneck.

### Go sync.Map
```go
var m sync.Map

m.Store("key", "value")
val, ok := m.Load("key")
m.LoadOrStore("key", "default") // atomic check-then-store
m.Delete("key")
m.Range(func(k, v interface{}) bool {
    // Note: snapshot is NOT taken — may miss concurrent changes
    return true // return false to stop iteration
})
```

**Internals:** Two maps — a read map (lock-free atomic reads) + dirty map (write-locked). Dirty map is promoted to read map after enough misses.

| Good for | Avoid for |
|----------|-----------|
| Read-mostly, write-once-read-many | High write rate |
| Routing tables, caches | Frequently updated state |

> 🌍 **Real-World:** Go's `sync.Map` is used in Kubernetes' client-go informer cache — the informer stores Kubernetes object state (pods, services, etc.) in a `sync.Map` that is written infrequently (only when the API server pushes updates) but read millions of times per second by controllers checking current state. The read-mostly characteristic of `sync.Map` (lock-free reads via atomic pointer to a read-only map copy) makes it ideal for this use case, where 99.9% of operations are reads.

### Disruptor Pattern (LMAX, Java)

```text
Key design choices:
  - Ring buffer instead of a linked queue
  - Power-of-2 size: index & (size-1) instead of modulo (faster)
  - Sequence numbers padded to 64 bytes (eliminates false sharing)
  - Wait strategies:
      BusySpinWait — lowest latency, burns CPU
      BlockingWait — saves CPU, higher latency

Used by: Apache Storm, log4j2 async appender
Throughput: 25M+ events/sec on commodity hardware
```

> 🌍 **Real-World:** LMAX Exchange built the Disruptor to process 6 million orders per second on a single thread — traditional queue implementations (ArrayBlockingQueue, LinkedBlockingQueue) were too slow due to lock contention and garbage collection. The Disruptor's ring buffer with padded sequence numbers (eliminating false sharing) and lock-free CAS coordination achieves 25M+ events/second. Apache Log4j 2's asynchronous logger uses the Disruptor to handle log events: log statements on the critical path add the event to the ring buffer (nanoseconds) and return, while a background thread writes to disk, reducing logging overhead by 12× versus Log4j 1.x's synchronized logger.


---

## 8. Java vs Go Concurrency — Interview Comparison

| Dimension | Java | Go |
|-----------|------|-----|
| Unit of concurrency | `Thread` / virtual threads (Loom) | Goroutine (cheap, M:N scheduled) |
| Shared-memory sync | `synchronized`, `ReentrantLock`, `ReadWriteLock` | `sync.Mutex`, `sync.RWMutex` |
| Signaling | `wait/notify`, `Condition`, `CountDownLatch`, `CyclicBarrier` | Channels, `sync.Cond`, `WaitGroup` |
| Atomics | `java.util.concurrent.atomic.*`, `VarHandle` | `sync/atomic` |
| Concurrent map | `ConcurrentHashMap` (default choice) | Prefer `map` + `Mutex`; `sync.Map` only read-mostly |
| Thread pool | `ExecutorService`, ForkJoinPool | Manual worker pool over channels |
| Cancellation | Interrupt + Future.cancel; Structured Concurrency (newer) | `context.Context` (idiomatic everywhere) |
| Memory model | JMM: `volatile`, synchronized, final | Happens-before via channels, mutex, atomics, `Once` |
| Philosophy | Share memory, synchronize carefully | Prefer CSP: communicate by channels |
| Race detection | JVM tools / ThreadSanitizer (limited) | First-class: `go test -race` |
| Deadlock detection | External / jstack analysis | Runtime panics if **all** goroutines asleep |

> ⭐ **IMPORTANT CONCEPT:** Interview framing: Java = rich concurrent collections + explicit thread pools; Go = goroutines + channels + simple primitives. Neither is "safer" by default — both need happens-before discipline.

> 🛠️ **PRACTICAL:** When asked "Java or Go for concurrent services?", answer with workload: CPU-bound Java pools vs Go's cheap goroutines for high-concurrency I/O; mention Loom closes the gap for Java blocking I/O.

### Mental Model Mapping

```text
Java synchronized(obj)     ≈  mu.Lock(); defer mu.Unlock()
Java CountDownLatch        ≈  sync.WaitGroup
Java ConcurrentHashMap     ≈  map + Mutex  (or sync.Map if read-heavy)
Java ExecutorService       ≈  worker pool over chan Job
Java volatile              ≈  atomic.Load/Store  (visibility, not full mutex)
Java CompletableFuture     ≈  goroutine + channel result / errgroup
```

---

## 9. Interview Coding Drills

### Drill A — Thread-Safe LRU Cache (45 min classic)

**Prompt:** Implement `get`/`put` with capacity `N`, O(1) average, safe under concurrent clients.

**Approach checklist:**
1. Data structure: hashmap key → node + doubly linked list (MRU at head)
2. Concurrency: single `Mutex` around both structures (simplest correct answer)
3. Optional upgrade: sharded locks by `hash(key) % shards` for throughput
4. Eviction: on `put` when full, remove tail; move accessed nodes to head on `get`

```go
type node struct {
    key, val  int
    prev, next *node
}

type LRUCache struct {
    mu       sync.Mutex
    capacity int
    items    map[int]*node
    head, tail *node // dummy sentinels
}

func (c *LRUCache) Get(key int) (int, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    n, ok := c.items[key]
    if !ok {
        return 0, false
    }
    c.moveToFront(n)
    return n.val, true
}

func (c *LRUCache) Put(key, val int) {
    c.mu.Lock()
    defer c.mu.Unlock()
    if n, ok := c.items[key]; ok {
        n.val = val
        c.moveToFront(n)
        return
    }
    if len(c.items) >= c.capacity {
        victim := c.tail.prev
        c.remove(victim)
        delete(c.items, victim.key)
    }
    n := &node{key: key, val: val}
    c.insertFront(n)
    c.items[key] = n
}
```

> 🛠️ **PRACTICAL:** Say out loud: "I synchronize the map and list under one lock so the invariant 'map and list always agree' holds." Mention `sync.Map` is a wrong fit here (needs eviction order).

**Follow-ups interviewers love:**
- Read-mostly: `RWMutex`? Usually not — `get` mutates list order → needs write lock anyway
- TTL expiry: separate sweeper goroutine + careful lock ordering
- Distributed LRU: Redis / CDN — different problem

---

### Drill B — Rate Limiter (Token Bucket + Sliding Window)

**Prompt:** Limit to `R` requests per second per user key; thread-safe; explain burst vs smooth.

```go
type TokenBucket struct {
    mu         sync.Mutex
    tokens     float64
    capacity   float64
    refillRate float64 // tokens per second
    last       time.Time
}

func (b *TokenBucket) Allow() bool {
    b.mu.Lock()
    defer b.mu.Unlock()
    now := time.Now()
    elapsed := now.Sub(b.last).Seconds()
    b.tokens = math.Min(b.capacity, b.tokens+elapsed*b.refillRate)
    b.last = now
    if b.tokens < 1 {
        return false
    }
    b.tokens--
    return true
}
```

**Sliding window log (stricter fairness):**
```text
Keep timestamps of accepted requests in a deque.
On request: drop stamps older than window; if len < limit → accept + append now.
Cost: O(limit) memory per key; good for exactness, heavier than token bucket.
```

| Algorithm | Pros | Cons | Use |
|-----------|------|------|-----|
| Token bucket | Allows controlled burst | Burst may surprise backends | API gateways |
| Leaky bucket | Smooth egress | Less burst-friendly | Traffic shaping |
| Sliding window | Accurate, intuitive | More memory/CPU | Billing-critical quotas |
| Fixed window | Simple | Boundary burst (2× at edges) | Crude limits |

> ⭐ **IMPORTANT CONCEPT:** Always pick algorithm + key dimension (user/IP/API key) + where it runs (gateway vs service) + what happens on deny (`429` + `Retry-After`).

---

### Drill C — Worker Pool with Context Cancellation

**Prompt:** N workers, bounded queue, graceful shutdown on cancel, no goroutine leaks.

```go
func RunPool(ctx context.Context, workers int, jobs <-chan Job) error {
    var wg sync.WaitGroup
    errOnce := make(chan error, 1)

    for i := 0; i < workers; i++ {
        wg.Add(1) // Add BEFORE spawn
        go func() {
            defer wg.Done()
            for {
                select {
                case <-ctx.Done():
                    return
                case job, ok := <-jobs:
                    if !ok {
                        return
                    }
                    if err := job.Do(ctx); err != nil {
                        select {
                        case errOnce <- err:
                        default:
                        }
                    }
                }
            }
        }()
    }

    done := make(chan struct{})
    go func() { wg.Wait(); close(done) }()

    select {
    case <-done:
        select {
        case err := <-errOnce:
            return err
        default:
            return nil
        }
    case <-ctx.Done():
        wg.Wait()
        return ctx.Err()
    }
}
```

> 🛠️ **PRACTICAL:** Checklist graders use: Add-before-spawn, `defer Done`, select on `ctx.Done`, close results only after `Wait`, never send on closed channel.

---

## 10. Common Concurrency Interview Questions (with Answers)

### Q1: What is a race condition vs a data race?
**A:** A **data race** is concurrent conflicting access without sync (UB in C++; detected by Go race detector). A **race condition** is a broader logic bug where correctness depends on timing (even with atomics you can have TOCTOU races). All data races are concurrency bugs; not all race conditions are data races.

### Q2: Why is `count++` not thread-safe?
**A:** It compiles to load, add, store. Two threads can load the same value and both store `v+1`, losing an update. Fix: `atomic.Add` or mutex around the increment.

### Q3: Mutex vs RWMutex vs channel?
**A:** Mutex for short critical sections protecting shared memory. RWMutex when reads dominate and critical sections are read-mostly **without** mutating under RLock. Channels for ownership transfer / pipelines / decoupling producers and consumers — not a silver bullet for every map update.

### Q4: Explain happens-before in Go with one example.
**A:** Unlock happens-before the next Lock; channel send happens-before corresponding receive. Example: write `x=1` then `close(done)`; after `<-done`, reading `x` is guaranteed to see `1`.

### Q5: Four deadlock conditions — how do you prevent?
**A:** Coffman: mutual exclusion, hold-and-wait, no preemption, circular wait. Prevention: global lock order (breaks circular wait), try-lock with backoff, or lock-free structures. Detection: timeouts, Go's all-goroutines-asleep panic, Java thread dumps.

### Q6: What is false sharing?
**A:** Two frequently written fields on the same cache line cause cross-core invalidation ping-pong. Fix: pad to 64 bytes / `@Contended`. Mention Disruptor / per-CPU counters.

### Q7: ConcurrentHashMap vs Collections.synchronizedMap vs sync.Map?
**A:** `synchronizedMap` = one giant lock. CHM = fine-grained / CAS, general-purpose. `sync.Map` = optimized for stable keys, many concurrent readers; poor under heavy writes. Prefer `map+Mutex` in Go unless profiling says otherwise.

### Q8: How does CAS enable lock-free algorithms? What is ABA?
**A:** CAS updates only if memory still equals expected; retry loops build lock-free stacks/queues. ABA: value changes A→B→A; CAS succeeds incorrectly. Fix: version/stamp tagged pointers (`AtomicStampedReference`).

### Q9: Goroutine leak — how do you find and prevent?
**A:** Symptom: goroutine count climbs, memory grows. Causes: blocked on channel forever, waiting without `ctx`. Prevent: always select on `ctx.Done`, close channels from sender, use `errgroup` with cancel. Detect: `pprof` goroutine profiles, leak tests.

### Q10: Design a thread-safe counter with minimal contention.
**A:** Start with `atomic.AddInt64`. If still hot: sharded counters (per-P / per-thread) + periodic sum; watch false sharing (pad shards).

---

## 11. Practical Labs

### Lab 1 — Detect a Race with `go test -race`

> 🛠️ **PRACTICAL:** Write a failing test, see the race detector report, then fix with mutex/atomic and re-run clean.

```go
// bad_counter_test.go
func TestRace(t *testing.T) {
    var n int
    var wg sync.WaitGroup
    for i := 0; i < 1000; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            n++ // DATA RACE
        }()
    }
    wg.Wait()
}
```

```bash
go test -race ./...
# Expect: WARNING: DATA RACE on Write/Read of n
# Fix: atomic.AddInt64 or mu.Lock around n++
go test -race ./...   # should pass
```

**What to read in the report:** the two stack traces (racing goroutines), the variable address, and whether it was read vs write. Fix must introduce happens-before between those accesses.

### Lab 2 — Write a Deadlock, Then Fix Lock Ordering

```go
var a, b sync.Mutex

func deadlock() {
    var wg sync.WaitGroup
    wg.Add(2)
    go func() {
        defer wg.Done()
        a.Lock(); defer a.Unlock()
        time.Sleep(10 * time.Millisecond)
        b.Lock(); defer b.Unlock()
    }()
    go func() {
        defer wg.Done()
        b.Lock(); defer b.Unlock()
        time.Sleep(10 * time.Millisecond)
        a.Lock(); defer a.Unlock() // circular wait with other goroutine
    }()
    wg.Wait()
}

func fixed() {
    // Always lock a before b in BOTH goroutines
    lockBoth := func() {
        a.Lock(); b.Lock()
    }
    unlockBoth := func() {
        b.Unlock(); a.Unlock()
    }
    // ... use lockBoth/unlockBoth consistently
}
```

> 🛠️ **PRACTICAL:** Run under timeout; observe hang. Fix ordering; optionally add `TryLock` + backoff as a secondary defense. Document the global lock hierarchy in a comment.

### Lab 3 — WaitGroup Add-Before-Spawn Bug

```go
// BROKEN
for i := 0; i < 100; i++ {
    go func() {
        wg.Add(1)      // race with Wait
        defer wg.Done()
        work()
    }()
}
wg.Wait() // may return early

// FIXED
for i := 0; i < 100; i++ {
    wg.Add(1)
    go func() {
        defer wg.Done()
        work()
    }()
}
wg.Wait()
```

### Lab 4 — Channel Pipeline + Cancellation

Build `generate → square → sum` with `context` cancel midway; assert no goroutine leaks via a short sleep + `runtime.NumGoroutine()` delta check (approximate) or a dedicated leak detector.

---

## 12. Important Concepts Checklist

Use this as a pre-interview self-test. Mark each only when you can explain **and** code it cold.

### Primitives & Correctness
- [ ] Concurrency ≠ parallelism; when each matters
- [ ] Race condition vs data race; why `++` is racy
- [ ] Mutex: defer unlock, non-reentrant Go mutex, no I/O under lock
- [ ] RWMutex: writer preference / starvation nuances
- [ ] WaitGroup: **Add before spawn**; never copy WaitGroup after first use
- [ ] `sync.Once` for single init; vs double-checked locking pitfalls
- [ ] Semaphore via buffered channel
- [ ] Atomics + CAS loops; ABA and stamped references
- [ ] Happens-before table (go, chan, mutex, Once)

### Failure Modes
- [ ] Four deadlock conditions + lock ordering fix
- [ ] Livelock vs deadlock vs starvation
- [ ] False sharing and padding
- [ ] Goroutine leaks and context cancellation

### Data Structures & Patterns
- [ ] ConcurrentHashMap internals vs sync.Map use cases
- [ ] Worker pool, fan-in/fan-out, pipeline
- [ ] Thread-safe LRU design
- [ ] Rate limiter algorithms (token / sliding)
- [ ] Disruptor / ring buffer intuition (optional senior)

### Tooling
- [ ] `go test -race` workflow
- [ ] Reading a race report
- [ ] `pprof` goroutine / mutex profiles (basic)

### Cross-Language
- [ ] Java ↔ Go primitive mapping table
- [ ] When you'd choose ExecutorService vs goroutine pools

> ⭐ **IMPORTANT CONCEPT:** If you can only memorize five things: **happens-before**, **Add-before-spawn**, **lock ordering**, **don't hold locks across I/O**, and **race detector in CI**.
