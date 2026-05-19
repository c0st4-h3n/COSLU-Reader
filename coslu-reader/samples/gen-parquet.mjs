// Gera samples/sample.parquet (fixture de teste da família Tabular).
// Usa hyparquet-writer (devDependency). Codec padrão SNAPPY — exercita
// o hyparquet-compressors na leitura. Rodar: node samples/gen-parquet.mjs
import { parquetWriteFile } from "hyparquet-writer";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

const out = fileURLToPath(new URL("./sample.parquet", import.meta.url));

parquetWriteFile({
  filename: out,
  columnData: [
    {
      name: "familia",
      type: "STRING",
      data: [
        "Texto/Codigo", "Markdown", "Dados/JSON", "Tabular",
        "Imagem", "Hex", "Arquivo",
      ],
    },
    { name: "tier", type: "STRING", data: ["S", "S", "S", "S", "S", "B", "S"] },
    { name: "fase", type: "INT32", data: [1, 1, 1, 2, 1, 1, 1] },
    {
      name: "chunk_kb",
      type: "DOUBLE",
      data: [0.44, 129.42, 1.55, 20.55, 0.99, 1.04, 9.17],
    },
    {
      name: "recursivo",
      type: "BOOLEAN",
      data: [false, false, false, false, false, false, true],
    },
  ],
});

console.log("wrote sample.parquet", statSync(out).size, "bytes");
