// Decoder Arrow/Feather/IPC → TableModel (apache-arrow). Colunar
// in-memory; tableFromIPC lê tanto o formato stream quanto file
// (Feather v2). Chunk lazy próprio. §13: tetos de linhas.

import { tableFromIPC } from "apache-arrow";
import type { Source } from "../../../types";
import { type TableModel, MAX_ROWS } from "../model";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function decodeArrow(source: Source): Promise<TableModel> {
  const bytes = await source.loadBytes();
  const t = tableFromIPC(bytes);
  const columns = t.schema.fields.map((f) => f.name);
  const rows: string[][] = [];
  let i = 0;
  for (const row of t) {
    if (i++ >= MAX_ROWS) break;
    const r = row as Record<string, unknown>;
    rows.push(columns.map((c) => fmt(r[c])));
  }
  return {
    columns,
    rows,
    total: t.numRows,
    truncated: t.numRows > MAX_ROWS,
  };
}
