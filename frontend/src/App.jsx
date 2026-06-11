import { useState } from 'react';
import InputPanel from './components/InputPanel';
import ComparisonSheet from './components/ComparisonSheet';
import SimilarPanel from './components/SimilarPanel';
import CandidatePanel from './components/CandidatePanel';
import DOEPanel from './components/DOEPanel';
import DockingPanel from './components/DockingPanel';
import HistoryPanel from './components/HistoryPanel';
import { analyzeSmiles } from './api';

export default function App() {
  const [comparisonList, setComparisonList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('analyze');

  async function handleAnalyze(smi, name) {
    setLoading(true);
    setError('');
    try {
      const data = await analyzeSmiles(smi);
      setComparisonList(prev => {
        const idx = prev.findIndex(c => c.smiles === smi);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], name, data };
          return next;
        }
        const id = `${smi}-${Date.now()}`;
        return [...prev, { id, name, smiles: smi, data }].slice(0, 6);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRemove(id) {
    setComparisonList(prev => prev.filter(c => c.id !== id));
  }

  function handleAddSimilar(smi, name, data) {
    setComparisonList(prev => {
      const idx = prev.findIndex(c => c.smiles === smi);
      if (idx >= 0) return prev;
      const id = `${smi}-${Date.now()}`;
      return [...prev, { id, name, smiles: smi, data }].slice(0, 6);
    });
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
            cosmetic molecule design console
          </span>
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--muted)', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 13px' }}>
          Module <b style={{ color: 'var(--accent)' }}>02</b> · 후보 설계 + 합성 의사결정 · React
        </div>
      </header>

      {/* 탭 */}
      <div style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 20px', display: 'flex', gap: 4 }}>
        {[['analyze', '구조 분석'], ['candidate', '후보 설계'], ['doe', 'DOE 실험계획'], ['docking', '분자 도킹'], ['history', '히스토리']].map(([id, lbl]) => (
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
              <SimilarPanel
                querySmiles={comparisonList.at(-1)?.smiles ?? null}
                onAdd={handleAddSimilar}
                addedSmiles={new Set(comparisonList.map(c => c.smiles))}
              />
            </div>
            <ComparisonSheet
              compounds={comparisonList}
              onRemove={handleRemove}
              onClear={() => setComparisonList([])}
            />
          </div>
        )}
        {tab === 'candidate' && (
          <div style={{ paddingTop: 18 }}>
            <CandidatePanel />
          </div>
        )}
        {tab === 'doe' && (
          <div style={{ paddingTop: 18, maxWidth: 900 }}>
            <DOEPanel />
          </div>
        )}
        {tab === 'docking' && (
          <div style={{ paddingTop: 18 }}>
            <DockingPanel />
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
