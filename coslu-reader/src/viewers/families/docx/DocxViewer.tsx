// Família Documento. Default = dispatcher compartilhado: DOCX→PDF via
// LibreOffice (fidelidade real, reusa PdfViewer). Fallback Tier-A:
// extração OOXML leve de word/document.xml (w:p/w:t + estilo de
// heading). §13: só textContent, DOMParser application/xml, sem
// innerHTML. (Supera o debate §2.4 mammoth-vs-docx-preview.)

import { useEffect, useState } from "react";
import { unzipSync } from "fflate";
import type { ViewerProps } from "../../types";
import { OfficeToPdf } from "../../shared/OfficeToPdf";

export default function DocxViewer({ source }: ViewerProps) {
  return (
    <OfficeToPdf source={source} label="documento" Fallback={DocxTierA} />
  );
}

interface Para {
  tag: "h1" | "h2" | "h3" | "p";
  text: string;
}

function styleToTag(style: string): Para["tag"] {
  const s = style.toLowerCase();
  if (s.includes("title") || s === "heading1" || s.includes("heading 1"))
    return "h1";
  if (s.includes("heading2") || s.includes("heading 2")) return "h2";
  if (s.includes("heading")) return "h3";
  return "p";
}

type State = { t: "load" } | { t: "ok"; paras: Para[] } | { t: "err" };

function DocxTierA({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadBytes()
      .then((bytes) => {
        if (!alive) return;
        const zip = unzipSync(bytes);
        const doc = zip["word/document.xml"];
        if (!doc) throw new Error("não é DOCX");
        const xml = new DOMParser().parseFromString(
          new TextDecoder().decode(doc),
          "application/xml",
        );
        const ps = xml.getElementsByTagName("w:p");
        const paras: Para[] = [];
        for (let i = 0; i < ps.length; i++) {
          const st = ps[i].getElementsByTagName("w:pStyle")[0];
          const tag = styleToTag(st?.getAttribute("w:val") ?? "");
          const ts = ps[i].getElementsByTagName("w:t");
          let txt = "";
          for (let j = 0; j < ts.length; j++) txt += ts[j].textContent ?? "";
          if (txt.trim()) paras.push({ tag, text: txt });
        }
        if (paras.length === 0) throw new Error("documento vazio");
        setS({ t: "ok", paras });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "err") throw new Error("DOCX inválido");
  if (s.t === "load")
    return <div className="status">Lendo documento…</div>;

  return (
    <div className="view view-doc">
      <div className="status">
        Tier A (sem conversor) — texto sem layout
      </div>
      {s.paras.map((p, i) => {
        if (p.tag === "h1") return <h1 key={i}>{p.text}</h1>;
        if (p.tag === "h2") return <h2 key={i}>{p.text}</h2>;
        if (p.tag === "h3") return <h3 key={i}>{p.text}</h3>;
        return <p key={i}>{p.text}</p>;
      })}
    </div>
  );
}
