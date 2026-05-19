// Decoder Parquet → TableModel (hyparquet + hyparquet-compressors).
// Puro JS, sem nativo. §13: tetos de linhas; compressors é risco de
// manutenção (1.1.1) — pinado e monitorado. Chunk lazy próprio.

import { parquetReadObjects, parquetMetadata } from "hyparquet";
import { compressors } from "hyparquet-compressors";
import type { Source } from "../../../types";
import { type TableModel, MAX_ROWS } from "../model";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export async function decodeParquet(source: Source): Promise<TableModel> {
  const bytes = await source.loadBytes();
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  const total = Number(parquetMetadata(ab).num_rows);
  const objs = (await parquetReadObjects({
    file: ab,
    compressors,
    rowStart: 0,
    rowEnd: Math.min(total, MAX_ROWS),
  })) as Record<string, unknown>[];

  if (objs.length === 0) throw new Error("Parquet sem linhas");
  const columns = Object.keys(objs[0]);
  return {
    columns,
    rows: objs.map((o) => columns.map((c) => fmt(o[c]))),
    total,
    truncated: total > MAX_ROWS,
  };
}
