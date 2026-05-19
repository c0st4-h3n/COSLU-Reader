// Gera samples/sample.pptx — deck realista (OOXML mínimo porém com
// presentation.xml + rels, títulos, bullets por nível, imagens por
// slide e notas do apresentador). Zip via fflate. Rodar:
// node samples/gen-pptx.mjs
import { zipSync, strToU8 } from "fflate";
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const para = (b) =>
  `<a:p><a:pPr lvl="${b.lvl}"/><a:r><a:t>${esc(b.t)}</a:t></a:r></a:p>`;
const pic = (rid) =>
  `<p:pic><p:nvPicPr><p:cNvPr id="9" name="img"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
  `<p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
  `<p:spPr/></p:pic>`;

function slideXml(title, blocks, hasImg) {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld xmlns:a="${A}" xmlns:r="${REL}" xmlns:p="${P}"><p:cSld><p:spTree>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr/>` +
    `<p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>` +
    `<p:txBody><a:bodyPr/><a:p><a:r><a:t>${esc(title)}</a:t></a:r></a:p></p:txBody></p:sp>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Body"/><p:cNvSpPr/>` +
    `<p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>` +
    `<p:txBody><a:bodyPr/>${blocks.map(para).join("")}</p:txBody></p:sp>` +
    (hasImg ? pic("rIdImg") : "") +
    `</p:spTree></p:cSld></p:sld>`
  );
}
const notesXml = (t) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<p:notes xmlns:a="${A}" xmlns:p="${P}"><p:cSld><p:spTree><p:sp><p:txBody>` +
  `<a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`;

const slides = [
  {
    title: "Coslu Reader — visualizador universal",
    blocks: [
      { lvl: 0, t: "Local-first · leve · auditável" },
      { lvl: 0, t: "COSLU LABZ — Academic Journal Brutalism" },
    ],
    img: "image1.png",
    notes: "Slide de abertura. Falar do boot path O(1) e do tema da marca.",
  },
  {
    title: "PPTX Tier A — bem-feito",
    blocks: [
      { lvl: 0, t: "Ordem real via presentation.xml" },
      { lvl: 1, t: "Imagens associadas ao slide certo (rels)" },
      { lvl: 1, t: "Hierarquia de bullets por nível" },
      { lvl: 0, t: "Notas do apresentador + navegador slide-a-slide" },
    ],
    notes: "Aqui mostrar o navegador e alternar as notas.",
  },
  {
    title: "Segurança §13",
    blocks: [
      { lvl: 0, t: "Só textContent — sem innerHTML" },
      { lvl: 0, t: "DOMParser application/xml — sem XXE" },
      { lvl: 1, t: "Imagens via <img> blob" },
    ],
    img: "image2.png",
    notes: "",
  },
  {
    title: "Arquitetura",
    blocks: [
      { lvl: 0, t: "Reusa fflate + DOMParser nativo" },
      { lvl: 1, t: "Zero dependência nova pesada" },
      { lvl: 0, t: "Entry intocado ~198 KB" },
    ],
    notes: "Fechar reforçando a tese O(1) por formato.",
  },
];

const icon = new Uint8Array(
  readFileSync(new URL("../src-tauri/icons/icon.png", import.meta.url)),
);

const files = {
  "[Content_Types].xml": strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Default Extension="png" ContentType="image/png"/>` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `</Types>`,
  ),
  "ppt/media/image1.png": icon,
  "ppt/media/image2.png": icon,
};

const sldIds = [];
const presRels = [];
slides.forEach((sl, i) => {
  const n = i + 1;
  files[`ppt/slides/slide${n}.xml`] = strToU8(
    slideXml(sl.title, sl.blocks, !!sl.img),
  );
  // rels do slide: imagem + notas
  const rels = [];
  if (sl.img)
    rels.push(
      `<Relationship Id="rIdImg" Type="${REL}/image" Target="../media/${sl.img}"/>`,
    );
  if (sl.notes) {
    rels.push(
      `<Relationship Id="rIdNotes" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`,
    );
    files[`ppt/notesSlides/notesSlide${n}.xml`] = strToU8(notesXml(sl.notes));
  }
  files[`ppt/slides/_rels/slide${n}.xml.rels`] = strToU8(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="${PKG}">${rels.join("")}</Relationships>`,
  );
  sldIds.push(`<p:sldId id="${255 + n}" r:id="rId${n}"/>`);
  presRels.push(
    `<Relationship Id="rId${n}" Type="${REL}/slide" Target="slides/slide${n}.xml"/>`,
  );
});

files["ppt/presentation.xml"] = strToU8(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:presentation xmlns:r="${REL}" xmlns:p="${P}">` +
    `<p:sldIdLst>${sldIds.join("")}</p:sldIdLst>` +
    `<p:sldSz cx="9144000" cy="5143500"/></p:presentation>`,
);
files["ppt/_rels/presentation.xml.rels"] = strToU8(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="${PKG}">${presRels.join("")}</Relationships>`,
);
files["_rels/.rels"] = strToU8(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="${PKG}"><Relationship Id="rIdP" ` +
    `Type="${REL}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
);

const out = fileURLToPath(new URL("./sample.pptx", import.meta.url));
writeFileSync(out, zipSync(files));
console.log("wrote sample.pptx", statSync(out).size, "bytes");
