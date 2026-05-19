// Família Hex — a GARANTIA UNIVERSAL (§5.4): abre literalmente qualquer
// coisa e NUNCA lança (é o fim da fallback chain). Se nem ler der, mostra
// uma mensagem amigável em vez de propagar erro.

import { useEffect, useState } from "react";
import type { ViewerProps } from "../../types";

// Cap do skeleton; virtualização + range-read entram depois (§9).
const MAX = 256 * 1024;

function dump(bytes: Uint8Array): string {
  const lines: string[] = [];
  for (let off = 0; off < bytes.length; off += 16) {
    const slice = bytes.subarray(off, off + 16);
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(16 * 3 - 1, " ");
    const ascii = Array.from(slice)
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
      .join("");
    lines.push(`${off.toString(16).padStart(8, "0")}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

type State =
  | { t: "load" }
  | { t: "ok"; text: string; truncated: boolean }
  | { t: "err"; msg: string };

export default function HexViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadBytes()
      .then((all) => {
        if (!alive) return;
        const truncated = all.length > MAX;
        setS({ t: "ok", text: dump(all.subarray(0, MAX)), truncated });
      })
      .catch((e) => alive && setS({ t: "err", msg: String(e) }));
    return () => {
      alive = false;
    };
  }, [source.path]);

  if (s.t === "load") return <div className="status">Lendo…</div>;
  if (s.t === "err")
    return <div className="status">Não foi possível ler o arquivo: {s.msg}</div>;
  return (
    <div className="view view-hex">
      {s.truncated && (
        <div className="status">
          Mostrando os primeiros {MAX / 1024} KB (virtualização vem depois).
        </div>
      )}
      <pre>{s.text}</pre>
    </div>
  );
}
