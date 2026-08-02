#include "../include/tracelify.h"
#include <iostream>
#include <sstream>
#include <chrono>
#include <iomanip>
#include <random>
#include <exception>
#include <typeinfo>

namespace tracelify {

static Tracelify* g_tracelify_instance = nullptr;

static void global_terminate_handler() {
    std::cerr << "Fatal C++ Crash Intercepted by Tracelify Global Handler!\n";
    if (g_tracelify_instance) {
        try {
            // Attempt to rethrow current exception to parse it
            if (std::current_exception()) {
                std::rethrow_exception(std::current_exception());
            }
        } catch (const std::exception& e) {
            g_tracelify_instance->capture_exception(e);
        } catch (...) {
            std::runtime_error err("Unknown C++ Terminate Exception");
            g_tracelify_instance->capture_exception(err);
        }
        g_tracelify_instance->flush();
    }
    std::abort();
}

void Tracelify::init_global_handlers(Tracelify* instance) {
    g_tracelify_instance = instance;
    std::set_terminate(global_terminate_handler);
}

Tracelify::Tracelify(const std::string& dsn, const std::string& release) : dsn(dsn), release(release) {
    worker_thread = std::thread(&Tracelify::worker_loop, this);
    init_global_handlers(this);
}

Tracelify::~Tracelify() {
    flush();
    {
        std::lock_guard<std::mutex> lock(queue_mutex);
        stop_worker = true;
    }
    queue_cv.notify_all();
    if (worker_thread.joinable()) {
        worker_thread.join();
    }
}

void Tracelify::worker_loop() {
    while (true) {
        std::vector<std::string> batch;
        {
            std::unique_lock<std::mutex> lock(queue_mutex);
            queue_cv.wait(lock, [this]{ return stop_worker || !log_queue.empty(); });
            
            if (stop_worker && log_queue.empty()) {
                break;
            }

            // Pop up to 5 events for batching
            while (!log_queue.empty() && batch.size() < 5) {
                batch.push_back(log_queue.front());
                log_queue.pop();
            }
        }
        
        if (!batch.empty()) {
            std::cout << "\n[Async Worker] Non-Blocking FLUSH for " << batch.size() << " items...\n";
            for (size_t i = 0; i < batch.size(); ++i) {
                std::string payload = batch[i];
                // Escape single quotes for shell safety
                std::string escaped_payload;
                for (char c : payload) {
                    if (c == '\'') escaped_payload += "'\"'\"'";
                    else escaped_payload += c;
                }
                
                std::string cmd = "curl -s -o /dev/null -X POST -H 'Content-Type: application/json' -d '" + escaped_payload + "' " + dsn;
                int result = std::system(cmd.c_str());
                if (result == 0) {
                    std::cout << "✅ Dispatched event to Tracelify API\n";
                } else {
                    std::cerr << "❌ Failed to dispatch event to Tracelify\n";
                }
            }
        }
    }
}

void Tracelify::flush() {
    // Notify worker to wake up instantly and dump everything
    queue_cv.notify_all();
}

void Tracelify::set_user(const std::map<std::string, std::string>& user) {
    this->user = user;
}

void Tracelify::set_tag(const std::string& key, const std::string& value) {
    this->tags[key] = value;
}

void Tracelify::add_breadcrumb(const std::string& message) {
    this->breadcrumbs.push_back(message);
}

std::string Tracelify::get_project_id() const {
    size_t pos = dsn.find("/project/");
    if (pos == std::string::npos) {
        pos = dsn.find("/api/");
        if (pos != std::string::npos) {
            size_t start = pos + 5;
            size_t end = dsn.find("/", start);
            if (end != std::string::npos) {
                return dsn.substr(start, end - start);
            }
        }
    } else {
        size_t start = pos + 9;
        size_t end = dsn.find("/", start);
        if (end != std::string::npos) {
            return dsn.substr(start, end - start);
        }
    }
    return "1";
}

std::string Tracelify::generate_event_id() const {
    static const char chars[] = "0123456789abcdef";
    std::string id;
    std::mt19937 rng(std::random_device{}());
    std::uniform_int_distribution<> dist(0, 15);
    for (int i = 0; i < 32; ++i) {
        id += chars[dist(rng)];
    }
    return id;
}

std::string Tracelify::get_timestamp() const {
    auto now = std::chrono::system_clock::now();
    auto in_time_t = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%S.000000+00:00");
    return ss.str();
}

std::string Tracelify::escape_json_string(const std::string& s) const {
    std::string out;
    for (char c : s) {
        if (c == '"') out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else out += c;
    }
    return out;
}

void Tracelify::capture_exception(const std::exception& e) {
    std::stringstream json;
    json << "{";
    json << "\"event_id\": \"" << generate_event_id() << "\", ";
    json << "\"project_id\": \"" << get_project_id() << "\", ";
    json << "\"timestamp\": \"" << get_timestamp() << "\", ";
    json << "\"level\": \"error\", ";
    json << "\"release\": \"" << release << "\", ";
    
    json << "\"client\": {\"sdk\": \"tracelify.cpp\"}, ";
    
    json << "\"error\": {";
    std::string exType = typeid(e).name(); 
    json << "\"type\": \"" << exType << "\", ";
    json << "\"message\": \"" << escape_json_string(e.what()) << "\", ";
    json << "\"stacktrace\": \"\"";
    json << "}, ";
    
    json << "\"context\": {";
    json << "\"os\": \"Windows\", ";
    json << "\"runtime\": \"cpp\", ";
    json << "\"cpp_version\": \"14\"";
    json << "}";
    
    if (!user.empty()) {
        json << ", \"user\": {";
        bool first = true;
        for (const auto& kv : user) {
            if (!first) json << ", ";
            json << "\"" << kv.first << "\": \"" << escape_json_string(kv.second) << "\"";
            first = false;
        }
        json << "}";
    }
    
    if (!tags.empty()) {
        json << ", \"tags\": {";
        bool first = true;
        for (const auto& kv : tags) {
            if (!first) json << ", ";
            json << "\"" << kv.first << "\": \"" << escape_json_string(kv.second) << "\"";
            first = false;
        }
        json << "}";
    }
    
    if (!breadcrumbs.empty()) {
        json << ", \"breadcrumbs\": [";
        bool first = true;
        for (const auto& msg : breadcrumbs) {
            if (!first) json << ", ";
            json << "{\"message\": \"" << escape_json_string(msg) << "\"}";
            first = false;
        }
        json << "]";
    }
    
    json << "}";
    
    // Batch processing: Route to async worker rather than syncing natively
    {
        std::lock_guard<std::mutex> lock(queue_mutex);
        log_queue.push(json.str());
    }
    queue_cv.notify_one();
}

}
