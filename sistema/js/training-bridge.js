(() => {
  "use strict";

  const norm = (value = "") => String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ").trim();

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };

  const interactiveScore = (el) => {
    const tag = el.tagName;
    if (["BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(tag)) return 100;
    if (tag === "A") return 95;
    if (tag === "LABEL") return 90;
    if (/^H[1-6]$/.test(tag)) return 80;
    if (["TH", "TD", "STRONG", "B"].includes(tag)) return 65;
    return 40;
  };

  const controlForLabel = (label) => {
    if (!label || label.tagName !== "LABEL") return label;
    if (label.htmlFor) {
      const linked = document.getElementById(label.htmlFor);
      if (linked && visible(linked)) return linked;
    }
    return [...label.querySelectorAll("input,select,textarea,button")].find(visible) || label;
  };

  function exactTextCandidates(text) {
    const wanted = norm(text);
    if (!wanted) return [];
    const nodes = [...document.querySelectorAll(
      "button,a,label,summary,input,select,textarea,h1,h2,h3,h4,h5,h6,legend,th,td,strong,b,span,small,p"
    )].filter(visible);

    const rows = [];
    for (const el of nodes) {
      const values = [
        el.textContent,
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
        el.getAttribute("name"),
        el.value
      ].map(norm).filter(Boolean);
      const exact = values.some(v => v === wanted);
      const starts = values.some(v => v.startsWith(wanted));
      const contains = values.some(v => v.includes(wanted));
      if (!exact && !starts && !contains) continue;
      let score = interactiveScore(el);
      if (exact) score += 1000;
      else if (starts) score += 400;
      else score += 120;
      if (el.children.length === 0) score += 20;
      rows.push({ el: controlForLabel(el), score });
    }
    return rows.sort((a, b) => b.score - a.score);
  }

  function openAncestors(el) {
    let node = el;
    while (node) {
      if (node.tagName === "DETAILS") node.open = true;
      node = node.parentElement;
    }
  }

  function find(spec = {}) {
    let el = null;
    if (spec.selector) {
      el = [...document.querySelectorAll(spec.selector)].find(visible) || null;
    }
    if (!el && spec.text) {
      el = exactTextCandidates(spec.text)[0]?.el || null;
    }
    if (!el && spec.label) {
      el = exactTextCandidates(spec.label)[0]?.el || null;
    }
    if (el) openAncestors(el);
    return el;
  }

  const SAFE_OPEN = /^(VER |ABRIR |MOSTRAR |CONSULTAR |EDITAR |PDFS LANCADOS|HISTORICO|CARTEIRA|FILA|REPOSICAO)/;

  function safeActivate(el, label = "") {
    if (!el) return false;
    const text = norm(label || el.textContent || el.getAttribute("aria-label") || "");
    const isSummary = el.tagName === "SUMMARY";
    const isSafeText = SAFE_OPEN.test(text) || /VER DETALHES|ABRIR DOCUMENTO|ABRIR PECA|ABRIR SKU/.test(text);
    if (!isSummary && !isSafeText) return false;
    window.__TRAINING_SAFE_ACTIVATION__ = true;
    try {
      el.click();
      return true;
    } finally {
      setTimeout(() => { window.__TRAINING_SAFE_ACTIVATION__ = false; }, 0);
    }
  }

  function lockUserNavigation() {
    if (document.documentElement.dataset.trainingLocked === "1") return;
    document.documentElement.dataset.trainingLocked = "1";
    const stopScroll = (event) => {
      if (window.__TRAINING_CAMERA_SCROLL__) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      parent.postMessage({ type: "training-user-scroll-blocked" }, "*");
    };
    document.addEventListener("wheel", stopScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", stopScroll, { capture: true, passive: false });

    const guard = (event) => {
      if (window.__TRAINING_SAFE_ACTIVATION__) return;
      const target = event.target;
      if (!target?.closest?.("button,input,select,textarea,form,a,summary,label")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      parent.postMessage({ type: "training-action-blocked" }, "*");
    };
    document.addEventListener("click", guard, true);
    document.addEventListener("submit", guard, true);
  }

  window.GlamoreTrainingBridge = {
    version: "4.0.0",
    find,
    visible,
    safeActivate,
    lockUserNavigation,
    async scrollTo(el) {
      if (!el) return false;
      openAncestors(el);
      window.__TRAINING_CAMERA_SCROLL__ = true;
      try {
        el.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      } finally {
        window.__TRAINING_CAMERA_SCROLL__ = false;
      }
      return true;
    },
    rect(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left:r.left, top:r.top, width:r.width, height:r.height, right:r.right, bottom:r.bottom };
    }
  };

  lockUserNavigation();
  const observer = new MutationObserver(() => lockUserNavigation());
  observer.observe(document.documentElement, { childList:true, subtree:true });
})();