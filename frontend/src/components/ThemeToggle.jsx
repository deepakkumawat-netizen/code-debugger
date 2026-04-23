import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: 'var(--surface-2)',
        border: '1.5px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 12px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.3s ease',
        fontFamily: 'var(--sans)',
      }}
      onMouseEnter={(e) => {
        e.target.style.borderColor = 'var(--blue)';
        e.target.style.color = 'var(--blue)';
      }}
      onMouseLeave={(e) => {
        e.target.style.borderColor = 'var(--border)';
        e.target.style.color = 'var(--text)';
      }}
      title="Toggle dark/light mode"
    >
      {isDark ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
