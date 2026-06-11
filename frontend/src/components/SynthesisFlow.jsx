const mono = { fontFamily: "'JetBrains Mono',monospace" };

const TYPE_META = {
  start:        { color: 'var(--accent)', label: '시작' },
  reaction:     { color: '#8b5cf6',       label: '반응' },
  workup:       { color: '#f59e0b',       label: 'Workup' },
  purification: { color: '#06b6d4',       label: '정제' },
  analysis:     { color: 'var(--good)',   label: '분석' },
  end:          { color: 'var(--muted)',  label: '완료' },
};

const TAG_COLORS = {
  reagents:  { bg: '#8b5cf620', border: '#8b5cf660', text: '#8b5cf6',     label: '시약' },
  catalyst:  { bg: '#f59e0b20', border: '#f59e0b60', text: '#f59e0b',     label: '촉매' },
  solvent:   { bg: '#06b6d420', border: '#06b6d460', text: '#06b6d4',     label: '용매' },
  conditions:{ bg: '#22c55e20', border: '#22c55e60', text: '#22c55e',     label: '조건' },
};

function ChemTag({ text, scheme }) {
  const s = TAG_COLORS[scheme] || TAG_COLORS.reagents;
  return (
    <span style={{
      ...mono, fontSize: 10,
      color: s.text, background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 6, padding: '2px 8px',
      display: 'inline-block',
    }}>
      {text}
    </span>
  );
}

function TagGroup({ label, items, scheme }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...mono, fontSize: 9, color: TAG_COLORS[scheme]?.text || 'var(--faint)', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.1em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {items.map((item, i) => <ChemTag key={i} text={item} scheme={scheme} />)}
      </div>
    </div>
  );
}

function CondRow({ temperature, time }) {
  if (!temperature && !time) return null;
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
      {temperature && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11 }}>🌡</span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--muted)' }}>{temperature}</span>
        </div>
      )}
      {time && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11 }}>⏱</span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--muted)' }}>{time}</span>
        </div>
      )}
    </div>
  );
}

export default function SynthesisFlow({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {steps.map((s, i) => {
        const meta   = TYPE_META[s.type] || TYPE_META.reaction;
        const isLast = i === steps.length - 1;
        const hasDetail = s.reagents?.length || s.catalyst?.length || s.solvent?.length || s.conditions?.length || s.temperature || s.time;

        return (
          <div key={s.step} style={{ display: 'flex', gap: 0 }}>
            {/* 타임라인 축 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36, flexShrink: 0 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: `${meta.color}18`, border: `2px solid ${meta.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: meta.color,
                fontFamily: "'JetBrains Mono',monospace",
                zIndex: 1,
              }}>
                {s.step}
              </div>
              {!isLast && (
                <div style={{
                  width: 2, flex: 1, minHeight: 16,
                  background: `linear-gradient(to bottom, ${meta.color}66, ${(TYPE_META[steps[i + 1]?.type] || meta).color}33)`,
                  margin: '2px 0',
                }} />
              )}
            </div>

            {/* 스텝 내용 */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 18, paddingLeft: 12 }}>
              {/* 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, paddingTop: 4 }}>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
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

              {/* 설명 */}
              <p style={{ ...mono, fontSize: 11, color: 'var(--muted)', margin: '0 0 0', lineHeight: 1.6 }}>
                {s.detail}
              </p>

              {/* 세부 화학 정보 */}
              {hasDetail && (
                <div style={{ marginTop: 4, background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '10px 12px' }}>
                  <TagGroup label="시약"   items={s.reagents}   scheme="reagents" />
                  <TagGroup label="촉매"   items={s.catalyst}   scheme="catalyst" />
                  <TagGroup label="용매"   items={s.solvent}    scheme="solvent" />
                  <TagGroup label="조건"   items={s.conditions} scheme="conditions" />
                  <CondRow  temperature={s.temperature} time={s.time} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
