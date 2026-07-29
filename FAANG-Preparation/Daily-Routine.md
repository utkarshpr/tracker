# Daily Study Routine

> **Target: 8–10 hours/day** focused preparation for FAANG/SDE-3 interviews.

---

## How to Read These Notes (Legend)

Every study file uses the same markers:

| Marker | Meaning | How to use it |
|--------|---------|---------------|
| `⭐ IMPORTANT CONCEPT` | Must-know for FAANG interviews — prioritize until you can teach it cold | Review daily in final 2 weeks |
| `💡 Key Insight` | Non-obvious detail that upgrades mid → senior answers | Internalize after basics |
| `🛠️ PRACTICAL` | Hands-on drill, coding exercise, or timed mock | Do it — reading alone is not enough |
| `🌍 Real-World` | Production anecdote / company example | Use as interview “I’ve seen this at…” flavor |
| `⚠️ Common Mistake / Gotcha` | Trap that fails interviews or production | Quiz yourself against these |

> ⭐ **IMPORTANT CONCEPT:** Interview success = pattern recognition under time pressure + tradeoff clarity. Schedule follows that: timed DSA → depth engineering → design judgment → language runtime.

---

## Daily Schedule

| Time Block | Duration | Focus |
|-----------|----------|-------|
| Morning | 2 hrs | DSA — timed problems + pattern recognition |
| Afternoon | 3 hrs | Core engineering — DB/Kafka/Redis/Docker/Cloud |
| Evening | 2 hrs | LLD/HLD — machine coding + design discussion |
| Night | 2 hrs | **Go deep track** — language / concurrency / runtime / labs |
| **Total** | **~9 hrs** | |

> **Language focus: Go.** Primary notes: `Month-1/GoLang-Deep-Track.md` + `Month-1/GoLang-Core.md`. Treat Java notes as optional comparison only.

---

## Morning Block (2 Hours) — DSA

> ⭐ **IMPORTANT CONCEPT:** Always name the pattern **before** coding. Interviewers grade approach clarity as much as correctness.

- [ ] Solve 2–3 LeetCode problems under timed conditions (25 min each) — **implement in Go**
- [ ] Identify the pattern before coding (sliding window? DP? graph?)
- [ ] Review editorial for any problem you couldn't solve in 25 min
- [ ] Add unsolved patterns to a "weak patterns" backlog
- [ ] Re-solve yesterday’s miss from scratch (no peeking) — 15 min
- [ ] Prefer Go std containers: `[]T`, `map`, `container/heap` — avoid translating Java verbatim

### 🛠️ PRACTICAL — Pattern Warmup (10 min)

Pick 5 problem titles from `Month-1/DSA.md` FAANG Must-Solve. For each, say out loud:
1. Pattern name
2. Time/space complexity of optimal approach
3. One edge case

No coding. Speed of recognition matters.

---

## Afternoon Block (3 Hours) — Engineering Concepts

- [ ] Pick one deep topic: DB internals / Kafka / Redis / Docker / Cloud
- [ ] Read the study notes — **stop at every ⭐ IMPORTANT CONCEPT** and write it in your own words
- [ ] Work through at least one hands-on example or 🛠️ PRACTICAL drill
- [ ] Write 3 flashcard-style Q&As from what you studied
- [ ] End with: “How would I explain this in 90 seconds in a system design deep-dive?”

### Topic Rotation (repeat weekly)

| Day | Topic file | Focus ⭐ concepts |
|-----|------------|-------------------|
| Mon | `Month-1/DB-Fundamentals.md` | Indexes, MVCC, isolation levels, connection pooling |
| Tue | `Month-1/Redis-Basics.md` | Single-thread model, eviction, Cluster slots, Lua atomicity |
| Wed | `Month-2/Kafka-Internals.md` | Partitions/ordering, ISR/HWM, consumer groups, exactly-once |
| Thu | `Month-1/Docker-Basics.md` + `Month-2/Cloud-Engineering.md` | Namespaces/cgroups, VPC, IAM Deny, Multi-AZ |
| Fri | `Month-2/Distributed-Systems.md` | CAP during partition, Raft, fencing tokens |
| Sat | Catch-up + 🛠️ labs | Hands-on only |
| Sun | Light review | Flashcards only |

---

## Evening Block (2 Hours) — Design Practice

> ⭐ **IMPORTANT CONCEPT:** HLD interviews reward **framework discipline** (FR → NFR → estimate → design → deep dive → failures), not memorizing one architecture diagram.

- [ ] LLD: pick one machine coding problem, design it in 45 min (**code in Go**)
- [ ] HLD: pick one system design, walk through the 45-min framework
- [ ] Record what you got stuck on — review it next morning
- [ ] Explicitly say 2 tradeoffs out loud (“I chose X because Y; cost is Z”)
- [ ] For LLD: name interfaces at variation points (Deep-Track §8 + §17)

### 🛠️ PRACTICAL — 45-min HLD Timer Checklist

```text
00–05  Clarify FR/NFR + scope
05–10  Capacity numbers (QPS, storage, bandwidth)
10–20  Draw boxes + data flow + APIs
20–40  Deep dive (schema, cache, consistency, hot path)
40–45  Failures, scaling 10×, tradeoffs summary
```

---

## Night Block (2 Hours) — Go Deep Track (Primary)

> ⭐ **IMPORTANT CONCEPT:** Go interview signal = **idiomatic judgment** + **runtime depth** + **concurrency correctness**. Rotate all three weekly.

- [ ] 30 min — Read one ⭐ section (Deep-Track or Core); rewrite in your words
- [ ] 45 min — Type/run the example or complete a 🛠️ lab (`go test -race`)
- [ ] 30 min — Explain aloud (GMP / channels vs mutex / nil-interface) OR 5 Qs from Deep-Track §19
- [ ] 15 min — Check off `Important-Concepts.md` Go items + plan tomorrow

### Go night rotation (repeat)

| Night | Focus | File |
|-------|-------|------|
| Mon | Slices/maps gotchas + methods | `GoLang-Deep-Track.md` §§4–7 |
| Tue | Interfaces + errors + generics | Deep-Track §§8–12 |
| Wed | Channels, select, context, WaitGroup | `GoLang-Core.md` §2 |
| Thu | GMP, escape analysis, GC | `GoLang-Core.md` §1 |
| Fri | pprof + graceful shutdown + middleware | `GoLang-Core.md` §§4–5 |
| Sat | LLD in Go: LRU / rate limiter / worker pool | Deep-Track §17 |
| Sun | Interview Q&A bank + weak ⭐ redo | Deep-Track §19 |

### Evening LLD note (Go)

Prefer implementing LLD **in Go** (not Java): parking-lot-lite, LRU, rate limiter, notification channels — see Deep-Track §17.

---

## Weekend Schedule

| Day | Focus |
|-----|-------|
| Saturday | Mock interview (DSA + LLD) · Full system design walkthrough |
| Sunday | Resume review · Behavioral story practice · Weak area catch-up |

> **Weekend tip:** Treat Saturday mock as a real interview. No notes. Timed. Record yourself if possible.

### 🛠️ PRACTICAL — Saturday Full Loop (3 hrs)

```text
DSA 45 → LLD 45 → break 15 → HLD 60 → Behavioral 30 → score yourself
Use rubrics in Month-3/Mock-Interviews.md
Log score + 1 fix action in a mock log table
```

### 🛠️ PRACTICAL — Sunday Behavioral (45 min)

```text
Recite 3 STAR stories out loud (≤ 2.5 min each)
For each: confirm quantified Result + Amazon LP mapping
Stress-test: answer "What would you do differently?" for each
```

---

## Weekly Goals by Month Phase

### Month 1 — Foundations (Go-first)

| Goal | Target |
|------|--------|
| DSA | 8–12 problems/week; patterns named cold (**code solutions in Go**) |
| LLD | 3 machine-coding designs **in Go** |
| Go language | Deep-Track §§1–12 checklist ≥ 80% |
| Go runtime | GMP + escape + GC explainable in 2 min each |
| Infra | Redis + DB + Docker: explain architecture in 5 min each |

### Month 2 — Depth

| Goal | Target |
|------|--------|
| DSA | Hard problems + traps from `DSA-Traps.md` |
| HLD | 4 full designs with capacity math |
| Distributed | CAP/Raft/locks explainable on whiteboard |
| Kafka/Cloud | 1 practical lab each week |

### Month 3 — Interview Mode

| Goal | Target |
|------|--------|
| Mocks | ≥ 3 timed mocks/week (mix of DSA/LLD/HLD/Behavioral) |
| Behavioral | 9 STAR stories quantified |
| Revision | Only ⭐ IMPORTANT CONCEPTS + weak spots |
| Sleep | Non-negotiable 7–8h before interview days |

---

## Energy & Focus Rules

```text
1. Deep work blocks are phone-free. One topic per block.
2. If stuck > 25 min on DSA → mark pattern weak → read editorial → re-solve tomorrow.
3. Never skip the "explain out loud" step — interviews are verbal.
4. Track weak patterns in a single list; review every Sunday.
5. Final 2 weeks: follow Month-3/Revision.md — consolidate, don't invent new topics.
```

> ⭐ **IMPORTANT CONCEPT:** Consistency beats intensity. Nine focused hours with active recall beats twelve hours of passive reading.
