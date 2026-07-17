# Auditoria V60 — Estorno completo de PDF multi-item

## Defeito corrigido

A V59 localizava as peças do inventário exclusivamente por `peca.inventarioId === documentoId`.
Registros criados ou migrados em fluxos anteriores também podem estar ligados ao mesmo PDF por `pedidoId`, `loteId`, código de lote ou assinatura pedido+arquivo. Com isso, um PDF com vários itens podia ter apenas um subconjunto estornado, enquanto o documento já era marcado como estornado.

## Regra V60

- Resolve todas as peças do PDF por inventário, pedido, lote e origem do arquivo.
- Compara a quantidade do documento com todas as peças vinculadas antes da primeira escrita.
- Se faltar qualquer item, bloqueia o estorno inteiro antes de alterar estoque.
- Detecta documento marcado como estornado que ainda possua peças ativas.
- Exibe `Concluir estorno pendente`.
- Na reconciliação, não desconta novamente o peso de um grupo que já possua peça estornada na tentativa anterior.
- Grava cobertura esperada, vinculada, removida e impacto por produto na Auditoria.

## Caso 26688

- 4160AGL Nº 18: 1 peça / 0,710 g
- 2740AGL Nº 15: 1 peça / 0,810 g
- 2740AGL Nº 23: 1 peça / 0,900 g
- Total: 3 peças / 2,420 g

Se uma tentativa anterior removeu somente o primeiro item, a reconciliação remove os dois itens restantes e desconta apenas 1,710 g nesta execução, evitando duplicar os 0,710 g já retirados.
