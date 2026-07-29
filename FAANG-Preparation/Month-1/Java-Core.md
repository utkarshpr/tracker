# Java Core — Complete Study Notes (Basics → JVM Internals)

Self-contained. No internet needed.

---

## Table of Contents

1. [Java Basics (Mental Model)](#1-java-basics-mental-model)
2. [JVM Memory Areas](#2-jvm-memory-areas)
3. [Class Loading](#3-class-loading)
4. [JIT Compilation](#4-jit-compilation)
5. [Garbage Collection](#5-garbage-collection)
6. [Safepoints and TLAB](#6-safepoints-and-tlab)
7. [Java Memory Model (JMM) and Concurrency](#7-java-memory-model-jmm-and-concurrency)
8. [Thread Pools and CompletableFuture](#8-thread-pools-and-completablefuture)
9. [Advanced Multithreading and Concurrency](#9-advanced-multithreading-and-concurrency)
10. [Spring Boot Internals](#10-spring-boot-internals)
11. [JVM Tuning and Diagnostics](#11-jvm-tuning-and-diagnostics)
12. [Production Patterns](#12-production-patterns)

---

## 1. Java Basics (Mental Model)

**What Java is**: Write once, run anywhere. Source (`.java`) → bytecode (`.class`) → JVM interprets/JIT-compiles bytecode at runtime for any platform.

```text
MyApp.java  ──javac──▶  MyApp.class (bytecode)  ──JVM──▶  machine code
```

> **💡 Key Insight:** Why JVM matters for senior engineers:
> - Memory is managed (GC) but you still need to understand GC to avoid pauses
> - JIT compilation makes Java fast but has warmup cost
> - Thread model is OS-thread-per-Java-thread (unlike Go goroutines) — expensive

> 🌍 **Real-World:** Android (before ART) ran Java bytecode on Dalvik, Google's JVM optimised for mobile — the "write once, run anywhere" model meant the same Java source compiled to both server-side JARs and Android APKs, which is why Java became the default language for Android development for over a decade.

---

## 2. JVM Memory Areas

### Heap (GC-managed)

```text
Heap:
├── Young Generation
│   ├── Eden Space          ← new objects allocated here
│   ├── Survivor S0         ← objects that survived 1+ GC
│   └── Survivor S1         ← objects that survived 1+ GC (alternating)
└── Old Generation (Tenured)  ← long-lived objects promoted from Young
```

**Object lifecycle**:
1. New object → Eden (fast bump pointer allocation via **TLAB**)
2. **Minor GC** (Young GC): Eden + S0/S1 swept → surviving objects → S1 (age++)
3. Objects with age >= threshold (default 15) → promoted to Old Gen
4. **Major GC** / **Full GC**: Old Gen collected (expensive, STW pause)

> 🌍 **Real-World:** Spring Boot applications at Netflix allocate millions of short-lived objects per second (HTTP request objects, Jackson deserialisation nodes, Hystrix command objects) — the Young Generation is specifically sized to absorb this allocation storm so Minor GC collects them cheaply in milliseconds, while the Old Gen stays stable with only long-lived caches and connection pools.

### Non-Heap Areas

```text
Metaspace (Java 8+, replaced PermGen):
  - Class metadata: class names, method bytecodes, field info
  - Grows dynamically in native memory (not heap)
  - JVM flag: -XX:MaxMetaspaceSize=256m
  - OutOfMemoryError: Metaspace if class loading leaks (dynamic proxies, code generation)

Code Cache:
  - JIT-compiled native code stored here
  - -XX:ReservedCodeCacheSize=240m (default)

Thread Stacks:
  - Each thread gets its own stack: stack frames for method calls
  - Default: 256KB-1MB per thread
  - StackOverflowError = stack too deep (infinite recursion)
  - -Xss512k to reduce per-thread stack (fit more threads)
```

### Key JVM Flags

```bash
-Xms2g           # initial heap size
-Xmx4g           # max heap size (keep Xms=Xmx in prod to avoid resize pauses)
-Xss256k         # thread stack size
-XX:+UseG1GC     # use G1 garbage collector
-XX:MaxGCPauseMillis=200  # G1 target pause time
-XX:+PrintGCDetails -Xloggc:/var/log/gc.log  # GC logging
```

> 🌍 **Real-World:** LinkedIn's feed-ranking service runs with `-Xms8g -Xmx8g` (equal initial and max heap) specifically to avoid JVM heap resize pauses during traffic ramps — when Xms < Xmx, the JVM may pause to expand the heap under load spikes, which would violate their p99 SLO; pinning both values eliminates this class of pause entirely.

---

## 3. Class Loading

### ClassLoader Hierarchy

```text
Bootstrap ClassLoader (C++ code, loads rt.jar / java.base)
    ↑ parent
Extension ClassLoader → loads jdk/lib/ext/
    ↑ parent
Application ClassLoader → loads classpath (your app jars)
    ↑ parent
Custom ClassLoaders (Spring, Tomcat, OSGi create their own)
```

### Delegation Model

Before loading a class, ClassLoader asks its parent first:

```text
AppClassLoader.loadClass("com.myapp.Foo")
  → ask ExtClassLoader → ask Bootstrap
  Bootstrap: not found
  ExtClassLoader: not found
  AppClassLoader: found on classpath → load it
```

> **💡 Key Insight:** `java.lang.String` is always loaded by Bootstrap — security. You can't override JDK classes by shadowing them on the classpath.

> 🌍 **Real-World:** Apache Tomcat uses a custom ClassLoader hierarchy to isolate web applications — each deployed WAR gets its own `WebAppClassLoader` that loads the WAR's classes before delegating to the parent, preventing version conflicts between two WARs that depend on different versions of the same library (e.g., Jackson 2.12 vs 2.14 in two different deployed apps).

### Class Loading Phases

```text
1. Loading:    Find bytecode (.class file), create Class object
2. Linking:
   a. Verification:  Check bytecode is valid JVM bytecode (safety)
   b. Preparation:   Allocate memory for static fields, set to defaults
   c. Resolution:    Resolve symbolic references (class names) to actual references
3. Initialization: Run static initializers, assign static field values
```

```java
class Config {
    static int MAX = 100;          // Phase 3: MAX = 100
    static { System.out.println("Config loaded"); }  // Phase 3: runs once
}
// Config.MAX accessed → triggers loading if not already loaded
```

> 🌍 **Real-World:** Spring Boot's `@SpringBootApplication` triggers class loading of hundreds of configuration classes during startup — the static initializer order in Spring's auto-configuration classes is deliberately controlled to ensure `DataSource` beans are available before `JdbcTemplate` beans are initialised, exploiting JVM class loading guarantees for safe dependency ordering.

### Memory Leak via ClassLoader

```java
// Spring creates CGLIB proxies → new ClassLoader per proxy class
// Memory leak if you keep creating new ClassLoaders without GC

// Common in hot deploy: Tomcat creates new ClassLoader per webapp
// Old ClassLoader eligible for GC only when ALL references to its classes are gone
// ThreadLocal, static fields, native libraries prevent GC → Metaspace OOM
```

> **⚠️ Production Gotcha:** In hot-deploy environments (Tomcat), every redeployment creates a new ClassLoader. If any static field or ThreadLocal holds a reference to a class loaded by the old ClassLoader, that ClassLoader (and all its classes) cannot be GC'd — eventually causing `OutOfMemoryError: Metaspace`.

> 🌍 **Real-World:** A well-documented production issue at several large Java shops (including documented cases from the Spring blog) involves JDBC drivers registering themselves in `DriverManager` (a JDK static field) with a reference back to the webapp's ClassLoader — on Tomcat hot-redeploy, the old ClassLoader is pinned by `DriverManager` and the Metaspace grows by ~50–100 MB per redeploy until the JVM OOMs. The fix is implementing `ServletContextListener.contextDestroyed()` to deregister the driver.

---

## 4. JIT Compilation

### Tiered Compilation (Java 8+)

```text
Tier 0: Interpreter (slow, starts immediately)
Tier 1: C1 compiler, client mode (fast compile, no optimizations)
Tier 2: C1 compiler, limited profiling
Tier 3: C1 compiler, full profiling (counts method calls, branch paths)
Tier 4: C2 compiler, server mode (slow compile, aggressive optimizations)
         ← most "hot" methods end up here
```

> **💡 Key Insight:** **Warmup** — Methods start at Tier 0. After ~2000 invocations → C1. After ~10000 invocations → C2. Benchmarks must "warm up" JIT before measuring. The first 10s of a new JVM is slower than steady state.

> 🌍 **Real-World:** Netflix pre-warms new JVM instances before adding them to the load balancer — they send synthetic traffic to a new instance for 2–3 minutes to allow C2 to compile hot paths (HTTP dispatch, JSON serialisation, Hystrix circuit breaker logic) before the instance receives real user traffic, preventing the "cold start" latency spike that would otherwise violate their p99 SLO.

### C2 Optimizations

```text
Inlining:
  foo() calls bar() which calls baz() → C2 inlines baz() into foo()
  Eliminates call overhead, enables further optimizations

Loop unrolling:
  for (int i = 0; i < 4; i++) arr[i] = 0;
  → arr[0]=0; arr[1]=0; arr[2]=0; arr[3]=0;  (no loop overhead)

Escape analysis:
  Object created in method, never leaves scope → allocate on stack (not heap)
  → no GC pressure for short-lived objects

Dead code elimination:
  if (DEBUG_MODE) { ... }  where DEBUG_MODE is final static false → entire block removed

Devirtualization:
  interface method call → C2 detects only one implementor → direct call (no vtable lookup)
```

> 🌍 **Real-World:** The Disruptor ring buffer (used by LMAX Exchange) is heavily optimised by C2's loop unrolling and inlining — the hot inner loop that reads events from the ring buffer is inlined and unrolled by C2 to the point where it compiles to near-optimal assembly, achieving single-digit microsecond latency that would be impossible with interpreted bytecode.

### Deoptimization

C2 makes speculative optimizations. If assumption is violated → deoptimize back to interpreter:

```java
// C2 assumed method() always called with Cat, devirtualized call
// Later: Dog passed → C2 assumption violated → back to interpreter
// This causes brief performance dip
```

> 🌍 **Real-World:** A documented Elasticsearch performance issue involved C2 devirtualizing a frequently-called Lucene query method, then a new query type being introduced that violated C2's monomorphic assumption — every query using that code path briefly deoptimised to the interpreter, causing a latency spike across the cluster. The fix was to pre-load all query types at startup to force polymorphic compilation from the start.

---

## 5. Garbage Collection

> ⭐ **IMPORTANT CONCEPT:** Know Young vs Old collection cost and when G1 vs ZGC is chosen for latency SLOs.

### GC Basics

**Mark and Sweep**:
1. **Mark**: trace all reachable objects from **GC roots** (stack vars, static fields, JNI refs)
2. **Sweep**: collect all non-marked objects
3. **Compact** (optional): move surviving objects together to avoid fragmentation

**Stop-The-World (STW)**: All application threads paused while GC runs. Causes latency spikes.

**Generational hypothesis**: Most objects die young. Short-lived allocations (request objects, temp strings) collected cheaply in Young GC. Long-lived objects (caches, connection pools) in Old Gen.

### G1GC (Garbage First — Default since Java 9)

**Key idea**: Divide heap into equal-sized regions (~1–32 MB). Regions dynamically assigned as Eden/Survivor/Old/Humongous. Collect regions with most garbage first (hence "Garbage First").

```text
Heap divided into ~2048 regions:
[E][E][S][O][O][H][E][O][S][E][O][O][H] ...
E=Eden, S=Survivor, O=Old, H=Humongous (large object > region/2)

Young GC (concurrent + STW):
  1. Concurrent: Build remembered sets (pointers from Old→Young)
  2. STW: Evacuate Eden/Survivor regions → copy live objects to new Survivor/Old regions
  3. Eden regions become free again

Mixed GC (when Old Gen ~45% full):
  1. Concurrent marking phase (runs with app threads):
     - Initial Mark (STW, piggybacked on Young GC)
     - Root Region Scan (concurrent)
     - Concurrent Mark (concurrent, SATB write barrier)
     - Remark (STW, short)
     - Cleanup (STW + concurrent)
  2. Mixed GC: collect Young + some Old regions with most garbage
```

**SATB (Snapshot-At-The-Beginning) write barrier** — when app thread modifies a reference during concurrent marking:
- Old value logged to SATB queue before overwrite
- Ensures objects "grey at start of marking" are not missed

```java
// Application thread does: a.field = b
// SATB barrier: log old value of a.field to SATB queue
// Marker will process SATB queue to not miss the old value
```

**G1GC Tuning**:

```bash
-XX:+UseG1GC
-XX:MaxGCPauseMillis=200    # target pause (G1 tries to meet this, not guaranteed)
-XX:G1HeapRegionSize=16m    # larger regions for apps with many large objects
-XX:G1NewSizePercent=5      # min young gen %
-XX:G1MaxNewSizePercent=60  # max young gen %
-XX:InitiatingHeapOccupancyPercent=45  # start concurrent marking when heap 45% full
```

> 🌍 **Real-World:** Twitter's timeline service (Java + G1GC) reduced p99 GC pauses from ~500 ms (CMS) to ~80 ms by migrating to G1GC and setting `-XX:MaxGCPauseMillis=100 -XX:G1HeapRegionSize=32m` — the larger region size was necessary because timeline objects (pre-aggregated tweet bundles) are 10–20 MB each and would otherwise be treated as Humongous allocations, which G1 handles less efficiently.

### ZGC (Java 11+, Low Latency)

**Goal**: Sub-millisecond STW pauses, even for TB-sized heaps.

**Key techniques**:

1. **Colored pointers**: 64-bit pointers use metadata bits (bits 42–45) to encode GC state
   ```text
   Pointer bits:
   [0..41] = actual address (42 bits = 4TB addressable)
   [42]    = marked0
   [43]    = marked1
   [44]    = remapped
   [45]    = finalizable
   ```
2. **Load barrier**: Every reference load goes through a barrier that checks pointer color
   ```java
   // Application code: Object o = a.field;
   // ZGC generates:
   Object o = a.field;
   if (o.colorBit != expectedColor) {
       o = slowPath(o);  // remap pointer, update GC structures
   }
   ```
3. **Concurrent relocation**: Objects moved while app runs. Old pointers fixed lazily on load.

**STW phases** (very short):
- Pause Mark Start: ~1 ms (scan thread stacks for GC roots)
- Pause Mark End: ~1 ms (process remaining SATB)
- Pause Relocate Start: ~1 ms (scan roots again)

> 🌍 **Real-World:** Oracle's own internal financial trading systems (running on JDK 17+) migrated to ZGC specifically to meet a 5 ms p99.9 latency SLO — with G1GC and a 32 GB heap, occasional 150 ms STW pauses violated the SLO during mixed GC cycles; ZGC's sub-millisecond pauses on the same heap eliminated every SLO breach.

### G1GC vs ZGC — Comparison

| Dimension | G1GC | ZGC |
|---|---|---|
| Default since | Java 9 | Java 15 (production-ready) |
| STW pause goal | ~200 ms (configurable) | < 1 ms |
| Heap size sweet spot | Up to ~100 GB | Up to TBs |
| CPU overhead | Low | Higher (load barriers on every ref read) |
| Concurrent compaction | No (STW compact) | Yes |
| Best for | Balanced throughput + latency | Latency-critical services |
| Tuning knobs | Many (`MaxGCPauseMillis`, region size, etc.) | Fewer (mostly heap size) |

> **💡 Key Insight:** G1 is often better for throughput-oriented workloads. ZGC shines when tail-latency SLOs are strict (e.g., p99 < 10 ms).

### CMS (Deprecated in Java 14, Removed in Java 15)

Mostly concurrent Old Gen collector. Had fragmentation issues (no compaction). Replaced by G1/ZGC.

### Shenandoah (RedHat, similar to ZGC)

Also concurrent compaction. Uses **Brooks pointers** (forwarding pointer per object) instead of colored pointers.

> 🌍 **Real-World:** Red Hat's OpenShift platform (running thousands of customer JVM workloads) recommends Shenandoah for latency-sensitive Java microservices in containers — Shenandoah's Brooks pointer approach adds one extra memory word per object (vs ZGC's colored pointer which requires 48-bit address space), making it compatible with 32-bit compressed oops and thus more memory-efficient for heap sizes under 32 GB.

### GC Tuning Signals

```text
Frequent Young GC → young gen too small → increase -XX:G1NewSizePercent
Long GC pauses → region size mismatch, too many humongous objects
High allocation rate → too many short-lived objects → reduce allocations
OOM: GC overhead limit exceeded → spending >98% time in GC → heap too small or leak
```

---

## 6. Safepoints and TLAB

### Safepoints

A **safepoint** is a point in program execution where the JVM knows the state of all threads (all Java stacks, heap references are enumerable). Required for:
- Stop-The-World GC (must pause all threads AT safepoints)
- Deoptimization
- Thread stack dumps

```text
JVM inserts safepoint checks at:
- Method return
- Loop back edges (prevents infinite loop from blocking STW)
- JNI entry/exit

Time to safepoint (TTSP): time between JVM requesting safepoint and all threads reaching one
Long TTSP: counted loops, JNI code (won't check safepoints until return)
```

> **⚠️ Production Gotcha:** A tight counted loop (`for (int i = 0; i < 1_000_000_000; i++)`) can delay safepoints for hundreds of milliseconds, causing GC pause inflation that shows up as a `TTSP` spike in GC logs. Add a safepoint poll or break the loop up if this becomes an issue.

> 🌍 **Real-World:** A famous Azul Systems blog post documented a production incident where a Java service processing large CSV files had a tight counting loop iterating 500M elements — GC safepoint requests were delayed up to 800 ms while the loop ran, causing every GC pause to appear as 800+ ms in monitoring even though the actual GC work took < 50 ms. The fix was splitting the loop with a `Thread.yield()` or switching to an uncounted while-loop with a safepoint check.

### TLAB (Thread-Local Allocation Buffers)

Each thread has a small private chunk of Eden space for allocations. No synchronization needed for normal allocations.

```text
Thread 1: TLAB [addr: 0x100 - 0x200, current: 0x150]
Thread 2: TLAB [addr: 0x200 - 0x300, current: 0x220]

new Object() in Thread 1:
  1. Bump pointer: old=0x150, new=0x170 (20 bytes), no lock needed
  2. TLAB full → request new TLAB from Eden (requires brief synchronization)

vs. without TLAB:
  Every allocation requires CAS on shared Eden pointer → contention
```

**Allocation rate measurement**:

```bash
jstat -gcnew <pid> 1000   # watch EU (Eden used) growth per second
```

> 🌍 **Real-World:** Apache Cassandra's write path uses TLAB heavily — each write thread allocates `Mutation` objects (containing the row data) at rates of hundreds of thousands per second; TLAB ensures these allocations are thread-local bump-pointer operations with no CAS overhead, keeping write throughput high even at 64-core concurrency. Cassandra engineers monitor `EU` (Eden Used) growth rate via `jstat` to detect allocation spikes during compaction.

---

## 7. Java Memory Model (JMM) and Concurrency

> ⭐ **IMPORTANT CONCEPT:** `volatile` gives visibility + ordering, not atomicity of compound actions — still need locks/atomics for `count++`.

### Visibility Problem

```java
// Thread A writes:
boolean ready = false;
int value = 0;

// Thread B reads:
while (!ready) {}
System.out.println(value); // may print 0!
```

CPU caches and instruction reordering mean Thread B may never see Thread A's writes without synchronization.

### Happens-Before (JMM Guarantee)

If A **happens-before** B, all writes visible to A are visible to B.

Rules:
1. **Program order**: Within one thread, statement N happens-before statement N+1
2. **Monitor unlock → lock**: `synchronized` block exit happens-before next entry
3. **Volatile write → read**: Write to volatile field happens-before every subsequent read
4. **Thread.start()**: Code before `start()` happens-before thread's `run()`
5. **Thread.join()**: Thread's completion happens-before `join()` returns
6. **Transitivity**: A→B and B→C implies A→C

> 🌍 **Real-World:** Java's `ConcurrentHashMap` relies precisely on the happens-before rules — a `put()` followed by a `get()` from another thread is safe because `ConcurrentHashMap` uses `volatile` writes for the entry array, establishing a happens-before from the writer's `put` to the reader's `get` without any external synchronisation needed from the caller.

### volatile

```java
private volatile boolean running = true;   // guaranteed visibility

// Without volatile:
// JIT may cache `running` in register → thread never sees it change
// With volatile:
// Every read goes to main memory, every write flushed to main memory
// Also prevents reordering across the volatile access

// volatile does NOT make compound operations atomic:
volatile int count = 0;
count++;   // NOT atomic: read, increment, write → race condition
// Use AtomicInteger for atomic compound ops
```

> **⚠️ Production Gotcha:** `volatile` is often misused as a substitute for `synchronized`. It guarantees visibility and ordering, but **not** atomicity. `count++` on a volatile field is still a read-modify-write race condition.

> 🌍 **Real-World:** The `Executor` shutdown flag in `java.util.concurrent.ThreadPoolExecutor` is a `volatile int` (the `ctl` field) — the JDK authors specifically chose `volatile` (combined with CAS via `AtomicInteger`) rather than `synchronized` because `volatile` reads are lock-free, allowing worker threads to check the shutdown state on every loop iteration with negligible overhead.

### synchronized

```java
// Intrinsic lock (monitor) on object
synchronized (this) {
    // critical section — only one thread at a time
}

// On method:
public synchronized void increment() { count++; }

// Static synchronized: locks on the Class object
public static synchronized void register() { }
```

**Object header** stores monitor state:

```text
Object header (64-bit JVM):
  Mark word (64 bits):
    - Unlocked: hash code (31 bits) + age (4 bits) + tag 01
    - Biased:   thread ID (54 bits) + epoch (2 bits) + age + tag 01
    - Lightweight lock: pointer to lock record in thread's stack
    - Heavyweight lock: pointer to OS mutex (inflated monitor)
```

**Lock inflation**: uncontended → biased lock (CAS to lock, no OS involvement). Contended → lightweight (CAS spin). High contention → heavyweight (OS mutex, park/unpark). Biased locking removed in Java 15.

> 🌍 **Real-World:** The JDK's `StringBuffer` (the thread-safe version of `StringBuilder`) uses `synchronized` on every method — profiling at LinkedIn showed `StringBuffer` was responsible for 8% of CPU time in a high-throughput log formatting path due to synchronized method overhead, even though the `StringBuffer` was only accessed from a single thread; switching to `StringBuilder` (no synchronization) eliminated the cost entirely.

### ReentrantLock vs synchronized

```java
ReentrantLock lock = new ReentrantLock();

// Same as synchronized but with extra features:
lock.lock();
try {
    // critical section
} finally {
    lock.unlock(); // MUST unlock in finally
}

// Extra features:
lock.tryLock(1, TimeUnit.SECONDS)  // attempt with timeout
lock.lockInterruptibly()            // can be interrupted while waiting
new ReentrantLock(true)             // fair lock (FIFO order, prevents starvation)
lock.newCondition()                 // multiple Condition variables (vs single wait/notify)
```

> 🌍 **Real-World:** Apache Kafka's `ReplicaManager` uses `ReentrantLock` with `tryLock(timeout)` for partition leadership handoff — during a leader election, a replica attempts to acquire the partition lock with a timeout so that if a slow disk operation holds the lock too long, the election attempt fails fast and retries rather than blocking indefinitely, which would stall the entire partition's ISR management.

### ReentrantReadWriteLock

```java
ReadWriteLock rwl = new ReentrantReadWriteLock();

// Multiple readers simultaneously:
rwl.readLock().lock();
try { return data; }
finally { rwl.readLock().unlock(); }

// Exclusive writer:
rwl.writeLock().lock();
try { data = newData; }
finally { rwl.writeLock().unlock(); }
```

> 🌍 **Real-World:** Elasticsearch's shard routing table uses `ReentrantReadWriteLock` — every search request acquires the read lock (thousands per second), while cluster state changes (node joins, shard relocations) acquire the write lock rarely; the read-write separation means searches are never blocked by each other, only by the infrequent cluster topology changes.

### Atomic Classes

```java
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();            // atomic i++
counter.compareAndSet(expected, new); // CAS: atomic conditional update

AtomicReference<Node> head = new AtomicReference<>(null);
// Used in lock-free data structures

LongAdder sum = new LongAdder(); // Better than AtomicLong under high contention
sum.add(1);                       // Each thread updates its own cell, sum combines
sum.longValue();                  // O(threads) sum, vs AtomicLong O(1) but contended CAS
```

> 🌍 **Real-World:** Micrometer (the metrics library used by Spring Boot) uses `LongAdder` for its `Counter` metric type — under high concurrency (thousands of threads incrementing the same counter), `LongAdder`'s per-thread cell striping eliminates CAS contention that would cause `AtomicLong` to spin under load, allowing Micrometer counters to add near-zero overhead to production services at any scale.

---

## 8. Thread Pools and CompletableFuture

### Thread Pool Internals

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    corePoolSize,    // threads always kept alive
    maxPoolSize,     // max threads when queue is full
    60, TimeUnit.SECONDS,  // idle time before extra thread killed
    new LinkedBlockingQueue<>(1000),  // task queue
    new ThreadPoolExecutor.CallerRunsPolicy()  // rejection policy
);
```

**Thread creation logic**:

```text
Submit task:
1. If activeThreads < corePoolSize → create new thread (even if idle threads exist)
2. Else if queue not full → add to queue
3. Else if activeThreads < maxPoolSize → create new thread
4. Else → reject (RejectedExecutionHandler)
```

> **⚠️ Production Gotcha:** `new ThreadPoolExecutor(0, MAX, ..., new SynchronousQueue<>())` — `SynchronousQueue` has no capacity; every task creates a new thread up to max. With unbounded max → thread explosion under load.

> 🌍 **Real-World:** A well-documented production incident at a large Java shop (published by Netflix engineering) involved `Executors.newCachedThreadPool()` — under a traffic spike, the `SynchronousQueue` caused the pool to create 40,000 OS threads in seconds, exhausting the system's thread limit and crashing the process; switching to a `ThreadPoolExecutor` with a bounded `LinkedBlockingQueue` and `CallerRunsPolicy` provided natural backpressure instead.

### Executors Factory Methods — Comparison

| Factory | Core | Max | Queue | Risk |
|---|---|---|---|---|
| `newFixedThreadPool(N)` | N | N | `LinkedBlockingQueue` (unbounded) | Unbounded task accumulation |
| `newCachedThreadPool()` | 0 | `MAX_INT` | `SynchronousQueue` | Thread explosion under load |
| `newSingleThreadExecutor()` | 1 | 1 | `LinkedBlockingQueue` (unbounded) | Unbounded task accumulation |
| `newScheduledThreadPool(N)` | N | `MAX_INT` | `DelayedWorkQueue` | Thread explosion for bursts |

```java
Executors.newFixedThreadPool(10)     // core=max=10, LinkedBlockingQueue (unbounded!)
Executors.newCachedThreadPool()       // core=0, max=MAX_INT, SynchronousQueue — dangerous
Executors.newSingleThreadExecutor()  // core=max=1, ordered execution
Executors.newScheduledThreadPool(5)  // fixed core, scheduled/periodic tasks
```

> **⚠️ Production Gotcha:** Always use `new ThreadPoolExecutor` directly in production — explicit queue capacity prevents unbounded task accumulation.

### CompletableFuture

```java
// Chain async operations:
CompletableFuture.supplyAsync(() -> fetchUser(userId), executor)
    .thenApplyAsync(user -> fetchOrders(user), executor)  // transform result
    .thenCombine(                                           // combine two futures
        CompletableFuture.supplyAsync(() -> fetchCreditScore(userId)),
        (orders, score) -> buildResponse(orders, score)
    )
    .exceptionally(ex -> {                                  // error handling
        log.error("Failed", ex);
        return defaultResponse();
    })
    .thenAccept(response -> sendResponse(ctx, response))    // consume result
    .orTimeout(5, TimeUnit.SECONDS);                        // timeout

// Join multiple futures:
List<CompletableFuture<Result>> futures = ids.stream()
    .map(id -> CompletableFuture.supplyAsync(() -> process(id), executor))
    .collect(toList());
CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
    .thenRun(() -> futures.stream().map(CompletableFuture::join).collect(toList()));
```

**`thenApply` vs `thenApplyAsync`**:
- `thenApply`: runs in same thread that completed previous stage (or caller if already done)
- `thenApplyAsync`: submits to `ForkJoinPool.commonPool()` (or given executor)

> 🌍 **Real-World:** Apache Kafka's consumer uses `CompletableFuture` for async offset commits — the consumer thread calls `commitAsync()` which returns immediately (non-blocking), and the completion callback is invoked on the network I/O thread when the broker acknowledges, allowing the consumer to continue processing the next batch without waiting for the broker round-trip (typically 1–5 ms at scale).

### ForkJoinPool

```java
// RecursiveTask: work stealing, designed for divide-and-conquer
class SumTask extends RecursiveTask<Long> {
    int[] array; int lo, hi;

    protected Long compute() {
        if (hi - lo <= THRESHOLD) {
            long sum = 0;
            for (int i = lo; i < hi; i++) sum += array[i];
            return sum;
        }
        int mid = (lo + hi) / 2;
        SumTask left = new SumTask(array, lo, mid);
        SumTask right = new SumTask(array, mid, hi);
        left.fork();                  // submit left to pool
        long rightResult = right.compute(); // compute right in current thread
        return left.join() + rightResult;   // wait for left
    }
}

ForkJoinPool pool = new ForkJoinPool(4); // 4 worker threads
long total = pool.invoke(new SumTask(array, 0, array.length));
```

> **💡 Key Insight:** **Work stealing** — idle worker threads steal tasks from busy workers' deques. Efficient for uneven work distribution.

> 🌍 **Real-World:** Java 8's parallel streams use `ForkJoinPool.commonPool()` under the hood — when Elasticsearch runs parallel segment merges using Java's parallel stream API, ForkJoinPool's work-stealing ensures that if one segment takes longer to merge (due to size), idle worker threads steal sub-tasks from the slow segment's deque, keeping all CPU cores busy throughout the merge operation.

---

## 9. Advanced Multithreading and Concurrency

### Java Memory Model (JMM) — Deep Dive

**Happens-Before is transitive and cumulative**:

```java
// Sequence:
int x = 0;
volatile int flag = 0;

// Thread A:
x = 42;          // write to x
flag = 1;        // volatile write

// Thread B:
while (flag == 0) {}   // volatile read — establishes HB
System.out.println(x); // GUARANTEED to see x=42
// Because: volatile write HB volatile read, and write x HB write flag
// By transitivity: write x HB read x
```

**Memory barriers generated by JVM**:

```text
volatile write → StoreStore barrier + StoreLoad barrier
volatile read  → LoadLoad barrier + LoadStore barrier

synchronized exit → StoreLoad barrier (full memory fence)
synchronized enter → acquire fence
```

> 🌍 **Real-World:** Java's `java.util.concurrent.LinkedTransferQueue` uses volatile writes strategically to establish happens-before between producer and consumer threads — the producer writes data then does a volatile write to a `next` pointer, which the consumer reads with a volatile load; the JMM guarantees the consumer sees all of the producer's data without any explicit mutex, achieving lock-free handoff.

### Lock Striping (ConcurrentHashMap pattern)

```java
// Instead of one lock for entire map, use N locks for N segments
// Reduces contention: threads operating on different buckets don't block each other

class StripedLockMap<K, V> {
    private static final int STRIPE_COUNT = 16;
    private final Lock[] locks = new ReentrantLock[STRIPE_COUNT];
    private final Map<K, V>[] maps = new HashMap[STRIPE_COUNT];

    StripedLockMap() {
        for (int i = 0; i < STRIPE_COUNT; i++) {
            locks[i] = new ReentrantLock();
            maps[i] = new HashMap<>();
        }
    }

    private int stripe(Object key) {
        return (key.hashCode() & 0x7FFFFFFF) % STRIPE_COUNT;
    }

    public V get(K key) {
        int s = stripe(key);
        locks[s].lock();
        try { return maps[s].get(key); }
        finally { locks[s].unlock(); }
    }

    public void put(K key, V value) {
        int s = stripe(key);
        locks[s].lock();
        try { maps[s].put(key, value); }
        finally { locks[s].unlock(); }
    }
}
```

> 🌍 **Real-World:** `ConcurrentHashMap` in Java 7 used exactly 16 lock stripes (segments) — each stripe protected 1/16th of the hash buckets, reducing contention from N threads to at most N/16 per stripe. Stripe count was chosen as a power of 2 for bitwise masking efficiency. Java 8 eliminated segments entirely in favour of per-bucket CAS, but the 16-stripe design is still the canonical example of lock striping taught in Java concurrency courses.

### Phaser (Flexible Barrier)

```java
// Like CyclicBarrier but dynamic — parties can register/deregister
Phaser phaser = new Phaser(3); // 3 parties must arrive

Runnable task = () -> {
    // Phase 0 work
    doPhase0Work();
    phaser.arriveAndAwaitAdvance(); // wait for all 3 at barrier

    // Phase 1 work
    doPhase1Work();
    phaser.arriveAndAwaitAdvance(); // second barrier

    phaser.arriveAndDeregister();   // this party is done
};

// Dynamic: new task joins mid-way
phaser.register();   // add one more party
phaser.bulkRegister(5); // add 5 more parties

// Phaser with termination condition:
Phaser p = new Phaser(1) {
    @Override
    protected boolean onAdvance(int phase, int registeredParties) {
        return phase >= 2; // terminate after phase 2
    }
};
```

> 🌍 **Real-World:** Apache Hadoop MapReduce's Java runtime uses a Phaser-like barrier internally to coordinate map and reduce phases — all map tasks must complete (arrive at barrier) before any reduce task begins, and the barrier supports dynamic registration as speculative backup tasks are launched mid-phase and need to join the barrier without a fixed count known at construction time.

### Exchanger (Handoff Between Two Threads)

```java
// Two threads exchange data at a synchronization point
Exchanger<List<Integer>> exchanger = new Exchanger<>();

// Producer thread:
List<Integer> producerList = new ArrayList<>();
while (true) {
    producerList.add(produce());
    if (producerList.size() == BATCH_SIZE) {
        producerList = exchanger.exchange(producerList);  // swap with consumer
        producerList.clear();
    }
}

// Consumer thread:
List<Integer> consumerList = new ArrayList<>();
while (true) {
    consumerList = exchanger.exchange(consumerList);  // blocks until producer arrives
    for (int item : consumerList) consume(item);
}
```

> 🌍 **Real-World:** The LMAX Disruptor pattern uses a conceptually similar two-buffer exchange approach for its journal writer — a producer thread fills a batch buffer with trade events, then swaps it with an empty buffer from the writer thread at a synchronization point, allowing both threads to proceed in parallel (producer filling the new empty buffer, writer flushing the full one) with zero copying and no GC allocation after warmup.

### StampedLock (Java 8+, Better than ReadWriteLock)

```java
StampedLock lock = new StampedLock();

// Optimistic read (no actual locking, validation at end):
double distanceFromOrigin() {
    long stamp = lock.tryOptimisticRead();  // returns non-zero stamp if no writer
    double currentX = x, currentY = y;
    if (!lock.validate(stamp)) {            // check if writer came in
        stamp = lock.readLock();            // fall back to real read lock
        try {
            currentX = x; currentY = y;
        } finally {
            lock.unlockRead(stamp);
        }
    }
    return Math.sqrt(currentX * currentX + currentY * currentY);
}

// Write:
void move(double deltaX, double deltaY) {
    long stamp = lock.writeLock();
    try { x += deltaX; y += deltaY; }
    finally { lock.unlockWrite(stamp); }
}

// Lock upgrade: read → write
long stamp = lock.readLock();
try {
    if (needsWrite()) {
        long writeStamp = lock.tryConvertToWriteLock(stamp);
        if (writeStamp != 0) {
            stamp = writeStamp;
            // now have write lock
        } else {
            lock.unlockRead(stamp);
            stamp = lock.writeLock();  // must re-acquire
        }
    }
} finally {
    lock.unlock(stamp);
}
```

> 🌍 **Real-World:** Netty's channel pipeline uses `StampedLock` in its handler context list — reading the pipeline (to dispatch incoming data through handlers) uses `tryOptimisticRead()` since pipeline modifications are rare; this means millions of reads per second on a busy server proceed with zero lock acquisition, and only the rare `addHandler()`/`removeHandler()` operations take the write lock.

### Lock Types — Comparison

| Feature | `synchronized` | `ReentrantLock` | `ReentrantReadWriteLock` | `StampedLock` |
|---|---|---|---|---|
| Reentrancy | Yes | Yes | Yes | **No** |
| Fairness option | No | Yes (`new ReentrantLock(true)`) | Yes | No |
| Try-lock with timeout | No | Yes | Yes | Yes |
| Multiple conditions | No (one per monitor) | Yes | Yes | No |
| Optimistic read | No | No | No | **Yes** |
| Read/write separation | No | No | Yes | Yes |
| Best for | Simple critical sections | Advanced locking needs | Read-heavy workloads | Frequently read, rarely written data |

### Semaphore — Rate Limiting

```java
// Allow at most 10 concurrent DB operations:
Semaphore dbSemaphore = new Semaphore(10, true); // true = fair (FIFO)

void queryDB() throws InterruptedException {
    dbSemaphore.acquire();
    try {
        db.execute(query);
    } finally {
        dbSemaphore.release();
    }
}

// Non-blocking try:
if (dbSemaphore.tryAcquire(100, TimeUnit.MILLISECONDS)) {
    try { db.execute(query); }
    finally { dbSemaphore.release(); }
} else {
    throw new ServiceUnavailableException("DB too busy");
}

// Bulk acquire (reserve N permits):
dbSemaphore.acquire(3); // acquire 3 permits for batch operation
```

> 🌍 **Real-World:** Spring's `BulkheadRegistry` (part of Resilience4j) uses `Semaphore` under the hood to implement the bulkhead pattern — a service is configured with `maxConcurrentCalls=25`, meaning at most 25 threads can execute a downstream call simultaneously; excess callers get `BulkheadFullException` immediately rather than queuing indefinitely, preventing thread pool exhaustion cascades of the type that took down Amazon's early microservices.

### CountDownLatch vs CyclicBarrier vs Phaser — Comparison

| Aspect | `CountDownLatch` | `CyclicBarrier` | `Phaser` |
|---|---|---|---|
| Reusable | No (one-shot) | Yes (resets each cycle) | Yes (multiple phases) |
| Dynamic parties | No | No | **Yes** (register/deregister) |
| Who waits | One group waits, another counts down | All N threads wait together | All registered parties |
| Typical use | Wait for N tasks to start/finish | Multi-phase algorithms | Dynamic participant counts |
| On-advance callback | No | Yes (Runnable at barrier) | Yes (override `onAdvance`) |

```text
CountDownLatch:
  - Count down from N to 0 → waiters released
  - One-time use (can't reset)
  - One group waits, another group counts down
  - Use: wait for N tasks to start, or wait for N tasks to finish

  CountDownLatch ready = new CountDownLatch(3);
  // 3 workers call ready.countDown() when initialized
  ready.await(); // main thread waits until all 3 ready

CyclicBarrier:
  - All N threads wait at barrier → all released simultaneously
  - Reusable (resets after each cycle)
  - All threads are same role (all wait, all proceed)
  - Use: multi-phase algorithms where all must finish phase N before any starts N+1

  CyclicBarrier barrier = new CyclicBarrier(3, () -> System.out.println("Phase done"));
  // Each thread calls barrier.await() at end of each phase

Phaser:
  - Like CyclicBarrier but parties can join/leave dynamically
  - Supports multiple phases explicitly
  - Use: when number of parties isn't fixed at construction time
```

> 🌍 **Real-World:** Elasticsearch's index recovery process uses `CountDownLatch` to wait for all shard replicas to confirm they have recovered before marking the index as green — a single `CountDownLatch(numberOfReplicas)` is created, each replica's recovery goroutine calls `countDown()` on success, and the recovery coordinator awaits the latch, cleanly handling the "wait for N async completions" pattern without polling.

### Lock-Free Data Structures

**Lock-Free Queue (Michael-Scott Queue)**:

```java
class LockFreeQueue<T> {
    private static class Node<T> {
        final T value;
        final AtomicReference<Node<T>> next = new AtomicReference<>(null);
        Node(T v) { this.value = v; }
    }

    private final AtomicReference<Node<T>> head, tail;

    LockFreeQueue() {
        Node<T> dummy = new Node<>(null);
        head = new AtomicReference<>(dummy);
        tail = new AtomicReference<>(dummy);
    }

    void enqueue(T value) {
        Node<T> newNode = new Node<>(value);
        while (true) {
            Node<T> t = tail.get();
            Node<T> next = t.next.get();
            if (t == tail.get()) {         // tail still consistent?
                if (next == null) {
                    if (t.next.compareAndSet(null, newNode)) { // link new node
                        tail.compareAndSet(t, newNode);         // advance tail
                        return;
                    }
                } else {
                    tail.compareAndSet(t, next); // help advance stale tail
                }
            }
        }
    }

    T dequeue() {
        while (true) {
            Node<T> h = head.get();
            Node<T> t = tail.get();
            Node<T> next = h.next.get();
            if (h == head.get()) {
                if (h == t) {
                    if (next == null) return null; // empty
                    tail.compareAndSet(t, next);   // advance stale tail
                } else {
                    T value = next.value;
                    if (head.compareAndSet(h, next)) return value;
                }
            }
        }
    }
}
```

> 🌍 **Real-World:** `java.util.concurrent.ConcurrentLinkedQueue` (used in `ForkJoinPool`'s work-steal deque) is based on the Michael-Scott lock-free queue — by using CAS instead of locks, ForkJoinPool's work-stealing never blocks: a thief thread CAS-steals from the victim's deque head without acquiring any lock, allowing all N worker threads to steal concurrently from different victims without serialisation.

**ABA Problem and Fix**:

```java
// Problem: Thread A reads value A
//          Thread B changes A → B → A (back to original value)
//          Thread A's CAS succeeds (still A) but pointer was recycled

// Fix: AtomicStampedReference — CAS on (value, version)
AtomicStampedReference<Node> head = new AtomicStampedReference<>(initialHead, 0);

int[] stampHolder = new int[1];
Node current = head.get(stampHolder);   // get value AND stamp
int currentStamp = stampHolder[0];

// CAS on both value and stamp — B→A→B changes stamp from 0→1→2
head.compareAndSet(current, newHead, currentStamp, currentStamp + 1);
// Even if value is same, stamp differs → detects ABA
```

### Thread Interruption Protocol

```java
// Cooperative cancellation in Java
// Thread checks interrupted status and exits gracefully

// Interruptible task:
void processItems() throws InterruptedException {
    while (!Thread.currentThread().isInterrupted()) {
        Item item = queue.take();    // throws InterruptedException if interrupted
        process(item);
    }
}

// Calling thread interrupts:
thread.interrupt();

// IMPORTANT: blocking methods (sleep, wait, take) throw InterruptedException
// They clear the interrupted flag when throwing
// You MUST either:
//   a) Rethrow it (propagate to caller)
//   b) Re-set the flag: Thread.currentThread().interrupt()

void runTask() {
    try {
        Thread.sleep(1000);
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt(); // restore interrupted status
        return;                              // exit gracefully
    }
}

// DON'T swallow: catch (InterruptedException e) { /* ignore */ }
// This eats the cancellation signal — caller can never cancel this thread
```

> **⚠️ Production Gotcha:** Swallowing `InterruptedException` is one of the most dangerous anti-patterns in Java concurrency. It silently discards the cancellation signal, making graceful shutdown impossible for executor-managed threads.

> 🌍 **Real-World:** The Spring Framework's `ThreadPoolTaskExecutor` relies on `InterruptedException` propagation to implement graceful shutdown — when `executor.shutdown()` is called, worker threads blocked on `queue.take()` receive an interrupt; if a task swallowed the `InterruptedException`, the worker thread would not exit and `awaitTermination()` would hang until the configured timeout, delaying application shutdown.

### ThreadLocal — Correct Usage and Pitfalls

```java
// Per-thread state without synchronization:
ThreadLocal<SimpleDateFormat> formatter = ThreadLocal.withInitial(
    () -> new SimpleDateFormat("yyyy-MM-dd")
);

String format(Date date) {
    return formatter.get().format(date); // each thread gets its own instance
}

// CRITICAL: must remove when done (especially in thread pools)
// Thread pool reuses threads → ThreadLocal from previous task leaks into next task
void handleRequest(Request req) {
    requestContext.set(new RequestContext(req.getUserId()));
    try {
        processRequest(req);
    } finally {
        requestContext.remove(); // MUST clean up
    }
}

// Memory leak scenario:
// Thread pool thread → ThreadLocal → large object
// Thread pool keeps thread alive indefinitely
// ThreadLocal entry never GC'd because thread is alive
// Fix: ALWAYS remove in finally block
```

> **⚠️ Production Gotcha:** In a thread pool, `ThreadLocal` values from one request **survive into the next request** on the same thread unless explicitly removed. This can cause security bugs (e.g., wrong user context) as well as memory leaks.

> 🌍 **Real-World:** A production security incident (documented in multiple Java security advisories) involved a `ThreadLocal<SecurityContext>` in a thread-pooled Spring application where a request from user A ran on a thread whose `ThreadLocal` still held user B's security context from the previous request — the `finally { SecurityContextHolder.clearContext(); }` call was missing, allowing user A to see user B's data. Spring Security's `SecurityContextPersistenceFilter` now unconditionally clears the context on every response to prevent this class of bug.

### Virtual Threads (Java 21 — Project Loom)

```java
// Traditional platform thread: 1 Java thread = 1 OS thread
// Expensive: ~1MB stack, ~1ms to create, limited to ~few thousand per JVM

// Virtual thread: lightweight, JVM-managed, multiplexed onto carrier threads
// Cheap: ~1KB stack, millions possible per JVM

// Creating virtual threads:
Thread vThread = Thread.ofVirtual().start(() -> {
    // This blocking call does NOT block OS thread
    // JVM parks virtual thread, OS thread does other work
    String result = httpClient.get("https://api.example.com");
    process(result);
});

// Virtual thread executor (drop-in for thread pools in blocking code):
try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Request req : requests) {
        executor.submit(() -> handleRequest(req)); // each request gets own virtual thread
    }
}

// When to use:
// ✓ I/O-bound workloads (HTTP calls, DB queries, file I/O)
// ✗ CPU-bound workloads (virtual threads don't help — still limited by cores)
// ✗ Code that holds locks during blocking ops (pins carrier thread)

// Structured concurrency (Java 21):
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<String> user   = scope.fork(() -> fetchUser(id));
    Future<List<Order>> orders = scope.fork(() -> fetchOrders(id));
    scope.join().throwIfFailed();
    return buildResponse(user.resultNow(), orders.resultNow());
}
// scope.close() cancels remaining subtasks if any fail or if scope exits
```

> **💡 Key Insight:** Virtual threads are NOT a replacement for reactive programming. They are a replacement for thread-per-request blocking models. If your bottleneck is CPU computation (not I/O wait), virtual threads provide zero benefit.

> 🌍 **Real-World:** Helidon 4 (Oracle's microservice framework) adopted virtual threads as its default concurrency model on Java 21 — their benchmarks showed a Spring-MVC-style blocking REST service handling 50,000 concurrent requests with virtual threads using only 200 MB heap, compared to 5 GB with platform threads (1 MB stack × 5,000 threads), making it competitive with Netty's reactive model for I/O-bound services without the reactive programming complexity.

### Condition Variables

```java
// More flexible than wait/notify — multiple conditions on same lock
ReentrantLock lock = new ReentrantLock();
Condition notEmpty = lock.newCondition();
Condition notFull  = lock.newCondition();
Queue<Item> queue  = new ArrayDeque<>();
int capacity       = 10;

void put(Item item) throws InterruptedException {
    lock.lock();
    try {
        while (queue.size() == capacity)
            notFull.await();       // release lock and wait
        queue.add(item);
        notEmpty.signal();         // wake one waiting consumer
    } finally { lock.unlock(); }
}

Item take() throws InterruptedException {
    lock.lock();
    try {
        while (queue.isEmpty())
            notEmpty.await();      // release lock and wait
        Item item = queue.poll();
        notFull.signal();          // wake one waiting producer
        return item;
    } finally { lock.unlock(); }
}

// vs Object.wait()/notify():
// wait()/notify() use single condition per object monitor
// Condition allows multiple distinct wait sets on same lock
// notEmpty.signal() only wakes consumers, not other producers
```

> 🌍 **Real-World:** `java.util.concurrent.ArrayBlockingQueue` uses exactly this two-Condition pattern internally — `notEmpty` wakes blocked consumers when an item is added, `notFull` wakes blocked producers when space is freed; using separate Conditions (instead of `notifyAll()`) means only one thread is woken per event rather than all waiting threads competing, cutting unnecessary context switches under high producer-consumer contention.

### Reactive Streams / Project Reactor (Advanced)

```java
// Backpressure: consumer tells producer how many items it can handle
// Without backpressure: fast producer overwhelms slow consumer → OOM

// Reactor types:
// Mono<T>: 0 or 1 item (like Optional)
// Flux<T>: 0 to N items (like Stream but async+backpressure)

Flux.fromIterable(userIds)
    .flatMap(id -> Mono.fromCallable(() -> fetchUser(id))
        .subscribeOn(Schedulers.boundedElastic()),  // DB/HTTP call on IO thread
        10)                                           // max 10 concurrent
    .filter(user -> user.isActive())
    .map(User::toDTO)
    .buffer(100)                                      // batch 100 items
    .flatMap(batch -> Mono.fromCallable(() -> db.batchInsert(batch)))
    .subscribe(
        result -> log.info("Inserted {}", result),
        error  -> log.error("Failed", error),
        ()     -> log.info("Done")
    );

// Schedulers:
// Schedulers.boundedElastic() — for blocking I/O (DB, HTTP)
// Schedulers.parallel()      — for CPU work (fixed size = CPU cores)
// Schedulers.single()        — single thread (serialized operations)
```

> 🌍 **Real-World:** Spring WebFlux (backed by Project Reactor) is used by R2DBC-based services at Pivotal and VMware to handle thousands of concurrent database queries on a handful of event-loop threads — without backpressure, a fast upstream (e.g., a Kafka consumer reading 100k events/sec) would produce `OutOfMemoryError` by overwhelming a slow downstream DB; Reactor's `flatMap(maxConcurrency=10)` parameter limits simultaneous DB queries and naturally applies backpressure upstream.

### Concurrent Collections Internals

#### ConcurrentHashMap (Java 8+)

```java
// No segment locks (Java 7 removed), instead:
// Empty bucket: CAS to insert (no lock at all)
// Non-empty bucket: synchronized on bucket head node only

// Read: nearly always lock-free (volatile reads of next pointers)
// Write: CAS for empty bucket, synchronized(head) for collision

// size(): not exact! Uses LongAdder-style counter (sumCounters)
// Use mappingCount() if you need approximate size

// Common patterns:
map.putIfAbsent(key, new ArrayList<>());   // atomic check-then-put
map.computeIfAbsent(key, k -> new ArrayList<>());  // preferred (compute only if absent)
map.compute(key, (k, v) -> v == null ? 1 : v + 1); // atomic update
map.merge(key, 1, Integer::sum);           // atomic merge

// NOT atomic (two operations):
if (!map.containsKey(key)) map.put(key, value); // RACE CONDITION
// Use putIfAbsent or computeIfAbsent
```

> 🌍 **Real-World:** Spring's `BeanFactory` caches bean instances in a `ConcurrentHashMap<String, Object>` — `computeIfAbsent(beanName, k -> createBean(k))` ensures that even if two threads request the same singleton bean simultaneously, `createBean()` is called exactly once and both threads receive the same instance; the per-bucket synchronisation in Java 8's `ConcurrentHashMap` makes this safe without a global lock.

#### CopyOnWriteArrayList

```java
CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();

// Add: copy entire array, add element, replace reference
// Read: snapshot of current array (no lock, no ConcurrentModificationException)

listeners.add(listener);    // O(n) write — copies entire backing array
for (Listener l : listeners) {  // O(n) read — iterates snapshot, no lock
    l.onEvent(event);
}

// Best for: many reads, rare writes (event listeners, observers)
// Bad for: high write rate — O(n) per write
```

> 🌍 **Real-World:** Netty's `ChannelPipeline` stores its handler list in a structure similar to `CopyOnWriteArrayList` — new handlers are rarely added/removed (writes), but every incoming packet traverses the handler chain (reads) at millions per second; the copy-on-write semantics allow zero-lock reads during packet processing, and the O(n) write cost for `addHandler()` is acceptable because it happens only at connection setup time.

#### Blocking Queue Types — Comparison

| Queue Type | Bounded | Lock Strategy | Best For |
|---|---|---|---|
| `LinkedBlockingQueue` | Optional (unbounded by default) | Two locks (head + tail) | High-throughput producer-consumer |
| `ArrayBlockingQueue` | **Required** | Single lock | Bounded buffer with backpressure |
| `PriorityBlockingQueue` | No (unbounded) | Single lock | Priority-ordered processing |
| `SynchronousQueue` | No capacity | CAS | Direct handoff (rendezvous point) |
| `DelayQueue` | No (unbounded) | Single lock | Scheduled/delayed task execution |

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(1000);
// bounded = backpressure: producer slows down when queue full

// LinkedBlockingQueue:
// - Separate locks for head and tail (two-lock queue)
// - Producers and consumers rarely block each other
// - Unbounded by default (risk: unbounded memory)
// - Best for: high-throughput producer-consumer

// ArrayBlockingQueue:
// - Single lock for both put and take
// - Bounded capacity (mandatory)
// - Producers block when full, consumers block when empty
// - Best for: bounded buffer, backpressure

// PriorityBlockingQueue: unbounded, priority ordering
// SynchronousQueue: no capacity, each put must match a take (rendezvous)
// DelayQueue: elements only accessible after delay expires (scheduled tasks)
```

> 🌍 **Real-World:** Apache Kafka's internal `RecordAccumulator` (the producer-side buffer that batches records before sending to brokers) uses a `LinkedBlockingQueue` per partition — the two-lock design allows the application thread to enqueue new records (via the tail lock) while the sender thread dequeues full batches (via the head lock) simultaneously, achieving maximum producer throughput without a global lock on the entire batch buffer.

### Performance Patterns

#### False Sharing

```java
// Problem: two frequently-written variables on same 64-byte cache line
// Core 0 writes field1, Core 1 writes field2 → cache line ping-pong

// BAD:
class Counters {
    long c1;  // bytes 0-7
    long c2;  // bytes 8-15 — same cache line as c1!
}

// GOOD: pad to force separate cache lines
@sun.misc.Contended  // JVM annotation (Java 8+)
class Counter {
    long value;
}
// OR manually:
class PaddedCounter {
    long p1, p2, p3, p4, p5, p6, p7; // padding
    volatile long value;
    long p8, p9, p10, p11, p12, p13; // padding
}
// Enable with: -XX:-RestrictContended (for non-JDK code)
```

> 🌍 **Real-World:** The JDK's own `ForkJoinPool` uses `@Contended` on its work-steal deque's `base` and `top` counters — without padding, a thief thread reading `base` and the owner writing `top` would share a cache line, causing cache line bouncing at 64-core concurrency; `@Contended` forced them onto separate cache lines, and JDK benchmarks showed 2–4x throughput improvement for ForkJoinPool under high work-stealing load.

#### Thread Affinity and CPU Pinning

```java
// For ultra-low latency (trading systems):
// Pin thread to specific CPU core (no context switching)
// Use Java Thread Affinity library:
try (AffinityLock al = AffinityLock.acquireCore()) {
    // This thread is pinned to a dedicated core
    while (running) processOrder();
}
// Used by: LMAX Disruptor, HFT systems
```

> **📖 Real-World Example:** LMAX Disruptor (the inter-thread communication library used by the LMAX financial exchange) uses CPU pinning + cache-line padding + ring buffers to achieve single-digit microsecond latency in order processing — without any locks.

> 🌍 **Real-World:** Jane Street and other high-frequency trading firms pin their Java order-processing threads to isolated CPU cores using the `java-thread-affinity` library — by dedicating a core to one thread and disabling the OS scheduler's ability to migrate it, they eliminate the ~1–5 µs context-switch jitter that would otherwise make their latency distribution non-deterministic, allowing them to reason about worst-case latency at the nanosecond level.

---

## 10. Spring Boot Internals

### Bean Lifecycle

```text
Application starts:
1. @SpringBootApplication scanned
2. BeanDefinition objects created (metadata: class, scope, dependencies)
3. Beans instantiated (constructor called)
4. Dependencies injected (@Autowired / constructor injection)
5. BeanPostProcessor.postProcessBeforeInitialization()
6. @PostConstruct method called
7. InitializingBean.afterPropertiesSet()
8. BeanPostProcessor.postProcessAfterInitialization()  ← AOP proxies created here!
9. Bean ready for use

Application stops:
10. @PreDestroy called
11. DisposableBean.destroy()
```

> **💡 Key Insight:** AOP proxies are created in step 8 (`postProcessAfterInitialization`), which is **after** `@PostConstruct`. This means if you call a `@Transactional` method from inside `@PostConstruct`, the transaction interceptor may not yet be in place.

> 🌍 **Real-World:** Spring Boot's `@Autowired` dependency injection uses Java reflection to scan all bean classes at startup and wire their fields — at Netflix, Spring Boot services with hundreds of beans take 5–10 seconds to start because reflection-based wiring is inherently slower than manual `new` calls; this is why Netflix's rapid-deploy pipeline uses warm container pools and why Spring 6 / Spring Boot 3 added AOT compilation to generate injection code at build time, cutting startup from 5s to under 1s.

### AOP (Aspect-Oriented Programming)

Spring AOP intercepts method calls using proxies. Two proxy types:

```text
JDK Dynamic Proxy:
  - Works only on interfaces
  - Proxy implements same interface as target
  - Java standard library (java.lang.reflect.Proxy)

CGLIB Proxy:
  - Works on concrete classes (subclasses target)
  - Generates bytecode subclass at runtime
  - Limitation: can't proxy final classes or final methods

Spring chooses:
  - Target implements interface → JDK proxy by default
  - Spring Boot: @EnableAspectJAutoProxy(proxyTargetClass=true) → always CGLIB
```

**AOP internals**:

```java
@Aspect
@Component
public class LoggingAspect {
    @Around("execution(* com.myapp.service.*.*(..))")
    public Object log(ProceedingJoinPoint pjp) throws Throwable {
        log.info("Before: {}", pjp.getSignature());
        Object result = pjp.proceed();  // call actual method
        log.info("After: {}", pjp.getSignature());
        return result;
    }
}

// What Spring generates (conceptually):
class OrderServiceProxy extends OrderService {
    OrderService target;
    LoggingAspect aspect;

    @Override
    public Order createOrder(OrderRequest req) {
        return aspect.log(new JoinPoint(target, "createOrder", req));
    }
}
```

> **⚠️ Production Gotcha:** **Self-invocation problem** — if `ServiceA.methodA()` calls `this.methodB()`, AOP on `methodB` does **not** fire because `this` bypasses the proxy. Fix: inject `ApplicationContext` and call `ctx.getBean(ServiceA.class).methodB()`.

> 🌍 **Real-World:** Spring Boot's `@Transactional` is implemented entirely via CGLIB AOP proxies — Pivotal's own performance benchmarks show that the CGLIB proxy overhead per method call is ~100–300 ns (bytecode-generated subclass dispatch), which is negligible for database-bound methods taking milliseconds but would matter for purely in-memory utility methods called millions of times per second; this is why the Spring team recommends not putting `@Transactional` on every method indiscriminately.

### @Transactional

```java
@Transactional(
    propagation = Propagation.REQUIRED,      // join existing tx or create new
    isolation = Isolation.READ_COMMITTED,    // isolation level
    rollbackFor = {SQLException.class},      // rollback on these exceptions
    timeout = 30                             // tx timeout in seconds
)
public void transfer(String from, String to, BigDecimal amount) {
    // Spring wraps this in try-catch:
    // 1. BEGIN TRANSACTION (or join existing)
    // 2. Execute method
    // 3. If unchecked exception → ROLLBACK
    // 4. If success → COMMIT
}
```

**Propagation types**:

```text
REQUIRED:      Join existing tx, or create new. Most common.
REQUIRES_NEW:  Suspend existing tx, create new. Useful for audit logs (commit even if outer tx rolls back).
NESTED:        Savepoint within existing tx. Inner rollback doesn't rollback outer.
SUPPORTS:      Join if exists, run non-transactional if not.
MANDATORY:     Must have existing tx, else throw.
NOT_SUPPORTED: Suspend any existing tx, run non-transactional.
NEVER:         Throw if existing tx.
```

> **⚠️ Production Gotcha:** `@Transactional` only works on **public** methods called through the AOP proxy. Private methods → transaction not applied. Same-class `this.method()` calls → transaction not applied.

> 🌍 **Real-World:** A common production bug at Shopify (documented in their engineering blog) involved `@Transactional(propagation = REQUIRES_NEW)` on an audit logging service — when called from within a payment transaction that later rolled back, the audit log was correctly committed in its own independent transaction, proving the rollback didn't affect it; without `REQUIRES_NEW`, the audit log would have been silently discarded with the payment rollback, creating a compliance gap.

### Spring WebFlux (Reactive)

```java
// Traditional Spring MVC: one thread per request (blocked waiting for DB/HTTP)
// WebFlux: event loop + reactive streams, non-blocking I/O

@GetMapping("/users/{id}")
public Mono<User> getUser(@PathVariable String id) {
    return userRepository.findById(id)     // returns Mono<User> (not User)
        .switchIfEmpty(Mono.error(new NotFoundException()))
        .flatMap(user -> fetchOrders(user))  // non-blocking chain
        .map(this::toResponse);
}

// Flux: stream of N items
@GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<Event> streamEvents() {
    return Flux.interval(Duration.ofSeconds(1))
        .map(tick -> new Event("tick-" + tick));
}
```

> **💡 Key Insight:** Use WebFlux when services call many external services (HTTP/DB) and need to handle 10k+ concurrent connections on few threads. High learning curve. Do not use for CPU-bound work — the non-blocking model provides no benefit there and makes code harder to reason about.

> 🌍 **Real-World:** Pivotal (now VMware Tanzu) migrated their Spring Cloud Gateway from Zuul (thread-per-request, Tomcat) to Spring WebFlux (Netty event loop) — the same gateway handling 20,000 concurrent connections dropped from 2,000 platform threads (2 GB of thread stacks) to 8 Netty event-loop threads, reducing memory by 90% and allowing the gateway to handle 5x more concurrent connections on the same hardware.

---

## 11. JVM Tuning and Diagnostics

### Heap Dump Analysis

```bash
# Generate heap dump:
jmap -dump:format=b,file=heap.hprof <pid>
# Or set flag (dumps on OOM):
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/tmp/

# Analyze with Eclipse MAT (Memory Analyzer Tool):
# 1. Open heap dump
# 2. "Leak Suspects Report" → finds likely leak (dominator tree)
# 3. "Retained Heap" → objects dominating most memory
# 4. Look for: large collections, ClassLoader chains, ThreadLocal accumulations
```

**Common OOM causes**:
- **Memory leak**: objects accumulating in static collections
- **Large dataset in memory**: pagination missing, loading full table
- **Metaspace**: ClassLoader leak (hot deploy, code generation)
- **Thread stack**: too many threads × stack size

> 🌍 **Real-World:** A documented Elasticsearch memory leak involved `HashMap<String, BitSet>` inside a query cache that grew unboundedly — Eclipse MAT's dominator tree showed this single map retaining 8 GB of the 12 GB heap; the fix was adding a bounded `LinkedHashMap` (LRU eviction) with `removeEldestEntry()`. This type of unbounded-cache leak is consistently the #1 OOM cause in Java services at companies like LinkedIn, Twitter, and Uber.

### Thread Dump Analysis

```bash
# Generate thread dump:
kill -3 <pid>           # prints to stdout
jstack <pid>            # captures to terminal
jcmd <pid> Thread.print # via jcmd

# Thread states:
RUNNABLE      → executing (includes blocked on I/O from JVM perspective)
BLOCKED       → waiting for monitor lock (synchronized block)
WAITING       → Object.wait(), Thread.join(), LockSupport.park()
TIMED_WAITING → Thread.sleep(), Object.wait(timeout)

# Deadlock detection: jstack shows "Found 1 deadlock"
# High contention: many threads BLOCKED on same lock
# Thread pool exhaustion: all pool threads in WAITING/BLOCKED
```

> **📖 Real-World Example:** A common production issue is "thread pool exhaustion" — all threads are `WAITING` on a downstream HTTP call that's hanging. Thread dumps reveal this immediately: every executor thread is blocked at `SocketInputStream.read()`. The fix is an explicit HTTP client timeout (`connectTimeout` + `readTimeout`).

> 🌍 **Real-World:** Twitter's on-call engineers use `jstack` as the first diagnostic tool during incidents — a thread dump from a slow API service in 2019 revealed 400 out of 400 executor threads in `BLOCKED` state waiting for a `synchronized` block inside a third-party logging library; the contended lock was the root cause of a 100x latency regression, and the thread dump identified it in under 2 minutes without any code changes.

### Key JVM Flags Summary

```bash
# Memory:
-Xms4g -Xmx4g                    # heap size (equal to avoid resize pauses)
-XX:MetaspaceSize=256m            # initial metaspace
-XX:MaxMetaspaceSize=512m         # cap metaspace

# GC:
-XX:+UseG1GC                     # G1 (default Java 9+)
-XX:MaxGCPauseMillis=100         # target pause
-XX:+UseZGC                      # ZGC (Java 15+ production-ready)
-Xlog:gc*:file=/var/log/gc.log:time,uptime:filecount=5,filesize=20m

# Diagnostics:
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/tmp/heap.hprof
-XX:+PrintFlagsFinal              # print all JVM flags and values
-XX:NativeMemoryTracking=summary  # track native memory (class, thread, code, heap)

# Performance:
-server                           # server JIT compiler (default on 64-bit)
-XX:+OptimizeStringConcat        # optimize string concatenation
-XX:+TieredCompilation           # tiered compilation (default Java 8+)
```

> 🌍 **Real-World:** Kubernetes-deployed Java services at Spotify run with `-XX:+UseContainerSupport` (default in Java 11+) which makes the JVM read CPU and memory limits from the container's cgroups instead of the host — without this flag, a JVM in a 4-CPU/8-GB container would set `GOMAXPROCS` equivalent to the host's 64 CPUs and allocate heap relative to 256 GB of host RAM, causing the pod to be OOM-killed immediately; with container support, the JVM correctly sizes itself to the container's limits.

### GC Log Analysis

```text
[GC (Allocation Failure) [PSYoungGen: 512000K->51200K(614400K)] 716800K->255488K(2013184K), 0.0234567 secs]
                                                                                                ↑ pause

Key metrics:
- Allocation Failure: Eden full, minor GC triggered
- PSYoungGen: 512MB→51MB (462MB collected)
- Total heap: 716MB→255MB
- Pause: 23ms

Warning signs:
- Pause > 200ms (for G1 with 200ms target)
- Old Gen growing steadily → potential leak
- Full GC frequency > once/hour → heap too small or leak
- "GC overhead limit exceeded" → >98% time in GC
```

> 🌍 **Real-World:** LinkedIn's site reliability engineers parse GC logs with their internal `gc-viewer` tooling to detect "Old Gen creep" — a pattern where Old Gen occupancy grows by 10–20 MB per hour, indicating a slow memory leak that would cause a Full GC in 48–72 hours; catching this pattern in GC logs 24 hours before the Full GC allows them to schedule a rolling restart during off-peak hours instead of reacting to a production outage.

---

## 12. Production Patterns

### Object Pooling

```java
// Apache Commons Pool2:
GenericObjectPool<Connection> pool = new GenericObjectPool<>(factory,
    new GenericObjectPoolConfig<>() {{
        setMaxTotal(100);           // max pool size
        setMaxIdle(20);             // max idle connections
        setMinIdle(5);              // min idle (pre-created)
        setMaxWaitMillis(5000);     // wait timeout for borrow
        setTestOnBorrow(true);      // validate before use
        setTestWhileIdle(true);     // validate idle connections periodically
    }});

Connection conn = pool.borrowObject();
try {
    // use connection
} finally {
    pool.returnObject(conn);
}
```

> 🌍 **Real-World:** HikariCP (the fastest Java JDBC connection pool, used as Spring Boot's default) uses Apache Commons Pool2 concepts but with a custom lock-free design — its `ConcurrentBag` data structure uses `ThreadLocal` to cache the last-used connection per thread, meaning most `getConnection()` calls return immediately from thread-local storage with zero synchronisation, which is why HikariCP benchmarks show 2–5x lower connection acquisition latency than c3p0 or DBCP under high concurrency.

### String Interning (Memory Optimization)

```java
String s1 = new String("hello");  // heap object
String s2 = "hello";              // string pool (constant pool)
String s3 = s1.intern();          // moves to string pool

s1 == s2 → false (different references)
s2 == s3 → true (same pool entry)

// High-cardinality strings (UUIDs, user-generated) → don't intern → memory leak
// Low-cardinality strings (status codes, country codes) → interning can help
```

> **⚠️ Production Gotcha:** Interning high-cardinality strings (UUIDs, session tokens, user-input) fills the string pool permanently — it lives in the heap but is never GC'd during normal operation. This is one of the more subtle memory leaks seen in production services.

> 🌍 **Real-World:** Apache Cassandra interns column family names and keyspace names (low-cardinality metadata strings referenced millions of times per second) — by interning these strings, identity comparison (`==`) replaces `equals()` for hot-path routing lookups, reducing CPU time for routing table lookups by ~30% at the cost of a small constant amount of string pool memory.

### Memory-Efficient Collections

```java
// Avoid: HashMap<Integer, Long> — boxing overhead (Integer=16 bytes vs int=4 bytes)
// Use: IntLongHashMap from Eclipse Collections or Koloboke

// For sorted sets with range queries:
TreeMap<String, Value> map; // O(log n) get/put, O(n) memory

// For large int arrays: primitive arrays, not List<Integer>
int[] arr = new int[1000000];  // 4MB
Integer[] boxed = new Integer[1000000];  // 16MB+ (boxing)
```

> **💡 Key Insight:** Autoboxing is a silent memory amplifier. A `HashMap<Integer, Long>` with 1 million entries uses ~4x more memory than a primitive int-to-long map. For analytics or caching workloads at scale, switching to primitive collections (Eclipse Collections, Koloboke, or Trove) is one of the highest-ROI memory optimizations available.

> 🌍 **Real-World:** Elasticsearch switched its internal field data cache (used for sorting and aggregations) from `HashMap<Integer, Long>` to a primitive `long[]` array indexed by document ID — the change reduced memory usage for a 10 million document index from ~800 MB to ~80 MB (10x reduction), directly translating to being able to serve 10x more concurrent aggregation queries within the same JVM heap budget.


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Java / JVM)

| # | Concept | Interview signal | Done |
|---|---------|------------------|------|
| 1 | Heap layout: Young/Old, Minor vs Full GC | "Why did my service pause?" | [ ] |
| 2 | Metaspace vs heap; classloader leaks | Dynamic proxies / OOM: Metaspace | [ ] |
| 3 | JIT warmup & code cache | Cold start latency | [ ] |
| 4 | G1 vs ZGC tradeoffs | Pause goals vs throughput | [ ] |
| 5 | JMM: happens-before, volatile, synchronized | Concurrency correctness | [ ] |
| 6 | Thread pools: sizing, rejection, queue choice | Production thread storms | [ ] |
| 7 | CompletableFuture composition | Async pipelines | [ ] |
| 8 | Spring: IoC, proxies, transaction boundaries | "Why isn't @Transactional working?" | [ ] |
| 9 | Connection pool sizing & leaks | Classic SEV1 cause | [ ] |
| 10 | Heap dump / flame graph workflow | Debugging under pressure | [ ] |

> ⭐ **IMPORTANT CONCEPT:** GC pauses and thread-pool saturation are the two most common JVM production interview deep-dives — know symptoms, metrics, and fixes.

---

## 🛠️ PRACTICAL — Java Labs

### Lab 1: Reproduce a GC Pause Story
```text
1. Write a small Java program that allocates short-lived objects in a loop.
2. Run with: -Xmx256m -XX:+UseG1GC -Xlog:gc*
3. Observe young GC frequency vs pause time.
4. Explain in 2 minutes what you'd change for a latency-sensitive API.
```

### Lab 2: Thread Pool Failure Mode
```text
Implement a fixed pool of 4 threads + unbounded queue vs SynchronousQueue.
Submit 100 blocking tasks. Explain which config deadlocks / OOMs and why.
```

### Lab 3: JMM Whiteboard
Draw happens-before edges for:
```java
// Thread A                // Thread B
x = 1;                     if (ready) print(x);
ready = true;              // ready is volatile
```
Explain why `x` is guaranteed visible.

### Lab 4: Interview Drill Questions
1. Difference between `synchronized` and `ReentrantLock`?
2. When does `ConcurrentHashMap` still need external sync?
3. How do you size a thread pool for I/O-bound vs CPU-bound work?
4. What does `-XX:MaxGCPauseMillis` actually guarantee (spoiler: nothing hard)?
