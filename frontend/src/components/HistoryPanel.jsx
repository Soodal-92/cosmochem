import { useEffect, useState } from 'react';
import { getCompounds, getDoeExperiments, listCandidates } from '../api';

const card = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' };
const cardH = { padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const cardB = { padding: 18 };
const mono = { fontFamily: "'JetBrains Mono',monospace" };
const btn = { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 12, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' };

const TARGET_LABELS = {
  brightening: '미백', antioxidant: '항산화',
  anti_inflammatory: '항염', anti_wrinkle: '주름/탄력', moisturizing: '보습/장벽',
};

const TYPE_META = {
  phenolic:              { label: '페놀성',    color: '#22c55e' },
  carboxylic_acid:       { label: '카르복실산', color: 'var(--accent)' },
  ester:                 { label: '에스터',    color: '#8b5cf6' },
  amide:                 { label: '아미드',    color: '#f59e0b' },
  high_logP:             { label: '고지용성',  color: '#ef4444' },
  high_TPSA:             { label: '고극성',    color: '#06b6d4' },
  inorganic_placeholder: { label: '무기/미네랄', color: 'var(--muted)' },
  general:               { label: '일반',      color: 'var(--faint)' },
};

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function EmptyState({ children }) {
  return (
    <div style={{ padding: 28, color: 'var(--faint)', textAlign: 'center', fontSize: 13 }}>
      {children}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <span style={{ ...mono, fontSize: 11, color: 'var(--muted)' }}>
      {label} <b style={{ color: 'var(--ink)', fontWeight: 600 }}>{value ?? '-'}</b>
    </span>
  );
}

function TypeTag({ type }) {
  const meta = TYPE_META[type] || { label: type, color: 'var(--faint)' };
  return (
    <span style={{
      ...mono, fontSize: 10, fontWeight: 600,
      color: meta.color, background: `${meta.color}1a`,
      border: `1px solid ${meta.color}44`,
      borderRadius: 999, padding: '2px 7px',
    }}>
      {meta.label}
    </span>
  );
}

function ScoreBadge({ value }) {
  const color = value >= 70 ? 'var(--good)' : value >= 45 ? 'var(--warn)' : 'var(--flag)';
  return <b style={{ color }}>{value}</b>;
}

export default function HistoryPanel() {
  const [compounds, setCompounds]     = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [candidates, setCandidates]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  async function loadHistory() {
    setLoading(true);
    setError('');
    try {
      const [compoundRows, experimentRows, candidateRows] = await Promise.all([
        getCompounds(),
        getDoeExperiments(),
        listCandidates(),
      ]);
      setCompounds(compoundRows ?? []);
      setExperiments(experimentRows ?? []);
      setCandidates(candidateRows ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([getCompounds(), getDoeExperiments(), listCandidates()])
      .then(([compoundRows, experimentRows, candidateRows]) => {
        if (!active) return;
        setCompounds(compoundRows ?? []);
        setExperiments(experimentRows ?? []);
        setCandidates(candidateRows ?? []);
      })
      .catch((err) => { if (!active) return; setError(err.message); })
      .finally(() => { if (!active) return; setLoading(false); });

    return () => { active = false; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{ background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--flag)' }}>
          {error}
        </div>
      )}

      {/* 화합물 + DOE 실험 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <section style={card}>
          <div style={cardH}>
            <div>
              <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>COMPOUNDS</span>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>저장된 화합물</h2>
            </div>
            <button onClick={loadHistory} disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
              새로고침
            </button>
          </div>
          <div style={cardB}>
            {compounds.length === 0 ? (
              <EmptyState>{loading ? '불러오는 중...' : '저장된 화합물이 없습니다'}</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {compounds.map(row => (
                  <article key={row.id ?? `${row.smiles}-${row.created_at}`}
                    style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <strong style={{ fontSize: 13 }}>{row.name || row.formula || '이름 없음'}</strong>
                      <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>{formatDate(row.created_at)}</span>
                    </div>
                    <div style={{ ...mono, fontSize: 11, color: 'var(--muted)', overflowWrap: 'anywhere', marginBottom: 8 }}>{row.smiles}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <Metric label="MW"      value={row.mw} />
                      <Metric label="logP"    value={row.logp} />
                      <Metric label="TPSA"    value={row.tpsa} />
                      <Metric label="HBD/HBA" value={`${row.hbd ?? '-'} / ${row.hba ?? '-'}`} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={card}>
          <div style={cardH}>
            <div>
              <span style={{ ...mono, fontSize: 11, color: 'var(--good)', fontWeight: 600 }}>DOE</span>
              <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>저장된 실험</h2>
            </div>
          </div>
          <div style={cardB}>
            {experiments.length === 0 ? (
              <EmptyState>{loading ? '불러오는 중...' : '저장된 실험이 없습니다'}</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {experiments.map(row => (
                  <article key={row.id ?? `${row.design_type}-${row.created_at}`}
                    style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                      <strong style={{ fontSize: 13 }}>{row.name || `${row.design_type?.toUpperCase?.() ?? 'DOE'} 설계`}</strong>
                      <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>{formatDate(row.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      <Metric label="runs"    value={row.n_runs} />
                      <Metric label="factors" value={Array.isArray(row.factors) ? row.factors.join(', ') : '-'} />
                      <Metric label="R²"      value={row.regression_result?.r2} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 저장된 후보 (전체 너비) */}
      <section style={card}>
        <div style={cardH}>
          <div>
            <span style={{ ...mono, fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>CANDIDATES</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>저장된 후보</h2>
          </div>
          <span style={{ ...mono, fontSize: 11, color: 'var(--faint)' }}>{candidates.length}건</span>
        </div>
        <div style={cardB}>
          {candidates.length === 0 ? (
            <EmptyState>{loading ? '불러오는 중...' : '저장된 후보가 없습니다 — 후보 설계 탭에서 저장 버튼을 누르세요'}</EmptyState>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
              {candidates.map(row => {
                const scores  = row.scores  ?? {};
                const types   = Array.isArray(row.compound_types) ? row.compound_types : [];
                const target  = TARGET_LABELS[row.target] ?? row.target ?? '-';
                return (
                  <article key={row.id ?? `${row.smiles}-${row.created_at}`}
                    style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 14 }}>
                    {/* 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{row.label || '이름 없음'}</div>
                        <div style={{ ...mono, fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                          {row.input_name || '출발물질 미지정'} → <b style={{ color: 'var(--accent)' }}>{target}</b>
                        </div>
                      </div>
                      <span style={{ ...mono, fontSize: 10, color: 'var(--faint)', flexShrink: 0 }}>{formatDate(row.created_at)}</span>
                    </div>

                    {/* SMILES */}
                    <div style={{ ...mono, fontSize: 10, color: 'var(--muted)', overflowWrap: 'anywhere', marginBottom: 10 }}>
                      {row.smiles}
                    </div>

                    {/* 물질 유형 태그 */}
                    {types.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                        {types.map(t => <TypeTag key={t} type={t} />)}
                      </div>
                    )}

                    {/* 점수 */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {[
                        ['목표 효능',  scores.target],
                        ['피부 투과',  scores.skin_permeation],
                        ['제형 적합',  scores.formulation_fit],
                        ['합성 접근', scores.synthetic_access],
                      ].map(([lbl, val]) => (
                        <div key={lbl} style={{ background: 'var(--panel)', borderRadius: 7, padding: '6px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: 'var(--faint)', marginBottom: 2 }}>{lbl}</div>
                          <div style={{ ...mono, fontSize: 13, fontWeight: 700 }}>
                            {val != null ? <ScoreBadge value={val} /> : '-'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
