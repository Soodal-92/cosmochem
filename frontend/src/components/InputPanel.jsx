import { useState } from 'react';
import { pubchemSearch } from '../api';

const PRESETS = [
  { label: '나이아신아마이드', smiles: 'O=C(N)c1cccnc1', name: 'niacinamide' },
  { label: '아스코르브산',     smiles: 'OC[C@H](O)[C@H]1OC(=O)C(O)=C1O', name: 'ascorbicacid' },
  { label: '레티놀',           smiles: 'OC/C=C(/C)CCC=C(C)C', name: 'retinol' },
  { label: '알파-아르부틴',    smiles: 'OC[C@H]1O[C@@H](Oc2ccc(O)cc2)[C@H](O)[C@@H](O)[C@@H]1O', name: 'alphaarbutin' },
  { label: '코지산',           smiles: 'OCC1=CC(=O)C(O)=CO1', name: 'kojicacid' },
  { label: '레스베라트롤',     smiles: 'OC1=CC(=CC(=C1)/C=C/c1ccc(O)cc1)O', name: 'resveratrol' },
  { label: '페룰산',           smiles: 'COc1cc(/C=C/C(=O)O)ccc1O', name: 'caffeine' },
  { label: '살리실산',         smiles: 'OC(=O)c1ccccc1O', name: 'salicylic' },
  { label: '아데노신',         smiles: 'Nc1ncnc2c1ncn2[C@@H]1O[C@H](CO)[C@@H](O)[C@H]1O', name: 'adenosine' },
  { label: '판테놀',           smiles: 'CC(C)(CO)[C@@H](O)C(=O)NCCCO', name: 'pantenol' },
];

export default function InputPanel({ onAnalyze, loading }) {
  const [smiles, setSmiles] = useState('');
  const [pcName, setPcName] = useState('');
  const [pcError, setPcError] = useState('');
  const [pcLoading, setPcLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (smiles.trim()) onAnalyze(smiles.trim(), '');
  }

  function selectPreset(p) {
    setSmiles(p.smiles);
    onAnalyze(p.smiles, p.label);
  }

  async function handlePubchem(e) {
    e.preventDefault();
    if (!pcName.trim()) return;
    setPcError('');
    setPcLoading(true);
    try {
      const data = await pubchemSearch(pcName.trim());
      if (data.smiles) {
        setSmiles(data.smiles);
        onAnalyze(data.smiles, data.iupac_name || pcName);
      } else {
        setPcError('SMILES 정보가 없습니다');
      }
    } catch (err) {
      setPcError(err.message);
    } finally {
      setPcLoading(false);
    }
  }

  const inputStyle = {
    flex: 1, fontFamily: "'JetBrains Mono',monospace", fontSize: 13,
    background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 9,
    padding: '11px 12px', outline: 'none', color: 'var(--ink)', width: '100%',
  };
  const btnStyle = (color = 'var(--accent)') => ({
    fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: 13,
    color: '#fff', background: color, border: 'none', borderRadius: 9,
    padding: '11px 18px', cursor: 'pointer', whiteSpace: 'nowrap',
  });
  const labelStyle = {
    display: 'block', fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
    letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 7,
  };

  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>IN</span>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: 0 }}>원료 입력</h2>
      </div>

      <div style={{ padding: 16 }}>
        {/* SMILES 입력 */}
        <form onSubmit={handleSubmit}>
          <label style={labelStyle}>SMILES 구조식</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              style={inputStyle}
              value={smiles}
              onChange={e => setSmiles(e.target.value)}
              placeholder="예: O=C(N)c1cccnc1"
              spellCheck={false}
            />
            <button type="submit" style={btnStyle()} disabled={loading || !smiles.trim()}>
              {loading ? '분석 중…' : '분석'}
            </button>
          </div>
        </form>

        {/* PubChem 검색 */}
        <form onSubmit={handlePubchem}>
          <label style={labelStyle}>PubChem 이름 검색</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <input
              style={inputStyle}
              value={pcName}
              onChange={e => setPcName(e.target.value)}
              placeholder="예: niacinamide, kojic acid"
            />
            <button type="submit" style={btnStyle('#11876A')} disabled={pcLoading || !pcName.trim()}>
              {pcLoading ? '검색 중…' : '검색'}
            </button>
          </div>
          {pcError && (
            <div style={{ fontSize: 12, color: 'var(--flag)', marginBottom: 8 }}>{pcError}</div>
          )}
        </form>

        {/* 프리셋 */}
        <div style={{ marginTop: 20 }}>
          <label style={labelStyle}>자주 쓰는 원료</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {PRESETS.map(p => (
              <button key={p.name} onClick={() => selectPreset(p)}
                style={{
                  fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 500,
                  background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 999,
                  padding: '5px 12px', cursor: 'pointer', color: 'var(--ink)',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
