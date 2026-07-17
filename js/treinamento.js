import { MANUAL_TOUR, MANUAL_KNOWLEDGE, MANUAL_SOURCE_FILES, TRAINING_TRACKS } from "./conhecimento.js";
import { LESSON_DETAILS } from "./explicacoes.js";
import { synchronizedTargetsFor } from "./roteiro-sincronizado.js";

const $ = (id) => document.getElementById(id);
const frame = $("systemFrame");
const frameStatus = $("frameStatus");
const progressBar = $("progressBar");
const chapterLabel = $("chapterLabel");
const stepCount = $("stepCount");
const stepTitle = $("stepTitle");
const lessonLead = $("lessonLead");
const lessonUser = $("lessonUser");
const lessonSystem = $("lessonSystem");
const lessonResult = $("lessonResult");
const lessonAttention = $("lessonAttention");
const lessonAudit = $("lessonAudit");
const stepBody = $("stepBody");
const stepSource = $("stepSource");
const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");
const playBtn = $("playBtn");
const speedSelect = $("speedSelect");
const voiceBtn = $("voiceBtn");
const reloadBtn = $("reloadBtn");
const roleSelect = $("roleSelect");
const trackDialog = $("trackDialog");
const trackGrid = $("trackGrid");
const mapDialog = $("mapDialog");
const mapContent = $("mapContent");
const qaForm = $("qaForm");
const qaInput = $("qaInput");
const qaMessages = $("qaMessages");
const quickQuestions = $("quickQuestions");
const simCursor = $("simCursor");
const showTargetBtn = $("showTargetBtn");
const stageLessonTitle = $("stageLessonTitle");
const stageCaptionTitle = $("stageCaptionTitle");
const stageCaptionText = $("stageCaptionText");
const lessonTabBtn = $("lessonTabBtn");
const qaTabBtn = $("qaTabBtn");
const lessonPanel = $("lessonPanel");
const qaPanel = $("qaPanel");
const cueCount = $("cueCount");
const spokenNow = $("spokenNow");
const syncNow = $("syncNow");
const repeatCueBtn = $("repeatCueBtn");
const lessonCards = document.querySelector(".lesson-cards");
const stageCard = document.querySelector(".stage-card");

let activeTrack = null;
let steps = [];
let index = 0;
let playing = false;
let timer = null;
let voice = localStorage.getItem("glamore.training.voice") !== "off";
let currentPage = "index.html";
let sourceIndexPromise = null;
let lastTarget = null;
let lastContextKey = "";
let cueIndex = 0;
let currentCues = [];
let playbackToken = 0;
let activeUtterance = null;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function visible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = element.ownerDocument.defaultView.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function findByText(doc, text) {
  const wanted = normalize(text);
  const candidates = [...doc.querySelectorAll("h1,h2,h3,h4,summary,label,button,a,strong,span,p,small,legend,th,td")]
    .filter(visible);

  return candidates.find((element) => normalize(element.textContent) === wanted)
    || candidates.find((element) => normalize(element.textContent).startsWith(wanted))
    || candidates.find((element) => normalize(element.textContent).includes(wanted));
}

function frameDoc() {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

function clearTarget() {
  const doc = frameDoc();
  doc?.querySelectorAll(".training-highlight").forEach((element) => element.classList.remove("training-highlight"));
  simCursor.classList.remove("active");
  lastTarget = null;
}

function installGuard(doc) {
  if (!doc || doc.__trainingGuard) return;
  doc.__trainingGuard = true;

  const guard = (event) => {
    const target = event.target;
    if (target?.closest?.("summary,[data-open-section]")) return;
    if (target?.closest?.("a[href^='#/']")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      frameStatus.textContent = "Use os botões Próximo e Voltar para seguir a aula.";
      return;
    }
    if (target?.closest?.("button,input,select,textarea,form,label,a")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      frameStatus.textContent = "Demonstração segura: a ação foi mostrada, mas não foi executada.";
    }
  };

  doc.addEventListener("click", guard, true);
  doc.addEventListener("submit", guard, true);
  doc.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target?.closest?.("button,input,select,textarea,form,a")) {
      guard(event);
    }
  }, true);
}

function roleForStep(step) {
  if (step.id === "login") return { loggedOut: true };
  return { loggedOut: false, role: activeTrack?.role || roleSelect.value || "dono" };
}

function applyContext(step) {
  const context = roleForStep(step);
  if (context.role) localStorage.setItem("glamore.training.role", context.role);
  localStorage.setItem("glamore.training.loggedOut", context.loggedOut ? "true" : "false");
  roleSelect.value = context.role || roleSelect.value;
}

function pageUrl(step) {
  if (step.page) return `./sistema/${step.page}`;
  return `./sistema/index.html#/${step.route || "dashboard"}`;
}

async function setFrame(step) {
  applyContext(step);
  const contextKey = `${localStorage.getItem("glamore.training.role") || "dono"}|${localStorage.getItem("glamore.training.loggedOut") || "false"}`;
  const nextPage = step.page || "index.html";
  let changed = false;

  if (contextKey !== lastContextKey) {
    lastContextKey = contextKey;
    currentPage = nextPage;
    frame.src = pageUrl(step);
    changed = true;
  } else if (currentPage !== nextPage) {
    currentPage = nextPage;
    frame.src = pageUrl(step);
    changed = true;
  } else if (step.page) {
    frame.src = pageUrl(step);
    changed = true;
  } else {
    try {
      const wanted = `#/${step.route || "dashboard"}`;
      if (frame.contentWindow.location.hash !== wanted) {
        frame.contentWindow.location.hash = wanted;
        changed = true;
      }
    } catch {
      frame.src = pageUrl(step);
      changed = true;
    }
  }

  if (changed) {
    frameStatus.textContent = "Abrindo a tela da aula...";
    await sleep(700);
  }

  return changed;
}

async function waitDoc() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const doc = frameDoc();
    if (doc?.body && doc.readyState !== "loading") {
      installGuard(doc);
      return doc;
    }
    await sleep(120);
  }
  return null;
}

async function moveCursor(target) {
  if (!target) return;
  const frameRect = frame.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const stageRect = $("stageViewport").getBoundingClientRect();

  const x = frameRect.left - stageRect.left + targetRect.left
    + Math.min(targetRect.width * 0.55, Math.max(18, targetRect.width - 18));
  const y = frameRect.top - stageRect.top + targetRect.top
    + Math.min(targetRect.height * 0.55, Math.max(18, targetRect.height - 18));

  simCursor.style.left = `${x}px`;
  simCursor.style.top = `${y}px`;
  simCursor.classList.add("active");
  await sleep(720);
}

async function cursorClick() {
  simCursor.classList.add("clicking");
  await sleep(140);
  simCursor.classList.remove("clicking");
}

function targetLabel(target = {}) {
  return target.label || target.text || (target.selector ? "área indicada" : "item da aula");
}

function resolveCueTarget(doc, step, cue) {
  const candidates = [cue?.target, step?.target].filter(Boolean);
  for (const spec of candidates) {
    let target = null;
    if (spec.selector) target = [...doc.querySelectorAll(spec.selector)].find(visible) || null;
    if (!target && spec.text) target = findByText(doc, spec.text);
    if (target) return target;
  }
  return doc.querySelector("main.main,#app,body");
}

async function focusCue(step, cue, { animateClick = false } = {}) {
  const doc = await waitDoc();
  if (!doc) {
    frameStatus.textContent = "Não foi possível carregar a tela demonstrativa.";
    return false;
  }

  clearTarget();
  const target = resolveCueTarget(doc, step, cue);
  if (!target) {
    frameStatus.textContent = "O item desta frase não foi localizado. A aula foi pausada para não mostrar algo errado.";
    return false;
  }

  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  await sleep(520);
  target.classList.add("training-highlight");
  lastTarget = target;
  await moveCursor(target);
  if (animateClick) await cursorClick();

  frameStatus.textContent = `Agora observe: ${targetLabel(cue?.target || step.target)}.`;
  stageCaptionTitle.textContent = step.title;
  stageCaptionText.textContent = cue?.text || "O item citado está destacado exatamente durante esta frase.";
  return true;
}

function current() {
  return steps[index] || steps[0];
}

function detailFor(step) {
  return LESSON_DETAILS[step.id] || {
    simple: step.body,
    user: "Observe o item destacado e siga a orientação da aula.",
    system: step.body,
    result: "A função é apresentada sem alterar dados reais.",
    attention: "Use o sistema oficial somente depois de compreender a etapa.",
    audit: "A demonstração não grava no Firebase oficial."
  };
}

function cueSectionElement(section) {
  if (section === "lead") return lessonLead;
  if (section === "user") return document.querySelector(".action-card");
  if (section === "system") return document.querySelector(".system-card");
  if (section === "result") return document.querySelector(".result-card");
  if (section === "attention") return document.querySelector(".attention-card");
  if (section === "audit") return document.querySelector(".technical-details");
  return null;
}

function clearActiveLessonSection() {
  document.querySelectorAll(".cue-active").forEach((element) => element.classList.remove("cue-active"));
  lessonCards?.classList.remove("has-active");
}

function activateLessonSection(section) {
  clearActiveLessonSection();
  const element = cueSectionElement(section);
  if (element) {
    element.classList.add("cue-active");
    if (element.classList.contains("lesson-card")) lessonCards?.classList.add("has-active");
  }
}

function buildCues(step) {
  const detail = detailFor(step);
  const targets = synchronizedTargetsFor(step);
  const cues = [];

  targets.forEach((target, position) => {
    cues.push({
      target,
      text: target.say || `Observe ${targetLabel(target)}.`,
      section: position === 0 ? "lead" : "user",
      click: Boolean(target.click)
    });
  });

  cues.push({
    target: targets[targets.length - 1] || step.target,
    text: `O que o sistema faz: ${detail.system}`,
    section: "system"
  });
  cues.push({
    target: targets[targets.length - 1] || step.target,
    text: `Resultado esperado: ${detail.result}`,
    section: "result"
  });
  cues.push({
    target: targets[0] || step.target,
    text: `Atenção: ${detail.attention}`,
    section: "attention"
  });

  return cues.filter((cue) => String(cue.text || "").trim());
}

function updateCueUi(step, cue, position) {
  cueIndex = position;
  cueCount.textContent = `cena ${position + 1} / ${currentCues.length}`;
  spokenNow.textContent = cue.text;
  syncNow.classList.remove("waiting", "paused");
  activateLessonSection(cue.section);
  stageCaptionTitle.textContent = targetLabel(cue.target || step.target);
  stageCaptionText.textContent = cue.text;
}

function speechRate() {
  return Number(speedSelect.value || 1);
}

function visualWaitMs(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2400, Math.ceil(words / 2.8) * 1000 / speechRate());
}

function speakAndWait(text, token) {
  if (!voice || !("speechSynthesis" in window)) {
    return new Promise((resolve) => {
      const started = Date.now();
      const tick = () => {
        if (token !== playbackToken || !playing) return resolve(false);
        if (Date.now() - started >= visualWaitMs(text)) return resolve(true);
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  return new Promise((resolve) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    activeUtterance = utterance;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safetyTimer);
      resolve(token === playbackToken && playing);
    };
    const safetyTimer = setTimeout(finish, Math.max(12000, visualWaitMs(text) * 2.2));
    utterance.lang = "pt-BR";
    utterance.rate = speechRate();
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = finish;
    utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  });
}

async function presentCue(step, position, token, { narrate = true } = {}) {
  if (token !== playbackToken) return false;
  const cue = currentCues[position];
  if (!cue) return false;

  updateCueUi(step, cue, position);
  syncNow.classList.add("waiting");
  spokenNow.textContent = "Localizando o item correto na tela...";

  const focused = await focusCue(step, cue);
  if (!focused || token !== playbackToken) return false;

  syncNow.classList.remove("waiting");
  spokenNow.textContent = cue.text;
  stageCard?.classList.add("sync-speaking");

  let clickTimer = null;
  if (cue.click && narrate) clickTimer = setTimeout(() => cursorClick(), 420);
  const completed = narrate ? await speakAndWait(cue.text, token) : true;
  if (clickTimer) clearTimeout(clickTimer);
  stageCard?.classList.remove("sync-speaking");
  return completed;
}

function cancelPlayback({ paused = false } = {}) {
  playbackToken += 1;
  clearTimeout(timer);
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  activeUtterance = null;
  stageCard?.classList.remove("sync-speaking");
  stageCard?.classList.toggle("sync-paused", paused);
  if (paused) {
    syncNow.classList.add("paused");
    spokenNow.textContent = `Pausado nesta frase: ${currentCues[cueIndex]?.text || ""}`;
  }
}

function saveProgress() {
  if (!activeTrack) return;
  localStorage.setItem(`glamore.training.progress.${activeTrack.id}`, String(index));
}

function activateTab(name) {
  const lessonActive = name === "lesson";
  lessonTabBtn.classList.toggle("active", lessonActive);
  qaTabBtn.classList.toggle("active", !lessonActive);
  lessonTabBtn.setAttribute("aria-selected", String(lessonActive));
  qaTabBtn.setAttribute("aria-selected", String(!lessonActive));
  lessonPanel.hidden = !lessonActive;
  qaPanel.hidden = lessonActive;
}

function renderLesson(step) {
  const detail = detailFor(step);
  chapterLabel.textContent = step.chapter;
  stepCount.textContent = `${index + 1} / ${steps.length}`;
  stepTitle.textContent = step.title;
  lessonLead.textContent = detail.simple;
  lessonUser.textContent = detail.user;
  lessonSystem.textContent = detail.system;
  lessonResult.textContent = detail.result;
  lessonAttention.textContent = detail.attention;
  lessonAudit.textContent = detail.audit;
  stepBody.textContent = step.body;
  stepSource.textContent = step.page
    ? `Tela demonstrada: ${step.page}`
    : `Tela demonstrada: ${step.route || "dashboard"}`;
  progressBar.style.width = `${((index + 1) / steps.length) * 100}%`;
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === steps.length - 1;
  stageLessonTitle.textContent = step.title;
  stageCaptionTitle.textContent = step.title;
  stageCaptionText.textContent = "A narração só começa depois que o item correto estiver destacado.";
  currentCues = buildCues(step);
  cueIndex = 0;
  cueCount.textContent = `cena 1 / ${currentCues.length}`;
  spokenNow.textContent = "Pressione Iniciar aula. O sistema avançará frase por frase, sem correr na frente do áudio.";
  clearActiveLessonSection();
}

async function showStep(next, { keepTab = false, previewCue = false } = {}) {
  if (!steps.length) return;
  cancelPlayback();
  playing = false;
  playBtn.textContent = "▶ Iniciar aula";
  playBtn.setAttribute("aria-pressed", "false");

  index = Math.max(0, Math.min(steps.length - 1, Number(next) || 0));
  const step = current();
  if (!keepTab) activateTab("lesson");
  renderLesson(step);
  renderMap();
  saveProgress();
  lessonPanel.scrollTop = 0;
  clearTarget();
  frameStatus.textContent = "Aguardando Play. Nenhum item será destacado antes da frase correspondente.";

  await setFrame(step);
  if (previewCue && currentCues[0]) {
    const token = playbackToken;
    await presentCue(step, 0, token, { narrate: false });
    spokenNow.textContent = "Item inicial preparado. Pressione Iniciar aula para acompanhar a explicação sincronizada.";
  }
}

async function runSynchronizedLesson(startCue = cueIndex) {
  if (!steps.length) return;
  const token = ++playbackToken;
  const step = current();
  playing = true;
  stageCard?.classList.remove("sync-paused");
  activateTab("lesson");
  playBtn.textContent = "Ⅱ Pausar";
  playBtn.setAttribute("aria-pressed", "true");

  await setFrame(step);
  for (let position = startCue; position < currentCues.length; position += 1) {
    if (!playing || token !== playbackToken) return;
    const completed = await presentCue(step, position, token, { narrate: true });
    if (!completed || !playing || token !== playbackToken) return;
    await sleep(320);
  }

  if (!playing || token !== playbackToken) return;
  if (index >= steps.length - 1) {
    stop();
    spokenNow.textContent = "Trilha concluída. Use o mapa para rever uma função ou faça uma pergunta.";
    return;
  }

  index += 1;
  const nextStep = current();
  renderLesson(nextStep);
  renderMap();
  saveProgress();
  lessonPanel.scrollTop = 0;
  clearTarget();
  frameStatus.textContent = "Preparando a próxima aula. O áudio ainda não começou.";
  await setFrame(nextStep);
  cueIndex = 0;
  await runSynchronizedLesson(0);
}

function play() {
  if (playing) return;
  runSynchronizedLesson(cueIndex);
}

function stop() {
  const wasPlaying = playing;
  playing = false;
  cancelPlayback({ paused: wasPlaying });
  playBtn.textContent = "▶ Continuar";
  playBtn.setAttribute("aria-pressed", "false");
}

function resolveTrack(track) {
  if (track.steps === "ALL") return [...MANUAL_TOUR];
  if (Array.isArray(track.steps)) {
    return track.steps.map((id) => MANUAL_TOUR.find((step) => step.id === id)).filter(Boolean);
  }
  if (track.chapters) return MANUAL_TOUR.filter((step) => track.chapters.includes(step.chapter));
  return [...MANUAL_TOUR];
}

function selectTrack(trackId) {
  activeTrack = TRAINING_TRACKS.find((track) => track.id === trackId) || TRAINING_TRACKS[0];
  steps = resolveTrack(activeTrack);
  localStorage.setItem("glamore.training.track", activeTrack.id);
  roleSelect.value = activeTrack.role || "dono";
  localStorage.setItem("glamore.training.role", roleSelect.value);
  localStorage.removeItem("glamore.training.loggedOut");

  index = Math.min(
    Number(localStorage.getItem(`glamore.training.progress.${activeTrack.id}`) || 0),
    steps.length - 1
  );

  if (trackDialog.open) trackDialog.close();
  stop();
  showStep(index);
}

function renderTracks() {
  trackGrid.innerHTML = TRAINING_TRACKS.map((track) => {
    const count = resolveTrack(track).length;
    const minutes = Math.max(3, Math.ceil(count * 1.15));
    return `<button class="track-card" data-track="${escapeHtml(track.id)}">
      <span class="icon">${escapeHtml(track.icon)}</span>
      <strong>${escapeHtml(track.title)}</strong>
      <span>${escapeHtml(track.subtitle)}</span>
      <em>${count} aulas · aproximadamente ${minutes} min</em>
    </button>`;
  }).join("");

  trackGrid.querySelectorAll("[data-track]").forEach((button) => {
    button.addEventListener("click", () => selectTrack(button.dataset.track));
  });
}

function renderMap() {
  if (!steps.length) return;
  mapContent.innerHTML = steps.map((step, position) => `
    <button class="map-step ${position === index ? "active" : ""}" data-step="${position}">
      <small>${escapeHtml(step.chapter)} · aula ${position + 1}</small>
      <strong>${escapeHtml(step.title)}</strong>
    </button>
  `).join("");

  mapContent.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      mapDialog.close();
      stop();
      showStep(Number(button.dataset.step));
    });
  });
}

function tokens(text) {
  return new Set(normalize(text).split(" ").filter((word) => word.length > 2));
}

function scoreKnowledge(question, item) {
  const questionTokens = tokens(question);
  const title = normalize(item.title);
  const keywords = (item.keywords || []).map(normalize);
  const answer = normalize(item.answer);
  let score = 0;

  for (const word of questionTokens) {
    if (title.includes(word)) score += 5;
    if (keywords.some((keyword) => keyword.includes(word))) score += 4;
    if (answer.includes(word)) score += 1;
  }

  const normalizedQuestion = normalize(question);
  if (keywords.some((keyword) => normalizedQuestion.includes(keyword) || keyword.includes(normalizedQuestion))) {
    score += 10;
  }

  return score;
}

async function sourceIndex() {
  if (sourceIndexPromise) return sourceIndexPromise;

  sourceIndexPromise = (async () => {
    const rows = [];

    for (const file of MANUAL_SOURCE_FILES) {
      try {
        const response = await fetch(`./fontes/${file}`);
        if (!response.ok) continue;
        const text = await response.text();
        const clean = text.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "[imagem omitida]");
        const lines = clean.split(/\r?\n/);

        for (let line = 0; line < lines.length; line += 18) {
          const chunk = lines.slice(line, line + 24).join("\n").trim();
          if (chunk.length > 80) {
            rows.push({ file, line: line + 1, text: chunk, norm: normalize(chunk) });
          }
        }
      } catch {
        // Fonte indisponível: as demais continuam sendo pesquisadas.
      }
    }

    return rows;
  })();

  return sourceIndexPromise;
}

function addMessage(className, html) {
  const div = document.createElement("div");
  div.className = className;
  div.innerHTML = html;
  qaMessages.appendChild(div);
  qaMessages.scrollTop = qaMessages.scrollHeight;
}

async function answerQuestion(question) {
  activateTab("qa");
  addMessage("qa-user", escapeHtml(question));

  const ranked = MANUAL_KNOWLEDGE
    .map((item) => ({ item, score: scoreKnowledge(question, item) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (best && best.score >= 5) {
    const item = best.item;
    addMessage("qa-answer", `
      <h3>${escapeHtml(item.title)}</h3>
      <div>${escapeHtml(item.answer)}</div>
      <div class="answer-sources"><strong>Fontes:</strong> ${(item.sources || []).map(escapeHtml).join(" · ")}</div>
      <button data-answer-step="${escapeHtml(item.step || "")}">Mostrar esta função na tela</button>
    `);

    qaMessages.querySelectorAll("[data-answer-step]").forEach((button) => {
      button.onclick = () => {
        const id = button.dataset.answerStep;
        let position = steps.findIndex((step) => step.id === id);

        if (position < 0) {
          const source = MANUAL_TOUR.find((step) => step.id === id);
          if (source) {
            steps = [source];
            position = 0;
          }
        }

        if (position >= 0) {
          activateTab("lesson");
          showStep(position);
        }
      };
    });
    return;
  }

  const indexRows = await sourceIndex();
  const questionTokens = [...tokens(question)];
  const matches = indexRows
    .map((row) => ({
      row,
      score: questionTokens.reduce((total, word) => total + (row.norm.includes(word) ? 1 : 0), 0)
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (matches.length) {
    addMessage("qa-answer", `
      <h3>Evidências próximas encontradas</h3>
      <div>Não existe uma resposta preparada suficiente para afirmar isso com segurança. Encontrei estes trechos relacionados:</div>
      <div class="answer-sources">${matches.map((match) =>
        `${escapeHtml(match.row.file)}:${match.row.line} — ${escapeHtml(match.row.text.slice(0, 260))}`
      ).join("<br><br>")}</div>
    `);
  } else {
    addMessage("qa-answer", `
      <h3>Não há evidência segura</h3>
      <div>Não encontrei no código, documentos e testes uma base suficiente para responder sem suposição. Reformule usando o nome da tela, botão, pedido ou operação.</div>
    `);
  }
}

function renderQuickQuestions() {
  const questions = [
    "O que acontece quando falta peça em uma venda?",
    "Quantidade e peso são independentes?",
    "Por que produção aprovada não cria ordem?",
    "Como funciona o estorno de inventário?",
    "Quem pode ver a Auditoria?",
    "Como a produção pronta atende uma venda?"
  ];

  quickQuestions.innerHTML = questions
    .map((question) => `<button>${escapeHtml(question)}</button>`)
    .join("");

  quickQuestions.querySelectorAll("button").forEach((button) => {
    button.onclick = () => {
      qaInput.value = button.textContent;
      answerQuestion(button.textContent);
    };
  });
}

lessonTabBtn.onclick = () => activateTab("lesson");
qaTabBtn.onclick = () => activateTab("qa");

prevBtn.onclick = () => {
  stop();
  showStep(index - 1);
};

nextBtn.onclick = () => {
  stop();
  showStep(index + 1);
};

playBtn.onclick = () => playing ? stop() : play();

$("restartBtn").onclick = () => {
  stop();
  showStep(0);
};

showTargetBtn.onclick = () => presentCue(current(), cueIndex, playbackToken, { narrate: false });

repeatCueBtn.onclick = async () => {
  const wasPlaying = playing;
  const repeatedPosition = cueIndex;
  cancelPlayback();
  playing = true;
  playBtn.textContent = "Ⅱ Pausar";
  const token = ++playbackToken;
  await presentCue(current(), repeatedPosition, token, { narrate: true });
  if (wasPlaying) {
    playing = false;
    if (repeatedPosition + 1 < currentCues.length) {
      runSynchronizedLesson(repeatedPosition + 1);
    } else if (index < steps.length - 1) {
      index += 1;
      renderLesson(current());
      renderMap();
      saveProgress();
      clearTarget();
      await setFrame(current());
      runSynchronizedLesson(0);
    } else {
      stop();
    }
  } else {
    playing = false;
    playBtn.textContent = "▶ Iniciar aula";
    playBtn.setAttribute("aria-pressed", "false");
  }
};

voiceBtn.onclick = () => {
  voice = !voice;
  localStorage.setItem("glamore.training.voice", voice ? "on" : "off");
  voiceBtn.textContent = voice ? "Narração ligada" : "Narração desligada";
  voiceBtn.setAttribute("aria-pressed", String(voice));
  if (!voice && "speechSynthesis" in window) speechSynthesis.cancel();
  if (playing) {
    const resumeCue = cueIndex;
    cancelPlayback();
    playing = false;
    runSynchronizedLesson(resumeCue);
  }
};

reloadBtn.onclick = () => {
  stop();
  frame.src = pageUrl(current());
  setTimeout(() => showStep(index, { keepTab: true, previewCue: false }), 900);
};

roleSelect.onchange = () => {
  stop();
  localStorage.setItem("glamore.training.role", roleSelect.value);
  localStorage.removeItem("glamore.training.loggedOut");
  lastContextKey = "";
  showStep(index, { keepTab: true, previewCue: false });
};

$("chooseTrackBtn").onclick = () => trackDialog.showModal();
$("mapBtn").onclick = () => {
  renderMap();
  mapDialog.showModal();
};

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.onclick = () => button.closest("dialog").close();
});

qaForm.onsubmit = (event) => {
  event.preventDefault();
  const question = qaInput.value.trim();
  if (!question) return;
  qaInput.value = "";
  answerQuestion(question);
};

$("clearQaBtn").onclick = () => {
  qaMessages.innerHTML = '<div class="qa-system">Conversa limpa. Faça uma nova pergunta.</div>';
};

frame.addEventListener("load", () => {
  const doc = frameDoc();
  installGuard(doc);
  frameStatus.textContent = "Tela carregada. O destaque seguirá a narração, sem avançar sozinho.";
});

document.addEventListener("keydown", (event) => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);

  if (event.key === "ArrowRight" && !typing) {
    stop();
    showStep(index + 1);
  }
  if (event.key === "ArrowLeft" && !typing) {
    stop();
    showStep(index - 1);
  }
  if (event.key === "Escape") {
    if (trackDialog.open) trackDialog.close();
    if (mapDialog.open) mapDialog.close();
  }
});

window.__GLAMORE_TRAINING_SYNC__ = {
  version: "3.0.0",
  state: () => ({
    track: activeTrack?.id || "",
    stepId: current()?.id || "",
    stepIndex: index,
    cueIndex,
    cueCount: currentCues.length,
    cueText: currentCues[cueIndex]?.text || "",
    playing,
    voice
  }),
  goToStep: async (stepId) => {
    const position = steps.findIndex((step) => step.id === stepId);
    if (position < 0) return false;
    await showStep(position);
    return true;
  },
  previewCue: async (position) => {
    const safe = Math.max(0, Math.min(currentCues.length - 1, Number(position) || 0));
    await presentCue(current(), safe, playbackToken, { narrate: false });
    return true;
  },
  start: () => play(),
  pause: () => stop(),
  setVoice: (enabled) => {
    voice = Boolean(enabled);
    localStorage.setItem("glamore.training.voice", voice ? "on" : "off");
    voiceBtn.textContent = voice ? "Narração ligada" : "Narração desligada";
    voiceBtn.setAttribute("aria-pressed", String(voice));
  }
};

voiceBtn.textContent = voice ? "Narração ligada" : "Narração desligada";
voiceBtn.setAttribute("aria-pressed", String(voice));
renderTracks();
renderQuickQuestions();
activateTab("lesson");

const savedTrack = localStorage.getItem("glamore.training.track") || "rapido";
selectTrack(savedTrack);

setTimeout(() => {
  if (!localStorage.getItem("glamore.training.v3.welcomed")) {
    localStorage.setItem("glamore.training.v3.welcomed", "1");
    trackDialog.showModal();
  }
}, 450);
