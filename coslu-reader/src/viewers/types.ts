// Contrato dos viewers (§6). Source é desacoplado do filesystem:
// o conteúdo pode vir do fs (boot) OU de dentro de um container
// (entrada de zip) — viewers nunca chamam invoke direto.

import type { ComponentType } from "react";

export type Kind =
  | "text"
  | "markdown"
  | "data"
  | "ipynb"
  | "table"
  | "database"
  | "spreadsheet"
  | "image"
  | "media"
  | "font"
  | "pdf"
  | "pptx"
  | "docx"
  | "epub"
  | "threed"
  | "binary"
  | "archive"
  | "hex";

export interface Source {
  name: string;
  path?: string; // presente só p/ fs-backed (boot); ausente em entradas de zip
  depth: number; // nível de aninhamento de container (recursão controlada)
  loadText(): Promise<string>;
  loadBytes(): Promise<Uint8Array>;
}

// Budget cumulativo de bytes descompactados, COMPARTILHADO entre os
// níveis de recursão (anti amplificação de zip-bomb, §5.1/§13.5).
export interface Budget {
  remaining: number;
}

export interface ViewerProps {
  source: Source;
}

export interface FamilyModule {
  default: ComponentType<ViewerProps>;
}
