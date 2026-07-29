# FAANG Senior Software Engineer — 3 Month Master Plan

---

## Table of Contents

1. [Goal](#goal)
2. [Recommended Folder Structure](#recommended-folder-structure)
3. [Daily Routine](#daily-routine)
4. [Month 1 — Foundation](#month-1--foundation)
   - [DSA](#dsamd)
     - [Week 1 — Arrays + Hashing](#week-1--arrays--hashing)
     - [Week 2 — Linked List + Stack + Queue](#week-2--linked-list--stack--queue)
     - [Week 3 — Trees + Heaps](#week-3--trees--heaps)
     - [Week 4 — Graphs + DP](#week-4--graphs--dp)
     - [DSA Patterns To Master](#dsa-patterns-to-master)
     - [Must Do Platforms](#must-do-platforms)
   - [Go Language Deep Dive](#go-language-deep-dive)
   - [Java Deep Dive](#java-deep-dive)
   - [Database Internals](#database-internals)
   - [Redis Internals](#redis-internals)
   - [Docker Deep Dive](#docker-deep-dive)
   - [Low Level Design](#low-level-design)
5. [Month 2 — Advanced Engineering](#month-2--advanced-engineering)
   - [Advanced DSA](#advanced-dsamd)
   - [Kafka Deep Dive](#kafka-deep-dive)
   - [Distributed Systems](#distributed-systemsmd)
   - [Cloud Engineering](#cloud-engineering)
   - [Advanced LLD](#advanced-lldmd)
   - [High Level Design](#high-level-design)
   - [Concurrency](#concurrencymd)
6. [Month 3 — Interview Readiness](#month-3--interview-readiness)
   - [FAANG System Design](#faang-system-designmd)
   - [Scalability](#scalabilitymd)
   - [Production Engineering](#production-engineeringmd)
   - [Behavioral & Leadership Preparation](#behavioralmd)
   - [Mock Interviews](#mock-interviewsmd)
   - [Revision](#revisionmd)
   - [Leadership](#leadershipmd)
7. [Final Execution Strategy](#final-execution-strategy)
8. [Final Target](#final-target)
9. [Important Advice](#important-advice)

---

## Goal

This roadmap is designed for an experienced engineer targeting **Senior Software Engineer** roles in FAANG-level companies.

This plan covers:

| Domain | Topics |
|---|---|
| **Algorithms** | Data Structures & Algorithms (DSA) |
| **Design** | Low Level Design (LLD), High Level Design (HLD) |
| **Infrastructure** | Distributed Systems, Redis Internals, Kafka Internals |
| **Platform** | Databases Internals, Docker Internals, Cloud Fundamentals + Advanced Concepts |
| **Languages** | Go Language Deep Dive, Java Deep Dive |
| **Interviews** | System Design Interviews, Leadership & Behavioral Preparation |
| **Engineering** | Scalability Engineering, Performance Optimization, Concurrency, Production Engineering |

---

## Recommended Folder Structure

```text
FAANG-Preparation/
│
├── Month-1/
│   ├── DSA.md
│   ├── GoLang-Core.md
│   ├── Java-Core.md
│   ├── DB-Fundamentals.md
│   ├── Redis-Basics.md
│   ├── Docker-Basics.md
│   └── LLD-Basics.md
│
├── Month-2/
│   ├── Advanced-DSA.md
│   ├── Kafka-Internals.md
│   ├── Distributed-Systems.md
│   ├── Cloud-Engineering.md
│   ├── Advanced-LLD.md
│   ├── HLD-Core.md
│   └── Concurrency.md
│
├── Month-3/
│   ├── FAANG-System-Design.md
│   ├── Scalability.md
│   ├── Production-Engineering.md
│   ├── Behavioral.md
│   ├── Mock-Interviews.md
│   ├── Revision.md
│   └── Leadership.md
│
└── Daily-Routine.md
```

---

## Daily Routine

### Daily Schedule (Minimum 8–10 Hours)

| Time Block | Duration | Focus |
|---|---|---|
| **Morning** | 2 Hours | DSA Problem Solving, Timed LeetCode, Pattern Recognition |
| **Afternoon** | 3 Hours | Core Engineering Concepts — DB/Kafka/Redis/Docker/Cloud, Internals + Hands-on |
| **Evening** | 2 Hours | LLD/HLD Practice, Machine Coding, Design Discussion |
| **Night** | 2 Hours | Go/Java Deep Dive, Concurrency, Runtime Internals, Notes Revision |
| **Weekend** | — | Mock Interviews, Full System Design, Resume Optimization, Behavioral Stories |

---

# Month 1 — Foundation

## DSA.md

### Objective

Build strong **problem-solving** and coding interview foundations.

---

### Week 1 — Arrays + Hashing

> **💡 Key Focus:** Master the **Sliding Window** and **Two Pointer** patterns first — they appear in a large fraction of array problems.

| Category | Topics |
|---|---|
| **Core Topics** | Prefix Sum, Sliding Window, Two Pointer, Frequency Maps, Kadane Algorithm, Monotonic Array, Cyclic Sort |
| **Edge Topics** | Sparse Arrays, Memory Optimization, In-place Manipulation, Cache Locality, Time vs Space Tradeoffs |

**Problems:**

* Two Sum
* Best Time to Buy and Sell Stock
* Product of Array Except Self
* Longest Consecutive Sequence
* Subarray Sum Equals K

---

### Week 2 — Linked List + Stack + Queue

> **⚠️ Watch out:** The **ABA Problem** in lock-free structures is a frequent interview pitfall — know how to detect and prevent it.

| Category | Topics |
|---|---|
| **Core Topics** | Fast Slow Pointer, LRU Cache, Monotonic Stack, Circular Queue, Deque |
| **Edge Topics** | Memory Fragmentation, Lock-Free Queue, ABA Problem, Sentinel Nodes |

**Advanced:**

* Implement Redis-like LRU
* LFU Cache

---

### Week 3 — Trees + Heaps

> **💡 Key Focus:** Understand **Segment Tree** and **Fenwick Tree** internals — these come up in range-query and frequency problems at FAANG level.

| Category | Topics |
|---|---|
| **Core Topics** | BST, AVL, Segment Tree, Fenwick Tree, Trie, Heap Internals |
| **Edge Topics** | Heapify Complexity, Balanced Trees, Persistent Trees, Threaded Binary Tree |

**Problems:**

* Serialize Deserialize Tree
* Lowest Common Ancestor
* Kth Largest Element

---

### Week 4 — Graphs + DP

> **⚠️ Watch out:** Know when to choose **Memoization vs Tabulation** — space and call-stack trade-offs are common follow-up questions.

| Category | Topics |
|---|---|
| **Core Topics** | BFS, DFS, Topological Sort, Dijkstra, Floyd Warshall, Bellman Ford, Union Find, Dynamic Programming |
| **Edge Topics** | Graph Compression, State Compression DP, DAG Optimization, Memoization vs Tabulation |

**Important Problems:**

* Word Ladder
* Course Schedule
* Alien Dictionary
* Network Delay Time
* Coin Change
* LIS

---

### DSA Patterns To Master

> **💡 Key Focus:** Do not just solve problems — identify which pattern applies within the first 2 minutes of reading. Speed on pattern recognition is what separates senior candidates.

* **Sliding Window**
* **Prefix Sum**
* **Binary Search on Answer**
* **Greedy**
* **Heap Problems**
* **Interval Problems**
* **Backtracking**
* **Graph Traversal**
* **DP State Transition**
* **Trie**
* **Bit Manipulation**

---

### Must Do Platforms

| Platform | Purpose |
|---|---|
| **LeetCode** | Primary interview prep |
| **Codeforces** | Competitive problem quality |
| **AtCoder** | Algorithm depth |
| **InterviewBit** | Structured interview tracks |

**Target:**

* 300+ Problems
* 50 Medium/Hard Graph Problems
* 50 DP Problems

---

## GOLANG-CORE.md

## Go Language Deep Dive

### Go Runtime Internals

> **💡 Key Focus:** The **GMP Scheduler** (Goroutine-Machine-Processor model) is the single most important Go internals topic for senior interviews — understand work stealing deeply.

| Category | Topics |
|---|---|
| **Core Topics** | GMP Scheduler, Goroutine Scheduling, Work Stealing, Stack Growth, Escape Analysis, Garbage Collector, STW (Stop The World), Memory Allocation |
| **Edge Topics** | Scheduler Latency, Preemption, Goroutine Leaks, False Sharing, Memory Alignment |

---

### Concurrency

> **⚠️ Watch out:** **Goroutine Leaks** are the #1 production bug in Go services — always ensure goroutines have an exit path via context cancellation or channel close.

| Category | Topics |
|---|---|
| **Core Topics** | Channels, Buffered Channels, Select, Context Package, Worker Pool, Fan-in Fan-out, Rate Limiting |
| **Edge Topics** | Deadlock Detection, Starvation, Lock Contention, CAS Operations, Atomic Package, Memory Model |

---

### Networking

| Category | Topics |
|---|---|
| **Core Topics** | net/http Internals, HTTP2, gRPC, TCP vs UDP, Socket Programming, Connection Pooling |
| **Edge Topics** | Keep Alive, Backpressure, Head-of-Line Blocking, Nagle Algorithm |

---

### Performance Engineering

* **pprof**
* **Benchmarking**
* **Heap Analysis**
* **CPU Profiling**
* **Memory Profiling**

---

### Production Topics

* Graceful Shutdown
* Circuit Breaker
* Retry Mechanism
* Distributed Tracing
* Structured Logging
* Middleware Design

---

### Build Projects

| # | Project |
|---|---|
| 1 | Kafka Consumer in Go |
| 2 | Redis Clone |
| 3 | URL Shortener |
| 4 | Distributed Rate Limiter |
| 5 | Notification Service |

---

## JAVA-CORE.md

## Java Deep Dive

### JVM Internals

> **💡 Key Focus:** Know the difference between **G1GC** and **ZGC** trade-offs — latency vs throughput discussions are common in senior system design interviews.

| Category | Topics |
|---|---|
| **Core Topics** | Class Loader, JVM Memory Model, Heap Structure, Metaspace, JIT Compiler, Bytecode, Escape Analysis, GC Algorithms |
| **GC Algorithms** | G1GC, ZGC, CMS, Parallel GC |
| **Edge Topics** | Safepoints, Object Header, Biased Locking, TLAB, Off Heap Memory |

---

### Concurrency

> **⚠️ Watch out:** **False Sharing** in multi-threaded Java is subtle — cache line contention can destroy throughput even when locks look correct.

| Category | Topics |
|---|---|
| **Core Topics** | Thread Pool, CompletableFuture, ForkJoinPool, Synchronization, ReentrantLock, Semaphore, ReadWriteLock |
| **Edge Topics** | CAS, Memory Visibility, Happens-Before, CPU Cache, False Sharing |

---

### Spring Boot Advanced

* **Bean Lifecycle**
* **AOP**
* **Transactions**
* **Reactive Programming**
* **WebFlux**
* **Kafka Integration**
* **Security**

---

### Production Engineering

* JVM Tuning
* Heap Dump Analysis
* Thread Dump Analysis
* Profiling
* Performance Optimization

---

### Build Projects

| # | Project |
|---|---|
| 1 | Distributed Order Management |
| 2 | Payment Gateway |
| 3 | Notification System |
| 4 | Kafka Streaming Pipeline |
| 5 | Trading Engine |

---

## DB-FUNDAMENTALS.md

## Database Internals

### Relational Database Internals

> **💡 Key Focus:** Understand **MVCC** (Multi-Version Concurrency Control) and **WAL** (Write-Ahead Log) in depth — these underpin every isolation level and crash-recovery question.

| Category | Topics |
|---|---|
| **Core Topics** | B+ Trees, Query Optimizer, Indexing, Joins, Execution Plans, MVCC, WAL, ACID |
| **Edge Topics** | Phantom Reads, Snapshot Isolation, Deadlocks, Lock Escalation, Partition Pruning, Covering Index |

---

### NoSQL

> **⚠️ Watch out:** **CAP Theorem** is often misapplied — be precise about whether a system sacrifices consistency or availability, and under what network conditions.

* **CAP Theorem**
* **Consistent Hashing**
* **Replication**
* **Sharding**
* **Eventual Consistency**

---

### Advanced Topics

* OLTP vs OLAP
* **CDC** (Change Data Capture)
* **CQRS**
* **Event Sourcing**
* Distributed Transactions
* **Saga Pattern**

---

### Hands-on

| Database | Focus |
|---|---|
| **PostgreSQL** | Internals |
| **MySQL** | Internals |
| **MongoDB** | Internals |
| **Cassandra** | Architecture |

---

## REDIS-BASICS.md

## Redis Internals

### Core Concepts

> **💡 Key Focus:** Redis's **Single Thread Model** with its **Event Loop** is the key to understanding why pipelining and Lua scripting have such dramatic performance effects.

| Category | Topics |
|---|---|
| **Core Topics** | Event Loop, Single Thread Model, Persistence, RDB, AOF, Replication, Sentinel, Cluster Mode |
| **Edge Topics** | Fork Memory Overhead, Hot Key Problem, Cache Avalanche, Cache Penetration, Cache Breakdown, Lazy Free |

---

### Data Structures Internals

> **⚠️ Watch out:** Know when Redis upgrades from **ZipList** to **SkipList** encoding — this threshold behaviour determines memory and performance characteristics at scale.

* **SDS** (Simple Dynamic String)
* **ZipList**
* **QuickList**
* **SkipList**
* **HyperLogLog**
* **Bloom Filter**

---

### Performance

* **Pipeline**
* **Lua Scripting**
* **Transactions**
* **Eviction Policies**
* **Memory Fragmentation**

---

### Build

* Distributed Cache
* Rate Limiter
* Session Store
* Pub/Sub Notification

---

## DOCKER-BASICS.md

## Docker Deep Dive

### Internals

> **💡 Key Focus:** **Linux Namespaces** and **cgroups** are the two kernel primitives that make containers possible — interviewers expect you to explain isolation at this level.

| Category | Topics |
|---|---|
| **Core Topics** | Linux Namespaces, cgroups, Union File System, OverlayFS, Container Runtime, OCI, runc |
| **Edge Topics** | PID Namespace, Mount Namespace, Rootless Containers, Security Isolation, Seccomp, AppArmor |

---

### Networking

* **Bridge Network**
* **Overlay Network**
* **Host Network**
* **NAT**
* **DNS Resolution**

---

### Storage

* **Volumes**
* **Bind Mount**
* **Layer Caching**

---

### Kubernetes Intro

* **Pods**
* **Services**
* **Ingress**
* **Deployment**
* **StatefulSet**

---

## LLD-BASICS.md

## Low Level Design

### Core Principles

> **💡 Key Focus:** **SOLID** principles are the foundation of every machine coding evaluation — be ready to explain each principle with a concrete code example.

| Principle | Meaning |
|---|---|
| **SOLID** | Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion |
| **DRY** | Don't Repeat Yourself |
| **KISS** | Keep It Simple, Stupid |
| **YAGNI** | You Aren't Gonna Need It |
| **Composition over Inheritance** | Favour object composition over class inheritance |

---

### Patterns

| Pattern | Category |
|---|---|
| **Factory** | Creational |
| **Singleton** | Creational |
| **Builder** | Creational |
| **Observer** | Behavioural |
| **Strategy** | Behavioural |
| **Decorator** | Structural |
| **Adapter** | Structural |

---

### Machine Coding

**Build:**

* Parking Lot
* Splitwise
* BookMyShow
* Elevator System
* Logger Framework

---

# Month 2 — Advanced Engineering

## ADVANCED-DSA.md

> **💡 Key Focus:** **Heavy Light Decomposition** and **Segment Tree Lazy Propagation** are the ceiling topics that separate candidates who get offers at top-tier competitive companies.

| Category | Topics |
|---|---|
| **Advanced DP** | Digit DP, Bitmask DP |
| **Tree Algorithms** | Heavy Light Decomposition, Segment Tree Lazy Propagation |
| **String Algorithms** | Trie Optimization, Rolling Hash, KMP, Rabin Karp |
| **Competitive Topics** | DSU, Sparse Table, Mo's Algorithm, Fenwick Tree |

---

## KAFKA-INTERNALS.md

## Kafka Deep Dive

### Core Internals

> **💡 Key Focus:** Understanding **ISR** (In-Sync Replicas) and **Leader Election** is critical — these determine durability guarantees when brokers fail.

| Category | Topics |
|---|---|
| **Core Topics** | Partitioning, ISR, Leader Election, Replication, Retention, Compaction, Producer Acks, Consumer Group |
| **Edge Topics** | Rebalancing, Exactly Once Semantics, Idempotent Producer, Backpressure, Consumer Lag, Out of Order Delivery |

---

### Storage Internals

> **⚠️ Watch out:** **Zero Copy** and **Page Cache** exploitation are what make Kafka faster than most systems — be able to explain the OS-level mechanism, not just the buzzword.

* **Segment Files**
* **Zero Copy**
* **Page Cache**
* **Sequential I/O**

---

### Distributed Systems Concepts

* CAP
* Consensus
* Availability
* Durability
* Ordering

---

### Build

* Event Driven Architecture
* Order Pipeline
* Real-time Analytics

---

## DISTRIBUTED-SYSTEMS.md

> **💡 Key Focus:** **Raft** consensus is more approachable in interviews than Paxos — study Raft leader election and log replication step-by-step.

| Category | Topics |
|---|---|
| **Core Topics** | CAP Theorem, Consensus Algorithms, Paxos, Raft, Gossip Protocol, Distributed Locking, Vector Clock, Lamport Clock |
| **Edge Topics** | Split Brain, Clock Drift, Idempotency, Retry Storm, Backpressure, Thundering Herd |

---

## CLOUD-ENGINEERING.md

## Cloud Engineering

### AWS Core

> **💡 Key Focus:** Understand **VPC** architecture and **IAM** permission models deeply — cloud security and networking questions are standard at senior level.

| Service | Purpose |
|---|---|
| **EC2** | Compute |
| **VPC** | Networking |
| **Load Balancer** | Traffic distribution |
| **Auto Scaling** | Elastic capacity |
| **S3** | Object storage |
| **RDS** | Managed relational database |
| **IAM** | Identity and access management |
| **CloudWatch** | Monitoring and observability |

---

### Advanced Topics

* Multi Region Deployment
* **CDN**
* Disaster Recovery
* **Blue Green Deployment**
* **Canary Deployment**
* **Service Mesh**

---

### Kubernetes

> **⚠️ Watch out:** Know what **etcd** does and what happens when it becomes unavailable — this is the most critical failure mode of a Kubernetes cluster.

* **Scheduler**
* **kube-proxy**
* **etcd**
* **CNI** (Container Network Interface)
* **CSI** (Container Storage Interface)
* **HPA** (Horizontal Pod Autoscaler)

---

## ADVANCED-LLD.md

> **💡 Key Focus:** **Hexagonal Architecture** (ports and adapters) is the pattern most associated with testable, production-grade service design at FAANG level.

| Category | Topics |
|---|---|
| **Design Paradigms** | Thread Safe Design, Concurrent Systems, Event Driven Design, Reactive Design |
| **Architecture Patterns** | Hexagonal Architecture, Clean Architecture |

**Projects:**

* Distributed Cache
* Trading Engine
* Ride Sharing App

---

## HLD-CORE.md

## High Level Design

### Learn Every Component

> **💡 Key Focus:** For each component, know not just what it does but **why** you would choose it — trade-off reasoning is the core evaluation criterion in HLD rounds.

| Component | Role |
|---|---|
| **API Gateway** | Single entry point, auth, rate limiting |
| **CDN** | Edge caching, latency reduction |
| **Load Balancer** | Traffic distribution across instances |
| **Reverse Proxy** | Request routing, TLS termination |
| **Database Scaling** | Read replicas, sharding, partitioning |
| **Cache Layer** | Reduce DB load, speed up reads |
| **Queue** | Async decoupling, backpressure management |
| **Search Engine** | Full-text, inverted index |
| **Blob Storage** | Large object storage |

---

### Core Concepts

* **Horizontal Scaling**
* **Vertical Scaling**
* **Sharding**
* **Replication**
* **Consistency**
* **Availability**
* **Fault Tolerance**
* **Eventual Consistency**

---

### Design Systems

> **⚠️ Watch out:** Do not jump to solutions — always state functional and non-functional requirements, then capacity estimates, before drawing any architecture diagrams.

| System | Key Complexity |
|---|---|
| **YouTube** | Video ingestion, CDN distribution, metadata at scale |
| **WhatsApp** | Real-time messaging, presence, end-to-end encryption |
| **Uber** | Geo-indexing, real-time matching, surge pricing |
| **Twitter/X** | Fan-out on write vs read, timelines, trends |
| **Instagram** | Media storage, feed generation, recommendations |
| **Distributed Notification System** | Multi-channel delivery, reliability, deduplication |
| **Trading Platform** | Low latency, order book, matching engine |

---

## CONCURRENCY.md

> **⚠️ Watch out:** **False Sharing** in lock-free structures and **Memory Barrier** semantics are the topics most engineers hand-wave — being precise here signals genuine senior-level depth.

| Category | Topics |
|---|---|
| **Primitives** | Mutex, Semaphore, CAS, Memory Barrier |
| **Advanced Structures** | Lock-Free Programming, Wait-Free Structures |
| **Hardware** | CPU Cache, NUMA |

---

# Month 3 — Interview Readiness

## FAANG-SYSTEM-DESIGN.md

## Master Designs

### Mandatory Systems

> **💡 Key Focus:** Treat each design as a full 45-minute mock. Practice covering all eleven evaluation dimensions (listed below) for every system.

| # | System |
|---|---|
| 1 | URL Shortener |
| 2 | Notification Service |
| 3 | Distributed Chat |
| 4 | Kafka-like Queue |
| 5 | Search Engine |
| 6 | Payment System |
| 7 | Trading Exchange |
| 8 | Stock Broker Platform |
| 9 | Rate Limiter |
| 10 | Distributed Scheduler |

---

### For Every Design Learn

| Dimension | What to Cover |
|---|---|
| **Functional Requirements** | Core features the system must support |
| **Non Functional Requirements** | Latency, throughput, availability, consistency targets |
| **Capacity Estimation** | QPS, storage, bandwidth calculations |
| **APIs** | Public interface design |
| **Database Schema** | Data model and storage choices |
| **Scaling** | Horizontal scale-out strategies |
| **Bottlenecks** | Hotspots and chokepoints |
| **Failure Handling** | Redundancy, retries, circuit breakers |
| **Monitoring** | Metrics, alerts, dashboards |
| **Security** | AuthN/AuthZ, encryption, input validation |
| **Cost Optimization** | Storage tiering, spot instances, caching |

---

## SCALABILITY.md

> **⚠️ Watch out:** **Replication Lag** and **Retry Amplification** are the two failure modes that most commonly cause real-world outages — know concrete mitigation strategies for each.

| Category | Topics |
|---|---|
| **Core Topics** | Scaling Databases, Multi Region Systems, Event Driven Architecture, Distributed Cache, Read Replica, Write Scaling |
| **Edge Topics** | Hot Partition, Data Skew, Replication Lag, Retry Amplification, Cascading Failure |

---

## PRODUCTION-ENGINEERING.md

> **💡 Key Focus:** The trio of **Metrics + Tracing + Logging** (the three pillars of **Observability**) — be able to describe how they complement each other with a real incident scenario.

| Category | Topics / Tools |
|---|---|
| **Observability Pillars** | Observability, Metrics, Tracing, Logging, Alerting |
| **Service Reliability** | SLO, SLA, Incident Management |
| **Tools** | Prometheus, Grafana, ELK, Jaeger, OpenTelemetry |

---

## BEHAVIORAL.md

## Leadership Preparation

> **💡 Key Focus:** Use the **STAR format** (Situation, Task, Action, Result) for every story. Prepare at least two distinct stories per category so you are not repeating yourself across rounds.

**Prepare STAR stories for:**

| Category | What Interviewers Want to Hear |
|---|---|
| **Conflict Resolution** | How you navigated disagreement constructively |
| **Mentorship** | How you grew someone else's capability |
| **Ownership** | How you took responsibility beyond your scope |
| **Failure** | What you learned and how you recovered |
| **System Outage** | How you led incident response under pressure |
| **Performance Improvement** | How you measurably improved a system or process |
| **Team Leadership** | How you aligned a team toward a goal |
| **Project Delivery** | How you managed scope, timeline, and stakeholders |
| **Cross-team Collaboration** | How you influenced without authority |

---

## MOCK-INTERVIEWS.md

> **⚠️ Watch out:** Do not skip mock interviews — the ability to think out loud and communicate architecture clearly is a separate skill from knowing the material. Practice it weekly.

**Weekly Plan:**

| Interview Type | Frequency |
|---|---|
| DSA Mock Interviews | 2 per week |
| LLD Mock Interviews | 2 per week |
| HLD Mock Interviews | 2 per week |
| Behavioral Interview | 1 per week |

---

## REVISION.md

**Final 2 Weeks:**

* Revisit Notes
* Redo Hard Problems
* Re-design Core Systems
* Review Runtime Internals
* Practice Explaining Architecture Clearly

---

## LEADERSHIP.md

> **💡 Key Focus:** Senior engineers are evaluated on **Tradeoff Communication** and **Architecture Ownership** — being able to defend your decisions under pushback is as important as the decision itself.

| Topic | Why It Matters |
|---|---|
| **Technical Leadership** | Sets direction for the team |
| **Architecture Ownership** | Accountable for long-term system quality |
| **Mentoring** | Multiplies team output |
| **Stakeholder Management** | Aligns engineering with business goals |
| **Tradeoff Communication** | Signals senior judgment |
| **Execution Planning** | Delivers complex projects reliably |
| **Incident Ownership** | Demonstrates calm under pressure |

---

# Final Execution Strategy

## Phase 1 — Build Foundation

**Duration:** 30 Days

> **💡 Key Focus:** Nail the fundamentals before moving on — a weak DSA or language foundation will undermine every advanced topic in Months 2 and 3.

**Focus:**

* DSA
* Core Languages
* DB
* Redis
* Docker

---

## Phase 2 — Advanced Engineering

**Duration:** 30 Days

> **💡 Key Focus:** This phase connects the dots — Kafka, Distributed Systems, and HLD all reinforce each other. Study them in parallel, not in isolation.

**Focus:**

* Kafka
* Distributed Systems
* Cloud
* HLD
* Concurrency

---

## Phase 3 — Interview Readiness

**Duration:** 30 Days

> **💡 Key Focus:** Communication is the differentiator in this phase. You already know the material — now practice articulating it clearly, concisely, and confidently under interview conditions.

**Focus:**

* System Design
* Mock Interviews
* Leadership
* Resume
* Communication

---

# Final Target

By end of **90 days** you should be able to:

| Skill | Standard |
|---|---|
| **DSA** | Solve LeetCode Hard in 25–35 mins |
| **System Design** | Design distributed systems confidently |
| **Internals** | Explain internals of Kafka/Redis/DB/Docker |
| **Engineering** | Build production-grade services |
| **Concurrency** | Handle concurrency and scalability discussions |
| **Interviews** | Crack Senior Engineer rounds in FAANG-level companies |
| **Leadership** | Lead architecture discussions |
| **Communication** | Explain tradeoffs deeply |

---

# Important Advice

> **⚠️ Watch out:** Do NOT just memorize. Memorization fades under interview pressure. Deep understanding and hands-on experience do not.

For every topic:

| Step | Action |
|---|---|
| 1 | Learn theory |
| 2 | Learn internals |
| 3 | Learn edge cases |
| 4 | Build project |
| 5 | Benchmark |
| 6 | Debug failures |
| 7 | Explain tradeoffs |
| 8 | Teach someone else |

That is how **Senior Engineers** are evaluated.
