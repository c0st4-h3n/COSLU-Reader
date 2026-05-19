// Família Slides. Default = dispatcher compartilhado: converte
// PPTX→PDF via LibreOffice (fidelidade real, reusa PdfViewer) e cai
// no Tier-A (extração OOXML: ordem/título/bullets/imagens/notas, §2)
// quando não há conversor / sem path (dentro de zip) / falha.

import { useEffect, useRef, useState } from "react";
import { unzipSync } from "fflate";
import type { ViewerProps } from "../../types";
import { OfficeToPdf } from "../../shared/OfficeToPdf";

export default function PptxViewer({ source }: ViewerProps) {
  return (
    <OfficeToPdf source={source} label="apresentação" Fallback={PptxTierA} />
  );
}

/* ─────────────── Tier-A: extração OOXML (fallback) ───────────── */

interface Block {
  lvl: number;
  text: string;
}
interface SlideModel {
  title?: string;
  blocks: Block[];
  images: string[];
  notes?: string;
}

const IMG_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
  svg: "image/svg+xml",
};

function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/");
  parts.pop();
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}
function relsPathFor(part: string): string {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels${part.slice(i)}.rels`;
}

type Zip = Record<string, Uint8Array>;

function parseRels(zip: Zip, part: string, dp: DOMParser) {
  const m = new Map<string, { type: string; path: string }>();
  const rp = relsPathFor(part);
  if (!zip[rp]) return m;
  const doc = dp.parseFromString(
    new TextDecoder().decode(zip[rp]),
    "application/xml",
  );
  const rels = doc.getElementsByTagName("Relationship");
  for (let i = 0; i < rels.length; i++) {
    const id = rels[i].getAttribute("Id");
    if (id)
      m.set(id, {
        type: rels[i].getAttribute("Type") ?? "",
        path: resolvePath(part, rels[i].getAttribute("Target") ?? ""),
      });
  }
  return m;
}

function textOfTxBody(sp: Element): Block[] {
  const out: Block[] = [];
  const ps = sp.getElementsByTagName("a:p");
  for (let i = 0; i < ps.length; i++) {
    const pr = ps[i].getElementsByTagName("a:pPr")[0];
    const lvl = pr ? Number(pr.getAttribute("lvl") ?? "0") : 0;
    const ts = ps[i].getElementsByTagName("a:t");
    let txt = "";
    for (let j = 0; j < ts.length; j++) txt += ts[j].textContent ?? "";
    if (txt.trim()) out.push({ lvl, text: txt });
  }
  return out;
}

function buildSlide(
  zip: Zip,
  path: string,
  dp: DOMParser,
  urls: string[],
): SlideModel {
  const doc = dp.parseFromString(
    new TextDecoder().decode(zip[path]),
    "application/xml",
  );
  const rels = parseRels(zip, path, dp);

  let title: string | undefined;
  const blocks: Block[] = [];
  const sps = doc.getElementsByTagName("p:sp");
  for (let i = 0; i < sps.length; i++) {
    const ph = sps[i].getElementsByTagName("p:ph")[0];
    const phType = ph?.getAttribute("type") ?? "";
    const tb = textOfTxBody(sps[i]);
    if (!title && (phType === "title" || phType === "ctrTitle"))
      title = tb.map((b) => b.text).join(" ");
    else blocks.push(...tb);
  }
  if (!title && blocks.length) title = blocks.shift()!.text;

  const images: string[] = [];
  const blips = doc.getElementsByTagName("a:blip");
  for (let i = 0; i < blips.length; i++) {
    const rid =
      blips[i].getAttribute("r:embed") ?? blips[i].getAttribute("r:link");
    const r = rid && rels.get(rid);
    if (!r) continue;
    const ext = r.path.split(".").pop()?.toLowerCase() ?? "";
    const mime = IMG_MIME[ext];
    if (mime && zip[r.path]) {
      const u = URL.createObjectURL(new Blob([zip[r.path]], { type: mime }));
      urls.push(u);
      images.push(u);
    }
  }

  let notes: string | undefined;
  for (const { type, path: np } of rels.values()) {
    if (type.endsWith("notesSlide") && zip[np]) {
      const nd = dp.parseFromString(
        new TextDecoder().decode(zip[np]),
        "application/xml",
      );
      const ts = nd.getElementsByTagName("a:t");
      let t = "";
      for (let j = 0; j < ts.length; j++) t += `${ts[j].textContent ?? ""} `;
      if (t.trim()) notes = t.trim();
      break;
    }
  }
  return { title, blocks, images, notes };
}

function slideOrder(zip: Zip, dp: DOMParser): string[] {
  const pres = "ppt/presentation.xml";
  if (zip[pres]) {
    const doc = dp.parseFromString(
      new TextDecoder().decode(zip[pres]),
      "application/xml",
    );
    const rels = parseRels(zip, pres, dp);
    const ids = doc.getElementsByTagName("p:sldId");
    const ordered: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const rid = ids[i].getAttribute("r:id");
      const r = rid && rels.get(rid);
      if (r && zip[r.path]) ordered.push(r.path);
    }
    if (ordered.length) return ordered;
  }
  return Object.keys(zip)
    .map((k) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(k))
    .filter((m): m is RegExpExecArray => !!m)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((m) => m[0]);
}

type AState =
  | { t: "load" }
  | { t: "ok"; slides: SlideModel[] }
  | { t: "err" };

function PptxTierA({ source }: ViewerProps) {
  const [s, setS] = useState<AState>({ t: "load" });
  const [idx, setIdx] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    let alive = true;
    source
      .loadBytes()
      .then((bytes) => {
        if (!alive) return;
        const zip = unzipSync(bytes);
        const dp = new DOMParser();
        const order = slideOrder(zip, dp);
        if (order.length === 0) throw new Error("sem slides");
        setS({
          t: "ok",
          slides: order.map((p) => buildSlide(zip, p, dp, urls.current)),
        });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
  }, [source]);

  if (s.t === "err") throw new Error("PPTX inválido");
  if (s.t === "load")
    return <div className="status">Lendo apresentação…</div>;

  const n = s.slides.length;
  const cur = s.slides[Math.min(idx, n - 1)];
  const go = (delta: number) =>
    setIdx((i) => Math.max(0, Math.min(n - 1, i + delta)));

  return (
    <div className="view view-pptx">
      <div className="archive-bar">
        <button className="archive-back" onClick={() => go(-1)}>
          ‹ ant
        </button>
        <span className="crumb">
          slide {Math.min(idx, n - 1) + 1} / {n} · Tier A (sem conversor)
        </span>
        <button className="archive-back" onClick={() => go(1)}>
          próx ›
        </button>
        <select
          className="db-select"
          value={Math.min(idx, n - 1)}
          onChange={(e) => setIdx(Number(e.target.value))}
        >
          {s.slides.map((sl, i) => (
            <option key={i} value={i}>
              {i + 1}. {sl.title ? sl.title.slice(0, 40) : "(sem título)"}
            </option>
          ))}
        </select>
        {cur.notes && (
          <button
            className="archive-back"
            onClick={() => setShowNotes((v) => !v)}
          >
            {showNotes ? "ocultar notas" : "notas"}
          </button>
        )}
      </div>

      <div className="slide-frame">
        <div className="slide-16x9">
          {cur.title && <h2 className="slide-title">{cur.title}</h2>}
          {cur.blocks.map((b, i) => (
            <p
              key={i}
              className="slide-bullet"
              style={{ marginLeft: b.lvl * 22 }}
            >
              <span className="slide-dot">{b.lvl > 0 ? "–" : "▪"}</span>
              {b.text}
            </p>
          ))}
          {cur.images.length > 0 && (
            <div className="slide-imgs">
              {cur.images.map((u, i) => (
                <img key={i} src={u} alt="" />
              ))}
            </div>
          )}
          {!cur.title && cur.blocks.length === 0 && (
            <p className="slide-empty">— slide sem texto —</p>
          )}
        </div>
      </div>

      {showNotes && cur.notes && (
        <div className="slide-notes">
          <div className="slide-n">notas do apresentador</div>
          {cur.notes}
        </div>
      )}
    </div>
  );
}
