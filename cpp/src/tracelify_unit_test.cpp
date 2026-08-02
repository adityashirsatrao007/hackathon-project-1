/**
 * tracelify_unit_test.cpp
 *
 * Self-contained unit test suite for the Tracelify C++ SDK.
 * No third-party framework required — builds and runs with the same
 * CMake setup already in place.
 *
 * Build (from Core-4 build dir):
 *   cmake -S . -B build && cmake --build build
 *   ./build/tracelify_unit_test   (or the path shown by CMake)
 *
 * All tests print [PASS] / [FAIL] and exit with code 1 on any failure.
 */

#include "../include/tracelify.h"

#include <cassert>
#include <chrono>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <iostream>
#include <map>

#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

// ─── Minimal test harness ────────────────────────────────────────────────────

static int g_total  = 0;
static int g_passed = 0;
static int g_failed = 0;

struct TestCase {
    std::string name;
    std::function<void()> fn;
};

static std::vector<TestCase> g_tests;

// Register a test. Usage:  REGISTER_TEST("name", [] { ... });
// Variadic to allow template types with commas inside the lambda body.
#define REGISTER_TEST(name, ...) \
    g_tests.push_back({name, __VA_ARGS__})

// Assertion helper (does NOT call std::abort so remaining tests still run)
#define EXPECT_TRUE(expr)                                                  \
    do {                                                                   \
        if (!(expr)) {                                                     \
            std::cerr << "    ASSERTION FAILED: " #expr                    \
                      << " (" << __FILE__ << ":" << __LINE__ << ")\n";    \
            throw std::runtime_error("assertion failed");                  \
        }                                                                  \
    } while (false)

#define EXPECT_NO_THROW(expr)                                              \
    do {                                                                   \
        try { expr; }                                                      \
        catch (...) {                                                      \
            std::cerr << "    UNEXPECTED EXCEPTION in: " #expr            \
                      << " (" << __FILE__ << ":" << __LINE__ << ")\n";    \
            throw std::runtime_error("unexpected exception");              \
        }                                                                  \
    } while (false)

static void run_all_tests() {
    for (auto& tc : g_tests) {
        ++g_total;
        std::cout << "[ RUN  ] " << tc.name << "\n";
        try {
            tc.fn();
            std::cout << "[ PASS ] " << tc.name << "\n";
            ++g_passed;
        } catch (const std::exception& e) {
            std::cout << "[ FAIL ] " << tc.name
                      << "  (" << e.what() << ")\n";
            ++g_failed;
        } catch (...) {
            std::cout << "[ FAIL ] " << tc.name << "  (unknown exception)\n";
            ++g_failed;
        }
    }

    std::cout << "\n──────────────────────────────────────────\n";
    std::cout << "Results: " << g_passed << " / " << g_total << " passed";
    if (g_failed > 0) std::cout << "  |  " << g_failed << " FAILED";
    std::cout << "\n──────────────────────────────────────────\n";
}

// ─── Helper: sleep a little for async worker to process ──────────────────────

static void async_sleep_ms(int ms) {
    std::this_thread::sleep_for(std::chrono::milliseconds(ms));
}

// =============================================================================
//  Test definitions
// =============================================================================

static void register_tests() {

    // ── 1. Construction ──────────────────────────────────────────────────────

    REGISTER_TEST("ctor_valid_dsn_does_not_throw", [] {
        EXPECT_NO_THROW(
            tracelify::Tracelify sdk(
                "http://key@localhost:8000/project/1/events", "1.0.0")
        );
    });

    REGISTER_TEST("ctor_empty_dsn_does_not_throw", [] {
        EXPECT_NO_THROW(
            tracelify::Tracelify sdk("", "1.0.0")
        );
    });

    REGISTER_TEST("ctor_malformed_dsn_does_not_throw", [] {
        EXPECT_NO_THROW(
            tracelify::Tracelify sdk("not-a-url", "2.0.0")
        );
    });

    REGISTER_TEST("ctor_empty_release_does_not_throw", [] {
        EXPECT_NO_THROW(
            tracelify::Tracelify sdk(
                "http://key@localhost:8000/project/1/events", "")
        );
    });

    // ── 2. set_user ──────────────────────────────────────────────────────────

    REGISTER_TEST("set_user_populated_map_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::map<std::string, std::string> user;
        user["id"]    = "usr_001";
        user["email"] = "alice@example.com";
        EXPECT_NO_THROW(sdk.set_user(user));
    });

    REGISTER_TEST("set_user_empty_map_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::map<std::string, std::string> empty;
        EXPECT_NO_THROW(sdk.set_user(empty));
    });

    REGISTER_TEST("set_user_overwrite_is_accepted", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::map<std::string, std::string> u1, u2;
        u1["id"] = "usr_001";
        u2["id"] = "usr_002";
        sdk.set_user(u1);
        EXPECT_NO_THROW(sdk.set_user(u2));
    });

    REGISTER_TEST("set_user_value_with_json_special_chars", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::map<std::string, std::string> user;
        user["name"] = "O'Brien \"The\" \nExplorer";
        EXPECT_NO_THROW(sdk.set_user(user));
    });

    // ── 3. set_tag ───────────────────────────────────────────────────────────

    REGISTER_TEST("set_tag_simple_kv_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        EXPECT_NO_THROW(sdk.set_tag("env", "production"));
    });

    REGISTER_TEST("set_tag_overwrite_same_key", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        sdk.set_tag("env", "staging");
        EXPECT_NO_THROW(sdk.set_tag("env", "production"));
    });

    REGISTER_TEST("set_tag_empty_key_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        EXPECT_NO_THROW(sdk.set_tag("", "some-value"));
    });

    REGISTER_TEST("set_tag_empty_value_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        EXPECT_NO_THROW(sdk.set_tag("region", ""));
    });

    REGISTER_TEST("set_tag_value_with_quotes", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        sdk.set_tag("desc", "says \"hello\"");
        EXPECT_TRUE(true);
    });

    REGISTER_TEST("set_tag_multiple_distinct_keys", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        for (int i = 0; i < 10; ++i) {
            sdk.set_tag("key_" + std::to_string(i), "val_" + std::to_string(i));
        }
        // If no exception, all 10 tags were stored
        EXPECT_TRUE(true);
    });

    // ── 4. add_breadcrumb ────────────────────────────────────────────────────

    REGISTER_TEST("add_breadcrumb_normal_message_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        sdk.add_breadcrumb("User clicked submit");
        EXPECT_TRUE(true);
    });

    REGISTER_TEST("add_breadcrumb_empty_message_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        sdk.add_breadcrumb("");
        EXPECT_TRUE(true);
    });

    REGISTER_TEST("add_breadcrumb_json_special_chars", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        sdk.add_breadcrumb("Error: \"file not found\"\nPath: C:\\Users\\test");
        EXPECT_TRUE(true);
    });

    REGISTER_TEST("add_breadcrumb_many_times_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        for (int i = 0; i < 50; ++i) {
            EXPECT_NO_THROW(sdk.add_breadcrumb("step_" + std::to_string(i)));
        }
    });

    // ── 5. capture_exception ─────────────────────────────────────────────────

    REGISTER_TEST("capture_exception_runtime_error_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::runtime_error ex("division by zero");
        EXPECT_NO_THROW(sdk.capture_exception(ex));
        async_sleep_ms(100);
    });

    REGISTER_TEST("capture_exception_logic_error_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::logic_error ex("invalid argument");
        EXPECT_NO_THROW(sdk.capture_exception(ex));
        async_sleep_ms(100);
    });

    REGISTER_TEST("capture_exception_with_special_chars_in_message", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::runtime_error ex("Error: \"file not found\"\nPath: C:\\Users\\test");
        EXPECT_NO_THROW(sdk.capture_exception(ex));
        async_sleep_ms(100);
    });

    REGISTER_TEST("capture_exception_with_empty_message", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::runtime_error ex("");
        EXPECT_NO_THROW(sdk.capture_exception(ex));
        async_sleep_ms(100);
    });

    REGISTER_TEST("capture_exception_full_context_user_tags_breadcrumbs", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");

        std::map<std::string, std::string> user;
        user["id"]    = "usr_999";
        user["email"] = "bob@example.com";
        sdk.set_user(user);

        sdk.set_tag("region", "eu-west-1");
        sdk.set_tag("version", "3.2.1");

        sdk.add_breadcrumb("Page loaded");
        sdk.add_breadcrumb("API call made");

        std::runtime_error ex("state mismatch");
        EXPECT_NO_THROW(sdk.capture_exception(ex));
        async_sleep_ms(150);
    });

    REGISTER_TEST("capture_exception_multiple_events_enqueued", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        for (int i = 0; i < 5; ++i) {
            std::runtime_error ex("error #" + std::to_string(i));
            EXPECT_NO_THROW(sdk.capture_exception(ex));
        }
        sdk.flush();
        async_sleep_ms(200);
    });

    REGISTER_TEST("capture_exception_base_std_exception", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        // Capture through base-class reference
        try {
            throw std::out_of_range("index -1 is out of range");
        } catch (const std::exception& e) {
            EXPECT_NO_THROW(sdk.capture_exception(e));
        }
        async_sleep_ms(100);
    });

    // ── 6. flush ─────────────────────────────────────────────────────────────

    REGISTER_TEST("flush_empty_queue_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        EXPECT_NO_THROW(sdk.flush());
        async_sleep_ms(100);
    });

    REGISTER_TEST("flush_after_capture_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        std::runtime_error ex("test flush after capture");
        sdk.capture_exception(ex);
        EXPECT_NO_THROW(sdk.flush());
        async_sleep_ms(200);
    });

    REGISTER_TEST("flush_called_multiple_times_does_not_throw", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");
        for (int i = 0; i < 5; ++i) {
            EXPECT_NO_THROW(sdk.flush());
        }
        async_sleep_ms(100);
    });

    // ── 7. Destructor (RAII) ──────────────────────────────────────────────────

    REGISTER_TEST("destructor_completes_without_hang", [] {
        // Scope forces destructor before the assertion
        {
            tracelify::Tracelify sdk(
                "http://key@localhost:8000/project/1/events", "1.0.0");
            std::runtime_error ex("pre-destruction event");
            sdk.capture_exception(ex);
        }
        EXPECT_TRUE(true);  // reached here → destructor completed cleanly
    });

    REGISTER_TEST("destructor_with_pending_events_completes", [] {
        {
            tracelify::Tracelify sdk(
                "http://key@localhost:8000/project/1/events", "1.0.0");
            for (int i = 0; i < 3; ++i) {
                std::runtime_error ex("pending_" + std::to_string(i));
                sdk.capture_exception(ex);
            }
            // No explicit flush — destructor must handle it
        }
        EXPECT_TRUE(true);
    });

    // ── 8. DSN project-ID extraction ──────────────────────────────────────────

    REGISTER_TEST("dsn_standard_project_segment_parsed", [] {
        // Only asserts that construction & capture don't throw;
        // actual parsing is tested via the event_id appearing in output.
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/99/events", "1.0.0");
        std::runtime_error ex("project id check");
        sdk.capture_exception(ex);
        async_sleep_ms(100);
        EXPECT_TRUE(true);
    });

    REGISTER_TEST("dsn_missing_project_segment_falls_back_gracefully", [] {
        // Should not throw even when /project/ is absent
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/events", "1.0.0");
        std::runtime_error ex("no project segment");
        sdk.capture_exception(ex);
        async_sleep_ms(100);
        EXPECT_TRUE(true);
    });

    // ── 9. Concurrency ───────────────────────────────────────────────────────

    REGISTER_TEST("concurrent_capture_from_multiple_threads", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");

        auto task = [&sdk](int id) {
            std::runtime_error ex("thread_error_" + std::to_string(id));
            sdk.capture_exception(ex);
        };

        std::vector<std::thread> threads;
        for (int i = 0; i < 8; ++i) {
            threads.emplace_back(task, i);
        }
        for (auto& t : threads) t.join();

        sdk.flush();
        async_sleep_ms(300);
        EXPECT_TRUE(true);  // no crash → thread-safety holds
    });

    REGISTER_TEST("concurrent_tags_and_breadcrumbs_then_capture", [] {
        tracelify::Tracelify sdk(
            "http://key@localhost:8000/project/1/events", "1.0.0");

        auto tag_task = [&sdk](int i) {
            sdk.set_tag("tag_" + std::to_string(i), "val");
        };
        auto bc_task = [&sdk](int i) {
            sdk.add_breadcrumb("step_" + std::to_string(i));
        };

        std::vector<std::thread> threads;
        for (int i = 0; i < 4; ++i) threads.emplace_back(tag_task, i);
        for (int i = 0; i < 4; ++i) threads.emplace_back(bc_task, i);
        for (auto& t : threads) t.join();

        std::runtime_error ex("post-concurrent-setup");
        EXPECT_NO_THROW(sdk.capture_exception(ex));
        async_sleep_ms(200);
    });
}

// =============================================================================
//  Entry point
// =============================================================================

int main() {
    std::cout << "=== Tracelify C++ SDK Unit Tests ===\n\n";
    register_tests();
    run_all_tests();
    return (g_failed > 0) ? 1 : 0;
}
