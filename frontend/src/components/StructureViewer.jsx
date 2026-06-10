import { useEffect, useRef } from 'react';

function simplifySmiles(smi) {
  return smi
    .replace(/\[C@@H\]/g, 'C').replace(/\[C@H\]/g, 'C')
    .replace(/\[C@@\]/g, 'C').replace(/\[C@\]/g, 'C')
    .replace(/@@/g, '').replace(/@/g, '')
    .replace(/\//g, '').replace(/\\/g, '');
}

export default function StructureViewer({ smiles }) {
  const canvasRef = useRef(null);
  const noteRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const note = noteRef.current;
    if (!cv || !smiles) return;

    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);

    if (typeof window.SmilesDrawer === 'undefined') {
      ctx.fillStyle = '#8B96A6';
      ctx.font = "13px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';
      ctx.fillText('구조 렌더러 미로드 (오프라인)', cv.width / 2, cv.height / 2);
      return;
    }

    function makeDrawer() {
      return new window.SmilesDrawer.Drawer({
        width: 520, height: 260, bondThickness: 1.1,
        atomVisualization: 'default', explicitHydrogens: false, terminalCarbons: false,
        themes: { light: { C: '#141823', N: '#2952CC', O: '#C23A33', S: '#B5790C', BACKGROUND: '#00000000' } },
      });
    }

    window.SmilesDrawer.parse(smiles,
      (tree) => { makeDrawer().draw(tree, cv, 'light', false); if (note) note.textContent = '2D depiction · SmilesDrawer'; },
      () => {
        const simple = simplifySmiles(smiles);
        window.SmilesDrawer.parse(simple,
          (tree) => { makeDrawer().draw(tree, cv, 'light', false); if (note) note.textContent = '2D depiction · SmilesDrawer (stereo simplified)'; },
          () => {
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.fillStyle = '#8B96A6'; ctx.font = "13px 'JetBrains Mono',monospace"; ctx.textAlign = 'center';
            ctx.fillText('이 구조는 렌더링할 수 없습니다', cv.width / 2, cv.height / 2);
            if (note) note.textContent = '';
          });
      });
  }, [smiles]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} width={520} height={260}
        style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--panel-2)', borderRadius: 10 }} />
      <div ref={noteRef}
        style={{ fontSize: 10, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 6, textAlign: 'right' }} />
    </div>
  );
}
