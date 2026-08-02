#ifndef TRACELIFY_H
#define TRACELIFY_H

#include <string>
#include <map>
#include <vector>
#include <exception>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <memory>

namespace tracelify {

class Tracelify {
public:
    Tracelify(const std::string& dsn, const std::string& release);
    ~Tracelify();

    void set_user(const std::map<std::string, std::string>& user);
    void set_tag(const std::string& key, const std::string& value);
    void add_breadcrumb(const std::string& message);
    void capture_exception(const std::exception& e);
    
    // Explicit network flush interface
    void flush();

    // Global Singleton hook required for True Crash Reporting
    static void init_global_handlers(Tracelify* instance);

private:
    std::string dsn;
    std::string release;
    std::map<std::string, std::string> user;
    std::map<std::string, std::string> tags;
    std::vector<std::string> breadcrumbs;

    std::string get_project_id() const;
    std::string generate_event_id() const;
    std::string get_timestamp() const;
    std::string escape_json_string(const std::string& s) const;

    // Async Non-Blocking Components
    std::queue<std::string> log_queue;
    std::mutex queue_mutex;
    std::condition_variable queue_cv;
    std::thread worker_thread;
    std::atomic<bool> stop_worker{false};

    void worker_loop();
};

}

#endif // TRACELIFY_H
