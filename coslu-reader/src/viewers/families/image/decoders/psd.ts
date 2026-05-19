// Decoder PSD/PSB → PNG Blob (@webtoon/psd, TS puro). Chunk lazy
// próprio — só carrega ao abrir um .psd. Composita a imagem mesclada
// e rasteriza num canvas. Sem rede, sem exec (§13).

import Psd from "@webtoon/psd";

export async function decodePsd(bytes: Uint8Array): Promise<Blob> {
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const psd = Psd.parse(ab);
  const rgba = await psd.composite(); // Uint8ClampedArray RGBA
  const { width, height } = psd;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sem contexto 2d");
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(rgba), width, height),
    0,
    0,
  );

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob falhou"))),
      "image/png",
    ),
  );
}
