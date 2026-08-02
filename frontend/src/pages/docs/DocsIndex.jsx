import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Book, ChevronRight, Zap, AlertCircle, Tag, Footprints, RefreshCw, Terminal, Copy, Check } from "lucide-react";
import { cn, copyToClipboard } from "@/utils/helpers";

function CodeBlock({ code, lang = "python" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => { await copyToClipboard(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="group relative rounded-xl border border-white/[0.06] bg-black/50 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2">
        <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">{lang}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12px] leading-6 text-slate-300 font-mono">{code}</pre>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-200">
        <Icon className="h-4 w-4 text-violet-400" />{title}
      </h3>
      {children}
    </div>
  );
}

const TABS = [
  { id: "python", label: "Python",  icon: "🐍" },
  { id: "cpp",    label: "C++",     icon: "⚙️" },
  { id: "java",   label: "Java",    icon: "☕" },
];

export default function DocsIndex() {
  const navigate = useNavigate();
  const [lang, setLang] = useState("python");
  const DSN = "<your-dsn-from-project-settings>";

  return (
    <div className="animate-fade-in space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2.5 text-[20px] font-bold text-slate-100">
          <Book className="h-5 w-5 text-violet-400" /> SDK Documentation
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Integrate Tracelify into your application. Get your DSN from{" "}
          <button onClick={() => navigate("/orgs")} className="text-violet-400 hover:underline">
            Project → Settings
          </button>.
        </p>
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <Zap className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[12px] text-slate-400">
          Open a specific <span className="text-amber-300">Project → Docs</span> to see snippets with your real DSN pre-filled.
        </p>
      </div>

      {/* Language tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setLang(t.id)}
            className={cn("flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium transition-all",
              lang === t.id ? "bg-violet-600/20 text-violet-300" : "text-slate-500 hover:text-slate-300")}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Docs */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 space-y-6">
        {lang === "python" && <>
          <Section icon={Terminal} title="Install"><CodeBlock lang="bash" code="pip install tracelify" /></Section>
          <Section icon={Zap} title="Initialize">
            <CodeBlock lang="python" code={`import tracelify\nsdk = tracelify.Tracelify(dsn="${DSN}", release="1.0.0")`} />
          </Section>
          <Section icon={AlertCircle} title="Capture Exceptions">
            <CodeBlock lang="python" code={`try:\n    x = 10 / 0\nexcept Exception as e:\n    sdk.capture_exception(e)`} />
          </Section>
          <Section icon={Tag} title="Set User & Tags">
            <CodeBlock lang="python" code={`sdk.set_user({"id": "user_123"})\nsdk.set_tag("env", "production")`} />
          </Section>
          <Section icon={Footprints} title="Breadcrumbs">
            <CodeBlock lang="python" code={`sdk.add_breadcrumb("User logged in")\nsdk.add_breadcrumb("Payment initiated")`} />
          </Section>
          <Section icon={RefreshCw} title="Flush on Exit">
            <CodeBlock lang="python" code={`sdk.flush(timeout=5.0)`} />
          </Section>
        </>}

        {lang === "cpp" && <>
          <Section icon={Terminal} title="Install">
            <p className="text-[12px] text-slate-400">Copy <code className="bg-white/5 px-1 rounded text-violet-300">tracelify.h</code> + <code className="bg-white/5 px-1 rounded text-violet-300">tracelify.cpp</code> into your project.</p>
            <CodeBlock lang="cmake" code={`include_directories(include)\nadd_executable(app main.cpp src/tracelify.cpp)\ntarget_link_libraries(app curl pthread)`} />
          </Section>
          <Section icon={Zap} title="Initialize">
            <CodeBlock lang="cpp" code={`#include "tracelify.h"\ntracelify::Tracelify sdk("${DSN}", "v1.0.0");\ntracelify::Tracelify::init_global_handlers(&sdk);`} />
          </Section>
          <Section icon={AlertCircle} title="Capture">
            <CodeBlock lang="cpp" code={`try {\n    throw std::runtime_error("Something broke");\n} catch (const std::exception& e) {\n    sdk.capture_exception(e);\n}`} />
          </Section>
          <Section icon={Tag} title="User & Tags">
            <CodeBlock lang="cpp" code={`sdk.set_user({{"id","user_123"},{"email","u@x.com"}});\nsdk.set_tag("env", "production");`} />
          </Section>
          <Section icon={RefreshCw} title="Flush">
            <CodeBlock lang="cpp" code={`sdk.flush();`} />
          </Section>
        </>}

        {lang === "java" && <>
          <Section icon={Terminal} title="Install (Maven)">
            <CodeBlock lang="xml" code={`<dependency>\n  <groupId>com.tracelify</groupId>\n  <artifactId>tracelify-java</artifactId>\n  <version>1.0.0</version>\n</dependency>`} />
          </Section>
          <Section icon={Zap} title="Initialize">
            <CodeBlock lang="java" code={`Tracelify sdk = new Tracelify("${DSN}", "v1.0.0");`} />
          </Section>
          <Section icon={AlertCircle} title="Capture">
            <CodeBlock lang="java" code={`try {\n    int x = 10 / 0;\n} catch (Exception e) {\n    sdk.captureException(e);\n}`} />
          </Section>
          <Section icon={Tag} title="User & Tags">
            <CodeBlock lang="java" code={`Map<String,Object> u = Map.of("id","user_123");\nsdk.setUser(u);\nsdk.setTag("env", "production");`} />
          </Section>
          <Section icon={RefreshCw} title="Shutdown">
            <CodeBlock lang="java" code={`sdk.flush();\nsdk.shutdown();`} />
          </Section>
        </>}
      </div>
    </div>
  );
}
