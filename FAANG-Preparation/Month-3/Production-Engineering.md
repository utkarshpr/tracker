# Production Engineering — Complete Study Notes

> **Self-contained. No internet needed. Prometheus configs and query examples included.**
> Covers: Metrics → Tracing → Logging → Alerting → SLO/SLI/SLA → Incident Management

---

## Table of Contents

| # | Topic | Tools | Key Concept |
|---|-------|-------|-------------|
| 1 | [Metrics](#1-metrics) | Prometheus, Grafana | RED method, USE method, Golden Signals |
| 2 | [Tracing](#2-tracing) | Jaeger, OpenTelemetry | Trace ID, Span ID, context propagation |
| 3 | [Logging](#3-logging) | ELK Stack, Loki | Structured JSON logs, trace_id in logs |
| 4 | [Alerting](#4-alerting) | Alertmanager, PagerDuty | Alert on symptoms, not causes |
| 5 | [SLO/SLA/SLI](#5-slo--sla--sli) | — | Error budget, burn rate |
| 6 | [Incident Management](#6-incident-management) | PagerDuty, Slack | SEV1–4, blameless post-mortem |
| — | [Tool Quick Reference](#tool-quick-reference) | All tools | Side-by-side comparison |
| — | [Real-World Observability](#real-world-observability) | Netflix, Uber, Airbnb | How top companies do it |

---

## The Three Pillars of Observability

```text
Metrics:  WHAT is happening (aggregated numbers over time)
Logs:     WHY it's happening (event details, error messages)
Traces:   WHERE it's happening (request path through distributed services)

You need all three:
  Metrics alert you.
  Logs tell you what happened.
  Traces show you where the time went.
```

---

## 1. Metrics

### RED Method (for Services)

> ⭐ **IMPORTANT CONCEPT:** RED (Rate, Errors, Duration) is the default service dashboard language — any on-call should diagnose from these three before diving into causes.

| Signal | Meaning | Example |
|--------|---------|---------|
| **R**ate | Requests per second (throughput) | `rate(http_requests_total[5m])` |
| **E**rrors | % of requests that fail | `rate(http_requests_total{status=~"5.."}[5m])` |
| **D**uration | Latency (p50, p95, p99) | `histogram_quantile(0.99, ...)` |

> **💡 Key Insight:** Use RED for any service that handles requests — APIs, gRPC services, workers.

> 🌍 **Real-World:** Weaveworks (creators of Weave) coined the RED method after observing that Kubernetes microservices at companies like Monzo Bank had hundreds of services — teams needed a consistent 3-metric dashboard so any engineer could on-call any service without knowing its internals. Monzo's entire engineering organization adopted RED as their default "first look" dashboard, reducing mean time to diagnose (MTTD) from ~20 minutes to ~3 minutes because on-call engineers always know exactly where to look first.

### USE Method (for Infrastructure)

> ⭐ **IMPORTANT CONCEPT:** USE (Utilization, Saturation, Errors) diagnoses *resources* — don't apply it to app APIs; that's what RED/Golden Signals are for.

| Signal | Meaning | Example |
|--------|---------|---------|
| **U**tilization | % time the resource is busy | CPU %, disk %, NIC bandwidth % |
| **S**aturation | Work queued / waiting | Run queue length, memory pressure |
| **E**rrors | Error count | NIC errors, disk errors |

> **💡 Key Insight:** Use USE for CPUs, disks, network interfaces, memory. Not for application-level metrics.

> 🌍 **Real-World:** Netflix's infrastructure teams use USE as the basis for their capacity planning dashboards — when a new EC2 instance type is deployed, SREs look at CPU utilization (is it < 70% at peak?), saturation (is the run queue consistently > 1?), and NIC errors before certifying the fleet. During Netflix's 2021 AWS us-east-1 disruption, the USE method helped engineers quickly identify that the issue was NIC saturation (a network-level resource), not CPU or application errors, which correctly pointed them to AWS infrastructure rather than application code.

### Google's Four Golden Signals

| Signal | Description |
|--------|-------------|
| Latency | Time to serve a request (distinguish success vs error latency separately) |
| Traffic | Requests per second (or writes per second for DBs) |
| Errors | Rate of failed requests |
| Saturation | How "full" the service is — approaching capacity? |

> 🌍 **Real-World:** Google SRE pioneered the Four Golden Signals in their SRE Book (2016) based on lessons from running Search, Gmail, and YouTube. The key insight about latency is tracking error latency separately from success latency — a service that fails instantly looks "fast" if you average error + success latencies, hiding the fact that users are getting errors. Google's internal monitoring tools (Monarch) automatically separate these, and this practice has been adopted by Datadog, New Relic, and every modern APM vendor as a default dashboard template.

### Prometheus

> 🌍 **Real-World:** SoundCloud open-sourced Prometheus in 2015 after building it internally to monitor their Go microservices. The pull-based scraping model was a deliberate design choice — rather than services pushing metrics (which can overwhelm a central collector during incidents), Prometheus controls the scrape rate and can scrape degraded services more frequently during incidents. Kubernetes adopted Prometheus as its de-facto metrics standard, and now every major cloud provider (AWS CloudWatch, GCP Cloud Monitoring, Azure Monitor) supports Prometheus remote-write endpoints as a compatibility layer.

**Architecture:**
```text
Applications expose /metrics endpoint (Prometheus format)
Prometheus scrapes /metrics every 15–30 seconds
Data stored in TSDB (time-series DB) on disk
Grafana queries Prometheus for dashboards
Alertmanager receives fired alert rules from Prometheus
```

**Metric Types:**

| Type | Behavior | Use for |
|------|----------|---------|
| Counter | Only goes up | request_count_total, errors_total |
| Gauge | Goes up and down | active_connections, memory_bytes |
| Histogram | Buckets for distribution | request_duration_seconds |
| Summary | Pre-computed quantiles | Less flexible than histogram — avoid |

**Prometheus Metric Exposition (Go):**
```go
var (
    requestTotal = promauto.NewCounterVec(prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total number of HTTP requests",
    }, []string{"method", "path", "status"})

    requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
        Name:    "http_request_duration_seconds",
        Help:    "HTTP request duration",
        Buckets: prometheus.DefBuckets, // .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10
    }, []string{"method", "path"})
)
```

**Key PromQL Queries:**
```promql
# Request rate per second over 5-minute window
rate(http_requests_total[5m])

# Error rate as percentage
rate(http_requests_total{status=~"5.."}[5m])
/ rate(http_requests_total[5m]) * 100

# p99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# CPU utilization
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes * 100

# Active DB connections (postgres_exporter)
pg_stat_activity_count{state="active"}
```

**Prometheus Alert Rules:**
```yaml
groups:
  - name: service_alerts
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 5% for 5 minutes"

      - alert: HighP99Latency
        expr: |
          histogram_quantile(0.99,
            rate(http_request_duration_seconds_bucket[5m])) > 1.0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p99 latency > 1s"
```

---

## 2. Tracing

### What a Distributed Trace Is
```text
One user request → spans across multiple services:

User Request
  └─ API Gateway         [span 1, 12ms]
       └─ Order Service  [span 2, 8ms]
            ├─ Postgres  [span 3, 3ms]
            └─ Kafka     [span 4, 1ms]
       └─ Notification   [span 5, async]

Trace ID: shared by all spans — identifies the entire request.
Span ID:  unique per span — parent-child relationship tracks the call tree.
```

### OpenTelemetry (OTel) — The Standard

OTel is **vendor-neutral**. Instrument once, export to Jaeger / Zipkin / Tempo / Datadog.

**Java instrumentation:**
```java
// Auto-instrumentation: add the agent jar to JVM startup
// -javaagent:opentelemetry-javaagent.jar

// Manual span creation
Tracer tracer = GlobalOpenTelemetry.getTracer("my-service");

Span span = tracer.spanBuilder("processOrder")
    .setAttribute("order.id", orderId)
    .startSpan();
try (Scope scope = span.makeCurrent()) {
    // do work
    span.setAttribute("order.status", "processed");
} catch (Exception e) {
    span.recordException(e);
    span.setStatus(StatusCode.ERROR);
    throw e;
} finally {
    span.end();
}
```

**Context propagation (across HTTP):**
```text
Service A adds to outgoing HTTP headers:
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

Service B reads from incoming headers:
  Continues the trace (same trace ID, new span ID, parent = A's span ID)
```

### Jaeger Components
```text
Agent:     Sidecar — receives spans via UDP from the application.
Collector: Processes and stores spans.
Query:     UI for searching traces.
Storage:   Elasticsearch or Cassandra backend.
```

**What to look for in a trace:**
- Which service is slowest? (longest span)
- Are there sequential calls that could be parallel?
- N+1 pattern? (100 DB calls in a loop → should be 1 bulk query)
- Error in a downstream service?

> 🌍 **Real-World:** Uber open-sourced Jaeger in 2017 after building it to trace requests across 1,000+ microservices in their ride-hailing platform. A single `request_ride` API call at Uber generates ~50 spans across dispatch, pricing, driver-matching, ETA, and fraud services — without distributed tracing, a 500ms latency regression was nearly impossible to attribute. After deploying Jaeger, Uber's on-call engineers reduced mean time to identify the root service causing a latency spike from ~45 minutes to ~4 minutes by following the trace waterfall directly to the slow span.

---

## 3. Logging

### Structured Logging

```text
❌ Bad: log.Printf("User %s created order %d for $%f", userID, orderID, amount)
```

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "order-service",
  "trace_id": "4bf92f3577b34da6a",
  "span_id": "00f067aa0ba902b7",
  "event": "order_created",
  "user_id": "u-12345",
  "order_id": "o-98765",
  "amount_cents": 4999,
  "duration_ms": 23
}
```

> **💡 Why structured JSON:** grep-able, parseable by log aggregation tools, queryable with SQL-like syntax in ELK/Loki.

> 🌍 **Real-World:** Stripe mandates structured logging across all services — every API call emits a JSON log line with `request_id`, `user_id`, `amount_cents`, and `livemode` fields. This enabled Stripe's fraud team to write real-time Kibana queries like `event:charge.created AND amount_cents:>100000 AND livemode:true` to detect unusual large charges in seconds. When Stripe processes ~1M API requests/minute, unstructured text logs would make this kind of real-time fraud pattern detection practically impossible.

### Log Levels — When to Use

| Level | Use for | Example |
|-------|---------|---------|
| **ERROR** | Something failed requiring attention. Will page someone. | DB connection failed, payment error |
| **WARN** | Unexpected but recovered. | Retry succeeded, cache miss rate high |
| **INFO** | Normal business events, key state transitions. | Order created, user logged in |
| **DEBUG** | Developer-level details. Off in production. | Full request/response bodies, DB query params |

### ELK Stack
```text
Elasticsearch: stores and indexes logs (JSON documents)
Logstash:      ingest pipeline — parse, enrich, transform before indexing
Kibana:        visualization and querying (Lucene query syntax)

Modern alternative: Filebeat → Elasticsearch directly (skip Logstash for simple cases)

Key Kibana queries:
  level:ERROR AND service:order-service
  trace_id:"4bf92f3577b34da6a"
  event:order_created AND duration_ms:>500
```

### Log Sampling
```text
High-traffic services: logging every request is expensive.

Strategy: log 100% of errors, 1–10% of successful requests.
Use consistent sampling on trace_id so you get complete traces.

OpenTelemetry sampling config:
  ParentBased(root=TraceIdRatioBased(0.1)) → sample 10% of new traces
```

> 🌍 **Real-World:** Twitter (now X) processes ~500,000 tweets/minute — logging every request at full fidelity would generate petabytes per day and cost millions in storage. Twitter uses head-based sampling at 1% for normal traffic but switches to 100% tail-based sampling for any request that hits an error or exceeds p99 latency thresholds. This "sample errors always, sample successes rarely" strategy is also used by Datadog's APM and Honeycomb.io, where it's called "dynamic sampling" — you get complete visibility into problems without paying for visibility into routine success paths.

---

## 4. Alerting

### Good Alert Design Principles

> ⭐ **IMPORTANT CONCEPT:** Alert on user-visible symptoms (latency, errors), not causes (CPU) — every page must be actionable at 3 AM or it trains people to ignore pages.

```text
1. Alert on symptoms, not causes:
   ❌ "DB CPU > 80%"        (might not matter to users)
   ✅ "p99 latency > 1s"    (users are experiencing slowness)
   ✅ "error rate > 1%"     (users are seeing failures)

2. Every alert must be actionable:
   If the on-call can't do anything at 3 AM → don't wake them up.

3. Use "for" duration to filter transient spikes:
   Don't alert on 5-second blips. Alert on sustained problems (5–10 min).

4. Severity levels:
   Page (SEV1/SEV2):   Users impacted. Wake someone up.
   Ticket (SEV3):      Investigate in business hours.
   Dashboard only:     Informational. No action required.

5. Alert fatigue kills response quality:
   Target: < 5 pages/week per on-call. Every page must be real and actionable.
```

> 🌍 **Real-World:** PagerDuty published data showing that teams with > 20 pages/week had 3x higher on-call engineer turnover than teams with < 5 pages/week — alert fatigue is a real retention problem. Shopify's SRE team famously ran an "alert bankruptcy" process in 2022: they froze all new alerts and audited every existing one against the "actionable at 3 AM" rule, eliminating 60% of their alerts as either non-actionable noise or duplicates. Response rates to real incidents improved immediately because engineers stopped unconsciously tuning out pages.

### Alertmanager Routing
```yaml
route:
  group_by: ['alertname', 'service']
  group_wait: 30s       # wait to group related alerts
  group_interval: 5m    # how often to send grouped alerts
  repeat_interval: 4h   # re-notify if not resolved

  routes:
    - match:
        severity: critical
      receiver: pagerduty
    - match:
        severity: warning
      receiver: slack

receivers:
  - name: pagerduty
    pagerduty_configs:
      - service_key: <key>
  - name: slack
    slack_configs:
      - api_url: <webhook_url>
        channel: '#alerts'
```

---

## 5. SLO / SLA / SLI

### Definitions

| Term | Definition | Example |
|------|-----------|---------|
| **SLI** (Indicator) | The actual measurement | "Fraction of requests completed within 200ms" |
| **SLO** (Objective) | Your internal target | "99.9% of requests will complete within 200ms" |
| **SLA** (Agreement) | Contract with customers | "We guarantee 99.5% uptime; breach → 10% credit" |

> **💡 Key rule:** SLA ≤ SLO. Your SLA must be less strict than your internal target — you need a safety buffer.

### Common SLOs

| SLO Type | Formula | Example |
|----------|---------|---------|
| Availability | `(valid_requests / total_requests) × 100` | 99.9% = 8.76h downtime/year |
| Latency | Histogram quantile | "99% of requests < 200ms" |
| Error Rate | `(5xx_count / total_count) × 100` | "< 0.1% of requests return 5xx" |

**Availability levels:**
```text
99.9%  = 8.76 hours downtime/year
99.95% = 4.38 hours downtime/year
99.99% = 52.6 minutes downtime/year
```

### Error Budget

> ⭐ **IMPORTANT CONCEPT:** Error budgets turn reliability into a shared currency — burn it and freeze features; have surplus and ship riskier changes faster.

```text
If SLO = 99.9% availability:
  Error budget = 0.1% of all requests = 8.76 hours/year = 43.8 min/month

Consumed by: incidents, degraded deployments, planned maintenance

When error budget is exhausted:
  → Freeze new features
  → Focus exclusively on reliability until budget recovers

When error budget is healthy:
  → Ship faster, take more risks

"Error budget" makes reliability a shared responsibility between SRE and product.
```

> 🌍 **Real-World:** Google SRE pioneered error budgets — if a service has a 99.9% SLA, it can be "down" 8.7 hours/year. Teams spend that budget on risky deployments; if burned, all new features stop until reliability is restored. Google Search's SRE team uses error budget burn rate alerts: if the budget is being consumed 14x faster than the monthly rate, a SEV2 is automatically filed even before users notice widespread issues, giving the team time to roll back before the full budget is exhausted.

### Writing Good SLOs
```text
Format: "[X]% of [user journey] will [meet criteria] over [time window]"

Good:
  "99.5% of checkout requests will return a response in < 500ms over a 28-day window"

Bad:
  "The system will be fast"    → not measurable
  "CPU usage < 80%"            → infrastructure metric, not user-facing
```

> 🌍 **Real-World:** Spotify defines SLOs around user journeys, not service uptime — "99.5% of play button presses will begin streaming audio within 2 seconds" is their primary SLO, not "the streaming service will be 99.9% available". This matters because a service can be technically "up" (returning 200s) but still failing the user journey (audio stalls after 500ms). Spotify's "critical user journey" SLO framework was adopted from Google's CUJ approach and is now the standard way SLOs are written at Amazon, Netflix, and Airbnb.

---

## 6. Incident Management

### Incident Severity Classification

| Severity | Trigger | Response | SLA |
|----------|---------|----------|-----|
| **SEV1** | All users affected OR significant revenue impact | Page on-call + team lead + director | Acknowledged in 5 min, update every 15 min |
| **SEV2** | Partial user impact OR significant degradation | Page on-call + team lead | Acknowledged in 15 min, update every 30 min |
| **SEV3** | Minor issue, workaround exists, no revenue impact | Ticket, investigate in business hours | — |
| **SEV4** | Cosmetic or non-functional issue | Backlog item | — |

> 🌍 **Real-World:** PagerDuty's own incident management uses 4-tier severity — their SEV1 criteria includes "payment processing down" and "> 5% of customers unable to receive pages" (their core product). During their 2023 SEV1, they had a dedicated incident commander (IC) role whose sole job was running the Slack war room, communicating status updates every 15 minutes, and keeping engineers from context-switching — the IC does NOT debug the problem. Separating the IC from the technical responders is a practice adopted from the Incident Command System (ICS) used by fire departments and emergency management agencies.

### Runbooks

> 🌍 **Real-World:** Atlassian's Confluence (ironically) hosts their own runbooks, and Atlassian publishes templates from their incident management practice. Their key rule: runbooks must be executable by a new engineer at 3 AM with no context. This means runbooks include direct dashboard links, exact CLI commands to run, and decision trees ("if this, do that; else escalate to X"). Atlassian found that well-maintained runbooks reduced mean time to restore (MTTR) by 40% compared to relying on Slack tribal knowledge or finding the right person to call.

Every alert should have a runbook — a pre-written incident guide:

```text
Alert: [name]
Severity: SEV1/SEV2

What this means:
[2–3 sentences about what the metric/alert indicates]

Immediate steps:
1. Check [dashboard link]
2. Look for [specific pattern]
3. If [condition]: do [action]
4. If [other condition]: do [other action]

Escalation:
- If not resolved in 30 min: page [team lead]
- If DB involved: page [DBA on-call]

Recent incidents: [link to post-mortems]
```

### Blameless Post-Mortem Template

> ⭐ **IMPORTANT CONCEPT:** Blameless post-mortems blame systems and missing safeguards, never people — "human error" is never a root cause; ask why the system allowed the error.

> 🌍 **Real-World:** Google SRE popularized blameless post-mortems — the core principle is that failures are systemic, not personal. Before Google's approach, post-mortems often resulted in blame and engineers hiding incidents to protect their careers. Netflix took this further with their "just culture" where engineers who cause incidents are encouraged to present at internal incident reviews, because the person who broke something understands the failure mode best. Etsy (pioneers of DevOps culture) tracked that teams with blameless post-mortems shipped features 10x faster because engineers didn't fear experimentation.

```markdown
# Post-Mortem: [Service] [Date]

## Impact
- Duration: X minutes
- Users affected: N (or estimated N%)
- Revenue impact: $X (if known)

## Timeline (UTC)
| Time  | Event |
|-------|-------|
| 14:03 | Alert fires: p99 > 2s |
| 14:05 | On-call acknowledges |
| 14:12 | Recent deploy identified as suspect |
| 14:18 | Rollback initiated |
| 14:21 | Service restored |

## Root Cause
[Single technical root cause. Not a person.]

## Contributing Factors
1. [e.g., "No monitoring on connection pool usage"]
2. [e.g., "Rollback procedure not documented"]

## What Went Well
1. Alert fired within 2 minutes of degradation
2. On-call had context from recent deploys

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Add connection pool alert | Alex | 2024-11-20 |
| Write rollback runbook | Maria | 2024-11-22 |
| Load test new deploys in staging | Team | 2024-12-01 |
```

---

## Tool Quick Reference

| Tool | Role | Key Feature |
|------|------|-------------|
| **Prometheus** | Metrics collection + alerting rules | Pull-based scraping; PromQL; TSDB |
| **Grafana** | Dashboards and visualization | Multi-source; annotations for deployments |
| **Elasticsearch** | Log storage + full-text search | Lucene indexes; fast aggregations |
| **Logstash** | Ingest pipeline | Grok parsing; field enrichment |
| **Kibana** | Query and visualize logs | Lucene query syntax; dashboard builder |
| **Filebeat** | Lightweight log shipper | Tail files, ship to Elasticsearch |
| **Jaeger** | Distributed tracing backend | Trace search by service/duration/tag |
| **OpenTelemetry** | Instrumentation standard (not a backend) | Instrument once, export anywhere |

> 🌍 **Real-World:** The CNCF (Cloud Native Computing Foundation) graduated both Prometheus and Jaeger as top-level projects — meaning they're production-proven at companies like Adobe, GitLab, and Red Hat. OpenTelemetry was created when Google, Microsoft, and Lightstep merged their competing standards (OpenCensus and OpenTracing) in 2019, so engineers would stop maintaining dual instrumentation. Today, OpenTelemetry is the #2 most active CNCF project by contributors, and AWS, Azure, and GCP all natively ingest OTel data, meaning you can instrument once and ship to any cloud's managed observability service without code changes.

---

## Observability Quick Reference

| Question | Tool | How |
|----------|------|-----|
| Is the service up? | Prometheus + Grafana | Alert on error_rate > 1% for 5 min |
| Which request failed? | ELK / Loki | Search by `trace_id` in logs |
| Where did time go? | Jaeger | Longest span in trace waterfall |
| How is the DB? | pg_exporter + Prometheus | `pg_stat_activity_count` alerts |
| Is memory leaking? | Prometheus gauge | `node_memory_MemAvailable_bytes` trend |
| Are retries spiking? | Distributed trace | Span retry count attribute |
| Is cache working? | Redis exporter | `cache_hit_ratio < 70%` alert |
| Any slow queries? | PostgreSQL `pg_stat_statements` | `duration > 100ms` |

---

## Real-World Observability

| Company | Stack | Scale / Why |
|---------|-------|-------------|
| **Netflix** | Atlas (custom TSDB) + OpenTelemetry + Grafana | 2B metrics/min from 10,000+ microservices |
| **Uber** | M3 (Prometheus-compatible) + Jaeger | Jaeger open-sourced in 2017; traces across 1,000+ microservices |
| **Airbnb** | OpenTelemetry → Jaeger | Migrated from Zipkin for better UI and storage efficiency |
| **Cloudflare** | Logs every DNS query → ClickHouse | Billions of queries/day; real-time alert on p99 spike within 30s |

> 🌍 **Real-World:** Netflix built Atlas (their custom TSDB) because Graphite and early Prometheus couldn't handle their 2B metrics/minute ingestion rate at Netflix's scale. Atlas uses in-memory storage with a custom query language optimized for multi-dimensional metric aggregations, enabling engineers to ask "show me p99 latency broken down by AWS region, instance type, and API endpoint" in under 1 second across millions of time series. This level of slicing is why Netflix can detect that a latency regression only affects m5.large instances in us-west-2 within minutes of a deploy.

> 🌍 **Real-World:** Facebook uses canary deployments to ship to 1% of users first — anomaly detection on error rates and latency automatically rolls back if the canary degrades vs the baseline. Facebook's "Flyte" deployment system runs statistical significance tests comparing canary vs control cohorts on 50+ metrics simultaneously, and will auto-rollback if any key metric degrades with p < 0.05 confidence. This automated canary analysis (similar to what Netflix's Kayenta does) means engineers can ship 10x/day without a manual review step for every deploy.

**Key SLO numbers (real companies):**
```text
Google Search: 99.999% availability → 5 min downtime/year
Stripe:        99.99% API availability → 52 min downtime/year
AWS S3:        99.99% availability (SLA), 99.999999999% durability
Slack:         99.99% messaging availability
```

> 🌍 **Real-World:** AWS S3's 11 9s durability guarantee (99.999999999%) doesn't mean 11 nines uptime — it means the probability of losing a stored object is 0.000000001% per year. AWS achieves this through synchronous replication to 3 Availability Zones plus erasure coding within each AZ. The distinction between durability (data not lost) and availability (data accessible right now) is a critical SLA interview concept: S3 can be temporarily unavailable (returning 503s) while still maintaining its durability guarantee.

**Error budget mental model:**
```text
SLO = 99.9% → 43.8 min/month budget
One 1-hour incident → budget exhausted → freeze feature releases
No incidents for 2 months → spend budget faster (ship riskier features)
```

> 🌍 **Real-World:** Spotify's engineering teams use error budget burn rate as a gate on their CI/CD pipeline — if a service's error budget is > 80% consumed for the current month, pull requests to that service's critical path require additional mandatory review from the SRE team before merging. This automation (integrated into their GitHub PR check system) enforces reliability accountability without requiring SRE to manually review every deploy, and gives product teams a clear signal: "you're burning budget, slow down or invest in reliability."

---

## 7. Hands-on Prometheus / OpenTelemetry Lab Steps

> 🛠️ **PRACTICAL:** Even if you can't run full infra locally, walk these steps verbally in an interview — it proves production fluency.

### Lab 1 — Instrument RED Metrics (60–90 min)

**Goal:** Expose Rate / Errors / Duration for a sample HTTP service.

```text
1. Add Prometheus client library (Go/Java/Python — match your stack)
2. Define:
   - http_requests_total{method,path,status}     Counter
   - http_request_duration_seconds{method,path}  Histogram
3. Middleware: start timer → next handler → observe duration + inc counter with status
4. Expose GET /metrics
5. Run Prometheus with scrape config:
     scrape_interval: 15s
     static_configs: targets: ['localhost:8080']
6. PromQL checks:
     rate(http_requests_total[5m])
     rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
     histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
7. Grafana: 3-panel RED dashboard (one row = one service)
```

**Interview talking point:** "Histograms over summaries — I can compute any quantile at query time."

### Lab 2 — Alert on Symptoms (30 min)

```yaml
# Add to prometheus rules
- alert: APIHighErrorRate
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m]))
    / sum(rate(http_requests_total[5m])) > 0.01
  for: 5m
  labels: { severity: critical }
  annotations:
    summary: "Symptom: users seeing >1% 5xx"
    runbook_url: "https://wiki/runbooks/api-5xx"
```

```text
Verify:
  - Generate artificial 5xx → alert pending → firing after `for`
  - Confirm page would include dashboard + runbook links
  - Non-goal: do NOT page on CPU alone in this lab
```

### Lab 3 — OpenTelemetry Trace Path (60 min)

```text
1. Add OTel SDK or Java agent / auto-instrumentation
2. Export to Jaeger (OTLP or Jaeger exporter)
3. Propagate context on outbound HTTP (W3C traceparent)
4. Create manual span around "processOrder" with attributes order.id
5. In Jaeger UI: find trace → identify longest span → note N+1 if present
6. Correlate: put trace_id into structured logs; Kibana/Loki search by trace_id
```

**Success criteria:** One request → gateway span → service span → DB span; log line shares `trace_id`.

### Lab 4 — USE Snapshot for a Host (20 min)

```text
Pull node_exporter metrics (or verbalize):
  Utilization: CPU busy %, disk %, NIC bytes / capacity
  Saturation:   load average vs cores; queue lengths
  Errors:       NIC errs, disk errs
Narrate: "RED says API slow; USE shows disk saturation → iowait → DB host"
```

---

## 8. Write-Your-Own SLO Exercise

> ⭐ **IMPORTANT CONCEPT:** Good SLOs measure user journeys, not CPU — if it doesn't hurt a user when breached, it's not an SLO.

### Exercise Template (fill in)

```text
Service / journey: ______________________________
SLI definition:    ______________________________
SLO target:        ____ % over ____-day window
SLA (if any):      ____ % (must be ≤ SLO)
Error budget:      100% − SLO% → ____ / month in minutes or failed requests

Burn alerts:
  Fast burn (e.g., 14×): page now
  Slow burn (e.g., 2×):  ticket this week

When budget exhausted: freeze features? Y/N — policy: ____________
```

### Worked Example — Checkout API
```text
Journey:  Checkout submit → 2xx with charge intent recorded
SLI:      Proportion of checkout requests with successful response in < 500ms
SLO:      99.5% over 28 days
SLA:      99.0% (customer contract)
Budget:   0.5% of requests ≈ treat as ~3.6h equivalent "bad" minutes/month if mapped to availability-style math
          (prefer request-based budget for this SLI)

Alert:    2% of budget burned in 1 hour → page (fast burn)
Action:   Rollback last deploy; feature-flag new payment path off
```

### Three SLOs to Draft Tonight
| Journey | Candidate SLI | Candidate SLO |
|---------|---------------|---------------|
| Login | % login < 300ms success | 99.9% / 30d |
| Feed refresh | % feed reads < 200ms | 99.5% / 30d |
| Image upload | % uploads finalize < 5s | 99% / 30d |

> 🛠️ **PRACTICAL:** Bring one filled SLO card to mocks; when HLD ends early, propose SLIs/alerts for your design.

---

## 9. Sample On-Call Interview Questions + Answers

### Q1: Walk me through your first 5 minutes after a SEV1 page.
```text
Ack page → open dashboard (RED) → check error budget / blast radius →
declare severity → open incident channel → assign IC/comms/investigator if not alone →
mitigate if obvious (rollback/flag) → cadence updates every 10–15 min.
I don't start a novel root-cause essay before mitigation.
```

### Q2: Symptom vs cause alerting — example?
```text
Symptom: p99 checkout latency > 1s or 5xx > 1% (users hurt).
Cause: DB CPU > 80% (may be fine). I page on symptoms; causes are dashboard/debug clues.
```

### Q3: How do you set an SLO?
```text
Pick a user journey, define measurable SLI, set SLO tighter than SLA,
compute error budget, add burn-rate alerts, agree feature-freeze policy when empty.
```

### Q4: What belongs in a blameless postmortem?
```text
Impact, timeline, root cause (systemic), contributing factors, what went well,
action items with owners/dates. Never 'human error' as root — ask why the system allowed it.
```

### Q5: How do traces, logs, and metrics work together?
```text
Metrics page me; traces show where time went; logs give event detail.
I join them with trace_id in structured logs.
```

### Q6: Alert fatigue — what do you do?
```text
Audit pages for actionability; raise thresholds / add `for` durations;
demote to tickets; fix flappy deps; target < ~5 pages/week/on-call.
```

### Q7: Canary failed — what next?
```text
Auto or manual rollback; freeze related deploys; compare canary vs baseline metrics;
post-incident note even if short; add regression test / alert if gap found.
```

### Q8: Error budget exhausted mid-month — what happens?
```text
Reliability work prioritized over features per policy; root-cause burn sources;
restore budget before risky launches. Product and eng share the constraint.
```

### Q9: Runbook quality bar?
```text
Executable at 3 AM by a new engineer: links, commands, decision tree, escalation.
If an alert lacks a runbook, that's an action item.
```

### Q10: You mitigated with rollback but don't know root cause yet — OK?
```text
Yes — user recovery first. Keep investigation open; don't declare full resolve
until monitored stable; postmortem captures residual risk.
```

---

## Important Concepts Checklist — Production Engineering

- [ ] Three pillars: metrics / logs / traces — when each wins
- [ ] RED for services; USE for resources; Golden Signals overlap understood
- [ ] Prometheus types: counter / gauge / histogram (prefer over summary)
- [ ] Key PromQL: rate, error ratio, histogram_quantile
- [ ] Alert on symptoms; actionable; `for` duration; severity routing
- [ ] OTel context propagation (`traceparent`) + Jaeger waterfall reading
- [ ] Structured JSON logs + trace_id correlation
- [ ] SLI vs SLO vs SLA; SLA ≤ SLO
- [ ] Error budget math + burn-rate response
- [ ] SEV1–4 response expectations
- [ ] Runbook = 3 AM executable
- [ ] Blameless postmortem sections + owned actions
- [ ] Labs: RED instrumentation path, symptom alert, OTel+log correlate
- [ ] Personal SLO card drafted for one real/past service

> ⭐ **IMPORTANT CONCEPT:** Production interviews test whether you operate systems for users — SLOs, symptom alerts, and blameless learning — not whether you can recite tool logos.
