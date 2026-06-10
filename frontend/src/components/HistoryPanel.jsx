import { useEffect, useState } from 'react';
import { getCompounds, getDoeExperiments } from '../api';

const card = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' };
const cardH = { padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 };
const cardB = { padding: 18 };
const mono = { fontFamily: "'JetBrains Mono',monospace" };
const btn = { fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 12, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' };

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

export default function HistoryPanel() {
  const [compounds, setCompounds] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadHistory() {
    setLoading(true);
    setError('');
    try {
      const [compoundRows, experimentRows] = await Promise.all([
        getCompounds(),
        getDoeExperiments(),
      ]);
      setCompounds(compoundRows ?? []);
      setExperiments(experimentRows ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([getCompounds(), getDoeExperiments()])
      .then(([compoundRows, experimentRows]) => {
        if (!active) return;
        setCompounds(compoundRows ?? []);
        setExperiments(experimentRows ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
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
          {error && <div style={{ marginBottom: 12, color: 'var(--flag)', fontSize: 12 }}>{error}</div>}
          {compounds.length === 0 ? (
            <EmptyState>{loading ? '불러오는 중...' : '저장된 화합물이 없습니다'}</EmptyState>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {compounds.map(row => (
                <article key={row.id ?? `${row.smiles}-${row.created_at}`} style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{row.name || row.formula || '이름 없음'}</strong>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>{formatDate(row.created_at)}</span>
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--muted)', overflowWrap: 'anywhere', marginBottom: 8 }}>{row.smiles}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <Metric label="MW" value={row.mw} />
                    <Metric label="logP" value={row.logp} />
                    <Metric label="TPSA" value={row.tpsa} />
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
                <article key={row.id ?? `${row.design_type}-${row.created_at}`} style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <strong style={{ fontSize: 13 }}>{row.name || `${row.design_type?.toUpperCase?.() ?? 'DOE'} 설계`}</strong>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>{formatDate(row.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                    <Metric label="runs" value={row.n_runs} />
                    <Metric label="factors" value={Array.isArray(row.factors) ? row.factors.join(', ') : '-'} />
                    <Metric label="R2" value={row.regression_result?.r2} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
