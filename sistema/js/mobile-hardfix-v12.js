/*
 * Mobile/Desktop Hardfix V14 — Ateliê Digital de Joias
 * Corrige responsividade no runtime mesmo se algum CSS antigo for servido pelo cache.
 * Powered by thIAguinho Soluções Digitais
 */
(function () {
  "use strict";

  window.__JOIAS_BUILD_VERSION__ = "mobile-v14-desktop-mobile-equilibrado-20260616";
  window.__JOIAS_MOBILE_DESKTOP_FIX_V14__ = true;

  const MOBILE_MAX = 900;
  const routes = [
    ["dashboard", "Início"],
    ["importacao", "Importar pedidos"],
    ["produtos", "Joias"],
    ["producao", "Produção"],
    ["calculadora", "Calculadora"],
    ["estoque", "Estoque"],
    ["vendas", "Vendas"],
    ["consignacoes", "Consignações"],
    ["clientes", "Clientes"],
    ["vendedores", "Vendedores"],
    ["comissoes", "Comissões"],
    ["relatorios", "Relatórios"],
    ["assistente", "IA Real"],
    ["configuracoes", "Regras"]
  ];

  function routeName() {
    return (location.hash || "#/dashboard").replace("#/", "") || "dashboard";
  }

  function isMobile() {
    const ua = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(navigator.userAgent || "");
    const widths = [
      window.visualViewport && window.visualViewport.width,
      window.innerWidth,
      document.documentElement && document.documentElement.clientWidth
    ].filter(Boolean).map(Number);
    const minWidth = Math.min.apply(null, widths.length ? widths : [9999]);

    // Não usa screen.height/screenMin e não usa pointer:coarse sozinho.
    // Isso evita laptop/desktop 1366x768 entrar como mobile.
    return minWidth <= MOBILE_MAX || (ua && minWidth <= 1024);
  }

  function installStyle() {
    if (document.getElementById("joias-mobile-hardfix-v12-style")) return;
    const style = document.createElement("style");
    style.id = "joias-mobile-hardfix-v12-style";
    style.textContent = `
      @media (max-width: 900px) {
        *, *::before, *::after { box-sizing: border-box !important; }

        html,
        body,
        #app {
          width: 100% !important;
          max-width: 100vw !important;
          min-width: 0 !important;
          margin: 0 !important;
          overflow-x: hidden !important;
        }

        body.force-mobile,
        html.force-mobile {
          background: #f5f0e6 !important;
          -webkit-text-size-adjust: 100% !important;
          text-size-adjust: 100% !important;
        }

        .app-shell {
          display: block !important;
          width: 100% !important;
          max-width: 100vw !important;
          min-width: 0 !important;
          overflow-x: hidden !important;
        }

        .sidebar {
          position: sticky !important;
          top: 0 !important;
          z-index: 1000 !important;
          width: 100% !important;
          max-width: 100vw !important;
          min-width: 0 !important;
          height: auto !important;
          max-height: none !important;
          overflow: hidden !important;
          padding: calc(12px + env(safe-area-inset-top)) 16px 14px !important;
          border-radius: 0 0 24px 24px !important;
          border-right: 0 !important;
          background: radial-gradient(circle at 20% 0%, rgba(231,203,123,.22), transparent 34%), linear-gradient(180deg,#111827 0%,#0b1220 100%) !important;
          box-shadow: 0 14px 34px rgba(2,6,23,.28) !important;
        }

        .sidebar .brand-lockup,
        .brand-lockup {
          display: grid !important;
          grid-template-columns: 52px minmax(0, 1fr) !important;
          gap: 12px !important;
          align-items: center !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 0 12px !important;
        }

        .brand-mark,
        .sidebar .brand-mark {
          width: 52px !important;
          height: 52px !important;
          min-width: 52px !important;
          border-radius: 16px !important;
        }

        .brand-title {
          margin: 0 !important;
          max-width: 100% !important;
          font-size: clamp(20px, 5.8vw, 27px) !important;
          line-height: 1.08 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .brand-subtitle {
          margin: 3px 0 0 !important;
          max-width: 100% !important;
          font-size: clamp(13px, 3.8vw, 16px) !important;
          line-height: 1.22 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        nav.nav,
        .nav,
        aside .nav,
        .sidebar .nav {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          height: 0 !important;
          max-width: 0 !important;
          max-height: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
          position: absolute !important;
          left: -99999px !important;
        }

        .mobile-route-switcher {
          display: grid !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          gap: 7px !important;
          margin: 0 !important;
          position: relative !important;
        }

        .mobile-route-switcher label {
          color: rgba(255,248,230,.74) !important;
          font-size: 10px !important;
          font-weight: 900 !important;
          letter-spacing: .12em !important;
          text-transform: uppercase !important;
        }

        .mobile-route-switcher select,
        select.mobile-nav-select {
          display: block !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          min-height: 54px !important;
          padding: 0 44px 0 14px !important;
          border: 1px solid rgba(231,203,123,.40) !important;
          border-radius: 16px !important;
          color: #fff8e6 !important;
          font-size: 16px !important;
          font-weight: 850 !important;
          background: linear-gradient(135deg,rgba(255,255,255,.11),rgba(202,167,86,.12)),#101827 !important;
        }

        .content-shell,
        main,
        .main,
        section,
        .topbar,
        .footer,
        .actions,
        .user-pill,
        .hero-card,
        .ai-hero-card,
        .card,
        .kpi,
        .report-box,
        .notice,
        .empty,
        .ai-panel,
        .ai-workspace,
        .ai-answer,
        .table-wrap,
        .form-row,
        .grid,
        .grid-2,
        .grid-3,
        .grid-4,
        .dashboard-grid,
        .kpis,
        .cards,
        .ai-layout {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          overflow-x: hidden !important;
        }

        .content-shell {
          display: block !important;
          background: radial-gradient(circle at 100% 0%,rgba(202,167,86,.10),transparent 34%),#f5f0e6 !important;
        }

        .topbar {
          position: relative !important;
          top: auto !important;
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          padding: 22px 16px 16px !important;
          background: transparent !important;
          border-bottom: 1px solid rgba(40,32,22,.08) !important;
        }

        .topbar .actions,
        .actions {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
        }

        .user-pill {
          min-height: 58px !important;
          border-radius: 999px !important;
          padding: 8px 12px !important;
        }

        .user-pill strong,
        .user-pill span {
          display: inline-block !important;
          max-width: calc(100vw - 120px) !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          vertical-align: bottom !important;
        }

        .main,
        main {
          display: block !important;
          padding: 16px 16px 26px !important;
        }

        .page-title h1 {
          margin: 0 !important;
          max-width: 100% !important;
          font-size: clamp(27px, 8vw, 38px) !important;
          line-height: 1.04 !important;
          overflow-wrap: anywhere !important;
        }

        .page-title p {
          margin: 6px 0 0 !important;
          max-width: 100% !important;
          font-size: clamp(14px, 4.2vw, 18px) !important;
          line-height: 1.25 !important;
        }

        .hero-card,
        .ai-hero-card {
          display: grid !important;
          grid-template-columns: 1fr !important;
          margin: 0 0 14px !important;
          padding: 18px !important;
          border-radius: 22px !important;
        }

        .hero-card h2,
        .ai-hero-card h2 {
          max-width: 100% !important;
          font-size: clamp(24px, 7.2vw, 34px) !important;
          line-height: 1.04 !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .hero-gem {
          display: none !important;
        }

        .grid,
        .grid.grid-2,
        .grid.grid-3,
        .grid.grid-4,
        .grid-2,
        .grid-3,
        .grid-4,
        .form-row,
        .cards,
        .kpis,
        .dashboard,
        .dashboard-grid,
        .ai-layout {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .card,
        .kpi,
        .report-box,
        .notice,
        .empty,
        .ai-panel,
        .ai-workspace,
        .ai-answer {
          padding: 16px !important;
          border-radius: 20px !important;
        }

        .field,
        .check-field,
        [class^="col-"],
        [class*=" col-"] {
          grid-column: 1 / -1 !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }

        input,
        select,
        textarea,
        button,
        .btn {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          font-size: 16px !important;
        }

        button,
        .btn {
          min-height: 54px !important;
          border-radius: 16px !important;
          white-space: normal !important;
        }

        input,
        select,
        textarea {
          min-height: 54px !important;
          border-radius: 16px !important;
        }

        input[type="file"] {
          padding: 12px !important;
          overflow: hidden !important;
        }

        .table-wrap {
          overflow: visible !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        .table-wrap table,
        .table-wrap thead,
        .table-wrap tbody,
        .table-wrap tr,
        .table-wrap th,
        .table-wrap td {
          display: block !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
        }

        .table-wrap thead {
          display: none !important;
        }

        .table-wrap tbody {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 12px !important;
        }

        .table-wrap tr {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 0 !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(40,32,22,.10) !important;
          border-radius: 20px !important;
          background: linear-gradient(180deg,#fff,#fff8ed) !important;
          box-shadow: 0 14px 34px rgba(20,18,14,.08) !important;
          overflow: hidden !important;
        }

        .table-wrap td {
          display: grid !important;
          grid-template-columns: minmax(92px,34%) minmax(0,1fr) !important;
          gap: 9px !important;
          align-items: start !important;
          padding: 9px 0 !important;
          border: 0 !important;
          border-bottom: 1px solid rgba(40,32,22,.09) !important;
          text-align: left !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
        }

        .table-wrap td::before {
          content: attr(data-label) !important;
          display: block !important;
          color: #806a45 !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          text-transform: uppercase !important;
          letter-spacing: .06em !important;
          font-weight: 950 !important;
        }

        img,
        canvas,
        svg,
        video,
        .product-thumb {
          max-width: 100% !important;
        }

        .product-thumb,
        img.product-thumb {
          width: 72px !important;
          height: 72px !important;
          border-radius: 16px !important;
          object-fit: cover !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setStyle(el, prop, value) {
    if (el) el.style.setProperty(prop, value, "important");
  }

  function setMobileClasses(mobile) {
    document.documentElement.classList.toggle("force-mobile", mobile);
    document.body && document.body.classList.toggle("force-mobile", mobile);
  }

  function ensureMobileSwitcher() {
    const sidebar = document.querySelector(".sidebar, aside");
    if (!sidebar) return null;

    let switcher = sidebar.querySelector(".mobile-route-switcher");
    let select = document.querySelector("select.mobile-nav-select, #mobileRouteSelect, select[data-mobile-nav='true']");

    if (!switcher) {
      switcher = document.createElement("div");
      switcher.className = "mobile-route-switcher";
      const label = document.createElement("label");
      label.setAttribute("for", "mobileRouteSelect");
      label.textContent = "Tela do sistema";
      switcher.appendChild(label);

      const nav = sidebar.querySelector("nav.nav, .nav");
      const brand = sidebar.querySelector(".brand-lockup");
      if (nav) sidebar.insertBefore(switcher, nav);
      else if (brand && brand.nextSibling) sidebar.insertBefore(switcher, brand.nextSibling);
      else sidebar.appendChild(switcher);
    }

    if (!select) {
      select = document.createElement("select");
      select.id = "mobileRouteSelect";
      select.className = "mobile-nav-select";
      select.setAttribute("data-mobile-nav", "true");
      select.setAttribute("aria-label", "Escolher tela do sistema");
      routes.forEach(([key, label]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = label;
        select.appendChild(option);
      });
      switcher.appendChild(select);
    } else {
      select.classList.add("mobile-nav-select");
      select.setAttribute("data-mobile-nav", "true");
      if (!select.id) select.id = "mobileRouteSelect";
      if (!switcher.contains(select)) switcher.appendChild(select);
    }

    if (!select.__joiasV11Bound) {
      select.addEventListener("change", function () {
        const key = this.value || "dashboard";
        location.hash = "#/" + key;
        setTimeout(applyMobileFix, 50);
        setTimeout(applyMobileFix, 350);
      });
      select.__joiasV11Bound = true;
    }

    const current = routeName();
    if ([...select.options].some(o => o.value === current)) select.value = current;

    return select;
  }

  function labelTables() {
    document.querySelectorAll(".table-wrap table").forEach(table => {
      const headers = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim().replace(/\s+/g, " "));
      table.querySelectorAll("tbody tr").forEach(row => {
        [...row.children].forEach((cell, i) => {
          if (!cell.getAttribute("data-label")) cell.setAttribute("data-label", headers[i] || "Informação");
        });
      });
    });
  }

  function applyMobileFix() {
    installStyle();
    const mobile = isMobile();
    setMobileClasses(mobile);

    const select = ensureMobileSwitcher();
    labelTables();

    if (!mobile) {
      document.documentElement.classList.remove("force-mobile");
      document.body && document.body.classList.remove("force-mobile");

      document.querySelectorAll("nav.nav, .nav, aside .nav, .sidebar .nav").forEach(nav => {
        nav.removeAttribute("aria-hidden");
        ["display", "visibility", "position", "left", "top", "width", "height", "max-width", "max-height", "overflow", "pointer-events"].forEach(prop => nav.style.removeProperty(prop));
      });

      document.querySelectorAll(".mobile-route-switcher").forEach(el => {
        el.setAttribute("aria-hidden", "true");
        ["display", "width", "max-width", "min-width", "height", "max-height", "overflow"].forEach(prop => el.style.removeProperty(prop));
      });

      document.querySelectorAll(".mobile-nav-select").forEach(el => {
        ["display", "width", "max-width", "min-width"].forEach(prop => el.style.removeProperty(prop));
      });

      document.querySelectorAll(".app-shell,.content-shell,.main,main,section,.topbar,.actions,.user-pill,.hero-card,.ai-hero-card,.card,.grid,.grid-2,.grid-3,.grid-4,.form-row,.dashboard-grid,.kpis,.cards,.ai-layout,.table-wrap").forEach(el => {
        ["max-width", "min-width", "overflow-x", "display", "grid-template-columns"].forEach(prop => el.style.removeProperty(prop));
      });

      return;
    }

    const navs = document.querySelectorAll("nav.nav, .nav, aside .nav, .sidebar .nav");
    navs.forEach(nav => {
      nav.setAttribute("aria-hidden", "true");
      setStyle(nav, "display", "none");
      setStyle(nav, "visibility", "hidden");
      setStyle(nav, "position", "absolute");
      setStyle(nav, "left", "-99999px");
      setStyle(nav, "width", "0");
      setStyle(nav, "height", "0");
      setStyle(nav, "max-width", "0");
      setStyle(nav, "max-height", "0");
      setStyle(nav, "overflow", "hidden");
      setStyle(nav, "pointer-events", "none");
    });

    if (select) {
      select.classList.add("mobile-nav-select");
      select.setAttribute("data-mobile-nav", "true");
      setStyle(select, "display", "block");
      setStyle(select, "width", "100%");
      setStyle(select, "max-width", "100%");
      setStyle(select, "min-width", "0");
    }

    document.querySelectorAll(".app-shell,.content-shell,.main,main,section,.topbar,.actions,.user-pill,.hero-card,.ai-hero-card,.card,.grid,.grid-2,.grid-3,.grid-4,.form-row,.dashboard-grid,.kpis,.cards,.ai-layout,.table-wrap").forEach(el => {
      setStyle(el, "max-width", "100%");
      setStyle(el, "min-width", "0");
      setStyle(el, "overflow-x", "hidden");
    });

    document.querySelectorAll(".grid,.grid-2,.grid-3,.grid-4,.form-row,.dashboard-grid,.kpis,.cards,.ai-layout").forEach(el => {
      setStyle(el, "display", "grid");
      setStyle(el, "grid-template-columns", "1fr");
    });

    document.documentElement.style.setProperty("overflow-x", "hidden", "important");
    document.body && document.body.style.setProperty("overflow-x", "hidden", "important");
  }

  function schedule() {
    requestAnimationFrame(() => {
      applyMobileFix();
      setTimeout(applyMobileFix, 80);
      setTimeout(applyMobileFix, 300);
      setTimeout(applyMobileFix, 900);
    });
  }

  installStyle();
  schedule();

  window.addEventListener("load", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(schedule, 250), { passive: true });
  window.addEventListener("hashchange", schedule, { passive: true });
  window.visualViewport && window.visualViewport.addEventListener && window.visualViewport.addEventListener("resize", schedule, { passive: true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let count = 0;
  const interval = setInterval(() => {
    schedule();
    count += 1;
    if (count > 80) clearInterval(interval);
  }, 250);

  window.JOIAS_RESPONSIVE_FIX_V14 = {
    version: window.__JOIAS_BUILD_VERSION__,
    apply: applyMobileFix,
    isMobile,
    ensureMobileSwitcher
  };
})();
