// Família Fonte — specimen via FontFace API (0 lib). Carrega a fonte
// de um blob e renderiza amostras em vários tamanhos. Fonte inválida
// → throw → fallback chain (texto → hex).

import { useEffect, useState } from "react";
import type { ViewerProps } from "../../types";

const SAMPLE = "COSLU LABZ — visualizador universal";
const PANGRAM =
  "À noite, vovô Kowalski vê o ímã cair; faz veloz juramentos.";
const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &@#%(){}[] áàâãéêíóôõúç";
const SIZES = [12, 16, 20, 28, 40, 64];

type State = { t: "load" } | { t: "ok"; fam: string } | { t: "err" };

export default function FontViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    let face: FontFace | null = null;
    const fam = `coslu-font-${Math.random().toString(36).slice(2, 8)}`;
    source
      .loadBytes()
      .then(async (bytes) => {
        url = URL.createObjectURL(new Blob([bytes]));
        face = new FontFace(fam, `url(${url})`);
        await face.load();
        if (!alive) return;
        document.fonts.add(face);
        setS({ t: "ok", fam });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
      if (face) {
        try {
          document.fonts.delete(face);
        } catch {
          /* noop */
        }
      }
      if (url) URL.revokeObjectURL(url);
    };
  }, [source]);

  if (s.t === "err") throw new Error("fonte inválida");
  if (s.t === "load")
    return <div className="status">Carregando fonte…</div>;

  const ff = `"${s.fam}", serif`;
  return (
    <div className="view view-font">
      <div className="font-hero" style={{ fontFamily: ff }}>
        {SAMPLE}
      </div>
      <div className="font-line" style={{ fontFamily: ff }}>
        {GLYPHS}
      </div>
      <div className="font-pangram" style={{ fontFamily: ff }}>
        {PANGRAM}
      </div>
      <div className="font-sizes">
        {SIZES.map((px) => (
          <div key={px} className="font-size-row">
            <span className="font-size-tag">{px}px</span>
            <span style={{ fontFamily: ff, fontSize: px }}>{SAMPLE}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
