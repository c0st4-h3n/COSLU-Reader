// Família Spreadsheet — XLSX/XLS/ODS via SheetJS VENDORIZADO
// (decisão §2.5: cdn.sheetjs.com + hash, NÃO npm — ver
// src/vendor/sheetjs/PROVENANCE.md). Workbook tem várias abas →
// seletor de aba, renderizando a escolhida no Grid compartilhado da
// família Tabular (mesmo padrão do DatabaseViewer). Render como texto
// (§13: sem formula injection na visualização). Falha → fallback chain.

import { useEffect, useRef, useState } from "react";
import { read, utils, type WorkBook } from "../../../vendor/sheetjs/xlsx.mjs";
import type { ViewerProps } from "../../types";
import { Grid } from "../table/Grid";
import { type TableModel, MAX_ROWS } from "../table/model";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function sheetModel(wb: WorkBook, name: string): TableModel {
  const aoa = utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
    header: 1,
    blankrows: false,
  });
  if (aoa.length === 0)
    return { columns: [], rows: [], total: 0, truncated: false };
  const [head, ...rest] = aoa;
  return {
    columns: (head as unknown[]).map(fmt),
    rows: rest.slice(0, MAX_ROWS).map((r) => (r as unknown[]).map(fmt)),
    total: rest.length,
    truncated: rest.length > MAX_ROWS,
  };
}

type State =
  | { t: "load" }
  | { t: "ready"; sheets: string[]; current: string; model: TableModel }
  | { t: "err" };

export default function SpreadsheetViewer({ source }: ViewerProps) {
  const wbRef = useRef<WorkBook | null>(null);
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadBytes()
      .then((bytes) => {
        if (!alive) return;
        const wb = read(bytes, { type: "array" });
        if (!wb.SheetNames?.length) throw new Error("workbook sem abas");
        wbRef.current = wb;
        setS({
          t: "ready",
          sheets: wb.SheetNames,
          current: wb.SheetNames[0],
          model: sheetModel(wb, wb.SheetNames[0]),
        });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "err") throw new Error("decode planilha falhou");
  if (s.t === "load") return <div className="status">Lendo planilha…</div>;

  const pick = (name: string) => {
    const wb = wbRef.current;
    if (!wb || !s.sheets.includes(name)) return;
    setS({ ...s, current: name, model: sheetModel(wb, name) });
  };

  return (
    <div className="archive-open">
      <div className="archive-bar">
        <span className="crumb">{source.name} ›</span>
        <select
          className="db-select"
          value={s.current}
          onChange={(e) => pick(e.target.value)}
        >
          {s.sheets.map((sh) => (
            <option key={sh} value={sh}>
              {sh}
            </option>
          ))}
        </select>
        <span className="crumb">
          {s.model.total} linha(s) · {s.model.columns.length} coluna(s)
        </span>
      </div>
      <div className="archive-child">
        <Grid model={s.model} />
      </div>
    </div>
  );
}
