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

export async function saveCompound({ name, smiles, result }) {
  const r = await fetch(`${BASE}/compounds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, smiles, result }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '화합물 저장 실패'); }
  return r.json();
}

export async function getCompounds() {
  const r = await fetch(`${BASE}/compounds`);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '화합물 목록 조회 실패'); }
  return r.json();
}

export async function saveDoeExperiment({ name, designResult, yValues, regrResult }) {
  const r = await fetch(`${BASE}/doe-experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, designResult, yValues, regrResult }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '실험 저장 실패'); }
  return r.json();
}

export async function getDoeExperiments() {
  const r = await fetch(`${BASE}/doe-experiments`);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '실험 목록 조회 실패'); }
  return r.json();
}

export async function generateCandidates({ smiles, name, target }) {
  const r = await fetch(`${BASE}/candidates/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ smiles, name, target }),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '후보 설계 실패'); }
  return r.json();
}

export async function saveCandidate(payload) {
  const r = await fetch(`${BASE}/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '후보 저장 실패'); }
  return r.json();
}

export async function listCandidates() {
  const r = await fetch(`${BASE}/candidates`);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '후보 목록 조회 실패'); }
  return r.json();
}

export async function deleteCompound(id) {
  const r = await fetch(`${BASE}/compounds/${id}`, { method: 'DELETE' });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '삭제 실패'); }
  return r.json();
}

export async function deleteDoeExperiment(id) {
  const r = await fetch(`${BASE}/doe-experiments/${id}`, { method: 'DELETE' });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '삭제 실패'); }
  return r.json();
}

export async function deleteCandidate(id) {
  const r = await fetch(`${BASE}/candidates/${id}`, { method: 'DELETE' });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || '삭제 실패'); }
  return r.json();
}
