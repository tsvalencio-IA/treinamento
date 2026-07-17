import { APP_CONFIG } from "./config.js";
import { daysBetween, escapeHtml, formatCurrency, formatDate, formatNumber, objectToArray, sum } from "./utils.js";

function reportFooter() {
  return `
    <div class="report-footer">
      <span>Documento gerado em ${new Date().toLocaleString("pt-BR")}</span>
      <strong>${escapeHtml(APP_CONFIG.app.assinatura)}</strong>
    </div>
  `;
}

function normalizeStockCode(value = "") {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function isValidStockItem(item = {}) {
  const code = normalizeStockCode(item.codigo || item.codigoOriginal || item.id || "");
  if (!code) return false;
  if (/(SUBTOTAL|TOTAL|FRETE|ACRESCIMO|ACRÉSCIMO|BRITS|PEDRAS|OUTRAS|PEDIDO|RELATORIO|RELATÓRIO|HTTP|WWW|POWERED|DOCUMENTO)/i.test(code)) return false;
  if (String(item.descricao || "").match(/SubTotal|Total Pedido|Qtd de Item|Qtd Peça|Frete|Acr[eé]scimo/i)) return false;
  return true;
}

function pieceIsActive(piece = {}) {
  const status = String(piece.status || piece.situacao || "disponivel").toLowerCase();
  return !piece.arquivada && ![
    "substituida_por_inventario", "cancelada", "excluida", "cancelado", "excluido",
    "arquivada", "arquivado", "estornada", "estornado"
  ].includes(status);
}

function hasIndependentWeightLedger(product = {}) {
  return product.pesoControleModo === "quantidade_peso_independentes" ||
    product.pesoEntradaAcumulado !== undefined ||
    product.pesoSaidaAcumulado !== undefined;
}

function independentAvailableWeight(product = {}) {
  const entrada = Math.max(0, Number(product.pesoEntradaAcumulado ?? product.pesoTotalFisico ?? 0));
  const saida = Math.max(0, Number(product.pesoSaidaAcumulado ?? product.pesoTotalVendido ?? 0));
  const reservado = Math.max(0, Number(product.pesoReservadoAcumulado ?? 0));
  const consignado = Math.max(0, Number(product.pesoConsignadoAcumulado ?? 0));
  return Math.max(0, entrada - saida - reservado - consignado);
}

function inventoryRowsFromData(data = {}) {
  const produtos = objectToArray(data.produtos).filter(isValidStockItem);
  const pecas = objectToArray(data.pecasEstoque).filter((p) => pieceIsActive(p) && isValidStockItem(p));
  const byKey = new Map();
  const productByKey = new Map();

  function keyFrom(item = {}) {
    return [
      normalizeStockCode(item.codigo || item.codigoOriginal || "SEM_CODIGO"),
      String(item.material || "SEM_MATERIAL").trim(),
      String(item.medida || "SEM_MEDIDA").trim()
    ].join("|");
  }

  produtos.forEach((item) => {
    const key = keyFrom(item);
    productByKey.set(key, item);
    byKey.set(key, {
      id: item.id || key,
      produtoId: item.id || "",
      codigo: item.codigo || item.codigoOriginal || "",
      descricao: item.descricao || "",
      tipo: item.tipo || "Produto",
      material: item.material || "",
      medida: item.medida || "",
      disponivel: Number(item.estoqueDisponivel || 0),
      reservado: Number(item.estoqueReservado || 0),
      consignado: Number(item.estoqueConsignado || 0),
      vendido: Number(item.estoqueVendido || 0),
      minimo: Number(item.estoqueMinimo || 0),
      pesoDisponivel: Number(item.pesoTotalDisponivel || 0),
      lotes: [],
      pecasFisicas: 0,
      modelo: "Saldo legado"
    });
  });

  pecas.forEach((piece) => {
    const key = keyFrom(piece);
    const row = byKey.get(key) || {
      id: piece.produtoId || key,
      produtoId: piece.produtoId || "",
      codigo: piece.codigo || piece.codigoOriginal || "",
      descricao: piece.descricao || "",
      tipo: piece.tipo || "Produto",
      material: piece.material || "",
      medida: piece.medida || "",
      disponivel: 0,
      reservado: 0,
      consignado: 0,
      vendido: 0,
      minimo: Number(piece.estoqueMinimo || 0),
      pesoDisponivel: 0,
      lotes: [],
      pecasFisicas: 0,
      modelo: "Peça física"
    };

    // A partir da primeira peça física, ela passa a ser a fonte única da quantidade.
    // O saldo agregado do produto é espelho operacional e não pode ser somado novamente.
    if (!row.pecasFisicas) {
      row.disponivel = 0;
      row.reservado = 0;
      row.consignado = 0;
      row.vendido = 0;
      row.pesoDisponivel = 0;
    }

    const status = String(piece.status || "disponivel").toLowerCase();
    if (status === "disponivel") {
      row.disponivel += 1;
      row.pesoDisponivel += Number(piece.pesoReal || piece.pesoUnitario || piece.peso || piece.pesoUnitarioEstimado || 0);
    } else if (status === "reservado") {
      row.reservado += 1;
    } else if (status === "consignado") {
      row.consignado += 1;
    } else if (status === "vendido") {
      row.vendido += 1;
    }

    row.pecasFisicas += 1;
    row.modelo = "Peça física";
    if (piece.lote || piece.loteCodigo || piece.loteId) row.lotes.push(piece.lote || piece.loteCodigo || piece.loteId);
    if (!row.descricao && piece.descricao) row.descricao = piece.descricao;
    byKey.set(key, row);
  });

  return Array.from(byKey.entries())
    .map(([key, row]) => {
      const product = productByKey.get(key) || {};
      const pesoDisponivel = row.pecasFisicas && hasIndependentWeightLedger(product)
        ? independentAvailableWeight(product)
        : row.pesoDisponivel;
      return {
        ...row,
        pesoDisponivel,
        lotes: [...new Set(row.lotes)].filter(Boolean)
      };
    })
    .sort((a, b) => `${a.codigo}-${a.material}-${a.medida}`.localeCompare(`${b.codigo}-${b.material}-${b.medida}`, "pt-BR", { numeric: true }));
}

export function criticalProducts(data) {
  return objectToArray(data.produtos)
    .filter(isValidStockItem)
    .filter((item) => Number(item.estoqueDisponivel || 0) <= Number(item.estoqueMinimo || 0))
    .sort((a, b) => Number(a.estoqueDisponivel || 0) - Number(b.estoqueDisponivel || 0));
}

export function stoppedProducts(data) {
  const dias = Number(data.configuracoes?.diasEstoqueParado || APP_CONFIG.negocio.diasEstoqueParado || 90);
  return objectToArray(data.produtos)
    .filter(isValidStockItem)
    .map((item) => ({ ...item, diasParado: daysBetween(item.ultimaMovimentacaoEm) }))
    .filter((item) => item.diasParado >= dias)
    .sort((a, b) => b.diasParado - a.diasParado);
}

function saleIsActive(sale = {}) {
  const status = String(sale.status || sale.situacao || "").toLowerCase();
  return !["estornada", "estornado", "cancelada", "cancelado", "excluida", "excluido", "arquivada", "arquivado"].includes(status);
}

function saleRequestedQuantity(sale = {}) {
  return Math.max(0, Number(sale.quantidadeSolicitada ?? sale.quantidade ?? 0));
}

function saleLoweredQuantity(sale = {}) {
  if (sale.quantidadeBaixada !== undefined && sale.quantidadeBaixada !== null && sale.quantidadeBaixada !== "") {
    return Math.max(0, Number(sale.quantidadeBaixada || 0));
  }
  // Registros manuais/legados sem o campo explícito representam venda concluída.
  return saleRequestedQuantity(sale);
}

function saleMissingQuantity(sale = {}) {
  const explicit = sale.quantidadePendenteAnaliseGestor ?? sale.quantidadePendenteProducao ?? sale.quantidadeFaltante;
  if (explicit !== undefined && explicit !== null && explicit !== "") return Math.max(0, Number(explicit || 0));
  return Math.max(0, saleRequestedQuantity(sale) - saleLoweredQuantity(sale));
}

function saleLoweredWeight(sale = {}) {
  const explicit = sale.pesoTotalBaixado ?? sale.pesoTotalRealVenda ?? sale.pesoTotalVenda;
  if (explicit !== undefined && explicit !== null && explicit !== "") return Math.max(0, Number(explicit || 0));
  const requestedWeight = Math.max(0, Number(sale.pesoTotalSolicitado ?? sale.pesoTotal ?? sale.peso ?? 0));
  const requested = saleRequestedQuantity(sale);
  const lowered = saleLoweredQuantity(sale);
  if (!requested || !lowered) return 0;
  return requestedWeight * (lowered / requested);
}

export function buildSalesReport(data, filters = {}) {
  const code = (filters.codigo || "").trim().toUpperCase();
  const medida = (filters.medida || "").trim();
  const vendedor = (filters.vendedor || "").trim().toUpperCase();
  const cliente = (filters.cliente || "").trim().toUpperCase();

  let vendas = objectToArray(data.vendas).filter(saleIsActive);
  if (code) vendas = vendas.filter((item) => String(item.codigo || "").toUpperCase().includes(code));
  if (medida) vendas = vendas.filter((item) => String(item.medida || "") === medida);
  if (cliente) vendas = vendas.filter((item) => String(item.cliente || "").toUpperCase().includes(cliente));
  if (vendedor) vendas = vendas.filter((item) => String(item.vendedor || "").toUpperCase().includes(vendedor));

  const solicitado = sum(vendas, saleRequestedQuantity);
  const baixado = sum(vendas, saleLoweredQuantity);
  const faltante = sum(vendas, saleMissingQuantity);
  const peso = sum(vendas, saleLoweredWeight);
  const total = sum(vendas, (item) => item.valorTotal);

  const rows = vendas.map((venda) => `
    <tr>
      <td>${escapeHtml(formatDate(venda.criadoEm))}</td>
      <td>${escapeHtml(venda.codigo || "")}</td>
      <td>${escapeHtml(venda.descricao || "")}</td>
      <td>${escapeHtml(venda.medida || "")}</td>
      <td>${escapeHtml(venda.cliente || "")}</td>
      <td>${escapeHtml(venda.vendedor || "")}</td>
      <td>${formatNumber(saleRequestedQuantity(venda), 0)}</td>
      <td><strong>${formatNumber(saleLoweredQuantity(venda), 0)}</strong></td>
      <td>${formatNumber(saleMissingQuantity(venda), 0)}</td>
      <td>${formatNumber(saleLoweredWeight(venda), 3)} g</td>
      <td>${formatCurrency(venda.valorTotal || 0)}</td>
    </tr>
  `).join("");

  return `
    <div class="report-box printable">
      <div class="report-header">
        <div>
          <h2>Laudo de Vendas por Produto</h2>
          <p>Código: <strong>${escapeHtml(code || "Todos")}</strong> · Medida: <strong>${escapeHtml(medida || "Todas")}</strong> · Cliente: <strong>${escapeHtml(filters.cliente || "Todos")}</strong></p>
        </div>
        <div><span class="badge gold">Relatório Gerencial</span></div>
      </div>

      <div class="grid grid-4">
        <div class="kpi"><span>Quantidade solicitada</span><strong>${formatNumber(solicitado, 0)}</strong></div>
        <div class="kpi"><span>Quantidade baixada</span><strong>${formatNumber(baixado, 0)}</strong></div>
        <div class="kpi"><span>Faltante</span><strong>${formatNumber(faltante, 0)}</strong></div>
        <div class="kpi"><span>Peso realmente baixado</span><strong>${formatNumber(peso, 3)} g</strong></div>
      </div>

      <div style="height:18px"></div>

      ${vendas.length ? `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Código</th><th>Descrição</th><th>Medida</th><th>Cliente</th><th>Vendedor</th>
                <th>Solic.</th><th>Baix.</th><th>Falt.</th><th>Peso baixado</th><th>Valor</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhuma venda ativa encontrada para os filtros informados.</div>`}

      ${reportFooter()}
    </div>
  `;
}

export function buildInventoryReport(data, filters = {}) {
  let rows = inventoryRowsFromData(data);

  const code = normalizeStockCode(filters.codigo || "");
  const medida = String(filters.medida || "").trim();
  const material = String(filters.material || "").trim().toUpperCase();
  const modo = String(filters.modo || filters.visualizacao || "resumo").toLowerCase();

  if (code) rows = rows.filter((item) => normalizeStockCode(item.codigo).includes(code));
  if (medida) rows = rows.filter((item) => String(item.medida || "") === medida || String(item.medida || "").replace(/^0+(?=\d)/, "") === medida.replace(/^0+(?=\d)/, ""));
  if (material) rows = rows.filter((item) => String(item.material || "").toUpperCase().includes(material));

  const produtos = objectToArray(data.produtos).filter(isValidStockItem);
  const pecas = objectToArray(data.pecasEstoque).filter((p) => pieceIsActive(p) && isValidStockItem(p));
  const disponivel = sum(rows, (item) => item.disponivel);
  const consignado = sum(rows, (item) => item.consignado);
  const vendido = sum(rows, (item) => item.vendido);
  const pesoDisponivel = sum(rows, (item) => item.pesoDisponivel);
  const criticos = rows.filter((item) => Number(item.disponivel || 0) <= Number(item.minimo || 0));
  const lotes = objectToArray(data.lotes).filter(Boolean);

  const resumoRows = rows.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.codigo || "")}</strong><small>${escapeHtml(item.tipo || "Produto")}</small></td>
      <td>${escapeHtml(item.descricao || "")}</td>
      <td>${escapeHtml(item.material || "-")}</td>
      <td>${escapeHtml(item.medida || "-")}</td>
      <td class="num"><strong>${formatNumber(item.disponivel || 0, 0)}</strong></td>
      <td class="num">${formatNumber(item.consignado || 0, 0)}</td>
      <td class="num">${formatNumber(item.vendido || 0, 0)}</td>
      <td class="num">${formatNumber(item.pesoDisponivel || 0, 3)} g</td>
      <td>${escapeHtml((item.lotes || []).slice(0, 3).join(", ") || "-")}</td>
      <td>${item.pecasFisicas ? `<span class="badge success">Peça física</span>` : `<span class="badge warning">Saldo legado</span>`}</td>
    </tr>
  `).join("");

  const pecasDetalhadas = pecas
    .filter((piece) => {
      if (code && !normalizeStockCode(piece.codigo || piece.codigoOriginal).includes(code)) return false;
      if (medida && String(piece.medida || "").replace(/^0+(?=\d)/, "") !== medida.replace(/^0+(?=\d)/, "")) return false;
      if (material && !String(piece.material || "").toUpperCase().includes(material)) return false;
      return true;
    })
    .sort((a, b) => `${a.codigo}-${a.medida}-${a.pecaCodigo || a.id}`.localeCompare(`${b.codigo}-${b.medida}-${b.pecaCodigo || b.id}`, "pt-BR", { numeric: true }))
    .slice(0, 1000);

  const detailRows = pecasDetalhadas.map((piece) => `
    <tr>
      <td><strong>${escapeHtml(piece.pecaCodigo || piece.id || "")}</strong></td>
      <td>${escapeHtml(piece.codigo || "")}</td>
      <td>${escapeHtml(piece.material || "-")}</td>
      <td>${escapeHtml(piece.medida || "-")}</td>
      <td class="num">${formatNumber(piece.pesoReal || piece.pesoUnitario || piece.peso || 0, 3)} g</td>
      <td class="num">${piece.pesoPedido || piece.pesoPrevisto ? `${formatNumber(piece.pesoPedido || piece.pesoPrevisto || 0, 3)} g` : "-"}</td>
      <td>${escapeHtml(piece.lote || piece.loteCodigo || piece.loteId || "-")}</td>
      <td>${escapeHtml(piece.status || "disponivel")}</td>
      <td>${escapeHtml(piece.origem || "-")}</td>
    </tr>
  `).join("");

  return `
    <div class="report-box printable report-compact">
      <div class="report-header">
        <div>
          <span class="eyebrow">Laudo operacional</span>
          <h2>Laudo Geral de Estoque</h2>
          <p>Resumo compacto por código, material e medida. A impressão remove menus e usa layout próprio.</p>
        </div>
        <div><span class="badge gold">Estoque real</span></div>
      </div>

      <div class="report-summary-grid">
        <div class="report-kpi"><span>SKUs</span><strong>${formatNumber(rows.length, 0)}</strong><small>código + material + medida</small></div>
        <div class="report-kpi"><span>Disponível</span><strong>${formatNumber(disponivel, 0)}</strong><small>peças prontas</small></div>
        <div class="report-kpi"><span>Peso disponível</span><strong>${formatNumber(pesoDisponivel, 3)} g</strong><small>soma das peças</small></div>
        <div class="report-kpi"><span>Críticos</span><strong>${formatNumber(criticos.length, 0)}</strong><small>mínimo configurado</small></div>
        <div class="report-kpi"><span>Peças físicas</span><strong>${formatNumber(pecas.length, 0)}</strong><small>unidades individuais</small></div>
        <div class="report-kpi"><span>Lotes</span><strong>${formatNumber(lotes.length, 0)}</strong><small>produção/inventário</small></div>
      </div>

      ${rows.length ? `
        <div class="report-section-title">
          <h3>Resumo por SKU</h3>
          <span>${formatNumber(rows.length, 0)} linha(s)</span>
        </div>
        <div class="table-wrap table-wrap-fit report-table-wrap">
          <table class="compact-table report-table">
            <thead>
              <tr>
                <th>Código</th><th>Descrição</th><th>Material</th><th>Medida</th>
                <th>Disp.</th><th>Cons.</th><th>Vend.</th><th>Peso</th><th>Lotes</th><th>Base</th>
              </tr>
            </thead>
            <tbody>${resumoRows}</tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhum produto cadastrado.</div>`}

      ${modo === "detalhado" && pecasDetalhadas.length ? `
        <div class="report-section-title page-break-soft">
          <h3>Peças físicas individuais</h3>
          <span>${formatNumber(pecasDetalhadas.length, 0)} peça(s)</span>
        </div>
        <div class="table-wrap table-wrap-fit report-table-wrap">
          <table class="compact-table report-table">
            <thead>
              <tr>
                <th>Peça</th><th>Código</th><th>Material</th><th>Medida</th><th>Peso real</th><th>Peso pedido</th><th>Lote</th><th>Status</th><th>Origem</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>
        </div>
      ` : ""}

      <div class="print-note">
        Relatório gerado em modo ${escapeHtml(modo === "detalhado" ? "detalhado" : "resumo")}. Para conferência diária, use resumo. Para auditoria de peça por peça, use detalhado.
      </div>

      ${reportFooter()}
    </div>
  `;
}

