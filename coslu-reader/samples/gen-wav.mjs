// Gera samples/sample.wav (fixture da família Mídia): ~1.5s, 440 Hz,
// PCM 16-bit mono 8 kHz. Sem dependências. Rodar: node samples/gen-wav.mjs
import { fileURLToPath } from "node:url";
import { writeFileSync, statSync } from "node:fs";

const rate = 8000;
const secs = 1.5;
const n = Math.floor(rate * secs);
const dataLen = n * 2;

const buf = Buffer.alloc(44 + dataLen);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataLen, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(rate, 24);
buf.writeUInt32LE(rate * 2, 28); // byteRate
buf.writeUInt16LE(2, 32); // blockAlign
buf.writeUInt16LE(16, 34); // bits
buf.write("data", 36);
buf.writeUInt32LE(dataLen, 40);

for (let i = 0; i < n; i++) {
  const fade = Math.min(1, i / 800, (n - i) / 800); // anti-clique
  const s = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.25 * fade;
  buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
}

const out = fileURLToPath(new URL("./sample.wav", import.meta.url));
writeFileSync(out, buf);
console.log("wrote sample.wav", statSync(out).size, "bytes");
