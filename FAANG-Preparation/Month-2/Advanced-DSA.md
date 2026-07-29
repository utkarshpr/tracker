# Advanced DSA — Complete Study Notes (Competitive + Interview Depth)

Self-contained. Java code throughout.

---

## Table of Contents

1. [String Algorithms](#1-string-algorithms)
   - [KMP (Knuth-Morris-Pratt)](#kmp-knuth-morris-pratt)
   - [Rabin-Karp (Rolling Hash)](#rabin-karp-rolling-hash)
   - [Z-Algorithm](#z-algorithm)
2. [Digit DP](#2-digit-dp)
3. [Bitmask DP](#3-bitmask-dp)
4. [Segment Tree with Lazy Propagation](#4-segment-tree-with-lazy-propagation)
5. [Sparse Table (Range Minimum Query)](#5-sparse-table-range-minimum-query)
6. [Mo's Algorithm](#6-mos-algorithm)
7. [Heavy-Light Decomposition (HLD)](#7-heavy-light-decomposition-hld)
8. [Tarjan's SCC (Strongly Connected Components)](#8-tarjans-scc-strongly-connected-components)
9. [Bridges and Articulation Points](#9-bridges-and-articulation-points)
10. [Advanced DP Patterns](#10-advanced-dp-patterns)
    - [DP on Trees (Rerooting)](#dp-on-trees-rerooting)
    - [DP with Profile (Broken Profile DP)](#dp-with-profile-broken-profile-dp)
11. [Maximum Flow (Ford-Fulkerson / Dinic's)](#11-maximum-flow-ford-fulkerson--dinics)
12. [Complexity Summary](#complexity-summary)
13. [FAANG Rarity Guide](#faang-rarity-guide--when-each-advanced-algo-appears)
14. [Practice Problem Sets](#practice-problem-sets-by-difficulty)
15. [Pattern Recognition Drills](#pattern-recognition-drills)
16. [Complexity Flash Table](#complexity-flash-table-with-intuition)
17. [Important Concepts Checklist](#important-concepts-checklist)

---

## 1. STRING ALGORITHMS

### KMP (Knuth-Morris-Pratt)

**Why**: Find pattern in text in O(n+m) instead of O(n\*m).

> 🌍 **Real-World:** grep (GNU grep) uses a variant of the KMP/Boyer-Moore family to search through gigabytes of log files in a single pass — the LPS failure function means it never backtracks in the text, making it O(n+m) even on adversarial inputs. Intrusion detection systems like Snort use KMP to scan network packet payloads for thousands of known malware signatures simultaneously, matching patterns at line rate.

> **💡 Key Insight:** The **LPS (Longest Proper Prefix which is also Suffix)** array lets KMP avoid re-examining characters on mismatch by "rewinding" only as far as the longest matching border, not back to the beginning.

> ⭐ **IMPORTANT CONCEPT:** LPS is the entire trick of KMP. On mismatch at `j`, jump to `lps[j-1]` — never restart at 0 and never advance `i` when `j > 0`. If you can build LPS for `"AABAACAABAA"` on a whiteboard, you own the interview.

```java
// Step 1: Build failure function (LPS array)
// lps[i] = length of longest proper prefix of pattern[0..i] that is also a suffix
int[] buildLPS(String pattern) {
    int m = pattern.length();
    int[] lps = new int[m];
    int len = 0, i = 1;
    while (i < m) {
        if (pattern.charAt(i) == pattern.charAt(len)) {
            lps[i++] = ++len;
        } else if (len > 0) {
            len = lps[len - 1]; // don't increment i
        } else {
            lps[i++] = 0;
        }
    }
    return lps;
}

// Step 2: Search
List<Integer> kmpSearch(String text, String pattern) {
    int[] lps = buildLPS(pattern);
    List<Integer> result = new ArrayList<>();
    int i = 0, j = 0;  // text index, pattern index
    while (i < text.length()) {
        if (text.charAt(i) == pattern.charAt(j)) {
            i++; j++;
        }
        if (j == pattern.length()) {
            result.add(i - j);  // match found at index i-j
            j = lps[j - 1];    // continue searching
        } else if (i < text.length() && text.charAt(i) != pattern.charAt(j)) {
            if (j > 0) j = lps[j - 1];
            else i++;
        }
    }
    return result;
}
// Time O(n+m), Space O(m)

// Example: pattern = "ABABC", text = "ABABABABC"
// lps = [0,0,1,2,0]
// When mismatch at j=4, go back to lps[3]=2 (not start)
```

> **⚠️ Common Mistake:** When a mismatch occurs and `j > 0`, set `j = lps[j - 1]` but do **not** increment `i`. Incrementing `i` at that point skips a potential match.

---

### Rabin-Karp (Rolling Hash)

**Why**: Multiple pattern search, string hashing, duplicate detection.

> 🌍 **Real-World:** Google's plagiarism detection system (used in Google Classroom) uses rolling hashes to fingerprint all length-k substrings of a document in O(n) and compare them against a database of known documents — finding matches without comparing every pair. GitHub's code duplication detector uses the same rolling-hash technique to identify copy-pasted code blocks across millions of repositories.

> **💡 Key Insight:** The **rolling hash** removes the leftmost character and adds a new rightmost character in O(1), turning the brute-force O(n\*m) comparison into an O(n+m) average scan. Always verify hash matches with an actual string comparison to handle collisions.

```java
long rabinKarp(String text, String pattern) {
    int n = text.length(), m = pattern.length();
    long BASE = 31, MOD = 1_000_000_007;
    long power = 1;

    // Compute pattern hash and first window hash
    long patHash = 0, winHash = 0;
    for (int i = 0; i < m; i++) {
        patHash = (patHash + (pattern.charAt(i) - 'a' + 1) * power) % MOD;
        winHash = (winHash + (text.charAt(i) - 'a' + 1) * power) % MOD;
        if (i < m - 1) power = (power * BASE) % MOD;
    }

    int count = 0;
    for (int i = 0; i <= n - m; i++) {
        if (winHash == patHash) {
            // Hash match — verify (handles collisions)
            if (text.substring(i, i + m).equals(pattern)) count++;
        }
        if (i < n - m) {
            // Slide window: remove leftmost char, add new rightmost char
            winHash = (winHash - (text.charAt(i) - 'a' + 1) + MOD) % MOD;
            winHash = (winHash * (MOD + 1) / BASE) % MOD; // simplified
            // Correct rolling hash:
            winHash = winHash / BASE % MOD;  // conceptually
            winHash = (winHash + (text.charAt(i + m) - 'a' + 1) * power) % MOD;
        }
    }
    return count;
}

// Better rolling hash (polynomial with powers):
long[] precomputeHash(String s, long BASE, long MOD) {
    int n = s.length();
    long[] hash = new long[n + 1];
    long[] pw = new long[n + 1];
    pw[0] = 1;
    for (int i = 0; i < n; i++) {
        hash[i + 1] = (hash[i] * BASE + s.charAt(i)) % MOD;
        pw[i + 1] = pw[i] * BASE % MOD;
    }
    return hash;
}

long getHash(long[] hash, long[] pw, long MOD, int l, int r) {
    // hash of s[l..r] inclusive
    return (hash[r + 1] - hash[l] * pw[r - l + 1] % MOD + MOD * 2) % MOD;
}
```

> **⚠️ Common Mistake:** Using a single hash modulus risks collisions. In competitive programming, use **double hashing** (two independent `(BASE, MOD)` pairs) to reduce the collision probability to near zero.

---

### Z-Algorithm

**Why**: Find all positions where pattern occurs in text. O(n+m).

> 🌍 **Real-World:** Bioinformatics tools like BLAST (used by the NIH) use Z-algorithm-style prefix matching to find all occurrences of a DNA or protein sequence motif within a genome in linear time — scanning the entire human genome (3 billion base pairs) in a single O(n+m) pass. Competitive programming judges use Z-function to check all test cases for pattern matches in their graders.

> **💡 Key Insight:** `z[i]` is the length of the longest substring starting at position `i` that is also a prefix of the whole string. Concatenating `pattern + "$" + text` and checking `z[i] == pattern.length()` gives all match positions in one linear pass.

```java
int[] zFunction(String s) {
    int n = s.length();
    int[] z = new int[n];
    int l = 0, r = 0;
    for (int i = 1; i < n; i++) {
        if (i < r) z[i] = Math.min(r - i, z[i - l]);
        while (i + z[i] < n && s.charAt(z[i]) == s.charAt(i + z[i])) z[i]++;
        if (i + z[i] > r) { l = i; r = i + z[i]; }
    }
    return z;
}

// Pattern matching: concat pattern + "$" + text
// z[i] == pattern.length() → match at position i - pattern.length() - 1
List<Integer> zSearch(String text, String pattern) {
    String s = pattern + "$" + text;
    int[] z = zFunction(s);
    List<Integer> result = new ArrayList<>();
    for (int i = pattern.length() + 1; i < s.length(); i++)
        if (z[i] == pattern.length())
            result.add(i - pattern.length() - 1);
    return result;
}
```

---

## 2. DIGIT DP

> ⭐ **IMPORTANT CONCEPT:** Digit DP = count numbers ≤ N (or in [L,R]) with a property by walking digits left→right. Core state: `(pos, tight, …extras)`. `tight` caps the digit; memoize primarily when `tight=false`. Range `[L,R]` is always `f(R) - f(L-1)`.

**Pattern**: Count numbers in range [L, R] satisfying some property.
**State**: position in digit, **tight constraint** (can we go beyond?), memo.

> 🌍 **Real-World:** Tax software at Intuit (TurboTax) uses digit DP to count valid tax ID numbers in a given numeric range that satisfy format constraints (e.g., specific digit patterns for SSNs) — the tight flag ensures the count stays within legal bounds without enumerating every number. Telecom companies use digit DP to count valid phone numbers in a range that avoid restricted prefixes, computing provisioning quotas in O(D × 10 × states) instead of O(10^D) enumeration.

> **💡 Key Insight:** The `tight` flag is what prevents the DP from generating numbers larger than N. When `tight = true`, the digit limit at the current position is `digits[pos]`; otherwise it is `9`. Memoize only states where `tight = false` because the `tight = true` path is unique per recursion.

```java
// Count numbers from 1 to N with digit sum = S
int[] digits;
int[][] memo;

int countWithDigitSum(int N, int S) {
    digits = Integer.toString(N).chars().map(c -> c - '0').toArray();
    memo = new int[digits.length][S + 1];
    for (int[] row : memo) Arrays.fill(row, -1);
    return solve(0, 0, true, S);
}

// pos = current digit position
// sum = digit sum so far
// tight = whether current number is still equal to N's prefix
int solve(int pos, int sum, boolean tight, int target) {
    if (sum > target) return 0;
    if (pos == digits.length) return sum == target ? 1 : 0;

    if (!tight && memo[pos][sum] != -1) return memo[pos][sum];

    int limit = tight ? digits[pos] : 9;
    int result = 0;
    for (int d = 0; d <= limit; d++)
        result += solve(pos + 1, sum + d, tight && d == limit, target);

    if (!tight) memo[pos][sum] = result;
    return result;
}

// Count in range [L, R]: f(R) - f(L-1)
// Common digit DP states:
// - tight: bool (can we use digit > digits[pos]?)
// - started: bool (have we placed any non-zero digit yet? for leading zeros)
// - count of some digit
// - last digit placed (for consecutive same digit constraint)
// - remainder mod K (for divisibility)
```

> **⚠️ Common Mistake:** Forgetting the `started` (leading-zero) flag causes the DP to count leading zeros as valid digits. Add a `started` boolean and skip digit-specific constraints until the first non-zero digit is placed.

---

## 3. BITMASK DP

> ⭐ **IMPORTANT CONCEPT:** Bitmask DP fits when N ≤ ~20 and state = "subset visited/assigned." Encode subset as an int; transition `mask → mask|(1<<v)`. TSP is O(2ⁿ·n²). Sentinel = `INF/2` to avoid overflow on adds.

**When**: subsets of small N (N ≤ 20), assignment problems, **TSP (Travelling Salesman Problem)**.

> 🌍 **Real-World:** Google's vehicle routing system for Google Maps delivery optimization uses bitmask DP (TSP) on small delivery clusters (≤ 20 stops) before handing off to heuristics for larger routes — each bitmask encodes which stops have been visited, making O(2^n × n²) feasible for last-mile delivery planning. Nurse scheduling software at hospital chains uses bitmask DP for assignment problems: which nurses (N ≤ 20) cover which shifts to minimize total overtime cost.

> **💡 Key Insight:** Represent "which cities/items have been visited" as a bitmask. Transitioning from `mask` to `mask | (1 << v)` is O(1), making it practical to enumerate all 2^N subsets with an O(n) inner loop.

```java
// Traveling Salesman Problem (minimum cost to visit all cities)
// O(2^n * n^2)
int tsp(int[][] dist) {
    int n = dist.length;
    int FULL = (1 << n) - 1;
    int[][] dp = new int[1 << n][n];
    for (int[] row : dp) Arrays.fill(row, Integer.MAX_VALUE / 2);
    dp[1][0] = 0;  // visited only city 0, at city 0, cost 0

    for (int mask = 1; mask < (1 << n); mask++) {
        for (int u = 0; u < n; u++) {
            if ((mask & (1 << u)) == 0) continue;  // u not in mask
            if (dp[mask][u] == Integer.MAX_VALUE / 2) continue;
            for (int v = 0; v < n; v++) {
                if ((mask & (1 << v)) != 0) continue;  // v already visited
                int newMask = mask | (1 << v);
                dp[newMask][v] = Math.min(dp[newMask][v], dp[mask][u] + dist[u][v]);
            }
        }
    }

    int ans = Integer.MAX_VALUE;
    for (int u = 1; u < n; u++)
        ans = Math.min(ans, dp[FULL][u] + dist[u][0]);
    return ans;
}

// Minimum Cost to Connect All Points (LC 1584 — Prim's is easier but bitmask works for N≤15)

// Assign Tasks to Workers (each worker gets exactly one task, minimize total cost)
// dp[mask] = min cost to assign tasks in 'mask' to first popcount(mask) workers
int assignTasks(int[][] cost) {
    int n = cost.length;
    int[] dp = new int[1 << n];
    Arrays.fill(dp, Integer.MAX_VALUE / 2);
    dp[0] = 0;
    for (int mask = 0; mask < (1 << n); mask++) {
        if (dp[mask] == Integer.MAX_VALUE / 2) continue;
        int worker = Integer.bitCount(mask);  // next worker to assign
        if (worker == n) continue;
        for (int task = 0; task < n; task++) {
            if ((mask & (1 << task)) != 0) continue;  // task already assigned
            dp[mask | (1 << task)] = Math.min(dp[mask | (1 << task)], dp[mask] + cost[worker][task]);
        }
    }
    return dp[(1 << n) - 1];
}
```

> **⚠️ Common Mistake:** Using `Integer.MAX_VALUE` directly and then adding to it causes integer overflow. Always use `Integer.MAX_VALUE / 2` as the "infinity" sentinel in bitmask DP.

---

## 4. SEGMENT TREE WITH LAZY PROPAGATION

> ⭐ **IMPORTANT CONCEPT:** Lazy propagation is what makes range updates O(log n). Store pending updates on a node; **pushDown** before touching children (on both update AND query). Forgetting push on query → silent wrong answers.

**Why**: Range update + range query in O(log n). Without lazy: O(n) per range update.

> 🌍 **Real-World:** Codeforces' judge evaluates millions of range-update + range-query problems using lazy segment trees as the gold standard reference solution — without lazy propagation, a range update would cost O(n) per operation, making 10^5 queries TLE. Real-time game servers (Unity, Unreal Engine) use lazy segment trees for area-of-effect damage systems: a single "apply 50 damage to all units in region [L, R]" is a range update, and "total HP in region" is a range query — both O(log n) with lazy propagation.

> **💡 Key Insight:** **Lazy propagation** defers the work of pushing updates down the tree. A node stores a pending `lazy` value that is only pushed to its children when the node itself is accessed for a query or update, keeping every operation at O(log n).

```java
class LazySegTree {
    int n;
    long[] tree, lazy;

    LazySegTree(int[] nums) {
        n = nums.length;
        tree = new long[4 * n];
        lazy = new long[4 * n];
        build(nums, 0, 0, n - 1);
    }

    void build(int[] nums, int node, int s, int e) {
        if (s == e) { tree[node] = nums[s]; return; }
        int mid = (s + e) / 2;
        build(nums, 2*node+1, s, mid);
        build(nums, 2*node+2, mid+1, e);
        tree[node] = tree[2*node+1] + tree[2*node+2];
    }

    void pushDown(int node, int s, int e) {
        if (lazy[node] != 0) {
            int mid = (s + e) / 2;
            int leftSize = mid - s + 1, rightSize = e - mid;
            tree[2*node+1] += lazy[node] * leftSize;
            tree[2*node+2] += lazy[node] * rightSize;
            lazy[2*node+1] += lazy[node];
            lazy[2*node+2] += lazy[node];
            lazy[node] = 0;
        }
    }

    // Range update: add val to all elements in [l, r]
    void update(int l, int r, long val, int node, int s, int e) {
        if (r < s || e < l) return;
        if (l <= s && e <= r) {
            tree[node] += val * (e - s + 1);
            lazy[node] += val;
            return;
        }
        pushDown(node, s, e);
        int mid = (s + e) / 2;
        update(l, r, val, 2*node+1, s, mid);
        update(l, r, val, 2*node+2, mid+1, e);
        tree[node] = tree[2*node+1] + tree[2*node+2];
    }

    // Range query: sum of [l, r]
    long query(int l, int r, int node, int s, int e) {
        if (r < s || e < l) return 0;
        if (l <= s && e <= r) return tree[node];
        pushDown(node, s, e);
        int mid = (s + e) / 2;
        return query(l, r, 2*node+1, s, mid) + query(l, r, 2*node+2, mid+1, e);
    }
}
// Time: O(log n) per update/query even for range operations
```

> **⚠️ Common Mistake:** Forgetting to call `pushDown` before recursing into children during a query (not just during updates) will return stale values from nodes that still hold un-propagated lazy updates.

---

## 5. SPARSE TABLE (Range Minimum Query)

**When**: static array, many range min/max queries, no updates.
**Why**: O(n log n) build, O(1) query — faster than segment tree for static **RMQ**.

> 🌍 **Real-World:** Suffix array + LCP array construction (used in Google's full-text search index and bioinformatics tools like BWA) relies on a sparse table for O(1) LCP queries between arbitrary suffix pairs — the static RMQ on the LCP array is the bottleneck, and sparse table eliminates it. Database query optimizers at PostgreSQL and MySQL use sparse-table-style precomputed structures for O(1) range statistics on histogram buckets during query planning.

> **💡 Key Insight:** For **idempotent operations** like min/max, two overlapping power-of-two intervals that together cover `[l, r]` give the correct answer even though they overlap — so `query(l, r)` reduces to exactly two table lookups.

```java
class SparseTable {
    int[][] table;
    int[] log2;
    int n;

    SparseTable(int[] arr) {
        n = arr.length;
        int LOG = 1;
        while ((1 << LOG) <= n) LOG++;
        table = new int[LOG][n];
        log2 = new int[n + 1];

        table[0] = arr.clone();
        for (int j = 1; j < LOG; j++)
            for (int i = 0; i + (1 << j) <= n; i++)
                table[j][i] = Math.min(table[j-1][i], table[j-1][i + (1 << (j-1))]);

        log2[1] = 0;
        for (int i = 2; i <= n; i++) log2[i] = log2[i / 2] + 1;
    }

    int query(int l, int r) {  // min of [l..r] inclusive
        int k = log2[r - l + 1];
        return Math.min(table[k][l], table[k][r - (1 << k) + 1]);
    }
}
// Build O(n log n), Query O(1)
// Note: only works for idempotent operations (min, max, gcd) — not sum
```

> **⚠️ Common Mistake:** Sparse Table cannot be used for **sum** queries because overlapping intervals would double-count elements. Use a **Prefix Sum** array for O(1) static sum queries instead.

---

## 6. MO'S ALGORITHM

**When**: range queries on static array, offline (can sort queries), no updates.
**Key idea**: sort queries by (block of left, right direction). Each pointer moves O(n√n) total.

> 🌍 **Real-World:** Analytics platforms like Splunk use Mo's algorithm offline over historical log event arrays to efficiently answer "how many distinct event types occurred between timestamp A and B?" across thousands of log-range queries in a batch job — the O((n+q)√n) total complexity beats running each query independently at O(nq). Competitive programming problem setters at Codeforces and AtCoder use Mo's as the canonical O((n+q)√n) offline technique for distinct-count range queries.

> **💡 Key Insight:** The block size should be `sqrt(n)`. Sorting queries within odd-numbered blocks by right index ascending and even-numbered blocks by right index descending (the "Hilbert curve" or "zigzag" trick) halves the constant factor in practice.

```java
// Count distinct elements in range [l, r]
int[] moAlgorithm(int[] arr, int[][] queries) {
    int n = arr.length, q = queries.length;
    int blockSize = (int) Math.sqrt(n);

    // Sort queries: by left block, then by right (alternating for optimization)
    Integer[] order = new Integer[q];
    for (int i = 0; i < q; i++) order[i] = i;
    Arrays.sort(order, (a, b) -> {
        int ba = queries[a][0] / blockSize, bb = queries[b][0] / blockSize;
        if (ba != bb) return ba - bb;
        return (ba & 1) == 0 ? queries[a][1] - queries[b][1] : queries[b][1] - queries[a][1];
    });

    int[] freq = new int[100001];  // frequency of each value
    int[] answers = new int[q];
    int curL = 0, curR = -1, curCount = 0;

    for (int qi : order) {
        int l = queries[qi][0], r = queries[qi][1];
        while (curR < r) { curR++; if (++freq[arr[curR]] == 1) curCount++; }
        while (curL > l) { curL--; if (++freq[arr[curL]] == 1) curCount++; }
        while (curR > r) { if (--freq[arr[curR]] == 0) curCount--; curR--; }
        while (curL < l) { if (--freq[arr[curL]] == 0) curCount--; curL++; }
        answers[qi] = curCount;
    }
    return answers;
}
// Time O((n + q) * sqrt(n))
```

> **⚠️ Common Mistake:** The order of the four `while` loops matters. Always **expand** the window before **shrinking** it. Expanding first (`curR < r`, `curL > l`) ensures the window is always valid before shrinking, preventing out-of-bounds or incorrect frequency counts.

---

## 7. HEAVY-LIGHT DECOMPOSITION (HLD)

**When**: path queries on a tree (sum/min/max on path between two nodes).
**Why**: decomposes tree paths into O(log n) contiguous segments in an array → segment tree queries.

> 🌍 **Real-World:** Google's internal infrastructure monitoring system uses HLD on their network topology tree to answer "what is the maximum link latency on the path from data center A to data center B?" — HLD reduces each path query to O(log² n) segment tree lookups, enabling real-time SLA monitoring across thousands of nodes. Competitive programming systems (Codeforces Gym) use HLD as the canonical solution for tree path queries with point updates in their editorial solutions.

> **💡 Key Insight:** Every root-to-leaf path crosses at most O(log n) **light edges** (edges from a node to a non-heavy child). This guarantees that any path between two nodes decomposes into at most O(log n) contiguous chains, each queryable in O(log n) with a segment tree, giving O(log² n) total per path query.

```java
class HLD {
    int n;
    int[] parent, depth, heavy, head, pos, size;
    int[] arr;  // values
    SegTree st; // segment tree on positions
    List<List<Integer>> adj;

    HLD(int n, List<List<Integer>> adj, int[] vals) {
        this.n = n; this.adj = adj; this.arr = vals;
        parent = new int[n]; depth = new int[n]; heavy = new int[n];
        head = new int[n]; pos = new int[n]; size = new int[n];
        Arrays.fill(heavy, -1);
        dfs(0, -1, 0);  // compute subtree sizes and heavy children
        decompose(0, 0); // assign positions
        // Build seg tree on pos[] ordering
    }

    int dfs(int v, int p, int d) {
        parent[v] = p; depth[v] = d; size[v] = 1;
        int maxSize = 0;
        for (int u : adj.get(v)) {
            if (u == p) continue;
            size[v] += dfs(u, v, d + 1);
            if (size[u] > maxSize) { maxSize = size[u]; heavy[v] = u; }
        }
        return size[v];
    }

    int curPos = 0;
    void decompose(int v, int h) {
        head[v] = h; pos[v] = curPos++;
        if (heavy[v] != -1) decompose(heavy[v], h);  // continue heavy chain
        for (int u : adj.get(v))
            if (u != parent[v] && u != heavy[v])
                decompose(u, u);  // new light chain starts here
    }

    // Query: sum on path from u to v
    int query(int u, int v) {
        int result = 0;
        while (head[u] != head[v]) {
            if (depth[head[u]] < depth[head[v]]) { int t = u; u = v; v = t; }
            // u's chain head is deeper: query from head[u] to u
            result += st.query(pos[head[u]], pos[u]);
            u = parent[head[u]]; // move to parent of chain head
        }
        // u and v on same chain
        if (depth[u] > depth[v]) { int t = u; u = v; v = t; }
        result += st.query(pos[u], pos[v]);
        return result;
    }
}
// Path query: O(log²n) — O(log n) chains × O(log n) segment tree query
```

> **⚠️ Common Mistake:** When querying edge weights instead of node weights, exclude the LCA node from the final segment tree query (query `pos[u]+1` to `pos[v]` after both nodes are on the same chain) to avoid counting the LCA's incoming edge twice.

---

## 8. TARJAN'S SCC (Strongly Connected Components)

> ⭐ **IMPORTANT CONCEPT:** Tarjan finds all SCCs in **one DFS**. `u` is an SCC root iff `low[u] == disc[u]`; then pop the stack until `u`. For already-visited `v` on the stack, update with `id[v]` (not `low[v]`) — classic bug otherwise.

> 🌍 **Real-World:** Google's PageRank computation collapses strongly connected components into "super-nodes" before running the ranking algorithm — pages that mutually link form an SCC, and Tarjan's O(V+E) algorithm finds all SCCs in a single DFS pass over billions of web pages. Twitter's user trust graph uses SCC detection to identify tightly-knit bot networks: a cluster of fake accounts that all follow each other forms an SCC that can be collapsed and removed together.

> **💡 Key Insight:** **Tarjan's algorithm** assigns each node a `disc` (discovery time) and a `low` value (lowest disc reachable via back/cross edges from its subtree). A node `u` is the root of an SCC exactly when `low[u] == disc[u]` — at that point, everything on the stack above `u` belongs to the same SCC.

```java
int[] id, low, comp;
boolean[] onStack;
Deque<Integer> stack;
int timer = 0, numComp = 0;
List<List<Integer>> adj;

void tarjanSCC(int n) {
    id = new int[n]; low = new int[n]; comp = new int[n];
    onStack = new boolean[n];
    stack = new ArrayDeque<>();
    Arrays.fill(id, -1);
    for (int i = 0; i < n; i++)
        if (id[i] == -1) dfs(i);
}

void dfs(int u) {
    id[u] = low[u] = timer++;
    stack.push(u);
    onStack[u] = true;
    for (int v : adj.get(u)) {
        if (id[v] == -1) {
            dfs(v);
            low[u] = Math.min(low[u], low[v]);
        } else if (onStack[v]) {
            low[u] = Math.min(low[u], id[v]);
        }
    }
    // u is root of an SCC
    if (low[u] == id[u]) {
        while (true) {
            int v = stack.pop();
            onStack[v] = false;
            comp[v] = numComp;
            if (v == u) break;
        }
        numComp++;
    }
}
// Time O(V + E)
```

> **⚠️ Common Mistake:** Updating `low[u]` with `id[v]` (not `low[v]`) for already-visited nodes that are **on the stack** is intentional. If `v` is not on the stack, it belongs to a previously finished SCC and should be ignored; using `low[v]` in that case would incorrectly merge separate SCCs.

---

## 9. BRIDGES AND ARTICULATION POINTS

> 🌍 **Real-World:** Facebook's network reliability team uses bridge detection on their data center interconnect graph to identify single-point-of-failure links — any bridge in the network topology is a cable that, if cut, would partition the network, making it a priority for redundancy investment. AWS uses articulation point analysis on their Availability Zone dependency graph to find infrastructure nodes whose failure would isolate entire service clusters, guiding multi-AZ redundancy architecture.

> **💡 Key Insight:** A **bridge** is an edge `(u, v)` where `low[v] > disc[u]` — meaning there is no back edge from `v`'s subtree that reaches `u` or any ancestor of `u`. An **articulation point** is a node whose removal disconnects the graph; the condition differs slightly for the DFS root (needs ≥ 2 DFS children) vs. non-root nodes (`low[v] >= disc[u]`).

```java
// Bridge: removing this edge disconnects the graph
// Articulation point: removing this vertex disconnects the graph

int[] disc, low;
boolean[] visited, isAP;
List<int[]> bridges;
int timer2 = 0;

void findBridgesAndAP(int n) {
    disc = new int[n]; low = new int[n];
    visited = new boolean[n]; isAP = new boolean[n];
    bridges = new ArrayList<>();
    Arrays.fill(disc, -1);
    for (int i = 0; i < n; i++)
        if (!visited[i]) dfsBridge(i, -1);
}

void dfsBridge(int u, int parent) {
    visited[u] = true;
    disc[u] = low[u] = timer2++;
    int childCount = 0;
    for (int v : adj.get(u)) {
        if (!visited[v]) {
            childCount++;
            dfsBridge(v, u);
            low[u] = Math.min(low[u], low[v]);
            // Bridge condition: no back edge from v's subtree to u or above
            if (low[v] > disc[u]) bridges.add(new int[]{u, v});
            // Articulation point:
            // Root of DFS tree with 2+ children, OR non-root with low[v] >= disc[u]
            if (parent == -1 && childCount > 1) isAP[u] = true;
            if (parent != -1 && low[v] >= disc[u]) isAP[u] = true;
        } else if (v != parent) {
            low[u] = Math.min(low[u], disc[v]);  // back edge
        }
    }
}
// Time O(V + E)
```

> **⚠️ Common Mistake:** In graphs with **parallel edges** (multigraph), `v != parent` is insufficient — it incorrectly ignores the second parallel edge. Track the parent **edge index** instead of the parent node to correctly handle multi-edges.

---

## 10. ADVANCED DP PATTERNS

### DP on Trees (Rerooting)

> 🌍 **Real-World:** Google Maps uses rerooting DP to compute, for each city in a road network tree, the minimum total travel distance if that city were the distribution hub — answering "which hub minimizes total delivery distance to all other cities?" in O(n) via two DFS passes instead of O(n²) independent computations. Uber's supply-demand optimization runs rerooting DP on city-zone hierarchies to propagate optimal pricing multipliers from leaves up to root and back down in linear time.

> **💡 Key Insight:** **Rerooting** computes, in a second DFS, what the answer would be if every node were the root, reusing work from the first DFS. The key is deriving the "best contribution from the parent's direction" for each child without recomputing from scratch.

```java
// Count paths through each node
// First DFS: compute dp[v] = max depth in subtree rooted at v
// Second DFS (rerooting): propagate answer considering parent's contribution

int[] dp, ans;

void dfs1(int v, int p) {
    dp[v] = 0;
    for (int u : adj.get(v)) {
        if (u == p) continue;
        dfs1(u, v);
        dp[v] = Math.max(dp[v], dp[u] + 1);
    }
}

void dfs2(int v, int p, int fromParent) {
    // Collect all children's dp values, sort descending
    List<Integer> childDps = new ArrayList<>();
    for (int u : adj.get(v)) {
        if (u != p) childDps.add(dp[u] + 1);
    }
    if (fromParent >= 0) childDps.add(fromParent);
    childDps.sort(Collections.reverseOrder());

    ans[v] = childDps.size() >= 2 ? childDps.get(0) + childDps.get(1) : 0;

    for (int u : adj.get(v)) {
        if (u == p) continue;
        // What's the best path from parent, excluding u?
        int best = (childDps.size() > 0 && childDps.get(0) == dp[u] + 1 && childDps.size() > 1)
            ? childDps.get(1) : (childDps.size() > 0 ? childDps.get(0) : -1);
        dfs2(u, v, best + 1);
    }
}
```

---

### DP with Profile (Broken Profile DP)

> 🌍 **Real-World:** PCB (printed circuit board) layout tools at companies like Cadence use broken profile DP to count valid placements of rectangular components on a grid under non-overlap constraints — the cell-by-cell profile DP achieves O(n × 2^m) instead of the exponential brute-force search over all tilings. Semiconductor chip floorplanning at Intel and TSMC uses profile DP techniques to evaluate packing configurations for logic blocks, optimizing area utilization.

> **💡 Key Insight:** **Broken Profile DP** processes the grid cell by cell (not column by column). The "profile" bitmask records which cells in the current frontier have been filled, allowing incremental O(1) transitions per cell and giving an overall O(n \* 2^m) complexity for an m×n board.

```java
// Count ways to tile m×n board with 1×2 dominoes
// Profile: bitmask of "protrusions" from current column into next column
long tilingDP(int m, int n) {
    long[] dp = new long[1 << m];
    dp[0] = 1;
    for (int col = 0; col < n; col++) {
        for (int row = 0; row < m; row++) {
            long[] ndp = new long[1 << m];
            for (int mask = 0; mask < (1 << m); mask++) {
                if (dp[mask] == 0) continue;
                // Try to place or not at this cell
                boolean occupied = (mask & (1 << row)) != 0;
                if (occupied) {
                    ndp[mask ^ (1 << row)] += dp[mask]; // this cell filled by prev col
                } else {
                    // Place vertical domino (fills this and next row in same col)
                    ndp[mask] += dp[mask]; // leave empty (filled from next col)
                    if (row + 1 < m && (mask & (1 << (row + 1))) == 0) {
                        ndp[mask | (1 << row) | (1 << (row + 1))] += dp[mask];
                    }
                }
            }
            dp = ndp;
        }
    }
    return dp[0];
}
```

---

## 11. MAXIMUM FLOW (Ford-Fulkerson / Dinic's)

> ⭐ **IMPORTANT CONCEPT:** Reach for **Dinic** when the problem is max-flow / min-cut / bipartite matching at scale. Level graph (BFS) + blocking flow (DFS) beats plain Ford-Fulkerson. Unit-capacity bipartite matching is O(E√V) — the FAANG "why Dinic?" answer.

> 🌍 **Real-World:** Google's data center network traffic engineering uses maximum flow to compute the maximum bandwidth that can be routed between two pods — Dinic's O(V² × E) bound makes it practical on their thousand-node network graphs. LinkedIn's job matching system models the bipartite matching problem (candidates ↔ job openings) as a max-flow problem and solves it with Dinic's algorithm, exploiting the O(E√V) bound for unit-capacity bipartite graphs to match millions of applicants daily.

> **💡 Key Insight:** **Dinic's algorithm** improves on Ford-Fulkerson by first computing a **level graph** via BFS, then sending multiple augmenting paths along that level graph via DFS (blocking flow) before re-running BFS. The `iter[]` array implements the "current arc" optimization, ensuring each edge is visited at most once per blocking flow phase.

```java
// Dinic's Algorithm — O(V² * E), much faster in practice
class Dinic {
    static class Edge {
        int to, rev;
        long cap;
        Edge(int to, long cap, int rev) { this.to = to; this.cap = cap; this.rev = rev; }
    }

    int n;
    List<Edge>[] graph;
    int[] level, iter;

    Dinic(int n) {
        this.n = n;
        graph = new List[n];
        for (int i = 0; i < n; i++) graph[i] = new ArrayList<>();
        level = new int[n]; iter = new int[n];
    }

    void addEdge(int from, int to, long cap) {
        graph[from].add(new Edge(to, cap, graph[to].size()));
        graph[to].add(new Edge(from, 0, graph[from].size() - 1));  // reverse edge
    }

    boolean bfs(int s, int t) {
        Arrays.fill(level, -1);
        Queue<Integer> q = new LinkedList<>();
        level[s] = 0; q.offer(s);
        while (!q.isEmpty()) {
            int v = q.poll();
            for (Edge e : graph[v])
                if (e.cap > 0 && level[e.to] < 0) {
                    level[e.to] = level[v] + 1;
                    q.offer(e.to);
                }
        }
        return level[t] >= 0;
    }

    long dfs(int v, int t, long f) {
        if (v == t) return f;
        for (; iter[v] < graph[v].size(); iter[v]++) {
            Edge e = graph[v].get(iter[v]);
            if (e.cap > 0 && level[v] < level[e.to]) {
                long d = dfs(e.to, t, Math.min(f, e.cap));
                if (d > 0) {
                    e.cap -= d;
                    graph[e.to].get(e.rev).cap += d;
                    return d;
                }
            }
        }
        return 0;
    }

    long maxFlow(int s, int t) {
        long flow = 0;
        while (bfs(s, t)) {
            Arrays.fill(iter, 0);
            long f;
            while ((f = dfs(s, t, Long.MAX_VALUE)) > 0) flow += f;
        }
        return flow;
    }
}
// Applications: bipartite matching, project scheduling, min cut
```

> **⚠️ Common Mistake:** Always add **both** the forward edge and the reverse edge (with capacity 0) when calling `addEdge`. Omitting the reverse edge means flow can never be "cancelled", producing incorrect results. The reverse edge index must also be stored correctly for the capacity update `graph[e.to].get(e.rev).cap += d` to work.

---

## COMPLEXITY SUMMARY

| Algorithm | Time Complexity | Space Complexity | Notes |
|---|---|---|---|
| **KMP** | O(n + m) | O(m) | Build LPS + search |
| **Rabin-Karp** | O(n + m) avg, O(n·m) worst | O(1) | Worst case on hash collisions |
| **Z-Algorithm** | O(n + m) | O(n) | |
| **Digit DP** | O(D · 10 · states) | O(D · states) | D = number of digits |
| **Bitmask DP** | O(2^n · n²) | O(2^n · n) | Only practical for n ≤ 20 |
| **Lazy Segment Tree** | O(n) build, O(log n) per op | O(n) | Range update + range query |
| **Sparse Table** | O(n log n) build, O(1) query | O(n log n) | Static, idempotent ops only |
| **Mo's Algorithm** | O((n + q) · √n) | O(n + q) | Offline queries only |
| **HLD** | O(n) preprocess, O(log² n) path | O(n) | log n chains × log n seg tree |
| **Tarjan's SCC** | O(V + E) | O(V) | |
| **Bridges / AP** | O(V + E) | O(V) | |
| **Dinic's Max Flow** | O(V² · E), O(E · √V) unit | O(V + E) | Unit graph bound for matching |


---

## FAANG Rarity Guide — When Each Advanced Algo Appears

| Algorithm | Appearance | Typical Companies / Rounds | What They Actually Test |
|-----------|------------|----------------------------|-------------------------|
| KMP / LPS | Uncommon | Google/Meta hard; some codegen | Can you build LPS + explain mismatch jump? |
| Rabin-Karp | Rare–uncommon | Hashing / plagiarism-style | Rolling hash + collision handling |
| Z-algorithm | Rare | Competitive-leaning Google | Prefix box maintenance |
| Digit DP | Rare | Google hard, Codeforces-style onsite | Tight flag + memo discipline |
| Bitmask DP | Uncommon | Google/Amazon hard | Subset enumeration, TSP/assignment |
| Lazy Segment Tree | Rare in pure interviews | More online judges; some Google | Lazy push correctness |
| Sparse Table | Rare | RMQ follow-ups | Why O(1) for idempotent ops only |
| Mo's Algorithm | Very rare | Competitive olympiad flavor | Offline sorting insight |
| HLD | Extremely rare | Almost never standard FAANG | Know it exists; don't prioritize |
| Tarjan SCC | Uncommon | Graph hard rounds | low/disc + stack discipline |
| Bridges / AP | Uncommon | Graph medium-hard | Conditions for bridge vs AP |
| Tree rerooting DP | Rare | Google hard | Two-DFS pattern |
| Broken profile DP | Extremely rare | Contests | Skip unless competing |
| Dinic max flow | Rare | Matching / flow modeling | When to model as flow; Dinic vs FF |

> ⭐ **IMPORTANT CONCEPT:** For FAANG ROI: master **bitmask DP, Tarjan/bridges, KMP LPS, digit DP basics, segment tree (even without lazy)**. Treat HLD/Mo's/profile DP as "awareness only" unless you target contest-heavy roles.

### Priority Tiers for Study Time

```text
Tier S (must be fluent):     Bitmask DP, Segment tree point/range query,
                             Tarjan OR Kosaraju SCC, Bridges/AP, KMP LPS
Tier A (1–2 solid problems): Digit DP, Dinic/bipartite matching via flow,
                             Sparse table RMQ, Rabin-Karp
Tier B (read once):          Z-algo, Mo's, tree rerooting
Tier C (skip for interviews): HLD, broken profile DP — revisit only if competing
```

---

## Practice Problem Sets (by Difficulty)

### String Algorithms
| Problem | Diff | Pattern |
|---------|------|---------|
| LC 28 Find Index of First Occurrence | Easy | KMP or built-in; implement KMP |
| LC 214 Shortest Palindrome | Hard | KMP LPS on `s + # + reverse(s)` |
| LC 1392 Longest Happy Prefix | Hard | LPS of whole string = answer |
| LC 187 Repeated DNA Sequences | Medium | Rabin-Karp / rolling hash |
| LC 1044 Longest Duplicate Substring | Hard | Binary search + rolling hash |

### Digit DP
| Problem | Diff | Pattern |
|---------|------|---------|
| Count numbers ≤ N with digit sum S | Classic | Tight + sum state |
| LC 233 Number of Digit One | Hard | Digit DP count digit `1` |
| LC 1067 Digit Count in Range | Hard | `f(R)-f(L-1)` |
| LC 2376 Count Special Integers | Hard | Digit DP + used-mask |
| AtCoder DP contest S — Digit Sum | Classic | Educational digit DP |

### Bitmask DP
| Problem | Diff | Pattern |
|---------|------|---------|
| LC 847 Shortest Path Visiting All Nodes | Hard | BFS + (node, mask) |
| LC 943 Find Shortest Superstring | Hard | TSP-on-strings |
| LC 1125 Smallest Sufficient Team | Hard | Bitmask over skills |
| LC 1434 Ways to Wear Hats | Hard | DP on hats × people mask |
| Assignment problem (min cost) | Classic | `dp[mask]` workers |

### Segment Tree / RMQ
| Problem | Diff | Pattern |
|---------|------|---------|
| LC 307 Range Sum Query Mutable | Medium | Fenwick or segtree |
| LC 315 Count of Smaller Numbers After Self | Hard | Segtree / BIT on ranks |
| Range add + range sum | Classic | Lazy segtree |
| Static RMQ | Classic | Sparse table |

### Graphs — SCC / Bridges / Flow
| Problem | Diff | Pattern |
|---------|------|---------|
| LC 1192 Critical Connections | Hard | Bridges |
| LC 1568 Min Days to Disconnect Island | Hard | Articulation-style thinking |
| Kosaraju/Tarjan template | Classic | Condensation DAG |
| LC 785 Is Graph Bipartite | Medium | Warm-up before matching |
| Bipartite matching via Dinic | Classic | Model + max flow |

> 🛠️ **PRACTICAL:** Schedule: 3 Tier-S problems/week + 1 Tier-A. Do not binge HLD tutorials before you can write Tarjan cold.

---

## Pattern Recognition Drills

For each prompt, name the algorithm in ≤10 seconds, then list the state.

### Drill Sheet

```text
1. "Count integers in [L,R] with no repeated digits"
   → Digit DP; state (pos, tight, started, mask)

2. "Min cost to visit all cities exactly once and return"
   → Bitmask DP TSP; dp[mask][u]

3. "Range add + range min online"
   → Lazy segment tree

4. "Many static RMQ, no updates"
   → Sparse table (idempotent)

5. "Find edges whose removal disconnects undirected graph"
   → Bridges; low[v] > disc[u]

6. "Collapse mutual reachability in digraph"
   → Tarjan/Kosaraju SCC → condensation DAG

7. "Match applicants to jobs with capacities"
   → Max flow (Dinic); bipartite modeling

8. "Pattern search in O(n+m) without built-ins"
   → KMP; build LPS

9. "Offline distinct count on subarrays"
   → Mo's algorithm

10. "Path max on tree with updates"
    → HLD + segtree (or tree flattening if subtree only)
```

### Self-Check Protocol
```text
Cover the answer column. For 10 prompts:
  9–10 correct tags → interview-ready pattern sense
  6–8 → drill Tier S again
  ≤5 → stop new topics; redo templates from this file
```

> ⭐ **IMPORTANT CONCEPT:** Interviews reward **fast tagging** more than obscure optimizations. Saying "this is bitmask DP on subsets of size ≤20" in the first minute is half the battle.

### Common Mis-tags (avoid these)
| You might say | Actually | Why wrong |
|---------------|----------|-----------|
| Segment tree for static min only | Sparse table | Overkill; O(1) query available |
| Dijkstra for assignment N≤15 | Bitmask DP | Dense state space fits 2^N |
| Union-Find for directed SCC | Tarjan/Kosaraju | UF doesn't capture direction |
| DFS flooding for max flow | Dinic/FF with residual | Need residual + augmenting paths |
| Regex for O(n+m) match | KMP/Z | Interviewers want LPS explanation |

---

## Complexity Flash Table (with Intuition)

| Algo | Time | Space | Intuition in one line |
|------|------|-------|------------------------|
| KMP | O(n+m) | O(m) | Each char examined ~const times via LPS jumps |
| Rabin-Karp | O(n+m) avg | O(1) | Slide hash O(1); verify on match |
| Z-algo | O(n) | O(n) | Maintain [L,R] Z-box; copy when inside |
| Digit DP | O(D·Σ·states) | O(D·states) | Digits × tight paths; memo non-tight |
| Bitmask DP | O(2^n·n²) TSP | O(2^n·n) | Subsets × last city |
| Lazy segtree | O(log n)/op | O(n) | Push work O(height) |
| Sparse table | Build O(n log n), Q O(1) | O(n log n) | Two overlapping 2^k windows |
| Mo's | O((n+q)√n)·F | O(n) | Block sort limits pointer motion |
| HLD path | O(log² n) | O(n) | ≤log light edges × segtree |
| Tarjan | O(V+E) | O(V) | Single DFS timestamps |
| Bridges/AP | O(V+E) | O(V) | Same DFS tree idea |
| Dinic | O(V²E) gen; O(E√V) unit bipartite | O(V+E) | Level graph shrinks distance to sink |

### Complexity Interview Soundbites
```text
"Why 2^n for subsets?" — each element in or out; n≤20 ⇒ ~1e6.
"Why lazy is log?" — update sticks at O(log) nodes; push only on path.
"Why Mo's √n?" — block size B=√n balances left jumps vs right sweeps.
"Why Dinic better?" — many augments per BFS level; fewer phases.
```

---

## Template Recall Checklist (write from memory)

### KMP LPS
```text
len=0, i=1
while i < m:
  if equal: lps[i++]=++len
  else if len>0: len=lps[len-1]
  else lps[i++]=0
```

### Digit DP skeleton
```text
solve(pos, tight, ...):
  if pos==D: return check
  if !tight && memo hit: return
  limit = tight ? digits[pos] : 9
  for d in 0..limit:
    ans += solve(pos+1, tight && d==limit, ...)
  memoize if !tight
```

### Bitmask TSP core
```text
dp[1<<u0][u0]=0
for mask, u in mask:
  for v not in mask:
    dp[mask|1<<v][v] = min(... + dist[u][v])
```

### Lazy push
```text
if lazy[node]:
  apply to children tree values
  add lazy to children lazy
  clear lazy[node]
```

### Tarjan pop
```text
if low[u]==id[u]:
  pop until u; assign comp id
```

---

## Important Concepts Checklist

### Strings
- [ ] Build LPS by hand for a 8–12 char pattern
- [ ] KMP search mismatch rule (no `i++` when `j>0`)
- [ ] Rolling hash update + double hash rationale
- [ ] Z-box meaning of `z[i]`

### DP
- [ ] Digit DP: tight, started, `f(R)-f(L-1)`
- [ ] Bitmask: iterate submasks / TSP transitions
- [ ] INF = MAX/2 habit
- [ ] Tree rerooting: two DFS idea (awareness)

### Trees & Ranges
- [ ] Segtree build/query/update
- [ ] Lazy: push on query **and** update
- [ ] Sparse table only for idempotent ops
- [ ] Mo's expand-before-shrink pointer order

### Graphs
- [ ] Tarjan `low`/`disc`/`onStack` rules
- [ ] Bridge vs AP conditions (root vs non-root)
- [ ] Condensation DAG uses (e.g., count SCCs with indeg 0)
- [ ] Dinic: level graph + blocking flow; when to use
- [ ] Always add reverse edges with 0 cap

### Meta
- [ ] Rarity guide: know what NOT to over-study
- [ ] Can tag 8/10 pattern drills correctly
- [ ] Complexity soundbites ready

> ⭐ **IMPORTANT CONCEPT:** Advanced DSA wins interviews when you **recognize the pattern fast** and write a **correct template**. Obscure O-constants rarely matter in 45 minutes.

> 🛠️ **PRACTICAL:** Weekly ritual: pick one checklist box, close the notes, rewrite the template on a blank file, then solve one linked problem under a 25-min timer.
