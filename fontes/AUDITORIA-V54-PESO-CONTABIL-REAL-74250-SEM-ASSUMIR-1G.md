# AUDITORIA V54 — Peso contábil real sem assumir 1g

## Motivo

O teste do cliente mostrou a regra correta do negócio:

- Entraram 72 peças a 1,000 g = 72,000 g.
- Saiu uma peça de 1,000 g = 71,000 g.
- Saiu outra peça com peso real 0,750 g = 70,250 g.
- Entraram manualmente 2 peças de 2,000 g = +4,000 g.
- Peso disponível esperado = 74,250 g.

## Correção

A V54 deixa a exibição e os agregados usando a conta operacional correta:

`peso disponível = peso total de entrada - peso real vendido - peso reservado - peso consignado`

A baixa de venda continua gravando o peso real informado ou o peso real da peça.
Não existe fallback fixo de 1g.

## Arquivos alterados

- js/app.js
- package.json
- AUDITORIA-V54-PESO-CONTABIL-REAL-74250-SEM-ASSUMIR-1G.md

## Preservado

- Inventário por PDF
- Venda por PDF
- Venda manual
- Entrada manual no estoque
- Rastreio do pedido na peça vendida
- Alertas por pedido
- Produção manual
- Responsividade
- Firebase
- Cloudinary
- AR
- Relatórios

## Teste esperado

Após o cenário acima, o painel/estoque deve mostrar 74,250 g disponíveis, não 74,000 g e não 70,000 g.
