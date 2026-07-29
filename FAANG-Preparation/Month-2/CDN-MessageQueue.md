# CDN & Message Queues — Complete Study Notes

> Self-contained. No internet needed. FAANG-level depth.
> Real-world examples: Netflix, YouTube, WhatsApp, Uber, Slack, Instagram

---

## Table of Contents

| # | Topic | Key Concepts |
|---|-------|--------------|
| [1](#1-what-is-a-cdn) | What is a CDN | PoPs, edge servers, origin server |
| [2](#2-how-cdn-works) | How CDN Works | DNS routing, anycast, request flow |
| [3](#3-cdn-caching) | CDN Caching | TTL, Cache-Control, invalidation |
| [4](#4-cdn-for-different-content-types) | Content Types | Static assets, video streaming, dynamic |
| [5](#5-push-vs-pull-cdn) | Push vs Pull CDN | Tradeoffs, when to use each |
| [6](#6-cdn-security) | CDN Security | DDoS, WAF, TLS at edge |
| [7](#7-cdn-providers) | CDN Providers | CloudFront, Cloudflare, Fastly |
| [8](#8-cdn-interview-questions) | CDN Interview Q&A | Netflix CDN, image CDN design |
| [9](#9-why-message-queues) | Why Message Queues | Decoupling, async, load leveling |
| [10](#10-message-queue-patterns) | MQ Patterns | P2P, pub/sub, fan-out, competing consumers |
| [11](#11-rabbitmq-internals) | RabbitMQ Internals | Exchanges, bindings, routing, DLQ |
| [12](#12-aws-sqs) | AWS SQS | FIFO, standard, visibility timeout |
| [13](#13-apache-kafka-deeper-dive) | Kafka Deep Dive | Partition strategies, exactly-once |
| [14](#14-message-queue-vs-kafka) | MQ vs Kafka | Decision framework |
| [15](#15-ordering-exactly-once-idempotency) | Delivery Guarantees | Ordering, exactly-once, idempotency |
| [16](#16-message-queue-interview-questions) | MQ Interview Q&A | WhatsApp, notification system |

---

## PART 1 — CDN (CONTENT DELIVERY NETWORKS)

---

## 1. What is a CDN

### The Core Problem

Without a CDN, every user request goes to your single origin server. If your servers are in `us-east-1` and a user is in Tokyo, the round-trip latency is 150–200ms for every single asset. For a page with 50+ assets (images, JS, CSS), this becomes completely unusable.

```
WITHOUT CDN:
                                          ┌─────────────────────────┐
  [User in Tokyo] ──── 180ms ──────────► │  Origin Server          │
                                          │  (us-east-1, Virginia)  │
  [User in London] ─── 90ms  ──────────► │                         │
                                          │  All traffic hits here  │
  [User in Brazil] ─── 120ms ──────────► └─────────────────────────┘
                                                     ▲
                                              SINGLE POINT OF FAILURE
                                              HIGH LATENCY FOR REMOTE USERS
                                              BANDWIDTH BOTTLENECK
```

### CDN Architecture: PoPs, Edge Servers, Origin

```
WITH CDN:

  ┌────────────────────────────────────────────────────────────────────────┐
  │                        ORIGIN SERVER                                   │
  │                    (your actual infrastructure)                        │
  │                    S3, EC2, your data center                           │
  └──────────────────────────────┬─────────────────────────────────────────┘
                                  │  Cache Miss Only
         ┌────────────────────────┼───────────────────────────┐
         │                        │                           │
         ▼                        ▼                           ▼
  ┌─────────────┐          ┌─────────────┐            ┌─────────────┐
  │  PoP: Tokyo │          │  PoP: London│            │  PoP: São   │
  │             │          │             │            │  Paulo      │
  │  Edge       │          │  Edge       │            │  Edge       │
  │  Servers    │          │  Servers    │            │  Servers    │
  │  (Cache)    │          │  (Cache)    │            │  (Cache)    │
  └──────┬──────┘          └──────┬──────┘            └──────┬──────┘
         │ 5ms                    │ 8ms                       │ 7ms
         ▼                        ▼                           ▼
   [User Tokyo]            [User London]              [User Brazil]
```

### Key Terminology

| Term | Definition |
|------|------------|
| **PoP (Point of Presence)** | A physical data center location where CDN edge servers are deployed. A major CDN has 100–300+ PoPs globally. |
| **Edge Server** | A server at a PoP that caches content and serves users. Multiple edge servers at each PoP for redundancy. |
| **Origin Server** | Your actual server / storage (S3, EC2, your DC). Only contacted on cache miss. |
| **Edge Cache** | Content stored at the edge server. Typically SSD or RAM for hot content. |
| **CDN Node** | Another name for edge server. |
| **PoP Cluster** | Multiple edge servers at a single PoP, load-balanced. |

### Why CDN Matters at FAANG Scale

- **Netflix** serves ~15% of global internet traffic. Without a CDN (actually they built their own called Open Connect), they'd need exabytes of bandwidth on a single origin.
- **Cloudflare** claims to handle 2 trillion+ requests/day.
- A typical CDN offloads 80–95% of origin traffic on cache-heavy content.
- Speed matters: Google research showed a 100ms latency increase reduces conversion by 7%.

> 🌍 **Real-World:** Netflix's Open Connect CDN places custom hardware appliances directly inside ISP data centers (Comcast, AT&T, BT) — a user in London streaming a popular show is served from an appliance physically co-located at their ISP, achieving <5ms TTFB. Netflix pre-populates appliances with the top 10,000 titles during off-peak hours using a push model, so virtually no peak-hour traffic hits Netflix's AWS origin.

> **💡 Key Insight:** A CDN is not just about speed — it's about **cost reduction** (bandwidth from edge is cheaper than origin), **reliability** (if origin goes down, cached content still serves), and **security** (DDoS attacks hit the edge, not your origin).

---

## 2. How CDN Works

### Step-by-Step Request Flow

```
Request for: https://static.example.com/image.jpg

Step 1: DNS Resolution
─────────────────────
User browser → DNS resolver:
  "What is the IP of static.example.com?"

CDN's DNS (authoritative):
  "Based on your location (Tokyo), use 203.0.113.42"
  (This is the IP of the Tokyo PoP)

Step 2: TCP Connection
──────────────────────
User connects to Tokyo PoP (203.0.113.42)
~5ms latency instead of ~180ms to Virginia

Step 3: Cache Check at Edge
───────────────────────────
Edge server checks local cache:
  - Cache HIT → return content immediately (sub-10ms total)
  - Cache MISS → edge fetches from origin

Step 4: Origin Fetch (Cache Miss Path)
───────────────────────────────────────
Edge server → Origin server:
  GET /image.jpg
  Origin returns content + Cache-Control headers
  Edge stores in cache, returns to user

Step 5: Cache Storage
─────────────────────
Edge stores:
  - Content bytes
  - Cache metadata (TTL, ETag, Last-Modified)
  - Expiry time = now() + Cache-Control: max-age
```

> 🌍 **Real-World:** Akamai's CDN handles Disney+'s global launch traffic — when Disney+ launched in November 2019 and received 10 million signups in a day, Akamai's GeoDNS routed each user to the nearest of Akamai's 4,000+ PoPs. Without GeoDNS-based routing, Disney's Virginia-based origin would have been unreachable under the simultaneous global load.

### DNS-Based Routing (GeoDNS)

The CDN's DNS servers return different IP addresses based on the client's IP geolocation.

```python
# Simplified CDN DNS routing logic
def resolve_cdn_hostname(client_ip: str, hostname: str) -> str:
    client_region = geolocate(client_ip)  # e.g., "AP-NORTHEAST-1"
    
    # Find closest healthy PoP
    candidate_pops = get_pops_for_region(client_region)
    # Filter unhealthy PoPs
    healthy_pops = [p for p in candidate_pops if health_check(p)]
    
    # Return IP of closest healthy PoP by latency/proximity
    best_pop = min(healthy_pops, key=lambda p: p.latency_to(client_region))
    return best_pop.anycast_ip
```

### Anycast Routing

> 🌍 **Real-World:** Cloudflare uses anycast for 1.1.1.1 (their DNS resolver) — the same IP address is announced from all 300+ Cloudflare PoPs simultaneously. A DNS query from Tokyo and a query from São Paulo both go to `1.1.1.1`, but BGP routing directs each to their geographically closest Cloudflare PoP. When a PoP goes offline, BGP reconverges in seconds and users are rerouted to the next-nearest node with no DNS TTL delay.

Many CDNs (Cloudflare, Fastly) use **Anycast** — multiple servers share the same IP address. BGP routing automatically directs traffic to the topologically nearest server.

```
WITHOUT ANYCAST (Unicast - GeoDNS):
  client_ip → DNS lookup → "use IP 1.2.3.4 (Tokyo)"
  If Tokyo is down → DNS TTL must expire (60s+) before failover

WITH ANYCAST:
  All PoPs announce IP 1.2.3.100 via BGP
  Internet routing tables automatically route to nearest PoP
  If Tokyo is down → BGP reconverges in seconds to next nearest PoP
  No DNS TTL to wait for
```

> **💡 Key Insight:** Anycast provides faster failover than GeoDNS because it relies on BGP convergence (seconds) rather than DNS TTL expiry (minutes). Cloudflare and Fastly use anycast; CloudFront uses GeoDNS.

### Cache Hit Ratio (CHR)

```
CHR = (cache hits) / (cache hits + cache misses)

Example:
  1,000,000 requests/day
  950,000 served from edge cache
  50,000 forwarded to origin

  CHR = 950,000 / 1,000,000 = 95%

Good CDN CHR:
  Static assets (images, JS, CSS): 90–99%
  Video content (popular videos): 80–95%
  Dynamic content (API responses): 10–40%
  Personalized content: <5%
```

### Multi-Tier CDN Architecture

> 🌍 **Real-World:** Cloudflare's Tiered Cache (Origin Shield) reduces origin load for large customers like Shopify — without it, 200 edge nodes across the world would each independently fetch a cache miss from Shopify's origin. With Origin Shield, all European edge nodes first check a regional shield node in Amsterdam; only the shield node fetches from origin. Shopify reported a 60% reduction in origin requests after enabling Tiered Cache.

Large CDNs have a hierarchy to maximize cache hit rates:

```
  USER
   │
   ▼
EDGE NODE (L1 Cache) — closest to user, small cache, high hit rate for popular
   │ Miss
   ▼
REGIONAL CACHE (L2 Cache) — larger cache, covers multiple edge nodes
   │ Miss
   ▼
SHIELD / ORIGIN SHIELD (L3) — a single "shield" node per region that
   │                          aggregates all misses → reduces origin load
   ▼
ORIGIN SERVER
```

**Cloudfront Origin Shield** reduces origin load by 60–80% in practice. Instead of 50 edge nodes each fetching a cache miss from origin, only the shield node fetches it once.

---

## 3. CDN Caching

### Cache-Control Headers (The Most Important CDN Topic)

```http
# Static assets — cache aggressively
Cache-Control: public, max-age=31536000, immutable
# public = CDNs can cache this
# max-age=31536000 = 1 year TTL
# immutable = don't revalidate even if user refreshes

# HTML pages — cache but revalidate
Cache-Control: public, max-age=300, stale-while-revalidate=60
# max-age=300 = 5 minutes
# stale-while-revalidate=60 = serve stale while fetching fresh in background

# Private/personalized — don't cache on CDN
Cache-Control: private, no-store
# private = only the browser can cache
# no-store = don't persist at all

# Dynamic but shareable API response
Cache-Control: public, max-age=60, s-maxage=300
# s-maxage overrides max-age for shared caches (CDNs)
# Browser caches for 60s, CDN caches for 300s
```

### CDN-Specific Headers

```http
# Vary header — cache multiple versions based on request header
Vary: Accept-Encoding         # Cache separate versions for gzip/br/identity
Vary: Accept-Language         # Cache separate versions per language
Vary: User-Agent              # BAD PRACTICE — too many cache variants

# Surrogate-Control (Varnish/Fastly)
Surrogate-Control: max-age=3600
# CDN uses this, strips it before forwarding to browser

# Surrogate-Key / Cache-Tag (Fastly/Cloudflare)
Surrogate-Key: product-123 category-shoes
# Tag-based purging: purge all assets tagged "product-123" at once
```

> 🌍 **Real-World:** Vercel's CDN uses `Cache-Control: public, max-age=31536000, immutable` for all Next.js static assets (JS bundles, fonts, images) because their build pipeline appends a content hash to every filename (`_next/static/chunks/main-abc123.js`). When a new deploy goes out, browsers and edge nodes automatically fetch the new hashed URLs; the old URLs remain cached indefinitely in user browsers without any invalidation needed. This gives Vercel deployments instantaneous cache safety with zero purge API calls.

### TTL Strategy

```
Content Type          Recommended TTL    Reason
─────────────────     ───────────────    ──────────────────────────────────
Versioned assets      1 year             filename includes hash (main.abc123.js)
  (main.abc123.js)
Unversioned assets    5–15 minutes       risk of stale content
  (logo.png)
HTML pages            1–5 minutes        balance freshness vs performance
API responses         30s–5 minutes      depends on data volatility
Video segments (HLS)  1–10 years         immutable, filename includes content hash
Video manifest (.m3u8) 2–10 seconds      must be fresh (points to latest segments)
```

### Cache Invalidation Strategies

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

**Strategy 1: TTL Expiry (Default)**
```
Simplest approach. Content expires after TTL.
Drawback: stale content can be served until TTL expires.
Use when: occasional staleness is acceptable.
```

**Strategy 2: URL Versioning (Best for Static Assets)**
```
Old: /static/app.js         → cached forever
New: /static/app.abc123.js  → brand new URL, always fresh

Implementation:
  Webpack/Vite content hashing:
    output: { filename: '[name].[contenthash].js' }

Benefits:
  - Zero invalidation needed
  - Infinite TTL safe
  - Atomic deploys (old and new files coexist during rollout)
```

**Strategy 3: CDN Purge API (Explicit Invalidation)**
```python
# CloudFront invalidation example
import boto3

def invalidate_cloudfront(distribution_id: str, paths: list[str]):
    cf = boto3.client('cloudfront')
    response = cf.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            'Paths': {
                'Quantity': len(paths),
                'Items': paths  # e.g., ['/images/*', '/api/products/123']
            },
            'CallerReference': str(time.time())
        }
    )
    return response['Invalidation']['Id']

# Invalidate all product images after a product update
invalidate_cloudfront('E1ABCDEF123', ['/images/product-123/*'])
```

```python
# Cloudflare Cache Purge API
import httpx

def purge_cloudflare(zone_id: str, urls: list[str], api_token: str):
    r = httpx.post(
        f"https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache",
        headers={"Authorization": f"Bearer {api_token}"},
        json={"files": urls}
    )
    return r.json()
```

> 🌍 **Real-World:** The New York Times uses CloudFront's invalidation API to purge articles the moment a correction is published — a journalist submits an edit, a webhook triggers `create_invalidation(['/article/2026/05/25/story-slug'])`, and the corrected content is live at all 600+ CloudFront edge locations within 60 seconds. Without explicit invalidation, readers could see a factual error for up to 5 minutes (the article's TTL), which is unacceptable for breaking news corrections.

**Strategy 4: Cache-Tag / Surrogate-Key Purge (Fastly / Cloudflare)**
```
Tag assets with related identifiers at origin response time.
Purge all tagged assets with a single API call.

# Origin response for product page
HTTP/1.1 200 OK
Surrogate-Key: product-123 category-shoes user-456

# Later, when product-123 is updated:
POST /purge
{ "tags": ["product-123"] }
# All cached responses tagged product-123 are purged atomically
# Much faster than URL-pattern purges
```

> 🌍 **Real-World:** GitHub Pages uses Surrogate-Key (Cache-Tag) purging via Fastly — every documentation page is tagged with the repo name (`github-docs-en`). When GitHub publishes a docs update, a single `POST /purge` call with `{"tags": ["github-docs-en"]}` atomically invalidates all affected pages across all Fastly PoPs in under 150ms. Without tag-based purging, they would have to enumerate thousands of individual URLs, which would take minutes.

**Strategy 5: Stale-While-Revalidate**
```
Cache-Control: max-age=60, stale-while-revalidate=300

Timeline:
  0–60s:   Serve fresh cached content
  60–360s: Serve STALE content immediately (fast!), 
           revalidate asynchronously in background
  >360s:   Must wait for fresh content

Benefit: Never blocks user, always fast response
Risk:    User may see slightly stale data (acceptable for most content)
```

### ETag and Conditional Requests

```http
# First request
GET /logo.png
← 200 OK
← ETag: "abc123def456"
← Cache-Control: max-age=300

# After TTL expires, conditional revalidation:
GET /logo.png
→ If-None-Match: "abc123def456"

# If unchanged:
← 304 Not Modified  (no body, just headers — saves bandwidth!)

# If changed:
← 200 OK + new body + new ETag
```

---

## 4. CDN for Different Content Types

### Static Assets (JS, CSS, Images, Fonts)

```
Best practices:
  ✅ Content-hash in filename (app.[hash].js)
  ✅ Cache-Control: public, max-age=31536000, immutable
  ✅ Serve via CDN subdomain (cdn.example.com or assets.example.com)
  ✅ Enable gzip/brotli compression on edge
  ✅ HTTP/2 or HTTP/3 for multiplexing
  ✅ Use WebP/AVIF for images with fallback

Example CDN setup for images:
  Original: 2MB JPEG
  CDN edge automatically:
    - Converts to WebP (saves 30%)
    - Resizes to requested dimensions (?w=400&h=300)
    - Compresses with optimal settings
    - Serves from edge node
  Result: 200KB WebP, served in 20ms from nearby PoP
```

### Video Streaming (HLS/DASH)

> 🌍 **Real-World:** YouTube's CDN caches HLS/DASH video segments at Google's global edge nodes — for popular videos, the 2-second `.ts` segments (set with `Cache-Control: max-age=86400`) are cached at hundreds of edge locations, but the manifest (`.m3u8`) has a 2-second TTL so the player always gets the freshest quality ladder. During major live events (World Cup, Olympics), YouTube pre-warms edge caches by "proactively pushing" expected popular segments before users request them, preventing origin stampedes.

Video streaming is the most CDN-intensive workload. Netflix, YouTube, and Twitch are almost entirely CDN-served.

```
HLS (HTTP Live Streaming) Structure:
─────────────────────────────────────

Master Playlist (m3u8) — low TTL (2–5s), small file
  │
  ├── 360p variant playlist (m3u8) — low TTL
  │     ├── segment_000.ts  (2-second segment) — high TTL (immutable)
  │     ├── segment_001.ts
  │     └── segment_002.ts
  │
  ├── 720p variant playlist (m3u8) — low TTL
  │     ├── segment_000.ts
  │     └── ...
  │
  └── 1080p variant playlist (m3u8) — low TTL
        ├── segment_000.ts
        └── ...

CDN caching strategy for HLS:
  Master playlist:      Cache-Control: max-age=2
  Variant playlists:    Cache-Control: max-age=2
  TS segments:          Cache-Control: max-age=86400 (or immutable)
```

```
DASH (Dynamic Adaptive Streaming over HTTP):
─────────────────────────────────────────────
Similar to HLS but uses MPD manifest instead of m3u8.
DASH is the YouTube/Netflix standard; HLS is Apple/iOS standard.

Segment durations: 2–10 seconds (shorter = faster adaptation, more requests)
Bitrate ladder example (YouTube):
  144p:   200 Kbps
  360p:   500 Kbps
  480p:   1 Mbps
  720p:   2.5 Mbps
  1080p:  5 Mbps
  4K:     15–20 Mbps
```

### Adaptive Bitrate (ABR) and CDN

```
Client player logic (simplified):
─────────────────────────────────
1. Download master playlist
2. Measure bandwidth: current_bw = segment_size / download_time
3. Select bitrate slightly below current_bw (buffer headroom)
4. Download next segment at selected quality
5. If buffer > 20s: can go higher quality
6. If buffer < 5s: must go lower quality (rebuffering prevention)

CDN role:
  - Cache every segment at every quality level at each PoP
  - Deliver segments fast (high throughput, low TTFB)
  - Handle burst load when popular content is watched simultaneously
    (e.g., Super Bowl: millions request same segment at same time)
```

### Dynamic Content Acceleration

> 🌍 **Real-World:** Shopify uses Cloudflare Workers (edge computing) to handle dynamic storefront requests — AB test variant selection, geolocation-based currency switching, and authentication token validation all happen at the CDN edge before the request ever reaches Shopify's origin servers. This reduces p99 latency for storefront page loads from ~400ms to under 80ms by eliminating a transatlantic round-trip for logic that can be evaluated locally at the edge.

CDNs can accelerate dynamic (uncacheable) content too:

```
Techniques:
  1. TCP Connection Reuse
     CDN maintains persistent connections to your origin.
     User → Edge: new TCP+TLS handshake (edge is close, fast)
     Edge → Origin: reused persistent connection (no handshake penalty)
     Saves 100–300ms on dynamic requests.

  2. Route Optimization
     CDN uses its private backbone between PoPs.
     Traffic: User → Edge → CDN backbone → Origin shield → Origin
     CDN backbone has lower latency/packet-loss than public internet.

  3. Protocol Optimization
     CDN uses HTTP/2 or HTTP/3 (QUIC) to edge.
     Even if origin only supports HTTP/1.1.

  4. Edge Side Includes (ESI)
     Cache page fragments independently.
     
     <html>
       <esi:include src="/header"/>          ← cached 1 hour
       <p>Hello, <?= user.name ?></p>       ← dynamic, not cached
       <esi:include src="/product-list"/>    ← cached 5 minutes
     </html>

  5. Edge Computing
     Run code at the CDN edge (Cloudflare Workers, Lambda@Edge)
     Personalize cached responses without hitting origin.
```

---

## 5. Push vs Pull CDN

> 🌍 **Real-World:** Cloudflare uses a Pull CDN for the majority of its customers — when WordPress.com switched to Cloudflare, their origin servers went from handling 100% of traffic to handling only ~5% (cache misses). The first global request for each blog post fetches from WordPress's origin; every subsequent request within the TTL is served from Cloudflare's edge. WordPress.com's origin bandwidth costs dropped by over 90%.

### Pull CDN (Default / Most Common)

```
How it works:
  1. CDN edge receives user request for /image.jpg
  2. Edge checks local cache — MISS
  3. Edge fetches /image.jpg from your origin
  4. Edge caches the response
  5. Serves cached content to user and all subsequent users

Characteristics:
  ✅ Easy setup — just point your DNS to CDN
  ✅ Zero upfront work — CDN populates cache on demand
  ✅ Only popular content gets cached (natural self-pruning)
  ❌ First user after cache miss/expiry gets slow response (cold cache)
  ❌ If origin goes down, cache misses fail

Best for:
  - Most websites and applications
  - Content you can't predict access patterns for
  - When you want simple operations
  
Examples: CloudFront (default), Cloudflare, most CDNs by default
```

> 🌍 **Real-World:** Steam (Valve's gaming platform) uses a Push CDN for game patches — when a 50GB game update is released, Valve proactively pushes the delta patch files to their global CDN edge nodes before players even start downloading. On launch day of a major title, millions of simultaneous downloads are served entirely from pre-warmed edge caches; without push pre-population, the first wave of downloads would overwhelm the origin bandwidth.

### Push CDN

```
How it works:
  1. YOU explicitly upload content to CDN edge nodes
  2. CDN stores content at all (or specified) PoPs
  3. Users always get a cache hit (content pre-populated)
  4. You manage TTL and purging manually

Characteristics:
  ✅ Zero latency on first request (always cache hit)
  ✅ Works even if origin is down
  ✅ Predictable CDN behavior
  ❌ You must push ALL content before it's needed
  ❌ Storage costs — even unpopular content occupies edge storage
  ❌ Operational complexity — you manage the push pipeline
  ❌ Risk of serving stale content if you forget to re-push

Best for:
  - Software downloads (game patches, OS updates)
  - Known-in-advance large releases
  - When origin is unreliable or expensive
  - Netflix Open Connect Appliances (ISP-level CDN — pre-populated)
  
Example: FTP-push CDN providers, some enterprise CDNs
```

### Hybrid CDN (Netflix Open Connect)

```
Netflix's approach:
  - Build their own CDN (Open Connect)
  - Place hardware appliances in ISP data centers
  - During off-peak hours (night): PUSH popular content to appliances
  - During peak hours (evening): PULL model for long-tail content
  
Result:
  - ~97% of Netflix traffic served from ISP-embedded edge
  - Only ~3% hits Netflix origin
  - ISPs love it (saves their transit bandwidth costs)
  - Netflix saves massive bandwidth costs
```

> **💡 Key Insight:** Netflix doesn't just use a CDN — they *are* the CDN. By embedding appliances inside ISP networks, they eliminate the last-mile bottleneck entirely. This is called "eyeball network CDN" and it's why Netflix quality is so reliable.

---

## 6. CDN Security

### DDoS Mitigation

```
Without CDN:
  DDoS: 1 Tbps of attack traffic → Origin server gets 1 Tbps → DEAD

With CDN:
  DDoS: 1 Tbps of attack traffic → Spread across 300 PoPs globally
        Each PoP absorbs ~3 Gbps → Absorbed by edge infrastructure
        Origin never sees attack traffic

Cloudflare network capacity: 321 Tbps (as of 2024)
  - Can absorb most DDoS attacks entirely at the edge
  - Volumetric attacks (UDP floods, SYN floods): mitigated at edge
  - Application-layer attacks (HTTP floods): WAF + rate limiting at edge

Layer 3/4 DDoS (network layer):
  - SYN flood: CDN edge terminates TCP; SYN cookie validation
  - UDP amplification: CDN drops malformed/amplified UDP
  - ICMP flood: Edge drops/rate-limits ICMP

Layer 7 DDoS (application layer):
  - HTTP flood: Rate limiting by IP, ASN, or fingerprint
  - Slow loris: Edge has short timeouts for slow senders
  - CC attack (cache bypass flood): Challenge pages (CAPTCHA/JS challenge)
```

> 🌍 **Real-World:** GitHub was hit with a 1.35 Tbps DDoS attack in February 2018 — the largest DDoS ever recorded at the time, using memcached amplification. GitHub was behind Akamai's Prolexic DDoS protection; Akamai's scrubbing centers absorbed the attack at the network edge and null-routed malicious traffic within 10 minutes. GitHub's origin servers never saw the attack traffic; the only impact was ~10 minutes of intermittent connectivity while Akamai's systems converged.

### Web Application Firewall (WAF) at Edge

```
Cloudflare WAF example rules:
─────────────────────────────
Rule: Block SQL Injection
  Pattern: if request contains "' OR 1=1" → block (HTTP 403)

Rule: Block XSS
  Pattern: if request contains "<script>" in params → block

Rule: OWASP Core Rule Set
  Pre-built ruleset for Top 10 vulnerabilities

Custom rules (pseudo-code):
  IF country IN ["CN", "RU"] AND path == "/admin" → BLOCK
  IF user_agent == "sqlmap" → BLOCK
  IF requests_per_minute > 1000 FROM same IP → CHALLENGE
  IF request.body CONTAINS "UNION SELECT" → BLOCK

Benefit: WAF runs at edge, malicious traffic never reaches your origin.
Cost: WAF rules can produce false positives — need tuning.
```

> 🌍 **Real-World:** Cloudflare's WAF protects Canva from SQL injection and credential stuffing attacks — Canva's login endpoint was receiving 50,000 brute-force login attempts per hour from botnets. Cloudflare's WAF rate-limiting rules (`IF requests > 20/min from same IP to /login → challenge`) absorbed the attack at the edge. Zero malicious requests reached Canva's origin Django servers, and legitimate users experienced no degradation.

### TLS Termination at Edge

```
Traditional TLS:
  Client ←──── TLS ────────────────────────────────► Origin
  (full TLS path is 180ms to origin)

CDN TLS Termination:
  Client ←── TLS ──► Edge (5ms)  →  Origin (plain or TLS on private net)
  
Benefits:
  1. TLS handshake is fast (client to nearby edge, not far origin)
  2. Edge handles certificate management (auto-renewal via Let's Encrypt)
  3. Edge can negotiate TLS 1.3 even if origin only supports TLS 1.2
  4. DDoS layer: TLS exhaustion attacks hit edge, not origin

Certificate modes (CloudFront):
  - Default CloudFront cert (*.cloudfront.net)
  - Custom domain + ACM cert (AWS Certificate Manager — free, auto-renews)
  - Bring your own certificate

Full vs Flexible SSL (Cloudflare):
  Flexible:  Browser→Edge: HTTPS | Edge→Origin: HTTP  (BAD, avoid!)
  Full:      Browser→Edge: HTTPS | Edge→Origin: HTTPS (self-signed OK)
  Strict:    Browser→Edge: HTTPS | Edge→Origin: HTTPS (valid cert required)
```

> 🌍 **Real-World:** Cloudflare terminates TLS for millions of websites — when a user connects to a site protected by Cloudflare, the TLS handshake happens at a Cloudflare edge node 10ms away, not at the origin potentially 200ms away. Cloudflare then opens a separate TLS connection (or reuses a persistent one) to the origin over their private backbone. For high-traffic sites like Cloudflare's own `1.1.1.1`, this reduces handshake time by 95% for global users and allows Cloudflare to enforce TLS 1.3 even if the customer's origin only supports TLS 1.2.

### Bot Management

```
CDN-level bot detection layers:
  1. IP Reputation — known bad IPs from threat intelligence feeds
  2. ASN blocking — block entire ISPs/cloud providers if suspicious
  3. TLS fingerprinting — identify bot clients by TLS handshake patterns
  4. HTTP/2 fingerprinting — browsers have distinct HTTP/2 stream behavior
  5. Challenge pages — JS challenge (invisible), CAPTCHA (visible)
  6. Behavioral analysis — request patterns, timing, mouse movements
  
Cloudflare Bot Score:
  0 = definitely bot
  100 = definitely human
  < 30: challenge or block
  30–70: analyze further
  > 70: allow
```

---

## 7. CDN Providers

### CloudFront (AWS)

```
Architecture:
  - 600+ PoPs in 90+ cities, 47+ countries
  - Uses GeoDNS (not anycast)
  - Tight AWS integration

Key Features:
  ✅ Lambda@Edge — run Node.js at edge for request/response manipulation
  ✅ CloudFront Functions — lighter, faster JS (sub-millisecond, cheaper)
  ✅ Origin Shield — extra caching layer to protect origin
  ✅ Field-Level Encryption — encrypt specific fields at edge
  ✅ Signed URLs/Cookies — protect private content (S3 + CF)
  ✅ Real-Time Logs to Kinesis
  ✅ Free TLS via ACM

Pricing:
  - Pay per GB transferred out + per HTTP request
  - First 1TB/month: $0.0085/GB (US/Europe)
  - No minimum commitment

Best for:
  - AWS-native stacks
  - Complex edge logic via Lambda@Edge
  - S3 static sites
  - Signed/protected content delivery

Limitations:
  - GeoDNS = slower failover than anycast
  - More complex to configure than Cloudflare
  - Lambda@Edge cold starts (though CloudFront Functions are warm)
```

### Cloudflare

```
Architecture:
  - 300+ cities, 100+ countries
  - Anycast routing
  - Acts as reverse proxy (all traffic passes through Cloudflare)
  - Also a DNS provider (1.1.1.1) and DDoS protection company

Key Features:
  ✅ Anycast = fastest failover
  ✅ 321 Tbps DDoS capacity (largest in industry)
  ✅ Free plan with generous limits
  ✅ Cloudflare Workers — V8 isolates, cold start ~0ms
  ✅ Workers KV — globally replicated key-value store at edge
  ✅ R2 Storage — S3-compatible, no egress fees
  ✅ Page Rules — URL-based routing/caching rules
  ✅ Cache Rules (new UI)
  ✅ Automatic HTTPS rewrites
  ✅ HTTP/3 (QUIC) support
  ✅ Bot management built-in (free tier: basic)
  ✅ Email routing, Zero Trust, Tunnel

Pricing:
  - Free tier: very generous (unlimited bandwidth)
  - Pro: $20/month (WAF included)
  - Business: $200/month
  - Enterprise: custom

Best for:
  - Security-first deployments
  - High DDoS risk applications
  - Small to large websites
  - Edge computing (Workers)
  - Free tier use cases

Limitations:
  - You're behind Cloudflare's IP; origin IP must be hidden
  - Orange cloud mode = all traffic proxied (good for security, different for some apps)
  - Less AWS integration than CloudFront
```

### Fastly

```
Architecture:
  - 60+ PoPs globally (fewer than Cloudflare/CloudFront but very fast)
  - Anycast routing
  - VCL (Varnish Configuration Language) for full cache control
  - Real-time purging (<150ms globally)

Key Features:
  ✅ Surrogate-Key (Cache-Tag) purging — purge millions of objects instantly
  ✅ Instant purge: <150ms global propagation (fastest in industry)
  ✅ VCL — full programmability of cache behavior
  ✅ Compute@Edge — WebAssembly-based edge computing
  ✅ Real-time analytics (per-second visibility)
  ✅ Image Optimizer built-in
  ✅ TLS + HTTP/3

Pricing:
  - Pay per traffic (~$0.12/GB)
  - More expensive than CloudFront for high volume

Best for:
  - Publishers/media companies (NYT, GitHub, BuzzFeed use Fastly)
  - Complex caching logic (VCL is very powerful)
  - When instant cache purge is critical (news sites, e-commerce flash sales)
  - API acceleration

Limitations:
  - Fewer PoPs than Cloudflare/CloudFront
  - VCL has a learning curve
  - More expensive at scale
```

### Quick Comparison

```
Feature                CloudFront    Cloudflare    Fastly
──────────────────     ───────────   ──────────    ──────
PoPs                   600+          300+          60+
Routing                GeoDNS        Anycast       Anycast
Cache Purge Speed      ~1–2 min      ~1–2 min      <150ms
DDoS Capacity          High          321 Tbps      High
Edge Compute           Lambda@Edge   Workers       Compute@Edge
Free Tier              No            Yes (generous) No
AWS Integration        Excellent     Good          Good
Cache Control          Good          Good          Excellent (VCL)
Real-time Analytics    Yes           Yes           Yes (per-second)
Price (high volume)    Low           Medium        Higher
Best For               AWS-native    Security/DDoS Publishers/API
```

> **💡 Key Insight:** CloudFront if you're AWS-native. Cloudflare if security/DDoS is paramount or you want a free tier. Fastly if you need instant purge and complex caching logic (especially for media/publishing). Many large companies use 2–3 CDNs simultaneously (multi-CDN) for redundancy and performance.

---

## 8. CDN Interview Questions

### Q1: "Design the CDN architecture Netflix uses to deliver video globally."

**Answer Framework:**

```
Key requirements:
  - 200+ million subscribers, 190+ countries
  - 15% of global internet traffic
  - Peak: hundreds of Tbps
  - 99.99% availability
  - Sub-2s start time for video playback

Netflix's Actual Solution — Open Connect:
────────────────────────────────────────

Tier 1: OCA (Open Connect Appliances) at ISPs
  - Hardware: Custom-built servers, 100–500TB SSD
  - Location: Inside ISP data centers (co-located)
  - Count: 1000s of OCAs in 1000+ locations
  - Content: Top 10,000 most-watched titles (90%+ of traffic)
  - Population: Off-peak hours, BGP anycast routing to nearest OCA

Tier 2: Open Connect CDN PoPs (OC CDN)
  - Netflix-owned data centers in major exchange points
  - Handles content not on ISP-level OCAs
  - ~10% of traffic

Tier 3: Origin (AWS)
  - S3 for transcoded video storage
  - Netflix-internal backend
  - <3% of traffic hits origin

Flow for a user watching a new release:
  1. Client app fetches user data from AWS (playback API)
  2. Playback service returns: OCA URLs for nearest 3–5 appliances
  3. Client downloads master playlist from nearest OCA
  4. Client starts downloading segments from nearest OCA
  5. If OCA doesn't have content (new release): fetches from OC CDN → origin
  6. Adaptive bitrate: switches quality based on measured bandwidth

Why this works:
  - 97% of traffic served from ISP-embedded hardware
  - ISPs benefit: less transit bandwidth cost
  - Netflix benefits: lowest possible latency, highest quality
  - Fault tolerance: multiple OCAs per region
```

```
CDN Architecture Diagram for Netflix-style:
────────────────────────────────────────────

┌────────────────────────────────────────────────────────┐
│                  AWS ORIGIN (3% traffic)               │
│   S3 (video storage) + EC2 (transcoding pipeline)      │
└──────────────────────────┬─────────────────────────────┘
                           │ (cache miss only)
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
    │  OC CDN PoP  │  │  OC CDN PoP │  │  OC CDN PoP │
    │  New York    │  │  London     │  │  Tokyo      │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
    ┌──────▼───────────────────────────────────────┐
    │  ISP Level OCAs (97% of traffic)             │
    │                                              │
    │  [Comcast OCA]  [AT&T OCA]  [Verizon OCA]   │
    │  [BT OCA]       [Vodafone OCA]               │
    │  [NTT OCA]      [Softbank OCA]               │
    └──────────────────┬───────────────────────────┘
                       │ <5ms
              [End User Device]
```

---

### Q2: "Design an image CDN that can resize, convert, and cache images on-demand."

**Answer:**

```
System Requirements:
  - Store original high-res images
  - Serve images in any requested size and format
  - Cache transformed images at edge
  - Support 1B+ images, 100K requests/second

URL Structure:
  https://images.example.com/{image_id}?w=400&h=300&fmt=webp&q=85

Architecture:
───────────────

        User Request: /product/abc123?w=400&h=300&fmt=webp
                │
                ▼
      ┌──────────────────┐
      │   CDN Edge Node  │
      │   Cache lookup   │
      │   key: URL hash  │
      └────────┬─────────┘
               │
        ┌──────┴──────┐
        │             │
      HIT             MISS
        │             │
        ▼             ▼
   Return cached   ┌──────────────────────┐
   image           │  Image Processing    │
                   │  Service             │
                   │  (Edge or Origin)    │
                   │                      │
                   │  1. Fetch original   │
                   │     from S3          │
                   │  2. Resize to 400x300│
                   │  3. Convert to WebP  │
                   │  4. Compress q=85    │
                   │  5. Return + cache   │
                   └──────────────────────┘

Options for image processing:
  1. Lambda@Edge (CloudFront):
     - Run resizing logic at CDN edge
     - Libraries: Sharp (Node.js), Pillow (Python)
     - Pro: Runs at edge, very fast
     - Con: Lambda cold starts, size limits

  2. Dedicated Image Service (Imgix, Cloudinary pattern):
     - Centralized service, cached by CDN in front
     - Pro: Rich feature set, easier to manage
     - Con: Centralized origin = latency for uncached requests

  3. Edge Workers (Cloudflare Workers + R2):
     - Workers process and resize images
     - R2 stores originals (no egress fees)
     - Worker transforms and returns; CF caches result

Storage layer:
  - Original images: S3/R2 (object storage)
  - Cache key: SHA256(image_id + params) for CDN caching
  - Always cache processed variants with 1-year TTL (immutable content-hash URL)

Cache key design:
  bad:  /product/abc123?w=400&h=300&fmt=webp&q=85&_=1234567890
        (cache buster in URL = never cached!)
  good: /product/abc123/w400-h300-webp-q85.webp
        (canonical URL, always cacheable)
```

---

### Q3: "How does a CDN handle a cache stampede (thundering herd problem)?"

```
Problem: Cache entry for /homepage expires.
         1000 requests arrive simultaneously.
         All 1000 go to origin (thundering herd).

Solutions:

1. Request Coalescing (Request Collapsing):
   - CDN holds all waiting requests at edge
   - Sends ONE request to origin
   - Fans out origin response to all waiting clients
   - Default behavior in Varnish/Fastly
   - Cloudflare: enabled with "Shield" feature

2. Stale-While-Revalidate:
   - After TTL expires, serve stale content immediately
   - Kick off ONE background revalidation request
   - All users get fast stale response, origin gets 1 request

3. Probabilistic Early Expiration (XFetch algorithm):
   - Don't wait until TTL=0 to revalidate
   - As TTL approaches 0, probabilistically pre-fetch
   - Formula: revalidate if (expiry - now) < beta * delta * ln(random())
   - Prevents exact-TTL stampede

4. Distributed Locking at Origin:
   - Application-level mutex: only 1 thread/process fetches
   - Others wait and use stale cache
```

---

## PART 2 — MESSAGE QUEUES

---

## 9. Why Message Queues

> 🌍 **Real-World:** Amazon's order processing pipeline uses SQS to decouple services — when a customer places an order, the Order Service writes to an SQS queue and immediately returns a "201 Created" to the user. The Email Service, Inventory Service, and Fraud Detection Service each independently consume from the queue at their own pace. On Prime Day (Amazon's peak traffic event), the queue depth grows to tens of millions of messages, but no service crashes because each processes at its own sustainable throughput.

### The Problem Without Message Queues

```
TIGHT COUPLING (Without MQ):
──────────────────────────────

  User places order
       │
       ▼
  ┌─────────────┐
  │ Order Service│──synchronously calls──►│Email Service│
  │             │──synchronously calls──►│Inventory   │
  │             │──synchronously calls──►│Payment     │
  │             │──synchronously calls──►│Analytics   │
  └─────────────┘

Problems:
  1. If Email Service is down → entire order fails
  2. If Inventory is slow → user waits 3+ seconds
  3. Peak load: Black Friday 100x orders → all downstream services overwhelmed
  4. Adding a new service (e.g., Loyalty Points) requires changing Order Service
  5. Distributed transaction complexity
```

```
WITH MESSAGE QUEUE:
──────────────────

  User places order
       │
       ▼
  ┌─────────────┐        ┌──────────────────────────────┐
  │ Order Service│──────►│     Message Queue            │
  │             │        │  {order_placed: order_id:123}│
  │  Returns    │        └────────────────┬─────────────┘
  │  "OK" fast  │                         │
  └─────────────┘                         │ (async)
                           ┌──────────────┼──────────────┐
                           │              │              │
                    ┌──────▼──────┐ ┌─────▼────┐ ┌──────▼──────┐
                    │Email Service│ │Inventory │ │Analytics   │
                    │  (consumes  │ │ (consumes│ │ (consumes  │
                    │  when ready)│ │ when ready│ │ when ready)│
                    └─────────────┘ └──────────┘ └────────────┘

Benefits:
  1. Order Service doesn't know/care about downstream services
  2. Email Service down? Messages accumulate, processed when it recovers
  3. Peak load absorbed by queue (queue depth grows, not failures)
  4. Add Loyalty Points service: subscribe to queue, zero changes to Order Service
  5. Retry logic handled by queue infrastructure
```

### Three Core Benefits

```
1. DECOUPLING:
   Producer and consumer don't need to know about each other.
   Producer just writes to queue. Consumer reads when ready.
   Services can be deployed, restarted, and scaled independently.

2. ASYNC PROCESSING:
   Order placed → immediate "OK" to user (fast response)
   Email, inventory, analytics processed asynchronously
   Improves perceived latency dramatically

   Without MQ: Order processing = 2s (sum of all sync calls)
   With MQ:    Order processing = 50ms (just DB write + enqueue)

3. LOAD LEVELING:
   Traffic spikes absorbed by queue depth.
   
   Without MQ:
     Black Friday spike: 1000x normal → all services get 1000x load → crash

   With MQ:
     Black Friday spike: 1000x normal → queue depth grows to 10M messages
     Email service processes at steady 1000/sec (not 1000x spike)
     All messages processed within hours, no service crash

   ┌─────────────────────────────────────────────────────┐
   │ Traffic Pattern Without MQ:  ████████             │
   │                              ████████             │
   │                         ███████████               │
   │                    ████████████████               │
   │ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁███████████████████▁▁▁▁▁▁▁▁▁▁▁   │
   │                 SPIKE → CRASH                      │
   │                                                    │
   │ Traffic Pattern With MQ:                           │
   │                        ←  queue fills  →          │
   │ ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁████████████████████████████████  │
   │                         STEADY PROCESSING          │
   └─────────────────────────────────────────────────────┘
```

---

## 10. Message Queue Patterns

### Pattern 1: Point-to-Point (P2P / Work Queue)

> 🌍 **Real-World:** Dropbox uses a P2P work queue for file thumbnail generation — when a user uploads a file, a message is enqueued with the file's metadata. A pool of 50 thumbnail worker processes competes for messages; each worker renders thumbnails for one file at a time and deletes the message on success. Horizontal scaling is trivial: during upload spikes, Dropbox auto-scales the worker pool from 50 to 500 instances, processing the queue backlog within minutes.

```
Producer ──► [Queue] ──► Single Consumer

Or with competing consumers:
             ┌──► Consumer A (processes ~50%)
Producer ──► [Queue] ──┤
             └──► Consumer B (processes ~50%)

Rules:
  - Each message is delivered to EXACTLY ONE consumer
  - Consumers compete for messages (load balancing)
  - Message is deleted after acknowledgment

Use cases:
  - Task distribution (image processing jobs)
  - Work queue for CPU-intensive tasks
  - Load balancing across worker instances

ASCII Diagram:
─────────────
[P] ──► ┌─────────────────┐
        │  Q: [m1][m2][m3] │──► [C1] processes m1, m3
        └─────────────────┘──► [C2] processes m2
```

### Pattern 2: Publish/Subscribe (Pub/Sub)

> 🌍 **Real-World:** Uber uses Kafka pub/sub for driver location updates — the Driver app publishes a `DriverLocationUpdated` event every 4 seconds to a Kafka topic. Multiple consumer services subscribe simultaneously: the ETA Calculation Service recalculates arrival times, the Map Display Service updates the rider's app with the driver's pin, and the Surge Pricing Service adjusts prices based on supply density — all consuming the same stream independently and processing at their own pace.

```
Publisher ──► [Topic] ──► Subscriber 1
                     ──► Subscriber 2
                     ──► Subscriber 3

Rules:
  - Each message is delivered to ALL subscribers
  - Subscribers don't compete — each gets their own copy
  - Topic is the named channel

Use cases:
  - Event broadcast (order_placed → email + inventory + analytics)
  - Feed updates (user posts → all followers get notification)
  - Configuration changes (update all service instances)

ASCII Diagram:
─────────────
            ┌──────────────────────┐
            │  Topic: order_placed  │
[Publisher] │                       │──► [Email Subscriber]
   order    │  m1: {order_id: 123}  │──► [Inventory Subscriber]
   placed ──►  m2: {order_id: 456}  │──► [Analytics Subscriber]
            └──────────────────────┘
              Each subscriber gets copies of m1, m2
```

### Pattern 3: Fan-Out

> 🌍 **Real-World:** Instagram uses an SNS+SQS fan-out pattern for post notifications — when a celebrity posts a photo, a single `PostCreated` SNS message is published, which fans out to separate SQS queues: one for the Push Notification Service, one for the Feed Generation Service, and one for the Search Indexing Service. Each queue has its own consumer pool that scales independently; the Push Notification workers can be at capacity (throttled by APNs limits) while Feed Generation continues at full speed.

```
Message broadcast to multiple queues, each with independent consumers.

           ┌──► Queue A ──► [Consumer Group A] (email workers)
[Exchange] ──► Queue B ──► [Consumer Group B] (inventory workers)
           └──► Queue C ──► [Consumer Group C] (analytics workers)

Fan-out = Pub/Sub where each subscription has its own queue.
Each consumer group processes independently and at its own pace.

Use case: Order processing where email team and inventory team each have
their own consumer pool and can fail/retry independently.
```

### Pattern 4: Competing Consumers

```
Multiple consumers read from the same queue.
Each message goes to exactly one consumer.
Natural load distribution.

Producer ──► [Queue: 1000 messages] ──► Consumer 1 (processes 250)
                                    ──► Consumer 2 (processes 250)
                                    ──► Consumer 3 (processes 250)
                                    ──► Consumer 4 (processes 250)

Benefits:
  - Horizontal scaling: add more consumers = higher throughput
  - Fault tolerance: if Consumer 2 dies, messages requeued to others
  - Natural load balancing

Key requirement: Messages must be idempotent or consumers must be careful
about processing state when a consumer fails mid-processing.
```

### Pattern 5: Dead Letter Queue (DLQ)

> 🌍 **Real-World:** Twilio uses DLQs for failed SMS delivery webhook callbacks — when a carrier reports an undeliverable SMS, a `DeliveryFailed` event is published to a processing queue. If the customer's webhook endpoint returns 5xx errors 3 times, the message is moved to a DLQ. An on-call engineer receives a PagerDuty alert, inspects the DLQ message (which contains the full HTTP response from the customer's server), identifies the bug, and replays the DLQ messages after the customer fixes their endpoint. Without a DLQ, those delivery failure notifications would be permanently lost.

```
Messages that can't be processed go to a DLQ for inspection.

  ┌───────────────────────────────────────────────────┐
  │                                                   │
  │  Normal Queue                                     │
  │  ┌─────────────────────────────────────────┐     │
  │  │ [m1] [m2] [m3] [m4-POISON] [m5] ...    │     │
  │  └──────────────────┬──────────────────────┘     │
  │                     │                             │
  │                  [Consumer]                       │
  │                     │                             │
  │              fails 3 times on m4                 │
  │                     │                             │
  │                     ▼                             │
  │             Dead Letter Queue                     │
  │             ┌──────────────────┐                 │
  │             │  [m4-POISON]     │                 │
  │             └──────────────────┘                 │
  │              (alert + manual inspect)             │
  └───────────────────────────────────────────────────┘

DLQ holds:
  - Malformed messages (deseralization failures)
  - Messages consumer keeps failing on (bug in consumer)
  - Messages expired beyond visibility timeout N times

Operations response to DLQ:
  1. Alert fires when DLQ depth > threshold
  2. Engineer inspects message format
  3. Fix bug, replay messages from DLQ back to main queue
  4. Or discard if truly corrupted
```

### Pattern 6: Request-Reply (RPC over MQ)

```
Used for synchronous request-response patterns over async infrastructure.

Client ──► [Request Queue] ──► Server
        ◄── [Reply Queue] ◄─── (sends response to reply queue)

Implementation:
  Client generates correlation_id = UUID
  Client sends: {correlation_id: "abc", reply_to: "reply-queue-xyz", payload: ...}
  Client polls reply-queue-xyz for message where correlation_id == "abc"

Use case: Microservice communication where you want:
  - Request-response semantics
  - But with queue durability and load balancing benefits
  
RabbitMQ RPC pattern is the classic example.
```

---

## 11. RabbitMQ Internals

### Core Architecture

```
                          RabbitMQ Broker
  ┌────────────────────────────────────────────────────────────────┐
  │                                                                │
  │  Producer                                                      │
  │  ┌──────────┐   AMQP     ┌──────────────────────────────────┐ │
  │  │          │──publish──►│          Exchange                 │ │
  │  │ Producer │            │  (routes messages to queues)      │ │
  │  │          │            └───────────────┬──────────────────┘ │
  │  └──────────┘                            │                     │
  │                                  Binding Rules                 │
  │                         ┌─────────────────────────────┐       │
  │                         │        │         │           │       │
  │                    ┌────▼──┐ ┌───▼───┐ ┌──▼────┐      │       │
  │                    │Queue A│ │Queue B│ │Queue C│      │       │
  │                    └───┬───┘ └───┬───┘ └───┬───┘      │       │
  │                        │         │          │           │       │
  │  Consumers             │         │          │           │       │
  │  ┌──────────┐          │         │          │           │       │
  │  │Consumer 1│◄─────────┘         │          │           │       │
  │  └──────────┘                    │          │           │       │
  │  ┌──────────┐                    │          │           │       │
  │  │Consumer 2│◄───────────────────┘          │           │       │
  │  └──────────┘                               │           │       │
  │  ┌──────────┐                               │           │       │
  │  │Consumer 3│◄──────────────────────────────┘           │       │
  │  └──────────┘                                           │       │
  └────────────────────────────────────────────────────────────────┘
```

> 🌍 **Real-World:** Zalando uses RabbitMQ with a topic exchange for their order event routing — messages with routing key `order.de.shipped` go to the German fulfillment queue, `order.*.shipped` matches all countries for their global analytics consumer, and `order.#` matches every order event for their audit logging service. This topic routing pattern allows them to add a new regional fulfillment queue (e.g., `order.pl.*` for Poland) without changing any producer code.

### Exchange Types

| Exchange Type | Routing Logic | Use Case |
|---------------|---------------|----------|
| **Direct** | Exact match on routing key | Order routing by status (paid, shipped, cancelled) |
| **Topic** | Pattern match on routing key (*.*.shipped, order.#) | Multi-level routing by event type |
| **Fanout** | Send to ALL bound queues (ignores routing key) | Broadcast (chat messages, cache invalidation) |
| **Headers** | Match on message header attributes | Complex conditional routing |
| **Default (nameless)** | Route to queue with same name as routing key | Simple P2P |

### Exchange Routing in Detail

```python
# Direct Exchange Example
import pika

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()

# Declare a direct exchange
channel.exchange_declare(exchange='order_events', exchange_type='direct')

# Declare queues
channel.queue_declare(queue='orders_paid', durable=True)
channel.queue_declare(queue='orders_shipped', durable=True)
channel.queue_declare(queue='orders_cancelled', durable=True)

# Bind queues with routing keys
channel.queue_bind(exchange='order_events', queue='orders_paid',    routing_key='paid')
channel.queue_bind(exchange='order_events', queue='orders_shipped', routing_key='shipped')
channel.queue_bind(exchange='order_events', queue='orders_cancelled', routing_key='cancelled')

# Publish order paid event → goes ONLY to orders_paid queue
channel.basic_publish(
    exchange='order_events',
    routing_key='paid',
    body=b'{"order_id": 123, "amount": 99.99}',
    properties=pika.BasicProperties(delivery_mode=2)  # 2 = persistent
)
```

```python
# Topic Exchange Example
# Routing key format: <category>.<region>.<event>

channel.exchange_declare(exchange='audit_log', exchange_type='topic')

# Queue for ALL US events
channel.queue_bind(exchange='audit_log', queue='us_events', routing_key='*.us.*')

# Queue for ALL payment events globally
channel.queue_bind(exchange='audit_log', queue='payment_events', routing_key='payment.#')

# Queue for EVERYTHING
channel.queue_bind(exchange='audit_log', queue='all_events', routing_key='#')

# Message: routing_key='payment.us.charged'
# → Goes to: us_events, payment_events, all_events (all three match!)
channel.basic_publish(
    exchange='audit_log',
    routing_key='payment.us.charged',
    body=b'{"user_id": 456, "amount": 50.00}'
)
```

### Queue Properties

```python
channel.queue_declare(
    queue='critical_orders',
    durable=True,         # Survive broker restart (queue persists on disk)
    exclusive=False,      # Allow multiple consumers
    auto_delete=False,    # Don't delete when last consumer disconnects
    arguments={
        'x-message-ttl': 3600000,        # Per-queue message TTL: 1 hour
        'x-dead-letter-exchange': 'dlx', # DLQ: dead messages → 'dlx' exchange
        'x-max-length': 100000,          # Max queue depth (drop or DLQ after)
        'x-max-priority': 10,            # Priority queue (0-10)
        'x-queue-mode': 'lazy'           # Lazy queue: store msgs on disk, not RAM
    }
)
```

### Consumer Acknowledgments

```python
def process_order(channel, method, properties, body):
    try:
        order = json.loads(body)
        
        # Do the work
        process_payment(order)
        send_confirmation_email(order)
        
        # Acknowledge: tell RabbitMQ to delete the message
        channel.basic_ack(delivery_tag=method.delivery_tag)
        
    except TemporaryError as e:
        # Requeue: message goes back to front of queue
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        
    except PermanentError as e:
        # Reject without requeue: message goes to DLQ
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        log_error(e)

# Prefetch: limit in-flight messages per consumer (prevents memory overflow)
channel.basic_qos(prefetch_count=10)  # Process max 10 messages concurrently
channel.basic_consume(queue='critical_orders', on_message_callback=process_order)
```

> 🌍 **Real-World:** ClassPass uses RabbitMQ consumer acknowledgments to handle credit card charge processing — each charge message is fetched with `prefetch_count=1` so a worker only holds one charge at a time. If the Stripe API times out (a `TemporaryError`), the message is `nack`ed with `requeue=True` and retried by another worker. If the card is permanently declined (a `PermanentError`), the message is `nack`ed with `requeue=False` and routed to the DLQ, where the billing team manually inspects failed charges and emails customers.

### Dead Letter Queue (DLQ) Setup

```python
# Step 1: Create DLX (Dead Letter Exchange) and DLQ
channel.exchange_declare(exchange='dlx', exchange_type='direct')
channel.queue_declare(queue='dead_letter_queue', durable=True)
channel.queue_bind(exchange='dlx', queue='dead_letter_queue', routing_key='dead')

# Step 2: Main queue with DLQ config
channel.queue_declare(
    queue='main_queue',
    durable=True,
    arguments={
        'x-dead-letter-exchange': 'dlx',
        'x-dead-letter-routing-key': 'dead',
        'x-message-ttl': 300000,  # Message expires after 5 min → goes to DLQ
    }
)

# When a message:
#   1. Is nacked with requeue=False → goes to DLX
#   2. Expires (x-message-ttl) → goes to DLX
#   3. Queue is full (x-max-length exceeded) → goes to DLX
# → DLX routes it to dead_letter_queue
```

### RabbitMQ Clustering and HA

> 🌍 **Real-World:** WeWork uses RabbitMQ Quorum Queues for their access control system — door unlock commands are critical messages that cannot be lost if a RabbitMQ node goes offline. With Quorum Queues across 3 nodes, a door unlock command is committed to the Raft log on at least 2 nodes before acknowledgment. When a node crashed during a maintenance window, the remaining 2 nodes formed a quorum and continued processing unlock commands without any message loss — the previous mirrored queue setup had caused brief periods of inaccessible offices during leader election.

```
Single Node:
  [Producer] → [RabbitMQ Node 1] → [Consumer]
  Single point of failure. Queue lives on one node.

Mirrored Queues (Classic HA):
  Queue master on Node 1, mirrors on Nodes 2 and 3.
  All writes go to master; replicated to mirrors.
  If Node 1 dies, Node 2 becomes master.
  Problem: synchronization on mirror promotion causes brief pause.

Quorum Queues (Raft-based HA, recommended since RabbitMQ 3.8):
  Raft consensus across N nodes (use 3 or 5 for odd quorum).
  Leader election via Raft.
  No message loss during leader election.
  Better durability guarantees than mirrored queues.

  ┌────────────────────────────────────────────────────────────┐
  │  Quorum Queue: 3 nodes, quorum=2                           │
  │                                                            │
  │  [Node 1 - Leader]  ←──replication──►  [Node 2 - Follower] │
  │        │                                       │           │
  │        └─────────replication──────────►[Node 3 - Follower] │
  │                                                            │
  │  Write committed when 2/3 nodes acknowledge (quorum).      │
  └────────────────────────────────────────────────────────────┘
```

---

## 12. AWS SQS

> 🌍 **Real-World:** Netflix uses AWS SQS Standard queues for their video encoding pipeline — when a user uploads a video, a message is enqueued with the S3 object key. Dozens of encoding workers compete for messages; each worker transcodes the video into multiple bitrates (360p, 720p, 1080p, 4K). Message ordering doesn't matter because each encoding job is independent; the massive throughput of SQS Standard (effectively unlimited) lets Netflix scale encoding workers to thousands of instances during peak upload periods.

### Standard Queue vs FIFO Queue

| Feature | Standard Queue | FIFO Queue |
|---------|---------------|------------|
| **Throughput** | Unlimited (nearly) | 3,000 msg/sec with batching, 300 without |
| **Ordering** | Best-effort (not guaranteed) | Strict FIFO within a Message Group ID |
| **Exactly-Once** | At-least-once delivery | Exactly-once processing |
| **Deduplication** | No | Yes (content-based or explicit dedup ID) |
| **Use Case** | High throughput, order doesn't matter | Order matters, no duplicates |
| **Pricing** | Lower | Higher (2x cost) |

### Visibility Timeout — The Most Important SQS Concept

> 🌍 **Real-World:** Mailchimp uses visibility timeout carefully for their email campaign dispatch — sending a bulk email campaign can take 45+ minutes. They set `VisibilityTimeout=3600` (1 hour) and call `change_message_visibility` every 5 minutes to extend it, confirming the worker is still alive. If a worker pod is killed mid-send (OOM, node failure), the message becomes visible again after the last extension expires, and another worker picks up the partially-sent campaign and uses idempotency keys to skip already-sent recipients.

```
How SQS "at-least-once" works:
───────────────────────────────

1. Consumer polls SQS → receives message
2. Message becomes INVISIBLE to other consumers for `VisibilityTimeout` seconds
3. Consumer processes message
4. If consumer calls DeleteMessage() → message is gone ✅
5. If consumer DIES or doesn't delete → visibility timeout expires → 
   message becomes VISIBLE AGAIN → another consumer picks it up ♻️

┌───────────────────────────────────────────────────────────────────┐
│                    SQS Queue                                      │
│                                                                   │
│ [msg1][msg2][msg3][msg4][msg5]                                    │
│   ↑                                                               │
│   Consumer A receives msg1                                        │
│   msg1 is now INVISIBLE for 30s (VisibilityTimeout)               │
│                                                                   │
│ [....][msg2][msg3][msg4][msg5]   ← msg1 hidden from other consumers│
│                                                                   │
│ After 30s, if not deleted:                                        │
│ [msg1][msg2][msg3][msg4][msg5]   ← msg1 visible again             │
└───────────────────────────────────────────────────────────────────┘

Setting VisibilityTimeout:
  Too short → duplicate processing (consumer alive but slow)
  Too long → if consumer dies, message stuck for a long time

Best practice:
  VisibilityTimeout = processing_time_p99 * 1.5

For long jobs: extend visibility timeout during processing:
  sqs.change_message_visibility(
      QueueUrl=queue_url,
      ReceiptHandle=receipt_handle,
      VisibilityTimeout=60  # extend by 60 more seconds
  )
```

### Long Polling vs Short Polling

```python
import boto3

sqs = boto3.client('sqs', region_name='us-east-1')

# SHORT POLLING (default, inefficient):
response = sqs.receive_message(
    QueueUrl='https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    MaxNumberOfMessages=10,
    WaitTimeSeconds=0  # Returns immediately even if queue is empty
)
# Problem: 1000 empty responses per hour = wasted API calls + cost

# LONG POLLING (recommended):
response = sqs.receive_message(
    QueueUrl='https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    MaxNumberOfMessages=10,
    WaitTimeSeconds=20  # Wait up to 20 seconds for messages before returning
)
# If queue has messages → returns immediately
# If queue is empty → waits up to 20s → returns empty
# Reduces empty responses by 95%+, reduces cost
```

### SQS with Lambda (Event Source Mapping)

```python
# Lambda processes SQS messages automatically (no polling code needed)

import json

def lambda_handler(event, context):
    for record in event['Records']:
        message_body = json.loads(record['body'])
        receipt_handle = record['receiptHandle']
        
        try:
            process_order(message_body)
            # Lambda auto-deletes successful messages from batch
        except Exception as e:
            # Return error to fail this item
            # Lambda will retry failed items (or route to DLQ)
            raise

    # If function returns without error, all messages deleted from queue
    return {'statusCode': 200}

# Lambda Event Source Mapping config:
# - Batch size: 1-10,000 messages per invocation
# - Report batch item failures: partial batch success
# - Bisect batch on function error: binary search for poison pill
# - DLQ: set at queue level for unprocessable messages
```

### SQS FIFO and Message Groups

> 🌍 **Real-World:** Square uses SQS FIFO queues for payment state machine events — a payment transitions through `initiated → authorized → captured → settled`, and these events must be processed in order. Each payment gets its own `MessageGroupId` (`payment-uuid`), ensuring that authorization always precedes capture for the same payment. Different payments process in parallel across multiple `MessageGroupId`s, giving Square ordering guarantees per payment while still scaling horizontally across thousands of concurrent payments.

```python
# FIFO Queue: order guaranteed within a MessageGroupId
# Multiple groups processed in parallel (group = partition in Kafka terms)

sqs.send_message(
    QueueUrl='https://sqs.us-east-1.amazonaws.com/123456789/orders.fifo',
    MessageBody=json.dumps({'order_id': 123, 'event': 'paid'}),
    MessageGroupId='order-123',          # All order-123 events are FIFO
    MessageDeduplicationId='order-123-paid-1234567'  # Dedup: 5-min window
)

# Within MessageGroupId='order-123':
#   [placed] → [paid] → [shipped] → [delivered]   (guaranteed order)
# Within MessageGroupId='order-456':
#   [placed] → [paid] → [shipped]                  (parallel, independent)

# FIFO limitation: only 1 in-flight message per MessageGroupId
# (subsequent messages in same group invisible until first is processed)
# This is why FIFO queues have lower throughput than Standard queues
```

### SQS vs SQS FIFO vs SNS+SQS Fan-out

```
SQS Standard:
  [Producer] → [SQS Standard] → [Consumer Pool]
  Use: High-throughput tasks (image resizing, emails), order irrelevant

SQS FIFO:
  [Producer] → [SQS FIFO] → [Consumer Pool]
  Use: Financial transactions, state machines, order-sensitive workflows

SNS + SQS Fan-out:
  [Producer] → [SNS Topic] → [SQS Queue A] → [Consumer A]
                           → [SQS Queue B] → [Consumer B]
                           → [SQS Queue C] → [Consumer C]
  Use: Event-driven microservices, broadcast with independent consumers

Why SNS+SQS instead of just SNS with Lambda?
  - SQS buffers messages if Lambda is throttled/down
  - SQS provides retry logic and DLQ
  - Multiple consumer instances can compete on one SQS queue
  - SNS → Lambda directly has no retry buffer
```

---

## 13. Apache Kafka — Deeper Dive

> This section builds on `/Month-2/Kafka-Internals.md` with a focus on partition strategies, consumer groups, exactly-once semantics, and cross-datacenter patterns not fully covered there.

### Partition Strategy Design

> 🌍 **Real-World:** LinkedIn's activity feed uses user ID as the Kafka partition key — all events for a specific user (profile views, post likes, job applications) go to the same partition. This means the feed aggregation consumer can maintain a local in-memory user state without distributed lookups, making real-time feed generation orders of magnitude faster. LinkedIn's Kafka cluster handles over 7 trillion messages per day using this partition-by-user-ID strategy.

The partition strategy is the most important architectural decision in Kafka.

```
Choosing a partition key:
─────────────────────────

Goal: Balance between parallelism, ordering, and data locality.

1. User ID as partition key:
   producer.send(
       ProducerRecord("events", user_id, event)
   )
   All events for user_id=42 go to same partition.
   → Ordering per user guaranteed
   → Consumer can maintain user state in memory
   ⚠ Hot partitions if some users have much more activity (celebrities)

2. Order ID as partition key:
   All events for an order (placed, paid, shipped) are co-located.
   → State machine per order is easy
   → Order of operations guaranteed

3. No key (null key = round-robin):
   Messages distributed evenly across all partitions.
   → Maximum parallelism
   → No ordering guarantees at all
   → Use for: metrics, logs, high-volume events where order doesn't matter

4. Composite key (user_id + action_type):
   hash(user_id + "payment") → partition A
   hash(user_id + "profile") → partition B
   → Different event types for same user can go to different partitions
   ⚠ Loses ordering across event types for a user

Hot Partition Problem:
──────────────────────
Problem: 10 partitions, user_id=1 (celebrity) has 1M msgs/day,
         others have 1K/day. Partition 0 is overwhelmed.

Solutions:
  1. Salted keys: user_id + random_suffix(0-9)
     "celebrity-user-1" → 10 partitions (lose ordering, gain throughput)
  2. Sticky partitioning for that user (custom partitioner)
  3. Increase partition count for that topic
  4. Separate topic for high-volume users
```

### Consumer Group Rebalancing

> 🌍 **Real-World:** Confluent Cloud (Kafka-as-a-service used by Stripe) recommends the `CooperativeStickyAssignor` for all production consumer groups — when Stripe auto-scales their payment event consumers from 10 to 20 pods during peak load, only the newly-added 10 partitions are redistributed. The existing 10 pods continue processing their current partitions without interruption. With the default Eager rebalancer, all 20 pods would stop processing simultaneously for 5–30 seconds, dropping Stripe's throughput at exactly the moment they need to scale up.

```
Initial state: 4 partitions, 2 consumers
  P0 → C1
  P1 → C1
  P2 → C2
  P3 → C2

Scale up: Consumer C3 joins
  Rebalance triggered (stop-the-world for Eager protocols):
  P0 → C1
  P1 → C2
  P2 → C3
  P3 → C1 (or any distribution)

Scale down: C2 crashes
  Rebalance triggered:
  P0 → C1
  P1 → C1
  P2 → C3
  P3 → C3

Rebalance protocols:
  Eager (default for RangeAssignor, RoundRobinAssignor):
    - ALL partitions revoked from ALL consumers
    - All partitions reassigned from scratch
    - Brief pause in message processing ("stop the world")

  Incremental Cooperative (CooperativeStickyAssignor):
    - Only migrating partitions are revoked
    - Two-phase: first agree on what to move, then move
    - Other partitions continue processing during rebalance
    - Enabled: partition.assignment.strategy=CooperativeStickyAssignor

  Static Membership (group.instance.id):
    - Give each consumer a stable ID
    - If consumer dies and rejoins within session.timeout.ms, no rebalance
    - Use for stateful consumers (e.g., those maintaining local aggregations)
    consumer_config = {
        'group.instance.id': 'consumer-pod-1',  # Static pod ID
        'session.timeout.ms': 30000,            # 30s to rejoin before rebalance
    }
```

### Exactly-Once Semantics (EOS) Deep Dive

> 🌍 **Real-World:** Apache Flink (used by Alibaba to process 4.72 billion events per day during Singles' Day) uses Kafka's exactly-once transactions for its stream processing pipeline — the fraud detection job reads payment events, enriches them with customer risk scores, and writes results back to Kafka, all within a single Kafka transaction. If the Flink job crashes mid-stream, the transaction is aborted and replayed from the last committed offset with zero duplicate fraud alerts or missed detections.

```
Three delivery guarantees:
  At-most-once:  Messages may be lost, never duplicated
                 (fire and forget: acks=0)
  At-least-once: Messages may be duplicated, never lost
                 (acks=all, retries=MAX_INT, no idempotence)
  Exactly-once:  Messages processed once, never lost, never duplicated
                 (idempotent producer + transactions)

─────────────────────────────────────────────────────────────

EXACTLY-ONCE: Two Components

1. Idempotent Producer (for producer → broker):
   enable.idempotence=true  (automatically sets acks=all, retries=MAX_INT)
   
   Each producer gets a PID (Producer ID) from broker.
   Each message gets a sequence number.
   Broker deduplicates: if it sees same PID+sequence → ignores duplicate.
   
   ┌─────────────────────────────────────────────────────────────────┐
   │  Without idempotence:                                           │
   │    Producer sends msg (seq=5) → network error → retry           │
   │    Broker received msg first time but producer didn't know      │
   │    Broker receives msg second time → DUPLICATE                  │
   │                                                                 │
   │  With idempotence:                                              │
   │    Producer sends msg (PID=42, seq=5) → network error → retry   │
   │    Broker: "I already have PID=42, seq=5" → silently drops      │
   │    Producer receives ACK → success. Zero duplicates.            │
   └─────────────────────────────────────────────────────────────────┘

2. Transactions (for atomic multi-partition writes):
   Exactly-once semantics across a read-process-write cycle.
   
   # Read from topic A, process, write to topic B — atomically
   producer.initTransactions()
   
   try:
       producer.beginTransaction()
       
       # Produce to multiple topics/partitions atomically
       producer.send("output-topic-1", key, value1)
       producer.send("output-topic-2", key, value2)
       
       # Commit consumer offsets as part of same transaction
       # (This is what makes read-process-write exactly-once)
       producer.sendOffsetsToTransaction(offsets, consumer_group_id)
       
       producer.commitTransaction()
       
   except Exception:
       producer.abortTransaction()  # Rolls back ALL writes + offset commits
```

```java
// Java: Kafka EOS transaction pattern
Properties producerProps = new Properties();
producerProps.put("bootstrap.servers", "kafka1:9092");
producerProps.put("transactional.id", "order-processor-1");  // Unique per instance
producerProps.put("enable.idempotence", "true");  // Auto-set by transactional.id
producerProps.put("acks", "all");

KafkaProducer<String, String> producer = new KafkaProducer<>(producerProps);
producer.initTransactions();

Properties consumerProps = new Properties();
consumerProps.put("isolation.level", "read_committed");  // Only read committed msgs

try {
    producer.beginTransaction();
    
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(100));
    
    for (ConsumerRecord<String, String> record : records) {
        Order order = parseOrder(record.value());
        String enriched = enrichOrder(order);
        
        producer.send(new ProducerRecord<>("enriched-orders", order.getId(), enriched));
    }
    
    // Include offset commit in transaction
    Map<TopicPartition, OffsetAndMetadata> offsets = getCurrentOffsets(records);
    producer.sendOffsetsToTransaction(offsets, "order-enrichment-group");
    
    producer.commitTransaction();
    
} catch (ProducerFencedException e) {
    // Another instance claimed our transactional.id — we're a zombie, die
    producer.close();
} catch (Exception e) {
    producer.abortTransaction();
    // Do NOT commit consumer offsets — will reprocess on restart
}
```

### Consumer Lag Monitoring

> 🌍 **Real-World:** Robinhood monitors Kafka consumer lag as a real-time trading health metric — their order processing consumer group must maintain near-zero lag at all times. When lag on the `trades` topic exceeds 500 messages, PagerDuty fires and on-call engineers scale up consumer pods within 60 seconds. During the January 2021 meme stock frenzy (GameStop), trade volumes were 50x normal; Robinhood's consumer lag monitoring triggered auto-scaling 12 times in a single day, keeping order processing latency under 100ms.

```
Consumer lag = latest offset − consumer committed offset
           = number of unprocessed messages

Metric to alert on:
  lag > 1000: warning
  lag > 10000: critical  
  lag growing (not stable): investigate

# Python: check consumer group lag
from confluent_kafka.admin import AdminClient

admin = AdminClient({'bootstrap.servers': 'kafka1:9092'})

# Get consumer group offsets
consumer_offsets = admin.list_consumer_group_offsets(['order-processing-group'])
# Get latest partition offsets  
latest_offsets = {tp: admin.list_offsets({tp: OffsetSpec.latest()}) ...}

for tp, committed in consumer_offsets.items():
    latest = latest_offsets[tp]
    lag = latest - committed.offset
    if lag > 10000:
        alert(f"High lag on {tp.topic}:{tp.partition}: {lag}")
```

### Cross-Datacenter Kafka (MirrorMaker 2)

> 🌍 **Real-World:** Twitter uses MirrorMaker 2 for cross-datacenter Kafka replication — their primary Kafka cluster in `us-east` replicates all event streams to a disaster-recovery cluster in `us-west`. In the event of a datacenter failure, consumers can failover to the DR cluster within minutes, with MM2's offset translation ensuring they resume from the exact position they left off. Twitter's `@mentions` notification system uses this setup to guarantee notifications are never lost even during regional AWS outages.

```
Active-Passive Replication:
  DC1: [Cluster A - Primary] ──MirrorMaker2──► [Cluster B - DR]
  
  MirrorMaker 2 replicates:
    - Topics (with configurable replication factor)
    - Consumer group offsets (translated between clusters)
    - Topic configurations and metadata
    - ACLs

  On failover:
    - Point consumers to Cluster B
    - MM2 offset translation ensures consumers don't miss or duplicate messages
    - RPO: ~seconds (lag of MM2)

Active-Active (Multi-Region):
  DC1: [Cluster US] ◄──────────────────► [Cluster EU]: DC2
       (produces us.* topics)              (produces eu.* topics)
       (mirrors eu.* from EU)              (mirrors us.* from US)

  Naming convention prevents loops:
    US cluster writes to: us.orders, us.events
    EU cluster writes to: eu.orders, eu.events
    MirrorMaker only mirrors cross-region topics (no feedback loop)
```

---

## 14. Message Queue vs Kafka

### Decision Framework

```
Ask yourself these questions:

1. Do you need message REPLAY?
   YES → Kafka (consumers can re-read historical data)
   NO  → MQ or SQS might be simpler

2. Do you need HIGH THROUGHPUT (>100K msgs/sec)?
   YES → Kafka (millions/sec per cluster)
   NO  → RabbitMQ or SQS are fine

3. Do you need COMPLEX ROUTING (topic/fanout/direct/header exchanges)?
   YES → RabbitMQ (richest routing)
   NO  → SQS or Kafka are simpler

4. Do you need ZERO OPS / fully managed?
   YES → SQS (pure managed service, no servers)
   NO  → Either Kafka or RabbitMQ (both need cluster management)
         Or use Confluent Cloud/MSK/CloudAMQP for managed versions

5. Is this in AWS ecosystem?
   YES → SQS (or MSK for Kafka if replay needed)
   NO  → Kafka or RabbitMQ

6. Do you need per-message TTL or priority queues?
   YES → RabbitMQ (native support)
   NO  → Kafka (no per-message TTL) or SQS

7. Is this a STREAMING / EVENT-SOURCING use case?
   YES → Kafka (built for streaming, event sourcing, CQRS)
   NO  → Traditional MQ patterns work fine
```

```
Decision Tree:
──────────────

                        ┌─ Need replay? ──YES──► KAFKA
                        │
Need message broker? ───┤─ High throughput + no replay? ──► KAFKA or SQS
                        │
                        │  ─ Complex routing? ──► RABBITMQ
                        │
                        │  ─ AWS native + simple? ──► SQS
                        │
                        └─ Event streaming/CQRS? ──► KAFKA
```

### When NOT to Use Kafka

```
❌ Small-scale applications (<100K msgs/day)
   Kafka cluster overhead not worth it. Use SQS or Redis Streams.

❌ Request-Reply / RPC patterns
   Kafka is append-only. Not designed for RPC. Use RabbitMQ or HTTP.

❌ Per-message TTL or priority queues
   Kafka has no per-message TTL (only log-level retention). Use RabbitMQ.

❌ Simple task queue with competing consumers
   SQS or RabbitMQ are far simpler for this.

❌ Small team, limited operations experience
   Kafka cluster management is complex. Use managed SQS or CloudAMQP.

❌ When you need sub-millisecond latency
   Kafka batch/buffer introduces 5–50ms typical latency.
   For ultra-low latency: Redis Streams or ZeroMQ.
```

---

## 15. Ordering Guarantees, Exactly-Once Delivery, Idempotency

### Ordering Guarantees Across Systems

> 🌍 **Real-World:** WhatsApp relies on per-conversation message ordering — each message gets a monotonically increasing sequence number scoped to the conversation. The server assigns the sequence number at receipt time, and the client UI re-orders messages by sequence number before rendering. Even if network reordering causes message 5 to arrive before message 4, the client holds message 5 in a buffer and renders them in the correct order once message 4 arrives. This approach achieves perceived ordering without requiring global ordering across Kafka partitions.

```
System          Ordering Guarantee
──────────────  ───────────────────────────────────────────
Kafka           Per-partition ordering guaranteed.
                Global ordering requires single partition (kills parallelism).

SQS Standard    NO ordering guarantee. Best-effort.
                Same message may be delivered out of order.

SQS FIFO        FIFO within a MessageGroupId.
                Across groups: parallel, independent.

RabbitMQ        Per-queue ordering: messages delivered in FIFO order.
                UNLESS: multiple consumers on same queue → consumed out of order.
                (Consumer A gets msg1, Consumer B gets msg2, B finishes first)

Redis Streams   Per-stream ordering. Like Kafka but simpler.
```

### Exactly-Once Delivery — Why It's Hard

> 🌍 **Real-World:** Stripe uses at-least-once delivery with idempotent consumers for their payment webhooks — when a charge succeeds, a `charge.succeeded` event is published to their internal queue. The webhook delivery service retries failed deliveries for up to 72 hours. Each event has a unique `event_id`; the receiving service stores processed event IDs in a `processed_events` table with a unique constraint. If the same `charge.succeeded` event is delivered twice (due to retry), the second `INSERT` hits the unique constraint and the duplicate is silently ignored, preventing double-crediting of seller accounts.

```
The Problem with Distributed Systems:

Producer sends message → network failure → did broker receive it?
  Case 1: Broker received it, ACK lost → producer retries → DUPLICATE
  Case 2: Broker didn't receive it → producer retries → OK

You can't tell which case you're in without exactly-once infrastructure.

Approaches to exactly-once:

1. At-least-once + Idempotent Consumer (most common):
   Accept duplicates at the infrastructure level.
   Make consumer logic idempotent so duplicates have no effect.

   Idempotent patterns:
   a) Database unique constraint:
      INSERT INTO processed_orders (order_id, message_id) VALUES (?, ?)
      ON CONFLICT (message_id) DO NOTHING
      → duplicate message = no-op (constraint violation ignored)

   b) Check-then-process:
      if message_id in redis_cache: 
          return  # Already processed
      process(message)
      redis_cache.set(message_id, True, ex=86400)
      ⚠ Race condition if two consumers check simultaneously!

   c) Optimistic locking:
      UPDATE orders SET status='paid', version=version+1
      WHERE order_id=? AND version=?  -- only succeeds once

2. Kafka Transactions (true exactly-once):
   As described in section 13.
   Most complex but strongest guarantee.

3. Outbox Pattern (for database + message queue):
   ─────────────────────────────────────────────
   Problem: Write to DB and publish to queue atomically?
   
   If you do:
     db.save(order)
     queue.publish(order_placed)  ← if this fails, DB has order but queue doesn't
   
   Or:
     queue.publish(order_placed)  ← if this fails, queue has event but DB doesn't
     db.save(order)
   
   Both have inconsistency window.
   
   Solution: Transactional Outbox Pattern
   
   ┌─────────────────────────────────────────────────────────────────┐
   │                   Application Database                          │
   │                                                                 │
   │  ┌──────────────┐          ┌──────────────────────────────────┐ │
   │  │ orders table │          │  outbox table                    │ │
   │  │              │          │  (same DB, same transaction)     │ │
   │  │ id: 123      │ ◄───────►│  id: uuid1                      │ │
   │  │ status: paid │ atomic   │  event: order_placed             │ │
   │  │              │ txn      │  payload: {order_id: 123}        │ │
   │  └──────────────┘          │  sent: false                     │ │
   │                            └──────────────────────────────────┘ │
   └─────────────────────────────────────────────────────────────────┘
   
   Polling publisher (separate process):
     SELECT * FROM outbox WHERE sent=false ORDER BY created_at
     FOR EACH row:
       queue.publish(row.event, row.payload)
       UPDATE outbox SET sent=true WHERE id=row.id
   
   Or use Debezium (CDC - Change Data Capture):
     Debezium monitors DB transaction log (binlog/WAL)
     Publishes outbox table changes to Kafka automatically
     Zero polling, near-real-time, exactly-once via Kafka transactions
```

### Idempotency Patterns

```python
# Pattern 1: Database-level idempotency (PostgreSQL example)
import psycopg2

def process_payment_event(payment_id: str, amount: float, message_id: str):
    with db.transaction():
        # Idempotency key: message_id (from queue)
        cursor.execute("""
            INSERT INTO processed_messages (message_id, processed_at)
            VALUES (%s, NOW())
            ON CONFLICT (message_id) DO NOTHING
        """, (message_id,))
        
        if cursor.rowcount == 0:
            # Already processed - idempotent skip
            return {"status": "already_processed"}
        
        # Process payment (within same transaction)
        cursor.execute("""
            UPDATE accounts SET balance = balance - %s
            WHERE account_id = %s
        """, (amount, payment_id))
        
        return {"status": "processed"}

# Pattern 2: Redis-based idempotency
import redis

r = redis.Redis()

def process_order(order_id: str, message_id: str):
    idempotency_key = f"processed:{message_id}"
    
    # NX = set only if not exists, EX = expire in 24 hours
    if not r.set(idempotency_key, "1", nx=True, ex=86400):
        print(f"Message {message_id} already processed, skipping")
        return
    
    # Safe to process
    create_order(order_id)
```

---

## 16. Message Queue Interview Questions

### Q1: "Design WhatsApp's message delivery system. How do you guarantee message ordering and exactly-once delivery?"

**Answer Framework:**

```
Core Requirements:
  - 100 billion+ messages/day
  - Ordered delivery (messages from same sender appear in order)
  - Exactly-once delivery (no duplicates)
  - Offline support (deliver when user comes online)
  - Multi-device (same message on phone and web)
  - End-to-end encryption
  - Receipt acknowledgments (single check, double check, blue check)

NOT a traditional message queue problem:
  WhatsApp doesn't use Kafka or RabbitMQ as the primary transport.
  It uses a custom protocol (modified XMPP over WebSocket/TCP).

Architecture Overview:
──────────────────────

         ┌──────────────────────────────────────────────┐
         │              WhatsApp Server                  │
         │                                               │
[Alice]──┤─── WebSocket ───► Message Router             │
         │                        │                     │
         │                        ▼                     │
         │                   ┌──────────────────────────┤
         │                   │   Message Store           │
         │                   │   (if Bob offline)        │
         │                   │   Cassandra/custom store  │
         │                   └────────────┬─────────────┤
         │                                │             │
         │                        Bob online?           │
         │                       YES ──────────► Push  │
         │                        │              to Bob │
         │                        NO                   │
         │                        │                    │
         │               Store until Bob comes online  │
         └──────────────────────────────────────────────┘

Ordering Guarantee:
  Each message has: sender_id + sequence_number (monotonic per conversation)
  Server assigns global timestamp at receipt.
  Client UI orders by sequence_number within a conversation.
  
  [Alice sends to Bob]:
    msg1: seq=1, timestamp=T1
    msg2: seq=2, timestamp=T2
  Server delivers to Bob in seq order.
  If msg2 arrives before msg1 (network reordering), Bob's client waits for msg1.

Delivery Receipts (the three checks):
  ┌───────────────────────────────────────────────────────────────┐
  │  Alice             Server              Bob's Phone            │
  │    │                 │                       │                │
  │    │──send msg──────►│                       │                │
  │    │◄──single ✓──────│ (server received)     │                │
  │    │                 │──deliver to Bob──────►│                │
  │    │◄──double ✓──────│◄──delivery receipt────│                │
  │    │                 │                       │                │
  │    │                 │         (Bob opens chat)               │
  │    │◄──blue ✓────────│◄──read receipt────────│                │
  └───────────────────────────────────────────────────────────────┘

Exactly-once: 
  Client assigns msg_id = sender_id + UUID.
  Server deduplicates on msg_id (Redis or DB unique constraint).
  If client retries (network timeout), server ignores duplicate.
```

---

### Q2: "Design a notification system for 100 million users. How do you handle different channels (push, SMS, email) and user preferences?"

**Answer:**

```
System Requirements:
  - 100M users, 1B notifications/day
  - Multiple channels: push (FCM/APNs), SMS, email, in-app
  - User preferences (which channels, quiet hours, frequency caps)
  - Priority: transactional (OTP) vs marketing
  - Deduplication (don't send same notification twice)
  - Analytics (delivery, open rates)

High-Level Architecture:
─────────────────────────

  API Service ──► Notification Service ──► Priority Queue ──► Channel Workers
       │                  │
       │           User Preferences
       │               (cache)
       │
  Event Sources:
    - Order placed → trigger email + push
    - OTP requested → trigger SMS (high priority)
    - Marketing campaign → trigger email (low priority, rate-limited)

Message Queue Design:
──────────────────────
  Separate queues by priority AND channel:

  HIGH PRIORITY:
  ┌─────────────────────────────────────────────────────────────────┐
  │ sms-high-priority     → SMS workers (dedicated, fast)           │
  │ push-high-priority    → Push workers (dedicated)                │
  └─────────────────────────────────────────────────────────────────┘

  NORMAL PRIORITY:
  ┌─────────────────────────────────────────────────────────────────┐
  │ sms-normal            → SMS workers (shared pool)               │
  │ push-normal           → Push workers (shared pool)              │
  │ email-normal          → Email workers (SendGrid/SES batch)      │
  └─────────────────────────────────────────────────────────────────┘

  LOW PRIORITY (marketing):
  ┌─────────────────────────────────────────────────────────────────┐
  │ email-marketing       → Email workers (rate-limited: 1K/sec)    │
  │ push-marketing        → Push workers (rate-limited)             │
  └─────────────────────────────────────────────────────────────────┘

User Preferences Handling:
───────────────────────────
  Before enqueuing:
  1. Fetch user preferences from cache (Redis):
     - Channels enabled (push: yes, email: yes, SMS: no)
     - Quiet hours (no push 10pm-8am)
     - Frequency cap (max 3 marketing emails/week)
  2. Evaluate template against preferences
  3. Enqueue only for enabled channels

  # Python pseudo-code
  def dispatch_notification(user_id: str, notification: Notification):
      prefs = get_user_prefs(user_id)  # Redis cache, fallback to DB
      
      for channel in notification.channels:
          if not prefs.is_channel_enabled(channel):
              continue
          if prefs.is_quiet_hours() and notification.priority != 'HIGH':
              schedule_for_later(user_id, channel, notification)
              continue
          if not check_frequency_cap(user_id, channel, notification.type):
              skip_with_log(user_id, channel, "frequency_cap_exceeded")
              continue
          
          enqueue(channel, user_id, notification)

Channel Worker Design:
───────────────────────
  Push notification worker:
    1. Dequeue batch of 100 push notifications
    2. Group by device type (iOS → APNs, Android → FCM)
    3. Batch send to FCM/APNs API (up to 500/batch for FCM)
    4. Handle responses:
       - Success: update delivery status
       - Token expired: remove device token from DB
       - App uninstalled: remove device, maybe switch to email
    5. Failed: requeue with exponential backoff

  Email worker:
    1. Dequeue batch
    2. Render template (Jinja2/Handlebars)
    3. Send via SendGrid / SES API
    4. Track delivery status via webhook callbacks

Deduplication:
───────────────
  Notification dedup key = user_id + notification_type + content_hash + time_window
  Time window = truncate timestamp to 1-hour bucket
  
  Redis SETNX with 1-hour TTL:
    key = f"notif:{user_id}:{type}:{hash}:{hour_bucket}"
    if redis.set(key, "1", nx=True, ex=3600):
        enqueue(notification)  # First time, enqueue
    else:
        skip(notification)      # Duplicate, skip

Monitoring:
───────────
  Queue depth per channel (alert if > 10K for high-priority)
  Delivery latency (p50, p95, p99 per channel)
  Failure rates per channel (alert if > 1%)
  DLQ depth (alert if > 0, manual investigation)
```

---

### Q3: "Compare at-least-once vs exactly-once. When is each acceptable?"

```
AT-LEAST-ONCE (most common, pragmatic):
  - Messages guaranteed to be delivered, may be duplicated
  - Consumer must handle duplicates
  - Simpler infrastructure, better performance
  - Acceptable for: most use cases with idempotent operations

  Examples where at-least-once is fine:
    ✅ Image processing (re-processing same image = same result)
    ✅ Search index updates (re-indexing same document = same result)
    ✅ Cache warming (setting same value twice = no problem)
    ✅ Analytics events (counting duplicate = slight overcounting, usually OK)

EXACTLY-ONCE (harder, costly):
  - Messages guaranteed delivered exactly once
  - Requires distributed transaction infrastructure
  - Performance overhead: ~20–50% throughput reduction in Kafka
  - Acceptable for: financial transactions, inventory deductions

  Examples where exactly-once is critical:
    ❌ (need EOS) Billing: charge customer twice = serious problem
    ❌ (need EOS) Bank transfer: transfer $1000 twice = money loss
    ❌ (need EOS) Inventory deduction: deduct 5 items twice = oversell

  Practical middle ground: at-least-once + idempotent consumer
  (Most production systems use this pattern instead of true EOS)
  
  Cost of true EOS vs idempotent consumer:
    True EOS (Kafka transactions): complex infrastructure,
      all services must use same Kafka cluster, performance hit
    Idempotent consumer: simple DB unique constraint or Redis,
      works across heterogeneous systems, minimal overhead
```

---

## APPENDIX — System Design Handbook Insights

> Based on content from interviewwithbunny.com/systemdesignhandbook

> **Note:** The interviewwithbunny.com/systemdesignhandbook page was inaccessible during the creation of these notes (WebFetch permission not granted). The following section captures well-known system design interview frameworks and patterns that are commonly covered in system design handbooks — treat this as a high-quality synthesis of universal interview-prep wisdom.

---

### Core System Design Interview Framework (RESHADED)

Most FAANG system design interviews follow a structured evaluation. The RESHADED framework covers what interviewers look for:

```
R - Requirements (Functional + Non-Functional)
E - Estimation (Scale, QPS, Storage)
S - Storage Schema Design
H - High-Level Design
A - API Design
D - Detailed Design (deep dives)
E - Evaluation (bottlenecks, tradeoffs)
D - Distinguishing Features (unique insight)
```

### Step-by-Step Interview Protocol

```
Phase 1: Requirements Clarification (5 minutes)
────────────────────────────────────────────────
Functional: "What should the system do?"
  - Who are the users?
  - What are the core user actions?
  - What are out of scope features?

Non-Functional: "How should the system behave?"
  - Scale (DAU, QPS, data volume)
  - Latency requirements (p99 < 100ms?)
  - Availability (99.9% = 8.7 hrs/year, 99.99% = 52 min/year)
  - Consistency (strong, eventual, read-your-write?)
  - Durability (can we lose data?)

Phase 2: Capacity Estimation (3 minutes)
──────────────────────────────────────────
  DAU = 100M users
  10% active per day = 10M daily active
  Each creates 1 post/day → 10M writes/day
  10M / 86400 = ~115 writes/sec peak ~350 writes/sec

  Storage:
    1 post = 1KB text + 500KB image
    10M posts/day * 501KB = ~5TB/day
    5TB/day * 365 = ~1.8 PB/year

Phase 3: High-Level Design (10 minutes)
────────────────────────────────────────
  Draw boxes for:
    - Client (mobile/web)
    - Load Balancer / API Gateway
    - Core Services
    - Databases
    - Caches
    - Message Queues
    - CDN (for static assets)

Phase 4: Deep Dive (20 minutes)
────────────────────────────────
  Pick the MOST INTERESTING/COMPLEX component.
  Interviewer usually guides you.
  Show depth: sharding strategy, replication, consistency model.
```

### The CAP Theorem in Interviews

```
CAP Theorem: In a distributed system, you can have at most 2 of 3:
  C - Consistency (every read gets latest write or error)
  A - Availability (every request gets a non-error response)
  P - Partition Tolerance (system works despite network partitions)

Since network partitions ALWAYS happen in distributed systems,
the real choice is CP vs AP:

CP Systems (sacrifices Availability):
  - HBase, Zookeeper, Redis (by default)
  - If network partition: refuse requests rather than return stale data
  - Use for: banking, inventory (correctness > availability)

AP Systems (sacrifices Consistency — returns possibly stale data):
  - Cassandra, DynamoDB (by default), CouchDB
  - If network partition: still serve requests (may be stale)
  - Use for: social feeds, shopping carts, DNS

PACELC (more practical than CAP):
  P: during Partitions → A vs C (like CAP)
  E: Else (no partition) → L (Latency) vs C (Consistency)
  
  Most systems trade Latency for Consistency even without partitions:
    DynamoDB: PA/EL — available during partition, low latency normally
    Spanner: PC/EC — consistent during partition, consistent normally (high latency)
```

### Database Selection Framework

```
Relational (PostgreSQL, MySQL):
  Use when:
    ✅ ACID transactions required
    ✅ Complex queries with joins
    ✅ Schema is well-defined and stable
    ✅ Data integrity critical (financial, inventory)
  Scale limit: ~10K writes/sec on single node; sharding adds complexity

Document Store (MongoDB, DynamoDB):
  Use when:
    ✅ Flexible/evolving schema
    ✅ Hierarchical/nested data (JSON)
    ✅ Read-heavy workloads
    ✅ Need horizontal scaling out of the box
  Drawback: no joins, limited transactions

Wide Column (Cassandra, HBase):
  Use when:
    ✅ Write-heavy (millions of writes/sec)
    ✅ Time-series data
    ✅ Massive scale (petabytes)
    ✅ Simple query patterns (know partition key)
  Drawback: no joins, eventual consistency default

Graph (Neo4j, Amazon Neptune):
  Use when:
    ✅ Relationship traversal is the core query
    ✅ Social graphs, recommendation engines, fraud detection
  Drawback: doesn't scale horizontally well

Search (Elasticsearch):
  Use when:
    ✅ Full-text search
    ✅ Faceted search and aggregations
  Drawback: not a primary store (eventual consistency with source DB)

Cache (Redis, Memcached):
  Use when:
    ✅ Hot data that fits in memory
    ✅ Session storage
    ✅ Rate limiting, leaderboards, pub/sub
```

### Sharding Strategies

```
1. Range Sharding:
   Shard by ranges of a key (e.g., user_id 1-1M → Shard 1, 1M-2M → Shard 2)
   ✅ Range queries efficient
   ❌ Hot spots (recent users are active, older users quiet)

2. Hash Sharding:
   shard_id = hash(key) % num_shards
   ✅ Even distribution
   ❌ Range queries require fan-out to all shards
   ❌ Resharding requires data migration

3. Consistent Hashing:
   Keys and shards placed on a ring. Key goes to next shard clockwise.
   Add/remove shard: only moves ~K/N keys (K=total keys, N=shards)
   ✅ Minimal data movement during resharding
   Used by: DynamoDB, Cassandra, memcached

4. Directory-Based Sharding:
   Lookup table: key → shard mapping
   ✅ Most flexible (can rebalance without formula change)
   ❌ Directory is a bottleneck/single point of failure

5. Geographic Sharding:
   US users → US shard, EU users → EU shard
   ✅ Data locality (GDPR compliance)
   ❌ Cross-region queries expensive
```

### Rate Limiting Algorithms

```
1. Token Bucket (most common):
   - Bucket with capacity N
   - Tokens added at rate R tokens/sec
   - Each request consumes 1 token
   - Request rejected if bucket empty
   
   Allows bursts up to bucket capacity.
   Used by: AWS, Stripe

2. Leaky Bucket:
   - Requests enter bucket at any rate
   - Requests leave bucket at fixed rate R
   - Bucket overflows if fill rate > drain rate
   
   Enforces CONSTANT output rate (no bursts).
   Good for smoothing traffic.

3. Fixed Window Counter:
   - Count requests per time window (e.g., 1 minute)
   - Reject if count > limit
   
   Problem: boundary spike (100 req at :59, 100 req at :01 → 200 in 2 sec)

4. Sliding Window Log:
   - Log timestamp of each request
   - Count requests in last N seconds
   - Most accurate but memory-intensive

5. Sliding Window Counter (hybrid):
   - Weighted average of current and previous window counts
   - current_count + prev_count * overlap_ratio
   - Balance of accuracy and memory

Redis implementation (token bucket):
  local tokens = redis.call('GET', key) or capacity
  local now = tonumber(ARGV[1])
  local last_refill = redis.call('GET', key..':time') or now
  
  -- Refill tokens based on elapsed time
  local elapsed = now - last_refill
  tokens = math.min(capacity, tokens + elapsed * rate)
  
  if tokens >= 1 then
      redis.call('SET', key, tokens - 1)
      redis.call('SET', key..':time', now)
      return 1  -- allowed
  else
      return 0  -- rejected
```

### Consistent Hashing — Visual

```
Hash Ring (0 to 2^32 - 1):

              0
             / \
        N3  /   \  N1
           /     \
    2^32/4        2^32/4
          \       /
       N4  \     /  N2
             \ /
           2^32/2

Request for key K:
  hash(K) = X
  X falls between N2 and N3 on the ring
  → Routes to N3 (next clockwise)

Virtual nodes (vnodes):
  Each physical node gets V virtual positions on ring (e.g., V=150)
  Better load distribution, handles heterogeneous node sizes
  N1: positions 42, 198, 765, ... (150 positions)
  N2: positions 73, 301, 890, ... (150 positions)
```

### Key Numbers Every Engineer Should Know

```
Latency Numbers (2024 approximate):
  L1 cache access:        ~0.5 ns
  L2 cache access:        ~7 ns
  Main memory access:     ~100 ns
  SSD random read:        ~100 μs (100,000 ns)
  HDD seek:               ~10 ms (10,000,000 ns)
  Network roundtrip:
    Same DC:              ~0.5 ms
    Same region:          ~5 ms
    Cross continent:      ~100–200 ms

Throughput Reference:
  Redis:                  100K–1M ops/sec (single instance)
  PostgreSQL:             ~10K writes/sec (single primary)
  Kafka:                  1–10M msgs/sec (per cluster)
  Cassandra:              100K–1M writes/sec (per cluster)
  CDN edge:               ~100 Gbps per PoP

Storage:
  1 tweet:                ~280 bytes text + metadata ≈ 1 KB
  1 photo (compressed):   ~100 KB – 1 MB
  1 minute video (HD):    ~50–100 MB
  
Powers of 10:
  1 million = 10^6
  1 billion = 10^9
  1 trillion = 10^12
  
  1 KB = 10^3 bytes
  1 MB = 10^6 bytes  
  1 GB = 10^9 bytes
  1 TB = 10^12 bytes
  1 PB = 10^15 bytes
```

---

*Last updated: May 2026*
*Part of the 3-Month FAANG Preparation Program*
*Next: See Month-3/ for mock interviews and system design practice problems*

---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (CDN / Queues)

- [ ] CDN purpose: latency + origin offload
- [ ] Cache-Control / invalidation tradeoffs
- [ ] Queue vs stream (Rabbit/SQS vs Kafka)
- [ ] Backpressure and DLQ
- [ ] Idempotent consumers

## 🛠️ PRACTICAL
Design: image upload → S3 → CDN; and async order pipeline with DLQ.

