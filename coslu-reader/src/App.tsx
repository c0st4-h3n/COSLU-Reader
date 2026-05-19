import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { resolveBoot, type OpenedFile } from "./boot";
import { ViewerHost } from "./router/ViewerHost";
import { fsSource, resetBudget } from "./source";
import { StampS08 } from "./brand/Stamp";
import "./brand-tokens.css";
import "./App.css";

type Boot = { t: "load" } | { t: "file"; f: OpenedFile } | { t: "empty" };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ t: "load" });

  useEffect(() => {
    resolveBoot().then((f) => {
      if (f) resetBudget(); // novo arquivo de topo → zera budget cumulativo
      setBoot(f ? { t: "file", f } : { t: "empty" });
    });
  }, []);

  const src = useMemo(
    () => (boot.t === "file" ? fsSource(boot.f.path, boot.f.name) : null),
    [boot],
  );

  return (
    <div className="app">
      <header className="bar">
        <span className="brand">
          Coslu <span className="sub">Reader</span>
        </span>
        {boot.t === "file" && (
          <span className="file">
            {boot.f.name} <span className="kind">{boot.f.kind}</span>
          </span>
        )}
      </header>
      <main className="content">
        {boot.t === "load" && <div className="status">Iniciando…</div>}
        {boot.t === "empty" && (
          <div className="cover">
            <StampS08 />
            <div className="hint">
              Visualizador universal de arquivos · local-first. Abra um
              arquivo com o Coslu Reader (Abrir com…) ou passe o caminho
              como argumento.
            </div>
            <button
              className="cover-btn"
              onClick={() => void invoke("open_default_apps")}
            >
              Definir como padrão no Windows…
            </button>
            <div className="cover-note">
              Abre Configurações → Aplicativos padrão. Busque “Coslu
              Reader” e escolha, por tipo de arquivo, quais quer abrir
              com ele. (O Windows não deixa o app fazer isso sozinho.)
            </div>
          </div>
        )}
        {boot.t === "file" && src && (
          <ViewerHost source={src} kind={boot.f.kind} />
        )}
      </main>
    </div>
  );
}
