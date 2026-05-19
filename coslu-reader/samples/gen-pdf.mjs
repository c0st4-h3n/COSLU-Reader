// Gera samples/sample.pdf (fixture da família PDF) via pdf-lib
// (devDependency). Rodar: node samples/gen-pdf.mjs
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fileURLToPath } from "node:url";
import { writeFileSync, statSync } from "node:fs";

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const ink = rgb(0.1, 0.1, 0.1);
const verm = rgb(0.72, 0.19, 0.12);
const mute = rgb(0.35, 0.32, 0.28);

for (let p = 1; p <= 3; p++) {
  const page = doc.addPage([595, 842]); // A4
  page.drawText("Coslu Reader", {
    x: 60, y: 760, size: 34, font: bold, color: verm,
  });
  page.drawText("Fase 3 — PDF via pdf.js endurecido", {
    x: 60, y: 722, size: 15, font, color: ink,
  });
  page.drawText(`Página ${p} de 3`, {
    x: 60, y: 695, size: 12, font, color: mute,
  });
  page.drawText("isEvalSupported:false · sem scripting/XFA · worker isolado", {
    x: 60, y: 660, size: 11, font, color: ink,
  });
  page.drawRectangle({
    x: 60, y: 120, width: 475, height: 510,
    borderColor: ink, borderWidth: 1,
  });
  page.drawText("§13.3 — mitiga CVE-2024-4367", {
    x: 76, y: 600, size: 10, font, color: mute,
  });
}

const out = fileURLToPath(new URL("./sample.pdf", import.meta.url));
writeFileSync(out, await doc.save());
console.log("wrote sample.pdf", statSync(out).size, "bytes");
