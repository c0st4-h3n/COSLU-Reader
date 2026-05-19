// Família Binário estruturado — parse de header de formatos conhecidos
// (WASM/PE/ELF/Mach-O/Java .class/.pyc) + preview hex. Zero dep, só
// leitura de bytes (§13: sem exec). Tier A (campos-chave) → o corpo
// fica como hex. Falha de leitura → throw → fallback chain.

import { useEffect, useState } from "react";
import type { ViewerProps } from "../../types";

const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32le = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

const JAVA: Record<number, string> = {
  45: "1.1", 46: "1.2", 47: "1.3", 48: "1.4", 49: "5", 50: "6",
  51: "7", 52: "8", 53: "9", 54: "10", 55: "11", 56: "12", 57: "13",
  58: "14", 59: "15", 60: "16", 61: "17", 62: "18", 63: "19",
  64: "20", 65: "21", 66: "22", 67: "23", 68: "24",
};
const ELF_MACH: Record<number, string> = {
  0x03: "x86", 0x3e: "x86-64", 0x28: "ARM", 0xb7: "AArch64",
  0xf3: "RISC-V", 0x08: "MIPS",
};
const PE_MACH: Record<number, string> = {
  0x14c: "x86", 0x8664: "x86-64", 0x1c0: "ARM", 0xaa64: "ARM64",
  0x200: "IA64",
};
const WASM_SECT = [
  "custom", "type", "import", "function", "table", "memory", "global",
  "export", "start", "element", "code", "data", "data count",
];

function describe(b: Uint8Array): { fmt: string; rows: string[] } {
  const rows: string[] = [];
  // WASM
  if (b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d) {
    rows.push(`versão ${u32le(b, 4)}`);
    let o = 8,
      n = 0;
    while (o < b.length && n < 64) {
      const id = b[o++];
      let size = 0,
        shift = 0,
        byte = 0;
      do {
        byte = b[o++];
        size |= (byte & 0x7f) << shift;
        shift += 7;
      } while (byte & 0x80 && o < b.length);
      rows.push(
        `seção ${id} (${WASM_SECT[id] ?? "?"}) — ${size} bytes`,
      );
      o += size;
      n++;
    }
    return { fmt: "WebAssembly", rows };
  }
  // ELF
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) {
    const cls = b[4] === 2 ? "64-bit" : "32-bit";
    const le = b[5] === 1;
    const et = le ? u16le(b, 16) : u16be(b, 16);
    const em = le ? u16le(b, 18) : u16be(b, 18);
    const T: Record<number, string> = {
      1: "relocatable", 2: "executable", 3: "shared object", 4: "core",
    };
    rows.push(`${cls} · ${le ? "little" : "big"}-endian`);
    rows.push(`tipo: ${T[et] ?? et}`);
    rows.push(`arquitetura: ${ELF_MACH[em] ?? `0x${em.toString(16)}`}`);
    return { fmt: "ELF", rows };
  }
  // Java .class / Mach-O fat (CAFEBABE)
  if (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe) {
    const major = u16be(b, 6);
    if (major >= 45 && major <= 80) {
      rows.push(`bytecode major ${major} (Java ${JAVA[major] ?? "?"})`);
      rows.push(`minor ${u16be(b, 4)}`);
      return { fmt: "Java .class", rows };
    }
    rows.push(`${u32be(b, 4)} arquitetura(s)`);
    return { fmt: "Mach-O universal (fat)", rows };
  }
  // Mach-O thin
  const m = u32be(b, 0);
  if (
    m === 0xfeedface || m === 0xcefaedfe ||
    m === 0xfeedfacf || m === 0xcffaedfe
  ) {
    rows.push(m === 0xfeedfacf || m === 0xcffaedfe ? "64-bit" : "32-bit");
    return { fmt: "Mach-O", rows };
  }
  // PE / DOS
  if (b[0] === 0x4d && b[1] === 0x5a) {
    const pe = u32le(b, 0x3c);
    if (
      pe + 24 < b.length &&
      b[pe] === 0x50 && b[pe + 1] === 0x45 &&
      b[pe + 2] === 0 && b[pe + 3] === 0
    ) {
      const mach = u16le(b, pe + 4);
      const nsec = u16le(b, pe + 6);
      const opt = u16le(b, pe + 24);
      rows.push(`arquitetura: ${PE_MACH[mach] ?? `0x${mach.toString(16)}`}`);
      rows.push(opt === 0x20b ? "PE32+ (64-bit)" : "PE32 (32-bit)");
      rows.push(`${nsec} seções`);
      return { fmt: "PE (Windows)", rows };
    }
    return { fmt: "DOS/MZ executável", rows };
  }
  // .pyc (sem magic universal — mostra os 4 bytes)
  rows.push(
    "magic " +
      [...b.slice(0, 4)].map((x) => x.toString(16).padStart(2, "0")).join(" "),
  );
  return { fmt: "binário (header desconhecido)", rows };
}

function hexDump(b: Uint8Array, max = 1024): string {
  const lines: string[] = [];
  const len = Math.min(b.length, max);
  for (let o = 0; o < len; o += 16) {
    const s = b.subarray(o, o + 16);
    const hex = [...s]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(47, " ");
    const asc = [...s]
      .map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : "."))
      .join("");
    lines.push(`${o.toString(16).padStart(8, "0")}  ${hex}  ${asc}`);
  }
  return lines.join("\n");
}

type State =
  | { t: "load" }
  | { t: "ok"; fmt: string; rows: string[]; hex: string; size: number }
  | { t: "err" };

export default function BinaryViewer({ source }: ViewerProps) {
  const [s, setS] = useState<State>({ t: "load" });

  useEffect(() => {
    let alive = true;
    source
      .loadBytes()
      .then((b) => {
        if (!alive) return;
        const { fmt, rows } = describe(b);
        setS({ t: "ok", fmt, rows, hex: hexDump(b), size: b.length });
      })
      .catch(() => alive && setS({ t: "err" }));
    return () => {
      alive = false;
    };
  }, [source]);

  if (s.t === "err") throw new Error("falha ao ler binário");
  if (s.t === "load")
    return <div className="status">Analisando binário…</div>;

  return (
    <div className="view view-binary">
      <div className="bin-card">
        <div className="bin-fmt">{s.fmt}</div>
        <div className="bin-kv">{source.name} · {s.size} bytes</div>
        {s.rows.map((r, i) => (
          <div key={i} className="bin-kv">
            {r}
          </div>
        ))}
      </div>
      <div className="bin-hex-h">hex (primeiros {Math.min(s.size, 1024)} B)</div>
      <pre className="bin-hex">{s.hex}</pre>
    </div>
  );
}
