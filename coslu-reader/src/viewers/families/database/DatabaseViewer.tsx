// Família Database — SQLite via @sqlite.org/sqlite-wasm (decisão §2).
// Abre o .sqlite EM MEMÓRIA (deserialize), aplica read-only +
// PRAGMA quick_check (§13: sandbox WASM + defensivo). Lista as tabelas
// e renderiza a escolhida REUSANDO o Grid/TableModel da família Tabular
// (reuso de modelo entre famílias). Arquivo não-SQLite → quick_check
// falha → throw → fallback chain (texto → hex).

import { useEffect, useRef, useState } from "react";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { ViewerProps } from "../../types";
import { Grid } from "../table/Grid";
import { type TableModel, MAX_ROWS } from "../table/model";

// init do wasm (~1MB) memoizado — chunk lazy da família.
let initPromise: Promise<unknown> | null = null;
const getSqlite = () => (initPromise ??= sqlite3InitModule());

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Uint8Array) return `‹blob ${v.length}B›`;
  return String(v);
}

type State =
  | { t: "load" }
  | { t: "ready"; tables: string[]; current: string; model: TableModel }
  | { t: "empty" }
  | { t: "err" };

export default function DatabaseViewer({ source }: ViewerProps) {
  const dbRef = useRef<any>(null);
  const [s, setS] = useState<State>({ t: "load" });

  function queryTable(db: any, name: string): TableModel {
    const columns: string[] = db.selectValues(
      "SELECT name FROM pragma_table_info(?)",
      name,
    );
    const rows: unknown[][] = [];
    db.exec({
      sql: `SELECT * FROM "${name}" LIMIT ${MAX_ROWS}`,
      rowMode: "array",
      resultRows: rows,
    });
    const total = Number(db.selectValue(`SELECT COUNT(*) FROM "${name}"`));
    return {
      columns,
      rows: rows.map((r) => r.map(fmt)),
      total,
      truncated: total > MAX_ROWS,
    };
  }

  useEffect(() => {
    let alive = true;
    let db: any = null;
    (async () => {
      try {
        const sqlite3: any = await getSqlite();
        const bytes = await source.loadBytes();
        db = new sqlite3.oo1.DB();
        const p = sqlite3.wasm.allocFromTypedArray(bytes);
        db.checkRc(
          sqlite3.capi.sqlite3_deserialize(
            db.pointer,
            "main",
            p,
            bytes.length,
            bytes.length,
            sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
              sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
          ),
        );
        db.exec("PRAGMA query_only=ON;");
        if (db.selectValue("PRAGMA quick_check;") !== "ok")
          throw new Error("quick_check falhou (não é SQLite válido)");

        const tables: string[] = db.selectValues(
          "SELECT name FROM sqlite_master WHERE type='table' " +
            "AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name",
        );
        if (!alive) return;
        dbRef.current = db;
        if (tables.length === 0) {
          setS({ t: "empty" });
          return;
        }
        setS({
          t: "ready",
          tables,
          current: tables[0],
          model: queryTable(db, tables[0]),
        });
      } catch {
        if (alive) setS({ t: "err" });
      }
    })();
    return () => {
      alive = false;
      try {
        db?.close();
      } catch {
        /* noop */
      }
    };
  }, [source]);

  if (s.t === "err") throw new Error("decode SQLite falhou");
  if (s.t === "load")
    return <div className="status">Abrindo banco (wasm)…</div>;
  if (s.t === "empty")
    return <div className="status">Banco sem tabelas de usuário.</div>;

  const pick = (name: string) => {
    const db = dbRef.current;
    if (!db || !s.tables.includes(name)) return; // só tabelas do catálogo
    setS({ ...s, current: name, model: queryTable(db, name) });
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
          {s.tables.map((t) => (
            <option key={t} value={t}>
              {t}
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
