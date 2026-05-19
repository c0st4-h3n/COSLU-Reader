// Família Doc. de texto leve — Markdown (Tier S).
// §13.3: markdown-it com html:false (HTML cru escapado) + DOMPurify
// na saída como defesa-em-profundidade (obrigatório qualquer parser).
// Falha de leitura lança → fallback chain (texto → hex).

import { useEffect, useState } from "react";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import type { ViewerProps } from "../../types";

const md = new MarkdownIt({
  html: false, // raw HTML escapado (postura segura por padrão)
  linkify: true,
  typographer: true,
});

type State = { t: "load" } | { t: "ok"; html: string } | { t: "err" };

export default function MarkdownViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadText()
      .then((text) => {
        if (!alive) return;
        const dirty = md.render(text);
        const clean = DOMPurify.sanitize(dirty); // strip script/handlers
        setS({ t: "ok", html: clean });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source.path]);

  if (s.t === "err") throw new Error("read_text falhou");
  if (s.t === "load") return <div className="status">Lendo…</div>;
  return (
    <div
      className="view view-md"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: s.html }}
    />
  );
}
