// Família Imagem — raster web + SVG + PSD. SVG via <img src=blob:>
// (§13: scripts/handlers embutidos não executam). PSD é decodificado
// por um decoder lazy próprio (@webtoon/psd → PNG) — não infla o
// caminho de imagem web. Falha de leitura/decode lança → fallback
// chain (texto → hex).

import { useEffect, useMemo, useState } from "react";
import type { ViewerProps } from "../../types";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  bmp: "image/bmp",
  ico: "image/x-icon",
  apng: "image/apng",
  svg: "image/svg+xml",
};

const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

type State = { t: "load" } | { t: "ok"; url: string } | { t: "err" };

export default function ImageViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });
  const [actual, setActual] = useState(false);
  const ext = useMemo(() => extOf(source.name), [source.name]);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    source
      .loadBytes()
      .then(async (bytes) => {
        if (!alive) return;
        let blob: Blob;
        if (ext === "psd" || ext === "psb") {
          // decoder pesado isolado em chunk lazy (§5.1)
          const { decodePsd } = await import("./decoders/psd");
          blob = await decodePsd(bytes);
        } else {
          blob = new Blob([bytes], {
            type: MIME[ext] ?? "application/octet-stream",
          });
        }
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setS({ t: "ok", url });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, ext]);

  if (s.t === "err") throw new Error("read_bytes/decode falhou");
  if (s.t === "load") return <div className="status">Lendo…</div>;
  return (
    <div className="view view-image">
      <img
        className={actual ? "actual" : "fit"}
        src={s.url}
        alt={source.name}
        onClick={() => setActual((a) => !a)}
        onError={() => setS({ t: "err" })}
      />
    </div>
  );
}
