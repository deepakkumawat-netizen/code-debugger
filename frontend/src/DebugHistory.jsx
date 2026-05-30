import React, { useState, useEffect, useMemo } from 'react';

const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8004" : window.location.origin;

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

const formatDateTime = (s) => {
  if (!s) return '';
  const d = new Date(s.includes('Z') || s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const sessionLabel = (sess, idx) => {
  if (!sess) return `Session ${idx + 1}`;
  const ts = sess.first_at ? formatDateTime(sess.first_at) : '';
  return ts ? `${ts} · ${sess.count} item${sess.count === 1 ? '' : 's'}` : `Session ${idx + 1}`;
};

// ─── DEBUG VIEWER (Word-like modal for a single history entry) ─────────────────
function DebugViewer({ debug, onClose }) {
  if (!debug) return null;

  const renderText = () => {
    const lines = [];
    lines.push(`Language: ${debug.language || 'unknown'}`);
    lines.push(`Saved: ${formatDateTime(debug.created_at)}`);
    if (debug.session_id) lines.push(`Session: ${debug.session_id}`);
    lines.push('');
    lines.push('=== ORIGINAL CODE ===');
    lines.push(debug.code || '');
    lines.push('');
    if (debug.errors && debug.errors.length) {
      lines.push('=== ERRORS FOUND ===');
      debug.errors.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
      lines.push('');
    }
    if (debug.fixes && debug.fixes.length) {
      lines.push('=== FIXES APPLIED ===');
      debug.fixes.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
      lines.push('');
    }
    if (debug.explanation) {
      lines.push('=== EXPLANATION ===');
      lines.push(debug.explanation);
    }
    return lines.join('\n');
  };

  const text = renderText();

  const downloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-${debug.id || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      const maxW = pageW - margin * 2;
      let y = margin;
      text.split('\n').forEach(line => {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        const t = line;
        if (!t.trim()) { y += 4; return; }
        const isHeading = /^={3,}.*={3,}$/.test(t.trim());
        doc.setFont(isHeading ? 'helvetica' : 'courier', isHeading ? 'bold' : 'normal');
        doc.setFontSize(isHeading ? 11 : 9.5);
        doc.setTextColor(11, 27, 45);
        const wrapped = doc.splitTextToSize(t, maxW);
        if (y + wrapped.length * 5 > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 1.5;
      });
      doc.save(`debug-${debug.id || Date.now()}.pdf`);
    };
    document.head.appendChild(script);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(2, 6, 23, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(820px, 100%)', height: 'min(86vh, 820px)',
          background: 'var(--surface)', color: 'var(--text)',
          borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          border: '1.5px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, var(--blue) 0%, var(--blue-hover) 100%)',
          color: 'white', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🐛 Debug · {debug.language || 'unknown'}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>{formatDateTime(debug.created_at)}</div>
          </div>
          <button onClick={downloadPdf} title="Download as PDF"
            style={{ background: 'white', color: '#dc2626', border: 'none', borderRadius: 8,
              padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>⬇ PDF</button>
          <button onClick={downloadTxt} title="Download as TXT"
            style={{ background: 'rgba(255,255,255,0.95)', color: '#16a34a', border: 'none', borderRadius: 8,
              padding: '6px 10px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>TXT</button>
          <button onClick={onClose} title="Close"
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <pre style={{
          flex: 1, margin: 0, padding: '20px 24px', overflow: 'auto',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 13, lineHeight: 1.6,
          background: 'var(--bg)', color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{text}</pre>
      </div>
    </div>
  );
}

// ─── DEBUG HISTORY POPUP ──────────────────────────────────────────────────────
const DebugHistory = ({ userId, isOpen, onClose, apiUrl = API_BASE }) => {
  const [debugs, setDebugs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [activeDebug, setActiveDebug] = useState(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/debug-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (_) { /* ignored */ }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiUrl}/api/debug-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          date_from: dateFrom || null,
          date_to: dateTo || null,
          session_id: sessionId || null,
          limit: 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDebugs(data.debugs || []);
      } else {
        setError(`Failed to load history (${res.status})`);
      }
    } catch (e) {
      setError(`Connection error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchSessions();
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  // Refetch when a filter changes (while the popup is open)
  useEffect(() => {
    if (!isOpen) return;
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, sessionId]);

  const sessionOptions = useMemo(() => sessions.map((s, i) => ({
    value: s.session_id,
    label: sessionLabel(s, i),
  })), [sessions]);

  const setPreset = (preset) => {
    const today = todayIso();
    if (preset === 'today')     { setDateFrom(today);             setDateTo(today); }
    else if (preset === 'week') { setDateFrom(daysAgoIso(7));     setDateTo(today); }
    else if (preset === 'month'){ setDateFrom(daysAgoIso(30));    setDateTo(today); }
    else                        { setDateFrom('');                setDateTo('');    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(2, 6, 23, 0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(720px, 100%)', height: 'min(86vh, 760px)',
            background: 'var(--surface)', color: 'var(--text)',
            borderRadius: 14, boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
            border: '1.5px solid var(--border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'linear-gradient(135deg, var(--blue) 0%, var(--blue-hover) 100%)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>📋 Debug History</div>
              <div style={{ fontSize: 11, opacity: 0.9 }}>
                {loading ? 'Loading…' : `${debugs.length} item${debugs.length === 1 ? '' : 's'}`}
                {' · '}user {userId.slice(0, 12)}…
              </div>
            </div>
            <button onClick={onClose} title="Close"
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          {/* Filter bar */}
          <div style={{
            padding: '12px 16px', borderBottom: '1.5px solid var(--border)',
            background: 'var(--surface-2, var(--bg))',
            display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
          }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPreset('today')} style={presetBtn}>Today</button>
              <button onClick={() => setPreset('week')}  style={presetBtn}>7d</button>
              <button onClick={() => setPreset('month')} style={presetBtn}>30d</button>
              <button onClick={() => setPreset('all')}   style={presetBtn}>All</button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                title="From" style={dateInput} />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                title="To" style={dateInput} />
            </div>
            <select value={sessionId} onChange={e => setSessionId(e.target.value)}
              style={{ ...dateInput, minWidth: 160 }} title="Filter by login session">
              <option value="">All sessions</option>
              {sessionOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {(dateFrom || dateTo || sessionId) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setSessionId(''); }}
                style={{ ...presetBtn, color: '#ef4444', borderColor: '#fecaca' }}>Clear</button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {error && (
              <div style={{ padding: 12, background: '#ef444418', border: '1px solid #ef444455',
                color: '#ef4444', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                ⚠️ {error}
              </div>
            )}
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
                Loading history…
              </div>
            ) : debugs.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>No debugs match your filters.</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                  Run "Fix My Code" — saved debugs will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {debugs.map((d, i) => (
                  <div key={d.id || i}
                    onClick={() => setActiveDebug(d)}
                    style={{
                      display: 'flex', gap: 12, padding: 12, borderRadius: 10,
                      background: 'var(--surface-2, var(--bg))', cursor: 'pointer',
                      border: '1px solid var(--border)', transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--blue)';
                      e.currentTarget.style.transform = 'translateX(2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateX(0)'; }}
                  >
                    <div style={{ fontSize: 22, flexShrink: 0 }}>🐛</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                        {d.language || 'unknown'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: '"JetBrains Mono", monospace', marginTop: 2 }}>
                        {d.preview || 'No code preview'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        {formatDateTime(d.created_at)}
                        {d.errors?.length ? ` · ${d.errors.length} error${d.errors.length === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    <div style={{ alignSelf: 'center', fontSize: 11, color: 'var(--blue)',
                      whiteSpace: 'nowrap', fontWeight: 700 }}>Open →</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeDebug && <DebugViewer debug={activeDebug} onClose={() => setActiveDebug(null)} />}
    </>
  );
};

const presetBtn = {
  padding: '5px 10px', fontSize: 12, fontWeight: 600,
  background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 6,
  cursor: 'pointer',
};
const dateInput = {
  padding: '5px 8px', fontSize: 12,
  background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: 6,
  fontFamily: 'inherit',
};

export default DebugHistory;
