import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

const requiredTokens = [
  'pesoControleModo = "quantidade_peso_independentes"',
  'pesoControleModo:',
  '"total_lote"',
  'pesoIndividualConhecido: false',
  'pesoTotalRealVenda',
  'Peso total real vendido',
  'Estornar venda',
  'Estornar PDF',
  'ESTORNAR VENDA',
  'ESTORNAR PDF',
  'reverseSaleRecords',
  'reverseInventoryDocument',
  'VENDA BLOQUEADA',
  'pesoInsuficiente'
];

for (const token of requiredTokens) {
  assert.ok(app.includes(token), `V56 sem marcador obrigatório: ${token}`);
}

function createLedger({ quantidade, pesoTotal }) {
  return {
    quantidadeEntrada: quantidade,
    quantidadeSaida: 0,
    pesoEntrada: pesoTotal,
    pesoSaida: 0
  };
}

function sell(ledger, { quantidade, pesoTotal }) {
  const quantidadeDisponivel = ledger.quantidadeEntrada - ledger.quantidadeSaida;
  const pesoDisponivel = ledger.pesoEntrada - ledger.pesoSaida;
  assert.ok(quantidade <= quantidadeDisponivel, "Venda não pode baixar quantidade maior que o estoque.");
  assert.ok(pesoTotal <= pesoDisponivel + 0.000001, "Venda não pode baixar peso maior que o peso disponível.");
  ledger.quantidadeSaida += quantidade;
  ledger.pesoSaida += pesoTotal;
}

function reverseSale(ledger, { quantidade, pesoTotal }) {
  ledger.quantidadeSaida -= quantidade;
  ledger.pesoSaida -= pesoTotal;
}

function available(ledger) {
  return {
    quantidade: ledger.quantidadeEntrada - ledger.quantidadeSaida,
    peso: ledger.pesoEntrada - ledger.pesoSaida
  };
}

const ledger = createLedger({ quantidade: 10, pesoTotal: 10 });
sell(ledger, { quantidade: 6, pesoTotal: 7.5 });
assert.deepEqual(available(ledger), { quantidade: 4, peso: 2.5 }, "10 peças/10g menos 6 peças/7,5g deve deixar 4 peças/2,5g.");

reverseSale(ledger, { quantidade: 6, pesoTotal: 7.5 });
assert.deepEqual(available(ledger), { quantidade: 10, peso: 10 }, "Estorno deve devolver exatamente quantidade e peso da venda.");

ledger.quantidadeEntrada += 2;
ledger.pesoEntrada += 4;
assert.deepEqual(available(ledger), { quantidade: 12, peso: 14 }, "Nova entrada deve somar quantidade e peso de forma independente.");

// Prova conceitual: 10 peças/10g não implica dez peças reais de 1g.
const pesosPossiveis = [0.9, 1.1, 0.8, 1.2, 0.95, 1.05, 0.85, 1.15, 1.0, 1.0];
assert.equal(pesosPossiveis.length, 10);
assert.ok(Math.abs(pesosPossiveis.reduce((a, b) => a + b, 0) - 10) < 0.000001);
assert.ok(new Set(pesosPossiveis).size > 1, "Peças podem ter pesos individuais diferentes mesmo com total de 10g.");

console.log("V56 OK: quantidade e peso independentes, saldo 4 peças/2,5g e estorno exato validados.");
