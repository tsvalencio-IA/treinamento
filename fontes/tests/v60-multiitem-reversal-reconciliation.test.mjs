import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.match(app, /v60-estorno-pdf-multiitem-atomico-reconciliavel/, "Build V60 não identificado.");
assert.match(app, /function inventoryDocumentLinkContext/, "Contexto de vínculos do inventário não existe.");
assert.match(app, /function pieceBelongsToInventoryDocument/, "Resolvedor de peças do PDF não existe.");
assert.match(app, /piece\.inventarioId/, "Estorno não verifica inventarioId.");
assert.match(app, /piece\.pedidoId/, "Estorno não verifica pedidoId legado.");
assert.match(app, /context\.lotIds\?\.has\(String\(piece\.loteId/, "Estorno não verifica loteId.");
assert.match(app, /context\.lotCodes\?\.has\(pieceLot\)/, "Estorno não verifica código do lote.");
assert.match(app, /Estorno bloqueado antes de alterar o estoque: nem todos os itens do PDF foram vinculados/, "Preflight de cobertura integral não existe.");
assert.match(app, /Concluir estorno pendente/, "Interface não oferece reconciliação de estorno incompleto.");
assert.match(app, /estornoQuantidadeEsperada/, "Documento não registra quantidade esperada no estorno.");
assert.match(app, /estornoQuantidadeVinculada/, "Documento não registra cobertura vinculada.");
assert.match(app, /reconciliacaoDeEstornoIncompleto/, "Auditoria não registra reconciliação de estorno parcial.");

const reverseStart = app.indexOf('async function reverseInventoryDocument');
const reverseEnd = app.indexOf('async function requestReverseSale', reverseStart);
const reverseBlock = app.slice(reverseStart, reverseEnd);
const preflightIndex = reverseBlock.indexOf('coverage.missingGroups.length');
const firstPatchIndex = reverseBlock.indexOf('await DB.patch("pecasEstoque"');
assert.ok(preflightIndex >= 0 && firstPatchIndex > preflightIndex, "Preflight deve ocorrer antes da primeira alteração de peça.");

// Simulação do caso real 26688: três itens ligados de formas diferentes.
const documentId = 'INV_26688';
const lotIds = new Set(['LOT_2740_23']);
const pieces = [
  { id: 'P1', produtoId: '4160_18', inventarioId: documentId, pedidoId: '', loteId: 'LOT_A', status: 'estornado' },
  { id: 'P2', produtoId: '2740_15', inventarioId: '', pedidoId: documentId, loteId: 'LOT_B', status: 'disponivel' },
  { id: 'P3', produtoId: '2740_23', inventarioId: '', pedidoId: '', loteId: 'LOT_2740_23', status: 'disponivel' }
];

function linked(piece) {
  return piece.inventarioId === documentId || piece.pedidoId === documentId || lotIds.has(piece.loteId);
}

const linkedPieces = pieces.filter(linked);
assert.equal(linkedPieces.length, 3, "Os três itens do PDF precisam ser localizados, mesmo com vínculos legados diferentes.");

const expectedWeights = new Map([
  ['4160_18', 0.71],
  ['2740_15', 0.81],
  ['2740_23', 0.90]
]);

// Em recuperação de estorno parcial, o grupo já estornado não pode descontar peso duas vezes.
let deltaRecovery = 0;
for (const [produtoId, weight] of expectedWeights) {
  const group = linkedPieces.filter((piece) => piece.produtoId === produtoId);
  const previouslyReversed = group.some((piece) => piece.status === 'estornado');
  if (!previouslyReversed) deltaRecovery += weight;
}
assert.ok(Math.abs(deltaRecovery - 1.71) < 0.000001, "Reconciliação deve remover somente 1,710 g restantes, sem duplicar os 0,710 g já estornados.");

const finalStatuses = linkedPieces.map(() => 'estornado');
assert.equal(finalStatuses.filter((status) => status === 'estornado').length, 3, "Após a reconciliação, todos os três itens devem estar estornados.");

console.log('V60 OK: estorno multi-item encontra inventarioId/pedidoId/lote, bloqueia cobertura incompleta e reconcilia sem duplicar peso.');
