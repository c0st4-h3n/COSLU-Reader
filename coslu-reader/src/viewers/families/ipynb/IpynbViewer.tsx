// Família Notebook — Jupyter .ipynb. Código com SYNTAX HIGHLIGHT
// (Shiki lazy compartilhado). Markdown via safeMarkdown. §13:
// JSON.parse com reviver anti-__proto__; markdown/HTML de saída
// SEMPRE saneados (DOMPurify); imagens só via data:; Shiki = markup
// determinístico do texto do código (seguro). JSON inválido → throw
// → fallback chain (texto → hex), como as demais famílias.

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import type { ViewerProps } from "../../types";
import { renderSafeMarkdown } from "../../shared/safeMarkdown";
import { highlight } from "../../shared/highlight";

const UNSAFE = new Set(["__proto__", "constructor", "prototype"]);
const reviver = (k: string, v: unknown) => (UNSAFE.has(k) ? undefined : v);

type Any = Record<string, unknown>;
const join = (s: unknown): string =>
  Array.isArray(s) ? s.join("") : typeof s === "string" ? s : "";
// remove SGR ANSI inteiro (ESC opcional + CSI … m) — limpa tracebacks
const ANSI = new RegExp(String.fromCharCode(27) + "?\\[[0-9;]*m", "g");
const stripAnsi = (s: string) => s.replace(ANSI, "");

function OutputView({ o }: { o: Any }) {
  const type = o.output_type as string;
  if (type === "stream")
    return <pre className="nb-out">{stripAnsi(join(o.text))}</pre>;
  if (type === "error")
    return (
      <pre className="nb-out nb-err">
        {stripAnsi((o.traceback as string[] | undefined)?.join("\n") ?? "")}
      </pre>
    );
  if (type === "execute_result" || type === "display_data") {
    const data = (o.data as Any) ?? {};
    const png = data["image/png"];
    const jpg = data["image/jpeg"];
    if (typeof png === "string")
      return <img className="nb-img" src={`data:image/png;base64,${png}`} alt="" />;
    if (typeof jpg === "string")
      return <img className="nb-img" src={`data:image/jpeg;base64,${jpg}`} alt="" />;
    if (data["text/html"])
      return (
        <div
          className="nb-html"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(join(data["text/html"])),
          }}
        />
      );
    if (data["text/markdown"])
      return (
        <div
          className="nb-html"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: renderSafeMarkdown(join(data["text/markdown"])),
          }}
        />
      );
    return <pre className="nb-out">{join(data["text/plain"])}</pre>;
  }
  return null;
}

type Cell =
  | { kind: "md"; html: string }
  | { kind: "code"; n: number | null; codeHtml: string; outputs: Any[] }
  | { kind: "raw"; text: string };

type State = { t: "load" } | { t: "ok"; cells: Cell[] } | { t: "err" };

export default function IpynbViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadText()
      .then(async (raw) => {
        const nb = JSON.parse(raw, reviver) as Any;
        const meta = (nb.metadata as Any) ?? {};
        const lang =
          ((meta.language_info as Any)?.name as string) ||
          ((meta.kernelspec as Any)?.language as string) ||
          "python";
        const src = (nb.cells as Any[]) ?? [];
        const cells: Cell[] = await Promise.all(
          src.map(async (c): Promise<Cell> => {
            const type = c.cell_type as string;
            if (type === "markdown")
              return { kind: "md", html: renderSafeMarkdown(join(c.source)) };
            if (type === "code")
              return {
                kind: "code",
                n: (c.execution_count as number | null) ?? null,
                codeHtml: await highlight(join(c.source), lang),
                outputs: (c.outputs as Any[]) ?? [],
              };
            return { kind: "raw", text: join(c.source) };
          }),
        );
        if (alive) setS({ t: "ok", cells });
      })
      .catch((e) => {
        console.error("[ipynb]", e);
        if (alive) setS({ t: "err" });
      });
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "err") throw new Error("ipynb inválido");
  if (s.t === "load")
    return <div className="status">Lendo notebook…</div>;

  return (
    <div className="view view-ipynb">
      {s.cells.map((c, i) => {
        if (c.kind === "md")
          return (
            <div
              key={i}
              className="nb-md"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: c.html }}
            />
          );
        if (c.kind === "code")
          return (
            <div key={i} className="nb-cell">
              <div className="nb-in">In [{c.n ?? " "}]</div>
              <div
                className="nb-code"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: c.codeHtml }}
              />
              {c.outputs.map((o, j) => (
                <OutputView key={j} o={o} />
              ))}
            </div>
          );
        return (
          <pre key={i} className="nb-raw">
            {c.text}
          </pre>
        );
      })}
    </div>
  );
}
