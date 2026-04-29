import { useState, useRef, useCallback, useEffect } from "react";
import "./App.css";
import DebugHistory from "./DebugHistory";
import ThemeToggle from "./components/ThemeToggle";

const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8004" : window.location.origin;

const LANGUAGES = [
  "auto-detect", "Python", "JavaScript", "TypeScript",
  "JavaScript (React)", "TypeScript (React)", "Java", "C++", "C",
  "C#", "Go", "Ruby", "PHP", "Swift", "Kotlin", "Rust",
  "HTML", "CSS", "SQL", "Shell/Bash", "R", "MATLAB",
];

function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return <button className="copy-btn" onClick={handleCopy}>{copied ? "✓ Copied!" : label}</button>;
}

function formatCodeForDownload(code) {
  if (!code) return "";
  if (code.includes("\n")) return code;

  let out = "";
  let depth = 0;
  let i = 0;
  let parenDepth = 0; // track () depth to detect for(;;) semicolons

  while (i < code.length) {
    const ch = code[i];

    // Skip inside strings — never break them
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch; out += ch; i++;
      while (i < code.length && code[i] !== q) {
        if (code[i] === "\\") { out += code[i] + (code[i+1]||""); i += 2; }
        else { out += code[i]; i++; }
      }
      out += code[i] || ""; i++;
      continue;
    }

    // Track parenthesis depth — semicolons inside () belong to for(;;)
    if (ch === "(") {
      parenDepth++;
      out += ch; i++;
    } else if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      out += ch; i++;
    } else if (ch === "{") {
      out = out.trimEnd() + " {\n";
      depth++;
      out += "    ".repeat(depth);
      i++;
      while (i < code.length && code[i] === " ") i++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      out = out.trimEnd() + "\n" + "    ".repeat(depth) + "}";
      let j = i + 1;
      while (j < code.length && code[j] === " ") j++;
      const rest = code.slice(j, j + 7);
      if (/^(else|catch|finally)/.test(rest)) { out += " "; }
      else { out += "\n" + "    ".repeat(depth); }
      i++;
      while (i < code.length && code[i] === " ") i++;
    } else if (ch === ";" && parenDepth === 0) {
      // Only split on ; that are OUTSIDE parentheses (not inside for(;;))
      out += ";\n" + "    ".repeat(depth);
      i++;
      while (i < code.length && code[i] === " ") i++;
    } else {
      out += ch; i++;
    }
  }

  return out
    .split("\n")
    .map(l => l.trimEnd())
    .filter((l, idx, arr) => !(l.trim() === "" && arr[idx-1]?.trim() === ""))
    .join("\n")
    .trim();
}

function DownloadButton({ code, language }) {
  const handleDownload = () => {
    const extMap = { "Python":"py","JavaScript":"js","TypeScript":"ts","JavaScript (React)":"jsx","TypeScript (React)":"tsx","Java":"java","C++":"cpp","C":"c","C#":"cs","Go":"go","Ruby":"rb","PHP":"php","Swift":"swift","Kotlin":"kt","Rust":"rs","HTML":"html","CSS":"css","SQL":"sql","Shell/Bash":"sh","R":"r","MATLAB":"m" };
    const ext = extMap[language] || "txt";
    const formatted = formatCodeForDownload(code);
    const blob = new Blob([formatted], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `fixed_code.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };
  return <button className="download-btn" onClick={handleDownload}>⬇ Download</button>;
}

function smartSplitCode(code) {
  if (!code) return [];
  // Already has real newlines — use them directly
  const byNewline = code.split("\n");
  if (byNewline.length > 1) return byNewline;

  // Single line — reformat by inserting newlines at the right places
  let out = "";
  let depth = 0;
  let i = 0;
  let parenDepth = 0; // track () so for(;;) semicolons are NOT split
  const indent = () => "    ".repeat(Math.max(0, depth));

  while (i < code.length) {
    const ch = code[i];

    // Handle strings to avoid breaking inside them
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      out += ch; i++;
      while (i < code.length && code[i] !== q) {
        if (code[i] === "\\" ) { out += code[i] + code[i+1]; i += 2; }
        else { out += code[i]; i++; }
      }
      out += code[i] || ""; i++;
      continue;
    }

    if (ch === "(") {
      parenDepth++;
      out += ch; i++;
    } else if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      out += ch; i++;
    } else if (ch === "{") {
      out = out.trimEnd() + " {\n";
      depth++;
      out += indent();
      i++;
      while (i < code.length && code[i] === " ") i++;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      out = out.trimEnd() + "\n" + indent() + "}";
      let j = i + 1;
      while (j < code.length && code[j] === " ") j++;
      const rest = code.slice(j, j + 7);
      if (/^(else|catch|finally)/.test(rest)) { out += " "; }
      else { out += "\n" + indent(); }
      i++;
      while (i < code.length && code[i] === " ") i++;
    } else if (ch === ";" && parenDepth === 0) {
      // Only split on ; outside parentheses — for(;;) stays intact
      out += ";\n" + indent();
      i++;
      while (i < code.length && code[i] === " ") i++;
    } else {
      out += ch;
      i++;
    }
  }

  return out
    .split("\n")
    .map(l => l.trimEnd())
    .filter((l, idx, arr) => !(l.trim() === "" && arr[idx - 1]?.trim() === ""));
}

function DiffCode({ original, fixed }) {
  const origLines = smartSplitCode(original);
  const fixedLines = smartSplitCode(fixed);
  return (
    <div className="diff-code-wrap">
      <div className="diff-line-numbers">
        {fixedLines.map((_, i) => (
          <div key={i} className="line-num">{i + 1}</div>
        ))}
      </div>
      <div className="diff-lines">
        {fixedLines.map((line, i) => {
          const isChanged = origLines[i] !== line;
          return (
            <div key={i} className={`diff-line ${isChanged ? "diff-line-changed" : ""}`}>
              {isChanged && <span className="diff-marker">+</span>}
              {!isChanged && <span className="diff-marker-empty"> </span>}
              <span>{line || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LearningStep({ index, error, fix }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className={`learn-step ${expanded ? "learn-step-open" : ""}`}>
      <button className="learn-step-header" onClick={() => setExpanded(v => !v)}>
        <div className="learn-step-num">{index + 1}</div>
        <div className="learn-step-title">
          <span className="learn-step-label">Bug #{index + 1}</span>
          <span className="learn-step-error">{error}</span>
        </div>
        <span className={`learn-step-chevron ${expanded ? "chevron-open" : ""}`}>▾</span>
      </button>
      {expanded && (
        <div className="learn-step-body">
          <div className="learn-step-section">
            <div className="learn-tag learn-tag-bug">🐛 What went wrong</div>
            <p className="learn-step-text">{error}</p>
          </div>
          <div className="learn-step-section">
            <div className="learn-tag learn-tag-fix">🛠️ How it was fixed</div>
            <p className="learn-step-text">{fix}</p>
          </div>
          <div className="learn-step-section">
            <div className="learn-tag learn-tag-tip">💡 Remember this</div>
            <p className="learn-step-text learn-tip-text">Always double-check this area of your code. Small mistakes here are common and easy to miss!</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CS Search — OpenAI powered ───────────────────────────────────────────────
// Accepts persisted state from parent so results survive tab switches.
function SearchBar({ onResult, persistedResult, setPersistedResult, persistedQuery, setPersistedQuery }) {
  // Use parent-lifted state for query + result so they survive when this tab is hidden
  const query     = persistedQuery     ?? "";
  const setQuery  = setPersistedQuery  ?? (() => {});
  const result    = persistedResult    ?? null;
  const setResult = setPersistedResult ?? (() => {});

  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const runSearch = async (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSearchErr(""); setResult(null); setSearching(true);
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Search failed"); }
      const data = await res.json();
      setResult(data);
      if (onResult) onResult();
    } catch (e) {
      setSearchErr(e.message || "Search failed. Make sure the backend is running.");
    } finally { setSearching(false); }
  };

  const handleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSearchErr("Voice not supported. Use Chrome."); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR(); recognitionRef.current = rec;
    rec.continuous = false; rec.interimResults = false; rec.lang = "";
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setQuery(t); setListening(false); runSearch(t); };
    rec.onerror = () => { setListening(false); setSearchErr("Could not understand. Try again."); };
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <div className="search-section">
      <div className="search-label">🔍 Search — Computer Science &amp; Programming</div>
      <div className="search-row">
        <input className="search-input" type="text" placeholder="Ask any CS or coding question..."
          value={query} onChange={e => { setQuery(e.target.value); setSearchErr(""); }}
          onKeyDown={e => e.key === "Enter" && runSearch(query)} />
        <button className={`voice-btn ${listening ? "voice-btn-active" : ""}`} onClick={handleVoice}>
          {listening ? "⏹ Stop" : "🎙 Voice"}
        </button>
        <button className="search-btn" onClick={() => runSearch(query)} disabled={searching}>
          {searching ? "Searching..." : "Search"}
        </button>
      </div>
      {listening && <div className="voice-indicator"><span className="voice-dot"/><span className="voice-dot"/><span className="voice-dot"/><span className="voice-hint">Speak now...</span></div>}
      {searchErr && <div className="search-err">⚠️ {searchErr}</div>}
      {result && (
        <div className="search-result-groq">
          {/* Header stays fixed — never scrolls */}
          <div className="search-result-groq-header">
            <span className="search-result-groq-icon">🤖</span>
            <span className="search-result-groq-title">AI Answer</span>
            <span className="search-result-groq-badge">OpenAI · GPT-4o-mini</span>
            <button className="search-result-close" onClick={() => setResult(null)} title="Close">✕</button>
          </div>
          {/* Scrollable body */}
          <div className="search-result-groq-scroll">
            <div className="search-result-groq-topic">{result.topic}</div>
            <div className="search-result-groq-body">{result.answer}</div>
            {result.key_points?.length > 0 && (
              <div className="search-result-groq-points">
                <div className="search-result-groq-points-title">📌 Key Points</div>
                {result.key_points.map((pt, i) => (
                  <div key={i} className="search-result-groq-point">
                    <span className="groq-point-num">{i + 1}</span><span>{pt}</span>
                  </div>
                ))}
              </div>
            )}
            {result.example_code && (
              <div className="search-result-groq-code">
                <div className="search-result-groq-code-label">💻 Example</div>
                <pre className="search-result-groq-pre">{result.example_code}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Floating CS Tutor ─────────────────────────────────────────────────────────
function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "👋 Hello! I am your CS Tutor powered by OpenAI. Ask me anything about coding, algorithms, programming languages, or computer science!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: userText }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error("Backend error");
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "❌ Connection error. Make sure the backend is running on port 8000." }]);
    } finally { setLoading(false); }
  };

  const handleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR(); recognitionRef.current = rec;
    rec.continuous = false; rec.interimResults = false; rec.lang = "";
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setListening(false); sendMessage(t); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  return (
    <>
      <button className={`chat-fab ${open ? "chat-fab-open" : ""}`} onClick={() => setOpen(v => !v)}>
        {open ? "✕" : <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span className="chat-fab-label">CS Tutor</span></>}
      </button>
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">🧑‍🏫</div>
              <div><div className="chat-header-name">CS Tutor</div><div className="chat-header-sub">⚡ Powered by OpenAI</div></div>
            </div>
            <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === "user" ? "chat-msg-user" : "chat-msg-ai"}`}>
                <div className="chat-bubble">{m.content}</div>
              </div>
            ))}
            {loading && <div className="chat-msg chat-msg-ai"><div className="chat-bubble chat-typing"><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></div></div>}
            <div ref={bottomRef} />
          </div>
          <div className="chat-input-row">
            <button className={`chat-voice-btn ${listening ? "voice-btn-active" : ""}`} onClick={handleVoice}>{listening ? "⏹" : "🎙"}</button>
            <input className="chat-input" type="text" placeholder={listening ? "Listening..." : "Ask anything about CS..."}
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && sendMessage()} disabled={loading || listening} />
            <button className="chat-send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("paste");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("auto-detect");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("learn");
  const [rightTab, setRightTab] = useState("preview");
  // ── Lifted search state — persists across tab switches ──────────────────────
  const [searchResult, setSearchResult] = useState(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const textareaRef = useRef(null);

  // Debug history & usage tracking
  const [userId] = useState(() => {
    let id = localStorage.getItem('debugger_user_id');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('debugger_user_id', id);
    }
    return id;
  });
  const [usageCount, setUsageCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [debugHistory, setDebugHistory] = useState([]);
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [limitMessage, setLimitMessage] = useState("");

  // New features
  const [runOutput, setRunOutput]         = useState(null);
  const [runLoading, setRunLoading]       = useState(false);
  const [shareMsg, setShareMsg]           = useState("");
  const [simpleExp, setSimpleExp]         = useState("");
  const [simpleLoading, setSimpleLoading] = useState(false);

  // Auto-clear error after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // Load initial usage count
  useEffect(() => {
    const loadUsage = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/check-usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();
        setUsageCount(data.debug_count);
      } catch (err) {
        console.error("Failed to load usage:", err);
      }
    };
    loadUsage();
  }, [userId]);

  // Load debug history when sidebar opens
  useEffect(() => {
    if (!showHistory) return;
    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/debug-history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();
        if (data.success) {
          setDebugHistory(data.debugs || []);
        }
      } catch (err) {
        console.error("Failed to load history:", err);
      }
    };
    loadHistory();
  }, [showHistory, userId]);

  const handleTabSwitch = (tab) => { setActiveTab(tab); setResult(null); setError(null); };
  // Note: code is intentionally NOT cleared on tab switch — only cleared by Clear button
  const handleFileSelect = (f) => { if (!f) return; setFile(f); setActiveTab("file"); setError(null); };
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }, []);

  const handlePaste = async () => {
    setError(null);
    // Method 1: Modern Clipboard API
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text);
        setResult(null);
        setError(null);
        textareaRef.current?.focus();
        return;
      }
    } catch {
      // fall through to method 2
    }
    // Method 2: Focus textarea and execCommand paste fallback
    if (textareaRef.current) {
      textareaRef.current.focus();
      try {
        const success = document.execCommand("paste");
        if (success) return;
      } catch { /* fall through */ }
    }
    // Method 3: Ask browser permission explicitly
    try {
      const permission = await navigator.permissions.query({ name: "clipboard-read" });
      if (permission.state === "denied") {
        setError("Clipboard access denied by browser. Press Ctrl+V in the code area.");
      } else {
        const text = await navigator.clipboard.readText();
        if (text) { setCode(text); setResult(null); textareaRef.current?.focus(); }
      }
    } catch {
      setError("Press Ctrl+V in the code area below to paste your code.");
      textareaRef.current?.focus();
    }
  };

  const handleDebug = async () => {
    setError(null); setResult(null); setLoading(true); setLoadingStep(0);
    const si = setInterval(() => setLoadingStep(s => Math.min(s + 1, 3)), 600);
    try {
      // Check usage before running debug
      const usageRes = await fetch(`${API_BASE}/api/check-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId })
      });
      const usageData = await usageRes.json();
      setUsageCount(usageData.debug_count);

      if (usageData.exceeded) {
        setLimitExceeded(true);
        setLimitMessage(`⚠️ Daily limit reached! You've used ${usageData.debug_count}/${usageData.limit} debugs today.`);
        // Auto-dismiss after 5 seconds
        setTimeout(() => setLimitExceeded(false), 5000);
        setLoading(false);
        clearInterval(si);
        return;
      }

      if (activeTab === "paste") {
        if (!code.trim()) { setError("Please paste your code first."); setLoading(false); clearInterval(si); return; }
        const res = await fetch(`${API_BASE}/api/debug`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, language }) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Server error"); }
        const result = await res.json();
        setResult(result);
        setRightTab("preview");

        // Save debug to history and increment usage
        await fetch(`${API_BASE}/api/increment-usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId })
        });

        await fetch(`${API_BASE}/api/save-debug`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            code,
            language: result.language,
            errors_found: result.errors_found,
            fixes_applied: result.fixes_applied,
            explanation: result.explanation
          })
        });

        setUsageCount(prev => prev + 1);
      } else {
        if (!file) { setError("Please upload a file first."); setLoading(false); clearInterval(si); return; }
        const form = new FormData(); form.append("file", file); form.append("language", language);
        const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Server error"); }
        const result = await res.json();
        setResult(result);
        setRightTab("preview");

        // Save debug to history and increment usage
        await fetch(`${API_BASE}/api/increment-usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId })
        });

        await fetch(`${API_BASE}/api/save-debug`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            code,
            language: result.language,
            errors_found: result.errors_found,
            fixes_applied: result.fixes_applied,
            explanation: result.explanation
          })
        });

        setUsageCount(prev => prev + 1);
      }
    } catch (err) { setError(err.message || "Something went wrong."); }
    finally { clearInterval(si); setLoading(false); setLoadingStep(0); }
  };

  const handleRun = async () => {
    const src = result ? result.debugged_code : code;
    if (!src?.trim()) return;
    setRunLoading(true); setRunOutput(null);
    try {
      const res = await fetch(`${API_BASE}/api/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: src, language: result?.language || language }),
      });
      const data = await res.json();
      setRunOutput(data);
    } catch { setRunOutput({ output: "", error: "Could not reach server", exit_code: -1 }); }
    finally { setRunLoading(false); }
  };

  const handleApplyFix = () => {
    if (!result?.debugged_code) return;
    setCode(result.debugged_code);
    setResult(null); setRunOutput(null);
  };

  const handleShare = () => {
    const src = code.trim();
    if (!src) return;
    const encoded = btoa(unescape(encodeURIComponent(src)));
    const url = `${window.location.origin}${window.location.pathname}?code=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareMsg("Link copied!");
      setTimeout(() => setShareMsg(""), 2500);
    });
  };

  const handleExplainSimple = async () => {
    if (!result?.errors_found?.length) return;
    setSimpleLoading(true); setSimpleExp("");
    try {
      const res = await fetch(`${API_BASE}/api/explain-simple`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errors: result.errors_found, fixes: result.fixes_applied, language: result.language }),
      });
      const data = await res.json();
      setSimpleExp(data.explanation || "");
    } catch { setSimpleExp("Could not generate simple explanation."); }
    finally { setSimpleLoading(false); }
  };

  // Load shared code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("code");
    if (encoded) {
      try { setCode(decodeURIComponent(escape(atob(encoded)))); } catch { /* ignore bad param */ }
    }
  }, []);

  const errorCount = result?.errors_found?.length ?? 0;
  const hasErrors = errorCount > 0;
  const steps = ["Reading your code", "Scanning for bugs", "Applying fixes", "Validating output"];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
            </div>
            <div className="logo-text-wrap">
              <div className="logo-name">Coding <span>Assistant</span></div>
             
            </div>
          </div>
          <div className="header-right">
            <div className="header-badge badge-free"><span className="badge-dot"/>Free &amp; Fast</div>
            <div className="header-badge badge-model">⚡ GPT-4o-mini</div>
            <ThemeToggle />
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: 'var(--blue)',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                marginRight: '8px'
              }}
            >
              📋 History
            </button>
            <div style={{
              background: usageCount >= 50 ? 'var(--error)' : 'var(--fix)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              transition: 'background 0.3s ease'
            }}>
              {usageCount}/50
            </div>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="workspace">

          {/* LEFT PANEL */}
          <section className="panel">
            <div className="panel-header">
              <div className="tab-row">
                <button
                  type="button"
                  className={`tab home-btn ${activeTab === "paste" ? "tab-active" : ""}`}
                  onClick={() => {
                    setActiveTab("paste");
                    setFile(null);
                    setResult(null);
                    setError(null);
                  }}
                >
                  🏠 Home
                </button>
                <button type="button" className={`tab ${activeTab === "file" ? "tab-active" : ""}`} onClick={() => { setActiveTab("file"); setError(null); }}>📎 Upload File</button>
              </div>
              <select className="lang-select" value={language} onChange={e => setLanguage(e.target.value)}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                
              </select>
            </div>

            <div className="panel-body">
              {activeTab === "paste" ? (
                <>
                  <div className="paste-toolbar">
                    <button type="button" className="paste-clipboard-btn" onClick={handlePaste}>📋 Paste from Clipboard</button>
                    {code && <button type="button" className="clear-btn" onClick={() => { setCode(""); setResult(null); setError(null); }}>🗑 Clear</button>}
                  </div>
                  <div className="code-input-wrap">
                    <div className="line-numbers">
                      {(code || " ").split("\n").map((_, i) => <div key={i} className="line-num">{i + 1}</div>)}
                    </div>
                    <textarea ref={textareaRef} className="code-textarea" value={code}
                      onChange={e => { setCode(e.target.value); setResult(null); setError(null); }}
                      placeholder={"# Click 'Paste from Clipboard' above\n# or type/paste your code here directly\n# Supports Python, JS, Java, C++, and more"}
                      spellCheck={false} autoComplete="off" autoCorrect="off" />
                  </div>
                </>
              ) : (
                <div ref={dropRef}
                  className={`drop-zone ${dragging ? "drop-zone-active" : ""} ${file ? "drop-zone-filled" : ""}`}
                  onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
                  onClick={() => fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" hidden accept=".py,.js,.ts,.jsx,.tsx,.java,.cpp,.c,.cs,.go,.rb,.php,.swift,.kt,.rs,.html,.css,.sql,.sh,.r,.m,.pdf,.txt"
                    onChange={e => handleFileSelect(e.target.files[0])} />
                  {file ? (
                    <div className="file-info">
                      <div className="file-icon">📄</div>
                      <div className="file-details"><div className="file-name">{file.name}</div><div className="file-size">{(file.size/1024).toFixed(1)} KB</div></div>
                      <button type="button" className="file-remove" onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}>Remove</button>
                    </div>
                  ) : (
                    <div className="drop-prompt">
                      <div className="drop-icon-wrap"><div className="drop-icon">📂</div></div>
                      <div className="drop-title">Drop your file here</div>
                      <div className="drop-sub">or click to browse</div>
                      <div className="drop-formats">PDF · Python · JS · Java · C++ · and more</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="panel-footer">
              {error && (
                <div className="error-banner">
                  <span>⚠️ {error}</span>
                  <button className="error-close" onClick={() => setError(null)}>✕</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="debug-btn" onClick={handleDebug} disabled={loading} style={{ flex: 1 }}>
                  {loading ? <><span className="spinner"/> Analyzing your code...</> : "🔮 Fix My Code"}
                </button>
                <button type="button" onClick={handleRun} disabled={runLoading || (!code.trim() && !result)}
                  style={{ padding: "0 18px", background: "var(--fix)", color: "white", border: "none", borderRadius: 8,
                    fontWeight: 700, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", opacity: (!code.trim() && !result) ? 0.5 : 1 }}>
                  {runLoading ? "▶ Running…" : "▶ Run"}
                </button>
                <button type="button" onClick={handleShare} disabled={!code.trim()}
                  style={{ padding: "0 14px", background: "var(--bg-2)", color: "var(--text)", border: "1.5px solid var(--border)", borderRadius: 8,
                    fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: !code.trim() ? 0.5 : 1 }}>
                  {shareMsg || "🔗 Share"}
                </button>
              </div>
              {runOutput && (
                <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: "1.5px solid var(--border)" }}>
                  <div style={{ background: runOutput.exit_code === 0 ? "#064e3b" : "#7f1d1d",
                    padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "white", display: "flex", justifyContent: "space-between" }}>
                    <span>{runOutput.exit_code === 0 ? "✅ Output" : "❌ Error"} — {runOutput.language || "Python"}</span>
                    <button onClick={() => setRunOutput(null)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                  <pre style={{ margin: 0, padding: "10px 14px", fontSize: 12.5, lineHeight: 1.6,
                    background: "var(--bg-2)", color: "var(--text)", overflowX: "auto", maxHeight: 180, overflowY: "auto",
                    whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {runOutput.output || runOutput.error || "(no output)"}
                  </pre>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section className="panel panel-preview">
            <div className="panel-header right-panel-header">
              <div className="tab-row">
                <button type="button" className={`tab ${rightTab === "search" ? "tab-active" : ""}`} onClick={() => setRightTab("search")}>🔍 Search</button>
                <button type="button" className={`tab ${rightTab === "preview" ? "tab-active" : ""}`} onClick={() => setRightTab("preview")}>📋 Preview</button>
              </div>
              {result && rightTab === "preview" && (
                <div className="output-controls">
                  <div className="view-toggle">
                    <button type="button" className={`toggle-btn ${viewMode === "learn" ? "toggle-active" : ""}`} onClick={() => setViewMode("learn")}>Learn</button>
                    <button type="button" className={`toggle-btn ${viewMode === "fixed" ? "toggle-active" : ""}`} onClick={() => setViewMode("fixed")}>Fixed</button>
                  </div>
                </div>
              )}
            </div>

            {/* Always mounted — hidden with CSS so state is never lost on tab switch */}
            <div style={{ display: rightTab === "search" ? "flex" : "none", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <SearchBar
                onResult={() => setRightTab("search")}
                persistedResult={searchResult}
                setPersistedResult={setSearchResult}
                persistedQuery={searchQuery}
                setPersistedQuery={setSearchQuery}
              />
            </div>

            {rightTab === "preview" && <div className="panel-body">
              {limitExceeded && (
                <div style={{
                  background: "var(--error-bg)",
                  border: "2px solid var(--error)",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  color: "var(--error)",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  animation: "fadeInSlide 0.3s ease",
                  transition: "background 0.3s ease, color 0.3s ease, border-color 0.3s ease"
                }}>
                  <span style={{ fontSize: "20px" }}>🛑</span>
                  <div>
                    <div style={{ fontWeight: "700", marginBottom: "2px" }}>Daily Limit Reached!</div>
                    <div style={{ fontSize: "13px", fontWeight: "500" }}>{limitMessage}</div>
                  </div>
                </div>
              )}
              {!result && !loading && (
                <div className="empty-state">
                  <div className="empty-mascot">🤖</div>
                  <div className="empty-text">
                    <div className="empty-title">Ready to debug your code!</div>
                    <div className="empty-sub">Paste your code and I will fix it, step by step</div>
                  </div>
                  <div className="empty-hints">
                    <div className="hint-pill">🐛 Finds syntax errors</div>
                    <div className="hint-pill">🧠 Explains each fix clearly</div>
                    <div className="hint-pill">⚡ Powered by OpenAI</div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="loading-state">
                  <div className="loading-orb">🔍</div>
                  <div className="loading-label">Analyzing your code...</div>
                  <div className="loading-steps">
                    {steps.map((s, i) => (
                      <div key={i} className={`step ${i < loadingStep ? "step-done" : i === loadingStep ? "step-active" : ""}`}>
                        <span className="step-dot"/>{s}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <div className="result-body">
                  <div className="result-stats">
                    <div className={`stat-pill ${hasErrors ? "stat-errors" : "stat-clean"}`}>
                      {hasErrors ? `🐛 ${errorCount} bug${errorCount !== 1 ? "s" : ""} fixed` : "✅ No bugs found"}
                    </div>
                    <div className="stat-pill stat-lang">💻 {result.language}</div>
                    <button onClick={handleApplyFix}
                      style={{ padding: "4px 12px", background: "var(--fix)", color: "white", border: "none",
                        borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      ✏️ Apply Fix
                    </button>
                    {hasErrors && (
                      <button onClick={handleExplainSimple} disabled={simpleLoading}
                        style={{ padding: "4px 12px", background: "#7c3aed", color: "white", border: "none",
                          borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        {simpleLoading ? "…" : "🧒 Explain Simply"}
                      </button>
                    )}
                  </div>
                  {simpleExp && (
                    <div style={{ background: "#f5f3ff", border: "1.5px solid #c4b5fd", borderRadius: 10,
                      padding: "14px 16px", marginBottom: 12, fontSize: 13.5, lineHeight: 1.7, color: "#4c1d95" }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, fontSize: 13 }}>🧒 Simple Explanation</div>
                      <button onClick={() => setSimpleExp("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#7c3aed", fontSize: 16 }}>✕</button>
                      {simpleExp}
                    </div>
                  )}

                  {/* RICH SUMMARY */}
                  <div className="tutor-summary-box">
                    <div className="tutor-summary-header">
                      <div className="tutor-avatar">🖥️</div>
                      <span className="tutor-summary-name">CodeFix Says</span>
                    </div>
                    <div className="tutor-summary-intro">
                      {errorCount === 0
                        ? `✅ Great news! ${result.language !== "Unknown" ? `Your ${result.language} code` : "Your code"} looks clean — no bugs found.`
                        : `I analyzed your ${result.language !== "Unknown" ? result.language : ""} code and found ${errorCount} issue${errorCount !== 1 ? "s" : ""}.`}
                    </div>

                    {/* Explanation as bullet points */}
                    {result.explanation && (
                      <div className="tutor-bullet-list">
                        {result.explanation.split(/[.!?]+/).filter(s => s.trim().length > 10).map((sentence, i) => (
                          <div key={i} className="tutor-bullet-item">
                            <span className="tutor-bullet-dot">•</span>
                            <span>{sentence.trim()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {hasErrors && (
                      <>
                        <div className="tutor-summary-section-title">🐛 Errors Found</div>
                        <div className="tutor-summary-list">
                          {result.errors_found.map((e, i) => (
                            <div key={i} className="tutor-summary-point tutor-point-error">
                              <span className="tutor-point-num">{i + 1}</span><span>{e}</span>
                            </div>
                          ))}
                        </div>
                        <div className="tutor-summary-section-title">🛠️ Fixes Applied</div>
                        <div className="tutor-summary-list">
                          {result.fixes_applied.map((f, i) => (
                            <div key={i} className="tutor-summary-point tutor-point-fix">
                              <span className="tutor-point-num tutor-point-num-fix">{i + 1}</span><span>{f}</span>
                            </div>
                          ))}
                        </div>

                        {/* Related example */}
                        <div className="tutor-summary-section-title">💡 Quick Example (Fixed Pattern)</div>
                        <div className="tutor-example-box">
                          <div className="tutor-example-label">✅ Corrected version preview</div>
                          <DiffCode original={result.original_code} fixed={result.debugged_code.split("\n").slice(0, 8).join("\n")} />
                        </div>
                      </>
                    )}
                  </div>

                  {viewMode === "learn" && hasErrors && (
                    <div className="learn-section">
                      <div className="learn-section-title">📚 Step-by-Step Error Correction</div>
                      <div className="learn-steps-list">
                        {result.errors_found.map((err, i) => (
                          <LearningStep key={i} index={i} error={err} fix={result.fixes_applied?.[i] || "Fix applied automatically."} />
                        ))}
                      </div>
                      <div className="learn-code-block">
                        <div className="learn-code-header">
                          <span>✅ Corrected Code</span>
                          <div className="learn-code-actions">
                            <CopyButton text={result.debugged_code} label="📋 Copy"/>
                            <DownloadButton code={result.debugged_code} language={result.language || language}/>
                          </div>
                        </div>
                        <DiffCode original={result.original_code} fixed={result.debugged_code} />
                      </div>
                    </div>
                  )}

                  {viewMode === "learn" && !hasErrors && (
                    <div className="no-errors-learn">
                      <div className="no-errors-icon">✅</div>
                      <div className="no-errors-title">No bugs were found!</div>
                      <div className="no-errors-sub">Your code looks clean and correct. Keep it up!</div>
                      <div className="learn-code-block" style={{marginTop:16}}>
                        <div className="learn-code-header">
                          <span>Your Code</span>
                          <div className="learn-code-actions">
                            <CopyButton text={result.debugged_code} label="📋 Copy"/>
                            <DownloadButton code={result.debugged_code} language={result.language || language}/>
                          </div>
                        </div>
                        <DiffCode original={result.original_code} fixed={result.debugged_code} />
                      </div>
                    </div>
                  )}

                  {viewMode === "fixed" && (
                    <>
                      {hasErrors && (
                        <div className="errors-fixes-grid">
                          <div className="ef-col">
                            <div className="ef-title ef-title-error">🐛 Bugs Found</div>
                            {result.errors_found.map((e, i) => <div key={i} className="ef-item ef-item-error"><span className="ef-num">{i+1}</span><span>{e}</span></div>)}
                          </div>
                          <div className="ef-col">
                            <div className="ef-title ef-title-fix">🛠️ Fixes Applied</div>
                            {result.fixes_applied.map((f, i) => <div key={i} className="ef-item ef-item-fix"><span className="ef-num">{i+1}</span><span>{f}</span></div>)}
                          </div>
                        </div>
                      )}
                      <div className="code-output-wrap">
                        <div className="code-output-header">
                          <span className="code-output-label">🚀 Ready-to-Run Code</span>
                          <div style={{display:"flex",gap:8}}>
                            <CopyButton text={result.debugged_code} label="📋 Copy"/>
                            <DownloadButton code={result.debugged_code} language={result.language || language}/>
                          </div>
                        </div>
                        <DiffCode original={result.original_code} fixed={result.debugged_code} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>}
          </section>
        </div>
      </main>
      <DebugHistory userId={userId} isOpen={showHistory} onClose={() => setShowHistory(false)} apiUrl={API_BASE} />
      <FloatingChat />
    </div>
  );
}
