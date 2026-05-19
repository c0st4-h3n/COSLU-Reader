<div align="center">

<img src="coslu-icon-coslu-reader.png" width="120" alt="Coslu Reader" />

# Coslu Reader

**Visualizador universal de arquivos — local-first, leve, sem cloud.**

`MIT` · `Tauri 2` · `React 19 + TypeScript` · `Windows`

</div>

---

## O que é

O **Coslu Reader** abre praticamente **qualquer arquivo** numa janela só — código,
documentos, planilhas, dados, imagens, mídia, 3D, binários, arquivos compactados —
de forma **local-first** (sem nuvem, sem conta, sem telemetria). Binário base
de ~12 MB: cada formato pesado é carregado sob demanda, então abrir o app é
rápido **independentemente de quantos formatos ele suporta**.

Garantia central: **nada termina em erro** — o que não tiver um viewer dedicado
abre como texto e, no pior caso, como **hex**.

Produto open source da **COSLU LABZ**.

## O que ele lê

| Categoria | Formatos |
|---|---|
| **Código** (syntax highlight, ~50 linguagens) | C, C++, C#, JS/TS, Python, Rust, Go, Java, Kotlin, Ruby, PHP, Shell, PowerShell, SQL, **Assembly**, Swift, Lua… |
| **Texto / config** | `.txt .log .diff .md .ini .toml .yaml .xml .html .css` … |
| **Dados** | JSON/JSONL · CSV/TSV · **Parquet** · Arrow/Feather |
| **Banco / planilha** | **SQLite** (`.sqlite .db`) · **XLSX**/XLS/ODS |
| **Documentos** | **PDF** · **DOCX** · **PPTX** · **EPUB** · Jupyter **`.ipynb`** |
| **Imagem / fonte** | PNG JPG GIF WebP AVIF BMP ICO SVG · **PSD** · TTF/OTF/WOFF |
| **Mídia A/V** | MP3 WAV FLAC OGG · MP4 WebM MKV MOV … (player próprio) |
| **3D / CAD** | glTF/GLB · STL · OBJ · PLY (cena interativa) |
| **Binário** | WASM, PE/ELF/Mach-O, Java `.class` (header + hex) |
| **Arquivos** | ZIP/JAR/APK · TAR · GZIP/TGZ — abre **recursivamente** o conteúdo |
| **Qualquer outra coisa** | **Hex** garantido |

> **PDF, DOCX e PPTX** com fidelidade total exigem o **LibreOffice instalado**
> (conversão local → PDF). Sem ele, DOCX/PPTX caem para extração de
> texto/estrutura. **RAW de câmera** (CR2/NEF/ARW/DNG) abre como hex hoje
> (melhoria futura).

## Pré-requisitos

- **Windows 10/11.** No Windows 11 o WebView2 já vem; no 10, instale o
  [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
- **Node.js** ≥ 20.19 ou ≥ 22.12 (LTS recomendado).
- **Rust + Cargo** ([rustup](https://rustup.rs)) + Build Tools do Visual Studio (MSVC).
- *Opcional, recomendado:* **LibreOffice** — fidelidade real de PPTX/DOCX.

## Rodar a partir do código

```sh
git clone https://github.com/c0st4-h3n/COSLU-Reader.git
cd COSLU-Reader/coslu-reader
npm install
npm run tauri dev
```

Abrir um arquivo específico no modo dev:

```sh
npm run tauri -- dev -- "C:\caminho\para\o\arquivo.pdf"
```

## Gerar o instalador

```sh
cd coslu-reader
npm run tauri build
```

Os artefatos saem em `coslu-reader/src-tauri/target/release/bundle/`:

- `nsis/Coslu Reader_<versão>_x64-setup.exe`
- `msi/Coslu Reader_<versão>_x64_en-US.msi`

> Este build é **não assinado** — o Windows mostrará um aviso do SmartScreen
> ("editor desconhecido") na primeira execução. É esperado nesta fase
> (code signing é item de pré-lançamento).

## Como usar

1. Instale via o `-setup.exe` ou o `.msi`.
2. Na **primeira abertura** (sem arquivo) o app abre, uma única vez, a tela
   **Configurações → Aplicativos padrão** do Windows. Busque **"Coslu Reader"**
   e escolha, **por tipo de arquivo**, o que quer abrir com ele.
   *(O Windows não permite que um app se torne padrão sozinho — você escolhe.)*
3. Ou: clique direito num arquivo → **Abrir com → Coslu Reader**
   (marque "Sempre usar" se quiser fixar).
4. Ou pela linha de comando: `coslu-reader.exe "C:\caminho\arquivo"`.

O botão **"Definir como padrão no Windows…"** fica sempre disponível na tela
inicial do app.

## Arquitetura & documentação

- O app fica em [`coslu-reader/`](coslu-reader/) — **Tauri 2 + React 19 + TS + Vite 7**.
- [`PLANEJAMENTO.md`](PLANEJAMENTO.md) é o documento de engenharia / **fonte de
  verdade**: arquitetura, decisões, modelo de segurança (§13), roadmap.
- Cada formato é um *viewer lazy* (chunk separado); o bundle base permanece
  minúsculo — o custo de abrir um arquivo não cresce com o nº de formatos.

## Status

Funcional, **pré-1.0**. Catálogo de formatos essencialmente completo e validado.
Pendências de pré-lançamento (ver §10.8 do `PLANEJAMENTO.md`): endurecimento de
segurança (CSP/Isolation Pattern), code signing, vendoring de fontes, e RAW de
câmera (hoje hex).

## Licença

**MIT** — ver [`coslu-reader/LICENSE`](coslu-reader/LICENSE). © COSLU LABZ.
