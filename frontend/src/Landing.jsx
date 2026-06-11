import React, { useState, useEffect } from "react";
import { useTheme } from "./context/ThemeContext";

const FEATURES = [
  { icon: "🐞", color: "#ef4444", title: "Debug Code", desc: "Paste or upload code and instantly find bugs with clear, fixed versions and explanations." },
  { icon: "💡", color: "#399aff", title: "Explain Code", desc: "Get a line-by-line, beginner-friendly explanation of what any code does." },
  { icon: "🚀", color: "#22c55e", title: "Improve & Optimize", desc: "Receive cleaner, faster, more idiomatic versions of your code with best-practice tips." },
  { icon: "🔍", color: "#a855f7", title: "CS Knowledge Search", desc: "Search any computer-science concept and get an instant, structured answer." },
  { icon: "💬", color: "#06b6d4", title: "CS Tutor Chat", desc: "Ask anything about coding, algorithms, or CS theory and chat with your AI tutor." },
  { icon: "📊", color: "#f59e0b", title: "Analyze Quality", desc: "Get a readability, complexity and maintainability breakdown of your code." },
];

function pwStrength(p) {
  if (!p) return { s: 0, label: "", color: "var(--text-3)" };
  let s = 0;
  if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++; if (p.length >= 12) s++;
  if (s <= 1) return { s, label: "Weak", color: "#ef4444" };
  if (s <= 3) return { s, label: "Fair", color: "#f59e0b" };
  return { s, label: "Strong", color: "#22c55e" };
}

const inputStyle = { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "var(--sans)", boxSizing: "border-box" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-2)", marginBottom: 5 };

function AuthModal({ mode, onClose, onSwitch, onEnter }) {
  const isSignup = mode === "signup";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const st = pwStrength(form.password);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault(); setError("");
    if (isSignup) {
      if (!form.name.trim() || !form.email.trim()) return setError("Name and email are required.");
      if (form.password.length < 8) return setError("Password must be at least 8 characters.");
      localStorage.setItem("codedebugger_user", JSON.stringify({ name: form.name, email: form.email, password: btoa(form.password) }));
      onEnter();
    } else {
      const u = JSON.parse(localStorage.getItem("codedebugger_user") || "null");
      if (!u) return setError("No account found. Please sign up first.");
      const id = form.email.trim().toLowerCase();
      if (id !== (u.email || "").toLowerCase() && id !== (u.name || "").toLowerCase()) return setError("Account not found.");
      if (u.password && atob(u.password) !== form.password) return setError("Wrong password.");
      onEnter();
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--surface)", borderRadius: 18, border: "1.5px solid var(--border)", overflow: "hidden", boxShadow: "var(--shadow-md)" }}>
        <div style={{ background: "var(--blue)", padding: "20px 24px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{isSignup ? "Create your account" : "Welcome back"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.9 }}>{isSignup ? "Start debugging & learning" : "Log in to continue"}</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ background: "#ef444418", border: "1px solid #ef444455", color: "#ef4444", padding: "9px 12px", borderRadius: 9, fontSize: 13 }}>{error}</div>}
          {isSignup && <div><label style={labelStyle}>Full Name</label><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Your name" /></div>}
          <div><label style={labelStyle}>{isSignup ? "Email" : "Email or Name"}</label><input style={inputStyle} value={form.email} onChange={set("email")} placeholder={isSignup ? "you@email.com" : "email or name"} /></div>
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: "relative" }}>
              <input style={{ ...inputStyle, paddingRight: 44 }} type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder={isSignup ? "At least 8 characters" : "Your password"} />
              <button type="button" onClick={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 15 }}>{showPw ? "🙈" : "👁️"}</button>
            </div>
            {isSignup && form.password && (
              <div style={{ marginTop: 7 }}>
                <div style={{ display: "flex", gap: 4 }}>{[1,2,3,4,5].map((b) => <div key={b} style={{ flex: 1, height: 4, borderRadius: 4, background: b <= st.s ? st.color : "var(--border)" }} />)}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
              </div>
            )}
          </div>
          <button type="submit" style={{ marginTop: 4, padding: "12px", borderRadius: 10, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{isSignup ? "Create Account" : "Log In"}</button>
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-2)", margin: 0 }}>
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button type="button" onClick={onSwitch} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{isSignup ? "Log In" : "Sign Up"}</button>
          </p>
        </form>
      </div>
    </div>
  );
}

// Rotates the hero image — preloads the next Pollinations seed in the
// background and only swaps the visible URL once it's fully loaded, so
// the user never sees a blank rectangle between rotations.
function usePreloadedRotatingUrl(buildUrl, startSeed = 44, intervalMs = 5000) {
  const [url, setUrl] = useState(() => buildUrl(startSeed))
  useEffect(() => {
    let seed = startSeed
    const t = setInterval(() => {
      seed += 1
      const nextUrl = buildUrl(seed)
      const img = new Image()
      img.onload = () => setUrl(nextUrl)
      img.src = nextUrl
    }, intervalMs)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs])
  return url
}

const HERO_URL = (s) => `https://image.pollinations.ai/prompt/3D%20Pixar%20cartoon%20illustration%20of%20a%20laptop%20with%20code%20on%20the%20screen%2C%20cute%20cartoon%20bugs%20being%20fixed%20with%20a%20magnifying%20glass%2C%20checkmarks%20and%20sparkles%2C%20bright%20vibrant%20colors%2C%20clean%20white%20background%2C%20developer%20debugging?width=768&height=768&seed=${s}&nologo=true`

export default function Landing({ onEnter }) {
  const { isDark, toggleTheme } = useTheme();
  const [auth, setAuth] = useState(null);
  const heroUrl = usePreloadedRotatingUrl(HERO_URL, 44);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--sans)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 6vw", borderBottom: "1.5px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>⚡</div>
          <span style={{ fontSize: 20, fontWeight: 800 }}>Code<span style={{ color: "var(--blue)" }}>Debugger</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={toggleTheme} title="Toggle theme" style={{ width: 40, height: 40, borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", fontSize: 18 }}>{isDark ? "☀️" : "🌙"}</button>
          <button onClick={() => setAuth("login")} style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Log In</button>
          <button onClick={() => setAuth("signup")} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "var(--shadow-blue)" }}>Sign Up Free</button>
        </div>
      </header>

      <section style={{ padding: "64px 6vw 40px", maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 380px", minWidth: 280 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 100, background: "var(--blue-dim)", color: "var(--blue)", fontWeight: 700, fontSize: 13, marginBottom: 22 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--blue)" }} /> AI Debugger · Explainer · CS Tutor
          </div>
          <h1 style={{ fontSize: "clamp(34px, 5vw, 54px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 18px" }}>Find bugs &amp; learn code<br /><span style={{ color: "var(--blue)" }}>in seconds.</span></h1>
          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "var(--text-2)", maxWidth: 520, margin: "0 0 30px", lineHeight: 1.6 }}>
            Paste your code to instantly find and fix bugs, get plain-English explanations, optimize it, and chat with a CS tutor — all in one place.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button onClick={() => setAuth("signup")} style={{ padding: "14px 30px", borderRadius: 12, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", boxShadow: "var(--shadow-blue)" }}>Get Started Free →</button>
            <button onClick={onEnter} style={{ padding: "14px 30px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontWeight: 700, fontSize: 16, cursor: "pointer" }}>Try it now</button>
          </div>
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 260, display: "flex", justifyContent: "center" }}>
          <img
            src={heroUrl}
            alt="Debugging code with AI"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ width: "100%", maxWidth: 420, height: "auto", aspectRatio: "1 / 1", borderRadius: 20, boxShadow: "var(--shadow-md)", transition: "opacity 0.4s", background: "linear-gradient(135deg, var(--blue-dim, #e3f0ff), #f7fbff)" }}
          />
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "20px 6vw 56px" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, margin: "0 0 32px" }}>Everything you need to code smarter</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 16, padding: 24, boxShadow: "var(--shadow)" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, background: f.color + "1a", marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: "1.5px solid var(--border)", padding: "24px 6vw", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: "rgba(20, 50, 70, 0.85)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" }}>✦ Powered by Codevidhya</div>
        <div style={{ marginTop: 6 }}>© 2026 CodeDebugger</div>
      </footer>

      {auth && <AuthModal mode={auth} onClose={() => setAuth(null)} onSwitch={() => setAuth((m) => (m === "signup" ? "login" : "signup"))} onEnter={onEnter} />}
    </div>
  );
}
