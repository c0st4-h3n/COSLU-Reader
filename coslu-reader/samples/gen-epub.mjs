// Gera samples/sample.epub — EPUB 3 mínimo porém válido, zipado com
// fflate (mimetype STORED primeiro, como manda o spec). Rodar:
// node samples/gen-epub.mjs
import { zipSync, strToU8 } from "fflate";
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
 <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bid">
 <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="bid">urn:uuid:coslu-reader-sample-epub</dc:identifier>
  <dc:title>Coslu Reader — E-book de exemplo</dc:title>
  <dc:language>pt-BR</dc:language>
  <dc:creator>COSLU LABZ</dc:creator>
  <meta property="dcterms:modified">2026-05-19T00:00:00Z</meta>
 </metadata>
 <manifest>
  <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  <item id="css" href="style.css" media-type="text/css"/>
  <item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  <item id="c2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
 </manifest>
 <spine>
  <itemref idref="c1"/>
  <itemref idref="c2"/>
 </spine>
</package>`;

const nav = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Sumário</title></head>
<body><nav epub:type="toc"><h1>Sumário</h1><ol>
<li><a href="ch1.xhtml">Capítulo 1 — Introdução</a></li>
<li><a href="ch2.xhtml">Capítulo 2 — Arquitetura</a></li>
</ol></nav></body></html>`;

const css = `body{font-family:Georgia,serif;line-height:1.7;margin:6% 8%;color:#1a1a1a}
h1{font-size:1.8em;border-bottom:2px solid #b8311e;padding-bottom:.2em}
p{margin:1em 0}code{font-family:monospace;background:#efe8d8;padding:0 .3em}`;

const chapter = (n, title, body) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title>
<link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><h1>${title}</h1>${body}
<p><em>— Coslu Reader · página ${n} ·</em></p></body></html>`;

const ch1 = chapter(
  1,
  "Capítulo 1 — Introdução",
  `<p>Este é um <strong>EPUB de exemplo</strong> renderizado pelo Coslu Reader
   via <code>epub.js</code>, com <em>scripting desligado</em> (§13).</p>
   <p>Use <strong>‹ ant</strong> / <strong>próx ›</strong> ou o sumário para navegar.
   A paginação é do próprio motor de e-book.</p>`,
);
const ch2 = chapter(
  2,
  "Capítulo 2 — Arquitetura",
  `<p>O conteúdo do livro roda num iframe isolado, sem permissão de script
   (<code>allowScriptedContent:false</code>) e sem acesso à rede — os
   recursos vêm do próprio arquivo.</p>
   <p>O Coslu Reader só fornece a moldura e a navegação no padrão da marca.</p>`,
);

const files = {
  mimetype: [strToU8("application/epub+zip"), { level: 0 }],
  "META-INF/container.xml": strToU8(container),
  "OEBPS/content.opf": strToU8(opf),
  "OEBPS/nav.xhtml": strToU8(nav),
  "OEBPS/style.css": strToU8(css),
  "OEBPS/ch1.xhtml": strToU8(ch1),
  "OEBPS/ch2.xhtml": strToU8(ch2),
};

const out = fileURLToPath(new URL("./sample.epub", import.meta.url));
writeFileSync(out, zipSync(files));
console.log("wrote sample.epub", statSync(out).size, "bytes");
