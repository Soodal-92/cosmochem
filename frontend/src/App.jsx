import { useState } from 'react';
import InputPanel from './components/InputPanel';
import DescriptorPanel from './components/DescriptorPanel';
import DOEPanel from './components/DOEPanel';
import HistoryPanel from './components/HistoryPanel';
import { analyzeSmiles } from './api';

export default function App() {
  const [result, setResult] = useState(null);
  const [smiles, setSmiles] = useState('');
  const [compoundName, setCompoundName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEstimate, setIsEstimate] = useState(false);
  const [tab, setTab] = useState('analyze');

  async function handleAnalyze(smi, name) {
    setLoading(true);
    setError('');
    setSmiles(smi);
    setCompoundName(name);
    try {
      const data = await analyzeSmiles(smi);
      setResult(data);
      setIsEstimate(false);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--base)' }}>
      <header style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 20, flexWrap: 'wrap',
        maxWidth: 1180, margin: '0 auto', padding: '24px 20px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 22, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 0 4px var(--accent-soft)', display: 'inline-block' }} />
            CosmoChem
          </div>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.14em' }}>
            structure analysis console
          </span>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--muted)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 13px' }}>
          Module <b style={{ color: 'var(--accent)' }}>01</b> · 물질 선정 + 구조 분석 · React
        </div>
      </header>

      {/* 탭 */}
      <div style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 20px', display: 'flex', gap: 4 }}>
        {[['analyze', '구조 분석'], ['doe', 'DOE 실험계획'], ['history', '히스토리']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13,
              border: 'none', borderRadius: '10px 10px 0 0', padding: '9px 20px', cursor: 'pointer',
              background: tab === id ? 'var(--panel)' : 'transparent',
              color: tab === id ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
            {lbl}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 1180, margin: '0 auto 80px', padding: '0 20px' }}>
        {tab === 'analyze' && (
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start', paddingTop: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <InputPanel onAnalyze={handleAnalyze} loading={loading} />
              {error && (
                <div style={{ background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: 'var(--flag)' }}>
                  {error}
                </div>
              )}
            </div>
            <DescriptorPanel result={result} smiles={smiles} compoundName={compoundName} isEstimate={isEstimate} />
          </div>
        )}
        {tab === 'doe' && (
          <div style={{ paddingTop: 18, maxWidth: 900 }}>
            <DOEPanel />
          </div>
        )}
        {tab === 'history' && (
          <div style={{ paddingTop: 18 }}>
            <HistoryPanel />
          </div>
        )}
      </main>
    </div>
  );
}
