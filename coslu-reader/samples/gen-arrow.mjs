// Gera samples/sample.arrow (Arrow IPC file / Feather v2) via
// apache-arrow. Rodar: node samples/gen-arrow.mjs
import { tableFromArrays, tableToIPC } from "apache-arrow";
import { fileURLToPath } from "node:url";
import { writeFileSync, statSync } from "node:fs";

const t = tableFromArrays({
  familia: [
    "Texto", "Markdown", "Tabular", "Database",
    "Spreadsheet", "Media", "Font", "Archive",
  ],
  tier: ["S", "S", "S", "S", "S", "S", "S", "S"],
  fase: Int32Array.from([1, 1, 2, 2, 2, 2, 2, 1]),
  chunk_kb: Float64Array.from([
    0.44, 129.42, 1.12, 217.8, 366.95, 1.85, 0.0, 9.5,
  ]),
});

const out = fileURLToPath(new URL("./sample.arrow", import.meta.url));
writeFileSync(out, Buffer.from(tableToIPC(t, "file")));
console.log("wrote sample.arrow", statSync(out).size, "bytes");
