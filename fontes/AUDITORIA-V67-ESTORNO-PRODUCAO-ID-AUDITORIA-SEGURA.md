# AUDITORIA V67 — ESTORNO DE PRODUÇÃO COM ID VÁLIDO E AUDITORIA SEGURA

## Origem da correção

O teste real V66 concluiu todos os fluxos de catálogo, inventário, venda parcial,
correção do status do PDF, produção aprovada, excedente, peso e estorno da venda.
Ao estornar a entrada de produção, o Firebase recusou o registro da Auditoria porque
`metadados.producaoIds[0]` continha `undefined`.

A causa era o cabeçalho lido diretamente de `state.data.producoes[referenceId]`.
No Realtime Database, a chave fica fora do objeto e, portanto, `root.id` não existia.

## Correções

1. O contexto da produção agora anexa explicitamente `referenceId` como `root.id`.
2. Todos os IDs que serão atualizados são pré-validados antes da primeira mutação.
3. IDs vazios, `undefined` ou `null` são rejeitados.
4. A Auditoria sanitiza recursivamente valores `undefined` antes de gravar ou atualizar.
5. O teste E2E foi corrigido para capturar o estado atual das peças imediatamente antes
   do teste de bloqueio do inventário, eliminando um falso positivo causado por baseline antigo.
6. Nenhuma regra de quantidade, peso, venda, lote, produção ou inventário foi simplificada.

## Segurança operacional

Caso a rastreabilidade não contenha nenhum ID válido, o estorno é bloqueado antes de
alterar peças, lote, peso, movimentos ou saldo agregado.
