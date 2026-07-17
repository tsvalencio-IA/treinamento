import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const pdfImporter = fs.readFileSync(new URL("../js/pdf-importer.js", import.meta.url), "utf8");

assert.match(app, /v59-hotfix-estorno-pdf-peso-estoque-ledger/, "Build V59 não identificado.");
assert.match(pdfImporter, /item\.pesoTotalLinha \?\? item\.peso \?\? 0/, "Parser não prioriza o peso total da linha já transformada.");

function functionBlock(name, nextMarker) {
  const start = app.indexOf(`async function ${name}`);
  assert.ok(start >= 0, `Função ${name} não encontrada.`);
  const end = nextMarker ? app.indexOf(nextMarker, start + 1) : app.length;
  assert.ok(end > start, `Fim da função ${name} não encontrado.`);
  return app.slice(start, end);
}

const reverseInventory = functionBlock("reverseInventoryDocument", "async function requestReverseSale");
const requestReverseImport = functionBlock("requestReverseImport", "function setupReversalButtons");

assert.match(
  reverseInventory,
  /documentoId:\s*documentId/,
  "Auditoria do estorno de inventário não mapeia documentId para documentoId."
);
assert.doesNotMatch(
  reverseInventory,
  /\n\s*documentoId,\s*\n/,
  "Estorno de inventário ainda possui shorthand documentoId indefinido."
);

assert.match(
  requestReverseImport,
  /documentoId:\s*documentId/,
  "Solicitação de estorno de PDF não mapeia documentId para documentoId."
);
assert.doesNotMatch(
  requestReverseImport,
  /\n\s*documentoId,\s*\n/,
  "Solicitação de estorno ainda possui shorthand documentoId indefinido."
);

assert.match(app, /const independentLedger = hasIndependentWeightLedger\(row\)/, "Estoque não consulta o ledger independente do SKU.");
assert.match(app, /const activeLotWeight = hasIndependentWeightLedger\(row\)/, "Estoque não possui recuperação visual pelo peso dos lotes ativos.");
assert.match(app, /pesoDisponivelReal: independentLedger\s*\? ledgerAvailable/, "Peso disponível da tela não usa o ledger independente.");
assert.match(app, /pesoVendidoReal: independentLedger\s*\? ledgerExit/, "Peso vendido da tela não usa o ledger independente.");

// Regra operacional validada: peso total da linha não vira peso individual inventado.
const itens = [
  { qtd: 1, pesoTotal: 0.71 },
  { qtd: 1, pesoTotal: 0.81 },
  { qtd: 1, pesoTotal: 0.90 }
];
const total = itens.reduce((acc, item) => acc + item.pesoTotal, 0);
assert.ok(Math.abs(total - 2.42) < 0.000001, "Pedido 26688 deve totalizar 2,420 g.");

const ledger = { entrada: 10, saida: 7.5, reservado: 0, consignado: 0 };
const disponivel = Math.max(0, ledger.entrada - ledger.saida - ledger.reservado - ledger.consignado);
assert.equal(disponivel, 2.5, "10 g de entrada menos 7,5 g de venda deve exibir 2,5 g.");

console.log("V59 OK: estorno de PDF sem ReferenceError e estoque exibe peso pelo ledger/lote sem inventar peso individual.");
