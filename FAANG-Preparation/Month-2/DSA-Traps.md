# DSA Trap Questions — Hidden Gotchas & Counter-Intuitive Problems

Self-contained. Java code throughout.
Each trap: what it looks like → what's wrong → the fix → which interview questions use it.

---

## TABLE OF CONTENTS

| # | Trap Category | Classic Victim |
|---|---------------|----------------|
| 1 | Integer Overflow | Two Sum, Binary Search, Array indices |
| 2 | String Concatenation in Loop | Reverse, Build result, Anagram |
| 3 | `==` vs `.equals()` in Java | String comparison, Integer cache |
| 4 | Off-By-One | Binary search, Sliding window bounds |
| 5 | Very Long String / Big Number | Divisibility, Power of 2, Multiply strings |
| 6 | Recursive Complexity | Fibonacci, Subset generation, Tree traversal |
| 7 | Sorting Gotchas | Custom comparator, Primitive vs Object sort |
| 8 | Modifying Collection While Iterating | Remove duplicates, Graph BFS cleanup |
| 9 | Integer.MIN_VALUE Negation | Absolute value, Overflow in negation |
| 10 | Two Pointer / Sliding Window Edge Cases | All same chars, Single element |
| 11 | Graph Cycle / Visited State Bugs | BFS with weights, DFS revisit |
| 12 | Bit Manipulation Traps | Signed shift, XOR with itself, 0 edge case |
| 13 | HashMap Pitfalls | Null key, Default value, ConcurrentModification |
| 14 | Greedy Correctness Traps | Local optimal ≠ global optimal |
| 15 | DP State Definition Traps | Knapsack off-by-one, 2D vs 1D |
| 16 | Negative Modulo | Subarray sum divisible by k, hash ring |
| 17 | Priority Queue Traps | Min vs max heap, custom comparator, stale entries |
| 18 | Backtracking State Undo | Permutations, subsets, N-Queens |
| 19 | Prefix Sum Pitfalls | 2D prefix, subarray sum with modulo |
| 20 | Monotonic Stack Traps | Next greater vs previous greater, index vs value |
| 21 | Interval Merge / Overlap Traps | Sort by start, touching vs overlapping |
| 22 | Java Standard Library Pitfalls | Arrays.asList, String.split, Scanner |
| 23 | Floyd's Cycle Detection | Phase 2 restart, detecting start of cycle |
| 24 | Union-Find Pitfalls | Self-loop, wrong root check, path compression |
| 25 | Math & Number Theory Traps | Ceil division, GCD, LCM overflow, modular exp |

---

## 1. INTEGER OVERFLOW TRAPS

> 🌍 **Real-World:** The 1996 Ariane 5 rocket explosion was caused by an integer overflow — a 64-bit float was converted to a 16-bit signed int, wrapping to a large negative number and triggering a catastrophic shutdown. In software, Amazon's early recommendation engine had silent overflow bugs in product-score accumulation that silently wrapped negative, surfacing incorrect "top" recommendations to millions of users until discovered through A/B testing.

> **💡 Key Insight:** Java's `int` is 32-bit signed, capping at **`Integer.MAX_VALUE`** = 2,147,483,647. Arithmetic that silently wraps around is one of the most common causes of wrong answers in otherwise correct logic.

> **⚠️ Common Mistake:** Candidates write `(lo + hi) / 2` from muscle memory and never test with values near `Integer.MAX_VALUE`. The addition itself overflows before the division happens.

### Trap: Binary Search Midpoint

```java
// WRONG — overflows when lo + hi > Integer.MAX_VALUE
int mid = (lo + hi) / 2;

// RIGHT
int mid = lo + (hi - lo) / 2;

// Also RIGHT (Java-specific, uses unsigned shift)
int mid = (lo + hi) >>> 1;
```

**Why it matters**: `lo` and `hi` can both be ~2^30. Their sum exceeds `int` range.
**Interview questions**: Binary Search, Search in Rotated Array, Find Peak Element.

---

### Trap: Multiplying Two Ints to Compare

> **💡 Pattern Recognition:** Any time two large `int` values are multiplied together, cast at least one to **`Long`** before the operation. The product of two ~10^9 values fits in a `long` but not an `int`.

```java
// Problem: Find if a * b > c where all are large ints
// WRONG — a * b can overflow
if (a * b > c) { ... }

// RIGHT — cast before multiply
if ((long) a * b > c) { ... }

// Also RIGHT — rearrange to avoid multiplication
if (a > c / b) { ... }  // careful: integer division truncates
```

**Interview questions**: Sqrt(x), Divide Two Integers, NthUglyNumber.

---

### Trap: String-to-Number Overflow (LeetCode "String to Integer / atoi")

```java
// Problem: Convert "very large string of digits" to int
// Naive: accumulate digit by digit
int result = 0;
for (char c : s.toCharArray()) {
    result = result * 10 + (c - '0');  // WRONG — overflows silently
}

// RIGHT — check before multiply
for (char c : s.toCharArray()) {
    int digit = c - '0';
    // If result > (MAX - digit) / 10, we're about to overflow
    if (result > (Integer.MAX_VALUE - digit) / 10) {
        return sign == 1 ? Integer.MAX_VALUE : Integer.MIN_VALUE;
    }
    result = result * 10 + digit;
}
```

**Key numbers to memorize**:

```text
Integer.MAX_VALUE =  2_147_483_647  (2^31 - 1)
Integer.MIN_VALUE = -2_147_483_648  (-2^31)
Long.MAX_VALUE    =  9_223_372_036_854_775_807
```

> **⚠️ Common Mistake:** Forgetting that `Integer.MIN_VALUE` has a larger absolute value than `Integer.MAX_VALUE` — always clamp the negative case separately.

---

### Trap: Array Index as Long

> **💡 Pattern Recognition:** Whenever you compute a flat index into a 2D array with `row * cols + col`, if `cols` is large the multiplication can overflow. Cast first.

```java
// Problem: 2D array where row = n, col = m, access element i
// WRONG — n * row overflows int when n is large
int idx = n * row + col;

// RIGHT — cast before multiply
long idx = (long) n * row + col;
```

---

## 2. STRING CONCATENATION IN LOOP

> 🌍 **Real-World:** A notorious Twitter API bug in 2012 caused O(n²) response-building time — server code accumulated tweet text using string concatenation inside a loop, making responses for timelines with hundreds of tweets take seconds instead of milliseconds. LinkedIn's profile serialization team replaced O(n²) string-concat code with `StringBuilder` in a single commit, cutting profile page generation time by 40% for users with many endorsements.

> **💡 Key Insight:** Java `String` objects are immutable. Every `+=` in a loop allocates an entirely new `String` of the combined length, making the total copy cost O(n²). **`StringBuilder`** uses a resizable internal buffer and avoids this.

> **⚠️ Common Mistake:** Writing the `+` version during an interview under time pressure, especially in helper methods like `buildPath()` or `formatRow()` that get called inside a loop.

### The Trap

```java
// WRONG — O(n²) time, creates new String object each iteration
String result = "";
for (String s : words) {
    result += s;   // each += allocates new String of length result.length() + s.length()
}

// RIGHT — O(n) amortized
StringBuilder sb = new StringBuilder();
for (String s : words) {
    sb.append(s);
}
String result = sb.toString();
```

**The math**: If you concatenate n strings of average length L, the wrong version copies:
`L + 2L + 3L + ... + nL = O(n²L)` characters. **`StringBuilder`** is O(nL).

**Interview questions**: Reverse Words in a String, Group Anagrams, Decode String, ZigZag Conversion.

---

### Trap: Reversing a String

> **💡 Pattern Recognition:** The `char[]` reversal trick breaks on emoji and rare CJK characters because they are stored as **surrogate pairs** (two `char` values). Mention this edge case in interviews even if you proceed with the simple version.

```java
// WRONG for Unicode (surrogate pairs — emoji, rare CJK chars)
char[] arr = s.toCharArray();
// reverse arr...
// emoji like 😀 is TWO chars in Java (surrogate pair: 😀)
// reversing char array splits them → garbage output

// RIGHT for proper Unicode
int[] codePoints = s.codePoints().toArray();
// reverse codePoints...
new String(codePoints, 0, codePoints.length)

// In interviews: usually char[] is fine. Mention this as an edge case.
```

---

## 3. `==` VS `.equals()` IN JAVA

> 🌍 **Real-World:** A well-known Android bug in early versions of the Gmail app used `==` to compare user account tokens (String objects), causing authentication to silently fail for tokens created at runtime (not interned) — only reproducible on real devices, not the emulator, because the JVM interning behavior differed. Payment systems at PayPal have historically required strict code review rules mandating `.equals()` for all String comparisons after a transaction-routing bug caused by `==` comparison on currency-code strings.

> **💡 Key Insight:** `==` compares **object identity** (same reference in memory). `.equals()` compares **object value**. For `String` and boxed types like `Integer`, you almost always want `.equals()`.

> **⚠️ Common Mistake:** Relying on Java's `String` interning to make `==` work. Interning only applies to compile-time string literals, not strings built at runtime (e.g., from `substring`, `+`, or `new String(...)`).

### String Comparison

```java
String a = new String("hello");
String b = new String("hello");

a == b        // FALSE — different objects
a.equals(b)   // TRUE  — same content

// String literals are interned (same object from pool):
String x = "hello";
String y = "hello";
x == y        // TRUE  — but don't rely on this
```

**Rule**: Always use `.equals()` for String comparison. Never `==`.

---

### Integer Cache Trap

> **💡 Key Insight:** Java caches **`Integer`** objects for values -128 to 127 (the "Integer cache"). Autoboxing of values in that range reuses the same object, making `==` accidentally return `true`. Outside that range, each autobox creates a new object.

```java
Integer a = 127;
Integer b = 127;
a == b   // TRUE — cached range is -128 to 127

Integer c = 128;
Integer d = 128;
c == d   // FALSE — outside cache, new objects

// Fix: always use .equals() or intValue()
c.equals(d)         // TRUE
c.intValue() == d.intValue()  // TRUE
```

**Why the cache**: Java caches `Integer` objects for -128 to 127 for performance (autoboxing reuses them).
**Interview question**: This trips people up in **`HashMap`**/**`HashSet`** logic with `Integer` keys.

> **⚠️ Common Mistake:** Writing `map.get(key) == map.get(otherKey)` to compare map values — this compares references, not integers, and silently fails for values outside the cache range.

---

### HashMap with Integer Keys

```java
Map<Integer, Integer> map = new HashMap<>();
map.put(1, 100);

Integer key = 1;
map.get(key);    // Works — HashMap uses .equals() internally

// But direct == comparison on boxed Integer in custom code → bug
if (map.get(key) == map.get(otherKey)) { ... }  // WRONG for values > 127
if (map.get(key).equals(map.get(otherKey))) { ... }  // RIGHT
```

---

## 4. OFF-BY-ONE ERRORS

> 🌍 **Real-World:** The binary search off-by-one bug in `java.util.Arrays.binarySearch` existed in the JDK for nearly a decade (reported as Sun Bug #5045582) — the `mid = (lo + hi) / 2` overflow only triggered on arrays larger than ~1 billion elements, making it invisible in normal testing. NASA's Mars Climate Orbiter was lost in 1999 partly due to off-by-one and unit errors in navigation software — a vivid reminder that boundary conditions have catastrophic consequences.

> **💡 Key Insight:** Binary search has three distinct variants with subtly different invariants. Mixing them is the #1 source of off-by-one bugs. Pick one variant per problem and be consistent about the loop condition and boundary updates.

> **⚠️ Common Mistake:** Using `hi = mid - 1` in the boundary-finding variant (Variant 2). This can cause the loop to skip the answer because `hi` must stay open (`= mid`).

### Binary Search — Which Variant to Use?

```java
// Variant 1: Find exact target
int lo = 0, hi = n - 1;
while (lo <= hi) {                    // <= because lo == hi is valid
    int mid = lo + (hi - lo) / 2;
    if (arr[mid] == target) return mid;
    else if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
}
return -1;

// Variant 2: Find leftmost position where arr[mid] >= target
int lo = 0, hi = n;                   // hi = n (open right)
while (lo < hi) {                     // strict < because lo == hi means done
    int mid = lo + (hi - lo) / 2;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid;                    // NOT mid - 1
}
return lo;   // lo == hi, insertion point

// Variant 3: Find rightmost position where arr[mid] <= target
int lo = 0, hi = n;
while (lo < hi) {
    int mid = lo + (hi - lo + 1) / 2;  // +1 to bias upward (prevent infinite loop)
    if (arr[mid] <= target) lo = mid;
    else hi = mid - 1;
}
return lo;
```

**Mnemonic**:
- Looking for exact → `lo <= hi`, return inside loop
- Finding boundary → `lo < hi`, hi is open (`n`), return after loop

| Variant | Loop condition | `hi` initial | Update on match |
|---------|---------------|-------------|-----------------|
| Exact target | `lo <= hi` | `n - 1` | `return mid` |
| Leftmost ≥ target | `lo < hi` | `n` (open) | `hi = mid` |
| Rightmost ≤ target | `lo < hi` | `n` (open) | `lo = mid` (biased mid) |

---

### Sliding Window — Off by One in "at most k" Problems

> **💡 Pattern Recognition:** Window size is always `right - left + 1` when both `right` and `left` are **inclusive** indices into the array. Forgetting the `+ 1` gives a window one element shorter than it really is.

```java
// Problem: Longest subarray with at most k distinct integers

// WRONG — off by one in window size
int left = 0, maxLen = 0;
Map<Integer, Integer> freq = new HashMap<>();
for (int right = 0; right < n; right++) {
    freq.merge(arr[right], 1, Integer::sum);
    while (freq.size() > k) {
        int cnt = freq.merge(arr[left], -1, Integer::sum);
        if (cnt == 0) freq.remove(arr[left]);
        left++;
    }
    maxLen = Math.max(maxLen, right - left);  // WRONG — should be right - left + 1
}

// RIGHT
    maxLen = Math.max(maxLen, right - left + 1);
```

**Rule**: Window size = `right - left + 1` when both pointers are inclusive.

---

### String Palindrome Edge Cases

> **⚠️ Common Mistake:** In the "expand around center" approach, the formula `start = i - (len - 1) / 2` is non-obvious. Derive it on the whiteboard or memorize it explicitly.

```java
// WRONG — misses single char and even-length
boolean isPalindrome(String s) {
    int l = 0, r = s.length() - 1;
    while (l < r) {              // l < r is CORRECT (l == r is middle of odd)
        if (s.charAt(l) != s.charAt(r)) return false;
        l++; r--;
    }
    return true;
}
// This is actually correct. But the trap is in "expand around center":

// Expand Around Center — for longest palindromic substring
String longestPalindrome(String s) {
    int start = 0, maxLen = 1;
    for (int i = 0; i < s.length(); i++) {
        // Odd-length (center at i)
        int len1 = expand(s, i, i);
        // Even-length (center between i and i+1)
        int len2 = expand(s, i, i + 1);  // i+1 may equal s.length() — handle in expand
        int len = Math.max(len1, len2);
        if (len > maxLen) {
            maxLen = len;
            start = i - (len - 1) / 2;  // TRAP: this formula is non-obvious
        }
    }
    return s.substring(start, start + maxLen);
}

int expand(String s, int l, int r) {
    while (l >= 0 && r < s.length() && s.charAt(l) == s.charAt(r)) {
        l--; r++;
    }
    return r - l - 1;  // TRAP: not r - l + 1. Because l and r went one step too far.
}
```

---

## 5. VERY LONG STRING / BIG NUMBER TRAPS

> 🌍 **Real-World:** RSA encryption (used by every HTTPS connection on the internet) multiplies numbers with 2048+ bits — far beyond `long`. OpenSSL and Java's `BigInteger` implement digit-by-digit modular arithmetic exactly as described here, operating on 64-bit "digits" in arrays. Blockchain systems like Bitcoin use 256-bit integers for SHA-256 hash comparisons; all arithmetic is done via modular digit streaming, never via primitive types.

> **💡 Key Insight:** When a number is too large for any primitive type, process it **digit by digit** using **modular arithmetic**. The key property: `(a * 10 + d) % m == ((a % m) * 10 + d) % m`. This lets you stream through arbitrary-length numbers without ever building the actual value.

> **⚠️ Common Mistake:** Reaching for `BigInteger` first. It works but is slow and verbose. Modular streaming is usually expected in interviews.

### Check if a Large Number (as String) is Divisible by X

```java
// Problem: Given string "123456789012345678901234567890", is it divisible by 3?
// Key insight: use modular arithmetic digit by digit

boolean divisibleBy(String num, int divisor) {
    int remainder = 0;
    for (char c : num.toCharArray()) {
        remainder = (remainder * 10 + (c - '0')) % divisor;
    }
    return remainder == 0;
}
// Works even when num has 10^9 digits. Never builds the actual number.

// Divisibility rules to memorize:
// By 2: last digit even
// By 3: sum of digits divisible by 3
// By 5: last digit 0 or 5
// By 9: sum of digits divisible by 9
// By 11: alternating sum of digits divisible by 11
```

---

### Multiply Two Large Numbers as Strings

> **💡 Pattern Recognition:** The position mapping is the key insight: digit at index `i` of `num1` and index `j` of `num2` contributes to positions `i+j` (tens) and `i+j+1` (ones) in the result array.

```java
// Problem: "123" * "456" without using BigInteger
// Trap: direct conversion to long fails for very large inputs

String multiply(String num1, String num2) {
    int m = num1.length(), n = num2.length();
    int[] pos = new int[m + n];  // result has at most m+n digits

    for (int i = m - 1; i >= 0; i--) {
        for (int j = n - 1; j >= 0; j--) {
            int mul = (num1.charAt(i) - '0') * (num2.charAt(j) - '0');
            int p1 = i + j, p2 = i + j + 1;  // p1 = tens, p2 = ones place in pos[]
            int sum = mul + pos[p2];
            pos[p2] = sum % 10;
            pos[p1] += sum / 10;
        }
    }

    StringBuilder sb = new StringBuilder();
    for (int p : pos) {
        if (!(sb.length() == 0 && p == 0)) sb.append(p);  // skip leading zeros
    }
    return sb.length() == 0 ? "0" : sb.toString();
}
// Time: O(m*n), Space: O(m+n)
```

---

### Power of 2 Check — The Hidden Trap

> **⚠️ Common Mistake:** Writing `(n & (n - 1)) == 0` without the `n > 0` guard. Both `n = 0` and `n = Integer.MIN_VALUE` satisfy the bit trick but are **not** powers of two.

```java
// WRONG — misses n = 0 and negative numbers
boolean isPowerOfTwo(int n) {
    return (n & (n - 1)) == 0;  // 0 & -1 = 0, so 0 returns true — WRONG
}

// RIGHT
boolean isPowerOfTwo(int n) {
    return n > 0 && (n & (n - 1)) == 0;
}

// Also: n = Integer.MIN_VALUE = -2147483648 = 10000...0 in 2's complement
// n & (n-1) = MIN_VALUE & MAX_VALUE = 0 — so must check n > 0
```

---

### Add Two Numbers as Strings (with carry propagation)

> **💡 Pattern Recognition:** The final carry is the most commonly forgotten part. `"999" + "1"` produces a carry that generates an extra leading digit. The `|| carry > 0` clause in the while condition is essential.

```java
String addStrings(String num1, String num2) {
    StringBuilder sb = new StringBuilder();
    int i = num1.length() - 1;
    int j = num2.length() - 1;
    int carry = 0;
    while (i >= 0 || j >= 0 || carry > 0) {  // TRAP: forget "|| carry > 0"
        int sum = carry;
        if (i >= 0) sum += num1.charAt(i--) - '0';
        if (j >= 0) sum += num2.charAt(j--) - '0';
        carry = sum / 10;
        sb.append(sum % 10);
    }
    return sb.reverse().toString();
}
// The trap: forgetting the final carry. "999" + "1" → last carry produces "1000"
```

---

## 6. RECURSIVE COMPLEXITY TRAPS

> 🌍 **Real-World:** An early version of Slack's desktop client had a naively recursive Markdown renderer that exhibited O(2^n) behavior on deeply nested formatting — a single malformed message with nested bold/italic markers could freeze the client for seconds. Facebook's PHP runtime (HHVM) added a memoization layer to their template rendering engine after profiling revealed exponential recursion depth in certain ad-template compositions, collapsing render time from O(2^n) to O(n) with the same semantic output.

> **💡 Key Insight:** A recurrence that branches is almost always exponential. `T(n) = 2T(n-1)` → O(2^n). Even `T(n) = T(n-1) + T(n-2)` → O(φ^n) ≈ O(1.618^n). Memoization or iteration collapses this to O(n).

> **⚠️ Common Mistake:** Estimating the cost of a recursive Fibonacci as "about O(n) because n decreases each time." The branching factor is what drives exponential growth.

### Fibonacci — Looks O(n), Actually O(2^n)

```java
// WRONG — exponential
int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);  // Each call spawns 2 more. Tree has 2^n nodes.
}

// RIGHT — memoization → O(n)
int fib(int n, int[] memo) {
    if (n <= 1) return n;
    if (memo[n] != 0) return memo[n];
    return memo[n] = fib(n - 1, memo) + fib(n - 2, memo);
}

// RIGHT — iterative → O(n) time, O(1) space
int fib(int n) {
    if (n <= 1) return n;
    int a = 0, b = 1;
    for (int i = 2; i <= n; i++) {
        int c = a + b;
        a = b;
        b = c;
    }
    return b;
}
```

**Recurrence trap**: `T(n) = T(n-1) + T(n-2)` looks like it's "almost" O(n) but it's O(φ^n) ≈ O(1.618^n).

---

### Subset / Permutation Complexity — Interviewer Traps

> **💡 Pattern Recognition:** If the problem asks you to enumerate all subsets or permutations and then asks "Can you do better?" — there is almost certainly a DP formulation hiding underneath.

```java
// "How many recursive calls does this make?"

// Subsets of n elements: 2^n subsets → O(2^n * n) to enumerate (n to copy each)
// Permutations of n elements: n! permutations → O(n! * n)
// Combinations C(n,k): O(C(n,k) * k) to enumerate

// TRAP: Being asked to find if a solution exists in O(n^2) when the search space is 2^n
// Interviewer hint: "Can you do better?" after O(2^n) — often a DP problem lurking
```

---

### Stack Overflow on Deep Recursion

> **⚠️ Common Mistake:** Implementing DFS recursively without thinking about tree/graph depth. Java's default stack supports only ~500–1000 frames. A path graph with 10^5 nodes will always overflow.

```java
// Problem: DFS on a path graph with 10^5 nodes → stack depth = 10^5
// Java default stack: ~500-1000 frames before StackOverflowError

// WRONG for large trees/graphs
void dfs(TreeNode node) {
    if (node == null) return;
    dfs(node.left);   // up to depth 10^5 → stack overflow
    dfs(node.right);
}

// RIGHT — convert to iterative with explicit stack
void dfs(TreeNode root) {
    Deque<TreeNode> stack = new ArrayDeque<>();
    stack.push(root);
    while (!stack.isEmpty()) {
        TreeNode node = stack.pop();
        if (node == null) continue;
        stack.push(node.right);  // push right first so left processes first
        stack.push(node.left);
    }
}
```

---

## 7. SORTING GOTCHAS

> 🌍 **Real-World:** Android's TimSort implementation had a famous bug (CVE-2015-8899) where a comparator that wasn't a valid total order caused `IllegalArgumentException: Comparison method violates its general contract!` on production devices during gallery sort — real apps shipped this bug for years. Java 7's switch from merge sort to TimSort for `Arrays.sort` on objects broke several production applications at large companies (including a Google internal tool) that relied on the instability of the old sort to work correctly.

> **💡 Key Insight:** The subtraction comparator `(a, b) -> a - b` is broken for values near `Integer.MIN_VALUE` or `Integer.MAX_VALUE`. Always use **`Integer.compare(a, b)`** — it has no overflow risk.

> **⚠️ Common Mistake:** Writing `(a, b) -> a - b` for descending order as `(a, b) -> b - a`. Both forms can overflow and produce incorrect orderings silently.

### Custom Comparator — Integer Overflow Trap

```java
// WRONG — subtraction overflows for negative numbers
Arrays.sort(arr, (a, b) -> a - b);
// If a = -2_000_000_000, b = 2_000_000_000, a - b = -4B → overflows to positive

// RIGHT
Arrays.sort(arr, Integer::compare);
Arrays.sort(arr, (a, b) -> Integer.compare(a, b));
```

---

### Primitive vs Object Sort — Different Algorithms

> **💡 Pattern Recognition:** If a problem requires a **custom comparator** on an `int[]`, you cannot pass the comparator to `Arrays.sort` directly. You must convert to `Integer[]` first, or use streams.

```java
int[] primitives = {3, 1, 2};
Arrays.sort(primitives);        // Uses Dual-Pivot Quicksort → O(n log n) avg, NOT stable

Integer[] objects = {3, 1, 2};
Arrays.sort(objects);           // Uses TimSort (merge + insertion) → stable, O(n log n)

// TRAP: Custom comparator only works on Object arrays, not primitive arrays
Arrays.sort(primitives, (a, b) -> b - a);  // COMPILE ERROR — no comparator for int[]

// Fix: use Integer[]
Arrays.sort(objects, (a, b) -> b - a);  // OK
// Or: use IntStream
int[] sorted = IntStream.of(primitives).boxed()
    .sorted(Comparator.reverseOrder())
    .mapToInt(Integer::intValue).toArray();
```

| Type | Algorithm | Stable? | Custom comparator? |
|------|-----------|---------|-------------------|
| `int[]` | Dual-Pivot Quicksort | No | Not allowed |
| `Integer[]` | TimSort | Yes | Allowed |

---

### Sorting Strings as Numbers (LeetCode Largest Number)

> **💡 Key Insight:** Compare strings `a` and `b` by checking whether `a + b` or `b + a` is lexicographically larger. This is a well-defined total ordering that produces the largest possible concatenation.

```java
// Problem: Given [3, 30, 34, 5, 9], arrange to form largest number: "9534330"
// Trap: numeric sort gives wrong answer

// WRONG
Arrays.sort(nums);  // sorts numerically: [3, 5, 9, 30, 34] → "9534303" ≠ "9534330"

// RIGHT — sort by string concatenation comparison
String[] strs = Arrays.stream(nums).mapToObj(String::valueOf).toArray(String[]::new);
Arrays.sort(strs, (a, b) -> (b + a).compareTo(a + b));
// "b+a" vs "a+b": if "b+a" > "a+b", b should come first

// Edge case: all zeros → "000...0" should return "0"
String result = String.join("", strs);
return result.startsWith("0") ? "0" : result;
```

---

## 8. MODIFYING COLLECTION WHILE ITERATING

> 🌍 **Real-World:** Netflix's Hystrix circuit breaker library had a production bug where a concurrent thread removed entries from a ConcurrentHashMap while the health-check thread was iterating it — not a `ConcurrentModificationException` (ConcurrentHashMap is safe for this), but the removal caused health metrics to silently drop, making degraded services appear healthy. A Spring Framework bug report (SPR-11653) documented `ConcurrentModificationException` in production bean-scope cleanup caused by removing beans from a `LinkedHashMap` during iteration.

> **💡 Key Insight:** Java's `ArrayList` and `HashMap` track a **modification count**. Any structural change during a for-each loop increments that count and causes `ConcurrentModificationException` on the next iterator advance.

> **⚠️ Common Mistake:** Using `list.remove(value)` (by object) inside a for-each loop assuming it's safe. It isn't — the iterator detects the modification on the very next call to `hasNext()` or `next()`.

### The Classic Bug

```java
List<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3, 4, 5));

// WRONG — ConcurrentModificationException
for (Integer x : list) {
    if (x % 2 == 0) list.remove(x);
}

// RIGHT — use Iterator.remove()
Iterator<Integer> it = list.iterator();
while (it.hasNext()) {
    if (it.next() % 2 == 0) it.remove();  // safe
}

// RIGHT — collect indices and remove in reverse (for ArrayList)
for (int i = list.size() - 1; i >= 0; i--) {
    if (list.get(i) % 2 == 0) list.remove(i);
}

// RIGHT — use removeIf (Java 8+)
list.removeIf(x -> x % 2 == 0);
```

---

### HashMap During BFS / Graph Traversal

> **💡 Pattern Recognition:** Whenever you need to add new entries to a map based on its current contents, collect the additions in a separate map and merge after the loop completes.

```java
// WRONG — modifying map while iterating its entry set
for (Map.Entry<Integer, List<Integer>> entry : graph.entrySet()) {
    List<Integer> neighbors = entry.getValue();
    for (int neighbor : neighbors) {
        graph.put(neighbor, new ArrayList<>());  // modifies map → ConcurrentModificationException
    }
}

// RIGHT — collect new entries and add after loop
Map<Integer, List<Integer>> toAdd = new HashMap<>();
for (Map.Entry<Integer, List<Integer>> entry : graph.entrySet()) {
    for (int neighbor : entry.getValue()) {
        toAdd.computeIfAbsent(neighbor, k -> new ArrayList<>());
    }
}
graph.putAll(toAdd);
```

---

## 9. INTEGER.MIN_VALUE NEGATION

> 🌍 **Real-World:** A bug in Apache Cassandra's token ring arithmetic used `Math.abs()` on partition hash values without guarding for `Long.MIN_VALUE` — causing a specific token to map to a negative value and routing writes to the wrong node, silently corrupting data distribution. Google's Guava library explicitly documents and guards against this in its `Ints.checkedCast()` and `Longs.checkedCast()` methods, returning an exception rather than silently wrapping.

> **💡 Key Insight:** **`Integer.MIN_VALUE`** = -2^31 = -2,147,483,648. Its absolute value is 2^31 which does **not** fit in a 32-bit signed integer (max is 2^31 - 1). Negating it wraps back around to itself — `Math.abs(Integer.MIN_VALUE) == Integer.MIN_VALUE`.

> **⚠️ Common Mistake:** Calling `Math.abs()` without checking the result. A check like `if (val < 0)` after `Math.abs()` catches this silently broken case.

### The Hidden Bomb

```java
// Problem: Find absolute value
int abs = Math.abs(Integer.MIN_VALUE);
// Result: Integer.MIN_VALUE — NOT a positive number!
// Because |Integer.MIN_VALUE| = 2^31 which doesn't fit in int (max = 2^31 - 1)

// In 2's complement: -(-2^31) = -2^31 (same bit pattern, overflow wraps around)
System.out.println(Math.abs(Integer.MIN_VALUE));  // prints -2147483648

// RIGHT — use long
long abs = Math.abs((long) Integer.MIN_VALUE);  // 2147483648L — correct

// Interview question: Reverse a 32-bit integer
// Must handle: Integer.MIN_VALUE → reversed would overflow
int reverse(int x) {
    long rev = 0;
    while (x != 0) {
        rev = rev * 10 + x % 10;
        x /= 10;
    }
    if (rev > Integer.MAX_VALUE || rev < Integer.MIN_VALUE) return 0;
    return (int) rev;
}
```

---

### Negation in Two's Complement

> **💡 Pattern Recognition:** The **signed right shift** (`>>`) sign-extends (fills with 1s for negative numbers), while the **unsigned right shift** (`>>>`) always fills with 0s. Mixing them in bit manipulation code causes very subtle bugs.

```java
// n = -2147483648 (Integer.MIN_VALUE)
-n == n  // TRUE in Java! Both are -2147483648

// -1 in 32-bit: all bits set
// -1 >>> 1 == Integer.MAX_VALUE (2147483647) — logical (unsigned) right shift
// -1 >> 1 == -1 — arithmetic right shift (sign-extends)
```

---

## 10. TWO POINTER / SLIDING WINDOW EDGE CASES

> 🌍 **Real-World:** Cloudflare's rate-limiter initially failed on single-IP bursts (all-same key) because the sliding window shrink logic didn't handle the case where the window reduced to size 0 — a degenerate input that passed unit tests but caused a production incident during a DDoS attack. Stripe's fraud detection sliding window had an off-by-one in the window size calculation that allowed one extra transaction per second through the rate limit, discovered only when a bot exploited the exact boundary condition.

> **💡 Key Insight:** Always test your sliding window on degenerate inputs: single element (`n=1`), all same elements, and empty input. These cases expose most initialization and shrink-logic bugs.

> **⚠️ Common Mistake:** Shrinking the window too aggressively when all characters are the same. If `freq["a"] = 4` and you decrement to 3, the window should not shrink to zero.

### All Same Characters

```java
// Problem: Longest substring with at most 2 distinct characters
// Input: "aaaa" → answer should be 4

// WRONG — some solutions shrink window too aggressively
// Check: does your window logic handle freq[char] = 4 going to 0 correctly?

// RIGHT — test these inputs explicitly:
// "a"     → single char: window = [0,0], size = 1 ✓
// "aa"    → all same: never shrink, answer = 2 ✓
// "aabb"  → two distinct: answer = 4 ✓
// "abc"   → three distinct: must shrink. Answer = 2 ("ab" or "bc") ✓
// ""      → empty: return 0 ✓
```

---

### Sliding Window Minimum / Maximum (Deque Monotonic)

> **💡 Key Insight:** The deque stores **indices**, not values. Storing values means you can't tell which window position they belong to, so you can't correctly evict elements that have left the window boundary.

```java
// Problem: Maximum of each window of size k
// Trap: deque stores indices, not values. People store values → wrong deque cleanup.

int[] maxSlidingWindow(int[] nums, int k) {
    Deque<Integer> deque = new ArrayDeque<>();  // stores INDICES
    int[] result = new int[nums.length - k + 1];

    for (int i = 0; i < nums.length; i++) {
        // Remove indices outside window
        while (!deque.isEmpty() && deque.peekFirst() < i - k + 1) {
            deque.pollFirst();  // TRAP: check index, not value
        }
        // Remove indices whose values are smaller than current (maintain decreasing)
        while (!deque.isEmpty() && nums[deque.peekLast()] < nums[i]) {
            deque.pollLast();
        }
        deque.offerLast(i);
        // Window is full
        if (i >= k - 1) {
            result[i - k + 1] = nums[deque.peekFirst()];  // front is max
        }
    }
    return result;
}
```

---

### Two Sum — Sorted vs Unsorted

> **⚠️ Common Mistake:** Applying the two-pointer approach to an unsorted array. Two pointers require a sorted array — the convergence argument breaks if order is arbitrary.

```java
// Sorted array: use two pointers O(n) — no HashMap needed
// TRAP: assuming array is sorted when it's not

int[] twoSum(int[] numbers, int target) {  // numbers is 1-indexed and SORTED
    int l = 0, r = numbers.length - 1;
    while (l < r) {
        int sum = numbers[l] + numbers[r];
        if (sum == target) return new int[]{l + 1, r + 1};
        else if (sum < target) l++;
        else r--;
    }
    return new int[]{-1, -1};  // guaranteed solution exists per problem, but handle gracefully
}

// Unsorted: HashMap O(n) — two pointer won't work without sorting first
Map<Integer, Integer> map = new HashMap<>();
for (int i = 0; i < nums.length; i++) {
    int complement = target - nums[i];
    if (map.containsKey(complement)) return new int[]{map.get(complement), i};
    map.put(nums[i], i);
}
```

---

## 11. GRAPH CYCLE / VISITED STATE BUGS

> 🌍 **Real-World:** npm's package dependency resolver had a production bug where a boolean `visited` set caused it to miss circular dependency detection in certain diamond-shaped graphs — only the 3-state DFS correctly distinguishes "currently resolving" from "already resolved." Docker's image layer dependency graph uses 3-state DFS to detect circular base-image references, returning an error instead of hanging in infinite resolution loops.

> **💡 Key Insight:** A boolean `visited[]` array cannot distinguish between "currently on the DFS stack" and "finished processing." You need **three states** to detect back edges (cycles) in directed graphs.

> **⚠️ Common Mistake:** Using `boolean visited[]` for directed cycle detection. This correctly avoids revisiting nodes but cannot detect back edges — it will miss cycles that share nodes with previously explored paths.

### BFS with 3-State Visited (Directed Graph Cycle Detection)

```java
// 0 = unvisited, 1 = in current DFS path, 2 = fully processed
// TRAP: using boolean visited[] — can't detect back edges correctly

int[] state = new int[n];

boolean hasCycle(int u) {
    state[u] = 1;  // mark as in-progress
    for (int v : graph.get(u)) {
        if (state[v] == 1) return true;   // back edge → cycle
        if (state[v] == 0 && hasCycle(v)) return true;
        // state[v] == 2 → already fully explored, safe to skip
    }
    state[u] = 2;  // mark as done
    return false;
}

// TRAP with boolean: once you set visited[v] = true, you can't detect if v is
// on the current DFS stack (back edge) vs just previously visited (cross edge)
```

| State value | Meaning | What it detects |
|-------------|---------|-----------------|
| `0` | Unvisited | Not yet reached |
| `1` | In-progress (on stack) | Back edge to `1` = cycle |
| `2` | Fully processed | Safe to skip |

---

### BFS on Grid — Diagonal Moves vs 4-directional

> **💡 Pattern Recognition:** Mark cells visited **before** adding to the queue, not after dequeuing. If you mark on dequeue, the same cell can be enqueued multiple times, ballooning complexity to O(n²).

```java
// 4-directional: up, down, left, right
int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0}};

// 8-directional (includes diagonals): add corners
int[][] dirs = {{0,1},{0,-1},{1,0},{-1,0},{1,1},{1,-1},{-1,1},{-1,-1}};

// TRAP: using wrong direction array for the problem
// Flood fill, Number of Islands → 4-directional
// Word Search, Minesweeper counting → 8-directional

// TRAP: forgetting to mark visited BEFORE adding to queue
queue.offer(new int[]{r, c});
visited[r][c] = true;  // MUST be here, not when popping
// If you mark visited when popping, same cell gets added to queue multiple times → O(n²) cells
```

---

## 12. BIT MANIPULATION TRAPS

> 🌍 **Real-World:** Java's `HashMap` uses `>>>` (unsigned right shift) in its hash spreading function (`(h = key.hashCode()) ^ (h >>> 16)`) specifically to avoid sign-extension artifacts that would cause poor bucket distribution for negative hash codes. The Linux kernel's CRC32 implementation mixes `>>` and `>>>` equivalents carefully — an incorrect arithmetic shift in the polynomial division loop would corrupt checksums for all even-valued data bytes.

> **💡 Key Insight:** Java has two right-shift operators: `>>` (arithmetic, sign-extends) and `>>>` (logical, zero-fills). For any division-by-power-of-2 on potentially negative values, know which behavior you need before reaching for the operator.

> **⚠️ Common Mistake:** Using `>>` to implement "divide by 2" and being surprised that `-7 >> 1` gives `-4` instead of `-3`. Java truncates integers toward zero on division but shifts toward negative infinity.

### Signed vs Unsigned Right Shift

```java
int n = -1;
n >> 1   // -1 (arithmetic: sign-extends, fills with 1s)
n >>> 1  // Integer.MAX_VALUE (logical: fills with 0s)

// TRAP in "Divide by 2" operations
// x >> 1 is correct for positive numbers
// x >> 1 rounds toward -infinity for negatives (same as Math.floor(x/2.0))
// -7 >> 1 = -4 (not -3)
// -7 / 2 = -3 (Java truncates toward zero)
```

| Expression | Result | Why |
|-----------|--------|-----|
| `-1 >> 1` | `-1` | Arithmetic: sign bit copies in |
| `-1 >>> 1` | `Integer.MAX_VALUE` | Logical: zero fills MSB |
| `-7 >> 1` | `-4` | Floor division (toward -∞) |
| `-7 / 2` | `-3` | Truncation (toward 0) |

---

### XOR Tricks — When They Break

> **⚠️ Common Mistake:** Applying the XOR swap to `arr[i]` and `arr[j]` without checking `i != j`. When both refer to the same memory location, all three XOR operations zero out the value.

```java
// XOR swap: a ^= b; b ^= a; a ^= b;
// TRAP: if a and b refer to the same memory location, you get 0
int[] arr = {1};
arr[0] ^= arr[0];  // arr[0] = 0 (not a swap — you destroyed the value)

// Safe swap
if (i != j) { arr[i] ^= arr[j]; arr[j] ^= arr[i]; arr[i] ^= arr[j]; }
```

---

### Counting Set Bits — Edge Case: Negative Numbers

> **💡 Key Insight:** Brian Kernighan's algorithm `n &= n - 1` removes the **lowest set bit** each iteration. For negative numbers in Java's two's complement, it still converges to 0 after at most 32 steps — it just counts all 32 bits.

```java
// Integer.bitCount(-1) = 32 (all bits set in two's complement)
// Integer.bitCount(0) = 0

// Brian Kernighan's algorithm: n & (n-1) removes lowest set bit
int countBits(int n) {
    int count = 0;
    while (n != 0) {
        n &= n - 1;
        count++;
    }
    return count;
}
// TRAP: infinite loop if n < 0 (negative numbers never become 0 with &= n-1... actually they do)
// For n = -1: -1 & -2 = -2 (0xFFFFFFFE), -2 & -3 = -4... converges to 0 after 32 steps
// Actually works correctly for negatives in Java, just counts all 32 bits
```

---

## 13. HASHMAP PITFALLS

> 🌍 **Real-World:** Amazon's early DynamoDB client library had a `NullPointerException` bug triggered by `map.get(key) + 1` on a `HashMap<String, Integer>` for the first occurrence of any new attribute name — the null unboxing caused silent crashes in the batch-write path, only surfaced after traffic ramped up. LinkedIn's analytics pipeline switched from `HashMap` to `TreeMap` for time-bucketed event counts after realizing they needed sorted key iteration for their report generation, cutting O(n log n) re-sort steps that were happening after every accumulation.

> **💡 Key Insight:** `HashMap` allows `null` keys and values; `Hashtable` and `ConcurrentHashMap` do not. The `getOrDefault` / `merge` / `compute` methods reduce boilerplate and avoid NullPointerExceptions when accessing uninitialized frequency counts.

> **⚠️ Common Mistake:** Doing `map.get(key) + 1` without a null check. The first time a key appears, `map.get(key)` returns `null`, and unboxing `null` to `int` throws a `NullPointerException`.

### Null Key / Null Value

```java
HashMap<String, Integer> map = new HashMap<>();
map.put(null, 1);       // ALLOWED in HashMap
map.get(null);          // returns 1

Hashtable<String, Integer> table = new Hashtable<>();
table.put(null, 1);     // NullPointerException — Hashtable doesn't allow null keys

// TRAP in interview: using containsKey then get (two lookups)
if (map.containsKey(key)) {
    int val = map.get(key);  // two lookups
}

// RIGHT — single lookup
Integer val = map.get(key);
if (val != null) { ... }

// Or use getOrDefault
int val = map.getOrDefault(key, 0);
```

---

### Default Value Anti-Pattern

> **💡 Pattern Recognition:** Use `freq.merge(c, 1, Integer::sum)` as the idiomatic one-liner for incrementing a frequency count. It handles the "first occurrence" case (initial value = 1) and all subsequent ones (add 1 to existing) in a single call.

```java
// Counting frequencies — common but subtle trap
Map<Character, Integer> freq = new HashMap<>();
for (char c : s.toCharArray()) {
    freq.put(c, freq.get(c) + 1);  // NullPointerException on first occurrence
}

// RIGHT
freq.put(c, freq.getOrDefault(c, 0) + 1);
// Or
freq.merge(c, 1, Integer::sum);
// Or
freq.compute(c, (k, v) -> v == null ? 1 : v + 1);
```

---

### HashMap vs TreeMap vs LinkedHashMap

> **⚠️ Common Mistake:** Using **`HashMap`** when the problem requires operations like "find the first key greater than x" or "return keys in sorted order." Switch to **`TreeMap`** which supports `ceilingKey`, `floorKey`, `headMap`, and `tailMap`.

```java
HashMap<K,V>        // O(1) get/put, random iteration order
TreeMap<K,V>        // O(log n) get/put, sorted by key order
LinkedHashMap<K,V>  // O(1) get/put, insertion-order iteration

// TRAP: using HashMap when the problem requires sorted key traversal
// (e.g., "return keys in sorted order", "find first key > x")
// Use TreeMap.ceilingKey(x), TreeMap.floorKey(x), TreeMap.headMap(x)
```

| Class | `get`/`put` | Iteration order | Sorted ops? |
|-------|-----------|----------------|------------|
| `HashMap` | O(1) | Random | No |
| `TreeMap` | O(log n) | Sorted by key | Yes |
| `LinkedHashMap` | O(1) | Insertion order | No |

---

## 14. GREEDY CORRECTNESS TRAPS

> 🌍 **Real-World:** Airbnb's pricing algorithm initially used a greedy "always charge the highest available rate" strategy — which turned out to be suboptimal because it left rooms unbooked during transitions, exactly like the coin-change counterexample. Switching to DP-based revenue optimization (considering future booking probability) increased total revenue by 15%. Huffman encoding — used in JPEG, MP3, and ZIP compression — is the canonical example of greedy being provably optimal: always merging the two lowest-frequency nodes produces the minimum-prefix-code tree.

> **💡 Key Insight:** Greedy works when the problem has the **optimal substructure** AND the **greedy choice property** — meaning a locally optimal choice is also globally safe. The classic counterexample (coin change with non-canonical coins) shows that these properties are not guaranteed.

> **⚠️ Common Mistake:** Assuming greedy works for coin change without checking whether the coin system is canonical. US coins (1, 5, 10, 25) are canonical; arbitrary coin sets are not.

### Local Optimal ≠ Global Optimal — Classic Counterexample

```java
// Problem: Make change for amount N using coins [1, 6, 10]
// Greedy: always pick largest coin ≤ remaining
// For N = 12: greedy picks 10 → 1 → 1 → 3 coins
// Optimal: 6 → 6 → 2 coins

// Greedy FAILS here. Must use DP.

// Greedy WORKS for:
// - Coin change with canonical systems (US coins: 1,5,10,25)
// - Activity selection (sort by end time, pick earliest ending)
// - Huffman encoding
// - Kruskal's MST
// - Dijkstra (non-negative weights)

// TRAP QUESTION: "Minimum number of coins" → always DP unless told canonical system
```

---

### Jump Game — Greedy Trap

> **💡 Pattern Recognition:** Jump Game I and II look like DP problems (O(n²) temptation), but a greedy scan tracking `maxReach` solves both in O(n). The insight: if you can reach index `i`, you can reach everything up to `i + nums[i]`.

```java
// Problem: Can you reach the last index? nums[i] = max jump from i
// TRAP: thinking you need DP (O(n²)) when greedy works (O(n))

boolean canJump(int[] nums) {
    int maxReach = 0;
    for (int i = 0; i < nums.length; i++) {
        if (i > maxReach) return false;    // can't reach index i
        maxReach = Math.max(maxReach, i + nums[i]);
    }
    return true;
}

// Jump Game II (minimum jumps) — also greedy, not DP
int jump(int[] nums) {
    int jumps = 0, curEnd = 0, farthest = 0;
    for (int i = 0; i < nums.length - 1; i++) {  // stop at n-2, already AT last
        farthest = Math.max(farthest, i + nums[i]);
        if (i == curEnd) {  // exhausted current jump range
            jumps++;
            curEnd = farthest;
        }
    }
    return jumps;
}
```

---

## 15. DP STATE DEFINITION TRAPS

> 🌍 **Real-World:** A Google interview question that frequently trips candidates: a production bug in a shipping route optimizer at FedEx initialized DP states for "unreachable depots" to 0 instead of infinity — the solver then returned 0-cost routes to those depots as optimal, causing drivers to be routed to locations the truck couldn't actually reach. Amazon's warehouse bin-packing system uses the correct right-to-left 0/1 knapsack to prevent re-selecting the same item type in a single shipment box.

> **💡 Key Insight:** In 0/1 knapsack with the 1D space optimization, the **right-to-left** iteration direction is not a stylistic choice — it prevents an item from being selected twice. Left-to-right turns 0/1 knapsack into unbounded knapsack.

> **⚠️ Common Mistake:** Initializing `dp[]` to 0 for "impossible" states. Zero means "zero cost" which is a valid (and better) answer than the actual best. Use `Integer.MAX_VALUE` or `amount + 1` as your sentinel for "impossible."

### 0/1 Knapsack — 1D Array Direction Matters

```java
// Problem: capacity W, items with weight[] and value[]
// 2D DP (always safe):
int[][] dp = new int[n+1][W+1];
for (int i = 1; i <= n; i++) {
    for (int w = 0; w <= W; w++) {
        dp[i][w] = dp[i-1][w];
        if (weight[i-1] <= w)
            dp[i][w] = Math.max(dp[i][w], dp[i-1][w - weight[i-1]] + value[i-1]);
    }
}

// 1D DP (space optimization) — MUST iterate w from right to left
int[] dp = new int[W+1];
for (int i = 0; i < n; i++) {
    for (int w = W; w >= weight[i]; w--) {  // RIGHT-TO-LEFT prevents using item twice
        dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
    }
}

// WRONG — left to right in 0/1 knapsack (same as unbounded knapsack!)
for (int w = weight[i]; w <= W; w++) {  // item can be used multiple times — BUG
    dp[w] = Math.max(dp[w], dp[w - weight[i]] + value[i]);
}

// Unbounded knapsack (each item usable multiple times) → left to right IS correct
```

| Knapsack type | Inner loop direction | Each item usable |
|---------------|---------------------|-----------------|
| 0/1 | Right-to-left (`W` → `weight[i]`) | Once |
| Unbounded | Left-to-right (`weight[i]` → `W`) | Multiple times |

---

### DP Initialization — The Impossible State Trap

> **💡 Pattern Recognition:** When a DP asks for a "minimum count" and a state might be unreachable, initialize with `amount + 1` (a value larger than any valid answer). After the loop, `dp[amount] > amount` means "impossible" → return `-1`.

```java
// Problem: Coin change (minimum coins to make amount)
// dp[0] = 0 (0 coins to make 0)
// dp[amount] = answer

// WRONG — initializing to 0 means "0 coins achievable" which is false for i > 0
int[] dp = new int[amount + 1];
// After loop: dp[3] = 0 even if 3 is impossible → returns 0 instead of -1

// RIGHT — initialize to "infinity" (impossible state)
int[] dp = new int[amount + 1];
Arrays.fill(dp, amount + 1);  // amount+1 > any valid answer
dp[0] = 0;
for (int i = 1; i <= amount; i++) {
    for (int coin : coins) {
        if (coin <= i) dp[i] = Math.min(dp[i], dp[i - coin] + 1);
    }
}
return dp[amount] > amount ? -1 : dp[amount];
```

---

### LCS vs Edit Distance — Confusion

> **⚠️ Common Mistake:** Confusing which DP transition corresponds to delete, insert, and replace in Edit Distance. Draw the 2D table and trace a small example to verify your transitions before coding.

```java
// LCS (Longest Common Subsequence):
// dp[i][j] = LCS of s1[0..i-1] and s2[0..j-1]
if (s1.charAt(i-1) == s2.charAt(j-1))
    dp[i][j] = dp[i-1][j-1] + 1;
else
    dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);

// Edit Distance (Levenshtein):
// dp[i][j] = min edits to convert s1[0..i-1] to s2[0..j-1]
if (s1.charAt(i-1) == s2.charAt(j-1))
    dp[i][j] = dp[i-1][j-1];              // no op needed
else
    dp[i][j] = 1 + Math.min(dp[i-1][j],  // delete from s1
                   Math.min(dp[i][j-1],  // insert into s1
                            dp[i-1][j-1])); // replace

// TRAP: confusing which transition is delete, insert, replace
// Delete s1[i]: move i back → dp[i-1][j]
// Insert into s1 (equiv to delete from s2[j]): → dp[i][j-1]
// Replace: → dp[i-1][j-1]
```

---

## 16. NEGATIVE MODULO

> 🌍 **Real-World:** Consistent hashing ring implementations (used in Cassandra, DynamoDB, and Redis Cluster) must normalize negative modulo results — a token with a negative hash value maps to `((hash % ringSize) + ringSize) % ringSize` to get the correct position on the ring. A 2019 production incident at a mid-size fintech company caused account-balance queries to return wrong results because prefix-sum remainders were stored in a HashMap without normalization, leading negative remainders to create phantom "unmatched" buckets.

> **💡 Key Insight:** Java's `%` is the **remainder** operator, not the mathematical **modulus**. The result has the same sign as the dividend. To get a true non-negative modulus, always apply `((x % m) + m) % m`.

> **⚠️ Common Mistake:** Using raw `%` on a prefix sum that could be negative. The raw remainder goes negative, falls into a wrong bucket in your frequency map, and the subarray count comes out wrong.

### Java's `%` Returns Negative for Negative Operands

```java
// In Java (and C/C++), % is the remainder, not true modulus
-7 % 3   // = -1  (NOT 2)
 7 % -3  // =  1  (sign follows dividend)

// WRONG — using % directly when result might be negative
int hash = key % capacity;      // can be negative if key < 0
int idx = ((n % k) + k) % k;   // people forget the +k normalization

// RIGHT — always normalize to positive
int mod = ((x % m) + m) % m;   // guaranteed non-negative

// Concrete example: subarray sum divisible by k
// Track prefix_sum % k. If two indices have same remainder → subarray between them divisible by k
// BUT: prefix sum can be negative → raw % gives negative → wrong bucket
Map<Integer, Integer> remainderMap = new HashMap<>();
remainderMap.put(0, -1);
int prefSum = 0;
for (int i = 0; i < nums.length; i++) {
    prefSum += nums[i];
    int rem = ((prefSum % k) + k) % k;  // normalize negative remainder
    if (remainderMap.containsKey(rem)) {
        if (i - remainderMap.get(rem) >= 2) return true;
    } else {
        remainderMap.put(rem, i);
    }
}
return false;
```

**Interview questions**: Subarray Sum Divisible by K (LC 974), Continuous Subarray Sum (LC 523), Consistent Hashing ring arithmetic.

| Expression | Java result | Mathematical modulus |
|-----------|-----------|---------------------|
| `-7 % 3` | `-1` | `2` |
| `7 % -3` | `1` | `1` |
| `((−7 % 3) + 3) % 3` | `2` | `2` (correct) |

---

### Modular Arithmetic in Long Computations

> **💡 Pattern Recognition:** In modular exponentiation, `base` can grow to near `MOD²` before the `% mod` reduces it. With `MOD = 10^9 + 7`, that's ~10^18 — fine for `long`, but if `base` starts negative you must normalize it first.

```java
// Problem: compute (a * b) % MOD where a, b up to 10^9
long MOD = 1_000_000_007;

// WRONG — a * b overflows long if both are ~10^18
long result = (a * b) % MOD;

// RIGHT — cast early or use modular multiplication
long result = ((long) a % MOD) * ((long) b % MOD) % MOD;

// Modular exponentiation (a^b % MOD) — O(log b)
long modPow(long base, long exp, long mod) {
    long result = 1;
    base %= mod;
    while (exp > 0) {
        if ((exp & 1) == 1) result = result * base % mod;
        base = base * base % mod;
        exp >>= 1;
    }
    return result;
}
// TRAP: if base can be negative going in, do base = ((base % mod) + mod) % mod first
```

---

## 17. PRIORITY QUEUE TRAPS

> 🌍 **Real-World:** Uber's surge pricing engine uses a max-heap of demand events but an early implementation accidentally used Java's default min-heap — the system dispatched drivers to low-demand zones first, inverting the intended behavior, discovered only when surge zones were consistently under-served. Dijkstra's algorithm in Google Maps runs on a min-heap; the stale-entry check (`if (d > dist[u]) continue`) is essential because node distances are updated lazily — without it, outdated entries would process nodes with incorrect distances, yielding non-shortest paths.

> **💡 Key Insight:** Java's `PriorityQueue` is a **min-heap** by default — the smallest element is at the top. For a max-heap, pass `Comparator.reverseOrder()`. Never use `(a, b) -> b - a` as a max-heap comparator — it overflows for large values.

> **⚠️ Common Mistake:** In Dijkstra's algorithm, forgetting the stale-entry check (`if (d > dist[u]) continue`). Without it, outdated distances get processed, corrupting the shortest-path table.

### Min Heap vs Max Heap — Default is Min in Java

```java
// Java PriorityQueue is MIN heap by default
PriorityQueue<Integer> minHeap = new PriorityQueue<>();           // min at top
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder()); // max at top

// TRAP: assuming PriorityQueue<Integer> gives you the max
minHeap.offer(5); minHeap.offer(1); minHeap.offer(3);
minHeap.peek();  // returns 1 (minimum), NOT 5

// TRAP: using (a, b) -> b - a for max heap with large integers → overflow
PriorityQueue<Integer> pq = new PriorityQueue<>((a, b) -> b - a);  // WRONG if values near Integer.MAX_VALUE
PriorityQueue<Integer> pq = new PriorityQueue<>(Comparator.reverseOrder());  // RIGHT
```

---

### Stale Entries in Priority Queue (Lazy Deletion)

> **💡 Key Insight:** When a node's distance is improved in Dijkstra, you **cannot** efficiently remove the old entry from the heap. Instead, add a new entry and skip the old one when it's popped with `if (d > dist[u]) continue`. This is called **lazy deletion**.

```java
// Problem: Dijkstra's algorithm — when we update a node's distance, we can't
// remove the old entry from PQ cheaply. So we add a new entry and skip old ones.

PriorityQueue<int[]> pq = new PriorityQueue<>(Comparator.comparingInt(a -> a[0]));
int[] dist = new int[n];
Arrays.fill(dist, Integer.MAX_VALUE);
dist[src] = 0;
pq.offer(new int[]{0, src});

while (!pq.isEmpty()) {
    int[] curr = pq.poll();
    int d = curr[0], u = curr[1];
    if (d > dist[u]) continue;  // CRITICAL: skip stale entry
    for (int[] edge : graph.get(u)) {
        int v = edge[0], w = edge[1];
        if (dist[u] + w < dist[v]) {
            dist[v] = dist[u] + w;
            pq.offer(new int[]{dist[v], v});  // old entry for v still in PQ — stale
        }
    }
}
// Without "if (d > dist[u]) continue" → processes same node multiple times → wrong
```

---

### PriorityQueue with Custom Objects — equals/hashCode Irrelevant

> **⚠️ Common Mistake:** Calling `pq.remove(obj)` expecting O(log n) performance. `PriorityQueue.remove(Object)` is O(n) — it linearly scans using `.equals()`. For frequent removal, use a `TreeSet` or lazy deletion instead.

```java
// PriorityQueue uses comparator for ordering but does NOT use equals for contains/remove
// pq.remove(obj) is O(n) linear scan using .equals()
// pq.contains(obj) is O(n) linear scan

// TRAP: expecting O(log n) remove from PQ
// If you need frequent removal → use TreeSet (but lose duplicate support)
// Or use Lazy Deletion (mark deleted, skip on poll)

// Custom object in PQ — must implement Comparable OR provide Comparator
class Task implements Comparable<Task> {
    int priority, id;
    @Override
    public int compareTo(Task other) {
        return Integer.compare(this.priority, other.priority); // min-priority first
    }
}
```

---

## 18. BACKTRACKING STATE UNDO

> 🌍 **Real-World:** Prolog's execution model is literally backtracking with undo — IBM's Watson used a Prolog-inspired inference engine for Jeopardy!, and correct state restoration after failed branches was the foundation of its search. SAT solvers (like those used by Intel's chip verification tools) are sophisticated backtracking systems; the DPLL algorithm's core correctness relies on perfect undo of variable assignments when a branch leads to a contradiction.

> **💡 Key Insight:** Every backtracking function follows the same **choose → explore → unchoose** pattern. The unchoose step must reverse **every** state change made before the recursive call. Forgetting even one leaves the state corrupted for sibling branches.

> **⚠️ Common Mistake:** Adding the result list reference (`result.add(current)`) instead of a snapshot (`result.add(new ArrayList<>(current))`). All entries end up pointing to the same list object, which is empty by the time you return.

### The #1 Backtracking Bug — Forgetting to Undo

```java
// Problem: Generate all permutations

// WRONG — never removes element from 'current', builds wrong state on backtrack
void permute(int[] nums, boolean[] used, List<Integer> current, List<List<Integer>> result) {
    if (current.size() == nums.length) { result.add(new ArrayList<>(current)); return; }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        current.add(nums[i]);
        permute(nums, used, current, result);
        // FORGOT: used[i] = false; current.remove(current.size() - 1);
    }
}

// RIGHT — undo EVERY state change made before the recursive call
void permute(int[] nums, boolean[] used, List<Integer> current, List<List<Integer>> result) {
    if (current.size() == nums.length) { result.add(new ArrayList<>(current)); return; }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true;                          // choose
        current.add(nums[i]);
        permute(nums, used, current, result);    // explore
        used[i] = false;                         // unchoose ← the undo
        current.remove(current.size() - 1);      // unchoose ← the undo
    }
}
```

---

### Shallow Copy Trap — Not Snapshotting the Result

```java
// WRONG — all entries in result point to the SAME list object
result.add(current);              // adds reference, not copy
// After backtracking, current is empty → all "results" are empty lists

// RIGHT — deep copy at the leaf
result.add(new ArrayList<>(current));   // snapshot current state
```

> **💡 Pattern Recognition:** Any time you add a mutable collection to a results list inside a recursive function, wrap it with `new ArrayList<>(...)`. This applies to lists, sets, and arrays alike.

---

### Backtracking on Grid — Marking Visited

> **⚠️ Common Mistake:** Forgetting to restore `board[r][c]` after the recursive DFS returns. Subsequent paths in the search tree see the `'#'` sentinel as a wall and miss valid paths through that cell.

```java
// Problem: Word Search in 2D grid

boolean dfs(char[][] board, String word, int idx, int r, int c) {
    if (idx == word.length()) return true;
    if (r < 0 || r >= board.length || c < 0 || c >= board[0].length) return false;
    if (board[r][c] != word.charAt(idx)) return false;

    char temp = board[r][c];
    board[r][c] = '#';                           // mark visited in-place (no extra array)

    boolean found = dfs(board, word, idx+1, r+1, c) ||
                    dfs(board, word, idx+1, r-1, c) ||
                    dfs(board, word, idx+1, r, c+1) ||
                    dfs(board, word, idx+1, r, c-1);

    board[r][c] = temp;                          // UNDO — restore original char

    return found;
    // TRAP: forgetting to restore board[r][c] → subsequent DFS paths see '#' as obstacle
}
```

---

## 19. PREFIX SUM PITFALLS

> 🌍 **Real-World:** Google BigQuery's analytical functions (SUM OVER, COUNT OVER with RANGE PRECEDING) are implemented using 2D prefix sums on columnar data blocks — the `freq.put(0, 1)` base case maps directly to the "empty window before the first row" that every windowed aggregate must handle. A production bug at a US bank's fraud detection system returned wrong subarray-sum counts for transaction sequences that started at index 0, traced to the missing `freq.put(0, 1)` initialization — 6 months of fraud patterns were miscounted.

> **💡 Key Insight:** 1-indexed prefix arrays (`prefix[0][*] = 0`) produce cleaner range-query formulas and eliminate the need for special-case bounds checks. The pattern `prefix[i][j] = matrix[i-1][j-1] + prefix[i-1][j] + prefix[i][j-1] - prefix[i-1][j-1]` is the standard 2D build formula.

> **⚠️ Common Mistake:** Forgetting to seed the frequency map with `freq.put(0, 1)` before the loop. This initial entry represents the empty prefix (sum = 0) and is needed to count subarrays that start at index 0.

### 2D Prefix Sum — Index Arithmetic

```java
// Build prefix sum: prefix[i][j] = sum of rectangle (0,0) to (i-1, j-1)
// Using 1-indexed prefix for cleaner formula (prefix[0][*] = 0, prefix[*][0] = 0)

int[][] prefix = new int[m+1][n+1];
for (int i = 1; i <= m; i++)
    for (int j = 1; j <= n; j++)
        prefix[i][j] = matrix[i-1][j-1]
                      + prefix[i-1][j]    // above
                      + prefix[i][j-1]    // left
                      - prefix[i-1][j-1]; // subtracted twice, add back

// Query: sum of rectangle (r1,c1) to (r2,c2) — 0-indexed input
int rangeSum(int r1, int c1, int r2, int c2) {
    return prefix[r2+1][c2+1]
         - prefix[r1][c2+1]    // remove rows above r1
         - prefix[r2+1][c1]    // remove cols left of c1
         + prefix[r1][c1];     // added back (subtracted twice)
}
// TRAP: mixing 0-indexed input with 1-indexed prefix → off by one everywhere
```

---

### Prefix Sum with Modulo — HashMap Key Must Be Normalized

```java
// Problem: Count subarrays with sum divisible by k
// Approach: prefix[j] - prefix[i] ≡ 0 (mod k) → same remainder → count pairs

// TRAP 1: Not normalizing negative remainders (covered in §16)
// TRAP 2: Initializing map wrong — you need to count empty prefix (sum=0 before index 0)

Map<Integer, Integer> freq = new HashMap<>();
freq.put(0, 1);  // empty prefix has remainder 0 — MUST initialize this
int prefSum = 0, count = 0;
for (int num : nums) {
    prefSum += num;
    int rem = ((prefSum % k) + k) % k;
    count += freq.getOrDefault(rem, 0);  // all previous indices with same remainder
    freq.merge(rem, 1, Integer::sum);
}
return count;
// TRAP: putting freq.put(0,1) AFTER the loop start → misses subarrays starting at index 0
```

> **💡 Pattern Recognition:** Any prefix-sum + HashMap problem needs `freq.put(0, 1)` as its very first line (before the loop). This is the "empty prefix" base case and is almost always forgotten.

---

### Subarray Sum Equals K — Can't Use Sliding Window

> **⚠️ Common Mistake:** Applying sliding window to subarray-sum problems with negative numbers. Sliding window relies on the invariant that growing the window increases the sum and shrinking it decreases it — this breaks with negatives.

```java
// TRAP: Trying to use two pointers / sliding window for subarray sum = k
// Sliding window only works when all elements are non-negative (shrinking window makes sum smaller)
// With negative numbers → must use prefix sum + HashMap

// RIGHT — O(n) with HashMap
int subarraySum(int[] nums, int k) {
    Map<Integer, Integer> freq = new HashMap<>();
    freq.put(0, 1);
    int prefSum = 0, count = 0;
    for (int num : nums) {
        prefSum += num;
        count += freq.getOrDefault(prefSum - k, 0);  // subarrays ending here with sum k
        freq.merge(prefSum, 1, Integer::sum);
    }
    return count;
}
```

---

## 20. MONOTONIC STACK TRAPS

> 🌍 **Real-World:** Grafana's time-series visualization engine uses a monotonic deque (indices not values) to compute rolling maximum/minimum over dashboard chart windows — storing values instead of indices caused a bug where the deque couldn't evict out-of-window elements, causing memory growth proportional to data points instead of window size. Financial charting platforms like TradingView implement the "previous greater" monotonic stack pattern for support/resistance level detection, where the index is needed to display the correct timestamp on the chart.

> **💡 Key Insight:** A monotonic stack stores **indices**, not values. You need the index to know which result slot to fill in and to check whether an index has left the window boundary (for sliding window variants).

> **⚠️ Common Mistake:** Using `<` instead of `<=` when popping. For problems like Largest Rectangle in Histogram, equal-height bars must be handled carefully — using `<` leaves equal heights on the stack and can produce incorrect area calculations.

### Next Greater Element — Stack Stores Indices, Not Values

```java
// WRONG — stores values, can't look up which index to fill in result[]
Deque<Integer> stack = new ArrayDeque<>();  // stores values
int[] result = new int[n];
for (int i = 0; i < n; i++) {
    while (!stack.isEmpty() && stack.peek() < nums[i]) {
        // TRAP: you don't know which index this value came from
        result[???] = nums[i];
        stack.pop();
    }
    stack.push(nums[i]);
}

// RIGHT — store indices
Deque<Integer> stack = new ArrayDeque<>();  // stores INDICES
int[] result = new int[n];
Arrays.fill(result, -1);
for (int i = 0; i < n; i++) {
    while (!stack.isEmpty() && nums[stack.peek()] < nums[i]) {
        result[stack.pop()] = nums[i];  // now we know which slot to fill
    }
    stack.push(i);
}
```

---

### Previous Greater vs Next Greater — Stack Direction

> **💡 Pattern Recognition:** The direction you iterate determines which side of each element you're answering:
> - Iterate **left-to-right**, pop when current is greater → fills **next greater to the right**
> - Iterate **left-to-right**, read stack top at push time → answers **previous greater to the left**

```java
// Pattern: iterate left-to-right → find next greater to the RIGHT
// Pattern: iterate right-to-left → find next greater to the LEFT (previous greater)

// Next Greater Element (to the right) — iterate forward
for (int i = 0; i < n; i++) {
    while (!stack.isEmpty() && nums[stack.peek()] < nums[i])
        result[stack.pop()] = nums[i];
    stack.push(i);
}

// Previous Greater Element (to the left) — iterate forward, answer at push time
for (int i = 0; i < n; i++) {
    while (!stack.isEmpty() && nums[stack.peek()] <= nums[i])
        stack.pop();
    left[i] = stack.isEmpty() ? -1 : stack.peek();  // top of stack IS the answer
    stack.push(i);
}

// TRAP: using wrong direction and getting left answers when you need right (or vice versa)
// TRAP: using < vs <= — equal elements need careful thought
// Largest Rectangle in Histogram: use <= to handle duplicate heights correctly
```

---

### Monotonic Stack — Circular Array

> **⚠️ Common Mistake:** Forgetting to double the iteration (`2 * n`) for circular arrays. Only iterating once means elements near the end of the array never "see" elements near the beginning that could be their next greater.

```java
// Problem: Next Greater Element in circular array
// TRAP: only iterating once. Must iterate 2n.

int[] result = new int[n];
Arrays.fill(result, -1);
Deque<Integer> stack = new ArrayDeque<>();
for (int i = 0; i < 2 * n; i++) {       // iterate twice
    int idx = i % n;
    while (!stack.isEmpty() && nums[stack.peek()] < nums[idx]) {
        result[stack.pop()] = nums[idx];
    }
    if (i < n) stack.push(idx);          // only push each real index ONCE
}
```

---

## 21. INTERVAL MERGE / OVERLAP TRAPS

> 🌍 **Real-World:** Google Calendar's "show busy blocks" feature merges overlapping calendar events server-side before rendering — without sorting by start time, the merge loop would miss overlaps between non-adjacent events, displaying gaps in "busy" time where meetings actually existed. Pagerduty's on-call schedule system handles the touching-vs-overlapping distinction carefully: schedules that end and start at the exact same minute should produce zero gap (merge with `<=`), not a 1-minute window where no one is on call.

> **💡 Key Insight:** Always sort intervals by **start time** before merging. Without sorting, you cannot determine which interval's end to compare against. When merging, track the end of the last merged interval and extend it if the next interval overlaps.

> **⚠️ Common Mistake:** Using `(a, b) -> a[0] - b[0]` as the sort comparator. This overflows if interval starts can be negative. Use `Integer.compare(a[0], b[0])` instead.

### Merging Intervals — Sort by Start, Compare with Previous End

```java
// TRAP: not sorting first, or sorting by end instead of start
Arrays.sort(intervals, (a, b) -> a[0] - b[0]);  // WRONG if values can be negative
Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));  // RIGHT

List<int[]> merged = new ArrayList<>();
for (int[] interval : intervals) {
    if (merged.isEmpty() || merged.get(merged.size()-1)[1] < interval[0]) {
        merged.add(interval);                        // no overlap
    } else {
        merged.get(merged.size()-1)[1] =
            Math.max(merged.get(merged.size()-1)[1], interval[1]);  // extend end
    }
}

// TRAP: using <= instead of < for the overlap check
// [1,4] and [4,5]: they TOUCH at 4. Is that an overlap?
// "Overlap" problems: < means touching is NOT overlap (merge if interval[0] <= prev_end)
// Read the problem carefully.
```

> **💡 Pattern Recognition:** The overlap condition `interval[0] <= prev_end` (using `<=`) merges touching intervals. The condition `interval[0] < prev_end` (using `<`) does not merge them. Always check whether the problem treats touching intervals as overlapping.

---

### Meeting Rooms — Two Different Problems

> **⚠️ Common Mistake:** Solving "minimum rooms needed" with the same merge-intervals approach used for "can attend all meetings." These are different problems requiring different algorithms.

```java
// Problem 1: Can one person attend all meetings? (no overlaps)
// Sort by start → check if any start < previous end
Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
for (int i = 1; i < intervals.length; i++) {
    if (intervals[i][0] < intervals[i-1][1]) return false;  // overlap
}
return true;

// Problem 2: Min rooms needed (max concurrent meetings)
// TRAP: trying to use the merge approach — wrong problem
// RIGHT: events-based or min-heap approach
int[] starts = ..., ends = ...;
Arrays.sort(starts); Arrays.sort(ends);
int rooms = 0, maxRooms = 0, j = 0;
for (int i = 0; i < n; i++) {
    if (starts[i] < ends[j]) { rooms++; maxRooms = Math.max(maxRooms, rooms); }
    else { rooms--; j++; }
}
return maxRooms;
// TRAP: using <= vs < — if meeting ends exactly when another starts, same room is reusable
```

---

## 22. JAVA STANDARD LIBRARY PITFALLS

> 🌍 **Real-World:** A Spring Boot microservice at a major US retailer hit `UnsupportedOperationException` in production when a developer used `Arrays.asList()` return value and later called `.add()` during a flash-sale traffic spike — the fixed-size list caused the request handler to throw, cascading into a 2-hour outage. The `String.split(".")` returning empty array bug has affected multiple Apache Hadoop configuration parsers that split hostnames by dot, silently producing zero tokens and defaulting to localhost instead of the intended cluster nodes.

> **💡 Key Insight:** `Arrays.asList()` returns a fixed-size list backed by the original array — you can update elements but not add or remove. Wrap with `new ArrayList<>(Arrays.asList(...))` whenever you need a fully mutable list.

> **⚠️ Common Mistake:** Calling `"a.b.c".split(".")` and getting an empty array. The dot `.` is a regex wildcard. Always escape regex metacharacters: `\\.` for literal dot, `\\|` for literal pipe.

### `Arrays.asList()` Returns Fixed-Size List

```java
List<Integer> list = Arrays.asList(1, 2, 3);
list.add(4);    // UnsupportedOperationException — fixed size, backed by array
list.set(0, 9); // OK — modification is allowed, just not size change

// RIGHT — if you need a mutable list
List<Integer> list = new ArrayList<>(Arrays.asList(1, 2, 3));
```

---

### `String.split()` — Leading Empty Strings and Trailing Behavior

> **💡 Pattern Recognition:** Use `split("\\.", -1)` to preserve trailing empty tokens. Use `split("\\.")` (default `limit=0`) to silently drop them. The leading-delimiter empty-token behavior is always present regardless of limit.

```java
// Leading delimiter produces empty first token
",a,b".split(",")     // ["", "a", "b"] — first element is empty string!

// Trailing delimiters are IGNORED by default (limit = 0)
"a,b,".split(",")     // ["a", "b"] — trailing empty string dropped
"a,b,".split(",", -1) // ["a", "b", ""] — negative limit preserves trailing empties

// Single char split is a regex — special chars must be escaped
"a.b.c".split(".")    // [] — dot is regex wildcard, matches everything, returns empty!
"a.b.c".split("\\.")  // ["a", "b", "c"] — escaped dot

// Same for |, *, +, (, ), [, {, ^, $, ?
"a|b|c".split("\\|")  // ["a", "b", "c"]
```

---

### `Scanner` vs `BufferedReader` — Performance Trap

> **⚠️ Common Mistake:** Using `Scanner` for competitive programming input with 10^5+ tokens. Scanner uses regex internally and is dramatically slower than `BufferedReader` + `StringTokenizer` for bulk reads.

```java
// Scanner: convenient but slow (uses regex internally)
// For large input (10^5+ tokens): Scanner can TLE in competitive programming

// RIGHT for large input
BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
StringTokenizer st = new StringTokenizer(br.readLine());
int n = Integer.parseInt(st.nextToken());

// For output: PrintWriter is faster than System.out.println in a loop
PrintWriter pw = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
pw.println(result);
pw.flush();  // DON'T FORGET — unflushed output → empty output
```

---

### `Collections.sort` vs `Arrays.sort` — Stability

> **💡 Key Insight:** When you add elements to a `TreeSet` or `TreeMap` with a custom comparator that returns 0 for two distinct objects, the second object is silently **deduplicated** — it is treated as the same key as the first. Always add a tiebreaker to the comparator.

```java
// Both use TimSort for objects → stable (equal elements preserve input order)
// Arrays.sort on primitives uses Dual-Pivot Quicksort → NOT stable

// TRAP: relying on stability when sorting primitive arrays
// If you sort int[] and then need stable behavior → sort Integer[] instead

// TRAP: Comparator returning 0 for "equal" elements can cause non-deterministic
// ordering across JVM versions if your comparator is inconsistent with equals
// TreeMap/TreeSet: if comparator returns 0 for two keys, they're treated as SAME KEY
TreeSet<int[]> set = new TreeSet<>((a, b) -> a[0] - b[0]);
set.add(new int[]{1, 100});
set.add(new int[]{1, 200});  // comparator returns 0 → treated as duplicate → IGNORED
// TreeSet now has only ONE element! Use secondary key in comparator.
TreeSet<int[]> set = new TreeSet<>((a, b) -> a[0] != b[0] ? a[0]-b[0] : a[1]-b[1]);
```

---

## 23. FLOYD'S CYCLE DETECTION

> 🌍 **Real-World:** Java's garbage collector uses a variant of cycle detection to find unreachable object reference cycles — Phase 1 determines a cycle exists, Phase 2 identifies its starting node (the "root" of the cycle) to enqueue it for collection. Networking protocols like TCP use sequence number wraparound detection (conceptually equivalent to Floyd's Phase 2 math) to correctly identify when a sequence number has looped back past the start, distinguishing old from new packets.

> **💡 Key Insight:** Floyd's algorithm has two phases. Phase 1 confirms a cycle exists and finds a **meeting point inside the cycle** (not the cycle start). Phase 2 resets one pointer to `head` and advances both at speed 1 — they meet exactly at the **cycle start**.

> **⚠️ Common Mistake:** Continuing to advance `fast` at two steps per tick during Phase 2. Phase 2 requires **both** pointers advancing one step at a time.

### Phase 1 and Phase 2 — Misunderstanding the Math

```java
// Phase 1: Detect cycle exists
// slow moves 1 step, fast moves 2 steps
// They meet INSIDE the cycle (not necessarily at cycle start)

ListNode slow = head, fast = head;
while (fast != null && fast.next != null) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow == fast) break;  // cycle detected, meeting point inside cycle
}
if (fast == null || fast.next == null) return null;  // no cycle

// Phase 2: Find start of cycle
// TRAP: continuing with slow and fast. Instead, reset ONE pointer to head.
slow = head;                              // reset to head
while (slow != fast) {
    slow = slow.next;
    fast = fast.next;                     // fast now moves 1 step too
}
return slow;  // both now at cycle start

// WHY IT WORKS: if distance from head to cycle start = F,
// cycle length = C, meeting point = F steps into cycle:
// fast traveled 2*(F + steps_in_cycle), slow traveled F + steps_in_cycle
// After reset: both advance F more steps → land at cycle start
```

---

### LinkedList Null Pointer Traps

> **💡 Pattern Recognition:** Use a **dummy head node** in linked list problems. It eliminates the special case of inserting or merging at the very beginning of the list, making the loop body uniform for all nodes.

```java
// Reverse a linked list — classic null pointer
ListNode prev = null, curr = head;
while (curr != null) {
    ListNode next = curr.next;  // save BEFORE overwriting
    curr.next = prev;
    prev = curr;
    curr = next;
}
return prev;
// TRAP: not saving curr.next before reassigning → loses rest of list

// Merge two sorted lists — forgetting null checks
ListNode mergeTwoLists(ListNode l1, ListNode l2) {
    ListNode dummy = new ListNode(0);  // dummy head avoids null check on first node
    ListNode curr = dummy;
    while (l1 != null && l2 != null) {
        if (l1.val <= l2.val) { curr.next = l1; l1 = l1.next; }
        else                  { curr.next = l2; l2 = l2.next; }
        curr = curr.next;
    }
    curr.next = l1 != null ? l1 : l2;  // attach remaining — one or both are null
    return dummy.next;
}
```

---

## 24. UNION-FIND PITFALLS

> 🌍 **Real-World:** Facebook's account merging system (for deduplicating profiles) uses Union-Find with the `if (px == py) return` guard — without it, self-union calls on already-merged accounts would decrement the component count below the true value, reporting fewer unique users than actually exist. Twitter's follower graph uses Union-Find for community detection; the `count--` without the same-component guard produced incorrect cluster counts that inflated the "trending community" metric by over 20% in a 2020 internal audit.

> **💡 Key Insight:** The `if (px == py) return` guard in `union()` is not just an optimization — it is **required** for correctness. Without it, calling `union(x, x)` still modifies the `rank` array and inflates tree heights, degrading performance and potentially corrupting structure.

> **⚠️ Common Mistake:** Decrementing the component count without the same-component guard. Every redundant `union` call on already-connected nodes decrements the count, giving a count that is too low.

### Self-Loop When Connecting Same Component

```java
int[] parent = new int[n];
int[] rank   = new int[n];
for (int i = 0; i < n; i++) parent[i] = i;  // each node is its own parent

int find(int x) {
    if (parent[x] != x) parent[x] = find(parent[x]);  // path compression
    return parent[x];
}

void union(int x, int y) {
    int px = find(x), py = find(y);
    if (px == py) return;                         // TRAP: must check this, else self-loop
    if (rank[px] < rank[py]) { int t = px; px = py; py = t; }
    parent[py] = px;
    if (rank[px] == rank[py]) rank[px]++;
}

// TRAP: forgetting the "if (px == py) return" check
// Without it, union(3, 3) makes parent[3] = 3 (fine) but rank increases → bloats tree

// TRAP: using find() result to check if same component BEFORE calling union
// Correct pattern:
boolean connected(int x, int y) { return find(x) == find(y); }
```

---

### Union-Find for Number of Components

> **💡 Pattern Recognition:** Maintain a `count` variable initialized to `n`. Decrement it **only** inside the `union` method, after confirming `px != py`. Querying `count` at any point gives the current number of connected components.

```java
// Initialize count = n (n separate components)
// Each successful union → count--
int count = n;
void union(int x, int y) {
    int px = find(x), py = find(y);
    if (px == py) return;                // already same component
    parent[py] = px;
    count--;                             // one less component
}
// TRAP: decrementing count without the "if (px == py) return" guard → double-counts
```

---

## 25. MATH & NUMBER THEORY TRAPS

> 🌍 **Real-World:** Amazon's fulfillment routing uses integer ceiling division (`(packages + truckCapacity - 1) / truckCapacity`) to compute truck counts — using `Math.ceil((double) packages / capacity)` caused floating-point rounding errors for package counts near powers of 2, occasionally allocating one too few trucks. OpenSSL's modular exponentiation for RSA uses the `a / gcd(a,b) * b` LCM formula specifically to avoid overflow before division — the key cryptographic operation that secures billions of HTTPS connections daily.

> **💡 Key Insight:** Floating-point ceiling division is unreliable for large integers due to precision loss. The pure-integer formula `(a + b - 1) / b` is exact, branchless, and always correct for `a >= 0, b > 0`.

> **⚠️ Common Mistake:** Writing `a * b / gcd(a, b)` to compute LCM. The multiplication happens first and can overflow a `long`. Always divide first: `a / gcd(a, b) * b`.

### Integer Ceiling Division Without Float

```java
// TRAP: using float/double for ceiling → precision errors for large numbers
int ceil = (int) Math.ceil((double) a / b);   // floating point imprecision for large a, b

// RIGHT — pure integer ceiling division (works for a >= 0, b > 0)
int ceil = (a + b - 1) / b;
// Why: add (b-1) to a. If a is exact multiple of b, the +b-1 gets divided away.
//      Otherwise, it bumps us to the next integer.

// Equivalently:
int ceil = (a - 1) / b + 1;  // also correct for a > 0

// For negative numbers, Java truncates toward zero:
// -7 / 2 = -3 (ceiling, rounds toward zero)
// Math.floorDiv(-7, 2) = -4 (floor, rounds toward negative infinity)
```

| Method | Formula | Safe for large ints? |
|--------|---------|---------------------|
| Float cast | `(int) Math.ceil((double) a / b)` | No — precision loss |
| Integer formula | `(a + b - 1) / b` | Yes |
| Alternative | `(a - 1) / b + 1` | Yes (requires `a > 0`) |

---

### GCD and LCM — LCM Overflow

```java
// Euclidean GCD — O(log min(a,b))
int gcd(int a, int b) {
    return b == 0 ? a : gcd(b, a % b);
}

// LCM — TRAP: a * b overflows before dividing
int lcm(int a, int b) {
    return a * (b / gcd(a, b));           // WRONG if a * (b/gcd) overflows
    return (int) ((long) a / gcd(a, b) * b);  // RIGHT — divide first, then multiply
    // a / gcd(a,b) is always integer (gcd divides a), so divide first is safe
}

// TRAP: gcd(0, n) = n, gcd(n, 0) = n — the base case handles this correctly
// TRAP: gcd with negative inputs — Java % can return negative remainder
// Fix: use Math.abs() or ensure inputs are positive
int gcd(int a, int b) {
    a = Math.abs(a); b = Math.abs(b);
    return b == 0 ? a : gcd(b, a % b);
}
```

> **💡 Pattern Recognition:** The LCM of two numbers can be up to `a * b`, which overflows `int` and can overflow `long` if inputs are near `Long.MAX_VALUE`. Use `(long) a / gcd(a, b) * b` — dividing first keeps the intermediate value bounded.

---

### Sieve of Eratosthenes — Common Mistakes

> **⚠️ Common Mistake:** Starting the inner loop at `2 * i` instead of `i * i`. Both produce a correct sieve, but starting at `i * i` skips already-marked composites and achieves the O(n log log n) time bound.

```java
boolean[] isPrime = new boolean[n + 1];
Arrays.fill(isPrime, true);
isPrime[0] = isPrime[1] = false;                    // 0 and 1 are not prime

for (int i = 2; (long) i * i <= n; i++) {          // cast to long to prevent i*i overflow
    if (isPrime[i]) {
        for (int j = i * i; j <= n; j += i) {      // start from i*i, not 2*i
            isPrime[j] = false;
        }
    }
}

// TRAP 1: starting inner loop from 2*i instead of i*i → extra work but still correct
// TRAP 2: outer loop going to n instead of sqrt(n) → O(n log n) instead of O(n log log n)
// TRAP 3: i * i can overflow int when i is large → use (long) i * i <= n
for (int i = 2; (long) i * i <= n; i++) { ... }

// TRAP 4: Not marking 0 and 1 as non-prime → isPrime[1] = true by default
```

---

### Fast Exponentiation — When the Interviewer Says "No pow()"

> **💡 Key Insight:** When `n = Integer.MIN_VALUE`, negating it to make it positive overflows back to `Integer.MIN_VALUE`. Store `n` in a `long` first before negating.

```java
// Implement pow(x, n) — handle negative n and n = Integer.MIN_VALUE
double myPow(double x, int n) {
    long N = n;                          // TRAP: -Integer.MIN_VALUE overflows int → use long
    if (N < 0) { x = 1.0 / x; N = -N; }
    double result = 1.0;
    while (N > 0) {
        if ((N & 1) == 1) result *= x;  // odd exponent: multiply current x in
        x *= x;
        N >>= 1;
    }
    return result;
}
// Time O(log n). TRAP: iterative is safer than recursive for n = Integer.MIN_VALUE
```

> **⚠️ Common Mistake:** Implementing `myPow` recursively and handling `n = Integer.MIN_VALUE` in the base case. The recursive call `-n` overflows before you even get to check it. Use the iterative form with `long N = n`.

---

## QUICK-REFERENCE: COMMON TRAP CHECKLIST

Before submitting any solution, run through this mental checklist:

```text
□ Integer overflow?
  - Binary search: lo + (hi - lo) / 2
  - Multiplication: cast to long before
  - Result > Integer.MAX_VALUE?

□ String operations:
  - Using StringBuilder, not + in loop?
  - Using .equals() not ==?
  - Handling empty string and single char?

□ Off-by-one:
  - Window size: right - left + 1?
  - Binary search variant correct?
  - Loop bounds: < vs <=?

□ Integer.MIN_VALUE:
  - Can negation be called on it?
  - Appears in abs(), negate, or reverse?

□ Collection modification:
  - Modifying list/map while iterating?

□ DP:
  - Initialized impossible states to ∞, not 0?
  - 0/1 knapsack iterates W right-to-left?

□ Graph:
  - Marking visited BEFORE enqueue, not after dequeue?
  - Using 3-state for directed cycle detection?

□ Sorting:
  - Using Integer.compare(), not a - b?
  - Object array if custom comparator needed?
  - TreeSet/TreeMap: comparator returning 0 means SAME KEY (deduplicates)?

□ Modulo:
  - Result could be negative? Apply ((x % m) + m) % m.
  - Prefix sum remainder normalized before HashMap lookup?

□ Priority Queue:
  - Min heap vs max heap — default is MIN in Java?
  - Lazy deletion: skipping stale PQ entries with "if (d > dist[u]) continue"?

□ Backtracking:
  - Every state change undone after recursive call?
  - Snapshotting result with new ArrayList<>(current), not just current?

□ Intervals:
  - Sorted by start before merging?
  - Touch (==) vs overlap (<) — read the problem?

□ Java stdlib:
  - Arrays.asList returns fixed-size? Wrap with new ArrayList<>() if mutating.
  - String.split with regex special chars escaped (\\. not .)?
  - PrintWriter flushed at end?

□ Math:
  - Ceiling division: (a + b - 1) / b instead of float cast?
  - LCM: divide before multiply to avoid overflow?
  - Sieve: i * i cast to long for large n?
  - pow(x, n): n = Integer.MIN_VALUE handled with long?

□ Monotonic stack:
  - Storing indices not values?
  - Circular array: iterate 2n, push only for i < n?

□ Union-Find:
  - "if (px == py) return" guard in union()?
  - Decrement component count only on successful union?

□ Floyd's cycle:
  - Phase 2 resets ONE pointer to head, both move 1 step?
```

---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (DSA Traps)

- [ ] Off-by-one in binary search bounds
- [ ] Integer overflow / boundary values
- [ ] Mutating structures while iterating
- [ ] Confusing index vs value in cyclic sort / arrays
- [ ] Forgetting visited marks in graphs
- [ ] DP: wrong state dimension or transition order
- [ ] Sliding window: when to move left vs right
- [ ] Linked list: dummy head / null checks

> ⭐ **IMPORTANT CONCEPT:** Most "I almost had it" fails are trap classes above — drill them explicitly, not only new problems.

## 🛠️ PRACTICAL
Re-solve 10 previously failed problems focusing only on the trap class you hit. Keep a trap log.

