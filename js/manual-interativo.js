import { MANUAL_TOUR, MANUAL_KNOWLEDGE, MANUAL_SOURCE_FILES } from "./manual-conhecimento.js";

const frame = document.getElementById("systemFrame");
const frameStatus = document.getElementById("frameStatus");
const progressBar = document.getElementById("progressBar");
const chapterLabel = document.getElementById("chapterLabel");
const stepCount = document.getElementById("stepCount");
const stepTitle = document.getElementById("stepTitle");
const stepBody = document.getElementById("stepBody");
const stepSource = document.getElementById("stepSource");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const playBtn = document.getElementById("playBtn");
const speedSelect = document.getElementById("speedSelect");
const toggleVoiceBtn = document.getElementById("toggleVoiceBtn");
const reloadFrameBtn = document.getElementById("reloadFrameBtn");
const mapDialog = document.getElementById("mapDialog");
const mapContent = document.getElementById("mapContent");
const qaForm = document.getElementById("qaForm");
const qaInput = document.getElementById("qaInput");
const qaMessages = document.getElementById("qaMessages");
const quickQuestions = document.getElementById("quickQuestions");

let stepIndex = 0;
let playing = false;
let playTimer = null;
let voiceEnabled = false;
let currentPage = "../index.html";
let sourceIndexPromise = null;

const normalize = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const escapeHtml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setFrameUrl(step) {
  if (step.page) {
    const next = step.page;
    if (currentPage !== next) {
      currentPage = next;
      frame.src = `../${next}?manual=1`;
      return true;
    }
    return false;
  }

  const route = step.route || "dashboard";
  if (currentPage !== "../index.html") {
    currentPage = "../index.html";
    frame.src = `../index.html?manual=1#/${route}`;
    return true;
  }

  try {
    const currentHash = frame.contentWindow?.location?.hash || "";
    const nextHash = `#/${route}`;
    if (currentHash !== nextHash) {
      frame.contentWindow.location.hash = nextHash;
      return true;
    }
  } catch (_) {
    frame.src = `../index.html?manual=1#/${route}`;
    return true;
  }
  return false;
}

function visibleElement(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function findByText(doc, text) {
  const wanted = normalize(text);
  if (!wanted) return null;
  const selectors = "h1,h2,h3,h4,summary,label,button,a,strong,span,p,small,legend,th,td";
  const candidates = [...doc.querySelectorAll(selectors)].filter(visibleElement);
  return candidates.find((el) => normalize(el.textContent) === wanted)
    || candidates.find((el) => normalize(el.textContent).startsWith(wanted))
    || candidates.find((el) => normalize(el.textContent).includes(wanted));
}


function installReadOnlyTrainingGuard(doc) {
  if (!doc || doc.getElementById("manual-training-readonly-guard")) return;

  const style = doc.createElement("style");
  style.id = "manual-training-readonly-guard";
  style.textContent = `
    html::after{
      content:"TREINAMENTO · VISUALIZAÇÃO SOMENTE";
      position:fixed;right:12px;top:12px;z-index:2147483646;
      background:#142036;color:#fff;border:1px solid #d6ad4e;
      border-radius:999px;padding:7px 11px;
      font:800 11px/1 Arial,sans-serif;
      box-shadow:0 8px 25px rgba(0,0,0,.28);
      pointer-events:none;
    }
  `;
  doc.head.appendChild(style);

  const stop = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    frameStatus.textContent = "Modo treinamento: ações operacionais ficam bloqueadas.";
    return false;
  };

  doc.addEventListener("submit", stop, true);
  doc.addEventListener("click", stop, true);
  doc.addEventListener("dblclick", stop, true);
  doc.addEventListener("pointerdown", stop, true);
  doc.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) stop(event);
  }, true);
}

function installHighlightStyle(doc) {
  if (doc.getElementById("manual-tour-highlight-style")) return;
  const style = doc.createElement("style");
  style.id = "manual-tour-highlight-style";
  style.textContent = `
    [data-manual-tour-highlight="true"]{
      position:relative!important;
      z-index:2147483000!important;
      outline:4px solid #e4b547!important;
      outline-offset:5px!important;
      border-radius:10px!important;
      box-shadow:0 0 0 9999px rgba(5,10,18,.28),0 0 0 9px rgba(228,181,71,.22)!important;
      animation:manualTourPulse 1.35s ease-in-out infinite alternate!important;
    }
    @keyframes manualTourPulse{from{outline-color:#c38d18}to{outline-color:#f6d77e}}
    #manual-tour-label{
      position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;
      max-width:min(760px,88vw);padding:9px 13px;border-radius:999px;background:#101a2b;color:white;
      font:700 12px/1.25 Arial,sans-serif;box-shadow:0 9px 35px rgba(0,0,0,.35);pointer-events:none;text-align:center
    }
  `;
  doc.head.appendChild(style);
}

function clearHighlight(doc) {
  doc.querySelectorAll('[data-manual-tour-highlight="true"]').forEach((el) => {
    el.removeAttribute("data-manual-tour-highlight");
  });
  doc.getElementById("manual-tour-label")?.remove();
}

async function highlightStep(step, retries = 24) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.body) throw new Error("Tela ainda não disponível");
      installReadOnlyTrainingGuard(doc);
      installHighlightStyle(doc);
      clearHighlight(doc);

      let target = null;
      if (step.target?.selector) {
        target = [...doc.querySelectorAll(step.target.selector)].find(visibleElement) || null;
      }
      if (!target && step.target?.text) target = findByText(doc, step.target.text);
      if (!target) {
        target = doc.querySelector("main.main, #app, body");
      }
      if (target) {
        target.setAttribute("data-manual-tour-highlight", "true");
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        const label = doc.createElement("div");
        label.id = "manual-tour-label";
        label.textContent = `${step.chapter} · ${step.title}`;
        doc.body.appendChild(label);
        frameStatus.textContent = `Mostrando: ${step.title}`;
        return true;
      }
    } catch (_) {
      // O iframe pode estar entre uma troca de rota e outra.
    }
    await wait(180);
  }
  frameStatus.textContent = "A tela real foi aberta; o elemento específico não existe neste perfil ou conjunto de dados.";
  return false;
}

function speakStep(step) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`${step.title}. ${step.body}`);
  utterance.lang = "pt-BR";
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

function currentStep() {
  return MANUAL_TOUR[stepIndex] || MANUAL_TOUR[0];
}

async function showStep(index, { fromPlay = false } = {}) {
  stepIndex = Math.max(0, Math.min(MANUAL_TOUR.length - 1, Number(index) || 0));
  const step = currentStep();
  const pageChanged = setFrameUrl(step);

  chapterLabel.textContent = step.chapter;
  stepCount.textContent = `${stepIndex + 1} / ${MANUAL_TOUR.length}`;
  stepTitle.textContent = step.title;
  stepBody.innerHTML = `<p>${escapeHtml(step.body)}</p>`;
  stepSource.textContent = step.page
    ? `Tela real: ${step.page}`
    : `Tela real: sistema oficial #/${step.route || "dashboard"}`;
  progressBar.style.width = `${((stepIndex + 1) / MANUAL_TOUR.length) * 100}%`;
  prevBtn.disabled = stepIndex === 0;
  nextBtn.disabled = stepIndex === MANUAL_TOUR.length - 1;
  updateMapActive();

  if (pageChanged) {
    frameStatus.textContent = "Abrindo a tela real...";
    await wait(800);
  } else {
    await wait(280);
  }
  await highlightStep(step);
  speakStep(step);

  if (playing && fromPlay) scheduleNext();
}

function scheduleNext() {
  clearTimeout(playTimer);
  if (!playing) return;
  if (stepIndex >= MANUAL_TOUR.length - 1) {
    stopPlay();
    return;
  }
  const baseSeconds = Number(currentStep().duration || 8);
  const multiplier = Number(speedSelect.value || 1);
  playTimer = setTimeout(() => showStep(stepIndex + 1, { fromPlay: true }), baseSeconds * multiplier * 1000);
}

function startPlay() {
  playing = true;
  playBtn.textContent = "⏸ Pausar";
  playBtn.setAttribute("aria-pressed", "true");
  scheduleNext();
}

function stopPlay() {
  playing = false;
  clearTimeout(playTimer);
  playBtn.textContent = "▶ Play";
  playBtn.setAttribute("aria-pressed", "false");
}

function renderMap() {
  const chapters = new Map();
  MANUAL_TOUR.forEach((step, index) => {
    if (!chapters.has(step.chapter)) chapters.set(step.chapter, []);
    chapters.get(step.chapter).push({ ...step, index });
  });
  mapContent.innerHTML = [...chapters.entries()].map(([chapter, steps]) => `
    <section class="map-chapter">
      <h2>${escapeHtml(chapter)}</h2>
      <div class="map-steps">
        ${steps.map((step) => `<button type="button" class="map-step" data-step-index="${step.index}"><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.page || `#/${step.route || "dashboard"}`)}</small></button>`).join("")}
      </div>
    </section>
  `).join("");
  mapContent.querySelectorAll("[data-step-index]").forEach((button) => {
    button.addEventListener("click", () => {
      stopPlay();
      mapDialog.close();
      showStep(Number(button.dataset.stepIndex));
    });
  });
}

function updateMapActive() {
  mapContent.querySelectorAll(".map-step").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.stepIndex) === stepIndex);
  });
}

function tokens(text) {
  const stop = new Set(["COMO","QUE","PARA","POR","UMA","UM","DO","DA","DOS","DAS","E","O","A","OS","AS","NO","NA","NOS","NAS","DE","EM","EU","ME","MEU","MINHA","FUNCIONA","FUNCIONAR","SISTEMA"]);
  return normalize(text).split(" ").filter((token) => token.length >= 3 && !stop.has(token));
}

function scoreKnowledge(entry, question) {
  const qNorm = normalize(question);
  const qTokens = tokens(question);
  const title = normalize(entry.title);
  const keys = (entry.keywords || []).map(normalize);
  const answer = normalize(entry.answer);
  let score = 0;
  keys.forEach((keyword) => {
    if (qNorm.includes(keyword)) score += 13 + Math.min(8, keyword.split(" ").length * 2);
  });
  qTokens.forEach((token) => {
    if (title.includes(token)) score += 6;
    if (keys.some((keyword) => keyword.includes(token))) score += 5;
    if (answer.includes(token)) score += 1;
  });
  if (title && qNorm.includes(title)) score += 12;
  return score;
}

async function buildSourceIndex() {
  const rows = [];
  await Promise.all(MANUAL_SOURCE_FILES.map(async (file) => {
    try {
      const response = await fetch(`../${file}?manualSource=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const text = await response.text();
      text.split(/\r?\n/).forEach((line, index) => {
        const normalized = normalize(line);
        if (normalized.length >= 8) rows.push({ file, line: index + 1, text: line.trim(), normalized });
      });
    } catch (_) {
      // Arquivo opcional ou bloqueado pelo ambiente.
    }
  }));
  return rows;
}

function sourceIndex() {
  if (!sourceIndexPromise) sourceIndexPromise = buildSourceIndex();
  return sourceIndexPromise;
}

async function searchSources(question, max = 5) {
  const qTokens = tokens(question);
  if (!qTokens.length) return [];
  const rows = await sourceIndex();
  return rows.map((row) => {
    let score = 0;
    qTokens.forEach((token) => {
      if (row.normalized.includes(token)) score += token.length >= 7 ? 4 : 2;
    });
    if (row.normalized.includes(normalize(question))) score += 10;
    return { ...row, score };
  }).filter((row) => row.score > 0 && row.text.length < 520)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

function addMessage(type, html) {
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.innerHTML = html;
  qaMessages.appendChild(message);
  qaMessages.scrollTop = qaMessages.scrollHeight;
  return message;
}

async function answerQuestion(question) {
  const ranked = MANUAL_KNOWLEDGE.map((entry) => ({ entry, score: scoreKnowledge(entry, question) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const sourceMatches = await searchSources(question, 4);

  if (!best || best.score < 4) {
    const evidence = sourceMatches.length
      ? `<div class="sources"><strong>Trechos mais próximos encontrados:</strong><ul>${sourceMatches.map((row) => `<li><code>${escapeHtml(row.file)}:${row.line}</code> — ${escapeHtml(row.text.slice(0, 220))}</li>`).join("")}</ul></div>`
      : `<div class="sources">Nenhum trecho suficientemente relacionado foi localizado nos arquivos indexados.</div>`;
    addMessage("assistant", `<h3>Não há resposta segura fechada para essa pergunta</h3><p>Não vou completar com suposição. Reformule usando o nome da tela, botão, coleção, regra ou fluxo. Abaixo estão as evidências mais próximas do código.</p>${evidence}`);
    return;
  }

  const { entry } = best;
  const evidence = sourceMatches.length
    ? `<details><summary>Ver evidências adicionais encontradas no código</summary><ul>${sourceMatches.map((row) => `<li><code>${escapeHtml(row.file)}:${row.line}</code> — ${escapeHtml(row.text.slice(0, 240))}</li>`).join("")}</ul></details>`
    : "";
  const sources = `<div class="sources"><strong>Fontes declaradas:</strong> ${(entry.sources || []).map(escapeHtml).join(" · ")}${evidence}</div>`;
  const button = entry.step || entry.route || entry.page
    ? `<div class="answer-actions"><button type="button" data-show-entry="${escapeHtml(entry.id)}">Mostrar na tela real</button></div>`
    : "";
  const message = addMessage("assistant", `<h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.answer)}</p>${sources}${button}`);
  message.querySelector("[data-show-entry]")?.addEventListener("click", () => showKnowledgeEntry(entry));
}

function showKnowledgeEntry(entry) {
  stopPlay();
  let index = entry.step ? MANUAL_TOUR.findIndex((step) => step.id === entry.step) : -1;
  if (index < 0 && entry.page) index = MANUAL_TOUR.findIndex((step) => step.page === entry.page);
  if (index < 0 && entry.route) index = MANUAL_TOUR.findIndex((step) => step.route === entry.route);
  showStep(index >= 0 ? index : 0);
}

function renderQuickQuestions() {
  const questions = [
    "Como o sistema separa quantidade e peso?",
    "Por que produção aprovada não cria ordem de produção?",
    "Como funciona o estorno de inventário?",
    "Como uma produção pronta atende uma venda pendente?",
    "O que fica registrado na auditoria?",
    "Como o sistema evita PDF duplicado?"
  ];
  quickQuestions.innerHTML = questions.map((question) => `<button type="button">${escapeHtml(question)}</button>`).join("");
  [...quickQuestions.querySelectorAll("button")].forEach((button) => {
    button.addEventListener("click", () => {
      qaInput.value = button.textContent;
      qaInput.focus();
    });
  });
}

prevBtn.addEventListener("click", () => { stopPlay(); showStep(stepIndex - 1); });
nextBtn.addEventListener("click", () => { stopPlay(); showStep(stepIndex + 1); });
playBtn.addEventListener("click", () => playing ? stopPlay() : startPlay());
speedSelect.addEventListener("change", () => { if (playing) scheduleNext(); });

toggleVoiceBtn.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  toggleVoiceBtn.setAttribute("aria-pressed", String(voiceEnabled));
  toggleVoiceBtn.textContent = `Narração: ${voiceEnabled ? "ligada" : "desligada"}`;
  if (!voiceEnabled && "speechSynthesis" in window) speechSynthesis.cancel();
  if (voiceEnabled) speakStep(currentStep());
});

reloadFrameBtn.addEventListener("click", () => {
  try { frame.contentWindow.location.reload(); }
  catch (_) { frame.src = frame.src; }
});

document.getElementById("toggleMapBtn").addEventListener("click", () => mapDialog.showModal());
document.getElementById("closeMapBtn").addEventListener("click", () => mapDialog.close());
mapDialog.addEventListener("click", (event) => {
  if (event.target === mapDialog) mapDialog.close();
});

document.getElementById("clearChatBtn").addEventListener("click", () => {
  qaMessages.innerHTML = '<div class="message system">Conversa limpa. As respostas continuam limitadas às evidências do projeto.</div>';
});

qaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = qaInput.value.trim();
  if (!question) return;
  addMessage("user", escapeHtml(question));
  qaInput.value = "";
  const pending = addMessage("assistant", "Consultando a base de conhecimento e os arquivos reais...");
  try {
    await answerQuestion(question);
  } finally {
    pending.remove();
  }
});

frame.addEventListener("load", async () => {
  frameStatus.textContent = "Tela real carregada.";
  await wait(300);
  highlightStep(currentStep(), 16);
});

window.addEventListener("beforeunload", () => {
  stopPlay();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
});

renderMap();
renderQuickQuestions();
showStep(0);
