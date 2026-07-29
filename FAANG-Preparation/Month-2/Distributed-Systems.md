# Distributed Systems — Complete Study Notes

> Self-contained. No internet needed. Every concept explained inline.
> Covers: CAP → Consensus → Clocks → Locking → Failure Modes → Real Systems

---

## Table of Contents

| # | Topic | Key Concepts | Real-World |
|---|-------|--------------|------------|
| [1](#1-what-is-a-distributed-system) | What Is a Distributed System | Fallacies, failure modes | Any microservice system |
| [2](#2-cap-theorem) | CAP Theorem | Consistency, Availability, Partition | DynamoDB (AP), ZooKeeper (CP) |
| [3](#3-pacelc--more-complete-model) | PACELC | Latency vs Consistency tradeoff | Cassandra tunable consistency |
| [4](#4-consistency-models-weakest--strongest) | Consistency Models | Eventual → Linearizable spectrum | DynamoDB vs Spanner |
| [5](#5-raft-consensus-algorithm) | Raft Consensus | Leader election, log replication | etcd, CockroachDB |
| [6](#6-paxos) | Paxos | Basic Paxos, Multi-Paxos | Chubby (Google), Zab (ZooKeeper) |
| [7](#7-gossip-protocol) | Gossip / SWIM | Failure detection, membership | Cassandra, Consul, Serf |
| [8](#8-vector-clocks) | Vector Clocks | Lamport clocks, causality | DynamoDB (deprecated), Riak |
| [9](#9-distributed-locking) | Distributed Locking | Redis SET NX, fencing, ZooKeeper | Payment systems, HBase |
| [10](#10-failure-modes-and-production-patterns) | Failure Modes | Split brain, clock drift, thundering herd | GitHub 2018, AWS 2021 |
| [11](#11-real-systems) | Real Systems | etcd, Cassandra, Google Spanner | Google Ads, Kubernetes, Netflix |
| [NEW](#real-world-distributed-systems-where-theory-meets-production) | **Real-World Examples** | **Where theory appears in production** | **All major companies** |
| [App](#interview-appendix-consensus-locks-failures) | **Interview Appendix** | Whiteboard Raft, locks, failure table | FAANG mocks |
| — | [Important Concepts Checklist](#important-concepts-checklist) | Self-test | — |
| — | [Practical Labs](#practical-labs) | Raft / fencing / CAP drills | — |

---

## 1. What Is a Distributed System?

**Basics**: Multiple independent nodes communicating over a network to appear as a single coherent system.

**Why it's hard — 8 Fallacies of Distributed Computing** (Peter Deutsch, 1994):
1. The network is reliable → Networks drop packets, have flaky links
2. Latency is zero → Network calls take 0.5ms–500ms, never zero
3. Bandwidth is infinite → You can saturate NICs and inter-DC links
4. The network is secure → Assume adversarial environments
5. Topology doesn't change → Nodes come and go, IPs change
6. There is one administrator → Multiple teams own different parts
7. Transport cost is zero → Serialization, encryption, retransmission all have CPU cost
8. The network is homogeneous → Mix of hardware, OS versions, library versions

**Key problems** that don't exist on a single machine:
- Partial failure: Node A fails while Node B continues. Neither knows the other's state
- No shared clock: You can't use wall clock for ordering events across nodes
- Network partition: Nodes can't communicate but haven't crashed

> 🌍 **Real-World:** The 2020 AWS us-east-1 outage demonstrated fallacy #1 at massive scale — an internal network misconfiguration caused packet loss between services, triggering cascading partial failures across Kinesis, CloudWatch, and Cognito because each service assumed the network was reliable and did not account for silent packet drops in their failure handling logic.

---

## 2. CAP Theorem

> ⭐ **IMPORTANT CONCEPT:** During a partition you choose Consistency **or** Availability — Partition tolerance is not optional.

**Basics**: In a distributed system that might experience network partitions, you can guarantee at most 2 of 3:
- **C — Consistency**: Every read returns the most recent write, or an error. Behaves like a single node
- **A — Availability**: Every request gets a response (not necessarily the latest data). No timeouts/errors
- **P — Partition Tolerance**: System continues operating despite network partition (message loss/delay)

**The real choice**: Partitions happen (it's not optional). So during a partition, choose:
- **CP**: Refuse requests until partition heals (return error). Consistent but unavailable
- **AP**: Serve potentially stale data during partition. Available but inconsistent

> ⭐ **IMPORTANT CONCEPT:** CAP is not "pick any 2 of 3." **P is mandatory** on real networks. The only real tradeoff is **C vs A during a partition**: refuse (CP) or serve possibly stale (AP). Saying "we're CA" for a multi-node system is a red flag in interviews.

| System | CAP Choice | Behavior During Partition |
|--------|-----------|--------------------------|
| ZooKeeper | CP | Refuses writes if can't confirm majority |
| etcd | CP | Refuses writes if can't confirm majority |
| Cassandra | AP | Serves possibly stale data |
| DynamoDB | AP | Serves possibly stale data |
| Single-node PostgreSQL | CA | Not a distributed system |

> **⚠️ Common Misunderstanding:** CAP doesn't say "pick 2." P is not optional. The tradeoff is C vs A DURING a partition.

> 🌍 **Real-World:** DynamoDB is a textbook AP system — during the 2019 DynamoDB availability event, some tables continued serving reads (possibly stale) rather than returning errors, prioritizing availability. ZooKeeper is the opposite: Kafka (pre-KRaft) used ZooKeeper as its CP metadata store — during a ZooKeeper leader election, Kafka brokers would refuse topic metadata updates (briefly unavailable) rather than risk serving inconsistent partition-leader information to producers.

---

## 3. PACELC — More Complete Model

> ⭐ **IMPORTANT CONCEPT:** PACELC completes CAP: **if Partition → A vs C; Else → Latency vs Consistency**. Spanner is PC/EC (always consistent, pay latency). Dynamo/Cassandra default PA/EL (available + low latency, reconcile later). Tunable systems (Cassandra CL) move between points on this spectrum per query.

**During Partition**: A vs C (same as CAP)
**Else (normal operation)**: Latency vs Consistency

| System | PA/EL or PC/EC | During Partition | Normal Operation |
|--------|---------------|-----------------|-----------------|
| DynamoDB | PA/EL | Available | Low latency (eventual consistency) |
| Google Spanner | PC/EC | Consistent | Consistent (higher latency) |
| Cassandra | PA/EL (default, tunable) | Available | Low latency (tunable) |
| MySQL single-node | — / EC | No partition possible | Consistent, higher latency than eventual |

> 🌍 **Real-World:** Cassandra's PACELC tradeoff is explicitly tunable per query — Cassandra with `consistency_level=ONE` is PA/EL (write to one replica and return; lowest latency, eventual consistency), while `consistency_level=QUORUM` is closer to PC/EC (wait for majority, consistent but higher latency). Netflix uses `LOCAL_QUORUM` for their viewing history writes to get strong consistency within a region while still getting low latency by not requiring cross-region coordination.

---

## 4. Consistency Models (Weakest → Strongest)

**Eventual Consistency**: Given no new updates, all replicas converge eventually. No timing guarantee.
- Good for: like counts, view counts, DNS propagation, shopping cart totals
- Bad for: bank balances, inventory, anything with mutual exclusion invariants

> 🌍 **Real-World:** AWS S3 (pre-2020) used eventual consistency for overwrites — a PUT followed immediately by a GET might return the old version from a different replica. After December 2020, S3 upgraded to strong read-after-write consistency. DNS is the canonical eventual-consistency example: a DNS record change propagates to all resolvers within the TTL window, meaning traffic gradually shifts over minutes to hours rather than instantaneously.

**Monotonic Read**: Once you read value X, you'll never read an older value in the same session.
- Solved by: sticky sessions, session tokens pinned to a replica

**Read-Your-Writes**: After you write, your subsequent reads see that write.
- Solved by: route reads to primary after writes, or wait for replication before redirecting

> 🌍 **Real-World:** Facebook's social graph uses read-your-writes consistency for the posting user — when you post a status update, your browser is briefly pinned to the primary replica so you always see your own post appear immediately. Other users may see it slightly later as the write propagates to read replicas, but the author never experiences the confusing "my post disappeared" bug.

**Causal Consistency**: Causally related operations seen in same order by all nodes. Concurrent operations may be seen in any order.
- "You see my reply after seeing my original message"
- Implemented with vector clocks or causal tokens

**Sequential Consistency**: All nodes see operations in the same total order. That order may not match real time.

**Linearizability** (strongest): Every operation appears to happen atomically at some point between its start and completion. Respects real-time ordering.
- Required for: distributed locks, compare-and-swap, single-value consensus
- Cost: high latency (need quorum acknowledgement)
- Used by: etcd, ZooKeeper, Google Spanner

> **💡 Key Insight:** Linearizability is the gold standard for correctness — it makes a distributed system behave exactly like a single-node system from the caller's perspective. Everything weaker is a deliberate tradeoff for latency or availability.

> 🌍 **Real-World:** etcd provides linearizable reads by default for Kubernetes — when the kube-scheduler writes a pod binding (assigning a pod to a node), the subsequent read by the kubelet must see that binding. Without linearizability, two schedulers could both read "pod unbound," both assign it to different nodes, and the pod would run twice. The latency cost (~0.5ms same-DC round trip for quorum ack) is acceptable for control-plane operations.

---

## 5. Raft Consensus Algorithm

> ⭐ **IMPORTANT CONCEPT:** Raft = leader election + log replication + safety — enough depth for most FAANG whiteboard consensus questions.

### Why Consensus?

When multiple replicas must all agree on the same value (leader election, log ordering), you need consensus. Without it: split brain — two nodes think they're primary, both accept writes → diverged state.

### Roles

- **Leader**: handles ALL client requests. Exactly one per term. Sends heartbeats to prevent new elections
- **Follower**: passive. Responds to leader and candidates. Has election timeout (150–300ms random)
- **Candidate**: campaigning for leadership after election timeout fires

### Terms

- Logical time unit. Each term starts with an election
- Monotonically increasing integer. Higher term = more recent authority
- If node sees higher term than its own → update term, revert to follower
- If node sees message with lower term → reject it

### Leader Election — Step by Step

> ⭐ **IMPORTANT CONCEPT:** Raft safety in one sentence: **only a candidate with a log at least as up-to-date as a majority can win**, and **an entry is committed only after a majority has it**. Election + log completeness + majority overlap ⇒ committed entries are never lost. Be ready to whiteboard both election and AppendEntries on a 3-node cluster.

```text
1. All start as followers
2. Election timeout fires (random 150–300ms to prevent ties)
3. Follower becomes Candidate:
   - Increments currentTerm
   - Votes for itself
   - Resets election timer
   - Sends RequestVote(term, candidateId, lastLogIndex, lastLogTerm) to ALL nodes

4. Node grants vote IF ALL of:
   - candidate.term >= voter.currentTerm
   - voter hasn't voted in this term yet
   - candidate's log is at least as up-to-date as voter's log:
     (candidate.lastLogTerm > voter.lastLogTerm) OR
     (same term AND candidate.lastLogIndex >= voter.lastLogIndex)

5. Candidate gets majority votes (N/2+1) → becomes Leader
   - Immediately sends AppendEntries heartbeat to all → prevents new elections

6. Split vote: nobody wins → wait for next timeout (random) → try again with higher term
```

The log completeness check (step 4 last bullet) is the SAFETY guarantee: a node with stale log cannot win — it can't collect votes from any node that has more up-to-date log.

### Log Replication — Step by Step

> 🛠️ **PRACTICAL:** In interviews, narrate: append locally → parallel AppendEntries → majority ack → commitIndex advances → apply → reply to client → piggyback commitIndex so followers apply. Never say "leader writes then tells followers" without majority commit.
```text
1. Client sends command to Leader
2. Leader appends to local log: entry = {index, term, command}
   (NOT yet committed — just appended)
3. Leader sends AppendEntries(term, leaderId, prevLogIndex, prevLogTerm,
                              entries[], leaderCommitIndex) to ALL followers in parallel
4. Each Follower:
   - Checks prevLogIndex + prevLogTerm: must match its own log
   - If mismatch → reject (Leader decrements nextIndex for this follower and retries)
   - If match → append new entries, respond success
5. Leader receives success from majority (including self) → entry is COMMITTED
6. Leader applies to state machine → responds to client
7. Leader includes commitIndex in next AppendEntries → followers apply committed entries
```

### Log Matching Property

If two logs agree at index i (same index AND same term), then:
- All entries before i are identical in both logs

This is proved inductively: AppendEntries rejects if prevLogIndex/prevLogTerm doesn't match.

### Safety: Why Committed Entries Are Never Lost

- Entry committed → majority has it
- New leader elected → must get votes from majority
- Any two majorities overlap by at least one node
- That overlapping node has the committed entry
- Overlapping node won't vote for candidate with less up-to-date log
- Therefore: any new leader has all committed entries ✓

### Membership Changes

Adding/removing nodes. Naive approach (switch all at once) creates a window where two different majorities could both make progress (split brain). Solutions:
- **Single-server changes** (etcd approach): only add/remove one node at a time. At any point, old and new configurations' majorities must overlap
- **Joint consensus**: transition through a joint configuration requiring both old AND new majority (more complex, used by original Raft paper)

### Raft in Production

- **etcd**: Kubernetes uses etcd for all cluster state. 3 or 5 node etcd cluster. If majority down → cluster read-only
- **CockroachDB**: each range (64MB shard) is an independent Raft group
- **TiKV**: same — per-region Raft
- **Consul**: leader election + KV store

> **📖 Real-World Example:** Latency is ~RTT to majority per write. Same-DC: ~0.5ms commit. Cross-region: 50–150ms commit — very expensive for write-heavy workloads.

> 🌍 **Real-World:** CockroachDB runs one Raft group per 64MB range of data — a 640GB table has ~10,000 independent Raft groups, each electing its own leader. This means a single slow node doesn't block the entire database; only the Raft groups whose leader is on that node are affected. When CockroachDB adds a node for scaling, it simply moves Raft leadership for some ranges to the new node without any downtime or global coordination.

---

## 6. Paxos

### Basic Paxos (single value consensus)

Roles: Proposers, Acceptors, Learners

#### Phase 1 — Prepare

```text
Proposer picks n (unique, monotonically increasing: timestamp + node_id)
Sends Prepare(n) to majority of Acceptors

Acceptor receives Prepare(n):
  if n > my_highest_promised:
    my_highest_promised = n
    reply Promise(n, highest_accepted_value, highest_accepted_n)
    // Promise: "I won't accept proposals with number < n"
  else:
    ignore (or send Nack)
```

#### Phase 2 — Accept

```text
Proposer receives Promise from majority:
  if any promise contained accepted_value:
    must use the value from the promise with highest accepted_n
  else:
    can use any value

Sends Accept(n, chosen_value) to Acceptors

Acceptor receives Accept(n, v):
  if n >= my_highest_promised:
    accept it, notify Learners
  else:
    reject
```

> **⚠️ Common Misunderstanding:** Liveness problem — two proposers can livelock — each keeps preempting the other:
> - A sends Prepare(1), B sends Prepare(2) → A's promise invalidated
> - A sends Prepare(3), B's promise invalidated
> - B sends Prepare(4)... forever
>
> Fix: elect a stable leader (→ Multi-Paxos)

> 🌍 **Real-World:** Google's Chubby distributed lock service (the predecessor to ZooKeeper) is built on Multi-Paxos — Google uses Chubby as the foundation for distributed coordination across their entire infrastructure, from GFS master election to Bigtable tablet server coordination. Google's Spanner also uses a Paxos variant (with leaders) for each Paxos group managing a shard of data, providing the strong consistency that powers Google Ads and Google Cloud services globally.

### Multi-Paxos

Leader runs Phase 1 once with very high n, establishing authority across ALL future log slots. For each new command: only Phase 2 needed. Equivalent to Raft but less precisely specified.

---

## 7. Gossip Protocol

**Basics**: Each node periodically selects random peers and exchanges state. Like spreading a rumor.

### How It Works

```text
Every T seconds (typically 1s):
  1. Node picks k random peers
  2. Sends its state (membership list, key-value updates)
  3. Receiver merges: takes element-wise max of vector clocks
  4. Receiver responds with its state
  5. Both nodes now have merged state
```

> **💡 Key Insight:** Convergence is O(log N) rounds for information to reach all N nodes. With N=1,000 and fanout=3: ~7 rounds → all nodes have the update. Mathematical model: each round multiplies infected nodes by (1 + fanout).

> 🌍 **Real-World:** Apache Cassandra gossips every second with 3 random peers — a schema change (adding a column) propagates to all 1,000 nodes in a cluster within ~7 seconds without any central coordinator. This is how Cassandra achieves "leaderless" schema propagation: there is no schema master; each node eventually learns the change through gossip. Amazon's Dynamo paper described a similar gossip-based membership protocol where node failures detected by gossip trigger automatic data rebalancing.

### SWIM Failure Detection (used by Cassandra, HashiCorp Serf)

```text
1. Every T_probe seconds, probe a random member (direct ping)
2. If no ack within T_ack:
   → indirect probe: ask k other members to ping the suspect
3. If no indirect ack within T_indirect:
   → mark suspect (spread SUSPECT gossip)
4. If suspect persists past T_suspect:
   → mark DEAD, remove from membership list
5. If suspected node recovers:
   → broadcasts ALIVE message with incarnation number
```

False positive rate: controlled by T_ack, T_indirect, k. Increasing k reduces false positives at cost of more messages.

**Used by**: Cassandra (membership, failure detection), Redis Cluster, Consul, Serf

> 🌍 **Real-World:** HashiCorp Serf uses SWIM for cluster membership in Consul — when a Consul server in a 1,000-node cluster goes down, SWIM detects the failure within ~5 seconds via indirect probing (3 random peers each try pinging the suspect), marks it DEAD, and gossips that status to all nodes within ~7 seconds. This prevents false positives from transient network blips: a node is only marked DEAD after failing both direct and indirect probes, reducing the rate of "split brain" membership view.

---

## 8. Vector Clocks

### Lamport Clock (Basics)

A logical clock that enables causal ordering without wall clocks.

**Rules**:
1. Each process P has counter L (starts at 0)
2. Before each event: L++
3. Before sending: L++, attach L to message
4. On receiving message with timestamp T: L = max(L, T) + 1

**Guarantee**: A → B (A causally precedes B) ⟹ L(A) < L(B)
**Does NOT guarantee**: L(A) < L(B) ⟹ A → B (could be coincidence)

```text
Process P1:    1, 2, 3 ──send(3)──→
Process P2:              1, max(1,3)+1=4, 5 ──send(5)──→
Process P3:                               1, max(1,5)+1=6
```

> 🌍 **Real-World:** Apache Kafka uses a logical clock concept for offset ordering within a partition — each message gets a monotonically increasing offset (analogous to a Lamport timestamp), ensuring that any consumer reading from offset N has seen all prior messages. This is weaker than a full Lamport clock (it only orders within a partition, not across topics), but it provides the causal ordering guarantee that a consumer sees messages in the order a producer sent them.

### Vector Clock

Detects concurrent events — tells you whether two events are causally related or concurrent.

**Structure**: Each process Pi has vector V where V[j] = Pi's knowledge of how many events Pj has done.

**Rules**:
1. Initialize: V = [0, 0, ..., 0] (size = number of processes)
2. Local event on Pi: V[i]++
3. Send from Pi: V[i]++, attach V to message
4. Receive at Pj with timestamp T:
   - V[k] = max(V[k], T[k]) for ALL k
   - V[j]++

**Comparison**:
- VC(A) < VC(B): A happened-before B — every element A[k] ≤ B[k] AND at least one strictly less
- VC(A) || VC(B) concurrent: neither A < B nor B < A. ∃k1: A[k1] > B[k1] AND ∃k2: A[k2] < B[k2]

```text
Example with 3 processes:
     P1          P2          P3
[1,0,0]
send──→     [1,1,0]
            [1,2,0]
            send──────→  [1,2,1]
[2,0,0]                  [1,2,2]  ← concurrent with P1[2,0,0]!
                                    Neither dominates → need conflict resolution
```

> **📖 Real-World Example:** Amazon DynamoDB's original design used vector clocks for version tracking of items. This was later deprecated in favor of "last-write-wins" to reduce client complexity. Riak still uses vector clocks for conflict detection in its distributed key-value store.

> 🌍 **Real-World:** Riak uses vector clocks (called "vclocks") to detect when two clients have concurrently updated the same key on different replicas — rather than silently discarding one update, Riak surfaces both versions (siblings) to the application, which can then resolve the conflict using domain logic (e.g., a shopping cart application merges items from both carts). This is more correct than last-write-wins for cases where both concurrent writes contain valid information.

---

## 9. Distributed Locking

> ⭐ **IMPORTANT CONCEPT:** A lock without fencing tokens is unsafe under GC pauses / network delays — always pair lease locks with fencing.

**Why hard**: lock holder can crash holding lock; partition can cause two nodes to each believe they hold the lock; TTL requires synchronized clocks.

### Single Redis Instance

```bash
SET lock_key unique_uuid NX EX 30
# NX: only set if not exists (atomic acquire)
# EX 30: auto-release after 30s if holder crashes
# unique_uuid: prevents accidental release by other clients
```

Release (MUST be atomic check-and-delete):

```lua
-- Lua script runs atomically in Redis
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
```

**Problem**: Redis crash or partition → two clients can acquire same lock.

> 🌍 **Real-World:** Shopify uses Redis-based distributed locks for flash sale inventory — when 10,000 users simultaneously click "buy" for a limited-edition product with only 100 units remaining, each purchase request acquires a Redis lock on the product SKU, decrements inventory atomically, and releases the lock. The `EX 30` TTL ensures that if an app server crashes mid-purchase, the lock auto-releases within 30 seconds rather than hanging forever.

### Fencing Token (Correct Approach — Martin Kleppmann)

> ⭐ **IMPORTANT CONCEPT:** A distributed lock **without fencing is broken**. GC pauses / network delays can let a "zombie" holder keep writing after TTL expiry. The storage layer must reject stale **fencing tokens** (monotonic epoch). Lock lease alone is necessary but not sufficient.

```text
1. Lock service issues monotonically increasing fencing token on each lock grant
   Token 1 → Client A acquires lock
   Token 2 → Client B acquires lock (after A's token expired/revoked)

2. Client includes token in every write to shared resource:
   Client A (stale): write(data, token=1) → REJECTED (last seen token was 2)
   Client B (current): write(data, token=2) → ACCEPTED

3. Shared resource rejects writes with stale tokens
```

This works even if Client A pauses (GC, slow network) and comes back after lock was given to B.

> 🌍 **Real-World:** Apache HBase uses fencing tokens (called "epoch numbers") for region server coordination — when a region server is considered dead and its regions are reassigned to another server, HBase increments the epoch. If the "dead" server recovers and tries to write (it was just GC-paused, not actually dead), its writes are rejected by the storage layer because they carry the old epoch number, preventing data corruption from a "zombie" region server.

### ZooKeeper Ephemeral Sequential Nodes

```text
Create: /locks/resource/lock-0000000001  (ephemeral + sequential)
// Ephemeral: deleted when client's ZK session expires (heartbeat stops)
// Sequential: ZK appends incrementing suffix

Algorithm:
1. Create ephemeral sequential node under /locks/resource/
2. Get all children, sort
3. If your node is smallest → you hold the lock
4. Otherwise → watch the next-smallest node for deletion
5. When it's deleted → check again if you're smallest
```

> **💡 Key Insight:** ZooKeeper ephemeral nodes give you fair (FIFO ordering), automatically released on crash (session timeout ~10–30s), and strong linearizability — all properties that make it the correct choice for distributed locking in high-stakes systems.

> 🌍 **Real-World:** Kafka (pre-KRaft) used ZooKeeper ephemeral nodes for broker leadership — each broker creates an ephemeral node at startup, and the broker holding the `/controller` ephemeral node is the Kafka controller. When that broker crashes, ZooKeeper's session timeout (~15s) deletes the ephemeral node, triggering a controller election among all remaining brokers who race to create a new `/controller` node. This automatic failover happens without any human intervention.

---

## 10. Failure Modes and Production Patterns

### Split Brain

> ⭐ **IMPORTANT CONCEPT:** Split brain = two primaries accepting writes → divergent histories. Mitigate with **quorum**, **fencing tokens**, and optionally **STONITH**. Auto-failover without fencing is how GitHub-style dual-master disasters happen.

Two nodes each believe they're primary. Both accept writes → data divergence.
**Prevention**: quorum writes (majority must acknowledge), fencing tokens, STONITH (Shoot The Other Node In The Head — force-reboot suspected primary)

> 🌍 **Real-World:** The GitHub 2012 MySQL incident is the canonical split-brain example — the primary MySQL server went down and auto-failover promoted a replica. When the network partition healed, both servers thought they were primary and had accepted divergent writes for several hours. Recovery required a manual, painstaking merge of 15 hours of divergent data. This incident drove the adoption of fencing tokens and quorum-based writes across the industry.

### Clock Drift

NTP corrects over minutes but clocks can drift ±100ms momentarily. Never use wall clock for ordering events in distributed systems.

> **📖 Real-World Example:** Google TrueTime (Spanner) uses GPS + atomic clocks to give a time interval [earliest, latest]. Commit waits until TT.now().earliest > commit timestamp. This guarantees external consistency globally — a breakthrough that enabled Spanner's linearizable global transactions.

> 🌍 **Real-World:** Google TrueTime exposes uncertainty bounds: `TT.now()` returns `[earliest, latest]` instead of a single timestamp, where the interval is typically ±4ms. Spanner's commit wait — holding a transaction open until `TT.now().earliest` exceeds the commit timestamp — means that any transaction starting after the commit is guaranteed to see it, even across data centers. This eliminates the "causality violation" that plagues systems relying on NTP-synchronized clocks.

### Retry Amplification

N services, each retrying 3x = 3^N requests at leaf. At 5 layers: 243x amplification.

**Fix**: exponential backoff with full jitter:

```python
sleep = random.uniform(0, min(cap, base * 2**attempt))
# cap = max sleep, base = initial sleep, attempt starts at 0
```

**Retry budget**: limit retries to X% of total requests. Prevents cascade during outage.

> 🌍 **Real-World:** Amazon's AWS SDK enforces a retry budget — by default, retries are capped at a percentage of total inflight requests, so that during a partial outage, retry traffic doesn't exceed the budget and crowd out new requests. Google SRE documented "retry storms" at Google as one of the top causes of cascading failures; their solution is to use retry budgets at each RPC layer rather than unlimited per-call retries.

### Cascading Failure

Service A slow → B waits → B thread pool exhausted → B slow → C waits → cascade.

**Prevention**:
1. **Timeouts** (ALWAYS set): don't wait indefinitely for downstream
2. **Circuit breaker**: after N failures, fail fast for T seconds
3. **Bulkhead**: separate thread pools per downstream dependency
4. **Load shedding**: drop low-priority requests under high load
5. **Backpressure**: signal upstream to slow down

> 🌍 **Real-World:** Netflix's Hystrix thread-pool bulkhead pattern gives each downstream dependency its own bounded thread pool — if the recommendation service thread pool fills up (service is slow), it cannot consume threads meant for the playback service. Without bulkheads, a single slow downstream can exhaust the shared thread pool and take down all downstream calls. Netflix reports this pattern has prevented dozens of cascading failures from becoming full outages.

### Thundering Herd

After outage, all clients reconnect simultaneously → overwhelm recovering service.

**Fix**: random jitter in reconnect delay:

```python
delay = base_delay * (2**attempt) + random.uniform(0, jitter)
```

> 🌍 **Real-World:** Slack experienced a thundering herd after a brief WebSocket gateway outage in 2015 — all 1M+ connected clients detected the disconnect and simultaneously attempted to reconnect within the same 1-second window, generating 10× normal connection rate and crashing the recovering gateway. They fixed this by adding full jitter to client reconnect logic: each client waits a random duration between 0 and 30 seconds before reconnecting, spreading the reconnect storm over minutes rather than seconds.

### Idempotency

Operations safe to retry. Required whenever retry is possible (which is always in distributed systems).

**Techniques**:
- Idempotency keys: client-generated UUID, server deduplicates
- Optimistic locking: version field, reject if version mismatch
- Natural idempotency: upsert instead of insert, SET instead of INCREMENT

> 🌍 **Real-World:** Stripe's API uses idempotency keys for all payment operations — a client generates a UUID, attaches it as `Idempotency-Key: <uuid>` to a `POST /charges` request, and if the network fails before the response arrives, the client can safely retry with the same key. Stripe's servers deduplicate on the key, returning the original response for up to 24 hours. This prevents double-charges even in the face of network failures, load balancer timeouts, or client crashes.

---

## 11. Real Systems

### etcd (used by Kubernetes)

- 3 or 5 node cluster using Raft consensus
- Stores all Kubernetes cluster state (pods, services, secrets, configmaps)
- Strongly consistent: writes go through Raft leader → majority → committed
- Watch API: clients subscribe to key changes → notifications. Used by kube-apiserver for controller loop
- Performance: ~10,000 writes/sec per cluster. Disk latency is critical (use SSDs)
- Backup: critical. Losing etcd without backup = losing entire Kubernetes cluster

> 🌍 **Real-World:** Every production Kubernetes cluster at every major company runs on etcd — AWS EKS, Google GKE, and Azure AKS all use managed etcd as the backing store for all cluster state. When Cloudflare's etcd cluster experienced high disk latency in 2019, their entire Kubernetes control plane slowed to a crawl because every API server write had to wait for slow disk I/O on etcd nodes; the fix was migrating etcd to NVMe SSDs, reducing write latency from 20ms to 0.5ms and restoring normal cluster operations.

### Cassandra

- Ring topology, consistent hashing
- RF (Replication Factor): how many nodes store each partition's data
- Tunable consistency: ONE, QUORUM (R + W > RF = strong), ALL, LOCAL_QUORUM
- Write path: coordinator → all replica nodes for that partition key in parallel
- Read path: coordinator → quorum of replicas → latest version (by timestamp)
- Gossip: nodes exchange membership and schema state every second
- Compaction: merge SSTables to remove tombstones, maintain sorted order
- Anti-entropy: Merkle tree comparison between replicas to detect divergence

> 🌍 **Real-World:** Apple uses Cassandra to store iCloud data for 850M+ users — with RF=3 across 3 data centers and `LOCAL_QUORUM` consistency, iCloud reads are always served from at least 2 replicas in the local data center, providing both fault tolerance and low latency. Discord uses Cassandra for message storage and has processed trillions of messages — their public post-mortem describes how they migrated from RF=2 to RF=3 to eliminate data loss risk during node failures, which became critical as their message volume grew past 100M messages per day.

### Google Spanner

- Globally consistent relational database (externally serializable)
- Uses TrueTime API (GPS + atomic clocks) to get time with known uncertainty bounds
- Commit wait: commit timestamp = TT.now() + ε. Server waits until TT.after(commit_ts) before responding
- This ensures any transaction starting after the commit sees the committed data
- Result: global strong consistency with ~7ms average commit latency

> 🌍 **Real-World:** Google Ads runs on Spanner — before Spanner, Google Ads used 5 separate MySQL databases across 5 data centers, and synchronizing ad spend data across regions required 2PC (two-phase commit) which added hundreds of milliseconds of latency and frequently deadlocked. Spanner replaced this with a single globally consistent database: ad campaigns can be modified in one region and read consistently in another within ~7ms, enabling accurate real-time budget pacing across all global ad serving.

---

## Real-World Distributed Systems (Where theory meets production)

#### Raft in Production

```text
etcd: used by every Kubernetes cluster for storing all cluster state
  (pod specs, service configs, secrets). Must never lose data → acks=quorum.
CockroachDB: uses Raft per range (32MB data chunks) for distributed SQL.
Consul: Raft for service registry consistency across data centers.
```

#### Split Brain in Production

```text
GitHub 2012 incident: MySQL Master went down, auto-failover to replica.
Network partition healed → both thought they were master → 15h outage.
Fix: fencing tokens (monotonically increasing epoch number prevents stale master writes).
```

#### CAP in Practice

| Category | Systems | Behavior During Partition | Why |
|----------|---------|--------------------------|-----|
| CP | HBase, ZooKeeper, etcd | Refuse writes | Correctness > availability. Used for config, locks, coordination |
| AP | Cassandra, DynamoDB | Accept writes, reconcile later | Availability > consistency. Used for user activity, shopping carts |

#### CRDT in Production

```text
Redis CRDT (Redis Enterprise): conflict-free replication across DCs.
Riak: used G-Counter / OR-Set CRDTs for shopping carts (add item is safe to merge).
Figma: uses OT (Operational Transformation, related to CRDTs) for real-time collaboration.
Apple Notes: uses CRDTs for offline-first sync across devices.
```

> 🌍 **Real-World:** Figma's multiplayer collaboration engine uses Operational Transformation to handle concurrent edits from thousands of users on the same design file — when two users simultaneously move the same element, OT transforms one user's operation relative to the other's so that both clients converge to the same final state. Apple Notes uses CRDTs for offline-first sync: edits made on an iPhone while offline are represented as CRDT operations that merge cleanly with changes made on a Mac, without requiring a central conflict-resolution step.

#### Vector Clocks in Production

```text
Amazon DynamoDB (original): used vector clocks for version tracking of items.
  Deprecated in favor of "last-write-wins" to reduce client complexity.
Riak: still uses vector clocks for conflict detection in distributed key-value store.
```

#### Google Spanner in Production

```text
Google Ads uses Spanner for ad campaign data — needs global strong consistency.
Google Cloud SQL (now rebranded): Spanner as managed service.
F1 (Google's distributed SQL): powers Google Ads → rebuilt on Spanner.
Why: AdWords had 5 DBs in 5 DCs — synchronizing with 2PC was too slow.
  TrueTime + Spanner = linearizable global transactions at scale.
```

#### ZooKeeper in Production

```text
Apache Kafka (pre-KRaft): used ZooKeeper for broker coordination, leader election.
HBase: uses ZooKeeper for region server coordination and master election.
Hadoop YARN: uses ZooKeeper for ResourceManager high availability.
Limitation: ZooKeeper becomes bottleneck at large scale (Kafka moved to KRaft).
```

> 🌍 **Real-World:** Kafka's migration from ZooKeeper to KRaft (Kafka Raft) was driven by ZooKeeper becoming a scalability bottleneck at large deployments — ZooKeeper struggled to manage clusters with more than 200,000 partitions because every partition state change required a ZooKeeper write. KRaft replaced ZooKeeper with a Raft-based metadata quorum built directly into Kafka, eliminating the external dependency and allowing clusters with millions of partitions.

#### Gossip Protocol in Production

```text
Cassandra: every node gossips with 3 random nodes per second.
  Used for: membership (who's alive), schema changes, token ring ownership.
DynamoDB: similar gossip-based membership (Amazon's Dynamo paper).
Serf (HashiCorp): SWIM-based gossip for cluster membership in Consul.
```

> 🌍 **Real-World:** Netflix uses Eureka with a gossip-inspired self-preservation mode — when Eureka detects it is not receiving enough heartbeats (which could mean network partition rather than mass failure), it stops evicting instances from its registry. This ensures that during a network partition between Eureka and its clients, services can still discover each other using potentially stale but better-than-nothing registration data, choosing availability over strict consistency in line with AP system design.


---

## Interview Appendix: Consensus, Locks, Failures

### Consensus Interview Whiteboard Script (12–15 min)

Use this exact verbal script in mock interviews. Draw 3 nodes: A, B, C.

```text
0. Setup (30s)
   "Three nodes, Raft. Need agreement on a replicated log for config/locks.
    Safety over liveness under partition."

1. Steady state (1 min)
   "A is leader for term 5. Heartbeats = empty AppendEntries.
    Followers reset election timeout on heartbeat."

2. Leader crash (2 min)
   "A dies. B's timeout fires first (randomized 150–300ms).
    B → Candidate, term 6, votes for self, RequestVote to C.
    C grants vote if: term ok, hasn't voted, B's log ≥ C's log.
    Majority (2/3) → B leader. Sends heartbeat immediately."

3. Client write (3 min)
   "Client → B: SET x=1.
    B appends {index, term=6, cmd} locally (uncommitted).
    Parallel AppendEntries to C (and self counts).
    Majority success → commitIndex advances → apply → ACK client.
    Next heartbeat carries commitIndex so followers apply."

4. Partition / split vote (2 min)
   "If B and C both timeout → split vote → no majority → new term retry.
    Randomization makes repeated ties unlikely."

5. Safety punchline (1 min)
   "Committed ⇒ on majority. New leader needs majority votes.
    Majorities intersect ⇒ committed entries cannot be lost.
    Log up-to-date check blocks stale candidates."

6. Compare to Multi-Paxos (1 min)
   "Same idea: stable leader amortizes Prepare. Raft specifies leadership
    + log more tightly — easier to implement and teach."
```

> ⭐ **IMPORTANT CONCEPT:** Interviewers grade the **majority + log completeness + commit before ACK** story more than memorizing RPC field names.

> 🛠️ **PRACTICAL:** Practice drawing AppendEntries rejection (prevLogIndex/term mismatch) and leader decrementing `nextIndex` — that's the recovery path seniors are expected to know.

---

### Raft vs Paxos — Interview Comparison

| Topic | Raft | Paxos (Basic / Multi) |
|-------|------|------------------------|
| Goal | Replicated log + leader | Agree on values / log slots |
| Understandability | Designed to be teachable | Historically hard to get right |
| Leader | Strong single leader per term | Multi-Paxos elects stable proposer |
| Election | Randomized timeouts + votes | Prepare phase with proposal numbers |
| Replication | AppendEntries + commitIndex | Accept phase per slot (Multi-Paxos) |
| Membership | Single-server / joint consensus | Cluster membership variants |
| Production | etcd, Consul, Cockroach ranges, TiKV | Chubby, Spanner groups (Paxos lineage) |
| Liveness risk | Split votes (mitigated by randomness) | Dueling proposers (mitigated by leader) |
| What to say | "I'd implement Raft" | "Paxos is the theory; Raft is the engineering spec" |

**One-liner for interviews:**
> "Paxos proves consensus is possible; Raft is the algorithm I'd ship — explicit leader, term, and log matching rules that map cleanly to etcd."

**When Paxos still comes up:** Google papers, Chubby, Spanner. Know Basic Paxos two phases (Prepare/Accept) and that Multi-Paxos ≈ Raft with messier specification.

---

### Practical Scenario — Design a Distributed Lock Service (30 min)

**Requirements prompt:** "Design a lock service for microservices. Locks auto-release on crash. Must not allow two holders to mutate the same row."

#### Step 1 — Clarify (3 min)
```text
- Scope: advisory locks for critical sections (payments, inventory)
- TTL vs session-based?
- Throughput: 10K lock ops/sec? Cross-region?
- Correctness: fencing required? (YES — always say yes)
```

#### Step 2 — Naive Redis SET NX EX (and why incomplete)
```text
SET resource:lock <uuid> NX EX 30
Release via Lua check-and-del
Problems: Redis failover / pause → two clients; no fencing at storage
```

#### Step 3 — Correct architecture
```text
┌─────────┐     acquire      ┌──────────────────┐
│ Client  │ ───────────────► │ Lock Service     │
│         │ ◄─ token=42 ───  │ (etcd / ZK /     │
└────┬────┘                  │  Raft quorum)    │
     │ write(row, token=42)  └──────────────────┘
     ▼
┌──────────────────┐
│ Storage / DB     │  rejects token < last_seen_token
└──────────────────┘
```

#### Step 4 — API sketch
```text
Acquire(resource, ttl, holder_id) → {fencing_token, lease_id} | error
Renew(lease_id) → ok | error
Release(lease_id, holder_id) → ok | error

Storage.Write(key, value, fencing_token) → ok | StaleToken
```

#### Step 5 — Implementation choices

| Backend | Pros | Cons |
|---------|------|------|
| etcd lease + key | Linearizable, Raft, TTL leases | Ops cost; latency = RTT to quorum |
| ZooKeeper ephemeral sequential | FIFO fairness, session expiry | Heavy dependency; ZK ops expertise |
| Redis + Redlock | Fast | **Controversial**; still need fencing at storage |
| Chubby-style | Proven | Not generally available |

> ⭐ **IMPORTANT CONCEPT:** The lock service grants leases + **monotonic fencing tokens**; the **data plane** enforces tokens. Without storage-side fencing, GC pauses break you.

#### Step 6 — Failure drills while designing
```text
- Holder GC pause past TTL → token 5 writer rejected after token 6 issued
- Lock service minority partition → Acquire fails closed (CP)
- Clock skew → don't use wall clock for correctness; use lease + Raft time
- Double release / steal → check holder_id + lease_id
```

> 🛠️ **PRACTICAL:** End the design by saying: "I'd use etcd leases for CP locking and require every write to carry the fencing token."

---

### Failure Mode Table (with Mitigations)

| Failure Mode | What Happens | User-Visible Symptom | Mitigation |
|--------------|--------------|----------------------|------------|
| Network partition | Majority/minority islands | CP: errors; AP: stale reads | Quorum; choose CAP stance explicitly |
| Split brain | Two primaries accept writes | Silent divergence, hard repair | Quorum + fencing / STONITH |
| Slow / GC zombie | Old primary wakes up | Overwrites newer data | Fencing tokens / epochs |
| Clock drift | Wrong TTL / order | Premature unlock, causality bugs | Logical clocks; TrueTime-style bounds |
| Leader election storm | Flapping leadership | High latency, write unavailability | Stable leadership; tune timeouts |
| Retry amplification | Cascading load | Outage deepens | Full jitter + retry budgets |
| Cascading failure | Thread pools exhaust | Multi-service brownout | Timeouts, bulkheads, circuit breakers |
| Thundering herd | Sync reconnect | Crash loop on recovery | Jittered reconnect |
| Replica lag | Stale reads | Read-your-writes bugs | Sticky primary window; quorum reads |
| Partial deploy | Mixed versions | Protocol mismatch | Rolling + compatibility windows |
| Disk full on quorum node | Raft write stall | Cluster read-only / unavailable | Disk alerts; auto-fail disk |
| Corrupted log | Node can't rejoin | Under-replicated | Wipe + snapshot catch-up |

> 🛠️ **PRACTICAL:** In every HLD/distributed answer, pick **two** rows from this table and narrate detection + mitigation. That alone signals senior judgment.

---

### CAP / PACELC Rapid Fire Cards

```text
Q: DynamoDB during partition?
A: AP — prefer availability; reconcile; PA/EL in PACELC.

Q: etcd during partition?
A: CP — refuse writes without majority; PC/EC-ish (consistent, pay RTT).

Q: Cassandra LOCAL_QUORUM?
A: Tunable — closer to strong within DC; still AP across regions if you want.

Q: "Are we CA?"
A: Only if single node / no partition model. Multi-node → P happens.
```

---

## Important Concepts Checklist

### Foundations
- [ ] 8 fallacies — name 4 cold
- [ ] CAP: P mandatory; C vs A **during partition**
- [ ] PACELC: else latency vs consistency
- [ ] Consistency spectrum: eventual → causal → linearizable
- [ ] When linearizability is worth the RTT cost

### Consensus
- [ ] Raft roles, terms, election timeouts
- [ ] Vote granting rules + log up-to-date check
- [ ] AppendEntries, commit, apply order
- [ ] Why majority overlap preserves committed entries
- [ ] Membership change pitfall (two majorities)
- [ ] Raft vs Multi-Paxos one-liner
- [ ] etcd / Cockroach / Consul placement of Raft

### Time & Ordering
- [ ] Lamport vs vector clocks; concurrency detection
- [ ] Why wall clocks fail for ordering
- [ ] TrueTime / commit wait intuition

### Locking & Coordination
- [ ] Redis SET NX EX + Lua release
- [ ] Why TTL locks need **fencing tokens**
- [ ] ZooKeeper ephemeral sequential algorithm
- [ ] Split brain definition + three mitigations

### Production Patterns
- [ ] Retry with full jitter + retry budget
- [ ] Circuit breaker / bulkhead / load shed
- [ ] Idempotency keys
- [ ] Gossip / SWIM failure detection basics

---

## Practical Labs

### Lab 1 — Whiteboard Raft on Paper (no laptop)
> 🛠️ **PRACTICAL:** With a timer (15 min), run the whiteboard script above. Record yourself. Check you said: majority, commit before client ACK, log completeness.

### Lab 2 — Mental Simulation: Dual Primary
```text
1. Primary A partitioned from quorum
2. B elected with higher term / epoch
3. A still accepts a write from a confused LB
4. Show how fencing token or epoch on storage rejects A's write
```

### Lab 3 — Design Lock Service Spike
Implement a toy in-process lock manager:
- `Acquire` returns monotonic `token`
- Fake `Storage.Write` stores `lastToken`; reject if `token < lastToken`
- Simulate "GC pause" by sleeping holder past TTL and renewing lock to another client
- Assert zombie write fails

### Lab 4 — CAP Roleplay
Pick a product (checkout inventory vs social like-count). Argue CP vs AP for 5 minutes. Force yourself to name the user-visible failure mode for each choice.

### Lab 5 — Read the etcd Failure Story
Skim a public postmortem (etcd disk latency / k8s API slowness). Map symptoms to: quorum write latency, leader election, and watch starvation. Write 5 bullets tying theory → incident.

> ⭐ **IMPORTANT CONCEPT:** Theory sticks when tied to an incident: GitHub split brain → fencing; Dynamo → AP; Spanner → TrueTime; etcd disk → Raft latency.

### Lab 6 — Quorum Math Drills

```text
RF=3, QUORUM = 2:
  R=2,W=2 → R+W>RF strong reads for latest
  R=1,W=1 → fast but conflicts possible

RF=5, want survive 2 failures:
  Majority = 3. Writes need 3 acks.
  Latency ≈ slowest of the 3 fastest replicas.

Interview question: "Why can't we have R=1,W=1 and still be consistent?"
Answer: Two clients can read/write different replicas; no overlap guarantee.
```

### Gossip vs Consensus — When to Use Which

| Need | Tool | Why |
|------|------|-----|
| Membership / failure hints | Gossip / SWIM | O(log N) spread, no leader bottleneck |
| Config that must be identical | Raft/Paxos | Linearizable single order |
| Shopping cart mergeable state | CRDT / LWW | Availability under partition |
| Leader election for jobs | Raft / ZK / etcd | Avoid dual workers |

> 🛠️ **PRACTICAL:** Saying "we'll gossip the lock holder" is a fail — locks need consensus-grade fencing, not epidemic rumor.

### Sample Interview Answers (60–90s)

**"Explain CAP in one minute."**
> Partitions happen, so we choose consistency or availability while split. CP systems like etcd error rather than lie. AP systems like Dynamo keep serving and repair later. Outside partitions, PACELC reminds us we still trade latency for consistency.

**"How does Raft commit a value?"**
> Leader appends locally, replicates to followers, waits for majority including itself, advances commitIndex, applies to state machine, then responds. Followers learn the commit via subsequent AppendEntries.

**"Why fencing tokens?"**
> Lease expiry plus a paused client creates two 'holders' in wall-clock time. Monotonic tokens let the storage reject the zombie's writes even if the client still believes it owns the lock.

