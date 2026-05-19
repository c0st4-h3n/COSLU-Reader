// Lê o boot global injetado pelo Rust antes dos scripts da página
// (§3.2). Fallback: command get_opened_file (zero-trust no global).

import { invoke } from "@tauri-apps/api/core";
import type { Kind } from "./viewers/types";

export interface OpenedFile {
  path: string;
  name: string;
  kind: Kind;
}

declare global {
  interface Window {
    __COSLU_BOOT__?: OpenedFile | null;
  }
}

export async function resolveBoot(): Promise<OpenedFile | null> {
  const b = window.__COSLU_BOOT__;
  if (b && b.path) return b;
  try {
    return await invoke<OpenedFile | null>("get_opened_file");
  } catch {
    return null;
  }
}
