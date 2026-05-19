// Família Tabular — dispatcher. Escolhe o decoder fino pela extensão,
// produz um TableModel normalizado e renderiza o Grid compartilhado.
// Decoders são chunks lazy próprios (§5.1). Falha → fallback chain.

import { useEffect, useState } from "react";
import type { ViewerProps, Source } from "../../types";
import { Grid } from "./Grid";
import type { TableModel } from "./model";

type Decoder = (s: Source) => Promise<TableModel>;

const LOADERS: Record<string, () => Promise<Decoder>> = {
  csv: () => import("./decoders/csv").then((m) => m.decodeCsv),
  tsv: () => import("./decoders/csv").then((m) => m.decodeCsv),
  psv: () => import("./decoders/csv").then((m) => m.decodeCsv),
  parquet: () => import("./decoders/parquet").then((m) => m.decodeParquet),
  arrow: () => import("./decoders/arrow").then((m) => m.decodeArrow),
  feather: () => import("./decoders/arrow").then((m) => m.decodeArrow),
  ipc: () => import("./decoders/arrow").then((m) => m.decodeArrow),
};

type State = { t: "load" } | { t: "ok"; model: TableModel } | { t: "err" };

export default function TableViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    const ext = source.name.split(".").pop()?.toLowerCase() ?? "csv";
    const load = LOADERS[ext] ?? LOADERS.csv;
    load()
      .then((decode) => decode(source))
      .then((model) => alive && setS({ t: "ok", model }))
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "err") throw new Error("decode tabular falhou");
  if (s.t === "load") return <div className="status">Lendo…</div>;
  return <Grid model={s.model} />;
}
