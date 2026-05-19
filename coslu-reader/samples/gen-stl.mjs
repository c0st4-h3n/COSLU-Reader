// Gera samples/sample.stl — cubo em ASCII STL (texto puro, válido).
// Rodar: node samples/gen-stl.mjs
import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 8 vértices do cubo [-1,1]^3
const V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
// 6 faces (quads) → 2 triângulos cada, com normal externa
const FACES = [
  { n: [0, 0, -1], q: [0, 3, 2, 1] }, // trás (z-)
  { n: [0, 0, 1], q: [4, 5, 6, 7] }, // frente (z+)
  { n: [-1, 0, 0], q: [0, 4, 7, 3] }, // esquerda (x-)
  { n: [1, 0, 0], q: [1, 2, 6, 5] }, // direita (x+)
  { n: [0, -1, 0], q: [0, 1, 5, 4] }, // base (y-)
  { n: [0, 1, 0], q: [3, 7, 6, 2] }, // topo (y+)
];

const tri = (n, a, b, c) =>
  ` facet normal ${n.join(" ")}\n  outer loop\n` +
  `   vertex ${V[a].join(" ")}\n   vertex ${V[b].join(" ")}\n   vertex ${V[c].join(" ")}\n` +
  `  endloop\n endfacet\n`;

let stl = "solid coslu-cube\n";
for (const f of FACES) {
  const [a, b, c, d] = f.q;
  stl += tri(f.n, a, b, c) + tri(f.n, a, c, d);
}
stl += "endsolid coslu-cube\n";

const out = fileURLToPath(new URL("./sample.stl", import.meta.url));
writeFileSync(out, stl);
console.log("wrote sample.stl", statSync(out).size, "bytes");
