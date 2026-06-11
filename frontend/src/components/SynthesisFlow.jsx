const mono = { fontFamily: "'JetBrains Mono',monospace" };

const TYPE_META = {
  start:        { color: 'var(--accent)', icon: '◎', label: '시작' },
  reaction:     { color: '#8b5cf6',       icon: '⚗',  label: '반응' },
  workup:       { color: '#f59e0b',       icon: '⟳',  label: 'Workup' },
  purification: { color: '#06b6d4',       icon: '◈',  label: '정제' },
  analysis:     { color: 'var(--good)',   icon: '⊙',  label: '분석' },
  end:          { color: 'var(--muted)',  icon: '✓',  label: '완료' },
};

export default function SynthesisFlow({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((s, i) => {
        const meta  = TYPE_META[s.type] || TYPE_META.reaction;
        const isLast = i === steps.length - 1;

        return (
          <div key={s.step} style={{ display: 'flex', gap: 0 }}>
            {/* 타임라인 축 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
              {/* 원형 아이콘 */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: `${meta.color}18`,
                border: `2px solid ${meta.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: meta.color,
                zIndex: 1,
              }}>
                {s.step}
              </div>
              {/* 연결선 */}
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 16,
                  background: `linear-gradient(to bottom, ${meta.color}66, ${(TYPE_META[steps[i + 1]?.type] || meta).color}33)`,
                  margin: '2px 0',
                }} />
              )}
            </div>

            {/* 스텝 내용 */}
            <div style={{
              flex: 1, minWidth: 0,
              paddingBottom: isLast ? 0 : 14,
              paddingLeft: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, paddingTop: 4 }}>
                <span style={{
                  fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700,
                  color: 'var(--ink)',
                }}>
                  {s.title}
                </span>
                <span style={{
                  ...mono, fontSize: 9, fontWeight: 700,
                  color: meta.color, background: `${meta.color}18`,
                  border: `1px solid ${meta.color}44`,
                  borderRadius: 999, padding: '1px 7px',
                }}>
                  {meta.label}
                </span>
              </div>
              <p style={{
                ...mono, fontSize: 11, color: 'var(--muted)',
                margin: 0, lineHeight: 1.6,
              }}>
                {s.detail}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
