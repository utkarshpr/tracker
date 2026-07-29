# FAANG System Design — 10 Systems Complete

> Self-contained. No internet needed.
> Every system: **FR → NFR → Capacity → API → Schema → Architecture → Scaling → Failure**

---

## Table of Contents

| # | System | Key Concept |
|---|--------|-------------|
| [1](#1-url-shortener) | URL Shortener | Snowflake ID, base62, 302 redirect, Redis cache |
| [2](#2-notification-service) | Notification Service | Kafka fan-out, idempotency, channel workers |
| [3](#3-distributed-chat) | Distributed Chat | WebSocket routing, Cassandra TIMEUUID, presence |
| [4](#4-kafka-like-queue) | Kafka-like Queue | Log segments, ISR, zero-copy, consumer groups |
| [5](#5-search-engine) | Search Engine | Inverted index, BM25, autocomplete, crawling |
| [6](#6-payment-system) | Payment System | Idempotency key, double-spend prevention, reconciliation |
| [7](#7-trading-exchange) | Trading Exchange | Order book, SCAN matching, LMAX Disruptor |
| [8](#8-stock-broker-platform) | Stock Broker Platform | FIX protocol, real-time P&L, KYC, settlement |
| [9](#9-rate-limiter) | Rate Limiter | Token bucket, sliding window, Redis Lua script |
| [10](#10-distributed-scheduler) | Distributed Scheduler | SKIP LOCKED, time-wheel, exactly-once execution |

---

## Design Framework (Run for Every System)

```text
1. Requirements            (5 min)
   Functional:     What must the system do?
   Non-Functional: QPS, latency (p99), availability, consistency, geo

2. Capacity Estimation     (3 min)
   Write QPS / Read QPS / Storage per year / Bandwidth

3. High-Level Design       (10 min)
   Core components. Happy-path data flow. Draw it.

4. Deep Dive               (20 min)
   DB schema + indexes, critical algorithm, scaling bottleneck

5. Tradeoffs               (5 min)
   What you sacrificed. What breaks at 10x. What you'd add with more time.
```

---

## 1. URL Shortener

### Functional Requirements

```text
POST /shorten {url} → short code (e.g. short.ly/abc1234)
GET /{code}         → 302 redirect to original URL
Optional: custom alias, expiry, click analytics
```

### Non-Functional Requirements

```text
100M URLs created/day. 10B redirects/day.
Redirect latency < 10ms (p99). High availability.
```

### Capacity Estimation

| Metric | Calculation | Result |
|--------|-------------|--------|
| Write QPS | 100M / 86,400 | ~1,200/s |
| Read QPS | 10B / 86,400 | ~115,000/s |
| Read : Write ratio | — | 100 : 1 |
| Storage/day | 100M × 500B | 50 GB/day |
| Storage/year | 50 GB × 365 | ~18 TB/year |
| Code space | base62, 7 chars = 62^7 | 3.5 trillion unique → sufficient |

> **⚠️ Scale Challenge:** Read QPS is 100× write QPS. The redirect path must be served almost entirely from cache to avoid overwhelming the database.

### Core API

```text
POST /shorten
  body: { "url": "https://...", "alias": "optional", "ttl_days": 30 }
  response: { "short_url": "https://short.ly/abc1234" }

GET /{code}
  response: 302 Location: <original_url>
```

### Schema

```sql
CREATE TABLE urls (
    id         BIGINT PRIMARY KEY,           -- Snowflake ID
    short_code CHAR(7) UNIQUE NOT NULL,      -- indexed for fast lookup
    original   TEXT NOT NULL,
    user_id    BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    click_count BIGINT DEFAULT 0
);
CREATE INDEX idx_short_code ON urls(short_code);  -- B-tree, lookup O(log n)
```

### Architecture

```text
Write path: Client → LB → Shortener Service
  → generate Snowflake ID → base62 encode → INSERT into Postgres
  → cache in Redis (short_code → original_url, TTL 24h)

Read path:  Client → LB → Redirect Service
  → Redis cache lookup → hit: return 302 redirect
  → miss: Postgres → cache + return 302 redirect
```

### Key Design Decisions

> **💡 Key Design Decision:** Use **302 Temporary Redirect** over 301 Permanent Redirect. 302 forces the browser to always ask the server, enabling click tracking and URL updates. 301 is browser-cached forever — cheaper but you lose analytics and mutability.

> **💡 Key Design Decision:** **Snowflake ID** (64-bit, timestamp + datacenter + sequence) guarantees global uniqueness. **base62** encoding of the Snowflake ID eliminates the need for a separate collision check entirely.

```text
302 vs 301:
  302 (Temporary): browser always asks server. Supports click tracking + URL updates.
  301 (Permanent): browser caches forever. Reduces server load but loses analytics.
  → Use 302 for production (analytics + mutability)

Collision avoidance:
  Snowflake ID (64-bit, timestamp+datacenter+sequence) → unique globally
  base62 encode → no collision check needed

Cache hit rate: ~80%+ (Zipf — top 20% URLs get 80% traffic)
DB read QPS after cache: 115K * 0.2 = 23K/s → manageable
```

> 🌍 **Real-World:** Bitly processes 10B+ monthly redirects with median redirect latency under 10ms by serving 85%+ of lookups from Redis. Their top 1% of URLs account for 50%+ of traffic (Zipf distribution), so aggressive caching of hot URLs keeps DB pressure minimal even at scale. TinyURL uses a similar architecture — they generate codes by hashing the long URL with MD5 and taking the first 6 characters, falling back to a retry with a different salt on the rare collision.

---

## 2. Notification Service

### Functional Requirements

```text
Send notifications via: email, SMS, push (iOS/Android), in-app
Priority queues: transactional (OTP) > marketing
Template rendering
Delivery tracking, retry on failure
Rate limiting per user per channel
Opt-out/preference management
```

### Non-Functional Requirements

```text
Transactional: deliver in < 5 seconds, at-least-once
Marketing: best-effort, can be batched
Scale: 100M notifications/day (transactional: 10M, marketing: 90M)
```

### Capacity Estimation

| Metric | Calculation | Result |
|--------|-------------|--------|
| Total QPS (average) | 100M / 86,400 | ~1,160/s |
| Transactional peak | OTP during login spikes | ~10,000/s |
| Marketing burst | 50M in 1 hour | ~14,000/s |

> **⚠️ Scale Challenge:** Marketing campaigns create extreme write bursts (50M notifications in one hour). These must be smoothed with pre-scheduled batching over a multi-hour window, not sent all at once.

### Architecture

```text
Producer Services (Order, Auth, Marketing) → Kafka (topic per channel + priority)

Kafka Topics:
  notification.transactional        (highest priority)
  notification.transactional.retry
  notification.marketing

Dispatcher Service:
  Consumes from Kafka
  Resolves user preferences (opt-out check)
  Applies rate limits (Redis: user:channel:window → count)
  Sends to channel-specific workers

Channel Workers:
  Email Worker  → SendGrid / SES
  SMS Worker    → Twilio / SNS
  Push Worker   → FCM (Android), APNs (iOS)
  In-App Worker → WebSocket push to connected clients

DB (Postgres):
  notifications table: id, user_id, channel, template_id, status, sent_at, error
  preferences table: user_id, channel, opted_out
  templates table: id, channel, body, vars (JSON)
```

### Key Design Decisions

> **💡 Key Design Decision:** Every notification carries an **idempotency_key** (UUID from producer). The Dispatcher checks `Redis SET NX` before sending. If the key already exists, the notification is skipped — preventing double-send on retry.

> **💡 Key Design Decision:** **Kafka fan-out** with separate topics per priority tier means transactional OTP messages are never head-of-line blocked by a large marketing batch.

```text
Idempotency: each notification has an idempotency_key (UUID from producer).
  Dispatcher checks if key already processed (Redis SET NX) before sending.
  Prevents double-send on retry.

Retry strategy:
  Immediate retry × 1 → 1-min retry × 2 → 10-min retry × 3 → DLQ
  Store failed notifications with error reason for manual inspection.

Rate limiting per user:
  Redis key: rate:user_id:channel:hour → INCR → check against limit
  Bucket: 10 SMS/hour, 100 push/hour per user.

Fan-out for marketing campaigns:
  Don't send all 90M in one burst.
  Pre-schedule: segment users into batches, send batches over 6-hour window.
```

> 🌍 **Real-World:** Uber's notification system sends 1B+ push notifications, emails, and SMS per month across their rider and driver apps. Their architecture separates transactional notifications (trip confirmations, OTP) from marketing notifications using Kafka topic priority — transactional messages have dedicated high-priority partitions so a marketing blast never delays a surge-pricing alert. Airbnb's notification platform "Chronos" uses the outbox pattern to guarantee at-least-once delivery — every notification event is written to a Postgres outbox table in the same transaction as the booking event, then a relay process publishes to SNS/SQS.

---

## 3. Distributed Chat

### Functional Requirements

```text
1:1 messaging, group messaging (up to 500 members)
Message delivery status: sent, delivered, read
Online presence
Message history (last 30 days fast, older archived)
Media sharing (images, files)
```

### Non-Functional Requirements

```text
500M DAU. p99 message delivery < 100ms.
Messages must be ordered within a conversation.
At-least-once delivery.
```

### Capacity Estimation

| Metric | Calculation | Result |
|--------|-------------|--------|
| DAU | — | 500M |
| Messages per user/day | — | 40 |
| Message QPS | 500M × 40 / 86,400 | ~230,000/s |
| Storage/day (text) | 500M × 40 × 100 bytes | ~2 TB/day |
| Media storage | Separate object store (S3) | Only URL stored in DB |

> **⚠️ Scale Challenge:** 230K writes/second with strict per-conversation ordering. Relational databases cannot handle this write volume. Cassandra's partition-per-conversation model solves both ordering (via TIMEUUID) and write throughput.

### Architecture

```text
Connection Layer:
  WebSocket servers (stateful). Each client maintains persistent WebSocket.
  Client → WebSocket Server → Message Service.
  
  Service discovery: client connects to geographically nearest WS server.
  Connection state in Redis: user_id → {server_id, connected_at}

Message Flow (1:1):
  1. Sender → WS Server → Message Service
  2. Message Service: persist to Cassandra, publish to Kafka (topic: user-{recipient_id})
  3. Message Fanout Service: consume Kafka → look up recipient WS server → push via internal API
  4. Recipient's WS Server → deliver to client via WebSocket

Group Message Flow:
  Message → Fanout Service → for each member: push to their WS server
  For groups with > N members: async fan-out via Kafka

Offline delivery:
  If recipient not connected: store in inbox table.
  On reconnect: client pulls missed messages (cursor-based).

Presence:
  Client sends heartbeat every 5s → Redis key with TTL 10s.
  Online status: user_id → {last_seen, is_online} in Redis.
```

### Schema (Cassandra)

```sql
-- Messages partitioned by conversation
CREATE TABLE messages (
    conversation_id  UUID,
    message_id       TIMEUUID,   -- time-sortable → ordering within partition
    sender_id        UUID,
    content          TEXT,
    type             TEXT,       -- text/image/file
    status           TEXT,       -- sent/delivered/read
    PRIMARY KEY (conversation_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- Conversations per user (for inbox)
CREATE TABLE user_conversations (
    user_id         UUID,
    conversation_id UUID,
    last_message_at TIMESTAMP,
    unread_count    INT,
    PRIMARY KEY (user_id, last_message_at, conversation_id)
) WITH CLUSTERING ORDER BY (last_message_at DESC);
```

### Key Design Decisions

> **💡 Key Design Decision:** **TIMEUUID** as `message_id` encodes a timestamp directly into the UUID, giving natural sort order within a Cassandra partition. Within the same millisecond, the node ID in the TIMEUUID provides a tie-break — no secondary sort column needed.

> **💡 Key Design Decision:** **Read receipts** are batched client-side for 1–2 seconds before writing to the DB. This reduces write amplification significantly in high-traffic conversations where read_ack events would otherwise arrive constantly.

```text
Message ordering:
  TIMEUUID as message_id: encodes timestamp → naturally ordered.
  Within same millisecond: TIMEUUID includes node ID for tie-break.

Message delivery guarantee:
  Producer: Kafka idempotent producer (acks=all, retries=5)
  Consumer: process before ack → at-least-once
  Client-side dedup: client tracks last received message_id, ignores duplicates.

Read receipts:
  Client sends read_ack(conversation_id, last_read_message_id).
  Batch: aggregate acks for 1-2s before writing to DB (reduce write amplification).
```

> 🌍 **Real-World:** WhatsApp handles 100B messages/day for 2B users with fewer than 50 engineers by using Erlang's actor model — each user connection is a lightweight Erlang process, and message routing is pure message passing between processes. Messages are stored in Mnesia (Erlang's distributed DB) partitioned by phone number. Facebook Messenger moved from a polling-based system to persistent MQTT connections in 2011, reducing message delivery latency from ~1.5 seconds to under 100ms for online users. Telegram stores messages in a distributed database sharded by chat_id, with a Cassandra-like model for message history and Redis for presence.

---

## 4. Kafka-like Queue

### Functional Requirements

```text
Producers publish messages to topics.
Consumers subscribe to topics (consumer groups).
Message ordering within a partition.
At-least-once delivery (configurable to exactly-once).
Replay from any offset.
Message retention: 7 days default.
```

### Non-Functional Requirements

```text
10M messages/second write throughput.
p99 publish latency < 10ms.
Horizontal scalability.
```

### Architecture

```text
Core Components:
  Broker:      Stores messages on disk. Manages partitions.
  ZooKeeper:   Cluster coordination, leader election for partitions.
  Producer:    Writes to partition leader. Batches messages.
  Consumer:    Reads sequentially. Tracks offset.

Storage (per broker, per partition):
  Log segment files on disk: append-only (O(1) writes, sequential = fast).
  Index file: offset → file position (for O(log n) seek to arbitrary offset).
  Time index: timestamp → offset (for time-based seek).

Partition assignment:
  Topic has N partitions.
  Producer: partition = hash(key) % N  (key-based ordering)
            or round-robin (if no key, for throughput)
  Each partition has 1 leader + RF-1 replicas.

Leader election: ZooKeeper ephemeral nodes.
  Each broker claims leadership for its partitions via ZooKeeper.
  Broker fails → ZooKeeper notifies controller → new leader elected from ISR.
```

### Write Path

```text
Producer → finds partition leader (from metadata cache)
→ batches messages (up to 16KB or 1ms, whichever first)
→ sends batch to leader broker
→ leader writes to disk (append to log segment)
→ replicates to ISR (in-sync replicas)
→ acks producer when min.insync.replicas have written (acks=all)
```

### Read Path

```text
Consumer → fetch from partition leader (or follower if allow.replica.fetch=true)
→ specifies offset to start from
→ broker: find segment file via index (O(log n)) → read from offset → send batch
→ consumer processes → commits offset to __consumer_offsets topic
```

### Key Design Decisions

> **💡 Key Design Decision:** **Sequential disk writes** are the core performance insight. Appending to a log segment achieves ~500 MB/s on spinning disk and ~2 GB/s on NVMe — matching in-memory throughput. This is why Kafka can outperform many in-memory message queues.

> **💡 Key Design Decision:** **Zero-copy** via the `sendfile` syscall routes data from disk page cache directly to the socket buffer, bypassing user space entirely. This alone reduces CPU usage by ~50% on the read path.

> **💡 Key Design Decision:** **Consumer groups** enforce that each partition is consumed by exactly one consumer within a group. With 10 partitions, you get up to 10 consumers processing in parallel. Adding more consumers beyond partition count yields no benefit.

```text
Sequential disk writes:
  ~500MB/s on spinning disk, ~2GB/s on NVMe.
  Much faster than random writes. This is why Kafka can match memory throughput.

Zero-copy (sendfile syscall):
  Disk → page cache → socket buffer (bypasses user space).
  Reduces CPU usage by ~50% for read path.

Consumer groups:
  Each partition consumed by exactly one consumer in a group.
  Allows horizontal scaling: 10 partitions → up to 10 consumers in parallel.
  Rebalancing: consumer joins/leaves → Kafka reassigns partitions via Group Coordinator.

Offset management:
  Stored in __consumer_offsets topic (special Kafka topic).
  Consumer commits: after processing (at-least-once) or before (at-most-once).
```

> 🌍 **Real-World:** LinkedIn processes 7 trillion messages/day across 100+ Kafka clusters — their largest cluster handles 5M messages/second sustained. The sequential disk write design means Kafka brokers saturate network bandwidth before disk I/O becomes a bottleneck. Robinhood uses Kafka as the event backbone for their trading platform — every order event, execution, and account update flows through Kafka, giving them a replay capability that proved critical for post-incident auditing during the 2021 GameStop trading halt.

---

## 5. Search Engine

### Functional Requirements

```text
Index documents (web pages or products).
Full-text search with ranking by relevance.
Filters: by date, category, price range.
Autocomplete / type-ahead.
Typo tolerance.
```

### Non-Functional Requirements

```text
1B documents indexed.
p99 query latency < 100ms.
Fresh index (new docs appear within minutes).
```

### Architecture

```text
Indexing Pipeline:
  Crawler/Source → Kafka → Indexer Service → Elasticsearch

Indexer Service per document:
  1. Parse, extract text, normalize (lowercase, strip HTML)
  2. Tokenize: "Running Shoes" → ["running", "shoes"] (stemming → "run", "shoe")
  3. Remove stop words: "the", "a", "of"
  4. Build inverted index entry: word → {doc_id, position, frequency}
  5. Bulk write to Elasticsearch

Elasticsearch internals:
  Inverted index: term → list of (doc_id, term_frequency, positions)
  BM25 scoring: relevance = f(term_freq_in_doc, doc_freq_in_corpus, doc_length)
  Sharded: index split across N shards. Query hits all shards, results merged.

Query Path:
  Client → API Gateway → Search Service
  Search Service → Elasticsearch (query DSL)
  → Elasticsearch: parse query → fetch posting lists → score → top-K results
  → Search Service: augment with metadata (images, prices from DB/Redis)
  → Return ranked results
```

### Autocomplete

> **💡 Key Design Decision:** Store pre-computed top-K completions per prefix in a **Redis sorted set** keyed by popularity score. Background jobs recompute these from query logs hourly. This gives O(1) autocomplete lookups without querying Elasticsearch on every keystroke.

```text
Data structure: Trie or n-gram index
Implementation: prefix → top-K completions (pre-computed, stored in Redis)
```

```bash
# Redis key: autocomplete:{prefix} → sorted set {term: popularity_score}
ZREVRANGE autocomplete:iphon 0 4  # → top 5 completions for "iphon"
```

```text
Update: background job recomputes top completions from query logs every hour.
```

### Ranking Signals (Beyond BM25)

```text
PageRank equivalent: document authority (how many other docs link to it)
Click-through rate: docs users click get boosted
Freshness: newer docs ranked higher for recent queries
Personalization: user's past queries and clicks boost similar results
```

> **⚠️ Scale Challenge:** With 1B documents across N shards, every query fans out to all shards and merges results. Shard count must be chosen carefully — too few shards means large shards that are slow to query; too many means high fan-out overhead and memory pressure from open index segments.

> 🌍 **Real-World:** Google Search indexes 100B+ web pages using a custom distributed inverted index called "Caffeine" — it rebuilds the index continuously rather than in batch, so new content appears in search results within minutes instead of days. Elasticsearch powers search at Airbnb (listing search), LinkedIn (people search), and Wikipedia (site search). Uber's search infrastructure uses Elasticsearch to power real-time autocomplete for addresses — they pre-warm the index with top-searched locations and run Lucene query caching to keep p99 latency under 50ms even during peak demand.

---

## 6. Payment System

### Functional Requirements

```text
Process payments (card, wallet, UPI, bank transfer)
Refunds, chargebacks
Support idempotent retries
Reconciliation (ensure our records match payment gateway records)
Support for multi-currency
```

### Non-Functional Requirements

```text
ACID: double-spend must be impossible
Idempotency: retrying a payment must not charge twice
p99 < 3s (gateway latency included)
Regulatory: PCI-DSS compliance (card data never touches our servers)
```

### Architecture

```text
Client → API Gateway (auth, rate limit) → Payment Service
       → Payment Gateway (Stripe / Adyen / Razorpay)
       → Bank / Card Networks

Payment Service:
  1. Validate request (amount, currency, idempotency key)
  2. Create payment record in DB (status: PENDING)
  3. Call payment gateway
  4. Update DB (status: COMPLETED or FAILED)
  5. Publish payment_completed event to Kafka
```

### Schema

```sql
CREATE TABLE payments (
    id              UUID PRIMARY KEY,
    idempotency_key UUID UNIQUE NOT NULL,  -- client-generated, prevents duplicates
    user_id         UUID NOT NULL,
    amount_cents    BIGINT NOT NULL,
    currency        CHAR(3) NOT NULL,
    status          TEXT NOT NULL,         -- PENDING, COMPLETED, FAILED, REFUNDED
    gateway         TEXT,                  -- stripe, razorpay
    gateway_txn_id  TEXT,                  -- gateway's transaction ID
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_idempotency ON payments(idempotency_key);
```

### Key Design Decisions

> **💡 Key Design Decision:** **Idempotency key** (UUID sent by the client) is the single most important safety mechanism. `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` ensures that even if the client retries due to a timeout, the payment is executed exactly once.

> **💡 Key Design Decision:** **Double-spend prevention** uses row-level locking: `SELECT balance FOR UPDATE → check → UPDATE → COMMIT`. The `FOR UPDATE` lock prevents two concurrent requests from both reading the same balance and both proceeding with a debit.

> **⚠️ Scale Challenge:** Payment gateways add 1–3s of external latency. Never hold a DB transaction open while waiting for the gateway response. Use a **two-phase approach**: Phase 1 (INITIATE) calls the gateway and stores a `payment_intent_id`; Phase 2 (CONFIRM) handles the webhook callback from the gateway.

```text
Idempotency:
  Client sends idempotency_key (UUID) with every payment request.
  INSERT INTO payments ... ON CONFLICT (idempotency_key) DO NOTHING
  If same key arrives again: return existing payment record, don't charge twice.

Double-spend prevention:
  Wallet debit: SELECT balance FOR UPDATE → check → UPDATE → COMMIT
  Row-level locking prevents concurrent debit of same wallet.

Two-phase approach for async gateways:
  Phase 1: INITIATE — call gateway, receive payment_intent_id
  Phase 2: CONFIRM — webhook from gateway confirms success/failure
  Status state machine: PENDING → AUTHORIZED → CAPTURED / FAILED

Reconciliation (daily job):
  Fetch all transactions from gateway API for yesterday.
  Compare with our DB records.
  Flag discrepancies: our DB shows COMPLETED but gateway shows FAILED.
  Alert ops team for manual review.

PCI-DSS:
  Never store raw card numbers. Use gateway's tokenization.
  Card token is stored, not the PAN.
  HTTPS everywhere. Audit logs for all access to payment data.
```

> 🌍 **Real-World:** Stripe processes hundreds of billions of dollars annually using idempotency keys as their primary double-charge protection — every API endpoint accepts an `Idempotency-Key` header, and Stripe stores the response for 24 hours so retrying the same request returns the cached result rather than executing again. PayPal's payment processing system uses optimistic locking with a `version` column on the wallet table — two concurrent debits try to UPDATE WHERE version=N, only one succeeds (the other sees version mismatch and retries), avoiding the SELECT FOR UPDATE lock overhead at scale. Square runs daily reconciliation jobs comparing their internal ledger against Visa/Mastercard settlement files to catch gateway discrepancies before they become customer disputes.

---

## 7. Trading Exchange

### Functional Requirements

```text
Place orders: market, limit, stop-loss
Order matching: price-time priority
Order book display (live bids/asks)
Trade execution and settlement
Account balance management
```

### Non-Functional Requirements

```text
Throughput: 100K orders/second
Matching latency: < 1ms (median)
Strong consistency: no double-spend, correct matching
Audit trail: every state change logged immutably
```

### Order Matching Engine

> **💡 Key Design Decision:** The **Matching Engine** runs as a **single thread per trading pair**. This eliminates locking entirely — sequential processing guarantees deterministic, correct matching without any synchronization overhead. This is the LMAX Disruptor pattern.

```text
Order Book (in-memory, per trading pair):
  Bid side: sorted by price DESC, then timestamp ASC (max-heap by price)
  Ask side: sorted by price ASC, then timestamp ASC (min-heap by price)

Data structures:
  Use a balanced BST or sorted linked list for price levels.
  Each price level: queue of orders (FIFO within same price)
  Time complexity: O(log N) insert/cancel, O(1) best bid/ask

Matching algorithm (price-time priority):
  Incoming BUY order at price P:
    While order not fully filled:
      best_ask = ask_side.min_price()
      if best_ask <= P:
        fill against best_ask's orders (FIFO)
        update quantities, generate trade event
      else: add to bid side at price P

  Incoming SELL order: symmetric — match against best bid.
```

### Architecture

```text
Gateway → Order Service → (validate, authorize) → Matching Engine

Matching Engine: SINGLE THREAD per trading pair.
  Eliminates locking entirely. Sequential processing = deterministic.
  Event loop: process one order at a time.

Events published to Kafka:
  order_placed, order_matched, order_cancelled, trade_executed

Settlement Service (async):
  Consumes trade_executed events
  Updates buyer/seller balances
  Eventual settlement (T+2 for equities, T+0 for crypto)

Order Book Distribution:
  Market Data Service publishes order book snapshots every 100ms.
  Clients subscribe via WebSocket for live updates.
```

### Persistence and Recovery

> **💡 Key Design Decision:** **Event Sourcing** makes recovery from a crash trivial. Every order event is appended to an immutable Kafka log. On restart, replay the log from the latest snapshot to reconstruct the full in-memory order book. Snapshots cap the replay window.

```text
Matching Engine crashes → how to recover order book?

Event Sourcing approach:
  Every order event written to an immutable event log (Kafka).
  On startup: replay from beginning of event log → reconstruct order book.
  Snapshotting: every N events, write full order book snapshot.
  On startup: load latest snapshot + replay events after snapshot.

Latency considerations:
  Matching Engine runs in-memory → L1/L2 cache → < 1ms matching.
  No DB in the critical path. DB writes happen async after matching.
```

> 🌍 **Real-World:** LMAX Exchange (the London-based financial exchange) pioneered the single-threaded matching engine pattern using their Disruptor ring buffer — their matching engine processes 6M orders/second on a single thread by eliminating all locking and leveraging CPU cache locality. NYSE's Pillar matching engine similarly uses a single-threaded event loop per trading symbol and achieves median matching latency of 38 microseconds. Coinbase uses an event-sourced order book where every order lifecycle event is written to a Kafka topic — during their 2021 outages caused by extreme crypto volatility, they could replay the event log to audit exactly which orders were matched and when.

---

## 8. Stock Broker Platform

### Functional Requirements

```text
User onboarding (KYC verification)
Portfolio management (holdings, P&L)
Order placement (routed to exchange)
Market data (real-time quotes, charts)
Reports: tax documents, trade history
```

### Non-Functional Requirements

```text
SEBI / SEC compliance
End-of-day settlement
Data retention: 7+ years (regulatory)
Auditability: every action logged
```

### Architecture

```text
Client App → API Gateway (auth + rate limit)

Services:
  Auth Service:      login, JWT tokens, session management
  KYC Service:       identity verification via third-party (DigiLocker, PAN API)
  Order Service:     place/cancel orders → route to exchange via FIX protocol
  Portfolio Service: real-time P&L based on market prices + holdings
  Market Data:       subscribe to exchange feed, normalize, distribute via WebSocket
  Reporting:         async generation of tax documents, statements (S3 + pre-signed URL)

FIX Protocol (Financial Information eXchange):
  Standard for order routing to exchanges.
  Order flows: NewOrderSingle → ExecutionReport (filled/rejected)
  Position: persistent FIX session (TCP), heartbeats every 30s.

Holdings and P&L:
  Holdings stored in Postgres: user_id, symbol, quantity, avg_cost_price
  Real-time P&L: (current_price - avg_cost_price) * quantity
  Current prices from Redis (updated by market data service from exchange feed)
```

> **💡 Key Design Decision:** **Real-time P&L** is computed on-the-fly by combining static holdings data (Postgres) with live prices (Redis). Storing pre-computed P&L would require constant writes on every price tick — instead, compute it at read time from two fast sources.

> **⚠️ Scale Challenge:** The **Market Data** service must handle a high-frequency exchange feed and fan it out to millions of WebSocket clients. A pub/sub layer (Redis Pub/Sub or Kafka) sits between the raw feed consumer and the WebSocket gateway to decouple ingestion rate from delivery rate.

> 🌍 **Real-World:** Zerodha (India's largest retail broker by order volume) built their entire platform on a microservices architecture where real-time P&L is computed by joining holdings from PostgreSQL with live tick data from NSE/BSE feed stored in Redis — this on-the-fly computation avoids storing redundant P&L values that would require writes on every price tick. Robinhood distributes real-time market data to 22M+ users over WebSocket connections using a pub/sub system that batches price updates into 250ms windows to prevent overwhelming client devices with per-tick updates.

---

## 9. Rate Limiter

### Functional Requirements

```text
Limit requests per user/IP/API key
Per-endpoint limits (e.g., 100 req/min for /login, 1000 req/min for /search)
Return 429 with Retry-After header on breach
Configurable limits per tier (free: 100/min, premium: 10K/min)
```

### Non-Functional Requirements

```text
Add < 1ms to request latency
Accurate (not approximate) for security-critical endpoints
Distributed (multiple API gateway instances must share state)
```

### Algorithms

#### Token Bucket

> **💡 Key Design Decision:** **Token Bucket** allows controlled bursting — a user can send up to `C` requests instantly but is throttled to `R/s` sustained. The Redis Lua script runs atomically, so there are no race conditions between the read-compute-write steps.

```text
Each user gets a bucket of capacity C with tokens.
Tokens added at rate R per second (up to capacity C).
Each request consumes 1 token. If empty: reject (429).

Allows bursts up to C but limits sustained rate to R/s.
Good for: APIs where short bursts are OK.

Redis implementation:
  key: rate:{user_id}:{endpoint}
  value: current tokens (float, supports partial tokens)
  Script (Lua, runs atomically):
    tokens += min(capacity, tokens + rate * elapsed_time)
    if tokens >= 1: tokens -= 1; return ALLOW
    else: return DENY
  Update last_refill_time on each request.
```

#### Sliding Window Log

```text
Store timestamp of each request in a sorted set.
On each request:
  Remove entries older than window_start (ZREMRANGEBYSCORE)
  Count entries in window (ZCARD)
  If count < limit: add current timestamp (ZADD), allow
  Else: deny

Accurate but memory-intensive: O(requests_per_window) per user.
Good for: security-critical endpoints (rate limiting is exact)
```

#### Fixed Window Counter

```text
key: rate:{user_id}:{endpoint}:{window_start}
INCR → if result <= limit: allow; else: deny
TTL = window size (auto-cleanup)

Pros: simple, O(1) memory
Cons: boundary burst — 100 req at 11:59:59 + 100 req at 12:00:01 = 200 req in 2 seconds
```

#### Sliding Window Counter (Approximate)

> **💡 Key Design Decision:** The **Sliding Window Counter** approximation is used by Cloudflare at scale. It gives O(1) memory with accuracy within a few percent — good enough for rate limiting without the memory cost of storing per-request timestamps.

```text
Combine previous + current window counts with time-weighted estimate.
previous_window_count * (time_remaining_in_current_window / window_size)
  + current_window_count

Good approximation. O(1) memory. Used by Cloudflare.
```

### Distributed Rate Limiting

> **⚠️ Scale Challenge:** Each Redis round-trip adds ~0.5ms to request latency, which can violate the < 1ms overhead requirement. The local token bucket + periodic Redis sync pattern reduces this to near-zero overhead under normal load, accepting a small over/under accuracy during the sync interval.

```text
All API gateway instances → shared Redis cluster for rate limit counters.
Problem: Redis round-trip adds ~0.5ms per request.

Optimization: local token bucket (in-process) with periodic sync to Redis.
  - Each instance has N/instance_count tokens locally.
  - Every 100ms: sync with Redis (get real count, redistribute tokens).
  - Under normal load: local check = 0 network hops.
  - On sync: catch up with actual usage across all instances.
  - Tradeoff: slightly over/under limits during 100ms sync interval.
```

> 🌍 **Real-World:** Cloudflare rate-limits 25M+ HTTP requests/second across their network using the sliding window counter approximation stored in their distributed key-value store — they chose the approximate algorithm specifically because it gives O(1) memory with <1% error, acceptable for DDoS protection. GitHub's API rate limiter uses the token bucket algorithm backed by Redis with separate limits per authenticated user (5,000 req/hour) and per IP for unauthenticated requests (60 req/hour). Stripe's rate limiter uses a hierarchical token bucket: per-API-key limits nest inside per-account limits, so a single misbehaving API key can't exhaust an enterprise customer's entire quota.

---

## 10. Distributed Scheduler

### Functional Requirements

```text
Schedule jobs: run at specific time, recurring (cron), delayed
Job types: one-time, cron, chained (job A triggers job B on success)
Retry on failure with backoff
Dead letter queue for repeatedly failing jobs
Job history and status UI
```

### Non-Functional Requirements

```text
Handle 10M scheduled jobs
Trigger jobs within 1 second of scheduled time
Exactly-once execution (critical: billing jobs should not run twice)
Durable: scheduler crash must not lose scheduled jobs
```

### Architecture

```text
Job Submission API → Postgres (job definitions + schedule)

Scheduler Service:
  Leader election (via ZooKeeper or Postgres advisory lock).
  Only 1 leader runs at a time (prevents double-scheduling).
  
  Leader poll loop (every 1 second):
    SELECT * FROM jobs WHERE next_run_at <= NOW() AND status = 'PENDING'
    FOR UPDATE SKIP LOCKED   ← key: allows multiple scheduler threads safely
    LIMIT 100
    
    For each job: publish to Kafka or push to worker via gRPC
    UPDATE jobs SET status = 'RUNNING', last_run_at = NOW()

Worker Pool:
  Consumes from Kafka or receives direct push.
  Executes the job (HTTP callback, internal function, shell command).
  Reports result back to Scheduler Service.
  
  On success: UPDATE status = 'COMPLETED', compute next_run_at (for cron)
  On failure: increment retry_count, compute retry_at with backoff
  Max retries exceeded: move to DLQ, status = 'FAILED'
```

### Schema

```sql
CREATE TABLE jobs (
    id               UUID PRIMARY KEY,
    name             TEXT NOT NULL,
    type             TEXT NOT NULL,  -- one_time, cron, chain
    cron_expression  TEXT,           -- "0 * * * *" = every hour
    payload          JSONB,          -- passed to executor
    status           TEXT DEFAULT 'PENDING',
    next_run_at      TIMESTAMPTZ NOT NULL,
    last_run_at      TIMESTAMPTZ,
    retry_count      INT DEFAULT 0,
    max_retries      INT DEFAULT 3,
    timeout_seconds  INT DEFAULT 300,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_next_run ON jobs(next_run_at) WHERE status = 'PENDING';
```

### Key Design Decisions

> **💡 Key Design Decision:** `FOR UPDATE SKIP LOCKED` is the key to safe concurrent polling. Multiple scheduler threads can each run the poll query simultaneously — `SKIP LOCKED` ensures each row is claimed by exactly one thread, eliminating double-scheduling without a single-leader bottleneck for job dispatch.

> **💡 Key Design Decision:** **Exactly-once execution** is enforced by an idempotency key per run: `(job_id + run_number)`. The worker checks whether this key was already processed before executing. Combined with `SKIP LOCKED`, this provides a two-layer guard against duplicate execution.

```text
Exactly-once execution:
  Idempotency key per job run: (job_id + run_number)
  Worker checks if key already processed before executing.
  Postgres SKIP LOCKED: ensures no two workers pick the same job row.

Leader election:
  Option 1: Postgres advisory lock (pg_try_advisory_lock(12345))
    Simple. No external dependency. Works for moderate scale.
  Option 2: ZooKeeper ephemeral node
    More robust. Automatic release on crash.

Cron parsing:
  Parse cron expression to get next_run_at.
  Libraries: quartz-cron (Java), robfig/cron (Go)
  Edge cases: daylight saving time, leap years, end-of-month

Handling large job volumes:
  Partition by job type or tenant.
  Multiple scheduler instances, each responsible for a partition.
  Use consistent hashing to assign partitions to schedulers.
```

> 🌍 **Real-World:** Airbnb's "Chronos" distributed scheduler runs 10,000+ cron jobs managing price updates, email campaigns, and data pipeline triggers — it uses ZooKeeper for leader election so only one scheduler instance dispatches jobs at a time, preventing duplicate execution. Shopify's job scheduling system handles tens of millions of recurring jobs (subscription billings, report generation) using Sidekiq backed by Redis sorted sets, where the score is the scheduled Unix timestamp — a background thread scans for jobs with score ≤ now() and moves them to the execution queue. Pinterest's "Pinball" workflow scheduler (open-sourced) uses a token-passing model for exactly-once execution that influenced the design of Apache Airflow.


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Canonical Designs)

| System | Must-nail deep dives | Done |
|--------|----------------------|------|
| URL Shortener | ID gen, 301 vs 302, DB schema, cache | [ ] |
| Rate Limiter | Token/leaky/sliding; Redis Lua; distributed | [ ] |
| Notification | Priority queues, templates, idempotency, fan-out | [ ] |
| News Feed | Hybrid fan-out, ranking, celebrity problem | [ ] |
| Chat | WS, fan-out, Cassandra timeuuid, presence | [ ] |
| Video | Upload, CDN, transcoding pipeline, adaptive bitrate | [ ] |
| Scheduler | SKIP LOCKED, leader election, exactly-once | [ ] |
| Search | Inverted index, ranking, indexing pipeline | [ ] |

> ⭐ **IMPORTANT CONCEPT:** For each canonical design, memorize **decisions**, not boxes — ID strategy, consistency, and failure handling.

---

## 🛠️ PRACTICAL — Design Labs

### Lab 1: 45-min Blind Redesign
Pick 2 systems above. No notes. Timer. Self-score with Mock-Interviews HLD rubric.

### Lab 2: Scale Shock
After design, interviewer says "10× traffic tomorrow." List top 3 bottlenecks and mitigations in 5 minutes.

### Lab 3: Consistency Probe
For each design, answer: where is strong consistency required? where is eventual OK?
