# Coslu Reader — Família Markdown

Teste do **Tier S** de Markdown: `markdown-it` (`html:false`) + **DOMPurify 3.4.5**.
Antes este `.md` caía no _TextViewer_ (Tier B) — agora sobe de tier **sem mudar a arquitetura**.

## Tipografia

- Listas com `código inline`
- *ênfase*, **forte**, ~~riscado~~
- Link seguro: [coslu.io](https://coslu.io)

> Blockquote no padrão journal — barra vermilion à esquerda.

### Bloco de código

```rust
pub fn detect(path: &Path) -> Kind {
    // extensão → magic-bytes → texto/binário → Hex
}
```

| Família | Tier |
|---|---|
| Markdown | S |
| Hex | B |

---

## Prova de segurança (§13)

Tudo abaixo deve aparecer **inerte** (escapado ou removido), nada executa:

<script>window.__MD_SCRIPT_RAN__ = true;</script>

<img src=x onerror="window.__MD_IMG_XSS__=true">

[link malicioso](javascript:alert('xss'))

Fim.
