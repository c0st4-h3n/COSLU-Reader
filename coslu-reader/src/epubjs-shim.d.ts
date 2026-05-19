// Tipos mínimos para epubjs 0.3 (sem @types oficial). Só o que usamos.
declare module "epubjs" {
  export interface Rendition {
    display(target?: string): Promise<void>;
    next(): Promise<void>;
    prev(): Promise<void>;
    resize(): void;
    destroy(): void;
    on(event: string, cb: (...args: unknown[]) => void): void;
  }
  export interface NavItem {
    label: string;
    href: string;
  }
  export interface Book {
    renderTo(
      el: Element | string,
      opts?: Record<string, unknown>,
    ): Rendition;
    loaded: { navigation: Promise<{ toc: NavItem[] }> };
    ready: Promise<unknown>;
    destroy(): void;
  }
  export default function ePub(
    input: ArrayBuffer | string,
    opts?: Record<string, unknown>,
  ): Book;
}
