# AUDITORIA V66 — CORREÇÃO DO STATUS DO PDF E ESTORNO DE PRODUÇÃO

## Evidência do diagnóstico real

O diagnóstico forense da base V65 mostrou:

- 2 inventários estornados integralmente: 90/90 peças removidas, lotes zerados e peso do inventário zerado;
- 6 peças físicas ainda disponíveis, todas ligadas a duas entradas de produção manual ativas;
- nenhum saldo fantasma e nenhuma peça órfã;
- 5 linhas de venda estornadas cujos cabeçalhos originais na coleção `pedidos` continuavam ativos;
- duas novas tentativas de estorno de PDF falharam porque as linhas da venda já estavam estornadas.

## Correções V66

1. O estorno feito na tela de Vendas passa a corrigir o status do cabeçalho original do PDF automaticamente quando todas as linhas da venda estiverem estornadas.
2. PDFs antigos com linhas já estornadas e cabeçalho ativo passam a mostrar **Corrigir status do PDF**, sem refazer baixa ou devolução. A confirmação informa expressamente que nenhuma peça, quantidade, peso, lote ou saldo será movimentado novamente.
3. Produção pronta por PDF passa a aparecer no histórico de PDFs e pode ser estornada integralmente.
4. Entrada manual de produção passa a ter **Estornar entrada** no Histórico de produção.
5. O estorno de produção:
   - exige justificativa;
   - bloqueia se houver peça ainda vendida, reservada ou consignada;
   - estorna somente peças, lotes, peso e movimentos originados naquela produção;
   - não toca nos inventários já estornados;
   - registra usuário, data, motivo e impacto na Auditoria.
6. Entrada vinculada a pedido de produção permanece bloqueada para estorno automático, evitando reabrir ou alterar o fluxo de pedido sem uma regra específica.

## Regra preservada

Estornar inventário não pode apagar peças de produção. As seis peças encontradas eram produção manual real, e não falha do estorno do inventário. Para zerar todo o cenário, é necessário estornar também as duas entradas de produção.
