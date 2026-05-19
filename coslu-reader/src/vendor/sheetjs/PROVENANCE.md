# SheetJS — vendorizado (decisão §2.5 do PLANEJAMENTO.md)

O pacote `xlsx` no **npm está abandonado em 0.18.5** e é vulnerável
(CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS). As builds
seguras (≥0.20.2) **só existem no CDN oficial da SheetJS**, não no npm.
Por isso o arquivo é vendorizado aqui, com hash de integridade auditável.

| Campo | Valor |
|---|---|
| Arquivo | `xlsx.mjs` |
| Versão | **0.20.3** (satisfaz o piso §13: ≥0.20.2) |
| Origem | `https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs` |
| Tamanho | 1.008.308 bytes |
| SHA-256 | `1a0fb062ee9781b13f6687371b202aaefc53b6ce55b530c027e01f9c087b77db` |
| Baixado em | 2026-05-18 |

## Como atualizar / verificar

```sh
curl -fsSL "https://cdn.sheetjs.com/xlsx-<VER>/package/xlsx.mjs" -o xlsx.mjs
node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('xlsx.mjs')).digest('hex'))"
```

Atualize a versão e o SHA-256 acima ao trocar o arquivo. **Nunca**
substituir por `npm i xlsx` (traria o 0.18.5 vulnerável).
