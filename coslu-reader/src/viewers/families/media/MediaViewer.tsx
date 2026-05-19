// Família Mídia A/V — player nativo <audio>/<video> (bytes → Blob →
// object URL). §5.3: codecs limitados ao WebView2 — se o elemento
// falhar (ex.: MKV/AVI), degrada para um card Tier-B com metadados,
// nunca tela preta nem erro. Falha de LEITURA → fallback chain.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ViewerProps } from "../../types";
import { MediaControls } from "./MediaControls";

const VIDEO = new Set(["mp4", "m4v", "webm", "mkv", "mov", "avi"]);
const MIME: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac",
  ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg",
  aac: "audio/aac", m4a: "audio/mp4",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm",
  mkv: "video/x-matroska", mov: "video/quicktime", avi: "video/x-msvideo",
};

function human(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

type State =
  | { t: "load" }
  | { t: "ok"; url: string }
  | { t: "unsupported"; size: number }
  | { t: "err" };

export default function MediaViewer({ source }: ViewerProps) {
  const ext = useMemo(
    () => source.name.split(".").pop()?.toLowerCase() ?? "",
    [source.name],
  );
  const isVideo = VIDEO.has(ext);
  const mime = MIME[ext] ?? "application/octet-stream";
  const [s, setS] = useState<State>({ t: "load" });
  const [size, setSize] = useState(0);
  const elRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    source
      .loadBytes()
      .then((bytes) => {
        if (!alive) return;
        setSize(bytes.length);
        url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        setS({ t: "ok", url });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, mime]);

  if (s.t === "err") throw new Error("read_bytes falhou");
  if (s.t === "load") return <div className="status">Lendo mídia…</div>;

  if (s.t === "unsupported")
    return (
      <div className="view view-media">
        <div className="media-card">
          <div className="media-card-h">Tier B — codec não suportado</div>
          <div className="media-kv">arquivo: {source.name}</div>
          <div className="media-kv">tipo: {mime}</div>
          <div className="media-kv">tamanho: {human(s.size)}</div>
          <div className="media-note">
            O WebView2 não decodifica este formato. Conteúdo preservado;
            metadados acima (hex disponível como fallback).
          </div>
        </div>
      </div>
    );

  const onErr = () => setS({ t: "unsupported", size });
  const setEl = (n: HTMLMediaElement | null) => {
    elRef.current = n;
  };
  return (
    <div className="view view-media">
      <div className="media-stage">
        {isVideo ? (
          <video
            className="media-el"
            ref={setEl}
            src={s.url}
            onError={onErr}
          />
        ) : (
          <div className="media-audio">
            <span className="media-audio-tag">áudio · {source.name}</span>
            <audio ref={setEl} src={s.url} onError={onErr} />
          </div>
        )}
        <MediaControls el={elRef} />
      </div>
    </div>
  );
}
