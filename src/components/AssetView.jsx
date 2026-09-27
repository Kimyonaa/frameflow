import React, { useEffect, useRef, useState } from 'react';
import Design from './Design';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export default function AssetView({ version, page = 1, onPages, token }) {
  const canvas = useRef(),
    [error, setError] = useState('');
  const url = version?.assetId
    ? token
      ? `/api/review/${token}/asset/${version.assetId}`
      : `/api/assets/${version.assetId}`
    : null;
  useEffect(() => {
    setError('');
    if (version?.mime !== 'application/pdf') return;
    let disposed = false,
      renderTask,
      loading;
    async function render() {
      try {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        if (disposed) return;
        GlobalWorkerOptions.workerSrc = workerUrl;
        loading = getDocument({ url, isEvalSupported: false });
        const pdf = await loading.promise;
        if (disposed) return;
        onPages?.(pdf.numPages);
        const p = await pdf.getPage(Math.min(page, pdf.numPages));
        if (disposed) return;
        const viewport = p.getViewport({ scale: 1.3 });
        const el = canvas.current;
        el.width = viewport.width;
        el.height = viewport.height;
        renderTask = p.render({ canvasContext: el.getContext('2d'), viewport });
        await renderTask.promise;
      } catch (e) {
        if (!disposed) setError('This PDF could not be rendered. Try a different document.');
      }
    }
    render();
    return () => {
      disposed = true;
      renderTask?.cancel();
      loading?.destroy();
    };
  }, [url, page, version?.id]);

  if (!version) return null;
  if (version.template) return <Design version={version.template} />;
  if (error) return <div className="asset-error">{error}</div>;
  return version.mime === 'application/pdf' ? (
    <canvas ref={canvas} className="asset-image" aria-label={version.name + ' PDF preview'} />
  ) : (
    <img
      className="asset-image"
      src={url}
      alt={version.name}
      onError={() => setError('The image could not be loaded.')}
    />
  );
}
