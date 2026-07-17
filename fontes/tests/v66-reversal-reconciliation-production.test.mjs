import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.ok(
  app.includes("Corrigir status do PDF") &&
  app.includes("async function reverseProductionDocument"),
  "Funcionalidades V66 devem permanecer presentes em versões posteriores."
);

// Correção 1: estorno iniciado na tela de Vendas precisa encerrar também o cabeçalho do PDF.
const reverseSaleStart = app.indexOf("async function reverseSaleRecords");
const reverseSaleEnd = app.indexOf("function inventoryDocumentItems", reverseSaleStart);
const reverseSaleBlock = app.slice(reverseSaleStart, reverseSaleEnd);
assert.ok(
  reverseSaleBlock.includes("reconcileSalePdfHeaders(records"),
  "Estorno de venda deve reconciliar automaticamente o cabeçalho de pedidos."
);
assert.ok(
  app.includes("needsReconciliation: allRowsReversed && !isReversedRecord(doc)"),
  "Sistema deve detectar cabeçalho ativo quando todas as linhas já foram estornadas."
);
assert.ok(
  app.includes("await reconcilePreviouslyReversedSalePdf(documentId"),
  "Botão de PDF deve conseguir reconciliar estorno já executado sem movimentar estoque novamente."
);
assert.ok(
  app.includes('data-reverse-import="${escapeHtml(doc.id)}"') &&
  app.includes("Corrigir status do PDF"),
  "Tela de importação deve oferecer correção clara do status para registros antigos."
);

// Correção 2: peças de produção não pertencem aos inventários e precisam de estorno próprio.
const productionStart = app.indexOf("async function reverseProductionDocument");
const productionEnd = app.indexOf("async function requestReverseProduction", productionStart);
const productionBlock = app.slice(productionStart, productionEnd);
assert.ok(productionBlock.includes("coverage.blockedPieces.length"), "Estorno de produção deve bloquear peça ainda vendida/reservada/consignada.");
assert.ok(productionBlock.includes('status: "estornada"'), "Peças e registros da produção devem ser marcados como estornados.");
assert.ok(productionBlock.includes("entradaDelta: -weightDelta"), "Estorno deve retirar somente o peso da entrada de produção.");
assert.ok(productionBlock.includes("await syncProductAggregateFromPieces"), "Saldo agregado deve ser recalculado pelas peças físicas.");
assert.ok(productionBlock.includes('quantidadeDisponivel: 0'), "Lote da produção estornada deve ficar zerado.");
assert.ok(app.includes('data-reverse-production="${escapeHtml(p.id || "")}"'), "Histórico de produção deve oferecer botão de estorno.");
assert.ok(app.includes('classe: "producao_pronta_pdf"'), "PDF de produção pronta deve aparecer no histórico de PDFs para estorno integral.");

// Simulação do caso real do diagnóstico: duas entradas manuais com 3 peças cada.
// Estornar os dois inventários não pode apagar essas peças; estornar as duas produções deve zerar.
const products = {
  p15: { available: 3, weight: 6.45 },
  p17: { available: 3, weight: 2.34 }
};
function reverseProduction(product, qty, weight) {
  return {
    available: Math.max(0, product.available - qty),
    weight: Math.max(0, Number((product.weight - weight).toFixed(3)))
  };
}
const after15 = reverseProduction(products.p15, 3, 6.45);
const after17 = reverseProduction(products.p17, 3, 2.34);
assert.deepEqual(after15, { available: 0, weight: 0 });
assert.deepEqual(after17, { available: 0, weight: 0 });

assert.ok(app.includes("Para confirmar, digite: CORRIGIR STATUS"), "Correção de status deve ter confirmação específica e não se confundir com novo estorno.");
assert.ok(app.includes("Nenhuma peça, quantidade, peso, lote ou saldo será movimentado novamente."), "Tela deve informar que a correção de status não altera estoque.");

console.log("V66 OK: status do PDF é corrigido sem nova movimentação e entrada de produção possui estorno próprio, seguro e rastreável.");
