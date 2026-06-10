import { useEffect, useState } from 'react';

export default function StructureViewer({ smiles, height = 260 }) {
  const [rendered, setRendered] = useState({ smiles: '', src: '', state: 'idle' });

  useEffect(() => {
    if (!smiles) {
      return undefined;
    }

    const controller = new AbortController();
    let objectUrl = '';

    fetch('/api/structure/svg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smiles }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || '구조 렌더링 실패');
        }
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setRendered({ smiles, src: objectUrl, state: 'done' });
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setRendered({ smiles, src: '', state: 'error' });
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [smiles]);

  const isCurrent = rendered.smiles === smiles;
  const src = isCurrent ? rendered.src : '';
  const state = !smiles ? 'idle' : isCurrent ? rendered.state : 'loading';

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        width: '100%',
        height,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--panel-2)',
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        {src ? (
          <img
            alt="2D molecular structure"
            src={src}
            style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace" }}>
            {state === 'loading' ? '구조 렌더링 중...' : state === 'error' ? '구조를 렌더링할 수 없습니다' : 'SMILES를 입력하세요'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--faint)', fontFamily: "'JetBrains Mono', monospace", marginTop: 6, textAlign: 'right' }}>
        2D depiction · RDKit
      </div>
    </div>
  );
}
