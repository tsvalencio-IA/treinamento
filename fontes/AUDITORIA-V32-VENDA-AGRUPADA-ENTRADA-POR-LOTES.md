# Auditoria V32 — Venda inteligente agrupada + entrada de produção por lotes

## Objetivo
Corrigir o fluxo de pedido de venda inteligente para trabalhar como operação profissional de joalheria:

1. Agrupar linhas do PDF por código + medida + material antes de reservar estoque.
2. Reservar peças existentes do estoque uma única vez por SKU.
3. Gerar somente um pedido de produção por SKU, separando:
   - quantidade original do pedido de venda;
   - quantidade já reservada em estoque;
   - quantidade faltante para venda;
   - quantidade adicional para reposição de estoque mínimo.
4. Evitar duplicidade de reposição mínima por linha do PDF.
5. Permitir entrada de produção por grupos de peso/lote, por exemplo: `28x2,000 | LOTE-A; 2x2,100 | LOTE-B`.

## Arquivos alterados
- `js/app.js`
- `package.json`

## Regra corrigida
O pedido 25826 possui várias linhas repetidas por medida. Antes, cada linha era processada separadamente. Agora, todas as linhas iguais são somadas antes da reserva e antes do cálculo de produção.

## Entrada de produção por lote
A tela Produção aceita:

```txt
28x2,000 | LOTE-A; 2x2,100 | LOTE-B
```

O sistema cria lotes separados, peças físicas individuais com o peso real correto e mantém tudo vinculado ao mesmo pedido de produção.

## Validação
- `node --check js/app.js`
- `npm test`

Resultado: Smoke test OK.
