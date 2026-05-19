//! Detecção de tipo de arquivo (§3.2 do PLANEJAMENTO).
//! Regra: extensão primeiro, sniff de magic-bytes como fallback,
//! e por fim heurística texto-vs-binário. Trivial e sem lib pesada.
//! O resultado é a *família* (skeleton: Text | Data | Hex), não o viewer final.

use std::path::Path;

#[derive(Debug, Clone, Copy, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Text,
    Markdown,
    Data,
    Table,
    Database,
    Spreadsheet,
    Image,
    Media,
    Font,
    Pdf,
    Pptx,
    Docx,
    Epub,
    Ipynb,
    ThreeD,
    Binary,
    Archive,
    Hex,
}

/// Quantos bytes ler para o sniff. Barato e suficiente para texto-vs-binário.
const SNIFF_LEN: usize = 8192;

fn kind_by_extension(ext: &str) -> Option<Kind> {
    let e = ext.to_ascii_lowercase();
    match e.as_str() {
        // Família Doc. de texto leve — skeleton: Markdown (Tier S)
        "md" | "markdown" | "mdown" | "mkd" | "mkdn" => Some(Kind::Markdown),
        // Família Notebook — Jupyter (.ipynb): md/code/outputs (§13)
        "ipynb" => Some(Kind::Ipynb),
        // Família Dados (árvore) — skeleton: só JSON
        "json" | "jsonl" | "ndjson" | "jsonc" | "json5" => Some(Kind::Data),
        // Família Tabular — grid (CSV/TSV/PSV + Parquet via decoders)
        "csv" | "tsv" | "psv" | "parquet" | "arrow" | "feather" | "ipc" => {
            Some(Kind::Table)
        }
        // Família Database — SQLite (lista tabelas, reusa o grid)
        "sqlite" | "sqlite3" | "db" => Some(Kind::Database),
        // Família Spreadsheet — XLSX/ODS (lista abas, reusa o grid)
        "xlsx" | "xlsm" | "xls" | "ods" => Some(Kind::Spreadsheet),
        // Família Imagem — raster web + SVG (render via <img> blob, §13)
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "avif" | "bmp" | "ico"
        | "apng" | "svg" | "psd" | "psb" => Some(Kind::Image),
        // Família Mídia A/V — player nativo (Tier B se o codec faltar)
        "mp3" | "wav" | "flac" | "ogg" | "oga" | "opus" | "aac" | "m4a"
        | "mp4" | "m4v" | "webm" | "mkv" | "mov" | "avi" => Some(Kind::Media),
        // Família Fonte — specimen via FontFace (0 lib)
        "ttf" | "otf" | "woff" | "woff2" | "ttc" => Some(Kind::Font),
        // Família Doc. paginado — PDF (pdf.js endurecido §13.3)
        "pdf" => Some(Kind::Pdf),
        // Família Slides — PPTX (converter→PDF; Tier-A fallback)
        "pptx" | "pptm" => Some(Kind::Pptx),
        // Família Documento — DOCX/ODT (converter→PDF; Tier-A fallback)
        "docx" | "docm" | "odt" => Some(Kind::Docx),
        // Família E-book — EPUB (epub.js, scripting off, §13.3)
        "epub" => Some(Kind::Epub),
        // Família 3D/CAD — three.js (glb/gltf/stl/obj/ply), §13 sem fetch
        "glb" | "gltf" | "stl" | "obj" | "ply" => Some(Kind::ThreeD),
        // Família Binário estruturado — header + hex (0 dep)
        "wasm" | "exe" | "dll" | "so" | "elf" | "class" | "dylib"
        | "pyc" => Some(Kind::Binary),
        // Família Arquivo/container — ZIP + TAR + GZIP/TGZ
        "zip" | "jar" | "war" | "apk" | "tar" | "gz" | "tgz" => {
            Some(Kind::Archive)
        }
        // Família Texto/Código (amostra; Shiki cobre o resto depois)
        "txt" | "log" | "diff" | "patch" | "ini" | "toml"
        | "yaml" | "yml" | "xml" | "html" | "htm" | "css"
        | "js" | "mjs" | "cjs" | "ts" | "tsx" | "jsx" | "rs" | "py" | "go"
        | "c" | "h" | "cpp" | "hpp" | "java" | "kt" | "rb" | "php" | "sh"
        | "bat" | "ps1" | "sql" | "conf" | "env" | "properties" | "gitignore" => {
            Some(Kind::Text)
        }
        _ => None,
    }
}

/// Heurística texto-vs-binário sobre uma amostra: sem NUL e maioria
/// imprimível/UTF-8 ⇒ texto; caso contrário binário.
fn looks_textual(sample: &[u8]) -> bool {
    if sample.is_empty() {
        return true; // arquivo vazio: trate como texto (abre vazio, não hex)
    }
    if sample.contains(&0) {
        return false; // NUL ⇒ binário
    }
    let suspicious = sample
        .iter()
        .filter(|&&b| b < 0x09 || (b > 0x0d && b < 0x20))
        .count();
    // tolera < 5% de bytes de controle "estranhos" (ex.: UTF-8 multibyte ok)
    (suspicious * 100) < (sample.len() * 5)
}

/// Magic-bytes de binários estruturados conhecidos (§3.2: detecção
/// por conteúdo, não só extensão — pega .so/.o/sem-extensão).
fn is_structured_binary(b: &[u8]) -> bool {
    if b.len() < 4 {
        return false;
    }
    let m4 = &b[0..4];
    m4 == b"\x7FELF"                       // ELF
        || m4 == b"\0asm"                  // WebAssembly
        || m4 == [0xCA, 0xFE, 0xBA, 0xBE]  // Java .class / Mach-O fat
        || m4 == [0xFE, 0xED, 0xFA, 0xCE]  // Mach-O 32 (BE/LE)
        || m4 == [0xCE, 0xFA, 0xED, 0xFE]
        || m4 == [0xFE, 0xED, 0xFA, 0xCF]  // Mach-O 64
        || m4 == [0xCF, 0xFA, 0xED, 0xFE]
        || (b[0] == 0x4D && b[1] == 0x5A) // PE/DOS "MZ"
}

/// Detecta a família do arquivo. Nunca falha: o pior caso é `Hex`
/// (a garantia universal — nada termina em erro, §5.4).
pub fn detect(path: &Path) -> Kind {
    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
        if let Some(k) = kind_by_extension(ext) {
            return k;
        }
    }
    // Sem extensão conhecida → sniff (magic-bytes antes de texto/hex)
    match std::fs::File::open(path) {
        Ok(mut f) => {
            use std::io::Read;
            let mut buf = vec![0u8; SNIFF_LEN];
            let n = f.read(&mut buf).unwrap_or(0);
            buf.truncate(n);
            if is_structured_binary(&buf) {
                Kind::Binary
            } else if looks_textual(&buf) {
                Kind::Text
            } else {
                Kind::Hex
            }
        }
        // Não conseguiu nem abrir para sniff: deixa o hex viewer reportar
        Err(_) => Kind::Hex,
    }
}
