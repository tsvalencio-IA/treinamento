# V57 — Estorno justificado e Auditoria visível

## Correção obrigatória

A V56 já devolvia quantidade e peso no estorno, porém havia duas lacunas operacionais:

1. a justificativa do usuário não era obrigatória; o sistema usava um texto automático;
2. a página de Auditoria existia no código, mas não estava incluída na navegação principal.

A V57 corrige essas duas lacunas sem remover as regras de quantidade/peso independente da V56.

## Fluxo de estorno protegido

Antes de estornar uma venda, PDF de venda ou PDF de inventário, o sistema agora:

1. exige justificativa real com no mínimo 10 caracteres;
2. mostra a justificativa na confirmação final;
3. cria o registro de auditoria **antes** de alterar o estoque;
4. grava usuário, UID, e-mail, função, data, documento/pedido e justificativa;
5. executa o estorno de quantidade e peso;
6. atualiza o registro da auditoria como `concluida`;
7. se ocorrer erro, registra o status `falhou` e a mensagem da falha.

O estorno é cancelado quando a justificativa está vazia ou é muito curta.

## Dados gravados nos registros afetados

- `estornoMotivo`
- `estornoJustificativa`
- `estornadoEm`
- `estornadoPor`
- `estornadoPorUid`
- `estornadoPorEmail`
- `estornadoPorNome`
- `estornadoPorPapel`
- `estornadoPorPapelLabel`

Esses campos são aplicados à venda/documento e aos registros operacionais relacionados.

## Página Auditoria

A rota `Auditoria` agora aparece no menu para Administrador Master e Gerente.

A tela permite:

- consultar quem realizou cada ação;
- visualizar data e hora;
- localizar pedido/documento;
- conferir justificativa do estorno;
- filtrar somente estornos;
- filtrar registros concluídos, em andamento ou com falha;
- pesquisar por usuário, pedido, ação ou motivo;
- abrir os dados de antes/depois e metadados;
- exportar a auditoria em JSON.

## Preservado

- quantidade e peso total independentes;
- venda de 6 peças/7,5 g deixando 4 peças/2,5 g;
- estorno exato de quantidade e peso;
- venda manual e venda por PDF;
- inventário/entrada por PDF;
- entrada manual;
- alertas e produção manual;
- backup e restauração;
- relatórios;
- Firebase, Cloudinary, AR e login;
- responsividade e demais telas.

## Arquivos alterados

- `js/app.js`
- `package.json`
- `tests/v57-reversal-audit.test.mjs`
- `AUDITORIA-V57-ESTORNO-JUSTIFICADO-AUDITORIA-VISIVEL.md`

## Testes executados

- `node --check js/app.js`
- `npm test`

Resultado esperado:

- Smoke test OK
- ERP business rules OK
- V56 weight/reversal OK
- V57 reversal/audit OK
