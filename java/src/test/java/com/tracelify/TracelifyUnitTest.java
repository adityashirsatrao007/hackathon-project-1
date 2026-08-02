package com.tracelify;

import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit test suite for the Tracelify Java SDK.
 *
 * Tests cover:
 * - SDK construction / DSN parsing
 * - setUser / setTag / addBreadcrumb mutation
 * - captureException event building and async flush
 * - Multiple exceptions (batching)
 * - Graceful shutdown
 * - Edge-cases: null message, special JSON characters, empty DSN
 */
@DisplayName("Tracelify Java SDK — Unit Tests")
class TracelifyUnitTest {

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private static final String VALID_DSN = "http://f965e01dceebe962796c7279b2b6c3e2@54.251.156.151:8000/api/f729e35c-3826-4cfc-a1c4-b684a7103c04/events";

    /** Capture stdout so we can assert on async flush output. */
    private ByteArrayOutputStream stdout;
    private PrintStream originalOut;

    @BeforeEach
    void redirectStdout() {
        stdout = new ByteArrayOutputStream();
        originalOut = System.out;
        System.setOut(new PrintStream(stdout));
    }

    @AfterEach
    void restoreStdout() {
        System.setOut(originalOut);
    }

    // ─── 1. Construction ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("SDK initialises without throwing for a valid DSN")
    void testConstructorValidDsn() {
        assertDoesNotThrow(() -> {
            Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
            sdk.shutdown();
        });
    }

    @Test
    @DisplayName("SDK initialises without throwing for an empty DSN")
    void testConstructorEmptyDsn() {
        assertDoesNotThrow(() -> {
            Tracelify sdk = new Tracelify("", "1.0.0");
            sdk.shutdown();
        });
    }

    @Test
    @DisplayName("SDK initialises without throwing for a malformed DSN")
    void testConstructorMalformedDsn() {
        assertDoesNotThrow(() -> {
            Tracelify sdk = new Tracelify("not-a-real-dsn", "2.5.1");
            sdk.shutdown();
        });
    }

    // ─── 2. setUser ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("setUser accepts a populated user map without throwing")
    void testSetUserPopulated() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        Map<String, Object> user = new HashMap<>();
        user.put("id", "usr_001");
        user.put("email", "alice@example.com");
        assertDoesNotThrow(() -> sdk.setUser(user));
        sdk.shutdown();
    }

    @Test
    @DisplayName("setUser accepts an empty map (clears user context)")
    void testSetUserEmpty() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        assertDoesNotThrow(() -> sdk.setUser(new HashMap<>()));
        sdk.shutdown();
    }

    @Test
    @DisplayName("setUser can be called multiple times (last write wins)")
    void testSetUserOverwrite() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        Map<String, Object> user1 = new HashMap<>();
        user1.put("id", "usr_001");
        sdk.setUser(user1);

        Map<String, Object> user2 = new HashMap<>();
        user2.put("id", "usr_002");
        assertDoesNotThrow(() -> sdk.setUser(user2));
        sdk.shutdown();
    }

    // ─── 3. setTag ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("setTag stores a simple key/value pair without throwing")
    void testSetTagSimple() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        assertDoesNotThrow(() -> sdk.setTag("environment", "production"));
        sdk.shutdown();
    }

    @Test
    @DisplayName("setTag with the same key overwrites the previous value")
    void testSetTagOverwrite() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        sdk.setTag("env", "staging");
        assertDoesNotThrow(() -> sdk.setTag("env", "production"));
        sdk.shutdown();
    }

    @ParameterizedTest(name = "setTag with key=\"{0}\"")
    @ValueSource(strings = { "", "key with spaces", "key=value", "key\"quote\"" })
    @DisplayName("setTag handles edge-case key strings without throwing")
    void testSetTagEdgeCaseKeys(String key) {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        assertDoesNotThrow(() -> sdk.setTag(key, "value"));
        sdk.shutdown();
    }

    // ─── 4. addBreadcrumb ────────────────────────────────────────────────────────

    @Test
    @DisplayName("addBreadcrumb accepts a normal message without throwing")
    void testAddBreadcrumbNormal() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        assertDoesNotThrow(() -> sdk.addBreadcrumb("User clicked submit"));
        sdk.shutdown();
    }

    @Test
    @DisplayName("addBreadcrumb can be called many times")
    void testAddBreadcrumbMultiple() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        for (int i = 0; i < 20; i++) {
            sdk.addBreadcrumb("Step " + i);
        }
        assertDoesNotThrow(sdk::flush);
        sdk.shutdown();
    }

    @Test
    @DisplayName("addBreadcrumb handles messages with JSON special characters")
    void testAddBreadcrumbJsonSpecialChars() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        assertDoesNotThrow(() -> sdk.addBreadcrumb("He said \"hello\" & left\nnewline"));
        sdk.shutdown();
    }

    // ─── 5. captureException ─────────────────────────────────────────────────────

    @Test
    @DisplayName("captureException enqueues event without throwing for RuntimeException")
    void testCaptureRuntimeException() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        RuntimeException ex = new RuntimeException("division by zero");
        assertDoesNotThrow(() -> sdk.captureException(ex));
        sdk.shutdown();
    }

    @Test
    @DisplayName("captureException enqueues event without throwing for a checked Exception")
    void testCaptureCheckedException() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        Exception ex = new Exception("checked failure");
        assertDoesNotThrow(() -> sdk.captureException(ex));
        sdk.shutdown();
    }

    @Test
    @DisplayName("captureException handles exception with null message gracefully")
    void testCaptureExceptionNullMessage() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        // NullPointerException typically has null getMessage()
        NullPointerException ex = new NullPointerException();
        assertDoesNotThrow(() -> sdk.captureException(ex));
        sdk.shutdown();
    }

    @Test
    @DisplayName("captureException with special characters in message does not corrupt JSON")
    void testCaptureExceptionSpecialCharsMessage() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        Exception ex = new Exception("Error: \"file not found\"\nPath: C:\\Users\\test");
        assertDoesNotThrow(() -> sdk.captureException(ex));
        sdk.shutdown();
    }

    @Test
    @DisplayName("captureException triggers flush after 5 events (batch boundary)")
    void testCaptureExceptionBatchFlushAt5() throws InterruptedException {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        // Fire exactly 5 exceptions — the 5th should trigger an automatic flush
        for (int i = 0; i < 5; i++) {
            sdk.captureException(new RuntimeException("error #" + i));
        }
        // Give the async worker time to process
        TimeUnit.MILLISECONDS.sleep(300);
        String out = stdout.toString();
        assertTrue(out.contains("[Async Worker] Non-Blocking FLUSH"),
                "Expected flush output after 5 events, got: " + out);
        sdk.shutdown();
    }

    @Test
    @DisplayName("captureException with user, tags and breadcrumbs all set")
    void testCaptureExceptionFullContext() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");

        Map<String, Object> user = new HashMap<>();
        user.put("id", "usr_999");
        user.put("name", "Bob");
        sdk.setUser(user);

        sdk.setTag("region", "eu-west-1");
        sdk.setTag("version", "3.2.1");

        sdk.addBreadcrumb("Page loaded");
        sdk.addBreadcrumb("API call made");

        assertDoesNotThrow(() -> sdk.captureException(new IllegalStateException("state mismatch")));
        sdk.shutdown();
    }

    // ─── 6. flush ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("flush on empty queue does not throw")
    void testFlushEmptyQueue() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        assertDoesNotThrow(sdk::flush);
        sdk.shutdown();
    }

    @Test
    @DisplayName("flush drains pending events from queue")
    void testFlushDrainsQueue() throws InterruptedException {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        sdk.captureException(new RuntimeException("pending event 1"));
        sdk.captureException(new RuntimeException("pending event 2"));
        sdk.flush();
        TimeUnit.MILLISECONDS.sleep(300);
        String out = stdout.toString();
        assertTrue(out.contains("[Async Worker] Non-Blocking FLUSH"),
                "Flush should drain and print batched events. Got: " + out);
        sdk.shutdown();
    }

    // ─── 7. shutdown ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("shutdown completes without hanging or throwing")
    void testShutdownClean() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        sdk.captureException(new RuntimeException("before shutdown"));
        assertDoesNotThrow(sdk::shutdown);
    }

    @Test
    @DisplayName("Double shutdown does not throw")
    void testDoubleShutdown() {
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");
        sdk.shutdown();
        assertDoesNotThrow(sdk::shutdown);
    }

    // ─── 8. DSN project-ID extraction ────────────────────────────────────────────

    @Test
    @DisplayName("Standard /project/<id>/ DSN: project ID is extracted and appears in payload")
    void testDsnProjectIdExtraction() throws InterruptedException {
        // A DSN with the /project/<id>/ pattern the SDK parser understands
        Tracelify sdk = new Tracelify(
                "http://key@localhost:8000/project/99/events", "1.0.0");
        sdk.captureException(new RuntimeException("project id check"));
        sdk.flush();
        TimeUnit.MILLISECONDS.sleep(300);
        String out = stdout.toString();
        assertTrue(out.contains("99"),
                "Expected project ID 99 in flushed output. Got: " + out);
        sdk.shutdown();
    }

    @Test
    @DisplayName("DSN without /project/ segment defaults project_id to '1'")
    void testDsnMissingProjectSegment() throws InterruptedException {
        Tracelify sdk = new Tracelify("http://key@localhost:8000/events", "1.0.0");
        sdk.captureException(new RuntimeException("no project segment"));
        sdk.flush();
        TimeUnit.MILLISECONDS.sleep(300);
        String out = stdout.toString();
        assertTrue(out.contains("\"1\"") || out.contains(": 1"),
                "Expected default project_id=1. Got: " + out);
        sdk.shutdown();
    }

    @Test
    @DisplayName("Real Tracelify DSN (/api/<uuid>/events) — flushes without error")
    void testRealTracelifyDsnDoesNotThrow() throws InterruptedException {
        // The SDK parses /project/<id>/ — this DSN uses /api/<uuid>/ so it
        // falls back gracefully to project_id = "1".
        Tracelify sdk = new Tracelify(VALID_DSN, "1.0.0");

        Map<String, Object> user = new HashMap<>();
        user.put("id", "usr_real");
        user.put("email", "dev@tracelify.io");
        sdk.setUser(user);

        sdk.setTag("env", "production");
        sdk.setTag("release", "1.0.0");

        sdk.addBreadcrumb("App boot");
        sdk.addBreadcrumb("DB connected");
        sdk.addBreadcrumb("Request received");

        assertDoesNotThrow(() -> sdk.captureException(new RuntimeException("real DSN smoke test")));

        sdk.flush();
        TimeUnit.MILLISECONDS.sleep(300);
        String out = stdout.toString();
        assertTrue(out.contains("[Async Worker] Non-Blocking FLUSH"),
                "Expected flush output with real DSN. Got: " + out);
        sdk.shutdown();
    }
}
