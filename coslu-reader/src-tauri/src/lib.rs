//! Coslu Reader — shell nativo (walking skeleton, §10.3 do PLANEJAMENTO).
//!
//! Boot path (§3.2): capturamos o path do argv DO PRÓPRIO PROCESSO
//! (modelo "uma janela por arquivo" decidido em §2 → cada "Open With"
//! abre um processo novo; não há roteamento, logo não precisa de
//! single-instance). Detectamos a família no Rust ANTES da webview e
//! injetamos `window.__COSLU_BOOT__` via `initialization_script`
//! (roda antes de qualquer script da página → zero round-trip).

mod io;

use std::sync::Mutex;
use tauri::{WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Clone, serde::Serialize)]
pub struct OpenedFile {
    path: String,
    name: String,
    kind: io::Kind,
}

/// Guardado no state como fallback do boot global (`invoke("get_opened_file")`).
struct BootState(Mutex<Option<OpenedFile>>);

/// Lê o path do arquivo a abrir a partir do argv do processo.
/// argv[0] é o exe; o primeiro argumento "não-flag" é o arquivo.
fn opened_file_from_args() -> Option<OpenedFile> {
    let raw = std::env::args().skip(1).find(|a| !a.starts_with('-'))?;
    let path = std::path::PathBuf::from(&raw);
    if !path.is_file() {
        return None;
    }
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    Some(OpenedFile {
        path: path.to_string_lossy().to_string(),
        name,
        kind: io::detect(&path),
    })
}

#[tauri::command]
fn get_opened_file(state: tauri::State<'_, BootState>) -> Option<OpenedFile> {
    state.0.lock().ok().and_then(|g| g.clone())
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_bytes(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

/// Localiza o binário do LibreOffice (NÃO empacotamos — usa o que já
/// existe na máquina). Sem ele, o frontend cai no Tier-A.
fn find_soffice() -> Option<std::path::PathBuf> {
    let candidates = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ];
    candidates
        .iter()
        .map(std::path::PathBuf::from)
        .find(|p| p.is_file())
}

/// Converte Office (PPTX/DOCX/XLSX/…) → PDF via LibreOffice headless,
/// em um PROCESSO separado (isolado do webview — §13). A saída é
/// renderizada pelo PdfViewer já endurecido. Erros são sentinelas que
/// o frontend usa para cair no fallback Tier-A.
#[tauri::command]
fn office_to_pdf(path: String) -> Result<tauri::ipc::Response, String> {
    let soffice = find_soffice().ok_or("no-converter")?;
    let src = std::path::PathBuf::from(&path);
    if !src.is_file() {
        return Err("not-a-file".into());
    }
    let tmp = std::env::temp_dir().join(format!("coslu_lo_{}", std::process::id()));
    std::fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    // perfil dedicado evita conflito com uma instância aberta do LibreOffice
    let profile = format!(
        "-env:UserInstallation=file:///{}",
        tmp.join("profile").to_string_lossy().replace('\\', "/")
    );
    let out = std::process::Command::new(&soffice)
        .args(["--headless", "--norestore", "--invisible"])
        .arg(&profile)
        .args(["--convert-to", "pdf", "--outdir"])
        .arg(&tmp)
        .arg(&src)
        .output()
        .map_err(|e| format!("spawn-failed: {e}"))?;
    if !out.status.success() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err(format!(
            "convert-failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("bad-name")?;
    let pdf = tmp.join(format!("{stem}.pdf"));
    let bytes = std::fs::read(&pdf).map_err(|e| format!("no-output: {e}"))?;
    let _ = std::fs::remove_dir_all(&tmp);
    // bytes crus (ArrayBuffer no JS) — NÃO number[] (IPC eficiente p/ PDF grande)
    Ok(tauri::ipc::Response::new(bytes))
}

/// Abre a tela "Aplicativos padrão" do Windows (deep-link
/// ms-settings). NÃO define o padrão (Win8+ proíbe app fazer isso
/// silenciosamente) — leva o usuário direto pra escolher por tipo.
#[tauri::command]
fn open_default_apps() -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", "ms-settings:defaultapps"])
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// 1ª execução SEM arquivo (cenário pós-instalação / onboarding):
/// abre uma única vez a tela "Aplicativos padrão" do Windows pra o
/// usuário escolher os tipos. Marcador em %APPDATA% impede repetir.
fn maybe_first_run_onboarding(opened: &Option<OpenedFile>) {
    if opened.is_some() {
        return; // abriu um arquivo: está usando, não onboardar
    }
    let Ok(appdata) = std::env::var("APPDATA") else {
        return;
    };
    let dir = std::path::Path::new(&appdata).join("com.coslulabz.reader");
    let marker = dir.join("onboarded");
    if marker.exists() {
        return; // já fez o onboarding
    }
    let _ = std::fs::create_dir_all(&dir);
    if std::fs::write(&marker, b"1").is_ok() {
        let _ = std::process::Command::new("cmd")
            .args(["/C", "start", "", "ms-settings:defaultapps"])
            .spawn();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let opened = opened_file_from_args();
    maybe_first_run_onboarding(&opened);

    // Boot global: { path, name, kind } ou null. Serializado com segurança.
    let boot_json = serde_json::to_string(&opened).unwrap_or_else(|_| "null".into());
    let init_script = format!("window.__COSLU_BOOT__ = {boot_json};");

    tauri::Builder::default()
        .manage(BootState(Mutex::new(opened)))
        .invoke_handler(tauri::generate_handler![
            get_opened_file,
            read_text,
            read_bytes,
            office_to_pdf,
            open_default_apps
        ])
        .setup(move |app| {
            // Janela criada AQUI (não no tauri.conf.json) porque o
            // initialization_script depende de valor dinâmico por launch.
            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Coslu Reader")
                .inner_size(800.0, 600.0)
                .initialization_script(&init_script)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
