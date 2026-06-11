import { useState } from 'react';
import { generateCandidates, saveCandidate } from '../api';
import StructureViewer from './StructureViewer';
import SynthesisFlow from './SynthesisFlow';
import { exportCandidatesCsv, printCandidatePdf } from '../utils/exportUtils';

// ── 상수 ──────────────────────────────────────────────────────────────────────

const TARGETS = [
  ['brightening', '미백'],
  ['antioxidant', '항산화'],
  ['anti_inflammatory', '항염'],
  ['anti_wrinkle', '주름/탄력'],
  ['moisturizing', '보습/장벽'],
];

const PRESETS = [
  ['niacinamide',   'O=C(N)c1cccnc1',                           '나이아신아마이드'],
  ['ascorbic acid', 'OC[C@H](O)[C@H]1OC(=O)C(O)=C1O',          '아스코르브산'],
  ['ferulic acid',  'COc1cc(/C=C/C(=O)O)ccc1O',                 '페룰산'],
  ['kojic acid',    'OCC1=CC(=O)C(O)=CO1',                      '코지산'],
  ['resveratrol',   'OC1=CC(=CC(=C1)/C=C/c1ccc(O)cc1)O',        '레스베라트롤'],
];

const TYPE_META = {
  phenolic:             { label: '페놀성',     color: '#22c55e' },
  carboxylic_acid:      { label: '카르복실산',  color: 'var(--accent)' },
  ester:                { label: '에스터',     color: '#8b5cf6' },
  amide:                { label: '아미드',     color: '#f59e0b' },
  high_logP:            { label: '고지용성',   color: '#ef4444' },
  high_TPSA:            { label: '고극성',     color: '#06b6d4' },
  inorganic_placeholder:{ label: '무기/미네랄', color: 'var(--muted)' },
  general:              { label: '일반',       color: 'var(--faint)' },
};

const ANALYSIS_SECTIONS = [
  ['structure_confirmation', '구조 확인'],
  ['purity',                 '순도'],
  ['residual_solvent',       '잔류 용매'],
  ['stability',              '안정성'],
  ['efficacy_screening',     '효능 스크리닝'],
];

const KIND_KO = {
  acetylated:  'Acetylation',
  methyl_ester: 'Esterification',
  reference:   'Reference',
  default:     '유도체화',
};

const mono = { fontFamily: "'JetBrains Mono',monospace" };
const lbl  = { display: 'block', ...mono, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 5 };
const inp  = { ...mono, fontSize: 13, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 10px', outline: 'none', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' };
const btnS = (bg = 'var(--accent)', fg = '#fff') => ({
  fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13,
  color: fg, background: bg, border: bg === 'var(--panel-2)' ? '1px solid var(--line)' : 'none',
  borderRadius: 9, padding: '9px 16px', cursor: 'pointer',
});

// ── 작은 컴포넌트 ─────────────────────────────────────────────────────────────

function TypeTag({ type }) {
  const m = TYPE_META[type] || { label: type, color: 'var(--faint)' };
  return (
    <span style={{ ...mono, fontSize: 10, fontWeight: 600, color: m.color, background: `${m.color}1a`, border: `1px solid ${m.color}44`, borderRadius: 999, padding: '2px 8px' }}>
      {m.label}
    </span>
  );
}

function ScoreChip({ label: sl, value }) {
  const color = value >= 70 ? 'var(--good)' : value >= 45 ? 'var(--warn)' : 'var(--flag)';
  return (
    <div style={{ background: 'var(--panel-2)', border: `1px solid ${color}44`, borderTop: `3px solid ${color}`, borderRadius: 9, padding: '10px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 4 }}>{sl}</div>
      <div style={{ ...mono, fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function DescChip({ label: dl, value, unit }) {
  return (
    <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 3 }}>{dl}</div>
      <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
        {value ?? '-'}
        {unit && <span style={{ fontSize: 9, color: 'var(--faint)', marginLeft: 2 }}>{unit}</span>}
      </div>
    </div>
  );
}

function MethodItem({ method, reason, index }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ ...mono, flexShrink: 0, fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>
        {index != null ? `${index}.` : '•'}
      </span>
      <div>
        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.55 }}>{method}</div>
        {reason && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>→ {reason}</div>}
      </div>
    </div>
  );
}

function Accordion({ title, accent = 'var(--accent)', children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', background: 'var(--panel-2)', border: 'none', cursor: 'pointer',
          fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 12, color: accent,
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ ...mono, fontSize: 12, color: 'var(--faint)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ background: 'var(--panel)', padding: '14px 14px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── 반응식 Scheme ─────────────────────────────────────────────────────────────

function ReactionScheme({ inputSmiles, inputName, candidate }) {
  const kind    = candidate.candidate_type;
  const rxnName = KIND_KO[kind] || KIND_KO.default;

  // synthesis_steps에서 첫 번째 reaction 스텝 상세
  const rxnStep = candidate.synthesis_steps?.find(s => s.type === 'reaction');
  const cond    = rxnStep?.detail ?? '';
  const purStep = candidate.synthesis_steps?.find(s => s.type === 'purification');

  return (
    <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '18px 16px' }}>
      <div style={{ ...mono, fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginBottom: 14 }}>REACTION SCHEME</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: 8, alignItems: 'center' }}>
        {/* 출발물질 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginBottom: 6 }}>STARTING MATERIAL</div>
          <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden', background: 'var(--panel)' }}>
            <StructureViewer smiles={inputSmiles} height={180} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, marginTop: 8, color: 'var(--muted)' }}>
            {inputName || 'Starting Material'}
          </div>
        </div>

        {/* 반응 화살표 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 4px' }}>
          <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: '#8b5cf6', textAlign: 'center', lineHeight: 1.4 }}>{rxnName}</div>
          {/* 화살표 */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <div style={{ flex: 1, height: 2, background: 'var(--muted)' }} />
            <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '10px solid var(--muted)' }} />
          </div>
          {cond && (
            <div style={{ ...mono, fontSize: 9, color: 'var(--faint)', textAlign: 'center', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
              {cond.length > 55 ? cond.slice(0, 54) + '…' : cond}
            </div>
          )}
        </div>

        {/* 후보 물질 (Product) */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ ...mono, fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginBottom: 6 }}>PRODUCT</div>
          <div style={{ border: `2px solid var(--accent)`, borderRadius: 10, overflow: 'hidden', background: 'var(--panel)' }}>
            <StructureViewer smiles={candidate.smiles} height={180} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, marginTop: 8, color: 'var(--accent)' }}>
            {candidate.label}
          </div>
          {/* 물질 유형 태그 */}
          {candidate.purification_plan?.compound_types?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 6 }}>
              {candidate.purification_plan.compound_types.map(t => <TypeTag key={t} type={t} />)}
            </div>
          )}
        </div>
      </div>

      {/* 정제 요약 (inline) */}
      {purStep && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line-2)', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...mono, fontSize: 10, color: '#06b6d4', fontWeight: 600, flexShrink: 0 }}>정제</span>
          <span style={{ ...mono, fontSize: 11, color: 'var(--muted)' }}>{purStep.title} — {purStep.detail}</span>
        </div>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function CandidatePanel() {
  const [target,       setTarget]       = useState('brightening');
  const [name,         setName]         = useState('ferulic acid');
  const [smiles,       setSmiles]       = useState('COc1cc(/C=C/C(=O)O)ccc1O');
  const [result,       setResult]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [savedIndices, setSavedIndices] = useState(new Set());
  const [savingIndex,  setSavingIndex]  = useState(null);
  const [saveError,    setSaveError]    = useState('');

  function selectPreset([, s, n]) { setSmiles(s); setName(n); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setResult(null); setSavedIndices(new Set()); setSaveError(''); setLoading(true);
    try { setResult(await generateCandidates({ smiles, name, target })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleSave(candidate, index) {
    if (savedIndices.has(index) || savingIndex === index) return;
    setSavingIndex(index); setSaveError('');
    try {
      await saveCandidate({
        input_smiles:      result.input.smiles,
        input_name:        result.input.name,
        target:            result.input.target,
        label:             candidate.label,
        smiles:            candidate.smiles,
        candidate_type:    candidate.candidate_type,
        confidence:        candidate.confidence,
        descriptors:       candidate.descriptors,
        scores:            candidate.scores,
        compound_types:    candidate.purification_plan?.compound_types ?? [],
        synthesis:         candidate.synthesis,
        purification_plan: candidate.purification_plan ?? null,
        analysis_plan:     candidate.analysis_plan ?? null,
        rationale:         candidate.rationale,
      });
      setSavedIndices(prev => new Set([...prev, index]));
    } catch (err) { setSaveError(err.message); }
    finally { setSavingIndex(null); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>

      {/* ── 입력 패널 ── */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)' }}>
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>DESIGN INPUT</span>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, margin: '2px 0 0' }}>후보물질 설계</h2>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span style={lbl}>목표 효능</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              {TARGETS.map(([id, text]) => (
                <button key={id} type="button" onClick={() => setTarget(id)}
                  style={{ ...btnS(target === id ? 'var(--accent)' : 'var(--panel-2)', target === id ? '#fff' : 'var(--ink)'), border: '1px solid var(--line)', fontSize: 12 }}>
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>출발 물질명</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="예: ferulic acid" />
          </div>

          <div>
            <label style={lbl}>출발 물질 SMILES</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={smiles} onChange={e => setSmiles(e.target.value)} />
          </div>

          <div>
            <span style={lbl}>프리셋</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRESETS.map(p => (
                <button key={p[0]} type="button" onClick={() => selectPreset(p)}
                  style={{ ...btnS('var(--panel-2)', 'var(--ink)'), border: '1px solid var(--line)', fontSize: 11, padding: '5px 10px' }}>
                  {p[2]}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || !smiles.trim()} style={{ ...btnS(), width: '100%', opacity: loading ? 0.65 : 1 }}>
            {loading ? '설계 중...' : '후보 생성'}
          </button>
          {error && <div style={{ color: 'var(--flag)', fontSize: 12, marginTop: 4 }}>{error}</div>}
        </form>
      </div>

      {/* ── 결과 패널 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* 플레이스홀더 */}
        {!result && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 40, textAlign: 'center', color: 'var(--faint)', ...mono, fontSize: 12, lineHeight: 1.8 }}>
            출발 물질과 목표 효능을 선택해<br />후보 물질 반응식과 합성 계획을 생성하세요
          </div>
        )}

        {/* 저장 오류 */}
        {saveError && (
          <div style={{ marginBottom: 12, background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--flag)' }}>
            저장 오류: {saveError}
          </div>
        )}

        {/* 내보내기 버튼 */}
        {result?.candidates?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, justifyContent: 'flex-end' }}>
            <button onClick={() => exportCandidatesCsv(result.candidates.map(c => ({ ...c, target: result.input.target })))}
              style={{ ...mono, fontSize: 11, color: 'var(--good)', background: 'transparent', border: '1px solid var(--good)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              CSV 내보내기
            </button>
            <button onClick={() => printCandidatePdf(result.candidates.map(c => ({ ...c, target: result.input.target })))}
              style={{ ...mono, fontSize: 11, color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
              PDF 인쇄
            </button>
          </div>
        )}

        {/* 후보 카드들 */}
        {result?.candidates?.map((c, index) => (
          <article key={`${c.label}-${index}`} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>

            {/* 카드 헤더 */}
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: index === 0 ? '#8b5cf6' : 'var(--accent)' }}>
                  {(KIND_KO[c.candidate_type] || c.candidate_type).toUpperCase()}
                </span>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, fontWeight: 700, margin: 0 }}>{c.label}</h2>
                <span style={{ ...mono, fontSize: 10, color: 'var(--faint)', background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 999, padding: '2px 8px' }}>
                  confidence {c.confidence}
                </span>
              </div>
              <button
                onClick={() => handleSave(c, index)}
                disabled={savedIndices.has(index) || savingIndex === index}
                style={{
                  ...mono, fontSize: 11, fontWeight: 700, flexShrink: 0,
                  color: savedIndices.has(index) ? 'var(--good)' : '#fff',
                  background: savedIndices.has(index) ? 'transparent' : 'var(--accent)',
                  border: savedIndices.has(index) ? '1px solid var(--good)' : 'none',
                  borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
                  opacity: savingIndex === index ? 0.6 : 1,
                }}
              >
                {savedIndices.has(index) ? '✓ 저장됨' : savingIndex === index ? '저장 중…' : '저장'}
              </button>
            </div>

            <div style={{ padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* ① 반응식 Scheme */}
              <ReactionScheme
                inputSmiles={result.input.smiles}
                inputName={result.input.name}
                candidate={c}
              />

              {/* ② 점수 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <ScoreChip label="목표 효능"   value={c.scores.target} />
                <ScoreChip label="피부 투과"   value={c.scores.skin_permeation} />
                <ScoreChip label="제형 적합"   value={c.scores.formulation_fit} />
                <ScoreChip label="합성 접근성" value={c.scores.synthetic_access} />
              </div>

              {/* ③ 기술자 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <DescChip label="MW"      value={c.descriptors.mw?.toFixed(1)}  unit="g/mol" />
                <DescChip label="logP"    value={c.descriptors.logp?.toFixed(2)} />
                <DescChip label="TPSA"    value={c.descriptors.tpsa?.toFixed(1)} unit="Å²" />
                <DescChip label="HBD/HBA" value={`${c.descriptors.hbd}/${c.descriptors.hba}`} />
                <DescChip label="rot"     value={c.descriptors.rot_bonds} />
              </div>

              {/* ④ 합성 경로 (accordion) */}
              <Accordion title="⚗ SYNTHESIS ROUTE" accent="#8b5cf6">
                {c.synthesis_steps?.length > 0
                  ? <SynthesisFlow steps={c.synthesis_steps} />
                  : <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12 }}>
                      {c.synthesis?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                }
              </Accordion>

              {/* ⑤ 정제 계획 (accordion) */}
              <Accordion title="◈ 정제 계획" accent="#06b6d4">
                {c.purification_plan?.steps?.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {c.purification_plan.steps.map((step, i) => (
                        <MethodItem key={i} index={i + 1} method={step.method} reason={step.reason} />
                      ))}
                    </div>
                  : <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12 }}>
                      {c.purification?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                }
              </Accordion>

              {/* ⑥ 분석 계획 (accordion) */}
              <Accordion title="⊙ 분석 계획" accent="var(--good)">
                {c.analysis_plan
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {ANALYSIS_SECTIONS.map(([key, sectionLabel]) => {
                        const items = c.analysis_plan[key];
                        if (!items?.length) return null;
                        return (
                          <div key={key}>
                            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, color: 'var(--good)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                              ▸ {sectionLabel}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 6 }}>
                              {items.map((item, i) => <MethodItem key={i} method={item.method} reason={item.reason} />)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  : <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12 }}>
                      {c.analysis?.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                }
              </Accordion>

              {/* ⑦ 해석 (accordion) */}
              <Accordion title="◎ 설계 근거 (Rationale)">
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12, lineHeight: 1.7 }}>
                  {c.rationale?.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </Accordion>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
