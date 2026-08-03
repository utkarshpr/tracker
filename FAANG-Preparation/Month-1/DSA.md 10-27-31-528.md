# DSA — Complete Study Notes (Patterns + Java Code + Complexity)

Self-contained. No internet needed. All code in Java.

**Reference Sheet**: https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z

---

## Table of Contents

### Algorithms & Patterns

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

### Problem Bank

- [Problem Bank](#problem-bank)
  - [Step 1: Math Basics](#step-1-math-basics)
  - [Step 2: Sorting Techniques](#step-2-sorting-techniques-7-problems)
  - [Step 3: Arrays](#step-3-arrays-40-problems)
  - [Step 4: Binary Search](#step-4-binary-search-32-problems)
  - [Step 5: Strings](#step-5-strings-15-problems)
  - [Step 6: Linked List](#step-6-linked-list-31-problems)
  - [Step 7: Recursion & Backtracking](#step-7-recursion--backtracking-25-problems)
  - [Step 8: Bit Manipulation](#step-8-bit-manipulation-18-problems)
  - [Step 9: Stack and Queues](#step-9-stack-and-queues-30-problems)
  - [Step 10: Sliding Window & Two Pointer](#step-10-sliding-window--two-pointer-12-problems)
  - [Step 11: Heaps](#step-11-heaps-17-problems)
  - [Step 12: Greedy Algorithms](#step-12-greedy-algorithms-15-problems)
  - [Step 13: Binary Trees](#step-13-binary-trees-38-problems)
  - [Step 14: Binary Search Trees](#step-14-binary-search-trees-16-problems)
  - [Step 15: Graphs](#step-15-graphs-53-problems)
  - [Step 16: Dynamic Programming](#step-16-dynamic-programming-55-problems)
  - [Step 17: Tries](#step-17-tries-7-problems)
  - [Step 18: Advanced Strings](#step-18-advanced-strings-9-problems)
  - [Expanded Pattern Practice Bank](#expanded-pattern-practice-bank)
  - [FAANG Must-Solve List](#faang-must-solve-list)
  - [Complete Curriculum Problem Bank](#complete-curriculum-problem-bank)

---

## COMPLEXITY CHEAT SHEET

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

## PROBLEM BANK

> All problems from Striver's A2Z Sheet, Expanded Pattern Practice Bank, FAANG Must-Solve List, and Complete Curriculum Problem Bank are unified here by topic. Each category contains every problem from every source — deduplicated, with LeetCode links preferred.

---

### Step 1: Math Basics

#### Fundamentals (Basic / No LC link)

- [ ] Count Digits in a Number — Basic
- [ ] Reverse a Given Number — Basic
- [ ] Check if a Number is Palindrome — Basic
- [ ] Find GCD / HCF of Two Numbers — Basic
- [ ] Check Armstrong Number — Basic
- [ ] Print All Divisors of a Number — Basic
- [ ] Check if a Number is Prime — Basic
- [ ] Perform Basic Operations (Addition, Subtraction, Multiplication, Division) using Two Numbers — Basic
- [ ] Find the Sum of Digits of a Number — Basic
- [ ] Count the Total Occurrences of the Digit '1' in All Positive Integers Less than or Equal to n — Basic
- [ ] Generate Fibonacci Numbers up to a Given Limit — Basic
- [ ] Calculate the Factorial of a Number — Basic
- [ ] Find the Number of Trailing Zeroes in the Factorial of a Given Number n — Basic
- [ ] Calculate the LCM and GCD of Two Numbers — Basic
- [ ] Check if Two Numbers are Co-Prime — Basic
- [ ] Find All Divisors of a Given Number — Basic
- [ ] Perform Modulo Operations — Basic
- [ ] Check Divisibility Rules for Numbers from 1 to 20 — Basic

---

### Step 2: Sorting Techniques (7 problems)

- [ ] Selection Sort
- [ ] Bubble Sort
- [ ] Insertion Sort
- [ ] [Merge Sort](https://leetcode.com/problems/merge-sort/) (LC 912) — key: merge step, used for LL sort too
- [ ] Recursive Bubble Sort
- [ ] Recursive Insertion Sort
- [ ] Quick Sort

---

### Step 3: Arrays (40 problems)

#### Easy

- [ ] Largest Element in an Array
- [ ] Second Largest Element in Array (without sorting)
- [ ] Check if Array is Sorted
- [ ] [Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) (LC 26)
- [ ] Left Rotate an Array by One Place
- [ ] Left Rotate an Array by D Places
- [ ] [Move Zeros to End](https://leetcode.com/problems/move-zeros-to-end/) (LC 283)
- [ ] Linear Search
- [ ] Union of Two Sorted Arrays
- [ ] [Find Missing Number in Array](https://leetcode.com/problems/find-missing-number-in-array/) (LC 268) — XOR trick
- [ ] [Maximum Consecutive Ones](https://leetcode.com/problems/maximum-consecutive-ones/) (LC 485)
- [ ] [Find the Number that Appears Once](https://leetcode.com/problems/find-the-number-that-appears-once/) (LC 136) — XOR
- [ ] Longest Subarray with Given Sum K (Positive Numbers)

#### Medium

- [ ] [Two Sum](https://leetcode.com/problems/two-sum/) (LC 1)
- [ ] [Sort Array of 0's, 1's and 2's — Dutch National Flag](https://leetcode.com/problems/sort-array-of-0-s-1-s-and-2-s/) (LC 75)
- [ ] [Majority Element (>n/2 times) — Boyer-Moore](https://leetcode.com/problems/majority-element/) (LC 169)
- [ ] [Kadane's Algorithm — Maximum Subarray Sum](https://leetcode.com/problems/kadane-s-algorithm/) (LC 53)
- [ ] [Stock Buy and Sell](https://leetcode.com/problems/stock-buy-and-sell/) (LC 121)
- [ ] [Rearrange Elements by Sign](https://leetcode.com/problems/rearrange-elements-by-sign/) (LC 2149)
- [ ] [Next Permutation](https://leetcode.com/problems/next-permutation/) (LC 31)
- [ ] Leaders in an Array
- [ ] [Longest Consecutive Sequence](https://leetcode.com/problems/longest-consecutive-sequence/) (LC 128)
- [ ] [Set Matrix Zeroes](https://leetcode.com/problems/set-matrix-zeroes/) (LC 73)
- [ ] [Rotate Matrix by 90 Degrees](https://leetcode.com/problems/rotate-matrix-by-90-degrees/) (LC 48)
- [ ] [Spiral Traversal of Matrix](https://leetcode.com/problems/spiral-traversal-of-matrix/) (LC 54)
- [ ] [Count Subarrays with Given Sum](https://leetcode.com/problems/count-subarrays-with-given-sum/) (LC 560) — prefix sum + hash

#### Hard

- [ ] [Pascal's Triangle — All 3 Varieties](https://leetcode.com/problems/pascal-s-triangle/) (LC 118)
- [ ] [Majority Element (>n/3 times)](https://leetcode.com/problems/majority-element/) (LC 229)
- [ ] [3 Sum](https://leetcode.com/problems/3-sum/) (LC 15)
- [ ] [4 Sum](https://leetcode.com/problems/4-sum/) (LC 18)
- [ ] Largest Subarray with 0 Sum
- [ ] Count Subarrays with Given XOR K
- [ ] [Merge Overlapping Sub-intervals](https://leetcode.com/problems/merge-overlapping-sub-intervals/) (LC 56)
- [ ] [Merge Two Sorted Arrays Without Extra Space](https://leetcode.com/problems/merge-two-sorted-arrays-without-extra-space/) (LC 88)
- [ ] Find the Repeating and Missing Number
- [ ] Count Inversions (Merge Sort technique)
- [ ] [Reverse Pairs](https://leetcode.com/problems/reverse-pairs/) (LC 493) — Modified Merge Sort
- [ ] [Maximum Product Subarray](https://leetcode.com/problems/maximum-product-subarray/) (LC 152)

---

### Step 4: Binary Search (32 problems)

#### 1D Arrays

- [ ] [Binary Search to Find X in Sorted Array](https://leetcode.com/problems/binary-search-to-find-x-in-sorted-array/) (LC 704)
- [ ] Implement Lower Bound
- [ ] Implement Upper Bound
- [ ] [Search Insert Position](https://leetcode.com/problems/search-insert-position/) (LC 35)
- [ ] Floor and Ceil in Sorted Array
- [ ] [First and Last Occurrence in Array](https://leetcode.com/problems/first-and-last-occurrence-in-array/) (LC 34)
- [ ] Count Occurrences in Sorted Array
- [ ] [Search in Rotated Sorted Array I](https://leetcode.com/problems/search-in-rotated-sorted-array-i/) (LC 33)
- [ ] [Search in Rotated Sorted Array II](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) (LC 81)
- [ ] [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) (LC 153)
- [ ] Find How Many Times Array Has Been Rotated
- [ ] [Single Element in a Sorted Array](https://leetcode.com/problems/single-element-in-a-sorted-array/) (LC 540)
- [ ] [Find Peak Element](https://leetcode.com/problems/find-peak-element/) (LC 162)

#### Binary Search on Answers

- [ ] Find Square Root of a Number in log n
- [ ] Find Nth Root of a Number
- [ ] [Koko Eating Bananas](https://leetcode.com/problems/koko-eating-bananas/) (LC 875)
- [ ] [Minimum Days to Make M Bouquets](https://leetcode.com/problems/minimum-days-to-make-m-bouquets/) (LC 1482)
- [ ] [Find the Smallest Divisor Given a Threshold](https://leetcode.com/problems/find-the-smallest-divisor-given-a-threshold/) (LC 1283)
- [ ] [Capacity to Ship Packages Within D Days](https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/) (LC 1011)
- [ ] [Kth Missing Positive Number](https://leetcode.com/problems/kth-missing-positive-number/) (LC 1539)
- [ ] Aggressive Cows (SPOJ)
- [ ] Book Allocation Problem
- [ ] [Split Array — Largest Sum](https://leetcode.com/problems/split-array/) (LC 410)
- [ ] Painter's Partition Problem
- [ ] Minimize Max Distance to Gas Stations
- [ ] [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/) (LC 4) ← very common FAANG
- [ ] Kth Element of Two Sorted Arrays

#### 2D Arrays

- [ ] Row with Maximum 1s
- [ ] [Search in a 2D Matrix](https://leetcode.com/problems/search-in-a-2d-matrix/) (LC 74)
- [ ] [Search in Row-Column Sorted Matrix](https://leetcode.com/problems/search-in-row-column-sorted-matrix/) (LC 240)
- [ ] [Find Peak Element in 2D Matrix](https://leetcode.com/problems/find-peak-element-in-2d-matrix/) (LC 1901)
- [ ] Matrix Median

---

### Step 5: Strings (15 problems)

#### Basic

- [ ] [Remove Outermost Parentheses](https://leetcode.com/problems/remove-outermost-parentheses/) (LC 1021)
- [ ] [Reverse Words in a String](https://leetcode.com/problems/reverse-words-in-a-string/) (LC 151)
- [ ] [Largest Odd Number in a String](https://leetcode.com/problems/largest-odd-number-in-a-string/) (LC 1903)
- [ ] [Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/) (LC 14)
- [ ] [Isomorphic Strings](https://leetcode.com/problems/isomorphic-strings/) (LC 205)
- [ ] [Check if Two Strings are Anagrams](https://leetcode.com/problems/check-if-two-strings-are-anagrams/) (LC 242)
- [ ] [Sort Characters By Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) (LC 451)

#### Medium

- [ ] [Maximum Nesting Depth of Parentheses](https://leetcode.com/problems/maximum-nesting-depth-of-parentheses/) (LC 1614)
- [ ] [Roman to Integer](https://leetcode.com/problems/roman-to-integer/) (LC 13)
- [ ] [Implement atoi](https://leetcode.com/problems/implement-atoi/) (LC 8)
- [ ] Count Number of Substrings
- [ ] [Longest Palindromic Substring](https://leetcode.com/problems/longest-palindromic-substring/) (LC 5)
- [ ] [Sum of Beauty of All Substrings](https://leetcode.com/problems/sum-of-beauty-of-all-substrings/) (LC 1781)
- [ ] Minimum Bracket Reversals to Balance Expression
- [ ] [Count and Say](https://leetcode.com/problems/count-and-say/) (LC 38)

---

### Step 6: Linked List (31 problems)

#### Single Linked List — Learning

- [ ] Introduction to LL — Convert Array to LL, Insert/Delete
- [ ] Delete the Last Node of LL
- [ ] Find Length of LL
- [ ] Search in LL
- [ ] [Reverse a Linked List](https://leetcode.com/problems/reverse-a-linked-list/) (LC 206)
- [ ] [Find the Middle of LL](https://leetcode.com/problems/find-the-middle-of-ll/) (LC 876)
- [ ] [Check if LL is Palindrome](https://leetcode.com/problems/check-if-ll-is-palindrome/) (LC 234)
- [ ] [Detect a Loop in LL](https://leetcode.com/problems/detect-a-loop-in-ll/) (LC 141)
- [ ] [Find Starting Point of Loop](https://leetcode.com/problems/find-starting-point-of-loop/) (LC 142)
- [ ] [Remove Nth Node from End](https://leetcode.com/problems/remove-nth-node-from-end/) (LC 19)

#### Doubly Linked List

- [ ] Introduction to DLL — Convert Array to DLL
- [ ] Delete Last Node of DLL
- [ ] Reverse a DLL

#### Medium Problems

- [ ] [Odd Even Linked List](https://leetcode.com/problems/odd-even-linked-list/) (LC 328)
- [ ] [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/) (LC 2)
- [ ] [Sort LL (Merge Sort)](https://leetcode.com/problems/sort-ll/) (LC 148)
- [ ] Sort LL of 0's, 1's, and 2's
- [ ] [Find Intersection of Two LL](https://leetcode.com/problems/find-intersection-of-two-ll/) (LC 160)
- [ ] Add 1 to a LL Number

#### Hard Problems

- [ ] [Reverse LL in Groups of K](https://leetcode.com/problems/reverse-ll-in-groups-of-k/) (LC 25)
- [ ] [Rotate a Linked List](https://leetcode.com/problems/rotate-a-linked-list/) (LC 61)
- [ ] Flatten a Linked List (Multi-level)
- [ ] [Clone LL with Random and Next Pointer](https://leetcode.com/problems/clone-ll-with-random-and-next-pointer/) (LC 138)

---

### Step 7: Recursion & Backtracking (25 problems)

#### Recursion

- [ ] Recursive Implementation of atoi
- [ ] [Pow(x, n)](https://leetcode.com/problems/pow-x-n/) (LC 50)
- [ ] [Count Good Numbers](https://leetcode.com/problems/count-good-numbers/) (LC 1922)
- [ ] Sort a Stack using Recursion
- [ ] Reverse a Stack using Recursion

#### Subsequences Pattern

- [ ] Generate All Binary Strings
- [ ] [Generate Parentheses](https://leetcode.com/problems/generate-parentheses/) (LC 22)
- [ ] Print All Subsequences / Power Set
- [ ] Subsequence Whose Sum is K
- [ ] Check if Subsequence with Sum K Exists
- [ ] Count All Subsequences with Target Sum
- [ ] [Combination Sum I](https://leetcode.com/problems/combination-sum-i/) (LC 39)
- [ ] [Combination Sum II](https://leetcode.com/problems/combination-sum-ii/) (LC 40)
- [ ] Subset Sum I — All Subset Sums
- [ ] [Subset Sum II — Unique Subsets](https://leetcode.com/problems/subset-sum-ii/) (LC 90)
- [ ] [Combination Sum III](https://leetcode.com/problems/combination-sum-iii/) (LC 216)
- [ ] [Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/) (LC 17)

#### Hard Backtracking

- [ ] [Palindrome Partitioning](https://leetcode.com/problems/palindrome-partitioning/) (LC 131)
- [ ] [N-Queens](https://leetcode.com/problems/n-queens/) (LC 51)
- [ ] [Sudoku Solver](https://leetcode.com/problems/sudoku-solver/) (LC 37)
- [ ] M Coloring Problem
- [ ] [Word Search](https://leetcode.com/problems/word-search/) (LC 79)
- [ ] Rat in a Maze
- [ ] [Expression Add Operators](https://leetcode.com/problems/expression-add-operators/) (LC 282)
- [ ] [Word Break II](https://leetcode.com/problems/word-break-ii/) (LC 140)

---

### Step 8: Bit Manipulation (18 problems)

#### Basics

- [ ] Introduction — Set, Clear, Toggle, Shift Bits
- [ ] Check if ith Bit is Set
- [ ] Check if Number is Odd
- [ ] [Check if Number is Power of 2](https://leetcode.com/problems/check-if-number-is-power-of-2/) (LC 231)
- [ ] [Count Set Bits in a Number](https://leetcode.com/problems/count-set-bits-in-a-number/) (LC 191)
- [ ] Set / Unset / Toggle the ith Bit

#### Medium

- [ ] Remove the Last Set Bit
- [ ] Find the Number Appearing Odd Times (XOR trick)
- [ ] [Power Set using Bitmask](https://leetcode.com/problems/power-set-using-bitmask/) (LC 78)
- [ ] Find XOR of Numbers from L to R
- [ ] Find Two Numbers Appearing Odd Number of Times
- [ ] [Divide Two Integers](https://leetcode.com/problems/divide-two-integers/) (LC 29)

#### Hard

- [ ] Count Total Set Bits from 1 to N
- [ ] [Minimum Bit Flips to Convert Number](https://leetcode.com/problems/minimum-bit-flips-to-convert-number/) (LC 2220)
- [ ] Find the Two Non-Repeating Elements
- [ ] [XOR Queries of a Subarray](https://leetcode.com/problems/xor-queries-of-a-subarray/) (LC 1310)
- [ ] Maximum AND of Two Numbers
- [ ] [Sum of All Subsets XOR Values](https://leetcode.com/problems/sum-of-all-subsets-xor-values/) (LC 1863)

---

### Step 9: Stack and Queues (30 problems)

#### Learning — Implementations

- [ ] Implement Stack using Arrays
- [ ] Implement Queue using Arrays
- [ ] [Implement Stack using Queue](https://leetcode.com/problems/implement-stack-using-queue/) (LC 225)
- [ ] [Implement Queue using Stack](https://leetcode.com/problems/implement-queue-using-stack/) (LC 232)
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

- [ ] [Next Greater Element I](https://leetcode.com/problems/next-greater-element-i/) (LC 496)
- [ ] [Next Greater Element II — Circular](https://leetcode.com/problems/next-greater-element-ii/) (LC 503)
- [ ] Next Smaller Element
- [ ] Number of NGEs to the Right
- [ ] [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) (LC 42)
- [ ] [Sum of Subarray Minimums](https://leetcode.com/problems/sum-of-subarray-minimums/) (LC 907)
- [ ] [Asteroid Collision](https://leetcode.com/problems/asteroid-collision/) (LC 735)
- [ ] [Sum of Subarray Ranges](https://leetcode.com/problems/sum-of-subarray-ranges/) (LC 2104)
- [ ] [Remove K Digits](https://leetcode.com/problems/remove-k-digits/) (LC 402)
- [ ] [Largest Rectangle in Histogram](https://leetcode.com/problems/largest-rectangle-in-histogram/) (LC 84)
- [ ] [Maximal Rectangle](https://leetcode.com/problems/maximal-rectangle/) (LC 85)

#### Implementation Problems

- [ ] [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) (LC 239) — Monotonic Deque
- [ ] Stock Span Problem
- [ ] The Celebrity Problem
- [ ] [LRU Cache](https://leetcode.com/problems/lru-cache/) (LC 146)
- [ ] [LFU Cache](https://leetcode.com/problems/lfu-cache/) (LC 460)

---

### Step 10: Sliding Window & Two Pointer (12 problems)

- [ ] [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) (LC 3)
- [ ] [Max Consecutive Ones III](https://leetcode.com/problems/max-consecutive-ones-iii/) (LC 1004)
- [ ] [Fruit Into Baskets](https://leetcode.com/problems/fruit-into-baskets/) (LC 904)
- [ ] [Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/) (LC 424)
- [ ] [Binary Subarrays With Sum](https://leetcode.com/problems/binary-subarrays-with-sum/) (LC 930)
- [ ] [Count Number of Nice Subarrays](https://leetcode.com/problems/count-number-of-nice-subarrays/) (LC 1248)
- [ ] [Number of Substrings Containing All Three Characters](https://leetcode.com/problems/number-of-substrings-containing-all-three-characters/) (LC 1358)
- [ ] [Maximum Points from Cards](https://leetcode.com/problems/maximum-points-from-cards/) (LC 1423)
- [ ] [Longest Substring with At Most K Distinct Characters](https://leetcode.com/problems/longest-substring-with-at-most-k-distinct-characters/) (LC 340)
- [ ] [Subarrays with K Different Integers](https://leetcode.com/problems/subarrays-with-k-different-integers/) (LC 992)
- [ ] [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/) (LC 76)
- [ ] [Minimum Window Subsequence](https://leetcode.com/problems/minimum-window-subsequence/) (LC 727)

---

### Step 11: Heaps (17 problems)

#### Learning

- [ ] Introduction to Heap — Min Heap Implementation
- [ ] Min / Max Heap using Library
- [ ] Check if Binary Tree is Heap
- [ ] Convert Min Heap to Max Heap

#### Medium

- [ ] [Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/) (LC 215)
- [ ] Kth Smallest Element
- [ ] Sort K-Sorted Array
- [ ] [Merge M Sorted Lists](https://leetcode.com/problems/merge-m-sorted-lists/) (LC 23)
- [ ] Replace Each Array Element by its Rank
- [ ] [Task Scheduler](https://leetcode.com/problems/task-scheduler/) (LC 621)
- [ ] [Hands of Straights](https://leetcode.com/problems/hands-of-straights/) (LC 846)

#### Hard

- [ ] [Design Twitter](https://leetcode.com/problems/design-twitter/) (LC 355)
- [ ] Connect Ropes to Minimize Cost
- [ ] [Kth Largest Element in a Stream](https://leetcode.com/problems/kth-largest-element-in-a-stream/) (LC 703)
- [ ] Maximum Sum Combination
- [ ] [Find Median from Data Stream](https://leetcode.com/problems/find-median-from-data-stream/) (LC 295)
- [ ] [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/) (LC 347)

---

### Step 12: Greedy Algorithms (15 problems)

#### Easy

- [ ] [Assign Cookies](https://leetcode.com/problems/assign-cookies/) (LC 455)
- [ ] Fractional Knapsack
- [ ] Greedy — Minimum Number of Coins
- [ ] [Lemonade Change](https://leetcode.com/problems/lemonade-change/) (LC 860)
- [ ] [Valid Parenthesis String](https://leetcode.com/problems/valid-parenthesis-string/) (LC 678)

#### Medium

- [ ] N Meetings in One Room (Activity Selection)
- [ ] [Jump Game I](https://leetcode.com/problems/jump-game-i/) (LC 55)
- [ ] [Jump Game II](https://leetcode.com/problems/jump-game-ii/) (LC 45)
- [ ] Minimum Number of Platforms (Railway Station)
- [ ] Job Sequencing Problem
- [ ] [Candy](https://leetcode.com/problems/candy/) (LC 135)
- [ ] Shortest Job First (SJF) CPU Scheduling

#### Hard

- [ ] [Minimum Number of Arrows to Burst Balloons](https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/) (LC 452)
- [ ] [Insert Interval](https://leetcode.com/problems/insert-interval/) (LC 57)
- [ ] [Merge Intervals](https://leetcode.com/problems/merge-intervals/) (LC 56)

---

### Step 13: Binary Trees (38 problems)

#### Traversals

- [ ] Binary Tree Representation (Array → Tree)
- [ ] [Preorder Traversal](https://leetcode.com/problems/preorder-traversal/) (LC 144)
- [ ] [Inorder Traversal](https://leetcode.com/problems/inorder-traversal/) (LC 94)
- [ ] [Postorder Traversal](https://leetcode.com/problems/postorder-traversal/) (LC 145)
- [ ] [Level Order Traversal](https://leetcode.com/problems/level-order-traversal/) (LC 102)
- [ ] Iterative Postorder — 2 Stacks
- [ ] Iterative Postorder — 1 Stack
- [ ] All 5 Traversals in a Single Pass
- [ ] Morris Preorder Traversal
- [ ] Morris Inorder Traversal

#### Medium

- [ ] [Height of a Binary Tree](https://leetcode.com/problems/height-of-a-binary-tree/) (LC 104)
- [ ] [Check if Binary Tree is Height-Balanced](https://leetcode.com/problems/check-if-binary-tree-is-height-balanced/) (LC 110)
- [ ] [Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/) (LC 543)
- [ ] [Maximum Path Sum](https://leetcode.com/problems/maximum-path-sum/) (LC 124)
- [ ] [Check if Two Trees are Identical](https://leetcode.com/problems/check-if-two-trees-are-identical/) (LC 100)
- [ ] [Zigzag (Spiral) Level Order Traversal](https://leetcode.com/problems/zigzag-spiral-level-order-traversal/) (LC 103)
- [ ] Boundary Traversal of Binary Tree
- [ ] [Vertical Order Traversal](https://leetcode.com/problems/vertical-order-traversal/) (LC 987)
- [ ] Top View of Binary Tree
- [ ] Bottom View of Binary Tree
- [ ] [Right View of Binary Tree](https://leetcode.com/problems/right-view-of-binary-tree/) (LC 199)
- [ ] [Symmetric Binary Tree](https://leetcode.com/problems/symmetric-binary-tree/) (LC 101)

#### Hard

- [ ] Root to Node Path in Binary Tree
- [ ] [LCA in Binary Tree](https://leetcode.com/problems/lca-in-binary-tree/) (LC 236)
- [ ] [Maximum Width of Binary Tree](https://leetcode.com/problems/maximum-width-of-binary-tree/) (LC 662)
- [ ] Check for Children Sum Property
- [ ] [Print All Nodes at Distance K from Target](https://leetcode.com/problems/print-all-nodes-at-distance-k-from-target/) (LC 863)
- [ ] Minimum Time to Burn Binary Tree from a Node
- [ ] [Count Total Nodes in Complete Binary Tree](https://leetcode.com/problems/count-total-nodes-in-complete-binary-tree/) (LC 222)
- [ ] Requirements to Construct a Unique Binary Tree
- [ ] [Construct Tree from Preorder + Inorder](https://leetcode.com/problems/construct-tree-from-preorder-inorder/) (LC 105)
- [ ] [Construct Tree from Postorder + Inorder](https://leetcode.com/problems/construct-tree-from-postorder-inorder/) (LC 106)
- [ ] [Serialize and Deserialize Binary Tree](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/) (LC 297)
- [ ] [Flatten Binary Tree to Linked List](https://leetcode.com/problems/flatten-binary-tree-to-linked-list/) (LC 114)

---

### Step 14: Binary Search Trees (16 problems)

#### Concepts

- [ ] Introduction to BST
- [ ] [Search in BST](https://leetcode.com/problems/search-in-bst/) (LC 700)
- [ ] Floor in BST
- [ ] Ceil in BST
- [ ] [Insert a Node in BST](https://leetcode.com/problems/insert-a-node-in-bst/) (LC 701)
- [ ] [Delete a Node in BST](https://leetcode.com/problems/delete-a-node-in-bst/) (LC 450)

#### Medium

- [ ] [Find Kth Smallest Element in BST](https://leetcode.com/problems/find-kth-smallest-element-in-bst/) (LC 230)
- [ ] Find Kth Largest Element in BST
- [ ] [Check if Tree is BST](https://leetcode.com/problems/check-if-tree-is-bst/) (LC 98)
- [ ] [LCA in BST](https://leetcode.com/problems/lca-in-bst/) (LC 235)
- [ ] [Construct BST from Preorder Traversal](https://leetcode.com/problems/construct-bst-from-preorder-traversal/) (LC 1008)

#### Hard

- [ ] [BST Iterator](https://leetcode.com/problems/bst-iterator/) (LC 173)
- [ ] [Two Sum in BST](https://leetcode.com/problems/two-sum-in-bst/) (LC 653)
- [ ] [Recover BST](https://leetcode.com/problems/recover-bst/) (LC 99)
- [ ] Largest BST in Binary Tree
- [ ] Find Median of BST

---

### Step 15: Graphs (53 problems)

#### Learning — Traversals

- [ ] Graph Representation in Java (Adjacency Matrix + List)
- [ ] BFS Traversal (LC 102 for trees, breadth-first)
- [ ] DFS Traversal
- [ ] [Number of Provinces](https://leetcode.com/problems/number-of-provinces/) (LC 547)
- [ ] [Number of Islands (Connected Components in Matrix)](https://leetcode.com/problems/number-of-islands/) (LC 200)
- [ ] [Rotten Oranges — Multi-source BFS](https://leetcode.com/problems/rotten-oranges/) (LC 994)
- [ ] [Flood Fill](https://leetcode.com/problems/flood-fill/) (LC 733)
- [ ] Cycle Detection in Undirected Graph using BFS
- [ ] Cycle Detection in Undirected Graph using DFS
- [ ] [0/1 Matrix — Shortest Distance](https://leetcode.com/problems/0-1-matrix/) (LC 542)
- [ ] [Surrounded Regions](https://leetcode.com/problems/surrounded-regions/) (LC 130)
- [ ] [Number of Enclaves](https://leetcode.com/problems/number-of-enclaves/) (LC 1020)
- [ ] [Word Ladder I](https://leetcode.com/problems/word-ladder-i/) (LC 127)
- [ ] [Word Ladder II](https://leetcode.com/problems/word-ladder-ii/) (LC 126)
- [ ] Number of Distinct Islands
- [ ] [Bipartite Check using BFS](https://leetcode.com/problems/bipartite-check-using-bfs/) (LC 785)
- [ ] Bipartite Check using DFS

#### Topo Sort + Problems

- [ ] Topological Sort — DFS
- [ ] Kahn's Algorithm — BFS Topo Sort
- [ ] Cycle Detection in Directed Graph using BFS
- [ ] [Course Schedule I](https://leetcode.com/problems/course-schedule-i/) (LC 207)
- [ ] [Course Schedule II](https://leetcode.com/problems/course-schedule-ii/) (LC 210)
- [ ] [Find Eventual Safe States](https://leetcode.com/problems/find-eventual-safe-states/) (LC 802)
- [ ] [Alien Dictionary](https://leetcode.com/problems/alien-dictionary/) (LC 269)

#### Shortest Path

- [ ] Shortest Path in Undirected Graph (Unit Weight) — BFS
- [ ] Shortest Path in DAG — Topo Sort
- [ ] Dijkstra's Algorithm using Set
- [ ] [Dijkstra's Algorithm using Priority Queue](https://leetcode.com/problems/dijkstra-s-algorithm-using-priority-queue/) (LC 743)
- [ ] [Shortest Distance in a Binary Maze](https://leetcode.com/problems/shortest-distance-in-a-binary-maze/) (LC 1091)
- [ ] [Path with Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/) (LC 1631)
- [ ] [Cheapest Flights Within K Stops](https://leetcode.com/problems/cheapest-flights-within-k-stops/) (LC 787)
- [ ] [Number of Ways to Arrive at Destination](https://leetcode.com/problems/number-of-ways-to-arrive-at-destination/) (LC 1976)
- [ ] Minimum Multiplications to Reach End
- [ ] Bellman-Ford Algorithm
- [ ] Floyd-Warshall Algorithm
- [ ] [Find the City With Smallest Number of Neighbors](https://leetcode.com/problems/find-the-city-with-smallest-number-of-neighbors/) (LC 1334)

#### MST + Disjoint Set

- [ ] Minimum Spanning Tree using Prim's Algorithm
- [ ] Kruskal's Algorithm for MST
- [ ] [Number of Operations to Make Network Connected](https://leetcode.com/problems/number-of-operations-to-make-network-connected/) (LC 1319)
- [ ] [Most Stones Removed with Same Row or Column](https://leetcode.com/problems/most-stones-removed-with-same-row-or-column/) (LC 947)
- [ ] [Accounts Merge](https://leetcode.com/problems/accounts-merge/) (LC 721)
- [ ] Number of Islands II — Online Queries
- [ ] [Making a Large Island](https://leetcode.com/problems/making-a-large-island/) (LC 827)

#### Other Algorithms

- [ ] [Bridges in Graph — Tarjan's Algorithm](https://leetcode.com/problems/bridges-in-graph/) (LC 1192)
- [ ] Articulation Point in Graph
- [ ] Kosaraju's Algorithm for SCC

---

### Step 16: Dynamic Programming (55 problems)

#### Introduction to DP

- [ ] [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/) (LC 509) — Memoization + Tabulation
- [ ] [Climbing Stairs](https://leetcode.com/problems/climbing-stairs/) (LC 70)

#### 1D DP

- [ ] Frog Jump — Min Cost to Reach End
- [ ] Frog Jump with K Distances
- [ ] [Maximum Sum of Non-Adjacent Elements — House Robber](https://leetcode.com/problems/maximum-sum-of-non-adjacent-elements/) (LC 198)
- [ ] [House Robber II — Circular Array](https://leetcode.com/problems/house-robber-ii/) (LC 213)
- [ ] Ninja's Training — 2D Grid

#### 2D / Grid DP

- [ ] [Grid Unique Paths](https://leetcode.com/problems/grid-unique-paths/) (LC 62)
- [ ] [Grid Unique Paths II — Obstacles](https://leetcode.com/problems/grid-unique-paths-ii/) (LC 63)
- [ ] [Minimum Path Sum in Grid](https://leetcode.com/problems/minimum-path-sum-in-grid/) (LC 64)
- [ ] [Minimum Path Sum in Triangle](https://leetcode.com/problems/minimum-path-sum-in-triangle/) (LC 120)
- [ ] [Maximum Falling Path Sum](https://leetcode.com/problems/maximum-falling-path-sum/) (LC 931)
- [ ] Chocolate Pickup (3D DP)

#### DP on Subsequences

- [ ] Subset Sum Equal to Target
- [ ] [Partition Equal Subset Sum](https://leetcode.com/problems/partition-equal-subset-sum/) (LC 416)
- [ ] Partition Set Into 2 Subsets — Minimum Absolute Difference
- [ ] Count Subsets with Sum K
- [ ] Count Partitions with Given Difference
- [ ] 0/1 Knapsack
- [ ] [Coin Change — Minimum Coins](https://leetcode.com/problems/coin-change/) (LC 322)
- [ ] [Coin Change 2 — Number of Ways](https://leetcode.com/problems/coin-change-2/) (LC 518)
- [ ] Unbounded Knapsack
- [ ] Rod Cutting Problem
- [ ] Minimum Coins (Minimum No. of Coins)

#### DP on Strings

- [ ] [Longest Common Subsequence](https://leetcode.com/problems/longest-common-subsequence/) (LC 1143)
- [ ] Print LCS
- [ ] Longest Common Substring
- [ ] [Longest Palindromic Subsequence](https://leetcode.com/problems/longest-palindromic-subsequence/) (LC 516)
- [ ] [Minimum Insertions to Make String Palindrome](https://leetcode.com/problems/minimum-insertions-to-make-string-palindrome/) (LC 1312)
- [ ] [Minimum Insertions/Deletions to Convert String A to B](https://leetcode.com/problems/minimum-insertions-deletions-to-convert-string-a-to-b/) (LC 583)
- [ ] [Shortest Common Supersequence](https://leetcode.com/problems/shortest-common-supersequence/) (LC 1092)
- [ ] [Count Distinct Occurrences as a Subsequence](https://leetcode.com/problems/count-distinct-occurrences-as-a-subsequence/) (LC 115)
- [ ] [Edit Distance](https://leetcode.com/problems/edit-distance/) (LC 72)
- [ ] [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) (LC 44)

#### DP on Stocks

- [ ] [Best Time to Buy and Sell Stock I](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-i/) (LC 121)
- [ ] [Best Time to Buy and Sell Stock II](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/) (LC 122)
- [ ] [Best Time to Buy and Sell Stock III](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iii/) (LC 123)
- [ ] [Best Time to Buy and Sell Stock IV](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/) (LC 188)
- [ ] [Buy and Sell Stocks with Cooldown](https://leetcode.com/problems/buy-and-sell-stocks-with-cooldown/) (LC 309)
- [ ] [Buy and Sell Stocks with Transaction Fee](https://leetcode.com/problems/buy-and-sell-stocks-with-transaction-fee/) (LC 714)

#### DP on LIS

- [ ] [Longest Increasing Subsequence — O(n log n)](https://leetcode.com/problems/longest-increasing-subsequence/) (LC 300)
- [ ] Print Longest Increasing Subsequence
- [ ] Longest Bitonic Subsequence
- [ ] [Number of Longest Increasing Subsequences](https://leetcode.com/problems/number-of-longest-increasing-subsequences/) (LC 673)
- [ ] [Longest Divisible Subset](https://leetcode.com/problems/longest-divisible-subset/) (LC 368)
- [ ] [Longest String Chain](https://leetcode.com/problems/longest-string-chain/) (LC 1048)
- [ ] [Longest Arithmetic Subsequence of Given Difference](https://leetcode.com/problems/longest-arithmetic-subsequence-of-given-difference/) (LC 1218)

#### MCM / Partition DP

- [ ] Matrix Chain Multiplication — Recursive + Memoization
- [ ] Matrix Chain Multiplication — Bottom-Up
- [ ] [Minimum Cost to Cut a Stick](https://leetcode.com/problems/minimum-cost-to-cut-a-stick/) (LC 1547)
- [ ] [Burst Balloons](https://leetcode.com/problems/burst-balloons/) (LC 312)
- [ ] Evaluate Boolean Expression to True
- [ ] [Palindrome Partitioning II — Minimum Cuts](https://leetcode.com/problems/palindrome-partitioning-ii/) (LC 132)
- [ ] [Partition Array for Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/) (LC 1043)

---

### Step 16b: Dynamic Programming — Advanced

#### DP with Bitmask

- [ ] [Can I Win](https://leetcode.com/problems/can-i-win/) (LC 464) — Medium
- [ ] [Partition to K Equal Sum Subsets](https://leetcode.com/problems/partition-to-k-equal-sum-subsets/) (LC 698) — Medium
- [ ] [Stickers to Spell Word](https://leetcode.com/problems/stickers-to-spell-word/) (LC 691) — Hard
- [ ] [Smallest Sufficient Team](https://leetcode.com/problems/smallest-sufficient-team/) (LC 1125) — Hard
- [ ] [Maximum Students Taking Exam](https://leetcode.com/problems/maximum-students-taking-exam/) (LC 1349) — Hard
- [ ] [Number of Ways to Wear Different Hats to Each Other](https://leetcode.com/problems/number-of-ways-to-wear-different-hats-to-each-other/) (LC 1434) — Hard
- [ ] [Minimum Cost to Connect Two Groups of Points](https://leetcode.com/problems/minimum-cost-to-connect-two-groups-of-points/) (LC 1595) — Hard
- [ ] [Maximum Number of Achievable Transfer Requests](https://leetcode.com/problems/maximum-number-of-achievable-transfer-requests/) (LC 1601) — Hard
- [ ] Little Elephant and T-Shirts — Hard
- [ ] [Distribute Repeating Integers](https://leetcode.com/problems/distribute-repeating-integers/) (LC 1655) — Hard
- [ ] [Maximize Grid Happiness](https://leetcode.com/problems/maximize-grid-happiness/) (LC 1659) — Hard
- [ ] [Find Minimum Time to Finish All Jobs](https://leetcode.com/problems/find-minimum-time-to-finish-all-jobs/) (LC 1723) — Hard
- [ ] Minimum Sum of Values by Dividing Array — Hard
- [ ] [Shortest Path Visiting All Nodes](https://leetcode.com/problems/shortest-path-visiting-all-nodes/) (LC 847) — Hard
- [ ] Grouping — Hard
- [ ] Matching — Hard

#### Digit DP

- [ ] Counting Numbers — Hard
- [ ] [Non-negative Integers without Consecutive Ones](https://leetcode.com/problems/non-negative-integers-without-consecutive-ones/) (LC 600) — Hard
- [ ] [Numbers At Most N Given Digit Set](https://leetcode.com/problems/numbers-at-most-n-given-digit-set/) (LC 902) — Hard
- [ ] [Numbers With Repeated Digits](https://leetcode.com/problems/numbers-with-repeated-digits/) (LC 1012) — Hard
- [ ] [Number of Digit One](https://leetcode.com/problems/number-of-digit-one/) (LC 233) — Hard
- [ ] [Number of Beautiful Integers in the Range](https://leetcode.com/problems/number-of-beautiful-integers-in-the-range/) (LC 2827) — Hard
- [ ] [Count the Number of Powerful Integers](https://leetcode.com/problems/count-the-number-of-powerful-integers/) (LC 2999) — Hard
- [ ] [Find All Good Strings](https://leetcode.com/problems/find-all-good-strings/) (LC 1397) — Hard

#### DP on Trees

- [ ] [House Robber III](https://leetcode.com/problems/house-robber-iii/) (LC 337) — Medium
- [ ] [Longest ZigZag Path in a Binary Tree](https://leetcode.com/problems/longest-zigzag-path-in-a-binary-tree/) (LC 1372) — Medium
- [ ] [Maximum Score After Applying Operations on a Tree](https://leetcode.com/problems/maximum-score-after-applying-operations-on-a-tree/) (LC 2925) — Medium
- [ ] Subordinates — Medium
- [ ] Tree Matching — Hard
- [ ] [Maximum Sum BST in Binary Tree](https://leetcode.com/problems/maximum-sum-bst-in-binary-tree/) (LC 1373) — Hard
- [ ] [Number of Ways to Reorder Array to Get Same BST](https://leetcode.com/problems/number-of-ways-to-reorder-array-to-get-same-bst/) (LC 1569) — Hard
- [ ] [Maximum Points After Collecting Coins From All Nodes](https://leetcode.com/problems/maximum-points-after-collecting-coins-from-all-nodes/) (LC 2980) — Hard
- [ ] [Sum of Distances in Tree](https://leetcode.com/problems/sum-of-distances-in-tree/) (LC 834) — Hard
- [ ] [Count Paths That Can Form a Palindrome in a Tree](https://leetcode.com/problems/count-paths-that-can-form-a-palindrome-in-a-tree/) (LC 2791) — Hard
- [ ] [Find Number of Coins to Place in Tree Nodes](https://leetcode.com/problems/find-number-of-coins-to-place-in-tree-nodes/) (LC 2973) — Hard
- [ ] [Minimize the Total Price of the Trips](https://leetcode.com/problems/minimize-the-total-price-of-the-trips/) (LC 2646) — Hard
- [ ] Tree Distances 1 — Hard
- [ ] Tree Distances II — Hard
- [ ] Company Queries I — Hard
- [ ] Company Queries II — Hard
- [ ] Distance Queries — Hard
- [ ] Time Taken to Mark All Nodes — Hard

#### DP with Math

- [ ] [Ugly Number II](https://leetcode.com/problems/ugly-number-ii/) (LC 264) — Medium
- [ ] [Count Sorted Vowel Strings](https://leetcode.com/problems/count-sorted-vowel-strings/) (LC 1641) — Medium
- [ ] [Race Car](https://leetcode.com/problems/race-car/) (LC 818) — Hard
- [ ] [Super Egg Drop](https://leetcode.com/problems/super-egg-drop/) (LC 887) — Hard
- [ ] [Least Operators to Express Number](https://leetcode.com/problems/least-operators-to-express-number/) (LC 964) — Hard
- [ ] [Largest Multiple of Three](https://leetcode.com/problems/largest-multiple-of-three/) (LC 1363) — Hard
- [ ] [Kth Smallest Instructions](https://leetcode.com/problems/kth-smallest-instructions/) (LC 1643) — Hard
- [ ] [Number of Sets of K Non-Overlapping Line Segments](https://leetcode.com/problems/number-of-sets-of-k-non-overlapping-line-segments/) (LC 1621) — Medium
- [ ] [Domino and Tromino Tiling](https://leetcode.com/problems/domino-and-tromino-tiling/) (LC 790) — Medium
- [ ] [Count Numbers with Unique Digits](https://leetcode.com/problems/count-numbers-with-unique-digits/) (LC 357) — Medium
- [ ] [Minimum One Bit Operations to Make Integers Zero](https://leetcode.com/problems/minimum-one-bit-operations-to-make-integers-zero/) (LC 1611) — Hard
- [ ] [Find All Possible Stable Binary Arrays II](https://leetcode.com/problems/find-all-possible-stable-binary-arrays-ii/) (LC 3130) — Hard
- [ ] Counting Tilings — Hard

#### DP with Probability

- [ ] [Soup Servings](https://leetcode.com/problems/soup-servings/) (LC 808) — Medium
- [ ] [New 21 Game](https://leetcode.com/problems/new-21-game/) (LC 837) — Medium
- [ ] [Airplane Seat Assignment Probability](https://leetcode.com/problems/airplane-seat-assignment-probability/) (LC 1227) — Medium
- [ ] [Knight Probability in Chessboard](https://leetcode.com/problems/knight-probability-in-chessboard/) (LC 688) — Medium
- [ ] [Champagne Tower](https://leetcode.com/problems/champagne-tower/) (LC 799) — Medium
- [ ] Sushi — Hard
- [ ] Coins — Hard
- [ ] [Probability of a Two Boxes Having the Same Number of Distinct Balls](https://leetcode.com/problems/probability-of-a-two-boxes-having-the-same-number-of-distinct-balls/) (LC 1467) — Hard

---

### Step 17: Tries (7 problems)

- [ ] [Implement Trie I — Insert, Search, StartsWith](https://leetcode.com/problems/implement-trie-i/) (LC 208)
- [ ] Implement Trie II — Count Prefix, Count Word (Coding Ninjas)
- [ ] Longest String with All Prefixes (Complete String)
- [ ] Number of Distinct Substrings in a String
- [ ] Power Set — Bit Manipulation prerequisite
- [ ] [Maximum XOR of Two Numbers in an Array](https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/) (LC 421)
- [ ] [Maximum XOR with an Element from Array](https://leetcode.com/problems/maximum-xor-with-an-element-from-array/) (LC 1707)

---

### Step 18: Advanced Strings (9 problems)

- [ ] Minimum Number of Bracket Reversals
- [ ] [Count and Say](https://leetcode.com/problems/count-and-say/) (LC 38)
- [ ] Hashing in Strings — Rolling Hash
- [ ] [Count Occurrences of Anagrams](https://leetcode.com/problems/count-occurrences-of-anagrams/) (LC 438)
- [ ] [Compare Version Numbers](https://leetcode.com/problems/compare-version-numbers/) (LC 165)
- [ ] [Longest Palindromic Substring — DP approach](https://leetcode.com/problems/longest-palindromic-substring/) (LC 5)
- [ ] [Sum of Beauty of All Substrings](https://leetcode.com/problems/sum-of-beauty-of-all-substrings/) (LC 1781)
- [ ] [Count Distinct Substrings (Good Substrings)](https://leetcode.com/problems/count-distinct-substrings/) (LC 1930)
- [ ] [Shortest Palindrome — KMP](https://leetcode.com/problems/shortest-palindrome/) (LC 214)

---

### Expanded Pattern Practice Bank

Use this section as the imported full practice bank from the pasted list. Every row is a trackable checklist item. Rows with a confident LeetCode slug link directly to that problem; the rest point to the LeetCode problemset page so no problem is dropped.

#### Two Pointer on Arrays

- [ ] [Merge Two 2D Arrays by Summing Values](https://leetcode.com/problems/merge-two-2d-arrays-by-summing-values/) — Easy
- [ ] [Merge Sorted Array](https://leetcode.com/problems/merge-sorted-array/) — Easy
- [ ] [Sort Array by Parity](https://leetcode.com/problems/sort-array-by-parity/) — Easy
- [ ] [Sort Array by Parity II](https://leetcode.com/problems/sort-array-by-parity-ii/) — Easy
- [ ] [Rearrange Array Elements by Sign](https://leetcode.com/problems/rearrange-array-elements-by-sign/) — Medium
- [ ] [Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) — Easy
- [ ] [Remove Element](https://leetcode.com/problems/remove-element/) — Easy
- [ ] [Partition Array According to Given Pivot](https://leetcode.com/problems/partition-array-according-to-given-pivot/) — Medium
- [ ] [Rotate Array](https://leetcode.com/problems/rotate-array/) — Medium
- [ ] [Apply Operations to an Array](https://leetcode.com/problems/apply-operations-to-an-array/) — Easy
- [ ] [Find All K-Distant Indices in an Array](https://leetcode.com/problems/find-all-k-distant-indices-in-an-array/) — Easy
- [ ] [Two Sum](https://leetcode.com/problems/two-sum/) — Easy
- [ ] [3Sum](https://leetcode.com/problems/3sum/) — Medium
- [ ] [3Sum Closest](https://leetcode.com/problems/3sum-closest/) — Medium
- [ ] [4Sum](https://leetcode.com/problems/4sum/) — Medium
- [ ] [Sort Colors](https://leetcode.com/problems/sort-colors/) — Medium
- [ ] [Container With Most Water](https://leetcode.com/problems/container-with-most-water/) — Medium
- [ ] [Watering Plants II](https://leetcode.com/problems/watering-plants-ii/) — Medium
- [ ] [Next Permutation](https://leetcode.com/problems/next-permutation/) — Medium
- [ ] [Next Greater Element III](https://leetcode.com/problems/next-greater-element-iii/) — Medium


#### Two Pointer on Strings

- [ ] [Reverse String](https://leetcode.com/problems/reverse-string/) — Easy
- [ ] [Reverse Prefix of Word](https://leetcode.com/problems/reverse-prefix-of-word/) — Easy
- [ ] [Reverse Vowels of a String](https://leetcode.com/problems/reverse-vowels-of-a-string/) — Easy
- [ ] [Reverse Words in a String](https://leetcode.com/problems/reverse-words-in-a-string/) — Medium
- [ ] [Reverse Words in a String III](https://leetcode.com/problems/reverse-words-in-a-string-iii/) — Easy
- [ ] [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/) — Easy
- [ ] [Valid Palindrome II](https://leetcode.com/problems/valid-palindrome-ii/) — Easy
- [ ] [Lexicographically Smallest Palindrome](https://leetcode.com/problems/lexicographically-smallest-palindrome/) — Easy
- [ ] [Merge Strings Alternately](https://leetcode.com/problems/merge-strings-alternately/) — Easy
- [ ] [Largest Merge of Two Strings](https://leetcode.com/problems/largest-merge-of-two-strings/) — Medium
- [ ] [Shortest Distance to a Character](https://leetcode.com/problems/shortest-distance-to-a-character/) — Easy
- [ ] [DI String Match](https://leetcode.com/problems/di-string-match/) — Easy
- [ ] [Make String a Subsequence Using Cyclic Increments](https://leetcode.com/problems/make-string-a-subsequence-using-cyclic-increments/) — Medium
- [ ] [Count Binary Substrings](https://leetcode.com/problems/count-binary-substrings/) — Easy
- [ ] [Minimum Length of String After Deleting Similar Ends](https://leetcode.com/problems/minimum-length-of-string-after-deleting-similar-ends/) — Medium
- [ ] [String Compression](https://leetcode.com/problems/string-compression/) — Medium
- [ ] [Separate Black and White Balls](https://leetcode.com/problems/separate-black-and-white-balls/) — Medium
- [ ] [Move Pieces to Obtain a String](https://leetcode.com/problems/move-pieces-to-obtain-a-string/) — Medium
- [ ] [Sentence Similarity III](https://leetcode.com/problems/sentence-similarity-iii/) — Medium


#### Line Sweep

- [ ] [Maximum Population Year](https://leetcode.com/problems/maximum-population-year/) — Easy
- [ ] [Points That Intersect With Cars](https://leetcode.com/problems/points-that-intersect-with-cars/) — Easy
- [ ] [Pongal Bunk](https://leetcode.com/problems/pongal-bunk/) — Medium
- [ ] [Car Pooling](https://leetcode.com/problems/car-pooling/) — Medium
- [ ] [My Calendar II](https://leetcode.com/problems/my-calendar-ii/) — Medium
- [ ] [Shifting Letters II](https://leetcode.com/problems/shifting-letters-ii/) — Medium
- [ ] [Perfect Rectangle](https://leetcode.com/problems/perfect-rectangle/) — Hard
- [ ] [Rectangle Area II](https://leetcode.com/problems/rectangle-area-ii/) — Hard
- [ ] [Number of Flowers in Full Bloom](https://leetcode.com/problems/number-of-flowers-in-full-bloom/) — Hard


#### Matrix Transformation and Modification

- [ ] [Convert 1D Array Into 2D Array](https://leetcode.com/problems/convert-1d-array-into-2d-array/) — Easy
- [ ] [Modify the Matrix](https://leetcode.com/problems/modify-the-matrix/) — Easy
- [ ] [Set Matrix Zeroes](https://leetcode.com/problems/set-matrix-zeroes/) — Medium
- [ ] [Sort the Matrix Diagonally](https://leetcode.com/problems/sort-the-matrix-diagonally/) — Medium
- [ ] [Minimum Operations to Write the Letter Y on a Grid](https://leetcode.com/problems/minimum-operations-to-write-the-letter-y-on-a-grid/) — Medium
- [ ] [Shift 2D Grid](https://leetcode.com/problems/shift-2d-grid/) — Easy
- [ ] [Matrix Similarity After Cyclic Shifts](https://leetcode.com/problems/matrix-similarity-after-cyclic-shifts/) — Easy
- [ ] [Transpose Matrix](https://leetcode.com/problems/transpose-matrix/) — Easy
- [ ] [Rotate Image](https://leetcode.com/problems/rotate-image/) — Medium
- [ ] [Rotating the Box](https://leetcode.com/problems/rotating-the-box/) — Medium
- [ ] [Cyclically Rotating a Grid](https://leetcode.com/problems/cyclically-rotating-a-grid/) — Medium
- [ ] [Game of Life](https://leetcode.com/problems/game-of-life/) — Medium
- [ ] [Matrix Cells in Distance Order](https://leetcode.com/problems/matrix-cells-in-distance-order/) — Easy


#### Matrix Patterns and Validity Checks

- [ ] [Find Valid Matrix Given Row and Column Sums](https://leetcode.com/problems/find-valid-matrix-given-row-and-column-sums/) — Medium
- [ ] [Check if Matrix is X-Matrix](https://leetcode.com/problems/check-if-matrix-is-x-matrix/) — Easy
- [ ] [Queens That Can Attack the King](https://leetcode.com/problems/queens-that-can-attack-the-king/) — Medium
- [ ] [Max Increase to Keep City Skyline](https://leetcode.com/problems/max-increase-to-keep-city-skyline/) — Medium
- [ ] [Make a Square with the Same Color](https://leetcode.com/problems/make-a-square-with-the-same-color/) — Easy
- [ ] [Subrectangle Queries](https://leetcode.com/problems/subrectangle-queries/) — Easy
- [ ] [Count Submatrices with Top-Left Element and Sum Less Than k](https://leetcode.com/problems/count-submatrices-with-top-left-element-and-sum-less-than-k/) — Medium
- [ ] [Find the Minimum Area to Cover All Ones I](https://leetcode.com/problems/find-the-minimum-area-to-cover-all-ones-i/) — Medium
- [ ] [Find the Minimum Area to Cover All Ones II](https://leetcode.com/problems/find-the-minimum-area-to-cover-all-ones-ii/) — Hard
- [ ] [Valid Sudoku](https://leetcode.com/problems/valid-sudoku/) — Medium
- [ ] [Check if Move is Legal](https://leetcode.com/problems/check-if-move-is-legal/) — Medium
- [ ] [Valid Tic-Tac-Toe State](https://leetcode.com/problems/valid-tic-tac-toe-state/) — Medium
- [ ] [Number of Laser Beams in a Bank](https://leetcode.com/problems/number-of-laser-beams-in-a-bank/) — Medium
- [ ] [Where Will the Ball Fall](https://leetcode.com/problems/where-will-the-ball-fall/) — Medium
- [ ] [Image Overlap](https://leetcode.com/problems/image-overlap/) — Medium
- [ ] [Minimum Operations to Make a Uni-Value Grid](https://leetcode.com/problems/minimum-operations-to-make-a-uni-value-grid/) — Medium


#### Matrix Traversal and Summation

- [ ] [Row With Maximum Ones](https://leetcode.com/problems/row-with-maximum-ones/) — Easy
- [ ] [Richest Customer Wealth](https://leetcode.com/problems/richest-customer-wealth/) — Easy
- [ ] [Lucky Numbers in a Matrix](https://leetcode.com/problems/lucky-numbers-in-a-matrix/) — Easy
- [ ] [Equal Row and Column Pairs](https://leetcode.com/problems/equal-row-and-column-pairs/) — Medium
- [ ] [Difference Between Ones and Zeros in Row and Column](https://leetcode.com/problems/difference-between-ones-and-zeros-in-row-and-column/) — Medium
- [ ] [Matrix Diagonal Sum](https://leetcode.com/problems/matrix-diagonal-sum/) — Easy
- [ ] [Prime in Diagonal](https://leetcode.com/problems/prime-in-diagonal/) — Easy
- [ ] [Diagonal Traverse](https://leetcode.com/problems/diagonal-traverse/) — Medium
- [ ] [Matrix Block Sum](https://leetcode.com/problems/matrix-block-sum/) — Medium
- [ ] [Largest Local Values in a Matrix](https://leetcode.com/problems/largest-local-values-in-a-matrix/) — Easy
- [ ] [Maximum Sum of an Hourglass](https://leetcode.com/problems/maximum-sum-of-an-hourglass/) — Medium
- [ ] [Maximum Matrix Sum](https://leetcode.com/problems/maximum-matrix-sum/) — Medium
- [ ] [Find the Grid of Region Average](https://leetcode.com/problems/find-the-grid-of-region-average/) — Medium
- [ ] [Spiral Matrix](https://leetcode.com/problems/spiral-matrix/) — Medium
- [ ] [Spiral Matrix II](https://leetcode.com/problems/spiral-matrix-ii/) — Medium


#### Hashing - Implementary Problems

- [ ] [Find Common Elements Between Two Arrays](https://leetcode.com/problems/find-common-elements-between-two-arrays/) — Easy
- [ ] [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) — Easy
- [ ] [Sum of Unique Elements](https://leetcode.com/problems/sum-of-unique-elements/) — Easy
- [ ] [Find All Duplicates in an Array](https://leetcode.com/problems/find-all-duplicates-in-an-array/) — Medium
- [ ] [Check if All Characters Have Equal Number of Occurrences](https://leetcode.com/problems/check-if-all-characters-have-equal-number-of-occurrences/) — Easy
- [ ] [Unique Number of Occurrences](https://leetcode.com/problems/unique-number-of-occurrences/) — Easy
- [ ] [Find Common Characters](https://leetcode.com/problems/find-common-characters/) — Easy
- [ ] [Number of Good Pairs](https://leetcode.com/problems/number-of-good-pairs/) — Easy
- [ ] [Permutation Difference Between Two Strings](https://leetcode.com/problems/permutation-difference-between-two-strings/) — Easy
- [ ] [Check if the Sentence is Pangram](https://leetcode.com/problems/check-if-the-sentence-is-pangram/) — Easy
- [ ] [Decode the Message](https://leetcode.com/problems/decode-the-message/) — Easy
- [ ] [Replace Elements in an Array](https://leetcode.com/problems/replace-elements-in-an-array/) — Medium
- [ ] [Count the Number of Special Characters II](https://leetcode.com/problems/count-the-number-of-special-characters-ii/) — Medium
- [ ] [Reconstruct Original Digits from English](https://leetcode.com/problems/reconstruct-original-digits-from-english/) — Medium
- [ ] [Integer to Roman](https://leetcode.com/problems/integer-to-roman/) — Medium
- [ ] [Find Words That Can Be Formed by Characters](https://leetcode.com/problems/find-words-that-can-be-formed-by-characters/) — Easy
- [ ] [Find the XOR of Numbers Which Appear Twice](https://leetcode.com/problems/find-the-xor-of-numbers-which-appear-twice/) — Easy
- [ ] [Sort the People](https://leetcode.com/problems/sort-the-people/) — Easy
- [ ] [Form Smallest Number from Two-Digit Arrays](https://leetcode.com/problems/form-smallest-number-from-two-digit-arrays/) — Easy
- [ ] [Increasing Decreasing String](https://leetcode.com/problems/increasing-decreasing-string/) — Easy
- [ ] [Sort Array by Increasing Frequency](https://leetcode.com/problems/sort-array-by-increasing-frequency/) — Easy
- [ ] [Sort Characters by Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) — Medium
- [ ] [Merge Similar Items](https://leetcode.com/problems/merge-similar-items/) — Easy
- [ ] [Substrings of Size Three with Distinct Characters](https://leetcode.com/problems/substrings-of-size-three-with-distinct-characters/) — Easy
- [ ] [Clear Digits](https://leetcode.com/problems/clear-digits/) — Easy
- [ ] [HTML Entity Parser](https://leetcode.com/problems/html-entity-parser/) — Medium
- [ ] [Largest Substring Between Two Equal Characters](https://leetcode.com/problems/largest-substring-between-two-equal-characters/) — Easy
- [ ] [Remove Letter to Equalize Frequency](https://leetcode.com/problems/remove-letter-to-equalize-frequency/) — Easy
- [ ] [Distribute Candies](https://leetcode.com/problems/distribute-candies/) — Easy
- [ ] [Path Crossing](https://leetcode.com/problems/path-crossing/) — Easy
- [ ] [Buddy Strings](https://leetcode.com/problems/buddy-strings/) — Easy
- [ ] [Word Pattern](https://leetcode.com/problems/word-pattern/) — Easy
- [ ] [Valid Anagram](https://leetcode.com/problems/valid-anagram/) — Easy
- [ ] [Find Resultant Array After Removing Anagrams](https://leetcode.com/problems/find-resultant-array-after-removing-anagrams/) — Easy
- [ ] [Group Anagrams](https://leetcode.com/problems/group-anagrams/) — Medium
- [ ] [Majority Element](https://leetcode.com/problems/majority-element/) — Easy
- [ ] [Majority Element II](https://leetcode.com/problems/majority-element-ii/) — Medium
- [ ] [Find All Lonely Numbers in the Array](https://leetcode.com/problems/find-all-lonely-numbers-in-the-array/) — Medium
- [ ] [Smallest Missing Integer Greater Than Sequential Prefix Sum](https://leetcode.com/problems/smallest-missing-integer-greater-than-sequential-prefix-sum/) — Easy
- [ ] [First Missing Positive](https://leetcode.com/problems/first-missing-positive/) — Hard
- [ ] [Shortest Impossible Sequence of Rolls](https://leetcode.com/problems/shortest-impossible-sequence-of-rolls/) — Hard
- [ ] [Find Occurrences of an Element in an Array](https://leetcode.com/problems/find-occurrences-of-an-element-in-an-array/) — Medium
- [ ] [Redistribute Characters to Make All Strings Equal](https://leetcode.com/problems/redistribute-characters-to-make-all-strings-equal/) — Easy
- [ ] [Isomorphic Strings](https://leetcode.com/problems/isomorphic-strings/) — Easy
- [ ] [Groups of Special Equivalent Strings](https://leetcode.com/problems/groups-of-special-equivalent-strings/) — Medium
- [ ] [Word Subsets](https://leetcode.com/problems/word-subsets/) — Medium
- [ ] [Find the Maximum Number of Elements in Subset](https://leetcode.com/problems/find-the-maximum-number-of-elements-in-subset/) — Medium
- [ ] [People Whose List of Favorite Companies is Not a Subset of Another List](https://leetcode.com/problems/people-whose-list-of-favorite-companies-is-not-a-subset-of-another-list/) — Medium
- [ ] [Count the Number of Good Partitions](https://leetcode.com/problems/count-the-number-of-good-partitions/) — Hard
- [ ] [Optimal Partition of String](https://leetcode.com/problems/optimal-partition-of-string/) — Medium
- [ ] [Custom Sort String](https://leetcode.com/problems/custom-sort-string/) — Medium
- [ ] [Finding the Users Active Minutes](https://leetcode.com/problems/finding-the-users-active-minutes/) — Medium
- [ ] [Convert an Array into a 2D Array with Conditions](https://leetcode.com/problems/convert-an-array-into-a-2d-array-with-conditions/) — Medium
- [ ] [Group the People Given the Group Size They Belong To](https://leetcode.com/problems/group-the-people-given-the-group-size-they-belong-to/) — Medium
- [ ] [Evaluate the Bracket Pairs of a String](https://leetcode.com/problems/evaluate-the-bracket-pairs-of-a-string/) — Medium
- [ ] [Minimum Number of Operations to Make Word K-Periodic](https://leetcode.com/problems/minimum-number-of-operations-to-make-word-k-periodic/) — Medium
- [ ] [Can Convert String in K Moves](https://leetcode.com/problems/can-convert-string-in-k-moves/) — Medium
- [ ] [Restore the Array from Adjacent Pairs](https://leetcode.com/problems/restore-the-array-from-adjacent-pairs/) — Medium
- [ ] [Tuple with Same Product](https://leetcode.com/problems/tuple-with-same-product/) — Medium
- [ ] [Split the Array to Make Coprime Products](https://leetcode.com/problems/split-the-array-to-make-coprime-products/) — Hard
- [ ] [4Sum II](https://leetcode.com/problems/4sum-ii/) — Medium
- [ ] [Count Artifacts That Can Be Extracted](https://leetcode.com/problems/count-artifacts-that-can-be-extracted/) — Medium
- [ ] [Brick Wall](https://leetcode.com/problems/brick-wall/) — Medium
- [ ] [Pairs of Songs with Total Durations Divisible by 60](https://leetcode.com/problems/pairs-of-songs-with-total-durations-divisible-by-60/) — Medium
- [ ] [Alphabet Board Path](https://leetcode.com/problems/alphabet-board-path/) — Medium
- [ ] [Vowel Spellchecker](https://leetcode.com/problems/vowel-spellchecker/) — Medium
- [ ] [Bulls and Cows](https://leetcode.com/problems/bulls-and-cows/) — Medium
- [ ] [Card Flipping Game](https://leetcode.com/problems/card-flipping-game/) — Medium
- [ ] [Maximum Size of a Set After Removals](https://leetcode.com/problems/maximum-size-of-a-set-after-removals/) — Medium
- [ ] [Minimum Absolute Difference Queries](https://leetcode.com/problems/minimum-absolute-difference-queries/) — Medium
- [ ] [Check if Array Pairs are Divisible by K](https://leetcode.com/problems/check-if-array-pairs-are-divisible-by-k/) — Medium
- [ ] [Count Pairs That Form a Complete Day II](https://leetcode.com/problems/count-pairs-that-form-a-complete-day-ii/) — Medium
- [ ] [Count Number of Bad Pairs](https://leetcode.com/problems/count-number-of-bad-pairs/) — Medium
- [ ] [Minimum Seconds to Equalize a Circular Array](https://leetcode.com/problems/minimum-seconds-to-equalize-a-circular-array/) — Medium
- [ ] [Sum of Imbalance Numbers of All Subarrays](https://leetcode.com/problems/sum-of-imbalance-numbers-of-all-subarrays/) — Hard
- [ ] [Grid Illumination](https://leetcode.com/problems/grid-illumination/) — Hard
- [ ] [Maximum Equal Frequency](https://leetcode.com/problems/maximum-equal-frequency/) — Hard
- [ ] [Rearranging Fruits](https://leetcode.com/problems/rearranging-fruits/) — Hard


#### Fixed Size Sliding-Window

- [ ] [Substrings of Size Three with Distinct Characters](https://leetcode.com/problems/substrings-of-size-three-with-distinct-characters/) — Easy
- [ ] [Find All Anagrams in a String](https://leetcode.com/problems/find-all-anagrams-in-a-string/) — Medium
- [ ] [Permutation in String](https://leetcode.com/problems/permutation-in-string/) — Medium
- [ ] [Check If a String Contains All Binary Codes of Size K](https://leetcode.com/problems/check-if-a-string-contains-all-binary-codes-of-size-k/) — Medium
- [ ] [Maximum Number of Vowels in a Substring of Given Length](https://leetcode.com/problems/maximum-number-of-vowels-in-a-substring-of-given-length/) — Medium
- [ ] [Maximum Average Subarray I](https://leetcode.com/problems/maximum-average-subarray-i/) — Easy
- [ ] [Number of Sub-arrays of Size K and Average Greater than or Equal to Threshold](https://leetcode.com/problems/number-of-sub-arrays-of-size-k-and-average-greater-than-or-equal-to-threshold/) — Medium
- [ ] [K Radius Subarray Averages](https://leetcode.com/problems/k-radius-subarray-averages/) — Medium
- [ ] [Maximum Sum of Distinct Subarrays With Length K](https://leetcode.com/problems/maximum-sum-of-distinct-subarrays-with-length-k/) — Medium
- [ ] [Sliding Subarray Beauty](https://leetcode.com/problems/sliding-subarray-beauty/) — Medium
- [ ] [Maximum Points You Can Obtain from Cards](https://leetcode.com/problems/maximum-points-you-can-obtain-from-cards/) — Medium
- [ ] [Sliding Window Median](https://leetcode.com/problems/sliding-window-median/) — Hard
- [ ] [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) — Hard
- [ ] [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) — Hard
- [ ] [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) — Hard


#### Dynamic Size Sliding-Window

- [ ] [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) — Medium
- [ ] [Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/) — Medium
- [ ] [Maximum Number of Occurrences of a Substring](https://leetcode.com/problems/maximum-number-of-occurrences-of-a-substring/) — Medium
- [ ] [Max Consecutive Ones III](https://leetcode.com/problems/max-consecutive-ones-iii/) — Medium
- [ ] [Count the Number of Substrings With Dominant Ones](https://leetcode.com/problems/count-the-number-of-substrings-with-dominant-ones/) — Medium
- [ ] [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/) — Hard
- [ ] [Substring with Concatenation of All Words](https://leetcode.com/problems/substring-with-concatenation-of-all-words/) — Hard
- [ ] [Minimum Size Subarray Sum](https://leetcode.com/problems/minimum-size-subarray-sum/) — Medium
- [ ] [Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit](https://leetcode.com/problems/longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit/) — Medium
- [ ] [Fruit Into Baskets](https://leetcode.com/problems/fruit-into-baskets/) — Medium
- [ ] [Subarray Product Less Than K](https://leetcode.com/problems/subarray-product-less-than-k/) — Medium
- [ ] [Grumpy Bookstore Owner](https://leetcode.com/problems/grumpy-bookstore-owner/) — Medium
- [ ] [Moving Stones Until Consecutive II](https://leetcode.com/problems/moving-stones-until-consecutive-ii/) — Medium
- [ ] [Count Number of Nice Subarrays](https://leetcode.com/problems/count-number-of-nice-subarrays/) — Medium
- [ ] [Number of Subarrays with Bounded Maximum](https://leetcode.com/problems/number-of-subarrays-with-bounded-maximum/) — Medium
- [ ] [Maximum Erasure Value](https://leetcode.com/problems/maximum-erasure-value/) — Medium
- [ ] [Longest Subarray of 1s After Deleting One Element](https://leetcode.com/problems/longest-subarray-of-1s-after-deleting-one-element/) — Medium
- [ ] [Count the Number of Good Subarrays](https://leetcode.com/problems/count-the-number-of-good-subarrays/) — Medium
- [ ] [Minimum Consecutive Cards to Pick Up](https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/) — Medium
- [ ] [Minimum Operations to Reduce X to Zero](https://leetcode.com/problems/minimum-operations-to-reduce-x-to-zero/) — Medium
- [ ] [Frequency of the Most Frequent Element](https://leetcode.com/problems/frequency-of-the-most-frequent-element/) — Medium
- [ ] [Subarrays with K Different Integers](https://leetcode.com/problems/subarrays-with-k-different-integers/) — Hard


#### Linked List Part 1

- [ ] [Convert Binary Number in a Linked List to Integer](https://leetcode.com/problems/convert-binary-number-in-a-linked-list-to-integer/) — Easy
- [ ] [Intersection of Two Linked Lists](https://leetcode.com/problems/intersection-of-two-linked-lists/) — Easy
- [ ] [Middle of the Linked List](https://leetcode.com/problems/middle-of-the-linked-list/) — Easy
- [ ] [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/) — Easy
- [ ] [Linked List Cycle II](https://leetcode.com/problems/linked-list-cycle-ii/) — Medium
- [ ] [Find Length of Loop](https://leetcode.com/problems/find-length-of-loop/) — Easy
- [ ] [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/) — Easy
- [ ] [Palindrome Linked List](https://leetcode.com/problems/palindrome-linked-list/) — Easy
- [ ] [Reverse Nodes in k-Group](https://leetcode.com/problems/reverse-nodes-in-k-group/) — Hard
- [ ] [Odd Even Linked List](https://leetcode.com/problems/odd-even-linked-list/) — Easy
- [ ] [Remove Duplicates from Sorted List](https://leetcode.com/problems/remove-duplicates-from-sorted-list/) — Easy
- [ ] [Remove Nth Node From End of List](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) — Medium
- [ ] [Delete the Middle Node of a Linked List](https://leetcode.com/problems/delete-the-middle-node-of-a-linked-list/) — Medium
- [ ] [Add 1 to a Linked List Number](https://leetcode.com/problems/add-1-to-a-linked-list-number/) — Medium
- [ ] [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/) — Medium
- [ ] [Sort a Linked List of 0s, 1s, and 2s](https://leetcode.com/problems/sort-a-linked-list-of-0s-1s-and-2s/) — Medium
- [ ] [Sort List](https://leetcode.com/problems/sort-list/) — Medium
- [ ] [Linked List Random Node](https://leetcode.com/problems/linked-list-random-node/) — Medium
- [ ] [Copy List with Random Pointer](https://leetcode.com/problems/copy-list-with-random-pointer/) — Medium
- [ ] [Flattening a Linked List](https://leetcode.com/problems/flattening-a-linked-list/) — Medium
- [ ] [Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/) — Easy
- [ ] [Merge k Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) — Hard


#### Linked List Design Pattern

- [ ] [Design HashSet](https://leetcode.com/problems/design-hashset/) — Easy
- [ ] [Design HashMap](https://leetcode.com/problems/design-hashmap/) — Easy
- [ ] [Design Browser History](https://leetcode.com/problems/design-browser-history/) — Medium
- [ ] [Design a Text Editor](https://leetcode.com/problems/design-a-text-editor/) — Hard
- [ ] [All Oone Data Structure](https://leetcode.com/problems/all-oone-data-structure/) — Hard
- [ ] [LRU Cache](https://leetcode.com/problems/lru-cache/) — Medium
- [ ] [LFU Cache](https://leetcode.com/problems/lfu-cache/) — Hard


#### Stack - Parentheses Problem

- [ ] [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/) — Easy
- [ ] [Maximum Nesting Depth of the Parentheses](https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/) — Easy
- [ ] [Remove Outermost Parentheses](https://leetcode.com/problems/remove-outermost-parentheses/) — Easy
- [ ] [Minimum Add to Make Parentheses Valid](https://leetcode.com/problems/minimum-add-to-make-parentheses-valid/) — Medium
- [ ] [Minimum Remove to Make Valid Parentheses](https://leetcode.com/problems/minimum-remove-to-make-valid-parentheses/) — Medium
- [ ] [Maximum Nesting Depth of Two Valid Parentheses Strings](https://leetcode.com/problems/maximum-nesting-depth-of-two-valid-parentheses-strings/) — Medium
- [ ] [Check if a Parentheses String Can Be Valid](https://leetcode.com/problems/check-if-a-parentheses-string-can-be-valid/) — Medium
- [ ] [Reverse Substrings Between Each Pair of Parentheses](https://leetcode.com/problems/reverse-substrings-between-each-pair-of-parentheses/) — Medium
- [ ] [Score of Parentheses](https://leetcode.com/problems/score-of-parentheses/) — Medium
- [ ] [Minimum Insertions to Balance a Parentheses String](https://leetcode.com/problems/minimum-insertions-to-balance-a-parentheses-string/) — Medium
- [ ] [Longest Valid Parentheses](https://leetcode.com/problems/longest-valid-parentheses/) — Hard
- [ ] [Redundant Parenthesis](https://leetcode.com/problems/redundant-parenthesis/) — Hard


#### Stack - Design Problems

- [ ] [Min Stack](https://leetcode.com/problems/min-stack/) — Medium
- [ ] [Maximum Frequency Stack](https://leetcode.com/problems/maximum-frequency-stack/) — Hard
- [ ] [Design a Stack With Increment Operation](https://leetcode.com/problems/design-a-stack-with-increment-operation/) — Medium
- [ ] [Dinner Plate Stacks](https://leetcode.com/problems/dinner-plate-stacks/) — Hard


#### Advanced Stack Problems

- [ ] [Merge Intervals](https://leetcode.com/problems/merge-intervals/) — Medium
- [ ] [Insert Intervals](https://leetcode.com/problems/insert-intervals/) — Medium
- [ ] [Asteroid Collision](https://leetcode.com/problems/asteroid-collision/) — Medium
- [ ] [Construct Smallest Number From DI String](https://leetcode.com/problems/construct-smallest-number-from-di-string/) — Medium
- [ ] [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) — Medium
- [ ] [Simplify Path](https://leetcode.com/problems/simplify-path/) — Medium
- [ ] [Basic Calculator](https://leetcode.com/problems/basic-calculator/) — Hard
- [ ] [Basic Calculator II](https://leetcode.com/problems/basic-calculator-ii/) — Medium
- [ ] [Basic Calculator IV](https://leetcode.com/problems/basic-calculator-iv/) — Hard
- [ ] [Replace Non-Coprime Numbers in Array](https://leetcode.com/problems/replace-non-coprime-numbers-in-array/) — Hard
- [ ] [Robot Collisons](https://leetcode.com/problems/robot-collisons/) — Hard
- [ ] [Number of atoms](https://leetcode.com/problems/number-of-atoms/) — Hard


#### Monotonic Stack

- [ ] [Final Prices With a Special Discount in a Shop](https://leetcode.com/problems/final-prices-with-a-special-discount-in-a-shop/) — Easy
- [ ] [Next Greater Element I](https://leetcode.com/problems/next-greater-element-i/) — Easy
- [ ] [Next Greater Element II](https://leetcode.com/problems/next-greater-element-ii/) — Medium
- [ ] [Next Greater Element IV](https://leetcode.com/problems/next-greater-element-iv/) — Hard
- [ ] [Daily Temperatures](https://leetcode.com/problems/daily-temperatures/) — Medium
- [ ] [Car Fleet](https://leetcode.com/problems/car-fleet/) — Medium
- [ ] [Car Fleet II](https://leetcode.com/problems/car-fleet-ii/) — Hard
- [ ] [132 Pattern](https://leetcode.com/problems/132-pattern/) — Medium
- [ ] [Smallest Subsequence of Distinct Characters](https://leetcode.com/problems/smallest-subsequence-of-distinct-characters/) — Medium
- [ ] [Count Submatrices With All Ones](https://leetcode.com/problems/count-submatrices-with-all-ones/) — Medium
- [ ] [Remove Duplicate Letters](https://leetcode.com/problems/remove-duplicate-letters/) — Medium
- [ ] [The Number of Weak Characters in the Game](https://leetcode.com/problems/the-number-of-weak-characters-in-the-game/) — Medium
- [ ] [Maximum Subarray Min-Product](https://leetcode.com/problems/maximum-subarray-min-product/) — Medium
- [ ] [Sum of Subarray Minimums](https://leetcode.com/problems/sum-of-subarray-minimums/) — Medium
- [ ] [Shortest Unsorted Continuous Subarray](https://leetcode.com/problems/shortest-unsorted-continuous-subarray/) — Medium
- [ ] [Remove K Digits](https://leetcode.com/problems/remove-k-digits/) — Medium
- [ ] [Beautiful Towers I](https://leetcode.com/problems/beautiful-towers-i/) — Medium
- [ ] [Beautiful Towers II](https://leetcode.com/problems/beautiful-towers-ii/) — Medium
- [ ] [Online Stock Span](https://leetcode.com/problems/online-stock-span/) — Medium
- [ ] [Minimum Number of Increments on Subarrays to Form a Target Array](https://leetcode.com/problems/minimum-number-of-increments-on-subarrays-to-form-a-target-array/) — Hard
- [ ] [Maximum Score of a Good Subarray](https://leetcode.com/problems/maximum-score-of-a-good-subarray/) — Hard
- [ ] [Number of Visible People in a Queue](https://leetcode.com/problems/number-of-visible-people-in-a-queue/) — Hard
- [ ] [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) — Hard
- [ ] [Maximal Rectangle](https://leetcode.com/problems/maximal-rectangle/) — Hard
- [ ] [Largest Rectangle in Histogram](https://leetcode.com/problems/largest-rectangle-in-histogram/) — Hard
- [ ] [Create Maximum Number](https://leetcode.com/problems/create-maximum-number/) — Hard
- [ ] [Find Building Where Alice And Bob Can Meet](https://leetcode.com/problems/find-building-where-alice-and-bob-can-meet/) — Hard
- [ ] [Sum Of Total Strength Of Wizards](https://leetcode.com/problems/sum-of-total-strength-of-wizards/) — Hard
- [ ] [Find the Number of Subarrays Where Boundary Elements Are Maximum](https://leetcode.com/problems/find-the-number-of-subarrays-where-boundary-elements-are-maximum/) — Hard


#### Queue

- [ ] [C++ STL queue](https://leetcode.com/problems/c-stl-queue/) — Easy
- [ ] [Implement Queue using Array](https://leetcode.com/problems/implement-queue-using-array/) — Easy
- [ ] [Implement Stack using Queues](https://leetcode.com/problems/implement-stack-using-queues/) — Easy
- [ ] [Implement Queue using Stacks](https://leetcode.com/problems/implement-queue-using-stacks/) — Easy
- [ ] [Queue using Two Stacks](https://leetcode.com/problems/queue-using-two-stacks/) — Easy
- [ ] [Implement Queue using Linked List](https://leetcode.com/problems/implement-queue-using-linked-list/) — Easy
- [ ] [Design Circular Queue](https://leetcode.com/problems/design-circular-queue/) — Medium
- [ ] [Design Front Middle Back Queue](https://leetcode.com/problems/design-front-middle-back-queue/) — Medium
- [ ] [N-Queue using Array](https://leetcode.com/problems/n-queue-using-array/) — Hard
- [ ] [Reverse First K Elements of Queue](https://leetcode.com/problems/reverse-first-k-elements-of-queue/) — Easy
- [ ] [First Non-Repeating Character in a Stream](https://leetcode.com/problems/first-non-repeating-character-in-a-stream/) — Easy
- [ ] [First Negative Integer in Every Window of Size K](https://leetcode.com/problems/first-negative-integer-in-every-window-of-size-k/) — Medium
- [ ] [Dota2 Senate](https://leetcode.com/problems/dota2-senate/) — Medium
- [ ] [Find the Winner of the Circular Game](https://leetcode.com/problems/find-the-winner-of-the-circular-game/) — Medium
- [ ] [Reveal Cards in Increasing Order](https://leetcode.com/problems/reveal-cards-in-increasing-order/) — Medium
- [ ] [Minimum Number of K Consecutive Bit Flips](https://leetcode.com/problems/minimum-number-of-k-consecutive-bit-flips/) — Hard
- [ ] [Stamping the Sequence](https://leetcode.com/problems/stamping-the-sequence/) — Hard
- [ ] [Deque Implementations](https://leetcode.com/problems/deque-implementations/) — Easy
- [ ] [Design Circular Deque](https://leetcode.com/problems/design-circular-deque/) — Medium
- [ ] [Jump Game VI](https://leetcode.com/problems/jump-game-vi/) — Medium
- [ ] [Continuous Subarrays](https://leetcode.com/problems/continuous-subarrays/) — Medium
- [ ] [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) — Hard
- [ ] [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) — Hard
- [ ] [Shortest Subarray with Sum at Least K](https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/) — Hard
- [ ] [Constrained Subsequence Sum](https://leetcode.com/problems/constrained-subsequence-sum/) — Hard

#### Binary Search

- [ ] [Binary Search](https://leetcode.com/problems/binary-search/) — Easy
- [ ] [Guess Number Higher or Lower](https://leetcode.com/problems/guess-number-higher-or-lower/) — Easy
- [ ] [H-Index II](https://leetcode.com/problems/h-index-ii/) — Medium
- [ ] [Find First and Last Position of Element in Sorted Array](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/) — Medium
- [ ] [Special Array With X Elements Greater Than or Equal X](https://leetcode.com/problems/special-array-with-x-elements-greater-than-or-equal-x/) — Easy
- [ ] [Find Smallest Letter Greater Than Target](https://leetcode.com/problems/find-smallest-letter-greater-than-target/) — Easy
- [ ] [Longest Subsequence With Limited Sum](https://leetcode.com/problems/longest-subsequence-with-limited-sum/) — Easy
- [ ] [First Bad Version](https://leetcode.com/problems/first-bad-version/) — Easy
- [ ] [Arranging Coins](https://leetcode.com/problems/arranging-coins/) — Easy
- [ ] [Find the Distance Value Between Two Arrays](https://leetcode.com/problems/find-the-distance-value-between-two-arrays/) — Easy
- [ ] [Search Insert Position](https://leetcode.com/problems/search-insert-position/) — Easy
- [ ] [Find Target Indices After Sorting Array](https://leetcode.com/problems/find-target-indices-after-sorting-array/) — Easy
- [ ] [Find Right Interval](https://leetcode.com/problems/find-right-interval/) — Medium
- [ ] [Online Election](https://leetcode.com/problems/online-election/) — Medium
- [ ] [Most Beautiful Item for Each Query](https://leetcode.com/problems/most-beautiful-item-for-each-query/) — Medium
- [ ] [Time Based Key-Value Store](https://leetcode.com/problems/time-based-key-value-store/) — Medium
- [ ] [Random Pick with Weight](https://leetcode.com/problems/random-pick-with-weight/) — Medium
- [ ] [Plates Between Candles](https://leetcode.com/problems/plates-between-candles/) — Medium
- [ ] [Successful Pairs of Spells and Potions](https://leetcode.com/problems/successful-pairs-of-spells-and-potions/) — Medium
- [ ] [Range Frequency Queries](https://leetcode.com/problems/range-frequency-queries/) — Medium
- [ ] [Minimum Operations to Make All Array Elements Equal](https://leetcode.com/problems/minimum-operations-to-make-all-array-elements-equal/) — Medium
- [ ] [Count Number of Rectangles Containing Each Point](https://leetcode.com/problems/count-number-of-rectangles-containing-each-point/) — Medium
- [ ] [Count the Number of Fair Pairs](https://leetcode.com/problems/count-the-number-of-fair-pairs/) — Medium
- [ ] [Minimum Absolute Sum Difference](https://leetcode.com/problems/minimum-absolute-sum-difference/) — Medium
- [ ] [Find the Longest Valid Obstacle Course at Each Position](https://leetcode.com/problems/find-the-longest-valid-obstacle-course-at-each-position/) — Hard
- [ ] [Find the Number of Subarrays Where Boundary Elements Are Maximum](https://leetcode.com/problems/find-the-number-of-subarrays-where-boundary-elements-are-maximum/) — Hard
- [ ] [Count Negative Numbers in a Sorted Matrix](https://leetcode.com/problems/count-negative-numbers-in-a-sorted-matrix/) — Easy
- [ ] [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/) — Medium
- [ ] [Search a 2D Matrix II](https://leetcode.com/problems/search-a-2d-matrix-ii/) — Medium
- [ ] [Median in a Row-wise Sorted Matrix](https://leetcode.com/problems/median-in-a-row-wise-sorted-matrix/) — Hard
- [ ] [Missing Number](https://leetcode.com/problems/missing-number/) — Easy
- [ ] [Kth Missing Positive Number](https://leetcode.com/problems/kth-missing-positive-number/) — Easy
- [ ] [Single Element in a Sorted Array](https://leetcode.com/problems/single-element-in-a-sorted-array/) — Medium
- [ ] [Minimum Common Value](https://leetcode.com/problems/minimum-common-value/) — Easy
- [ ] [Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/) — Medium
- [ ] [Find Peak Element](https://leetcode.com/problems/find-peak-element/) — Medium
- [ ] [Find a Peak Element II](https://leetcode.com/problems/find-a-peak-element-ii/) — Medium
- [ ] [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) — Medium
- [ ] [Peak Index in a Mountain Array](https://leetcode.com/problems/peak-index-in-a-mountain-array/) — Medium
- [ ] [Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/) — Medium
- [ ] [Search in Rotated Sorted Array II](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) — Medium
- [ ] [Rotation](https://leetcode.com/problems/rotation/) — Medium
- [ ] [Find Minimum in Rotated Sorted Array II](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/) — Hard
- [ ] [Find in Mountain Array](https://leetcode.com/problems/find-in-mountain-array/) — Hard
- [ ] [Sqrt(x)](https://leetcode.com/problems/sqrt-x/) — Easy
- [ ] [Capacity to Ship Packages Within D Days](https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/) — Medium
- [ ] [Koko Eating Bananas](https://leetcode.com/problems/koko-eating-bananas/) — Medium
- [ ] [Find the Smallest Divisor Given a Threshold](https://leetcode.com/problems/find-the-smallest-divisor-given-a-threshold/) — Medium
- [ ] [Minimum Number of Days to Make M Bouquets](https://leetcode.com/problems/minimum-number-of-days-to-make-m-bouquets/) — Medium
- [ ] [Aggressive Cows](https://leetcode.com/problems/aggressive-cows/) — Medium
- [ ] [Maximum Candies Allocated to K Children](https://leetcode.com/problems/maximum-candies-allocated-to-k-children/) — Medium
- [ ] [Most Profit Assigning Work](https://leetcode.com/problems/most-profit-assigning-work/) — Medium
- [ ] [Maximum Value at a Given Index in a Bounded Array](https://leetcode.com/problems/maximum-value-at-a-given-index-in-a-bounded-array/) — Medium
- [ ] [Maximum Side Length of a Square With Sum Less Than or Equal to Threshold](https://leetcode.com/problems/maximum-side-length-of-a-square-with-sum-less-than-or-equal-to-threshold/) — Medium
- [ ] [Minimum Speed to Arrive on Time](https://leetcode.com/problems/minimum-speed-to-arrive-on-time/) — Medium
- [ ] [Minimum Time to Repair Cars](https://leetcode.com/problems/minimum-time-to-repair-cars/) — Medium
- [ ] [Maximum Number of Removable Characters](https://leetcode.com/problems/maximum-number-of-removable-characters/) — Medium
- [ ] [Heaters](https://leetcode.com/problems/heaters/) — Medium
- [ ] [Earliest Second to Mark Indices I](https://leetcode.com/problems/earliest-second-to-mark-indices-i/) — Medium
- [ ] [Maximum White Tiles Covered by a Carpet](https://leetcode.com/problems/maximum-white-tiles-covered-by-a-carpet/) — Medium
- [ ] [Minimum Absolute Difference Between Elements with Constraint](https://leetcode.com/problems/minimum-absolute-difference-between-elements-with-constraint/) — Medium
- [ ] [Sell Diminishing-Valued Colored Balls](https://leetcode.com/problems/sell-diminishing-valued-colored-balls/) — Medium
- [ ] [Ugly Number III](https://leetcode.com/problems/ugly-number-iii/) — Medium
- [ ] [Minimize the Maximum of Two Arrays](https://leetcode.com/problems/minimize-the-maximum-of-two-arrays/) — Medium
- [ ] [Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/) — Medium
- [ ] [Maximum Running Time of N Computers](https://leetcode.com/problems/maximum-running-time-of-n-computers/) — Medium
- [ ] [Maximum Number of Robots Within Budget](https://leetcode.com/problems/maximum-number-of-robots-within-budget/) — Hard
- [ ] [Maximum Number of Groups With Increasing Length](https://leetcode.com/problems/maximum-number-of-groups-with-increasing-length/) — Hard
- [ ] [Maximum Number of Tasks You Can Assign](https://leetcode.com/problems/maximum-number-of-tasks-you-can-assign/) — Hard
- [ ] [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/) — Hard
- [ ] [Magnetic Force Between Two Balls](https://leetcode.com/problems/magnetic-force-between-two-balls/) — Medium
- [ ] [Maximum Tastiness of Candy Basket](https://leetcode.com/problems/maximum-tastiness-of-candy-basket/) — Medium
- [ ] [Minimum Limit of Balls in a Bag](https://leetcode.com/problems/minimum-limit-of-balls-in-a-bag/) — Medium
- [ ] [Minimized Maximum of Products Distributed to Any Store](https://leetcode.com/problems/minimized-maximum-of-products-distributed-to-any-store/) — Medium
- [ ] [Minimize the Maximum Difference of Pairs](https://leetcode.com/problems/minimize-the-maximum-difference-of-pairs/) — Medium
- [ ] [Maximize the Minimum Powered City](https://leetcode.com/problems/maximize-the-minimum-powered-city/) — Hard
- [ ] [Kth Smallest Number in Multiplication Table](https://leetcode.com/problems/kth-smallest-number-in-multiplication-table/) — Hard
- [ ] [Find K-th Smallest Pair Distance](https://leetcode.com/problems/find-k-th-smallest-pair-distance/) — Hard
- [ ] [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) — Hard
- [ ] [Find the Median of the Uniqueness Array](https://leetcode.com/problems/find-the-median-of-the-uniqueness-array/) — Hard
- [ ] [Kth Smallest Product of Two Sorted Arrays](https://leetcode.com/problems/kth-smallest-product-of-two-sorted-arrays/) — Hard
- [ ] [Kth Smallest Amount With Single Denomination Combination](https://leetcode.com/problems/kth-smallest-amount-with-single-denomination-combination/) — Hard
- [ ] [Find the Kth Smallest Sum of a Matrix With Sorted Rows](https://leetcode.com/problems/find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows/) — Hard

#### Bit Manipulation

- [ ] [Decimal to Binary](https://leetcode.com/problems/decimal-to-binary/) — Easy
- [ ] [Get, Set, Clear ith Bit](https://leetcode.com/problems/get-set-clear-ith-bit/) — Easy
- [ ] [Kth Bit is Set or Not](https://leetcode.com/problems/kth-bit-is-set-or-not/) — Easy
- [ ] [Check Odd or Even](https://leetcode.com/problems/check-odd-or-even/) — Easy
- [ ] [Set the Rightmost Unset Bit](https://leetcode.com/problems/set-the-rightmost-unset-bit/) — Easy
- [ ] [Number Complement](https://leetcode.com/problems/number-complement/) — Easy
- [ ] [Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/) — Easy
- [ ] [Counting Bits](https://leetcode.com/problems/counting-bits/) — Easy
- [ ] [Count Total Set Bits](https://leetcode.com/problems/count-total-set-bits/) — Medium
- [ ] [Reverse Bits](https://leetcode.com/problems/reverse-bits/) — Easy
- [ ] [Power of Two](https://leetcode.com/problems/power-of-two/) — Easy
- [ ] [Power of Four](https://leetcode.com/problems/power-of-four/) — Easy
- [ ] [Hamming Distance](https://leetcode.com/problems/hamming-distance/) — Easy
- [ ] [Add Binary](https://leetcode.com/problems/add-binary/) — Easy
- [ ] [Total Hamming Distance](https://leetcode.com/problems/total-hamming-distance/) — Medium
- [ ] [UTF-8 Validation](https://leetcode.com/problems/utf-8-validation/) — Easy
- [ ] [Single Number II](https://leetcode.com/problems/single-number-ii/) — Medium
- [ ] [Divide Two Integers](https://leetcode.com/problems/divide-two-integers/) — Medium
- [ ] [Decode Xored Array](https://leetcode.com/problems/decode-xored-array/) — Easy
- [ ] [Single Number](https://leetcode.com/problems/single-number/) — Easy
- [ ] [Single Number III](https://leetcode.com/problems/single-number-iii/) — Medium
- [ ] [Sum of Two Integers](https://leetcode.com/problems/sum-of-two-integers/) — Medium
- [ ] [Swap Two Numbers with Temp Variable](https://leetcode.com/problems/swap-two-numbers-with-temp-variable/) — Easy
- [ ] [Missing Number](https://leetcode.com/problems/missing-number/) — Easy
- [ ] [Decode Xored Permutation](https://leetcode.com/problems/decode-xored-permutation/) — Easy
- [ ] [Find the Original Array of Prefix XOR](https://leetcode.com/problems/find-the-original-array-of-prefix-xor/) — Medium
- [ ] [Gray Code](https://leetcode.com/problems/gray-code/) — Medium
- [ ] [XOR Queries of a Subarray](https://leetcode.com/problems/xor-queries-of-a-subarray/) — Medium
- [ ] [XOR Sequences](https://leetcode.com/problems/xor-sequences/) — Medium
- [ ] [Minimum Number of Operations to Make Array XOR Equal to K](https://leetcode.com/problems/minimum-number-of-operations-to-make-array-xor-equal-to-k/) — Medium
- [ ] [Maximum XOR Product](https://leetcode.com/problems/maximum-xor-product/) — Medium
- [ ] [Neighboring Bitwise XOR](https://leetcode.com/problems/neighboring-bitwise-xor/) — Medium
- [ ] [Minimum XOR Sum of Two Arrays](https://leetcode.com/problems/minimum-xor-sum-of-two-arrays/) — Hard
- [ ] [Find XOR Sum of All Pairs Bitwise AND](https://leetcode.com/problems/find-xor-sum-of-all-pairs-bitwise-and/) — Hard
- [ ] [Find Longest Awesome Substring](https://leetcode.com/problems/find-longest-awesome-substring/) — Hard
- [ ] [Shortest Subarray with OR at Least K](https://leetcode.com/problems/shortest-subarray-with-or-at-least-k/) — Medium
- [ ] [Minimum Array End](https://leetcode.com/problems/minimum-array-end/) — Medium
- [ ] [Maximum OR](https://leetcode.com/problems/maximum-or/) — Medium
- [ ] [Find Subarray with Bitwise OR Closest to K](https://leetcode.com/problems/find-subarray-with-bitwise-or-closest-to-k/) — Hard
- [ ] [Minimize OR of Remaining Elements Using Operations](https://leetcode.com/problems/minimize-or-of-remaining-elements-using-operations/) — Hard
- [ ] [Minimum Flips to Make A or B Equal to C](https://leetcode.com/problems/minimum-flips-to-make-a-or-b-equal-to-c/) — Medium
- [ ] [Longest Nice Subarray](https://leetcode.com/problems/longest-nice-subarray/) — Medium
- [ ] [Bitwise AND of Numbers Range](https://leetcode.com/problems/bitwise-and-of-numbers-range/) — Medium
- [ ] [Longest Subarray with Maximum Bitwise AND](https://leetcode.com/problems/longest-subarray-with-maximum-bitwise-and/) — Medium
- [ ] [Number of Subarrays with AND Value of K](https://leetcode.com/problems/number-of-subarrays-with-and-value-of-k/) — Hard
- [ ] [Triples with Bitwise AND Equal to Zero](https://leetcode.com/problems/triples-with-bitwise-and-equal-to-zero/) — Hard
- [ ] [Minimum Operations to Form Subsequence with Target Sum](https://leetcode.com/problems/minimum-operations-to-form-subsequence-with-target-sum/) — Hard

#### Recursion and Backtracking

- [ ] [Power of Two](https://leetcode.com/problems/power-of-two/) — Easy
- [ ] [Power of Three](https://leetcode.com/problems/power-of-three/) — Easy
- [ ] [Power of Four](https://leetcode.com/problems/power-of-four/) — Easy
- [ ] [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/) — Easy
- [ ] [Pow(x, n)](https://leetcode.com/problems/pow-x-n/) — Medium
- [ ] [Count Good Numbers](https://leetcode.com/problems/count-good-numbers/) — Easy
- [ ] [Minimum Non-Zero Product of the Array Elements](https://leetcode.com/problems/minimum-non-zero-product-of-the-array-elements/) — Medium
- [ ] [Delete Middle Element of a Stack](https://leetcode.com/problems/delete-middle-element-of-a-stack/) — Easy
- [ ] [Sort a Stack](https://leetcode.com/problems/sort-a-stack/) — Medium
- [ ] [Josephus Problem](https://leetcode.com/problems/josephus-problem/) — Easy
- [ ] [Find the Winner of the Circular Game](https://leetcode.com/problems/find-the-winner-of-the-circular-game/) — Medium
- [ ] [Predict the Winner](https://leetcode.com/problems/predict-the-winner/) — Medium
- [ ] [Tower of Hanoi](https://leetcode.com/problems/tower-of-hanoi/) — Medium
- [ ] [Different Ways to Add Parentheses](https://leetcode.com/problems/different-ways-to-add-parentheses/) — Medium
- [ ] [Basic Calculator](https://leetcode.com/problems/basic-calculator/) — Hard
- [ ] [Permutation Sequence](https://leetcode.com/problems/permutation-sequence/) — Hard
- [ ] [Regular Expression Matching](https://leetcode.com/problems/regular-expression-matching/) — Hard
- [ ] [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) — Hard
- [ ] [Integer to English Words](https://leetcode.com/problems/integer-to-english-words/) — Hard
- [ ] [Special Binary String](https://leetcode.com/problems/special-binary-string/) — Hard
- [ ] [Permutations](https://leetcode.com/problems/permutations/) — Medium
- [ ] [Construct Smallest Number from DI String](https://leetcode.com/problems/construct-smallest-number-from-di-string/) — Medium
- [ ] [Beautiful Arrangement](https://leetcode.com/problems/beautiful-arrangement/) — Medium
- [ ] [Target Sum](https://leetcode.com/problems/target-sum/) — Medium
- [ ] [Combinations](https://leetcode.com/problems/combinations/) — Medium
- [ ] [Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/) — Medium
- [ ] [Letter Case Permutation](https://leetcode.com/problems/letter-case-permutation/) — Medium
- [ ] [K-th Lexicographical String of All Happy Strings of Length n](https://leetcode.com/problems/k-th-lexicographical-string-of-all-happy-strings-of-length-n/) — Medium
- [ ] [Combination Sum](https://leetcode.com/problems/combination-sum/) — Medium
- [ ] [Combination Sum II](https://leetcode.com/problems/combination-sum-ii/) — Medium
- [ ] [Combination Sum III](https://leetcode.com/problems/combination-sum-iii/) — Medium
- [ ] [Maximum Compatibility Score Sum](https://leetcode.com/problems/maximum-compatibility-score-sum/) — Medium
- [ ] [Numbers with Same Consecutive Differences](https://leetcode.com/problems/numbers-with-same-consecutive-differences/) — Medium
- [ ] [N-Queens](https://leetcode.com/problems/n-queens/) — Hard
- [ ] [Subsets](https://leetcode.com/problems/subsets/) — Medium
- [ ] [Subsets II](https://leetcode.com/problems/subsets-ii/) — Medium
- [ ] [Non-Decreasing Subsequences](https://leetcode.com/problems/non-decreasing-subsequences/) — Medium
- [ ] [Number of Beautiful Subsets](https://leetcode.com/problems/number-of-beautiful-subsets/) — Medium
- [ ] [Rat in a Maze Problem](https://leetcode.com/problems/rat-in-a-maze-problem/) — Medium
- [ ] [Sudoku Solver](https://leetcode.com/problems/sudoku-solver/) — Hard

#### Binary Tree and BST

- [ ] [Binary Tree Preorder Traversal](https://leetcode.com/problems/binary-tree-preorder-traversal/) — Easy
- [ ] [Binary Tree Inorder Traversal](https://leetcode.com/problems/binary-tree-inorder-traversal/) — Easy
- [ ] [Binary Tree Postorder Traversal](https://leetcode.com/problems/binary-tree-postorder-traversal/) — Easy
- [ ] [Preorder, Postorder, Inorder in a Single Traversal](https://leetcode.com/problems/preorder-postorder-inorder-in-a-single-traversal/) — Easy
- [ ] [Remove Half Nodes](https://leetcode.com/problems/remove-half-nodes/) — Easy
- [ ] [Balanced Binary Tree](https://leetcode.com/problems/balanced-binary-tree/) — Easy
- [ ] [Maximum Depth of Binary Tree](https://leetcode.com/problems/maximum-depth-of-binary-tree/) — Easy
- [ ] [Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/) — Easy
- [ ] [Count Complete Tree Nodes](https://leetcode.com/problems/count-complete-tree-nodes/) — Easy
- [ ] [Minimum Depth of Binary Tree](https://leetcode.com/problems/minimum-depth-of-binary-tree/) — Easy
- [ ] [Check Completeness of a Binary Tree](https://leetcode.com/problems/check-completeness-of-a-binary-tree/) — Medium
- [ ] [Construct Binary Tree from Parent Array](https://leetcode.com/problems/construct-binary-tree-from-parent-array/) — Medium
- [ ] [Linked List to Binary Tree](https://leetcode.com/problems/linked-list-to-binary-tree/) — Medium
- [ ] [Construct Binary Tree from Preorder and Inorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) — Medium
- [ ] [Construct Binary Tree from Inorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-inorder-and-postorder-traversal/) — Medium
- [ ] [Construct Binary Tree from Preorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-postorder-traversal/) — Medium
- [ ] [Construct Binary Tree from String with Bracket Representation](https://leetcode.com/problems/construct-binary-tree-from-string-with-bracket-representation/) — Medium
- [ ] [Same Tree](https://leetcode.com/problems/same-tree/) — Easy
- [ ] [Two Mirror Trees](https://leetcode.com/problems/two-mirror-trees/) — Easy
- [ ] [Merge Two Binary Trees](https://leetcode.com/problems/merge-two-binary-trees/) — Easy
- [ ] [Subtree of Another Tree](https://leetcode.com/problems/subtree-of-another-tree/) — Easy
- [ ] [Check if Tree is Isomorphic](https://leetcode.com/problems/check-if-tree-is-isomorphic/) — Easy
- [ ] [Leaf-Similar Trees](https://leetcode.com/problems/leaf-similar-trees/) — Easy
- [ ] [Check if Subtree](https://leetcode.com/problems/check-if-subtree/) — Medium
- [ ] [Mirror Tree](https://leetcode.com/problems/mirror-tree/) — Medium
- [ ] [Binary Tree Level Order Traversal](https://leetcode.com/problems/binary-tree-level-order-traversal/) — Medium
- [ ] [Binary Tree Level Order Traversal II](https://leetcode.com/problems/binary-tree-level-order-traversal-ii/) — Medium
- [ ] [Cousins in Binary Tree](https://leetcode.com/problems/cousins-in-binary-tree/) — Easy
- [ ] [Average of Levels in Binary Tree](https://leetcode.com/problems/average-of-levels-in-binary-tree/) — Easy
- [ ] [Minimum Number of Operations to Sort a Binary Tree by Level](https://leetcode.com/problems/minimum-number-of-operations-to-sort-a-binary-tree-by-level/) — Medium
- [ ] [Binary Tree Right Side View](https://leetcode.com/problems/binary-tree-right-side-view/) — Easy
- [ ] [Left View of Binary Tree](https://leetcode.com/problems/left-view-of-binary-tree/) — Easy
- [ ] [Top View of Binary Tree](https://leetcode.com/problems/top-view-of-binary-tree/) — Medium
- [ ] [Vertical Order Traversal of a Binary Tree](https://leetcode.com/problems/vertical-order-traversal-of-a-binary-tree/) — Hard
- [ ] [Serialize and Deserialize Binary Tree](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/) — Hard
- [ ] [All Nodes Distance K in Binary Tree](https://leetcode.com/problems/all-nodes-distance-k-in-binary-tree/) — Medium
- [ ] [Burning Tree](https://leetcode.com/problems/burning-tree/) — Hard
- [ ] [Populating Next Right Pointers in Each Node](https://leetcode.com/problems/populating-next-right-pointers-in-each-node/) — Medium
- [ ] [Binary Tree Paths](https://leetcode.com/problems/binary-tree-paths/) — Easy
- [ ] [Path Sum](https://leetcode.com/problems/path-sum/) — Easy
- [ ] [Children Sum in a Binary Tree](https://leetcode.com/problems/children-sum-in-a-binary-tree/) — Medium
- [ ] [Path Sum II](https://leetcode.com/problems/path-sum-ii/) — Medium
- [ ] [Sum Root to Leaf Numbers](https://leetcode.com/problems/sum-root-to-leaf-numbers/) — Medium
- [ ] [Binary Tree Maximum Path Sum](https://leetcode.com/problems/binary-tree-maximum-path-sum/) — Hard
- [ ] [Path Sum III](https://leetcode.com/problems/path-sum-iii/) — Medium
- [ ] [Lowest Common Ancestor of a Binary Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/) — Medium
- [ ] [N-ary Tree](https://leetcode.com/problems/n-ary-tree/) — Theory
- [ ] [N-ary Tree Postorder Traversal](https://leetcode.com/problems/n-ary-tree-postorder-traversal/) — Easy
- [ ] [N-ary Tree Preorder Traversal](https://leetcode.com/problems/n-ary-tree-preorder-traversal/) — Easy
- [ ] [Maximum Depth of N-ary Tree](https://leetcode.com/problems/maximum-depth-of-n-ary-tree/) — Easy
- [ ] [Search in a Binary Search Tree](https://leetcode.com/problems/search-in-a-binary-search-tree/) — Easy
- [ ] [Insert into a Binary Search Tree](https://leetcode.com/problems/insert-into-a-binary-search-tree/) — Medium
- [ ] [Delete Node in a BST](https://leetcode.com/problems/delete-node-in-a-bst/) — Medium
- [ ] [Convert Sorted Array to Binary Search Tree](https://leetcode.com/problems/convert-sorted-array-to-binary-search-tree/) — Easy
- [ ] [Convert Sorted List to Binary Search Tree](https://leetcode.com/problems/convert-sorted-list-to-binary-search-tree/) — Medium
- [ ] [Convert BST to Greater Tree](https://leetcode.com/problems/convert-bst-to-greater-tree/) — Medium
- [ ] [Trim a Binary Search Tree](https://leetcode.com/problems/trim-a-binary-search-tree/) — Medium
- [ ] [Serialize and Deserialize BST](https://leetcode.com/problems/serialize-and-deserialize-bst/) — Medium
- [ ] [Construct Binary Search Tree from Preorder Traversal](https://leetcode.com/problems/construct-binary-search-tree-from-preorder-traversal/) — Medium
- [ ] [Construct BST from Postorder](https://leetcode.com/problems/construct-bst-from-postorder/) — Medium
- [ ] [Balance a Binary Search Tree](https://leetcode.com/problems/balance-a-binary-search-tree/) — Medium
- [ ] [Binary Search Tree to Greater Sum Tree](https://leetcode.com/problems/binary-search-tree-to-greater-sum-tree/) — Medium
- [ ] [Find Mode in Binary Search Tree](https://leetcode.com/problems/find-mode-in-binary-search-tree/) — Easy
- [ ] [Range Sum of BST](https://leetcode.com/problems/range-sum-of-bst/) — Easy
- [ ] [Validate Binary Search Tree](https://leetcode.com/problems/validate-binary-search-tree/) — Medium
- [ ] [Minimum Distance Between BST Nodes](https://leetcode.com/problems/minimum-distance-between-bst-nodes/) — Easy
- [ ] [Kth Smallest Element in a BST](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) — Medium
- [ ] [Increasing Order Search Tree](https://leetcode.com/problems/increasing-order-search-tree/) — Easy
- [ ] [Two Sum IV - Input is a BST](https://leetcode.com/problems/two-sum-iv-input-is-a-bst/) — Easy
- [ ] [Maximum Sum BST in Binary Tree](https://leetcode.com/problems/maximum-sum-bst-in-binary-tree/) — Hard
- [ ] [Find Common Nodes in two BSTs](https://leetcode.com/problems/find-common-nodes-in-two-bsts/) — Medium
- [ ] [All Elements in Two Binary Search Trees](https://leetcode.com/problems/all-elements-in-two-binary-search-trees/) — Medium
- [ ] [Unique Binary Search Trees](https://leetcode.com/problems/unique-binary-search-trees/) — Medium
- [ ] [Recover Binary Search Tree](https://leetcode.com/problems/recover-binary-search-tree/) — Medium
- [ ] [Number of Ways to Reorder Array to Get Same BST](https://leetcode.com/problems/number-of-ways-to-reorder-array-to-get-same-bst/) — Hard
- [ ] [Binary Search Tree Iterator](https://leetcode.com/problems/binary-search-tree-iterator/) — Medium
- [ ] [Lowest Common Ancestor of a Binary Search Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) — Medium
- [ ] [Closest Nodes Queries in a Binary Search Tree](https://leetcode.com/problems/closest-nodes-queries-in-a-binary-search-tree/) — Medium

#### Heap Priority Queue

- [ ] [Implementation of Priority Queue using Binary Heap](https://leetcode.com/problems/implementation-of-priority-queue-using-binary-heap/) — Easy
- [ ] [Heap Sort](https://leetcode.com/problems/heap-sort/) — Medium
- [ ] [Does Array Represent Heap?](https://leetcode.com/problems/does-array-represent-heap/) — Easy
- [ ] [Is Binary Tree Heap?](https://leetcode.com/problems/is-binary-tree-heap/) — Medium
- [ ] [Operations on Binary Min Heap](https://leetcode.com/problems/operations-on-binary-min-heap/) — Medium
- [ ] [Convert Min Heap to Max Heap](https://leetcode.com/problems/convert-min-heap-to-max-heap/) — Medium
- [ ] [Relative Ranks](https://leetcode.com/problems/relative-ranks/) — Easy
- [ ] [Take Gifts From the Richest Pile](https://leetcode.com/problems/take-gifts-from-the-richest-pile/) — Easy
- [ ] [Last Stone Weight](https://leetcode.com/problems/last-stone-weight/) — Easy
- [ ] [Largest Number After Digit Swaps by Parity](https://leetcode.com/problems/largest-number-after-digit-swaps-by-parity/) — Easy
- [ ] [Minimum Amount of Time to Fill Cups](https://leetcode.com/problems/minimum-amount-of-time-to-fill-cups/) — Easy
- [ ] [Seat Reservation Manager](https://leetcode.com/problems/seat-reservation-manager/) — Medium
- [ ] [Sort Characters By Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) — Medium
- [ ] [Reduce Array Size to The Half](https://leetcode.com/problems/reduce-array-size-to-the-half/) — Medium
- [ ] [Longest Happy String](https://leetcode.com/problems/longest-happy-string/) — Medium
- [ ] [Reorganize String](https://leetcode.com/problems/reorganize-string/) — Medium
- [ ] [Maximum Average Pass Ratio](https://leetcode.com/problems/maximum-average-pass-ratio/) — Medium
- [ ] [Find Score of an Array After Marking All Elements](https://leetcode.com/problems/find-score-of-an-array-after-marking-all-elements/) — Medium
- [ ] [Furthest Building You Can Reach](https://leetcode.com/problems/furthest-building-you-can-reach/) — Medium
- [ ] [Distant Barcodes](https://leetcode.com/problems/distant-barcodes/) — Medium
- [ ] [Task Scheduler](https://leetcode.com/problems/task-scheduler/) — Medium
- [ ] [Maximal Score After Applying K Operations](https://leetcode.com/problems/maximal-score-after-applying-k-operations/) — Medium
- [ ] [Single Threaded CPU](https://leetcode.com/problems/single-threaded-cpu/) — Medium
- [ ] [Most Popular Video Creator](https://leetcode.com/problems/most-popular-video-creator/) — Medium
- [ ] [Total Cost to Hire K Workers](https://leetcode.com/problems/total-cost-to-hire-k-workers/) — Medium
- [ ] [Most Frequent IDs](https://leetcode.com/problems/most-frequent-ids/) — Medium
- [ ] [Process Tasks Using Servers](https://leetcode.com/problems/process-tasks-using-servers/) — Medium
- [ ] [Maximum Number of Eaten Apples](https://leetcode.com/problems/maximum-number-of-eaten-apples/) — Medium
- [ ] [Maximum Number of Events That Can Be Attended](https://leetcode.com/problems/maximum-number-of-events-that-can-be-attended/) — Medium
- [ ] [Minimum Operations to Exceed Threshold Value II](https://leetcode.com/problems/minimum-operations-to-exceed-threshold-value-ii/) — Medium
- [ ] [Put Marbles in Bags](https://leetcode.com/problems/put-marbles-in-bags/) — Hard
- [ ] [Maximum Spending After Buying Items](https://leetcode.com/problems/maximum-spending-after-buying-items/) — Hard
- [ ] [Trapping Rain Water II](https://leetcode.com/problems/trapping-rain-water-ii/) — Hard
- [ ] [Maximum Subsequence Score](https://leetcode.com/problems/maximum-subsequence-score/) — Medium
- [ ] [Maximum Performance of a Team](https://leetcode.com/problems/maximum-performance-of-a-team/) — Hard
- [ ] [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) — Hard
- [ ] [The Skyline Problem](https://leetcode.com/problems/the-skyline-problem/) — Hard
- [ ] [Maximum Elegance of a K-Length Subsequence](https://leetcode.com/problems/maximum-elegance-of-a-k-length-subsequence/) — Hard
- [ ] [The K Weakest Rows in a Matrix](https://leetcode.com/problems/the-k-weakest-rows-in-a-matrix/) — Easy
- [ ] [Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/) — Medium
- [ ] [Kth Largest Element in a Stream](https://leetcode.com/problems/kth-largest-element-in-a-stream/) — Easy
- [ ] [Find Subsequence of Length K With the Largest Sum](https://leetcode.com/problems/find-subsequence-of-length-k-with-the-largest-sum/) — Easy
- [ ] [K-th Smallest Prime Fraction](https://leetcode.com/problems/k-th-smallest-prime-fraction/) — Medium
- [ ] [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/) — Medium
- [ ] [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/) — Medium
- [ ] [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) — Medium
- [ ] [Find Kth Largest XOR Coordinate Value](https://leetcode.com/problems/find-kth-largest-xor-coordinate-value/) — Medium
- [ ] [Top K Frequent Words](https://leetcode.com/problems/top-k-frequent-words/) — Medium
- [ ] [Find K Closest Elements](https://leetcode.com/problems/find-k-closest-elements/) — Medium
- [ ] [Ugly Number II](https://leetcode.com/problems/ugly-number-ii/) — Medium
- [ ] [Find the Kth Largest Integer in the Array](https://leetcode.com/problems/find-the-kth-largest-integer-in-the-array/) — Medium
- [ ] [Reward Top K Students](https://leetcode.com/problems/reward-top-k-students/) — Medium
- [ ] [Query Kth Smallest Trimmed Number](https://leetcode.com/problems/query-kth-smallest-trimmed-number/) — Medium
- [ ] [K Highest Ranked Items Within a Price Range](https://leetcode.com/problems/k-highest-ranked-items-within-a-price-range/) — Medium
- [ ] [Find the Kth Smallest Sum of a Matrix With Sorted Rows](https://leetcode.com/problems/find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows/) — Hard
- [ ] [Find the K-Sum of an Array](https://leetcode.com/problems/find-the-k-sum-of-an-array/) — Hard
- [ ] [Remove Stones to Minimize the Total](https://leetcode.com/problems/remove-stones-to-minimize-the-total/) — Medium
- [ ] [Minimum Operations to Halve Array Sum](https://leetcode.com/problems/minimum-operations-to-halve-array-sum/) — Medium
- [ ] [The Number of the Smallest Unoccupied Chair](https://leetcode.com/problems/the-number-of-the-smallest-unoccupied-chair/) — Medium
- [ ] [Lexicographically Minimum String After Removing Stars](https://leetcode.com/problems/lexicographically-minimum-string-after-removing-stars/) — Medium
- [ ] [Replace Question Marks in String to Minimize Its Value](https://leetcode.com/problems/replace-question-marks-in-string-to-minimize-its-value/) — Medium
- [ ] [Minimum Sum of Squared Difference](https://leetcode.com/problems/minimum-sum-of-squared-difference/) — Medium
- [ ] [Minimum Cost to Hire K Workers](https://leetcode.com/problems/minimum-cost-to-hire-k-workers/) — Hard
- [ ] [Minimize Deviation in Array](https://leetcode.com/problems/minimize-deviation-in-array/) — Hard
- [ ] [Minimum Moves to Move a Box to Their Target Location](https://leetcode.com/problems/minimum-moves-to-move-a-box-to-their-target-location/) — Hard
- [ ] [Minimum Interval to Include Each Query](https://leetcode.com/problems/minimum-interval-to-include-each-query/) — Hard
- [ ] [Merge K Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) — Hard
- [ ] [Find K Pairs with Smallest Sums](https://leetcode.com/problems/find-k-pairs-with-smallest-sums/) — Hard
- [ ] [Merge K Sorted Arrays](https://leetcode.com/problems/merge-k-sorted-arrays/) — Medium
- [ ] [Number of Orders in the Backlog](https://leetcode.com/problems/number-of-orders-in-the-backlog/) — Medium
- [ ] [Sliding Window Median](https://leetcode.com/problems/sliding-window-median/) — Hard
- [ ] [IPO](https://leetcode.com/problems/ipo/) — Hard
- [ ] [Find Median from Data Stream](https://leetcode.com/problems/find-median-from-data-stream/) — Hard
- [ ] [Meeting Rooms III](https://leetcode.com/problems/meeting-rooms-iii/) — Hard
- [ ] [Time to Cross a Bridge](https://leetcode.com/problems/time-to-cross-a-bridge/) — Hard

#### Tries

- [ ] [Implement Trie (Prefix Tree)](https://leetcode.com/problems/implement-trie-prefix-tree/) — Medium
- [ ] [Trie Delete](https://leetcode.com/problems/trie-delete/) — Hard
- [ ] [Design Add and Search Words Data Structure](https://leetcode.com/problems/design-add-and-search-words-data-structure/) — Medium
- [ ] [Map Sum Pairs](https://leetcode.com/problems/map-sum-pairs/) — Medium
- [ ] [Maximum XOR of Two Numbers in an Array](https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/) — Hard
- [ ] [Minimum XOR Value Pair](https://leetcode.com/problems/minimum-xor-value-pair/) — Hard
- [ ] [Maximum XOR With an Element From Array](https://leetcode.com/problems/maximum-xor-with-an-element-from-array/) — Hard
- [ ] [Count Pairs With XOR in a Range](https://leetcode.com/problems/count-pairs-with-xor-in-a-range/) — Hard
- [ ] [Maximum Strong Pair XOR II](https://leetcode.com/problems/maximum-strong-pair-xor-ii/) — Hard
- [ ] [Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/) — Medium
- [ ] [Find the Length of the Longest Common Prefix](https://leetcode.com/problems/find-the-length-of-the-longest-common-prefix/) — Medium
- [ ] [Search Suggestions System](https://leetcode.com/problems/search-suggestions-system/) — Medium
- [ ] [Sum of Prefix Scores of Strings](https://leetcode.com/problems/sum-of-prefix-scores-of-strings/) — Hard
- [ ] [Prefix and Suffix Search](https://leetcode.com/problems/prefix-and-suffix-search/) — Hard
- [ ] [Longest Common Suffix Queries](https://leetcode.com/problems/longest-common-suffix-queries/) — Hard
- [ ] [Count Prefix and Suffix Pairs II](https://leetcode.com/problems/count-prefix-and-suffix-pairs-ii/) — Hard
- [ ] [Stream of Characters](https://leetcode.com/problems/stream-of-characters/) — Hard
- [ ] [Extra Characters in a String](https://leetcode.com/problems/extra-characters-in-a-string/) — Medium
- [ ] [Implement Magic Dictionary](https://leetcode.com/problems/implement-magic-dictionary/) — Medium
- [ ] [Number of Matching Subsequences](https://leetcode.com/problems/number-of-matching-subsequences/) — Medium
- [ ] [Camelcase Matching](https://leetcode.com/problems/camelcase-matching/) — Medium
- [ ] [Short Encoding of Words](https://leetcode.com/problems/short-encoding-of-words/) — Medium
- [ ] [Encrypt and Decrypt Strings](https://leetcode.com/problems/encrypt-and-decrypt-strings/) — Hard
- [ ] [Longest Word in Dictionary](https://leetcode.com/problems/longest-word-in-dictionary/) — Medium
- [ ] [Construct String With Minimum Cost](https://leetcode.com/problems/construct-string-with-minimum-cost/) — Hard
- [ ] [Shortest Uncommon Substring in an Array](https://leetcode.com/problems/shortest-uncommon-substring-in-an-array/) — Medium
- [ ] [Word Break](https://leetcode.com/problems/word-break/) — Medium
- [ ] [Word Break II](https://leetcode.com/problems/word-break-ii/) — Hard
- [ ] [Word Search II](https://leetcode.com/problems/word-search-ii/) — Hard
- [ ] [Palindrome Pairs](https://leetcode.com/problems/palindrome-pairs/) — Hard
- [ ] [Remove Sub-Folders from the Filesystem](https://leetcode.com/problems/remove-sub-folders-from-the-filesystem/) — Hard
- [ ] [Delete Duplicate Folders in System](https://leetcode.com/problems/delete-duplicate-folders-in-system/) — Medium

#### Advance Algorithm - Fenwick Tree

- [ ] [Alternating Groups III](https://leetcode.com/problems/alternating-groups-iii/) — Medium
- [ ] [Number of Pairs Satisfying Inequality](https://leetcode.com/problems/number-of-pairs-satisfying-inequality/) — Hard
- [ ] [Count Good Triplets in an Array](https://leetcode.com/problems/count-good-triplets-in-an-array/) — Hard
- [ ] [Booking Concert Tickets in Groups](https://leetcode.com/problems/booking-concert-tickets-in-groups/) — Hard

#### Advance Algorithm - Segment Tree

- [ ] [Longest Uploaded Prefix](https://leetcode.com/problems/longest-uploaded-prefix/) — Medium
- [ ] [Range Sum Query - Mutable](https://leetcode.com/problems/range-sum-query-mutable/) — Medium
- [ ] [Falling Squares](https://leetcode.com/problems/falling-squares/) — Hard
- [ ] [Range Module](https://leetcode.com/problems/range-module/) — Hard
- [ ] [Count of Range Sum](https://leetcode.com/problems/count-of-range-sum/) — Hard
- [ ] [Longest Substring of One Repeating Character](https://leetcode.com/problems/longest-substring-of-one-repeating-character/) — Hard
- [ ] [Maximum Sum Queries](https://leetcode.com/problems/maximum-sum-queries/) — Hard
- [ ] [Handling Sum Queries After Update](https://leetcode.com/problems/handling-sum-queries-after-update/) — Hard
- [ ] [Peaks in Array](https://leetcode.com/problems/peaks-in-array/) — Hard
- [ ] [Maximum Sum of Subsequence With Non-Adjacent Elements](https://leetcode.com/problems/maximum-sum-of-subsequence-with-non-adjacent-elements/) — Hard
- [ ] [Block Placement Queries](https://leetcode.com/problems/block-placement-queries/) — Hard

#### Advance Algorithm - Sparse Table

- [ ] [Range Minimum Query](https://leetcode.com/problems/range-minimum-query/) — Hard
- [ ] [Catapult that ball](https://leetcode.com/problems/catapult-that-ball/) — Hard
- [ ] [Miraculous](https://leetcode.com/problems/miraculous/) — Hard
- [ ] [Negative Score](https://leetcode.com/problems/negative-score/) — Hard
- [ ] [DIFERENCIJA](https://leetcode.com/problems/diferencija/) — Hard
- [ ] [Find a Value of a Mysterious Function Closest to Target](https://leetcode.com/problems/find-a-value-of-a-mysterious-function-closest-to-target/) — Hard
- [ ] [Maximum Binary Tree](https://leetcode.com/problems/maximum-binary-tree/) — Hard

#### String Matching Algos - Introduction

- [ ] [KMP Algorithm for Pattern Searching](https://leetcode.com/problems/kmp-algorithm-for-pattern-searching/) — Theory
- [ ] [Rabin-Karp Algorithm for Pattern Searching](https://leetcode.com/problems/rabin-karp-algorithm-for-pattern-searching/) — Theory
- [ ] [Z Algorithm (Linear-Time Pattern Searching Algorithm)](https://leetcode.com/problems/z-algorithm-linear-time-pattern-searching-algorithm/) — Theory

#### String Matching Algos - Implementary Problems

- [ ] [Count Prefix and Suffix Pairs II](https://leetcode.com/problems/count-prefix-and-suffix-pairs-ii/) — Hard
- [ ] [Number of Subarrays That Match a Pattern II](https://leetcode.com/problems/number-of-subarrays-that-match-a-pattern-ii/) — Hard
- [ ] [Minimum Time to Revert Word to Initial State II](https://leetcode.com/problems/minimum-time-to-revert-word-to-initial-state-ii/) — Hard
- [ ] [Find Beautiful Indices in the Given Array II](https://leetcode.com/problems/find-beautiful-indices-in-the-given-array-ii/) — Hard
- [ ] [String Transformation](https://leetcode.com/problems/string-transformation/) — Hard
- [ ] [Find Substring with Given Hash Value](https://leetcode.com/problems/find-substring-with-given-hash-value/) — Hard
- [ ] [Maximum Deletions on a String](https://leetcode.com/problems/maximum-deletions-on-a-string/) — Hard
- [ ] [Match Substring After Replacement](https://leetcode.com/problems/match-substring-after-replacement/) — Hard
- [ ] [Sum of Scores of Built Strings](https://leetcode.com/problems/sum-of-scores-of-built-strings/) — Hard
- [ ] [Find All Good Strings](https://leetcode.com/problems/find-all-good-strings/) — Hard
- [ ] [Longest Happy Prefix](https://leetcode.com/problems/longest-happy-prefix/) — Hard
- [ ] [Shortest Palindrome](https://leetcode.com/problems/shortest-palindrome/) — Hard
- [ ] [Distinct Echo Substrings](https://leetcode.com/problems/distinct-echo-substrings/) — Hard
- [ ] [Longest Chunked Palindrome Decomposition](https://leetcode.com/problems/longest-chunked-palindrome-decomposition/) — Hard
- [ ] [Maximum Product of the Length of Two Palindromic Substrings](https://leetcode.com/problems/maximum-product-of-the-length-of-two-palindromic-substrings/) — Hard
- [ ] [Longest Duplicate Substring](https://leetcode.com/problems/longest-duplicate-substring/) — Hard

---

### FAANG Must-Solve List

> **💡 Pattern Recognition:** These problems appear most frequently in FAANG interviews. Know each one well enough to code it from scratch without hints. Focus on explaining your approach before coding.

| Problem | Pattern | Difficulty |
|---------|---------|------------|
| [Two Sum](https://leetcode.com/problems/two-sum/) (LC 1) | Hash Map | Easy |
| 3[Sum](https://leetcode.com/problems/sum/) (LC 15) | Sort + Two Pointers | Medium |
| [Container With Most Water](https://leetcode.com/problems/container-with-most-water/) (LC 11) | Two Pointers | Medium |
| [Merge Intervals](https://leetcode.com/problems/merge-intervals/) (LC 56) | Sort + Sweep | Medium |
| [LRU Cache](https://leetcode.com/problems/lru-cache/) (LC 146) | DLL + HashMap | Medium |
| [LFU Cache](https://leetcode.com/problems/lfu-cache/) (LC 460) | HashMap + Min-heap | Hard |
| [Word Ladder](https://leetcode.com/problems/word-ladder/) (LC 127) | BFS | Hard |
| Course Schedule I+[II](https://leetcode.com/problems/ii/) (LC 207, 210) | Topo Sort | Medium |
| [Number of Islands](https://leetcode.com/problems/number-of-islands/) (LC 200) | BFS/DFS | Medium |
| [Coin Change](https://leetcode.com/problems/coin-change/) (LC 322) | DP | Medium |
| [LCS](https://leetcode.com/problems/lcs/) (LC 1143) | DP on Strings | Medium |
| [Edit Distance](https://leetcode.com/problems/edit-distance/) (LC 72) | DP on Strings | Hard |
| [Burst Balloons](https://leetcode.com/problems/burst-balloons/) (LC 312) | Partition DP | Hard |
| [Find Median from Stream](https://leetcode.com/problems/find-median-from-stream/) (LC 295) | Two Heaps | Hard |
| [Serialize/Deserialize Binary Tree](https://leetcode.com/problems/serialize-deserialize-binary-tree/) (LC 297) | BFS/DFS | Hard |
| [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/) (LC 4) | Binary Search | Hard |
| [Alien Dictionary](https://leetcode.com/problems/alien-dictionary/) (LC 269) | Topo Sort | Hard |
| [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) (LC 42) | Monotonic Stack | Hard |
| [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) (LC 239) | Monotonic Deque | Hard |
| [Longest Consecutive Sequence](https://leetcode.com/problems/longest-consecutive-sequence/) (LC 128) | HashSet | Medium |

---

### Complete Curriculum Problem Bank

> Comprehensive practice problem list organized by topic. Basic problems are implementation exercises (no LeetCode link).

#### Array Basics

- [ ] Print Each Element and Its Index in an Array — Basic
- [ ] Print Elements of an Array in Reverse Order — Basic
- [ ] Print Alternate Elements of an Array — Basic
- [ ] Create a Duplicate of an Array — Basic
- [ ] Create Two Arrays one for Odd Elements and one for Even Elements — Basic
- [ ] Calculate Sum and Product of Array Elements — Basic
- [ ] Count Occurrences of a Target Number in an Array — Basic
- [ ] Check if an Array is Sorted Forward, Backward or Not at All — Basic
- [ ] Count Unique and Duplicate Elements in an Array — Basic
- [ ] Check if Two Elements Exist with a Sum Equal to a Target Value — Basic
- [ ] Check if Three Elements Exist with a Sum Equal to a Target Value — Basic
- [ ] Find the Maximum Element in an Array — Basic
- [ ] Find the Minimum Element in an Array — Basic
- [ ] Find the Second Maximum Element; if None, Print -1 — Basic
- [ ] Find the Second Minimum Element; if None, Print -1 — Basic
- [ ] Insert an Element at the Xth Position, Shifting Right — Basic
- [ ] Delete an Element at the Xth Position, Shifting Left — Basic

#### String Basics

- [ ] Print ASCII Value of Each Character in a String — Basic
- [ ] Count Letters, Numbers, and Special Characters in a String — Basic
- [ ] Find the Difference between the Number of Consonants and Vowels — Basic
- [ ] Convert Uppercase to Lowercase and Vice Versa in a String — Basic
- [ ] Remove Leading, Trailing, and Extra Spaces in a String — Basic
- [ ] Count the Number of Words in a String — Basic
- [ ] Find the Maximum and Minimum Occurring Characters in a String — Basic
- [ ] Check if There are Two or Three Consecutive Identical Characters in a String — Basic
- [ ] Find the First and Last Index of Occurrence for Each Character in a String — Basic
- [ ] Check if a String Contains All Letters from 'a' to 'z' — Basic
- [ ] Insert a Character at the First, Last, and Kth Position in a String — Basic
- [ ] Remove the First, Last, and Kth Character from a String — Basic
- [ ] Find a Specific Substring within a String — Basic
- [ ] Generate All Possible Substrings of a String — Basic

#### Matrix Basics

- [ ] Print a Matrix Row-Wise and Column-Wise — Basic
- [ ] Calculate the Total Sum of Elements in a Matrix — Basic
- [ ] Calculate the Sum of Each Row and Each Column in a Matrix — Basic
- [ ] Find the Maximum and Minimum Values in Each Row of a Matrix — Basic
- [ ] Find the Maximum and Minimum Values in Each Column of a Matrix — Basic
- [ ] Add and Subtract Two Matrices — Basic
- [ ] Print the Upper Triangle and Lower Triangle of a Matrix — Basic
- [ ] Print the Left and Right Diagonals of a Matrix — Basic
- [ ] Print the Boundary Elements of a Matrix — Basic
- [ ] Sort the Matrix Row-Wise and Column-Wise — Basic
- [ ] Print the Matrix in a Zig-Zag Pattern — Basic
- [ ] Check if a Matrix is Symmetric — Basic
- [ ] Check if a Matrix is an Identity Matrix — Basic
- [ ] Check if a Matrix is Sparse (Mostly Zeroes) — Basic
- [ ] Find the Inverse of a Matrix — Basic

#### Math Basics

- [ ] Perform Basic Operations (Addition, Subtraction, Multiplication, Division) using Two Numbers — Basic
- [ ] Find the Sum of Digits of a Number — Basic
- [ ] Reverse a Given Number — Basic
- [ ] Check if a Number is a Palindrome — Basic
- [ ] Check if a Number is an Armstrong Number — Basic
- [ ] Count the Total Occurrences of the Digit '1' in All Positive Integers Less than or Equal to n — Basic
- [ ] Generate Fibonacci Numbers up to a Given Limit — Basic
- [ ] Calculate the Factorial of a Number — Basic
- [ ] Find the Number of Trailing Zeroes in the Factorial of a Given Number n — Basic
- [ ] Calculate the LCM and GCD of Two Numbers — Basic
- [ ] Check if a Number is Prime without using the Sieve of Eratosthenes — Basic
- [ ] Check if Two Numbers are Co-Prime — Basic
- [ ] Find All Divisors of a Given Number — Basic
- [ ] Perform Modulo Operations — Basic
- [ ] Check Divisibility Rules for Numbers from 1 to 20 — Basic

#### Recursion Basics

- [ ] Introduction to Recursion — Theory
- [ ] Getting a hang of Recursion — Theory
- [ ] Some simple problems using Recursion — Theory
- [ ] Fast Exponentiation — Theory
- [ ] Power of Three — Theory
- [ ] Recursion: Time & Space Complexity Analysis - 1 — Theory
- [ ] Recursion: Time & Space Complexity Analysis - 2 — Theory
- [ ] Time Complexity Analysis using Recurrence Relations — Theory
- [ ] Calculate the Sum of Numbers from 1 to N using Recursion — Basic
- [ ] Print the Fibonacci Series up to N Terms using Recursion — Basic
- [ ] Print the Elements of an Array using Recursion — Basic
- [ ] Count the Digits of a Given Number using Recursion — Basic
- [ ] Find the Sum of Digits of a Number using Recursion — Basic
- [ ] Find the GCD of Two Numbers using Recursion — Basic
- [ ] Find the Largest Element of an Array using Recursion — Basic
- [ ] Reverse a String using Recursion — Basic
- [ ] Find the Factorial of a Number using Recursion — Basic
- [ ] Convert a Decimal Number to Binary using Recursion — Basic
- [ ] Check if a Number is a Prime Number using Recursion — Basic
- [ ] Print Even or Odd Numbers in a Given Range using Recursion — Basic
- [ ] Multiply Two Matrices using Recursion — Basic
- [ ] Check if a Given String is a Palindrome using Recursion — Basic
- [ ] Copy One String to Another using Recursion — Basic
- [ ] Check if an Array is Sorted using Recursion — Basic

#### Sorting Algorithms

##### Bubble Sort
- [ ] Bubble Sort — Theory

##### Insertion Sort
- [ ] Insertion Sort Algorithm — Theory
- [ ] [Insertion Sort List](https://leetcode.com/problems/insertion-sort-list/) — Medium

##### Selection Sort
- [ ] Selection Sort Algorithm — Theory

##### Merge Sort
- [ ] Merge Sort — Theory
- [ ] [Count Inversions](https://leetcode.com/problems/count-of-smaller-numbers-after-self/) — Medium
- [ ] [Count of Smaller Numbers After Self](https://leetcode.com/problems/count-of-smaller-numbers-after-self/) — Hard
- [ ] [Count of Range Sum](https://leetcode.com/problems/count-of-range-sum/) — Hard
- [ ] [Reverse Pairs](https://leetcode.com/problems/reverse-pairs/) — Hard
- [ ] [Create Sorted Array through Instructions](https://leetcode.com/problems/create-sorted-array-through-instructions/) — Hard
- [ ] [Count Good Triplets in an Array](https://leetcode.com/problems/count-good-triplets-in-an-array/) — Hard
- [ ] [Number of Pairs Satisfying Inequality](https://leetcode.com/problems/number-of-pairs-satisfying-inequality/) — Hard

##### Quick Sort
- [ ] Quick Sort — Theory
- [ ] [Sort an Array](https://leetcode.com/problems/sort-an-array/) — Medium

##### Counting Sort
- [ ] Counting Sort — Theory
- [ ] [Relative Sort Array](https://leetcode.com/problems/relative-sort-array/) — Medium
- [ ] [Reduce Array Size to The Half](https://leetcode.com/problems/reduce-array-size-to-the-half/) — Medium
- [ ] [Maximum Ice Cream Bars](https://leetcode.com/problems/maximum-ice-cream-bars/) — Medium

##### Radix Sort
- [ ] Radix Sort — Theory

##### Bucket Sort
- [ ] Bucket Sort — Theory
- [ ] [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/) — Medium
- [ ] [Sort Characters By Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) — Medium
- [ ] [Maximum Gap](https://leetcode.com/problems/maximum-gap/) — Medium
- [ ] [Top K Frequent Words](https://leetcode.com/problems/top-k-frequent-words/) — Medium
- [ ] [Contains Duplicate III](https://leetcode.com/problems/contains-duplicate-iii/) — Hard

##### Cyclic Sort
- [ ] [First Missing Positive](https://leetcode.com/problems/first-missing-positive/) — Hard
- [ ] [Missing Number](https://leetcode.com/problems/missing-number/) — Easy
- [ ] [Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/) — Medium

##### Custom Sort
- [ ] Comparator Sort — Theory
- [ ] [Custom Sort String](https://leetcode.com/problems/custom-sort-string/) — Medium
- [ ] [Largest Number](https://leetcode.com/problems/largest-number/) — Medium
- [ ] [Sort the Jumbled Numbers](https://leetcode.com/problems/sort-the-jumbled-numbers/) — Medium
- [ ] [Rank Teams by Votes](https://leetcode.com/problems/rank-teams-by-votes/) — Medium
- [ ] [Merge Two 2D Arrays by Summing Values](https://leetcode.com/problems/merge-two-2d-arrays-by-summing-values/) — Easy
- [ ] [Merge Sorted Array](https://leetcode.com/problems/merge-sorted-array/) — Easy
- [ ] [Sort Array by Parity](https://leetcode.com/problems/sort-array-by-parity/) — Easy
- [ ] [Sort Array by Parity II](https://leetcode.com/problems/sort-array-by-parity-ii/) — Easy
- [ ] [Rearrange Array Elements by Sign](https://leetcode.com/problems/rearrange-array-elements-by-sign/) — Medium
- [ ] [Remove Duplicates from Sorted Array](https://leetcode.com/problems/remove-duplicates-from-sorted-array/) — Easy
- [ ] [Remove Element](https://leetcode.com/problems/remove-element/) — Easy
- [ ] [Partition Array According to Given Pivot](https://leetcode.com/problems/partition-array-according-to-given-pivot/) — Medium
- [ ] [Rotate Array](https://leetcode.com/problems/rotate-array/) — Medium
- [ ] [Apply Operations to an Array](https://leetcode.com/problems/apply-operations-to-an-array/) — Easy
- [ ] [Find All K-Distant Indices in an Array](https://leetcode.com/problems/find-all-k-distant-indices-in-an-array/) — Easy
- [ ] [Two Sum](https://leetcode.com/problems/two-sum/) — Easy
- [ ] [3Sum](https://leetcode.com/problems/3sum/) — Medium
- [ ] [3Sum Closest](https://leetcode.com/problems/3sum-closest/) — Medium
- [ ] [4Sum](https://leetcode.com/problems/4sum/) — Medium
- [ ] [Sort Colors](https://leetcode.com/problems/sort-colors/) — Medium
- [ ] [Container With Most Water](https://leetcode.com/problems/container-with-most-water/) — Medium
- [ ] [Watering Plants II](https://leetcode.com/problems/watering-plants-ii/) — Medium
- [ ] [Next Permutation](https://leetcode.com/problems/next-permutation/) — Medium
- [ ] [Next Greater Element III](https://leetcode.com/problems/next-greater-element-iii/) — Medium

#### Two Pointer on Strings

- [ ] [Reverse String](https://leetcode.com/problems/reverse-string/) — Easy
- [ ] [Reverse Prefix of Word](https://leetcode.com/problems/reverse-prefix-of-word/) — Easy
- [ ] [Reverse Vowels of a String](https://leetcode.com/problems/reverse-vowels-of-a-string/) — Easy
- [ ] [Reverse Words in a String](https://leetcode.com/problems/reverse-words-in-a-string/) — Medium
- [ ] [Reverse Words in a String III](https://leetcode.com/problems/reverse-words-in-a-string-iii/) — Easy
- [ ] [Valid Palindrome](https://leetcode.com/problems/valid-palindrome/) — Easy
- [ ] [Valid Palindrome II](https://leetcode.com/problems/valid-palindrome-ii/) — Easy
- [ ] [Lexicographically Smallest Palindrome](https://leetcode.com/problems/lexicographically-smallest-palindrome/) — Easy
- [ ] [Merge Strings Alternately](https://leetcode.com/problems/merge-strings-alternately/) — Easy
- [ ] [Largest Merge of Two Strings](https://leetcode.com/problems/largest-merge-of-two-strings/) — Medium
- [ ] [Shortest Distance to a Character](https://leetcode.com/problems/shortest-distance-to-a-character/) — Easy
- [ ] [DI String Match](https://leetcode.com/problems/di-string-match/) — Easy
- [ ] [Make String a Subsequence Using Cyclic Increments](https://leetcode.com/problems/make-string-a-subsequence-using-cyclic-increments/) — Medium
- [ ] [Count Binary Substrings](https://leetcode.com/problems/count-binary-substrings/) — Easy
- [ ] [Minimum Length of String After Deleting Similar Ends](https://leetcode.com/problems/minimum-length-of-string-after-deleting-similar-ends/) — Medium
- [ ] [String Compression](https://leetcode.com/problems/string-compression/) — Medium
- [ ] [Separate Black and White Balls](https://leetcode.com/problems/separate-black-and-white-balls/) — Medium
- [ ] [Move Pieces to Obtain a String](https://leetcode.com/problems/move-pieces-to-obtain-a-string/) — Medium
- [ ] [Sentence Similarity III](https://leetcode.com/problems/sentence-similarity-iii/) — Medium


#### Prefix Sum Problems

- [ ] [Range Sum Query - Immutable](https://leetcode.com/problems/range-sum-query-immutable/) — Easy
- [ ] [Left and Right Sum Differences](https://leetcode.com/problems/left-and-right-sum-differences/) — Easy
- [ ] [Count Vowel Strings in Ranges](https://leetcode.com/problems/count-vowel-strings-in-ranges/) — Medium
- [ ] [Minimum Penalty for a Shop](https://leetcode.com/problems/minimum-penalty-for-a-shop/) — Medium
- [ ] [Find Good Days to Rob the Bank](https://leetcode.com/problems/find-good-days-to-rob-the-bank/) — Medium
- [ ] [Sum of Absolute Differences in a Sorted Array](https://leetcode.com/problems/sum-of-absolute-differences-in-a-sorted-array/) — Medium
- [ ] [Product of Array Except Self](https://leetcode.com/problems/product-of-array-except-self/) — Medium
- [ ] [Product of the Last K Numbers](https://leetcode.com/problems/product-of-the-last-k-numbers/) — Medium
- [ ] [Removing Minimum Number of Magic Beans](https://leetcode.com/problems/removing-minimum-number-of-magic-beans/) — Medium
- [ ] [Find All Good Indices](https://leetcode.com/problems/find-all-good-indices/) — Medium
- [ ] [Movement of Robots](https://leetcode.com/problems/movement-of-robots/) — Medium
- [ ] [Range Sum Query 2D - Immutable](https://leetcode.com/problems/range-sum-query-2d-immutable/) — Medium
- [ ] [Increment Submatrices by One](https://leetcode.com/problems/increment-submatrices-by-one/) — Medium
- [ ] [Power of Heroes](https://leetcode.com/problems/power-of-heroes/) — Hard
- [ ] [Minimum Cost to Make Array Equal](https://leetcode.com/problems/minimum-cost-to-make-array-equal/) — Hard
- [ ] [Subarray Sum Equals K](https://leetcode.com/problems/subarray-sum-equals-k/) — Medium
- [ ] [Subarray Sums Divisible by K](https://leetcode.com/problems/subarray-sums-divisible-by-k/) — Medium
- [ ] [Make Sum Divisible by P](https://leetcode.com/problems/make-sum-divisible-by-p/) — Medium
- [ ] [Count Number of Bad Pairs](https://leetcode.com/problems/count-number-of-bad-pairs/) — Medium
- [ ] [Continuous Subarray Sum](https://leetcode.com/problems/continuous-subarray-sum/) — Medium
- [ ] [Count of Interesting Subarrays](https://leetcode.com/problems/count-of-interesting-subarrays/) — Medium
- [ ] [Count Number of Nice Subarrays](https://leetcode.com/problems/count-number-of-nice-subarrays/) — Medium
- [ ] [Count Beautiful Substrings II](https://leetcode.com/problems/count-beautiful-substrings-ii/) — Hard
- [ ] [Sum of Digit Differences of All Pairs](https://leetcode.com/problems/sum-of-digit-differences-of-all-pairs/) — Medium
- [ ] [Binary Subarrays with Sum](https://leetcode.com/problems/binary-subarrays-with-sum/) — Medium
- [ ] [Number of Wonderful Substrings](https://leetcode.com/problems/number-of-wonderful-substrings/) — Medium
- [ ] [Count the Number of Beautiful Subarrays](https://leetcode.com/problems/count-the-number-of-beautiful-subarrays/) — Medium
- [ ] [Number of Submatrices That Sum to Target](https://leetcode.com/problems/number-of-submatrices-that-sum-to-target/) — Hard
- [ ] [Count Subarrays with Median K](https://leetcode.com/problems/count-subarrays-with-median-k/) — Hard

#### Line Sweep Problems

- [ ] [Maximum Population Year](https://leetcode.com/problems/maximum-population-year/) — Easy
- [ ] [Points That Intersect With Cars](https://leetcode.com/problems/points-that-intersect-with-cars/) — Easy
- [ ] [Car Pooling](https://leetcode.com/problems/car-pooling/) — Medium
- [ ] [My Calendar II](https://leetcode.com/problems/my-calendar-ii/) — Medium
- [ ] [Shifting Letters II](https://leetcode.com/problems/shifting-letters-ii/) — Medium
- [ ] [Perfect Rectangle](https://leetcode.com/problems/perfect-rectangle/) — Hard
- [ ] [Rectangle Area II](https://leetcode.com/problems/rectangle-area-ii/) — Hard
- [ ] [Number of Flowers in Full Bloom](https://leetcode.com/problems/number-of-flowers-in-full-bloom/) — Hard

#### Matrix Problems

##### Matrix Transformation and Modification
- [ ] [Convert 1D Array Into 2D Array](https://leetcode.com/problems/convert-1d-array-into-2d-array/) — Easy
- [ ] [Modify the Matrix](https://leetcode.com/problems/modify-the-matrix/) — Easy
- [ ] [Set Matrix Zeroes](https://leetcode.com/problems/set-matrix-zeroes/) — Medium
- [ ] [Sort the Matrix Diagonally](https://leetcode.com/problems/sort-the-matrix-diagonally/) — Medium
- [ ] [Minimum Operations to Write the Letter Y on a Grid](https://leetcode.com/problems/minimum-operations-to-write-the-letter-y-on-a-grid/) — Medium
- [ ] [Shift 2D Grid](https://leetcode.com/problems/shift-2d-grid/) — Easy
- [ ] [Matrix Similarity After Cyclic Shifts](https://leetcode.com/problems/matrix-similarity-after-cyclic-shifts/) — Easy
- [ ] [Transpose Matrix](https://leetcode.com/problems/transpose-matrix/) — Easy
- [ ] [Rotate Image](https://leetcode.com/problems/rotate-image/) — Medium
- [ ] [Rotating the Box](https://leetcode.com/problems/rotating-the-box/) — Medium
- [ ] [Cyclically Rotating a Grid](https://leetcode.com/problems/cyclically-rotating-a-grid/) — Medium
- [ ] [Game of Life](https://leetcode.com/problems/game-of-life/) — Medium
- [ ] [Matrix Cells in Distance Order](https://leetcode.com/problems/matrix-cells-in-distance-order/) — Easy

##### Matrix Patterns and Validity Checks
- [ ] [Find Valid Matrix Given Row and Column Sums](https://leetcode.com/problems/find-valid-matrix-given-row-and-column-sums/) — Medium
- [ ] [Check if Matrix is X-Matrix](https://leetcode.com/problems/check-if-matrix-is-x-matrix/) — Easy
- [ ] [Queens That Can Attack the King](https://leetcode.com/problems/queens-that-can-attack-the-king/) — Medium
- [ ] [Max Increase to Keep City Skyline](https://leetcode.com/problems/max-increase-to-keep-city-skyline/) — Medium
- [ ] [Make a Square with the Same Color](https://leetcode.com/problems/make-a-square-with-the-same-color/) — Easy
- [ ] [Subrectangle Queries](https://leetcode.com/problems/subrectangle-queries/) — Easy
- [ ] [Count Submatrices with Top-Left Element and Sum Less Than k](https://leetcode.com/problems/count-submatrices-with-top-left-element-and-sum-less-than-k/) — Medium
- [ ] [Find the Minimum Area to Cover All Ones I](https://leetcode.com/problems/find-the-minimum-area-to-cover-all-ones-i/) — Medium
- [ ] [Find the Minimum Area to Cover All Ones II](https://leetcode.com/problems/find-the-minimum-area-to-cover-all-ones-ii/) — Hard
- [ ] [Valid Sudoku](https://leetcode.com/problems/valid-sudoku/) — Medium
- [ ] [Check if Move is Legal](https://leetcode.com/problems/check-if-move-is-legal/) — Medium
- [ ] [Valid Tic-Tac-Toe State](https://leetcode.com/problems/valid-tic-tac-toe-state/) — Medium
- [ ] [Number of Laser Beams in a Bank](https://leetcode.com/problems/number-of-laser-beams-in-a-bank/) — Medium
- [ ] [Where Will the Ball Fall](https://leetcode.com/problems/where-will-the-ball-fall/) — Medium
- [ ] [Image Overlap](https://leetcode.com/problems/image-overlap/) — Medium
- [ ] [Minimum Operations to Make a Uni-Value Grid](https://leetcode.com/problems/minimum-operations-to-make-a-uni-value-grid/) — Medium

##### Matrix Traversal and Summation
- [ ] [Row With Maximum Ones](https://leetcode.com/problems/row-with-maximum-ones/) — Easy
- [ ] [Richest Customer Wealth](https://leetcode.com/problems/richest-customer-wealth/) — Easy
- [ ] [Lucky Numbers in a Matrix](https://leetcode.com/problems/lucky-numbers-in-a-matrix/) — Easy
- [ ] [Equal Row and Column Pairs](https://leetcode.com/problems/equal-row-and-column-pairs/) — Medium
- [ ] [Difference Between Ones and Zeros in Row and Column](https://leetcode.com/problems/difference-between-ones-and-zeros-in-row-and-column/) — Medium
- [ ] [Matrix Diagonal Sum](https://leetcode.com/problems/matrix-diagonal-sum/) — Easy
- [ ] [Prime in Diagonal](https://leetcode.com/problems/prime-in-diagonal/) — Easy
- [ ] [Diagonal Traverse](https://leetcode.com/problems/diagonal-traverse/) — Medium
- [ ] [Matrix Block Sum](https://leetcode.com/problems/matrix-block-sum/) — Medium
- [ ] [Largest Local Values in a Matrix](https://leetcode.com/problems/largest-local-values-in-a-matrix/) — Easy
- [ ] [Maximum Sum of an Hourglass](https://leetcode.com/problems/maximum-sum-of-an-hourglass/) — Medium
- [ ] [Maximum Matrix Sum](https://leetcode.com/problems/maximum-matrix-sum/) — Medium
- [ ] [Find the Grid of Region Average](https://leetcode.com/problems/find-the-grid-of-region-average/) — Medium
- [ ] [Spiral Matrix](https://leetcode.com/problems/spiral-matrix/) — Medium
- [ ] [Spiral Matrix II](https://leetcode.com/problems/spiral-matrix-ii/) — Medium

#### Hashing Problems

##### Implementary Problems
- [ ] [Find Common Elements Between Two Arrays](https://leetcode.com/problems/find-common-elements-between-two-arrays/) — Easy
- [ ] [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/) — Easy
- [ ] [Sum of Unique Elements](https://leetcode.com/problems/sum-of-unique-elements/) — Easy
- [ ] [Find All Duplicates in an Array](https://leetcode.com/problems/find-all-duplicates-in-an-array/) — Medium
- [ ] [Check if All Characters Have Equal Number of Occurrences](https://leetcode.com/problems/check-if-all-characters-have-equal-number-of-occurrences/) — Easy
- [ ] [Unique Number of Occurrences](https://leetcode.com/problems/unique-number-of-occurrences/) — Easy
- [ ] [Find Common Characters](https://leetcode.com/problems/find-common-characters/) — Easy
- [ ] [Number of Good Pairs](https://leetcode.com/problems/number-of-good-pairs/) — Easy
- [ ] [Permutation Difference Between Two Strings](https://leetcode.com/problems/permutation-difference-between-two-strings/) — Easy
- [ ] [Check if the Sentence is Pangram](https://leetcode.com/problems/check-if-the-sentence-is-pangram/) — Easy
- [ ] [Decode the Message](https://leetcode.com/problems/decode-the-message/) — Easy
- [ ] [Replace Elements in an Array](https://leetcode.com/problems/replace-elements-in-an-array/) — Medium
- [ ] [Count the Number of Special Characters II](https://leetcode.com/problems/count-the-number-of-special-characters-ii/) — Medium
- [ ] [Reconstruct Original Digits from English](https://leetcode.com/problems/reconstruct-original-digits-from-english/) — Medium
- [ ] [Integer to Roman](https://leetcode.com/problems/integer-to-roman/) — Medium
- [ ] [Find Words That Can Be Formed by Characters](https://leetcode.com/problems/find-words-that-can-be-formed-by-characters/) — Easy
- [ ] [Find the XOR of Numbers Which Appear Twice](https://leetcode.com/problems/find-the-xor-of-numbers-which-appear-twice/) — Easy
- [ ] [Sort the People](https://leetcode.com/problems/sort-the-people/) — Easy
- [ ] [Form Smallest Number from Two-Digit Arrays](https://leetcode.com/problems/form-smallest-number-from-two-digit-arrays/) — Easy
- [ ] [Increasing Decreasing String](https://leetcode.com/problems/increasing-decreasing-string/) — Easy
- [ ] [Sort Array by Increasing Frequency](https://leetcode.com/problems/sort-array-by-increasing-frequency/) — Easy
- [ ] [Sort Characters by Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) — Medium
- [ ] [Merge Similar Items](https://leetcode.com/problems/merge-similar-items/) — Easy
- [ ] [Substrings of Size Three with Distinct Characters](https://leetcode.com/problems/substrings-of-size-three-with-distinct-characters/) — Easy
- [ ] [Clear Digits](https://leetcode.com/problems/clear-digits/) — Easy
- [ ] [HTML Entity Parser](https://leetcode.com/problems/html-entity-parser/) — Medium
- [ ] [Largest Substring Between Two Equal Characters](https://leetcode.com/problems/largest-substring-between-two-equal-characters/) — Easy
- [ ] [Remove Letter to Equalize Frequency](https://leetcode.com/problems/remove-letter-to-equalize-frequency/) — Easy
- [ ] [Distribute Candies](https://leetcode.com/problems/distribute-candies/) — Easy
- [ ] [Path Crossing](https://leetcode.com/problems/path-crossing/) — Easy
- [ ] [Buddy Strings](https://leetcode.com/problems/buddy-strings/) — Easy
- [ ] [Word Pattern](https://leetcode.com/problems/word-pattern/) — Easy
- [ ] [Valid Anagram](https://leetcode.com/problems/valid-anagram/) — Easy
- [ ] [Find Resultant Array After Removing Anagrams](https://leetcode.com/problems/find-resultant-array-after-removing-anagrams/) — Easy
- [ ] [Group Anagrams](https://leetcode.com/problems/group-anagrams/) — Medium
- [ ] [Majority Element](https://leetcode.com/problems/majority-element/) — Easy
- [ ] [Majority Element II](https://leetcode.com/problems/majority-element-ii/) — Medium
- [ ] [Find All Lonely Numbers in the Array](https://leetcode.com/problems/find-all-lonely-numbers-in-the-array/) — Medium
- [ ] [Smallest Missing Integer Greater Than Sequential Prefix Sum](https://leetcode.com/problems/smallest-missing-integer-greater-than-sequential-prefix-sum/) — Easy
- [ ] [First Missing Positive](https://leetcode.com/problems/first-missing-positive/) — Hard
- [ ] [Shortest Impossible Sequence of Rolls](https://leetcode.com/problems/shortest-impossible-sequence-of-rolls/) — Hard
- [ ] [Find Occurrences of an Element in an Array](https://leetcode.com/problems/find-occurrences-of-an-element-in-an-array/) — Medium
- [ ] [Redistribute Characters to Make All Strings Equal](https://leetcode.com/problems/redistribute-characters-to-make-all-strings-equal/) — Easy
- [ ] [Isomorphic Strings](https://leetcode.com/problems/isomorphic-strings/) — Easy
- [ ] [Groups of Special Equivalent Strings](https://leetcode.com/problems/groups-of-special-equivalent-strings/) — Medium
- [ ] [Word Subsets](https://leetcode.com/problems/word-subsets/) — Medium
- [ ] [Find the Maximum Number of Elements in Subset](https://leetcode.com/problems/find-the-maximum-number-of-elements-in-subset/) — Medium
- [ ] [People Whose List of Favorite Companies is Not a Subset of Another List](https://leetcode.com/problems/people-whose-list-of-favorite-companies-is-not-a-subset-of-another-list/) — Medium
- [ ] [Count the Number of Good Partitions](https://leetcode.com/problems/count-the-number-of-good-partitions/) — Hard
- [ ] [Optimal Partition of String](https://leetcode.com/problems/optimal-partition-of-string/) — Medium
- [ ] [Custom Sort String](https://leetcode.com/problems/custom-sort-string/) — Medium
- [ ] [Finding the Users Active Minutes](https://leetcode.com/problems/finding-the-users-active-minutes/) — Medium
- [ ] [Convert an Array into a 2D Array with Conditions](https://leetcode.com/problems/convert-an-array-into-a-2d-array-with-conditions/) — Medium
- [ ] [Group the People Given the Group Size They Belong To](https://leetcode.com/problems/group-the-people-given-the-group-size-they-belong-to/) — Medium
- [ ] [Evaluate the Bracket Pairs of a String](https://leetcode.com/problems/evaluate-the-bracket-pairs-of-a-string/) — Medium
- [ ] [Minimum Number of Operations to Make Word K-Periodic](https://leetcode.com/problems/minimum-number-of-operations-to-make-word-k-periodic/) — Medium
- [ ] [Can Convert String in K Moves](https://leetcode.com/problems/can-convert-string-in-k-moves/) — Medium
- [ ] [Restore the Array from Adjacent Pairs](https://leetcode.com/problems/restore-the-array-from-adjacent-pairs/) — Medium
- [ ] [Tuple with Same Product](https://leetcode.com/problems/tuple-with-same-product/) — Medium
- [ ] [Split the Array to Make Coprime Products](https://leetcode.com/problems/split-the-array-to-make-coprime-products/) — Hard
- [ ] [4Sum II](https://leetcode.com/problems/4sum-ii/) — Medium
- [ ] [Count Artifacts That Can Be Extracted](https://leetcode.com/problems/count-artifacts-that-can-be-extracted/) — Medium
- [ ] [Brick Wall](https://leetcode.com/problems/brick-wall/) — Medium
- [ ] [Pairs of Songs with Total Durations Divisible by 60](https://leetcode.com/problems/pairs-of-songs-with-total-durations-divisible-by-60/) — Medium
- [ ] [Alphabet Board Path](https://leetcode.com/problems/alphabet-board-path/) — Medium
- [ ] [Vowel Spellchecker](https://leetcode.com/problems/vowel-spellchecker/) — Medium
- [ ] [Bulls and Cows](https://leetcode.com/problems/bulls-and-cows/) — Medium
- [ ] [Card Flipping Game](https://leetcode.com/problems/card-flipping-game/) — Medium
- [ ] [Maximum Size of a Set After Removals](https://leetcode.com/problems/maximum-size-of-a-set-after-removals/) — Medium
- [ ] [Minimum Absolute Difference Queries](https://leetcode.com/problems/minimum-absolute-difference-queries/) — Medium
- [ ] [Check if Array Pairs are Divisible by K](https://leetcode.com/problems/check-if-array-pairs-are-divisible-by-k/) — Medium
- [ ] [Count Pairs That Form a Complete Day II](https://leetcode.com/problems/count-pairs-that-form-a-complete-day-ii/) — Medium
- [ ] [Count Number of Bad Pairs](https://leetcode.com/problems/count-number-of-bad-pairs/) — Medium
- [ ] [Minimum Seconds to Equalize a Circular Array](https://leetcode.com/problems/minimum-seconds-to-equalize-a-circular-array/) — Medium
- [ ] [Sum of Imbalance Numbers of All Subarrays](https://leetcode.com/problems/sum-of-imbalance-numbers-of-all-subarrays/) — Hard
- [ ] [Grid Illumination](https://leetcode.com/problems/grid-illumination/) — Hard
- [ ] [Maximum Equal Frequency](https://leetcode.com/problems/maximum-equal-frequency/) — Hard
- [ ] [Rearranging Fruits](https://leetcode.com/problems/rearranging-fruits/) — Hard

#### Sliding Window Problems

##### Fixed Size Sliding Window
- [ ] [Substrings of Size Three with Distinct Characters](https://leetcode.com/problems/substrings-of-size-three-with-distinct-characters/) — Easy
- [ ] [Find All Anagrams in a String](https://leetcode.com/problems/find-all-anagrams-in-a-string/) — Medium
- [ ] [Permutation in String](https://leetcode.com/problems/permutation-in-string/) — Medium
- [ ] [Check If a String Contains All Binary Codes of Size K](https://leetcode.com/problems/check-if-a-string-contains-all-binary-codes-of-size-k/) — Medium
- [ ] [Maximum Number of Vowels in a Substring of Given Length](https://leetcode.com/problems/maximum-number-of-vowels-in-a-substring-of-given-length/) — Medium
- [ ] [Maximum Average Subarray I](https://leetcode.com/problems/maximum-average-subarray-i/) — Easy
- [ ] [Number of Sub-arrays of Size K and Average Greater than or Equal to Threshold](https://leetcode.com/problems/number-of-sub-arrays-of-size-k-and-average-greater-than-or-equal-to-threshold/) — Medium
- [ ] [K Radius Subarray Averages](https://leetcode.com/problems/k-radius-subarray-averages/) — Medium
- [ ] [Maximum Sum of Distinct Subarrays With Length K](https://leetcode.com/problems/maximum-sum-of-distinct-subarrays-with-length-k/) — Medium
- [ ] [Sliding Subarray Beauty](https://leetcode.com/problems/sliding-subarray-beauty/) — Medium
- [ ] [Maximum Points You Can Obtain from Cards](https://leetcode.com/problems/maximum-points-you-can-obtain-from-cards/) — Medium
- [ ] [Sliding Window Median](https://leetcode.com/problems/sliding-window-median/) — Hard
- [ ] [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) — Hard
- [ ] [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) — Hard
- [ ] [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) — Hard

##### Dynamic Size Sliding Window
- [ ] [Longest Substring Without Repeating Characters](https://leetcode.com/problems/longest-substring-without-repeating-characters/) — Medium
- [ ] [Longest Repeating Character Replacement](https://leetcode.com/problems/longest-repeating-character-replacement/) — Medium
- [ ] [Maximum Number of Occurrences of a Substring](https://leetcode.com/problems/maximum-number-of-occurrences-of-a-substring/) — Medium
- [ ] [Max Consecutive Ones III](https://leetcode.com/problems/max-consecutive-ones-iii/) — Medium
- [ ] [Count the Number of Substrings With Dominant Ones](https://leetcode.com/problems/count-the-number-of-substrings-with-dominant-ones/) — Medium
- [ ] [Minimum Window Substring](https://leetcode.com/problems/minimum-window-substring/) — Hard
- [ ] [Substring with Concatenation of All Words](https://leetcode.com/problems/substring-with-concatenation-of-all-words/) — Hard
- [ ] [Minimum Size Subarray Sum](https://leetcode.com/problems/minimum-size-subarray-sum/) — Medium
- [ ] [Longest Continuous Subarray With Absolute Diff Less Than or Equal to Limit](https://leetcode.com/problems/longest-continuous-subarray-with-absolute-diff-less-than-or-equal-to-limit/) — Medium
- [ ] [Fruit Into Baskets](https://leetcode.com/problems/fruit-into-baskets/) — Medium
- [ ] [Subarray Product Less Than K](https://leetcode.com/problems/subarray-product-less-than-k/) — Medium
- [ ] [Grumpy Bookstore Owner](https://leetcode.com/problems/grumpy-bookstore-owner/) — Medium
- [ ] [Moving Stones Until Consecutive II](https://leetcode.com/problems/moving-stones-until-consecutive-ii/) — Medium
- [ ] [Count Number of Nice Subarrays](https://leetcode.com/problems/count-number-of-nice-subarrays/) — Medium
- [ ] [Number of Subarrays with Bounded Maximum](https://leetcode.com/problems/number-of-subarrays-with-bounded-maximum/) — Medium
- [ ] [Maximum Erasure Value](https://leetcode.com/problems/maximum-erasure-value/) — Medium
- [ ] [Longest Subarray of 1's After Deleting One Element](https://leetcode.com/problems/longest-subarray-of-1s-after-deleting-one-element/) — Medium
- [ ] [Count the Number of Good Subarrays](https://leetcode.com/problems/count-the-number-of-good-subarrays/) — Medium
- [ ] [Minimum Consecutive Cards to Pick Up](https://leetcode.com/problems/minimum-consecutive-cards-to-pick-up/) — Medium
- [ ] [Minimum Operations to Reduce X to Zero](https://leetcode.com/problems/minimum-operations-to-reduce-x-to-zero/) — Medium
- [ ] [Frequency of the Most Frequent Element](https://leetcode.com/problems/frequency-of-the-most-frequent-element/) — Medium
- [ ] [Subarrays with K Different Integers](https://leetcode.com/problems/subarrays-with-k-different-integers/) — Hard

#### Linked List Problems

##### Linked List Part 1
- [ ] [Convert Binary Number in a Linked List to Integer](https://leetcode.com/problems/convert-binary-number-in-a-linked-list-to-integer/) — Easy
- [ ] [Intersection of Two Linked Lists](https://leetcode.com/problems/intersection-of-two-linked-lists/) — Easy
- [ ] [Middle of the Linked List](https://leetcode.com/problems/middle-of-the-linked-list/) — Easy
- [ ] [Linked List Cycle](https://leetcode.com/problems/linked-list-cycle/) — Easy
- [ ] [Linked List Cycle II](https://leetcode.com/problems/linked-list-cycle-ii/) — Medium
- [ ] Find Length of Loop — Easy
- [ ] [Reverse Linked List](https://leetcode.com/problems/reverse-linked-list/) — Easy
- [ ] [Palindrome Linked List](https://leetcode.com/problems/palindrome-linked-list/) — Easy
- [ ] [Reverse Nodes in k-Group](https://leetcode.com/problems/reverse-nodes-in-k-group/) — Hard
- [ ] [Odd Even Linked List](https://leetcode.com/problems/odd-even-linked-list/) — Easy
- [ ] [Remove Duplicates from Sorted List](https://leetcode.com/problems/remove-duplicates-from-sorted-list/) — Easy
- [ ] [Remove Nth Node From End of List](https://leetcode.com/problems/remove-nth-node-from-end-of-list/) — Medium
- [ ] [Delete the Middle Node of a Linked List](https://leetcode.com/problems/delete-the-middle-node-of-a-linked-list/) — Medium
- [ ] Add 1 to a Linked List Number — Medium
- [ ] [Add Two Numbers](https://leetcode.com/problems/add-two-numbers/) — Medium
- [ ] Sort a Linked List of 0s, 1s, and 2s — Medium
- [ ] [Sort List](https://leetcode.com/problems/sort-list/) — Medium
- [ ] [Linked List Random Node](https://leetcode.com/problems/linked-list-random-node/) — Medium
- [ ] [Copy List with Random Pointer](https://leetcode.com/problems/copy-list-with-random-pointer/) — Medium
- [ ] Flattening a Linked List — Medium
- [ ] [Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/) — Easy
- [ ] [Merge k Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) — Hard

##### Linked List Part 2: Design Patterns
- [ ] [Design HashSet](https://leetcode.com/problems/design-hashset/) — Easy
- [ ] [Design HashMap](https://leetcode.com/problems/design-hashmap/) — Easy
- [ ] [Design Browser History](https://leetcode.com/problems/design-browser-history/) — Medium
- [ ] [Design a Text Editor](https://leetcode.com/problems/design-a-text-editor/) — Hard
- [ ] [All O'one Data Structure](https://leetcode.com/problems/all-oone-data-structure/) — Hard
- [ ] [LRU Cache](https://leetcode.com/problems/lru-cache/) — Medium
- [ ] [LFU Cache](https://leetcode.com/problems/lfu-cache/) — Hard

#### Stack Problems

##### Parentheses Problems
- [ ] [Valid Parentheses](https://leetcode.com/problems/valid-parentheses/) — Easy
- [ ] [Maximum Nesting Depth of the Parentheses](https://leetcode.com/problems/maximum-nesting-depth-of-the-parentheses/) — Easy
- [ ] [Remove Outermost Parentheses](https://leetcode.com/problems/remove-outermost-parentheses/) — Easy
- [ ] [Minimum Add to Make Parentheses Valid](https://leetcode.com/problems/minimum-add-to-make-parentheses-valid/) — Medium
- [ ] [Minimum Remove to Make Valid Parentheses](https://leetcode.com/problems/minimum-remove-to-make-valid-parentheses/) — Medium
- [ ] [Maximum Nesting Depth of Two Valid Parentheses Strings](https://leetcode.com/problems/maximum-nesting-depth-of-two-valid-parentheses-strings/) — Medium
- [ ] [Check if a Parentheses String Can Be Valid](https://leetcode.com/problems/check-if-a-parentheses-string-can-be-valid/) — Medium
- [ ] [Reverse Substrings Between Each Pair of Parentheses](https://leetcode.com/problems/reverse-substrings-between-each-pair-of-parentheses/) — Medium
- [ ] [Score of Parentheses](https://leetcode.com/problems/score-of-parentheses/) — Medium
- [ ] [Minimum Insertions to Balance a Parentheses String](https://leetcode.com/problems/minimum-insertions-to-balance-a-parentheses-string/) — Medium
- [ ] [Longest Valid Parentheses](https://leetcode.com/problems/longest-valid-parentheses/) — Hard
- [ ] Redundant Parenthesis — Hard

##### Design Problems
- [ ] [Min Stack](https://leetcode.com/problems/min-stack/) — Medium
- [ ] [Maximum Frequency Stack](https://leetcode.com/problems/maximum-frequency-stack/) — Hard
- [ ] [Design a Stack With Increment Operation](https://leetcode.com/problems/design-a-stack-with-increment-operation/) — Medium
- [ ] [Dinner Plate Stacks](https://leetcode.com/problems/dinner-plate-stacks/) — Hard

##### Advanced Stack Problems
- [ ] [Merge Intervals](https://leetcode.com/problems/merge-intervals/) — Medium
- [ ] [Insert Intervals](https://leetcode.com/problems/insert-interval/) — Medium
- [ ] [Asteroid Collision](https://leetcode.com/problems/asteroid-collision/) — Medium
- [ ] [Construct Smallest Number From DI String](https://leetcode.com/problems/construct-smallest-number-from-di-string/) — Medium
- [ ] [Evaluate Reverse Polish Notation](https://leetcode.com/problems/evaluate-reverse-polish-notation/) — Medium
- [ ] [Simplify Path](https://leetcode.com/problems/simplify-path/) — Medium
- [ ] [Basic Calculator](https://leetcode.com/problems/basic-calculator/) — Hard
- [ ] [Basic Calculator II](https://leetcode.com/problems/basic-calculator-ii/) — Medium
- [ ] [Basic Calculator IV](https://leetcode.com/problems/basic-calculator-iv/) — Hard
- [ ] [Replace Non-Coprime Numbers in Array](https://leetcode.com/problems/replace-non-coprime-numbers-in-array/) — Hard
- [ ] [Robot Collisions](https://leetcode.com/problems/robot-collisions/) — Hard
- [ ] [Number of Atoms](https://leetcode.com/problems/number-of-atoms/) — Hard

##### Monotonic Stack
- [ ] [Final Prices With a Special Discount in a Shop](https://leetcode.com/problems/final-prices-with-a-special-discount-in-a-shop/) — Easy
- [ ] [Next Greater Element I](https://leetcode.com/problems/next-greater-element-i/) — Easy
- [ ] [Next Greater Element II](https://leetcode.com/problems/next-greater-element-ii/) — Medium
- [ ] [Next Greater Element IV](https://leetcode.com/problems/next-greater-element-iv/) — Hard
- [ ] [Daily Temperatures](https://leetcode.com/problems/daily-temperatures/) — Medium
- [ ] [Car Fleet](https://leetcode.com/problems/car-fleet/) — Medium
- [ ] [Car Fleet II](https://leetcode.com/problems/car-fleet-ii/) — Hard
- [ ] [132 Pattern](https://leetcode.com/problems/132-pattern/) — Medium
- [ ] [Smallest Subsequence of Distinct Characters](https://leetcode.com/problems/smallest-subsequence-of-distinct-characters/) — Medium
- [ ] [Count Submatrices With All Ones](https://leetcode.com/problems/count-submatrices-with-all-ones/) — Medium
- [ ] [Remove Duplicate Letters](https://leetcode.com/problems/remove-duplicate-letters/) — Medium
- [ ] [The Number of Weak Characters in the Game](https://leetcode.com/problems/the-number-of-weak-characters-in-the-game/) — Medium
- [ ] [Maximum Subarray Min-Product](https://leetcode.com/problems/maximum-subarray-min-product/) — Medium
- [ ] [Sum of Subarray Minimums](https://leetcode.com/problems/sum-of-subarray-minimums/) — Medium
- [ ] [Shortest Unsorted Continuous Subarray](https://leetcode.com/problems/shortest-unsorted-continuous-subarray/) — Medium
- [ ] [Remove K Digits](https://leetcode.com/problems/remove-k-digits/) — Medium
- [ ] [Beautiful Towers I](https://leetcode.com/problems/beautiful-towers-i/) — Medium
- [ ] [Beautiful Towers II](https://leetcode.com/problems/beautiful-towers-ii/) — Medium
- [ ] [Online Stock Span](https://leetcode.com/problems/online-stock-span/) — Medium
- [ ] [Minimum Number of Increments on Subarrays to Form a Target Array](https://leetcode.com/problems/minimum-number-of-increments-on-subarrays-to-form-a-target-array/) — Hard
- [ ] [Maximum Score of a Good Subarray](https://leetcode.com/problems/maximum-score-of-a-good-subarray/) — Hard
- [ ] [Number of Visible People in a Queue](https://leetcode.com/problems/number-of-visible-people-in-a-queue/) — Hard
- [ ] [Trapping Rain Water](https://leetcode.com/problems/trapping-rain-water/) — Hard
- [ ] [Maximal Rectangle](https://leetcode.com/problems/maximal-rectangle/) — Hard
- [ ] [Largest Rectangle in Histogram](https://leetcode.com/problems/largest-rectangle-in-histogram/) — Hard
- [ ] [Create Maximum Number](https://leetcode.com/problems/create-maximum-number/) — Hard
- [ ] [Find Building Where Alice And Bob Can Meet](https://leetcode.com/problems/find-building-where-alice-and-bob-can-meet/) — Hard
- [ ] [Sum Of Total Strength Of Wizards](https://leetcode.com/problems/sum-of-total-strength-of-wizards/) — Hard
- [ ] [Find the Number of Subarrays Where Boundary Elements Are Maximum](https://leetcode.com/problems/find-the-number-of-subarrays-where-boundary-elements-are-maximum/) — Hard

#### Queue Problems

##### Implementation Problems
- [ ] Implement Queue using Array — Easy
- [ ] [Implement Stack using Queues](https://leetcode.com/problems/implement-stack-using-queues/) — Easy
- [ ] [Implement Queue using Stacks](https://leetcode.com/problems/implement-queue-using-stacks/) — Easy
- [ ] Implement Queue using Linked List — Easy
- [ ] [Design Circular Queue](https://leetcode.com/problems/design-circular-queue/) — Medium
- [ ] [Design Front Middle Back Queue](https://leetcode.com/problems/design-front-middle-back-queue/) — Medium

##### Singly-Ended Queue
- [ ] Reverse First K Elements of Queue — Easy
- [ ] First Non-Repeating Character in a Stream — Easy
- [ ] First Negative Integer in Every Window of Size K — Medium
- [ ] [Dota2 Senate](https://leetcode.com/problems/dota2-senate/) — Medium
- [ ] [Find the Winner of the Circular Game](https://leetcode.com/problems/find-the-winner-of-the-circular-game/) — Medium
- [ ] [Reveal Cards in Increasing Order](https://leetcode.com/problems/reveal-cards-in-increasing-order/) — Medium
- [ ] [Minimum Number of K Consecutive Bit Flips](https://leetcode.com/problems/minimum-number-of-k-consecutive-bit-flips/) — Hard
- [ ] [Stamping the Sequence](https://leetcode.com/problems/stamping-the-sequence/) — Hard

##### Doubly-Ended Queue
- [ ] Deque Implementations — Easy
- [ ] [Design Circular Deque](https://leetcode.com/problems/design-circular-deque/) — Medium
- [ ] [Jump Game VI](https://leetcode.com/problems/jump-game-vi/) — Medium
- [ ] [Continuous Subarrays](https://leetcode.com/problems/continuous-subarrays/) — Medium
- [ ] [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) — Hard
- [ ] [Sliding Window Maximum](https://leetcode.com/problems/sliding-window-maximum/) — Hard
- [ ] [Shortest Subarray with Sum at Least K](https://leetcode.com/problems/shortest-subarray-with-sum-at-least-k/) — Hard
- [ ] [Constrained Subsequence Sum](https://leetcode.com/problems/constrained-subsequence-sum/) — Hard

#### Binary Search Problems

##### Introductory Problems
- [ ] [Binary Search](https://leetcode.com/problems/binary-search/) — Easy
- [ ] [Guess Number Higher or Lower](https://leetcode.com/problems/guess-number-higher-or-lower/) — Easy
- [ ] [H-Index II](https://leetcode.com/problems/h-index-ii/) — Medium

##### Upper Bound and Lower Bound
- [ ] [Find First and Last Position of Element in Sorted Array](https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/) — Medium
- [ ] [Special Array With X Elements Greater Than or Equal X](https://leetcode.com/problems/special-array-with-x-elements-greater-than-or-equal-x/) — Easy
- [ ] [Find Smallest Letter Greater Than Target](https://leetcode.com/problems/find-smallest-letter-greater-than-target/) — Easy
- [ ] [Longest Subsequence With Limited Sum](https://leetcode.com/problems/longest-subsequence-with-limited-sum/) — Easy
- [ ] [First Bad Version](https://leetcode.com/problems/first-bad-version/) — Easy
- [ ] [Arranging Coins](https://leetcode.com/problems/arranging-coins/) — Easy
- [ ] [Find the Distance Value Between Two Arrays](https://leetcode.com/problems/find-the-distance-value-between-two-arrays/) — Easy
- [ ] [Search Insert Position](https://leetcode.com/problems/search-insert-position/) — Easy
- [ ] [Find Target Indices After Sorting Array](https://leetcode.com/problems/find-target-indices-after-sorting-array/) — Easy
- [ ] [Find Right Interval](https://leetcode.com/problems/find-right-interval/) — Medium
- [ ] [Online Election](https://leetcode.com/problems/online-election/) — Medium
- [ ] [Most Beautiful Item for Each Query](https://leetcode.com/problems/most-beautiful-item-for-each-query/) — Medium
- [ ] [Time Based Key-Value Store](https://leetcode.com/problems/time-based-key-value-store/) — Medium
- [ ] [Random Pick with Weight](https://leetcode.com/problems/random-pick-with-weight/) — Medium
- [ ] [Plates Between Candles](https://leetcode.com/problems/plates-between-candles/) — Medium
- [ ] [Successful Pairs of Spells and Potions](https://leetcode.com/problems/successful-pairs-of-spells-and-potions/) — Medium
- [ ] [Range Frequency Queries](https://leetcode.com/problems/range-frequency-queries/) — Medium
- [ ] [Minimum Operations to Make All Array Elements Equal](https://leetcode.com/problems/minimum-operations-to-make-all-array-elements-equal/) — Medium
- [ ] [Count Number of Rectangles Containing Each Point](https://leetcode.com/problems/count-number-of-rectangles-containing-each-point/) — Medium
- [ ] [Count the Number of Fair Pairs](https://leetcode.com/problems/count-the-number-of-fair-pairs/) — Medium
- [ ] [Minimum Absolute Sum Difference](https://leetcode.com/problems/minimum-absolute-sum-difference/) — Medium
- [ ] [Find the Longest Valid Obstacle Course at Each Position](https://leetcode.com/problems/find-the-longest-valid-obstacle-course-at-each-position/) — Hard
- [ ] [Find the Number of Subarrays Where Boundary Elements Are Maximum](https://leetcode.com/problems/find-the-number-of-subarrays-where-boundary-elements-are-maximum/) — Hard

##### Search on Matrix
- [ ] [Count Negative Numbers in a Sorted Matrix](https://leetcode.com/problems/count-negative-numbers-in-a-sorted-matrix/) — Easy
- [ ] [Search a 2D Matrix](https://leetcode.com/problems/search-a-2d-matrix/) — Medium
- [ ] [Search a 2D Matrix II](https://leetcode.com/problems/search-a-2d-matrix-ii/) — Medium
- [ ] Median in a Row-wise Sorted Matrix — Hard

##### Missing and Repeating Number
- [ ] [Missing Number](https://leetcode.com/problems/missing-number/) — Easy
- [ ] [Kth Missing Positive Number](https://leetcode.com/problems/kth-missing-positive-number/) — Easy
- [ ] [Single Element in a Sorted Array](https://leetcode.com/problems/single-element-in-a-sorted-array/) — Medium
- [ ] [Minimum Common Value](https://leetcode.com/problems/minimum-common-value/) — Easy
- [ ] [Find the Duplicate Number](https://leetcode.com/problems/find-the-duplicate-number/) — Medium

##### Binary Search on Semi-Sorted Space
- [ ] [Find Peak Element](https://leetcode.com/problems/find-peak-element/) — Medium
- [ ] [Find a Peak Element II](https://leetcode.com/problems/find-a-peak-element-ii/) — Medium
- [ ] [Find Minimum in Rotated Sorted Array](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/) — Medium
- [ ] [Peak Index in a Mountain Array](https://leetcode.com/problems/peak-index-in-a-mountain-array/) — Medium
- [ ] [Search in Rotated Sorted Array](https://leetcode.com/problems/search-in-rotated-sorted-array/) — Medium
- [ ] [Search in Rotated Sorted Array II](https://leetcode.com/problems/search-in-rotated-sorted-array-ii/) — Medium
- [ ] Rotation — Medium
- [ ] [Find Minimum in Rotated Sorted Array II](https://leetcode.com/problems/find-minimum-in-rotated-sorted-array-ii/) — Hard
- [ ] [Find in Mountain Array](https://leetcode.com/problems/find-in-mountain-array/) — Hard

##### Binary Search On Answer
- [ ] [Sqrt(x)](https://leetcode.com/problems/sqrtx/) — Easy
- [ ] [Capacity to Ship Packages Within D Days](https://leetcode.com/problems/capacity-to-ship-packages-within-d-days/) — Medium
- [ ] [Koko Eating Bananas](https://leetcode.com/problems/koko-eating-bananas/) — Medium
- [ ] [Find the Smallest Divisor Given a Threshold](https://leetcode.com/problems/find-the-smallest-divisor-given-a-threshold/) — Medium
- [ ] [Minimum Number of Days to Make M Bouquets](https://leetcode.com/problems/minimum-number-of-days-to-make-m-bouquets/) — Medium
- [ ] [Aggressive Cows](https://leetcode.com/problems/aggressive-cows/) — Medium
- [ ] [Maximum Candies Allocated to K Children](https://leetcode.com/problems/maximum-candies-allocated-to-k-children/) — Medium
- [ ] [Most Profit Assigning Work](https://leetcode.com/problems/most-profit-assigning-work/) — Medium
- [ ] [Maximum Value at a Given Index in a Bounded Array](https://leetcode.com/problems/maximum-value-at-a-given-index-in-a-bounded-array/) — Medium
- [ ] [Maximum Side Length of a Square With Sum Less Than or Equal to Threshold](https://leetcode.com/problems/maximum-side-length-of-a-square-with-sum-less-than-or-equal-to-threshold/) — Medium
- [ ] [Minimum Speed to Arrive on Time](https://leetcode.com/problems/minimum-speed-to-arrive-on-time/) — Medium
- [ ] [Minimum Time to Repair Cars](https://leetcode.com/problems/minimum-time-to-repair-cars/) — Medium
- [ ] [Maximum Number of Removable Characters](https://leetcode.com/problems/maximum-number-of-removable-characters/) — Medium
- [ ] [Heaters](https://leetcode.com/problems/heaters/) — Medium
- [ ] [Earliest Second to Mark Indices I](https://leetcode.com/problems/earliest-second-to-mark-indices-i/) — Medium
- [ ] [Maximum White Tiles Covered by a Carpet](https://leetcode.com/problems/maximum-white-tiles-covered-by-a-carpet/) — Medium
- [ ] [Minimum Absolute Difference Between Elements with Constraint](https://leetcode.com/problems/minimum-absolute-difference-between-elements-with-constraint/) — Medium
- [ ] [Sell Diminishing-Valued Colored Balls](https://leetcode.com/problems/sell-diminishing-valued-colored-balls/) — Medium
- [ ] [Ugly Number III](https://leetcode.com/problems/ugly-number-iii/) — Medium
- [ ] [Minimize the Maximum of Two Arrays](https://leetcode.com/problems/minimize-the-maximum-of-two-arrays/) — Medium
- [ ] [Split Array Largest Sum](https://leetcode.com/problems/split-array-largest-sum/) — Medium
- [ ] [Maximum Running Time of N Computers](https://leetcode.com/problems/maximum-running-time-of-n-computers/) — Medium
- [ ] [Maximum Number of Robots Within Budget](https://leetcode.com/problems/maximum-number-of-robots-within-budget/) — Hard
- [ ] [Maximum Number of Groups With Increasing Length](https://leetcode.com/problems/maximum-number-of-groups-with-increasing-length/) — Hard
- [ ] [Maximum Number of Tasks You Can Assign](https://leetcode.com/problems/maximum-number-of-tasks-you-can-assign/) — Hard
- [ ] [Median of Two Sorted Arrays](https://leetcode.com/problems/median-of-two-sorted-arrays/) — Hard

##### Minmax Problems
- [ ] [Magnetic Force Between Two Balls](https://leetcode.com/problems/magnetic-force-between-two-balls/) — Medium
- [ ] [Maximum Tastiness of Candy Basket](https://leetcode.com/problems/maximum-tastiness-of-candy-basket/) — Medium
- [ ] [Minimum Limit of Balls in a Bag](https://leetcode.com/problems/minimum-limit-of-balls-in-a-bag/) — Medium
- [ ] [Minimized Maximum of Products Distributed to Any Store](https://leetcode.com/problems/minimized-maximum-of-products-distributed-to-any-store/) — Medium
- [ ] [Minimize the Maximum Difference of Pairs](https://leetcode.com/problems/minimize-the-maximum-difference-of-pairs/) — Medium
- [ ] [Maximize the Minimum Powered City](https://leetcode.com/problems/maximize-the-minimum-powered-city/) — Hard

##### Finding the K-th Element
- [ ] [Kth Smallest Number in Multiplication Table](https://leetcode.com/problems/kth-smallest-number-in-multiplication-table/) — Hard
- [ ] [Find K-th Smallest Pair Distance](https://leetcode.com/problems/find-k-th-smallest-pair-distance/) — Hard
- [ ] [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) — Hard
- [ ] [Find the Median of the Uniqueness Array](https://leetcode.com/problems/find-the-median-of-the-uniqueness-array/) — Hard
- [ ] [Kth Smallest Product of Two Sorted Arrays](https://leetcode.com/problems/kth-smallest-product-of-two-sorted-arrays/) — Hard
- [ ] [Kth Smallest Amount With Single Denomination Combination](https://leetcode.com/problems/kth-smallest-amount-with-single-denomination-combination/) — Hard
- [ ] [Find the Kth Smallest Sum of a Matrix With Sorted Rows](https://leetcode.com/problems/find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows/) — Hard

#### Bit Manipulation Problems

##### Basic Bit Concepts
- [ ] Decimal to Binary — Easy
- [ ] Get, Set, Clear ith Bit — Easy
- [ ] Kth Bit is Set or Not — Easy
- [ ] Check Odd or Even — Easy
- [ ] Set the Rightmost Unset Bit — Easy
- [ ] [Number Complement](https://leetcode.com/problems/number-complement/) — Easy
- [ ] [Number of 1 Bits](https://leetcode.com/problems/number-of-1-bits/) — Easy
- [ ] [Counting Bits](https://leetcode.com/problems/counting-bits/) — Easy
- [ ] Count Total Set Bits — Medium
- [ ] [Reverse Bits](https://leetcode.com/problems/reverse-bits/) — Easy
- [ ] [Power of Two](https://leetcode.com/problems/power-of-two/) — Easy
- [ ] [Power of Four](https://leetcode.com/problems/power-of-four/) — Easy
- [ ] [Hamming Distance](https://leetcode.com/problems/hamming-distance/) — Easy
- [ ] [Add Binary](https://leetcode.com/problems/add-binary/) — Easy
- [ ] [Total Hamming Distance](https://leetcode.com/problems/total-hamming-distance/) — Medium
- [ ] [UTF-8 Validation](https://leetcode.com/problems/utf-8-validation/) — Easy
- [ ] [Single Number II](https://leetcode.com/problems/single-number-ii/) — Medium
- [ ] [Divide Two Integers](https://leetcode.com/problems/divide-two-integers/) — Medium

##### Bitwise XOR Operator
- [ ] [Decode Xored Array](https://leetcode.com/problems/decode-xored-array/) — Easy
- [ ] [Single Number](https://leetcode.com/problems/single-number/) — Easy
- [ ] [Single Number III](https://leetcode.com/problems/single-number-iii/) — Medium
- [ ] [Sum of Two Integers](https://leetcode.com/problems/sum-of-two-integers/) — Medium
- [ ] Swap Two Numbers (with Temp Variable) — Easy
- [ ] [Missing Number](https://leetcode.com/problems/missing-number/) — Easy
- [ ] [Decode Xored Permutation](https://leetcode.com/problems/decode-xored-permutation/) — Medium
- [ ] [Find the Original Array of Prefix XOR](https://leetcode.com/problems/find-the-original-array-of-prefix-xor/) — Medium
- [ ] [Gray Code](https://leetcode.com/problems/gray-code/) — Medium
- [ ] [XOR Queries of a Subarray](https://leetcode.com/problems/xor-queries-of-a-subarray/) — Medium
- [ ] XOR Sequences — Medium
- [ ] [Minimum Number of Operations to Make Array XOR Equal to K](https://leetcode.com/problems/minimum-number-of-operations-to-make-array-xor-equal-to-k/) — Medium
- [ ] [Maximum XOR Product](https://leetcode.com/problems/maximum-xor-product/) — Medium
- [ ] [Neighboring Bitwise XOR](https://leetcode.com/problems/neighboring-bitwise-xor/) — Medium
- [ ] [Minimum XOR Sum of Two Arrays](https://leetcode.com/problems/minimum-xor-sum-of-two-arrays/) — Hard
- [ ] [Find XOR Sum of All Pairs Bitwise AND](https://leetcode.com/problems/find-xor-sum-of-all-pairs-bitwise-and/) — Hard
- [ ] [Find Longest Awesome Substring](https://leetcode.com/problems/find-longest-awesome-substring/) — Hard

##### Bitwise OR Operator
- [ ] [Shortest Subarray with OR at Least K](https://leetcode.com/problems/shortest-subarray-with-or-at-least-k/) — Medium
- [ ] [Minimum Array End](https://leetcode.com/problems/minimum-array-end/) — Medium
- [ ] [Maximum OR](https://leetcode.com/problems/maximum-or/) — Medium
- [ ] [Find Subarray with Bitwise OR Closest to K](https://leetcode.com/problems/find-subarray-with-bitwise-or-closest-to-k/) — Hard
- [ ] [Minimize OR of Remaining Elements Using Operations](https://leetcode.com/problems/minimize-or-of-remaining-elements-using-operations/) — Hard

##### Bitwise AND Operator
- [ ] [Minimum Flips to Make A or B Equal to C](https://leetcode.com/problems/minimum-flips-to-make-a-or-b-equal-to-c/) — Medium
- [ ] [Longest Nice Subarray](https://leetcode.com/problems/longest-nice-subarray/) — Medium
- [ ] [Bitwise AND of Numbers Range](https://leetcode.com/problems/bitwise-and-of-numbers-range/) — Medium
- [ ] [Longest Subarray with Maximum Bitwise AND](https://leetcode.com/problems/longest-subarray-with-maximum-bitwise-and/) — Medium
- [ ] [Number of Subarrays with AND Value of K](https://leetcode.com/problems/number-of-subarrays-with-and-value-of-k/) — Hard
- [ ] [Triples with Bitwise AND Equal to Zero](https://leetcode.com/problems/triples-with-bitwise-and-equal-to-zero/) — Hard
- [ ] [Minimum Operations to Form Subsequence with Target Sum](https://leetcode.com/problems/minimum-operations-to-form-subsequence-with-target-sum/) — Hard

#### Recursion and Backtracking Problems

##### Recursion Problems
- [ ] [Power of Two](https://leetcode.com/problems/power-of-two/) — Easy
- [ ] [Power of Three](https://leetcode.com/problems/power-of-three/) — Easy
- [ ] [Power of Four](https://leetcode.com/problems/power-of-four/) — Easy
- [ ] [Fibonacci Number](https://leetcode.com/problems/fibonacci-number/) — Easy
- [ ] [Pow(x, n)](https://leetcode.com/problems/powx-n/) — Medium
- [ ] [Count Good Numbers](https://leetcode.com/problems/count-good-numbers/) — Easy
- [ ] [Minimum Non-Zero Product of the Array Elements](https://leetcode.com/problems/minimum-non-zero-product-of-the-array-elements/) — Medium
- [ ] Delete Middle Element of a Stack — Easy
- [ ] Sort a Stack — Medium
- [ ] Josephus Problem — Easy
- [ ] [Find the Winner of the Circular Game](https://leetcode.com/problems/find-the-winner-of-the-circular-game/) — Medium
- [ ] [Predict the Winner](https://leetcode.com/problems/predict-the-winner/) — Medium
- [ ] Tower of Hanoi — Medium
- [ ] [Different Ways to Add Parentheses](https://leetcode.com/problems/different-ways-to-add-parentheses/) — Medium
- [ ] [Basic Calculator](https://leetcode.com/problems/basic-calculator/) — Hard
- [ ] [Permutation Sequence](https://leetcode.com/problems/permutation-sequence/) — Hard
- [ ] [Regular Expression Matching](https://leetcode.com/problems/regular-expression-matching/) — Hard
- [ ] [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) — Hard
- [ ] [Integer to English Words](https://leetcode.com/problems/integer-to-english-words/) — Hard
- [ ] [Special Binary String](https://leetcode.com/problems/special-binary-string/) — Hard

##### Permutation Problems
- [ ] [Permutations](https://leetcode.com/problems/permutations/) — Medium
- [ ] [Construct Smallest Number from DI String](https://leetcode.com/problems/construct-smallest-number-from-di-string/) — Medium
- [ ] [Beautiful Arrangement](https://leetcode.com/problems/beautiful-arrangement/) — Medium

##### Combination Problems
- [ ] [Target Sum](https://leetcode.com/problems/target-sum/) — Medium
- [ ] [Combinations](https://leetcode.com/problems/combinations/) — Medium
- [ ] [Letter Combinations of a Phone Number](https://leetcode.com/problems/letter-combinations-of-a-phone-number/) — Medium
- [ ] [Letter Case Permutation](https://leetcode.com/problems/letter-case-permutation/) — Medium
- [ ] [K-th Lexicographical String of All Happy Strings of Length n](https://leetcode.com/problems/k-th-lexicographical-string-of-all-happy-strings-of-length-n/) — Medium
- [ ] [Combination Sum](https://leetcode.com/problems/combination-sum/) — Medium
- [ ] [Combination Sum II](https://leetcode.com/problems/combination-sum-ii/) — Medium
- [ ] [Combination Sum III](https://leetcode.com/problems/combination-sum-iii/) — Medium
- [ ] [Maximum Compatibility Score Sum](https://leetcode.com/problems/maximum-compatibility-score-sum/) — Medium
- [ ] [Numbers with Same Consecutive Differences](https://leetcode.com/problems/numbers-with-same-consecutive-differences/) — Medium
- [ ] [N-Queens](https://leetcode.com/problems/n-queens/) — Hard

##### Subsets Problems
- [ ] [Subsets](https://leetcode.com/problems/subsets/) — Medium
- [ ] [Subsets II](https://leetcode.com/problems/subsets-ii/) — Medium
- [ ] [Non-Decreasing Subsequences](https://leetcode.com/problems/non-decreasing-subsequences/) — Medium
- [ ] [Number of Beautiful Subsets](https://leetcode.com/problems/number-of-beautiful-subsets/) — Medium

##### Path on Grid Problems
- [ ] Rat in a Maze Problem — Medium
- [ ] [Sudoku Solver](https://leetcode.com/problems/sudoku-solver/) — Hard

#### Binary Tree Problems

##### Traversals
- [ ] [Binary Tree Preorder Traversal](https://leetcode.com/problems/binary-tree-preorder-traversal/) — Easy
- [ ] [Binary Tree Inorder Traversal](https://leetcode.com/problems/binary-tree-inorder-traversal/) — Easy
- [ ] [Binary Tree Postorder Traversal](https://leetcode.com/problems/binary-tree-postorder-traversal/) — Easy
- [ ] Preorder, Postorder, Inorder in a Single Traversal — Easy

##### Properties of Trees
- [ ] Remove Half Nodes — Easy
- [ ] [Balanced Binary Tree](https://leetcode.com/problems/balanced-binary-tree/) — Easy
- [ ] [Maximum Depth of Binary Tree](https://leetcode.com/problems/maximum-depth-of-binary-tree/) — Easy
- [ ] [Diameter of Binary Tree](https://leetcode.com/problems/diameter-of-binary-tree/) — Easy
- [ ] [Count Complete Tree Nodes](https://leetcode.com/problems/count-complete-tree-nodes/) — Easy
- [ ] [Minimum Depth of Binary Tree](https://leetcode.com/problems/minimum-depth-of-binary-tree/) — Easy
- [ ] [Check Completeness of a Binary Tree](https://leetcode.com/problems/check-completeness-of-a-binary-tree/) — Medium

##### Construction of Tree
- [ ] Construct Binary Tree from Parent Array — Medium
- [ ] Linked List to Binary Tree — Medium
- [ ] [Construct Binary Tree from Preorder and Inorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/) — Medium
- [ ] [Construct Binary Tree from Inorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-inorder-and-postorder-traversal/) — Medium
- [ ] [Construct Binary Tree from Preorder and Postorder Traversal](https://leetcode.com/problems/construct-binary-tree-from-preorder-and-postorder-traversal/) — Medium
- [ ] Construct Binary Tree from String with Bracket Representation — Medium

##### Two Tree Validation
- [ ] [Same Tree](https://leetcode.com/problems/same-tree/) — Easy
- [ ] Two Mirror Trees — Easy
- [ ] [Merge Two Binary Trees](https://leetcode.com/problems/merge-two-binary-trees/) — Easy
- [ ] [Subtree of Another Tree](https://leetcode.com/problems/subtree-of-another-tree/) — Easy
- [ ] Check if Tree is Isomorphic — Easy
- [ ] [Leaf-Similar Trees](https://leetcode.com/problems/leaf-similar-trees/) — Easy
- [ ] Check if Subtree — Medium
- [ ] Mirror Tree — Medium

##### Level Order Traversal
- [ ] [Binary Tree Level Order Traversal](https://leetcode.com/problems/binary-tree-level-order-traversal/) — Medium
- [ ] [Binary Tree Level Order Traversal II](https://leetcode.com/problems/binary-tree-level-order-traversal-ii/) — Medium
- [ ] [Cousins in Binary Tree](https://leetcode.com/problems/cousins-in-binary-tree/) — Easy
- [ ] [Average of Levels in Binary Tree](https://leetcode.com/problems/average-of-levels-in-binary-tree/) — Easy
- [ ] [Minimum Number of Operations to Sort a Binary Tree by Level](https://leetcode.com/problems/minimum-number-of-operations-to-sort-a-binary-tree-by-level/) — Medium
- [ ] [Binary Tree Right Side View](https://leetcode.com/problems/binary-tree-right-side-view/) — Easy
- [ ] Left View of Binary Tree — Easy
- [ ] Top View of Binary Tree — Medium
- [ ] [Vertical Order Traversal of a Binary Tree](https://leetcode.com/problems/vertical-order-traversal-of-a-binary-tree/) — Hard
- [ ] [Serialize and Deserialize Binary Tree](https://leetcode.com/problems/serialize-and-deserialize-binary-tree/) — Hard
- [ ] [All Nodes Distance K in Binary Tree](https://leetcode.com/problems/all-nodes-distance-k-in-binary-tree/) — Medium
- [ ] Burning Tree — Hard
- [ ] [Populating Next Right Pointers in Each Node](https://leetcode.com/problems/populating-next-right-pointers-in-each-node/) — Medium

##### Binary Tree Path
- [ ] [Binary Tree Paths](https://leetcode.com/problems/binary-tree-paths/) — Easy
- [ ] [Path Sum](https://leetcode.com/problems/path-sum/) — Easy
- [ ] Children Sum in a Binary Tree — Medium
- [ ] [Path Sum II](https://leetcode.com/problems/path-sum-ii/) — Medium
- [ ] [Sum Root to Leaf Numbers](https://leetcode.com/problems/sum-root-to-leaf-numbers/) — Medium
- [ ] [Binary Tree Maximum Path Sum](https://leetcode.com/problems/binary-tree-maximum-path-sum/) — Hard
- [ ] [Path Sum III](https://leetcode.com/problems/path-sum-iii/) — Medium
- [ ] [Lowest Common Ancestor of a Binary Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/) — Medium

##### N-ary Tree
- [ ] N-ary Tree — Theory
- [ ] [N-ary Tree Postorder Traversal](https://leetcode.com/problems/n-ary-tree-postorder-traversal/) — Easy
- [ ] [N-ary Tree Preorder Traversal](https://leetcode.com/problems/n-ary-tree-preorder-traversal/) — Easy
- [ ] [Maximum Depth of N-ary Tree](https://leetcode.com/problems/maximum-depth-of-n-ary-tree/) — Easy

#### Binary Search Tree Problems

##### Basic Operations
- [ ] [Search in a Binary Search Tree](https://leetcode.com/problems/search-in-a-binary-search-tree/) — Easy
- [ ] [Insert into a Binary Search Tree](https://leetcode.com/problems/insert-into-a-binary-search-tree/) — Medium
- [ ] [Delete Node in a BST](https://leetcode.com/problems/delete-node-in-a-bst/) — Medium

##### Construction of BST
- [ ] [Convert Sorted Array to Binary Search Tree](https://leetcode.com/problems/convert-sorted-array-to-binary-search-tree/) — Easy
- [ ] [Convert Sorted List to Binary Search Tree](https://leetcode.com/problems/convert-sorted-list-to-binary-search-tree/) — Medium
- [ ] [Convert BST to Greater Tree](https://leetcode.com/problems/convert-bst-to-greater-tree/) — Medium
- [ ] [Trim a Binary Search Tree](https://leetcode.com/problems/trim-a-binary-search-tree/) — Medium
- [ ] [Serialize and Deserialize BST](https://leetcode.com/problems/serialize-and-deserialize-bst/) — Medium
- [ ] [Construct Binary Search Tree from Preorder Traversal](https://leetcode.com/problems/construct-binary-search-tree-from-preorder-traversal/) — Medium
- [ ] Construct BST from Postorder — Medium
- [ ] [Balance a Binary Search Tree](https://leetcode.com/problems/balance-a-binary-search-tree/) — Medium
- [ ] [Binary Search Tree to Greater Sum Tree](https://leetcode.com/problems/binary-search-tree-to-greater-sum-tree/) — Medium

##### Validation and Property
- [ ] [Find Mode in Binary Search Tree](https://leetcode.com/problems/find-mode-in-binary-search-tree/) — Easy
- [ ] [Range Sum of BST](https://leetcode.com/problems/range-sum-of-bst/) — Easy
- [ ] [Validate Binary Search Tree](https://leetcode.com/problems/validate-binary-search-tree/) — Medium
- [ ] [Minimum Distance Between BST Nodes](https://leetcode.com/problems/minimum-distance-between-bst-nodes/) — Easy
- [ ] [Kth Smallest Element in a BST](https://leetcode.com/problems/kth-smallest-element-in-a-bst/) — Medium
- [ ] [Increasing Order Search Tree](https://leetcode.com/problems/increasing-order-search-tree/) — Easy
- [ ] [Two Sum IV - Input is a BST](https://leetcode.com/problems/two-sum-iv-input-is-a-bst/) — Easy
- [ ] [Maximum Sum BST in Binary Tree](https://leetcode.com/problems/maximum-sum-bst-in-binary-tree/) — Hard
- [ ] Find Common Nodes in two BSTs — Medium
- [ ] [All Elements in Two Binary Search Trees](https://leetcode.com/problems/all-elements-in-two-binary-search-trees/) — Medium
- [ ] [Unique Binary Search Trees](https://leetcode.com/problems/unique-binary-search-trees/) — Medium
- [ ] [Recover Binary Search Tree](https://leetcode.com/problems/recover-binary-search-tree/) — Medium
- [ ] [Number of Ways to Reorder Array to Get Same BST](https://leetcode.com/problems/number-of-ways-to-reorder-array-to-get-same-bst/) — Hard
- [ ] [Binary Search Tree Iterator](https://leetcode.com/problems/binary-search-tree-iterator/) — Medium
- [ ] [Lowest Common Ancestor of a Binary Search Tree](https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/) — Medium
- [ ] [Closest Nodes Queries in a Binary Search Tree](https://leetcode.com/problems/closest-nodes-queries-in-a-binary-search-tree/) — Medium

#### Heap Problems

##### Introductory Questions
- [ ] Implementation of Priority Queue using Binary Heap — Easy
- [ ] Heap Sort — Medium
- [ ] Does Array Represent Heap? — Easy
- [ ] Is Binary Tree Heap? — Medium
- [ ] Operations on Binary Min Heap — Medium
- [ ] Convert Min Heap to Max Heap — Medium

##### Implementary Questions
- [ ] [Relative Ranks](https://leetcode.com/problems/relative-ranks/) — Easy
- [ ] [Take Gifts From the Richest Pile](https://leetcode.com/problems/take-gifts-from-the-richest-pile/) — Easy
- [ ] [Last Stone Weight](https://leetcode.com/problems/last-stone-weight/) — Easy
- [ ] [Largest Number After Digit Swaps by Parity](https://leetcode.com/problems/largest-number-after-digit-swaps-by-parity/) — Easy
- [ ] [Minimum Amount of Time to Fill Cups](https://leetcode.com/problems/minimum-amount-of-time-to-fill-cups/) — Easy
- [ ] [Seat Reservation Manager](https://leetcode.com/problems/seat-reservation-manager/) — Medium
- [ ] [Sort Characters By Frequency](https://leetcode.com/problems/sort-characters-by-frequency/) — Medium
- [ ] [Reduce Array Size to The Half](https://leetcode.com/problems/reduce-array-size-to-the-half/) — Medium
- [ ] [Longest Happy String](https://leetcode.com/problems/longest-happy-string/) — Medium
- [ ] [Reorganize String](https://leetcode.com/problems/reorganize-string/) — Medium
- [ ] [Maximum Average Pass Ratio](https://leetcode.com/problems/maximum-average-pass-ratio/) — Medium
- [ ] [Find Score of an Array After Marking All Elements](https://leetcode.com/problems/find-score-of-an-array-after-marking-all-elements/) — Medium
- [ ] [Furthest Building You Can Reach](https://leetcode.com/problems/furthest-building-you-can-reach/) — Medium
- [ ] [Distant Barcodes](https://leetcode.com/problems/distant-barcodes/) — Medium
- [ ] [Task Scheduler](https://leetcode.com/problems/task-scheduler/) — Medium
- [ ] [Maximal Score After Applying K Operations](https://leetcode.com/problems/maximal-score-after-applying-k-operations/) — Medium
- [ ] [Single Threaded CPU](https://leetcode.com/problems/single-threaded-cpu/) — Medium
- [ ] [Most Popular Video Creator](https://leetcode.com/problems/most-popular-video-creator/) — Medium
- [ ] [Total Cost to Hire K Workers](https://leetcode.com/problems/total-cost-to-hire-k-workers/) — Medium
- [ ] [Most Frequent IDs](https://leetcode.com/problems/most-frequent-ids/) — Medium
- [ ] [Process Tasks Using Servers](https://leetcode.com/problems/process-tasks-using-servers/) — Medium
- [ ] [Maximum Number of Eaten Apples](https://leetcode.com/problems/maximum-number-of-eaten-apples/) — Medium
- [ ] [Maximum Number of Events That Can Be Attended](https://leetcode.com/problems/maximum-number-of-events-that-can-be-attended/) — Medium
- [ ] [Minimum Operations to Exceed Threshold Value II](https://leetcode.com/problems/minimum-operations-to-exceed-threshold-value-ii/) — Medium
- [ ] [Put Marbles in Bags](https://leetcode.com/problems/put-marbles-in-bags/) — Hard
- [ ] [Maximum Spending After Buying Items](https://leetcode.com/problems/maximum-spending-after-buying-items/) — Hard
- [ ] [Trapping Rain Water II](https://leetcode.com/problems/trapping-rain-water-ii/) — Hard
- [ ] [Maximum Subsequence Score](https://leetcode.com/problems/maximum-subsequence-score/) — Medium
- [ ] [Maximum Performance of a Team](https://leetcode.com/problems/maximum-performance-of-a-team/) — Hard
- [ ] [Max Value of Equation](https://leetcode.com/problems/max-value-of-equation/) — Hard
- [ ] [The Skyline Problem](https://leetcode.com/problems/the-skyline-problem/) — Hard
- [ ] [Maximum Elegance of a K-Length Subsequence](https://leetcode.com/problems/maximum-elegance-of-a-k-length-subsequence/) — Hard

##### Kth Pattern Problems
- [ ] [The K Weakest Rows in a Matrix](https://leetcode.com/problems/the-k-weakest-rows-in-a-matrix/) — Easy
- [ ] [Kth Largest Element in an Array](https://leetcode.com/problems/kth-largest-element-in-an-array/) — Medium
- [ ] [Kth Largest Element in a Stream](https://leetcode.com/problems/kth-largest-element-in-a-stream/) — Easy
- [ ] [Find Subsequence of Length K With the Largest Sum](https://leetcode.com/problems/find-subsequence-of-length-k-with-the-largest-sum/) — Easy
- [ ] [K-th Smallest Prime Fraction](https://leetcode.com/problems/k-th-smallest-prime-fraction/) — Medium
- [ ] [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/) — Medium
- [ ] [Top K Frequent Elements](https://leetcode.com/problems/top-k-frequent-elements/) — Medium
- [ ] [Kth Smallest Element in a Sorted Matrix](https://leetcode.com/problems/kth-smallest-element-in-a-sorted-matrix/) — Medium
- [ ] [Find Kth Largest XOR Coordinate Value](https://leetcode.com/problems/find-kth-largest-xor-coordinate-value/) — Medium
- [ ] [Top K Frequent Words](https://leetcode.com/problems/top-k-frequent-words/) — Medium
- [ ] [Find K Closest Elements](https://leetcode.com/problems/find-k-closest-elements/) — Medium
- [ ] [Ugly Number II](https://leetcode.com/problems/ugly-number-ii/) — Medium
- [ ] [Find the Kth Largest Integer in the Array](https://leetcode.com/problems/find-the-kth-largest-integer-in-the-array/) — Medium
- [ ] [Reward Top K Students](https://leetcode.com/problems/reward-top-k-students/) — Medium
- [ ] [Query Kth Smallest Trimmed Number](https://leetcode.com/problems/query-kth-smallest-trimmed-number/) — Medium
- [ ] [K Highest Ranked Items Within a Price Range](https://leetcode.com/problems/k-highest-ranked-items-within-a-price-range/) — Medium
- [ ] [Find the Kth Smallest Sum of a Matrix With Sorted Rows](https://leetcode.com/problems/find-the-kth-smallest-sum-of-a-matrix-with-sorted-rows/) — Hard
- [ ] [Find the K-Sum of an Array](https://leetcode.com/problems/find-the-k-sum-of-an-array/) — Hard

##### Minimize Operations
- [ ] [Remove Stones to Minimize the Total](https://leetcode.com/problems/remove-stones-to-minimize-the-total/) — Medium
- [ ] [Minimum Operations to Halve Array Sum](https://leetcode.com/problems/minimum-operations-to-halve-array-sum/) — Medium
- [ ] [The Number of the Smallest Unoccupied Chair](https://leetcode.com/problems/the-number-of-the-smallest-unoccupied-chair/) — Medium
- [ ] [Lexicographically Minimum String After Removing Stars](https://leetcode.com/problems/lexicographically-minimum-string-after-removing-stars/) — Medium
- [ ] [Replace Question Marks in String to Minimize Its Value](https://leetcode.com/problems/replace-question-marks-in-string-to-minimize-its-value/) — Medium
- [ ] [Minimum Sum of Squared Difference](https://leetcode.com/problems/minimum-sum-of-squared-difference/) — Medium
- [ ] [Minimum Cost to Hire K Workers](https://leetcode.com/problems/minimum-cost-to-hire-k-workers/) — Hard
- [ ] [Minimize Deviation in Array](https://leetcode.com/problems/minimize-deviation-in-array/) — Hard
- [ ] [Minimum Moves to Move a Box to Their Target Location](https://leetcode.com/problems/minimum-moves-to-move-a-box-to-their-target-location/) — Hard
- [ ] [Minimum Interval to Include Each Query](https://leetcode.com/problems/minimum-interval-to-include-each-query/) — Hard

##### Merge K Sorted Patterns
- [ ] [Merge k Sorted Lists](https://leetcode.com/problems/merge-k-sorted-lists/) — Hard
- [ ] [Find K Pairs with Smallest Sums](https://leetcode.com/problems/find-k-pairs-with-smallest-sums/) — Hard
- [ ] Merge K Sorted Arrays — Medium

##### Two Heap Pattern
- [ ] [Number of Orders in the Backlog](https://leetcode.com/problems/number-of-orders-in-the-backlog/) — Medium
- [ ] [Sliding Window Median](https://leetcode.com/problems/sliding-window-median/) — Hard
- [ ] [IPO](https://leetcode.com/problems/ipo/) — Hard
- [ ] [Find Median from Data Stream](https://leetcode.com/problems/find-median-from-data-stream/) — Hard
- [ ] [Meeting Rooms III](https://leetcode.com/problems/meeting-rooms-iii/) — Hard
- [ ] [Time to Cross a Bridge](https://leetcode.com/problems/time-to-cross-a-bridge/) — Hard

#### Trie Problems

##### Introductory Questions
- [ ] [Implement Trie (Prefix Tree)](https://leetcode.com/problems/implement-trie-prefix-tree/) — Medium
- [ ] Trie Delete — Hard
- [ ] [Design Add and Search Words Data Structure](https://leetcode.com/problems/design-add-and-search-words-data-structure/) — Medium
- [ ] [Map Sum Pairs](https://leetcode.com/problems/map-sum-pairs/) — Medium

##### Trie with Bit Manipulation
- [ ] [Maximum XOR of Two Numbers in an Array](https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/) — Hard
- [ ] Minimum XOR Value Pair — Hard
- [ ] [Maximum XOR With an Element From Array](https://leetcode.com/problems/maximum-xor-with-an-element-from-array/) — Hard
- [ ] [Count Pairs With XOR in a Range](https://leetcode.com/problems/count-pairs-with-xor-in-a-range/) — Hard
- [ ] [Maximum Strong Pair XOR II](https://leetcode.com/problems/maximum-strong-pair-xor-ii/) — Hard

##### Trie Involving String
- [ ] [Longest Common Prefix](https://leetcode.com/problems/longest-common-prefix/) — Medium
- [ ] [Find the Length of the Longest Common Prefix](https://leetcode.com/problems/find-the-length-of-the-longest-common-prefix/) — Medium
- [ ] [Search Suggestions System](https://leetcode.com/problems/search-suggestions-system/) — Medium
- [ ] [Sum of Prefix Scores of Strings](https://leetcode.com/problems/sum-of-prefix-scores-of-strings/) — Hard
- [ ] [Prefix and Suffix Search](https://leetcode.com/problems/prefix-and-suffix-search/) — Hard
- [ ] [Longest Common Suffix Queries](https://leetcode.com/problems/longest-common-suffix-queries/) — Hard
- [ ] [Count Prefix and Suffix Pairs II](https://leetcode.com/problems/count-prefix-and-suffix-pairs-ii/) — Hard
- [ ] [Stream of Characters](https://leetcode.com/problems/stream-of-characters/) — Hard
- [ ] [Extra Characters in a String](https://leetcode.com/problems/extra-characters-in-a-string/) — Medium
- [ ] [Implement Magic Dictionary](https://leetcode.com/problems/implement-magic-dictionary/) — Medium
- [ ] [Number of Matching Subsequences](https://leetcode.com/problems/number-of-matching-subsequences/) — Medium
- [ ] [Camelcase Matching](https://leetcode.com/problems/camelcase-matching/) — Medium
- [ ] [Short Encoding of Words](https://leetcode.com/problems/short-encoding-of-words/) — Medium
- [ ] [Encrypt and Decrypt Strings](https://leetcode.com/problems/encrypt-and-decrypt-strings/) — Hard
- [ ] [Longest Word in Dictionary](https://leetcode.com/problems/longest-word-in-dictionary/) — Medium
- [ ] [Construct String With Minimum Cost](https://leetcode.com/problems/construct-string-with-minimum-cost/) — Hard

##### Trie Involving Recursion
- [ ] [Shortest Uncommon Substring in an Array](https://leetcode.com/problems/shortest-uncommon-substring-in-an-array/) — Medium
- [ ] [Word Break](https://leetcode.com/problems/word-break/) — Medium
- [ ] [Word Break II](https://leetcode.com/problems/word-break-ii/) — Hard
- [ ] [Word Search II](https://leetcode.com/problems/word-search-ii/) — Hard
- [ ] [Palindrome Pairs](https://leetcode.com/problems/palindrome-pairs/) — Hard

##### Trie Involving File System
- [ ] [Remove Sub-Folders from the Filesystem](https://leetcode.com/problems/remove-sub-folders-from-the-filesystem/) — Hard
- [ ] [Delete Duplicate Folders in System](https://leetcode.com/problems/delete-duplicate-folders-in-system/) — Medium

#### Greedy Problems

##### Part I
- [ ] [Maximum 69 Number](https://leetcode.com/problems/maximum-69-number/) — Easy
- [ ] Maximum Sum with Exactly K Elements — Easy
- [ ] [Minimum Time to Type Word Using Special Typewriter](https://leetcode.com/problems/minimum-time-to-type-word-using-special-typewriter/) — Easy
- [ ] [Minimum Operations to Make the Array Increasing](https://leetcode.com/problems/minimum-operations-to-make-the-array-increasing/) — Easy
- [ ] [Minimum Number of Operations to Convert Time](https://leetcode.com/problems/minimum-number-of-operations-to-convert-time/) — Easy
- [ ] [Assign Cookies](https://leetcode.com/problems/assign-cookies/) — Easy
- [ ] [Play with Chips](https://leetcode.com/problems/play-with-chips/) — Easy
- [ ] [Jump Game](https://leetcode.com/problems/jump-game/) — Medium
- [ ] [Jump Game II](https://leetcode.com/problems/jump-game-ii/) — Medium
- [ ] [Wiggle Subsequence](https://leetcode.com/problems/wiggle-subsequence/) — Medium
- [ ] [Cinema Seat Allocation](https://leetcode.com/problems/cinema-seat-allocation/) — Medium
- [ ] [Advantage Shuffle](https://leetcode.com/problems/advantage-shuffle/) — Medium
- [ ] [Minimum Score by Changing Two Elements](https://leetcode.com/problems/minimum-score-by-changing-two-elements/) — Medium
- [ ] [Minimum Operations to Make Array Equal II](https://leetcode.com/problems/minimum-operations-to-make-array-equal-ii/) — Medium
- [ ] [Mice and Cheese](https://leetcode.com/problems/mice-and-cheese/) — Medium
- [ ] [Minimum Seconds to Equalize a Circular Array](https://leetcode.com/problems/minimum-seconds-to-equalize-a-circular-array/) — Medium
- [ ] [Maximum Bags with Full Capacity of Rocks](https://leetcode.com/problems/maximum-bags-with-full-capacity-of-rocks/) — Medium
- [ ] [Minimize Maximum of Array](https://leetcode.com/problems/minimize-maximum-of-array/) — Medium
- [ ] Minimum Platforms — Medium
- [ ] Fractional Knapsack — Medium
- [ ] Activity Selection — Medium
- [ ] Job Sequencing Problem — Medium
- [ ] [Non-Overlapping Intervals](https://leetcode.com/problems/non-overlapping-intervals/) — Medium
- [ ] [Divide Intervals into Minimum Number of Groups](https://leetcode.com/problems/divide-intervals-into-minimum-number-of-groups/) — Medium
- [ ] [Task Scheduler](https://leetcode.com/problems/task-scheduler/) — Medium
- [ ] [Minimum Number of Operations to Make Arrays Similar](https://leetcode.com/problems/minimum-number-of-operations-to-make-arrays-similar/) — Hard
- [ ] [Minimum Cost for Cutting Cake II](https://leetcode.com/problems/minimum-cost-for-cutting-cake-ii/) — Hard
- [ ] [Patching Array](https://leetcode.com/problems/patching-array/) — Hard
- [ ] [Reverse Subarray to Maximize Array Value](https://leetcode.com/problems/reverse-subarray-to-maximize-array-value/) — Hard
- [ ] [Super Washing Machines](https://leetcode.com/problems/super-washing-machines/) — Hard
- [ ] [Minimum Cost to Equalize Array](https://leetcode.com/problems/minimum-cost-to-equalize-array/) — Hard
- [ ] [Optimal Partition of String](https://leetcode.com/problems/optimal-partition-of-string/) — Medium
- [ ] [Minimum Swaps to Make Strings Equal](https://leetcode.com/problems/minimum-swaps-to-make-strings-equal/) — Medium
- [ ] [Maximum Number of Non-Overlapping Substrings](https://leetcode.com/problems/maximum-number-of-non-overlapping-substrings/) — Hard
- [ ] [Lexicographically Smallest Beautiful String](https://leetcode.com/problems/lexicographically-smallest-beautiful-string/) — Hard
- [ ] [Count K-Subsequences of a String with Maximum Beauty](https://leetcode.com/problems/count-k-subsequences-of-a-string-with-maximum-beauty/) — Hard
- [ ] [Bag of Tokens](https://leetcode.com/problems/bag-of-tokens/) — Medium
- [ ] [Boats to Save People](https://leetcode.com/problems/boats-to-save-people/) — Medium
- [ ] [Maximum Matching of Players with Trainers](https://leetcode.com/problems/maximum-matching-of-players-with-trainers/) — Medium
- [ ] [Candy](https://leetcode.com/problems/candy/) — Hard

##### Part II
- [ ] [Lemonade Change](https://leetcode.com/problems/lemonade-change/) — Easy
- [ ] [Gas Station](https://leetcode.com/problems/gas-station/) — Medium
- [ ] [Group the People Given the Group Size They Belong To](https://leetcode.com/problems/group-the-people-given-the-group-size-they-belong-to/) — Medium
- [ ] [Divide Array in Sets of K Consecutive Numbers](https://leetcode.com/problems/divide-array-in-sets-of-k-consecutive-numbers/) — Medium
- [ ] [Previous Permutation with One Swap](https://leetcode.com/problems/previous-permutation-with-one-swap/) — Medium
- [ ] [Partition Labels](https://leetcode.com/problems/partition-labels/) — Medium
- [ ] [Construct K Palindrome Strings](https://leetcode.com/problems/construct-k-palindrome-strings/) — Medium
- [ ] [Reorganize String](https://leetcode.com/problems/reorganize-string/) — Medium
- [ ] [String Without AAA or BBB](https://leetcode.com/problems/string-without-aaa-or-bbb/) — Medium
- [ ] [Check If a String Can Break Another String](https://leetcode.com/problems/check-if-a-string-can-break-another-string/) — Medium
- [ ] [Remove Duplicate Letters](https://leetcode.com/problems/remove-duplicate-letters/) — Medium
- [ ] [Largest Merge of Two Strings](https://leetcode.com/problems/largest-merge-of-two-strings/) — Medium
- [ ] [Shortest String That Contains Three Strings](https://leetcode.com/problems/shortest-string-that-contains-three-strings/) — Medium
- [ ] [Lexicographically Smallest String After Substring Operation](https://leetcode.com/problems/lexicographically-smallest-string-after-substring-operation/) — Medium
- [ ] [Minimum Rounds to Complete All Tasks](https://leetcode.com/problems/minimum-rounds-to-complete-all-tasks/) — Medium
- [ ] [Number of Burgers with No Waste of Ingredients](https://leetcode.com/problems/number-of-burgers-with-no-waste-of-ingredients/) — Medium
- [ ] [Queue Reconstruction by Height](https://leetcode.com/problems/queue-reconstruction-by-height/) — Medium
- [ ] [Car Pooling](https://leetcode.com/problems/car-pooling/) — Medium

#### Dynamic Programming Problems

##### Linear DP
- [ ] [Climbing Stairs](https://leetcode.com/problems/climbing-stairs/) — Easy
- [ ] [Min Cost Climbing Stairs](https://leetcode.com/problems/min-cost-climbing-stairs/) — Easy
- [ ] [Perfect Squares](https://leetcode.com/problems/perfect-squares/) — Medium
- [ ] [Decode Ways](https://leetcode.com/problems/decode-ways/) — Medium
- [ ] [Unique Binary Search Trees](https://leetcode.com/problems/unique-binary-search-trees/) — Medium
- [ ] [House Robber](https://leetcode.com/problems/house-robber/) — Medium
- [ ] [Coin Change](https://leetcode.com/problems/coin-change/) — Medium
- [ ] [Best Time to Buy and Sell Stock](https://leetcode.com/problems/best-time-to-buy-and-sell-stock/) — Easy
- [ ] [Minimum Cost For Tickets](https://leetcode.com/problems/minimum-cost-for-tickets/) — Medium
- [ ] [Delete and Earn](https://leetcode.com/problems/delete-and-earn/) — Medium
- [ ] [Maximum Total Damage With Spell Casting](https://leetcode.com/problems/maximum-total-damage-with-spell-casting/) — Medium
- [ ] [Arithmetic Slices](https://leetcode.com/problems/arithmetic-slices/) — Medium
- [ ] [Longest Arithmetic Subsequence of Given Difference](https://leetcode.com/problems/longest-arithmetic-subsequence-of-given-difference/) — Medium
- [ ] [Partition Array for Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/) — Medium
- [ ] [Maximize Consecutive Elements in an Array After Modification](https://leetcode.com/problems/maximize-consecutive-elements-in-an-array-after-modification/) — Hard

##### 2D DP
- [ ] [Coin Change II](https://leetcode.com/problems/coin-change-ii/) — Medium
- [ ] [Knight Dialer](https://leetcode.com/problems/knight-dialer/) — Medium
- [ ] [Partition Equal Subset Sum](https://leetcode.com/problems/partition-equal-subset-sum/) — Medium
- [ ] [Triangle](https://leetcode.com/problems/triangle/) — Medium
- [ ] [Student Attendance Record II](https://leetcode.com/problems/student-attendance-record-ii/) — Hard
- [ ] [Find the Maximum Length of a Good Subsequence II](https://leetcode.com/problems/find-the-maximum-length-of-a-good-subsequence-ii/) — Hard
- [ ] [K Inverse Pairs Array](https://leetcode.com/problems/k-inverse-pairs-array/) — Hard
- [ ] [Combination Sum IV](https://leetcode.com/problems/combination-sum-iv/) — Medium
- [ ] [Largest Sum of Averages](https://leetcode.com/problems/largest-sum-of-averages/) — Medium
- [ ] [Longest Arithmetic Subsequence](https://leetcode.com/problems/longest-arithmetic-subsequence/) — Medium
- [ ] [Number of Dice Rolls With Target Sum](https://leetcode.com/problems/number-of-dice-rolls-with-target-sum/) — Medium
- [ ] [Dice Roll Simulation](https://leetcode.com/problems/dice-roll-simulation/) — Medium
- [ ] [Number of Strings Which Can Be Rearranged to Contain Substring](https://leetcode.com/problems/number-of-strings-which-can-be-rearranged-to-contain-substring/) — Hard
- [ ] [Frog Jump](https://leetcode.com/problems/frog-jump/) — Hard
- [ ] [Best Time to Buy and Sell Stock II](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-ii/) — Hard
- [ ] [Best Time to Buy and Sell Stock III](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iii/) — Hard
- [ ] [Best Time to Buy and Sell Stock IV](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iv/) — Hard
- [ ] [Freedom Trail](https://leetcode.com/problems/freedom-trail/) — Hard
- [ ] [Number of Music Playlists](https://leetcode.com/problems/number-of-music-playlists/) — Hard
- [ ] [Count Vowels Permutation](https://leetcode.com/problems/count-vowels-permutation/) — Hard
- [ ] [Best Time to Buy and Sell Stock with Transaction Fee](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-transaction-fee/) — Medium
- [ ] [Minimum Distance to Type a Word Using Two Fingers](https://leetcode.com/problems/minimum-distance-to-type-a-word-using-two-fingers/) — Hard
- [ ] [Minimum Difficulty of a Job Schedule](https://leetcode.com/problems/minimum-difficulty-of-a-job-schedule/) — Hard
- [ ] [Best Time to Buy and Sell Stock with Cooldown](https://leetcode.com/problems/best-time-to-buy-and-sell-stock-with-cooldown/) — Medium
- [ ] [Number of Ways to Paint N × 3 Grid](https://leetcode.com/problems/number-of-ways-to-paint-n-3-grid/) — Hard
- [ ] [Build Array Where You Can Find The Maximum Exactly K Comparisons](https://leetcode.com/problems/build-array-where-you-can-find-the-maximum-exactly-k-comparisons/) — Hard
- [ ] [Number of Ways of Cutting a Pizza](https://leetcode.com/problems/number-of-ways-of-cutting-a-pizza/) — Hard
- [ ] [Paint House III](https://leetcode.com/problems/paint-house-iii/) — Hard
- [ ] [Count All Possible Routes](https://leetcode.com/problems/count-all-possible-routes/) — Hard

##### DP On Grid
- [ ] Geek's Training — Medium
- [ ] [Unique Paths](https://leetcode.com/problems/unique-paths/) — Medium
- [ ] [Unique Paths II](https://leetcode.com/problems/unique-paths-ii/) — Medium
- [ ] [Minimum Path Sum](https://leetcode.com/problems/minimum-path-sum/) — Medium
- [ ] [Maximum Non Negative Product in a Matrix](https://leetcode.com/problems/maximum-non-negative-product-in-a-matrix/) — Medium
- [ ] [Maximum Difference Score in a Grid](https://leetcode.com/problems/maximum-difference-score-in-a-grid/) — Medium
- [ ] [Minimum Number of Operations to Satisfy Conditions](https://leetcode.com/problems/minimum-number-of-operations-to-satisfy-conditions/) — Medium
- [ ] [Maximum Number of Moves in a Grid](https://leetcode.com/problems/maximum-number-of-moves-in-a-grid/) — Medium
- [ ] [Where Will the Ball Fall](https://leetcode.com/problems/where-will-the-ball-fall/) — Medium
- [ ] [Dungeon Game](https://leetcode.com/problems/dungeon-game/) — Hard
- [ ] [Cherry Pickup](https://leetcode.com/problems/cherry-pickup/) — Hard
- [ ] [Number of Paths with Max Score](https://leetcode.com/problems/number-of-paths-with-max-score/) — Hard
- [ ] [Cherry Pickup II](https://leetcode.com/problems/cherry-pickup-ii/) — Hard
- [ ] [Minimum Falling Path Sum II](https://leetcode.com/problems/minimum-falling-path-sum-ii/) — Hard
- [ ] [Out of Boundary Paths](https://leetcode.com/problems/out-of-boundary-paths/) — Medium
- [ ] [Minimum Falling Path Sum](https://leetcode.com/problems/minimum-falling-path-sum/) — Medium

##### Knapsack DP
- [ ] Knapsack - 1 — Medium
- [ ] Knapsack - 2 — Medium
- [ ] [Ones and Zeroes](https://leetcode.com/problems/ones-and-zeroes/) — Medium
- [ ] [Target Sum](https://leetcode.com/problems/target-sum/) — Medium
- [ ] [2 Keys Keyboard](https://leetcode.com/problems/2-keys-keyboard/) — Medium
- [ ] [Best Team With No Conflicts](https://leetcode.com/problems/best-team-with-no-conflicts/) — Medium
- [ ] [Shopping Offers](https://leetcode.com/problems/shopping-offers/) — Medium
- [ ] [Minimum Number of Coins for Fruits](https://leetcode.com/problems/minimum-number-of-coins-for-fruits/) — Medium
- [ ] [Last Stone Weight II](https://leetcode.com/problems/last-stone-weight-ii/) — Medium
- [ ] Rod Cutting — Medium
- [ ] [Filling Bookcase Shelves](https://leetcode.com/problems/filling-bookcase-shelves/) — Medium
- [ ] [Video Stitching](https://leetcode.com/problems/video-stitching/) — Medium
- [ ] [Maximize Total Cost of Alternating Subarrays](https://leetcode.com/problems/maximize-total-cost-of-alternating-subarrays/) — Hard
- [ ] [Pizza With 3n Slices](https://leetcode.com/problems/pizza-with-3n-slices/) — Hard
- [ ] [Minimum Swaps To Make Sequences Increasing](https://leetcode.com/problems/minimum-swaps-to-make-sequences-increasing/) — Hard
- [ ] [Profitable Schemes](https://leetcode.com/problems/profitable-schemes/) — Hard
- [ ] [Reducing Dishes](https://leetcode.com/problems/reducing-dishes/) — Hard
- [ ] [Find Number of Ways to Reach the K-th Stair](https://leetcode.com/problems/find-number-of-ways-to-reach-the-k-th-stair/) — Hard
- [ ] [Find the Sum of Subsequence Powers](https://leetcode.com/problems/find-the-sum-of-subsequence-powers/) — Hard
- [ ] [Count of Sub-Multisets With Bounded Sum](https://leetcode.com/problems/count-of-sub-multisets-with-bounded-sum/) — Hard

##### Longest Increasing Subsequence
- [ ] [Longest Increasing Subsequence](https://leetcode.com/problems/longest-increasing-subsequence/) — Medium
- [ ] Printing Longest Increasing Subsequence — Medium
- [ ] [Number of Longest Increasing Subsequence](https://leetcode.com/problems/number-of-longest-increasing-subsequence/) — Medium
- [ ] [Largest Divisible Subset](https://leetcode.com/problems/largest-divisible-subset/) — Medium
- [ ] [Longest Unequal Adjacent Groups Subsequence II](https://leetcode.com/problems/longest-unequal-adjacent-groups-subsequence-ii/) — Medium
- [ ] Max Sum Increasing Subsequence — Medium
- [ ] [Find the Maximum Length of Valid Subsequence II](https://leetcode.com/problems/find-the-maximum-length-of-valid-subsequence-ii/) — Medium
- [ ] [Wiggle Subsequence](https://leetcode.com/problems/wiggle-subsequence/) — Medium
- [ ] [Find the Count of Monotonic Pairs I](https://leetcode.com/problems/find-the-count-of-monotonic-pairs-i/) — Hard
- [ ] [Russian Doll Envelopes](https://leetcode.com/problems/russian-doll-envelopes/) — Hard
- [ ] [Delete Columns to Make Sorted III](https://leetcode.com/problems/delete-columns-to-make-sorted-iii/) — Hard
- [ ] [Minimum Number of Removals to Make Mountain Array](https://leetcode.com/problems/minimum-number-of-removals-to-make-mountain-array/) — Hard
- [ ] [Maximum Height by Stacking Cuboids](https://leetcode.com/problems/maximum-height-by-stacking-cuboids/) — Hard
- [ ] [Maximum Length of Pair Chain](https://leetcode.com/problems/maximum-length-of-pair-chain/) — Hard
- [ ] [Make Array Strictly Increasing](https://leetcode.com/problems/make-array-strictly-increasing/) — Hard

##### Longest Common Subsequence
- [ ] [Longest Common Subsequence](https://leetcode.com/problems/longest-common-subsequence/) — Medium
- [ ] Print all LCS sequences — Hard
- [ ] Count Common Subsequence in Two Strings — Theory
- [ ] [Delete Operation for Two Strings](https://leetcode.com/problems/delete-operation-for-two-strings/) — Medium
- [ ] [Longest Palindromic Substring](https://leetcode.com/problems/longest-palindromic-substring/) — Medium
- [ ] [Longest Palindromic Subsequence](https://leetcode.com/problems/longest-palindromic-subsequence/) — Medium
- [ ] [Maximum Length of Repeated Subarray](https://leetcode.com/problems/maximum-length-of-repeated-subarray/) — Medium
- [ ] [Edit Distance](https://leetcode.com/problems/edit-distance/) — Medium
- [ ] [Interleaving String](https://leetcode.com/problems/interleaving-string/) — Medium
- [ ] [Regular Expression Matching](https://leetcode.com/problems/regular-expression-matching/) — Hard
- [ ] [Wildcard Matching](https://leetcode.com/problems/wildcard-matching/) — Hard
- [ ] [Shortest Common Supersequence](https://leetcode.com/problems/shortest-common-supersequence/) — Hard
- [ ] [Minimum Insertion Steps to Make a String Palindrome](https://leetcode.com/problems/minimum-insertion-steps-to-make-a-string-palindrome/) — Hard
- [ ] [Max Dot Product of Two Subsequences](https://leetcode.com/problems/max-dot-product-of-two-subsequences/) — Hard

##### DP on String
- [ ] [Minimum Substring Partition of Equal Character Frequency](https://leetcode.com/problems/minimum-substring-partition-of-equal-character-frequency/) — Medium
- [ ] [Apply Operations to Make Two Strings Equal](https://leetcode.com/problems/apply-operations-to-make-two-strings-equal/) — Medium
- [ ] [Minimum ASCII Delete Sum for Two Strings](https://leetcode.com/problems/minimum-ascii-delete-sum-for-two-strings/) — Medium
- [ ] [Word Break](https://leetcode.com/problems/word-break/) — Medium
- [ ] [Longest String Chain](https://leetcode.com/problems/longest-string-chain/) — Medium
- [ ] [Unique Substrings in Wraparound String](https://leetcode.com/problems/unique-substrings-in-wraparound-string/) — Medium
- [ ] [Longest Valid Parentheses](https://leetcode.com/problems/longest-valid-parentheses/) — Hard
- [ ] [Distinct Subsequences](https://leetcode.com/problems/distinct-subsequences/) — Hard
- [ ] [Word Break II](https://leetcode.com/problems/word-break-ii/) — Hard
- [ ] [Concatenated Words](https://leetcode.com/problems/concatenated-words/) — Hard
- [ ] [Count Different Palindromic Subsequences](https://leetcode.com/problems/count-different-palindromic-subsequences/) — Hard
- [ ] [Distinct Subsequences II](https://leetcode.com/problems/distinct-subsequences-ii/) — Hard
- [ ] [Longest Chunked Palindrome Decomposition](https://leetcode.com/problems/longest-chunked-palindrome-decomposition/) — Hard
- [ ] [String Compression II](https://leetcode.com/problems/string-compression-ii/) — Hard
- [ ] [Number of Ways to Form a Target String Given a Dictionary](https://leetcode.com/problems/number-of-ways-to-form-a-target-string-given-a-dictionary/) — Hard
- [ ] [Minimum Changes to Make K Semi-palindromes](https://leetcode.com/problems/minimum-changes-to-make-k-semi-palindromes/) — Hard

##### Cumulative Sum DP
- [ ] [Maximal Square](https://leetcode.com/problems/maximal-square/) — Medium
- [ ] [Range Sum Query 2D - Immutable](https://leetcode.com/problems/range-sum-query-2d-immutable/) — Medium
- [ ] [Largest Plus Sign](https://leetcode.com/problems/largest-plus-sign/) — Medium
- [ ] [Largest 1-Bordered Square](https://leetcode.com/problems/largest-1-bordered-square/) — Medium
- [ ] [Count Square Submatrices with All Ones](https://leetcode.com/problems/count-square-submatrices-with-all-ones/) — Medium
- [ ] [Matrix Block Sum](https://leetcode.com/problems/matrix-block-sum/) — Medium
- [ ] [Count Submatrices With All Ones](https://leetcode.com/problems/count-submatrices-with-all-ones/) — Medium
- [ ] [Ways to Make a Fair Array](https://leetcode.com/problems/ways-to-make-a-fair-array/) — Medium
- [ ] [Maximal Rectangle](https://leetcode.com/problems/maximal-rectangle/) — Hard
- [ ] [Max Sum of Rectangle No Larger Than K](https://leetcode.com/problems/max-sum-of-rectangle-no-larger-than-k/) — Hard
- [ ] [Super Washing Machines](https://leetcode.com/problems/super-washing-machines/) — Hard
- [ ] [Maximum Sum of 3 Non-Overlapping Subarrays](https://leetcode.com/problems/maximum-sum-of-3-non-overlapping-subarrays/) — Hard
- [ ] [Number of Submatrices That Sum to Target](https://leetcode.com/problems/number-of-submatrices-that-sum-to-target/) — Hard
- [ ] [Find the Count of Monotonic Pairs II](https://leetcode.com/problems/find-the-count-of-monotonic-pairs-ii/) — Hard
- [ ] [Get the Maximum Score](https://leetcode.com/problems/get-the-maximum-score/) — Hard

##### Matrix Chain Multiplication
- [ ] Matrix Chain Multiplication — Hard
- [ ] [Guess Number Higher or Lower II](https://leetcode.com/problems/guess-number-higher-or-lower-ii/) — Medium
- [ ] [Predict the Winner](https://leetcode.com/problems/predict-the-winner/) — Medium
- [ ] [Stone Game](https://leetcode.com/problems/stone-game/) — Medium
- [ ] [Burst Balloons](https://leetcode.com/problems/burst-balloons/) — Hard
- [ ] [Minimum Score Triangulation of Polygon](https://leetcode.com/problems/minimum-score-triangulation-of-polygon/) — Medium
- [ ] [Minimum Cost Tree From Leaf Values](https://leetcode.com/problems/minimum-cost-tree-from-leaf-values/) — Medium
- [ ] [Partition Array for Maximum Sum](https://leetcode.com/problems/partition-array-for-maximum-sum/) — Medium
- [ ] [Palindrome Partitioning II](https://leetcode.com/problems/palindrome-partitioning-ii/) — Hard
- [ ] [Stone Game VII](https://leetcode.com/problems/stone-game-vii/) — Medium
- [ ] [Remove Boxes](https://leetcode.com/problems/remove-boxes/) — Hard
- [ ] [Strange Printer](https://leetcode.com/problems/strange-printer/) — Hard
- [ ] [Valid Permutations for DI Sequence](https://leetcode.com/problems/valid-permutations-for-di-sequence/) — Hard
- [ ] [Minimum Cost to Merge Stones](https://leetcode.com/problems/minimum-cost-to-merge-stones/) — Hard
- [ ] [Allocate Mailboxes](https://leetcode.com/problems/allocate-mailboxes/) — Hard
- [ ] [Minimum Cost to Cut a Stick](https://leetcode.com/problems/minimum-cost-to-cut-a-stick/) — Hard
- [ ] [Stone Game V](https://leetcode.com/problems/stone-game-v/) — Hard
- [ ] [Palindrome Partitioning III](https://leetcode.com/problems/palindrome-partitioning-iii/) — Hard

##### Kadane Algorithm
- [ ] [Maximum Subarray](https://leetcode.com/problems/maximum-subarray/) — Medium
- [ ] [Maximum Product Subarray](https://leetcode.com/problems/maximum-product-subarray/) — Medium
- [ ] [Bitwise ORs of Subarrays](https://leetcode.com/problems/bitwise-ors-of-subarrays/) — Medium
- [ ] [Longest Turbulent Subarray](https://leetcode.com/problems/longest-turbulent-subarray/) — Medium
- [ ] [Maximum Subarray Sum with One Deletion](https://leetcode.com/problems/maximum-subarray-sum-with-one-deletion/) — Medium
- [ ] [K-Concatenation Maximum Sum](https://leetcode.com/problems/k-concatenation-maximum-sum/) — Medium
- [ ] [Length of Longest Fibonacci Subsequence](https://leetcode.com/problems/length-of-longest-fibonacci-subsequence/) — Medium

#### Graph Problems

##### DFS and BFS on Graphs
- [ ] DFS Traversal — Easy
- [ ] [Find if Path Exists in Graph](https://leetcode.com/problems/find-if-path-exists-in-graph/) — Easy
- [ ] [Keys and Rooms](https://leetcode.com/problems/keys-and-rooms/) — Medium
- [ ] [Number of Provinces](https://leetcode.com/problems/number-of-provinces/) — Medium
- [ ] [Count the Number of Complete Components](https://leetcode.com/problems/count-the-number-of-complete-components/) — Medium
- [ ] [Reorder Routes to Make All Paths Lead to the City Zero](https://leetcode.com/problems/reorder-routes-to-make-all-paths-lead-to-the-city-zero/) — Medium
- [ ] [Longest Cycle in a Graph](https://leetcode.com/problems/longest-cycle-in-a-graph/) — Hard
- [ ] BFS in Graph — Easy
- [ ] [Snakes and Ladders](https://leetcode.com/problems/snakes-and-ladders/) — Medium
- [ ] [Open the Lock](https://leetcode.com/problems/open-the-lock/) — Medium
- [ ] [Word Ladder](https://leetcode.com/problems/word-ladder/) — Hard
- [ ] [Count the Number of Houses at a Certain Distance I](https://leetcode.com/problems/count-the-number-of-houses-at-a-certain-distance-i/) — Medium
- [ ] [As Far from Land as Possible](https://leetcode.com/problems/as-far-from-land-as-possible/) — Medium
- [ ] [Minimum Operations to Convert Number](https://leetcode.com/problems/minimum-operations-to-convert-number/) — Medium
- [ ] [Minimum Score of a Path Between Two Cities](https://leetcode.com/problems/minimum-score-of-a-path-between-two-cities/) — Medium
- [ ] [Shortest Path with Alternating Colors](https://leetcode.com/problems/shortest-path-with-alternating-colors/) — Medium
- [ ] [Minimum Number of Operations to Make X and Y Equal](https://leetcode.com/problems/minimum-number-of-operations-to-make-x-and-y-equal/) — Medium
- [ ] [Shortest Path Visiting All Nodes](https://leetcode.com/problems/shortest-path-visiting-all-nodes/) — Hard
- [ ] [Jump Game III](https://leetcode.com/problems/jump-game-iii/) — Medium
- [ ] [Clone Graph](https://leetcode.com/problems/clone-graph/) — Medium
- [ ] [Last Day Where You Can Still Cross](https://leetcode.com/problems/last-day-where-you-can-still-cross/) — Hard
- [ ] [Sliding Puzzle](https://leetcode.com/problems/sliding-puzzle/) — Hard
- [ ] [Maximum Candies You Can Get from Boxes](https://leetcode.com/problems/maximum-candies-you-can-get-from-boxes/) — Hard
- [ ] [Shortest Path to Get All Keys](https://leetcode.com/problems/shortest-path-to-get-all-keys/) — Hard
- [ ] [Jump Game IV](https://leetcode.com/problems/jump-game-iv/) — Hard
- [ ] [Word Ladder II](https://leetcode.com/problems/word-ladder-ii/) — Hard
- [ ] [Escape the Spreading Fire](https://leetcode.com/problems/escape-the-spreading-fire/) — Hard

##### Cycle Detection
- [ ] Detect Cycle in an Undirected Graph — Medium
- [ ] Detect Cycle in a Directed Graph — Medium
- [ ] Check if a Graph Has a Cycle of Odd Length — Medium
- [ ] [Detect Cycles in 2D Grid](https://leetcode.com/problems/detect-cycles-in-2d-grid/) — Medium
- [ ] [Shortest Cycle in a Graph](https://leetcode.com/problems/shortest-cycle-in-a-graph/) — Hard
- [ ] [Is Graph Bipartite?](https://leetcode.com/problems/is-graph-bipartite/) — Medium
- [ ] [Possible Bipartition](https://leetcode.com/problems/possible-bipartition/) — Medium
- [ ] [Flower Planting With No Adjacent](https://leetcode.com/problems/flower-planting-with-no-adjacent/) — Medium
- [ ] [Divide Nodes into the Maximum Number of Groups](https://leetcode.com/problems/divide-nodes-into-the-maximum-number-of-groups/) — Hard

##### Topological Sort
- [ ] [Course Schedule](https://leetcode.com/problems/course-schedule/) — Medium
- [ ] [Course Schedule II](https://leetcode.com/problems/course-schedule-ii/) — Medium
- [ ] [Find Eventual Safe States](https://leetcode.com/problems/find-eventual-safe-states/) — Medium
- [ ] [Minimum Height Trees](https://leetcode.com/problems/minimum-height-trees/) — Medium
- [ ] [Loud and Rich](https://leetcode.com/problems/loud-and-rich/) — Medium
- [ ] [All Ancestors of a Node in a Directed Acyclic Graph](https://leetcode.com/problems/all-ancestors-of-a-node-in-a-directed-acyclic-graph/) — Medium
- [ ] [Find All Possible Recipes from Given Supplies](https://leetcode.com/problems/find-all-possible-recipes-from-given-supplies/) — Hard
- [ ] Alien Dictionary — Hard
- [ ] [Longest Increasing Path in a Matrix](https://leetcode.com/problems/longest-increasing-path-in-a-matrix/) — Hard
- [ ] [Cat and Mouse](https://leetcode.com/problems/cat-and-mouse/) — Hard
- [ ] [Sort Items by Groups Respecting Dependencies](https://leetcode.com/problems/sort-items-by-groups-respecting-dependencies/) — Hard
- [ ] [Largest Color Value in a Directed Graph](https://leetcode.com/problems/largest-color-value-in-a-directed-graph/) — Hard
- [ ] [Parallel Courses III](https://leetcode.com/problems/parallel-courses-iii/) — Hard
- [ ] [Parallel Courses II](https://leetcode.com/problems/parallel-courses-ii/) — Hard
- [ ] [Number of Increasing Paths in a Grid](https://leetcode.com/problems/number-of-increasing-paths-in-a-grid/) — Hard
- [ ] [Build a Matrix With Conditions](https://leetcode.com/problems/build-a-matrix-with-conditions/) — Hard

##### Flood Fill
- [ ] [Flood Fill](https://leetcode.com/problems/flood-fill/) — Easy
- [ ] [Island Perimeter](https://leetcode.com/problems/island-perimeter/) — Easy
- [ ] [Battleships in a Board](https://leetcode.com/problems/battleships-in-a-board/) — Medium
- [ ] [Number of Islands](https://leetcode.com/problems/number-of-islands/) — Medium
- [ ] [Max Area of Island](https://leetcode.com/problems/max-area-of-island/) — Medium
- [ ] [Count Sub Islands](https://leetcode.com/problems/count-sub-islands/) — Medium
- [ ] [Find All Groups of Farmland](https://leetcode.com/problems/find-all-groups-of-farmland/) — Medium

##### Multi Source BFS
- [ ] [Rotting Oranges](https://leetcode.com/problems/rotting-oranges/) — Medium
- [ ] [Number of Enclaves](https://leetcode.com/problems/number-of-enclaves/) — Medium
- [ ] [Map of Highest Peak](https://leetcode.com/problems/map-of-highest-peak/) — Medium
- [ ] [Surrounded Regions](https://leetcode.com/problems/surrounded-regions/) — Medium
- [ ] [Number of Closed Islands](https://leetcode.com/problems/number-of-closed-islands/) — Medium
- [ ] [01 Matrix](https://leetcode.com/problems/01-matrix/) — Medium
- [ ] [Shortest Bridge](https://leetcode.com/problems/shortest-bridge/) — Medium

##### Dijkstra Algorithm
- [ ] [Network Delay Time](https://leetcode.com/problems/network-delay-time/) — Medium
- [ ] [Cheapest Flights Within K Stops](https://leetcode.com/problems/cheapest-flights-within-k-stops/) — Medium
- [ ] [Number of Ways to Arrive at Destination](https://leetcode.com/problems/number-of-ways-to-arrive-at-destination/) — Medium
- [ ] [Path with Maximum Probability](https://leetcode.com/problems/path-with-maximum-probability/) — Medium
- [ ] [Path with Minimum Effort](https://leetcode.com/problems/path-with-minimum-effort/) — Medium
- [ ] [Number of Restricted Paths from First to Last Node](https://leetcode.com/problems/number-of-restricted-paths-from-first-to-last-node/) — Medium
- [ ] [Reachable Nodes in Subdivided Graph](https://leetcode.com/problems/reachable-nodes-in-subdivided-graph/) — Hard
- [ ] [Minimum Cost to Make at Least One Valid Path in a Grid](https://leetcode.com/problems/minimum-cost-to-make-at-least-one-valid-path-in-a-grid/) — Hard
- [ ] [Minimum Obstacle Removal to Reach Corner](https://leetcode.com/problems/minimum-obstacle-removal-to-reach-corner/) — Hard
- [ ] [Shortest Path in Binary Matrix](https://leetcode.com/problems/shortest-path-in-binary-matrix/) — Medium
- [ ] [Nearest Exit from Entrance in Maze](https://leetcode.com/problems/nearest-exit-from-entrance-in-maze/) — Medium
- [ ] [Second Minimum Time to Reach Destination](https://leetcode.com/problems/second-minimum-time-to-reach-destination/) — Hard

##### Bellman Ford
- [ ] [Bus Routes](https://leetcode.com/problems/bus-routes/) — Hard

##### Floyd Warshall
- [ ] [Course Schedule IV](https://leetcode.com/problems/course-schedule-iv/) — Medium
- [ ] [Find the City With the Smallest Number of Neighbors at a Threshold Distance](https://leetcode.com/problems/find-the-city-with-the-smallest-number-of-neighbors-at-a-threshold-distance/) — Medium
- [ ] [Count the Number of Houses at a Certain Distance I](https://leetcode.com/problems/count-the-number-of-houses-at-a-certain-distance-i/) — Medium
- [ ] [Minimum Cost to Convert String I](https://leetcode.com/problems/minimum-cost-to-convert-string-i/) — Medium
- [ ] [Design Graph With Shortest Path Calculator](https://leetcode.com/problems/design-graph-with-shortest-path-calculator/) — Hard
- [ ] [Number of Possible Sets of Closing Branches](https://leetcode.com/problems/number-of-possible-sets-of-closing-branches/) — Hard

##### Disjoint Set Union
- [ ] [Redundant Connection](https://leetcode.com/problems/redundant-connection/) — Medium
- [ ] [Satisfiability of Equality Equations](https://leetcode.com/problems/satisfiability-of-equality-equations/) — Medium
- [ ] [Smallest String With Swaps](https://leetcode.com/problems/smallest-string-with-swaps/) — Medium
- [ ] [Accounts Merge](https://leetcode.com/problems/accounts-merge/) — Medium
- [ ] [Most Stones Removed with Same Row or Column](https://leetcode.com/problems/most-stones-removed-with-same-row-or-column/) — Medium
- [ ] [Find Latest Group of Size M](https://leetcode.com/problems/find-latest-group-of-size-m/) — Medium
- [ ] [Redundant Connection II](https://leetcode.com/problems/redundant-connection-ii/) — Hard
- [ ] [Making a Large Island](https://leetcode.com/problems/making-a-large-island/) — Hard
- [ ] [GCD Sort of an Array](https://leetcode.com/problems/gcd-sort-of-an-array/) — Hard
- [ ] [Bricks Falling When Hit](https://leetcode.com/problems/bricks-falling-when-hit/) — Hard
- [ ] [Checking Existence of Edge Length Limited Paths](https://leetcode.com/problems/checking-existence-of-edge-length-limited-paths/) — Hard
- [ ] [Remove Max Number of Edges to Keep Graph Fully Traversable](https://leetcode.com/problems/remove-max-number-of-edges-to-keep-graph-fully-traversable/) — Hard
- [ ] [Rank Transform of a Matrix](https://leetcode.com/problems/rank-transform-of-a-matrix/) — Hard

##### Minimum Spanning Tree
- [ ] Prim's Minimum Spanning Tree (MST) — Theory
- [ ] Kruskal's Minimum Spanning Tree Algorithm — Theory
- [ ] Minimum Spanning Tree — Medium
- [ ] [Min Cost to Connect All Points](https://leetcode.com/problems/min-cost-to-connect-all-points/) — Hard
- [ ] Water Connection Problem — Hard
- [ ] Connecting Cities with Minimum Cost — Medium
- [ ] [Find Critical and Pseudo-Critical Edges in Minimum Spanning Tree](https://leetcode.com/problems/find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree/) — Hard
- [ ] [Remove Max Number of Edges to Keep Graph Fully Traversable](https://leetcode.com/problems/remove-max-number-of-edges-to-keep-graph-fully-traversable/) — Hard

##### Additional Graph Algorithms
- [ ] Articulation Points (or Cut Vertices) in a Graph — Theory
- [ ] Strongly Connected Components — Theory
- [ ] [Critical Connections in a Network](https://leetcode.com/problems/critical-connections-in-a-network/) — Medium

#### Combinatorics and Geometry Problems

##### Line
- [ ] [Check if it is a Straight Line](https://leetcode.com/problems/check-if-it-is-a-straight-line/) — Easy
- [ ] [Minimum Lines to Represent a Line Chart](https://leetcode.com/problems/minimum-lines-to-represent-a-line-chart/) — Medium
- [ ] [K Closest Points to Origin](https://leetcode.com/problems/k-closest-points-to-origin/) — Medium
- [ ] [Check If Two Line Segments Intersect](https://leetcode.com/problems/check-if-two-line-segments-intersect/) — Medium
- [ ] [Max Points on a Line](https://leetcode.com/problems/max-points-on-a-line/) — Hard
- [ ] [Minimize Manhattan Distances](https://leetcode.com/problems/minimize-manhattan-distances/) — Hard
- [ ] [Self Crossing](https://leetcode.com/problems/self-crossing/) — Hard

##### Rectangle
- [ ] [Rectangle Overlap](https://leetcode.com/problems/rectangle-overlap/) — Easy
- [ ] [Largest Triangle Area](https://leetcode.com/problems/largest-triangle-area/) — Easy
- [ ] [Minimum Rectangles to Cover Points](https://leetcode.com/problems/minimum-rectangles-to-cover-points/) — Medium
- [ ] [Rectangle Area](https://leetcode.com/problems/rectangle-area/) — Medium
- [ ] [Minimum Area Rectangle](https://leetcode.com/problems/minimum-area-rectangle/) — Medium
- [ ] [Minimum Area Rectangle II](https://leetcode.com/problems/minimum-area-rectangle-ii/) — Medium
- [ ] [Mirror Reflection](https://leetcode.com/problems/mirror-reflection/) — Medium
- [ ] [Find the Largest Area of Square Inside Two Rectangles](https://leetcode.com/problems/find-the-largest-area-of-square-inside-two-rectangles/) — Medium

##### Circle
- [ ] [Minimum Cuts to Divide a Circle](https://leetcode.com/problems/minimum-cuts-to-divide-a-circle/) — Medium
- [ ] [Generate Random Point in a Circle](https://leetcode.com/problems/generate-random-point-in-a-circle/) — Medium
- [ ] [Circle and Rectangle Overlapping](https://leetcode.com/problems/circle-and-rectangle-overlapping/) — Medium
- [ ] [Count Lattice Points Inside a Circle](https://leetcode.com/problems/count-lattice-points-inside-a-circle/) — Medium

#### Advanced Algorithm Problems

##### Fenwick Tree
- [ ] [Alternating Groups III](https://leetcode.com/problems/alternating-groups-iii/) — Medium
- [ ] [Number of Pairs Satisfying Inequality](https://leetcode.com/problems/number-of-pairs-satisfying-inequality/) — Hard
- [ ] [Count Good Triplets in an Array](https://leetcode.com/problems/count-good-triplets-in-an-array/) — Hard
- [ ] [Booking Concert Tickets in Groups](https://leetcode.com/problems/booking-concert-tickets-in-groups/) — Hard

##### Segment Tree
- [ ] [Longest Uploaded Prefix](https://leetcode.com/problems/longest-uploaded-prefix/) — Medium
- [ ] [Range Sum Query - Mutable](https://leetcode.com/problems/range-sum-query-mutable/) — Medium
- [ ] [Falling Squares](https://leetcode.com/problems/falling-squares/) — Hard
- [ ] [Range Module](https://leetcode.com/problems/range-module/) — Hard
- [ ] [Count of Range Sum](https://leetcode.com/problems/count-of-range-sum/) — Hard
- [ ] [Longest Substring of One Repeating Character](https://leetcode.com/problems/longest-substring-of-one-repeating-character/) — Hard
- [ ] [Maximum Sum Queries](https://leetcode.com/problems/maximum-sum-queries/) — Hard
- [ ] [Handling Sum Queries After Update](https://leetcode.com/problems/handling-sum-queries-after-update/) — Hard
- [ ] [Peaks in Array](https://leetcode.com/problems/peaks-in-array/) — Hard
- [ ] [Maximum Sum of Subsequence With Non-Adjacent Elements](https://leetcode.com/problems/maximum-sum-of-subsequence-with-non-adjacent-elements/) — Hard
- [ ] [Block Placement Queries](https://leetcode.com/problems/block-placement-queries/) — Hard

##### Sparse Table
- [ ] Range Minimum Query — Hard
- [ ] Catapult that ball — Hard
- [ ] Miraculous — Hard
- [ ] Negative Score — Hard
- [ ] DIFERENCIJA — Hard
- [ ] [Find a Value of a Mysterious Function Closest to Target](https://leetcode.com/problems/find-a-value-of-a-mysterious-function-closest-to-target/) — Hard
- [ ] [Maximum Binary Tree](https://leetcode.com/problems/maximum-binary-tree/) — Hard
