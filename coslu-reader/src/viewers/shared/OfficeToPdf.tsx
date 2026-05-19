// Infra compartilhada (PPTX/DOCX/…): tenta Office→PDF via LibreOffice
// no Rust (processo separado, §13; IPC bytes crus) e REUSA o PdfViewer
// endurecido → fidelidade real. Sem path (dentro de zip), sem conversor
// instalado ou falha → renderiza o Fallback (Tier-A da família).

import { useEffect, useState, type ComponentType } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Source, ViewerProps } from "../types";
import { memSource } from "../../source";
import PdfViewer from "../families/pdf/PdfViewer";

type S = { t: "probe" } | { t: "pdf"; src: Source } | { t: "fallback" };

export function OfficeToPdf({
  source,
  label,
  Fallback,
}: {
  source: Source;
  label: string;
  Fallback: ComponentType<ViewerProps>;
}) {
  const [s, setS] = useState<S>({ t: "probe" });

  useEffect(() => {
    let alive = true;
    const path = source.path;
    if (!path) {
      setS({ t: "fallback" }); // entrada de container: sem arquivo no fs
      return;
    }
    invoke<ArrayBuffer>("office_to_pdf", { path })
      .then((buf) => {
        if (!alive) return;
        setS({
          t: "pdf",
          src: memSource(
            `${source.name}.pdf`,
            new Uint8Array(buf),
            source.depth,
          ),
        });
      })
      .catch(() => alive && setS({ t: "fallback" }));
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "probe")
    return (
      <div className="status">
        Convertendo {label} para PDF (LibreOffice)…
      </div>
    );
  if (s.t === "pdf") return <PdfViewer source={s.src} />;
  return <Fallback source={source} />;
}
