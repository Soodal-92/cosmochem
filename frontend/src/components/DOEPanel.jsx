import { useState } from 'react';
import { doeDesign, doeRegression } from '../api';
import { saveDoeExperiment } from '../lib/supabase';

const card = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 };
const cardH = { padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 9 };
const cardB = { padding: 18 };
const label = { display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 };
const input = { fontFamily: "'JetBrains Mono',monospace", fontSize: 13, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', outline: 'none', color: 'var(--ink)' };
const btn = (c = 'var(--accent)') => ({ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', background: c, border: 'none', borderRadius: 9, padding: '9px 16px', cursor: 'pointer' });

const EMPTY_FACTOR = { name: '', low: '', high: '' };

export default function DOEPanel() {
  // --- 설계 섹션 ---
  const [factors, setFactors] = useState([{ ...EMPTY_FACTOR }, { ...EMPTY_FACTOR }]);
  const [design, setDesign] = useState('ccf');
  const [designResult, setDesignResult] = useState(null);
  const [designLoading, setDesignLoading] = useState(false);
  const [designError, setDesignError] = useState('');

  // --- 회귀 섹션 ---
  const [yValues, setYValues] = useState('');
  const [regrResult, setRegrResult] = useState(null);
  const [regrLoading, setRegrLoading] = useState(false);
  const [regrError, setRegrError] = useState('');

  // --- 저장 ---
  const [saveState, setSaveState] = useState('idle');

  async function handleSave() {
    if (!designResult) return;
    setSaveState('saving');
    const yArr = yValues.trim() ? yValues.trim().split(/[\n,\s]+/).map(Number) : null;
    try {
      await saveDoeExperiment({ name: null, designResult, yValues: yArr, regrResult });
      setSaveState('done');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 2500);
    }
  }

  function updateFactor(i, field, val) {
    setFactors(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: val } : f));
  }
  function addFactor() { if (factors.length < 6) setFactors(p => [...p, { ...EMPTY_FACTOR }]); }
  function removeFactor(i) { if (factors.length > 2) setFactors(p => p.filter((_, idx) => idx !== i)); }

  async function handleDesign() {
    setDesignError(''); setDesignResult(null);
    const parsed = factors.map(f => ({ name: f.name.trim() || `X${factors.indexOf(f) + 1}`, low: parseFloat(f.low), high: parseFloat(f.high) }));
    if (parsed.some(f => isNaN(f.low) || isNaN(f.high))) { setDesignError('모든 인자의 최소/최대값을 숫자로 입력하세요'); return; }
    setDesignLoading(true);
    try {
      const r = await doeDesign(parsed, design);
      setDesignResult(r);
      setYValues(r.runs.map(() => '').join('\n'));
    } catch (e) { setDesignError(e.message); }
    finally { setDesignLoading(false); }
  }

  async function handleRegression() {
    if (!designResult) return;
    setRegrError(''); setRegrResult(null);
    const yArr = yValues.trim().split(/[\n,\s]+/).map(Number);
    if (yArr.length !== designResult.n_runs || yArr.some(isNaN)) {
      setRegrError(`수율값을 ${designResult.n_runs}개 입력하세요 (줄바꿈 또는 쉼표 구분)`); return;
    }
    setRegrLoading(true);
    try {
      const r = await doeRegression(designResult.factor_names, designResult.coded, yArr);
      setRegrResult(r);
    } catch (e) { setRegrError(e.message); }
    finally { setRegrLoading(false); }
  }

  return (
    <div>
      {/* 인자 설정 */}
      <div style={card}>
        <div style={cardH}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>DOE</span>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>실험계획 설계</h2>
        </div>
        <div style={cardB}>
          {/* 설계 유형 */}
          <div style={{ marginBottom: 16 }}>
            <span style={label}>설계 유형</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['ccf', 'CCD (Face-centered)'], ['bbi', 'Box-Behnken'], ['full2', '2-level Full Factorial']].map(([v, l]) => (
                <button key={v} onClick={() => setDesign(v)}
                  style={{ ...btn(design === v ? 'var(--accent)' : 'var(--panel-2)'), color: design === v ? '#fff' : 'var(--ink)', border: '1px solid var(--line)', fontSize: 12 }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 인자 목록 */}
          <span style={label}>인자 설정 (2~6개)</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {factors.map((f, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 32px', gap: 8, alignItems: 'center' }}>
                <input style={input} placeholder={`인자 ${i + 1} 이름`} value={f.name} onChange={e => updateFactor(i, 'name', e.target.value)} />
                <input style={input} placeholder="최소" value={f.low}  onChange={e => updateFactor(i, 'low',  e.target.value)} />
                <input style={input} placeholder="최대" value={f.high} onChange={e => updateFactor(i, 'high', e.target.value)} />
                <button onClick={() => removeFactor(i)} disabled={factors.length <= 2}
                  style={{ background: 'var(--flag-soft)', border: 'none', borderRadius: 8, color: 'var(--flag)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addFactor} disabled={factors.length >= 6} style={{ ...btn('var(--panel-2)'), color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 12 }}>+ 인자 추가</button>
            <button onClick={handleDesign} disabled={designLoading} style={btn()}>{designLoading ? '생성 중…' : '실험계획 생성'}</button>
          </div>
          {designError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--flag)' }}>{designError}</div>}
        </div>
      </div>

      {/* 실험계획 표 */}
      {designResult && (
        <div style={card}>
          <div style={cardH}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>표</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>
              실험 목록 ({designResult.n_runs}개 실험)
            </h2>
          </div>
          <div style={{ ...cardB, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--faint)', fontWeight: 500 }}>#</th>
                  {designResult.factor_names.map(n => (
                    <th key={n} style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--faint)', fontWeight: 500 }}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {designResult.runs.map((run, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line-2)', background: i % 2 === 0 ? 'transparent' : 'var(--panel-2)' }}>
                    <td style={{ padding: '6px 10px', color: 'var(--faint)' }}>{i + 1}</td>
                    {designResult.factor_names.map(n => (
                      <td key={n} style={{ padding: '6px 10px', textAlign: 'right' }}>{run[n]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 수율 입력 + 회귀 */}
      {designResult && (
        <div style={card}>
          <div style={cardH}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>회귀</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>수율 입력 및 반응표면 회귀</h2>
          </div>
          <div style={cardB}>
            <span style={label}>수율 측정값 ({designResult.n_runs}개, 줄바꿈 또는 쉼표 구분)</span>
            <textarea
              style={{ ...input, width: '100%', minHeight: 90, resize: 'vertical', marginBottom: 10 }}
              value={yValues}
              onChange={e => setYValues(e.target.value)}
              placeholder={`예: 72.3\n85.1\n68.4\n...`}
            />
            <button onClick={handleRegression} disabled={regrLoading} style={btn('var(--good)')}>
              {regrLoading ? '분석 중…' : '회귀 분석 실행'}
            </button>
            {regrError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--flag)' }}>{regrError}</div>}
          </div>
        </div>
      )}

      {/* 회귀 결과 */}
      {regrResult && (
        <div style={card}>
          <div style={{ ...cardH, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>결과</span>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>회귀 결과</h2>
            </div>
            <button onClick={handleSave} disabled={saveState === 'saving'}
              style={{
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 12,
                border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
                background: saveState === 'done' ? 'var(--good)' : saveState === 'error' ? 'var(--flag)' : 'var(--accent)',
                color: '#fff', opacity: saveState === 'saving' ? 0.6 : 1,
              }}>
              {saveState === 'saving' ? '저장 중…' : saveState === 'done' ? '저장 완료' : saveState === 'error' ? '저장 실패' : '실험 저장'}
            </button>
          </div>
          <div style={cardB}>
            {/* R² */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[['R²', regrResult.r2], ['R² (보정)', regrResult.r2_adj], ['F p-value', regrResult.f_pvalue]].map(([l, v]) => (
                <div key={l} style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: v < 0.05 && l.includes('p') ? 'var(--good)' : 'var(--ink)' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* 계수 표 */}
            <span style={label}>계수 및 유의성 (p &lt; 0.05: 유의)</span>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  {['항목', '계수', 'p-value', '유의성'].map(h => (
                    <th key={h} style={{ padding: '6px 10px', textAlign: h === '항목' ? 'left' : 'right', color: 'var(--faint)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(regrResult.coefficients).map(([name, coef]) => {
                  const p = regrResult.pvalues[name];
                  const sig = p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '';
                  return (
                    <tr key={name} style={{ borderBottom: '1px solid var(--line-2)', background: sig ? 'var(--good-soft)' : 'transparent' }}>
                      <td style={{ padding: '6px 10px', fontWeight: sig ? 600 : 400 }}>{name}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>{coef}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: sig ? 'var(--good)' : 'var(--muted)' }}>{p}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--good)', fontWeight: 700 }}>{sig}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
