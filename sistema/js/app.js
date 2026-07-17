import { APP_CONFIG } from "./config.js";
import { FirebaseClient as DB } from "./firebaseClient.js";
import { uploadImage } from "./cloudinary.js";
import { extractPdf } from "./pdf-importer.js";
import { assistantAnswer, renderAssistantRows } from "./assistant.js";
import { buildInventoryReport, buildSalesReport, criticalProducts, stoppedProducts } from "./reports.js";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatNumber,
  inferMaterial,
  inferMedida,
  inferTipo,
  nowIso,
  objectToArray,
  productIdFrom,
  sum,
  uid
} from "./utils.js";

window.__JOIAS_BUILD_VERSION__ = "v67-estorno-producao-id-valido-auditoria-segura-20260716";
window.__JOIAS_APP_VERSION__ = "v67-estorno-producao-id-valido-auditoria-segura-20260716";
// Linhagem preservada para auditorias e testes regressivos das funções mantidas.
const JOIAS_BUILD_LINEAGE = "v67-estorno-producao-id-valido-auditoria-segura-20260716 | v66-correcao-status-pdf-e-estorno-producao-20260715 | v65-rastreabilidade-cabecalho-producao-baixa-excedente-20260715 | v64-alerta-producao-aprovada-atende-venda-excedente-estoque-20260715 | v63-correcao-estorno-parcial-inventario-zero-20260714 | v62-correcao-producao-peso-relatorios-sem-duplicidade-20260714 | v60-estorno-pdf-multiitem-atomico-reconciliavel | v59-hotfix-estorno-pdf-peso-estoque-ledger | v58-hotfix-link-auditoria | v57-estorno-justificado-auditoria-visivel";
const app = document.getElementById("app");

const state = {
  user: null,
  data: null,
  parsedImport: null,
  editingProductId: "",
  editingUserId: "",
  saleCart: []
};

const IMPORT_PROGRESS_STEPS = [
  { key: "preparacao", label: "Preparação" },
  { key: "fotos", label: "Fotos e arquivos" },
  { key: "documento", label: "Documento" },
  { key: "itens", label: "Itens e estoque" },
  { key: "auditoria", label: "Auditoria" },
  { key: "conclusao", label: "Conclusão" }
];

let importProgressRuntime = {
  active: false,
  startedAt: 0,
  totalItems: 0,
  currentStep: "preparacao",
  lastPercent: 0
};

function percentClamp(value = 0) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function showImportProgress({ title = "Importação em andamento", subtitle = "Acompanhe o processamento do PDF.", totalItems = 0, tipoImportacao = "" } = {}) {
  const old = document.getElementById("importProgressOverlay");
  if (old) old.remove();

  importProgressRuntime = {
    active: true,
    startedAt: Date.now(),
    totalItems: Number(totalItems || 0),
    currentStep: "preparacao",
    lastPercent: 0
  };

  const overlay = document.createElement("div");
  overlay.id = "importProgressOverlay";
  overlay.className = "import-progress-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="import-progress-modal">
      <div class="import-progress-topline"></div>
      <div class="import-progress-header">
        <div>
          <span class="import-progress-eyebrow">Processamento do PDF</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="import-progress-percent" id="importProgressPercent">0%</div>
      </div>

      <div class="import-progress-bar" aria-hidden="true">
        <span id="importProgressBar"></span>
      </div>

      <div class="import-progress-status-card">
        <strong id="importProgressStatus">Preparando importação...</strong>
        <span id="importProgressDetail">Mantenha esta aba aberta até a conclusão.</span>
      </div>

      <ol class="import-progress-steps" id="importProgressSteps">
        ${IMPORT_PROGRESS_STEPS.map((step) => `
          <li data-step="${escapeHtml(step.key)}">
            <span class="step-dot"></span>
            <span>${escapeHtml(step.label)}</span>
          </li>
        `).join("")}
      </ol>

      <div class="import-progress-grid">
        <div><span>Tipo</span><strong id="importProgressType">${escapeHtml(importTypeInfo(tipoImportacao).label || "PDF")}</strong></div>
        <div><span>Itens</span><strong id="importProgressCount">0/${formatNumber(totalItems || 0, 0)}</strong></div>
        <div><span>Tempo</span><strong id="importProgressTime">0s</strong></div>
      </div>

      <div class="import-progress-log" id="importProgressLog"></div>

      <div class="import-progress-footer">
        <span>Não feche esta tela enquanto a importação estiver em andamento.</span>
        <button class="btn btn-light btn-sm" type="button" id="importProgressCloseBtn" disabled>Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add("import-progress-open");
  document.getElementById("importProgressCloseBtn")?.addEventListener("click", closeImportProgress);
  updateImportProgress({ step: "preparacao", label: "Preparando importação", detail: "Validando arquivo, tipo de importação e usuário logado.", percent: 3, done: 0, total: totalItems });
}

function elapsedImportProgressSeconds() {
  if (!importProgressRuntime.startedAt) return "0s";
  const seconds = Math.max(0, Math.round((Date.now() - importProgressRuntime.startedAt) / 1000));
  return `${seconds}s`;
}

function updateImportStepClasses(stepKey = "preparacao") {
  const currentIndex = Math.max(0, IMPORT_PROGRESS_STEPS.findIndex((step) => step.key === stepKey));
  document.querySelectorAll("#importProgressSteps li").forEach((el) => {
    const idx = IMPORT_PROGRESS_STEPS.findIndex((step) => step.key === el.dataset.step);
    el.classList.toggle("is-active", idx === currentIndex);
    el.classList.toggle("is-done", idx >= 0 && idx < currentIndex);
  });
}

function addImportProgressLog(message = "") {
  const log = document.getElementById("importProgressLog");
  if (!log || !message) return;
  const row = document.createElement("div");
  row.textContent = `${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · ${message}`;
  log.prepend(row);
  while (log.children.length > 8) log.lastElementChild?.remove();
}

function updateImportProgress({ step = "preparacao", label = "Processando...", detail = "", percent = 0, done = null, total = null, log = "" } = {}) {
  const overlay = document.getElementById("importProgressOverlay");
  if (!overlay) return;

  importProgressRuntime.currentStep = step;
  importProgressRuntime.lastPercent = Math.max(importProgressRuntime.lastPercent || 0, percentClamp(percent));

  const safePercent = importProgressRuntime.lastPercent;
  const bar = document.getElementById("importProgressBar");
  const percentEl = document.getElementById("importProgressPercent");
  const statusEl = document.getElementById("importProgressStatus");
  const detailEl = document.getElementById("importProgressDetail");
  const countEl = document.getElementById("importProgressCount");
  const timeEl = document.getElementById("importProgressTime");

  if (bar) bar.style.width = `${safePercent}%`;
  if (percentEl) percentEl.textContent = `${safePercent}%`;
  if (statusEl) statusEl.textContent = label;
  if (detailEl) detailEl.textContent = detail || "Aguardando próximo passo...";
  if (countEl) {
    const finalTotal = total ?? importProgressRuntime.totalItems ?? 0;
    const finalDone = done ?? 0;
    countEl.textContent = `${formatNumber(finalDone || 0, 0)}/${formatNumber(finalTotal || 0, 0)}`;
  }
  if (timeEl) timeEl.textContent = elapsedImportProgressSeconds();

  updateImportStepClasses(step);
  if (log) addImportProgressLog(log);
}

function failImportProgress(message = "Importação não concluída.") {
  const overlay = document.getElementById("importProgressOverlay");
  if (!overlay) return;
  overlay.classList.add("is-error");
  updateImportProgress({ step: importProgressRuntime.currentStep || "preparacao", label: "Importação não concluída", detail: message, percent: importProgressRuntime.lastPercent || 0, log: message });
  const closeBtn = document.getElementById("importProgressCloseBtn");
  if (closeBtn) closeBtn.disabled = false;
}

function completeImportProgress(message = "Importação concluída com sucesso.") {
  const overlay = document.getElementById("importProgressOverlay");
  if (!overlay) return;
  overlay.classList.add("is-complete");
  updateImportProgress({ step: "conclusao", label: "Importação concluída", detail: message, percent: 100, done: importProgressRuntime.totalItems || 0, total: importProgressRuntime.totalItems || 0, log: message });
  const closeBtn = document.getElementById("importProgressCloseBtn");
  if (closeBtn) {
    closeBtn.disabled = false;
    closeBtn.textContent = "Fechar";
  }
  setTimeout(closeImportProgress, 1300);
}

function closeImportProgress() {
  const overlay = document.getElementById("importProgressOverlay");
  if (overlay) overlay.remove();
  document.body.classList.remove("import-progress-open");
  importProgressRuntime.active = false;
}


const MOBILE_MODE_MAX_WIDTH = 900;

function isLikelyMobileViewport() {
  if (typeof window === "undefined") return false;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
  const visualWidth = Number(window.visualViewport?.width || 0);
  const innerWidth = Number(window.innerWidth || 0);
  const clientWidth = Number(document.documentElement?.clientWidth || 0);
  const realWidth = Math.min(
    visualWidth || 9999,
    innerWidth || 9999,
    clientWidth || 9999
  );

  // Regra correta:
  // - Computador/laptop com 1200px+ fica desktop, mesmo que a altura da tela seja 768px.
  // - DevTools/iPhone/celular entra mobile pela largura útil.
  // - Celular/tablet real com UA mobile entra mobile até 1024px.
  return realWidth <= MOBILE_MODE_MAX_WIDTH || (uaMobile && realWidth <= 1024);
}

function syncResponsiveMode() {
  const mobile = isLikelyMobileViewport();
  document.documentElement.classList.toggle("force-mobile", mobile);
  document.body?.classList.toggle("force-mobile", mobile);
}

syncResponsiveMode();
window.addEventListener("resize", () => { syncResponsiveMode(); scheduleMobileEnforcement(); }, { passive: true });
window.addEventListener("orientationchange", () => setTimeout(() => { syncResponsiveMode(); scheduleMobileEnforcement(); }, 250), { passive: true });
window.visualViewport?.addEventListener?.("resize", () => { syncResponsiveMode(); scheduleMobileEnforcement(); }, { passive: true });
window.addEventListener("hashchange", scheduleMobileEnforcement, { passive: true });
window.addEventListener("load", scheduleMobileEnforcement, { passive: true });



function enforceMobileDomState() {
  const mobile = isLikelyMobileViewport();
  document.documentElement.classList.toggle("force-mobile", mobile);
  document.body?.classList.toggle("force-mobile", mobile);

  const nav = document.querySelector("nav.nav, .sidebar .nav");
  const switcher = document.querySelector(".mobile-route-switcher");
  const routeSelect = document.getElementById("mobileRouteSelect");

  if (mobile) {
    if (nav) {
      nav.setAttribute("aria-hidden", "true");
      nav.style.setProperty("display", "none", "important");
      nav.style.setProperty("visibility", "hidden", "important");
      nav.style.setProperty("position", "absolute", "important");
      nav.style.setProperty("left", "-99999px", "important");
      nav.style.setProperty("width", "0", "important");
      nav.style.setProperty("height", "0", "important");
      nav.style.setProperty("overflow", "hidden", "important");
      nav.style.setProperty("pointer-events", "none", "important");
    }

    if (switcher) {
      switcher.style.setProperty("display", "grid", "important");
      switcher.style.setProperty("width", "100%", "important");
      switcher.style.setProperty("max-width", "100%", "important");
      switcher.style.setProperty("min-width", "0", "important");
    }

    if (routeSelect) {
      routeSelect.classList.add("mobile-nav-select");
      routeSelect.setAttribute("data-mobile-nav", "true");
      routeSelect.style.setProperty("display", "block", "important");
      routeSelect.style.setProperty("width", "100%", "important");
      routeSelect.style.setProperty("max-width", "100%", "important");
      routeSelect.style.setProperty("min-width", "0", "important");
    }

    [
      ".app-shell", ".content-shell", ".main", ".topbar", ".actions",
      ".user-pill", ".hero-card", ".ai-hero-card", ".card", ".grid",
      ".grid-2", ".grid-3", ".grid-4", ".form-row", ".dashboard-grid",
      ".kpis", ".cards", ".ai-layout", ".table-wrap"
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        el.style.setProperty("max-width", "100%", "important");
        el.style.setProperty("min-width", "0", "important");
      });
    });
  } else {
    document.documentElement.classList.remove("force-mobile");
    document.body?.classList.remove("force-mobile");

    if (nav) {
      nav.removeAttribute("aria-hidden");
      ["display", "visibility", "position", "left", "top", "width", "max-width", "height", "max-height", "overflow", "pointer-events"].forEach((prop) => nav.style.removeProperty(prop));
    }

    if (switcher) {
      switcher.setAttribute("aria-hidden", "true");
      ["display", "width", "max-width", "min-width", "height", "max-height", "overflow"].forEach((prop) => switcher.style.removeProperty(prop));
    }

    if (routeSelect) {
      ["display", "width", "max-width", "min-width"].forEach((prop) => routeSelect.style.removeProperty(prop));
    }

    [
      ".app-shell", ".content-shell", ".main", ".topbar", ".actions",
      ".user-pill", ".hero-card", ".ai-hero-card", ".card", ".grid",
      ".grid-2", ".grid-3", ".grid-4", ".form-row", ".dashboard-grid",
      ".kpis", ".cards", ".ai-layout", ".table-wrap"
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        ["max-width", "min-width", "overflow-x", "display", "grid-template-columns"].forEach((prop) => el.style.removeProperty(prop));
      });
    });
  }
}

function scheduleMobileEnforcement() {
  requestAnimationFrame(() => {
    enforceMobileDomState();
    setTimeout(enforceMobileDomState, 80);
    setTimeout(enforceMobileDomState, 350);
  });
}

const routes = [
  ["dashboard", "Painel", "Resumo do dia"],
  ["importacao", "Importar PDF", "Inventário ou venda"],
  ["estoque", "Estoque", "Consulta operacional"],
  ["vendas", "Vendas", "Pedidos e baixas"],
  ["alertas", "Alertas", "Decisões do gestor"],
  ["producao", "Produção", "Entrada manual"],
  ["produtos", "Joias", "Catálogo técnico"],
  ["clientes", "Clientes", "Carteira"],
  ["relatorios", "Relatórios", "Resumo e PDF"],
  ["auditoria", "Auditoria", "Quem fez, quando e por quê"],
  ["configuracoes", "Regras", "Parâmetros"]
];


const ROLE_OPTIONS = [
  { key: "dono", label: "Administrador Master", descricao: "Acesso administrativo completo ao sistema, regras, colaboradores e operação." },
  { key: "gerente", label: "Gerente", descricao: "Administração da operação, colaboradores, relatórios e regras." },
  { key: "vendedor", label: "Vendedor", descricao: "Cadastro de joias, clientes, vendas, consignações e relatórios comerciais." },
  { key: "atendente", label: "Atendente", descricao: "Atendimento, clientes, vendas e consignações." },
  { key: "entregador", label: "Entregador", descricao: "Consulta operacional e acompanhamento de consignações/entregas." }
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((role) => [role.key, role.label]));

const ROUTE_ROLES = {
  dashboard: ["dono", "gerente", "vendedor", "atendente", "entregador"],
  importacao: ["dono", "gerente", "vendedor", "atendente"],
  produtos: ["dono", "gerente", "vendedor", "atendente"],
  producao: ["dono", "gerente"],
  calculadora: ["dono", "gerente"],
  estoque: ["dono", "gerente", "vendedor", "atendente", "entregador"],
  vendas: ["dono", "gerente", "vendedor", "atendente"],
  alertas: ["dono", "gerente"],
  consignacoes: ["dono", "gerente", "vendedor", "atendente", "entregador"],
  clientes: ["dono", "gerente", "vendedor", "atendente"],
  colaboradores: ["dono", "gerente"],
  auditoria: ["dono", "gerente"],
  vendedores: ["dono", "gerente"],
  comissoes: ["dono"],
  relatorios: ["dono", "gerente", "vendedor", "atendente"],
  assistente: ["dono", "gerente", "vendedor", "atendente", "entregador"],
  configuracoes: ["dono", "gerente"]
};

function userProfileByEmail() {
  const email = String(state.user?.email || "").toLowerCase();
  if (!email) return null;
  return objectToArray(state.data?.usuarios || {}).find((usuario) => String(usuario.email || "").toLowerCase() === email) || null;
}

function currentUserProfile() {
  if (!state.user) return null;
  const uidValue = state.user.uid || "";
  const byUid = uidValue ? (state.data?.usuarios || {})[uidValue] : null;
  if (byUid) return { id: uidValue, ...byUid };

  const byEmail = userProfileByEmail();
  if (byEmail) return byEmail;

  if (DB.isGestor(state.user)) {
    return {
      id: uidValue,
      nome: "Vitor Gomes",
      email: state.user.email || "vtgomes@ts.com",
      papel: "dono",
      cargo: "Administrador Master",
      ativo: true
    };
  }

  return null;
}

function currentUserRole() {
  if (DB.isGestor(state.user)) return "dono";
  const profile = currentUserProfile();
  return String(profile?.papel || "sem_acesso").toLowerCase();
}

function roleLabel(role = currentUserRole()) {
  return ROLE_LABELS[String(role || "").toLowerCase()] || "Sem função";
}

function isOwnerUser() {
  return currentUserRole() === "dono" || DB.isGestor(state.user);
}

function isManagerUser() {
  return currentUserRole() === "gerente";
}

function isAdminUser() {
  return isOwnerUser() || isManagerUser();
}

function isActiveUser() {
  if (!state.user) return false;
  if (DB.isGestor(state.user)) return true;
  const profile = currentUserProfile();
  return Boolean(profile && profile.ativo !== false);
}

function canAccessRoute(routeKey) {
  if (!state.user) return false;
  if (!isActiveUser()) return false;
  const role = currentUserRole();
  const allowed = ROUTE_ROLES[routeKey] || [];
  return allowed.includes(role) || isOwnerUser();
}

function availableRoutes() {
  return routes.filter(([key]) => canAccessRoute(key));
}

function canManageCollaborators() {
  return isAdminUser();
}

function canEditRules() {
  return isAdminUser();
}

function canRegisterCommercialOperation() {
  const role = currentUserRole();
  return ["dono", "gerente", "vendedor", "atendente"].includes(role);
}

function canRegisterProduct() {
  const role = currentUserRole();
  return ["dono", "gerente", "vendedor", "atendente"].includes(role);
}

function collaboratorOptions(current = "") {
  return ROLE_OPTIONS.map((role) => `
    <option value="${role.key}" ${String(current || "") === role.key ? "selected" : ""}>${role.label}</option>
  `).join("\n");
}

function accessDeniedView(message = "") {
  app.innerHTML = `
    <div class="login-shell">
      <main class="login-card">
        <div class="brand-lockup">
          <div class="brand-mark">◆</div>
          <div>
            <h1 class="brand-title">${escapeHtml(APP_CONFIG.app.nome)}</h1>
            <p class="brand-subtitle">Acesso não liberado</p>
          </div>
        </div>
        <h2>Usuário sem permissão ativa</h2>
        <p>O login foi reconhecido, mas este usuário ainda não foi cadastrado como colaborador ativo pelo gestor da empresa.</p>
        ${message ? `<div class="notice danger">${escapeHtml(message)}</div>` : ""}
        <button class="btn btn-gold" id="logoutDeniedBtn">Sair</button>
      </main>
      ${footer()}
    </div>
  `;
  document.getElementById("logoutDeniedBtn")?.addEventListener("click", async () => {
    await DB.signOut();
    state.user = null;
    state.data = null;
    loginView();
  });
}


function routeName() {
  return (location.hash || "#/dashboard").replace("#/", "") || "dashboard";
}

function activeRouteMeta() {
  const current = routeName();
  const route = routes.find(([key]) => key === current);
  if (route && canAccessRoute(route[0])) return route;
  return availableRoutes()[0] || routes[0];
}

function footer() {
  return `
    <footer class="footer">
      <span>${escapeHtml(APP_CONFIG.app.assinatura)}</span>
      <span>Gestão de joias, produção, vendas e consignações.</span>
    </footer>
  `;
}

function loginView(error = "") {
  app.innerHTML = `
    <div class="login-shell">
      <main class="login-card">
        <div class="brand-lockup">
          <div class="brand-mark">◆</div>
          <div>
            <h1 class="brand-title">${escapeHtml(APP_CONFIG.app.nome)}</h1>
            <p class="brand-subtitle">${escapeHtml(APP_CONFIG.app.subtitulo)}</p>
          </div>
        </div>

        <h2>Acesso do sistema</h2>
        <p>Entre com seu e-mail e senha cadastrados para acessar a operação.</p>

        ${DB.isFirebaseConfigured() ? "" : `
          <div class="notice danger">
            Ambiente ainda não conectado. Finalize a configuração antes de liberar o acesso ao gestor.
          </div>
        `}

        ${error ? `<div class="notice danger">${escapeHtml(error)}</div>` : ""}

        <form id="loginForm" class="grid" style="margin-top:18px">
          <div class="field">
            <label>E-mail</label>
            <input name="email" type="email" placeholder="gestor@empresa.com.br" required>
          </div>
          <div class="field">
            <label>Senha</label>
            <input name="password" type="password" placeholder="••••••••" required>
          </div>
          <button class="btn btn-gold" type="submit" ${DB.isFirebaseConfigured() ? "" : "disabled"}>Entrar no sistema</button>
        </form>
      </main>
      ${footer()}
    </div>
  `;

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      state.user = await DB.signIn(form.get("email"), form.get("password"));
      await loadData();
      if (!isActiveUser()) {
        accessDeniedView("Peça ao Vitor ou a um gerente para ativar este usuário em Colaboradores.");
        return;
      }
      if (!location.hash) location.hash = "#/dashboard";
      render();
    } catch (err) {
      loginView(err.message || "Não foi possível entrar.");
    }
  });
}


function enhanceResponsiveTables(root = document) {
  root.querySelectorAll(".table-wrap table").forEach((table) => {
    const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
      th.textContent.trim().replace(/\s+/g, " ")
    );
    table.querySelectorAll("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!cell.getAttribute("data-label")) {
          cell.setAttribute("data-label", headers[index] || "Informação");
        }
      });
    });
  });
}


function installMobileHardFixCss() {
  if (document.getElementById("joias-mobile-hard-fix-v9")) return;

  const style = document.createElement("style");
  style.id = "joias-mobile-hard-fix-v9";
  style.textContent = `
    @media screen and (max-width: 1024px), screen and (max-device-width: 1024px) {
      *, *::before, *::after { box-sizing: border-box !important; }
      html, body, #app { width:100% !important; max-width:100vw !important; min-width:0 !important; margin:0 !important; overflow-x:hidden !important; }
      body { -webkit-text-size-adjust:100% !important; text-size-adjust:100% !important; background:#f5f0e6 !important; }

      .app-shell, .content-shell, .main, .footer, .topbar, .sidebar,
      .card, .kpi, .report-box, .notice, .empty, .ai-panel, .ai-workspace, .ai-answer,
      .table-wrap, .form-row, .grid, .grid-2, .grid-3, .grid-4, .dashboard-grid,
      .ai-layout, .hero-card, .ai-hero-card {
        width:100% !important; max-width:100% !important; min-width:0 !important; overflow-x:hidden !important;
      }

      .app-shell { display:block !important; grid-template-columns:1fr !important; min-height:100dvh !important; }
      .sidebar { position:sticky !important; top:0 !important; z-index:99 !important; height:auto !important; max-height:none !important; padding:calc(12px + env(safe-area-inset-top)) clamp(12px, 4vw, 18px) 14px !important; border-radius:0 0 24px 24px !important; border-right:0 !important; background:radial-gradient(circle at 20% 0%, rgba(231,203,123,.22), transparent 34%), linear-gradient(180deg,#111827 0%,#0b1220 100%) !important; box-shadow:0 14px 34px rgba(2,6,23,.28) !important; }
      .sidebar .brand-lockup, .brand-lockup { display:grid !important; grid-template-columns:52px minmax(0,1fr) !important; gap:12px !important; align-items:center !important; width:100% !important; margin:0 0 12px !important; }
      .brand-mark, .sidebar .brand-mark { width:52px !important; height:52px !important; min-width:52px !important; border-radius:16px !important; font-size:18px !important; }
      .brand-title { margin:0 !important; max-width:100% !important; font-size:clamp(20px,5.8vw,27px) !important; line-height:1.08 !important; white-space:normal !important; overflow-wrap:anywhere !important; }
      .brand-subtitle { margin:3px 0 0 !important; max-width:100% !important; font-size:clamp(13px,3.8vw,16px) !important; line-height:1.22 !important; white-space:normal !important; overflow-wrap:anywhere !important; }

      .nav { display:none !important; }
      .mobile-route-switcher { display:grid !important; width:100% !important; max-width:100% !important; gap:7px !important; margin:0 !important; }
      .mobile-route-switcher label { color:rgba(255,248,230,.74) !important; font-size:10px !important; font-weight:900 !important; letter-spacing:.12em !important; text-transform:uppercase !important; }
      .mobile-route-switcher select { appearance:none !important; -webkit-appearance:none !important; width:100% !important; max-width:100% !important; min-width:0 !important; min-height:52px !important; padding:0 44px 0 14px !important; border:1px solid rgba(231,203,123,.36) !important; border-radius:16px !important; color:#fff8e6 !important; font-size:16px !important; font-weight:850 !important; background:linear-gradient(135deg,rgba(255,255,255,.11),rgba(202,167,86,.12)),#101827 !important; }

      .content-shell { display:block !important; background:radial-gradient(circle at 100% 0%,rgba(202,167,86,.10),transparent 34%),#f5f0e6 !important; }
      .topbar { position:relative !important; top:auto !important; z-index:1 !important; display:grid !important; grid-template-columns:1fr !important; gap:10px !important; padding:22px clamp(12px,4vw,18px) 16px !important; background:transparent !important; border-bottom:1px solid rgba(40,32,22,.08) !important; }
      .page-title h1 { margin:0 !important; max-width:100% !important; font-size:clamp(27px,8vw,38px) !important; line-height:1.04 !important; overflow-wrap:anywhere !important; }
      .page-title p { margin:6px 0 0 !important; max-width:100% !important; font-size:clamp(14px,4.2vw,18px) !important; line-height:1.25 !important; }

      .topbar .actions, .actions { display:grid !important; grid-template-columns:1fr !important; gap:10px !important; width:100% !important; max-width:100% !important; }
      .user-pill { width:100% !important; max-width:100% !important; min-width:0 !important; min-height:58px !important; border-radius:999px !important; padding:8px 12px !important; overflow:hidden !important; }
      .user-pill strong, .user-pill span { display:inline-block !important; max-width:calc(100vw - 120px) !important; overflow:hidden !important; text-overflow:ellipsis !important; vertical-align:bottom !important; }

      #logoutBtn, .btn, button { width:100% !important; max-width:100% !important; min-height:54px !important; border-radius:16px !important; white-space:normal !important; }
      .main { display:block !important; padding:16px clamp(12px,4vw,18px) 26px !important; }

      .hero-card, .ai-hero-card { display:grid !important; grid-template-columns:1fr !important; margin:0 0 14px !important; padding:18px !important; border-radius:22px !important; }
      .hero-card h2, .ai-hero-card h2 { max-width:100% !important; font-size:clamp(24px,7.2vw,34px) !important; line-height:1.04 !important; white-space:normal !important; overflow-wrap:anywhere !important; }
      .hero-card p, .ai-hero-card p { max-width:100% !important; font-size:15px !important; line-height:1.35 !important; overflow-wrap:anywhere !important; }
      .hero-gem { display:none !important; }

      .grid, .grid.grid-2, .grid.grid-3, .grid.grid-4, .grid-2, .grid-3, .grid-4, .form-row, .cards, .kpis, .dashboard, .dashboard-grid, .ai-layout {
        display:grid !important; grid-template-columns:1fr !important; gap:12px !important;
      }

      .card, .kpi, .report-box, .notice, .empty, .ai-panel, .ai-workspace, .ai-answer { padding:16px !important; border-radius:20px !important; }
      .card h2 { font-size:clamp(24px,7vw,33px) !important; line-height:1.05 !important; overflow-wrap:anywhere !important; }

      .field, .check-field, .col-1, .col-2, .col-3, .col-4, .col-5, .col-6, .col-7, .col-8, .col-9, .col-10, .col-11, .col-12 {
        grid-column:1 / -1 !important; width:100% !important; max-width:100% !important;
      }

      input, select, textarea { width:100% !important; max-width:100% !important; min-width:0 !important; min-height:54px !important; border-radius:16px !important; font-size:16px !important; }
      input[type="file"] { padding:12px !important; overflow:hidden !important; }

      .table-wrap { overflow:visible !important; border:0 !important; border-radius:0 !important; background:transparent !important; box-shadow:none !important; }
      .table-wrap table, .table-wrap thead, .table-wrap tbody, .table-wrap tr, .table-wrap th, .table-wrap td {
        display:block !important; width:100% !important; max-width:100% !important; min-width:0 !important; border-collapse:initial !important;
      }
      .table-wrap table { table-layout:fixed !important; border:0 !important; background:transparent !important; }
      .table-wrap thead { display:none !important; }
      .table-wrap tbody { display:grid !important; grid-template-columns:1fr !important; gap:12px !important; }
      .table-wrap tr { display:grid !important; grid-template-columns:1fr !important; gap:0 !important; padding:12px 14px !important; border:1px solid rgba(40,32,22,.10) !important; border-radius:20px !important; background:linear-gradient(180deg,#fff,#fff8ed) !important; box-shadow:0 14px 34px rgba(20,18,14,.08) !important; overflow:hidden !important; }
      .table-wrap td { display:grid !important; grid-template-columns:minmax(92px,34%) minmax(0,1fr) !important; gap:9px !important; align-items:start !important; padding:9px 0 !important; border:0 !important; border-bottom:1px solid rgba(40,32,22,.09) !important; text-align:left !important; white-space:normal !important; word-break:normal !important; overflow-wrap:anywhere !important; }
      .table-wrap td:last-child { border-bottom:0 !important; }
      .table-wrap td::before { content:attr(data-label) !important; display:block !important; color:#806a45 !important; font-size:10px !important; line-height:1.25 !important; text-transform:uppercase !important; letter-spacing:.06em !important; font-weight:950 !important; }

      .product-thumb, img.product-thumb { width:72px !important; height:72px !important; max-width:72px !important; border-radius:16px !important; object-fit:cover !important; }
      .ai-compose { position:static !important; padding:12px !important; border-radius:20px !important; }
      .ai-compose-box, .quick-prompts { display:grid !important; grid-template-columns:1fr !important; gap:10px !important; }
      .ai-compose textarea { min-height:170px !important; max-height:none !important; }
      .prompt-chip { width:100% !important; min-width:0 !important; }
      .preview-json, pre { width:100% !important; max-width:100% !important; white-space:pre-wrap !important; overflow-wrap:anywhere !important; overflow-x:hidden !important; }
      .footer { display:grid !important; gap:5px !important; text-align:center !important; justify-content:center !important; padding:18px clamp(12px,4vw,18px) calc(18px + env(safe-area-inset-bottom)) !important; }
    }
    @media screen and (max-width: 430px), screen and (max-device-width: 430px) {
      .brand-lockup { grid-template-columns:50px minmax(0,1fr) !important; }
      .brand-mark { width:50px !important; height:50px !important; min-width:50px !important; }
      .main, .topbar, .sidebar, .footer { --mobile-page-x:10px; }
      .card, .kpi, .report-box, .notice, .empty, .ai-panel, .ai-workspace { padding:14px !important; border-radius:18px !important; }
      .table-wrap td { grid-template-columns:1fr !important; gap:4px !important; }
    }
  `;

  document.head.appendChild(style);
}

installMobileHardFixCss();


function openUiSection(selector) {
  if (!selector) return false;
  const target = document.querySelector(selector);
  if (!target) return false;
  if (target.tagName && target.tagName.toLowerCase() === "details") target.open = true;
  target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  target.classList.add("focus-pulse");
  setTimeout(() => target.classList.remove("focus-pulse"), 1800);
  return true;
}

function applyPendingUiState() {
  const openSelector = sessionStorage.getItem("glamore.open.section");
  if (openSelector) {
    if (openUiSection(openSelector)) sessionStorage.removeItem("glamore.open.section");
  }
}

function setupGlobalUiActions() {
  document.querySelectorAll("[data-open-section]").forEach((el) => {
    el.addEventListener("click", (event) => {
      const selector = el.getAttribute("data-open-section");
      if (!selector) return;
      sessionStorage.setItem("glamore.open.section", selector);
      const href = el.getAttribute("href") || "";
      if (href && href.startsWith("#/") && href !== location.hash) return;
      event.preventDefault();
      if (openUiSection(selector)) sessionStorage.removeItem("glamore.open.section");
    });
  });

  document.querySelectorAll("[data-stock-filter-text]").forEach((el) => {
    el.addEventListener("click", () => {
      const value = el.getAttribute("data-stock-filter-text") || "";
      if (value) sessionStorage.setItem("glamore.stock.filter.text", value);
    });
  });

  document.querySelectorAll("[data-stock-filter-code]").forEach((el) => {
    el.addEventListener("click", () => {
      const value = el.getAttribute("data-stock-filter-code") || "";
      if (value) sessionStorage.setItem("glamore.stock.filter.code", value);
    });
  });
}

function shell(content) {
  const [current, title, subtitle] = activeRouteMeta();
  const visibleRoutes = availableRoutes();
  const nav = visibleRoutes.map(([key, label, small]) => `
    <a href="#/${key}" class="${key === current ? "active" : ""}">
      <span>${iconFor(key)}</span>
      <span>${label}<br><small style="margin:0;text-transform:none;letter-spacing:0;font-size:11px">${small}</small></span>
    </a>
  `).join("\n");
  const mobileRouteOptions = visibleRoutes.map(([key, label]) => `
    <option value="${key}" ${key === current ? "selected" : ""}>${label}</option>
  `).join("\n");

  app.innerHTML = `
    <div class="app-shell" data-route="${escapeHtml(current)}">
      <aside class="sidebar">
        <div class="brand-lockup">
          <div class="brand-mark">◆</div>
          <div>
            <h1 class="brand-title">${escapeHtml(APP_CONFIG.app.nome)}</h1>
            <p class="brand-subtitle">Estoque · Produção · Venda</p>
          </div>
        </div>

        <div class="mobile-route-switcher">
          <label for="mobileRouteSelect">Tela do sistema</label>
          <select id="mobileRouteSelect" class="mobile-nav-select" data-mobile-nav="true" aria-label="Escolher tela do sistema">${mobileRouteOptions}</select>
        </div>

        <nav class="nav">
          <small>Operação</small>
          ${nav}
        </nav>
      </aside>

      <section class="content-shell">
        <header class="topbar">
          <div class="page-title">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <div class="actions">
            <div class="user-pill">
              <div class="user-avatar">${escapeHtml((state.user?.email || "U").slice(0, 1).toUpperCase())}</div>
              <div>
                <strong style="font-size:13px">${escapeHtml(state.user?.email || "Usuário")}</strong><br>
                <span style="font-size:11px;color:var(--muted)">${escapeHtml(roleLabel())}</span>
              </div>
            </div>
            <button class="btn btn-light" id="logoutBtn">Sair</button>
          </div>
        </header>

        <main class="main main-${escapeHtml(current)}">${content}</main>
        ${footer()}
      </section>
    </div>
  `;

  enhanceResponsiveTables();
  scheduleMobileEnforcement();

  document.getElementById("mobileRouteSelect")?.addEventListener("change", (event) => {
    const nextRoute = event.currentTarget.value || "dashboard";
    location.hash = `#/${nextRoute}`;
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await DB.signOut();
    state.user = null;
    state.data = null;
    loginView();
  });

  setupGlobalUiActions();
  requestAnimationFrame(applyPendingUiState);
}

function iconFor(key) {
  const map = {
    dashboard: "◆",
    importacao: "⇪",
    produtos: "◇",
    producao: "✦",
    calculadora: "⌁",
    estoque: "▦",
    vendas: "✓",
    alertas: "!",
    consignacoes: "◌",
    clientes: "◎",
    colaboradores: "♟",
    auditoria: "☷",
    vendedores: "♙",
    comissoes: "%",
    relatorios: "▤",
    assistente: "IA",
    configuracoes: "⚙"
  };
  return map[key] || "•";
}

async function ensureOwnerProfile() {
  if (!state.user || !state.data || !DB.isGestor(state.user)) return;

  const ownerUid = state.user.uid || "";
  if (!ownerUid) return;

  const existing = state.data.usuarios?.[ownerUid] || {};
  const email = String(state.user.email || existing.email || "vtgomes@ts.com").toLowerCase();
  const nomeAtual = String(existing.nome || "").trim();
  const ownerProfile = {
    ...existing,
    nome: nomeAtual && nomeAtual !== "Gestor" ? nomeAtual : "Vitor Gomes",
    email,
    papel: "dono",
    cargo: existing.cargo || "Administrador Master",
    ativo: true,
    criadoEm: existing.criadoEm || nowIso(),
    atualizadoEm: nowIso()
  };

  const precisaSalvar =
    existing.papel !== "dono" ||
    existing.ativo === false ||
    String(existing.email || "").toLowerCase() !== email ||
    !existing.nome ||
    existing.nome === "Gestor";

  state.data.usuarios = { ...(state.data.usuarios || {}), [ownerUid]: ownerProfile };

  if (precisaSalvar) {
    try {
      await DB.save("usuarios", ownerUid, ownerProfile);
    } catch (err) {
      console.warn("Não foi possível atualizar automaticamente o perfil do dono.", err);
    }
  }
}

async function loadData() {
  state.data = await DB.loadSecureData();
  await ensureOwnerProfile();
}

function currentUserAuditInfo() {
  const profile = currentUserProfile() || {};
  return {
    uid: state.user?.uid || "",
    email: state.user?.email || "",
    nome: profile.nome || state.user?.displayName || state.user?.email || "",
    papel: currentUserRole(),
    papelLabel: roleLabel()
  };
}

function shortJson(value, max = 1800) {
  try {
    const text = JSON.stringify(value ?? null);
    return text.length > max ? `${text.slice(0, max)}...` : text;
  } catch (_) {
    return "";
  }
}

function buildAuditRecord(acao, detalhes = {}) {
  const ator = currentUserAuditInfo();
  return {
    tipoRegistro: "auditoria_operacional",
    acao: acao || "acao_sistema",
    colecao: detalhes.colecao || "",
    documentoId: detalhes.documentoId || "",
    motivo: detalhes.motivo || detalhes.observacao || "Registro automático do sistema",
    justificativaObrigatoria: Boolean(detalhes.justificativaObrigatoria),
    resumo: detalhes.resumo || "",
    antes: detalhes.antes ? shortJson(detalhes.antes) : "",
    depois: detalhes.depois ? shortJson(detalhes.depois) : "",
    metadados: detalhes.metadados || {},
    statusAuditoria: detalhes.statusAuditoria || "concluida",
    criadoEm: detalhes.criadoEm || nowIso(),
    atualizadoEm: nowIso(),
    dataHora: new Date().toLocaleString("pt-BR"),
    usuarioUid: ator.uid,
    usuarioEmail: ator.email,
    usuarioNome: ator.nome,
    usuarioPapel: ator.papel,
    usuarioPapelLabel: ator.papelLabel
  };
}

function firebaseSafeAuditValue(value, { inArray = false } = {}) {
  if (value === undefined) return inArray ? null : undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => firebaseSafeAuditValue(item, { inArray: true }));
  }

  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    const safe = firebaseSafeAuditValue(item);
    if (safe !== undefined) clean[key] = safe;
  }
  return clean;
}

async function auditLogStrict(acao, detalhes = {}) {
  const record = firebaseSafeAuditValue(buildAuditRecord(acao, detalhes));
  const id = await DB.push("auditoria", record);
  localPatchCollection("auditoria", id, record);
  return id;
}

async function auditPatchStrict(id, patch = {}) {
  if (!id) throw new Error("Registro de auditoria não informado.");
  const payload = firebaseSafeAuditValue({
    ...patch,
    atualizadoEm: nowIso(),
    dataHoraAtualizacao: new Date().toLocaleString("pt-BR")
  });
  await DB.patch("auditoria", id, payload);
  localPatchCollection("auditoria", id, payload);
  return id;
}

async function auditLog(acao, detalhes = {}) {
  try {
    return await auditLogStrict(acao, detalhes);
  } catch (err) {
    console.warn("Auditoria não registrada:", err);
    return "";
  }
}

function auditReason(value, fallback = "Operação realizada pela plataforma") {
  const reason = String(value || "").trim();
  return reason || fallback;
}

function requireReversalReason({ tipo = "operação", referencia = "" } = {}) {
  const reason = prompt(
    `JUSTIFICATIVA OBRIGATÓRIA PARA ESTORNO\n\n` +
    `Tipo: ${tipo}\n` +
    `Referência: ${referencia || "-"}\n\n` +
    `Explique por que este estorno está sendo feito. A justificativa ficará permanentemente registrada na Auditoria.\n\n` +
    `Mínimo: 10 caracteres.`
  );
  if (reason === null) return "";
  const normalized = String(reason || "").trim();
  if (normalized.length < 10) {
    alert("Estorno cancelado. Informe uma justificativa real com pelo menos 10 caracteres.");
    return "";
  }
  return normalized;
}

function requirePdfStatusCorrectionReason({ referencia = "" } = {}) {
  const reason = prompt(
    `CORRIGIR STATUS DO PDF\n\n` +
    `Referência: ${referencia || "-"}\n\n` +
    `A venda deste PDF já foi estornada. Esta ação NÃO movimentará peças, quantidade, peso, lote ou saldo. ` +
    `Ela apenas marcará o documento como estornado e o removerá da lista de PDFs ativos.\n\n` +
    `Informe o motivo da correção. Ele ficará registrado na Auditoria.\n\n` +
    `Mínimo: 10 caracteres.`
  );
  if (reason === null) return "";
  const normalized = String(reason || "").trim();
  if (normalized.length < 10) {
    alert("Correção cancelada. Informe um motivo real com pelo menos 10 caracteres.");
    return "";
  }
  return normalized;
}

function reversalActorFields(motivo = "") {
  const ator = currentUserAuditInfo();
  return {
    estornoMotivo: motivo,
    estornoJustificativa: motivo,
    estornadoEm: nowIso(),
    estornadoPor: ator.email || ator.nome || "",
    estornadoPorUid: ator.uid || "",
    estornadoPorEmail: ator.email || "",
    estornadoPorNome: ator.nome || "",
    estornadoPorPapel: ator.papel || "",
    estornadoPorPapelLabel: ator.papelLabel || ""
  };
}

async function startReversalAudit({ acao = "estorno_solicitado", colecao = "", documentoId = "", motivo = "", resumo = "", antes = null, metadados = {} } = {}) {
  if (String(motivo || "").trim().length < 10) throw new Error("Justificativa de estorno inválida.");
  return auditLogStrict(acao, {
    colecao,
    documentoId,
    motivo,
    resumo,
    antes,
    metadados,
    justificativaObrigatoria: true,
    statusAuditoria: "iniciada"
  });
}

async function completeReversalAudit(id, { resumo = "", depois = null, metadados = {} } = {}) {
  return auditPatchStrict(id, {
    statusAuditoria: "concluida",
    concluidaEm: nowIso(),
    resumo,
    depois: depois ? shortJson(depois) : "",
    metadados
  });
}

async function failReversalAudit(id, err) {
  if (!id) return;
  try {
    await auditPatchStrict(id, {
      statusAuditoria: "falhou",
      falhouEm: nowIso(),
      erro: String(err?.message || err || "Falha não identificada")
    });
  } catch (auditErr) {
    console.error("Falha também ao atualizar auditoria do estorno:", auditErr);
  }
}

async function createAuthUserFromPlatform({ nome, email, senha, papel, ativo }) {
  if (!state.user?.getIdToken) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const token = await state.user.getIdToken();
  const res = await fetch("/api/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      nome,
      email,
      password: senha,
      papel,
      ativo,
      empresaId: APP_CONFIG.empresaId
    })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Não foi possível criar o usuário no login do sistema.");
  }
  return json;
}

function productLabel(product = {}) {
  return `${product.codigo || ""} · ${product.medida || "-"} · ${product.material || "-"} · ${product.descricao || ""}`;
}

function productSelectOptions(products = []) {
  return products.map((p) => `
    <option value="${escapeHtml(p.id)}">${escapeHtml(productLabel(p))}</option>
  `).join("\n");
}

function saleItemDisplayedWeight(item = {}) {
  const qtd = quantitySafe(item.quantidade || 0);
  const total = numberSafe(item.pesoTotal || item.pesoTotalVenda || item.pesoTotalBaixado || item.pesoTotalLinha || 0);
  if (total > 0) return total;
  const unit = numberSafe(item.pesoUnitarioRealVenda || item.pesoUnitarioVenda || item.pesoUnitario || 0);
  return unit > 0 && qtd > 0 ? unit * qtd : 0;
}

function saleCartTotals(cart = []) {
  return cart.reduce((acc, item) => {
    acc.quantidade += quantitySafe(item.quantidade || 0);
    acc.pesoTotal += saleItemDisplayedWeight(item);
    return acc;
  }, { quantidade: 0, pesoTotal: 0 });
}

function saleCartRows(cart = []) {
  if (!cart.length) return `<div class="empty">Nenhum item adicionado à venda ainda.</div>`;
  return `
    <div class="sale-cart-list">
      ${cart.map((item, index) => `
        <article class="sale-cart-item">
          <div>
            <strong>${escapeHtml(item.codigo || "")}</strong>
            <p>${escapeHtml(item.descricao || "")}</p>
            <small>${escapeHtml(item.medida || "-")} · ${escapeHtml(item.material || "-")}</small>
          </div>
          <div><small>Qtd</small><b>${formatNumber(item.quantidade || 0, 0)}</b></div>
          <div><small>Peso</small><b>${formatNumber(saleItemDisplayedWeight(item), 3)} g</b></div>
          <button class="btn btn-light btn-sm" type="button" data-remove-sale-item="${index}">Remover</button>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSaleCartArea() {
  const area = document.getElementById("saleCartArea");
  if (!area) return;
  const totals = saleCartTotals(state.saleCart);
  area.innerHTML = `
    ${saleCartRows(state.saleCart)}
    <div class="sale-summary">
      <div><small>Itens</small><strong>${state.saleCart.length}</strong></div>
      <div><small>Peças</small><strong>${formatNumber(totals.quantidade, 0)}</strong></div>
      <div><small>Peso total</small><strong>${formatNumber(totals.pesoTotal, 3)} g</strong></div>
    </div>
  `;
  area.querySelectorAll("[data-remove-sale-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeSaleItem);
      state.saleCart.splice(index, 1);
      renderSaleCartArea();
    });
  });
}

function vendaResumo(venda = {}) {
  if (venda.tipo === "venda_pdf_agrupada") {
    const pedido = venda.pedidoPdfNumero || venda.pedidoId || "PDF";
    const pendente = quantitySafe(venda.quantidadePendenteAnaliseGestor || venda.quantidadePendenteProducao || 0);
    return `Pedido ${pedido} · ${venda.itens?.length || 0} item(ns) · ${formatNumber(venda.quantidadeTotal || 0, 0)} peça(s)${pendente ? ` · ${formatNumber(pendente, 0)} faltante(s)` : ""}`;
  }
  if (Array.isArray(venda.itens) && venda.itens.length) {
    const pendente = quantitySafe(venda.quantidadePendenteAnaliseGestor || venda.quantidadePendenteProducao || 0);
    return `${venda.itens.length} item(ns) · ${formatNumber(venda.quantidadeTotal || 0, 0)} peça(s)${pendente ? ` · ${formatNumber(pendente, 0)} faltante(s)` : ""}`;
  }
  return `${venda.codigo || ""} · ${venda.descricao || ""}`;
}



function normalizeSearchText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactCode(value = "") {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function firstWeightValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const n = numberSafe(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function pieceBaseWeight(piece = {}) {
  if (piece.pesoIndividualConhecido === false || piece.pesoControleModo === "total_lote") return 0;
  return firstWeightValue(piece.pesoOriginalAntesBaixa, piece.pesoReal, piece.pesoUnitario, piece.peso);
}

function pieceSoldWeight(piece = {}) {
  const explicit = numberSafe(piece.pesoBaixaReal ?? piece.pesoUnitarioBaixa ?? piece.pesoTotalBaixado ?? 0);
  if (explicit > 0) return explicit;
  // Compatibilidade com vendas antigas: só usa o peso da própria peça quando ele era realmente individual.
  if (piece.pesoIndividualConhecido === false || piece.pesoControleModo === "total_lote") return 0;
  return firstWeightValue(piece.pesoOriginalAntesBaixa, piece.pesoReal, piece.pesoUnitario, piece.peso);
}

function pieceReservedWeight(piece = {}) {
  return pieceBaseWeight(piece);
}

function hasIndependentWeightLedger(product = {}) {
  return product.pesoControleModo === "quantidade_peso_independentes" ||
    product.pesoEntradaAcumulado !== undefined ||
    product.pesoSaidaAcumulado !== undefined;
}

function productWeightLedgerSnapshot(produtoId = "", product = {}, pieces = []) {
  const activePieces = pieces.length ? pieces : physicalPiecesForProduct(produtoId);
  const soldPieces = activePieces.filter((piece) => pieceStatusValue(piece) === "vendido");
  const reservedPieces = activePieces.filter((piece) => pieceStatusValue(piece) === "reservado");
  const consignedPieces = activePieces.filter((piece) => pieceStatusValue(piece) === "consignado");

  if (hasIndependentWeightLedger(product)) {
    const entrada = Math.max(0, numberSafe(product.pesoEntradaAcumulado ?? product.pesoTotalFisico ?? 0));
    const saida = Math.max(0, numberSafe(product.pesoSaidaAcumulado ?? product.pesoTotalVendido ?? 0));
    const reservado = Math.max(0, numberSafe(product.pesoReservadoAcumulado ?? 0));
    const consignado = Math.max(0, numberSafe(product.pesoConsignadoAcumulado ?? 0));
    return { entrada, saida, reservado, consignado, disponivel: Math.max(0, entrada - saida - reservado - consignado), modo: "quantidade_peso_independentes" };
  }

  const entrada = sum(activePieces, pieceBaseWeight);
  const saida = sum(soldPieces, pieceSoldWeight);
  const reservado = sum(reservedPieces, pieceReservedWeight);
  const consignado = sum(consignedPieces, pieceReservedWeight);
  return { entrada, saida, reservado, consignado, disponivel: Math.max(0, entrada - saida - reservado - consignado), modo: "legado_por_peca" };
}

function ensureIndependentWeightLedger(produtoId = "", product = {}) {
  if (hasIndependentWeightLedger(product)) return product;
  const legacy = productWeightLedgerSnapshot(produtoId, product);
  product.pesoControleModo = "quantidade_peso_independentes";
  product.pesoEntradaAcumulado = Math.max(0, numberSafe(product.pesoTotalFisico || legacy.entrada || 0));
  product.pesoSaidaAcumulado = Math.max(0, numberSafe(product.pesoTotalVendido || legacy.saida || 0));
  product.pesoReservadoAcumulado = Math.max(0, numberSafe(product.pesoReservadoAcumulado || legacy.reservado || 0));
  product.pesoConsignadoAcumulado = Math.max(0, numberSafe(product.pesoConsignadoAcumulado || legacy.consignado || 0));
  return product;
}

function applyProductWeightLedgerDelta(produtoId = "", product = {}, { entradaDelta = 0, saidaDelta = 0, reservadoDelta = 0, consignadoDelta = 0, motivo = "" } = {}) {
  ensureIndependentWeightLedger(produtoId, product);
  product.pesoEntradaAcumulado = Math.max(0, numberSafe(product.pesoEntradaAcumulado || 0) + numberSafe(entradaDelta || 0));
  product.pesoSaidaAcumulado = Math.max(0, numberSafe(product.pesoSaidaAcumulado || 0) + numberSafe(saidaDelta || 0));
  product.pesoReservadoAcumulado = Math.max(0, numberSafe(product.pesoReservadoAcumulado || 0) + numberSafe(reservadoDelta || 0));
  product.pesoConsignadoAcumulado = Math.max(0, numberSafe(product.pesoConsignadoAcumulado || 0) + numberSafe(consignadoDelta || 0));
  product.pesoControleModo = "quantidade_peso_independentes";
  product.pesoControleObservacao = motivo || product.pesoControleObservacao || "Quantidade de peças e peso total controlados de forma independente.";
  const ledger = productWeightLedgerSnapshot(produtoId, product);
  product.pesoTotalFisico = ledger.entrada;
  product.pesoTotalVendido = ledger.saida;
  product.pesoTotalDisponivel = ledger.disponivel;
  product.atualizadoEm = nowIso();
  localSetCollection("produtos", produtoId, product);
  return product;
}

function accountingAvailableWeightFromPieces({ pieces = [], vendidas = [], reservadas = [], consignadas = [], product = {}, produtoId = "" } = {}) {
  if (hasIndependentWeightLedger(product)) return productWeightLedgerSnapshot(produtoId, product, pieces).disponivel;
  const pesoTotalEntrada = sum(pieces, pieceBaseWeight);
  const pesoVendidoReal = sum(vendidas, pieceSoldWeight);
  const pesoReservado = sum(reservadas, pieceReservedWeight);
  const pesoConsignado = sum(consignadas, pieceReservedWeight);
  return Math.max(0, pesoTotalEntrada - pesoVendidoReal - pesoReservado - pesoConsignado);
}

function productPhysicalStats(product = {}) {
  const produtoId = product.id || productIdFrom(product);
  const pieces = physicalPieces().filter((piece) => pieceIsActive(piece) && String(piece.produtoId || "") === String(produtoId || ""));
  const disponiveis = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "disponivel");
  const consignadas = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "consignado");
  const reservadas = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "reservado");
  const vendidas = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "vendido");
  const pendingOrders = pendingProductionOrders().filter((order) => {
    if (String(order.produtoId || "") === String(produtoId || "")) return true;
    if (compactCode(order.codigo) !== compactCode(product.codigo)) return false;
    const measureA = String(order.medida || "").trim();
    const measureB = String(product.medida || "").trim();
    if (measureA && measureB && measureA !== measureB) return false;
    const matA = normalizeSearchText(order.material || "");
    const matB = normalizeSearchText(product.material || "");
    if (matA && matB && matA !== matB) return false;
    return true;
  });
  const pendingQty = sum(pendingOrders, (order) => productionOrderPendingQuantity(order));
  return {
    produtoId,
    pieces,
    disponiveis,
    consignadas,
    reservadas,
    vendidas,
    totalFisico: pieces.length,
    disponivel: pieces.length ? disponiveis.length : Math.max(0, quantitySafe(product.estoqueDisponivel || 0)),
    consignado: pieces.length ? consignadas.length : Math.max(0, quantitySafe(product.estoqueConsignado || 0)),
    reservado: pieces.length ? reservadas.length : Math.max(0, quantitySafe(product.estoqueReservado || 0)),
    vendido: pieces.length ? vendidas.length : Math.max(0, quantitySafe(product.estoqueVendido || 0)),
    producaoPendente: Math.max(0, quantitySafe(product.estoqueProducaoPendente || product.producaoPendente || 0), pendingQty),
    // V54: peso disponível operacional é contábil.
    // Entrada total - saídas com peso real - reservas - consignações.
    // Ex.: 72g - 1,000g - 0,750g + 4g = 74,250g.
    pesoDisponivel: pieces.length ? accountingAvailableWeightFromPieces({ pieces, vendidas, reservadas, consignadas, product, produtoId }) : numberSafe(product.pesoTotalDisponivel || 0),
    pesoTotalEntrada: pieces.length ? productWeightLedgerSnapshot(produtoId, product, pieces).entrada : numberSafe(product.pesoTotalFisico || product.pesoTotalDisponivel || 0),
    pesoVendidoReal: pieces.length ? productWeightLedgerSnapshot(produtoId, product, pieces).saida : numberSafe(product.pesoTotalVendido || 0),
    lotes: [...new Set(pieces.map((piece) => piece.lote || piece.loteCodigo || "").filter(Boolean))],
    pendingOrders
  };
}

function productSearchPayload(item = {}) {
  const stats = productPhysicalStats(item);
  return normalizeSearchText([
    item.id,
    stats.produtoId,
    item.codigo,
    item.codigoOriginal,
    item.descricao,
    item.tipo,
    item.material,
    item.medida,
    item.fotoOrigem,
    item.origem,
    item.lote,
    item.loteCodigo,
    stats.lotes.join(" "),
    stats.pendingOrders.map((order) => `${order.numeroPedido || ""} ${order.numeroPedidoVenda || ""} ${order.cliente || ""}`).join(" ")
  ].join(" "));
}

function stockRowStatus(row = {}) {
  if (Number(row.alertaGestorPendenteReal || 0) > 0) return "pendente";
  if (Number(row.producaoPendenteReal || 0) > 0) return "pendente";
  if (Number(row.disponivelReal || 0) > 0) return "disponivel";
  if (Number(row.consignadoReal || 0) > 0) return "consignado";
  if (Number(row.vendidoReal || 0) > 0) return "vendido";
  return "zerado";
}

function detailLine(label, value) {
  return `<div><small>${escapeHtml(label)}</small><b>${escapeHtml(value === undefined || value === null || value === "" ? "-" : value)}</b></div>`;
}

function setupProductFilters() {
  const panel = document.querySelector("[data-joias-filter-panel]");
  if (!panel) return;
  const inputCodigo = panel.querySelector("[data-filter-code]");
  const inputGeral = panel.querySelector("[data-filter-text]");
  const material = panel.querySelector("[data-filter-material]");
  const status = panel.querySelector("[data-filter-status]");
  const counter = panel.querySelector("[data-filter-counter]");
  const cards = Array.from(document.querySelectorAll("[data-product-card]"));

  function apply() {
    const codeNeedle = compactCode(inputCodigo?.value || "");
    const textNeedle = normalizeSearchText(inputGeral?.value || "");
    const materialNeedle = normalizeSearchText(material?.value || "");
    const statusNeedle = String(status?.value || "");
    let visible = 0;

    cards.forEach((card) => {
      const codeOk = !codeNeedle || compactCode(card.dataset.code || "").includes(codeNeedle);
      const textOk = !textNeedle || normalizeSearchText(card.dataset.search || "").includes(textNeedle);
      const matOk = !materialNeedle || normalizeSearchText(card.dataset.material || "") === materialNeedle;
      const statusOk = !statusNeedle || String(card.dataset.status || "") === statusNeedle;
      const ok = codeOk && textOk && matOk && statusOk;
      card.hidden = !ok;
      if (ok) visible += 1;
    });

    if (counter) counter.textContent = `${formatNumber(visible, 0)} de ${formatNumber(cards.length, 0)} joias`; 
  }

  [inputCodigo, inputGeral, material, status].forEach((el) => el?.addEventListener("input", apply));
  [material, status].forEach((el) => el?.addEventListener("change", apply));
  panel.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
    if (inputCodigo) inputCodigo.value = "";
    if (inputGeral) inputGeral.value = "";
    if (material) material.value = "";
    if (status) status.value = "";
    apply();
  });
  apply();
}

function setupStockFilters() {
  const panel = document.querySelector("[data-stock-filter-panel]");
  if (!panel) return;
  const code = panel.querySelector("[data-stock-code]");
  const measure = panel.querySelector("[data-stock-measure]");
  const material = panel.querySelector("[data-stock-material]");
  const status = panel.querySelector("[data-stock-status]");
  const text = panel.querySelector("[data-stock-text]");
  const counter = panel.querySelector("[data-stock-counter]");
  const rows = Array.from(document.querySelectorAll("[data-stock-filterable]"));

  function apply() {
    const codeNeedle = compactCode(code?.value || "");
    const measureNeedle = normalizeSearchText(measure?.value || "");
    const materialNeedle = normalizeSearchText(material?.value || "");
    const statusNeedle = String(status?.value || "");
    const textNeedle = normalizeSearchText(text?.value || "");
    let visible = 0;

    rows.forEach((row) => {
      const codeOk = !codeNeedle || compactCode(row.dataset.code || "").includes(codeNeedle);
      const measureOk = !measureNeedle || normalizeSearchText(row.dataset.measure || "") === measureNeedle;
      const materialOk = !materialNeedle || normalizeSearchText(row.dataset.material || "") === materialNeedle;
      const statusOk = !statusNeedle || String(row.dataset.status || "") === statusNeedle;
      const textOk = !textNeedle || normalizeSearchText(row.dataset.search || "").includes(textNeedle);
      const ok = codeOk && measureOk && materialOk && statusOk && textOk;
      row.hidden = !ok;
      if (ok) visible += 1;
    });

    if (counter) counter.textContent = `${formatNumber(visible, 0)} linha(s) exibidas`;
    document.dispatchEvent(new CustomEvent("stock-filter-applied"));
  }

  [code, measure, material, status, text].forEach((el) => el?.addEventListener("input", apply));
  [material, status].forEach((el) => el?.addEventListener("change", apply));
  panel.querySelector("[data-clear-stock-filters]")?.addEventListener("click", () => {
    if (code) code.value = "";
    if (measure) measure.value = "";
    if (material) material.value = "";
    if (status) status.value = "";
    if (text) text.value = "";
    sessionStorage.removeItem("glamore.stock.filter.text");
    sessionStorage.removeItem("glamore.stock.filter.code");
    apply();
  });

  const pendingTextFilter = sessionStorage.getItem("glamore.stock.filter.text");
  const pendingCodeFilter = sessionStorage.getItem("glamore.stock.filter.code");
  if (pendingTextFilter && text) {
    text.value = pendingTextFilter;
    sessionStorage.removeItem("glamore.stock.filter.text");
  }
  if (pendingCodeFilter && code) {
    code.value = pendingCodeFilter;
    sessionStorage.removeItem("glamore.stock.filter.code");
  }

  apply();
  setupStockRulesEditor();
}

function setupStockRulesEditor() {
  const panel = document.querySelector("[data-stock-rules-panel]");
  if (!panel) return;
  const checks = Array.from(document.querySelectorAll("[data-stock-select]"));
  const selectAll = document.querySelector("[data-stock-select-all]");
  const counter = panel.querySelector("[data-stock-selected-count]");
  const critical = panel.querySelector("[data-stock-rule-critical]");
  const ideal = panel.querySelector("[data-stock-rule-ideal]");
  const suggested = panel.querySelector("[data-stock-rule-suggested]");
  const selectFiltered = panel.querySelector("[data-stock-select-filtered]");
  const clearSelection = panel.querySelector("[data-stock-clear-selection]");

  function selectedIds() {
    return checks.filter((el) => el.checked && !el.closest("tr")?.hidden).map((el) => el.value).filter(Boolean);
  }

  function refresh() {
    const count = selectedIds().length;
    if (counter) counter.textContent = `${formatNumber(count, 0)} SKU selecionado(s)`;
    if (selectAll) {
      const visibleChecks = checks.filter((el) => !el.closest("tr")?.hidden);
      const selectedVisible = visibleChecks.filter((el) => el.checked);
      selectAll.checked = Boolean(visibleChecks.length && selectedVisible.length === visibleChecks.length);
      selectAll.indeterminate = Boolean(selectedVisible.length && selectedVisible.length < visibleChecks.length);
    }
  }

  selectAll?.addEventListener("change", () => {
    checks.forEach((el) => { if (!el.closest("tr")?.hidden) el.checked = Boolean(selectAll.checked); });
    refresh();
  });
  checks.forEach((el) => el.addEventListener("change", refresh));
  selectFiltered?.addEventListener("click", () => {
    checks.forEach((el) => { if (!el.closest("tr")?.hidden) el.checked = true; });
    refresh();
  });
  clearSelection?.addEventListener("click", () => {
    checks.forEach((el) => { el.checked = false; });
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
    refresh();
  });
  document.addEventListener("stock-filter-applied", refresh);

  panel.querySelector("[data-apply-stock-rules]")?.addEventListener("click", async () => {
    const ids = selectedIds();
    if (!ids.length) return alert("Selecione pelo menos um SKU na tabela de estoque.");
    const patch = { atualizadoEm: nowIso() };
    if (critical?.value !== "") { patch.estoqueCritico = quantitySafe(critical.value); patch.estoqueMinimo = quantitySafe(critical.value); }
    if (ideal?.value !== "") patch.estoqueIdeal = quantitySafe(ideal.value);
    if (suggested?.value !== "") { patch.estoqueSugestao = quantitySafe(suggested.value); patch.estoqueSugerido = quantitySafe(suggested.value); }
    if (Object.keys(patch).length <= 1) return alert("Informe pelo menos um parâmetro para aplicar.");

    if (!confirm(`Aplicar parâmetros de estoque para ${ids.length} SKU(s) selecionado(s)?`)) return;
    for (const id of ids) {
      await DB.patch("produtos", id, patch);
      localPatchCollection("produtos", id, patch);
    }
    await auditLog("parametros_estoque_em_lote", {
      colecao: "produtos",
      documentoId: ids.join(","),
      motivo: "Edição agrupada de estoque crítico, ideal e sugestão.",
      resumo: `${ids.length} SKU(s) atualizados`,
      depois: { ids, patch }
    });
    await loadData();
    render();
  });
  refresh();
}

function setupSalesFilters() {
  const panel = document.querySelector("[data-sales-filter-panel]");
  if (!panel) return;
  const pedido = panel.querySelector("[data-sales-pedido]");
  const code = panel.querySelector("[data-sales-code]");
  const client = panel.querySelector("[data-sales-client]");
  const status = panel.querySelector("[data-sales-status]");
  const text = panel.querySelector("[data-sales-text]");
  const counter = panel.querySelector("[data-sales-counter]");
  const cards = Array.from(document.querySelectorAll("[data-sale-filterable]"));

  function apply() {
    const pedidoNeedle = normalizeSearchText(pedido?.value || "");
    const codeNeedle = compactCode(code?.value || "");
    const clientNeedle = normalizeSearchText(client?.value || "");
    const statusNeedle = String(status?.value || "");
    const textNeedle = normalizeSearchText(text?.value || "");
    let visible = 0;

    cards.forEach((card) => {
      const pedidoOk = !pedidoNeedle || normalizeSearchText(card.dataset.pedido || "").includes(pedidoNeedle);
      const codeOk = !codeNeedle || compactCode(card.dataset.code || "").includes(codeNeedle);
      const clientOk = !clientNeedle || normalizeSearchText(card.dataset.client || "").includes(clientNeedle);
      const statusOk = !statusNeedle || String(card.dataset.status || "") === statusNeedle;
      const textOk = !textNeedle || normalizeSearchText(card.dataset.search || "").includes(textNeedle);
      const ok = pedidoOk && codeOk && clientOk && statusOk && textOk;
      card.hidden = !ok;
      if (ok) visible += 1;
    });

    if (counter) counter.textContent = `${formatNumber(visible, 0)} de ${formatNumber(cards.length, 0)} venda(s)`;
  }

  [pedido, code, client, status, text].forEach((el) => el?.addEventListener("input", apply));
  status?.addEventListener("change", apply);
  panel.querySelector("[data-clear-sales-filters]")?.addEventListener("click", () => {
    if (pedido) pedido.value = "";
    if (code) code.value = "";
    if (client) client.value = "";
    if (status) status.value = "";
    if (text) text.value = "";
    apply();
  });
  panel.querySelector("[data-open-visible-sales]")?.addEventListener("click", () => {
    cards.forEach((card) => { if (!card.hidden) card.open = true; });
  });
  panel.querySelector("[data-close-visible-sales]")?.addEventListener("click", () => {
    cards.forEach((card) => { if (!card.hidden) card.open = false; });
  });
  apply();
}

function productRows(produtos) {
  if (!produtos.length) return `<div class="empty">Nenhum produto cadastrado ainda.</div>`;

  return `
    <div class="product-card-grid" data-product-list="true">
      ${produtos.map((item) => {
        const stats = productPhysicalStats(item);
        const critical = quantitySafe(stats.disponivel || 0) <= quantitySafe(item.estoqueMinimo || 0);
        const image = item.fotoUrl || item.fotoDataUrl || "";
        const editId = item.id || productIdFrom(item);
        const status = stats.producaoPendente ? "pendente" : critical ? (Number(stats.disponivel || 0) <= 0 ? "zerado" : "critico") : "disponivel";
        const searchPayload = productSearchPayload({ ...item, id: editId });
        return `
          <article class="product-list-card" data-product-card data-code="${escapeHtml(item.codigo || "")}" data-material="${escapeHtml(item.material || "")}" data-medida="${escapeHtml(item.medida || "")}" data-status="${escapeHtml(status)}" data-search="${escapeHtml(searchPayload)}">
            <div class="product-card-head">
              <div class="product-card-photo">
                ${image ? `<img class="product-thumb product-thumb-clean" src="${escapeHtml(image)}" alt="Foto da joia">` : `<div class="product-thumb"></div>`}
              </div>
              <div class="product-card-title">
                <strong>${escapeHtml(item.codigo || "")}</strong>
                <span>${escapeHtml(item.descricao || "")}</span>
                <small>${escapeHtml(item.material || "-")} · medida ${escapeHtml(item.medida || "-")}</small>
              </div>
              <div class="product-card-status">
                ${status === "pendente" ? `<span class="badge warning">Pendências de produção</span>` : critical ? `<span class="badge danger">Crítico</span>` : `<span class="badge success">Disponível</span>`}
              </div>
            </div>

            <div class="product-card-meta product-card-meta-strong">
              <div><small>Disponível real</small><b>${formatNumber(stats.disponivel || 0, 0)}</b></div>
              <div><small>Consignado</small><b>${formatNumber(stats.consignado || 0, 0)}</b></div>
              <div><small>Vendido</small><b>${formatNumber(stats.vendido || 0, 0)}</b></div>
              <div><small>Produção pend.</small><b>${formatNumber(stats.producaoPendente || 0, 0)}</b></div>
              <div><small>Peso disp.</small><b>${formatNumber(stats.pesoDisponivel || 0, 3)} g</b></div>
              <div><small>Lotes</small><b>${escapeHtml(stats.lotes.slice(0, 2).join(", ") || "-")}</b></div>
            </div>

            <details class="product-full-details">
              <summary>Informações completas</summary>
              <div class="detail-grid">
                ${detailLine("ID/SKU", editId)}
                ${detailLine("Código", item.codigo || "")}
                ${detailLine("Descrição", item.descricao || "")}
                ${detailLine("Tipo", item.tipo || "")}
                ${detailLine("Material", item.material || "")}
                ${detailLine("Medida", item.medida || "")}
                ${detailLine("Peso médio", `${formatNumber(item.pesoMedio || 0, 3)} g`)}
                ${detailLine("Estoque mínimo", formatNumber(item.estoqueMinimo || 0, 0))}
                ${detailLine("Modelo estoque", stats.totalFisico ? "Peças físicas" : "Saldo legado")}
                ${detailLine("Peças físicas", formatNumber(stats.totalFisico || 0, 0))}
                ${detailLine("Disponível", formatNumber(stats.disponivel || 0, 0))}
                ${detailLine("Consignado", formatNumber(stats.consignado || 0, 0))}
                ${detailLine("Vendido", formatNumber(stats.vendido || 0, 0))}
                ${detailLine("Pendências de produção", formatNumber(stats.producaoPendente || 0, 0))}
                ${detailLine("Peso disponível", `${formatNumber(stats.pesoDisponivel || 0, 3)} g`)}
                ${detailLine("Lotes", stats.lotes.join(", ") || "-")}
                ${detailLine("Foto origem", item.fotoOrigem || "")}
                ${detailLine("Criado em", formatDate(item.criadoEm))}
                ${detailLine("Atualizado em", formatDate(item.atualizadoEm))}
              </div>
            </details>

            <div class="product-card-actions">
              <button class="btn btn-light btn-sm" type="button" data-edit-product="${escapeHtml(editId)}">Editar joia</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function vendedoresAtivos() {
  return objectToArray(state.data?.vendedores || {})
    .filter((v) => v.ativo !== false)
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
}

function vendedorField(name = "vendedor", col = "col-2", label = "Vendedor") {
  const vendedores = vendedoresAtivos();
  if (!vendedores.length) {
    return `<div class="field ${col}"><label>${label}</label><input name="${name}" placeholder="Nome do vendedor"></div>`;
  }
  return `
    <div class="field ${col}">
      <label>${label}</label>
      <select name="${name}">
        <option value="">Selecione</option>
        ${vendedores.map((v) => `<option value="${escapeHtml(v.nome || "")}">${escapeHtml(v.nome || "")}${v.cargo ? ` · ${escapeHtml(v.cargo)}` : ""}</option>`).join("")}
      </select>
    </div>
  `;
}

function vendedorRows(vendedores) {
  if (!vendedores.length) return `<div class="empty">Nenhum vendedor cadastrado ainda.</div>`;
  const owner = isOwnerUser();
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th>${owner ? "<th>Comissão</th>" : ""}<th>Status</th></tr></thead>
        <tbody>
          ${vendedores.map((v) => `
            <tr>
              <td><strong>${escapeHtml(v.nome || "")}</strong></td>
              <td>${escapeHtml(v.email || "")}</td>
              <td>${escapeHtml(v.cargo || "")}</td>
              ${owner ? `<td>${v.percentualComissao ? `${formatNumber(v.percentualComissao, 2)}%` : "Padrão"}</td>` : ""}
              <td><span class="badge ${v.ativo === false ? "danger" : "success"}">${v.ativo === false ? "Inativo" : "Ativo"}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function clientesAtivos() {
  return objectToArray(state.data.clientes)
    .filter((item) => item.ativo !== false)
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
}

function clienteField(name = "cliente", col = "col-2", label = "Cliente") {
  const clientes = clientesAtivos();
  if (!clientes.length) {
    return `<div class="field ${col}"><label>${label}</label><input name="${name}" placeholder="Nome do cliente"></div>`;
  }
  return `
    <div class="field ${col}">
      <label>${label}</label>
      <select name="${name}">
        <option value="">Selecione</option>
        ${clientes.map((c) => `<option value="${escapeHtml(c.nome || "")}">${escapeHtml(c.nome || "")}${c.cidade ? ` · ${escapeHtml(c.cidade)}` : ""}</option>`).join("")}
      </select>
    </div>
  `;
}

function clienteRows(clientes) {
  if (!clientes.length) return `<div class="empty">Nenhum cliente cadastrado ainda.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cliente</th><th>Documento</th><th>Telefone</th><th>Cidade/UF</th><th>Responsável</th><th>Status</th></tr></thead>
        <tbody>
          ${clientes.map((c) => `
            <tr>
              <td><strong>${escapeHtml(c.nome || "")}</strong><br><small>${escapeHtml(c.email || "")}</small></td>
              <td>${escapeHtml(c.documento || "")}</td>
              <td>${escapeHtml(c.telefone || "")}</td>
              <td>${escapeHtml([c.cidade, c.uf].filter(Boolean).join(" / "))}</td>
              <td>${escapeHtml(c.responsavel || "")}</td>
              <td><span class="badge ${c.ativo === false ? "danger" : "success"}">${c.ativo === false ? "Inativo" : "Ativo"}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function upsertClienteFromPedido(header = {}) {
  const nome = String(header.clienteNome || header.pessoa || "").trim();
  if (!nome) return "";

  const documento = String(header.cnpjCpf || "").trim();
  const existing = objectToArray(state.data.clientes).find((c) =>
    (documento && String(c.documento || "") === documento) ||
    String(c.nome || "").toUpperCase() === nome.toUpperCase()
  );

  const id = existing?.id || uid("cliente");
  const cliente = {
    ...(existing || {}),
    nome,
    documento,
    telefone: header.telefone || existing?.telefone || "",
    endereco: header.endereco || existing?.endereco || "",
    cidade: header.cidade || existing?.cidade || "",
    uf: header.uf || existing?.uf || "",
    origem: existing?.origem || "importacao_pdf",
    ativo: existing?.ativo ?? true,
    atualizadoEm: nowIso(),
    criadoEm: existing?.criadoEm || nowIso()
  };

  await DB.save("clientes", id, cliente);
  state.data.clientes[id] = cliente;
  return id;
}



function dashboardView() {
  const data = state.data;
  const produtos = objectToArray(data.produtos).filter(isValidOperationalItem);
  const vendas = objectToArray(data.vendas);
  const pecas = physicalPieces().filter(pieceIsActive);
  const disponiveis = pecas.filter((p) => pieceStatusValue(p) === "disponivel");
  const vendidas = pecas.filter((p) => pieceStatusValue(p) === "vendido");
  const managerAlerts = pendingManagerStockAlerts();
  const managerAlertQty = sum(managerAlerts, (alert) => alert.quantidadeFaltante || alert.quantidadePendenteAnalise || 0);
  const stockRows = physicalStockRows();
  const criticalRows = criticalProducts({ ...data, produtos: Object.fromEntries(stockRows.map((row) => [row.id || row.produtoId, { ...row, estoqueDisponivel: row.disponivelReal }])) });
  const disponivelTotal = pecas.length ? disponiveis.length : sum(produtos, (p) => p.estoqueDisponivel);
  const vendidoTotal = pecas.length ? vendidas.length : sum(produtos, (p) => p.estoqueVendido);

  shell(`
    <section class="executive-hero clean-hero">
      <div>
        <span class="eyebrow">Painel operacional</span>
        <h2>O que tem, o que vendeu e o que precisa de decisão.</h2>
        <p>Visão limpa para o gestor acompanhar estoque, vendas e alertas sem abrir relatórios técnicos.</p>
      </div>
      <div class="owner-hero-actions">
        <a class="btn btn-gold" href="#/importacao">Importar PDF</a>
        <a class="btn btn-light" href="#/estoque">Consultar estoque</a>
        <a class="btn btn-primary" href="#/alertas">Ver alertas</a>
      </div>
    </section>

    <div class="owner-kpi-grid compact clean-kpis">
      <a class="owner-kpi-card" href="#/estoque"><span>Disponível</span><strong>${formatNumber(disponivelTotal, 0)}</strong><small>peças em estoque</small></a>
      <a class="owner-kpi-card" href="#/vendas"><span>Vendido</span><strong>${formatNumber(vendidoTotal, 0)}</strong><small>peças baixadas</small></a>
      <a class="owner-kpi-card attention" href="#/alertas"><span>Alertas urgentes</span><strong>${formatNumber(managerAlertQty, 0)}</strong><small>${formatNumber(managerAlerts.length, 0)} item(ns) para decisão</small></a>
      <a class="owner-kpi-card" href="#/estoque"><span>Abaixo do crítico</span><strong>${formatNumber(criticalRows.length, 0)}</strong><small>SKU(s) para reposição</small></a>
    </div>

    <div class="quick-action-grid">
      <a href="#/importacao" class="quick-action-card"><b>1</b><strong>Importar inventário</strong><span>Entrada de estoque, com bloqueio de duplicidade.</span></a>
      <a href="#/importacao" class="quick-action-card"><b>2</b><strong>Importar venda</strong><span>Baixa o que existe e alerta o que falta.</span></a>
      <a href="#/estoque" class="quick-action-card"><b>3</b><strong>Consultar peça</strong><span>Busca por código, medida e material.</span></a>
      <a href="#/alertas" class="quick-action-card"><b>4</b><strong>Decidir pendências</strong><span>Produzir, comprar, ajustar ou cancelar.</span></a>
    </div>

    <div class="grid grid-2 owner-main-grid">
      <div class="card clean-panel">
        <div class="card-head"><div><h2>Alertas do gestor</h2><p>Faltas de venda sem baixa automática nem estoque negativo.</p></div><a class="btn btn-light btn-sm" href="#/alertas">Abrir</a></div>
        ${managerAlertCards(managerAlerts.slice(0, 4))}
      </div>
      <div class="card clean-panel">
        <div class="card-head"><div><h2>Reposição preventiva</h2><p>SKUs abaixo do crítico configurado.</p></div><a class="btn btn-light btn-sm" href="#/estoque">Ver estoque</a></div>
        ${criticalSummaryCards(criticalRows.slice(0, 6))}
      </div>
    </div>
  `);
}

function normalizeImportType(tipo = "") {
  const value = String(tipo || "").trim();
  if (value === "cadastro_mostruario") return "catalogo_pecas";
  if (["pedido_estoque", "estoque", "estoque_atual", "inventario", "inventario_estoque"].includes(value)) return "estoque_atual";
  if (["pedido_venda_inteligente", "venda_inteligente", "venda_sob_encomenda", "venda_com_reserva"].includes(value)) return "venda_inteligente";
  return value || "catalogo_pecas";
}

function normalizeStockCode(value = "") {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function isValidOperationalItem(item = {}) {
  const code = normalizeStockCode(item.codigo || item.codigoOriginal || item.id || "");
  if (!code) return false;
  if (/(SUBTOTAL|TOTAL|FRETE|ACRESCIMO|ACRÉSCIMO|BRITS|PEDRAS|OUTRAS|PEDIDO|RELATORIO|RELATÓRIO|HTTP|WWW|POWERED|DOCUMENTO)/i.test(code)) return false;
  if (String(item.descricao || "").match(/SubTotal|Total Pedido|Qtd de Item|Qtd Peça|Frete|Acr[eé]scimo/i)) return false;
  return true;
}

function isCatalogImport(tipo = "") {
  return ["catalogo_pecas", "cadastro_mostruario"].includes(normalizeImportType(tipo));
}

function isStockImport(tipo = "") {
  return normalizeImportType(tipo) === "estoque_atual";
}

function isProductionOrderImport(tipo = "") {
  return normalizeImportType(tipo) === "pedido_producao";
}

function isProductionReadyImport(tipo = "") {
  return normalizeImportType(tipo) === "producao_pronta";
}

function isCommercialImport(tipo = "") {
  const normalized = normalizeImportType(tipo);
  return normalized === "venda_final" || normalized === "venda_inteligente" || normalized === "consignacao";
}

function isOperationalStockEntry(tipo = "") {
  return isStockImport(tipo) || isProductionReadyImport(tipo);
}

function pdfFileFromForm(formEl) {
  const input = formEl?.querySelector?.('input[name="pdf"]');
  const selected = input?.files?.[0];
  const fallback = new FormData(formEl).get("pdf");
  const file = selected || fallback;

  if (!file || typeof file.arrayBuffer !== "function" || !file.name) {
    throw new Error("Nenhum PDF foi encontrado no campo de arquivo. Selecione o PDF novamente e clique em Extrair PDF.");
  }

  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  if (!name.endsWith(".pdf") && !type.includes("pdf")) {
    throw new Error("O arquivo selecionado não parece ser PDF. Selecione um arquivo .pdf válido.");
  }

  if (Number(file.size || 0) <= 0) {
    throw new Error("O PDF selecionado está vazio. Selecione o arquivo correto novamente.");
  }

  return file;
}

function generatedLotCode(item = {}, parsed = {}) {
  const parts = [
    parsed.header?.numeroPedido || "PDF",
    item.codigo || "SEM_CODIGO",
    item.medida || "SEM_MEDIDA",
    item.material || "SEM_MATERIAL",
    item.sequencia || uid("seq")
  ];
  return parts.join("-").replace(/\s+/g, "_").replace(/[^A-Za-z0-9_/-]+/g, "");
}

function findProductionOrderMatch(produtoId = "") {
  const pedidosProducao = objectToArray(state.data?.pedidosProducao || {});
  return pedidosProducao
    .filter((item) => item.produtoId === produtoId && String(item.status || "pendente") !== "concluido")
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")))[0] || null;
}

async function registerLotEntry({ produtoId, item, parsed, tipo, quantidade, pesoTotal, pesoUnitario, pedidoId, producaoId = "", pedidoProducaoId = "", status = "disponivel" }) {
  const loteCodigo = item.lote || generatedLotCode(item, parsed);
  const lote = {
    lote: loteCodigo,
    produtoId,
    codigo: item.codigo || "",
    descricao: item.descricao || "",
    medida: item.medida || "",
    material: item.material || "",
    tipoMovimento: tipo,
    status,
    quantidadeEntrada: quantitySafe(quantidade || 0),
    quantidadeDisponivel: status === "disponivel" ? quantitySafe(quantidade || 0) : 0,
    pesoUnitario: numberSafe(pesoUnitario || 0),
    pesoTotal: numberSafe(pesoTotal || 0),
    pedidoId: pedidoId || "",
    producaoId: producaoId || "",
    pedidoProducaoId: pedidoProducaoId || "",
    origem: "pdf",
    arquivoNome: parsed.arquivoNome || "",
    criadoEm: nowIso(),
    criadoPor: state.user?.email || ""
  };
  const loteId = await DB.push("lotes", lote);
  localSetCollection("lotes", loteId, lote);
  return loteId;
}


/**
 * V24 — Estoque real por peça física única.
 *
 * Produto/SKU é apenas cadastro técnico: código + medida + material.
 * Estoque real fica em pecasEstoque, onde cada unidade física tem ID próprio,
 * lote, peso real, peso pedido/previsto e status operacional.
 */
function pieceIsActive(piece = {}) {
  return !["substituida_por_inventario", "cancelada", "excluida", "cancelado", "excluido", "arquivada", "arquivado", "estornada", "estornado"].includes(String(piece.status || "").toLowerCase());
}

function pieceStatusValue(piece = {}) {
  return String(piece.status || piece.situacao || "disponivel").toLowerCase();
}

function pieceStatusLabel(status = "") {
  const value = String(status || "disponivel").toLowerCase();
  const labels = {
    disponivel: "Disponível",
    consignado: "Consignado",
    vendido: "Vendido",
    reservado: "Reservado",
    substituida_por_inventario: "Substituída por inventário",
    cancelada: "Cancelada"
  };
  return labels[value] || status || "Disponível";
}

function physicalPieces() {
  return objectToArray(state.data?.pecasEstoque || {});
}

function physicalPiecesForProduct(produtoId) {
  return physicalPieces().filter((piece) => piece.produtoId === produtoId && pieceIsActive(piece));
}

function availablePiecesForProduct(produtoId) {
  return physicalPiecesForProduct(produtoId).filter((piece) => String(piece.status || "disponivel").toLowerCase() === "disponivel");
}

function technicalWeightValue(item = {}) {
  return unitWeightFromLine(item);
}

function normalizedWeightKey(value = 0) {
  const num = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value || 0);
  return Number.isFinite(num) && num > 0 ? num.toFixed(3) : "SEM_PESO";
}

function extractLojaEnvFromText(text = "") {
  const value = String(text || "");
  const lojaMatch = value.match(/\bLOJA\s*([0-9]{1,5}(?:[-/][0-9]{1,5})?)\b/i);
  const envMatch = value.match(/\bENV\s*([0-9]{3,})\b/i);
  return {
    lojaCodigo: lojaMatch ? lojaMatch[1].trim() : "",
    envCodigo: envMatch ? envMatch[1].trim() : ""
  };
}

function technicalLojaEnvValue(item = {}) {
  const text = [
    item.lojaCodigo,
    item.codigoLoja,
    item.envCodigo,
    item.codigoEnv,
    item.referenciaLojaEnv,
    item.observacao,
    item.observacoes,
    item.observacaoTecnica,
    item.observacoesAgrupadas,
    ...(Array.isArray(item.linhasOriginais) ? item.linhasOriginais.map((line) => `${line.observacao || ""} ${line.referenciaLojaEnv || ""} ${line.lojaCodigo || ""} ${line.envCodigo || ""}`) : [])
  ].filter(Boolean).join("\n");
  const extracted = extractLojaEnvFromText(text);
  return {
    lojaCodigo: String(item.lojaCodigo || item.codigoLoja || extracted.lojaCodigo || "").trim(),
    envCodigo: String(item.envCodigo || item.codigoEnv || extracted.envCodigo || "").trim()
  };
}

function technicalLojaEnvLabel(item = {}) {
  const ref = technicalLojaEnvValue(item);
  return [
    ref.lojaCodigo ? `LOJA ${ref.lojaCodigo}` : "",
    ref.envCodigo ? `ENV ${ref.envCodigo}` : ""
  ].filter(Boolean).join(" / ");
}

function technicalLotValue(item = {}) {
  const raw = String(item.lote || item.loteCodigo || item.loteReferencia || item.numeroLote || "").trim();
  // V37: evita manter o falso lote "OJA" criado por leitura de LOJA.
  if (/^OJA$/i.test(raw) && /\bLOJA\b/i.test(String(item.observacao || item.observacaoTecnica || item.referenciaLojaEnv || ""))) return "";
  return raw;
}

function saleStockKey(item = {}) {
  const base = [
    productIdFrom(item),
    normalizeSearchText(item.descricao || item.descricaoTecnica || "SEM_DESCRICAO").replace(/\s+/g, "_")
  ];
  return base.join("__");
}

function technicalVariantKey(item = {}, { includeLot = true, includeWeight = true, mode = "technical" } = {}) {
  if (mode === "sale_stock" || includeWeight === false) {
    return saleStockKey(item);
  }
  const parts = [
    productIdFrom(item),
    `PESO_${normalizedWeightKey(technicalWeightValue(item))}`
  ];
  if (includeLot) parts.push(`LOTE_${normalizeSearchText(technicalLotValue(item) || "SEM_LOTE").replace(/\s+/g, "_")}`);
  return parts.join("__");
}

function technicalVariantLabel(item = {}, options = {}) {
  const peso = technicalWeightValue(item);
  const lote = technicalLotValue(item);
  const lojaEnv = technicalLojaEnvLabel(item);
  const parts = [
    item.codigo || item.codigoOriginal || "",
    item.medida ? `Nº ${item.medida}` : "",
    item.material || ""
  ];
  if (options.includeWeight === false) {
    parts.push("baixa por SKU");
  } else {
    parts.push(peso ? `${formatNumber(peso, 3)} g` : "sem peso");
  }
  if (lote) parts.push(`lote ${lote}`);
  if (lojaEnv) parts.push(lojaEnv);
  return parts.filter(Boolean).join(" · ");
}

function technicalCriteriaFromItem(item = {}, { includeLot = false, tolerance = 0.0005, matchByWeight = true } = {}) {
  const pesoUnitario = technicalWeightValue(item);
  const lojaEnv = technicalLojaEnvValue(item);
  return {
    matchByWeight: matchByWeight !== false,
    pesoUnitario: matchByWeight === false ? 0 : pesoUnitario,
    pesoKey: matchByWeight === false ? "IGNORADO" : normalizedWeightKey(pesoUnitario),
    pesoReferenciaPdf: pesoUnitario,
    lote: includeLot ? technicalLotValue(item) : "",
    lojaCodigo: lojaEnv.lojaCodigo,
    envCodigo: lojaEnv.envCodigo,
    referenciaLojaEnv: technicalLojaEnvLabel(item),
    toleranciaPeso: tolerance,
    chaveTecnica: technicalVariantKey(item, { includeLot, includeWeight: matchByWeight !== false, mode: matchByWeight === false ? "sale_stock" : "technical" }),
    descricaoTecnica: technicalVariantLabel(item, { includeWeight: matchByWeight !== false })
  };
}

function pieceMatchesTechnicalCriteria(piece = {}, criteria = {}) {
  const shouldMatchWeight = criteria.matchByWeight !== false;
  const targetWeight = numberSafe(criteria.pesoUnitario || 0);
  const tolerance = numberSafe(criteria.toleranciaPeso ?? 0.0005);
  if (shouldMatchWeight && targetWeight > 0) {
    const pieceWeight = technicalWeightValue(piece);
    if (!pieceWeight || Math.abs(pieceWeight - targetWeight) > tolerance) return false;
  }

  const wantedLot = String(criteria.lote || "").trim();
  if (wantedLot) {
    const pieceLot = technicalLotValue(piece);
    if (normalizeSearchText(pieceLot) !== normalizeSearchText(wantedLot)) return false;
  }

  return true;
}

function availablePiecesForProductVariant(produtoId, criteria = {}) {
  return availablePiecesForProduct(produtoId).filter((piece) => pieceMatchesTechnicalCriteria(piece, criteria));
}


function normalizeOperationalText(value = "") {
  return normalizeSearchText(value || "").replace(/\s+/g, " ").trim();
}

function operationalSaleDescriptionCompatible(item = {}, product = {}, piece = {}) {
  const itemDesc = normalizeOperationalText(item.descricao || item.descricaoTecnica || "");
  const productDesc = normalizeOperationalText(product.descricao || piece.descricao || "");
  if (!itemDesc || !productDesc) return true;
  if (itemDesc === productDesc) return true;
  return itemDesc.includes(productDesc) || productDesc.includes(itemDesc);
}

function operationalSalePieceMatchesItem(piece = {}, item = {}, preferredProdutoId = "") {
  if (!piece || pieceStatusValue(piece) !== "disponivel") return false;
  const product = state.data?.produtos?.[piece.produtoId] || {};

  const pieceLike = {
    codigo: product.codigo || piece.codigo || piece.codigoOriginal || "",
    codigoOriginal: product.codigoOriginal || piece.codigoOriginal || piece.codigo || "",
    descricao: product.descricao || piece.descricao || "",
    medida: product.medida || piece.medida || "",
    material: product.material || piece.material || ""
  };

  const itemCode = normalizeStockCode(item.codigo || item.codigoOriginal || "");
  const pieceCode = normalizeStockCode(pieceLike.codigo || pieceLike.codigoOriginal || "");
  if (!itemCode || !pieceCode || itemCode !== pieceCode) return false;

  const itemMedida = normalizeLooseMedida(item.medida || inferMedida(`${item.codigoOriginal || ""} ${item.descricao || ""} ${item.observacao || ""}`));
  const pieceMedida = normalizeLooseMedida(pieceLike.medida || "");
  if (itemMedida && pieceMedida && itemMedida !== pieceMedida) return false;

  const itemMaterial = item.material || inferMaterial(`${item.codigoOriginal || ""} ${item.descricao || ""} ${item.observacao || ""}`);
  const pieceMaterial = pieceLike.material || "";
  if (!compatibleMaterial(itemMaterial, pieceMaterial)) return false;

  if (!operationalSaleDescriptionCompatible(item, product, piece)) return false;

  return true;
}

function availablePiecesForSaleOperationalItem(item = {}, preferredProdutoId = "") {
  const available = physicalPieces().filter((piece) => pieceIsActive(piece) && pieceStatusValue(piece) === "disponivel");
  const targetWeight = numberSafe(item.pesoUnitarioRealVenda ?? item.pesoUnitarioVenda ?? item.pesoRealVenda ?? 0);
  return available
    .filter((piece) => operationalSalePieceMatchesItem(piece, item, preferredProdutoId))
    .sort((a, b) => {
      const aExact = preferredProdutoId && a.produtoId === preferredProdutoId ? 1 : 0;
      const bExact = preferredProdutoId && b.produtoId === preferredProdutoId ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      // V53: quando o usuário informa peso real da venda, escolhe primeiro a peça física com peso mais próximo.
      // Isso evita baixar uma peça de 1,000 g quando existe peça de 0,750 g disponível.
      if (targetWeight > 0) {
        const aDiff = Math.abs(numberSafe(a.pesoReal || a.pesoUnitario || 0) - targetWeight);
        const bDiff = Math.abs(numberSafe(b.pesoReal || b.pesoUnitario || 0) - targetWeight);
        if (aDiff !== bDiff) return aDiff - bDiff;
      }

      return String(a.criadoEm || a.id || "").localeCompare(String(b.criadoEm || b.id || ""));
    });
}

async function moveSpecificPhysicalPiecesToSold({
  pieces = [],
  vendaId = "",
  documentoId = "",
  origem = "venda_inteligente_pdf",
  observacao = "",
  numeroPedidoVenda = "",
  clienteVenda = "",
  vendedorVenda = "",
  pesoUnitarioBaixa = 0,
  pesoTotalBaixa = 0
} = {}) {
  const moved = [];
  const qtd = Math.max(1, (pieces || []).filter((piece) => piece?.id).length);
  const pesoUnitarioInformado = numberSafe(pesoUnitarioBaixa || 0);
  const pesoTotalInformado = numberSafe(pesoTotalBaixa || 0);
  const pesoUnitarioFinal = pesoTotalInformado > 0 ? pesoTotalInformado / qtd : pesoUnitarioInformado;
  const pesoGrupoFinal = pesoTotalInformado > 0 ? pesoTotalInformado : (pesoUnitarioFinal > 0 ? pesoUnitarioFinal * qtd : 0);

  for (const piece of pieces || []) {
    if (!piece?.id) continue;
    const pesoOriginal = numberSafe(piece.pesoReal || piece.pesoUnitario || 0);
    const pesoBaixaReal = pesoUnitarioFinal || pesoOriginal;
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: "vendido",
      documentoBaixaId: vendaId || documentoId || "",
      vendaId: vendaId || "",
      pedidoVendaId: documentoId || vendaId || "",
      numeroPedidoVenda: numeroPedidoVenda || documentoId || vendaId || "",
      pedidoVendaNumero: numeroPedidoVenda || documentoId || vendaId || "",
      clienteVenda: clienteVenda || "",
      vendedorVenda: vendedorVenda || "",
      pesoOriginalAntesBaixa: pesoOriginal,
      pesoBaixaReal,
      pesoUnitarioBaixa: pesoBaixaReal,
      pesoTotalBaixado: pesoBaixaReal,
      pesoTotalVendaGrupo: pesoGrupoFinal,
      quantidadeVendaGrupo: qtd,
      pesoBaixaRateado: qtd > 1,
      pesoIndividualVendaConhecido: qtd === 1,
      pesoVendaInformado: pesoUnitarioInformado > 0 || pesoTotalInformado > 0,
      baixaOrigem: origem || "venda_inteligente_pdf",
      baixaObservacao: observacao || "Baixa automática por venda inteligente.",
      baixadaEm: nowIso(),
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", piece.id, patch);
    localPatchCollection("pecasEstoque", piece.id, patch);
    moved.push({ id: piece.id, produtoId: piece.produtoId || "", pesoBaixaReal, numeroPedidoVenda: patch.numeroPedidoVenda });
  }

  const affectedProductIds = [...new Set(moved.map((piece) => piece.produtoId).filter(Boolean))];
  for (const id of affectedProductIds) {
    const product = state.data?.produtos?.[id];
    if (product) await syncProductAggregateFromPieces(id, product);
  }

  return moved;
}

function parsePieceWeights(value = "", quantidade = 0) {
  const raw = Array.isArray(value) ? value.join("; ") : String(value || "");

  // V51 — NÃO separar decimal por vírgula.
  // Antes, "0,75; 0,80" podia virar tokens quebrados ou NaN em alguns fluxos.
  // Agora reconhece números com vírgula decimal, ponto decimal, unidade "gr/g" e listas por ; | / quebra de linha.
  const matches = raw.match(/-?\d+(?:[.,]\d+)?\s*(?:gr|g)?/gi) || [];
  const weights = matches
    .map((item) => numberSafe(item))
    .filter((num) => Number.isFinite(num) && num > 0);

  if (quantidade && weights.length > quantidade) return weights.slice(0, quantidade);
  return weights;
}

function localSetCollection(collection, id, value) {
  if (!state.data) return;
  state.data[collection] = state.data[collection] || {};
  state.data[collection][id] = { ...(value || {}) };
}

function localPatchCollection(collection, id, patch) {
  if (!state.data) return;
  state.data[collection] = state.data[collection] || {};
  state.data[collection][id] = { ...(state.data[collection][id] || {}), ...(patch || {}) };
}

function productPhysicalSummary(produtoId, fallbackProduct = {}) {
  const pieces = physicalPiecesForProduct(produtoId);
  const disponiveis = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "disponivel");
  const consignadas = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "consignado");
  const reservadas = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "reservado");
  const vendidas = pieces.filter((piece) => String(piece.status || "").toLowerCase() === "vendido");
  const ledger = productWeightLedgerSnapshot(produtoId, fallbackProduct, pieces);
  return {
    totalPecasFisicas: pieces.length,
    disponivel: disponiveis.length,
    consignado: consignadas.length,
    reservado: reservadas.length,
    vendido: vendidas.length,
    pesoDisponivel: ledger.disponivel,
    pesoTotal: ledger.entrada,
    pesoVendido: ledger.saida,
    pesoMedioDisponivel: disponiveis.length ? ledger.disponivel / disponiveis.length : numberSafe(fallbackProduct.pesoMedio || 0),
    lotes: [...new Set(pieces.map((piece) => piece.lote || piece.loteCodigo).filter(Boolean))]
  };
}

async function syncProductAggregateFromPieces(produtoId, product = {}) {
  const summary = productPhysicalSummary(produtoId, product);
  const hasPhysicalHistory = physicalPieces().some((piece) => String(piece.produtoId || "") === String(produtoId || ""));

  // V63 — se o SKU já teve peças físicas, a ausência de peças ativas significa
  // estoque físico zero. Antes a função retornava sem salvar e deixava quantidade
  // e peso antigos no cadastro após o estorno integral do inventário.
  if (!summary.totalPecasFisicas && !hasPhysicalHistory) return product;

  product.estoqueDisponivel = summary.disponivel;
  product.estoqueConsignado = summary.consignado;
  product.estoqueReservado = summary.reservado;
  product.estoqueVendido = summary.vendido;
  product.pesoTotalDisponivel = summary.pesoDisponivel;
  product.pesoTotalFisico = summary.pesoTotal;
  product.pesoTotalVendido = numberSafe(summary.pesoVendido || 0);
  if (summary.pesoMedioDisponivel) product.pesoMedio = summary.pesoMedioDisponivel;
  product.pesoMedioContabil = summary.pesoMedioDisponivel || 0;
  product.pecasFisicasAtivas = summary.totalPecasFisicas;
  product.lotesAtivos = summary.lotes;
  product.estoqueModelo = "peca_fisica_unica";
  product.atualizadoEm = nowIso();

  await DB.save("produtos", produtoId, product);
  localSetCollection("produtos", produtoId, product);
  return product;
}

async function ensureLegacyPhysicalPieces(produtoId, product = {}) {
  const existing = physicalPiecesForProduct(produtoId);
  const disponivelAtual = Math.max(0, Math.round(quantitySafe(product.estoqueDisponivel || 0)));
  if (existing.length || !disponivelAtual) return;

  const item = {
    codigo: product.codigo || "",
    codigoOriginal: product.codigoOriginal || product.codigo || "",
    descricao: product.descricao || "",
    medida: product.medida || "",
    material: product.material || "",
    tipo: product.tipo || "",
    fotoUrl: product.fotoUrl || "",
    peso: numberSafe(product.pesoMedio || 0),
    lote: "LEGADO-INICIAL"
  };

  await createPhysicalPieces({
    produtoId,
    item,
    parsed: { header: { numeroPedido: "LEGADO" }, arquivoNome: "saldo legado do produto" },
    origem: "saldo_legado_convertido_v24",
    status: "disponivel",
    quantidade: disponivelAtual,
    pesoUnitario: numberSafe(product.pesoMedio || 0),
    pesoTotal: numberSafe(product.pesoMedio || 0) * disponivelAtual,
    pedidoId: "",
    loteId: "",
    loteCodigo: "LEGADO-INICIAL",
    observacao: "Peças físicas criadas automaticamente a partir do saldo disponível legado para preservar o estoque antes da V24."
  });
}

function pieceWeightForIndex({ item = {}, index = 0, quantidade = 1, pesoUnitario = 0, pesoTotal = 0 }) {
  const pesos = Array.isArray(item.pesosReais)
    ? item.pesosReais
    : parsePieceWeights(item.pesosReais || item.pesos || "", quantidade);
  if (pesos[index]) return numberSafe(pesos[index]);
  if (pesoUnitario) return numberSafe(pesoUnitario);
  if (item.pesoReal) return numberSafe(item.pesoReal);
  if (item.peso) return numberSafe(item.peso);
  if (pesoTotal && quantidade) return numberSafe(pesoTotal) / numberSafe(quantidade);
  return 0;
}

async function createPhysicalPieces({
  produtoId,
  item = {},
  parsed = {},
  origem = "manual",
  status = "disponivel",
  quantidade = 1,
  pesoUnitario = 0,
  pesoTotal = 0,
  pesoUnitarioPedido = 0,
  pedidoId = "",
  producaoId = "",
  pedidoProducaoId = "",
  inventarioId = "",
  loteId = "",
  loteCodigo = "",
  observacao = "",
  pesoIndividualConhecido = undefined
}) {
  const qtd = Math.max(0, Math.round(numberSafe(quantidade || item.quantidade || 1)));
  const lote = loteCodigo || item.lote || generatedLotCode(item, parsed);
  const ids = [];

  const pesosIndividuais = Array.isArray(item.pesosReais)
    ? item.pesosReais.map(numberSafe).filter((value) => value > 0)
    : parsePieceWeights(item.pesosReais || item.pesos || "", qtd);
  const individualKnown = pesoIndividualConhecido !== undefined
    ? pesoIndividualConhecido === true
    : (pesosIndividuais.length >= qtd || (numberSafe(pesoUnitario || 0) > 0 && numberSafe(pesoTotal || 0) <= 0));

  for (let index = 0; index < qtd; index++) {
    const pesoRealCalculado = pieceWeightForIndex({ item, index, quantidade: qtd, pesoUnitario, pesoTotal });
    const pesoReal = individualKnown ? pesoRealCalculado : 0;
    const pesoPedido = numberSafe(pesoUnitarioPedido || item.pesoUnitarioPedido || item.pesoPrevisto || 0);
    const pesoTotalLinha = lineWeightTotal({ ...item, pesoTotalLinha: pesoTotal || item.pesoTotalLinha || item.pesoTotalReferencia || item.peso }, qtd);
    const pesoUnitarioEstimado = qtd > 0 && pesoTotalLinha > 0 ? pesoTotalLinha / qtd : numberSafe(pesoUnitario || item.pesoUnitarioEstimado || pesoRealCalculado || 0);
    const peca = {
      pecaCodigo: uid("PEC"),
      indiceNoLote: index + 1,
      produtoId,
      codigo: item.codigo || "",
      codigoOriginal: item.codigoOriginal || item.codigo || "",
      descricao: item.descricao || "",
      tipo: item.tipo || inferTipo(item.descricao || "", item.codigo || ""),
      medida: item.medida || "",
      material: item.material || "",
      fotoUrl: item.fotoUrl || item.fotoDataUrl || "",
      loteId: loteId || "",
      lote,
      loteCodigo: lote,
      status,
      statusAnterior: "",
      pesoReal,
      pesoUnitario: pesoReal,
      pesoIndividualConhecido: individualKnown && pesoReal > 0,
      pesoControleModo: individualKnown && pesoReal > 0 ? "individual_real" : "total_lote",
      pesoRateioReferencia: individualKnown ? 0 : pesoUnitarioEstimado,
      pesoUnitarioEstimado,
      pesoTotalLinha,
      pesoPedido,
      pesoPrevisto: pesoPedido,
      diferencaPeso: pesoPedido ? pesoReal - pesoPedido : 0,
      pedidoId: pedidoId || "",
      producaoId: producaoId || "",
      pedidoProducaoId: pedidoProducaoId || "",
      inventarioId: inventarioId || "",
      origem,
      origemDocumento: parsed.arquivoNome || "",
      pedidoPdfNumero: parsed.header?.numeroPedido || "",
      observacao: observacao || item.observacao || "",
      criadoEm: nowIso(),
      criadoPor: state.user?.email || "",
      criadoPorUid: state.user?.uid || ""
    };

    const id = await DB.push("pecasEstoque", peca);
    ids.push(id);
    localSetCollection("pecasEstoque", id, peca);
  }

  return ids;
}

async function archiveAvailablePiecesForInventory(produtoId, inventarioId = "") {
  const disponiveis = availablePiecesForProduct(produtoId);

  for (const piece of disponiveis) {
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: "substituida_por_inventario",
      substituidaPorInventarioId: inventarioId,
      substituidaEm: nowIso(),
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", piece.id, patch);
    localPatchCollection("pecasEstoque", piece.id, patch);
  }

  return disponiveis.length;
}

async function movePhysicalPieces({ produtoId, quantidade = 1, novoStatus, documentoId = "", origem = "", observacao = "", technicalCriteria = {} }) {
  const qtd = Math.max(0, Math.round(quantitySafe(quantidade || 0)));
  const disponiveis = availablePiecesForProductVariant(produtoId, technicalCriteria).slice(0, qtd);
  const moved = [];

  for (const piece of disponiveis) {
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: novoStatus,
      documentoBaixaId: documentoId || "",
      baixaOrigem: origem || "",
      baixaObservacao: observacao || "",
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", piece.id, patch);
    localPatchCollection("pecasEstoque", piece.id, patch);
    moved.push(piece.id);
  }

  return moved;
}

async function reservePhysicalPieces({ produtoId, quantidade = 1, vendaId = "", pedidoId = "", origem = "venda_inteligente", observacao = "", technicalCriteria = {} }) {
  const qtd = Math.max(0, Math.round(quantitySafe(quantidade || 0)));
  const disponiveis = availablePiecesForProductVariant(produtoId, technicalCriteria).slice(0, qtd);
  const moved = [];

  for (const piece of disponiveis) {
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: "reservado",
      documentoReservaId: vendaId || pedidoId || "",
      vendaId: vendaId || "",
      pedidoVendaId: pedidoId || "",
      reservaOrigem: origem || "venda_inteligente",
      reservaObservacao: observacao || "Peça reservada automaticamente para pedido de venda inteligente.",
      reservadoEm: nowIso(),
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", piece.id, patch);
    localPatchCollection("pecasEstoque", piece.id, patch);
    moved.push(piece.id);
  }

  return moved;
}

function reservedPiecesForSale(vendaId = "", produtoId = "") {
  const id = String(vendaId || "");
  return physicalPieces()
    .filter((piece) => String(piece.status || "").toLowerCase() === "reservado")
    .filter((piece) => !produtoId || piece.produtoId === produtoId)
    .filter((piece) => [piece.vendaId, piece.documentoReservaId, piece.pedidoVendaId].map(String).includes(id));
}

async function finalizeReservedPiecesForSale({ vendaId = "", pedidoId = "", produtoId = "", observacao = "" } = {}) {
  if (!vendaId) return [];
  const venda = state.data?.vendas?.[vendaId];
  if (!venda) return [];
  const pendente = quantitySafe(venda.quantidadePendenteProducao || 0);
  if (pendente > 0) return [];

  const reservadas = reservedPiecesForSale(vendaId, produtoId || venda.produtoId || "");
  if (!reservadas.length) return [];

  const ids = reservadas.map((piece) => piece.id);
  const moved = await markSpecificPiecesAsSold(ids, {
    vendaId,
    pedidoId: pedidoId || venda.pedidoId || venda.origemDocumentoId || "",
    origem: "venda_inteligente_reserva_finalizada",
    observacao: observacao || "Peça reservada confirmada como venda após atendimento da produção pendente."
  });

  const solicitada = quantitySafe(venda.quantidadeSolicitada || venda.quantidade || 0);
  const baixadaAtual = quantitySafe(venda.quantidadeBaixada || 0);
  const baixadaNova = Math.min(solicitada, baixadaAtual + moved.length);
  const patch = {
    quantidadeBaixada: baixadaNova,
    quantidadeReservada: Math.max(0, quantitySafe(venda.quantidadeReservada || 0) - moved.length),
    quantidadeReservadaFinalizada: quantitySafe(venda.quantidadeReservadaFinalizada || 0) + moved.length,
    pecasBaixadas: [...(venda.pecasBaixadas || []), ...moved],
    statusEstoque: stockStatusFromQuantities({ solicitada, baixada: baixadaNova, faltante: 0 }),
    status: baixadaNova >= solicitada ? "finalizada" : "reservada",
    atualizadoEm: nowIso()
  };

  await DB.patch("vendas", vendaId, patch);
  localPatchCollection("vendas", vendaId, patch);
  return moved;
}

function physicalStockRows() {
  const produtos = objectToArray(state.data.produtos).filter(isValidOperationalItem);
  const pieces = physicalPieces().filter(isValidOperationalItem);

  const byProduct = new Map();
  produtos.forEach((product) => {
    byProduct.set(product.id, {
      ...product,
      produtoId: product.id,
      totalPecasFisicas: 0,
      disponivelFisico: 0,
      reservadoFisico: 0,
      consignadoFisico: 0,
      vendidoFisico: 0,
      pesoDisponivelFisico: 0,
      pesoTotalFisicoBase: 0,
      pesoVendidoBaixadoFisico: 0,
      pesoReservadoFisico: 0,
      pesoConsignadoFisico: 0,
      lotesFisicos: []
    });
  });

  pieces.filter(pieceIsActive).forEach((piece) => {
    const row = byProduct.get(piece.produtoId) || {
      id: piece.produtoId,
      produtoId: piece.produtoId,
      codigo: piece.codigo,
      descricao: piece.descricao,
      tipo: piece.tipo,
      medida: piece.medida,
      material: piece.material,
      fotoUrl: piece.fotoUrl,
      estoqueDisponivel: 0,
      estoqueConsignado: 0,
      estoqueVendido: 0,
      totalPecasFisicas: 0,
      disponivelFisico: 0,
      reservadoFisico: 0,
      consignadoFisico: 0,
      vendidoFisico: 0,
      pesoDisponivelFisico: 0,
      pesoTotalFisicoBase: 0,
      pesoVendidoBaixadoFisico: 0,
      pesoReservadoFisico: 0,
      pesoConsignadoFisico: 0,
      lotesFisicos: []
    };

    row.totalPecasFisicas += 1;
    const status = String(piece.status || "disponivel").toLowerCase();
    const pesoBase = pieceBaseWeight(piece);
    const pesoBaixa = pieceSoldWeight(piece);
    row.pesoTotalFisicoBase += pesoBase;
    if (status === "disponivel") {
      row.disponivelFisico += 1;
      row.pesoDisponivelFisico += pieceBaseWeight(piece);
    }
    if (status === "reservado") {
      row.reservadoFisico += 1;
      row.pesoReservadoFisico += pieceReservedWeight(piece);
    }
    if (status === "consignado") {
      row.consignadoFisico += 1;
      row.pesoConsignadoFisico += pieceReservedWeight(piece);
    }
    if (status === "vendido") {
      row.vendidoFisico += 1;
      row.pesoVendidoBaixadoFisico += pesoBaixa;
    }
    if (piece.lote || piece.loteCodigo) row.lotesFisicos.push(piece.lote || piece.loteCodigo);
    byProduct.set(piece.produtoId, row);
  });

  const alertasPorProduto = new Map();
  const alertasPedidosPorProduto = new Map();
  pendingManagerStockAlerts().forEach((alert) => {
    const id = alert.produtoId || productIdFrom(alert);
    const atual = alertasPorProduto.get(id) || 0;
    alertasPorProduto.set(id, atual + quantitySafe(alert.quantidadeFaltante || alert.quantidadePendenteAnalise || 0));
    const pedidos = alertasPedidosPorProduto.get(id) || new Set();
    const pedido = alertPedidoLabel(alert);
    if (pedido && pedido !== "Sem pedido") pedidos.add(String(pedido));
    alertasPedidosPorProduto.set(id, pedidos);
  });

  return [...byProduct.values()].map((row) => {
    const produtoId = row.produtoId || row.id || "";
    const productPieces = physicalPiecesForProduct(produtoId).filter(pieceIsActive);
    const independentLedger = hasIndependentWeightLedger(row)
      ? productWeightLedgerSnapshot(produtoId, row, productPieces)
      : null;

    // V59 — quando o inventário informa apenas peso TOTAL da linha/lote, as peças
    // físicas ficam corretamente sem peso individual inventado. Por isso a tela não
    // pode somar pieceBaseWeight(), que é 0 nesse modo. Ela deve ler o livro contábil
    // independente do SKU. Para registros antigos cujo ledger não foi persistido,
    // usa os lotes ativos como fonte de recuperação visual, sem alterar o Firebase.
    const activeLotWeight = hasIndependentWeightLedger(row)
      ? sum(
          objectToArray(state.data?.lotes || {}).filter((lote) =>
            pieceIsActive(lote) && String(lote.produtoId || "") === String(produtoId)
          ),
          (lote) => lote.pesoTotal || 0
        )
      : 0;
    const soldWeightFromPieces = sum(
      productPieces.filter((piece) => pieceStatusValue(piece) === "vendido"),
      pieceSoldWeight
    );
    const ledgerEntry = independentLedger
      ? Math.max(numberSafe(independentLedger.entrada || 0), numberSafe(activeLotWeight || 0))
      : 0;
    const ledgerExit = independentLedger
      ? Math.max(numberSafe(independentLedger.saida || 0), numberSafe(soldWeightFromPieces || 0))
      : 0;
    const ledgerAvailable = independentLedger
      ? Math.max(
          0,
          ledgerEntry -
            ledgerExit -
            numberSafe(independentLedger.reservado || 0) -
            numberSafe(independentLedger.consignado || 0)
        )
      : 0;

    return {
      ...row,
      alertaGestorPendenteReal: alertasPorProduto.get(produtoId) || 0,
      alertaGestorPedidos: [...(alertasPedidosPorProduto.get(produtoId) || new Set())],
      disponivelReal: row.totalPecasFisicas ? row.disponivelFisico : Math.max(0, quantitySafe(row.estoqueDisponivel || 0)),
      reservadoReal: row.totalPecasFisicas ? row.reservadoFisico : Math.max(0, quantitySafe(row.estoqueReservado || 0)),
      consignadoReal: row.totalPecasFisicas ? row.consignadoFisico : Math.max(0, quantitySafe(row.estoqueConsignado || 0)),
      vendidoReal: row.totalPecasFisicas ? row.vendidoFisico : Math.max(0, quantitySafe(row.estoqueVendido || 0)),
      producaoPendenteReal: Math.max(0, quantitySafe(row.estoqueProducaoPendente || row.producaoPendente || 0)),
      // Quantidade e peso continuam independentes. O peso mostrado vem do ledger
      // contábil do SKU; nunca presume que todas as peças tenham o mesmo peso.
      pesoDisponivelReal: independentLedger
        ? ledgerAvailable
        : (row.totalPecasFisicas
          ? Math.max(0, numberSafe(row.pesoTotalFisicoBase || row.pesoDisponivelFisico || 0) - numberSafe(row.pesoVendidoBaixadoFisico || 0) - numberSafe(row.pesoReservadoFisico || 0) - numberSafe(row.pesoConsignadoFisico || 0))
          : numberSafe(row.pesoTotalDisponivel || 0)),
      pesoVendidoReal: independentLedger
        ? ledgerExit
        : (row.totalPecasFisicas ? numberSafe(row.pesoVendidoBaixadoFisico || 0) : numberSafe(row.pesoTotalVendido || 0)),
      pesoTotalEntradaReal: independentLedger ? ledgerEntry : numberSafe(row.pesoTotalFisico || row.pesoTotalFisicoBase || 0),
      lotesFisicos: [...new Set(row.lotesFisicos || [])]
    };
  });
}

function physicalStockTable(rows = []) {
  if (!rows.length) return `<div class="empty">Nenhum produto ou peça física em estoque.</div>`;

  return `
    <div class="table-wrap clean-stock-table-wrap">
      <table class="stock-balance-table clean-stock-table">
        <thead>
          <tr>
            <th>Selecionar</th>
            <th>Código</th>
            <th>Descrição</th>
            <th>Material</th>
            <th>Medida</th>
            <th>Disponível</th>
            <th>Vendido</th>
            <th>Situação</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const status = stockRowStatus(row);
            const critical = quantitySafe(row.disponivelReal || 0) <= quantitySafe(row.estoqueCritico ?? row.estoqueMinimo ?? 0) && quantitySafe(row.estoqueCritico ?? row.estoqueMinimo ?? 0) > 0;
            const hasAlert = Number(row.alertaGestorPendenteReal || 0) > 0;
            const situation = hasAlert
              ? `<span class="badge danger">Falta em venda</span>`
              : critical
                ? `<span class="badge warning">Abaixo do crítico</span>`
                : Number(row.disponivelReal || 0) > 0
                  ? `<span class="badge success">Normal</span>`
                  : `<span class="badge light">Sem estoque</span>`;
            const search = normalizeSearchText([row.id, row.produtoId, row.codigo, row.descricao, row.tipo, row.material, row.medida, (row.lotesFisicos || []).join(" "), (row.alertaGestorPedidos || []).join(" "), status].join(" "));
            return `
              <tr data-stock-filterable data-stock-row data-code="${escapeHtml(row.codigo || "")}" data-material="${escapeHtml(row.material || "")}" data-measure="${escapeHtml(row.medida || "")}" data-status="${escapeHtml(status)}" data-search="${escapeHtml(search)}">
                <td data-label="Selecionar"><input type="checkbox" data-stock-select value="${escapeHtml(row.produtoId || row.id || "")}" aria-label="Selecionar ${escapeHtml(row.codigo || "SKU")}"></td>
                <td data-label="Código"><strong>${escapeHtml(row.codigo || "")}</strong></td>
                <td data-label="Descrição">${escapeHtml(row.descricao || "")}</td>
                <td data-label="Material">${escapeHtml(row.material || "-")}</td>
                <td data-label="Medida">${escapeHtml(row.medida || "-")}</td>
                <td data-label="Disponível"><strong>${formatNumber(row.disponivelReal || 0, 0)}</strong></td>
                <td data-label="Vendido">${formatNumber(row.vendidoReal || 0, 0)}</td>
                <td data-label="Situação">${situation}</td>
                <td data-label="Ação">
                  <details class="table-details clean-sku-details">
                    <summary>Ver detalhes</summary>
                    <div class="sku-detail-tabs">
                      <section>
                        <h4>Operação</h4>
                        <div class="mini-detail-list">
                          ${detailLine("Produto/SKU", row.produtoId || row.id || "")}
                          ${detailLine("Disponível", formatNumber(row.disponivelReal || 0, 0))}
                          ${detailLine("Vendido", formatNumber(row.vendidoReal || 0, 0))}
                          ${detailLine("Reservado", formatNumber(row.reservadoReal || 0, 0))}
                          ${detailLine("Consignado", formatNumber(row.consignadoReal || 0, 0))}
                        </div>
                      </section>
                      <section>
                        <h4>Parâmetros</h4>
                        <div class="mini-detail-list">
                          ${detailLine("Crítico", formatNumber(row.estoqueCritico ?? row.estoqueMinimo ?? 0, 0))}
                          ${detailLine("Ideal", formatNumber(row.estoqueIdeal ?? 0, 0))}
                          ${detailLine("Sugestão", formatNumber(row.estoqueSugestao ?? row.estoqueSugerido ?? 0, 0))}
                        </div>
                      </section>
                      <section>
                        <h4>Rastreabilidade</h4>
                        <div class="mini-detail-list">
                          ${detailLine("Peças físicas", formatNumber(row.totalPecasFisicas || 0, 0))}
                          ${detailLine("Peso disponível", `${formatNumber(row.pesoDisponivelReal || 0, 3)} g`)}
                          ${detailLine("Lotes", (row.lotesFisicos || []).join(", ") || "-")}
                          ${detailLine("Faltas em venda", formatNumber(row.alertaGestorPendenteReal || 0, 0))}
                        </div>
                      </section>
                    </div>
                  </details>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function physicalPieceTable(pieces = []) {
  const visible = pieces.filter(pieceIsActive).sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""))).slice(0, 1200);
  if (!visible.length) return `<div class="empty">Nenhuma peça física individual cadastrada ainda.</div>`;

  return `
    ${pieces.filter(pieceIsActive).length > visible.length ? `<div class="notice warning">Mostrando as primeiras ${formatNumber(visible.length, 0)} peças. Use os filtros para localizar uma peça específica.</div>` : ""}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Peça</th><th>Código</th><th>Material</th><th>Medida</th><th>Peso real</th><th>Peso pedido</th><th>Diferença</th><th>Lote</th><th>Status</th><th>Origem</th><th>Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${visible.map((piece) => {
            const status = String(piece.status || "disponivel").toLowerCase();
            const search = normalizeSearchText([piece.id, piece.pecaCodigo, piece.codigo, piece.codigoOriginal, piece.descricao, piece.material, piece.medida, piece.lote, piece.loteCodigo, piece.origem, piece.documentoId, piece.pedidoId, piece.vendaId, piece.numeroPedidoVenda, piece.pedidoVendaNumero, piece.clienteVenda, piece.vendedorVenda, piece.observacao, status].join(" "));
            return `
              <tr data-stock-filterable data-piece-row data-code="${escapeHtml(piece.codigo || "")}" data-material="${escapeHtml(piece.material || "")}" data-measure="${escapeHtml(piece.medida || "")}" data-status="${escapeHtml(status)}" data-search="${escapeHtml(search)}">
                <td><strong>${escapeHtml(piece.pecaCodigo || piece.id || "")}</strong></td>
                <td>${escapeHtml(piece.codigo || "")}</td>
                <td>${escapeHtml(piece.material || "-")}</td>
                <td>${escapeHtml(piece.medida || "-")}</td>
                <td>${piece.pesoIndividualConhecido === false || piece.pesoControleModo === "total_lote" ? `<span class="badge light">Não individualizado</span>` : `${formatNumber(piece.pesoReal || piece.pesoUnitario || 0, 3)} g`}</td>
                <td>${piece.pesoPedido || piece.pesoPrevisto ? `${formatNumber(piece.pesoPedido || piece.pesoPrevisto || 0, 3)} g` : "-"}</td>
                <td>${piece.pesoPedido || piece.pesoPrevisto ? `${formatNumber(piece.diferencaPeso || 0, 3)} g` : "-"}</td>
                <td>${escapeHtml(piece.lote || piece.loteCodigo || "-")}</td>
                <td>${escapeHtml(pieceStatusLabel(piece.status))}</td>
                <td>${escapeHtml(piece.origem || "-")}</td>
                <td>
                  <details class="table-details">
                    <summary>Ver</summary>
                    <div class="mini-detail-list">
                      ${detailLine("ID peça", piece.id || "")}
                      ${detailLine("Código físico", piece.pecaCodigo || "")}
                      ${detailLine("Produto/SKU", piece.produtoId || "")}
                      ${detailLine("Descrição", piece.descricao || "")}
                      ${detailLine("Tipo", piece.tipo || "")}
                      ${detailLine("Lote", piece.lote || piece.loteCodigo || "")}
                      ${detailLine("Status", pieceStatusLabel(piece.status))}
                      ${detailLine("Documento origem", piece.documentoId || piece.pedidoId || piece.vendaId || "")}
                      ${detailLine("Pedido da venda", piece.numeroPedidoVenda || piece.pedidoVendaNumero || piece.documentoBaixaId || "")}
                      ${detailLine("Venda ID", piece.vendaId || "")}
                      ${detailLine("Cliente venda", piece.clienteVenda || "")}
                      ${detailLine("Responsável venda", piece.vendedorVenda || "")}
                      ${detailLine("Controle de peso", piece.pesoIndividualConhecido === false || piece.pesoControleModo === "total_lote" ? "Peso total do lote/SKU; quantidade e gramas independentes" : "Peso individual real conhecido")}
                      ${detailLine("Média de referência", piece.pesoRateioReferencia || piece.pesoUnitarioEstimado ? `${formatNumber(piece.pesoRateioReferencia || piece.pesoUnitarioEstimado || 0, 3)} g` : "-")}
                      ${detailLine(piece.pesoBaixaRateado ? "Rateio contábil da venda" : "Peso debitado na venda", piece.pesoBaixaReal || piece.pesoUnitarioBaixa ? `${formatNumber(piece.pesoBaixaReal || piece.pesoUnitarioBaixa || 0, 3)} g` : "-")}
                      ${detailLine("Peso total do grupo vendido", piece.pesoTotalVendaGrupo ? `${formatNumber(piece.pesoTotalVendaGrupo || 0, 3)} g em ${formatNumber(piece.quantidadeVendaGrupo || 0, 0)} peça(s)` : "-")}
                      ${detailLine("Produção", piece.producaoId || piece.pedidoProducaoId || "")}
                      ${detailLine("Criado em", formatDate(piece.criadoEm))}
                      ${detailLine("Atualizado em", formatDate(piece.atualizadoEm))}
                      ${detailLine("Origem", piece.origem || "")}
                      ${detailLine("Observação", piece.observacao || "")}
                    </div>
                  </details>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}


function isReversedRecord(record = {}) {
  return ["estornado", "estornada"].includes(String(record.importacaoStatus || record.status || record.situacao || "").toLowerCase());
}

function recentImportDocuments() {
  const inventory = objectToArray(state.data?.inventariosEstoque || {})
    .map((doc) => ({ ...doc, collection: "inventariosEstoque", classe: "inventario" }));
  const sales = objectToArray(state.data?.pedidos || {})
    .filter((doc) => isCommercialImport(doc.tipoImportacao || "venda_inteligente"))
    .map((doc) => ({ ...doc, collection: "pedidos", classe: "venda_pdf" }));
  const productionReady = objectToArray(state.data?.producoes || {})
    .filter((doc) => String(doc.tipoRegistro || "") === "cabecalho_producao_pronta_pdf")
    .map((doc) => ({ ...doc, collection: "producoes", classe: "producao_pronta_pdf" }));
  return [...inventory, ...sales, ...productionReady]
    .filter((doc) => !isFailedImportDocument(doc))
    .sort((a, b) => String(b.criadoEm || b.atualizadoEm || "").localeCompare(String(a.criadoEm || a.atualizadoEm || "")))
    .slice(0, 30);
}

function recentImportDocumentsTable() {
  const docs = recentImportDocuments();
  if (!docs.length) return `<div class="empty">Nenhum PDF operacional lançado.</div>`;
  return `
    <div class="table-wrap">
      <table class="compact-table">
        <thead><tr><th>Data</th><th>Pedido</th><th>Tipo</th><th>Arquivo</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>${docs.map((doc) => {
          const pedido = doc.numeroPedido || doc.pedidoPdfNumero || doc.pedidoNumero || doc.id || "";
          const saleHeaderState = doc.classe === "venda_pdf"
            ? salePdfHeaderReversalState(doc.id, doc)
            : null;
          const reversed = isReversedRecord(doc) || Boolean(saleHeaderState?.allRowsReversed);
          const needsSaleHeaderReconciliation = Boolean(saleHeaderState?.needsReconciliation);
          const coverage = doc.classe === "inventario"
            ? inventoryDocumentReversalCoverage(doc.id, doc)
            : null;
          const incomplete = Boolean(reversed && coverage && coverage.activePieces.length > 0);
          const statusHtml = needsSaleHeaderReconciliation
            ? `<span class="badge warning">Status do PDF pendente</span>`
            : incomplete
              ? `<span class="badge warning">Estorno incompleto</span>`
              : reversed
                ? `<span class="badge light">Estornado</span>`
                : `<span class="badge success">Ativo</span>`;
          const actionHtml = !isAdminUser()
            ? "-"
            : needsSaleHeaderReconciliation
              ? `<button class="btn btn-danger btn-sm" type="button" data-reverse-import="${escapeHtml(doc.id)}" data-reverse-collection="${escapeHtml(doc.collection)}">Corrigir status do PDF</button>`
              : incomplete
                ? `<button class="btn btn-danger btn-sm" type="button" data-reverse-import="${escapeHtml(doc.id)}" data-reverse-collection="${escapeHtml(doc.collection)}">Concluir estorno pendente</button>`
                : reversed
                  ? "-"
                  : `<button class="btn btn-danger btn-sm" type="button" data-reverse-import="${escapeHtml(doc.id)}" data-reverse-collection="${escapeHtml(doc.collection)}">Estornar PDF</button>`;
          const typeLabel = doc.classe === "inventario"
            ? "Inventário / entrada"
            : doc.classe === "producao_pronta_pdf"
              ? "Produção pronta"
              : "Venda por PDF";
          return `<tr>
            <td>${formatDate(doc.criadoEm || doc.atualizadoEm)}</td>
            <td><strong>${escapeHtml(pedido)}</strong></td>
            <td>${typeLabel}</td>
            <td>${escapeHtml(doc.arquivoNome || "-")}</td>
            <td>${statusHtml}</td>
            <td>${actionHtml}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
}

function saleRecordsForReverse(reference = "", pedido = "") {
  const all = objectToArray(state.data?.vendas || {}).filter((sale) => !isReversedRecord(sale));
  if (String(reference || "").startsWith("pdf_")) {
    const key = String(reference).slice(4);
    return all.filter((sale) =>
      String(sale.pedidoId || sale.origemDocumentoId || sale.pedidoPdfNumero || sale.numeroPedido || "") === key ||
      String(sale.pedidoPdfNumero || sale.numeroPedido || "") === String(pedido || "")
    );
  }
  const direct = all.find((sale) => String(sale.id || "") === String(reference || ""));
  if (direct) return [direct];
  const target = String(reference || pedido || "");
  return all.filter((sale) => String(sale.pedidoId || sale.origemDocumentoId || sale.pedidoPdfNumero || sale.numeroPedido || "") === target);
}


function saleRecordsForImportDocument(documentId = "", pedido = "", { activeOnly = false } = {}) {
  const targetDocument = String(documentId || "");
  const targetOrder = String(pedido || "");
  return objectToArray(state.data?.vendas || {}).filter((sale) => {
    if (activeOnly && isReversedRecord(sale)) return false;
    const direct = targetDocument && (
      String(sale.pedidoId || "") === targetDocument ||
      String(sale.origemDocumentoId || "") === targetDocument
    );
    const sameOrder = targetOrder && String(sale.pedidoPdfNumero || sale.numeroPedido || "") === targetOrder;
    return Boolean(direct || sameOrder);
  });
}

function salePdfHeaderReversalState(documentId = "", docInput = null) {
  const doc = docInput || state.data?.pedidos?.[documentId] || {};
  const pedido = String(doc.numeroPedido || doc.pedidoPdfNumero || doc.pedidoNumero || "");
  const rows = saleRecordsForImportDocument(documentId, pedido);
  const activeRows = rows.filter((sale) => !isReversedRecord(sale));
  const reversedRows = rows.filter(isReversedRecord);
  const allRowsReversed = rows.length > 0 && activeRows.length === 0 && reversedRows.length === rows.length;
  return {
    documentId: String(documentId || ""),
    doc,
    pedido,
    rows,
    activeRows,
    reversedRows,
    allRowsReversed,
    headerReversed: isReversedRecord(doc),
    needsReconciliation: allRowsReversed && !isReversedRecord(doc)
  };
}

function saleImportDocumentIds(records = [], explicitDocumentId = "") {
  const ids = new Set();
  if (explicitDocumentId && state.data?.pedidos?.[explicitDocumentId]) ids.add(String(explicitDocumentId));

  for (const sale of records) {
    for (const value of [sale.pedidoId, sale.origemDocumentoId]) {
      if (value && state.data?.pedidos?.[value]) ids.add(String(value));
    }
    const pedido = String(sale.pedidoPdfNumero || sale.numeroPedido || "");
    if (pedido) {
      const header = objectToArray(state.data?.pedidos || {}).find((doc) =>
        String(doc.numeroPedido || doc.pedidoPdfNumero || doc.pedidoNumero || "") === pedido
      );
      if (header?.id) ids.add(String(header.id));
    }
  }
  return [...ids];
}

async function reconcileSalePdfHeaders(records = [], {
  motivo = "",
  reversalFields = null,
  explicitDocumentId = ""
} = {}) {
  const fields = reversalFields || reversalActorFields(motivo);
  const reconciled = [];

  for (const documentId of saleImportDocumentIds(records, explicitDocumentId)) {
    const stateInfo = salePdfHeaderReversalState(documentId);
    if (!stateInfo.rows.length || !stateInfo.allRowsReversed) continue;

    const patch = {
      importacaoStatus: "estornada",
      status: "estornado",
      statusEstoque: "estornada",
      ...fields,
      estornoReconciliado: true,
      estornoVendaLinhasTotal: stateInfo.rows.length,
      estornoVendaLinhasConcluidas: stateInfo.reversedRows.length,
      estornoConcluidoEm: nowIso(),
      atualizadoEm: nowIso()
    };
    await DB.patch("pedidos", documentId, patch);
    localPatchCollection("pedidos", documentId, patch);
    reconciled.push({
      documentId,
      pedido: stateInfo.pedido,
      linhas: stateInfo.rows.length,
      patch
    });
  }
  return reconciled;
}

async function reconcilePreviouslyReversedSalePdf(documentId = "", {
  motivo = "",
  auditoriaId = ""
} = {}) {
  const doc = state.data?.pedidos?.[documentId];
  if (!doc) throw new Error("PDF de venda não encontrado.");
  const info = salePdfHeaderReversalState(documentId, doc);
  if (!info.rows.length) throw new Error("Nenhuma linha de venda foi encontrada para este PDF.");
  if (info.activeRows.length) throw new Error("Ainda existem linhas ativas. Use o estorno normal da venda.");
  if (!info.allRowsReversed) throw new Error("As linhas da venda não estão integralmente estornadas.");

  const reversalFields = reversalActorFields(motivo);
  const reconciled = await reconcileSalePdfHeaders(info.rows, {
    motivo,
    reversalFields,
    explicitDocumentId: documentId
  });
  if (!reconciled.length && !isReversedRecord(doc)) {
    throw new Error("Não foi possível corrigir o status do PDF.");
  }

  const details = {
    colecao: "pedidos",
    documentoId: documentId,
    motivo,
    resumo: `Status do PDF de venda corrigido após ${info.reversedRows.length} linha(s) já estornada(s).`,
    depois: {
      status: "estornado",
      linhasVenda: info.rows.length,
      linhasEstornadas: info.reversedRows.length
    },
    metadados: {
      pedido: info.pedido,
      vendaIds: info.rows.map((sale) => sale.id),
      reconciliacaoSemNovaMovimentacaoEstoque: true
    }
  };

  if (auditoriaId) await completeReversalAudit(auditoriaId, details);
  else await auditLogStrict("status_pdf_venda_corrigido", {
    ...details,
    justificativaObrigatoria: true,
    statusAuditoria: "concluida"
  });
  return details;
}

function saleWeightToReverse(item = {}) {
  const requested = Math.max(1, quantitySafe(item.quantidadeSolicitada || item.quantidade || 0));
  const lowered = quantitySafe(item.quantidadeBaixada ?? item.quantidade ?? 0);

  // V63 — o estorno precisa devolver exatamente o peso que realmente saiu.
  // Em venda parcial, pesoTotalBaixado já representa a baixa real. Ratear esse
  // valor novamente por quantidade devolvia apenas 2/3 de 1,400 g, por exemplo.
  const explicitLoweredWeight = firstWeightValue(
    item.pesoTotalBaixado,
    item.pesoBaixadoReal,
    item.pesoTotalRealBaixado
  );
  if (explicitLoweredWeight > 0) return explicitLoweredWeight;

  const piecesLoweredWeight = sum(
    Array.isArray(item.pecasBaixadas) ? item.pecasBaixadas : [],
    (piece) => piece.pesoBaixaReal ?? piece.pesoUnitarioBaixa ?? piece.pesoTotalBaixado ?? 0
  );
  if (piecesLoweredWeight > 0) return piecesLoweredWeight;

  // Para registros antigos sem pesoTotalBaixado, calcula uma única proporção
  // a partir do peso total solicitado. Nunca rateia novamente uma baixa já pronta.
  return saleWeightValues(item, requested, lowered).pesoTotal;
}

async function reverseSaleRecords(records = [], { motivo = "", documentoImportacaoId = "", auditoriaId = "" } = {}) {
  if (!records.length) throw new Error("Venda não encontrada ou já estornada.");
  if (String(motivo || "").trim().length < 10) throw new Error("Informe uma justificativa válida para o estorno.");

  const reversalFields = reversalActorFields(motivo);
  const affected = new Map();
  const saleIds = new Set(records.map((sale) => String(sale.id || "")).filter(Boolean));
  const refs = new Set(records.flatMap((sale) => [sale.id, sale.pedidoId, sale.origemDocumentoId, sale.pedidoPdfNumero, sale.numeroPedido]).filter(Boolean).map(String));
  let returnedPieces = 0;
  let returnedWeight = 0;

  for (const sale of records) {
    for (const item of saleItemsForDisplay(sale)) {
      if (!item.produtoId || !state.data?.produtos?.[item.produtoId]) continue;
      const current = affected.get(item.produtoId) || { product: state.data.produtos[item.produtoId], peso: 0 };
      ensureIndependentWeightLedger(item.produtoId, current.product);
      const itemWeight = saleWeightToReverse(item);
      current.peso += itemWeight;
      returnedWeight += itemWeight;
      returnedPieces += quantitySafe(item.quantidadeBaixada ?? item.quantidade ?? 0);
      affected.set(item.produtoId, current);
    }

    const pieces = physicalPieces().filter((piece) => pieceIsActive(piece) && pieceStatusValue(piece) === "vendido" && (
      String(piece.vendaId || "") === String(sale.id || "") ||
      String(piece.documentoBaixaId || "") === String(sale.id || "") ||
      (sale.pedidoPdfNumero && String(piece.numeroPedidoVenda || piece.pedidoVendaNumero || "") === String(sale.pedidoPdfNumero))
    ));

    for (const piece of pieces) {
      const patch = {
        status: piece.statusAnterior && piece.statusAnterior !== "vendido" ? piece.statusAnterior : "disponivel",
        vendaEstornadaId: sale.id || "",
        vendaEstornadaEm: reversalFields.estornadoEm,
        ...reversalFields,
        documentoBaixaId: "", vendaId: "", pedidoVendaId: "", numeroPedidoVenda: "", pedidoVendaNumero: "",
        clienteVenda: "", vendedorVenda: "", pesoBaixaReal: 0, pesoUnitarioBaixa: 0, pesoTotalBaixado: 0,
        pesoTotalVendaGrupo: 0, quantidadeVendaGrupo: 0, pesoVendaInformado: false,
        baixaOrigem: "", baixaObservacao: "", baixadaEm: "", atualizadoEm: nowIso()
      };
      await DB.patch("pecasEstoque", piece.id, patch);
      localPatchCollection("pecasEstoque", piece.id, patch);
    }

    const salePatch = {
      statusAnteriorEstorno: sale.status || "",
      status: "estornada",
      statusEstoque: "estornada",
      ...reversalFields
    };
    await DB.patch("vendas", sale.id, salePatch);
    localPatchCollection("vendas", sale.id, salePatch);
  }

  for (const [produtoId, info] of affected.entries()) {
    applyProductWeightLedgerDelta(produtoId, info.product, {
      saidaDelta: -info.peso,
      motivo: `Estorno de venda justificado: ${motivo}`
    });
    await syncProductAggregateFromPieces(produtoId, info.product);
  }

  for (const alert of objectToArray(state.data?.alertasOperacionais || {})) {
    const linked = saleIds.has(String(alert.vendaId || "")) || refs.has(String(alert.origemDocumentoId || alert.numeroPedido || alert.pedidoPdfNumero || ""));
    if (linked && !isReversedRecord(alert)) {
      const patch = { status: "estornado", ...reversalFields };
      await DB.patch("alertasOperacionais", alert.id, patch);
      localPatchCollection("alertasOperacionais", alert.id, patch);
    }
  }

  for (const movimento of objectToArray(state.data?.movimentos || {})) {
    if (refs.has(String(movimento.pedidoId || "")) && !isReversedRecord(movimento)) {
      const patch = { status: "estornado", ...reversalFields };
      await DB.patch("movimentos", movimento.id, patch);
      localPatchCollection("movimentos", movimento.id, patch);
    }
  }

  // V66: o botão de estorno na tela de Vendas também precisa encerrar o
  // cabeçalho original do PDF. Antes, somente o estorno iniciado na tela
  // Importar PDF recebia documentoImportacaoId; por isso a venda ficava
  // estornada, mas o PDF continuava aparecendo como ativo.
  const reconciledSaleDocuments = await reconcileSalePdfHeaders(records, {
    motivo,
    reversalFields,
    explicitDocumentId: documentoImportacaoId
  });

  const auditDetails = {
    colecao: "vendas",
    documentoId: records.map((sale) => sale.id).join(","),
    motivo,
    resumo: `Estorno concluído de ${records.length} venda(s). ${returnedPieces} peça(s) e ${formatNumber(returnedWeight, 3)} g devolvidos ao estoque.`,
    antes: records,
    depois: {
      status: "estornada",
      produtos: [...affected.keys()],
      pecasDevolvidas: returnedPieces,
      pesoDevolvido: returnedWeight
    },
    metadados: {
      documentoImportacaoId,
      documentosImportacaoEstornados: reconciledSaleDocuments.map((item) => item.documentId),
      vendaIds: [...saleIds],
      referencias: [...refs],
      produtosAfetados: [...affected.keys()],
      pecasDevolvidas: returnedPieces,
      pesoDevolvido: returnedWeight
    }
  };

  if (auditoriaId) await completeReversalAudit(auditoriaId, auditDetails);
  else await auditLogStrict("venda_estornada", {
    ...auditDetails,
    justificativaObrigatoria: true,
    statusAuditoria: "concluida"
  });
}

function inventoryDocumentItems(doc = {}) {
  if (Array.isArray(doc.itens)) return doc.itens.filter(Boolean);
  return objectToArray(doc.itens || {});
}

function inventoryDocumentExpectedGroups(doc = {}) {
  const groups = new Map();
  for (const item of inventoryDocumentItems(doc)) {
    const produtoId = String(item.produtoId || productIdFrom(item) || "");
    if (!produtoId) continue;
    const current = groups.get(produtoId) || {
      produtoId,
      item,
      quantidadeEsperada: 0,
      pesoEsperado: 0
    };
    const quantidade = quantitySafe(item.quantidade || item.qtd || 0);
    current.quantidadeEsperada += quantidade;
    current.pesoEsperado += lineWeightTotal(item, quantidade);
    groups.set(produtoId, current);
  }
  return groups;
}

function inventoryDocumentLinkContext(documentId = "", doc = {}) {
  const pedido = String(doc.numeroPedido || doc.pedidoPdfNumero || doc.pedidoNumero || "").trim();
  const arquivoNome = normalizeSearchText(doc.arquivoNome || "");
  const expectedGroups = inventoryDocumentExpectedGroups(doc);
  const expectedProductIds = new Set(expectedGroups.keys());
  const linkedLots = objectToArray(state.data?.lotes || {}).filter((lote) => {
    const direct = String(lote.pedidoId || lote.inventarioId || "") === String(documentId);
    if (direct) return true;
    const samePedido = pedido && String(lote.pedidoPdfNumero || lote.numeroPedido || "") === pedido;
    const sameOrigin = arquivoNome && normalizeSearchText(lote.arquivoNome || lote.origemDocumento || "") === arquivoNome;
    return Boolean(samePedido && sameOrigin);
  });
  const lotIds = new Set(linkedLots.map((lote) => String(lote.id || "")).filter(Boolean));
  const lotCodes = new Set(linkedLots.flatMap((lote) => [lote.lote, lote.loteCodigo]).map((value) => String(value || "")).filter(Boolean));
  linkedLots.forEach((lote) => {
    if (lote.produtoId) expectedProductIds.add(String(lote.produtoId));
  });
  return { documentId: String(documentId), doc, pedido, arquivoNome, expectedGroups, expectedProductIds, linkedLots, lotIds, lotCodes };
}

function pieceBelongsToInventoryDocument(piece = {}, context = {}) {
  const documentId = String(context.documentId || "");
  if (String(piece.inventarioId || "") === documentId) return true;
  if (String(piece.pedidoId || "") === documentId) return true;
  if (context.lotIds?.has(String(piece.loteId || ""))) return true;
  const pieceLot = String(piece.loteCodigo || piece.lote || "");
  if (pieceLot && context.lotCodes?.has(pieceLot) && (!context.expectedProductIds?.size || context.expectedProductIds.has(String(piece.produtoId || "")))) return true;

  const samePedido = context.pedido && String(piece.pedidoPdfNumero || piece.numeroPedido || "") === context.pedido;
  const sameFile = context.arquivoNome && normalizeSearchText(piece.origemDocumento || piece.arquivoNome || "") === context.arquivoNome;
  const inventoryOrigin = normalizeSearchText(piece.origem || "").includes("INVENTARIO");
  return Boolean(samePedido && sameFile && inventoryOrigin);
}

function inventoryMovementBelongsToDocument(movement = {}, context = {}) {
  const direct = String(movement.pedidoId || movement.inventarioId || "") === String(context.documentId || "");
  if (direct) return true;
  const samePedido = context.pedido && String(movement.pedidoPdfNumero || movement.numeroPedido || "") === context.pedido;
  const sameFile = context.arquivoNome && normalizeSearchText(movement.arquivoNome || movement.origemDocumento || "") === context.arquivoNome;
  return Boolean(samePedido && sameFile);
}

function inventoryDocumentReversalCoverage(documentId = "", docInput = null) {
  const doc = docInput || state.data?.inventariosEstoque?.[documentId] || {};
  const context = inventoryDocumentLinkContext(documentId, doc);
  const linkedPieces = physicalPieces().filter((piece) => pieceBelongsToInventoryDocument(piece, context));
  const activePieces = linkedPieces.filter(pieceIsActive);
  const reversedPieces = linkedPieces.filter((piece) => isReversedRecord(piece));
  const blockedPieces = activePieces.filter((piece) => pieceStatusValue(piece) !== "disponivel");
  const actualGroups = new Map();

  for (const piece of linkedPieces) {
    const produtoId = String(piece.produtoId || productIdFrom(piece) || "");
    if (!produtoId) continue;
    const current = actualGroups.get(produtoId) || { produtoId, total: 0, active: 0, reversed: 0, blocked: 0 };
    current.total += 1;
    if (pieceIsActive(piece)) current.active += 1;
    if (isReversedRecord(piece)) current.reversed += 1;
    if (pieceIsActive(piece) && pieceStatusValue(piece) !== "disponivel") current.blocked += 1;
    actualGroups.set(produtoId, current);
  }

  const expectedQty = sum([...context.expectedGroups.values()], (group) => group.quantidadeEsperada || 0);
  const expectedWeight = sum([...context.expectedGroups.values()], (group) => group.pesoEsperado || 0);
  const missingGroups = [];
  for (const [produtoId, expected] of context.expectedGroups.entries()) {
    const actual = actualGroups.get(produtoId) || { total: 0, active: 0, reversed: 0, blocked: 0 };
    if (actual.total < expected.quantidadeEsperada) {
      missingGroups.push({
        produtoId,
        codigo: expected.item?.codigo || "",
        medida: expected.item?.medida || "",
        material: expected.item?.material || "",
        esperado: expected.quantidadeEsperada,
        encontrado: actual.total
      });
    }
  }

  return {
    context,
    expectedQty,
    expectedWeight,
    linkedPieces,
    activePieces,
    reversedPieces,
    blockedPieces,
    actualGroups,
    missingGroups,
    linkedLots: context.linkedLots,
    complete: expectedQty > 0 && linkedPieces.length >= expectedQty && activePieces.length === 0,
    incomplete: isReversedRecord(doc) && activePieces.length > 0
  };
}

async function reverseInventoryDocument(documentId = "", { motivo = "", auditoriaId = "" } = {}) {
  if (String(motivo || "").trim().length < 10) throw new Error("Informe uma justificativa válida para o estorno.");

  const doc = state.data?.inventariosEstoque?.[documentId];
  if (!doc) throw new Error("Inventário não encontrado.");

  const coverage = inventoryDocumentReversalCoverage(documentId, doc);
  if (isReversedRecord(doc) && !coverage.activePieces.length) throw new Error("Este inventário já foi estornado por completo.");
  if (coverage.missingGroups.length) {
    const detalhes = coverage.missingGroups.map((item) => `${item.codigo || item.produtoId} Nº ${item.medida || "-"}: esperado ${item.esperado}, localizado ${item.encontrado}`).join("; ");
    throw new Error(`Estorno bloqueado antes de alterar o estoque: nem todos os itens do PDF foram vinculados. ${detalhes}`);
  }
  if (coverage.blockedPieces.length) {
    throw new Error(`Este inventário possui ${coverage.blockedPieces.length} peça(s) já vinculada(s) a saída. Estorne primeiro as vendas/consignações vinculadas.`);
  }

  const pieces = coverage.activePieces;
  if (!pieces.length) throw new Error("Nenhuma peça ativa deste inventário foi localizada para estorno.");

  const reversalFields = reversalActorFields(motivo);
  const groups = new Map();
  const allLinkedByProduct = new Map();
  for (const piece of coverage.linkedPieces) {
    const produtoId = String(piece.produtoId || productIdFrom(piece) || "");
    if (!produtoId) continue;
    const current = allLinkedByProduct.get(produtoId) || [];
    current.push(piece);
    allLinkedByProduct.set(produtoId, current);
  }

  for (const piece of pieces) {
    const produtoId = String(piece.produtoId || productIdFrom(piece) || "");
    if (!produtoId) continue;
    const current = groups.get(produtoId) || { product: state.data?.produtos?.[produtoId], pieces: [] };
    current.pieces.push(piece);
    if (current.product) ensureIndependentWeightLedger(produtoId, current.product);
    groups.set(produtoId, current);
  }

  const groupAudit = [];
  let removedWeightThisRun = 0;
  let removedPiecesThisRun = 0;

  for (const piece of pieces) {
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: "estornada",
      ...reversalFields,
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", piece.id, patch);
    localPatchCollection("pecasEstoque", piece.id, patch);
    removedPiecesThisRun += 1;
  }

  for (const lote of coverage.linkedLots) {
    if (!isReversedRecord(lote)) {
      const patch = { status: "estornado", ...reversalFields, quantidadeDisponivel: 0 };
      await DB.patch("lotes", lote.id, patch);
      localPatchCollection("lotes", lote.id, patch);
    }
  }

  for (const [produtoId, info] of groups.entries()) {
    if (!info.product) continue;
    const expected = coverage.context.expectedGroups.get(produtoId);
    const allLinked = allLinkedByProduct.get(produtoId) || [];
    const previouslyReversed = allLinked.some((piece) => isReversedRecord(piece));
    let groupWeight = numberSafe(expected?.pesoEsperado || 0);

    if (!groupWeight) {
      groupWeight = sum(
        coverage.linkedLots.filter((lote) => String(lote.produtoId || "") === produtoId),
        (lote) => lote.pesoTotal || 0
      );
    }
    if (!groupWeight) {
      groupWeight = sum(
        objectToArray(state.data?.movimentos || {}).filter((mov) => inventoryMovementBelongsToDocument(mov, coverage.context) && String(mov.produtoId || "") === produtoId),
        (mov) => mov.peso || 0
      );
    }

    const weightAlreadyRemovedByPreviousAttempt = isReversedRecord(doc) && previouslyReversed;
    const weightDelta = weightAlreadyRemovedByPreviousAttempt ? 0 : groupWeight;
    if (weightDelta > 0) {
      applyProductWeightLedgerDelta(produtoId, info.product, {
        entradaDelta: -weightDelta,
        motivo: `Estorno de inventário justificado: ${motivo}`
      });
      removedWeightThisRun += weightDelta;
    }
    await syncProductAggregateFromPieces(produtoId, info.product);
    groupAudit.push({
      produtoId,
      pecasRemovidasNestaExecucao: info.pieces.length,
      pesoDocumentoGrupo: groupWeight,
      pesoRemovidoNestaExecucao: weightDelta,
      pesoJaRemovidoEmTentativaAnterior: weightAlreadyRemovedByPreviousAttempt
    });
  }

  for (const collection of ["movimentos", "estoqueMovimentos"]) {
    for (const mov of objectToArray(state.data?.[collection] || {})) {
      if (inventoryMovementBelongsToDocument(mov, coverage.context) && !isReversedRecord(mov)) {
        const patch = { status: "estornado", ...reversalFields };
        await DB.patch(collection, mov.id, patch);
        localPatchCollection(collection, mov.id, patch);
      }
    }
  }

  const totalReversedAfter = coverage.reversedPieces.length + removedPiecesThisRun;
  const docPatch = {
    importacaoStatus: "estornada",
    status: "estornado",
    ...reversalFields,
    estornoReconciliado: true,
    estornoQuantidadeEsperada: coverage.expectedQty,
    estornoQuantidadeVinculada: coverage.linkedPieces.length,
    estornoPecasRemovidasTotal: totalReversedAfter,
    estornoPecasRemovidasNestaExecucao: removedPiecesThisRun,
    estornoPesoDocumento: coverage.expectedWeight,
    estornoPesoRemovidoNestaExecucao: removedWeightThisRun,
    estornoConcluidoEm: nowIso()
  };
  await DB.patch("inventariosEstoque", documentId, docPatch);
  localPatchCollection("inventariosEstoque", documentId, docPatch);

  const auditDetails = {
    colecao: "inventariosEstoque",
    documentoId: documentId,
    motivo,
    resumo: `Inventário estornado/reconciliado: ${removedPiecesThisRun} peça(s) removida(s) nesta execução. Cobertura total ${totalReversedAfter}/${coverage.expectedQty}. Peso removido nesta execução: ${formatNumber(removedWeightThisRun, 3)} g.`,
    antes: doc,
    depois: {
      ...docPatch,
      pecasRemovidas: totalReversedAfter,
      pesoRemovidoNestaExecucao: removedWeightThisRun
    },
    metadados: {
      reconciliacaoDeEstornoIncompleto: isReversedRecord(doc) || coverage.reversedPieces.length > 0,
      produtosAfetados: [...groups.keys()],
      grupos: groupAudit,
      quantidadeEsperada: coverage.expectedQty,
      quantidadeVinculada: coverage.linkedPieces.length,
      pecasJaEstornadasAntes: coverage.reversedPieces.length,
      pecasRemovidasNestaExecucao: removedPiecesThisRun,
      pecasRemovidasTotal: totalReversedAfter,
      pesoDocumento: coverage.expectedWeight,
      pesoRemovidoNestaExecucao: removedWeightThisRun
    }
  };

  if (auditoriaId) await completeReversalAudit(auditoriaId, auditDetails);
  else await auditLogStrict("inventario_pdf_estornado", {
    ...auditDetails,
    justificativaObrigatoria: true,
    statusAuditoria: "concluida"
  });
}


function productionHeaderRecord(record = {}) {
  return String(record.tipoRegistro || "") === "cabecalho_producao_pronta_pdf";
}

function productionReversalContext(referenceId = "") {
  const storedRoot = state.data?.producoes?.[referenceId];
  if (!storedRoot) return null;

  // Registros do Realtime Database não carregam a chave dentro do próprio objeto.
  // O ID precisa ser anexado explicitamente para impedir gravações em producoes/undefined
  // e metadados de Auditoria com valores inválidos.
  const root = { ...storedRoot, id: String(referenceId) };
  const allProductions = objectToArray(state.data?.producoes || {});
  const technicalRecords = productionHeaderRecord(root)
    ? allProductions.filter((record) =>
        String(record.origemDocumentoId || "") === String(referenceId) &&
        String(record.tipoRegistro || "") === "producao_pronta_pdf"
      )
    : [root];

  const technicalIds = new Set(technicalRecords.map((record) => String(record.id || "")).filter(Boolean));
  const linkedLots = objectToArray(state.data?.lotes || {}).filter((lot) =>
    technicalIds.has(String(lot.producaoId || "")) ||
    String(lot.pedidoId || "") === String(referenceId)
  );
  const lotIds = new Set(linkedLots.map((lot) => String(lot.id || "")).filter(Boolean));

  const linkedPieces = physicalPieces().filter((piece) =>
    technicalIds.has(String(piece.producaoId || "")) ||
    (!productionHeaderRecord(root) && String(piece.pedidoId || "") === String(referenceId)) ||
    (productionHeaderRecord(root) && String(piece.pedidoId || "") === String(referenceId)) ||
    lotIds.has(String(piece.loteId || ""))
  );

  const movementReferences = new Set([String(referenceId), ...technicalIds]);
  const linkedMovements = [
    ...objectToArray(state.data?.movimentos || {}).map((record) => ({ ...record, collection: "movimentos" })),
    ...objectToArray(state.data?.estoqueMovimentos || {}).map((record) => ({ ...record, collection: "estoqueMovimentos" }))
  ].filter((movement) => movementReferences.has(String(movement.pedidoId || movement.producaoId || "")));

  const expectedGroups = new Map();
  const sourceRecords = technicalRecords.length ? technicalRecords : [root];
  for (const record of sourceRecords) {
    const produtoId = String(record.produtoId || "");
    if (!produtoId) continue;
    const current = expectedGroups.get(produtoId) || { produtoId, quantidade: 0, peso: 0, records: [] };
    current.quantidade += quantitySafe(record.quantidade || 0);
    current.peso += numberSafe(record.pesoTotal || 0);
    current.records.push(record.id);
    expectedGroups.set(produtoId, current);
  }

  if (!expectedGroups.size && Array.isArray(root.itens)) {
    for (const item of root.itens) {
      const produtoId = String(item.produtoId || productIdFrom(item) || "");
      if (!produtoId) continue;
      const qtd = quantitySafe(item.quantidade || 0);
      const current = expectedGroups.get(produtoId) || { produtoId, quantidade: 0, peso: 0, records: [] };
      current.quantidade += qtd;
      current.peso += lineWeightTotal(item, qtd);
      current.records.push(root.id);
      expectedGroups.set(produtoId, current);
    }
  }

  const linkedOrderIds = [...new Set(
    technicalRecords.map((record) => String(record.pedidoProducaoId || "")).filter(Boolean)
  )];

  return {
    referenceId: String(referenceId),
    root,
    technicalRecords,
    technicalIds,
    linkedLots,
    linkedPieces,
    linkedMovements,
    expectedGroups,
    linkedOrderIds
  };
}

function productionReversalCoverage(referenceId = "") {
  const context = productionReversalContext(referenceId);
  if (!context) return null;
  const activePieces = context.linkedPieces.filter(pieceIsActive);
  const availablePieces = activePieces.filter((piece) => pieceStatusValue(piece) === "disponivel");
  const blockedPieces = activePieces.filter((piece) => pieceStatusValue(piece) !== "disponivel");
  const reversedPieces = context.linkedPieces.filter(isReversedRecord);
  const expectedQty = sum([...context.expectedGroups.values()], (group) => group.quantidade || 0);
  const expectedWeight = sum([...context.expectedGroups.values()], (group) => group.peso || 0);
  return {
    ...context,
    activePieces,
    availablePieces,
    blockedPieces,
    reversedPieces,
    expectedQty,
    expectedWeight,
    alreadyReversed: isReversedRecord(context.root),
    complete: expectedQty > 0 && activePieces.length === 0 && isReversedRecord(context.root)
  };
}

async function reverseProductionDocument(referenceId = "", {
  motivo = "",
  auditoriaId = ""
} = {}) {
  if (String(motivo || "").trim().length < 10) throw new Error("Informe uma justificativa válida para o estorno.");

  const coverage = productionReversalCoverage(referenceId);
  if (!coverage) throw new Error("Entrada de produção não encontrada.");
  if (coverage.complete) throw new Error("Esta entrada de produção já foi estornada por completo.");
  if (coverage.linkedOrderIds.length) {
    throw new Error(
      "Esta entrada está vinculada a pedido de produção. Para preservar o fluxo original, " +
      "o estorno automático desta modalidade foi bloqueado. Estorne primeiro os vínculos do pedido."
    );
  }
  if (coverage.blockedPieces.length) {
    const statuses = [...new Set(coverage.blockedPieces.map((piece) => pieceStatusValue(piece)))].join(", ");
    throw new Error(
      `Esta produção possui ${coverage.blockedPieces.length} peça(s) vinculada(s) a venda, reserva ou consignação (${statuses}). ` +
      "Estorne primeiro essas saídas e tente novamente."
    );
  }
  if (coverage.expectedQty > 0 && coverage.linkedPieces.length < coverage.expectedQty) {
    throw new Error(
      `Rastreabilidade incompleta da produção: esperado ${coverage.expectedQty}, localizado ${coverage.linkedPieces.length}. ` +
      "Nenhum saldo foi alterado."
    );
  }

  // Pré-validação obrigatória antes de alterar peças, lotes, peso ou movimentos.
  // A operação só começa quando todos os registros de produção possuem IDs reais.
  const recordsToPatch = new Map();
  const addProductionRecord = (record) => {
    const id = String(record?.id || "").trim();
    if (!id || id === "undefined" || id === "null") return;
    recordsToPatch.set(id, record);
  };
  addProductionRecord(coverage.root);
  for (const record of coverage.technicalRecords) addProductionRecord(record);

  if (!recordsToPatch.size) {
    throw new Error(
      "Rastreabilidade inválida da produção: nenhum identificador de registro foi localizado. " +
      "Nenhuma peça, peso, lote ou saldo foi alterado."
    );
  }

  const reversalFields = reversalActorFields(motivo);
  const removedByProduct = new Map();

  for (const piece of coverage.activePieces) {
    const produtoId = String(piece.produtoId || productIdFrom(piece) || "");
    if (produtoId) {
      const current = removedByProduct.get(produtoId) || { quantidade: 0 };
      current.quantidade += 1;
      removedByProduct.set(produtoId, current);
    }
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: "estornada",
      ...reversalFields,
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", piece.id, patch);
    localPatchCollection("pecasEstoque", piece.id, patch);
  }

  for (const lot of coverage.linkedLots) {
    if (isReversedRecord(lot)) continue;
    const patch = {
      statusAnteriorEstorno: lot.status || "",
      status: "estornado",
      quantidadeDisponivel: 0,
      ...reversalFields,
      atualizadoEm: nowIso()
    };
    await DB.patch("lotes", lot.id, patch);
    localPatchCollection("lotes", lot.id, patch);
  }

  const groupAudit = [];
  let removedWeight = 0;
  for (const [produtoId, expected] of coverage.expectedGroups.entries()) {
    const product = state.data?.produtos?.[produtoId];
    if (!product) continue;
    ensureIndependentWeightLedger(produtoId, product);

    const alreadyRemoved = coverage.alreadyReversed ||
      coverage.technicalRecords.every((record) => isReversedRecord(record));
    const weightDelta = alreadyRemoved ? 0 : numberSafe(expected.peso || 0);
    if (weightDelta > 0) {
      applyProductWeightLedgerDelta(produtoId, product, {
        entradaDelta: -weightDelta,
        motivo: `Estorno de entrada de produção justificado: ${motivo}`
      });
      removedWeight += weightDelta;
    }
    await syncProductAggregateFromPieces(produtoId, product);
    groupAudit.push({
      produtoId,
      quantidadeEstornada: removedByProduct.get(produtoId)?.quantidade || 0,
      pesoDocumento: numberSafe(expected.peso || 0),
      pesoRemovidoNestaExecucao: weightDelta
    });
  }

  for (const movement of coverage.linkedMovements) {
    if (isReversedRecord(movement)) continue;
    const patch = { status: "estornado", ...reversalFields, atualizadoEm: nowIso() };
    await DB.patch(movement.collection, movement.id, patch);
    localPatchCollection(movement.collection, movement.id, patch);
  }

  const productionPatch = {
    importacaoStatus: productionHeaderRecord(coverage.root) ? "estornada" : coverage.root.importacaoStatus,
    statusAnteriorEstorno: coverage.root.status || "",
    status: "estornada",
    ...reversalFields,
    estornoReconciliado: true,
    estornoQuantidadeEsperada: coverage.expectedQty,
    estornoQuantidadeVinculada: coverage.linkedPieces.length,
    estornoPecasRemovidasTotal: coverage.reversedPieces.length + coverage.activePieces.length,
    estornoPecasRemovidasNestaExecucao: coverage.activePieces.length,
    estornoPesoDocumento: coverage.expectedWeight,
    estornoPesoRemovidoNestaExecucao: removedWeight,
    estornoConcluidoEm: nowIso(),
    atualizadoEm: nowIso()
  };

  for (const [id, record] of recordsToPatch.entries()) {
    const patch = {
      ...productionPatch,
      importacaoStatus: productionHeaderRecord(record)
        ? "estornada"
        : (record.importacaoStatus || productionPatch.importacaoStatus || "")
    };
    await DB.patch("producoes", id, patch);
    localPatchCollection("producoes", id, patch);
  }

  const details = {
    colecao: "producoes",
    documentoId: referenceId,
    motivo,
    resumo: `Entrada de produção estornada: ${coverage.activePieces.length} peça(s) e ${formatNumber(removedWeight, 3)} g removidos do estoque.`,
    antes: coverage.root,
    depois: productionPatch,
    metadados: {
      tipoRegistro: coverage.root.tipoRegistro || "",
      producaoIds: [...recordsToPatch.keys()].filter((id) => id && id !== "undefined" && id !== "null"),
      lotes: coverage.linkedLots.map((lot) => lot.id),
      quantidadeEsperada: coverage.expectedQty,
      quantidadeVinculada: coverage.linkedPieces.length,
      pecasRemovidasNestaExecucao: coverage.activePieces.length,
      pesoDocumento: coverage.expectedWeight,
      pesoRemovidoNestaExecucao: removedWeight,
      grupos: groupAudit
    }
  };

  if (auditoriaId) await completeReversalAudit(auditoriaId, details);
  else await auditLogStrict("producao_estornada", {
    ...details,
    justificativaObrigatoria: true,
    statusAuditoria: "concluida"
  });
  return details;
}

async function requestReverseProduction(referenceId = "") {
  const record = state.data?.producoes?.[referenceId];
  if (!record) return alert("Entrada de produção não encontrada.");

  const label = record.numeroPedido || record.pedidoPdfNumero || record.lote || record.codigo || referenceId;
  const motivo = requireReversalReason({ tipo: "Entrada de produção", referencia: label });
  if (!motivo) return;

  const answer = prompt(
    `CONFIRMAÇÃO FINAL DO ESTORNO DA PRODUÇÃO\n\n` +
    `Referência: ${label}\n` +
    `Justificativa: ${motivo}\n\n` +
    `O sistema removerá somente as peças e o peso criados por esta entrada de produção. ` +
    `Se alguma peça ainda estiver vendida, reservada ou consignada, o estorno será bloqueado.\n\n` +
    `Para confirmar, digite: ESTORNAR PRODUCAO`
  );
  if (answer !== "ESTORNAR PRODUCAO") return;

  let auditoriaId = "";
  try {
    auditoriaId = await startReversalAudit({
      acao: "estorno_producao_solicitado",
      colecao: "producoes",
      documentoId: referenceId,
      motivo,
      resumo: `Solicitação de estorno da entrada de produção ${label}.`,
      antes: record,
      metadados: { referencia: label, tipoRegistro: record.tipoRegistro || "" }
    });
    await reverseProductionDocument(referenceId, { motivo, auditoriaId });
    await loadData();
    render();
    alert("Entrada de produção estornada. Quantidade, peso, peças e lote foram reconciliados e registrados na Auditoria.");
  } catch (err) {
    await failReversalAudit(auditoriaId, err);
    alert(err.message || "Não foi possível estornar a entrada de produção.");
  }
}

async function requestReverseSale(reference = "", pedido = "") {
  const records = saleRecordsForReverse(reference, pedido);
  if (!records.length) return alert("Venda não encontrada ou já estornada.");

  const label = pedido || records[0]?.numeroPedido || records[0]?.pedidoPdfNumero || records[0]?.id || "";
  const motivo = requireReversalReason({ tipo: "Venda", referencia: label });
  if (!motivo) return;

  const answer = prompt(
    `CONFIRMAÇÃO FINAL DO ESTORNO\n\n` +
    `Pedido/venda: ${label}\n` +
    `Justificativa: ${motivo}\n\n` +
    `O estorno devolverá quantidade e peso ao estoque. O motivo, usuário e data ficarão registrados na Auditoria.\n\n` +
    `Para confirmar, digite: ESTORNAR VENDA`
  );
  if (answer !== "ESTORNAR VENDA") return;

  let auditoriaId = "";
  try {
    auditoriaId = await startReversalAudit({
      acao: "estorno_venda_solicitado",
      colecao: "vendas",
      documentoId: records.map((sale) => sale.id).join(","),
      motivo,
      resumo: `Solicitação de estorno da venda/pedido ${label}.`,
      antes: records,
      metadados: { pedido: label, vendaIds: records.map((sale) => sale.id) }
    });

    await reverseSaleRecords(records, { motivo, auditoriaId });
    await loadData();
    render();
    alert("Venda estornada. Quantidade e peso devolvidos ao estoque. Justificativa registrada na Auditoria.");
  } catch (err) {
    await failReversalAudit(auditoriaId, err);
    alert(err.message || "Não foi possível estornar a venda.");
  }
}

async function requestReverseImport(documentId = "", collection = "") {
  const doc = state.data?.[collection]?.[documentId];
  if (!doc) return alert("PDF não encontrado.");

  const pedido = doc.numeroPedido || doc.pedidoPdfNumero || doc.pedidoNumero || documentId;
  const tipo = collection === "inventariosEstoque"
    ? "PDF de inventário/entrada"
    : collection === "producoes"
      ? "PDF de produção pronta"
      : "PDF de venda";
  const saleHeaderState = collection === "pedidos"
    ? salePdfHeaderReversalState(documentId, doc)
    : null;
  const isStatusCorrection = Boolean(saleHeaderState?.needsReconciliation);

  if (isStatusCorrection) {
    const motivo = requirePdfStatusCorrectionReason({ referencia: pedido });
    if (!motivo) return;

    const answer = prompt(
      `CONFIRMAÇÃO — CORRIGIR STATUS DO PDF\n\n` +
      `Pedido: ${pedido}\n` +
      `Motivo: ${motivo}\n\n` +
      `A venda já está estornada. Esta ação somente corrigirá o status do documento.\n` +
      `Nenhuma peça, quantidade, peso, lote ou saldo será movimentado novamente.\n\n` +
      `Para confirmar, digite: CORRIGIR STATUS`
    );
    if (answer !== "CORRIGIR STATUS") return;

    let auditoriaId = "";
    try {
      auditoriaId = await startReversalAudit({
        acao: "correcao_status_pdf_solicitada",
        colecao: collection,
        documentoId: documentId,
        motivo,
        resumo: `Solicitação de correção do status do PDF de venda, pedido ${pedido}.`,
        antes: doc,
        metadados: {
          pedido,
          tipo,
          semNovaMovimentacaoEstoque: true,
          linhasVendaJaEstornadas: saleHeaderState.reversedRows.length
        }
      });

      await reconcilePreviouslyReversedSalePdf(documentId, { motivo, auditoriaId });
      await loadData();
      render();
      alert("Status do PDF corrigido. O documento foi marcado como estornado e removido da lista ativa. Nenhuma peça, quantidade ou peso foi alterado.");
    } catch (err) {
      await failReversalAudit(auditoriaId, err);
      alert(err.message || "Não foi possível corrigir o status do PDF.");
    }
    return;
  }

  const motivo = requireReversalReason({ tipo, referencia: pedido });
  if (!motivo) return;

  const answer = prompt(
    `CONFIRMAÇÃO FINAL DO ESTORNO DE PDF\n\n` +
    `Pedido: ${pedido}\n` +
    `Tipo: ${tipo}\n` +
    `Justificativa: ${motivo}\n\n` +
    `A justificativa, o usuário, a data e o impacto ficarão registrados na Auditoria.\n\n` +
    `Para confirmar, digite: ESTORNAR PDF`
  );
  if (answer !== "ESTORNAR PDF") return;

  let auditoriaId = "";
  try {
    auditoriaId = await startReversalAudit({
      acao: collection === "inventariosEstoque"
        ? "estorno_inventario_pdf_solicitado"
        : collection === "producoes"
          ? "estorno_producao_pdf_solicitado"
          : "estorno_venda_pdf_solicitado",
      colecao: collection,
      documentoId: documentId,
      motivo,
      resumo: `Solicitação de estorno do ${tipo}, pedido ${pedido}.`,
      antes: doc,
      metadados: { pedido, tipo }
    });

    if (collection === "inventariosEstoque") {
      await reverseInventoryDocument(documentId, { motivo, auditoriaId });
    } else if (collection === "producoes") {
      await reverseProductionDocument(documentId, { motivo, auditoriaId });
    } else {
      const activeSales = saleRecordsForReverse(documentId, pedido);
      await reverseSaleRecords(
        activeSales,
        { motivo, documentoImportacaoId: documentId, auditoriaId }
      );
    }

    await loadData();
    render();
    alert("PDF estornado com sucesso. Justificativa e impacto registrados na Auditoria.");
  } catch (err) {
    await failReversalAudit(auditoriaId, err);
    alert(err.message || "Não foi possível estornar o PDF.");
  }
}


function setupReversalButtons() {
  document.querySelectorAll("[data-reverse-sale]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    requestReverseSale(button.dataset.reverseSale || "", button.dataset.reversePedido || "");
  }));
  document.querySelectorAll("[data-reverse-import]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    requestReverseImport(button.dataset.reverseImport || "", button.dataset.reverseCollection || "");
  }));
  document.querySelectorAll("[data-reverse-production]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    requestReverseProduction(button.dataset.reverseProduction || "");
  }));
}

function importView() {
  const parsed = state.parsedImport;
  const preview = parsed ? importPreview(parsed) : `<div class="import-choice-grid">
    <div class="import-choice-card"><strong>Importar inventário</strong><span>Entrada de estoque. Se o mesmo inventário já existir, o sistema recusa duplicidade.</span></div>
    <div class="import-choice-card"><strong>Importar venda</strong><span>Baixa o que existe no estoque e cria alerta do gestor para o que faltar.</span></div>
  </div>`;

  shell(`
    <section class="owner-page-head clean-page-head">
      <div>
        <span class="eyebrow">Importação de PDF</span>
        <h2>Escolha se o PDF entra como inventário ou venda.</h2>
        <p>Peso do PDF é peso total da linha. Valor financeiro não é usado no fluxo operacional.</p>
      </div>
    </section>

    <div class="card clean-panel import-panel">
      <h2>Enviar PDF</h2>
      <form id="pdfForm" class="form-row clean-import-form">
        <div class="field col-5">
          <label>Arquivo PDF</label>
          <input type="file" name="pdf" accept="application/pdf" required>
        </div>
        <div class="field col-4">
          <label>Tipo de importação</label>
          <select name="tipoImportacao" required>
            <option value="estoque_atual">Inventário / entrada de estoque</option>
            <option value="venda_inteligente">Venda / baixa de estoque</option>
            <option value="producao_pronta">Entrada manual de produção pronta</option>
            <option value="catalogo_pecas">Catálogo técnico / somente cadastro</option>
            <option value="consignacao">Consignação</option>
          </select>
        </div>
        <div class="field col-2">
          <label>Responsável</label>
          <input name="vendedor" placeholder="Nome">
        </div>
        <div class="field col-1 check-field">
          <label>&nbsp;</label>
          <span><input type="checkbox" name="extrairFotos" checked> Fotos</span>
        </div>
        <button class="btn btn-gold" type="submit">Extrair PDF</button>
      </form>
      <div class="import-rules-note">
        <div><b>Inventário</b><span>Soma estoque, cria peças físicas e bloqueia duplicidade por pedido + tipo.</span></div>
        <div><b>Venda</b><span>Baixa por código, descrição, material e medida. Falta vira alerta do gestor.</span></div>
      </div>
    </div>

    <div class="card" id="previewArea">
      ${preview}
    </div>

    <div class="card import-history-card">
      <div class="card-head"><div><h2>PDFs lançados recentemente</h2><p>Estorne inventário ou venda importada sem apagar a auditoria.</p></div><span class="badge blue">Rastreabilidade</span></div>
      ${recentImportDocumentsTable()}
    </div>
  `);

  document.getElementById("pdfForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const file = pdfFileFromForm(formEl);
    const tipoImportacao = normalizeImportType(form.get("tipoImportacao"));
    const vendedor = form.get("vendedor");
    const extrairFotos = form.get("extrairFotos") === "on";

    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    button.textContent = extrairFotos ? "Extraindo dados e fotos..." : "Extraindo dados...";

    try {
      const parsedPdf = await extractPdf(file, { extrairFotos });
      parsedPdf.tipoImportacao = tipoImportacao;
      parsedPdf.vendedor = vendedor;
      state.parsedImport = parsedPdf;
      render();
    } catch (err) {
      document.getElementById("previewArea").innerHTML = `<div class="notice danger">${escapeHtml(err.message)}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = "Extrair PDF";
    }
  });

  document.getElementById("confirmImportBtn")?.addEventListener("click", confirmImport);
  setupReversalButtons();
}

function importTypeInfo(tipoImportacao = "") {
  const tipo = normalizeImportType(tipoImportacao);

  if (tipo === "venda_inteligente") {
    return {
      label: "Pedido de venda inteligente",
      badge: `<span class="badge blue">Venda inteligente</span>`,
      confirmLabel: "Confirmar pedido inteligente",
      destino: "#/vendas",
      notice: "Ao confirmar, o sistema baixa do estoque as peças disponíveis por código, descrição, material e medida. O que faltar vira alerta urgente para o gestor analisar produção/reposição. Não gera produção automática e não permite estoque negativo."
    };
  }

  if (tipo === "venda_final") {
    return {
      label: "Venda final",
      badge: `<span class="badge success">Venda final</span>`,
      confirmLabel: "Confirmar venda final",
      destino: "#/vendas",
      notice: "Ao confirmar, o sistema cadastra/atualiza as joias, cria pedido comercial, baixa o estoque disponível e registra a movimentação operacional. Valores não são usados neste fluxo."
    };
  }

  if (tipo === "consignacao") {
    return {
      label: "Consignação pendente",
      badge: `<span class="badge warning">Consignação pendente</span>`,
      confirmLabel: "Confirmar consignação",
      destino: "#/consignacoes",
      notice: "Ao confirmar, o sistema cadastra/atualiza as joias, salva as fotos, cria pedido comercial e registra a saída para consignação pendente."
    };
  }

  if (tipo === "producao_pronta") {
    return {
      label: "Produção pronta",
      badge: `<span class="badge success">Produção pronta</span>`,
      confirmLabel: "Confirmar entrada de produção pronta",
      destino: "#/producao",
      notice: "Ao confirmar, o sistema cadastra/atualiza as joias, cria lote e cada unidade física. Se houver alerta de venda com produção aprovada para o mesmo SKU, atende primeiro a quantidade pendente da venda e deixa somente o excedente disponível no estoque. Pedidos de produção existentes continuam preservados."
    };
  }

  if (tipo === "pedido_producao") {
    return {
      label: "Pedido para produção",
      badge: `<span class="badge warning">Pedido para produção</span>`,
      confirmLabel: "Confirmar pedido para produção",
      destino: "#/producao",
      notice: "Ao confirmar, o sistema cadastra/atualiza as joias e registra a necessidade de produção manual. Não movimenta estoque, não cria venda e não cria consignação."
    };
  }

  if (tipo === "estoque_atual") {
    return {
      label: "Estoque atual / inventário",
      badge: `<span class="badge success">Estoque atual</span>`,
      confirmLabel: "Confirmar estoque atual",
      destino: "#/estoque",
      notice: "Ao confirmar, o sistema cadastra/atualiza as joias, registra o inventário e soma as peças ao estoque existente. O mesmo pedido não pode ser importado duas vezes como inventário. Peso do PDF é peso total da linha."
    };
  }

  return {
    label: "Catálogo de peças",
    badge: `<span class="badge blue">Catálogo</span>`,
    confirmLabel: "Confirmar catálogo",
    destino: "#/produtos",
    notice: "Ao confirmar, o sistema apenas cadastra ou atualiza as joias e fotos. Código, medida e material formam peças diferentes. Não gera pedido e não movimenta estoque."
  };
}

function importPreview(parsed) {
  const typeInfo = importTypeInfo(parsed.tipoImportacao);
  const statusBadge = typeInfo.badge;
  const itens = (parsed.itens || []).filter(isValidOperationalItem);
  const totalPecas = sum(itens, (item) => item.quantidade || 0);
  const materiais = [...new Set(itens.map((item) => item.material).filter(Boolean))];
  const codigos = [...new Set(itens.map((item) => item.codigo).filter(Boolean))];
  const medidas = itens.map((item) => String(item.medida || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const primeiraMedida = medidas[0] || "-";
  const ultimaMedida = medidas[medidas.length - 1] || "-";

  const rows = itens.map((item) => `
    <tr>
      <td>${(item.fotoPreviewUrl || item.fotoDataUrl) ? `<img class="product-thumb" src="${escapeHtml(item.fotoPreviewUrl || item.fotoDataUrl)}" alt="Foto extraída do PDF">` : `<div class="product-thumb"></div>`}</td>
      <td><strong>${escapeHtml(item.codigo || "")}</strong><small>${escapeHtml(item.tipo || "Produto")}</small></td>
      <td>${escapeHtml(item.descricao || "")}</td>
      <td>${escapeHtml(item.material || "-")}</td>
      <td>${escapeHtml(item.medida || "-")}</td>
      <td class="num"><strong>${formatNumber(item.quantidade || 0, 0)}</strong></td>
      <td class="num">${formatNumber(lineWeightTotal(item), 3)} g</td>
      <td class="num">${formatNumber(unitWeightFromLine(item), 3)} g</td>
    </tr>
  `).join("\n");

  return `
    <div class="import-review-shell">
      <div class="import-review-header">
        <div>
          <h2>Conferência da importação ${statusBadge}</h2>
          <p>Confira o resumo antes de gravar. A tabela se adapta ao PC e ao celular sem rolagem lateral.</p>
        </div>
        <button class="btn btn-primary btn-wide-mobile" id="confirmImportBtn">${escapeHtml(typeInfo.confirmLabel)}</button>
      </div>

      <div class="import-summary-grid">
        <div class="report-kpi"><span>Pedido PDF</span><strong>${escapeHtml(parsed.header.numeroPedido || "-")}</strong><small>${escapeHtml(parsed.header.dataPedido || "-")}</small></div>
        <div class="report-kpi"><span>Tipo</span><strong>${escapeHtml(typeInfo.label)}</strong><small>${escapeHtml(parsed.header.tipoPedido || "-")}</small></div>
        <div class="report-kpi"><span>Itens válidos</span><strong>${formatNumber(itens.length, 0)}</strong><small>linhas de produto</small></div>
        <div class="report-kpi"><span>Peças previstas</span><strong>${formatNumber(totalPecas, 0)}</strong><small>unidades físicas</small></div>
        <div class="report-kpi"><span>Código(s)</span><strong>${escapeHtml(codigos.length === 1 ? codigos[0] : formatNumber(codigos.length, 0))}</strong><small>${codigos.length === 1 ? "principal" : "códigos diferentes"}</small></div>
        <div class="report-kpi"><span>Material</span><strong>${escapeHtml(materiais.join(", ") || "-")}</strong><small>detectado no PDF</small></div>
        <div class="report-kpi"><span>Medidas</span><strong>${escapeHtml(primeiraMedida)} até ${escapeHtml(ultimaMedida)}</strong><small>${formatNumber(new Set(medidas).size, 0)} medida(s)</small></div>
        <div class="report-kpi"><span>Fotos</span><strong>${formatNumber(parsed.fotosExtraidas || 0, 0)}</strong><small>capturadas</small></div>
      </div>

      <div class="notice ${isCatalogImport(parsed.tipoImportacao) ? "blue" : "success"}"><strong>${escapeHtml(typeInfo.label)}.</strong><br>${escapeHtml(typeInfo.notice)}</div>
      ${parsed.fotosExtraidas ? `<div class="notice success"><strong>Fotos prontas para vincular.</strong><br>Ao confirmar, as imagens capturadas do PDF serão tratadas para salvar somente a joia, sem linhas e textos do relatório.</div>` : `<div class="notice warning"><strong>Nenhuma foto capturada.</strong><br>Se o PDF não tiver miniaturas visíveis, o sistema importa os dados e permite cadastrar as fotos depois.</div>`}

      ${itens.length ? `
        <div class="table-toolbar no-print">
          <strong>Itens para gravar</strong>
          <span>${formatNumber(itens.length, 0)} linha(s), ${formatNumber(totalPecas, 0)} peça(s)</span>
        </div>
        <div class="table-wrap table-wrap-fit import-preview-table">
          <table class="compact-table">
            <thead>
              <tr>
                <th>Foto</th><th>Código</th><th>Descrição</th><th>Material</th><th>Medida</th><th>Qtd</th><th>Peso total linha</th><th>Média de referência</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      ` : `<div class="notice danger">Nenhum item válido foi extraído automaticamente. O parser ignorou rodapés/totais para evitar estoque falso.</div>`}

      <details style="margin-top:16px">
        <summary>Ver conferência técnica da importação</summary>
        <pre class="preview-json">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>
      </details>
    </div>
  `;
}


function normalizeLooseText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "")
    .toUpperCase();
}

function normalizeLooseMedida(value = "") {
  return String(value || "")
    .trim()
    .replace(/^0+(?=\d)/, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function materialLooseToken(value = "") {
  const raw = normalizeLooseText(value);
  if (!raw) return "";
  if (raw.includes("PRATA") || raw.includes("925")) return "PRATA";
  if (raw.includes("10K")) return "OURO10K";
  if (raw.includes("18K") || raw === "OURO") return raw.includes("18K") ? "OURO18K" : "OURO";
  if (raw.includes("OURO")) return raw.includes("10K") ? "OURO10K" : (raw.includes("18K") ? "OURO18K" : "OURO");
  return raw;
}

function compatibleMaterial(imported = "", existing = "") {
  const a = materialLooseToken(imported);
  const b = materialLooseToken(existing);
  if (!a || !b) return true;
  if (a === b) return true;

  // PDF de venda pode trazer apenas "OURO" enquanto o cadastro está "Ouro 18K".
  // Isso não deve impedir a baixa; mas Ouro x Prata continua bloqueado.
  if (a === "OURO" && b.startsWith("OURO")) return true;
  if (b === "OURO" && a.startsWith("OURO")) return true;
  return false;
}

function productMatchScoreForStockMovement(item = {}, product = {}) {
  const itemCode = normalizeStockCode(item.codigo || item.codigoOriginal || "");
  const productCode = normalizeStockCode(product.codigo || product.codigoOriginal || "");
  if (!itemCode || !productCode || itemCode !== productCode) return -1;

  const itemMedida = normalizeLooseMedida(item.medida || inferMedida(`${item.codigoOriginal || ""} ${item.descricao || ""} ${item.observacao || ""}`));
  const productMedida = normalizeLooseMedida(product.medida || "");
  if (itemMedida && productMedida && itemMedida !== productMedida) return -1;

  const itemMaterial = item.material || inferMaterial(`${item.codigoOriginal || ""} ${item.descricao || ""} ${item.observacao || ""}`);
  const productMaterial = product.material || "";
  if (!compatibleMaterial(itemMaterial, productMaterial)) return -1;
  if (!operationalSaleDescriptionCompatible(item, product, product)) return -1;

  const disponiveisFisicos = availablePiecesForProduct(product.id).length;
  const disponivelAgregado = Math.max(0, quantitySafe(product.estoqueDisponivel || 0));

  let score = 100;
  if (itemMedida && productMedida && itemMedida === productMedida) score += 30;
  if (itemMaterial && productMaterial && materialLooseToken(itemMaterial) === materialLooseToken(productMaterial)) score += 20;
  if (disponiveisFisicos > 0) score += 1000 + disponiveisFisicos;
  else if (disponivelAgregado > 0) score += 500 + disponivelAgregado;
  if (String(product.estoqueModelo || "") === "peca_fisica_unica") score += 10;

  return score;
}

function findExistingProductForStockMovement(item = {}) {
  return objectToArray(state.data?.produtos || {})
    .filter(isValidOperationalItem)
    .map((product) => ({ product, score: productMatchScoreForStockMovement(item, product) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.product || null;
}

async function upsertProductFromItem(item, options = {}) {
  let finalItem = { ...(item || {}) };
  let id = productIdFrom(finalItem);
  let existing = state.data.produtos[id] || {};
  let matchedExisting = false;

  if (options.preferExistingStockMatch) {
    const match = findExistingProductForStockMovement(finalItem);
    if (match?.id) {
      id = match.id;
      existing = state.data.produtos[id] || match;
      matchedExisting = true;
      finalItem = {
        ...finalItem,
        descricao: finalItem.descricao || existing.descricao || "",
        tipo: finalItem.tipo || existing.tipo || "",
        medida: finalItem.medida || existing.medida || "",
        material: finalItem.material || existing.material || ""
      };
    }
  }

  const existingUrl = String(existing.fotoUrl || "");
  const existingPhotoIsManual = existing.fotoOrigem === "manual";

  const importedPhoto = finalItem.fotoUrl || finalItem.fotoDataUrl || "";
  const finalPhotoUrl = existingPhotoIsManual
    ? existing.fotoUrl
    : (importedPhoto || existing.fotoUrl || "");

  const product = {
    ...existing,
    codigo: existing.codigo || finalItem.codigo,
    codigoOriginal: existing.codigoOriginal || finalItem.codigoOriginal || finalItem.codigo,
    descricao: existing.descricao || finalItem.descricao || "",
    tipo: existing.tipo || finalItem.tipo || inferTipo(finalItem.descricao, finalItem.codigo),
    material: existing.material || finalItem.material || inferMaterial(`${finalItem.descricao} ${finalItem.observacao}`),
    medida: existing.medida || finalItem.medida || "",
    pesoMedio: existing.pesoMedio || finalItem.pesoUnitarioEstimado || unitWeightFromLine(finalItem, finalItem.quantidade || 0) || 0,
    fotoUrl: finalPhotoUrl,
    fotoOrigem: finalPhotoUrl
      ? (existingPhotoIsManual ? (existing.fotoOrigem || "manual") : "pdf_importado")
      : (existing.fotoOrigem || ""),
    estoqueDisponivel: quantitySafe(existing.estoqueDisponivel || 0),
    estoqueConsignado: quantitySafe(existing.estoqueConsignado || 0),
    estoqueVendido: quantitySafe(existing.estoqueVendido || 0),
    estoqueMinimo: quantitySafe(existing.estoqueMinimo ?? existing.estoqueCritico ?? state.data.configuracoes?.estoqueMinimoPadrao ?? APP_CONFIG.negocio.estoqueMinimoPadrao ?? 3),
    estoqueCritico: quantitySafe(existing.estoqueCritico ?? existing.estoqueMinimo ?? state.data.configuracoes?.estoqueMinimoPadrao ?? APP_CONFIG.negocio.estoqueMinimoPadrao ?? 3),
    estoqueIdeal: quantitySafe(existing.estoqueIdeal ?? state.data.configuracoes?.estoqueIdealPadrao ?? 7),
    estoqueSugestao: quantitySafe(existing.estoqueSugestao ?? existing.estoqueSugerido ?? state.data.configuracoes?.estoqueSugestaoPadrao ?? 7),
    atualizadoEm: nowIso()
  };
  state.data.produtos[id] = product;
  await DB.save("produtos", id, product);
  return { id, product, item: finalItem, matchedExisting };
}

async function registerMovement({ produtoId, tipo, quantidade, peso, pedidoId, origem, observacao }) {
  const movimento = {
    produtoId,
    tipo,
    quantidade: quantitySafe(quantidade || 0),
    peso: numberSafe(peso || 0),
    pedidoId: pedidoId || "",
    origem: origem || "manual",
    observacao: observacao || "",
    criadoEm: nowIso(),
    criadoPor: state.user?.email || "",
    criadoPorUid: state.user?.uid || ""
  };
  const movimentoId = await DB.push("movimentos", movimento);
  await auditLog("movimento_estoque", {
    colecao: "movimentos",
    documentoId: movimentoId,
    motivo: observacao || `Movimento automático: ${tipo}`,
    resumo: `${tipo} · produto ${produtoId} · qtd ${quantidade}`,
    depois: movimento
  });
  return movimentoId;
}

function quantitySafe(value = 0) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function numberSafe(value = 0) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let raw = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9,.-]+/g, "")
    .trim();

  if (!raw || raw === "," || raw === "." || raw === "-" || raw === "-.") return 0;

  const isNegative = raw.startsWith("-");
  raw = raw.replace(/-/g, "");

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  let normalized = raw;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, "").replace(/,/g, ".")
      : raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = raw.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = raw.split(".");
    normalized = parts.length === 2 && parts[1].length === 3 && parts[0].length > 1
      ? parts.join("")
      : raw;
  }

  const n = Number((isNegative ? "-" : "") + normalized);
  return Number.isFinite(n) ? n : 0;
}

function lineWeightTotal(item = {}, quantidadeFallback = 0) {
  const explicit = item.pesoTotalLinha ?? item.pesoTotalReferencia ?? item.pesoTotalPdf ?? item.pesoTotal;
  const value = explicit !== undefined && explicit !== null && explicit !== "" ? explicit : item.peso;
  return Math.max(0, numberSafe(value));
}

function unitWeightFromLine(item = {}, quantidadeFallback = 0) {
  const qtd = quantitySafe(item.quantidade || quantidadeFallback || 0);
  const explicitUnit = item.pesoUnitarioEstimado ?? item.pesoUnitarioReferencia ?? item.pesoUnitarioPedido ?? item.pesoUnitario ?? item.pesoReal;
  if (explicitUnit !== undefined && explicitUnit !== null && explicitUnit !== "") {
    const explicitValue = numberSafe(explicitUnit);
    if (explicitValue > 0) return explicitValue;
  }
  const total = lineWeightTotal(item, qtd);
  return qtd > 0 && total > 0 ? total / qtd : 0;
}

function lineWeightForQuantity(item = {}, quantidadeParcial = 0, quantidadeTotal = 0) {
  const qtdTotal = quantitySafe(quantidadeTotal || item.quantidade || 0);
  const qtdParcial = quantitySafe(quantidadeParcial || 0);
  const pesoTotal = lineWeightTotal(item, qtdTotal);
  if (!qtdTotal || !qtdParcial || !pesoTotal) return 0;
  return (pesoTotal / qtdTotal) * qtdParcial;
}


function stockStatusFromQuantities({ solicitada = 0, baixada = 0, faltante = 0 } = {}) {
  const qtdSolicitada = quantitySafe(solicitada);
  const qtdBaixada = quantitySafe(baixada);
  const qtdFaltante = quantitySafe(faltante);
  if (qtdSolicitada && qtdBaixada >= qtdSolicitada && !qtdFaltante) return "baixada_total";
  if (qtdBaixada > 0 && qtdFaltante > 0) return "baixada_parcial_alerta_gestor";
  if (qtdFaltante > 0) return "sem_estoque_alerta_gestor";
  return "sem_movimento";
}

function stockStatusBadge(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "baixada_total") return `<span class="badge success">Baixada</span>`;
  if (normalized === "baixada_parcial_producao") return `<span class="badge warning">Parcial + produção</span>`;
  if (normalized === "reservada_total") return `<span class="badge blue">Reservada</span>`;
  if (normalized === "reservada_parcial_producao") return `<span class="badge warning">Reservada + produção</span>`;
  if (normalized === "pendente_producao") return `<span class="badge danger">Pendências de produção</span>`;
  if (normalized === "baixada_parcial_alerta_gestor") return `<span class="badge warning">Baixada parcial + alerta</span>`;
  if (normalized === "sem_estoque_alerta_gestor") return `<span class="badge danger">Sem estoque + alerta</span>`;
  return `<span class="badge muted">Sem baixa</span>`;
}


function productionOrderRequestedQuantity(order = {}) {
  return quantitySafe(
    order.quantidadePedida ??
    order.quantidadeSolicitada ??
    order.quantidadeSolicitadaVenda ??
    order.quantidade ??
    order.quantidadePendente ??
    0
  );
}

function productionOrderProducedQuantity(order = {}) {
  return quantitySafe(order.quantidadeProduzida || 0);
}

function productionOrderPendingQuantity(order = {}) {
  const explicit = order.quantidadePendente ?? order.quantidadeFaltanteVenda;
  if (explicit !== undefined && explicit !== null && explicit !== "") return quantitySafe(explicit);
  return Math.max(0, productionOrderRequestedQuantity(order) - productionOrderProducedQuantity(order));
}

function productionOrderSaleId(order = {}) {
  return order.vendaId || order.vendaItemId || order.vendaOrigemId || "";
}

function isProductionOrderOpen(order = {}) {
  const status = String(order.status || "pendente").toLowerCase();
  if (["concluido", "concluida", "cancelado", "cancelada", "finalizado", "finalizada", "atendido", "atendida"].includes(status)) return false;
  return productionOrderPendingQuantity(order) > 0;
}

function pendingProductionOrders() {
  return objectToArray(state.data?.pedidosProducao || {})
    .filter(isValidOperationalItem)
    .filter(isProductionOrderOpen)
    .sort((a, b) => {
      const pa = String(a.prioridade || "").toLowerCase() === "alta" ? 1 : 0;
      const pb = String(b.prioridade || "").toLowerCase() === "alta" ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return String(b.criadoEm || "").localeCompare(String(a.criadoEm || ""));
    });
}

function productionOrderStatusBadge(order = {}) {
  const pending = productionOrderPendingQuantity(order);
  const produced = productionOrderProducedQuantity(order);
  const status = String(order.status || "pendente").toLowerCase();
  if (!pending) return `<span class="badge success">Atendida</span>`;
  if (produced > 0 || status.includes("parcial")) return `<span class="badge warning">Parcial</span>`;
  if (productionOrderSaleId(order)) return `<span class="badge danger">Venda pendente</span>`;
  return `<span class="badge blue">Pendências de produção</span>`;
}

function productionOrderOriginLabel(order = {}) {
  const origem = String(order.origem || order.tipo || order.tipoRegistro || "").toLowerCase();
  if (productionOrderSaleId(order) || origem.includes("venda")) return "Venda sem estoque";
  if (origem.includes("pdf")) return "Pedido PDF";
  return "Produção";
}

function productionOrdersByProductOptions(orders = []) {
  if (!orders.length) return `<option value="">Sem pedido vinculado — entrada livre</option>`;
  return [
    `<option value="">Sem pedido vinculado — entrada livre</option>`,
    ...orders.map((order) => `<option value="${escapeHtml(order.id)}">${escapeHtml(order.codigo || "")} · Nº ${escapeHtml(order.medida || "-")} · ${escapeHtml(order.material || "-")} · ${formatNumber(order.pesoUnitarioPedido || order.pesoIdentificador || 0, 3)} g · pendente ${formatNumber(productionOrderPendingQuantity(order), 0)} · ${escapeHtml(order.numeroPedido || order.pedidoPdfNumero || order.numeroPedidoVenda || "")}</option>`)
  ].join("\n");
}

function isAlertProductionApproved(alert = {}) {
  const decision = String(alert.decisaoGestor || alert.decisao || "").toLowerCase();
  const status = String(alert.status || "").toLowerCase();
  return decision === "produzir" || status.startsWith("producao_aprovada") || quantitySafe(alert.quantidadeProducaoAprovada || 0) > 0;
}

function alertApprovedProductionQty(alert = {}) {
  return quantitySafe(alert.quantidadeProducaoAprovada || 0);
}

function alertReceivedProductionQty(alert = {}) {
  return quantitySafe(alert.quantidadeProducaoRecebida || 0);
}

function alertApprovedProductionRemaining(alert = {}) {
  return Math.max(0, alertApprovedProductionQty(alert) - alertReceivedProductionQty(alert));
}

function approvedProductionAlertsForProduct(produtoId = "") {
  const product = state.data?.produtos?.[produtoId] || {};
  return objectToArray(state.data?.alertasOperacionais || {})
    .filter(isValidOperationalItem)
    .filter(isAlertProductionApproved)
    .filter((alert) => alertApprovedProductionRemaining(alert) > 0)
    .filter((alert) => {
      if (String(alert.produtoId || "") === String(produtoId || "")) return true;
      const sameCode = normalizeStockCode(alert.codigo || alert.codigoOriginal || "") === normalizeStockCode(product.codigo || product.codigoOriginal || "");
      const sameMeasure = normalizeLooseMedida(alert.medida || "") === normalizeLooseMedida(product.medida || "");
      const sameMaterial = compatibleMaterial(alert.material || "", product.material || "");
      return Boolean(sameCode && sameMeasure && sameMaterial);
    })
    .sort((a, b) => String(a.producaoAprovadaEm || a.aprovadoEm || a.criadoEm || "").localeCompare(String(b.producaoAprovadaEm || b.aprovadoEm || b.criadoEm || "")));
}

function pieceAccountingWeight(piece = {}) {
  return Math.max(0, numberSafe(
    piece.pesoBaixaReal ||
    piece.pesoReal ||
    piece.pesoUnitario ||
    piece.pesoUnitarioEstimado ||
    piece.pesoRateioReferencia ||
    0
  ));
}

function weightForPieceIds(pieceIds = [], fallbackTotal = 0, fallbackQuantity = 0) {
  const qtd = Math.max(0, quantitySafe(fallbackQuantity || pieceIds.length || 0));
  const fallbackUnit = qtd > 0 ? Math.max(0, numberSafe(fallbackTotal || 0)) / qtd : 0;
  return (pieceIds || []).reduce((total, id) => {
    const known = pieceAccountingWeight(state.data?.pecasEstoque?.[id] || {});
    return total + (known > 0 ? known : fallbackUnit);
  }, 0);
}

async function syncLotsFromPhysicalPieces(loteIds = []) {
  const unique = [...new Set((loteIds || []).filter(Boolean))];
  for (const loteId of unique) {
    const lote = state.data?.lotes?.[loteId];
    if (!lote) continue;
    const pieces = physicalPieces().filter((piece) => pieceIsActive(piece) && String(piece.loteId || "") === String(loteId));
    const disponiveis = pieces.filter((piece) => pieceStatusValue(piece) === "disponivel").length;
    const vendidos = pieces.filter((piece) => pieceStatusValue(piece) === "vendido").length;
    const patch = {
      quantidadeDisponivel: disponiveis,
      quantidadeVendida: vendidos,
      status: disponiveis > 0 ? "disponivel" : "esgotado",
      atualizadoEm: nowIso()
    };
    await DB.patch("lotes", loteId, patch);
    localPatchCollection("lotes", loteId, patch);
  }
}

function saleRowRequestedQty(sale = {}) {
  if (Array.isArray(sale.itens) && sale.itens.length) return sum(sale.itens, (item) => quantitySafe(item.quantidadeSolicitada || item.quantidade || 0));
  return quantitySafe(sale.quantidadeSolicitada || sale.quantidadeTotal || sale.quantidade || 0);
}

function saleRowDownloadedQty(sale = {}) {
  if (Array.isArray(sale.itens) && sale.itens.length) return sum(sale.itens, (item) => quantitySafe(item.quantidadeBaixada || 0));
  return quantitySafe(sale.quantidadeBaixadaTotal || sale.quantidadeBaixada || 0);
}

function saleRowMissingQty(sale = {}) {
  if (Array.isArray(sale.itens) && sale.itens.length) {
    return sum(sale.itens, (item) => {
      const explicit = quantitySafe(item.quantidadePendenteAnaliseGestor || 0) + quantitySafe(item.quantidadePendenteProducao || 0);
      const requested = quantitySafe(item.quantidadeSolicitada || item.quantidade || 0);
      const downloaded = quantitySafe(item.quantidadeBaixada || 0);
      return Math.max(explicit, Math.max(0, requested - downloaded));
    });
  }
  const explicit = quantitySafe(sale.quantidadePendenteAnaliseGestor || 0) + quantitySafe(sale.quantidadePendenteProducao || 0);
  return Math.max(explicit, Math.max(0, saleRowRequestedQty(sale) - saleRowDownloadedQty(sale)));
}

function saleItemMatchesAlert(item = {}, alert = {}) {
  if (alert.id && String(item.alertaGestorId || "") === String(alert.id)) return true;
  if (alert.produtoId && String(item.produtoId || "") === String(alert.produtoId)) return true;
  const sameCode = normalizeStockCode(item.codigo || "") === normalizeStockCode(alert.codigo || alert.codigoOriginal || "");
  const sameMeasure = normalizeLooseMedida(item.medida || "") === normalizeLooseMedida(alert.medida || "");
  const sameMaterial = compatibleMaterial(item.material || "", alert.material || "");
  return Boolean(sameCode && sameMeasure && sameMaterial);
}

async function syncCommercialOrderFromSales(documentoId = "") {
  if (!documentoId || !state.data?.pedidos?.[documentoId]) return null;
  const rows = objectToArray(state.data?.vendas || {})
    .filter(isValidOperationalItem)
    .filter((sale) => String(sale.pedidoId || sale.origemDocumentoId || "") === String(documentoId));
  if (!rows.length) return null;

  const solicitada = sum(rows, saleRowRequestedQty);
  const baixada = sum(rows, saleRowDownloadedQty);
  const analise = sum(rows, (sale) => quantitySafe(sale.quantidadePendenteAnaliseGestor || 0));
  const producao = sum(rows, (sale) => quantitySafe(sale.quantidadePendenteProducao || 0));
  const faltante = Math.max(0, analise + producao);
  const finalizada = solicitada > 0 && faltante === 0 && baixada >= solicitada;
  const patch = {
    quantidadeSolicitadaTotal: solicitada,
    quantidadeBaixadaTotal: baixada,
    quantidadePendenteAnaliseGestor: analise,
    quantidadePendenteProducao: producao,
    quantidadeFaltanteTotal: faltante,
    statusEstoque: stockStatusFromQuantities({ solicitada, baixada, faltante }),
    status: finalizada ? "finalizada" : (producao > 0 ? "producao_aprovada" : "pendente_analise_gestor"),
    atualizadoEm: nowIso()
  };
  if (finalizada) {
    patch.finalizadaEm = nowIso();
    patch.concluidaEm = patch.finalizadaEm;
  }
  await DB.patch("pedidos", documentoId, patch);
  localPatchCollection("pedidos", documentoId, patch);
  return patch;
}

async function patchSaleProductionApprovalFromAlert(alert = {}, approvedTotal = 0, receivedTotal = 0) {
  const vendaId = String(alert.vendaId || "");
  const sale = state.data?.vendas?.[vendaId];
  if (!sale) return null;

  const approvalRemaining = Math.max(0, quantitySafe(approvedTotal) - quantitySafe(receivedTotal));
  const patch = { atualizadoEm: nowIso() };

  if (Array.isArray(sale.itens) && sale.itens.length) {
    let remainingApprovalForItem = approvalRemaining;
    const itens = sale.itens.map((original) => {
      const item = { ...original };
      if (!saleItemMatchesAlert(item, alert)) return item;
      const requested = quantitySafe(item.quantidadeSolicitada || item.quantidade || 0);
      const downloaded = quantitySafe(item.quantidadeBaixada || 0);
      const missing = Math.max(
        quantitySafe(item.quantidadePendenteAnaliseGestor || 0) + quantitySafe(item.quantidadePendenteProducao || 0),
        Math.max(0, requested - downloaded)
      );
      const productionPending = Math.min(missing, remainingApprovalForItem);
      const analysisPending = Math.max(0, missing - productionPending);
      remainingApprovalForItem = Math.max(0, remainingApprovalForItem - productionPending);
      return {
        ...item,
        quantidadePendenteProducao: productionPending,
        quantidadePendenteAnaliseGestor: analysisPending,
        producaoAprovadaViaAlerta: true,
        producaoAlertaId: alert.id || "",
        quantidadeProducaoAprovada: quantitySafe(approvedTotal),
        quantidadeProducaoRecebida: quantitySafe(receivedTotal),
        statusEstoque: analysisPending > 0
          ? stockStatusFromQuantities({ solicitada: requested, baixada: downloaded, faltante: missing })
          : (productionPending > 0 ? (downloaded > 0 ? "baixada_parcial_producao" : "pendente_producao") : stockStatusFromQuantities({ solicitada: requested, baixada: downloaded, faltante: 0 }))
      };
    });
    const requested = sum(itens, (item) => item.quantidadeSolicitada || item.quantidade || 0);
    const downloaded = sum(itens, (item) => item.quantidadeBaixada || 0);
    const analysisPending = sum(itens, (item) => item.quantidadePendenteAnaliseGestor || 0);
    const productionPending = sum(itens, (item) => item.quantidadePendenteProducao || 0);
    Object.assign(patch, {
      itens,
      quantidadeTotal: requested,
      quantidadeBaixadaTotal: downloaded,
      quantidadePendenteAnaliseGestor: analysisPending,
      quantidadePendenteProducao: productionPending,
      statusEstoque: stockStatusFromQuantities({ solicitada: requested, baixada: downloaded, faltante: analysisPending + productionPending }),
      status: analysisPending > 0 ? "pendente_analise_gestor" : (productionPending > 0 ? "producao_aprovada" : (downloaded >= requested ? "finalizada" : sale.status || "pendente"))
    });
  } else {
    const missing = saleRowMissingQty(sale);
    const productionPending = Math.min(missing, approvalRemaining);
    const analysisPending = Math.max(0, missing - productionPending);
    const downloaded = saleRowDownloadedQty(sale);
    const requested = saleRowRequestedQty(sale);
    Object.assign(patch, {
      quantidadePendenteProducao: productionPending,
      quantidadePendenteAnaliseGestor: analysisPending,
      producaoAprovadaViaAlerta: true,
      producaoAlertaId: alert.id || "",
      quantidadeProducaoAprovada: quantitySafe(approvedTotal),
      quantidadeProducaoRecebida: quantitySafe(receivedTotal),
      statusEstoque: analysisPending > 0
        ? stockStatusFromQuantities({ solicitada: requested, baixada: downloaded, faltante: analysisPending + productionPending })
        : (productionPending > 0 ? (downloaded > 0 ? "baixada_parcial_producao" : "pendente_producao") : stockStatusFromQuantities({ solicitada: requested, baixada: downloaded, faltante: 0 })),
      status: analysisPending > 0 ? "pendente_analise_gestor" : (productionPending > 0 ? "producao_aprovada" : (downloaded >= requested ? "finalizada" : sale.status || "pendente"))
    });
  }

  await DB.patch("vendas", vendaId, patch);
  localPatchCollection("vendas", vendaId, patch);
  await syncCommercialOrderFromSales(sale.pedidoId || sale.origemDocumentoId || alert.origemDocumentoId || "");
  return { id: vendaId, ...sale, ...patch };
}

async function approveManagerAlertProduction(alertId = "") {
  const alertRecord = state.data?.alertasOperacionais?.[alertId];
  if (!alertRecord) return window.alert("Alerta não encontrado.");
  const missing = alertMissingQty(alertRecord);
  const received = alertReceivedProductionQty(alertRecord);
  const currentApproved = alertApprovedProductionQty(alertRecord);
  const suggested = Math.max(currentApproved, received + missing, missing);
  const raw = prompt(
    `Produção aprovada para ${alertRecord.codigo || "produto"} Nº ${alertRecord.medida || "-"}.\n\nFaltante atual da venda: ${missing} peça(s).\nJá recebido desta aprovação: ${received} peça(s).\n\nInforme a QUANTIDADE TOTAL que será produzida.\nExemplo: faltam 10, produzirá 20 → digite 20.`,
    String(suggested || missing || 1)
  );
  if (raw === null) return;
  const approved = quantitySafe(raw);
  if (!approved) return window.alert("Informe uma quantidade válida maior que zero.");
  if (approved < received) return window.alert(`A quantidade aprovada não pode ser menor que o que já foi recebido (${received}).`);

  const remainingApproval = Math.max(0, approved - received);
  const patch = {
    status: remainingApproval > 0 ? "producao_aprovada" : (missing > 0 ? "pendente" : "resolvido"),
    decisaoGestor: "produzir",
    quantidadeProducaoAprovada: approved,
    quantidadeProducaoRecebida: received,
    quantidadeProducaoPendenteRecebimento: remainingApproval,
    quantidadeAplicadaVenda: quantitySafe(alertRecord.quantidadeAplicadaVenda || 0),
    quantidadeExcedenteEstoque: quantitySafe(alertRecord.quantidadeExcedenteEstoque || 0),
    producaoAprovadaEm: alertRecord.producaoAprovadaEm || nowIso(),
    producaoAprovadaAtualizadaEm: nowIso(),
    producaoAprovadaPor: state.user?.email || state.user?.uid || "",
    producaoAprovadaPorUid: state.user?.uid || "",
    atualizadoEm: nowIso()
  };
  await DB.patch("alertasOperacionais", alertId, patch);
  localPatchCollection("alertasOperacionais", alertId, patch);
  await patchSaleProductionApprovalFromAlert({ id: alertId, ...alertRecord, ...patch }, approved, received);
  await auditLog("producao_aprovada_em_alerta", {
    colecao: "alertasOperacionais",
    documentoId: alertId,
    motivo: "Gestor aprovou produção de item faltante sem criar ordem de produção.",
    resumo: `${alertRecord.codigo || ""} · Nº ${alertRecord.medida || "-"} · faltante venda ${missing} · produção aprovada ${approved}`,
    antes: alertRecord,
    depois: { ...alertRecord, ...patch }
  });
  await loadData();
  render();
}

async function updateSaleAfterApprovedAlertFulfillment({ alert = {}, quantidadeBaixada = 0, pecasBaixadas = [], pesoBaixado = 0, approvalRemainingAfter = 0 } = {}) {
  const vendaId = String(alert.vendaId || "");
  const sale = state.data?.vendas?.[vendaId];
  const qtd = quantitySafe(quantidadeBaixada || 0);
  if (!sale || !qtd) return null;

  const patch = { atualizadoEm: nowIso() };
  if (Array.isArray(sale.itens) && sale.itens.length) {
    let remainingToApply = qtd;
    let weightRemaining = Math.max(0, numberSafe(pesoBaixado || 0));
    const itens = sale.itens.map((original) => {
      const item = { ...original };
      if (!remainingToApply || !saleItemMatchesAlert(item, alert)) return item;
      const requested = quantitySafe(item.quantidadeSolicitada || item.quantidade || 0);
      const downloadedBefore = quantitySafe(item.quantidadeBaixada || 0);
      const missingBefore = Math.max(0, requested - downloadedBefore);
      const apply = Math.min(remainingToApply, missingBefore);
      const downloadedAfter = Math.min(requested, downloadedBefore + apply);
      const missingAfter = Math.max(0, requested - downloadedAfter);
      const productionPendingAfter = Math.min(missingAfter, Math.max(0, quantitySafe(approvalRemainingAfter || 0)));
      const analysisPendingAfter = Math.max(0, missingAfter - productionPendingAfter);
      const weightApplied = remainingToApply > 0 ? weightRemaining * (apply / remainingToApply) : 0;
      remainingToApply -= apply;
      weightRemaining = Math.max(0, weightRemaining - weightApplied);
      return {
        ...item,
        quantidadeBaixada: downloadedAfter,
        quantidadePendenteProducao: productionPendingAfter,
        quantidadePendenteAnaliseGestor: analysisPendingAfter,
        pecasBaixadas: [...(item.pecasBaixadas || []), ...(pecasBaixadas || []).slice(0, apply)],
        pesoTotalBaixado: Math.max(0, numberSafe(item.pesoTotalBaixado || 0) + weightApplied),
        pesoTotalFaltante: missingAfter > 0 ? Math.max(0, numberSafe(alert.pesoUnitarioReferencia || 0) * missingAfter) : 0,
        producaoAprovadaViaAlerta: true,
        producaoAlertaId: alert.id || "",
        statusEstoque: missingAfter > 0
          ? (analysisPendingAfter > 0 ? stockStatusFromQuantities({ solicitada: requested, baixada: downloadedAfter, faltante: missingAfter }) : (downloadedAfter > 0 ? "baixada_parcial_producao" : "pendente_producao"))
          : "baixada_total"
      };
    });
    const requested = sum(itens, (item) => item.quantidadeSolicitada || item.quantidade || 0);
    const downloaded = sum(itens, (item) => item.quantidadeBaixada || 0);
    const analysisPending = sum(itens, (item) => item.quantidadePendenteAnaliseGestor || 0);
    const productionPending = sum(itens, (item) => item.quantidadePendenteProducao || 0);
    Object.assign(patch, {
      itens,
      quantidadeTotal: requested,
      quantidadeBaixadaTotal: downloaded,
      quantidadePendenteAnaliseGestor: analysisPending,
      quantidadePendenteProducao: productionPending,
      pesoTotalBaixado: sum(itens, (item) => item.pesoTotalBaixado || 0),
      pesoTotalFaltante: sum(itens, (item) => item.pesoTotalFaltante || 0),
      statusEstoque: stockStatusFromQuantities({ solicitada: requested, baixada: downloaded, faltante: analysisPending + productionPending }),
      status: analysisPending + productionPending > 0 ? (analysisPending > 0 ? "pendente_analise_gestor" : "producao_aprovada") : "finalizada"
    });
    if (!(analysisPending + productionPending)) patch.finalizadaEm = nowIso();
  } else {
    const requested = saleRowRequestedQty(sale);
    const downloadedBefore = saleRowDownloadedQty(sale);
    const downloadedAfter = Math.min(requested, downloadedBefore + qtd);
    const missingAfter = Math.max(0, requested - downloadedAfter);
    const productionPendingAfter = Math.min(missingAfter, Math.max(0, quantitySafe(approvalRemainingAfter || 0)));
    const analysisPendingAfter = Math.max(0, missingAfter - productionPendingAfter);
    const weightDownloaded = Math.max(0, numberSafe(sale.pesoTotalBaixado || 0) + numberSafe(pesoBaixado || 0));
    const referenceUnit = numberSafe(alert.pesoUnitarioReferencia || 0);
    Object.assign(patch, {
      quantidadeBaixada: downloadedAfter,
      quantidadePendenteProducao: productionPendingAfter,
      quantidadePendenteAnaliseGestor: analysisPendingAfter,
      pecasBaixadas: [...(sale.pecasBaixadas || []), ...(pecasBaixadas || [])],
      pesoTotalBaixado: weightDownloaded,
      pesoTotalFaltante: missingAfter > 0 ? Math.max(0, referenceUnit * missingAfter) : 0,
      producaoAprovadaViaAlerta: true,
      producaoAlertaId: alert.id || "",
      statusEstoque: missingAfter > 0
        ? (analysisPendingAfter > 0 ? stockStatusFromQuantities({ solicitada: requested, baixada: downloadedAfter, faltante: missingAfter }) : (downloadedAfter > 0 ? "baixada_parcial_producao" : "pendente_producao"))
        : "baixada_total",
      status: missingAfter > 0 ? (analysisPendingAfter > 0 ? "pendente_analise_gestor" : "producao_aprovada") : "finalizada"
    });
    if (!missingAfter) patch.finalizadaEm = nowIso();
  }

  await DB.patch("vendas", vendaId, patch);
  localPatchCollection("vendas", vendaId, patch);
  await syncCommercialOrderFromSales(sale.pedidoId || sale.origemDocumentoId || alert.origemDocumentoId || "");
  return { id: vendaId, ...sale, ...patch };
}

async function applyProductionToApprovedAlerts({ produtoId = "", product = {}, quantidadeProduzida = 0, pieceIds = [], producaoId = "", documentoId = "", origem = "producao_pronta", pesoTotal = 0 } = {}) {
  const qtdProduzida = Math.min(quantitySafe(quantidadeProduzida || 0), pieceIds.length || quantitySafe(quantidadeProduzida || 0));
  if (!produtoId || !qtdProduzida) return { quantidadeRecebidaAprovada: 0, quantidadeBaixadaVendas: 0, quantidadeExcedenteEstoque: qtdProduzida, alertasAtendidos: [] };

  const approvedAlerts = approvedProductionAlertsForProduct(produtoId);
  if (!approvedAlerts.length) {
    await syncProductAggregateFromPieces(produtoId, product);
    return { quantidadeRecebidaAprovada: 0, quantidadeBaixadaVendas: 0, quantidadeExcedenteEstoque: qtdProduzida, alertasAtendidos: [] };
  }

  let cursor = 0;
  let remaining = qtdProduzida;
  let totalReceived = 0;
  let totalSold = 0;
  let totalWeightSold = 0;
  const touchedLots = new Set();
  const touchedDocuments = new Set();
  const results = [];

  for (const alert of approvedAlerts) {
    if (!remaining) break;
    const approvalRemainingBefore = alertApprovedProductionRemaining(alert);
    if (!approvalRemainingBefore) continue;
    const receiveNow = Math.min(remaining, approvalRemainingBefore);
    const saleMissingBefore = alertMissingQty(alert);
    const sellNow = Math.min(receiveNow, saleMissingBefore);
    const approvalPieceIds = pieceIds.slice(cursor, cursor + receiveNow);
    const salePieceIds = approvalPieceIds.slice(0, sellNow);
    cursor += receiveNow;
    remaining -= receiveNow;

    const weightSold = sellNow > 0
      ? weightForPieceIds(salePieceIds, qtdProduzida > 0 ? (numberSafe(pesoTotal || 0) / qtdProduzida) * sellNow : 0, sellNow)
      : 0;
    let moved = [];
    if (sellNow > 0) {
      moved = await markSpecificPiecesAsSold(salePieceIds, {
        vendaId: alert.vendaId || "",
        pedidoId: alert.origemDocumentoId || documentoId || "",
        numeroPedidoVenda: alert.numeroPedido || alert.pedidoPdfNumero || "",
        origem: "producao_aprovada_alerta_atendeu_venda",
        observacao: `Produção pronta ${producaoId} atendeu item pendente da venda ${alert.vendaId || ""}, aprovado no alerta ${alert.id}.`
      });
      for (const id of moved) {
        const piece = state.data?.pecasEstoque?.[id] || {};
        if (piece.loteId) touchedLots.add(piece.loteId);
      }
      applyProductWeightLedgerDelta(produtoId, product, {
        saidaDelta: weightSold,
        motivo: "Produção pronta aplicada automaticamente à venda parcial aprovada pelo gestor."
      });
      await registerMovement({
        produtoId,
        tipo: "baixa_venda_producao_aprovada",
        quantidade: sellNow,
        peso: weightSold,
        pedidoId: alert.vendaId || alert.origemDocumentoId || documentoId,
        origem,
        observacao: `Baixa automática após entrada de produção aprovada no alerta ${alert.id}. Excedente permanece no estoque.`
      });
    }

    const receivedAfter = alertReceivedProductionQty(alert) + receiveNow;
    const approvedTotal = alertApprovedProductionQty(alert);
    const approvalRemainingAfter = Math.max(0, approvedTotal - receivedAfter);
    const saleMissingAfter = Math.max(0, saleMissingBefore - sellNow);
    const productionPendingSaleAfter = Math.min(saleMissingAfter, approvalRemainingAfter);
    const analysisPendingAfter = Math.max(0, saleMissingAfter - productionPendingSaleAfter);
    const excessNow = Math.max(0, receiveNow - sellNow);
    const status = saleMissingAfter === 0
      ? (approvalRemainingAfter > 0 ? "producao_aprovada_excedente_pendente" : "resolvido")
      : (approvalRemainingAfter > 0 ? "producao_aprovada_parcial" : "pendente");
    const alertPatch = {
      status,
      quantidadeFaltante: saleMissingAfter,
      quantidadePendenteAnalise: analysisPendingAfter,
      quantidadePendenteAnaliseGestor: analysisPendingAfter,
      quantidadePendenteProducao: productionPendingSaleAfter,
      quantidadeProducaoRecebida: receivedAfter,
      quantidadeProducaoPendenteRecebimento: approvalRemainingAfter,
      quantidadeAplicadaVenda: quantitySafe(alert.quantidadeAplicadaVenda || 0) + sellNow,
      quantidadeExcedenteEstoque: quantitySafe(alert.quantidadeExcedenteEstoque || 0) + excessNow,
      ultimaProducaoId: producaoId || "",
      ultimoDocumentoProducaoId: documentoId || "",
      ultimaEntradaProducaoEm: nowIso(),
      atualizadoEm: nowIso()
    };
    if (status === "resolvido") alertPatch.resolvidoEm = nowIso();
    await DB.patch("alertasOperacionais", alert.id, alertPatch);
    localPatchCollection("alertasOperacionais", alert.id, alertPatch);

    if (sellNow > 0) {
      const updatedSale = await updateSaleAfterApprovedAlertFulfillment({
        alert,
        quantidadeBaixada: sellNow,
        pecasBaixadas: moved,
        pesoBaixado: weightSold,
        approvalRemainingAfter
      });
      if (updatedSale?.pedidoId || updatedSale?.origemDocumentoId) touchedDocuments.add(updatedSale.pedidoId || updatedSale.origemDocumentoId);
    }

    await auditLog("producao_pronta_aplicada_alerta_venda", {
      colecao: "alertasOperacionais",
      documentoId: alert.id,
      motivo: "Entrada de produção pronta conciliada com produção aprovada no alerta da venda.",
      resumo: `${alert.codigo || product.codigo || ""} · recebido ${receiveNow} · venda ${sellNow} · estoque ${excessNow} · faltante venda ${saleMissingAfter}`,
      antes: alert,
      depois: { ...alert, ...alertPatch, producaoId, pecasBaixadas: moved }
    });

    totalReceived += receiveNow;
    totalSold += sellNow;
    totalWeightSold += weightSold;
    results.push({
      alertaId: alert.id,
      vendaId: alert.vendaId || "",
      recebido: receiveNow,
      baixadoVenda: sellNow,
      excedenteEstoque: excessNow,
      faltanteVenda: saleMissingAfter,
      producaoAprovadaPendente: approvalRemainingAfter,
      pecasBaixadas: moved
    });
  }

  await syncLotsFromPhysicalPieces([...touchedLots]);
  await syncProductAggregateFromPieces(produtoId, product);
  for (const documento of touchedDocuments) await syncCommercialOrderFromSales(documento);

  return {
    quantidadeRecebidaAprovada: totalReceived,
    quantidadeBaixadaVendas: totalSold,
    pesoBaixadoVendas: totalWeightSold,
    quantidadeExcedenteEstoque: Math.max(0, qtdProduzida - totalSold),
    quantidadeSemAprovacao: Math.max(0, qtdProduzida - totalReceived),
    alertasAtendidos: results
  };
}

async function markSpecificPiecesAsSold(pieceIds = [], { vendaId = "", pedidoId = "", numeroPedidoVenda = "", origem = "", observacao = "" } = {}) {
  const moved = [];
  for (const pieceId of pieceIds.filter(Boolean)) {
    const piece = state.data?.pecasEstoque?.[pieceId] || {};
    const patch = {
      statusAnterior: piece.status || "disponivel",
      status: "vendido",
      documentoBaixaId: vendaId || pedidoId || "",
      vendaId: vendaId || "",
      pedidoVendaId: pedidoId || "",
      numeroPedidoVenda: numeroPedidoVenda || piece.numeroPedidoVenda || "",
      pesoBaixaReal: pieceAccountingWeight(piece),
      pesoUnitarioBaixa: pieceAccountingWeight(piece),
      baixaOrigem: origem || "producao_atendeu_venda",
      baixaObservacao: observacao || "Peça produzida e baixada automaticamente para venda pendente.",
      baixadaEm: nowIso(),
      atualizadoEm: nowIso()
    };
    await DB.patch("pecasEstoque", pieceId, patch);
    localPatchCollection("pecasEstoque", pieceId, patch);
    moved.push(pieceId);
  }
  return moved;
}

function saleRecordStatusAfterProduction({ solicitada = 0, baixada = 0, pendente = 0 } = {}) {
  return {
    statusEstoque: stockStatusFromQuantities({ solicitada, baixada, faltante: pendente }),
    status: pendente > 0 ? "pendente_producao" : "finalizada"
  };
}

async function updateSaleAfterProductionFulfillment({ vendaId = "", pedidoProducao = {}, quantidadeBaixada = 0, pecasBaixadas = [], pesoBaixado = 0 } = {}) {
  const qtd = quantitySafe(quantidadeBaixada);
  const pesoAplicado = Math.max(0, numberSafe(pesoBaixado || 0));
  if (!vendaId || !qtd) return null;

  const venda = state.data?.vendas?.[vendaId];
  if (!venda) return null;

  const patch = { atualizadoEm: nowIso() };
  const produtoId = pedidoProducao.produtoId || "";

  if (Array.isArray(venda.itens)) {
    const itens = venda.itens.map((item) => ({ ...item }));
    let remaining = qtd;
    for (const item of itens) {
      const sameOrder = pedidoProducao.id && item.pedidoProducaoId === pedidoProducao.id;
      const sameProduct = produtoId && item.produtoId === produtoId;
      if (!remaining || (!sameOrder && !sameProduct)) continue;
      const pending = quantitySafe(item.quantidadePendenteAnaliseGestor ?? item.quantidadePendenteProducao ?? Math.max(0, quantitySafe(item.quantidadeSolicitada || item.quantidade || 0) - quantitySafe(item.quantidadeBaixada || 0)));
      const apply = Math.min(remaining, pending || remaining);
      item.quantidadeBaixada = quantitySafe(item.quantidadeBaixada || 0) + apply;
      item.quantidadePendenteProducao = Math.max(0, pending - apply);
      item.quantidadePendenteAnaliseGestor = item.quantidadePendenteProducao;
      item.pecasBaixadas = [...(item.pecasBaixadas || []), ...pecasBaixadas.slice(0, apply)];
      item.statusEstoque = stockStatusFromQuantities({ solicitada: item.quantidadeSolicitada || item.quantidade, baixada: item.quantidadeBaixada, faltante: item.quantidadePendenteProducao });
      remaining -= apply;
    }

    const quantidadeTotal = sum(itens, (item) => item.quantidadeSolicitada || item.quantidade || 0);
    const quantidadeBaixadaTotal = sum(itens, (item) => item.quantidadeBaixada || 0);
    const quantidadePendenteProducao = sum(itens, (item) => item.quantidadePendenteProducao || 0);
    const pesoTotalBaixado = Math.max(0, numberSafe(venda.pesoTotalBaixado || 0) + pesoAplicado);
    const pesoTotalSolicitado = Math.max(pesoTotalBaixado, numberSafe(venda.pesoTotalSolicitado || venda.pesoTotal || 0));
    Object.assign(patch, {
      itens,
      quantidadeTotal,
      quantidadeBaixadaTotal,
      quantidadePendenteProducao,
      quantidadePendenteAnaliseGestor: quantidadePendenteProducao,
      pesoTotalSolicitado,
      pesoTotalBaixado,
      pesoTotalFaltante: Math.max(0, pesoTotalSolicitado - pesoTotalBaixado),
      ...saleRecordStatusAfterProduction({ solicitada: quantidadeTotal, baixada: quantidadeBaixadaTotal, pendente: quantidadePendenteProducao })
    });
  } else {
    const solicitada = quantitySafe(venda.quantidadeSolicitada || venda.quantidade || qtd);
    const baixadaAtual = quantitySafe(venda.quantidadeBaixada || 0);
    const pendenteAtual = quantitySafe(venda.quantidadePendenteAnaliseGestor ?? venda.quantidadePendenteProducao ?? Math.max(0, solicitada - baixadaAtual));
    const apply = Math.min(qtd, pendenteAtual || qtd);
    const baixadaNova = Math.min(solicitada, baixadaAtual + apply);
    const pendenteNova = Math.max(0, pendenteAtual - apply);
    const pesoTotalBaixado = Math.max(0, numberSafe(venda.pesoTotalBaixado || 0) + pesoAplicado);
    const pesoTotalSolicitado = Math.max(pesoTotalBaixado, numberSafe(venda.pesoTotalSolicitado || venda.pesoTotal || 0));
    Object.assign(patch, {
      quantidadeBaixada: baixadaNova,
      quantidadePendenteProducao: pendenteNova,
      quantidadePendenteAnaliseGestor: pendenteNova,
      pesoTotalSolicitado,
      pesoTotalBaixado,
      pesoTotalFaltante: Math.max(0, pesoTotalSolicitado - pesoTotalBaixado),
      pecasBaixadas: [...(venda.pecasBaixadas || []), ...pecasBaixadas.slice(0, apply)],
      ...saleRecordStatusAfterProduction({ solicitada, baixada: baixadaNova, pendente: pendenteNova })
    });
  }

  await DB.patch("vendas", vendaId, patch);
  localPatchCollection("vendas", vendaId, patch);
  return { id: vendaId, ...venda, ...patch };
}

async function applyProductionToPendingOrder({ pedidoProducao = null, produtoId = "", product = {}, quantidadeProduzida = 0, pieceIds = [], producaoId = "", documentoId = "", origem = "producao_manual", pesoTotal = 0 } = {}) {
  if (!pedidoProducao?.id) return { quantidadeAplicada: 0, quantidadeBaixadaVenda: 0, pecasBaixadas: [] };

  const qtdProduzida = quantitySafe(quantidadeProduzida);
  const pendenteAntes = productionOrderPendingQuantity(pedidoProducao) || qtdProduzida;
  const qtdAplicada = Math.min(qtdProduzida, pendenteAntes);
  const produzidaAnterior = productionOrderProducedQuantity(pedidoProducao);
  const produzidaNova = produzidaAnterior + qtdAplicada;
  const totalPedido = Math.max(productionOrderRequestedQuantity(pedidoProducao), produzidaNova);
  const pendenteNova = Math.max(0, totalPedido - produzidaNova);
  const vendaId = productionOrderSaleId(pedidoProducao);
  const pendenteVendaAntes = vendaId
    ? quantitySafe(pedidoProducao.quantidadePendenteVenda ?? pedidoProducao.quantidadeFaltanteVenda ?? pendenteAntes)
    : 0;
  const quantidadeVenda = vendaId ? Math.min(qtdAplicada, pendenteVendaAntes, pieceIds.length || qtdAplicada) : 0;
  const pesoBaixadoPosProducao = pesoTotal && qtdProduzida
    ? (numberSafe(pesoTotal) / qtdProduzida) * quantidadeVenda
    : 0;
  const pecasParaVenda = pieceIds.slice(0, quantidadeVenda);
  let pecasBaixadas = [];

  if (vendaId && quantidadeVenda > 0) {
    pecasBaixadas = await markSpecificPiecesAsSold(pecasParaVenda, {
      vendaId,
      pedidoId: pedidoProducao.origemDocumentoId || pedidoProducao.pedidoVendaId || documentoId,
      origem: "producao_atendeu_venda_pendente",
      observacao: `Produção ${producaoId} atendeu venda pendente ${vendaId}.`
    });

    await updateSaleAfterProductionFulfillment({
      vendaId,
      pedidoProducao,
      quantidadeBaixada: quantidadeVenda,
      pecasBaixadas,
      pesoBaixado: pesoBaixadoPosProducao
    });
    if (pesoBaixadoPosProducao > 0) {
      applyProductWeightLedgerDelta(produtoId, product, {
        saidaDelta: pesoBaixadoPosProducao,
        motivo: "Produção pronta aplicada imediatamente a uma venda pendente."
      });
    }

    await registerMovement({
      produtoId,
      tipo: "baixa_venda_pos_producao",
      quantidade: quantidadeVenda,
      peso: pesoBaixadoPosProducao,
      pedidoId: vendaId,
      origem,
      observacao: `Baixa automática da venda pendente após entrada da produção ${producaoId}. Pedido de produção ${pedidoProducao.id}.`
    });
  }

  const patch = {
    quantidadeProduzida: produzidaNova,
    quantidadePendente: pendenteNova,
    quantidadePendenteVenda: pendenteNova,
    ultimoProducaoId: producaoId || "",
    atualizadoEm: nowIso(),
    status: pendenteNova > 0 ? "produzido_parcial" : "concluido"
  };
  if (!pendenteNova) {
    patch.concluidoEm = nowIso();
    patch.atendidoEm = nowIso();
  }
  if (vendaId) {
    patch.quantidadeBaixadaVenda = quantitySafe(pedidoProducao.quantidadeBaixadaVenda || 0) + quantidadeVenda;
    patch.quantidadePendenteVenda = Math.max(0, pendenteVendaAntes - quantidadeVenda);
    patch.statusVendaPendente = patch.quantidadePendenteVenda > 0 ? "parcialmente_atendida" : "atendida";
  }

  await DB.patch("pedidosProducao", pedidoProducao.id, patch);
  localPatchCollection("pedidosProducao", pedidoProducao.id, patch);
  const pecasReservadasFinalizadas = vendaId
    ? await finalizeReservedPiecesForSale({
        vendaId,
        pedidoId: pedidoProducao.origemDocumentoId || pedidoProducao.pedidoVendaId || documentoId,
        produtoId,
        observacao: `Venda inteligente atendida após produção ${producaoId}. Reservas convertidas em venda.`
      })
    : [];

  await syncProductAggregateFromPieces(produtoId, product);

  await auditLog("pedido_producao_atualizado", {
    colecao: "pedidosProducao",
    documentoId: pedidoProducao.id,
    motivo: vendaId ? "Produção pronta atendeu venda pendente" : "Produção pronta vinculada ao pedido de produção",
    resumo: `${pedidoProducao.codigo || product.codigo || ""} · produzido ${qtdAplicada} · pendente ${pendenteNova}`,
    depois: { ...pedidoProducao, ...patch, producaoId, pecasBaixadas, pecasReservadasFinalizadas }
  });

  return { quantidadeAplicada: qtdAplicada, quantidadeBaixadaVenda: quantidadeVenda, pecasBaixadas };
}

function proportionalItemValues(item = {}, quantidadeTotal = 0, quantidadeParcial = 0) {
  const qtdTotal = quantitySafe(quantidadeTotal || item.quantidade || 0);
  const qtdParcial = quantitySafe(quantidadeParcial || 0);
  const pesoUnitario = unitWeightFromLine(item, qtdTotal);

  return {
    pesoUnitario,
    pesoTotal: lineWeightForQuantity(item, qtdParcial, qtdTotal)
  };
}

function saleWeightValues(item = {}, quantidadeTotal = 0, quantidadeBaixada = 0) {
  const qtdSolicitada = Math.max(0, quantitySafe(quantidadeTotal || item.quantidade || item.quantidadeSolicitada || 0));
  const qtdBaixada = Math.max(0, quantitySafe(quantidadeBaixada || 0));
  const totalExplicit = numberSafe(
    item.pesoTotalRealVenda ?? item.pesoTotalVenda ?? item.pesoTotalBaixado ??
    item.pesoTotalLinha ?? item.pesoTotal ?? 0
  );
  const unitExplicit = numberSafe(item.pesoUnitarioRealVenda ?? item.pesoUnitarioVenda ?? 0);
  const totalSolicitado = totalExplicit > 0 ? totalExplicit : (unitExplicit > 0 && qtdSolicitada > 0 ? unitExplicit * qtdSolicitada : 0);
  const fatorBaixa = qtdSolicitada > 0 ? Math.min(1, qtdBaixada / qtdSolicitada) : 0;
  const pesoTotal = qtdBaixada > 0 ? totalSolicitado * fatorBaixa : 0;
  const pesoUnitarioRateado = qtdBaixada > 0 ? pesoTotal / qtdBaixada : 0;
  return {
    pesoUnitario: numberSafe(pesoUnitarioRateado),
    pesoTotal: numberSafe(pesoTotal),
    pesoTotalSolicitado: numberSafe(totalSolicitado),
    origemPeso: totalSolicitado > 0 ? "peso_total_real_informado_na_venda" : "sem_peso_informado",
    rateado: qtdBaixada > 1
  };
}

function assertSaleWeightAvailable(produtoId = "", product = {}, pesoParaBaixa = 0, item = {}) {
  const peso = Math.max(0, numberSafe(pesoParaBaixa || 0));
  if (!(peso > 0)) return true;
  const saldo = productWeightLedgerSnapshot(produtoId, product).disponivel;
  if (peso > saldo + 0.0005) {
    throw new Error(`Venda bloqueada para ${item.codigo || product.codigo || "SKU"} Nº${item.medida || product.medida || "-"}: peso informado ${formatNumber(peso, 3)} g, mas o estoque possui ${formatNumber(saldo, 3)} g. Nenhum saldo negativo foi gravado.`);
  }
  return true;
}

function salePreflightForItems(items = [], { parsed = {}, manual = false } = {}) {
  const rows = [];
  let solicitado = 0;
  let disponivel = 0;
  let faltante = 0;
  let linhasSemSaldo = 0;
  let pesoSolicitado = 0;
  let pesoBaixavel = 0;
  let pesoInsuficiente = 0;
  let linhasPesoInsuficiente = 0;

  // Simula o carrinho em sequência para não contar o mesmo saldo duas vezes
  // quando o mesmo SKU aparece em mais de uma linha.
  const saldoQuantidade = new Map();
  const saldoPeso = new Map();

  for (const item of items || []) {
    const qtd = quantitySafe(item.quantidade || item.quantidadeSolicitada || 0);
    if (!qtd) continue;
    const produtoId = item.produtoId || productIdFrom(item);
    const product = item.produtoId ? state.data.produtos?.[item.produtoId] : (state.data.produtos?.[produtoId] || {});
    const chaveSaldo = String(produtoId || saleStockKey(item));

    const estoqueQuantidadeInicial = availablePiecesForSaleOperationalItem(item, item.produtoId || produtoId || "").length;
    const quantidadeRestante = saldoQuantidade.has(chaveSaldo)
      ? saldoQuantidade.get(chaveSaldo)
      : estoqueQuantidadeInicial;
    const baixavel = Math.min(qtd, Math.max(0, quantidadeRestante));
    const falta = Math.max(0, qtd - baixavel);
    saldoQuantidade.set(chaveSaldo, Math.max(0, quantidadeRestante - baixavel));

    const stats = product?.id || produtoId
      ? productPhysicalStats({ ...product, id: product.id || produtoId })
      : { pesoDisponivel: 0 };
    const pesoRestante = saldoPeso.has(chaveSaldo)
      ? saldoPeso.get(chaveSaldo)
      : Math.max(0, numberSafe(stats.pesoDisponivel || product.pesoTotalDisponivel || 0));
    const valoresSolicitados = saleWeightValues(item, qtd, qtd);
    const valoresBaixa = saleWeightValues(item, qtd, baixavel);
    const pesoPretendido = Math.max(0, numberSafe(valoresBaixa.pesoTotal || 0));
    const faltaPeso = pesoPretendido > pesoRestante + 0.0005
      ? pesoPretendido - pesoRestante
      : 0;
    saldoPeso.set(chaveSaldo, Math.max(0, pesoRestante - pesoPretendido));

    solicitado += qtd;
    disponivel += baixavel;
    faltante += falta;
    pesoSolicitado += Math.max(0, numberSafe(valoresSolicitados.pesoTotalSolicitado || valoresSolicitados.pesoTotal || 0));
    pesoBaixavel += Math.min(pesoPretendido, pesoRestante);
    pesoInsuficiente += faltaPeso;
    if (falta > 0) linhasSemSaldo += 1;
    if (faltaPeso > 0) linhasPesoInsuficiente += 1;

    rows.push({
      codigo: item.codigo || product.codigo || "",
      descricao: item.descricao || product.descricao || "",
      material: item.material || product.material || "",
      medida: item.medida || product.medida || "",
      solicitado: qtd,
      baixavel,
      faltante: falta,
      pesoSolicitado: numberSafe(valoresSolicitados.pesoTotalSolicitado || valoresSolicitados.pesoTotal || 0),
      pesoParaBaixa: pesoPretendido,
      pesoDisponivel: pesoRestante,
      pesoInsuficiente: faltaPeso
    });
  }

  return { solicitado, disponivel, faltante, linhasSemSaldo, pesoSolicitado, pesoBaixavel, pesoInsuficiente, linhasPesoInsuficiente, rows, manual };
}

function confirmSalePreflight(preflight = {}, { tipo = "venda" } = {}) {
  if (!preflight.solicitado) return true;

  if (numberSafe(preflight.pesoInsuficiente || 0) > 0) {
    const resumoPeso = (preflight.rows || [])
      .filter((row) => numberSafe(row.pesoInsuficiente || 0) > 0)
      .slice(0, 8)
      .map((row) => `- ${row.codigo || "SKU"} Nº${row.medida || "-"}: venda ${formatNumber(row.pesoParaBaixa || 0, 3)} g, disponível ${formatNumber(row.pesoDisponivel || 0, 3)} g`)
      .join("\n");
    alert(`VENDA BLOQUEADA: o peso total real informado é maior que o peso disponível no estoque.\n\n${resumoPeso}\n\nCorrija o peso da venda ou ajuste a entrada de estoque. O sistema não permite saldo negativo de material.`);
    return false;
  }

  if (!preflight.faltante) return true;

  const resumo = preflight.rows
    .filter((row) => row.faltante > 0)
    .slice(0, 8)
    .map((row) => `- ${row.codigo || "SKU"} Nº${row.medida || "-"}: pedido ${row.solicitado}, baixa ${row.baixavel}, falta ${row.faltante}`)
    .join("\n");

  const semSaldoTotal = preflight.disponivel === 0;
  const mensagem = semSaldoTotal
    ? `ATENÇÃO: você escolheu ${tipo.toUpperCase()}, mas NÃO há estoque disponível para baixar.

Solicitado: ${preflight.solicitado} peça(s)
Baixável agora: 0 peça(s)
Faltante: ${preflight.faltante} peça(s)

Isso parece ENTRADA lançada como VENDA.

${resumo}

Para continuar mesmo assim e criar alerta do gestor, digite: VENDA SEM ESTOQUE`
    : `ATENÇÃO: essa ${tipo} tem falta parcial de estoque.

Solicitado: ${preflight.solicitado} peça(s)
Baixável agora: ${preflight.disponivel} peça(s)
Faltante: ${preflight.faltante} peça(s)

${resumo}

Para continuar e gerar alerta do gestor, digite: CONFIRMAR VENDA PARCIAL`;

  const esperado = semSaldoTotal ? "VENDA SEM ESTOQUE" : "CONFIRMAR VENDA PARCIAL";
  const resposta = prompt(mensagem);
  return resposta === esperado;
}

async function createManagerShortageAlertFromSale({
  produtoId,
  product = {},
  item = {},
  parsed = {},
  documentoId = "",
  vendaId = "",
  quantidadeSolicitada = 0,
  quantidadeBaixada = 0,
  quantidadeFaltante = 0,
  origem = "venda_inteligente_pdf",
  motivo = "Venda inteligente sem estoque suficiente"
}) {
  const qtdFaltante = quantitySafe(quantidadeFaltante);
  if (!qtdFaltante) return "";
  const lojaEnv = technicalLojaEnvValue(item);
  const numeroPedido = parsed.header?.numeroPedido || "";
  const clienteNome = parsed.header?.clienteNome || parsed.cliente || "";
  const valores = proportionalItemValues(item, quantidadeSolicitada || item.quantidade, qtdFaltante);
  const alert = {
    tipoRegistro: "alerta_gestor_venda_sem_estoque",
    tipo: "venda_sem_estoque",
    status: "pendente",
    prioridade: "urgente",
    origemDocumentoId: documentoId || "",
    vendaId: vendaId || "",
    pedidoPdfNumero: numeroPedido,
    numeroPedido,
    cliente: clienteNome,
    produtoId,
    codigo: item.codigo || product.codigo || "",
    codigoOriginal: item.codigoOriginal || item.codigo || product.codigoOriginal || product.codigo || "",
    descricao: item.descricao || product.descricao || "",
    medida: item.medida || product.medida || "",
    material: item.material || product.material || "",
    quantidadeSolicitada: quantitySafe(quantidadeSolicitada),
    quantidadeBaixada: quantitySafe(quantidadeBaixada),
    quantidadeFaltante: qtdFaltante,
    quantidadePendenteAnalise: qtdFaltante,
    pesoTotalReferencia: valores.pesoTotal,
    pesoUnitarioReferencia: valores.pesoUnitario,
    lojaCodigo: lojaEnv.lojaCodigo,
    envCodigo: lojaEnv.envCodigo,
    referenciaLojaEnv: technicalLojaEnvLabel(item),
    observacaoOriginalPdf: item.observacao || item.observacaoTecnica || "",
    chaveOperacional: saleStockKey(item),
    identificacaoOperacional: technicalVariantLabel(item, { includeWeight: false }),
    motivo,
    mensagem: `Pedido ${numeroPedido || documentoId || "sem número"}: faltam ${qtdFaltante} peça(s) de ${item.codigo || product.codigo || "produto"} Nº ${item.medida || product.medida || "-"}. Gestor deve analisar reposição/produção.`,
    decisaoEsperada: "produzir, comprar, ajustar estoque ou cancelar",
    arquivoNome: parsed.arquivoNome || "",
    dataHora: nowIso(),
    usuario: state.user?.email || state.user?.uid || "",
    criadoEm: nowIso(),
    criadoPor: state.user?.email || "",
    criadoPorUid: state.user?.uid || ""
  };
  const alertId = await DB.push("alertasOperacionais", alert);
  localSetCollection("alertasOperacionais", alertId, alert);

  await auditLog("alerta_gestor_venda_sem_estoque", {
    colecao: "alertasOperacionais",
    documentoId: alertId,
    motivo: "Venda inteligente sem saldo suficiente; gestor decide produção/reposição.",
    resumo: alert.mensagem,
    depois: alert
  });
  return alertId;
}

async function processSaleStockAndShortage({
  produtoId,
  product = {},
  item = {},
  quantidade = 0,
  parsed = {},
  documentoId = "",
  vendaId = "",
  origem = "venda_final_pdf",
  motivo = "Venda final"
}) {
  const qtdSolicitada = quantitySafe(quantidade || item.quantidade || 0);
  await ensureLegacyPhysicalPieces(produtoId, product);
  ensureIndependentWeightLedger(produtoId, product);

  const technicalCriteria = technicalCriteriaFromItem(item, { includeLot: false, matchByWeight: false });
  const pecasDisponiveisDaVariacao = availablePiecesForSaleOperationalItem(item, produtoId);
  const totalPecasFisicas = pecasDisponiveisDaVariacao.length;
  const disponivelAntes = pecasDisponiveisDaVariacao.length
    ? pecasDisponiveisDaVariacao.length
    : Math.max(0, quantitySafe(product.estoqueDisponivel || 0));

  const qtdBaixada = Math.min(qtdSolicitada, disponivelAntes);
  const qtdFaltante = Math.max(0, qtdSolicitada - qtdBaixada);
  let pecasBaixadas = [];
  let pesoTotalBaixado = 0;

  if (qtdBaixada > 0) {
    const valoresBaixaReais = saleWeightValues(item, qtdSolicitada, qtdBaixada);
    pesoTotalBaixado = valoresBaixaReais.pesoTotal;
    assertSaleWeightAvailable(produtoId, product, valoresBaixaReais.pesoTotal, item);
    if (totalPecasFisicas) {
      pecasBaixadas = await moveSpecificPhysicalPiecesToSold({
        pieces: pecasDisponiveisDaVariacao.slice(0, qtdBaixada),
        vendaId,
        documentoId,
        origem,
        observacao: `${motivo}. ${qtdBaixada} peça(s) baixada(s) por código, descrição, material e medida. Peso debitado pelo peso total real da venda, independente da quantidade. O sistema não presume o peso individual de cada peça.`,
        numeroPedidoVenda: parsed.header?.numeroPedido || documentoId || vendaId || "",
        clienteVenda: parsed.header?.clienteNome || parsed.cliente || "",
        vendedorVenda: parsed.vendedor || item.vendedor || "",
        pesoUnitarioBaixa: valoresBaixaReais.pesoUnitario,
        pesoTotalBaixa: valoresBaixaReais.pesoTotal
      });
      applyProductWeightLedgerDelta(produtoId, product, {
        saidaDelta: valoresBaixaReais.pesoTotal,
        motivo: "Venda: baixa de quantidade e peso total real de forma independente."
      });
      await syncProductAggregateFromPieces(produtoId, product);
    } else {
      product.estoqueDisponivel = Math.max(0, quantitySafe(product.estoqueDisponivel || 0) - qtdBaixada);
      product.estoqueVendido = quantitySafe(product.estoqueVendido || 0) + qtdBaixada;
      product.ultimaMovimentacaoEm = nowIso();
      product.atualizadoEm = nowIso();
      await DB.save("produtos", produtoId, product);
      localSetCollection("produtos", produtoId, product);
    }

    const valoresBaixados = saleWeightValues(item, qtdSolicitada, qtdBaixada);
    const pesoMovimentoBaixa = valoresBaixados.pesoTotal;
    await registerMovement({
      produtoId,
      tipo: "venda_final",
      quantidade: qtdBaixada,
      peso: pesoMovimentoBaixa,
      pedidoId: documentoId || vendaId,
      origem: origem === "venda_final_manual" ? "manual" : "pdf",
      observacao: pecasBaixadas.length
        ? `Venda final com baixa real por peça física. Peças baixadas: ${pecasBaixadas.length}. Peso debitado pela peça vendida.`
        : `Venda final com baixa por saldo agregado legado. Quantidade baixada: ${qtdBaixada}.`
    });
  } else if (quantitySafe(product.estoqueDisponivel || 0) < 0) {
    // Protecao: importacoes antigas podiam deixar saldo negativo. Venda sem estoque vira alerta do gestor.
    product.estoqueDisponivel = 0;
    product.ultimaMovimentacaoEm = nowIso();
    product.atualizadoEm = nowIso();
    await DB.save("produtos", produtoId, product);
    localSetCollection("produtos", produtoId, product);
  }

  const pedidoProducaoId = "";
  const alertaGestorId = qtdFaltante > 0
    ? await createManagerShortageAlertFromSale({
        produtoId,
        product,
        item,
        parsed,
        documentoId,
        vendaId,
        quantidadeSolicitada: qtdSolicitada,
        quantidadeBaixada: qtdBaixada,
        quantidadeFaltante: qtdFaltante,
        origem,
        motivo: qtdBaixada > 0
          ? "Venda final com estoque parcial para análise do gestor"
          : "Venda final sem saldo disponível para análise do gestor"
      })
    : "";

  return {
    quantidadeSolicitada: qtdSolicitada,
    quantidadeBaixada: qtdBaixada,
    quantidadeFaltante: qtdFaltante,
    pesoTotalSolicitado: lineWeightTotal(item, qtdSolicitada),
    pesoTotalBaixado,
    pesoTotalFaltante: Math.max(0, lineWeightTotal(item, qtdSolicitada) - pesoTotalBaixado),
    estoqueDisponivelAntes: disponivelAntes,
    pecasBaixadas,
    pedidoProducaoId,
    alertaGestorId,
    statusEstoque: qtdFaltante > 0 ? (qtdBaixada > 0 ? "baixada_parcial_alerta_gestor" : "sem_estoque_alerta_gestor") : "baixada_total"
  };
}



async function processIntelligentSaleReservationAndProduction({
  produtoId,
  product = {},
  item = {},
  quantidade = 0,
  parsed = {},
  documentoId = "",
  vendaId = "",
  origem = "venda_inteligente_pdf",
  motivo = "Pedido de venda inteligente"
}) {
  const qtdSolicitada = quantitySafe(quantidade || item.quantidade || 0);
  await ensureLegacyPhysicalPieces(produtoId, product);

  // V40: a venda inteligente baixa por SKU operacional em TODO o estoque físico compatível.
  // Critério: código + descrição + material + medida. Peso e lote do PDF são apenas rastreabilidade.
  ensureIndependentWeightLedger(produtoId, product);
  const technicalCriteria = technicalCriteriaFromItem(item, { includeLot: false, matchByWeight: false });
  const pecasDisponiveisDaVariacao = availablePiecesForSaleOperationalItem(item, produtoId);
  const totalPecasFisicas = pecasDisponiveisDaVariacao.length;
  const disponivelAntes = pecasDisponiveisDaVariacao.length
    ? pecasDisponiveisDaVariacao.length
    : Math.max(0, quantitySafe(product.estoqueDisponivel || 0));

  const qtdBaixada = Math.min(qtdSolicitada, disponivelAntes);
  const qtdFaltanteVenda = Math.max(0, qtdSolicitada - qtdBaixada);
  let pecasBaixadas = [];
  let pesoTotalBaixado = 0;

  if (qtdBaixada > 0) {
    const valoresBaixaReais = saleWeightValues(item, qtdSolicitada, qtdBaixada);
    pesoTotalBaixado = valoresBaixaReais.pesoTotal;
    assertSaleWeightAvailable(produtoId, product, valoresBaixaReais.pesoTotal, item);
    if (totalPecasFisicas) {
      pecasBaixadas = await moveSpecificPhysicalPiecesToSold({
        pieces: pecasDisponiveisDaVariacao.slice(0, qtdBaixada),
        vendaId,
        documentoId,
        origem,
        observacao: `${motivo}. ${qtdBaixada} peça(s) baixada(s) por código, descrição, material e medida. Peso debitado pelo peso total da linha do PDF. Quantidade e peso são controlados separadamente, sem presumir peso individual.`,
        numeroPedidoVenda: parsed.header?.numeroPedido || documentoId || vendaId || "",
        clienteVenda: parsed.header?.clienteNome || parsed.cliente || "",
        vendedorVenda: parsed.vendedor || item.vendedor || "",
        pesoUnitarioBaixa: valoresBaixaReais.pesoUnitario,
        pesoTotalBaixa: valoresBaixaReais.pesoTotal
      });
      applyProductWeightLedgerDelta(produtoId, product, {
        saidaDelta: valoresBaixaReais.pesoTotal,
        motivo: "Venda inteligente: baixa de quantidade e peso total real de forma independente."
      });
      await syncProductAggregateFromPieces(produtoId, product);
    } else {
      product.estoqueDisponivel = Math.max(0, quantitySafe(product.estoqueDisponivel || 0) - qtdBaixada);
      product.estoqueVendido = quantitySafe(product.estoqueVendido || 0) + qtdBaixada;
      product.ultimaMovimentacaoEm = nowIso();
      product.atualizadoEm = nowIso();
      await DB.save("produtos", produtoId, product);
      localSetCollection("produtos", produtoId, product);
    }

    const valoresBaixados = saleWeightValues(item, qtdSolicitada, qtdBaixada);
    const pesoMovimentoBaixa = valoresBaixados.pesoTotal;
    await registerMovement({
      produtoId,
      tipo: "baixa_venda_inteligente",
      quantidade: qtdBaixada,
      peso: pesoMovimentoBaixa,
      pedidoId: documentoId || vendaId,
      origem: "pdf",
      observacao: `Pedido de venda inteligente. Baixa real de ${qtdBaixada} peça(s). Critério: código + descrição + material + medida. Peso debitado pela peça física.`
    });
  }

  const disponivelAposBaixa = Math.max(0, disponivelAntes - qtdBaixada);
  const estoqueCriticoReferencia = quantitySafe(item.estoqueCritico ?? product.estoqueCritico ?? product.estoqueMinimo ?? state.data.configuracoes?.estoqueMinimoPadrao ?? APP_CONFIG.negocio.estoqueMinimoPadrao ?? 3);
  const estoqueIdealReferencia = quantitySafe(item.estoqueIdeal ?? product.estoqueIdeal ?? state.data.configuracoes?.estoqueIdealPadrao ?? 7);
  const estoqueSugestaoReferencia = quantitySafe(item.estoqueSugestao ?? product.estoqueSugestao ?? product.estoqueSugerido ?? state.data.configuracoes?.estoqueSugestaoPadrao ?? estoqueIdealReferencia);
  const qtdSugestaoReposicao = Math.max(0, estoqueSugestaoReferencia - disponivelAposBaixa);

  const alertaGestorId = qtdFaltanteVenda > 0
    ? await createManagerShortageAlertFromSale({
        produtoId,
        product,
        item,
        parsed,
        documentoId,
        vendaId,
        quantidadeSolicitada: qtdSolicitada,
        quantidadeBaixada: qtdBaixada,
        quantidadeFaltante: qtdFaltanteVenda,
        origem,
        motivo: "Venda inteligente com falta de estoque para analise do gestor"
      })
    : "";

  return {
    quantidadeSolicitada: qtdSolicitada,
    quantidadeReservada: 0,
    quantidadeBaixada: qtdBaixada,
    quantidadeFaltante: qtdFaltanteVenda,
    pesoTotalSolicitado: lineWeightTotal(item, qtdSolicitada),
    pesoTotalBaixado,
    pesoTotalFaltante: Math.max(0, lineWeightTotal(item, qtdSolicitada) - pesoTotalBaixado),
    quantidadeReposicaoMinima: 0,
    quantidadeSugestaoReposicao: qtdSugestaoReposicao,
    estoqueDisponivelAntes: disponivelAntes,
    estoqueDisponivelAposReserva: disponivelAposBaixa,
    estoqueDisponivelAposBaixa: disponivelAposBaixa,
    estoqueMinimoReferencia: estoqueCriticoReferencia,
    estoqueCriticoReferencia,
    estoqueIdealReferencia,
    estoqueSugestaoReferencia,
    chaveTecnica: technicalCriteria.chaveTecnica,
    identificacaoTecnica: technicalCriteria.descricaoTecnica,
    pesoIdentificador: 0,
    pesoChaveTecnica: "IGNORADO_BAIXA_ESTOQUE",
    pesoReferenciaPdf: technicalWeightValue(item),
    loteReferencia: "",
    lojaCodigo: technicalCriteria.lojaCodigo || "",
    envCodigo: technicalCriteria.envCodigo || "",
    referenciaLojaEnv: technicalCriteria.referenciaLojaEnv || "",
    pecasReservadas: [],
    pecasBaixadas,
    pedidoProducaoId: "",
    alertaGestorId,
    statusEstoque: qtdFaltanteVenda > 0 ? (qtdBaixada > 0 ? "baixada_parcial_alerta_gestor" : "sem_estoque_alerta_gestor") : "baixada_total"
  };
}

function cleanImportedItemForSave(item = {}) {
  const {
    fotoArquivo,
    fotoPreviewUrl,
    fotoDataUrl,
    valorUnitario,
    valorTotal,
    totalItem,
    subtotal,
    acrescimo,
    frete,
    ...rest
  } = item;

  return {
    ...rest,
    fotoExtraidaDoPdf: Boolean(item.fotoExtraidaDoPdf),
    fotoArquivoNome: item.fotoArquivoNome || "",
    fotoUrl: item.fotoUrl || item.fotoDataUrl || ""
  };
}

function operationalImportTotals(totais = {}) {
  return {
    qtdItens: Number(totais.qtdItens || 0),
    qtdPecas: Number(totais.qtdPecas || 0),
    totalBrits05: Number(totais.totalBrits05 || 0),
    totalBrits: Number(totais.totalBrits || 0),
    totalPedrasN: Number(totais.totalPedrasN || 0),
    totalOutras: Number(totais.totalOutras || 0)
  };
}


function aggregateImportedSaleItemsByTechnicalKey(items = []) {
  const groups = new Map();

  (items || []).forEach((rawItem, index) => {
    const item = { ...(rawItem || {}) };
    // V39: agrupamento da venda para baixa de estoque é por SKU operacional.
    // Peso não identifica estoque; peso do PDF é total da linha.
    const key = saleStockKey(item);
    const current = groups.get(key) || {
      chaveTecnica: key,
      identificacaoTecnica: technicalVariantLabel(item, { includeWeight: false }),
      produtoId: productIdFrom(item),
      pesoIdentificador: 0,
      pesoChaveTecnica: "IGNORADO_BAIXA_ESTOQUE",
      pesoReferenciaPdfTotal: 0,
      loteReferencia: "",
      lojaCodigo: technicalLojaEnvValue(item).lojaCodigo,
      envCodigo: technicalLojaEnvValue(item).envCodigo,
      referenciaLojaEnv: technicalLojaEnvLabel(item),
      item: { ...item, quantidade: 0, peso: 0 },
      quantidade: 0,
      pesoTotal: 0,
      linhasOriginais: [],
      observacoes: [],
      sequencias: []
    };

    const qtd = quantitySafe(item.quantidade || 0);
    const pesoTotalLinha = lineWeightTotal(item, Number(item.quantidade || 0)); // total da linha no PDF, aceita 0,75 / 0.75 / 0,75gr
    current.quantidade += qtd;
    current.pesoTotal += pesoTotalLinha;
    current.pesoReferenciaPdfTotal = current.pesoTotal;
    current.linhasOriginais.push({ ...item, indiceImportacao: index + 1, chaveTecnica: key, identificacaoTecnica: current.identificacaoTecnica, pesoTotalLinha });
    if (item.observacao) current.observacoes.push(item.observacao);
    if (item.sequencia) current.sequencias.push(item.sequencia);

    const pesoReferenciaUnitario = current.quantidade ? current.pesoTotal / current.quantidade : 0;
    current.item = {
      ...current.item,
      ...item,
      quantidade: current.quantidade,
      peso: pesoReferenciaUnitario,
      pesoUnitarioReferencia: pesoReferenciaUnitario,
      pesoTotalReferencia: current.pesoTotal,
      observacao: [...new Set(current.observacoes)].join(" | "),
      sequenciasAgrupadas: [...new Set(current.sequencias)].join(", "),
      linhasAgrupadas: current.linhasOriginais.length,
      linhasOriginais: current.linhasOriginais,
      chaveTecnica: key,
      identificacaoTecnica: current.identificacaoTecnica,
      pesoIdentificador: 0,
      pesoChaveTecnica: "IGNORADO_BAIXA_ESTOQUE",
      loteReferencia: "",
      lojaCodigo: current.lojaCodigo || technicalLojaEnvValue(item).lojaCodigo,
      envCodigo: current.envCodigo || technicalLojaEnvValue(item).envCodigo,
      referenciaLojaEnv: current.referenciaLojaEnv || technicalLojaEnvLabel(item)
    };

    groups.set(key, current);
  });

  return [...groups.values()];
}

function parseProductionLotGroups(text = "", { quantidade = 0, pesoUnitario = 0, lote = "" } = {}) {
  const raw = String(text || "").trim();
  const fallbackQtd = quantitySafe(quantidade || 0);
  const fallbackPeso = numberSafe(pesoUnitario || 0);
  const fallbackLote = String(lote || "").trim();

  if (!raw) {
    return fallbackQtd ? [{ quantidade: fallbackQtd, pesoUnitario: fallbackPeso, lote: fallbackLote, origem: "principal" }] : [];
  }

  const groups = [];
  raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      let quantidadeGrupo = 0;
      let pesoGrupo = 0;
      let loteGrupo = "";

      const pipeParts = line.split("|").map((part) => part.trim()).filter(Boolean);
      const main = pipeParts[0] || line;
      loteGrupo = pipeParts[1] || "";

      const match = main.match(/^(\d+)\s*(?:x|X|\*)\s*([\d.,]+)\s*(?:g|gr|gramas?)?$/i);
      if (match) {
        quantidadeGrupo = quantitySafe(match[1]);
        pesoGrupo = parseNumberBR(match[2]);
      } else {
        const csv = main.split(/,|\t/).map((part) => part.trim()).filter(Boolean);
        if (csv.length >= 2) {
          quantidadeGrupo = quantitySafe(csv[0]);
          pesoGrupo = parseNumberBR(csv[1]);
          loteGrupo = loteGrupo || csv[2] || "";
        }
      }

      if (!quantidadeGrupo || !pesoGrupo) return;
      groups.push({
        quantidade: quantidadeGrupo,
        pesoUnitario: pesoGrupo,
        lote: loteGrupo || fallbackLote || `LOTE-${index + 1}`,
        origem: "grupo"
      });
    });

  return groups;
}

function productionLotSummary(groups = []) {
  return (groups || [])
    .map((g) => `${formatNumber(g.quantidade || 0, 0)} un. × ${formatNumber(g.pesoUnitario || 0, 3)} g${g.lote ? ` · ${g.lote}` : ""}`)
    .join(" | ");
}

function productionGroupsTotals(groups = []) {
  const quantidade = sum(groups || [], (g) => g.quantidade || 0);
  const pesoTotal = sum(groups || [], (g) => quantitySafe(g.quantidade || 0) * numberSafe(g.pesoUnitario || 0));
  const pesoUnitarioMedio = quantidade ? pesoTotal / quantidade : 0;
  return { quantidade, pesoTotal, pesoUnitarioMedio };
}

async function uploadImageWithRetry(file, fileName = "", tries = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await uploadImage(file, fileName);
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
    }
  }
  throw lastError || new Error("Não foi possível enviar a foto.");
}

async function attachPdfPhotosToItems(itens = []) {
  const uploaded = new Map();

  for (const item of itens) {
    const produtoId = productIdFrom(item);
    const existing = state.data.produtos[produtoId] || {};

    const existingUrl = String(existing.fotoUrl || "");
    const existingPhotoIsManual = existing.fotoOrigem === "manual";

    if (existingPhotoIsManual) {
      item.fotoUrl = existing.fotoUrl;
      continue;
    }

    /*
     * Regra profissional:
     * 1) tenta enviar a foto capturada do PDF para o provedor de imagens;
     * 2) se o envio externo falhar ou ainda não estiver liberado, mantém a
     *    miniatura extraída do PDF em DataURL para o gestor não perder imagem.
     */
    if (!item.fotoArquivo && item.fotoDataUrl) {
      item.fotoUrl = item.fotoDataUrl;
      continue;
    }

    if (!item.fotoArquivo) continue;

    if (!uploaded.has(produtoId)) {
      try {
        const url = await uploadImageWithRetry(item.fotoArquivo, item.fotoArquivoNome || `${produtoId}.jpg`, 2);
        uploaded.set(produtoId, url);
      } catch (err) {
        console.warn("Foto externa não enviada; usando miniatura local do PDF:", err);
        uploaded.set(produtoId, item.fotoDataUrl || item.fotoPreviewUrl || "");
      }
    }

    item.fotoUrl = uploaded.get(produtoId) || item.fotoDataUrl || item.fotoPreviewUrl || "";
  }
}


function sameImportNumber(a = {}, b = {}) {
  const numberA = String(a.numeroPedido || a.pedidoPdfNumero || a.pedidoNumero || "").trim();
  const numberB = String(b.numeroPedido || b.pedidoPdfNumero || b.pedidoNumero || "").trim();
  return Boolean(numberA && numberB && numberA === numberB);
}

function isFailedImportDocument(doc = {}) {
  const status = String(doc.importacaoStatus || doc.statusImportacao || doc.status || doc.situacao || "").toLowerCase();
  return ["falha_importacao", "importacao_falhada", "falhou", "erro_importacao"].includes(status);
}

function findDuplicateImportDocument(parsed = {}, tipoImportacao = "") {
  const normalizedType = normalizeImportType(tipoImportacao);
  const target = {
    numeroPedido: parsed.header?.numeroPedido || "",
    pedidoPdfNumero: parsed.header?.numeroPedido || ""
  };
  if (!target.numeroPedido) return null;

  const collectionName = isStockImport(normalizedType)
    ? "inventariosEstoque"
    : isCommercialImport(normalizedType)
      ? "pedidos"
      : isProductionOrderImport(normalizedType)
        ? "pedidosProducao"
        : isProductionReadyImport(normalizedType)
          ? "producoes"
          : "cadastrosMostruario";

  return objectToArray(state.data?.[collectionName] || {})
    .filter((doc) => !["cancelado", "cancelada", "excluido", "excluida", "estornado", "estornada"].includes(String(doc.importacaoStatus || doc.status || doc.situacao || "").toLowerCase()))
    .filter((doc) => !isFailedImportDocument(doc))
    .find((doc) => sameImportNumber(doc, target) && normalizeImportType(doc.tipoImportacao || normalizedType) === normalizedType) || null;
}

async function confirmImport(event) {
  const parsed = state.parsedImport;
  if (!parsed) return;

  const tipoImportacao = normalizeImportType(parsed.tipoImportacao);
  const typeInfo = importTypeInfo(tipoImportacao);
  const button = event?.currentTarget || document.getElementById("confirmImportBtn");

  if (button) {
    button.disabled = true;
    button.textContent =
      isCatalogImport(tipoImportacao) ? "Salvando catálogo e fotos..." :
      isStockImport(tipoImportacao) ? "Registrando estoque atual..." :
      isProductionOrderImport(tipoImportacao) ? "Registrando pedido para produção..." :
      isProductionReadyImport(tipoImportacao) ? "Registrando produção pronta e lotes..." :
      tipoImportacao === "venda_inteligente" ? "Baixando estoque disponível e gerando alertas do gestor..." :
      "Salvando joias, fotos e movimentos...";
  }

  const itensOperacionais = (parsed.itens || []).filter(isValidOperationalItem);
  const totalItensProgress = itensOperacionais.length || (parsed.itens || []).length || 0;
  showImportProgress({
    title: typeInfo.label,
    subtitle: `${parsed.arquivoNome || "PDF"} · pedido ${parsed.header?.numeroPedido || "-"}`,
    totalItems: totalItensProgress,
    tipoImportacao
  });

  let clienteId = "";
  let documentoId = "";
  let colecaoAuditada = "produtos";
  const productionReadyDocumentSummary = {
    quantidadeRecebidaTotal: 0,
    quantidadeBaixadaVendas: 0,
    quantidadeExcedenteEstoque: 0,
    pesoBaixadoVendas: 0,
    quantidadeSemAprovacao: 0,
    alertasAtendidos: []
  };

  try {
    updateImportProgress({ step: "fotos", label: "Preparando dados e fotos", detail: "Tratando imagens extraídas do PDF e vinculando aos produtos quando existir foto.", percent: 8, done: 0, total: totalItensProgress, log: "Iniciando preparação de fotos e dados." });
    await attachPdfPhotosToItems(parsed.itens);
    updateImportProgress({ step: "documento", label: "Registrando documento", detail: "Salvando cabeçalho, cliente, pedido e informações principais da importação.", percent: 18, done: 0, total: totalItensProgress, log: "Fotos/dados preparados. Registrando documento." });

    const itensParaSalvar = parsed.itens.map(cleanImportedItemForSave);
    const totaisParaSalvar = operationalImportTotals(parsed.totais);
    clienteId = "";
    documentoId = "";
    colecaoAuditada = "produtos";

    /*
     * Regra central do fluxo:
     * - Catálogo NÃO gera pedido.
     * - Estoque atual/inventário NÃO gera pedido comercial.
     * - Pedido para produção NÃO entra em estoque e NÃO vira venda.
     * - Produção pronta entra em estoque por lote.
     * - Venda final, venda inteligente e consignação criam pedido comercial.
     */
    const duplicado = findDuplicateImportDocument(parsed, tipoImportacao);
    if (duplicado) {
      const label = importTypeInfo(tipoImportacao).label;
      if (isStockImport(tipoImportacao)) throw new Error("Este inventário já foi inserido.");
      throw new Error(`${label} já importado para o pedido ${parsed.header?.numeroPedido || "sem número"}. O sistema não sobrescreve nem duplica a mesma operação.`);
    }

    if (tipoImportacao === "venda_inteligente") {
      const preflightPdf = salePreflightForItems((parsed.itens || []).filter(isValidOperationalItem), { parsed });
      if (!confirmSalePreflight(preflightPdf, { tipo: "venda por PDF" })) {
        throw new Error("Venda por PDF cancelada antes de alterar o estoque. Confira se o PDF deveria ser importado como Inventário / entrada de estoque.");
      }
    }

    if (isCommercialImport(tipoImportacao)) {
      clienteId = await upsertClienteFromPedido(parsed.header);
      documentoId = await DB.push("pedidos", {
        ...parsed.header,
        ...totaisParaSalvar,
        clienteId,
        tipoImportacao,
        arquivoNome: parsed.arquivoNome,
        vendedor: parsed.vendedor || "",
        fotosExtraidas: parsed.fotosExtraidas || 0,
        itens: itensParaSalvar,
        importacaoStatus: "em_processamento",
        criadoEm: nowIso(),
        criadoPor: state.user?.email || ""
      });
      colecaoAuditada = "pedidos";
    } else if (isStockImport(tipoImportacao)) {
      documentoId = await DB.push("inventariosEstoque", {
        tipoRegistro: "inventario_estoque_pdf",
        ...parsed.header,
        ...totaisParaSalvar,
        tipoImportacao,
        arquivoNome: parsed.arquivoNome,
        fotosExtraidas: parsed.fotosExtraidas || 0,
        itens: itensParaSalvar,
        importacaoStatus: "em_processamento",
        criadoEm: nowIso(),
        criadoPor: state.user?.email || ""
      });
      colecaoAuditada = "inventariosEstoque";
    } else if (isProductionOrderImport(tipoImportacao)) {
      documentoId = await DB.push("pedidosProducao", {
        tipoRegistro: "cabecalho_pedido_producao_pdf",
        ...parsed.header,
        ...totaisParaSalvar,
        tipoImportacao,
        arquivoNome: parsed.arquivoNome,
        fotosExtraidas: parsed.fotosExtraidas || 0,
        itens: itensParaSalvar,
        status: "pendente",
        importacaoStatus: "em_processamento",
        criadoEm: nowIso(),
        criadoPor: state.user?.email || ""
      });
      colecaoAuditada = "pedidosProducao";
    } else if (isProductionReadyImport(tipoImportacao)) {
      documentoId = await DB.push("producoes", {
        tipoRegistro: "cabecalho_producao_pronta_pdf",
        ...parsed.header,
        ...totaisParaSalvar,
        tipoImportacao,
        arquivoNome: parsed.arquivoNome,
        fotosExtraidas: parsed.fotosExtraidas || 0,
        itens: itensParaSalvar,
        status: "pronta",
        importacaoStatus: "em_processamento",
        criadoEm: nowIso(),
        criadoPor: state.user?.email || ""
      });
      colecaoAuditada = "producoes";
    } else {
      documentoId = parsed.header?.numeroPedido || uid("catalogo_pdf");
      colecaoAuditada = "cadastrosMostruario";
    }

    updateImportProgress({ step: "itens", label: "Processando itens", detail: "Agora o sistema grava estoque, reservas, produção, vendas ou catálogo conforme o tipo selecionado.", percent: 28, done: 0, total: totalItensProgress, log: "Documento registrado. Iniciando processamento dos itens." });

    if (isStockImport(tipoImportacao)) {
      const grupos = new Map();

      for (const item of parsed.itens) {
        const produtoId = productIdFrom(item);
        const key = technicalVariantKey(item, { includeLot: false, includeWeight: false, mode: "sale_stock" });
        const atual = grupos.get(key) || {
          chaveTecnica: key,
          identificacaoTecnica: technicalVariantLabel(item),
          produtoId,
          item: { ...item, chaveTecnica: key, identificacaoTecnica: technicalVariantLabel(item) },
          quantidade: 0,
          pesoTotal: 0
        };

        const qtd = quantitySafe(item.quantidade || 0);
        const pesoTotalLinha = lineWeightTotal(item, qtd);
        atual.quantidade += qtd;
        atual.pesoTotal += pesoTotalLinha;
        grupos.set(key, atual);
      }

      // Inventário novo soma ao estoque existente. O mesmo pedido/tipo já é bloqueado antes de gravar.

      const gruposInventario = [...grupos.values()];
      let progressGrupoInventario = 0;
      for (const grupo of gruposInventario) {
        progressGrupoInventario += 1;
        updateImportProgress({
          step: "itens",
          label: "Registrando inventário físico",
          detail: `${grupo.item.codigo || "Produto"} · Nº ${grupo.item.medida || "-"} · ${formatNumber(grupo.quantidade || 0, 0)} peça(s).`,
          percent: 30 + Math.round((progressGrupoInventario / Math.max(gruposInventario.length, 1)) * 52),
          done: progressGrupoInventario,
          total: gruposInventario.length,
          log: `Inventário ${progressGrupoInventario}/${gruposInventario.length}: ${grupo.item.codigo || "produto"} Nº ${grupo.item.medida || "-"}`
        });
        const { id, product } = await upsertProductFromItem(grupo.item);
        ensureIndependentWeightLedger(id, product);
        const saldoAnterior = quantitySafe(product.estoqueDisponivel || 0);
        const quantidadeEntrada = quantitySafe(grupo.quantidade || 0);
        const saldoNovo = saldoAnterior + quantidadeEntrada;
        const diferenca = quantidadeEntrada;
        const pesoUnitario = quantidadeEntrada > 0 ? numberSafe(grupo.pesoTotal || 0) / quantidadeEntrada : 0;

        product.estoqueDisponivel = saldoNovo;
        product.ultimaMovimentacaoEm = nowIso();
        if (pesoUnitario) product.pesoMedio = pesoUnitario;
        await DB.save("produtos", id, product);

        await DB.push("estoqueMovimentos", {
          inventarioId: documentoId,
          produtoId: id,
          codigo: grupo.item.codigo,
          codigoOriginal: grupo.item.codigoOriginal || grupo.item.codigo,
          descricao: grupo.item.descricao,
          medida: grupo.item.medida,
          material: grupo.item.material,
          quantidadeAnterior: saldoAnterior,
          quantidadeNova: saldoNovo,
          quantidadeEntrada,
          quantidadeDiferenca: diferenca,
          pesoUnitario,
          pesoTotal: grupo.pesoTotal,
          tipo: "ajuste_estoque_atual_pdf",
          origem: "pdf",
          arquivoNome: parsed.arquivoNome || "",
          criadoEm: nowIso(),
          criadoPor: state.user?.email || ""
        });

        const loteInventarioCodigo = grupo.item.lote || `INV-${parsed.header?.numeroPedido || "PDF"}-${grupo.item.codigo || "SEM_CODIGO"}-${grupo.item.medida || "SEM_MEDIDA"}-${formatNumber(numberSafe(grupo.pesoTotal || 0), 3).replace(/[^0-9]+/g, "_")}`;

        const loteId = await registerLotEntry({
          produtoId: id,
          item: { ...grupo.item, lote: loteInventarioCodigo },
          parsed,
          tipo: "inventario_estoque_pdf",
          quantidade: quantidadeEntrada,
          pesoTotal: grupo.pesoTotal,
          pesoUnitario,
          pedidoId: documentoId,
          status: "disponivel"
        });

await createPhysicalPieces({
          produtoId: id,
          item: { ...grupo.item, lote: loteInventarioCodigo },
          parsed,
          origem: "inventario_estoque_pdf",
          status: "disponivel",
          quantidade: quantidadeEntrada,
          pesoUnitario: 0,
          pesoTotal: grupo.pesoTotal,
          pedidoId: documentoId,
          inventarioId: documentoId,
          loteId,
          loteCodigo: loteInventarioCodigo,
          observacao: `Inventário PDF ${parsed.header?.numeroPedido || ""}. Quantidade física e peso total da linha são controlados separadamente; o sistema não presume peso individual.`,
          pesoIndividualConhecido: false
        });
        applyProductWeightLedgerDelta(id, product, {
          entradaDelta: grupo.pesoTotal,
          motivo: "Inventário PDF: peso total da linha sem presumir peso individual de cada peça."
        });
        await syncProductAggregateFromPieces(id, product);

        await registerMovement({
          produtoId: id,
          tipo: "ajuste_estoque_atual_pdf",
          quantidade: diferenca,
          peso: grupo.pesoTotal,
          pedidoId: documentoId,
          origem: "pdf",
          observacao: `Inventário por PDF. Saldo anterior: ${saldoAnterior}; entrada do inventário: ${quantidadeEntrada}; saldo novo: ${saldoNovo}.`
        });
      }
    } else {
      if (tipoImportacao === "venda_inteligente") {
        const gruposVenda = aggregateImportedSaleItemsByTechnicalKey(parsed.itens);
        let progressGrupoVenda = 0;

        for (const grupo of gruposVenda) {
          progressGrupoVenda += 1;
          updateImportProgress({
            step: "itens",
            label: "Venda inteligente em baixa e análise",
            detail: `${grupo.item.codigo || "Produto"} · Nº ${grupo.item.medida || "-"} · ${formatNumber(grupo.quantidade || 0, 0)} peça(s) · ${formatNumber(grupo.pesoIdentificador || 0, 3)} g.`,
            percent: 30 + Math.round((progressGrupoVenda / Math.max(gruposVenda.length, 1)) * 52),
            done: progressGrupoVenda,
            total: gruposVenda.length,
            log: `Venda inteligente ${progressGrupoVenda}/${gruposVenda.length}: ${grupo.identificacaoTecnica || grupo.item.codigo || "item"}`
          });
          const resolved = await upsertProductFromItem(grupo.item, {
            preferExistingStockMatch: true
          });
          const { id, product } = resolved;
          const item = resolved.item || grupo.item;
          const qtd = quantitySafe(grupo.quantidade || item.quantidade || 1);
          const pesoTotal = lineWeightTotal(grupo.item || item, qtd) || numberSafe(grupo.pesoTotal || 0);
          const vendaId = uid("venda_inteligente_pdf");
          const stockResult = await processIntelligentSaleReservationAndProduction({
            produtoId: id,
            product,
            item: {
              ...item,
              quantidade: qtd,
              peso: pesoTotal,
              pesoTotalLinha: pesoTotal,
              pesoUnitarioEstimado: qtd ? pesoTotal / qtd : 0,
              linhasOriginais: grupo.linhasOriginais || []
            },
            quantidade: qtd,
            parsed,
            documentoId,
            vendaId,
            origem: "venda_inteligente_pdf_agrupada",
            motivo: `Pedido de venda inteligente agrupado por SKU do PDF ${parsed.header?.numeroPedido || ""}`
          });

          await DB.save("vendas", vendaId, {
            id: vendaId,
            tipo: "pedido_venda_inteligente",
            pedidoId: documentoId,
            pedidoPdfNumero: parsed.header?.numeroPedido || "",
            origemDocumentoId: documentoId,
            produtoId: id,
            codigo: item.codigo,
            codigoOriginal: item.codigoOriginal || item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            fotoUrl: item.fotoUrl || item.fotoDataUrl || product.fotoUrl || "",
            clienteId,
            cliente: parsed.header.clienteNome || "",
            vendedor: parsed.vendedor || "",
            quantidade: stockResult.quantidadeSolicitada,
            quantidadeSolicitada: stockResult.quantidadeSolicitada,
            quantidadeReservada: stockResult.quantidadeReservada,
            quantidadeBaixada: stockResult.quantidadeBaixada,
            pesoTotalSolicitado: stockResult.pesoTotalSolicitado || pesoTotal,
            pesoTotalBaixado: stockResult.pesoTotalBaixado || 0,
            pesoTotalFaltante: stockResult.pesoTotalFaltante || 0,
            quantidadePendenteProducao: 0,
            quantidadePendenteAnaliseGestor: stockResult.quantidadeFaltante,
            quantidadeReposicaoMinima: 0,
            quantidadeSugestaoReposicao: stockResult.quantidadeSugestaoReposicao || 0,
            estoqueMinimoReferencia: stockResult.estoqueMinimoReferencia,
            estoqueCriticoReferencia: stockResult.estoqueCriticoReferencia || 0,
            estoqueIdealReferencia: stockResult.estoqueIdealReferencia || 0,
            estoqueSugestaoReferencia: stockResult.estoqueSugestaoReferencia || 0,
            estoqueDisponivelAntes: stockResult.estoqueDisponivelAntes,
            estoqueDisponivelAposReserva: stockResult.estoqueDisponivelAposReserva,
            pecasReservadas: stockResult.pecasReservadas || [],
            pecasBaixadas: stockResult.pecasBaixadas || [],
            pedidoProducaoId: "",
            alertaGestorId: stockResult.alertaGestorId || "",
            statusEstoque: stockResult.statusEstoque,
            status: stockResult.quantidadeFaltante ? "pendente_analise_gestor" : "baixada",
            chaveTecnica: grupo.chaveTecnica || stockResult.chaveTecnica || "",
            identificacaoTecnica: grupo.identificacaoTecnica || stockResult.identificacaoTecnica || "",
            pesoIdentificador: 0,
            pesoChaveTecnica: "IGNORADO_BAIXA_ESTOQUE",
            pesoReferenciaPdf: stockResult.pesoReferenciaPdf || grupo.pesoReferenciaPdfTotal || 0,
            loteReferencia: grupo.loteReferencia || stockResult.loteReferencia || "",
            lojaCodigo: grupo.lojaCodigo || stockResult.lojaCodigo || item.lojaCodigo || "",
            envCodigo: grupo.envCodigo || stockResult.envCodigo || item.envCodigo || "",
            referenciaLojaEnv: grupo.referenciaLojaEnv || stockResult.referenciaLojaEnv || technicalLojaEnvLabel(item),
            observacao: item.observacao || "",
            observacoes: grupo.observacoes || [],
            observacaoOriginalPdf: item.observacao || item.observacaoTecnica || "",
            pesoTotal,
            linhasAgrupadas: grupo.linhasOriginais?.length || 1,
            linhasOriginais: grupo.linhasOriginais || [],
            observacoesAgrupadas: grupo.observacoes || [],
            origem: "pdf",
            modoVenda: "inteligente_agrupada",
            criadoEm: nowIso(),
            criadoPor: state.user?.email || "",
            criadoPorUid: state.user?.uid || ""
          });

          await auditLog("pedido_venda_inteligente_agrupado_importado", {
            colecao: "vendas",
            documentoId: vendaId,
            motivo: "Importação inteligente com baixa por SKU operacional: código, descrição, material e medida. Peso do PDF é referência total da linha. Falta de estoque vira alerta do gestor, não produção automática.",
            resumo: `${item.codigo || ""} · Nº ${item.medida || "-"} · pedido ${qtd} · baixado ${stockResult.quantidadeBaixada} · alerta gestor ${stockResult.quantidadeFaltante}`,
            depois: { vendaId, produtoId: id, item, grupo, stockResult }
          });
        }
      } else {
      let progressItemGeral = 0;
      const itensGeraisProgress = parsed.itens || [];
      for (const rawItem of itensGeraisProgress) {
        progressItemGeral += 1;
        updateImportProgress({
          step: "itens",
          label: "Registrando item do PDF",
          detail: `${rawItem.codigo || "Produto"} · Nº ${rawItem.medida || "-"} · ${formatNumber(rawItem.quantidade || 0, 0)} peça(s).`,
          percent: 30 + Math.round((progressItemGeral / Math.max(itensGeraisProgress.length, 1)) * 52),
          done: progressItemGeral,
          total: itensGeraisProgress.length,
          log: `Item ${progressItemGeral}/${itensGeraisProgress.length}: ${rawItem.codigo || "produto"}`
        });
        const resolved = await upsertProductFromItem(rawItem, {
          preferExistingStockMatch: tipoImportacao === "venda_final" || tipoImportacao === "consignacao"
        });
        const { id, product } = resolved;
        const item = resolved.item || rawItem;
        const qtd = quantitySafe(item.quantidade || 1);
        const pesoTotal = lineWeightTotal(item, qtd);
        if (isCatalogImport(tipoImportacao)) {
          product.ultimaMovimentacaoEm = product.ultimaMovimentacaoEm || "";
          await DB.save("produtos", id, product);

          await DB.push("cadastrosMostruario", {
            origemDocumentoId: documentoId,
            pedidoPdfNumero: parsed.header?.numeroPedido || "",
            produtoId: id,
            codigo: item.codigo,
            codigoOriginal: item.codigoOriginal || item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            fotoUrl: item.fotoUrl || item.fotoDataUrl || product.fotoUrl || "",
            quantidadeReferencia: qtd,
            pesoReferencia: lineWeightTotal(item, qtd),
            pesoUnitarioReferencia: unitWeightFromLine(item, qtd),
            origem: "pdf",
            tipoImportacao: "catalogo_pecas",
            chavePeca: id,
            criadoEm: nowIso(),
            criadoPor: state.user?.email || ""
          });
        } else if (isProductionOrderImport(tipoImportacao)) {
          product.ultimaMovimentacaoEm = product.ultimaMovimentacaoEm || "";
          await DB.save("produtos", id, product);

          await DB.push("pedidosProducao", {
            origemDocumentoId: documentoId,
            produtoId: id,
            codigo: item.codigo,
            codigoOriginal: item.codigoOriginal || item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            quantidadePedida: qtd,
            pesoUnitarioPedido: unitWeightFromLine(item, qtd),
            pesoTotalPedido: pesoTotal,
            status: "pendente",
            origem: "pdf",
            arquivoNome: parsed.arquivoNome || "",
            criadoEm: nowIso(),
            criadoPor: state.user?.email || ""
          });

          await DB.push("producoes", {
            origemDocumentoId: documentoId,
            produtoId: id,
            codigo: item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            quantidade: qtd,
            pesoUnitarioPedido: unitWeightFromLine(item, qtd),
            pesoTotalPedido: pesoTotal,
            status: "pedido_producao",
            tipoRegistro: "pedido_producao_pdf",
            origem: "pdf",
            criadoEm: nowIso(),
            criadoPor: state.user?.email || ""
          });
        } else if (isProductionReadyImport(tipoImportacao)) {
          const pedidoProducao = findProductionOrderMatch(id);
          const pesoUnitarioReal = unitWeightFromLine(item, qtd);
          const pesoTotalReal = lineWeightTotal(item, qtd);
          const pesoUnitarioPedido = numberSafe(pedidoProducao?.pesoUnitarioPedido || 0);
          const diferencaPesoUnitario = pesoUnitarioPedido ? pesoUnitarioReal - pesoUnitarioPedido : 0;

          // V62: converte eventual saldo legado ANTES da nova entrada.
          // Nunca incrementa o agregado e depois cria as peças, pois isso duplicava a unidade.
          await ensureLegacyPhysicalPieces(id, product);
          applyProductWeightLedgerDelta(id, product, {
            entradaDelta: pesoTotalReal,
            motivo: "Produção pronta por PDF: entrada de quantidade física e peso total controlados separadamente."
          });
          if (pesoUnitarioReal) product.pesoMedio = pesoUnitarioReal;
          product.ultimaMovimentacaoEm = nowIso();
          await DB.save("produtos", id, product);
          localSetCollection("produtos", id, product);

          const producaoId = await DB.push("producoes", {
            origemDocumentoId: documentoId,
            pedidoProducaoId: pedidoProducao?.id || "",
            produtoId: id,
            codigo: item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            quantidade: qtd,
            pesoUnitario: pesoUnitarioReal,
            pesoTotal: pesoTotalReal,
            pesoUnitarioPedido,
            pesoTotalPedido: numberSafe(pedidoProducao?.pesoTotalPedido || 0),
            diferencaPesoUnitario,
            diferencaPesoTotal: pesoUnitarioPedido ? pesoTotalReal - numberSafe(pedidoProducao?.pesoTotalPedido || 0) : 0,
            lote: item.lote || generatedLotCode(item, parsed),
            status: "pronta",
            tipoRegistro: "producao_pronta_pdf",
            origem: "pdf",
            criadoEm: nowIso(),
            criadoPor: state.user?.email || ""
          });

          const loteProducaoCodigo = item.lote || generatedLotCode(item, parsed);
          const loteId = await registerLotEntry({
            produtoId: id,
            item: { ...item, lote: loteProducaoCodigo },
            parsed,
            tipo: "entrada_producao_pdf",
            quantidade: qtd,
            pesoTotal: pesoTotalReal,
            pesoUnitario: pesoUnitarioReal,
            pedidoId: documentoId,
            producaoId,
            pedidoProducaoId: pedidoProducao?.id || "",
            status: "disponivel"
          });

          const pieceIds = await createPhysicalPieces({
            produtoId: id,
            item: { ...item, lote: loteProducaoCodigo },
            parsed,
            origem: "entrada_producao_pdf",
            status: "disponivel",
            quantidade: qtd,
            pesoUnitario: pesoUnitarioReal,
            pesoTotal: pesoTotalReal,
            pesoUnitarioPedido,
            pedidoId: documentoId,
            producaoId,
            pedidoProducaoId: pedidoProducao?.id || "",
            loteId,
            loteCodigo: loteProducaoCodigo,
            observacao: pedidoProducao?.id
              ? `Produção pronta comparada com pedido ${pedidoProducao.id}. Cada unidade virou peça física única.`
              : "Produção pronta importada por PDF. Cada unidade virou peça física única."
          });

          let atendimentoProducao = null;
          if (pedidoProducao?.id) {
            atendimentoProducao = await applyProductionToPendingOrder({
              pedidoProducao,
              produtoId: id,
              product,
              quantidadeProduzida: qtd,
              pieceIds,
              producaoId,
              documentoId,
              origem: "entrada_producao_pdf",
              pesoTotal: pesoTotalReal
            });
          } else {
            atendimentoProducao = await applyProductionToApprovedAlerts({
              produtoId: id,
              product,
              quantidadeProduzida: qtd,
              pieceIds,
              producaoId,
              documentoId,
              origem: "entrada_producao_pdf",
              pesoTotal: pesoTotalReal
            });
          }

          if (atendimentoProducao) {
            const quantidadeBaixadaVendas = quantitySafe(atendimentoProducao.quantidadeBaixadaVenda || atendimentoProducao.quantidadeBaixadaVendas || 0);
            const quantidadeExcedenteEstoque = Math.max(0, qtd - quantidadeBaixadaVendas);
            const productionPatch = {
              atendimentoVenda: atendimentoProducao,
              quantidadeBaixadaVendas,
              quantidadeExcedenteEstoque,
              atualizadoEm: nowIso()
            };
            await DB.patch("producoes", producaoId, productionPatch);
            localPatchCollection("producoes", producaoId, productionPatch);

            // V65: além do registro técnico por item, o cabeçalho do PDF guarda
            // o resumo consolidado da destinação da produção pronta. Isso não
            // muda estoque, venda ou alerta; apenas completa a rastreabilidade.
            productionReadyDocumentSummary.quantidadeRecebidaTotal += qtd;
            productionReadyDocumentSummary.quantidadeBaixadaVendas += quantidadeBaixadaVendas;
            productionReadyDocumentSummary.quantidadeExcedenteEstoque += quantidadeExcedenteEstoque;
            productionReadyDocumentSummary.pesoBaixadoVendas += numberSafe(atendimentoProducao.pesoBaixadoVenda || atendimentoProducao.pesoBaixadoVendas || 0);
            productionReadyDocumentSummary.quantidadeSemAprovacao += quantitySafe(atendimentoProducao.quantidadeSemAprovacao || 0);
            productionReadyDocumentSummary.alertasAtendidos.push(...(atendimentoProducao.alertasAtendidos || []));
          }

          await registerMovement({
            produtoId: id,
            tipo: "entrada_producao_pdf",
            quantidade: qtd,
            peso: pesoTotalReal,
            pedidoId: documentoId,
            origem: "pdf",
            observacao: pedidoProducao?.id
              ? `Produção pronta importada. Peso pedido: ${pesoUnitarioPedido} g; peso real: ${pesoUnitarioReal} g.`
              : "Produção pronta importada por PDF."
          });
        } else if (tipoImportacao === "venda_inteligente") {
          const vendaId = uid("venda_inteligente_pdf");
          const stockResult = await processIntelligentSaleReservationAndProduction({
            produtoId: id,
            product,
            item,
            quantidade: qtd,
            parsed,
            documentoId,
            vendaId,
            origem: "venda_inteligente_pdf",
            motivo: `Pedido de venda inteligente importado do PDF ${parsed.header?.numeroPedido || ""}`
          });

          await DB.save("vendas", vendaId, {
            id: vendaId,
            tipo: "pedido_venda_inteligente",
            pedidoId: documentoId,
            pedidoPdfNumero: parsed.header?.numeroPedido || "",
            origemDocumentoId: documentoId,
            produtoId: id,
            codigo: item.codigo,
            codigoOriginal: item.codigoOriginal || item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            fotoUrl: item.fotoUrl || item.fotoDataUrl || product.fotoUrl || "",
            clienteId,
            cliente: parsed.header.clienteNome || "",
            vendedor: parsed.vendedor || "",
            quantidade: stockResult.quantidadeSolicitada,
            quantidadeSolicitada: stockResult.quantidadeSolicitada,
            quantidadeReservada: stockResult.quantidadeReservada,
            quantidadeBaixada: stockResult.quantidadeBaixada,
            pesoTotalSolicitado: stockResult.pesoTotalSolicitado || pesoTotal,
            pesoTotalBaixado: stockResult.pesoTotalBaixado || 0,
            pesoTotalFaltante: stockResult.pesoTotalFaltante || 0,
            quantidadePendenteProducao: 0,
            quantidadePendenteAnaliseGestor: stockResult.quantidadeFaltante,
            quantidadeReposicaoMinima: 0,
            quantidadeSugestaoReposicao: stockResult.quantidadeSugestaoReposicao || 0,
            estoqueMinimoReferencia: stockResult.estoqueMinimoReferencia,
            estoqueCriticoReferencia: stockResult.estoqueCriticoReferencia || 0,
            estoqueIdealReferencia: stockResult.estoqueIdealReferencia || 0,
            estoqueSugestaoReferencia: stockResult.estoqueSugestaoReferencia || 0,
            estoqueDisponivelAntes: stockResult.estoqueDisponivelAntes,
            estoqueDisponivelAposReserva: stockResult.estoqueDisponivelAposReserva,
            pecasReservadas: stockResult.pecasReservadas || [],
            pecasBaixadas: stockResult.pecasBaixadas || [],
            pedidoProducaoId: "",
            alertaGestorId: stockResult.alertaGestorId || "",
            statusEstoque: stockResult.statusEstoque,
            status: stockResult.quantidadeFaltante ? "pendente_analise_gestor" : "baixada",
            pesoTotal,
            origem: "pdf",
            modoVenda: "inteligente",
            criadoEm: nowIso(),
            criadoPor: state.user?.email || "",
            criadoPorUid: state.user?.uid || ""
          });

          await auditLog("pedido_venda_inteligente_importado", {
            colecao: "vendas",
            documentoId: vendaId,
            motivo: "Importação de pedido de venda inteligente com baixa do estoque disponível e alerta do gestor quando faltar peça.",
            resumo: `${item.codigo || ""} · Nº ${item.medida || "-"} · baixado ${stockResult.quantidadeBaixada} · alerta gestor ${stockResult.quantidadeFaltante}`,
            depois: { vendaId, produtoId: id, item, stockResult }
          });
        } else if (tipoImportacao === "venda_final") {
          const vendaId = uid("venda_pdf");
          const stockResult = await processSaleStockAndShortage({
            produtoId: id,
            product,
            item,
            quantidade: qtd,
            parsed,
            documentoId,
            vendaId,
            origem: "venda_final_pdf",
            motivo: `Venda final importada do PDF ${parsed.header?.numeroPedido || ""}`
          });

          await DB.save("vendas", vendaId, {
            id: vendaId,
            pedidoId: documentoId,
            pedidoPdfNumero: parsed.header?.numeroPedido || "",
            origemDocumentoId: documentoId,
            produtoId: id,
            codigo: item.codigo,
            codigoOriginal: item.codigoOriginal || item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            fotoUrl: item.fotoUrl || item.fotoDataUrl || product.fotoUrl || "",
            clienteId,
            cliente: parsed.header.clienteNome || "",
            vendedor: parsed.vendedor || "",
            quantidade: stockResult.quantidadeSolicitada,
            quantidadeSolicitada: stockResult.quantidadeSolicitada,
            quantidadeBaixada: stockResult.quantidadeBaixada,
            pesoTotalSolicitado: stockResult.pesoTotalSolicitado || pesoTotal,
            pesoTotalBaixado: stockResult.pesoTotalBaixado || 0,
            pesoTotalFaltante: stockResult.pesoTotalFaltante || 0,
            quantidadePendenteAnaliseGestor: stockResult.quantidadeFaltante,
            quantidadePendenteProducao: 0,
            estoqueDisponivelAntes: stockResult.estoqueDisponivelAntes,
            pecasBaixadas: stockResult.pecasBaixadas || [],
            pedidoProducaoId: "",
            alertaGestorId: stockResult.alertaGestorId || "",
            statusEstoque: stockResult.statusEstoque,
            status: stockResult.quantidadeFaltante ? "pendente_analise_gestor" : "finalizada",
            pesoTotal,
            origem: "pdf",
            criadoEm: nowIso(),
            criadoPor: state.user?.email || "",
            criadoPorUid: state.user?.uid || ""
          });

          // PDF de venda nao gera comissao automatica neste fluxo operacional.
        } else {
          await ensureLegacyPhysicalPieces(id, product);
          product.estoqueDisponivel = Math.max(0, quantitySafe(product.estoqueDisponivel || 0) - qtd);
          product.estoqueConsignado = quantitySafe(product.estoqueConsignado || 0) + qtd;
          product.ultimaMovimentacaoEm = nowIso();
          await DB.save("produtos", id, product);

          await movePhysicalPieces({
            produtoId: id,
            quantidade: qtd,
            novoStatus: "consignado",
            documentoId: documentoId,
            origem: "consignacao_pdf",
            observacao: `Consignação importada do PDF ${parsed.header?.numeroPedido || ""}.`
          });
          await syncProductAggregateFromPieces(id, product);

          await DB.push("consignacoes", {
            pedidoId: documentoId,
            produtoId: id,
            codigo: item.codigo,
            descricao: item.descricao,
            medida: item.medida,
            material: item.material,
            fotoUrl: item.fotoUrl || item.fotoDataUrl || product.fotoUrl || "",
            clienteId,
            cliente: parsed.header.clienteNome || "",
            vendedor: parsed.vendedor || "",
            quantidade: qtd,
            pesoTotal,
            status: "pendente",
            origem: "pdf",
            criadoEm: nowIso()
          });

          await registerMovement({ produtoId: id, tipo: "saida_consignacao", quantidade: qtd, peso: pesoTotal, pedidoId: documentoId, origem: "pdf" });
        }
      }
      }
    }

    updateImportProgress({ step: "auditoria", label: "Finalizando rastreabilidade", detail: "Registrando auditoria, movimentos e preparando atualização das telas.", percent: 88, done: totalItensProgress, total: totalItensProgress, log: "Itens processados. Finalizando auditoria." });

    if (documentoId && !isCatalogImport(tipoImportacao)) {
      const importPatch = {
        importacaoStatus: "concluida",
        importacaoConcluidaEm: nowIso(),
        atualizadoEm: nowIso()
      };
      if (isProductionReadyImport(tipoImportacao)) {
        Object.assign(importPatch, {
          quantidadeRecebidaTotal: quantitySafe(productionReadyDocumentSummary.quantidadeRecebidaTotal),
          quantidadeBaixadaVendas: quantitySafe(productionReadyDocumentSummary.quantidadeBaixadaVendas),
          quantidadeExcedenteEstoque: quantitySafe(productionReadyDocumentSummary.quantidadeExcedenteEstoque),
          pesoBaixadoVendas: numberSafe(productionReadyDocumentSummary.pesoBaixadoVendas),
          quantidadeSemAprovacao: quantitySafe(productionReadyDocumentSummary.quantidadeSemAprovacao),
          alertasAtendidos: productionReadyDocumentSummary.alertasAtendidos,
          atendimentoVendaResumo: {
            recebida: quantitySafe(productionReadyDocumentSummary.quantidadeRecebidaTotal),
            baixadaVendas: quantitySafe(productionReadyDocumentSummary.quantidadeBaixadaVendas),
            excedenteEstoque: quantitySafe(productionReadyDocumentSummary.quantidadeExcedenteEstoque),
            pesoBaixadoVendas: numberSafe(productionReadyDocumentSummary.pesoBaixadoVendas),
            quantidadeSemAprovacao: quantitySafe(productionReadyDocumentSummary.quantidadeSemAprovacao),
            alertasAtendidos: productionReadyDocumentSummary.alertasAtendidos.length
          }
        });
      }
      await DB.patch(colecaoAuditada, documentoId, importPatch);
      localPatchCollection(colecaoAuditada, documentoId, importPatch);
    }

    await auditLog("importacao_confirmada", {
      colecao: colecaoAuditada,
      documentoId,
      motivo:
        isCatalogImport(tipoImportacao) ? "Catálogo de peças por PDF sem gerar pedido" :
        isStockImport(tipoImportacao) ? "Inventário/estoque atual por PDF sem gerar pedido comercial" :
        isProductionOrderImport(tipoImportacao) ? "Pedido para produção por PDF sem entrada em estoque" :
        isProductionReadyImport(tipoImportacao) ? "Produção pronta por PDF com lote e entrada em estoque" :
        `Importação comercial de ${tipoImportacao || "pedido"} por PDF`,
      resumo: `${parsed.arquivoNome || "PDF"} · ${parsed.itens.length} item(ns) · ${parsed.header?.clienteNome || ""}`,
      depois: {
        tipoImportacao,
        arquivoNome: parsed.arquivoNome,
        itens: itensParaSalvar,
        totais: totaisParaSalvar,
        clienteId
      }
    });

    state.parsedImport = null;
    updateImportProgress({ step: "conclusao", label: "Atualizando telas", detail: "Recarregando estoque, vendas, produção e relatórios com os dados recém gravados.", percent: 94, done: totalItensProgress, total: totalItensProgress, log: "Recarregando dados do Firebase." });
    await loadData();
    completeImportProgress("Dados registrados e telas atualizadas com sucesso.");
    location.hash = typeInfo.destino || "#/produtos";
  } catch (err) {
    if (documentoId && colecaoAuditada && !isCatalogImport(tipoImportacao)) {
      const failurePatch = {
        importacaoStatus: "falha_importacao",
        falhaImportacaoEm: nowIso(),
        erroImportacao: err.message || "Falha sem detalhe informado.",
        permiteReprocessar: true,
        atualizadoEm: nowIso()
      };
      try {
        await DB.patch(colecaoAuditada, documentoId, failurePatch);
        localPatchCollection(colecaoAuditada, documentoId, failurePatch);
      } catch (patchErr) {
        console.warn("Nao foi possivel marcar a importacao como falhada:", patchErr);
      }
    }
    failImportProgress(err.message || "Confira as configurações e tente novamente.");
    const area = document.getElementById("previewArea");
    if (area) {
      area.innerHTML = `<div class="notice danger"><strong>Importação não concluída.</strong><br>${escapeHtml(err.message || "Confira as configurações de fotos e tente novamente.")}</div>`;
    }
    if (button) {
      button.disabled = false;
      button.textContent = "Confirmar importação";
    }
  }
}

function produtosView() {
  const produtos = objectToArray(state.data.produtos)
    .filter(isValidOperationalItem)
    .sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || "")));
  const tipos = objectToArray(state.data.tiposProduto);
  const editingId = state.editingProductId || "";
  const editingProduct = editingId ? (state.data.produtos?.[editingId] || null) : null;
  const selected = (value, current) => String(value || "") === String(current || "") ? "selected" : "";
  const materialOptions = ["Ouro 18K", "Ouro 10K", "Prata", "Ouro", "Outro"];
  const title = editingProduct ? `Editar joia ${escapeHtml(editingProduct.codigo || "")}` : "Cadastrar produto";
  const submitLabel = editingProduct ? "Salvar alterações" : "Salvar produto";
  const currentPhoto = editingProduct?.fotoUrl || editingProduct?.fotoDataUrl || "";
  const materiaisProduto = [...new Set(produtos.map((item) => item.material || "").filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

  shell(`
    <details class="card product-editor-card compact-editor" id="productEditorCard" ${editingProduct ? "open" : ""}>
      <summary class="card-summary">
        <span>${editingProduct ? "Editar joia selecionada" : "Cadastrar/editar joia manualmente"}</span>
        <small>Fluxo principal: importe PDFs. Use este cadastro manual só para ajustes.</small>
      </summary>
      <div class="actions" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h2>${title}</h2>
          <p style="color:var(--muted);margin-top:6px">
            ${editingProduct
              ? "Atualize descrição, tipo, material, medida, peso, estoque mínimo ou troque a foto da joia."
              : "Cadastre uma joia manualmente ou complemente produtos importados do PDF."}
          </p>
        </div>
        ${editingProduct ? `<button class="btn btn-light btn-sm" type="button" id="cancelProductEditBtn">Cancelar edição</button>` : ""}
      </div>

      ${currentPhoto ? `
        <div class="edit-photo-preview">
          <img class="product-thumb-large" src="${escapeHtml(currentPhoto)}" alt="Foto atual da joia">
          <div>
            <strong>Foto atual</strong>
            <p>Para trocar, selecione uma nova imagem no campo Foto e salve as alterações.</p>
          </div>
        </div>
      ` : ""}

      <form id="productForm" class="form-row">
        <input type="hidden" name="produtoId" value="${escapeHtml(editingId)}">
        <div class="field col-2"><label>Código</label><input name="codigo" required placeholder="ALM0027F" value="${escapeHtml(editingProduct?.codigo || "")}"></div>
        <div class="field col-4"><label>Descrição</label><input name="descricao" required placeholder="Aliança feminina..." value="${escapeHtml(editingProduct?.descricao || "")}"></div>
        <div class="field col-2">
          <label>Tipo</label>
          <select name="tipo">
            ${tipos.map((t) => `<option ${selected(t.nome, editingProduct?.tipo)}>${escapeHtml(t.nome)}</option>`).join("")}
          </select>
        </div>
        <div class="field col-2">
          <label>Material</label>
          <select name="material">
            ${materialOptions.map((m) => `<option ${selected(m, editingProduct?.material)}>${escapeHtml(m)}</option>`).join("")}
          </select>
        </div>
        <div class="field col-2"><label>Medida</label><input name="medida" placeholder="18" value="${escapeHtml(editingProduct?.medida || "")}"></div>
        <div class="field col-2"><label>Peso médio</label><input name="pesoMedio" type="number" step="0.001" placeholder="2.160" value="${editingProduct?.pesoMedio ?? ""}"></div>
        <div class="field col-2"><label>Estoque mínimo</label><input name="estoqueMinimo" type="number" step="1" value="${editingProduct?.estoqueMinimo ?? state.data.configuracoes?.estoqueMinimoPadrao ?? 3}"></div>
        <div class="field col-4">
          <label>${editingProduct ? "Trocar foto" : "Foto"}</label>
          <input name="foto" type="file" accept="image/*">
        </div>
        <div class="field col-4"><button class="btn btn-gold" type="submit">${submitLabel}</button></div>
      </form>
    </details>

    <div class="card">
      <div class="actions" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h2 style="margin:0">Catálogo técnico de joias</h2>
          <p style="color:var(--muted);margin-top:6px">Tela de consulta e cadastro técnico. Para operação do dia, use Estoque, Produção e Vendas. Pesquise por código e abra as informações completas quando precisar auditar.</p>
        </div>
        <span class="badge gold">${formatNumber(produtos.length, 0)} joias</span>
      </div>
      <div class="filter-panel" data-joias-filter-panel>
        <div class="field"><label>Pesquisar por código</label><input data-filter-code placeholder="Ex.: 2740AGL"></div>
        <div class="field"><label>Busca geral</label><input data-filter-text placeholder="descrição, medida, lote, material..."></div>
        <div class="field"><label>Material</label><select data-filter-material><option value="">Todos</option>${materiaisProduto.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("")}</select></div>
        <div class="field"><label>Status</label><select data-filter-status><option value="">Todos</option><option value="disponivel">Disponível</option><option value="pendente">Pendências de produção</option><option value="critico">Crítico</option><option value="zerado">Zerado</option></select></div>
        <div class="filter-actions"><button class="btn btn-light btn-sm" type="button" data-clear-filters>Limpar</button><span class="badge blue" data-filter-counter></span></div>
      </div>
      ${productRows(produtos)}
    </div>

    <details class="card compact-editor">
      <summary class="card-summary">
        <span>Tipos de produto</span>
        <small>Configuração avançada</small>
      </summary>
      <form id="tipoForm" class="form-row">
        <div class="field col-8"><label>Novo tipo</label><input name="nome" placeholder="Ex.: Gargantilha"></div>
        <div class="field col-4"><button class="btn btn-primary" type="submit">Adicionar tipo</button></div>
      </form>
    </details>
  `);

  setupProductFilters();

  document.getElementById("productForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canRegisterProduct()) return alert("Sua função não permite cadastrar ou editar joias.");
    const form = new FormData(event.currentTarget);
    const file = form.get("foto");
    const produtoId = String(form.get("produtoId") || "");
    const existing = produtoId ? (state.data.produtos?.[produtoId] || {}) : {};

    const product = {
      ...existing,
      codigo: String(form.get("codigo")).trim().toUpperCase(),
      descricao: String(form.get("descricao")).trim(),
      tipo: form.get("tipo"),
      material: form.get("material"),
      medida: String(form.get("medida")).trim(),
      pesoMedio: numberSafe(form.get("pesoMedio") || 0),
      estoqueDisponivel: quantitySafe(existing.estoqueDisponivel || 0),
      estoqueConsignado: quantitySafe(existing.estoqueConsignado || 0),
      estoqueVendido: quantitySafe(existing.estoqueVendido || 0),
      estoqueMinimo: quantitySafe(form.get("estoqueMinimo") || 0),
      criadoEm: existing.criadoEm || nowIso(),
      atualizadoEm: nowIso()
    };

    const button = event.currentTarget.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = produtoId ? "Salvando alterações..." : "Salvando...";

    try {
      if (file && file.size) {
        product.fotoUrl = await uploadImage(file, `${product.codigo || "joia"}.jpg`);
        product.fotoOrigem = "manual";
      } else if (existing.fotoUrl) {
        product.fotoUrl = existing.fotoUrl;
        product.fotoOrigem = existing.fotoOrigem || "manual";
      }

      const saveId = produtoId || productIdFrom(product);
      await DB.save("produtos", saveId, product);
      await auditLog(produtoId ? "joia_alterada" : "joia_cadastrada", {
        colecao: "produtos",
        documentoId: saveId,
        motivo: produtoId ? "Edição manual de joia" : "Cadastro manual de joia",
        resumo: `${product.codigo || ""} · ${product.descricao || ""}`,
        antes: existing,
        depois: product
      });
      state.editingProductId = "";
      await loadData();
      render();
    } catch (err) {
      alert(err.message);
      button.disabled = false;
      button.textContent = submitLabel;
    }
  });

  document.querySelectorAll("[data-edit-product]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingProductId = button.dataset.editProduct || "";
      render();
      setTimeout(() => document.getElementById("productEditorCard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    });
  });

  document.getElementById("cancelProductEditBtn")?.addEventListener("click", () => {
    state.editingProductId = "";
    render();
  });

  document.getElementById("tipoForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isAdminUser()) return alert("Acesso restrito ao administrador master ou gerente para criar tipos de produto.");
    const form = new FormData(event.currentTarget);
    const nome = String(form.get("nome")).trim();
    if (!nome) return;
    const tipoId = uid("tipo");
    const tipo = { nome, ativo: true, criadoEm: nowIso() };
    await DB.save("tiposProduto", tipoId, tipo);
    await auditLog("tipo_produto_criado", {
      colecao: "tiposProduto",
      documentoId: tipoId,
      motivo: "Cadastro de tipo de produto",
      resumo: nome,
      depois: tipo
    });
    await loadData();
    render();
  });
}
function producaoView() {
  if (!isAdminUser()) return shell(`<div class="notice danger"><strong>Acesso restrito.</strong><br>Acesso restrito ao administrador master ou gerente para lançar produção pronta.</div>`);
  const produtos = objectToArray(state.data.produtos)
    .filter(isValidOperationalItem)
    .sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || "")));
  const pendingOrders = pendingProductionOrders();
  const options = produtos.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.codigo)} · ${escapeHtml(p.medida || "-")} · ${escapeHtml(p.material || "-")} · ${escapeHtml(p.descricao || "")}</option>`).join("\n");
  const orderOptions = productionOrdersByProductOptions(pendingOrders);

  shell(`
    <section class="owner-page-head">
      <div>
        <span class="eyebrow">Produção sem perda de controle</span>
        <h2>Entrada manual e fila de produção.</h2>
        <p>A venda inteligente não cria produção automática. Use esta tela para pedidos de produção existentes, entrada pronta e decisões manuais do gestor.</p>
      </div>
      <div class="owner-page-actions">
        <a class="btn btn-light" href="#/estoque">Conferir estoque</a>
        <a class="btn btn-gold" href="#/importacao">Importar produção pronta</a>
      </div>
    </section>

    <div class="card production-flow-card focus-card">
      <div class="card-head">
        <div>
          <h2>Fila de produção pendente</h2>
          <p style="color:var(--muted)">Esta é a tela principal da fábrica. Produziu? Clique em <strong>Dar entrada</strong>.</p>
        </div>
        <span class="badge ${pendingOrders.length ? "danger" : "success"}">${formatNumber(pendingOrders.length, 0)} pendência(s)</span>
      </div>
      ${productionQueueTable(pendingOrders)}
    </div>

    <div class="card">
      <h2>Entrada de produção pronta</h2>
      <p style="color:var(--muted)">Escolha um pedido pendente para preencher automático. Se não escolher, a produção entra como estoque livre.</p>
      <form id="productionForm" class="form-row">
        <input type="hidden" name="pedidoProducaoId" id="pedidoProducaoId">
        <div class="field col-5"><label>Pedido pendente para atender</label><select name="pedidoProducaoSelect" id="pedidoProducaoSelect">${orderOptions}</select></div>
        <div class="field col-5"><label>Produto</label><select name="produtoId" id="productionProdutoId" required>${options}</select></div>
        <div class="field col-2"><label>Quantidade produzida</label><input name="quantidade" id="productionQuantidade" type="number" step="1" min="1" required></div>
        <div class="field col-2"><label>Peso unitário real</label><input name="pesoUnitario" id="productionPesoUnitario" type="number" step="0.001"></div>
        <div class="field col-3"><label>Lote</label><input name="lote" id="productionLote" placeholder="Lote interno"></div>
        <div class="field col-4"><label>Responsável</label><input name="responsavel" placeholder="Nome"></div>
        <div class="field col-8"><label>Pesos reais por peça</label><input name="pesosReais" placeholder="Ex.: 1,48; 1,53; 1,51 — opcional, um peso por peça"></div>
        <div class="field col-12"><label>Entrada por grupos de peso/lote</label><textarea name="lotesProducao" rows="3" placeholder="Opcional. Ex.: 28x2,000 | LOTE-A; 2x2,100 | LOTE-B. Cada grupo cria peças físicas com o peso real informado."></textarea><small>Use quando a mesma produção vier em pesos diferentes. O total dos grupos deve bater com a quantidade produzida.</small></div>
        <div class="field col-12"><label>Observação</label><input name="observacao" id="productionObservacao" placeholder="Detalhes da produção"></div>
        <div class="field col-12"><button class="btn btn-gold" type="submit">Dar entrada e reconciliar</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Histórico de produção</h2>
      ${productionTable()}
    </div>
  `);

  setupReversalButtons();

  const applyOrderToForm = (orderId = "") => {
    const order = pendingOrders.find((item) => item.id === orderId);
    const hidden = document.getElementById("pedidoProducaoId");
    const productSelect = document.getElementById("productionProdutoId");
    const qtdInput = document.getElementById("productionQuantidade");
    const pesoInput = document.getElementById("productionPesoUnitario");
    const loteInput = document.getElementById("productionLote");
    const obsInput = document.getElementById("productionObservacao");
    if (hidden) hidden.value = order?.id || "";
    if (!order) return;
    if (productSelect) productSelect.value = order.produtoId || "";
    if (qtdInput) qtdInput.value = productionOrderPendingQuantity(order) || "";
    if (pesoInput && (order.pesoUnitarioPedido || order.pesoUnitario)) pesoInput.value = order.pesoUnitarioPedido || order.pesoUnitario || "";
    if (loteInput && !loteInput.value) loteInput.value = `PROD-${order.numeroPedido || order.pedidoPdfNumero || order.numeroPedidoVenda || order.id}-${order.codigo || "ITEM"}-${order.medida || ""}`.replace(/\s+/g, "_");
    if (obsInput) obsInput.value = productionOrderSaleId(order)
      ? `Produção para atender venda pendente ${order.numeroPedido || order.pedidoPdfNumero || ""}.`
      : `Produção vinculada ao pedido ${order.numeroPedido || order.pedidoPdfNumero || order.id}.`;
  };

  document.getElementById("pedidoProducaoSelect")?.addEventListener("change", (event) => applyOrderToForm(event.currentTarget.value));
  document.querySelectorAll("[data-fill-production-order]").forEach((button) => {
    button.addEventListener("click", () => {
      const orderId = button.dataset.fillProductionOrder || "";
      const select = document.getElementById("pedidoProducaoSelect");
      if (select) select.value = orderId;
      applyOrderToForm(orderId);
      document.getElementById("productionForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.getElementById("productionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const pedidoProducaoId = String(form.get("pedidoProducaoId") || form.get("pedidoProducaoSelect") || "");
    const pedidoProducao = pedidoProducaoId ? (state.data.pedidosProducao?.[pedidoProducaoId] ? { id: pedidoProducaoId, ...state.data.pedidosProducao[pedidoProducaoId] } : null) : null;
    const produtoId = String(form.get("produtoId") || pedidoProducao?.produtoId || "");
    const qtdInformada = quantitySafe(form.get("quantidade") || 0);
    const pesoInformado = numberSafe(form.get("pesoUnitario") || pedidoProducao?.pesoUnitarioPedido || 0);
    const product = state.data.produtos[produtoId];

    if (!product) return alert("Produto não encontrado.");
    if (!qtdInformada || qtdInformada <= 0) return alert("Informe uma quantidade produzida válida.");

    const loteBase = form.get("lote") || generatedLotCode(product, { header: { numeroPedido: pedidoProducao?.numeroPedido || pedidoProducao?.pedidoPdfNumero || "MANUAL" }, arquivoNome: "lançamento manual" });
    const gruposEntrada = parseProductionLotGroups(form.get("lotesProducao") || "", { quantidade: qtdInformada, pesoUnitario: pesoInformado, lote: loteBase });
    const totaisEntrada = productionGroupsTotals(gruposEntrada);
    const qtd = totaisEntrada.quantidade || qtdInformada;
    const pesoUnitario = totaisEntrada.pesoUnitarioMedio || pesoInformado;
    const pesoTotal = totaisEntrada.pesoTotal || (qtd * pesoUnitario);
    const loteManual = loteBase;

    if (!qtd || qtd <= 0) return alert("Informe uma quantidade produzida válida.");
    if (!pesoUnitario) return alert("Informe o peso unitário real ou os grupos de peso/lote.");
    if (gruposEntrada.length && qtd !== qtdInformada) {
      return alert(`A quantidade informada (${qtdInformada}) não bate com a soma dos grupos (${qtd}). Corrija antes de dar entrada.`);
    }
    if (pedidoProducao && qtd > productionOrderPendingQuantity(pedidoProducao)) {
      const ok = confirm(`A quantidade produzida (${qtd}) é maior que o pendente (${productionOrderPendingQuantity(pedidoProducao)}). O excedente ficará disponível no estoque. Confirmar?`);
      if (!ok) return;
    }

    // V62: preserva saldo legado e registra o peso total produzido no razão independente.
    await ensureLegacyPhysicalPieces(produtoId, product);
    applyProductWeightLedgerDelta(produtoId, product, {
      entradaDelta: pesoTotal,
      motivo: "Produção pronta manual: entrada de quantidade física e peso total controlados separadamente."
    });
    product.ultimaMovimentacaoEm = nowIso();
    product.atualizadoEm = nowIso();
    if (pesoUnitario) product.pesoMedio = pesoUnitario;
    await DB.save("produtos", produtoId, product);
    localSetCollection("produtos", produtoId, product);

    const resumoLotes = productionLotSummary(gruposEntrada);
    const producaoId = await DB.push("producoes", {
      produtoId,
      pedidoProducaoId: pedidoProducao?.id || "",
      vendaId: productionOrderSaleId(pedidoProducao || {}),
      codigo: product.codigo,
      descricao: product.descricao,
      medida: product.medida,
      material: product.material,
      quantidade: qtd,
      pesoUnitario,
      pesoTotal,
      pesoUnitarioPedido: numberSafe(pedidoProducao?.pesoUnitarioPedido || 0),
      pesoTotalPedido: numberSafe(pedidoProducao?.pesoTotalPedido || 0),
      diferencaPesoUnitario: numberSafe(pedidoProducao?.pesoUnitarioPedido || 0) ? pesoUnitario - numberSafe(pedidoProducao?.pesoUnitarioPedido || 0) : 0,
      lote: loteManual,
      lotesEntrada: gruposEntrada,
      resumoLotes,
      responsavel: form.get("responsavel") || "",
      observacao: form.get("observacao") || "",
      status: pedidoProducao ? "pronta_comparada" : "pronta",
      tipoRegistro: pedidoProducao ? "entrada_producao_vinculada" : "entrada_producao_manual",
      criadoEm: nowIso(),
      criadoPor: state.user?.email || ""
    });

    const pieceIds = [];
    for (const grupo of gruposEntrada) {
      const loteGrupo = grupo.lote || loteManual;
      const pesoTotalGrupo = quantitySafe(grupo.quantidade || 0) * numberSafe(grupo.pesoUnitario || 0);
      const loteId = await DB.push("lotes", {
        lote: loteGrupo,
        lotePrincipal: loteManual,
        produtoId,
        codigo: product.codigo,
        descricao: product.descricao,
        medida: product.medida,
        material: product.material,
        tipoMovimento: pedidoProducao ? "entrada_producao_vinculada" : "entrada_producao_manual",
        status: "disponivel",
        quantidadeEntrada: grupo.quantidade,
        quantidadeDisponivel: grupo.quantidade,
        pesoUnitario: grupo.pesoUnitario,
        pesoTotal: pesoTotalGrupo,
        producaoId,
        pedidoProducaoId: pedidoProducao?.id || "",
        origem: "manual",
        arquivoNome: "",
        criadoEm: nowIso(),
        criadoPor: state.user?.email || ""
      });
      localSetCollection("lotes", loteId, { lote: loteGrupo, lotePrincipal: loteManual, produtoId, codigo: product.codigo, descricao: product.descricao, medida: product.medida, material: product.material, quantidadeEntrada: grupo.quantidade, quantidadeDisponivel: grupo.quantidade, pesoUnitario: grupo.pesoUnitario, pesoTotal: pesoTotalGrupo, producaoId, pedidoProducaoId: pedidoProducao?.id || "", origem: "manual", criadoEm: nowIso() });

      const idsGrupo = await createPhysicalPieces({
        produtoId,
        item: { ...product, lote: loteGrupo, pesosReais: form.get("pesosReais") || "" },
        parsed: { header: { numeroPedido: pedidoProducao?.numeroPedido || pedidoProducao?.pedidoPdfNumero || "MANUAL" }, arquivoNome: "lançamento manual" },
        origem: pedidoProducao ? "entrada_producao_vinculada" : "entrada_producao_manual",
        status: "disponivel",
        quantidade: grupo.quantidade,
        pesoUnitario: grupo.pesoUnitario,
        pesoTotal: pesoTotalGrupo,
        pesoUnitarioPedido: numberSafe(pedidoProducao?.pesoUnitarioPedido || 0),
        pedidoId: producaoId,
        producaoId,
        pedidoProducaoId: pedidoProducao?.id || "",
        loteId,
        loteCodigo: loteGrupo,
        observacao: form.get("observacao") || `Entrada de produção por grupo: ${grupo.quantidade} peça(s) de ${grupo.pesoUnitario} g.`
      });
      pieceIds.push(...idsGrupo);
    }

    let atendimento = { quantidadeBaixadaVenda: 0, quantidadeBaixadaVendas: 0, quantidadeExcedenteEstoque: qtd };
    if (pedidoProducao?.id) {
      atendimento = await applyProductionToPendingOrder({
        pedidoProducao,
        produtoId,
        product,
        quantidadeProduzida: qtd,
        pieceIds,
        producaoId,
        documentoId: pedidoProducao.origemDocumentoId || pedidoProducao.pedidoVendaId || "",
        origem: "entrada_producao_manual",
        pesoTotal
      });
    } else {
      atendimento = await applyProductionToApprovedAlerts({
        produtoId,
        product,
        quantidadeProduzida: qtd,
        pieceIds,
        producaoId,
        documentoId: "",
        origem: "entrada_producao_manual",
        pesoTotal
      });
    }

    const manualProductionPatch = {
      atendimentoVenda: atendimento,
      quantidadeBaixadaVendas: quantitySafe(atendimento.quantidadeBaixadaVenda || atendimento.quantidadeBaixadaVendas || 0),
      quantidadeExcedenteEstoque: Math.max(0, qtd - quantitySafe(atendimento.quantidadeBaixadaVenda || atendimento.quantidadeBaixadaVendas || 0)),
      atualizadoEm: nowIso()
    };
    await DB.patch("producoes", producaoId, manualProductionPatch);
    localPatchCollection("producoes", producaoId, manualProductionPatch);

    await registerMovement({
      produtoId,
      tipo: pedidoProducao ? "entrada_producao_vinculada" : "entrada_producao",
      quantidade: qtd,
      peso: pesoTotal,
      pedidoId: producaoId,
      origem: "producao",
      observacao: pedidoProducao
        ? `Entrada vinculada ao pedido de produção ${pedidoProducao.id}. Baixa automática em venda: ${atendimento.quantidadeBaixadaVenda || 0}.`
        : (`${form.get("observacao") || "Entrada de produção pronta."} Venda(s) parcial(is) atendida(s): ${atendimento.quantidadeBaixadaVendas || 0}. Excedente em estoque: ${atendimento.quantidadeExcedenteEstoque ?? qtd}.`)
    });

    await auditLog("producao_lancada", {
      colecao: "producoes",
      documentoId: producaoId,
      motivo: auditReason(form.get("observacao"), pedidoProducao ? "Entrada de produção vinculada" : "Entrada de produção pronta"),
      resumo: `${product.codigo || ""} · qtd ${qtd}`,
      depois: { produtoId, pedidoProducaoId: pedidoProducao?.id || "", codigo: product.codigo, quantidade: qtd, pesoUnitario, lote: loteManual, atendimento }
    });

    await loadData();
    render();
  });
}

function productionQueueTable(orders = []) {
  if (!orders.length) return `<div class="empty">Nenhuma pendência de produção. Faltas de venda inteligente ficam em Alertas do gestor até decisão manual.</div>`;
  return `
    <div class="table-wrap production-queue-table">
      <table>
        <thead><tr><th>Origem</th><th>Pedido/Venda</th><th>Código</th><th>Descrição</th><th>Medida</th><th>Material</th><th>Peso ref.</th><th>Lote ref.</th><th>Pedido venda</th><th>Reservado</th><th>Produzir venda</th><th>Reposição mín.</th><th>Pendente total</th><th>Status</th><th>Ação</th></tr></thead>
        <tbody>
          ${orders.map((order) => `
            <tr>
              <td>${escapeHtml(productionOrderOriginLabel(order))}</td>
              <td><strong>${escapeHtml(order.numeroPedido || order.pedidoPdfNumero || order.numeroPedidoVenda || order.id)}</strong><br><small>${escapeHtml(order.cliente || "")}</small></td>
              <td>${escapeHtml(order.codigo || "")}</td>
              <td>${escapeHtml(order.descricao || "")}</td>
              <td>${escapeHtml(order.medida || "-")}</td>
              <td>${escapeHtml(order.material || "-")}</td>
              <td>${order.pesoUnitarioPedido || order.pesoIdentificador ? `${formatNumber(order.pesoUnitarioPedido || order.pesoIdentificador || 0, 3)} g` : "-"}</td>
              <td>${escapeHtml(order.loteReferencia || "-")}</td>
              <td>${formatNumber(order.quantidadeSolicitadaVenda || order.quantidadeOriginalVenda || 0, 0)}</td>
              <td>${formatNumber(order.quantidadeReservadaVenda || 0, 0)}</td>
              <td><strong>${formatNumber(order.quantidadePendenteVenda ?? order.quantidadeFaltanteVenda ?? 0, 0)}</strong></td>
              <td>${formatNumber(order.quantidadeReposicaoMinima || order.quantidadeReposicaoEstoque || 0, 0)}</td>
              <td><strong>${formatNumber(productionOrderPendingQuantity(order), 0)}</strong></td>
              <td>${productionOrderStatusBadge(order)}</td>
              <td><button class="btn btn-gold btn-sm" data-fill-production-order="${escapeHtml(order.id)}">Dar entrada</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function productionTable() {
  const producoes = objectToArray(state.data.producoes).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  if (!producoes.length) return `<div class="empty">Nenhuma produção lançada ainda.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Código</th><th>Descrição</th><th>Medida</th><th>Qtd</th><th>Peso total</th><th>Lote</th><th>Status</th><th>Responsável</th><th>Ação</th></tr></thead>
        <tbody>
          ${producoes.map((p) => {
            const reversed = isReversedRecord(p);
            const manualEntry = !productionHeaderRecord(p) && !String(p.origemDocumentoId || "");
            const action = !isAdminUser() || !manualEntry || reversed
              ? "-"
              : `<button class="btn btn-danger btn-sm" type="button" data-reverse-production="${escapeHtml(p.id || "")}">Estornar entrada</button>`;
            return `
              <tr>
                <td>${formatDate(p.criadoEm)}</td>
                <td>${escapeHtml(p.codigo || "")}</td>
                <td>${escapeHtml(p.descricao || "")}</td>
                <td>${escapeHtml(p.medida || "")}</td>
                <td>${formatNumber(p.quantidade || 0, 0)}</td>
                <td>${formatNumber(p.pesoTotal || 0, 3)} g</td>
                <td>${escapeHtml(p.lote || "")}</td>
                <td>${reversed ? `<span class="badge light">Estornada</span>` : escapeHtml(p.status || p.tipoRegistro || "")}</td>
                <td>${escapeHtml(p.responsavel || "")}</td>
                <td>${action}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}



function calculadoraView() {
  if (!isAdminUser()) return shell(`<div class="notice danger"><strong>Acesso restrito.</strong><br>Acesso restrito ao administrador master ou gerente para acessar a calculadora técnica.</div>`);
  shell(`
    <div class="card">
      <h2>Calculadora técnica da fábrica</h2>
      <p style="color:var(--muted)">Calcule uma estimativa de produção usando os parâmetros reais informados pela fábrica: quantidade, peso unitário, perda, custo por grama, mão de obra e margem.</p>
      <form id="calcForm" class="form-row">
        <div class="field col-3"><label>Tipo de joia</label><select name="tipo"><option>Anel</option><option>Aliança</option><option>Aparador</option><option>Brinco</option><option>Corrente</option><option>Pingente</option><option>Outro</option></select></div>
        <div class="field col-2"><label>Material</label><select name="material"><option>Prata</option><option>Ouro 18K</option><option>Ouro 10K</option><option>Ouro</option><option>Outro</option></select></div>
        <div class="field col-2"><label>Medida</label><input name="medida" placeholder="17"></div>
        <div class="field col-2"><label>Quantidade</label><input name="quantidade" type="number" min="1" step="1" value="20"></div>
        <div class="field col-3"><label>Peso unitário estimado (g)</label><input name="pesoUnitario" type="number" step="0.001" placeholder="Ex.: 2.500"></div>
        <div class="field col-3"><label>Perda de produção (%)</label><input name="perda" type="number" step="0.01" value="0"></div>
        <div class="field col-3"><label>Custo por grama</label><input name="custoGrama" type="number" step="0.01" placeholder="R$"></div>
        <div class="field col-3"><label>Mão de obra total</label><input name="maoObra" type="number" step="0.01" placeholder="R$"></div>
        <div class="field col-3"><label>Margem desejada (%)</label><input name="margem" type="number" step="0.01" value="0"></div>
        <div class="field col-12"><button class="btn btn-gold" type="submit">Calcular produção</button></div>
      </form>
    </div>

    <div class="card" id="calcOutput">
      <div class="empty">Informe os parâmetros e gere o cálculo da produção.</div>
    </div>

    <div class="card">
      <h2>Uso correto da calculadora</h2>
      <div class="grid grid-3">
        <div class="notice"><strong>Peso unitário</strong><br>Use o peso real do modelo ou uma média aprovada pela fábrica.</div>
        <div class="notice"><strong>Perda</strong><br>Informe o percentual usado na produção para sobra, acabamento ou retrabalho.</div>
        <div class="notice"><strong>Prata</strong><br>Use o custo por grama atualizado e a regra comercial da operação.</div>
      </div>
    </div>
  `);

  document.getElementById("calcForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantidade = quantitySafe(form.get("quantidade") || 0);
    const pesoUnitario = numberSafe(form.get("pesoUnitario") || 0);
    const perda = numberSafe(form.get("perda") || 0);
    const custoGrama = numberSafe(form.get("custoGrama") || 0);
    const maoObra = numberSafe(form.get("maoObra") || 0);
    const margem = numberSafe(form.get("margem") || 0);

    const pesoLiquido = quantidade * pesoUnitario;
    const pesoPerda = pesoLiquido * (perda / 100);
    const pesoComprar = pesoLiquido + pesoPerda;
    const custoMaterial = pesoComprar * custoGrama;
    const custoTotal = custoMaterial + maoObra;
    const precoSugerido = custoTotal * (1 + margem / 100);
    const custoUnitario = quantidade ? custoTotal / quantidade : 0;
    const precoUnitario = quantidade ? precoSugerido / quantidade : 0;

    document.getElementById("calcOutput").innerHTML = `
      <div class="report-box">
        <div class="report-header">
          <div>
            <h2>Laudo técnico de cálculo</h2>
            <p>${escapeHtml(form.get("tipo") || "")} · ${escapeHtml(form.get("material") || "")} · medida ${escapeHtml(form.get("medida") || "-")}</p>
          </div>
          <span class="badge gold">Estimativa de produção</span>
        </div>

        <div class="grid grid-4">
          <div class="kpi"><span>Quantidade</span><strong>${formatNumber(quantidade, 0)}</strong></div>
          <div class="kpi"><span>Peso líquido</span><strong>${formatNumber(pesoLiquido, 3)} g</strong></div>
          <div class="kpi"><span>Peso com perda</span><strong>${formatNumber(pesoComprar, 3)} g</strong></div>
          <div class="kpi"><span>Custo total</span><strong>${formatCurrency(custoTotal)}</strong></div>
        </div>

        <div style="height:18px"></div>

        <div class="grid grid-3">
          <div class="notice"><strong>Custo material</strong><br>${formatCurrency(custoMaterial)}</div>
          <div class="notice"><strong>Custo unitário</strong><br>${formatCurrency(custoUnitario)}</div>
          <div class="notice"><strong>Preço sugerido unitário</strong><br>${formatCurrency(precoUnitario)}</div>
        </div>

        <div class="report-footer"><span>Cálculo com parâmetros informados pela fábrica</span><strong>${escapeHtml(APP_CONFIG.app.assinatura)}</strong></div>
      </div>
    `;
  });
}


function pendingManagerStockAlerts() {
  return objectToArray(state.data?.alertasOperacionais || {})
    .filter(isValidOperationalItem)
    .filter((alert) => String(alert.tipo || alert.tipoRegistro || "").includes("venda_sem_estoque") || String(alert.tipoRegistro || "").includes("alerta_gestor_venda_sem_estoque"))
    .filter((alert) => !["resolvido", "resolvida", "cancelado", "cancelada", "arquivado", "arquivada"].includes(String(alert.status || "pendente_analise_gestor").toLowerCase()))
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
}

function alertPedidoLabel(alert = {}) {
  return alert.numeroPedido || alert.pedidoPdfNumero || alert.numeroPedidoVenda || alert.pedidoId || alert.origemDocumentoId || "Sem pedido";
}

function alertRequestedQty(alert = {}) {
  const faltante = quantitySafe(alert.quantidadeFaltante || alert.quantidadePendenteAnalise || alert.quantidadePendenteAnaliseGestor || 0);
  const baixado = quantitySafe(alert.quantidadeBaixada || 0);
  return quantitySafe(alert.quantidadeSolicitada || alert.quantidadeSolicitadaVenda || alert.quantidade || 0) || (faltante + baixado);
}

function alertDownloadedQty(alert = {}) {
  return quantitySafe(alert.quantidadeBaixada || alert.quantidadeBaixadaVenda || 0);
}

function alertMissingQty(alert = {}) {
  return quantitySafe(alert.quantidadeFaltante || alert.quantidadePendenteAnalise || alert.quantidadePendenteAnaliseGestor || 0);
}

function groupManagerAlertsByOrder(alerts = []) {
  const grouped = new Map();
  alerts.forEach((alert) => {
    const pedido = alertPedidoLabel(alert);
    const key = String(pedido || "sem_pedido");
    const atual = grouped.get(key) || {
      id: key,
      pedido,
      cliente: alert.cliente || "",
      vendedor: alert.vendedor || alert.responsavel || "",
      criadoEm: alert.criadoEm || "",
      alerts: [],
      solicitado: 0,
      baixado: 0,
      faltante: 0,
      producaoAprovada: 0,
      producaoRecebida: 0,
      producaoPendente: 0
    };
    atual.alerts.push(alert);
    atual.solicitado += alertRequestedQty(alert);
    atual.baixado += alertDownloadedQty(alert) + quantitySafe(alert.quantidadeAplicadaVenda || 0);
    atual.faltante += alertMissingQty(alert);
    atual.producaoAprovada += alertApprovedProductionQty(alert);
    atual.producaoRecebida += alertReceivedProductionQty(alert);
    atual.producaoPendente += alertApprovedProductionRemaining(alert);
    atual.cliente = atual.cliente || alert.cliente || "";
    atual.vendedor = atual.vendedor || alert.vendedor || alert.responsavel || "";
    atual.criadoEm = String(alert.criadoEm || "") > String(atual.criadoEm || "") ? alert.criadoEm : atual.criadoEm;
    grouped.set(key, atual);
  });
  return [...grouped.values()].sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
}

function managerAlertCards(alerts = []) {
  if (!alerts.length) return `<div class="empty clean-empty">Nenhuma falta de venda ou produção aprovada pendente.</div>`;
  const groups = groupManagerAlertsByOrder(alerts);
  return `
    <div class="manager-alert-order-cards">
      ${groups.map((group) => {
        const title = group.faltante > 0
          ? `Faltam ${formatNumber(group.faltante || 0, 0)} de ${formatNumber(group.solicitado || 0, 0)} peça(s)`
          : (group.producaoPendente > 0 ? `Venda atendida · faltam receber ${formatNumber(group.producaoPendente, 0)} peça(s) aprovadas` : "Pendência concluída");
        return `
        <article class="manager-alert-order-card" data-manager-alert-order data-order="${escapeHtml(group.pedido || "")}">
          <div class="manager-order-head">
            <div>
              <span class="badge ${group.faltante > 0 ? "danger" : "success"}">Pedido ${escapeHtml(group.pedido || "-")}</span>
              <h3>${title}</h3>
              <p>${escapeHtml(group.cliente || "Cliente não informado")}${group.vendedor ? ` · ${escapeHtml(group.vendedor)}` : ""}</p>
              <strong class="manager-order-equation">Pedido ${escapeHtml(group.pedido || "-")}: solicitado ${formatNumber(group.solicitado || 0, 0)} · baixado ${formatNumber(group.baixado || 0, 0)} · faltante venda ${formatNumber(group.faltante || 0, 0)}</strong>
            </div>
            <a class="btn btn-light btn-sm" href="#/estoque" data-stock-filter-text="${escapeHtml(group.pedido || "")}">Ver SKUs deste pedido</a>
          </div>
          <div class="manager-order-kpis">
            <div><small>Total pedido</small><b>${formatNumber(group.solicitado || 0, 0)}</b></div>
            <div><small>Baixado do estoque/venda</small><b>${formatNumber(group.baixado || 0, 0)}</b></div>
            <div><small>Faltante da venda</small><b>${formatNumber(group.faltante || 0, 0)}</b></div>
            <div><small>Produção aprovada pendente</small><b>${formatNumber(group.producaoPendente || 0, 0)}</b></div>
          </div>
          <details class="manager-order-items" open>
            <summary>Itens deste pedido (${formatNumber(group.alerts.length || 0, 0)})</summary>
            <div class="manager-order-item-list">
              ${group.alerts.map((alert) => {
                const approved = alertApprovedProductionQty(alert);
                const received = alertReceivedProductionQty(alert);
                const approvalPending = alertApprovedProductionRemaining(alert);
                const approvedFlag = isAlertProductionApproved(alert);
                return `
                <div class="manager-order-item">
                  <div>
                    <strong>${escapeHtml(alert.codigo || "")} · Nº ${escapeHtml(alert.medida || "-")} · ${escapeHtml(alert.material || "-")}</strong>
                    <span>${escapeHtml(alert.descricao || "")}</span>
                    ${approvedFlag ? `<small><span class="badge warning">Produção aprovada</span> total ${formatNumber(approved, 0)} · recebido ${formatNumber(received, 0)} · falta receber ${formatNumber(approvalPending, 0)}</small>` : `<small><span class="badge danger">Aguardando decisão</span></small>`}
                  </div>
                  <div class="manager-order-item-numbers">
                    <span>Solicitado <b>${formatNumber(alertRequestedQty(alert), 0)}</b></span>
                    <span>Baixado <b>${formatNumber(alertDownloadedQty(alert) + quantitySafe(alert.quantidadeAplicadaVenda || 0), 0)}</b></span>
                    <span>Faltante venda <b>${formatNumber(alertMissingQty(alert), 0)}</b></span>
                    <button class="btn ${approvedFlag ? "btn-light" : "btn-gold"} btn-sm" type="button" data-approve-alert-production="${escapeHtml(alert.id)}">${approvedFlag ? "Alterar produção aprovada" : "Aprovar produção"}</button>
                  </div>
                </div>`;
              }).join("")}
            </div>
          </details>
          <p class="manager-order-decision"><strong>Regra:</strong> o alerta aprovado não vira ordem de produção. Quando a produção pronta entrar, o sistema atende primeiro a venda pendente e deixa somente o excedente disponível no estoque.</p>
        </article>`;
      }).join("")}
    </div>
  `;
}

function managerAlertTable(alerts = []) {
  return managerAlertCards(alerts);
}

function criticalSummaryCards(rows = []) {
  if (!rows.length) return `<div class="empty clean-empty">Nenhum SKU abaixo do crítico.</div>`;
  return `
    <div class="compact-decision-list">
      ${rows.map((row) => `
        <div class="compact-decision-item">
          <strong>${escapeHtml(row.codigo || "")} · Nº ${escapeHtml(row.medida || "-")}</strong>
          <span>${escapeHtml(row.material || "-")} · disponível ${formatNumber(row.estoqueDisponivel || row.disponivelReal || 0, 0)} · crítico ${formatNumber(row.estoqueMinimo || row.estoqueCritico || 0, 0)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function alertasView() {
  const alerts = pendingManagerStockAlerts();
  const groups = groupManagerAlertsByOrder(alerts);
  const totalFaltante = sum(alerts, (alert) => alertMissingQty(alert));
  const totalProducaoPendente = sum(alerts, (alert) => alertApprovedProductionRemaining(alert));
  const resumoFormula = groups.length
    ? groups.map((group) => `Pedido ${escapeHtml(group.pedido || "-")}: venda ${formatNumber(group.faltante || 0, 0)} · produção aprovada pendente ${formatNumber(group.producaoPendente || 0, 0)}`).join(" · ")
    : "Sem faltas de venda pendentes.";
  shell(`
    <section class="owner-page-head clean-page-head">
      <div>
        <span class="eyebrow">Decisões do gestor</span>
        <h2>Faltas de venda por pedido.</h2>
        <p>Não é estoque mínimo. Aqui aparecem somente peças vendidas/pedidas que não puderam ser baixadas do estoque.</p>
      </div>
      <div class="owner-page-actions">
        <a class="btn btn-light" href="#/estoque">Consultar estoque</a>
        <a class="btn btn-gold" href="#/vendas">Importar venda</a>
      </div>
    </section>
    <div class="owner-kpi-grid compact clean-kpis">
      <div class="owner-kpi-card attention"><span>Pedidos com falta</span><strong>${formatNumber(groups.length, 0)}</strong><small>cada card abaixo é um pedido</small></div>
      <div class="owner-kpi-card attention"><span>Peças faltantes no total</span><strong>${formatNumber(totalFaltante, 0)}</strong><small>${resumoFormula}</small></div>
      <div class="owner-kpi-card"><span>Produção aprovada pendente</span><strong>${formatNumber(totalProducaoPendente, 0)}</strong><small>não é ordem de produção</small></div>
      <div class="owner-kpi-card"><span>Estoque</span><strong>Seguro</strong><small>venda primeiro; excedente fica disponível</small></div>
    </div>
    <div class="card clean-panel">
      <div class="card-head"><div><h2>Fila de decisão por pedido</h2><p>Solicitado, baixado e faltante ficam explícitos em cada pedido.</p></div><span class="badge danger">Acompanhar</span></div>
      ${managerAlertCards(alerts)}
    </div>
  `);

  document.querySelectorAll("[data-approve-alert-production]").forEach((button) => {
    button.addEventListener("click", () => approveManagerAlertProduction(button.dataset.approveAlertProduction || ""));
  });
}

function estoqueView() {
  const produtos = objectToArray(state.data.produtos);
  const rows = physicalStockRows().sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || "")));
  const pecas = physicalPieces().filter(pieceIsActive);
  const materiaisEstoque = [...new Set([...rows.map((row) => row.material || ""), ...pecas.map((piece) => piece.material || "")].filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const disponiveis = pecas.filter((p) => String(p.status || "").toLowerCase() === "disponivel");
  const consignadas = pecas.filter((p) => String(p.status || "").toLowerCase() === "consignado");
  const vendidas = pecas.filter((p) => String(p.status || "").toLowerCase() === "vendido");

  const disponivelTotal = pecas.length ? disponiveis.length : sum(produtos, (p) => p.estoqueDisponivel);
  const consignadoTotal = pecas.length ? consignadas.length : sum(produtos, (p) => p.estoqueConsignado);
  const vendidoTotal = pecas.length ? vendidas.length : sum(produtos, (p) => p.estoqueVendido);
  const pesoDisponivel = rows.length ? sum(rows, (row) => row.pesoDisponivelReal || 0) : sum(produtos, (p) => p.pesoTotalDisponivel || 0);
  const pendingOrders = pendingProductionOrders();
  const pendingQty = sum(pendingOrders, (order) => productionOrderPendingQuantity(order));
  const managerAlerts = pendingManagerStockAlerts();
  const managerAlertQty = sum(managerAlerts, (alert) => alert.quantidadeFaltante || alert.quantidadePendenteAnalise || 0);
  const criticos = criticalProducts({ ...state.data, produtos: Object.fromEntries(rows.map((row) => [row.id || row.produtoId, { ...row, estoqueDisponivel: row.disponivelReal }])) });
  const pecasSemPeso = pecas.filter((p) => String(p.status || "").toLowerCase() === "disponivel" && p.pesoIndividualConhecido !== false && p.pesoControleModo !== "total_lote" && !numberSafe(p.pesoReal || p.pesoUnitario || 0));

  shell(`
    <section class="owner-page-head">
      <div>
        <span class="eyebrow">Controle de estoque</span>
        <h2>Consulte peças por código, material e medida.</h2>
        <p>A visão principal mostra apenas disponibilidade, venda e situação. Rastreabilidade fica em “Ver detalhes”.</p>
      </div>
      <div class="owner-page-actions">
        <a class="btn btn-gold" href="#/importacao">Importar inventário</a>
        <a class="btn btn-light" href="#/alertas">Ver alertas</a>
      </div>
    </section>

    <div class="owner-kpi-grid compact">
      <div class="owner-kpi-card"><span>Disponível</span><strong>${formatNumber(disponivelTotal, 0)}</strong><small>peças disponíveis</small></div>
      <div class="owner-kpi-card"><span>Vendido</span><strong>${formatNumber(vendidoTotal, 0)}</strong><small>peças baixadas</small></div>
      <a class="owner-kpi-card attention" href="#/alertas"><span>Faltas em vendas</span><strong>${formatNumber(managerAlertQty, 0)}</strong><small>${formatNumber(groupManagerAlertsByOrder(managerAlerts).length, 0)} pedido(s) para decisão</small></a>
      <div class="owner-kpi-card"><span>Peso disponível</span><strong>${formatNumber(pesoDisponivel, 3)} g</strong><small>${formatNumber(consignadoTotal, 0)} consignadas</small></div>
    </div>

    <details class="card advanced-details quick-stock-entry-card">
      <summary>Entrada manual rápida no estoque</summary>
      <p class="muted">Use quando não tiver PDF. Quantidade e peso total são controlados separadamente. Ex.: 10 peças podem somar 10,000 g sem significar que cada peça pesa 1,000 g.</p>
      <form id="manualStockEntryForm" class="form-row manual-stock-entry-form">
        <div class="field col-2"><label>Código</label><input name="codigo" required placeholder="Ex.: 2740AGL"></div>
        <div class="field col-3"><label>Descrição</label><input name="descricao" required placeholder="Ex.: AN.SOLITARIO/ 18K /1 ZIRC 3MM."></div>
        <div class="field col-2"><label>Material</label><input name="material" required placeholder="Ex.: Ouro 18K"></div>
        <div class="field col-1"><label>Medida</label><input name="medida" placeholder="Ex.: 15"></div>
        <div class="field col-1"><label>Qtd.</label><input name="quantidade" type="number" min="1" step="1" value="1" required></div>
        <div class="field col-2"><label>Como o peso foi informado?</label><select name="pesoModo"><option value="total" selected>Peso total da entrada</option><option value="unitario">Peso real por peça</option></select></div>
        <div class="field col-1"><label>Peso (g)</label><input name="pesoUnitario" inputmode="decimal" required placeholder="10,00"></div>
        <div class="field col-2"><label>Pedido/entrada</label><input name="pedido" placeholder="Ex.: 26784"></div>
        <div class="field col-3"><label>Lote</label><input name="lote" placeholder="Opcional"></div>
        <div class="field col-7"><label>Observação</label><input name="observacao" placeholder="Entrada manual autorizada / conferência"></div>
        <div class="field col-2"><label>&nbsp;</label><button class="btn btn-gold" type="submit">Adicionar ao estoque</button></div>
      </form>
    </details>

    <div class="card focus-card">
      <div class="card-head">
        <div>
          <h2>Consulta de estoque</h2>
          <p>Pesquise o SKU. A tabela principal fica limpa; detalhes técnicos ficam recolhidos.</p>
        </div>
        <span class="badge gold">Consulta operacional</span>
      </div>
      <div class="filter-panel owner-filter-panel" data-stock-filter-panel>
        <div class="field priority"><label>Código</label><input data-stock-code placeholder="Ex.: 2740AGL" autofocus></div>
        <div class="field"><label>Medida</label><input data-stock-measure placeholder="Ex.: 15"></div>
        <div class="field"><label>Material</label><select data-stock-material><option value="">Todos</option>${materiaisEstoque.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("")}</select></div>
        <div class="field"><label>Status</label><select data-stock-status><option value="">Todos</option><option value="disponivel">Disponível</option><option value="vendido">Vendido</option><option value="consignado">Consignado</option><option value="pendente">Falta em venda</option><option value="zerado">Zerado</option></select></div>
        <div class="field wide"><label>Busca geral</label><input data-stock-text placeholder="descricao, tipo, lote, peca, pedido, observacao..."></div>
        <div class="filter-actions"><button class="btn btn-light btn-sm" type="button" data-clear-stock-filters>Limpar</button><span class="badge blue" data-stock-counter></span></div>
      </div>
      <details class="stock-rules-drawer">
        <summary>Editar estoque crítico, ideal e sugestão</summary>
        <div class="stock-rules-panel" data-stock-rules-panel>
        <strong>Parâmetros dos SKUs selecionados</strong>
        <span data-stock-selected-count>0 SKU selecionado(s)</span>
        <label>Crítico <input type="number" min="0" step="1" data-stock-rule-critical placeholder="3"></label>
        <label>Ideal <input type="number" min="0" step="1" data-stock-rule-ideal placeholder="7"></label>
        <label>Sugestão <input type="number" min="0" step="1" data-stock-rule-suggested placeholder="7"></label>
        <button class="btn btn-light btn-sm" type="button" data-stock-select-filtered>Selecionar filtrados</button>
        <button class="btn btn-light btn-sm" type="button" data-stock-clear-selection>Limpar selecao</button>
        <button class="btn btn-gold btn-sm" type="button" data-apply-stock-rules>Aplicar aos selecionados</button>
        </div>
      </details>
      ${physicalStockTable(rows)}
    </div>

    <div class="grid grid-2 owner-secondary-grid">
      <div class="card">
        <div class="card-head"><div><h2>Faltas de venda por pedido</h2><p>Resumo limpo por pedido. Itens técnicos ficam recolhidos.</p></div><span class="badge danger">Análise obrigatória</span></div>
        ${managerAlertTable(managerAlerts)}
      </div>
      <div class="card">
        <h2>Alertas operacionais</h2>
        <div class="decision-list compact">
          ${pecasSemPeso.length ? `<a href="#/producao"><strong>${formatNumber(pecasSemPeso.length, 0)} peça(s) sem peso real</strong><span>Revisar entrada de produção ou inventário.</span></a>` : `<div><strong>Pesos conferidos</strong><span>Nenhuma peça disponível sem peso real.</span></div>`}
          ${criticos.length ? `<a href="#/estoque" data-open-section="#stockReorderSection"><strong>${formatNumber(criticos.length, 0)} SKU(s) abaixo do mínimo</strong><span>Clique para abrir a reposição sugerida.</span></a>` : `<div><strong>Sem alerta de mínimo</strong><span>Nenhuma reposição obrigatória no momento.</span></div>`}
        </div>
      </div>
    </div>

    <details class="card advanced-details" id="stockPhysicalPiecesSection">
      <summary>Ver peças físicas individuais</summary>
      <p style="color:var(--muted)">Lista técnica para rastrear ID da peça, lote, peso real, origem, status e vínculo operacional.</p>
      ${physicalPieceTable(pecas)}
    </details>

    <details class="card advanced-details" id="stockReorderSection">
      <summary>Ver reposição sugerida</summary>
      ${productionNeededTable(criticos)}
    </details>
  `);

  setupStockFilters();
  setupManualStockEntry();
}


function setupManualStockEntry() {
  const form = document.getElementById("manualStockEntryForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canRegisterProduct()) return alert("Seu usuário não tem permissão para lançar estoque manual.");

    const data = new FormData(form);
    const codigo = String(data.get("codigo") || "").trim().toUpperCase();
    const descricao = String(data.get("descricao") || "").trim();
    const material = String(data.get("material") || "").trim();
    const medida = String(data.get("medida") || "").trim();
    const quantidade = quantitySafe(data.get("quantidade") || 0);
    const pesoModo = String(data.get("pesoModo") || "total");
    const pesoInformado = numberSafe(data.get("pesoUnitario") || 0);
    const pesoTotal = pesoModo === "unitario" ? pesoInformado * quantidade : pesoInformado;
    const pesoUnitarioReferencia = quantidade > 0 ? pesoTotal / quantidade : 0;
    const pesoIndividualConhecido = pesoModo === "unitario";
    const pedido = String(data.get("pedido") || "").trim();
    const loteManual = String(data.get("lote") || "").trim();
    const observacao = String(data.get("observacao") || "").trim();

    if (!codigo) return alert("Informe o código.");
    if (!descricao) return alert("Informe a descrição.");
    if (!material) return alert("Informe o material.");
    if (!quantidade) return alert("Informe a quantidade.");
    if (!(pesoInformado > 0)) return alert("Informe o peso. Para várias peças, use o peso total da entrada; ex.: 10 peças com total 10,00 g.");

    const button = form.querySelector("button[type='submit']");
    if (button) {
      button.disabled = true;
      button.textContent = "Lançando...";
    }

    try {
      const parsed = {
        header: { numeroPedido: pedido || "MANUAL", clienteNome: "" },
        arquivoNome: "entrada manual rápida no estoque"
      };
      const item = {
        codigo,
        codigoOriginal: codigo,
        descricao,
        material,
        medida,
        quantidade,
        pesoUnitario: pesoIndividualConhecido ? pesoInformado : 0,
        pesoUnitarioEstimado: pesoUnitarioReferencia,
        pesoReal: pesoIndividualConhecido ? pesoInformado : 0,
        pesoIndividualConhecido,
        pesoControleModo: pesoIndividualConhecido ? "individual_real" : "total_lote",
        pesoTotalLinha: pesoTotal,
        pesoTotalReferencia: pesoTotal,
        pesoTotal,
        peso: pesoTotal,
        lote: loteManual,
        observacao: observacao || (pedido ? `Entrada manual vinculada ao pedido ${pedido}` : "Entrada manual rápida no estoque")
      };

      const resolved = await upsertProductFromItem(item);
      const produtoId = resolved.id;
      const product = resolved.product;
      const finalItem = { ...(resolved.item || item), ...item };
      const loteCodigo = loteManual || generatedLotCode(finalItem, parsed);
      ensureIndependentWeightLedger(produtoId, product);

      const loteId = await registerLotEntry({
        produtoId,
        item: { ...finalItem, lote: loteCodigo },
        parsed,
        tipo: "entrada_manual_estoque",
        quantidade,
        pesoTotal,
        pesoUnitario: pesoIndividualConhecido ? pesoInformado : 0,
        pedidoId: pedido || "",
        status: "disponivel"
      });

      const pieceIds = await createPhysicalPieces({
        produtoId,
        item: { ...finalItem, lote: loteCodigo },
        parsed,
        origem: "entrada_manual_estoque",
        status: "disponivel",
        quantidade,
        pesoUnitario: pesoIndividualConhecido ? pesoInformado : 0,
        pesoTotal,
        pedidoId: pedido || "",
        loteId,
        loteCodigo,
        observacao: finalItem.observacao,
        pesoIndividualConhecido
      });

      applyProductWeightLedgerDelta(produtoId, product, {
        entradaDelta: pesoTotal,
        motivo: "Entrada manual: quantidade e peso total controlados de forma independente."
      });
      await syncProductAggregateFromPieces(produtoId, product);

      await registerMovement({
        produtoId,
        tipo: "entrada_manual_estoque",
        quantidade,
        peso: pesoTotal,
        pedidoId: pedido || "MANUAL",
        origem: "manual",
        observacao: `Entrada manual rápida: ${quantidade} peça(s), peso total ${formatNumber(pesoTotal, 3)} g, modo ${pesoModo === "unitario" ? "peso individual conhecido" : "peso total do lote"}.`
      });

      await auditLog("entrada_manual_estoque", {
        colecao: "pecasEstoque",
        documentoId: pedido || loteId || produtoId,
        motivo: "Entrada manual rápida no estoque sem PDF",
        resumo: `${codigo} · Nº ${medida || "-"} · ${quantidade} peça(s) · ${formatNumber(pesoTotal, 3)} g`,
        depois: { produtoId, loteId, pieceIds, item: finalItem, quantidade, pesoModo, pesoInformado, pesoUnitarioReferencia, pesoTotal, pedido }
      });

      alert(`Entrada manual lançada: ${quantidade} peça(s), total ${formatNumber(pesoTotal, 3)} g.`);
      form.reset();
      await loadData();
      render();
    } catch (err) {
      alert(err.message || "Não foi possível lançar entrada manual no estoque.");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Adicionar ao estoque";
      }
    }
  });
}


function productionNeededTable(criticos) {
  if (!criticos.length) return `<div class="empty">Nenhum produto abaixo do estoque mínimo.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Descrição</th><th>Medida</th><th>Disponível</th><th>Mínimo</th><th>Produzir</th><th>Prioridade</th></tr></thead>
        <tbody>
          ${criticos.map((p) => {
            const qtd = Math.max(0, quantitySafe(p.estoqueMinimo || 0) - quantitySafe(p.estoqueDisponivel || 0));
            return `
              <tr>
                <td>${escapeHtml(p.codigo || "")}</td>
                <td>${escapeHtml(p.descricao || "")}</td>
                <td>${escapeHtml(p.medida || "")}</td>
                <td>${formatNumber(p.estoqueDisponivel || 0, 0)}</td>
                <td>${formatNumber(p.estoqueMinimo || 0, 0)}</td>
                <td><strong>${formatNumber(qtd, 0)}</strong></td>
                <td>${quantitySafe(p.estoqueDisponivel || 0) <= 0 ? `<span class="badge danger">Zerado</span>` : `<span class="badge warning">Baixo</span>`}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function vendasView() {
  const produtos = objectToArray(state.data.produtos)
    .sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || "")));
  const vendas = objectToArray(state.data.vendas).filter((v) => !["estornada", "estornado"].includes(String(v.status || "").toLowerCase())).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const vendasAgrupadas = groupSalesForDisplay(vendas);
  const options = productSelectOptions(produtos);
  const produtosDisponiveis = produtos.length;

  shell(`
    <section class="owner-page-head clean-page-head sales-clean-head">
      <div>
        <span class="eyebrow">Vendas</span>
        <h2>Importe o PDF da venda e confira o resultado.</h2>
        <p>A tela principal mostra só o necessário: pedido, baixas e alertas. Detalhes ficam dentro do card.</p>
      </div>
    </section>

    <div class="grid grid-2 sales-entry-grid">
      <div class="card sale-pdf-import-card">
        <div class="card-head">
          <div>
            <h2>Importar venda por PDF</h2>
            <p>Baixa o que existir no estoque e cria alerta para o que faltar.</p>
          </div>
          <span class="badge gold">Fluxo principal</span>
        </div>
        <form id="salePdfImportForm" class="form-row sale-pdf-form">
          <div class="field col-7"><label>PDF da venda</label><input type="file" name="pdf" accept="application/pdf" required></div>
          <div class="field col-3"><label>Responsável</label><input name="vendedor" placeholder="Nome"></div>
          <div class="field col-2 check-field"><label>&nbsp;</label><span><input type="checkbox" name="extrairFotos" checked> Fotos</span></div>
          <div class="field col-12"><button class="btn btn-gold" type="submit">Importar venda</button></div>
        </form>
        <div class="compact-flow-note">
          <div><b>1</b><span>Lê o PDF</span></div>
          <div><b>2</b><span>Baixa estoque disponível</span></div>
          <div><b>3</b><span>Alerta faltas ao gestor</span></div>
        </div>
      </div>

      <div class="card clean-panel sale-decision-card">
        <h2>O que conferir depois</h2>
        <div class="decision-list compact">
          <div><strong>Estoque baixado</strong><span>Itens existentes aparecem como vendidos.</span></div>
          <div><strong>Alertas do gestor</strong><span>Itens sem saldo não negativam estoque.</span></div>
          <div><strong>Sem produção automática</strong><span>Produção só depois da decisão do gestor.</span></div>
        </div>
      </div>
    </div>

    <details class="card advanced-details manual-sale-drawer">
      <summary>Venda manual no balcão</summary>
      <p class="muted">Use somente quando a venda não veio por PDF.</p>

      <form id="saleHeaderForm" class="form-row sale-header-form">
        ${clienteField("cliente", "col-3", "Cliente")}
        ${vendedorField("vendedor", "col-3", "Vendedor / Responsável")}
        <div class="field col-2"><label>Nº pedido venda</label><input name="numeroPedido" placeholder="Ex.: 26784"></div>
        <div class="field col-2"><label>Forma de pagamento</label><select name="pagamento">
          <option value="">Selecione</option>
          <option>Dinheiro</option>
          <option>Pix</option>
          <option>Cartão de crédito</option>
          <option>Cartão de débito</option>
          <option>Boleto</option>
          <option>Transferência</option>
          <option>Outro</option>
        </select></div>
        <div class="field col-2"><label>Status</label><select name="status">
          <option value="finalizada">Finalizada</option>
          <option value="pendente">Pendente</option>
        </select></div>
        <div class="field col-12"><label>Motivo / observação da venda</label><input name="motivo" placeholder="Ex.: venda balcão, pedido confirmado pelo cliente, ajuste autorizado"></div>
      </form>

      <div class="sale-builder">
        <form id="saleItemForm" class="form-row sale-item-form">
          <div class="field col-5"><label>Joia</label><select name="produtoId" required ${produtosDisponiveis ? "" : "disabled"}>${options}</select></div>
          <div class="field col-2"><label>Quantidade</label><input name="quantidade" type="number" min="1" step="1" value="1" required></div>
          <div class="field col-3"><label>Peso total real vendido</label><input name="pesoUnitario" type="text" inputmode="decimal" placeholder="Ex.: 7,50 para 6 peças"><small>Informe o peso total das peças deste item. Não é peso unitário.</small></div>
          <div class="field col-2"><label>&nbsp;</label><button class="btn btn-light" type="submit">Adicionar</button></div>
        </form>

        <div id="saleCartArea"></div>

        <div class="actions sale-actions">
          <button class="btn btn-light" type="button" id="clearSaleCartBtn">Limpar itens</button>
          <button class="btn btn-gold" type="button" id="closeSaleBtn">Fechar venda</button>
        </div>
      </div>
    </details>

    <div class="card sales-command-center">
      <div class="card-head">
        <div>
          <h2>Vendas registradas</h2>
          <p>Lista limpa para acompanhar pedidos importados, baixas e alertas.</p>
        </div>
        <span class="badge gold">Kanban operacional</span>
      </div>
      <div class="filter-panel sales-filter-panel" data-sales-filter-panel>
        <div class="field"><label>Pedido</label><input data-sales-pedido placeholder="Ex.: 25826"></div>
        <div class="field priority"><label>Código</label><input data-sales-code placeholder="Ex.: 2740AGL"></div>
        <div class="field"><label>Cliente</label><input data-sales-client placeholder="Cliente / loja"></div>
        <div class="field"><label>Status</label><select data-sales-status>
          <option value="">Todos</option>
          <option value="atendida">Atendida</option>
          <option value="analise">Análise gestor</option>
          <option value="parcial">Parcial</option>
        </select></div>
        <div class="field wide"><label>Busca geral</label><input data-sales-text placeholder="medida, material, vendedor, alerta..."></div>
        <div class="filter-actions sales-filter-actions">
          <button class="btn btn-light btn-sm" type="button" data-clear-sales-filters>Limpar</button>
          <span class="badge blue" data-sales-counter></span>
        </div>
      </div>
      ${salesTable(vendasAgrupadas)}
    </div>
  `);

  document.getElementById("salePdfImportForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const file = pdfFileFromForm(formEl);
    const form = new FormData(formEl);
    const vendedor = String(form.get("vendedor") || "").trim();
    const extrairFotos = form.get("extrairFotos") === "on";
    const button = formEl.querySelector("button[type='submit']");
    if (!file) return alert("Selecione o PDF da venda.");

    button.disabled = true;
    button.textContent = "Lendo PDF...";
    try {
      const parsedPdf = await extractPdf(file, { extrairFotos });
      parsedPdf.tipoImportacao = "venda_inteligente";
      parsedPdf.vendedor = vendedor;
      state.parsedImport = parsedPdf;
      location.hash = "#/importacao";
      render();
    } catch (err) {
      alert(err.message || "Não foi possível ler o PDF da venda.");
    } finally {
      button.disabled = false;
      button.textContent = "Importar venda";
    }
  });

  renderSaleCartArea();
  setupSalesFilters();
  setupReversalButtons();

  document.getElementById("saleItemForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const produtoId = String(form.get("produtoId") || "");
    const product = state.data.produtos[produtoId];
    const qtd = quantitySafe(form.get("quantidade") || 0);
    if (!product) return alert("Produto não encontrado.");
    if (!qtd || qtd <= 0) return alert("Informe uma quantidade válida.");

    const pesoTotalInformado = numberSafe(form.get("pesoUnitario") || 0);
    if (!(pesoTotalInformado > 0)) return alert("Informe o peso total real vendido deste item. Ex.: 7,50 para 6 peças.");
    const pesoMedioReferencia = qtd > 0 ? pesoTotalInformado / qtd : 0;

    const saleItem = {
      produtoId,
      codigo: product.codigo || "",
      descricao: product.descricao || "",
      medida: product.medida || "",
      material: product.material || "",
      fotoUrl: product.fotoUrl || product.fotoDataUrl || "",
      quantidade: qtd,
      pesoUnitario: pesoMedioReferencia,
      pesoUnitarioRealVenda: pesoMedioReferencia,
      pesoTotalRealVenda: pesoTotalInformado,
      pesoTotalVenda: pesoTotalInformado,
      pesoTotalBaixado: pesoTotalInformado,
      pesoTotal: pesoTotalInformado,
      pesoTotalLinha: pesoTotalInformado,
      pesoVendaModo: "total_real_venda",
      pesoVendaInformadoManual: true,
      pesoIndividualVendaConhecido: qtd === 1
    };

    state.saleCart.push(saleItem);

    event.currentTarget.reset();
    const qtdInput = event.currentTarget.querySelector("[name='quantidade']");
    if (qtdInput) qtdInput.value = "1";
    renderSaleCartArea();
  });

  document.getElementById("clearSaleCartBtn")?.addEventListener("click", () => {
    if (!state.saleCart.length) return;
    if (!confirm("Limpar todos os itens desta venda?")) return;
    state.saleCart = [];
    renderSaleCartArea();
  });

  document.getElementById("closeSaleBtn")?.addEventListener("click", async () => {
    if (!canRegisterCommercialOperation()) return alert("Seu usuário não tem permissão para fechar venda.");
    if (!state.saleCart.length) return alert("Adicione pelo menos uma joia à venda.");

    const headerForm = document.getElementById("saleHeaderForm");
    const form = new FormData(headerForm);
    const cliente = String(form.get("cliente") || "").trim();
    const vendedor = String(form.get("vendedor") || "").trim();
    const numeroPedidoManual = String(form.get("numeroPedido") || "").trim();
    const pagamento = String(form.get("pagamento") || "").trim();
    const status = String(form.get("status") || "finalizada").trim();
    const motivo = auditReason(form.get("motivo"), "Venda final manual com múltiplos itens");

    if (!cliente) return alert("Selecione ou informe o cliente.");
    if (!vendedor) return alert("Selecione ou informe o vendedor/responsável.");

    const preflightManual = salePreflightForItems(state.saleCart, { manual: true });
    if (!confirmSalePreflight(preflightManual, { tipo: "venda manual" })) {
      return alert("Venda cancelada antes de alterar o estoque.");
    }

    const totals = saleCartTotals(state.saleCart);
    const saleId = uid("venda");

    try {
      const beforeProducts = {};
      const itens = [];

      for (const item of state.saleCart) {
        const product = state.data.produtos[item.produtoId];
        if (!product) throw new Error(`Produto ${item.codigo} não encontrado.`);

        beforeProducts[item.produtoId] = { ...product };

        const stockResult = await processSaleStockAndShortage({
          produtoId: item.produtoId,
          product,
          item,
          quantidade: item.quantidade,
          parsed: {
            header: { numeroPedido: numeroPedidoManual || saleId, clienteNome: cliente },
            vendedor,
            arquivoNome: "venda manual"
          },
          documentoId: numeroPedidoManual || saleId,
          vendaId: saleId,
          origem: "venda_final_manual",
          motivo
        });

        itens.push({
          produtoId: item.produtoId,
          codigo: item.codigo,
          descricao: item.descricao,
          medida: item.medida,
          material: item.material,
          fotoUrl: item.fotoUrl || "",
          quantidade: quantitySafe(item.quantidade || 0),
          quantidadeSolicitada: stockResult.quantidadeSolicitada,
          quantidadeBaixada: stockResult.quantidadeBaixada,
          quantidadePendenteAnaliseGestor: stockResult.quantidadeFaltante,
          quantidadePendenteProducao: 0,
          estoqueDisponivelAntes: stockResult.estoqueDisponivelAntes,
          pecasBaixadas: stockResult.pecasBaixadas || [],
          pedidoProducaoId: "",
          alertaGestorId: stockResult.alertaGestorId || "",
          statusEstoque: stockResult.statusEstoque,
          pesoUnitario: numberSafe(item.pesoUnitarioRealVenda || item.pesoUnitario || 0),
          pesoUnitarioRealVenda: numberSafe(item.pesoUnitarioRealVenda || item.pesoUnitario || 0),
          pesoTotalRealVenda: numberSafe(item.pesoTotalRealVenda || saleItemDisplayedWeight(item)),
          pesoVendaModo: item.pesoVendaModo || "total_real_venda",
          pesoIndividualVendaConhecido: !!item.pesoIndividualVendaConhecido,
          pesoTotal: saleItemDisplayedWeight(item),
          pesoTotalLinha: saleItemDisplayedWeight(item),
          pesoTotalVenda: numberSafe(item.pesoTotalVenda || saleItemDisplayedWeight(item)),
          pesoTotalBaixado: numberSafe(item.pesoTotalBaixado || saleItemDisplayedWeight(item)),
          pesoVendaInformadoManual: !!item.pesoVendaInformadoManual
        });
      }

      await DB.save("vendas", saleId, {
        id: saleId,
        tipo: "venda_multipla",
        cliente,
        vendedor,
        pagamento,
        status,
        motivo,
        itens,
        numeroPedido: numeroPedidoManual || saleId,
        pedidoPdfNumero: numeroPedidoManual || "",
        quantidadeItens: itens.length,
        quantidadeTotal: totals.quantidade,
        quantidadeBaixadaTotal: sum(itens, (item) => item.quantidadeBaixada || 0),
        quantidadePendenteAnaliseGestor: sum(itens, (item) => item.quantidadePendenteAnaliseGestor || 0),
        quantidadePendenteProducao: 0,
        statusEstoque: sum(itens, (item) => item.quantidadePendenteAnaliseGestor || 0) ? "baixada_parcial_alerta_gestor" : "baixada_total",
        pesoTotal: totals.pesoTotal,
        origem: "manual",
        criadoEm: nowIso(),
        criadoPor: state.user?.email || "",
        criadoPorUid: state.user?.uid || ""
      });

      await auditLog("venda_fechada", {
        colecao: "vendas",
        documentoId: saleId,
        motivo,
        resumo: `Venda com ${itens.length} item(ns), cliente ${cliente}, vendedor ${vendedor}`,
        depois: { cliente, vendedor, pagamento, status, totals, itens },
        metadados: { produtosAntes: beforeProducts }
      });

      state.saleCart = [];
      await loadData();
      render();
    } catch (err) {
      alert(err.message || "Não foi possível fechar a venda.");
    }
  });
}

function saleItemFromSingleRecord(v = {}) {
  return {
    vendaId: v.id || "",
    produtoId: v.produtoId || "",
    codigo: v.codigo || "",
    descricao: v.descricao || "",
    medida: v.medida || "",
    material: v.material || "",
    lote: v.lote || v.loteReferencia || v.loteCodigo || v.lotePrincipal || "",
    quantidade: quantitySafe(v.quantidade || 0),
    quantidadeSolicitada: quantitySafe(v.quantidadeSolicitada || v.quantidade || 0),
    quantidadeReservada: quantitySafe(v.quantidadeReservada || 0),
    quantidadeBaixada: quantitySafe((v.quantidadeBaixada ?? (v.modoVenda === "inteligente" ? 0 : v.quantidade)) || 0),
    quantidadePendenteAnaliseGestor: quantitySafe(v.quantidadePendenteAnaliseGestor || v.quantidadePendenteAnalise || v.quantidadeFaltante || 0),
    quantidadePendenteProducao: quantitySafe(v.quantidadePendenteProducao || 0),
    quantidadeReposicaoMinima: quantitySafe(v.quantidadeReposicaoMinima || v.quantidadeReposicaoEstoque || 0),
    statusEstoque: v.statusEstoque || "baixada_total",
    pedidoProducaoId: v.pedidoProducaoId || "",
    alertaGestorId: v.alertaGestorId || "",
    pesoUnitario: numberSafe(v.pesoUnitarioRealVenda || v.pesoUnitario || v.pesoUnitarioPedido || v.pesoIdentificador || v.peso || 0),
    pesoUnitarioRealVenda: numberSafe(v.pesoUnitarioRealVenda || v.pesoUnitario || 0),
    pesoTotalRealVenda: numberSafe(v.pesoTotalRealVenda || v.pesoTotalVenda || v.pesoTotalBaixado || v.pesoTotalLinha || v.pesoTotal || 0),
    pesoTotalBaixado: numberSafe(v.pesoTotalBaixado || 0),
    pesoTotalSolicitado: numberSafe(v.pesoTotalSolicitado || v.pesoTotalLinha || v.pesoTotal || 0),
    pesoTotalFaltante: numberSafe(v.pesoTotalFaltante || 0),
    pesoTotal: numberSafe(v.pesoTotalRealVenda || v.pesoTotalVenda || v.pesoTotalBaixado || v.pesoTotalLinha || v.pesoTotal || 0),
    pecasReservadas: Array.isArray(v.pecasReservadas) ? v.pecasReservadas : [],
    pecasBaixadas: Array.isArray(v.pecasBaixadas) ? v.pecasBaixadas : []
  };
}

function saleItemsForDisplay(v = {}) {
  if (Array.isArray(v.itens) && v.itens.length) {
    return v.itens.map((item) => ({
      vendaId: item.vendaId || v.id || "",
      produtoId: item.produtoId || "",
      codigo: item.codigo || "",
      descricao: item.descricao || "",
      medida: item.medida || "",
      material: item.material || "",
      lote: item.lote || item.loteReferencia || item.loteCodigo || "",
      quantidade: quantitySafe(item.quantidade || 0),
      quantidadeSolicitada: quantitySafe(item.quantidadeSolicitada || item.quantidade || 0),
      quantidadeReservada: quantitySafe(item.quantidadeReservada || 0),
      quantidadeBaixada: quantitySafe((item.quantidadeBaixada ?? item.quantidade) || 0),
      quantidadePendenteAnaliseGestor: quantitySafe(item.quantidadePendenteAnaliseGestor || item.quantidadePendenteAnalise || item.quantidadeFaltante || 0),
      quantidadePendenteProducao: quantitySafe(item.quantidadePendenteProducao || 0),
      quantidadeReposicaoMinima: quantitySafe(item.quantidadeReposicaoMinima || item.quantidadeReposicaoEstoque || 0),
      statusEstoque: item.statusEstoque || "baixada_total",
      pedidoProducaoId: item.pedidoProducaoId || "",
      alertaGestorId: item.alertaGestorId || v.alertaGestorId || "",
      pesoUnitario: numberSafe(item.pesoUnitarioRealVenda || item.pesoUnitario || item.pesoUnitarioPedido || item.pesoIdentificador || item.peso || 0),
      pesoUnitarioRealVenda: numberSafe(item.pesoUnitarioRealVenda || item.pesoUnitario || 0),
      pesoTotalRealVenda: numberSafe(item.pesoTotalRealVenda || item.pesoTotalVenda || item.pesoTotalBaixado || item.pesoTotalLinha || item.pesoTotal || 0),
      pesoTotalBaixado: numberSafe(item.pesoTotalBaixado || 0),
      pesoTotalSolicitado: numberSafe(item.pesoTotalSolicitado || item.pesoTotalLinha || item.pesoTotal || 0),
      pesoTotalFaltante: numberSafe(item.pesoTotalFaltante || 0),
      pesoTotal: numberSafe(item.pesoTotalRealVenda || item.pesoTotalVenda || item.pesoTotalBaixado || item.pesoTotalLinha || item.pesoTotal || 0),
      pecasReservadas: Array.isArray(item.pecasReservadas) ? item.pecasReservadas : [],
      pecasBaixadas: Array.isArray(item.pecasBaixadas) ? item.pecasBaixadas : []
    }));
  }
  return [saleItemFromSingleRecord(v)];
}

function saleStatusKey(v = {}, itens = saleItemsForDisplay(v)) {
  const solicitada = quantitySafe(v.quantidadeTotal || sum(itens, (item) => item.quantidadeSolicitada || item.quantidade || 0));
  const reservada = quantitySafe(v.quantidadeReservadaTotal || sum(itens, (item) => item.quantidadeReservada || 0));
  const baixada = quantitySafe(v.quantidadeBaixadaTotal || sum(itens, (item) => item.quantidadeBaixada || 0));
  const analise = quantitySafe(v.quantidadePendenteAnaliseGestor || v.quantidadePendenteAnalise || sum(itens, (item) => item.quantidadePendenteAnaliseGestor || item.quantidadePendenteAnalise || 0));
  const producao = quantitySafe(v.quantidadePendenteProducao || sum(itens, (item) => item.quantidadePendenteProducao || 0));
  if (analise > 0) return "analise";
  if (producao > 0) return "producao";
  if (reservada > 0 && baixada < solicitada) return "reservada";
  if (solicitada > 0 && baixada >= solicitada) return "atendida";
  return "parcial";
}

function saleStatusBadge(status = "") {
  const key = String(status || "");
  if (key === "analise") return `<span class="badge danger">Falta em venda</span>`;
  if (key === "producao") return `<span class="badge warning">Produção pendente</span>`;
  if (key === "reservada") return `<span class="badge blue">Reservada</span>`;
  if (key === "atendida") return `<span class="badge success">Atendida</span>`;
  return `<span class="badge danger">Parcial</span>`;
}

function saleSearchPayload(v = {}, itens = saleItemsForDisplay(v)) {
  const itemText = itens.map((item) => [
    item.codigo,
    item.descricao,
    item.medida,
    item.material,
    item.lote,
    item.pesoUnitario,
    item.pedidoProducaoId,
    item.alertaGestorId,
    ...(item.pecasReservadas || []),
    ...(item.pecasBaixadas || [])
  ].join(" ")).join("\n");
  return [
    vendaResumo(v),
    v.id,
    v.pedidoId,
    v.pedidoPdfNumero,
    v.numeroPedido,
    v.cliente,
    v.vendedor,
    v.pagamento,
    v.status,
    v.origem,
    itemText
  ].join("\n");
}

function groupSalesForDisplay(vendas = []) {
  const groupedMap = new Map();
  const singles = [];

  vendas.forEach((venda) => {
    const isPdfSale = String(venda.origem || "").toLowerCase() === "pdf" && (venda.pedidoId || venda.pedidoPdfNumero || venda.origemDocumentoId);
    if (!isPdfSale) {
      singles.push(venda);
      return;
    }

    const key = String(venda.pedidoId || venda.origemDocumentoId || venda.pedidoPdfNumero || venda.id);
    const current = groupedMap.get(key) || {
      id: `pdf_${key}`,
      tipo: "venda_pdf_agrupada",
      pedidoId: venda.pedidoId || venda.origemDocumentoId || "",
      pedidoPdfNumero: venda.pedidoPdfNumero || venda.numeroPedido || "",
      cliente: venda.cliente || "",
      vendedor: venda.vendedor || "",
      origem: "pdf",
      criadoEm: venda.criadoEm || "",
      pesoTotal: 0,
      quantidadeItens: 0,
      quantidadeTotal: 0,
      quantidadeReservadaTotal: 0,
      quantidadeBaixadaTotal: 0,
      quantidadePendenteAnaliseGestor: 0,
      quantidadePendenteProducao: 0,
      quantidadeReposicaoMinima: 0,
      itens: []
    };

    const item = saleItemFromSingleRecord(venda);
    current.itens.push(item);
    current.quantidadeItens = current.itens.length;
    current.quantidadeTotal += quantitySafe(item.quantidadeSolicitada || item.quantidade || 0);
    current.quantidadeReservadaTotal += quantitySafe(item.quantidadeReservada || 0);
    current.quantidadeBaixadaTotal += quantitySafe(item.quantidadeBaixada || 0);
    current.quantidadePendenteAnaliseGestor += quantitySafe(item.quantidadePendenteAnaliseGestor || item.quantidadePendenteAnalise || 0);
    current.quantidadePendenteProducao += quantitySafe(item.quantidadePendenteProducao || 0);
    current.quantidadeReposicaoMinima += quantitySafe(item.quantidadeReposicaoMinima || 0);
    current.pesoTotal += numberSafe(venda.pesoTotal || 0);
    current.criadoEm = String(venda.criadoEm || "") > String(current.criadoEm || "") ? venda.criadoEm : current.criadoEm;
    current.statusEstoque = stockStatusFromQuantities({
      solicitada: current.quantidadeTotal,
      baixada: current.quantidadeBaixadaTotal,
      faltante: current.quantidadePendenteAnaliseGestor || current.quantidadePendenteProducao
    });
    groupedMap.set(key, current);
  });

  return [...groupedMap.values(), ...singles]
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
}

function salesTable(vendas) {
  if (!vendas.length) return `<div class="empty">Nenhuma venda registrada ainda.</div>`;
  return `
    <div class="sales-kanban-list">
      ${vendas.map((v) => {
        const itens = saleItemsForDisplay(v);
        const status = saleStatusKey(v, itens);
        const pedido = v.pedidoPdfNumero || v.pedidoId || v.numeroPedido || v.id || "";
        const solicitada = quantitySafe(v.quantidadeTotal || sum(itens, (item) => item.quantidadeSolicitada || item.quantidade || 0));
        const reservada = quantitySafe(v.quantidadeReservadaTotal || sum(itens, (item) => item.quantidadeReservada || 0));
        const baixada = quantitySafe(v.quantidadeBaixadaTotal || sum(itens, (item) => item.quantidadeBaixada || 0));
        const analise = quantitySafe(v.quantidadePendenteAnaliseGestor || v.quantidadePendenteAnalise || sum(itens, (item) => item.quantidadePendenteAnaliseGestor || item.quantidadePendenteAnalise || 0));
        const producao = quantitySafe(v.quantidadePendenteProducao || sum(itens, (item) => item.quantidadePendenteProducao || 0));
        const reposicao = quantitySafe(v.quantidadeReposicaoMinima || sum(itens, (item) => item.quantidadeReposicaoMinima || 0));
        const pendenteTotal = analise + producao;
        const codes = itens.map((item) => item.codigo || "").join("\n");
        const payload = saleSearchPayload(v, itens);
        return `
          <details class="sale-kanban-card sale-status-${escapeHtml(status)}" data-sale-filterable data-pedido="${escapeHtml(pedido)}" data-code="${escapeHtml(codes)}" data-client="${escapeHtml([v.cliente, v.vendedor].join(" "))}" data-status="${escapeHtml(status)}" data-search="${escapeHtml(payload)}">
            <summary class="sale-kanban-summary">
              <span class="sale-chevron" aria-hidden="true"></span>
              <div class="sale-kanban-title">
                <strong>${escapeHtml(vendaResumo(v))}</strong>
                <small>${escapeHtml(v.cliente || "Cliente não informado")} · ${escapeHtml(v.vendedor || "Responsável não informado")} · ${formatDate(v.criadoEm)}</small>
                <span class="sale-summary-line">Solicitado ${formatNumber(solicitada, 0)} · baixado ${formatNumber(baixada, 0)}${pendenteTotal ? ` · faltante ${formatNumber(pendenteTotal, 0)}` : ""} · peso ${formatNumber(numberSafe(v.pesoTotal || sum(itens, (item) => item.pesoTotal || 0)), 3)} g</span>
              </div>
              <div class="sale-kanban-badges">
                ${saleStatusBadge(status)}
                <span class="badge light">${escapeHtml(String(v.origem || "manual"))}</span>
                ${isAdminUser() ? `<button class="btn btn-danger btn-sm" type="button" data-reverse-sale="${escapeHtml(v.id || "")}" data-reverse-pedido="${escapeHtml(pedido)}">Estornar venda</button>` : ""}
              </div>

            </summary>

            <div class="sale-kanban-body">
              <div class="sale-kpi-row clean-sale-kpis">
                <div><small>Solicitado</small><strong>${formatNumber(solicitada, 0)}</strong></div>
                <div><small>Baixado</small><strong>${formatNumber(baixada, 0)}</strong></div>
                <div><small>${producao > 0 && analise === 0 ? "Aguardando produção" : "Pendente"}</small><strong>${formatNumber(pendenteTotal, 0)}</strong></div>
                <div><small>Status</small><strong>${status === "atendida" ? "Atendida" : status === "analise" ? "Alerta" : status === "producao" ? "Produção aprovada" : "Parcial"}</strong></div>
              </div>

              <div class="table-wrap sale-items-wrap">
                <table class="sale-items-table">
                  <thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Baixado</th><th>Faltante/alerta</th><th>Rastreio</th></tr></thead>
                  <tbody>
                    ${itens.map((item) => {
                      const pesoUnitario = numberSafe(item.pesoUnitario || 0);
                      const lote = item.lote || "";
                      const vinculos = [
                        item.pedidoProducaoId ? `Producao: ${item.pedidoProducaoId}` : "",
                        item.alertaGestorId ? `Alerta gestor: ${item.alertaGestorId}` : "",
                        item.pecasReservadas?.length ? `Reservadas: ${item.pecasReservadas.length}` : "",
                        item.pecasBaixadas?.length ? `Baixadas: ${item.pecasBaixadas.length}` : ""
                      ].filter(Boolean).join(" · ") || "-";
                      return `
                        <tr>
                          <td><strong>${escapeHtml(item.codigo || "")}</strong><br><small>${stockStatusBadge(item.statusEstoque || "baixada_total")}</small></td>
                          <td>${escapeHtml(item.descricao || "")}<br><small>Nº ${escapeHtml(item.medida || "-")} · ${escapeHtml(item.material || "-")}${pesoUnitario ? ` · ${formatNumber(pesoUnitario, 3)} g` : ""}${lote ? ` · lote ${escapeHtml(lote)}` : ""}</small></td>
                          <td>${formatNumber(item.quantidadeSolicitada || item.quantidade || 0, 0)}</td>
                          <td>${formatNumber((item.quantidadeBaixada ?? item.quantidade) || 0, 0)}</td>
                          <td>${formatNumber(quantitySafe(item.quantidadePendenteAnaliseGestor || item.quantidadePendenteAnalise || 0) + quantitySafe(item.quantidadePendenteProducao || 0), 0)}</td>
                          <td><small>${escapeHtml(vinculos)}</small></td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>

              <div class="sale-audit-grid">
                ${detailLine("Pedido/Documento", pedido)}
                ${detailLine("ID da venda", v.id || "")}
                ${detailLine("Cliente", v.cliente || "")}
                ${detailLine("Vendedor/Responsável", v.vendedor || "")}
                ${detailLine("Pagamento", v.pagamento || "")}
                ${detailLine("Origem", v.origem || "")}
                ${detailLine("Status comercial", v.status || "")}
                ${detailLine("Status estoque", v.statusEstoque || status)}
              </div>
            </div>
          </details>
        `;
      }).join("")}
    </div>
  `;
}

function consignacoesView() {
  const consignacoes = objectToArray(state.data.consignacoes).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));

  shell(`
    <div class="card">
      <h2>Consignações</h2>
      <p style="color:var(--muted)">Consignação fica pendente até virar venda final ou retornar para estoque.</p>
      ${consignmentTable(consignacoes)}
    </div>
  `);

  document.querySelectorAll("[data-convert]").forEach((button) => {
    button.addEventListener("click", () => convertConsignment(button.dataset.convert));
  });
  document.querySelectorAll("[data-return]").forEach((button) => {
    button.addEventListener("click", () => returnConsignment(button.dataset.return));
  });
}

function consignmentTable(items) {
  if (!items.length) return `<div class="empty">Nenhuma consignação registrada.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Código</th><th>Descrição</th><th>Medida</th><th>Qtd</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${items.map((c) => `
            <tr>
              <td>${formatDate(c.criadoEm)}</td>
              <td>${escapeHtml(c.codigo || "")}</td>
              <td>${escapeHtml(c.descricao || "")}</td>
              <td>${escapeHtml(c.medida || "")}</td>
              <td>${formatNumber(c.quantidade || 0, 0)}</td>
              <td>${escapeHtml(c.cliente || "")}</td>
              <td>${escapeHtml(c.vendedor || "")}</td>
              <td><span class="badge ${c.status === "pendente" ? "warning" : c.status === "vendido" ? "success" : "blue"}">${escapeHtml(c.status || "")}</span></td>
              <td>
                ${c.status === "pendente" ? `
                  <button class="btn btn-success" data-convert="${escapeHtml(c.id)}">Virou venda</button>
                  <button class="btn btn-light" data-return="${escapeHtml(c.id)}">Devolver</button>
                ` : "-"}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function convertConsignment(id) {
  const c = state.data.consignacoes[id];
  if (!c || c.status !== "pendente") return;

  const product = state.data.produtos[c.produtoId];
  if (product) {
    const consignadas = physicalPiecesForProduct(c.produtoId).filter((piece) => String(piece.status || "").toLowerCase() === "consignado").slice(0, quantitySafe(c.quantidade || 0));
    for (const piece of consignadas) {
      const patch = { statusAnterior: piece.status || "consignado", status: "vendido", documentoBaixaId: id, baixaOrigem: "conversao_consignacao", atualizadoEm: nowIso() };
      await DB.patch("pecasEstoque", piece.id, patch);
      localPatchCollection("pecasEstoque", piece.id, patch);
    }
    product.estoqueConsignado = Math.max(0, quantitySafe(product.estoqueConsignado || 0) - quantitySafe(c.quantidade || 0));
    product.estoqueVendido = quantitySafe(product.estoqueVendido || 0) + quantitySafe(c.quantidade || 0);
    product.ultimaMovimentacaoEm = nowIso();
    await DB.save("produtos", c.produtoId, product);
    await syncProductAggregateFromPieces(c.produtoId, product);
  }

  const vendaId = await DB.push("vendas", {
    produtoId: c.produtoId,
    codigo: c.codigo,
    descricao: c.descricao,
    medida: c.medida,
    material: c.material,
    cliente: c.cliente,
    vendedor: c.vendedor,
    quantidade: c.quantidade,
    pesoTotal: c.pesoTotal,
    origem: "conversao_consignacao",
    criadoEm: nowIso()
  });

  await DB.patch("consignacoes", id, { status: "vendido", vendaId, finalizadoEm: nowIso() });
  await registerMovement({ produtoId: c.produtoId, tipo: "conversao_consignacao", quantidade: c.quantidade, peso: c.pesoTotal, pedidoId: c.pedidoId, origem: "manual" });
  await auditLog("consignacao_convertida_em_venda", {
    colecao: "consignacoes",
    documentoId: id,
    motivo: "Consignação virou venda final",
    resumo: `${c.codigo || ""} · ${c.cliente || ""}`,
    antes: c,
    depois: { ...c, status: "vendido", vendaId }
  });

  await loadData();
  render();
}

async function returnConsignment(id) {
  const c = state.data.consignacoes[id];
  if (!c || c.status !== "pendente") return;

  const product = state.data.produtos[c.produtoId];
  if (product) {
    const consignadas = physicalPiecesForProduct(c.produtoId).filter((piece) => String(piece.status || "").toLowerCase() === "consignado").slice(0, quantitySafe(c.quantidade || 0));
    for (const piece of consignadas) {
      const patch = { statusAnterior: piece.status || "consignado", status: "disponivel", documentoBaixaId: id, baixaOrigem: "devolucao_consignacao", atualizadoEm: nowIso() };
      await DB.patch("pecasEstoque", piece.id, patch);
      localPatchCollection("pecasEstoque", piece.id, patch);
    }
    product.estoqueConsignado = Math.max(0, quantitySafe(product.estoqueConsignado || 0) - quantitySafe(c.quantidade || 0));
    product.estoqueDisponivel = quantitySafe(product.estoqueDisponivel || 0) + quantitySafe(c.quantidade || 0);
    product.ultimaMovimentacaoEm = nowIso();
    await DB.save("produtos", c.produtoId, product);
    await syncProductAggregateFromPieces(c.produtoId, product);
  }

  await DB.patch("consignacoes", id, { status: "devolvido", finalizadoEm: nowIso() });
  await registerMovement({ produtoId: c.produtoId, tipo: "devolucao_consignacao", quantidade: c.quantidade, peso: c.pesoTotal, pedidoId: c.pedidoId, origem: "manual" });
  await auditLog("consignacao_devolvida", {
    colecao: "consignacoes",
    documentoId: id,
    motivo: "Devolução de consignação para estoque",
    resumo: `${c.codigo || ""} · ${c.cliente || ""}`,
    antes: c,
    depois: { ...c, status: "devolvido" }
  });

  await loadData();
  render();
}


function clientesView() {
  const clientes = objectToArray(state.data.clientes).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  const vendas = objectToArray(state.data.vendas);
  const consignacoes = objectToArray(state.data.consignacoes);

  shell(`
    <div class="card">
      <h2>Cadastrar cliente</h2>
      <p style="color:var(--muted)">Registre lojas, joalherias, representantes e clientes finais para vincular vendas, consignações e relatórios.</p>
      <form id="clientForm" class="form-row">
        <div class="field col-4"><label>Nome / Razão social</label><input name="nome" required placeholder="Ex.: Capital Joalheria LTDA"></div>
        <div class="field col-2"><label>CNPJ/CPF</label><input name="documento" placeholder="Documento"></div>
        <div class="field col-2"><label>Telefone</label><input name="telefone" placeholder="(11) 00000-0000"></div>
        <div class="field col-2"><label>E-mail</label><input name="email" type="email" placeholder="cliente@email.com"></div>
        <div class="field col-2"><label>Responsável</label><input name="responsavel" placeholder="Contato"></div>
        <div class="field col-5"><label>Endereço</label><input name="endereco" placeholder="Rua, número, complemento"></div>
        <div class="field col-3"><label>Cidade</label><input name="cidade" placeholder="Cidade"></div>
        <div class="field col-1"><label>UF</label><input name="uf" maxlength="2" placeholder="SP"></div>
        <div class="field col-3"><label>Tipo</label><select name="tipo"><option>Loja</option><option>Joalheria</option><option>Representante</option><option>Cliente final</option><option>Fornecedor</option></select></div>
        <div class="field col-12"><button class="btn btn-gold" type="submit">Salvar cliente</button></div>
      </form>
    </div>

    <div class="grid grid-3">
      <div class="kpi"><span>Clientes cadastrados</span><strong>${clientes.length}</strong></div>
      <div class="kpi"><span>Vendas vinculadas</span><strong>${vendas.filter((v) => v.cliente).length}</strong></div>
      <div class="kpi"><span>Consignações com cliente</span><strong>${consignacoes.filter((c) => c.cliente).length}</strong></div>
    </div>

    <div class="card">
      <h2>Carteira de clientes</h2>
      ${clienteRows(clientes)}
    </div>
  `);

  document.getElementById("clientForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nome = String(form.get("nome") || "").trim();
    if (!nome) return;

    const clienteId = uid("cliente");
    const cliente = {
      nome,
      documento: String(form.get("documento") || "").trim(),
      telefone: String(form.get("telefone") || "").trim(),
      email: String(form.get("email") || "").trim(),
      responsavel: String(form.get("responsavel") || "").trim(),
      endereco: String(form.get("endereco") || "").trim(),
      cidade: String(form.get("cidade") || "").trim(),
      uf: String(form.get("uf") || "").trim().toUpperCase(),
      tipo: String(form.get("tipo") || "").trim(),
      ativo: true,
      criadoEm: nowIso(),
      atualizadoEm: nowIso()
    };
    await DB.save("clientes", clienteId, cliente);
    await auditLog("cliente_cadastrado", {
      colecao: "clientes",
      documentoId: clienteId,
      motivo: "Cadastro manual de cliente",
      resumo: nome,
      depois: cliente
    });
    await loadData();
    render();
  });
}


function collaboratorRows(usuarios) {
  if (!usuarios.length) return `<div class="empty">Nenhum colaborador cadastrado ainda.</div>`;

  return `
    <div class="product-card-grid collaborator-card-grid">
      ${usuarios.map((usuario) => `
        <article class="product-list-card collaborator-card">
          <div class="product-card-head">
            <div class="product-card-photo collaborator-avatar">${escapeHtml(String(usuario.nome || usuario.email || "U").slice(0, 1).toUpperCase())}</div>
            <div class="product-card-title">
              <strong>${escapeHtml(usuario.nome || "Sem nome")}</strong>
              <span>${escapeHtml(usuario.email || "")}</span>
            </div>
            <div class="product-card-status">
              <span class="badge ${usuario.ativo === false ? "danger" : "success"}">${usuario.ativo === false ? "Inativo" : "Ativo"}</span>
            </div>
          </div>

          <div class="product-card-meta">
            <div><small>Função</small><b>${escapeHtml(roleLabel(usuario.papel))}</b></div>
            <div><small>UID</small><b>${escapeHtml(usuario.id || "")}</b></div>
            <div><small>Cargo</small><b>${escapeHtml(usuario.cargo || "-")}</b></div>
            <div><small>Telefone</small><b>${escapeHtml(usuario.telefone || "-")}</b></div>
          </div>

          <div class="product-card-actions">
            <button class="btn btn-light btn-sm" type="button" data-edit-user="${escapeHtml(usuario.id || "")}">Editar colaborador</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function colaboradoresView() {
  if (!canManageCollaborators()) {
    return shell(`<div class="notice danger"><strong>Acesso restrito.</strong><br>Acesso restrito ao administrador master ou gerente para cadastrar colaboradores.</div>`);
  }

  const usuarios = objectToArray(state.data.usuarios || {})
    .sort((a, b) => String(a.nome || a.email || "").localeCompare(String(b.nome || b.email || "")));
  const editingId = state.editingUserId || "";
  const editing = editingId ? (state.data.usuarios?.[editingId] || null) : null;
  const submitLabel = editing ? "Salvar alterações" : "Criar acesso e cadastrar colaborador";
  const currentRole = editing?.papel || "vendedor";

  shell(`
    <div class="card">
      <div class="actions" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h2>${editing ? `Editar colaborador ${escapeHtml(editing.nome || editing.email || "")}` : "Cadastrar colaborador"}</h2>
          <p style="color:var(--muted);margin-top:6px">
            O Vitor ou gerente cria o acesso direto pela plataforma. O sistema cadastra no login e já vincula função/permissão.
          </p>
        </div>
        ${editing ? `<button class="btn btn-light btn-sm" type="button" id="cancelUserEditBtn">Cancelar edição</button>` : ""}
      </div>

      <div class="notice">
        <strong>Regra de acesso</strong><br>
        Administrador Master possui acesso total. Gerente administra a operação. Vendedor e atendente lançam vendas, clientes, produtos e consignações. Entregador mantém acesso de consulta operacional.
      </div>

      <form id="collaboratorForm" class="form-row">
        <input type="hidden" name="editingUid" value="${escapeHtml(editingId)}">

        ${editing ? `
          <div class="field col-3"><label>UID do usuário</label><input name="uid" readonly value="${escapeHtml(editingId)}"></div>
        ` : `
          <div class="field col-3"><label>UID existente, se já tiver</label><input name="uid" placeholder="Opcional. Se deixar vazio, o sistema cria no login."></div>
          <div class="field col-3"><label>Senha inicial</label><input name="senha" type="password" minlength="6" placeholder="Mínimo 6 caracteres"></div>
        `}

        <div class="field col-3"><label>Nome</label><input name="nome" required placeholder="Nome do colaborador" value="${escapeHtml(editing?.nome || "")}"></div>
        <div class="field col-3"><label>E-mail</label><input name="email" type="email" required placeholder="email@empresa.com.br" value="${escapeHtml(editing?.email || "")}" ${editing ? "readonly" : ""}></div>
        <div class="field col-3"><label>Função</label><select name="papel">${collaboratorOptions(currentRole)}</select></div>
        <div class="field col-3"><label>Cargo interno</label><input name="cargo" placeholder="Ex.: Vendedor balcão" value="${escapeHtml(editing?.cargo || "")}"></div>
        <div class="field col-3"><label>Telefone</label><input name="telefone" placeholder="(00) 00000-0000" value="${escapeHtml(editing?.telefone || "")}"></div>
        <div class="field col-3"><label>Status</label><select name="ativo">
          <option value="true" ${editing?.ativo === false ? "" : "selected"}>Ativo</option>
          <option value="false" ${editing?.ativo === false ? "selected" : ""}>Inativo</option>
        </select></div>
        <div class="field col-3"><label>Aparece como vendedor?</label><select name="comercial">
          <option value="auto" selected>Automático pela função</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </select></div>
        <div class="field col-12"><label>Motivo / observação</label><input name="motivo" placeholder="Ex.: contratação, troca de função, ajuste autorizado pelo Vitor"></div>
        <div class="field col-12"><button class="btn btn-gold" type="submit">${submitLabel}</button></div>
      </form>
    </div>

    <div class="grid grid-4">
      <div class="kpi"><span>Total de colaboradores</span><strong>${usuarios.length}</strong></div>
      <div class="kpi"><span>Gerentes</span><strong>${usuarios.filter((u) => u.papel === "gerente").length}</strong></div>
      <div class="kpi"><span>Vendedores</span><strong>${usuarios.filter((u) => u.papel === "vendedor").length}</strong></div>
      <div class="kpi"><span>Ativos</span><strong>${usuarios.filter((u) => u.ativo !== false).length}</strong></div>
    </div>

    <div class="card">
      <h2>Colaboradores cadastrados</h2>
      ${collaboratorRows(usuarios)}
    </div>
  `);

  document.getElementById("collaboratorForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canManageCollaborators()) return alert("Apenas administrador master ou gerente pode cadastrar colaboradores.");

    const button = event.currentTarget.querySelector("button[type='submit']");
    if (button) {
      button.disabled = true;
      button.textContent = editing ? "Salvando..." : "Criando acesso...";
    }

    const form = new FormData(event.currentTarget);
    const editingUid = String(form.get("editingUid") || "").trim();
    let saveUid = editingUid || String(form.get("uid") || "").trim();

    const existing = saveUid ? (state.data.usuarios?.[saveUid] || {}) : {};
    const papel = String(form.get("papel") || "vendedor").trim();
    const ativo = String(form.get("ativo") || "true") === "true";
    const nome = String(form.get("nome") || "").trim();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const senha = String(form.get("senha") || "").trim();
    const motivo = auditReason(form.get("motivo"), editing ? "Alteração de colaborador" : "Cadastro de novo colaborador");

    try {
      if (!isOwnerUser() && papel === "dono") {
        throw new Error("Somente o administrador master atual pode cadastrar outro usuário como Administrador Master.");
      }

      if (!editingUid && !saveUid) {
        if (!senha || senha.length < 6) {
          throw new Error("Informe uma senha inicial com pelo menos 6 caracteres.");
        }

        const created = await createAuthUserFromPlatform({ nome, email, senha, papel, ativo });
        saveUid = created.uid;
      }

      if (!saveUid) throw new Error("Não foi possível definir o UID do colaborador.");

      const usuario = {
        ...existing,
        uid: saveUid,
        nome,
        email,
        papel,
        cargo: String(form.get("cargo") || "").trim(),
        telefone: String(form.get("telefone") || "").trim(),
        ativo,
        criadoEm: existing.criadoEm || nowIso(),
        atualizadoEm: nowIso(),
        cadastradoPor: state.user?.uid || "",
        origemCadastro: existing.origemCadastro || (editingUid ? "edicao_plataforma" : (String(form.get("uid") || "").trim() ? "uid_existente" : "firebase_auth_api"))
      };

      await DB.save("usuarios", saveUid, usuario);

      const comercial = String(form.get("comercial") || "auto");
      const deveAparecerComoVendedor = comercial === "sim" || (comercial === "auto" && ["gerente", "vendedor", "atendente"].includes(papel));

      if (deveAparecerComoVendedor) {
        const vendedorExistente = state.data.vendedores?.[saveUid] || {};
        await DB.save("vendedores", saveUid, {
          ...vendedorExistente,
          uid: saveUid,
          nome,
          email,
          cargo: usuario.cargo || roleLabel(papel),
          ativo,
          percentualComissao: Number(vendedorExistente.percentualComissao || 0),
          origem: "colaborador",
          atualizadoEm: nowIso(),
          criadoEm: vendedorExistente.criadoEm || nowIso()
        });
      }

      await auditLog(editingUid ? "colaborador_alterado" : "colaborador_criado", {
        colecao: "usuarios",
        documentoId: saveUid,
        motivo,
        resumo: `${nome} · ${email} · ${roleLabel(papel)}`,
        antes: existing,
        depois: usuario
      });

      state.editingUserId = "";
      await loadData();
      render();
    } catch (err) {
      alert(err.message || "Não foi possível cadastrar colaborador.");
      if (button) {
        button.disabled = false;
        button.textContent = submitLabel;
      }
    }
  });

  document.querySelectorAll("[data-edit-user]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingUserId = button.dataset.editUser || "";
      render();
      setTimeout(() => document.getElementById("collaboratorForm")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    });
  });

  document.getElementById("cancelUserEditBtn")?.addEventListener("click", () => {
    state.editingUserId = "";
    render();
  });
}


function vendedoresView() {
  if (!isAdminUser()) return shell(`<div class="notice danger"><strong>Acesso restrito.</strong><br>Acesso restrito ao administrador master ou gerente para gerenciar equipe comercial.</div>`);
  const vendedores = objectToArray(state.data.vendedores).sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));

  shell(`
    <div class="card">
      <h2>Registrar vendedor</h2>
      <p style="color:var(--muted)">Cadastre a equipe comercial para vincular vendas, consignações, relatórios e comissões.</p>
      <form id="sellerForm" class="form-row">
        <div class="field col-3"><label>Nome</label><input name="nome" required placeholder="Nome do vendedor"></div>
        <div class="field col-3"><label>E-mail</label><input name="email" type="email" placeholder="vendedor@empresa.com.br"></div>
        <div class="field col-3"><label>Cargo</label><select name="cargo"><option>Vendedor</option><option>Gestor comercial</option><option>Representante</option><option>Atendimento</option></select></div>
        ${isOwnerUser()
          ? `<div class="field col-2"><label>Comissão própria (%)</label><input name="percentualComissao" type="number" step="0.01" placeholder="Padrão"></div>`
          : `<input type="hidden" name="percentualComissao" value="0"><div class="field col-2"><label>Comissão própria (%)</label><div class="notice danger">Restrito ao Vitor.</div></div>`
        }
        <div class="field col-1"><button class="btn btn-gold" type="submit">Salvar</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Equipe cadastrada</h2>
      ${vendedorRows(vendedores)}
    </div>

    <div class="card">
      <h2>Como o sistema usa vendedores</h2>
      <div class="grid grid-3">
        <div class="notice"><strong>Vendas</strong><br>Cada venda pode ficar vinculada ao vendedor responsável.</div>
        <div class="notice"><strong>Consignações</strong><br>Pedidos pendentes mantêm responsável até virar venda ou devolução.</div>
        <div class="notice"><strong>Comissões</strong><br>Usa comissão própria do vendedor ou a regra padrão da operação.</div>
      </div>
    </div>
  `);

  document.getElementById("sellerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nome = String(form.get("nome") || "").trim();
    if (!nome) return;
    const vendedorId = uid("vendedor");
    const vendedor = {
      nome,
      email: String(form.get("email") || "").trim(),
      cargo: String(form.get("cargo") || "").trim(),
      percentualComissao: isOwnerUser() ? numberSafe(form.get("percentualComissao") || 0) : 0,
      ativo: true,
      criadoEm: nowIso()
    };
    await DB.save("vendedores", vendedorId, vendedor);
    await auditLog("vendedor_cadastrado", {
      colecao: "vendedores",
      documentoId: vendedorId,
      motivo: "Cadastro manual de vendedor",
      resumo: nome,
      depois: vendedor
    });
    await loadData();
    render();
  });
}


function comissoesView() {
  if (!isOwnerUser()) return shell(`<div class="notice danger"><strong>Acesso restrito.</strong><br>Comissões são restritas ao administrador master.</div>`);
  const comissoes = objectToArray(state.data.comissoes).sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));

  shell(`
    <div class="card">
      <h2>Regra de comissão</h2>
      <form id="commissionConfigForm" class="form-row">
        <div class="field col-4"><label>Percentual padrão (%)</label><input name="percentual" type="number" step="0.01" value="${state.data.configuracoes?.percentualComissaoPadrao ?? 0}"></div>
        <div class="field col-8"><button class="btn btn-gold" type="submit">Salvar regra</button></div>
      </form>
      <div class="notice" style="margin-top:14px">A regra atual calcula comissão sobre o valor total da venda. Regras por vendedor, produto ou material podem ser adicionadas na próxima versão.</div>
    </div>

    <div class="card">
      <h2>Comissões geradas</h2>
      ${commissionTable(comissoes)}
    </div>
  `);

  document.getElementById("commissionConfigForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const before = { ...state.data.configuracoes };
    state.data.configuracoes.percentualComissaoPadrao = numberSafe(form.get("percentual") || 0);
    await DB.setCollection("configuracoes", state.data.configuracoes);
    await auditLog("regra_comissao_alterada", {
      colecao: "configuracoes",
      documentoId: "percentualComissaoPadrao",
      motivo: "Alteração da regra padrão de comissão",
      resumo: `Comissão padrão ${state.data.configuracoes.percentualComissaoPadrao}%`,
      antes: before,
      depois: state.data.configuracoes
    });
    await loadData();
    render();
  });
}

function commissionTable(items) {
  if (!items.length) return `<div class="empty">Nenhuma comissão gerada ainda.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Vendedor</th><th>Base</th><th>%</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>
          ${items.map((c) => `
            <tr>
              <td>${formatDate(c.criadoEm)}</td>
              <td>${escapeHtml(c.vendedor || "")}</td>
              <td>${formatCurrency(c.baseCalculo || 0)}</td>
              <td>${formatNumber(c.percentual || 0, 2)}%</td>
              <td><strong>${formatCurrency(c.valor || 0)}</strong></td>
              <td><span class="badge warning">${escapeHtml(c.status || "pendente")}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}


const BACKUP_COLLECTIONS = [
  "clientes", "produtos", "pedidos", "vendas", "consignacoes", "cadastrosMostruario",
  "inventariosEstoque", "pedidosProducao", "producoes", "lotes", "pecasEstoque",
  "movimentos", "estoqueMovimentos", "alertasGestor", "alertasOperacionais", "alertas",
  "vendedores", "tiposProduto", "parametrosTecnicos", "configuracoes", "usuarios", "auditoria", "iaConsultas", "comissoes"
];

function backupPayload() {
  const dados = {};
  for (const col of BACKUP_COLLECTIONS) {
    dados[col] = state.data?.[col] || {};
  }
  return {
    tipo: "glamore_backup_firebase_realtime_database",
    versaoSistema: window.__JOIAS_APP_VERSION__ || "",
    empresaId: APP_CONFIG.empresaId,
    criadoEm: nowIso(),
    criadoPor: state.user?.email || "",
    criadoPorUid: state.user?.uid || "",
    observacao: "Backup completo da operação para restauração manual pela tela Relatórios. Não contém senha de usuário.",
    colecoes: BACKUP_COLLECTIONS,
    dados
  };
}

function downloadTextFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2500);
}

function downloadBackupJson({ motivo = "manual" } = {}) {
  const payload = backupPayload();
  payload.motivo = motivo;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  downloadTextFile(`backup-glamore-${APP_CONFIG.empresaId}-${stamp}.json`, JSON.stringify(payload, null, 2));
  localStorage.setItem("glamore_last_backup_download", new Date().toISOString().slice(0, 10));
  return payload;
}

async function restoreBackupFromPayload(payload = {}) {
  if (!payload || payload.tipo !== "glamore_backup_firebase_realtime_database" || !payload.dados) {
    throw new Error("Arquivo inválido. Selecione um backup JSON gerado pelo sistema.");
  }
  const cols = Array.isArray(payload.colecoes) && payload.colecoes.length ? payload.colecoes : Object.keys(payload.dados || {});
  const allowed = cols.filter((col) => BACKUP_COLLECTIONS.includes(col));
  if (!allowed.length) throw new Error("Backup sem coleções compatíveis para restaurar.");
  const confirmText = prompt(
    `ATENÇÃO: isso vai restaurar o backup e substituir dados operacionais do Firebase.\n\nBackup criado em: ${payload.criadoEm || "sem data"}\nColeções: ${allowed.length}\n\nPara confirmar, digite: RESTAURAR BACKUP`
  );
  if (confirmText !== "RESTAURAR BACKUP") throw new Error("Restauração cancelada.");

  for (const col of allowed) {
    await DB.setCollection(col, payload.dados[col] || {});
  }
  await auditLog("backup_restaurado", {
    colecao: "configuracoes",
    documentoId: "backup",
    motivo: "Restauração manual de backup JSON",
    resumo: `Backup restaurado com ${allowed.length} coleção(ões).`,
    depois: { criadoEmBackup: payload.criadoEm || "", colecoes: allowed }
  });
  await loadData();
  render();
}

function scheduleDailyBackupDownload() {
  if (!state.user || !state.data) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const last = localStorage.getItem("glamore_last_backup_download") || "";
  const enabled = localStorage.getItem("glamore_daily_backup_enabled") !== "false";
  if (!enabled || last === today) return;
  if (now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() >= 0)) {
    downloadBackupJson({ motivo: "backup_automatico_17h_app_aberto" });
  }
}

setInterval(scheduleDailyBackupDownload, 60 * 1000);

function relatoriosView() {
  shell(`
    <div class="card no-print">
      <div class="actions" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h2>Gerar laudos e relatórios</h2>
          <p style="color:var(--muted);margin-top:6px">Relatórios compactos para tela, PDF e impressão. O modo resumo cabe melhor no papel; o detalhado mostra peça física por peça física.</p>
        </div>
        <div class="actions">
          <button class="btn btn-light" type="button" id="reportPrintBtn">Imprimir / Salvar PDF</button>
          <button class="btn btn-gold" type="button" id="downloadBackupBtn">Baixar backup JSON</button>
        </div>
      </div>

      <form id="reportForm" class="form-row">
        <div class="field col-2">
          <label>Tipo de relatório</label>
          <select name="tipo">
            <option value="estoque">Estoque geral</option>
            <option value="vendas">Vendas por produto</option>
          </select>
        </div>
        <div class="field col-2">
          <label>Visualização</label>
          <select name="modo">
            <option value="resumo">Resumo compacto</option>
            <option value="detalhado">Detalhado por peça</option>
          </select>
        </div>
        <div class="field col-2"><label>Código</label><input name="codigo" placeholder="2740AGL"></div>
        <div class="field col-2"><label>Medida</label><input name="medida" placeholder="08"></div>
        <div class="field col-2"><label>Material</label><input name="material" placeholder="Ouro 18K"></div>
        <div class="field col-2"><button class="btn btn-gold" type="submit">Gerar</button></div>
        ${clienteField("cliente", "col-3 report-commercial-filter", "Cliente")}
        ${vendedorField("vendedor", "col-3 report-commercial-filter", "Vendedor")}
      </form>
    </div>

    <div class="card no-print backup-panel">
      <div class="actions" style="justify-content:space-between;align-items:flex-start">
        <div>
          <h2>Backup do banco de dados</h2>
          <p style="color:var(--muted);margin-top:6px">Baixe um JSON completo da operação e restaure em caso de perda. O backup automático baixa às 17h quando o sistema estiver aberto no navegador.</p>
        </div>
        <span class="badge blue">Firebase JSON</span>
      </div>
      <div class="grid grid-3">
        <button class="btn btn-gold" type="button" id="backupNowBtn">Baixar backup agora</button>
        <label class="btn btn-light" for="restoreBackupInput">Importar/restaurar backup</label>
        <button class="btn btn-light" type="button" id="toggleDailyBackupBtn">Backup diário 17h: ativo</button>
      </div>
      <input id="restoreBackupInput" type="file" accept="application/json,.json" style="display:none">
      <div class="notice"><strong>Importante:</strong><br>O navegador só consegue salvar automaticamente se o sistema estiver aberto. No celular, o download vai para a pasta de downloads do aparelho.</div>
    </div>

    <div id="reportOutput">
      ${buildInventoryReport(state.data, { modo: "resumo" })}
    </div>
  `);

  const reportOutput = document.getElementById("reportOutput");
  enhanceResponsiveTables(reportOutput);
  document.getElementById("reportPrintBtn")?.addEventListener("click", () => window.print());
  document.getElementById("downloadBackupBtn")?.addEventListener("click", () => downloadBackupJson({ motivo: "manual_relatorios_topo" }));
  document.getElementById("backupNowBtn")?.addEventListener("click", () => {
    downloadBackupJson({ motivo: "manual_relatorios_backup_panel" });
    alert("Backup JSON gerado. Confira a pasta de downloads.");
  });
  document.getElementById("toggleDailyBackupBtn")?.addEventListener("click", (event) => {
    const current = localStorage.getItem("glamore_daily_backup_enabled") !== "false";
    const next = !current;
    localStorage.setItem("glamore_daily_backup_enabled", next ? "true" : "false");
    event.currentTarget.textContent = `Backup diário 17h: ${next ? "ativo" : "desativado"}`;
  });
  document.getElementById("restoreBackupInput")?.addEventListener("change", async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await restoreBackupFromPayload(payload);
      alert("Backup restaurado com sucesso.");
    } catch (err) {
      alert(err.message || "Não foi possível restaurar o backup.");
    } finally {
      event.currentTarget.value = "";
    }
  });

  document.getElementById("reportForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tipo = form.get("tipo");
    const filters = {
      codigo: form.get("codigo"),
      medida: form.get("medida"),
      material: form.get("material"),
      cliente: form.get("cliente"),
      vendedor: form.get("vendedor"),
      modo: form.get("modo")
    };

    document.getElementById("reportOutput").innerHTML = tipo === "vendas"
      ? buildSalesReport(state.data, filters)
      : buildInventoryReport(state.data, filters);
    enhanceResponsiveTables(document.getElementById("reportOutput"));
  });
}


function assistenteView() {
  shell(`
    <section class="ai-studio">
      <div class="ai-hero-card no-print">
        <div>
          <span class="eyebrow">IA real da operação</span>
          <h2>Consultas rápidas sobre joias, vendas, clientes e produção.</h2>
          <p>A resposta é calculada com os dados cadastrados no sistema e com as regras da fábrica. Ela não inventa números: quando não encontra informação, avisa claramente.</p>
        </div>
        <div class="ai-status-panel">
          <span class="badge gold">Online</span>
          <strong>${formatNumber(objectToArray(state.data?.produtos || {}).length, 0)}</strong>
          <small>joias cadastradas</small>
          <strong>${formatNumber(objectToArray(state.data?.vendas || {}).length, 0)}</strong>
          <small>vendas registradas</small>
        </div>
      </div>

      <div class="ai-layout">
        <div class="ai-panel no-print">
          <h3>Perguntas prontas</h3>
          <p>Toque em um atalho ou digite livremente.</p>
          <div class="quick-prompts">
            <button class="prompt-chip" data-prompt="Mostrar estoque crítico">Estoque crítico</button>
            <button class="prompt-chip" data-prompt="O que precisa produzir?">Produção sugerida</button>
            <button class="prompt-chip" data-prompt="Mostrar consignações pendentes">Consignações pendentes</button>
            <button class="prompt-chip" data-prompt="Resumo das vendas">Resumo de vendas</button>
            <button class="prompt-chip" data-prompt="Clientes com histórico de vendas">Clientes</button>
            ${isOwnerUser() ? `<button class="prompt-chip" data-prompt="Comissões por vendedor">Comissões</button>` : ""}
            <button class="prompt-chip" data-prompt="Explique o fluxo de consignação">Fluxo consignação</button>
            <button class="prompt-chip" data-prompt="O que você sabe fazer?">Ajuda</button>
          </div>
        </div>

        <div class="ai-workspace">
          <div class="ai-thread" id="aiOutput">
            <div class="ai-message ai-message-system">
              <div class="ai-avatar">◆</div>
              <div class="ai-bubble">
                <h3>Pronta para consultar a fábrica.</h3>
                <p>Use perguntas como: “quantos anéis ALM0027F medida 18 tem?”, “relatório de venda do cliente Capital”, “comissão do vendedor João” ou “o que precisa produzir?”.</p>
              </div>
            </div>
          </div>

          <form id="aiQuestionForm" class="ai-compose no-print">
            <label for="aiQuestion">Pergunte sobre a operação</label>
            <div class="ai-compose-box">
              <textarea id="aiQuestion" name="pergunta" rows="4" placeholder="Ex.: Quero relatório de venda do anel ALM0027F medida 18, com cliente e vendedor"></textarea>
              <button class="btn btn-primary ai-send" type="submit">Consultar</button>
            </div>
            <small>Pesquisa em estoque, vendas, clientes, vendedores, produção, consignações e fluxos internos.${isOwnerUser() ? " Comissão é consultada apenas pelo administrador master." : ""}</small>
          </form>
        </div>
      </div>
    </section>
  `);

  async function ask(question) {
    const context = {
      data: state.data,
      question,
      user: currentUserAuditInfo(),
      permissions: {
        role: currentUserRole(),
        isOwner: isOwnerUser(),
        isAdmin: isAdminUser(),
        canSeeCommissions: isOwnerUser()
      }
    };

    const answer = assistantAnswer(context);
    const output = document.getElementById("aiOutput");
    output.innerHTML = `
      <div class="ai-message ai-message-user">
        <div class="ai-bubble ai-user-bubble">${escapeHtml(question || "Consulta")}</div>
      </div>
      <div class="ai-message ai-message-system">
        <div class="ai-avatar">◆</div>
        <div class="ai-bubble">
          <h3>${escapeHtml(answer.title)}</h3>
          <div class="ai-answer">${escapeHtml(answer.text)}</div>
          ${renderAssistantRows(answer.rows)}
          <div class="report-footer"><span>Consulta interna</span><strong>${escapeHtml(APP_CONFIG.app.assinatura)}</strong></div>
        </div>
      </div>
    `;
    enhanceResponsiveTables(output);
    output.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      await DB.push("iaConsultas", {
        pergunta: question || "",
        titulo: answer.title || "",
        resumo: String(answer.text || "").slice(0, 700),
        linhasRetornadas: Array.isArray(answer.rows) ? answer.rows.length : 0,
        criadoEm: nowIso(),
        dataHora: new Date().toLocaleString("pt-BR"),
        usuarioUid: state.user?.uid || "",
        usuarioEmail: state.user?.email || "",
        usuarioPapel: currentUserRole()
      });

      await auditLog("ia_consulta_realizada", {
        colecao: "iaConsultas",
        documentoId: "consulta_ia",
        motivo: "Consulta feita pela IA Real",
        resumo: question || "",
        depois: {
          titulo: answer.title,
          linhasRetornadas: Array.isArray(answer.rows) ? answer.rows.length : 0,
          permissaoComissao: isOwnerUser()
        }
      });
    } catch (err) {
      console.warn("Consulta de IA não auditada:", err);
    }
  }

  const form = document.getElementById("aiQuestionForm");
  const textarea = document.getElementById("aiQuestion");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const question = String(formData.get("pergunta") || "").trim();
    ask(question);
  });

  textarea?.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      form?.requestSubmit();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.dataset.prompt || "";
      if (textarea) textarea.value = prompt;
      ask(prompt);
    });
  });
}


function auditoriaView() {
  if (!isAdminUser()) {
    return shell(`<div class="notice danger"><strong>Acesso restrito.</strong><br>Acesso restrito ao administrador master ou gerente para consultar auditoria.</div>`);
  }

  const logs = objectToArray(state.data.auditoria || {})
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")))
    .slice(0, 500);

  const resumoAcoes = logs.reduce((acc, item) => {
    const key = item.acao || "acao";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const estornos = logs.filter((item) => normalizeSearchText(`${item.acao || ""} ${item.resumo || ""}`).includes("ESTORN"));
  const justificativas = logs.filter((item) => String(item.motivo || "").trim() && item.justificativaObrigatoria);

  shell(`
    <div class="card">
      <div class="card-head">
        <div>
          <h2>Auditoria da operação</h2>
          <p style="color:var(--muted)">Aqui ficam registrados usuário, data, ação, documento, justificativa obrigatória e impacto operacional. Registros de auditoria não são apagados pelo estorno.</p>
        </div>
        <span class="badge gold">Acesso administrativo</span>
      </div>

      <div class="grid grid-4">
        <div class="kpi"><span>Registros carregados</span><strong>${logs.length}</strong></div>
        <div class="kpi"><span>Estornos registrados</span><strong>${estornos.length}</strong></div>
        <div class="kpi"><span>Justificativas</span><strong>${justificativas.length}</strong></div>
        <div class="kpi"><span>Última ação</span><strong>${logs[0]?.dataHora || "-"}</strong></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Consultar auditoria</h2>
          <p>Pesquise por pedido, usuário, ação, coleção ou justificativa.</p>
        </div>
        <button class="btn btn-light" type="button" id="auditExportBtn">Exportar auditoria JSON</button>
      </div>

      <div class="form-row">
        <div class="field col-8">
          <label>Busca geral</label>
          <input id="auditSearch" type="search" placeholder="Ex.: estorno, pedido 26758, usuário, motivo...">
        </div>
        <div class="field col-4">
          <label>Mostrar</label>
          <select id="auditTypeFilter">
            <option value="todos">Todos os registros</option>
            <option value="estorno">Somente estornos</option>
            <option value="concluida">Concluídos</option>
            <option value="falhou">Falhas</option>
            <option value="iniciada">Em andamento</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <h2>Registros</h2>
          <p id="auditVisibleCount">${logs.length} registro(s) exibido(s).</p>
        </div>
      </div>
      ${auditRows(logs)}
    </div>
  `);

  const applyAuditFilter = () => {
    const search = normalizeSearchText(document.getElementById("auditSearch")?.value || "");
    const type = String(document.getElementById("auditTypeFilter")?.value || "todos");
    let visible = 0;

    document.querySelectorAll("[data-audit-card]").forEach((card) => {
      const text = normalizeSearchText(card.dataset.auditSearch || "");
      const status = String(card.dataset.auditStatus || "");
      const isReversal = card.dataset.auditReversal === "true";
      const searchOk = !search || text.includes(search);
      const typeOk =
        type === "todos" ||
        (type === "estorno" && isReversal) ||
        (type !== "estorno" && status === type);

      const show = searchOk && typeOk;
      card.style.display = show ? "" : "none";
      if (show) visible += 1;
    });

    const count = document.getElementById("auditVisibleCount");
    if (count) count.textContent = `${visible} registro(s) exibido(s).`;
  };

  document.getElementById("auditSearch")?.addEventListener("input", applyAuditFilter);
  document.getElementById("auditTypeFilter")?.addEventListener("change", applyAuditFilter);

  document.getElementById("auditExportBtn")?.addEventListener("click", () => {
    const payload = {
      tipo: "exportacao_auditoria_glamore",
      empresaId: APP_CONFIG.empresaId,
      geradoEm: nowIso(),
      geradoPor: currentUserAuditInfo(),
      total: logs.length,
      registros: logs
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `auditoria-glamore-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 1500);
  });
}

function auditRows(logs) {
  if (!logs.length) return `<div class="empty">Nenhum registro de auditoria ainda.</div>`;

  return `
    <div class="audit-list">
      ${logs.map((item) => {
        const actionText = `${item.acao || ""} ${item.resumo || ""}`;
        const isReversal = normalizeSearchText(actionText).includes("ESTORN");
        const status = String(item.statusAuditoria || "concluida").toLowerCase();
        const statusClass = status === "falhou" ? "danger" : status === "iniciada" ? "light" : "success";
        const searchText = [
          item.acao,
          item.resumo,
          item.motivo,
          item.colecao,
          item.documentoId,
          item.usuarioNome,
          item.usuarioEmail,
          item.usuarioPapelLabel,
          item.statusAuditoria,
          item.dataHora
        ].join(" ");

        return `
          <article
            class="audit-card"
            data-audit-card
            data-audit-search="${escapeHtml(searchText)}"
            data-audit-status="${escapeHtml(status)}"
            data-audit-reversal="${isReversal ? "true" : "false"}"
          >
            <div class="audit-head">
              <div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <strong>${escapeHtml(item.acao || "Ação")}</strong>
                  <span class="badge ${statusClass}">${escapeHtml(status)}</span>
                  ${isReversal ? `<span class="badge danger">Estorno</span>` : ""}
                  ${item.justificativaObrigatoria ? `<span class="badge gold">Justificativa obrigatória</span>` : ""}
                </div>
                <p>${escapeHtml(item.resumo || item.colecao || "")}</p>
              </div>
              <span class="badge blue">${escapeHtml(item.dataHora || formatDate(item.criadoEm))}</span>
            </div>

            <div class="product-card-meta">
              <div><small>Usuário</small><b>${escapeHtml(item.usuarioNome || item.usuarioEmail || "-")}</b></div>
              <div><small>E-mail</small><b>${escapeHtml(item.usuarioEmail || "-")}</b></div>
              <div><small>Função</small><b>${escapeHtml(item.usuarioPapelLabel || item.usuarioPapel || "-")}</b></div>
              <div><small>Status</small><b>${escapeHtml(status)}</b></div>
              <div><small>Coleção</small><b>${escapeHtml(item.colecao || "-")}</b></div>
              <div><small>Documento/Pedido</small><b>${escapeHtml(item.documentoId || "-")}</b></div>
            </div>

            <div class="notice audit-reason">
              <strong>Justificativa/Motivo:</strong> ${escapeHtml(item.motivo || "Não informado")}
            </div>

            ${(item.antes || item.depois || item.erro || Object.keys(item.metadados || {}).length) ? `
              <details style="margin-top:12px">
                <summary><strong>Ver impacto e dados técnicos registrados</strong></summary>
                <div style="display:grid;gap:10px;margin-top:10px">
                  ${item.erro ? `<div class="notice danger"><strong>Erro:</strong> ${escapeHtml(item.erro)}</div>` : ""}
                  ${item.antes ? `<div><small>Antes</small><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto">${escapeHtml(item.antes)}</pre></div>` : ""}
                  ${item.depois ? `<div><small>Depois</small><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto">${escapeHtml(item.depois)}</pre></div>` : ""}
                  ${Object.keys(item.metadados || {}).length ? `<div><small>Metadados</small><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto">${escapeHtml(shortJson(item.metadados))}</pre></div>` : ""}
                </div>
              </details>
            ` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}


function configuracoesView() {
  shell(`
    <div class="card">
      <h2>Regras da operação</h2>
      <p style="color:var(--muted)">Ajuste os parâmetros que impactam estoque parado, alerta de reposição e cálculo padrão de comissões.</p>
      <form id="configForm" class="form-row">
        <div class="field col-4"><label>Dias para considerar estoque parado</label><input name="diasEstoqueParado" type="number" value="${state.data.configuracoes?.diasEstoqueParado ?? APP_CONFIG.negocio.diasEstoqueParado}"></div>
        <div class="field col-4"><label>Estoque mínimo padrão para reposição inteligente</label><input name="estoqueMinimoPadrao" type="number" value="${state.data.configuracoes?.estoqueMinimoPadrao ?? APP_CONFIG.negocio.estoqueMinimoPadrao}"></div>
        ${isOwnerUser()
          ? `<div class="field col-4"><label>Comissão padrão (%)</label><input name="percentualComissaoPadrao" type="number" step="0.01" value="${state.data.configuracoes?.percentualComissaoPadrao ?? APP_CONFIG.negocio.percentualComissaoPadrao}"></div>`
          : `<div class="field col-4"><label>Comissão padrão (%)</label><div class="notice danger">Campo restrito ao administrador master.</div></div>`
        }
        <div class="field col-12"><button class="btn btn-gold" type="submit">Salvar regras</button></div>
      </form>
    </div>

    <div class="card">
      <h2>Rotina recomendada</h2>
      <div class="grid grid-3">
        <div class="notice"><strong>Entrada de produção</strong><br>Lançar peças disponíveis assim que saírem da bancada.</div>
        <div class="notice"><strong>Venda e consignação</strong><br>Conferir vendedor, cliente, código, medida e peso antes de confirmar.</div>
        <div class="notice"><strong>Reposição</strong><br>Revisar estoque crítico e parado toda semana.</div>
      </div>
    </div>

    <div class="card">
      <h2>Fluxos protegidos</h2>
      <div class="grid grid-3">
        <div class="notice"><strong>Cliente</strong><br>Cliente cadastrado alimenta histórico, venda e consignação.</div>
        <div class="notice"><strong>Vendedor</strong><br>Vendedor cadastrado alimenta comissão e relatório comercial.</div>
        <div class="notice"><strong>Joia</strong><br>Código, medida, material e peso formam a base do controle da fábrica.</div>
      </div>
    </div>
  `);

  document.getElementById("configForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const config = {
      ...state.data.configuracoes,
      diasEstoqueParado: quantitySafe(form.get("diasEstoqueParado") || 0),
      estoqueMinimoPadrao: quantitySafe(form.get("estoqueMinimoPadrao") || 0),
      percentualComissaoPadrao: isOwnerUser()
        ? numberSafe(form.get("percentualComissaoPadrao") || 0)
        : Number(state.data.configuracoes?.percentualComissaoPadrao ?? APP_CONFIG.negocio.percentualComissaoPadrao)
    };
    const before = { ...state.data.configuracoes };
    await DB.setCollection("configuracoes", config);
    await auditLog("regras_operacao_alteradas", {
      colecao: "configuracoes",
      documentoId: "geral",
      motivo: "Alteração das regras da operação",
      resumo: "Configurações de estoque, parado e comissão",
      antes: before,
      depois: config
    });
    state.data.configuracoes = config;
    await loadData();
    render();
  });
}


function render() {
  if (!state.user) return loginView();
  if (!state.data) return;

  const page = routeName();
  if (!canAccessRoute(page)) {
    const first = availableRoutes()[0]?.[0] || "dashboard";
    if (page !== first) {
      location.hash = `#/${first}`;
      return;
    }
  }
  if (page === "dashboard") return dashboardView();
  if (page === "importacao") return importView();
  if (page === "produtos") return produtosView();
  if (page === "producao") return producaoView();
  if (page === "calculadora") return calculadoraView();
  if (page === "estoque") return estoqueView();
  if (page === "vendas") return vendasView();
  if (page === "alertas") return alertasView();
  if (page === "consignacoes") return consignacoesView();
  if (page === "clientes") return clientesView();
  if (page === "colaboradores") return colaboradoresView();
  if (page === "auditoria") return auditoriaView();
  if (page === "vendedores") return vendedoresView();
  if (page === "comissoes") return comissoesView();
  if (page === "relatorios") return relatoriosView();
  if (page === "assistente") return assistenteView();
  if (page === "configuracoes") return configuracoesView();
  location.hash = "#/dashboard";
}

async function boot() {
  await DB.init();
  DB.onAuth(async (user) => {
    state.user = user;
    if (user) {
      try {
        await loadData();
        if (!isActiveUser()) {
          accessDeniedView("Peça ao Vitor ou a um gerente para ativar este usuário em Colaboradores.");
          return;
        }
      } catch (err) {
        accessDeniedView(err.message || "Este usuário ainda não tem acesso ao banco da empresa.");
        return;
      }
    }
    render();
    scheduleDailyBackupDownload();
  });
}

window.addEventListener("hashchange", render);
boot();
