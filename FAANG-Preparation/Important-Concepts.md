# Important Concepts Index — FAANG Prep

> Cross-month map of **⭐ IMPORTANT CONCEPTS**. Use this for spaced repetition and final-week revision.
> Full detail lives in the linked files. Legend: see `Daily-Routine.md`.

---

## How to Use

1. **While studying:** when you hit `⭐ IMPORTANT CONCEPT`, add it here if missing and check the box only when you can teach it in ≤ 90 seconds.
2. **Weekly:** Sunday review — reopen any unchecked items.
3. **Final 2 weeks:** revise **only** this index + weak patterns — not entire files.

---

## Month 1 — Foundations

### DSA (`Month-1/DSA.md`)
- [ ] Pattern-first solving (name pattern before code)
- [ ] Two pointers / sliding window
- [ ] Prefix sum + hashmap
- [ ] Binary search (standard + on answer)
- [ ] Monotonic stack / deque
- [ ] BFS / topological sort / Union-Find
- [ ] Core DP families (knapsack, LCS, LIS, state machine)
- [ ] LRU Cache (HashMap + DLL)

### Languages — **Go primary track**
- [ ] **Go language:** nil slice vs map, slice backing array, method sets (`GoLang-Deep-Track.md`)
- [ ] **Go interfaces:** implicit satisfaction; typed-nil `error` bug (`GoLang-Deep-Track.md` §8)
- [ ] **Go errors:** `%w` + `errors.Is` / `As` (`GoLang-Deep-Track.md` §11)
- [ ] **Go concurrency:** channels/select/context/WaitGroup (`GoLang-Core.md` §2)
- [ ] **Go runtime:** GMP, escape analysis, GC (`GoLang-Core.md` §1)
- [ ] **Go production:** pprof, graceful shutdown, middleware recover (`GoLang-Core.md` §§4–5)
- [ ] **Go LLD:** LRU + token bucket + worker pool coded cold (`GoLang-Deep-Track.md` §17)
- [ ] Java/Python notes: optional comparison only (not primary)

### Data & Infra
- [ ] **DB:** B+ Tree indexes, MVCC, isolation anomalies, WAL (`DB-Fundamentals.md`)
- [ ] **Redis:** single-thread model, persistence tradeoffs, Cluster slots, locks+fencing (`Redis-Basics.md`)
- [ ] **Docker:** namespaces/cgroups, multi-stage, hardening (`Docker-Basics.md`)
- [ ] **LLD:** SOLID + Strategy/Observer/Factory; interface at variation points (`LLD-Basics.md`)

---

## Month 2 — Depth

### Distributed Systems (`Distributed-Systems.md`)
- [ ] CAP: during partition choose C vs A (P is required)
- [ ] PACELC (latency vs consistency in normal operation)
- [ ] Raft: leader election + log replication intuition
- [ ] Distributed lock + **fencing tokens**
- [ ] Split brain / clock drift failure modes

### Concurrency (`Concurrency.md`)
- [ ] Race = shared mutable state without sync
- [ ] Happens-before / memory model basics
- [ ] Deadlock four conditions + prevention
- [ ] ConcurrentHashMap / sync.Map when to use

### Messaging & Edge (`Kafka-Internals.md`, `CDN-MessageQueue.md`)
- [ ] Kafka partition = ordering unit; consumer group rebalance
- [ ] ISR + high watermark; at-least-once + idempotent sink
- [ ] CDN caching, cache invalidation, POP geography

### HLD / Cloud / LLD Advanced
- [ ] Hybrid fan-out (celebrity problem) (`HLD-Core.md`)
- [ ] Capacity estimation discipline (`HLD-Core.md`)
- [ ] VPC, IAM Deny-wins, Multi-AZ / Aurora (`Cloud-Engineering.md`)
- [ ] Advanced patterns from `Advanced-LLD.md` (rate limiter, elevator, booking)

### Advanced DSA (`Advanced-DSA.md`)
- [ ] Know rarity: Segment tree / bitmask DP rare but high signal when asked
- [ ] KMP/Z when string matching; Tarjan/Dinic mostly niche

---

## Month 3 — Interview Mode

### System Design
- [ ] Time-boxed RESHADED framework (`System-Design-Handbook.md`)
- [ ] Canonical designs cold: shortener, rate limit, feed, chat, notify (`FAANG-System-Design.md`)
- [ ] Sharding / consistent hashing / outbox / circuit breaker (`Scalability.md`)

### Production (`Production-Engineering.md`)
- [ ] RED / USE / Golden Signals
- [ ] Alert on symptoms; error budgets
- [ ] Blameless post-mortem + IC role

### Behavioral & Leadership
- [ ] STAR with quantified Result; “I” not “we” (`Behavioral.md`)
- [ ] Type 1 vs Type 2 decisions; ADRs (`Leadership.md`)
- [ ] Incident: mitigate first, then root cause

### Execution
- [ ] Mock rubrics + weekly schedule (`Mock-Interviews.md`)
- [ ] Final 2-week consolidate-only plan (`Revision.md`)

---

## Top 25 — Must Teach Cold (Interview Week)

| # | Concept | File |
|---|---------|------|
| 1 | Sliding window / two pointers | DSA (solve in **Go**) |
| 2 | Binary search on answer | DSA |
| 3 | BFS + topo sort | DSA |
| 4 | LRU Cache in Go | Deep-Track §17 / DSA |
| 5 | DP knapsack family | DSA |
| 6 | Index design + EXPLAIN intuition | DB |
| 7 | Isolation levels / anomalies | DB |
| 8 | Redis cache-aside + stampede (+ singleflight) | Redis / Deep-Track §16 |
| 9 | Distributed lock + fencing | Redis / DistSys |
| 10 | CAP during partition | DistSys |
| 11 | Raft at whiteboard level | DistSys |
| 12 | Kafka consumer groups + ordering | Kafka |
| 13 | Exactly-once vs at-least-once + idempotency | Kafka / Scalability |
| 14 | Consistent hashing + vnodes | Scalability |
| 15 | Outbox pattern | Scalability |
| 16 | Circuit breaker + bulkhead + retry budget | Scalability / Prod |
| 17 | Hybrid fan-out | HLD |
| 18 | Capacity estimation | Handbook |
| 19 | **Go GMP** + work stealing + syscall | GoLang-Core §1 |
| 20 | **Go channels vs mutex** + happens-before | GoLang-Core §2 / Concurrency |
| 21 | **Go typed-nil error** + `%w` / Is / As | Deep-Track §§8,11 |
| 22 | **Go slice header** / shared backing gotcha | Deep-Track §4 |
| 23 | RED metrics + error budget | Production |
| 24 | STAR Ownership + Failure + Outage stories | Behavioral |
| 25 | Design framework time budget | Handbook / Mocks |

---

## 🛠️ Weekly Practical Cadence

| Day | Drill |
|-----|-------|
| Mon | Timed DSA × 3 + pattern naming |
| Tue | DB or Redis 🛠️ lab |
| Wed | LLD 45-min mock |
| Thu | Kafka/Cloud/DistSys 🛠️ lab |
| Fri | HLD 45–60 min mock |
| Sat | Full loop mock |
| Sun | This checklist + behavioral STAR × 3 |

---

*Generated as part of curriculum enrichment. Markers inside each note are the source of truth — keep this file short and checklist-oriented.*
