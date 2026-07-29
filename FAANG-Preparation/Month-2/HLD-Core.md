# High Level Design — Complete Study Notes

> **Self-contained. No internet needed.**
> Covers: API Design → Load Balancing → Caching → Messaging → Database Scaling → Real-Time → Security

---

## Table of Contents

| # | Topic | Key Concepts |
|---|-------|--------------|
| 1 | [API Design Basics](#1-api-design-basics) | REST, HTTP verbs, status codes |
| 2 | [HTTP Verbs & Status Codes](#2-http-verbs-and-status-codes) | 200/201/204, 4xx/5xx, error format |
| 3 | [Pagination](#3-pagination) | Cursor-based, offset, page drift |
| 4 | [API Versioning](#4-api-versioning) | URL versioning, Sunset headers |
| 5 | [REST vs gRPC vs GraphQL](#5-rest-vs-grpc-vs-graphql) | Protobuf, streaming, N+1 problem |
| 6 | [API Gateway](#6-api-gateway) | Auth, rate limiting, routing |
| 7 | [CDN](#7-cdn) | Cache-Control headers, ETags, edge caching |
| 8 | [Load Balancing](#8-load-balancing) | L4 vs L7, algorithms, sticky sessions |
| 9 | [Message Queues](#9-message-queues) | Kafka vs RabbitMQ vs SQS, DLQ |
| 10 | [Database Scaling](#10-database-scaling-patterns) | Read replicas, sharding, PgBouncer |
| 11 | [Caching Strategies](#11-caching-strategies) | Levels, invalidation, stampede fix |
| 12 | [Capacity Estimation](#12-capacity-estimation) | Key numbers, formulas |
| 13 | [System Design Framework](#13-system-design-framework) | 45-min interview template |
| 14 | [URL Shortener Design](#14-url-shortener-design) | Snowflake ID, 302 redirect, Redis cache |
| 15 | [Real-Time Communication](#15-real-time-communication-patterns) | Long polling, SSE, WebSockets at scale |
| 16 | [Distributed ID Generation](#16-distributed-id-generation) | Snowflake, ULID, when to use each |
| 17 | [Service Discovery](#17-service-discovery) | Eureka, Consul, Kubernetes DNS |
| 18 | [Consistent Hashing](#18-consistent-hashing-deep-dive) | Ring, virtual nodes, DynamoDB/Cassandra |
| 19 | [API Security](#19-api-security-patterns) | JWT, OAuth2 Authorization Code Flow |
| 20 | [Proxy vs Reverse Proxy](#20-proxy-vs-reverse-proxy) | Nginx config, SSL termination, API Gateway |
| 21 | [Microservices Patterns](#21-microservices-patterns) | Circuit breaker, retry+jitter, Saga |
| 22 | [Twitter/Instagram Feed](#22-twitterinstagram-feed-design) | Fan-out on write/read, hybrid, ML ranking |
| 23 | [Capacity Worksheet (5 examples)](#capacity-estimation-worksheet-5-worked-examples) | Worked QPS/storage drills |
| 24 | [API + Schema Templates](#api--schema-templates-copy-into-interviews) | REST/SQL/Redis skeletons |
| 25 | [Failure Drill Checklist](#failure-drill-checklist-run-for-every-design) | Every design endgame |
| 26 | [Important Concepts Checklist](#important-concepts-checklist--hld-core) | Self-test |
| 27 | [Twitter Feed 45-min Lab](#️-practical-redesign-twitter-feed-in-45-min-timer-checklist) | Timed mock |

---

## 1. API Design Basics

### What an API Is
An API is a contract between client and server defining how they communicate. Good API design means:
- Clear, predictable behavior
- Easy to use correctly, hard to use incorrectly
- Evolvable without breaking clients

### REST Principles (Roy Fielding, 2000)
REST is an architectural style, not a standard. Key constraints:

| Principle | Description |
|-----------|-------------|
| **Uniform Interface** | Resources identified by URIs, manipulated via representations |
| **Stateless** | Each request carries all needed info — no server-side session |
| **Client-Server** | UI and data storage evolve independently |
| **Cacheable** | Responses declare whether cacheable |
| **Layered System** | Client doesn't know if talking to origin, LB, or cache |

> 🌍 **Real-World:** Stripe's REST API is the industry benchmark for clean API design — every resource has a predictable URL shape (`/v1/customers/{id}/subscriptions`), all responses include a `request_id` for support tracing, and error objects have machine-readable `code` fields, making client error handling deterministic.

---

## 2. HTTP Verbs and Status Codes

### HTTP Verbs

| Verb | Semantics | Safe? | Idempotent? |
|------|-----------|-------|-------------|
| `GET` | Read resource | Yes | Yes |
| `POST` | Create or trigger action | No | No |
| `PUT` | Full replace | No | Yes |
| `PATCH` | Partial update | No | Yes (if correct) |
| `DELETE` | Remove | No | Yes |
| `HEAD` | Like GET but no body | Yes | Yes |
| `OPTIONS` | List allowed methods (CORS preflight) | Yes | Yes |

### Resource Design Rules
```text
✅ Good:
GET    /users                → list users
POST   /users                → create user
GET    /users/123            → get specific user
PUT    /users/123            → full replace
PATCH  /users/123            → partial update
DELETE /users/123            → delete
GET    /users/123/orders     → user's orders (nested resource)
POST   /orders/456/cancel    → action as nested resource

❌ Bad:
GET  /getUser?id=123         → verb in path
POST /deleteUser/123         → wrong method
```

### HTTP Status Codes

| Range | Code | Meaning |
|-------|------|---------|
| **2xx** | 200 OK | GET, PUT, PATCH success with body |
| | 201 Created | POST success — include `Location` header |
| | 204 No Content | DELETE success — no body |
| | 206 Partial Content | Range request (file download resumption) |
| **3xx** | 301 Moved Permanently | URL permanently changed (browser caches) |
| | 302 Found | Temporary redirect — don't cache |
| | 304 Not Modified | ETag/Last-Modified match, reuse cache |
| **4xx** | 400 Bad Request | Malformed syntax, validation error |
| | 401 Unauthorized | Not authenticated |
| | 403 Forbidden | Authenticated but not authorized |
| | 404 Not Found | Resource doesn't exist |
| | 409 Conflict | State conflict (duplicate create, optimistic lock) |
| | 422 Unprocessable | Semantic validation error |
| | 429 Too Many Requests | Rate limited — include `Retry-After` header |
| **5xx** | 500 Internal Server Error | Unexpected bug |
| | 502 Bad Gateway | Upstream returned invalid response |
| | 503 Service Unavailable | Overloaded or maintenance |
| | 504 Gateway Timeout | Upstream timed out |

> 🌍 **Real-World:** GitHub's API returns `429 Too Many Requests` with a `Retry-After` and `X-RateLimit-Reset` header — unauthenticated callers get 60 req/hr, authenticated get 5,000 req/hr. Their API uses `409 Conflict` when you try to create a repository that already exists, letting clients distinguish "bad input" from "duplicate resource" without string-matching error messages.

### Standard Error Response Format
```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Account balance too low",
    "details": [{"field": "amount", "issue": "exceeds available balance"}],
    "request_id": "req_abc123"
  }
}
```

---

## 3. Pagination

### Offset Pagination
```sql
-- GET /posts?page=3&per_page=20
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 60;
```

> **⚠️ Problems with offset pagination:**
> - **Page drift**: inserts during pagination → duplicates or skips
> - **Deep offset is slow**: `OFFSET 10M` forces DB to scan and discard 10M rows
> - `COUNT(*)` for `total_pages` is expensive on large tables

### Cursor Pagination (Production-Grade)
```text
First page: GET /posts?limit=20
Next page:  GET /posts?after=<cursor>&limit=20

cursor = base64(last_item_sort_key)
```

```sql
SELECT * FROM posts
WHERE (created_at, id) < (:cursor_ts, :cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

```json
{
  "data": ["..."],
  "pagination": {
    "has_next": true,
    "next_cursor": "eyJjcmVhdGVkX2F0IjoiMjAyNC0..."
  }
}
```

> **💡 Why cursor pagination is better:**
> O(log n) regardless of depth (index seek, not scan). No page drift. Works with infinite scroll.
> **Tradeoff**: Can't jump to an arbitrary page number.

> 🌍 **Real-World:** Twitter's timeline API uses cursor-based pagination via `max_id` and `since_id` parameters — when you scroll down your timeline, each fetch sends the last tweet's ID as the cursor, ensuring zero duplicates or skips even as new tweets are posted in real time. The Slack API similarly uses a `cursor` token for paginating through message history, allowing infinite scroll without the page-drift problem that plagued their earlier offset-based approach.

---

## 4. API Versioning

### URL Versioning (Most Common)
```text
/api/v1/users
/api/v2/users

Pros: explicit, easy to test, cache-friendly
Cons: URL not "pure REST"
```

### Deprecation Headers
```http
Sunset: Sat, 01 Jan 2025 00:00:00 GMT
Deprecation: Mon, 01 Jan 2024 00:00:00 GMT
Link: <https://docs.example.com/migration/v1-to-v2>; rel="deprecation"
```

> 🌍 **Real-World:** Stripe has maintained backward-compatible API versioning since 2011 — each API key is pinned to the version it was created on, so old integrations never break even as Stripe ships new versions. Customers can opt into newer versions explicitly, giving them full control of the migration timeline. Twilio uses `Sunset` headers to give developers a 12-month runway before deprecated endpoints are removed, with automated emails to developers whose API keys still hit deprecated routes.

---

## 5. REST vs gRPC vs GraphQL

| Feature | REST | gRPC | GraphQL |
|---------|------|------|---------|
| Protocol | HTTP/1.1 or HTTP/2 | HTTP/2 (binary) | HTTP/1.1 or HTTP/2 |
| Format | JSON (human-readable) | Protocol Buffers (~3x smaller) | JSON |
| Schema | Optional (OpenAPI) | Required (`.proto`) | Required (SDL) |
| Streaming | SSE or WebSocket | Native (server/client/bidi) | Subscriptions |
| Browser support | Yes | Needs gRPC-Web proxy | Yes |
| Best for | Public APIs, mobile, browser | Internal microservices, low latency | Flexible client queries |

### gRPC Example (.proto)
```protobuf
syntax = "proto3";

service OrderService {
    rpc PlaceOrder(PlaceOrderRequest) returns (Order);
    rpc StreamOrderUpdates(OrderID) returns (stream OrderEvent);
}

message PlaceOrderRequest {
    string user_id = 1;
    repeated OrderItem items = 2;
}
```

> **💡 gRPC performance wins:**
> - Protobuf: ~3–10x faster serialization than JSON
> - HTTP/2 multiplexing: eliminates head-of-line blocking
> - Persistent connections: no TCP handshake per request

> 🌍 **Real-World:** Google uses gRPC for nearly all internal service-to-service communication — it was designed at Google to replace their internal Stubby RPC framework. Uber uses gRPC between hundreds of microservices because Protobuf serialization cuts payload sizes by ~60% versus JSON, which matters significantly at their scale of millions of trips per day and saves millions of dollars annually in bandwidth costs.

### GraphQL
```graphql
query {
    user(id: "123") {
        name
        orders(last: 5) { id total }
    }
}
```

> **⚠️ GraphQL gotcha:** N+1 query problem — fix with DataLoader batching. Caching is harder (all requests are POST).

> 🌍 **Real-World:** GitHub migrated its public API from REST to GraphQL (v4) because mobile clients were making 6–10 REST calls per screen load — with GraphQL, one query fetches exactly the nested data needed. Facebook invented GraphQL for the same reason: their News Feed required assembling data from dozens of services, and under-fetching (too many round trips) was their biggest mobile performance bottleneck before GraphQL reduced round trips by 90%.

---

## 6. API Gateway

Single entry point for all clients. Handles cross-cutting concerns:

```text
Client → API Gateway → Microservices

Responsibilities:
  - Auth (JWT validation, API key check)
  - Rate limiting (per user/endpoint)
  - SSL termination
  - Request routing (path-based, header-based)
  - Load balancing
  - Request/response transformation
  - Caching GET responses
  - Distributed tracing (inject trace IDs)
  - Circuit breaking
```

> 🌍 **Real-World:** Netflix's Zuul API Gateway processes over 2 billion requests per day — it handles authentication, dynamic routing, and rate limiting for all client-facing traffic before it reaches any microservice. Uber uses Kong (open-source API Gateway) to enforce per-endpoint rate limits: their driver location update endpoint is throttled independently from the fare calculation endpoint, preventing one noisy service from starving the other and ensuring SLAs are maintained per route.

---

## 7. CDN

```text
User (NYC) → CDN Edge (NYC) → cache hit?  → serve immediately
                             → cache miss → Origin → cache + serve

Benefits: low latency, origin offload, DDoS absorption
```

### Cache-Control Headers
```http
Cache-Control: public, max-age=86400       # CDN caches for 24h
Cache-Control: private, no-cache           # user-specific, revalidate
Cache-Control: no-store                    # never cache (sensitive data)
Cache-Control: s-maxage=3600               # CDN max-age (overrides max-age)
Cache-Control: stale-while-revalidate=60   # serve stale while refreshing

ETag: "abc123"
If-None-Match: "abc123"   →   304 Not Modified
```

> 🌍 **Real-World:** Cloudflare serves over 20% of all internet traffic from its CDN edge nodes — when a static asset is cached at the London PoP, users in the UK get sub-10ms responses instead of 100ms+ to a US origin. Netflix pre-positions movie files at CDN nodes during off-peak hours (Open Connect appliances in ISP data centers) so that the first user to play a title in a city doesn't hit the origin — reducing Netflix's backbone traffic by over 95% and improving buffering rates globally.

---

## 8. Load Balancing

### L4 vs L7

| | L4 (Network LB) | L7 (Application LB) |
|--|-----------------|---------------------|
| Routing by | IP + port | HTTP path/headers/cookies |
| Speed | Faster (no HTTP parsing) | Slower but smarter |
| TLS termination | No | Yes |
| Example | AWS NLB | AWS ALB, Nginx |

### Algorithms

| Algorithm | How it works | Best for |
|-----------|-------------|----------|
| Round Robin | 1→A, 2→B, 3→C, 4→A... | Uniform request cost |
| Weighted RR | A gets 3x traffic of B | Different server capacities |
| Least Connections | Route to server with fewest active connections | Variable request duration |
| IP Hash | `hash(ip)` → always same server | Sticky sessions |

> 🌍 **Real-World:** Discord switched from round-robin to consistent hashing for message routing — adding/removing servers now only remaps ~1/n messages instead of rehashing everything, preventing massive cache invalidation storms when scaling. Google's Maglev load balancer uses consistent hashing with a large lookup table so that any of the hundreds of Maglev instances makes the same routing decision for the same TCP flow without coordination, enabling stateless horizontal scaling of the load balancing tier itself.

---

## 9. Message Queues

### Kafka vs RabbitMQ vs SQS

| Feature | Kafka | RabbitMQ | SQS |
|---------|-------|----------|-----|
| Storage | Log-based (disk, replayable) | Broker (deleted after ack) | Fully managed |
| Throughput | Millions msgs/sec | Moderate | Moderate |
| Ordering | Per-partition | Per-queue (FIFO) | FIFO queues |
| Replay | Yes (seek to any offset) | No | No |
| Best for | Event streaming, CDC, audit log | Task queues, RPC | AWS ecosystem |

> 🌍 **Real-World:** LinkedIn built Kafka to handle 7 trillion messages per day across activity tracking, metrics, and change-data-capture from databases — because messages are persisted on disk as an ordered log, multiple consumer groups (analytics, alerting, search indexing) all read from the same stream independently without interfering with each other. Uber uses Kafka's per-partition ordering to guarantee that driver location updates arrive in sequence to the dispatch service — shuffle-sharding by driver ID ensures one partition handles one driver's complete event stream.

### Dead Letter Queue (DLQ)
Message fails N times → moved to DLQ for inspection.

> **💡 DLQ is essential** for observability and recovery — always configure one in production.

> 🌍 **Real-World:** AWS SQS DLQs are used by Shopify to capture failed order-processing events — rather than losing a failed webhook delivery, the message lands in a DLQ where an on-call engineer can inspect the payload, fix the downstream bug, and replay the messages without any data loss or manual re-entry.

---

## 10. Database Scaling Patterns

### Read Scaling
```text
Read replicas: Primary (writes) → async replication → Replicas (reads)
Risk: replication lag.

Read-your-writes: route read to primary for N seconds after write.
```

**Cache-aside (Redis):**
```text
1. Read cache → hit: return value
2. Cache miss: read DB → write to cache with TTL → return
3. On write to DB: DELETE cache key (don't update — prevents race condition)
```

> 🌍 **Real-World:** Instagram uses read replicas for their PostgreSQL cluster — photo metadata writes go to the primary, while the ~90% of traffic that is reads (profile loads, feed renders) fans out across many replicas. Pinterest routes all reads to replicas with a 500ms read-your-writes window — after a pin is created, the creating user's requests are pinned to the primary for half a second to guarantee they see their own update, avoiding the confusing UX of a "missing" post.

### Write Scaling — Sharding

| Strategy | Pros | Cons |
|----------|------|------|
| **Hash sharding** `hash(user_id) % N` | Even distribution | Cross-shard queries; resharding painful |
| **Range sharding** (by time/alphabetical) | Range queries efficient | Hot shard (all writes to latest range) |
| **Directory sharding** (lookup service) | Flexible, easy to rebalance | Extra hop + SPOF |

> 🌍 **Real-World:** Slack shards its message storage by workspace ID — each workspace's messages land on the same shard, so fetching a channel's history is a single-shard query. Discord shards their message database by channel ID using consistent hashing — a viral channel generating 50,000+ messages/min has shard isolation so that spike doesn't impact other channels' read latency.

### Connection Pool Sizing
```text
HikariCP formula: pool_size = (num_cores × 2) + spindle_count
For 4-core SSD: pool_size = 9 per app instance

10 instances × 100 pool_size = 1,000 connections to Postgres
PostgreSQL default max_connections = 100 → exhaustion!

Fix: PgBouncer between app and Postgres
  App → PgBouncer → fewer DB connections (multiplexed)
```

> **⚠️ Production gotcha:** Never set pool size too high. More connections ≠ more throughput. Each Postgres connection is a process consuming ~5–10 MB RAM.

> 🌍 **Real-World:** Notion runs PgBouncer in transaction-pooling mode in front of all their PostgreSQL instances — their API tier has hundreds of application pods each wanting database connections, but PgBouncer multiplexes them down to a fraction of that at the DB level, cutting PostgreSQL connection overhead from gigabytes to megabytes of RAM while sustaining the same request throughput.

---

## 11. Caching Strategies

### Cache Levels

| Level | Technology | Latency | Scope |
|-------|-----------|---------|-------|
| L1 | In-process (Caffeine, Guava) | < 1 µs | Per-instance only |
| L2 | Distributed (Redis) | ~0.5 ms | Shared across all instances |
| L3 | CDN | ~5–50 ms | Global, static assets |
| L4 | DB buffer (`shared_buffers`) | ~1 ms | Transparent to app |

> 🌍 **Real-World:** Twitter uses a three-level caching hierarchy — an in-process Guava cache for the most frequently accessed tweet objects (L1, sub-microsecond), a Redis cluster for the broader hot set (L2, ~0.5ms), and a CDN for static media assets (L3). Facebook's Memcache deployment spans thousands of servers and handles over a billion cache queries per second — L1 caching with mcrouter client-side coalescing prevents thundering herd by batching duplicate keys across concurrent requests before they even reach the Memcache tier.

### Cache Invalidation
```text
TTL-based:   expires after N seconds. Simple, stale for TTL period.

Event-based: on write → publish event → delete cache key.
Race condition:
  Thread A: cache miss → query DB → gets v1
  Thread B: write v2 → delete cache
  Thread A: writes v1 to cache ← STALE!
Fix: version keys or delayed double-delete.
```

> 🌍 **Real-World:** Facebook's Memcache uses a "lease" mechanism to solve this exact cache invalidation race — on a cache miss, Memcache issues a lease token; the DB reader must present the token when writing to cache, and if the key was invalidated between the miss and the write, the token is revoked and the stale write is dropped, preventing stale data from polluting the cache.

### Cache Stampede Fix
```text
Problem: TTL expires → 1,000 concurrent misses → 1,000 DB queries

Fix 1: Mutex — only 1 goroutine fetches from DB, others wait
Fix 2: Probabilistic early expiry — refresh before TTL expires
Fix 3: Stale-while-revalidate — serve stale while refreshing async
```

> 🌍 **Real-World:** Reddit uses probabilistic early expiry for their hot post cache — a cache entry for a frontpage post has a 1-hour TTL, but 5 minutes before expiry, each cache read has a small random probability of triggering a background refresh. This prevents thousands of concurrent cache misses at the exact moment of expiration on one of the internet's highest-traffic pages, keeping DB load smooth rather than spiked.

---

## 12. Capacity Estimation

> ⭐ **IMPORTANT CONCEPT:** Capacity estimation is a **pattern**, not a calculator: (1) DAU → avg QPS → peak (×2–5), (2) storage/day × 365 × RF, (3) bandwidth = peak × payload. Always state assumptions out loud. Round to order-of-magnitude; interviewers want reasoning, not fake precision.

### Key Numbers Cheat Sheet

| Component | Throughput / Latency |
|-----------|---------------------|
| SSD random IOPS | 100K–1M (NVMe) |
| RAM read | ~10 GB/s |
| Redis | 100K–1M ops/sec |
| PostgreSQL | 10K–50K simple queries/sec |
| Kafka | 1M–10M messages/sec |
| Single Nginx | 50K–100K req/s |
| Redis (same DC) | 0.5 ms |
| DB query (simple) | 1–5 ms |
| US East ↔ West | ~60 ms |
| US ↔ EU | ~100 ms |
| US ↔ Asia | ~200 ms |

> **💡 Useful constants:** 86,400 seconds/day · 1M requests/day ≈ 12 QPS

### Estimation Formula
```text
QPS            = DAU × requests_per_user / 86,400
Peak QPS       = avg QPS × 3   (3× peak factor)
Storage / year = daily_data × 365 × replication_factor
Bandwidth      = peak_QPS × avg_response_size
```

---

## 13. System Design Framework

### Interview Template (45 min)

```text
1. Requirements [5 min]
   Functional:     What must it do?
   Non-functional: QPS, latency (p99), consistency, availability
                   99.9% = 8.7h downtime/yr  |  99.99% = 52 min/yr
   Clarify:        Read-heavy or write-heavy? Global or regional?

2. Estimation [3 min]
   Write QPS, read QPS, storage/year, bandwidth

3. High-Level Design [10 min]
   Core end-to-end flow, main components, draw happy path

4. Deep Dive [20 min]
   Pick 2–3 most critical:
   - Data model + indexing
   - Critical algorithm (consistent hashing, rate limiting)
   - Bottleneck solution (sharding, caching, queues)

5. Bottlenecks & Trade-offs [5 min]
   Single points of failure, what you'd do at 10× scale, corners cut
```

---

## 14. URL Shortener Design

### Requirements
- `POST /shorten` → `https://short.ly/abc123`
- `GET /abc123` → redirect to original URL
- Scale: 100M URLs created/day, 10B redirects/day

### Estimation
```text
Write QPS: 100M / 86,400 ≈ 1,200/s
Read QPS:  10B  / 86,400 ≈ 115,000/s  (read:write = 100:1)
Storage:   100M × 500 bytes = 50 GB/day → 18 TB/year
```

### Short Code Generation
```text
Option: Snowflake ID → base62 encode
  - Snowflake: 64-bit (timestamp + datacenter + sequence)
  - base62 of 7 chars = 62^7 = 3.5 trillion unique codes
  - Guaranteed unique — no collision check needed
  - Not guessable by users (timestamp bits randomized)

base62 alphabet: [a-zA-Z0-9]
encode(123456789) = "8M0kX"
```

### 301 vs 302

| | 301 Permanent | 302 Temporary |
|--|--------------|---------------|
| Browser behavior | Caches forever | Always asks server |
| Pros | Reduces server load after first visit | Can update URL, track every click |
| Cons | Can't change destination, lose analytics | Extra hop every time |
| **Production choice** | | **302** (need tracking + updateability) |

> 🌍 **Real-World:** Bitly uses 302 redirects rather than 301 so that every click is recorded server-side — they build analytics dashboards showing click geography, referrers, and time-series data per link. Using 301 would have browsers cache the redirect and bypass Bitly's servers entirely, making analytics impossible and preventing Bitly from updating or expiring links.

### Architecture
```text
Write path: Client → API Gateway → Shortener Service → Postgres (persist) + Redis (cache)
Read path:  Client → API Gateway → Redirect Service → Redis cache → Postgres (on miss)
            → 302 redirect to original URL

Redis key:    short_code → original_url   (TTL: 24h)
Cache hit:    ~80%+ (Zipf distribution — top 20% URLs get 80% traffic)
DB read QPS:  115K × 0.2 = 23K/s after caching (manageable)
```

```sql
CREATE TABLE urls (
    id          BIGINT PRIMARY KEY,        -- Snowflake ID
    short_code  CHAR(7) UNIQUE NOT NULL,   -- B-tree index for fast lookup
    original    TEXT NOT NULL,
    user_id     BIGINT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    click_count BIGINT DEFAULT 0
);
```

---

## 15. Real-Time Communication Patterns

### Long Polling
```text
Client → GET /messages/poll → Server holds connection (up to 30s)
  → New message arrives: respond immediately
  → No message in 30s:  respond 204 No Content
  → Client immediately re-polls

Pros: works with HTTP/1.1, firewall-friendly
Cons: high server connection count, server resources per held connection
Use:  basic real-time (chat, notifications) when WebSocket unavailable
```

> 🌍 **Real-World:** Facebook Chat originally used long polling before switching to WebSockets — each browser tab held an open HTTP connection to Facebook's servers, and the server would hold it until a new message arrived or a 30-second timeout fired. At Facebook's scale, this required specialized servers optimized purely for holding connections rather than processing logic, and the per-connection memory overhead ultimately drove them toward the more efficient WebSocket model.

### Server-Sent Events (SSE)
```text
Client: GET /events (Accept: text/event-stream)
Server: keeps connection open, streams events:

  data: {"type":"order_update","id":"123","status":"shipped"}\n\n
  id: 42\n
  retry: 3000\n\n

Auto-reconnects on disconnect using Last-Event-ID header.

Pros: one-directional, HTTP/1.1 compatible, auto-reconnect
Cons: server→client only
Use:  live feeds, dashboards, notifications
```

> 🌍 **Real-World:** GitHub uses SSE for their live activity feed — when you watch a repository, the web UI receives push notifications of new commits, pull requests, and issues via a persistent SSE connection rather than polling every few seconds. Vercel uses SSE to stream build logs in real time to your browser as your deployment progresses, with `Last-Event-ID` ensuring that a brief network disconnect doesn't lose any log lines.

### WebSockets (Full Duplex)
```text
Upgrade handshake:
  Client → GET /ws HTTP/1.1
           Upgrade: websocket
           Connection: Upgrade
           Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==

  Server → HTTP/1.1 101 Switching Protocols
           Upgrade: websocket
           Sec-WebSocket-Accept: <HMAC of client key + GUID>

After upgrade: raw TCP frame-based protocol (not HTTP).
Frames: text, binary, ping/pong (keepalive), close.
```

### WebSockets at Scale (10M Connections)
```text
1 connection = 1 file descriptor + ~4 KB kernel buffer
1M connections ≈ 4 GB RAM (+ thread/goroutine overhead)
One server (32 GB): ~500K connections practically

Architecture:
  ┌─────────────────────────────────────┐
  │  Load Balancer (L4, sticky by user) │
  └────────────────┬────────────────────┘
       ┌───────────┼───────────┐
  WS Server-1  WS Server-2  WS Server-N
       │
  Redis Pub/Sub or Kafka  (cross-server message routing)

User A (Server-1) → sends to User B (Server-3):
  Server-1 → Redis Pub/Sub channel "user:B" → Server-3 delivers to User B

Connection registry:
  HSET ws_connections user:{user_id} server_id
  EXPIRE ws_connections user:{user_id} 300   # refreshed by heartbeat

Heartbeat: client pings every 30s. Server closes if no ping in 60s.
```

> 🌍 **Real-World:** Slack maintains persistent WebSocket connections for all 20M+ daily active users — each WebSocket gateway server holds ~50K connections and subscribes to a Redis Pub/Sub channel per workspace. When a user sends a message, it is published to the workspace channel and all gateway servers subscribed to that channel deliver it to connected clients, enabling sub-100ms message delivery globally. Discord handles 8M+ concurrent WebSocket connections across gateway servers and uses a similar Redis fan-out architecture, with a distributed connection registry for routing messages to the exact gateway shard holding each user's connection.

### Comparison

| | Long Polling | SSE | WebSocket |
|--|-------------|-----|-----------|
| Direction | Bidirectional* | Server→Client | Bidirectional |
| Protocol | HTTP | HTTP | WS (framed TCP) |
| Browser API | `fetch()` | `EventSource` | `WebSocket` |
| Auto-reconnect | Manual | Yes | Manual |
| Overhead | High (re-poll) | Low | Lowest |
| Firewall-friendly | Yes | Yes | Needs port 443 |
| Use case | Fallback | Feeds, dashboards | Chat, gaming, trading |

---

## 16. Distributed ID Generation

### Why Not Auto-Increment?
```text
Single Postgres sequence: works for one DB — breaks when you shard.
Multi-master DB:          two servers may generate the same ID.
UUID v4:                  globally unique but:
  - Not sortable by time (random bytes → index fragmentation)
  - 128-bit (larger than 64-bit int → bigger indexes)
  - Can't encode creation time
```

### Snowflake ID (Twitter, 2010)

```text
64-bit integer — fits in BIGINT, sortable, ~6 KB per 1M IDs

| 1 bit sign | 41 bits timestamp | 10 bits machine ID | 12 bits sequence |
|     0      |   ms since epoch  |  datacenter+node   |  0–4095 per ms   |

Max timestamp:   2^41 ms ≈ 69 years from epoch
Max throughput:  4,096 IDs/ms per machine = 4M IDs/sec per machine
Globally unique: machine ID differentiates nodes
```

```java
public class SnowflakeIdGenerator {
    private static final long EPOCH          = 1704067200000L; // 2024-01-01
    private static final long MACHINE_BITS   = 10;
    private static final long SEQUENCE_BITS  = 12;
    private static final long MAX_MACHINE_ID = (1L << MACHINE_BITS) - 1;  // 1023
    private static final long MAX_SEQUENCE   = (1L << SEQUENCE_BITS) - 1; // 4095

    private final long machineId;
    private long lastTimestamp = -1;
    private long sequence = 0;

    public SnowflakeIdGenerator(long machineId) {
        if (machineId > MAX_MACHINE_ID) throw new IllegalArgumentException("Invalid machine ID");
        this.machineId = machineId;
    }

    public synchronized long nextId() {
        long now = System.currentTimeMillis();
        if (now == lastTimestamp) {
            sequence = (sequence + 1) & MAX_SEQUENCE;
            if (sequence == 0) {
                // Sequence exhausted this millisecond — spin until next ms
                while ((now = System.currentTimeMillis()) <= lastTimestamp) {}
            }
        } else {
            sequence = 0;
        }
        lastTimestamp = now;
        return ((now - EPOCH) << (MACHINE_BITS + SEQUENCE_BITS))
             | (machineId << SEQUENCE_BITS)
             | sequence;
    }
}
```

```text
Decode a Snowflake ID (debugging):
  timestamp  = (id >> 22) + EPOCH
  machine_id = (id >> 12) & 1023
  sequence   = id & 4095
```

> 🌍 **Real-World:** Twitter open-sourced Snowflake IDs, and the format has been adopted broadly — Instagram generates photo IDs using a modified Snowflake (41-bit timestamp + 13-bit shard ID + 10-bit sequence), which means photo IDs sort chronologically in Postgres B-tree indexes without any `ORDER BY created_at` overhead. Discord uses Snowflake IDs for messages, channels, and guilds — the timestamp component lets engineers decode when any object was created from the ID alone, which is invaluable during incident investigations.

### ULID

```text
128-bit, base32 encoded: 26 characters
  01ARZ3NDEKTSV4RRFFQ69G5FAV

| 48-bit timestamp (ms) | 80 bits random |

Sortable:    lexicographic sort = chronological sort
URL-safe:    no special characters (base32: 0–9, A–Z excluding I, L, O, U)
No machine ID needed: high entropy (1.2 × 10^24 unique values/ms)
```

### When to Use Which

| Use Snowflake | Use ULID |
|---------------|----------|
| Monorepo with central machine ID assignment | Fully distributed generation (no coordination) |
| Need maximum throughput (4M/sec/machine) | UUID compatibility required (128-bit) |
| Need to decode timestamp from ID | Simpler deployment |

---

## 17. Service Discovery

### The Problem
```text
Microservice A needs to call Microservice B.
B's IP changes on every deploy, auto-scaling, or crash+restart.
Hard-coding IPs is fragile. DNS has propagation delay.

Solution: B registers itself. A queries the registry to find B.
```

### Client-Side Discovery (Eureka — Netflix)
```text
┌─────────────────────────────┐
│       Service Registry      │  ← Eureka Server
│  order-service → [IP list]  │
└────────┬───────────┬────────┘
         │ register  │ query
    Service B     Service A
     (server)    (client)

Flow:
  B starts → registers {service, ip, port, health endpoint}
  B sends heartbeat every 30s
  A queries registry → gets list of B instances
  A uses client-side LB (Ribbon) to pick one
  B shuts down → deregisters (or evicted after 90s of missed heartbeats)

Pros: flexible LB algorithms at client
Cons: every service needs registry client library (language coupling)
```

> 🌍 **Real-World:** Netflix runs Eureka to manage service discovery across hundreds of microservices — at peak, Eureka handled 1M+ heartbeats per minute from thousands of instances across three AWS regions. When a new instance of the recommendation service boots after auto-scaling, it self-registers with Eureka within seconds and immediately starts receiving traffic from the API gateway without any manual configuration change.

### Server-Side Discovery (Consul, AWS ELB)
```text
┌──────────────┐    ┌────────────────┐    ┌──────────────┐
│  Service A   │───→│  Load Balancer │───→│  Service B   │
└──────────────┘    │ (pool from     │    └──────────────┘
                    │  Consul)       │
                    └────────────────┘

Flow:
  A calls DNS: order-service.internal
  DNS → Load Balancer → picks healthy B → forwards request
  B registers/deregisters with Consul
  Consul health checks (HTTP/TCP) → remove unhealthy instances

Pros: client is simple, works for any language
Cons: extra hop, potential bottleneck
```

### Consul Quick Reference
```bash
# Register a service
curl -X PUT http://localhost:8500/v1/agent/service/register \
  -d '{"Name": "order-service", "Address": "10.0.1.5", "Port": 8080,
       "Check": {"HTTP": "http://10.0.1.5:8080/health", "Interval": "10s"}}'

# Discover healthy instances
curl http://localhost:8500/v1/health/service/order-service?passing=true
# Returns: [{Address: "10.0.1.5", Port: 8080}, {Address: "10.0.1.6", Port: 8080}]
```

### Kubernetes DNS
```text
In Kubernetes, service discovery is built-in.

Service object creates a stable DNS name:
  order-service.default.svc.cluster.local → cluster IP
  kube-proxy routes cluster IP → pod IPs (via iptables / eBPF)

Use Consul/Eureka only for cross-cluster or hybrid-cloud discovery.
```

> 🌍 **Real-World:** HashiCorp Consul is used by Lyft, Expedia, and Shopify for service mesh and discovery across hybrid environments — Lyft uses Consul for service discovery spanning their on-premises data centers and AWS, with health checks that automatically remove any instance failing a 10-second HTTP check within 30 seconds, ensuring the service catalog always reflects only healthy, routable instances.

---

## 18. Consistent Hashing (Deep Dive)

> ⭐ **IMPORTANT CONCEPT:** Consistent hashing moves ~**1/N** keys on add/remove vs ~**(N-1)/N** with modulo. Virtual nodes fix hot spots. Say this in every cache/shard design: ring + clockwise walk + vnodes. Used by Dynamo, Cassandra, Discord, Maglev.

### Problem with Modulo Hashing
```text
3 cache servers: key → hash(key) % 3 → server 0, 1, or 2
Add 4th server:  hash(key) % 4 → different mapping → most keys reassign
1M keys + 1 server → 750K keys move (75%) → cache invalidation storm → DB overload
```

### How Consistent Hashing Works
```text
Imagine a ring of 2^32 positions (0 to 2^32-1).

Place servers on ring by hashing name/IP:
  hash("server-A") → position 10M
  hash("server-B") → position 40M
  hash("server-C") → position 80M

For a key: hash(key) → position → walk clockwise to first server
  hash("user:123") → 25M → server-B (at 40M, nearest clockwise)

Add server-D at position 60M:
  Only keys between 40M and 60M now go to D (moved from C)
  ~1/4 of keys move instead of 3/4!

Remove server-B:
  Only B's keys move to C (next clockwise)
  ~1/3 of keys move

General rule: adding/removing 1 server moves 1/N keys
```

> 🌍 **Real-World:** Amazon DynamoDB uses consistent hashing to distribute data across storage nodes — when a node is added to handle growth, only the keys in its clockwise arc migrate from the previous owner, so throughput degrades minimally during rebalancing. Discord switched from modulo hashing to consistent hashing for their Cassandra cluster: adding a new Cassandra node previously caused ~75% of cache keys to remap (DB overload storm), whereas with consistent hashing only ~1/N keys move per added node.

### Virtual Nodes
```text
Problem: 3 physical servers each own ~1/3 of ring — hash positions may cluster unevenly.

Solution: each physical server gets K virtual positions.
  hash("server-A#1") → pos 10M
  hash("server-A#2") → pos 35M
  hash("server-A#3") → pos 75M

Effect: load distributes evenly regardless of hash clustering.
Standard: 100–200 vnodes per physical server.

Used by: Cassandra, DynamoDB, Memcached, Redis Cluster (16,384 hash slots).
```

> 🌍 **Real-World:** Apache Cassandra uses 256 virtual nodes per physical node by default — without vnodes, adding a new physical server to a 10-node cluster requires manually calculating and transferring exactly 1/10th of the data from one neighbor; with vnodes, Cassandra automatically balances the load by distributing the new node's 256 virtual positions across the ring, achieving near-perfect load balance automatically without human-calculated token assignments.

---

## 19. API Security Patterns

### Authentication vs Authorization

| | Authentication | Authorization |
|--|---------------|---------------|
| Question | WHO are you? | What are you ALLOWED to do? |
| Mechanisms | JWT, API key, OAuth2, session cookie | RBAC, ABAC, ACL, OAuth2 scopes |

### JWT Deep Dive
```text
Structure: header.payload.signature (base64url, dot-separated)

Header:  {"alg": "HS256", "typ": "JWT"}
Payload: {
    "sub":   "user:1001",
    "roles": ["user", "admin"],
    "exp":   1699000000,
    "iat":   1698996400,
    "jti":   "uuid-for-revocation"
}
Signature: HMAC-SHA256(base64(header) + "." + base64(payload), secret)

Validation steps:
  1. Verify signature (tamper detection)
  2. Check exp (expiry)
  3. Check iss (issuer)
  4. Check aud (audience — which service is this token for?)

JWT revocation: token is valid until expiry. To revoke early:
  - Short TTL (15 min) + refresh token
  - Store revoked jti in Redis: SET revoked:{jti} 1 EX {ttl_seconds}
```

> 🌍 **Real-World:** Auth0 (now Okta) issues JWTs with a 1-hour access token and a 30-day refresh token — when the access token expires, the client silently exchanges the refresh token for a new pair without prompting the user. Netflix uses asymmetric JWT (RS256) for inter-service authorization: services validate tokens using the public key only (no shared secret to leak), and token revocation uses a Redis-backed `jti` blocklist checked at each API Gateway hop to handle forced logouts.

### OAuth2 Authorization Code Flow
```text
1. User clicks "Login with Google"
2. App redirects to:
   GET accounts.google.com/o/oauth2/auth
   ?client_id=...&redirect_uri=...&scope=email&response_type=code&state=csrf_token
3. User authenticates + consents
4. Google redirects back: /callback?code=4/abc123&state=csrf_token
5. App (server-side) exchanges code for tokens:
   POST accounts.google.com/o/oauth2/token
   body: code, client_id, client_secret, redirect_uri
   → {access_token, refresh_token, id_token}
6. App verifies id_token (JWT), creates session
```

> **💡 Why code exchange?** The authorization code is short-lived (1 use) and exposed in the browser URL. The actual token exchange is server-to-server, never visible to the browser.

> 🌍 **Real-World:** Spotify uses OAuth2 Authorization Code Flow with PKCE for their mobile app — because mobile apps cannot securely store a `client_secret`, PKCE adds a cryptographic code challenge so even if the authorization code is intercepted during the redirect, it cannot be exchanged for tokens without the original code verifier that only the legitimate app instance holds.

---

## 20. Proxy vs Reverse Proxy

### Forward Proxy
```text
Client → Forward Proxy → Internet → Server

Client explicitly configures proxy. Proxy acts on client's behalf.

Use cases:
  - Corporate firewall: filter and log employee traffic
  - Anonymity: server sees proxy IP, not client
  - Caching: responses for frequently visited sites
  - Geo-bypass: route through proxy in another region

Client knows about proxy. Server does NOT.
```

### Reverse Proxy
```text
Client → Reverse Proxy → Internal Servers

Client does NOT know about internal servers — thinks it's talking directly.

Use cases:
  - SSL termination (TLS offloading)
  - Load balancing
  - Caching static assets
  - Compression (gzip)
  - Rate limiting
  - Auth (check JWT before forwarding)
  - Hide internal topology

Real IPs forwarded via headers:
  X-Forwarded-For: 203.0.113.12
  X-Forwarded-Proto: https
  X-Real-IP: 203.0.113.12
```

> 🌍 **Real-World:** Nginx serves as the reverse proxy for more than 34% of all websites — Dropbox uses Nginx in front of their entire file-serving infrastructure to handle SSL termination, gzip compression, and static asset caching, offloading that CPU-intensive work from backend Python servers. Cloudflare's entire global network is conceptually a distributed reverse proxy: users connect to the nearest PoP, which validates the request, enforces caching and WAF rules, and only forwards cache misses to the origin, absorbing the vast majority of traffic at the edge.

### Comparison Table

| | Forward Proxy | Reverse Proxy | API Gateway |
|--|--------------|---------------|-------------|
| Who configures | Client | Server | Server |
| Client aware? | Yes | No | No |
| Main purpose | Outbound filter | Inbound LB + SSL | Micro-routing + auth |
| Auth support | No | Limited | Yes (JWT, API key) |
| Rate limiting | No | Limited | Yes (per-user, per-route) |
| Protocol trans. | No | No | Yes (REST ↔ gRPC) |
| Examples | Squid, Dante | Nginx, HAProxy | Kong, AWS API GW |

### Nginx as Reverse Proxy
```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location /api/v1/ {
        proxy_pass         http://backend-pool/;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout    30s;
    }

    location /static/ {
        proxy_pass         http://backend-pool/static/;
        proxy_cache        static_cache;
        proxy_cache_valid  200 1d;
        add_header         X-Cache-Status $upstream_cache_status;
    }

    gzip on;
    gzip_types text/plain application/json;
    gzip_min_length 256;
}

upstream backend-pool {
    least_conn;
    server app-server-1:8080;
    server app-server-2:8080;
    server app-server-3:8080;
    keepalive 64;  # persistent connections — no TCP handshake per request
}
```

### SSL/TLS Termination
```text
Why terminate at proxy (not app)?
  1. CPU cost offloaded from app servers
  2. App uses plain HTTP internally (no cert management per service)
  3. One place to manage, rotate, and renew certs
  4. Nginx/HAProxy use hardware-accelerated TLS

Certificate management:
  Let's Encrypt + Certbot: auto-renew free certs
  cert-manager (k8s): auto-issues and rotates certs in Kubernetes
```

> 🌍 **Real-World:** Cloudflare terminates TLS for millions of domains at its edge — by offloading TLS handshakes to dedicated hardware (with custom TLS acceleration chips), origin servers receive plain HTTP, eliminating per-service certificate management overhead entirely. Let's Encrypt, backed by Mozilla and the EFF, automated TLS certificate issuance and renewal by treating cert management as an ACME protocol API, growing from 0 to over 300 million active certificates and making HTTPS the default for the web.

---

## 21. Microservices Patterns

### Circuit Breaker

```text
States:
  CLOSED:    Requests pass through. Count failures.
  OPEN:      All requests fail-fast (no downstream call). Triggered after N failures.
  HALF-OPEN: Allow 1 test request. Success → CLOSED. Failure → OPEN.

Config:
  failure_threshold: 5 failures in 10s → OPEN
  timeout:           30s in OPEN before HALF-OPEN
  success_threshold: 2 successes in HALF-OPEN → CLOSED
```

```go
type CircuitBreaker struct {
    state        State  // CLOSED, OPEN, HALF_OPEN
    failureCount int
    successCount int
    lastFailure  time.Time
    mu           sync.Mutex
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    cb.mu.Lock()
    switch cb.state {
    case OPEN:
        if time.Since(cb.lastFailure) > 30*time.Second {
            cb.state = HALF_OPEN
        } else {
            cb.mu.Unlock()
            return ErrCircuitOpen
        }
    }
    cb.mu.Unlock()

    err := fn()

    cb.mu.Lock()
    defer cb.mu.Unlock()
    if err != nil {
        cb.failureCount++
        cb.lastFailure = time.Now()
        if cb.failureCount >= 5 {
            cb.state = OPEN
        }
    } else {
        cb.failureCount = 0
        if cb.state == HALF_OPEN {
            cb.successCount++
            if cb.successCount >= 2 {
                cb.state = CLOSED
                cb.successCount = 0
            }
        }
    }
    return err
}
```

> 🌍 **Real-World:** Netflix's Hystrix library pioneered circuit breakers in microservices at scale — when their recommendation service goes down, the circuit opens and Netflix falls back to a "popular titles" list rather than returning errors. This prevented a single slow dependency from exhausting all request-handling threads across hundreds of services. Netflix reports their systems trip circuit breakers thousands of times per day during normal operation, absorbing dependency failures invisibly to the user.

### Retry with Exponential Backoff + Jitter
```text
Base: 1s  |  Max: 60s  |  Multiplier: 2×

Attempt 1 fails → wait  1s ± jitter
Attempt 2 fails → wait  2s ± jitter
Attempt 3 fails → wait  4s ± jitter
Attempt 4 fails → wait  8s ± jitter
...

Full jitter (AWS recommendation):
  sleep = random(0, min(cap, base × 2^attempt))
```

> **💡 Why jitter?** 1,000 clients retrying in lockstep → retry storm → overload. Jitter spreads retries over time.

> 🌍 **Real-World:** AWS SDKs implement full jitter by default in their retry logic — when an S3 request gets throttled (503), each SDK client independently picks a random backoff within the capped range, spreading 10,000 concurrent retries across seconds rather than hammering S3 in lockstep every 2 seconds. Amazon's own blog documented this pattern after observing "thundering herd" retry avalanches from customers who implemented exponential backoff without jitter.

### Saga Pattern (Distributed Transactions)
```text
Problem: ACID transaction across microservices is not possible.
         2PC works but adds distributed locks + latency.

Saga: split into local transactions + compensating transactions.

Example: Book hotel + flight + car rental

Choreography (event-driven, no coordinator):
  hotel_booked      → flight service listens → books flight → flight_booked
  flight_booked     → car service listens → books car
  car_booking_failed → flight service listens → cancels flight
  flight_cancelled   → hotel service listens → cancels hotel

Orchestration (central Saga coordinator):
  SagaOrchestrator:
    1. BookHotel()   → success
    2. BookFlight()  → success
    3. BookCar()     → FAIL
    4. CancelFlight() ← compensation
    5. CancelHotel()  ← compensation
```

> **⚠️ Compensations must be idempotent** — they may be called multiple times on retry.

> 🌍 **Real-World:** Uber's payment system uses the Saga pattern (orchestration style) for ride fare processing — a successful trip triggers: charge rider → pay driver → update ledger → send receipts. If the driver payout step fails, a compensating transaction reverses the rider charge. Because each step publishes events to Kafka, the saga coordinator can replay any failed step without data loss, and idempotency keys on each step prevent double-charges on retry.

---

## 22. Twitter/Instagram Feed Design

### The Fan-out Problem
```text
Celebrity with 100M followers tweets.
Pull: 1 tweet stored, read 100M timelines on demand → slow reads
Push: tweet → fan-out to 100M inbox entries → fast reads, massive writes

100M writes/tweet × 10 tweets/day by top celebrities = 1B writes/day for fan-out alone
```

### Hybrid Fan-out (Production Approach)

> ⭐ **IMPORTANT CONCEPT:** Pure fan-out-on-write dies on celebrities; pure fan-out-on-read dies on normal users' latency. **Hybrid**: push for regular users, pull+merge celebrities at read time. This is the expected Twitter/Instagram feed answer at FAANG.

```text
Regular users (< 1M followers): fan-out on WRITE
  POST /tweet → write to DB → enqueue fan-out job
  Fan-out worker: INSERT into timeline cache for each follower

Celebrities (> 1M followers): fan-out on READ
  Celebrity tweets NOT pre-computed into follower timelines
  On timeline read: merge pre-computed feed + live celebrity tweets

Timeline assembly:
  1. Get user's pre-computed feed from Redis (fan-out-on-write portion)
  2. Get list of celebrities user follows
  3. Fetch each celebrity's last 20 tweets from their post cache
  4. Merge + sort by time → return top 20
```

> 🌍 **Real-World:** Twitter uses exactly this hybrid approach — when Katy Perry (100M+ followers) tweets, Twitter does NOT fan-out to all 100M follower timelines (that would be ~100M writes in seconds). Regular followers get tweets pushed to their timeline cache, while celebrity tweets are fetched on-demand and merged at read time. Twitter moved to this model after a 2012 incident where a single celebrity tweet caused a write cascade that overloaded their fan-out workers, making timelines unavailable for millions of users.

### Redis Data Structures
```text
feed:{user_id}   → List of post_ids (pre-computed, max 800 entries)
posts:{user_id}  → ZSet(score=timestamp, member=post_id) for user's own posts
post:{post_id}   → Hash(author, content, likes, created_at)
```

### Feed Ranking (Non-Chronological)
```text
Instagram/Facebook use ML-based ranking. Simplified signals:
  - Recency:           recent posts score higher
  - Engagement:        more likes/comments → higher score
  - Relationship:      best friends > acquaintances
  - User interest:     past interactions with this poster

score = w1 × recency + w2 × engagement_rate + w3 × relationship + w4 × interest

Recency:    1 / (1 + hours_since_post)
Engagement: likes / impressions

Simple: compute score offline every 5 min (batch job)
Prod:   real-time ML model (TensorFlow Serving) scores candidate pool
```

> 🌍 **Real-World:** Instagram's feed ranking model runs on TensorFlow Serving to score thousands of candidate posts per feed refresh — the model evaluates 100+ features including relationship strength, content type affinity, and session context. Meta reported that switching from chronological to ML-ranked feeds on Instagram increased user engagement by over 70%, validating the investment in real-time scoring infrastructure. TikTok's For You Page takes this further by using pure collaborative filtering with no social graph — every interaction (watch time, replay, share) updates a user embedding vector that drives future recommendations, which is why TikTok can surface compelling content even for brand-new accounts with no follow history.


---

## Capacity Estimation Worksheet (5 Worked Examples)

> ⭐ **IMPORTANT CONCEPT:** Always narrate assumptions → avg QPS → peak → storage → bandwidth. Round to order-of-magnitude. Interviewers grade the **method**, not spreadsheet precision.

### Shared formulas
```text
avg_QPS   = DAU × actions_per_user_per_day / 86_400
peak_QPS  = avg_QPS × peak_factor          # usually 2×–5×
storage_y = daily_bytes × 365 × RF × (1 + overhead)
bandwidth = peak_QPS × avg_response_bytes
```

---

### Example 1 — URL Shortener (classic)

**Prompt:** 100M new shorts/day, 10B redirects/day.

```text
Assumptions:
  peak_factor = 3
  avg URL record = 500 bytes (code + long URL + metadata)
  RF = 3

Write QPS avg  = 100e6 / 86400 ≈ 1,160/s
Write QPS peak = 1,160 × 3 ≈ 3,500/s
Read QPS avg   = 10e9 / 86400 ≈ 115,700/s
Read QPS peak  = ~350k/s

Storage/day    = 100e6 × 500B = 50 GB
Storage/year   = 50 GB × 365 × 3 ≈ 55 TB (+ indexes ~2× → plan ~100 TB)

Cache: Zipf → 80% hit ⇒ DB read peak ≈ 70k/s (still needs sharding/replicas)
```

**Say in interview:** "Read-heavy 100:1 → Redis in front of sharded KV/Postgres; 302 for analytics."

---

### Example 2 — Chat / Messaging

**Prompt:** 50M DAU, 40 messages/user/day, 1 KB avg message, keep 1 year hot.

```text
Writes/day     = 50e6 × 40 = 2B msgs/day
Write QPS avg  = 2e9 / 86400 ≈ 23,000/s
Write QPS peak = 23k × 4 ≈ 90k/s   (evening spike)

Storage/day    = 2e9 × 1KB = 2 TB/day raw
Hot year       = 2 TB × 365 ≈ 730 TB before RF
With RF=3      ≈ 2.2 PB → tier: hot (recent 30d) in Cassandra/Scylla,
                 warm in object store / cold archive

Fan-out: group chats → write once to channel log; push notify separately
```

**Say:** "Per-channel partitions for ordering; don't fan-out every msg to each member's inbox at this QPS."

---

### Example 3 — News Feed (hybrid fan-out)

**Prompt:** 200M DAU, 5 timeline loads/day, avg follow 200, 0.5 tweets/user/day.

```text
Timeline reads/day = 200e6 × 5 = 1B → avg ~12k QPS, peak ~40k QPS
Tweets/day         = 200e6 × 0.5 = 100M → write ~1.2k QPS

Naive fan-out-on-write:
  100M tweets × 200 followers = 20B timeline inserts/day → insane

Hybrid:
  Regular users: fan-out write to Redis lists (cap 800)
  Celebrities (>1M): pull at read, merge
  Celebrity fraction 0.01% of tweets but dominate write amp if pushed

Storage timelines:
  Active users 100M × 800 IDs × 8B ≈ 640 GB Redis-class (manageable with sharding)
```

**Say:** "Celebrity problem forces hybrid — estimate write amplification explicitly."

---

### Example 4 — Video Upload + CDN Streaming

**Prompt:** 2M uploads/day, avg 100 MB raw → 3 encodings (total 250 MB stored), 50M views/day avg 20 MB egress each.

```text
Ingest bandwidth avg = 2e6 × 100MB / 86400 ≈ 2.3 GB/s into origin pipeline
Stored/day           = 2e6 × 250MB = 500 TB/day (!!) → lifecycle to IA/Glacier
View egress/day      = 50e6 × 20MB = 1 PB/day → CDN mandatory

Metadata DB: tiny (titles, IDs) vs blob store dominance
Bottleneck interview answer: encoding farm + CDN, not the SQL ID table
```

**Say:** "Separate control plane (metadata) from data plane (object storage + CDN)."

---

### Example 5 — Rate Limiter at Edge

**Prompt:** API gateway 500k RPS peak, per-user limit 100 req/min, 20M active tokens/day.

```text
Limiter QPS = 500k (every request checks)
State: token bucket key per user in Redis Cluster
Memory rough: 20M keys × 64B ≈ 1.3 GB (+ replicas)
Atomicity: Lua / INCR sliding window
Deny path: 429 + Retry-After; never block gateway thread on remote slow call
  → local token cache / fail-open vs fail-closed policy (state!)
```

**Say:** "Distributed limiter needs shared store; local-only limiter is wrong behind multiple pods."

---

## API + Schema Templates (copy into interviews)

### REST resource template
```text
POST   /v1/{resources}                 → 201 + Location
GET    /v1/{resources}/{id}            → 200
PATCH  /v1/{resources}/{id}            → 200
DELETE /v1/{resources}/{id}            → 204
GET    /v1/{resources}?cursor=&limit=  → 200 + next_cursor

Headers:
  Authorization: Bearer ...
  Idempotency-Key: <uuid>              # on POST money/side-effect
  X-Request-Id: <uuid>

Error body:
  { "error": { "code": "...", "message": "...", "request_id": "..." } }
```

### Pagination + consistency notes
```text
Prefer cursor (created_at, id) over OFFSET
Read-your-writes: sticky primary N seconds after write if using replicas
```

### Core schema skeletons
```sql
-- URL shortener
CREATE TABLE urls (
  id BIGINT PRIMARY KEY,
  short_code VARCHAR(16) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  owner_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ
);
CREATE INDEX ON urls (owner_id, created_at DESC);

-- Feed post
CREATE TABLE posts (
  id BIGINT PRIMARY KEY,           -- snowflake
  author_id BIGINT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX ON posts (author_id, created_at DESC);

-- Chat message (partition key = channel_id in NoSQL)
-- PK (channel_id, message_id) ; CLUSTERING ORDER BY message_id DESC
```

### Redis key templates
```text
url:{code} → long_url                         TTL 24h
feed:{user_id} → LIST of post_ids             LTRIM 0 799
rate:{user_id} → token bucket hash            TTL window
lock:{resource} → {holder, fence}             TTL lease
```

> 🛠️ **PRACTICAL:** In the first 10 minutes of HLD, write **3 endpoints + 1 table + 2 Redis keys** on the board. It anchors the rest of the design.

---

## Failure Drill Checklist (run for EVERY design)

Copy this checklist into the last 5 minutes of any system design.

### Availability & dependencies
- [ ] Primary DB down → failover / read-only mode?
- [ ] Cache (Redis) down → fail open to DB or degrade features?
- [ ] Queue down → sync fallback or reject writes?
- [ ] Single AZ / region loss → multi-AZ? multi-region RPO/RTO?

### Data correctness
- [ ] Duplicate requests (retry) → idempotency keys?
- [ ] Out-of-order messages → version / timestamp / per-key ordering?
- [ ] Poison pill message → DLQ + skip?
- [ ] Stale cache after write → delete-on-write / lease?

### Hotspots & overload
- [ ] Hot key (celebrity, viral URL) → shard / local cache / coalesce?
- [ ] Thundering herd on expiry → singleflight / probabilistic early refresh?
- [ ] Retry storm → full jitter + retry budget + circuit breaker?
- [ ] Connection pool exhaustion → PgBouncer / limit concurrency?

### Operability
- [ ] Bad deploy → feature flag / instant rollback?
- [ ] Schema change → expand/contract migration?
- [ ] Observability → RED metrics, lag, error budget?
- [ ] Abuse / DDoS → WAF, rate limit, Anycast CDN?

> ⭐ **IMPORTANT CONCEPT:** A design without failure modes is a junior design. Narrate **detection + mitigation + user impact** for at least two failures.

---

## Important Concepts Checklist — HLD Core

### API & edge
- [ ] REST resource design; idempotent methods
- [ ] Cursor pagination vs offset
- [ ] API gateway responsibilities
- [ ] CDN Cache-Control / ETag basics

### Scale building blocks
- [ ] L4 vs L7 load balancing
- [ ] Kafka vs RabbitMQ vs SQS decision
- [ ] Read replicas + read-your-writes
- [ ] Sharding strategies + reshard pain
- [ ] Cache-aside, stampede fixes
- [ ] Consistent hashing + virtual nodes

### Estimation & process
- [ ] QPS / storage / bandwidth formulas
- [ ] 45-min interview timebox (req → estimate → HLD → deep dive → failures)
- [ ] Snowflake / ULID tradeoffs

### Flagship designs
- [ ] URL shortener (302, snowflake, cache)
- [ ] WebSockets at scale (registry + pub/sub)
- [ ] Hybrid fan-out feed
- [ ] Circuit breaker + saga awareness
- [ ] JWT / OAuth2 high-level

---

## 🛠️ PRACTICAL: Redesign Twitter Feed in 45 Min (Timer Checklist)

Print or keep this beside you. Do **not** skip the timer.

### Minute 0–5 — Requirements
- [ ] Functional: post tweet, follow, home timeline, like (optional)
- [ ] NFRs: p99 latency target (e.g. <200ms timeline), availability, consistency (timeline can be slightly stale)
- [ ] Scale: pick numbers (e.g. 200M DAU) or ask interviewer
- [ ] Celebrity problem called out explicitly

### Minute 5–8 — Estimation
- [ ] Tweets/day, timeline reads/day
- [ ] Fan-out write amplification if naive push
- [ ] Redis memory ballpark for precomputed feeds

### Minute 8–18 — High-level diagram
- [ ] Clients → API GW → Tweet service / Social graph / Timeline service
- [ ] Tweet store (DB) + media store (optional)
- [ ] Fan-out workers + Redis timeline cache
- [ ] Celebrity post cache / pull path

### Minute 18–35 — Deep dive (pick 2+)
- [ ] Hybrid fan-out algorithm step-by-step
- [ ] Redis structures: `feed:{u}`, `posts:{u}`, `post:{id}`
- [ ] Ranking: chrono vs ML candidate + score (brief)
- [ ] Graph storage: follow edges sharding
- [ ] Idempotent post create; snowflake IDs

### Minute 35–42 — Failures & scale
- [ ] Fan-out worker lag → users see delay; mitigate with priority queues
- [ ] Redis shard loss → rebuild from DB / accept empty + pull
- [ ] Hot celebrity tweet → no push; pull+merge only
- [ ] 10× growth → more shards, cache tiers, async everything

### Minute 42–45 — Wrap
- [ ] Recap tradeoffs: freshness vs write amp vs read latency
- [ ] What you'd build in v1 vs v2
- [ ] Open questions / metrics you'd alert on (fan-out lag, p99, error rate)

### Self-score (0–2 each)
```text
Hybrid clarity ____
Numbers written ____
Redis keys named ____
≥2 failures ____
Time discipline ____
Total /10  (≥8 = mock pass)
```

> 🛠️ **PRACTICAL:** Record one timed run weekly. If you miss hybrid or failure modes, the mock fails regardless of diagram beauty.
