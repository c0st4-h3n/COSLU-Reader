# Coslu Reader — Planejamento de Engenharia

> Produto independente da **COSLU LABZ**. Visualizador universal de arquivos, local-first, leve.
> Inspirado no Markdown Reader, mas **sem acoplamento** (repo isolado, zero código compartilhado).
> Documento vivo de engenharia: stack, arquitetura, build, estrutura, riscos.
>
> **Estado:** greenfield (projeto vazio em 2026-05-18). Este documento é a fonte de verdade até existir código.
> **Todas as decisões de produto/engenharia fechadas em 2026-05-18 (§2) — nada pendente; próximo passo = scaffold (§10.2).**
> Stack-base validada por pesquisa técnica — ver [§12 Validação técnica](#12-validação-técnica-pesquisa).

---

## 1. Princípios de engenharia

- **Local-first.** Sem cloud, sem conta, sem telemetria por padrão.
- **Startup O(1) no nº de formatos.** O custo *marginal* de abrir um arquivo não cresce ao adicionar formatos. (Não é promessa de tempo absoluto — ver caveat WebView2 em §3.2/§9.)
- **Reader-first.** Visualização fiel; edição é mínima/opcional, nunca vira IDE.
- **Peso sob controle.** Bundle base minúsculo; cada formato pesado é lazy.
- **Mobile-ready, não mobile-now.** Arquitetura que não exige reescrita pra portar.

## 2. Decisões travadas

| Eixo | Decisão | Consequência |
|---|---|---|
| Modelo | 100% grátis (vitrine de marca) | Zero infra de pagamento/licença/gate; todos os formatos liberados |
| Plataforma | **Windows-only** por agora | Tauri 2 + WebView2; empacotamento `.msi`/NSIS; signing Windows. macOS **fora** por enquanto |
| Mobile | **Possível no futuro** (iOS/Android) | Tauri 2 suporta mobile estável, porém *não* como cidadão de primeira classe; isolar IO desde o dia 1 |
| Stack | Tauri 2 + React 19 + TS + Vite 7 | Codebase nova e independente (mesma stack do Markdown Reader, sem compartilhar código) |
| Independência | Produto separado, repo isolado | Sem monorepo, sem lib comum |
| Modelo de viewer | **Viewers generalizados** (família + modelo normalizado + decoders finos), não 1-formato-1-viewer | Nº de viewers limitado (boot O(1) preservado); cobertura de formatos enorme. Ver §5 |
| Garantia universal | **Fallback chain** + **hex** + **router recursivo de arquivo** na Fase 1 | "Reader de tudo": nenhum arquivo termina em erro. Ver §5.4 |
| Escopo de formatos (2026-05-18) | Núcleo + Mídia A/V + RAW/PSD + 3D/CAD + **PPTX (OOXML, não é Office legado)** **dentro**; Office legado, e-mail, suites Apple **fora por agora** | Fora ainda abre em Tier B via fallback. Ver §5.2 |
| Licença (2026-05-18) | **MIT** | Permissiva, reforça a vitrine "100% local, auditável". Adicionar `LICENSE` MIT no scaffold |
| Repo slug (2026-05-18) | **`coslu-reader`** | Produto = "Coslu Reader"; domínio da landing definido depois com a marca COSLU LABZ (não bloqueia) |
| Modelo de janela (2026-05-18) | **Uma janela por arquivo** | Cada "Open With" abre nova janela; o processo lê o próprio `argv` (**sem `single-instance`** — refinamento §3.2). Ver §3.2/§8 |
| **Conversor Office (revisão 2026-05-18)** | **Office→PDF via LibreOffice JÁ INSTALADO** (`soffice --headless --convert-to pdf`) → reusa o **PdfViewer endurecido**; Tier-A (extração OOXML) como **fallback** se não houver conversor / sem path (dentro de zip) / falha. **NÃO empacotar o LibreOffice** | Teste em deck real provou que extração de texto é insuficiente p/ apresentações; o PDF *é* a renderização do LibreOffice (open source, alta fidelidade). Conversão isolada em **processo separado** (bom p/ §13) + IPC por **bytes crus** (`tauri::ipc::Response`, não `number[]`). Mantém "leve" (usa o LO do usuário) |
| DOCX (revisado 2026-05-18) | **Converter→PDF (LibreOffice)** primário; fallback Tier-A = extração OOXML leve (`w:t`) | Supera o debate §2.4 mammoth-vs-docx-preview: com conversor, fidelidade real; fallback leve dispensa mammoth. Ver linha "Conversor Office" |
| XLSX (2026-05-18) | **SheetJS ≥0.20.2 via `cdn.sheetjs.com`**, vendorizado com hash — **NÃO** via conversor | Pra planilha, **grid de dados > PDF** (PDF de planilha pagina mal); conversor só agrega em *layout* (PPTX/DOCX). Ver §13.3 |
| SQLite (2026-05-18) | **`@sqlite.org/sqlite-wasm`** (oficial), read-only + `PRAGMA quick_check` | Uptake de CVE mais rápido que sql.js. Ver §13.3 |
| PPTX (revisado 2026-05-18) | **Converter→PDF (LibreOffice)** primário; fallback Tier-A = extração OOXML (ordem/título/bullets/imagens/notas) | Tier-A puro foi reprovado em deck real; ver linha "Conversor Office" |

### Decisões fechadas

Todas as pendências de produto/engenharia foram decididas em **2026-05-18** (linhas marcadas acima). **Nenhuma decisão em aberto** — roadmap §10 destravado. Próximo: scaffold (passo 2).

## 3. Arquitetura

### 3.1 Viewer Router

Núcleo do app. O router resolve `conteúdo/extensão → família` (§5), não → formato. Cada **família** é um viewer generalizado que consome um **modelo normalizado** produzido por um **decoder fino** específico do formato:

- viewer = um **chunk lazy** (`React.lazy` + `import()` dinâmico); decoders são módulos pequenos lazy dentro do chunk da família;
- declara `capabilities` (`search`, `copy`, `export`, `rawToggle`);
- é *stateless* sobre o arquivo — o shell gerencia arquivo atual, histórico e recentes.

Três comportamentos do router que entregam o "reader de tudo" (ver §5.1/§5.4):

- **Fallback chain:** `família (S/A) → texto best-effort → hex`. Resolver nunca retorna "sem viewer" — degrada.
- **Router recursivo de arquivo:** entrada de um container (zip/tar/…) é re-submetida ao mesmo resolver (com cap de profundidade e budget cumulativo — §11/§13.5).
- **Decoder ≠ viewer:** adicionar formato = registrar um decoder que mapeia pro modelo normalizado de uma família existente; só cria chunk novo se a família for nova. É isso que mantém o boot O(1) mesmo com catálogo grande.

### 3.2 Boot path orientado a detecção (diferencial central)

Sequência do spawn do processo até o primeiro pixel de conteúdo:

1. **Rust, antes da webview:** captura o path (args de launch / "Open With") e detecta o tipo — extensão + sniff dos primeiros N bytes. Custo: microssegundos, zero JS carregado.
2. **Entrega o tipo cedo:** Rust injeta `window.__COSLU_BOOT__ = { kind, path }` via *initialization script* do Tauri → **zero round-trip** assíncrono. Fallback: `invoke("get_opened_file")` na primeira linha de JS.
3. **Bundle base com ZERO viewer:** o entry chunk tem só shell-skeleton + router. Nada de Shiki/PapaParse/pdf.js no caminho crítico.
4. **Router faz `import()` de UM chunk** — só o viewer do tipo detectado. Os demais nunca carregam nessa sessão.

**Propriedade garantida:**

> Bundle monolítico → custo de abertura **O(n)** no nº de formatos.
> Detecção-antes-de-load → custo *marginal* **O(1)**. Adicionar PDF não deixa abrir CSV mais lento.

**Ajustes de engenharia confirmados pela pesquisa (críticos):**

- **A injeção do boot global é em runtime, no Rust — não no `tauri.conf.json`.** O valor (`path`) só é conhecido no launch, então `window.__COSLU_BOOT__` tem de ser injetado via `WebviewWindowBuilder::initialization_script(...)` no Rust, *após* a detecção, no momento da criação da janela. O `tauri.conf.json` não comporta valor dinâmico por launch. (O contrato do `initialization_script`: roda após criar o global object, **antes** do parse do HTML e de qualquer script da página.)
- **Caveat documentado (não aplicável aqui, mas registrado):** a garantia "antes dos scripts da página" vale para URLs de protocolo local/custom. Em Android com URL *remota*, Tauri cai pra `onPageStarted`, sem essa garantia. Como Coslu Reader serve bundle local, não afeta — mas fica anotado para a fase mobile.
- **"Open With" no Windows spawna um processo novo por arquivo** (confirmado, §12.3). **Decisão §2 (uma janela por arquivo) ⇒ `single-instance` NÃO é necessário** (refinamento 2026-05-18): single-instance existe para *coordenar/rotear* entre processos; como cada arquivo abre seu próprio processo+janela e não há roteamento, cada processo só lê o **próprio `argv`** (1º argumento não-flag) e detecta o tipo. Adicionar um plugin que o modelo escolhido não usa contraria "não superengenheirar". O cuidado do plano ("não confiar em argv cru") se resolve validando que o argv aponta para um arquivo existente antes de usar — não exige plugin.

**Caveat honesto (cold-start):** o cold-start do motor WebView2 é um piso que não dá pra remover (~200–350 ms só pra criar o controller no melhor caso; cargas frias reais comumente ~2 s, dependente de hardware/disco). Pra formatos ultra-leves esse piso domina. O ganho da arquitetura é em formatos pesados e em manter o custo *marginal* de formatos plano — não em zerar o tempo absoluto.

### 3.3 Code-splitting (regras Vite/Rollup)

- Cada viewer = um `import()` dinâmico → chunk próprio.
- **Shiki é um chunk lazy compartilhado**, nunca no base. Vários viewers de texto/código dependem dele → vira chunk `shiki` carregado só ao abrir texto/código. JSON/CSV/imagem não pagam Shiki. (Confirmado: usar `shiki/core` ~12 KB + imports dinâmicos de tema/linguagem.)
- Libs pesadas (pdf.js, sql.js WASM) co-localizadas com seu viewer, nunca no entry.
- Detecção (mapa de extensão + tabela de magic-bytes) fica no Rust e no entry — tem que ser trivial, **sem lib pesada**.

## 4. Stack por camada

| Camada | Tecnologia | Observação |
|---|---|---|
| Shell nativo | **Tauri 2** (Rust) | Binário ~10 MB, WebView2 no Windows |
| IO / detecção | Rust: `read_file` (texto), `read_file_bytes` (binário), leitura por *range* (arquivos GB), sniff de magic-bytes | Abstraído atrás de um trait `FileSource` (ver §6) |
| Path do arquivo aberto | `std::env::args()` do próprio processo (modelo 1-janela/arquivo) | Validar que o argv aponta p/ arquivo existente; sem plugin |
| Runtime UI | **React 19 + TypeScript** | Estável |
| Build | **Vite 7** + `@vitejs/plugin-react` | Code-splitting por viewer. Requer Node **20.19+ / 22.12+**. Fixar versões (plugin-react já migrando rumo a Vite 8) |
| Layout | `allotment` | Split-pane (raw ↔ rendered); peer deps React 18/19 |
| Editor/raw | CodeMirror 6 (lazy) | Só quando precisa de view "texto bruto" |
| Highlight | Shiki (lazy, compartilhado) | Mesma engine do VS Code |

## 5. Modelo de viewers generalizados & catálogo

> **Ver [§13](#13-segurança--escolha-de-framework-por-caso)** para a análise de segurança lib-a-lib. Decisões de lib divergentes (DOCX, XLSX, SQLite) estão marcadas em §2.

### 5.1 O reframe (chave pra ser "reader de tudo")

Não é "1 formato = 1 viewer". O Coslu Reader é um conjunto **pequeno e limitado de viewers generalizados**, cada um chaveado por *forma de conteúdo*, alimentado por **decoders finos** que normalizam cada formato num **modelo comum**:

- **Adicionar formato = adicionar um decoder pequeno**, não um chunk novo. Preserva o boot-path O(1) (§3) e o "peso sob controle" (§1): o nº de *viewers* é limitado; a cobertura de *formatos* é enorme.
- **Garantia universal (fallback chain).** Todo arquivo abre com *algo*, nunca erro: `viewer rico → viewer básico → texto best-effort → hex`. É isso que torna "reader de tudo" verdade — não o tamanho do catálogo.
- **Arquivo recursivo.** O viewer de container (zip/tar/7z) lista entradas e cada entrada **realimenta o router**: abrir um `.json` dentro de um `.zip` funciona como arquivo normal. Multiplica a cobertura de graça (com cap de recursão — §11/§13.5).
- **Tiers de qualidade por família.** Tier **S** (render rico/fiel) → **A** (funcional) → **B** (degradado: texto/hex). Um formato pode subir de tier no tempo *sem mudar a arquitetura*.
- **Detecção por conteúdo antes de extensão** quando divergem — o Rust decide a *família* (§3.2), não o viewer final.

### 5.2 Escopo de formatos (decidido 2026-05-18)

**Dentro:** núcleo (texto/dados/tabular/documento/imagem/arquivo/fonte/hex) + **Mídia A/V** + **Foto RAW & PSD** + **3D/CAD** + **PPTX** (OOXML moderno — não confundir com Office legado).
**Fora por agora:** Office *legado binário* (`.doc`/`.ppt`/`.xls` antigos), e-mail (`.eml`/`.msg`), suites Apple (`.pages`/`.key`/`.numbers`). Revisitar depois — provável via fallback/conversão. *(Itens fora ainda abrem em Tier B via fallback chain — só não têm render dedicado.)*

### 5.3 Catálogo por família

Cada família = um viewer + um modelo normalizado + N decoders finos. `→§13` indica nota de segurança.

| # | Família | Modelo normalizado | Formatos cobertos (amostra) | Lib(s) | Tier | Fase |
|---|---|---|---|---|---|---|
| 1 | **Texto/Código** | texto + linguagem | toda extensão de código/markup/config via set de linguagens; `.log` `.diff`/`.patch` `.ini` `.toml`(raw) `.env` `.properties` `.conf` `Dockerfile` `.gitignore`, shell | Shiki (lazy compart.) + CodeMirror 6 (raw) | S | 1 |
| 2 | **Doc. de texto leve** | HTML renderizado + toggle raw | Markdown · reST · AsciiDoc · Org · Textile | markdown-it +DOMPurify; decoders finos p/ resto `→§13` | S (md) / A | 1 (md), 2 (resto) |
| 3 | **Dados estruturados** | árvore colapsável | JSON · JSONL/NDJSON · JSON5/JSONC · YAML · TOML · XML · plist(xml+bin) · CBOR · MessagePack · BSON | `JSON.parse`·js-yaml·`DOMParser` nativos + decoders smol (cbor-x/msgpackr/bson) `→§13` | S | 1 (JSON/YAML/XML/TOML), 2 (resto) |
| 4 | **Tabular** | linhas × colunas + schema (grid virtualizado compartilhado) | CSV/TSV/PSV · Parquet · Arrow/Feather · Avro · XLSX/ODS · tabela SQLite/DuckDB · NDJSON-as-table | PapaParse · hyparquet · apache-arrow · **SheetJS (CDN+hash)** · **`@sqlite.org/sqlite-wasm`** `→§13` | S | 1 (CSV/TSV), 2 (resto) |
| 5 | **Doc. paginado/rico** | páginas renderizadas (slides = páginas) | PDF · DOCX · **PPTX** · ODT · RTF · EPUB · FB2 · CBZ/CBR(quadrinho=archive+imagem) · DjVu(B) | pdf.js endurecido · **mammoth** · **PPTX: decoder OOXML→estrutura+texto+imagens** (lib a vetar) · epub.js · decoders finos `→§13` | S (PDF/EPUB) / A (DOCX/PPTX) | 3 |
| 6 | **Imagem** | bitmap/vetor + zoom/pan | PNG/JPEG/GIF/WebP/AVIF/BMP/TIFF/ICO/HEIC · APNG · **SVG** (`<img>` blob) · favicon · **RAW** (CR2/NEF/ARW/DNG) · **PSD/XCF** | nativo `<img>`/canvas; RAW via libraw-wasm; PSD via `@webtoon/psd` `→§13` | S (web/SVG) / A (RAW/PSD/TIFF) | 1 (web), 3 (RAW/PSD) |
| 7 | **Mídia A/V** | player + legenda | MP3/WAV/FLAC/OGG/Opus/AAC/M4A · MP4/WebM/MKV/MOV/AVI · SRT/VTT/ASS | nativo `<audio>`/`<video>` + parser de legenda fino | S (codecs WebView2) / B (resto = metadados+hex) | 2 |
| 8 | **3D/CAD** | cena WebGL (orbit) | glTF/GLB · OBJ+MTL · STL · PLY | three.js + loaders (lazy, ~heavy) `→§13` | S (glTF/STL/OBJ) / A | 3 |
| 9 | **Fonte** | specimen (alfabeto/tamanhos) | TTF/OTF/WOFF/WOFF2 | CSS `@font-face` nativo (~0 lib) + opentype.js (metadados, opc.) | S | 2 |
| 10 | **Arquivo/container** | árvore de entradas → **router recursivo** | ZIP · TAR · GZ/BZ2/XZ/ZSTD · 7Z · RAR · JAR/APK/IPA · CBZ/CBR | fflate (zip/gz) + decoder tar fino; 7z/RAR = lib WASM (A) `→§13` | S (zip/tar/gz) / A | 2 |
| 11 | **Binário estruturado** | header parse + hex | ELF/PE/Mach-O · `.class` · `.wasm`(wat) · `.pyc` · `.sqlite-wal` | parsers finos hand-rolled → hex | A (header) / B | 3 / oportunístico |
| 12 | **Hex / fallback universal** | dump hex + ASCII + busca + estrutura detectada | **literalmente qualquer coisa** | nativo + range-read + virtualização (§9) | B (garantido) | **1** (é a garantia base) |

### 5.4 Fallback chain (a garantia)

Para um arquivo qualquer: `família detectada (S/A) → texto best-effort se ~texto → hex (sempre funciona)`. Nenhum caminho termina em erro. Hex e router-recursivo de arquivo entram **na Fase 1** (são a garantia, não um extra). O mapeamento família→fase acima refina o roadmap §10.

## 6. Estrutura de projeto

```
coslu-reader/
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs / lib.rs    # lê argv → detecta tipo → cria janela com initialization_script dinâmico
│  │  ├─ io/                 # trait FileSource: desktop fs hoje, mobile depois
│  │  │  ├─ mod.rs           # trait + detecção (extensão + magic-bytes)
│  │  │  └─ desktop.rs       # impl Windows (fs + path via argv do processo)
│  │  └─ lib.rs              # commands: read_file, read_file_bytes, read_range, get_opened_file
│  └─ tauri.conf.json        # fileAssociations; janela; (boot global é injetado em runtime, NÃO aqui)
├─ src/
│  ├─ main.tsx               # entry: lê __COSLU_BOOT__ → router
│  ├─ shell/                 # toolbar, command palette, status bar, recentes
│  ├─ router/
│  │  ├─ registry.ts         # conteúdo/extensão → família; + fallback chain + recursão de arquivo
│  │  └─ ViewerHost.tsx      # Suspense + lazy load da família detectada
│  └─ viewers/
│     ├─ types.ts            # contrato: ViewerProps, NormalizedModel, Capabilities
│     ├─ families/           # 1 chunk por família: text/ struct/ table/ doc/ image/ media/ three/ font/ archive/ hex/
│     │   └─ table/
│     │       ├─ TableViewer.tsx     # grid virtualizado (modelo normalizado)
│     │       └─ decoders/           # csv.ts parquet.ts arrow.ts xlsx.ts sqlite.ts — finos, lazy
│     ├─ models/             # modelos normalizados (Tree, Table, Pages, Bitmap, …) compartilhados
│     └─ shiki/              # chunk compartilhado de highlight
└─ vite.config.ts            # manualChunks: isola shiki + pesados
```

**Contrato de viewer (`viewers/types.ts`):**

```ts
// Source bruto entregue pelo Rust (texto, bytes ou range sob demanda p/ arquivos GB)
interface Source { path: string; bytes?: Uint8Array; text?: string;
  readRange?: (off: number, len: number) => Promise<Uint8Array>; }

// Decoder fino: formato → modelo normalizado da família. Pode falhar → fallback chain.
type Decoder<M> = (src: Source) => Promise<M | { fallback: "text" | "hex" }>;

// Modelos normalizados compartilhados (um por família): TreeModel, TableModel,
// PagesModel, BitmapModel, SceneModel, ArchiveModel, HexModel, …
interface ViewerProps<M> { model: M; source: Source; theme: "light" | "dark"; }

interface FamilyModule<M> {
  default: React.ComponentType<ViewerProps<M>>;          // o viewer da família
  decoders: Record<string, () => Promise<Decoder<M>>>;   // por formato, lazy
  capabilities: { search?: boolean; copy?: boolean; export?: boolean; rawToggle?: boolean };
}
```

## 7. Estratégia mobile-ready

Tauri 2 suporta iOS/Android estável (desde out/2024), mas a própria equipe afirma que 2.0 **não** é o release "mobile como cidadão de primeira classe" — produção-capaz, porém menos maduro que desktop. Pra manter a porta aberta **sem custo agora**:

- **Frontend plataforma-agnóstico.** Viewers React + libs que rodam em qualquer webview (PapaParse, hyparquet, sql.js/WASM, pdf.js). Não usar deps Node-only.
- **Toda diferença de plataforma atrás do trait `FileSource` no Rust.** Desktop = fs + args. **Mobile = document pickers / share-intents / content URIs** — *não* há traversal livre de filesystem em iOS/Android (sandbox). A impl mobile do trait será baseada em picker/intent, não em path arbitrário. Portar = nova impl do trait, não reescrever o app.
- **Boot path O(1) importa ainda mais no mobile** (orçamento de memória/CPU menor).
- **Não-meta agora:** UI responsiva pra toque, gestos, plugins mobile. Só não criar travas que impeçam isso depois.

## 8. Build, empacotamento & distribuição (Windows)

- **CI:** GitHub Actions (runner Windows) → Tauri bundler: `.msi` + `.exe` (NSIS).
- **File association / "Open With":** `fileAssociations` no `tauri.conf.json`; o path chega como `argv` do processo recém-spawnado (Windows abre um processo por arquivo) — **sem `single-instance`** no modelo 1-janela/arquivo (§3.2).
- **Code signing:** Azure Trusted Signing ou cert EV. Sem assinatura → aviso do SmartScreen (degrada a vitrine).
- **Updates:** Tauri updater assinado, **sem analytics** (só checa release). Complemento: `winget`.
- **Landing page** simples sob a marca COSLU LABZ (download + screenshots) — parte da vitrine.

## 9. Performance budget & métrica

- **Métrica oficial:** tempo do spawn do processo → primeiro paint do conteúdo. **Reportar separando WebView2 frio vs. quente** — são regimes diferentes; misturá-los esconde o sinal.
- O ganho a *provar* é o **custo marginal por formato** (monolítico O(n) vs. router lazy O(1)), não o tempo absoluto — o piso WebView2 é ortogonal e não some.
- Instrumentar em build de dev (sem telemetria). Comparar *monolítico vs router lazy* pra **provar** o gap, não supor.
- Metas: custo marginal de formato ≈ plano; bundle base pequeno; arquivos grandes via *range-read* + virtualização de tabela/lista (nunca carregar GB inteiro na memória). A meta "cold open < ~1 s" só vale com WebView2 quente — declarar isso explicitamente.

## 10. Roadmap de engenharia

1. ✅ **Decisões fechadas (2026-05-18):** licença **MIT** · repo slug **`coslu-reader`** · **uma janela por arquivo** · DOCX **mammoth** · XLSX **SheetJS CDN+hash** · SQLite **`@sqlite.org/sqlite-wasm`** · PPTX **Tier A OOXML**. Domínio da landing: depois (não bloqueia).
2. **Scaffold** `coslu-reader`: Tauri 2 + React 19 + TS + Vite 7 (fixar versões; Node 20.19+/22.12+) + `LICENSE` MIT.
3. ✅ **Walking skeleton + garantia (2026-05-18):** captura de `argv` + detecção Rust (`io`) + boot path (`__COSLU_BOOT__` via `initialization_script` runtime) + router com **fallback chain** + 3 famílias: Texto, Dados (JSON) e **Hex**. Builds verdes (frontend + Rust, zero warning); 3 chunks lazy separados confirmados. Falta validação visual (`tauri dev`) e Markdown rico (Tier B→S depois).
4. ✅ **`read_bytes` + família Imagem (2026-05-18):** pipeline binário validado; SVG via `<img>` blob (§13, prova de não-execução de script ao vivo).
5. **IO desacoplado:** feito no **frontend** via contrato `Source` (`loadText/loadBytes`, fs *ou* memória) — habilita o router recursivo de arquivo. Trait `FileSource` no **Rust** (postura mobile-ready) ainda pendente — IO atual é mínimo (`read_text`/`read_bytes`).
6. **Harness de métrica** (§9) — pendente; já há evidência forte: entry estável ~197 KB enquanto libs pesadas (PapaParse, markdown-it+DOMPurify, fflate) ficam isoladas em chunks lazy por família.
7. **Iterar por família/tier (mapa em §5.3):**
   - ✅ **FASE 1 CONCLUÍDA (2026-05-18):** Texto · **Markdown rico** (markdown-it `html:false` + DOMPurify 3.4.5) · Dados/JSON · Tabular/CSV (PapaParse) · Imagem (raster+SVG) · Hex · **Arquivo recursivo** (fflate, caps anti zip-bomb, zip-in-zip) + fallback chain + boot path. **Extra:** tema completo no padrão **COSLU LABZ** ("Academic Journal Brutalism", tokens reusados) + **estampa S.08** no empty-state. Builds verdes (tsc + cargo, zero warning); 7 chunks lazy; tudo validado visualmente pelo Henrique.
   - **FASE 2 (em curso, 2026-05-18):** ✅ Tabular evoluída p/ **grid+decoders** (`TableModel` + `Grid` compartilhados; decoders lazy por formato): **CSV** + **Parquet** (hyparquet+compressors). ✅ **Database/SQLite** (`@sqlite.org/sqlite-wasm`, §2 — read-only + `quick_check`, seletor de tabela reusando o Grid). ✅ **Spreadsheet/XLSX** (SheetJS 0.20.3 **vendorizado do cdn.sheetjs.com + SHA-256**, decisão §2.5 operacionalizada — ver `src/vendor/sheetjs/PROVENANCE.md`; seletor de aba reusando o Grid). ✅ **Mídia A/V** (família, 0 lib) com **player custom no padrão COSLU** (play/±10s/scrubber/tempo/velocidade 0.5×–2×/mute; degrada p/ card Tier-B se o codec faltar). ✅ **Fonte** (TTF/OTF/WOFF specimen via FontFace, **0 lib**). ✅ **Arrow/Feather** (apache-arrow, decoder lazy no grid). ✅ **Arquivo-full**: ZIP + **TAR** (parser fino hand-rolled) + **GZIP/TGZ** (gunzip do fflate → tar ou arquivo único), recursão + caps mantidos. **✅ FASE 2 CONCLUÍDA (2026-05-18).** **Prova arquitetural:** `Grid`/`TableModel` reusados entre 3 famílias (Table/Database/Spreadsheet); entry estável **~198 KB** mesmo após somar PapaParse, markdown-it+DOMPurify, fflate, hyparquet, **sqlite-wasm (865 KB)**, **SheetJS (367 KB)** e **apache-arrow (169 KB)** — tudo isolado em chunks lazy/decoders. Validado visualmente pelo Henrique a cada passo.
   - **FASE 3 (em curso, 2026-05-19):** ✅ **PDF** (pdf.js endurecido §13.3: `isEvalSupported:false`, sem scripting/XFA, worker isolado). ✅ **PPTX/DOCX** — *pivô de arquitetura*: Tier-A puro reprovado em doc real → **converter Office→PDF via LibreOffice instalado** (`office_to_pdf` no Rust, processo separado, IPC bytes crus = `tauri::ipc::Response`) reusando o **PdfViewer**, via `OfficeToPdf` compartilhado; Tier-A como fallback (sem conversor / dentro de zip). XLSX fica no grid (dados > PDF). ✅ **.ipynb** (md+code+outputs; **Shiki** = highlighter lazy compartilhado §3.3/§4, tema `one-dark-pro`; §13: sanitização total, imagens só data:; bug-raiz aprendido: binário grande via IPC = bytes crus, nunca `number[]`). ✅ **EPUB** (epub.js pinado, scripting off §13.3; **endurecido contra corrida** do StrictMode: cancel-token + host limpo + navegação serializada + ResizeObserver). ✅ **3D/CAD** (three.js lazy, glb/stl/obj/ply, OrbitControls, §13 sem fetch externo, robusto/dispose). ✅ **PSD** (decoder lazy `@webtoon/psd` na família Imagem; fixture via `ag-psd` devDep). ✅ **Binário estruturado** (parser hand-rolled 0-dep: WASM/PE/ELF/Mach-O/Java.class + preview hex; **detecção por magic-bytes** §3.2 finalmente exercitada — pega sem-extensão/`.so`/`.o`). **Bônus:** `highlight()` compartilhado deixa o TextViewer pronto p/ Tier-S sem mudar arquitetura. **✅ CATÁLOGO §5 ESSENCIALMENTE COMPLETO (2026-05-19).** Único pendente: **RAW de câmera** (CR2/NEF/ARW/DNG) — **deferido como melhoria futura** (libraw-wasm pesado + sem fixture pra validar); hoje abre como **Hex** (Tier-B, §5.4 — sem buraco).
8. **Pós-catálogo / pré-release (backlog de engenharia — catálogo feito, faltam estas):**
   - **§13 hardening (CRÍTICO antes de release):** hoje roda com `app.security.csp: null`, sem Isolation Pattern, devtools on, `freezePrototype` off. Aplicar o checklist §13.2 (CSP sem `unsafe-*`, capabilities mínimas, Isolation Pattern, lockdowns) — é a maior área do plano ainda não endereçada.
   - **Vendorizar fontes** (Newsreader/JetBrains Mono) — hoje `@import` do Google Fonts; CSP estrita + offline exigem fontes locais (§13.5).
   - **§9 harness de métrica** — evidência qualitativa forte (entry ~198 KB estável), falta instrumentar spawn→1º paint (monolítico vs lazy) sem telemetria.
   - **§10.5 trait `FileSource` no Rust** (postura mobile-ready) — hoje IO mínimo (`read_text`/`read_bytes`/`office_to_pdf`); frontend já desacoplado via `Source`.
   - **§8 empacotamento/distribuição:** `.msi`/NSIS, **code signing** (SmartScreen), `fileAssociations` + "Open With", updater, landing.
   - **Text Tier-S:** TextViewer reusar o `highlight()` (Shiki) — incremental, sem mudar arquitetura.
   - **RAW** (libraw-wasm) quando houver fixture real.

## 11. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Peso PDF/DOCX | lazy obrigatório; medir bundle; considerar fallback pro viewer do SO |
| Arquivos de GB | range-read no Rust + virtualização |
| SmartScreen sem signing | orçar cert (Azure Trusted Signing) antes do lançamento |
| Detecção sem extensão | sniff de magic-bytes → fallback pro viewer de texto leve (nunca os pesados) |
| Escopo virando IDE | manter "reader-first", edição mínima |
| Mobile vira reescrita | isolar IO no trait `FileSource` desde o dia 1; impl mobile = picker/intent, não fs |
| Path do arquivo perdido no "Open With" | ler `argv` do próprio processo + validar que é arquivo existente; testar associação real após instalação (.msi) |
| Boot global não disponível a tempo | injetar via `initialization_script` runtime no Rust + fallback `invoke("get_opened_file")` |
| Deps de baixa manutenção (`hyparquet-compressors`, `docx-preview`, `epub.js`) | pinar versões; vendoring + auditoria; ter fallback (ex.: mammoth / viewer do SO) |
| Drift de versão Vite/plugin-react | fixar Vite 7 + `@vitejs/plugin-react`; documentar Node mínimo |
| **XSS via conteúdo de arquivo** (Markdown/SVG/DOCX/ipynb/EPUB) | DOMPurify (piso de versão §13.5) em todo viewer que emite HTML; render em `<iframe sandbox>`; CSP estrita. Ver §13 |
| **RCE via JS embutido em PDF** (CVE-2024-4367) | pdf.js ≥ patch + `isEvalSupported:false`, `enableScripting:false`, `enableXfa:false`, worker isolado. Ver §13.3 |
| **Zip-bomb / zip-slip** | listar-apenas; sanitizar nomes de entrada (rejeitar `..`/absolutos); teto global e por-entrada de bytes descompactados. Ver §13.5 |
| **Prototype pollution** (JSON/YAML/parsers) | `freezePrototype:true`; reviver removendo `__proto__`; `js-yaml ≥4.1.1`; árvore de JSON sem merge em protótipos. Ver §13 |
| **Cadeia de suprimentos XLSX** (npm `xlsx@0.18.5` vulnerável) | ✅ Decidido (§2): SheetJS ≥0.20.2 via `cdn.sheetjs.com`, **vendorizado com hash de integridade** + procedência documentada no repo |
| **PPTX = OOXML não-confiável** (zip+XML) | mesma postura do DOCX: cap zip-bomb/zip-slip no container; saída sanitizada (DOMPurify) + `<iframe sandbox>`; lib de extração vetada como o DOCX |
| **Advisories do Tauri** (origin confusion, fs-scope bypass, asset path traversal) | pin no patch mais recente do Tauri 2; escopos `fs`/`asset` mínimos sem glob; sem shell plugin no viewer. Ver §13.6 |
| **Amplificação de zip-bomb por recursão** (arquivo dentro de arquivo) | router recursivo com **cap de profundidade** + **budget cumulativo de bytes descompactados** compartilhado entre níveis; abortar ao estourar. Ver §5.1/§13.5 |
| **Codecs ausentes no WebView2** (MKV/AVI/FLAC podem não tocar) | detectar falha de `<video>`/`<audio>` → degradar pra Tier B (metadados + hex), nunca tela preta; comunicar no status bar |
| **DoS por decoder pesado** (RAW/PSD/3D: mesh/imagem gigante) | tetos de dimensão/vértices/bytes antes de alocar; decode em worker; timeout → fallback hex |
| **glTF/3D referenciando recurso externo** | bloquear fetch externo (CSP `connect-src 'none'` no contexto 3D); só aceitar buffers embutidos/locais |
| **Catálogo grande inflar o bundle** | decoder ≠ chunk: decoders são módulos lazy *dentro* da família; só família nova = chunk novo. Medir no harness §9 |

## 12. Validação técnica (pesquisa)

Premissas centrais checadas via pesquisa (maio/2026). Resumo dos veredictos:

| # | Premissa | Veredicto | Fato-chave |
|---|---|---|---|
| 1 | `initialization_script` roda antes dos scripts da página | **Confirmado** (1 caveat) | `WebviewWindowBuilder::initialization_script` roda após criar global, antes do parse do HTML. Caveat Android/URL remota não aplica (bundle local). Valor dinâmico → injetar em runtime no Rust, não no `tauri.conf.json` |
| 2 | Tauri 2 suporta iOS/Android oficialmente | **Nuance** | Estável desde out/2024, mas não "first-class"; risco real é acesso a arquivo no mobile (sandbox → picker/intent) |
| 3 | File association + path no Windows | **Confirmado** | `fileAssociations` + Windows spawna **processo novo por arquivo** → ler `argv` do próprio processo basta; `single-instance` só seria necessário com roteamento (descartado em §2) |
| 4 | Vite 7 + React 19 estáveis e compatíveis | **Confirmado** | Vite 7 estável (jun/2025), React 19 estável; sem incompatibilidade; Node 20.19+/22.12+ |
| 5 | Libs (hyparquet, sql.js, docx-preview, shiki, allotment) | **Confirmado / Nuance** | hyparquet ~9.7 KB gzip ✓; sql.js ativo ✓; shiki lazy ✓; allotment ✓; `hyparquet-compressors` e `docx-preview` = manutenção lenta (pinar + fallback) |
| 6 | WebView2 cold-start é piso; O(1) por formato é sólido | **Confirmado** | ~200–350 ms controller (melhor caso), ~2 s+ frio real; dispatch por assinatura é constante no nº de formatos — raciocínio sólido *no marginal*, não no absoluto |

**Conclusão:** a arquitetura do plano é tecnicamente sólida. Os únicos ajustes obrigatórios são de implementação (injeção do boot em runtime via Rust; captura de `argv` para o path; pin de versões; impl mobile por picker), não de concepção. O diferencial "detecção-antes-de-load" é válido — desde que comunicado como *custo marginal O(1) por formato*, não como tempo absoluto (o piso WebView2 permanece).

---

## 13. Segurança & escolha de framework por caso

> **Modelo de ameaça.** Coslu Reader abre **arquivos não-confiáveis** do disco. A maior superfície de ataque de um *viewer* não é a rede — é o **parser de arquivo malicioso**. Toda lib JS roda dentro do WebView2 e compartilha seus privilégios: um RCE no contexto JS = código arbitrário no renderer. Portanto "framework mais seguro" se traduz, na prática, em: (a) shell que isola por construção (Tauri 2); (b) por formato, a lib que minimiza exec de código / XSS / DoS e é mantida; (c) uma estratégia transversal de saneamento e *budgets*.
> Pesquisa de maio/2026 — versões/CVEs verificados via fontes oficiais.

### 13.1 Camada shell — por que Tauri 2 é a escolha segura

| Vetor | Tauri 2 | Electron |
|---|---|---|
| Runtime do renderer | WebView2 (Edge/Chromium): **sem Node.js, sem `require`** | Chromium + Node.js; Node precisa ser desligado à mão |
| Core | **Rust** (memory-safe) — elimina classes de buffer-overflow/UAF no shell | C++/JS |
| Acesso frontend→sistema | Só via IPC `invoke` para **commands** allowlistados (default-deny desde v2) | Node/`ipcMain` completo até endurecer |
| Controle de acesso | **capabilities → permissions → scopes** compilado no binário | Nenhum nativo; bolt-on |
| Patch do WebView | Herda updates do WebView2 (cadência Microsoft) | App tem de embarcar e atualizar Chromium |

**Veredicto:** para abrir arquivos não-confiáveis, Tauri 2 é a escolha correta. Se um documento malicioso disparar script no renderer, em Tauri esse script cai num WebView **sem Node, sem filesystem, sem IPC** salvo capability explícita. O equivalente em Electron exigiria, manualmente e a cada release: `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, bridge de preload, `enableRemoteModule` off, + patch próprio do Chromium — tudo opt-in e fácil de regredir. Em Tauri as proteções são estruturais. *(Stack já travada em §2; esta seção é a justificativa de segurança e a base do hardening.)*

### 13.2 Checklist de hardening Tauri 2 (nomes exatos de config/API)

- **CSP** (`tauri.conf.json` → `app.security.csp`): alvo `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' asset: http://asset.localhost; object-src 'none'; frame-src 'none'; base-uri 'none'`. Tauri injeta nonce/hash dos próprios scripts em compile-time — manter. **Nunca** `unsafe-inline`/`unsafe-eval` (reabre a cadeia XSS→RCE); ofensores comuns: CSS-in-JS runtime, libs de PDF/markdown/highlight. Usar `dev_csp` separado para o dev não relaxar a prod. **Não** usar `dangerousDisableAssetCspModification`.
- **Capabilities** (`src-tauri/capabilities/*.json`): uma capability, allowlist mínima de commands. A janela que renderiza conteúdo não-confiável mapeia para **nenhuma** permissão perigosa (`shell:`, `process:`, `fs:` amplo). Escopo `fs` restrito ao path aberto pelo usuário, **sem glob**. `assetProtocol.scope` mínimo (dir temp/extração), nunca `$HOME`/`**`.
- **Isolation Pattern** (`app.security.pattern: { use: "isolation" }`): roteia todo IPC por um iframe sandbox lacrado antes de chegar ao Rust. **Recomendado habilitar** — é a última linha se conteúdo não-confiável conseguir executar script e tentar forjar `invoke`.
- **Lockdowns de produção:** `freezePrototype:true`; devtools off no release; `dragDropEnabled:false` se não usado; sem URLs remotas (janela sempre local); nunca carregar conteúdo remoto numa janela com API Tauri privilegiada.
- **Parsing pesado no Rust, não no WebView:** desarquivar/parsear no Rust mantém crashes fora do caminho privilegiado — mas a memory-safety do Rust **não** cobre a lógica do crate (zip-slip, zip-bomb, parsers `unsafe`/C-FFI). Parsear no WebView evita bugs de memória nativa mas expõe o resultado à superfície de XSS — pior para um viewer. Regra: parsear no Rust + sanitizar caminhos + capar ratio/tamanho de descompressão + preferir crates safe-Rust.

### 13.3 Comparação de libs por caso (qual caso → qual framework)

Cada linha: candidatos → segurança / manutenção / utilidade → **recomendação** + *usar quando*.

**Texto / markup (Fase 1)**

| Caso | Candidatos | Recomendação | Por quê (segurança) |
|---|---|---|---|
| **Markdown** | markdown-it · marked · remark/micromark | **markdown-it** com `html:false` (default) **+ DOMPurify** na saída | markdown-it é o mais seguro por padrão (escapa HTML cru, filtra `javascript:`/`vbscript:`/`data:`). DOMPurify é obrigatório em qualquer parser. *Usar quando:* todo .md não-confiável. **Nunca `html:true`.** |
| **YAML** | `yaml` (eemeli) · `js-yaml` | **`js-yaml ≥ 4.1.1`** (piso explícito) | `load` é safe-by-default desde 4.x (era de code-exec acabou). CVE-2025-64718 (prototype pollution via merge `<<`) corrigida em 4.1.1. `yaml` é alternativa igualmente segura se quiser posições de origem. |
| **CSV/TSV** | PapaParse | **PapaParse ≥5.2.0 (usar 5.5.3)**, streaming + Web Worker, render como texto | Formula/CSV injection é problema **só de export** — viewer que renderiza célula como texto no DOM tem zero exposição. Risco real = DoS em arquivo gigante → streaming/`step`. |
| **XML** | `DOMParser` nativo · `fast-xml-parser` | **`DOMParser` nativo** (`application/xml`) | WebView2/Chromium **não resolve entidades externas** → XXE/SSRF impossível; zero dependência. `fast-xml-parser` teve 2026 ruim (CVE-2026-25896 CVSS 9.3 + DoS de expansão). |
| **SVG** | `<img>` (blob) · inline · inline+DOMPurify | **`<img src=blob:>`** (isolamento total); inline só como feature opt-in com DOMPurify perfil SVG | SVG é vetor XSS de primeira classe (`<script>`, `on*`, `foreignObject`, `xlink:href`). `<img>` neutraliza tudo. |
| **JSON/JSONL** | `JSON.parse` nativo | **`JSON.parse`** + reviver removendo `__proto__` + árvore pollution-safe | Parser é seguro; o risco de prototype pollution está **no código da tree-view** (usar `Object.entries`/`Map`, nunca merge em protótipo). |

**Binário / pesado (Fases 2–3)**

| Caso | Candidatos | Recomendação | Por quê (segurança) |
|---|---|---|---|
| **PDF** | pdf.js · EmbedPDF (PDFium/WASM) · viewer do SO | **pdf.js** ≥ patch 5.x com `isEvalSupported:false`, `enableScripting:false`, `enableXfa:false`, worker | CVE-2024-4367 (exec de JS arbitrário) corrigida em 4.2.67; mitigações obrigatórias mesmo em build patcheado. EmbedPDF = alternativa fidelidade-first (sandbox WASM capa bugs de memória do PDFium). **SO viewer = rejeitado** (app não-controlado/desatualizado). *Usar quando:* default pdf.js endurecido; EmbedPDF se fidelidade > minimizar superfície C++. |
| **DOCX** | docx-preview · mammoth | ✅ **DECIDIDO (§2): mammoth + DOMPurify** em `<iframe sandbox>` | mammoth emite HTML semântico pequeno e auditável (menor superfície); fidelidade pixel sacrificada conscientemente (reader-first). |
| **PPTX** | decoder OOXML próprio · lib JS tipo PPTXjs | ✅ **DECIDIDO (§2): decoder OOXML → estrutura+texto+imagens** (Tier A) + DOMPurify + `<iframe sandbox>` | PPTX = zip de XML (mesma classe do DOCX): zip-bomb/zip-slip no container, XXE mitigado (sem resolver de entidade externa no WebView). Libs JS de render fiel (PPTXjs) = pesadas/jQuery/manutenção fraca → rejeitadas. Lib específica de extração a vetar como o DOCX. *Usar quando:* preview legível de slides; fidelidade pixel não é meta. |
| **XLSX** | SheetJS · ExcelJS | ✅ **DECIDIDO (§2): SheetJS ≥0.20.2 via `cdn.sheetjs.com`** vendorizado com hash | npm `xlsx@0.18.5` está **abandonado e vulnerável** (CVE-2023-30533 proto-pollution, CVE-2024-22363 ReDoS); builds seguros não estão no npm — vendoring com hash de integridade + procedência documentada. |
| **SQLite** | sql.js · `@sqlite.org/sqlite-wasm` | ✅ **DECIDIDO (§2): `@sqlite.org/sqlite-wasm`** (oficial), read-only + `PRAGMA quick_check` + defensivo | Sandbox WASM é fronteira real (corrupção fica no módulo, sem RCE no host); risco residual = DoS por DB gigante/schema malicioso. Build oficial = uptake de CVE mais rápido que sql.js. |
| **Parquet** | hyparquet (+ hyparquet-compressors) | **hyparquet** com tetos estritos de tamanho/linhas/bytes descompactados; compressors vendorizado e monitorado | Puro JS (sem nativo) → bugs não são RCE. Risco = bomba de descompressão / metadata maliciosa → DoS de alocação. `hyparquet-compressors` ~inativo (~1 ano). |
| **ZIP** | fflate | **fflate**, **listar-apenas**, sanitização de path + teto global/por-entrada | Não valida path nem expansão (é do chamador). Rejeitar `..`/absolutos (zip-slip); capar ratio/tamanho (zip-bomb); descompactar lazy só a entrada aberta. |
| **.ipynb** | notebookjs · ipynb2html | **notebookjs** + DOMPurify explicitamente cabeado, em `<iframe sandbox>` | Notebook embute HTML/JS/Markdown arbitrário — saneamento obrigatório. notebookjs não injeta DOMPurify automaticamente no browser (é você que liga). |
| **EPUB** | epub.js | **epub.js** com scripting off (`allowScriptedContent:false`), `<iframe sandbox>` restritivo, CSP bloqueando rede, sanitização pré-render; vendorizar (manutenção fraca) | Renderiza XHTML/CSS não-confiável; riscos residuais = escape de sandbox via `javascript:`/`window.opener`, exfiltração CSS, beacons. |

### 13.4 Mapeamento geral (caso → lib → postura → mitigação obrigatória → fase)

| Formato/caso | Lib escolhida | Onde parseia | Mitigação obrigatória | Fase |
|---|---|---|---|---|
| Código/log/diff | Shiki (`shiki/core` lazy) | WebView | CSP sem `unsafe-*`; sem HTML cru | 1 |
| Markdown | markdown-it (`html:false`) | WebView | **DOMPurify** + iframe sandbox | 1 |
| JSON/JSONL | `JSON.parse` nativo | WebView | reviver anti-`__proto__`; tree pollution-safe | 1 |
| CSV/TSV | PapaParse 5.5.3 | WebView (worker) | streaming; render como texto | 1 |
| YAML | js-yaml ≥4.1.1 | WebView | pin de versão; sem merge em protótipo | 1 |
| XML | `DOMParser` nativo | WebView | `application/xml`; checar `parsererror` | 1 |
| Imagem | `<img>` asset protocol | — | `assetProtocol.scope` mínimo | 1 |
| SVG | `<img src=blob:>` | — | isolamento por `<img>`; inline só opt-in+DOMPurify | 1 |
| Parquet | hyparquet | WebView/Rust | tetos de linhas/bytes; vendoring compressors | 2 |
| SQLite | `@sqlite.org/sqlite-wasm` | WebView (WASM) | read-only; `quick_check`; cap memória | 2 |
| XLSX | SheetJS (CDN+hash, vendorizado) | WebView | hash de integridade; render como texto | 2 |
| GeoJSON/GPX | Leaflet | WebView | sem tiles remotos (CSP); validar geometria | 2 |
| ZIP | fflate | Rust/WebView | listar-apenas; anti zip-slip/bomb | 2 |
| PDF | pdf.js endurecido | WebView (worker) | `enableScripting/eval/xfa:false` | 3 |
| DOCX | mammoth | WebView | DOMPurify + iframe sandbox | 3 |
| PPTX | decoder OOXML (estrutura+texto+imagens) | Rust/WebView | zip-bomb/slip cap; DOMPurify + iframe sandbox | 3 |
| .ipynb | notebookjs | WebView | DOMPurify cabeado + iframe sandbox | 3 |
| EPUB | epub.js | WebView (iframe) | scripting off; sandbox; CSP bloqueia rede | 3 |
| TOML/CBOR/msgpack/BSON/plist | decoders smol (toml/cbor-x/msgpackr/bson) | WebView | pin; tetos de tamanho; sem `__proto__` na árvore | 1 (TOML) / 2 |
| Arrow/Feather/Avro | apache-arrow / decoder fino | WebView | tetos de linhas/bytes; render como texto | 2 |
| Fonte (TTF/OTF/WOFF) | `@font-face` nativo (+opentype.js opc.) | — | sem exec; specimen estático | 2 |
| Mídia (A/V + legenda) | `<audio>`/`<video>` nativo | WebView2 | sem rede; falha de codec → Tier B (metadados+hex) | 2 |
| 3D/CAD (glTF/STL/OBJ/PLY) | three.js + loaders (lazy) | WebView | `connect-src 'none'`; tetos de vértices; decode em worker | 3 |
| RAW (CR2/NEF/ARW/DNG) | libraw-wasm (lazy) | WebView (WASM) | sandbox WASM; tetos de dimensão; timeout→hex | 3 |
| PSD/XCF | `@webtoon/psd` (lazy) | WebView | tetos de camadas/dimensão; sem exec | 3 |
| **Arquivo recursivo** | router re-submete entrada | Rust/WebView | **cap de profundidade + budget cumulativo** (anti amplificação) | 1 (skeleton) → 2 |
| Binário estruturado (ELF/PE/wasm…) | parser fino → hex | WebView | só leitura de header; degradar pra hex | 3 |
| **Hex / fallback universal** | nativo (range-read) | Rust→WebView | sem parsing = sem exec; virtualização p/ GB | **1 (garantia)** |

### 13.5 Estratégia transversal de segurança

1. **Saneamento universal de HTML.** Todo viewer que emite HTML (Markdown, SVG inline, DOCX, .ipynb, EPUB) passa por **DOMPurify**. **Piso de versão: usar a release que corrija *ambos* CVE-2026-0540 e o bypass de prototype-pollution — a pesquisa divergiu entre 3.3.2 e 3.4.0; adotar o piso mais alto (≥ 3.4.0) e reconfirmar no momento da adoção.** Pinar e auditar.
2. **Iframe sandbox para conteúdo rico não-confiável.** DOCX/ipynb/EPUB renderizam dentro de `<iframe sandbox>` *sem* `allow-scripts`/`allow-same-origin`/`allow-top-navigation`.
3. **CSP bloqueia rede a partir do conteúdo.** Nenhum viewer faz requisição externa; `object-src 'none'`, `frame-src` controlado, sem tiles/CDN remotos em runtime.
4. **Budgets de DoS globais.** Teto de bytes descompactados, teto de tempo de parse e cap de memória aplicados a *todos* os formatos compressíveis/recursivos (zip, parquet, sqlite, pdf, xml) **+ tetos de dimensão/vértices** (imagem/RAW/PSD/3D). **Router recursivo de arquivo:** cap de profundidade de aninhamento **e budget de bytes descompactados cumulativo compartilhado entre níveis** (anti amplificação de zip-bomb) — abortar e degradar pra hex ao estourar.
5. **Pins de segurança (floor):** DOMPurify ≥3.4.0 · js-yaml ≥4.1.1 · PapaParse ≥5.2.0 (usar 5.5.3) · pdf.js ≥ patch CVE-2024-4367 (5.x) · SheetJS ≥0.20.2 (CDN+hash) · Tauri 2 sempre no patch mais recente.
6. **Preferir nativo a lib** onde houver paridade: `DOMParser` (XML) e `JSON.parse` (JSON) encolhem a superfície e eliminam deps.

### 13.6 Advisories materiais do Tauri (mitigações)

| Advisory | Risco | Mitigação |
|---|---|---|
| GHSA-7gmj-67g7-phm9 (Origin Confusion, 2026) | página remota invoca IPC local | pin no patch; nunca origem remota em janela privilegiada |
| GHSA-57fm-592m-34r7 (iFrame Origin Bypass) | iframe acessa API Tauri | patch + `frame-src 'none'` |
| GHSA-q9wv-22m9-vhqh (fs scope via dialog/drag-drop) | escapa escopo `fs` | desligar drag-drop; validar paths |
| GHSA-6mv3-wm7j-h4w5 / wmff / 28m8 (fs glob/dotfile/symlink) | escopo amplo demais | escopos não-glob; canonicalizar e rejeitar symlink |
| GHSA-c9pr-q8gx-3mgp (shell `open` bypass) | bypass de escopo do shell | **não incluir** shell plugin na capability do viewer |
| CVE-2024-24576 (Rust stdlib) | herdado | pin Tauri 2 + WebView2 atualizado |

### 13.7 Conflitos com decisões anteriores → ✅ resolvidos (2026-05-18)

- **DOCX:** ✅ `mammoth` (segurança/peso > fidelidade). §5 e §13.3 alinhados.
- **SQLite:** ✅ `@sqlite.org/sqlite-wasm` (build oficial, patches mais rápidos).
- **XLSX:** ✅ SheetJS ≥0.20.2 via `cdn.sheetjs.com` vendorizado com hash.
- **PPTX:** ✅ decoder OOXML → estrutura+texto+imagens (Tier A), mesma postura do DOCX.
- **XML:** `DOMParser` nativo — confirmado como a escolha mais segura, sem mudança.

> **Conclusão de segurança.** A escolha de shell (Tauri 2) é a correta e dá isolamento estrutural; o trabalho de segurança real concentra-se no *parsing por formato* e numa disciplina transversal (DOMPurify ≥3.4.0, iframe sandbox, CSP sem rede, budgets de DoS, pins). Nenhum achado invalidou a arquitetura — **todas as escolhas de lib estão fechadas (§2)**; nenhuma decisão de segurança pendente.
