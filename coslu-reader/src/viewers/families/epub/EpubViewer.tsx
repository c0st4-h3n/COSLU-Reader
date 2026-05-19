// Família E-book — EPUB via epub.js (§13.3). scripting OFF; recursos
// do próprio arquivo (sem rede); epub.js pinado (manutenção fraca).
//
// Robustez (o "às vezes quebra"): epub.js é imperativo e sensível ao
// duplo mount do StrictMode + loadBytes async. Mitigações:
//  • token `cancelled` destrói o que foi criado MESMO após unmount;
//  • host.innerHTML limpo (mata iframe órfão do ciclo descartado);
//  • navegação SERIALIZADA (fila de promessas) — sem corrida de clique;
//  • botões só habilitam após `ready`;
//  • ResizeObserver → rendition.resize() (paginação consistente).
// EPUB inválido → throw → fallback chain (texto → hex).

import { useEffect, useRef, useState } from "react";
import ePub, { type Book, type NavItem, type Rendition } from "epubjs";
import type { ViewerProps } from "../../types";

type State = { t: "load" } | { t: "ready" } | { t: "err" };

export default function EpubViewer({ source }: ViewerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rendRef = useRef<Rendition | null>(null);
  const navLock = useRef<Promise<unknown>>(Promise.resolve());
  const [s, setS] = useState<State>({ t: "load" });
  const [toc, setToc] = useState<NavItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    let book: Book | null = null;

    const teardown = () => {
      try {
        rendRef.current?.destroy();
        book?.destroy();
      } catch {
        /* noop */
      }
      rendRef.current = null;
      book = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };

    (async () => {
      const bytes = await source.loadBytes();
      if (cancelled || !hostRef.current) return;
      hostRef.current.innerHTML = ""; // remove iframe órfão (StrictMode)
      const ab = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      book = ePub(ab);
      const rendition = book.renderTo(hostRef.current, {
        width: "100%",
        height: "100%",
        flow: "paginated",
        spread: "none",
        allowScriptedContent: false,
      });
      rendRef.current = rendition;
      await rendition.display();
      if (cancelled) {
        teardown();
        return;
      }
      setS({ t: "ready" });
      book.loaded.navigation
        .then((n) => !cancelled && setToc(n.toc ?? []))
        .catch(() => {
          /* sem sumário */
        });
    })().catch(() => !cancelled && setS({ t: "err" }));

    const ro = new ResizeObserver(() => {
      try {
        rendRef.current?.resize();
      } catch {
        /* noop */
      }
    });
    if (hostRef.current) ro.observe(hostRef.current);

    return () => {
      cancelled = true;
      ro.disconnect();
      teardown();
    };
  }, [source]);

  if (s.t === "err") throw new Error("EPUB inválido");

  const ready = s.t === "ready";
  // navegação serializada: clique novo só roda após o anterior terminar
  const queue = (op: (r: Rendition) => Promise<void>) => {
    const r = rendRef.current;
    if (!ready || !r) return;
    navLock.current = navLock.current.then(() => op(r)).catch(() => {});
  };

  return (
    <div className="view-epub">
      <div className="archive-bar">
        <button
          className="archive-back"
          disabled={!ready}
          onClick={() => queue((r) => r.prev())}
        >
          ‹ ant
        </button>
        <button
          className="archive-back"
          disabled={!ready}
          onClick={() => queue((r) => r.next())}
        >
          próx ›
        </button>
        {toc.length > 0 && (
          <select
            className="db-select"
            defaultValue=""
            disabled={!ready}
            onChange={(e) => {
              const href = e.target.value;
              if (href) queue((r) => r.display(href));
            }}
          >
            <option value="" disabled>
              sumário…
            </option>
            {toc.map((t, i) => (
              <option key={i} value={t.href}>
                {t.label.trim() || `seção ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        <span className="crumb">{source.name} · EPUB · scripting off</span>
      </div>
      <div className="epub-stage">
        <div ref={hostRef} className="epub-host" />
        {!ready && (
          <div className="status epub-loading">Abrindo e-book…</div>
        )}
      </div>
    </div>
  );
}
