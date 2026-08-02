package com.tracelify;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.util.TimeZone;
import java.util.UUID;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

public class Tracelify {
    private String release;
    private Map<String, Object> user = new HashMap<>();
    private Map<String, String> tags = new HashMap<>();
    private List<Map<String, String>> breadcrumbs = new ArrayList<>();

    // Parsed from DSN
    private String endpointUrl;   // e.g. http://host:8000/api/<project_id>/events
    private String publicKey;     // e.g. f965e01d...
    private String projectId;     // UUID string extracted from DSN path

    // Async Worker & Batching
    private ExecutorService executor = Executors.newSingleThreadExecutor();
    private BlockingQueue<Map<String, Object>> logBatchQueue = new LinkedBlockingQueue<>(500);

    public Tracelify(String dsn, String release) {
        this.release = release;
        parseDsn(dsn);
        enableGlobalCrashReporting();
    }

    // ── DSN Parsing ────────────────────────────────────────────────────────────
    // DSN format: http://<public_key>@<host>:<port>/api/<project_id>/events
    private void parseDsn(String dsn) {
        try {
            if (dsn == null || dsn.isEmpty()) return;

            URI uri = new URI(dsn);

            // Extract public_key from userInfo (the part before '@')
            String userInfo = uri.getUserInfo();
            if (userInfo != null && !userInfo.isEmpty()) {
                this.publicKey = userInfo.split(":")[0];
            }

            // Reconstruct endpoint URL without userInfo
            String scheme = uri.getScheme();
            String host = uri.getHost();
            int port = uri.getPort();
            String path = uri.getPath(); // e.g. /api/<project_id>/events

            // Extract project_id from path.
            // Supports: /api/<project_id>/events  (real Tracelify DSN)
            //           /project/<project_id>/events  (legacy / test DSN)
            String[] segments = path.split("/");
            for (int i = 0; i < segments.length - 1; i++) {
                if (("api".equals(segments[i]) || "project".equals(segments[i]))
                        && i + 1 < segments.length
                        && !segments[i + 1].isEmpty()) {
                    this.projectId = segments[i + 1];
                    break;
                }
            }

            // Fallback: DSN has no recognisable project segment
            if (this.projectId == null || this.projectId.isEmpty()) {
                this.projectId = "1";
            }

            // Build clean endpoint URL (no credentials)
            String portStr = (port > 0) ? ":" + port : "";
            this.endpointUrl = scheme + "://" + host + portStr + path;

        } catch (Exception e) {
            System.err.println("[Tracelify] Failed to parse DSN: " + e.getMessage());
        }
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    public void setUser(Map<String, Object> user) {
        this.user = user;
    }

    public void setTag(String key, String value) {
        this.tags.put(key, value);
    }

    public void addBreadcrumb(String message) {
        Map<String, String> breadcrumb = new HashMap<>();
        breadcrumb.put("message", message);
        this.breadcrumbs.add(breadcrumb);
    }

    public void captureException(Exception e) {
        Map<String, Object> event = new HashMap<>();
        event.put("event_id", UUID.randomUUID().toString().replace("-", ""));
        event.put("project_id", projectId != null ? projectId : "");

        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX");
        sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
        event.put("timestamp", sdf.format(new Date()));

        event.put("level", "error");
        event.put("release", this.release);

        Map<String, Object> client = new HashMap<>();
        client.put("sdk", "tracelify.java");
        event.put("client", client);

        Map<String, Object> error = new HashMap<>();
        error.put("type", e.getClass().getSimpleName());
        error.put("message", e.getMessage() != null ? e.getMessage() : "");

        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        error.put("stacktrace", sw.toString());
        event.put("error", error);

        Map<String, Object> context = new HashMap<>();
        context.put("os", System.getProperty("os.name"));
        context.put("runtime", "java");
        context.put("java_version", System.getProperty("java.version"));
        event.put("context", context);

        if (!this.user.isEmpty()) {
            event.put("user", this.user);
        }
        if (!this.tags.isEmpty()) {
            event.put("tags", this.tags);
        }
        if (!this.breadcrumbs.isEmpty()) {
            event.put("breadcrumbs", this.breadcrumbs);
        }

        // Asynchronous Batching
        logBatchQueue.offer(event);
        if (logBatchQueue.size() >= 5) {
            flush();
        }
    }

    public void flush() {
        if (executor.isShutdown()) return;
        executor.submit(() -> {
            List<Map<String, Object>> batch = new ArrayList<>();
            logBatchQueue.drainTo(batch);
            if (!batch.isEmpty()) {
                System.out.println("\n[Async Worker] Non-Blocking FLUSH for " + batch.size() + " items:");
                for (Map<String, Object> event : batch) {
                    String json = mapToJson(event);
                    System.out.println(json);
                    dispatchToBackend(json);
                }
            }
        });
    }

    // ── HTTP Dispatch ──────────────────────────────────────────────────────────
    private void dispatchToBackend(String jsonPayload) {
        if (endpointUrl == null || endpointUrl.isEmpty()) {
            System.err.println("[Tracelify] No endpoint URL — event not sent.");
            return;
        }
        if (publicKey == null || publicKey.isEmpty()) {
            System.err.println("[Tracelify] No public key — event not sent.");
            return;
        }

        try {
            URL url = new URL(endpointUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + publicKey);

            byte[] body = jsonPayload.getBytes(StandardCharsets.UTF_8);
            conn.setRequestProperty("Content-Length", String.valueOf(body.length));

            try (OutputStream os = conn.getOutputStream()) {
                os.write(body);
            }

            int status = conn.getResponseCode();
            if (status == 202 || status == 200) {
                System.out.println("[Tracelify] ✅ Event dispatched — HTTP " + status);
            } else {
                System.err.println("[Tracelify] ⚠️  Backend returned HTTP " + status + " for event.");
            }
            conn.disconnect();

        } catch (Exception ex) {
            System.err.println("[Tracelify] ❌ HTTP dispatch failed: " + ex.getMessage());
        }
    }

    // ── Crash Reporting ────────────────────────────────────────────────────────
    private void enableGlobalCrashReporting() {
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            System.err.println("Fatal JVM Crash Intercepted by Tracelify Global Handler!");
            Exception e = (throwable instanceof Exception) ? (Exception) throwable : new Exception(throwable);
            captureException(e);

            // Ensure network completes before process dies
            flush();
            executor.shutdown();
            try {
                executor.awaitTermination(5, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {}
        });
    }

    public void shutdown() {
        flush();
        executor.shutdown();
        try {
            executor.awaitTermination(5, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {}
    }

    // ── JSON Serialisation (zero-dependency) ───────────────────────────────────
    @SuppressWarnings("unchecked")
    private String mapToJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder();
        sb.append("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) sb.append(", ");
            first = false;
            sb.append("\"").append(escape(entry.getKey())).append("\": ");
            Object value = entry.getValue();
            if (value == null) {
                sb.append("null");
            } else if (value instanceof Map) {
                sb.append(mapToJson((Map<String, Object>) value));
            } else if (value instanceof List) {
                sb.append(listToJson((List<?>) value));
            } else if (value instanceof String) {
                sb.append("\"").append(escape((String) value)).append("\"");
            } else if (value instanceof Boolean || value instanceof Number) {
                sb.append(value);
            } else {
                sb.append("\"").append(escape(value.toString())).append("\"");
            }
        }
        sb.append("}");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private String listToJson(List<?> list) {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        boolean first = true;
        for (Object item : list) {
            if (!first) sb.append(", ");
            first = false;
            if (item == null) {
                sb.append("null");
            } else if (item instanceof Map) {
                sb.append(mapToJson((Map<String, Object>) item));
            } else if (item instanceof List) {
                sb.append(listToJson((List<?>) item));
            } else if (item instanceof String) {
                sb.append("\"").append(escape((String) item)).append("\"");
            } else if (item instanceof Boolean || item instanceof Number) {
                sb.append(item);
            } else {
                sb.append("\"").append(escape(item.toString())).append("\"");
            }
        }
        sb.append("]");
        return sb.toString();
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
