import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/* ══════════════════════ HELPERS ══════════════════════ */
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ══════════════════════ FONTS ══════════════════════ */
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700;1,900&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

@keyframes floatY   { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-18px) rotate(2deg)} }
@keyframes floatY2  { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-12px) rotate(-3deg)} }
@keyframes spinSlow { from{transform:rotateY(0deg) rotateX(12deg)} to{transform:rotateY(360deg) rotateX(12deg)} }
@keyframes spinSlowR{ from{transform:rotateY(360deg) rotateX(-8deg)} to{transform:rotateY(0deg) rotateX(-8deg)} }
@keyframes pulse3d  { 0%,100%{box-shadow: 0 0 30px rgba(124,58,237,.4),inset 0 0 20px rgba(124,58,237,.1)} 50%{box-shadow: 0 0 60px rgba(124,58,237,.7),inset 0 0 40px rgba(124,58,237,.2)} }
@keyframes errorFlash{ 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(400px)} }
@keyframes orbit    { from{transform:rotate(0deg) translateX(120px) rotate(0deg)} to{transform:rotate(360deg) translateX(120px) rotate(-360deg)} }
@keyframes orbit2   { from{transform:rotate(180deg) translateX(80px) rotate(-180deg)} to{transform:rotate(540deg) translateX(80px) rotate(-540deg)} }
@keyframes shimmer  { 0%{background-position: -200% 0} 100%{background-position: 200% 0} }

.cube-scene{ perspective:600px; }
.cube{ width:80px; height:80px; position:relative; transform-style:preserve-3d; animation: spinSlow 10s linear infinite; }
.cube .face{ position:absolute; width:80px; height:80px; border:1px solid rgba(124,58,237,.5); background:rgba(124,58,237,.08); backdrop-filter:blur(2px); display:flex; align-items:center; justify-content:center; font-size:24px; }
.cube .front { transform: translateZ(40px); }
.cube .back  { transform: rotateY(180deg) translateZ(40px); }
.cube .left  { transform: rotateY(-90deg) translateZ(40px); }
.cube .right { transform: rotateY(90deg)  translateZ(40px); }
.cube .top   { transform: rotateX(90deg)  translateZ(40px); }
.cube .bottom{ transform: rotateX(-90deg) translateZ(40px); }

.cube2{ width:50px; height:50px; position:relative; transform-style:preserve-3d; animation: spinSlowR 7s linear infinite; }
.cube2 .face{ position:absolute; width:50px; height:50px; border:1px solid rgba(59,130,246,.5); background:rgba(59,130,246,.08); }
.cube2 .front { transform: translateZ(25px); }
.cube2 .back  { transform: rotateY(180deg) translateZ(25px); }
.cube2 .left  { transform: rotateY(-90deg) translateZ(25px); }
.cube2 .right { transform: rotateY(90deg)  translateZ(25px); }
.cube2 .top   { transform: rotateX(90deg)  translateZ(25px); }
.cube2 .bottom{ transform: rotateX(-90deg) translateZ(25px); }
`;

/* ══════════════════════ 3D CUBE ══════════════════════ */
function Cube({ size = "large", style = {} }) {
  const cls = size === "large" ? "cube" : "cube2";
  return (
    <div className="cube-scene" style={style}>
      <div className={cls}>
        {["front","back","left","right","top","bottom"].map(f => (
          <div key={f} className={`face ${f}`} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════ 3D RING ══════════════════════ */
function Ring3D() {
  return (
    <div style={{
      width: 280, height: 280,
      borderRadius: "50%",
      border: "2px solid rgba(124,58,237,0.3)",
      boxShadow: "0 0 40px rgba(124,58,237,0.2), inset 0 0 40px rgba(124,58,237,0.05)",
      transform: "rotateX(70deg)",
      position: "relative",
      animation: "pulse3d 4s ease-in-out infinite",
    }}>
      {/* orbiting dot */}
      <div style={{ position:"absolute", width:"100%", height:"100%", animation:"orbit 5s linear infinite" }}>
        <div style={{ width:12, height:12, borderRadius:"50%", background:"linear-gradient(135deg,#a78bfa,#60a5fa)", boxShadow:"0 0 20px #7c3aed" }} />
      </div>
      <div style={{ position:"absolute", width:"100%", height:"100%", animation:"orbit2 3s linear infinite" }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:"linear-gradient(135deg,#60a5fa,#34d399)", boxShadow:"0 0 15px #3b82f6" }} />
      </div>
    </div>
  );
}

/* ══════════════════════ TILT CARD ══════════════════════ */
function TiltCard({ children, className = "", intensity = 22 }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = clamp(((e.clientX - left) / width - 0.5) * intensity, -intensity/2, intensity/2);
    const y = clamp(((e.clientY - top) / height - 0.5) * -intensity, -intensity/2, intensity/2);
    el.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${y}deg) scale(1.02)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)"; };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className}
      style={{ transition: "transform 0.2s cubic-bezier(.17,.67,.44,1.3)", willChange: "transform" }}>
      {children}
    </div>
  );
}

/* ══════════════════════ COUNTER ══════════════════════ */
function Counter({ to, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; obs.disconnect();
      let s = 0; const step = to / 70;
      const id = setInterval(() => { s += step; if (s >= to) { setVal(to); clearInterval(id); } else setVal(Math.floor(s)); }, 14);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

/* ══════════════════════ CODE BLOCK ══════════════════════ */
const PY_CODE = `from tracelify.client import Tracelify

sdk = Tracelify(dsn="http://<key>@host/api/<project>/events")
sdk.set_user({"id": "user_42", "email": "alice@acme.com"})
sdk.add_breadcrumb("Checkout started")

try:
    process_payment(order)      # 💥 crashes here
except Exception as e:
    sdk.capture_exception(e)    # ✅ captured instantly`;

const JAVA_CODE = `Tracelify sdk = new Tracelify(
    "http://<key>@host/api/<project>/events", "1.0.0");
sdk.setUser(Map.of("id", "user_42"));
sdk.addBreadcrumb("Checkout started");

try { processPayment(order); }
catch (Exception e) { sdk.captureException(e); }`;

const CPP_CODE = `tracelify::Tracelify sdk(
    "http://<key>@host/api/<project>/events", "1.0.0");
sdk.set_user({{"id", "user_42"}});
sdk.add_breadcrumb("Checkout started");
try { process_payment(order); }
catch (std::exception& e) { sdk.capture_exception(e); }`;

const TABS = [
  { label: "Python", code: PY_CODE, color: "#4f8ef7" },
  { label: "Java",   code: JAVA_CODE, color: "#f7894f" },
  { label: "C++",    code: CPP_CODE, color: "#a855f7" },
];

function CodeBlock() {
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background:"#0a0a14", border:"1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        {["#ff5f57","#febc2e","#28c840"].map((c,i) => <span key={i} className="w-3 h-3 rounded-full" style={{background:c}} />)}
        <div className="ml-4 flex gap-1">
          {TABS.map((t,i) => (
            <button key={t.label} onClick={() => setActive(i)}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
              style={active===i ? {background:t.color+"22",color:t.color} : {color:"rgba(255,255,255,0.35)"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <pre className="p-6 text-[13px] leading-7 overflow-x-auto" style={{ fontFamily:"'JetBrains Mono',monospace", color:"#86efac", minHeight:200 }}>
        <code>{TABS[active].code}</code>
      </pre>
    </div>
  );
}

/* ══════════════════════ FEATURES DATA ══════════════════════ */
const FEATURES = [
  { icon: "⚡", title: "Async Non-Blocking SDKs", desc: "Thread pools, batch queues & background workers. Zero latency added to your app." },
  { icon: "🌍", title: "3 Native Languages", desc: "Python, Java, C++ — production-ready SDKs published to PyPI, Maven & CMake." },
  { icon: "🔐", title: "RBAC Multi-Tenant", desc: "Global Admin → Project Manager → Developer. Strict data isolation per team." },
  { icon: "🗄️", title: "Full-Text Search", desc: "GIN-indexed PostgreSQL with fingerprint grouping. Sub-100ms at millions of rows." },
  { icon: "📦", title: "Published Packages", desc: "pip install tracelify-sdk  ·  Maven GitHub Packages  ·  FetchContent_Declare" },
  { icon: "🔔", title: "Smart Alerts", desc: "Email & webhook triggers on new issues or volume spikes. FATAL crashes notify instantly." },
];

/* ══════════════════════ MAIN ══════════════════════ */
export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const serif = { fontFamily: "'Playfair Display', Georgia, serif" };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:"#040410", color:"#fff", overflowX:"hidden", minHeight:"100vh" }}>
      <style>{FONTS}</style>

      {/* ── cursor glow ── */}
      <div style={{
        position:"fixed", pointerEvents:"none", zIndex:0, borderRadius:"50%",
        width:600, height:600, left:mouse.x-300, top:mouse.y-300,
        background:"radial-gradient(circle, rgba(124,58,237,0.14), transparent 70%)",
        transition:"left 0.15s, top 0.15s",
      }} />

      {/* ── bg orbs ── */}
      {[
        { w:700,h:700,bg:"#5b21b6",top:-300,left:-300 },
        { w:500,h:500,bg:"#1d4ed8",top:300,right:-200 },
        { w:400,h:400,bg:"#7c3aed",bottom:0,left:"35%" },
      ].map((o,i) => (
        <div key={i} style={{
          position:"absolute", borderRadius:"50%", filter:"blur(140px)", opacity:0.22, pointerEvents:"none",
          width:o.w, height:o.h, background:o.bg, top:o.top, left:o.left, right:o.right, bottom:o.bottom,
        }} />
      ))}

      {/* ── grid ── */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", opacity:0.035, zIndex:0,
        backgroundImage:"linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
        backgroundSize:"52px 52px",
      }} />

      {/* ══════════ NAVBAR ══════════ */}
      <nav style={{ position:"sticky", top:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 32px", borderBottom:"1px solid rgba(255,255,255,0.06)", backdropFilter:"blur(16px)", background:"rgba(4,4,16,0.85)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:"linear-gradient(135deg,#7c3aed,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, boxShadow:"0 4px 20px rgba(124,58,237,0.4)" }}>⚡</div>
          <span style={{ ...serif, fontSize:20, fontWeight:700, letterSpacing:"-0.01em" }}>Tracelify</span>
        </div>
        <div style={{ display:"flex", gap:32, fontSize:14, color:"rgba(255,255,255,0.55)" }}>
          {["#features","#sdks","#stats"].map((h,i) => (
            <a key={h} href={h} style={{ textDecoration:"none", color:"inherit", transition:"color .2s" }}
              onMouseEnter={e=>e.target.style.color="#fff"} onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.55)"}>
              {["Features","SDKs","Scale"][i]}
            </a>
          ))}
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          {isAuthenticated ? (
            <Link to="/dashboard" style={{ padding:"10px 20px", borderRadius:12, background:"linear-gradient(135deg,#7c3aed,#3b82f6)", color:"#fff", textDecoration:"none", fontSize:14, fontWeight:600, boxShadow:"0 4px 20px rgba(124,58,237,0.3)" }}>
              Dashboard →
            </Link>
          ) : (<>
            <Link to="/login" style={{ padding:"10px 16px", fontSize:14, fontWeight:500, color:"rgba(255,255,255,0.65)", textDecoration:"none" }}>Sign in</Link>
            <Link to="/signup" style={{ padding:"10px 20px", borderRadius:12, background:"linear-gradient(135deg,#7c3aed,#3b82f6)", color:"#fff", textDecoration:"none", fontSize:14, fontWeight:600, boxShadow:"0 4px 20px rgba(124,58,237,0.3)" }}>
              Get Started
            </Link>
          </>)}
        </div>
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section style={{ position:"relative", zIndex:10, display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", padding:"100px 24px 80px" }}>

        {/* floating 3D cubes — top left */}
        <div style={{ position:"absolute", top:40, left:"6%", animation:"floatY 6s ease-in-out infinite", zIndex:1 }}>
          <Cube size="large" />
        </div>
        <div style={{ position:"absolute", top:140, left:"2%", animation:"floatY2 8s ease-in-out infinite", zIndex:1, opacity:0.6 }}>
          <Cube size="small" />
        </div>

        {/* floating cubes — right side */}
        <div style={{ position:"absolute", top:60, right:"5%", animation:"floatY2 7s ease-in-out infinite", zIndex:1 }}>
          <Cube size="large" />
        </div>
        <div style={{ position:"absolute", top:200, right:"2%", animation:"floatY 9s ease-in-out infinite", zIndex:1, opacity:0.5 }}>
          <Cube size="small" />
        </div>

        {/* 3D ring behind headline */}
        <div style={{ position:"absolute", top:60, zIndex:0, opacity:0.5 }}>
          <Ring3D />
        </div>

        {/* badge */}
        <div style={{ marginBottom:32, display:"inline-flex", alignItems:"center", gap:8, padding:"8px 18px", borderRadius:999, border:"1px solid rgba(124,58,237,0.35)", background:"rgba(124,58,237,0.1)", color:"#c4b5fd", fontSize:13, fontWeight:500, backdropFilter:"blur(8px)", position:"relative", zIndex:10 }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"block", animation:"errorFlash 2s ease-in-out infinite" }} />
          Production-Grade Error Tracking — v1.0.0 Live
        </div>

        {/* ── SERIF HEADLINE ── */}
        <h1 style={{ ...serif, fontSize:"clamp(52px,8vw,96px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.02em", maxWidth:900, marginBottom:24, position:"relative", zIndex:10 }}>
          <span style={{ color:"#fff" }}>Catch Every</span>{" "}
          <em style={{
            fontStyle:"italic",
            background:"linear-gradient(135deg,#a78bfa 0%,#60a5fa 50%,#c084fc 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          }}>Crash</em>
          <br />
          <span style={{ color:"#fff" }}>Before Users Do</span>
        </h1>

        <p style={{ color:"rgba(255,255,255,0.45)", fontSize:18, maxWidth:560, marginBottom:44, lineHeight:1.75, fontWeight:300, position:"relative", zIndex:10 }}>
          Centralized log aggregation across <strong style={{ color:"rgba(255,255,255,0.8)", fontWeight:500 }}>Python, Java, and C++</strong> — with async SDKs, RBAC multi-tenancy, full-text search, and real-time alerting.
        </p>

        {/* CTA row */}
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center", marginBottom:72, position:"relative", zIndex:10 }}>
          <Link to="/signup" style={{
            padding:"14px 32px", borderRadius:16, fontWeight:700, fontSize:15, color:"#fff", textDecoration:"none",
            background:"linear-gradient(135deg,#7c3aed,#3b82f6)",
            boxShadow:"0 8px 40px rgba(124,58,237,0.35)", transition:"transform .2s, box-shadow .2s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.05)"; e.currentTarget.style.boxShadow="0 12px 50px rgba(124,58,237,0.55)"}}
            onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 8px 40px rgba(124,58,237,0.35)"}}>
            Start Tracking Free →
          </Link>
          <a href="#sdks" style={{
            padding:"14px 32px", borderRadius:16, fontWeight:600, fontSize:15, color:"rgba(255,255,255,0.75)", textDecoration:"none",
            border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", backdropFilter:"blur(8px)",
            transition:"background .2s, color .2s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)"; e.currentTarget.style.color="#fff"}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="rgba(255,255,255,0.75)"}}>
            View SDKs
          </a>
        </div>

        {/* ── 3D Dashboard Card ── */}
        <div style={{ width:"100%", maxWidth:720, position:"relative", zIndex:10 }}>
          <TiltCard intensity={18} className="">
            <div style={{
              borderRadius:20, overflow:"hidden",
              border:"1px solid rgba(255,255,255,0.1)",
              background:"linear-gradient(160deg,#0d0d1e,#080812)",
              boxShadow:"0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1)",
            }}>
              {/* terminal bar */}
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"12px 20px", background:"rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                {["#ff5f57","#febc2e","#28c840"].map((c,i) => <span key={i} style={{ width:12, height:12, borderRadius:"50%", background:c, display:"block" }} />)}
                <span style={{ marginLeft:12, fontSize:11, color:"rgba(255,255,255,0.25)", fontFamily:"'JetBrains Mono',monospace" }}>tracelify — live error stream</span>
                <span style={{ marginLeft:"auto", width:7, height:7, borderRadius:"50%", background:"#4ade80", boxShadow:"0 0 8px #4ade80", animation:"errorFlash 1.5s infinite" }} />
              </div>
              {/* events */}
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12, fontFamily:"'JetBrains Mono',monospace" }}>
                {[
                  { dot:"#f87171", bg:"rgba(239,68,68,0.08)", border:"rgba(239,68,68,0.2)", name:"ZeroDivisionError", loc:"checkout.py:42", lang:"tracelify.python", env:"Production", time:"just now", opacity:1 },
                  { dot:"#fbbf24", bg:"rgba(255,255,255,0.04)", border:"rgba(255,255,255,0.1)", name:"ArithmeticException", loc:"Order.java:108", lang:"tracelify.java", env:"Staging", time:"2m ago", opacity:0.65 },
                  { dot:"#60a5fa", bg:"rgba(255,255,255,0.025)", border:"rgba(255,255,255,0.07)", name:"std::runtime_error", loc:"payment.cpp:67", lang:"tracelify.cpp", env:"Dev", time:"5m ago", opacity:0.35 },
                ].map((ev,i) => (
                  <div key={i} style={{ display:"flex", gap:12, padding:"12px 16px", borderRadius:12, background:ev.bg, border:`1px solid ${ev.border}`, opacity:ev.opacity }}>
                    <span style={{ color:ev.dot, fontWeight:700, fontSize:10, marginTop:2 }}>●</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                        <span style={{ color:ev.dot, fontWeight:600, fontSize:13 }}>{ev.name}</span>
                        <span style={{ color:"rgba(255,255,255,0.25)", fontSize:11 }}>{ev.time}</span>
                      </div>
                      <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:4 }}>{ev.loc}</div>
                      <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
                        {[ev.lang, ev.env, "user_42"].map(tag => (
                          <span key={tag} style={{ padding:"2px 8px", borderRadius:6, background:"rgba(124,58,237,0.2)", color:"#c4b5fd", fontSize:10 }}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ══════════ STATS ══════════ */}
      <section id="stats" style={{ position:"relative", zIndex:10, padding:"72px 24px", borderTop:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth:900, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:32, textAlign:"center" }}>
          {[
            { to:99, suffix:".9%", label:"Uptime SLA" },
            { to:3,  suffix:" SDKs", label:"Native Languages" },
            { to:50, suffix:"ms", label:"Ingest Latency" },
            { to:1000000, suffix:"+", label:"Events / day" },
          ].map(({ to, suffix, label }) => (
            <div key={label}>
              <div style={{ ...serif, fontSize:"clamp(32px,4vw,52px)", fontWeight:900, fontStyle:"italic", background:"linear-gradient(135deg,#a78bfa,#60a5fa)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:6 }}>
                <Counter to={to} suffix={suffix} />
              </div>
              <div style={{ color:"rgba(255,255,255,0.35)", fontSize:13 }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" style={{ position:"relative", zIndex:10, padding:"96px 24px" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:60 }}>
            <h2 style={{ ...serif, fontSize:"clamp(36px,5vw,56px)", fontWeight:800, color:"#fff", marginBottom:14, letterSpacing:"-0.02em" }}>
              Built for <em style={{ fontStyle:"italic" }}>Engineering</em> Teams
            </h2>
            <p style={{ color:"rgba(255,255,255,0.35)", fontSize:17, maxWidth:480, margin:"0 auto" }}>Everything a distributed team needs to ship with confidence.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>
            {FEATURES.map((f) => (
              <TiltCard key={f.title} intensity={14}>
                <div style={{
                  borderRadius:18, border:"1px solid rgba(255,255,255,0.08)", padding:28,
                  background:"linear-gradient(145deg,rgba(255,255,255,0.04),transparent)",
                  backdropFilter:"blur(8px)", height:"100%", transition:"border-color .25s",
                  cursor:"default",
                }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(124,58,237,0.35)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"}>
                  <div style={{ fontSize:32, marginBottom:16 }}>{f.icon}</div>
                  <h3 style={{ ...serif, color:"#fff", fontWeight:700, fontSize:17, marginBottom:10 }}>{f.title}</h3>
                  <p style={{ color:"rgba(255,255,255,0.38)", fontSize:14, lineHeight:1.7 }}>{f.desc}</p>
                </div>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SDK CODE ══════════ */}
      <section id="sdks" style={{ position:"relative", zIndex:10, padding:"96px 24px" }}>
        <div style={{ maxWidth:860, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:52 }}>
            <h2 style={{ ...serif, fontSize:"clamp(36px,5vw,56px)", fontWeight:800, color:"#fff", marginBottom:14, letterSpacing:"-0.02em" }}>
              <em style={{ fontStyle:"italic" }}>Five Lines.</em> Any Language.
            </h2>
            <p style={{ color:"rgba(255,255,255,0.35)", fontSize:17, maxWidth:440, margin:"0 auto" }}>Drop our SDK in and your app is crash-monitored. Async, non-blocking, battle-tested.</p>
          </div>
          <TiltCard intensity={10}><CodeBlock /></TiltCard>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:12, marginTop:28 }}>
            {["pip install tracelify-sdk", "<artifactId>tracelify-sdk</artifactId>", "FetchContent_Declare(tracelify_sdk)"].map(s => (
              <code key={s} style={{ padding:"8px 16px", borderRadius:999, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.45)", fontSize:13, fontFamily:"'JetBrains Mono',monospace" }}>{s}</code>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ ARCHITECTURE ══════════ */}
      <section style={{ position:"relative", zIndex:10, padding:"80px 24px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        {/* decorative cube right side */}
        <div style={{ position:"absolute", right:"5%", top:"50%", transform:"translateY(-50%)", animation:"floatY 8s ease-in-out infinite", opacity:0.5 }}>
          <Cube size="large" />
        </div>
        <div style={{ maxWidth:960, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ ...serif, fontSize:"clamp(32px,4vw,48px)", fontWeight:800, color:"#fff", marginBottom:14, letterSpacing:"-0.02em" }}>
            Engineered to <em style={{ fontStyle:"italic" }}>Scale</em>
          </h2>
          <p style={{ color:"rgba(255,255,255,0.35)", fontSize:16, marginBottom:56 }}>FastAPI + PostgreSQL (GIN indexed) + Redis + async workers.</p>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", alignItems:"center", gap:10 }}>
            {["SDK","POST /api/{project}/events","Redis Queue","Worker","PostgreSQL","Dashboard"].map((n,i,arr) => (
              <div key={n} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ padding:"10px 18px", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.65)", fontSize:12, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap" }}>{n}</div>
                {i < arr.length-1 && <span style={{ color:"#7c3aed", fontSize:18 }}>→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section style={{ position:"relative", zIndex:10, padding:"112px 24px", textAlign:"center" }}>
        {/* flanking cubes */}
        <div style={{ position:"absolute", left:"8%", top:"50%", transform:"translateY(-50%)", animation:"floatY2 7s ease-in-out infinite" }}>
          <Cube size="large" />
        </div>
        <div style={{ position:"absolute", right:"8%", top:"50%", transform:"translateY(-50%)", animation:"floatY 9s ease-in-out infinite" }}>
          <Cube size="small" />
        </div>
        <div style={{ maxWidth:640, margin:"0 auto" }}>
          <div style={{
            borderRadius:28, border:"1px solid rgba(124,58,237,0.25)", padding:"80px 60px",
            background:"radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.22), rgba(4,4,16,0.95))",
          }}>
            <h2 style={{ ...serif, fontSize:"clamp(36px,5vw,56px)", fontWeight:900, color:"#fff", marginBottom:16, letterSpacing:"-0.02em" }}>
              Ready to Ship<br /><em style={{ fontStyle:"italic" }}>Fearlessly?</em>
            </h2>
            <p style={{ color:"rgba(255,255,255,0.38)", fontSize:17, marginBottom:40 }}>Join teams catching crashes before users do.</p>
            <Link to="/signup" style={{
              display:"inline-block", padding:"16px 44px", borderRadius:16, fontWeight:700, fontSize:16, color:"#fff", textDecoration:"none",
              background:"linear-gradient(135deg,#7c3aed,#3b82f6)",
              boxShadow:"0 8px 40px rgba(124,58,237,0.4)", transition:"transform .2s, box-shadow .2s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.06)"; e.currentTarget.style.boxShadow="0 12px 60px rgba(124,58,237,0.6)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 8px 40px rgba(124,58,237,0.4)"}}>
              Create Free Account →
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{ position:"relative", zIndex:10, borderTop:"1px solid rgba(255,255,255,0.06)", padding:"28px 24px", textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:13 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:6 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"linear-gradient(135deg,#7c3aed,#3b82f6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>⚡</div>
          <span style={{ ...serif, fontWeight:700, color:"rgba(255,255,255,0.35)", fontSize:15 }}>Tracelify</span>
        </div>
        Built for the Hackathon · Python · Java · C++ · FastAPI · PostgreSQL · Redis
      </footer>
    </div>
  );
}
