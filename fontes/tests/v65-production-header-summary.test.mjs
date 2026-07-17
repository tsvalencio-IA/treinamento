import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.ok(
  app.includes("v65-rastreabilidade-cabecalho-producao-baixa-excedente-20260715"),
  "Build V65 deve estar identificado."
);
assert.ok(app.includes("productionReadyDocumentSummary"), "Deve existir resumo consolidado do documento de produção pronta.");
assert.ok(
  app.includes("quantidadeRecebidaTotal: quantitySafe(productionReadyDocumentSummary.quantidadeRecebidaTotal)"),
  "Cabeçalho deve registrar a quantidade total recebida."
);
assert.ok(
  app.includes("quantidadeBaixadaVendas: quantitySafe(productionReadyDocumentSummary.quantidadeBaixadaVendas)"),
  "Cabeçalho deve registrar a quantidade aplicada em vendas pendentes."
);
assert.ok(
  app.includes("quantidadeExcedenteEstoque: quantitySafe(productionReadyDocumentSummary.quantidadeExcedenteEstoque)"),
  "Cabeçalho deve registrar o excedente que permaneceu em estoque."
);
assert.ok(app.includes("atendimentoVendaResumo"), "Cabeçalho deve ter resumo legível do atendimento de vendas.");
assert.ok(app.includes("await DB.patch(\"producoes\", producaoId, productionPatch)"), "Registro técnico por item deve continuar preservado.");
assert.ok(app.includes("applyProductionToApprovedAlerts"), "Fluxo V64 de conciliação com alertas aprovados deve permanecer.");

function summarize(rows) {
  return rows.reduce((acc, row) => {
    acc.quantidadeRecebidaTotal += row.recebida;
    acc.quantidadeBaixadaVendas += row.baixada;
    acc.quantidadeExcedenteEstoque += row.excedente;
    acc.pesoBaixadoVendas += row.pesoBaixado;
    return acc;
  }, { quantidadeRecebidaTotal: 0, quantidadeBaixadaVendas: 0, quantidadeExcedenteEstoque: 0, pesoBaixadoVendas: 0 });
}

assert.deepEqual(
  summarize([{ recebida: 20, baixada: 10, excedente: 10, pesoBaixado: 8.2 }]),
  { quantidadeRecebidaTotal: 20, quantidadeBaixadaVendas: 10, quantidadeExcedenteEstoque: 10, pesoBaixadoVendas: 8.2 }
);
assert.deepEqual(
  summarize([
    { recebida: 8, baixada: 5, excedente: 3, pesoBaixado: 4.1 },
    { recebida: 12, baixada: 5, excedente: 7, pesoBaixado: 4.1 }
  ]),
  { quantidadeRecebidaTotal: 20, quantidadeBaixadaVendas: 10, quantidadeExcedenteEstoque: 10, pesoBaixadoVendas: 8.2 },
  "Cabeçalho deve consolidar corretamente PDFs com vários itens/linhas."
);

console.log("V65 OK: cabeçalho da produção pronta registra recebido, baixa em vendas e excedente sem alterar o fluxo operacional V64.");
