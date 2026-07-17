import assert from "node:assert/strict";
import fs from "node:fs";
import { buildInventoryReport, buildSalesReport } from "../js/reports.js";

const appSource = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.ok(
  appSource.includes('v62-correcao-producao-peso-relatorios-sem-duplicidade-20260714'),
  "Build V62 deve estar identificado no app.js."
);

const productionReadyEnd = appSource.indexOf('} else if (tipoImportacao === \"venda_inteligente\") {');
const productionReadyStart = appSource.lastIndexOf('} else if (isProductionReadyImport(tipoImportacao)) {', productionReadyEnd);
assert.ok(productionReadyStart > 0 && productionReadyEnd > productionReadyStart, "Bloco de produção pronta deve existir.");
const productionReadyBlock = appSource.slice(productionReadyStart, productionReadyEnd);
assert.ok(
  productionReadyBlock.includes('entradaDelta: pesoTotalReal'),
  "Produção pronta por PDF deve creditar o peso total no razão independente."
);
assert.ok(
  !/product\.estoqueDisponivel\s*=\s*quantitySafe\(product\.estoqueDisponivel[^\n]+\+\s*qtd/.test(productionReadyBlock),
  "Produção pronta não pode incrementar saldo agregado antes de criar peças físicas."
);
assert.ok(
  productionReadyBlock.indexOf('await ensureLegacyPhysicalPieces(id, product)') < productionReadyBlock.indexOf('createPhysicalPieces({'),
  "Saldo legado deve ser preservado antes da criação da nova peça física."
);

const data = {
  produtos: {
    A: {
      id: "A", codigo: "A", descricao: "ANEL A", material: "Ouro 18K", medida: "18",
      estoqueDisponivel: 1, estoqueVendido: 2,
      pesoControleModo: "quantidade_peso_independentes",
      pesoEntradaAcumulado: 2.4, pesoSaidaAcumulado: 1.55
    },
    B: {
      id: "B", codigo: "B", descricao: "ANEL B", material: "Ouro 10K", medida: "22",
      estoqueDisponivel: 0, estoqueVendido: 2,
      pesoControleModo: "quantidade_peso_independentes",
      pesoEntradaAcumulado: 1.5, pesoSaidaAcumulado: 1.4
    },
    D: {
      id: "D", codigo: "D", descricao: "ANEL D", material: "Ouro 18K", medida: "17",
      estoqueDisponivel: 1, estoqueVendido: 0,
      pesoControleModo: "quantidade_peso_independentes",
      pesoEntradaAcumulado: 0.73, pesoSaidaAcumulado: 0
    }
  },
  pecasEstoque: {
    A1: { id: "A1", produtoId: "A", codigo: "A", descricao: "ANEL A", material: "Ouro 18K", medida: "18", status: "disponivel" },
    A2: { id: "A2", produtoId: "A", codigo: "A", descricao: "ANEL A", material: "Ouro 18K", medida: "18", status: "vendido" },
    A3: { id: "A3", produtoId: "A", codigo: "A", descricao: "ANEL A", material: "Ouro 18K", medida: "18", status: "vendido" },
    B1: { id: "B1", produtoId: "B", codigo: "B", descricao: "ANEL B", material: "Ouro 10K", medida: "22", status: "vendido" },
    B2: { id: "B2", produtoId: "B", codigo: "B", descricao: "ANEL B", material: "Ouro 10K", medida: "22", status: "vendido" },
    D1: { id: "D1", produtoId: "D", codigo: "D", descricao: "ANEL D", material: "Ouro 18K", medida: "17", status: "disponivel" },
    OLD: { id: "OLD", produtoId: "D", codigo: "D", descricao: "ANEL D", material: "Ouro 18K", medida: "17", status: "estornada" }
  },
  lotes: {},
  vendas: {
    V1: { id: "V1", codigo: "A", descricao: "ANEL A", medida: "18", cliente: "Teste", quantidade: 2, quantidadeSolicitada: 2, quantidadeBaixada: 2, quantidadePendenteAnaliseGestor: 0, pesoTotal: 1.55, pesoTotalBaixado: 1.55, status: "baixada", criadoEm: "2026-07-14T10:00:00Z" },
    V2: { id: "V2", codigo: "B", descricao: "ANEL B", medida: "22", cliente: "Teste", quantidade: 3, quantidadeSolicitada: 3, quantidadeBaixada: 2, quantidadePendenteAnaliseGestor: 1, pesoTotal: 2.1, pesoTotalBaixado: 1.4, status: "pendente_analise_gestor", criadoEm: "2026-07-14T10:00:00Z" },
    V3: { id: "V3", codigo: "D", descricao: "ANEL D", medida: "17", cliente: "Teste", quantidade: 1, quantidadeSolicitada: 1, quantidadeBaixada: 0, quantidadePendenteAnaliseGestor: 1, pesoTotal: 0.73, pesoTotalBaixado: 0, status: "pendente_analise_gestor", criadoEm: "2026-07-14T10:00:00Z" },
    REV: { id: "REV", codigo: "A", quantidade: 100, quantidadeBaixada: 100, status: "estornada", criadoEm: "2026-07-14T10:00:00Z" }
  },
  configuracoes: {}
};

const inventory = buildInventoryReport(data, { modo: "resumo" });
assert.match(inventory, /<span>Disponível<\/span><strong>2<\/strong>/, "Relatório deve mostrar 2 peças disponíveis reais, sem somar agregado + físico.");
assert.match(inventory, /<span>Peças físicas<\/span><strong>6<\/strong>/, "Peça estornada não pode entrar no total físico ativo.");
assert.match(inventory, /<span>Peso disponível<\/span><strong>1,680 g<\/strong>/, "Peso disponível deve vir do razão independente dos SKUs.");

const sales = buildSalesReport(data, {});
assert.match(sales, /<span>Quantidade solicitada<\/span><strong>6<\/strong>/, "Venda deve separar quantidade solicitada.");
assert.match(sales, /<span>Quantidade baixada<\/span><strong>4<\/strong>/, "Venda deve somar apenas o que realmente saiu do estoque.");
assert.match(sales, /<span>Faltante<\/span><strong>2<\/strong>/, "Venda deve mostrar o total faltante.");
assert.match(sales, /<span>Peso realmente baixado<\/span><strong>2,950 g<\/strong>/, "Peso do relatório deve ser o peso realmente baixado.");
assert.ok(!sales.includes(">100<"), "Venda estornada não pode aparecer no relatório ativo.");

console.log("V62 OK: produção pronta sem duplicidade, razão de peso e relatórios reais validados.");
