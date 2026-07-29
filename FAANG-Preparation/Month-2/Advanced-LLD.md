# Advanced Low Level Design — Complete Study Notes

> **Self-contained. No internet needed.**
> Covers: Hexagonal Architecture → Clean Architecture → Event-Driven Design → Thread-Safe Patterns → Design Projects

---

## Table of Contents

| # | Topic |
|---|-------|
| 1 | [Hexagonal Architecture (Ports and Adapters)](#1-hexagonal-architecture-ports-and-adapters) |
| 2 | [Clean Architecture](#2-clean-architecture) |
| 3 | [Event-Driven Design](#3-event-driven-design) |
| 4 | [Thread-Safe Design Patterns](#4-thread-safe-design-patterns) |
| 5 | [Design Projects](#5-design-projects) |
| 6 | [CQRS and Event Sourcing](#6-cqrs-and-event-sourcing) |
| 7 | [Domain-Driven Design (DDD)](#7-domain-driven-design-ddd) |
| 8 | [Saga Pattern — Distributed Transactions](#8-saga-pattern--distributed-transactions) |
| 9 | [Repository and Unit of Work Pattern](#9-repository-and-unit-of-work-pattern) |
| 10 | [Classic LLD Design Problems](#10-classic-lld-design-problems) |
| 11 | [LLD Interview Q&A — 40 Questions](#11-lld-interview-qa--40-questions) |

---

## 1. Hexagonal Architecture (Ports and Adapters)

### What It Is

The application core (domain logic) is completely isolated from external systems. External systems connect through **ports** (interfaces defined by the core). **Adapters** implement those ports for specific technologies.

```text
        HTTP Adapter ─────┐
        gRPC Adapter ─────┤ [INPUT PORTS] ──► DOMAIN CORE ──► [OUTPUT PORTS] ──┬── PostgreSQL Adapter
        CLI Adapter  ─────┘  (Use Cases)                     (Repositories)    ├── MongoDB Adapter
                                                                                └── Stripe Adapter
```

**Why it matters:**

| Benefit | How |
|---------|-----|
| Core is testable | Swap ALL adapters with mocks, test pure business logic |
| Infrastructure is replaceable | Swap PostgreSQL for MongoDB without touching core |
| No framework leakage | Core has zero framework imports — no `net/http`, no `gorm`, no Spring |

> 🌍 **Real-World:** Netflix's streaming platform uses Hexagonal Architecture — the core billing and entitlement logic has zero knowledge of whether it's being called by the iOS app, a REST API, or an internal gRPC service. Adapters translate each entry point into the same use-case calls, allowing Netflix to add new client types (e.g., Smart TVs, game consoles) without touching core subscription logic.

### Full Example — Order Service (Go)

```go
// === DOMAIN LAYER (no external imports) ===

type Order struct {
    ID        string
    UserID    string
    Items     []OrderItem
    Total     int64 // cents
    Status    OrderStatus
    CreatedAt time.Time
}

type OrderStatus string
const (
    StatusPending   OrderStatus = "PENDING"
    StatusConfirmed OrderStatus = "CONFIRMED"
    StatusCancelled OrderStatus = "CANCELLED"
)

// OUTPUT PORTS — defined in core, implemented by infrastructure
type OrderRepository interface {
    Save(ctx context.Context, order *Order) error
    FindByID(ctx context.Context, id string) (*Order, error)
    FindByUser(ctx context.Context, userID string) ([]*Order, error)
}

type InventoryService interface {
    Reserve(ctx context.Context, items []OrderItem) error
    Release(ctx context.Context, items []OrderItem) error
}

type EventPublisher interface {
    Publish(ctx context.Context, event DomainEvent) error
}

// USE CASE (input port implementation — core business logic)
type OrderUseCase struct {
    orders    OrderRepository
    inventory InventoryService
    events    EventPublisher
}

func NewOrderUseCase(r OrderRepository, inv InventoryService, ev EventPublisher) *OrderUseCase {
    return &OrderUseCase{orders: r, inventory: inv, events: ev}
}

func (uc *OrderUseCase) PlaceOrder(ctx context.Context, userID string, items []OrderItem) (*Order, error) {
    if err := uc.inventory.Reserve(ctx, items); err != nil {
        return nil, fmt.Errorf("reserve inventory: %w", err)
    }

    total := calculateTotal(items)
    order := &Order{
        ID:        uuid.New().String(),
        UserID:    userID,
        Items:     items,
        Total:     total,
        Status:    StatusPending,
        CreatedAt: time.Now(),
    }

    if err := uc.orders.Save(ctx, order); err != nil {
        uc.inventory.Release(ctx, items) // compensating action
        return nil, fmt.Errorf("save order: %w", err)
    }

    uc.events.Publish(ctx, OrderPlacedEvent{OrderID: order.ID, UserID: userID})
    return order, nil
}

// === ADAPTERS (infrastructure layer) ===

// HTTP input adapter
type OrderHTTPHandler struct {
    useCase *OrderUseCase
}

func (h *OrderHTTPHandler) PlaceOrder(w http.ResponseWriter, r *http.Request) {
    var req PlaceOrderRequest
    json.NewDecoder(r.Body).Decode(&req)

    order, err := h.useCase.PlaceOrder(r.Context(), req.UserID, req.Items)
    if err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    json.NewEncoder(w).Encode(order)
}

// PostgreSQL output adapter
type PgOrderRepository struct {
    db *sql.DB
}

func (r *PgOrderRepository) Save(ctx context.Context, order *Order) error {
    _, err := r.db.ExecContext(ctx,
        `INSERT INTO orders (id, user_id, total, status, created_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT(id) DO UPDATE SET status=$4`,
        order.ID, order.UserID, order.Total, order.Status, order.CreatedAt)
    return err
}

// Kafka event publisher adapter
type KafkaEventPublisher struct {
    producer *kafka.Producer
}

func (p *KafkaEventPublisher) Publish(ctx context.Context, event DomainEvent) error {
    data, _ := json.Marshal(event)
    return p.producer.Produce(&kafka.Message{
        TopicPartition: kafka.TopicPartition{Topic: &event.Topic},
        Value:          data,
    }, nil)
}
```

---

## 2. Clean Architecture

### Layers (outer → inner; dependencies point inward only)

```text
┌────────────────────────────────────┐
│  Frameworks & Drivers              │  HTTP, DB drivers, Kafka client
│  ┌──────────────────────────────┐  │
│  │  Interface Adapters          │  │  Controllers, Repository impls, Presenters
│  │  ┌────────────────────────┐  │  │
│  │  │  Use Cases             │  │  │  Application-specific business rules
│  │  │  ┌──────────────────┐  │  │  │
│  │  │  │  Entities        │  │  │  │  Enterprise business rules, domain objects
│  │  │  └──────────────────┘  │  │  │
│  │  └────────────────────────┘  │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

> **Dependency Rule:** Source code dependencies must always point **inward**. Nothing in an inner circle can know about an outer circle.

**Hexagonal vs Clean Architecture:**
- Hexagonal specifies the ports/adapters boundary (core vs infrastructure)
- Clean Architecture specifies the inner layers (Entities vs Use Cases) more precisely
- They are compatible — often used together

> 🌍 **Real-World:** Uber's Driver app backend follows Clean Architecture layers — Entities hold the core Trip domain rules, Use Cases orchestrate ride matching and surge pricing, and the outermost layer contains the gRPC adapters and PostgreSQL repositories. When Uber migrated from a monolith to microservices, the inner layers remained untouched because all infrastructure dependencies were isolated in the outer rings.

---

## 3. Event-Driven Design

### Domain Events
```go
type DomainEvent interface {
    EventID() string
    OccurredAt() time.Time
    AggregateID() string
    EventType() string
}

type OrderPlacedEvent struct {
    ID          string
    Timestamp   time.Time
    OrderID     string
    UserID      string
    TotalAmount int64
}

func (e OrderPlacedEvent) EventID() string       { return e.ID }
func (e OrderPlacedEvent) OccurredAt() time.Time { return e.Timestamp }
func (e OrderPlacedEvent) AggregateID() string   { return e.OrderID }
func (e OrderPlacedEvent) EventType() string     { return "order.placed" }
```

### Outbox Pattern (Guaranteed Event Delivery)

> 🌍 **Real-World:** Shopify's order pipeline uses domain events to decouple their checkout service from downstream inventory, email, and fraud services. When an order is placed, an `OrderPlaced` event is published; each downstream service subscribes independently and reacts at its own pace — the checkout service never waits for email confirmations or fraud scores before returning a response to the customer.

> **⚠️ Problem:** Writing to DB and publishing to Kafka are two separate operations. Either can fail → lost event or inconsistent state.

**Solution:** Write the event to an `outbox` table in the **same transaction** as the business data. A relay process polls and publishes.

```sql
CREATE TABLE outbox_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type    VARCHAR(100) NOT NULL,
    aggregate_id  VARCHAR(100) NOT NULL,
    payload       JSONB NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    published_at  TIMESTAMPTZ   -- NULL = pending
);
```

```go
// In the same transaction as the business operation
func (repo *OrderRepository) SaveWithEvent(ctx context.Context, order *Order, event DomainEvent) error {
    tx, _ := repo.db.BeginTx(ctx, nil)
    defer tx.Rollback()

    tx.ExecContext(ctx, `INSERT INTO orders ...`, order.ID /* ... */)

    payload, _ := json.Marshal(event)
    tx.ExecContext(ctx,
        `INSERT INTO outbox_events (event_type, aggregate_id, payload) VALUES ($1,$2,$3)`,
        event.EventType(), event.AggregateID(), payload)

    return tx.Commit()
}

// Relay process: polls every 100ms, publishes pending events
func relayOutbox(ctx context.Context, db *sql.DB, producer Publisher) {
    for {
        rows, _ := db.QueryContext(ctx,
            `SELECT id, event_type, payload FROM outbox_events
             WHERE published_at IS NULL
             ORDER BY created_at
             LIMIT 100`)

        for rows.Next() {
            var id, eventType string
            var payload []byte
            rows.Scan(&id, &eventType, &payload)

            if err := producer.Publish(eventType, payload); err != nil {
                continue // retry next iteration
            }

            db.ExecContext(ctx,
                `UPDATE outbox_events SET published_at = NOW() WHERE id = $1`, id)
        }

        time.Sleep(100 * time.Millisecond)
    }
}
```

> **💡** Events may be published more than once (relay retries). Make consumers idempotent using an idempotency key.

> 🌍 **Real-World:** Zalando (Europe's largest fashion platform) uses the Outbox Pattern in their order service — every order mutation writes a record to an `outbox` table inside the same PostgreSQL transaction. A separate relay process reads undelivered outbox rows and publishes them to Kafka. This guarantees that an order is never persisted without its corresponding event being eventually delivered, even if the Kafka cluster is temporarily unavailable.

---

## 4. Thread-Safe Design Patterns

### Thread-Safe Singleton (Go)

> 🌍 **Real-World:** AWS SDK for Go uses a `sync.Once`-backed singleton for its credential provider — the first call to `GetCredentials()` initializes an IAM role token fetch and caches the result. Every Lambda invocation across all goroutines shares the same credential object, preventing duplicate IAM API calls that would slow cold starts and hit rate limits.

```go
var (
    dbInstance *Database
    dbOnce     sync.Once
)

func GetDatabase(dsn string) *Database {
    dbOnce.Do(func() {
        dbInstance = &Database{pool: openPool(dsn)}
    })
    return dbInstance
}
```

### Thread-Safe TTL Cache

> 🌍 **Real-World:** Twitter's Finagle RPC framework maintains a TTL cache of service discovery results — each resolved host entry expires after 30 seconds. Thousands of concurrent goroutines read the cache simultaneously using a `RWMutex`, while a single background goroutine refreshes stale entries. Without TTL, a service restart would be invisible to callers for an indefinite period.
```go
type entry struct {
    value     interface{}
    expiresAt time.Time
}

type TTLCache struct {
    mu    sync.RWMutex
    items map[string]entry
}

func (c *TTLCache) Get(key string) (interface{}, bool) {
    c.mu.RLock()
    e, ok := c.items[key]
    c.mu.RUnlock()
    if !ok || time.Now().After(e.expiresAt) {
        return nil, false
    }
    return e.value, true
}

func (c *TTLCache) Set(key string, val interface{}, ttl time.Duration) {
    c.mu.Lock()
    c.items[key] = entry{value: val, expiresAt: time.Now().Add(ttl)}
    c.mu.Unlock()
}

func (c *TTLCache) cleanup() {
    ticker := time.NewTicker(time.Minute)
    for range ticker.C {
        now := time.Now()
        c.mu.Lock()
        for k, e := range c.items {
            if now.After(e.expiresAt) {
                delete(c.items, k)
            }
        }
        c.mu.Unlock()
    }
}
```

### Rate Limiter — Redis Sliding Window (Production Grade)

> 🌍 **Real-World:** Stripe's API uses a Redis sliding window rate limiter on every API key — each request atomically checks and records a timestamp in a sorted set, allowing burst capacity while enforcing per-second and per-minute limits. The Lua script ensures that the check and the write are a single atomic operation, preventing race conditions even across thousands of concurrent API requests from the same merchant.
```go
const luaScript = `
local key    = KEYS[1]
local now    = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit  = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then return 0 end
redis.call('ZADD', key, now, now .. math.random())
redis.call('PEXPIRE', key, window)
return 1
`

type RateLimiter struct {
    rdb    *redis.Client
    script *redis.Script
}

func (rl *RateLimiter) Allow(ctx context.Context, key string, limit int, window time.Duration) bool {
    now := time.Now().UnixMilli()
    result, err := rl.script.Run(ctx, rl.rdb,
        []string{"rl:" + key},
        now, window.Milliseconds(), limit).Int()
    if err != nil {
        return true // fail open
    }
    return result == 1
}
```

> **💡 Why Lua?** The script runs atomically in Redis — no race condition between the `ZCARD` check and the `ZADD`.

---

## 5. Design Projects

### Trading Engine — Core Design

> 🌍 **Real-World:** Coinbase's matching engine uses a per-symbol order book backed by a sorted tree (similar to a B-tree or red-black tree) — buy orders are sorted descending by price, sell orders ascending. The engine is intentionally single-threaded per trading pair to avoid locking overhead; Bitcoin's order book processes hundreds of matches per second with microsecond latency, and the single-threaded design makes the matching logic perfectly deterministic and auditable.
```go
type Side string
const (
    Buy  Side = "BUY"
    Sell Side = "SELL"
)

type Order struct {
    ID        string
    UserID    string
    Side      Side
    Price     int64 // in cents; 0 = market order
    Quantity  int64
    Remaining int64
    CreatedAt time.Time
}

// Order book: price → FIFO queue of orders at that price
type OrderBook struct {
    bids *btree.BTree // sorted descending (highest price first)
    asks *btree.BTree // sorted ascending (lowest price first)
    mu   sync.Mutex  // matching engine is single-threaded per symbol
}

func (ob *OrderBook) Match(incoming *Order) []Trade {
    ob.mu.Lock()
    defer ob.mu.Unlock()

    var trades []Trade
    for incoming.Remaining > 0 {
        best := ob.getBestOpposite(incoming.Side)
        if best == nil {
            break
        }
        if incoming.Price != 0 && !priceMatches(incoming, best) {
            break
        }

        qty := min(incoming.Remaining, best.Remaining)
        trades = append(trades, Trade{
            BuyOrderID:  buyID(incoming, best),
            SellOrderID: sellID(incoming, best),
            Price:       best.Price, // price of the resting order
            Quantity:    qty,
        })

        incoming.Remaining -= qty
        best.Remaining -= qty
        if best.Remaining == 0 {
            ob.removeOrder(best)
        }
    }

    if incoming.Remaining > 0 {
        ob.addOrder(incoming)
    }
    return trades
}
```

### Distributed Rate Limiter — Architecture
```text
Client → API Gateway → Rate Limiter Service → Redis Cluster
                        (sidecar or centralized)

Per request:
  1. Extract rate limit key (user_id, IP, or API key)
  2. Run Redis Lua script (atomic sliding window)
  3. Return 200 or 429

Headers on 429:
  X-RateLimit-Limit:     100
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset:     1705312800
  Retry-After:           30
```

**Multi-tier rate limiting:**
- API Gateway: enforces global limits (e.g., 10,000 req/min per API key)
- Individual services: enforce per-operation limits (e.g., 100 req/min for `/transfer`)

> 🌍 **Real-World:** GitHub uses a multi-tier rate limiter — at the API Gateway layer it enforces 5,000 requests/hour per authenticated user, while specific high-cost operations like repository search have their own tighter limits (30 requests/minute). The limits are checked in Redis and returned in every response via `X-RateLimit-*` headers, allowing clients to implement back-off without waiting for a 429 error.

---

## 6. CQRS and Event Sourcing

### What is CQRS?

**CQRS (Command Query Responsibility Segregation)** separates the write model (commands that change state) from the read model (queries that retrieve state). Coined by Greg Young, derived from Bertrand Meyer's Command-Query Separation (CQS) principle applied at the architectural level.

```text
                    ┌──────────────────────────────────────────────┐
                    │              Application                      │
                    │                                              │
  Client ──Write──► │  Command Handler  ──► Write DB (PostgreSQL)  │
                    │       │                    │                  │
                    │       │              (event/change)           │
                    │       ▼                    │                  │
                    │  Event Bus ◄───────────────┘                  │
                    │       │                                       │
                    │       ▼                                       │
  Client ──Read───► │  Query Handler  ◄── Read DB (Elasticsearch)  │
                    └──────────────────────────────────────────────┘
```

**Why separate them?**

| Concern | Write Model | Read Model |
|---------|-------------|------------|
| Shape | Normalized, consistent | Denormalized, query-optimized |
| DB | PostgreSQL (ACID) | Elasticsearch, Redis, ClickHouse |
| Scale | Write throughput | Read throughput (often 10x writes) |
| Validation | Domain rules | N/A — already validated on write |

**Standard (non-CQRS) problem:** The same data model must serve both the transactional write path (with invariants, locks, normalization) and the read path (with JOINs, aggregations, full-text search). These two concerns pull in opposite directions.

> 🌍 **Real-World:** LinkedIn's feed uses CQRS — the write side stores activity events in a normalized relational store with strict validation, while the read side projects a denormalized "feed view" into Espresso (LinkedIn's distributed document store) optimized for sub-10ms reads. A single post write triggers a projection update that pre-computes the rendered feed card for millions of followers, trading write complexity for dramatically faster feed loads.

### Implementation Walkthrough

**Command side:**
```go
// Commands are plain data — intent to change state
type TransferMoneyCommand struct {
    FromAccountID string
    ToAccountID   string
    Amount        int64
    Currency      string
    RequestID     string // idempotency key
}

// Command handler: validates, executes, persists
type TransferCommandHandler struct {
    accountRepo AccountRepository
    eventBus    EventBus
}

func (h *TransferCommandHandler) Handle(ctx context.Context, cmd TransferMoneyCommand) error {
    // 1. Load aggregate from write DB
    from, err := h.accountRepo.FindByID(ctx, cmd.FromAccountID)
    if err != nil {
        return fmt.Errorf("load source account: %w", err)
    }
    to, err := h.accountRepo.FindByID(ctx, cmd.ToAccountID)
    if err != nil {
        return fmt.Errorf("load dest account: %w", err)
    }

    // 2. Apply domain logic (can return domain errors)
    if err := from.Debit(cmd.Amount); err != nil {
        return err // InsufficientFundsError etc.
    }
    to.Credit(cmd.Amount)

    // 3. Persist both (in one transaction)
    if err := h.accountRepo.SaveAll(ctx, from, to); err != nil {
        return fmt.Errorf("persist transfer: %w", err)
    }

    // 4. Publish event for read-model projection
    h.eventBus.Publish(ctx, MoneyTransferredEvent{
        FromID: cmd.FromAccountID,
        ToID:   cmd.ToAccountID,
        Amount: cmd.Amount,
    })
    return nil
}

// Query side: thin handler reads from optimized read DB
type AccountQueryHandler struct {
    readDB *elasticsearch.Client // or a materialized view in PG
}

type AccountSummaryView struct {
    AccountID     string  `json:"account_id"`
    OwnerName     string  `json:"owner_name"`
    Balance       int64   `json:"balance"`
    RecentTxCount int     `json:"recent_tx_count"`
}

func (h *AccountQueryHandler) GetAccountSummary(ctx context.Context, accountID string) (*AccountSummaryView, error) {
    // Direct query to read DB — no domain logic, no locks
    res, err := h.readDB.Get(elasticsearch.GetRequest{
        Index: "account_summaries",
        ID:    accountID,
    })
    if err != nil {
        return nil, err
    }
    var view AccountSummaryView
    json.Unmarshal(res.Source, &view)
    return &view, nil
}
```

---

### Event Sourcing

**Core idea:** Instead of storing the *current state* of an entity, store the *sequence of events* that led to that state. The current state is derived by replaying those events.

> 🌍 **Real-World:** Axon Framework (used by banks including ABN AMRO) stores every account mutation as an immutable `AccountDebitedEvent` or `AccountCreditedEvent` in an append-only event store. Regulators can request a complete audit trail for any account at any time — the bank replays events to reconstruct the exact balance at any historical moment, something impossible with a system that only stores the current balance row.

```text
Traditional:        accounts table → { id: "A1", balance: 500 }

Event Sourced:      events table →
                    { AccountOpened,  amount: 1000 }
                    { MoneyDeposited, amount: 200  }
                    { MoneyWithdrawn, amount: 700  }
                    ──────────────────────────────
                    Replay → balance: 500
```

**Event store schema:**

```sql
CREATE TABLE event_store (
    id             BIGSERIAL PRIMARY KEY,
    aggregate_id   VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    event_version  INTEGER NOT NULL,        -- version within this aggregate
    payload        JSONB NOT NULL,
    occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (aggregate_id, event_version)    -- optimistic concurrency
);

CREATE INDEX idx_event_store_aggregate ON event_store (aggregate_id, event_version);
```

**Full Go implementation — BankAccount with Event Sourcing:**

```go
// ── EVENTS ──────────────────────────────────────────────────────────────────

type EventType string

const (
    EventAccountOpened  EventType = "AccountOpened"
    EventMoneyDeposited EventType = "MoneyDeposited"
    EventMoneyWithdrawn EventType = "MoneyWithdrawn"
    EventAccountClosed  EventType = "AccountClosed"
)

type Event struct {
    ID            string
    AggregateID   string
    AggregateType string
    Type          EventType
    Version       int
    OccurredAt    time.Time
    Payload       interface{}
}

type AccountOpenedPayload struct {
    OwnerID       string `json:"owner_id"`
    InitialAmount int64  `json:"initial_amount"`
}

type MoneyDepositedPayload struct {
    Amount int64  `json:"amount"`
    Ref    string `json:"ref"`
}

type MoneyWithdrawnPayload struct {
    Amount int64  `json:"amount"`
    Ref    string `json:"ref"`
}

// ── AGGREGATE ────────────────────────────────────────────────────────────────

type BankAccount struct {
    ID      string
    OwnerID string
    Balance int64
    Closed  bool
    Version int // current version after replay

    uncommittedEvents []Event // events raised in this session, not yet persisted
}

// Apply mutates state based on an event — pure function, no side effects
func (a *BankAccount) Apply(e Event) {
    switch e.Type {
    case EventAccountOpened:
        p := e.Payload.(AccountOpenedPayload)
        a.ID = e.AggregateID
        a.OwnerID = p.OwnerID
        a.Balance = p.InitialAmount
    case EventMoneyDeposited:
        p := e.Payload.(MoneyDepositedPayload)
        a.Balance += p.Amount
    case EventMoneyWithdrawn:
        p := e.Payload.(MoneyWithdrawnPayload)
        a.Balance -= p.Amount
    case EventAccountClosed:
        a.Closed = true
    }
    a.Version = e.Version
}

// Rebuild replays a slice of events to reconstruct state from scratch
func RebuildBankAccount(events []Event) *BankAccount {
    acc := &BankAccount{}
    for _, e := range events {
        acc.Apply(e)
    }
    return acc
}

// ── COMMAND METHODS (raise events, do not mutate directly) ───────────────────

func OpenAccount(id, ownerID string, initialAmount int64) *BankAccount {
    acc := &BankAccount{}
    e := Event{
        ID:            uuid.New().String(),
        AggregateID:   id,
        AggregateType: "BankAccount",
        Type:          EventAccountOpened,
        Version:       1,
        OccurredAt:    time.Now(),
        Payload:       AccountOpenedPayload{OwnerID: ownerID, InitialAmount: initialAmount},
    }
    acc.Apply(e)
    acc.uncommittedEvents = append(acc.uncommittedEvents, e)
    return acc
}

func (a *BankAccount) Deposit(amount int64, ref string) error {
    if a.Closed {
        return errors.New("account is closed")
    }
    if amount <= 0 {
        return errors.New("deposit amount must be positive")
    }
    e := Event{
        ID:            uuid.New().String(),
        AggregateID:   a.ID,
        AggregateType: "BankAccount",
        Type:          EventMoneyDeposited,
        Version:       a.Version + 1,
        OccurredAt:    time.Now(),
        Payload:       MoneyDepositedPayload{Amount: amount, Ref: ref},
    }
    a.Apply(e)
    a.uncommittedEvents = append(a.uncommittedEvents, e)
    return nil
}

func (a *BankAccount) Withdraw(amount int64, ref string) error {
    if a.Closed {
        return errors.New("account is closed")
    }
    if amount <= 0 {
        return errors.New("withdrawal amount must be positive")
    }
    if a.Balance < amount {
        return fmt.Errorf("insufficient funds: have %d, need %d", a.Balance, amount)
    }
    e := Event{
        ID:            uuid.New().String(),
        AggregateID:   a.ID,
        AggregateType: "BankAccount",
        Type:          EventMoneyWithdrawn,
        Version:       a.Version + 1,
        OccurredAt:    time.Now(),
        Payload:       MoneyWithdrawnPayload{Amount: amount, Ref: ref},
    }
    a.Apply(e)
    a.uncommittedEvents = append(a.uncommittedEvents, e)
    return nil
}

func (a *BankAccount) GetUncommittedEvents() []Event {
    return a.uncommittedEvents
}

func (a *BankAccount) MarkEventsCommitted() {
    a.uncommittedEvents = nil
}

// ── EVENT STORE ──────────────────────────────────────────────────────────────

type EventStore interface {
    AppendEvents(ctx context.Context, aggregateID string, expectedVersion int, events []Event) error
    LoadEvents(ctx context.Context, aggregateID string) ([]Event, error)
    LoadEventsAfter(ctx context.Context, aggregateID string, afterVersion int) ([]Event, error)
}

type PostgresEventStore struct {
    db *sql.DB
}

func (s *PostgresEventStore) AppendEvents(ctx context.Context, aggregateID string, expectedVersion int, events []Event) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    // Optimistic concurrency check
    var currentVersion int
    err = tx.QueryRowContext(ctx,
        `SELECT COALESCE(MAX(event_version), 0) FROM event_store WHERE aggregate_id = $1`,
        aggregateID).Scan(&currentVersion)
    if err != nil {
        return err
    }
    if currentVersion != expectedVersion {
        return fmt.Errorf("concurrency conflict: expected version %d, got %d", expectedVersion, currentVersion)
    }

    for _, e := range events {
        payload, _ := json.Marshal(e.Payload)
        _, err = tx.ExecContext(ctx,
            `INSERT INTO event_store (aggregate_id, aggregate_type, event_type, event_version, payload, occurred_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            e.AggregateID, e.AggregateType, string(e.Type), e.Version, payload, e.OccurredAt)
        if err != nil {
            return fmt.Errorf("insert event: %w", err)
        }
    }
    return tx.Commit()
}

// ── SNAPSHOTS ────────────────────────────────────────────────────────────────

// For aggregates with thousands of events, replaying all is slow.
// Snapshot = serialized state at a specific version.
// On load: fetch latest snapshot, then replay only newer events.

type Snapshot struct {
    AggregateID   string
    AggregateType string
    Version       int
    Data          []byte
    CreatedAt     time.Time
}

func LoadWithSnapshot(ctx context.Context, store EventStore, snapStore SnapshotStore, accountID string) (*BankAccount, error) {
    snap, err := snapStore.Latest(ctx, accountID)
    var acc *BankAccount
    fromVersion := 0

    if err == nil && snap != nil {
        // Deserialize snapshot
        acc = &BankAccount{}
        json.Unmarshal(snap.Data, acc)
        fromVersion = snap.Version
    }

    // Replay only events after snapshot
    events, err := store.LoadEventsAfter(ctx, accountID, fromVersion)
    if err != nil {
        return nil, err
    }

    if acc == nil {
        acc = &BankAccount{}
    }
    for _, e := range events {
        acc.Apply(e)
    }
    return acc, nil
}
```

### Projections (Read Model Builder)

A **projection** is a process that listens to events and builds a denormalized read model:

> 🌍 **Real-World:** Spotify's playlist service uses event-sourced projections — `TrackAdded` and `TrackRemoved` events are stored in an event log, and multiple projections rebuild different read models from the same stream: one for the mobile app's playlist view, another for the recommendation engine's "recently played" feature, and another for the royalty accounting system. Each projection can be independently rebuilt from scratch if its read model becomes corrupted.

```go
// Projection handler: subscribes to events, updates read model
type AccountSummaryProjection struct {
    readDB *sql.DB
}

func (p *AccountSummaryProjection) On(ctx context.Context, e Event) error {
    switch e.Type {
    case EventAccountOpened:
        payload := e.Payload.(AccountOpenedPayload)
        _, err := p.readDB.ExecContext(ctx,
            `INSERT INTO account_summaries (account_id, owner_id, balance)
             VALUES ($1, $2, $3)
             ON CONFLICT (account_id) DO NOTHING`,
            e.AggregateID, payload.OwnerID, payload.InitialAmount)
        return err

    case EventMoneyDeposited:
        payload := e.Payload.(MoneyDepositedPayload)
        _, err := p.readDB.ExecContext(ctx,
            `UPDATE account_summaries
             SET balance = balance + $1, last_updated = NOW()
             WHERE account_id = $2`,
            payload.Amount, e.AggregateID)
        return err

    case EventMoneyWithdrawn:
        payload := e.Payload.(MoneyWithdrawnPayload)
        _, err := p.readDB.ExecContext(ctx,
            `UPDATE account_summaries
             SET balance = balance - $1, last_updated = NOW()
             WHERE account_id = $2`,
            payload.Amount, e.AggregateID)
        return err
    }
    return nil
}
```

The projection runs in a background process, consuming from the event bus or polling the event store. Multiple projections can consume the same events to build different read models (e.g., one for balance queries, another for fraud analysis).

### When to Use CQRS + Event Sourcing

**Use when:**
- Read and write load are very asymmetric (e.g., social feed: 1 write, 10,000 reads)
- You need a full audit trail (compliance, finance, healthcare)
- You need time-travel queries ("what was the account balance on Jan 1?")
- Different teams own read vs write concerns
- Multiple read models from the same data (dashboard, alerts, ML features)

**Avoid when:**
- Simple CRUD with no complex domain logic
- Team is small and consistency is more valuable than flexibility
- You need strong consistency between read and write (event sourcing is eventually consistent)

### ⚠️ Gotchas

1. **Eventual consistency**: Read model lags behind the write model. A user who just transferred money may briefly see the old balance. Solution: return the new balance directly from the command response; use the read model only for non-critical queries.

2. **Event versioning / schema evolution**: Events are stored forever. If you change `MoneyDepositedPayload` to add a field, old events don't have it. Strategy: use upcasting (transform old events to new schema on read), or versioned event types (`MoneyDeposited.v2`).

3. **Projection rebuilds**: If a projection has a bug and needs to be fixed, you must replay ALL events from the beginning. Keep event replay fast (parallel processing, snapshots). Maintain a `processed_up_to` cursor per projection.

4. **Aggregate loading cost**: Loading a high-traffic aggregate (10,000 events) on every command is slow without snapshots. Take snapshots every N events (e.g., every 100).

### 📖 War Story

A fintech company migrated their payments service to event sourcing. For 18 months everything was fine. Then a compliance audit requested a report: "show us every state change to account X-99 for the past 5 years." The team replayed 80,000 events in under 2 seconds and generated a perfect audit trail — something that would have been impossible with the old system that only stored current state. The same event store also powered their fraud detection ML model (replayed as training data) and their reconciliation service (nightly batch replay). The upfront complexity paid off in operational flexibility that their competitors couldn't match.

---

## 7. Domain-Driven Design (DDD)

### Strategic DDD

> 🌍 **Real-World:** Amazon's e-commerce platform is organized as hundreds of Bounded Contexts — the Catalog context owns product descriptions and images, the Pricing context owns dynamic pricing rules, the Fulfillment context owns warehouse and shipping logic, and the Reviews context owns customer ratings. Each context has its own database, its own team, and its own deployment pipeline; they integrate only through well-defined event contracts, not shared tables.

**Strategic DDD** answers: "How do we organize a large system across teams?" It focuses on the big picture.

**Bounded Context:** A clear boundary within which a particular model is defined and applicable. The same word can mean different things in different contexts.

```text
E-Commerce System

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Order Context  │  │ Catalog Context │  │  User Context   │
│                 │  │                 │  │                 │
│  Order          │  │  Product        │  │  Customer       │
│  LineItem       │  │  Category       │  │  Address        │
│  "Product"      │  │  "Product"      │  │  "Product" ─ ? │
│  (just SKU+qty) │  │  (full details) │  │  (purchase hist)│
└─────────────────┘  └─────────────────┘  └─────────────────┘
       │                     │                     │
       └─────────── Context Map ────────────────────┘
```

**Ubiquitous Language:** The same terms used in code and by domain experts. If a domain expert calls it an "Invoice", the code has `Invoice`, not `Bill` or `PaymentDocument`.

> 🌍 **Real-World:** Salesforce enforces Ubiquitous Language across their CRM platform — the terms "Lead," "Opportunity," "Account," and "Contact" appear identically in the UI, the API, the database schema, and internal team Slack channels. When engineers and sales managers discuss a feature, they use the same words, eliminating translation errors that cause bugs. This shared vocabulary is codified in their domain model and has survived 20+ years of platform evolution.

**Context Map patterns:**

| Pattern | Meaning |
|---------|---------|
| Shared Kernel | Two contexts share a small subset of the model |
| Customer-Supplier | Upstream publishes, downstream consumes (asymmetric power) |
| Conformist | Downstream conforms completely to upstream model |
| Anti-Corruption Layer | Downstream translates upstream model to its own |
| Open Host Service | Upstream provides a published protocol for integration |

---

### Tactical DDD

**Entity:** Has a unique identity that persists over time. Two entities with the same attributes are still different if they have different IDs.

```go
type Order struct {
    id        OrderID    // identity — never changes
    userID    UserID
    lineItems []LineItem
    address   Address    // value object
    status    OrderStatus
    total     Money      // value object
    placedAt  time.Time
}

// Entities use ID for equality
func (o *Order) Equals(other *Order) bool {
    return o.id == other.id
}
```

**Value Object:** No identity. Defined entirely by its attributes. Immutable. Two value objects with the same attributes are equal.

```go
// Value Object — immutable, equality by value
type Money struct {
    amount   int64  // in minor units (cents)
    currency string // ISO 4217
}

func NewMoney(amount int64, currency string) (Money, error) {
    if amount < 0 {
        return Money{}, errors.New("money cannot be negative")
    }
    if len(currency) != 3 {
        return Money{}, errors.New("currency must be ISO 4217")
    }
    return Money{amount: amount, currency: currency}, nil
}

func (m Money) Add(other Money) (Money, error) {
    if m.currency != other.currency {
        return Money{}, fmt.Errorf("cannot add %s and %s", m.currency, other.currency)
    }
    return Money{amount: m.amount + other.amount, currency: m.currency}, nil
}

func (m Money) Multiply(factor int64) Money {
    return Money{amount: m.amount * factor, currency: m.currency}
}

func (m Money) Equals(other Money) bool {
    return m.amount == other.amount && m.currency == other.currency
}

// Value Object — immutable
type Address struct {
    street     string
    city       string
    postalCode string
    country    string
}

func (a Address) Equals(other Address) bool {
    return a.street == other.street &&
        a.city == other.city &&
        a.postalCode == other.postalCode &&
        a.country == other.country
}
```

**Aggregate:** A cluster of domain objects treated as a unit. Has a single **Aggregate Root** — the only entry point for external access. Enforces invariants across all objects in the cluster.

> 🌍 **Real-World:** eBay's auction system models `Auction` as an aggregate root containing `Bids` as child entities — all bid operations go through the `Auction.PlaceBid()` method, which enforces invariants like "a new bid must exceed the current highest bid" and "bids cannot be placed after auction end time." No external code directly manipulates the `Bids` collection, preventing invalid state from ever being persisted.

```go
// OrderID is a strongly-typed ID (prevents mixing up IDs)
type OrderID string
type UserID string
type ProductID string

type LineItem struct {
    productID ProductID
    name      string
    price     Money
    quantity  int
}

func (li LineItem) Subtotal() Money {
    return li.price.Multiply(int64(li.quantity))
}

// Order is the aggregate root
type Order struct {
    id        OrderID
    userID    UserID
    lineItems []LineItem
    address   Address
    status    OrderStatus
    placedAt  time.Time

    // Domain events raised during this session
    events []DomainEvent
}

type OrderStatus int

const (
    OrderStatusDraft OrderStatus = iota
    OrderStatusPlaced
    OrderStatusShipped
    OrderStatusDelivered
    OrderStatusCancelled
)

func NewOrder(id OrderID, userID UserID, address Address) *Order {
    o := &Order{
        id:       id,
        userID:   userID,
        address:  address,
        status:   OrderStatusDraft,
        placedAt: time.Now(),
    }
    return o
}

// All mutations go through the aggregate root — it enforces invariants
func (o *Order) AddItem(productID ProductID, name string, price Money, qty int) error {
    if o.status != OrderStatusDraft {
        return errors.New("cannot modify a placed order")
    }
    if qty <= 0 {
        return errors.New("quantity must be positive")
    }
    // Check for existing item and update quantity
    for i, item := range o.lineItems {
        if item.productID == productID {
            o.lineItems[i].quantity += qty
            return nil
        }
    }
    o.lineItems = append(o.lineItems, LineItem{
        productID: productID,
        name:      name,
        price:     price,
        quantity:  qty,
    })
    return nil
}

func (o *Order) Place() error {
    if o.status != OrderStatusDraft {
        return fmt.Errorf("order already placed (status: %d)", o.status)
    }
    if len(o.lineItems) == 0 {
        return errors.New("cannot place empty order")
    }
    o.status = OrderStatusPlaced
    // Raise domain event — handled by infrastructure after persist
    o.events = append(o.events, OrderPlacedEvent{
        OrderID:   string(o.id),
        UserID:    string(o.userID),
        Total:     o.Total(),
        OccurredAt: time.Now(),
    })
    return nil
}

func (o *Order) Ship(trackingNumber string) error {
    if o.status != OrderStatusPlaced {
        return errors.New("can only ship placed orders")
    }
    o.status = OrderStatusShipped
    o.events = append(o.events, OrderShippedEvent{
        OrderID:        string(o.id),
        TrackingNumber: trackingNumber,
        OccurredAt:     time.Now(),
    })
    return nil
}

func (o *Order) Total() Money {
    total, _ := NewMoney(0, "USD")
    for _, item := range o.lineItems {
        total, _ = total.Add(item.Subtotal())
    }
    return total
}

func (o *Order) PopEvents() []DomainEvent {
    evts := o.events
    o.events = nil
    return evts
}

// Domain Events
type OrderPlacedEvent struct {
    OrderID    string
    UserID     string
    Total      Money
    OccurredAt time.Time
}

func (e OrderPlacedEvent) EventType() string    { return "order.placed" }
func (e OrderPlacedEvent) AggregateID() string  { return e.OrderID }
func (e OrderPlacedEvent) OccurredAt_() time.Time { return e.OccurredAt }

type OrderShippedEvent struct {
    OrderID        string
    TrackingNumber string
    OccurredAt     time.Time
}

func (e OrderShippedEvent) EventType() string    { return "order.shipped" }
func (e OrderShippedEvent) AggregateID() string  { return e.OrderID }
func (e OrderShippedEvent) OccurredAt_() time.Time { return e.OccurredAt }
```

**Domain Service:** Logic that doesn't naturally fit on an entity or value object (e.g., involves multiple aggregates).

```go
// Domain service — "can this order be placed given inventory?"
type OrderPlacementService struct {
    inventoryChecker InventoryChecker // output port
}

func (s *OrderPlacementService) CanPlace(ctx context.Context, order *Order) error {
    for _, item := range order.lineItems {
        available, err := s.inventoryChecker.Available(ctx, item.productID)
        if err != nil {
            return fmt.Errorf("check inventory: %w", err)
        }
        if available < item.quantity {
            return fmt.Errorf("insufficient stock for product %s", item.productID)
        }
    }
    return nil
}
```

**Repository (DDD style):**

```go
// Output port — defined in domain layer
type OrderRepository interface {
    FindByID(ctx context.Context, id OrderID) (*Order, error)
    FindByUser(ctx context.Context, userID UserID) ([]*Order, error)
    Save(ctx context.Context, order *Order) error
    Delete(ctx context.Context, id OrderID) error
    NextID(ctx context.Context) (OrderID, error)
}
```

**Factory:** Encapsulates complex construction logic.

```go
type OrderFactory struct {
    repo OrderRepository
}

func (f *OrderFactory) CreateFromCart(ctx context.Context, cart *Cart, address Address) (*Order, error) {
    id, err := f.repo.NextID(ctx)
    if err != nil {
        return nil, err
    }
    order := NewOrder(id, cart.UserID, address)
    for _, cartItem := range cart.Items {
        if err := order.AddItem(cartItem.ProductID, cartItem.Name, cartItem.Price, cartItem.Quantity); err != nil {
            return nil, err
        }
    }
    return order, nil
}
```

### Anti-Corruption Layer (ACL)

> 🌍 **Real-World:** Google Maps Platform uses an ACL when integrating with third-party traffic data providers — each provider sends incidents in their own schema (different field names, different severity scales, different coordinate formats). The ACL translates all provider models into Google's internal `TrafficIncident` domain object before it enters the core routing engine, so a provider contract change never leaks into the navigation domain logic.

When integrating with an external system (legacy system, third-party API), an ACL translates the external model to your domain model, preventing contamination.

```go
// External payment processor uses its own model
type StripeChargeResponse struct {
    ChargeID string `json:"id"`
    Status   string `json:"status"` // "succeeded", "pending", "failed"
    Amount   int    `json:"amount"` // in cents
    Currency string `json:"currency"`
}

// ACL: translates Stripe model to our domain model
type StripePaymentACL struct {
    stripeClient *stripe.Client
}

func (acl *StripePaymentACL) ChargeAccount(ctx context.Context, amount Money, token string) (*PaymentResult, error) {
    // Call external system with its language
    resp, err := acl.stripeClient.Charges.New(&stripe.ChargeParams{
        Amount:   stripe.Int64(amount.amount),
        Currency: stripe.String(amount.currency),
        Source:   &stripe.SourceParams{Token: stripe.String(token)},
    })
    if err != nil {
        return nil, fmt.Errorf("stripe charge: %w", err)
    }

    // Translate to our domain model — ACL boundary
    var status PaymentStatus
    switch resp.Status {
    case "succeeded":
        status = PaymentStatusSucceeded
    case "pending":
        status = PaymentStatusPending
    default:
        status = PaymentStatusFailed
    }

    return &PaymentResult{
        ExternalID: resp.ID,
        Status:     status,
        Amount:     amount,
    }, nil
}
```

### When DDD is Overkill vs Beneficial

**Use DDD when:**
- Complex business domain with many rules, invariants, and edge cases
- Large team working on the same domain
- Domain experts are available and involved
- Long-lived system (years of evolution expected)

**Skip DDD when:**
- Simple CRUD application (admin panels, reports)
- Small team (1-3 engineers)
- Well-understood domain with stable rules
- Time-to-market is the primary concern

### ⚠️ Aggregate Boundary Pitfalls

**Too large (God Aggregate):**
```text
Order aggregate contains: Order + Payment + Shipment + Invoice + Customer
Problem: Every operation locks the entire aggregate.
         Two users can't place orders at the same time if Customer is in the aggregate.
```

**Too small (Anemic aggregates):**
```text
Each entity is its own aggregate.
Problem: Placing an order requires modifying Order + Inventory + Payment in one use case.
         Now you have a distributed transaction problem.
```

**💡 Rule:** One aggregate per transaction. If a use case must modify two aggregates, either:
1. Reconsider the boundary (maybe they should be one aggregate)
2. Use eventual consistency (domain event triggers second aggregate update asynchronously)

**Finding the right boundary:** Ask "what invariants must be consistent at the same time?" If inventory and order must always be consistent, they're in one aggregate. If it's OK for them to be eventually consistent, they're separate.

---

## 8. Saga Pattern — Distributed Transactions

> 🌍 **Real-World:** Airbnb's booking system uses the Saga pattern — when a guest books a listing, the saga coordinates: (1) hold payment authorization, (2) block calendar dates, (3) notify host, (4) confirm booking. If the host rejects or the calendar block fails, compensating transactions release the payment hold and unblock the calendar. Before Sagas, Airbnb used distributed locks that caused cascading timeouts during high-traffic periods like New Year's Eve.

### Why 2-Phase Commit (2PC) Fails in Microservices

**2PC protocol:**
1. Coordinator sends PREPARE to all participants
2. All participants respond READY (or ABORT)
3. If all READY → coordinator sends COMMIT to all
4. If any ABORT → coordinator sends ROLLBACK to all

**Problems:**
- **Blocking protocol:** Participants hold locks during the entire protocol. If the coordinator crashes after PREPARE but before COMMIT, participants are stuck holding locks forever.
- **Availability:** All participants must be available simultaneously. In a microservices system with 10 services, if one is down, the whole transaction fails.
- **Performance:** Lock contention kills throughput at scale.
- **Not supported:** Most modern datastores (NoSQL, message queues, external APIs) don't support 2PC at all.

### Saga = Sequence of Local Transactions

A saga decomposes a distributed transaction into a sequence of **local transactions**, each of which updates one service and publishes an event or message. If one step fails, **compensating transactions** undo the previous steps.

```text
Order Placement Saga:

Step 1: OrderService      → Create Order (PENDING)
Step 2: PaymentService    → Charge customer
Step 3: InventoryService  → Reserve items
Step 4: ShippingService   → Schedule delivery
Step 5: OrderService      → Update Order (CONFIRMED)

Failure at step 3 (inventory out of stock):
  Compensate step 2: PaymentService → Refund customer
  Compensate step 1: OrderService   → Cancel order (CANCELLED)
```

### Flavor 1: Choreography (Decentralized)

> 🌍 **Real-World:** Uber Eats uses choreography for its order flow — when `OrderPlaced` is published to Kafka, the restaurant service, the driver dispatch service, and the customer notification service each independently react to the same event. No orchestrator tells them what to do; each service "knows" its role by subscribing to relevant topics. This works well for Uber Eats because the flow is simple and linear.

Each service publishes events and reacts to events from other services. No central coordinator.

```text
OrderService ──[OrderCreated]──► PaymentService ──[PaymentCharged]──► InventoryService
                                                                             │
                                                  [InventoryReserved]◄───────┘
                                                         │
                                       ShippingService ◄─┘ ──[ShipmentScheduled]──► OrderService
```

**Pros:** Loose coupling, no single point of failure.
**Cons:** Hard to understand the overall flow; distributed logic is hard to debug; cycle dependencies are possible.

### Flavor 2: Orchestration (Centralized)

> 🌍 **Real-World:** Amazon's order fulfillment uses an orchestrated saga — AWS Step Functions acts as the orchestrator, explicitly calling CheckInventory → ProcessPayment → AllocateWarehouse → ScheduleShipping. The state machine is visible in the AWS console, making failures easy to diagnose. When a payment gateway is down, the Step Functions execution pauses and retries with exponential backoff rather than silently losing the order.

A **Saga Orchestrator** tells each service what to do and reacts to their responses.

```go
// ── SAGA ORCHESTRATOR ────────────────────────────────────────────────────────

type SagaState string

const (
    SagaStateStarted           SagaState = "STARTED"
    SagaStatePaymentPending     SagaState = "PAYMENT_PENDING"
    SagaStateInventoryPending   SagaState = "INVENTORY_PENDING"
    SagaStateShippingPending    SagaState = "SHIPPING_PENDING"
    SagaStateCompleted          SagaState = "COMPLETED"
    SagaStateCompensatingPayment SagaState = "COMPENSATING_PAYMENT"
    SagaStateCompensatingOrder  SagaState = "COMPENSATING_ORDER"
    SagaStateFailed             SagaState = "FAILED"
)

type OrderSaga struct {
    SagaID    string
    OrderID   string
    UserID    string
    Amount    int64
    State     SagaState
    UpdatedAt time.Time
}

type OrderSagaOrchestrator struct {
    sagaRepo      SagaRepository
    orderSvc      OrderServiceClient
    paymentSvc    PaymentServiceClient
    inventorySvc  InventoryServiceClient
    shippingSvc   ShippingServiceClient
}

// Start initiates the saga — called when a new order needs processing
func (o *OrderSagaOrchestrator) Start(ctx context.Context, orderID, userID string, amount int64) error {
    saga := &OrderSaga{
        SagaID:    uuid.New().String(),
        OrderID:   orderID,
        UserID:    userID,
        Amount:    amount,
        State:     SagaStateStarted,
        UpdatedAt: time.Now(),
    }
    if err := o.sagaRepo.Save(ctx, saga); err != nil {
        return err
    }
    // Step 1: Charge payment
    return o.handlePaymentStep(ctx, saga)
}

func (o *OrderSagaOrchestrator) handlePaymentStep(ctx context.Context, saga *OrderSaga) error {
    saga.State = SagaStatePaymentPending
    o.sagaRepo.Save(ctx, saga) // persist state before calling remote service

    err := o.paymentSvc.ChargeCustomer(ctx, saga.UserID, saga.Amount, saga.SagaID)
    if err != nil {
        // Payment failed — compensate (cancel order)
        return o.compensateOrder(ctx, saga, fmt.Sprintf("payment failed: %v", err))
    }
    return o.handleInventoryStep(ctx, saga)
}

func (o *OrderSagaOrchestrator) handleInventoryStep(ctx context.Context, saga *OrderSaga) error {
    saga.State = SagaStateInventoryPending
    o.sagaRepo.Save(ctx, saga)

    err := o.inventorySvc.ReserveItems(ctx, saga.OrderID, saga.SagaID)
    if err != nil {
        // Inventory failed — compensate payment and order
        return o.compensatePayment(ctx, saga, fmt.Sprintf("inventory failed: %v", err))
    }
    return o.handleShippingStep(ctx, saga)
}

func (o *OrderSagaOrchestrator) handleShippingStep(ctx context.Context, saga *OrderSaga) error {
    saga.State = SagaStateShippingPending
    o.sagaRepo.Save(ctx, saga)

    err := o.shippingSvc.ScheduleDelivery(ctx, saga.OrderID, saga.SagaID)
    if err != nil {
        // Shipping failed — compensate inventory, payment, and order
        o.inventorySvc.ReleaseItems(ctx, saga.OrderID, saga.SagaID)
        return o.compensatePayment(ctx, saga, fmt.Sprintf("shipping failed: %v", err))
    }

    // All steps succeeded
    saga.State = SagaStateCompleted
    o.sagaRepo.Save(ctx, saga)
    o.orderSvc.ConfirmOrder(ctx, saga.OrderID)
    return nil
}

func (o *OrderSagaOrchestrator) compensatePayment(ctx context.Context, saga *OrderSaga, reason string) error {
    saga.State = SagaStateCompensatingPayment
    o.sagaRepo.Save(ctx, saga)
    o.paymentSvc.RefundCustomer(ctx, saga.UserID, saga.Amount, saga.SagaID)
    return o.compensateOrder(ctx, saga, reason)
}

func (o *OrderSagaOrchestrator) compensateOrder(ctx context.Context, saga *OrderSaga, reason string) error {
    saga.State = SagaStateCompensatingOrder
    o.sagaRepo.Save(ctx, saga)
    o.orderSvc.CancelOrder(ctx, saga.OrderID, reason)
    saga.State = SagaStateFailed
    o.sagaRepo.Save(ctx, saga)
    return fmt.Errorf("saga %s failed: %s", saga.SagaID, reason)
}
```

### Compensating Transactions Table

| Step | Forward Transaction | Compensating Transaction |
|------|-------------------|--------------------------|
| 1 | Create Order (PENDING) | Cancel Order (CANCELLED) |
| 2 | Charge Customer | Refund Customer |
| 3 | Reserve Inventory | Release Inventory |
| 4 | Schedule Delivery | Cancel Delivery |
| 5 | Confirm Order | (terminal, no compensation needed) |

> **⚠️ Key property:** Compensating transactions must be **idempotent**. If a compensating transaction is called twice (due to retry), it must produce the same result. Use the `SagaID` as an idempotency key.

### Outbox Pattern Integration

Each service in the saga should use the outbox pattern to publish its events/commands — this guarantees at-least-once delivery even if the process crashes mid-way.

```go
// PaymentService: charge and publish event atomically
func (s *PaymentService) ChargeCustomer(ctx context.Context, userID string, amount int64, idempotencyKey string) error {
    tx, _ := s.db.BeginTx(ctx, nil)
    defer tx.Rollback()

    // Check idempotency — don't double-charge
    var exists bool
    tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM payments WHERE idempotency_key = $1)`, idempotencyKey).Scan(&exists)
    if exists {
        return tx.Commit() // already charged, success
    }

    tx.ExecContext(ctx, `INSERT INTO payments (user_id, amount, idempotency_key) VALUES ($1, $2, $3)`,
        userID, amount, idempotencyKey)

    // Write to outbox in same transaction
    tx.ExecContext(ctx, `INSERT INTO outbox_events (event_type, aggregate_id, payload) VALUES ($1,$2,$3)`,
        "PaymentCharged",
        idempotencyKey,
        fmt.Sprintf(`{"user_id":"%s","amount":%d,"idempotency_key":"%s"}`, userID, amount, idempotencyKey))

    return tx.Commit()
}
```

### ⚠️ Gotchas

1. **Lack of isolation (dirty reads):** Between saga steps, other sagas can read intermediate state. Example: inventory is reserved (step 3 done) but payment hasn't been confirmed yet. Another saga may see the reservation. Solution: use semantic locks (mark resources as "pending"), or accept that some intermediate states are visible.

2. **Long sagas are hard to debug:** A saga with 10 steps that fails at step 8 is hard to correlate. Solution: store the full saga state machine (current state + history) in a dedicated `sagas` table. Add distributed tracing (span IDs) across all service calls.

3. **Compensating transaction failures:** What if the compensating transaction also fails? (e.g., refund fails.) Solution: retry with exponential backoff. If it keeps failing, escalate to a dead-letter queue and notify an operator. Sagas can fail in a way that requires human intervention.

4. **Ordering guarantees:** Events from different services may arrive out of order. Always check the saga state before processing a reply — use optimistic locking on the `sagas` table.

---

## 9. Repository and Unit of Work Pattern

### Repository Pattern

> 🌍 **Real-World:** Shopify's core platform defines `OrderRepository` as an interface in the domain layer, with separate implementations for their primary MySQL store and a read-replica store. During their 2019 platform rewrite, they introduced a new sharded storage backend by writing a new `ShardedOrderRepository` adapter — all business logic remained untouched because it depended on the interface, not the implementation.

The Repository pattern provides an abstraction over data access. The domain layer defines an interface; infrastructure implements it. This allows swapping storage engines without changing business logic.

```go
// ── DOMAIN LAYER: defines the interface ──────────────────────────────────────

type User struct {
    ID        string
    Email     string
    Name      string
    CreatedAt time.Time
}

type UserRepository interface {
    FindByID(ctx context.Context, id string) (*User, error)
    FindByEmail(ctx context.Context, email string) (*User, error)
    Save(ctx context.Context, user *User) error
    Delete(ctx context.Context, id string) error
    ListByCreatedAfter(ctx context.Context, after time.Time, limit, offset int) ([]*User, error)
}

// ── INFRASTRUCTURE: PostgreSQL implementation ─────────────────────────────────

type PostgresUserRepository struct {
    db *sql.DB
}

func NewPostgresUserRepository(db *sql.DB) *PostgresUserRepository {
    return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) FindByID(ctx context.Context, id string) (*User, error) {
    row := r.db.QueryRowContext(ctx,
        `SELECT id, email, name, created_at FROM users WHERE id = $1`, id)

    var u User
    err := row.Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
    }
    if err != nil {
        return nil, fmt.Errorf("query user by id: %w", err)
    }
    return &u, nil
}

func (r *PostgresUserRepository) FindByEmail(ctx context.Context, email string) (*User, error) {
    row := r.db.QueryRowContext(ctx,
        `SELECT id, email, name, created_at FROM users WHERE email = $1`, email)

    var u User
    err := row.Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("user with email %s: %w", email, ErrNotFound)
    }
    return &u, err
}

func (r *PostgresUserRepository) Save(ctx context.Context, user *User) error {
    _, err := r.db.ExecContext(ctx,
        `INSERT INTO users (id, email, name, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET email = $2, name = $3`,
        user.ID, user.Email, user.Name, user.CreatedAt)
    return err
}

func (r *PostgresUserRepository) Delete(ctx context.Context, id string) error {
    result, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id)
    if err != nil {
        return err
    }
    n, _ := result.RowsAffected()
    if n == 0 {
        return fmt.Errorf("user %s: %w", id, ErrNotFound)
    }
    return nil
}

// ── TESTING: mock implementation ──────────────────────────────────────────────

type InMemoryUserRepository struct {
    mu    sync.RWMutex
    users map[string]*User
}

func NewInMemoryUserRepository() *InMemoryUserRepository {
    return &InMemoryUserRepository{users: make(map[string]*User)}
}

func (r *InMemoryUserRepository) FindByID(ctx context.Context, id string) (*User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    u, ok := r.users[id]
    if !ok {
        return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
    }
    // Return a copy to prevent mutation of stored data
    copy := *u
    return &copy, nil
}

func (r *InMemoryUserRepository) Save(ctx context.Context, user *User) error {
    r.mu.Lock()
    defer r.mu.Unlock()
    copy := *user
    r.users[user.ID] = &copy
    return nil
}

// (FindByEmail, Delete, ListByCreatedAfter omitted for brevity — same pattern)
```

### Unit of Work Pattern

> 🌍 **Real-World:** Django ORM (used at Instagram and Pinterest) implements the Unit of Work pattern through its database transaction context — `with transaction.atomic():` opens a unit of work where all model saves are tracked and committed atomically. Instagram's media processing pipeline uses this to atomically update media metadata, increment counters, and log analytics events in a single transaction, preventing the inconsistent state that caused data discrepancies in their early architecture.

**Unit of Work** tracks all changes to objects during a business transaction and commits them in a single database transaction. It prevents partial writes.

```go
// UnitOfWork tracks all objects modified in a transaction
type UnitOfWork interface {
    Users() UserRepository    // returns a tx-scoped repository
    Orders() OrderRepository
    Commit(ctx context.Context) error
    Rollback() error
}

type PostgresUnitOfWork struct {
    tx          *sql.Tx
    userRepo    *TxUserRepository
    orderRepo   *TxOrderRepository
}

func NewPostgresUnitOfWork(ctx context.Context, db *sql.DB) (*PostgresUnitOfWork, error) {
    tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
    if err != nil {
        return nil, err
    }
    return &PostgresUnitOfWork{
        tx:        tx,
        userRepo:  &TxUserRepository{tx: tx},
        orderRepo: &TxOrderRepository{tx: tx},
    }, nil
}

func (uow *PostgresUnitOfWork) Users() UserRepository  { return uow.userRepo }
func (uow *PostgresUnitOfWork) Orders() OrderRepository { return uow.orderRepo }
func (uow *PostgresUnitOfWork) Commit(ctx context.Context) error { return uow.tx.Commit() }
func (uow *PostgresUnitOfWork) Rollback() error { return uow.tx.Rollback() }

// TxUserRepository is the same as PostgresUserRepository but uses tx instead of db
type TxUserRepository struct {
    tx *sql.Tx
}

func (r *TxUserRepository) Save(ctx context.Context, user *User) error {
    _, err := r.tx.ExecContext(ctx,
        `INSERT INTO users (id, email, name, created_at) VALUES ($1,$2,$3,$4)
         ON CONFLICT(id) DO UPDATE SET email=$2, name=$3`,
        user.ID, user.Email, user.Name, user.CreatedAt)
    return err
}

// Usage in application service:
func (svc *TransferService) TransferBetweenUsers(ctx context.Context, fromID, toID string, amount Money) error {
    uow, err := svc.uowFactory.New(ctx)
    if err != nil {
        return err
    }
    defer uow.Rollback() // no-op if already committed

    from, err := uow.Users().FindByID(ctx, fromID)
    if err != nil {
        return err
    }
    to, err := uow.Users().FindByID(ctx, toID)
    if err != nil {
        return err
    }

    // Modify both entities
    if err := from.Debit(amount); err != nil {
        return err
    }
    to.Credit(amount)

    // Persist both in same transaction
    if err := uow.Users().Save(ctx, from); err != nil {
        return err
    }
    if err := uow.Users().Save(ctx, to); err != nil {
        return err
    }

    return uow.Commit(ctx) // atomic commit of all changes
}
```

### Generic Repository (Go 1.18+)

```go
// Generic repository reduces boilerplate for simple entities
type Repository[T any, ID comparable] interface {
    FindByID(ctx context.Context, id ID) (*T, error)
    Save(ctx context.Context, entity *T) error
    Delete(ctx context.Context, id ID) error
    FindAll(ctx context.Context, limit, offset int) ([]*T, error)
}

// Base implementation using reflection + struct tags
type GenericPostgresRepo[T any, ID comparable] struct {
    db        *sql.DB
    tableName string
    idColumn  string
    scanFunc  func(*sql.Row) (*T, error)
}

func (r *GenericPostgresRepo[T, ID]) FindByID(ctx context.Context, id ID) (*T, error) {
    row := r.db.QueryRowContext(ctx,
        fmt.Sprintf(`SELECT * FROM %s WHERE %s = $1`, r.tableName, r.idColumn), id)
    return r.scanFunc(row)
}
```

### ⚠️ N+1 Query Problem

> 🌍 **Real-World:** GitHub discovered an N+1 query bug in their pull request reviews page — loading a PR with 50 comments was firing 51 SQL queries (1 for comments + 50 for each commenter's avatar URL). After instrumenting with the Bullet gem, they refactored to a single JOIN query, reducing the PR page load from 800ms to under 100ms and cutting database load by 85% on their busiest pages.

The most common mistake with repositories:

```go
// BAD: N+1 queries — 1 query to fetch orders, then N queries to fetch each user
orders, _ := orderRepo.FindAll(ctx, 100, 0)
for _, order := range orders {
    user, _ := userRepo.FindByID(ctx, order.UserID) // N separate queries!
    fmt.Printf("Order %s by %s\n", order.ID, user.Name)
}

// GOOD: Use a JOIN query or batch load
type OrderWithUser struct {
    Order Order
    User  User
}

func (r *OrderRepository) FindAllWithUsers(ctx context.Context, limit, offset int) ([]*OrderWithUser, error) {
    rows, err := r.db.QueryContext(ctx, `
        SELECT o.id, o.total, o.status, u.id, u.name
        FROM orders o
        JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
        LIMIT $1 OFFSET $2
    `, limit, offset)
    // ... scan rows
}
```

**When NOT to use Repository + Unit of Work:**
- Simple CRUD APIs with no domain logic (direct DB access is fine)
- Reporting/analytics queries (use raw SQL; the abstraction leaks)
- Small services where the indirection adds more confusion than value

---

## 10. Classic LLD Design Problems

### 10.1 Thread-Safe LRU Cache

> 🌍 **Real-World:** Facebook's Memcached deployment (the world's largest) uses LRU eviction across thousands of cache nodes — each node maintains an in-memory LRU linked list so the least-recently-accessed objects (old social graph edges, expired session tokens) are evicted first when memory pressure occurs. Facebook's engineers found that a pure LRU policy caused "cache pollution" from viral videos being watched once by millions; they layered a segmented LRU (hot/cold segments) on top to protect frequently accessed user profile data from being evicted by one-time-watch traffic.

**Requirements:**
- `Get(key string) (interface{}, bool)` — O(1)
- `Put(key string, value interface{})` — O(1), evict LRU entry if at capacity
- Thread-safe for concurrent access

**Implementation — doubly-linked list + hash map:**

```go
package lrucache

import (
    "sync"
)

type node struct {
    key   string
    value interface{}
    prev  *node
    next  *node
}

type LRUCache struct {
    capacity int
    mu       sync.Mutex         // protects all fields below
    items    map[string]*node
    head     *node // most recently used (sentinel)
    tail     *node // least recently used (sentinel)
}

func NewLRUCache(capacity int) *LRUCache {
    if capacity <= 0 {
        panic("capacity must be positive")
    }
    head := &node{}
    tail := &node{}
    head.next = tail
    tail.prev = head
    return &LRUCache{
        capacity: capacity,
        items:    make(map[string]*node, capacity),
        head:     head,
        tail:     tail,
    }
}

func (c *LRUCache) Get(key string) (interface{}, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    n, ok := c.items[key]
    if !ok {
        return nil, false
    }
    c.moveToFront(n)
    return n.value, true
}

func (c *LRUCache) Put(key string, value interface{}) {
    c.mu.Lock()
    defer c.mu.Unlock()

    if n, ok := c.items[key]; ok {
        n.value = value
        c.moveToFront(n)
        return
    }

    n := &node{key: key, value: value}
    c.items[key] = n
    c.addToFront(n)

    if len(c.items) > c.capacity {
        lru := c.tail.prev
        c.removeNode(lru)
        delete(c.items, lru.key)
    }
}

func (c *LRUCache) Len() int {
    c.mu.Lock()
    defer c.mu.Unlock()
    return len(c.items)
}

// ── internal helpers (must be called with mu held) ──────────────────────────

func (c *LRUCache) addToFront(n *node) {
    n.prev = c.head
    n.next = c.head.next
    c.head.next.prev = n
    c.head.next = n
}

func (c *LRUCache) removeNode(n *node) {
    n.prev.next = n.next
    n.next.prev = n.prev
}

func (c *LRUCache) moveToFront(n *node) {
    c.removeNode(n)
    c.addToFront(n)
}
```

**Time complexity:**
- `Get`: O(1) — hash map lookup + O(1) list operations
- `Put`: O(1) — same
- Space: O(capacity)

**Why sync.Mutex not sync.RWMutex?** `Get` modifies the list (moves node to front), so it's a write operation. `RWMutex` would not help here — Get cannot be a read lock.

---

### 10.2 Connection Pool

> 🌍 **Real-World:** PgBouncer (used by Heroku, GitLab, and Notion) is a dedicated connection pool for PostgreSQL — applications open thousands of short-lived connections, and PgBouncer maintains a pool of just 20–100 real DB connections, multiplexing application requests across them. Without a pool, a PostgreSQL server receiving 10,000 simultaneous connection attempts would exhaust OS file descriptors and RAM; PgBouncer absorbs the connection surge and queues excess requests until a slot is free.

**Requirements:**
- `Acquire(ctx context.Context) (*Connection, error)` — blocks until a connection is available or context expires
- `Release(conn *Connection)` — return connection to pool
- Max connections enforced, health checks, idle timeout

```go
package connpool

import (
    "context"
    "errors"
    "sync"
    "sync/atomic"
    "time"
)

type Connection struct {
    id        int
    createdAt time.Time
    lastUsed  time.Time
    healthy   bool
    pool      *ConnectionPool // back-reference for return
}

func (c *Connection) Close() {
    c.pool.Release(c)
}

type ConnectionPool struct {
    maxSize     int
    idleTimeout time.Duration
    dialFunc    func() (*Connection, error)
    healthCheck func(*Connection) bool

    pool    chan *Connection
    mu      sync.Mutex
    created int32 // atomic counter of total connections created
    closed  bool
}

func NewConnectionPool(maxSize int, dialFunc func() (*Connection, error), healthCheck func(*Connection) bool) *ConnectionPool {
    return &ConnectionPool{
        maxSize:     maxSize,
        idleTimeout: 10 * time.Minute,
        dialFunc:    dialFunc,
        healthCheck: healthCheck,
        pool:        make(chan *Connection, maxSize),
    }
}

func (p *ConnectionPool) Acquire(ctx context.Context) (*Connection, error) {
    // Try to get an idle connection first
    select {
    case conn := <-p.pool:
        if p.isHealthy(conn) {
            conn.lastUsed = time.Now()
            return conn, nil
        }
        // Unhealthy — discard and fall through to create new one
        atomic.AddInt32(&p.created, -1)
    default:
        // Pool is empty — try to create new connection if under limit
    }

    if int(atomic.LoadInt32(&p.created)) < p.maxSize {
        conn, err := p.dialFunc()
        if err != nil {
            return nil, fmt.Errorf("dial new connection: %w", err)
        }
        conn.pool = p
        atomic.AddInt32(&p.created, 1)
        return conn, nil
    }

    // At max capacity — wait for one to be released
    select {
    case conn := <-p.pool:
        if !p.isHealthy(conn) {
            atomic.AddInt32(&p.created, -1)
            return p.Acquire(ctx) // retry
        }
        conn.lastUsed = time.Now()
        return conn, nil
    case <-ctx.Done():
        return nil, fmt.Errorf("acquire connection: %w", ctx.Err())
    }
}

func (p *ConnectionPool) Release(conn *Connection) {
    p.mu.Lock()
    if p.closed {
        p.mu.Unlock()
        conn.healthy = false // discard
        return
    }
    p.mu.Unlock()

    conn.lastUsed = time.Now()
    select {
    case p.pool <- conn:
        // returned to pool
    default:
        // pool is full (shouldn't happen if Acquire/Release are balanced)
        atomic.AddInt32(&p.created, -1)
    }
}

func (p *ConnectionPool) isHealthy(conn *Connection) bool {
    if time.Since(conn.lastUsed) > p.idleTimeout {
        return false
    }
    if p.healthCheck != nil {
        return p.healthCheck(conn)
    }
    return conn.healthy
}

func (p *ConnectionPool) Close() {
    p.mu.Lock()
    p.closed = true
    p.mu.Unlock()
    close(p.pool)
}
```

---

### 10.3 Job Scheduler (Cron-like)

> 🌍 **Real-World:** Sidekiq (used by Shopify, GitHub, and Twitch) implements a job scheduler using a Redis sorted set as a min-heap — each scheduled job is stored with its `next_run` timestamp as the score. A poller thread wakes every few seconds, checks if any jobs have a score ≤ now, and moves them to the execution queue. This approach scales to millions of scheduled jobs because Redis sorted-set lookups are O(log N), and the poller never needs to scan all jobs.

**Requirements:**
- `Schedule(id string, interval time.Duration, fn func()) JobID`
- `Start()` — begin executing scheduled jobs
- `Stop()` — graceful shutdown, no new jobs started
- Jobs that miss their window are skipped (not queued up)

```go
package scheduler

import (
    "container/heap"
    "sync"
    "time"
)

type Job struct {
    ID       string
    interval time.Duration
    fn       func()
    nextRun  time.Time
    index    int // index in the heap
}

// ── min-heap by nextRun ───────────────────────────────────────────────────────

type jobHeap []*Job

func (h jobHeap) Len() int            { return len(h) }
func (h jobHeap) Less(i, j int) bool  { return h[i].nextRun.Before(h[j].nextRun) }
func (h jobHeap) Swap(i, j int) {
    h[i], h[j] = h[j], h[i]
    h[i].index = i
    h[j].index = j
}
func (h *jobHeap) Push(x interface{}) {
    j := x.(*Job)
    j.index = len(*h)
    *h = append(*h, j)
}
func (h *jobHeap) Pop() interface{} {
    old := *h
    n := len(old)
    j := old[n-1]
    *h = old[:n-1]
    j.index = -1
    return j
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

type Scheduler struct {
    mu   sync.Mutex
    jobs *jobHeap
    stop chan struct{}
    wg   sync.WaitGroup
}

func NewScheduler() *Scheduler {
    h := &jobHeap{}
    heap.Init(h)
    return &Scheduler{jobs: h, stop: make(chan struct{})}
}

func (s *Scheduler) Schedule(id string, interval time.Duration, fn func()) {
    s.mu.Lock()
    defer s.mu.Unlock()
    job := &Job{
        ID:       id,
        interval: interval,
        fn:       fn,
        nextRun:  time.Now().Add(interval),
    }
    heap.Push(s.jobs, job)
}

func (s *Scheduler) Start() {
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        for {
            s.mu.Lock()
            if s.jobs.Len() == 0 {
                s.mu.Unlock()
                select {
                case <-s.stop:
                    return
                case <-time.After(10 * time.Millisecond):
                    continue
                }
            }
            next := (*s.jobs)[0]
            delay := time.Until(next.nextRun)
            s.mu.Unlock()

            if delay > 0 {
                select {
                case <-time.After(delay):
                case <-s.stop:
                    return
                }
            }

            s.mu.Lock()
            if s.jobs.Len() == 0 {
                s.mu.Unlock()
                continue
            }
            job := heap.Pop(s.jobs).(*Job)
            s.mu.Unlock()

            // Run job in goroutine — don't block scheduler
            go job.fn()

            // Reschedule
            job.nextRun = time.Now().Add(job.interval)
            s.mu.Lock()
            heap.Push(s.jobs, job)
            s.mu.Unlock()
        }
    }()
}

func (s *Scheduler) Stop() {
    close(s.stop)
    s.wg.Wait()
}
```

---

### 10.4 Pub/Sub System (In-Process)

> 🌍 **Real-World:** Slack uses an in-process pub/sub bus within each server node to fan out real-time messages — when a user sends a message to a channel, the event is published to the node's internal bus, and all WebSocket goroutines subscribed to that channel receive it simultaneously. Slow subscribers (lagging WebSocket connections) are handled by a bounded buffer; if the buffer fills, the connection is flagged as degraded and may receive a "catch up" batch pull instead of real-time push.

**Requirements:**
- `Subscribe(topic string) (<-chan interface{}, error)`
- `Publish(topic string, msg interface{}) error`
- `Unsubscribe(topic string, ch <-chan interface{})`
- Fan-out to all subscribers; non-blocking publish (slow subscribers are dropped)

```go
package pubsub

import (
    "fmt"
    "sync"
)

type Bus struct {
    mu          sync.RWMutex
    subscribers map[string][]chan interface{}
    bufferSize  int
    closed      bool
}

func NewBus(bufferSize int) *Bus {
    return &Bus{
        subscribers: make(map[string][]chan interface{}),
        bufferSize:  bufferSize,
    }
}

func (b *Bus) Subscribe(topic string) (<-chan interface{}, error) {
    b.mu.Lock()
    defer b.mu.Unlock()
    if b.closed {
        return nil, fmt.Errorf("bus is closed")
    }
    ch := make(chan interface{}, b.bufferSize)
    b.subscribers[topic] = append(b.subscribers[topic], ch)
    return ch, nil
}

func (b *Bus) Publish(topic string, msg interface{}) error {
    b.mu.RLock()
    subs := make([]chan interface{}, len(b.subscribers[topic]))
    copy(subs, b.subscribers[topic]) // copy slice under read lock
    b.mu.RUnlock()

    for _, ch := range subs {
        select {
        case ch <- msg:
            // delivered
        default:
            // subscriber is slow — drop message (or implement backpressure)
        }
    }
    return nil
}

func (b *Bus) Unsubscribe(topic string, sub <-chan interface{}) {
    b.mu.Lock()
    defer b.mu.Unlock()
    subs := b.subscribers[topic]
    for i, ch := range subs {
        if ch == sub {
            b.subscribers[topic] = append(subs[:i], subs[i+1:]...)
            close(ch)
            return
        }
    }
}

func (b *Bus) Close() {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.closed = true
    for topic, subs := range b.subscribers {
        for _, ch := range subs {
            close(ch)
        }
        delete(b.subscribers, topic)
    }
}
```

**Usage:**
```go
bus := NewBus(100)

ch1, _ := bus.Subscribe("payments")
ch2, _ := bus.Subscribe("payments")

go func() {
    for msg := range ch1 {
        fmt.Println("subscriber 1:", msg)
    }
}()
go func() {
    for msg := range ch2 {
        fmt.Println("subscriber 2:", msg)
    }
}()

bus.Publish("payments", PaymentEvent{Amount: 100})
```

---

### 10.5 Circuit Breaker

> 🌍 **Real-World:** Netflix's Hystrix library (now Resilience4j) uses the Circuit Breaker pattern to protect their API gateway from cascading failures — if the Recommendations service starts returning errors or timing out, the circuit opens and the gateway immediately returns cached or default recommendations instead of waiting for a timeout. During a 2012 AWS outage, open circuit breakers prevented the recommendations failures from taking down the login service and playback APIs, which had no dependency on recommendations.

**States:**
- **CLOSED** (normal): requests flow through; failure count tracked
- **OPEN** (tripped): requests immediately rejected; retry timer running
- **HALF-OPEN** (probing): one test request allowed; if success → CLOSED; if fail → OPEN

```go
package circuitbreaker

import (
    "errors"
    "sync"
    "time"
)

type State int

const (
    StateClosed   State = iota // normal operation
    StateOpen                  // failing — reject all requests
    StateHalfOpen              // probing — allow one request
)

var ErrCircuitOpen = errors.New("circuit breaker is open")

type CircuitBreaker struct {
    mu sync.Mutex

    // Config
    maxFailures  int
    openTimeout  time.Duration // how long to stay OPEN before trying HALF-OPEN
    successThreshold int       // successes needed in HALF-OPEN to return to CLOSED

    // State
    state        State
    failures     int
    successes    int
    lastFailure  time.Time
    openedAt     time.Time
}

func NewCircuitBreaker(maxFailures int, openTimeout time.Duration) *CircuitBreaker {
    return &CircuitBreaker{
        maxFailures:      maxFailures,
        openTimeout:      openTimeout,
        successThreshold: 1,
        state:            StateClosed,
    }
}

func (cb *CircuitBreaker) Execute(fn func() error) error {
    if err := cb.beforeRequest(); err != nil {
        return err
    }
    err := fn()
    cb.afterRequest(err)
    return err
}

func (cb *CircuitBreaker) beforeRequest() error {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    switch cb.state {
    case StateClosed:
        return nil
    case StateOpen:
        if time.Since(cb.openedAt) >= cb.openTimeout {
            cb.state = StateHalfOpen
            cb.successes = 0
            return nil // allow one probe request
        }
        return ErrCircuitOpen
    case StateHalfOpen:
        return ErrCircuitOpen // only one probe at a time
    }
    return nil
}

func (cb *CircuitBreaker) afterRequest(err error) {
    cb.mu.Lock()
    defer cb.mu.Unlock()

    if err != nil {
        cb.failures++
        cb.lastFailure = time.Now()
        if cb.state == StateHalfOpen || cb.failures >= cb.maxFailures {
            cb.trip()
        }
        return
    }

    // Success
    switch cb.state {
    case StateClosed:
        cb.failures = 0 // reset on success (simple strategy)
    case StateHalfOpen:
        cb.successes++
        if cb.successes >= cb.successThreshold {
            cb.reset()
        }
    }
}

func (cb *CircuitBreaker) trip() {
    cb.state = StateOpen
    cb.openedAt = time.Now()
}

func (cb *CircuitBreaker) reset() {
    cb.state = StateClosed
    cb.failures = 0
    cb.successes = 0
}

func (cb *CircuitBreaker) State() State {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    return cb.state
}
```

**Usage:**
```go
cb := NewCircuitBreaker(5, 30*time.Second)

err := cb.Execute(func() error {
    return callExternalService()
})
if errors.Is(err, ErrCircuitOpen) {
    // fast-fail: return cached data or error
    return cachedResponse, nil
}
```

---

### 10.6 Object Pool

> 🌍 **Real-World:** Go's `net/http` standard library uses `sync.Pool` for HTTP request and response body buffers — parsing an HTTP request involves allocating temporary byte buffers that are expensive to garbage-collect at high throughput. By pooling these 4KB–32KB scratch buffers, servers like Cloudflare Workers (written in Go-like V8 isolates) handle millions of requests per second without triggering continuous GC pauses that would add milliseconds of latency.

**When to use:** Creating objects is expensive (DB connections, HTTP clients, byte buffers for compression, worker goroutines).

```go
// ── Using sync.Pool (GC-aware, for short-lived objects) ──────────────────────
// sync.Pool objects may be collected by GC. Don't use for connections.

var bufferPool = sync.Pool{
    New: func() interface{} {
        return make([]byte, 0, 4096) // pre-allocated 4KB buffer
    },
}

func compressData(data []byte) ([]byte, error) {
    buf := bufferPool.Get().([]byte)
    defer func() {
        buf = buf[:0] // reset length, keep capacity
        bufferPool.Put(buf)
    }()

    w, _ := gzip.NewWriter(bytes.NewBuffer(buf))
    w.Write(data)
    w.Close()
    return buf, nil
}

// ── Custom object pool (lifecycle management, no GC) ─────────────────────────

type WorkerPool struct {
    workers chan *Worker
    wg      sync.WaitGroup
    once    sync.Once
    done    chan struct{}
}

type Worker struct {
    id      int
    created time.Time
}

func NewWorkerPool(size int) *WorkerPool {
    p := &WorkerPool{
        workers: make(chan *Worker, size),
        done:    make(chan struct{}),
    }
    for i := 0; i < size; i++ {
        p.workers <- &Worker{id: i, created: time.Now()}
    }
    return p
}

func (p *WorkerPool) Acquire(ctx context.Context) (*Worker, error) {
    select {
    case w := <-p.workers:
        return w, nil
    case <-ctx.Done():
        return nil, ctx.Err()
    case <-p.done:
        return nil, errors.New("pool closed")
    }
}

func (p *WorkerPool) Release(w *Worker) {
    select {
    case p.workers <- w:
    case <-p.done:
        // pool closed, discard worker
    }
}

func (p *WorkerPool) Close() {
    p.once.Do(func() {
        close(p.done)
    })
}
```

**Trade-offs of sync.Pool vs custom pool:**

| | sync.Pool | Custom Pool |
|---|---|---|
| GC interaction | Objects may be collected | Objects persist |
| Use case | Short-lived buffers | Long-lived resources (connections) |
| Lifecycle | No | Yes (can validate, refresh) |
| Backpressure | No | Yes (blocking Acquire) |

---

## 11. LLD Interview Q&A — 40 Questions

---

**Q1: What is the Single Responsibility Principle and why does it matter in large codebases?**
**A:** SRP states that a class or module should have only one reason to change — one responsibility. In large codebases, violating SRP creates "god classes" that accumulate unrelated logic: a `UserService` that handles authentication, email sending, billing, and analytics. When the email provider changes, you touch the same class that handles billing, risking regressions. SRP makes each unit independently testable, replaceable, and understandable. The practical test: if you cannot describe what a class does without using the word "and", it likely violates SRP. In Go, SRP maps naturally to small, focused interfaces — each interface has one clear purpose.

---

**Q2: Explain the Open/Closed Principle with a real example.**
**A:** OCP states that a software entity should be open for extension but closed for modification. You add new behavior by adding new code, not by changing existing code. Example: a payment processor that handles Stripe, PayPal, and Braintree. Violation: a giant switch statement in `processPayment()` that must be modified every time a new provider is added. Correct: define a `PaymentGateway` interface; add new providers as new implementations without touching existing code. In Go this is natural: define an interface, new providers implement it, the calling code never changes. OCP is especially important for library code that others depend on — changing method signatures breaks callers.

---

**Q3: What is the Liskov Substitution Principle, and what is a classic violation?**
**A:** LSP states that objects of a subtype must be substitutable for objects of the supertype without altering the correctness of the program. A classic violation: `Square` extends `Rectangle`. `Rectangle` has `SetWidth` and `SetHeight`. If you substitute a `Square` for a `Rectangle` and call `SetWidth(5)`, the `Square` must also set height to 5 (to stay square), breaking the contract that `SetHeight` is independent. Code that assumed it was working with a `Rectangle` gets wrong results. In Go (which uses implicit interfaces rather than inheritance), LSP applies to interface implementations: if an interface says `Read() (n int, err error)`, an implementation that sometimes returns `n > len(p)` violates LSP. Test: write unit tests against the interface type, run them against every implementation.

---

**Q4: Explain the Interface Segregation Principle with a code example.**
**A:** ISP states that clients should not be forced to depend on methods they do not use. Fat interfaces create unnecessary coupling. Example: a `Storage` interface with `ReadFile`, `WriteFile`, `DeleteFile`, `ListFiles`, `ChangePermissions`. A read-only cache client only needs `ReadFile` but must implement all five. Split into `FileReader`, `FileWriter`, `FileDeleter` — clients implement only what they use. In Go this is idiomatic: interfaces are tiny by convention (`io.Reader` has one method, `io.Writer` has one method). The `io.ReadWriter` composes them for cases that need both. ISP reduces the blast radius of interface changes and makes mocking in tests trivial.

---

**Q5: What is the Dependency Inversion Principle and how does it relate to testability?**
**A:** DIP states that high-level modules should not depend on low-level modules; both should depend on abstractions. Also: abstractions should not depend on details; details should depend on abstractions. Without DIP: `OrderService` directly instantiates `PostgresOrderRepository` — to test `OrderService`, you need a real database. With DIP: `OrderService` depends on `OrderRepository` interface; in tests you inject `InMemoryOrderRepository`. The key technique is **dependency injection** — dependencies are passed in (via constructor, method, or container), not created internally. In Go, DIP is enforced by accepting interfaces in function/struct parameters. DIP is the mechanism that makes hexagonal architecture possible: the core defines interfaces (abstractions), infrastructure implements them (details), and the dependency arrow points inward.

---

**Q6: What is the Observer pattern and when should you use it?**
**A:** Observer defines a one-to-many dependency: when one object (Subject) changes state, all its dependents (Observers) are notified automatically. Use it when a change in one object requires updating others without knowing in advance how many objects need to be updated. Example: a stock price ticker — multiple displays, alert systems, and logging modules all need to react when price changes. In Go, this maps naturally to channels or callback functions. The event bus pattern is a generalization: `bus.Subscribe("price_updated", fn)`. Avoid when the dependency graph is complex and circular — Observer can create debugging nightmares where a cascade of notifications is hard to trace. In distributed systems, message queues (Kafka, SQS) are the distributed version of Observer.

---

**Q7: Explain the Strategy pattern with a real-world example.**
**A:** Strategy defines a family of algorithms, encapsulates each one, and makes them interchangeable. The client selects which algorithm to use at runtime. Example: sorting. A data export system needs to sort by different fields, or use different sort algorithms depending on data size. Define a `SortStrategy` interface with `Sort(data []Row)`; implement `QuickSort`, `MergeSort`, `ExternalMergeSort`. The caller sets the strategy and the export pipeline doesn't need to know which algorithm is used. In Go:
```go
type PricingStrategy interface {
    Calculate(order Order) Money
}
type StandardPricing struct{}
type VIPPricing struct{ discount float64 }
type CheckoutService struct { pricing PricingStrategy }
```
Strategy differs from State in that strategies are usually stateless and interchangeable by the client, while State objects know about transitions.

---

**Q8: What is the Factory Method pattern, and when is it preferable over direct construction?**
**A:** Factory Method defines an interface for creating an object but lets subclasses decide which class to instantiate. Use it when: (1) the exact type to create depends on runtime conditions, (2) construction is complex and should be centralized, (3) you want to hide the concrete type behind an interface. Example: notification system — `NotificationFactory.Create(channel string)` returns an `EmailNotifier`, `SMSNotifier`, or `PushNotifier` based on channel. The caller works with `Notifier` interface and doesn't care about the concrete type. In Go, a factory function returns an interface:
```go
func NewRepository(driver string, dsn string) (UserRepository, error) {
    switch driver {
    case "postgres": return NewPostgresRepo(dsn)
    case "mongo":    return NewMongoRepo(dsn)
    default:         return nil, fmt.Errorf("unknown driver: %s", driver)
    }
}
```
Abstract Factory creates families of related objects (e.g., a `CloudProviderFactory` that creates storage, compute, and networking objects all for the same cloud provider).

---

**Q9: Explain the Decorator pattern. How is it different from inheritance?**
**A:** Decorator adds behavior to an object dynamically without modifying its class or subclassing. It wraps the original object, calling it and adding behavior before/after. Key advantage over inheritance: you can combine decorators (stack them) to get any combination of behaviors. Example:
```go
type Logger struct{ next http.Handler }
func (l *Logger) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    log.Printf("-> %s %s", r.Method, r.URL.Path)
    l.next.ServeHTTP(w, r)
    log.Printf("<- done")
}

type Auth struct{ next http.Handler }
func (a *Auth) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if r.Header.Get("Authorization") == "" {
        http.Error(w, "unauthorized", 401); return
    }
    a.next.ServeHTTP(w, r)
}

// Compose: handler wrapped with Auth wrapped with Logger
handler := &Logger{next: &Auth{next: myBusinessHandler}}
```
With inheritance, you'd need a new subclass for every combination. Decorators compose. `io.Reader` in Go is a perfect example — `bufio.NewReader`, `gzip.NewReader`, `cipher.StreamReader` all decorate a base reader.

---

**Q10: What is the Proxy pattern? Give three real-world uses.**
**A:** Proxy provides a surrogate or placeholder for another object to control access to it. Three real uses: (1) **Caching Proxy** — before calling an expensive service, check if the result is cached; `CachingUserRepo` wraps `PostgresUserRepo` and caches `FindByID` results in Redis. (2) **Authorization Proxy** — before delegating to the real service, check permissions; a `SecureOrderService` wraps `OrderService` and verifies the user has the right role before each operation. (3) **Remote Proxy (RPC stub)** — the gRPC generated client is a proxy; calling methods on it transparently sends network requests. Proxy differs from Decorator: Proxy controls *access* (may deny entirely), Decorator *adds behavior* to the call.

---

**Q11: Explain the Composite pattern. When would you use it?**
**A:** Composite lets you compose objects into tree structures to represent part-whole hierarchies. Clients treat individual objects (leaves) and compositions (nodes) uniformly through a common interface. Classic example: file system — `File` and `Directory` both implement `FileSystemNode` with `Size()` and `List()`. A `Directory`'s `Size()` sums the sizes of all children recursively; `File`'s `Size()` returns its own size. Use Composite when your domain has hierarchical structures: organization charts, UI component trees, expression trees (for evaluating formulas), permission groups (a group can contain users or other groups). The key insight is that the client code loops over children without caring whether each is a leaf or a subtree.

---

**Q12: What is the Facade pattern and when does it add value?**
**A:** Facade provides a simplified interface to a complex subsystem. It doesn't prevent access to the subsystem (unlike Proxy) — it just offers a convenient entry point. Example: a `VideoConverter` facade that internally orchestrates `VideoDecoder`, `AudioDecoder`, `BitrateAdjuster`, `Encoder`, and `FileWriter`. The caller just calls `converter.Convert("input.mp4", "output.avi")`. Value: reduces learning curve for using a subsystem, decouples client code from internal complexity, makes it easy to swap out the subsystem. The risk: Facade can become a god object if you keep piling methods on it. Keep facades thin — they should delegate, not contain logic.

---

**Q13: What is the Adapter pattern, and how is it different from Facade?**
**A:** Adapter makes two incompatible interfaces work together. It wraps one object and presents the interface that the client expects. Facade simplifies a complex interface; Adapter translates between two existing interfaces. Example: your system expects a `Logger` interface with `Log(level, message string)`. The third-party logging library you want to use has `WriteMessage(msg LogEntry)`. You write an `Adapter` struct that wraps the third-party logger and implements your `Logger` interface. In Go this is especially clean because of implicit interfaces:
```go
type ZapAdapter struct{ log *zap.Logger }
func (a *ZapAdapter) Log(level, message string) {
    switch level {
    case "error": a.log.Error(message)
    case "info":  a.log.Info(message)
    }
}
```
Use Adapter when integrating legacy code or third-party libraries into a system that has its own interface contracts.

---

**Q14: What is the difference between Mutex and RWMutex in Go, and when do you choose each?**
**A:** `sync.Mutex` allows only one goroutine at a time (exclusive lock for both reads and writes). `sync.RWMutex` allows multiple concurrent readers (`RLock`) but only one writer (`Lock`) — writers block all readers and other writers. Use `RWMutex` when reads are far more frequent than writes and the critical section is non-trivial. Example: a config cache that is read thousands of times per second but updated once per minute — `RWMutex` eliminates contention between readers. However, if writes are frequent or the critical section is just a pointer assignment (which is already atomic on 64-bit platforms), `Mutex` is simpler and may perform similarly. `RWMutex` has higher overhead than `Mutex` when there is significant write contention because writers must wait for all active readers to finish.

---

**Q15: Explain the "share memory by communicating" philosophy in Go.**
**A:** Instead of sharing data between goroutines via shared memory protected by mutexes, Go encourages passing data through channels — the channel ownership model means only one goroutine "owns" a value at a time, eliminating data races by design. Example: instead of having a shared `balance` protected by a mutex, run a single "account goroutine" that owns the balance and processes debit/credit commands from a channel. Other goroutines send commands and wait for replies on reply channels. This model is inspired by CSP (Communicating Sequential Processes). The rule of thumb: use channels when transferring ownership; use mutexes when protecting shared state that multiple goroutines legitimately share (e.g., a cache). In practice, both are valid — the stdlib itself uses mutexes heavily (`sync.Map`, `sync.Pool`).

---

**Q16: What is the sync.Once pattern and what problems does it solve?**
**A:** `sync.Once` guarantees that a function is executed exactly once, even if called concurrently from multiple goroutines. It solves the lazy initialization problem: the first call to `Do(fn)` runs `fn`; subsequent calls are no-ops. The typical use case is singleton initialization:
```go
var instance *Service
var once sync.Once
func GetService() *Service {
    once.Do(func() { instance = &Service{...} })
    return instance
}
```
Without `sync.Once`, a naive double-check (read instance, if nil then lock and initialize) has a race condition on the initial read. `sync.Once` uses an internal atomic flag and a mutex to guarantee exactly-once semantics with zero cost after initialization. Important: if the function passed to `Do` panics, `Once` treats it as done — the function will not be retried.

---

**Q17: How do you implement a thread-safe counter without a mutex?**
**A:** Use `sync/atomic` operations, which map to hardware-level atomic CPU instructions:
```go
type Counter struct {
    value int64
}

func (c *Counter) Increment() {
    atomic.AddInt64(&c.value, 1)
}

func (c *Counter) Get() int64 {
    return atomic.LoadInt64(&c.value)
}

func (c *Counter) CompareAndSwap(old, new int64) bool {
    return atomic.CompareAndSwapInt64(&c.value, old, new)
}
```
Atomic operations are faster than mutexes for single-value operations because they avoid OS-level context switches. However, they only work for simple scalar values. For anything involving multiple fields that must be consistent together (e.g., updating both `count` and `sum` atomically), you need a mutex. The modern Go equivalent is `atomic.Int64`, `atomic.Bool`, etc. (Go 1.19+).

---

**Q18: How does a sliding window rate limiter work, and why is it preferred over fixed window?**
**A:** A fixed window rate limiter counts requests in discrete time windows (e.g., 100 req per minute, reset at :00). Problem: a client can make 100 requests at :59 and 100 more at 1:00, effectively making 200 requests in 2 seconds. A sliding window tracks the exact timestamp of each request. For each incoming request, count how many requests occurred in the past 60 seconds (from the current moment). This prevents the boundary burst. Implementation: store timestamps in a sorted set (Redis `ZSET`). On each request: remove timestamps older than the window, count remaining, add current timestamp if under limit. The Redis Lua script approach makes this atomic. Cost: O(N) per request where N is requests in the window — acceptable for reasonable limits but needs capping. Alternative: sliding window counter (approximation) — uses two fixed windows and a weighted average, O(1) but not exact.

---

**Q19: Design a cache with TTL eviction. What data structures do you use?**
**A:** Two structures: a hash map for O(1) lookup, and a min-heap (or doubly-linked list with a time-ordered structure) for efficient eviction. The hash map stores `key → (value, expiry_time)`. The min-heap stores entries ordered by expiry time. On `Get`: check expiry, return if valid, delete if expired. On `Set`: add to map and heap. Eviction strategy (lazy vs eager): **lazy eviction** — only evict on access (dead entries stay in memory until accessed). **Eager eviction** — a background goroutine runs periodically, pops the heap, and deletes expired entries. The TTL cache shown in Section 4 uses lazy eviction with periodic cleanup. For production, combine both: lazy eviction on Get (immediate) + periodic sweep for entries that are never accessed again. Redis uses a combination: lazy expiry + probabilistic sampling of keys to actively expire.

---

**Q20: What are the trade-offs between a centralized vs distributed rate limiter?**
**A:** A **centralized rate limiter** (single Redis cluster) has accurate global limits — you know exactly how many requests a user has made across all instances. Trade-off: Redis is a single point of failure (mitigated by Redis Cluster + replicas), and every request incurs a Redis round-trip (typically 0.5-2ms added latency). A **distributed rate limiter** (local in-process, no shared state) has zero latency overhead but each instance enforces limits independently. With 10 instances, a user can make 10x the intended limit before being blocked. Solutions: (1) partition users — each user's requests are always routed to the same instance (sticky routing). (2) Gossip protocol — instances share their counts periodically (eventual consistency). (3) Token pre-allocation — each instance grabs a batch of tokens from central Redis (e.g., 100 tokens at a time), reducing Redis calls by 100x. The right choice depends on how strict the limits need to be and the latency budget.

---

**Q21: What is CQRS and what problem does it solve?**
**A:** CQRS (Command Query Responsibility Segregation) separates the model used for reads from the model used for writes. The write model is optimized for consistency and business rules (normalized, transactional), while the read model is optimized for query patterns (denormalized, materialized views). The problem it solves: a single model that must satisfy both transactional writes (with locks, foreign keys, normalization) and complex read queries (joins, aggregations, full-text search) makes it impossible to optimize either. With CQRS, the write side persists changes and publishes events; the read side subscribes to events and updates its own denormalized projections. This means you can use PostgreSQL for writes and Elasticsearch for reads, each optimized for its purpose. The cost: eventual consistency (the read model lags slightly behind the write model) and increased operational complexity.

---

**Q22: What is Event Sourcing, and when is it appropriate?**
**A:** Event Sourcing stores the full sequence of events that led to the current state, rather than just the current state. State is derived by replaying events. It is appropriate when: (1) you need a complete audit log (financial systems, healthcare, compliance), (2) you need to reconstruct past states ("what was the balance on January 1?"), (3) you have multiple read models that need to be rebuilt from history, (4) you want to decouple the write path from multiple downstream consumers. It is inappropriate when: the domain is simple CRUD (overkill), the team is unfamiliar with the pattern (steep learning curve), or you need strong read-after-write consistency (ES is eventually consistent). The operational overhead includes managing event schema evolution, snapshot strategies, and projection replay — these add significant complexity that must be justified by the requirements.

---

**Q23: How do you handle event schema evolution in Event Sourcing?**
**A:** Events are immutable historical records — you cannot modify events you've already stored. When your event schema needs to change, you have several strategies: (1) **Upcasting**: when loading old events, transform them to the current schema before applying. Store the event version in the schema; the event store applies transformers on read. `v1_MoneyDeposited → v2_MoneyDeposited` by the upcaster. (2) **New event types**: instead of changing `MoneyDeposited`, create `MoneyDeposited.v2` — old code reads `v1`, new code reads both. (3) **Weak schema**: use JSON with optional fields — new fields are added, old events just have null values. (4) **Copy-and-transform migration**: read all events, write transformed versions to a new event store, cut over. Option 1 (upcasting) is the most maintainable for long-lived systems.

---

**Q24: What is a Bounded Context in DDD, and how does it affect team structure?**
**A:** A Bounded Context is an explicit boundary within which a particular domain model is defined, applicable, and consistent. The same term (e.g., "Customer") can mean different things in different contexts — in the Sales context, a Customer has a credit limit; in the Shipping context, a Customer has a delivery address; in the Support context, a Customer has a ticket history. Each context has its own model, its own language, its own code. Conway's Law states that systems are shaped by the communication structure of the organizations that build them — and Bounded Contexts encode this. Ideally, one team owns one Bounded Context. Teams integrate via well-defined interfaces (APIs, events), not shared databases or shared code. When teams share a database, schema changes in one context break others — this is a Bounded Context violation.

---

**Q25: Explain the Aggregate pattern and the rule of "one aggregate per transaction."**
**A:** An Aggregate is a cluster of domain objects treated as a single unit of consistency. The Aggregate Root is the only entry point — all mutations go through it, and it enforces all invariants. The rule "one aggregate per transaction" means that a single business transaction should only modify one aggregate. This rule exists because transactions that span aggregates require distributed locking, which kills scalability. If a use case seems to require modifying two aggregates, ask: (1) should they be one aggregate? (probably not if they scale independently), (2) can one aggregate modification trigger the other via a domain event (eventually consistent)? Example: when placing an order, the Order aggregate is created (one transaction). An event `OrderPlaced` is published. The Inventory service listens and reserves stock in a separate transaction. This eventual consistency is acceptable for most business scenarios.

---

**Q26: What is the Saga pattern and how does it differ from 2-Phase Commit?**
**A:** A Saga is a sequence of local transactions where each step publishes an event or message that triggers the next step. If a step fails, compensating transactions undo previous steps. 2-Phase Commit is a protocol where all participants lock resources and a coordinator decides to commit or abort atomically. The key differences: 2PC is synchronous and blocking (participants hold locks during the protocol), Saga is asynchronous and non-blocking (no locks held between steps). 2PC requires all participants to support the protocol (most NoSQL databases and external APIs don't), Saga works with any service. 2PC provides ACID isolation (no dirty reads between steps), Saga does not (intermediate states are visible — an order may be "payment charged but inventory not yet reserved"). For microservices, Saga is the practical choice; 2PC works only within a single database or with XA-compliant resources.

---

**Q27: What is an idempotency key and why is it critical in distributed systems?**
**A:** An idempotency key is a unique token that a client sends with a request to indicate "this is the same request I sent before." On the server, if a request with the same key has already been processed, return the cached result without re-executing. This is critical because in distributed systems, network failures cause both non-delivery (message lost) and duplicate delivery (message received twice, ACK lost). Without idempotency: a user's payment may be charged twice if the network fails after the charge but before the ACK. With idempotency: the client retries with the same key; the server detects the duplicate and returns the original response. Implementation: store `(idempotency_key, response)` in the database. Before processing, check if key exists. If yes, return stored response. If no, process and store. The check-and-store must be atomic (use a unique constraint on `idempotency_key`).

---

**Q28: What is the Outbox Pattern and why is it necessary?**
**A:** The Outbox Pattern solves the dual-write problem: you need to update a database AND publish a message to a message broker, but these are two separate systems with no shared transaction. If the message broker call fails after the DB commit, the event is lost. If the DB commit fails after publishing, the event fires but the state change didn't happen. Solution: write the event to an `outbox` table in the same database transaction as the business data. A separate relay process polls the outbox table and publishes to the message broker. If the relay crashes, it restarts and re-publishes (messages may be published more than once — consumers must be idempotent). Alternatives: change data capture (CDC) tools like Debezium read the database's write-ahead log and publish to Kafka without an application-level outbox table.

---

**Q29: What is the difference between Orchestration and Choreography in distributed systems?**
**A:** Choreography: services react to events autonomously with no central coordinator. Each service knows what events to listen to and what events to emit. Pros: loose coupling, no single point of failure. Cons: the overall business process is implicit — it's spread across services, making it hard to understand, debug, and monitor. What does the overall flow look like? You have to trace through all services to find out. Orchestration: a central orchestrator (saga orchestrator, workflow engine) explicitly commands services and reacts to their responses. The business process is modeled explicitly in one place. Pros: the flow is visible, easy to debug, easy to add retry/timeout logic. Cons: the orchestrator is a central point of coupling and potential failure. In practice: choreography works well for simple, stable flows; orchestration is better for complex, multi-step flows where visibility and error handling matter.

---

**Q30: How does the Repository pattern improve testability?**
**A:** The Repository pattern introduces an interface between domain logic and data access. In production, the interface is implemented by a PostgresRepository. In tests, it's implemented by an InMemoryRepository that stores data in a map. This means: (1) unit tests run in milliseconds — no database required, no test containers, no setup/teardown. (2) tests are deterministic — no flaky tests due to DB state. (3) you can inject faults — implement an `ErrorRepository` that always returns errors to test error handling. (4) tests can run in parallel — in-memory state is isolated per test. Without the Repository pattern, testing business logic requires a real database, making tests slow, brittle, and hard to run locally. The trade-off: you need to write and maintain mock implementations, and you may miss bugs that only appear with real database behavior (e.g., NULL handling, transaction isolation).

---

**Q31: Explain the Hexagonal Architecture (Ports and Adapters) and its benefits.**
**A:** Hexagonal Architecture (Alistair Cockburn, 2005) places the application core (domain + use cases) at the center. The core defines interfaces called "ports" — input ports (how the core is called: use case interfaces) and output ports (what the core needs: repository, email, payment interfaces). "Adapters" implement these ports for specific technologies: HTTP adapter implements the input port, PostgreSQL adapter implements the output port. Benefits: (1) The core is 100% testable without any infrastructure — inject mock adapters. (2) Infrastructure is swappable — replace PostgreSQL with MongoDB by writing a new adapter, no core changes. (3) The core has no framework imports — it can outlive any framework. (4) Multiple entry points — the same core can be driven by HTTP, gRPC, CLI, or a test harness. The discipline required: strict enforcement of the dependency rule (core must never import adapter code).

---

**Q32: What is the Dependency Injection Container, and what are its pros and cons?**
**A:** A DI container (also called IoC container) is a framework that automatically constructs and wires together objects based on their declared dependencies. Instead of manually calling `NewOrderService(NewPostgresRepo(db), NewStripeGateway(key))`, you register types with the container, and it resolves the entire dependency graph. In Go, popular choices: `google/wire` (compile-time, code generation), `uber-go/dig` (runtime reflection). Pros: eliminates manual wiring code in large applications (hundreds of services); makes it easy to swap implementations. Cons: obscures the dependency graph (you can't see at a glance what a service depends on); debugging DI container errors is painful; adds a dependency on a framework. For small to medium codebases, manual dependency injection (explicit constructor calls in `main.go`) is cleaner and more readable. DI containers pay off at large scale.

---

**Q33: How do you design for observability in LLD?**
**A:** Observability has three pillars — metrics, logs, and traces — and they should be designed in from the start. (1) **Metrics**: expose key counters and histograms at the interface level. Wrap repositories with a `MetricRepository` decorator that records query duration, error rate, and cache hit rate. (2) **Structured logging**: log at boundaries (start of each use case, each external call, each error). Use structured key-value logs, not string concatenation, so logs are searchable. Pass a logger via context or dependency injection, never use global loggers. (3) **Tracing**: propagate trace IDs (W3C TraceContext headers) from incoming requests through all downstream calls. Use OpenTelemetry SDK — it's provider-agnostic. (4) **Health endpoints**: expose `/healthz` (is the process alive?) and `/readyz` (is it ready to receive traffic? — DB connections warmed up, caches populated). Design principle: observability code lives in adapters, not in the domain core.

---

**Q34: What is the difference between a domain event and an integration event?**
**A:** A **domain event** represents something that happened within a bounded context's domain model — it's part of the ubiquitous language. Example: `OrderPlaced`, `PaymentFailed`. It is raised inside an aggregate and handled within the same bounded context or published externally. A domain event is typically fine-grained and contains domain-specific data. An **integration event** is the external representation of a domain event — it's designed for cross-context communication. It should be stable, versioned, and backward-compatible. An integration event is the contract between bounded contexts. The distinction matters because you can freely change domain events (internal), but changing integration events (external contracts) breaks other teams. Domain events often contain aggregate IDs; integration events contain enough data for consumers to act without fetching more data.

---

**Q35: What is the Specification pattern and when is it useful?**
**A:** The Specification pattern encapsulates a business rule as an object that can answer "does this object satisfy this specification?" It enables combining rules with AND, OR, NOT operators.
```go
type Specification[T any] interface {
    IsSatisfiedBy(t T) bool
}

type MinBalanceSpec struct { min int64 }
func (s MinBalanceSpec) IsSatisfiedBy(acc Account) bool { return acc.Balance >= s.min }

type ActiveAccountSpec struct{}
func (s ActiveAccountSpec) IsSatisfiedBy(acc Account) bool { return !acc.Closed }

type AndSpec[T any] struct { left, right Specification[T] }
func (s AndSpec[T]) IsSatisfiedBy(t T) bool { return s.left.IsSatisfiedBy(t) && s.right.IsSatisfiedBy(t) }
```
Use it when you have complex, combinable filtering rules that appear in multiple places (eligibility rules, validation). Avoid it for simple one-off filters — it adds complexity. Specifications can also be translated to SQL WHERE clauses for repository queries.

---

**Q36: How do you handle backward compatibility when evolving a gRPC API?**
**A:** Protobuf and gRPC have strong conventions for backward compatibility: (1) Never remove or rename existing fields — instead, deprecate them. Old clients still send/receive these fields. (2) Never change a field's number — field numbers are the wire identity. (3) Adding new fields is safe — old clients ignore unknown fields; new clients get default values for missing fields from old clients. (4) For breaking changes, create a new service version (`OrderServiceV2`) while keeping the old one. (5) Use `oneof` for mutually exclusive variants rather than adding many optional fields. (6) Avoid changing field types. For REST APIs: versioning via URL prefix (`/v2/orders`) is the most common approach. The rule: be conservative in what you send, be liberal in what you accept (Postel's Law). In practice, maintaining multiple API versions is expensive — plan your schema carefully before going to production.

---

**Q37: What is the difference between optimistic and pessimistic locking, and when do you use each?**
**A:** **Pessimistic locking** acquires a lock before reading data and holds it until the transaction completes (`SELECT ... FOR UPDATE` in SQL). No other transaction can modify the locked rows. Use when: conflicts are very likely (hot rows like account balances), the cost of rolling back is high, or you need to prevent all lost-update anomalies. Trade-off: reduces throughput significantly due to lock contention; deadlocks are possible. **Optimistic locking** reads data without locking, records the version, does work, then checks before writing: "has the version changed since I read it?" If yes, retry. Use when: conflicts are rare (most reads are never followed by a write, or concurrent writes to the same row are uncommon). Implemented with a `version` column:
```sql
UPDATE accounts SET balance = $1, version = version + 1
WHERE id = $2 AND version = $3
```
If zero rows affected, a conflict occurred — retry. Event sourcing uses optimistic locking via the `event_version` unique constraint.

---

**Q38: How would you design a distributed lock, and what are the failure modes?**
**A:** Common approaches: (1) **Redis SETNX with TTL** (`SET key value NX PX 30000`) — sets only if key doesn't exist, with a TTL to prevent permanent lock on crash. The client generates a unique value; release deletes the key only if the value matches (prevents releasing someone else's lock). (2) **Redlock** (Redis multi-master) — acquire lock on majority of N Redis masters; more resilient to node failure. (3) **etcd/ZooKeeper** — distributed consensus, stronger guarantees. Failure modes: (1) **Lock not released on crash** — TTL handles this; client reconnects after TTL expires. (2) **Clock skew** — Redis TTL relies on wall time; large clock differences can cause premature expiry. (3) **GC pause** — a JVM process pauses for 30s GC, its lock expires, another process acquires it, then the first process wakes up and assumes it still holds the lock. Solution: fencing tokens (a monotonically increasing number issued with each lock acquisition; storage systems reject writes with an old token).

---

**Q39: What are the key design considerations for a high-throughput message consumer?**
**A:** (1) **Idempotency**: the consumer must handle duplicate messages safely (at-least-once delivery means duplicates will happen). Store a processed message ID table or use database upsert. (2) **Batch processing**: processing one message at a time is slow; batch DB writes (`INSERT ... VALUES ($1,$2), ($3,$4), ...`) reduce round-trips by 10-100x. (3) **Parallelism**: partition messages by key and process each partition in a goroutine — maintains ordering within a partition while maximizing throughput. (4) **Backpressure**: if the consumer is slower than the producer, the queue grows. Signal backpressure by slowing down Acks or pausing partition consumption (`PausePartitions` in Kafka). (5) **Error handling**: don't drop messages on error. Use a dead-letter queue (DLQ) for messages that fail after N retries. (6) **Checkpointing**: commit offsets only after successful processing — not before, which would lose messages on crash. At-least-once vs at-most-once is a commit timing choice.

---

**Q40: In an LLD interview, how do you approach a design question from scratch?**
**A:** Follow a structured 5-step approach: (1) **Clarify requirements** (2-3 minutes): functional requirements ("what does it do?") and non-functional requirements ("how many users? latency target? consistency requirements?"). Don't design before you know what you're designing. (2) **Identify core entities and relationships**: draw a simple domain model on the whiteboard — the nouns in the requirements. (3) **Define interfaces first**: before implementation, define the public interface (methods, parameters, return types). This is the contract. (4) **Pick data structures and algorithms**: for each interface method, justify the data structure (why a min-heap for the scheduler, why a doubly-linked list for LRU). State time and space complexity. (5) **Handle edge cases and thread safety**: what happens at capacity? What if the input is null/empty? Is this called concurrently? Do you need a mutex? Demonstrate SDE-3 thinking by proactively discussing trade-offs, scalability, and failure modes — not just "here's code that works."

---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (Advanced LLD)

- [ ] Rate limiter algorithms (token / leaky / sliding) + thread safety
- [ ] Elevator / chess / booking: state machines first
- [ ] Concurrent designs: fine-grained locking vs actor-style
- [ ] Extensibility: new payment/notify/pricing without editing cores
- [ ] Idempotency keys on mutating APIs
- [ ] Strategy/Observer/Factory/Decorator applied deliberately

> ⭐ **IMPORTANT CONCEPT:** In advanced LLD, interviewers push concurrency + evolution — lock only shared mutable state; put interfaces on variation points.

## 🛠️ PRACTICAL
1. Implement rate limiter + LRU in 45 min each.  
2. Add a new notification channel to an existing design without modifying senders.  
3. Explain how you'd test concurrent booking of the last seat.

