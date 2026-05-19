// Gera samples/sample.wasm — módulo WebAssembly VÁLIDO mínimo:
// magic "\0asm" + versão 1, e uma seção custom "coslu" pra exibir.
// Rodar: node samples/gen-wasm.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const name = "coslu";
const payload = [name.length, ...[...name].map((c) => c.charCodeAt(0))];
const customSection = [0x00, payload.length, ...payload]; // id 0 + size + data

const bytes = Uint8Array.from([
  0x00, 0x61, 0x73, 0x6d, // \0asm
  0x01, 0x00, 0x00, 0x00, // version 1
  ...customSection,
]);

const out = fileURLToPath(new URL("./sample.wasm", import.meta.url));
writeFileSync(out, Buffer.from(bytes));
console.log("wrote sample.wasm", statSync(out).size, "bytes");
