# Redis — Complete Study Notes

> Self-contained. No internet needed.
> Covers: Data Types → Internals → Persistence → Replication → Cluster → Production Patterns

---

## TABLE OF CONTENTS

| Part | Topic | Key Concepts |
|------|-------|--------------|
| [1](#part-1--what-redis-is) | What Redis Is | Mental model, use cases, single-thread model |
| [2](#part-2--data-types) | Data Types | String, List, Hash, Set, ZSet, Bitmap, HLL, Stream, Geo |
| [3](#part-3--internal-data-structures) | Internal Data Structures | SDS, ZipList, SkipList, Dict, QuickList |
| [4](#part-4--event-loop-internals) | Event Loop | ae.c, RESP protocol, I/O threading |
| [5](#part-5--persistence) | Persistence | RDB, AOF, Hybrid — tradeoffs |
| [6](#part-6--replication) | Replication | Master-replica, partial resync, WAIT command |
| [7](#part-7--redis-sentinel) | Sentinel | HA without cluster, failover, quorum |
| [8](#part-8--cluster-mode) | Cluster | Hash slots, MOVED/ASK, gossip |
| [9](#part-9--production-problems) | Production Problems | Hot key, cache avalanche, penetration, Redlock |
| [10](#part-10--eviction-policies) | Eviction Policies | LRU, LFU, TTL-based, volatile-* |
| [11](#part-11--performance-patterns) | Advanced Patterns | Pipelining, MULTI/EXEC, Lua, Pub/Sub |
| [12](#part-12--advanced-production-patterns) | Advanced Production Patterns | Distributed lock, rate limiter, session store |
| [13](#part-13--quick-reference) | Quick Reference | Memory, latency, expiry, keyspace |
| [14](#part-14--senior-level-tradeoffs-and-design-decisions) | Senior-Level Tradeoffs | Single thread, 16384 slots, no B-Tree |
| [NEW](#hzset-pattern--hash--zset-combined-leaderboard-with-metadata) | **HZSET Pattern** | **Hash + ZSet combined for leaderboard + metadata** |
| [NEW](#redis-function--fcall-redis-70) | **Redis FUNCTION** | **Redis 7.x named functions vs EVAL** |
| [NEW](#redis-streams--consumer-groups-deep-dive) | **Streams (Deep Dive)** | **Consumer groups, XREADGROUP, XCLAIM** |
| [NEW](#redis-client-side-caching-resp3-tracking) | **Client-Side Caching** | **RESP3 tracking, invalidation notifications** |

---

## PART 1 — WHAT REDIS IS

> ⭐ **IMPORTANT CONCEPT:** Command execution is single-threaded — design for O(1)/O(log n) commands; avoid hot keys and big KEYS scans.

### 1.1 Mental Model

**Redis** (Remote Dictionary Server) is an **in-memory data structure store** that also supports optional persistence. Think of it as a dictionary (hash map) that lives entirely in RAM, exposed over a TCP socket, with a rich set of value types beyond plain strings.

The key mental shifts from a relational DB:
- **Everything is a key-value pair.** The key is always a string. The value can be one of ~10 data types.
- **No schema, no joins, no secondary indexes by default.** You model data around access patterns.
- **All commands are atomic.** Because the event loop is single-threaded, no two commands run concurrently.
- **Speed comes from RAM + simple data structures**, not from clever query planning.

> 🌍 **Real-World:** Twitter uses Redis as the primary store for its home timeline — when you load your feed, it's served from a Redis list of tweet IDs, not from a database query. Each user's timeline is a Redis list capped at ~800 entries. This delivers sub-millisecond feed loads to 400+ million users because the entire read path is in-memory with zero disk I/O.

### 1.2 Why Single-Threaded Is Fast

This is a classic interview trap. People assume multi-threaded = faster. For Redis, single-threaded is faster for these reasons:

1. **No lock contention.** Every mutex acquisition in a multi-threaded system costs hundreds of nanoseconds. Redis never acquires a lock for command execution — there's nothing to lock.
2. **L1/L2 cache friendly.** All data structures are in RAM, accessed by the same CPU core repeatedly. Cache lines stay hot.
3. **The bottleneck is the network, not the CPU.** A GET command takes ~100ns of CPU. A network round-trip takes ~100µs. The CPU is idle 99.9% of the time waiting for the next byte to arrive.
4. **I/O multiplexing.** epoll (Linux) / kqueue (macOS) lets one thread handle thousands of client connections efficiently, blocking only until any socket has data.

Redis can do 100,000+ ops/sec on a single core. Adding more cores won't help if the network is the bottleneck.

> **💡 Key Insight:** **Redis 6.0** added I/O threading. Multiple threads handle network read/write (parsing the incoming bytes, writing the reply bytes). But **command execution remains single-threaded**. This is important: the multi-threading in Redis 6+ is purely for I/O, not for parallel command execution. This distinction matters at production scale — a 40-core machine won't give you 40x Redis throughput; you'll get maybe 2-3x from I/O threads.

> 🌍 **Real-World:** Stack Overflow runs their entire Q&A platform on just two Redis nodes (primary + replica). At 150 million monthly visitors, Redis handles millions of ops/second on a single thread — serving page view counts, session data, and hot question caches. Their engineering blog notes they've never needed to shard Redis because the single-threaded model with I/O threading handles their entire load on modest hardware.

---

## PART 2 — DATA TYPES

### 2.1 String

**What it is:** The simplest type. Value is a binary-safe byte sequence (not necessarily UTF-8 text). Max 512MB.

**Internally:** For small integers (0-9999), Redis uses a **shared object pool** — all clients share the same object, no allocation. For small strings (<= 44 bytes), Redis uses an **embstr SDS** (single allocation for both the redisObject header and the SDS header). For larger strings, it uses a **raw SDS** (two separate allocations).

#### String Commands

```redis
SET key value [EX seconds] [PX milliseconds] [NX|XX] [GET]
GET key
INCR key           -- atomic increment, no race condition possible
INCRBY key delta
GETSET key newval  -- deprecated, use SET ... GET
SETNX key value    -- set if not exists (used for distributed locks)
MSET k1 v1 k2 v2  -- multi-set, atomic
GETDEL key         -- get and delete atomically (Redis 6.2+)
```

**Use cases:**
- Session tokens (`SET session:abc123 "{user_id:1}" EX 3600`)
- Counters (`INCR page:views:homepage`)
- Distributed lock (`SET lock:resource uuid NX EX 30`)
- Rate limiting simple counters
- Caching serialized objects (JSON/protobuf)

**Edge cases:**
- INCR only works if value is a decimal integer string. `"3.14"` → error. `"3abc"` → error.
- `SET` with `EX` and `NX` is atomic — safe for distributed locks. Old pattern of `SETNX` then `EXPIRE` is **NOT atomic** — there was a window where the key existed without TTL.
- 512MB limit per value means you can't store a large file in a string without hitting issues. Chunk it.

> 🌍 **Real-World:** Instagram uses Redis strings for its media ID counter — every new photo or video gets its ID from `INCR media:id:counter`. The atomic increment guarantees no two photos ever get the same ID even with thousands of concurrent uploads. At Instagram's scale (100M+ photos per day), this single Redis INCR command is called millions of times per day with zero collision risk.

> 🌍 **Real-World:** GitHub uses Redis strings with `SET ... NX EX` for distributed locking to prevent concurrent git push processing. When two users push to the same repository simultaneously, the first push acquires `SET lock:repo:12345 worker-uuid NX EX 30` and the second gets nil — it either waits and retries or queues behind the lock, preventing repository corruption from concurrent writes.

---

### 2.2 List

**What it is:** Ordered sequence of strings. Insertion order preserved. Can push/pop from both ends.

**Internally:** Uses **QuickList** (covered in detail in Part 3). Internally a doubly-linked list of compressed nodes (ListPacks).

#### List Commands

```redis
LPUSH key val1 val2   -- push to left (head). Returns new length.
RPUSH key val1 val2   -- push to right (tail)
LPOP key [count]      -- pop from left
RPOP key [count]      -- pop from right
LRANGE key 0 -1       -- get all elements (0-indexed, -1 = last)
LLEN key              -- length
BLPOP key1 key2 timeout  -- blocking pop, waits up to timeout seconds
LINSERT key BEFORE|AFTER pivot value
LPOS key element      -- find position (Redis 6.0.6+)
```

**Use cases:**
- Message queue (`RPUSH` to enqueue, `BLPOP` to dequeue — blocking consumer)
- Activity feed (`LPUSH` + `LTRIM` to keep last N items)
- Work queues (`BRPOPLPUSH` for reliable queue — atomically move from queue to processing list)

> **⚠️ Production Gotcha:** `LRANGE` is O(N). On a 10M element list, `LRANGE key 0 -1` will block the event loop. Use with care in production. `BLPOP` is blocking — the client blocks, but the server event loop continues serving other clients. The connection is marked as waiting. If multiple clients `BLPOP` the same key, they form a fair queue (FIFO). When a list has many elements and you `LRANGE` from the middle, Redis has to traverse the QuickList nodes linearly. Lists are not indexed by position.

> 🌍 **Real-World:** Pinterest uses Redis lists as the backbone of their "following" feed — when a user you follow pins something, the pin ID is `LPUSH`-ed onto your feed list. The list is capped at 1000 entries with `LTRIM` after each push. When you open Pinterest, `LRANGE feed:user:12345 0 49` fetches the 50 most recent pin IDs in O(50) time. At 400M+ monthly users, this pattern serves personalized feeds in under 1ms.

> 🌍 **Real-World:** Celery (Python task queue used by Instagram, Robinhood, and Mozilla) uses Redis lists as its default broker. Tasks are `RPUSH`-ed onto a list queue and worker processes `BLPOP` from it — blocking efficiently until a task arrives without polling. This allows thousands of workers to share a single Redis list with zero CPU waste during idle periods.

---

### 2.3 Hash

**What it is:** A map of field-value pairs stored under one key. Like a row in a relational table.

**Internally:** For small hashes (field count <= `hash-max-listpack-entries`, default 128; each value <= `hash-max-listpack-value`, default 64 bytes), Redis stores as a **ListPack** (compact, array-like). When it grows beyond those limits, it converts to a **Dict (hash table)**. This is important for memory optimization.

#### Hash Commands

```redis
HSET key field value [field value ...]  -- set one or more fields
HGET key field
HMGET key field1 field2  -- get multiple fields
HGETALL key              -- get all field-value pairs
HDEL key field [field ...]
HEXISTS key field
HLEN key
HINCRBY key field delta
HSCAN key cursor [MATCH pattern] [COUNT count]  -- safe iteration
```

**Use cases:**
- User profile (`HSET user:123 name "Alice" email "a@b.com" age 30`)
- Shopping cart (`HSET cart:user123 product:456 quantity`)
- Object caching (avoids deserializing entire JSON when only one field needed)
- Counters per entity (`HINCRBY stats:page:home views 1`)

> **⚠️ Production Gotcha:** `HGETALL` is O(N) on the number of fields. On a hash with 100,000 fields, this blocks the event loop. Use `HSCAN`. The threshold-based encoding switch is a one-way door per instance: once it converts from ListPack to Dict, it doesn't shrink back even if you delete fields.

> 🌍 **Real-World:** Uber uses Redis hashes to store driver state — `HSET driver:uuid lat 37.7749 lon -122.4194 status available last_seen 1704067200`. When a rider requests a trip, the matching system calls `HMGET driver:uuid lat lon status` to fetch only the needed fields rather than deserializing a full JSON blob. At Uber's scale (millions of active drivers), fetching 3 fields with HMGET instead of deserializing a 500-byte JSON object reduces CPU and network overhead significantly.

> 🌍 **Real-World:** Shopify uses Redis hashes for shopping cart storage — each cart is a hash where fields are product variant IDs and values are quantities. `HINCRBY cart:user123 variant:456 1` atomically increments quantity when a user clicks "Add to Cart". This avoids read-modify-write race conditions that would occur if the cart were stored as a serialized JSON string.

---

### 2.4 Set

**What it is:** Unordered collection of unique strings.

**Internally:** For small sets (count <= `set-max-intset-entries`, default 512; and all elements are integers), uses **intset** — a sorted array of integers. Very compact. For small non-integer sets, uses **ListPack** (Redis 7.2+). For large sets, uses **Dict**.

#### Set Commands

```redis
SADD key member [member ...]
SREM key member [member ...]
SISMEMBER key member            -- O(1) membership check
SMISMEMBER key m1 m2 m3         -- multi-membership check (Redis 6.2+)
SMEMBERS key                    -- returns ALL members — dangerous on large sets
SCARD key                       -- cardinality (count)
SINTER key1 key2                -- intersection
SUNION key1 key2                -- union
SDIFF key1 key2                 -- difference (in key1 but not key2)
SINTERSTORE dest key1 key2      -- store result in dest
SRANDMEMBER key [count]         -- random member(s)
SPOP key [count]                -- remove and return random member
SSCAN key cursor ...            -- safe iteration
```

**Use cases:**
- Tags on an article (`SADD article:123:tags "redis" "database" "cache"`)
- Friends list, followers
- Unique visitors per day (`SADD visitors:2024-01-01 user_id`)
- Set operations: mutual friends (`SINTER user:alice:friends user:bob:friends`)
- Lottery / random selection (`SRANDMEMBER`)

> **⚠️ Production Gotcha:** `SMEMBERS` is O(N). Never use on large sets. Use `SSCAN`. `SINTER` / `SDIFF` are O(N*M) in the worst case. Use carefully with large sets. **Intset → Dict conversion:** if you add even one non-integer member to an intset, it converts the entire structure to a hash table. Memory spikes if this happens accidentally.

> 🌍 **Real-World:** LinkedIn uses Redis sets for "People You May Know" — each user has a set of their connection IDs. `SINTER user:alice:connections user:bob:connections` computes mutual connections in a single Redis command. For users with 500+ connections, this replaces a database JOIN across millions of rows with an O(N) set intersection in memory, reducing mutual-connection lookup from ~50ms (DB) to ~0.5ms (Redis).

> 🌍 **Real-World:** Netflix uses Redis sets to track which users have watched which shows — `SADD watched:user:12345 show:stranger-things show:narcos`. `SISMEMBER watched:user:12345 show:stranger-things` determines in O(1) whether to show the "Continue Watching" badge vs. the fresh thumbnail. At Netflix's scale (230M+ subscribers), checking watch history via `SISMEMBER` on a Redis set is orders of magnitude faster than querying a distributed database for each content card rendered.

---

### 2.5 Sorted Set (ZSet)

**What it is:** Like a Set, but every member has an associated floating-point **score**. Members are unique; scores can repeat. The set is ordered by score (ascending).

**Internally:** Two structures working together:
1. A **Dict** mapping member → score (for O(1) score lookup by member)
2. A **SkipList** ordered by score (for O(log N) range queries)

For small sorted sets (count <= `zset-max-listpack-entries`, default 128; each member <= 64 bytes), uses a **ListPack**.

#### ZSet Commands

```redis
ZADD key [NX|XX] [GT|LT] [CH] score member [score member ...]
ZRANGE key min max [BYSCORE|BYLEX] [REV] [LIMIT offset count]  -- Redis 6.2+ unified
ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]
ZRANK key member     -- 0-indexed rank (ascending)
ZREVRANK key member  -- rank in descending order
ZSCORE key member    -- get score
ZCARD key
ZCOUNT key min max   -- count members with score in [min, max]
ZINCRBY key delta member
ZREM key member [member ...]
ZREMRANGEBYSCORE key min max
ZPOPMIN key [count]  -- remove and return lowest-score members
ZPOPMAX key [count]
BZPOPMIN key [key ...] timeout  -- blocking version
```

**Use cases:**
- Leaderboard (`ZADD leaderboard score user_id`, `ZREVRANGE leaderboard 0 9 WITHSCORES`)
- Rate limiter with sliding window (member = timestamp, score = timestamp)
- Priority queue (score = priority or timestamp)
- Time-series data with score = epoch timestamp
- Autocomplete: `ZADD` with score 0, members as prefixes, `ZRANGEBYLEX` for prefix search

**Edge cases:**
- Scores are IEEE 754 double (64-bit float). Large integers lose precision beyond 2^53. Use lexicographic sorting for exact integer ordering.
- `ZRANGEBYSCORE` with `-inf` and `+inf`: score `-inf` means negative infinity. `"(5"` means exclusive: > 5.
- `ZADD GT`: only update score if new score is greater. Used for "high score" leaderboards — don't let score go down.
- Thread safety for leaderboard updates: `ZINCRBY` is atomic. No need for WATCH/MULTI.

> 🌍 **Real-World:** Twitter uses Redis sorted sets for trending topics — each topic's score is the tweet count in the last hour, and `ZREVRANGE` gives the top-10 in O(log N). Every time a hashtag is tweeted, `ZINCRBY trending:hashtags 1 "#WorldCup"` atomically increments the score. When a hashtag goes viral (millions of tweets/minute), Redis handles the update storm without locking, while the SkipList's O(log N) structure keeps the top-10 read fast regardless of how many topics are tracked.

> 🌍 **Real-World:** Roblox uses Redis sorted sets for matchmaking — players are added with a skill score (`ZADD matchmaking 1500 player:uuid`). The matchmaking service calls `ZRANGEBYSCORE matchmaking (1450 1550` to find all players within ±50 ELO of the target skill level and groups them into a game. At peak, Roblox matches millions of concurrent players per day using this O(log N + K) range query pattern.

---

### 2.6 Bitmap

**What it is:** Not a separate data type — it's bit-level operations on a String value. Each bit in the byte array is addressable.

#### Bitmap Commands

```redis
SETBIT key offset value    -- set bit at offset to 0 or 1
GETBIT key offset          -- get bit at offset
BITCOUNT key [start end]   -- count set bits (byte range, not bit range)
BITOP AND|OR|XOR|NOT destkey key [key ...]
BITPOS key bit [start end] -- position of first 0 or 1
```

**Use cases:**
- User login tracking: key = `"logins:2024-01-01"`, offset = `user_id`. `SETBIT` to mark login. `BITCOUNT` to count daily active users.
- Feature flags per user (bit per feature per user)
- Bloom filter implementation (manual, though RedisBloom is better)

> **⚠️ Production Gotcha:** `SETBIT` on offset 1,000,000,000 (1 billion) allocates ~125MB of memory immediately (even if only one bit is set). Redis allocates the full byte array up to the highest offset. Plan your offset space carefully. `BITCOUNT` operates on **byte** offsets, not bit offsets. `BITCOUNT key 0 0` counts bits in the first byte only.

> 🌍 **Real-World:** Duolingo tracks daily active users using Redis bitmaps — `SETBIT dau:2024-01-15 user_id 1` when a user opens the app. `BITCOUNT dau:2024-01-15` returns the exact count of unique active users that day in O(N/8) time. For 50 million users, this bitmap is only 6.25MB and BITCOUNT completes in microseconds — far cheaper than a `SELECT COUNT(DISTINCT user_id)` database query. They also use `BITOP AND` across 7 days to find users active every day of the week (weekly streak tracking).

---

### 2.7 HyperLogLog

**What it is:** A **probabilistic data structure** for counting unique elements (cardinality estimation) using constant memory (~12KB regardless of input size), with a standard error of 0.81%.

**How it works (internally):**
1. Hash each input element with a 64-bit hash function.
2. Split the hash into two parts: the first p bits → bucket index (Redis uses p=14, so 2^14 = 16384 buckets). The remaining 64-p bits → count trailing zeros (or leading zeros, depending on implementation).
3. Each bucket stores the maximum number of leading zeros seen so far.
4. Cardinality estimate = HarmonicMean(2^max_zeros across all buckets) × correction factor.

The math: if you see k leading zeros, the probability is 1/2^k, so roughly 2^k unique values were hashed. Average across many buckets → stable estimate.

#### HyperLogLog Commands

```redis
PFADD key element [element ...]   -- add elements
PFCOUNT key [key ...]             -- estimate cardinality
PFMERGE destkey key [key ...]     -- merge multiple HLLs
```

**Use cases:**
- Count unique visitors per page per day (without storing all visitor IDs)
- Count unique search queries
- Approximate distinct count in analytics pipelines

**Edge cases:**
- 0.81% error. For 1,000,000 unique items → ±8,100 error. Fine for analytics, unacceptable for billing.
- `PFCOUNT` on multiple keys returns the union's cardinality (deduplicated). This is the main use case for HyperLogLog.
- Two HLLs can be merged with `PFMERGE` — useful for hierarchical rollups (per-page → per-site).

> 🌍 **Real-World:** Reddit uses HyperLogLog to display unique upvote counts and view counts on posts. Storing every voter's ID in a set for 100M+ daily votes would consume gigabytes; a HyperLogLog per post uses exactly 12KB regardless of vote count. The 0.81% error means a post showing "9,919 upvotes" might actually have 9,839–9,999 — imperceptible to users but saving terabytes of memory across Reddit's billions of posts.

> 🌍 **Real-World:** Cloudflare uses HyperLogLog in their analytics pipeline to count unique IPs hitting a domain per minute for their DDoS detection system. Each HLL takes 12KB; they maintain one per customer domain per time window. `PFMERGE` rolls up per-minute HLLs into hourly and daily unique visitor counts. Storing actual IP sets would require gigabytes per domain per day; the probabilistic approach uses kilobytes.

---

### 2.8 Stream

**What it is:** An append-only log data structure. Like Apache Kafka's log, but inside Redis. Each entry has an auto-generated ID (milliseconds-sequence format: `1234567890000-0`) and a set of field-value pairs.

#### Stream Commands

```redis
XADD key [MAXLEN [~] count] * field value [field value ...]
-- * = auto-generate ID
XREAD COUNT 10 STREAMS key 0    -- read from beginning
XREAD COUNT 10 BLOCK 0 STREAMS key $  -- blocking read from now
XRANGE key start end
XGROUP CREATE key groupname $ MKSTREAM  -- create consumer group
XREADGROUP GROUP grp consumer STREAMS key >   -- read undelivered
XACK key groupname id                         -- acknowledge
XPENDING key groupname - + count              -- see unacked messages
XCLAIM key grp consumer 0 id                  -- take over message
```

**Use cases:**
- Event sourcing
- Activity logs
- Sensor data ingestion
- Reliable queue with consumer groups (unlike Pub/Sub, messages are persisted and acknowledged)

#### Streams vs Pub/Sub

| Feature | Streams | Pub/Sub |
|---------|---------|---------|
| Persistence | Yes — messages stored on disk | No — fire and forget |
| Delivery guarantee | At-least-once with ACK | None |
| Consumer groups | Yes — multiple independent groups | No |
| Offline subscribers | Messages wait in stream | Messages lost |
| Replay | From any ID | Not possible |

> 🌍 **Real-World:** Snapchat uses Redis Streams for their activity feed pipeline — when a user sends a snap, an event is `XADD`-ed to a stream. Multiple consumer groups (notification service, analytics service, content moderation) read the same stream independently via `XREADGROUP`. If the moderation service goes down temporarily, messages pile up in the stream and are processed when it comes back online — unlike Pub/Sub where those events would be permanently lost.

---

### 2.9 Geospatial

**What it is:** Stores latitude/longitude pairs and allows radius queries. Internally implemented as a **Sorted Set** with the score being a **Geohash**-encoded integer.

#### Geo Commands

```redis
GEOADD key longitude latitude member
GEODIST key member1 member2 [m|km|mi|ft]
GEOPOS key member          -- get lat/lon
GEOSEARCH key FROMMEMBER member BYRADIUS 10 km ASC COUNT 10
GEOHASH key member
```

**How it works:** Geohash encodes (lat, lon) as a 52-bit integer by interleaving binary representations of latitude and longitude. This integer becomes the ZSet score. Nearby points have similar Geohash values, so a score range query approximates a radius query (with edge corrections for cells that span the boundary).

**Use cases:** Ride-sharing nearby drivers, nearby restaurants, geo-fencing.

> 🌍 **Real-World:** Grab (Southeast Asia's ride-hailing giant) uses Redis GEO commands for real-time driver location tracking. Every few seconds, each driver app calls `GEOADD drivers longitude latitude driver_id` to update position. When a rider requests a trip, `GEOSEARCH drivers FROMLONLAT lat lon BYRADIUS 5 km ASC COUNT 10` returns the 10 closest available drivers in a single command. For Grab's millions of concurrent drivers, storing positions in Redis GEO (backed by a ZSet) enables sub-millisecond nearest-driver lookups across an entire city.

---

## PART 3 — INTERNAL DATA STRUCTURES

### 3.1 SDS (Simple Dynamic String)

**Why not C strings?**
- C strings are null-terminated → can't store binary data with null bytes
- `strlen()` is O(N) — traverses to find null terminator
- No bounds checking → buffer overflow vulnerabilities

**SDS structure:**

```c
struct sdshdr64 {  // for strings > 1MB
    uint64_t len;    // used length
    uint64_t alloc;  // allocated capacity (excluding header + null terminator)
    unsigned char flags;  // 3 bits for type, 5 bits unused
    char buf[];      // the actual bytes + a null terminator at buf[len]
};

// There are 5 variants: sdshdr5, sdshdr8, sdshdr16, sdshdr32, sdshdr64
// Chosen based on string length to minimize header overhead
```

**Features:**
- O(1) `len` via the `len` field
- Binary-safe: `len` tracks actual length, null terminator is just a convenience for C library compatibility
- **Pre-allocation on append:** when string grows, Redis allocates more than needed to avoid repeated realloc:
  - If new length < 1MB: allocate 2× new length
  - If new length >= 1MB: allocate new length + 1MB
- **Lazy shrink:** `sdsMakeRoomFor` grows but never shrinks. `sdsRemoveFreeSpace` explicitly trims. This means strings that grow then shrink waste memory — tracked via `alloc - len`.

**Memory layout:**

```text
[sdshdr8 header: len=5, alloc=10, flags=1] [H][e][l][l][o][\0][...5 bytes free...]
                                            ^-- buf pointer points here
```

> **💡 Key Insight:** The SDS pointer returned to Redis code points to `buf`, not the header. To get the header, do `(void*)(ptr - sizeof(sdshdr8))`. This means SDS is compatible with C string functions (they just see `buf`).

> 🌍 **Real-World:** Redis's SDS design inspired Go's string builder and Rust's String type. The pre-allocation doubling strategy (2× growth until 1MB, then +1MB) is the same pattern used by Java's `StringBuilder`, Python's list, and C++'s `std::string`. Antirez (Redis author) has noted that SDS's binary-safety was crucial for Redis to store arbitrary binary data — Redis keys and values can be raw bytes, enabling use cases like storing Protobuf-encoded objects or image thumbnails as Redis string values.

---

### 3.2 ZipList (Legacy) and ListPack (Redis 7+)

#### ZipList

A contiguous block of memory encoding a list/hash/zset compactly.

```text
[zlbytes][zltail][zllen][entry1][entry2]...[entryN][zlend(0xFF)]
```

Each entry:

```text
[prevlen (1 or 5 bytes)][encoding (1-5 bytes)][data]
```

- `prevlen`: length of the previous entry (to traverse backward). If prev entry is < 254 bytes, prevlen is 1 byte. Otherwise 5 bytes.
- `encoding`: determines data type (integer or string) and length

> **💡 Key Insight:** **Why ZipList is cache friendly:** All entries packed together in one malloc. CPU prefetches the entire structure. For small lists (< 128 entries), this beats a linked list with scattered allocations.

> **⚠️ Production Gotcha:** **ZipList cascading update problem** — a known bug/limitation. If you insert an entry that increases a neighboring entry's prevlen from 1 byte to 5 bytes, that neighboring entry grows, which may cause its neighbor's prevlen to grow too, cascading. Worst case O(N²). This is the primary reason ZipList was replaced.

#### ListPack (Redis 7.0+)

Fixes the cascading update problem by removing the `prevlen` field. Instead, each entry stores its own length at both the beginning AND end (so you can traverse backward without needing previous entry's size).

```text
[total-bytes][num-elements][entry1][entry2]...[entryN][0xFF]
```

Each entry:

```text
[encoding-and-content (variable)][backlen (varint)]
```

`backlen` at the end of each entry is the total byte length of that entry. Backward traversal reads `backlen` from the end to know where this entry starts.

> 🌍 **Real-World:** The ZipList cascading update bug was practically harmless for typical Redis usage (small lists/hashes), but Alibaba's ApsaraDB Redis team discovered it could cause latency spikes in their cloud Redis instances when customers stored objects with many similar-sized fields near the 254-byte boundary. This real-world pain was a key motivator for the Redis team to develop ListPack in Redis 7.0, which Alibaba Cloud adopted immediately in their managed Redis product.

---

### 3.3 QuickList

**What it is:** The underlying structure for Redis List type. A doubly-linked list where each node is a ListPack (or ZipList in older Redis).

```text
[quicklist header]
    |
    v
[node: listpack] <-> [node: listpack] <-> [node: listpack]
```

**Configuration:** `list-max-listpack-size -2` (default) means each node is at most 8KB. Negative values are size limits; positive values are entry count limits.

> **💡 Key Insight:** **Why QuickList instead of a plain linked list?**
> - Plain linked list: each element is a separate allocation → malloc overhead + pointer chasing → terrible cache performance
> - Plain ZipList: O(N) insert/delete + cascading update problem
> - QuickList: bounded-size ZipList nodes (good cache locality within a node) + linked list of nodes (O(1) pointer updates between nodes)

**LZF compression:** Redis can compress middle nodes of the QuickList (never head/tail since those are accessed most often). `list-compress-depth 1` = compress all but the first/last node.

> 🌍 **Real-World:** Weibo (China's Twitter) stores news feed lists in Redis with `list-compress-depth 2` enabled. Middle nodes of a user's timeline list (which are rarely accessed — users mostly read the most recent 20 items) are LZF-compressed in memory. For a user with a 500-item timeline, this reduces per-list memory usage by ~40%, saving hundreds of GB across Weibo's 500M+ user accounts with Redis-backed timelines.

---

### 3.4 SkipList

**What it is:** A probabilistic data structure for ordered data. Expected O(log N) insert, delete, search. Used in Sorted Set alongside a Dict.

**Structure:**

```text
Level 4: head --> [node score=1] ---------------------------------> tail
Level 3: head --> [node score=1] ------------> [node score=50] --> tail
Level 2: head --> [node score=1] --> [score=10] --> [score=50] --> tail
Level 1: head --> [1] --> [5] --> [10] --> [20] --> [50] --> [100] -> tail
```

Each node is a skiplist node:

```c
typedef struct zskiplistNode {
    sds ele;                // the member string
    double score;           // the score
    struct zskiplistNode *backward;  // for reverse traversal
    struct zskiplistLevel {
        struct zskiplistNode *forward;
        unsigned long span;  // how many nodes this pointer skips
    } level[];
} zskiplistNode;
```

**Level generation:** When inserting a new node, generate random level with probability P=0.25 per additional level. Max level = 32 (in Redis source). Expected levels = 1/(1-P) = ~1.33 levels per node.

> **💡 Key Insight:** **Why not a Red-Black Tree or AVL Tree?**
> - Balanced BSTs are complex to implement (rotations, rebalancing)
> - For concurrent access (even with locks), a SkipList is easier to make fine-grained concurrent (each level is a linked list)
> - Redis is single-threaded, but the SkipList was chosen partly for code simplicity
> - SkipList supports range queries naturally (traverse level-1 forwards)
> - SkipList with `span` field enables O(log N) rank queries (`ZRANK`)

**The `span` field:** Each level pointer has a `span` — the number of level-1 pointers it skips over. To find ZRANK (position of an element), add up spans while traversing. This gives ZRANK in O(log N) instead of O(N).

> 🌍 **Real-World:** Redis's choice of SkipList over Red-Black Tree for the ZSet is a pragmatic engineering decision that influenced other systems. Apache Cassandra uses a SkipList for its MemTable (in-memory sorted data structure) for the same reason: simpler code, good range query performance. LevelDB (Google) uses a SkipList for the same role. Antirez estimated the SkipList implementation in Redis is about 1/4 the code complexity of an equivalent Red-Black Tree.

---

### 3.5 Dict (Hash Table)

**Structure:**

```c
typedef struct dictht {
    dictEntry **table;    // array of pointers to entries
    unsigned long size;   // number of buckets (power of 2)
    unsigned long sizemask; // size - 1, for fast modulo via AND
    unsigned long used;   // number of stored key-value pairs
} dictht;

typedef struct dict {
    dictType *type;
    void *privdata;
    dictht ht[2];         // TWO hash tables!
    long rehashidx;       // -1 if not rehashing; bucket index during rehash
    unsigned nrehashsteps;
} dict;
```

> **💡 Key Insight:** **Why two hash tables?** Rehashing. When load factor exceeds threshold (typically 1.0 under normal conditions; 5.0 during BGSAVE to reduce fork COW pressure), Redis starts a **progressive rehash**:
> 1. Allocate `ht[1]` with 2× the capacity of `ht[0]`
> 2. Set `rehashidx = 0`
> 3. On each dict operation (add/delete/find/update), move all entries from bucket `rehashidx` in `ht[0]` to `ht[1]`, then increment `rehashidx`
> 4. Also, the background rehash thread does 1ms of rehashing per 100ms in the main loop
> 5. When `ht[0]` is empty, swap `ht[1]` → `ht[0]`, free old `ht[1]`

**During rehash:** reads check both `ht[0]` and `ht[1]`. New writes go only to `ht[1]`.

**Hash function:** Redis uses **SipHash-1-2** (since Redis 4.0, replaced MurmurHash). SipHash is resistant to hash-flooding attacks (where an attacker crafts keys that all hash to the same bucket, degrading O(1) to O(N)).

**Load factor trigger:**
- `DICT_HT_INITIAL_SIZE = 4` (initial 4 buckets)
- Expand when `used / size > 1` (load factor > 1)
- Contract when `used / size < 0.1` (load factor < 0.1) — to reclaim memory

> 🌍 **Real-World:** The switch from MurmurHash to SipHash in Redis 4.0 was directly motivated by a 2011 security disclosure where an attacker could craft HTTP POST parameters that all hashed to the same bucket in Perl, Python, PHP, and Ruby hash tables — causing O(N²) processing time and effectively a DoS attack. Redis adopted SipHash to prevent the same class of attack against Redis keys, protecting use cases where user-controlled strings become Redis keys (e.g., per-user rate-limit keys).

---

### 3.6 HyperLogLog Deep Dive

**The registers:** 16,384 registers, each storing a 6-bit integer (max value 63). Total storage: 16384 × 6 bits = 12,288 bytes ≈ 12KB.

**The algorithm:**
1. Hash element → 64-bit value
2. First 14 bits → register index j (0-16383)
3. Remaining 50 bits → find position of leftmost 1-bit (count leading zeros + 1)
4. Update register j: `register[j] = max(register[j], leading_zeros + 1)`
5. Estimate = `alpha_m × m² × (sum of 2^(-register[i]) for all i)^(-1)`
   - m = 16384
   - alpha_m ≈ 0.7213 / (1 + 1.079/m) ≈ 0.7213 for large m
6. Small range correction: if estimate < 2.5 × m and some registers are 0, use linear counting
7. Large range correction: if estimate > 2^32 / 30, use large range formula

> **💡 Key Insight:** **Sparse vs Dense encoding:** When the HyperLogLog has few non-zero registers, Redis uses a **sparse encoding** (list of (register_index, value) pairs). Switches to **dense** (flat array) once it becomes more efficient. Threshold: `hll-sparse-max-bytes 3000`.

> 🌍 **Real-World:** OKCupid uses HyperLogLog to power their "who viewed your profile" unique viewer counts. Rather than storing a set of every viewer's ID (which grows unboundedly for popular profiles), each profile has a HLL that stays fixed at 12KB. For a profile that has received 1 million unique views, the HLL reports ~998,000–1,002,000 with 0.81% error — precise enough for the UI display but 1000× more memory efficient than a set.

---

### 3.7 Bloom Filter (RedisBloom module)

**What it is:** A **probabilistic data structure** that tests set membership. Can have **false positives** (says "member" when it isn't), but NEVER **false negatives** (if it says "not member," it definitely isn't).

**Structure:** A bit array of m bits, and k hash functions.

**Add element:** Hash with each of the k functions → k positions in the bit array → set each to 1.

**Query element:** Hash with same k functions → k positions → if ALL are 1, return "probably present." If ANY is 0, return "definitely absent."

**False positive rate:** `(1 - e^(-kn/m))^k` where n = number of inserted elements.

**Optimal k:** `k = (m/n) × ln(2)` minimizes false positive rate for given m and n.

#### Bloom Filter Commands (RedisBloom module)

```redis
BF.ADD key item
BF.EXISTS key item
BF.MADD key item [item ...]
BF.MEXISTS key item [item ...]
BF.RESERVE key error_rate capacity  -- create with specific parameters
```

> **📖 Real-World Example:** **Cache penetration prevention.** Before hitting the DB, check Bloom filter. If "not present," skip DB entirely. False positives just cause occasional unnecessary DB hits — acceptable.

> **⚠️ Production Gotcha:** Standard Redis does NOT include RedisBloom. It's a separate module. In production, use Redis Stack or compile with the module. Many cloud providers offer it as an add-on.

> 🌍 **Real-World:** Medium uses a Bloom filter in Redis to prevent re-recommending articles a user has already read. Before adding an article to a user's recommendation list, `BF.EXISTS user:12345:read article:abc` is checked. If the article is in the filter, it's skipped. False positives (occasionally skipping an unread article) are acceptable; false negatives (recommending already-read content) are not. This Bloom filter approach uses ~1MB per user instead of storing a full set of hundreds of thousands of article IDs.

---

## PART 4 — EVENT LOOP INTERNALS

### 4.1 The ae (Async Events) Event Loop

Redis implements its own event loop in `ae.c` (async events). It abstracts over platform-specific I/O multiplexing:
- Linux: **epoll** (`ae_epoll.c`)
- macOS/BSD: **kqueue** (`ae_kqueue.c`)
- Fallback: **select** (`ae_select.c`)

**Event types:**
1. **File events:** I/O on file descriptors (client sockets, AOF file)
2. **Time events:** periodic tasks (expiration, stat reporting, replication heartbeat)

**The main loop:**

```c
void aeMain(aeEventLoop *eventLoop) {
    eventLoop->stop = 0;
    while (!eventLoop->stop) {
        aeProcessEvents(eventLoop, AE_ALL_EVENTS | AE_CALL_BEFORE_SLEEP | AE_CALL_AFTER_SLEEP);
    }
}

int aeProcessEvents(aeEventLoop *eventLoop, int flags) {
    // 1. Find the nearest time event to determine epoll timeout
    // 2. Call epoll_wait(fd, events, maxevents, timeout_ms)
    // 3. Dispatch file events (read/write callbacks)
    // 4. Process time events (run callbacks whose time has come)
}
```

**How a command flows (full trace):**

```text
1. Client connects → accept() → new file descriptor fd=42
2. Register fd=42 with epoll for READ events, callback = readQueryFromClient
3. Client sends "SET foo bar\r\n"
4. epoll_wait returns → readQueryFromClient(fd=42) called
5. Read bytes into client's input buffer (client.querybuf)
6. Parse RESP protocol: *3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n
7. Look up "SET" in commandTable (a hash table of name → command struct)
8. Validate arity, ACL check
9. Execute setCommand(client, argc, argv)
10. Write return value (+OK\r\n) to client's output buffer (client.buf or client.reply list)
11. Register fd=42 for WRITE events
12. Next epoll iteration: write buffer to socket, deregister WRITE event
```

**RESP Protocol (Redis Serialization Protocol):**

```text
*3\r\n          -- array of 3 elements
$3\r\n          -- bulk string of length 3
SET\r\n
$3\r\n
foo\r\n
$3\r\n
bar\r\n
```

> **💡 Key Insight:** **RESP3** (Redis 6+) adds more types: double, boolean, map, set, attribute, push data (for client-side caching invalidation).

> 🌍 **Real-World:** The RESP protocol's text-based simplicity (before RESP3) made it trivial to implement Redis clients in any language — there are Redis clients for over 60 programming languages. Twilio used this to build a custom Redis client in Erlang for their actor-based telephony system, leveraging RESP's simplicity to write the client in under 200 lines of Erlang code. The human-readable format also made debugging Redis traffic with `tcpdump` trivial during incident response.

---

### 4.2 I/O Threading in Redis 6.0+

**The problem it solves:** On a machine with 10Gbps NIC and many concurrent connections, a single thread can't read/parse/write fast enough to saturate the network.

**The solution:** A pool of I/O threads. The main thread still runs the event loop and executes commands. I/O threads only handle socket reads and writes.

**Flow with I/O threads enabled:**
1. Main thread: `epoll_wait` → get list of clients with pending reads
2. Main thread: distribute clients across I/O threads (round-robin)
3. I/O threads: each reads from assigned client sockets into query buffers
4. Main thread: waits for all I/O threads to finish reading (spinlock, not sleep — for low latency)
5. Main thread: **executes all queued commands sequentially** (still single-threaded)
6. Main thread: distributes client write buffers to I/O threads
7. I/O threads: write reply buffers to sockets
8. Main thread: goes back to `epoll_wait`

> **💡 Key Insight:** Command execution is never parallelized. Only I/O is. So you can't parallelize two concurrent LPUSH operations — they're still serialized.

**Configuration:**

```text
io-threads 4           # number of I/O threads (including main)
io-threads-do-reads yes  # enable multi-threaded reads (not just writes)
```

> 🌍 **Real-World:** Alibaba Cloud's ApsaraDB Redis enabled I/O threading (`io-threads 4`) for their high-bandwidth Redis instances (instances receiving >1GB/s of network traffic). For a customer running a large-scale ad-tech bidding platform with 50,000+ concurrent connections, enabling I/O threads improved throughput from ~800K ops/sec (single I/O thread bottleneck) to ~2.4M ops/sec on the same hardware, without any change to application code.

---

## PART 5 — PERSISTENCE

### 5.1 RDB (Redis Database Snapshot)

**What it is:** A point-in-time snapshot of all data, saved as a compact binary file (`dump.rdb`).

**How it works:**
1. `BGSAVE` command (or triggered by `save` config rules): Redis calls `fork()`
2. Parent process continues serving requests normally
3. Child process: iterates all databases and all keys, serializes them into RDB format, writes to temp file
4. When done: atomically rename temp file → `dump.rdb`

> **💡 Key Insight:** **fork() and COW (Copy-on-Write):**
> - `fork()` creates a child process that initially shares all the parent's virtual memory pages (no actual copying)
> - Physical pages are shared. The OS marks them all as COW
> - When the parent (serving commands) modifies a page → OS triggers a page fault → copies that physical page → parent gets its own copy
> - When the child (saving snapshot) reads a page → no copy needed, reads the original
> - **Implication:** If Redis has 10GB of data and receives heavy writes during BGSAVE, the parent may end up with nearly double memory usage (old pages shared with child + new copies for modified pages). This is called **fork() memory amplification**. Plan for 2× memory headroom.

**RDB file format:**

```text
REDIS0011       -- magic + version
[optional metadata: redis-ver, redis-bits, ctime, used-mem]
[per-database: SELECTDB + db_number + RESIZE_DB + db_size + expires_size]
[per-key: [optional EXPIRETIME] + type-byte + key + value]
[EOF byte]
[8-byte CRC64 checksum]
```

**Configuration:**

```text
save 900 1      # save if at least 1 key changed in 900 seconds
save 300 10     # save if at least 10 keys changed in 300 seconds
save 60 10000   # save if at least 10000 keys changed in 60 seconds
dbfilename dump.rdb
dir /var/lib/redis
```

**Pros:** Compact file, fast startup (just load binary), minimal impact on Redis during BGSAVE (fork is instant, child works independently).
**Cons:** Data loss up to the interval between snapshots. Fork overhead for very large datasets.

> 🌍 **Real-World:** Discord stores server member presence data in Redis with RDB snapshots every 5 minutes. For Discord's use case (presence data is recoverable from reconnections if lost), 5-minute RPO is acceptable. Their 50GB Redis instance takes ~2 seconds to fork and ~90 seconds for the child to write the RDB file. During this window, if the server crashes, they lose at most 5 minutes of presence updates — all users simply re-announce their presence on reconnect.

---

### 5.2 AOF (Append Only File)

**What it is:** A log of every write command received by Redis, in RESP format. On restart, Redis replays all commands to reconstruct state.

**How fsync works:**

| Mode | Behavior | Max Data Loss | Throughput |
|------|----------|---------------|------------|
| `appendfsync always` | fsync after every write command | 0 | ~1,000 writes/sec |
| `appendfsync everysec` | fsync once per second (default) | ~1 second | ~100,000 writes/sec |
| `appendfsync no` | let OS decide | up to 30 seconds | Maximum |

**AOF Rewrite:**
Over time, AOF grows unbounded. `BGREWRITEAOF` triggers a rewrite:
1. Fork child process
2. Child: iterate all databases, write minimal commands to reconstruct current state (e.g., an old SET then DEL becomes nothing; a 100-element LPUSH becomes one RPUSH with all 100 elements)
3. Meanwhile, parent: buffer new write commands in an in-memory AOF rewrite buffer AND append to old AOF file
4. When child finishes: parent appends the in-memory buffer to the new AOF file, atomically replaces old AOF with new
5. The new AOF file is much smaller

**AOF rewrite trigger (automatic):**

```text
auto-aof-rewrite-percentage 100  # rewrite when AOF is 100% larger than at last rewrite
auto-aof-rewrite-min-size 64mb   # minimum size to trigger rewrite
```

> **⚠️ Production Gotcha:** **AOF truncation** — If Redis crashes during an fsync, the AOF may have a partially written command at the end. With `aof-load-truncated yes`, Redis loads what it can and ignores the partial command. With `no`, it refuses to start and you must manually fix with `redis-check-aof --fix`.

> 🌍 **Real-World:** Stripe uses AOF with `appendfsync everysec` for their Redis instances that store idempotency keys for payment processing. The 1-second data loss window is acceptable (at most 1 second of idempotency key writes could be lost in a crash), but the 100× throughput improvement over `always` is critical for handling Stripe's payment volume spikes. If a crash did occur and duplicate payment attempts came in during the lost window, application-level deduplication in the database serves as the final safety net.

---

### 5.3 RDB+AOF Hybrid Mode (Redis 4+)

**What it is:** The AOF file is structured as: [RDB snapshot of data at rewrite time] + [AOF log of commands since that snapshot].

**Why:** Pure AOF has slow startup (replay all commands). Pure RDB has data loss. Hybrid gives fast startup (load RDB portion) + minimal data loss (replay short AOF portion).

**Enable:**

```text
aof-use-rdb-preamble yes  # default yes in Redis 4+
```

**Startup behavior:** Redis detects the magic bytes at the start of the AOF file. If it looks like an RDB (`REDIS`), loads the RDB portion first, then replays the AOF tail.

#### Persistence Comparison

| Feature | RDB | AOF | Hybrid |
|---------|-----|-----|--------|
| Startup speed | Fast (binary load) | Slow (replay all cmds) | Fast (RDB + short AOF) |
| Data loss | Up to snapshot interval | Up to 1 sec (everysec) | Up to 1 sec |
| File size | Compact | Grows unbounded | Compact after rewrite |
| CPU overhead | Low (periodic fork) | Low (background fsync) | Low |
| Durability | Lower | Higher | High |

> 🌍 **Real-World:** ElastiCache (AWS managed Redis) defaults to hybrid persistence (RDB+AOF) for their "Redis with cluster mode enabled" tier. For customers storing session data (e.g., a global e-commerce site), hybrid mode means that after an ElastiCache node replacement (which happens during maintenance or failover), the new node loads a recent RDB snapshot in seconds and replays only the last few minutes of AOF — users' sessions survive the replacement with at most 1 second of data loss instead of all sessions being lost.

---

## PART 6 — REPLICATION

### 6.1 Master-Replica Architecture

Redis replication is **asynchronous** by default. The master doesn't wait for replicas to confirm receipt before acknowledging to the client. This means:
- Low latency on master
- Possible data loss if master crashes before replica receives latest commands

> **💡 Key Insight:** **WAIT command:** `WAIT numreplicas timeout_ms` — blocks the client until at least `numreplicas` replicas have acknowledged up to the current replication offset, or timeout. Not the default but useful for critical writes.

> 🌍 **Real-World:** GitHub uses Redis replication with the `WAIT 1 100` pattern for their pull request merge lock. When a merge is completed, the application calls `WAIT 1 100` after writing the merge status to Redis — this blocks until at least 1 replica has the data (or 100ms timeout). This near-synchronous write prevents a scenario where a master crash right after the merge write would show the PR as "not merged" to users reading from a replica that missed the write.

### 6.2 Full Synchronization (Initial Sync)

When a replica first connects (or reconnects after too long):
1. Replica sends `PSYNC replicationid offset`
2. Master: if replica's replication ID matches and offset is within backlog → partial resync (see below)
3. Otherwise, full sync:
   a. Master sends `+FULLRESYNC replid offset`
   b. Master triggers BGSAVE (or uses a running one)
   c. While BGSAVE runs, master buffers all new write commands in the **replication buffer** (per-replica queue)
   d. Master sends the RDB file to replica
   e. Replica loads the RDB (discarding current data)
   f. Master sends buffered commands; replica executes them
   g. From now on: every write command on master is sent to replica immediately

> **💡 Key Insight:** **Diskless replication:** `repl-diskless-sync yes` — the RDB is sent directly to the replica socket without writing to disk. Useful when disk I/O is the bottleneck or disk is slow. The master forks and the child writes RDB directly to the socket.

> 🌍 **Real-World:** Cloudflare uses diskless replication (`repl-diskless-sync yes`) for their Redis instances that run on AWS instances with slow EBS volumes. When a new read replica is brought up for geographic distribution, the RDB is streamed directly from the master's memory to the replica over the network — avoiding a disk write that would take 30+ seconds for a 20GB dataset and instead completing the sync in ~8 seconds limited only by network bandwidth.

### 6.3 Partial Resync (PSYNC)

**Replication backlog:** A circular buffer on the master (`repl-backlog-size`, default 1MB) that stores recent write commands. All replicas consume from the same backlog.

**Replication offset:** A monotonically increasing integer. Master's offset is how many bytes of commands it has produced. Replica's offset is how many it has consumed. If `master_offset - replica_offset <= backlog_size`, partial resync is possible.

> **💡 Key Insight:** **PSYNC2 (Redis 4+):** Each Redis instance has:
> - **`replication ID`** (replid): 40-character hex string, generated at startup or when becoming master
> - **`secondary replication ID`** (replid2): the previous master's ID (set when this replica becomes master after failover)
>
> This allows a replica that has been promoted to master to still offer partial resync to its siblings (other replicas of the old master), using `replid2` and `second_repl_offset`. Without PSYNC2, all replicas would need full resync after a failover — expensive.

> 🌍 **Real-World:** Replication backlog size is one of the most undertuned Redis settings. At Booking.com, their Redis instances handling hotel availability updates had a default 1MB backlog. During a network blip that lasted 15 seconds, replicas fell behind by 2MB of write commands — exceeding the backlog, forcing a full resync that took 45 seconds and briefly halved their read capacity. They subsequently set `repl-backlog-size 256mb` on all instances handling high write throughput.

### 6.4 Replication Buffer vs Replication Backlog

| | Replication Buffer | Replication Backlog |
|---|---|---|
| Per | Per connected replica | Shared among all replicas |
| Purpose | Queue commands for a specific replica | Enable partial resync after reconnect |
| Size | Dynamic, grows with lag | Fixed circular buffer |
| When full | Master disconnects that replica | Triggers full sync on reconnect |

> **⚠️ Production Gotcha:** If a replica falls far behind (e.g., slow network, heavy writes on master), the per-replica replication buffer grows. If it exceeds `client-output-buffer-limit replica 256mb 64mb 60` (default), master disconnects the replica. Then the replica reconnects and triggers a full sync. Full sync further increases master memory usage (RDB in memory). This can cascade: replica repeatedly disconnects → full sync → disconnects. Fix: increase the limit or investigate why the replica is lagging.

---

## PART 7 — REDIS SENTINEL

### 7.1 What Sentinel Is

**Redis Sentinel** provides:
1. **Monitoring:** continuously checks if master and replicas are available
2. **Notification:** can notify sysadmins via API when something goes wrong
3. **Automatic failover:** if master goes down, elects a replica as new master, reconfigures others

Sentinel is a separate Redis process (`redis-sentinel sentinel.conf` or `redis-server --sentinel`).

> 🌍 **Real-World:** GitLab (self-hosted) runs Redis Sentinel with 3 sentinel nodes for their application cache. During a 2019 incident, their Redis master ran out of memory and became unresponsive. The 3 sentinels detected the ODOWN within 30 seconds (configured `down-after-milliseconds 30000`) and automatically promoted the replica to master. The entire GitLab.com platform experienced only ~45 seconds of elevated error rates before the failover completed — an automatic recovery that would have taken 10-15 minutes with manual intervention.

### 7.2 How Failover Works

1. Sentinel pings master every `sentinel down-after-milliseconds master 30000` ms
2. If no response → **SDOWN** (subjective down): this Sentinel marks master as possibly down
3. Sentinel asks other Sentinels: "Do you also see master as down?" (`SENTINEL is-master-down-by-addr`)
4. If majority (quorum) agree → **ODOWN** (objective down)
5. Sentinels hold a **leader election** (Raft-like): each Sentinel proposes itself, votes for the first one it hears from, most votes wins
6. Leader Sentinel selects which replica to promote:
   - Replicas with lower replication lag preferred
   - Then: replica with lowest priority (`slave-priority`), then longest replication offset, then smallest Run ID
7. Leader Sentinel sends `SLAVEOF NO ONE` to chosen replica → promotes it
8. Other replicas are reconfigured to follow new master
9. Old master, if it comes back, is reconfigured as replica of new master

**Quorum:** Minimum Sentinels that must agree on ODOWN. Separate from the majority needed for leader election.

> **⚠️ Production Gotcha:** You need at least 3 Sentinels for proper failure detection and to avoid split-brain. With 2 Sentinels and quorum=1, if one Sentinel has network issues, it may elect a new master while the old one is still serving (split-brain). Recommendation: 3 or 5 Sentinels (odd number), quorum = majority.

> 🌍 **Real-World:** Pinterest runs 5 Sentinel nodes (quorum=3) for their Redis Sentinel setup governing their follower graph cache. The extra 2 Sentinel nodes (beyond the minimum 3) protect against scenarios where an AWS Availability Zone goes down, taking 2 Sentinels with it — with 3 remaining Sentinels in other AZs, they still achieve quorum=3 for failover decisions. Running fewer Sentinels in a multi-AZ setup is a common production mistake that Pinterest learned from an early incident.

---

## PART 8 — CLUSTER MODE

> ⭐ **IMPORTANT CONCEPT:** 16,384 hash slots + MOVED/ASK redirects are the core of Redis Cluster routing.

### 8.1 Hash Slots

Redis Cluster partitions keyspace into **16,384 slots** (not 65,536, not a million — specifically 16,384).

> **💡 Key Insight:** **Why 16,384?**
> - Each node sends its slot coverage as a bitmap in gossip messages
> - 16,384 bits = 2,048 bytes ≈ 2KB per gossip message — acceptable overhead
> - Large enough for 1,000 nodes (each handling ~16 slots), without wasting memory
> - CRC16 of a key produces a 16-bit number (0-65535). 65536 slots would be too many for gossip messages. 16384 = 65536 / 4 — using the lower 14 bits of CRC16.

**Slot assignment:**

```text
node1: slots 0-5460       (3 masters, each ~1/3 of slots)
node2: slots 5461-10922
node3: slots 10923-16383
```

**Key → slot formula:**

```text
slot = CRC16(key) % 16384

// With hash tag:
slot = CRC16("{user:123}") % 16384   // only the part inside {} is hashed
```

> 🌍 **Real-World:** Instacart runs a 12-node Redis Cluster (6 masters + 6 replicas) with 16,384 slots evenly distributed across the 6 masters (2730 slots each). During peak grocery ordering (Thanksgiving week), they scale to 18 nodes by resharding — Redis Cluster's live slot migration moves slots from existing nodes to new ones without downtime. The 16,384 slot design means their rebalancing tool needs only a 2KB bitmap per node to describe the full cluster topology.

### 8.2 Hash Tags

**Why:** If `user:123:profile` and `user:123:orders` are on different nodes, you can't run `MGET` on them or do Lua scripts atomically.

**Solution:** `{user:123}:profile` and `{user:123}:orders` — Redis extracts the content between the first `{` and first `}` (`user:123`) and hashes only that. Both keys go to the same slot → same node.

> **⚠️ Production Gotcha:** Hash tags defeat the distribution purpose of clustering. If you use `{user:123}` everywhere for user 123, all of user 123's keys are on one node — fine. But if you use `{}` (empty tag) or the same tag for all keys, everything lands on one node. Inspect your key patterns.

> 🌍 **Real-World:** Twitch uses Redis Cluster hash tags to co-locate a streamer's related data. Keys like `{channel:xqc}:viewers`, `{channel:xqc}:chat_rate`, and `{channel:xqc}:stream_status` all use the same hash tag `{channel:xqc}` — they land on the same Redis Cluster node. This allows a Lua script to atomically update viewer count, check chat rate limits, and read stream status for a channel in a single round-trip without cross-slot errors.

### 8.3 MOVED vs ASK

#### MOVED redirect

- Client sends command to node A for key K
- Node A checks: slot for K is NOT mine, it's on node B
- Node A replies: `MOVED 6789 node_b_ip:port`
- Client: **update its slot→node map**, retry to node B directly

#### ASK redirect

- During slot migration, some keys have moved, some haven't
- Client sends command to node A for key K
- Node A: this key has already been migrated to node B
- Node A replies: `ASK 6789 node_b_ip:port`
- Client: send `ASKING` command to node B, then retry the command to node B
- `ASKING` is a one-time flag — it means "accept this command even for a slot you're importing"
- Client does **NOT** update its slot map (migration is still in progress)

> **💡 Key Insight:** The difference: **MOVED** = permanent mapping change (update the cache). **ASK** = temporary during migration (don't update the cache yet).

> 🌍 **Real-World:** Coinbase uses Redis Cluster and hit the MOVED/ASK behavior during a live reshard when they added capacity before a major crypto market event. Their Java application using Lettuce (which handles MOVED/ASK transparently) automatically updated its slot map during the reshard — application engineers saw zero errors or restarts needed during the capacity expansion. A naive Redis client that didn't handle MOVED redirects would have thrown errors during the migration window.

### 8.4 Gossip Protocol

Each node maintains a list of all other nodes in the cluster. Periodically:
1. Pick N random nodes (default: `cluster-gossip-interval 100ms`, `cluster-node-timeout 15000ms`)
2. Send a PING containing: sender's state, a few random nodes' states
3. Receiver sends PONG with its own state and a few random nodes' states

**Failure detection:**
1. If node A doesn't hear from node B within `cluster-node-timeout` → mark B as **PFAIL** (possible fail)
2. A gossips about B's PFAIL to other nodes
3. If majority of masters mark B as PFAIL → B is marked as **FAIL** (objective failure)
4. Replica of B starts failover election

**Message size:** PING/PONG contains: header (40 bytes) + gossip section (each entry is 104 bytes). For N nodes, message contains log2(N) gossip entries. For 1000 nodes: ~10 entries = ~1KB per message.

> 🌍 **Real-World:** The Redis gossip protocol's O(log N) message size allows clusters to scale to thousands of nodes without gossip traffic overwhelming the network. Alibaba Cloud operates Redis Cluster deployments with 200+ node clusters for their largest enterprise customers. At 200 nodes, each gossip PING is ~80 bytes of header + ~8 gossip entries × 104 bytes ≈ 900 bytes — trivial compared to actual data traffic, validating the design decision to use gossip over a centralized coordinator.

---

## PART 9 — PRODUCTION PROBLEMS

### 9.1 Hot Key Problem

**Symptom:** One Redis node is at 100% CPU while others are idle. One key is receiving millions of ops/second.

**Causes:** Viral content, celebrity profile, global config key accessed on every request.

> **⚠️ Production Gotcha:** **Hot Key** is one of the most common Redis incidents in production at scale.

**Solutions:**

| Solution | Mechanism | Trade-off |
|----------|-----------|-----------|
| Local in-process cache | Cache value in app memory (100ms-1s TTL) | Slight staleness; 1000 servers × 1s = ~1000 reads/sec to Redis |
| Key sharding | `hot_key:0` through `hot_key:99`, random read | Write amplification (update all 100); distributed load |
| Read replicas | Route reads to replicas of the hot key's node | Replication lag; more infrastructure |
| Client-side caching (Redis 6+) | Invalidation messages on key change via RESP3 | Requires RESP3 client library support |

**Detection:**

```redis
-- redis-cli --hotkeys   (requires LFU maxmemory-policy)
-- redis-cli monitor     (very expensive — copies all commands to you)
```

> 🌍 **Real-World:** When BTS dropped their "Butter" music video on YouTube in 2021, their fan engagement platform experienced a hot key incident — the single Redis key storing the video's global view counter was being incremented millions of times per minute, saturating one Redis node. The team implemented key sharding: `views:butter:0` through `views:butter:99`, with increments going to a random shard and total views computed by summing all 100 shards. The hot key load dropped from 1 node handling 2M ops/sec to 100 nodes handling 20K ops/sec each.

### 9.2 Cache Avalanche

**What it is:** A large number of cache keys expire at roughly the same time → all requests fall through to DB → DB overwhelmed.

**Typical cause:** Cache warming after a restart populates keys with similar TTLs, or a batch job sets many keys with the same `EXPIRE`.

> **⚠️ Production Gotcha:** **Cache avalanche** can bring down your database in seconds. Always add TTL jitter when warming caches in bulk.

**Solutions:**
1. **TTL jitter:** `EXPIRE key (base_ttl + random(0, jitter))`. E.g., base=3600s, jitter=600s → TTLs spread from 3600-4200s.
2. **Cache warming:** After deployment/restart, pre-populate cache before enabling traffic.
3. **Circuit breaker:** If DB latency exceeds threshold, stop forwarding requests (fail fast, serve stale).
4. **Multi-level cache:** L1 = local memory (very short TTL), L2 = Redis, L3 = DB. L1 absorbs avalanche.

> 🌍 **Real-World:** DoorDash experienced a cache avalanche during a Redis cluster restart after a maintenance window. Their restaurant menu cache — millions of keys all set with `EXPIRE 3600` (no jitter) during the cache warm — expired simultaneously at T+3600. Every API server hit the database at the same time, causing a MySQL connection pool exhaustion that took down ordering for ~8 minutes. They subsequently added ±15% TTL jitter to all cache warming code and wrote an internal library that automatically adds jitter to any `EXPIRE` call.

### 9.3 Cache Penetration

**What it is:** Requests for keys that don't exist in cache AND don't exist in DB. Cache never helps — every request hits DB.

**Attack vector:** Attacker queries random IDs that don't exist (`id=-1`, `id=999999999`). Each request bypasses cache, hits DB.

> **⚠️ Production Gotcha:** **Cache penetration** is a common DDoS attack vector. Without protection, it can saturate your database with queries for non-existent data.

**Solutions:**

| Solution | Mechanism | Trade-off |
|----------|-----------|-----------|
| Cache null values | Store null/sentinel in Redis with short TTL (60s) | Memory waste; attacker can still vary keys |
| Bloom filter | Check before Redis — definitive "not present" means skip both | Must be kept in sync; false positives cause occasional unnecessary lookups |
| Input validation | Validate ID format/range before processing | Only works for structured IDs |

> 🌍 **Real-World:** Tencent's gaming platform uses a Redis Bloom filter as the first line of defense against cache penetration on their player profile API. All valid player IDs are pre-loaded into the filter at startup. When a request for `player_id=999999999` (non-existent) arrives, `BF.EXISTS player_ids 999999999` returns 0 — the request is rejected before even checking Redis or MySQL. During a DDoS attack that sent 10M requests/second with random player IDs, the Bloom filter rejected 99.99% of requests in under 1μs each, protecting both Redis and the database.

### 9.4 Cache Breakdown (Stampede / Thundering Herd)

**What it is:** A single hot key expires. Many concurrent requests (e.g., 10,000 req/sec) all see a cache miss simultaneously and all try to fetch from DB and repopulate cache. DB gets 10,000 concurrent queries for the same data.

**Solutions:**

1. **Mutex / distributed lock:** On cache miss, try to acquire a lock (`SET lock:key uuid NX EX 30`). Only the winner queries DB and repopulates cache. Losers either wait and retry, or serve stale data.

```python
result = redis.GET(key)
if result == nil:
    if redis.SET("lock:" + key, uuid, NX=True, EX=30):
        result = db.query(...)
        redis.SET(key, result, EX=ttl)
        redis.DEL("lock:" + key)
    else:
        sleep(50ms)  # wait for lock holder to populate
        result = redis.GET(key)  # retry
```

2. **Logical expiry:** Store value with an embedded expiry timestamp (not Redis TTL — the key never expires at Redis level). On cache hit, check if logical expiry has passed. If yes, trigger async background refresh, return stale value to current request.

```json
{"data": {...}, "logical_ttl": 1704067200}
```

This is "stale-while-revalidate." Requires background refresh worker.

3. **Probabilistic early expiry (PER):** Before the key actually expires, proactively refresh it. On each cache read, compute a random probability that increases as TTL approaches zero. If triggered, refresh early. This spreads the refresh load.

> 🌍 **Real-World:** Airbnb uses the logical expiry (stale-while-revalidate) pattern for their listing price caching. The cached price for a popular listing never expires at the Redis level — the key exists forever. When a reader sees `logical_ttl` has passed, it dispatches an async Sidekiq job to refresh the price in the background and returns the stale price immediately. The next request after the job completes sees the fresh price. This completely eliminates thundering-herd stampedes on Airbnb's highest-traffic listing pages.

### 9.5 Memory Fragmentation

**What it is:** Redis uses **jemalloc** as its memory allocator. After many small allocations and deallocations (e.g., inserting and deleting string keys), the allocator may have many small free chunks that don't add up to contiguous regions for large allocations. The OS reports Redis using 8GB of virtual memory but Redis's `used_memory` is only 5GB → `mem_fragmentation_ratio = 8/5 = 1.6`.

**Why it happens:**
- Many small strings of varying sizes → allocator can't easily reuse holes
- String values that grow (SDS doubling) leave behind old allocations if the key is overwritten
- Hash/Set that switches from compact to Dict encoding → old compact structure freed, new larger one allocated

**Monitoring:**

```redis
redis-cli INFO memory | grep mem_fragmentation_ratio
# mem_fragmentation_ratio > 1.5 = problematic
# mem_fragmentation_ratio < 1.0 = Redis using swap (bad!)
```

**Solutions:**

1. **Active defragmentation (Redis 4+):** `activedefrag yes`. Redis slowly moves objects to new allocations, freeing fragmented space. CPU overhead ~10-25% during defrag. Trigger thresholds:

```text
active-defrag-ignore-bytes 100mb  # start if fragmented bytes > 100mb
active-defrag-threshold-lower 10  # start if fragmentation > 10%
active-defrag-threshold-upper 100 # max effort if fragmentation > 100%
active-defrag-cycle-min 1         # min CPU% for defrag
active-defrag-cycle-max 25        # max CPU% for defrag
```

2. **Restart Redis:** As a last resort, a graceful restart loads data from RDB/AOF, completely fresh allocations.
3. **Tune workload:** Avoid patterns that cause many small alloc/free cycles.

> 🌍 **Real-World:** Twitter's Redis infrastructure team found `mem_fragmentation_ratio` reaching 2.1 on their heavily-used user session Redis instances after 30+ days of uptime. Rather than restarting during business hours (which would cause a 20-second cold cache penalty), they enabled `activedefrag yes` with conservative CPU limits (`active-defrag-cycle-max 10`). Over 6 hours, the ratio dropped from 2.1 to 1.15, reclaiming ~40GB of memory across their fleet without any service disruption.

### 9.6 Fork Overhead

**Symptom:** During BGSAVE or BGREWRITEAOF, Redis latency spikes for a few milliseconds (or longer). This is because `fork()` itself takes time proportional to the size of the page table, not the actual data.

**fork() time:** On Linux, `fork()` with **transparent huge pages** enabled can be slow because the page table is larger (fewer pages, each 2MB, but more TLB pressure). A 10GB Redis instance can take 100-500ms to fork.

> **⚠️ Production Gotcha:** **THP (Transparent Huge Pages) and Redis:**
> - THP merges 4KB pages into 2MB pages automatically
> - When COW triggers on a 2MB huge page (because parent wrote to 1 byte of it), the entire 2MB page is copied
> - This dramatically increases memory usage and I/O during BGSAVE
> - **Solution:** Disable THP for Redis: `echo never > /sys/kernel/mm/transparent_hugepage/enabled`

**Replication and fork:** Full sync also forks. On a write-heavy master, full sync can cause:
1. `fork()` → child starts writing RDB
2. Parent writes are COW-copied → parent memory doubles
3. Child finishes, RDB sent to replica
4. Child exits → OS reclaims COW copies

But during step 2-3, memory usage can be 2× normal. Plan for this.

> 🌍 **Real-World:** The Redis documentation explicitly lists disabling THP as a required production configuration, and for good reason: Cloudflare's Redis team reported that THP was causing 200ms+ latency spikes during BGSAVE on their 30GB Redis instances — the 2MB huge pages meant each COW copy was 512× larger than with 4KB pages, and their write-heavy workload triggered thousands of COW copies per second during a save. Disabling THP (`echo never > /sys/kernel/mm/transparent_hugepage/enabled` in `/etc/rc.local`) reduced BGSAVE latency spikes from 200ms to under 5ms.

---

## PART 10 — EVICTION POLICIES

### 10.1 Policies

When `maxmemory` is set and Redis is full, what to evict:

| Policy | Applies To | Behavior |
|--------|-----------|----------|
| `noeviction` | All keys | Return error for write commands. Safe but app must handle. Default in Redis 7.0+ |
| `allkeys-lru` | All keys | Evict least recently used key |
| `volatile-lru` | Keys with TTL | Evict LRU key from keys with TTL set |
| `allkeys-lfu` | All keys | Evict least frequently used (Redis 4+) |
| `volatile-lfu` | Keys with TTL | Evict LFU from keys with TTL |
| `allkeys-random` | All keys | Evict random key |
| `volatile-random` | Keys with TTL | Evict random key from keys with TTL |
| `volatile-ttl` | Keys with TTL | Evict key with soonest expiry (smallest TTL) |

> **💡 Key Insight:** **LRU approximation (NOT exact LRU):** Redis does NOT maintain a global LRU linked list (too expensive — every access would need to update it). Instead:
> - Each `redisObject` has a 24-bit `lru` field: `server.lruclock & LRU_CLOCK_MAX` (seconds, wraps every 194 days)
> - When eviction needed: sample `maxmemory-samples` (default 5) random keys, evict the one with the oldest `lru` timestamp
> - With `maxmemory-samples 10`, Redis approximates real LRU very closely (measured by Redis team)

**LFU (Redis 4+):**
- Uses the same 24-bit `lru` field, reinterpreted: upper 16 bits = last decrement time (in minutes), lower 8 bits = logarithmic frequency counter
- The 8-bit counter is logarithmically incremented on access (probability of increment decreases as counter grows), so it represents log2 of access frequency
- Counter decays over time based on `lfu-decay-time` (minutes per decay unit): if a key hasn't been accessed in N minutes, counter is decremented
- This allows distinguishing "used 10M times" from "used 10 times" without overflow

#### When to Use Which Policy

| Policy | Best For |
|--------|----------|
| `allkeys-lru` | General caching where all keys are potentially useful. Evict cold data. |
| `allkeys-lfu` | Better than LRU for hot/cold data with bursty access patterns. A key accessed 1M times yesterday but not today is still protected under LRU; LFU correctly identifies it as cold after decay. |
| `volatile-lru/lfu` | When some keys must never be evicted (don't set TTL on them). Keys without TTL are immune. |
| `volatile-ttl` | When you want Redis to honor expiry intentions — evict keys you intended to expire soonest. |
| `noeviction` | For queues/streams where you'd rather get an error than silently lose data. |

> 🌍 **Real-World:** Facebook's Instagram team switched from `allkeys-lru` to `allkeys-lfu` for their photo metadata cache after analyzing their access patterns. LRU was evicting popular celebrity posts that hadn't been accessed in the past hour (due to bursty traffic patterns) while retaining less popular posts that were accessed more recently. LFU correctly identified the high-frequency celebrity post metadata as hot and kept it in cache — improving cache hit rate from 89% to 96%, reducing database load by 60%.

---

## PART 11 — PERFORMANCE PATTERNS

### 11.1 Pipelining

**What it is:** Send multiple commands to Redis without waiting for a reply to each one. The client buffers commands, sends them in one network write, reads all replies together.

**Why it's faster:**
- **RTT** (round-trip time) dominates Redis latency. If RTT = 1ms and command = 0.01ms, throughput without pipelining = 1000 ops/sec. With pipelining of 100 commands: 10,000 ops/sec (100 commands per 1ms RTT).
- Fewer system calls: one `send()` + one `recv()` vs N×`send()` + N×`recv()`

> **💡 Key Insight:** **How it works internally:** The server processes each command in the pipeline as it arrives. Because the event loop reads the entire pipeline into the query buffer in one or a few reads, all commands are processed in sequence in one event loop iteration. The replies are buffered and sent back together.

> **⚠️ Production Gotcha:** **Pipelining is NOT atomic.** While the server is processing commands 5-10 of your pipeline, another client's commands may interleave. If you need atomicity, use MULTI/EXEC.

**Optimal batch size:** Usually 100-500 commands. Beyond that, the benefit saturates and you risk memory issues.

```python
# Python example with redis-py
pipe = redis.pipeline(transaction=False)  # transaction=False = no MULTI/EXEC
for i in range(1000):
    pipe.set(f"key:{i}", f"value:{i}")
results = pipe.execute()  # sends all 1000 commands, reads 1000 replies
```

> 🌍 **Real-World:** Discord uses Redis pipelining to batch message reaction updates. When a popular message receives 10,000 reactions in a burst (e.g., a moderator announcement), individual `HINCRBY` calls would require 10,000 round trips. With pipelining in batches of 500, they reduce this to 20 round trips — a 500× reduction in network overhead that prevented Redis from becoming the bottleneck during reaction storms. Discord processes billions of reactions per day using this pattern.

### 11.2 MULTI/EXEC (Transactions)

**What it is:** Queues a series of commands to be executed atomically (no other client commands between them) and sequentially.

**How it works:**
1. Client sends `MULTI` → server sets client flag `CLIENT_MULTI`, replies `+OK`
2. Client sends commands → server queues them in `client.mstate.commands` (does NOT execute), replies `+QUEUED`
3. Client sends `EXEC` → server iterates the queue, executes each command, replies with array of all results
4. (Alternative) Client sends `DISCARD` → queue is cleared, transaction is cancelled

> **⚠️ Production Gotcha:** **Redis transactions do NOT have rollback.** If command 3 of 5 fails (e.g., INCR on a non-integer string), commands 1, 2, 4, 5 still execute. There is no atomicity in the "all or nothing" sense of RDBMS transactions. What Redis guarantees:
> - No other client's commands interleave between the EXEC'd commands
> - The sequence is executed in order

**When commands fail vs when they error:**

| Error Type | Example | Behavior |
|------------|---------|----------|
| **Compile-time errors** | Wrong number of arguments, unknown command | MULTI queue is aborted, EXEC returns error. None execute. |
| **Runtime errors** | INCR on string value | That command returns error, but others execute normally. |

**WATCH (Optimistic Locking / CAS):**

```redis
WATCH key1 key2         -- watch these keys for modification
MULTI
  SET key1 newval       -- queued
  INCR key2             -- queued
EXEC                    -- IF key1 or key2 were modified since WATCH, returns nil
                        -- (transaction is cancelled). Otherwise executes.
```

WATCH implements **optimistic concurrency control** (check-and-set). If any watched key is modified by another client between WATCH and EXEC, EXEC returns nil (transaction not executed). Application retries.

**Retry pattern:**

```python
while True:
    redis.watch("inventory:item:42")
    current = int(redis.get("inventory:item:42"))
    if current <= 0:
        redis.unwatch()
        raise OutOfStock()
    pipe = redis.pipeline(transaction=True)
    pipe.multi()
    pipe.decr("inventory:item:42")
    try:
        pipe.execute()  # returns None if CAS failed
        break
    except WatchError:
        continue  # retry
```

> 🌍 **Real-World:** Ticketmaster uses Redis WATCH/MULTI/EXEC for flash sale seat reservations. When Taylor Swift tickets go on sale, thousands of users simultaneously attempt to reserve the same seats. `WATCH seat:12345` → check if available → `MULTI` → `SET seat:12345 reserved_by:user_abc` → `EXEC`. If another user grabbed the seat between WATCH and EXEC, the transaction returns nil and the user gets a "seat no longer available" response. This optimistic locking approach handles the thundering herd without any pessimistic locking delays for the majority of users who successfully reserve unique seats.

### 11.3 Lua Scripting

**What it is:** Execute Lua scripts atomically inside Redis. The script runs in the same single-threaded event loop. No other command executes while a script is running.

#### Lua Script Commands

```redis
EVAL "return redis.call('SET', KEYS[1], ARGV[1])" 1 mykey myvalue
-- "1" = number of keys
-- KEYS[1] = "mykey"
-- ARGV[1] = "myvalue"

EVALSHA sha1 numkeys [key ...] [arg ...]  -- execute cached script by SHA1

SCRIPT LOAD "..."  -- load script, get back SHA1 (for EVALSHA)
SCRIPT EXISTS sha1 [sha1 ...]
SCRIPT FLUSH       -- remove all cached scripts
```

**Why Lua over MULTI/EXEC:**
- Conditional logic: `if redis.call('GET', KEYS[1]) == ARGV[1] then ... end` — impossible with MULTI/EXEC
- Complex computations: loop over results, build complex data structures
- Atomic multi-key operations without WATCH retry loop

**redis.call vs redis.pcall:**
- `redis.call('SET', ...)`: if command errors → Lua script also errors (exception)
- `redis.pcall('SET', ...)`: if command errors → Lua gets an error table, can handle it

> **💡 Key Insight:** **Atomicity guarantee:** The Lua script is truly atomic — no interleaving with other clients. This is the key difference from pipelining. The entire script executes between two consecutive event loop iterations (conceptually).

> **⚠️ Production Gotcha:** Long-running Lua scripts block the entire server. `lua-time-limit 5000` (ms) — after this, Redis accepts only `SCRIPT KILL` and `SHUTDOWN NOSAVE`. Cannot kill a script that has already written to data (would leave DB inconsistent). Prevention: never loop with unbounded iteration in Lua. Scripts must be **deterministic** — same inputs → same outputs. No random, no clock reads, no external I/O.

> 🌍 **Real-World:** Twitter uses Redis Lua scripting for their distributed rate limiter — the Lua script atomically checks the current count, increments it, sets the TTL on first increment, and returns allowed/denied in a single atomic operation. The Lua approach replaced a WATCH/MULTI/EXEC-based CAS loop that required ~3 round trips and occasional retries under contention. The Lua script completes in one round trip and is guaranteed atomic, handling Twitter's 500K+ API calls per second without a single retry.

### 11.4 Pub/Sub

**What it is:** A message broadcast mechanism. Publishers send messages to channels. Subscribers receive messages from channels they've subscribed to.

#### Pub/Sub Commands

```redis
SUBSCRIBE channel [channel ...]    -- client enters subscribe mode
PSUBSCRIBE pattern [pattern ...]   -- subscribe to pattern (glob: news.*)
PUBLISH channel message            -- returns number of subscribers who received it
UNSUBSCRIBE [channel ...]
PUNSUBSCRIBE [pattern ...]
```

**Characteristics:**
- **Fire and forget:** if no subscribers, message is discarded
- **No persistence:** messages not stored — subscriber must be connected at publish time
- **No acknowledgment:** publisher doesn't know if anyone received the message
- Once a client sends `SUBSCRIBE`, it's in subscribe mode. It can only send `SUBSCRIBE`, `PSUBSCRIBE`, `UNSUBSCRIBE`, `PUNSUBSCRIBE`, `PING`. Cannot mix regular commands.

#### Pub/Sub vs Streams

| Feature | Pub/Sub | Streams |
|---------|---------|---------|
| Persistence | No | Yes |
| Consumer groups | No | Yes |
| Delivery guarantee | None | At-least-once with ACK |
| Replay history | No | From any message ID |
| Subscriber offline | Message lost | Message waits |
| Best for | Real-time broadcast, fan-out | Reliable event queuing |

> **📖 Real-World Example:** **Production use:** Real-time notifications (chat rooms, live dashboards, invalidation signals for client-side caching), not for reliable event queuing.

> 🌍 **Real-World:** Slack uses Redis Pub/Sub for real-time message delivery within a workspace — when you send a message, it's `PUBLISH`-ed to a channel like `workspace:T123:channel:C456`. All connected clients subscribed to that channel receive the message instantly. Slack pairs this with their persistent message store (database) — Pub/Sub handles the real-time fan-out (fire-and-forget is fine since the client will fetch missed messages from the DB on reconnect), while the DB handles durability.

---

## PART 12 — ADVANCED PRODUCTION PATTERNS

### 12.1 Distributed Lock (Redlock)

**Simple lock (single node):**

```redis
SET lock:resource unique_id NX EX 30
```

- `NX`: only set if not exists
- `EX 30`: expire in 30 seconds (in case lock holder dies)
- `unique_id`: UUID per lock acquisition (so only the holder can unlock)
- Release: Lua script (check + delete atomically):

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
```

**Redlock (multi-node):**
For stronger guarantees, acquire lock on N independent Redis instances (N=5):
1. Record current time
2. Try to acquire lock on all 5 nodes with timeout (e.g., 10ms per node)
3. Lock is acquired if: got it on at least 3 nodes (majority) AND elapsed time < lock TTL
4. Release: send release to all 5 nodes (even ones where acquisition failed)

> **⚠️ Production Gotcha:** **Redlock controversy:** Martin Kleppmann argued Redlock doesn't provide strong safety guarantees due to clock drift and GC pauses. Antirez (Redis creator) disagrees. The consensus: Redlock is fine for "efficiency" locks (avoid redundant work) but not for "safety" locks (preventing corruption). For true safety, use **fencing tokens** (monotonically increasing token with each lock acquisition, and your storage system rejects requests with stale tokens).

> 🌍 **Real-World:** Shopify uses Redis-based distributed locks (single-node, not Redlock) to prevent double-processing of Stripe webhook events. When a webhook arrives, `SET webhook:evt_abc123 processing NX EX 300` — if it returns nil (lock exists), the webhook is a duplicate and discarded. The single-node approach is intentional: they accept the theoretical risk of duplicate processing if the Redis master fails at exactly the wrong moment (which is extremely rare) in exchange for the operational simplicity of not running 5 independent Redis nodes just for locking.

### 12.2 Rate Limiter (Redis-based)

**Simple fixed window counter:**

```lua
-- KEYS[1] = rate:limit:user:123:minute:20240101120000
-- ARGV[1] = max_requests (e.g., 100)
-- ARGV[2] = window_seconds (e.g., 60)
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
    return 0  -- rate limited
end
return 1  -- allowed
```

**Sliding window log (Sorted Set):**

```lua
-- Each request adds a timestamp to a sorted set, prune old entries
local now = tonumber(ARGV[1])  -- current timestamp ms
local window = tonumber(ARGV[2])  -- window in ms (e.g., 60000)
local max = tonumber(ARGV[3])
local key = KEYS[1]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count < max then
    redis.call('ZADD', key, now, now)  -- score=timestamp, member=timestamp
    redis.call('EXPIRE', key, math.ceil(window/1000) + 1)
    return 1  -- allowed
end
return 0  -- rate limited
```

**Token bucket:** Harder to implement in pure Redis atomically without Lua. Store `{tokens, last_refill_time}` in a hash, use Lua to implement refill + consume atomically.

> 🌍 **Real-World:** Stripe's API rate limiter uses Redis sorted sets with sliding windows — each API key has a ZSet where each request adds `ZADD ratelimit:key:abc timestamp timestamp`. `ZREMRANGEBYSCORE` prunes entries older than the window, and `ZCARD` gives the current count. This gives Stripe accurate per-second and per-minute limits without the boundary artifacts of fixed-window counting (e.g., a user can't make 100 requests in the last second of minute 1 and 100 more in the first second of minute 2 by exploiting a fixed-window reset).

### 12.3 Session Store

Redis is the canonical session store because:
- TTL-based session expiry (`EXPIRE session:abc 3600`)
- Fast O(1) reads
- Easily shared across multiple app server instances (stateless app servers)
- Supports complex session data (hash type: `HSET session:abc user_id 123 cart_size 5`)

**Pattern:**

```python
# On login:
session_id = uuid()
redis.hset(f"session:{session_id}", "user_id", user_id, "created_at", now())
redis.expire(f"session:{session_id}", 3600)
set_cookie("session_id", session_id)

# On each request:
user_id = redis.hget(f"session:{cookie.session_id}", "user_id")

# Sliding expiry (reset TTL on each request):
redis.expire(f"session:{session_id}", 3600)
```

> 🌍 **Real-World:** GitHub uses Redis as its session store for all GitHub.com web traffic. When you log into GitHub, your session data (user ID, CSRF token, feature flags) is stored in Redis with a sliding expiration. With 100M+ registered users and millions of concurrent sessions, Redis stores active sessions entirely in memory — a session lookup is a single `HGETALL session:uuid` taking ~0.1ms, vs. a database session query that would take 5–20ms and couldn't handle the concurrent load without massive infrastructure.

---

## PART 13 — QUICK REFERENCE

### Memory Info

```redis
redis-cli INFO memory
# used_memory: bytes Redis allocated (used_memory_human for human-readable)
# used_memory_rss: bytes OS reports (includes fragmentation)
# mem_fragmentation_ratio: rss / used_memory (>1.5 = fragmented; <1 = using swap)
# mem_allocator: libc / jemalloc / tcmalloc
```

### Latency Monitoring

```redis
CONFIG SET latency-monitor-threshold 100  # log commands taking > 100ms
LATENCY LATEST                            # recent latency events
LATENCY HISTORY event                     # history of latency events
LATENCY RESET                             # reset stats

CONFIG SET slowlog-log-slower-than 10000  # log commands > 10ms (microseconds)
SLOWLOG GET [n]                           # recent slow commands
SLOWLOG LEN
```

> 🌍 **Real-World:** Datadog's Redis integration collects `SLOWLOG GET` output and surfaces it as a latency histogram in their dashboard. When Pinterest's Redis slowlog showed `HGETALL` taking 80ms on a hash with 50,000 fields (a user who had pinned extensively), their on-call engineer used the slowlog timestamp to correlate it with a user-visible latency spike on the profile page — identifying the specific anti-pattern (`HGETALL` on unbounded hashes) within minutes using slowlog data.

### Key Expiry Internals

Redis uses a combination of:
1. **Lazy expiry:** When a key is accessed, check its TTL. If expired, delete it and return nil. Zero overhead for non-expired keys.
2. **Active expiry:** A timer callback runs 10 times/second (`hz` config, default 10). Each run:
   - Sample 20 random keys from the expires dict
   - Delete expired ones
   - If > 25% of sampled keys were expired, repeat immediately (up to a time limit)

> **⚠️ Production Gotcha:** A key may live past its TTL until it's accessed or the active scan reaches it. Don't rely on sub-second TTL precision.

> 🌍 **Real-World:** Robinhood discovered this TTL imprecision during their options expiry workflows — they used Redis TTL as a trigger for options contract expiry events, assuming a key would expire within milliseconds of its TTL. Under high load (many simultaneous expiries), the active expiry scan fell behind, and some options contracts appeared "not expired" in Redis for up to 15 seconds past their TTL. They switched to storing expiry timestamps in the value and checking `if stored_expiry < now()` in application code, making the 15-second scan delay irrelevant to business logic.

### Keyspace Notifications

```redis
CONFIG SET notify-keyspace-events KEA  # K=keyspace, E=keyevent, A=all commands
# Subscribe to all expired events:
PSUBSCRIBE __keyevent@0__:expired
```

Use cases: invalidate local caches, trigger workflows on TTL expiry.

> 🌍 **Real-World:** Twilio uses Redis keyspace notifications for their SMS delivery timeout system. When an SMS message is queued, they `SET sms:msg_id pending EX 300` (5-minute delivery window). Their delivery tracking service subscribes to `__keyevent@0__:expired` notifications — when a message's key expires without being acknowledged as delivered, the notification fires a webhook to the customer indicating delivery timeout. This avoids polling the database for undelivered messages every 5 seconds across millions of in-flight messages.

### CONFIG and INFO categories

```redis
redis-cli INFO all          # all info sections
redis-cli INFO server       # version, OS, uptime
redis-cli INFO clients      # connected_clients, blocked_clients
redis-cli INFO stats        # total_commands_processed, keyspace_hits/misses
redis-cli INFO replication  # role, master_replid, master_repl_offset
redis-cli INFO keyspace     # per-database key count and TTL counts
```

> **💡 Key Insight:** **Keyspace hit rate = hits / (hits + misses)** — target > 90%. Low hit rate means your caching strategy isn't working (keys evicted too fast, TTL too short, wrong keys cached).

> 🌍 **Real-World:** Cloudflare's Redis monitoring dashboards track `keyspace_hits / (keyspace_hits + keyspace_misses)` per Redis cluster as a primary SLI (Service Level Indicator). A drop in hit rate from their baseline of 97% to below 92% automatically triggers a PagerDuty alert — this early-warning metric catches cache misconfigurations, memory pressure, and unexpected traffic pattern shifts before they cause latency degradation visible to end users.

---

## PART 14 — SENIOR-LEVEL TRADEOFFS AND DESIGN DECISIONS

### Why Single-Threaded Was the Right Choice at Redis's Founding

In 2009, the alternative was to add fine-grained locking to enable multi-threaded command execution. The problems:
- **Every data structure operation would need locks.** A `ZADD` touching both a Dict and a SkipList would need to hold two locks, risking deadlock.
- **Lock overhead.** A mutex lock/unlock is 20-100ns. An INCR command is ~100ns. Adding locking would double command execution time.
- **Correctness complexity.** Redis has ~200 commands touching complex nested structures. Getting the locking right for all edge cases is very difficult.

The single-threaded model gave Redis correctness for free and was fast enough for most use cases. The bottleneck (network) justified it.

> 🌍 **Real-World:** Memcached chose multi-threading for its in-memory cache (released 2003, 6 years before Redis). The benchmark result: Memcached is slightly faster per-core for pure GET/SET workloads, but Redis's single-threaded model eliminates lock-induced tail latency — at Pinterest, switching from Memcached to Redis for their notification feed reduced P99 latency from 8ms to 1.2ms, even though P50 latency was similar. The tail latency improvement came from eliminating Memcached's mutex contention under concurrent load.

### Why 16,384 Slots and Not More

If Redis Cluster used 1M slots:
- Each gossip message would contain a 1M-bit = 125KB bitmap just to describe slot coverage
- With 100 nodes and 100 gossip messages/sec = 1.25 GB/sec of gossip traffic — untenable

16,384 slots = 2KB bitmap per message. Manageable.

### Why AOF appendfsync everysec Is the Default

| Mode | Throughput | Data Loss | Use Case |
|------|-----------|-----------|----------|
| `always` | ~1,000 writes/sec | 0 | Critical financial systems |
| `everysec` | ~100,000 writes/sec | ≤1 second | Most web apps (default) |
| `no` | Maximum | Up to 30s | Performance-critical, loss-tolerant |

> **💡 Key Insight:** The choice of `everysec` as default is a practical engineering tradeoff: "1 second of data loss is acceptable for most applications, and the 100× performance improvement over `always` is significant."

> 🌍 **Real-World:** Ramp (corporate spend management) uses AOF `appendfsync always` for their Redis instance storing pending transaction approval states — a payment approval that disappears due to Redis data loss would be a serious financial incident. The ~1,000 writes/sec limit is acceptable because approval events are infrequent. For their high-volume analytics pipeline Redis instance (millions of writes/sec), they use `appendfsync no` — analytics data can be regenerated from source-of-truth databases if lost.

### Why Redis Doesn't Use a B-Tree

**B-Trees** are designed for disk-based storage where random I/O is expensive and sequential I/O is cheap. They minimize disk seeks by packing many keys per node (one disk block = one B-tree node).

Redis lives entirely in RAM where:
- Random access is uniform (no seek cost)
- Cache line (64 bytes) is the unit of performance, not disk block (4-16KB)
- Hash tables with O(1) average access outperform B-trees with O(log N) for point lookups
- SkipLists with O(log N) range queries are simpler to implement than B-trees and cache-friendly enough for RAM

### Redis vs Memcached

| Feature | Redis | Memcached |
|---------|-------|-----------|
| Data types | 10+ rich types | String only |
| Persistence | RDB + AOF | None |
| Replication | Built-in | None (client-side sharding) |
| Cluster | Built-in | None |
| Lua scripting | Yes | No |
| Pub/Sub | Yes | No |
| Memory efficiency | Good (various encodings) | Good (slab allocator) |
| Threading | Single (+ I/O threads 6.0+) | Multi-threaded |
| Atomic operations | Rich (INCR, ZADD, etc.) | Basic (INCR/DECR) |

**When Memcached might still be chosen:**
- You need nothing but simple string caching and want the absolute simplest operational setup
- Multi-threaded performance is critical (though Redis 6+ narrows this gap)
- In practice, Redis has largely replaced Memcached in new systems

> 🌍 **Real-World:** Facebook still runs one of the largest Memcached deployments in the world (thousands of servers) for their social graph cache — they chose Memcached because their use case is pure string key-value caching at extreme scale and they built their own replication, sharding, and monitoring on top. For everyone else building new systems today, Redis's richer feature set (Sorted Sets for feed ranking, Pub/Sub for real-time features, Streams for event queuing, built-in clustering) makes it the default choice — Facebook's Memcached deployment is a legacy of Memcached predating Redis, not a recommendation.

### Lazy Free (UNLINK command)

`DEL` is synchronous: it deletes the key and frees memory in the main thread. For large data structures (a hash with 1M fields), this blocks the event loop for milliseconds.

`UNLINK` (Redis 4.0+): logically deletes the key immediately (so other clients can't see it), then frees the memory asynchronously in a background thread.

**Other lazy free operations:**

```text
lazyfree-lazy-eviction yes      # eviction uses async free
lazyfree-lazy-expire yes        # TTL expiry uses async free
lazyfree-lazy-server-del yes    # implicit deletes (RENAME, RESTORE) use async free
replica-lazy-flush yes          # FLUSHDB during full sync uses async free
```

> **⚠️ Production Gotcha:** For production systems with large data structures, enabling lazy free is recommended to avoid latency spikes.

> 🌍 **Real-World:** Before `UNLINK` existed, WeChat's Redis-based friend graph cache experienced periodic 200ms+ latency spikes when `DEL` was called on a user's friend list (some users had 100K+ friends, stored as a large ZSet). The main thread blocked during memory deallocation. After upgrading to Redis 4.0 and switching to `UNLINK`, the deallocation moved to a background thread — latency spikes disappeared entirely. WeChat also enabled all `lazyfree-lazy-*` options to ensure eviction-triggered deletes were also non-blocking.

---

## PRODUCTION PATTERNS — ADVANCED (Redis 7.x + Combined Data Structure Patterns)

### HZSET Pattern — Hash + ZSet Combined (Leaderboard with Metadata)

**What "HZSET" means**: Not a Redis command but a widely-used production pattern combining a **Sorted Set (ZSet)** for ranking and a **Hash** for storing rich metadata. Together they solve a problem neither can solve alone.

**The Problem**:
- ZSet can rank users by score, but stores only `(score, member)` — no metadata
- Hash can store user profiles, but has no ordering / ranking capability
- You need BOTH: top 100 players by score AND their username, avatar, country

**The Pattern**:

```text
ZSet key:  "leaderboard:global"       → member=user_id, score=points
Hash key:  "user:{user_id}:profile"   → fields: name, avatar, country, level
```

**Commands**:

```redis
# Add/update a user's score
ZADD leaderboard:global 9500 "user:1001"
ZADD leaderboard:global 8800 "user:1002"
ZADD leaderboard:global 7200 "user:1003"

# Store user metadata in a Hash
HSET user:1001:profile name "Alice" avatar "alice.png" country "IN" level 42
HSET user:1002:profile name "Bob"   avatar "bob.png"   country "US" level 38

# Get top 10 by score (highest first)
ZREVRANGE leaderboard:global 0 9 WITHSCORES
# Returns: ["user:1001", "9500", "user:1002", "8800", ...]

# Get user's rank (0-indexed, lower = better in ZRANK)
ZREVRANK leaderboard:global "user:1001"  → 0 (1st place)

# Get user's score
ZSCORE leaderboard:global "user:1001"   → "9500"

# Increment a user's score atomically
ZINCRBY leaderboard:global 150 "user:1001"  → "9650"
```

**Fetching top 10 with metadata (Pipeline)**:

```python
# Step 1: get top 10 user IDs from ZSet
top_users = redis.zrevrange("leaderboard:global", 0, 9)
# ["user:1001", "user:1002", ..., "user:1010"]

# Step 2: pipeline HGETALL for each user (1 round-trip for all)
pipe = redis.pipeline()
for user_id in top_users:
    pipe.hgetall(f"{user_id}:profile")
profiles = pipe.execute()

# Step 3: merge
leaderboard = []
for i, user_id in enumerate(top_users):
    leaderboard.append({
        "rank": i + 1,
        "user_id": user_id,
        "score": redis.zscore("leaderboard:global", user_id),
        **profiles[i]
    })
```

**Atomic score update + metadata update (Lua)**:

```lua
-- KEYS[1] = leaderboard ZSet, KEYS[2] = user hash
-- ARGV[1] = user_id, ARGV[2] = score_delta, ARGV[3] = field, ARGV[4] = value
local new_score = redis.call('ZINCRBY', KEYS[1], ARGV[2], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[3], ARGV[4])
return new_score
```

**Real-world usage**:

| Pattern | ZSet Role | Hash Role |
|---------|-----------|-----------|
| Game leaderboard | Global rank by points | Username, avatar, level |
| Job queue priority | Priority score | Job payload and metadata |
| Social feed ranking | Feed item relevance score | Post content and metadata |
| Rate limit tracking | Request timestamps | User limits per endpoint |
| Product catalog | Price/relevance score | Product details and images |

> 🌍 **Real-World:** Riot Games uses the HZSET pattern for the League of Legends ranked ladder — the ZSet holds all 150M+ player account IDs with their LP (League Points) as the score, while a Hash per player stores their summoner name, champion mastery, and tier/division. `ZREVRANK leaderboard:global player:uuid` gives rank in O(log N), while `HGETALL player:uuid:profile` fetches the display data. The top 200 players' profiles are aggressively cached with a 5-second TTL since the leaderboard page for Challenger tier is viewed millions of times per day.

**Segmented Leaderboards**:

```redis
-- Multiple independent leaderboards
-- leaderboard:global           → all users
-- leaderboard:country:IN       → India only
-- leaderboard:weekly:2024-W47  → this week's scores

-- Add to multiple leaderboards atomically with MULTI/EXEC
MULTI
ZINCRBY leaderboard:global       150 "user:1001"
ZINCRBY leaderboard:country:IN   150 "user:1001"
ZINCRBY leaderboard:weekly:2024  150 "user:1001"
EXEC
```

> **💡 Key Insight:** **Memory estimate**: 1M users × (ZSet entry ~50 bytes + Hash ~200 bytes) ≈ 250MB — fits comfortably in Redis.

---

### Redis FUNCTION / FCALL (Redis 7.0+)

**Why FUNCTION over EVAL (Lua scripts)**:

| Feature | EVAL | FUNCTION (7.0+) |
|---------|------|-----------------|
| Script body | Sent every call | Loaded once, called by name |
| Persistence | No (in-memory only) | Yes (in AOF/RDB) |
| Library concept | No | Yes (group functions) |
| Script cache | SHA1 cache (EVALSHA) | Built-in by name |
| Cluster routing | Script runs locally | FCALL routes by key |

**Creating a Function Library**:

```lua
-- Load with: FUNCTION LOAD REPLACE <code>
#!lua name=mylib

-- Atomic leaderboard update function
local function update_score(keys, args)
    local leaderboard = keys[1]
    local user_hash   = keys[2]
    local user_id     = args[1]
    local delta       = tonumber(args[2])
    local new_score   = redis.call('ZINCRBY', leaderboard, delta, user_id)
    redis.call('HSET', user_hash, 'last_updated', redis.call('TIME')[1])
    return new_score
end

redis.register_function('update_score', update_score)
```

**Loading and calling**:

```redis
# Load (one time, or on deploy)
FUNCTION LOAD REPLACE "#!lua name=mylib\n..."

# Call the function
FCALL update_score 2 leaderboard:global user:1001:profile user:1001 150

# List loaded functions
FUNCTION LIST

# Delete a library
FUNCTION DELETE mylib

# Dump all functions (for backup/restore)
FUNCTION DUMP -- returns binary blob
FUNCTION RESTORE <blob>
```

> 🌍 **Real-World:** Upstash (serverless Redis) migrated their customer-facing analytics functions from `EVALSHA` to Redis FUNCTION in their Redis 7.0 upgrade. The key benefit for their use case: FUNCTION persists through AOF/RDB, so when a customer's Redis instance is restored from backup, their registered functions are also restored — no need for their application to re-register scripts on startup. For Upstash's serverless model where Redis instances may start/stop frequently, this persistence guarantee dramatically simplified their client initialization logic.

---

### Redis Streams — Consumer Groups (Deep Dive)

**Stream vs Pub/Sub**:

| Feature | Streams | Pub/Sub |
|---------|---------|---------|
| Message storage | Persistent | Fire-and-forget |
| Consumer offline | Messages wait | Messages lost |
| Delivery tracking | PEL (pending entries list) | None |
| Retry on failure | Yes (via XCLAIM) | No |

**Key Commands**:

```redis
# Produce: add message to stream
XADD orders * user_id 1001 product_id 5 qty 2
# Returns auto-generated ID: "1699000000000-0" (timestamp-sequence)

# Consume: read new messages (blocking)
XREAD COUNT 10 BLOCK 1000 STREAMS orders $
# $ means: only messages arriving after this XREAD call

# Consumer Group: multiple consumers sharing work
XGROUP CREATE orders order-processor $ MKSTREAM

# Read as a consumer in a group (each message goes to ONE consumer)
XREADGROUP GROUP order-processor consumer-1 COUNT 10 BLOCK 1000 STREAMS orders >
# > means: undelivered messages for this group

# Acknowledge processed message (remove from PEL)
XACK orders order-processor 1699000000000-0

# Check pending messages (delivered but not acknowledged)
XPENDING orders order-processor - + 10
# Shows: message ID, consumer name, idle time, delivery count

# Re-claim stuck messages (consumer failed mid-processing)
XCLAIM orders order-processor consumer-2 60000 1699000000000-0
# Transfer ownership of message idle > 60s to consumer-2
```

**Exactly-Once Pattern with Streams**:

```text
1. Consumer reads message (XREADGROUP)
2. Consumer processes message (writes to DB with idempotency key)
3. If processing succeeds: XACK → message removed from PEL
4. If processing fails: message stays in PEL
5. Monitor PEL with XPENDING → re-claim stuck messages with XCLAIM
6. If delivery count > N (poison pill): move to dead-letter stream

# Dead-letter stream pattern
XPENDING returns delivery_count
If delivery_count > 3:
    XADD dead-letter-orders * original_id <id> reason "max_retries"
    XACK orders order-processor <id>  # remove from main stream
```

**Stream vs Kafka**:

| Feature | Redis Streams | Kafka |
|---------|---------------|-------|
| Storage | In-memory (with persistence) | Disk-based sequential I/O |
| Latency | Lower | Higher |
| Throughput | Lower | Higher (millions/sec) |
| Retention | Configurable MAXLEN | Configurable retention period |
| Best for | Real-time event processing, task queues, IoT telemetry | High-volume pipelines, audit logs, event sourcing |

> 🌍 **Real-World:** Brex (corporate card fintech) uses Redis Streams as a lightweight task queue for their transaction enrichment pipeline. When a transaction arrives, it's `XADD`-ed to a stream. A consumer group of 10 worker processes uses `XREADGROUP` to claim transactions, enrich them with merchant data, and `XACK` on success. Unacknowledged transactions (worker crash mid-processing) are detected via `XPENDING` after 60 seconds and `XCLAIM`-ed to another worker. For Brex's volume (~1M transactions/day), Redis Streams provides Kafka-like reliability at a fraction of the operational overhead.

---

### Redis Client-Side Caching (RESP3 Tracking)

**What it is**: Redis 6.0+ supports **client-side caching** where Redis notifies the client when a cached key changes, so the client can invalidate its local copy.

**Two modes**:

```redis
-- 1. Default (opt-in):
CLIENT TRACKING ON
GET user:1001         -- Redis remembers client is watching this key
-- (on another client):  SET user:1001 newvalue
-- (Redis sends to first client): invalidate user:1001

-- 2. Broadcasting (opt-out):
CLIENT TRACKING ON BCAST PREFIX user:
-- Invalidations sent for ALL keys matching prefix user:
-- No server memory used for tracking per-client keys
```

> **💡 Key Insight:** **Benefits**: Eliminates Redis round-trip for hot read paths. App-level L1 cache stays fresh automatically.

> **⚠️ Production Gotcha:** Only practical with **RESP3** protocol and client library support (Lettuce for Java, go-redis 8.x+).

> 🌍 **Real-World:** Snapchat uses client-side caching (RESP3 broadcasting mode) for their user settings and feature flags. Their Go services use `CLIENT TRACKING ON BCAST PREFIX settings:` — when a user changes their privacy settings, the `SET settings:user:12345 {...}` triggers invalidation push messages to all application servers currently caching that key. Each server's in-process cache is immediately invalidated, ensuring the new setting takes effect globally within milliseconds without polling Redis on every request. Before this feature, they polled Redis every 5 seconds for settings changes, generating millions of unnecessary reads per minute.


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Redis)

| # | Concept | Why it matters | Done |
|---|---------|----------------|------|
| 1 | Single-threaded command execution (+ I/O threads) | Throughput mental model | [ ] |
| 2 | Data type → encoding (ziplist/listpack/skiplist/hashtable) | Memory + latency | [ ] |
| 3 | Persistence: RDB vs AOF vs hybrid; fork/COW cost | Durability vs latency | [ ] |
| 4 | Replication + WAIT; async by default | Data loss on failover | [ ] |
| 5 | Cluster: 16384 slots, MOVED/ASK | Scaling Redis | [ ] |
| 6 | Eviction policies (approx LRU) | Cache correctness | [ ] |
| 7 | Pipelining vs Lua atomicity | Perf + correctness | [ ] |
| 8 | Cache-aside + stampede prevention | Classic HLD deep dive | [ ] |
| 9 | Distributed lock + fencing token | Never use SET NX alone | [ ] |
| 10 | Hot keys / big keys | Production SEVs | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Redis is not strongly durable by default — design for what you lose on crash/failover.

---

## 🛠️ PRACTICAL — Redis Labs

### Lab 1: Cache-Aside + Stampede
```text
1. Implement get(key): cache miss → DB → SETEX
2. Simulate 100 concurrent misses on same key
3. Add singleflight/mutex so only one DB load happens
4. Measure DB query count before/after
```

### Lab 2: Sliding Window Rate Limit (Lua)
Write a Redis Lua script for sliding window rate limiting. Explain why Lua is required for atomicity.

### Lab 3: Cluster Mental Model
On paper: key `user:42` → CRC16 → slot → node. Explain hash tags `{user:42}:cart` vs `{user:42}:session`.

### Lab 4: Interview Qs
1. Why not use `KEYS *` in prod?
2. What happens if master dies before replica ACK?
3. When prefer Redis vs Memcached vs local Caffeine?
