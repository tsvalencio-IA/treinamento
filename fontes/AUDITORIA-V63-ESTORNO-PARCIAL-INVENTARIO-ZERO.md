# AUDITORIA V63 — ESTORNO PARCIAL E INVENTÁRIO INTEGRAL EM ZERO

Build: `v63-correcao-estorno-parcial-inventario-zero-20260714`

## Base preservada

A V63 foi aplicada diretamente sobre a V62, sem remover telas, importações, Firebase, Cloudinary, AR, estoque físico, produção, relatórios, backup, auditoria ou regras de permissão.

## Defeitos reproduzidos pelo teste pós-deploy V62

1. Venda parcial de 3 peças, com 2 baixadas e peso real baixado de 1,400 g, devolvia apenas 0,933 g no estorno. Permaneciam 0,467 g como saída indevida.
2. O estorno integral do inventário marcava as cinco peças e os lotes como estornados, mas o cadastro do SKU continuava exibindo quantidade e peso anteriores porque a sincronização retornava sem salvar quando não restava peça ativa.

## Correções

- O estorno de venda prioriza `pesoTotalBaixado`, ou a soma de `pecasBaixadas[].pesoBaixaReal`, sem aplicar um segundo rateio proporcional.
- Os conversores de venda preservam `pesoTotalBaixado`, `pesoTotalSolicitado` e `pesoTotalFaltante`.
- A sincronização do produto identifica histórico de peças físicas. Quando todas estão inativas/estornadas, grava explicitamente zero em quantidade, peso disponível, peso físico, peso vendido, peças ativas e lotes ativos.
- `pesoTotalVendido` aceita zero real e não mantém saldo antigo por uso de operador `||`.

## Resultado esperado no E2E

- SKU B após estorno da venda: entrada 1,500 g; saída 0; disponível 1,500 g.
- Após estorno do inventário: SKU A e SKU B com quantidade disponível 0; entrada, saída e disponível de peso em 0.
- Limpeza do teste: zero resíduos.
