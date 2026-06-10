import { useState } from 'react';
import StructureViewer from './StructureViewer';
import GaugeBar from './GaugeBar';
import { saveCompound } from '../api';

const PRESETS_LIT = {
  niacinamide:  { mw: 122.12, logp: -0.37, tpsa: 55.98 },
  ascorbicacid: { mw: 176.12, logp: -1.85, tpsa: 107.22 },
  retinol:      { mw: 286.46, logp: 5.68,  tpsa: 20.23 },
  alphaarbutin: { mw: 272.25, logp: -1.16, tpsa: 119.61 },
  kojicacid:    { mw: 142.11, logp: -1.15, tpsa: 70.66 },
  resveratrol:  { mw: 228.24, logp: 3.1,   tpsa: 60.69 },
  caffeine:     { mw: 194.19, logp: -0.07, tpsa: 58.44 },
  pantenol:     { mw: 205.25, logp: -1.6,  tpsa: 90.4 },
};

function litFor(name) {
  if (!name) return null;
  const k = name.toLowerCase().replace(/[^a-z]/g, '');
  return PRESETS_LIT[k] || null;
}

export default function DescriptorPanel({ result, smiles, compoundName, isEstimate }) {
  const [saveState, setSaveState] = useState('idle'); // idle | saving | done | error
  const [saveError, setSaveError] = useState('');

  async function handleSave() {
    setSaveState('saving');
    setSaveError('');
    try {
      await saveCompound({ name: compoundName, smiles, result });
      setSaveState('done');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveError(err.message);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
    }
  }

  if (!result) {
    return (
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>2D</span>
          <h2 style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>구조 · 분자 지표</h2>
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--faint)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
          SMILES를 입력하거나 원료를 선택하세요
        </div>
      </div>
    );
  }

  const L = litFor(compoundName);
  const d = result;

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>2D</span>
          <h2 style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>구조 · 분자 지표</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isEstimate && (
            <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', borderRadius: 4, padding: '2px 8px', fontFamily: "'JetBrains Mono',monospace" }}>
              RDKit 정밀값
            </span>
          )}
          <button onClick={handleSave} disabled={saveState === 'saving'}
            style={{
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 12,
              border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
              background: saveState === 'done' ? 'var(--good)' : saveState === 'error' ? 'var(--flag)' : 'var(--accent)',
              color: '#fff', opacity: saveState === 'saving' ? 0.6 : 1,
            }}>
            {saveState === 'saving' ? '저장 중…' : saveState === 'done' ? '저장 완료' : saveState === 'error' ? '저장 실패' : '저장'}
          </button>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {saveError && (
          <div style={{ background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 10, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: 'var(--flag)' }}>
            {saveError}
          </div>
        )}
        {/* 화합물명 + 분자식 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, margin: 0 }}>
            {compoundName || '분석 결과'}
          </h1>
          {d.formula && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--accent)' }}>
              {d.formula}
            </span>
          )}
        </div>

        {/* 2D 구조 */}
        <div style={{ marginBottom: 20 }}>
          <StructureViewer smiles={smiles} />
        </div>

        {/* 요약 수치 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { l: '분자량', v: d.mw != null ? `${d.mw} g/mol` : '-' },
            { l: '정확질량', v: d.exact_mass ?? '-' },
            { l: '중원자수', v: d.heavy_atoms ?? '-' },
            { l: '고리수', v: d.rings != null ? `${d.rings} 방향족` : '-' },
          ].map(({ l, v }) => (
            <div key={l} style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>{l}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* 게이지 */}
        <GaugeBar label="분자량 (MW)" sub="피부투과 지표"
          value={d.mw} min={0} max={600}
          segments={[{t:'good',from:0,to:300},{t:'warn',from:300,to:500},{t:'flag',from:500,to:600}]}
          litValue={L?.mw} isEstimate={false} />
        <GaugeBar label="logP" sub="친유성"
          value={d.logp} min={-3} max={7}
          segments={[{t:'warn',from:-3,to:0},{t:'good',from:0,to:3},{t:'warn',from:3,to:5},{t:'flag',from:5,to:7}]}
          litValue={L?.logp} isEstimate={isEstimate} />
        <GaugeBar label="TPSA" sub="극성표면적 Å²"
          value={d.tpsa} min={0} max={160}
          segments={[{t:'good',from:0,to:60},{t:'warn',from:60,to:90},{t:'flag',from:90,to:160}]}
          litValue={L?.tpsa} isEstimate={isEstimate} />
        <GaugeBar label="HBD" sub="Lipinski 공여"
          value={d.hbd} min={0} max={8}
          segments={[{t:'good',from:0,to:2},{t:'warn',from:2,to:4},{t:'flag',from:4,to:8}]} />
        <GaugeBar label="HBA" sub="Lipinski 수용 (N+O)"
          value={d.hba} min={0} max={14}
          segments={[{t:'good',from:0,to:5},{t:'warn',from:5,to:8},{t:'flag',from:8,to:14}]} />
        <GaugeBar label="회전결합" sub="분자 유연성"
          value={d.rot_bonds ?? d.rot} min={0} max={16}
          segments={[{t:'good',from:0,to:5},{t:'warn',from:5,to:9},{t:'flag',from:9,to:16}]} />
      </div>
    </div>
  );
}
