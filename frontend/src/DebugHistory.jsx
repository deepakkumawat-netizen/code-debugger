import React, { useState, useEffect } from 'react';

const API_BASE = window.location.hostname === "localhost" ? "http://localhost:8004" : window.location.origin;

const DebugHistory = ({ userId, isOpen, onClose, apiUrl = API_BASE }) => {
  const [debugs, setDebugs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDebugHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[DebugHistory] Fetching for user:', userId);

      const response = await fetch(`${apiUrl}/api/debug-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      console.log('[DebugHistory] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[DebugHistory] Fetched data:', data);
        setDebugs(data.debugs || []);
      } else {
        const errorText = await response.text();
        console.error('[DebugHistory] API error:', response.status, errorText);
        setError(`Failed to load debug history (${response.status})`);
      }
    } catch (error) {
      console.error('[DebugHistory] Error fetching debug history:', error);
      setError(`Connection error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDebugHistory();
    }
  }, [isOpen, userId]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      width: 320,
      height: '100vh',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-in-out, background 0.3s ease',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(135deg, var(--blue) 0%, var(--blue-hover) 100%)',
        color: 'white',
        transition: 'background 0.3s ease'
      }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📋 Debug History</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 20,
            cursor: 'pointer',
            padding: 0,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 6,
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px'
      }}>
        {error && (
          <div style={{ padding: 12, background: 'var(--error-bg)', borderRadius: 8, margin: 8, color: 'var(--error)', fontSize: 12, transition: 'background 0.3s ease, color 0.3s ease' }}>
            ⚠️ {error}
          </div>
        )}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', transition: 'color 0.3s ease' }}>
            Loading history...
          </div>
        ) : debugs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', transition: 'color 0.3s ease' }}>
            <p>No debug history yet.</p>
            <p style={{ fontSize: 12, color: 'var(--border-strong)', marginTop: 8, transition: 'color 0.3s ease' }}>
              Start debugging and your last 7 debugs will appear here!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {debugs.map((debug, i) => (
              <div
                key={debug.id || i}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  border: '1px solid var(--border)',
                  userSelect: 'none'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--blue-light)';
                  e.currentTarget.style.borderColor = 'var(--blue)';
                  e.currentTarget.style.transform = 'translateX(-4px)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(57, 154, 255, 0.2)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--surface-2)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: 20, flexShrink: 0 }}>🐛</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 600,
                    color: 'var(--text)',
                    fontSize: 14,
                    transition: 'color 0.3s ease',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 4
                  }}>
                    {debug.language}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'var(--text-3)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 4,
                    transition: 'color 0.3s ease'
                  }}>
                    {debug.preview || 'No preview'}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--border-strong)',
                    transition: 'color 0.3s ease'
                  }}>
                    {formatDate(debug.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugHistory;
