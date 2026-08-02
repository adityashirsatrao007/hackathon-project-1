import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useFetch } from "@/hooks/useFetch";
import { projectsApi } from "@/services/api/apiHandler";
import { QUERY_KEYS, PLATFORMS } from "@/utils/constants";
import { cn } from "@/utils/helpers";
import {
  Book,
  Copy,
  Check,
  ChevronRight,
  Terminal,
  Zap,
  AlertCircle,
  Tag,
  Footprints,
  RefreshCw,
} from "lucide-react";
import { copyToClipboard } from "@/utils/helpers";

/* ─── Code block with copy ────────────────────────────────────────────────── */
function CodeBlock({ code, lang = "python" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-black/50 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2">
        <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 text-slate-300 font-mono">
        {code}
      </pre>
    </div>
  );
}

/* ─── Section card ────────────────────────────────────────────────────────── */
function DocSection({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
        <Icon className="h-4 w-4 text-violet-400 shrink-0" />
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ─── SDK Docs per language ─────────────────────────────────────────────────── */
function PythonDocs({ dsn }) {
  return (
    <div className="space-y-6">
      <DocSection icon={Terminal} title="Installation">
        <CodeBlock lang="bash" code={`pip install tracelify`} />
        <p className="text-[12px] text-slate-500">
          Or copy the <code className="bg-white/5 px-1 rounded text-violet-300">tracelify/</code> folder directly into your project root.
        </p>
      </DocSection>

      <DocSection icon={Zap} title="Initialize">
        <CodeBlock lang="python" code={`import tracelify

sdk = tracelify.Tracelify(
    dsn="${dsn}",
    release="1.0.0"
)

# Auto captures all unhandled exceptions — no extra setup needed`} />
      </DocSection>

      <DocSection icon={AlertCircle} title="Capture Exceptions">
        <CodeBlock lang="python" code={`try:
    result = 10 / 0
except Exception as e:
    sdk.capture_exception(e)

# Or with a custom level
sdk.capture_exception(e, level="warning")`} />
      </DocSection>

      <DocSection icon={Tag} title="Set User & Tags">
        <CodeBlock lang="python" code={`sdk.set_user({"id": "user_123", "email": "user@example.com"})
sdk.set_tag("environment", "production")
sdk.set_tag("version", "2.1.0")`} />
      </DocSection>

      <DocSection icon={Footprints} title="Breadcrumbs">
        <CodeBlock lang="python" code={`sdk.add_breadcrumb("User clicked checkout button")
sdk.add_breadcrumb("Payment service called")
sdk.add_breadcrumb("Order created #4521")`} />
      </DocSection>

      <DocSection icon={RefreshCw} title="Flush on Exit">
        <CodeBlock lang="python" code={`# Ensure all events are sent before process exits
sdk.flush(timeout=5.0)`} />
      </DocSection>
    </div>
  );
}

function CppDocs({ dsn }) {
  return (
    <div className="space-y-6">
      <DocSection icon={Terminal} title="Installation">
        <p className="text-[12px] text-slate-400">Add the SDK files to your project:</p>
        <CodeBlock lang="bash" code={`# Copy the SDK into your project
cp -r tracelify-cpp/include/ your-project/include/
cp -r tracelify-cpp/src/     your-project/src/`} />
        <p className="text-[12px] text-slate-500 mt-2">Add to your <code className="bg-white/5 px-1 rounded text-violet-300">CMakeLists.txt</code>:</p>
        <CodeBlock lang="cmake" code={`include_directories(include)
add_executable(myapp main.cpp src/tracelify.cpp)
target_link_libraries(myapp curl pthread)`} />
      </DocSection>

      <DocSection icon={Zap} title="Initialize">
        <CodeBlock lang="cpp" code={`#include "tracelify.h"

int main() {
    tracelify::Tracelify sdk(
        "${dsn}",
        "v1.0.0"           // release version
    );

    // Automatically installs global signal/crash handlers
    tracelify::Tracelify::init_global_handlers(&sdk);

    // ... your app code ...

    sdk.flush();  // send queued events before exit
    return 0;
}`} />
      </DocSection>

      <DocSection icon={AlertCircle} title="Capture Exceptions">
        <CodeBlock lang="cpp" code={`try {
    int result = 10 / 0;  // or any throwing operation
} catch (const std::exception& e) {
    sdk.capture_exception(e);
}`} />
      </DocSection>

      <DocSection icon={Tag} title="Set User & Tags">
        <CodeBlock lang="cpp" code={`sdk.set_user({
    {"id",    "user_123"},
    {"email", "user@example.com"}
});

sdk.set_tag("environment", "production");
sdk.set_tag("version",     "2.1.0");`} />
      </DocSection>

      <DocSection icon={Footprints} title="Breadcrumbs">
        <CodeBlock lang="cpp" code={`sdk.add_breadcrumb("Request received");
sdk.add_breadcrumb("Database query started");
sdk.add_breadcrumb("Cache miss - fetching from DB");`} />
      </DocSection>

      <DocSection icon={RefreshCw} title="Flush">
        <CodeBlock lang="cpp" code={`// Blocks until all events are flushed (background thread)
sdk.flush();`} />
      </DocSection>
    </div>
  );
}

function JavaDocs({ dsn }) {
  return (
    <div className="space-y-6">
      <DocSection icon={Terminal} title="Installation (Maven)">
        <CodeBlock lang="xml" code={`<dependency>
  <groupId>com.tracelify</groupId>
  <artifactId>tracelify-java</artifactId>
  <version>1.0.0</version>
</dependency>`} />
        <p className="text-[12px] text-slate-500 mt-2">
          Or compile <code className="bg-white/5 px-1 rounded text-violet-300">Tracelify.java</code> directly into your project.
        </p>
      </DocSection>

      <DocSection icon={Zap} title="Initialize">
        <CodeBlock lang="java" code={`import com.tracelify.Tracelify;

public class App {
    public static void main(String[] args) {
        Tracelify sdk = new Tracelify(
            "${dsn}",
            "v1.0.0"           // release version
        );

        // Automatically installs JVM uncaught exception handler
        // ... your app code ...

        sdk.shutdown(); // flush and clean up executor
    }
}`} />
      </DocSection>

      <DocSection icon={AlertCircle} title="Capture Exceptions">
        <CodeBlock lang="java" code={`try {
    int result = 10 / 0;
} catch (Exception e) {
    sdk.captureException(e);
}`} />
      </DocSection>

      <DocSection icon={Tag} title="Set User & Tags">
        <CodeBlock lang="java" code={`Map<String, Object> user = new HashMap<>();
user.put("id",    "user_123");
user.put("email", "user@example.com");
sdk.setUser(user);

sdk.setTag("environment", "production");
sdk.setTag("version",     "2.1.0");`} />
      </DocSection>

      <DocSection icon={Footprints} title="Breadcrumbs">
        <CodeBlock lang="java" code={`sdk.addBreadcrumb("Request received at /api/checkout");
sdk.addBreadcrumb("Payment service called");
sdk.addBreadcrumb("Order persisted to DB");`} />
      </DocSection>

      <DocSection icon={RefreshCw} title="Flush & Shutdown">
        <CodeBlock lang="java" code={`// Flush pending events and shut down the executor thread
sdk.flush();    // fire-and-forget async flush
sdk.shutdown(); // flush + await termination (use before JVM exit)`} />
      </DocSection>
    </div>
  );
}

/* ─── Language selector + docs ─────────────────────────────────────────────── */
const LANG_TABS = [
  { id: "python", label: "Python",    icon: "🐍" },
  { id: "cpp",    label: "C++",       icon: "⚙️" },
  { id: "java",   label: "Java",      icon: "☕" },
];

const platformToLang = {
  python: "python", django: "python", flask: "python", fastapi: "python",
  javascript: "python", react: "python", node: "python",
  java: "java",
  cpp: "cpp",
};

/* ─── Main Docs Page ─────────────────────────────────────────────────────────── */
export default function DocsPage() {
  const { orgId, projectId } = useParams();
  const navigate = useNavigate();

  const { data: project } = useFetch(
    QUERY_KEYS.PROJECT(projectId),
    () => projectsApi.getProject(projectId),
    { enabled: !!projectId },
  );

  const { data: dsnKeys = [] } = useFetch(
    QUERY_KEYS.PROJECT_DSN(projectId),
    () => projectsApi.listDsnKeys(projectId),
    { enabled: !!projectId },
  );

  const backendUrl = import.meta.env.VITE_API_BASE_URL || "";
  const backendHost = backendUrl ? new URL(backendUrl).host : "localhost:8000";
  const rawDsn = dsnKeys[0]?.dsn ?? "<your-dsn>";
  const activeDsn = rawDsn.replace("localhost:8000", backendHost);

  // Auto-select language based on project platform
  const defaultLang = platformToLang[project?.platform] ?? "python";
  const [activeLang, setActiveLang] = useState(null);
  const lang = activeLang ?? defaultLang;

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
            <button
              onClick={() => navigate(`/orgs/${orgId}/projects`)}
              className="hover:text-slate-300 transition-colors"
            >
              Projects
            </button>
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}`)}
              className="hover:text-slate-300 transition-colors"
            >
              {project?.name ?? "…"}
            </button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-400">Documentation</span>
          </div>
          <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-100">
            <Book className="h-5 w-5 text-violet-400" />
            SDK Documentation
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Integrate Tracelify into your <span className="text-violet-300 font-medium">{project?.name}</span> project
          </p>
        </div>
      </div>

      {/* DSN banner */}
      {activeDsn !== "<your-dsn>" && (
        <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 px-4 py-3 flex items-center gap-3">
          <Zap className="h-4 w-4 text-violet-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-slate-500 mb-0.5">Your DSN (pre-filled in snippets below)</p>
            <p className="text-[12px] font-mono text-violet-300 truncate">{activeDsn}</p>
          </div>
        </div>
      )}

      {/* Language tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 w-fit">
        {LANG_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveLang(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium transition-all",
              lang === tab.id
                ? "bg-violet-600/20 text-violet-300 shadow-sm"
                : "text-slate-500 hover:text-slate-300",
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Docs content */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6">
        {lang === "python" && <PythonDocs dsn={activeDsn} />}
        {lang === "cpp"    && <CppDocs    dsn={activeDsn} />}
        {lang === "java"   && <JavaDocs   dsn={activeDsn} />}
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}`)}
          className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          ← Back to project
        </button>
        <button
          onClick={() => navigate(`/orgs/${orgId}/projects/${projectId}/issues`)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-violet-500 transition-colors"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          View Issues
        </button>
      </div>
    </div>
  );
}
