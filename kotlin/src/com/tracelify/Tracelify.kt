package com.tracelify

import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URI
import java.util.UUID
import java.text.SimpleDateFormat
import java.util.Date
import java.util.TimeZone

class Tracelify(val dsn: String, val release: String) {

    private val protocol: String
    private val host: String
    private val port: Int
    private val publicKey: String
    private val projectId: String
    private val endpoint: String

    private var user: Map<String, Any> = mapOf()
    private val tags: MutableMap<String, String> = mutableMapOf()
    private val breadcrumbs: MutableList<String> = mutableListOf()

    init {
        val uri = URI(dsn)
        protocol = uri.scheme ?: "http"
        host = uri.host ?: "localhost"
        port = if (uri.port != -1) uri.port else 8000
        val userInfo = uri.userInfo
        publicKey = userInfo ?: "demo_key"

        var path = uri.path ?: ""
        if (path.startsWith("/")) path = path.substring(1)
        var parts = path.split("/").toMutableList()
        if (parts.isNotEmpty() && parts[0] == "api") parts.removeAt(0)
        if (parts.isNotEmpty() && parts.last() == "events") parts.removeAt(parts.size - 1)
        
        projectId = if (parts.isNotEmpty()) parts[0] else "unknown"
        endpoint = "$protocol://$host:$port/api/$projectId/events"
    }

    fun setUser(user: Map<String, Any>) {
        this.user = user
    }

    fun setTag(key: String, value: String) {
        this.tags[key] = value
    }

    fun addBreadcrumb(message: String) {
        this.breadcrumbs.add(message)
    }

    fun captureException(error: Throwable) {
        val stacktrace = error.stackTraceToString()
        
        val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'")
        dateFormat.timeZone = TimeZone.getTimeZone("UTC")
        val timestamp = dateFormat.format(Date())

        val event = mutableMapOf<String, Any>(
            "event_id" to UUID.randomUUID().toString(),
            "project_id" to projectId,
            "timestamp" to timestamp,
            "level" to "error",
            "release" to release,
            "client" to mapOf("sdk" to "tracelify.kotlin"),
            "error" to mapOf(
                "type" to error.javaClass.simpleName,
                "message" to (error.message ?: "Unknown error"),
                "stacktrace" to stacktrace
            )
        )

        if (user.isNotEmpty()) {
            event["user"] = user
        }
        if (tags.isNotEmpty()) {
            event["tags"] = tags
        }

        Thread {
            sendEvent(event)
        }.start()
    }

    private fun escapeJsonStr(str: String): String {
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\b", "\\b")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t")
    }

    private fun Any?.toJsonString(): String {
        if (this == null) return "null"
        if (this is String) return "\"${escapeJsonStr(this)}\""
        if (this is Number || this is Boolean) return this.toString()
        if (this is Map<*, *>) {
            return this.entries.joinToString(prefix = "{", postfix = "}") {
                "\"${escapeJsonStr(it.key.toString())}\":${it.value.toJsonString()}"
            }
        }
        if (this is List<*>) {
            return this.joinToString(prefix = "[", postfix = "]") {
                it.toJsonString()
            }
        }
        return "\"${escapeJsonStr(this.toString())}\""
    }

    private fun sendEvent(event: Map<String, Any>) {
        try {
            val jsonPayload = event.toJsonString()
            val url = URL(endpoint)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Authorization", "Bearer $publicKey")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 5000

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(jsonPayload)
                writer.flush()
            }

            val responseCode = conn.responseCode
            if (responseCode != 202) {
                println("Warning: Tracelify responded $responseCode")
            } else {
                println("✅ Event accepted by Tracelify")
            }
        } catch (e: Exception) {
            println("Error sending event to Tracelify: ${e.message}")
        }
    }

    fun shutdown() {
        Thread.sleep(2000)
    }
}
