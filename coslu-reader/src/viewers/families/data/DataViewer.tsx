// Família Dados (skeleton: JSON em árvore colapsável, hand-rolled, ~0 lib).
// Reviver remove __proto__/constructor/prototype (hábito anti prototype
// pollution, §13). Se o JSON.parse falhar, lança → fallback para texto.

import { useEffect, useMemo, useState } from "react";
import type { ViewerProps } from "../../types";

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const safeReviver = (key: string, value: unknown) =>
  UNSAFE.has(key) ? undefined : value;

function JsonNode({ k, v, depth }: { k?: string; v: unknown; depth: number }) {
  const isObj = v !== null && typeof v === "object";
  const [open, setOpen] = useState(depth < 2);

  if (!isObj) {
    return (
      <div className="json-row" style={{ paddingLeft: depth * 14 }}>
        {k !== undefined && <span className="json-key">{k}: </span>}
        <span className={`json-val json-${v === null ? "null" : typeof v}`}>
          {typeof v === "string" ? `"${v}"` : String(v)}
        </span>
      </div>
    );
  }

  const entries = Array.isArray(v)
    ? v.map((item, i) => [String(i), item] as const)
    : Object.entries(v as Record<string, unknown>);
  const brace = Array.isArray(v) ? "[]" : "{}";

  return (
    <div>
      <div
        className="json-row json-toggle"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="json-caret">{open ? "▾" : "▸"}</span>
        {k !== undefined && <span className="json-key">{k}: </span>}
        <span className="json-meta">
          {brace[0]}
          {open ? "" : `…${entries.length}`}
          {open ? "" : brace[1]}
        </span>
      </div>
      {open &&
        entries.map(([ck, cv]) => (
          <JsonNode key={ck} k={ck} v={cv} depth={depth + 1} />
        ))}
      {open && (
        <div className="json-row" style={{ paddingLeft: depth * 14 }}>
          {brace[1]}
        </div>
      )}
    </div>
  );
}

type State = { t: "load" } | { t: "ok"; raw: string } | { t: "err" };

export default function DataViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadText()
      .then((raw) => alive && setS({ t: "ok", raw }))
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source.path]);

  const parsed = useMemo(() => {
    if (s.t !== "ok") return undefined;
    return JSON.parse(s.raw, safeReviver) as unknown;
  }, [s]);

  if (s.t === "err") throw new Error("read_text falhou");
  if (s.t === "load") return <div className="status">Lendo…</div>;
  // JSON.parse lança em entrada inválida → ErrorBoundary cai para texto.
  return (
    <div className="view view-json">
      <JsonNode v={parsed} depth={0} />
    </div>
  );
}
