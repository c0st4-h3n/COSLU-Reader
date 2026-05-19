// Família Arquivo/container — ZIP (fflate) + TAR (parser fino) +
// GZIP/TGZ (gunzip → tar ou arquivo único). Lista entradas e ROTEIA
// cada uma pelo mesmo router (recursivo). Anti zip-bomb: ZIP não
// descompacta na listagem; GZIP conta os bytes descompactados no
// budget cumulativo. zip-slip n/a (nunca extrai pro disco).

import { useEffect, useRef, useState } from "react";
import { unzipSync, gunzipSync } from "fflate";
import type { ViewerProps, Kind, Source } from "../../types";
import { memSource, budget, MAX_DEPTH } from "../../../source";
import { detectKind } from "../../../detect";
import { ViewerHost } from "../../../router/ViewerHost";

interface Entry {
  name: string;
  size: number;
  orig: number;
}
type Container = { entries: Entry[]; read: (n: string) => Uint8Array | null };
type Open =
  | { ok: true; c: Container }
  | { ok: false; msg: string }
  | null; // null = não é container → fallback

const MAX_ENTRIES = 5000;
const RATIO = 1000;
const BIG = 10 * 1024 * 1024;

function cstr(b: Uint8Array, o: number, n: number): string {
  let s = "";
  for (let i = o; i < o + n && b[i]; i++) s += String.fromCharCode(b[i]);
  return s;
}
function octal(b: Uint8Array, o: number, n: number): number {
  return parseInt(cstr(b, o, n).trim() || "0", 8) || 0;
}
function isTar(b: Uint8Array): boolean {
  return (
    b.length >= 263 &&
    String.fromCharCode(b[257], b[258], b[259], b[260], b[261]) === "ustar"
  );
}

function tarContainer(buf: Uint8Array): Container {
  const entries: Entry[] = [];
  const idx = new Map<string, { o: number; s: number }>();
  let o = 0;
  while (o + 512 <= buf.length && entries.length < MAX_ENTRIES) {
    let zero = true;
    for (let i = 0; i < 512; i++)
      if (buf[o + i] !== 0) {
        zero = false;
        break;
      }
    if (zero) break;
    let name = cstr(buf, o, 100);
    const size = octal(buf, o + 124, 12);
    const type = String.fromCharCode(buf[o + 156] || 48);
    const prefix = cstr(buf, o + 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    const data = o + 512;
    if ((type === "0" || type === "\0") && name && !name.endsWith("/")) {
      entries.push({ name, size, orig: size });
      idx.set(name, { o: data, s: size });
    }
    o = data + Math.ceil(size / 512) * 512;
  }
  return {
    entries,
    read: (n) => {
      const e = idx.get(n);
      return e ? buf.subarray(e.o, e.o + e.s) : null;
    },
  };
}

function zipContainer(bytes: Uint8Array): Container | null {
  const entries: Entry[] = [];
  try {
    unzipSync(bytes, {
      filter: (f) => {
        if (entries.length < MAX_ENTRIES && !f.name.endsWith("/"))
          entries.push({
            name: f.name,
            size: f.size,
            orig: f.originalSize,
          });
        return false;
      },
    });
  } catch {
    return null;
  }
  if (!entries.length) return null;
  return {
    entries,
    read: (n) => {
      try {
        return unzipSync(bytes, { filter: (f) => f.name === n })[n] ?? null;
      } catch {
        return null;
      }
    },
  };
}

function openContainer(bytes: Uint8Array, name: string): Open {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    let dec: Uint8Array;
    try {
      dec = gunzipSync(bytes);
    } catch {
      return null;
    }
    if (dec.length > budget.remaining)
      return { ok: false, msg: "Orçamento de descompressão esgotado (gzip)." };
    budget.remaining -= dec.length;
    if (isTar(dec)) return { ok: true, c: tarContainer(dec) };
    const base = name.replace(/\.(gz|tgz)$/i, "") || "arquivo";
    const nm = /\.tgz$/i.test(name) ? `${base}.tar` : base;
    return {
      ok: true,
      c: { entries: [{ name: nm, size: dec.length, orig: dec.length }], read: (n) => (n === nm ? dec : null) },
    };
  }
  if (isTar(bytes)) return { ok: true, c: tarContainer(bytes) };
  const z = zipContainer(bytes);
  return z ? { ok: true, c: z } : null;
}

type State =
  | { t: "load" }
  | { t: "list"; entries: Entry[] }
  | { t: "err" }
  | { t: "open"; name: string; src: Source; kind: Kind }
  | { t: "blocked"; msg: string };

export default function ArchiveViewer({ source }: ViewerProps) {
  const cRef = useRef<Container | null>(null);
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadBytes()
      .then((bytes) => {
        if (!alive) return;
        const r = openContainer(bytes, source.name);
        if (r === null) return setS({ t: "err" });
        if (!r.ok) return setS({ t: "blocked", msg: r.msg });
        cRef.current = r.c;
        setS(
          r.c.entries.length
            ? { t: "list", entries: r.c.entries }
            : { t: "err" },
        );
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source]);

  function back() {
    const c = cRef.current;
    setS(c ? { t: "list", entries: c.entries } : { t: "err" });
  }

  function open(e: Entry) {
    const c = cRef.current;
    if (!c) return;
    if (source.depth + 1 > MAX_DEPTH)
      return setS({
        t: "blocked",
        msg: `Profundidade máxima de container (${MAX_DEPTH}) atingida.`,
      });
    if (e.size > 0 && e.orig / e.size > RATIO && e.orig > BIG)
      return setS({
        t: "blocked",
        msg: "Razão de compressão suspeita — entrada bloqueada (anti zip-bomb).",
      });
    const bytes = c.read(e.name);
    if (!bytes)
      return setS({ t: "blocked", msg: "Falha ao ler a entrada." });
    const base = e.name.split("/").pop() || e.name;
    setS({
      t: "open",
      name: e.name,
      src: memSource(base, bytes, source.depth + 1),
      kind: detectKind(base, bytes.subarray(0, 8192)),
    });
  }

  if (s.t === "err") throw new Error("não é um container válido");
  if (s.t === "load")
    return <div className="status">Lendo container…</div>;

  if (s.t === "open" || s.t === "blocked")
    return (
      <div className="archive-open">
        <div className="archive-bar">
          <button className="archive-back" onClick={back}>
            ← voltar
          </button>
          <span className="crumb">
            {source.name}
            {s.t === "open" ? ` › ${s.name}` : ""}
          </span>
        </div>
        {s.t === "open" ? (
          <div className="archive-child">
            <ViewerHost key={s.name} source={s.src} kind={s.kind} />
          </div>
        ) : (
          <div className="status">{s.msg}</div>
        )}
      </div>
    );

  return (
    <div className="view view-archive">
      <div className="status">
        {s.entries.length} entrada(s) · profundidade {source.depth} · clique
        em “abrir” — roteado como arquivo normal (recursivo)
      </div>
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>nome</th>
              <th>compactado</th>
              <th>original</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {s.entries.map((e) => (
              <tr key={e.name}>
                <td>{e.name}</td>
                <td className="rownum">{e.size}</td>
                <td className="rownum">{e.orig}</td>
                <td>
                  <button
                    className="archive-open-btn"
                    onClick={() => open(e)}
                  >
                    abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
