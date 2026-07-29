# SDE-3 Real Interview Questions & Answers

Sourced from Glassdoor, Blind, LeetCode Discuss, and verified engineering blogs (Google, Meta, Amazon, Uber, Microsoft, Netflix, Stripe, Atlassian). Covers all rounds of a senior loop.

---

## Table of Contents

- [How SDE-3 Differs from SDE-2](#how-sde-3-differs-from-sde-2)
- [Section 1: System Design (HLD)](#section-1-system-design-hld)
  - [Q1. Design a URL Shortener](#q1-design-a-url-shortener-like-bitly)
  - [Q2. Design Twitter/X Feed](#q2-design-twitterx-feed-news-feed--timeline)
  - [Q3. Design a Distributed Rate Limiter](#q3-design-a-distributed-rate-limiter)
  - [Q4. Design a Notification System](#q4-design-a-notification-system-push-email-sms)
  - [Q5. Design Google Drive / Dropbox](#q5-design-google-drive--dropbox-file-storage-system)
  - [Q6. Design a Search Autocomplete System](#q6-design-a-search-autocomplete-system)
  - [Q7. Design a Payments System](#q7-design-a-payments-system-like-stripe)
- [Section 2: Low-Level Design (LLD)](#section-2-low-level-design-lld)
  - [Q8. Design a Thread-Safe LRU Cache](#q8-design-a-thread-safe-lru-cache)
  - [Q9. Design Parking Lot System](#q9-design-parking-lot-system)
  - [Q10. Design a Task Scheduler / Cron System](#q10-design-a-task-scheduler--cron-system)
  - [Q11. Design Snake and Ladder Game (OOP)](#q11-design-snake-and-ladder-game-oop)
- [Section 3: DSA / Coding](#section-3-dsa--coding)
  - [Q12. Find Median from Data Stream](#q12-find-median-from-data-stream)
  - [Q13. LRU Cache (LC 146)](#q13-lru-cache-lc-146)
  - [Q14. Merge K Sorted Lists (LC 23)](#q14-merge-k-sorted-lists-lc-23)
  - [Q15. Design Hit Counter / Sliding Window Rate Limiter](#q15-design-hit-counter--sliding-window-rate-limiter)
  - [Q16. Word Ladder II (LC 126)](#q16-word-ladder-ii-lc-126--hard)
  - [Q17. Serialize and Deserialize Binary Tree (LC 297)](#q17-serialize-and-deserialize-binary-tree-lc-297)
  - [Q18. Alien Dictionary (LC 269)](#q18-alien-dictionary-lc-269--premium)
- [Section 4: Distributed Systems Deep Dive](#section-4-distributed-systems-deep-dive)
  - [Q19. Google Spanner External Consistency](#q19-how-does-google-spanner-achieve-external-consistency)
  - [Q20. 2PC vs Saga Pattern](#q20-explain-the-difference-between-2pc-and-saga-when-to-use-each)
  - [Q21. Cache Invalidation at Scale](#q21-how-would-you-handle-cache-invalidation-at-scale)
- [Section 5: Production Engineering](#section-5-production-engineering)
  - [Q22. Debugging p99 Latency Spikes](#q22-your-services-p99-latency-spiked-walk-me-through-your-debug-process)
  - [Q23. Zero-Downtime Deployments](#q23-how-do-you-design-for-zero-downtime-deployments)
  - [Q24. Distributed Tracing from Scratch](#q24-explain-how-youd-implement-distributed-tracing-from-scratch)
- [Section 6: Behavioral / Leadership](#section-6-behavioral--leadership)
  - [Q25. Driving a Major Technical Decision](#q25-tell-me-about-a-time-you-drove-a-major-technical-decision-that-had-org-wide-impact)
  - [Q26. Dealing with Technical Debt](#q26-describe-a-time-you-had-to-deal-with-significant-technical-debt-what-did-you-do)
  - [Q27. Handling a Blocking Team Member](#q27-a-team-member-is-consistently-late-on-deliverables-and-blocking-your-project-what-do-you-do)
  - [Q28. Prioritizing Multiple High-Priority Projects](#q28-how-do-you-prioritize-when-you-have-3-high-priority-projects-simultaneously)
- [Section 7: Database & Infrastructure](#section-7-database--infrastructure)
  - [Q29. How Database Indexes Work](#q29-how-does-a-database-index-work-what-are-the-tradeoffs)
  - [Q30. Kafka Exactly-Once Semantics](#q30-how-does-kafka-guarantee-exactly-once-semantics)
- [Quick-Fire Questions](#quick-fire-questions)
- [Interview Tips for SDE-3](#interview-tips-for-sde-3)

---

## How SDE-3 Differs from SDE-2

```text
SDE-2 → Can execute a given solution well
SDE-3 → Defines what should be built and why; owns the tradeoffs

Interviewers test:
  • Ambiguity handling — you ask clarifying questions, set scope
  • Scale thinking — you proactively mention bottlenecks before asked
  • Leadership signal — you talk about driving tech decisions, not just implementing them
  • Cross-functional impact — you consider ops, security, cost, team velocity
```

---

## Section 1: System Design (HLD)

---

### Q1. Design a URL Shortener (like bit.ly)
**Asked at:** Google, Amazon, Microsoft, Uber

**Clarifying questions to ask:**
- How many URLs shortened per day? (assume 100M/day writes, 10B/day reads)
- URL expiry needed?
- Analytics needed (click count, geo)?
- Custom aliases?

**Answer:**

**Core components:**
```text
Client → Load Balancer → API Servers → Cache (Redis) → DB (Cassandra/MySQL)
                                          ↓
                                   Analytics Pipeline (Kafka → Spark → OLAP)
```

> **💡 Key Design Decision:** Choose between MD5 hashing, Base62 encoding, or Snowflake IDs. Base62 with a Snowflake ID is the most production-ready option — no collisions, distributed-friendly, and time-sortable.

**Encoding algorithm:**
```text
Option A: MD5 hash → take first 7 chars
  Problem: collision, long hash computation

Option B: Base62 encode an auto-increment ID
  62^7 = 3.5 trillion URLs — enough
  Pros: no collision, predictable, fast
  Cons: sequential = guessable (use counter + random salt)

Option C: Snowflake ID → Base62
  Best: unique, time-sortable, distributed-friendly
```

**DB choice:**
- **MySQL** for <10M URLs (simple, ACID)
- **Cassandra** for 100M+ (write-heavy, wide column, hash-partitioned by short_code)

**Caching:**
- 20% of URLs get 80% of traffic → cache top 20% in Redis
- TTL = 24h, eviction = **LRU**
- Read path: Redis → DB (cache-aside)

**Redirect flow:**
```text
GET /abc123 → Cache hit? → 301 (permanent, browser caches) or 302 (track every hit)
Use 302 if analytics needed. 301 reduces load but loses click data.
```

> **💡 Key Design Decision:** Use HTTP 302 (temporary redirect) instead of 301 (permanent redirect) when analytics are required. 301 lets the browser cache the redirect, cutting server load but losing every subsequent click event.

**Scale numbers:**
```text
100M writes/day = ~1200 writes/sec
10B reads/day   = ~115,000 reads/sec
Redis handles 100k+ ops/sec easily
Cassandra: partition by short_code hash, 3 replicas
```

> **⚠️ Scale Challenge:** At 115k reads/sec, a single Redis node may not suffice under peak load. Add read replicas and shard by consistent hashing on `short_code`.

**Follow-up: Custom aliases?**
- Store in same table with `is_custom` flag
- Add unique index on `short_code`
- Rate-limit custom alias creation

> 🌍 **Real-World:** Bitly processes ~10 billion redirects per month and stores its URL mappings in a combination of MySQL (source of truth) and Redis (cache). They use HTTP 302 redirects (not 301) to preserve analytics for every click event, which feeds into their link analytics dashboard. TinyURL, by contrast, uses 301 permanent redirects and therefore cannot track return visits — a deliberate tradeoff that eliminates their server load on repeat clicks at the cost of click analytics.

---

### Q2. Design Twitter/X Feed (News Feed / Timeline)
**Asked at:** Meta, Twitter/X, Google, Uber

**Clarifying questions:**
- Push or pull model? (depends on celebrity vs normal user)
- How many followers? (normal: 200 avg, celebrity: 10M+)
- Real-time vs eventual consistency?
- Media (images/video) or text only?

**Answer:**

**Two models:**

> **💡 Key Design Decision:** Neither pure fan-out-on-write nor pure fan-out-on-read works at scale. Twitter uses a **hybrid model** based on follower count threshold.

```text
Fan-out on write (Push model):
  When user A tweets → write to all followers' feed tables immediately
  Pro: fast reads (pre-computed feed)
  Con: celebrity with 10M followers = 10M writes per tweet (write amplification)

Fan-out on read (Pull model):
  When user requests feed → fetch tweets from all followed accounts, merge, sort
  Pro: no write amplification
  Con: slow reads — need to merge N accounts per request

Hybrid (what Twitter uses):
  Normal users (<10k followers): fan-out on write
  Celebrities (>10k followers): fan-out on read, merged at request time
  Threshold is configurable
```

> **⚠️ Scale Challenge:** A celebrity with 10M followers triggering fan-out-on-write causes 10M DB writes per tweet — a write storm. Switching celebrities to fan-out-on-read eliminates this entirely.

**Data model:**
```sql
tweets(tweet_id, user_id, content, created_at, media_url)
follows(follower_id, followee_id, created_at)
feed(user_id, tweet_id, created_at)  -- pre-computed for non-celebrities
```

**Feed generation:**
```text
Tweet created → Kafka event → FeedFanout service
  → for each follower (non-celebrity): insert into feed table
  → feed table: Redis sorted set (score = timestamp), capped at 800 entries
  → On read: merge celebrity tweets (pulled) + pre-computed feed (pushed)
```

**Caching:**
- **Redis Sorted Set** per user: `feed:{user_id}` → sorted by tweet timestamp
- Each entry: `tweet_id` only (fetch tweet content from tweet cache separately)
- Cache miss: rebuild from DB

**Timeline ranking:**
```text
Raw chronological → re-ranked by engagement model
Signals: recency, likes, comments, shares, user-specific engagement history
Run ML ranking on top 800 candidates → show top 50
```

> 🌍 **Real-World:** Twitter/X's engineering blog (pre-acquisition) documented their hybrid fanout system in detail: users with >10K followers (celebrities) are excluded from fanout-on-write. At peak, Katy Perry's tweets (150M+ followers) would generate 150M Redis writes in minutes if fan-out-on-write were used — instead, her tweets are fetched and merged at read time. Instagram uses the same threshold-based hybrid model; their engineering team reported that switching celebrities to fan-out-on-read reduced peak write throughput by 4x.

---

### Q3. Design a Distributed Rate Limiter
**Asked at:** Stripe, Cloudflare, Google, Amazon, Uber

**Clarifying questions:**
- Per user, per IP, or per API key?
- Hard limit or soft (allow burst)?
- Latency budget? (must be <10ms added latency)
- Single region or global?

**Answer:**

**Algorithms:**

> **💡 Key Design Decision:** **Token Bucket** is best for API gateways (allows controlled bursting). **Sliding Window Counter** offers the best balance of accuracy and memory efficiency for most production systems.

```text
1. Token Bucket:
   - Bucket refills at rate R, capacity C
   - Request consumes 1 token. Reject if empty.
   - Allows burst up to C, steady state at R/s
   - Best for: API gateways (allows burst traffic)

2. Leaky Bucket:
   - Requests queue at constant drain rate R
   - Smooths traffic, no burst allowed
   - Best for: payment processing (consistent throughput)

3. Fixed Window Counter:
   - Count requests per second/minute window
   - Problem: boundary spike (2x traffic at window edge)
   - Best for: simple, low-stakes limits

4. Sliding Window Log:
   - Store timestamp of each request, count within last N seconds
   - Accurate but high memory (O(N) per user)

5. Sliding Window Counter (best balance):
   - Combine fixed windows with weighted interpolation
   - current_count = prev_window_count × overlap_ratio + curr_window_count
   - Low memory, near-accurate
```

**Distributed implementation (Redis-based):**
```lua
-- Atomic Lua script in Redis (no race condition)
local key = KEYS[1]           -- "rate:{user_id}:{window}"
local limit = ARGV[1]
local current = redis.call("INCR", key)
if current == 1 then
  redis.call("EXPIRE", key, ARGV[2])  -- set TTL on first request
end
if current > tonumber(limit) then
  return 0  -- rejected
end
return 1  -- allowed
```

> **⚠️ Scale Challenge:** A single global Redis store for multi-region rate limiting adds 50–100ms cross-region latency — unacceptable. Use local Redis per region with periodic quota sync instead.

**Multi-region rate limiting:**
```text
Problem: Redis in US-East doesn't know about traffic in EU-West

Solution A: Centralized Redis (single global store)
  Latency cost: 50-100ms cross-region → unacceptable

Solution B: Local Redis + periodic sync
  Each region has local counter. Sync every 100ms.
  Risk: brief over-counting during sync window. Acceptable for most APIs.

Solution C: Global token bucket with estimation
  Each region gets a share of the global quota.
  Quota rebalanced every 5 seconds.
  Used by: Cloudflare
```

**Where to enforce:**
```text
API Gateway → rate limit check (Redis) → forward or reject
Place Redis in same AZ as API servers to keep latency <1ms
```

> 🌍 **Real-World:** Stripe's API uses the token bucket algorithm per API key — allowing bursts of up to 100 req/s but smoothing down to a sustained limit of 25 req/s, with a Redis Lua script executed atomically on every API call. Cloudflare's rate limiting service protects 25M+ websites using a sliding window counter approach distributed across their edge nodes, choosing local-per-region counters with periodic sync (Solution B above) because cross-region consistency would add 50–100ms to every request.

---

### Q4. Design a Notification System (Push, Email, SMS)
**Asked at:** Meta, LinkedIn, Amazon, Flipkart

**Answer:**

**Architecture:**
```text
Event Sources → Notification Service → Channel Routers → Delivery Workers
                      ↓
               Preference Store (what user wants to receive)
               Dedup Store (don't send same notification twice)
               Rate Limiter (don't spam users)
```

> **💡 Key Design Decision:** Separate notifications into priority tiers in Kafka. Critical alerts (OTP, payment) must bypass quiet-hours rules and reach users immediately; marketing messages should respect user-defined quiet hours.

**Flow:**
```text
1. Order placed event → Kafka topic: notification.triggers
2. Notification Service consumes → checks user preference store
   - user prefers: push only, no email between 10pm-8am
3. Route to channel: Push → APNs/FCM, Email → SendGrid, SMS → Twilio
4. Delivery worker sends → marks sent in DB
5. Retry failed deliveries with exponential backoff
```

**Deduplication:**
```text
Key: hash(user_id + event_id + channel)
Store in Redis with TTL = 24h
Before sending: check if key exists
After sending: set key
```

**Priority queues:**
```text
Kafka topics by priority:
  notification.critical   → OTP, payment alerts (process immediately)
  notification.standard   → order updates (process within 30s)
  notification.marketing  → promotions (process within 1h, respect quiet hours)
```

**Failure handling:**
```text
APNs/FCM failure → retry 3x with exponential backoff (1s, 4s, 16s)
After 3 retries → move to DLQ
DLQ processor: alert on-call, try alternative channel (email fallback for push failure)
```

> 🌍 **Real-World:** Meta sends ~100 billion push notifications per day across Facebook, Instagram, and WhatsApp. Their notification infrastructure uses exactly this priority-tiered Kafka architecture — OTP codes route through a dedicated critical topic processed by isolated consumer groups, while marketing messages (Daily Digest, "People You May Know") share a lower-priority topic that respects user quiet-hours settings. LinkedIn's notification system uses a Redis-based deduplication store with 24h TTL to prevent the same "John viewed your profile" notification from being sent twice within a day.

---

### Q5. Design Google Drive / Dropbox (File Storage System)
**Asked at:** Google, Dropbox, Box, Amazon

**Answer:**

**Core flows:**
```text
Upload: Client → Chunker → Upload Service → Object Storage (S3/GCS) → Metadata DB
Download: Client → CDN → Object Storage
Sync: Change events → Kafka → Notification Service → Client SDK
```

> **💡 Key Design Decision:** **Content-addressable storage** using SHA-256 chunk hashes enables automatic deduplication — identical chunks across any files are stored only once. This is core to Dropbox's storage efficiency.

**Chunking:**
```text
Split file into 4MB chunks
Benefits:
  - Resume interrupted uploads (re-upload only failed chunk)
  - Deduplication (same chunk across multiple files stored once)
  - Parallel upload (multiple chunks simultaneously)

Chunk ID = SHA256(chunk_content)  ← content-addressable storage
```

**Metadata DB:**
```sql
files(file_id, owner_id, name, size, version, created_at)
chunks(chunk_id, sha256, size, storage_path)
file_chunks(file_id, chunk_id, chunk_index, version)
```

**Delta sync (efficient sync):**
```text
Client tracks local file state (sha256 per chunk)
On change: compute which chunks changed → upload only diff chunks
Server merges and creates new version
Client SDK polls for changes every 30s or uses long-polling/WebSocket
```

**Conflict resolution:**
```text
Two users edit same file offline → both upload
Server detects: same parent version → conflict
Resolution: create "file (conflicted copy 2024-05-01)" — Dropbox approach
Google Docs: operational transforms (OT) for real-time merging
```

> **⚠️ Scale Challenge:** At 500M users with 5GB average storage, total data is 2.5 Exabytes. A flat S3 Standard tier is cost-prohibitive. Use tiered storage with lifecycle policies to move cold data automatically.

**Scale:**
```text
500M users, avg 5GB storage = 2.5 Exabytes total
Use tiered storage: hot (S3 Standard) → warm (S3 IA after 30 days) → cold (Glacier after 1yr)
CDN for downloads: CloudFront in 50 PoPs globally
```

> 🌍 **Real-World:** Dropbox's content-addressable storage (SHA-256 chunk hashing) lets them store 500 million users' files while deduplicating common chunks globally — when millions of users each upload the same PDF (an airline's boarding pass template, a tax form), only one copy is stored. Dropbox engineering has stated that deduplication reduces their actual storage costs by roughly 30-40%. Google Drive uses a similar approach and adds Brotli compression on top of deduplication, with tiered lifecycle policies automatically moving files not accessed for 90+ days to cheaper cold storage.

---

### Q6. Design a Search Autocomplete System
**Asked at:** Google, Amazon, LinkedIn, Atlassian

**Answer:**

**Trie-based approach (naive):**
```text
In-memory trie — too large for 100M queries
Trie for top-K suggestions at each prefix node
Problem: doesn't scale to distributed, hard to update in real-time
```

> **💡 Key Design Decision:** Store precomputed top-N suggestions per prefix in Redis rather than a live trie. This trades perfect freshness for massive read scalability — acceptable since suggestions can be rebuilt nightly.

**Production approach:**
```text
Offline pipeline (daily):
  1. Collect all search queries from logs
  2. Aggregate: (query, count) pairs
  3. Build top-25 suggestions per prefix
  4. Store in Redis: key=prefix, value=sorted list of (query, score)

Online query:
  GET /autocomplete?q=face
  → Redis GET "face" → ["facebook", "facetime", "face cream", ...]
  → Return in <10ms
```

**Trie on Redis:**
```text
"f"     → ["facebook:10M", "facetime:5M", "face cream:2M"]
"fa"    → ["facebook:10M", "facetime:5M", "face cream:2M"]
"fac"   → ["facebook:10M", "facetime:5M", "face cream:2M"]
"face"  → ["facebook:10M", "facetime:5M", "face cream:2M"]

Update: re-run pipeline nightly or use streaming (Flink) for near-real-time
```

**Real-time trending:**
```text
Hot prefix detection: if a prefix spikes 10x in 5min → inject into top results
Use Kafka Streams or Flink for streaming aggregation
Merge: base suggestions (offline) + trending (streaming) → deduplicate → return
```

> **⚠️ Scale Challenge:** Autocomplete fires on every keystroke — 3–4 API calls per search at 57k searches/sec means ~200k req/sec. Aggressively cache common short prefixes (single characters, two-character combinations) at the CDN edge.

**Scale:**
```text
5 billion searches/day → 57k searches/sec
Autocomplete fires every keystroke: 3-4 API calls per search → 200k req/sec
Redis: 100k ops/sec per instance → ~3-5 Redis shards
CDN: cache common prefixes (a, ab, ...) at edge
```

> 🌍 **Real-World:** Google Search's autocomplete (Suggest API) serves 5+ billion queries per day. Google pre-computes top-10 suggestions per prefix offline nightly and caches them in a distributed Redis-like store, then serves them from CDN edge nodes for single-character and two-character prefixes — the "g", "go", "goo" prefix responses are cached at the CDN and never touch a backend server. Amazon's search autocomplete uses a Flink streaming pipeline to inject real-time trending queries (e.g., a viral product) into the offline suggestions within ~60 seconds of the trend starting.

---

### Q7. Design a Payments System (like Stripe)
**Asked at:** Stripe, PayPal, Razorpay, Goldman Sachs, Amazon

**Answer:**

**Core requirements:**
```text
Exactly-once payment processing (no double charges, no missed charges)
Strong consistency for balance operations
Fraud detection
PCI-DSS compliance
```

**Architecture:**
```text
Client → API Gateway → Payment Service → Idempotency Store (Redis)
                              ↓
                    Payment Processor (Stripe/Adyen gateway)
                              ↓
                    Ledger Service (double-entry bookkeeping)
                              ↓
                    Settlement Service (batch, T+1)
```

> **💡 Key Design Decision:** **Idempotency keys** are the cornerstone of safe payment APIs. Every charge request must carry a client-generated idempotency key so the server can safely deduplicate retries without double-charging.

**Idempotency:**
```text
Client sends: POST /charge with Idempotency-Key: uuid-1234
Server checks Redis: "uuid-1234" exists? → return cached response
If not: process payment → store response in Redis (TTL=24h) → return
Prevents double-charges on retries
```

**Exactly-once with DB:**
```sql
-- Idempotency table
CREATE TABLE payments (
  idempotency_key VARCHAR PRIMARY KEY,
  status ENUM('pending', 'success', 'failed'),
  response_body JSON,
  created_at TIMESTAMP
);

-- On request: INSERT or RETURN existing
INSERT INTO payments (idempotency_key, status) VALUES (?, 'pending')
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING *;
```

> **💡 Key Design Decision:** Use the **Saga pattern** (not 2PC) for multi-step payment workflows across microservices. Each step writes to an outbox table; compensating transactions roll back completed steps on failure.

**Saga pattern for distributed transactions:**
```text
Order Service → Reserve inventory
             → Charge payment
             → Confirm order
             → Send notification

If charge fails → compensating transaction: release inventory
If notification fails → idempotent retry (notification is non-critical)
Each step writes to outbox table → Kafka relay → next service
```

**Ledger (double-entry):**
```text
Every transaction: debit one account, credit another
Debit user wallet: -$100, Credit merchant wallet: +$100
Sum of all entries = 0 always (invariant)
Never UPDATE balances — only INSERT new entries
Balance = SUM(credit) - SUM(debit) for account
```

> 🌍 **Real-World:** Stripe processes hundreds of billions of dollars per year and uses idempotency keys on every charge endpoint — their public API documentation explicitly requires clients to generate and store a UUID per charge attempt and retry with the same key on failure. Coinbase's ledger service uses append-only double-entry bookkeeping (never UPDATE a balance row, always INSERT credit/debit entries) and reconciles the invariant (sum = 0) every 15 minutes across all accounts as a fraud/bug detection signal.

---

## Section 2: Low-Level Design (LLD)

---

### Q8. Design a Thread-Safe LRU Cache
**Asked at:** Google, Amazon, Meta, Microsoft, Uber

**Answer:**

```java
import java.util.concurrent.*;
import java.util.concurrent.locks.*;

public class LRUCache<K, V> {
    private final int capacity;
    private final ConcurrentHashMap<K, Node<K,V>> map;
    private final Node<K,V> head, tail;  // dummy nodes
    private final ReadWriteLock lock = new ReentrantReadWriteLock();

    // Doubly linked list node
    static class Node<K,V> {
        K key; V value;
        Node<K,V> prev, next;
        Node(K k, V v) { key = k; value = v; }
    }

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.map = new ConcurrentHashMap<>();
        head = new Node<>(null, null);
        tail = new Node<>(null, null);
        head.next = tail;
        tail.prev = head;
    }

    public V get(K key) {
        lock.writeLock().lock();  // write because we mutate order
        try {
            Node<K,V> node = map.get(key);
            if (node == null) return null;
            moveToFront(node);
            return node.value;
        } finally { lock.writeLock().unlock(); }
    }

    public void put(K key, V value) {
        lock.writeLock().lock();
        try {
            if (map.containsKey(key)) {
                Node<K,V> node = map.get(key);
                node.value = value;
                moveToFront(node);
            } else {
                Node<K,V> node = new Node<>(key, value);
                map.put(key, node);
                addToFront(node);
                if (map.size() > capacity) evictLRU();
            }
        } finally { lock.writeLock().unlock(); }
    }

    private void addToFront(Node<K,V> node) {
        node.next = head.next; node.prev = head;
        head.next.prev = node; head.next = node;
    }
    private void remove(Node<K,V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }
    private void moveToFront(Node<K,V> node) { remove(node); addToFront(node); }
    private void evictLRU() {
        Node<K,V> lru = tail.prev;
        remove(lru);
        map.remove(lru.key);
    }
}
```

**Follow-up: Can you make reads non-blocking?**
```text
Use ConcurrentHashMap + approximate LRU (don't move on every read)
Or: use Caffeine library (window TinyLFU — better than LRU in practice)
Trade-off: strict LRU requires write lock on read. Approximate LRU is 99% as good, faster.
```

> **💡 Key Design Decision:** Strict LRU requires a write lock on every `get` (because recency order must be updated), which serializes all reads. For high-throughput caches, prefer **approximate LRU** via Caffeine's Window TinyLFU — better hit rates with no read-path locking.

> 🌍 **Real-World:** The Caffeine library (Window TinyLFU algorithm) is the default in-process cache for Spring Boot, Guava's successor, and is used by Cassandra, Kafka, and Druid internally. Ben Manes (Caffeine's author) benchmarked it at 2-3x the hit rate of a strict LRU on real-world traces, because TinyLFU's frequency sketch correctly identifies "hot" items that were recently evicted by a scan, whereas LRU evicts them permanently. Netflix uses Caffeine as their L1 in-process cache in front of Memcached for metadata lookups.

---

### Q9. Design Parking Lot System
**Asked at:** Amazon, Microsoft, Uber, Lyft

**Answer:**

```text
Classes:
  ParkingLot (singleton) — manages floors
  ParkingFloor — manages spots per floor
  ParkingSpot (Motorcycle, Compact, Large) — abstract base
  Vehicle (Motorcycle, Car, Truck) — abstract base
  Ticket — issued on entry, settled on exit
  PricingStrategy (interface) — hourly, flat rate, peak pricing
  PaymentProcessor — handles payment on exit

Key patterns used:
  Strategy: PricingStrategy interface (swap pricing without changing core logic)
  Factory: VehicleFactory, SpotFactory
  Singleton: ParkingLot (one system manages all floors)
  Observer: SpotAvailabilityMonitor alerts display boards on spot change
```

```java
public class ParkingLot {
    private static ParkingLot instance;
    private final List<ParkingFloor> floors;
    private final Map<String, Ticket> activeTickets;

    private ParkingLot(int numFloors, int spotsPerFloor) {
        floors = new ArrayList<>();
        activeTickets = new ConcurrentHashMap<>();
        for (int i = 0; i < numFloors; i++)
            floors.add(new ParkingFloor(i, spotsPerFloor));
    }

    public static synchronized ParkingLot getInstance() {
        if (instance == null) instance = new ParkingLot(5, 100);
        return instance;
    }

    public Ticket park(Vehicle vehicle) {
        for (ParkingFloor floor : floors) {
            ParkingSpot spot = floor.findAvailableSpot(vehicle.getSize());
            if (spot != null) {
                spot.park(vehicle);
                Ticket ticket = new Ticket(vehicle, spot);
                activeTickets.put(ticket.getId(), ticket);
                return ticket;
            }
        }
        throw new ParkingFullException("No spots available for " + vehicle.getType());
    }

    public double exit(String ticketId) {
        Ticket ticket = activeTickets.remove(ticketId);
        ticket.setExitTime(Instant.now());
        ticket.getSpot().vacate();
        return pricingStrategy.calculate(ticket);
    }
}
```

> 🌍 **Real-World:** SpotHero (a parking marketplace) and ParkWhiz use this exact OOP model — their backend represents each parking facility as a `ParkingLot` singleton with `ParkingFloor` collections and time-based `PricingStrategy` objects (weekday vs. weekend, event surcharge). The Strategy pattern lets them swap pricing models without touching core reservation logic, which is critical because pricing rules are set per-facility by operators. San Francisco's SFpark system uses real-time sensor data to dynamically adjust `PricingStrategy` implementations city-wide based on occupancy rates.

---

### Q10. Design a Task Scheduler / Cron System
**Asked at:** Google, Uber, Amazon, Atlassian

**Answer:**

```text
Requirements: schedule tasks to run at specific times, handle failures, distributed

Components:
  Scheduler Service: accepts task definitions (cron expression, handler)
  Task Queue: priority queue ordered by next_run_time
  Worker Pool: pulls tasks, executes them
  State Store: tracks task status, handles failures/retries
```

```java
public class TaskScheduler {
    // Min-heap by next execution time
    private final PriorityQueue<ScheduledTask> taskQueue =
        new PriorityQueue<>(Comparator.comparing(t -> t.nextRunTime));
    private final ScheduledExecutorService scheduler =
        Executors.newScheduledThreadPool(Runtime.getRuntime().availableProcessors());
    private final ExecutorService workers = Executors.newFixedThreadPool(20);

    public void schedule(String cronExpr, Runnable task, String taskId) {
        CronExpression cron = CronExpression.parse(cronExpr);
        ScheduledTask st = new ScheduledTask(taskId, cron, task);
        taskQueue.offer(st);
    }

    public void start() {
        scheduler.scheduleAtFixedRate(this::tick, 0, 1, TimeUnit.SECONDS);
    }

    private void tick() {
        Instant now = Instant.now();
        while (!taskQueue.isEmpty() && !taskQueue.peek().nextRunTime.isAfter(now)) {
            ScheduledTask task = taskQueue.poll();
            workers.submit(() -> {
                try {
                    task.runnable.run();
                } catch (Exception e) {
                    // retry logic, dead-letter
                    handleFailure(task, e);
                }
            });
            // Reschedule next occurrence
            task.nextRunTime = task.cron.nextTimeAfter(now);
            taskQueue.offer(task);
        }
    }
}
```

> **⚠️ Scale Challenge:** A single scheduler node is a **SPOF** (Single Point of Failure). Use **leader election** via ZooKeeper or etcd so only one node runs the tick, but failover happens within ~10 seconds automatically.

**Distributed extension:**
```text
Single scheduler is SPOF. Distributed approach:
  - All scheduler nodes participate in leader election (ZooKeeper / etcd)
  - Only leader runs the scheduler tick
  - Leader failure → new election within 10s → new leader resumes
  - Task state in DB (not in-memory) → new leader reads and continues
```

> 🌍 **Real-World:** Quartz Scheduler (Java) and Kubernetes CronJob both implement exactly this distributed leader-election model. Shopify runs their "scheduled jobs" system (price changes, email campaigns, inventory restocks) on a distributed cron cluster where etcd leader election ensures exactly one scheduler fires each job, and all task state is persisted in MySQL so any node can take over. Airflow, used by Airbnb, Lyft, and hundreds of companies for data pipeline scheduling, uses a similar architecture with a metadata DB as the source of truth for task state and a celery worker pool for execution.

---

### Q11. Design Snake and Ladder Game (OOP)
**Asked at:** Amazon, Microsoft, Goldman Sachs

**Answer:**

```java
// Core OOP: Board, Player, Dice, Snake, Ladder, Game

public class Board {
    private final int size;
    private final Map<Integer, Integer> snakes;  // head → tail
    private final Map<Integer, Integer> ladders; // bottom → top

    public Board(int size, Map<Integer,Integer> snakes, Map<Integer,Integer> ladders) {
        this.size = size;
        this.snakes = snakes;
        this.ladders = ladders;
    }

    public int resolve(int position) {
        if (snakes.containsKey(position)) return snakes.get(position);
        if (ladders.containsKey(position)) return ladders.get(position);
        return position;
    }
}

public class Game {
    private final Board board;
    private final List<Player> players;
    private final Dice dice;
    private int currentPlayerIndex = 0;

    public Player play() {
        while (true) {
            Player player = players.get(currentPlayerIndex);
            int roll = dice.roll();
            int newPos = player.getPosition() + roll;
            if (newPos <= board.getSize()) {
                newPos = board.resolve(newPos);
                player.setPosition(newPos);
                if (newPos == board.getSize()) return player;  // winner
            }
            currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
        }
    }
}
```

> 🌍 **Real-World:** King (makers of Candy Crush) and Zynga use this exact Board + State Machine OOP model for their casual games, with the `Board.resolve()` method extended to handle power-ups, combo triggers, and special tile effects — all as additional entries in the same "position transformation" map. The OOP design allows game designers to create new board configurations via JSON data (snake/ladder positions) without touching game engine code, which is how King ships 200+ level variants per game.

---

## Section 3: DSA / Coding

---

### Q12. Find Median from Data Stream
**Asked at:** Google, Amazon, Meta

> **💡 Pattern Recognition:** **Two-heap partition** — maintain a max-heap for the lower half and a min-heap for the upper half, keeping their sizes balanced. The median is always available in O(1) from the heap tops.

```java
// Two heaps: max-heap for lower half, min-heap for upper half
class MedianFinder {
    PriorityQueue<Integer> lower = new PriorityQueue<>(Collections.reverseOrder());
    PriorityQueue<Integer> upper = new PriorityQueue<>();

    public void addNum(int num) {
        lower.offer(num);
        upper.offer(lower.poll());        // balance: push largest from lower to upper
        if (lower.size() < upper.size())  // keep lower >= upper in size
            lower.offer(upper.poll());
    }

    public double findMedian() {
        return lower.size() > upper.size()
            ? lower.peek()
            : (lower.peek() + upper.peek()) / 2.0;
    }
}
// Time: O(log n) add, O(1) median. Space: O(n)
```

> 🌍 **Real-World:** Amazon uses streaming median calculation in their seller analytics dashboard to compute real-time median order values and response-time p50 metrics — the two-heap approach lets them update the median in O(log n) as each new order arrives without re-scanning the entire dataset. Netflix's QoE (Quality of Experience) team uses the same algorithm to maintain streaming median rebuffer rates per CDN node, so they can detect when a node degrades without waiting for a full batch aggregation cycle.

---

### Q13. LRU Cache (LC 146)
**Asked at:** Google, Amazon, Meta, Microsoft, Uber — extremely common

> **💡 Pattern Recognition:** `LinkedHashMap` in Java maintains **insertion order** and supports access-order mode, making it a one-class LRU implementation. The key insight is: on a `get`, remove and re-insert the key to bump it to the "most recent" end.

```java
class LRUCache {
    int cap;
    LinkedHashMap<Integer,Integer> map = new LinkedHashMap<>();

    public LRUCache(int capacity) { this.cap = capacity; }

    public int get(int key) {
        if (!map.containsKey(key)) return -1;
        int val = map.remove(key);
        map.put(key, val);   // move to most-recent
        return val;
    }

    public void put(int key, int value) {
        if (map.containsKey(key)) map.remove(key);
        else if (map.size() == cap) map.remove(map.keySet().iterator().next()); // evict LRU
        map.put(key, value);
    }
}
// LinkedHashMap maintains insertion order. O(1) amortized all ops.
```

> 🌍 **Real-World:** Redis itself implements LRU eviction using the approximate LRU algorithm (sampling 5–10 random keys and evicting the least-recently-used among them) rather than a true LinkedHashMap LRU — avoiding the overhead of a doubly-linked list update on every read. Facebook's TAO (distributed graph cache for social graph data) uses an LRU eviction policy with a custom doubly-linked-list implementation equivalent to this problem, handling billions of social graph edge lookups per day with sub-millisecond latency.

---

### Q14. Merge K Sorted Lists (LC 23)
**Asked at:** Google, Amazon, Meta

> **💡 Pattern Recognition:** **Min-heap of list heads** — always extract the globally smallest node across all K lists in O(log K) time. Total complexity is O(N log K) where N is total nodes across all lists.

```java
public ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> pq = new PriorityQueue<>(Comparator.comparingInt(n -> n.val));
    for (ListNode l : lists) if (l != null) pq.offer(l);

    ListNode dummy = new ListNode(0), cur = dummy;
    while (!pq.isEmpty()) {
        ListNode node = pq.poll();
        cur.next = node;
        cur = cur.next;
        if (node.next != null) pq.offer(node.next);
    }
    return dummy.next;
}
// Time: O(N log k) where N=total nodes, k=number of lists
```

> 🌍 **Real-World:** Elasticsearch's merge policy uses the Merge K Sorted Lists algorithm to combine multiple sorted inverted index segments (SSTables) into one during compaction — each segment is a sorted list of (term → document IDs), and the min-heap merge produces a single sorted output. Apache Kafka's log compaction similarly merges K sorted segment files using a min-heap, which is why Kafka's storage cost scales as O(N log K) during compaction rather than O(N²).

---

### Q15. Design Hit Counter / Sliding Window Rate Limiter
**Asked at:** Google, Stripe, Amazon (commonly asked as real problem, not LC)

> **💡 Pattern Recognition:** **Circular buffer** — use `timestamp % 300` as the slot index. Overwrite stale data by checking if the stored timestamp matches the current one. Achieves O(1) time and O(300) constant space.

```java
class HitCounter {
    // Circular buffer approach - O(1) time, O(300) space
    int[] times = new int[300];
    int[] hits = new int[300];

    public void hit(int timestamp) {
        int idx = timestamp % 300;
        if (times[idx] != timestamp) {
            times[idx] = timestamp;
            hits[idx] = 1;
        } else {
            hits[idx]++;
        }
    }

    public int getHits(int timestamp) {
        int total = 0;
        for (int i = 0; i < 300; i++) {
            if (timestamp - times[i] < 300) total += hits[i];
        }
        return total;
    }
}
```

> 🌍 **Real-World:** Stripe's rate limiter service uses this exact circular buffer approach in their Go-based edge infrastructure — a fixed-size array indexed by `timestamp % windowSize` provides O(1) updates without any garbage collection pressure. Google's SRE team uses the same pattern in their internal quota tracking service to count API calls per second per project, where O(1) constant memory per counter is essential because they track quotas for millions of projects simultaneously.

---

### Q16. Word Ladder II (LC 126) — Hard
**Asked at:** Google, Meta

> **💡 Pattern Recognition:** **BFS for shortest-path layer construction + DFS backtracking** — BFS builds a `parents` map level by level (removing visited words to prevent revisiting), then DFS reconstructs all paths from `endWord` back to `beginWord` using the parents map.

```java
// BFS to find shortest path length + DFS/backtrack to find all paths
// Key insight: build graph layer by layer, only traverse backwards from end to start
public List<List<String>> findLadders(String beginWord, String endWord, List<String> wordList) {
    Set<String> wordSet = new HashSet<>(wordList);
    List<List<String>> result = new ArrayList<>();
    if (!wordSet.contains(endWord)) return result;

    // BFS: build parent map (which words lead to this word in shortest path)
    Map<String, List<String>> parents = new HashMap<>();
    Set<String> currLevel = new HashSet<>();
    currLevel.add(beginWord);
    boolean found = false;

    while (!currLevel.isEmpty() && !found) {
        wordSet.removeAll(currLevel);
        Set<String> nextLevel = new HashSet<>();
        for (String word : currLevel) {
            char[] chars = word.toCharArray();
            for (int i = 0; i < chars.length; i++) {
                char orig = chars[i];
                for (char c = 'a'; c <= 'z'; c++) {
                    chars[i] = c;
                    String next = new String(chars);
                    if (wordSet.contains(next)) {
                        nextLevel.add(next);
                        parents.computeIfAbsent(next, k -> new ArrayList<>()).add(word);
                        if (next.equals(endWord)) found = true;
                    }
                    chars[i] = orig;
                }
            }
        }
        currLevel = nextLevel;
    }
    // Backtrack from endWord to beginWord using parents map
    if (found) backtrack(result, parents, new LinkedList<>(), endWord, beginWord);
    return result;
}
```

> 🌍 **Real-World:** Pharmaceutical companies use the Word Ladder pattern to model drug synthesis pathways — finding the minimum sequence of chemical reactions (each changing one functional group) to convert a precursor molecule into a target drug compound, where each intermediate must be a valid known compound (the "word set"). Google's Knowledge Graph team uses BFS shortest-path on entity graphs for "degrees of separation" queries (how many hops between Person A and Person B through shared attributes), which is structurally identical to Word Ladder.

---

### Q17. Serialize and Deserialize Binary Tree (LC 297)
**Asked at:** Google, Amazon, Meta, Microsoft

> **💡 Pattern Recognition:** **Pre-order traversal with null markers** — serialize left subtree before right, encode nulls explicitly as `"N"`. On deserialization, a single shared index cursor advances through the array, reconstructing the tree in the same pre-order.

```java
class Codec {
    public String serialize(TreeNode root) {
        if (root == null) return "N";
        return root.val + "," + serialize(root.left) + "," + serialize(root.right);
    }

    int idx = 0;
    public TreeNode deserialize(String data) {
        String[] parts = data.split(",");
        return build(parts);
    }
    private TreeNode build(String[] parts) {
        if (idx >= parts.length || parts[idx].equals("N")) { idx++; return null; }
        TreeNode node = new TreeNode(Integer.parseInt(parts[idx++]));
        node.left = build(parts);
        node.right = build(parts);
        return node;
    }
}
```

> 🌍 **Real-World:** Redis uses pre-order traversal with null markers (exactly this algorithm) to serialize RDB snapshot files for replication — a replica receives the serialized tree structure of sorted sets, hash maps, and lists over the network and reconstructs them in memory using the same pre-order deserialization. Amazon DynamoDB's internal partition tree metadata is serialized and stored using a variant of this approach for fast shard-map recovery after node failures.

---

### Q18. Alien Dictionary (LC 269 / Premium)
**Asked at:** Google, Airbnb, Uber

> **💡 Pattern Recognition:** **Topological sort** — derive a directed edge `u → v` (character `u` comes before character `v`) by comparing each adjacent pair of words at the first differing character. Then run **Kahn's BFS** on the character graph. If output length < total characters, a cycle exists (invalid ordering).

```java
// Topological sort on character ordering derived from adjacent word pairs
public String alienOrder(String[] words) {
    Map<Character, Set<Character>> graph = new HashMap<>();
    Map<Character, Integer> inDegree = new HashMap<>();
    for (String w : words) for (char c : w.toCharArray()) {
        graph.putIfAbsent(c, new HashSet<>());
        inDegree.putIfAbsent(c, 0);
    }
    for (int i = 0; i < words.length - 1; i++) {
        String w1 = words[i], w2 = words[i+1];
        if (w1.startsWith(w2) && w1.length() > w2.length()) return ""; // invalid
        for (int j = 0; j < Math.min(w1.length(), w2.length()); j++) {
            if (w1.charAt(j) != w2.charAt(j)) {
                if (!graph.get(w1.charAt(j)).contains(w2.charAt(j))) {
                    graph.get(w1.charAt(j)).add(w2.charAt(j));
                    inDegree.merge(w2.charAt(j), 1, Integer::sum);
                }
                break;
            }
        }
    }
    // BFS Kahn's algorithm
    Queue<Character> q = new LinkedList<>();
    inDegree.forEach((c, deg) -> { if (deg == 0) q.offer(c); });
    StringBuilder sb = new StringBuilder();
    while (!q.isEmpty()) {
        char c = q.poll(); sb.append(c);
        for (char next : graph.get(c)) {
            inDegree.merge(next, -1, Integer::sum);
            if (inDegree.get(next) == 0) q.offer(next);
        }
    }
    return sb.length() == inDegree.size() ? sb.toString() : "";
}
```

> 🌍 **Real-World:** Google's Protocol Buffers (protobuf) field ordering system uses topological sort on field dependency graphs when generating code — derived message types must be defined after their dependencies, exactly like the Alien Dictionary ordering problem. Apache Thrift's IDL compiler does the same. The "cycle detected → invalid" check (output length < total chars) is why both compilers immediately fail with a clear error when you accidentally create a circular type reference in your schema definition.

---

## Section 4: Distributed Systems Deep Dive

---

### Q19. How does Google Spanner achieve external consistency?
**Asked at:** Google (common for L5/SDE-3)

**Answer:**

> **💡 Key Design Decision:** **TrueTime API** — rather than trusting system clocks (which drift), Spanner uses GPS receivers and atomic clocks in every datacenter to bound clock uncertainty to ±7ms. The "commit wait" forces transactions to delay until this uncertainty window has passed, guaranteeing that any later transaction will always observe earlier ones.

```text
External consistency = linearizability across globally distributed transactions.
If transaction T1 commits before T2 starts (wall clock), T2 must see T1's effects.

Problem: clocks drift across data centers. Can't trust system clocks directly.

Google's solution: TrueTime API
  TrueTime.now() returns [earliest, latest] — a time interval
  Uncertainty is bounded (typically ±7ms via GPS + atomic clocks in each DC)

Commit protocol:
  1. Transaction acquires locks, prepares to commit
  2. Gets TrueTime interval [T_early, T_late] at commit time
  3. WAITS until real time > T_late (commit wait, typically 7-14ms)
  4. Then commits with timestamp T_commit

Why this works:
  Any later transaction that starts must get a TrueTime interval where T_early > T_commit
  So the later transaction will always see the committed state
  → External consistency guaranteed

Cost: ~14ms added latency per write transaction (commit wait)
Benefit: globally consistent reads, no two-phase commit across regions
```

> 🌍 **Real-World:** Google Spanner powers Google Ads, Google F1 (their ads database), and Firebase Firestore globally. The 14ms commit-wait cost is acceptable for ad auction writes (where correctness is critical) but too slow for millisecond-latency use cases. Apple's CloudKit and Salesforce use Spanner-compatible designs for their global databases, accepting the small write latency penalty in exchange for never having to reason about cross-region stale reads — a tradeoff that has eliminated entire classes of billing discrepancy bugs.

---

### Q20. Explain the difference between 2PC and Saga. When to use each?
**Asked at:** Amazon, Uber, Stripe, Grab

**Answer:**

> **💡 Key Design Decision:** Use **2PC** only within tightly coupled systems where all participants are reliable and latency is acceptable. Use **Saga** across microservice boundaries — accept eventual consistency in exchange for no cross-service locking and partition tolerance.

```text
Two-Phase Commit (2PC):
  Phase 1 - Prepare: Coordinator asks all participants "can you commit?"
  Phase 2 - Commit: If all say yes → commit; else → abort

  Pros: ACID across distributed nodes, simple correctness guarantee
  Cons:
    - Blocking: if coordinator crashes after phase 1, participants wait forever
    - Slow: 2 RTT minimum, locks held across network
    - Not partition-tolerant: all nodes must be reachable

  Use when: monolith-to-DB transactions, banking (balance transfer), small # of nodes

Saga Pattern:
  Sequence of local transactions, each publishing events
  Compensating transactions undo previous steps on failure

  Example: Book travel
    T1: Book flight → E1: FlightBooked
    T2: Book hotel → E2: HotelBooked
    T3: Charge card → E3: PaymentFailed
    C2: Cancel hotel (compensate T2)
    C1: Cancel flight (compensate T1)

  Pros: no long-lived locks, works across service boundaries, partition-tolerant
  Cons:
    - Eventually consistent (not ACID) — reads during saga may see partial state
    - Compensating transactions must be idempotent
    - Complex error handling

  Use when: microservices, long-running workflows, e-commerce orders, travel booking

Rule of thumb:
  Within one DB or tight cluster → 2PC acceptable
  Across microservices/services → Saga mandatory
```

> 🌍 **Real-World:** Uber's money transfer system uses the Saga pattern (orchestration-style, via their Cadence workflow engine) across 4 microservices: debit source wallet, credit destination wallet, record ledger entry, and send notification — with compensating transactions for each step. Amazon's e-commerce order workflow (reserve inventory → charge payment → ship → notify) is a textbook Saga, with compensating "release inventory" and "refund" events if any downstream step fails. Neither uses 2PC because the services span different databases and network partitions must be tolerated.

---

### Q21. How would you handle cache invalidation at scale?
**Asked at:** Meta, Google, Amazon, Netflix

**Answer:**

> **⚠️ Scale Challenge:** Cache invalidation is one of the hardest problems in distributed systems. The core tension: stale reads (too-long TTL) vs thundering herd on expiry (too-short TTL). **Event-driven invalidation** via CDC (Change Data Capture) is the production gold standard at companies like Meta.

```text
The hardest problem in CS (joke, but real challenge).

Strategies:

1. TTL (Time-to-Live) — simplest
   Cache expires after N seconds. Stale reads possible within TTL.
   Use when: data freshness is not critical (product catalog, config)
   Problem: thundering herd on expiry (many simultaneous DB reads)

2. Cache-aside (Lazy loading)
   Read: check cache → miss → read DB → populate cache
   Write: write DB → invalidate cache key
   Problem: race condition — two threads can write stale value

3. Write-through
   Write: write DB + write cache atomically
   Pro: cache always fresh. Con: write latency, cache filled with rarely-read data

4. Write-behind (Write-back)
   Write: update cache only → async flush to DB in batch
   Pro: very fast writes. Con: data loss if cache crashes before flush
   Use: high-write-rate metrics, counters (exact value not critical)

5. Event-driven invalidation
   DB → Debezium (CDC) → Kafka → Cache invalidation service → Redis DEL
   Pro: cache stays fresh within milliseconds. No polling.
   Con: complexity, eventual consistency window

6. Versioned keys
   Cache key = "product:{id}:v{version}"
   On update: increment version in DB, new reads use new key
   Old key becomes dead (expires via TTL)
   Pro: no explicit invalidation needed. Con: stale keys accumulate

For Meta (Facebook):
   McRouter → Memcache layer
   On write: invalidation message to all Memcache replicas via McSqueal
   Lease mechanism to prevent thundering herd and stale sets
```

> 🌍 **Real-World:** Meta's Memcache fleet (the world's largest Memcached deployment, serving 1+ billion users) uses CDC-based invalidation via McSqueal — a MySQL binlog reader that detects every write and fires invalidation messages to all regional Memcache clusters within ~100ms. Netflix uses Dynomite (a Redis proxy) with event-driven invalidation via Kafka: when a movie's metadata changes in their CMS, a Debezium connector reads the Postgres binlog and publishes an invalidation event that cascades to all 200+ CDN edge caches globally within seconds.

---

## Section 5: Production Engineering

---

### Q22. Your service's p99 latency spiked. Walk me through your debug process.
**Asked at:** Google, Meta, Amazon, Uber, Netflix

**Answer:**

```text
Step 1 — Triage (first 2 minutes)
  Is it getting worse or stable? → Prometheus graph
  Which endpoints? All or specific? → break down by route
  Which regions? All or one? → geo-split
  Deployment in last 30 min? → check change log

Step 2 — Eliminate external factors
  Downstream service latency? → check their SLO dashboard
  DB slow queries? → check slow query log, connection pool metrics
  Network issues? → check inter-DC latency, packet loss
  CPU/Memory saturation? → USE metrics

Step 3 — Find the hot path
  Enable distributed tracing → find which span is slow (Jaeger/Zipkin)
  What's different about slow requests vs fast ones?
    - Specific user IDs? → resource contention / lock contention
    - Specific time pattern? → GC pause, cron job conflict, autovacuum
    - Request size? → serialization bottleneck

Step 4 — Common root causes at p99
  GC pause (Java): long GC stop-the-world → reduce heap, tune GC, use G1/ZGC
  Lock contention: synchronized block contested → move to lock-free or reduce scope
  N+1 queries: each loop iteration fires a DB query → use JOIN or batch query
  Connection pool exhaustion: all connections checked out → increase pool or add timeout
  Noisy neighbor: co-located service consuming CPU → isolate in separate pod/node
  DNS timeout: failed DNS lookups with 5s timeout → add DNS caching, check resolver

Step 5 — Mitigate first, fix second
  Circuit breaker open for slow downstream? → reduces blast radius
  Roll back recent deployment? → if correlation confirmed
  Scale out? → if CPU/memory saturated
  Then fix root cause and deploy
```

> **💡 Key Design Decision:** Always **mitigate before fixing**. Opening a circuit breaker or rolling back a deployment restores user experience in minutes; finding and fixing a root-cause bug can take hours.

> 🌍 **Real-World:** Google's SRE book describes their p99 latency investigation process as "triage in the first 2 minutes, isolate in the next 5, mitigate within 10." During a 2020 Google Cloud outage, the team identified a misconfigured quota change as the root cause in 11 minutes but first mitigated by reverting the config change in 4 minutes — restoring service while the root-cause investigation continued. Netflix's "Chaos Monkey" practice means their engineers regularly practice this debug loop in production, making them dramatically faster at the p99 latency spike scenario.

---

### Q23. How do you design for zero-downtime deployments?
**Asked at:** Amazon, Google, Uber, Stripe, Netflix

**Answer:**

> **💡 Key Design Decision:** **Canary releases** with automated SLO gates are the gold standard at FAANG scale — gradual traffic shift with automatic rollback if error rate or latency degrades, giving confidence at each stage without full exposure.

```text
Strategies (in order of sophistication):

1. Rolling Deployment
   Replace instances one at a time (or N at a time)
   Old and new version run simultaneously during rollout
   Risk: backward-incompatible API changes break in-flight requests
   Requirement: new code must handle old requests AND old code must handle new responses

2. Blue-Green Deployment
   Run two identical environments (blue=live, green=new)
   Switch load balancer from blue to green atomically
   Rollback: flip LB back in seconds
   Cost: 2x infrastructure during deployment
   Risk: DB migrations must be backward-compatible during switch

3. Canary Release
   Route 1% → 5% → 20% → 100% of traffic to new version
   Monitor error rate and latency at each stage
   Automatic rollback if SLO breached
   Best for: FAANG scale (gradual confidence building)

4. Feature Flags
   Deploy new code to all instances, but gate behind feature flag
   Enable for internal users → beta users → all users
   Rollback: flip flag, no re-deployment needed

DB migrations for zero-downtime:
   Schema changes must be backward-compatible:
   Phase 1: Add new column (nullable), deploy new code (reads new + old column)
   Phase 2: Backfill existing rows
   Phase 3: Make column non-nullable, drop old column
   Never: DROP column / ALTER column type in same release as code change

Health checks during deployment:
   Kubernetes readiness probe: only route traffic when /ready returns 200
   Liveness probe: restart pod if /health fails
   Graceful shutdown: drain in-flight requests before SIGTERM, 30s grace period
```

> 🌍 **Real-World:** Amazon deploys thousands of times per day using canary releases with automated SLO gates — if a canary deployment causes error rate to exceed 0.01% above baseline, it is automatically rolled back without human intervention. Stripe uses feature flags (LaunchDarkly) to separate code deployment from feature release, allowing them to deploy new payment logic to 100% of servers but enable it for only 1% of API keys initially — a model they credit for reducing payment-related incidents by 60%.

---

### Q24. Explain how you'd implement distributed tracing from scratch.
**Asked at:** Google, Uber, Lyft, Netflix

**Answer:**

> **💡 Key Design Decision:** **Tail-based sampling** is preferable to head-based sampling at high scale — by buffering all spans and sampling only after the trace completes, you can ensure that all error traces and slow traces are captured, not just a random 1%.

```text
Core concepts:
  Trace: end-to-end record of a single request across all services
  Span: one operation within a trace (one service call, one DB query)
  Span Context: trace_id + span_id propagated via headers

Headers (W3C standard):
  traceparent: 00-{trace_id}-{parent_span_id}-{flags}
  tracestate:  vendor-specific key-value pairs

Implementation:
  1. Entry point (API gateway): generate trace_id (UUID), create root span
  2. Outgoing call: inject headers (traceparent) into HTTP/gRPC request
  3. Receiving service: extract headers → create child span with parent_span_id
  4. Each span records: start_time, end_time, service_name, operation, tags, logs

Sampling:
  100% tracing = too expensive at Google scale (millions of req/sec)
  Head-based sampling: decide at entry point (sample 1% of all requests)
  Tail-based sampling: buffer all spans, decide after trace is complete (sample slow/error traces)
  Adaptive sampling: increase sample rate when error rate rises

Storage:
  Spans exported to Kafka → ingested by Jaeger/Zipkin/Tempo
  Time-series store for span data (Cassandra in Jaeger)
  Retention: 7 days for full traces, 30 days for aggregates

What it enables:
  - Find which service added the most latency
  - Correlate error spike with specific downstream service
  - Detect N+1 DB query patterns
  - Measure impact of code changes on specific service latencies
```

> 🌍 **Real-World:** Uber built Jaeger (now a CNCF graduated project) because their 2,000+ microservices made it impossible to debug latency without trace propagation — a single "request a ride" user action touches 30+ services. Jaeger now uses tail-based sampling at Uber: all spans are buffered for 30 seconds, and only traces with errors or p99+ latency are permanently stored, reducing storage costs by 95% vs 100% sampling while capturing 100% of anomalous traces. Twitter (now X) uses Zipkin with the same W3C `traceparent` header standard described here.

---

## Section 6: Behavioral / Leadership

*(SDE-3 behavioral = leadership at scale, technical influence, mentorship)*

---

### Q25. Tell me about a time you drove a major technical decision that had org-wide impact.
**Asked at:** Amazon, Google, Meta, Microsoft

**What they're testing:** Ownership, technical judgment, influencing without authority, long-term thinking.

**Answer framework (STAR with SDE-3 depth):**
```text
Situation: Set the technical context and stakes. What was at risk?
Task: What was YOUR specific role — not just "I was on the team"
Action: 
  - How did you identify the problem?
  - How did you build the case? (data, prototypes, stakeholder alignment)
  - How did you handle opposition?
  - How did you drive execution across teams?
Result:
  - Quantified impact (latency, cost, reliability)
  - Organizational change (new standard, team adoption)
  - Long-term outcome (still running 2 years later? Saved $X/year?)
```

**Strong answer signals:**
```text
✓ "I wrote a design doc and got 5 senior engineers to review it"
✓ "The opposing team's concern was valid — I incorporated it and that made the design better"
✓ "I ran a proof of concept to de-risk the decision before asking for resources"
✓ "After we shipped, I wrote a post-mortem on what we'd do differently"
✗ "We decided to..." (use "I" — own your contribution)
✗ Vague impact ("it went well", "users were happier")
```

---

### Q26. Describe a time you had to deal with significant technical debt. What did you do?
**Asked at:** Amazon, Google, Meta, Atlassian

**Answer framework:**
```text
What they want to hear:
  - You identified the debt proactively (not reactive firefighting)
  - You quantified the cost (dev velocity, incident rate, on-call burden)
  - You built a business case (why paying it down is worth engineering time)
  - You phased the work alongside feature development (not a big-bang rewrite)
  - You measured improvement after

Red flags:
  - "We just rewrote everything" (rewrites are usually wrong)
  - "We never had time to fix it" (means you didn't advocate)
  - No metrics on impact
```

---

### Q27. A team member is consistently late on deliverables and blocking your project. What do you do?
**Asked at:** Amazon, Google, Microsoft, Meta

**Answer:**
```text
Step 1: Assume good intent first. Talk to them privately.
  "I noticed the auth service integration has slipped twice. Is there something blocking you
  that I can help with? I want to understand before we plan the next sprint."

Step 2: Diagnose the root cause:
  - Unclear requirements? (I should have been clearer)
  - Personal issues? (handle with empathy)
  - Technical overload? (scope the work together, pair with them)
  - Skill gap? (identify and bridge)
  - Misalignment on priority? (escalate to shared manager with data)

Step 3: Create visibility
  "Let's do daily syncs just for this piece until we're back on track."
  Not a threat — just shared accountability.

Step 4: Escalate if needed — but last resort, not first
  Document: what you tried, when, what the outcome was.
  Escalate to manager with facts, not judgment.

Key signal: SDE-3 resolves this peer-to-peer first. Escalation = last resort.
```

---

### Q28. How do you prioritize when you have 3 high-priority projects simultaneously?
**Asked at:** Meta, Amazon, Google

**Answer:**
```text
My prioritization framework at SDE-3:

1. Impact vs Effort matrix first
   - Quick wins that unblock others → do now
   - High impact, high effort → schedule properly with milestones
   - Low impact → push back or delegate

2. Identify dependencies
   - Which project is blocking other teams? That gets priority.
   - Which project has a hard deadline (regulatory, launch)? That gets priority.

3. Communicate early
   Don't silently delay. Go to stakeholders within 24 hours:
   "I have three P0s simultaneously. Here's my proposed sequencing and why. 
   Please flag if my prioritization is wrong."
   This is leadership — not just execution.

4. Reduce scope, not quality
   Can I deliver 80% of project B to unblock the downstream team, 
   while I finish project A? Partial delivery >> no delivery.

5. Protect the critical path
   Identify what MUST happen for each project vs what SHOULD happen.
   Focus engineering time on must-haves first.

What NOT to say: "I work harder" (not a strategy) or "I just do them all" (not credible at scale)
```

---

## Section 7: Database & Infrastructure

---

### Q29. How does a database index work? What are the tradeoffs?
**Asked at:** Google, Amazon, Meta, Stripe

**Answer:**

> **💡 Key Design Decision:** The **leftmost prefix rule** for composite indexes is frequently misunderstood. `INDEX (last_name, first_name)` cannot accelerate `WHERE first_name = ?` alone — only queries that use the leftmost column benefit.

```text
B-Tree Index (default in PostgreSQL, MySQL):
  Balanced tree. Leaf nodes contain actual row pointers (or data in clustered index).
  O(log n) search, range queries efficient.
  
  CREATE INDEX idx_email ON users(email);
  → Maintains sorted copy of (email, row_pointer) pairs
  → Binary search in O(log n) vs full table scan O(n)

Hash Index:
  O(1) equality lookup. Cannot do range queries.
  Used by: Redis, some OLTP cases.
  
Composite Index:
  INDEX (last_name, first_name)
  Works for: WHERE last_name = ? AND first_name = ?
  Works for: WHERE last_name = ?  (leftmost prefix rule)
  Fails for: WHERE first_name = ?  (can't skip leftmost column)

Covering Index:
  Index contains all columns needed by the query → no table lookup needed
  INDEX (user_id, created_at, status)
  SELECT created_at, status FROM orders WHERE user_id = 123
  → Query served from index alone (index-only scan)

Tradeoffs:
  Benefit: faster reads (orders of magnitude)
  Cost:
    - Extra storage (can be 20-50% of table size)
    - Slower writes (index must be updated on INSERT/UPDATE/DELETE)
    - Optimizer may choose wrong index → use EXPLAIN to verify
    - Over-indexing kills write performance on write-heavy tables

Rule of thumb:
  Index columns used in WHERE, JOIN ON, ORDER BY
  Don't index low-cardinality columns (gender: M/F → full scan often faster)
  Monitor: pg_stat_user_indexes for unused indexes → drop them
```

> 🌍 **Real-World:** Shopify runs one of the world's largest PostgreSQL deployments, supporting millions of e-commerce stores. Their engineering blog describes a case where a missing index on `orders(shop_id, created_at)` caused a full table scan on their 2-billion-row orders table during Black Friday, taking query time from 2ms to 45 seconds under load. Adding the composite index (leftmost prefix: `shop_id`, then `created_at` for range scans) brought it back to 1ms. They also run automated weekly jobs to identify and drop unused indexes (using `pg_stat_user_indexes`) because over-indexing was slowing write throughput on their highest-volume tables.

---

### Q30. How does Kafka guarantee exactly-once semantics?
**Asked at:** Uber, LinkedIn, Confluent, Stripe, Amazon

**Answer:**

> **💡 Key Design Decision:** Kafka's exactly-once guarantees apply **within the Kafka pipeline only**. If your consumer calls an external API or writes to an external DB, you still need idempotent external calls (e.g., Stripe idempotency keys) to achieve true end-to-end exactly-once.

```text
Three delivery guarantees:

At-most-once: fire and forget. Message may be lost. Never delivered twice.
At-least-once: producer retries on failure. May deliver twice.
Exactly-once: delivered precisely once. Complex to achieve.

Kafka exactly-once has two parts:

1. Idempotent Producer (prevents duplicate sends):
   producer.enable.idempotence = true
   Each message gets: (PID, Sequence Number)
   Broker deduplicates: if sequence N already received from PID X → discard
   Handles: producer retry after network failure

2. Transactional API (atomic read-process-write):
   producer.initTransactions()
   producer.beginTransaction()
   consumer.poll()                    // read from input topic
   producer.send(outputTopic, result) // write to output topic
   producer.sendOffsetsToTransaction(offsets, groupId) // commit offset atomically
   producer.commitTransaction()
   
   If crash: transaction rolls back. Consumer offset not committed.
   On restart: consumer re-reads same input → processes again → commits atomically.
   
   Result: no message is processed twice, no message is skipped.

Real-world caveat:
  Exactly-once in Kafka = exactly-once within Kafka pipeline
  If your processing step calls an external API → still at-least-once for that
  Need idempotent external calls too (Stripe: idempotency keys)

Performance cost:
  Idempotent: ~20% write latency overhead
  Transactions: higher latency (waits for all replicas + coordinator)
  Most teams: at-least-once + idempotent consumers (simpler, faster)
```

> 🌍 **Real-World:** LinkedIn (Kafka's creator) uses Kafka's exactly-once transactional API for their billing and analytics pipelines where double-counting ad impressions would cause financial discrepancies. Their engineering team published that enabling idempotent producers added ~20ms to their p99 produce latency but reduced duplicate delivery incidents from several per week to zero. Uber's payment settlement pipeline uses the transactional API to atomically consume fare events and produce ledger entries — exactly-once within Kafka — while relying on idempotency keys for the external Stripe API call, matching the real-world caveat above.

---

## Quick-Fire Questions

These are asked to test depth in 2-3 minutes:

```text
Q: What's the difference between optimistic and pessimistic locking?
A: Optimistic — no lock, check version on write (abort if changed, retry). 
   Best for: low contention, long-running reads. 
   Pessimistic — acquire lock before read, hold till commit. 
   Best for: high contention, financial transactions.

Q: How does consistent hashing work?
A: Map both nodes and keys onto a ring (0..2^32). 
   Key goes to the next node clockwise. Node addition/removal 
   only remaps ~K/N keys (vs all keys in naive modulo hashing).
   Virtual nodes (vnodes) balance uneven key distribution.

Q: What is the CAP theorem? Which do you sacrifice and when?
A: Can't have all three: Consistency, Availability, Partition tolerance.
   During partition, choose: CP (consistent, may reject writes) or AP (available, may return stale).
   CP: banking, inventory. AP: DNS, shopping cart.
   Note: "CA" systems (no partition tolerance) don't exist in distributed systems.

Q: Explain the difference between process and thread.
A: Process: isolated address space, own memory, inter-process via IPC/sockets.
   Thread: shares address space with other threads in same process, cheaper to create.
   Go: goroutines (M:N threading, cheap, ~2KB stack vs 1MB for OS threads).
   Java: JVM threads = OS threads (1:1). Use virtual threads (Java 21+) for scale.

Q: What is a memory leak in Go and how do you find it?
A: Goroutine leak: goroutine started, never exits (blocked on channel, waiting for response).
   Fix: always use context with timeout/cancel for blocking ops.
   Find: pprof goroutine profile — look for unexpected goroutine count growth.
   Other: forgotten reference in slice/map preventing GC.

Q: SQL vs NoSQL — when do you choose NoSQL?
A: NoSQL when:
   - Flexible/evolving schema (documents: MongoDB)
   - Massive write throughput (Cassandra: 1M writes/sec)
   - Simple key-value access patterns (Redis, DynamoDB)
   - Time-series data (InfluxDB, TimescaleDB)
   SQL when: ACID needed, complex JOINs, reporting, strong consistency required.

Q: What is a goroutine leak? How do you detect it?
A: Goroutine that was spawned and never terminates.
   Common cause: goroutine waiting on channel that is never sent to.
   Detection: runtime.NumGoroutine() growing over time. pprof goroutine dump.
   Fix: use context.WithTimeout, ensure all channels have senders/receivers properly paired.

Q: Explain WAL (Write-Ahead Log) in databases.
A: Before modifying data on disk, write the change to WAL first.
   On crash: replay WAL to recover uncommitted transactions.
   Enables: durability (D in ACID), point-in-time recovery, replication (WAL streaming).
   PostgreSQL: WAL segment files → streamed to replicas for replication.
```

---

## Interview Tips for SDE-3

```text
1. Scope before designing
   First 5 minutes: ask clarifying questions, define scale, list assumptions.
   "I'll assume 10M DAU, 100M daily requests, SLA of 99.9%..."
   Interviewers reward structured thinking over jumping to solutions.

2. Think out loud
   "I'm considering option A vs B. A gives lower latency but costs more.
   Given this is read-heavy, I'll pick A."
   Show your reasoning, not just your conclusion.

3. Name tradeoffs proactively
   Don't wait to be asked. Say: "The downside of this is X. We can mitigate with Y."
   SDE-3s know there are no perfect answers.

4. Start with the critical path
   In 45 minutes, you can't fully design Twitter.
   Identify and solve the hardest/most interesting part. Breadth-first, then depth.

5. Bring numbers
   Don't just say "use Redis." Say "with 100k req/sec, one Redis instance handles this,
   but I'd add a replica for fault tolerance."

6. For behavioral: lead with the result
   "I reduced deployment time from 4 hours to 20 minutes. Here's how..."
   Hooks them immediately. Then tell the story.
```

---

## ⭐ IMPORTANT CONCEPTS — Using These Question Banks

> ⭐ **IMPORTANT CONCEPT:** SDE3/Staff rounds probe **depth on your design choices** and **production judgment** more than trivia recall.

## 🛠️ PRACTICAL Drill
1. Pick 5 questions. Answer aloud in 3 minutes each.  
2. For each, force: constraints → options → recommendation → failure mode.  
3. Mark any answer without a tradeoff as fail; rewrite.

