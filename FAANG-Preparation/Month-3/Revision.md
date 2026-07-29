# Final Revision — 2-Week Sprint Plan

> **Self-contained. Day-by-day schedule for the final push before interviews.**
> Goal: Consolidate, not learn new things.

---

## Table of Contents

| Section | Description |
|---------|-------------|
| [Mindset](#mindset-for-final-2-weeks) | How to approach the final sprint |
| [Week 1](#week-1--sharpen-everything) | Sharpen everything — DSA, LLD, HLD, Runtime |
| [Week 2](#week-2--simulate-and-consolidate) | Simulate and consolidate — full loops |
| [Revision Checklist](#revision-checklist) | Go/no-go checklist before the interview |
| [Key Numbers Cheat Sheet](#rapid-fire-cheat-sheet-key-numbers) | Numbers to know cold |
| [System Design Quick Pick](#system-design-quick-pick) | What to reach for in interviews |
| [Company → Tech Mapping](#real-world-company--tech-mapping) | Real-world context |

---

## Mindset for Final 2 Weeks

```text
Consolidate:  Review what you know — don't try to learn new things.
Fix gaps:     Only weak spots — don't revisit areas you've already mastered.
Simulate:     Do everything under interview conditions (timed, no hints).
Rest:         Sleep 8 hours. Cognitive performance drops ~30% with sleep deprivation.
```

---

## Week 1 — Sharpen Everything

### Day 1 (Monday) — DSA: Hard Problems

```text
Morning (2h):
  Redo 5 problems you've previously solved — internalize them:
  - One DP (interval or string)
  - One graph (Dijkstra or topological sort)
  - One tree (LCA or serialize/deserialize)
  - One binary search on answer
  - One backtracking (N-Queens or Sudoku Solver)
  Code each from scratch. No notes.

Evening (1h):
  Review the "FAANG Must-Solve List" from DSA.md.
  Mark anything you can't code cold. Add to Day 3.
```

### Day 2 (Tuesday) — LLD Mock + Pattern Review

```text
Morning (2h):
  Mock LLD interview (timer, no hints):
  Pick one: Parking Lot / Rate Limiter / LRU Cache
  Draw class diagram first (10 min), then code (30 min).

Afternoon (1h):
  Review design patterns: Strategy, Observer, Factory, Decorator.
  For each: what problem it solves (one sentence) + one example.

Evening (1h):
  Review concurrency patterns (Concurrency.md).
  ReentrantLock, CountDownLatch, Semaphore — when to use each.
```

### Day 3 (Wednesday) — HLD: System Design Deep Dive

```text
Morning (2h):
  Re-design 2 systems end-to-end without notes:
  1. Notification Service (push/email/SMS, priority queues, idempotency)
  2. Rate Limiter (token bucket, Redis implementation, sliding window)

  Use the framework: FR → NFR → Capacity → APIs → Schema → Architecture → Scaling → Failures

Afternoon (1h):
  Review these critical HLD concepts:
  - Consistent hashing (ring, virtual nodes)
  - Outbox pattern
  - Saga pattern (choreography vs orchestration)
  - Distributed locking (Redis SET NX + fencing tokens)

Evening (30 min):
  Behavioral: recite 2 STAR stories out loud. Time each to < 2.5 min.
```

### Day 4 (Thursday) — Runtime Internals

```text
Morning (1.5h):
  Java:
  - JVM memory model: heap, stack, metaspace, GC roots
  - G1GC vs ZGC: when to choose which
  - volatile, synchronized, happens-before relationship
  - Thread lifecycle, thread pool (Executors), ForkJoinPool

  Go:
  - Goroutine scheduling: GMP model (G=goroutine, M=OS thread, P=processor)
  - Channel semantics: buffered vs unbuffered, select statement
  - Escape analysis: stack vs heap allocation
  - GC: tri-color mark-and-sweep, write barrier

Afternoon (1h):
  Re-read Concurrency.md — verify you can explain each concept cold.

Evening (1h):
  Mock explanation: explain Go scheduler to an imaginary interviewer. Record yourself.
  Explain the JVM GC process. Record yourself.
  Play back — are your explanations clear without jargon?
```

### Day 5 (Friday) — Mock Interview Day

```text
Morning (2h):
  Full DSA mock (45 min × 2):
  Round 1: 1 medium + 1 hard. No hints. Strict timing.
  Round 2: 1 medium. Optimize for clean code and clear explanation.

Afternoon (1.5h):
  Full HLD mock (60 min):
  Design: Distributed Chat System (WhatsApp-scale)
  Evaluate yourself against the rubric in Mock-Interviews.md.

Evening (30 min):
  Behavioral — record yourself answering: "Tell me about a time you failed."
  Listen back. Fix vagueness. Add numbers.
```

### Day 6 (Saturday) — Full Loop Simulation

| Time | Activity |
|------|----------|
| 10:00 AM | DSA Round (45 min) — timer, no help |
| 11:00 AM | LLD Round (45 min) — system you haven't mocked before |
| 12:00 PM | Lunch break (1h) |
| 1:00 PM | HLD Round (60 min) — system you haven't mocked before |
| 2:00 PM | Behavioral Round (30 min) — 5 questions |
| 3:00 PM | Review: write down what went well, what didn't |
| Evening | Rest. No studying. |

### Day 7 (Sunday) — Fix Weak Spots

```text
Morning:
  Review your mock logs from the week.
  Identify bottom 2 areas. Spend 2h on those only.

Afternoon:
  Re-read your weakest topic from Month 1/2.
  Don't read passively — write out key points from memory first,
  then check what you missed.

Evening:
  Review behavioral stories. Read through your strongest 5.
  Replace any vague result ("went better") with a specific number.
```

---

## Week 2 — Simulate and Consolidate

### Day 8 (Monday) — HLD: 3 Systems Back-to-Back

```text
Morning (3h):
  Design each system in 45 min (no notes):
  1. URL Shortener
  2. Kafka-like Queue
  3. Distributed Scheduler

  After each: note what you missed.
  Common gaps:
  - Forgot capacity estimation?
  - Schema missing key indexes?
  - Didn't discuss failure scenarios?
```

### Day 9 (Tuesday) — DSA: Pattern Identification Speed

```text
Morning (2h):
  Pattern recognition drills:
  Read the problem statement only (2 min). Say the pattern out loud.
  Do 15 problems this way — just pattern recognition, no full solve.

  Patterns to drill:
  Sliding window · Two pointers · Binary search on answer
  BFS shortest path · DFS + memoization · Topological sort
  Monotonic stack · Union-find · DP (1D, 2D, interval, state machine)

Afternoon (1h):
  Full solve: pick the 3 hardest problems from morning. Code them.
```

### Day 10 (Wednesday) — Behavioral: Full Story Pass

```text
Morning (2h):
  For each of the 9 story categories in Behavioral.md:
  Write out your personal story in full sentences.
  Time it. Cut anything over 2.5 min.

  Quantify every result. Examples:
  "latency reduced"        → "p99 reduced from 800ms to 60ms"
  "team improved"          → "PR cycle time dropped from 3 days to 6 hours"
  "project delivered"      → "shipped 2 weeks early, unblocking 3 teams"

Afternoon (1h):
  Behavioral mock: ask yourself 5 random questions from the question mapping table.
  Answer out loud without prep time (simulates the real thing).
```

### Day 11 (Thursday) — Architecture Explanation Practice

```text
Morning (2h):
  Pick 5 systems from your notes. Explain each out loud in 5 minutes.
  Draw the architecture while explaining.

  Checklist for each explanation:
  ✓ Clear data flow (request in → response out)
  ✓ Key components named (LB, API gateway, service, DB, cache, queue)
  ✓ Why each component exists (not just what it is)
  ✓ 2–3 most important design decisions called out explicitly
  ✓ What would break at 10× scale and how you'd fix it

Afternoon (1h):
  Review the distributed systems concept you find hardest:
  Raft consensus / vector clocks / Paxos — pick one, explain from memory, then check notes.
```

### Day 12 (Friday) — Final Mock Loop

```text
Morning (2h):
  2 DSA rounds (45 min each). Grade yourself honestly.

Afternoon (1h):
  1 HLD round — use a problem you haven't practiced:
  Trading Exchange or Stock Broker Platform.

Evening (30 min):
  3 behavioral questions. Record yourself. No notes.
```

### Day 13 (Saturday) — Light Day

```text
Morning (1h):
  Review your notes summary (key concepts, not full content).
  Passive review only — no problems.

Afternoon (1h):
  Walk through your strongest STAR stories one more time.
  Review your cheat sheets:
  - Big-O reference
  - Design patterns one-liner summary
  - System design framework steps

Evening:
  Prepare logistics: test video/audio, IDE setup, whiteboard.
  Rest early. No studying after 8 PM.
```

### Day 14 (Sunday — Interview Eve)

```text
Morning:
  1 easy LeetCode problem (warmup only — something you know cold).

Afternoon:
  Review top 3 behavioral stories one final time.
  Walk through your HLD framework mentally: FR → NFR → ... → Tradeoffs.

Evening:
  Stop studying by 6 PM.
  Eat well. Sleep by 10 PM.
  No new topics. You've put in the work.
```

---

## Revision Checklist

### DSA
- [ ] Can code binary search (standard + left-bound + on-answer) from memory
- [ ] Can code Dijkstra, BFS, DFS, topological sort from memory
- [ ] Can code LRU Cache from memory
- [ ] Can code merge sort, quick sort from memory
- [ ] Can identify DP pattern from problem statement in < 2 min
- [ ] Can explain time/space complexity for every pattern in the reference sheet

### HLD
- [ ] Can walk through the design framework in < 2 min without notes
- [ ] Can estimate QPS, storage, bandwidth for any given scale
- [ ] Can explain consistent hashing on a whiteboard
- [ ] Can explain CAP theorem with real database examples
- [ ] Can design 5 systems end-to-end from memory
- [ ] Can explain when to use SQL vs NoSQL (with reasoning)

### LLD
- [ ] Can draw class diagram for parking lot, LRU cache, elevator in < 15 min
- [ ] Can name 5 design patterns and their use cases instantly
- [ ] Can discuss thread safety trade-offs (over-locking vs under-locking)
- [ ] Can explain SOLID principles in 30 seconds each

### Behavioral
- [ ] Have 9 STAR stories ready, each < 2.5 min
- [ ] Every story has a quantified result
- [ ] Can map any behavioral question to one of my stories
- [ ] Can answer "why [company]?" for each company I'm interviewing at

### Language/Runtime — Go primary
- [ ] Can explain Go GMP scheduler in < 2 min (work stealing + syscall)
- [ ] Can explain escape analysis + when objects hit the heap
- [ ] Can explain Go GC (tri-color, write barrier) in < 2 min
- [ ] Can recite channel ops table (nil / closed / full)
- [ ] Can explain typed-nil `error` interface bug + fix
- [ ] Can code LRU + WaitGroup worker pool in Go from memory
- [ ] Can use `go test -race` and read a pprof top output
- [ ] (Optional) Java GC comparison only if interviewer probes cross-language

---

## Rapid-Fire Cheat Sheet (Key Numbers)

> ⭐ **IMPORTANT CONCEPT:** These numbers are capacity-estimation muscle memory — interviewers notice when you invent QPS/latency instead of anchoring to known ranges.

| System | Key Numbers |
|--------|-------------|
| Redis | 100K–1M ops/sec · 0.5ms latency · 16,384 hash slots |
| PostgreSQL | 10K–50K simple queries/sec · B+ Tree · MVCC (xmin/xmax) |
| Kafka | 1M–10M messages/sec · sequential I/O · zero-copy sendfile |
| Nginx | 50K–100K req/sec · keepalive 64 upstream connections |
| CDN | ~80%+ cache hit rate (Zipf distribution) |
| Estimation | 1M req/day ≈ 12 QPS · 86,400 sec/day |
| Availability | 99.9% = 8.76h/yr · 99.99% = 52 min/yr |
| Latency | Same DC < 1ms · US↔US 60ms · US↔EU 100ms · US↔Asia 200ms |
| Snowflake ID | 64-bit · 4,096 IDs/ms per machine · valid 69 years from epoch |
| HyperLogLog | 12 KB for 1M elements · 0.81% error rate |

---

## System Design Quick Pick

> ⭐ **IMPORTANT CONCEPT:** Quick picks are default starting points, not dogma — say why the pick fits *this* constraint set, then name the alternative you'd reject.

| Use case | What to reach for |
|----------|------------------|
| Caching | Redis cache-aside (read-heavy, tolerate stale data) |
| Queueing | Kafka (high-volume, replay, audit log) · RabbitMQ (complex routing) |
| Search | Elasticsearch (full-text) · Redis Geo (geospatial) · PostGIS (complex geo) |
| File storage | S3 (blobs, cheap, durable) · presigned URL for direct client upload |
| Counter | `Redis INCR` (speed) · sharded counters (hot key avoidance) |
| Session | `Redis SETEX` · JWT (stateless + refresh pattern) |
| Rate limit | Redis Lua sliding window · local + Redis sync for multi-instance |
| Fan-out | < 1M followers → push · celebrity → pull · hybrid = production |
| Leaderboard | Redis ZSet (ranking) + Hash (metadata) = HZSET pattern |
| Chat | WebSocket + Kafka fan-out + Cassandra (TIMEUUID by conversation) |
| Payment | Idempotency key + ACID DB + Saga for cross-service transactions |
| Scheduler | PostgreSQL SKIP LOCKED + Kafka + worker pool |
| ID generation | Snowflake (sortable, fast) · ULID (URL-safe, no coordination needed) |

---

## Real-World Company → Tech Mapping

| Company | Tech Used | Why |
|---------|-----------|-----|
| Uber | Redis Cluster (geospatial) | Driver location updates, 1M ops/sec |
| Twitter | Hybrid fan-out + Kafka | Celebrity tweets can't push to 100M followers |
| Netflix | Cassandra + Kafka + Hystrix | Global scale + circuit breaker patterns |
| Instagram | Cassandra (timeline) + Redis | Write-heavy feed, fast reads |
| Stripe | Idempotency keys + ACID PostgreSQL | Double-charge prevention |
| LinkedIn | Kafka (creator) + Espresso DB | 7 trillion messages/day activity log |
| GitHub | MySQL + Redis + GitHub Actions | Monolith → microservices gradually |
| Airbnb | Aurora + Presto + Kafka | Shared Aurora storage, fast replicas |
| Cloudflare | Nginx + Redis + Rust | 26M req/sec, global reverse proxy |
| Discord | Cassandra + Elixir | Billions of messages, high concurrency |
| DoorDash | Apache Flink + Kafka Streams | Real-time order matching + ETA |
| Shopify | Rails + PostgreSQL (MVCC) + Redis | High consistency for payments |

## 30-Min Daily Flash Revision Scripts

> 🛠️ **PRACTICAL:** Pick one script per weekday morning. Phone timer 30:00. Speak aloud — silent reading doesn't transfer to interviews.

### Script A — DSA Patterns (Mon / Thu)
```text
0–5 min:  List 12 patterns from memory (window, pointers, BS, heap, BFS, DFS,
          topo, DSU, mono stack, DP flavors, backtracking, design)
5–15 min: Draw one problem → pattern trigger for 5 flash cards (below)
15–25 min: Code one "must cold" (LRU or binary search bounds) on paper/IDE
25–30 min: Complexity one-liners for what you coded
```

### Script B — HLD Framework (Tue / Fri)
```text
0–5 min:  Recite FR → NFR → Capacity → API → Schema → Components → Scale → Fail → Tradeoffs
5–15 min: Capacity math aloud for 100M DAU system (QPS, storage, bandwidth)
15–25 min: Sketch one Quick Pick system boxes-only
25–30 min: Name 3 failures + mitigations for that sketch
```

### Script C — LLD + Concurrency (Wed)
```text
0–10 min: Class diagram from memory (Parking Lot OR Rate Limiter)
10–20 min: Where are the locks? What deadlocks? What would Strategy replace?
20–30 min: SOLID one-liners + 5 patterns with "when to use"
```

### Script D — Behavioral (Any evening, 20–30 min)
```text
3 stories × 2.5 min spoken + 2 stress-test follow-ups each
Log: any Result without a number → rewrite tonight
```

### Script E — Runtime Internals (Weekend optional)
```text
15 min: JVM GC or Go GMP explained to rubber duck
15 min: volatile / happens-before OR channel semantics examples
```

---

## Whiteboard Talk Tracks — Top 10 HLD Systems

> ⭐ **IMPORTANT CONCEPT:** A talk track is a rehearsed spine — not a script — so you never blank on "where do I start" under the 60-minute clock.

For each: **open → estimate → core design → deep dive hook → failure closer** (~90s open, then expand).

### 1. URL Shortener
```text
Open: "Write path creates short code; read path 301/302 redirect under 10ms p99."
Est:  100M new URL/mo → ~40 QPS write; reads 100:1 → cache-first.
Core: API → app → cache (Redis) → DB (short→long); unique ID (hash or Snowflake counter).
Dive: Collision strategy, custom aliases, analytics async via Kafka.
Fail: Cache stampede, DB hotspot on popular keys → replicate + CDN for redirects.
```

### 2. News Feed
```text
Open: "Fan-out on write for normal users; pull for celebrities; hybrid is production."
Est:  Posts QPS low vs reads; feed read dominates.
Core: Post service → Kafka → fanout workers → per-user timeline cache/Cassandra.
Dive: Ranking offline + lightweight online rerank; media via CDN.
Fail: Celebrity spike → degrade to pull; hot partition salting.
```

### 3. Chat / Messaging
```text
Open: "Online: WebSocket gateway; offline: push; messages durable + ordered per conversation."
Est:  Connection count vs message QPS; fanout to participants.
Core: Gateway → chat service → Kafka → Cassandra (PK=conversation, CK=timeuuid).
Dive: Read receipts, presence (Redis), multi-device sync.
Fail: Gateway restart → sticky sessions / reconnect backlog.
```

### 4. Rate Limiter
```text
Open: "Distributed limit: token bucket or sliding window in Redis; local + Redis for scale."
Est:  1 check/request at edge; Lua for atomicity.
Core: Middleware → Redis keys per user/IP; return 429 + headers.
Dive: Hierarchical limits, burst vs sustained, multi-DC (eventual).
Fail: Redis down → fail open vs closed by product risk.
```

### 5. Notification System
```text
Open: "Ingest events → prioritize → channel adapters (push/email/SMS) with retries + idempotency."
Est:  Spiky send QPS; separate priority queues.
Core: API → Kafka → workers per channel → provider; template service.
Dive: Preference center, quiet hours, dedupe keys.
Fail: Provider outage → circuit breaker + backlog drain plan.
```

### 6. Uber-like Dispatch
```text
Open: "Riders request; match nearby drivers with ETA; location updates high-write."
Est:  Location updates dominate; geo indexes (Redis GEO / S2).
Core: Location service → matching service → trip state machine → payments async.
Dive: Surge pricing, idempotent trip creation.
Fail: Region outage → active-active considerations; exactly-once not required but no double charge.
```

### 7. Video Streaming
```text
Open: "Upload → transcode ladder → CDN origin; playback = manifest + chunks."
Est:  Bandwidth-heavy; storage cold vs hot.
Core: Upload to blob → transcoder workers → CDN; metadata DB.
Dive: Adaptive bitrate, DRM, thumbnails.
Fail: Origin shield, poison encode jobs, regional CDN miss storms.
```

### 8. Distributed Queue (Kafka-like)
```text
Open: "Append-only partitions; consumers track offsets; replication for durability."
Est:  Partition count vs throughput; ISR.
Core: Producer → broker leader → followers; consumer groups.
Dive: Ordering guarantees, retention, compaction.
Fail: Leader election, consumer lag alerts, hot partition keys.
```

### 9. Payment / Ledger
```text
Open: "Idempotency keys + ACID ledger entries; cross-service Saga with compensations."
Est:  Lower QPS, higher correctness bar.
Core: API → payment service → ledger DB; outbox → Kafka for downstream.
Dive: Exactly-once *effect* via idempotency; PCI boundaries.
Fail: Double-charge prevention drills; reconciliation jobs.
```

### 10. Distributed Scheduler
```text
Open: "Durable jobs with run-at; workers claim via SKIP LOCKED or partition leases."
Est:  Scheduling QPS vs execution fanout.
Core: API → Postgres jobs table / Kafka delay → workers; at-least-once + idempotent handlers.
Dive: Cron expressions, retries, dead-letter.
Fail: Thundering herd at top of hour → jitter; clock skew.
```

> 🛠️ **PRACTICAL:** One system per day: talk track once with eyes closed, then draw for 10 minutes.

---

## DSA Pattern Flash Cards (One-Liner Triggers)

| Trigger in problem statement | Reach for |
|------------------------------|-----------|
| Contiguous subarray / longest window with constraint | Sliding window |
| Pair in sorted array / opposite ends | Two pointers |
| Sorted + find boundary / min capacity / max speed | Binary search (often on answer) |
| Top K / running median / merge sorted streams | Heap |
| Shortest path in unweighted graph / levels | BFS |
| Connected components / flood fill | DFS/BFS grid |
| Prerequisites / ordering | Topological sort |
| Equivalence / merge accounts / cycle undirected | Union-Find |
| Next greater / previous smaller | Monotonic stack |
| Max in window | Monotonic deque |
| Optimal substructure + overlapping subs | DP (define state aloud first) |
| String/interval partitions optimal | Interval DP |
| Generate all configurations | Backtracking |
| O(1) get/put with eviction | LRU (Hash + DLL) |
| Parentheses / path simplify / calculator | Stack |
| Prefix sums + range queries | Prefix sum / diff array |
| "Subsequence" not substring | Often DP or two pointers |
| Grid unique paths / obstacles | DP grid |
| Random pick with weight | Prefix + BS |
| Design hit counter / time key-value | Buckets / BS on timestamps |

**Flash drill:** cover right column; say pattern in < 3 seconds.

---

## Last 48 Hours Protocol

### T−48 to T−24
```text
✓ Full night sleep priority #1
✓ One light DSA medium (confidence, not heroics)
✓ Recite 3 STAR stories once each
✓ Skim cheat sheet numbers + Quick Pick table only
✓ Pack logistics: ID, charger, backup network, IDE fonts, water
✗ No new hard topics, no new system designs, no doom-scrolling Glassdoor
```

### T−24 to T−12
```text
✓ Walkthrough HLD framework once (5 min)
✓ Skim your mock log bottom-2 gaps — only if a 1-page note exists
✓ Light exercise / meal you trust
✗ No mock full loops (fatigue risk)
```

### T−12 to Interview
```text
✓ Easy warmup problem OR mental talk track of favorite HLD
✓ Re-read company "Why us?" + 1 LP/story mapping if Amazon
✓ Environment check (camera, mic, whiteboard tool)
✓ Stop studying ≥ 60–90 min before start; breathe
```

### If Anxiety Spikes
```text
Name 3 things you can control: clarify, narrate, brute-force first.
You are not required to invent novel CS — execute patterns you've drilled.
```

> ⭐ **IMPORTANT CONCEPT:** The last 48 hours protect retrieval and sleep — cramming new content raises anxiety more than scores.

---

## Important Concepts Master Checklist (Months 1–3)

### Month 1 — Foundations
- [ ] Big-O & common complexities recited cold
- [ ] Core DSA patterns coded without notes (see Revision Checklist DSA)
- [ ] OOP + SOLID + common design patterns one-liners
- [ ] SQL vs NoSQL decision tree
- [ ] Basic networking (HTTP, TCP, DNS) for HLD intros
- [ ] Git / debugging hygiene for take-homes (if applicable)

### Month 2 — Systems & Depth
- [ ] HLD framework end-to-end under 60 min
- [ ] Caching, queues, sharding, replication explained with tradeoffs
- [ ] Consistency models (strong / eventual) + examples
- [ ] LLD of Parking Lot, Rate Limiter, LRU with concurrency notes
- [ ] Concurrency primitives (locks, threads/goroutines, pools)
- [ ] Runtime: JVM GC *or* Go GMP at interview depth

### Month 3 — Scale, Prod, Leadership, Execution
- [ ] Scalability: sharding, consistent hashing, outbox, hot partitions, circuit breakers
- [ ] Production: RED/USE, symptom alerts, SLO/error budget, blameless postmortems
- [ ] Leadership: Type 1/2, ADRs, strangler, IC role, influence without authority
- [ ] Behavioral: story bank + company remux + timed STAR
- [ ] Mocks: scorecards, company tips, final-month calendar volume hit
- [ ] Cheat sheet numbers + Quick Picks recalled under 5 min

### Go / No-Go Before Loop
```text
GO if:   DSA medium ≥4 reliable, 1 HLD ≥4 this week, 6 STAR stories quantified, sleep OK
NO-GO if: still learning brand-new patterns, or < 4 scored mocks in last 2 weeks
          → delay loop or narrow company targets; don't hope through gaps
```

> ⭐ **IMPORTANT CONCEPT:** Months 1–3 compound — interview day is retrieval of drilled spines (patterns, framework, stories), not invention.
