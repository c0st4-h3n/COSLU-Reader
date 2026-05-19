// Fábricas de Source + limites da recursão de container.
// fsSource: conteúdo do filesystem (boot). memSource: conteúdo já em
// memória (entrada de um zip) — é o que permite o router recursivo.

import { invoke } from "@tauri-apps/api/core";
import type { Source } from "./viewers/types";

export const MAX_DEPTH = 8; // nível máx. de zip-dentro-de-zip
export const BUDGET_BYTES = 256 * 1024 * 1024; // teto cumulativo descompactado

// Budget cumulativo COMPARTILHADO entre níveis de recursão (anti
// amplificação de zip-bomb, §5.1/§13.5). Resetado a cada arquivo do boot.
export const budget = { remaining: BUDGET_BYTES };
export function resetBudget() {
  budget.remaining = BUDGET_BYTES;
}

export function fsSource(path: string, name: string): Source {
  return {
    name,
    path,
    depth: 0,
    loadText: () => invoke<string>("read_text", { path }),
    loadBytes: () =>
      invoke<number[]>("read_bytes", { path }).then((a) => Uint8Array.from(a)),
  };
}

export function memSource(
  name: string,
  bytes: Uint8Array,
  depth: number,
): Source {
  let text: string | null = null;
  return {
    name,
    depth,
    loadBytes: async () => bytes,
    loadText: async () => (text ??= new TextDecoder().decode(bytes)),
  };
}
