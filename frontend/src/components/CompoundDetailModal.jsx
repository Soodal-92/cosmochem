import { useEffect } from 'react';
import StructureViewer from './StructureViewer';

const mono = { fontFamily: "'JetBrains Mono',monospace" };

function cellTier(key, value) {
  if (value == null) return null;
  const v = parseFloat(value);
  switch (key) {
    case 'mw':        return v <= 300 ? 'good' : v <= 500 ? 'warn' : 'flag';
    case 'logp':      return (v >= 1 && v <= 3) ? 'good' : (v >= 0 && v <= 4) ? 'warn' : 'flag';
    case 'tpsa':      return v <= 60 ? 'good' : v <= 90 ? 'warn' : 'flag';
    case 'hbd':       return v <= 2 ? 'good' : v <= 3 ? 'warn' : 'flag';
    case 'hba':       return v <= 5 ? 'good' : v <= 7 ? 'warn' : 'flag';
    case 'rot_bonds': return v <= 5 ? 'good' : v <= 8 ? 'warn' : 'flag';
    default:          return null;
  }
}

const TIER_COLOR = { good: 'var(--good)', warn: 'var(--warn)', flag: 'var(--flag)' };
const TIER_LABEL = { good: '최적', warn: '허용', flag: '주의' };

const DESCRIPTORS = [
  { key: 'formula',     label: '분자식',      unit: '',       note: '' },
  { key: 'mw',          label: '분자량 (MW)', unit: 'g/mol',  note: '≤300 최적 · ≤500 허용' },
  { key: 'exact_mass',  label: '정확질량',    unit: 'Da',     note: '' },
  { key: 'logp',        label: 'logP',        unit: '',       note: '1–3 최적 · 0–4 허용 (피부 투과)' },
  { key: 'tpsa',        label: 'TPSA',        unit: 'Å²',     note: '≤60 최적 · ≤90 허용 (흡수)' },
  { key: 'hbd',         label: 'HBD',         unit: '개',     note: 'H-결합 공여체 · ≤2 최적' },
  { key: 'hba',         label: 'HBA',         unit: '개',     note: 'H-결합 수용체 · ≤5 최적' },
  { key: 'rot_bonds',   label: '회전 결합',   unit: '개',     note: '≤5 최적 (유연성)' },
  { key: 'heavy_atoms', label: '헤비 원자',   unit: '개',     note: '' },
  { key: 'rings',       label: '고리 수',     unit: '개',     note: '' },
];

function lipinskiCheck(data) {
  if (!data) return [];
  return [
    { rule: 'MW ≤ 500',   pass: data.mw != null && data.mw <= 500 },
    { rule: 'logP ≤ 5',   pass: data.logp != null && data.logp <= 5 },
    { rule: 'HBD ≤ 5',    pass: data.hbd != null && data.hbd <= 5 },
    { rule: 'HBA ≤ 10',   pass: data.hba != null && data.hba <= 10 },
  ];
}

export default function CompoundDetailModal({ compound, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!compound) return null;
  const { name, smiles, data } = compound;
  const lipinski = lipinskiCheck(data);
  const passCount = lipinski.filter(r => r.pass).length;

  function fmt(key, val) {
    if (val == null) return '-';
    if (key === 'formula') return val;
    if (key === 'exact_mass') return parseFloat(val).toFixed(4);
    if (['mw', 'tpsa', 'logp'].includes(key)) return parseFloat(val).toFixed(2);
    return val;
  }

  return (
    /* 백드롭 */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* 패널 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--panel)', border: '1px solid var(--line)',
          borderRadius: 18, width: '100%', maxWidth: 680,
          maxHeight: '90vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--line-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          flexShrink: 0,
        }}>
          <div>
            <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>DETAIL</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, margin: '2px 0 0' }}>
              {name || '이름 없음'}
            </h2>
          </div>
          <button onClick={onClose} style={{
            ...mono, fontSize: 13, color: 'var(--muted)',
            background: 'transparent', border: '1px solid var(--line)',
            borderRadius: 8, padding: '5px 11px', cursor: 'pointer',
          }}>ESC ✕</button>
        </div>

        {/* 바디 스크롤 */}
        <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 구조 + SMILES */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
              <StructureViewer smiles={smiles} height={240} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginBottom: 5 }}>SMILES</div>
                <div style={{
                  ...mono, fontSize: 11, color: 'var(--ink)',
                  background: 'var(--panel-2)', border: '1px solid var(--line-2)',
                  borderRadius: 8, padding: '10px 12px',
                  overflowWrap: 'anywhere', lineHeight: 1.6,
                }}>{smiles}</div>
              </div>

              {/* Lipinski Ro5 */}
              <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ ...mono, fontSize: 10, color: 'var(--muted)', marginBottom: 9 }}>
                  Lipinski Ro5&nbsp;
                  <span style={{ color: passCount === 4 ? 'var(--good)' : passCount >= 3 ? 'var(--warn)' : 'var(--flag)', fontWeight: 700 }}>
                    {passCount}/4 통과
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {lipinski.map(r => (
                    <div key={r.rule} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12 }}>{r.pass ? '✓' : '✗'}</span>
                      <span style={{
                        ...mono, fontSize: 11,
                        color: r.pass ? 'var(--good)' : 'var(--flag)',
                      }}>{r.rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 기술자 테이블 */}
          <div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginBottom: 10 }}>DESCRIPTORS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {DESCRIPTORS.map(({ key, label, unit, note }) => {
                const raw  = data?.[key];
                const text = fmt(key, raw);
                const tier = cellTier(key, raw);
                const fg   = tier ? TIER_COLOR[tier] : 'var(--ink)';
                return (
                  <div key={key} style={{
                    display: 'grid', gridTemplateColumns: '130px 100px auto',
                    alignItems: 'center', gap: 12,
                    padding: '9px 12px', borderRadius: 8,
                    background: tier ? `${TIER_COLOR[tier]}0d` : 'transparent',
                    border: `1px solid ${tier ? TIER_COLOR[tier] + '22' : 'var(--line-2)'}`,
                  }}>
                    <span style={{ ...mono, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{label}</span>
                    <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: fg }}>
                      {text}{raw != null && unit ? <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 400 }}> {unit}</span> : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tier && (
                        <span style={{
                          ...mono, fontSize: 9, fontWeight: 700,
                          color: TIER_COLOR[tier], background: `${TIER_COLOR[tier]}20`,
                          border: `1px solid ${TIER_COLOR[tier]}55`,
                          borderRadius: 999, padding: '1px 7px',
                        }}>{TIER_LABEL[tier]}</span>
                      )}
                      {note && <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>{note}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
