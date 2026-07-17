# AUDITORIA V24 — Peça física única, lote e peso real

Versão: `mobile-v24-peca-unica-lote-peso-real-20260618`

Conferências realizadas no pacote:
- `api/create-user.js` preservado.
- `package.json` e `vercel.json` preservados.
- `js/app.js` com V24 publicada.
- `js/firebaseClient.js` carrega `pecasEstoque` por coleção.
- `firebase-database.rules.json` contém regra para `pecasEstoque`.
- Tela de estoque usa `pecasEstoque` como fonte de verdade quando houver peças físicas.
- Inventário por PDF cria peça física individual para cada unidade real.
- Produção pronta cria peça física individual por lote e peso real.
- Entrada manual de produção aceita pesos reais por peça.
- Venda/consignação movimenta peças físicas quando disponíveis.

Observação honesta:
- PDFs só podem gerar pesos individuais diferentes quando o PDF traz cada peça separada ou quando o usuário informa os pesos reais na entrada manual.
- Se o PDF informar apenas uma quantidade e um peso unitário, o sistema cria as peças com esse mesmo peso informado.
