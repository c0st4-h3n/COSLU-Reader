// Tipos mínimos para o SheetJS vendorizado (não acompanha .d.ts).
declare module "*xlsx.mjs" {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  }
  export function read(data: unknown, opts?: Record<string, unknown>): WorkBook;
  export function write(wb: WorkBook, opts?: Record<string, unknown>): unknown;
  export const utils: {
    sheet_to_json<T = unknown>(
      ws: unknown,
      opts?: Record<string, unknown>,
    ): T[];
    book_new(): WorkBook;
    aoa_to_sheet(data: unknown[][]): unknown;
    book_append_sheet(wb: WorkBook, ws: unknown, name: string): void;
  };
}
