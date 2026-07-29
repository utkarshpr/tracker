# Mock Interviews — Execution Plan and Evaluation Guide

> **Self-contained. No internet needed.**
> Covers: Weekly schedule → DSA/LLD/HLD/Behavioral mock formats → Rubrics → Improvement protocol → Interview day tips

---

## Table of Contents

| # | Topic |
|---|-------|
| 1 | [Weekly Schedule](#weekly-schedule) |
| 2 | [DSA Mock (45 min)](#how-to-run-a-dsa-mock-45-min) |
| 3 | [LLD Mock (45 min)](#how-to-run-a-lld-mock-45-min) |
| 4 | [HLD Mock (60 min)](#how-to-run-a-hld-mock-60-min) |
| 5 | [Behavioral Mock (30 min)](#how-to-run-a-behavioral-mock-30-min) |
| 6 | [Improvement Protocol](#improvement-protocol-between-sessions) |
| 7 | [Interview Day Tips](#interview-day-tips) |

---

## Weekly Schedule

### Week 1–4: Foundation Mocks

| Day | Activity | Duration |
|-----|----------|----------|
| Monday | DSA mock — medium difficulty | 45 min |
| Wednesday | LLD mock — OOP design | 45 min |
| Friday | HLD mock — junior-to-mid system design | 45 min |
| Weekend | Behavioral practice — 2–3 STAR stories | 30 min |

### Week 5–8: FAANG-Level Mocks

| Day | Activity | Duration |
|-----|----------|----------|
| Monday | DSA mock — hard, Google/Meta style | 45 min |
| Tuesday | LLD mock — concurrent systems / design patterns | 45 min |
| Thursday | HLD mock — FAANG scale (100M users) | 60 min |
| Saturday | Full loop simulation: DSA + LLD + HLD + Behavioral | 3 hrs |
| Sunday | Review and fix gaps | — |

### Week 9–10: Final Simulation

```text
- 2 complete interview loops per week
- Real interview format: no pausing, no hints, strict time
- Record yourself — watch for filler words and unclear explanations
```

---

## How to Run a DSA Mock (45 min)

### Time Budget

> ⭐ **IMPORTANT CONCEPT:** Time budgets are non-negotiable rehearsal — if you blow 20 minutes on approach, you fail the mock even with a correct idea.

| Time | Activity |
|------|----------|
| 0:00 – 2:00 | Read problem. Confirm understanding. Ask 1–2 clarifying questions. |
| 2:00 – 5:00 | Think aloud. Pattern recognition. Brute force first. |
| 5:00 – 8:00 | Optimal approach. Explain time/space complexity. |
| 8:00 – 30:00 | Code the solution. |
| 30:00 – 35:00 | Trace through with the given example. |
| 35:00 – 40:00 | Test edge cases (empty array, single element, duplicates, negatives). |
| 40:00 – 45:00 | Discuss alternatives and optimizations. |

### What to Verbalize (Always)

```text
"My first thought is... [brute force]"
"The bottleneck is... [identify what's slow]"
"I can improve this by... [optimal approach]"
"This runs in O(n log n) time and O(n) space because..."
"Edge cases I should check: null, empty, all duplicates, INT_MAX"
```

### DSA Self-Evaluation Rubric

> ⭐ **IMPORTANT CONCEPT:** Rubrics force honest calibration — track scores over 10+ mocks; your bottom two categories get double practice time.

| Score | Meaning |
|-------|---------|
| 5 | Optimal solution, coded correctly, caught all edge cases, clean code, full explanation |
| 4 | Correct solution, minor issues (forgot edge case, small bug fixed during trace) |
| 3 | Correct approach, significant bug or missed edge case |
| 2 | Wrong approach but recovered with hints |
| 1 | Didn't reach a working solution |

**Target:** 4+ on medium in 30 min · 3+ on hard in 45 min

### Common DSA Mistakes

```text
❌ Jumping into code without explaining the approach
❌ Silently thinking for 5+ min (narrate your thoughts)
❌ Off-by-one errors in loops/indices (test on paper first)
❌ Forgetting null checks (ListNode, TreeNode)
❌ Not checking edge cases at the end
❌ Miscounting indices (draw an example!)
```

---

## How to Run a LLD Mock (45 min)

### Time Budget

| Time | Activity |
|------|----------|
| 0:00 – 5:00 | Gather requirements. Key operations? Scale? Concurrency? |
| 5:00 – 15:00 | Identify entities and relationships. Draw class diagram. |
| 15:00 – 30:00 | Code core classes and methods. Show key design decisions. |
| 30:00 – 40:00 | Handle edge cases, concurrency, extensibility. |
| 40:00 – 45:00 | Discuss what you'd add with more time. |

### What Interviewers Test in LLD

| Dimension | What they're looking for |
|-----------|------------------------|
| OOP | Proper encapsulation, right use of interfaces/abstract classes |
| Design patterns | Knowing when to use Strategy, Observer, Factory, Builder, Singleton |
| Extensibility | Can you add new features without modifying existing code? |
| Concurrency | Thread safety without over-locking |
| Clean code | Good naming, single responsibility, small methods |

### LLD Self-Evaluation Rubric

> ⭐ **IMPORTANT CONCEPT:** LLD scores reward extensibility and concurrency awareness — working code that is tightly coupled is a 2, not a 4.

| Score | Meaning |
|-------|---------|
| 5 | Clean design, right abstractions, extensible, handles concurrency, code compiles mentally |
| 4 | Good design, minor issues (slight duplication, missed a concurrency point) |
| 3 | Correct behavior, but bad OOP or missed extensibility |
| 2 | Working code but tightly coupled, hard to extend |
| 1 | Didn't finish core design |

### Top LLD Problems to Master

| # | Problem |
|---|---------|
| 1 | Parking Lot |
| 2 | Library Management System |
| 3 | Hotel Room Booking |
| 4 | Ride-Sharing App (Uber) |
| 5 | Chess / Tic-Tac-Toe |
| 6 | ATM Machine |
| 7 | Elevator System |
| 8 | Rate Limiter (token bucket) |
| 9 | In-Memory Cache (LRU/LFU) |
| 10 | Notification System |

### Must-Know Design Patterns

| Pattern | When to use |
|---------|-------------|
| Strategy | Swap algorithms at runtime (payment methods, sorting) |
| Observer | Event-driven — one producer, many consumers (EventBus, Kafka) |
| Factory | Create objects without specifying exact class (ShapeFactory) |
| Builder | Complex object construction with optional params (SQL query builder) |
| Singleton | One instance globally (config, DB pool) — watch thread safety |
| Decorator | Add behavior without subclassing (compression, encryption on streams) |
| Command | Encapsulate requests as objects (undo/redo, task queues) |
| Template | Algorithm skeleton, subclasses fill steps (report generation) |

---

## How to Run a HLD Mock (60 min)

### Time Budget

> ⭐ **IMPORTANT CONCEPT:** HLD time budget: 5 min requirements, ~3 min capacity, ~10 min high-level, ~25 min deep dive, ~10 min failures — skipping capacity or failures costs a full point on most rubrics.

| Time | Activity |
|------|----------|
| 0:00 – 5:00 | Requirements gathering. Functional + Non-Functional. |
| 5:00 – 8:00 | Capacity estimation. QPS, storage, bandwidth. |
| 8:00 – 18:00 | High-level design. Draw major components + data flow. |
| 18:00 – 45:00 | Deep dive: DB design, caching, consistency. |
| 45:00 – 55:00 | Failure scenarios, bottlenecks, scaling. |
| 55:00 – 60:00 | Trade-offs and what you'd do differently. |

### Requirements Gathering Template

```text
Functional (must-have):
  "What are the core operations the system must support?"
  "Who are the users?" (end users / internal / both)
  "Any specific workflows I should focus on?" (happy path first)

Non-Functional:
  "How many users?" → estimate DAU, MAU
  "Expected QPS?" → read vs write ratio?
  "Acceptable latency?" → p50? p99?
  "Consistency requirements?" (strong vs eventual)
  "Availability SLA?" (99.9%? 99.99%?)
  "Global or single-region?"
  "Data retention requirements?"
```

### HLD Self-Evaluation Rubric

> ⭐ **IMPORTANT CONCEPT:** A 5 requires failure modes + trade-offs articulated out loud — pretty boxes without "what breaks at 10×" is a 3.

| Score | Meaning |
|-------|---------|
| 5 | Complete design, correct at scale, handles failures, clear trade-off articulation |
| 4 | Solid design, 1–2 gaps (forgot monitoring, or missed DB index discussion) |
| 3 | Correct high-level, weak deep dive (no schema, vague on caching) |
| 2 | Incomplete or incorrect scaling assumptions |
| 1 | No clear structure, unclear data flow |

---

## How to Run a Behavioral Mock (30 min)

### Format

```text
5 questions, 4–5 min each.
Rotate through categories:
  - Ownership
  - Conflict Resolution
  - Failure
  - Cross-team Collaboration
  - Technical Leadership
  - Ambiguity Handling
```

### Behavioral Self-Evaluation Rubric

| Score | Meaning |
|-------|---------|
| 5 | Specific, quantified, clear Action in STAR, demonstrates growth/learning |
| 4 | Good story, minor vagueness (result not quantified) |
| 3 | Story is there but "we"-heavy, action unclear |
| 2 | Generic answer without specific story |
| 1 | No answer / theoretical |

### Common Behavioral Failure Modes

```text
❌ "We solved it as a team" (no specific contribution from you)
❌ "I just followed the process" (shows no initiative)
❌ Results like "it went better" instead of "latency dropped 40%"
❌ Story is 30 seconds (too shallow) or 10 minutes (can't communicate concisely)
❌ No learning or reflection at the end
```

---

## Improvement Protocol Between Sessions

### After Every Mock

```text
1. Write down: what went well? what didn't?
2. DSA:      Re-solve the problem in 24 hours without looking at solution
3. LLD:      Redraw the class diagram from memory in 48 hours
4. HLD:      Write a 1-page design doc for the system you designed
5. Behavioral: Tighten the action, add numbers to the result
```

### Mock Log

Keep a running log:

| Date | Type | Problem | Score | What to fix |
|------|------|---------|-------|-------------|
| — | — | — | — | — |

After 10 mocks: identify your bottom 2 categories. Double practice time on those.

### Finding Mock Partners

```text
Platforms: Pramp, Interviewing.io, Meetapro
Or: find a peer prepping for the same company — pair up and rotate roles.

Pro tip: being the interviewer teaches you faster.
         You see mistakes others make — and stop making them yourself.
```

---

## Interview Day Tips

### Before

```text
Night before: review 1 behavioral story, 1 system design framework, 1 DSA pattern
Morning of:   light practice (no new hard problems), warm up with 1 easy problem
30 min before: water, quiet space, IDE/whiteboard ready
```

### During

```text
If stuck:
  1. Think out loud: "I'm stuck on X, let me try..."
  2. Simplify: "What if there were no duplicates?"
  3. Ask for a hint — it's fine: "Would a greedy approach work here?"
  4. Start with brute force. Partial credit is real.

Time management:
  If 20 min in and still coding brute force: say "let me first get this working,
  then optimize" — don't silently abandon a working solution for a wrong fast one.
```

### After Each Round

```text
Write notes immediately: questions asked, how you answered, what felt off.
Helps calibrate during debrief prep and next interview.
Don't share specific questions publicly (NDA) — process your own notes only.
```


---

## Full Problem Banks

> ⭐ **IMPORTANT CONCEPT:** Problem banks are for deliberate rotation — tag by company style and never repeat the same HLD two weeks in a row before onsite.

### DSA Problem Bank (with company tags)

| # | Problem | Pattern | Tags |
|---|---------|---------|------|
| 1 | Two Sum / variants | Hash map | Warmup, all |
| 2 | Longest Substring Without Repeating | Sliding window | Meta, Amazon |
| 3 | Minimum Window Substring | Sliding window hard | Google, Meta |
| 4 | Container With Most Water | Two pointers | Meta, Amazon |
| 5 | Trapping Rain Water | Two pointers / stack | Google, Amazon |
| 6 | 3Sum | Two pointers | Amazon, Meta |
| 7 | Search in Rotated Sorted Array | Binary search | Meta, Apple |
| 8 | Median of Two Sorted Arrays | Binary search hard | Google |
| 9 | Binary Search on Answer (Koko / capacity) | BS on answer | Google, Amazon |
| 10 | Merge k Sorted Lists | Heap | Amazon, Meta |
| 11 | Top K Frequent Elements | Heap / bucket | Meta, Amazon |
| 12 | LRU Cache | Design + Hash+DLL | All FAANG |
| 13 | LFU Cache | Design hard | Google |
| 14 | Number of Islands | BFS/DFS grid | Amazon, Meta |
| 15 | Word Ladder | BFS | Google, Amazon |
| 16 | Course Schedule I/II | Topological sort | Amazon, Google |
| 17 | Network Delay Time | Dijkstra | Google |
| 18 | Alien Dictionary | Graph + topo | Meta, Google |
| 19 | Serialize/Deserialize Binary Tree | Tree design | Meta, Amazon |
| 20 | Lowest Common Ancestor | Tree | All |
| 21 | Binary Tree Max Path Sum | Tree DP | Meta, Amazon |
| 22 | Word Break I/II | DP | Amazon, Google |
| 23 | Longest Increasing Subsequence | DP / patience | Google |
| 24 | Edit Distance | DP | Google, Apple |
| 25 | Burst Balloons / Interval DP | Interval DP | Google |
| 26 | Climbing Stairs / House Robber variants | 1D DP | Warmup |
| 27 | Coin Change | Unbounded knapsack | Amazon |
| 28 | Combination Sum / Subsets | Backtracking | Meta, Amazon |
| 29 | N-Queens / Sudoku | Backtracking | Google, Apple |
| 30 | Merge Intervals / Meeting Rooms | Intervals | Meta, Amazon |
| 31 | Insert / InsertII | Design | Meta, Amazon |
| 32 | Time Based Key-Value Store | BS design | Google |
| 33 | Find Median from Data Stream | Two heaps | Google, Amazon |
| 34 | Sliding Window Maximum | Monotonic dequeue | Google |
| 35 | Daily Temperatures | Monotonic stack | Meta |
| 36 | Basic Calculator I/II/III | Stack parsing | Google |
| 37 | Decode String | Stack | Meta |
| 38 | Copy List with Random Pointer | Linked list | Amazon |
| 39 | Reverse Nodes in k-Group | Linked list | Meta, Amazon |
| 40 | Union-Find (Accounts Merge / Redundant Conn) | DSU | Google, Amazon |

**DSA mock rotation rule:** 2 medium + 1 hard per week under timer; re-solve any < 4 score within 48h blind.

### LLD Problem Bank

| # | Problem | Focus | Tags |
|---|---------|-------|------|
| 1 | Parking Lot | Polymorphism, fees | Amazon |
| 2 | Library / Book Lending | Reservations | Amazon |
| 3 | Hotel Booking | Concurrency of rooms | Booking-style |
| 4 | Elevator System | Scheduling strategy | Google |
| 5 | Chess / Tic-Tac-Toe | Rules engine | Meta, Google |
| 6 | ATM / Vending | State machine | Amazon |
| 7 | Ride Sharing (Uber) | Matching, pricing hooks | Uber/Meta |
| 8 | Rate Limiter | Token/leaky/sliding | All |
| 9 | LRU / LFU Cache | Concurrency | All |
| 10 | Notification System | Channels, templates | Amazon |
| 11 | Pub/Sub In-Memory | Observer | Meta |
| 12 | Splitwise | Graph balances | Amazon |
| 13 | Snake & Ladder | Board games | Amazon |
| 14 | Stock Exchange matching | Order book | Jane Street-ish / hard LLD |
| 15 | Distributed ID Generator (API-level) | Snowflake-ish | All |
| 16 | File System (in-memory) | Composite tree | Google |
| 17 | Keyword Autocomplete | Trie | Google, Meta |
| 18 | Logging / Metrics client | Buffering, flush | Meta |
| 19 | Workflow Engine (simple) | State + transitions | Uber |
| 20 | Multiplayer Game lobby | Matchmaking | Meta |

### HLD Problem Bank

| # | System | Scale cue | Tags |
|---|--------|-----------|------|
| 1 | URL Shortener | 100M URLs, low latency redirect | All |
| 2 | Pastebin / Dropbox lite | Object storage | Google, Amazon |
| 3 | Twitter / News Feed | Fan-out hybrid | Meta, Twitter |
| 4 | Instagram Feed + Stories | Media, CDN | Meta |
| 5 | WhatsApp / Messenger | WebSocket, delivery | Meta, Google |
| 6 | YouTube / Netflix streaming | CDN, transcoding | Google, Netflix |
| 7 | Uber / Lyft matching | Geo, realtime | Uber |
| 8 | Ticketmaster / BookMyShow | Hot events, inventory | Amazon |
| 9 | Rate Limiter service | Redis, distributed | All |
| 10 | Notification platform | Priority queues | Amazon, Meta |
| 11 | Search autocomplete | Trie + cache | Google |
| 12 | Web crawler | Frontier, politeness | Google |
| 13 | YouTube comments / Reddit | Ranking, shards | Meta, Google |
| 14 | Distributed cache | Consistent hashing | All |
| 15 | Kafka-like queue | Partitioning, ISR | All |
| 16 | Payment system | Idempotency, ledger | Stripe, Amazon |
| 17 | Ride receipts / Order history | CQRS | Uber, Amazon |
| 18 | Google Docs collaborative | OT/CRDT | Google |
| 19 | Distributed cron / scheduler | SKIP LOCKED | Uber, Airbnb |
| 20 | Metrics / Observability pipeline | High ingest | Meta, Uber |
| 21 | Ad click aggregator | Exactly-once-ish | Meta, Google |
| 22 | Multiplayer game backend | Rooms, authority | Meta |
| 23 | Photo sharing (Flickr-scale) | EXIF, CDN | Apple, Meta |
| 24 | Stock broker / exchange | Matching, seq | Hard HLD |
| 25 | Typeahead + spellcheck | Latency budgets | Google |

---

## Scorecard Templates

### Master Mock Scorecard (print / duplicate per session)

| Field | Entry |
|-------|-------|
| Date | |
| Type (DSA/LLD/HLD/Behavioral/Full loop) | |
| Problem / Prompt | |
| Partner / Self | |
| Time limit / actual | |
| Overall score (1–5) | |
| Top strength | |
| Top gap | |
| Fix-by date | |
| Blind re-solve done? | Y/N |

### Dimension Scores

| Dimension | 1 | 2 | 3 | 4 | 5 | Today |
|-----------|---|---|---|---|---|-------|
| Clarifying questions | | | | | | |
| Approach quality | | | | | | |
| Correctness | | | | | | |
| Complexity analysis | | | | | | |
| Code / diagram clarity | | | | | | |
| Edge cases / failures | | | | | | |
| Communication | | | | | | |
| Time management | | | | | | |

### HLD-Only Extra Row
| Capacity estimation | Schema | Caching | Consistency | Failure modes | Tradeoffs |

### Pass Bar (Self)
```text
DSA medium: ≥ 4 in 30–35 min
DSA hard:   ≥ 3 in 45 min (optimal approach clear even if code bumpy)
LLD:        ≥ 4 with extensibility called out
HLD:        ≥ 4 including failures + tradeoffs
Behavioral: ≥ 4 with quantified Result and clear "I" Actions
```

---

## Partner Feedback Script

> 🛠️ **PRACTICAL:** Read this script verbatim for the first 3 partner mocks — consistency beats vague "you did fine."

```text
INTERVIEWER (after timer):
1. Overall score: _ / 5 because _
2. What worked (max 2 bullets):
3. Highest-leverage fix (ONE thing):
4. Timestamp notes:
   - 0–10 min: _
   - Middle: _
   - Last 10: _
5. Would I advance this candidate? Yes / Lean yes / No
6. Candidate repeats back the one fix in their own words.
```

**Candidate self-note (2 min, silent):**
```text
I will change __________ in the next mock.
I will re-solve / redraw __________ within 48 hours.
```

---

## Company-Specific Mock Tips

### Google
```text
- Expect follow-ups that generalize ("what if 10×?", "what if sorted?")
- HLD: clean APIs, estimation honesty, consensus/consistency nuance
- DSA: optimal solution + proof-ish explanation; code quality matters
- Behavioral: collaboration + teaching; avoid arrogance
Mock tip: After solving, spend last 5 min on alternatives you rejected.
```

### Meta
```text
- Speed and product sense; coding fluency under time pressure
- HLD: feed/fanout, cache, async — know Meta-classic systems cold
- Behavioral: impact metrics, conflict OK if resolved fast
Mock tip: Practice finishing a medium in 20–25 min with clean code.
```

### Amazon
```text
- LP behavioral density — mock with LP follow-ups ("Why?", "Tell me more")
- HLD: operational excellence — monitoring, failure, cost
- DSA: solid mediums; don't skip edge cases
Mock tip: Every HLD mock must include metrics, alarms, and rollback.
```

### Apple (bonus)
```text
- Depth over buzzwords; privacy / quality angles welcome
- Polish explanations; less "move fast break things" energy
```

| Company | DSA flavor | HLD flavor | Behavioral flavor |
|---------|------------|------------|-------------------|
| Google | Hard optimality | Scale + elegance | Collab / humility |
| Meta | Speed + correctness | Social/graph systems | Impact / urgency |
| Amazon | Medium+edge cases | Ops + customer impact | LP depth |
| Apple | Clean code | Craft + constraints | Quality bar |

---

## Week-by-Week Mock Calendar — Final Month

Assume 4 weeks until onsite/loop.

### Week −4 (Foundation under timer)
| Day | Mock | Notes |
|-----|------|-------|
| Mon | DSA medium ×2 | Scorecard required |
| Tue | LLD Parking Lot or Rate Limiter | Diagram first |
| Wed | HLD URL Shortener | Strict 60 min |
| Thu | DSA hard ×1 | Google-style follow-ups |
| Fri | Behavioral 5Q | Record audio |
| Sat | Light review of gaps | No new topics |
| Sun | Rest or 1 easy warmup | |

### Week −3 (Raise difficulty)
| Day | Mock | Notes |
|-----|------|-------|
| Mon | DSA hard (Meta timed) | |
| Tue | LLD concurrent cache / pubsub | |
| Wed | HLD News Feed or Chat | |
| Thu | DSA mixed medium+hard | |
| Fri | Behavioral LP deep-dive (Amazon) | |
| Sat | Half-loop: DSA + HLD | |
| Sun | Blind re-solves of <4s | |

### Week −2 (Company targeting)
| Day | Mock | Notes |
|-----|------|-------|
| Mon | Company-tagged DSA bank ×2 | |
| Tue | LLD from company-heavy list | |
| Wed | HLD from company tags | |
| Thu | Behavioral remix (Google/Meta/Amazon) | |
| Fri | Full loop (3–4 hrs) | Partner if possible |
| Sat | Full loop #2 OR gap clinic | |
| Sun | Rest + story bank polish | |

### Week −1 (Taper)
| Day | Mock | Notes |
|-----|------|-------|
| Mon | DSA medium polish | No brand-new hard patterns |
| Tue | HLD familiar system, focus delivery | |
| Wed | Behavioral interrupt drill | |
| Thu | Light LLD OR rest | |
| Fri | 1 easy DSA + logistics check | |
| Sat | Light review cheat sheets | |
| Sun | Stop early; sleep | |

> ⭐ **IMPORTANT CONCEPT:** Peak performance needs a taper — the final week is calibration and sleep, not heroic new topics.

---

## Practical Mock Drills

### Drill 1 — Silent Timer Honesty
```text
Phone timer visible. No pausing. No Stack Overflow.
If stuck 3 min: narrate brute force; implement partial.
```

### Drill 2 — Approach-Only Sprint
```text
10 DSA prompts × 3 min each: name pattern + complexity + 3 edge cases. No code.
Builds Meta/Google opening speed.
```

### Drill 3 — HLD Whiteboard Compression
```text
Pick a bank system. 8 min: FR/NFR + capacity + boxes only.
Partner scores clarity of data flow arrows.
```

### Drill 4 — Behavioral Interrupts
```text
Partner cuts in with "What did you do?" every 45s until Action is crisp.
```

### Drill 5 — Rubric Blind Grading
```text
Exchange recordings with partner; grade with scorecard without discussion first.
Calibrate scores within 1 point.
```

> 🛠️ **PRACTICAL:** Schedule 12 mocks on the calendar this month (non-negotiable). Quality > quantity only after you hit 12 with scorecards filled.

---

## Important Concepts Checklist — Mock Interviews

- [ ] Time budgets memorized for DSA/LLD/HLD/Behavioral
- [ ] Rubrics used every session; log kept
- [ ] Problem banks rotated with company tags
- [ ] Partner feedback script followed
- [ ] Company-specific tips applied in at least 2 mocks each
- [ ] Final-month calendar executed (or adapted with same volume)
- [ ] Blind re-solve within 48h for any score ≤ 3
- [ ] Full loops ≥ 2 in the last 3 weeks
- [ ] Interview-day logistics rehearsed once

---
