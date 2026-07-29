# Scalability — Complete Study Notes

> **Self-contained. No internet needed.**
> Covers: DB Scaling → Multi-Region → Event-Driven → Cache → Read Replicas → Failure Modes

---

## Table of Contents

| # | Topic | Key Pattern | Real-World |
|---|-------|-------------|------------|
| 1 | [Scaling Databases](#1-scaling-databases) | Vertical → Read replicas → Sharding | Instagram, Shopify |
| 2 | [Multi-Region Systems](#2-multi-region-systems) | Active-passive, active-active, CRDTs | Netflix, Google Spanner |
| 3 | [Event-Driven Architecture](#3-event-driven-architecture) | Choreography vs Orchestration, Outbox | Uber, DoorDash |
| 4 | [Distributed Cache](#4-distributed-cache) | Topology, write strategies, warming | Twitter, Airbnb |
| 5 | [Read Replicas Deep Dive](#5-read-replicas-deep-dive) | Replication lag, read-your-writes fix | Stripe, Airbnb |
| 6 | [Write Scaling](#6-write-scaling-patterns) | CQRS, write-behind, batching | LinkedIn, Pinterest |
| 7 | [Edge Topics](#7-edge-topics-failure-modes-at-scale) | Hot partition, data skew, cascading failure | GitHub, Knight Capital |

---

## 1. Scaling Databases

> ⭐ **IMPORTANT CONCEPT:** Scale reads with replicas; scale writes with sharding — know the resharding and cross-shard query costs.

### Vertical Scaling (Scale Up)
```text
Add more CPU, RAM, or faster disk to the existing server.

Pros: no code changes, simpler ops
Cons: hardware ceiling, single point of failure, downtime for upgrade

Largest RDS instance (db.x2g.16xlarge): 1 TB RAM, 128 vCPUs
When you hit the ceiling → horizontal scaling
```

### Read Scaling (Read Replicas)
```text
Architecture:
  Primary (read + write)
    → async replication →
  Replica 1 (read only)
  Replica 2 (read only)
  ...

How replication works (PostgreSQL):
  Primary writes WAL (Write-Ahead Log)
  Replica streams WAL and replays → eventual consistency
  Lag: usually < 100ms on same DC, up to seconds under load

Routing reads:
  Route to replica by default.

  "Read-your-writes" problem:
    User writes → primary
    User reads 10ms later → hits replica with old data → user confused
  Fix: sticky routing for 1–2 seconds after write,
       or always read from primary when fresh data is critical.
```

### Write Scaling — Sharding

> ⭐ **IMPORTANT CONCEPT:** Sharding is write-scale insurance with a tax: cross-shard queries and resharding pain — pick the partition key for *access patterns*, not convenience.

#### Hash Sharding
```text
shard_id = hash(partition_key) % num_shards

Example: hash(user_id) % 4 → shard 0, 1, 2, or 3

Pros:
  Even distribution (hash is uniform)
  Simple routing logic

Cons:
  Cross-shard queries: "find all orders > $100" must hit all shards (scatter-gather)
  Resharding: adding a shard → most keys change shard → massive data migration
  Fix for resharding: Consistent Hashing (only 1/N keys move when adding 1 shard)
```

#### Consistent Hashing

> ⭐ **IMPORTANT CONCEPT:** Consistent hashing + vnodes minimize key movement on resize (~1/N) — without vnodes, ring placement skew creates hot nodes.

```text
Place shards on a circle (hash ring). Map each shard to one or more points.
To find a key's shard: hash(key) → find the nearest shard clockwise.

Add a shard:    Only moves keys between new shard and its predecessor. ~1/N keys move.
Remove a shard: Only its keys move to the next shard on the ring.

Virtual nodes (vnodes): each physical shard owns multiple points on the ring.
  Ensures even distribution even with heterogeneous hardware.

Used by: Cassandra, DynamoDB, Memcached
```

> **💡 Key Insight:** Without vnodes, hash positions may cluster unevenly. 150–200 vnodes per physical shard is standard.

#### Range Sharding
```text
Shard by range of values:
  shard 0 = user_id 0–1M
  shard 1 = user_id 1M–2M
  ...or by time: one shard per month

Pros: range queries efficient (scan only 1–2 shards)
Cons: hot shard — all recent writes go to the latest time shard

Fix: shard by (date + random suffix)
     or pre-splitting — create shards for future time windows
     in advance so they can be distributed across nodes.
```

#### Directory Sharding
```text
Lookup service: key → shard_id stored in a central registry.

Pros: flexible; easy to rebalance (update mapping → migrate data → update mapping)
Cons: lookup service = single point of failure + extra latency per request
Fix: cache the mapping aggressively (rarely changes)
```

### Sharding Strategy Comparison

| Strategy | Pros | Cons | Use when |
|----------|------|------|----------|
| Hash | Even distribution | Cross-shard queries hard | Key-value lookups, user-id based |
| Consistent Hash | Minimal key movement on resize | Slightly complex client | Caches, distributed stores |
| Range | Range queries efficient | Hot shard risk | Time-series, ordered data |
| Directory | Flexible, easy rebalance | SPOF + extra hop | Complex or irregular data |

> 🌍 **Real-World:** Instagram shards their PostgreSQL cluster by user_id using directory sharding — a central mapping table (cached in memcached) routes each user_id to one of 12,000+ logical shards. When Instagram hit write limits, they added shards by migrating a subset of logical shards to new physical nodes with no application downtime. Shopify uses range sharding by shop_id where each "pod" (a group of shards) serves a subset of merchants — this allows them to isolate a viral Kylie Jenner sale (50K orders/minute) to one pod without affecting other merchants.

---

## 2. Multi-Region Systems

### Active-Passive (Failover)
```text
Primary region: handles all reads and writes.
Passive region: receives async replication. Only activates on failover.

Failover:
  Detect primary failure → DNS record update → traffic shifts to passive.
  RTO (Recovery Time Objective): minutes (DNS TTL + warmup)
  RPO (Recovery Point Objective): seconds to minutes (replication lag at failure)

Cons:
  Wasted capacity in passive region
  Failover is manual or semi-manual (risk of split-brain if done wrong)
  Passive region always behind (RPO > 0)
```

### Active-Active (Multi-Primary)
```text
Multiple regions all accept reads AND writes.

Challenge: write conflicts
  User A (US) updates record at T=1000ms
  User B (EU) updates same record at T=1001ms
  Replication delay = 100ms
  Both updates arrive simultaneously at each region → conflict

Conflict resolution strategies:
  1. Last-Write-Wins (LWW):      higher timestamp wins. Simple but can lose data.
  2. Application-level merge:    app defines how to merge (CRDTs for counters)
  3. Geo-affinity routing:       route writes for a user to one region always
                                 (EU users always write to EU — avoids conflicts by design)
```

### CRDTs (Conflict-free Replicated Data Types)
```text
Operations designed to be commutative and associative → auto-merge is always safe.

Types:
  G-Counter  (grow only)
  PN-Counter (positive-negative)
  G-Set      (grow only set)
  OR-Set     (observed-remove set)

Used for: like counts, shopping cart totals, presence indicators
```

### Cross-Region Latency
```text
Round-trip latency (approximate):
  Same DC:        < 1ms
  Same region:    5–10ms
  US East ↔ West: ~60ms
  US ↔ EU:        ~100ms
  US ↔ Asia:      ~200ms

Strong consistency (synchronous replication) across regions:
  write latency ≥ cross-region RTT → 100–200ms per write → unacceptable for most apps.

Solution: eventual consistency for cross-region, strong consistency within region.
Exception: Google Spanner uses TrueTime + commit wait → global strong consistency at ~7ms avg.
```

### DNS-Based Routing for Multi-Region
```text
Route 53 (AWS) supports:
  Latency-based routing:    route user to nearest region
  Failover routing:         primary → passive on health check failure
  Geolocation routing:      GDPR compliance (EU data stays in EU)

TTL consideration:
  Short TTL (60s):     fast failover; clients get updated DNS quickly
  Long TTL (86,400s):  clients cache stale DNS for 24h after failover
```

> **⚠️ Production gotcha:** Low TTL for failover routing, but don't go below 60s or you'll DDoS your own DNS.

> 🌍 **Real-World:** Netflix operates an active-active multi-region architecture across 3 AWS regions (us-east-1, us-west-2, eu-west-1) — user traffic is routed to the nearest healthy region via latency-based DNS, and each region can handle 100% of traffic independently if the others fail. During the 2012 us-east-1 outage, Netflix traffic automatically shifted to other regions with no customer-visible outage. Google Spanner achieves global strong consistency with ~7ms average latency using TrueTime — GPS-synchronized clocks in every datacenter allow Spanner to assign globally ordered commit timestamps without cross-region synchronous coordination.

---

## 3. Event-Driven Architecture

### Why Event-Driven
```text
Tight coupling problem:
  Order Service → Payment Service → Notification Service → Analytics Service
  One service slow → all slow. One down → cascade failure.

Event-driven decoupling:
  Order Service publishes "order_created" event to Kafka.
  Payment, Notification, Analytics each consume independently.
  Order Service doesn't know or care who's downstream.
```

### Choreography vs Orchestration

| | Choreography | Orchestration |
|--|-------------|---------------|
| Control | Distributed — each service reacts to events | Central — Saga Orchestrator drives the flow |
| Coupling | Fully decoupled | Orchestrator is a dependency |
| Traceability | Hard to trace overall flow | Explicit and visible |
| Compensation | Hard to enforce ordering | Easy to implement compensations |
| Best for | Simple workflows | Complex, multi-step transactions |

### Outbox Pattern (Atomic Event Publishing)

> ⭐ **IMPORTANT CONCEPT:** Outbox makes "DB write + event publish" atomic via the same transaction; consumers must still be idempotent because the relay can double-publish.

```text
Problem: write to DB AND publish to Kafka atomically.
         If DB succeeds but Kafka fails → inconsistency.

Solution: write event to an outbox table in the same DB transaction.
```

```sql
BEGIN TRANSACTION;
  INSERT INTO orders (id, ...) VALUES (...);
  INSERT INTO outbox (event_type, payload, published) VALUES ('order_created', '...', false);
COMMIT;
```

```text
A separate relay process polls outbox → publishes to Kafka → marks as published.
If publisher fails: retry from outbox.
Events may be published twice → consumers must be idempotent.
```

> 🌍 **Real-World:** Uber uses the Outbox pattern across their microservices to guarantee event delivery between their Trip service and downstream services (Payment, Driver, Analytics) — they write trip state changes and the outbox event in a single Postgres transaction, then a relay polls the outbox and publishes to Kafka. DoorDash uses choreography-based Sagas for their order workflow with the Outbox pattern as the glue — their engineering blog documents how moving to the Outbox pattern eliminated a class of ordering bugs where the order status changed in the DB but the downstream notification never fired. Debezium (open-source CDC tool) automates the relay step by streaming Postgres WAL changes directly into Kafka, used by Zalando, Booking.com, and hundreds of other companies.

### Exactly-Once vs At-Least-Once

| | Exactly-Once | At-Least-Once |
|--|-------------|---------------|
| Complexity | Hard — Kafka requires idempotent producers + transactions | Simple |
| Duplicates | None | Possible |
| Best practice | Design consumers to be idempotent instead | Most systems |

> **💡 Best practice:** Store processed event IDs in DB or Redis with TTL. If you've already processed event ID `X`, skip it.

---

## 4. Distributed Cache

### Cache Topology Options

| Topology | Latency | Shared? | Use for |
|----------|---------|---------|---------|
| In-Process (Caffeine, Guava) | < 1 µs | No (per instance) | Static config, read-only reference data |
| Sidecar | Low | No (per instance) | Slightly more capacity than in-process |
| Distributed (Redis) | ~0.5 ms | Yes (all instances) | Session, feed, rate limiting |

### Cache Write Strategies

| Strategy | How | Pros | Cons |
|----------|-----|------|------|
| Write-through | Write to cache AND DB simultaneously | Consistent | Slower writes |
| Write-behind | Write to cache → async flush to DB | Fastest writes | Risk of data loss |
| **Cache-aside** (most common) | App manages: miss → read DB → write cache | Simple | Cache may be stale |

**Cache-aside pattern:**
```text
Read:  check cache → hit: return
              → miss: read DB → write to cache with TTL → return
Write: write to DB → DELETE cache key (don't update — prevents race condition)
```

### Redis Cluster Internals
```text
Data sharded across 16,384 hash slots.
Each master node owns a subset of hash slots.
Each master has 1+ replicas.

Key → CRC16(key) % 16,384 → hash slot → master node

Hash tags: force related keys to the same slot.
  {user:123}:session → slot based on "user:123"
  {user:123}:cart    → same slot → allows multi-key commands (MGET, pipeline)
```

### Cache Eviction Policies

| Policy | Behavior | Use for |
|--------|----------|---------|
| LRU | Evict least recently accessed key | General-purpose |
| LFU | Evict least frequently accessed key | Access-frequency-aware |
| TTL | Expire after N seconds (always set this!) | All caches |
| allkeys-lru | Evict any key when memory full | When all keys may be evictable |
| volatile-lru | Evict only TTL-set keys | When some keys must survive |

### Cache Warming (Cold Start Problem)
```text
After deploy or restart, cache is empty → DB gets hammered.

Solutions:
1. Pre-warm: before switching traffic, run a script that loads top N% of keys
   (from query logs or analytics) into cache.
2. Lazy warming: let it warm naturally. Use circuit breaker to protect DB.
3. Read-through: cache layer handles misses automatically.

Stampede on TTL expiry:
  Problem: TTL expires for a popular key → 1,000 concurrent misses → 1,000 DB queries.
  Fix 1: mutex — only 1 goroutine fetches from DB, others wait.
  Fix 2: probabilistic early expiry — refresh key before actual TTL expires.
  Fix 3: stale-while-revalidate — serve stale data while refreshing async.
```

> 🌍 **Real-World:** Twitter's "Twemcache" cluster serves 100M+ cache requests/second with a 98%+ hit rate. To handle cold-start after cache deploys, Twitter pre-warms cache by replaying the previous hour of read traffic against the fresh cache before routing production traffic to it. Airbnb experienced a massive stampede during Black Friday 2018 when their Redis cache cluster restarted — 40,000 concurrent cache misses hit their PostgreSQL database simultaneously, causing a 10-minute incident. They fixed it with a mutex-based "dog pile" prevention library and stale-while-revalidate for non-critical pricing data.

---

## 5. Read Replicas (Deep Dive)

### Replication Lag — Causes

```text
- Heavy write load: WAL generates faster than replica can replay
- Network bandwidth between primary and replica saturated
- Replica has slower hardware than primary
- Long-running queries on replica blocking WAL application (PostgreSQL)
```

```sql
-- Measure replication lag in PostgreSQL:
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
-- Or on primary: SELECT * FROM pg_stat_replication;
```

> **⚠️ Alert threshold:** Alert if lag > 10 seconds. Escalate if > 30 seconds.

### Solving Read-Your-Writes

| Solution | How | When to use |
|----------|-----|-------------|
| Sticky routing | Route reads to primary for 1–2s after write | General use |
| LSN token | Include "minimum required LSN" in reads; route to replica only if caught up | Precision control |
| Always read primary | For critical reads (bank balance after transfer) | Financial data |
| Read-after-write token | Write returns a token; read waits for replica to catch up to that token | Client-driven |

---

## 6. Write Scaling Patterns

### CQRS (Command Query Responsibility Segregation)
```text
Separate the write model from the read model.

Write side (Command): handles mutations. Optimized for writes. Generates events.
Read side  (Query):   handles reads. Optimized for reads. May be denormalized.

Example:
  Command: PlaceOrder → writes to orders DB, publishes order_placed event
  Query:   OrderReadService maintains a pre-joined "order details" view
           (order + product + user data) for fast reads

Benefits:
  - Read model scales independently
  - Read model can use a different DB (Elasticsearch, Redis)
  - Command and query logic independently deployable

Downsides:
  - Eventual consistency between write and read models
  - More infrastructure to maintain
```

> 🌍 **Real-World:** LinkedIn's newsfeed uses CQRS extensively — writes (posts, likes, follows) go to their normalized write stores, while reads are served from pre-materialized, denormalized read models stored in Espresso (LinkedIn's NoSQL DB) and Couchbase. The read model is rebuilt by Kafka consumers that process the event stream from the write side. Microsoft's Azure DevOps (formerly VSTS) was one of the first large-scale public CQRS implementations — they describe in their engineering blog how separating command and query paths allowed their read replicas to scale to 10× the capacity of their write nodes independently.

### Write-Behind (Write-Back) Caching
```text
Write to cache only → async batch write to DB.

Pros: extremely fast writes (cache speed)
Cons: data loss if cache dies before flush

Use for:   like counts, view counts, non-critical counters
Never for: financial data, anything requiring durability
```

### Batching Writes
```sql
-- Instead of 1,000 individual INSERTs, batch them:
INSERT INTO events (user_id, type, ts) VALUES
    (1, 'click', ...), (2, 'view', ...), ... -- 1,000 rows
```

```text
Throughput improvement: 10–100× for high-ingest workloads
Implementation: buffer in memory for 100ms OR 1,000 records, whichever first.
Risk: data loss if app crashes before flush.
Fix: use WAL or Kafka to buffer durably before the batch write.
```

---

## 7. Edge Topics (Failure Modes at Scale)

### Hot Partition

> ⭐ **IMPORTANT CONCEPT:** Hot partitions kill throughput long before average load looks high — salt keys, isolate celebrities, or cache aggressively at the application layer.

```text
Problem: one shard gets disproportionately more traffic.
Cause:   poor partition key (e.g., timestamp → all writes to latest partition)
         or viral content (one celebrity's user_id gets 100× traffic)

Fixes:
  Add suffix to partition key:
    partition_key = user_id + random(0, N)
    → user's data spread across N partitions
    → reads must query all N and merge (scatter-gather)

  Separate hot keys:
    Detect hot keys → put them in a dedicated partition.

  Application-level caching:
    If one item is hot → cache it aggressively to reduce load on DB/Kafka.
```

> 🌍 **Real-World:** DynamoDB's hot partition problem is well-documented — early users of DynamoDB who used `date` or monotonically-increasing IDs as partition keys experienced severe throttling because all writes went to a single partition. AWS added "Adaptive Capacity" in 2017 to automatically detect and rebalance hot partitions, but the best fix remains key design. Twitter's Finagle framework includes a "hot key" detector that routes requests for keys exceeding a threshold RPS to a local in-process cache rather than hitting the distributed cache, used to handle celebrity account traffic spikes during breaking news events.

### Data Skew
```text
Problem: some partitions have vastly more data than others.
         Operations on large partitions take much longer → uneven processing time.

Causes:
  - User with 10M followers vs average 500
  - Certain regions have 10× more users

Detection: monitor partition sizes and processing time per partition.

Fix: adaptive partitioning (re-partition skewed partitions into sub-partitions).
     Salting: append salt to key to distribute data more evenly.
     Trade-off: queries must query all salted variants and merge results.
```

### Replication Lag at Scale
```text
Write amplification: a table with 5 indexes generates 6 WAL entries per row change
                     (1 table + 5 indexes).
→ Each write generates 6× the WAL.

Fix: reduce index count on write-heavy tables.
     Use partial indexes (only index the rows you actually query).

Alert: lag > 10s. Escalate: lag > 30s.
```

### Retry Amplification
```text
N service layers, each retrying 3× = 3^N requests reach the leaf service.
At 5 layers: 3^5 = 243× amplification during an outage.

Example:
  Clients send 1,000 RPS to Gateway
  Gateway retries 3× to Service A → 3,000 RPS to A
  Service A retries 3× to DB     → 9,000 RPS to DB
  DB is already struggling        → now 9× more load → dies harder

Fixes:
  1. Exponential backoff + jitter:   spread retries over time
  2. Retry budget:                   limit retries to X% of total requests
  3. Circuit breaker:                stop retrying once downstream is known-bad
  4. Idempotency keys:               retry safely without duplicate side effects
```

### Cascading Failure

> ⭐ **IMPORTANT CONCEPT:** Timeouts + circuit breakers + bulkheads + retry budgets prevent retry amplification from taking down the fleet.

```text
Pattern:
  Service B has 100 threads. Each waits for Service A (which is slow).
  All 100 threads are blocked. New requests queue up. Queue fills. B fails.
  Service C is waiting for B. C fails. → cascade.

Prevention:

  1. Timeouts (mandatory):
     Set timeout on ALL downstream calls.
     If A doesn't respond in 500ms → fail fast, free the thread.

  2. Circuit Breaker:

> ⭐ **IMPORTANT CONCEPT:** Circuit breakers fail fast when downstream is known-bad — without them, retries amplify load and turn a slow dependency into a cascade.

     Closed (normal):    requests go through.
     Open (failing):     requests fail immediately, no downstream call.
     Half-Open (probe):  try 1 request. Success → close. Fail → stay open.
     Closed→Open:  after N failures in time window
     Open→Half-Open: after T seconds

  3. Bulkhead:
     Separate thread pools per dependency.
     DB calls → pool of 20 threads
     Cache calls → pool of 10 threads
     If DB is slow and exhausts its pool → cache calls still work.

  4. Load shedding:
     Under extreme load, drop low-priority requests.
     Protect capacity for high-priority traffic.

  5. Backpressure:
     Signal upstream to slow down.
     Kafka consumers stop polling → topic buffers → producer slows naturally.
```

> 🌍 **Real-World:** Amazon's 2012 AWS outage and the subsequent "re:Invent" post-mortems popularized bulkhead isolation — Netflix's response was to build Hystrix (circuit breaker + bulkhead library) and mandate its use across all microservices. The "Netflix Simian Army" (Chaos Monkey, Chaos Gorilla, Latency Monkey) intentionally causes cascading failures in production daily to verify that circuit breakers and bulkheads actually work. GitHub experienced a major cascading failure in 2018 when a network partition caused MySQL primary elections to fail simultaneously across data centers — their post-mortem became a reference for how distributed systems can cascade even with well-designed safeguards, driving industry adoption of improved database failover tooling.

---

## 8. Practical Labs

> 🛠️ **PRACTICAL:** Do these on a whiteboard or paper with a timer. Numbers matter more than pretty boxes.

### Lab A — Design Sharding for Instagram-like Load (45 min)

**Prompt:** Photo metadata + feed pointers for 500M MAU. Peak write: 20K new posts/sec. Read: 2M feed reads/sec (cached aggressively).

**Steps:**
```text
1. Estimate row size: post metadata ~500B → 20K × 500B ≈ 10 MB/s write ≈ 864 GB/day raw
2. Pick partition key: author_id (feed fanout affinity) vs post_id (even writes)
3. Compute shards: target ≤ 5K writes/sec/shard → ≥ 4 shards; plan 64–256 logical for growth
4. Directory vs hash: argue Instagram-style logical shards + mapping table
5. Hot celebrities: salt author_id or dedicated VIP pool + cache
6. Cross-shard: "global recent posts" = approximate via sample or separate timeline service
7. Reshard story: migrate logical shards without downtime (move → dual serve → cut mapping)
```

**Deliverable sketch:**
```text
Client → API → Shard Router (cached map)
              ├─ PG shard 0…N (posts by author_id)
              ├─ Redis (home timeline / session)
              └─ Kafka (fanout, async)
VIP / hot keys → special pool + heavier cache
```

**Self-score:** Did you quantify writes/shard? Did you name a hot-key strategy? Did you avoid "just add Mongo"?

### Lab B — Calculate Replication Lag Impact (20 min)

**Given:**
```text
Primary write rate: 8K tx/sec
Average WAL bytes/tx: 2 KB
Replica apply rate: 12 MB/s sustainable
Network: fine (not bottleneck)
```

**Compute:**
```text
WAL generate ≈ 8000 × 2KB = 16 MB/s
If apply = 12 MB/s → backlog grows at 4 MB/s
After 60s under this load: 240 MB backlog
If ~2KB/tx → ~120K transactions behind
At 8K tx/s → lag ≈ 120000/8000 = 15 seconds

Interview line: "Under this burst, read replicas can be ~15s stale —
sticky primary reads for 20s after write, or LSN-gated routing."
```

**Variant:** Halve indexes on write path (less WAL amplification) — discuss qualitative lag improvement.

### Lab C — Draw Multi-Region Failover (30 min)

**Draw both:**
```text
Active-Passive:
  Users → DNS (failover) → Region A primary
                         ↘ Region B replica (async)
  Annotate: RPO (lag), RTO (DNS TTL + warmup), split-brain risk

Active-Active:
  Users → latency DNS → Region A or B (both write)
  Conflict box: LWW vs CRDT vs user sticky region
  Annotate: when Spanner-like sync is NOT affordable (100–200ms write)
```

**Narrate aloud:** game-day: health check fail → DNS flip → cache cold → thundering herd plan.

> 🌍 **Real-World:** Interviewers love when you mention DNS TTL and cache cold-start as part of failover — not just "we switch regions."

### Lab D — Outbox vs Dual-Write (15 min)
```text
On paper: show dual-write failure (DB commit, Kafka publish fails).
Replace with outbox table in same txn + relay.
Consumer: idempotency key = event_id stored with TTL or unique constraint.
```

---

## 9. Interview Q&A Bank (25 Concise Answers)

| # | Question | Concise answer |
|---|----------|----------------|
| 1 | Vertical vs horizontal scaling? | Vertical = bigger box (simple, ceiling, SPOF). Horizontal = more nodes (need sharding/statelessness). |
| 2 | When is sharding premature? | When single primary + replicas meet QPS/storage. Shard when writes/storage or blast radius demand isolation. |
| 3 | Why consistent hashing? | Adding/removing nodes moves ~1/N keys vs almost all with `hash % N`. Vnodes fix placement skew. |
| 4 | Hash vs range sharding? | Hash = even load, weak range scans. Range = great ranges, hot tail risk. |
| 5 | Read-your-writes fix? | Sticky primary briefly, LSN/token gating, or read primary for critical paths. |
| 6 | Outbox pattern why? | Atomically persist state + event in one DB txn; relay publishes. Avoids DB/Kafka split brain. |
| 7 | At-least-once vs exactly-once? | Prefer at-least-once + idempotent consumers. Exactly-once is expensive end-to-end. |
| 8 | Choreography vs orchestration? | Choreography = decoupled, hard to trace. Orchestration = central saga, clearer compensations. |
| 9 | Cache-aside write rule? | Write DB then **delete** cache key (not update); always set TTL. |
| 10 | Cache stampede fixes? | Single-flight mutex, probabilistic early refresh, stale-while-revalidate, pre-warm. |
| 11 | Hot partition fixes? | Key salting, VIP pools, app-level cache for hot entities, better keys. |
| 12 | Circuit breaker states? | Closed → Open after failures; Open fails fast; Half-open probes; pair with bulkheads. |
| 13 | Retry amplification? | Bounded retries + jitter + retry budgets + breakers; else 3^N load to leaf. |
| 14 | Active-active conflict tools? | LWW (lossy), CRDTs (mergeable), sticky user→region. |
| 15 | CQRS benefit/cost? | Independent read scale/models; cost = eventual consistency + ops. |
| 16 | What is scatter-gather? | Query fans to many shards then merges; latency ≈ slowest shard + merge. |
| 17 | Directory sharding SPOF fix? | Replicate registry; cache mappings; rare updates. |
| 18 | When write-behind cache? | Non-durable counters/views; never money. |
| 19 | Why delete cache on write? | Avoid races that restore stale values around concurrent readers/writers. |
| 20 | Geo-affinity routing benefit? | User writes stick to one region → fewer conflicts. |
| 21 | ISR in Kafka? | In-sync replicas; ack=all waits for ISR; laggards drop from ISR. |
| 22 | What is backpressure? | Slow consumer signals upstream to reduce rate. |
| 23 | Bulkhead vs breaker? | Bulkhead isolates pools; breaker stops calling unhealthy deps. |
| 24 | RPO vs RTO? | RPO = data you may lose; RTO = time to recover service. |
| 25 | Cross-region sync replication? | Adds RTT to write path — usually too slow for user-facing writes. |

### Stretch Follow-ups
```text
- Show outbox schema + relay pseudocode.
- What if the relay publishes twice?
- Fail open or closed if Redis rate limiter dies?
```

---

## 10. Capacity Estimation Worked Examples

### Example 1 — Write Throughput → Shard Count
```text
Peak writes: 50,000 QPS
Safe per-shard write budget: 5,000 QPS (including indexes + headroom)
Min shards = 50000 / 5000 = 10
Plan for 2× growth + imbalance → start with 32 logical shards on ≥ 8 physical nodes
```

### Example 2 — Storage Growth
```text
Events: 2 KB × 100M/day = 200 GB/day raw × 3 replication = 600 GB/day
× 30 days hot ≈ 18 TB hot tier; colder tiers after 30d
```

### Example 3 — Cache Working Set
```text
If ~20% of keys drive ~80% of traffic:
  Working set ≈ 0.2 × active keys × value size (+ ~30% overhead)
  Measure real hit rate; don't trust 80/20 blindly
```

---

## 11. Failure Mode Drill Cards

| Failure | Detection | First mitigate | Longer fix |
|---------|-----------|----------------|------------|
| Hot partition | One shard CPU/latency outlier | Cache hot key; shed noncritical | Salt key; VIP pool |
| Replica lag spike | Lag > 10s | Critical reads → primary | Reduce WAL amp; hardware |
| Cache cold after deploy | DB QPS cliff | Pre-warm / single-flight | Warm phase before cutover |
| Retry storm | Downstream QPS ×N | Trip breakers; cut retries | Retry budgets default |
| Multi-region split brain | Divergent writes | Freeze minority writes | Quorum / sticky region |
| Outbox relay stuck | Outbox age + lag | Scale relay; alert on age | CDC / partition outbox |
| Kafka hot key | One partition lag | Change key; reroute | Salting + aggregate |

> 🛠️ **PRACTICAL:** Pick 3 cards. Speak Detection → Mitigate → Fix in < 60 seconds each.

---

## 12. Diagram Templates to Memorize

### Sharded SQL + Cache
```text
Clients → API/GW → Shard Router (cached map) → PG shards 0…N
                              ↘ Redis (timelines/sessions)
                              ↘ Kafka (async fanout)
```

### Outbox Relay
```text
Service --txn--> DB (entity + outbox) → Relay/CDC → Kafka → Idempotent consumers
```

### Circuit Breaker + Bulkhead
```text
Request → [Bulkhead pool per dependency] → Circuit (Closed/Open/Half-Open) → Downstream
Timeouts on every hop; fail fast when Open
```

---

## 13. Common Interview Traps (Scalability)

```text
❌ "We'll shard later" with no key or migration story
❌ Consistent hashing without vnodes / key-movement math
❌ Active-active without conflict story
❌ Cache update-on-write races
❌ Casual exactly-once for the whole distributed path
❌ Retries without jitter/budget/breaker
❌ Multi-region strong consistency ignoring RTT
```

**Strong closer:** "I'd start from the access pattern, pick the partition key for that pattern, measure hot keys, and keep rollback at every migration phase."

---

## Lab A Answer Key (Self-Check)

```text
✓ Writes ~20K/s → not a single PG primary forever
✓ author_id sharding helps per-user timelines; celebrity salt/VIP still required
✓ Logical >> physical shard count for online moves
✓ Feed reads must be cache/CQRS-ish — 2M/s raw SQL won't fly
✓ Async fanout via Kafka belongs in the picture
✓ Failures: hot key, mapping cache miss storm, reshard dual-write window
```

---

## Important Concepts Checklist — Scalability

- [ ] Vertical → replicas → shard progression explained
- [ ] Hash / range / directory / consistent hashing tradeoffs memorized
- [ ] Vnodes purpose (~even distribution, ~1/N move)
- [ ] Read-your-writes solutions named
- [ ] Replication lag causes + alert thresholds (~10s / ~30s)
- [ ] Outbox + idempotent consumers
- [ ] Choreography vs orchestration + Saga intuition
- [ ] Cache topologies + cache-aside delete-on-write
- [ ] Stampede mitigations
- [ ] CQRS when / when not
- [ ] Hot partition + skew + WAL amplification
- [ ] Circuit breaker + bulkhead + retry budget + backpressure
- [ ] Multi-region: RPO/RTO, conflict strategies, TTL gotcha
- [ ] Labs A–D completed once on paper with numbers

> ⭐ **IMPORTANT CONCEPT:** Scalability interviews reward quantitative sharding math and explicit failure modes — architecture poetry without numbers scores mid at best.
