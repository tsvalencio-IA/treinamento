# AUDITORIA V66.1 — CLAREZA NA CORREÇÃO DO STATUS DO PDF

## Base preservada

Esta entrega é uma correção direta da V66, construída sobre a V65 aprovada. Nenhuma regra de estoque, peso, venda parcial, produção, estorno, Firebase, Cloudinary, AR, relatórios, backup, permissões ou auditoria foi simplificada ou removida.

## Alteração solicitada

O texto **Reconciliar estorno** poderia induzir o gestor a acreditar que haveria um segundo estorno. Ele foi substituído por **Corrigir status do PDF**.

Quando todas as linhas de uma venda já estão estornadas, mas o cabeçalho antigo do PDF permaneceu ativo, a ação agora:

1. informa que a venda já foi estornada;
2. informa que nenhuma peça, quantidade, peso, lote ou saldo será movimentado;
3. exige motivo com pelo menos 10 caracteres;
4. exige a frase específica `CORRIGIR STATUS`;
5. corrige apenas `status`, `importacaoStatus` e `statusEstoque` do documento;
6. registra a correção na Auditoria.

## Fluxo normal preservado

Os botões **Estornar PDF**, **Concluir estorno pendente**, **Estornar venda** e **Estornar entrada** continuam com as mesmas regras operacionais da V66.
