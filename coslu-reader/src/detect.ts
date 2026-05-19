// Detecção de família no frontend — espelha io::detect do Rust.
// Necessária para entradas DENTRO de um container (sem path no fs):
// extensão primeiro, depois sniff texto-vs-binário sobre os bytes.

import type { Kind } from "./viewers/types";

const EXT: Record<string, Kind> = {
  md: "markdown", markdown: "markdown", mdown: "markdown",
  mkd: "markdown", mkdn: "markdown",
  json: "data", jsonl: "data", ndjson: "data", jsonc: "data", json5: "data",
  ipynb: "ipynb",
  csv: "table", tsv: "table", psv: "table", parquet: "table",
  arrow: "table", feather: "table", ipc: "table",
  ttf: "font", otf: "font", woff: "font", woff2: "font", ttc: "font",
  pdf: "pdf",
  pptx: "pptx", pptm: "pptx",
  docx: "docx", docm: "docx", odt: "docx",
  epub: "epub",
  glb: "threed", gltf: "threed", stl: "threed", obj: "threed",
  ply: "threed",
  wasm: "binary", exe: "binary", dll: "binary", so: "binary",
  elf: "binary", class: "binary", dylib: "binary", pyc: "binary",
  sqlite: "database", sqlite3: "database", db: "database",
  xlsx: "spreadsheet", xlsm: "spreadsheet", xls: "spreadsheet",
  ods: "spreadsheet",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  avif: "image", bmp: "image", ico: "image", apng: "image", svg: "image",
  psd: "image", psb: "image",
  zip: "archive", jar: "archive", war: "archive", apk: "archive",
  tar: "archive", gz: "archive", tgz: "archive",
  mp3: "media", wav: "media", flac: "media", ogg: "media", oga: "media",
  opus: "media", aac: "media", m4a: "media", mp4: "media", m4v: "media",
  webm: "media", mkv: "media", mov: "media", avi: "media",
  txt: "text", log: "text", diff: "text", patch: "text", ini: "text",
  toml: "text", yaml: "text", yml: "text", xml: "text", html: "text",
  htm: "text", css: "text", js: "text", ts: "text", tsx: "text",
  jsx: "text", rs: "text", py: "text", go: "text", c: "text", h: "text",
  cpp: "text", java: "text", rb: "text", php: "text", sh: "text", sql: "text",
};

// magic-bytes de binários estruturados (espelha is_structured_binary)
function isStructuredBinary(b: Uint8Array): boolean {
  if (b.length < 4) return false;
  const [a, c, d, e] = b;
  return (
    (a === 0x7f && c === 0x45 && d === 0x4c && e === 0x46) || // ELF
    (a === 0x00 && c === 0x61 && d === 0x73 && e === 0x6d) || // wasm
    (a === 0xca && c === 0xfe && d === 0xba && e === 0xbe) || // class/macho-fat
    (a === 0xfe && c === 0xed && d === 0xfa) || // mach-o
    (a === 0xcf && c === 0xfa && d === 0xed) ||
    (a === 0xce && c === 0xfa && d === 0xed) ||
    (a === 0x4d && c === 0x5a) // PE "MZ"
  );
}

function looksTextual(s: Uint8Array): boolean {
  if (s.length === 0) return true;
  if (s.includes(0)) return false;
  let bad = 0;
  for (const b of s) if (b < 9 || (b > 13 && b < 32)) bad++;
  return bad * 100 < s.length * 5;
}

export function detectKind(name: string, sample?: Uint8Array): Kind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const k = EXT[ext];
  if (k) return k;
  if (sample) {
    if (isStructuredBinary(sample)) return "binary";
    return looksTextual(sample.subarray(0, 8192)) ? "text" : "hex";
  }
  return "hex";
}
