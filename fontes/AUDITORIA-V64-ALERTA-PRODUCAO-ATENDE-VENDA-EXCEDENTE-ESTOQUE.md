# AUDITORIA V64 — PRODUÇÃO APROVADA NO ALERTA ATENDE A VENDA E MANTÉM O EXCEDENTE

## Base preservada

Esta versão foi construída diretamente sobre a V63 aprovada. Não remove nem substitui os fluxos existentes de:

- inventário e peças físicas;
- venda inteligente e venda final;
- alertas do gestor;
- pedidos de produção já existentes;
- entrada manual e entrada por PDF de produção pronta;
- peso total independente da quantidade;
- lotes, movimentos, relatórios, backup, auditoria, estorno, Firebase, AR e permissões.

## Regra funcional nova

O alerta aprovado **não vira ordem de produção**.

1. A venda baixa o que existe e mantém a quantidade faltante.
2. O gestor abre o alerta do item e informa a quantidade total que autorizou produzir.
3. A autorização fica registrada no próprio alerta e na linha da venda.
4. Quando a produção pronta do mesmo SKU entra, o sistema aplica as peças nesta ordem:
   - primeiro na quantidade faltante da venda aprovada;
   - depois no estoque disponível.
5. A venda é atualizada e finalizada quando o faltante chega a zero.
6. O alerta é resolvido quando a quantidade aprovada foi recebida.
7. O excedente permanece como peça física disponível, com lote e peso rastreáveis.

## Exemplo obrigatório

- Venda solicitada: 10 peças.
- Estoque disponível: 0.
- Faltante: 10.
- Gestor aprova produção total: 20.
- Produção pronta recebida: 20.

Resultado esperado:

- 10 peças marcadas como vendidas e vinculadas à venda parcial;
- venda finalizada;
- alerta resolvido;
- 10 peças disponíveis no estoque;
- peso total de entrada registrado;
- peso real das 10 peças vendidas registrado como saída;
- lote atualizado com 10 unidades disponíveis.

## Entradas parciais

Se a produção aprovada for recebida em partes, o sistema mantém o saldo:

- faltante da venda;
- quantidade aprovada;
- quantidade já recebida;
- quantidade ainda aguardada;
- quantidade aplicada na venda;
- quantidade excedente no estoque.

Se a quantidade aprovada for menor que o faltante e for totalmente recebida, o restante volta para decisão do gestor, sem estoque negativo.

## Arquivos alterados

- `js/app.js`
- `package.json`
- `tests/v64-approved-alert-production-flow.test.mjs`
- `scripts/TESTE-GLAMORE-V64-ALERTA-PRODUCAO-EXCEDENTE-COM-LIMPEZA.js`
- `scripts/TESTE-GLAMORE-V64-ALERTA-PRODUCAO-EXCEDENTE-COM-LIMPEZA.txt`
- `AUDITORIA-V64-ALERTA-PRODUCAO-ATENDE-VENDA-EXCEDENTE-ESTOQUE.md`
- `RELATORIO-ALTERACOES-V64.txt`

## Testes locais

- `node --check js/app.js`
- `node --check scripts/TESTE-GLAMORE-V64-ALERTA-PRODUCAO-EXCEDENTE-COM-LIMPEZA.js`
- `npm test`

Todos os testes locais passaram, incluindo as regressões V56, V57, V58, V59, V60, V62 e V63.
