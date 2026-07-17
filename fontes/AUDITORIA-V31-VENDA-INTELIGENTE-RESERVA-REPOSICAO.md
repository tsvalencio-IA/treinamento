# AUDITORIA V31 — Pedido de Venda Inteligente, Reserva e Reposição Mínima

## Objetivo

Implementar a opção de importação **Pedido de venda inteligente** para tratar pedidos comerciais sem comprometer o estoque e sem gerar saldo negativo.

## Regras implementadas

1. O sistema analisa cada item do PDF pelo código, medida e material.
2. Se existir peça disponível, ela deixa de ficar disponível e passa para o status `reservado`, vinculada ao pedido/venda.
3. Se faltar peça para atender a venda, é criado pedido automático de produção vinculado à venda.
4. Após reservar as peças existentes, o sistema compara o saldo restante com o estoque mínimo definido pelo administrador/gestor.
5. Se o saldo restante ficar abaixo do mínimo, o pedido de produção soma também a reposição necessária para recompor o índice mínimo.
6. A produção vinculada a uma venda pendente baixa automaticamente apenas a quantidade necessária para a venda.
7. O excedente produzido para reposição fica disponível em estoque.
8. Quando a produção atende a venda pendente, as peças reservadas são convertidas em vendidas, mantendo rastreabilidade.

## Arquivos alterados

- `js/app.js`
- `package.json`

## Controle visual

A tela de importação recebeu a nova opção:

- `Importar pedido de venda inteligente`

A tela de vendas passa a exibir:

- quantidade pedida;
- quantidade reservada;
- quantidade baixada;
- quantidade pendente de produção para venda;
- quantidade de reposição mínima.

A tela de estoque passa a reconhecer peças com status `reservado`.

## Testes executados

- `node --check js/app.js`
- `npm test`

Resultado: Smoke test OK.
