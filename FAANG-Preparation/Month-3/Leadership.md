# Leadership for Senior Engineers — Complete Study Notes

> **Self-contained. No internet needed.**
> Focused on Staff/Senior engineer interviews at FAANG.
> Covers: Technical Leadership → Architecture Ownership → Mentoring → Stakeholder Management → Tradeoffs → Execution → Incident Ownership

---

## Table of Contents

| # | Topic |
|---|-------|
| 1 | [Technical Leadership](#1-technical-leadership) |
| 2 | [Architecture Ownership](#2-architecture-ownership) |
| 3 | [Mentoring](#3-mentoring) |
| 4 | [Stakeholder Management](#4-stakeholder-management) |
| 5 | [Tradeoff Communication](#5-tradeoff-communication) |
| 6 | [Execution Planning](#6-execution-planning) |
| 7 | [Incident Ownership](#7-incident-ownership) |

---

## 1. Technical Leadership

### What It Means at FAANG Level

Not just "I wrote the design doc." Technical leadership means:
- Driving technical direction for a feature, service, or team
- Making architectural decisions and **owning their outcomes**
- Creating clarity where there is ambiguity
- Multiplying team output through better decisions upstream

### How to Demonstrate It in Interviews

```text
"I drove the technical direction for X. Here's how I approached it:
  1. Gathered context (existing systems, constraints, team strengths)
  2. Wrote a design doc with 3 options + tradeoffs
  3. Got alignment from stakeholders before building
  4. Set up review checkpoints (not just a final review)
  5. Tracked decisions and rationale (ADRs)"
```

### Decision-Making Framework

| Type | What it is | How to approach |
|------|-----------|----------------|
| **Type 1** | Irreversible, hard to undo | Go slow, get alignment, document |
| **Type 2** | Reversible, can be undone | Go fast, decide with 70% info, learn and adjust |

> ⭐ **IMPORTANT CONCEPT:** Misclassifying Type 2 as Type 1 slows teams to death; misclassifying Type 1 as Type 2 creates irreversible damage — Staff+ interviews probe this judgment constantly.

> **💡 Key insight:** Most technical decisions are Type 2. Don't treat them like Type 1. (From Jeff Bezos's 2016 shareholder letter.)

### Architecture Decision Records (ADRs)

> ⭐ **IMPORTANT CONCEPT:** ADRs prove you own outcomes — interviewers want to hear *why* you chose X, what you rejected, and what you'd revisit if constraints change.

Lightweight docs that capture: decision, context, consequences.

```markdown
# ADR-0042: Use Redis for Rate Limiting Instead of In-Memory

## Status
Accepted

## Context
Need to rate limit at 10K RPS across 20 service instances.
In-memory would allow 10K RPS per instance, not total.

## Decision
Use Redis with token bucket algorithm.

## Consequences
- Requires Redis cluster (already in stack)
- +0.5ms per request for Redis round-trip
- Correctly enforces global rate limits
- If Redis fails: fail open (log, but don't block requests)
```

---

## 2. Architecture Ownership

### What Owners Do
- Know the **entire system**, not just their service
- Track technical debt explicitly — not "we'll fix it later" but documented + prioritized
- Plan migrations (not big-bang rewrites — strangler fig pattern)
- Define service boundaries and contracts
- Ensure non-functional requirements are built in, not bolted on

### Managing Technical Debt

```text
Not all debt is equal. Classify it:

Deliberate:   Consciously taken, documented, planned to repay.
              "Skipping validation for MVP, will add before scaling to 10 customers."
Accidental:   Only learned it was wrong later — refactor when you next touch the code.
Reckless:     No planning, cowboy code — needs dedicated effort.
```

**How to get time for debt:**
1. Track it publicly (backlog, not a mental list)
2. Show cost: "This adds 2 hours to every feature in auth"
3. Bundle with feature work: "I can refactor the auth module while building SSO"
4. Propose the **smallest** possible improvement (not a full rewrite)

### Strangler Fig Migration Pattern

> ⭐ **IMPORTANT CONCEPT:** Prefer strangler fig (parallel + gradual cutover + rollback at every phase) over big-bang rewrites — Staff interviews fail candidates who romanticize greenfield.

Safe way to migrate a legacy system without a big-bang cutover:

```text
Phase 1: New system and old run in parallel. New handles subset of traffic.
Phase 2: Gradually shift traffic (feature flag, % rollout).
Phase 3: Old system becomes a passthrough to new.
Phase 4: Old system decommissioned.

At each phase: rollback plan exists.
```

---

## 3. Mentoring

### Levels of Mentoring

| Level | What it looks like | Impact |
|-------|-------------------|--------|
| 1 | Answering questions (reactive) | Minimum |
| 2 | Pairing on hard problems | Medium |
| 3 | Guiding growth conversations | High |
| 4 | **Sponsoring** — publicly advocating for visibility/promotion | Highest |

### Effective 1:1 Structure (as a mentor)

Monthly 30-min focused conversation — not a weekly catch-up:

```text
1. What's the hardest thing you've worked on this month?
2. Where did you feel stuck or uncertain?
3. What did you learn?
4. What do you want to work on next?
5. Anything I can help remove for you?
```

Goals: 1 stretch goal per quarter for the mentee. Notice when they need a nudge vs a guardrail.

### Code Review as Mentoring

```text
❌ Bad:  "This is wrong, fix it."
✅ Good: "This will have a performance problem at scale because X.
          One approach is Y. What do you think?"
```

**Rules for great code reviews:**
- Separate nits from blockers — label them clearly
- Explain **WHY**, not just WHAT
- Ask questions instead of demands for non-blocking issues
- Acknowledge good work explicitly: "Nice pattern here, this is much cleaner"
- Don't fix it for them — point at the problem

---

## 4. Stakeholder Management

### The Core Problem

Engineering and business speak different languages. Your job: **translate**.

### Communicating Up (to managers, directors, VPs)

| They care about | They don't care about |
|----------------|----------------------|
| Risk, schedule, cost | Implementation details |
| Customer impact | Specific libraries |
| Options + recommendation | Algorithm choice |

**Status update template:**
```text
"We are [on track / at risk / blocked] on [project].
 Expected completion: [date].
 [If at risk]: The risk is [X]. Options are:
   A) [option] — costs [time/money], gives [outcome]
   B) [option] — costs [time/money], gives [outcome]
 My recommendation: [A/B] because [reason].
 I need a decision by [date] or [consequence]."
```

### Communicating Across (to other teams)

```text
Before asking for help: understand their priorities.
Frame your ask as: "This would help us both because..."
Always offer to do the work that's in your power.
Written agreement (Slack/doc) beats verbal — prevents "I never said that."
```

### Managing Pushback on Timelines

When asked to do more in less time, offer options — never just say no or silently commit to the impossible:

```text
Option 1: Reduce scope  — "We ship X by [date], add Y in the next sprint"
Option 2: Reduce quality — "Skip test coverage now, add later (document this)"
Option 3: Add people    — "If we add one engineer now, we hit the date"
Option 4: Slip the date — "The date can move if the scope can't"
```

> **⚠️ Never commit to an impossible timeline.** Miss one estimate → you lose trust permanently.

---

## 5. Tradeoff Communication

### The Framework

For every technical decision, present in this structure:

```text
Option A: [Name]
  Pros: ...
  Cons: ...
  Best for: ...

Option B: [Name]
  Pros: ...
  Cons: ...
  Best for: ...

My recommendation: [A/B] because [specific reason tied to our constraints].
```

### Common Tradeoffs to Know Cold

**Consistency vs Availability (CAP):**

| Consistency | Availability | Use for |
|-------------|-------------|---------|
| Strong (CP) | Reduced during partition | Financial data, inventory |
| Eventual (AP) | Always available | Social feeds, like counts |

**Synchronous vs Asynchronous:**

| Sync | Async |
|------|-------|
| Simpler mental model, easier debugging | Decoupled, more resilient |
| Higher coupling, blocking | Harder to reason about ordering/errors |

**SQL vs NoSQL:**

| Type | Best for |
|------|---------|
| SQL (ACID, rich queries) | Financial, transactional workloads |
| Cassandra (scale-out writes) | Time series, events, high-write |
| MongoDB (flexible schema) | Rapidly changing schema |
| Redis (in-memory speed) | Caching, rate limiting, sessions |

**Monolith vs Microservices:**

```text
Monolith:      Start here. Simpler ops, no network calls, easy refactor.
Microservices: When you need independent scale/deploy, or teams are large.

Rule: Don't split until the monolith is painful.
```

**Build vs Buy:**

```text
Build: when the capability is core to your competitive advantage
Buy:   when it's commodity (payments → Stripe, email → SendGrid)
OSS:   middle ground — control without full build cost
       Watch for: ops burden, support quality, license terms
```

---

## 6. Execution Planning

### Breaking Down a Project

```text
Step 1: Write the goal (1 sentence, measurable)
Step 2: Identify all external dependencies (other teams, data, infra)
        → Resolve these first — they're the highest risk
Step 3: Identify highest-risk technical unknowns → spike on these first
Step 4: Define milestones (not tasks) — demo-able states of the system
Step 5: Assign each milestone an owner
Step 6: Work backwards from deadline; build 20% buffer for unknowns
```

### Estimation

```text
Use T-shirt sizes first (S/M/L/XL) — rough alignment before details.

"Engineer time" ≠ "calendar time":
  1 engineer-week ≈ 3 productive days (meetings, reviews, interruptions)
  Add 20% for unknown unknowns
  Add scope for tests, docs, code review, monitoring

Three-point estimation (PERT):
  O = Best case (everything works first time)
  M = Most likely (normal dev with normal issues)
  P = Worst case (surprises, rework)
  Estimate = (O + 4M + P) / 6
```

### Risk Management

| Probability | Impact | Action |
|-------------|--------|--------|
| High | High | Address immediately — top priority |
| High | Low | Monitor and mitigate |
| Low | High | Have contingency plan ready |
| Low | Low | Accept and move on |

For each risk: What reduces probability? What if it happens?

---

## 7. Incident Ownership

### Incident Commander (IC) Role

> ⭐ **IMPORTANT CONCEPT:** The IC drives roles, cadence, and decisions under uncertainty — they do *not* deep-debug; separating command from investigation is a Staff+ signal.

One person drives. Everyone else executes.

```text
IC responsibilities:
  - Opens incident channel: #inc-2024-11-payment-service-down
  - Assigns roles: investigator, comms lead, subject matter expert
  - Owns the timeline (what happened, when, by whom)
  - Makes calls under uncertainty (rollback? restart? wait?)
  - Drives post-mortem
```

### Incident Response Flow

```text
1. DETECT (seconds → minutes)
   Alert fires or customer reports. Acknowledge immediately.
   Severity: SEV1 (all users, revenue impact) / SEV2 (partial) / SEV3 (minor)

2. MITIGATE (minutes)
   Goal: stop the bleeding. Fastest fix even if not root cause.
   Options: rollback deploy, toggle feature flag, add capacity, redirect traffic

3. INVESTIGATE (parallel with mitigation)
   Check: recent deploys, metrics dashboards, error logs, traces.
   Don't guess — follow the data. Form hypothesis, test it.

4. RESOLVE
   Root cause fixed or mitigated. Monitor 15+ min before declaring resolved.

5. COMMUNICATE
   Update status page and stakeholders on a cadence. Don't go dark for 30+ min.

6. POST-MORTEM (within 48 hours)
   Blameless. Focus on systems, not people.
   Required sections: timeline, impact, root cause, contributing factors,
   action items (with owners + deadlines)
```

### Post-Mortem Anti-Patterns

```text
❌ "Human error" as root cause → always ask WHY the human made that error
❌ Blame the on-call       → systems should be resilient to human mistakes
❌ Action items with no owner/deadline → they never get done
❌ Only technical fixes    → often need process/monitoring/alerting fixes too
❌ Post-mortem shelved     → review action items in the very next sprint
```

### Five Whys Example

```text
Problem: Payment service down for 22 minutes.

Why 1: DB connection pool exhausted
Why 2: New deploy created connections per-request instead of using pool
Why 3: Code written without pooling — not caught in review
Why 4: No static analysis rule for this pattern
Why 5: No one had defined coding standards for connection management

Root cause: Missing coding standard + no automated enforcement

Action items:
  1. Add static analysis rule (linting)       — Owner: Alex,      Due: Next sprint
  2. DB connection pool saturation alert       — Owner: Maria,     Due: This week
  3. Add to code review checklist             — Owner: Team lead, Due: Today
```


---

## 8. Staff+ Interview Signal Map

> ⭐ **IMPORTANT CONCEPT:** Staff+ interviews reward *scope of influence*, *decision quality under ambiguity*, and *org-level leverage* — not just personal coding speed.

| Signal | What interviewers listen for | Weak signal | Strong signal |
|--------|------------------------------|-------------|---------------|
| Technical judgment | Type 1 vs 2, tradeoff framing | "I'd just use Kafka" | Constraints → options → recommendation → revisit triggers |
| Architecture ownership | Boundaries, debt, migrations | "We should rewrite" | Strangler plan, ADRs, rollback, NFRs first-class |
| Execution | Delivery under ambiguity | Heroic nights | Milestones, buffers, risk register, stakeholder options |
| Mentorship / multiplication | Others leveled up | "I answered questions" | Sponsorship, review-as-teaching, reusable playbooks |
| Cross-org influence | No authority wins | Escalated immediately | Their-goals framing, written contracts, shared specs |
| Incident leadership | IC behaviors | Only debugged | Roles, cadence, mitigate-first, blameless follow-through |
| Communication | Up/across translation | Jargon dump | Options + recommendation + decision deadline |
| Strategy | Multi-quarter bets | Feature laundry list | Platform leverage, measurable north-star |

### Leveling Rubric (Rough)
```text
Senior:   Owns a project/service end-to-end; solid tradeoffs; mentors juniors
Staff:    Sets direction across teams; RFCs land; reduces org ambiguity; multi-quarter impact
Principal: Company-level technical strategy; creates mechanisms others run without you
```

### Story Prompts That Surface Staff Signals
```text
- "Tell me about a technical decision that affected multiple teams."
- "Describe a migration you led."
- "How do you create alignment when stakeholders disagree?"
- "What's an RFC you're proud of — and what changed because of it?"
- "Time you influenced a roadmap you didn't own."
```

---

## 9. Design Review Facilitation

### Why This Matters in Interviews
Facilitating design reviews shows you can create clarity for a room — a Staff+ multiplier skill.

### Facilitator Playbook
```text
Before (async):
  1. Require a doc ≥ 24h ahead (problem, constraints, options, recommendation)
  2. Collect written comments; group themes (correctness, scale, ops, cost)
  3. Timebox the meeting; publish agenda

During (45–60 min):
  1. 3 min: restate problem + non-goals (you control scope)
  2. 5 min: author walks recommendation (not a slide novel)
  3. 25 min: discuss open questions only — park nits in doc
  4. 10 min: decide or explicitly defer with owner + date
  5. 5 min: capture ADR-worthy decisions out loud

After:
  1. Publish decision log within 24h
  2. File ADRs for Type 1 choices
  3. Track dissent: "Disagree and commit" named if used
```

### Facilitation Phrases
```text
"Let's separate correctness concerns from taste preferences."
"What would have to be true for option B to win?"
"Is this Type 1 or Type 2? If Type 2, can we decide today with a revisit date?"
"I'm hearing consensus on X; parking Y for a spike — owner?"
```

### Anti-Patterns
```text
❌ Design-by-committee on every naming choice
❌ Author defending ego instead of constraints
❌ Meeting ends with "vibes were good" and no decision
❌ Silent dissent that resurfaces in implementation
```

> 🛠️ **PRACTICAL:** Take any system from your notes. Run a 20-min mock design review aloud: you are facilitator + author. Record decisions as a mini-ADR.

---

## 10. RFCs — Writing and Driving Adoption

### RFC Minimum Viable Structure
```markdown
# RFC-0XXX: Title

## Summary (5 lines)
## Motivation (user/biz pain + urgency)
## Non-goals
## Proposal (design + APIs/schemas)
## Alternatives considered (at least 2)
## Failure modes & operability (SLOs, dashboards, rollback)
## Rollout plan (flags, % traffic, migration)
## Open questions
## Decision (Accepted / Rejected / Accepted with changes)
```

### Driving Adoption Without Authority
```text
1. Socialize early with 2–3 skeptics (improve doc before broad share)
2. Pilot on one service; publish before/after metrics
3. Offer migration helpers (library, codemod, checklist)
4. Make the default path easy; old path annoying but safe during transition
5. Celebrate adopters publicly; help laggards privately
```

> 🌍 **Real-World:** Many FAANG teams treat RFCs as the unit of technical leadership — landing an RFC that three teams adopt beats a private "clever" design that only you understand.

### Interview Answer Skeleton
```text
"I wrote RFC-… because [pain]. Alternatives were A/B/C. We chose B due to [constraint].
 Rollout was strangler + flag. Adoption: N services in M weeks. Metric: [X].
 What I'd change: [learning]."
```

---

## 11. Influence Without Authority — Playbook

| Move | What to do | Why it works |
|------|------------|--------------|
| **Map incentives** | Learn their OKRs/on-call pain before asking | Ask lands as help, not tax |
| **Reduce their cost** | Offer to write RFC, tests, migration | Saying yes becomes cheap |
| **Create artifacts** | Shared spec, ADR, interface contract | Ambiguity is the real blocker |
| **Small yes first** | Pilot / spike / dual-run | Lowers perceived risk |
| **Public credit** | Thank publicly, critique privately | Earn Trust compounds |
| **Escalation last** | Escalate with recommendation + options | Managers decide faster; relationships survive |
| **Written trail** | Decisions in docs, not only Slack | Prevents rewrite of history |

### Escalation Template
```text
Context: [1–2 sentences]
Impact if unresolved by [date]: [user/revenue/risk]
Options:
  A) … cost … outcome
  B) … cost … outcome
Recommendation: [A/B] because …
Ask: decision by [date]
```

### Interview Story Checklist
- [ ] You understood their constraints first
- [ ] You did disproportionate work to unblock
- [ ] There was a written agreement
- [ ] Result was mutual, not extractive
- [ ] Relationship stronger afterward

---

## 12. Practical Leadership Scenarios — Model Answers

### Scenario 1: Director Asks for Impossible Date
```text
Bad:  "We'll try." / flat "No."
Good: "To hit DATE with current scope is ~30% likely. Options:
       1) Ship MVP (X,Y) by DATE; Z follows +2 weeks
       2) Add 1 senior for 3 weeks → still risk on dependency D
       3) Keep scope, move DATE to D+14
       I recommend (1) because it protects the customer demo without silent quality cuts.
       Need your pick by tomorrow noon."
```

### Scenario 2: Two Staff Engineers Disagree on Store
```text
"I'll facilitate a time-boxed decision. Criteria: consistency needs, QPS, ops burden, team familiarity.
 Each side: 1-page + prototype if Type 2. Decision owner: me (or TL) by Friday.
 We document ADR and commit — no re-litigating in PRs."
```

### Scenario 3: Legacy System Is On Fire; Rewrite Proposed
```text
"Big-bang rewrite fails the rollback test. Propose strangler:
 Phase 0: characterize traffic + SLOs
 Phase 1: extract highest-churn endpoint behind facade
 Phase 2: shift % traffic with flag
 Success metric: error budget + eng hours on firefighting
 I'll own the facade contract and weekly risk review."
```

### Scenario 4: You Are IC; Expert Wants to Keep Digging
```text
"Mitigation is rollback now; investigation continues in parallel.
 Expert: capture hypotheses in the doc. Comms: update in 10.
 We are optimizing for user recovery, not intellectual completeness."
```

### Scenario 5: Mentee Is Stuck and Embarrassed
```text
"Normalize struggle. Pair on problem decomposition, not typing.
 Set a 48h checkpoint with a tiny deliverable.
 Publicly credit progress; privately coach the gap (design-before-code, etc.)."
```

> 🛠️ **PRACTICAL:** Voice-answer each scenario in ≤ 90 seconds. Score yourself on: options offered, recommendation clarity, ownership language.

---

## Important Concepts Checklist — Leadership

- [ ] Type 1 vs Type 2 classification with examples
- [ ] ADRs: context, decision, consequences
- [ ] Strangler fig phases + rollback each phase
- [ ] Technical debt taxonomy (deliberate / accidental / reckless)
- [ ] Stakeholder updates: status + options + recommendation + deadline
- [ ] Tradeoff framing: 2 options minimum + constraint-tied pick
- [ ] Estimation: engineer-time ≠ calendar-time; PERT / buffers
- [ ] IC role ≠ primary debugger
- [ ] Blameless postmortem + Five Whys → owned action items
- [ ] Staff+ signals: RFC adoption, cross-team influence, multiplication
- [ ] Design review facilitation + decision log
- [ ] Influence-without-authority playbook rehearsed as STAR

> ⭐ **IMPORTANT CONCEPT:** Leadership interviews test whether you create mechanisms — docs, flags, reviews, error budgets — that make the right thing easy for everyone else.
