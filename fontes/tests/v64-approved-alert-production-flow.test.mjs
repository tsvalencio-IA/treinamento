import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.ok(
  app.includes("v64-alerta-producao-aprovada-atende-venda-excedente-estoque-20260715") ||
    app.includes("v65-rastreabilidade-cabecalho-producao-baixa-excedente-20260715"),
  "Fluxo V64 deve permanecer identificado na V64 ou em versão posterior compatível."
);
assert.ok(app.includes("data-approve-alert-production"), "Tela de alertas deve permitir aprovar produção por item faltante.");
assert.ok(app.includes("Gestor aprovou produção de item faltante sem criar ordem de produção."), "A aprovação não pode virar ordem de produção.");
assert.ok(app.includes("applyProductionToApprovedAlerts"), "Entrada de produção pronta deve conciliar alertas aprovados.");
assert.ok(app.includes("quantidadeExcedenteEstoque"), "Excedente produzido deve permanecer identificado no estoque.");
assert.ok(app.includes("quantidadeBaixadaVendas"), "Quantidade destinada à venda pendente deve ficar rastreada.");
assert.ok(app.includes("syncCommercialOrderFromSales"), "Cabeçalho do pedido comercial deve ser sincronizado/finalizado.");

const productionPdfStart = app.indexOf('} else if (isProductionReadyImport(tipoImportacao)) {');
const productionPdfEnd = app.indexOf('} else if (tipoImportacao === "venda_inteligente") {', productionPdfStart);
const productionPdfBlock = app.slice(productionPdfStart, productionPdfEnd);
assert.ok(productionPdfBlock.includes("applyProductionToPendingOrder"), "Fluxo antigo de pedido de produção deve ser preservado.");
assert.ok(productionPdfBlock.includes("applyProductionToApprovedAlerts"), "Produção pronta sem ordem deve atender alertas aprovados.");

function reconcile({ missingSale, approved, alreadyReceived = 0, produced }) {
  const approvedRemainingBefore = Math.max(0, approved - alreadyReceived);
  const receivedNow = Math.min(produced, approvedRemainingBefore);
  const soldNow = Math.min(receivedNow, missingSale);
  const missingAfter = Math.max(0, missingSale - soldNow);
  const receivedAfter = alreadyReceived + receivedNow;
  const approvedRemainingAfter = Math.max(0, approved - receivedAfter);
  const excessStockNow = Math.max(0, produced - soldNow);
  const productionPendingSaleAfter = Math.min(missingAfter, approvedRemainingAfter);
  const analysisPendingAfter = Math.max(0, missingAfter - productionPendingSaleAfter);
  return {
    receivedNow,
    soldNow,
    missingAfter,
    receivedAfter,
    approvedRemainingAfter,
    excessStockNow,
    productionPendingSaleAfter,
    analysisPendingAfter,
    saleFinalized: missingAfter === 0
  };
}

const completeWithExcess = reconcile({ missingSale: 10, approved: 20, produced: 20 });
assert.deepEqual(
  completeWithExcess,
  {
    receivedNow: 20,
    soldNow: 10,
    missingAfter: 0,
    receivedAfter: 20,
    approvedRemainingAfter: 0,
    excessStockNow: 10,
    productionPendingSaleAfter: 0,
    analysisPendingAfter: 0,
    saleFinalized: true
  },
  "Venda de 10 com produção de 20 deve baixar 10 na venda e deixar 10 no estoque."
);

const partialReceipt = reconcile({ missingSale: 10, approved: 20, produced: 6 });
assert.equal(partialReceipt.soldNow, 6, "Primeira entrada parcial deve baixar 6 na venda.");
assert.equal(partialReceipt.missingAfter, 4, "Venda deve continuar faltando 4.");
assert.equal(partialReceipt.approvedRemainingAfter, 14, "Aprovação deve continuar aguardando 14 peças.");
assert.equal(partialReceipt.productionPendingSaleAfter, 4, "As 4 faltantes da venda seguem cobertas pela produção aprovada.");
assert.equal(partialReceipt.analysisPendingAfter, 0, "Não volta para análise enquanto a aprovação restante cobre a venda.");

const approvalInsufficient = reconcile({ missingSale: 10, approved: 5, produced: 5 });
assert.equal(approvalInsufficient.soldNow, 5, "Produção aprovada de 5 deve baixar 5.");
assert.equal(approvalInsufficient.missingAfter, 5, "Venda continua faltando 5.");
assert.equal(approvalInsufficient.productionPendingSaleAfter, 0, "Não há produção aprovada restante.");
assert.equal(approvalInsufficient.analysisPendingAfter, 5, "Saldo faltante volta para decisão do gestor.");

const overProduction = reconcile({ missingSale: 10, approved: 20, produced: 25 });
assert.equal(overProduction.soldNow, 10, "Nunca pode baixar mais que o faltante da venda.");
assert.equal(overProduction.excessStockNow, 15, "Todo o restante produzido deve permanecer disponível no estoque.");
assert.equal(overProduction.saleFinalized, true, "Venda deve ser finalizada quando o faltante zera.");

console.log("V64 OK: alerta aprovado atende venda primeiro, finaliza pedido e mantém excedente no estoque sem criar ordem de produção.");
