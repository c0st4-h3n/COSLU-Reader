// Decoder CSV/TSV/PSV → TableModel (PapaParse, delimitador auto).
// Chunk lazy próprio (carregado só ao abrir csv/tsv/psv).

import Papa from "papaparse";
import type { Source } from "../../../types";
import { type TableModel, MAX_ROWS } from "../model";

export async function decodeCsv(source: Source): Promise<TableModel> {
  const text = await source.loadText();
  const all = Papa.parse<string[]>(text, { skipEmptyLines: true }).data;
  if (all.length === 0) throw new Error("CSV sem linhas");
  const [head, ...rest] = all;
  return {
    columns: head,
    rows: rest.slice(0, MAX_ROWS),
    total: rest.length,
    truncated: rest.length > MAX_ROWS,
  };
}
