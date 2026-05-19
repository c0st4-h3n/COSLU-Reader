// Gera samples/sample.sqlite (fixture da família Database).
// Usa node:sqlite (embutido no Node — sem dependência).
// Rodar: node samples/gen-sqlite.mjs
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { rmSync, statSync } from "node:fs";

const out = fileURLToPath(new URL("./sample.sqlite", import.meta.url));
try {
  rmSync(out);
} catch {
  /* não existia */
}

const db = new DatabaseSync(out);
db.exec(
  "CREATE TABLE familias (id INTEGER PRIMARY KEY, nome TEXT, tier TEXT, fase INTEGER);",
);
db.exec("CREATE TABLE chunks (familia TEXT, kb REAL, lazy INTEGER);");

const i1 = db.prepare("INSERT INTO familias (nome,tier,fase) VALUES (?,?,?)");
for (const r of [
  ["Texto", "S", 1], ["Markdown", "S", 1], ["Dados", "S", 1],
  ["Tabular", "S", 2], ["Database", "S", 2], ["Hex", "B", 1],
  ["Arquivo", "S", 1],
])
  i1.run(...r);

const i2 = db.prepare("INSERT INTO chunks (familia,kb,lazy) VALUES (?,?,?)");
for (const r of [
  ["parquet", 157.03, 1], ["markdown", 129.42, 1],
  ["csv", 19.67, 1], ["archive", 9.17, 1],
])
  i2.run(...r);

db.close();
console.log("wrote sample.sqlite", statSync(out).size, "bytes");
