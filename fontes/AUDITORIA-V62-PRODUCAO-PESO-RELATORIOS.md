# AUDITORIA V62 — PRODUÇÃO PRONTA, PESO E RELATÓRIOS SEM DUPLICIDADE

Build: `v62-correcao-producao-peso-relatorios-sem-duplicidade-20260714`

## Base preservada

A V62 foi aplicada sobre o ZIP recebido `GlamoreJoias-main (6)(1).zip`, sem remover telas, permissões, Firebase, Cloudinary, AR, importações, vendas, produção, auditoria, backup ou estornos existentes.

## Correções funcionais

1. **Produção pronta não duplica quantidade**
   - O saldo legado é convertido antes da nova entrada.
   - A entrada não incrementa `estoqueDisponivel` e depois cria outra peça física.
   - A quantidade oficial passa a ser a contagem de `pecasEstoque` quando existem peças físicas.

2. **Peso total da produção entra no razão**
   - Produção pronta por PDF credita `pesoTotalReal` no livro independente do SKU.
   - Entrada manual de produção também credita o peso total produzido.
   - Quando a produção atende imediatamente uma venda pendente, o peso correspondente é debitado do razão.

3. **Relatório de estoque sem soma duplicada**
   - Produto/SKU fornece cadastro e parâmetros.
   - Peça física fornece quantidade real.
   - O relatório não soma `produto.estoqueDisponivel + pecasEstoque`.
   - Peças estornadas, canceladas, excluídas ou arquivadas não entram no total ativo.

4. **Relatório de vendas com números reais**
   - Separa quantidade solicitada, baixada e faltante.
   - Soma como venda apenas `quantidadeBaixada`.
   - Mostra o peso realmente baixado.
   - Vendas estornadas/canceladas não entram no relatório ativo.

5. **Rastreabilidade futura**
   - Novas vendas persistem `pesoTotalSolicitado`, `pesoTotalBaixado` e `pesoTotalFaltante`.
   - Registros antigos continuam compatíveis por cálculo proporcional quando não possuem os novos campos.

## Arquivos alterados

- `js/app.js`
- `js/reports.js`
- `package.json`
- `tests/v62-production-reports.test.mjs`
- `scripts/TESTE-GLAMORE-V62-POS-DEPLOY-COM-LIMPEZA.js`
- `scripts/TESTE-GLAMORE-V62-POS-DEPLOY-COM-LIMPEZA.txt`
- `LEIA-ANTES-DE-SUBIR.txt`
- `README.md`
- `AUDITORIA-V62-PRODUCAO-PESO-RELATORIOS.md`

## Testes

- `node --check js/app.js`
- `node --check js/reports.js`
- `node tests/v62-production-reports.test.mjs`
- `npm test`

A publicação só deve ser considerada correta quando o console retornar o build V62 e o teste pós-deploy confirmar entrada de 1 peça como exatamente 1 unidade e o peso total correspondente no razão.
