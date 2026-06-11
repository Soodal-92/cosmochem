import { useState } from 'react';
import { generateCandidates, saveCandidate } from '../api';
import StructureViewer from './StructureViewer';
import SynthesisFlow from './SynthesisFlow';
import { exportCandidatesCsv, printCandidatePdf } from '../utils/exportUtils';

const TARGETS = [
  ['brightening', '미백'],
  ['antioxidant', '항산화'],
  ['anti_inflammatory', '항염'],
  ['anti_wrinkle', '주름/탄력'],
  ['moisturizing', '보습/장벽'],
];

const PRESETS = [
  ['niacinamide', 'O=C(N)c1cccnc1', '나이아신아마이드'],
  ['ascorbic acid', 'OC[C@H](O)[C@H]1OC(=O)C(O)=C1O', '아스코르브산'],
  ['ferulic acid', 'COc1cc(/C=C/C(=O)O)ccc1O', '페룰산'],
  ['kojic acid', 'OCC1=CC(=O)C(O)=CO1', '코지산'],
  ['resveratrol', 'OC1=CC(=CC(=C1)/C=C/c1ccc(O)cc1)O', '레스베라트롤'],
];

const card = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden', marginBottom: 16 };
const cardH = { padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const cardB = { padding: 18 };
const label = { display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 6 };
const input = { fontFamily: "'JetBrains Mono',monospace", fontSize: 13, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 10px', outline: 'none', color: 'var(--ink)', width: '100%' };
const btn = (c = 'var(--accent)') => ({ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13, color: '#fff', background: c, border: 'none', borderRadius: 9, padding: '9px 16px', cursor: 'pointer' });
const mono = { fontFamily: "'JetBrains Mono',monospace" };

const TYPE_META = {
  phenolic:             { label: '페놀성',    color: '#22c55e' },
  carboxylic_acid:      { label: '카르복실산', color: 'var(--accent)' },
  ester:                { label: '에스터',    color: '#8b5cf6' },
  amide:                { label: '아미드',    color: '#f59e0b' },
  high_logP:            { label: '고지용성',  color: '#ef4444' },
  high_TPSA:            { label: '고극성',    color: '#06b6d4' },
  inorganic_placeholder:{ label: '무기/미네랄', color: 'var(--muted)' },
  general:              { label: '일반',      color: 'var(--faint)' },
};

const ANALYSIS_SECTIONS = [
  ['structure_confirmation', '구조 확인'],
  ['purity',                 '순도'],
  ['residual_solvent',       '잔류 용매'],
  ['stability',              '안정성'],
  ['efficacy_screening',     '효능 스크리닝'],
];

function Score({ label: scoreLabel, value }) {
  const color = value >= 70 ? 'var(--good)' : value >= 45 ? 'var(--warn)' : 'var(--flag)';
  return (
    <div style={{ background: 'var(--panel-2)', borderRadius: 8, padding: '9px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--faint)', marginBottom: 3 }}>{scoreLabel}</div>
      <div style={{ ...mono, fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function SectionList({ title, items }) {
  return (
    <div>
      <div style={{ ...label, marginBottom: 5 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', fontSize: 12 }}>
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function TypeTag({ type }) {
  const meta = TYPE_META[type] || { label: type, color: 'var(--faint)' };
  return (
    <span style={{
      ...mono, fontSize: 10, fontWeight: 600,
      color: meta.color,
      background: `${meta.color}1a`,
      border: `1px solid ${meta.color}44`,
      borderRadius: 999, padding: '2px 8px',
    }}>
      {meta.label}
    </span>
  );
}

function MethodItem({ method, reason, index }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ ...mono, flexShrink: 0, fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginTop: 3 }}>
        {index != null ? `${index}.` : '•'}
      </span>
      <div>
        <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.55 }}>{method}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
          이유: {reason}
        </div>
      </div>
    </div>
  );
}

function PurificationCard({ plan }) {
  if (!plan) return null;
  const { compound_types = [], steps = [] } = plan;
  return (
    <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <span style={{ ...label, margin: 0 }}>정제 방법</span>
        {compound_types.map(t => <TypeTag key={t} type={t} />)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step, i) => (
          <MethodItem key={i} method={step.method} reason={step.reason} index={i + 1} />
        ))}
      </div>
    </div>
  );
}

function AnalysisCard({ plan }) {
  if (!plan) return null;
  return (
    <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 14 }}>
      <div style={{ ...label, marginBottom: 12 }}>분석 방법</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ANALYSIS_SECTIONS.map(([key, sectionLabel]) => {
          const items = plan[key];
          if (!items || items.length === 0) return null;
          return (
            <div key={key}>
              <div style={{
                fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700,
                color: 'var(--accent)', marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: '.07em',
              }}>
                ▸ {sectionLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 6 }}>
                {items.map((item, i) => (
                  <MethodItem key={i} method={item.method} reason={item.reason} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CandidatePanel() {
  const [target, setTarget] = useState('brightening');
  const [name, setName] = useState('ferulic acid');
  const [smiles, setSmiles] = useState('COc1cc(/C=C/C(=O)O)ccc1O');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIndices, setSavedIndices] = useState(new Set());
  const [savingIndex, setSavingIndex] = useState(null);
  const [saveError, setSaveError] = useState('');

  function selectPreset([, presetSmiles, labelText]) {
    setName(labelText);
    setSmiles(presetSmiles);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setSavedIndices(new Set());
    setSaveError('');
    setLoading(true);
    try {
      setResult(await generateCandidates({ smiles, name, target }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(candidate, index) {
    if (savedIndices.has(index) || savingIndex === index) return;
    setSavingIndex(index);
    setSaveError('');
    try {
      await saveCandidate({
        input_smiles:     result.input.smiles,
        input_name:       result.input.name,
        target:           result.input.target,
        label:            candidate.label,
        smiles:           candidate.smiles,
        candidate_type:   candidate.candidate_type,
        confidence:       candidate.confidence,
        descriptors:      candidate.descriptors,
        scores:           candidate.scores,
        compound_types:   candidate.purification_plan?.compound_types ?? [],
        synthesis:        candidate.synthesis,
        purification_plan: candidate.purification_plan ?? null,
        analysis_plan:    candidate.analysis_plan ?? null,
        rationale:        candidate.rationale,
      });
      setSavedIndices(prev => new Set([...prev, index]));
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
      <div style={card}>
        <div style={cardH}>
          <div>
            <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>DESIGN</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, margin: '2px 0 0' }}>후보물질 설계</h2>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={cardB}>
          <label style={label}>목표 효능</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {TARGETS.map(([id, text]) => (
              <button key={id} type="button" onClick={() => setTarget(id)}
                style={{ ...btn(target === id ? 'var(--accent)' : 'var(--panel-2)'), color: target === id ? '#fff' : 'var(--ink)', border: '1px solid var(--line)', fontSize: 12 }}>
                {text}
              </button>
            ))}
          </div>

          <label style={label}>출발 물질명</label>
          <input style={{ ...input, marginBottom: 12 }} value={name} onChange={e => setName(e.target.value)} placeholder="예: ferulic acid" />

          <label style={label}>출발 물질 SMILES</label>
          <textarea style={{ ...input, minHeight: 88, resize: 'vertical', marginBottom: 12 }} value={smiles} onChange={e => setSmiles(e.target.value)} />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
            {PRESETS.map(p => (
              <button key={p[0]} type="button" onClick={() => selectPreset(p)}
                style={{ ...btn('var(--panel-2)'), color: 'var(--ink)', border: '1px solid var(--line)', fontSize: 12, padding: '6px 10px' }}>
                {p[2]}
              </button>
            ))}
          </div>

          <button type="submit" disabled={loading || !smiles.trim()} style={{ ...btn(), width: '100%', opacity: loading ? 0.65 : 1 }}>
            {loading ? '설계 중...' : '후보 생성'}
          </button>
          {error && <div style={{ marginTop: 12, color: 'var(--flag)', fontSize: 12 }}>{error}</div>}
        </form>
      </div>

      <div>
        {!result && (
          <div style={card}>
            <div style={cardH}>
              <div>
                <span style={{ ...mono, fontSize: 11, color: 'var(--good)', fontWeight: 700 }}>OUTPUT</span>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, margin: '2px 0 0' }}>설계 결과</h2>
              </div>
            </div>
            <div style={{ padding: 36, color: 'var(--faint)', textAlign: 'center', fontSize: 13 }}>
              출발 물질과 목표 효능을 선택해 후보 물질, 합성 방향, 정제/분석 초안을 생성하세요.
            </div>
          </div>
        )}

        {saveError && (
          <div style={{ marginBottom: 12, background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: 'var(--flag)' }}>
            저장 오류: {saveError}
          </div>
        )}

        {result?.candidates?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => exportCandidatesCsv(result.candidates.map(c => ({ ...c, target: result.input.target })))}
              style={{ ...mono, fontSize: 11, color: 'var(--good)', background: 'transparent', border: '1px solid var(--good)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
            >CSV 내보내기</button>
            <button
              onClick={() => printCandidatePdf(result.candidates.map(c => ({ ...c, target: result.input.target })))}
              style={{ ...mono, fontSize: 11, color: 'var(--accent)', background: 'transparent', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
            >PDF 인쇄</button>
          </div>
        )}

        {result?.candidates?.map((candidate, index) => (
          <article key={`${candidate.label}-${candidate.smiles}-${index}`} style={card}>
            <div style={cardH}>
              <div>
                <span style={{ ...mono, fontSize: 11, color: index === 0 ? 'var(--muted)' : 'var(--accent)', fontWeight: 700 }}>
                  {candidate.candidate_type.toUpperCase()}
                </span>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, margin: '2px 0 0' }}>{candidate.label}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ ...mono, fontSize: 11, color: 'var(--faint)' }}>confidence {candidate.confidence}</span>
                <button
                  onClick={() => handleSave(candidate, index)}
                  disabled={savedIndices.has(index) || savingIndex === index}
                  style={{
                    ...btn(savedIndices.has(index) ? 'var(--good)' : 'var(--accent)'),
                    fontSize: 11, padding: '5px 12px',
                    opacity: savingIndex === index ? 0.6 : 1,
                  }}
                >
                  {savedIndices.has(index) ? '✓ 저장됨' : savingIndex === index ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
            <div style={cardB}>
              <div style={{ ...mono, fontSize: 11, color: 'var(--muted)', overflowWrap: 'anywhere', marginBottom: 14 }}>
                {candidate.smiles}
              </div>

              <div style={{ marginBottom: 18 }}>
                <StructureViewer smiles={candidate.smiles} height={210} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
                <Score label="목표 효능" value={candidate.scores.target} />
                <Score label="피부 투과" value={candidate.scores.skin_permeation} />
                <Score label="제형 적합" value={candidate.scores.formulation_fit} />
                <Score label="합성 접근성" value={candidate.scores.synthetic_access} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 18 }}>
                {[
                  ['MW', candidate.descriptors.mw],
                  ['logP', candidate.descriptors.logp],
                  ['TPSA', candidate.descriptors.tpsa],
                  ['HBD/HBA', `${candidate.descriptors.hbd}/${candidate.descriptors.hba}`],
                  ['rot', candidate.descriptors.rot_bonds],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--panel-2)', borderRadius: 8, padding: '8px 9px' }}>
                    <div style={{ fontSize: 10, color: 'var(--faint)' }}>{k}</div>
                    <div style={{ ...mono, fontSize: 12, fontWeight: 700 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* 합성 경로 플로우차트 */}
              {candidate.synthesis_steps?.length > 0 ? (
                <div style={{ marginBottom: 16, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--accent)', fontWeight: 600, marginBottom: 12 }}>SYNTHESIS ROUTE</div>
                  <SynthesisFlow steps={candidate.synthesis_steps} />
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <SectionList title="합성 방향" items={candidate.synthesis} />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <SectionList title="해석" items={candidate.rationale} />
              </div>

              {candidate.purification_plan
                ? <div style={{ marginBottom: 14 }}><PurificationCard plan={candidate.purification_plan} /></div>
                : <div style={{ marginBottom: 14 }}><SectionList title="정제 방법" items={candidate.purification} /></div>
              }
              {candidate.analysis_plan
                ? <AnalysisCard plan={candidate.analysis_plan} />
                : <SectionList title="분석 방법" items={candidate.analysis} />
              }
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
