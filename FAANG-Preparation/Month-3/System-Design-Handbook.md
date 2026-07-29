# System Design Handbook — Interview Patterns & Frameworks

> Synthesized from top system design resources and FAANG interview patterns.
> Companion to CDN-MessageQueue.md and FAANG-System-Design.md

---

## Table of Contents

| # | Topic |
|---|-------|
| [1](#1-the-faang-interview-meta-game) | The FAANG Interview Meta-Game |
| [2](#2-universal-interview-framework) | Universal Interview Framework (RESHADED) |
| [3](#3-requirements--estimation-playbook) | Requirements & Estimation Playbook |
| [4](#4-the-scalability-ladder) | The Scalability Ladder |
| [5](#5-data-modeling--storage-selection) | Data Modeling & Storage Selection |
| [6](#6-the-read-heavy-patterns-playbook) | Read-Heavy Patterns Playbook |
| [7](#7-the-write-heavy-patterns-playbook) | Write-Heavy Patterns Playbook |
| [8](#8-distributed-systems-fundamentals) | Distributed Systems Fundamentals |
| [9](#9-canonical-system-designs) | Canonical System Designs |
| [10](#10-tradeoff-vocabulary) | Tradeoff Vocabulary |
| [11](#11-common-mistakes--anti-patterns) | Common Mistakes & Anti-Patterns |
| [12](#12-how-interviewers-score-you) | How Interviewers Score You |

---

## 1. The FAANG Interview Meta-Game

### What Interviewers Are Actually Evaluating

The system design interview is NOT a knowledge test. It's an **engineering judgment test**. Interviewers want to see:

```
1. Can you navigate ambiguity?
   - Ask clarifying questions
   - Define scope confidently
   - Make explicit assumptions

2. Can you reason about scale?
   - Estimate without a calculator
   - Know when a component becomes a bottleneck
   - Know what numbers change the design

3. Can you communicate tradeoffs?
   - "I chose X because Y, but it has the cost Z"
   - Don't just describe — justify

4. Do you have depth when pushed?
   - Interviewer will pick one area and go deep
   - Know your chosen components well

5. Do you have breadth?
   - Touch all the major components
   - Don't spend 45 min on one piece
```

### Time Budget for a 45-Minute Interview

> ⭐ **IMPORTANT CONCEPT:** Be drawing architecture by ~minute 10 — deep dives win L6/L7 signal, not endless requirements.

```
00:00 – 05:00  → Requirements clarification (5 min)
05:00 – 10:00  → Scale estimation (5 min)
10:00 – 20:00  → High-level design, API design (10 min)
20:00 – 40:00  → Deep dives on key components (20 min)
40:00 – 45:00  → Wrap-up, tradeoffs summary, questions (5 min)
```

> **💡 Key Insight:** Most candidates spend too long on requirements and not enough on deep dives. The deep dive is where L6/L7 candidates differentiate themselves. Get to drawing the architecture by minute 10.

### The Opener That Wins Points

```
"Before I start designing, let me clarify a few things to make sure I'm 
solving the right problem..."

Then ask:
  1. Scale: "What's the expected number of users / DAU?"
  2. Geographic: "Is this a global system or single-region?"
  3. Scope: "Should I focus on [core feature] or also [adjacent feature]?"
  4. Consistency: "For [X], is it okay to serve slightly stale data?"
  5. Priority: "What matters more: latency or cost?"
```

---

## 2. Universal Interview Framework (RESHADED)

```
R — Requirements
    Functional: Core features. What the system DOES.
    Non-functional: Performance, reliability, scale.

E — Estimation
    QPS (read and write separately)
    Storage (per record × volume × retention)
    Bandwidth (QPS × avg payload size)
    Memory (for caches: hot data × item size)

S — Storage Schema
    Define key entities and relationships.
    Choose primary storage type.
    Define indexes and access patterns.

H — High-Level Design
    Draw the architecture diagram.
    Client → LB → Services → DB/Cache/Queue/CDN

A — API Design
    Define the REST or gRPC endpoints.
    Request and response schemas.

D — Detailed Design
    Pick 2-3 components for deep dive.
    Sharding, replication, caching strategy, consistency.

E — Evaluation
    Bottlenecks in your design.
    How does it fail? How does it recover?
    What changes under 10x scale?

D — Distinguishing Factor
    The one thing that shows senior engineering judgment.
    "Here's a non-obvious insight about this system..."
```

---

## 3. Requirements & Estimation Playbook

### Functional Requirements Template

```
Core (must have):
  - [Primary user action 1]
  - [Primary user action 2]

Extended (nice to have, out of scope for now):
  - [Feature 3]
  - [Feature 4]

Explicitly out of scope:
  - [Feature 5]  (tell the interviewer explicitly)
```

### Non-Functional Requirements Cheat Sheet

```
Category        Question to ask                  Typical answer at FAANG scale
────────────    ────────────────────────────    ──────────────────────────────
Scale           How many DAU?                   10M – 1B
Latency         P99 latency budget?             100ms – 2s
Availability    How many 9s?                    99.9% – 99.999%
Consistency     Strong or eventual?             Eventual for feeds, strong for txns
Durability      Can we lose data?               Never for financial; OK for analytics
Geo             Single-region or global?        Global for consumer apps
Read:Write      Ratio?                          10:1 to 100:1 for most apps
```

### Estimation Formula Sheet

```
USERS:
  DAU to QPS (reads): DAU × avg_reads_per_day / 86400
  DAU to QPS (writes): DAU × avg_writes_per_day / 86400
  Peak = average × 2–3x

STORAGE:
  Photos: 1 photo ≈ 200KB (compressed); 1 photo service = 100M photos/day = 20TB/day
  Text:   1 tweet ≈ 300 bytes; 1B tweets/day = 300GB/day
  Video:  1 min HD ≈ 50MB; 100K uploads/day = 5TB/day
  Logs:   1 event ≈ 100 bytes; 1B events/day = 100GB/day

BANDWIDTH:
  Outbound = QPS × avg_response_size
  Example: 100K reads/sec × 1KB/read = 100MB/sec = 800Mbps

CACHE SIZING:
  Pareto principle: 20% of content = 80% of reads
  Cache size = total_data_size × 0.2
  Example: 10TB total → 2TB cache for 80% hit rate

MEMORY:
  Redis: 1 entry ≈ 50-100 bytes overhead + value
  For 10M sessions × 500 bytes = 5GB RAM
```

---

## 4. The Scalability Ladder

Understand what changes at each order of magnitude.

```
Scale Tier        Users         QPS         Storage       Architecture
────────────────  ──────────    ────────    ──────────    ──────────────────────────
Startup           < 10K         < 100       < 100GB       Single server + DB
Growing           10K – 100K    100–1K      100GB–1TB     Add replica, CDN, cache
Medium            100K – 1M     1K–10K      1TB–10TB      Service split, sharding
Large             1M – 10M      10K–100K    10TB–100TB    Multi-region, full microservices
FAANG             > 100M        > 1M        > 1PB         Custom hardware, global mesh
```

### How to Scale Each Component

```
Web Tier:
  Level 1: Single server
  Level 2: Add load balancer (Nginx, HAProxy, ALB)
  Level 3: Auto-scaling group
  Level 4: Edge/CDN serving static assets
  Level 5: Global anycast load balancing

Cache Tier:
  Level 1: In-process cache (HashMap, Guava)
  Level 2: Dedicated cache (Redis, Memcached) — single node
  Level 3: Redis Cluster (hash slots across nodes)
  Level 4: Multi-region cache replication
  Level 5: CDN as L1 cache (for static content)

Database Tier:
  Level 1: Single RDS instance
  Level 2: Add read replicas (read from replicas, write to primary)
  Level 3: Connection pooling (PgBouncer, ProxySQL)
  Level 4: Vertical scaling (largest RDS instance)
  Level 5: Horizontal sharding (by user_id, tenant_id)
  Level 6: CQRS — separate read model (Elasticsearch, DynamoDB) from write model

Message Queue:
  Level 1: No queue — synchronous calls
  Level 2: SQS/Redis for async tasks
  Level 3: Kafka for high-throughput event streaming
  Level 4: Multi-region Kafka with MirrorMaker
```

---

## 5. Data Modeling & Storage Selection

### The Access Pattern First Approach

```
Anti-pattern: "I'll use PostgreSQL."  (picked before knowing access patterns)

Correct approach:
  1. List all queries the system needs:
     - Get user by email (point lookup)
     - Get all posts by user, sorted by time (range scan)
     - Search posts by keyword (full text)
     - Get trending posts in last 1 hour (aggregation)
     - Store user sessions (ephemeral, fast)

  2. Match queries to storage:
     - Point lookups → any DB, Redis for hot data
     - Range scans → SQL (indexes), Cassandra (partition key)
     - Full text → Elasticsearch, Postgres with tsvector
     - Aggregations → SQL, Spark/Presto for huge scale
     - Ephemeral sessions → Redis
```

### Denormalization for Read Performance

```
Normalized (write-optimized):
  users: (user_id, name, email)
  posts: (post_id, user_id, content, created_at)
  likes: (like_id, post_id, user_id)

  Query: "Get feed for user X with author names and like counts"
  SELECT p.*, u.name, COUNT(l.like_id) as likes
  FROM posts p
  JOIN users u ON p.user_id = u.user_id
  LEFT JOIN likes l ON p.post_id = l.post_id
  WHERE p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = X)
  GROUP BY p.post_id, u.name
  ORDER BY p.created_at DESC LIMIT 20;
  
  → 4-table join, slow at scale

Denormalized (read-optimized):
  feed_items: {
    post_id, user_id, author_name, author_avatar,   ← denormalized from users
    content, created_at, like_count, comment_count, ← denormalized/cached counters
    is_liked_by_viewer                              ← precomputed
  }
  
  Query: SELECT * FROM feed_items WHERE user_id = X ORDER BY created_at DESC LIMIT 20
  → Single table scan, fast

Tradeoff:
  Denormalization = write complexity (update author_name everywhere if user changes name)
  Normalization = read complexity (joins)
  
  At FAANG scale: reads >> writes → almost always denormalize hot read paths
```

### The Fan-Out Problem (News Feed Classic)

```
Push model (fan-out on write):
  When Alice posts:
    For each of Alice's 1M followers:
      INSERT INTO follower_feed (user_id=follower, post_id=p.id)
  
  Read: SELECT * FROM feed WHERE user_id = me → instant (pre-computed)
  
  Problem: Celebrity with 1M followers → 1M writes per post
           Slow write, fast read

Pull model (fan-out on read):
  When Alice posts:
    INSERT INTO posts (post_id, author_id, ...)  ← just one write
  
  Read: SELECT p.* FROM posts p
        JOIN follows f ON p.author_id = f.followee_id
        WHERE f.follower_id = me
        ORDER BY created_at DESC LIMIT 20
  
  Problem: If you follow 1000 people → merge/sort 1000 query results
           Slow read, fast write

Hybrid (Twitter/Instagram approach):
  Regular users (< 10K followers): push model
  Celebrities (> 10K followers): pull model at read time
  
  Read:
    1. Get pre-computed feed (push model users)
    2. Fetch latest posts from celebrities (pull model)
    3. Merge and sort the two
    
  Best of both worlds but more complex.
```

> 🌍 **Real-World:** Twitter uses exactly the hybrid fan-out architecture described here — regular users' tweets are fanned out to follower Redis lists at write time, but tweets from accounts with >1M followers (Katy Perry, Barack Obama) are fetched at read time and merged client-side. After Twitter's 2013 "fail whale" era, they redesigned their fan-out system to use an async Kafka-based fan-out worker that can absorb spikes: when a celebrity posts, the fan-out job is queued rather than executed synchronously, preventing the write path from blocking. Instagram's feed switched from push-only to hybrid in 2018 when accounts with millions of followers were causing multi-second latency spikes for their fan-out workers.

---

## 6. Read-Heavy Patterns Playbook

### Caching Strategies

```
Cache-Aside (Lazy Loading) — most common:
  Read:
    1. Check cache
    2. HIT → return from cache
    3. MISS → query DB → store in cache → return
  
  Write:
    1. Write to DB
    2. Invalidate cache (or let it expire)
  
  ✅ Only hot data cached (natural eviction of cold data)
  ❌ Cache miss = 3 round trips (check cache + DB + set cache)
  ❌ Cold start: first requests always miss

Write-Through — write to cache AND DB simultaneously:
  Write:
    1. Write to cache
    2. Write to DB (synchronously)
    3. Return success
  
  Read:
    1. Check cache
    2. Always a HIT (unless evicted by LRU)
  
  ✅ Cache always consistent
  ❌ Every write hits both cache and DB (higher write latency)
  ❌ Caches infrequently-read data (wastes memory)

Write-Behind (Write-Back) — async DB write:
  Write:
    1. Write to cache immediately (return fast)
    2. Queue the DB write asynchronously
  
  ✅ Very low write latency
  ❌ Risk of data loss if cache crashes before DB write
  Use for: high-write scenarios where some data loss acceptable
           (metrics, analytics, view counts)

Read-Through — cache handles DB reads itself:
  Same as cache-aside but cache populates itself.
  Application only talks to cache; cache talks to DB on miss.
  
  ✅ Application code simpler (just query cache)
  ❌ Cache must know the DB schema (tight coupling)
  Rare in practice for custom systems; used in ORM-level caches (Hibernate)
```

### CDN as a Cache Layer

```
Static content (images, JS, CSS, video):
  Application → S3/origin → CloudFront CDN → User
  CDN cache hit rate: 90–99%
  
  Design principle: 
    Cache as close to user as possible
    L1: Browser cache (private)
    L2: CDN edge (public, shared)
    L3: CDN origin shield (aggregated)
    L4: Application cache (Redis)
    L5: Database

Dynamic content:
  Use Edge Side Includes (ESI) to cache page fragments.
  Use Cloudflare Workers / Lambda@Edge for personalization at edge.
  Use surrogate keys (cache tags) for fine-grained purging.
```

> 🌍 **Real-World:** Netflix's Open Connect CDN embeds dedicated appliances directly inside ISP data centers — instead of delivering video from AWS, Netflix pre-positions entire content catalogs on these appliances nightly. During peak hours, 95%+ of Netflix traffic is served from ISP-embedded Open Connect boxes, with zero AWS bandwidth costs for that traffic. Amazon CloudFront serves 100M+ requests/second at peak globally, and their "Origin Shield" feature aggregates all cache misses from 300+ edge locations through a single shield PoP — reducing origin hits by 60%+ for large-scale deployments like Amazon.com's product images.

### Read Replicas

```
Primary (writes)
      │
      ├──► Replica 1 (reads, same region)
      ├──► Replica 2 (reads, same region)
      └──► Replica 3 (reads, different region — disaster recovery)

Replication lag:
  Synchronous: Primary waits for replica ACK → no data loss, higher write latency
  Asynchronous: Primary doesn't wait → replica may be 1–100ms behind

When to use synchronous:
  Financial data, inventory where replica reads must be fresh.

When to use asynchronous (more common):
  Feeds, profiles, content where slight staleness is fine.

Read routing:
  Hot reads (user profile just updated): route to primary to avoid lag
  Analytical reads: dedicated read replica
  General reads: round-robin across replicas
```

---

## 7. Write-Heavy Patterns Playbook

### Write Buffering and Batching

```
Instead of writing each event immediately, batch them:

Without batching:
  10,000 write events/sec → 10,000 DB inserts/sec → DB overwhelmed

With batching:
  10,000 write events/sec → buffer for 100ms → 1 batch insert (1,000 rows/batch)
  100 batch inserts/sec → DB can handle
  
  Trade: slight delay (100ms) for 100x throughput improvement

Kafka as write buffer:
  Application → Kafka → Consumer batch-writes to DB
  
  Kafka absorbs write spikes.
  Consumer can be tuned for batch efficiency.
  Pattern used by: analytics pipelines, event sourcing, CDC
```

> 🌍 **Real-World:** Pinterest uses Kafka as a write buffer for their analytics pipeline — 800M+ monthly active users generate billions of pin, click, and save events daily. Instead of writing each event directly to their data warehouse, Pinterest buffers all events in Kafka and batch-writes to HBase and Hadoop every 5 minutes, achieving 10× throughput improvement. Twitter's "Manhattan" distributed key-value store uses write-behind batching for like and retweet counts — counts are incremented in Redis immediately (serving read requests) and asynchronously flushed to Manhattan in batches of 10,000, which Twitter's engineering team found acceptable for analytics without impacting feed latency.

### CQRS (Command Query Responsibility Segregation)

```
Traditional: Single data model for reads AND writes
  Write: INSERT/UPDATE to PostgreSQL
  Read:  SELECT with complex JOINs from PostgreSQL
  Problem: Write schema optimized for ACID; read schema needs joins

CQRS: Separate read and write models

Write side (Command):
  POST /orders → OrderService → PostgreSQL (normalized, ACID)
  
  OrderCreated event → Kafka

Read side (Query):
  Kafka consumer → denormalized read store (Elasticsearch or DynamoDB)
  GET /orders/{id} → reads from Elasticsearch (fast, no joins needed)

Benefits:
  ✅ Write model optimized for ACID and consistency
  ✅ Read model optimized for query performance
  ✅ Can scale read replicas independently
  
Costs:
  ❌ Eventual consistency between write and read models
  ❌ More infrastructure to maintain
  ❌ Debugging harder (data in two places)

Use when:
  Complex read queries that don't fit write schema.
  Different scaling needs for reads vs writes.
  Full-text search, faceted search, aggregations over relational data.
```

### Event Sourcing

```
Traditional (state-based):
  DB stores current state only.
  UPDATE orders SET status='shipped' WHERE id=123
  → Lost: what was the status before? Who changed it? When?

Event Sourcing:
  DB stores ALL events (immutable append-only log).
  
  Event log for order #123:
    {event: "OrderPlaced",    timestamp: T1, data: {items: [...], total: 99}}
    {event: "PaymentReceived",timestamp: T2, data: {method: "card"}}
    {event: "OrderShipped",   timestamp: T3, data: {tracking: "1Z..."}}
  
  Current state = replay all events from beginning.
  
Benefits:
  ✅ Full audit trail (compliance, debugging)
  ✅ Replay to rebuild state (or fix bugs)
  ✅ Multiple read projections from same event log
  ✅ Natural fit for CQRS
  
Costs:
  ❌ Snapshot optimization needed (can't replay 5 years of events on every read)
  ❌ Schema evolution is hard (old events still must be processable)
  ❌ More complex than simple CRUD
  
Use when:
  Audit trail required (finance, healthcare, e-commerce)
  Undo/redo functionality
  Complex domain with many state transitions
  Event-driven microservices
```

> 🌍 **Real-World:** Axon Framework (used by ING Bank, bol.com) implements event sourcing for core banking operations — every account debit, credit, and transfer is an immutable event, giving regulators a perfect audit trail. Kafka itself is essentially an event store, and companies like Confluent promote "Kafka as the system of record" pattern. LMAX Exchange uses event sourcing for their order book — on startup, they replay the Kafka event log from the latest snapshot to reconstruct the full in-memory state in seconds, making crash recovery trivial. Spotify uses event sourcing for their playlist service: every song add, remove, and reorder is an event, enabling features like "undo last change" and collaborative playlist editing.

---

## 8. Distributed Systems Fundamentals

### Consensus and Coordination

```
Why consensus is needed:
  In distributed systems, nodes can fail or get partitioned.
  How do you agree on who is the leader? What value is committed?

Raft (used by etcd, CockroachDB, TiKV, Kafka KRaft):
  - Leader election: candidate requests votes from majority
  - Log replication: leader appends, replicates to majority, then commits
  - Safety: a log entry is committed only if on majority of nodes
  - Readable: simpler to understand than Paxos

Paxos (used by Spanner, Chubby):
  - Multi-Paxos: classic but complex
  - Foundation of many distributed databases

ZooKeeper (used by old Kafka, HBase, Hadoop):
  - ZAB protocol (Zookeeper Atomic Broadcast)
  - Provides: distributed lock, leader election, config management
  - Being replaced by etcd in modern stacks
```

> 🌍 **Real-World:** etcd (Raft-based) is the brain of every Kubernetes cluster — it stores all cluster state (pod assignments, service IPs, config maps) and uses Raft to ensure that a leader crash never loses a committed state change. Google's Chubby lock service (Paxos-based) underpins Bigtable, GFS, and Spanner; a single Chubby outage can cascade across Google's entire infrastructure, which is why they run multiple independent Chubby cells. CockroachDB uses Raft per range (16MB data shards) — a 1PB database would have ~64,000 independent Raft groups running simultaneously, each with its own leader election and log replication.

### Distributed Transactions

```
Two-Phase Commit (2PC):
  Phase 1 (Prepare):
    Coordinator asks all participants: "Can you commit?"
    Each participant: locks resources, writes to log, votes YES/NO
  
  Phase 2 (Commit/Abort):
    If ALL voted YES: Coordinator sends COMMIT to all
    If ANY voted NO: Coordinator sends ABORT to all
  
  Problem: Coordinator crashes after some participants committed → 
           blocking (other participants wait forever)
  Use for: small number of participants, short transactions

Saga Pattern (preferred for microservices):
  Long-running transactions broken into a sequence of local transactions.
  Each step publishes event. On failure: compensating transactions.
  
  Order saga:
    1. CreateOrder (pending)
    2. ReserveInventory → success → emit InventoryReserved
    3. ProcessPayment → success → emit PaymentProcessed
    4. ConfirmOrder → success → emit OrderConfirmed
    
    If ProcessPayment fails:
    3a. PaymentFailed event emitted
    2a. ReleaseInventory (compensating transaction)
    1a. CancelOrder (compensating transaction)
  
  Choreography (event-driven): each service reacts to events
  Orchestration (workflow): central coordinator sends commands
  
  ✅ No distributed lock, no coordinator bottleneck
  ❌ Compensating transactions must be carefully designed
  ❌ Eventual consistency (intermediate states visible)
```

> 🌍 **Real-World:** Uber's payment system uses an orchestration-based Saga for their trip payment flow — a central "Trip Payment Orchestrator" service drives the sequence: charge rider → pay driver → update ledger → send receipt. If any step fails, the orchestrator explicitly triggers compensating transactions. This approach gives Uber full visibility into payment state even during partial failures, critical when real money is involved. Netflix uses choreography-based Sagas for their signup flow — each service (Identity, Billing, Recommendations) independently reacts to `UserRegistered` events and performs its step asynchronously, allowing the signup endpoint to return immediately while downstream steps complete.

### Distributed Locking

```
Redis-based distributed lock (Redlock):

  import redis
  import uuid
  import time

  def acquire_lock(redis_client, lock_name, ttl_ms=5000):
      lock_id = str(uuid.uuid4())
      # SET key value NX PX ttl
      # NX = only set if not exists
      # PX = expire in milliseconds
      result = redis_client.set(
          f"lock:{lock_name}", lock_id,
          nx=True, px=ttl_ms
      )
      return lock_id if result else None

  def release_lock(redis_client, lock_name, lock_id):
      # Lua script: compare-and-delete (atomic)
      script = """
      if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
      else
          return 0
      end
      """
      redis_client.eval(script, 1, f"lock:{lock_name}", lock_id)

  # Usage
  lock_id = acquire_lock(r, "payment-processing-123")
  if lock_id:
      try:
          process_payment(order_id=123)
      finally:
          release_lock(r, "payment-processing-123", lock_id)
  else:
      raise LockNotAcquiredException("Payment already being processed")

Caveat: Redis single-node lock is not truly fault-tolerant.
Redlock (5-node Redis quorum) provides better guarantees but 
has theoretical issues (see Martin Kleppmann's critique).
For strong guarantees: use ZooKeeper or etcd-based locks.
```

> 🌍 **Real-World:** Redis distributed locks (using the SET NX PX pattern) are used by Shopify's job processing system to prevent duplicate execution of inventory reservation jobs — each job acquires a Redis lock keyed by order_id before processing, ensuring two workers don't simultaneously reserve the same inventory. The Antirez (Redis creator) vs Martin Kleppmann debate over Redlock's safety guarantees (2016) is one of the most important distributed systems discussions in recent years — Kleppmann showed that even Redlock can fail under GC pauses or clock skew, leading to the recommendation that fencing tokens (ZooKeeper's `zxid`) are necessary for truly safe distributed locking when correctness is critical.

---

## 9. Canonical System Designs

### URL Shortener (bit.ly)

```
Requirements:
  - Shorten URL to 7-char code
  - Redirect short URL to original
  - 100M URLs total, 10K redirects/sec

Key insight: read:write ratio = 1000:1 → optimize reads

URL code generation:
  Option 1: Base62 encode auto-increment ID
    ID: 1234567 → base62("1234567") = "5kh8X"
    Problem: sequential, predictable, exposes volume
  
  Option 2: Random 7-char base62 (collision-checked)
    Random string, check DB for collision, retry if collision
    Very low collision probability with 62^7 = 3.5 trillion possibilities
  
  Option 3: MD5 hash of URL, take first 7 chars
    Hash("https://example.com") → "a4b5c6d" (7 chars)
    Risk: hash collision for different URLs (rare but possible)

Storage:
  urls: (short_code [PK], original_url, created_at, user_id, expiry)
  
  short_code as partition key in DynamoDB or Redis.
  Bloom filter to quickly reject codes that definitely don't exist.

Caching (critical for 10K redirects/sec):
  Redis: short_code → original_url
  TTL: same as URL expiry
  Cache hit rate should be 99%+ (popular URLs hit repeatedly)
  
  With 100M URLs but only 1M active: 1M × 100 bytes = 100MB RAM for hot URLs.

Redirect type:
  301 Moved Permanently: browser caches redirect, reduces load
    → Can't update the destination, can't track clicks accurately
  302 Found (Temporary): browser always checks our server
    → Full analytics, can update destination
    → More load on our servers
```

> 🌍 **Real-World:** Bitly handles 10B+ redirects/month with a Redis-first architecture — the entire active URL dataset fits in RAM, making redirects a pure in-memory lookup with sub-millisecond latency. They use a Bloom filter as a pre-check: if the code isn't in the Bloom filter, skip the Redis/DB lookup entirely and return 404 immediately, saving ~30% of compute on invalid code requests. Google's own URL shortener (goo.gl, now defunct) used their global Bigtable infrastructure for storage and served all redirects from globally distributed edge caches — their 2018 shutdown announcement noted they processed billions of redirects even after deprecating new URL creation.

### Distributed Key-Value Store

```
Requirements:
  - Put(key, value) and Get(key) operations
  - 1PB total data, 1M writes/sec, 10M reads/sec
  - 99.99% availability
  - Eventual consistency acceptable

Design choices:
  Consistent hashing for distribution
  Replication factor N=3
  Write quorum W=2
  Read quorum R=2
  W + R > N → strong consistency (but we chose eventual, so R=1)

Architecture:
  Client → Coordinator node (picks responsible nodes via consistent hash ring)
  
  Write: Coordinator writes to N=3 replicas
         Returns OK after W=2 ACKs (async 3rd replica)
         
  Read:  Coordinator reads from R=1 replica
         May return stale data (acceptable)

Conflict resolution:
  Vector clocks: each write increments version per node
  Last-Write-Wins (LWW): if conflict, keep latest timestamp
  Merkle trees: efficient comparison of data between replicas for anti-entropy repair

Gossip protocol:
  Nodes share membership and health via gossip (Cassandra, DynamoDB style)
  Each node talks to random other node every second
  Cluster state propagates in O(log N) rounds
  No single coordinator for membership (avoids bottleneck)
```

> 🌍 **Real-World:** Amazon DynamoDB is the closest real-world implementation of this exact design — consistent hashing for distribution, configurable R/W quorums, vector clocks for conflict detection (later simplified to Last-Write-Wins), and a gossip protocol for membership. The original Amazon Dynamo paper (2007) describes this architecture in full and directly influenced Cassandra (built by ex-Amazon engineers at Facebook). Apache Cassandra stores Discord's 4B+ messages using N=3 replication with QUORUM reads/writes, giving them tunable consistency — they use LOCAL_QUORUM so that a data center partition doesn't cause US users to see errors because an EU replica is unreachable.

### Rate Limiter

```
Requirements:
  - Limit requests per user per time window
  - 10M users, 100K requests/sec total
  - Consistent across distributed API servers

Core: Redis-based token bucket per user

Architecture:
  ┌────────────┐        ┌───────────────────┐        ┌──────────────┐
  │  Client    │──────► │   API Gateway     │──────► │  Backend     │
  │            │        │   Rate Limiter    │        │  Service     │
  │            │◄───────│   (checks Redis)  │        │              │
  │            │  429   └────────┬──────────┘        └──────────────┘
  │            │                 │ Lua script
  │            │                 ▼
  │            │          ┌──────────────┐
  │            │          │  Redis Cluster│
  │            │          │  user_id →   │
  │            │          │  token count │
  │            │          └──────────────┘

Headers returned:
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 750
  X-RateLimit-Reset: 1717000000 (Unix timestamp)
  Retry-After: 30 (seconds, only on 429)

Distributed consideration:
  Rate limiting state in Redis cluster (not per-server)
  Lua script for atomic token bucket operation
  Redis Cluster for HA and horizontal scaling

Soft vs Hard limits:
  Hard: reject when limit exceeded (returns 429)
  Soft: allow slight overage, log/alert (for graceful degradation)
  Throttling: allow but slow down (queue instead of reject)
```

> 🌍 **Real-World:** Twitter's rate limiter enforces per-user, per-app, and per-endpoint limits simultaneously using a hierarchical Redis-backed token bucket. Their API limits (e.g., 900 GET requests per 15-minute window for user timeline) are documented publicly and enforced at the API gateway layer before requests reach any backend service. Cloudflare's rate limiting product processes 1T+ events/month across customer domains using their distributed in-memory counters (built on their own KV store) — they built the sliding window approximation described in this document because storing exact timestamps for every request at that scale would require petabytes of RAM.

### Search Autocomplete

```
Requirements:
  - Real-time autocomplete as user types
  - Top 5 suggestions for each prefix
  - Update suggestions based on search frequency
  - 10M users, 10K QPS

Trie approach (in-memory for small dataset):
  Store all phrases in a Trie.
  At each node, precompute top-5 suggestions.
  Query: traverse prefix, return top-5 at last node.
  Problem: too large for memory at web scale (millions of phrases)

Better: Prefix hash table backed by Redis:
  Key: prefix (e.g., "ap")
  Value: sorted set of {phrase: score}
  Score: search frequency

  ZREVRANGE "ac:ap" 0 4  → [("apple", 10000), ("app store", 8000), ...]

  Aggregation pipeline:
    Search event → Kafka → Spark Streaming →
    Count phrases per 1-hour window →
    Update Redis sorted sets every 15 minutes

Prefix fanout:
  "apple" → store in prefixes: a, ap, app, appl, apple
  Each prefix update = O(word_length) Redis writes

  Optimization: only store prefixes of minimum length (e.g., ≥ 2 chars)

Typo tolerance:
  For "teh" → suggest "the"
  Use edit distance (Levenshtein) on top candidates
  Or use n-gram indexing for fuzzy matching
```

> 🌍 **Real-World:** Google Search autocomplete handles 3.5B+ queries/day with sub-50ms autocomplete latency globally using a multi-tier prefix cache — the most popular prefix completions are served from RAM on every front-end server (L1), longer-tail completions from a distributed Redis cluster (L2), and rare completions computed on-the-fly from an inverted index. Uber Eats uses Redis sorted sets for real-time restaurant autocomplete — restaurant names are indexed by prefix with scores updated every 15 minutes based on recent orders, surface order, and distance, giving locally-relevant results. LinkedIn's "People You May Know" typeahead completes on partial names against 900M+ profiles using Lucene prefix queries on sharded indexes, achieving p99 latency of 80ms.

---

## 10. Tradeoff Vocabulary

Speak the language of distributed systems in interviews.

```
Consistency models (from strongest to weakest):
  Linearizability — reads always see latest write (appears instantaneous)
  Sequential Consistency — all operations appear in some sequential order
  Causal Consistency — causally related operations seen in order
  Eventual Consistency — replicas eventually converge (may see stale reads)
  Read-Your-Write — you always see your own writes (not others' latest)

Failure modes:
  Crash failure — node stops, doesn't recover
  Omission failure — node drops messages (network issue)
  Byzantine failure — node sends incorrect/malicious data (rare in practice)

Replication strategies:
  Single-leader — all writes to one leader, replicate to followers
  Multi-leader — writes to any of N leaders (conflict resolution needed)
  Leaderless — writes to any N nodes (Dynamo-style, use quorums)

Partitioning synonyms:
  Sharding = horizontal partitioning = splitting data by rows
  Vertical partitioning = splitting by columns (rare)
  
Storage types:
  OLTP (Online Transaction Processing) — row-oriented, transactional (PostgreSQL)
  OLAP (Online Analytical Processing) — column-oriented, batch analytics (Redshift)
  HTAP (Hybrid) — both (TiDB, CockroachDB)

Network:
  Latency — time for one packet from A to B
  Throughput — data transferred per second
  Bandwidth — maximum possible throughput
  Jitter — variance in latency
  Packet loss — % of packets dropped

Availability calculation:
  99%    = 3.65 days downtime/year
  99.9%  = 8.76 hours/year
  99.99% = 52.6 minutes/year
  99.999% = 5.26 minutes/year
```

---

## 11. Common Mistakes & Anti-Patterns

### In the Interview Room

```
❌ Jumping straight to coding or detailed design
   ✅ Always clarify requirements first

❌ Only designing the happy path
   ✅ Discuss failure modes, retries, circuit breakers

❌ Picking a tech without justification
   ✅ "I chose Kafka here because we need replay; 
       if replay wasn't a requirement I'd consider SQS for simpler ops"

❌ Staying too high-level (only boxes and arrows)
   ✅ Pick 2 components and go deep on them

❌ Ignoring scale
   ✅ Always ask: "What breaks first at 10x scale?"

❌ Making everything synchronous
   ✅ Identify where async + message queue decouples services

❌ Single database for everything
   ✅ Use polyglot persistence: the right DB for each access pattern

❌ Not discussing consistency tradeoffs
   ✅ Explicitly say: "For the feed, eventual consistency is fine. 
       For payments, I'd need strong consistency."

❌ Starting with microservices for a new system
   ✅ "I'd start monolithic and extract services when there's a clear bottleneck"
```

### Common Architecture Anti-Patterns

```
N+1 Problem:
  Get 100 posts → for each post, query author info → 101 DB queries
  Fix: JOIN, or batch fetch (SELECT * FROM users WHERE id IN (...))

Distributed Monolith:
  Microservices that are tightly coupled.
  Deploying service A requires coordinating with B, C, D.
  Just as bad as a monolith, but with network overhead.
  Fix: Design services around bounded contexts (DDD).

Chatty Services:
  Service A calls B 10 times per request.
  Fix: Batch API, GraphQL, or merge services.

Synchronous Chain:
  Service A → B → C → D → response
  Entire chain must be fast and healthy.
  Fix: Identify which downstream calls can be async.

Premature Optimization:
  Designing for 1B users when you have 1K users.
  Fix: Design for next 10x; leave explicit extension points.
  "We'd move from single DB to sharded when we hit 100K QPS."
```

---

## 12. How Interviewers Score You

### The Engineering Levels and What They Expect

```
L3/SWE I — Junior:
  Can design simple two-tier systems.
  Knows basic DB, cache, load balancer concepts.
  Needs prompting for scale and failure modes.

L4/SWE II — Mid:
  Designs multi-service systems.
  Understands caching strategies, DB indexes, queues.
  Initiates failure discussion with prompting.

L5/Senior:
  Designs for 10-100x scale without prompting.
  Identifies bottlenecks and proposes solutions.
  Knows multiple approaches and tradeoffs for each component.
  Drives the conversation.

L6/Staff:
  Designs for 1000x scale.
  Proposes non-obvious optimizations.
  Discusses organizational/operational concerns.
  "How does this system evolve over 2 years?"
  Identifies which requirements are actually the hardest.

L7/Principal:
  Challenges the requirements themselves.
  Designs across systems, not just one.
  Discusses industry patterns and what others do wrong.
```

### Signal Phrases That Score Points

```
"The most interesting tradeoff here is..."
"This will be the first thing to break at 10x scale..."
"A simpler approach would work at this scale, but here's why I'd choose..."
"I'd use eventual consistency here because..."
"The boundary between these two services is actually the hard part..."
"Here's a non-obvious optimization: ..."
"What I'd measure to validate this design is..."
"The failure mode I'm most worried about is..."
"If I had to simplify this design, I'd cut..."
```

---

*Last updated: May 2026*
*Part of the 3-Month FAANG Preparation Program*
*See also: Month-2/CDN-MessageQueue.md, Month-2/FAANG-System-Design.md*


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (System Design Meta)

| # | Concept | Done |
|---|--------|------|
| 1 | RESHADED / FR→NFR→Estimate→Design→Deep dive→Failures time budget | [ ] |
| 2 | Back-of-envelope: 1M/day ≈ 12 QPS; storage/bandwidth math | [ ] |
| 3 | Scalability ladder: vertical → cache → replicas → shard → CQRS | [ ] |
| 4 | Read-heavy vs write-heavy pattern catalogs | [ ] |
| 5 | Explicit tradeoff sentences in every design | [ ] |
| 6 | Failure modes called out before interviewer asks | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Depth on one critical path beats shallow coverage of ten buzzwords.

---

## 🛠️ PRACTICAL — Handbook Labs

### Lab 1: Estimation Speed
For URL shortener / WhatsApp / YouTube: compute QPS, storage/year, bandwidth in ≤ 5 minutes each.

### Lab 2: Tradeoff Drill
For caching strategy, queue choice, SQL vs NoSQL — give Option A/B + recommendation tied to constraints.

### Lab 3: Anti-Pattern Audit
Redesign a past mock and list which handbook anti-patterns you hit.
