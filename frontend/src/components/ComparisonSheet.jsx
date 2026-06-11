import { useState } from 'react';
import StructureViewer from './StructureViewer';
import CompoundDetailModal from './CompoundDetailModal';
import { saveCompound } from '../api';

const mono = { fontFamily: "'JetBrains Mono',monospace" };

// 화장품 원료 기준 색상 임계값
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

const COLOR = { good: 'var(--good)', warn: 'var(--warn)', flag: 'var(--flag)' };

const ROWS = [
  { key: 'formula',    label: '분자식',    fmt: v => v },
  { key: 'mw',         label: 'MW',        fmt: v => v?.toFixed(2) },
  { key: 'exact_mass', label: 'Exact Mass', fmt: v => v?.toFixed(4) },
  { key: 'logp',       label: 'logP',      fmt: v => v?.toFixed(2) },
  { key: 'tpsa',       label: 'TPSA',      fmt: v => v?.toFixed(1) },
  { key: 'hbd',        label: 'HBD',       fmt: v => v },
  { key: 'hba',        label: 'HBA',       fmt: v => v },
  { key: 'rot_bonds',  label: '회전결합',   fmt: v => v },
  { key: 'heavy_atoms',label: '헤비원자',   fmt: v => v },
  { key: 'rings',      label: '고리수',    fmt: v => v },
];

const LABEL_W = 88;
const COL_W   = 196;
const ROW_H   = 36;
const HEAD_H  = 226;

export default function ComparisonSheet({ compounds, onRemove, onClear }) {
  const [savingId, setSavingId]   = useState(null);
  const [savedIds, setSavedIds]   = useState(new Set());
  const [saveErr, setSaveErr]     = useState('');
  const [detail,  setDetail]      = useState(null);

  async function handleSave(c) {
    if (savingId === c.id || savedIds.has(c.id)) return;
    setSavingId(c.id);
    setSaveErr('');
    try {
      await saveCompound({ name: c.name, smiles: c.smiles, result: c.data });
      setSavedIds(prev => new Set([...prev, c.id]));
    } catch (err) {
      setSaveErr(err.message);
    } finally {
      setSavingId(null);
    }
  }

  /* ── 빈 상태 ── */
  if (compounds.length === 0) {
    return (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)' }}>
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>COMPARE</span>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>물질 비교 시트</h2>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--faint)', ...mono, fontSize: 12, lineHeight: 1.8 }}>
          SMILES를 입력하거나 원료를 선택해 분석하세요<br />
          여러 물질을 추가하면 지표를 나란히 비교할 수 있습니다
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>COMPARE</span>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>
            물질 비교 시트&nbsp;
            <span style={{ ...mono, fontSize: 11, color: 'var(--faint)', fontWeight: 400 }}>{compounds.length}개 · 최대 6개</span>
          </h2>
        </div>
        <button onClick={onClear} style={{
          ...mono, fontSize: 11, color: 'var(--flag)',
          background: 'transparent', border: '1px solid var(--flag)',
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
        }}>
          전체 초기화
        </button>
      </div>

      {saveErr && (
        <div style={{ margin: '8px 16px 0', background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--flag)' }}>
          저장 오류: {saveErr}
        </div>
      )}

      {/* 비교 테이블 */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', minWidth: LABEL_W + COL_W * compounds.length }}>

          {/* 지표 라벨 컬럼 (sticky) */}
          <div style={{ flexShrink: 0, width: LABEL_W, position: 'sticky', left: 0, zIndex: 2, background: 'var(--panel)' }}>
            <div style={{ height: HEAD_H, borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'flex-end', padding: '0 10px 10px' }}>
              <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>지표</span>
            </div>
            {ROWS.map(({ key, label }) => (
              <div key={key} style={{
                height: ROW_H, padding: '0 10px',
                display: 'flex', alignItems: 'center',
                borderBottom: '1px solid var(--line-2)',
              }}>
                <span style={{ ...mono, fontSize: 11, color: 'var(--muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* 화합물 컬럼 */}
          {compounds.map(c => (
            <div key={c.id} style={{ flexShrink: 0, width: COL_W, borderLeft: '1px solid var(--line-2)' }}>
              {/* 컬럼 헤더: 이름 + 구조 + 저장 */}
              <div style={{ height: HEAD_H, borderBottom: '1px solid var(--line-2)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, lineHeight: 1.3, flex: 1 }}>
                    {c.name || '이름 없음'}
                  </span>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setDetail(c)} title="상세 보기" style={{
                      ...mono, fontSize: 10, color: 'var(--accent)',
                      background: 'transparent', border: '1px solid var(--accent)',
                      borderRadius: 6, padding: '2px 6px', cursor: 'pointer',
                    }}>상세</button>
                    <button onClick={() => onRemove(c.id)} title="제거" style={{
                      ...mono, fontSize: 11, color: 'var(--muted)',
                      background: 'transparent', border: '1px solid var(--line)',
                      borderRadius: 6, padding: '2px 6px', cursor: 'pointer',
                    }}>✕</button>
                  </div>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <StructureViewer smiles={c.smiles} height={124} />
                </div>
                <button onClick={() => handleSave(c)}
                  disabled={savedIds.has(c.id) || savingId === c.id}
                  style={{
                    ...mono, fontSize: 10, fontWeight: 600, color: '#fff',
                    background: savedIds.has(c.id) ? 'var(--good)' : 'var(--accent)',
                    border: 'none', borderRadius: 6, padding: '4px 0',
                    cursor: savedIds.has(c.id) ? 'default' : 'pointer',
                    opacity: savingId === c.id ? 0.6 : 1, width: '100%',
                  }}>
                  {savedIds.has(c.id) ? '✓ 저장됨' : savingId === c.id ? '저장 중…' : '저장'}
                </button>
              </div>

              {/* 지표 값 셀 */}
              {ROWS.map(({ key, fmt }) => {
                const raw  = c.data?.[key];
                const text = raw != null ? (fmt(raw) ?? '-') : '-';
                const tier = cellTier(key, raw);
                const fg   = tier ? COLOR[tier] : 'var(--ink)';
                return (
                  <div key={key} style={{
                    height: ROW_H, padding: '0 12px',
                    display: 'flex', alignItems: 'center',
                    borderBottom: '1px solid var(--line-2)',
                    background: tier ? `${COLOR[tier]}12` : 'transparent',
                  }}>
                    <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: fg }}>{text}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line-2)', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {[
          ['good', '화장품 최적'],
          ['warn', '허용 범위'],
          ['flag', '주의 필요'],
        ].map(([t, lbl]) => (
          <span key={t} style={{ ...mono, fontSize: 10, color: COLOR[t], display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: `${COLOR[t]}25`, border: `1px solid ${COLOR[t]}70`, display: 'inline-block' }} />
            {lbl}
          </span>
        ))}
        <span style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginLeft: 'auto' }}>
          MW·logP·TPSA·HBD/HBA·회전결합 기준
        </span>
      </div>

      {detail && <CompoundDetailModal compound={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
