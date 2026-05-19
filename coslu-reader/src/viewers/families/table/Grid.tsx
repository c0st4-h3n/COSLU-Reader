// Grid compartilhado da família Tabular. Só conhece TableModel —
// não sabe nada de CSV/Parquet/etc. (decoders cuidam disso).

import type { TableModel } from "./model";

export function Grid({ model }: { model: TableModel }) {
  return (
    <div className="view view-table">
      {model.truncated && (
        <div className="status">
          Mostrando {model.rows.length} de {model.total} linhas
          (virtualização vem depois).
        </div>
      )}
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="rownum">#</th>
              {model.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, r) => (
              <tr key={r}>
                <td className="rownum">{r + 1}</td>
                {row.map((cell, c) => (
                  <td key={c}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
