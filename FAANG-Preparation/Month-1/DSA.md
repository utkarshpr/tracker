# DSA — Complete Study Notes (Patterns + Java Code + Complexity)

Self-contained. No internet needed. All code in Java.

**Reference Sheet**: https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z

---

## Table of Contents

- [Complexity Cheat Sheet](#complexity-cheat-sheet)
- [Week 1 — Arrays and Hashing](#week-1--arrays-and-hashing)
  - [Prefix Sum](#prefix-sum)
  - [Sliding Window](#sliding-window)
  - [Two Pointers](#two-pointers)
  - [Kadane's Algorithm](#kadanes-algorithm-maximum-subarray--lc-53)
  - [Monotonic Stack](#monotonic-stack)
  - [Cyclic Sort](#cyclic-sort)
  - [Binary Search](#binary-search)
- [Week 2 — Linked List, Stack, Queue](#week-2--linked-list-stack-queue)
  - [Fast/Slow Pointer (Floyd's Algorithm)](#fastslow-pointer-floyds-algorithm)
  - [LRU Cache](#lru-cache-lc-146)
  - [LFU Cache](#lfu-cache-lc-460)
- [Week 3 — Trees and Heaps](#week-3--trees-and-heaps)
  - [Tree Traversals](#tree-traversals)
  - [BST Operations](#bst-operations)
  - [Heap / Priority Queue](#heap--priority-queue)
  - [Segment Tree](#segment-tree)
  - [Fenwick Tree (BIT)](#fenwick-tree-bit)
  - [Trie](#trie)
- [Week 4 — Graphs and DP](#week-4--graphs-and-dp)
  - [Graph Setup](#graph-setup)
  - [BFS (Shortest Path in Unweighted Graph)](#bfs-shortest-path-in-unweighted-graph)
  - [Topological Sort (Kahn's BFS)](#topological-sort-kahns-bfs)
  - [Dijkstra's Algorithm](#dijkstras-algorithm)
  - [Union-Find (Disjoint Set)](#union-find-disjoint-set)
- [Dynamic Programming Patterns](#dynamic-programming-patterns)
  - [0/1 Knapsack](#01-knapsack)
  - [Coin Change — Unbounded Knapsack](#coin-change-lc-322--unbounded-knapsack)
  - [LCS and Edit Distance](#lcs-and-edit-distance)
  - [LIS — O(n log n)](#lis--on-log-n)
  - [Interval DP — Burst Balloons](#interval-dp--burst-balloons-lc-312)
  - [Stock Problems — State Machine DP](#stock-problems--state-machine-dp)
- [Backtracking Template](#backtracking-template)
- [Interval Problems](#interval-problems)
- [Bit Manipulation](#bit-manipulation)
- [Key Patterns Quick Reference](#key-patterns-quick-reference)
- [Striver's A2Z Sheet — Problem List by Topic](#strivers-a2z-sheet--problem-list-by-topic)
  - [Step 1: Learn the Basics (54)](#step-1-learn-the-basics-54-problems)
  - [Step 2: Sorting (7)](#step-2-sorting-techniques-7-problems)
  - [Step 3: Arrays (40)](#step-3-arrays-40-problems)
  - [Step 4: Binary Search (32)](#step-4-binary-search-32-problems)
  - [Step 5: Strings (15)](#step-5-strings-15-problems)
  - [Step 6: Linked List (31)](#step-6-linked-list-31-problems)
  - [Step 7: Recursion & Backtracking (25)](#step-7-recursion--backtracking-25-problems)
  - [Step 8: Bit Manipulation (18)](#step-8-bit-manipulation-18-problems)
  - [Step 9: Stack and Queues (30)](#step-9-stack-and-queues-30-problems)
  - [Step 10: Sliding Window & Two Pointer (12)](#step-10-sliding-window--two-pointer-12-problems)
  - [Step 11: Heaps (17)](#step-11-heaps-17-problems)
  - [Step 12: Greedy Algorithms (15)](#step-12-greedy-algorithms-15-problems)
  - [Step 13: Binary Trees (38)](#step-13-binary-trees-38-problems)
  - [Step 14: Binary Search Trees (16)](#step-14-binary-search-trees-16-problems)
  - [Step 15: Graphs (53)](#step-15-graphs-53-problems)
  - [Step 16: Dynamic Programming (55)](#step-16-dynamic-programming-55-problems)
  - [Step 17: Tries (7)](#step-17-tries-7-problems)
  - [Step 18: Advanced Strings (9)](#step-18-advanced-strings-9-problems)
  - [FAANG Must-Solve List](#faang-must-solve-list)

---

## COMPLEXITY CHEAT SHEET

> ⭐ **IMPORTANT CONCEPT:** Know these complexities cold — interviewers expect you to state time/space before coding.

```text
O(1)       — Hash table lookup, array index access
O(log n)   — Binary search, balanced BST, heap push/pop
O(n)       — Single scan, prefix sum build
O(n log n) — Sort, heap build from array, merge sort
O(n²)      — Nested loops (brute force)
O(2ⁿ)      — Subsets, exponential DP
O(n!)      — Permutations

Space:
O(1)       — Two pointers on array (no extra structure)
O(n)       — Recursion stack depth n, hash map of n elements
O(n²)      — 2D DP table
```

> 🌍 **Real-World:** Google's core search infrastructure operates at near-O(1) per query by pre-building inverted hash indexes mapping every keyword to a list of document IDs — the entire query path avoids O(n) scans at serving time. LinkedIn's feed ranking pipeline uses O(n log n) sorts on scoring vectors millions of times per second, making the constant factor behind "n log n" a first-class engineering concern.

---

## WEEK 1 — ARRAYS AND HASHING

> ⭐ **IMPORTANT CONCEPT:** Arrays + hashing patterns (prefix sum, sliding window, two pointers) appear in a large share of FAANG Medium rounds.

---

### Prefix Sum

> 🌍 **Real-World:** Amazon uses prefix sums on time-series sales data to compute rolling revenue windows in O(1) per query after an O(n) build pass — the same technique powers their real-time inventory dashboards. Google Analytics applies prefix sums to page-view event arrays to answer "total views between date A and date B" across billions of rows without re-scanning.

> **💡 Pattern Recognition:** Use **Prefix Sum** when you need repeated range sum queries on a static array, or when searching for a subarray whose sum equals a target value k.

> **⚠️ Common Mistake:** Off-by-one errors are common — `prefix[i+1] = prefix[i] + arr[i]` means `prefix[0] = 0` (empty prefix). Range sum `arr[l..r]` is `prefix[r+1] - prefix[l]`, not `prefix[r] - prefix[l-1]`.

> **📊 Complexity:** Build O(n) time, O(n) space. Each range query O(1) after build.

**When to use**: range sum queries, subarray problems asking for sum = k.

```java
// Build prefix sum
int[] buildPrefix(int[] arr) {
    int n = arr.length;
    int[] prefix = new int[n + 1];
    for (int i = 0; i < n; i++)
        prefix[i + 1] = prefix[i] + arr[i];
    return prefix;
}

// Sum of arr[l..r] inclusive
int rangeSum(int[] prefix, int l, int r) {
    return prefix[r + 1] - prefix[l];
}

// Subarray Sum Equals K (LC 560)
int subarraySum(int[] nums, int k) {
    int count = 0, prefix = 0;
    Map<Integer, Integer> seen = new HashMap<>();
    seen.put(0, 1);
    for (int n : nums) {
        prefix += n;
        count += seen.getOrDefault(prefix - k, 0);
        seen.put(prefix, seen.getOrDefault(prefix, 0) + 1);
    }
    return count;
}
// Time O(n), Space O(n)
```

---

### Sliding Window

> 🌍 **Real-World:** Netflix uses a sliding window over real-time viewer event streams to detect binge-watching sessions — the window tracks contiguous playback events and updates engagement metrics without reprocessing the full history. Cloudflare's DDoS rate-limiter counts requests in a sliding time window per IP address, evicting old events as the window advances to enforce per-second thresholds in O(1) amortized time.

> **💡 Pattern Recognition:** Use **Sliding Window** for problems involving a contiguous subarray or substring that must satisfy some constraint (max length, min length, exactly k distinct characters, etc.). If the problem says "contiguous" and has a constraint, think sliding window first.

> **⚠️ Common Mistake:** For variable windows, when shrinking from the left after a violation, remember to update your window's state (e.g., update the map count) before advancing `left`. Also, in the fixed-window pattern, don't forget to initialize the first window before the main loop.

> **📊 Complexity:** O(n) time (each element enters and leaves the window at most once), O(k) space for the auxiliary map/set where k is the alphabet/window size.

**When to use**: contiguous subarray/substring with a constraint.

```java
// Fixed window — max sum of k elements
int maxSumK(int[] arr, int k) {
    int windowSum = 0;
    for (int i = 0; i < k; i++) windowSum += arr[i];
    int maxSum = windowSum;
    for (int i = k; i < arr.length; i++) {
        windowSum += arr[i] - arr[i - k];
        maxSum = Math.max(maxSum, windowSum);
    }
    return maxSum;
}

// Variable window — longest substring without repeating characters (LC 3)
int lengthOfLongestSubstring(String s) {
    Map<Character, Integer> map = new HashMap<>();
    int left = 0, result = 0;
    for (int right = 0; right < s.length(); right++) {
        char c = s.charAt(right);
        if (map.containsKey(c))
            left = Math.max(left, map.get(c) + 1);
        map.put(c, right);
        result = Math.max(result, right - left + 1);
    }
    return result;
}

// Minimum Window Substring (LC 76)
String minWindow(String s, String t) {
    int[] need = new int[128];
    for (char c : t.toCharArray()) need[c]++;
    int left = 0, missing = t.length();
    int start = 0, minLen = Integer.MAX_VALUE;
    for (int right = 0; right < s.length(); right++) {
        if (need[s.charAt(right)]-- > 0) missing--;
        while (missing == 0) {
            if (right - left + 1 < minLen) {
                minLen = right - left + 1;
                start = left;
            }
            if (need[s.charAt(left++)]++ == 0) missing++;
        }
    }
    return minLen == Integer.MAX_VALUE ? "" : s.substring(start, start + minLen);
}
```

---

### Two Pointers

> 🌍 **Real-World:** Spotify's deduplication pipeline uses two pointers on sorted play-history arrays to merge and deduplicate song entries in O(n) without allocating extra hash maps — critical when handling hundreds of millions of user records. Facebook's friend-suggestion system uses a two-pointer intersection on sorted follower lists to compute mutual friends in linear time per pair of users.

> **💡 Pattern Recognition:** Use **Two Pointers** on sorted arrays when you need to find a pair (or triple) summing to a target, or when you need to partition an array in-place. If the array is not sorted and sorting is allowed, sort first then apply two pointers.

> **⚠️ Common Mistake:** In 3Sum, after finding a valid triplet you must advance both pointers AND skip duplicates for both `l` and `r` before the next iteration. Skipping only one side leaves duplicate triplets in the result.

> **📊 Complexity:** O(n) for pair problems after sorting. O(n²) for 3Sum (O(n log n) sort + O(n) inner scan per outer element). O(1) extra space.

**When to use**: sorted array, pair sum, partitioning.

```java
// Two Sum in sorted array
int[] twoSumSorted(int[] arr, int target) {
    int l = 0, r = arr.length - 1;
    while (l < r) {
        int s = arr[l] + arr[r];
        if (s == target) return new int[]{l, r};
        else if (s < target) l++;
        else r--;
    }
    return new int[]{};
}

// Container With Most Water (LC 11)
int maxWater(int[] height) {
    int l = 0, r = height.length - 1, maxArea = 0;
    while (l < r) {
        maxArea = Math.max(maxArea, Math.min(height[l], height[r]) * (r - l));
        if (height[l] < height[r]) l++;
        else r--;
    }
    return maxArea;
}

// 3Sum (LC 15)
List<List<Integer>> threeSum(int[] nums) {
    Arrays.sort(nums);
    List<List<Integer>> result = new ArrayList<>();
    for (int i = 0; i < nums.length - 2; i++) {
        if (i > 0 && nums[i] == nums[i - 1]) continue;
        int l = i + 1, r = nums.length - 1;
        while (l < r) {
            int s = nums[i] + nums[l] + nums[r];
            if (s == 0) {
                result.add(Arrays.asList(nums[i], nums[l], nums[r]));
                while (l < r && nums[l] == nums[l + 1]) l++;
                while (l < r && nums[r] == nums[r - 1]) r--;
                l++; r--;
            } else if (s < 0) l++;
            else r--;
        }
    }
    return result;
}
```

---

### Kadane's Algorithm (Maximum Subarray — LC 53)

> 🌍 **Real-World:** Robinhood applies Kadane's algorithm to detect the highest-gain trading window in a price series — the maximum subarray sum corresponds to the optimal single buy-sell interval. Financial risk systems at JPMorgan use the same pattern to find the worst consecutive drawdown period (minimum subarray) in portfolio returns.

> **💡 Pattern Recognition:** Use **Kadane's Algorithm** whenever you need the maximum (or minimum) sum contiguous subarray. It is the go-to O(n) solution and is the basis for many harder subarray DP problems.

> **⚠️ Common Mistake:** Initialize `maxSum` and `curr` to `nums[0]`, not `0`. Initializing to `0` gives the wrong answer when all elements are negative.

> **📊 Complexity:** O(n) time, O(1) space.

```java
int maxSubarray(int[] nums) {
    int maxSum = nums[0], curr = nums[0];
    for (int i = 1; i < nums.length; i++) {
        curr = Math.max(nums[i], curr + nums[i]);
        maxSum = Math.max(maxSum, curr);
    }
    return maxSum;
}
```

---

### Monotonic Stack

> 🌍 **Real-World:** Amazon's warehouse slotting system uses a monotonic stack to compute the "next larger item" visibility problem in 3D shelf layouts — equivalent to the histogram/span problem. Trading platforms like Citadel use monotonic stacks to build real-time stock span indicators (how many consecutive days the price was below today's price) in O(n) over streaming tick data.

> **💡 Pattern Recognition:** Use a **Monotonic Stack** when you need to find the next/previous greater or smaller element for each index. If the problem involves histogram bars, span calculations, or "how many days until a warmer temperature", reach for a monotonic stack.

> **⚠️ Common Mistake:** In the histogram problem, appending a sentinel `0` to the end of the heights array ensures all remaining bars on the stack are popped and processed. Without the sentinel you must handle the remaining stack after the loop.

> **📊 Complexity:** O(n) time — each element is pushed and popped at most once. O(n) space for the stack.

**When to use**: next greater/smaller element, histogram, span problems.

```java
// Next Greater Element
int[] nextGreater(int[] nums) {
    int n = nums.length;
    int[] result = new int[n];
    Arrays.fill(result, -1);
    Deque<Integer> stack = new ArrayDeque<>();  // stores indices
    for (int i = 0; i < n; i++) {
        while (!stack.isEmpty() && nums[stack.peek()] < nums[i])
            result[stack.pop()] = nums[i];
        stack.push(i);
    }
    return result;
}
// Time O(n) — each element pushed/popped at most once

// Largest Rectangle in Histogram (LC 84)
int largestRectangle(int[] heights) {
    Deque<Integer> stack = new ArrayDeque<>();
    int maxArea = 0;
    int[] h = Arrays.copyOf(heights, heights.length + 1); // append 0 as sentinel
    for (int i = 0; i < h.length; i++) {
        while (!stack.isEmpty() && h[stack.peek()] > h[i]) {
            int height = h[stack.pop()];
            int width = stack.isEmpty() ? i : i - stack.peek() - 1;
            maxArea = Math.max(maxArea, height * width);
        }
        stack.push(i);
    }
    return maxArea;
}

// Daily Temperatures (LC 739)
int[] dailyTemperatures(int[] temps) {
    int[] result = new int[temps.length];
    Deque<Integer> stack = new ArrayDeque<>();
    for (int i = 0; i < temps.length; i++) {
        while (!stack.isEmpty() && temps[stack.peek()] < temps[i]) {
            int j = stack.pop();
            result[j] = i - j;
        }
        stack.push(i);
    }
    return result;
}
```

---

### Cyclic Sort

> 🌍 **Real-World:** Database systems like PostgreSQL use a cyclic-sort-like placement strategy when assigning auto-increment IDs to rows — detecting gaps (missing IDs) in a compact range is equivalent to the missing-number problem cyclic sort solves in O(n) time and O(1) space.

> **💡 Pattern Recognition:** Use **Cyclic Sort** when the problem involves an array containing numbers in the range `[1, N]` (or `[0, N]`) and asks to find missing, duplicate, or misplaced elements. The key insight is that number `x` belongs at index `x-1`.

> **⚠️ Common Mistake:** After sorting, iterate again to find violations — do not try to collect answers during the sort itself, as the array is still being rearranged.

> **📊 Complexity:** O(n) time (at most 2n swaps total), O(1) extra space.

**When to use**: array contains numbers 1 to N, find missing/duplicate.

```java
void cyclicSort(int[] nums) {
    int i = 0;
    while (i < nums.length) {
        int j = nums[i] - 1;
        if (nums[i] != nums[j]) {
            int tmp = nums[i]; nums[i] = nums[j]; nums[j] = tmp;
        } else i++;
    }
}

List<Integer> findMissingNumbers(int[] nums) {  // LC 448
    cyclicSort(nums);
    List<Integer> missing = new ArrayList<>();
    for (int i = 0; i < nums.length; i++)
        if (nums[i] != i + 1) missing.add(i + 1);
    return missing;
}
```

---

### Binary Search

> 🌍 **Real-World:** Google's Spanner distributed database uses binary search on sorted SSTable index files to locate record ranges in O(log n) disk seeks instead of full scans — this is the fundamental operation behind every indexed read across billions of rows. Amazon's fulfillment routing uses "binary search on the answer" to determine the minimum fleet capacity that can ship all packages within a deadline, directly mirroring the Koko Eating Bananas pattern.

> **💡 Pattern Recognition:** Use **Binary Search** on any sorted array for O(log n) search. Also apply it as "binary search on the answer" whenever the problem has a monotonic predicate: if `f(x)` is false for all values below a threshold and true for all values above, binary search finds that threshold.

> **⚠️ Common Mistake:** Use `mid = l + (r - l) / 2` instead of `(l + r) / 2` to avoid integer overflow. For left-bound search, use `l < r` (not `l <= r`) and set `r = mid` (not `mid - 1`) when the condition is met.

> **📊 Complexity:** O(log n) time, O(1) space for iterative implementation.

**When to use**: sorted array OR binary search on answer (monotonic predicate).

```java
int binarySearch(int[] arr, int target) {
    int l = 0, r = arr.length - 1;
    while (l <= r) {
        int mid = l + (r - l) / 2;  // avoid overflow
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) l = mid + 1;
        else r = mid - 1;
    }
    return -1;
}

// First occurrence (left bound)
int leftBound(int[] arr, int target) {
    int l = 0, r = arr.length;
    while (l < r) {
        int mid = (l + r) / 2;
        if (arr[mid] < target) l = mid + 1;
        else r = mid;
    }
    return l;
}

// Binary search on answer — Koko Eating Bananas (LC 875)
int minEatingSpeed(int[] piles, int h) {
    int l = 1, r = Arrays.stream(piles).max().getAsInt();
    while (l < r) {
        int mid = (l + r) / 2;
        if (canFinish(piles, h, mid)) r = mid;
        else l = mid + 1;
    }
    return l;
}
boolean canFinish(int[] piles, int h, int speed) {
    int hours = 0;
    for (int p : piles) hours += (p + speed - 1) / speed;
    return hours <= h;
}
```

---

## WEEK 2 — LINKED LIST, STACK, QUEUE

```java
class ListNode {
    int val;
    ListNode next;
    ListNode(int v) { val = v; }
}
```

---

### Fast/Slow Pointer (Floyd's Algorithm)

> 🌍 **Real-World:** Linux kernel's memory allocator uses cycle detection (conceptually equivalent to Floyd's algorithm) to find circular references in linked free-block lists — an O(1)-space approach that prevents unbounded scans. Java's garbage collector detects reference cycles in object graphs using the same two-pointer principle before reclaiming heap memory.

> **💡 Pattern Recognition:** Use **Fast/Slow Pointers** (Floyd's Tortoise and Hare) for cycle detection, finding the middle of a list, or any problem where you need two runners moving at different speeds through a linear structure.

> **⚠️ Common Mistake:** For cycle start detection (LC 142), after slow and fast meet inside the cycle, reset `slow` to `head` but keep `fast` at the meeting point — then advance both one step at a time. They will meet at the cycle entrance.

> **📊 Complexity:** O(n) time, O(1) space for all fast/slow pointer operations.

```java
// Cycle detection (LC 141)
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}

// Cycle start (LC 142)
ListNode detectCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {
            slow = head;
            while (slow != fast) { slow = slow.next; fast = fast.next; }
            return slow;
        }
    }
    return null;
}

// Middle of list
ListNode findMiddle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}

// Reverse linked list
ListNode reverse(ListNode head) {
    ListNode prev = null, curr = head;
    while (curr != null) {
        ListNode next = curr.next;
        curr.next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

// Reorder List (LC 143)
void reorderList(ListNode head) {
    ListNode mid = findMiddle(head);
    ListNode second = reverse(mid.next);
    mid.next = null;
    ListNode first = head;
    while (second != null) {
        ListNode t1 = first.next, t2 = second.next;
        first.next = second;
        second.next = t1;
        first = t1;
        second = t2;
    }
}
```

---

### LRU Cache (LC 146)

> 🌍 **Real-World:** Facebook's Memcached deployment uses LRU eviction across terabytes of in-memory cache — the same HashMap + doubly-linked-list design ensures O(1) get and set while automatically evicting the least recently accessed objects when memory is full. CPU hardware L1/L2 caches in Intel and AMD processors implement LRU (or pseudo-LRU) at the hardware level to keep the hottest data close to the execution units.

> **💡 Pattern Recognition:** **LRU Cache** combines a HashMap for O(1) lookup with a doubly-linked list for O(1) insertion/deletion of the least-recently-used entry. Use dummy head and tail sentinels to eliminate edge-case null checks.

> **⚠️ Common Mistake:** On a `put` for an existing key, update the value AND move the node to the tail (most recently used). Forgetting to move it on update is a common bug.

> **📊 Complexity:** O(1) amortized for both `get` and `put`. O(capacity) space.

```java
class LRUCache {
    private final int capacity;
    private final Map<Integer, Node> cache = new HashMap<>();
    private final Node head = new Node(), tail = new Node();

    static class Node {
        int key, val;
        Node prev, next;
    }

    LRUCache(int capacity) {
        this.capacity = capacity;
        head.next = tail;
        tail.prev = head;
    }

    private void remove(Node n) {
        n.prev.next = n.next;
        n.next.prev = n.prev;
    }

    private void insertAtTail(Node n) {
        n.prev = tail.prev;
        n.next = tail;
        tail.prev.next = n;
        tail.prev = n;
    }

    public int get(int key) {
        if (!cache.containsKey(key)) return -1;
        Node n = cache.get(key);
        remove(n);
        insertAtTail(n);
        return n.val;
    }

    public void put(int key, int val) {
        if (cache.containsKey(key)) remove(cache.get(key));
        Node n = new Node();
        n.key = key; n.val = val;
        cache.put(key, n);
        insertAtTail(n);
        if (cache.size() > capacity) {
            Node lru = head.next;
            remove(lru);
            cache.remove(lru.key);
        }
    }
}
// Time O(1) get and put
```

---

### LFU Cache (LC 460)

> 🌍 **Real-World:** Akamai's CDN edge servers use LFU-style eviction to retain viral content that has been requested thousands of times, even if it wasn't requested in the last few minutes — pure LRU would incorrectly evict high-frequency content after a brief lull. Redis implements both LRU and LFU eviction policies (configurable via `maxmemory-policy`) for exactly this reason, with LFU preferred for workloads with long-tail access patterns.

> **💡 Pattern Recognition:** **LFU Cache** evicts the least-frequently-used entry (ties broken by least-recently-used). Maintain a `minFreq` counter and a map from frequency to an ordered set of keys at that frequency (`LinkedHashMap` preserves insertion order for LRU tie-breaking).

> **⚠️ Common Mistake:** After incrementing a key's frequency, only update `minFreq` if the old frequency bucket is now empty AND the old frequency equals `minFreq`. On a new `put`, always reset `minFreq = 1`.

> **📊 Complexity:** O(1) for both `get` and `put`. O(capacity) space.

```java
class LFUCache {
    private final int capacity;
    private int minFreq;
    private final Map<Integer, int[]> keyToValFreq = new HashMap<>();  // key → [val, freq]
    private final Map<Integer, LinkedHashMap<Integer, Integer>> freqToKeys = new HashMap<>();

    LFUCache(int capacity) { this.capacity = capacity; }

    private void update(int key) {
        int[] vf = keyToValFreq.get(key);
        int freq = vf[1];
        freqToKeys.get(freq).remove(key);
        if (freq == minFreq && freqToKeys.get(freq).isEmpty()) minFreq++;
        vf[1]++;
        freqToKeys.computeIfAbsent(freq + 1, k -> new LinkedHashMap<>()).put(key, key);
    }

    public int get(int key) {
        if (!keyToValFreq.containsKey(key)) return -1;
        update(key);
        return keyToValFreq.get(key)[0];
    }

    public void put(int key, int value) {
        if (capacity == 0) return;
        if (keyToValFreq.containsKey(key)) {
            keyToValFreq.get(key)[0] = value;
            update(key);
        } else {
            if (keyToValFreq.size() == capacity) {
                int evict = freqToKeys.get(minFreq).keySet().iterator().next();
                freqToKeys.get(minFreq).remove(evict);
                keyToValFreq.remove(evict);
            }
            keyToValFreq.put(key, new int[]{value, 1});
            freqToKeys.computeIfAbsent(1, k -> new LinkedHashMap<>()).put(key, key);
            minFreq = 1;
        }
    }
}
```

---

## WEEK 3 — TREES AND HEAPS

```java
class TreeNode {
    int val;
    TreeNode left, right;
    TreeNode(int v) { val = v; }
}
```

---

### Tree Traversals

> 🌍 **Real-World:** Git uses a post-order DFS traversal of its commit DAG to compute reachability — before deleting objects during garbage collection, it visits children before parents to ensure no live object is removed. React's virtual DOM reconciliation performs a pre-order DFS traversal to diff the component tree, visiting parent nodes before their children so context values propagate correctly downward.

> **💡 Pattern Recognition:** Use **iterative inorder** when you need to avoid stack overflow on deep trees or when you want to pause/resume traversal (e.g., BST iterator). Use **level-order BFS** for anything involving tree levels, minimum depth, or zigzag patterns.

> **⚠️ Common Mistake:** In iterative inorder, the loop condition is `curr != null || !stack.isEmpty()` — both conditions are needed. Using `&&` instead of `||` will terminate early when `curr` becomes null but the stack still has nodes.

> **📊 Complexity:** All traversals O(n) time, O(h) space where h is tree height (O(log n) balanced, O(n) worst-case skewed).

```java
// Iterative inorder (interview-safe)
List<Integer> inorderIterative(TreeNode root) {
    List<Integer> result = new ArrayList<>();
    Deque<TreeNode> stack = new ArrayDeque<>();
    TreeNode curr = root;
    while (curr != null || !stack.isEmpty()) {
        while (curr != null) { stack.push(curr); curr = curr.left; }
        curr = stack.pop();
        result.add(curr.val);
        curr = curr.right;
    }
    return result;
}

// Level order BFS (LC 102)
List<List<Integer>> levelOrder(TreeNode root) {
    List<List<Integer>> result = new ArrayList<>();
    if (root == null) return result;
    Queue<TreeNode> q = new LinkedList<>();
    q.offer(root);
    while (!q.isEmpty()) {
        int size = q.size();
        List<Integer> level = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            TreeNode node = q.poll();
            level.add(node.val);
            if (node.left != null) q.offer(node.left);
            if (node.right != null) q.offer(node.right);
        }
        result.add(level);
    }
    return result;
}
```

---

### BST Operations

> 🌍 **Real-World:** MySQL's InnoDB storage engine uses a B+ tree (a generalized BST) for all indexed columns — range queries like `WHERE age BETWEEN 25 AND 35` exploit BST ordering to scan only the relevant leaf pages in O(log n + k). GitHub's code search uses BSTs internally to store and query sorted token frequencies during indexing, enabling `ceilingKey` / `floorKey` operations for approximate matching.

> **💡 Pattern Recognition:** For **BST validation**, pass down valid `[lo, hi]` bounds rather than only comparing with the parent — this correctly handles ancestors. For **LCA**, use the property that if both nodes are less than root, LCA is in the left subtree; if both are greater, it is in the right subtree.

> **⚠️ Common Mistake:** In validate BST (LC 98), use `long` bounds (`Long.MIN_VALUE`, `Long.MAX_VALUE`) instead of `int` to correctly handle nodes with `Integer.MIN_VALUE` or `Integer.MAX_VALUE` as values.

> **📊 Complexity:** BST validate, LCA, diameter — O(n) time, O(h) space. Serialize/deserialize — O(n) time and space.

```java
// Validate BST (LC 98)
boolean isValidBST(TreeNode root) {
    return validate(root, Long.MIN_VALUE, Long.MAX_VALUE);
}
boolean validate(TreeNode node, long lo, long hi) {
    if (node == null) return true;
    if (node.val <= lo || node.val >= hi) return false;
    return validate(node.left, lo, node.val) && validate(node.right, node.val, hi);
}

// Lowest Common Ancestor (LC 236)
TreeNode lca(TreeNode root, TreeNode p, TreeNode q) {
    if (root == null || root == p || root == q) return root;
    TreeNode left = lca(root.left, p, q);
    TreeNode right = lca(root.right, p, q);
    if (left != null && right != null) return root;
    return left != null ? left : right;
}

// Diameter of Binary Tree (LC 543)
int maxDiameter = 0;
int diameter(TreeNode root) {
    depth(root);
    return maxDiameter;
}
int depth(TreeNode node) {
    if (node == null) return 0;
    int l = depth(node.left), r = depth(node.right);
    maxDiameter = Math.max(maxDiameter, l + r);
    return 1 + Math.max(l, r);
}

// Serialize / Deserialize (LC 297)
String serialize(TreeNode root) {
    if (root == null) return "N,";
    return root.val + "," + serialize(root.left) + serialize(root.right);
}
TreeNode deserialize(String data) {
    Queue<String> q = new LinkedList<>(Arrays.asList(data.split(",")));
    return buildTree(q);
}
TreeNode buildTree(Queue<String> q) {
    String v = q.poll();
    if (v.equals("N")) return null;
    TreeNode node = new TreeNode(Integer.parseInt(v));
    node.left = buildTree(q);
    node.right = buildTree(q);
    return node;
}
```

---

### Heap / Priority Queue

> 🌍 **Real-World:** Uber's trip dispatch uses a min-heap (priority queue) ordered by driver distance to always surface the nearest available driver in O(log n) time as new drivers come online or go offline. Twitter's trending topics pipeline uses a min-heap of size k to maintain the top-k hashtags by frequency across billions of tweets in a single O(n log k) pass — far cheaper than sorting all hashtags.

> **💡 Pattern Recognition:** Use a **min-heap of size k** to track the k largest elements seen so far — the heap top is always the kth largest. Use two heaps (max-heap for the lower half, min-heap for the upper half) for the running median problem.

> **⚠️ Common Mistake:** Java's `PriorityQueue` is a min-heap by default. To get a max-heap, pass `Collections.reverseOrder()` or `(a, b) -> b - a` as the comparator. For the merge-K-lists heap, always check `curr.next != null` before offering the next node.

> **📊 Complexity:** Kth largest — O(n log k). Merge K lists — O(n log k) where n is total nodes. Median finder — O(log n) per add, O(1) per findMedian.

```java
// K-th Largest Element (LC 215) — min-heap of size k
int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> minHeap = new PriorityQueue<>();
    for (int n : nums) {
        minHeap.offer(n);
        if (minHeap.size() > k) minHeap.poll();
    }
    return minHeap.peek();
}
// Time O(n log k)

// Merge K Sorted Lists (LC 23)
ListNode mergeKLists(ListNode[] lists) {
    PriorityQueue<ListNode> heap = new PriorityQueue<>((a, b) -> a.val - b.val);
    for (ListNode node : lists)
        if (node != null) heap.offer(node);
    ListNode dummy = new ListNode(0), curr = dummy;
    while (!heap.isEmpty()) {
        curr.next = heap.poll();
        curr = curr.next;
        if (curr.next != null) heap.offer(curr.next);
    }
    return dummy.next;
}
// Time O(n log k)

// Find Median from Data Stream (LC 295)
class MedianFinder {
    PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Collections.reverseOrder()); // lower half
    PriorityQueue<Integer> minHeap = new PriorityQueue<>();  // upper half

    void addNum(int num) {
        maxHeap.offer(num);
        minHeap.offer(maxHeap.poll());
        if (maxHeap.size() < minHeap.size())
            maxHeap.offer(minHeap.poll());
    }

    double findMedian() {
        if (maxHeap.size() > minHeap.size()) return maxHeap.peek();
        return (maxHeap.peek() + minHeap.peek()) / 2.0;
    }
}
```

---

### Segment Tree

> 🌍 **Real-World:** Codeforces and competitive programming judges use segment trees to evaluate range-min/sum queries with updates in O(log n) inside checker solutions. Riot Games' League of Legends uses segment-tree-style range queries to compute area-of-effect damage over regions of their game map that change every frame — point updates for damage events and range queries for total damage over a zone.

> **💡 Pattern Recognition:** Use a **Segment Tree** when you need both range queries (sum, min, max) AND point updates on a mutable array. If the array is static, a prefix sum is sufficient and simpler.

> **⚠️ Common Mistake:** Allocate `4 * n` nodes for the tree array — using `2 * n` is not always enough for a 1-indexed segment tree due to the way children are indexed at `2*node+1` and `2*node+2`.

> **📊 Complexity:** O(n) build, O(log n) per update and query. O(n) space.

```java
class SegTree {
    int[] tree;
    int n;

    SegTree(int[] nums) {
        n = nums.length;
        tree = new int[4 * n];
        build(nums, 0, 0, n - 1);
    }

    void build(int[] nums, int node, int start, int end) {
        if (start == end) { tree[node] = nums[start]; return; }
        int mid = (start + end) / 2;
        build(nums, 2*node+1, start, mid);
        build(nums, 2*node+2, mid+1, end);
        tree[node] = tree[2*node+1] + tree[2*node+2];
    }

    void update(int idx, int val, int node, int start, int end) {
        if (start == end) { tree[node] = val; return; }
        int mid = (start + end) / 2;
        if (idx <= mid) update(idx, val, 2*node+1, start, mid);
        else            update(idx, val, 2*node+2, mid+1, end);
        tree[node] = tree[2*node+1] + tree[2*node+2];
    }

    int query(int l, int r, int node, int start, int end) {
        if (r < start || end < l) return 0;
        if (l <= start && end <= r) return tree[node];
        int mid = (start + end) / 2;
        return query(l, r, 2*node+1, start, mid) + query(l, r, 2*node+2, mid+1, end);
    }
}
// Time: O(n) build, O(log n) update/query
```

---

### Fenwick Tree (BIT)

> 🌍 **Real-World:** LeetCode's leaderboard system uses a Fenwick Tree to count how many users have a score less than X in O(log n) — this powers the percentile ranking shown after each submission. Adobe's Photoshop histogram feature uses BIT-style prefix counts over pixel intensity buckets, enabling O(log 256) range queries for brightness/contrast analysis during live editing.

> **💡 Pattern Recognition:** Use a **Fenwick Tree (Binary Indexed Tree)** as a lighter-weight alternative to a Segment Tree when you only need prefix sum queries and point updates. The code is significantly shorter and the constant factor is smaller.

> **⚠️ Common Mistake:** Fenwick Trees are 1-indexed. When converting from a 0-indexed array, add 1 to all indices. The update loop uses `i += i & (-i)` (add lowest set bit) and the query loop uses `i -= i & (-i)` (remove lowest set bit).

> **📊 Complexity:** O(log n) per update and query. O(n) space.

```java
class BIT {
    int[] tree;
    int n;

    BIT(int n) { this.n = n; tree = new int[n + 1]; }

    void update(int i, int delta) {
        for (; i <= n; i += i & (-i)) tree[i] += delta;
    }

    int query(int i) {  // prefix sum [1..i]
        int s = 0;
        for (; i > 0; i -= i & (-i)) s += tree[i];
        return s;
    }

    int rangeQuery(int l, int r) { return query(r) - query(l - 1); }
}
// Time: O(log n) update/query
```

---

### Trie

> 🌍 **Real-World:** Google Search's autocomplete suggestions are backed by a compressed Trie (Patricia tree) — each keystroke traverses one level, returning all completions under that prefix in O(L) time where L is the prefix length, regardless of the dictionary size. Amazon Alexa's wake-word detection model uses a Trie over phoneme sequences to match spoken prefixes against thousands of trigger phrases in real time on a low-power device.

> **💡 Pattern Recognition:** Use a **Trie** (prefix tree) for problems involving word insertion, prefix search, autocomplete, or maximum XOR. If you see "dictionary of words" with prefix queries, a Trie is the right structure.

> **⚠️ Common Mistake:** `search` and `startsWith` are different: `search` requires `node.isEnd == true` at the end, while `startsWith` only requires that all characters exist as nodes. Returning `true` from `search` without checking `isEnd` is a common bug.

> **📊 Complexity:** O(L) per insert/search/startsWith where L is the length of the word. O(26 * N * L) space where N is the number of words.

```java
class Trie {
    TrieNode root = new TrieNode();

    static class TrieNode {
        TrieNode[] children = new TrieNode[26];
        boolean isEnd;
    }

    void insert(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (node.children[i] == null) node.children[i] = new TrieNode();
            node = node.children[i];
        }
        node.isEnd = true;
    }

    boolean search(String word) {
        TrieNode node = root;
        for (char c : word.toCharArray()) {
            int i = c - 'a';
            if (node.children[i] == null) return false;
            node = node.children[i];
        }
        return node.isEnd;
    }

    boolean startsWith(String prefix) {
        TrieNode node = root;
        for (char c : prefix.toCharArray()) {
            int i = c - 'a';
            if (node.children[i] == null) return false;
            node = node.children[i];
        }
        return true;
    }
}
```

---

## WEEK 4 — GRAPHS AND DP

### Graph Setup

```java
// Adjacency list — most common representation
Map<Integer, List<int[]>> graph = new HashMap<>(); // node → [(neighbor, weight)]

// Grid graph — 4-directional
int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0}};
```

---

### BFS (Shortest Path in Unweighted Graph)

> 🌍 **Real-World:** LinkedIn's "degrees of separation" feature uses BFS on their social graph to find the shortest connection path between two professionals — each BFS level represents one degree, and the first time a target node is reached is the shortest path. Facebook Messenger uses multi-source BFS to propagate "message delivered" and "seen" status updates outward from the recipient across their notification graph in level-order.

> **💡 Pattern Recognition:** Use **BFS** for shortest path in an unweighted graph, minimum number of steps/transformations, or level-by-level processing. BFS guarantees the first time you reach a node is via the shortest path.

> **⚠️ Common Mistake:** In Word Ladder and similar problems, mark nodes as visited when they are added to the queue (not when they are dequeued). Marking on dequeue can result in the same node being added multiple times, causing TLE.

> **📊 Complexity:** O(V + E) time and space. For grid problems, O(rows * cols). For Word Ladder, O(N * L * 26) where N is word count and L is word length.

```java
// Number of Islands (LC 200)
int numIslands(char[][] grid) {
    int rows = grid.length, cols = grid[0].length, count = 0;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] == '1') {
                count++;
                bfs(grid, r, c);
            }
        }
    }
    return count;
}
void bfs(char[][] grid, int r, int c) {
    Queue<int[]> q = new LinkedList<>();
    q.offer(new int[]{r, c});
    grid[r][c] = '0';
    int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0}};
    while (!q.isEmpty()) {
        int[] cur = q.poll();
        for (int[] d : dirs) {
            int nr = cur[0]+d[0], nc = cur[1]+d[1];
            if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && grid[nr][nc] == '1') {
                grid[nr][nc] = '0';
                q.offer(new int[]{nr, nc});
            }
        }
    }
}

// Word Ladder (LC 127)
int wordLadder(String begin, String end, List<String> wordList) {
    Set<String> wordSet = new HashSet<>(wordList);
    if (!wordSet.contains(end)) return 0;
    Queue<String> q = new LinkedList<>();
    q.offer(begin);
    int steps = 1;
    Set<String> visited = new HashSet<>();
    visited.add(begin);
    while (!q.isEmpty()) {
        int size = q.size();
        while (size-- > 0) {
            String word = q.poll();
            char[] chars = word.toCharArray();
            for (int i = 0; i < chars.length; i++) {
                char orig = chars[i];
                for (char c = 'a'; c <= 'z'; c++) {
                    chars[i] = c;
                    String next = new String(chars);
                    if (next.equals(end)) return steps + 1;
                    if (wordSet.contains(next) && !visited.contains(next)) {
                        visited.add(next);
                        q.offer(next);
                    }
                }
                chars[i] = orig;
            }
        }
        steps++;
    }
    return 0;
}
```

---

### Topological Sort (Kahn's BFS)

> 🌍 **Real-World:** Google's Bazel build system uses topological sort to determine the correct order to compile thousands of interdependent modules — each target's in-degree counts its unbuilt dependencies, and Kahn's BFS ensures no target is built before its prerequisites. npm uses topological sort on the package dependency graph to install packages in the correct order, detecting circular dependencies (cycles) as a side effect of the same algorithm.

> **💡 Pattern Recognition:** Use **Topological Sort** (Kahn's algorithm) for any problem involving dependency ordering: course prerequisites, build systems, task scheduling. If after the sort not all nodes appear in the output, a cycle exists.

> **⚠️ Common Mistake:** The cycle check: after the BFS completes, verify that `idx == n` (all nodes were processed). If `idx < n`, some nodes had unresolved in-degrees, meaning a cycle exists — return an empty result.

> **📊 Complexity:** O(V + E) time and space.

```java
int[] topoSort(int n, int[][] edges) {
    List<List<Integer>> graph = new ArrayList<>();
    int[] inDegree = new int[n];
    for (int i = 0; i < n; i++) graph.add(new ArrayList<>());
    for (int[] e : edges) { graph.get(e[0]).add(e[1]); inDegree[e[1]]++; }

    Queue<Integer> q = new LinkedList<>();
    for (int i = 0; i < n; i++) if (inDegree[i] == 0) q.offer(i);

    int[] order = new int[n];
    int idx = 0;
    while (!q.isEmpty()) {
        int u = q.poll();
        order[idx++] = u;
        for (int v : graph.get(u))
            if (--inDegree[v] == 0) q.offer(v);
    }
    return idx == n ? order : new int[0]; // empty = cycle detected
}
```

---

### Dijkstra's Algorithm

> 🌍 **Real-World:** Google Maps and Waze use Dijkstra's algorithm (or its bidirectional variant) on road networks where edge weights represent travel time — the min-heap always expands the nearest unvisited intersection, guaranteeing the first path found to your destination is the shortest. Cisco's OSPF routing protocol uses Dijkstra's to compute shortest paths across the internet's router graph every time a link state changes, updating routing tables in O((V+E) log V).

> **💡 Pattern Recognition:** Use **Dijkstra's** for shortest path in a graph with non-negative edge weights. The key insight is a greedy min-heap: always process the closest unvisited node next. Does NOT work with negative weights (use Bellman-Ford instead).

> **⚠️ Common Mistake:** After polling from the heap, check `if (d > dist[u]) continue` to skip stale entries — otherwise you may process a node multiple times with outdated distances, causing incorrect results or TLE.

> **📊 Complexity:** O((V + E) log V) time with a binary heap. O(V + E) space.

```java
int[] dijkstra(Map<Integer, List<int[]>> graph, int src, int n) {
    int[] dist = new int[n];
    Arrays.fill(dist, Integer.MAX_VALUE);
    dist[src] = 0;
    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> a[0] - b[0]);
    heap.offer(new int[]{0, src});
    while (!heap.isEmpty()) {
        int[] cur = heap.poll();
        int d = cur[0], u = cur[1];
        if (d > dist[u]) continue; // stale entry
        for (int[] edge : graph.getOrDefault(u, Collections.emptyList())) {
            int v = edge[0], w = edge[1];
            if (dist[u] + w < dist[v]) {
                dist[v] = dist[u] + w;
                heap.offer(new int[]{dist[v], v});
            }
        }
    }
    return dist;
}
// Time O((V + E) log V)
```

---

### Union-Find (Disjoint Set)

> 🌍 **Real-World:** Kruskal's MST algorithm — used by network providers like AT&T to lay fiber optic cable with minimum total length — relies entirely on Union-Find to detect cycles in O(α(n)) per edge check. Facebook's social graph uses Union-Find to merge user accounts when duplicate profiles are detected, efficiently tracking which identity cluster each account belongs to without full graph re-traversals.

> **💡 Pattern Recognition:** Use **Union-Find** for dynamic connectivity queries: "are nodes X and Y in the same component?", "how many connected components are there?", cycle detection in undirected graphs, and Kruskal's MST algorithm.

> **⚠️ Common Mistake:** Always use both **union by rank** and **path compression** together — either alone gives O(log n) per operation, but both together give near-O(1) (inverse Ackermann O(α(n))). Omitting rank can degrade to O(n) in adversarial cases.

> **📊 Complexity:** O(α(n)) ≈ O(1) amortized per operation with both optimizations. O(n) space.

```java
class UnionFind {
    int[] parent, rank;
    int count;

    UnionFind(int n) {
        parent = new int[n];
        rank = new int[n];
        count = n;
        for (int i = 0; i < n; i++) parent[i] = i;
    }

    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]); // path compression
        return parent[x];
    }

    boolean union(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false;
        if (rank[px] < rank[py]) { int t = px; px = py; py = t; }
        parent[py] = px;
        if (rank[px] == rank[py]) rank[px]++;
        count--;
        return true;
    }
}
// Time O(α(n)) ≈ O(1) amortized

// Redundant Connection (LC 684)
int[] findRedundantConnection(int[][] edges) {
    UnionFind uf = new UnionFind(edges.length + 1);
    for (int[] e : edges)
        if (!uf.union(e[0], e[1])) return e; // already connected → cycle
    return new int[0];
}
```

---

## DYNAMIC PROGRAMMING PATTERNS

> ⭐ **IMPORTANT CONCEPT:** DP interviews are about defining state + transition first — code second.

---

### 0/1 Knapsack

> 🌍 **Real-World:** Amazon's fulfillment center packing algorithm uses 0/1 knapsack to select which items to include in a single shipment box given a weight and volume capacity — each item can ship once, and the goal is to maximize the total value of items that fit. Portfolio optimization at hedge funds like Two Sigma frames position selection as a 0/1 knapsack: each stock is either included or not, subject to a capital constraint, to maximize expected return.

> **💡 Pattern Recognition:** Use **0/1 Knapsack** when each item can be taken at most once and you have a capacity constraint. The "0/1" means binary choice: take or skip each item. Iterate the capacity dimension **backwards** to prevent reusing the same item.

> **⚠️ Common Mistake:** Iterating `c` from `0` to `capacity` (forwards) in the 1D DP table turns it into unbounded knapsack (allowing item reuse). For 0/1 knapsack, always iterate from `capacity` down to `weights[i]`.

> **📊 Complexity:** O(n * capacity) time, O(capacity) space with the 1D rolling array optimization.

```java
int knapsack(int[] weights, int[] values, int capacity) {
    int n = weights.length;
    int[] dp = new int[capacity + 1];
    for (int i = 0; i < n; i++)
        for (int c = capacity; c >= weights[i]; c--) // backwards prevents reuse
            dp[c] = Math.max(dp[c], dp[c - weights[i]] + values[i]);
    return dp[capacity];
}
```

---

### Coin Change (LC 322) — Unbounded Knapsack

> 🌍 **Real-World:** Payment processing systems at Stripe use unbounded knapsack DP to compute the minimum number of currency denominations needed to make change for any amount — the same coin can be used repeatedly (unbounded). Vending machine firmware uses this exact algorithm to calculate the minimum coins dispensed as change after a purchase.

> **💡 Pattern Recognition:** Use **Unbounded Knapsack** (forward iteration) when items can be reused an unlimited number of times. Coin Change (minimum coins) and Coin Change 2 (count ways) are the canonical examples. The only difference from 0/1 knapsack is the iteration direction.

> **⚠️ Common Mistake:** In Coin Change (minimum coins), initialize `dp[i] = amount + 1` as the sentinel for "impossible". Returning `-1` when `dp[amount] > amount` is correct since the true minimum can never exceed `amount` (using all 1-coins). Do NOT initialize to `Integer.MAX_VALUE` or `dp[a - coin] + 1` will overflow.

> **📊 Complexity:** O(amount * coins.length) time, O(amount) space.

```java
int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);
    dp[0] = 0;
    for (int coin : coins)
        for (int a = coin; a <= amount; a++) // forwards = unbounded (reuse)
            dp[a] = Math.min(dp[a], dp[a - coin] + 1);
    return dp[amount] > amount ? -1 : dp[amount];
}

// Coin Change 2 — count combinations (LC 518)
int change(int amount, int[] coins) {
    int[] dp = new int[amount + 1];
    dp[0] = 1;
    for (int coin : coins)
        for (int a = coin; a <= amount; a++)
            dp[a] += dp[a - coin];
    return dp[amount];
}
```

---

### LCS and Edit Distance

> 🌍 **Real-World:** Google Docs' real-time collaboration uses a variant of LCS/Edit Distance (operational transformation) to merge concurrent edits from two users — the minimum-edit-distance alignment determines which characters were inserted, deleted, or kept. GitHub's `git diff` output is produced by computing the LCS of two file versions and marking lines not in the common subsequence as additions or deletions.

> **💡 Pattern Recognition:** Use **LCS (Longest Common Subsequence)** for problems comparing two strings or sequences for similarity. **Edit Distance** extends this to count the minimum insertions, deletions, and substitutions. Both follow the same 2D DP table structure.

> **⚠️ Common Mistake:** In Edit Distance, when characters match, `dp[i][j] = dp[i-1][j-1]` (no cost). When they don't match, take the minimum of three operations: delete (`dp[i-1][j] + 1`), insert (`dp[i][j-1] + 1`), and replace (`dp[i-1][j-1] + 1`). Forgetting the replace case is a common error.

> **📊 Complexity:** Both O(m * n) time and space. Can be optimized to O(min(m, n)) space using rolling arrays.

```java
// Longest Common Subsequence (LC 1143)
int lcs(String s1, String s2) {
    int m = s1.length(), n = s2.length();
    int[][] dp = new int[m + 1][n + 1];
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = s1.charAt(i-1) == s2.charAt(j-1)
                ? dp[i-1][j-1] + 1
                : Math.max(dp[i-1][j], dp[i][j-1]);
    return dp[m][n];
}

// Edit Distance (LC 72)
int editDistance(String w1, String w2) {
    int m = w1.length(), n = w2.length();
    int[][] dp = new int[m + 1][n + 1];
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            dp[i][j] = w1.charAt(i-1) == w2.charAt(j-1)
                ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], Math.min(dp[i][j-1], dp[i-1][j-1]));
    return dp[m][n];
}
```

---

### LIS — O(n log n)

> 🌍 **Real-World:** Patience sorting — the algorithm behind LIS — is used in card sorting robotics at Amazon's fulfillment centers to find the minimum number of sorted piles needed to process a deck of packages ordered by weight. Version control systems use LIS to compute the longest chain of cleanly-applying patches in a patch series before rebasing, minimizing merge conflicts.

> **💡 Pattern Recognition:** Use the O(n log n) **LIS (Longest Increasing Subsequence)** algorithm when you need only the length (not the actual subsequence). The `tails` array maintains the smallest possible tail element for increasing subsequences of each length — binary search finds where the current element fits.

> **⚠️ Common Mistake:** The `tails` array does NOT represent an actual valid LIS; it is a patience-sorting auxiliary structure. Use it only to get the length. To reconstruct the actual LIS, you need a separate parent-tracking array.

> **📊 Complexity:** O(n log n) time, O(n) space.

```java
int lis(int[] nums) {
    List<Integer> tails = new ArrayList<>();
    for (int n : nums) {
        int lo = 0, hi = tails.size();
        while (lo < hi) {
            int mid = (lo + hi) / 2;
            if (tails.get(mid) < n) lo = mid + 1;
            else hi = mid;
        }
        if (lo == tails.size()) tails.add(n);
        else tails.set(lo, n);
    }
    return tails.size();
}
```

---

### Interval DP — Burst Balloons (LC 312)

> 🌍 **Real-World:** Google's TensorFlow XLA compiler uses interval DP (matrix chain multiplication) to find the optimal order in which to evaluate chains of matrix operations — the O(n³) solution determines which pairs to contract first, reducing FLOPs by orders of magnitude for deep learning inference. Cloud compiler services at AWS (via LLVM) use interval DP when optimizing instruction scheduling across basic blocks to minimize pipeline stalls.

> **💡 Pattern Recognition:** Use **Interval DP** (`dp[l][r]`) when the optimal solution for a range depends on splitting it at some midpoint k, and the cost depends on what remains outside the subinterval. Problems: Burst Balloons, Matrix Chain Multiplication, Minimum Cost to Merge Stones.

> **⚠️ Common Mistake:** In Burst Balloons, `k` is the LAST balloon to burst in `(l, r)` — not the first. This is the key insight that makes the recurrence clean: when k is burst last, `arr[l]`, `arr[k]`, `arr[r]` are all still present as its neighbors.

> **📊 Complexity:** O(n³) time, O(n²) space.

```java
int maxCoins(int[] nums) {
    int n = nums.length + 2;
    int[] arr = new int[n];
    arr[0] = arr[n-1] = 1;
    for (int i = 1; i < n-1; i++) arr[i] = nums[i-1];
    int[][] dp = new int[n][n];
    for (int len = 2; len < n; len++)
        for (int l = 0; l < n - len; l++) {
            int r = l + len;
            for (int k = l+1; k < r; k++)
                dp[l][r] = Math.max(dp[l][r],
                    dp[l][k] + arr[l]*arr[k]*arr[r] + dp[k][r]);
        }
    return dp[0][n-1];
}
```

---

### Stock Problems — State Machine DP

> 🌍 **Real-World:** Algorithmic trading firms like Citadel and Renaissance Technologies use state-machine DP to model optimal entry/exit strategies under constraints — the "cooldown" state models mandatory holding periods imposed by regulations, and the "transaction fee" variant directly maps to brokerage costs. Robinhood's back-testing engine uses this DP pattern to simulate optimal trading strategies over historical price data with configurable rule sets.

> **💡 Pattern Recognition:** Use **State Machine DP** for stock problems with constraints (cooldown, transaction limits, fees). Model each day as a state transition: `hold`, `sold` (just sold), `rest` (cooldown/idle). The transitions encode the rules of buying and selling.

> **⚠️ Common Mistake:** When updating states, use the values from the PREVIOUS day (save `prevHold`, `prevSold`, `prevRest` before overwriting). Updating `hold` and then immediately using the new `hold` to compute `sold` introduces bugs.

> **📊 Complexity:** O(n) time, O(1) space.

```java
// With cooldown (LC 309)
int maxProfitCooldown(int[] prices) {
    int hold = -prices[0], sold = 0, rest = 0;
    for (int i = 1; i < prices.length; i++) {
        int prevHold = hold, prevSold = sold, prevRest = rest;
        hold = Math.max(prevHold, prevRest - prices[i]);
        sold = prevHold + prices[i];
        rest = Math.max(prevRest, prevSold);
    }
    return Math.max(sold, rest);
}
```

---

## BACKTRACKING TEMPLATE

> 🌍 **Real-World:** Google's constraint-satisfaction solver (used in Google Calendar for meeting scheduling) uses backtracking with pruning to find valid time slots across participants — it tries each candidate slot, prunes branches that conflict with existing events, and backtracks on failure. Compiler register allocation uses backtracking search to assign CPU registers to variables under graph-coloring constraints, with pruning to avoid exponential blowup.

> **💡 Pattern Recognition:** Use **Backtracking** for exhaustive search problems: subsets, permutations, combinations, and constraint-satisfaction problems (N-Queens, Sudoku). The template is always: choose, explore, unchoose.

> **⚠️ Common Mistake:** When adding a path to results, always pass `new ArrayList<>(path)` — passing `path` directly adds a reference to a mutable list that will be emptied during backtracking. This is a very common bug that produces empty lists in the result.

> **📊 Complexity:** Subsets O(2ⁿ), Permutations O(n!), Combinations O(C(n,k)). Space O(n) for the recursion stack.

```java
void backtrack(List<List<Integer>> result, List<Integer> path,
               int[] choices, int start) {
    if (isSolution(path)) { result.add(new ArrayList<>(path)); return; }
    for (int i = start; i < choices.length; i++) {
        path.add(choices[i]);
        backtrack(result, path, choices, i + 1);
        path.remove(path.size() - 1);
    }
}

// Subsets (LC 78)
List<List<Integer>> subsets(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrackSubsets(result, new ArrayList<>(), nums, 0);
    return result;
}
void backtrackSubsets(List<List<Integer>> res, List<Integer> path, int[] nums, int start) {
    res.add(new ArrayList<>(path));
    for (int i = start; i < nums.length; i++) {
        path.add(nums[i]);
        backtrackSubsets(res, path, nums, i + 1);
        path.remove(path.size() - 1);
    }
}

// Permutations (LC 46)
List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> result = new ArrayList<>();
    backtrackPerms(result, new ArrayList<>(), nums, new boolean[nums.length]);
    return result;
}
void backtrackPerms(List<List<Integer>> res, List<Integer> path, int[] nums, boolean[] used) {
    if (path.size() == nums.length) { res.add(new ArrayList<>(path)); return; }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        path.add(nums[i]);
        backtrackPerms(res, path, nums, used);
        path.remove(path.size() - 1);
        used[i] = false;
    }
}

// N-Queens (LC 51)
List<List<String>> solveNQueens(int n) {
    List<List<String>> result = new ArrayList<>();
    char[][] board = new char[n][n];
    for (char[] row : board) Arrays.fill(row, '.');
    nQueens(result, board, 0, n, new HashSet<>(), new HashSet<>(), new HashSet<>());
    return result;
}
void nQueens(List<List<String>> res, char[][] board, int row, int n,
             Set<Integer> cols, Set<Integer> diag1, Set<Integer> diag2) {
    if (row == n) {
        List<String> solution = new ArrayList<>();
        for (char[] r : board) solution.add(new String(r));
        res.add(solution);
        return;
    }
    for (int c = 0; c < n; c++) {
        if (cols.contains(c) || diag1.contains(row-c) || diag2.contains(row+c)) continue;
        board[row][c] = 'Q';
        cols.add(c); diag1.add(row-c); diag2.add(row+c);
        nQueens(res, board, row+1, n, cols, diag1, diag2);
        board[row][c] = '.';
        cols.remove(c); diag1.remove(row-c); diag2.remove(row+c);
    }
}
```

---

## INTERVAL PROBLEMS

> 🌍 **Real-World:** Google Calendar uses interval merging to detect and highlight overlapping meeting blocks — given a list of booked intervals, it merges them in O(n log n) to show a consolidated "busy" timeline. Calendly's scheduling algorithm uses the Meeting Rooms II pattern (minimum rooms needed) to determine the maximum concurrent bookings, capping the number of simultaneous appointments that can be accepted.

> **💡 Pattern Recognition:** Use the **sort-then-merge** approach when intervals may overlap and you need to consolidate them. For scheduling problems (minimum rooms needed), the two-pointer approach on sorted start/end times is cleaner than using a heap.

> **⚠️ Common Mistake:** In Merge Intervals, sort by `start` time. In the merge loop, compare `intervals[i][0]` against `last[1]` (not `last[0]`). Update `last[1]` with `Math.max` — don't just overwrite — because a new interval could be fully contained within the last merged interval.

> **📊 Complexity:** Merge Intervals O(n log n) sort + O(n) scan. Meeting Rooms II O(n log n). Both O(n) space.

```java
// Merge Intervals (LC 56)
int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> a[0] - b[0]);
    List<int[]> merged = new ArrayList<>();
    merged.add(intervals[0]);
    for (int i = 1; i < intervals.length; i++) {
        int[] last = merged.get(merged.size() - 1);
        if (intervals[i][0] <= last[1])
            last[1] = Math.max(last[1], intervals[i][1]);
        else
            merged.add(intervals[i]);
    }
    return merged.toArray(new int[0][]);
}

// Meeting Rooms II — min rooms (LC 253)
int minMeetingRooms(int[][] intervals) {
    int n = intervals.length;
    int[] starts = new int[n], ends = new int[n];
    for (int i = 0; i < n; i++) { starts[i] = intervals[i][0]; ends[i] = intervals[i][1]; }
    Arrays.sort(starts); Arrays.sort(ends);
    int rooms = 0, active = 0, j = 0;
    for (int i = 0; i < n; i++) {
        if (starts[i] < ends[j]) { active++; rooms = Math.max(rooms, active); }
        else { active--; j++; }
    }
    return rooms;
}
```

---

## BIT MANIPULATION

> 🌍 **Real-World:** Linux's `epoll` and `select` system calls use bitmasks to track which file descriptors are ready for I/O — a single 64-bit integer represents 64 FDs, and `fd_set` operations like FD_SET/FD_ISSET are O(1) bit operations. Google's Bloom filter (used in Chrome's Safe Browsing and BigTable) hashes each URL into k bit positions in a bitmask; a URL is "possibly malicious" if all k bits are set — leveraging XOR and bitwise OR across billions of entries.

> **💡 Pattern Recognition:** Use **bit manipulation** for problems involving powers of two, unique elements in arrays where others appear multiple times, or generating all subsets. XOR is especially powerful: `a ^ a = 0` and `a ^ 0 = a`, so XOR-ing all elements cancels paired values.

> **⚠️ Common Mistake:** `n & (n-1)` clears the lowest set bit of n — this is used to check if n is a power of two (`n > 0 && (n & (n-1)) == 0`). Do not confuse it with `n & (-n)` which ISOLATES the lowest set bit (used in Fenwick Tree).

> **📊 Complexity:** All bitwise operations O(1). Generating all subsets via bitmask O(2ⁿ * n). Counting set bits O(number of set bits) with `n &= n-1` loop.

```java
boolean isSet(int n, int k)     { return ((n >> k) & 1) == 1; }
int     setBit(int n, int k)    { return n | (1 << k); }
int     clearBit(int n, int k)  { return n & ~(1 << k); }
int     countBits(int n)        { int c=0; while(n!=0){n&=n-1; c++;} return c; }
boolean isPowerOfTwo(int n)     { return n > 0 && (n & (n-1)) == 0; }

// Single Number (XOR — everyone appears twice except one): LC 136
int singleNumber(int[] nums) {
    int result = 0;
    for (int n : nums) result ^= n;
    return result;
}

// All subsets using bits
List<List<Integer>> allSubsets(int[] nums) {
    int n = nums.length;
    List<List<Integer>> result = new ArrayList<>();
    for (int mask = 0; mask < (1 << n); mask++) {
        List<Integer> subset = new ArrayList<>();
        for (int i = 0; i < n; i++)
            if ((mask & (1 << i)) != 0) subset.add(nums[i]);
        result.add(subset);
    }
    return result;
}
```

---

## KEY PATTERNS QUICK REFERENCE

```text
Sliding Window:   contiguous subarray/substring with constraint
Two Pointers:     sorted array, pair/triple sum, partition
Prefix Sum:       range sum queries, subarray sum = k
Binary Search:    sorted array OR binary search on answer (monotonic predicate)
Cyclic Sort:      array of numbers 1..N, find missing/duplicate
Monotonic Stack:  next greater/smaller, histogram, span
Fast/Slow Ptr:    cycle detection, middle of list
BFS:              shortest path in unweighted graph, level order
DFS + memo:       tree problems, grid problems, backtracking
Topo Sort:        dependency ordering, cycle detection in DAG
Dijkstra:         shortest path in weighted non-negative graph
Union-Find:       connected components, cycle detection, Kruskal's MST
Segment Tree:     range queries + point updates (O(log n))
Fenwick Tree:     prefix sums + point updates (simpler code, same complexity)
Interval DP:      dp[l][r] computed from smaller intervals
Knapsack:         take-or-not-take, capacity constraint
LCS/Edit Dist:    two-string comparison DP
State Machine DP: multiple states (stocks, cooldown, transactions)
Backtracking:     subsets, permutations, combinations, N-Queens
```

---

## STRIVER'S A2Z SHEET — PROBLEM LIST BY TOPIC

**Reference**: https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z
**Total: ~455 problems** | 18 Steps | Easy → Medium → Hard progression

---

### Step 1: Learn the Basics (54 problems)

#### 1.1 Basic Maths

- [ ] Count Digits in a Number
- [ ] Reverse a Number
- [ ] Check if a Number is Palindrome
- [ ] Find GCD / HCF of Two Numbers
- [ ] Check Armstrong Number
- [ ] Print All Divisors of a Number
- [ ] Check if a Number is Prime

#### 1.2 Recursion Basics

- [ ] Understand Recursion — Print name N times
- [ ] Print 1 to N using Recursion
- [ ] Print N to 1 using Recursion
- [ ] Sum of First N Numbers (Parameterised + Functional)
- [ ] Factorial of N (Parameterised + Functional)
- [ ] Reverse an Array using Recursion
- [ ] Check Palindrome (String) using Recursion
- [ ] Fibonacci Number (LC 509)

#### 1.3 Hashing

- [ ] Count Frequency of Each Element in Array
- [ ] Find the Highest/Lowest Frequency Element
- [ ] Two Sum using Hashing (LC 1)

---

### Step 2: Sorting Techniques (7 problems)

- [ ] Selection Sort
- [ ] Bubble Sort
- [ ] Insertion Sort
- [ ] Merge Sort (LC 912) — key: merge step, used for LL sort too
- [ ] Recursive Bubble Sort
- [ ] Recursive Insertion Sort
- [ ] Quick Sort

---

### Step 3: Arrays (40 problems)

#### Easy

- [ ] Largest Element in an Array
- [ ] Second Largest Element in Array (without sorting)
- [ ] Check if Array is Sorted
- [ ] Remove Duplicates from Sorted Array (LC 26)
- [ ] Left Rotate an Array by One Place
- [ ] Left Rotate an Array by D Places
- [ ] Move Zeros to End (LC 283)
- [ ] Linear Search
- [ ] Union of Two Sorted Arrays
- [ ] Find Missing Number in Array (LC 268) — XOR trick
- [ ] Maximum Consecutive Ones (LC 485)
- [ ] Find the Number that Appears Once (LC 136) — XOR
- [ ] Longest Subarray with Given Sum K (Positive Numbers)

#### Medium

- [ ] Two Sum (LC 1)
- [ ] Sort Array of 0's, 1's and 2's — Dutch National Flag (LC 75)
- [ ] Majority Element (>n/2 times) — Boyer-Moore (LC 169)
- [ ] Kadane's Algorithm — Maximum Subarray Sum (LC 53)
- [ ] Stock Buy and Sell (LC 121)
- [ ] Rearrange Elements by Sign (LC 2149)
- [ ] Next Permutation (LC 31)
- [ ] Leaders in an Array
- [ ] Longest Consecutive Sequence (LC 128)
- [ ] Set Matrix Zeroes (LC 73)
- [ ] Rotate Matrix by 90 Degrees (LC 48)
- [ ] Spiral Traversal of Matrix (LC 54)
- [ ] Count Subarrays with Given Sum (LC 560) — prefix sum + hash

#### Hard

- [ ] Pascal's Triangle — All 3 Varieties (LC 118)
- [ ] Majority Element (>n/3 times) (LC 229)
- [ ] 3 Sum (LC 15)
- [ ] 4 Sum (LC 18)
- [ ] Largest Subarray with 0 Sum
- [ ] Count Subarrays with Given XOR K
- [ ] Merge Overlapping Sub-intervals (LC 56)
- [ ] Merge Two Sorted Arrays Without Extra Space (LC 88)
- [ ] Find the Repeating and Missing Number
- [ ] Count Inversions (Merge Sort technique)
- [ ] Reverse Pairs (LC 493) — Modified Merge Sort
- [ ] Maximum Product Subarray (LC 152)

---

### Step 4: Binary Search (32 problems)

#### 1D Arrays

- [ ] Binary Search to Find X in Sorted Array (LC 704)
- [ ] Implement Lower Bound
- [ ] Implement Upper Bound
- [ ] Search Insert Position (LC 35)
- [ ] Floor and Ceil in Sorted Array
- [ ] First and Last Occurrence in Array (LC 34)
- [ ] Count Occurrences in Sorted Array
- [ ] Search in Rotated Sorted Array I (LC 33)
- [ ] Search in Rotated Sorted Array II (LC 81)
- [ ] Find Minimum in Rotated Sorted Array (LC 153)
- [ ] Find How Many Times Array Has Been Rotated
- [ ] Single Element in a Sorted Array (LC 540)
- [ ] Find Peak Element (LC 162)

#### Binary Search on Answers

- [ ] Find Square Root of a Number in log n
- [ ] Find Nth Root of a Number
- [ ] Koko Eating Bananas (LC 875)
- [ ] Minimum Days to Make M Bouquets (LC 1482)
- [ ] Find the Smallest Divisor Given a Threshold (LC 1283)
- [ ] Capacity to Ship Packages Within D Days (LC 1011)
- [ ] Kth Missing Positive Number (LC 1539)
- [ ] Aggressive Cows (SPOJ)
- [ ] Book Allocation Problem
- [ ] Split Array — Largest Sum (LC 410)
- [ ] Painter's Partition Problem
- [ ] Minimize Max Distance to Gas Stations
- [ ] Median of Two Sorted Arrays (LC 4) ← very common FAANG
- [ ] Kth Element of Two Sorted Arrays

#### 2D Arrays

- [ ] Row with Maximum 1s
- [ ] Search in a 2D Matrix (LC 74)
- [ ] Search in Row-Column Sorted Matrix (LC 240)
- [ ] Find Peak Element in 2D Matrix (LC 1901)
- [ ] Matrix Median

---

### Step 5: Strings (15 problems)

#### Basic

- [ ] Remove Outermost Parentheses (LC 1021)
- [ ] Reverse Words in a String (LC 151)
- [ ] Largest Odd Number in a String (LC 1903)
- [ ] Longest Common Prefix (LC 14)
- [ ] Isomorphic Strings (LC 205)
- [ ] Check if Two Strings are Anagrams (LC 242)
- [ ] Sort Characters By Frequency (LC 451)

#### Medium

- [ ] Maximum Nesting Depth of Parentheses (LC 1614)
- [ ] Roman to Integer (LC 13)
- [ ] Implement atoi (LC 8)
- [ ] Count Number of Substrings
- [ ] Longest Palindromic Substring (LC 5)
- [ ] Sum of Beauty of All Substrings (LC 1781)
- [ ] Minimum Bracket Reversals to Balance Expression
- [ ] Count and Say (LC 38)

---

### Step 6: Linked List (31 problems)

#### Single Linked List — Learning

- [ ] Introduction to LL — Convert Array to LL, Insert/Delete
- [ ] Delete the Last Node of LL
- [ ] Find Length of LL
- [ ] Search in LL
- [ ] Reverse a Linked List (LC 206)
- [ ] Find the Middle of LL (LC 876)
- [ ] Check if LL is Palindrome (LC 234)
- [ ] Detect a Loop in LL (LC 141)
- [ ] Find Starting Point of Loop (LC 142)
- [ ] Remove Nth Node from End (LC 19)

#### Doubly Linked List

- [ ] Introduction to DLL — Convert Array to DLL
- [ ] Delete Last Node of DLL
- [ ] Reverse a DLL

#### Medium Problems

- [ ] Odd Even Linked List (LC 328)
- [ ] Add Two Numbers (LC 2)
- [ ] Sort LL (Merge Sort) (LC 148)
- [ ] Sort LL of 0's, 1's, and 2's
- [ ] Find Intersection of Two LL (LC 160)
- [ ] Add 1 to a LL Number

#### Hard Problems

- [ ] Reverse LL in Groups of K (LC 25)
- [ ] Rotate a Linked List (LC 61)
- [ ] Flatten a Linked List (Multi-level)
- [ ] Clone LL with Random and Next Pointer (LC 138)

---

### Step 7: Recursion & Backtracking (25 problems)

#### Recursion

- [ ] Recursive Implementation of atoi
- [ ] Pow(x, n) (LC 50)
- [ ] Count Good Numbers (LC 1922)
- [ ] Sort a Stack using Recursion
- [ ] Reverse a Stack using Recursion

#### Subsequences Pattern

- [ ] Generate All Binary Strings
- [ ] Generate Parentheses (LC 22)
- [ ] Print All Subsequences / Power Set
- [ ] Subsequence Whose Sum is K
- [ ] Check if Subsequence with Sum K Exists
- [ ] Count All Subsequences with Target Sum
- [ ] Combination Sum I (LC 39)
- [ ] Combination Sum II (LC 40)
- [ ] Subset Sum I — All Subset Sums
- [ ] Subset Sum II — Unique Subsets (LC 90)
- [ ] Combination Sum III (LC 216)
- [ ] Letter Combinations of a Phone Number (LC 17)

#### Hard Backtracking

- [ ] Palindrome Partitioning (LC 131)
- [ ] N-Queens (LC 51)
- [ ] Sudoku Solver (LC 37)
- [ ] M Coloring Problem
- [ ] Word Search (LC 79)
- [ ] Rat in a Maze
- [ ] Expression Add Operators (LC 282)
- [ ] Word Break II (LC 140)

---

### Step 8: Bit Manipulation (18 problems)

#### Basics

- [ ] Introduction — Set, Clear, Toggle, Shift Bits
- [ ] Check if ith Bit is Set
- [ ] Check if Number is Odd
- [ ] Check if Number is Power of 2 (LC 231)
- [ ] Count Set Bits in a Number (LC 191)
- [ ] Set / Unset / Toggle the ith Bit

#### Medium

- [ ] Remove the Last Set Bit
- [ ] Find the Number Appearing Odd Times (XOR trick)
- [ ] Power Set using Bitmask (LC 78)
- [ ] Find XOR of Numbers from L to R
- [ ] Find Two Numbers Appearing Odd Number of Times
- [ ] Divide Two Integers (LC 29)

#### Hard

- [ ] Count Total Set Bits from 1 to N
- [ ] Minimum Bit Flips to Convert Number (LC 2220)
- [ ] Find the Two Non-Repeating Elements
- [ ] XOR Queries of a Subarray (LC 1310)
- [ ] Maximum AND of Two Numbers
- [ ] Sum of All Subsets XOR Values (LC 1863)

---

### Step 9: Stack and Queues (30 problems)

#### Learning — Implementations

- [ ] Implement Stack using Arrays
- [ ] Implement Queue using Arrays
- [ ] Implement Stack using Queue (LC 225)
- [ ] Implement Queue using Stack (LC 232)
- [ ] Implement Stack using Linked List
- [ ] Implement Queue using Linked List

#### Prefix / Infix / Postfix

- [ ] Infix to Postfix Conversion
- [ ] Prefix to Infix Conversion
- [ ] Prefix to Postfix Conversion
- [ ] Postfix to Prefix Conversion
- [ ] Postfix to Infix Conversion
- [ ] Convert Infix to Prefix

#### Monotonic Stack Problems

- [ ] Next Greater Element I (LC 496)
- [ ] Next Greater Element II — Circular (LC 503)
- [ ] Next Smaller Element
- [ ] Number of NGEs to the Right
- [ ] Trapping Rain Water (LC 42)
- [ ] Sum of Subarray Minimums (LC 907)
- [ ] Asteroid Collision (LC 735)
- [ ] Sum of Subarray Ranges (LC 2104)
- [ ] Remove K Digits (LC 402)
- [ ] Largest Rectangle in Histogram (LC 84)
- [ ] Maximal Rectangle (LC 85)

#### Implementation Problems

- [ ] Sliding Window Maximum (LC 239) — Monotonic Deque
- [ ] Stock Span Problem
- [ ] The Celebrity Problem
- [ ] LRU Cache (LC 146)
- [ ] LFU Cache (LC 460)

---

### Step 10: Sliding Window & Two Pointer (12 problems)

- [ ] Longest Substring Without Repeating Characters (LC 3)
- [ ] Max Consecutive Ones III (LC 1004)
- [ ] Fruit Into Baskets (LC 904)
- [ ] Longest Repeating Character Replacement (LC 424)
- [ ] Binary Subarrays With Sum (LC 930)
- [ ] Count Number of Nice Subarrays (LC 1248)
- [ ] Number of Substrings Containing All Three Characters (LC 1358)
- [ ] Maximum Points from Cards (LC 1423)
- [ ] Longest Substring with At Most K Distinct Characters (LC 340)
- [ ] Subarrays with K Different Integers (LC 992)
- [ ] Minimum Window Substring (LC 76)
- [ ] Minimum Window Subsequence (LC 727)

---

### Step 11: Heaps (17 problems)

#### Learning

- [ ] Introduction to Heap — Min Heap Implementation
- [ ] Min / Max Heap using Library
- [ ] Check if Binary Tree is Heap
- [ ] Convert Min Heap to Max Heap

#### Medium

- [ ] Kth Largest Element in an Array (LC 215)
- [ ] Kth Smallest Element
- [ ] Sort K-Sorted Array
- [ ] Merge M Sorted Lists (LC 23)
- [ ] Replace Each Array Element by its Rank
- [ ] Task Scheduler (LC 621)
- [ ] Hands of Straights (LC 846)

#### Hard

- [ ] Design Twitter (LC 355)
- [ ] Connect Ropes to Minimize Cost
- [ ] Kth Largest Element in a Stream (LC 703)
- [ ] Maximum Sum Combination
- [ ] Find Median from Data Stream (LC 295)
- [ ] Top K Frequent Elements (LC 347)

---

### Step 12: Greedy Algorithms (15 problems)

#### Easy

- [ ] Assign Cookies (LC 455)
- [ ] Fractional Knapsack
- [ ] Greedy — Minimum Number of Coins
- [ ] Lemonade Change (LC 860)
- [ ] Valid Parenthesis String (LC 678)

#### Medium

- [ ] N Meetings in One Room (Activity Selection)
- [ ] Jump Game I (LC 55)
- [ ] Jump Game II (LC 45)
- [ ] Minimum Number of Platforms (Railway Station)
- [ ] Job Sequencing Problem
- [ ] Candy (LC 135)
- [ ] Shortest Job First (SJF) CPU Scheduling

#### Hard

- [ ] Minimum Number of Arrows to Burst Balloons (LC 452)
- [ ] Insert Interval (LC 57)
- [ ] Merge Intervals (LC 56)

---

### Step 13: Binary Trees (38 problems)

#### Traversals

- [ ] Binary Tree Representation (Array → Tree)
- [ ] Preorder Traversal (LC 144)
- [ ] Inorder Traversal (LC 94)
- [ ] Postorder Traversal (LC 145)
- [ ] Level Order Traversal (LC 102)
- [ ] Iterative Postorder — 2 Stacks
- [ ] Iterative Postorder — 1 Stack
- [ ] All 5 Traversals in a Single Pass
- [ ] Morris Preorder Traversal
- [ ] Morris Inorder Traversal

#### Medium

- [ ] Height of a Binary Tree (LC 104)
- [ ] Check if Binary Tree is Height-Balanced (LC 110)
- [ ] Diameter of Binary Tree (LC 543)
- [ ] Maximum Path Sum (LC 124)
- [ ] Check if Two Trees are Identical (LC 100)
- [ ] Zigzag (Spiral) Level Order Traversal (LC 103)
- [ ] Boundary Traversal of Binary Tree
- [ ] Vertical Order Traversal (LC 987)
- [ ] Top View of Binary Tree
- [ ] Bottom View of Binary Tree
- [ ] Right View of Binary Tree (LC 199)
- [ ] Symmetric Binary Tree (LC 101)

#### Hard

- [ ] Root to Node Path in Binary Tree
- [ ] LCA in Binary Tree (LC 236)
- [ ] Maximum Width of Binary Tree (LC 662)
- [ ] Check for Children Sum Property
- [ ] Print All Nodes at Distance K from Target (LC 863)
- [ ] Minimum Time to Burn Binary Tree from a Node
- [ ] Count Total Nodes in Complete Binary Tree (LC 222)
- [ ] Requirements to Construct a Unique Binary Tree
- [ ] Construct Tree from Preorder + Inorder (LC 105)
- [ ] Construct Tree from Postorder + Inorder (LC 106)
- [ ] Serialize and Deserialize Binary Tree (LC 297)
- [ ] Flatten Binary Tree to Linked List (LC 114)

---

### Step 14: Binary Search Trees (16 problems)

#### Concepts

- [ ] Introduction to BST
- [ ] Search in BST (LC 700)
- [ ] Floor in BST
- [ ] Ceil in BST
- [ ] Insert a Node in BST (LC 701)
- [ ] Delete a Node in BST (LC 450)

#### Medium

- [ ] Find Kth Smallest Element in BST (LC 230)
- [ ] Find Kth Largest Element in BST
- [ ] Check if Tree is BST (LC 98)
- [ ] LCA in BST (LC 235)
- [ ] Construct BST from Preorder Traversal (LC 1008)

#### Hard

- [ ] BST Iterator (LC 173)
- [ ] Two Sum in BST (LC 653)
- [ ] Recover BST (LC 99)
- [ ] Largest BST in Binary Tree
- [ ] Find Median of BST

---

### Step 15: Graphs (53 problems)

#### Learning — Traversals

- [ ] Graph Representation in Java (Adjacency Matrix + List)
- [ ] BFS Traversal (LC 102 for trees, breadth-first)
- [ ] DFS Traversal
- [ ] Number of Provinces (LC 547)
- [ ] Number of Islands (Connected Components in Matrix) (LC 200)
- [ ] Rotten Oranges — Multi-source BFS (LC 994)
- [ ] Flood Fill (LC 733)
- [ ] Cycle Detection in Undirected Graph using BFS
- [ ] Cycle Detection in Undirected Graph using DFS
- [ ] 0/1 Matrix — Shortest Distance (LC 542)
- [ ] Surrounded Regions (LC 130)
- [ ] Number of Enclaves (LC 1020)
- [ ] Word Ladder I (LC 127)
- [ ] Word Ladder II (LC 126)
- [ ] Number of Distinct Islands
- [ ] Bipartite Check using BFS (LC 785)
- [ ] Bipartite Check using DFS

#### Topo Sort + Problems

- [ ] Topological Sort — DFS
- [ ] Kahn's Algorithm — BFS Topo Sort
- [ ] Cycle Detection in Directed Graph using BFS
- [ ] Course Schedule I (LC 207)
- [ ] Course Schedule II (LC 210)
- [ ] Find Eventual Safe States (LC 802)
- [ ] Alien Dictionary (LC 269)

#### Shortest Path

- [ ] Shortest Path in Undirected Graph (Unit Weight) — BFS
- [ ] Shortest Path in DAG — Topo Sort
- [ ] Dijkstra's Algorithm using Set
- [ ] Dijkstra's Algorithm using Priority Queue (LC 743)
- [ ] Shortest Distance in a Binary Maze (LC 1091)
- [ ] Path with Minimum Effort (LC 1631)
- [ ] Cheapest Flights Within K Stops (LC 787)
- [ ] Number of Ways to Arrive at Destination (LC 1976)
- [ ] Minimum Multiplications to Reach End
- [ ] Bellman-Ford Algorithm
- [ ] Floyd-Warshall Algorithm
- [ ] Find the City With Smallest Number of Neighbors (LC 1334)

#### MST + Disjoint Set

- [ ] Minimum Spanning Tree using Prim's Algorithm
- [ ] Kruskal's Algorithm for MST
- [ ] Number of Operations to Make Network Connected (LC 1319)
- [ ] Most Stones Removed with Same Row or Column (LC 947)
- [ ] Accounts Merge (LC 721)
- [ ] Number of Islands II — Online Queries
- [ ] Making a Large Island (LC 827)

#### Other Algorithms

- [ ] Bridges in Graph — Tarjan's Algorithm (LC 1192)
- [ ] Articulation Point in Graph
- [ ] Kosaraju's Algorithm for SCC

---

### Step 16: Dynamic Programming (55 problems)

#### Introduction to DP

- [ ] Fibonacci Number (LC 509) — Memoization + Tabulation
- [ ] Climbing Stairs (LC 70)

#### 1D DP

- [ ] Frog Jump — Min Cost to Reach End
- [ ] Frog Jump with K Distances
- [ ] Maximum Sum of Non-Adjacent Elements — House Robber (LC 198)
- [ ] House Robber II — Circular Array (LC 213)
- [ ] Ninja's Training — 2D Grid

#### 2D / Grid DP

- [ ] Grid Unique Paths (LC 62)
- [ ] Grid Unique Paths II — Obstacles (LC 63)
- [ ] Minimum Path Sum in Grid (LC 64)
- [ ] Minimum Path Sum in Triangle (LC 120)
- [ ] Maximum Falling Path Sum (LC 931)
- [ ] Chocolate Pickup (3D DP)

#### DP on Subsequences

- [ ] Subset Sum Equal to Target
- [ ] Partition Equal Subset Sum (LC 416)
- [ ] Partition Set Into 2 Subsets — Minimum Absolute Difference
- [ ] Count Subsets with Sum K
- [ ] Count Partitions with Given Difference
- [ ] 0/1 Knapsack
- [ ] Coin Change — Minimum Coins (LC 322)
- [ ] Coin Change 2 — Number of Ways (LC 518)
- [ ] Unbounded Knapsack
- [ ] Rod Cutting Problem
- [ ] Minimum Coins (Minimum No. of Coins)

#### DP on Strings

- [ ] Longest Common Subsequence (LC 1143)
- [ ] Print LCS
- [ ] Longest Common Substring
- [ ] Longest Palindromic Subsequence (LC 516)
- [ ] Minimum Insertions to Make String Palindrome (LC 1312)
- [ ] Minimum Insertions/Deletions to Convert String A to B (LC 583)
- [ ] Shortest Common Supersequence (LC 1092)
- [ ] Count Distinct Occurrences as a Subsequence (LC 115)
- [ ] Edit Distance (LC 72)
- [ ] Wildcard Matching (LC 44)

#### DP on Stocks

- [ ] Best Time to Buy and Sell Stock I (LC 121)
- [ ] Best Time to Buy and Sell Stock II (LC 122)
- [ ] Best Time to Buy and Sell Stock III (LC 123)
- [ ] Best Time to Buy and Sell Stock IV (LC 188)
- [ ] Buy and Sell Stocks with Cooldown (LC 309)
- [ ] Buy and Sell Stocks with Transaction Fee (LC 714)

#### DP on LIS

- [ ] Longest Increasing Subsequence — O(n log n) (LC 300)
- [ ] Print Longest Increasing Subsequence
- [ ] Longest Bitonic Subsequence
- [ ] Number of Longest Increasing Subsequences (LC 673)
- [ ] Longest Divisible Subset (LC 368)
- [ ] Longest String Chain (LC 1048)
- [ ] Longest Arithmetic Subsequence of Given Difference (LC 1218)

#### MCM / Partition DP

- [ ] Matrix Chain Multiplication — Recursive + Memoization
- [ ] Matrix Chain Multiplication — Bottom-Up
- [ ] Minimum Cost to Cut a Stick (LC 1547)
- [ ] Burst Balloons (LC 312)
- [ ] Evaluate Boolean Expression to True
- [ ] Palindrome Partitioning II — Minimum Cuts (LC 132)
- [ ] Partition Array for Maximum Sum (LC 1043)

---

### Step 17: Tries (7 problems)

- [ ] Implement Trie I — Insert, Search, StartsWith (LC 208)
- [ ] Implement Trie II — Count Prefix, Count Word (Coding Ninjas)
- [ ] Longest String with All Prefixes (Complete String)
- [ ] Number of Distinct Substrings in a String
- [ ] Power Set — Bit Manipulation prerequisite
- [ ] Maximum XOR of Two Numbers in an Array (LC 421)
- [ ] Maximum XOR with an Element from Array (LC 1707)

---

### Step 18: Advanced Strings (9 problems)

- [ ] Minimum Number of Bracket Reversals
- [ ] Count and Say (LC 38)
- [ ] Hashing in Strings — Rolling Hash
- [ ] Count Occurrences of Anagrams (LC 438)
- [ ] Compare Version Numbers (LC 165)
- [ ] Longest Palindromic Substring — DP approach (LC 5)
- [ ] Sum of Beauty of All Substrings (LC 1781)
- [ ] Count Distinct Substrings (Good Substrings) (LC 1930)
- [ ] Shortest Palindrome — KMP (LC 214)

---

### FAANG Must-Solve List

> **💡 Pattern Recognition:** These problems appear most frequently in FAANG interviews. Know each one well enough to code it from scratch without hints. Focus on explaining your approach before coding.

| Problem | Pattern | Difficulty |
|---------|---------|------------|
| Two Sum (LC 1) | Hash Map | Easy |
| 3Sum (LC 15) | Sort + Two Pointers | Medium |
| Container With Most Water (LC 11) | Two Pointers | Medium |
| Merge Intervals (LC 56) | Sort + Sweep | Medium |
| LRU Cache (LC 146) | DLL + HashMap | Medium |
| LFU Cache (LC 460) | HashMap + Min-heap | Hard |
| Word Ladder (LC 127) | BFS | Hard |
| Course Schedule I+II (LC 207, 210) | Topo Sort | Medium |
| Number of Islands (LC 200) | BFS/DFS | Medium |
| Coin Change (LC 322) | DP | Medium |
| LCS (LC 1143) | DP on Strings | Medium |
| Edit Distance (LC 72) | DP on Strings | Hard |
| Burst Balloons (LC 312) | Partition DP | Hard |
| Find Median from Stream (LC 295) | Two Heaps | Hard |
| Serialize/Deserialize Binary Tree (LC 297) | BFS/DFS | Hard |
| Median of Two Sorted Arrays (LC 4) | Binary Search | Hard |
| Alien Dictionary (LC 269) | Topo Sort | Hard |
| Trapping Rain Water (LC 42) | Monotonic Stack | Hard |
| Sliding Window Maximum (LC 239) | Monotonic Deque | Hard |
| Longest Consecutive Sequence (LC 128) | HashSet | Medium |


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (DSA)

> Master these cold. If you can teach each in 60 seconds + code the template, you're interview-ready.

| # | Concept | Why it matters | Can explain? | Can code? |
|---|---------|----------------|--------------|-----------|
| 1 | Two pointers / sliding window | Highest frequency Medium pattern | [ ] | [ ] |
| 2 | Prefix sum + hashmap | Subarray sum = k, contiguous problems | [ ] | [ ] |
| 3 | Binary search (incl. on answer) | Hard problems often hide “search the answer” | [ ] | [ ] |
| 4 | Monotonic stack/deque | Next greater, trapping rain, sliding window max | [ ] | [ ] |
| 5 | Fast/slow pointers | Cycle detect, middle, palindrome LL | [ ] | [ ] |
| 6 | BFS shortest path | Unweighted graphs, grid, levels | [ ] | [ ] |
| 7 | Topological sort | Course schedule, alien dictionary, build order | [ ] | [ ] |
| 8 | Union-Find | Connected components, redundant connection | [ ] | [ ] |
| 9 | Dijkstra / heap patterns | Weighted shortest path, top-K | [ ] | [ ] |
| 10 | Tree recursion + DFS states | LCA, serialize, path sums | [ ] | [ ] |
| 11 | Trie | Autocomplete, word search II | [ ] | [ ] |
| 12 | 0/1 & unbounded knapsack DP | Coin change, subset sum family | [ ] | [ ] |
| 13 | LCS / Edit Distance | String DP foundation | [ ] | [ ] |
| 14 | Interval merge / sweep | Meeting rooms, insert interval | [ ] | [ ] |
| 15 | Backtracking template | Subsets, permutations, N-Queens | [ ] | [ ] |
| 16 | LRU Cache | HashMap + DLL — classic LLD+DSA hybrid | [ ] | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Pattern recognition in the first 2–3 minutes determines outcome more than clever micro-optimizations.

---

## 🛠️ PRACTICAL — DSA Labs

### Lab 1: Timed Pattern Drill (30 min)
1. Open FAANG Must-Solve list above.
2. For 10 problems: read only the title + 1-line description.
3. Write: pattern, approach sketch, complexity — **no code**.
4. Score: ≥ 8/10 correct patterns = pass.

### Lab 2: Code-from-Blank Templates (45 min)
Code each from memory with no notes:
- Binary search left-bound
- Sliding window longest substring with constraint
- BFS grid
- Dijkstra
- Union-Find with path compression + union by rank
- 0/1 knapsack DP table

### Lab 3: Explain-Aloud Protocol
For every Medium you solve this week, record a 90-second explanation:
"Brute force is X. Bottleneck is Y. Optimal is Z because… Edge cases…"

### Lab 4: Weak-Pattern Spaced Repetition
Keep a `weak-patterns.md`:
```text
Date | Pattern | Problem | Result (solved / hint / fail) | Revisit date
```
Revisit fails at +1 day, +3 days, +7 days.
