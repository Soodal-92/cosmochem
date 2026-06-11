import { useEffect, useRef, useState } from 'react';
import { listDockingTargets, submitDocking, getDockingJob } from '../api';
import StructureViewer from './StructureViewer';

const mono = { fontFamily: "'JetBrains Mono',monospace" };

const GRADE_META = {
  strong:   { color: 'var(--good)', label: '강한 결합',   bar: 95 },
  moderate: { color: 'var(--warn)', label: '중간 결합',   bar: 65 },
  weak:     { color: '#f97316',     label: '약한 결합',   bar: 38 },
  poor:     { color: 'var(--flag)', label: '결합 부적합', bar: 15 },
};

function AffinityGauge({ affinity, grade }) {
  const meta = GRADE_META[grade] || GRADE_META.poor;
  const pct  = meta.bar;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700 }}>결합 친화도</span>
        <span style={{ ...mono, fontSize: 16, fontWeight: 700, color: meta.color }}>
          {affinity} <span style={{ fontSize: 11, color: 'var(--muted)' }}>kcal/mol</span>
        </span>
      </div>
      <div style={{ background: 'var(--line-2)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: meta.color,
          borderRadius: 999,
          transition: 'width 0.8s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ ...mono, fontSize: 10, color: meta.color, fontWeight: 700 }}>{meta.label}</span>
        <span style={{ ...mono, fontSize: 10, color: 'var(--faint)' }}>−2 ~ −12 kcal/mol 범위</span>
      </div>
    </div>
  );
}

function DescRow({ label, value, unit }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line-2)' }}>
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, color: 'var(--muted)' }}>{label}</span>
      <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
        {value ?? '-'}
        {unit && <span style={{ fontSize: 10, color: 'var(--faint)', marginLeft: 4 }}>{unit}</span>}
      </span>
    </div>
  );
}

export default function DockingPanel() {
  const [targets,     setTargets]     = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [smiles,      setSmiles]      = useState('');
  const [molName,     setMolName]     = useState('');
  const [jobs,        setJobs]        = useState([]);   // [{jobId, label, status, result}]
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const pollRef = useRef({});

  useEffect(() => {
    listDockingTargets()
      .then(data => { setTargets(data); if (data.length) setSelectedKey(data[0].key); })
      .catch(() => {});
    return () => Object.values(pollRef.current).forEach(clearInterval);
  }, []);

  function startPolling(jobId) {
    pollRef.current[jobId] = setInterval(async () => {
      try {
        const job = await getDockingJob(jobId);
        setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, ...job } : j));
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(pollRef.current[jobId]);
          delete pollRef.current[jobId];
        }
      } catch { /* ignore */ }
    }, 2000);
  }

  async function handleSubmit() {
    if (!smiles.trim() || !selectedKey) return;
    setSubmitting(true);
    setError('');
    try {
      const { job_id } = await submitDocking({ smiles: smiles.trim(), target: selectedKey, name: molName });
      const newJob = { jobId: job_id, status: 'running', label: molName || smiles.slice(0, 20), input: { smiles, target: selectedKey } };
      setJobs(prev => [newJob, ...prev]);
      startPolling(job_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTarget = targets.find(t => t.key === selectedKey);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 입력 패널 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>

        {/* 좌: 입력 폼 */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>DOCKING INPUT</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>분자 도킹 설정</h2>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* SMILES */}
            <div>
              <label style={{ ...mono, fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>SMILES</label>
              <input
                type="text" value={smiles} onChange={e => setSmiles(e.target.value)}
                placeholder="예: COc1cc(/C=C/C(=O)O)ccc1O"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  ...mono, fontSize: 12, color: 'var(--ink)',
                  background: 'var(--panel-2)', border: '1px solid var(--line-2)',
                  borderRadius: 8, padding: '9px 12px', outline: 'none',
                }}
              />
            </div>

            {/* 이름 */}
            <div>
              <label style={{ ...mono, fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>물질명 (선택)</label>
              <input
                type="text" value={molName} onChange={e => setMolName(e.target.value)}
                placeholder="예: Ferulic acid"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, color: 'var(--ink)',
                  background: 'var(--panel-2)', border: '1px solid var(--line-2)',
                  borderRadius: 8, padding: '9px 12px', outline: 'none',
                }}
              />
            </div>

            {/* 타겟 선택 */}
            <div>
              <label style={{ ...mono, fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 5 }}>타겟 단백질</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {targets.map(t => (
                  <label key={t.key} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                    background: selectedKey === t.key ? 'var(--accent-soft)' : 'var(--panel-2)',
                    border: `1px solid ${selectedKey === t.key ? 'var(--accent)' : 'var(--line-2)'}`,
                    borderRadius: 9, padding: '9px 12px',
                  }}>
                    <input type="radio" name="target" value={t.key}
                      checked={selectedKey === t.key}
                      onChange={() => setSelectedKey(t.key)}
                      style={{ marginTop: 2, accentColor: 'var(--accent)' }} />
                    <div>
                      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 12, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ ...mono, fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                        {t.effect} · PDB {t.pdb_id} · ref: {t.ref_inhibitor}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: 'var(--flag-soft)', border: '1px solid var(--flag)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--flag)' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !smiles.trim()}
              style={{
                fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14,
                color: '#fff', background: 'var(--accent)', border: 'none',
                borderRadius: 10, padding: '11px 0', cursor: submitting ? 'default' : 'pointer',
                opacity: submitting || !smiles.trim() ? 0.6 : 1,
              }}
            >
              {submitting ? '제출 중…' : '도킹 분석 시작'}
            </button>
          </div>
        </div>

        {/* 우: 타겟 정보 */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)' }}>
            <span style={{ ...mono, fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>TARGET INFO</span>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>
              {selectedTarget?.name || '타겟을 선택하세요'}
            </h2>
          </div>
          {selectedTarget ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...mono, fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>{selectedTarget.note}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ ...mono, fontSize: 11, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 7, padding: '4px 10px', color: 'var(--accent)' }}>
                  PDB: {selectedTarget.pdb_id}
                </span>
                <span style={{ ...mono, fontSize: 11, background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 7, padding: '4px 10px', color: 'var(--good)' }}>
                  효능: {selectedTarget.effect}
                </span>
              </div>
              <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginBottom: 4 }}>참고 억제제 (기준값)</div>
                <div style={{ ...mono, fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{selectedTarget.ref_inhibitor}</div>
              </div>
              <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginBottom: 6 }}>결합 친화도 기준</div>
                {[
                  ['< −8.0 kcal/mol', '강한 결합', 'var(--good)'],
                  ['−6 ~ −8 kcal/mol', '중간 결합', 'var(--warn)'],
                  ['−4.5 ~ −6 kcal/mol', '약한 결합', '#f97316'],
                  ['> −4.5 kcal/mol', '결합 부적합', 'var(--flag)'],
                ].map(([range, label, color]) => (
                  <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ ...mono, fontSize: 11, color }}>{range}</span>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--muted)' }}>— {label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 36, color: 'var(--faint)', textAlign: 'center', fontSize: 13 }}>
              좌측에서 타겟 단백질을 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 결과 목록 */}
      {jobs.map(job => (
        <div key={job.jobId} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span style={{ ...mono, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>RESULT</span>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, fontWeight: 700, margin: '2px 0 0' }}>
                {job.input?.name || job.label}
                {job.result?.target_name && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> → {job.result.target_name}</span>}
              </h3>
            </div>
            {job.status === 'running' && (
              <span style={{ ...mono, fontSize: 11, color: 'var(--warn)' }}>분석 중…</span>
            )}
            {job.status === 'error' && (
              <span style={{ ...mono, fontSize: 11, color: 'var(--flag)' }}>오류: {job.error}</span>
            )}
            {job.status === 'done' && (
              <span style={{ ...mono, fontSize: 11, color: 'var(--good)' }}>완료</span>
            )}
          </div>

          {job.status === 'done' && job.result && (
            <div style={{ padding: 16 }}>
              {job.result.warning && (
                <div style={{ background: 'var(--warn-soft, #fef3c7)', border: '1px solid var(--warn)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 14 }}>
                  ⚠ {job.result.warning}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* 좌: 구조 + 친화도 게이지 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                    <StructureViewer smiles={job.input?.smiles} height={160} />
                  </div>
                  <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '12px 14px' }}>
                    <AffinityGauge affinity={job.result.affinity} grade={job.result.grade} />
                  </div>
                </div>
                {/* 우: 기술자 */}
                <div style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ ...mono, fontSize: 10, color: 'var(--faint)', marginBottom: 8 }}>분자 기술자</div>
                  <DescRow label="MW"      value={job.result.descriptors?.mw?.toFixed(1)}    unit="g/mol" />
                  <DescRow label="logP"    value={job.result.descriptors?.logp?.toFixed(2)}  unit="" />
                  <DescRow label="TPSA"    value={job.result.descriptors?.tpsa?.toFixed(1)}  unit="Å²" />
                  <DescRow label="HBD"     value={job.result.descriptors?.hbd}               unit="" />
                  <DescRow label="HBA"     value={job.result.descriptors?.hba}               unit="" />
                  <DescRow label="고리 수" value={job.result.descriptors?.rings}             unit="" />
                  <div style={{ marginTop: 12, ...mono, fontSize: 10, color: 'var(--faint)' }}>타겟 참고 억제제</div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--ink)', marginTop: 4 }}>{job.result.ref_inhibitor}</div>
                </div>
              </div>
            </div>
          )}

          {job.status === 'running' && (
            <div style={{ padding: 32, textAlign: 'center', ...mono, fontSize: 12, color: 'var(--faint)' }}>
              도킹 계산 실행 중… (약 3–5초)
            </div>
          )}
        </div>
      ))}

      {jobs.length === 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 40, textAlign: 'center', color: 'var(--faint)', ...mono, fontSize: 12, lineHeight: 1.8 }}>
          타겟 단백질과 SMILES를 입력하고 도킹 분석을 시작하세요<br />
          결과는 결합 친화도 (kcal/mol) 및 분자 기술자로 표시됩니다
        </div>
      )}
    </div>
  );
}
