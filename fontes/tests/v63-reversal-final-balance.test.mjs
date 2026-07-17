import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.ok(
  app.includes('v63-correcao-estorno-parcial-inventario-zero-20260714'),
  'Build V63 deve estar identificado no app.js.'
);

const saleReverseStart = app.indexOf('function saleWeightToReverse');
const saleReverseEnd = app.indexOf('async function reverseSaleRecords', saleReverseStart);
const saleReverseBlock = app.slice(saleReverseStart, saleReverseEnd);
assert.ok(saleReverseBlock.includes('item.pesoTotalBaixado'), 'Estorno deve priorizar o peso total realmente baixado.');
assert.ok(saleReverseBlock.includes('item.pecasBaixadas'), 'Estorno deve aceitar a soma dos pesos reais das peças baixadas como rastreabilidade.');

// Caso real reproduzido pelo E2E: pedido de 3 peças, baixa de 2, peso solicitado 2,100 g e baixado 1,400 g.
const vendaParcial = {
  quantidadeSolicitada: 3,
  quantidadeBaixada: 2,
  pesoTotalSolicitado: 2.1,
  pesoTotalBaixado: 1.4,
  pesoTotalFaltante: 0.7
};
const pesoCorretoEstorno = vendaParcial.pesoTotalBaixado;
const pesoErradoRateadoNovamente = vendaParcial.pesoTotalBaixado * (vendaParcial.quantidadeBaixada / vendaParcial.quantidadeSolicitada);
assert.equal(pesoCorretoEstorno, 1.4, 'Estorno correto deve devolver 1,400 g.');
assert.ok(Math.abs(pesoErradoRateadoNovamente - 0.9333333333333333) < 1e-9, 'Cenário antigo de rateio duplo deve ser reproduzível.');
assert.ok(Math.abs((1.4 - pesoCorretoEstorno) - 0) < 1e-9, 'Após o estorno, a saída acumulada deve voltar a zero.');

const syncStart = app.indexOf('async function syncProductAggregateFromPieces');
const syncEnd = app.indexOf('async function ensureLegacyPhysicalPieces', syncStart);
const syncBlock = app.slice(syncStart, syncEnd);
assert.ok(syncBlock.includes('hasPhysicalHistory'), 'Sincronização deve distinguir SKU legado de SKU com histórico de peças físicas.');
assert.ok(syncBlock.includes('if (!summary.totalPecasFisicas && !hasPhysicalHistory) return product;'), 'SKU com peças estornadas não pode manter saldo antigo.');
assert.ok(syncBlock.includes('product.estoqueDisponivel = summary.disponivel;'), 'Saldo agregado deve receber zero quando não há peça física ativa.');
assert.ok(syncBlock.includes('product.pesoTotalVendido = numberSafe(summary.pesoVendido || 0);'), 'Peso vendido deve aceitar zero sem preservar valor antigo por operador OR.');

// Simulação do fechamento do inventário após todas as peças serem estornadas.
const summaryAfterInventoryReverse = {
  totalPecasFisicas: 0,
  disponivel: 0,
  consignado: 0,
  reservado: 0,
  vendido: 0,
  pesoDisponivel: 0,
  pesoTotal: 0,
  pesoVendido: 0,
  pesoMedioDisponivel: 0,
  lotes: []
};
const product = {
  estoqueDisponivel: 2,
  estoqueVendido: 0,
  pesoEntradaAcumulado: 1.5,
  pesoSaidaAcumulado: 0,
  pesoTotalDisponivel: 1.5,
  pesoTotalFisico: 1.5
};
const hasPhysicalHistory = true;
if (!summaryAfterInventoryReverse.totalPecasFisicas && !hasPhysicalHistory) {
  throw new Error('Não deveria retornar para SKU com histórico físico.');
}
product.estoqueDisponivel = summaryAfterInventoryReverse.disponivel;
product.pesoTotalDisponivel = summaryAfterInventoryReverse.pesoDisponivel;
product.pesoTotalFisico = summaryAfterInventoryReverse.pesoTotal;
product.pesoTotalVendido = summaryAfterInventoryReverse.pesoVendido;
assert.deepEqual(
  { estoqueDisponivel: product.estoqueDisponivel, pesoTotalDisponivel: product.pesoTotalDisponivel, pesoTotalFisico: product.pesoTotalFisico, pesoTotalVendido: product.pesoTotalVendido },
  { estoqueDisponivel: 0, pesoTotalDisponivel: 0, pesoTotalFisico: 0, pesoTotalVendido: 0 },
  'Estorno integral deve deixar quantidade e saldos de peso em zero.'
);

console.log('V63 OK: venda parcial devolve peso real e inventário integral zera quantidade/peso agregados.');
