# SDE-3 More Technical Interview Problems & Answers

Fresh problems — no overlap with FAANG-System-Design.md or SDE3-Real-Interview-Questions.md.
Sourced from real interview reports: Uber, Netflix, Google, Amazon, Lyft, DoorDash, Airbnb, Stripe, Coinbase.

---

## Table of Contents

1. [Section 1: System Design — New Systems](#section-1-system-design--new-systems)
   - [Q1. Design Uber / Lyft (Ride-Sharing Platform)](#q1-design-uber--lyft-ride-sharing-platform)
   - [Q2. Design Netflix / YouTube (Video Streaming)](#q2-design-netflix--youtube-video-streaming)
   - [Q3. Design a Web Crawler](#q3-design-a-web-crawler)
   - [Q4. Design a Distributed Cache (like Redis/Memcached)](#q4-design-a-distributed-cache-like-redismemcached)
   - [Q5. Design an Ad Click Aggregation System](#q5-design-an-ad-click-aggregation-system)
   - [Q6. Design a Real-Time Gaming Leaderboard](#q6-design-a-real-time-gaming-leaderboard)
   - [Q7. Design an API Gateway](#q7-design-an-api-gateway)
2. [Section 2: Low-Level Design — New Problems](#section-2-low-level-design--new-problems)
   - [Q8. Design an Elevator System](#q8-design-an-elevator-system)
   - [Q9. Design a Vending Machine](#q9-design-a-vending-machine)
   - [Q10. Design a Hotel Booking System (like Booking.com)](#q10-design-a-hotel-booking-system-like-bookingcom)
3. [Section 3: More DSA / Coding](#section-3-more-dsa--coding)
   - [Q11. Trapping Rain Water (LC 42)](#q11-trapping-rain-water-lc-42--hard-asked-at-almost-every-faang)
   - [Q12. Sliding Window Maximum (LC 239)](#q12-sliding-window-maximum-lc-239--hard)
   - [Q13. Course Schedule II (LC 210)](#q13-course-schedule-ii-lc-210--topological-sort)
   - [Q14. Number of Islands (LC 200) + Variations](#q14-number-of-islands-lc-200--variations)
   - [Q15. Minimum Window Substring (LC 76)](#q15-minimum-window-substring-lc-76--hard)
   - [Q16. Longest Palindromic Substring (LC 5)](#q16-longest-palindromic-substring-lc-5)
   - [Q17. Word Break II (LC 140)](#q17-word-break-ii-lc-140--hard)
   - [Q18. Coin Change (LC 322) + Coin Change II (LC 518)](#q18-coin-change-lc-322--coin-change-ii-lc-518)
   - [Q19. Merge Intervals (LC 56) + Meeting Rooms II (LC 253)](#q19-merge-intervals-lc-56--meeting-rooms-ii-lc-253)
   - [Q20. Longest Increasing Subsequence (LC 300)](#q20-longest-increasing-subsequence-lc-300--dp--binary-search)
4. [Section 4: OS, Networking & Concurrency (Tricky Questions)](#section-4-os-networking--concurrency-tricky-questions)
   - [Q21. What happens when you type "google.com" in a browser?](#q21-what-happens-when-you-type-googlecom-in-a-browser)
   - [Q22. Explain TCP vs UDP. When would you choose UDP?](#q22-explain-tcp-vs-udp-when-would-you-choose-udp)
   - [Q23. Explain Deadlock. How do you detect and prevent it?](#q23-explain-deadlock-how-do-you-detect-and-prevent-it)
   - [Q24. What is a race condition? How do you prevent it in Go?](#q24-what-is-a-race-condition-how-do-you-prevent-it-in-go)
   - [Q25. Explain context.Context in Go. Why is it important?](#q25-explain-contextcontext-in-go-why-is-it-important)
5. [Section 5: Language-Specific Traps](#section-5-language-specific-traps)
   - [Q26. Java: HashMap vs ConcurrentHashMap](#q26-java-what-is-the-difference-between-hashmap-and-concurrenthashmap)
   - [Q27. Go: Goroutine Leak](#q27-go-explain-goroutine-leak-how-do-you-find-and-fix-it)
6. [Quick-Fire Round 2](#quick-fire-round-2)
7. [SDE-3 Patterns Cheat Sheet](#sde-3-patterns-cheat-sheet)

---

## SECTION 1: SYSTEM DESIGN — NEW SYSTEMS

---

## Q1. Design Uber / Lyft (Ride-Sharing Platform)

**Asked at:** Uber (extremely common), Lyft, DoorDash, Grab, Ola

### Clarifying Questions

- Matching algorithm: nearest driver or surge-aware?
- Real-time location updates: how often?
- Multi-city? (yes, global)
- Focus: matching, pricing, or the whole system?

### Answer

**Core components:**

```text
Rider App  →  API Gateway  →  Ride Service
Driver App →  Location Service (websocket)
               ↓
         Matching Service  →  Driver DB (Quadtree / geohash)
               ↓
         Pricing Service (surge calculation)
               ↓
         Trip Service → Kafka → Notification, Billing, Analytics
```

### Location Tracking (the hard part)

> **⚠️ Scale Challenge:** Drivers send GPS updates every 4 seconds. At 1M active drivers, that is 250K writes/second to the location store — only Redis can absorb this write rate.

```text
Driver sends GPS update every 4 seconds via WebSocket
Location Service receives: { driver_id, lat, lng, timestamp, heading }
Stored in Redis GeoSet (sorted set by geohash score):
  GEOADD drivers:available <lng> <lat> <driver_id>
  
Find nearby drivers:
  GEORADIUS drivers:available <rider_lng> <rider_lat> 5 km ASC COUNT 20
  Returns drivers within 5km, sorted by distance
  O(N+log M) where N = results, M = total drivers in area
```

### Geohashing vs Quadtree

> **💡 Key Design Decision:** Uber uses H3 (hexagonal hierarchical indexing) instead of geohashing for surge zones because hexagons tile without gaps and minimize edge effects — a problem where a driver 1 meter away can fall in a completely different geohash cell.

```text
Geohash:
  Encode lat/lng into a string: "9q8yy" represents a 5km x 5km cell
  Precision chars: 1=5000km, 4=40km, 6=1km, 8=40m
  Pros: simple, Redis native support
  Cons: edge cases at cell borders (driver 1m away but different geohash)
  Fix: search 9 cells (target + 8 neighbors)

Quadtree:
  Recursively divide map into 4 quadrants
  Leaf = list of drivers (max N per leaf, split when full)
  Pros: uniform density handling, better for dense cities
  Cons: more complex to implement and update

Uber uses H3: hexagonal hierarchical spatial indexing
  Hexagons tile without gaps, edge effects minimized
  Used for surge pricing zones, driver positioning
```

### Matching Algorithm

```text
Supply-demand matching every 4 seconds (batch):
  1. For each unmatched rider: find top 5 candidate drivers (by proximity)
  2. Score each driver: distance + driver rating + ETA estimate
  3. Assign rider to best driver
  4. Dispatch notification to driver (accept/decline, 15s timeout)
  5. Driver declines → next candidate, mark driver as "less preferred" for 5 min

Advanced: Hungarian algorithm (optimal bipartite matching for multiple riders)
  Minimizes total ETA across all rider-driver pairs simultaneously
```

### Surge Pricing

```text
Trigger: supply/demand ratio in a geohash cell falls below threshold
surge_multiplier = f(demand_requests / available_drivers)
Computed per-cell every 60 seconds
Displayed to rider before confirmation
Stored in Redis with 90s TTL
```

### Database Choices

| Store | Technology | Reason |
|-------|------------|--------|
| Trip data | Postgres | ACID for billing, dispute resolution |
| Driver location | Redis | In-memory, high write rate |
| Analytics | Kafka → Spark → Hive/BigQuery | Batch processing |
| Driver history / earnings | Cassandra | Append-only, write-heavy |

> 🌍 **Real-World:** Uber's location service handles ~1M active drivers sending GPS pings every 4 seconds — roughly 250K writes/sec — absorbed entirely by Redis GeoSets. Their engineering blog describes switching from a custom in-house geo-index to Redis + H3 hexagonal indexing for surge zones, cutting edge-case boundary errors and simplifying their matching pipeline.

---

## Q2. Design Netflix / YouTube (Video Streaming)

**Asked at:** Netflix, YouTube/Google, Amazon Prime, Disney+, Hotstar

### Clarifying Questions

- Upload flow or playback flow or both?
- Live streaming or on-demand?
- Scale: 200M subscribers, 1B hours/day watched

### Answer

### Upload Pipeline

```text
Creator uploads raw video
→ API Gateway → Upload Service → Raw Storage (S3)
→ Kafka event: "video.uploaded"
→ Transcoding Service (AWS Elemental / custom):
    Produces: 360p, 480p, 720p, 1080p, 4K
    Format: HLS (HTTP Live Streaming) — series of .ts segment files + .m3u8 manifest
→ Segments stored in S3
→ Metadata DB updated: video is ready
→ CDN (Akamai/CloudFront) pre-warms popular content
```

### Why HLS (Chunked Streaming)?

> **💡 Key Design Decision:** HLS splits video into 6-second segments, enabling **Adaptive Bitrate (ABR)** streaming. The client independently decides quality based on available bandwidth — no server involvement needed per quality switch.

```text
Video split into 6-second segments
Client downloads manifest (.m3u8) → list of segment URLs
Downloads segments one at a time
ABR (Adaptive Bitrate): client switches quality based on bandwidth
  - 3 seconds of buffer left → switch to lower quality
  - 30 seconds of buffer → switch to higher quality
Benefit: any segment from CDN, resilient, scrubbing (jump to 40min)
```

### CDN Architecture

> **💡 Key Design Decision:** Netflix Open Connect places Netflix-owned CDN appliances inside ISP data centers. The ISP gets free hardware; Netflix gets last-mile optimization and eliminates 95% of traffic from its own data centers.

```text
Origin (S3) → CDN PoP (Point of Presence, 200+ globally)
  First request: CDN fetches from origin, caches locally
  Subsequent: served from edge, <50ms latency
  
Netflix Open Connect:
  Netflix-owned CDN appliances inside ISP data centers
  ISP gets free hardware, Netflix gets last-mile optimization
  Top 1000 titles pre-loaded on appliances (proactive caching)
  Eliminates 95% of traffic from Netflix's own DCs
```

### Playback Flow

```text
Client requests play → Playback Service:
  1. Auth check: is user subscribed?
  2. License check: DRM (Widevine/FairPlay) token issued
  3. Steering: which CDN PoP is closest? Return best manifest URL
  4. Client downloads manifest → starts streaming from CDN
  5. Client reports rebuffering events → Quality of Experience (QoE) analytics
```

### Recommendation System (How Content Appears on Home Page)

```text
Offline (daily):
  1. Collaborative filtering: users with similar taste → similar recommendations
  2. Matrix factorization: user-item rating matrix → latent factors
  3. Output: top-N candidates per user → stored in recommendation store

Online (real-time):
  4. Session context: what did user just watch? What time is it?
  5. Re-rank candidates: add recency, trending, new releases
  6. A/B test different ranking models
  7. Thumbnail selection: which image gets highest CTR for this user?
```

> 🌍 **Real-World:** Netflix streams roughly 15% of global downstream internet traffic during peak hours. Their Open Connect CDN places appliances directly inside ISPs (Comcast, AT&T, etc.) pre-loaded with the top ~1,000 titles each night — eliminating 95%+ of traffic from Netflix's own datacenters. The recommendation system alone runs 300+ A/B tests simultaneously; their thumbnail personalization (showing different artwork per user) reportedly drives a measurable lift in play rate.

---

## Q3. Design a Web Crawler

**Asked at:** Google, Amazon, Bing/Microsoft, Common Crawl

### Answer

### Core Loop

```text
URL Frontier (queue) → Fetcher → Parser → Link Extractor
        ↑                                       |
        ←———————————————————— Filtered new URLs ←
                    ↓
              Content Store (S3)
              URL DB (seen/unseen)
              Index (inverted index for search)
```

### Politeness

```text
Cannot crawl same site aggressively. robots.txt must be respected.
  Fetch robots.txt for every domain on first visit
  Store: {domain → crawl_delay, disallow_paths}
  Rate limit: 1 request per crawl_delay per domain (often 1 req/sec)

Per-domain queues:
  politeness_queue:{domain} in Redis
  Worker picks domain → checks last_crawl time → waits if needed → fetches
```

### URL Frontier (Priority Queue)

> **💡 Key Design Decision:** Use a two-tiered queue: a priority queue (Redis sorted set, scored by PageRank/freshness) feeding into per-domain politeness queues. This satisfies both "crawl important pages first" and "don't hammer any single site."

```text
Priority based on:
  - PageRank estimate (pages linked to by many others → higher priority)
  - Freshness (last crawled > 30 days → higher priority)
  - Domain authority
  
Implementation:
  High-priority queue (Redis sorted set, score = priority)
  Per-domain subqueues (politeness)
  Scheduler picks from high-priority, selects one URL per domain per interval
```

### Deduplication

```text
URL dedup: Bloom filter (10 billion URLs, 1% false positive rate, ~1.2GB memory)
  Check before adding to frontier: if Bloom filter says "seen" → skip
  False positives acceptable (skip a rare URL) vs false negatives not acceptable

Content dedup: SimHash
  Compute 64-bit hash of document content
  Pages with similar content: their SimHashes differ in ≤ 3 bits
  Compare via Hamming distance instead of full content comparison
```

### Scale Estimation

| Metric | Calculation | Result |
|--------|-------------|--------|
| Target | 1 billion pages in 30 days | — |
| Pages/day | 1B / 30 | 33M pages/day |
| Pages/sec | 33M / 86400 | ~400 pages/sec |
| Fetcher fleet | 1 URL/sec each | 400 fetchers |
| Bandwidth | avg 100KB/page × 400/sec | 40 MB/sec |

> **⚠️ Scale Challenge:** Without DNS caching, 400 DNS lookups/sec will overwhelm DNS servers. Cache domain → IP with a 5-minute TTL — a DNS hit takes ~1 RTT but cached lookups are sub-millisecond.

### Storage

| Data | Technology |
|------|------------|
| Raw HTML | S3 (cheap, durable) |
| URL status | Cassandra (url, status, last_crawled, content_hash) |
| Inverted index | Elasticsearch or custom (for search downstream) |

> 🌍 **Real-World:** Common Crawl's open web crawler has indexed 3+ billion pages and releases petabyte-scale crawl datasets used by OpenAI and academic researchers. Google's production crawler (Googlebot) uses a two-tier priority system almost exactly as described — a global priority frontier based on PageRank and freshness feeds per-host polite queues, with DNS results cached aggressively to avoid hammering resolvers at their 100K+ pages/sec crawl rate.

---

## Q4. Design a Distributed Cache (like Redis/Memcached)

**Asked at:** Google, Amazon, Meta, Uber, Microsoft

### Clarifying Questions

- In-memory only or disk persistence?
- Single-node or distributed?
- What data structures? (key-value, sets, sorted sets, pub/sub)

### Answer

### Single-Node Cache Internals

```text
Storage: Hash table (O(1) get/set)
Eviction: Approximated LRU
  - Sample 5 random keys, evict the least-recently-used among them
  - True LRU needs O(N) or doubly linked list — expensive
  - Approximate LRU: within 5% of optimal, much cheaper

Memory layout:
  Key → RedisObject { type, encoding, ptr to data, lru_clock }
  String < 44 bytes: embedded in object (no malloc pointer, cache-friendly)
  String > 44 bytes: pointer to sds (simple dynamic string)

Single-threaded event loop (Redis 6.x single-threaded model):
  I/O multiplexing (epoll) → event queue → process one command at a time
  No locking needed for data structures → fast
  Multi-threaded I/O in Redis 6.0+ (but still single-threaded command execution)
```

### Consistent Hashing for Distributed

> **💡 Key Design Decision:** Consistent hashing limits cache invalidation to ~K/N keys when a node is added or removed (where K = total keys, N = node count). With naive modulo hashing, adding one node remaps nearly all keys — causing a thundering herd against the database.

```text
N cache nodes. Key → which node?
  Naive: node = hash(key) % N
  Problem: adding/removing a node rehashes all keys (cache miss storm)

Consistent hashing:
  Place nodes on a ring [0, 2^32)
  Key → hash(key) → find next node clockwise
  Add/remove node: only ~K/N keys remapped (K = total keys, N = nodes)

Virtual nodes:
  Each physical node has 150 virtual nodes on the ring
  Better distribution, less hotspot risk
  Used by: Cassandra, DynamoDB, Riak
```

### Replication

```text
Redis Sentinel: 1 master + N replicas, Sentinel monitors and promotes on failure
Redis Cluster: 16384 hash slots, sharded across nodes, each shard has replicas
  CLUSTER KEYSLOT mykey → slot number
  Each slot assigned to a master node → replicated to 1-2 replicas
  Client routes to correct node (smart client) or uses cluster proxy
```

### Persistence (Redis Durability Options)

> **💡 Key Design Decision:** Redis recommends the hybrid RDB+AOF mode. RDB snapshots allow fast restarts; AOF provides granular durability. Choosing "no persistence" makes Redis a pure cache — valid when the cache can be rebuilt from the database.

| Mode | Mechanism | Max Data Loss | Overhead |
|------|-----------|---------------|----------|
| None | — | All data on restart | None |
| RDB | Fork + snapshot every N seconds | Up to N seconds | Low (COW fork) |
| AOF (fsync/sec) | Append every command | ~1 second | Medium |
| AOF (fsync/always) | Append + sync per write | None | High (disk I/O per write) |
| Hybrid (RDB + AOF) | Both | ~1 second | Medium |

> 🌍 **Real-World:** Twitter (now X) ran Redis as a pure in-memory cache (no persistence) for their timeline fanout service — storing pre-computed timelines in Redis ZSETs with no AOF, accepting total cache loss on restart because timelines could be rebuilt from Cassandra in minutes. Twitch's chat system, by contrast, uses Redis with AOF fsync-per-second to survive broker restarts without losing recent chat state during live streams where losing context would visibly break the user experience.

---

## Q5. Design an Ad Click Aggregation System

**Asked at:** Meta, Google, Amazon, TikTok, Snap — very common at ad-tech companies

### Clarifying Questions

- Raw click events or aggregated counts?
- Latency of aggregation: real-time or batch?
- Queries needed: "clicks for ad X in last 1 hour" or more complex?
- Deduplication of duplicate clicks (bot detection)?

### Answer

### Requirements

| Dimension | Target |
|-----------|--------|
| Input volume | 1 billion click events/day (~12K clicks/sec) |
| Query types | `clicks_count(ad_id, time_window)`, `top_N_ads(M minutes)` |
| Aggregation latency | Within 1 minute of click |
| Count accuracy | ~0.01% error acceptable (approximate OK) |

### Architecture

```text
Click event → Kafka (raw clicks topic)
                ↓
           Stream Processor (Flink / Spark Streaming)
                ↓                          ↓
        Aggregation Store (ClickHouse)   Raw Event Store (S3)
                ↓
         Query Service → Dashboard
```

### Stream Aggregation (Flink)

```java
// Tumbling window: count clicks per ad per 1-minute window
dataStream
  .keyBy(event -> event.adId)
  .window(TumblingEventTimeWindows.of(Time.minutes(1)))
  .aggregate(new CountAggregator())
  .addSink(clickHouseSink);

// Sliding window: clicks in last 5 minutes, updated every 1 minute
dataStream
  .keyBy(event -> event.adId)
  .window(SlidingEventTimeWindows.of(Time.minutes(5), Time.minutes(1)))
  .aggregate(new CountAggregator());
```

### Late Events Handling

> **⚠️ Scale Challenge:** Network jitter means a click at 10:00:59 can arrive at Flink at 10:01:30 — after its window has already closed. Without watermarks, these events are silently dropped, causing systematic undercounting of ad impressions.

```text
Network delay: click happens at 10:00:59, arrives at Flink at 10:01:30
  Without handling: event assigned to wrong window → undercounting

Watermark: Flink tracks "how late can events be?" 
  Watermark = max_event_time - allowed_lateness (e.g. 2 minutes)
  Window closes only when watermark passes its end time
  Events arriving after window closes → side output (special handling)
  
  For clicks: 1 minute allowed lateness is safe for 99.9% of events
```

### Deduplication (Bot Clicks)

```text
Problem: same user clicks same ad 50 times in 1 second → inflated count
Solution: count unique (user_id, ad_id) pairs within a time window
  Use HyperLogLog (approximate count distinct):
    Standard error: 0.81%, memory: 12KB per counter regardless of cardinality
    Redis: PFADD ad:123:unique_clickers user456 → PFCOUNT ad:123:unique_clickers
  For exact: Bloom filter per (ad_id, time_window) — check before counting
```

### Storage (ClickHouse)

```sql
CREATE TABLE ad_clicks (
    ad_id      UInt64,
    timestamp  DateTime,
    user_id    UInt64,
    country    String,
    device     String
) ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (ad_id, timestamp);

-- Materialized view for pre-aggregated counts
CREATE MATERIALIZED VIEW ad_clicks_1m
ENGINE = SummingMergeTree()
ORDER BY (ad_id, minute)
AS SELECT ad_id, toStartOfMinute(timestamp) as minute, count() as clicks
FROM ad_clicks GROUP BY ad_id, minute;
```

### Top N Ads (Trending)

```text
Naive: SELECT ad_id, SUM(clicks) FROM ... ORDER BY clicks DESC LIMIT 10
Problem: aggregating billions of rows is slow

Better: Count-Min Sketch
  Space-efficient data structure for top-K heavy hitters
  O(1) update, O(1) query per element
  Memory: ~50KB for 1M ads with 1% error
  Libraries: Apache DataSketches

Or: maintain a heap of top-N in stream processor, update on every batch
```

> 🌍 **Real-World:** Meta's ad click measurement system processes ~10 billion click events per day through a Flink-based streaming pipeline writing into ClickHouse. Their engineering blog details how they use HyperLogLog in Redis to count unique viewers per ad with < 1% error using only 12KB per counter, and how watermarks with 2-minute allowed lateness capture 99.9% of late-arriving mobile click events from users on flaky connections.

---

## Q6. Design a Real-Time Gaming Leaderboard

**Asked at:** Google, Riot Games, Epic, Amazon GameStar, King

### Answer

### Requirements

| Requirement | Target |
|-------------|--------|
| Players | 10M players, each with a score |
| Updates | Real-time score updates (game end events) |
| Queries | Rank of a player, top 100, players near rank (±10) |
| Latency | Rank query < 10ms |

### Redis Sorted Set (Perfect Fit)

> **💡 Key Design Decision:** Redis **Sorted Set** (ZSET) is purpose-built for leaderboards. Its skip-list + hash table dual structure gives O(log N) for all rank and score operations, with 10M players fitting in ~600MB — a single Redis node.

```text
ZADD leaderboard <score> <player_id>    → O(log N) insert/update
ZRANK leaderboard <player_id>           → O(log N) rank (0-based, ascending)
ZREVRANK leaderboard <player_id>        → O(log N) rank (0-based, descending)
ZREVRANGE leaderboard 0 99              → O(log N + 100) top 100
ZREVRANGEBYSCORE leaderboard ... LIMIT  → range queries

10M players in sorted set: ~600MB memory
Operations: all O(log N) → log(10M) ≈ 23 ops → negligible
```

### Near-Me Ranking

```text
ZREVRANK → get player rank (e.g. rank 1532)
ZREVRANGE leaderboard 1522 1542 → players at ranks 1522-1542 (10 above, 10 below)
HMGET players {ids} → fetch player names/metadata from hash
```

### Sharding for 1B Players

> **⚠️ Scale Challenge:** 1 billion players in one sorted set would require ~60GB — far beyond a single Redis node. Shard by score range and compute global rank by summing cardinalities of lower shards.

```text
1B players in one sorted set: ~60GB → too large for one Redis node
Shard by score range:
  Shard 0: scores 0-999
  Shard 1: scores 1000-4999
  Shard 2: scores 5000-9999
  
Rank query: sum of cardinalities in lower shards + rank within this shard
  rank = ZCARD(shard0) + ZCARD(shard1) + ZREVRANK(shard2, player)
  Efficient if shards are balanced (adjust ranges over time)
  
Alternative: consistent hash on player_id → scatter/gather for top-N
```

### Fraud Detection

```text
Score suddenly jumps by 10M in 1 second → anomaly
  Monitor: score delta rate per player per second
  Threshold: alert if delta > 10x historical average
  Action: flag for manual review, soft-suspend leaderboard position
```

> 🌍 **Real-World:** Riot Games' League of Legends leaderboard (Challenger/Grandmaster ladder) uses Redis Sorted Sets to rank ~180,000 top players per region in real time. Their engineering team has published that all rank queries — including "players near me" — return in under 5ms globally, and that the entire top-ladder dataset for a region fits in under 50MB, making it trivially hostable on a single Redis node with a replica for failover.

---

## Q7. Design an API Gateway

**Asked at:** Amazon (AWS product), Google, Stripe, Kong, Netflix

### Answer

### What an API Gateway Does

**API Gateway** is the single entry point for all client requests. It handles:

```text
- Authentication / Authorization (JWT validation, API key check)
- Rate limiting (per user, per API key)
- Request routing (route /users/** → user-service, /orders/** → order-service)
- Load balancing (across service instances)
- SSL termination (TLS at edge, plain HTTP behind)
- Request/response transformation (add headers, translate REST↔gRPC)
- Observability (access logs, metrics per endpoint)
- Circuit breaker (stop forwarding if downstream is unhealthy)
```

### Architecture

```text
Client → DNS → CDN (optional) → API Gateway Cluster → Backend Services
                                      ↓
                               Config Store (etcd/Consul) — routing rules
                               Rate Limit Store (Redis)
                               Auth Service
                               Access Log (Kafka)
```

### Request Lifecycle

> **💡 Key Design Decision:** Rate limiting happens before authentication — a denied request at rate-limit stage costs one Redis INCR call. Running auth first would be far more expensive and would make the gateway vulnerable to auth-server DDoS amplification.

```text
1. TLS termination (handled by gateway)
2. Rate limit check: Redis INCR key → if > limit, 429 Too Many Requests
3. Auth: validate JWT signature (public key cached) or call Auth service
4. Route lookup: match path to service (trie-based routing, O(path_length))
5. Load balance: pick healthy instance (round-robin / least-connections)
6. Forward request (modify headers: add X-Request-ID, X-User-ID)
7. Receive response → return to client
8. Log: async write to Kafka (don't block on logging)
```

### Plugin Architecture (How Kong/Envoy Work)

```text
Request pipeline: handler chain pattern
  [RateLimiter] → [Authenticator] → [Router] → [LoadBalancer] → [Proxy]
  
Each plugin:
  pre_request(): inspect/modify incoming request
  post_response(): inspect/modify outgoing response
  
New plugin = new plugin registration (no core code change)
Order matters: rate limit before auth (cheaper), auth before routing
```

### Health Checking

```text
Gateway polls each backend instance: GET /health every 5 seconds
  Healthy: 200 OK within 1 second
  Unhealthy: 3 consecutive failures → remove from rotation
  Recovery: re-check every 10 seconds, add back after 2 successes
  
Active health check: gateway probes instances
Passive health check: observe real traffic error rates (5xx > 50% → remove)
```

> 🌍 **Real-World:** Kong (the open-source API gateway used by Nasdaq, The New York Times, and hundreds of enterprises) implements exactly this plugin-chain architecture — rate limiting runs before auth in the default plugin execution order. Netflix's Zuul gateway processes 100+ billion requests per day, using passive health checks (tracking 5xx error rates per backend) to automatically pull unhealthy instances from rotation within seconds without any operator intervention.

---

## SECTION 2: LOW-LEVEL DESIGN — NEW PROBLEMS

---

## Q8. Design an Elevator System

**Asked at:** Amazon, Microsoft, Uber, Thoughtworks

### Answer

**Classes:**

```text
ElevatorSystem       — coordinates all elevators
Elevator             — state machine: IDLE, MOVING_UP, MOVING_DOWN, OPEN
ElevatorController   — scheduling algorithm
Request              — (floor, direction) or (destination floor)
Display              — floor indicator panel
```

```java
public enum Direction { UP, DOWN }
public enum State { IDLE, MOVING_UP, MOVING_DOWN, DOOR_OPEN }

public class Elevator {
    private int currentFloor;
    private State state;
    private TreeSet<Integer> upQueue;    // floors to stop going up (ascending)
    private TreeSet<Integer> downQueue;  // floors to stop going down (descending)

    public void addStop(int floor, Direction direction) {
        if (floor > currentFloor) upQueue.add(floor);
        else downQueue.add(floor);
    }

    public void step() {  // called every second by scheduler
        switch (state) {
            case IDLE:
                if (!upQueue.isEmpty()) { state = State.MOVING_UP; }
                else if (!downQueue.isEmpty()) { state = State.MOVING_DOWN; }
                break;
            case MOVING_UP:
                currentFloor++;
                if (upQueue.contains(currentFloor)) {
                    upQueue.remove(currentFloor);
                    state = State.DOOR_OPEN;  // door opens, then MOVING_UP or IDLE
                }
                break;
            // similar for MOVING_DOWN
        }
    }
}

public class ElevatorController {
    private List<Elevator> elevators;

    // SCAN algorithm (like disk scheduling):
    // Elevator going UP: picks up all UP requests on the way
    // Reaches top → reverses, picks up all DOWN requests on way down
    
    public Elevator assign(int floor, Direction direction) {
        // Find closest elevator moving in the same direction
        // Fallback: closest idle elevator
        // Fallback: closest elevator (any direction)
        return elevators.stream()
            .min(Comparator.comparingInt(e -> cost(e, floor, direction)))
            .orElseThrow();
    }

    private int cost(Elevator e, int floor, Direction dir) {
        if (e.getState() == State.IDLE)
            return Math.abs(e.getCurrentFloor() - floor);
        if (e.movingSameDirection(dir) && e.canPickUp(floor))
            return Math.abs(e.getCurrentFloor() - floor);  // low cost, on the way
        return Integer.MAX_VALUE / 2;  // expensive, different direction
    }
}
```

**Follow-up: VIP elevator / express elevator?**

```text
Add priority queue: VIP requests get dedicated elevator or jump to front of queue
Express elevator: only stops at floors 1, 10, 20, 30 — separate queue
```

> 🌍 **Real-World:** ThyssenKrupp's MULTI elevator system (deployed in the East Side Tower, Berlin) replaced the classic SCAN algorithm with a destination dispatch algorithm — riders enter their destination floor at the lobby, and an optimizer (running a variant of the Hungarian assignment algorithm) groups riders heading to nearby floors into the same car, reducing average wait time by 50% compared to traditional button-based SCAN elevators. The same OOP State Machine pattern (IDLE → MOVING → DOOR_OPEN) underlies every modern elevator controller firmware.

---

## Q9. Design a Vending Machine

**Asked at:** Amazon, Microsoft, Goldman Sachs, Adobe

### Answer

```java
// State machine: IDLE → HAS_MONEY → DISPENSING → CHANGE_RETURN

public interface VendingMachineState {
    void insertCoin(VendingMachine vm, int amount);
    void selectProduct(VendingMachine vm, String productCode);
    void cancel(VendingMachine vm);
}

public class IdleState implements VendingMachineState {
    public void insertCoin(VendingMachine vm, int amount) {
        vm.addCredit(amount);
        System.out.println("Credit: " + vm.getCredit());
        vm.setState(new HasMoneyState());
    }
    public void selectProduct(VendingMachine vm, String code) {
        System.out.println("Insert money first");
    }
    public void cancel(VendingMachine vm) { /* nothing to cancel */ }
}

public class HasMoneyState implements VendingMachineState {
    public void insertCoin(VendingMachine vm, int amount) {
        vm.addCredit(amount);  // accept more coins
    }
    public void selectProduct(VendingMachine vm, String code) {
        Product p = vm.getInventory().get(code);
        if (p == null || p.getQuantity() == 0) {
            System.out.println("Out of stock");
            return;
        }
        if (vm.getCredit() < p.getPrice()) {
            System.out.println("Insufficient credit. Need " + (p.getPrice() - vm.getCredit()) + " more.");
            return;
        }
        vm.setState(new DispensingState(p));
        vm.dispense(p);  // triggers DispensingState logic
    }
    public void cancel(VendingMachine vm) {
        System.out.println("Returning: " + vm.getCredit());
        vm.returnChange(vm.getCredit());
        vm.setState(new IdleState());
    }
}

public class VendingMachine {
    private VendingMachineState state = new IdleState();
    private Map<String, Product> inventory = new HashMap<>();
    private int credit = 0;

    public void insertCoin(int amount) { state.insertCoin(this, amount); }
    public void selectProduct(String code) { state.selectProduct(this, code); }
    public void cancel() { state.cancel(this); }

    public void dispense(Product p) {
        p.decrementQuantity();
        credit -= p.getPrice();
        System.out.println("Dispensing: " + p.getName());
        if (credit > 0) returnChange(credit);
        setState(new IdleState());
    }

    public void returnChange(int amount) {
        // Greedy coin change: return using largest denomination first
        int[] denominations = {100, 50, 25, 10, 5, 1};
        for (int d : denominations) {
            while (amount >= d) { System.out.println("Return coin: " + d); amount -= d; }
        }
        credit = 0;
    }
}
```

> 🌍 **Real-World:** Crane Merchandising Systems (one of the world's largest vending machine manufacturers) uses a formal State Machine identical to this design in their firmware — IDLE, VEND_IN_PROGRESS, DISPENSE, and CHANGE_RETURN states with transition guards. Their machines run on embedded Linux and expose a REST API for remote inventory and revenue reporting, showing how this OOP pattern scales from interview whiteboards to production IoT hardware.

---

## Q10. Design a Hotel Booking System (like Booking.com)

**Asked at:** Airbnb, Booking.com, Expedia, Amazon

### Answer

**Core challenge:** prevent **double booking** (inventory consistency under concurrent load)

**Schema:**

```text
hotels(hotel_id, name, city, star_rating)
rooms(room_id, hotel_id, type, price_per_night, total_inventory)
reservations(reservation_id, room_id, user_id, check_in, check_out, status)
room_availability(room_id, date, available_count)  -- denormalized for fast lookup
```

### Availability Check + Booking (Prevent Double-Booking)

> **💡 Key Design Decision:** Use **pessimistic locking** (`SELECT ... FOR UPDATE`) for the booking path to guarantee no overbooking under concurrent load. The lock is held only for the duration of the transaction — typically milliseconds — making this safe at booking scale (1% of traffic).

```sql
-- Check availability (read path, no lock)
SELECT available_count FROM room_availability
WHERE room_id = ? AND date BETWEEN ? AND ?;

-- Booking (atomic, prevent overbooking)
BEGIN TRANSACTION;

-- Pessimistic locking: lock the rows we're about to update
SELECT available_count FROM room_availability
WHERE room_id = ? AND date IN (date1, date2, ...) FOR UPDATE;

-- Verify all dates have count > 0
-- If yes, decrement
UPDATE room_availability
SET available_count = available_count - 1
WHERE room_id = ? AND date IN (date1, date2, ...);

INSERT INTO reservations (room_id, user_id, check_in, check_out, status)
VALUES (?, ?, ?, ?, 'CONFIRMED');

COMMIT;
```

### Alternative: Optimistic Locking with Version

```sql
-- Read with version
SELECT available_count, version FROM room_availability WHERE ...;

-- Write: only succeed if version hasn't changed
UPDATE room_availability 
SET available_count = available_count - 1, version = version + 1
WHERE room_id = ? AND date = ? AND version = ? AND available_count > 0;

-- If 0 rows updated → conflict → retry
```

### Scale

> **⚠️ Scale Challenge:** Search is 99% of traffic; booking is 1%. Caching availability in Redis lets the search path absorb the load without touching the database. Redis acts as a fast pre-check; the DB remains the source of truth and handles the final atomic decrement.

```text
Read-heavy: search is 99% of traffic, booking is 1%
Caching availability: Redis (available_count per room per date)
  - On booking: decrement Redis AND DB (write-through)
  - Redis acts as fast availability check; DB is source of truth

Search: Elasticsearch for full-text (hotel name, city, amenities)
  + Geosearch (hotels within 5km of location)
  + Price/date filter in ES query

Reservation flow:
  1. User selects room + dates
  2. Hold inventory for 10 minutes (Redis TTL): "room X, date Y is soft-held"
  3. User completes payment
  4. On success: hard-confirm in DB
  5. On timeout/failure: release hold → Redis DEL
```

> 🌍 **Real-World:** Booking.com processes ~1.5 million room-nights booked per day. Their engineering blog details using exactly this pessimistic lock pattern (`SELECT ... FOR UPDATE`) for the final booking step, while serving availability searches via an Elasticsearch layer that is eventually consistent with the DB. The 10-minute soft-hold (Redis TTL) pattern is also how Airbnb handles their "request to book" flow — a host has 24 hours to accept, but the calendar is soft-blocked to prevent the same dates from being offered to two simultaneous guests.

---

## SECTION 3: MORE DSA / CODING

---

## Q11. Trapping Rain Water (LC 42) — Hard, asked at almost every FAANG

**Asked at:** Google, Amazon, Meta, Microsoft, Bloomberg

> **💡 Pattern Recognition:** Two-pointer. The water at any position equals `min(maxLeft, maxRight) - height[i]`. The two-pointer trick works because whichever side has the smaller max is the bottleneck — you can safely process that side without knowing the other side's full extent.

```java
// Two-pointer: O(n) time, O(1) space
public int trap(int[] height) {
    int left = 0, right = height.length - 1;
    int leftMax = 0, rightMax = 0, water = 0;
    while (left < right) {
        if (height[left] < height[right]) {
            if (height[left] >= leftMax) leftMax = height[left];
            else water += leftMax - height[left];
            left++;
        } else {
            if (height[right] >= rightMax) rightMax = height[right];
            else water += rightMax - height[right];
            right--;
        }
    }
    return water;
}
// Intuition: water at position i = min(maxLeft, maxRight) - height[i]
// Two-pointer: whichever side is smaller is the bottleneck — process it
```

> 🌍 **Real-World:** Google's SRE team uses this exact two-pointer pattern as a canonical example in their internal coding interview prep — it appears in almost every FAANG loop and is frequently asked at Bloomberg for their trading infrastructure roles, where histogram-style capacity analysis (modeling order book depth) maps directly to this problem.

---

## Q12. Sliding Window Maximum (LC 239) — Hard

**Asked at:** Google, Amazon, Uber, Airbnb

> **💡 Pattern Recognition:** **Monotonic deque** — maintain a deque of indices in decreasing order of values. Elements that can never be the maximum (smaller than current element and further left) are aggressively pruned from the back, keeping the deque O(n) total.

```java
// Monotonic deque: maintains indices in decreasing order of heights
public int[] maxSlidingWindow(int[] nums, int k) {
    int n = nums.length;
    int[] result = new int[n - k + 1];
    Deque<Integer> dq = new ArrayDeque<>();  // stores indices

    for (int i = 0; i < n; i++) {
        // Remove elements outside the window
        while (!dq.isEmpty() && dq.peekFirst() < i - k + 1)
            dq.pollFirst();
        // Remove smaller elements (they'll never be the max)
        while (!dq.isEmpty() && nums[dq.peekLast()] < nums[i])
            dq.pollLast();
        dq.offerLast(i);
        if (i >= k - 1)
            result[i - k + 1] = nums[dq.peekFirst()];
    }
    return result;
}
// O(n) time — each element added/removed from deque at most once
```

> 🌍 **Real-World:** The monotonic deque pattern is used in Airbnb's pricing engine to compute rolling-window maximum demand signals over time-series booking data — finding peak demand in any N-day window across millions of listings in O(N) rather than O(N²). It also underlies the sliding-window max used in Apache Flink's built-in `maxBy` operator for streaming analytics.

---

## Q13. Course Schedule II (LC 210) — Topological Sort

**Asked at:** Google, Meta, Amazon, Airbnb

> **💡 Pattern Recognition:** Any "ordering with dependencies" problem maps to **topological sort**. If the output size is less than the number of nodes, a cycle was detected — meaning the ordering is impossible.

```java
// Kahn's algorithm (BFS-based topological sort)
public int[] findOrder(int numCourses, int[][] prerequisites) {
    int[] inDegree = new int[numCourses];
    List<List<Integer>> graph = new ArrayList<>();
    for (int i = 0; i < numCourses; i++) graph.add(new ArrayList<>());

    for (int[] pre : prerequisites) {
        graph.get(pre[1]).add(pre[0]);
        inDegree[pre[0]]++;
    }

    Queue<Integer> q = new LinkedList<>();
    for (int i = 0; i < numCourses; i++)
        if (inDegree[i] == 0) q.offer(i);

    int[] order = new int[numCourses];
    int idx = 0;
    while (!q.isEmpty()) {
        int course = q.poll();
        order[idx++] = course;
        for (int next : graph.get(course)) {
            if (--inDegree[next] == 0) q.offer(next);
        }
    }
    return idx == numCourses ? order : new int[]{};  // empty if cycle
}
// O(V + E). If output size < numCourses → cycle detected
```

> 🌍 **Real-World:** Apache Maven and Gradle both use Kahn's topological sort to determine build order for multi-module Java projects — if a circular dependency is introduced between modules, the build fails immediately with "cycle detected," which is exactly the `output.length < numCourses` check above. Google's Bazel build system extends this to a distributed DAG scheduler that runs millions of build steps per day across their monorepo.

---

## Q14. Number of Islands (LC 200) + Variations

**Asked at:** Amazon, Google, Bloomberg, Uber

> **💡 Pattern Recognition:** **Flood fill** — DFS/BFS from each unvisited land cell, marking the entire connected component as visited. Count the number of times you trigger the flood fill = number of islands.

```java
// DFS: flood fill
public int numIslands(char[][] grid) {
    int count = 0;
    for (int i = 0; i < grid.length; i++) {
        for (int j = 0; j < grid[0].length; j++) {
            if (grid[i][j] == '1') {
                dfs(grid, i, j);
                count++;
            }
        }
    }
    return count;
}

private void dfs(char[][] grid, int i, int j) {
    if (i < 0 || i >= grid.length || j < 0 || j >= grid[0].length || grid[i][j] != '1') return;
    grid[i][j] = '0';  // mark visited
    dfs(grid, i+1, j); dfs(grid, i-1, j);
    dfs(grid, i, j+1); dfs(grid, i, j-1);
}
// O(M*N) time. BFS variant: use queue, same complexity, better for huge grids (no stack overflow)
```

**Variation: Max Island Area (LC 695)**

```java
private int dfsArea(char[][] grid, int i, int j) {
    if (i < 0 || i >= grid.length || j < 0 || j >= grid[0].length || grid[i][j] != '1') return 0;
    grid[i][j] = '0';
    return 1 + dfsArea(grid, i+1, j) + dfsArea(grid, i-1, j)
             + dfsArea(grid, i, j+1) + dfsArea(grid, i, j-1);
}
```

> 🌍 **Real-World:** Amazon's warehouse robotics team uses flood-fill (BFS variant) to compute connected "navigable zones" on warehouse floor maps — each zone is essentially an island of passable floor tiles, and robots are assigned to zones to minimize cross-zone travel. Google Maps uses the same flood-fill approach to detect and label connected bodies of water (lakes, rivers) on satellite imagery before applying geographic labels.

---

## Q15. Minimum Window Substring (LC 76) — Hard

**Asked at:** Google, Meta, LinkedIn, Amazon

> **💡 Pattern Recognition:** **Sliding window with two frequency maps** — expand right until the window is valid (contains all required chars), then shrink left while it remains valid. Track the minimum valid window seen.

```java
public String minWindow(String s, String t) {
    Map<Character, Integer> need = new HashMap<>();
    for (char c : t.toCharArray()) need.merge(c, 1, Integer::sum);

    int left = 0, formed = 0, required = need.size();
    int[] ans = {-1, 0, 0};  // length, left, right
    Map<Character, Integer> window = new HashMap<>();

    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        window.merge(c, 1, Integer::sum);
        if (need.containsKey(c) && window.get(c).equals(need.get(c))) formed++;

        while (formed == required) {
            if (ans[0] == -1 || right - left + 1 < ans[0]) {
                ans[0] = right - left + 1; ans[1] = left; ans[2] = right;
            }
            char lc = s.charAt(left++);
            window.merge(lc, -1, Integer::sum);
            if (need.containsKey(lc) && window.get(lc) < need.get(lc)) formed--;
        }
    }
    return ans[0] == -1 ? "" : s.substring(ans[1], ans[2] + 1);
}
// O(S + T). Two maps, shrink left when all chars satisfied.
```

> 🌍 **Real-World:** LinkedIn's search relevance team uses a sliding window approach over token streams to find minimum-covering windows of query terms within document snippets — the exact same two-frequency-map technique — to generate the best matching excerpt to show under a search result. The pattern also powers substring-match highlighting in Elasticsearch's `highlight` API.

---

## Q16. Longest Palindromic Substring (LC 5)

**Asked at:** Amazon, Google, Meta

> **💡 Pattern Recognition:** **Expand around center** — for each character (and each gap between characters), expand outward while characters match. O(n²) with O(1) space. Mention Manacher's O(n) algorithm if pressed for optimal.

```java
// Expand around center: O(n^2) time, O(1) space
public String longestPalindrome(String s) {
    int start = 0, maxLen = 1;
    for (int i = 0; i < s.length(); i++) {
        int odd  = expand(s, i, i);       // odd length palindrome
        int even = expand(s, i, i + 1);   // even length palindrome
        int len = Math.max(odd, even);
        if (len > maxLen) {
            maxLen = len;
            start = i - (len - 1) / 2;
        }
    }
    return s.substring(start, start + maxLen);
}

private int expand(String s, int l, int r) {
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) { l--; r++; }
    return r - l - 1;
}
// Manacher's algorithm: O(n) — mention in interview if asked for optimal
```

> 🌍 **Real-World:** Manacher's O(n) palindrome algorithm is used in DNA sequence analysis tools (e.g., BioPython's palindrome finder for restriction enzyme sites) — DNA palindromes are biologically significant because they indicate restriction enzyme cut sites, and genomes can be gigabases long, making O(n) critical. The simpler expand-around-center approach (above) is what most bioinformatics tools use in practice for shorter sequences.

---

## Q17. Word Break II (LC 140) — Hard

**Asked at:** Google, Amazon, Uber, Airbnb

> **💡 Pattern Recognition:** **Memoized DFS** — recursion with a memo map keyed on the current start index. Without memoization, this is exponential; with it, each start position is computed once.

```java
// Memoized DFS: find all ways to break string into dictionary words
public List<String> wordBreak(String s, List<String> wordDict) {
    Set<String> dict = new HashSet<>(wordDict);
    Map<Integer, List<String>> memo = new HashMap<>();
    return dfs(s, 0, dict, memo);
}

private List<String> dfs(String s, int start, Set<String> dict, Map<Integer, List<String>> memo) {
    if (memo.containsKey(start)) return memo.get(start);
    List<String> result = new ArrayList<>();
    if (start == s.length()) { result.add(""); return result; }

    for (int end = start + 1; end <= s.length(); end++) {
        String word = s.substring(start, end);
        if (dict.contains(word)) {
            List<String> rest = dfs(s, end, dict, memo);
            for (String r : rest)
                result.add(word + (r.isEmpty() ? "" : " " + r));
        }
    }
    memo.put(start, result);
    return result;
}
```

> 🌍 **Real-World:** Google's spell-checker and query segmentation pipeline (which splits unsegmented CJK text like "谷歌搜索" into meaningful tokens) uses memoized DFS over a trie dictionary — equivalent to Word Break II. The memoization is essential because the same suffix position is reachable via thousands of different prefix splits in long search queries, making exponential backtracking without memo completely infeasible at query volume.

---

## Q18. Coin Change (LC 322) + Coin Change II (LC 518)

**Asked at:** Amazon, Google, Meta — classic DP

> **💡 Pattern Recognition:** Both are **unbounded knapsack** variants. The key difference: for "minimum coins" iterate amount in the outer loop; for "number of ways" iterate coins in the outer loop to avoid counting permutations as distinct combinations.

```java
// Minimum coins to make amount
public int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) {
        for (int coin : coins) {
            if (coin <= i) dp[i] = Math.min(dp[i], dp[i - coin] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}

// Number of ways to make amount (unbounded knapsack)
public int change(int amount, int[] coins) {
    int[] dp = new int[amount + 1];
    dp[0] = 1;
    for (int coin : coins) {           // order: coin outer, amount inner
        for (int i = coin; i <= amount; i++) {  // avoids counting permutations
            dp[i] += dp[i - coin];
        }
    }
    return dp[amount];
}
// Key insight: coin outer loop prevents counting (1,2) and (2,1) as different
```

> 🌍 **Real-World:** Stripe's payment processing system uses the Coin Change (minimum coins) DP internally when optimizing ACH batch settlement — minimizing the number of fund transfer batches needed to cover a set of payouts given available liquidity buckets. Visa's interchange fee calculation engine uses a variant of Coin Change II to count the number of valid fee-tier combinations that sum to a target transaction amount for regulatory reporting.

---

## Q19. Merge Intervals (LC 56) + Meeting Rooms II (LC 253)

**Asked at:** Google, Amazon, Meta, LinkedIn — always asked

> **💡 Pattern Recognition:** Sort by start time first. For **merge**: maintain a running current interval and extend it. For **min rooms**: use a min-heap of end times — if the earliest end time is before the next start, reuse that room.

```java
// Merge overlapping intervals
public int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> a[0] - b[0]);
    List<int[]> res = new ArrayList<>();
    int[] cur = intervals[0];
    for (int[] interval : intervals) {
        if (interval[0] <= cur[1]) cur[1] = Math.max(cur[1], interval[1]);
        else { res.add(cur); cur = interval; }
    }
    res.add(cur);
    return res.toArray(new int[0][]);
}

// Minimum meeting rooms needed (LC 253)
public int minMeetingRooms(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> a[0] - b[0]);
    PriorityQueue<Integer> endTimes = new PriorityQueue<>();  // min-heap of end times
    for (int[] interval : intervals) {
        if (!endTimes.isEmpty() && endTimes.peek() <= interval[0])
            endTimes.poll();  // reuse room (previous meeting ended)
        endTimes.offer(interval[1]);
    }
    return endTimes.size();  // rooms in use = heap size
}
```

> 🌍 **Real-World:** Google Calendar's "Find a time" feature uses Meeting Rooms II's min-heap algorithm to determine the minimum number of conference rooms needed across an organization for a proposed meeting time. Microsoft Outlook's room finder does the same — scanning all active bookings and finding the minimum free slot — which is exactly "minimum rooms needed for all overlapping intervals."

---

## Q20. Longest Increasing Subsequence (LC 300) — DP + Binary Search

**Asked at:** Google, Amazon, Uber, Microsoft

> **💡 Pattern Recognition:** **Patience sorting** — maintain a `tails` array where `tails[i]` is the smallest tail element of all increasing subsequences of length `i+1`. Binary search to find the insertion position for each element. O(n log n).

```java
// O(n log n) with patience sorting
public int lengthOfLIS(int[] nums) {
    List<Integer> tails = new ArrayList<>();
    for (int num : nums) {
        int pos = Collections.binarySearch(tails, num);
        if (pos < 0) pos = -(pos + 1);  // insertion point
        if (pos == tails.size()) tails.add(num);
        else tails.set(pos, num);
    }
    return tails.size();
}
// tails[i] = smallest tail of all LIS of length i+1
// Binary search to find where current num fits
// Does NOT store actual LIS — only its length
```

> 🌍 **Real-World:** The O(n log n) LIS algorithm (patience sorting) is foundational to the Myers diff algorithm used by Git — `git diff` computes the longest common subsequence of file lines, which reduces to LIS on a transformed sequence. Every `git diff` and `git merge` you run uses this exact patience-sort approach, making it one of the most quietly ubiquitous algorithms in software engineering.

---

## SECTION 4: OS, NETWORKING & CONCURRENCY (TRICKY QUESTIONS)

---

## Q21. What happens when you type "google.com" in a browser?

**Asked at:** Google, Amazon, Meta, Cloudflare, Stripe

### Answer (Complete Chain)

```text
1. DNS Resolution
   Browser cache → OS cache → /etc/hosts → Recursive DNS resolver (ISP)
   → Root nameserver → TLD (.com) nameserver → Google's authoritative NS
   → Returns IP: 142.250.x.x
   Time: 1-100ms (cached: <1ms)

2. TCP Connection
   Three-way handshake: SYN → SYN-ACK → ACK
   For HTTPS: TLS handshake ON TOP of TCP (1-2 more RTTs, or 0-RTT with TLS 1.3)

3. HTTP Request
   GET / HTTP/1.1 Host: google.com
   Headers: Accept, User-Agent, Cookies (session), Cache-Control

4. Server-side (Google's path)
   Request hits Google's edge PoP (Anycast routing → nearest DC)
   Load balancer → Google Front End (GFE) → backend service
   Search query processed → response generated

5. HTTP Response
   200 OK, Content-Type: text/html, gzip compressed HTML

6. Browser rendering
   Parse HTML → build DOM
   Parse CSS → build CSSOM
   Combine → Render tree
   Layout → Paint → Composite layers → Display

7. Sub-resources
   For each <img>, <script>, <link>: new connection (or reuse HTTP/2 multiplexed)
   HTTP/2: single connection, multiple streams in parallel
```

> 🌍 **Real-World:** Cloudflare's authoritative DNS (1.1.1.1) handles 1 trillion DNS queries per day — the DNS resolution step alone can take 1-100ms uncached, which is why Cloudflare's resolver caches aggressively and returns results in under 11ms median globally. Google's front-end infrastructure uses Anycast routing so that "google.com" always resolves to an IP address that routes to the nearest of their 200+ edge PoPs, shaving 30-50ms off time-to-first-byte for most users worldwide.

---

## Q22. Explain TCP vs UDP. When would you choose UDP?

**Asked at:** Google, Cloudflare, Amazon, Gaming companies, FAANG networking rounds

### Answer

| Feature | **TCP** | **UDP** |
|---------|---------|---------|
| Connection | Handshake required | Connectionless |
| Reliability | Retransmits lost packets | No retransmit |
| Ordering | Guaranteed | Not guaranteed |
| Flow control | Sliding window | None |
| Congestion control | AIMD backoff | None |
| Overhead | Headers + ACKs | Minimal |
| Latency | Higher | Lower |

**Use UDP when:**

```text
1. Speed > reliability (video streaming, voice calls, gaming)
   Stale video frame is worthless, better to skip than retransmit
2. Application-level reliability (QUIC: UDP + reliability in userspace)
   Google's HTTP/3 uses QUIC: UDP-based, no HOL blocking vs TCP
3. Broadcast/multicast (one sender, many receivers — TCP is unicast only)
4. DNS: short query/response, retry at app level if lost
5. Real-time gaming: 60 frames/sec, 1 lost packet → skip that frame

QUIC (UDP + features):
  Built on UDP, adds: connection IDs (survive IP change), 0-RTT reconnect,
  independent streams (no head-of-line blocking), built-in TLS 1.3
  HTTP/3 uses QUIC — now ~35% of global web traffic
```

> 🌍 **Real-World:** Google designed QUIC (originally "Quick UDP Internet Connections") and deployed it for YouTube and Google Search in 2013 — by 2020, ~35% of global internet traffic ran over QUIC/HTTP/3. Discord switched their real-time voice/video from TCP to UDP (with their own reliability layer) and reported a 40% reduction in packet loss impact for users on congested home networks, because stale audio frames are simply skipped rather than causing TCP head-of-line blocking.

---

## Q23. Explain Deadlock. How do you detect and prevent it?

**Asked at:** Google, Amazon, Microsoft, Oracle

### Answer

**Deadlock:** circular wait where each thread holds a resource another needs.

**Four conditions (ALL must hold for deadlock):**

```text
1. Mutual exclusion: resource can only be held by one thread
2. Hold and wait: thread holds resource while waiting for another
3. No preemption: resource can't be forcibly taken away
4. Circular wait: T1 waits for T2, T2 waits for T3, T3 waits for T1
```

**Prevention (break one condition):**

```text
Break circular wait: always acquire locks in the same global order
    Example: always lock account_A before account_B (lower ID first)
Break hold-and-wait: acquire all locks atomically or release all and retry
Allow preemption: if can't acquire, release held locks and retry
```

**Detection:**

```text
Resource allocation graph: detect cycle → deadlock exists
Database approach: periodic deadlock detector (InnoDB does this every 1 second)
→ Victim selection: kill the transaction that has done the least work
```

> **⚠️ Scale Challenge:** In production deadlocks surface as hung transactions and timeouts rather than obvious errors. Use `jstack` for JVM thread dumps or `ThreadMXBean.findDeadlockedThreads()` to detect them programmatically.

**Java deadlock example:**

```java
// Thread 1: synchronized(A) { synchronized(B) { ... } }
// Thread 2: synchronized(B) { synchronized(A) { ... } }
// → Thread 1 holds A, waits for B; Thread 2 holds B, waits for A

// Fix: both threads always lock A then B (consistent ordering)

// Detection in production:
// jstack → look for "waiting to lock" cycles in thread dump
// Java: ThreadMXBean.findDeadlockedThreads()
```

> 🌍 **Real-World:** MySQL InnoDB's deadlock detector runs every second and resolves deadlocks by killing the transaction that has modified the fewest rows (least work done). Amazon's DynamoDB avoids deadlocks entirely by using optimistic locking with version numbers — no pessimistic locks are ever held, so circular-wait is structurally impossible. The "always acquire locks in the same order" prevention strategy is enforced in the Linux kernel by `lockdep`, a runtime lock validator that detects potential lock-order inversions before they cause production deadlocks.

---

## Q24. What is a race condition? How do you prevent it in Go?

**Asked at:** Google, Uber, Cloudflare (Go shops)

### Answer

```go
// Race condition: two goroutines access shared state concurrently

// BAD: race condition
var counter int
for i := 0; i < 1000; i++ {
    go func() { counter++ }()  // read-increment-write is not atomic
}
// counter could be anywhere from 1 to 1000

// Fix 1: Mutex
var mu sync.Mutex
var counter int
for i := 0; i < 1000; i++ {
    go func() {
        mu.Lock()
        counter++
        mu.Unlock()
    }()
}

// Fix 2: atomic operation (faster, no lock overhead)
var counter int64
for i := 0; i < 1000; i++ {
    go func() { atomic.AddInt64(&counter, 1) }()
}

// Fix 3: channel (idiomatic Go — communicate, don't share)
ch := make(chan struct{}, 1000)
var counter int
for i := 0; i < 1000; i++ {
    go func() { ch <- struct{}{} }()
}
for i := 0; i < 1000; i++ {
    <-ch
    counter++  // single goroutine owns counter — no race
}

// Detect with race detector:
// go test -race ./...
// go run -race main.go
// Reports: "DATA RACE: concurrent read and write to counter"
```

> 🌍 **Real-World:** Uber's Go codebase (one of the largest in the world) runs `go test -race` on every CI build across 5,000+ microservices. Their engineering blog describes catching a race condition in their dispatch system where two goroutines concurrently read-modified-wrote the same driver assignment map, causing phantom double-assignments. After switching to `sync/atomic` for hot-path counters and channels for ownership transfer, the data race was eliminated with zero mutex overhead.

---

## Q25. Explain context.Context in Go. Why is it important?

**Asked at:** Uber, Google, Cloudflare, Stripe (all Go shops)

### Answer

> **💡 Key Design Decision:** `context.Context` is the Go mechanism for **cancellation propagation** — when a parent context is cancelled (client disconnect, timeout, explicit cancel), all child contexts and their associated goroutines are cancelled automatically. Without it, goroutines continue doing work for clients that no longer exist.

```go
// Context carries: cancellation signal, deadline, request-scoped values
// Rule: Context is the FIRST parameter of every function that does I/O

// Why: without context, goroutines may run forever after client disconnects
func handleRequest(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()  // carries cancellation when client disconnects
    
    result, err := db.QueryContext(ctx, "SELECT ...")  // query cancelled if ctx done
    if err != nil {
        if ctx.Err() == context.Canceled { return }  // client left, stop work
        http.Error(w, err.Error(), 500)
        return
    }
}

// Timeout: cancel after 5 seconds
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()  // ALWAYS defer cancel to avoid goroutine leak

resp, err := http.Get("https://api.example.com")  // respects context? No — use NewRequestWithContext

req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
resp, err := client.Do(req)  // cancelled after 5s

// Cancellation propagates down the call tree:
// Parent ctx cancelled → all child ctxs cancelled automatically

// Values in context (use sparingly, only for request-scoped data):
ctx = context.WithValue(ctx, "requestID", "abc-123")
requestID := ctx.Value("requestID").(string)
// Don't store config, DB connections, etc. in context — use function args
```

> 🌍 **Real-World:** Cloudflare's Go-based DNS resolver (handling 1T+ queries/day) propagates `context.WithTimeout` through every DNS lookup chain — if a downstream authoritative nameserver doesn't respond within 2 seconds, the entire subtree of goroutines is cancelled automatically. Without context propagation, a single slow upstream would leak goroutines at 300K/sec query rate, exhausting memory within minutes. Google's internal Go style guide mandates `context.Context` as the first parameter of every function that performs I/O — the same rule enforced here.

---

## SECTION 5: LANGUAGE-SPECIFIC TRAPS

---

## Q26. Java: What is the difference between HashMap and ConcurrentHashMap?

**Asked at:** Amazon, Google, Oracle

```text
HashMap:
  Not thread-safe. Race conditions on concurrent reads+writes.
  Java 8: linked list → red-black tree for buckets with >8 entries (O(log n) worst case)

Hashtable:
  Thread-safe (every method synchronized). But one lock = bottleneck under contention.

ConcurrentHashMap:
  Thread-safe AND performant.
  Java 8 approach: lock only the bucket being modified (CAS + synchronized per bucket)
  Reads: mostly lock-free (volatile reads)
  Writes: fine-grained locking (one lock per bucket, not entire map)
  
  Atomics: putIfAbsent, computeIfAbsent are atomic
  
  compute() vs synchronized block:
    map.compute(key, (k, v) -> v == null ? 1 : v + 1);  // atomic
    // vs:
    synchronized(map) { map.put(key, map.getOrDefault(key, 0) + 1); }  // coarser

When to use what:
  Single-threaded code → HashMap (fastest)
  Multi-threaded, high concurrency → ConcurrentHashMap
  Need atomic check-and-update → ConcurrentHashMap.compute()
  Small map, rare writes → Collections.synchronizedMap() (simpler, full sync)
```

> 🌍 **Real-World:** Amazon's DynamoDB SDK for Java uses `ConcurrentHashMap` with `computeIfAbsent` to maintain per-table client state (endpoint routing, throttle counters) without any global locking bottleneck — a `synchronized` HashMap here would serialize all DynamoDB calls from a single JVM. Netflix's Hystrix circuit breaker library internally uses `ConcurrentHashMap` to track per-command health metrics across hundreds of concurrent threads with no synchronization penalty on the hot read path.

---

## Q27. Go: Explain goroutine leak. How do you find and fix it?

**Asked at:** Uber, Google, Cloudflare, DoorDash

> **⚠️ Scale Challenge:** Goroutine leaks are silent — the process keeps running but memory grows unboundedly. At 10K requests/sec with a leak of one goroutine per request, you accumulate 10K goroutines/second until OOM. Monitor `runtime.NumGoroutine()` in production.

```go
// Leak: goroutine starts, blocks forever, never exits

// LEAK: goroutine blocks on channel with no sender
func leaky() {
    ch := make(chan int)
    go func() {
        result := <-ch  // blocks forever if nobody sends
        process(result)
    }()
    // function returns without ever sending to ch
    // goroutine lives until process dies
}

// FIX 1: always use context for blocking ops
func fixed(ctx context.Context) {
    ch := make(chan int, 1)
    go func() {
        select {
        case result := <-ch:
            process(result)
        case <-ctx.Done():
            return  // exit cleanly when cancelled
        }
    }()
}

// FIX 2: buffered channel (if goroutine must complete anyway)
func fixed2() {
    ch := make(chan int, 1)  // buffer: sender never blocks
    go func() { ch <- compute() }()
    // even if nobody reads ch, goroutine exits after send
}

// Detection:
// 1. Monitor runtime.NumGoroutine() — growing over time → leak
// 2. pprof goroutine dump: go tool pprof http://localhost:6060/debug/pprof/goroutine
//    Look for thousands of goroutines in same state/stacktrace
// 3. goleak library in tests: goleak.VerifyNone(t) — fails if goroutines left behind
```

> 🌍 **Real-World:** Uber Engineering published a postmortem where a goroutine leak in their maps service caused memory to grow from 500MB to 4GB over 6 hours in production, eventually causing OOM kills. The leak: a goroutine was started per incoming request to fetch routing data from a downstream service, but the downstream was occasionally slow — the goroutine blocked on a channel receive with no timeout. After adding `context.WithTimeout` to all blocking channel operations and adopting `goleak.VerifyNone(t)` in tests, goroutine count became stable and the OOM incidents stopped.

---

## QUICK-FIRE ROUND 2

```text
Q: What is the difference between mutex and semaphore?
A: Mutex: binary lock, only the thread that locked can unlock. Ownership concept.
   Semaphore: counter, any thread can signal. Use for counting resources (pool of N connections).
   Mutex = semaphore with count 1, but with ownership enforced.

Q: Explain optimistic vs pessimistic concurrency.
A: Pessimistic: lock before read, hold till done. Safe but slow (blocking).
   Optimistic: read freely, on write check if data changed (version check).
   If changed → retry. Best for: low contention. Bad for: high contention (many retries).

Q: What is a connection pool? Why is it needed?
A: Creating a DB connection is expensive (~100ms, TCP + auth).
   Pool: maintain N pre-created connections, reuse them.
   On request: borrow connection, return after query.
   Sizing: too small → requests queue. Too large → DB overwhelmed.
   Rule of thumb: pool_size = (DB CPU cores * 2) + effective_spindle_count.

Q: HTTP/1.1 vs HTTP/2 vs HTTP/3 — key differences?
A: HTTP/1.1: one request per TCP connection (use multiple connections for parallelism).
   HTTP/2: multiplexing — many requests on one TCP connection. Header compression (HPACK).
           But: TCP head-of-line blocking (one lost packet stalls all streams).
   HTTP/3: QUIC (UDP). Per-stream reliability. 0-RTT reconnect. No HOL blocking.
           Used by: YouTube, Google Search, Cloudflare, Meta.

Q: What is a circuit breaker pattern?
A: Wrapper around remote calls. States: Closed → Open → Half-Open.
   Closed: requests pass through normally. Track failure rate.
   Open: failure rate exceeded threshold → stop calling downstream, return error immediately.
         Opens for N seconds (timeout). Prevents cascade failure.
   Half-Open: let one request through → success → Closed; failure → Open again.
   Libraries: Resilience4j (Java), gobreaker (Go), Polly (.NET).

Q: What is back pressure in streaming systems?
A: Producer sends faster than consumer can process → queue grows → OOM.
   Back pressure: consumer signals producer to slow down.
   Kafka: consumers pull (they control rate, natural back pressure).
   gRPC streaming: flow control built in.
   Reactive Streams: built-in back pressure protocol.
   Without back pressure: buffer fills → drop messages or crash.

Q: Explain the difference between synchronous and asynchronous communication between services.
A: Synchronous: caller waits for response (HTTP REST, gRPC).
   Pros: simple, immediate error feedback.
   Cons: tight coupling, cascade failures, higher latency chain.
   
   Asynchronous: caller sends event, continues (Kafka, SQS, RabbitMQ).
   Pros: decoupled, independent scaling, buffer for traffic spikes.
   Cons: eventual consistency, harder to debug, need idempotency.
   
   Rule: use sync for queries (need answer now), async for commands (fire and forget or deferred).

Q: What is a Bloom filter? Where would you use it?
A: Probabilistic data structure. Tests "is element in set?"
   False positive possible (says YES when element not in set).
   False negative never (says NO only when definitely not in set).
   Memory: ~10 bits per element for 1% false positive rate.
   
   Use cases:
   - Cache: check Bloom filter before DB query (avoid DB hit for definitely-missing keys)
   - Duplicate URL detection in web crawler
   - Spam email filtering (is this email in spam list?)
   - Username availability check (is this username taken?)
   - Cassandra: each SSTable has Bloom filter (avoid reading SSTables that don't have the key)
```

---

## SDE-3 PATTERNS CHEAT SHEET

| Problem Pattern | Data Structure / Algorithm |
|-----------------|---------------------------|
| Top-K elements | Min-heap of size K |
| Nearest in stream | Sorted set / Two heaps |
| Sliding window | Deque (monotonic) / HashMap |
| Graph shortest path | BFS (unweighted) / Dijkstra (weighted) |
| Scheduling / ordering | Topological sort (Kahn's BFS) |
| Search in 2D grid | BFS (shortest) / DFS (all paths) |
| String matching | KMP / Sliding window with HashMap |
| Interval merge | Sort by start, check overlap |
| Interval min rooms | Min-heap of end times |
| Subarray sum = K | Prefix sum + HashMap |
| Counting distinct | HyperLogLog (approximate) / HashMap (exact) |
| Frequency top-K | HashMap + bucket sort or heap |
| Palindrome | Expand center / DP / Manacher's |
| LCS / Edit distance | 2D DP |
| Coin change / ways | 1D DP (unbounded knapsack) |
| Tree path problems | DFS with return value, track max globally |
| Binary search | Define search space + invariant clearly |

---

## ⭐ IMPORTANT CONCEPTS — Using These Question Banks

> ⭐ **IMPORTANT CONCEPT:** SDE3/Staff rounds probe **depth on your design choices** and **production judgment** more than trivia recall.

## 🛠️ PRACTICAL Drill
1. Pick 5 questions. Answer aloud in 3 minutes each.  
2. For each, force: constraints → options → recommendation → failure mode.  
3. Mark any answer without a tradeoff as fail; rewrite.

