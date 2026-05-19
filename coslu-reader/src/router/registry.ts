// Tabela família → chunk lazy (Vite emite um arquivo por import()).
// O entry não carrega nenhum viewer; só o da família detectada (§3.3).

import type { Kind, FamilyModule } from "../viewers/types";

export const registry: Record<Kind, () => Promise<FamilyModule>> = {
  text: () => import("../viewers/families/text/TextViewer"),
  markdown: () => import("../viewers/families/markdown/MarkdownViewer"),
  data: () => import("../viewers/families/data/DataViewer"),
  ipynb: () => import("../viewers/families/ipynb/IpynbViewer"),
  table: () => import("../viewers/families/table/TableViewer"),
  database: () => import("../viewers/families/database/DatabaseViewer"),
  spreadsheet: () =>
    import("../viewers/families/spreadsheet/SpreadsheetViewer"),
  image: () => import("../viewers/families/image/ImageViewer"),
  media: () => import("../viewers/families/media/MediaViewer"),
  font: () => import("../viewers/families/font/FontViewer"),
  pdf: () => import("../viewers/families/pdf/PdfViewer"),
  pptx: () => import("../viewers/families/pptx/PptxViewer"),
  docx: () => import("../viewers/families/docx/DocxViewer"),
  epub: () => import("../viewers/families/epub/EpubViewer"),
  threed: () => import("../viewers/families/threed/ThreeViewer"),
  binary: () => import("../viewers/families/binary/BinaryViewer"),
  archive: () => import("../viewers/families/archive/ArchiveViewer"),
  hex: () => import("../viewers/families/hex/HexViewer"),
};

// Fallback chain (§5.4): família detectada → texto best-effort → hex.
// `hex` é a garantia universal: sempre o último e nunca lança.
export function fallbackChain(kind: Kind): Kind[] {
  const chain: Kind[] = [kind, "text", "hex"];
  return chain.filter((k, i) => chain.indexOf(k) === i);
}
