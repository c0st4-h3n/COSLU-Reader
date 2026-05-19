// Gera samples/sample.xlsx (fixture da família Spreadsheet) usando o
// PRÓPRIO SheetJS vendorizado (src/vendor/sheetjs/xlsx.mjs). Sem npm.
// Rodar: node samples/gen-xlsx.mjs
import { utils, write } from "../src/vendor/sheetjs/xlsx.mjs";
import { fileURLToPath } from "node:url";
import { writeFileSync, statSync } from "node:fs";

const wb = utils.book_new();
utils.book_append_sheet(
  wb,
  utils.aoa_to_sheet([
    ["familia", "tier", "fase"],
    ["Texto", "S", 1],
    ["Markdown", "S", 1],
    ["Tabular", "S", 2],
    ["Database", "S", 2],
    ["Spreadsheet", "S", 2],
    ["Hex", "B", 1],
  ]),
  "Familias",
);
utils.book_append_sheet(
  wb,
  utils.aoa_to_sheet([
    ["familia", "kb"],
    ["parquet", 157.03],
    ["markdown", 129.42],
    ["sqlite_wasm", 864.75],
    ["csv", 19.67],
  ]),
  "Chunks",
);

const buf = write(wb, { bookType: "xlsx", type: "array" });
const out = fileURLToPath(new URL("./sample.xlsx", import.meta.url));
writeFileSync(out, Buffer.from(buf));
console.log("wrote sample.xlsx", statSync(out).size, "bytes");
