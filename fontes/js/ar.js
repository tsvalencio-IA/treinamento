import { APP_CONFIG } from "./config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const AR_BUILD = "ar-v33-invisible-3d-hand-rig-depth-ready-20260622";
const empresaId = APP_CONFIG?.empresaId || "empresa-principal";
const firebaseConfig = APP_CONFIG?.firebase || APP_CONFIG?.firebaseConfig || {};
const firebaseProjectId = firebaseConfig?.projectId || "";
if (!firebaseProjectId) {
  console.error("Configuração Firebase ausente em APP_CONFIG.firebase ou APP_CONFIG.firebaseConfig.");
}
const app =
  getApps().find((firebaseApp) => firebaseProjectId && firebaseApp?.options?.projectId === firebaseProjectId) ||
  initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const state = {
  user: null,
  perfil: null,
  produtos: [],
  links: [],
  selectedProduct: null,
  currentPublicItem: null,
  tryOn: {
    active: false,
    cameraStream: null,
    handsApi: null,
    loopRunning: false,
    frameBusy: false,
    frameLast: 0,
    landmarks: null,
    finger: "anelar",
    smoothed: null,
    manualMode: false,
    manualOffset: { x: 0, y: 0, scale: 1, rotate: 0, depth: -0.24, pitch: 0, yaw: 0, seat: 0.38, occlusion: 1 },
    calibration: null,
    locked: false,
    trackingState: "LOST",
    lastSeenTime: 0,
    lastFrameTime: 0,
    recoveryFrames: 0,
    lastMotion: 0,
    rafId: null,
    three: null,
    ringGroup: null,
    ringModel: null,
    ringUrl: "",
    ringMetrics: null,
    lightSampleFrame: 0,
    videoLightCanvas: null,
    environmentReady: false,
    ghostVisible: true,
    debug: false,
    debugTapCount: 0,
    debugLastTap: 0,
    debugFrameCount: 0,
    debugLastFpsTime: 0,
    debugFps: 0,
    frozenPose: null,
    viewerPose: null,
    handRig: null,
    handRigMaterial: null,
    depthMode: "mediapipe-approx",
    depthAvailable: false,
    depthChecked: false
  }
};

const FINGER_SEQUENCE = ["indicador", "medio", "anelar", "mindinho"];

const TRYON_FIT_DEFAULTS = Object.freeze({
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  depth: -0.24,
  pitch: 0,
  yaw: 0,
  seat: 0.38,
  occlusion: 1
});

function defaultManualOffset(overrides = {}) {
  return { ...TRYON_FIT_DEFAULTS, ...(overrides || {}) };
}

function normalizedFitValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function currentFitKey(finger = state.tryOn.finger) {
  const item = state.currentPublicItem || {};
  const id = firstValue(item.produtoId, item.codigo, item.modelGlbUrl, item.titulo, getPublicCatalogId(), "joia");
  return `ar-ring-fit-v26:${id}:${finger || "anelar"}`;
}

function calibrationToManual(calibration = null) {
  if (!calibration) return defaultManualOffset();
  return defaultManualOffset({
    depth: normalizedFitValue(calibration.occlusionDepth, -0.24),
    pitch: 0,
    yaw: 0,
    seat: normalizedFitValue(calibration.seatFactor, 0.38),
    occlusion: normalizedFitValue(calibration.occlusionScale, 1)
  });
}

function saveFitCalibration(calibration) {
  if (!calibration) return;
  try {
    localStorage.setItem(currentFitKey(), JSON.stringify({ ...calibration, savedAt: nowIso(), build: AR_BUILD }));
  } catch (err) {
    console.warn("Não consegui salvar o encaixe local do anel:", err);
  }
}

function loadFitCalibration(finger = state.tryOn.finger) {
  try {
    const raw = localStorage.getItem(currentFitKey(finger));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      localX: normalizedFitValue(parsed.localX, 0),
      localY: normalizedFitValue(parsed.localY, 0),
      localXRatio: Number.isFinite(Number(parsed.localXRatio)) ? Number(parsed.localXRatio) : null,
      localYRatio: Number.isFinite(Number(parsed.localYRatio)) ? Number(parsed.localYRatio) : null,
      scaleMult: clampNumber(normalizedFitValue(parsed.scaleMult, 1), 0.35, 3),
      rotDelta: normalizedFitValue(parsed.rotDelta, 0),
      seatFactor: clampNumber(normalizedFitValue(parsed.seatFactor, 0.38), 0.24, 0.70),
      occlusionDepth: clampNumber(normalizedFitValue(parsed.occlusionDepth, -0.24), -1.2, 0.8),
      pitchOffset: clampNumber(normalizedFitValue(parsed.pitchOffset, 0), -1.2, 1.2),
      yawOffset: clampNumber(normalizedFitValue(parsed.yawOffset, 0), -1.2, 1.2),
      occlusionScale: clampNumber(normalizedFitValue(parsed.occlusionScale, 1), 0.35, 2.0)
    };
  } catch (err) {
    console.warn("Encaixe local inválido:", err);
    return null;
  }
}


function cloneTryOnPose(pose) {
  if (!pose) return null;
  const cloned = { ...pose };
  if (pose.worldPos?.clone) cloned.worldPos = pose.worldPos.clone();
  if (pose.quaternion?.clone) cloned.quaternion = pose.quaternion.clone();
  if (pose.mcp) cloned.mcp = { ...pose.mcp };
  if (pose.pip) cloned.pip = { ...pose.pip };
  if (pose.dip) cloned.dip = { ...pose.dip };
  if (pose.tip) cloned.tip = { ...pose.tip };
  return cloned;
}

function angleToRadians(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  const n = parseFloat(text.replace(/[^0-9+\-.]/g, ""));
  if (!Number.isFinite(n)) return fallback;
  return text.includes("deg") ? n * Math.PI / 180 : n;
}

function captureViewerPoseSeed() {
  const mv = $("publicModelViewer");
  const seed = { rotate: 0, pitch: 0, yaw: 0 };
  try {
    const orbit = typeof mv?.getCameraOrbit === "function" ? mv.getCameraOrbit() : null;
    const theta = angleToRadians(orbit?.theta, 0);
    const phi = angleToRadians(orbit?.phi, Math.PI / 2);
    if (Number.isFinite(theta)) seed.rotate = normalizeAngle(-theta);
    if (Number.isFinite(phi)) seed.pitch = clampNumber((phi - Math.PI / 2) * 0.35, -0.45, 0.45);
  } catch (_) {}
  return seed;
}

function clearFitCalibration(finger = state.tryOn.finger) {
  try { localStorage.removeItem(currentFitKey(finger)); } catch (_) {}
}

function setRangeValue(id, value) {
  const el = $(id);
  if (el) el.value = String(value);
}

function setFitReadout(id, value, suffix = "") {
  const el = $(id);
  if (el) el.textContent = `${value}${suffix}`;
}

function syncFitPanelFromManual() {
  const manual = defaultManualOffset(state.tryOn.manualOffset);
  setRangeValue("arFitDepth", manual.depth);
  setRangeValue("arFitPitch", Math.round(manual.pitch * 180 / Math.PI));
  setRangeValue("arFitYaw", Math.round(manual.yaw * 180 / Math.PI));
  setRangeValue("arFitSeat", manual.seat);
  setRangeValue("arFitOcclusion", manual.occlusion);
  updateFitReadouts();
}

function updateFitReadouts() {
  const manual = defaultManualOffset(state.tryOn.manualOffset);
  setFitReadout("arFitDepthValue", Number(manual.depth).toFixed(2));
  setFitReadout("arFitPitchValue", Math.round(manual.pitch * 180 / Math.PI), "°");
  setFitReadout("arFitYawValue", Math.round(manual.yaw * 180 / Math.PI), "°");
  setFitReadout("arFitSeatValue", Number(manual.seat).toFixed(2));
  setFitReadout("arFitOcclusionValue", Number(manual.occlusion).toFixed(2));
}

function applyFitControl(id, rawValue) {
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return;
  const manual = state.tryOn.manualOffset = defaultManualOffset(state.tryOn.manualOffset);
  if (id === "arFitDepth") manual.depth = clampNumber(value, -1.2, 0.8);
  if (id === "arFitPitch") manual.pitch = clampNumber(value, -55, 55) * Math.PI / 180;
  if (id === "arFitYaw") manual.yaw = clampNumber(value, -55, 55) * Math.PI / 180;
  if (id === "arFitSeat") manual.seat = clampNumber(value, 0.24, 0.70);
  if (id === "arFitOcclusion") manual.occlusion = clampNumber(value, 0.35, 2.0);
  updateFitReadouts();
}

function wireFitPanelEvents() {
  ["arFitDepth", "arFitPitch", "arFitYaw", "arFitSeat", "arFitOcclusion"].forEach((id) => {
    const el = $(id);
    if (!el || el.dataset.fitWired) return;
    el.dataset.fitWired = "1";
    el.addEventListener("input", () => applyFitControl(id, el.value));
  });
  const resetBtn = $("arFitResetBtn");
  if (resetBtn && !resetBtn.dataset.fitWired) {
    resetBtn.dataset.fitWired = "1";
    resetBtn.addEventListener("click", resetCalibration);
  }
}
const FINGER_LABELS = {
  indicador: "Indicador",
  medio: "Médio",
  anelar: "Anelar",
  mindinho: "Mindinho"
};
// Topologia oficial dos 21 pontos do MediaPipe Hands:
// 0=pulso, 1-4=polegar, 5-8=indicador, 9-12=médio, 13-16=anelar, 17-20=mindinho.
// Em cada dedo: índice+0=MCP (base/nó), +1=PIP, +2=DIP, +3=ponta.
const FINGER_LANDMARKS = {
  indicador: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  medio: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  anelar: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  mindinho: { mcp: 17, pip: 18, dip: 19, tip: 20 }
};

const $ = (id) => document.getElementById(id);

function nowIso() {
  return new Date().toISOString();
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function objectToArray(obj) {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj).map(([id, value]) => ({
    id,
    ...(value && typeof value === "object" ? value : { valor: value })
  }));
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

function publicBaseUrl() {
  const basePath = location.pathname.replace(/\/?ar(?:\.html)?$/i, "/");
  return `${location.origin}${basePath}ar-publico.html`;
}

function publicLink(id) {
  return `${publicBaseUrl()}?id=${encodeURIComponent(id)}`;
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? "";
}

function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value ?? "";
}

function getValue(id) {
  return String($(id)?.value || "").trim();
}

function setHidden(id, hidden) {
  const el = $(id);
  if (el) el.hidden = Boolean(hidden);
}

function isFitPanelAllowed() {
  const params = new URLSearchParams(location.search);
  return params.get("fit") === "1" || params.get("debugFit") === "1" || localStorage.getItem("AR_FIT_PANEL_DEV") === "1";
}

function photoFromProduct(produto = {}) {
  return firstValue(
    produto.fotoUrl,
    produto.fotoPreviewUrl,
    produto.imagemUrl,
    produto.imagem,
    produto.foto,
    produto?.fotos?.[0]?.url,
    produto?.fotos?.[0],
    produto?.midias?.fotoUrl
  );
}

function glbFromProduct(produto = {}) {
  return firstValue(
    produto.modelGlbUrl,
    produto.modeloGlbUrl,
    produto.glbUrl,
    produto.gltfUrl,
    produto.modelo3dUrl,
    produto.arGlbUrl,
    produto.ar?.glbUrl,
    produto.ar?.modelGlbUrl,
    produto.publico?.modelGlbUrl
  );
}

function usdzFromProduct(produto = {}) {
  return firstValue(
    produto.modelUsdzUrl,
    produto.modeloUsdzUrl,
    produto.usdzUrl,
    produto.arUsdzUrl,
    produto.ar?.usdzUrl,
    produto.ar?.modelUsdzUrl,
    produto.publico?.modelUsdzUrl
  );
}

function arTypeFromProduct(produto = {}) {
  const tipo = normalize(firstValue(produto.tipoAR, produto.arTipo, produto.tipo, produto.categoria));
  if (tipo.includes("colar") || tipo.includes("gargant")) return "colar";
  if (tipo.includes("brinc")) return "brinco";
  if (tipo.includes("pulse")) return "pulseira";
  if (tipo.includes("ping")) return "pingente";
  if (tipo.includes("anel") || tipo.includes("alianc")) return "anel";
  return "livre";
}

function cameraFromArType(tipoAr = "livre") {
  if (["colar", "brinco"].includes(tipoAr)) return "user";
  if (["anel", "alianca", "aliança", "pulseira"].includes(tipoAr)) return "environment";
  return "auto";
}

function publicItemFromForm() {
  const tipoAr = getValue("arTipoAR") || "livre";
  const cameraPreferida = getValue("arCameraPreferida") || cameraFromArType(tipoAr);

  return {
    produtoId: getValue("arProdutoId"),
    titulo: getValue("arTitulo"),
    descricao: getValue("arDescricao"),
    codigo: getValue("arCodigo"),
    tipoJoia: getValue("arTipoJoia"),
    material: getValue("arMaterial"),
    medida: getValue("arMedida"),
    fotoUrl: getValue("arFotoUrl"),
    modelGlbUrl: getValue("arModelGlbUrl"),
    modelUsdzUrl: getValue("arModelUsdzUrl"),
    tipoAR: tipoAr,
    cameraPreferida,
    escala: Number(getValue("arEscala") || 1),
    rotacao: Number(getValue("arRotacao") || 0),
    posX: Number(getValue("arPosX") || 0),
    posY: Number(getValue("arPosY") || 0),
    observacaoPublica: getValue("arObservacao"),
    atualizadoEm: nowIso()
  };
}

function sanitizePublicItem(item = {}) {
  return {
    produtoId: String(item.produtoId || ""),
    titulo: String(item.titulo || "Joia"),
    descricao: String(item.descricao || ""),
    codigo: String(item.codigo || ""),
    tipoJoia: String(item.tipoJoia || ""),
    material: String(item.material || ""),
    medida: String(item.medida || ""),
    fotoUrl: String(item.fotoUrl || ""),
    modelGlbUrl: String(item.modelGlbUrl || ""),
    modelUsdzUrl: String(item.modelUsdzUrl || ""),
    tipoAR: String(item.tipoAR || "livre"),
    cameraPreferida: String(item.cameraPreferida || "auto"),
    escala: Number(item.escala || 1),
    rotacao: Number(item.rotacao || 0),
    posX: Number(item.posX || 0),
    posY: Number(item.posY || 0),
    observacaoPublica: String(item.observacaoPublica || ""),
    atualizadoEm: item.atualizadoEm || nowIso()
  };
}

async function currentProfile(user) {
  const [gestorSnap, usuarioSnap] = await Promise.all([
    get(ref(db, `gestores/${user.uid}`)),
    get(ref(db, `empresas/${empresaId}/usuarios/${user.uid}`))
  ]);

  const gestor = gestorSnap.val() === true || (APP_CONFIG.gestores?.uids || []).includes(user.uid);
  const usuario = usuarioSnap.exists() ? usuarioSnap.val() : {};
  const emailGestor = (APP_CONFIG.gestores?.emails || []).map((e) => normalize(e)).includes(normalize(user.email || ""));
  const dono = String(usuario?.papel || "").toLowerCase() === "dono";
  const ativo = usuario?.ativo === true || gestor || emailGestor;

  return {
    gestor: gestor || emailGestor,
    dono,
    ativo,
    usuario,
    autorizado: ativo && (gestor || emailGestor || dono)
  };
}

async function loadProducts() {
  const snap = await get(ref(db, `empresas/${empresaId}/produtos`));
  const produtos = objectToArray(snap.val())
    .filter((p) => p && typeof p === "object")
    .sort((a, b) => String(a.codigo || a.codigoOriginal || "").localeCompare(String(b.codigo || b.codigoOriginal || ""), "pt-BR"));

  state.produtos = produtos;
  renderProducts();
}

async function loadLinks() {
  const snap = await get(ref(db, `empresas/${empresaId}/catalogosPublicos`));
  state.links = objectToArray(snap.val())
    .filter((link) => link?.tipo === "joia_ar" || link?.tipo === "catalogo_ar" || link?.tipo === "joia")
    .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));

  renderLinks();
}

function productSearchText(p = {}) {
  return [
    p.id,
    p.codigo,
    p.codigoOriginal,
    p.descricao,
    p.tipo,
    p.material,
    p.medida,
    p.lote,
    p.loteCodigo,
    p.tituloPublico,
    p.nome
  ].filter(Boolean).join(" ");
}

function renderProducts(forceAll = false) {
  const list = $("arProductList");
  if (!list) return;

  const query = normalize($("arBuscaProduto")?.value || "");
  let products = state.produtos;

  if (query && !forceAll) {
    products = products.filter((p) => normalize(productSearchText(p)).includes(query));
  } else if (!query && !forceAll) {
    products = products.slice(0, 40);
  }

  if (!products.length) {
    list.innerHTML = `<p class="ar-empty">Nenhuma joia encontrada. Tente outro código, material ou medida.</p>`;
    return;
  }

  list.innerHTML = products.slice(0, 120).map((p) => {
    const codigo = escapeHtml(firstValue(p.codigo, p.codigoOriginal, p.id));
    const descricao = escapeHtml(firstValue(p.descricao, p.nome, "Sem descrição"));
    const tipo = escapeHtml(firstValue(p.tipo, p.tipoJoia, "Joia"));
    const material = escapeHtml(firstValue(p.material, "-"));
    const medida = escapeHtml(firstValue(p.medida, "-"));
    const foto = photoFromProduct(p);
    const selected = state.selectedProduct?.id === p.id;

    return `
      <article class="ar-product-item" data-id="${escapeHtml(p.id)}" aria-selected="${selected ? "true" : "false"}">
        <div class="ar-product-photo">${foto ? `<img src="${escapeHtml(foto)}" alt="">` : "💍"}</div>
        <div>
          <div class="ar-product-title">${codigo} · ${descricao}</div>
          <div class="ar-product-meta">${tipo} · ${material} · Medida ${medida}</div>
          <div class="ar-product-tags">
            <span class="ar-tag">Público: modelo</span>
            ${glbFromProduct(p) ? `<span class="ar-tag">3D</span>` : ""}
            ${usdzFromProduct(p) ? `<span class="ar-tag">iPhone AR</span>` : ""}
          </div>
        </div>
        <button class="ar-btn ar-btn-soft" type="button" data-select-product="${escapeHtml(p.id)}">Selecionar</button>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-select-product]").forEach((btn) => {
    btn.addEventListener("click", () => selectProduct(btn.getAttribute("data-select-product")));
  });
}

function selectProduct(productId) {
  const product = state.produtos.find((p) => p.id === productId);
  if (!product) return;

  state.selectedProduct = product;

  const codigo = firstValue(product.codigo, product.codigoOriginal, product.id);
  const descricao = firstValue(product.descricao, product.nome, "Joia");
  const material = firstValue(product.material, "");
  const medida = firstValue(product.medida, "");
  const tipo = firstValue(product.tipo, product.tipoJoia, "");
  const foto = photoFromProduct(product);
  const tipoAr = firstValue(product.tipoAR, product.arTipo, arTypeFromProduct(product));

  setValue("arProdutoId", product.id);
  setValue("arTitulo", firstValue(product.tituloPublico, `${codigo} ${descricao}`.trim()));
  setValue("arDescricao", firstValue(product.descricaoPublica, descricao));
  setValue("arCodigo", codigo);
  setValue("arTipoJoia", tipo);
  setValue("arMaterial", material);
  setValue("arMedida", medida);
  setValue("arFotoUrl", foto);
  setValue("arModelGlbUrl", glbFromProduct(product));
  setValue("arModelUsdzUrl", usdzFromProduct(product));
  setValue("arTipoAR", tipoAr);
  setValue("arCameraPreferida", firstValue(product.cameraPreferida, product.ar?.cameraPreferida, cameraFromArType(tipoAr)));
  setValue("arEscala", firstValue(product.escalaAR, product.ar?.escala, 1));
  setValue("arRotacao", firstValue(product.rotacaoAR, product.ar?.rotacao, 0));
  setValue("arPosX", firstValue(product.posXAR, product.ar?.posX, 0));
  setValue("arPosY", firstValue(product.posYAR, product.ar?.posY, 0));
  setValue("arObservacao", firstValue(product.observacaoPublica, product.ar?.observacaoPublica, "Visualização AR base. Ajuste a posição manualmente no celular."));

  setText("arProdutoSelecionado", `${codigo} · ${descricao}`);
  setText("arProdutoSelecionadoInfo", `${tipo || "Joia"} · ${material || "-"} · Medida ${medida || "-"}`);

  const thumb = $("arPreviewThumb");
  if (thumb) {
    thumb.innerHTML = foto ? `<img src="${escapeHtml(foto)}" alt="">` : "💍";
  }

  renderProducts();
}

function clearForm() {
  state.selectedProduct = null;
  ["arProdutoId", "arTitulo", "arDescricao", "arCodigo", "arTipoJoia", "arMaterial", "arMedida", "arFotoUrl", "arModelGlbUrl", "arModelUsdzUrl", "arObservacao"].forEach((id) => setValue(id, ""));
  setValue("arTipoAR", "anel");
  setValue("arCameraPreferida", "auto");
  setValue("arEscala", "1");
  setValue("arRotacao", "0");
  setValue("arPosX", "0");
  setValue("arPosY", "0");
  setText("arProdutoSelecionado", "Nenhuma joia selecionada");
  setText("arProdutoSelecionadoInfo", "Selecione uma joia na lista para preencher os dados.");
  $("arPreviewThumb").innerHTML = "💍";
  setHidden("arResult", true);
  renderProducts();
}

async function createPublicLink(event) {
  event?.preventDefault?.();

  const item = sanitizePublicItem(publicItemFromForm());

  if (!item.titulo) {
    alert("Informe o título público da joia.");
    return;
  }

  const catalogRef = push(ref(db, `empresas/${empresaId}/catalogosPublicos`));
  const payload = {
    tipo: "joia_ar",
    titulo: item.titulo,
    descricao: item.descricao,
    status: "ativo",
    publico: true,
    itens: {
      principal: item
    },
    criadoEm: nowIso(),
    atualizadoEm: nowIso(),
    criadoPorUid: state.user?.uid || "",
    criadoPorEmail: state.user?.email || "",
    origem: "ar.html",
    avisoPrivacidade: "Link público sem dados de estoque, lotes internos, peças físicas, clientes, vendas, custos ou comissões."
  };

  await set(catalogRef, payload);
  await loadLinks();

  const link = publicLink(catalogRef.key);
  setValue("arLinkPublico", link);
  $("arAbrirLink").href = link;
  $("arWhatsLink").href = `https://wa.me/?text=${encodeURIComponent(`Veja esta joia em 3D/AR: ${link}`)}`;
  setHidden("arResult", false);

  try {
    await navigator.clipboard.writeText(link);
  } catch {
    // Clipboard pode falhar em navegador sem permissão; o botão copiar permanece disponível.
  }
}

function renderLinks() {
  const list = $("arLinksList");
  if (!list) return;

  if (!state.links.length) {
    list.innerHTML = `<p class="ar-empty">Nenhum link AR gerado ainda.</p>`;
    return;
  }

  list.innerHTML = state.links.slice(0, 80).map((link) => {
    const item = objectToArray(link.itens)[0] || {};
    const url = publicLink(link.id);
    return `
      <article class="ar-link-item">
        <div>
          <div class="ar-product-title">${escapeHtml(link.titulo || item.titulo || "Joia AR")}</div>
          <div class="ar-product-meta">
            ${escapeHtml(item.codigo || "-")} · ${escapeHtml(item.material || "-")} · Medida ${escapeHtml(item.medida || "-")} · Status: ${escapeHtml(link.status || "-")}
          </div>
          <div class="ar-product-tags">
            <span class="ar-tag">${escapeHtml(link.tipo || "joia_ar")}</span>
            ${item.modelGlbUrl ? `<span class="ar-tag">3D</span>` : ""}
            ${item.modelUsdzUrl ? `<span class="ar-tag">iPhone</span>` : ""}
          </div>
        </div>
        <div class="ar-actions ar-actions-wrap">
          <button class="ar-btn" data-copy-link="${escapeHtml(url)}" type="button">Copiar</button>
          <a class="ar-btn ar-btn-soft" href="${escapeHtml(url)}" target="_blank" rel="noopener">Abrir</a>
          <button class="ar-btn ar-btn-danger" data-toggle-link="${escapeHtml(link.id)}" data-status="${escapeHtml(link.status === "ativo" ? "inativo" : "ativo")}" type="button">
            ${link.status === "ativo" ? "Desativar" : "Ativar"}
          </button>
          <button class="ar-btn ar-btn-danger" data-delete-link="${escapeHtml(link.id)}" type="button">Excluir</button>
        </div>
      </article>
    `;
  }).join("");

  list.querySelectorAll("[data-copy-link]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await copyText(btn.getAttribute("data-copy-link"));
      btn.textContent = "Copiado";
      setTimeout(() => { btn.textContent = "Copiar"; }, 1500);
    });
  });

  list.querySelectorAll("[data-toggle-link]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await update(ref(db, `empresas/${empresaId}/catalogosPublicos/${btn.getAttribute("data-toggle-link")}`), {
        status: btn.getAttribute("data-status"),
        atualizadoEm: nowIso()
      });
      await loadLinks();
    });
  });

  list.querySelectorAll("[data-delete-link]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete-link");
      if (!id) return;
      if (!confirm("Excluir este link público definitivamente? Essa ação não afeta produtos, estoque, vendas ou PDFs.")) return;
      await set(ref(db, `empresas/${empresaId}/catalogosPublicos/${id}`), null);
      await loadLinks();
    });
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    return true;
  }
}


function cloudinary3dConfig() {
  const cfg = APP_CONFIG.cloudinary || {};
  return {
    cloudName: String(cfg.cloudName || "").trim(),
    uploadPreset: String(cfg.uploadPreset || "").trim(),
    folder: String(cfg.folder || "controle-joias").trim()
  };
}

function safeSlug(value = "joia") {
  const normalized = normalize(value || "joia")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "joia";
}

function validate3dFile(file, extensions = []) {
  if (!file) throw new Error("Selecione um arquivo 3D primeiro.");

  const name = String(file.name || "").toLowerCase();
  const ok = extensions.some((ext) => name.endsWith(ext));

  if (!ok) {
    throw new Error(`Arquivo inválido. Permitido: ${extensions.join(", ")}`);
  }

  const sizeMb = Number(file.size || 0) / 1024 / 1024;
  const maxMb = 80;

  if (sizeMb > maxMb) {
    throw new Error(`Arquivo muito pesado (${sizeMb.toFixed(1)}MB). Para AR no celular, use até ${maxMb}MB e prefira modelos otimizados.`);
  }

  return true;
}

async function upload3dToCloudinary(file, kind = "glb") {
  const cfg = cloudinary3dConfig();

  if (!cfg.cloudName || !cfg.uploadPreset || /COLE_AQUI|ALTERE_/i.test(`${cfg.cloudName} ${cfg.uploadPreset}`)) {
    throw new Error("Cloudinary não configurado em js/config.js. Preencha cloudName e uploadPreset unsigned.");
  }

  const selected = state.selectedProduct || {};
  const codigo = safeSlug(firstValue(selected.codigo, selected.codigoOriginal, getValue("arCodigo"), selected.id, "joia"));
  const medidaRaw = firstValue(selected.medida, getValue("arMedida"), "");
  const medida = medidaRaw ? safeSlug(medidaRaw) : "";
  const tipo = safeSlug(firstValue(selected.tipo, selected.tipoJoia, getValue("arTipoJoia"), "joia"));
  const publicId = [
    "ar",
    codigo,
    medida ? `medida-${medida}` : "",
    tipo,
    kind,
    Date.now()
  ].filter(Boolean).join("-");

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", cfg.uploadPreset);
  form.append("folder", `${cfg.folder}/modelos-3d`);
  form.append("public_id", publicId);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName)}/auto/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: form
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !(data.secure_url || data.url)) {
    const message = data?.error?.message || "Não foi possível enviar o arquivo 3D para o Cloudinary.";
    throw new Error(message);
  }

  return data.secure_url || data.url || "";
}

async function save3dUrlOnSelectedProduct(kind, url) {
  const productId = getValue("arProdutoId") || state.selectedProduct?.id || "";

  if (!productId || !url) return;

  const patch = {
    atualizadoEm: nowIso()
  };

  if (kind === "glb") {
    patch.modelGlbUrl = url;
    patch.modeloGlbUrl = url;
    patch["ar/modelGlbUrl"] = url;
    patch["ar/glbUrl"] = url;
  }

  if (kind === "usdz") {
    patch.modelUsdzUrl = url;
    patch.modeloUsdzUrl = url;
    patch["ar/modelUsdzUrl"] = url;
    patch["ar/usdzUrl"] = url;
  }

  await update(ref(db, `empresas/${empresaId}/produtos/${productId}`), patch);

  const idx = state.produtos.findIndex((p) => p.id === productId);
  if (idx >= 0) {
    const current = state.produtos[idx] || {};
    const currentAr = current.ar && typeof current.ar === "object" ? current.ar : {};
    state.produtos[idx] = {
      ...current,
      ...(kind === "glb" ? { modelGlbUrl: url, modeloGlbUrl: url } : {}),
      ...(kind === "usdz" ? { modelUsdzUrl: url, modeloUsdzUrl: url } : {}),
      ar: {
        ...currentAr,
        ...(kind === "glb" ? { modelGlbUrl: url, glbUrl: url } : {}),
        ...(kind === "usdz" ? { modelUsdzUrl: url, usdzUrl: url } : {})
      },
      atualizadoEm: nowIso()
    };

    if (state.selectedProduct?.id === productId) {
      state.selectedProduct = state.produtos[idx];
    }

    renderProducts();
  }
}

async function handle3dUpload({ fileInputId, statusId, targetInputId, extensions, kind }) {
  const input = $(fileInputId);
  const status = $(statusId);
  const file = input?.files?.[0] || null;

  try {
    if (status) status.textContent = "Validando arquivo...";
    validate3dFile(file, extensions);

    if (status) status.textContent = "Enviando para Cloudinary...";
    const url = await upload3dToCloudinary(file, kind);

    setValue(targetInputId, url);

    if (status) status.textContent = "Arquivo enviado. URL preenchida e salva na joia.";
    await save3dUrlOnSelectedProduct(kind, url);

    setTimeout(() => {
      if (status) status.textContent = "Pronto.";
    }, 1200);
  } catch (err) {
    console.error(err);
    if (status) status.textContent = `Erro: ${err?.message || err}`;
    alert(`Não consegui enviar o arquivo 3D: ${err?.message || err}`);
  }
}

function wire3dUploadEvents() {
  $("arUploadGlbBtn")?.addEventListener("click", () => {
    handle3dUpload({
      fileInputId: "arUploadGlbFile",
      statusId: "arUploadGlbStatus",
      targetInputId: "arModelGlbUrl",
      extensions: [".glb", ".gltf"],
      kind: "glb"
    });
  });

  $("arUploadUsdzBtn")?.addEventListener("click", () => {
    handle3dUpload({
      fileInputId: "arUploadUsdzFile",
      statusId: "arUploadUsdzStatus",
      targetInputId: "arModelUsdzUrl",
      extensions: [".usdz"],
      kind: "usdz"
    });
  });
}


function wireAdminEvents() {
  $("arLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setText("arLoginMessage", "Entrando...");
    try {
      await signInWithEmailAndPassword(auth, getValue("arEmail"), getValue("arSenha"));
      setText("arLoginMessage", "");
    } catch (err) {
      setText("arLoginMessage", `Não consegui entrar: ${err?.message || err}`);
    }
  });

  $("arLogoutBtn")?.addEventListener("click", () => signOut(auth));
  $("arReloadProducts")?.addEventListener("click", loadProducts);
  $("arReloadLinks")?.addEventListener("click", loadLinks);
  $("arBuscaProduto")?.addEventListener("input", () => renderProducts());
  $("arVerTodos")?.addEventListener("click", () => {
    setValue("arBuscaProduto", "");
    renderProducts(true);
  });
  $("arCatalogForm")?.addEventListener("submit", createPublicLink);
  $("arLimparForm")?.addEventListener("click", clearForm);
  $("arCopiarLink")?.addEventListener("click", async () => {
    const link = getValue("arLinkPublico");
    if (!link) return;
    await copyText(link);
    $("arCopiarLink").textContent = "Copiado";
    setTimeout(() => { $("arCopiarLink").textContent = "Copiar link"; }, 1500);
  });

  wire3dUploadEvents();
}

function initAdmin() {
  setText("arBuildVersion", AR_BUILD);
  wireAdminEvents();

  onAuthStateChanged(auth, async (user) => {
    state.user = user;

    if (!user) {
      setHidden("arLoginPanel", false);
      setHidden("arAdminArea", true);
      return;
    }

    try {
      const perfil = await currentProfile(user);
      state.perfil = perfil;

      if (!perfil.autorizado) {
        await signOut(auth);
        setText("arLoginMessage", "Este módulo AR está liberado somente para dono/gestor autorizado.");
        return;
      }

      setHidden("arLoginPanel", true);
      setHidden("arAdminArea", false);
      setText("arUserInfo", `${user.email} · ${perfil.dono ? "Dono" : "Gestor"}`);

      await Promise.all([loadProducts(), loadLinks()]);
    } catch (err) {
      console.error(err);
      setText("arLoginMessage", `Erro ao carregar acesso: ${err?.message || err}`);
    }
  });
}

function getPublicCatalogId() {
  const url = new URL(location.href);
  return url.searchParams.get("id") || url.searchParams.get("catalogo") || url.searchParams.get("link") || "";
}

function itemFromCatalog(catalog = {}) {
  const itens = objectToArray(catalog.itens);
  return itens[0] || catalog.item || catalog.produto || {};
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function waitForModelViewerSupport(timeoutMs = 6000) {
  if (typeof customElements === "undefined") return Promise.resolve(false);
  const ready = customElements.whenDefined("model-viewer").then(() => true).catch(() => false);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return Promise.race([ready, timeout]);
}

function renderViewerMessage(host, { foto = "", title = "", text = "" } = {}) {
  if (!host) return;
  host.innerHTML = `
    <div class="ar-no-model">
      ${foto ? `<img src="${escapeHtml(foto)}" alt="" style="max-width: min(100%,420px); border-radius: 22px; box-shadow: 0 18px 44px rgba(0,0,0,.14);">` : ""}
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}

function setViewerStatus(message = "", tone = "info") {
  const el = $("publicViewerStatus");
  if (!el) return;

  if (!message) {
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-warning", "is-error");
    return;
  }

  el.hidden = false;
  el.textContent = message;
  el.classList.toggle("is-warning", tone === "warning");
  el.classList.toggle("is-error", tone === "error");
}

function wirePublicModelViewerStatus(foto = "") {
  const mv = $("publicModelViewer");
  const host = $("publicViewerHost");
  if (!mv || !host) return;

  // Requisito 11: se o GLB for pesado, avisa sem travar a página.
  // O model-viewer carrega de forma assíncrona por padrão (a UI nunca fica bloqueada);
  // este timer só decide quando exibir um aviso visual de "carregando modelo pesado".
  let heavyTimer = setTimeout(() => {
    setViewerStatus("Modelo 3D pesado: carregando, aguarde alguns segundos...", "warning");
  }, 4000);

  const clearHeavyTimer = () => {
    if (heavyTimer) {
      clearTimeout(heavyTimer);
      heavyTimer = null;
    }
  };

  mv.addEventListener("progress", (event) => {
    const ratio = Number(event?.detail?.totalProgress);
    if (Number.isFinite(ratio) && ratio >= 1) {
      clearHeavyTimer();
      setViewerStatus("");
    }
  });

  mv.addEventListener("load", () => {
    clearHeavyTimer();
    setViewerStatus("");
  });

  // Requisito 12: se o modelo falhar, mostra a foto e uma mensagem clara.
  mv.addEventListener("error", (event) => {
    clearHeavyTimer();
    console.error("Falha ao carregar o modelo 3D público:", event?.detail || event);
    renderViewerMessage(host, {
      foto,
      title: "Não consegui carregar o modelo 3D",
      text: "Mostrando a foto da joia. Tente novamente em alguns segundos ou abra o link em outro navegador (Chrome ou Safari atualizados)."
    });
  });
}

async function renderPublicViewer(item = {}) {
  const host = $("publicViewerHost");
  if (!host) return;

  const glb = item.modelGlbUrl || item.glbUrl || "";
  const usdz = item.modelUsdzUrl || item.usdzUrl || "";
  const foto = item.fotoUrl || "";

  if (!glb && !usdz) {
    renderViewerMessage(host, {
      foto,
      title: "Modelo 3D ainda não cadastrado",
      text: "Você está vendo a foto pública. Quando o arquivo 3D for cadastrado, o botão de AR nativo aparecerá aqui."
    });
    return;
  }

  // Requisito 13: se o navegador não conseguir registrar o <model-viewer>
  // (script bloqueado, sem WebGL, navegador muito antigo), cai para a foto.
  const supported = await waitForModelViewerSupport();
  if (!supported) {
    renderViewerMessage(host, {
      foto,
      title: "Visualização 3D indisponível neste navegador",
      text: "Não consegui carregar o visualizador 3D aqui. Veja a foto da joia abaixo ou tente em um navegador atualizado (Chrome ou Safari)."
    });
    return;
  }

  host.innerHTML = `
    <model-viewer
      id="publicModelViewer"
      src="${escapeHtml(glb || usdz)}"
      ${usdz ? `ios-src="${escapeHtml(usdz)}"` : ""}
      poster="${escapeHtml(foto)}"
      alt="${escapeHtml(item.titulo || "Joia em 3D")}"
      camera-controls
      touch-action="pan-y"
      auto-rotate
      ar
      ar-modes="webxr scene-viewer quick-look"
      ar-scale="auto"
      quick-look-browsers="safari chrome"
      shadow-intensity="1"
      exposure="1"
      interaction-prompt="auto">
      <button class="ar-btn ar-btn-primary" slot="ar-button">Abrir AR no celular</button>
    </model-viewer>
  `;

  wirePublicModelViewerStatus(foto);
}

async function loadPublicCatalog() {
  const id = getPublicCatalogId();
  if (!id) {
    showPublicError("Link sem identificador. Gere um novo link no ar.html.");
    return;
  }

  try {
    const snap = await get(ref(db, `empresas/${empresaId}/catalogosPublicos/${id}`));
    if (!snap.exists()) {
      showPublicError("Este link não existe ou foi removido.");
      return;
    }

    const catalog = { id, ...snap.val() };

    if (catalog.status !== "ativo") {
      showPublicError("Este link está inativo.");
      return;
    }

    const item = sanitizePublicItem(itemFromCatalog(catalog));
    item.titulo = item.titulo || catalog.titulo || "Joia";
    item.descricao = item.descricao || catalog.descricao || "";
    state.currentPublicItem = item;

    document.title = `${item.titulo} | Joia em 3D/AR`;
    setText("publicTitulo", item.titulo);
    setText("publicDescricao", item.descricao || "Visualização pública da joia.");
    setText("publicCodigo", item.codigo || "-");
    setText("publicTipo", item.tipoJoia || item.tipoAR || "-");
    setText("publicMaterial", item.material || "-");
    setText("publicMedida", item.medida || "-");
    setText("publicTipoBadge", (item.tipoAR || "3D/AR").toUpperCase());
    setText("publicObservacao", item.observacaoPublica || "Visualização pública sem dados de estoque.");
    $("publicWhatsapp").href = `https://wa.me/?text=${encodeURIComponent(`Veja esta joia em 3D/AR: ${location.href}`)}`;

    const photo = $("publicFoto");
    if (photo && item.fotoUrl) {
      photo.src = item.fotoUrl;
      photo.hidden = false;
    }

    renderPublicViewer(item);

    setHidden("arPublicLoading", true);
    setHidden("arPublicError", true);
    setHidden("arPublicView", false);
  } catch (err) {
    console.error(err);
    showPublicError(`Erro ao carregar link: ${err?.message || err}`);
  }
}

function showPublicError(message) {
  setHidden("arPublicLoading", true);
  setHidden("arPublicView", true);
  setHidden("arPublicError", false);
  setText("arPublicErrorText", message);
}

/* =========================================================================
   PROVADOR VIRTUAL — visão geral técnica (documentado para auditoria)

   1) MediaPipe Hands (legado, mesmo CDN que já funcionava antes) lê 21
      pontos 2D por mão a cada frame da câmera.
   2) Para o dedo escolhido, usamos os pontos MCP (base) e PIP (1ª junta)
      para calcular: posição do anel, ângulo do dedo na tela (rotação 2D)
      e comprimento MCP→PIP em pixels (proxy de "distância da câmera",
      já que MediaPipe não fornece profundidade métrica real).
   3) O anel 3D (Three.js, câmera ortográfica em pixels da tela) é
      posicionado/girado/escalado nesse ponto a cada frame, com suavização
      exponencial para reduzir tremores.
   4) Isso é uma ilusão 2D bem construída sincronizada por pontos da mão —
      não é rastreamento espacial 3D verdadeiro (MediaPipe Hands é 2D RGB).
   ========================================================================= */

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Não consegui carregar o script: ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureHandsApi() {
  if (state.tryOn.handsApi) return state.tryOn.handsApi;

  await loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.min.js");
  if (!window.Hands) {
    throw new Error("MediaPipe Hands não carregou neste navegador.");
  }

  const hands = new window.Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  hands.onResults((results) => {
    state.tryOn.landmarks = results.multiHandLandmarks?.[0] || null;
  });

  state.tryOn.handsApi = hands;
  return hands;
}

// Converte um ponto normalizado (0..1) do MediaPipe para pixels do canvas,
// respeitando o recorte do object-fit:cover do vídeo. Câmera fixa em
// "environment" (traseira) — não há espelhamento aqui.
function pointOnVideo(lm, rect, video) {
  const vw = Math.max(1, video?.videoWidth || rect.width || 1);
  const vh = Math.max(1, video?.videoHeight || rect.height || 1);
  const scale = Math.max(rect.width / vw, rect.height / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const offsetX = (rect.width - drawW) / 2;
  const offsetY = (rect.height - drawH) / 2;
  return {
    x: offsetX + lm.x * drawW,
    y: offsetY + lm.y * drawH,
    z: Number(lm.z || 0) * drawW
  };
}

function screenPointToWorld(pixelX, pixelY, rect, camera, targetZ = 0) {
  const three = state.tryOn.three;
  if (!three?.THREE || !camera?.isPerspectiveCamera) return null;
  const ndcX = (pixelX / Math.max(rect.width, 1)) * 2 - 1;
  const ndcY = -(pixelY / Math.max(rect.height, 1)) * 2 + 1;
  const vec = new three.THREE.Vector3(ndcX, ndcY, 0.5);
  vec.unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  if (Math.abs(dir.z) < 1e-6) return null;
  const dist = (targetZ - camera.position.z) / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(dist));
}

function mediaPipeVec3(lm, aspect = 1) {
  const three = state.tryOn.three;
  if (!three?.THREE || !lm) return null;
  return new three.THREE.Vector3(
    Number(lm.x || 0) * aspect,
    -Number(lm.y || 0),
    -Number(lm.z || 0) * 1.35
  );
}

function computeFingerQuaternion3D(landmarks, def, rect) {
  const three = state.tryOn.three;
  if (!three?.THREE || !landmarks?.[def.mcp] || !landmarks?.[def.pip] || !landmarks?.[5] || !landmarks?.[17]) return null;
  const aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
  const mcpV = mediaPipeVec3(landmarks[def.mcp], aspect);
  const pipV = mediaPipeVec3(landmarks[def.pip], aspect);
  const p5V = mediaPipeVec3(landmarks[5], aspect);
  const p17V = mediaPipeVec3(landmarks[17], aspect);
  if (!mcpV || !pipV || !p5V || !p17V) return null;

  let localY = new three.THREE.Vector3().subVectors(pipV, mcpV);
  if (localY.lengthSq() < 1e-8) return null;
  localY.normalize();

  let palmAcross = new three.THREE.Vector3().subVectors(p17V, p5V);
  if (palmAcross.lengthSq() < 1e-8) return null;
  palmAcross.normalize();

  let localZ = new three.THREE.Vector3().crossVectors(palmAcross, localY);
  if (localZ.lengthSq() < 1e-8) return null;
  localZ.normalize();
  if (localZ.z < 0) localZ.negate();

  let localX = new three.THREE.Vector3().crossVectors(localY, localZ);
  if (localX.lengthSq() < 1e-8) return null;
  localX.normalize();
  localZ.crossVectors(localX, localY).normalize();

  const matrix = new three.THREE.Matrix4().makeBasis(localX, localY, localZ);
  return new three.THREE.Quaternion().setFromRotationMatrix(matrix);
}

function computeIntelligentScale(mcp, pip, dip, p5, p17) {
  const mcpPip = Math.hypot(pip.x - mcp.x, pip.y - mcp.y);
  const pipDip = dip ? Math.hypot(dip.x - pip.x, dip.y - pip.y) : mcpPip * 0.75;
  const palmWidth = Math.hypot(p17.x - p5.x, p17.y - p5.y);
  return Math.max(10, (mcpPip * 0.45) + (pipDip * 0.35) + (palmWidth * 0.20));
}

function computeSafeRotation(mcp, pip, wrist, p9, palmWidth) {
  const dist = Math.hypot(pip.x - mcp.x, pip.y - mcp.y);
  if (dist < palmWidth * 0.25) {
    return Math.atan2(p9.y - wrist.y, p9.x - wrist.x) + (Math.PI / 2);
  }
  return Math.atan2(pip.y - mcp.y, pip.x - mcp.x) + (Math.PI / 2);
}

function isFinitePose(pose) {
  if (!pose) return false;
  return [pose.seatX ?? pose.x, pose.seatY ?? pose.y, pose.angle, pose.fingerLength].every((value) => Number.isFinite(value));
}

function sampleVideoLighting(video) {
  const three = state.tryOn.three;
  const landmarks = state.tryOn.landmarks;
  if (!video || !three?.ambientLight || !three?.keyLight || !video.videoWidth || !video.videoHeight) return;
  state.tryOn.lightSampleFrame = (state.tryOn.lightSampleFrame || 0) + 1;
  if (state.tryOn.lightSampleFrame % 15 !== 0) return;

  const canvas = state.tryOn.videoLightCanvas || document.createElement("canvas");
  state.tryOn.videoLightCanvas = canvas;
  canvas.width = 12;
  canvas.height = 12;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  try {
    // V27: amostra a luz da REGIÃO DA MÃO, não da tela inteira.
    // A média global fazia o anel acender por causa de lâmpada/fundo claro,
    // mesmo quando a mão estava na sombra.
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (Array.isArray(landmarks) && landmarks.length) {
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const lm of landmarks) {
        if (!lm) continue;
        minX = Math.min(minX, Number(lm.x || 0));
        minY = Math.min(minY, Number(lm.y || 0));
        maxX = Math.max(maxX, Number(lm.x || 0));
        maxY = Math.max(maxY, Number(lm.y || 0));
      }
      const pad = 0.08;
      minX = clampNumber(minX - pad, 0, 1);
      minY = clampNumber(minY - pad, 0, 1);
      maxX = clampNumber(maxX + pad, 0, 1);
      maxY = clampNumber(maxY + pad, 0, 1);
      sx = Math.round(minX * video.videoWidth);
      sy = Math.round(minY * video.videoHeight);
      sw = Math.max(8, Math.round((maxX - minX) * video.videoWidth));
      sh = Math.max(8, Math.round((maxY - minY) * video.videoHeight));
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (!count) return;
    r /= count * 255;
    g /= count * 255;
    b /= count * 255;
    const luminance = clampNumber((0.2126 * r) + (0.7152 * g) + (0.0722 * b), 0.16, 0.95);
    const color = new three.THREE.Color(r, g, b).lerp(new three.THREE.Color(1, 1, 1), 0.42);
    three.ambientLight.color.lerp(color, 0.12);
    three.ambientLight.intensity = clampNumber(0.62 + luminance * 1.25, 0.72, 1.85);
    three.keyLight.intensity = clampNumber(0.48 + luminance * 1.05, 0.58, 1.65);
  } catch (err) {
    // Alguns navegadores bloqueiam leitura do frame por política interna.
    // Não interrompe o provador.
  }
}

function hideGhostGuide() {
  const guide = $("arGhostGuide");
  if (!guide || guide.hidden) return;
  guide.classList.add("is-hidden");
  state.tryOn.ghostVisible = false;
  setTimeout(() => { if (guide.classList.contains("is-hidden")) guide.hidden = true; }, 520);
}

function showGhostGuide() {
  const guide = $("arGhostGuide");
  if (!guide) return;
  guide.hidden = false;
  guide.classList.remove("is-hidden");
  state.tryOn.ghostVisible = true;
}

function rotateVector(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

const FINGER_TUBE_RATIOS = Object.freeze({
  indicador: 0.168,
  medio: 0.176,
  anelar: 0.164,
  mindinho: 0.138
});

function estimateFingerDiameterPx({ finger, palmWidth, phalanxLen, dipLen, lastValid }) {
  const ratio = FINGER_TUBE_RATIOS[finger] || FINGER_TUBE_RATIOS.anelar;
  const palmEstimate = palmWidth * ratio;
  const jointEstimate = Math.max(0, ((phalanxLen || 0) * 0.18) + ((dipLen || 0) * 0.10));
  let diameter = (palmEstimate * 0.72) + (jointEstimate * 0.28);
  if (lastValid?.isCollapsed && Number.isFinite(lastValid.fingerDiameter)) {
    diameter = lastValid.fingerDiameter;
  }
  if (phalanxLen < palmWidth * 0.20 && Number.isFinite(lastValid?.fingerDiameter)) {
    diameter = lastValid.fingerDiameter;
  }
  return clampNumber(diameter, palmWidth * ratio * 0.76, palmWidth * ratio * 1.34);
}

function computeFingerTransform(landmarks, finger, rect, video) {
  const def = FINGER_LANDMARKS[finger] || FINGER_LANDMARKS.anelar;
  const mcpLm = landmarks?.[def.mcp];
  const pipLm = landmarks?.[def.pip];
  const dipLm = landmarks?.[def.dip];
  const tipLm = landmarks?.[def.tip];
  if (!mcpLm || !pipLm || !landmarks?.[0] || !landmarks?.[5] || !landmarks?.[9] || !landmarks?.[17]) return null;

  const wrist = pointOnVideo(landmarks[0], rect, video);
  const p5 = pointOnVideo(landmarks[5], rect, video);
  const p9 = pointOnVideo(landmarks[9], rect, video);
  const p17 = pointOnVideo(landmarks[17], rect, video);
  const mcp = pointOnVideo(mcpLm, rect, video);
  const pip = pointOnVideo(pipLm, rect, video);
  const dip = dipLm ? pointOnVideo(dipLm, rect, video) : null;
  const tip = tipLm ? pointOnVideo(tipLm, rect, video) : null;

  const palmWidth = Math.max(1, Math.hypot(p17.x - p5.x, p17.y - p5.y));
  const dx = pip.x - mcp.x;
  const dy = pip.y - mcp.y;
  const phalanxLen = Math.hypot(dx, dy);
  const lastValid = state.tryOn.smoothed && isFinitePose(state.tryOn.smoothed) ? state.tryOn.smoothed : null;

  let angle;
  let isCollapsed = phalanxLen < palmWidth * 0.20;

  if (isCollapsed) {
    // Quando o dedo aponta para a câmera, MCP/PIP colapsam na tela.
    // Não deixamos o atan2 capotar: seguramos o último eixo confiável ou usamos o eixo da palma.
    angle = Number.isFinite(lastValid?.angle)
      ? lastValid.angle
      : Math.atan2(p9.y - wrist.y, p9.x - wrist.x);
  } else {
    angle = Math.atan2(dy, dx);
  }

  // RING_SEAT anatômico: corpo rígido preso à falange proximal MCP→PIP.
  // 0.0 = MCP, 1.0 = PIP. 0.38 coloca o aro mais próximo da base real do dedo,
  // evitando que o solitário desça para o dorso quando o modelo tem pedra alta.
  const baseSeat = Number(state.tryOn.manualMode
    ? (state.tryOn.manualOffset?.seat ?? state.tryOn.calibration?.seatFactor ?? 0.38)
    : (state.tryOn.calibration?.seatFactor ?? state.tryOn.manualOffset?.seat ?? 0.38));
  const seatFactor = clampNumber(baseSeat, 0.30, 0.62);
  let seatX = mcp.x + Math.cos(angle) * phalanxLen * seatFactor;
  let seatY = mcp.y + Math.sin(angle) * phalanxLen * seatFactor;

  if (isCollapsed && lastValid && Number.isFinite(lastValid.seatX) && Number.isFinite(lastValid.seatY)) {
    seatX = lastValid.seatX;
    seatY = lastValid.seatY;
  }

  const dipLen = dip ? Math.hypot(dip.x - pip.x, dip.y - pip.y) : phalanxLen * 0.75;
  const stableLength = Math.max(10, (phalanxLen * 0.40) + (dipLen * 0.30) + (palmWidth * 0.30));
  const safeLen = Math.max(phalanxLen, 1);
  const axisX = Math.cos(angle);
  const axisY = Math.sin(angle);
  const normalX = -axisY;
  const normalY = axisX;
  const fingerDiameter = estimateFingerDiameterPx({ finger, palmWidth, phalanxLen, dipLen, lastValid });
  const fingerRadius = fingerDiameter / 2;

  const zDelta = Number.isFinite(pipLm.z) && Number.isFinite(mcpLm.z) ? (pipLm.z - mcpLm.z) : 0;
  const palmZDelta = Number.isFinite(landmarks[17]?.z) && Number.isFinite(landmarks[5]?.z) ? (landmarks[17].z - landmarks[5].z) : 0;
  const pitch = clampNumber(Math.atan(zDelta * 4.0), -0.75, 0.75);
  const yaw = clampNumber(Math.atan(palmZDelta * 2.5), -0.65, 0.65);

  let worldPos = null;
  let worldMcp = null;
  let worldPip = null;
  let fingerWidthWorld = null;
  let quaternion = null;
  const three = state.tryOn.three;
  if (three?.camera?.isPerspectiveCamera) {
    worldMcp = screenPointToWorld(mcp.x, mcp.y, rect, three.camera, 0);
    worldPip = screenPointToWorld(pip.x, pip.y, rect, three.camera, 0);
    const worldP5 = screenPointToWorld(p5.x, p5.y, rect, three.camera, 0);
    const worldP17 = screenPointToWorld(p17.x, p17.y, rect, three.camera, 0);
    if (worldMcp && worldPip) {
      worldPos = worldMcp.clone().lerp(worldPip, seatFactor);
      if (worldP5 && worldP17) {
        const palmWorld = worldP5.distanceTo(worldP17);
        const phalanxWorld = worldMcp.distanceTo(worldPip);
        fingerWidthWorld = Math.max(0.8, (phalanxWorld * 0.32) + (palmWorld * 0.10));
      }
    }
    quaternion = computeFingerQuaternion3D(landmarks, def, rect);
  }

  return {
    // aliases mantidos para compatibilidade, mas a renderização usa seatX/seatY.
    x: seatX,
    y: seatY,
    seatX,
    seatY,
    angle,
    fingerLength: stableLength,
    fingerDiameter,
    fingerRadius,
    rawFingerLength: phalanxLen,
    rawPhalanxLen: phalanxLen,
    axisX,
    axisY,
    normalX,
    normalY,
    safeLen,
    palmWidth,
    pitch,
    yaw,
    occlusionWidth: stableLength * 0.82,
    trackingState: "TRACKING",
    mcp,
    pip,
    dip,
    tip,
    wrist,
    isCollapsed,
    seatFactor,
    worldPos,
    worldMcp,
    worldPip,
    fingerWidthWorld,
    quaternion
  };
}

function shortestAngleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function smoothTransform(prev, next, dt = 16, recovering = false) {
  if (!next) return prev || null;
  const safeDt = clampNumber(dt, 1, 100);
  if (!prev || recovering) return { ...next, time: performance.now() };

  const prevX = Number.isFinite(prev.seatX) ? prev.seatX : prev.x;
  const prevY = Number.isFinite(prev.seatY) ? prev.seatY : prev.y;
  const dist = Math.hypot(next.seatX - prevX, next.seatY - prevY);
  const speed = dist / safeDt;

  const alphaPos = next.isCollapsed ? 0.02 : clampNumber(0.08 + speed * 0.20, 0.08, 0.45);
  const alphaScale = next.isCollapsed ? 0.04 : clampNumber(0.02 + speed * 0.08, 0.02, 0.20);
  const alphaAngle = next.isCollapsed ? 0.01 : clampNumber(0.10 + speed * 0.15, 0.10, 0.40);

  const seatX = prevX + (next.seatX - prevX) * alphaPos;
  const seatY = prevY + (next.seatY - prevY) * alphaPos;

  const smoothed = {
    ...next,
    x: seatX,
    y: seatY,
    seatX,
    seatY,
    angle: prev.angle + shortestAngleDelta(prev.angle, next.angle) * alphaAngle,
    fingerLength: prev.fingerLength + (next.fingerLength - prev.fingerLength) * alphaScale,
    fingerDiameter: (prev.fingerDiameter || next.fingerDiameter || 1) + ((next.fingerDiameter || prev.fingerDiameter || 1) - (prev.fingerDiameter || next.fingerDiameter || 1)) * alphaScale,
    fingerRadius: ((prev.fingerDiameter || next.fingerDiameter || 1) + ((next.fingerDiameter || prev.fingerDiameter || 1) - (prev.fingerDiameter || next.fingerDiameter || 1)) * alphaScale) / 2,
    rawFingerLength: next.rawFingerLength,
    rawPhalanxLen: next.rawPhalanxLen,
    axisX: next.axisX,
    axisY: next.axisY,
    normalX: next.normalX,
    normalY: next.normalY,
    safeLen: next.safeLen,
    palmWidth: next.palmWidth,
    pitch: (prev.pitch || 0) + ((next.pitch || 0) - (prev.pitch || 0)) * alphaScale,
    yaw: (prev.yaw || 0) + ((next.yaw || 0) - (prev.yaw || 0)) * alphaScale,
    occlusionWidth: (prev.occlusionWidth || prev.fingerLength) + ((next.occlusionWidth || next.fingerLength) - (prev.occlusionWidth || prev.fingerLength)) * alphaScale,
    speedPxMs: speed,
    time: performance.now()
  };

  if (next.worldPos) smoothed.worldPos = prev.worldPos ? prev.worldPos.clone().lerp(next.worldPos, alphaPos) : next.worldPos.clone();
  if (next.quaternion) smoothed.quaternion = prev.quaternion && !next.isCollapsed ? prev.quaternion.clone().slerp(next.quaternion, alphaAngle) : next.quaternion.clone();
  if (Number.isFinite(next.fingerWidthWorld)) {
    const prevWidth = Number.isFinite(prev.fingerWidthWorld) ? prev.fingerWidthWorld : next.fingerWidthWorld;
    smoothed.fingerWidthWorld = prevWidth + (next.fingerWidthWorld - prevWidth) * alphaScale;
  }
  return smoothed;
}

function computeCalibrationDelta(rawPose, manual) {
  if (!rawPose) return null;
  const fitting = defaultManualOffset(manual);
  const dx = Number(fitting.x || 0);
  const dy = Number(fitting.y || 0);
  const localOffset = rotateVector(dx, dy, -rawPose.angle);
  const diameter = Math.max(Number(rawPose.fingerDiameter || rawPose.occlusionWidth || 1), 1);
  const length = Math.max(Number(rawPose.rawPhalanxLen || rawPose.fingerLength || 1), 1);
  return {
    localX: localOffset.x,
    localY: localOffset.y,
    localXRatio: localOffset.x / diameter,
    localYRatio: localOffset.y / length,
    scaleMult: clampNumber(Number(fitting.scale || 1), 0.35, 3),
    rotDelta: Number(fitting.rotate || 0),
    seatFactor: clampNumber(Number(fitting.seat || rawPose.seatFactor || 0.38), 0.24, 0.70),
    occlusionDepth: clampNumber(Number(fitting.depth ?? -0.24), -1.2, 0.8),
    pitchOffset: clampNumber(Number(fitting.pitch || 0), -1.2, 1.2),
    yawOffset: clampNumber(Number(fitting.yaw || 0), -1.2, 1.2),
    occlusionScale: clampNumber(Number(fitting.occlusion || 1), 0.35, 2.0)
  };
}

function applyCalibrationToPose(rawPose, calibration) {
  if (!rawPose || !calibration) return rawPose;
  const diameter = Math.max(Number(rawPose.fingerDiameter || rawPose.occlusionWidth || 1), 1);
  const length = Math.max(Number(rawPose.rawPhalanxLen || rawPose.fingerLength || 1), 1);
  const hasLocalXRatio = calibration.localXRatio !== null && calibration.localXRatio !== undefined && Number.isFinite(Number(calibration.localXRatio));
  const hasLocalYRatio = calibration.localYRatio !== null && calibration.localYRatio !== undefined && Number.isFinite(Number(calibration.localYRatio));
  const localX = hasLocalXRatio
    ? Number(calibration.localXRatio) * diameter
    : Number(calibration.localX || 0);
  const localY = hasLocalYRatio
    ? Number(calibration.localYRatio) * length
    : Number(calibration.localY || 0);
  const worldOffset = rotateVector(localX, localY, rawPose.angle);
  const seatX = rawPose.seatX + worldOffset.x;
  const seatY = rawPose.seatY + worldOffset.y;
  return {
    ...rawPose,
    x: seatX,
    y: seatY,
    seatX,
    seatY,
    fingerLength: rawPose.fingerLength * Number(calibration.scaleMult || 1),
    fingerDiameter: diameter * Number(calibration.scaleMult || 1),
    fingerRadius: (diameter * Number(calibration.scaleMult || 1)) / 2,
    angle: rawPose.angle + Number(calibration.rotDelta || 0),
    pitch: Number(rawPose.pitch || 0) + Number(calibration.pitchOffset || 0),
    yaw: Number(rawPose.yaw || 0) + Number(calibration.yawOffset || 0),
    occlusionDepth: Number(calibration.occlusionDepth ?? -0.24),
    occlusionScale: Number(calibration.occlusionScale || 1)
  };
}

function resizeTryOnCanvas() {
  const stage = $("arTryOnStage");
  const canvas = $("arRingCanvas");
  if (!stage || !canvas) return;

  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = `${Math.max(1, rect.width)}px`;
  canvas.style.height = `${Math.max(1, rect.height)}px`;

  const three = state.tryOn.three;
  if (three?.renderer && three?.camera) {
    three.renderer.setPixelRatio(dpr);
    three.renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    if (three.camera.isPerspectiveCamera) {
      three.camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
      three.camera.updateProjectionMatrix();
    } else {
      three.camera.left = 0;
      three.camera.right = Math.max(1, rect.width);
      three.camera.top = 0;
      three.camera.bottom = Math.max(1, rect.height);
      three.camera.near = -1000;
      three.camera.far = 1000;
      three.camera.updateProjectionMatrix();
    }
  }
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * clampNumber(q, 0, 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] === undefined) return sorted[base];
  return sorted[base] + (sorted[base + 1] - sorted[base]) * rest;
}

function estimateRingMetrics(obj, box, size, THREE) {
  const center = box.getCenter(new THREE.Vector3());
  const hoopDiameter = Math.max(size.x, size.z, 1);
  const hoopCenterY = box.min.y + (hoopDiameter / 2);
  const radii = [];
  const v = new THREE.Vector3();
  obj.updateWorldMatrix?.(true, true);
  obj.traverse((node) => {
    if (!node?.isMesh || !node.geometry?.attributes?.position) return;
    const pos = node.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld);
      if (Math.abs(v.y - hoopCenterY) > hoopDiameter * 0.34) continue;
      const r = Math.hypot(v.x - center.x, v.z - center.z);
      if (Number.isFinite(r) && r > hoopDiameter * 0.08) radii.push(r);
    }
  });
  radii.sort((a, b) => a - b);
  const innerRadius = quantile(radii, 0.08);
  const boreRatio = innerRadius
    ? clampNumber((innerRadius * 2) / hoopDiameter, 0.52, 0.82)
    : 0.68;
  return {
    hoopDiameter,
    hoopCenterY,
    boreRatio,
    clearance: 1.07
  };
}

async function ensureRingModel(item = {}) {
  const canvas = $("arRingCanvas");
  if (!canvas) return false;

  const modelUrl = item.modelGlbUrl || item.glbUrl || "";
  if (!modelUrl) {
    showTryOnToast("Esta joia ainda não tem arquivo 3D (.glb) cadastrado.");
    return false;
  }

  if (!state.tryOn.three) {
    let THREE;
    let GLTFLoader;
    let RoomEnvironment = null;
    try {
      THREE = await import("three");
      ({ GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js"));
      try { ({ RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js")); } catch (_) {}
    } catch (err) {
      console.warn("Fallback ThreeJS CDN direto", err);
      THREE = await import("https://esm.sh/three@0.160.0?bundle");
      ({ GLTFLoader } = await import("https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js?bundle&deps=three@0.160.0"));
      try { ({ RoomEnvironment } = await import("https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js?bundle&deps=three@0.160.0")); } catch (_) {}
    }

    const scene = new THREE.Scene();
    // V28B experimental: câmera perspectiva real.
    // Mantém admin/Firebase intactos, mas testa projeção e rotação 3D mais próximas da lente do celular.
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -1000, 1000);
    camera.position.z = 100;
    // preserveDrawingBuffer é necessário para o botão Foto conseguir
    // exportar o conteúdo do canvas (toBlob/toDataURL).
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(0, 0, 100);
    light.castShadow = true;
    if (light.shadow) {
      light.shadow.mapSize.width = 512;
      light.shadow.mapSize.height = 512;
      light.shadow.bias = -0.001;
    }
    scene.add(ambientLight);
    scene.add(light);

    try {
      if (RoomEnvironment && THREE.PMREMGenerator) {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 1.12;
        pmremGenerator.dispose();
      }
    } catch (err) {
      console.warn("Ambiente ThreeJS indisponível, usando luz padrão", err);
    }

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      state.tryOn.loopRunning = false;
      showTryOnToast("Provador pausado. Reabra para continuar.", 2500);
    }, false);
    canvas.addEventListener("webglcontextrestored", () => {
      state.tryOn.three = null;
      state.tryOn.ringGroup = null;
      state.tryOn.ringUrl = "";
      state.tryOn.ringMetrics = null;
    }, false);
    state.tryOn.three = { THREE, GLTFLoader, scene, camera, renderer, ambientLight, keyLight: light };
    resizeTryOnCanvas();
    detectDepthCapabilityOnce().catch(() => {});
  }

  if (state.tryOn.ringUrl === modelUrl && state.tryOn.ringGroup) return true;

  if (state.tryOn.ringGroup) {
    state.tryOn.three.scene.remove(state.tryOn.ringGroup);
    state.tryOn.ringGroup = null;
    state.tryOn.ringMetrics = null;
  }

  const { THREE, GLTFLoader } = state.tryOn.three;
  const loader = new GLTFLoader();
  if (typeof loader.setCrossOrigin === "function") loader.setCrossOrigin("anonymous");

  const gltf = await new Promise((resolve, reject) => loader.load(modelUrl, resolve, undefined, reject));
  const obj = gltf.scene;

  // V25 FIX3 — AUTO HOOP FIT / PIVÔ DO ARO
  // O centro da bounding box de um solitário é puxado pela pedra. Se esse centro
  // for colocado no dedo, o aro parece cair para o dorso. Aqui o pivô passa a ser
  // o centro anatômico aproximado do BURACO do aro, não o centro visual da joia.
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const ringMetrics = estimateRingMetrics(obj, box, size, THREE);
  const hoopDiameter = ringMetrics.hoopDiameter;
  const hoopCenterY = ringMetrics.hoopCenterY;

  // CORREÇÃO DE PIVÔ (V25-FIX4): a V25 fazia `obj.position.set(-center.x, ...)`
  // usando o centro bruto, sem passar pela mesma rotação (Math.PI/2 em Y) e
  // escala (1/hoopDiameter) que são aplicadas ao resto da geometria.
  // Em Three.js, a matriz local de um objeto é T·R·S — ou seja, todo vértice
  // primeiro é escalado, depois rotacionado, e só então transladado por
  // `position`. Para o ponto que hoje está no centro do buraco (`center`,
  // `hoopCenterY`) acabar exatamente na origem do grupo (onde o dedo é
  // posicionado a cada frame), a translação precisa ser `-R·(S·pivot)`, não
  // simplesmente `-pivot`. Sem isso, o "centro" do aro nunca cai de fato
  // onde o código pensa que caiu — o que produz exatamente a sensação de
  // "objeto 3D colado", porque o ponto que é movido/girado a cada frame não
  // é o centro real do buraco do anel.
  const FIXED_ROTATION = new THREE.Euler(0, Math.PI / 2, 0);
  const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(FIXED_ROTATION);
  const scaleFactor = 1 / hoopDiameter;
  const pivotRaw = new THREE.Vector3(center.x, hoopCenterY, center.z);
  const pivotTransformed = pivotRaw.clone().multiplyScalar(scaleFactor).applyMatrix4(rotationMatrix);

  obj.scale.setScalar(scaleFactor);
  obj.rotation.copy(FIXED_ROTATION);
  obj.position.set(-pivotTransformed.x, -pivotTransformed.y, -pivotTransformed.z);

  const group = new THREE.Group();
  group.userData.ringMetrics = ringMetrics;
  group.add(obj);

  // CORREÇÃO DE OCLUSÃO (V25-FIX4): a V25 usava THREE.ShadowMaterial quando
  // disponível. ShadowMaterial é transparente por padrão (seu propósito é
  // desenhar sombra sobre o que já está atrás dele) — e objetos transparentes
  // entram na fila de renderização TRANSPARENTE do Three.js, que é desenhada
  // DEPOIS da fila OPACA, independente de `renderOrder` (renderOrder só
  // ordena dentro de cada fila, não entre elas). Como os meshes do anel usam
  // material opaco (padrão do GLTF), eles caem na fila opaca e são
  // desenhados ANTES do oclusor. Quando o oclusor finalmente grava
  // profundidade, o anel já foi pintado por completo — o truque de oclusão
  // não tem efeito nenhum. Por isso o aro nunca parece "atrás" do dedo.
  // A correção: usar um material explicitamente opaco (transparent:false)
  // que só grava profundidade, garantindo que ele entre na fila opaca e
  // renderize antes do anel (renderOrder -10 vs 2).
  const occluderMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    transparent: false
  });
  const occluder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 2, 32, 1, false, 0, Math.PI),
    occluderMaterial
  );
  occluder.name = "finger-occluder";
  occluder.rotation.x = Math.PI / 2;
  occluder.rotation.y = Math.PI;
  occluder.position.z = -0.2;
  occluder.renderOrder = -10;
  occluder.receiveShadow = true;
  group.add(occluder);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.36),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false })
  );
  contactShadow.name = "contact-shadow";
  contactShadow.position.z = -0.08;
  contactShadow.renderOrder = 0;
  group.add(contactShadow);

  obj.traverse((node) => {
    if (node?.isMesh) {
      node.renderOrder = 2;
      node.castShadow = true;
      node.receiveShadow = true;
      // CORREÇÃO DE MATERIAL (V25-FIX4): a V25 forçava metalness>=0.85 e
      // roughness<=0.28 em TODO material do modelo, sem checar o que é. Isso
      // funciona para o aro de metal, mas reescreve pedras, esmalte, pérola
      // ou qualquer parte não-metálica para parecer metal polido também —
      // é um problema "geométrico/material" real para qualquer joia que não
      // seja 100% metal liso. Removido: o ambiente PMREM (RoomEnvironment,
      // já configurado mais acima) já entrega reflexo realista ao metal
      // autêntico do GLB sem reescrever a autoria do material.
    }
  });

  group.visible = false;

  state.tryOn.three.scene.add(group);
  state.tryOn.ringGroup = group;
  state.tryOn.ringModel = obj;
  state.tryOn.ringUrl = modelUrl;
  state.tryOn.ringMetrics = ringMetrics;
  return true;
}


async function detectDepthCapabilityOnce() {
  if (state.tryOn.depthChecked) return state.tryOn.depthAvailable;
  state.tryOn.depthChecked = true;
  state.tryOn.depthAvailable = false;
  state.tryOn.depthMode = "mediapipe-invisible-hand-rig";
  try {
    if (navigator.xr?.isSessionSupported) {
      const supported = await navigator.xr.isSessionSupported("immersive-ar");
      // Importante: suporte a immersive-ar não garante depth ativo. WebXR Depth precisa
      // de uma sessão XR real e navegador/aparelho compatível. Como este provador usa
      // getUserMedia + MediaPipe, mantemos o modo seguro e deixamos o motor pronto para
      // promover para depth real numa V34 nativa/WebXR, sem quebrar o fluxo atual.
      state.tryOn.depthAvailable = Boolean(supported);
      state.tryOn.depthMode = supported ? "webxr-ar-available-fallback-rig" : "mediapipe-invisible-hand-rig";
    }
  } catch (_) {
    state.tryOn.depthAvailable = false;
    state.tryOn.depthMode = "mediapipe-invisible-hand-rig";
  }
  return state.tryOn.depthAvailable;
}

function ensureInvisibleHandRig() {
  const three = state.tryOn.three;
  if (!three?.THREE || !three.scene) return null;
  if (state.tryOn.handRig) return state.tryOn.handRig;

  const { THREE } = three;
  const rig = new THREE.Group();
  rig.name = "invisible-3d-hand-rig";
  rig.renderOrder = -100;

  const material = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: true,
    transparent: false,
    side: THREE.DoubleSide
  });
  state.tryOn.handRigMaterial = material;

  // Um dedo invisível é um tubo/cápsula aproximado. Ele não aparece no vídeo;
  // apenas grava profundidade antes do anel. Isso faz o aro traseiro sumir por trás
  // de um volume de dedo, em vez de um oclusor preso no próprio anel.
  const tubeGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 1, false);
  const jointGeo = new THREE.SphereGeometry(0.5, 24, 12);

  const tube = new THREE.Mesh(tubeGeo, material);
  tube.name = "selected-finger-tube";
  tube.renderOrder = -100;
  tube.visible = false;
  rig.add(tube);

  const mcpJoint = new THREE.Mesh(jointGeo, material);
  mcpJoint.name = "selected-finger-mcp-joint";
  mcpJoint.renderOrder = -100;
  mcpJoint.visible = false;
  rig.add(mcpJoint);

  const pipJoint = new THREE.Mesh(jointGeo, material);
  pipJoint.name = "selected-finger-pip-joint";
  pipJoint.renderOrder = -100;
  pipJoint.visible = false;
  rig.add(pipJoint);

  three.scene.add(rig);
  state.tryOn.handRig = rig;
  return rig;
}

function hideInvisibleHandRig() {
  const rig = state.tryOn.handRig;
  if (!rig) return;
  rig.visible = false;
  rig.children?.forEach((child) => { child.visible = false; });
}

function updateInvisibleHandRig(pose) {
  const three = state.tryOn.three;
  const rig = ensureInvisibleHandRig();
  if (!three?.THREE || !rig || !pose || !Number.isFinite(pose.angle)) {
    hideInvisibleHandRig();
    return;
  }

  const tube = rig.getObjectByName("selected-finger-tube");
  const mcpJoint = rig.getObjectByName("selected-finger-mcp-joint");
  const pipJoint = rig.getObjectByName("selected-finger-pip-joint");
  if (!tube || !mcpJoint || !pipJoint) return;

  // Preferimos MCP/PIP reais suavizados. Se não houver, usa o assento + eixo.
  const mcp = pose.mcp || {
    x: (pose.seatX ?? pose.x) - Math.cos(pose.angle) * (pose.rawPhalanxLen || pose.fingerLength || 40) * 0.38,
    y: (pose.seatY ?? pose.y) - Math.sin(pose.angle) * (pose.rawPhalanxLen || pose.fingerLength || 40) * 0.38
  };
  const pip = pose.pip || {
    x: mcp.x + Math.cos(pose.angle) * (pose.rawPhalanxLen || pose.fingerLength || 40),
    y: mcp.y + Math.sin(pose.angle) * (pose.rawPhalanxLen || pose.fingerLength || 40)
  };

  const dx = pip.x - mcp.x;
  const dy = pip.y - mcp.y;
  const length = Math.max(8, Math.hypot(dx, dy));
  const diameter = Math.max(6, Number(pose.fingerDiameter || pose.occlusionWidth * 0.22 || pose.fingerLength * 0.16 || 14));
  const depthDiameter = diameter * 0.68;
  const cx = mcp.x + dx * 0.5;
  const cy = mcp.y + dy * 0.5;
  const angle = Math.atan2(dy, dx);

  rig.visible = true;

  tube.visible = true;
  tube.position.set(cx, cy, -0.32);
  // CylinderGeometry cresce no eixo Y. Rotaciona para alinhar Y local ao eixo MCP→PIP.
  tube.rotation.set(Math.PI / 2, 0, angle - Math.PI / 2);
  tube.scale.set(diameter, length, depthDiameter);

  mcpJoint.visible = true;
  mcpJoint.position.set(mcp.x, mcp.y, -0.32);
  mcpJoint.rotation.set(0, 0, 0);
  mcpJoint.scale.set(diameter * 0.92, diameter * 0.92, depthDiameter * 0.92);

  pipJoint.visible = true;
  pipJoint.position.set(pip.x, pip.y, -0.32);
  pipJoint.rotation.set(0, 0, 0);
  pipJoint.scale.set(diameter * 0.86, diameter * 0.86, depthDiameter * 0.86);
}

function applyRingTransform(transform, item = {}) {
  const three = state.tryOn.three;
  const group = state.tryOn.ringGroup;
  if (!three || !group) return;

  if (!transform) {
    group.visible = false;
    hideInvisibleHandRig();
    three.renderer.render(three.scene, three.camera);
    return;
  }

  const pose = state.tryOn.calibration ? applyCalibrationToPose(transform, state.tryOn.calibration) : transform;
  if (!isFinitePose(pose)) {
    group.visible = false;
    hideInvisibleHandRig();
    three.renderer.render(three.scene, three.camera);
    return;
  }

  const manual = defaultManualOffset(state.tryOn.manualOffset);
  const rotacaoExtra = Number(item.rotacao || 0) * (Math.PI / 180);
  const escalaItem = Number(item.escala || 1);

  const occluder = group.getObjectByName?.("finger-occluder");
  updateInvisibleHandRig(pose);
  if (occluder) occluder.visible = false; // V33: oclusão principal agora vem da mão 3D invisível independente

  if (three.camera?.isPerspectiveCamera && pose.worldPos && pose.quaternion) {
    const calib = state.tryOn.calibration || {};
    const finalScale = clampNumber((pose.fingerWidthWorld || 6) * 1.02 * Number(manual.scale || 1) * Number(calib.scaleMult || 1) * escalaItem, 1.0, 80);
    group.visible = true;
    group.position.copy(pose.worldPos);
    group.quaternion.copy(pose.quaternion);

    const pxToWorld = Math.max(0.015, finalScale / 120);
    group.translateX((Number(calib.localX || 0) + Number(manual.x || 0)) * pxToWorld);
    group.translateY((Number(calib.localY || 0) + Number(manual.y || 0)) * pxToWorld);
    group.translateZ(clampNumber(Number(pose.occlusionDepth ?? manual.depth ?? -0.24), -1.2, 0.8) * 0.15);
    group.rotateZ(rotacaoExtra + Number(calib.rotDelta || 0) + Number(manual.rotate || 0));
    group.scale.setScalar(finalScale);

    if (occluder) {
      const occScale = clampNumber(Number(pose.occlusionScale || state.tryOn.calibration?.occlusionScale || manual.occlusion || 1), 0.35, 2.0);
      occluder.scale.set(1.0 * occScale, 1.50, 0.65 * occScale);
      occluder.position.z = -0.2 + clampNumber(Number(manual.depth || 0) * 0.15, -0.3, 0.3);
    }
  } else {
    const metrics = state.tryOn.ringMetrics || group.userData?.ringMetrics || { boreRatio: 0.68, clearance: 1.07 };
    const finalX = (pose.seatX ?? pose.x) + Number(manual.x || 0);
    const finalY = (pose.seatY ?? pose.y) + Number(manual.y || 0);
    const fingerDiameter = Math.max(1, Number(pose.fingerDiameter || pose.occlusionWidth || pose.fingerLength * 0.34 || 1));
    const boreRatio = clampNumber(Number(metrics.boreRatio || 0.68), 0.52, 0.82);
    const clearance = clampNumber(Number(metrics.clearance || 1.07), 1.02, 1.18);
    const finalScale = clampNumber((fingerDiameter / boreRatio) * clearance * Number(manual.scale || 1) * escalaItem, 14, 260);
    const finalAngle = pose.angle + rotacaoExtra + Number(manual.rotate || 0) + (Math.PI / 2);
    const finalDepth = clampNumber(Number(pose.occlusionDepth ?? state.tryOn.calibration?.occlusionDepth ?? manual.depth ?? -0.24), -1.2, 0.8);
    const finalPitch = Number(pose.pitch || 0) + Number(manual.pitch || 0);
    const finalYaw = Number(pose.yaw || 0) + Number(manual.yaw || 0);

    group.visible = true;
    group.position.set(finalX, finalY, finalDepth);
    group.rotation.set(finalPitch, finalYaw, finalAngle);
    group.scale.setScalar(finalScale);

    if (occluder) {
      const tubeLocalDiameter = clampNumber(fingerDiameter / Math.max(finalScale, 1), 0.34, 1.05);
      const tubeLocalLength = clampNumber((pose.rawPhalanxLen || pose.rawFingerLength || pose.fingerLength) * 0.72 / Math.max(finalScale * 2, 1), 0.72, 2.80);
      const occScale = clampNumber(Number(pose.occlusionScale || state.tryOn.calibration?.occlusionScale || manual.occlusion || 1), 0.35, 2.0);
      occluder.scale.set(tubeLocalDiameter * occScale, tubeLocalLength, tubeLocalDiameter * 0.64 * occScale);
      occluder.position.z = -0.2 + clampNumber(Number(manual.depth || 0) * 0.15, -0.3, 0.3);
    }
  }

  const contactShadow = group.getObjectByName?.("contact-shadow");
  if (contactShadow) {
    const ratio = clampNumber((pose.occlusionWidth || pose.fingerLength) / Math.max(pose.fingerLength, 1), 0.62, 1.15);
    contactShadow.scale.set(0.92 * ratio, 0.72 * ratio, 1);
    contactShadow.position.z = -0.10;
    if (contactShadow.material) contactShadow.material.opacity = state.tryOn.trackingState === "FROZEN" ? 0.08 : 0.12;
  }

  sampleVideoLighting($("arCameraVideo"));

  three.renderer.clearDepth?.();
  three.renderer.render(three.scene, three.camera);

  if (state.tryOn.debug) updateDebugInfo(pose, state.tryOn.calibration || state.tryOn.manualOffset);
}

function startHandLoop(item) {
  if (state.tryOn.loopRunning) return;
  state.tryOn.loopRunning = true;
  state.tryOn.frameBusy = false;
  state.tryOn.frameLast = 0;
  state.tryOn.lastFrameTime = performance.now();
  state.tryOn.lastSeenTime = 0;
  state.tryOn.trackingState = "LOST";

  const loop = async (ts = performance.now()) => {
    if (!state.tryOn.loopRunning) return;
    state.tryOn.rafId = requestAnimationFrame(loop);
    const video = $("arCameraVideo");
    const stage = $("arTryOnStage");
    const safeDt = Math.min(Math.max(ts - (state.tryOn.lastFrameTime || ts), 1), 100);
    state.tryOn.lastFrameTime = ts;

    const enoughTime = !state.tryOn.frameLast || (ts - state.tryOn.frameLast) >= 33;
    if (video?.readyState >= 2 && state.tryOn.handsApi && !state.tryOn.frameBusy && enoughTime) {
      state.tryOn.frameBusy = true;
      state.tryOn.frameLast = ts;
      try {
        await state.tryOn.handsApi.send({ image: video });
      } catch (err) {
        console.warn("Falha temporária na detecção da mão:", err);
      } finally {
        state.tryOn.frameBusy = false;
      }
    }

    if (stage && video) {
      const rect = stage.getBoundingClientRect();

      // V29: modo Ajustar congela o último encaixe válido.
      // Assim o anel NÃO some quando o usuário tira a mão da câmera para ajustar com a outra mão.
      if (state.tryOn.manualMode && (state.tryOn.frozenPose || state.tryOn.smoothed)) {
        state.tryOn.frozenPose = cloneTryOnPose(state.tryOn.frozenPose || state.tryOn.smoothed);
        state.tryOn.smoothed = cloneTryOnPose(state.tryOn.frozenPose);
        state.tryOn.trackingState = "FROZEN";
        setViewerTryOnHint("Ajuste congelado · arraste/gire o anel");
        applyRingTransform(state.tryOn.smoothed, item);
        return;
      }

      let raw = null;
      let recovering = false;
      if (state.tryOn.landmarks) {
        raw = computeFingerTransform(state.tryOn.landmarks, state.tryOn.finger, rect, video);
        if (raw) {
          if (state.tryOn.ghostVisible) hideGhostGuide();
          recovering = state.tryOn.trackingState === "LOST";
          state.tryOn.lastSeenTime = ts;
          state.tryOn.trackingState = recovering ? "RECOVERING" : "TRACKING";
        }
      }

      if (!raw) {
        if (state.tryOn.manualMode && state.tryOn.smoothed) {
          state.tryOn.frozenPose = cloneTryOnPose(state.tryOn.smoothed);
          state.tryOn.trackingState = "FROZEN";
          setViewerTryOnHint("Ajuste congelado · arraste/gire o anel");
          applyRingTransform(state.tryOn.smoothed, item);
          return;
        }
        const lostFor = ts - (state.tryOn.lastSeenTime || 0);
        if (state.tryOn.smoothed && lostFor <= 500) {
          state.tryOn.trackingState = "FROZEN";
          setViewerTryOnHint("Reposicione a mão");
        } else {
          state.tryOn.trackingState = "LOST";
          state.tryOn.smoothed = null;
          setViewerTryOnHint("Mostre a mão para a câmera");
        }
      } else {
        state.tryOn.smoothed = smoothTransform(state.tryOn.smoothed, raw, safeDt, recovering);
        if (state.tryOn.trackingState === "RECOVERING") state.tryOn.trackingState = "TRACKING";
        setViewerTryOnHint("");
      }

      applyRingTransform(state.tryOn.smoothed, item);
    }
  };

  state.tryOn.rafId = requestAnimationFrame(loop);
}

function disposeThreeObject(obj) {
  if (!obj) return;
  obj.traverse?.((node) => {
    if (node.geometry?.dispose) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((mat) => {
      Object.values(mat).forEach((value) => { if (value?.isTexture && value.dispose) value.dispose(); });
      if (mat.dispose) mat.dispose();
    });
  });
}

function stopHandLoop() {
  state.tryOn.loopRunning = false;
  if (state.tryOn.rafId) {
    cancelAnimationFrame(state.tryOn.rafId);
    state.tryOn.rafId = null;
  }
  state.tryOn.landmarks = null;
  state.tryOn.smoothed = null;
  state.tryOn.frozenPose = null;
  state.tryOn.trackingState = "LOST";
  if (state.tryOn.ringGroup) state.tryOn.ringGroup.visible = false;
}

let tryOnHintTimer = null;
function setViewerTryOnHint(text) {
  // Evita repetir o mesmo toast a cada frame; só atualiza quando muda.
  const el = $("arTryOnToast");
  if (!el) return;
  if (!text) {
    if (el.dataset.kind === "hint") {
      el.classList.remove("is-visible");
      el.dataset.kind = "";
    }
    return;
  }
  if (el.dataset.kind === "hint" && el.textContent === text) return;
  el.dataset.kind = "hint";
  el.hidden = false;
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add("is-visible"));
}

function showTryOnToast(text, duration = 1500) {
  const el = $("arTryOnToast");
  if (!el) return;
  el.dataset.kind = "toast";
  el.hidden = false;
  el.textContent = text;
  el.classList.add("is-visible");
  clearTimeout(tryOnHintTimer);
  tryOnHintTimer = setTimeout(() => {
    el.classList.remove("is-visible");
    el.dataset.kind = "";
  }, duration);
}

function setActiveFinger(name) {
  const next = FINGER_LANDMARKS[name] ? name : "anelar";
  state.tryOn.finger = next;

  // Reset real ao trocar de dedo: não reaproveita filtro, calibração nem arrasto
  // de outro dedo. Isso corrige o botão visual sem efeito e o anel “desobediente”.
  state.tryOn.smoothed = null;
  state.tryOn.frozenPose = null;
  state.tryOn.trackingState = "LOST";
  state.tryOn.recoveryFrames = 0;
  state.tryOn.frozenPose = null;
  const storedFit = loadFitCalibration(next);
  state.tryOn.calibration = storedFit;
  state.tryOn.locked = Boolean(storedFit);
  state.tryOn.manualOffset = storedFit ? calibrationToManual(storedFit) : defaultManualOffset();
  setManualMode(false);
  syncFitPanelFromManual();

  document.querySelectorAll("#arFingerSelector [data-finger]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.finger === next);
  });

  const lockBtn = $("arLockBtn");
  if (lockBtn) {
    lockBtn.textContent = state.tryOn.locked ? "Travado" : "Travar";
    lockBtn.classList.toggle("is-active", state.tryOn.locked);
    lockBtn.title = state.tryOn.locked ? "Toque duas vezes para recalibrar" : "";
  }

  showTryOnToast(FINGER_LABELS[state.tryOn.finger]);
}

function cycleFinger() {
  const idx = FINGER_SEQUENCE.indexOf(state.tryOn.finger);
  const next = FINGER_SEQUENCE[(idx + 1) % FINGER_SEQUENCE.length];
  setActiveFinger(next);
}

function chooseFingerFromEvent(event) {
  const btn = event?.target?.closest?.("[data-finger]");
  if (!btn) return;
  setActiveFinger(btn.dataset.finger);
}

function setManualMode(active) {
  const nextManualMode = Boolean(active);
  if (nextManualMode && !(state.tryOn.smoothed || state.tryOn.frozenPose)) {
    showTryOnToast("Mostre a mao primeiro");
    return false;
  }
  state.tryOn.manualMode = nextManualMode;
  const canvas = $("arRingCanvas");
  const btn = $("arAdjustBtn");
  const panel = $("arFitPanel");
  if (canvas) canvas.classList.toggle("is-adjusting", state.tryOn.manualMode);
  if (btn) btn.classList.toggle("is-active", state.tryOn.manualMode);
  const allowPanel = isFitPanelAllowed();
  if (panel) panel.hidden = !(state.tryOn.manualMode && allowPanel);
  if (state.tryOn.manualMode) {
    state.tryOn.frozenPose = cloneTryOnPose(state.tryOn.smoothed || state.tryOn.frozenPose);
    if (state.tryOn.frozenPose) state.tryOn.trackingState = "FROZEN";
    state.tryOn.manualOffset = defaultManualOffset(state.tryOn.manualOffset);
    if (allowPanel) {
      wireFitPanelEvents();
      syncFitPanelFromManual();
    }
  } else {
    state.tryOn.frozenPose = null;
  }
  return true;
}

function toggleAdjustMode() {
  const changed = setManualMode(!state.tryOn.manualMode);
  if (changed === false) return;
  showTryOnToast(state.tryOn.manualMode ? "Ajuste com um dedo · pince para tamanho/giro" : "Ajuste automático");
}

function lockCalibration() {
  const poseForCalibration = state.tryOn.frozenPose || state.tryOn.smoothed;
  if (!poseForCalibration) {
    showTryOnToast("Mostre a mão uma vez, depois toque em Ajustar");
    return;
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(50); } catch (_) {}
  }
  state.tryOn.calibration = computeCalibrationDelta(poseForCalibration, state.tryOn.manualOffset);
  saveFitCalibration(state.tryOn.calibration);
  state.tryOn.manualOffset = defaultManualOffset();
  setManualMode(false);
  state.tryOn.frozenPose = null;
  state.tryOn.locked = true;
  const btn = $("arLockBtn");
  if (btn) {
    btn.textContent = "Travado";
    btn.classList.add("is-active");
    btn.title = "Toque duas vezes para recalibrar";
  }
  showTryOnToast("Ancoragem guardada");
}

function resetCalibration() {
  state.tryOn.locked = false;
  state.tryOn.calibration = null;
  state.tryOn.manualOffset = defaultManualOffset();
  state.tryOn.frozenPose = null;
  clearFitCalibration();
  syncFitPanelFromManual();
  const btn = $("arLockBtn");
  if (btn) {
    btn.textContent = "Travar";
    btn.classList.remove("is-active");
    btn.title = "";
  }
  setManualMode(false);
  showTryOnToast("Calibração zerada");
}

function updateDebugInfo(pose, extra = {}) {
  state.tryOn.debugFrameCount = (state.tryOn.debugFrameCount || 0) + 1;
  const now = performance.now();
  if (!state.tryOn.debugLastFpsTime) state.tryOn.debugLastFpsTime = now;
  if (now - state.tryOn.debugLastFpsTime >= 1000) {
    state.tryOn.debugFps = state.tryOn.debugFrameCount;
    state.tryOn.debugFrameCount = 0;
    state.tryOn.debugLastFpsTime = now;
  }
  setText("debugFps", String(state.tryOn.debugFps || "-"));
  const metrics = state.tryOn.ringMetrics || {};
  setText("debugScale", pose?.fingerDiameter ? `dedo ${Math.round(pose.fingerDiameter)}px · aro ${(Number(metrics.boreRatio || 0.68)).toFixed(2)}` : "-");
  setText("debugFinger", `${FINGER_LABELS[state.tryOn.finger] || state.tryOn.finger} · ${state.tryOn.trackingState}${pose?.isCollapsed ? " · COLAPSADO" : ""}`);
  setText("debugAngle", Number.isFinite(pose?.angle) ? `${Math.round(pose.angle * 180 / Math.PI)}°` : "-");
  setText("debugPos", pose ? `${Math.round(pose.seatX ?? pose.x)}, ${Math.round(pose.seatY ?? pose.y)} · seat ${Number(pose.seatFactor || 0.55).toFixed(2)}` : "-");
  const calib = state.tryOn.calibration;
  if (calib) setText("debugOffset", `local ${Number(calib.localX||0).toFixed(1)}, ${Number(calib.localY||0).toFixed(1)} · z ${Number(calib.occlusionDepth ?? -0.24).toFixed(2)} · pitch ${Math.round(Number(calib.pitchOffset||0)*180/Math.PI)}° · s ${Number(calib.scaleMult||1).toFixed(2)}`);
  else setText("debugOffset", `manual ${Number(extra.x||0).toFixed(1)}, ${Number(extra.y||0).toFixed(1)} · z ${Number(extra.depth ?? -0.24).toFixed(2)} · pitch ${Math.round(Number(extra.pitch||0)*180/Math.PI)}° · s ${Number(extra.scale||1).toFixed(2)}`);
}

function toggleDebugPanel(force) {
  state.tryOn.debug = typeof force === "boolean" ? force : !state.tryOn.debug;
  setHidden("arDebugPanel", !state.tryOn.debug);
  showTryOnToast(state.tryOn.debug ? "Debug geométrico ligado" : "Debug desligado");
}

function wireAdjustGestures() {
  const canvas = $("arRingCanvas");
  if (!canvas || canvas.dataset.gestureWired) return;
  canvas.dataset.gestureWired = "1";

  const pointers = new Map();
  let startDistance = 0;
  let startAngle = 0;
  let startScale = 1;
  let startRotate = 0;
  let lastSingle = null;

  const angleBetween = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const distanceBetween = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.tryOn.manualMode) return;
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1) {
      lastSingle = { x: event.clientX, y: event.clientY };
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      startDistance = distanceBetween(a, b) || 1;
      startAngle = angleBetween(a, b);
      startScale = state.tryOn.manualOffset.scale;
      startRotate = state.tryOn.manualOffset.rotate;
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.tryOn.manualMode || !pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 1 && lastSingle) {
      const dx = event.clientX - lastSingle.x;
      const dy = event.clientY - lastSingle.y;
      state.tryOn.manualOffset.x += dx;
      state.tryOn.manualOffset.y += dy;
      lastSingle = { x: event.clientX, y: event.clientY };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = distanceBetween(a, b) || 1;
      const angle = angleBetween(a, b);
      state.tryOn.manualOffset.scale = clampNumber(startScale * (distance / startDistance), 0.4, 2.6);
      state.tryOn.manualOffset.rotate = startRotate + (angle - startAngle);
    }
  });

  const release = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const [remaining] = [...pointers.values()];
      lastSingle = remaining || null;
    } else if (pointers.size === 0) {
      lastSingle = null;
    }
  };

  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
}

async function captureTryOnPhoto() {
  const video = $("arCameraVideo");
  const ringCanvas = $("arRingCanvas");
  const stage = $("arTryOnStage");
  if (!video || !ringCanvas || !stage) return;

  try {
    const rect = stage.getBoundingClientRect();
    const out = document.createElement("canvas");
    const photoScale = 2;
    out.width = Math.round(rect.width * photoScale);
    out.height = Math.round(rect.height * photoScale);
    const ctx = out.getContext("2d");

    // Desenha o vídeo respeitando o mesmo recorte (object-fit: cover) usado no tracking.
    const vw = video.videoWidth || rect.width;
    const vh = video.videoHeight || rect.height;
    const scale = Math.max(rect.width / vw, rect.height / vh);
    const drawW = vw * scale;
    const drawH = vh * scale;
    const offsetX = (rect.width - drawW) / 2;
    const offsetY = (rect.height - drawH) / 2;
    ctx.drawImage(video, offsetX * photoScale, offsetY * photoScale, drawW * photoScale, drawH * photoScale);

    const three = state.tryOn.three;
    if (three?.renderer && three?.scene && three?.camera) {
      try {
        three.renderer.setPixelRatio(photoScale);
        three.renderer.setSize(rect.width, rect.height, false);
        three.renderer.render(three.scene, three.camera);
      } catch (err) { console.warn("Foto 2x: render fallback", err); }
    }
    ctx.drawImage(ringCanvas, 0, 0, out.width, out.height);
    if (three?.renderer) {
      three.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      resizeTryOnCanvas();
      if (three?.scene && three?.camera) three.renderer.render(three.scene, three.camera);
    }

    const blob = await new Promise((resolve) => out.toBlob(resolve, "image/png", 0.95));
    if (!blob) throw new Error("Não consegui gerar a imagem.");

    const file = new File([blob], "joia-provador.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Minha joia" });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "joia-provador.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    showTryOnToast("Foto salva");
  } catch (err) {
    console.error("Falha ao capturar foto do provador:", err);
    showTryOnToast("Não consegui gerar a foto agora");
  }
}

async function startTryOnCamera() {
  await stopTryOnCamera();
  const constraints = {
    audio: false,
    video: {
      facingMode: "environment",
      width: { ideal: 960 },
      height: { ideal: 1280 }
    }
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  state.tryOn.cameraStream = stream;
  const video = $("arCameraVideo");
  if (video) {
    video.srcObject = stream;
    await video.play();
  }
  resizeTryOnCanvas();
}

async function stopTryOnCamera() {
  stopHandLoop();
  try {
    if (state.tryOn.cameraStream) {
      state.tryOn.cameraStream.getTracks().forEach((track) => { try { track.stop(); } catch (_) {} });
      state.tryOn.cameraStream = null;
    }
  } catch (_) {
    state.tryOn.cameraStream = null;
  }
  if (state.tryOn.handsApi?.close) {
    try { state.tryOn.handsApi.close(); } catch (err) { console.warn("MediaPipe close", err); }
    state.tryOn.handsApi = null;
  }
  if (state.tryOn.ringGroup && state.tryOn.three?.scene) {
    state.tryOn.three.scene.remove(state.tryOn.ringGroup);
    disposeThreeObject(state.tryOn.ringGroup);
  }
  if (state.tryOn.handRig && state.tryOn.three?.scene) {
    state.tryOn.three.scene.remove(state.tryOn.handRig);
    disposeThreeObject(state.tryOn.handRig);
  }
  state.tryOn.handRig = null;
  state.tryOn.handRigMaterial = null;
  if (state.tryOn.three?.renderer?.dispose) state.tryOn.three.renderer.dispose();
  state.tryOn.ringGroup = null;
  state.tryOn.ringModel = null;
  state.tryOn.ringUrl = "";
  state.tryOn.ringMetrics = null;
  state.tryOn.three = null;
  const video = $("arCameraVideo");
  if (video) {
    try { video.pause?.(); } catch (_) {}
    try { video.srcObject = null; } catch (_) {}
  }
}

async function openHandTryOn() {
  const item = state.currentPublicItem || {};
  if (!item.modelGlbUrl && !item.glbUrl) {
    alert("Esta joia ainda não tem modelo 3D (.glb) cadastrado para o provador.");
    return;
  }

  setHidden("arTryOn", false);
  showGhostGuide();
  state.tryOn.active = true;
  state.tryOn.manualMode = false;
  state.tryOn.viewerPose = captureViewerPoseSeed();
  const storedFit = loadFitCalibration(state.tryOn.finger);
  state.tryOn.locked = Boolean(storedFit);
  state.tryOn.calibration = storedFit;
  state.tryOn.manualOffset = storedFit ? calibrationToManual(storedFit) : defaultManualOffset(state.tryOn.viewerPose || {});
  state.tryOn.frozenPose = null;
  syncFitPanelFromManual();
  state.tryOn.trackingState = "LOST";
  $("arRingCanvas")?.classList.remove("is-adjusting");
  $("arAdjustBtn")?.classList.remove("is-active");
  if ($("arLockBtn")) {
    $("arLockBtn").textContent = state.tryOn.locked ? "Travado" : "Travar";
    $("arLockBtn").classList.toggle("is-active", state.tryOn.locked);
  }

  try {
    await startTryOnCamera();
    await Promise.all([ensureHandsApi(), ensureRingModel(item)]);
    wireAdjustGestures();
    window.addEventListener("resize", resizeTryOnCanvas);
    resizeTryOnCanvas();
    startHandLoop(item);
    showTryOnToast(FINGER_LABELS[state.tryOn.finger]);
  } catch (err) {
    console.error("Falha ao iniciar o provador:", err);
    alert(`Não consegui abrir o provador: ${err?.message || err}. Verifique a permissão de câmera e a conexão.`);
    closeHandTryOn();
  }
}

function closeHandTryOn() {
  setHidden("arTryOn", true);
  const guide = $("arGhostGuide");
  if (guide) guide.hidden = true;
  state.tryOn.active = false;
  try { window.removeEventListener("resize", resizeTryOnCanvas); } catch (_) {}
  try { stopTryOnCamera(); } catch (err) { console.warn("tryOn cleanup", err); }
}

async function openNativeAR() {
  const mv = $("publicModelViewer");
  if (!mv) {
    alert("Modelo 3D ainda não carregou. Aguarde a joia aparecer e tente novamente.");
    return;
  }

  try {
    if (typeof mv.activateAR === "function") {
      await mv.activateAR();
      return;
    }
  } catch (err) {
    console.warn("activateAR falhou, tentando fallback visual:", err);
  }

  const arButton = mv.shadowRoot?.querySelector('[slot="ar-button"], button[slot="ar-button"]');
  if (arButton && typeof arButton.click === "function") {
    arButton.click();
    return;
  }

  alert("Este navegador não liberou o AR nativo. Tente abrir no Chrome Android ou Safari iPhone com o arquivo .glb/.usdz público.");
}

function wirePublicEvents() {
  $("publicOpenAR")?.addEventListener("click", openNativeAR);
  $("publicOpenTryOn")?.addEventListener("click", openHandTryOn);
  $("arCloseTryOn")?.addEventListener("click", closeHandTryOn);
  $("arAdjustBtn")?.addEventListener("click", toggleAdjustMode);
  $("arLockBtn")?.addEventListener("click", lockCalibration);
  $("arLockBtn")?.addEventListener("dblclick", resetCalibration);
  $("arCloseDebug")?.addEventListener("click", () => toggleDebugPanel(false));
  $("arDebugTrigger")?.addEventListener("click", () => {
    const now = performance.now();
    if (now - (state.tryOn.debugLastTap || 0) > 1300) state.tryOn.debugTapCount = 0;
    state.tryOn.debugTapCount = (state.tryOn.debugTapCount || 0) + 1;
    state.tryOn.debugLastTap = now;
    if (state.tryOn.debugTapCount >= 5) { state.tryOn.debugTapCount = 0; toggleDebugPanel(); }
  });
  $("arSwapFingerBtn")?.addEventListener("click", cycleFinger);
  $("arFingerSelector")?.addEventListener("click", chooseFingerFromEvent);
  $("arCaptureBtn")?.addEventListener("click", captureTryOnPhoto);
  wireFitPanelEvents();
  window.addEventListener("beforeunload", () => stopTryOnCamera());

  $("publicCopyLink")?.addEventListener("click", async () => {
    await copyText(location.href);
    $("publicCopyLink").textContent = "Copiado";
    setTimeout(() => { $("publicCopyLink").textContent = "Copiar link"; }, 1500);
  });
}

function initPublic() {
  wirePublicEvents();
  loadPublicCatalog();
}

function boot() {
  const page = document.body?.dataset?.arPage || "";
  window.__AR_JOIAS_BUILD_VERSION__ = AR_BUILD;

  if (page === "admin") initAdmin();
  if (page === "public") initPublic();
}

boot();
