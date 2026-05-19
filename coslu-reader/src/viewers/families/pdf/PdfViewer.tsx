// Família Doc. paginado — PDF via pdf.js ENDURECIDO (§13.3):
// isEvalSupported:false (mitiga CVE-2024-4367), worker isolado, sem
// auto-fetch/stream (temos os bytes). A API low-level NÃO executa o
// JS embutido do PDF (não habilitamos scripting/XFA). Render por
// página em <canvas>. Falha → fallback chain (texto → hex).

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ViewerProps } from "../../types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 50;
const SCALE = 1.4;

function PdfPage({ pdf, num }: { pdf: PDFDocumentProxy; num: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await pdf.getPage(num);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = ref.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const r = page.render({ canvas, canvasContext: ctx, viewport });
      task = r;
      try {
        await r.promise;
      } catch {
        /* render cancelado */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, num]);
  return <canvas ref={ref} className="pdf-page" />;
}

type State =
  | { t: "load" }
  | { t: "ok"; pdf: PDFDocumentProxy; pages: number }
  | { t: "err" };

export default function PdfViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    let doc: PDFDocumentProxy | null = null;
    source
      .loadBytes()
      .then(async (bytes) => {
        // objeto em variável (não-literal) evita o excess-property
        // check do union de getDocument; props são de DocumentInitParameters.
        const params = {
          data: bytes,
          isEvalSupported: false, // §13.3 — mitiga CVE-2024-4367
          disableAutoFetch: true,
          disableStream: true,
        };
        const pdf = await pdfjs.getDocument(params).promise;
        if (!alive) {
          pdf.destroy();
          return;
        }
        doc = pdf;
        setS({ t: "ok", pdf, pages: pdf.numPages });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
      doc?.destroy();
    };
  }, [source]);

  if (s.t === "err") throw new Error("PDF inválido");
  if (s.t === "load")
    return <div className="status">Abrindo PDF…</div>;

  const shown = Math.min(s.pages, MAX_PAGES);
  return (
    <div className="view view-pdf">
      <div className="status">
        {s.pages} página(s)
        {s.pages > MAX_PAGES ? ` · mostrando as primeiras ${MAX_PAGES}` : ""}
        {" · pdf.js endurecido (sem eval/scripting)"}
      </div>
      <div className="pdf-pages">
        {Array.from({ length: shown }, (_, i) => (
          <PdfPage key={i + 1} pdf={s.pdf} num={i + 1} />
        ))}
      </div>
    </div>
  );
}
