// Família Texto/Código — Tier S: syntax highlight por linguagem via
// Shiki (lazy compartilhado, §3.3). Detecta a linguagem pela extensão
// (C/C#/JS/TS/Rust/Go/Python/Assembly/…); desconhecida → texto puro.
// Cap de tamanho: arquivos grandes renderizam crus (perf, §9).
// Toggle cru⇄destacado. Leitura falha → throw → fallback chain.
// Shiki = markup determinístico do texto (seguro, §13).

import { useEffect, useState } from "react";
import type { ViewerProps } from "../../types";
import { highlight, langForFile } from "../../shared/highlight";

const CAP = 500_000; // acima disso: sem highlight (perf)

type State =
  | { t: "load" }
  | { t: "ok"; text: string; html: string | null; lang: string; big: boolean }
  | { t: "err" };

export default function TextViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    let alive = true;
    source
      .loadText()
      .then(async (text) => {
        const lang = langForFile(source.name);
        const big = text.length > CAP;
        let html: string | null = null;
        if (!big && lang !== "text") {
          try {
            html = await highlight(text, lang);
          } catch {
            html = null;
          }
        }
        if (alive) setS({ t: "ok", text, html, lang, big });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "err") throw new Error("read_text falhou");
  if (s.t === "load") return <div className="status">Lendo…</div>;

  const showHtml = s.html && !raw;
  return (
    <div className="view-code">
      <div className="archive-bar">
        <span className="crumb">
          {source.name} · {s.lang}
          {s.big ? " · arquivo grande: sem highlight" : ""}
        </span>
        {s.html && (
          <button
            className="archive-back"
            onClick={() => setRaw((r) => !r)}
          >
            {raw ? "destacado" : "cru"}
          </button>
        )}
      </div>
      <div className="code-stage">
        {showHtml ? (
          <div
            className="code-hl"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: s.html as string }}
          />
        ) : (
          <pre className="code-plain">{s.text}</pre>
        )}
      </div>
    </div>
  );
}
