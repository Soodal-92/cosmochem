const BASE = '/api';

export async function analyzeSmiles(smiles) {
  const r = await fetch(`${BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smiles }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || '분석 실패');
  }
  return r.json();
}

export async function doeDesign(factors, design = 'ccf') {
  const r = await fetch(`${BASE}/doe/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factors, design }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || 'DOE 설계 실패'); }
  return r.json();
}

export async function doeRegression(factors, X, y) {
  const r = await fetch(`${BASE}/doe/regression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ factors, X, y }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '회귀 분석 실패'); }
  return r.json();
}

export async function pubchemSearch(name) {
  const r = await fetch(`${BASE}/pubchem/${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `'${name}'을(를) 찾을 수 없습니다`);
  }
  return r.json();
}
