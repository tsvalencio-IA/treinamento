import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

assert.match(app, /v57-estorno-justificado-auditoria-visivel/, 'Build V57 não identificado.');
assert.match(app, /\["auditoria", "Auditoria", "Quem fez, quando e por quê"\]/, 'Auditoria não está visível na navegação.');
assert.match(app, /function requireReversalReason/, 'Fluxo de justificativa obrigatória ausente.');
assert.match(app, /Mínimo: 10 caracteres/, 'Validação mínima da justificativa ausente.');
assert.match(app, /estornoJustificativa/, 'Justificativa não está sendo gravada nos registros afetados.');
assert.match(app, /estornadoPorUid/, 'UID do usuário responsável pelo estorno não está sendo gravado.');
assert.match(app, /startReversalAudit/, 'Pré-registro obrigatório de auditoria ausente.');
assert.match(app, /completeReversalAudit/, 'Conclusão do registro de auditoria ausente.');
assert.match(app, /failReversalAudit/, 'Registro de falha de estorno ausente.');
assert.match(app, /statusAuditoria: "iniciada"/, 'Status inicial de auditoria ausente.');
assert.match(app, /statusAuditoria: "concluida"/, 'Status concluído de auditoria ausente.');
assert.match(app, /statusAuditoria: "falhou"/, 'Status de falha de auditoria ausente.');
assert.match(app, /Exportar auditoria JSON/, 'Exportação manual da auditoria ausente.');
assert.match(app, /Justificativa\/Motivo:/, 'Justificativa não está visível na tela de auditoria.');
assert.match(app, /reverseInventoryDocument\(documentId = "", \{ motivo = "", auditoriaId = "" \} = \{\}\)/, 'Estorno de inventário não recebe justificativa/auditoria.');
assert.match(app, /reverseSaleRecords\(records = \[\], \{ motivo = "", documentoImportacaoId = "", auditoriaId = "" \} = \{\}\)/, 'Estorno de venda não recebe justificativa/auditoria.');

console.log('V57 OK: estorno exige justificativa, registra auditoria antes/depois/falha e exibe Auditoria no menu.');
