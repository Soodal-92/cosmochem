// ── CSV export ─────────────────────────────────────────────────────────────

const DESCRIPTOR_KEYS = [
  'formula', 'mw', 'exact_mass', 'logp', 'tpsa',
  'hbd', 'hba', 'rot_bonds', 'heavy_atoms', 'rings',
];
const DESCRIPTOR_LABELS = [
  '분자식', 'MW (g/mol)', 'Exact Mass (Da)', 'logP', 'TPSA (Å²)',
  'HBD', 'HBA', '회전결합', '헤비원자', '고리수',
];

function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function exportComparisonCsv(compounds) {
  if (!compounds.length) return;

  const header = ['지표', ...compounds.map(c => c.name || c.smiles)];
  const rows = [
    ['SMILES', ...compounds.map(c => c.smiles)],
    ...DESCRIPTOR_KEYS.map((key, i) => [
      DESCRIPTOR_LABELS[i],
      ...compounds.map(c => {
        const v = c.data?.[key];
        if (v == null) return '';
        if (['mw', 'logp', 'tpsa'].includes(key)) return parseFloat(v).toFixed(2);
        if (key === 'exact_mass') return parseFloat(v).toFixed(4);
        return v;
      }),
    ]),
  ];

  const csv = [header, ...rows].map(r => r.map(escCsv).join(',')).join('\r\n');
  downloadText(csv, 'cosmochem_comparison.csv', 'text/csv;charset=utf-8;');
}

// ── Candidate CSV ──────────────────────────────────────────────────────────

const SCORE_KEYS   = ['target', 'skin_permeation', 'formulation_fit', 'synthetic_access'];
const SCORE_LABELS = ['목표 효능', '피부 투과', '제형 적합', '합성 접근'];
const DESC_KEYS    = ['mw', 'logp', 'tpsa', 'hbd', 'hba', 'rot_bonds'];
const DESC_LABELS  = ['MW', 'logP', 'TPSA', 'HBD', 'HBA', '회전결합'];

export function exportCandidatesCsv(candidates) {
  if (!candidates.length) return;
  const header = [
    '라벨', 'SMILES', '후보 유형', '신뢰도', '목표',
    ...DESC_LABELS, ...SCORE_LABELS,
  ];
  const rows = candidates.map(c => [
    c.label || '',
    c.smiles || '',
    c.candidate_type || '',
    c.confidence || '',
    c.target || '',
    ...DESC_KEYS.map(k => {
      const v = c.descriptors?.[k] ?? c[k];
      return v != null ? parseFloat(v).toFixed(2) : '';
    }),
    ...SCORE_KEYS.map(k => c.scores?.[k] ?? ''),
  ]);

  const csv = [header, ...rows].map(r => r.map(escCsv).join(',')).join('\r\n');
  downloadText(csv, 'cosmochem_candidates.csv', 'text/csv;charset=utf-8;');
}

// ── PDF via browser print ──────────────────────────────────────────────────

export function printCandidatePdf(candidates) {
  if (!candidates.length) return;

  const rows = candidates.map(c => {
    const sc = c.scores ?? {};
    const de = c.descriptors ?? {};
    return `
      <tr>
        <td>${c.label || '-'}</td>
        <td style="font-size:9px;word-break:break-all">${c.smiles || '-'}</td>
        <td>${c.candidate_type || '-'}</td>
        <td>${c.target || '-'}</td>
        <td>${de.mw != null ? parseFloat(de.mw).toFixed(1) : '-'}</td>
        <td>${de.logp != null ? parseFloat(de.logp).toFixed(2) : '-'}</td>
        <td>${de.tpsa != null ? parseFloat(de.tpsa).toFixed(1) : '-'}</td>
        <td>${sc.target ?? '-'}</td>
        <td>${sc.skin_permeation ?? '-'}</td>
        <td>${sc.formulation_fit ?? '-'}</td>
        <td>${sc.synthetic_access ?? '-'}</td>
      </tr>`;
  }).join('');

  const html = `
    <!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>CosmoChem — 후보 설계 결과</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #111; margin: 24px; }
      h1   { font-size: 18px; margin-bottom: 4px; }
      p    { color: #666; margin: 0 0 16px; font-size: 10px; }
      table{ border-collapse: collapse; width: 100%; }
      th   { background: #1a1a2e; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; }
      td   { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      tr:nth-child(even) td { background: #f9fafb; }
    </style>
    </head><body>
    <h1>CosmoChem · 후보 설계 결과</h1>
    <p>Generated ${new Date().toLocaleString('ko-KR')} · ${candidates.length}개 후보</p>
    <table>
      <thead><tr>
        <th>라벨</th><th>SMILES</th><th>유형</th><th>목표</th>
        <th>MW</th><th>logP</th><th>TPSA</th>
        <th>효능</th><th>투과</th><th>제형</th><th>합성</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ── helper ────────────────────────────────────────────────────────────────

function downloadText(content, filename, mime) {
  const blob = new Blob(['﻿' + content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
