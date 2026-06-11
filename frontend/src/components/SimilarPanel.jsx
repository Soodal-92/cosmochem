import { useState } from 'react';
import StructureViewer from './StructureViewer';
import { searchSimilar, analyzeSmiles } from '../api';

const mono = { fontFamily: "'JetBrains Mono',monospace" };

function SimScore({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? 'var(--good)' : pct >= 75 ? 'var(--warn)' : 'var(--muted)';
  return (
    <span style={{
      ...mono, fontSize: 10, fontWeight: 700, color,
      background: `${color}1a`, border: `1px solid ${color}44`,
      borderRadius: 999, padding: '2px 7px',
    }}>
      {pct}% 유사
    </span>
  );
}

export default function SimilarPanel({ querySmiles, onAdd, addedSmiles }) {
  const [results,   setResults]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [adding,    setAdding]    = useState(null);
  const [error,     setError]     = useState('');
  const [searched,  setSearched]  = useState(false);
  const [threshold, setThreshold] = useState(75);

  async function handleSearch() {
    if (!querySmiles) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const data = await searchSimilar(querySmiles, { threshold, max: 6 });
      setResults(data);
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(item) {
    if (adding === item.smiles) return;
    setAdding(item.smiles);
    try {
      const data = await analyzeSmiles(item.smiles);
      onAdd(item.smiles, item.name, data);
    } catch (err) {
      setError(`추가 실패: ${err.message}`);
    } finally {
      setAdding(null);
    }
  }

  if (!querySmiles) return null;

  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid var(--line-2)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ flex: 1 }}>
          <span style={{ ...mono, fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>SIMILAR</span>
          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 600, marginTop: 1 }}>
            유사 구조 검색
          </div>
        </div>

        {/* 임계값 슬라이더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ ...mono, fontSize: 10, color: 'var(--muted)' }}>유사도</span>
          <input
            type="range" min={60} max={95} step={5} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{ width: 72, accentColor: 'var(--accent)' }}
          />
          <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 700, minWidth: 30 }}>
            {threshold}%
          </span>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 12,
            color: '#fff', background: 'var(--accent)', border: 'none',
            borderRadius: 8, padding: '7px 13px', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1, flexShrink: 0,
          }}
        >
          {loading ? '검색 중…' : '검색'}
        </button>
      </div>

      {/* 오류 */}
      {error && (
        <div style={{ margin: '10px 14px 0', background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 8, padding: '7px 12px', fontSize: 12, color: 'var(--flag)' }}>
          {error}
        </div>
      )}

      {/* 결과 */}
      {searched && !loading && (
        <div style={{ padding: '12px 14px' }}>
          {results.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--faint)', textAlign: 'center', padding: '16px 0' }}>
              유사도 {threshold}% 이상인 화합물이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {results.map(item => {
                const alreadyAdded = addedSmiles.has(item.smiles);
                const isAdding     = adding === item.smiles;
                return (
                  <div key={item.cid ?? item.smiles} style={{
                    display: 'grid', gridTemplateColumns: '72px 1fr auto',
                    gap: 10, alignItems: 'center',
                    background: 'var(--panel-2)', border: '1px solid var(--line-2)',
                    borderRadius: 10, padding: '8px 12px 8px 8px',
                  }}>
                    {/* 구조 미리보기 */}
                    <div style={{ borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                      <StructureViewer smiles={item.smiles} height={64} />
                    </div>

                    {/* 정보 */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                          {item.name.length > 30 ? item.name.slice(0, 28) + '…' : item.name}
                        </span>
                        <SimScore value={item.similarity} />
                      </div>
                      <div style={{ ...mono, fontSize: 10, color: 'var(--muted)' }}>
                        {item.formula}{item.mw ? ` · MW ${parseFloat(item.mw).toFixed(1)}` : ''}
                      </div>
                      <div style={{ ...mono, fontSize: 9, color: 'var(--faint)', marginTop: 3, overflowWrap: 'anywhere' }}>
                        {item.smiles.length > 50 ? item.smiles.slice(0, 48) + '…' : item.smiles}
                      </div>
                    </div>

                    {/* 추가 버튼 */}
                    <button
                      onClick={() => handleAdd(item)}
                      disabled={alreadyAdded || isAdding}
                      style={{
                        ...mono, fontSize: 10, fontWeight: 700, flexShrink: 0,
                        color: alreadyAdded ? 'var(--good)' : '#fff',
                        background: alreadyAdded ? 'transparent' : 'var(--accent)',
                        border: alreadyAdded ? '1px solid var(--good)' : 'none',
                        borderRadius: 8, padding: '6px 10px',
                        cursor: alreadyAdded || isAdding ? 'default' : 'pointer',
                        opacity: isAdding ? 0.6 : 1,
                      }}
                    >
                      {alreadyAdded ? '✓ 추가됨' : isAdding ? '…' : '+ 추가'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 미검색 안내 */}
      {!searched && !loading && (
        <div style={{ ...mono, fontSize: 11, color: 'var(--faint)', textAlign: 'center', padding: '18px 14px' }}>
          검색 버튼을 눌러 PubChem에서 유사 화합물을 찾습니다
        </div>
      )}
    </div>
  );
}
