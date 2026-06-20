const LEVEL_STYLES = {
  DEBUG: { bg: '#f0eff2', color: '#6e6880', border: '#e4e2e8' },
  INFO:  { bg: '#e6f9ee', color: '#0a7b3e', border: '#b4eacc' },
  WARN:  { bg: '#fef5e0', color: '#8a6200', border: '#fde5a0' },
  ERROR: { bg: '#fde8ec', color: '#c4133a', border: '#f9bcc8' },
  FATAL: { bg: '#fde0ef', color: '#b5096e', border: '#f9b0d5' },
};

export default function LogLevelTag({ level }) {
  const s = LEVEL_STYLES[level] || LEVEL_STYLES.DEBUG;

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      fontSize: 11,
      fontWeight: 600,
      borderRadius: 4,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      lineHeight: '20px',
      letterSpacing: 0.4,
    }}>
      {level}
    </span>
  );
}
