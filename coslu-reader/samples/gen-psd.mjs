// Gera samples/sample.psd com ag-psd (devDependency, gerador de
// fixture — padrão de hyparquet-writer/pdf-lib). PSD spec-compliant
// que o @webtoon/psd lê sem problemas. Rodar: node samples/gen-psd.mjs
import { writePsd } from "ag-psd";
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 96,
  H = 96;
const data = new Uint8ClampedArray(W * H * 4);
const paper = [239, 232, 216, 255];
const verm = [184, 49, 30, 255];
const ink = [26, 26, 26, 255];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const border = x < 6 || x >= W - 6 || y < 6 || y >= H - 6;
    const c = border ? paper : x < W / 2 ? verm : ink;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = c[3];
  }
}
const imageData = { data, width: W, height: H };

const psd = {
  width: W,
  height: H,
  imageData,
  children: [
    { name: "fundo", left: 0, top: 0, right: W, bottom: H, imageData },
  ],
};

const buf = writePsd(psd, { generateThumbnail: false });
const out = fileURLToPath(new URL("./sample.psd", import.meta.url));
writeFileSync(out, Buffer.from(buf));
console.log("wrote sample.psd", statSync(out).size, "bytes");
