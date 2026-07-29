# Low Level Design — Complete FAANG Study Reference

> Audience: 7 years of experience. Starts from first principles, goes to full working implementations.
> Everything you need with no internet for 3 months.

---

## Table of Contents

> ⭐ **IMPORTANT CONCEPT:** Great LLD starts with requirements + entities + variation points (interfaces) before writing classes.
1. [SOLID Principles](#1-solid-principles)
   - [Single Responsibility Principle (SRP)](#11-single-responsibility-principle-srp)
   - [Open/Closed Principle (OCP)](#12-openclosed-principle-ocp)
   - [Liskov Substitution Principle (LSP)](#13-liskov-substitution-principle-lsp)
   - [Interface Segregation Principle (ISP)](#14-interface-segregation-principle-isp)
   - [Dependency Inversion Principle (DIP)](#15-dependency-inversion-principle-dip)
2. [Design Patterns](#2-design-patterns)
   - [Creational: Factory Method](#21-factory-method-pattern)
   - [Creational: Builder](#22-builder-pattern)
   - [Creational: Singleton](#23-singleton-pattern)
   - [Structural: Decorator](#24-decorator-pattern)
   - [Structural: Proxy](#25-proxy-pattern)
   - [Structural: Adapter](#26-adapter-pattern)
   - [Behavioral: Observer](#27-observer-pattern)
   - [Behavioral: Strategy](#28-strategy-pattern)
3. [Machine Coding Problems](#3-machine-coding-problems)
   - [Parking Lot System](#31-parking-lot-system)
   - [LRU Cache](#32-lru-cache)
   - [Rate Limiter — Token Bucket](#33-rate-limiter--token-bucket)
   - [Elevator System](#machine-coding-4-elevator-system)
   - [Chess Game](#machine-coding-5-chess-game)
   - [Hotel Booking System](#machine-coding-6-hotel-booking-system)
   - [Notification System](#machine-coding-7-notification-system-lld)
4. [Quick Reference](#quick-reference--pattern-cheat-sheet)
   - [Pattern Cheat Sheet](#quick-reference--pattern-cheat-sheet)
   - [SOLID Quick Reference](#solid-quick-reference)

---

# 1. SOLID Principles

**SOLID** is an acronym for five design principles that make object-oriented code:

| Goal | What it means |
|------|---------------|
| Easy to maintain | Changes are localized — touch one class, not ten |
| Easy to extend | Add new behavior without touching old code |
| Easy to test | Components are decoupled — mock dependencies freely |
| Easy to understand | Each unit has a single, clear purpose |

> **💡 Key Insight:** These are not rules — they are guidelines. Violate them knowingly when the trade-off is worth it. A small script does not need full SOLID compliance; a large system with many contributors does.

---

## 1.1 Single Responsibility Principle (SRP)

> ⭐ **IMPORTANT CONCEPT:** SRP/OCP drive most LLD extensibility answers — isolate what changes.
### Definition

A class should have **only one reason to change**. Equivalently: a class should have only one **job**.

### Why it exists

When a class handles multiple concerns, changes to one concern risk breaking the other. It also makes the class harder to test because you must set up the environment for all concerns even when testing just one.

> **⚠️ Anti-pattern:** A class named `UserService` that validates input, writes to a database, and sends emails has three reasons to change — and three times the bug surface.

> 🌍 **Real-World:** Amazon's order pipeline applies SRP strictly — `OrderValidator`, `InventoryService`, `PaymentService`, and `NotificationService` are separate services (and separate codebases). A change to fraud-detection rules touches only the validation layer, never the fulfillment or shipping code.

### Classic Violation

```java
// BAD: UserService does everything — validation, persistence, AND email
public class UserService {
    public void registerUser(String email, String password) {
        // 1. Validation logic
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password too short");
        }

        // 2. Database persistence
        Connection conn = DriverManager.getConnection("jdbc:mysql://localhost/db", "root", "pass");
        PreparedStatement stmt = conn.prepareStatement("INSERT INTO users (email, password) VALUES (?, ?)");
        stmt.setString(1, email);
        stmt.setString(2, hashPassword(password));
        stmt.executeUpdate();

        // 3. Email notification
        Properties props = new Properties();
        props.put("mail.smtp.host", "smtp.gmail.com");
        Session session = Session.getInstance(props);
        Message msg = new MimeMessage(session);
        msg.setRecipient(Message.RecipientType.TO, new InternetAddress(email));
        msg.setSubject("Welcome!");
        msg.setText("Thanks for registering.");
        Transport.send(msg);
    }

    private String hashPassword(String password) {
        return BCrypt.hashpw(password, BCrypt.gensalt());
    }
}

// Problem: if the email provider changes (Gmail -> SendGrid), you must change UserService.
// Problem: if the DB schema changes, you must change UserService.
// Problem: to test registerUser(), you need a live DB AND a live email server.
```

> **💡 Key Insight:** The tell-tale smell is the word "AND" in the class description. If you say "this class validates users AND saves them AND sends emails," SRP is violated.

### Correct Version — Separated Concerns

```java
// Each class has exactly one reason to change.

// CONCERN 1: Validation
public class UserValidator {
    public void validate(String email, String password) {
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Invalid email: " + email);
        }
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
    }
}

// CONCERN 2: Persistence — changes if DB changes
public class UserRepository {
    private final DataSource dataSource;

    public UserRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void save(User user) throws SQLException {
        String sql = "INSERT INTO users (email, password_hash) VALUES (?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, user.getEmail());
            stmt.setString(2, user.getPasswordHash());
            stmt.executeUpdate();
        }
    }
}

// CONCERN 3: Email — changes if email provider changes
public class UserEmailService {
    private final EmailClient emailClient;

    public UserEmailService(EmailClient emailClient) {
        this.emailClient = emailClient;
    }

    public void sendWelcomeEmail(User user) {
        emailClient.send(
            user.getEmail(),
            "Welcome to our platform!",
            "Thanks for registering, " + user.getEmail()
        );
    }
}

// CONCERN 4: Orchestration — changes if the registration FLOW changes
public class UserRegistrationService {
    private final UserValidator validator;
    private final UserRepository userRepository;
    private final UserEmailService emailService;
    private final PasswordHasher passwordHasher;

    public UserRegistrationService(
            UserValidator validator,
            UserRepository userRepository,
            UserEmailService emailService,
            PasswordHasher passwordHasher) {
        this.validator = validator;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.passwordHasher = passwordHasher;
    }

    public void register(String email, String rawPassword) throws SQLException {
        validator.validate(email, rawPassword);
        String hash = passwordHasher.hash(rawPassword);
        User user = new User(email, hash);
        userRepository.save(user);
        emailService.sendWelcomeEmail(user);
    }
}

// Supporting types
public class User {
    private final String email;
    private final String passwordHash;

    public User(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
}

public interface EmailClient {
    void send(String to, String subject, String body);
}

public interface PasswordHasher {
    String hash(String rawPassword);
}

// Now:
// - Change email provider? Only UserEmailService changes.
// - Change DB schema? Only UserRepository changes.
// - Change validation rules? Only UserValidator changes.
// - Testing registerUser()? Mock all three dependencies — no live DB or email needed.
```

---

## 1.2 Open/Closed Principle (OCP)

### Definition

Software entities (classes, modules, functions) should be **open for extension, but closed for modification**. Add new behavior by writing new code, not by editing existing code.

### Why it exists

Every time you modify existing, tested code to add a new feature, you risk introducing regressions. OCP lets you add features safely by writing new classes/functions that extend existing behavior.

> **📖 Real-World Example:** A payment processor that uses a `switch` on payment type must be edited — and retested — every time a new payment method (Crypto, BNPL, UPI) is added. OCP solves this by making each payment method its own class.

> **⚠️ Anti-pattern:** Any method containing `if (type.equals("VISA")) ... else if (type.equals("MASTERCARD")) ...` that must be edited to add a new type violates OCP.

> 🌍 **Real-World:** Shopify's payment gateway integration uses OCP — each payment provider (Stripe, Braintree, PayPal) is a separate class implementing a common `PaymentProvider` interface. Adding a new provider like Klarna means writing one new class; the checkout flow that calls `provider.charge()` is never modified.

### Classic Violation — Switch/If-Else That Grows Forever

```java
// BAD: adding a new payment method requires editing this class
public class PaymentProcessor {
    public void process(String paymentType, double amount) {
        if (paymentType.equals("VISA")) {
            System.out.println("Charging VISA card: $" + amount);
            // VISA-specific API calls...
        } else if (paymentType.equals("MASTERCARD")) {
            System.out.println("Charging Mastercard: $" + amount);
            // Mastercard-specific API calls...
        } else if (paymentType.equals("PAYPAL")) {
            System.out.println("Processing PayPal payment: $" + amount);
            // PayPal API calls...
        }
        // To add CRYPTO: you MUST edit this class — violates OCP.
        // You risk breaking VISA/MASTERCARD logic when adding CRYPTO.
    }
}
```

### Correct Version — Open for Extension

```java
// Step 1: Define the abstraction
public interface PaymentStrategy {
    boolean process(long amountCents);  // returns success/failure
    String getPaymentMethodName();
}

// Step 2: Concrete implementations — each in its own class, never modified
public class VisaPaymentStrategy implements PaymentStrategy {
    private final String cardToken;

    public VisaPaymentStrategy(String cardToken) {
        this.cardToken = cardToken;
    }

    @Override
    public boolean process(long amountCents) {
        System.out.println("[VISA] Charging card token=" + cardToken + " amount=" + amountCents + " cents");
        // call Visa API...
        return true;
    }

    @Override
    public String getPaymentMethodName() { return "VISA"; }
}

public class PayPalPaymentStrategy implements PaymentStrategy {
    private final String accountEmail;

    public PayPalPaymentStrategy(String accountEmail) {
        this.accountEmail = accountEmail;
    }

    @Override
    public boolean process(long amountCents) {
        System.out.println("[PAYPAL] Charging account=" + accountEmail + " amount=" + amountCents + " cents");
        // call PayPal API...
        return true;
    }

    @Override
    public String getPaymentMethodName() { return "PAYPAL"; }
}

// Step 3: Closed for modification — PaymentProcessor never changes
public class PaymentProcessor {
    public PaymentResult process(PaymentStrategy strategy, long amountCents) {
        boolean success = strategy.process(amountCents);
        return new PaymentResult(
            strategy.getPaymentMethodName(),
            amountCents,
            success ? "SUCCESS" : "FAILED"
        );
    }
}

// Step 4: Adding CRYPTO? Write a new class. Touch NOTHING existing.
public class CryptoPaymentStrategy implements PaymentStrategy {
    private final String walletAddress;
    private final String cryptoCurrency;

    public CryptoPaymentStrategy(String walletAddress, String cryptoCurrency) {
        this.walletAddress = walletAddress;
        this.cryptoCurrency = cryptoCurrency;
    }

    @Override
    public boolean process(long amountCents) {
        System.out.println("[CRYPTO:" + cryptoCurrency + "] Sending to wallet=" + walletAddress);
        // call blockchain API...
        return true;
    }

    @Override
    public String getPaymentMethodName() { return "CRYPTO_" + cryptoCurrency; }
}

// Supporting type
public class PaymentResult {
    public final String method;
    public final long amountCents;
    public final String status;

    public PaymentResult(String method, long amountCents, String status) {
        this.method = method;
        this.amountCents = amountCents;
        this.status = status;
    }
}

// Usage
class Main {
    public static void main(String[] args) {
        PaymentProcessor processor = new PaymentProcessor();

        PaymentResult r1 = processor.process(new VisaPaymentStrategy("tok_visa_4242"), 5000);
        PaymentResult r2 = processor.process(new PayPalPaymentStrategy("alice@example.com"), 9900);
        PaymentResult r3 = processor.process(new CryptoPaymentStrategy("0xABC123", "ETH"), 100000);

        System.out.println(r1.status + " | " + r2.status + " | " + r3.status);
    }
}
```

---

## 1.3 Liskov Substitution Principle (LSP)

### Definition

If S is a subtype of T, then objects of type T may be replaced with objects of type S without altering the correctness of the program.

In plain English: **a subclass must be usable wherever its parent class is used, with no surprises**.

### Why it exists

Inheritance enables **polymorphism**. If LSP is violated, you can't trust polymorphism — you need `instanceof` checks and special-casing, which defeats the purpose of OOP.

> **⚠️ Anti-pattern:** If you find yourself writing `if (shape instanceof Square)` to handle a subclass differently, LSP is broken.

> 🌍 **Real-World:** Java's `LinkedList` violates LSP in practice — it implements `List` but `get(index)` is O(n), breaking the implicit performance contract that callers of `List` expect from `ArrayList`. Google's Guava library addresses this with `ImmutableList`, which makes immutability an explicit part of the type rather than an `UnsupportedOperationException` surprise.

### Classic Violation — Rectangle / Square

Mathematically, a square IS a rectangle. Intuitively, inheritance seems right. But it breaks LSP:

```java
// VIOLATION
public class Rectangle {
    protected int width;
    protected int height;

    public void setWidth(int width)   { this.width = width; }
    public void setHeight(int height) { this.height = height; }
    public int getWidth()  { return width; }
    public int getHeight() { return height; }
    public int area()      { return width * height; }
}

public class Square extends Rectangle {
    // A square must have equal sides, so override both setters
    @Override
    public void setWidth(int side) {
        this.width = side;
        this.height = side;  // SURPRISE: also changes height!
    }

    @Override
    public void setHeight(int side) {
        this.width = side;   // SURPRISE: also changes width!
        this.height = side;
    }
}

// Test that passes for Rectangle but FAILS for Square
public class AreaCalculator {
    public void testArea(Rectangle r) {
        r.setWidth(5);
        r.setHeight(3);
        // Any reasonable person expects: area = 5 * 3 = 15
        assert r.area() == 15 : "Expected 15 but got " + r.area();
        // With Square: setHeight(3) also sets width=3 → area = 9. ASSERTION FAILS!
    }
}

// This breaks: you cannot substitute Square where Rectangle is expected
// → LSP violated
```

### Why the violation happens

The **contract** of `setWidth()` in `Rectangle` is: "changes only the width, leaves height unchanged." `Square` violates this contract by changing height too. The subclass weakens the guarantees of the parent.

> **💡 Key Insight:** The problem is not inheritance itself — it is using inheritance to model a *mathematical* relationship (square IS-A rectangle) that does not hold in the *behavioral* sense. Prefer composition or shared interfaces over deep inheritance hierarchies.

### Fix — Use a Shape Abstraction

```java
// Don't model a has-equal-sides constraint through inheritance.
// Model shapes through a shared interface with no setters.

public interface Shape {
    double area();
    double perimeter();
}

// Rectangle is a standalone class — immutable, no surprises
public final class Rectangle implements Shape {
    private final double width;
    private final double height;

    public Rectangle(double width, double height) {
        if (width <= 0 || height <= 0) throw new IllegalArgumentException("Dimensions must be positive");
        this.width = width;
        this.height = height;
    }

    @Override
    public double area() { return width * height; }

    @Override
    public double perimeter() { return 2 * (width + height); }

    // If you need mutation, return a new instance (immutable style)
    public Rectangle withWidth(double newWidth)   { return new Rectangle(newWidth, this.height); }
    public Rectangle withHeight(double newHeight) { return new Rectangle(this.width, newHeight); }
}

// Square is a standalone class — also no surprises
public final class Square implements Shape {
    private final double side;

    public Square(double side) {
        if (side <= 0) throw new IllegalArgumentException("Side must be positive");
        this.side = side;
    }

    @Override
    public double area() { return side * side; }

    @Override
    public double perimeter() { return 4 * side; }
}

// Now both are substitutable for Shape:
public class ShapeCalculator {
    public double totalArea(List<Shape> shapes) {
        return shapes.stream().mapToDouble(Shape::area).sum();
    }
}

// Works correctly for any Shape — LSP satisfied
class LSPDemo {
    public static void main(String[] args) {
        List<Shape> shapes = List.of(
            new Rectangle(5, 3),   // area = 15
            new Square(4),         // area = 16
            new Rectangle(2, 7)    // area = 14
        );
        ShapeCalculator calc = new ShapeCalculator();
        System.out.println("Total area: " + calc.totalArea(shapes)); // 45.0
    }
}
```

### LSP Rules to Internalize

| Rule | Explanation |
|------|-------------|
| **Preconditions cannot be strengthened** | Subclass method must accept at least what parent accepts |
| **Postconditions cannot be weakened** | Subclass method must deliver at least what parent promises |
| **Invariants must be preserved** | Subclass must maintain the same invariants as the parent |
| **Exception rule** | Subclass cannot throw new checked exceptions not declared by parent |

> **💡 Key Insight:** Design by contract — think of every method as having a pre-condition (what it requires) and a post-condition (what it guarantees). Subclasses may only relax pre-conditions and tighten post-conditions, never the reverse.

---

## 1.4 Interface Segregation Principle (ISP)

### Definition

Clients should not be forced to depend on interfaces they do not use. Many **specific** interfaces are better than one general-purpose **fat** interface.

### Why it exists

A fat interface forces implementors to provide stub implementations for methods they don't need. This creates noise, confusion, and potential bugs (what does `eat()` return for a `Robot`?).

> **⚠️ Anti-pattern:** Any interface method that throws `UnsupportedOperationException` in an implementor is an ISP violation — the implementor was forced to implement something it doesn't support.

> 🌍 **Real-World:** Spring Data splits its repository hierarchy using ISP — `CrudRepository` provides basic save/find/delete, `PagingAndSortingRepository` adds pagination, and `JpaRepository` adds batch operations. A read-only reporting service depends only on `CrudRepository`, so it can never accidentally call a `deleteAll()` that exists only in `JpaRepository`.

### Classic Violation — Fat Worker Interface

```java
// BAD: one fat interface
public interface Worker {
    void work();
    void eat();
    void sleep();
}

// Human can implement all three
public class HumanWorker implements Worker {
    @Override public void work()  { System.out.println("Human working..."); }
    @Override public void eat()   { System.out.println("Human eating lunch..."); }
    @Override public void sleep() { System.out.println("Human sleeping..."); }
}

// Robot CANNOT eat or sleep — but MUST implement these methods
// This is an ISP violation: RobotWorker is forced to depend on eat() and sleep()
public class RobotWorker implements Worker {
    @Override public void work()  { System.out.println("Robot working 24/7"); }
    @Override public void eat()   { throw new UnsupportedOperationException("Robots don't eat!"); }
    @Override public void sleep() { throw new UnsupportedOperationException("Robots don't sleep!"); }
}
```

### Correct Version — Segregated Interfaces

```java
// Each interface has a single, coherent purpose
public interface Workable {
    void work();
}

public interface Eatable {
    void eat();
}

public interface Sleepable {
    void sleep();
}

// Human needs all three
public class HumanWorker implements Workable, Eatable, Sleepable {
    @Override public void work()  { System.out.println("Human working..."); }
    @Override public void eat()   { System.out.println("Human eating lunch..."); }
    @Override public void sleep() { System.out.println("Human going home to sleep..."); }
}

// Robot only needs Workable — no stubs, no UnsupportedOperationException
public class RobotWorker implements Workable {
    @Override public void work() { System.out.println("Robot working at full capacity..."); }
}

// Client code depends only on the interface it needs
public class WorkManager {
    private final List<Workable> workers = new ArrayList<>();

    public void addWorker(Workable worker) { workers.add(worker); }

    public void startWork() {
        workers.forEach(Workable::work);
    }
}

public class BreakManager {
    private final List<Eatable> eaters = new ArrayList<>();

    public void addEater(Eatable eater) { eaters.add(eater); }

    public void lunchBreak() {
        eaters.forEach(Eatable::eat);
    }
}

class ISPDemo {
    public static void main(String[] args) {
        HumanWorker alice = new HumanWorker();
        RobotWorker r2d2  = new RobotWorker();

        WorkManager workManager = new WorkManager();
        workManager.addWorker(alice);
        workManager.addWorker(r2d2);  // Robot qualifies as Workable
        workManager.startWork();

        BreakManager breakManager = new BreakManager();
        breakManager.addEater(alice); // Only Alice eats
        // breakManager.addEater(r2d2); — compile error: RobotWorker doesn't implement Eatable
        breakManager.lunchBreak();
    }
}
```

> **📖 Real-World Example:** Java's `Iterable`, `Comparable`, and `Closeable` are each a single-method interface. The JDK deliberately keeps them small so classes can implement only what they truly support.

### Real-World ISP Example — Repository Pattern

```java
// Fat repository — not every client needs all operations
public interface UserRepository {
    User findById(long id);
    List<User> findAll();
    List<User> findByEmail(String email);
    void save(User user);
    void update(User user);
    void delete(long id);
    long count();
    boolean existsByEmail(String email);
}

// Segregated — clients depend only on what they use
public interface UserReadRepository {
    Optional<User> findById(long id);
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
}

public interface UserWriteRepository {
    User save(User user);
    void update(User user);
    void deleteById(long id);
}

// Read service only needs reads — can't accidentally call delete()
public class UserQueryService {
    private final UserReadRepository repo;
    public UserQueryService(UserReadRepository repo) { this.repo = repo; }
    public Optional<User> getUserProfile(long id) { return repo.findById(id); }
}

// Write service handles mutations
public class UserCommandService {
    private final UserWriteRepository repo;
    public UserCommandService(UserWriteRepository repo) { this.repo = repo; }
    public User createUser(String email, String passwordHash) {
        return repo.save(new User(email, passwordHash));
    }
}

// Concrete implementation can implement both
public class JpaUserRepository implements UserReadRepository, UserWriteRepository {
    // ... JPA implementation
    @Override public Optional<User> findById(long id)          { return Optional.empty(); /* JPA */ }
    @Override public Optional<User> findByEmail(String email)  { return Optional.empty(); /* JPA */ }
    @Override public boolean existsByEmail(String email)       { return false; /* JPA */ }
    @Override public User save(User user)                      { return user; /* JPA */ }
    @Override public void update(User user)                    { /* JPA */ }
    @Override public void deleteById(long id)                  { /* JPA */ }
}
```

---

## 1.5 Dependency Inversion Principle (DIP)

### Definition

1. **High-level modules** should not depend on **low-level modules**. Both should depend on **abstractions**.
2. **Abstractions** should not depend on details. Details (concrete implementations) should depend on abstractions.

### Why it exists

When high-level business logic directly instantiates low-level infrastructure (DB, email, HTTP client), you:

- Cannot test the business logic without the infrastructure running
- Cannot swap the infrastructure without editing the business class
- Create a deployment coupling: business logic must change if you change the DB vendor

> **💡 Key Insight:** "Inversion" means flipping the dependency arrow. Instead of `UserService → MySQLRepository`, both point to an abstraction: `UserService → UserRepository ← MySQLRepository`. The high-level module now controls the contract.

> **📖 Real-World Example:** Spring Boot's `@Autowired` and `@Bean` configuration is the canonical DIP implementation at scale — business services declare interface dependencies; the DI container wires concrete implementations at startup.

> 🌍 **Real-World:** Netflix's microservices use DIP throughout — a `RecommendationService` declares a dependency on a `ContentRepository` interface, and the DI framework (Guice internally, or Spring) injects either the real Cassandra-backed repository in production or an in-memory stub during testing. The business logic has never had a `import com.netflix.cassandra.*` statement.

### Classic Violation

```java
// BAD: UserService directly creates its dependency
public class UserService {
    // Tight coupling: UserService KNOWS it uses MySQL
    // Cannot test without a MySQL database running
    // Cannot swap to PostgreSQL without editing UserService
    private MySQLUserRepository repository = new MySQLUserRepository(
        "jdbc:mysql://localhost:3306/users",
        "root",
        "password123"
    );

    public User getUserById(long id) {
        return repository.findById(id);
    }

    public void createUser(String email, String passwordHash) {
        User user = new User(email, passwordHash);
        repository.save(user);
    }
}

// Concrete low-level module
public class MySQLUserRepository {
    private final String url, username, password;
    public MySQLUserRepository(String url, String username, String password) {
        this.url = url; this.username = username; this.password = password;
    }
    public User findById(long id) { /* MySQL query */ return null; }
    public void save(User user)   { /* MySQL insert */ }
}
```

### Correct Version — Depend on Abstractions

```java
// Step 1: Define the abstraction (interface)
// Both high-level and low-level modules depend on THIS, not on each other
public interface UserRepository {
    Optional<User> findById(long id);
    Optional<User> findByEmail(String email);
    User save(User user);
    void deleteById(long id);
}

// Step 2: High-level module depends on the abstraction, not any concrete class
public class UserService {
    private final UserRepository userRepository; // interface, not MySQLUserRepository

    // Dependency is INJECTED — constructor injection is the gold standard
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getUserById(long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new UserNotFoundException("User not found: " + id));
    }

    public User createUser(String email, String passwordHash) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Email already registered: " + email);
        }
        return userRepository.save(new User(email, passwordHash));
    }
}

// Step 3: Low-level modules implement the abstraction
public class MySQLUserRepository implements UserRepository {
    private final DataSource dataSource;

    public MySQLUserRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Optional<User> findById(long id) {
        String sql = "SELECT id, email, password_hash FROM users WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setLong(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return Optional.of(new User(rs.getLong("id"), rs.getString("email"), rs.getString("password_hash")));
            }
        } catch (SQLException e) {
            throw new RepositoryException("DB error fetching user " + id, e);
        }
        return Optional.empty();
    }

    @Override
    public Optional<User> findByEmail(String email) {
        // Similar SQL query...
        return Optional.empty();
    }

    @Override
    public User save(User user) {
        String sql = "INSERT INTO users (email, password_hash) VALUES (?, ?) RETURNING id";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement stmt = conn.prepareStatement(sql)) {
            stmt.setString(1, user.getEmail());
            stmt.setString(2, user.getPasswordHash());
            ResultSet rs = stmt.executeQuery();
            rs.next();
            return new User(rs.getLong("id"), user.getEmail(), user.getPasswordHash());
        } catch (SQLException e) {
            throw new RepositoryException("DB error saving user", e);
        }
    }

    @Override
    public void deleteById(long id) {
        // SQL DELETE...
    }
}

// Step 4: Easy to swap — PostgreSQL implementation, same interface
public class PostgreSQLUserRepository implements UserRepository {
    // Different SQL dialect, same contract
    @Override public Optional<User> findById(long id) { return Optional.empty(); /* Postgres query */ }
    @Override public Optional<User> findByEmail(String email) { return Optional.empty(); }
    @Override public User save(User user) { return user; }
    @Override public void deleteById(long id) {}
}

// Step 5: Easy to test — in-memory implementation, no DB needed
public class InMemoryUserRepository implements UserRepository {
    private final Map<Long, User> store = new HashMap<>();
    private long idCounter = 1;

    @Override
    public Optional<User> findById(long id) {
        return Optional.ofNullable(store.get(id));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return store.values().stream()
            .filter(u -> u.getEmail().equals(email))
            .findFirst();
    }

    @Override
    public User save(User user) {
        long id = idCounter++;
        User saved = new User(id, user.getEmail(), user.getPasswordHash());
        store.put(id, saved);
        return saved;
    }

    @Override
    public void deleteById(long id) { store.remove(id); }
}

// Step 6: Wiring (in main or DI container)
class ApplicationBootstrap {
    public static void main(String[] args) {
        // Production
        DataSource mysqlDS = createMySQLDataSource();
        UserRepository repository = new MySQLUserRepository(mysqlDS);
        UserService userService = new UserService(repository);

        // Test (no DB needed)
        UserRepository testRepo = new InMemoryUserRepository();
        UserService testService = new UserService(testRepo);
    }

    private static DataSource createMySQLDataSource() {
        // HikariCP, etc.
        return null; // placeholder
    }
}

// Custom exceptions
class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) { super(message); }
}

class RepositoryException extends RuntimeException {
    public RepositoryException(String message, Throwable cause) { super(message, cause); }
}
```

> **⚠️ Anti-pattern:** `private MySQLUserRepository repository = new MySQLUserRepository(...)` inside a business class is a DIP violation — the high-level module hard-codes the low-level concrete class.

### DIP and Testing — The Real Payoff

```java
// Unit test for UserService — zero infrastructure required
class UserServiceTest {
    private InMemoryUserRepository repository;
    private UserService userService;

    @BeforeEach
    void setUp() {
        repository = new InMemoryUserRepository();
        userService = new UserService(repository);
    }

    @Test
    void shouldCreateUser() {
        User created = userService.createUser("alice@example.com", "hashed_password");
        assertNotNull(created.getId());
        assertEquals("alice@example.com", created.getEmail());
    }

    @Test
    void shouldThrowWhenEmailAlreadyRegistered() {
        userService.createUser("alice@example.com", "hash1");
        assertThrows(IllegalArgumentException.class,
            () -> userService.createUser("alice@example.com", "hash2"));
    }

    @Test
    void shouldThrowWhenUserNotFound() {
        assertThrows(UserNotFoundException.class,
            () -> userService.getUserById(999L));
    }
}
```

---

# 2. Design Patterns

**Design patterns** are proven solutions to recurring design problems. They are a vocabulary, not a recipe — apply them when the problem matches, not by default.

| Family | Concern | Patterns Covered |
|--------|---------|-----------------|
| **Creational** | How objects are created | Factory Method, Builder, Singleton |
| **Structural** | How objects are composed | Decorator, Proxy, Adapter |
| **Behavioral** | How objects communicate | Observer, Strategy |

> **💡 Key Insight:** Do not force a pattern onto a problem. Patterns emerge naturally when you follow SOLID — if you find yourself with a switch/if-else that grows, OCP points you to Strategy or Factory. If you need to add behavior without subclassing, Decorator appears.

---

## 2.1 Factory Method Pattern

> ⭐ **IMPORTANT CONCEPT:** Factory/Strategy/Observer cover the majority of FAANG LLD pattern questions.
### Problem

A class needs to create objects, but the exact type of object to create depends on context or subclass. The **creator** should not be tightly coupled to the **product's** concrete class.

### When to use

- When you don't know at compile time which class to instantiate
- When subclasses should control what gets created
- When you want to centralize creation logic and prevent `new ConcreteType()` scattered throughout client code

### Structure

```text
AbstractCreator
  + createProduct() — abstract factory method
  + doWork() — uses createProduct()

ConcreteCreatorA  extends AbstractCreator
  + createProduct() → returns ConcreteProductA

ConcreteCreatorB  extends AbstractCreator
  + createProduct() → returns ConcreteProductB
```

> **📖 Real-World Example:** `DriverManager.getConnection()` in JDBC is a static factory method — the caller specifies a JDBC URL and the factory decides which `Driver` implementation to instantiate (MySQL, PostgreSQL, H2).

> 🌍 **Real-World:** SLF4J's `LoggerFactory.getLogger(MyClass.class)` is a static factory method — the caller never instantiates `Log4jLogger` or `LogbackLogger` directly. The factory inspects the classpath at runtime and returns the appropriate concrete implementation, letting you swap logging backends by changing a single dependency in `pom.xml`.

### Full Implementation — Logger Factory

```java
import java.io.*;
import java.time.Instant;

// Product interface
public interface Logger {
    void log(String level, String message);
    void close();
}

// Concrete products
public class ConsoleLogger implements Logger {
    private final String appName;

    public ConsoleLogger(String appName) {
        this.appName = appName;
    }

    @Override
    public void log(String level, String message) {
        System.out.printf("[%s] [%s] [%s] %s%n", Instant.now(), appName, level, message);
    }

    @Override
    public void close() { /* nothing to close */ }
}

public class FileLogger implements Logger {
    private final PrintWriter writer;
    private final String appName;

    public FileLogger(String appName, String filePath) throws IOException {
        this.appName = appName;
        this.writer = new PrintWriter(new FileWriter(filePath, true)); // append mode
    }

    @Override
    public void log(String level, String message) {
        writer.printf("[%s] [%s] [%s] %s%n", Instant.now(), appName, level, message);
        writer.flush();
    }

    @Override
    public void close() { writer.close(); }
}

public class DatabaseLogger implements Logger {
    private final String appName;
    private final String jdbcUrl;
    // In real impl: DataSource, PreparedStatement cache

    public DatabaseLogger(String appName, String jdbcUrl) {
        this.appName = appName;
        this.jdbcUrl = jdbcUrl;
        System.out.println("DatabaseLogger connected to " + jdbcUrl);
    }

    @Override
    public void log(String level, String message) {
        // INSERT INTO app_logs (app, level, message, ts) VALUES (?, ?, ?, ?)
        System.out.printf("[DB-LOG] app=%s level=%s msg=%s%n", appName, level, message);
    }

    @Override
    public void close() { /* close DB connection */ }
}

// Abstract creator — defines the factory method
public abstract class Application {
    private final String appName;
    protected Logger logger; // created by subclass

    protected Application(String appName) {
        this.appName = appName;
        this.logger = createLogger(); // call factory method during construction
    }

    // THE factory method — subclasses override to decide which Logger to create
    protected abstract Logger createLogger();

    public void run() {
        logger.log("INFO", appName + " starting up...");
        doWork();
        logger.log("INFO", appName + " shutting down.");
        logger.close();
    }

    protected abstract void doWork();
}

// Concrete creators
public class ConsoleApplication extends Application {
    public ConsoleApplication(String appName) { super(appName); }

    @Override
    protected Logger createLogger() {
        return new ConsoleLogger(appName());
    }

    @Override
    protected void doWork() {
        logger.log("DEBUG", "Processing batch job...");
        logger.log("INFO",  "Batch job complete.");
    }

    private String appName() { return "ConsoleApp"; }
}

public class FileApplication extends Application {
    private final String logPath;

    public FileApplication(String appName, String logPath) {
        // Note: logPath stored before super() would be tricky — see pattern note below
        this.logPath = logPath;
        // In practice, initialize lazily or pass config object
    }

    @Override
    protected Logger createLogger() {
        try {
            return new FileLogger("FileApp", logPath != null ? logPath : "/tmp/app.log");
        } catch (IOException e) {
            throw new RuntimeException("Failed to create file logger", e);
        }
    }

    @Override
    protected void doWork() {
        logger.log("INFO", "Writing results to file...");
    }
}

// Static factory variant — simpler, no inheritance needed
public class LoggerFactory {
    public enum LoggerType { CONSOLE, FILE, DATABASE }

    public static Logger create(LoggerType type, String appName, String destination) {
        switch (type) {
            case CONSOLE:  return new ConsoleLogger(appName);
            case FILE:
                try { return new FileLogger(appName, destination); }
                catch (IOException e) { throw new RuntimeException(e); }
            case DATABASE: return new DatabaseLogger(appName, destination);
            default: throw new IllegalArgumentException("Unknown logger type: " + type);
        }
    }
}

// Usage
class FactoryMethodDemo {
    public static void main(String[] args) {
        // Using static factory
        Logger consoleLogger = LoggerFactory.create(LoggerFactory.LoggerType.CONSOLE, "MyApp", null);
        Logger fileLogger    = LoggerFactory.create(LoggerFactory.LoggerType.FILE,    "MyApp", "/tmp/myapp.log");
        Logger dbLogger      = LoggerFactory.create(LoggerFactory.LoggerType.DATABASE,"MyApp", "jdbc:mysql://localhost/logs");

        consoleLogger.log("INFO", "Hello from console");
        fileLogger.log("WARN",   "Disk space low");
        dbLogger.log("ERROR",    "Database connection timeout");

        fileLogger.close();
        dbLogger.close();
    }
}
```

---

## 2.2 Builder Pattern

### Problem

Constructors with many optional parameters become unreadable and error-prone. This is known as the **telescoping constructor anti-pattern**:

```java
// Telescoping constructor anti-pattern
new HttpRequest("https://api.example.com", "POST", headers, body, 3000, true, 3, "gzip")
// What does 'true' mean? What's the 3rd positional arg? Which is timeout vs retries?
```

> **⚠️ Anti-pattern:** Positional constructor arguments with 4+ parameters are a maintenance hazard — callers must remember argument order, and adding a new optional parameter forces changes at every call site.

### When to use

- Objects with 4+ parameters, especially optional ones
- When you want **immutable** objects with readable construction
- When the construction process involves cross-field validation

> **📖 Real-World Example:** `OkHttpClient.Builder`, `Retrofit.Builder`, `AlertDialog.Builder` in Android, and `ProcessBuilder` in the JDK are all canonical Builder pattern usages.

> 🌍 **Real-World:** Elasticsearch's Java client uses the Builder pattern for every query — `new SearchRequest.Builder().index("products").query(q -> q.match(m -> m.field("name").query("laptop"))).size(10).build()`. This makes it impossible to create a malformed query object and allows the client to add new optional DSL fields without breaking existing call sites.

### Full Implementation — HTTP Request Builder

```java
import java.util.*;

public final class HttpRequest {
    // All fields are final — object is immutable after construction
    private final String url;
    private final String method;
    private final Map<String, String> headers;
    private final String body;
    private final int timeoutMs;
    private final boolean followRedirects;
    private final int maxRetries;

    // Private constructor — only Builder can call this
    private HttpRequest(Builder builder) {
        // Validation happens here, not in the builder setters
        if (builder.url == null || builder.url.isEmpty()) {
            throw new IllegalArgumentException("URL is required");
        }
        this.url             = builder.url;
        this.method          = builder.method;
        this.headers         = Collections.unmodifiableMap(new HashMap<>(builder.headers));
        this.body            = builder.body;
        this.timeoutMs       = builder.timeoutMs;
        this.followRedirects = builder.followRedirects;
        this.maxRetries      = builder.maxRetries;
    }

    // Getters — no setters (immutable)
    public String getUrl()              { return url; }
    public String getMethod()           { return method; }
    public Map<String, String> getHeaders() { return headers; }
    public Optional<String> getBody()   { return Optional.ofNullable(body); }
    public int getTimeoutMs()           { return timeoutMs; }
    public boolean isFollowRedirects()  { return followRedirects; }
    public int getMaxRetries()          { return maxRetries; }

    @Override
    public String toString() {
        return String.format("HttpRequest{method=%s, url=%s, timeout=%dms, retries=%d, body=%s}",
            method, url, timeoutMs, maxRetries, body != null ? body : "<none>");
    }

    // Static nested Builder class
    public static class Builder {
        // Required fields
        private final String url;

        // Optional fields with sensible defaults
        private String method          = "GET";
        private Map<String, String> headers = new LinkedHashMap<>();
        private String body            = null;
        private int timeoutMs          = 5_000;
        private boolean followRedirects = true;
        private int maxRetries         = 0;

        public Builder(String url) {
            this.url = url;
        }

        public Builder method(String method) {
            this.method = method.toUpperCase();
            return this;  // return this for chaining
        }

        public Builder header(String name, String value) {
            this.headers.put(name, value);
            return this;
        }

        public Builder contentType(String contentType) {
            return header("Content-Type", contentType);
        }

        public Builder authorization(String scheme, String token) {
            return header("Authorization", scheme + " " + token);
        }

        public Builder body(String body) {
            this.body = body;
            return this;
        }

        public Builder jsonBody(String json) {
            this.body = json;
            return contentType("application/json");
        }

        public Builder timeoutMs(int ms) {
            if (ms <= 0) throw new IllegalArgumentException("Timeout must be positive");
            this.timeoutMs = ms;
            return this;
        }

        public Builder followRedirects(boolean follow) {
            this.followRedirects = follow;
            return this;
        }

        public Builder maxRetries(int retries) {
            if (retries < 0) throw new IllegalArgumentException("Retries cannot be negative");
            this.maxRetries = retries;
            return this;
        }

        // Terminal operation — creates the immutable object
        public HttpRequest build() {
            // Cross-field validation
            if (body != null && method.equals("GET")) {
                System.out.println("Warning: GET request has a body. This is unusual.");
            }
            return new HttpRequest(this);
        }
    }
}

class BuilderDemo {
    public static void main(String[] args) {
        // Simple GET
        HttpRequest getReq = new HttpRequest.Builder("https://api.example.com/users/42")
            .build();
        System.out.println(getReq);

        // Complex POST
        HttpRequest postReq = new HttpRequest.Builder("https://api.example.com/users")
            .method("POST")
            .authorization("Bearer", "eyJhbGciOiJIUzI1NiJ9.token")
            .header("X-Request-ID", UUID.randomUUID().toString())
            .jsonBody("{\"name\": \"Alice\", \"email\": \"alice@example.com\"}")
            .timeoutMs(3_000)
            .maxRetries(3)
            .followRedirects(false)
            .build();
        System.out.println(postReq);

        // The builder is reusable — create a "template" builder
        HttpRequest.Builder apiBuilder = new HttpRequest.Builder("https://api.example.com")
            .authorization("Bearer", "global-token")
            .header("Accept", "application/json")
            .timeoutMs(10_000);

        // Create multiple requests from the template (each .build() creates a new immutable object)
        HttpRequest req1 = new HttpRequest.Builder("https://api.example.com/orders")
            .method("GET")
            .build();
        HttpRequest req2 = new HttpRequest.Builder("https://api.example.com/products")
            .method("GET")
            .build();
    }
}
```

---

## 2.3 Singleton Pattern

### Problem

Some resources should exist **only once per JVM**: database connection pool, configuration, thread pool. Multiple instances would waste resources or cause inconsistency.

> 🌍 **Real-World:** HikariCP (the default connection pool in Spring Boot) is a Singleton — one pool instance is created at application startup and shared by every thread. It uses an enum-style initialization to guarantee exactly one pool regardless of how many Spring beans request it. Destroying and recreating it on every request would exhaust database connections within seconds under load.

### Thread-Safety is the Core Challenge

Creating a singleton correctly in a multi-threaded JVM is non-trivial. Here are all approaches, from best to worst:

| Approach | Thread-Safe | Lazy | Reflection-Safe | Serialization-Safe |
|----------|-------------|------|-----------------|--------------------|
| **Enum** | Yes (JVM) | No | Yes | Yes |
| **Holder (Bill Pugh)** | Yes (JVM) | Yes | No | No (needs `readResolve`) |
| **Double-Checked Locking** | Yes (with `volatile`) | Yes | No | No |
| **Eager static final** | Yes | No | No | No |

> **⚠️ Anti-pattern:** Calling `Singleton.getInstance()` directly inside business logic couples the class to the singleton and makes it untestable. Prefer constructor injection (DIP) — inject the single instance once at the composition root.

```java
import java.sql.Connection;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicInteger;

// ============================================================
// OPTION 1: Enum Singleton — THE BEST APPROACH
// ============================================================
// Pros: Thread-safe by JVM spec, serialization-safe (enum values are singletons by spec),
//       reflection-safe (cannot call constructor via reflection on enum)
// Cons: Cannot be lazy (initialized at class load), cannot extend another class

public enum DatabaseConnectionPool {
    INSTANCE;

    private final String jdbcUrl;
    private final int maxPoolSize;
    private final AtomicInteger activeConnections = new AtomicInteger(0);

    // Enum constructor — called exactly once by the JVM
    DatabaseConnectionPool() {
        this.jdbcUrl      = System.getProperty("db.url", "jdbc:mysql://localhost:3306/app");
        this.maxPoolSize  = Integer.parseInt(System.getProperty("db.pool.size", "10"));
        System.out.println("DatabaseConnectionPool initialized: " + jdbcUrl);
    }

    public Connection getConnection() {
        if (activeConnections.get() >= maxPoolSize) {
            throw new RuntimeException("Connection pool exhausted (max=" + maxPoolSize + ")");
        }
        activeConnections.incrementAndGet();
        System.out.println("Borrowing connection. Active: " + activeConnections.get());
        return null; // placeholder for actual connection
    }

    public void releaseConnection(Connection conn) {
        activeConnections.decrementAndGet();
        System.out.println("Released connection. Active: " + activeConnections.get());
    }

    public int getActiveConnectionCount() { return activeConnections.get(); }
}

// Usage
class DatabaseClient {
    public void query(String sql) {
        Connection conn = DatabaseConnectionPool.INSTANCE.getConnection();
        try {
            System.out.println("Executing: " + sql);
        } finally {
            DatabaseConnectionPool.INSTANCE.releaseConnection(conn);
        }
    }
}


// ============================================================
// OPTION 2: Initialization-on-Demand Holder (Bill Pugh Singleton)
// ============================================================
// Pros: Lazy initialization (class loaded only on first call to getInstance()),
//       thread-safe (JVM guarantees class initialization is atomic),
//       no synchronization overhead on subsequent calls
// Cons: Cannot pass arguments to constructor

public class ConfigurationManager {
    private final Properties config;

    // Private constructor
    private ConfigurationManager() {
        config = new Properties();
        // Load from file, env vars, etc.
        config.setProperty("app.name",    System.getProperty("app.name",    "MyApp"));
        config.setProperty("app.version", System.getProperty("app.version", "1.0.0"));
        config.setProperty("env",         System.getProperty("env",         "development"));
        System.out.println("ConfigurationManager loaded");
    }

    // Inner class not loaded by JVM until first call to getInstance()
    private static class SingletonHolder {
        // JVM guarantees this line runs exactly once, atomically
        private static final ConfigurationManager INSTANCE = new ConfigurationManager();
    }

    public static ConfigurationManager getInstance() {
        return SingletonHolder.INSTANCE; // triggers class loading of SingletonHolder if not yet loaded
    }

    public String get(String key) {
        return config.getProperty(key);
    }

    public String get(String key, String defaultValue) {
        return config.getProperty(key, defaultValue);
    }
}


// ============================================================
// OPTION 3: Double-Checked Locking (DCL) — educational
// ============================================================
// Pros: Lazy, reduces synchronization overhead (lock only on first creation)
// Cons: REQUIRES volatile — without it, JVM instruction reordering can give
//       another thread a reference to a partially-constructed object.
//       Only correct since Java 5 (JSR-133 memory model fix)

public class ServiceRegistry {
    // volatile: ensures write to 'instance' is visible to all threads,
    //           and prevents reordering of constructor call with reference assignment
    private static volatile ServiceRegistry instance;

    private final Map<String, Object> services = new ConcurrentHashMap<>();

    private ServiceRegistry() {
        System.out.println("ServiceRegistry created");
    }

    public static ServiceRegistry getInstance() {
        if (instance == null) {                       // First check — no lock (fast path)
            synchronized (ServiceRegistry.class) {
                if (instance == null) {               // Second check — with lock (slow path, once)
                    instance = new ServiceRegistry();
                }
            }
        }
        return instance; // After first creation, always takes fast path
    }

    public void register(String name, Object service) {
        services.put(name, service);
    }

    @SuppressWarnings("unchecked")
    public <T> T lookup(String name) {
        return (T) services.get(name);
    }
}


// ============================================================
// OPTION 4: Eager initialization — simplest when lazy is not needed
// ============================================================
// Pros: Thread-safe (static final initialized at class load), very simple
// Cons: Not lazy — initialized even if never used

public class ThreadPoolManager {
    // Instance created when class is loaded, before any getInstance() call
    private static final ThreadPoolManager INSTANCE = new ThreadPoolManager();

    private final java.util.concurrent.ExecutorService pool;

    private ThreadPoolManager() {
        int cores = Runtime.getRuntime().availableProcessors();
        pool = java.util.concurrent.Executors.newFixedThreadPool(cores);
        System.out.println("ThreadPoolManager created with " + cores + " threads");
    }

    public static ThreadPoolManager getInstance() { return INSTANCE; }

    public void submit(Runnable task) { pool.submit(task); }

    public void shutdown() { pool.shutdown(); }
}


// Demo
class SingletonDemo {
    public static void main(String[] args) {
        // Enum singleton
        DatabaseConnectionPool.INSTANCE.getConnection();

        // Holder singleton (lazy)
        ConfigurationManager config = ConfigurationManager.getInstance();
        System.out.println("App: " + config.get("app.name"));

        // DCL singleton
        ServiceRegistry.getInstance().register("userService", new Object());

        // Verify it's really a singleton
        assert ConfigurationManager.getInstance() == ConfigurationManager.getInstance();
        System.out.println("Same instance: " + (ConfigurationManager.getInstance() == ConfigurationManager.getInstance()));
    }
}
```

### When NOT to Use Singleton

> **⚠️ Anti-pattern:** Avoid Singleton when:
> - You need different instances with different configurations (e.g., two DB connections)
> - Testability matters — singletons make mocking hard; prefer constructor injection (DIP)
> - You might need multiple instances later (e.g., multi-tenancy, connection to multiple DBs)

> **💡 Key Insight:** Prefer injecting dependencies via constructor (DIP) over calling `getInstance()` everywhere. The singleton is still a singleton — you just create it once at the application root and inject it everywhere else.

---

## 2.4 Decorator Pattern

### Problem

Add responsibilities to objects **dynamically** without modifying their class, and without the combinatorial explosion of inheritance.

### Why not inheritance?

If you have 3 behaviors (Timestamp, Encryption, Compression), you'd need 2³ = 8 subclasses for every combination. **Decorators** let you compose at runtime: `new Timestamp(new Encryption(new Compression(baseLogger)))`.

> **💡 Key Insight:** The Decorator pattern requires the wrapper and the wrapped object to share the same interface. This is what allows transparent substitution — clients cannot tell whether they are talking to the real object or a stack of decorators.

> **📖 Real-World Example:** Java's entire `java.io` library uses Decorator. `new BufferedReader(new InputStreamReader(new GZIPInputStream(new FileInputStream("data.gz"))))` is four decorators stacked around a single file reader.

> 🌍 **Real-World:** AWS SDK's HTTP client stack uses the Decorator pattern — each interceptor (retry logic, request signing with SigV4, GZIP compression, metrics collection) wraps the previous one. You can add a custom interceptor that logs every outbound request without touching the signing or retry code.

### Full Implementation — Logger Decorator Chain

```java
import java.time.Instant;
import java.util.zip.GZIPOutputStream;
import java.io.*;
import java.util.Base64;

// Component interface — both base component and decorators implement this
public interface Logger {
    void log(String level, String message);
}

// Concrete component — the "real" implementation
public class ConsoleLogger implements Logger {
    @Override
    public void log(String level, String message) {
        System.out.printf("[%s] %s%n", level, message);
    }
}

// Abstract decorator — implements Logger, wraps a Logger
// Key: stores a reference to the wrapped component
public abstract class LoggerDecorator implements Logger {
    protected final Logger wrapped;

    protected LoggerDecorator(Logger wrapped) {
        if (wrapped == null) throw new IllegalArgumentException("Wrapped logger cannot be null");
        this.wrapped = wrapped;
    }
}

// Concrete decorator 1: adds timestamp
public class TimestampDecorator extends LoggerDecorator {
    public TimestampDecorator(Logger wrapped) { super(wrapped); }

    @Override
    public void log(String level, String message) {
        String timestamped = "[" + Instant.now() + "] " + message;
        wrapped.log(level, timestamped); // delegate to wrapped, with modified message
    }
}

// Concrete decorator 2: adds log level filtering
public class LevelFilterDecorator extends LoggerDecorator {
    private final int minLevel;
    private static final Map<String, Integer> LEVELS = Map.of(
        "DEBUG", 0, "INFO", 1, "WARN", 2, "ERROR", 3
    );

    public LevelFilterDecorator(Logger wrapped, String minLevel) {
        super(wrapped);
        this.minLevel = LEVELS.getOrDefault(minLevel.toUpperCase(), 0);
    }

    @Override
    public void log(String level, String message) {
        int msgLevel = LEVELS.getOrDefault(level.toUpperCase(), 0);
        if (msgLevel >= minLevel) {
            wrapped.log(level, message); // pass through if level is sufficient
        }
        // else: silently drop
    }
}

// Concrete decorator 3: adds a prefix/context
public class ContextDecorator extends LoggerDecorator {
    private final String context;

    public ContextDecorator(Logger wrapped, String context) {
        super(wrapped);
        this.context = context;
    }

    @Override
    public void log(String level, String message) {
        wrapped.log(level, "[" + context + "] " + message);
    }
}

// Concrete decorator 4: async logging (fire and forget)
public class AsyncDecorator extends LoggerDecorator {
    private final java.util.concurrent.ExecutorService executor =
        java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "async-logger");
            t.setDaemon(true); // don't prevent JVM shutdown
            return t;
        });

    public AsyncDecorator(Logger wrapped) { super(wrapped); }

    @Override
    public void log(String level, String message) {
        executor.submit(() -> wrapped.log(level, message)); // non-blocking
    }
}

class DecoratorDemo {
    public static void main(String[] args) throws InterruptedException {
        // Build up a chain of decorators
        // Order matters: outermost decorator runs first

        Logger logger = new TimestampDecorator(
                            new ContextDecorator(
                                new LevelFilterDecorator(
                                    new ConsoleLogger(),
                                    "INFO"  // only INFO and above
                                ),
                                "OrderService"
                            )
                        );

        logger.log("DEBUG", "This will be filtered out");     // dropped by LevelFilter
        logger.log("INFO",  "Order created: ORD-001");         // printed
        logger.log("WARN",  "Payment retrying...");            // printed
        logger.log("ERROR", "Payment failed after 3 retries"); // printed

        // Execution flow for INFO message:
        // TimestampDecorator.log() → prepends timestamp → calls ContextDecorator.log()
        // ContextDecorator.log()   → prepends [OrderService] → calls LevelFilterDecorator.log()
        // LevelFilterDecorator.log() → INFO >= INFO, passes through → calls ConsoleLogger.log()
        // ConsoleLogger.log()      → prints to stdout

        // Async variant
        Logger asyncLogger = new AsyncDecorator(
                                 new TimestampDecorator(
                                     new ConsoleLogger()
                                 )
                             );
        asyncLogger.log("INFO", "This logs asynchronously");
        Thread.sleep(100); // wait for async thread
    }
}
```

### Real-World Decorator Example — Java I/O

The Java I/O library is the canonical example of the Decorator pattern in the JDK:

```java
// Reading a gzipped, buffered file — four decorators stacked:
Reader reader = new BufferedReader(          // Decorator: adds buffering
                    new InputStreamReader(   // Decorator: handles charset decoding
                        new GZIPInputStream( // Decorator: handles decompression
                            new FileInputStream("data.gz") // Component: reads bytes from file
                        )
                    )
                );
```

---

## 2.5 Proxy Pattern

### Problem

You need to control access to an object, add behavior around it (caching, logging, access control), or represent a remote/expensive object locally — without changing the object's interface.

> **💡 Key Insight:** Proxy and Decorator look identical in structure — both implement the same interface and wrap another object. The difference is *intent*: a **Decorator** adds behavior; a **Proxy** controls access.

### Types of Proxies

| Type | Purpose | Example |
|------|---------|---------|
| **Virtual Proxy** | Defer expensive initialization until needed | Image proxy loading thumbnail first |
| **Protection Proxy** | Access control based on permissions | Admin-only method guard |
| **Cache Proxy** | Memoize results | Cache DB query results |
| **Remote Proxy** | Represent a remote object locally | gRPC stub, RMI |
| **Logging Proxy** | Log all method calls transparently | Audit trail |

> **📖 Real-World Example:** Spring's `@Transactional` is implemented via a proxy — Spring wraps your `@Service` bean in a proxy that begins a transaction before your method and commits/rolls back after. Your code never knows it is running inside a proxy.

> 🌍 **Real-World:** Hibernate's lazy loading uses a Virtual Proxy — when you load a `User` entity with a `List<Order>` relationship, Hibernate returns a proxy object for the orders collection. The actual SQL query only fires when your code first calls `user.getOrders().size()`, deferring the expensive join until it's truly needed.

### Full Implementation — Cache Proxy + Protection Proxy

```java
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

// Common interface
public interface UserRepository {
    Optional<User> findById(long id);
    Optional<User> findByEmail(String email);
    User save(User user);
}

// Real subject
public class DatabaseUserRepository implements UserRepository {
    @Override
    public Optional<User> findById(long id) {
        System.out.println("[DB] Querying user by id=" + id);
        // Simulate slow DB query
        try { Thread.sleep(50); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        return Optional.of(new User(id, "user" + id + "@example.com", "hash"));
    }

    @Override
    public Optional<User> findByEmail(String email) {
        System.out.println("[DB] Querying user by email=" + email);
        return Optional.empty(); // simplified
    }

    @Override
    public User save(User user) {
        System.out.println("[DB] Saving user " + user.getEmail());
        return user;
    }
}

// Cache Proxy — transparent to the caller
public class CachingUserRepository implements UserRepository {
    private final UserRepository delegate;
    private final Map<Long, User> idCache     = new ConcurrentHashMap<>();
    private final Map<String, User> emailCache = new ConcurrentHashMap<>();

    public CachingUserRepository(UserRepository delegate) {
        this.delegate = delegate;
    }

    @Override
    public Optional<User> findById(long id) {
        // Check cache first
        User cached = idCache.get(id);
        if (cached != null) {
            System.out.println("[CACHE HIT] user id=" + id);
            return Optional.of(cached);
        }
        // Cache miss: delegate to real repo
        Optional<User> result = delegate.findById(id);
        result.ifPresent(u -> idCache.put(id, u)); // populate cache
        return result;
    }

    @Override
    public Optional<User> findByEmail(String email) {
        User cached = emailCache.get(email);
        if (cached != null) {
            System.out.println("[CACHE HIT] user email=" + email);
            return Optional.of(cached);
        }
        Optional<User> result = delegate.findByEmail(email);
        result.ifPresent(u -> emailCache.put(email, u));
        return result;
    }

    @Override
    public User save(User user) {
        User saved = delegate.save(user);
        // Invalidate or update cache on write
        idCache.remove(saved.getId());
        emailCache.remove(saved.getEmail());
        return saved;
    }

    public void invalidateAll() {
        idCache.clear();
        emailCache.clear();
    }
}

// Protection Proxy — guards access based on user roles
public class ProtectedUserRepository implements UserRepository {
    private final UserRepository delegate;
    private final SecurityContext securityContext;

    public ProtectedUserRepository(UserRepository delegate, SecurityContext securityContext) {
        this.delegate = delegate;
        this.securityContext = securityContext;
    }

    @Override
    public Optional<User> findById(long id) {
        // Any authenticated user can read
        requireAuthenticated();
        return delegate.findById(id);
    }

    @Override
    public Optional<User> findByEmail(String email) {
        requireAuthenticated();
        return delegate.findByEmail(email);
    }

    @Override
    public User save(User user) {
        // Only admins can create users
        requireRole("ADMIN");
        return delegate.save(user);
    }

    private void requireAuthenticated() {
        if (!securityContext.isAuthenticated()) {
            throw new SecurityException("Authentication required");
        }
    }

    private void requireRole(String role) {
        requireAuthenticated();
        if (!securityContext.hasRole(role)) {
            throw new SecurityException("Role required: " + role);
        }
    }
}

// Supporting types
public interface SecurityContext {
    boolean isAuthenticated();
    boolean hasRole(String role);
}

class ProxyDemo {
    public static void main(String[] args) {
        // Build proxy chain: CachingProxy → DatabaseRepository
        UserRepository db    = new DatabaseUserRepository();
        UserRepository cache = new CachingUserRepository(db);

        System.out.println("--- First call (cache miss, hits DB) ---");
        cache.findById(1L);

        System.out.println("\n--- Second call (cache hit, no DB) ---");
        cache.findById(1L);

        System.out.println("\n--- Third call, different ID (cache miss) ---");
        cache.findById(2L);
    }
}
```

---

## 2.6 Adapter Pattern

### Problem

You have an existing class (or third-party library) with an **incompatible interface**. You cannot modify it (legacy system, external library), but you need it to work with your code.

### Analogy

A US-to-EU power adapter. The US plug (**adaptee**) goes into the adapter; the adapter fits into a EU socket (**target interface**). The appliance doesn't change; the socket doesn't change. Only the adapter is new.

> **💡 Key Insight:** The Adapter converts the interface, not the behavior. All business logic stays in the adaptee; the adapter is pure translation code.

> **📖 Real-World Example:** `Arrays.asList()` is an adapter between arrays and the `List` interface. `InputStreamReader` is an adapter between byte streams (`InputStream`) and character streams (`Reader`).

> 🌍 **Real-World:** Twilio's helper libraries are Adapters — they translate Twilio's REST API (which speaks HTTP with XML/JSON) into native Java/Python method calls. `TwilioRestClient.messages.create(to, from, body)` adapts the raw HTTP POST with `MessagingServiceSid` fields into a clean domain method, so callers never format a URL or parse a response body.

### Full Implementation — Adapting Legacy Payment + Analytics System

```java
// ============================================================
// Scenario: New system expects ModernPaymentGateway.
// Legacy system has LegacyPaymentSystem — incompatible API.
// Cannot modify LegacyPaymentSystem (external vendor SDK).
// ============================================================

// TARGET interface — what our code expects
public interface ModernPaymentGateway {
    PaymentResponse charge(ChargeRequest request);
    RefundResponse refund(String transactionId, long amountCents);
}

public class ChargeRequest {
    public final String cardToken;
    public final long amountCents;
    public final String currency;
    public final String description;

    public ChargeRequest(String cardToken, long amountCents, String currency, String description) {
        this.cardToken   = cardToken;
        this.amountCents = amountCents;
        this.currency    = currency;
        this.description = description;
    }
}

public class PaymentResponse {
    public final String transactionId;
    public final String status; // "SUCCESS" or "FAILED"
    public final String errorMessage;

    public PaymentResponse(String transactionId, String status, String errorMessage) {
        this.transactionId = transactionId;
        this.status = status;
        this.errorMessage = errorMessage;
    }
}

public class RefundResponse {
    public final boolean success;
    public final String refundId;
    public RefundResponse(boolean success, String refundId) {
        this.success = success;
        this.refundId = refundId;
    }
}

// ADAPTEE — legacy third-party class, cannot modify
public class LegacyPaymentSystem {
    // Completely different API signatures
    public String initiateCharge(double amount, String currencyCode, String creditCardToken, String memo) {
        // Returns a legacy transaction code like "TXN-12345" or null on failure
        System.out.println("[LEGACY] Charging " + amount + " " + currencyCode);
        return "TXN-" + System.currentTimeMillis();
    }

    public boolean voidTransaction(String txnCode, double refundAmount) {
        System.out.println("[LEGACY] Voiding txn=" + txnCode + " amount=" + refundAmount);
        return true;
    }
}

// ADAPTER — bridges LegacyPaymentSystem to ModernPaymentGateway
public class LegacyPaymentAdapter implements ModernPaymentGateway {
    private final LegacyPaymentSystem legacySystem;

    public LegacyPaymentAdapter(LegacyPaymentSystem legacySystem) {
        this.legacySystem = legacySystem;
    }

    @Override
    public PaymentResponse charge(ChargeRequest request) {
        // Adapt: convert amountCents (long) to amount (double)
        double amount = request.amountCents / 100.0;

        // Call legacy API with adapted parameters
        String txnCode = legacySystem.initiateCharge(
            amount,
            request.currency,
            request.cardToken,
            request.description
        );

        // Adapt: convert legacy response (String | null) to PaymentResponse
        if (txnCode != null && txnCode.startsWith("TXN-")) {
            return new PaymentResponse(txnCode, "SUCCESS", null);
        } else {
            return new PaymentResponse(null, "FAILED", "Legacy system returned null transaction code");
        }
    }

    @Override
    public RefundResponse refund(String transactionId, long amountCents) {
        double amount = amountCents / 100.0;
        boolean success = legacySystem.voidTransaction(transactionId, amount);
        String refundId = success ? "REF-" + System.currentTimeMillis() : null;
        return new RefundResponse(success, refundId);
    }
}

// Client code — only knows about ModernPaymentGateway
public class OrderService {
    private final ModernPaymentGateway paymentGateway;

    public OrderService(ModernPaymentGateway paymentGateway) {
        this.paymentGateway = paymentGateway;
    }

    public void checkout(String cardToken, long amountCents) {
        ChargeRequest req = new ChargeRequest(cardToken, amountCents, "USD", "Order payment");
        PaymentResponse resp = paymentGateway.charge(req);
        if ("SUCCESS".equals(resp.status)) {
            System.out.println("Payment successful. TxnId: " + resp.transactionId);
        } else {
            System.out.println("Payment failed: " + resp.errorMessage);
        }
    }
}

class AdapterDemo {
    public static void main(String[] args) {
        LegacyPaymentSystem legacySystem = new LegacyPaymentSystem(); // cannot change
        ModernPaymentGateway gateway = new LegacyPaymentAdapter(legacySystem); // adapter!

        OrderService orderService = new OrderService(gateway);
        orderService.checkout("tok_visa_4242", 4999L); // $49.99

        // Later, if you get a real modern payment provider, swap the adapter:
        // ModernPaymentGateway gateway = new StripePaymentGateway(apiKey);
        // OrderService orderService = new OrderService(gateway); // OrderService unchanged!
    }
}
```

---

## 2.7 Observer Pattern

### Problem

When one object's state changes, multiple other objects need to be notified — but the **subject** shouldn't be tightly coupled to every **observer**.

### Push vs Pull Model

| Model | How it works | Trade-off |
|-------|-------------|-----------|
| **Push** | Subject sends the changed data in the notification | Simple, but observers receive data they may not need |
| **Pull** | Subject notifies "something changed"; observers pull what they care about | Flexible, but requires an extra round-trip call |

### Thread Safety Note

> **💡 Key Insight:** Use `CopyOnWriteArrayList` for the subscriber list — it creates a snapshot for iteration, so adding/removing subscribers during notification doesn't cause `ConcurrentModificationException` and doesn't require locking during the notify loop.

> **⚠️ Anti-pattern:** Never let one listener's exception kill the notification loop. Always wrap each `listener.onEvent(e)` call in a try-catch — a failing email notification should never prevent inventory from being updated.

> **📖 Real-World Example:** Kafka is a distributed Observer pattern. Producers (subjects) publish events to topics; consumers (observers) subscribe to topics. The broker decouples producers from consumers completely.

> 🌍 **Real-World:** Uber's dispatch system uses the Observer pattern — when a driver's GPS position updates, multiple observers react independently: the ETA calculator updates arrival times, the map renderer moves the car icon, and the surge pricing engine recalculates zone demand. The GPS event producer knows nothing about any of these consumers.

### Full Implementation — Order Event System

```java
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

// Event types — use sealed hierarchy for type-safe events
public class OrderEvent {
    public enum Type { PLACED, CANCELLED, SHIPPED, DELIVERED }

    private final String eventId;
    private final Type type;
    private final Order order;
    private final long timestamp;

    public OrderEvent(Type type, Order order) {
        this.eventId   = UUID.randomUUID().toString();
        this.type      = type;
        this.order     = order;
        this.timestamp = System.currentTimeMillis();
    }

    public Type getType()   { return type; }
    public Order getOrder() { return order; }
    public long getTimestamp() { return timestamp; }

    @Override public String toString() {
        return String.format("OrderEvent{type=%s, orderId=%s, ts=%d}", type, order.getId(), timestamp);
    }
}

// Observer interface
public interface OrderEventListener {
    void onEvent(OrderEvent event);
}

// Subject (Publisher) — manages subscribers and publishes events
public class OrderEventPublisher {
    // CopyOnWriteArrayList: safe for concurrent reads and infrequent writes
    // Iteration during publish creates a snapshot → no ConcurrentModificationException
    private final List<OrderEventListener> listeners = new CopyOnWriteArrayList<>();

    public void subscribe(OrderEventListener listener) {
        listeners.add(listener);
        System.out.println("Subscribed: " + listener.getClass().getSimpleName());
    }

    public void unsubscribe(OrderEventListener listener) {
        listeners.remove(listener);
    }

    public void publish(OrderEvent event) {
        System.out.println("Publishing: " + event);
        for (OrderEventListener listener : listeners) {
            try {
                listener.onEvent(event);
            } catch (Exception e) {
                // CRITICAL: never let one listener's failure kill other listeners
                System.err.println("Listener " + listener.getClass().getSimpleName()
                    + " threw exception: " + e.getMessage());
            }
        }
    }
}

// Concrete observers
public class InventoryService implements OrderEventListener {
    @Override
    public void onEvent(OrderEvent event) {
        switch (event.getType()) {
            case PLACED:
                System.out.println("[INVENTORY] Reserving stock for order " + event.getOrder().getId());
                break;
            case CANCELLED:
                System.out.println("[INVENTORY] Releasing reserved stock for order " + event.getOrder().getId());
                break;
            default:
                // No-op for other events
        }
    }
}

public class EmailNotificationService implements OrderEventListener {
    @Override
    public void onEvent(OrderEvent event) {
        String customerEmail = event.getOrder().getCustomerEmail();
        switch (event.getType()) {
            case PLACED:
                System.out.println("[EMAIL] Sending order confirmation to " + customerEmail);
                break;
            case CANCELLED:
                System.out.println("[EMAIL] Sending cancellation notice to " + customerEmail);
                break;
            case SHIPPED:
                System.out.println("[EMAIL] Sending shipping notification to " + customerEmail);
                break;
            case DELIVERED:
                System.out.println("[EMAIL] Sending delivery confirmation to " + customerEmail);
                break;
        }
    }
}

public class AnalyticsService implements OrderEventListener {
    private final Map<OrderEvent.Type, Integer> eventCounts = new ConcurrentHashMap<>();

    @Override
    public void onEvent(OrderEvent event) {
        eventCounts.merge(event.getType(), 1, Integer::sum);
        System.out.println("[ANALYTICS] Recorded event: " + event.getType()
            + " | Total " + event.getType() + " events: " + eventCounts.get(event.getType()));
    }
}

public class FraudDetectionService implements OrderEventListener {
    @Override
    public void onEvent(OrderEvent event) {
        if (event.getType() == OrderEvent.Type.PLACED) {
            if (event.getOrder().getTotalCents() > 100_000) { // > $1000
                System.out.println("[FRAUD] HIGH VALUE ORDER — flagging for review: " + event.getOrder().getId());
            }
        }
    }
}

// Order model
public class Order {
    private final String id;
    private final String customerEmail;
    private final long totalCents;
    private String status;

    public Order(String customerEmail, long totalCents) {
        this.id            = "ORD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        this.customerEmail = customerEmail;
        this.totalCents    = totalCents;
        this.status        = "PENDING";
    }

    public String getId()             { return id; }
    public String getCustomerEmail()  { return customerEmail; }
    public long getTotalCents()       { return totalCents; }
    public String getStatus()         { return status; }
    public void setStatus(String s)   { this.status = s; }
}

// OrderService — uses the publisher
public class OrderService {
    private final OrderEventPublisher publisher;

    public OrderService(OrderEventPublisher publisher) {
        this.publisher = publisher;
    }

    public Order placeOrder(String customerEmail, long amountCents) {
        Order order = new Order(customerEmail, amountCents);
        order.setStatus("ACTIVE");
        publisher.publish(new OrderEvent(OrderEvent.Type.PLACED, order));
        return order;
    }

    public void cancelOrder(Order order) {
        order.setStatus("CANCELLED");
        publisher.publish(new OrderEvent(OrderEvent.Type.CANCELLED, order));
    }

    public void shipOrder(Order order) {
        order.setStatus("SHIPPED");
        publisher.publish(new OrderEvent(OrderEvent.Type.SHIPPED, order));
    }
}

class ObserverDemo {
    public static void main(String[] args) {
        OrderEventPublisher publisher = new OrderEventPublisher();

        // Register all observers
        publisher.subscribe(new InventoryService());
        publisher.subscribe(new EmailNotificationService());
        publisher.subscribe(new AnalyticsService());
        publisher.subscribe(new FraudDetectionService());

        OrderService orderService = new OrderService(publisher);

        System.out.println("\n=== Placing normal order ===");
        Order order1 = orderService.placeOrder("alice@example.com", 4999L); // $49.99

        System.out.println("\n=== Placing high-value order ===");
        Order order2 = orderService.placeOrder("bob@example.com", 150_000L); // $1500

        System.out.println("\n=== Shipping order1 ===");
        orderService.shipOrder(order1);

        System.out.println("\n=== Cancelling order2 ===");
        orderService.cancelOrder(order2);
    }
}
```

---

## 2.8 Strategy Pattern

### Problem

You have an algorithm that can vary. Hardcoding all variants in one class violates OCP and makes the class unwieldy.

### Strategy vs Template Method

| Pattern | Mechanism | Variation point |
|---------|-----------|-----------------|
| **Strategy** | Composition — inject a different object | Entire algorithm swapped at runtime |
| **Template Method** | Inheritance — subclass overrides steps | Individual steps overridden at compile time |

### When to use

- Multiple variants of an algorithm exist (sorting, pricing, routing, compression)
- You want to switch algorithms at runtime
- You want to isolate algorithm-specific logic so each variant is independently testable

> **📖 Real-World Example:** `java.util.Comparator` is a Strategy. `Collections.sort(list, comparator)` accepts any sorting strategy. `Comparator.comparing(Person::getAge)` and `Comparator.comparing(Person::getName)` are two different strategies for the same sort operation.

> **💡 Key Insight:** Strategy is OCP applied to algorithms. Instead of a growing `if-else` block for each pricing rule, each rule becomes its own class — adding a new rule means writing a new class, not editing existing ones.

> 🌍 **Real-World:** Uber Eats' surge pricing engine uses the Strategy pattern — `NoPricingStrategy`, `SurgePricingStrategy`, and `HolidayPricingStrategy` are swapped in based on real-time demand signals. The order service calls `pricingStrategy.calculateFare(trip)` without knowing which strategy is active; the strategy selector changes the injected instance based on city-level demand metrics.

### Full Implementation — E-Commerce Pricing Engine

```java
import java.util.List;

// Context object passed to strategies
public class PricingContext {
    private final double basePrice;
    private final int customerTierLevel; // 0=Regular, 1=Silver, 2=Gold, 3=Platinum
    private final int cartItemCount;
    private final boolean isFirstPurchase;
    private final String promoCode;

    public PricingContext(double basePrice, int customerTierLevel,
                          int cartItemCount, boolean isFirstPurchase, String promoCode) {
        this.basePrice         = basePrice;
        this.customerTierLevel = customerTierLevel;
        this.cartItemCount     = cartItemCount;
        this.isFirstPurchase   = isFirstPurchase;
        this.promoCode         = promoCode;
    }

    public double getBasePrice()       { return basePrice; }
    public int getCustomerTierLevel()  { return customerTierLevel; }
    public int getCartItemCount()      { return cartItemCount; }
    public boolean isFirstPurchase()   { return isFirstPurchase; }
    public String getPromoCode()       { return promoCode; }
}

// Strategy interface
public interface PricingStrategy {
    double calculateFinalPrice(PricingContext context);
    String getStrategyName();
}

// Concrete strategies
public class RegularPricingStrategy implements PricingStrategy {
    @Override
    public double calculateFinalPrice(PricingContext ctx) {
        return ctx.getBasePrice(); // no discount
    }

    @Override
    public String getStrategyName() { return "REGULAR"; }
}

public class TierDiscountStrategy implements PricingStrategy {
    private static final double[] TIER_DISCOUNTS = {0.0, 0.05, 0.10, 0.15}; // 0/5/10/15%

    @Override
    public double calculateFinalPrice(PricingContext ctx) {
        int tier = Math.min(ctx.getCustomerTierLevel(), TIER_DISCOUNTS.length - 1);
        double discount = TIER_DISCOUNTS[tier];
        return ctx.getBasePrice() * (1.0 - discount);
    }

    @Override
    public String getStrategyName() { return "TIER_DISCOUNT"; }
}

public class BulkDiscountStrategy implements PricingStrategy {
    @Override
    public double calculateFinalPrice(PricingContext ctx) {
        double price = ctx.getBasePrice();
        if (ctx.getCartItemCount() >= 10) return price * 0.80;  // 20% off
        if (ctx.getCartItemCount() >= 5)  return price * 0.90;  // 10% off
        return price;
    }

    @Override
    public String getStrategyName() { return "BULK_DISCOUNT"; }
}

public class PromoCodeStrategy implements PricingStrategy {
    private final Map<String, Double> promoCodes = Map.of(
        "SAVE10",   0.10,
        "SAVE20",   0.20,
        "WELCOME",  0.15
    );

    @Override
    public double calculateFinalPrice(PricingContext ctx) {
        if (ctx.getPromoCode() == null) return ctx.getBasePrice();
        Double discount = promoCodes.get(ctx.getPromoCode().toUpperCase());
        if (discount == null) return ctx.getBasePrice();
        return ctx.getBasePrice() * (1.0 - discount);
    }

    @Override
    public String getStrategyName() { return "PROMO_CODE"; }
}

// Composite strategy — applies multiple strategies, takes the best price
public class BestPriceStrategy implements PricingStrategy {
    private final List<PricingStrategy> strategies;

    public BestPriceStrategy(List<PricingStrategy> strategies) {
        this.strategies = strategies;
    }

    @Override
    public double calculateFinalPrice(PricingContext ctx) {
        return strategies.stream()
            .mapToDouble(s -> s.calculateFinalPrice(ctx))
            .min()
            .orElse(ctx.getBasePrice());
    }

    @Override
    public String getStrategyName() { return "BEST_OF_" + strategies.size(); }
}

// Context class — uses the strategy
public class PricingEngine {
    private PricingStrategy strategy;

    public PricingEngine(PricingStrategy strategy) {
        this.strategy = strategy;
    }

    // Can change strategy at runtime
    public void setStrategy(PricingStrategy strategy) {
        this.strategy = strategy;
    }

    public double calculatePrice(PricingContext context) {
        double finalPrice = strategy.calculateFinalPrice(context);
        System.out.printf("[%s] Base: $%.2f → Final: $%.2f%n",
            strategy.getStrategyName(), context.getBasePrice(), finalPrice);
        return finalPrice;
    }
}

class StrategyDemo {
    public static void main(String[] args) {
        // Strategy selection based on context
        PricingEngine engine = new PricingEngine(new RegularPricingStrategy());

        // Regular customer, no promo
        PricingContext ctx1 = new PricingContext(100.00, 0, 1, false, null);
        engine.calculatePrice(ctx1); // $100.00

        // Gold tier customer
        engine.setStrategy(new TierDiscountStrategy());
        PricingContext ctx2 = new PricingContext(100.00, 2, 1, false, null);
        engine.calculatePrice(ctx2); // $90.00 (10% off)

        // Bulk order
        engine.setStrategy(new BulkDiscountStrategy());
        PricingContext ctx3 = new PricingContext(100.00, 0, 7, false, null);
        engine.calculatePrice(ctx3); // $90.00 (10% off for 7 items)

        // Best of multiple strategies
        PricingStrategy bestOf = new BestPriceStrategy(List.of(
            new TierDiscountStrategy(),
            new BulkDiscountStrategy(),
            new PromoCodeStrategy()
        ));
        engine.setStrategy(bestOf);
        PricingContext ctx4 = new PricingContext(100.00, 2, 3, false, "SAVE20");
        engine.calculatePrice(ctx4); // $80.00 (20% from promo, best of 3 strategies)
    }
}
```

---

# 3. Machine Coding Problems

**Machine coding** is a live coding round (45–90 min) where you design and implement a mini-system from scratch. Evaluation criteria:

| Criterion | What interviewers look for |
|-----------|---------------------------|
| **OO Design** | Proper classes, interfaces, inheritance, encapsulation |
| **Code Quality** | Clean, readable, modular — no 200-line methods |
| **Correctness** | Edge cases handled — nulls, empty inputs, boundary values |
| **Thread Safety** | Concurrent access handled where shared mutable state exists |
| **Extensibility** | Easy to add new features without modifying existing classes |

> **💡 Key Insight:** Start with requirements → class diagram → data structures → then code. Never jump to coding without sketching the class structure first. Identify shared mutable state early — that is where synchronization is needed.

---

## 3.1 Parking Lot System

### Requirements

- Multiple levels, each with spots of different types: `MOTORCYCLE`, `CAR`, `TRUCK`
- Park a vehicle, get a **ticket**
- Exit with a ticket, pay based on duration
- Thread-safe — multiple vehicles park/exit concurrently

### Design

```text
ParkingLot
  ├── List<Level>
  └── PricingStrategy

Level
  ├── List<ParkingSpot>
  └── Map<SpotType, Queue<ParkingSpot>> availableSpots

ParkingSpot
  ├── int id, SpotType type, Vehicle occupant

Vehicle (abstract)
  ├── Car
  ├── Motorcycle
  └── Truck

Ticket
  ├── String ticketId, vehiclePlate, int spotId, Instant issuedAt

PricingStrategy (interface)
  ├── HourlyPricing
  └── FlatRatePricing
```

> 🌍 **Real-World:** SpotHero and ParkWhiz model parking lots exactly this way — each garage is a `Facility` with typed `ParkingSpace` slots, a `Reservation` object tied to an entry time, and a `PricingRule` (Strategy) that calculates fees based on duration, vehicle class, and time-of-day. Their APIs return a `ticket_id` on booking and accept it on exit to calculate the charge.

> **💡 Key Insight:** The `availableByType` queue per level gives O(1) spot allocation. The `synchronized` block on `ParkingLevel.park()` ensures atomicity of the check-and-assign operation under concurrency.

### Full Implementation

```java
import java.time.*;
import java.util.*;
import java.util.concurrent.*;

// ===================== ENUMS =====================

enum SpotType {
    MOTORCYCLE,
    COMPACT,  // small cars
    LARGE,    // large cars, SUVs
    TRUCK
}

enum VehicleType { MOTORCYCLE, CAR, TRUCK }

// ===================== VEHICLES =====================

public abstract class Vehicle {
    private final String licensePlate;
    private final VehicleType type;

    protected Vehicle(String licensePlate, VehicleType type) {
        if (licensePlate == null || licensePlate.isBlank()) {
            throw new IllegalArgumentException("License plate required");
        }
        this.licensePlate = licensePlate.toUpperCase();
        this.type = type;
    }

    public String getLicensePlate() { return licensePlate; }
    public VehicleType getType()    { return type; }

    // Each vehicle type knows which spot size it needs
    public abstract SpotType requiredSpotType();

    @Override
    public String toString() {
        return type + "[" + licensePlate + "]";
    }
}

public class Motorcycle extends Vehicle {
    public Motorcycle(String plate) { super(plate, VehicleType.MOTORCYCLE); }
    @Override public SpotType requiredSpotType() { return SpotType.MOTORCYCLE; }
}

public class Car extends Vehicle {
    public Car(String plate) { super(plate, VehicleType.CAR); }
    @Override public SpotType requiredSpotType() { return SpotType.COMPACT; }
}

public class Truck extends Vehicle {
    public Truck(String plate) { super(plate, VehicleType.TRUCK); }
    @Override public SpotType requiredSpotType() { return SpotType.TRUCK; }
}

// ===================== PARKING SPOT =====================

public class ParkingSpot {
    private final int id;
    private final int level;
    private final SpotType type;
    private volatile Vehicle occupant; // volatile for visibility

    public ParkingSpot(int id, int level, SpotType type) {
        this.id    = id;
        this.level = level;
        this.type  = type;
    }

    public int getId()        { return id; }
    public int getLevel()     { return level; }
    public SpotType getType() { return type; }

    public boolean isAvailable() { return occupant == null; }

    // Returns true if successfully parked (CAS-style)
    public synchronized boolean tryPark(Vehicle vehicle) {
        if (occupant != null) return false;
        occupant = vehicle;
        return true;
    }

    // Returns the vehicle that was parked (null if already empty)
    public synchronized Vehicle unpark() {
        Vehicle v = occupant;
        occupant = null;
        return v;
    }

    @Override
    public String toString() {
        return String.format("Spot{id=%d, level=%d, type=%s, available=%b}", id, level, type, isAvailable());
    }
}

// ===================== TICKET =====================

public class Ticket {
    private final String ticketId;
    private final String vehiclePlate;
    private final int spotId;
    private final int levelNumber;
    private final Instant issuedAt;

    public Ticket(String vehiclePlate, int spotId, int levelNumber) {
        this.ticketId     = "TKT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        this.vehiclePlate = vehiclePlate;
        this.spotId       = spotId;
        this.levelNumber  = levelNumber;
        this.issuedAt     = Instant.now();
    }

    public String getTicketId()    { return ticketId; }
    public String getVehiclePlate(){ return vehiclePlate; }
    public int getSpotId()         { return spotId; }
    public int getLevelNumber()    { return levelNumber; }
    public Instant getIssuedAt()   { return issuedAt; }

    public long parkingMinutes() {
        return Duration.between(issuedAt, Instant.now()).toMinutes();
    }

    public long parkingSeconds() { // for testing with short durations
        return Duration.between(issuedAt, Instant.now()).toSeconds();
    }

    @Override
    public String toString() {
        return String.format("Ticket{id=%s, plate=%s, spot=%d, level=%d, issued=%s}",
            ticketId, vehiclePlate, spotId, levelNumber, issuedAt);
    }
}

// ===================== PRICING =====================

public interface PricingStrategy {
    double calculate(long parkingMinutes, SpotType spotType);
    String getDescription();
}

public class HourlyPricingStrategy implements PricingStrategy {
    private final Map<SpotType, Double> hourlyRates;

    public HourlyPricingStrategy(double motorcycleRate, double compactRate,
                                  double largeRate, double truckRate) {
        hourlyRates = new EnumMap<>(SpotType.class);
        hourlyRates.put(SpotType.MOTORCYCLE, motorcycleRate);
        hourlyRates.put(SpotType.COMPACT,    compactRate);
        hourlyRates.put(SpotType.LARGE,      largeRate);
        hourlyRates.put(SpotType.TRUCK,      truckRate);
    }

    @Override
    public double calculate(long parkingMinutes, SpotType spotType) {
        double rate = hourlyRates.getOrDefault(spotType, 5.0);
        double hours = Math.max(1.0, Math.ceil(parkingMinutes / 60.0)); // minimum 1 hour
        return hours * rate;
    }

    @Override
    public String getDescription() { return "Hourly pricing: " + hourlyRates; }
}

public class FlatRatePricingStrategy implements PricingStrategy {
    private final double flatRate;

    public FlatRatePricingStrategy(double flatRate) { this.flatRate = flatRate; }

    @Override
    public double calculate(long parkingMinutes, SpotType spotType) { return flatRate; }

    @Override
    public String getDescription() { return "Flat rate: $" + flatRate; }
}

// ===================== LEVEL =====================

public class ParkingLevel {
    private final int levelNumber;
    private final List<ParkingSpot> allSpots;
    // Available spots by type — LinkedList for O(1) add/remove
    private final Map<SpotType, Queue<ParkingSpot>> availableByType;
    // Spotid → spot for fast lookup during exit
    private final Map<Integer, ParkingSpot> spotById;

    public ParkingLevel(int levelNumber, Map<SpotType, Integer> spotConfig) {
        this.levelNumber    = levelNumber;
        this.allSpots       = new ArrayList<>();
        this.availableByType = new EnumMap<>(SpotType.class);
        this.spotById       = new HashMap<>();

        // Initialize queues for each type
        for (SpotType type : SpotType.values()) {
            availableByType.put(type, new LinkedList<>());
        }

        // Create spots
        int spotId = levelNumber * 10_000; // e.g., level 1 → spots 10000-19999
        for (Map.Entry<SpotType, Integer> entry : spotConfig.entrySet()) {
            SpotType type = entry.getKey();
            int count     = entry.getValue();
            for (int i = 0; i < count; i++) {
                ParkingSpot spot = new ParkingSpot(spotId, levelNumber, type);
                allSpots.add(spot);
                availableByType.get(type).add(spot);
                spotById.put(spotId, spot);
                spotId++;
            }
        }
    }

    // Find an available spot and park the vehicle atomically
    public synchronized Optional<ParkingSpot> park(Vehicle vehicle) {
        Queue<ParkingSpot> available = availableByType.get(vehicle.requiredSpotType());
        while (!available.isEmpty()) {
            ParkingSpot spot = available.poll();
            if (spot.tryPark(vehicle)) {
                return Optional.of(spot);
            }
            // Spot was taken by concurrent thread between poll and tryPark — skip it
        }
        return Optional.empty(); // no spot available
    }

    // Free a spot after vehicle exits
    public synchronized void freeSpot(int spotId) {
        ParkingSpot spot = spotById.get(spotId);
        if (spot != null) {
            spot.unpark();
            availableByType.get(spot.getType()).add(spot);
        }
    }

    public ParkingSpot getSpotById(int spotId) { return spotById.get(spotId); }

    public int getLevelNumber() { return levelNumber; }

    public int getAvailableCount(SpotType type) {
        return availableByType.get(type).size();
    }

    public int getTotalCount(SpotType type) {
        return (int) allSpots.stream().filter(s -> s.getType() == type).count();
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("Level " + levelNumber + " availability:\n");
        for (SpotType type : SpotType.values()) {
            sb.append(String.format("  %-12s: %d/%d available%n",
                type, getAvailableCount(type), getTotalCount(type)));
        }
        return sb.toString();
    }
}

// ===================== PARKING LOT =====================

public class ParkingLot {
    private final String name;
    private final List<ParkingLevel> levels;
    private final PricingStrategy pricingStrategy;
    // ticketId → Ticket for active vehicles
    private final Map<String, Ticket> activeTickets = new ConcurrentHashMap<>();
    // spotId → level mapping for fast exit processing
    private final Map<Integer, ParkingLevel> levelBySpotId = new ConcurrentHashMap<>();

    private ParkingLot(Builder builder) {
        this.name            = builder.name;
        this.levels          = Collections.unmodifiableList(new ArrayList<>(builder.levels));
        this.pricingStrategy = builder.pricingStrategy;

        // Build spotId → level index
        for (ParkingLevel level : levels) {
            for (ParkingSpot spot : level.allSpots) {
                levelBySpotId.put(spot.getId(), level);
            }
        }
    }

    // Park a vehicle — scans levels in order, first available spot wins
    public Optional<Ticket> parkVehicle(Vehicle vehicle) {
        for (ParkingLevel level : levels) {
            Optional<ParkingSpot> spot = level.park(vehicle);
            if (spot.isPresent()) {
                Ticket ticket = new Ticket(
                    vehicle.getLicensePlate(),
                    spot.get().getId(),
                    level.getLevelNumber()
                );
                activeTickets.put(ticket.getTicketId(), ticket);
                System.out.printf("[PARK] %s → %s (Level %d, Spot %d)%n",
                    vehicle, ticket.getTicketId(), level.getLevelNumber(), spot.get().getId());
                return Optional.of(ticket);
            }
        }
        System.out.println("[PARK] FULL — cannot park " + vehicle);
        return Optional.empty();
    }

    // Process vehicle exit — returns fee
    public double exitVehicle(String ticketId) {
        Ticket ticket = activeTickets.remove(ticketId);
        if (ticket == null) {
            throw new IllegalArgumentException("Invalid or already-processed ticket: " + ticketId);
        }

        // Find the level and free the spot
        ParkingLevel level = levelBySpotId.get(ticket.getSpotId());
        if (level == null) {
            throw new IllegalStateException("Cannot find level for spot " + ticket.getSpotId());
        }

        // Find spot type for pricing
        ParkingSpot spot = level.getSpotById(ticket.getSpotId());
        level.freeSpot(ticket.getSpotId());

        long minutes = ticket.parkingMinutes();
        double fee   = pricingStrategy.calculate(minutes, spot.getType());

        System.out.printf("[EXIT] Ticket=%s | Duration=%d min | Fee=$%.2f%n",
            ticketId, minutes, fee);
        return fee;
    }

    public void printAvailability() {
        System.out.println("\n=== " + name + " Availability ===");
        levels.forEach(System.out::println);
    }

    // Builder for ParkingLot
    public static class Builder {
        private String name = "Parking Lot";
        private final List<ParkingLevel> levels = new ArrayList<>();
        private PricingStrategy pricingStrategy = new HourlyPricingStrategy(2, 5, 7, 10);

        public Builder name(String name)          { this.name = name; return this; }
        public Builder addLevel(ParkingLevel lvl)  { levels.add(lvl); return this; }
        public Builder pricing(PricingStrategy ps) { this.pricingStrategy = ps; return this; }

        public ParkingLot build() {
            if (levels.isEmpty()) throw new IllegalStateException("At least one level required");
            return new ParkingLot(this);
        }
    }
}

// ===================== DEMO =====================

class ParkingLotDemo {
    public static void main(String[] args) throws InterruptedException {
        // Build a 3-level parking lot
        Map<SpotType, Integer> level1Config = new EnumMap<>(SpotType.class);
        level1Config.put(SpotType.MOTORCYCLE, 5);
        level1Config.put(SpotType.COMPACT,    10);
        level1Config.put(SpotType.LARGE,      3);
        level1Config.put(SpotType.TRUCK,      2);

        Map<SpotType, Integer> level2Config = new EnumMap<>(SpotType.class);
        level2Config.put(SpotType.MOTORCYCLE, 5);
        level2Config.put(SpotType.COMPACT,    10);
        level2Config.put(SpotType.LARGE,      5);
        level2Config.put(SpotType.TRUCK,      2);

        ParkingLot lot = new ParkingLot.Builder()
            .name("Downtown Parking")
            .addLevel(new ParkingLevel(1, level1Config))
            .addLevel(new ParkingLevel(2, level2Config))
            .pricing(new HourlyPricingStrategy(2.0, 5.0, 7.0, 10.0))
            .build();

        lot.printAvailability();

        // Park vehicles
        Vehicle car1  = new Car("CA-001");
        Vehicle car2  = new Car("CA-002");
        Vehicle moto1 = new Motorcycle("MO-001");
        Vehicle truck = new Truck("TR-001");

        Optional<Ticket> t1 = lot.parkVehicle(car1);
        Optional<Ticket> t2 = lot.parkVehicle(car2);
        Optional<Ticket> t3 = lot.parkVehicle(moto1);
        Optional<Ticket> t4 = lot.parkVehicle(truck);

        lot.printAvailability();

        // Exit after a moment
        Thread.sleep(1000); // sleep 1 second to show non-zero duration

        t1.ifPresent(t -> {
            double fee = lot.exitVehicle(t.getTicketId());
            System.out.println("Car1 paid: $" + fee);
        });

        lot.printAvailability();

        // Concurrent parking stress test
        System.out.println("\n=== Concurrent parking test ===");
        ExecutorService pool = Executors.newFixedThreadPool(10);
        List<Optional<Ticket>> tickets = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < 8; i++) {
            final int num = i;
            pool.submit(() -> {
                Vehicle v = new Car("CONCURRENT-" + num);
                Optional<Ticket> t = lot.parkVehicle(v);
                tickets.add(t);
            });
        }

        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println("Parked " + tickets.stream().filter(Optional::isPresent).count() + " concurrent vehicles");
        lot.printAvailability();
    }
}
```

---

## 3.2 LRU Cache

### Requirements

- `get(key)`: O(1) average, returns value or empty
- `put(key, value)`: O(1) average, evicts **least recently used** item when capacity exceeded
- Thread-safe

### Design

The key insight is combining two data structures:

| Data Structure | Role | Why |
|---------------|------|-----|
| **HashMap** | O(1) key → node lookup | Fast access by key |
| **Doubly Linked List** | Maintains recency order | O(1) insert/remove at any position with `prev` pointer |

```text
HEAD ↔ [MRU node] ↔ ... ↔ [LRU node] ↔ TAIL
```

**Operation logic:**

- `get(key)`: find node via HashMap, move to front, return value
- `put(key)` — key exists: update value, move to front
- `put(key)` — new key, space available: create node, add to front, add to map
- `put(key)` — new key, full: remove LRU (`tail.prev`), remove from map, create new node, add to front

> **💡 Key Insight:** The dummy sentinel `HEAD` and `TAIL` nodes eliminate null-pointer checks on boundary conditions. `addToFront` and `removeNode` never need to check "is this the first/last node?" — the sentinels absorb those edge cases.

### Full Thread-Safe Implementation

```java
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class LRUCache<K, V> {
    private final int capacity;
    private final Map<K, Node<K, V>> map;

    // Dummy sentinel nodes: operations never modify head/tail themselves
    // head.next = MRU node, tail.prev = LRU node
    private final Node<K, V> head;
    private final Node<K, V> tail;

    // ReadWriteLock: multiple concurrent reads, exclusive writes
    // get() updates LRU order → needs write lock
    // put() always writes → needs write lock
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final ReentrantReadWriteLock.WriteLock writeLock = lock.writeLock();

    private static class Node<K, V> {
        K key;
        V value;
        Node<K, V> prev;
        Node<K, V> next;

        Node() {} // sentinel nodes

        Node(K key, V value) {
            this.key   = key;
            this.value = value;
        }
    }

    public LRUCache(int capacity) {
        if (capacity <= 0) throw new IllegalArgumentException("Capacity must be positive: " + capacity);
        this.capacity = capacity;
        this.map      = new HashMap<>(capacity * 2); // avoid rehashing

        // Initialize dummy sentinels
        head = new Node<>();
        tail = new Node<>();
        head.next = tail;
        tail.prev = head;
    }

    /**
     * Returns the value for key, or Optional.empty() if not found.
     * Marks key as most recently used.
     * O(1) time complexity.
     */
    public Optional<V> get(K key) {
        writeLock.lock();
        try {
            Node<K, V> node = map.get(key);
            if (node == null) return Optional.empty();
            moveToFront(node); // update LRU order
            return Optional.of(node.value);
        } finally {
            writeLock.unlock();
        }
    }

    /**
     * Returns the value for key, or a default if not found.
     * Does NOT update LRU order (peek semantics).
     */
    public V getOrDefault(K key, V defaultValue) {
        return get(key).orElse(defaultValue);
    }

    /**
     * Inserts or updates key → value.
     * On capacity overflow, evicts the least recently used key.
     * O(1) time complexity.
     */
    public void put(K key, V value) {
        writeLock.lock();
        try {
            if (map.containsKey(key)) {
                // Update existing node
                Node<K, V> node = map.get(key);
                node.value = value;
                moveToFront(node);
            } else {
                // Evict LRU if at capacity
                if (map.size() >= capacity) {
                    Node<K, V> lru = tail.prev; // least recently used
                    removeNode(lru);
                    map.remove(lru.key);
                }
                // Insert new node at front
                Node<K, V> newNode = new Node<>(key, value);
                addToFront(newNode);
                map.put(key, newNode);
            }
        } finally {
            writeLock.unlock();
        }
    }

    /**
     * Removes key from cache. Returns true if key existed.
     */
    public boolean evict(K key) {
        writeLock.lock();
        try {
            Node<K, V> node = map.remove(key);
            if (node == null) return false;
            removeNode(node);
            return true;
        } finally {
            writeLock.unlock();
        }
    }

    /**
     * Returns current number of entries.
     */
    public int size() {
        writeLock.lock();
        try { return map.size(); }
        finally { writeLock.unlock(); }
    }

    /**
     * Returns true if key exists in cache (does NOT update LRU order).
     */
    public boolean containsKey(K key) {
        writeLock.lock();
        try { return map.containsKey(key); }
        finally { writeLock.unlock(); }
    }

    // ---- Private helpers (called under lock) ----

    private void addToFront(Node<K, V> node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(Node<K, V> node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
        // Help GC
        node.prev = null;
        node.next = null;
    }

    private void moveToFront(Node<K, V> node) {
        // Re-link neighbors
        node.prev.next = node.next;
        node.next.prev = node.prev;
        // Add to front
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    /**
     * Returns keys in order from MRU to LRU (for debugging).
     */
    public List<K> getMRUOrder() {
        writeLock.lock();
        try {
            List<K> order = new ArrayList<>(map.size());
            Node<K, V> curr = head.next;
            while (curr != tail) {
                order.add(curr.key);
                curr = curr.next;
            }
            return order;
        } finally {
            writeLock.unlock();
        }
    }
}

class LRUCacheDemo {
    public static void main(String[] args) {
        LRUCache<Integer, String> cache = new LRUCache<>(3);

        cache.put(1, "one");
        cache.put(2, "two");
        cache.put(3, "three");
        System.out.println("After 3 puts: " + cache.getMRUOrder()); // [3, 2, 1]

        cache.get(1); // access 1 → moves to front
        System.out.println("After get(1): " + cache.getMRUOrder()); // [1, 3, 2]

        cache.put(4, "four"); // capacity exceeded → evict LRU (2)
        System.out.println("After put(4): " + cache.getMRUOrder()); // [4, 1, 3]
        System.out.println("Key 2 present: " + cache.containsKey(2)); // false (evicted)
        System.out.println("Key 3 present: " + cache.containsKey(3)); // true

        cache.put(2, "two-new"); // 2 re-inserted → evict LRU (3)
        System.out.println("After re-insert 2: " + cache.getMRUOrder()); // [2, 4, 1]
        System.out.println("Key 3 present: " + cache.containsKey(3)); // false (evicted)

        // Update existing key
        cache.put(1, "one-updated");
        System.out.println("After update key 1: " + cache.getMRUOrder()); // [1, 2, 4]
        System.out.println("Key 1: " + cache.get(1).orElse("missing")); // one-updated
    }
}
```

> 🌍 **Real-World:** Facebook's `Memcached` fleet is essentially a distributed LRU cache — each slab class (object size bucket) uses an LRU list to evict cold items when memory fills. The same `HashMap + doubly-linked-list` structure runs inside each Memcached instance; the distributed layer adds consistent hashing on top to shard keys across thousands of nodes.

### Complexity Summary

| Operation | Time | Space |
|-----------|------|-------|
| get       | O(1) | —     |
| put       | O(1) | —     |
| evict     | O(1) | —     |
| Total space | — | O(capacity) |

---

## 3.3 Rate Limiter — Token Bucket

### Requirements

- Limit a client to N requests per second
- Allow short **bursts** (token bucket, not fixed window)
- Thread-safe
- Support per-client rate limiting

### Token Bucket Algorithm

| Property | Value |
|----------|-------|
| `capacity` | Maximum tokens the bucket can hold (= max burst size) |
| `refillRate` | Tokens added per second (= sustained throughput limit) |
| Per request | Consume 1 token; if bucket empty, reject |

```text
           capacity=10
            ┌──────┐
tokens  ───→│  10  │───→ refill at 5/sec
            └──────┘
                ↓ consume on each request
         allow if tokens ≥ 1, else reject
```

> **💡 Key Insight:** Token bucket allows bursty traffic up to `capacity` in a short window (a client can fire 10 requests instantly if the bucket is full), unlike fixed window which hard-caps per second and creates the "thundering herd at window boundary" problem.

> **📖 Real-World Example:** AWS API Gateway uses token bucket rate limiting. Guava's `RateLimiter` and Bucket4j are popular Java implementations.

### Full Thread-Safe Implementation

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

public class TokenBucketRateLimiter {
    private final long capacity;          // maximum tokens (burst capacity)
    private final double refillRatePerMs; // tokens added per millisecond
    private double tokens;
    private long lastRefillTimestampMs;

    public TokenBucketRateLimiter(long capacity, long refillRatePerSecond) {
        if (capacity <= 0) throw new IllegalArgumentException("Capacity must be positive");
        if (refillRatePerSecond <= 0) throw new IllegalArgumentException("Refill rate must be positive");

        this.capacity          = capacity;
        this.refillRatePerMs   = (double) refillRatePerSecond / 1000.0;
        this.tokens            = capacity; // start full
        this.lastRefillTimestampMs = System.currentTimeMillis();
    }

    /**
     * Tries to consume 1 token. Returns true if allowed, false if rate-limited.
     */
    public synchronized boolean tryAcquire() {
        return tryAcquire(1);
    }

    /**
     * Tries to consume `permits` tokens atomically.
     * Returns true if all permits granted, false if not enough tokens.
     */
    public synchronized boolean tryAcquire(int permits) {
        if (permits <= 0) throw new IllegalArgumentException("Permits must be positive");
        refill();
        if (tokens >= permits) {
            tokens -= permits;
            return true;
        }
        return false; // not enough tokens
    }

    /**
     * Blocks until `permits` tokens are available, then consumes them.
     * Use only when you can afford to wait.
     */
    public synchronized void acquire(int permits) throws InterruptedException {
        while (!tryAcquire(permits)) {
            // Calculate wait time until enough tokens
            double deficit = permits - tokens;
            long waitMs    = (long) Math.ceil(deficit / refillRatePerMs);
            wait(Math.max(waitMs, 1));
        }
    }

    /**
     * Returns current token count (approximate — for monitoring only).
     */
    public synchronized double getAvailableTokens() {
        refill();
        return tokens;
    }

    private void refill() {
        long now     = System.currentTimeMillis();
        long elapsed = now - lastRefillTimestampMs;
        if (elapsed > 0) {
            double newTokens = elapsed * refillRatePerMs;
            tokens = Math.min(capacity, tokens + newTokens);
            lastRefillTimestampMs = now;
        }
    }
}

// ===================== PER-CLIENT RATE LIMITER =====================

public class PerClientRateLimiter {
    private final long capacity;
    private final long refillRatePerSecond;
    // Thread-safe map: clientId → their bucket
    private final ConcurrentHashMap<String, TokenBucketRateLimiter> buckets =
        new ConcurrentHashMap<>();

    public PerClientRateLimiter(long capacity, long refillRatePerSecond) {
        this.capacity           = capacity;
        this.refillRatePerSecond = refillRatePerSecond;
    }

    public boolean allowRequest(String clientId) {
        TokenBucketRateLimiter limiter = buckets.computeIfAbsent(
            clientId,
            id -> new TokenBucketRateLimiter(capacity, refillRatePerSecond)
        );
        return limiter.tryAcquire();
    }

    public boolean allowRequest(String clientId, int permits) {
        TokenBucketRateLimiter limiter = buckets.computeIfAbsent(
            clientId,
            id -> new TokenBucketRateLimiter(capacity, refillRatePerSecond)
        );
        return limiter.tryAcquire(permits);
    }

    public double getTokenCount(String clientId) {
        TokenBucketRateLimiter limiter = buckets.get(clientId);
        return limiter != null ? limiter.getAvailableTokens() : capacity;
    }
}

// ===================== SLIDING WINDOW COUNTER (ALTERNATIVE) =====================
// Token bucket allows bursts. If you want strictly N requests per second window,
// use a sliding window counter instead.

public class SlidingWindowRateLimiter {
    private final int maxRequests;
    private final long windowMs;
    private final LinkedList<Long> timestamps = new LinkedList<>();

    public SlidingWindowRateLimiter(int maxRequests, long windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs    = windowMs;
    }

    public synchronized boolean allowRequest() {
        long now = System.currentTimeMillis();
        // Remove timestamps outside the window
        while (!timestamps.isEmpty() && now - timestamps.peekFirst() > windowMs) {
            timestamps.pollFirst();
        }
        if (timestamps.size() < maxRequests) {
            timestamps.addLast(now);
            return true;
        }
        return false; // window full
    }
}

// ===================== DEMO =====================

class RateLimiterDemo {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("=== Token Bucket: capacity=5, refill=2/sec ===");
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter(5, 2);

        // Burst: first 5 requests succeed immediately
        for (int i = 1; i <= 8; i++) {
            boolean allowed = limiter.tryAcquire();
            System.out.printf("Request %d: %s (tokens left: %.2f)%n",
                i, allowed ? "ALLOWED" : "DENIED", limiter.getAvailableTokens());
        }

        System.out.println("\nWaiting 1 second for refill...");
        Thread.sleep(1000);

        for (int i = 9; i <= 12; i++) {
            boolean allowed = limiter.tryAcquire();
            System.out.printf("Request %d: %s (tokens left: %.2f)%n",
                i, allowed ? "ALLOWED" : "DENIED", limiter.getAvailableTokens());
        }

        System.out.println("\n=== Per-Client Rate Limiter ===");
        PerClientRateLimiter perClient = new PerClientRateLimiter(3, 1);

        String[] clients = {"alice", "alice", "alice", "alice", "bob", "bob", "alice"};
        for (String client : clients) {
            boolean allowed = perClient.allowRequest(client);
            System.out.printf("Client=%-6s Allowed=%-5b Tokens=%.2f%n",
                client, allowed, perClient.getTokenCount(client));
        }

        System.out.println("\n=== Sliding Window: 3 req per 500ms ===");
        SlidingWindowRateLimiter slidingWindow = new SlidingWindowRateLimiter(3, 500);
        for (int i = 1; i <= 5; i++) {
            System.out.printf("Request %d: %s%n", i, slidingWindow.allowRequest() ? "ALLOWED" : "DENIED");
        }
        Thread.sleep(600);
        System.out.println("After 600ms window slides...");
        for (int i = 6; i <= 9; i++) {
            System.out.printf("Request %d: %s%n", i, slidingWindow.allowRequest() ? "ALLOWED" : "DENIED");
        }
    }
}
```

> 🌍 **Real-World:** Stripe's API uses a token bucket rate limiter per secret key — each key gets a bucket of 100 tokens refilling at 100 per second, which allows short bursts (an initialization spike) while enforcing a sustained cap. When the bucket empties, Stripe returns HTTP 429 with a `Retry-After` header indicating exactly when the next token arrives.

### Rate Limiter Algorithms Comparison

| Algorithm | Burst | Precision | Memory | Use Case |
|-----------|-------|-----------|--------|----------|
| Fixed Window | Allows 2x burst at window boundary | Low | O(1) | Simple API throttling |
| Sliding Window Log | None | High | O(requests) | Strict per-user limits |
| Sliding Window Counter | Approximate | Medium | O(windows) | Balance precision/memory |
| Token Bucket | Yes, up to capacity | Medium | O(1) | APIs that allow bursts (CDN, message queues) |
| Leaky Bucket | None (smoothed output) | High | O(queue) | Traffic shaping |

---

## Quick Reference — Pattern Cheat Sheet

| Pattern | Category | Intent | Use When |
|---------|----------|--------|----------|
| **Factory Method** | Creational | Delegate object creation to subclasses | Creator doesn't know exact type to create |
| **Builder** | Creational | Construct complex objects step by step | 4+ optional parameters, immutable object needed |
| **Singleton** | Creational | Ensure one instance | Shared resource: config, pool, registry |
| **Decorator** | Structural | Add behavior dynamically | Combinatorial features, Java I/O style |
| **Proxy** | Structural | Control access to an object | Caching, security, lazy init, logging |
| **Adapter** | Structural | Convert incompatible interface | Legacy system integration |
| **Observer** | Behavioral | Notify many dependents of state change | Events, pub/sub, UI updates |
| **Strategy** | Behavioral | Swap algorithm at runtime | Multiple variants of a computation |

---

## SOLID Quick Reference

| Principle | One Line | Smell That Violates It |
|-----------|----------|----------------------|
| **SRP** | One class, one reason to change | God class doing 5+ things |
| **OCP** | Extend, don't modify | `switch`/`if-else` that grows with new types |
| **LSP** | Subclass is fully substitutable | `throw UnsupportedOperationException` in override |
| **ISP** | Small focused interfaces | Fat interface with unrelated methods |
| **DIP** | Depend on abstractions | `new MySQLRepo()` inside business class |

---

## MACHINE CODING 4: ELEVATOR SYSTEM

### Requirements

```text
Multiple elevators in a building
Floors: 0 to N-1
Requests: external (floor, direction) + internal (destination floor)
Strategy: SCAN (elevator sweeps in one direction, then reverses)
Thread-safe: multiple requests arrive concurrently
```

### Class Design

```text
ElevatorSystem
  List<Elevator> elevators
  + requestElevator(floor, direction) → assign best elevator

Elevator
  int id, currentFloor, capacity, currentLoad
  Direction currentDirection (UP, DOWN, IDLE)
  Set<Integer> destinationFloors (internal requests)
  TreeSet<Integer> upRequests    (external, going up — ascending order)
  TreeSet<Integer> downRequests  (external, going down — descending order)
  + addRequest(floor)
  + move()

ElevatorController (thread)
  Runs move() on each elevator in a loop
```

> **💡 Key Insight:** Using `TreeSet` (sorted) instead of `PriorityQueue` allows efficient lookup of the nearest floor ahead in the current direction via `tailSet()`. This is the core of the SCAN algorithm.

### Java Implementation

```java
enum Direction { UP, DOWN, IDLE }
enum Status    { IDLE, MOVING, MAINTENANCE }

class Elevator {
    private final int id;
    private int currentFloor;
    private Direction direction;
    private final TreeSet<Integer> upRequests   = new TreeSet<>();
    private final TreeSet<Integer> downRequests = new TreeSet<>(Comparator.reverseOrder());
    private final Set<Integer> destinationFloors = new HashSet<>();

    public synchronized void addExternalRequest(int floor, Direction dir) {
        if (dir == Direction.UP)   upRequests.add(floor);
        else                       downRequests.add(floor);
    }

    public synchronized void addInternalRequest(int floor) {
        destinationFloors.add(floor);
        if (floor > currentFloor) upRequests.add(floor);
        else                      downRequests.add(floor);
    }

    public synchronized void move() {
        if (direction == Direction.UP || direction == Direction.IDLE) {
            TreeSet<Integer> ahead = (TreeSet<Integer>) upRequests
                .tailSet(currentFloor, false);
            if (!ahead.isEmpty()) {
                currentFloor = ahead.first();
                upRequests.remove(currentFloor);
                destinationFloors.remove(currentFloor);
                direction = Direction.UP;
                return;
            }
            direction = Direction.DOWN; // reverse
        }
        if (direction == Direction.DOWN) {
            TreeSet<Integer> ahead = (TreeSet<Integer>) downRequests
                .tailSet(currentFloor, false);  // downRequests is reversed
            if (!ahead.isEmpty()) {
                currentFloor = ahead.first();
                downRequests.remove(currentFloor);
                destinationFloors.remove(currentFloor);
                return;
            }
            direction = Direction.IDLE;
        }
    }

    // Cost function: how suitable is this elevator for a request at 'floor'?
    public int costFor(int floor, Direction dir) {
        int distance = Math.abs(currentFloor - floor);
        if (direction == Direction.IDLE) return distance;
        // Elevator moving towards floor in same direction: low cost
        if ((direction == Direction.UP   && floor >= currentFloor && dir == Direction.UP) ||
            (direction == Direction.DOWN && floor <= currentFloor && dir == Direction.DOWN))
            return distance;
        // Elevator moving away: high cost
        return distance + 100;
    }
}

class ElevatorSystem {
    private final List<Elevator> elevators;

    public ElevatorSystem(int numElevators) {
        elevators = new ArrayList<>();
        for (int i = 0; i < numElevators; i++) elevators.add(new Elevator(i));
    }

    public void requestElevator(int floor, Direction direction) {
        // Assign to elevator with lowest cost
        Elevator best = null;
        int bestCost = Integer.MAX_VALUE;
        for (Elevator e : elevators) {
            int cost = e.costFor(floor, direction);
            if (cost < bestCost) { bestCost = cost; best = e; }
        }
        best.addExternalRequest(floor, direction);
    }

    public void selectFloor(int elevatorId, int floor) {
        elevators.get(elevatorId).addInternalRequest(floor);
    }
}
```

> 🌍 **Real-World:** Otis and Schindler elevator control firmware uses a variant of the SCAN (LOOK) algorithm in their Group Control Systems — multiple elevator cabins are assigned to requests by a cost function that weighs current direction, distance, and load. Modern systems layer ML models on top to predict peak-hour demand and pre-position elevators on high-traffic floors before rush hour starts.

### Design Decisions

```text
SCAN algorithm: efficient, prevents starvation (elevator services all floors it passes)
  Alternative: FCFS (first-come-first-served) — simple but less efficient
  Alternative: SSTF (shortest-seek-time-first) — greedy, may starve distant floors

Cost function for assignment:
  Idle elevator: distance only
  Moving toward request in same direction: low cost (on the way)
  Moving away: penalized (has to reverse or finish first)

Thread safety: synchronized on each Elevator object for addRequest/move
  Alternative: use ReentrantLock for finer-grained control
  Alternative: actor model (each elevator is an actor, receives messages)
```

> **📖 Real-World Example:** Hard drive scheduling uses the same SCAN algorithm (also called "elevator algorithm") — the disk head sweeps in one direction, servicing all pending read/write requests, then reverses.

---

## MACHINE CODING 5: CHESS GAME

### Requirements

```text
Two players: WHITE and BLACK
Standard chess board (8×8)
All piece movement rules
Check and checkmate detection
Turn management
```

### Class Design

```text
ChessGame
  Board board
  Player white, black
  Player currentPlayer
  + move(from, to)
  + isCheck(player)
  + isCheckmate(player)

Board
  Piece[][] cells (8×8)
  + getPiece(position)
  + movePiece(from, to)
  + getKingPosition(color)

Piece (abstract)
  Color color
  Position position
  + getValidMoves(Board) → List<Position>

Subclasses: King, Queen, Rook, Bishop, Knight, Pawn

Position
  int row, col
  + isValid()
```

> 🌍 **Real-World:** Chess.com's game engine uses a similar OO piece hierarchy — each piece type owns its `generateMoves()` logic, and the move validator calls it polymorphically. Their server handles millions of concurrent games by keeping each `GameState` as an immutable snapshot; moves produce a new state object rather than mutating shared board state, making concurrent game replay and analysis thread-safe by design.

> **💡 Key Insight:** Each `Piece` subclass encapsulates its own movement rules (`getValidMoves`). This is the Strategy pattern applied to piece movement — adding a new piece type (e.g., custom fairy chess piece) requires only a new class, not changing the board or game loop.

> **⚠️ Anti-pattern:** Do not put all movement rules in the `Board` class. That is a SRP violation — the board should manage position/state, not encode chess rules.

### Java Implementation

```java
enum Color { WHITE, BLACK }

record Position(int row, int col) {
    boolean isValid() { return row >= 0 && row < 8 && col >= 0 && col < 8; }
}

abstract class Piece {
    protected final Color color;
    protected Position position;

    Piece(Color color, Position position) {
        this.color = color;
        this.position = position;
    }

    public abstract List<Position> getValidMoves(Board board);

    protected boolean isEnemy(Piece other) {
        return other != null && other.color != this.color;
    }
    protected boolean isEmpty(Board board, Position p) {
        return board.getPiece(p) == null;
    }
}

class Rook extends Piece {
    Rook(Color color, Position position) { super(color, position); }

    @Override
    public List<Position> getValidMoves(Board board) {
        List<Position> moves = new ArrayList<>();
        int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
        for (int[] d : dirs) {
            int r = position.row() + d[0], c = position.col() + d[1];
            while (new Position(r, c).isValid()) {
                Position p = new Position(r, c);
                Piece target = board.getPiece(p);
                if (target == null)        { moves.add(p); r += d[0]; c += d[1]; }
                else if (isEnemy(target))  { moves.add(p); break; }
                else                       { break; }
            }
        }
        return moves;
    }
}

class Knight extends Piece {
    Knight(Color color, Position position) { super(color, position); }

    @Override
    public List<Position> getValidMoves(Board board) {
        List<Position> moves = new ArrayList<>();
        int[][] jumps = {{-2,-1},{-2,1},{-1,-2},{-1,2},{1,-2},{1,2},{2,-1},{2,1}};
        for (int[] j : jumps) {
            Position p = new Position(position.row() + j[0], position.col() + j[1]);
            if (p.isValid() && (isEmpty(board, p) || isEnemy(board.getPiece(p))))
                moves.add(p);
        }
        return moves;
    }
}

class King extends Piece {
    King(Color color, Position position) { super(color, position); }

    @Override
    public List<Position> getValidMoves(Board board) {
        List<Position> moves = new ArrayList<>();
        for (int dr = -1; dr <= 1; dr++) {
            for (int dc = -1; dc <= 1; dc++) {
                if (dr == 0 && dc == 0) continue;
                Position p = new Position(position.row()+dr, position.col()+dc);
                if (p.isValid() && (isEmpty(board, p) || isEnemy(board.getPiece(p))))
                    moves.add(p);
            }
        }
        return moves;
    }
}

class Board {
    private final Piece[][] cells = new Piece[8][8];

    public Piece getPiece(Position p) { return cells[p.row()][p.col()]; }

    public void movePiece(Position from, Position to) {
        Piece piece = cells[from.row()][from.col()];
        cells[to.row()][to.col()] = piece;
        cells[from.row()][from.col()] = null;
        piece.position = to;
    }

    public Position findKing(Color color) {
        for (int r = 0; r < 8; r++)
            for (int c = 0; c < 8; c++)
                if (cells[r][c] instanceof King && cells[r][c].color == color)
                    return new Position(r, c);
        return null;
    }
}

class ChessGame {
    private final Board board = new Board();
    private Color currentTurn = Color.WHITE;

    public boolean move(Position from, Position to) {
        Piece piece = board.getPiece(from);
        if (piece == null || piece.color != currentTurn) return false;
        if (!piece.getValidMoves(board).contains(to)) return false;

        board.movePiece(from, to);

        // After moving, check if own king is in check → illegal move
        if (isInCheck(currentTurn)) {
            board.movePiece(to, from); // undo
            return false;
        }

        currentTurn = (currentTurn == Color.WHITE) ? Color.BLACK : Color.WHITE;
        return true;
    }

    public boolean isInCheck(Color color) {
        Position kingPos = board.findKing(color);
        Color enemy = (color == Color.WHITE) ? Color.BLACK : Color.WHITE;
        // Check if any enemy piece can attack king's position
        for (int r = 0; r < 8; r++)
            for (int c = 0; c < 8; c++) {
                Piece p = board.getPiece(new Position(r, c));
                if (p != null && p.color == enemy)
                    if (p.getValidMoves(board).contains(kingPos)) return true;
            }
        return false;
    }

    public boolean isCheckmate(Color color) {
        if (!isInCheck(color)) return false;
        // Try every possible move — if none resolves check → checkmate
        for (int r = 0; r < 8; r++)
            for (int c = 0; c < 8; c++) {
                Piece p = board.getPiece(new Position(r, c));
                if (p != null && p.color == color)
                    for (Position to : p.getValidMoves(board)) {
                        Piece captured = board.getPiece(to);
                        board.movePiece(p.position, to);
                        boolean stillInCheck = isInCheck(color);
                        board.movePiece(to, p.position);
                        if (captured != null) board.cells[to.row()][to.col()] = captured;
                        if (!stillInCheck) return false;
                    }
            }
        return true;
    }
}
```

---

---

## MACHINE CODING 6: HOTEL BOOKING SYSTEM

### Requirements

```text
Hotels with rooms of different types (single, double, suite)
Room availability: available/booked/under-maintenance
Book a room for a date range
Cancel booking
Search available rooms by hotel, type, date range
Pricing: base price + seasonal multiplier
```

### Class Design

```text
HotelSystem
  Map<String, Hotel> hotels
  BookingService bookingService

Hotel
  String id, name, location
  List<Room> rooms
  + getAvailableRooms(roomType, checkIn, checkOut)

Room
  String id
  RoomType type (SINGLE, DOUBLE, SUITE)
  RoomStatus status (AVAILABLE, MAINTENANCE)
  BigDecimal basePrice
  List<Booking> bookings  (sorted by checkIn date)
  + isAvailable(checkIn, checkOut)

Booking
  String id
  String userId, roomId
  LocalDate checkIn, checkOut
  BookingStatus status (CONFIRMED, CANCELLED)
  BigDecimal totalPrice

PricingService
  + calculatePrice(room, checkIn, checkOut)
```

> 🌍 **Real-World:** Airbnb's booking system uses the same date-overlap check as the core availability guard — their PostgreSQL schema uses an exclusion constraint (`EXCLUDE USING gist (listing_id WITH =, daterange(check_in, check_out) WITH &&)`) to enforce at the DB level that no two confirmed reservations can overlap for the same listing, which acts as the final safety net even if application-level locking has a race condition.

> **💡 Key Insight:** The critical concurrency issue is double-booking. The `synchronized(room)` block in `BookingService.bookRoom()` makes the availability-check-then-book atomic on a per-room basis. This is finer-grained than locking the entire hotel, allowing concurrent bookings of different rooms.

### Java Implementation

```java
enum RoomType   { SINGLE, DOUBLE, SUITE }
enum RoomStatus { AVAILABLE, MAINTENANCE }
enum BookingStatus { CONFIRMED, CANCELLED }

class Room {
    private final String id;
    private final RoomType type;
    private RoomStatus status;
    private final BigDecimal basePrice;
    private final List<Booking> bookings = new ArrayList<>();

    public synchronized boolean isAvailable(LocalDate checkIn, LocalDate checkOut) {
        if (status != RoomStatus.AVAILABLE) return false;
        return bookings.stream()
            .filter(b -> b.getStatus() == BookingStatus.CONFIRMED)
            .noneMatch(b -> checkIn.isBefore(b.getCheckOut()) && checkOut.isAfter(b.getCheckIn()));
    }

    public synchronized void addBooking(Booking booking) {
        bookings.add(booking);
    }

    public synchronized void cancelBooking(String bookingId) {
        bookings.stream()
            .filter(b -> b.getId().equals(bookingId))
            .findFirst()
            .ifPresent(b -> b.setStatus(BookingStatus.CANCELLED));
    }
}

class PricingService {
    private static final Map<Month, Double> SEASONAL_MULTIPLIERS = Map.of(
        Month.DECEMBER, 1.5, Month.JANUARY, 1.3,
        Month.JUNE, 1.2, Month.JULY, 1.2
    );

    public BigDecimal calculatePrice(Room room, LocalDate checkIn, LocalDate checkOut) {
        long nights = ChronoUnit.DAYS.between(checkIn, checkOut);
        double multiplier = SEASONAL_MULTIPLIERS.getOrDefault(checkIn.getMonth(), 1.0);
        return room.getBasePrice()
            .multiply(BigDecimal.valueOf(nights))
            .multiply(BigDecimal.valueOf(multiplier));
    }
}

class BookingService {
    private final Map<String, Booking> bookings = new ConcurrentHashMap<>();
    private final PricingService pricingService = new PricingService();

    public Booking bookRoom(Room room, String userId, LocalDate checkIn, LocalDate checkOut) {
        synchronized (room) {  // lock on the specific room to prevent double-booking
            if (!room.isAvailable(checkIn, checkOut))
                throw new RoomNotAvailableException("Room not available for selected dates");

            BigDecimal price = pricingService.calculatePrice(room, checkIn, checkOut);
            Booking booking = new Booking(
                UUID.randomUUID().toString(), userId, room.getId(),
                checkIn, checkOut, price, BookingStatus.CONFIRMED
            );
            room.addBooking(booking);
            bookings.put(booking.getId(), booking);
            return booking;
        }
    }

    public void cancelBooking(String bookingId) {
        Booking booking = bookings.get(bookingId);
        if (booking == null) throw new BookingNotFoundException(bookingId);
        // Find the room and cancel
        booking.setStatus(BookingStatus.CANCELLED);
    }
}

class HotelSearchService {
    private final List<Hotel> hotels;

    public List<Room> search(String hotelId, RoomType type,
                             LocalDate checkIn, LocalDate checkOut) {
        return hotels.stream()
            .filter(h -> hotelId == null || h.getId().equals(hotelId))
            .flatMap(h -> h.getRooms().stream())
            .filter(r -> type == null || r.getType() == type)
            .filter(r -> r.isAvailable(checkIn, checkOut))
            .sorted(Comparator.comparing(Room::getBasePrice))
            .collect(Collectors.toList());
    }
}
```

### Design Decisions

```text
Concurrency: synchronized on room object prevents two users booking the same room
  at the same time (check-then-act is atomic within the synchronized block)

Pricing: strategy pattern — PricingService is injected, can swap algorithms
  (seasonal, weekend pricing, loyalty discounts all separate strategies)

Cancellation policy: not implemented above — add refund rules as separate CancellationPolicy class
  (OCP: add new policies without modifying booking logic)

Search performance: for real system with 10K hotels:
  - Index rooms in Elasticsearch for date-range + type filtering
  - Postgres: GiST index for date range overlap queries
    EXCLUDE USING gist (room_id WITH =, daterange(check_in, check_out) WITH &&)
    (PostgreSQL exclusion constraint prevents overlapping bookings at DB level)
```

> **📖 Real-World Example:** Booking.com and Airbnb use optimistic locking in their databases for concurrent bookings: a `version` column is checked during the UPDATE, and if it changed since the SELECT, the transaction retries. This avoids holding a lock for the entire user session.

---

## MACHINE CODING 7: NOTIFICATION SYSTEM (LLD)

### Requirements

```text
Multiple notification channels: Email, SMS, Push, In-App
User preferences per channel (enabled/disabled)
Retry failed notifications (3 attempts with backoff)
Priority: CRITICAL > HIGH > NORMAL
Template rendering with variables
```

> 🌍 **Real-World:** PagerDuty's notification routing engine uses exactly this architecture — each alert goes through a `RoutingEngine` (Facade) that checks on-call schedules, applies escalation policies, and fans out to `EmailSender`, `SmsSender`, and `SlackSender` (Strategies). If a channel fails, the retry policy with exponential backoff re-attempts delivery before escalating to the next on-call tier.

> **💡 Key Insight:** This system combines three patterns: **Strategy** (each channel sender is a strategy), **Template Method** (retry policy wraps any sender), and **Facade** (`NotificationDispatcher` hides the complexity of preference checks, template rendering, and retry logic behind a single `dispatch()` call).

### Java Implementation

```java
enum Channel   { EMAIL, SMS, PUSH, IN_APP }
enum Priority  { CRITICAL, HIGH, NORMAL }
enum NStatus   { PENDING, SENT, FAILED, SKIPPED }

// Template with variable substitution
record NotificationTemplate(String id, String subject, String body) {
    public String render(Map<String, String> vars) {
        String result = body;
        for (Map.Entry<String, String> e : vars.entrySet())
            result = result.replace("{{" + e.getKey() + "}}", e.getValue());
        return result;
    }
}

// Core notification request
record NotificationRequest(
    String userId,
    Channel channel,
    String templateId,
    Map<String, String> data,
    Priority priority
) {}

// Channel-specific sender (Strategy pattern)
interface NotificationSender {
    boolean send(String userId, String subject, String body);
    Channel getChannel();
}

class EmailSender implements NotificationSender {
    @Override
    public boolean send(String userId, String subject, String body) {
        // integrate with SendGrid / SES
        System.out.printf("EMAIL to %s: [%s] %s%n", userId, subject, body);
        return true;
    }
    @Override public Channel getChannel() { return Channel.EMAIL; }
}

class SmsSender implements NotificationSender {
    @Override
    public boolean send(String userId, String subject, String body) {
        System.out.printf("SMS to %s: %s%n", userId, body);
        return true;
    }
    @Override public Channel getChannel() { return Channel.SMS; }
}

// User preference check
class UserPreferenceService {
    // In production: DB-backed; here, in-memory
    private final Map<String, Set<Channel>> optedOut = new HashMap<>();

    public boolean isEnabled(String userId, Channel channel) {
        return !optedOut.getOrDefault(userId, Set.of()).contains(channel);
    }

    public void optOut(String userId, Channel channel) {
        optedOut.computeIfAbsent(userId, k -> new HashSet<>()).add(channel);
    }
}

// Retry with exponential backoff
class RetryPolicy {
    private final int maxAttempts;
    private final long baseDelayMs;

    RetryPolicy(int maxAttempts, long baseDelayMs) {
        this.maxAttempts = maxAttempts;
        this.baseDelayMs = baseDelayMs;
    }

    public boolean execute(Supplier<Boolean> task) throws InterruptedException {
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            if (task.get()) return true;
            if (attempt < maxAttempts - 1)
                Thread.sleep(baseDelayMs * (1L << attempt)); // 1s, 2s, 4s
        }
        return false;
    }
}

// Main dispatcher (Facade + Strategy)
class NotificationDispatcher {
    private final Map<Channel, NotificationSender> senders;
    private final Map<String, NotificationTemplate> templates;
    private final UserPreferenceService preferenceService;
    private final RetryPolicy retryPolicy;

    NotificationDispatcher(List<NotificationSender> senders,
                           Map<String, NotificationTemplate> templates,
                           UserPreferenceService prefs) {
        this.senders = senders.stream()
            .collect(Collectors.toMap(NotificationSender::getChannel, s -> s));
        this.templates = templates;
        this.preferenceService = prefs;
        this.retryPolicy = new RetryPolicy(3, 1000);
    }

    public NStatus dispatch(NotificationRequest request) throws InterruptedException {
        if (!preferenceService.isEnabled(request.userId(), request.channel()))
            return NStatus.SKIPPED;

        NotificationTemplate template = templates.get(request.templateId());
        if (template == null) throw new IllegalArgumentException("Unknown template");

        String body = template.render(request.data());
        NotificationSender sender = senders.get(request.channel());
        if (sender == null) throw new IllegalArgumentException("No sender for channel");

        boolean sent = retryPolicy.execute(() -> sender.send(request.userId(), template.subject(), body));
        return sent ? NStatus.SENT : NStatus.FAILED;
    }
}
```

### Design Decisions

```text
Strategy pattern: NotificationSender interface → swap Email/SMS/Push implementations
  Adding WhatsApp: implement NotificationSender, register in dispatcher → zero changes to existing code

Template rendering: simple string replacement; production uses Handlebars/Freemarker
  Sanitize variables if rendering HTML email (XSS prevention)

Retry: exponential backoff (1s, 2s, 4s). After 3 fails → FAILED status → DLQ in production.

Priority queue: NotificationDispatcher can be backed by a PriorityBlockingQueue<NotificationRequest>
  comparator: CRITICAL → HIGH → NORMAL

Thread safety:
  UserPreferenceService: use ConcurrentHashMap for production
  Dispatcher: stateless — can run many threads in parallel

Extension points:
  - Add rate limiting: inject RateLimiter check before send
  - Add audit log: decorator pattern on NotificationSender
  - Add A/B testing: A/BTemplateSelector wraps template lookup
```

> **📖 Real-World Example:** AWS SNS (Simple Notification Service) implements this exact architecture — topics (subjects), subscriptions (observers), channel-specific delivery protocols (strategies), and retry policies with DLQ fallback.


---

## ⭐ IMPORTANT CONCEPTS CHECKLIST (LLD)

| # | Concept | Signal | Done |
|---|---------|--------|------|
| 1 | SOLID — especially SRP & OCP | Extensibility without rewrite | [ ] |
| 2 | Strategy / Observer / Factory / Decorator | Pattern fluency | [ ] |
| 3 | Class diagram before coding | Structure under time pressure | [ ] |
| 4 | Interfaces at variation points | Swap payment/notify/pricing | [ ] |
| 5 | Thread safety without over-locking | Concurrent LLD | [ ] |
| 6 | Idempotency in APIs | Real systems | [ ] |
| 7 | State machines for workflows | Booking, orders, elevators | [ ] |
| 8 | Repository / service layering | Clean boundaries | [ ] |

> ⭐ **IMPORTANT CONCEPT:** Identify what will change (payment method, notification channel, pricing rule) and put an interface there first.

---

## 🛠️ PRACTICAL — LLD Labs

### Lab 1: 45-min Parking Lot (no notes)
Requirements → entities → class diagram (10) → code core flows (25) → concurrency (10).

### Lab 2: Pattern Mapping
For Notification System, Rate Limiter, Chess: name which patterns you use and why in one sentence each.

### Lab 3: Extensibility Test
After designing, ask: "Add SMS + push + priority + retry + DLQ without editing existing senders." Refactor until true.
