import { MENU, INITIAL_STATE, LESSONS, FAQ } from "./dados.js";

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const escapeHtml = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

let state = clone(INITIAL_STATE);
let lessonIndex = -1;
let sceneIndex = 0;
let playing = false;
let token = 0;
let audioEnabled = localStorage.getItem("glamore.training.audio") !== "off";
let utterance = null;
let inventoryPreview = false;
let salePreview = false;
let stockDetailOpen = false;
let auditDocumentOpen = false;
let blockedMessage = "";
let resultMessage = "";

const roleLabels = {
  dono:"Administrador Master",gerente:"Gerente",vendedor:"Vendedor",atendente:"Atendente",entregador:"Entregador"
};

function updateViewport(){
  const vv = window.visualViewport;
  const height = Math.max(320, Math.round(vv?.height || window.innerHeight));
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}
updateViewport();
window.addEventListener("resize", updateViewport);
window.addEventListener("orientationchange", updateViewport);
window.visualViewport?.addEventListener("resize", updateViewport);

function addAudit(action, summary, document, status="concluída"){
  state.audit.unshift({
    action,summary,document,status,
    user:"Vitor Gomes",email:"vtgomes@ts.com",role:roleLabels[$("roleSelect")?.value || "dono"],
    date:"18/07/2026",time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})
  });
}

function totalStockQty(){
  return Math.max(0,state.stockA.qty) + Math.max(0,state.stockB.qty) + Math.max(0,state.production.available);
}
function totalStockWeight(){
  return Math.max(0,state.stockA.weight) + Math.max(0,state.stockB.weight) + Math.max(0,state.production.weightIn-state.production.weightOut);
}

function menuHtml(){
  return MENU.map(item=>`<button data-screen="${item.id}" data-training-id="menu-${item.id}" class="${state.screen===item.id?"active":""}"><span>${item.icon}</span><div><strong>${item.label}</strong><small>${item.sub}</small></div></button>`).join("");
}
function setScreen(screen){
  state.screen=screen;
  $("appMenu").innerHTML=menuHtml();
  renderScreen();
}
function screenHeader(eyebrow,title){
  $("screenEyebrow").textContent=eyebrow;
  $("screenTitle").textContent=title;
}
function kpi(label,value,sub,id=""){
  return `<div class="kpi" ${id?`data-training-id="${id}"`:""}><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
}
function button(label,cls="",id=""){
  return `<button class="btn ${cls}" ${id?`data-training-id="${id}"`:""}>${label}</button>`;
}
function field(label,value,id,type="text",wide=""){
  return `<div class="field ${wide}"><label>${label}</label><input type="${type}" value="${escapeHtml(value)}" data-training-id="${id}"></div>`;
}

function renderDashboard(){
  screenHeader("OPERAÇÃO","Painel");
  return `
    <div data-training-id="screen-dashboard-title"></div>
    <div class="kpis" data-training-id="dashboard-kpis">
      ${kpi("Peças disponíveis",totalStockQty(),"estoque físico")}
      ${kpi("Peso disponível",`${totalStockWeight().toFixed(3)} g`,"razão de peso")}
      ${kpi("Alertas urgentes",state.alert.created&&!state.alert.resolved?1:0,"decisão do gestor")}
      ${kpi("Produção pendente",state.alert.approved&&!state.production.entered?state.alert.approvedQty:0,"não é ordem automática")}
    </div>
    <div class="split">
      <article class="card"><div class="card-head"><div><h2>Resumo do dia</h2><p>Entradas, vendas e pendências.</p></div>${button("Importar PDF","gold","dashboard-import")}</div>
        <div class="mini-stats"><div class="mini-stat"><small>Inventário</small><strong>${state.inventory.entered&&!state.inventory.reversed?"Ativo":"Sem entrada"}</strong></div><div class="mini-stat"><small>Vendas</small><strong>${state.normalSale.active||state.partialSale.active?"Com movimento":"Sem movimento"}</strong></div><div class="mini-stat"><small>Produção</small><strong>${state.production.entered?"Recebida":"Aguardando"}</strong></div></div>
      </article>
      <article class="card"><div class="card-head"><div><h2>Alertas do gestor</h2><p>Faltas sem estoque negativo.</p></div>${button("Abrir","small","dashboard-alerts")}</div>
        ${state.alert.created&&!state.alert.resolved?`<div class="notice warning">Existe uma falta aguardando decisão.</div>`:`<div class="empty">Nenhum alerta pendente.</div>`}
      </article>
    </div>`;
}

function renderImport(){
  screenHeader("IMPORTAÇÃO","Importar PDF");
  const preview = inventoryPreview ? `
    <div class="card" data-training-id="preview-table"><div class="card-head"><div><h2>Prévia do inventário</h2><p>Revise antes de confirmar.</p></div><span class="badge info">2 linhas</span></div>
      <table><thead><tr><th>Código</th><th>Material</th><th>Medida</th><th>Qtd.</th><th>Peso total</th></tr></thead>
      <tbody><tr><td>2740AGL</td><td>Ouro 18K</td><td>18</td><td>3</td><td>2,400 g</td></tr><tr><td>2740AGL</td><td>Ouro 10K</td><td>22</td><td>2</td><td>1,500 g</td></tr></tbody></table>
      <div class="notice warning" data-training-id="weight-rule"><strong>Regra do peso</strong><br>O peso é total da linha. Quantidade e peso são independentes.</div>
    </div>` : salePreview ? `
    <div class="card" data-training-id="sale-preview"><div class="card-head"><div><h2>Prévia da venda</h2><p>Cliente Glamore Gomes · vendedor Danila.</p></div><span class="badge info">Venda inteligente</span></div>
      <table><thead><tr><th>Código</th><th>Material</th><th>Medida</th><th>Solicitada</th><th>Peso referência</th></tr></thead>
      <tbody><tr><td>2740AGL</td><td>Ouro 18K</td><td>18</td><td>2</td><td>1,550 g</td></tr></tbody></table>
    </div>` : `
    <div class="card" data-training-id="partial-preview"><div class="card-head"><div><h2>Exemplo de venda com falta</h2><p>Pedido com dois SKUs.</p></div><span class="badge warning">5 solicitadas</span></div>
      <table><thead><tr><th>SKU</th><th>Solicitada</th><th>Disponível</th><th>Resultado</th></tr></thead><tbody><tr><td>2740AGL · 18</td><td>2</td><td>3</td><td>2 baixadas</td></tr><tr><td>2740AGL · 22</td><td>3</td><td>2</td><td>2 baixadas · 1 faltante</td></tr></tbody></table>
    </div>`;
  return `
    <div class="card"><div class="card-head"><div><h2>Importar documento</h2><p>Inventário, venda, catálogo ou produção pronta.</p></div><span class="badge info">PDF</span></div>
      <div class="grid">
        <div class="field wide"><label>Arquivo PDF</label><input data-training-id="import-file" value="${salePreview?"venda-teste.pdf":"inventario-inicial.pdf"}"></div>
        <div class="field"><label>Tipo de importação</label><select data-training-id="import-type"><option>${salePreview?"Venda inteligente":"Estoque atual / inventário"}</option></select></div>
        <div class="field"><label>Responsável</label><select data-training-id="import-owner"><option>Vitor Gomes · Administrador Master</option></select></div>
        <div class="field full actions">${button("Extrair PDF","dark","extract-button")}${button("Confirmar importação","gold","confirm-import")}</div>
      </div>
    </div>
    ${preview}
    ${state.pdfStatus.pending?`<div class="card"><div class="card-head"><div><h2>Status do PDF pendente</h2><p>A venda já foi estornada; falta apenas corrigir o documento antigo.</p></div>${button("Corrigir status do PDF","danger","fix-pdf-status")}</div>${state.pdfStatus.corrected?`<div class="notice success" data-training-id="fix-status-result">Status corrigido. Nenhuma peça, quantidade, peso, lote ou saldo foi movimentado.</div>`:""}</div>`:""}`;
}

function renderStock(){
  screenHeader("ESTOQUE","Consulta operacional");
  const rows = `
    <tr data-training-id="stock-row-a"><td>2740AGL</td><td>Ouro 18K</td><td>18</td><td>${state.stockA.qty}</td><td>${state.stockA.weight.toFixed(3)} g</td><td>INV-A</td><td>${button("Ver detalhes","small","stock-open-a")}</td></tr>
    <tr><td>2740AGL</td><td>Ouro 10K</td><td>22</td><td>${state.stockB.qty}</td><td>${state.stockB.weight.toFixed(3)} g</td><td>INV-B</td><td>${button("Ver detalhes","small")}</td></tr>
    ${state.production.entered?`<tr data-training-id="production-stock-result"><td>2740AGL</td><td>Ouro 18K</td><td>17</td><td>${state.production.available}</td><td>${Math.max(0,state.production.weightIn-state.production.weightOut).toFixed(3)} g</td><td>PROD-20</td><td>${button("Ver detalhes","small")}</td></tr>`:""}`;
  return `
    <div class="kpis" data-training-id="stock-kpis">${kpi("Peças disponíveis",totalStockQty(),"todas as origens")}${kpi("Peso disponível",`${totalStockWeight().toFixed(3)} g`,"controle independente")}${kpi("Entradas",state.inventory.entered?1:0,"inventários ativos")}${kpi("Baixas",state.normalSale.active||state.partialSale.active?1:0,"vendas ativas")}</div>
    <details class="card" open data-training-id="manual-entry-summary"><summary><strong>Entrada manual rápida no estoque</strong></summary>
      <div class="grid" style="margin-top:12px">
        ${field("Código","2740AGL","manual-code")}
        ${field("Material","Ouro 18K","manual-material")}
        ${field("Medida","16","manual-measure")}
        ${field("Quantidade","2","manual-qty","number")}
        ${field("Peso total","1.480","manual-weight","text")}
        ${field("Lote","MANUAL-TESTE","manual-lot")}
        <div class="field full">${button("Confirmar entrada manual","gold","manual-save")}</div>
      </div>
    </details>
    <div class="card"><div class="card-head"><div><h2>Estoque físico</h2><p>Peças, peso, lote e rastreabilidade.</p></div>${button("Estornar inventário","danger small","inventory-reverse-button")}</div>
      ${blockedMessage?`<div class="notice danger" data-training-id="blocked-message">${escapeHtml(blockedMessage)}</div>`:""}
      <table><thead><tr><th>Código</th><th>Material</th><th>Medida</th><th>Qtd.</th><th>Peso</th><th>Lote</th><th>Ação</th></tr></thead><tbody>${rows}</tbody></table>
      ${stockDetailOpen?`<div class="document-card" data-training-id="stock-detail"><header><div><strong>Entrada do item 2740AGL · Nº 18</strong><small>Inventário inicial</small></div><span class="badge success">Disponível</span></header><div class="mini-stats"><div class="mini-stat"><small>Usuário</small><strong>Vitor Gomes</strong></div><div class="mini-stat"><small>Data e hora</small><strong>18/07/2026 · 10:15</strong></div><div class="mini-stat"><small>Cargo</small><strong>Administrador Master</strong></div></div>${button("Abrir documento original","dark small")}</div>`:""}
      ${state.normalSale.active?`<div class="document-card" data-training-id="stock-movement-sale"><header><div><strong>Baixa de venda</strong><small>Pedido 26783</small></div><span class="badge warning">Saída</span></header><div class="mini-stats"><div class="mini-stat"><small>Quantidade</small><strong>${state.normalSale.qty}</strong></div><div class="mini-stat"><small>Peso debitado</small><strong>${state.normalSale.weight.toFixed(3)} g</strong></div><div class="mini-stat"><small>Responsável</small><strong>Vitor Gomes · Administrador Master</strong></div></div></div>`:""}
      ${state.normalSale.reversed?`<div class="notice success" data-training-id="returned-stock">Venda estornada: peças e peso devolvidos ao estoque.</div>`:""}
      ${state.inventory.reversed?`<div class="notice success" data-training-id="inventory-zero">Inventário estornado: 5 de 5 peças removidas; peso do inventário zerado.</div>`:""}
    </div>`;
}

function renderSales(){
  screenHeader("VENDAS","Pedidos e baixas");
  return `
    <div class="kpis">${kpi("Vendas ativas",(state.normalSale.active&&!state.normalSale.reversed?1:0)+(state.partialSale.active&&!state.partialSale.reversed?1:0)+(state.production.sold>0?1:0),"histórico operacional")}${kpi("Peças baixadas",(state.normalSale.reversed?0:state.normalSale.qty)+(state.partialSale.reversed?0:state.partialSale.sold)+state.production.sold,"saída física")}${kpi("Faltas",state.partialSale.missing+(state.alert.created&&!state.production.entered?10:0),"aguardando solução")}${kpi("Estornos",(state.normalSale.reversed?1:0)+(state.partialSale.reversed?1:0),"preservados no histórico")}</div>
    <div class="card"><div class="card-head"><div><h2>Histórico de vendas</h2><p>Cliente, vendedor, quantidade, status e ações.</p></div></div>
      ${state.normalSale.active?`<div class="document-card" data-training-id="normal-sale-card"><header><div><strong>Pedido 26783 · Glamore Gomes</strong><small>Vendedor Danila</small></div><span class="badge ${state.normalSale.reversed?"danger":"success"}">${state.normalSale.reversed?"Estornada":"Finalizada"}</span></header><div class="mini-stats"><div class="mini-stat"><small>Quantidade</small><strong>${state.normalSale.qty}</strong></div><div class="mini-stat"><small>Peso</small><strong>${state.normalSale.weight.toFixed(3)} g</strong></div><div class="mini-stat"><small>Responsável</small><strong>Vitor Gomes</strong></div></div>${button("Estornar venda","danger small","reverse-sale-button")}<div class="notice warning" data-training-id="reverse-reason">O estorno exige justificativa e confirmação.</div></div>`:""}
      ${state.partialSale.active?`<div class="document-card" data-training-id="partial-sale-card"><header><div><strong>Pedido parcial 26784</strong><small>Dois SKUs</small></div><span class="badge warning" data-training-id="partial-status">Parcial</span></header><div class="mini-stats"><div class="mini-stat"><small>Solicitada</small><strong>${state.partialSale.requested}</strong></div><div class="mini-stat"><small>Baixada</small><strong>${state.partialSale.sold}</strong></div><div class="mini-stat"><small>Faltante</small><strong>${state.partialSale.missing}</strong></div></div></div>`:""}
      <div class="document-card" data-training-id="production-sale-pending"><header><div><strong>Pedido de produção · 10 peças</strong><small>2740AGL · Nº 17</small></div><span class="badge ${state.production.sold===10?"success":"warning"}">${state.production.sold===10?"Finalizada":"Pendente"}</span></header><div class="mini-stats"><div class="mini-stat"><small>Pedido</small><strong>10</strong></div><div class="mini-stat"><small>Baixado</small><strong>${state.production.sold}</strong></div><div class="mini-stat"><small>Pendente</small><strong>${10-state.production.sold}</strong></div></div>${state.production.sold===10?`<div data-training-id="production-sale-final" class="notice success">Venda atendida pela produção pronta.</div>`:""}${button("Estornar venda da produção","danger small","reverse-production-sale")}</div>
    </div>`;
}

function renderAlerts(){
  screenHeader("ALERTAS","Decisões do gestor");
  return `
    <div class="kpis">${kpi("Alertas ativos",state.alert.created&&!state.alert.resolved?1:0,"aguardando decisão")}${kpi("Produção aprovada",state.alert.approved?state.alert.approvedQty:0,"quantidade autorizada")}${kpi("Recebido",state.production.entered?state.production.qty:0,"produção pronta")}${kpi("Excedente",state.production.available,"estoque disponível")}</div>
    <div class="card" data-training-id="alert-card"><div class="card-head"><div><h2>Falta de venda</h2><p>2740AGL · quantidade faltante.</p></div><span class="badge warning">${state.alert.approved?"Produção aprovada":"Aguardando decisão"}</span></div>
      <div class="mini-stats"><div class="mini-stat"><small>Faltante</small><strong>${state.alert.approvedQty===20?10:state.partialSale.missing||1}</strong></div><div class="mini-stat"><small>Aprovado</small><strong>${state.alert.approvedQty}</strong></div><div class="mini-stat"><small>Status</small><strong>${state.alert.resolved?"Resolvido":"Aberto"}</strong></div></div>
      <div class="actions" data-training-id="alert-decisions">${button("Aprovar produção","gold","approve-production")}${button("Produzir 20","gold","approve-20")}${button("Comprar","")}${button("Ajustar","")}${button("Cancelar","danger")}</div>
      ${state.alert.approved?`<div class="notice warning" data-training-id="approved-not-order">Produção aprovada não é ordem automática e não cria estoque.</div>`:""}
    </div>
    <div class="card" data-training-id="production-alert"><h2>Exemplo completo</h2><p>Venda de 10 peças sem estoque. O gestor autoriza produzir 20.</p></div>`;
}

function renderProduction(){
  screenHeader("PRODUÇÃO","Entrada manual e fila de produção");
  return `
    <div class="card"><div class="card-head"><div><h2>Dar entrada e reconciliar</h2><p>Use somente quando as peças estiverem realmente prontas.</p></div><span class="badge info">Produção pronta</span></div>
      <div class="grid">
        ${field("Código","2740AGL","prod-code")}
        ${field("Material","Ouro 18K","prod-material")}
        ${field("Medida","17","prod-measure")}
        ${field("Quantidade produzida","20","prod-qty","number")}
        ${field("Peso total","16,400","prod-weight")}
        ${field("Lote","PROD-20","prod-lot")}
        <div class="field full actions">${button("Dar entrada e reconciliar","gold","prod-submit")}${button("Estornar entrada","danger","production-reverse-button")}</div>
      </div>
      ${blockedMessage?`<div class="notice danger" data-training-id="blocked-message">${escapeHtml(blockedMessage)}</div>`:""}
    </div>
    <div class="card"><div class="card-head"><div><h2>Histórico de produção</h2><p>Entradas, peso, lotes e atendimento de vendas.</p></div></div>
      <table><thead><tr><th>Data</th><th>Código</th><th>Qtd.</th><th>Peso</th><th>Lote</th><th>Status</th></tr></thead>
      <tbody><tr><td>18/07/2026</td><td>2740AGL · 17</td><td>${state.production.qty}</td><td>${state.production.weightIn.toFixed(3)} g</td><td>PROD-20</td><td>${state.production.reversed?`<span class="badge danger">Estornada</span>`:state.production.entered?`<span class="badge success">Pronta</span>`:`<span class="badge warning">Aguardando</span>`}</td></tr></tbody></table>
      ${state.production.entered&&!state.production.reversed?`<div class="notice success" data-training-id="production-result">20 recebidas · 10 aplicadas à venda · 10 disponíveis no estoque.</div>`:""}
      ${state.production.reversed?`<div class="notice success" data-training-id="production-zero">Produção estornada: 20 peças, lote e peso zerados.</div>`:""}
    </div>`;
}

function renderJewels(){
  screenHeader("JOIAS","Catálogo técnico");
  return `<div class="card"><div class="card-head"><div><h2>Consulta de joias</h2><p>Cadastro técnico, imagem e realidade aumentada.</p></div>${button("Nova joia","gold")}</div>
    <div class="grid"><div class="field wide"><label>Pesquisar por código ou descrição</label><input data-training-id="jewel-search" value="2740AGL"></div><div class="field">${button("Pesquisar","dark")}</div></div>
    <div class="document-card"><header><div><strong>2740AGL · Anel solitário</strong><small>Ouro 18K · medidas 15 a 22</small></div><span class="badge info">Catálogo</span></header><div class="notice warning" data-training-id="catalog-rule">Catálogo técnico não cria peça física no estoque.</div><div class="actions">${button("Editar","")}${button("Realidade aumentada","gold","ar-button")}</div></div></div>`;
}
function renderClients(){
  screenHeader("CLIENTES","Carteira");
  return `<div class="card"><div class="card-head"><div><h2>Clientes</h2><p>Cadastro e histórico comercial.</p></div>${button("Novo cliente","gold")}</div><div class="grid"><div class="field wide"><label>Pesquisar</label><input data-training-id="client-search" value="Glamore Gomes"></div><div class="field">${button("Buscar","dark")}</div></div>
    <div class="document-card" data-training-id="client-card"><header><div><strong>Glamore Gomes Ind. e Com. Ltda.</strong><small>Cliente ativo</small></div><span class="badge success">Ativo</span></header><div class="mini-stats"><div class="mini-stat"><small>Documento</small><strong>90</strong></div><div class="mini-stat"><small>Vendedor</small><strong>Danila</strong></div><div class="mini-stat"><small>Pedidos</small><strong>3</strong></div></div>${button("Abrir histórico","dark small")}</div></div>`;
}

function renderReports(){
  screenHeader("RELATÓRIOS","Resumo e PDF");
  return `<div class="kpis">${kpi("Peças disponíveis",totalStockQty(),"estoque")}${kpi("Peso disponível",`${totalStockWeight().toFixed(3)} g`,"razão")}${kpi("Vendas ativas",(state.normalSale.active&&!state.normalSale.reversed?1:0)+(state.partialSale.active&&!state.partialSale.reversed?1:0)+(state.production.sold?1:0),"não inclui estornadas")}${kpi("Alertas",state.alert.created&&!state.alert.resolved?1:0,"pendentes")}</div>
    <div class="card"><div class="card-head"><div><h2>Gerar relatórios</h2><p>Tela, PDF e impressão.</p></div></div>
      <div class="grid"><div class="field"><label>Modo</label><select data-training-id="report-mode"><option>Resumo</option><option>Detalhado</option></select></div><div class="field"><label>Período</label><select><option>Todo o período</option></select></div><div class="field full actions">${button("Relatório de estoque","gold","stock-report-button")}${button("Relatório de vendas","gold","sales-report-button")}${button("Exportar backup","dark","backup-button")}</div></div>
      <div class="notice">Vendas estornadas não aparecem no relatório de vendas ativas. Elas permanecem no histórico e na Auditoria.</div>
    </div>`;
}

function renderAudit(){
  screenHeader("AUDITORIA","Quem fez, quando e por quê");
  const defaults = [
    {action:"importacao_confirmada",summary:"Inventário inicial confirmado.",document:"INV-26762",status:"concluída",user:"Vitor Gomes",email:"vtgomes@ts.com",role:"Administrador Master",date:"18/07/2026",time:"10:15"},
    {action:"movimento_estoque",summary:"Baixa de venda por peça física.",document:"VENDA-26783",status:"concluída",user:"Vitor Gomes",email:"vtgomes@ts.com",role:"Administrador Master",date:"18/07/2026",time:"10:40"}
  ];
  const rows=[...state.audit,...defaults];
  return `<div class="card"><div class="card-head"><div><h2>Consultar Auditoria</h2><p>Pedido, usuário, ação, coleção ou justificativa.</p></div>${button("Exportar JSON","dark")}</div><div class="grid"><div class="field wide"><label>Busca geral</label><input data-training-id="audit-search" value="26783"></div><div class="field">${button("Pesquisar","gold")}</div></div></div>
    <div class="card" data-training-id="audit-user-fields">${rows.map((row,i)=>`<div class="audit-row" ${i===0?`data-training-id="audit-reversals"`:""}><div><small>${row.date} · ${row.time}</small><strong>${escapeHtml(row.action)}</strong></div><div><strong>${escapeHtml(row.summary)}</strong><small>${row.user} · ${row.email} · ${row.role}<br>Documento: ${row.document}</small></div><div>${button("Abrir documento","small","audit-open-document")}</div></div>`).join("")}
      ${state.normalSale.active?`<div data-training-id="audit-sale"></div>`:""}${state.production.entered?`<div data-training-id="audit-production"></div>`:""}
      ${auditDocumentOpen?`<div class="document-card" data-training-id="audit-document-card"><header><div><strong>Documento relacionado</strong><small>Abriu na tela atual</small></div><span class="badge info">VENDA-26783</span></header><p>Cliente Glamore Gomes · vendedor Danila · baixa de ${state.normalSale.qty||2} peça(s).</p></div>`:""}
    </div>`;
}

function renderRules(){
  screenHeader("REGRAS","Parâmetros e colaboradores");
  return `<div class="card" data-training-id="roles-card"><div class="card-head"><div><h2>Perfis de acesso</h2><p>Permissões conforme a função.</p></div></div>
    <div class="document-card"><strong>Administrador Master</strong><p>Acesso administrativo completo ao sistema, regras, colaboradores e operação.</p></div>
    <div class="document-card" data-training-id="manager-role"><strong>Gerente</strong><p>Administração da operação, colaboradores, relatórios e regras.</p></div>
    <div class="document-card" data-training-id="seller-role"><strong>Vendedor</strong><p>Joias, clientes, vendas, consignações e relatórios comerciais.</p></div>
    <div class="document-card" data-training-id="attendant-role"><strong>Atendente</strong><p>Atendimento, clientes, vendas e consignações.</p></div>
    <div class="document-card" data-training-id="delivery-role"><strong>Entregador</strong><p>Consulta operacional e acompanhamento de entregas ou consignações.</p></div>
  </div>
  <div class="card" data-training-id="user-form"><div class="card-head"><div><h2>Cadastrar colaborador</h2><p>Nome, e-mail, função, cargo e situação.</p></div></div><div class="grid">${field("Nome","Marina Souza","user-name")}${field("E-mail","marina@empresa.com","user-email","email")}<div class="field"><label>Função</label><select><option>Vendedor</option></select></div>${field("Cargo interno","Vendedor balcão","user-cargo")}<div class="field"><label>Ativo</label><select><option>Sim</option></select></div></div><div class="notice warning" data-training-id="owner-restriction">Somente o Administrador Master atual pode cadastrar outro Administrador Master.</div></div>`;
}

function renderScreen(){
  $("appMenu").innerHTML=menuHtml();
  const renderers={dashboard:renderDashboard,importacao:renderImport,estoque:renderStock,vendas:renderSales,alertas:renderAlerts,producao:renderProduction,joias:renderJewels,clientes:renderClients,relatorios:renderReports,auditoria:renderAudit,regras:renderRules};
  $("screenContent").innerHTML=(renderers[state.screen]||renderDashboard)();
  bindScreenInteractions();
}
function bindScreenInteractions(){
  document.querySelectorAll("[data-screen]").forEach(btn=>btn.onclick=()=>setScreen(btn.dataset.screen));
  $("mobileMenuButton").onclick=()=>$("systemWindow").classList.toggle("menu-open");
  const openA=document.querySelector('[data-training-id="stock-open-a"]');if(openA)openA.onclick=()=>{stockDetailOpen=true;renderScreen()};
}

function resetAll(){
  state=clone(INITIAL_STATE);inventoryPreview=false;salePreview=false;stockDetailOpen=false;auditDocumentOpen=false;blockedMessage="";resultMessage="";
}
function resetProduction(){
  state.alert={created:true,approved:false,approvedQty:0,resolved:false};
  state.production={entered:false,reversed:false,qty:0,weightIn:0,weightOut:0,available:0,sold:0};
}
function action(name){
  switch(name){
    case "showInventoryPreview": inventoryPreview=true;salePreview=false;break;
    case "confirmInventory":
      state.inventory.entered=true;state.inventory.reversed=false;state.stockA={...state.stockA,qty:3,weight:2.4};state.stockB={...state.stockB,qty:2,weight:1.5};
      addAudit("importacao_confirmada","Inventário inicial com 5 peças e 3,900 g.","INV-26762");state.screen="estoque";break;
    case "openStockA": stockDetailOpen=true;break;
    case "manualEntryDemo": addAudit("entrada_manual","Entrada manual de 2 peças e 1,480 g.","MANUAL-TESTE");showResult("Entrada manual registrada",[{label:"Quantidade",value:"2 peças"},{label:"Peso total",value:"1,480 g"},{label:"Lote",value:"MANUAL-TESTE"}]);break;
    case "showSalePreview": salePreview=true;inventoryPreview=false;break;
    case "confirmNormalSale":
      state.normalSale={active:true,reversed:false,qty:2,weight:1.55};state.stockA.qty=1;state.stockA.weight=.85;addAudit("venda_fechada","Venda de 2 peças confirmada.","VENDA-26783");state.screen="vendas";break;
    case "confirmPartialSale":
      state.inventory.entered=true;state.stockA={...state.stockA,qty:1,weight:.85};state.stockB={...state.stockB,qty:0,weight:.1};state.partialSale={active:true,reversed:false,requested:5,sold:4,missing:1};state.alert={created:true,approved:false,approvedQty:0,resolved:false};addAudit("venda_parcial","4 peças baixadas e 1 faltante.","VENDA-26784");state.screen="vendas";break;
    case "approveOneProduction": state.alert.created=true;state.alert.approved=true;state.alert.approvedQty=1;addAudit("alerta_aprovado","Produção de 1 peça aprovada.","ALERTA-1");break;
    case "approveTwenty": state.alert={created:true,approved:true,approvedQty:20,resolved:false};addAudit("alerta_aprovado","Produção total de 20 peças aprovada para venda pendente de 10.","ALERTA-20");break;
    case "receiveTwenty":
      state.production={entered:true,reversed:false,qty:20,weightIn:16.4,weightOut:8.2,available:10,sold:10};state.alert={created:true,approved:true,approvedQty:20,resolved:true};addAudit("producao_pronta","20 recebidas; 10 aplicadas à venda; 10 no estoque.","PROD-20");state.screen="producao";break;
    case "openAuditDocument": auditDocumentOpen=true;break;
    case "tryInventoryReverseBlocked": blockedMessage="Este inventário possui peças vinculadas a saída. Estorne primeiro as vendas ou consignações vinculadas.";break;
    case "reverseSale":
      state.normalSale.active=true;state.normalSale.reversed=true;state.stockA.qty+=state.normalSale.qty;state.stockA.weight+=state.normalSale.weight;state.pdfStatus.pending=true;addAudit("estorno_venda","Venda estornada; peças e peso devolvidos.","VENDA-26783","concluída");blockedMessage="";break;
    case "reverseInventory":
      state.inventory.reversed=true;state.inventory.status="estornada";state.stockA.qty=0;state.stockA.weight=0;state.stockB.qty=0;state.stockB.weight=0;addAudit("estorno_inventario","5 de 5 peças e 3,900 g removidos.","INV-26762");blockedMessage="";break;
    case "fixPdfStatus": state.pdfStatus.pending=true;state.pdfStatus.corrected=true;addAudit("status_pdf_corrigido","Status do PDF corrigido sem movimentar estoque.","PDF-26783");break;
    case "tryProductionReverseBlocked": blockedMessage="Existem 10 peças vendidas ligadas a esta produção. Estorne primeiro a venda vinculada.";break;
    case "reverseProductionSale": state.production.available=20;state.production.sold=0;state.production.weightOut=0;addAudit("estorno_venda_producao","Venda atendida pela produção foi estornada.","VENDA-PROD-10");blockedMessage="";break;
    case "reverseProduction": state.production.reversed=true;state.production.entered=true;state.production.qty=20;state.production.available=0;state.production.sold=0;state.production.weightIn=0;state.production.weightOut=0;addAudit("estorno_producao","20 peças, lote e peso da produção foram zerados.","PROD-20");blockedMessage="";break;
  }
  renderScreen();
}

function currentLesson(){return LESSONS[lessonIndex]}
function currentScene(){return currentLesson()?.scenes[sceneIndex]}
function selectLesson(index){
  stop(false);lessonIndex=index;sceneIndex=0;
  const lesson=currentLesson();
  if(lesson.reset)resetAll();
  if(lesson.resetProduction)resetProduction();
  $("lessonDialog").close();
  updateLessonUi();
  presentScene(false);
}
function updateLessonUi(){
  const lesson=currentLesson();
  if(!lesson)return;
  $("lessonChapter").textContent=lesson.chapter;
  $("lessonTitle").textContent=lesson.title;
  $("lessonPosition").textContent=`${lessonIndex+1} de ${LESSONS.length}`;
  $("scenePosition").textContent=`Passo ${sceneIndex+1} de ${lesson.scenes.length}`;
  $("stepNumber").textContent=sceneIndex+1;
  $("practicalNote").innerHTML=`<strong>Objetivo</strong><p>${escapeHtml(lesson.objective)}</p>`;
  const percent=((sceneIndex)/Math.max(1,lesson.scenes.length))*100;
  $("lessonProgressBar").style.width=`${percent}%`;
}

function clearFocus(){
  $("focusMask").classList.remove("active");$("focusRing").classList.remove("active");$("focusLabel").classList.remove("active");$("pointer").classList.remove("active");
}
async function locateAndFocus(id,label){
  clearFocus();
  const deadline=Date.now()+2500;
  let el=null;
  while(Date.now()<deadline){
    el=document.querySelector(`[data-training-id="${CSS.escape(id)}"]`);
    if(el)break;
    await new Promise(r=>setTimeout(r,60));
  }
  if(!el)throw new Error(`Elemento de treinamento não encontrado: ${id}`);
  el.scrollIntoView({block:"center",inline:"center",behavior:"auto"});
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const root=$("systemWindow").getBoundingClientRect(),rect=el.getBoundingClientRect();
  const pad=7,left=rect.left-root.left-pad,top=rect.top-root.top-pad,width=rect.width+pad*2,height=rect.height+pad*2;
  $("focusRing").style.cssText+=`;left:${left}px;top:${top}px;width:${width}px;height:${height}px`;
  $("focusLabel").textContent=label;
  $("focusLabel").style.left=`${Math.max(8,Math.min(left,root.width-330))}px`;
  $("focusLabel").style.top=`${Math.max(8,top>40?top-33:top+height+6)}px`;
  $("pointer").style.left=`${Math.max(5,Math.min(root.width-30,left+Math.min(width*.65,width-15)))}px`;
  $("pointer").style.top=`${Math.max(5,Math.min(root.height-30,top+Math.min(height*.55,height-15)))}px`;
  $("focusMask").classList.add("active");$("focusRing").classList.add("active");$("focusLabel").classList.add("active");$("pointer").classList.add("active");
  return el;
}
async function clickVisual(){
  const p=$("pointer").getBoundingClientRect(),r=$("systemWindow").getBoundingClientRect();
  $("clickEffect").style.left=`${p.left-r.left+5}px`;$("clickEffect").style.top=`${p.top-r.top+5}px`;
  $("clickEffect").classList.remove("active");void $("clickEffect").offsetWidth;$("clickEffect").classList.add("active");
  await new Promise(r=>setTimeout(r,350));
}

function speechDuration(text){return Math.max(2300,text.split(/\s+/).length/(2.65*Number($("speedSelect").value||1))*1000)}
function speak(text,myToken){
  $("speechProgress").style.width="0%";
  if(!audioEnabled||!("speechSynthesis"in window)){
    return new Promise(resolve=>{const duration=speechDuration(text),start=performance.now();const tick=()=>{if(myToken!==token||!playing)return resolve(false);const pct=Math.min(100,(performance.now()-start)/duration*100);$("speechProgress").style.width=`${pct}%`;if(pct>=100)return resolve(true);requestAnimationFrame(tick)};tick()});
  }
  return new Promise(resolve=>{
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);utterance=u;u.lang="pt-BR";u.rate=Number($("speedSelect").value||1);u.pitch=1;
    const finish=()=>{clearTimeout(timer);$("speechProgress").style.width="100%";resolve(myToken===token&&playing)};
    u.onboundary=e=>{$("speechProgress").style.width=`${Math.min(98,(e.charIndex||0)/Math.max(1,text.length)*100)}%`};u.onend=finish;u.onerror=finish;
    const timer=setTimeout(finish,Math.max(14000,speechDuration(text)*2.5));speechSynthesis.speak(u);
  });
}

async function presentScene(narrate=true){
  const lesson=currentLesson(),scene=currentScene();if(!scene)return;
  updateLessonUi();
  setScreen(scene.screen);
  $("instructionText").textContent="Abrindo a função...";
  $("systemStatus").textContent=`Mostrando: ${scene.text.slice(0,55)}${scene.text.length>55?"…":""}`;
  try{
    const el=await locateAndFocus(scene.target,scene.text);
    if(scene.click)await clickVisual();
    if(scene.action)action(scene.action);
    if(scene.action){setScreen(scene.screen);await locateAndFocus(scene.target,scene.text).catch(()=>{});}
    $("instructionText").textContent=scene.text;
    if(narrate)return await speak(scene.text,token);
    return true;
  }catch(error){
    stop(false);
    $("instructionText").textContent=`A aula encontrou um erro interno: ${error.message}`;
    $("systemStatus").textContent="Aula pausada";
    return false;
  }
}

async function play(){
  if(lessonIndex<0){$("lessonDialog").showModal();return}
  playing=true;const myToken=++token;$("playButton").textContent="Ⅱ Pausar";
  while(playing&&myToken===token){
    const ok=await presentScene(true);if(!ok||!playing||myToken!==token)return;
    await new Promise(r=>setTimeout(r,400));
    const lesson=currentLesson();
    if(sceneIndex<lesson.scenes.length-1){sceneIndex++;updateLessonUi();continue}
    if(lessonIndex<LESSONS.length-1){lessonIndex++;sceneIndex=0;const next=currentLesson();if(next.reset)resetAll();if(next.resetProduction)resetProduction();updateLessonUi();continue}
    stop(false);$("instructionText").textContent="Treinamento concluído. Use Aulas para rever uma função específica.";return;
  }
}
function stop(show=true){playing=false;token++;speechSynthesis?.cancel();$("playButton").textContent="▶ Continuar";if(show)$("systemStatus").textContent="Aula pausada"}
async function goScene(delta){stop(false);const lesson=currentLesson();if(!lesson)return;sceneIndex=Math.max(0,Math.min(lesson.scenes.length-1,sceneIndex+delta));await presentScene(false)}
async function goLesson(delta){stop(false);if(lessonIndex<0)return;lessonIndex=Math.max(0,Math.min(LESSONS.length-1,lessonIndex+delta));sceneIndex=0;const lesson=currentLesson();if(lesson.reset)resetAll();if(lesson.resetProduction)resetProduction();await presentScene(false)}

function renderLessons(){
  $("lessonGrid").innerHTML=LESSONS.map((lesson,i)=>`<button class="lesson-card" data-lesson="${i}"><span>${lesson.icon}</span><strong>${escapeHtml(lesson.title)}</strong><p>${escapeHtml(lesson.description)}</p><small>${lesson.scenes.length} passos</small></button>`).join("");
  document.querySelectorAll("[data-lesson]").forEach(btn=>btn.onclick=()=>selectLesson(Number(btn.dataset.lesson)));
}
function bestFaq(question){
  const q=normalize(question);
  const scored=FAQ.map(item=>({item,score:item.keywords.reduce((score,key)=>score+(q.includes(normalize(key))?5:0),0)+(q.includes(normalize(item.question))?10:0)})).sort((a,b)=>b.score-a.score);
  if(scored[0]?.score>0)return scored[0].item;
  return null;
}
function answer(question){
  const messages=$("messages");
  messages.insertAdjacentHTML("beforeend",`<div class="message user">${escapeHtml(question)}</div>`);
  const faq=bestFaq(question);
  if(faq)messages.insertAdjacentHTML("beforeend",`<div class="message answer"><strong>${escapeHtml(faq.question)}</strong><br>${escapeHtml(faq.answer)}</div>`);
  else messages.insertAdjacentHTML("beforeend",`<div class="message answer"><strong>Não encontrei uma resposta verificada para essa formulação.</strong><br>Escolha uma das perguntas prontas acima ou escreva o nome exato da função, como “estorno de inventário”, “produção aprovada” ou “peso total”.</div>`);
  messages.scrollTop=messages.scrollHeight;
}
function renderQuestions(){
  $("questionChips").innerHTML=FAQ.map(item=>`<button data-faq="${item.id}">${escapeHtml(item.question)}</button>`).join("");
  document.querySelectorAll("[data-faq]").forEach(btn=>btn.onclick=()=>{const faq=FAQ.find(x=>x.id===btn.dataset.faq);answer(faq.question)});
}
function showResult(title,items){
  $("resultTitle").textContent=title;$("resultBody").innerHTML=`<div class="result-grid">${items.map(item=>`<div class="result-box"><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.value)}</strong></div>`).join("")}</div>`;
  $("resultDialog").showModal();
}

$("lessonsButton").onclick=()=>$("lessonDialog").showModal();
$("questionsButton").onclick=()=>$("questionDialog").showModal();
$("audioButton").onclick=()=>{audioEnabled=!audioEnabled;localStorage.setItem("glamore.training.audio",audioEnabled?"on":"off");$("audioButton").setAttribute("aria-pressed",String(audioEnabled));$("audioButton").innerHTML=`${audioEnabled?"🔊":"🔇"} <span>Áudio</span>`;if(!audioEnabled)speechSynthesis?.cancel()};
$("fullscreenButton").onclick=async()=>{if(!document.fullscreenElement)await $("trainingApp").requestFullscreen?.();else await document.exitFullscreen?.()};
$("playButton").onclick=()=>playing?stop():play();
$("previousSceneButton").onclick=()=>goScene(-1);$("nextSceneButton").onclick=()=>goScene(1);$("repeatButton").onclick=()=>{stop(false);presentScene(true)};$("previousLessonButton").onclick=()=>goLesson(-1);$("nextLessonButton").onclick=()=>goLesson(1);
$("questionForm").onsubmit=e=>{e.preventDefault();const q=$("questionInput").value.trim();if(q){$("questionInput").value="";answer(q)}};
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>btn.closest("dialog").close());
$("roleSelect").onchange=()=>{document.querySelector(".profile-card small").textContent=roleLabels[$("roleSelect").value]};
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll("dialog[open]").forEach(d=>d.close())});

renderLessons();renderQuestions();renderScreen();
$("lessonDialog").showModal();

window.__GLAMORE_TRAINING_SELFTEST__ = async function(){
  const results=[];
  for(let li=0;li<LESSONS.length;li++){
    const lesson=LESSONS[li];
    resetAll();if(lesson.resetProduction)resetProduction();
    for(let si=0;si<lesson.scenes.length;si++){
      const scene=lesson.scenes[si];setScreen(scene.screen);
      const exists=Boolean(document.querySelector(`[data-training-id="${CSS.escape(scene.target)}"]`));
      results.push({lesson:lesson.id,scene:si+1,target:scene.target,exists});
      if(scene.action)action(scene.action);
    }
  }
  const missing=results.filter(r=>!r.exists);
  return {lessons:LESSONS.length,scenes:results.length,missing,ok:missing.length===0};
};

if(new URLSearchParams(location.search).get("selftest")==="1"){
  window.addEventListener("load",async()=>{
    const result=await window.__GLAMORE_TRAINING_SELFTEST__();
    document.body.innerHTML=`<pre id="selftest">${escapeHtml(JSON.stringify(result,null,2))}</pre>`;
  });
}