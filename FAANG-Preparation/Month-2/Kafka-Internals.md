# Kafka Internals — Complete Study Notes

> Self-contained. No internet needed. FAANG-level depth.
> Real-world examples: LinkedIn (creator), Uber, Netflix, Stripe, DoorDash

---

## Table of Contents

| # | Topic | Key Concepts |
|---|-------|--------------|
| [1](#1-what-kafka-is-and-why-it-exists) | What Kafka Is | Log vs queue, why LinkedIn built it |
| [2](#2-core-abstractions) | Core Abstractions | Topic, partition, offset, segment |
| [3](#3-producer-internals) | Producer Internals | RecordAccumulator, batching, acks, idempotence |
| [4](#4-consumer-internals) | Consumer Internals | Poll loop, fetch config, offset management |
| [5](#5-consumer-group-and-rebalance) | Consumer Group & Rebalance | CooperativeStickyAssignor, static membership |
| [6](#6-broker-and-log-storage-internals) | Broker & Log Storage | Sequential I/O, page cache, zero-copy, compaction |
| [7](#7-replication-and-leader-election) | Replication & Leader Election | ISR, HWM, KRaft (no more ZooKeeper) |
| [8](#8-exactly-once-semantics-eos) | Exactly-Once Semantics | Idempotent producer, transactions, zombie fencing |
| [9](#9-kafka-streams-and-ksql) | Kafka Streams & KSQL | Stateful processing, windowing, joins |
| [10](#10-operations-and-production-gotchas) | Operations & Gotchas | Lag monitoring, poison pills, Schema Registry |
| [11](#11-senior-level-depth) | Senior Depth: Tradeoffs | When NOT to use Kafka, performance decisions |
| [12](#real-world-kafka-usage-how-companies-actually-use-it) | **Real-World Usage** | **LinkedIn, Uber, Netflix, Stripe, DoorDash** |

---

## 1. What Kafka Is and Why It Exists

### What It Is

Kafka is a distributed, partitioned, replicated, fault-tolerant **commit log**. The key word is **log** — not a message queue, not a pub-sub broker in the traditional sense. A **log** is an append-only, ordered sequence of records. Kafka is a system for storing and distributing logs at massive scale.

### Why It Was Built

LinkedIn built Kafka in 2010 to solve a specific problem: they had many systems (activity tracking, metrics, data pipelines) all needing to send data between each other. The traditional approach was point-to-point integrations — each producer knew about each consumer. With N producers and M consumers you need N×M integrations. Kafka decouples them: producers write to Kafka, consumers read from Kafka. N+M integrations.

But more importantly, they needed **retention and replay**. Traditional message queues (RabbitMQ, ActiveMQ) delete messages after delivery. If a new consumer is added, it misses historical data. Kafka retains messages for a configurable duration (default 7 days). Any consumer can go back in time and replay.

> 🌍 **Real-World:** LinkedIn (Kafka's birthplace) uses it to stream 7 trillion messages/day — activity events (page views, clicks, searches, connection requests) flow from web servers to analytics, feed ranking, and recommendation pipelines. The retention+replay design was critical: when LinkedIn launched a new recommendations model, engineers replayed 30 days of activity events through the new model without waiting for new data to accumulate.

### Why Kafka Instead of RabbitMQ or SQS

| Feature | Kafka | RabbitMQ | Amazon SQS |
|---------|-------|----------|------------|
| **Message Retention** | Configurable (default 7 days); messages kept after consumption | Deleted after ACK | Deleted after ACK; max 14-day retention |
| **Replay** | Consumer can reset offset to any retained point | Not supported | Not supported |
| **Throughput** | Millions of msgs/sec via batching + zero-copy | Lower per-message throughput | Managed; scales but lower raw throughput |
| **Ordering** | Per-partition ordering guaranteed | Per-queue ordering (with caveats) | Best-effort; FIFO queues available |
| **Consumer Model** | Pull-based; consumer controls pace | Push-based; broker pushes to consumer | Pull-based (long polling) |
| **Parallelism** | Partition-based; up to N consumers for N partitions | Competing consumers on a queue | Multiple consumers; no partition concept |
| **Routing** | Topic + partition key | Rich routing: exchanges, topic/fanout/direct | Simple queue; no routing |
| **Operations** | More complex to operate | Moderate complexity | Fully managed, zero ops |
| **Best For** | High-throughput streaming, event sourcing, replay | Complex routing, RPC-style, per-message TTL | Simple decoupling, serverless, AWS-native |

> **💡 Key Insight:** Pick RabbitMQ for complex routing (topic/fanout/direct exchanges), per-message TTL, priority queues, request-reply patterns, or smaller scale with simpler ops. Pick SQS when you want zero operational burden and are already in the AWS ecosystem. Pick Kafka when you need replay, high throughput, or durable event streaming.

> 🌍 **Real-World:** Zalando (European fashion platform) runs both Kafka and RabbitMQ. Kafka handles their order event stream (high volume, needs replay for analytics and new service onboarding), while RabbitMQ handles their email/notification workflows (complex routing rules per notification type, lower volume, per-message TTL). Using the right tool for each job reduced their messaging infrastructure cost by 30% compared to forcing everything through one system.

### Simple Mental Model

Think of Kafka as a distributed array of numbered slots, append-only. Producers write to the end. Each consumer has a bookmark (**offset**) and reads from that bookmark forward. The bookmarks are independent — 10 different consumers can be at 10 different positions in the same log simultaneously. The log is split into **partitions** for parallelism and replicated across brokers for fault tolerance.

```text
Partition 0:  [msg0] [msg1] [msg2] [msg3] [msg4] ...  ← Producer appends here
               ^                    ^
               Consumer A           Consumer B
               (offset=0)           (offset=3)
```

---

## 2. Core Abstractions

### Topic

A named category/feed of messages. Like a table in a database but append-only. Topics are logical; the physical storage is **partitions**.

> 🌍 **Real-World:** Uber has hundreds of Kafka topics organized by domain: `driver-location-updates`, `trip-events`, `payment-events`, `surge-pricing-calculations`. Each topic represents a logical stream of events from one domain. This separation means the payments team can consume `payment-events` independently of the maps team consuming `driver-location-updates` — teams own their topics and evolve them independently, just like microservice API contracts.

### Partition

> ⭐ **IMPORTANT CONCEPT:** A Kafka partition is the unit of ordering and parallelism — keys that must stay ordered must share a partition.
A topic is split into N ordered, immutable, append-only logs. Each **partition** lives on one broker (the leader) and is replicated to others (followers). Partitions are the unit of parallelism — if you have 12 partitions, you can have up to 12 consumers in a group processing in parallel. Partition count cannot be reduced (only increased), and increasing it can break key-based ordering for existing keys.

> 🌍 **Real-World:** Netflix's `playback-events` topic has 600 partitions. This allows 600 concurrent consumer threads across their stream processing fleet to process playback events in parallel. When Netflix expands their processing capacity, they add more consumer instances — each gets assigned a subset of the 600 partitions. The 600-partition design was chosen based on their target throughput: if each partition handles ~10MB/s and they need 6GB/s peak capacity, 600 partitions provides headroom.

### Offset

A monotonically increasing 64-bit integer assigned to each message within a partition. **Offset** 0 is the first message, offset 1 the second, etc. Offsets are local to a partition — offset 5 in partition 0 is a completely different message than offset 5 in partition 1. Consumers track their position by committing offsets.

> 🌍 **Real-World:** Spotify uses Kafka offsets as the mechanism for their "exactly-once" music play count system. Each play event gets a unique offset in the `play-events` topic. Their counting service commits offsets only after successfully incrementing the play count in their database. If the service crashes and restarts, it re-reads from the last committed offset — potentially re-processing a few events, but since play count increments are idempotent (they check the event ID before incrementing), the final count is always accurate.

### Producer

A client that writes records to topics. The producer chooses which partition to write to (via **partitioner**). The producer batches records for efficiency.

### Consumer

A client that reads records from topics. Consumers pull from brokers — Kafka does not push. The consumer tracks which offsets it has processed by committing them to the `__consumer_offsets` internal topic.

### Consumer Group

A set of consumers that share the work of consuming a topic. Each partition is assigned to exactly one consumer in the group at a time. If you have 12 partitions and 3 consumers in a group, each consumer gets 4 partitions. If a consumer crashes, its partitions are redistributed to remaining consumers (**rebalance**). Multiple consumer groups can consume the same topic independently — each group maintains its own offsets.

> 🌍 **Real-World:** Stripe has four independent consumer groups reading their `payment-events` topic: `fraud-detection`, `revenue-reporting`, `webhook-delivery`, and `ledger-updates`. Each group processes every payment event for its own purpose, completely independently. When the fraud team deployed a new ML model (new consumer logic), they created a fresh consumer group with `auto.offset.reset=earliest` to replay 30 days of historical events through the new model before going live — without affecting the other three consumer groups still processing normally.

### Broker

A Kafka server. Each **broker** stores a subset of partitions. One broker is the **controller** (manages metadata, leader elections). Each partition has one broker acting as leader (handles all reads/writes) and others as followers (replicate from leader).

### Cluster

Multiple brokers coordinated together. In ZooKeeper mode, ZooKeeper holds cluster metadata and coordinates leader election. In **KRaft mode** (Kafka 3.3+), Kafka itself handles this via Raft consensus.

---

## 3. Producer Internals

### Producer Flow (Step by Step)

1. Application calls `producer.send(ProducerRecord)`
2. **Serializer**: key and value are serialized to bytes using configured serializers (`StringSerializer`, `AvroSerializer`, etc.)
3. **Partitioner**: determines which partition to send to
   - If partition is specified explicitly → use it
   - If key is non-null → `murmur2(key) % numPartitions` (consistent mapping: same key always same partition)
   - If key is null → round-robin across partitions (sticky partitioner since Kafka 2.4: stick to one partition until batch is full or `linger.ms` expires, reduces small batches)
4. **RecordAccumulator**: record is appended to an in-memory buffer (a `Deque<ProducerBatch>` per partition). This is where batching happens.
5. **Sender thread** (background thread): drains batches from `RecordAccumulator` and sends to brokers. It groups batches by broker (not partition) to send one network request per broker with multiple partition batches.
6. **NetworkClient**: handles the actual TCP send/receive with brokers
7. **Callback**: on broker ACK or error, the callback registered with `send()` fires on the Sender thread

> 🌍 **Real-World:** Confluent's benchmarks show that the key-based partitioning (`murmur2(key) % numPartitions`) is what enables per-entity ordering. Lyft partitions their `ride-events` topic by `ride_id` — all events for a single ride (requested, driver_assigned, started, completed, rated) always land on the same partition in order. Their downstream ride state machine consumer can process a ride's complete lifecycle in sequence without coordinating across partitions.

### Batching Configuration

Batching is crucial for throughput. Two parameters control it:

- `batch.size` (default 16KB): max bytes per batch per partition. When batch fills → send immediately
- `linger.ms` (default 0): how long to wait for more records before sending a batch even if not full. Default 0 = send immediately (no batching benefit). In production, set to 5-100ms to improve throughput at slight cost of latency.
- Interaction: if `linger.ms=0` and `batch.size=16KB`, most batches will be tiny because you send as soon as you get a record. Set `linger.ms=20` and the sender waits 20ms accumulating records into bigger batches.

> 🌍 **Real-World:** Robinhood's trade event producers use `linger.ms=10` and `batch.size=65536` (64KB). During market open (9:30 AM ET), trade events burst to 500K/sec. With `linger.ms=10`, events accumulate into ~200 record batches that compress 10× with LZ4 — their broker receives 50KB compressed batches instead of 500 individual 1KB messages per 10ms window. This reduced their Kafka broker CPU by 40% vs. the default `linger.ms=0` configuration.

### Compression

Configured per producer. Compresses the entire batch (not individual records), so larger batches = better compression ratio.

| Codec | Speed | Ratio | Recommendation |
|-------|-------|-------|----------------|
| `lz4` | Fast | Moderate | Default for most cases |
| `snappy` | Fast | Decent | Good general-purpose choice |
| `gzip` | Slower | Best ratio | Very text-heavy messages |
| `zstd` (Kafka 2.1+) | Good | Best | Recommended when compression is priority |

Compression happens on the producer side, brokers store compressed, consumers decompress. Brokers can also be configured to recompress (broker compression setting overrides producer), which costs CPU on the broker.

> 🌍 **Real-World:** Uber switched from Snappy to zstd compression for their `driver-location-updates` topic (100M+ messages/day of GPS coordinates). The zstd codec achieved 4.2× compression ratio vs. Snappy's 2.8× on their JSON location payloads — reducing broker disk usage by 33% and inter-broker replication bandwidth by the same amount. The slightly higher CPU cost on producers (zstd is slower to compress) was acceptable given the massive storage and bandwidth savings across their 1,400-node Kafka cluster.

### acks Configuration — Critical

Controls when the producer considers a send successful:

| Setting | Behavior | Data Loss Risk | Use Case |
|---------|----------|----------------|----------|
| `acks=0` | Fire and forget; no response from broker | Guaranteed loss on any broker issue | Metrics/logs where loss is acceptable |
| `acks=1` | Leader ACKs write to its own log; doesn't wait for followers | Leader crashes before replication = data loss | Legacy default; generally avoid |
| `acks=all` (`acks=-1`) | Leader waits for ALL ISR replicas to ACK | No loss as long as `min.insync.replicas` is met | Default since Kafka 3.0; use this |

> **⚠️ Production Gotcha:** With `acks=1`, if the leader writes and ACKs to the producer but crashes before followers catch up, the newly elected leader won't have that message. People assume `acks=1` is safe because the broker ACK'd — it is not. Always use `acks=all` with `min.insync.replicas=2` in production.

**`acks=all` works with `min.insync.replicas` broker/topic config:**

- If `min.insync.replicas=2` and you have 3 replicas: at least 2 (leader + 1 follower) must ACK. One follower can be down and you still write successfully.
- If only 1 ISR is available and `min.insync.replicas=2`: producer gets `NotEnoughReplicasException`. This is the right failure mode — fail rather than write data that could be lost.

> 🌍 **Real-World:** PayPal experienced a data loss incident in 2018 where payment events were acknowledged to producers with `acks=1` but the leader broker crashed before the follower replicated the last batch. Approximately 2,000 payment event messages were lost — transactions that showed as "pending" in the UI but had no corresponding event in Kafka. The fix: `acks=all` + `min.insync.replicas=2`. The slight added latency (waiting for a follower ACK adds ~2ms) was trivially acceptable for payment processing.

### Idempotent Producer (`enable.idempotence=true`)

**Problem without idempotence:** producer sends batch, broker writes it, sends ACK, ACK is lost in network. Producer retries. Broker writes the same batch again → duplicate.

**Solution:** each producer is assigned a **Producer ID (PID)** by the broker. Each message gets a **sequence number** per partition. If broker receives a message with a sequence number it already committed → reject silently (deduplicate). If sequence number is too high (gap) → error.

> **💡 Key Insight:** The PID changes on producer restart — deduplication only applies within a single producer session, not across restarts. The **transactional API** solves cross-restart deduplication.

Key properties:
- Guarantees exactly-once delivery within a single producer session (per partition)
- PID changes on producer restart → deduplication only within a session, not across restarts (transactional API solves this)
- Required when using transactions
- Automatically sets `acks=all`, `retries=MAX_INT`, `max.in.flight.requests.per.connection=5`

> 🌍 **Real-World:** Confluent Cloud enables `enable.idempotence=true` by default for all producers in their managed Kafka service. For customers like Citibank processing trade confirmations, the idempotent producer eliminates duplicate trade events caused by network retries during broker leader elections. Before idempotence was enabled, Citibank's downstream trade reconciliation system would occasionally see the same trade event twice during Kafka rolling restarts, requiring expensive manual reconciliation. Post-idempotence: zero duplicate trade events in 18 months of production operation.

### max.in.flight.requests.per.connection and Ordering

This controls how many unacknowledged request batches can be in flight to one broker simultaneously.

- Default: 5
- If set to >1 and retries are enabled **without** idempotence: batch 1 fails, retried, but batch 2 already sent and succeeded → batch 2 is now before batch 1 in the log → **ordering violation**
- With `enable.idempotence=true`: broker uses sequence numbers to detect gaps and reorder. Safe to use up to 5 in-flight with ordering guarantee.
- For strict ordering without idempotence: set to 1. Big performance hit.
- Production recommendation: always use idempotent producer, keep `max.in.flight=5` (default with idempotence).

### Delivery Timeout and Retries

- `retries` (default `MAX_INT` with idempotence): number of retries per batch
- `retry.backoff.ms` (default 100ms): wait between retries
- `delivery.timeout.ms` (default 120000ms = 2 minutes): total time from `send()` call to final success or failure. Retries happen within this window. When it expires, the send fails with a `TimeoutException`. This is the real bound, not `retries` alone.

> 🌍 **Real-World:** DoorDash's order routing producers set `delivery.timeout.ms=30000` (30 seconds) instead of the default 2 minutes. For their real-time order dispatch pipeline, a message that takes more than 30 seconds to produce is stale by the time it arrives — the driver has already been assigned or the window has closed. Failing fast with a 30-second timeout and surfacing the error to the application (which falls back to a synchronous HTTP call) gives better user experience than silently retrying for 2 minutes and eventually producing a stale message.

---

## 4. Consumer Internals

### Poll Loop

The fundamental consumer pattern is a poll loop:

```java
consumer.subscribe(Arrays.asList("my-topic"));
while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    for (ConsumerRecord<String, String> record : records) {
        processRecord(record);
    }
    consumer.commitSync(); // or commitAsync
}
```

`poll()` does several things:
1. Sends heartbeats to the group coordinator broker (required to stay in the consumer group)
2. Fetches records from assigned partitions
3. Triggers rebalance callbacks if a rebalance was initiated
4. Returns a batch of records up to `max.poll.records` (default 500)

> **⚠️ Production Gotcha:** `poll()` must be called regularly. If more than `max.poll.interval.ms` (default 5 minutes) passes between polls, the broker assumes the consumer is dead and triggers a rebalance to redistribute its partitions. This is the most common cause of unexpected rebalances in production — slow message processing.

> 🌍 **Real-World:** Airbnb's search indexing consumers failed `max.poll.interval.ms` frequently when processing large property listings with many photos — the photo download and embedding generation took 8+ minutes per batch. Their fix: reduce `max.poll.records` from 500 to 1 (process one listing at a time), increase `max.poll.interval.ms` to 10 minutes, and move the slow processing to a separate thread while the poll loop runs on a dedicated thread. The separate threading approach is the canonical pattern for slow consumers in Kafka.

### Fetch Configuration

- `fetch.min.bytes` (default 1 byte): minimum data to return from a fetch request. If the broker has less data, it waits. Higher value = fewer, larger fetches = better throughput, higher latency.
- `fetch.max.wait.ms` (default 500ms): max time broker will wait for `fetch.min.bytes` to be met before responding anyway.
- `fetch.max.bytes` (default 50MB): max data returned per fetch request across all partitions.
- `max.partition.fetch.bytes` (default 1MB): max data returned per partition per fetch. If a single message is larger than this, it is still fetched (just that one message).

> 🌍 **Real-World:** Confluent's recommendation for high-throughput analytics consumers (like those feeding into Spark or Flink) is `fetch.min.bytes=1048576` (1MB) and `fetch.max.wait.ms=1000` (1 second). Netflix's batch analytics consumers use this pattern — instead of making hundreds of tiny fetch requests per second (wasting network overhead), each fetch retrieves 1MB+ of data, reducing the number of network round trips by 100× and significantly improving the throughput of their Hadoop/Spark ingestion pipelines.

### Offset Management

**Offsets** are stored in `__consumer_offsets` — a special Kafka topic with 50 partitions by default, log-compacted, replicated. This replaced ZooKeeper offset storage in Kafka 0.9. The **group coordinator broker** is whichever broker owns the partition of `__consumer_offsets` corresponding to your consumer group ID (determined by `hash(group.id) % 50`).

**Auto-commit** (`enable.auto.commit=true`, `auto.commit.interval.ms=5000` by default):
- Kafka commits the offset of the last record returned by `poll()` every 5 seconds
- Risk: consumer gets records, starts processing, auto-commit fires (offsets committed), then consumer crashes before finishing processing → those records are lost (at-most-once semantics)
- Most production code should disable auto-commit and commit manually

**`commitSync()`**: blocks until offset is committed to `__consumer_offsets`. Safe — if it returns without exception, the offset is committed. Retry on retriable errors. Slower because it blocks.

**`commitAsync()`**: non-blocking. Takes a callback for success/failure. Problem: if commit for offset 100 fails and you don't retry (because offset 200 is already being committed, and committing 200 implicitly commits everything up to 200), you might skip the failure. Usually you use async during the loop for throughput and do a final sync commit before shutdown.

> 🌍 **Real-World:** Square's payment processing consumers disable auto-commit entirely (`enable.auto.commit=false`) and use `commitSync()` after each successful database write. Their processing logic: fetch batch → write to database with idempotency key → commitSync offset. If the DB write fails, the offset is never committed — the event is reprocessed on restart. If the service crashes after the DB write but before commitSync, the event is reprocessed but the idempotent DB write is a no-op. This at-least-once + idempotent sink pattern is the gold standard for payment event processing.

### Delivery Semantics

| Semantic | Approach | Crash Behavior | Code Pattern |
|----------|----------|----------------|--------------|
| **At-most-once** | Commit before processing | Records lost if crash during processing | Commit → Process |
| **At-least-once** | Commit after processing | Records reprocessed if crash before commit | Process → Commit |
| **Exactly-once** | Idempotent consumer OR Kafka transactions | No duplicates, no loss | Idempotent sink OR transactional API |

**At-most-once (commit before processing):**

```java
records = consumer.poll(Duration.ofMillis(100));
consumer.commitSync(); // commit first
processRecords(records); // then process — if crash here, records are lost
```

Offsets committed before processing. If crash during processing, those records won't be reprocessed. Records processed zero or one times.

**At-least-once (commit after processing):**

```java
records = consumer.poll(Duration.ofMillis(100));
processRecords(records); // process first
consumer.commitSync(); // commit after — if crash before here, records reprocessed
```

Offsets committed after processing. If crash during processing, records are reprocessed. Records processed one or more times. The standard approach — your processing must be idempotent to handle duplicates.

**Exactly-once:** Two approaches:
1. **Idempotent consumer**: at-least-once delivery + idempotent processing (check if already processed using a dedup key before writing side effects)
2. **Kafka Transactions**: atomically write output to Kafka and commit offset together (only works when sink is also Kafka)

> 🌍 **Real-World:** Braintree (PayPal's payment gateway) uses at-least-once delivery with idempotent database writes for their Kafka-based payment event processing. Each payment event carries a `payment_id` that is used as a database unique constraint. The consumer processes → writes `INSERT INTO payments ... ON CONFLICT (payment_id) DO NOTHING` → commits offset. On duplicate delivery, the INSERT is a no-op but the offset is still committed. This pattern has processed billions of payments over 5+ years with zero duplicate charges traceable to Kafka redelivery.

### Consumer Position

`auto.offset.reset` (default `latest`): what to do when a consumer group has no committed offset for a partition (new group, or offset expired):

| Value | Behavior |
|-------|----------|
| `latest` | Start reading from the end — misses historical messages |
| `earliest` | Start reading from the beginning — processes all retained messages |
| `none` | Throw exception if no committed offset exists |

> **⚠️ Production Gotcha:** A new consumer group with `latest` will miss all messages that arrived before it started. Use `earliest` for initial load or backfill.

> 🌍 **Real-World:** Shopify burned their engineers multiple times with `auto.offset.reset=latest` when deploying new consumer services. A new fraud detection consumer started processing only events AFTER its deployment, missing all fraud events from the previous 7 days. They now mandate `auto.offset.reset=earliest` for all new consumer group deployments — new services must explicitly choose to skip historical data by seeking to a specific offset, rather than silently missing it by default.

---

## 5. Consumer Group and Rebalance

> ⭐ **IMPORTANT CONCEPT:** Consumer groups enable parallel consume; rebalances pause work — know session.timeout vs max.poll.interval failure modes.
### What Is a Consumer Group

A **consumer group** is a logical subscriber. All consumers in a group cooperate to consume a topic, each consumer owning a subset of partitions. From the topic's perspective, the whole group is one consumer that reads every message. You can have multiple groups, each seeing all messages independently.

Rule: at most one consumer per partition in a group. So max parallelism = number of partitions. If you add more consumers than partitions, the extra consumers sit idle. This is why partition count is important to set correctly upfront — it's hard to increase later without disrupting key ordering.

> 🌍 **Real-World:** Wix (website builder platform) uses consumer groups to fan out their `user-activity-events` topic to multiple downstream services. The `analytics` consumer group (12 consumers, 12 partitions) processes events for dashboards; the `ab-testing` consumer group (6 consumers) processes the same events for experiment tracking; the `personalization` consumer group (24 consumers) processes for ML feature pipelines. All three groups process every event independently — adding the personalization pipeline required zero changes to producers or other consumer groups.

### Why Rebalances Happen

1. Consumer joins the group (`consumer.subscribe()` is called)
2. Consumer leaves the group (clean `consumer.close()`)
3. Consumer crashes or times out (no poll within `max.poll.interval.ms`, or no heartbeat within `session.timeout.ms`)
4. Subscription change (consumer subscribes to a different set of topics)
5. Partition count of a subscribed topic changes
6. Topic matching a regex subscription is created/deleted

### The Rebalance Process (Classic Rebalance — Stop the World)

1. Group coordinator (a broker) detects a change in group membership
2. Sends `JoinGroup` response to all consumers telling them a rebalance is starting
3. **All consumers pause processing** and stop consuming
4. All consumers send `JoinGroup` request to coordinator with their topic subscriptions
5. The coordinator elects one consumer as the **group leader** (first to join, typically)
6. The group leader receives the full list of all members and their subscriptions
7. The group leader runs the **partition assignment strategy** and computes the assignment
8. Group leader sends assignment back to coordinator in a `SyncGroup` request
9. All other consumers also send `SyncGroup` requests (with empty assignments)
10. Coordinator sends each consumer its partition assignment
11. Consumers resume processing with their new assignments

The stop-the-world period (steps 2–10) means zero throughput for the consumer group. In a large group with slow network, this can take tens of seconds.

> 🌍 **Real-World:** Segment (customer data platform) had a consumer group with 200 consumers and 1200 partitions. Their classic rebalance took 45–90 seconds because all 200 consumers had to complete the JoinGroup/SyncGroup handshake. During this window, all data pipelines for all their customers were paused. A single rolling deploy of the consumer fleet (200 restarts, each triggering a rebalance) could cause 90+ minutes of total pipeline pause. Switching to CooperativeStickyAssignor reduced per-restart rebalance impact to ~3 seconds, making rolling deploys non-events.

### Partition Assignment Strategies

| Strategy | Behavior | Problem | When to Use |
|----------|----------|---------|-------------|
| **RangeAssignor** (default) | Per-topic: sort partitions numerically, sort consumers alphabetically, divide in contiguous ranges | Consumer A may get partition 0 of every topic — unbalanced for multi-topic subscriptions | Single-topic subscriptions |
| **RoundRobinAssignor** | Sort all partitions across all topics + consumers, assign in round-robin | Still uneven if consumers subscribe to different topic subsets | Multi-topic with uniform subscriptions |
| **StickyAssignor** | Maximize partition stickiness on rebalance while staying balanced | Still a stop-the-world rebalance even for unaffected consumers | When minimizing reassignment matters |
| **CooperativeStickyAssignor** | Incremental cooperative rebalance: only partitions that must move are revoked | Requires two rebalance phases | **Production default — use this** |

> **💡 Key Insight:** The **`CooperativeStickyAssignor`** is a fundamental architectural improvement. Only partitions that actually need to move are revoked; the vast majority of consumers never stop processing. Enable it with `partition.assignment.strategy=CooperativeStickyAssignor` in consumer config.

> 🌍 **Real-World:** Confluent Cloud switched their internal Kafka consumer fleet to CooperativeStickyAssignor as part of their KIP-429 work. They measured the impact on a 100-consumer, 600-partition group doing a rolling restart of 10 nodes: with EagerRebalance (stop-the-world), total processing pause was 480 seconds (10 restarts × 48s per rebalance). With CooperativeStickyAssignor, total pause was under 30 seconds — a 16× improvement. For latency-sensitive pipelines, this is the difference between "invisible maintenance" and "user-visible degradation".

### Static Group Membership (`group.instance.id`)

**Problem:** consumer restarts (e.g., rolling deploy) cause unnecessary rebalances. Consumer leaves, rebalance happens, consumer comes back, another rebalance happens. During both rebalances, all consumers pause.

**Solution:** assign a unique `group.instance.id` to each consumer instance. Now when that instance reconnects within `session.timeout.ms`, it gets its old partitions back without triggering a rebalance. Other consumers are not affected.

Use case: any stateful consumers (Kafka Streams tasks, consumers with local cache), rolling deployments.
- `session.timeout.ms` (default 45000ms): how long the broker waits for the instance to rejoin before treating it as dead and triggering rebalance. Must be larger than your typical restart time.
- Trade-off: if the instance truly died (not just restarting), partitions won't be reassigned until the full session timeout expires. Set this thoughtfully.

> 🌍 **Real-World:** Kafka Streams (used by LinkedIn for their member activity aggregation pipeline) automatically uses static group membership when you set `processing.guarantee=exactly_once`. Because Kafka Streams maintains local RocksDB state stores keyed by partition, a restart that triggers a rebalance and reassigns partitions would force expensive state store rebuilds from changelog topics. With static membership, restarted instances reclaim their original partitions and warm up from local state — restart time drops from 10+ minutes (full state rebuild) to ~30 seconds (local RocksDB recovery).

### Heartbeat Thread

Separate from the poll thread. Sends heartbeats to the group coordinator on `heartbeat.interval.ms` (default 3000ms, should be 1/3 of `session.timeout.ms`). If the group coordinator doesn't receive a heartbeat within `session.timeout.ms`, it marks the consumer as dead and triggers rebalance.

| Timeout | Trigger | Root Cause |
|---------|---------|------------|
| `session.timeout.ms` | No heartbeat received | Consumer process died or network partition |
| `max.poll.interval.ms` | `poll()` not called | Consumer process alive but stuck in processing |

> **💡 Key Insight:** The heartbeat thread can be alive (consumer process is running) but `poll()` is not being called (consumer is stuck processing one batch). In that case, `max.poll.interval.ms` triggers the rebalance, not `session.timeout.ms`. These are two independent liveness signals.

> 🌍 **Real-World:** Pinterest's Kafka consumers hit `max.poll.interval.ms` violations every time their recommendation model inference took longer than expected — the model was called synchronously during message processing, and occasional slow inference (P99 = 8 seconds) would exceed their 5-minute poll interval after processing large batches. Their solution: move inference to an async executor with a bounded queue, making `processRecord()` non-blocking and ensuring `poll()` is called every 50ms regardless of inference time. This eliminated spurious rebalances that had been causing ~2% throughput degradation daily.

---

## 6. Broker and Log Storage Internals

### Log Segments

A Kafka partition is stored as a directory on disk containing multiple files called **log segments**. Each segment consists of:

1. **`.log` file**: the actual message data, binary format. Records are appended sequentially.
2. **`.index` file**: sparse index mapping **offset → byte position in `.log` file**. Not every offset has an entry — entries are added every `index.interval.bytes` (default 4096 bytes). Binary search to find the right entry, then scan the `.log` from that position.
3. **`.timeindex` file**: sparse index mapping **timestamp → offset**. Used for `seekToTimestamp()` operations and time-based log retention.

The **active segment** is the one being written to. All others are immutable. A new segment is created (**segment roll**) when:
- Active segment reaches `log.segment.bytes` (default 1GB)
- `log.roll.ms` time has passed since segment creation
- `log.roll.jitter.ms` adds randomness to prevent all partitions rolling at the same time

Segment naming: files are named by the **base offset** (the offset of the first message in the segment).

```text
00000000000000000000.log   ← first segment (starts at offset 0)
00000000000000000000.index
00000000000000000000.timeindex
00000000000000000234.log   ← next segment (starts at offset 234)
00000000000000000234.index
00000000000000000234.timeindex
```

> 🌍 **Real-World:** The `.timeindex` file is what makes Kafka's time-based retention work efficiently. When Kafka deletes old segments based on `log.retention.ms`, it uses the `.timeindex` to find the first segment whose maximum timestamp is older than the retention threshold — O(log N) lookup via binary search. Without this index, determining which segments to delete would require reading every message's timestamp across potentially terabytes of data.

### Why Sequential I/O Matters

Random disk I/O involves seeking the read/write head to a new position on the disk — this takes 1-10ms on spinning disks. If Kafka randomly accessed disk, it would be limited to a few hundred IOPS.

**Sequential I/O** (append to end of file, read from a known position) eliminates seeking. A spinning disk can do sequential I/O at 100-300MB/s. SSDs are even faster. Kafka writes to the end of the active segment sequentially. Consumers read sequentially forward from their offset. This is the first reason Kafka is fast.

> 🌍 **Real-World:** LinkedIn runs Kafka on spinning HDDs (not SSDs) for their highest-volume topics because sequential I/O on a 7200 RPM HDD achieves ~200MB/s — nearly as fast as consumer-grade SSDs. This was a deliberate cost optimization: SSDs cost 5-10× more per GB, but Kafka's sequential I/O pattern makes HDDs nearly as fast for their workload. LinkedIn reportedly saves tens of millions of dollars annually on storage costs by using HDDs for Kafka instead of SSDs.

### Page Cache

The OS maintains a **page cache** — a portion of RAM used to cache recently accessed disk data. When you write to a file, the kernel writes to page cache first and returns immediately (write is complete from application's perspective). The actual disk write happens asynchronously by the kernel's flushing mechanism. When you read a file, the kernel first checks page cache — if the data is there, no disk I/O needed.

Kafka exploits this heavily:
- **Producer writes**: call `write()` on the log file → kernel writes to page cache → returns. Broker returns ACK. Later, kernel flushes to disk.
- **Consumer reads**: data may still be in page cache from the recent producer write → consumer read is served from memory with no disk I/O. This is the common case for real-time consumers (lag = 0).
- **Broker restart**: page cache is lost (it's in RAM), but the data is on disk. On restart, the first reads go to disk, and page cache is warmed up again. No state needed in the broker process itself.

> **💡 Key Insight:** Kafka intentionally keeps no message data in the JVM heap. JVM garbage collection pauses can be unpredictable. By relying on the OS page cache, Kafka avoids GC pauses affecting message delivery and leverages the OS's highly optimized page cache management.

> **⚠️ Production Gotcha:** Leave a significant portion of broker RAM free for the OS page cache. If a broker has 64GB RAM, don't give 50GB to the JVM. Give 6-8GB to JVM heap and let the OS use the remaining ~56GB as page cache. The page cache acts as a high-speed buffer between producers and consumers.

> 🌍 **Real-World:** Confluent's broker tuning guide recommends giving the JVM no more than 6GB heap even on a 128GB broker machine. When a Confluent customer (a major bank) gave their Kafka brokers 32GB JVM heap "to be safe", they experienced multi-second GC pauses during full GC cycles that caused broker unavailability and consumer lag spikes. Reducing heap to 6GB and letting the OS use the remaining memory as page cache eliminated all GC-related broker pauses — their P99 consumer latency dropped from 4 seconds to 45ms.

### Zero-Copy with sendfile()

**Normal file-read-then-send flow (without zero-copy):**
1. `read()` syscall: kernel copies data from disk (via page cache) to kernel read buffer
2. Kernel copies from kernel read buffer to **userspace application buffer**
3. `send()` syscall: kernel copies from userspace buffer to kernel socket send buffer
4. Kernel copies from socket buffer to NIC for transmission

That's 4 copies (2 kernel↔userspace crossings) and 2 syscalls.

**With `sendfile()` syscall (zero-copy):**
1. Application calls `sendfile(fd_in, fd_out, offset, count)`
2. Kernel copies from page cache to socket buffer (kernel space only, with DMA assistance)
3. NIC transmits from socket buffer

That's 2 copies (or even 1 with DMA scatter-gather), no userspace copy, 1 syscall. The data never touches the application's memory.

Kafka uses `FileChannel.transferTo()` in Java, which maps to `sendfile()` on Linux. This is the second reason Kafka is fast. Without zero-copy, Kafka throughput would be CPU-bound by data copying. With it, the CPU is barely involved in message passing.

> **⚠️ Production Gotcha:** If you enable SSL/TLS on Kafka, data must be encrypted in userspace — **zero-copy is broken**. Kafka must copy through userspace for encryption. This is a significant throughput hit for SSL-enabled Kafka clusters. TLS-accelerated NICs can partially mitigate this.

> 🌍 **Real-World:** Uber measured the SSL overhead on their Kafka cluster and found a 35% throughput reduction when encrypting all inter-broker traffic. For their most latency-sensitive topics (driver location updates, used for ETA calculations), they keep Kafka brokers in a private VPC and use network-level encryption (VPC peering with private IP routing) instead of TLS, preserving zero-copy. Topics containing PII (user payment data) use TLS but are lower-volume, making the CPU cost acceptable.

### Log Compaction

Two retention modes for topics:

| Mode | Config | Behavior | Use Case |
|------|--------|----------|----------|
| **Delete** (default) | `cleanup.policy=delete` | Retain messages for `log.retention.ms` (default 7 days) or `log.retention.bytes` (default unlimited). Oldest segments deleted first. | Time-series events, logs, metrics |
| **Compact** | `cleanup.policy=compact` | For each key, retain only the **latest message**. `null` value = tombstone (delete the key). | Database changelogs, entity state, `__consumer_offsets` |
| **Compact + Delete** | `cleanup.policy=compact,delete` | Compact AND apply time-based deletion | Latest state per key with bounded retention |

> **💡 Key Insight:** The **compacted topic** acts like a key-value store — the current state of each key is always available, even after months. This is how `__consumer_offsets` and Kafka Streams changelog topics work.

**How compaction works internally:**
- The **log cleaner thread** (background) compares the dirty portion (recently written, not yet compacted) to the clean portion.
- It reads all messages, keeping only the latest value per key.
- Writes a new compacted segment. Deletes old segments.
- `min.cleanable.dirty.ratio` (default 0.5): cleaner doesn't run until 50% of the log is dirty. Lower value = more frequent compaction = fresher but more I/O.
- `min.compaction.lag.ms` (default 0): minimum time a message will remain uncompacted. Gives consumers time to process before it's overwritten.
- `max.compaction.lag.ms`: maximum time a compactable message stays uncompacted (prevents staleness).
- **Tombstones** (`null` value): retained for `delete.retention.ms` (default 24 hours) after compaction, then removed. Consumers must see the tombstone to know a key was deleted.

> 🌍 **Real-World:** Debezium (CDC tool used by Airbnb, Netflix, Shopify) uses compacted Kafka topics as "snapshot topics" — the full current state of a database table is always available by reading from offset 0 to end of a compacted topic. When Airbnb brings up a new microservice that needs the current state of the `listings` table (100M rows), it reads the compacted `postgres.listings` CDC topic from the beginning — getting only the latest row version per `listing_id` (compacted). A new service can bootstrap its state from Kafka in minutes instead of requiring a database dump.

---

## 7. Replication and Leader Election

### ISR (In-Sync Replicas)

Every partition has one **leader** and N-1 **followers** (N = replication factor). The **ISR (In-Sync Replicas)** is the subset of replicas (including the leader) that are "caught up" with the leader's log.

Definition of "caught up": a replica is in ISR if it has sent a fetch request to the leader within `replica.lag.time.max.ms` (default 30000ms = 30 seconds) AND has replicated up to near the leader's log end offset.

If a follower falls behind (slow network, slow disk, GC pause), it is removed from ISR. Once it catches up, it's added back.

> 🌍 **Real-World:** LinkedIn monitors ISR size per partition as a primary SLI for their Kafka clusters. An alert fires when `ISR size < replication factor` for more than 2 minutes — this indicates a replica is falling behind, reducing durability below the desired level. LinkedIn's SRE team has a runbook specifically for "ISR shrinkage": check follower GC logs, disk latency, and network bandwidth before the replica falls fully out of sync and requires a time-consuming full resync.

### Replication Flow

1. Producer sends message to leader (the only replica that accepts writes)
2. Leader writes to its local log
3. Followers continuously fetch from leader (long-poll `FetchRequest`)
4. Leader tracks the fetch position of each follower
5. Once all ISR members have fetched up to a certain offset, that offset becomes the **High Watermark (HWM)**
6. Leader advances HWM and includes it in the next `FetchResponse` to followers
7. Followers advance their own HWM
8. Only messages up to the HWM are visible to consumers (even if leader has newer messages)

> **💡 Key Insight:** The **HWM mechanism** ensures consumers only see messages that have been replicated to all ISR members, preventing consumers from reading data that could be lost if the leader crashes.

> 🌍 **Real-World:** The HWM design means Kafka consumers never see uncommitted data, even under leader failure. When Spotify's Kafka leader for their `play-events` topic crashed mid-replication, the new leader's HWM was at the last fully-replicated offset — consumers simply continued from where they were, unaware of the brief unavailability. Without the HWM mechanism, consumers could have read messages that the new leader didn't have, leading to "phantom plays" in their analytics pipeline.

### Leader Election (ZooKeeper Mode)

One broker in the cluster is the **controller** (elected via ZooKeeper). The controller watches for broker failures and manages leader elections.

When a leader broker fails:
1. ZooKeeper session of the failed broker expires
2. Controller detects the broker is gone
3. Controller picks the first replica in the ISR list for each partition that was led by the failed broker
4. Controller updates the partition metadata in ZooKeeper
5. New leader starts accepting reads/writes
6. All other brokers update their metadata from ZooKeeper

The ISR-based election ensures the new leader has all committed messages (it was in ISR, so it replicated everything up to HWM).

### KRaft Mode (Kafka 2.8+ experimental, 3.3+ production-ready)

ZooKeeper is replaced by an internal Kafka **Raft (KRaft)** consensus layer. A subset of brokers act as **controllers** (can be dedicated controller nodes or combined controller+broker nodes).

**How it works:**
- Controllers form a Raft quorum (3 or 5 controller nodes recommended)
- Metadata (topic configs, partition assignments, ISR, etc.) is stored in a special `__cluster_metadata` topic managed by the Raft quorum
- One controller is the **active controller** (Raft leader), others are followers
- All metadata changes go through the active controller and are replicated via Raft
- Brokers get metadata updates by fetching from the active controller (like a regular Kafka consumer)

| Feature | ZooKeeper Mode | KRaft Mode |
|---------|---------------|------------|
| Metadata propagation | ZK latency overhead | Faster — direct broker fetching |
| Max partitions | ~200,000 (ZK write bottleneck) | 10M+ (no ZK bottleneck) |
| Operations | Two systems to run (ZK + Kafka) | Single system |
| Leader election speed | Seconds (ZK session timeout) | Milliseconds (Raft convergence) |
| Migration | — | Rolling migration tool available |

> **📖 Real-World Example:** LinkedIn, operating 7 trillion messages/day across 1,400+ brokers, was one of the earliest adopters of KRaft at scale. The ZooKeeper write bottleneck was a real limitation for clusters with hundreds of thousands of partitions.

> 🌍 **Real-World:** Confluent migrated their largest Confluent Cloud clusters (250,000+ partitions) to KRaft in 2023. In ZooKeeper mode, adding 10,000 new partitions to a cluster took ~2 minutes as ZooKeeper processed the metadata writes sequentially. In KRaft mode, the same operation takes ~3 seconds — 40× faster. For Confluent Cloud customers who provision topics programmatically (e.g., a new topic per customer with multiple partitions), this made topic creation effectively instantaneous rather than a multi-minute wait.

### min.insync.replicas and Durability Guarantee

`min.insync.replicas` (can be set per topic or globally): minimum number of replicas that must be in ISR for a producer `acks=all` write to succeed.

**Recommended settings for durability:**
- Replication factor = 3
- `min.insync.replicas = 2`
- `acks = all` (producer config)

This means: the write is acknowledged only when at least 2 replicas have it. You can lose 1 replica without losing data or affecting write availability. If 2 replicas fail simultaneously, writes fail (`NotEnoughReplicasException`) but you don't lose already-written data.

| min.insync.replicas | Effect |
|---------------------|--------|
| `1` | `acks=all` degrades to effectively `acks=1` |
| `2` (recommended for RF=3) | Tolerates 1 replica failure for writes |
| `3` (equals replication factor) | Zero tolerance — any replica down = write unavailable |

### Unclean Leader Election

What if ALL replicas in the ISR go down? The partition is unavailable for reads/writes by default.

`unclean.leader.election.enable` (default `false`):

| Setting | Behavior | Trade-off |
|---------|----------|-----------|
| `false` (recommended) | Partition stays offline until ISR replica returns | No data loss; possible extended unavailability |
| `true` | Out-of-sync replica becomes leader immediately | Availability restored; **data loss guaranteed** |

> **⚠️ Production Gotcha:** For financial/billing systems, keep `unclean.leader.election.enable=false`. For analytics/logging where some data loss is tolerable, `true` may be acceptable. This is the classic availability vs. durability trade-off — choose deliberately.

> 🌍 **Real-World:** Stripe keeps `unclean.leader.election.enable=false` for all payment-related topics but `true` for their metrics and logging topics. During a 2022 partial network partition that took 2 of 3 replicas out of ISR simultaneously, their `payment-events` topic became unavailable for write for ~4 minutes (until one ISR replica recovered) — but zero payment events were lost. Their logging pipeline (unclean election enabled) continued writing with potential loss of a few minutes of logs, which was acceptable. This deliberate per-topic configuration reflects the business importance of each data stream.

---

## 8. Exactly-Once Semantics (EOS)

### The Three Layers

**Layer 1 — Idempotent Producer (per-partition deduplication):**
- Prevents duplicate messages from producer retries within a producer session.
- Each producer gets a **Producer ID (PID)**. Each message per partition gets a **sequence number**.
- Broker rejects sequence number it already committed. Detects gaps.
- Does NOT cover: duplicate produces across producer restarts (new PID on restart), or atomic writes spanning multiple partitions.

**Layer 2 — Transactions (atomic multi-partition writes):**
- A **transaction** is an atomic unit of work: either all writes across multiple partitions commit or none do.
- Also atomic offset commit: you can atomically write output messages AND commit input offsets in the same transaction.
- Introduces `transactional.id` config. This is a stable identifier that persists across restarts. The same `transactional.id` always gets the same PID (or a new PID that supersedes old ones), enabling cross-restart deduplication.

**Layer 3 — Transactional Consumer (read only committed):**
- `isolation.level=read_committed` on consumer: consumer only sees messages from committed transactions. Messages from aborted or in-progress transactions are invisible (consumers skip them).
- Default is `read_uncommitted`: consumers see all messages including those in ongoing/aborted transactions.

> 🌍 **Real-World:** Apache Flink uses all three EOS layers when running with Kafka as both source and sink. Flink's Kafka source uses `isolation.level=read_committed`, and its Kafka sink uses the transactional producer API with `transactional.id` derived from the Flink job ID + subtask index. When Netflix runs Flink jobs that transform `raw-play-events` → `enriched-play-events`, they get end-to-end exactly-once guarantees: a Flink task manager crash and restart causes the transaction to be aborted, the checkpoint to be rolled back, and processing to resume from the last checkpoint with no duplicates in the output topic.

### Transaction Internals (How It Actually Works)

**Transaction Coordinator**: a special role on one broker per `transactional.id` (determined by hash). Manages the transaction state machine. State is stored in `__transaction_state` topic (50 partitions, replicated).

**Transaction flow:**

```text
Producer                     Transaction Coordinator         Target Brokers
   |                                  |                           |
   |-- initTransactions() ----------->|                           |
   |<-- (PID, epoch, ...) -----------|                           |
   |                                  |                           |
   |-- beginTransaction() [local] ----|                           |
   |                                  |                           |
   |-- produce(partition A) ----------+-------------------------->|
   |                                  |                    write to partition A
   |-- produce(partition B) ----------+-------------------------->|
   |                                  |                    write to partition B
   |                                  |                           |
   |-- sendOffsetsToTransaction() --->|                           |
   |   (consumer group offsets)       | addOffsetsToTxn()-------->|
   |                                  |                    write to __consumer_offsets
   |                                  |                    (not yet committed)
   |-- commitTransaction() ---------->|                           |
   |                             write PrepareCommit              |
   |                             to __transaction_state           |
   |                                  |                           |
   |                                  |-- commit markers -------->|
   |                                  |   (to all partitions)     |
   |                             write CompleteCommit             |
   |                             to __transaction_state           |
   |<-- success ------------------- |                           |
```

**Transaction Markers**: when a transaction commits, the **transaction coordinator** writes a `COMMIT` marker to each partition that was part of the transaction (and to `__consumer_offsets` for the offset part). Consumers with `read_committed` see these markers and know they can now read up to that point. Aborted transactions get `ABORT` markers — consumers skip all messages in the abort range.

**Zombie fencing**: if a producer with the same `transactional.id` restarts and initiates a new transaction, it gets a higher **epoch** number. The transaction coordinator rejects any requests from the old producer instance (lower epoch) — it's a "zombie" (old producer with stale PID/epoch). This prevents the old crashed instance from interfering with the new one.

> 🌍 **Real-World:** The zombie fencing mechanism is critical for Kubernetes-based Kafka producers. In a Kubernetes rolling update, the old Pod may still be running when the new Pod starts. Without zombie fencing, both the old and new Pod could be writing with the same `transactional.id` simultaneously — corrupting the output stream. With zombie fencing, the new Pod's higher epoch causes the transaction coordinator to immediately reject any writes from the old Pod's lower epoch, ensuring only one producer is active at a time even during overlapping deployments.

### Exactly-Once for Kafka-to-Kafka Processing

The canonical use case: read from input topic, process, write to output topic + commit input offset:

```java
consumer.subscribe(Collections.singletonList("input-topic"));
producer.initTransactions();

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    producer.beginTransaction();
    try {
        for (ConsumerRecord<String, String> record : records) {
            String result = transform(record.value());
            producer.send(new ProducerRecord<>("output-topic", record.key(), result));
        }
        // Atomically commit the output AND the consumer offset
        Map<TopicPartition, OffsetAndMetadata> offsets = new HashMap<>();
        for (TopicPartition tp : records.partitions()) {
            long lastOffset = records.records(tp).get(records.records(tp).size()-1).offset();
            offsets.put(tp, new OffsetAndMetadata(lastOffset + 1));
        }
        producer.sendOffsetsToTransaction(offsets, consumer.groupMetadata());
        producer.commitTransaction();
    } catch (Exception e) {
        producer.abortTransaction();
    }
}
```

> **💡 Key Insight:** If the process crashes before commit, the transaction is aborted (transaction coordinator runs cleanup after `transaction.timeout.ms`, default 1 minute). On restart, the consumer re-reads the uncommitted input offsets and reprocesses. The output from the aborted transaction is **invisible** to downstream consumers with `read_committed`.

### EOS Limitations

- Performance overhead: ~20-30% throughput reduction vs. non-transactional
- `transaction.timeout.ms` (default 1 minute): if transaction doesn't commit/abort within this time, coordinator aborts it automatically. Long-running batch transactions can hit this.
- EOS only applies end-to-end **within Kafka**. If your sink is a database (not Kafka), you must use idempotent database writes + at-least-once delivery for end-to-end exactly-once.
- `read_committed` consumers have increased latency: they can only read up to the **Last Stable Offset (LSO)**, which lags the HWM by the duration of the oldest open transaction.

> 🌍 **Real-World:** Confluent benchmarked exactly-once transactions and found 20-30% throughput reduction. For Wix's order processing pipeline (1M orders/day), the overhead was acceptable — they use EOS for their `order-events → invoice-events` transformation pipeline. However, for their `clickstream-events` analytics pipeline (1 billion events/day), the 30% throughput hit was cost-prohibitive. They use at-least-once + idempotent ClickHouse writes for analytics, and exactly-once only where business correctness demands it (financial pipelines).

---

## 9. Kafka Streams and KSQL

### Kafka Streams

A **Java library** (not a separate cluster) for stream processing that reads from and writes to Kafka. It runs inside your application process. No separate cluster to manage.

**Key abstractions:**

| Abstraction | Description | SQL Analogy |
|-------------|-------------|-------------|
| `KStream` | Unbounded, continuous stream of records | SQL `STREAM` |
| `KTable` | Changelog of a key-value store; latest value per key; backed by compacted topic | SQL `TABLE` |
| `GlobalKTable` | Like `KTable` but replicated to all instances | Small lookup/reference table |

**State stores:** for stateful operations (aggregation, windowed joins, deduplication), Kafka Streams uses local **RocksDB** state stores (disk-backed, fast). Each state store is backed by a **changelog topic** in Kafka (compacted). On restart or failover, state is restored from the changelog topic. This enables fault-tolerant local state.

**Topology**: processing is defined as a DAG (topology) of source processors, intermediate processors, and sink processors. Topologies are compiled and partitioned to run in parallel.

**Scaling**: scale by adding instances of the same application with the same `application.id` (acts as consumer group ID). Kafka Streams assigns partitions to instances automatically. State stores are partitioned the same way as the input partitions — local state is always co-located with the partition that needs it.

**Stream-Table Join**: joining a `KStream` with a `KTable` requires both to be **co-partitioned** (same number of partitions, same partitioner). This is a common source of bugs when partition counts differ.

> 🌍 **Real-World:** LinkedIn (who created both Kafka and Samza, an early stream processing framework) uses Kafka Streams for their "People You May Know" recommendation feature. The Kafka Streams application joins a `KStream` of user activity events with a `KTable` of the user's current network — when a user views a profile that is not yet in their network but is connected to 5+ of their connections, the join produces a "recommendation candidate" event. The co-location of state with input partitions means network lookups happen against local RocksDB, not remote services.

**Windowing types:**

| Window Type | Behavior | Example |
|-------------|----------|---------|
| **Tumbling** | Fixed-duration, non-overlapping | 1-minute windows: [0:00-1:00), [1:00-2:00), ... |
| **Hopping** | Fixed-duration, overlapping | 5-min windows advancing every 1 min |
| **Sliding** | Dynamic based on record proximity | All pairs of records within 5s of each other |
| **Session** | Dynamic based on inactivity gap | Group records with <30s gap between them |

> 🌍 **Real-World:** DoorDash uses Kafka Streams tumbling windows (1-minute) to compute real-time restaurant demand signals. `COUNT(*)` of orders in each 1-minute window per restaurant feeds into their surge pricing model. When a restaurant accumulates >20 orders in a 1-minute window, a high-demand signal is published, potentially triggering a capacity alert or adjusting delivery fee estimates. Session windows are used for tracking a dasher's "active delivery session" — a session ends after 5 minutes of inactivity (no location updates).

**When Kafka Streams vs. Flink:**

| Criterion | Kafka Streams | Apache Flink |
|-----------|--------------|--------------|
| Cluster required | No (library in your app) | Yes (separate Flink cluster) |
| Source/sink | Kafka only | Multiple systems |
| Language | Java/Scala | Java, Scala, Python, SQL |
| Stateful complexity | Moderate | High (CEP, pattern matching) |
| EOS with external systems | Kafka only | Native connectors with EOS |
| Recovery/checkpointing | Changelog topic restoration | Mature distributed snapshots |
| Backpressure | Per-partition | Full distributed graph |

> 🌍 **Real-World:** Uber uses Apache Flink (not Kafka Streams) for their fraud detection pipeline because Flink supports complex event patterns (CEP) that span multiple event types across multiple topics. Their fraud model looks for patterns like: `login_event` from new device → `password_change` → `payment_method_add` → `large_transaction` within 30 minutes. Flink's pattern matching API handles this multi-stream, time-bounded CEP naturally; Kafka Streams would require complex custom state management to implement the same logic.

### KSQL (now called ksqlDB)

**SQL interface for Kafka**. Runs as a separate server cluster (ksqlDB servers) that translates SQL queries into Kafka Streams topologies. Supports persistent queries (running indefinitely) and transient queries (one-shot).

```sql
CREATE STREAM pageviews AS
  SELECT userId, page, COUNT(*) AS views
  FROM raw_pageviews
  WINDOW TUMBLING (SIZE 1 MINUTE)
  GROUP BY userId, page
  EMIT CHANGES;
```

Good for: real-time dashboards, simple transformations, enrichment joins without writing Java. Not good for: complex business logic, high-performance production critical paths (KSQL adds operational complexity).

> 🌍 **Real-World:** Trivago (hotel search) uses ksqlDB to power their real-time operational dashboards. Business analysts write SQL queries against live Kafka topics — `SELECT hotel_id, COUNT(*) FROM click_events WINDOW TUMBLING (SIZE 5 MINUTES) GROUP BY hotel_id` — to see which hotels are trending in real time. Instead of data engineers writing and deploying Java Kafka Streams apps for each new dashboard metric, analysts self-serve with SQL queries that run continuously and feed into Grafana dashboards. This democratized real-time analytics within Trivago without scaling the data engineering team.

---

## 10. Operations and Production Gotchas

### Consumer Lag Monitoring

**Consumer lag** = (latest offset in partition) - (consumer's committed offset in partition).

> **⚠️ Production Gotcha:** Never monitor only **total lag**. A single slow partition can have 10 million messages of lag while all other partitions are at zero. Total lag looks like 10 million. But the issue is specific to one partition (could be a hot key, a single bad message, etc.). Always monitor **per-partition lag**.

Tools: Kafka's built-in `kafka-consumer-groups.sh --describe`, Burrow (LinkedIn's Kafka consumer lag monitoring), JMX metrics.

Alert on:
- Lag growing consistently over time (consumer not keeping up)
- Lag suddenly spiking (consumer restart, slow processing)
- Lag being non-zero for a partition that should be at zero (poison pill blocking processing)

> 🌍 **Real-World:** LinkedIn built Burrow (open-sourced their Kafka consumer lag monitoring tool) specifically because the built-in `kafka-consumer-groups.sh` was insufficient for production monitoring. Burrow evaluates lag using a sliding window of committed offsets — it distinguishes between "lag is 10,000 but growing" (consumer is falling behind, page on-call) vs. "lag is 10,000 but stable" (consumer is keeping up with production rate, batch consumer pattern, no alert needed). Netflix, Uber, and Goldman Sachs all adopted Burrow for its nuanced lag evaluation logic.

### Partition Skew and Leader Skew

**Partition skew**: some partitions have far more data than others. Usually caused by a few hot keys when using key-based partitioning. The partition holding the hot key is overloaded; others are idle. Solution: use a composite key (add random suffix), or use a custom partitioner that spreads hot keys.

**Leader skew**: partition leaders are not evenly distributed across brokers. One broker handles most producer and consumer traffic while others are underutilized. This can happen after broker failures/restarts if preferred leaders aren't rebalanced back.

```bash
# Reassign leaders back to preferred replicas — rebalances load
kafka-leader-election.sh --election-type PREFERRED --all-topic-partitions

# Move partition replicas between brokers (needed when adding new brokers)
kafka-reassign-partitions.sh
```

> **⚠️ Production Gotcha:** New brokers won't automatically receive existing partitions. You must use `kafka-reassign-partitions.sh` after adding a broker to the cluster to distribute existing partitions.

> 🌍 **Real-World:** Robinhood experienced severe partition skew during the GameStop trading frenzy (January 2021). Their `trade-events` topic used `stock_ticker` as the partition key — GME (GameStop) suddenly accounted for 80% of all trade events, all landing on one partition and one broker. That broker's CPU hit 100%, causing trade event processing delays. Their short-term fix: temporarily switch to round-robin partitioning for the `trade-events` topic (sacrificing per-ticker ordering) to distribute load. Long-term fix: implement a custom partitioner that detects hot tickers and sub-partitions them across multiple partition ranges.

### Disk Full on Brokers

Disk full stops the broker. It can no longer write to the log. Producers get errors. This is a common production incident.

**Prevention:**
- Monitor disk usage per broker and alert at 70% and 85%.
- Set `log.retention.bytes` per topic for high-volume topics.
- Set `log.retention.ms` appropriately.
- For compacted topics: compaction can lag behind if the cleaner can't keep up. `min.cleanable.dirty.ratio` and cleaner thread count affect this. Monitor `kafka.log:type=LogCleanerManager,name=max-dirty-percent`.
- Underreplicated partitions can cause data to be retained longer than expected (can't delete segments if a follower hasn't replicated them yet — log deletion respects the follower's offset).

> 🌍 **Real-World:** Shopify had a disk-full broker incident when their `product-update-events` topic was misconfigured with no `log.retention.bytes` limit. A batch import job pushed 5TB of product data in 2 hours, filling a broker's 2TB disk. Producers received `RecordTooLargeException` (disk full manifests as producer errors), and the topic was unavailable for 45 minutes while engineers deleted old segments manually. They now enforce `log.retention.bytes` as a mandatory configuration for all topics > 1GB/day in their topic provisioning tooling, and monitor broker disk usage with 70%/85% alerts.

### Schema Evolution with Avro + Schema Registry

Without schema management, producers and consumers must agree on message format. A schema change by the producer breaks consumers. Use **Avro** with **Confluent Schema Registry** (or similar):

- Schema is registered in the Schema Registry with a subject (typically `<topic>-value`)
- Producer serializes with Avro, embedding the **schema ID** (not the full schema) in the message header
- Consumer fetches schema by ID from Schema Registry, deserializes

**Schema Registry compatibility modes:**

| Mode | Rule | Deployment Order |
|------|------|-----------------|
| `BACKWARD` (default) | New schema can read old data (add fields with defaults, remove optional fields) | Deploy consumers first |
| `FORWARD` | Old schema can read new data (remove fields with defaults) | Deploy producers first |
| `FULL` | Both backward and forward compatible | Either order |
| `NONE` | No compatibility checking | Coordinate manually |

> **⚠️ Production Gotcha:** Production recommendation is `BACKWARD` or `FULL` compatibility. Never deploy a consumer before the producer schema change with forward compatibility.

> 🌍 **Real-World:** Confluent Schema Registry is used by 4,000+ companies to manage Kafka schema evolution. Airbnb's internal Kafka platform enforces `FULL_TRANSITIVE` compatibility (stricter than FULL — compatible with all previous versions, not just the last one) for all production topics. When a team tried to add a required field without a default to their `booking-events` schema, the Schema Registry rejected the schema registration before deployment — preventing a breaking change that would have crashed all consumers of that topic. The registry acts as a "contract test" that runs before any code is deployed.

### Poison Pill Messages

A **poison pill** is a message that consistently causes the consumer to throw an exception (bad data, schema mismatch, code bug that only manifests on this specific message). The consumer retries it, fails, retries, fails — it's stuck. Consumer lag grows on that partition. All messages after the poison pill in that partition are blocked.

**Dead Letter Queue (DLQ) pattern:**

```java
for (ConsumerRecord<String, String> record : records) {
    try {
        processRecord(record);
    } catch (NonRetriableException e) {
        // Send to DLQ topic for offline analysis
        producer.send(new ProducerRecord<>("my-topic.DLQ", record.key(), record.value()));
        // Continue processing next messages
    }
}
```

Always distinguish retriable errors (transient failures, retry makes sense) from non-retriable errors (bad message format, retry will never succeed → DLQ).

> 🌍 **Real-World:** Stripe's webhook delivery system uses a multi-tier DLQ pattern. Failed webhook deliveries go to `webhooks.retry-1` (retry after 1 minute), then `webhooks.retry-2` (retry after 5 minutes), then `webhooks.retry-3` (retry after 30 minutes), then `webhooks.dead-letter` (after 3 days of retries, human intervention required). Each DLQ tier is a Kafka topic with its own consumer group. This exponential backoff approach prevents a flaky customer endpoint from blocking other webhook deliveries and gives operators visibility into which customers have consistently failing endpoints.

### Rebalance Storm

**Scenario:** many consumers (e.g., 50), frequent restarts (rolling deploy, OOM crashes), slow startup time (30+ seconds). Each restart triggers a rebalance. While one rebalance completes, another consumer restarts, triggering another. No progress is made.

**Solutions:**

| Solution | How It Helps |
|----------|-------------|
| **CooperativeStickyAssignor** | Only affected consumers stop; others continue |
| **Static group membership** | Restarts within `session.timeout.ms` don't trigger rebalance |
| **Longer `max.poll.interval.ms`** | Gives slow consumers more time between polls |
| **Fix the root cause** | OOM → fix memory; slow processing → scale up partitions |

> 🌍 **Real-World:** Square's data pipeline team experienced a rebalance storm when deploying a new version of their 80-consumer Kafka Streams application. Each consumer restart triggered a full rebalance (EagerRebalance, default) taking 45 seconds. With 80 consumers restarting one by one (rolling deploy), the pipeline spent almost 60 continuous minutes in rebalance state, processing zero messages. Fix: CooperativeStickyAssignor + static group membership (`group.instance.id=streams-instance-{pod_name}`). Their next rolling deploy: 80 restarts in 15 minutes with ~95% of consumers processing normally throughout.

### `__consumer_offsets` Topic Compaction Lag

Large consumer groups with many partitions accumulate lots of offset commit records. The compaction of `__consumer_offsets` can lag, making it huge. On consumer group restart, the consumer must read through a lot of records to find the latest committed offsets for each partition.

**Mitigation:**
- Keep `offsets.retention.minutes` (default 7 days) at a reasonable value — offsets for dead consumers are cleaned up
- Ensure compaction is keeping up (monitor `max-dirty-percent` for the `__consumer_offsets` topic)
- Use `kafka-consumer-groups.sh --reset-offsets` to clear stale offsets

### Out-of-Order Message Handling

**Within a partition:** Kafka guarantees ordering. Messages are always in the order they were produced to that partition.

**Across partitions:** no ordering guarantee. Messages on partition 0 and partition 1 have no relative ordering.

| Requirement | Solution |
|-------------|----------|
| Global ordering | Use 1 partition (no horizontal scaling possible) |
| Per-key ordering | Use key-based partitioning (same key always same partition) |
| Reliable event-time ordering | Set `message.timestamp.type=LogAppendTime` on broker |

> **⚠️ Production Gotcha:** Even within a partition, message **event timestamps** can be out of order if producers have skewed clocks (the `timestamp` field is set by the producer). Use `LogAppendTime` if you need reliable time-based ordering — but this loses the actual event time.

> 🌍 **Real-World:** Uber's ETA calculation pipeline requires per-trip event ordering (driver picked up rider before driver completed trip). They use `driver_trip_id` as the Kafka partition key — all events for a single trip land on the same partition in producer-send order. However, they discovered that mobile apps with skewed clocks were producing events with timestamps from the future, breaking their time-window aggregations. Fix: `message.timestamp.type=LogAppendTime` for their location event topics, using broker append time as the canonical event time for all time-based processing.

### SSL Performance Impact

Enabling TLS on Kafka has significant throughput impact because:
1. **Zero-copy (`sendfile()`) is disabled** — data must be decrypted/encrypted in userspace
2. TLS handshake overhead on connection establishment
3. Encryption/decryption CPU overhead

**Mitigation:**
- Use AES-NI hardware acceleration (most modern CPUs have this, verify it's enabled)
- TLS 1.3 is faster than TLS 1.2 (fewer round trips, better cipher suites)
- Use persistent connections — amortize handshake cost
- Profile before assuming TLS is the bottleneck (it's often worth the CPU cost for security)

> 🌍 **Real-World:** Goldman Sachs requires TLS encryption for all Kafka traffic (regulatory requirement for financial data). Their Kafka brokers use Intel processors with AES-NI hardware acceleration — the TLS 1.3 encryption/decryption is offloaded to dedicated AES-NI instructions, reducing the CPU overhead of encryption from ~35% (software AES on older hardware) to ~8% (AES-NI). The remaining overhead comes primarily from the loss of zero-copy sendfile(). For Goldman's compliance requirement, this is a non-negotiable cost.

---

## 11. Senior-Level Depth

### Why Kafka Uses Pull Instead of Push

**Push-based systems** (broker pushes to consumer): the broker decides when and how much to send. If the consumer is slow, the broker can overwhelm it (back-pressure problem). The broker must know the consumer's capacity. Complex to implement adaptive rate control server-side.

**Pull-based** (consumer pulls from broker): the consumer requests data when it's ready. Natural back-pressure — a slow consumer just polls less often. The consumer controls batch size (`max.poll.records`). Multiple consumers at different speeds can share the same broker without interfering. Simple protocol.

Tradeoff: pull-based has higher latency when the topic has low volume — consumer polls and gets empty response, waits `fetch.max.wait.ms`, polls again. Push-based would deliver immediately. Kafka mitigates this with `fetch.min.bytes` / `fetch.max.wait.ms` — the broker waits until it has data before responding (long-polling). In practice, latency is sub-second even with low volume.

> 🌍 **Real-World:** AWS Kinesis (Kafka's cloud competitor) started with a push-based Enhanced Fan-Out model but added pull-based (classic GetRecords) consumption because customers found push too difficult to manage back-pressure for slow processors. Confluent's documentation on this comparison notes that Kafka's pull model is a key reason it handles the "slow consumer" problem better than push-based systems — a consumer that's slow due to downstream database pressure simply pulls less frequently, without needing any coordination with the broker or other consumers.

### The Log Abstraction as Universal Integration

Kafka's founders (Jay Kreps, et al.) described the log as the "universal integration mechanism." The insight: if every state change in every system is represented as an event in an ordered log, any system can subscribe to that log and derive its own view of state. This is event sourcing at infrastructure scale.

Implications:
- **Databases as derived views**: Kafka topic is the source of truth. A database is just a materialized view.
- **Microservices communication**: instead of REST calls (tight coupling, point-in-time), services emit events and subscribe to events (loose coupling, replay possible)
- **Change Data Capture (CDC)**: databases like MySQL/Postgres can be turned into Kafka producers via Debezium, making all row-level changes available as a stream

> **📖 Real-World Example:** LinkedIn uses this model at scale — their entire activity tracking, member graph, and recommendations pipelines are built on Kafka as the universal data bus, with each downstream system (Hadoop, Samza, real-time serving) reading from the same topics independently.

> 🌍 **Real-World:** Shopify uses Debezium + Kafka as their CDC backbone. Every row change in MySQL (orders, products, inventory) is published to a Kafka topic within milliseconds. Their search indexing service (Elasticsearch), analytics warehouse (BigQuery), and fraud detection system all consume from the same CDC stream — each maintaining its own materialized view of the data. When Shopify adds a new data consumer (e.g., a new ML feature pipeline), it simply subscribes to the existing CDC topics and replays history, without any changes to the MySQL schema or application code.

### Choosing Partition Count

| Partition Count | Problem |
|-----------------|---------|
| **Too few** | Limited parallelism (max consumers = partitions); each partition gets more throughput load; hard to scale later without breaking key ordering |
| **Too many** | More open file handles per broker; more follower fetch buffer memory; slower leader election; more `__consumer_offsets` commits |

**Rule of thumb:** target throughput ÷ per-partition throughput. If topic needs 100MB/s and each partition handles ~10MB/s (limited by disk or network), use 10-20 partitions (with headroom). For low-throughput topics, 3-6 partitions is usually fine.

General limits:
- ZooKeeper mode: ~4000-8000 partitions per broker cleanly
- KRaft mode: handles significantly more

> 🌍 **Real-World:** Confluent's Kafka topic design guide recommends against the common "start with 1 partition and scale later" approach. LinkedIn found that topics they started with 6 partitions frequently needed to be expanded to 60+ partitions 18 months later as load grew — but expanding partitions breaks key-based ordering for all existing keys, requiring a painful migration. Their standard now: provision at 3× expected current need, accepting the overhead of extra partitions in exchange for avoiding painful repartitioning later.

### Choosing Replication Factor

| RF | Fault Tolerance | Notes |
|----|----------------|-------|
| RF=1 | None | Never use in production |
| RF=2 | 1 failure | During that failure, `min.insync.replicas=2` means writes fail until recovery; rolling restarts require care |
| RF=3 | 1 failure with write availability (`min.insync.replicas=2`); 2 failures for reads | **Standard for production** |
| RF=5 | Extra durability at storage/replication cost | Critical topics only; rare |

> 🌍 **Real-World:** Stripe uses RF=5 for their `payment-events` topic (the most critical topic in their infrastructure) and RF=3 for everything else. The cost of 5 replicas (5× storage, 5× replication bandwidth) is justified for the topic that powers all payment processing — tolerating up to 2 simultaneous broker failures without any data loss. For their RF=5 topics, they also use `min.insync.replicas=3`, meaning they tolerate 2 of 5 replicas being down while still accepting writes.

### High Watermark and Its Impact on Consumer Latency

The **HWM** is the last offset that has been replicated to all ISR members. Consumers can only read up to the HWM. This means:

> **Consumer latency = time for the message to propagate through the ISR.**

If you have ISR = 3 and one follower is slow (but still within `replica.lag.time.max.ms`), the HWM advances slowly → consumer latency increases. The slow follower is blocking the HWM from advancing. Monitoring ISR size and follower lag is critical for latency-sensitive use cases.

> **💡 Key Insight:** If the slow follower falls **out of ISR**, it no longer blocks the HWM. HWM advances based on remaining (faster) ISR members. Latency recovers. But ISR shrinks — which is a durability risk. This is the latency vs. durability tension in Kafka replication.

> 🌍 **Real-World:** Twitter's real-time notification pipeline (tweet mentions, retweets) has a hard SLA: notifications must be delivered within 2 seconds of the event. They discovered that when a broker's JVM GC paused for 800ms, the follower's fetch fell behind, slowing the HWM advancement to a crawl and causing consumer latency to spike to 6+ seconds. Fix: migrate to G1GC with small heap (6GB) + aggressive GC tuning to keep GC pauses under 100ms, and tighten `replica.lag.time.max.ms` to 10 seconds (instead of 30) so slow replicas are evicted from ISR faster, unblocking the HWM.

### Kafka as an Event Store vs. Stream Processor

Kafka retains messages, but it's not a full event store:
- No secondary indexing (can only look up by offset, not by key or timestamp directly — the `.timeindex` helps but it's sparse)
- Log compaction is approximate (there's a lag before old values are cleaned)
- No query language

For event sourcing where you need to query historical events by entity ID, read multiple events for one entity, etc., Kafka is the transport but you need a separate event store (EventStoreDB, a database with event tables) or a projection layer.

> **💡 Key Insight:** Kafka is best thought of as a high-throughput, durable, ordered, replayable **data bus**. The "log" it stores is primarily for: real-time consumers, catch-up consumers (replay last N days), and exactly-once coordination. It's not a database.

> 🌍 **Real-World:** Axon Framework (used for event sourcing at Dutch tax authority, ING Bank) uses Kafka as the event bus but stores events in a dedicated event store database (PostgreSQL with the Axon event store schema). Kafka propagates events in real time across microservices; the event store enables "what was the state of order X at timestamp T?" queries with secondary indexes by aggregate ID. Using Kafka as both bus and store — which some teams attempt — hits the "no secondary index" limitation immediately and requires workarounds that introduce their own complexity.

### Backpressure in Kafka Systems

Kafka provides implicit backpressure: if consumers are slow, their lag grows. Nothing breaks immediately (unlike push-based systems where the consumer queue overflows and messages are dropped). But eventually, disk fills up on the broker, or messages expire from retention before being processed.

**Explicit backpressure strategies:**
- **Monitor lag + auto-scale consumers**: trigger horizontal scaling (more consumer instances = more parallelism) when lag exceeds a threshold
- **Rate limiting at the producer**: if consumer lag is high, slow down producers (application-level, not Kafka's native feature)
- **Kafka Quotas**: per-client-ID or per-user byte rate limits on producers and consumers. Configured on the broker. Throttled clients get a `ThrottleTime` in responses.

> 🌍 **Real-World:** Pinterest uses Kubernetes Horizontal Pod Autoscaler (HPA) backed by a custom Kafka consumer lag metric from their KEDA (Kubernetes Event-Driven Autoscaler) deployment. When consumer lag on their `pin-feed-events` topic exceeds 100,000, KEDA scales the feed processing Deployment from 12 pods to 48 pods automatically. When lag drops below 10,000, it scales back down. This automatic scaling handles Pinterest's traffic spikes (viral pin events) without human intervention and saves 70% of compute cost vs. always running at peak capacity.

### Transaction Performance Characteristics

Transactional Kafka has overhead:
- Every produce requires coordination with the transaction coordinator (extra network round trip to begin transaction, `sendOffsetsToTransaction`, `commitTransaction`)
- Commit transaction: coordinator must write to `__transaction_state`, then send commit markers to all involved partitions — latency ≈ 2× the number of partition leaders involved
- Consumers with `read_committed` can only read up to the **Last Stable Offset (LSO)**. LSO is stuck at the first message of any open transaction. If you have a long-running transaction (even just 1 second), consumers are blocked 1 second behind.
- Throughput: ~20-30% lower than non-transactional with all else equal

**When NOT to use transactions:**
- Sink is not Kafka (database, HTTP API) — you can't use transactional commit for that
- Processing time per batch is highly variable (can hit `transaction.timeout.ms`)
- You can achieve exactly-once via idempotent consumer + idempotent sink operations (often simpler)

> 🌍 **Real-World:** Flink's exactly-once Kafka integration uses a two-phase commit protocol that leverages Kafka transactions. Flink committer tasks call `commitTransaction()` at each checkpoint. If a checkpoint takes longer than `transaction.timeout.ms` (default 1 minute), Kafka aborts the transaction and the checkpoint fails. Netflix's Flink team had to increase `transaction.timeout.ms` to 15 minutes for their large state checkpoints — but this means consumers reading with `read_committed` can be up to 15 minutes behind the producer in the worst case (during a long checkpoint). They monitor LSO lag separately from consumer lag for this reason.

### Interview: Design an At-Least-Once Payment Processing Pipeline

**Problem:** process payment events from Kafka with no data loss, handle duplicates.

**Answer structure:**
1. Consumer with `acks=all`, manual offset commit
2. Process payment → write to DB with an idempotency key (payment_id from the Kafka message key or a field in the message)
3. DB write is idempotent: `INSERT INTO payments ... ON CONFLICT (payment_id) DO NOTHING`
4. Commit offset only after successful DB write
5. On crash/restart: consumer re-reads from last committed offset, reprocesses. The DB write is idempotent → no duplicate payment.

> **💡 Key Insight:** Why not exactly-once transactions? Because the sink is a database, not Kafka. We can't do an atomic commit spanning Kafka offset + DB row. We use **at-least-once + idempotent sink** instead.

> **📖 Real-World Example:** Shopify uses this exact pattern for order events: exactly-once semantics via idempotent producer + consumer dedup key on the payment_id, because payment events must not be processed twice.

### Interview: Explain Why ISR Matters for Durability

**Question:** "Producer wrote to Kafka and got an ACK with `acks=all`. Is that data safe?"

**Answer:** "It's as safe as the ISR at the moment of the write. `acks=all` means all replicas currently in ISR have the message. If `min.insync.replicas=2` and the ISR has 2 replicas, the message is on 2 brokers. If both fail simultaneously → data loss. If only 1 fails → data is safe on the other. The key insight is that ISR is **dynamic** — a slow replica can fall out of ISR, reducing the redundancy level without the producer knowing. Monitoring ISR size per partition is critical to understanding actual durability at any given moment."

### Interview: How Would You Debug a Consumer Falling Behind?

```bash
# Step 1: See per-partition lag, current offset, log end offset, consumer ID per partition
kafka-consumer-groups.sh --describe --group <group>
```

1. Identify which partitions have the highest lag. Is it **uniform** (all partitions, consumer is just slow) or **skewed** (one partition, hot key or poison pill)?
2. If **uniform**: consumer processing is too slow. Solutions: increase partitions (more parallelism), optimize processing code, scale consumer instances
3. If **one partition**: check if messages in that partition are poison pills. Try processing one message at a time and see which one fails. Consider DLQ.
4. Check for frequent rebalances (rebalance log entries in consumer logs) — rebalances stop processing
5. Check `max.poll.interval.ms` — is consumer violating the poll interval? GC pauses? Slow external calls?
6. Check JVM GC logs — long GC pauses can prevent `poll()` from being called, triggering rebalances

> 🌍 **Real-World:** Confluent's support team reports that the #1 production Kafka issue they debug is consumer lag from poison pills. The debugging runbook matches the steps above: `kafka-consumer-groups.sh --describe` shows one partition with rapidly growing lag while others are normal → engineer manually `kafka-console-consumer`-s from that partition's last committed offset → finds a malformed Avro message with schema version mismatch → routes it to DLQ → consumer unblocks. This 45-minute debugging session happens multiple times per week across the Confluent Cloud customer base.

---

## Quick Reference: Key Numbers

| Config | Default | Notes |
|--------|---------|-------|
| `log.segment.bytes` | 1GB | Segment roll size |
| `log.retention.ms` | 7 days | Message retention |
| `replica.lag.time.max.ms` | 30s | ISR lag threshold |
| `session.timeout.ms` | 45s | Consumer dead detection |
| `max.poll.interval.ms` | 5 min | Max time between polls |
| `heartbeat.interval.ms` | 3s | Should be 1/3 of `session.timeout.ms` |
| `linger.ms` | 0ms | Batch fill wait (set 5-100ms in prod) |
| `batch.size` | 16KB | Max batch size per partition |
| `delivery.timeout.ms` | 2 min | Total produce timeout including retries |
| `transaction.timeout.ms` | 1 min | Max transaction duration |
| `fetch.max.wait.ms` | 500ms | Max broker wait for `fetch.min.bytes` |
| `min.insync.replicas` | 1 | Set to 2 for RF=3 production clusters |
| `__consumer_offsets` partitions | 50 | Internal topic partition count |
| `__transaction_state` partitions | 50 | Internal topic partition count |

---

## Real-World Kafka Usage (How Companies Actually Use It)

> **📖 Real-World Example:** LinkedIn (creator of Kafka) runs 7 trillion messages/day across 1,400+ brokers. Use case: activity tracking (page views, clicks, search), metrics pipeline. They needed a system that could replay events for backfill and analytics — the core insight that shaped Kafka's design around retention and replay.

> **📖 Real-World Example:** Uber processes 1M+ location events/second from driver apps. Pattern: each city = separate Kafka cluster (data locality, compliance). This partitioned-by-geography model avoids cross-region latency and simplifies regulatory compliance.

> **📖 Real-World Example:** Netflix's pattern: Kafka → Flink (stream processing) → S3 → Spark batch. Decouple real-time ingestion from batch ML training. User activity events are ingested in real time via Kafka, enabling both real-time recommendations and offline model retraining from the same event stream.

> **📖 Real-World Example:** Shopify processes order events with fan-out to fraud detection, inventory, and analytics. Uses exactly-once with idempotent producer + consumer dedup because payment events must not be processed twice.

> **📖 Real-World Example:** Stripe uses Kafka as the backbone for their webhook delivery system. Pattern: Kafka → processor → HTTP delivery → retry on failure. Provides a durable queue for webhook retries and the ability to replay failed deliveries.

> **📖 Real-World Example:** DoorDash uses Kafka for real-time order routing, ETA calculation, and driver matching. Pattern: Kafka → Flink stateful stream processing → Redis (result cache). Flink's stateful processing is needed for the ETA models that join driver location streams with order state.

> **📖 Real-World Example:** Confluent (Kafka as a Service) manages Kafka for 4,000+ companies. Their key differentiator is Schema Registry, which prevents breaking changes in event contracts across teams and services.

### Common Anti-Patterns (What NOT to Do with Kafka)

```text
❌  Using Kafka as a database
    Message retention ≠ durable storage; no secondary indexes, no query language.

❌  Using Kafka for request-response (RPC)
    Kafka is a one-way data bus. For RPC patterns, use correlation ID + reply topic,
    but this adds complexity — REST or gRPC is almost always the right answer.

❌  Too many small topics
    Each topic-partition has overhead: memory, file handles, replication traffic.
    Prefer fewer, well-named topics with schemas over dozens of tiny ones.

❌  Not monitoring consumer lag
    Production-impacting lag goes undetected until customers complain.
    Set up per-partition lag alerts from day one.

❌  Using Kafka for small volumes where SQS/RabbitMQ would be simpler
    Kafka's operational burden is only worth it at scale or when you need replay.
    For simple task queues at low volume, SQS or RabbitMQ is the better choice.
```

> 🌍 **Real-World:** A well-known anti-pattern example: a Series B startup migrated from SQS to Kafka because "that's what LinkedIn uses." They had 50K events/day (vs. LinkedIn's 7 trillion/day). Running Kafka required a dedicated DevOps engineer to manage ZooKeeper, broker upgrades, and consumer lag monitoring. The engineering ROI was negative. They migrated back to SQS + Lambda 8 months later, cutting their messaging infrastructure cost by 90% and eliminating the dedicated ops burden. **Kafka is the right choice at scale or when you need replay; SQS is the right choice for simple decoupling at low-moderate volume.**

---

## Important Concepts Checklist — Kafka Internals

### Core model
- [ ] Log vs queue; retention + replay why Kafka exists
- [ ] Topic / partition / offset / consumer group
- [ ] Partition = unit of parallelism & ordering
- [ ] Keyed partitioning implications when changing partition count

### Producer
- [ ] Batching: `linger.ms`, `batch.size`
- [ ] `acks=0/1/all` durability tradeoffs
- [ ] Idempotent producer (`enable.idempotence`) + PID/sequence
- [ ] `min.insync.replicas` interaction with `acks=all`

### Consumer & rebalance
- [ ] Poll loop; `max.poll.interval.ms` vs `session.timeout.ms`
- [ ] Commit modes: auto vs manual; when to commit
- [ ] Eager vs cooperative rebalance; stop-the-world cost
- [ ] Static membership (`group.instance.id`) to reduce rebalances
- [ ] CooperativeStickyAssignor awareness

### Broker / replication
- [ ] Leader + ISR + HWM; what `acks=all` really means
- [ ] Page cache + zero-copy sendfile intuition
- [ ] Compaction vs deletion retention
- [ ] KRaft vs ZooKeeper (metadata quorum)

### Exactly-once
- [ ] Idempotent producer ≠ E2E exactly-once
- [ ] Transactions + fencing zombies
- [ ] `read_committed` / LSO lag
- [ ] When to use at-least-once + idempotent sink instead

### Ops
- [ ] Consumer lag debugging runbook
- [ ] Poison pill → DLQ pattern
- [ ] Schema Registry / compatibility (awareness)

> ⭐ **IMPORTANT CONCEPT:** Most Kafka production pain is **rebalances, lag, and commit semantics** — not "what is a topic."

---

## Practical Labs — Rebalance & Exactly-Once

### Lab 1 — Observe a Consumer Rebalance (local or staging)

> 🛠️ **PRACTICAL:** Run a 3-partition topic, 1 consumer; then start a 2nd consumer in the same group; watch logs for revoke/assign.

```bash
# Terminal A
kafka-console-consumer.sh --topic lab-events --group lab-g \
  --from-beginning --property print.offset=true

# Terminal B — start second member; A should revoke some partitions
# Same command with same --group lab-g

# Describe group
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group lab-g
```

**Write down:**
```text
[ ] Which partitions moved?
[ ] Did processing pause on A during revoke? (eager = yes)
[ ] How long until lag recovered?
```

### Lab 2 — Static Membership Drill

```text
1. Set group.instance.id=consumer-1 on member A; bounce A quickly
2. Compare rebalance frequency vs without static membership
3. Interview line: "Static membership avoids unnecessary rebalances on restart
   within session.timeout; cooperative sticky reduces stop-the-world."
```

### Lab 3 — Exactly-Once Lab (transactional path)

```text
Goal: consume from T_in, write to T_out exactly-once under fencing.

Steps:
  1. Producer: enable.idempotence=true; transactional.id=lab-txn-1
  2. beginTransaction → send → sendOffsetsToTransaction → commitTransaction
  3. Kill producer mid-transaction; restart with same transactional.id
  4. Confirm zombie fencing: old instance cannot commit
  5. Consumer on T_out: isolation.level=read_committed — no aborted msgs

Interview alternate (DB sink):
  at-least-once consume + idempotent upsert on business key + commit offset after sink
```

### Lab 4 — Lag Debug Game

```text
Inject: slow handler OR poison message on one partition key.
Use: kafka-consumer-groups.sh --describe
Decide: uniform lag (scale/optimize) vs skewed (hot key / poison)
Implement DLQ skip for poison; verify lag drains.
```

### Lab 5 — Semantics Flashcards (say out loud)

| Claim | True/False | Correction |
|-------|------------|------------|
| `acks=all` means all replicas in RF | | Means all in **ISR** |
| Idempotent producer = E2E EOS | | Only per-partition producer dedup |
| More consumers than partitions helps | | Idle consumers; parallelism capped by partitions |
| Auto-commit is fine for payments | | Prefer manual after sink success |

> 🛠️ **PRACTICAL:** If you can teach ISR + rebalance + "EOS to DB = idempotent sink" in 5 minutes, you are interview-ready on Kafka.
