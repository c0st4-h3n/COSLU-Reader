// Highlighter compartilhado — Shiki LAZY (§3.3/§4). Importado só
// quando há código a destacar (chunk próprio, fora do entry). Tema
// ESCURO vívido "one-dark-pro": code block escuro sobre o papel creme
// = alto contraste, cores vivas (padrão docs/VSCode). A saída do Shiki
// é markup determinístico do TEXTO do código (não é passthrough de
// HTML não-confiável) → injeção é segura (§13). Falha → <pre> escapado.

const THEME = "one-dark-pro";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ALIAS: Record<string, string> = {
  python3: "python",
  ipython: "python",
  ipython3: "python",
  node: "javascript",
  sh: "bash",
  shell: "bash",
  "c++": "cpp",
};

// extensão → id de linguagem do Shiki (desconhecida → "text",
// highlight() degrada sozinho). Cobre o set comum + Assembly.
const EXT_LANG: Record<string, string> = {
  c: "c", h: "c", cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp",
  cs: "csharp", js: "javascript", mjs: "javascript", cjs: "javascript",
  jsx: "jsx", ts: "typescript", mts: "typescript", cts: "typescript",
  tsx: "tsx", py: "python", pyw: "python", rs: "rust", go: "go",
  java: "java", kt: "kotlin", kts: "kotlin", rb: "ruby", php: "php",
  swift: "swift", scala: "scala", dart: "dart", lua: "lua", pl: "perl",
  r: "r", jl: "julia", hs: "haskell", ex: "elixir", exs: "elixir",
  erl: "erlang", clj: "clojure", fs: "fsharp", ml: "ocaml", nim: "nim",
  zig: "zig", v: "v", sol: "solidity", sh: "bash", bash: "bash",
  zsh: "bash", ps1: "powershell", bat: "bat", cmd: "bat", sql: "sql",
  html: "html", htm: "html", xml: "xml", svg: "xml", css: "css",
  scss: "scss", less: "less", yaml: "yaml", yml: "yaml", toml: "toml",
  ini: "ini", conf: "ini", env: "dotenv", diff: "diff", patch: "diff",
  dockerfile: "docker", makefile: "make", mk: "make", cmake: "cmake",
  gradle: "groovy", vue: "vue", svelte: "svelte", astro: "astro",
  graphql: "graphql", gql: "graphql", proto: "proto", tf: "hcl",
  asm: "asm", s: "asm", nasm: "asm", wat: "wasm", wgsl: "wgsl",
  vim: "viml", lisp: "lisp", scm: "scheme", elm: "elm", purs: "purescript",
};

export function langForFile(name: string): string {
  const base = name.split("/").pop()?.toLowerCase() ?? "";
  if (base === "dockerfile") return "docker";
  if (base === "makefile") return "make";
  if (base === "cmakelists.txt") return "cmake";
  const ext = base.includes(".") ? base.split(".").pop()! : "";
  return EXT_LANG[ext] ?? "text";
}

export async function highlight(code: string, lang: string): Promise<string> {
  const l = ALIAS[lang?.toLowerCase()] ?? (lang || "text").toLowerCase();
  try {
    const { codeToHtml } = await import("shiki");
    return await codeToHtml(code, { lang: l, theme: THEME });
  } catch {
    try {
      const { codeToHtml } = await import("shiki");
      return await codeToHtml(code, { lang: "text", theme: THEME });
    } catch {
      return `<pre class="shiki-fallback">${esc(code)}</pre>`;
    }
  }
}
