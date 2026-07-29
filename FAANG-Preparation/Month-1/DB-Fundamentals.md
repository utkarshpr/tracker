# Database Internals — Complete Study Notes (Basics → Senior Depth)

> Covers PostgreSQL unless otherwise specified. MySQL/InnoDB differences called out explicitly.
> Self-contained. No internet needed. Every concept explained inline.

---

## Table of Contents

1. [Database Basics (Start Here)](#0-database-basics-start-here)
2. [B+ Tree Internals](#1-b-tree-internals)
3. [Query Optimizer (PostgreSQL Planner)](#2-query-optimizer-postgresql-planner)
4. [MVCC (Multi-Version Concurrency Control)](#3-mvcc-multi-version-concurrency-control)
5. [WAL (Write-Ahead Log)](#4-wal-write-ahead-log)
6. [Locking](#5-locking)
7. [Isolation Levels and Concurrency Anomalies](#6-isolation-levels-and-concurrency-anomalies)
8. [NoSQL Internals](#7-nosql-internals)
9. [Distributed Transactions and CDC](#8-distributed-transactions-and-cdc)
10. [Production War Stories and Interview Traps](#9-production-war-stories-and-interview-traps)
11. [Quick-Reference Interview Cheatsheet](#10-quick-reference-interview-cheatsheet)
12. [Real-World Database Usage](#real-world-database-usage)
13. [MySQL / InnoDB Deep Dive](#13-mysql--innodb-deep-dive)
14. [Apache Cassandra Deep Dive](#14-apache-cassandra-deep-dive)
15. [MongoDB Deep Dive](#15-mongodb-deep-dive)
16. [Redis Deep Dive](#16-redis-deep-dive)
17. [Elasticsearch Deep Dive](#17-elasticsearch-deep-dive)
18. [TimescaleDB Deep Dive](#18-timescaledb-deep-dive)
19. [ClickHouse Deep Dive](#19-clickhouse-deep-dive)
20. [CockroachDB Deep Dive](#20-cockroachdb-deep-dive)

---

## 0. DATABASE BASICS (Start Here)

### What a Database Is

A database is a system for **storing, retrieving, and managing structured data durably**. "**Durable**" means data survives crashes. "**Structured**" means you can query it efficiently, not just scan files.

### Relational vs NoSQL — When to Use What

| | **Relational** (PostgreSQL, MySQL) | **Document** (MongoDB) | **Key-Value** (Redis) | **Wide-Column** (Cassandra) | **Search** (Elasticsearch) |
|---|---|---|---|---|---|
| **Data model** | Tables, rows, joins | JSON documents | Key → Value | Rows with dynamic columns | Inverted index |
| **Query** | SQL, joins across tables | Query by any field | Get/Set by key | Query by partition key | Full-text, aggregations |
| **Consistency** | Strong (ACID) | Tunable | None (unless Redis Cluster) | Tunable (CAP: AP) | Eventually consistent |
| **Scale writes** | Vertical + read replicas | Horizontal sharding | Single node or cluster | Horizontal natively | Horizontal |
| **Use for** | Financial data, user records, anything with relationships | User profiles, product catalogs | Sessions, caches, counters | Time-series, IoT, high-write | Search, log analysis |

### ACID Properties (Basics)

Every relational database transaction must be:

- **Atomic**: all or nothing. Either all changes in a transaction commit, or none do. No partial state.
- **Consistent**: transaction takes DB from one valid state to another. Constraints (FK, UNIQUE, CHECK) always satisfied.
- **Isolated**: concurrent transactions behave as if they ran serially. One transaction's intermediate state is invisible to others.
- **Durable**: committed transactions survive crashes. Written to disk (via WAL), not just memory.

> 🌍 **Real-World:** Stripe's payment processing relies on ACID transactions in PostgreSQL to guarantee that charging a card and recording the transaction either both succeed or both fail — partial states would mean charging customers without recording payment, a critical correctness requirement for any payment system.

> 🌍 **Real-World:** Bank of America and other financial institutions use ACID-compliant databases for double-entry bookkeeping: every debit must have a matching credit. Atomicity ensures a transfer that debits one account always credits the other — no money is ever created or destroyed in the system.

### Basic SQL Operations

```sql
-- Create table
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- CRUD
INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice');
SELECT id, email, name FROM users WHERE email = 'alice@example.com';
UPDATE users SET name = 'Alice Smith' WHERE id = 1;
DELETE FROM users WHERE id = 1;

-- Joins
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
HAVING COUNT(o.id) > 5
ORDER BY order_count DESC
LIMIT 10;

-- Index creation
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);

-- Transaction
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT; -- or ROLLBACK on error
```

### When to Add an Index

- **Add**: columns in WHERE, JOIN ON, ORDER BY, GROUP BY.
- **Don't add**: low-cardinality columns (boolean, status with 3 values) unless used with other high-cardinality columns.
- **Every index**: slows down INSERT/UPDATE/DELETE (must update index too), uses disk space.
- **Rule of thumb**: measure with `EXPLAIN ANALYZE` before and after.

> 🌍 **Real-World:** Instagram's feed uses PostgreSQL with a composite index on `(user_id, created_at DESC)` — querying millions of posts reduces to an index scan of just the user's rows, making per-user feed lookups sub-millisecond even at 100M+ user scale.

### Connection Pooling (Basics)

- **Problem**: creating a DB connection is expensive (TCP handshake + auth = 10–50ms). At 1,000 RPS you can't create a new connection per request.
- **Solution**: maintain a pool of pre-created connections, reuse them.
- **PostgreSQL**: each connection = OS thread (~5MB memory). Max 100–200 connections before performance degrades.
- **PgBouncer**: connection pooler in front of PostgreSQL. App → PgBouncer (thousands of connections) → PostgreSQL (50–100 connections).

> 🌍 **Real-World:** Shopify runs PgBouncer in transaction mode in front of every PostgreSQL instance — their Rails app processes open thousands of connections, but PgBouncer funnels them down to ~100 actual Postgres connections, cutting connection overhead by 90% and allowing the DB server RAM to be used for data caching instead of connection state.

---

## 1. B+ Tree Internals

> ⭐ **IMPORTANT CONCEPT:** Almost every relational index discussion starts with B+ Trees — leaf linked lists enable range scans.

### Structure: Why B+ and Not B-Tree

A **B-tree** stores data in both internal and leaf nodes. A **B+ tree** stores ALL data in leaf nodes; internal nodes are pure "fence post" separators. This distinction matters enormously in practice:

- **Range scans**: B+ tree leaf nodes form a doubly linked list. A range scan `WHERE id BETWEEN 1 AND 10,000` traverses the leaf level sequentially without returning to the root. With a B-tree, you'd have to re-traverse the tree for every key hit in an internal node.
- **Cache efficiency**: Internal nodes in a B+ tree are ONLY keys. More keys per internal page = higher fan-out = shallower tree = fewer I/Os.

### Fan-Out: The Core Insight

PostgreSQL default page size is **8KB**. InnoDB default is **16KB**.

With 8KB pages, 4-byte integer keys, and 6-byte page pointers: roughly `8,192 / (4+6) = ~820` keys per internal node, giving fan-out ~820. In practice with headers, alignment, and fill factor it's closer to **100–400** for integer keys.

With fan-out 200:
- **1 level**: 200 leaf pages = ~1.5M rows (assume 100 rows/page at ~80 bytes/row)
- **2 levels**: 200² = 40,000 leaf pages = ~300M rows
- **3 levels**: 200³ = 8 million pages — effectively any table you'll encounter

> **💡 Key Insight:** For a 100M-row table, B+ tree height is 3–4. Every point lookup touches 3–4 pages. If those pages aren't in the buffer pool, that's 3–4 random I/Os. On NVMe at ~100µs per I/O, that's 300–400µs just for the B-tree traversal, before any tuple processing.

### Fill Factor (PostgreSQL: default 90 for B-tree indexes)

PostgreSQL creates index pages with 10% free space reserved. Why?

When a row is updated in a way that changes an indexed column, the old index entry must be deleted and a new one inserted. If pages are 100% full, every update causes a page split. At 90%, common update patterns (updates staying on the same page) can be absorbed without splits.

For **insert-only** workloads (append-only timeseries, logs), set `fillfactor=100` — you'll never update, so the empty space is pure waste. For tables with heavy in-place updates (order status, user profiles), keep it at 90 or even lower (70–80).

> 🌍 **Real-World:** Uber's trip-status table (hundreds of millions of rows updated as trips progress through states) uses a lower fill factor on its status indexes specifically to enable HOT updates — keeping the new tuple version on the same page avoids index bloat that would otherwise require nightly maintenance windows.

```sql
CREATE INDEX idx_orders_status ON orders(status) WITH (fillfactor = 70);
```

### Page Splits: The Write Amplification Problem

When an insert targets a full page, PostgreSQL must split:

1. Allocate a new page
2. Move half the entries to the new page
3. Update the parent node with the new fence post key
4. If the parent is also full → split cascades upward
5. If root splits → new root created, tree height increases by 1

This is expensive for several reasons:

- **WAL amplification**: a split writes WAL records for the original page, the new page, AND the parent page modification. One logical insert = 3+ WAL records.
- **Concurrent deadlocks**: PostgreSQL takes exclusive locks on the pages being split. In a high-concurrency environment with sequential inserts (e.g., auto-increment IDs hitting the rightmost leaf), all transactions contend on the same page — this is the **"right-hand lock" hotspot**.
- **InnoDB behavior**: InnoDB splits the page 50/50 by default. For sequential inserts, this wastes 50% of each page on average. InnoDB detects sequential insert patterns and does a 0/100 split (just creates new page) — this is why sequential primary keys perform better than UUIDs in InnoDB.

> **📖 War Story:** A team at a large payment processor inserted ~50,000 transactions/second with UUID primary keys. Random distribution across the B-tree meant every insert required a page from a different part of the tree, defeating buffer pool caching entirely. P99 insert latency was 50ms. Switching to time-ordered **ULIDs** (which sort lexicographically by time) brought P99 to <2ms because recent inserts clustered on the rightmost leaf pages, staying hot in buffer pool.

### Bulk Loading: Sort First, Load Bottom-Up

PostgreSQL's `COPY` + `CREATE INDEX` after load is dramatically faster than inserting with an index present:

1. `COPY` loads data into heap without maintaining index.
2. `CREATE INDEX` reads all rows, sorts in memory (using `maintenance_work_mem`), then writes leaf pages in order, builds internal nodes from the leaf level up — NO splits ever happen.
3. Fill factor is applied differently during bulk build — PostgreSQL targets exact fill factor from the start.

For really large tables: `SET maintenance_work_mem = '4GB'` before `CREATE INDEX` — the sort happens in memory instead of spilling to disk via temp files.

### PostgreSQL Index Types: When to Use What

#### B-tree (default)

- Operators: `=`, `<`, `<=`, `>`, `>=`, `BETWEEN`, `IN` (sometimes), `LIKE 'prefix%'` (NOT `LIKE '%suffix'`)
- The workhorse. 99% of your indexes.
- **Multi-column**: order matters. `(a, b)` serves queries on `a` alone or `(a, b)` together, but NOT `b` alone (unless PostgreSQL can do "skip scan" — it cannot for B-tree as of PG16).

#### Hash

- Only `=`. No range support whatsoever.
- Before PostgreSQL 10: Hash indexes were NOT WAL-logged, meaning they didn't survive crashes. They were essentially useless for production. PG10 fixed this.
- Smaller than B-tree for point-lookup-only workloads. Use only when you're certain you'll never need range queries and the B-tree overhead is measurable.

#### GIN (Generalized Inverted Index)

- **Structure**: maps each element to a posting list of row IDs containing that element.
- **Use cases**: `jsonb` key/value lookup, `tsvector` full-text search, array containment (`@>`, `<@`).
- **Write amplification**: a single row with 1,000 JSON keys creates 1,000 GIN entries. Updates are painful — GIN has a "pending list" (a small unsorted list that's merged into the main structure during VACUUM or when it gets too large — controlled by `gin_pending_list_limit`, default 4MB).
- **Read**: very fast for "does array contain X?" — single lookup in posting list.

> **⚠️ Production Gotcha:** Inserting rows with large JSONB documents (say, 500 keys each) into a table with a GIN index on the jsonb column will be ~10x slower than without the index. Measure this. Often the right call is GIN on specific `jsonb` paths, not the whole document.

#### GiST (Generalized Search Tree)

- A framework for custom index types. Not a single algorithm.
- Used for: geometric types (PostGIS), range types, full-text search (less common vs GIN for FTS).
- **Approximate**: unlike B-tree, GiST can have false positives — a "recheck" against the heap row is always done.
- For spatial queries: `CREATE INDEX ON locations USING GIST(coordinates)` — enables `ST_DWithin`, `&&` (overlaps), `@>` (contains) operations.

#### BRIN (Block Range Index)

- **Structure**: stores min/max values per block range (default 128 pages per range).
- **Size**: tiny. A BRIN index on a 100GB table might be 128KB. A B-tree on the same table: several GB.
- Only useful when the indexed column is correlated with physical storage order — i.e., rows inserted in timestamp order, and you query by timestamp. The **correlation** between logical order and physical order (stored in `pg_stats.correlation`) must be close to 1.0 or -1.0.
- **Point lookups**: terrible. BRIN says "the value is in blocks 0–128 or blocks 512–640" — you scan all those pages.

> **💡 Key Insight:** Use BRIN for IoT timeseries tables where you only ever do range queries by time and the data is inserted in time order. Benchmark first — the I/O savings from the tiny index size vs the block range scan cost depends on your query selectivity.

#### Partial Index

```sql
CREATE INDEX idx_orders_pending ON orders(created_at) WHERE status = 'PENDING';
```

If 95% of your orders are in terminal states (COMPLETED, CANCELLED) and all queries target PENDING, a full index on `status, created_at` contains 95% useless data. The partial index is 20x smaller, fits in buffer pool, and every read hits only relevant rows. This is one of the highest-ROI index optimizations in production.

> 🌍 **Real-World:** GitHub uses partial indexes on their pull requests table to index only open PRs (`WHERE state = 'open'`) — since closed PRs are 95% of all rows, the partial index is ~20x smaller and fits entirely in the buffer pool, making "list open PRs for a repo" queries sub-millisecond even on repos with millions of historical PRs.

#### Covering Index (INCLUDE)

```sql
CREATE INDEX idx_orders_user ON orders(user_id) INCLUDE (status, total_amount);
```

The INCLUDE columns are stored only in leaf nodes (not internal nodes, so no fan-out impact). If a query needs only `user_id`, `status`, and `total_amount`, PostgreSQL can satisfy it entirely from the index — no heap fetch. This is an **index-only scan**.

> 🌍 **Real-World:** LinkedIn's "People You May Know" feature uses covering indexes on their member connections table — by including `connection_degree` and `last_interaction` in the index alongside the member ID, the recommendations query avoids touching the heap entirely, reducing latency from ~50ms to ~5ms for the most frequent access pattern.

### Index-Only Scans and the Visibility Map

The **visibility map** (one bit per heap page) records whether ALL tuples on a page are visible to ALL current and future transactions. This is maintained by VACUUM.

For an index-only scan to skip the heap fetch, the visibility map bit for the heap page must be set. If not set, even though the index has all the data, PostgreSQL fetches the heap page to check visibility (xmin/xmax).

> **⚠️ Production Gotcha:** On a table that's never VACUUMed (say, AUTOVACUUM is disabled or too slow), index-only scans degrade to regular index scans. This can cause 10x performance degradation after a bulk insert that outpaced autovacuum — the visibility map bits got cleared and every "index-only scan" suddenly required heap fetches.

Monitor with:

```sql
SELECT idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'orders';
```

High `idx_tup_fetch` / `idx_tup_read` ratio on a covering index indicates the visibility map isn't helping.

---

## 2. Query Optimizer (PostgreSQL Planner)

### Cost Model: The Numbers That Matter

PostgreSQL's cost model is deliberately simplistic (it's a heuristic, not exact). It estimates:

```text
cost = seq_page_cost * N_seq_pages
     + random_page_cost * N_random_pages
     + cpu_tuple_cost * N_tuples
     + cpu_operator_cost * N_operator_calls
     + cpu_index_tuple_cost * N_index_tuples
```

Default values (from `pg_settings`):

| Parameter | Default | Notes |
|---|---|---|
| `seq_page_cost` | 1.0 | Baseline unit |
| `random_page_cost` | 4.0 | **Change this for SSD/NVMe** |
| `cpu_tuple_cost` | 0.01 | |
| `cpu_operator_cost` | 0.0025 | |

On spinning disk, a random I/O is ~100–200x slower than a sequential I/O. On NVMe, it's ~2–4x. Setting `random_page_cost = 1.1` on an NVMe-backed system tells the planner "random and sequential reads are almost equivalent" — which radically changes its preference between index scans (many random I/Os) and sequential scans (sequential I/O).

> **📖 War Story:** A team migrated from HDD RAID to NVMe but didn't update `random_page_cost`. The planner kept choosing sequential scans over index scans for moderately selective queries (5% selectivity) because the old cost model still penalized random I/O heavily. Queries that should run in 50ms via index scan were running in 2 seconds via seqscan. One config change fixed it.

### Statistics: What ANALYZE Computes

> 🌍 **Real-World:** Pinterest ran into catastrophic query plan regressions after bulk-loading 50M new pin records — the planner's stale histogram estimated 100 rows where the actual result was 500,000, causing it to choose a nested loop that ran for 30+ seconds. Adding `ANALYZE pins;` to their data pipeline immediately after bulk loads reduced P99 query latency from 30s back to <200ms.

`ANALYZE` samples ~30,000 rows (controlled by `default_statistics_target`, default 100, which samples ~300 pages) and computes for each column:

| Statistic | Description |
|---|---|
| **null_frac** | Fraction of NULLs |
| **avg_width** | Average byte width of values |
| **n_distinct** | Estimated number of distinct values. Negative = fraction of total rows (e.g., -0.5 means 50% of rows are distinct) |
| **most_common_values (MCV)** | List of most frequent values and their frequencies |
| **histogram_bounds** | Bucket boundaries for values not in MCV list |
| **correlation** | Pearson correlation between logical (index) order and physical (heap) order. 1.0 = perfectly correlated (good for index scan), 0.0 = random (expensive index scan) |

> **⚠️ Production Gotcha:** After a bulk load of 10M rows into a table that previously had 100,000 rows, statistics represent the old distribution. If you load all orders for a new customer (say, customer_id = 99999 didn't exist before and now has 500,000 orders), the planner estimates selectivity on `customer_id = 99999` based on old histograms — perhaps 10 rows. It chooses nested loop + index scan. Actual: 500,000 rows → the index scan becomes catastrophically slow vs a seqscan. Fix: `ANALYZE orders;` immediately after bulk loads. Or `ALTER TABLE orders ALTER COLUMN customer_id SET STATISTICS 1000;` followed by `ANALYZE` to get finer-grained histograms for high-cardinality columns.

**Extended statistics** (PostgreSQL 10+):

```sql
CREATE STATISTICS orders_stats ON customer_id, status FROM orders;
ANALYZE orders;
```

This captures correlation between columns. Without it, the planner assumes `customer_id` and `status` are independent. If PENDING orders are concentrated in a few customer IDs, the planner massively over-estimates rows for `WHERE customer_id = 123 AND status = 'PENDING'`.

### Join Algorithms: The Full Picture

#### Nested Loop Join

```text
for each row in outer:
    for each row in inner WHERE join_condition(outer_row):
        emit (outer_row, inner_row)
```

- **Complexity**: O(N × M) worst case, O(N × log M) with index on inner.
- PostgreSQL can use an index on the inner relation — this is the **"Index Nested Loop"** variant.
- **When it's the right choice**: outer relation is small (say, 10 rows from a WHERE clause), inner has an index. Example: `SELECT * FROM orders JOIN users ON orders.user_id = users.id WHERE orders.status = 'PENDING' AND orders.created_at > NOW() - INTERVAL '1 hour'` — if this returns 50 orders, 50 index lookups on `users` is fine.
- **When it's wrong**: both tables are large. 100,000 × 1M with an index on inner = 100,000 index lookups = potentially catastrophic if the index isn't cached.

#### Hash Join

> 🌍 **Real-World:** Airbnb's pricing analytics pipeline joins a 200M-row bookings table with a 5M-row listings table nightly. With `work_mem = 4MB` the hash join spilled to disk in 32 batches, taking 45 minutes. Bumping `work_mem` to 512MB for that session eliminated disk spill and brought the query down to 4 minutes — the hash table fit in RAM on the first pass.

- **Phase 1 (build)**: read the smaller table, hash each row on join key into an in-memory hash table.
- **Phase 2 (probe)**: read the larger table, for each row probe the hash table.
- **Memory**: `work_mem` (default 4MB — **this is dangerously low for modern systems**, set to 64–256MB for analytical workloads).
- **Batch mode**: if the hash table exceeds `work_mem`, PostgreSQL spills to disk. It creates multiple batches. Each row from the probe side is routed to the correct batch file. Then each batch file is joined in memory.
  - `EXPLAIN ANALYZE` shows: `Hash  (cost=...) (actual... Batches: 4 Memory Usage: 128,000kB)` — Batches > 1 means disk spill.
  - Fix: `SET work_mem = '512MB'` for the session, or increase globally.
- Works well for: large equi-joins where you can fit the smaller side in memory.

#### Merge Join

- Both inputs must be sorted on the join key.
- Walk two sorted lists simultaneously, emit matches.
- **Complexity**: O(N log N + M log M) for the sort phase, O(N + M) for the merge phase.
- If both inputs are already sorted (e.g., both come from index scans on the join key), sort phase is free.
- Great for: `SELECT * FROM orders o JOIN order_items oi ON o.id = oi.order_id ORDER BY o.id` — if both tables have indexes on `id` and `order_id`, this can be a pure merge join with no sort.

#### Join Order Optimization

With N tables, there are O(N!) possible join orderings. PostgreSQL uses **dynamic programming** for N ≤ 12 (controlled by `join_collapse_limit`), then falls back to **Genetic Query Optimizer (GEQO)** for more. GEQO is non-deterministic — running the same query twice may produce different plans. This can surprise people.

`SET join_collapse_limit = 1;` — forces PostgreSQL to respect the JOIN order you wrote. Use when you know the optimizer is making a bad choice.

### EXPLAIN ANALYZE: Reading It Like a Senior Engineer

```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING, FORMAT TEXT) SELECT ...;
```

Reading rules:

1. **Read bottom-up**: the deepest (most indented) node executes first.
2. **Loops**: "loops: 50" means this node executed 50 times. Multiply "actual rows" by loops to get total rows processed.
3. **actual rows vs estimated rows**: ratio > 10x or < 0.1x = bad statistics. This is where you start debugging slow queries.
4. **Buffers**: `shared hit=1,000 read=50` — 1,000 pages from buffer pool (fast), 50 from disk (slow). High `read` count on a cached table = buffer pool pressure.
5. **Startup cost vs total cost**: for LIMIT queries, the planner optimizes for startup cost. A nested loop with LIMIT 10 might be cheaper than a hash join even if total cost is higher, because you stop after 10 rows.

**Example annotation:**

```text
Hash Join  (cost=15234.00..89234.00 rows=5000 width=120)
           (actual time=234.123..1567.890 rows=4823 loops=1)
  Buffers: shared hit=12000 read=3000
  ->  Seq Scan on orders (cost=0.00..45000.00 rows=1000000 width=80)
      (actual time=0.100..890.000 rows=1000000 loops=1)
  ->  Hash  (cost=3000.00..3000.00 rows=50000 width=40)
      (actual time=120.000..120.000 rows=50000 loops=1)
        Buckets: 65536  Batches: 1  Memory Usage: 3072kB
```

What this tells you:

- Hash join between orders (1M rows) and another table (50,000 rows).
- The hash table fit in memory (Batches: 1, 3MB) — no disk spill.
- Estimated 5,000 rows output, got 4,823 — excellent statistics.
- 3,000 buffer reads from disk on the seq scan — orders table isn't fully cached, or we're scanning cold data.
- Total actual time ~1.5 seconds — mostly in the seq scan (890ms).

> **💡 Key Insight:** For queries over 1 second, always run with `BUFFERS`. The ratio of `hit` to `read` tells you if the bottleneck is I/O vs CPU. If it's I/O, investigate caching. If it's CPU, investigate CPU-intensive operations (regex, jsonb parsing, complex function calls).

---

## 3. MVCC (Multi-Version Concurrency Control)

> ⭐ **IMPORTANT CONCEPT:** MVCC is why readers don't block writers in Postgres — know xmin/xmax intuition for senior DB questions.

### PostgreSQL's Implementation: Tuple Headers

> 🌍 **Real-World:** Twitter's PostgreSQL databases handle ~6,000 tweets/second, relying on MVCC so that timeline reads (millions per second) never block on write operations. At that scale, even a 1ms lock wait per read would make the system unusable — MVCC's lock-free reads are the architectural foundation that makes concurrent reads and writes coexist without degrading latency.

Every heap tuple carries:

| Field | Description |
|---|---|
| `t_xmin` | XID of the transaction that inserted this tuple |
| `t_xmax` | XID of the transaction that deleted/updated this tuple (0 if active) |
| `t_ctid` | Points to the newest version of this tuple (for UPDATE chains) |
| `infomask` bits | Flags indicating if xmin/xmax are committed, in-progress, etc. |

A reader's snapshot is: "I started when transaction XID N was running. I can see all tuples where `xmin < N` AND `xmin` is committed AND (`xmax = 0` OR `xmax > N` OR `xmax` is not committed)."

> **💡 Key Insight:** Reads never acquire any row locks. A writer inserting/updating rows and a reader reading the same rows proceed concurrently without blocking each other. This is fundamentally different from lock-based concurrency (SQL Server with shared locks on reads, for example).

### Isolation Level Implementation

| Isolation Level | Snapshot Timing | Notes |
|---|---|---|
| **READ COMMITTED** (default) | Taken at each statement start | A transaction with multiple statements sees committed changes between statements. This is where "non-repeatable reads" occur. |
| **REPEATABLE READ** | Taken at transaction start | All statements in the transaction use the same snapshot. PostgreSQL's REPEATABLE READ also prevents phantom reads (unlike the SQL standard). |
| **SERIALIZABLE** | SSI — see section 6 | Full serializability via Serializable Snapshot Isolation. |

### UPDATE as Delete+Insert: The Bloat Problem

> 🌍 **Real-World:** A high-traffic e-commerce company (similar to Zalando) had an `orders` table receiving 2,000 status updates/second. After 3 months without tuning autovacuum, the table had grown from 50GB to 300GB despite the row count staying stable — dead tuples from MVCC updates had bloated it 6x. Fixing autovacuum settings reclaimed the space and dropped full-table scan time by 80%.

```sql
UPDATE orders SET status = 'COMPLETED' WHERE id = 1;
```

PostgreSQL does NOT modify the existing tuple in place. It:

1. Marks the old tuple's `t_xmax` with the current XID.
2. Inserts a new tuple with the new `status` value and `t_xmin` = current XID.
3. Updates the old tuple's `t_ctid` to point to the new tuple.

Now you have two versions of the same row. The old version is a **"dead tuple"** — invisible to new transactions once the update commits. But it remains physically on the page until VACUUM removes it.

> **⚠️ Production Gotcha:** A table receiving 1,000 UPDATEs/second accumulates dead tuples faster than autovacuum can clean them. The physical size grows. SeqScan performance degrades because you're reading more pages for the same logical row count. Index scans degrade because dead tuple pointers inflate index pages too.

Monitoring:

```sql
SELECT relname, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

If `dead_pct` > 20%, autovacuum is losing the race. Options:

- Tune autovacuum: `autovacuum_vacuum_cost_delay = 2ms` (default 20ms), `autovacuum_vacuum_scale_factor = 0.01` (default 0.2 — triggers at 1% dead tuples instead of 20%).
- `VACUUM ANALYZE tablename;` manually.
- `VACUUM FULL tablename;` — rewrites the entire table, reclaims disk space, takes ACCESS EXCLUSIVE lock (production outage territory).

### HOT Updates: The Optimization You Want

**HOT (Heap Only Tuple)** update conditions:

1. The UPDATE does NOT change any indexed column.
2. The new tuple version fits on the SAME heap page as the old version.

If both conditions are met, PostgreSQL does NOT insert a new index entry. The existing index entry for the old tuple is chain-followed to the new tuple via `t_ctid`. This avoids index bloat entirely for updates to non-indexed columns.

Example: `orders` table with index on `(id)`. Updating `status` (not indexed) — HOT update possible. Updating `user_id` (indexed) — cannot use HOT, new index entry required.

> **💡 Key Insight:** Fill factor matters for update-heavy tables: if pages are 100% full, there's no room on the same page for the new version, so HOT is impossible even if the column isn't indexed. Lower fill factor = more HOT updates = less index bloat = better performance.

Check HOT efficiency:

```sql
SELECT n_tup_hot_upd, n_tup_upd,
       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 2) AS hot_pct
FROM pg_stat_user_tables
WHERE relname = 'orders';
```

Target: `hot_pct` > 80% for heavily updated tables.

### Transaction ID Wraparound: The Most Feared PostgreSQL Problem

**XIDs** are 32-bit unsigned integers. PostgreSQL uses a circular comparison: any XID that is "in the past" relative to the current XID by more than 2^31 (~2.1 billion) is considered older. XIDs in the "future" (> 2^31 ahead) appear as if they haven't committed yet, making rows invisible.

**Freeze threshold**: PostgreSQL replaces old XIDs with `FrozenTransactionId` (XID 2 — special value that is "older than everything") during VACUUM. A **frozen tuple** is visible to all transactions regardless of snapshot.

| Parameter | Default | Description |
|---|---|---|
| `vacuum_freeze_min_age` | 50M | Don't freeze tuples younger than 50M transactions (they might still be in active snapshots). |
| `vacuum_freeze_table_age` | 150M | Force a full-table freeze scan when table age exceeds this. |
| `autovacuum_freeze_max_age` | 200M | Force autovacuum if table age exceeds this, regardless of dead tuple count. |

**The danger zone**: If a table is never vacuumed and accumulates 2 billion transaction-ages, its old tuples become visible as "future" transactions — they appear to not exist. PostgreSQL will refuse to accept new transactions and emit:

```text
ERROR: database is not accepting commands to avoid wraparound data loss
```

At this point you need: `vacuumdb --freeze --all` and hope. Or `pg_resetwal` (destructive — loses data).

Monitoring:

```sql
SELECT datname,
       age(datfrozenxid) AS xid_age,
       2147483647 - age(datfrozenxid) AS xids_remaining
FROM pg_database
ORDER BY xid_age DESC;
```

- Alert at **500M** remaining.
- Page-on-call at **200M** remaining.
- Crisis at **100M** remaining.

> **📖 War Story:** A high-volume transaction database (order processing, ~500 TPS) had autovacuum disabled by a previous DBA "for performance reasons." After 18 months, XID age hit 1.9 billion. The team had a 6-hour maintenance window where they ran `VACUUM FREEZE` on all tables. During that time, autovacuum was burning CPU at 100% and DML was slowed by 40%. The incident report became the internal standard for "never disable autovacuum."

---

## 4. WAL (Write-Ahead Log)

### The Fundamental Contract

WAL enforces the durability part of ACID. The rule: **a transaction's WAL records must be flushed to disk before the commit acknowledgment is returned to the client.**

The data pages themselves can be written to disk lazily (during checkpoints). Why is this safe? Because if the server crashes before a dirty data page reaches disk, WAL records contain enough information to reconstruct the change. Recovery replays WAL from the last checkpoint forward.

WAL records are typically small (describe what changed, not entire pages). This means:

1. **Sequential I/O**: WAL is append-only, always sequential writes — fast on any storage.
2. **Small writes**: a WAL record for a single row update might be 50–200 bytes vs 8KB for the full page.
3. **Batching**: multiple transactions' WAL records are buffered in `wal_buffers` (default 16MB) and flushed together — amortizes fsync cost.

> **⚠️ Production Gotcha:** `fsync = on` (default, never change in production): PostgreSQL calls `fsync()` on WAL files at commit. If `fsync = off`, data durability is lost — a power failure can corrupt the database in ways that even `pg_resetwal` can't fix.

`synchronous_commit = off`: a weaker durability option. Commits return to client before WAL is flushed. You trade durability (up to `wal_writer_delay` = 200ms of transactions can be lost on crash) for ~5x commit throughput. Useful for non-critical data (session logs, analytics events) but NOT for financial transactions.

### WAL Levels Explained

> 🌍 **Real-World:** Netflix uses PostgreSQL WAL at `wal_level=logical` to feed Debezium CDC pipelines into Kafka. Every billing record change streams to downstream microservices in real time — the WAL acts as a durable, ordered change log that downstream consumers replay independently, decoupling the billing database from the analytics and notification systems.

| WAL Level | Description | Use Case |
|---|---|---|
| **minimal** | Only records needed to recover from a crash. Does not record individual row changes in a way that external systems can parse. | Fastest, smallest. Bulk loads. |
| **replica** (default since PG9.0) | Records everything needed for physical streaming replication. Standbys get byte-for-byte identical copies of data pages. | HA standbys. |
| **logical** | Records old and new values of changed rows. Needed for logical replication, CDC (Debezium), and tools like `pg_logical`. Larger WAL, more CPU overhead (must log old values on UPDATE/DELETE). | CDC pipelines, cross-version upgrades. |

```sql
ALTER SYSTEM SET wal_level = 'logical';
SELECT pg_reload_conf(); -- won't take effect until restart for wal_level
```

### Full Page Writes: The Hidden Write Amplification

After each checkpoint, the **first modification** of any page writes the entire 8KB page to WAL, not just the changed bytes. Why?

On crash, the OS might have written only part of a page (**torn page**, partial write). WAL describes changes in terms of byte offsets within pages. If the page on disk is corrupt (partially written), applying WAL changes to it produces garbage. Writing the full page in the first post-checkpoint WAL record means recovery can always restore the page to a known-good state before applying delta WAL records.

> **⚠️ Production Gotcha:** On a write-heavy workload with frequent checkpoints, full page writes can 3–10x the WAL volume. The first write to every page after every checkpoint writes the full page.

`full_page_writes = off` — disables this. Dangerous unless you have:

1. Battery-backed write cache on your storage controller.
2. Storage that guarantees atomic sector writes.
3. OR you're using ZFS/ext4 with data journaling (which provides the same guarantee at the filesystem level).

For cloud instances (EBS, GCP PD, Azure Managed Disk): these provide atomic writes. Some teams disable `full_page_writes` on cloud for performance — but verify your cloud provider's atomicity guarantees first.

### Checkpoints: The Dirty Page Flush

A checkpoint:

1. Writes a checkpoint record to WAL (marks the "safe" recovery start point).
2. Flushes all dirty buffer pool pages to disk.
3. Writes another checkpoint record saying "checkpoint complete".

Recovery after crash: start from the last complete checkpoint, replay WAL forward.

| Parameter | Default | Description |
|---|---|---|
| `checkpoint_timeout` | 5 minutes | Maximum time between checkpoints. |
| `max_wal_size` | 1GB | Trigger a checkpoint if WAL has grown this much since last checkpoint. |
| `checkpoint_completion_target` | 0.9 | Spread the dirty page writes over 90% of the checkpoint interval — avoids a 5-minute burst of I/O every 5 minutes. |

> **⚠️ Production Gotcha:** I/O spike pattern: If `checkpoint_completion_target` is too low (say 0.5), half the I/O budget happens in the first half of the interval, then nothing. This creates sawtooth I/O patterns visible in your storage metrics. Set it to 0.9 and the writes are spread smoothly.

**WAL retention for replication slots**: Each replication slot tells PostgreSQL "don't delete WAL until I've consumed it." If a downstream consumer (Debezium, a replica) falls behind or dies, the slot accumulates WAL indefinitely.

```sql
SELECT slot_name, pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots;
```

> **📖 War Story:** A forgotten Debezium connector (job died silently) caused 200GB of WAL accumulation over a weekend, filling the disk and causing a production outage. Set `max_slot_wal_keep_size` (PG13+) to cap this.

### Streaming Replication Internals

> 🌍 **Real-World:** Twitter's read-heavy timeline uses PostgreSQL read replicas — writes go to the primary, while millions of concurrent feed reads hit 50+ read replicas. Each replica streams WAL asynchronously, accepting a few hundred milliseconds of lag in exchange for massive horizontal read scalability without touching the primary.

The **WAL sender** process on the primary:

1. Watches for new WAL records.
2. Streams them over TCP to the **WAL receiver** on the standby.
3. Standby writes to its WAL, WAL applier replays onto its data files.

**Synchronous replication** (`synchronous_commit = remote_apply` or `on`):

| Setting | Behavior |
|---|---|
| `on` | Commit waits for standby WAL receiver to write to disk (not necessarily applied to tables). |
| `remote_apply` | Commit waits for standby to apply changes to its tables (stronger, more latency). |
| `remote_write` | Commit waits for standby OS to receive data (no fsync guarantee on standby). |

For **zero-RPO** requirements: `synchronous_commit = remote_apply`. Cost: ~5–20ms extra latency per commit depending on network.

**Asynchronous replication** (default): primary commits immediately. Standby may be seconds behind. If primary dies, those seconds of transactions are lost (the RPO).

**Monitoring replication lag:**

```sql
-- On primary
SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       (sent_lsn - replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;
```

---

## 5. Locking

### Lock Hierarchy

PostgreSQL has three levels: **spinlocks** (internal C-level), **LWLocks** (internal, shared data structures), and **regular locks** (what SQL uses). Regular locks have table-level and row-level variants.

### Table-Level Lock Conflict Matrix (Memorize This)

| Lock Mode               | AS | RS | RE | SUE | S | SRE | E | AE |
|-------------------------|----|----|-----|-----|---|-----|---|-----|
| ACCESS SHARE (SELECT)   |    |    |     |     |   |     |   | X   |
| ROW SHARE (SELECT FOR)  |    |    |     |     |   |     | X | X   |
| ROW EXCLUSIVE (DML)     |    |    |     |     | X | X   | X | X   |
| SHARE UPDATE EXCLUSIVE  |    |    |     | X   |   |     |   |     |
| SHARE                   |    |    | X   |     |   | X   | X | X   |
| SHARE ROW EXCLUSIVE     |    |    | X   | X   | X | X   | X | X   |
| EXCLUSIVE               |    | X  | X   | X   | X | X   | X | X   |
| ACCESS EXCLUSIVE        | X  | X  | X   | X   | X | X   | X | X   |

X = conflict. The key production-critical facts:

1. **`ACCESS EXCLUSIVE`** conflicts with **everything including SELECT**. `ALTER TABLE`, `DROP TABLE`, `TRUNCATE`, `VACUUM FULL` all take ACCESS EXCLUSIVE. This means any of these operations will wait for all active SELECT statements to finish, and all subsequent SELECTs will wait for the ALTER to finish. In a high-concurrency system, this creates a queue that builds up extremely fast.

2. **`CREATE INDEX`** (non-concurrent) takes SHARE lock — blocks INSERT/UPDATE/DELETE but allows SELECT. Use `CREATE INDEX CONCURRENTLY` for zero-downtime index creation. CONCURRENTLY takes SHARE UPDATE EXCLUSIVE, which doesn't conflict with DML.

3. **`SHARE UPDATE EXCLUSIVE`** conflicts with itself — two VACUUM processes on the same table won't conflict with DML but will conflict with each other. This prevents two VACUUMs from running concurrently on the same table.

> **⚠️ Production Gotcha:** Never run `ALTER TABLE` directly on a large table in production. Use `pg_repack` or `pg_squeeze` for structural changes, or use the zero-downtime pattern:

```sql
-- PG11+: adding column with non-volatile DEFAULT is instant (stores default in pg_attribute)
ALTER TABLE orders ADD COLUMN metadata jsonb DEFAULT '{}'; -- PG11: O(1) metadata change
```

### Row-Level Locks

> 🌍 **Real-World:** Shopify's inventory reservation system uses `SELECT ... FOR UPDATE SKIP LOCKED` on their `inventory_items` table — multiple checkout workers race to reserve the last unit of a product, and SKIP LOCKED ensures each worker claims a different row without blocking, enabling thousands of concurrent checkouts without deadlocks.

`SELECT ... FOR UPDATE`: acquires exclusive row lock. Use when you need read-then-write with no other writer between the two. Classic pattern:

```sql
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
```

`SELECT ... FOR UPDATE SKIP LOCKED`: returns only unlocked rows, skips locked ones. Used for **job queue** implementations — multiple workers can pull from the same queue table without blocking each other:

```sql
SELECT id, payload FROM jobs
WHERE status = 'PENDING'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

`SELECT ... FOR UPDATE NOWAIT`: fails immediately if any row is locked, instead of waiting. Use when you can't afford to block (real-time APIs).

### Deadlock Detection and Prevention

PostgreSQL's deadlock detector wakes every `deadlock_timeout` (default **1 second**) and checks for cycles in the wait-for graph. When detected, it aborts one transaction (the "victim" — chosen to minimize rollback cost).

> **⚠️ Production Gotcha:** The 1-second delay matters: before the detector runs, both transactions are just waiting. From the application's perspective, they look like "slow queries." In a high-throughput system with frequent deadlocks, you'll see 1-second latency spikes in your percentiles. Reducing `deadlock_timeout` (to 100ms) reduces this but increases overhead of the detection mechanism.

**Deadlock prevention**: Always acquire locks in a consistent global order. Example: if two transactions need to lock accounts A and B, both should lock `min(A,B)` first. This eliminates the cycle. Many ORM frameworks do NOT guarantee lock order — this is a common source of production deadlocks.

### Advisory Locks: Application-Level Coordination

```sql
SELECT pg_try_advisory_lock(12345); -- non-blocking, returns bool
SELECT pg_advisory_lock(12345);     -- blocking
SELECT pg_advisory_unlock(12345);
```

**Advisory locks** are arbitrary integer keys. They have no association with any row or table — they're pure coordination primitives. Use cases:

- **Cron job mutex**: only one instance of a scheduled job runs at a time.
- **Distributed leader election** within a single PostgreSQL cluster.
- **Feature flags** or configuration locks.

They're **session-scoped** (held until released or session ends) or **transaction-scoped** (`pg_advisory_xact_lock` — auto-released at transaction end).

---

## 6. Isolation Levels and Concurrency Anomalies

> ⭐ **IMPORTANT CONCEPT:** Name the anomaly, then the minimum isolation that prevents it — classic senior interview probe.

### The Anomaly Hierarchy

#### Dirty Read

Transaction A reads data written by Transaction B which hasn't committed yet. If B rolls back, A has seen data that never existed.

> **💡 Key Insight:** PostgreSQL: impossible even at READ UNCOMMITTED. PostgreSQL's READ UNCOMMITTED behaves as READ COMMITTED.

#### Non-Repeatable Read

Transaction A reads row X, Transaction B commits an UPDATE to X, Transaction A reads X again — gets different values.

**Fixed by**: REPEATABLE READ snapshot.

#### Phantom Read

Transaction A runs `SELECT * FROM orders WHERE status = 'PENDING'` and gets 5 rows. Transaction B inserts a new PENDING order and commits. Transaction A runs the same SELECT — gets 6 rows.

**Fixed by**: SERIALIZABLE (or PostgreSQL's REPEATABLE READ — it uses snapshot isolation which also prevents phantoms).

#### Write Skew: The Subtlest and Most Dangerous Anomaly

> 🌍 **Real-World:** A ride-sharing company (similar to Lyft) had a write skew bug in their driver bonus system: two concurrent transactions both read "driver has 9 completed rides" and both credited the 10-ride bonus, resulting in drivers receiving double bonuses. Switching to `SERIALIZABLE` isolation on the bonus-crediting transaction eliminated the anomaly — one transaction now gets aborted and retried, preventing the double-credit.

Classic example — on-call roster:

```sql
-- Database constraint: at least one doctor must be on call
-- Both transactions read: ['Alice': on_call=true, 'Bob': on_call=true]

-- Transaction A (Alice going off call)           -- Transaction B (Bob going off call)
BEGIN;                                             BEGIN;
SELECT COUNT(*) FROM doctors                       SELECT COUNT(*) FROM doctors
WHERE on_call = true; -- returns 2                 WHERE on_call = true; -- returns 2
-- "safe to go off call, other doctor covers"      -- "safe to go off call, other doctor covers"
UPDATE doctors SET on_call = false                 UPDATE doctors SET on_call = false
WHERE name = 'Alice';                              WHERE name = 'Bob';
COMMIT;                                            COMMIT;
-- Result: nobody on call. Constraint violated.
```

Write skew **cannot happen** with SERIALIZABLE because one of the transactions would be aborted and retried. It **CAN happen** with REPEATABLE READ because each transaction sees a consistent snapshot but doesn't see the other's write.

#### Lost Update

Two transactions read a value, compute a new value based on the old one, write back. The second write clobbers the first.

```text
T1: read balance=100, compute 100-10=90, write 90
T2: read balance=100, compute 100-20=80, write 80
Final: 80. The -10 deduction was lost.
```

**Fix**: `SELECT ... FOR UPDATE` (explicit locking), or atomic update `UPDATE accounts SET balance = balance - 10 WHERE id = 1` (no read-compute-write pattern).

### Serializable Snapshot Isolation (SSI)

PostgreSQL's SERIALIZABLE uses **SSI**, not Two-Phase Locking (2PL). The difference matters:

| Approach | Mechanism | Used By |
|---|---|---|
| **2PL (traditional serializable)** | Hold all locks until transaction end. Read locks conflict with write locks. High lock contention. | MS SQL Server, Oracle |
| **SSI** | No additional locking overhead for reads. Tracks "SIREAD locks" (logical read set tracking). Detects read/write patterns that would cause a cycle in the dependency graph. Aborts one transaction in the cycle. | PostgreSQL SERIALIZABLE |

SSI can have **false positives** (abort a transaction that wouldn't actually have caused an anomaly) but in practice these are rare. The benefit: read-only transactions never abort (they can't participate in dangerous cycles). Read-heavy workloads with occasional writes see much lower abort rates under SSI than 2PL.

> **💡 Key Insight:** Use SERIALIZABLE for financial transactions requiring perfect consistency (double-entry bookkeeping, inventory reservation), anywhere write skew would be a business-logic violation. The cost: some transaction aborts — your application must retry. Design for idempotency and retries.

```python
while True:
    try:
        with conn.transaction(isolation_level='SERIALIZABLE'):
            # do work
        break
    except SerializationError:
        # retry
        continue
```

---

## 7. NoSQL Internals

### Consistent Hashing: Deep Dive

> 🌍 **Real-World:** Amazon DynamoDB uses consistent hashing internally to distribute data across partition servers — adding capacity for Prime Day traffic means new servers join the ring and absorb only ~1/N of existing key space, not a full rehash. This lets Amazon scale DynamoDB from thousands to millions of requests per second during peak events without downtime.

Simple hash-based sharding: `node = hash(key) % N`. Add a node: N becomes N+1, almost every key remaps. Remove a node: same. This is catastrophic for a live system — every cache miss, every re-routing.

**Consistent hashing**: Map both keys and nodes to a ring of [0, 2^32). Node positions are fixed. A key is assigned to the first node clockwise from its hash position.

Adding a node: insert it at a position on the ring. Only keys between the new node and its predecessor remapped. Expected fraction of keys moved: `1/(N+1)` — e.g., adding a 10th node moves 10% of keys, not 90%.

#### Virtual Nodes (vnodes)

Each physical node occupies multiple positions on the ring (Cassandra default: **256 vnodes per node**). Benefits:

| Benefit | Explanation |
|---|---|
| **Load balancing** | With few physical nodes and one position each, unlucky hashing causes uneven load. Vnodes make the distribution smooth (each node handles ~1/N of the ring, spread across 256 random positions). |
| **Faster rebalancing** | When a node dies, its 256 positions are spread across all other nodes. If a node owns one position: all its data goes to one neighbor. With 256 positions: data distributes evenly across the cluster. |
| **Cost** | Metadata overhead — routing table has 256 × N entries. For large clusters (1,000 nodes × 256 = 256,000 entries) this is manageable. |

**DynamoDB** uses consistent hashing internally but with a wrinkle: it partitions key space and auto-splits/merges based on throughput (adaptive capacity). You don't see vnodes directly — you see partition throughput limits.

**Redis Cluster** uses **hash slots** (16,384 total) instead of consistent hashing. `hash_slot = CRC16(key) % 16384`. Each node owns a range of hash slots. This is simpler to reason about and makes rebalancing deterministic (move exactly these slots from node A to node B). Downsides: can't add nodes beyond 16,384 (though 1,000 nodes is practical max), all slot assignments must be stored in cluster state.

### CAP Theorem: Not What Most People Think

> **💡 Key Insight:** The classic misunderstanding: "Choose 2 of 3: Consistency, Availability, Partition Tolerance." This makes it sound like you can choose CA (no partition tolerance). You cannot. Network partitions in distributed systems are not optional — they will happen. Every distributed system must handle partitions.

**The real choice**: during a partition, do you prioritize:

- **C (CP)**: refuse to serve requests that might return stale data. Return an error or wait for partition to heal. System is unavailable during partition.
- **A (AP)**: serve requests using local data, which might be stale. System is available but returns potentially inconsistent answers.

**PACELC** (Erik Brewer's refinement, 2012):
- If **partition (P)**: choose Availability (A) or Consistency (C).
- **Else (E)** — normal operation: choose Latency (L) or Consistency (C).

The second part is what matters for most workload design decisions — partitions are rare, but the latency/consistency tradeoff is always present. Strong consistency = more coordination = more round trips = higher latency.

| System | Classification | Notes |
|---|---|---|
| DynamoDB (eventually consistent reads) | PA/EL | Low latency always |
| DynamoDB (strongly consistent reads) | PC/EC | Higher latency, doubles read cost |
| Cassandra | PA/EL by default | Tunable toward PC/EC with `QUORUM` consistency and `RF=N` |
| ZooKeeper/etcd | PC/EC | Consistency always, availability sacrificed during partition |

### LSM Tree Internals

#### Write Path

1. Write to WAL (sequential, durable).
2. Write to **MemTable** (in-memory, sorted skip-list or red-black tree in most implementations).
3. When MemTable hits size limit (default 64MB in RocksDB): flush to disk as an immutable **SSTable**.

#### SSTable Structure

Key-value pairs sorted by key. Includes:

- **Data blocks** (compressed key-value pairs)
- **Index block** (one entry per data block: last key + offset)
- **Bloom filter block**
- **Metadata block** (compression type, checksums)

#### Read Path

Without bloom filter, worst case: check MemTable → check each SSTable from newest to oldest (each requires a binary search of the index block + possibly decompressing a data block). For a key that doesn't exist, you read every SSTable. This is O(number of SSTables).

#### Bloom Filter

> 🌍 **Real-World:** Apache Cassandra uses bloom filters on every SSTable to eliminate 99%+ of unnecessary disk reads for keys that don't exist in that SSTable. Instagram's Cassandra clusters, storing billions of media metadata records, rely on bloom filters so that a read for a missing key checks memory only (a 12KB filter per SSTable) rather than reading gigabytes of sorted data from disk.

A probabilistic data structure. `M` bits, `K` hash functions. To add a key: set bits at all K hash positions to 1. To check key: verify all K positions are 1. False positive rate ≈ `(0.6185)^(M/N)` where N is number of items.

> **💡 Key Insight:** With 10 bits per key and 7 hash functions: ~1% false positive rate. For 1M keys in an SSTable: 10MB bloom filter, 1% chance of a false positive (reading the SSTable unnecessarily). Bloom filters eliminate ~99% of unnecessary SSTable reads for absent keys — critical for read performance in LSM trees.

#### Compaction: The Core Trade-off

**Size-Tiered Compaction (Cassandra default for most tables)**:

- Merge N SSTables of similar size into one larger SSTable.
- **Pros**: high write throughput (few compactions triggered), compactions are large/efficient.
- **Cons**: at merge time, you temporarily need 2x disk space. Read amplification can be high (many SSTables of varying sizes to check). Space amplification: old tombstones and old versions only cleaned up when SSTable is compacted.
- **When to use**: write-heavy workloads where read latency is less critical.

**Leveled Compaction (RocksDB default, Cassandra TWCS for timeseries)**:

- SSTables organized in levels (L0, L1, L2, ...). Within L1 and above: no key overlap between SSTables.
- L0: fresh flushes, may overlap. L1: fixed size (e.g., 10MB), no key overlap. L2: 10x larger than L1 (100MB), no overlap. And so on.
- A key can be in at most one SSTable per level (above L0). Point lookups: check MemTable + each level's SSTable (binary search in level's index) = O(number of levels) = O(log N) total SSTables.
- Compaction: when L0 has too many files, compact into L1. When L1 exceeds size limit, compact overlapping SSTables from L1+L2 into L2.
- **Pros**: excellent read performance, good space amplification (old versions quickly overwritten).
- **Cons**: high write amplification. A key might be rewritten O(levels) times. Write amplification factor: 10–30x is common.

> **⚠️ Production Gotcha:** Write amplification in practice: With 7 levels and 10x size ratio, worst-case write amplification is ~50x. For a workload writing 10MB/s of user data, you're actually doing 500MB/s of disk writes. This is why LSM trees are more disk I/O intensive than expected based purely on incoming write rate.

**Time Window Compaction Strategy (TWCS)**: Cassandra's strategy for timeseries. Group SSTables by time window (e.g., 1 hour). Within a time window, use size-tiered. Never compact across time windows. When a time window is "closed" (older than current window), all its SSTables are merged into one final SSTable. Why this works: timeseries data is rarely updated or deleted within a time window, so there's no need to compact across windows for garbage collection. Result: near-zero read/write amplification for append-mostly timeseries.

### Cassandra Architecture: Production-Level Understanding

> 🌍 **Real-World:** Netflix stores viewing history for 200M+ subscribers in Cassandra with RF=3 across 3 AWS availability zones. A user's watch history write is confirmed when 2 of 3 replicas (QUORUM) acknowledge — if one AZ goes dark, the cluster seamlessly continues serving reads and writes from the remaining two AZs without any application-level failover logic.

**Ring topology**: N nodes, each owning a token range on the consistent hash ring. Default vnodes: 256 per node. **Replication factor (RF)** = 3 means each key is stored on 3 consecutive nodes on the ring.

#### Write Path

1. Client sends write to any node (**coordinator**, determined by client-side driver).
2. Coordinator determines replica nodes for the key's token.
3. Sends write to all replicas in parallel (for RF=3: 3 writes).
4. Waits for acknowledgment from `CL` replicas (based on consistency level).
5. Returns success to client.

For `CL=QUORUM`, `RF=3`: waits for 2/3 replicas to acknowledge. Third replica gets the write asynchronously. If third replica was down, coordinator stores a "**hint**" (**hinted handoff**) to replay when the node recovers.

#### Read Path

1. Coordinator identifies replica nodes.
2. For `CL=QUORUM` (RF=3): sends data request to one replica, **digest requests** (hash of data, not data itself) to others.
3. Compares digests. If all match: return data from first replica.
4. If mismatch (replicas disagree): fetch full data from all replicas, perform **read repair** in background, return most recent version (based on timestamp).
5. Read repair is async by default (`read_repair = BLOCKING` makes it sync — consistency at cost of latency).

#### Tombstones and the Resurrection Problem

Deletes in Cassandra write a **tombstone** (a special marker with a timestamp). Data is not immediately deleted. Tombstones are retained for `gc_grace_seconds` (default 864,000 = 10 days).

Why 10 days? If Node A goes down, you delete a key (tombstone written to B and C). Node A comes back up within 10 days: it now has the old data. When Cassandra does repair, it will detect the tombstone (newer timestamp) and the old data (older timestamp). Tombstone wins. Data properly deleted.

> **⚠️ Production Gotcha:** If Node A is down for > 10 days: the tombstone gets garbage collected on B and C during compaction. Node A comes back: it has the only copy of the old data. Repair sees data on A, no tombstone anywhere. Data is "**resurrected**." This is a real, production-affecting bug.

#### The Merkle Tree Anti-Entropy Process

Each node maintains **Merkle trees** (hash trees) over its key ranges. During anti-entropy repair (`nodetool repair`):

1. Coordinator requests Merkle trees from replicas for a token range.
2. Compares trees top-down to find divergent ranges.
3. Synchronizes only the divergent sub-ranges.

Efficient: O(log N) messages to identify differences in N keys. Full repair on a large cluster is still expensive (reading all data to build trees). Run **incremental repair** (only repair SSTables that haven't been repaired before) to reduce overhead.

#### Gossip Protocol

Each node maintains a state map of all nodes (status, load, schema version). Every second, each node picks a random neighbor and exchanges gossip. Within `O(log N)` rounds, all nodes converge on the same view. For N=100 nodes: ~7 rounds to propagate any change.

This is why adding a node to Cassandra doesn't require any central coordinator — nodes discover each other via gossip from the **seed nodes** (configured in `cassandra.yaml`).

---

## 8. Distributed Transactions and CDC

### Two-Phase Commit (2PC): Why It's Problematic

> 🌍 **Real-World:** Early versions of Uber's payment system used 2PC to coordinate writes between their trip database and payment processor. A coordinator crash during Phase 2 left trips in "prepared" state for up to 30 minutes — holding locks and blocking driver payout queries. They migrated to a Saga pattern with idempotent compensating transactions, eliminating the blocking problem entirely.

#### Phase 1 (Prepare)

- Coordinator sends PREPARE to all participants.
- Each participant: write prepare record to WAL, acquire all necessary locks, respond READY or ABORT.

#### Phase 2 (Commit)

- If all participants voted READY: coordinator sends COMMIT.
- If any participant voted ABORT: coordinator sends ROLLBACK.

> **⚠️ Production Gotcha:** The **blocking problem**: After a participant writes its PREPARE record and responds READY, it is in a "prepared" state. It holds all its locks and waits for the coordinator's decision. If the coordinator crashes before sending Phase 2, the participant is stuck indefinitely with locks held, blocking other transactions. This is not theoretical — it happens in production whenever a coordinator process crashes or loses network connectivity between phases.

PostgreSQL tracks prepared transactions in `pg_prepared_xacts`. If you see rows here that are old (minutes old) and increasing, your 2PC coordinator is malfunctioning.

**XA transactions**: The Java/Go standard interface for 2PC. `javax.transaction.xa.XAResource`. Most application servers (Spring, Java EE) implement 2PC this way. The coordinator is typically the application server's transaction manager. If the app server crashes: same blocking problem.

> **💡 Key Insight:** When to use 2PC anyway: Internal microservices that you control, where you can guarantee coordinator high availability (active-passive with shared storage). Cross-database transactions where business requirements absolutely demand atomicity. Not for inter-company or cross-cloud transactions.

### Saga Pattern: Practical Distributed Transactions

> 🌍 **Real-World:** Amazon's order fulfillment pipeline uses the Saga pattern across 5+ microservices (inventory, payment, warehouse, shipping, notification). Each step has a compensating action — if payment fails after inventory is reserved, the inventory reservation is automatically released. This choreography-based saga handles millions of orders daily without any distributed locks or 2PC coordinators.

Instead of atomic multi-step transactions, model as a sequence of local transactions with compensating actions:

```text
Order Saga:
Step 1: Create order (PENDING)       -> Compensate: cancel order
Step 2: Reserve inventory            -> Compensate: release reservation
Step 3: Charge payment               -> Compensate: refund payment
Step 4: Trigger shipment             -> Compensate: cancel shipment
Step 5: Mark order COMPLETED
```

Failure at Step 3 triggers compensation of Steps 2 and 1 in reverse order. The system is **eventually consistent** — there's a window where the order exists but payment hasn't been charged. This is acceptable for many business domains (you can detect and retry failures) but not for all (you cannot have a negative bank account).

#### Choreography vs Orchestration

| Approach | Mechanism | Pros | Cons |
|---|---|---|---|
| **Choreography** | Each service listens for events and emits the next event. No central coordinator. | Fully decentralized, no single point of failure. | Hard to track overall saga state, debugging requires tracing across multiple event streams. Adding a new step requires modifying multiple services. |
| **Orchestration** | Central orchestrator (a service or workflow engine like Temporal/Conductor) drives each step. | Full visibility of saga state in one place, easy to add steps, error handling is centralized. | Orchestrator is a central point of failure (mitigate with Temporal's persistence layer), orchestrator service becomes a coupling point. |

**Choreography example:**

```text
OrderService -> emits OrderCreated -> InventoryService listens, reserves, emits InventoryReserved
-> PaymentService listens, charges, emits PaymentCharged -> ShipmentService listens, ships
```

**Orchestration example:**

```text
SagaOrchestrator:
  1. POST /inventory/reserve
  2. POST /payment/charge
  3. POST /shipment/create
  4. PATCH /order/status COMPLETED
```

> **💡 Key Insight:** **Temporal** for saga orchestration: Temporal workflows are code (Go/Java/Python) that are durable by default. Each step's completion is checkpointed to Temporal's database. If the worker process dies, the workflow resumes from the last checkpoint. This elegantly solves the "coordinator crashes" problem of 2PC — the orchestrator's state is persisted.

### Change Data Capture (CDC): PostgreSQL Logical Decoding

> 🌍 **Real-World:** LinkedIn uses Debezium + Kafka CDC to sync their member profile PostgreSQL database to Elasticsearch for search and to an analytics data warehouse in near-real-time. Every profile update flows through the WAL → Debezium → Kafka pipeline within seconds, keeping search results and analytics dashboards fresh without any dual-write logic in the application layer.

**How it works**: PostgreSQL WAL at `wal_level=logical` includes enough information to reconstruct row-level changes. Logical decoding plugins (Debezium uses `pgoutput` or `wal2json`) parse WAL and emit change events in a structured format.

**Architecture with Debezium + Kafka:**

1. PostgreSQL publishes WAL via a **replication slot**.
2. **Debezium** connector (Kafka Connect source connector) reads from the replication slot.
3. Transforms WAL records into Kafka messages (one topic per table, key = primary key).
4. Downstream consumers (cache invalidation, Elasticsearch sync, event streaming) read from Kafka.

**Debezium message format:**

```json
{
  "before": {"id": 1, "status": "PENDING", "total": 100.00},
  "after":  {"id": 1, "status": "COMPLETED", "total": 100.00},
  "op": "u",
  "ts_ms": 1699999999000,
  "source": {"lsn": 12345678, "txId": 987654}
}
```

**At-least-once delivery**: Debezium checkpoints its LSN position in Kafka. If the connector crashes after emitting a message but before checkpointing, it re-emits on restart. Consumers must be **idempotent**. Use the primary key + LSN or `ts_ms` to deduplicate.

**Snapshot mode**: On first start (or when slot doesn't exist), Debezium reads the entire table from a consistent snapshot and emits `r` (read) events for all existing rows. This bootstraps downstream systems. For large tables (100M rows), this can take hours. Plan for it.

**Replication slot retention**: The replication slot prevents WAL deletion until consumed. If Debezium is down for a long time:

```sql
SELECT slot_name, restart_lsn,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots;
```

Set `max_slot_wal_keep_size` (PG13+) to prevent disk fill:

```sql
ALTER SYSTEM SET max_slot_wal_keep_size = '10GB';
SELECT pg_reload_conf();
```

When WAL exceeds this limit, PostgreSQL will **invalidate** the slot (you lose CDC history, need to re-snapshot). Alert before you hit this limit.

**Logical replication vs physical replication:**

| Type | Mechanism | Use Case |
|---|---|---|
| **Physical** | Byte-for-byte page copies. Standby must be same PostgreSQL version and architecture. Cannot apply selective table filters. | HA standby. |
| **Logical** | Row-level change events. Can filter by table, transform data, replicate to different PostgreSQL versions, or to non-PostgreSQL systems. | CDC, migrations, cross-version upgrades. |

---

## 9. Production War Stories and Interview Traps

### The N+1 Query Problem (The Most Common FAANG Interview DB Question)

> 🌍 **Real-World:** Gitlab discovered an N+1 query causing 500+ database calls per page load in their merge request view — each comment loaded the author separately. After adding eager loading (a single JOIN query), that page dropped from 1,400ms to 180ms and reduced database load by 40% site-wide during peak hours.

```python
# N+1: 1 query for orders + N queries for each order's user
orders = db.query("SELECT * FROM orders WHERE status='PENDING'")
for order in orders:
    user = db.query("SELECT * FROM users WHERE id = ?", order.user_id)
    # process order + user
```

With 1,000 pending orders: 1,001 queries. Each query ~1ms = 1 second total. Fix:

```sql
SELECT o.*, u.name, u.email
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'PENDING';
```

> **⚠️ Production Gotcha:** ORMs can hide N+1 queries. Hibernate lazy loading, ActiveRecord `has_many`. Always check query logs in development/staging. `explain()` in SQLAlchemy, `to_sql()` in ActiveRecord, `QuerySet.explain()` in Django.

### Missing Index on Foreign Key (MySQL/InnoDB specific)

In InnoDB, `FOREIGN KEY` constraints do NOT automatically create an index on the referencing column (unlike PostgreSQL which DOES create one automatically). If `order_items.order_id` is a foreign key but has no index:

```sql
DELETE FROM orders WHERE id = 1;
```

InnoDB must scan the entire `order_items` table to verify no orphaned rows. On a table with 100M order_items: full table scan for every order delete. This causes massive lock escalation in concurrent workloads.

PostgreSQL automatically creates an index for the referenced column (primary key), but NOT for the referencing column. If you have `order_items(order_id REFERENCES orders(id))`, PostgreSQL does NOT create an index on `order_id` automatically — you must:

```sql
CREATE INDEX ON order_items(order_id);
```

### Index Selectivity and the Optimizer's Choice

An index on a boolean column (`is_deleted`) with 95% `false` values has selectivity ~0.05 for the common query `WHERE is_deleted = false`. The optimizer knows: this index returns 95% of rows. Scanning 95% of pages via index = worse than sequential scan (random I/Os vs sequential). So it ignores the index.

Solution: **partial index**:

```sql
CREATE INDEX idx_orders_active ON orders(created_at)
WHERE is_deleted = false;
```

Now the index contains only active (non-deleted) rows — the 5% minority. Queries on active orders get a small, highly selective index.

### Connection Pool Exhaustion

> 🌍 **Real-World:** Discourse (the forum platform) hit PostgreSQL connection exhaustion at scale — their Ruby app servers each held a connection pool, and as they scaled to 50 app servers × 20 connections each = 1,000 connections, PostgreSQL's process-per-connection model consumed all available RAM for connection state. Adding PgBouncer in transaction mode reduced actual Postgres connections to 80 while still serving all 1,000 app-level connections, freeing ~9GB of RAM for the buffer pool.

PostgreSQL process model: one OS process per connection. Each connection ~5–10MB RSS. At 1,000 connections: ~10GB RAM just for connection overhead. At 10,000 connections: RAM exhaustion.

> **💡 Key Insight:** Connection pool sizing: **not as big as possible**. Optimal pool size (PgBouncer, HikariCP): typically `2 * CPU_cores + disk_count`. For a 16-core server with 2 disk groups: pool size ~34. This seems small — it's not. PostgreSQL is CPU-bound or I/O-bound during query execution. More connections beyond saturation causes context switching overhead, not more throughput.

**PgBouncer modes:**

| Mode | Connection Release | Notes |
|---|---|---|
| **Session mode** | Held for duration of client session | Good for: applications using `SET` variables, prepared statements, advisory locks. |
| **Transaction mode** | Returned to pool after each transaction | ~10x more efficient connection utilization. Problem: session-level features (`SET`, prepared statements, `pg_advisory_lock`) don't work — they're tied to the connection, not the transaction. |
| **Statement mode** | Returned after each statement | Breaks everything that requires transaction semantics. **Don't use.** |

### Vacuum and the Autovacuum Tuning Problem

Default autovacuum trigger: `autovacuum_vacuum_scale_factor = 0.2` (20% dead tuples) + `autovacuum_vacuum_threshold = 50` (at least 50 dead tuples). For a 100M-row table: 20M dead tuples must accumulate before autovacuum triggers. That's table bloat of potentially 20%.

For large, heavily updated tables, tune per-table:

```sql
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.01,  -- trigger at 1% dead tuples = 1M rows
  autovacuum_vacuum_cost_delay = 2,        -- 2ms delay between I/O bursts (default 20ms)
  autovacuum_analyze_scale_factor = 0.005  -- refresh statistics at 0.5% new rows
);
```

`autovacuum_vacuum_cost_delay`: VACUUM throttles itself to avoid saturating I/O. With `cost_delay=20ms`, it processes 200 pages, sleeps 20ms, repeat. On a busy SSD, you can safely lower this to 2ms for faster vacuum without impacting production queries.

### The "SELECT \*" Anti-Pattern

Selecting more columns than needed:

1. Increases network bandwidth (especially for wide tables with JSONB or TEXT columns).
2. Prevents index-only scans (if extra columns not in index, heap fetch required).
3. In ORMs, deserializes columns you'll never use (CPU + memory).

In code review: always flag `SELECT *` in production query paths. Exception: exploratory queries in psql.

### Checkpoint Tuning for Write-Heavy Workloads

`max_wal_size = 1GB` default: with a 100MB/s write workload, checkpoint triggers every ~10 seconds. Each checkpoint flushes all dirty pages. With `checkpoint_completion_target = 0.9`, checkpoint writes spread over 9 seconds but trigger again almost immediately — effectively continuous full-speed writes.

Increase `max_wal_size` to 4–8GB for write-heavy workloads. This lengthens the checkpoint interval to minutes, allowing `checkpoint_completion_target = 0.9` to actually spread I/O smoothly. Cost: longer recovery time after crash (replay more WAL). For a 4GB WAL with 100MB/s replay speed: ~40 seconds additional recovery time — acceptable for most.

---

## 10. Quick-Reference Interview Cheatsheet

### "Why is this query slow?" Diagnostic Flow

1. `EXPLAIN (ANALYZE, BUFFERS)` — get actual plan.
2. Check **estimated vs actual rows** — large discrepancy means run `ANALYZE tablename`.
3. Check **`Buffers: read`** — high disk reads means I/O bound, check `pg_statio_user_tables`.
4. Check for **Seq Scan on large table** — means missing index, or index not used (bad statistics, low selectivity).
5. Check for **Hash Batches > 1** — means `work_mem` too low.
6. Check for **nested loop on large relations** — means planner mistake, may need `enable_nestloop = off` temporarily.
7. Check `pg_stat_activity` for lock waits — `wait_event_type = 'Lock'`.

### Numbers to Have Ready

| Metric | Value |
|--------|-------|
| PostgreSQL default page size | 8KB |
| InnoDB default page size | 16KB |
| B-tree fan-out (8KB, 4-byte int keys) | ~300–400 |
| B-tree height for 1B rows | 4–5 levels |
| Default `work_mem` | 4MB |
| Default `maintenance_work_mem` | 64MB |
| XID wraparound danger threshold | ~2 billion transactions |
| Cassandra default vnodes per node | 256 |
| Cassandra default `gc_grace_seconds` | 864,000 (10 days) |
| LSM tree write amplification (leveled) | 10–30x |
| Bloom filter false positive rate (10 bits/key) | ~1% |
| MVCC dead tuple removal | After all snapshots older than xmax are gone |
| PgBouncer optimal transaction mode pool | 2 × CPU + storage |

### Key Production Config Changes (PG on NVMe/SSD)

```sql
-- In postgresql.conf
random_page_cost = 1.1           -- NVMe: random ~= sequential
effective_cache_size = 24GB      -- 75% of RAM (affects planner cost estimates)
shared_buffers = 8GB             -- 25% of RAM (PostgreSQL buffer pool)
work_mem = 64MB                  -- per sort/hash (careful: N connections * N sorts each)
maintenance_work_mem = 1GB       -- for VACUUM, CREATE INDEX
wal_buffers = 64MB               -- WAL buffer (auto-set from shared_buffers, but set explicitly)
checkpoint_completion_target = 0.9
max_wal_size = 4GB
synchronous_commit = on          -- change to off only for non-durable workloads
autovacuum_vacuum_cost_delay = 2 -- aggressive vacuum on SSD
max_connections = 200            -- rely on PgBouncer for more
```

---

*End of notes. Every number above is verifiable in PostgreSQL source code, official documentation, or production telemetry. Interview format: be ready to walk through any section as a 10-minute whiteboard explanation, citing specific numbers and the "why" — that's what separates senior-level answers from generic ones.*

---

## REAL-WORLD DATABASE USAGE

```text
PostgreSQL:
  Shopify: PostgreSQL for all transactional data — order processing, payments
    Why: ACID guarantees, MVCC for concurrent reads without blocking writes
  Instagram (early): PostgreSQL before migrating time-series data to Cassandra
    Why: rapid prototyping, then scaled by adding read replicas
  GitHub: MySQL → PostgreSQL migration for reliability and feature richness
  Heroku: PostgreSQL as managed offering (Heroku Postgres) — largest Postgres deployment

MySQL (Aurora MySQL):
  Airbnb: Aurora MySQL for core booking data
    Why: Aurora shared storage = instant read replicas, no data copying
  Netflix: MySQL → Cassandra migration for user data (2012+), but kept MySQL for billing
  Twitter: MySQL + Vitess (sharding middleware) for tweets DB

Cassandra:
  Instagram: user activity and timeline storage
    Why: write-heavy (millions of posts/day), eventual consistency fine for feeds
  Netflix: viewing history for 200M+ users
    Why: wide-column model, write anywhere, read from nearest DC
  Discord: billions of messages across millions of servers
    Why: tunable consistency, horizontal scaling, low latency at scale
  Uber: trip history and driver events
    Why: high write throughput (real-time location updates)

Elasticsearch:
  Netflix: log aggregation and search (ELK stack)
  Airbnb: search listings by location, price, amenities (GeoPoint queries)
  GitHub: code search across billions of files
  Log management: every major company uses ELK or similar for centralized logging

Redis:
  Twitter: timeline cache, session storage, trending topics (ZSet for rankings)
  Uber: driver location updates, surge price calculations
  GitHub: rate limiting, caching GitHub API responses

DynamoDB:
  Amazon.com: product catalog, shopping cart (AP consistency, always available)
  Lyft: ride history, driver state
    Why: fully managed, scales to any load, pay-per-request
  Discord: migrated from Cassandra to ScyllaDB (not DynamoDB) for lower latency

Connection Pooling in Production:
  PgBouncer: Shopify, GitLab — reduces Postgres connections from thousands to hundreds
    Without PgBouncer: each Rails process has N connections → Postgres max_connections hit
    With PgBouncer: 1,000 app connections → 100 actual Postgres connections (transaction mode)
  
Database Mistakes Companies Have Made:
  GitLab 2017: deleted production database (rm -rf during wrong terminal)
    Fix: better access controls, point-in-time recovery, write DR procedures
  Knight Capital 2012: stale code deployed with different DB schema → $440M loss in 45 min
    Fix: blue-green deployments, backward-compatible migrations
  GitHub 2018: MySQL replication split, 24h of degraded service
    Fix: orchestrator for automated failover + fencing tokens
```

---

## 13. MYSQL / INNODB DEEP DIVE

> MySQL is the world's most-deployed open-source RDBMS. InnoDB (default engine since MySQL 5.5) provides ACID transactions. Understanding InnoDB internals separates senior engineers from everyone else.

### 13.1 InnoDB Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MySQL Server Layer                        │
│   Parser → Optimizer → Execution Engine → Storage API       │
└────────────────────────┬────────────────────────────────────┘
                         │ Handler API (pluggable)
┌────────────────────────▼────────────────────────────────────┐
│                    InnoDB Storage Engine                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Buffer Pool (most critical)             │   │
│  │  Data pages (16KB each) + Index pages + Undo pages   │   │
│  │  LRU list (young + old sublists), Flush list         │   │
│  │  Change Buffer (secondary index insert cache)        │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                                │
│  ┌──────────────┐  ┌────────▼────────┐  ┌────────────────┐  │
│  │  Redo Log    │  │  Tablespace     │  │  Undo Logs     │  │
│  │  (ib_logfile)│  │  (.ibd files)   │  │  (MVCC state)  │  │
│  │  circular    │  │  B+ tree data   │  │  old row vers. │  │
│  └──────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 Buffer Pool — The Most Important Tuning Knob

> 🌍 **Real-World:** Airbnb's Aurora MySQL instances allocate 75% of RAM to the InnoDB buffer pool — their core booking tables (listings, reservations, users) collectively fit in the ~200GB buffer pool, meaning >95% of reads are served from memory without touching SSD storage, keeping P99 read latency under 2ms even at peak booking season traffic.

The buffer pool is InnoDB's main memory cache. **Set it to 70-80% of available RAM** for a dedicated DB server.

```
innodb_buffer_pool_size = 12G   # for 16GB server

# Buffer pool contains:
#   Data pages: table rows cached in 16KB pages
#   Index pages: B+ tree nodes cached
#   Insert buffer pages: pending secondary index changes
#   Adaptive hash index: auto-built in-memory hash index
#   Lock information and data dictionary
```

**LRU with Young/Old Sublists** — prevents full table scans from evicting hot data:

```
Buffer Pool LRU:
┌────────────────┬───────────────────┐
│   Young 5/8    │    Old 3/8        │
│ (hot, recently │ (new pages start  │
│  accessed)     │  here, promoted   │
│                │  after 1 second)  │
└────────────────┴───────────────────┘

# innodb_old_blocks_pct = 37 (default, % kept in old sublist)
# innodb_old_blocks_time = 1000ms (must stay 1s before promotion)
```

**Why this matters**: A full table scan `SELECT * FROM huge_table` will NOT evict your hot OLTP pages because pages from the scan stay in the "old" portion and get evicted first.

**Change Buffer** — buffers writes to secondary indexes when the page is not in buffer pool:

```
# Secondary index inserts are non-sequential → random I/O
# Change buffer merges these writes lazily when pages load
# innodb_change_buffer_max_size = 25 (% of buffer pool)
# Only works for: INSERT, UPDATE, DELETE on secondary indexes
# NOT for primary key (clustered index always updated synchronously)
```

### 13.3 InnoDB vs PostgreSQL MVCC — Critical Difference

Both implement MVCC but **completely differently**:

| Aspect | PostgreSQL | MySQL/InnoDB |
|---|---|---|
| **Old versions stored** | Same heap (dead tuples) | Undo log (separate) |
| **Cleanup** | VACUUM process | Purge thread (automatic) |
| **Row header overhead** | ~23 bytes per version | Pointer to undo log |
| **Index updates** | New version = new index entry | Index points to latest row, undo for old |
| **Read performance** | May need to skip dead tuples | Follow undo chain |
| **VACUUM equivalent** | Explicit VACUUM needed | Automatic purge thread |

**InnoDB MVCC mechanism:**

```
Read: SELECT * FROM orders WHERE id = 5 (read at txn snapshot time T1)

Current row in tablespace:   id=5, amount=100, trx_id=T3
Undo log chain:
  T3: {old: amount=80}  →  T2: {old: amount=60}  →  T1: {original}

InnoDB walks undo chain backward until it finds version visible to T1.
```

```sql
-- See current transaction ID
SELECT TRX_ID FROM information_schema.INNODB_TRX 
WHERE TRX_MYSQL_THREAD_ID = CONNECTION_ID();

-- Purge lag indicator (high = long-running txn blocking cleanup)
SHOW ENGINE INNODB STATUS\G
-- Look for: "History list length N" — should be < 1000
-- High history list = undo logs not being purged = disk growth
```

### 13.4 InnoDB Clustered Index

> 🌍 **Real-World:** Twitter's MySQL (Vitess) sharded tweet database uses sequential `BIGINT` primary keys rather than UUIDs — the clustered index means sequential inserts always append to the rightmost leaf page, staying hot in the buffer pool. Switching to random UUIDs in a test environment increased P99 insert latency from 3ms to 40ms due to random page access across the clustered index.

Unlike PostgreSQL (heap tables), **InnoDB stores all rows in B+ tree order by primary key**. This is the "clustered index" (a.k.a. IOT — Index-Organized Table).

```
PRIMARY KEY (id):         ← clustered index = the actual table
  Leaf nodes contain:  [id | col1 | col2 | ... all columns]

Secondary index (email):  ← stores email + primary key
  Leaf nodes contain:  [email | id]  ← NO row data, just PK
  To get full row:     do a "double lookup" → find PK → go to clustered index
```

**Implications:**

```sql
-- Efficient: clustered index lookup, single B+ tree traversal
SELECT * FROM users WHERE id = 42;

-- "Double lookup": find email in secondary idx → get PK → fetch row
SELECT * FROM users WHERE email = 'foo@bar.com';

-- Covering index avoids double lookup! Only reads secondary index leaf
SELECT id, email FROM users WHERE email = 'foo@bar.com';
-- (email, id) both in secondary index leaf → no clustered index fetch

-- Clustered index means INSERT ORDER matters:
-- Random UUIDs as PK → random page writes → fragmentation + cache misses
-- Sequential IDs (AUTO_INCREMENT) → append-only writes → fast inserts
```

💡 **Key Insight**: PostgreSQL's heap tables allow `VACUUM` to reclaim space in-place. InnoDB's clustered index means page splits happen on insert. `OPTIMIZE TABLE` rebuilds the clustered index to defragment. Run after large deletes.

### 13.5 InnoDB Locking — Gap Locks, Next-Key Locks

InnoDB has a more complex locking model than PostgreSQL to prevent phantom reads under REPEATABLE READ (default isolation level):

```
Lock types:
  Record lock:   locks a single row index record
  Gap lock:      locks the gap BEFORE an index record (prevents INSERT)
  Next-key lock: record lock + gap lock on the gap before it
                 = "supremum lock" for ranges past the last record

Example:
  Table has rows with id: 10, 20, 30

  SELECT * FROM t WHERE id BETWEEN 15 AND 25 FOR UPDATE;
  
  Locks acquired:
    Gap lock (10, 15)   → no INSERT of id=12 allowed
    Record lock id=20   → no UPDATE of id=20
    Gap lock (20, 25)   → no INSERT of id=22 allowed
    Gap lock (25, 30)   → no INSERT of id=28 allowed (next-key extends)
```

```sql
-- Deadlock caused by gap locks (common in MySQL)
-- Txn A: DELETE FROM t WHERE id = 5  (acquires gap lock)
-- Txn B: INSERT INTO t (id) VALUES (5)  (waits for gap lock)
-- Txn A: INSERT INTO t (id) VALUES (5)  (waits for Txn B intent lock → DEADLOCK)

-- Avoid gap locks: use READ COMMITTED isolation level
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
-- READ COMMITTED: only record locks, no gap locks, more phantom risk
-- Use when: high INSERT throughput, deadlocks from gap locks are a problem

-- Check for locks
SELECT * FROM performance_schema.data_locks;
SELECT * FROM information_schema.INNODB_LOCKS;  -- older MySQL
```

### 13.6 Redo Log vs Binary Log — Two Separate Log Systems

MySQL has **two** logging systems that confuse everyone:

| | Redo Log (`ib_logfile*`) | Binary Log (`binlog`) |
|---|---|---|
| **Purpose** | Crash recovery (InnoDB) | Replication + point-in-time recovery |
| **Format** | Physical (page changes) | Logical (SQL or row events) |
| **Layer** | InnoDB storage engine | MySQL server layer |
| **Written** | Every transaction | Committed transactions only |
| **Circular** | Yes (fixed size, overwritten) | No (accumulates, rotated by size/time) |

```
Write path for a committed INSERT:
  1. InnoDB: write redo log (WAL) to buffer
  2. InnoDB: modify buffer pool page
  3. MySQL: write to binary log  ← server layer
  4. InnoDB: commit redo log record (marks txn as committed)
  5. MySQL: ack to client

# Two-phase commit between redo log and binlog:
# (Ensures crash between steps 3-4 doesn't create binlog/redo log divergence)
# innodb_flush_log_at_trx_commit = 1  (fsync redo log each commit — safest)
# sync_binlog = 1  (fsync binlog each commit)
# Both = 1 is "fully durable" (ACID), but slowest
# Both = 0 is fastest but can lose ~1s of data on crash
```

### 13.7 MySQL Replication

```
Primary:                      Replica:
  Writes committed         →   IO Thread reads binlog events
  Binary log written       →   Relay log stored
                           →   SQL Thread replays relay log
                                (or parallel applier threads in MySQL 8)

Formats:
  STATEMENT: logs SQL statements — fast, but non-deterministic functions differ
  ROW: logs actual row changes — safe, larger binlog
  MIXED: statement where safe, row otherwise (default in MySQL 8)

Lag monitoring:
  SHOW REPLICA STATUS\G
  Seconds_Behind_Source: 0   ← healthy
  Seconds_Behind_Source: 300 ← replica 5 minutes behind

Semi-synchronous replication:
  Normal: primary commits, async writes to replica
  Semi-sync: primary waits for ≥1 replica to ACK before committing to client
  Tradeoff: durability vs latency (~1-2ms extra per write)
  Plugin: rpl_semi_sync_source_enabled = ON
```

### 13.8 MySQL 8.0 Key Features

```sql
-- Window functions (finally!)
SELECT name, dept, salary,
  RANK() OVER (PARTITION BY dept ORDER BY salary DESC) as dept_rank
FROM employees;

-- Common Table Expressions (CTEs) including recursive
WITH RECURSIVE org AS (
  SELECT id, name, manager_id FROM employees WHERE manager_id IS NULL
  UNION ALL
  SELECT e.id, e.name, e.manager_id FROM employees e
  JOIN org ON e.manager_id = org.id
)
SELECT * FROM org;

-- Invisible indexes (test dropping without actually dropping)
ALTER TABLE orders ALTER INDEX idx_status INVISIBLE;
-- Query optimizer will ignore it, but index still maintained
-- Check if queries get worse → ALTER INDEX idx_status VISIBLE;

-- Instant ADD COLUMN (no table rebuild)
ALTER TABLE t ADD COLUMN new_col INT, ALGORITHM=INSTANT;
-- MySQL 8.0.29+: ADD/DROP columns without copying table

-- JSON document support
SELECT JSON_EXTRACT(data, '$.address.city') FROM users;
-- Functional index on JSON:
ALTER TABLE users ADD INDEX idx_city ((CAST(data->>'$.address.city' AS CHAR(100))));
```

### 13.9 Aurora MySQL

> 🌍 **Real-World:** Airbnb migrated their core booking database from self-managed MySQL to Aurora MySQL — Aurora's shared storage layer means read replicas are available within seconds of creation (no data copying), and their 15-replica fleet handles Black Friday read traffic spikes of 10x normal load by simply adding replicas that immediately see the primary's data with <20ms lag.

Amazon Aurora is a MySQL-compatible cloud database with a shared storage architecture:

```
Traditional MySQL replication:
  Primary writes pages → binary log → replicas replay

Aurora:
  Primary writes log records (not pages!) → shared storage layer (6 copies, 3 AZs)
  Replicas READ from same shared storage, no replay needed
  
Benefits:
  Failover: < 30 seconds (replica already has data, just become writer)
  Storage: auto-grows in 10GB increments, no pre-provisioning
  Replicas: up to 15 read replicas, all see same data with < 20ms lag
  
Aurora Global Database:
  Primary region + up to 5 secondary regions
  < 1 second cross-region replication lag
  Disaster recovery: promote secondary in < 1 minute
```

### 13.10 Production Gotchas

⚠️ **AUTO_INCREMENT gaps after rollback**: InnoDB pre-allocates AUTO_INCREMENT IDs. Rollbacks leave gaps. Never rely on sequential IDs for business logic.

⚠️ **History list length explosion**: A long-running read transaction (even SELECT!) holds old undo logs open. Purge thread can't clean them. `ibdata1` grows unboundedly. Kill long-running transactions.

⚠️ **Implicit conversions destroy indexes**: `WHERE user_id = '123'` when `user_id` is INT → MySQL converts string to int for each row → full table scan. Always match types.

⚠️ **`SELECT *` + JOIN on large tables**: No covering indexes → millions of clustered index lookups. `EXPLAIN` output shows "Using where; Using join buffer" = bad.

⚠️ **`OFFSET` pagination at large offsets**: `LIMIT 10 OFFSET 1000000` scans and discards 1M rows. Use keyset pagination: `WHERE id > last_seen_id LIMIT 10`.

📖 **War Story — GitHub 2018**: MySQL replication split during routine server maintenance. Read replicas served stale data for 24 hours. Root cause: MySQL's single-threaded replication couldn't keep up during the traffic spike after failover. Fix: upgrade to parallel replication (MySQL 5.7+ LOGICAL_CLOCK), add Orchestrator for automated topology management, add VIP-based fencing.

### 13.11 MySQL Interview Numbers

| Metric | Value |
|---|---|
| Default page size | 16 KB |
| Max row size | ~65,535 bytes |
| Max indexes per table | 64 |
| Max columns per table | 1,017 (InnoDB) |
| Default buffer pool | 128 MB |
| Recommended buffer pool | 70-80% of RAM |
| Max redo log size (8.0) | Auto-sized (was 48MB default) |
| Replication lag (sync) | Milliseconds |
| Aurora failover time | < 30 seconds |
| Aurora max read replicas | 15 |

---

## 14. APACHE CASSANDRA DEEP DIVE

> Cassandra is a leaderless, wide-column NoSQL database optimized for high write throughput and linear horizontal scaling. Originally developed at Facebook for Inbox Search, open-sourced in 2008.

### 14.1 Architecture Overview

```
Cassandra Cluster (Ring):

        Node A (token 0)
       /                \
Node D (token 270)    Node B (token 90)
       \                /
        Node C (token 180)

Every node is equal — no primary/replica hierarchy (unlike MySQL/MongoDB)
Each node: coordinator for some requests + stores data for its token range
```

**Consistent Hashing** — how data is distributed:

```
token = hash(partition_key) mod 2^64  (range: -2^63 to 2^63-1)

Virtual nodes (vnodes):
  Each physical node owns ~256 small token ranges instead of one large range
  Benefits:
    1. Better data distribution (avoids hotspots)
    2. Faster rebalancing when adding/removing nodes
    3. Handles heterogeneous hardware (bigger nodes get more vnodes)

# Disable vnodes (pre-3.0 style):
num_tokens: 1  # one token range per node
# Enable vnodes (default since 3.0):
num_tokens: 256
```

### 14.2 Write Path — Why Cassandra Is Designed for Writes

> 🌍 **Real-World:** Uber's real-time location tracking writes driver GPS coordinates to Cassandra at ~1 million writes/second across their fleet. The write path's commit-log-then-memtable design means each write is durable within microseconds (sequential commit log) while the actual SSTable flush happens asynchronously — enabling sub-millisecond write acknowledgment at massive scale.

```
Client → Coordinator node → Determines replicas via token range

On each replica:
  1. Write to Commit Log (sequential disk, crash safety)  ← like WAL
  2. Write to Memtable (in-memory sorted buffer)          ← write ACK here
  3. Memtable → SSTable flush (when full, ~32MB)          ← async

SSTable (Sorted Strings Table):
  Immutable on-disk file, sorted by partition key + clustering columns
  Never modified after written
  Multiple SSTables per table (each flush creates new one)
  
  SSTable files:
    Data.db      → actual data
    Index.db     → partition key → byte offset in Data.db
    Filter.db    → Bloom filter (is key definitely absent? if yes, skip SSTable)
    Summary.db   → index of the Index.db (for binary search)
    Statistics.db → min/max tokens, column histograms
```

**LSM Tree structure** (Log-Structured Merge Tree):

```
Level 0: Memtables (RAM) → flush → L0 SSTables
Level 1: Compaction merges L0 SSTables → sorted L1 SSTables
Level 2: Larger SSTables (10x size of L1)
...

Compaction strategies:
  STCS (Size-Tiered Compaction Strategy):
    Merges similar-sized SSTables
    Good for: write-heavy workloads
    Bad: space amplification during compaction (need 2x space)
  
  LCS (Leveled Compaction Strategy):
    Each level = 10x previous, non-overlapping SSTables
    Good for: read-heavy (fewer SSTables to check per read)
    Bad: higher write amplification (more rewrites)
  
  TWCS (Time-Window Compaction Strategy):
    Compacts SSTables within same time window
    IDEAL for time-series (data by time → compact by time → TTL deletes whole SSTables)
```

### 14.3 Read Path

```
Client → Coordinator → Sends read to replicas (based on consistency level)

On each replica:
  1. Check row cache (if enabled, usually not recommended)
  2. Check Bloom filter per SSTable: "definitely not here?" → skip SSTable
  3. Check partition key cache → find offset in Index.db
  4. Binary search Index.db → find byte offset in Data.db
  5. Read from Data.db (may span multiple SSTables)
  6. Merge results from all SSTables (newer wins via timestamp)
  7. Apply tombstones (mark deleted rows)

Read amplification:
  Worst case: read every SSTable (Bloom filter false positives + many SSTables)
  Best case: single SSTable hit after Bloom filter (LCS helps here)

Read repair:
  Coordinator gets responses from multiple replicas → compares → fixes stale replicas
  Background repair: nodetool repair (Merkle tree based, periodic)
```

### 14.4 Replication and Consistency

```
Replication factor (RF):
  CREATE KEYSPACE app WITH replication = {
    'class': 'NetworkTopologyStrategy',
    'us-east': '3',
    'eu-west': '3'
  };
  # RF=3 per DC → 6 total copies of data

Consistency levels (per query):
  ONE:      ACK from 1 replica    → fastest, least durable
  QUORUM:   ACK from (RF/2 + 1)  → strong consistency (for RF=3: need 2)
  ALL:      ACK from all replicas → strongest, lowest availability
  LOCAL_QUORUM: quorum within local DC only (most common for multi-DC)
  
Strong consistency: Write CL + Read CL > RF
  QUORUM + QUORUM for RF=3: 2 + 2 > 3 ✓ (always see latest write)
  ONE + ONE: 1 + 1 = 2 < 3 ✗ (may read stale data)
```

### 14.5 Data Modeling — Cassandra-Specific Rules

> 🌍 **Real-World:** Discord's message storage in Cassandra uses a composite primary key of `(channel_id, message_id)` where `channel_id` is the partition key — all messages in a channel land on the same partition node, making "get last 50 messages in #general" a single partition read. This query-first design choice (not entity-first) is what lets Discord handle billions of messages across millions of servers with consistent sub-10ms read latency.

Cassandra's data model is query-driven, not entity-driven:

```sql
-- Create table for: "get all messages in a conversation, newest first"
CREATE TABLE messages (
  conversation_id UUID,
  message_id TIMEUUID,   -- time-based UUID, sorts chronologically
  sender_id UUID,
  body TEXT,
  PRIMARY KEY (conversation_id, message_id)  -- composite PK
) WITH CLUSTERING ORDER BY (message_id DESC);
-- conversation_id = partition key (determines which node)
-- message_id     = clustering key (sort order within partition)

-- Efficient: single partition read, sorted by time
SELECT * FROM messages WHERE conversation_id = ? LIMIT 50;

-- NOT ALLOWED (no partition key filter):
SELECT * FROM messages WHERE sender_id = ?;  -- full cluster scan!

-- Solution: materialized view or denormalization
CREATE TABLE messages_by_sender (
  sender_id UUID,
  message_id TIMEUUID,
  conversation_id UUID,
  body TEXT,
  PRIMARY KEY (sender_id, message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
-- Duplicate data is expected in Cassandra!
```

**Partition size limits:**

```
# Hard limits:
Max partition size: 100MB (2GB theoretical, but practical limit ~100MB)
Max columns per partition: 2 billion
Max rows per partition: no limit (but large partitions = performance issues)

# Wide partitions = hot spots = slow reads/compaction
# Partition size can be checked:
nodetool cfstats keyspace.table
# or query system.size_estimates

# Fix wide partitions: add a "bucket" to partition key
-- Bad: (user_id) alone → user with 10 years of data = huge partition
-- Good: (user_id, year_month) → partition per user per month
CREATE TABLE user_events (
  user_id UUID,
  year_month TEXT,  -- '2024-01'
  event_time TIMEUUID,
  event_type TEXT,
  PRIMARY KEY ((user_id, year_month), event_time)
);
```

### 14.6 Tombstones — The Silent Killer

```
Cassandra DELETE does not remove data immediately.
Instead it writes a tombstone (a deletion marker with timestamp).

On read: tombstones are applied to filter out deleted data.
On compaction: tombstones removed after gc_grace_seconds (default: 10 days).

Why 10 days? A downed replica might miss the DELETE.
When it comes back, it needs to receive the tombstone to stay consistent.
gc_grace_seconds must be > longest expected node downtime.

Tombstone problems:
  1. Read performance: too many tombstones = slow reads (Cassandra scans them all)
  2. Tombstone warning threshold: 1,000 tombstones per read → WARN in logs
  3. Tombstone failure threshold: 100,000 tombstones → ReadTimeoutException

Fix:
  - Use TTL instead of DELETE for time-series data
  - TWCS compaction for time-series (whole SSTables expire together)
  - Smaller partitions (fewer tombstones per partition)
  - Increase read_repair_chance for affected tables

ALTER TABLE events WITH default_time_to_live = 2592000;  -- 30 days TTL
```

### 14.7 Anti-Entropy — Gossip and Merkle Trees

```
Gossip protocol (inter-node communication):
  Every second, each node contacts 1-3 random nodes
  Exchanges: node state, token ranges, schema versions, load
  Converges to consistent cluster state in O(log N) rounds
  
  Node states: NORMAL, LEAVING, JOINING, MOVING, REMOVING

Merkle trees (repair):
  nodetool repair → each node builds Merkle tree of its data
  Trees are compared across replicas
  Only differing subtrees are synchronized
  Reduces repair data transfer from O(data) to O(differences)
  
  Run repair regularly: cqlsh> nodetool repair --full keyspace
  Repair must complete within gc_grace_seconds!
  (If a replica is down > gc_grace_seconds and tombstones were compacted away,
   bringing it back will resurrect deleted data → must restart fresh)
```

### 14.8 Secondary Indexes and SASI/SAI

```sql
-- Native secondary index (avoid in production for high-cardinality columns)
CREATE INDEX ON users (email);
-- Problem: scattered across all nodes, query must hit all nodes → N-node scatter

-- SASI (SSTable Attached Secondary Index) — Cassandra 3.4+
CREATE CUSTOM INDEX ON users (email)
USING 'org.apache.cassandra.index.sasi.SASIIndex'
WITH OPTIONS = { 'mode': 'CONTAINS' };
SELECT * FROM users WHERE email LIKE '%@gmail.com%';  -- not possible with native index

-- SAI (Storage-Attached Indexing) — Cassandra 4.0+ (better than SASI)
CREATE CUSTOM INDEX ON users (last_name)
USING 'StorageAttachedIndex';
-- More space-efficient, supports range queries, integrates with compaction

-- Materialized views (Cassandra 3.0+)
CREATE MATERIALIZED VIEW users_by_email AS
  SELECT * FROM users WHERE email IS NOT NULL AND user_id IS NOT NULL
  PRIMARY KEY (email, user_id);
-- Cassandra maintains this view automatically on write (synchronously, same txn)
```

### 14.9 Production Gotchas

⚠️ **Uneven token distribution without vnodes**: If you have RF=3 and 3 nodes but one node has 50% of the token range, it handles 50% of writes. Always use vnodes (`num_tokens: 256`).

⚠️ **Coordinator penalty**: The node that receives a client request must also do extra work (contact replicas, wait for consistency level). Use token-aware load balancing in drivers so the coordinator IS a replica.

⚠️ **Batches are NOT for performance**: A `LOGGED BATCH` in CQL is for atomicity (all or none), NOT batching for performance. Large batches create a hot spot on the coordinator. Use async writes instead.

⚠️ **`allow filtering`**: `SELECT * FROM t WHERE non_pk_col = x ALLOW FILTERING` → full cluster scan. NEVER in production. It's a red flag in code review.

⚠️ **Schema changes are cluster-wide**: `ALTER TABLE ADD COLUMN` is safe. `ALTER TABLE DROP COLUMN` marks it invisible but doesn't reclaim space until compaction. Schema gossips to all nodes but propagates slowly — don't run schema changes during high traffic.

📖 **War Story — Discord 2017**: Cassandra partition for a Discord "channel messages" table grew to 100GB+ for highly active servers. Every read scanned the entire partition. Solution: add a `bucket` to the partition key (time-based bucketing), limiting partitions to ~1-10MB.

### 14.10 Cassandra Interview Numbers

| Metric | Value |
|---|---|
| Default partition size limit | ~100MB practical |
| Default gc_grace_seconds | 864,000 (10 days) |
| Tombstone warn threshold | 1,000 per read |
| Tombstone fail threshold | 100,000 per read |
| Default memtable size | ~1/4 of heap |
| SSTable flush threshold | ~32MB (configurable) |
| Gossip interval | 1 second |
| Max vnodes per node | 256 (default) |
| Bloom filter FP rate | 0.1% (default, configurable) |
| Time-series TTL (TWCS) | Per-table `default_time_to_live` |

---

## 15. MONGODB DEEP DIVE

> MongoDB is a document-oriented database storing JSON-like BSON documents. WiredTiger storage engine (default since MongoDB 3.2) provides ACID transactions at document and multi-document level.

### 15.1 WiredTiger Storage Engine

```
WiredTiger architecture:
  ┌─────────────────────────────────────────┐
  │           WiredTiger Cache              │
  │  (50% of RAM or 1GB, whichever larger)  │
  │  Pages: 4KB-32KB variable size          │
  │  B-tree pages + row-store format        │
  └──────────────────┬──────────────────────┘
                     │
  ┌──────────────────▼──────────────────────┐
  │           WiredTiger Journal            │
  │  (WAL — write-ahead log, 100MB files)   │
  │  Fsync every 100ms by default           │
  └──────────────────┬──────────────────────┘
                     │
  ┌──────────────────▼──────────────────────┐
  │           Data Files (.wt)             │
  │  Per-collection files                   │
  │  B-tree structure (row store)           │
  │  Snappy compression by default          │
  └─────────────────────────────────────────┘

WiredTiger features:
  - Document-level concurrency (no collection-level locks)
  - MVCC: readers don't block writers, writers don't block readers
  - Compression: Snappy (default), zlib (better ratio), zstd (MongoDB 4.2+)
  - In-memory storage engine available (separate from main)
```

### 15.2 BSON Document Model

```javascript
// BSON = Binary JSON, allows typed data
{
  _id: ObjectId("64a7b2c3d4e5f6a7b8c9d0e1"),  // 12-byte: 4 timestamp + 5 random + 3 counter
  name: "Alice",
  age: 30,
  created_at: ISODate("2024-01-15T10:30:00Z"),
  tags: ["premium", "verified"],
  address: {
    city: "San Francisco",
    zip: "94105",
    location: {             // GeoJSON for geospatial queries
      type: "Point",
      coordinates: [-122.4194, 37.7749]
    }
  },
  scores: [
    { subject: "math", score: 95 },
    { subject: "english", score: 88 }
  ]
}

// ObjectId uniqueness: 4-byte timestamp ensures docs sortable by creation time
db.users.find().sort({ _id: 1 })  // chronological order without separate timestamp field

// BSON types not in JSON:
// Date, ObjectId, Binary, Decimal128, Int32, Int64, Regex, Timestamp
```

### 15.3 Indexes in Depth

```javascript
// Single field index
db.users.createIndex({ email: 1 })  // 1 = ascending, -1 = descending

// Compound index (field order matters!)
db.orders.createIndex({ user_id: 1, created_at: -1 })
// Supports: { user_id: x }, { user_id: x, created_at: y }
// Does NOT support: { created_at: y } alone (leftmost prefix rule)

// Multikey index (for arrays) — auto-created when indexing array field
db.products.createIndex({ tags: 1 })
// Query: db.products.find({ tags: "electronics" })
// One index entry per array element (large arrays = large index)

// Text index (for full-text search — not production grade, use Elasticsearch)
db.articles.createIndex({ title: "text", body: "text" }, { weights: { title: 10, body: 1 } })
db.articles.find({ $text: { $search: "mongodb tutorial" } }, { score: { $meta: "textScore" } })

// Partial index (index only subset of documents)
db.users.createIndex({ email: 1 }, { partialFilterExpression: { active: true } })
// Smaller index, faster writes for inactive users, query must include active:true filter

// Sparse index (exclude documents missing the field)
db.users.createIndex({ phone: 1 }, { sparse: true })
// Documents without 'phone' field not indexed, UNIQUE sparse allows multiple nulls

// TTL index (auto-delete documents after expiry)
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 3600 })
// MongoDB deletes expired documents every 60 seconds in background

// 2dsphere index (geospatial)
db.places.createIndex({ location: "2dsphere" })
db.places.find({
  location: {
    $near: { $geometry: { type: "Point", coordinates: [-122.4, 37.7] }, $maxDistance: 1000 }
  }
})

// Explain plans
db.orders.find({ user_id: 123 }).explain("executionStats")
// Look for: "COLLSCAN" (bad) vs "IXSCAN" (good)
// totalDocsExamined >> nReturned = index not selective enough
```

### 15.4 Aggregation Pipeline

The aggregation pipeline is MongoDB's most powerful query feature:

```javascript
// Pipeline stages executed in order, output of each is input to next
db.orders.aggregate([
  // Stage 1: filter
  { $match: { status: "completed", created_at: { $gte: ISODate("2024-01-01") } } },

  // Stage 2: join with users collection
  { $lookup: {
    from: "users",
    localField: "user_id",
    foreignField: "_id",
    as: "user"
  }},

  // Stage 3: unwind joined array (lookup returns array)
  { $unwind: "$user" },

  // Stage 4: group and aggregate
  { $group: {
    _id: "$user.country",
    total_revenue: { $sum: "$amount" },
    order_count: { $sum: 1 },
    avg_order: { $avg: "$amount" }
  }},

  // Stage 5: sort
  { $sort: { total_revenue: -1 } },

  // Stage 6: limit
  { $limit: 10 },

  // Stage 7: reshape output
  { $project: {
    country: "$_id",
    total_revenue: { $round: ["$total_revenue", 2] },
    order_count: 1,
    avg_order: { $round: ["$avg_order", 2] },
    _id: 0
  }}
])

// Advanced pipeline operators:
// $facet: multiple pipelines in parallel
// $bucket/$bucketAuto: histogram bucketing
// $graphLookup: recursive/graph traversals
// $out/$merge: write results to collection
// $setWindowFields: window functions (MongoDB 5.0+)

// Window function example (running total):
db.sales.aggregate([
  { $setWindowFields: {
    partitionBy: "$user_id",
    sortBy: { date: 1 },
    output: {
      cumulativeTotal: {
        $sum: "$amount",
        window: { documents: ["unbounded", "current"] }
      }
    }
  }}
])
```

### 15.5 Replica Sets

> 🌍 **Real-World:** Foursquare (later Swarm) uses MongoDB replica sets with `writeConcern: "majority"` for their venue check-in data — a check-in write is only confirmed when 2 of 3 replicas have committed it, ensuring no check-in is lost even if the primary fails immediately after the write. Combined with `readPreference: "secondaryPreferred"`, their read traffic distributes across replicas, reducing primary load by ~60%.

```
MongoDB Replica Set:
  1 Primary (accepts writes)
  1-7 Secondaries (replicate from primary)
  Optional: Arbiters (vote in elections, no data)

Primary → Secondary replication via oplog:
  oplog = operations log, a capped collection in 'local' database
  Secondaries tail the primary's oplog, apply operations
  Oplog is idempotent (can be applied multiple times safely)
  
Replication lag monitoring:
  rs.printReplicationInfo()  // oplog window
  rs.printSlaveReplicationInfo()  // lag per secondary

Read preferences (driver-level):
  primary         → always read from primary (default, strong consistency)
  primaryPreferred → primary if available, else secondary
  secondary        → always secondary (stale reads, reduces primary load)
  secondaryPreferred → secondary if available
  nearest         → lowest latency member (local DC)

Automatic failover:
  Primary unreachable → secondaries hold election
  Election needs majority (>50%) of voting members
  New primary elected within ~10-30 seconds
  
  writeConcern: { w: "majority" }  // wait for majority ACK
  readConcern: "majority"          // read only committed-to-majority data
  
  Combined = linearizable across failovers (no rollback on new primary)
```

### 15.6 Sharding

> 🌍 **Real-World:** Airbnb uses MongoDB sharding by `listing_id` (hashed) to distribute their listing catalog across multiple shards — each shard owns roughly 1/N of listings, and writes from hosts updating their listings spread evenly across all shards, preventing the hot-shard problem that would occur with range-based sharding on sequential IDs.

```
MongoDB Sharded Cluster:
  mongos (router): query router, no data
  Config servers (3): store cluster metadata, shard map
  Shards (N): each is a replica set holding a portion of data

Shard keys:
  Range-based sharding:
    db.orders.createIndex({ user_id: 1 })
    sh.shardCollection("mydb.orders", { user_id: 1 })
    // Chunks: [MinKey, 1000), [1000, 2000), [2000, MaxKey)
    // Risk: range scans efficient, but monotonically increasing key = hot shard

  Hashed sharding:
    sh.shardCollection("mydb.users", { _id: "hashed" })
    // Hash of _id determines chunk → even write distribution
    // Risk: range queries become scatter-gather (all shards)

  Zone sharding (tag-based):
    // Route US users to US shard, EU users to EU shard (GDPR compliance)
    sh.addShardTag("shard1", "US")
    sh.addTagRange("mydb.users", { country: "US" }, { country: "US￿" }, "US")

Chunk balancing:
  Default chunk size: 128MB
  Balancer process: moves chunks between shards to equalize data
  Avoid: shard key with low cardinality (e.g., boolean) → only 2 chunks, can't split

Targeted vs scatter-gather:
  Targeted query: includes shard key → goes to exactly 1 shard
  Scatter-gather: no shard key → goes to ALL shards, results merged by mongos
  
  Scatter-gather is 10-100x slower at scale → ALWAYS include shard key in queries
```

### 15.7 Transactions (4.0+)

```javascript
// Multi-document ACID transactions
const session = client.startSession()
session.startTransaction({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' }
})

try {
  await orders.insertOne({ user_id: 1, amount: 100, status: 'pending' }, { session })
  await inventory.updateOne(
    { product_id: 42, stock: { $gte: 1 } },
    { $inc: { stock: -1 } },
    { session }
  )
  await session.commitTransaction()
} catch (err) {
  await session.abortTransaction()  // full rollback
} finally {
  session.endSession()
}

// Transaction limitations:
// Max runtime: 60 seconds (default, configurable)
// Max document locks: 1000 (can increase with transactionLifetimeLimitSeconds)
// Transactions on sharded clusters: require 2PC → higher latency
// Prefer single-document atomicity when possible (MongoDB guarantees this free)
```

### 15.8 Change Streams

```javascript
// Real-time change feed (built on oplog)
const changeStream = db.collection('orders').watch([
  { $match: { 'fullDocument.status': 'completed' } }
])

changeStream.on('change', (event) => {
  console.log(event.operationType)   // insert, update, replace, delete
  console.log(event.fullDocument)    // the new document
  console.log(event.updateDescription.updatedFields)  // changed fields only
  console.log(event._id)             // resume token → store this for restart
})

// Resume after failure using resume token
const resumeStream = db.collection('orders').watch([], {
  resumeAfter: lastSeenResumeToken
})
// Guaranteed delivery as long as resume token is within oplog window
```

### 15.9 Production Gotchas

⚠️ **Working set must fit in WiredTiger cache**: If your active data exceeds 50% of RAM, you get constant page faults. Monitor `wiredTiger.cache["bytes currently in the cache"]` vs cache size.

⚠️ **$lookup on unindexed foreign field**: `$lookup` without index on the `foreignField` does a collection scan per document. Always index the `foreignField`.

⚠️ **Capped collection oplog window**: If your application falls behind in reading the oplog (change streams, replication), events are lost. Default oplog size: 5% of disk or 1GB. Increase for busy primaries: `rs.printReplicationInfo()` shows window.

⚠️ **Document growth → moves**: Before MongoDB 3.0, updating a document to be larger caused it to move on disk (slow). WiredTiger stores documents in place with padding. Old MMAPv1 concern — irrelevant now but still comes up in interviews.

⚠️ **Unbounded array growth**: Storing all events in an array field → document grows → eventually hits 16MB BSON limit → write fails. Use time-bucketing patterns or separate collections.

📖 **War Story — Foursquare 2010**: 11-hour outage. MongoDB ran out of disk space due to database file pre-allocation (MMAPv1 doubled file sizes). Modern WiredTiger doesn't pre-allocate. But the lesson: monitor disk growth rate, not just current usage.

### 15.10 MongoDB Interview Numbers

| Metric | Value |
|---|---|
| Max document size | 16 MB |
| Default WiredTiger cache | 50% RAM or 1 GB |
| Max oplog window (default) | 5% of disk space or min 990 MB |
| Chunk size (sharding) | 128 MB default |
| Max replica set members | 50 (7 voting) |
| Election timeout | ~10-30 seconds |
| Max transaction runtime | 60 seconds |
| Default journal sync | 100 ms |
| Compound index field limit | 32 fields |
| Max indexes per collection | 64 |

---

## 16. REDIS DEEP DIVE

> Redis (Remote Dictionary Server) is an in-memory data structure store. Used as cache, message broker, session store, rate limiter, leaderboard, and real-time analytics. Single-threaded (mostly), guarantees operation atomicity.

### 16.1 Data Structures and Internal Encoding

Redis automatically chooses memory-efficient internal encodings based on size:

```
String:
  int     → stores as integer (if value is integer, < 2^63)
  embstr  → short strings < 44 bytes (single allocation)
  raw     → strings > 44 bytes (two allocations: robj + SDS)

  SDS (Simple Dynamic String):
    struct sdshdr64 { uint64_t len; uint64_t alloc; char flags; char buf[]; }
    Unlike C strings: O(1) length, binary-safe, no realloc on append

List (Redis 7.2+):
  listpack → compact encoding for small lists (< 128 elements, < 64 bytes each)
  quicklist → linked list of listpack nodes (for larger lists)
    - quicklist-node-max-ziplist-size 128 (entries per node)

Hash:
  listpack → for small hashes (< 128 entries, keys/values < 64 bytes)
  hashtable → for large hashes (double-hashed, open addressing)

Set:
  intset   → when all members are integers (sorted array, binary search, O(log N))
  listpack → small sets (< 128 members, all < 64 bytes each)
  hashtable → large sets

ZSet (Sorted Set):
  listpack → small sorted sets (< 128 members, values < 64 bytes)
  skiplist + hashtable → large sorted sets
    skiplist: O(log N) range queries, O(log N) insert/delete
    hashtable: O(1) score lookup by member
    Both in sync → ZRANGEBYSCORE (skiplist) and ZSCORE (hashtable)

Skiplist structure:
  Level 4: [head] ─────────────────────────────────── [tail]
  Level 3: [head] ──────────── [25] ─────────────────── [tail]
  Level 2: [head] ─── [10] ─── [25] ─── [50] ────────── [tail]
  Level 1: [head] [5] [10] [20] [25] [35] [50] [75] [tail]
  
  ZRANGEBYSCORE: traverse from appropriate level, O(log N + M) where M = results
```

### 16.2 Common Patterns with Commands

> 🌍 **Real-World:** Twitter's trending topics use Redis Sorted Sets (ZSets) — each hashtag's tweet count is the score, and `ZREVRANGEBYSCORE` returns the top-10 trending topics in O(log N + k) time. The entire global trending calculation runs in Redis in-memory, updating in real time as tweets come in, with the final top-10 list cached as a simple String key that's refreshed every 30 seconds.

```bash
# Cache with TTL
SET user:123 '{"name":"Alice"}' EX 3600          # set with 1hr TTL
GETEX user:123 EX 3600                            # get and reset TTL
SET user:123 data NX EX 60                        # set only if not exists (distributed lock)

# Counter / Rate limiting
INCR api:requests:user:123                        # atomic increment
EXPIRE api:requests:user:123 60                   # set TTL if not set
INCRBY orders:total 100                           # increment by value

# Sorted set leaderboard
ZADD leaderboard 95 "alice" 87 "bob" 92 "charlie"
ZREVRANK leaderboard "alice"                      # 0 (rank 1)
ZREVRANGEBYSCORE leaderboard +inf -inf WITHSCORES LIMIT 0 10  # top 10
ZINCRBY leaderboard 5 "bob"                       # add 5 to bob's score

# Hash for user session
HSET session:abc token "xyz" user_id "123" expires "1735689600"
HMGET session:abc token user_id                   # multi-field get
HGETALL session:abc
HEXPIRE session:abc 3600 FIELDS 2 token expires   # Redis 7.4+: per-field TTL

# List as message queue
LPUSH jobs:queue '{"type":"email","to":"user@example.com"}'
BRPOP jobs:queue 30                               # blocking pop, 30s timeout
LLEN jobs:queue                                   # queue depth

# Bloom filter (RedisBloom module)
BF.ADD email:filter user@example.com              # returns 0 if new, 1 if may exist
BF.EXISTS email:filter user@example.com           # check membership

# HyperLogLog (cardinality estimation, ~0.81% error, 12KB memory)
PFADD pageviews:2024-01-15 user1 user2 user3
PFCOUNT pageviews:2024-01-15                      # estimated unique visitors
PFMERGE pageviews:week pageviews:mon pageviews:tue ... # merge
```

### 16.3 Persistence: RDB vs AOF

> 🌍 **Real-World:** GitHub uses Redis with `appendfsync everysec` (AOF) for their rate-limiting and API quota system — accepting up to 1 second of potential data loss in exchange for 5x higher throughput. For rate limits, losing 1 second of counter increments on a crash is acceptable (a small number of extra API calls through), whereas a pure RDB snapshot could lose 60+ seconds of increments.

```
RDB (Redis Database Snapshot):
  Complete point-in-time snapshot of in-memory data
  
  # redis.conf
  save 900 1    # save if 1 key changed in 900s
  save 300 10   # save if 10 keys changed in 300s
  save 60 10000 # save if 10000 keys changed in 60s
  dbfilename dump.rdb
  
  Process:
    BGSAVE → fork() → child writes RDB → atomic rename
    fork() cost: can pause for seconds on large datasets (copy-on-write)
    
  Pros: compact, fast restart, good for backups
  Cons: potential data loss of up to save interval (e.g., 60s)

AOF (Append Only File):
  Logs every write command
  
  appendonly yes
  appendfsync everysec   # fsync every second (recommended)
  # appendfsync always   # fsync every command (safest, slowest)
  # appendfsync no       # OS decides (fastest, risk of 30s data loss)
  
  AOF rewrite: compacts log (BGREWRITEAOF or auto when AOF > 100% of previous)
    In-memory state → minimal AOF (removes intermediate commands)
    e.g., SET x 1; INCR x; INCR x → rewritten as SET x 3
  
  Pros: up to 1s data loss, human-readable log
  Cons: larger files, slower restart (replay all commands)

RDB + AOF (Recommended for production):
  AOF for durability, RDB for fast restarts
  Redis 7.0 AOF: uses RDB snapshot as base + incremental AOF changes

  aof-use-rdb-preamble yes  # hybrid mode (default in Redis 7)
```

### 16.4 Replication and High Availability

```
Redis Sentinel (HA for single-instance Redis):
  3+ sentinel processes monitor master + replicas
  On master failure: sentinels vote (quorum), elect new master, reconfigure replicas
  Client asks sentinel for current master address
  
  # sentinel.conf
  sentinel monitor mymaster 127.0.0.1 6379 2   # quorum = 2
  sentinel down-after-milliseconds mymaster 5000
  sentinel failover-timeout mymaster 10000
  
  Failover process (~30 seconds):
    1. Sentinel detects master unreachable (SDOWN → ODOWN after quorum)
    2. Leader sentinel elected (Raft-like)
    3. Best replica chosen (most up-to-date replid+offset)
    4. Replica promoted, others point to new master
    5. Old master demoted to replica when it comes back
  
  Replication lag: replica may be seconds behind master
  On failover: data written to old master but not replicated = LOST
  Use WAIT command to synchronize: WAIT 1 1000  (wait for 1 replica ACK, 1s timeout)

Redis Cluster (horizontal scaling):
  16,384 hash slots distributed across nodes
  hash_slot = CRC16(key) mod 16384
  
  # 3 master nodes: 0-5460, 5461-10922, 10923-16383
  # Each master has 1-N replicas
  
  Key routing:
    Client → any node → if wrong slot: MOVED response with correct node
    Smart clients cache slot map → direct routing
    
  Hash tags: {user_id}.profile, {user_id}.session → same slot (same {})
    Needed for multi-key commands (MGET, ZADD) across different keys
    Without hash tags: cross-slot operations not allowed
  
  Resharding:
    Add node → migrate slots → old node loses slots
    redis-cli --cluster reshard
    Zero-downtime: CLUSTER SETSLOT MIGRATING/IMPORTING states
```

### 16.5 Lua Scripting

```lua
-- Atomic operations not available as single commands
-- Lua scripts run atomically (no other commands execute between lines)

-- Rate limiter script (atomic check-and-increment)
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return 0  -- rate limit exceeded
else
  local new_val = redis.call('INCR', KEYS[1])
  if new_val == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
  end
  return 1  -- allowed
end

-- Load script (get SHA):
-- SCRIPT LOAD "$(cat rate_limit.lua)"
-- → "abc123def456..."

-- Execute:
-- EVALSHA abc123def456 1 "ratelimit:user:123" 100 60
--   1 key: "ratelimit:user:123"
--   arg1: 100 (max requests)
--   arg2: 60 (window seconds)

-- Inline EVAL (development):
-- EVAL "return redis.call('SET', KEYS[1], ARGV[1])" 1 mykey myvalue

-- redis.pcall vs redis.call:
-- redis.call: raises error if Redis command fails (propagates to client)
-- redis.pcall: catches error (returns error table, script continues)
```

### 16.6 Redis Streams

> 🌍 **Real-World:** Uber uses Redis Streams as a lightweight event bus for real-time driver-to-rider matching events — driver location updates and ride requests are published as stream entries, and matching workers use consumer groups to process events exactly once. Redis Streams gives Kafka-like semantics with consumer group acknowledgment, but with Redis's sub-millisecond latency for the latency-critical matching pipeline.

```bash
# Redis Streams (Redis 5.0) — append-only log, consumer groups

# Produce messages
XADD orders * order_id 12345 amount 99.99 status pending
# * = auto-generate ID (timestamp-sequence: 1704067200000-0)

# Read latest N messages
XREAD COUNT 10 STREAMS orders 0  # from beginning
XREAD COUNT 10 STREAMS orders $  # only new messages

# Consumer groups (Kafka-like semantics)
XGROUP CREATE orders mygroup $ MKSTREAM  # start from latest

# Consumer reads + acknowledges
XREADGROUP GROUP mygroup consumer1 COUNT 10 STREAMS orders >
# > = deliver new (undelivered) messages
# Returns: message IDs + data
XACK orders mygroup 1704067200000-0  # acknowledge processing

# Pending messages (delivered but not ACKed)
XPENDING orders mygroup - + 10  # show unacked
XCLAIM orders mygroup consumer2 30000 1704067200000-0  # reassign after 30s

# Dead letter queue pattern:
# If message retried N times → move to dead-letter stream
```

### 16.7 Production Gotchas

⚠️ **`KEYS *` in production = instant performance kill**: KEYS blocks the entire Redis instance while scanning. Use `SCAN 0 MATCH pattern COUNT 100` instead (incremental, non-blocking).

⚠️ **Memory fragmentation**: Redis allocates/frees frequently → jemalloc fragmentation. `INFO memory` shows `mem_fragmentation_ratio`. > 1.5 = problem. `CONFIG SET activedefrag yes` for online defrag (Redis 4.0+).

⚠️ **fork() latency for RDB/AOF rewrite**: `fork()` triggers copy-on-write. On 10GB Redis with high write rate, pages get dirtied → COW copies data → fork child may need to copy GB of data. Monitor `latest_fork_usec` in `INFO stats`. Minimize by: disabling THP, using smaller instances.

⚠️ **Expiry is lazy + periodic**: Keys with TTL are deleted on access (lazy) OR background scan (every 100ms, 20 random keys). If 25% have expired → repeat. High expiry rate → CPU spike. Don't set all keys to expire at the same time.

⚠️ **Cluster doesn't support all multi-key commands**: `MGET k1 k2` fails if k1 and k2 are on different slots. Use hash tags `{user123}:profile` and `{user123}:session` to force same slot.

📖 **War Story — Stack Overflow 2013**: Redis was used for caching but the cache instance ran out of memory and started evicting keys randomly. Application code assumed cache hits → NullPointerExceptions. Lesson: always code for cache misses, set `maxmemory-policy allkeys-lru` and test behavior under eviction pressure.

### 16.8 Redis Interview Numbers

| Metric | Value |
|---|---|
| Max key size | 512 MB |
| Max value size | 512 MB |
| Hash slots (cluster) | 16,384 |
| HyperLogLog error rate | ~0.81% |
| HyperLogLog size | 12 KB max |
| Default max memory | No limit (set maxmemory!) |
| Sentinel failover time | ~30 seconds |
| AOF fsync (everysec) | Max 1 second data loss |
| Single-thread throughput | ~100K ops/sec (simple gets) |
| Cluster max nodes | 1000 recommended |

---

## 17. ELASTICSEARCH DEEP DIVE

> Elasticsearch is a distributed search and analytics engine built on Apache Lucene. Optimized for full-text search, log analytics, and aggregations. Uses an inverted index for near-real-time search.

### 17.1 Inverted Index

> 🌍 **Real-World:** GitHub's code search indexes over 200 billion lines of code in Elasticsearch using inverted indexes — a search for a function name like `parseQueryString` resolves to a posting list of file IDs containing that exact token in milliseconds, despite the corpus being petabytes in size. The inverted index makes what would be a full-scan-of-the-internet into a single dictionary lookup.

The core data structure powering Elasticsearch:

```
Documents:
  Doc 1: "The quick brown fox"
  Doc 2: "The lazy fox jumped"
  Doc 3: "Quick brown dog"

Inverted Index (after tokenization + lowercasing):
  Term     │ Document IDs (postings list) │ Positions
  ─────────┼──────────────────────────────┼──────────
  "the"    │ [1, 2]                       │ 1→[1], 2→[1]
  "quick"  │ [1, 3]                       │ 1→[2], 3→[1]
  "brown"  │ [1, 3]                       │ 1→[3], 3→[2]
  "fox"    │ [1, 2]                       │ 1→[4], 2→[3]
  "lazy"   │ [2]                          │ 2→[2]
  "jumped" │ [2]                          │ 2→[4]
  "dog"    │ [3]                          │ 3→[3]

Search "quick fox":
  quick → [1, 3]
  fox   → [1, 2]
  Intersection: [1]  → Doc 1 matches both terms
  BM25 scoring: term frequency + inverse document frequency
```

**Lucene Segments** — the immutable building blocks:

```
Each Elasticsearch shard = one Lucene index = multiple segments

Segment:
  inverted index (terms → doc IDs)
  doc values (column store for sorting/aggregations)
  stored fields (original document for _source)
  term vectors (per-document term info, optional)

Immutability:
  New documents → new segment (written on refresh)
  Deleted documents → deletion bitmap (marked, not removed)
  Updated document → delete old + write new to new segment

Refresh (default 1 second):
  translog (in-memory buffer) → flushed to new Lucene segment
  After refresh: document is searchable
  "Near real-time" = 1 second default lag

Merge:
  Background process merges small segments → fewer, larger segments
  Deletes physically removed during merge
  Force merge: POST /my-index/_forcemerge?max_num_segments=1
  (run on read-only historical indices to optimize read performance)

translog (WAL):
  Every write → translog before segment write
  On flush: fsync translog → write to Lucene segment file
  Provides durability between segment flushes
  fsync: index.translog.durability = request (default, each write) 
         or async (better perf, 5s data loss risk)
```

### 17.2 Cluster Architecture

```
Elasticsearch Cluster:
  ┌────────────────────────────────────────┐
  │           Master Node                 │
  │  Cluster state: index metadata,       │
  │  shard allocation, node membership    │
  └─────────────────┬──────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
  ┌──▼──┐        ┌──▼──┐        ┌──▼──┐
  │Data │        │Data │        │Data │
  │Node │        │Node │        │Node │
  │P1 R2│        │P2 R1│        │P3 R3│
  │P2 R3│        │P3 R1│        │P1 R2│
  └─────┘        └─────┘        └─────┘

P = Primary shard, R = Replica shard
Never same shard on same node (replicas on different nodes)

Node roles:
  master-eligible: participates in master elections (odd number, 3+ for HA)
  data: stores shards, handles search/indexing
  coordinating-only: routes requests, merges results (no data storage)
  ingest: pre-processing pipeline before indexing

Shard sizing:
  Recommended shard size: 10-50 GB
  Rule of thumb: max 20 shards per GB heap
  Too many small shards: overhead of coordinating many shards
  Too few large shards: can't parallelize well
```

### 17.3 Query DSL

```json
// Full-text search with relevance scoring
GET /articles/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "elasticsearch tutorial" } }
      ],
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "published_at": { "gte": "2024-01-01" } } }
      ],
      "should": [
        { "match": { "tags": "beginner" } }
      ],
      "must_not": [
        { "term": { "archived": true } }
      ]
    }
  },
  "sort": [
    { "_score": { "order": "desc" } },
    { "published_at": { "order": "desc" } }
  ],
  "from": 0, "size": 10,
  "_source": ["title", "summary", "author"],
  "highlight": {
    "fields": { "title": {}, "body": { "fragment_size": 150 } }
  }
}

// match: analyzes query (tokenizes, stems) before searching
// term: exact value match (no analysis — use for IDs, enums, keywords)
// range: numeric/date ranges
// filter: no scoring (faster, cached)
// must/should affect score; filter does not

// Fuzzy search (typo tolerance)
GET /users/_search
{
  "query": {
    "fuzzy": { "name": { "value": "Alixe", "fuzziness": "AUTO" } }
  }
}

// Phrase search (words in order, adjacent)
{ "match_phrase": { "body": "quick brown fox" } }

// Geo distance query
{
  "query": {
    "bool": {
      "filter": {
        "geo_distance": {
          "distance": "10km",
          "location": { "lat": 37.77, "lon": -122.41 }
        }
      }
    }
  }
}
```

### 17.4 Aggregations

```json
// Terms + date histogram + nested aggregations
GET /orders/_search
{
  "size": 0,
  "aggs": {
    "revenue_by_month": {
      "date_histogram": {
        "field": "created_at",
        "calendar_interval": "month"
      },
      "aggs": {
        "total_revenue": { "sum": { "field": "amount" } },
        "avg_order": { "avg": { "field": "amount" } },
        "top_products": {
          "terms": { "field": "product_id", "size": 5 },
          "aggs": {
            "product_revenue": { "sum": { "field": "amount" } }
          }
        }
      }
    },
    "status_breakdown": {
      "terms": { "field": "status" }
    },
    "percentile_amounts": {
      "percentiles": { "field": "amount", "percents": [50, 95, 99] }
    }
  }
}

// Aggregation types:
// Bucket: group documents (terms, date_histogram, range, geo_grid, filters)
// Metric: compute values (sum, avg, min, max, percentiles, cardinality)
// Pipeline: aggregate aggregation results (derivative, cumulative_sum, moving_avg)

// Cardinality (HyperLogLog, approximate unique count)
{ "aggs": { "unique_users": { "cardinality": { "field": "user_id" } } } }
// precision_threshold: 0-40000, default 3000 (higher = more RAM, more accurate)
```

### 17.5 Mappings and Analyzers

```json
// Explicit mapping (recommended over dynamic)
PUT /users
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },              // exact match only
      "name": { "type": "text",                 // full-text analyzed
        "analyzer": "english",                  // stem, remove stop words
        "fields": {
          "raw": { "type": "keyword" }          // multi-field: exact match too
        }
      },
      "email": { "type": "keyword" },           // not analyzed
      "bio": { "type": "text" },
      "age": { "type": "integer" },
      "created_at": { "type": "date" },
      "tags": { "type": "keyword" },            // array is automatic in ES
      "location": { "type": "geo_point" },
      "metadata": { "type": "object",           // nested object
        "properties": {
          "plan": { "type": "keyword" }
        }
      },
      "orders": { "type": "nested" }            // nested docs (separate Lucene docs)
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index.refresh_interval": "1s",
    "analysis": {
      "analyzer": {
        "custom_english": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "english_stop", "english_stemmer"]
        }
      }
    }
  }
}

// object vs nested:
// object: inner object fields flattened → array of objects loses pairing
// nested: each inner object = separate Lucene document → correct array queries

// Dynamic mapping pitfalls:
// New field added → mapping update → all existing docs don't have it indexed
// "date" string auto-detected → if format changes later → mapping conflict
// Solution: set "dynamic": "strict" to reject unknown fields
```

### 17.6 Index Lifecycle Management (ILM)

> 🌍 **Real-World:** Netflix's ELK stack uses ILM to manage terabytes of application logs daily — hot nodes (NVMe SSD) hold the last 7 days for real-time alerting and search, warm nodes (SSD) hold 7–30 days for incident investigation, cold nodes (HDD) hold 30–90 days for compliance, then logs are deleted. This tiered architecture reduces storage costs by 70% compared to keeping all logs on hot nodes while still enabling fast searches on recent data.

```json
// Hot-Warm-Cold-Delete architecture for time-series data
PUT /_ilm/policy/logs_policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": { "max_size": "50gb", "max_age": "7d" },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {},
          "set_priority": { "priority": 0 }
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}

// Data stream: rollover-friendly alias
// logs-* pattern → current write index: logs-000001
// On rollover: logs-000002 created, alias moves forward
```

### 17.7 Production Gotchas

⚠️ **Heap size = 50% of RAM, max 32GB**: JVM compressed oops work below ~32GB heap. Setting 32GB heap gives you 2x+ usable object references vs 31GB. Set `-Xms26g -Xmx26g`. The other 50% of RAM is for Lucene's filesystem cache (OS page cache).

⚠️ **Mapping explosion**: Dynamic mapping with high-cardinality field names (e.g., user-defined keys) → millions of mappings → cluster instability. Set `index.mapping.total_fields.limit` and use `type: object` with `dynamic: false` for open-ended user data.

⚠️ **Deep pagination with `from/size`**: `from: 10000, size: 10` requires coordinating node to fetch 10,010 results from each shard, sort, then discard 10,000. Use `search_after` for deep pagination (stateless keyset pagination).

⚠️ **Split-brain without quorum**: Must have `discovery.zen.minimum_master_nodes = N/2 + 1`. With 3 masters and split: partition of 2 can still elect, partition of 1 cannot. Elasticsearch 7.0+: `cluster.initial_master_nodes` handles this automatically.

⚠️ **Refresh on every index = performance kill**: `index.refresh_interval: -1` during bulk indexing, then set to `1s` after. Default 1-second refresh creates a new Lucene segment per second → many small segments → slow queries → forced merges.

📖 **War Story — Wikimedia 2013**: Elasticsearch cluster split-brain: two nodes both thought they were the master. Each accepted writes → data diverged → corruption. Fix: always use odd number of master-eligible nodes, set `minimum_master_nodes` correctly.

### 17.8 Elasticsearch Interview Numbers

| Metric | Value |
|---|---|
| Recommended shard size | 10-50 GB |
| Max shards per GB heap | 20 |
| Default refresh interval | 1 second |
| JVM heap sweet spot | ~26-30 GB (compressed oops < 32GB) |
| Max heap (compressed oops) | ~31 GB |
| Bulk indexing recommended size | 5-15 MB per request |
| Default max result window | 10,000 (from + size) |
| Translog durability | Each request (default) |
| Segment merge I/O throttle | 20 MB/s (default) |
| Max field limit per index | 1,000 (configurable) |

---

## 18. TIMESCALEDB DEEP DIVE

> TimescaleDB is a PostgreSQL extension that transforms PostgreSQL into a purpose-built time-series database. All standard PostgreSQL tools work (psql, pg_dump, Grafana, etc.) but with automatic time-based partitioning, compression, and downsampling.

### 18.1 Hypertables and Chunks

> 🌍 **Real-World:** Grafana Labs uses TimescaleDB to store metrics for their cloud monitoring platform — millions of time-series from thousands of customers are stored in hypertables partitioned by time. Chunk pruning means a query for "last 1 hour of CPU metrics" touches only the current chunk (a few GB) rather than the full table (terabytes), reducing query time from minutes to milliseconds.

```sql
-- Standard PostgreSQL table
CREATE TABLE metrics (
  time        TIMESTAMPTZ NOT NULL,
  device_id   TEXT NOT NULL,
  temperature DOUBLE PRECISION,
  humidity    DOUBLE PRECISION
);

-- Convert to hypertable (partitioned by time automatically)
SELECT create_hypertable('metrics', 'time', chunk_time_interval => INTERVAL '1 day');

-- Optionally partition by device_id too (space partitioning)
SELECT create_hypertable('metrics', 'time',
  partitioning_column => 'device_id',
  number_partitions => 4,
  chunk_time_interval => INTERVAL '1 week'
);
```

**Chunks** are the physical partitions:

```
metrics (hypertable)
├── _hyper_1_1_chunk  (2024-01-01 to 2024-01-02)
├── _hyper_1_2_chunk  (2024-01-02 to 2024-01-03)
├── _hyper_1_3_chunk  (2024-01-03 to 2024-01-04)  ← current (open)
└── ... (past chunks are closed, can be compressed)

Benefits of chunking:
  1. Query pruning: "WHERE time > '2024-01-02'" only touches chunks 2+ 
  2. Drop old data: DROP TABLE chunk (instant, vs DELETE + VACUUM)
  3. Compression: compress old chunks independently
  4. Parallel queries: each chunk can be processed in parallel
  5. Indexes: each chunk has its own indexes (smaller = faster)

-- Check chunks
SELECT * FROM timescaledb_information.chunks WHERE hypertable_name = 'metrics';
-- Check chunk sizes
SELECT * FROM chunks_detailed_size('metrics') ORDER BY range_start DESC;
```

### 18.2 Compression

> 🌍 **Real-World:** A large IoT platform (similar to Bosch's industrial monitoring) reduced their TimescaleDB storage from 8TB to 400GB (20:1 ratio) by enabling columnar compression on chunks older than 7 days — sensor readings (floats) compress extremely well with delta-delta + Gorilla encoding because consecutive temperature readings differ by tiny fractions, making the differences nearly zero and compressible to a handful of bits each.

TimescaleDB columnar compression on old chunks:

```sql
-- Enable compression for chunks older than 7 days
ALTER TABLE metrics SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'time DESC',
  timescaledb.compress_segmentby = 'device_id'
);

SELECT add_compression_policy('metrics', INTERVAL '7d');

-- Manual compress
SELECT compress_chunk(c) FROM show_chunks('metrics', older_than => INTERVAL '7d') c;

-- Compression ratios: typically 90-95% for time-series
-- Example: 100GB uncompressed → 5-10GB compressed
-- Trade-off: compressed chunks are slower to update/delete (must decompress first)

-- Compression internals:
--   segmentby (device_id): groups rows by device, stored together
--   orderby (time DESC): rows sorted within segment for better delta encoding
--   
--   Encoding per column type:
--     Timestamps: delta-delta encoding (differences of differences)
--     Floats: Gorilla XOR encoding (Facebook's algorithm)
--     Strings: dictionary encoding
--     Integers: Simple-8b packing

-- Check compression stats
SELECT * FROM hypertable_compression_stats('metrics');
-- compression_ratio: e.g., 0.05 = 20:1 compression (95% savings)
```

### 18.3 Continuous Aggregates

Pre-computed, automatically updated rollup views:

```sql
-- Define continuous aggregate (materialized rollup)
CREATE MATERIALIZED VIEW metrics_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  device_id,
  AVG(temperature) AS avg_temp,
  MAX(temperature) AS max_temp,
  MIN(temperature) AS min_temp,
  COUNT(*) AS reading_count
FROM metrics
GROUP BY bucket, device_id;

-- Set refresh policy (keeps aggregate fresh)
SELECT add_continuous_aggregate_policy('metrics_hourly',
  start_offset => INTERVAL '3 hours',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

-- Real-time aggregates (query combines materialized + live data)
-- By default, gaps between last refresh and now are computed on-the-fly
SELECT * FROM metrics_hourly
WHERE bucket >= NOW() - INTERVAL '24 hours'
  AND device_id = 'sensor-01'
ORDER BY bucket DESC;

-- Hierarchical continuous aggregates (aggregate of aggregate, TimescaleDB 2.9+)
CREATE MATERIALIZED VIEW metrics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', bucket) AS day_bucket,
  device_id,
  AVG(avg_temp) AS avg_temp,
  MAX(max_temp) AS max_temp
FROM metrics_hourly
GROUP BY day_bucket, device_id;
```

### 18.4 Data Retention and Downsampling

```sql
-- Automatic data retention (drop chunks older than 90 days)
SELECT add_retention_policy('metrics', INTERVAL '90 days');

-- Downsampling pattern: keep raw data 7 days, hourly 90 days, daily 1 year
-- Step 1: create aggregates at each resolution
-- Step 2: retention on raw table (7 days)
-- Step 3: retention on hourly aggregate (90 days)
-- Step 4: daily aggregate kept for 1 year

-- Tiered storage (TimescaleDB 2.11+): move old chunks to object storage (S3)
SELECT add_tiering_policy('metrics', INTERVAL '30d');
-- Old chunks stored in S3, still queryable (slower but cheap)

-- Time-series specific queries
-- time_bucket: equivalent of date_trunc but more flexible
SELECT
  time_bucket('15 minutes', time) AS bucket,
  AVG(temperature)
FROM metrics
WHERE time > NOW() - INTERVAL '1 day'
GROUP BY bucket ORDER BY bucket;

-- First/Last functions (first/last value in time order)
SELECT
  device_id,
  first(temperature, time) AS first_reading,
  last(temperature, time)  AS last_reading
FROM metrics
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY device_id;

-- Interpolation (fill gaps in time series)
SELECT time_bucket_gapfill('5 minutes', time) AS bucket,
  interpolate(avg(temperature)) AS temp
FROM metrics
WHERE time > NOW() - INTERVAL '1 hour'
GROUP BY bucket;
```

### 18.5 Performance Patterns

```sql
-- Index design for time-series
-- Always include time as second column in composite index
CREATE INDEX ON metrics (device_id, time DESC);
-- device_id filters partition → time sorts within it

-- Chunk exclusion: always filter by time to enable chunk pruning
-- Good: time-first WHERE clause
SELECT * FROM metrics WHERE time > NOW() - INTERVAL '1 hour' AND device_id = 'x';
-- Bad: no time filter → scans all chunks
SELECT * FROM metrics WHERE device_id = 'x';  -- avoid!

-- Parallel queries
SET max_parallel_workers_per_gather = 4;
-- TimescaleDB automatically parallelizes across chunks

-- Skipping chunks (ordered append)
-- If data is inserted in chronological order, TimescaleDB can skip chunks
-- for ORDER BY time DESC LIMIT N queries (only reads latest chunk)
EXPLAIN SELECT * FROM metrics ORDER BY time DESC LIMIT 10;
-- Look for: "Custom Scan (ChunkAppend)" with "ordered: true"
```

### 18.6 TimescaleDB vs InfluxDB

| Aspect | TimescaleDB | InfluxDB |
|---|---|---|
| **Base** | PostgreSQL extension | Standalone purpose-built |
| **Query** | SQL (full PostgreSQL) | InfluxQL / Flux |
| **Joins** | Full SQL joins | Limited |
| **Transactions** | Full ACID | No multi-row transactions |
| **Ecosystem** | All PostgreSQL tools | Native Grafana, Chronograf |
| **Compression** | ~90-95% | ~90% |
| **Retention** | Policy-based | Retention policies per DB |
| **Best for** | When SQL + time-series | Pure time-series, metrics |

### 18.7 Production Gotchas

⚠️ **Chunk interval too small**: 1-minute chunks for sensor data → millions of tiny chunks → high overhead per chunk (indexes, metadata). Aim for chunks that fill in ~25% of `timescaledb.max_chunks_per_insert_batch` (default: 1000 open chunks at once).

⚠️ **Out-of-order inserts**: TimescaleDB is optimized for in-order inserts (IoT data arrives late). Out-of-order writes open old chunks and defeat the append-only optimization. Use `timescaledb.insert_heap_ahead` for expected late data.

⚠️ **Continuous aggregates don't support all aggregate functions**: `DISTINCT`, `ORDER BY` within aggregates, and window functions can't be materialized. Use real-time aggregates or pre-process in application.

⚠️ **Compression + writes**: Compressed chunks are read-only. Inserting into a compressed chunk → automatic decompression (slow). Set compression policy to `older_than` with appropriate buffer (e.g., 7d when data arrives within 1d).

---

## 19. CLICKHOUSE DEEP DIVE

> ClickHouse is a columnar OLAP database from Yandex, designed for analytical queries over billions of rows. It's not a replacement for PostgreSQL — it's an analytical database optimized for read-heavy aggregations, not OLTP transactions.

### 19.1 Columnar Storage

> 🌍 **Real-World:** Cloudflare processes DNS query analytics in ClickHouse — their columnar storage means a query like "count unique source IPs by country for the last hour" reads only the `source_ip` and `country` columns from disk, skipping all other columns. On a table with 1 trillion rows and 20 columns, this reduces I/O by ~90% compared to a row-oriented database, enabling sub-second analytical queries over billions of events.

```
Row-oriented (PostgreSQL, MySQL):
  Disk layout: [id|name|age|email] [id|name|age|email] [id|name|age|email]
  Good for: SELECT * (full row retrieval), OLTP point lookups
  Bad for: SELECT AVG(age) FROM users (must read all columns to get age)

Column-oriented (ClickHouse):
  Disk layout: [id,id,id,...] [name,name,name,...] [age,age,age,...] [email,email,email,...]
  Good for: SELECT AVG(age) → reads only age column (skip id, name, email)
  Good for: compression (same-type values compress 10-100x better)
  Bad for: SELECT * with many columns, single-row updates

Query: SELECT COUNT(*), AVG(price) FROM orders WHERE status = 'completed'
  ClickHouse reads: status column + price column (only 2 of 20 columns)
  Row store: reads all 20 columns × all rows

Compression per column:
  Integers: Delta + LZ4 (differences between sequential values compress well)
  Strings: LZ4 / ZSTD dictionary
  Timestamps: Delta encoding (time differences)
  
  Typical compression: 5-10x for mixed data, up to 100x for repetitive data
```

### 19.2 MergeTree Engine Family

MergeTree is the most important ClickHouse table engine:

```sql
-- Basic MergeTree
CREATE TABLE orders (
  order_id   UInt64,
  user_id    UInt64,
  product_id UInt64,
  amount     Float64,
  status     LowCardinality(String),  -- dictionary encoding for low-cardinality
  created_at DateTime
) ENGINE = MergeTree()
ORDER BY (user_id, created_at)   -- sorting key = physical sort on disk
PARTITION BY toYYYYMM(created_at) -- one partition per month
PRIMARY KEY (user_id);            -- optional: default = ORDER BY

-- ORDER BY determines:
--   1. Physical sort order on disk (SSorted in MergeTree parts)
--   2. Sparse primary index granularity (every 8192 rows = 1 index entry)
--   3. Which queries benefit from index skipping

-- Partition pruning: WHERE created_at >= '2024-01-01' → only reads Jan+ partitions
-- Index granule skip: WHERE user_id = 123 → skip granules not containing user 123
```

**MergeTree Family:**

```sql
-- ReplacingMergeTree: deduplicate rows with same primary key (async!)
CREATE TABLE users (
  id UInt64,
  name String,
  email String,
  updated_at DateTime,
  version UInt64
) ENGINE = ReplacingMergeTree(version)  -- keep highest version on merge
ORDER BY id;

-- IMPORTANT: deduplication happens during background merges
-- Before merge: duplicates exist! Use FINAL to force dedup at query time
SELECT * FROM users FINAL WHERE id = 42;  -- forces merge, slower but correct

-- SummingMergeTree: sum numeric columns for rows with same key
CREATE TABLE daily_sales (
  date    Date,
  shop_id UInt32,
  revenue Float64,
  orders  UInt32
) ENGINE = SummingMergeTree()
ORDER BY (date, shop_id);

-- INSERT rows for same (date, shop_id) → merged by summation in background
-- Before merge: may see duplicates. Use:
SELECT date, shop_id, sum(revenue), sum(orders) FROM daily_sales GROUP BY date, shop_id;

-- AggregatingMergeTree: store intermediate aggregation states
CREATE TABLE user_stats (
  date       Date,
  user_id    UInt64,
  page_views AggregateFunction(count),         -- intermediate state
  avg_time   AggregateFunction(avg, Float64)
) ENGINE = AggregatingMergeTree()
ORDER BY (date, user_id);

-- CollapsingMergeTree / VersionedCollapsingMergeTree: update rows via sign (+1/-1)
-- Used for mutable data that changes (order status changes, etc.)

-- GraphiteMergeTree: specialized for Graphite metrics storage
```

### 19.3 Materialized Views

> 🌍 **Real-World:** Yandex (ClickHouse's creator) uses materialized views in ClickHouse for their ad click analytics — raw click events land in a `raw_clicks` MergeTree table and fan out via materialized views into `clicks_by_campaign_hourly` and `clicks_by_user_daily` SummingMergeTree tables. Dashboard queries hit the pre-aggregated views and return in <100ms even when the raw table has 50 billion rows.

```sql
-- ClickHouse materialized views: triggered on INSERT, not SELECT
-- They are incremental — process new rows as they arrive

-- Source table
CREATE TABLE raw_events (
  ts       DateTime,
  user_id  UInt64,
  event    String,
  amount   Float64
) ENGINE = MergeTree() ORDER BY ts;

-- Materialized view computes running aggregates
CREATE MATERIALIZED VIEW hourly_events
ENGINE = SummingMergeTree()
ORDER BY (hour, event)
AS
SELECT
  toStartOfHour(ts) AS hour,
  event,
  count() AS cnt,
  sum(amount) AS total_amount
FROM raw_events
GROUP BY hour, event;

-- INSERT into raw_events → new rows automatically processed by MV
-- Query hourly_events for fast aggregations (already pre-computed)

-- Common pattern: fan-out to multiple MVs
-- raw_events → hourly_events (1hr buckets)
-- raw_events → daily_events  (1d buckets)
-- raw_events → user_events   (per-user totals)
-- All updated atomically when raw data arrives
```

### 19.4 Distributed Tables and Replication

```sql
-- Replicated MergeTree (single shard, replicated)
CREATE TABLE orders ON CLUSTER my_cluster (
  order_id UInt64,
  amount   Float64,
  created_at DateTime
) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{shard}/orders', '{replica}')
ORDER BY order_id;
-- /clickhouse/tables/{shard}/orders → ZooKeeper/ClickHouse Keeper path
-- {replica} → unique replica name per server

-- Distributed table (sharded)
CREATE TABLE orders_distributed ON CLUSTER my_cluster
AS orders
ENGINE = Distributed(my_cluster, default, orders, rand());
-- rand(): random sharding (even distribution)
-- sipHash64(user_id): shard by user_id (co-locate user's rows)

-- Query distributed table → query goes to all shards → results merged
SELECT COUNT(*), AVG(amount) FROM orders_distributed;

-- Sharding key considerations:
-- rand(): even distribution, no co-locality
-- user_id hash: user rows on same shard → efficient user-level aggregations
-- date: time-based routing → hot shard problem on current day

-- ClickHouse Keeper (built-in replacement for ZooKeeper, v22.4+)
-- Handles distributed coordination, replication metadata
```

### 19.5 Query Optimization

```sql
-- EXPLAIN to see query plan
EXPLAIN SELECT user_id, COUNT() FROM orders GROUP BY user_id;

-- Use sampling for approximate results on huge tables
SELECT COUNT() * 10 FROM orders SAMPLE 1/10;  -- 10x faster, ~1% error

-- Projections (pre-sorted copies of data for alternative query patterns)
ALTER TABLE orders ADD PROJECTION by_status (
  SELECT status, COUNT(), SUM(amount)
  GROUP BY status
  ORDER BY status
);
ALTER TABLE orders MATERIALIZE PROJECTION by_status;

-- Now this query uses projection automatically (pre-computed):
SELECT status, COUNT(), SUM(amount) FROM orders GROUP BY status;

-- Dictionaries for fast joins with small lookup tables
CREATE DICTIONARY products (
  product_id UInt64,
  name String,
  category String
)
PRIMARY KEY product_id
SOURCE(CLICKHOUSE(TABLE 'product_catalog'))
LAYOUT(HASHED())
LIFETIME(MIN 0 MAX 300);  -- refresh every 5 minutes

-- JOIN without dictionary: both sides need to be in memory
-- With dictionary: O(1) lookup by key, loaded into RAM
SELECT o.order_id, dictGet('products', 'name', o.product_id) AS product_name
FROM orders o;
```

### 19.6 Production Gotchas

⚠️ **Too many partitions**: ClickHouse recommends < 1000 active partitions. If `PARTITION BY` creates too many partitions (e.g., by user_id or event_type), performance degrades. Partition only by time (day/month).

⚠️ **Small inserts = many tiny parts**: ClickHouse merges parts in background. Many tiny inserts → many small parts → merge I/O pressure → "Too many parts" error. Batch inserts: minimum 1000 rows or 1MB per INSERT. Use Buffer engine or Kafka engine for streaming ingestion.

⚠️ **JOIN is not like SQL JOINs**: ClickHouse loads the right side of JOIN into memory entirely. For large-table JOINs, use subquery or reduce right side first. `join_use_nulls = 1` for standard NULL behavior (default is 0, uses default values).

⚠️ **`FINAL` is slow**: `SELECT * FROM t FINAL` forces deduplication → reads all parts → heavy. For production queries needing dedup, use manual `GROUP BY + argMax` pattern or schedule merges.

⚠️ **Mutations (UPDATE/DELETE) are slow**: ClickHouse is append-optimized. `ALTER TABLE ... UPDATE/DELETE` rewrites entire parts. Use ReplacingMergeTree for updates, CollapsingMergeTree for deletes. Avoid OLTP patterns.

📖 **War Story — Cloudflare**: Used ClickHouse for DNS query logging (1 trillion+ rows). Discovered that inserting small batches from multiple servers simultaneously → "Too many parts in a single partition" error causing inserts to fail. Solution: implement a write buffer layer (Kafka → batch consumer → ClickHouse with 100K+ row batches).

### 19.7 ClickHouse Interview Numbers

| Metric | Value |
|---|---|
| Typical read speed | 1-10 billion rows/second |
| Index granularity | 8,192 rows per granule |
| Recommended insert batch | 1,000-100,000 rows |
| Max parts before error | ~3,000 per partition |
| Recommended active partitions | < 1,000 |
| Typical compression ratio | 5-10x (up to 100x) |
| Default merge frequency | Background, automatic |
| ZooKeeper/Keeper metadata | Per-part replication tracking |
| Max columns per table | No hard limit (practical: 1,000s) |

---

## 20. COCKROACHDB DEEP DIVE

> CockroachDB is a cloud-native distributed SQL database built for geo-distributed applications. Provides PostgreSQL-compatible SQL with horizontal scalability, strong consistency (serializable by default), and automatic failover.

### 20.1 Architecture Overview

```
CockroachDB Cluster:
  
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │   Node 1    │  │   Node 2    │  │   Node 3    │
  │  SQL Layer  │  │  SQL Layer  │  │  SQL Layer  │
  │  Dist SQL   │  │  Dist SQL   │  │  Dist SQL   │
  │  KV Layer   │  │  KV Layer   │  │  KV Layer   │
  │  ┌───────┐  │  │  ┌───────┐  │  │  ┌───────┐  │
  │  │Range 1│  │  │  │Range 2│  │  │  │Range 3│  │
  │  │Raft   │  │  │  │Raft   │  │  │  │Raft   │  │
  │  │Leader │  │  │  │Raft   │  │  │  │Range 1│  │
  │  │       │  │  │  │Leader │  │  │  │Replica│  │
  │  └───────┘  │  │  └───────┘  │  │  └───────┘  │
  └─────────────┘  └─────────────┘  └─────────────┘
  
  SQL → Distributed SQL execution across multiple nodes
  KV  → Ordered key-value store (RocksDB/Pebble underneath)
  Ranges → 512MB chunks of key space, each with a Raft group
```

### 20.2 Raft Consensus — Per Range

> 🌍 **Real-World:** Cockroach Labs' own internal SaaS infrastructure runs on CockroachDB with Raft groups distributed across 3 AWS regions. A write to the billing system is committed when 2 of 3 regional replicas acknowledge — if `us-east-1` goes down entirely, `us-west-2` and `eu-west-1` still form a quorum and the system continues accepting writes with zero manual intervention, demonstrating the automatic failover that 2PC coordinators cannot provide.

Each 512MB range is independently managed by a Raft group:

```
Raft Group (for Range X):
  3 replicas across 3 nodes (configurable replication factor)
  1 Leaseholder (serves reads without quorum, holds range lease)
  1 Raft leader (coordinates writes — often same as leaseholder)
  
Write path (simplified):
  1. Client → any node (gateway)
  2. Gateway → leaseholder of relevant range
  3. Leaseholder → proposes to Raft group
  4. Raft leader sends to followers (write to Raft log)
  5. Followers ACK (quorum = 2 of 3 nodes)
  6. Leader commits → applies to state machine (RocksDB/Pebble)
  7. ACK to client

Failure scenarios:
  1 of 3 nodes fails → cluster still functional (quorum of 2)
  Leaseholder fails → new lease granted to another replica (~seconds)
  All 3 nodes in same DC fail → split: other DCs must wait for quorum

Latency:
  Write latency = 2 × round-trip within Raft group
  For single-DC deployment (all replicas same DC): ~1-5ms
  For multi-DC deployment: latency = cross-DC RTT (e.g., 50-150ms US cross-region)
```

### 20.3 Range Splits and Rebalancing

```
Initial state: all data in one range
As data grows: automatic range splits at ~512MB (configurable)

Split decision:
  Range exceeds 512MB → split at median key
  Hot range (too many writes): split to distribute load

Range rebalancing:
  CockroachDB rebalancer moves ranges across nodes
  Goals: equal number of ranges per node, equal disk usage
  Aware of: localities, zone constraints, replica count

Show ranges:
  SHOW RANGES FROM TABLE orders;
  -- start_key | end_key | range_id | replicas | lease_holder

Manual split (avoid hot spots for bulk loads):
  ALTER TABLE orders SPLIT AT VALUES (1000000), (2000000), (3000000);
  -- Pre-split before bulk import to distribute inserts
```

### 20.4 Distributed SQL Execution

```sql
-- CockroachDB compiles SQL into a distributed execution plan
EXPLAIN (DISTSQL) SELECT region, COUNT(*), SUM(amount)
FROM orders
GROUP BY region;

-- Execution model:
-- 1. Query compiled to physical plan (TableReader, Aggregator, etc.)
-- 2. Processors distributed to nodes that hold relevant data
-- 3. Each node executes partial aggregation locally
-- 4. Gateway node receives partial results → final merge

-- DistSQL flow:
--   Node 1 (has 30% of rows): TableReader → local Aggregator → stream to gateway
--   Node 2 (has 40% of rows): TableReader → local Aggregator → stream to gateway
--   Node 3 (has 30% of rows): TableReader → local Aggregator → stream to gateway
--   Gateway: FinalAggregator → results to client

-- When DistSQL is NOT used:
--   Point lookups by primary key: goes directly to range leaseholder
--   No distribution overhead for single-range queries
```

### 20.5 MVCC in CockroachDB

CockroachDB uses MVCC at the distributed KV level:

```
Every KV value tagged with a timestamp (HLC — Hybrid Logical Clock):
  Key: /Table/orders/primary/1001
  Value at ts=100: {amount: 50.00, status: "pending"}
  Value at ts=200: {amount: 50.00, status: "completed"}

Read at timestamp T:
  → Read most recent version with ts ≤ T
  → No read-write conflicts (readers don't block writers)

Write:
  → Write to timestamp > max observed timestamp (HLC ensures this)

Transactions:
  1. Client picks a timestamp (begin_ts)
  2. Reads see snapshot at begin_ts
  3. Writes staged as "intents" (provisional values at commit_ts)
  4. On commit: intents published (atomically)
  5. On conflict: transaction restart (retry with new timestamp)

Hybrid Logical Clock (HLC):
  wall_time = max(local_wall_clock, max_observed_peer_timestamp) + counter
  Guarantees: if A happened before B, A.ts < B.ts
  Handles: clock skew across nodes (max_clock_offset = 500ms default)
  
  If node clocks diverge > max_clock_offset → node quarantined (safety valve)
```

### 20.6 Serializable Isolation (Default)

CockroachDB defaults to serializable (SSI — Serializable Snapshot Isolation), not read committed like PostgreSQL:

```sql
-- CockroachDB default: SERIALIZABLE (strongest isolation)
-- PostgreSQL default: READ COMMITTED

-- Serializable guarantees: no anomalies whatsoever
-- Cost: more transaction restarts

-- Serializable Snapshot Isolation (SSI) implementation:
-- 1. All txns run at snapshot isolation
-- 2. Tracks read/write conflicts (serialization graph)
-- 3. If cycle detected → one txn aborted → retried

-- Transaction retry in application:
-- Recommended: use savepoints for automatic retry
BEGIN;
SAVEPOINT cockroach_restart;
-- ... do work ...
RELEASE SAVEPOINT cockroach_restart;  -- try commit
-- If you get "restart transaction" error:
ROLLBACK TO SAVEPOINT cockroach_restart;  -- retry from here

-- Or use SHOW TRANSACTION STATUS to detect restart needed
-- CockroachDB drivers (pgx, pg) handle automatic retry transparently
```

### 20.7 Geo-Partitioning and Follower Reads

> 🌍 **Real-World:** A European fintech company uses CockroachDB geo-partitioning to pin EU customer records to `eu-west-1` nodes — German user data never leaves EU data centers, satisfying GDPR data residency requirements. Simultaneously, US customers' data lives in `us-east-1`. Both regions get local sub-5ms reads on their own data, while a global `config` table uses `LOCALITY GLOBAL` to replicate to all regions for instant local reads of feature flags.

```sql
-- Geo-partitioning: pin data to specific regions (GDPR, latency, etc.)
ALTER TABLE users PARTITION BY LIST (country) (
  PARTITION us VALUES IN ('US'),
  PARTITION eu VALUES IN ('DE', 'FR', 'GB', 'NL'),
  PARTITION apac VALUES IN ('JP', 'SG', 'AU')
);

-- Pin each partition to a region
ALTER PARTITION us OF TABLE users CONFIGURE ZONE USING
  constraints = '[+region=us-east-1]',
  lease_preferences = '[[+region=us-east-1]]';

ALTER PARTITION eu OF TABLE users CONFIGURE ZONE USING
  constraints = '[+region=eu-west-1]',
  lease_preferences = '[[+region=eu-west-1]]';

-- Result: EU users' data stored in eu-west-1, US users in us-east-1
-- EU reads routed to EU nodes: low latency, EU data residency compliance

-- Follower reads (read from nearest replica, potentially slightly stale)
SELECT * FROM users
AS OF SYSTEM TIME follower_read_timestamp()
WHERE user_id = 42;
-- follower_read_timestamp() = now() - 4.8 seconds
-- Reads from nearest follower, not leaseholder → lower cross-region latency

-- Global tables (replicate to all regions, no geo-isolation)
CREATE TABLE config (
  key   STRING PRIMARY KEY,
  value STRING
) LOCALITY GLOBAL;
-- Writes go to all regions synchronously (slower writes)
-- Reads from any region: local (fast, no cross-region hop)
-- For: reference data, feature flags, global config
```

### 20.8 CockroachDB vs PostgreSQL vs Spanner

| Aspect | PostgreSQL | CockroachDB | Google Spanner |
|---|---|---|---|
| **Scale** | Vertical + read replicas | Horizontal (any node) | Horizontal (managed) |
| **Default isolation** | Read Committed | Serializable | Serializable |
| **Consistency** | Strong (single node) | Strong (distributed) | Strong (TrueTime) |
| **Multi-region** | Manual sharding | Native geo-partition | Native |
| **Compatibility** | PostgreSQL | PostgreSQL wire | Custom / JDBC |
| **Latency (single-DC)** | 1-5ms | 2-10ms | 5-15ms |
| **Latency (multi-region)** | N/A | 50-200ms cross-region | 100-500ms global |
| **Use case** | OLTP, general | OLTP, geo-distributed | OLTP, Google-scale |

### 20.9 Production Gotchas

⚠️ **Multi-region write latency**: Raft requires quorum acknowledgment. For 3 replicas across 3 regions with 50ms RTT between regions, writes take ~100ms minimum. Use single-region clusters for latency-sensitive OLTP unless geo-replication is required.

⚠️ **Transaction retries are expected**: Unlike PostgreSQL, CockroachDB's serializable default causes frequent retries under contention. Application code MUST handle retry errors (`SQLSTATE 40001`). Use CockroachDB's `pgx` driver which handles this transparently.

⚠️ **Hot ranges**: A single range receiving all writes (e.g., monotonically increasing primary key) → single Raft leader becomes bottleneck. Solution: UUID primary keys or `HASH` sharding, pre-split ranges before bulk loads.

⚠️ **Clock skew must be < 500ms**: CockroachDB uses HLC and requires `max_clock_offset = 500ms`. If NTP fails and clocks drift > 500ms, nodes self-quarantine. Monitor clock offset in production.

⚠️ **DistSQL overhead for small queries**: Point lookups don't benefit from distribution. High-frequency small queries (OLTP) should use connection pooling (pgBouncer) and stay on one region. DistSQL shines for analytical queries.

📖 **War Story — Cockroach Labs internal**: Early users found that importing large datasets without pre-splitting caused all data to land in one range initially, then slow range splits would create a period of severe write hotspot. Modern solution: `IMPORT INTO` with explicit `SPLIT AT` or using `DEFAULT gen_random_uuid()` primary keys.

### 20.10 CockroachDB Interview Numbers

| Metric | Value |
|---|---|
| Default range size | 512 MB |
| Replication factor (default) | 3 |
| Quorum required | N/2 + 1 |
| Max clock offset | 500 ms |
| Follower read staleness | ~4.8 seconds |
| Single-DC write latency | 2-10 ms |
| Multi-region write latency | 50-500 ms (cross-DC RTT × 2) |
| Default isolation level | Serializable |
| Storage engine | Pebble (RocksDB fork) |
| Max cluster size (tested) | 600+ nodes |

---

## 21. DATABASE SELECTION GUIDE

> When do you use which database? This is the most common system design interview question.

```
Decision tree:

Need full ACID + complex queries?
  → PostgreSQL (general purpose) or MySQL (existing ecosystem)
  
Need geo-distributed ACID with automatic failover?
  → CockroachDB or Google Spanner
  
Need ultra-high write throughput (IoT, events, time-series)?
  Append-only, eventual consistency OK?
    → Apache Cassandra (wide-column, partition-key queries)
  Need SQL + time-series functions?
    → TimescaleDB (PostgreSQL + time-series extension)
  Need analytics on time-series (Grafana metrics)?
    → InfluxDB or TimescaleDB
    
Need sub-millisecond cache / session store?
  → Redis (in-memory, rich data structures)
  
Need full-text search / log analytics?
  → Elasticsearch (inverted index, aggregations)
  
Need OLAP / analytical queries on billions of rows?
  → ClickHouse (columnar, 1B+ rows/sec)
  → BigQuery / Redshift (managed cloud OLAP)
  
Need document model (flexible schema)?
  → MongoDB (WiredTiger, ACID transactions, rich indexes)
  
Need fully managed + infinite scale + pay-per-request?
  → DynamoDB (AWS, key-value + document, AP consistency)

Real-world combinations (polyglot persistence):
  E-commerce: PostgreSQL (orders/users) + Redis (cart/sessions) + Elasticsearch (search)
  Analytics: Kafka (events) → ClickHouse (OLAP) + PostgreSQL (application DB)
  IoT: Cassandra or TimescaleDB (time-series) + Redis (real-time state) + PostgreSQL (config)
  Social: Cassandra (timeline/activity) + PostgreSQL (user accounts) + Elasticsearch (search)
```

### Interview Cheatsheet — All Databases

| Database | Type | Consistency | Scale direction | Best for |
|---|---|---|---|---|
| PostgreSQL | Relational | Strong (ACID) | Vertical + read replicas | General OLTP, complex queries |
| MySQL/InnoDB | Relational | Strong (ACID) | Vertical + replicas | Web apps, existing MySQL ecosystem |
| CockroachDB | Distributed SQL | Serializable | Horizontal | Geo-distributed OLTP |
| MongoDB | Document | Tunable (MVCC) | Horizontal sharding | Flexible schema, nested documents |
| Cassandra | Wide-column | Tunable (CAP: AP) | Horizontal (linear) | Write-heavy, time-series, multi-DC |
| Redis | In-memory KV | None (unless Sentinel) | Vertical (Cluster optional) | Cache, sessions, pub-sub, rate-limit |
| Elasticsearch | Search/Analytics | Eventually consistent | Horizontal | Full-text search, log analytics |
| TimescaleDB | Time-series SQL | Strong (PostgreSQL) | Vertical + extensions | IoT metrics, monitoring, SQL+time |
| ClickHouse | Columnar OLAP | Eventual (per shard) | Horizontal | Analytics, billions of rows, BI |
| DynamoDB | KV + Document | Eventual / Strong option | Infinite (managed) | Serverless apps, Amazon ecosystem |


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Databases)

| # | Concept | Interview use | Done |
|---|---------|---------------|------|
| 1 | B+ Tree vs Hash index | "Why is this query slow?" | [ ] |
| 2 | Covering / composite index left-prefix | Query design | [ ] |
| 3 | MVCC + xmin/xmax | Readers don't block writers | [ ] |
| 4 | WAL purpose | Durability + replication | [ ] |
| 5 | Isolation levels + anomalies | Choose right level | [ ] |
| 6 | Deadlocks & lock ordering | Debugging | [ ] |
| 7 | Read replicas + lag | Scale reads safely | [ ] |
| 8 | Sharding strategies | Scale writes | [ ] |
| 9 | LSM vs B-Tree tradeoffs | Cassandra/Rocks vs Postgres | [ ] |
| 10 | Outbox / CDC for events | Microservice consistency | [ ] |
| 11 | Connection pooling | App ↔ DB bottleneck | [ ] |
| 12 | When SQL vs NoSQL | HLD storage choice | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Indexes and isolation levels are the highest-ROI DB topics in senior interviews — be ready to reason with EXPLAIN and anomalies.

---

## 🛠️ PRACTICAL — Database Labs

### Lab 1: Index Design
Given query:
```sql
SELECT * FROM orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 20;
```
Design the best composite index. Justify column order. What does `SELECT *` cost you?

### Lab 2: Isolation Anomalies
On paper, construct a dirty read / non-repeatable read / phantom for two concurrent transactions. Name the minimum isolation that prevents each.

### Lab 3: Replication Lag Scenario
User updates profile, immediately reads from replica, sees old data. List 3 fixes and when you'd pick each.

### Lab 4: Pick-the-DB Drill (10 systems)
For each: URL shortener, chat messages, financial ledger, analytics events, session store — pick DB + one sentence why.
