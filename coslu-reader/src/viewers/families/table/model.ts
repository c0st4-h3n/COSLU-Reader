// Modelo normalizado da família Tabular. Qualquer formato de tabela
// (CSV, Parquet, depois Arrow/XLSX/SQLite) é decodificado para ISTO,
// e o Grid compartilhado só conhece este modelo (§5.1/§6).

export interface TableModel {
  columns: string[];
  rows: string[][];
  total: number; // total real de linhas (antes do cap)
  truncated: boolean;
}

export const MAX_ROWS = 2000; // cap do skeleton; virtualização depois (§9)
