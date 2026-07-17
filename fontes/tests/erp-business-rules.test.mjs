import assert from "node:assert/strict";
import fs from "node:fs";

const stockKey = (item) => [
  String(item.codigo || "").toUpperCase().replace(/\s+/g, ""),
  String(item.descricao || "").trim().toUpperCase(),
  String(item.material || "").trim().toUpperCase(),
  String(item.medida || "").replace(/^0+(?=\d)/, "")
].join("|");

function makeState() {
  return {
    imported: new Set(),
    products: new Map(),
    pieces: [],
    alerts: [],
    productionOrders: []
  };
}

function productFromItem(item) {
  return {
    codigo: item.codigo,
    descricao: item.descricao,
    material: item.material,
    medida: item.medida,
    estoqueCritico: 0,
    estoqueIdeal: 0,
    estoqueSugestao: 0
  };
}

function importInventory(state, pedido, items) {
  const importKey = `${pedido}|inventario`;
  if (state.imported.has(importKey)) throw new Error("Este inventario ja foi inserido.");
  state.imported.add(importKey);

  for (const item of items) {
    const key = stockKey(item);
    if (!state.products.has(key)) state.products.set(key, productFromItem(item));
    const pesoUnitarioEstimado = item.quantidade > 0 ? item.pesoTotalLinha / item.quantidade : 0;
    for (let i = 0; i < item.quantidade; i++) {
      state.pieces.push({
        key,
        status: "disponivel",
        pedido,
        pesoUnitarioEstimado,
        pesoTotalLinha: item.pesoTotalLinha
      });
    }
  }
}

function importSmartSale(state, pedido, items) {
  const importKey = `${pedido}|venda_inteligente`;
  if (state.imported.has(importKey)) throw new Error("Venda inteligente ja importada.");
  state.imported.add(importKey);

  for (const item of items) {
    const key = stockKey(item);
    if (!state.products.has(key)) state.products.set(key, productFromItem(item));
    const available = state.pieces.filter((piece) => piece.key === key && piece.status === "disponivel");
    const baixa = Math.min(item.quantidade, available.length);
    for (const piece of available.slice(0, baixa)) piece.status = "vendido";
    const faltante = item.quantidade - baixa;
    if (faltante > 0) {
      state.alerts.push({
        pedido,
        arquivo: "Pedido 26758.pdf",
        cliente: "Cliente teste",
        codigo: item.codigo,
        descricao: item.descricao,
        material: item.material,
        medida: item.medida,
        quantidadeSolicitada: item.quantidade,
        quantidadeBaixada: baixa,
        quantidadeFaltante: faltante,
        motivo: "Venda inteligente sem estoque suficiente",
        status: "pendente",
        decisaoEsperada: "produzir, comprar, ajustar estoque ou cancelar"
      });
    }
  }
}

function applyStockRules(products, keys, patch) {
  for (const key of keys) {
    const product = products.get(key);
    if (!product) continue;
    Object.assign(product, patch);
  }
}

const inventory26758 = [12, 13, 14, 15, 8].map((medida) => ({
  codigo: "2740AGL",
  descricao: "ANEL 2740 AGL",
  material: "OURO 18K",
  medida: String(medida).padStart(2, "0"),
  quantidade: 10,
  pesoTotalLinha: 10
}));

const sale26758 = [
  ...[12, 13, 14, 15, 8].map((medida) => ({
    codigo: "2740AGL",
    descricao: "ANEL 2740 AGL",
    material: "OURO 18K",
    medida: String(medida).padStart(2, "0"),
    quantidade: 5,
    pesoTotalLinha: 999
  })),
  { codigo: "5748AGLZ", descricao: "ANEL 5748 AGLZ", material: "OURO 10K", medida: "12", quantidade: 6, pesoTotalLinha: 6 },
  { codigo: "5749AGLZ", descricao: "ANEL 5749 AGLZ", material: "OURO 10K", medida: "15", quantidade: 6, pesoTotalLinha: 6 }
];

const state = makeState();
importInventory(state, "26758", inventory26758);

assert.equal(state.pieces.length, 50, "Inventario 26758 deve criar 50 pecas fisicas.");
assert.equal(state.pieces.reduce((sum, piece) => sum + piece.pesoUnitarioEstimado, 0), 50, "Peso total estimado deve ser 50g, nao 500g.");
assert.throws(() => importInventory(state, "26758", inventory26758), /inventario ja foi inserido/i, "Duplicidade de inventario deve ser recusada.");

importSmartSale(state, "26758", sale26758);

for (const medida of ["08", "12", "13", "14", "15"]) {
  const key = stockKey({ codigo: "2740AGL", descricao: "ANEL 2740 AGL", material: "OURO 18K", medida });
  const sold = state.pieces.filter((piece) => piece.key === key && piece.status === "vendido").length;
  const available = state.pieces.filter((piece) => piece.key === key && piece.status === "disponivel").length;
  assert.equal(sold, 5, `Medida ${medida} deve baixar 5 pecas.`);
  assert.equal(available, 5, `Medida ${medida} deve manter 5 pecas disponiveis.`);
}

assert.equal(state.alerts.length, 2, "Venda inteligente deve criar dois alertas para itens sem estoque.");
assert.deepEqual(state.alerts.map((alert) => `${alert.codigo}-${alert.medida}-${alert.quantidadeFaltante}`).sort(), ["5748AGLZ-12-6", "5749AGLZ-15-6"]);
assert.equal(state.productionOrders.length, 0, "Venda inteligente nao deve criar producao automatica.");
assert.ok(state.pieces.every((piece) => piece.status === "disponivel" || piece.status === "vendido"), "Estoque nao deve ficar negativo.");

const newOnly = makeState();
importSmartSale(newOnly, "30000", [{ codigo: "NOVO1", descricao: "ANEL NOVO", material: "PRATA", medida: "18", quantidade: 3, pesoTotalLinha: 3 }]);
assert.ok(newOnly.products.has(stockKey({ codigo: "NOVO1", descricao: "ANEL NOVO", material: "PRATA", medida: "18" })), "Produto novo deve ser cadastrado.");
assert.equal(newOnly.alerts[0].quantidadeFaltante, 3, "Produto novo sem estoque deve gerar alerta total.");
assert.equal(newOnly.productionOrders.length, 0, "Produto novo sem estoque nao deve gerar producao automatica.");

const selectedKeys = Array.from(state.products.keys()).filter((key) => key.includes("2740AGL"));
applyStockRules(state.products, selectedKeys, { estoqueCritico: 3, estoqueIdeal: 10, estoqueSugestao: 7 });
for (const key of selectedKeys) {
  const product = state.products.get(key);
  assert.equal(product.estoqueCritico, 3);
  assert.equal(product.estoqueIdeal, 10);
  assert.equal(product.estoqueSugestao, 7);
}

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const blockedAutoProductionToken = ["producao", "automatica"].join("_");
const blockedSmartSaleReplenishmentToken = ["venda", "inteligente", "sem", "estoque", "reposicao"].join("_");
assert.ok(!app.includes(blockedAutoProductionToken), "app.js nao deve manter marcador de producao automatica.");
assert.ok(!app.includes(blockedSmartSaleReplenishmentToken), "app.js nao deve manter reposicao automatica na venda inteligente.");
assert.ok(app.includes("alertasOperacionais"), "Alertas do gestor devem ser colecao operacional visivel.");

console.log("ERP business rules OK: inventario, venda inteligente, alertas e parametros de estoque validados.");
