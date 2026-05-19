// Coslu Reader — sample JavaScript (Tier S via Shiki)
const familias = ["texto", "dados", "hex"];

async function carrega(nome, { tier = 1 } = {}) {
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 10));
  return `${nome} (tier ${tier}) em ${(performance.now() - t0).toFixed(1)}ms`;
}

for (const f of familias) {
  carrega(f, { tier: f === "hex" ? 0 : 1 }).then(console.log);
}

export { carrega };
