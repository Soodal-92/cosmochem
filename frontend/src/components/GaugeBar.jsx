export default function GaugeBar({ label, sub, value, min, max, segments, litValue, isEstimate }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const litPct = litValue != null
    ? Math.max(0, Math.min(100, ((litValue - min) / (max - min)) * 100))
    : null;

  function segColor(t) {
    if (t === 'good') return 'var(--good-soft)';
    if (t === 'warn') return 'var(--warn-soft)';
    return 'var(--flag-soft)';
  }

  function valueColor(v) {
    for (const s of segments) {
      if (v >= s.from && v < s.to) {
        if (s.t === 'good') return 'var(--good)';
        if (s.t === 'warn') return 'var(--warn)';
        return 'var(--flag)';
      }
    }
    return 'var(--muted)';
  }

  const vc = valueColor(value);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {label}
          {sub && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--faint)', marginLeft: 6 }}>{sub}</span>}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: vc }}>
          {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
          {isEstimate && (
            <span style={{ fontSize: 10, background: 'var(--warn-soft)', color: 'var(--warn)', borderRadius: 4, padding: '1px 5px', marginLeft: 6 }}>추정</span>
          )}
          {litValue != null && (
            <span style={{ fontSize: 11, color: 'var(--faint)', marginLeft: 6 }}>lit. {litValue}</span>
          )}
        </span>
      </div>

      <div style={{ position: 'relative', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--line)', display: 'flex' }}>
        {segments.map((s, i) => {
          const sw = ((s.to - s.from) / (max - min)) * 100;
          return <div key={i} style={{ width: `${sw}%`, background: segColor(s.t) }} />;
        })}
        {litPct != null && (
          <div style={{
            position: 'absolute', top: 0, left: `${litPct}%`, width: 2, height: '100%',
            background: 'var(--faint)', transform: 'translateX(-50%)',
          }} />
        )}
        <div style={{
          position: 'absolute', top: -2, left: `${pct}%`, width: 4, height: 12,
          background: vc, borderRadius: 2, transform: 'translateX(-50%)',
          boxShadow: '0 0 0 2px white',
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}
