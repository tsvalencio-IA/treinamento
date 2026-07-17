import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import { APP_CONFIG } from "./config.js";
import { uid } from "./utils.js";

const PLACEHOLDER_PATTERN = /COLE_AQUI|ALTERE_|SUA_|SEU_/i;

let firebaseApp = null;
let auth = null;
let database = null;
let authListener = null;

const DEFAULT_COLLECTIONS = [
  "clientes",
  "produtos",
  "pedidos",
  "vendas",
  "consignacoes",
  "cadastrosMostruario",
  "inventariosEstoque",
  "pedidosProducao",
  "producoes",
  "lotes",
  "pecasEstoque",
  "movimentos",
  "estoqueMovimentos",
  "alertasOperacionais",
  "vendedores",
  "tiposProduto",
  "parametrosTecnicos",
  "configuracoes",
  "usuarios",
  "auditoria",
  "iaConsultas",
  "comissoes"
];

const defaultData = () => ({
  clientes: {},
  produtos: {},
  pedidos: {},
  vendas: {},
  consignacoes: {},
  cadastrosMostruario: {},
  inventariosEstoque: {},
  pedidosProducao: {},
  producoes: {},
  lotes: {},
  pecasEstoque: {},
  movimentos: {},
  estoqueMovimentos: {},
  alertasOperacionais: {},
  comissoes: {},
  vendedores: {},
  usuarios: {},
  auditoria: {},
  iaConsultas: {},
  tiposProduto: {
    alianca: { nome: "Aliança", ativo: true },
    anel: { nome: "Anel", ativo: true },
    aparador: { nome: "Aparador", ativo: true },
    brinco: { nome: "Brinco", ativo: true },
    corrente: { nome: "Corrente", ativo: true },
    pingente: { nome: "Pingente", ativo: true },
    pulseira: { nome: "Pulseira", ativo: true },
    gargantilha: { nome: "Gargantilha", ativo: true },
    personalizado: { nome: "Personalizado", ativo: true }
  },
  parametrosTecnicos: {
    prata: {
      material: "Prata",
      teor: "925",
      observacao: "Cadastrar fórmula e parâmetros validados pela fábrica antes de usar cálculo técnico de produção."
    }
  },
  configuracoes: {
    percentualComissaoPadrao: APP_CONFIG.negocio.percentualComissaoPadrao,
    diasEstoqueParado: APP_CONFIG.negocio.diasEstoqueParado,
    estoqueMinimoPadrao: APP_CONFIG.negocio.estoqueMinimoPadrao
  },
  __acesso: {
    uid: "",
    email: "",
    papel: "sem_acesso",
    gestorConfig: false,
    ativo: false,
    colecoesCarregadas: []
  }
});

function configuredFirebase() {
  const cfg = APP_CONFIG.firebase || {};
  return Boolean(
    cfg.apiKey &&
    cfg.authDomain &&
    cfg.databaseURL &&
    cfg.projectId &&
    !PLACEHOLDER_PATTERN.test(Object.values(cfg).join(" "))
  );
}

function mergeDefaults(data = {}) {
  const base = defaultData();
  const merged = { ...base, ...data };

  DEFAULT_COLLECTIONS.forEach((collection) => {
    if (collection === "configuracoes" || collection === "tiposProduto" || collection === "parametrosTecnicos") return;
    merged[collection] = { ...(base[collection] || {}), ...(data[collection] || {}) };
  });

  merged.tiposProduto = { ...base.tiposProduto, ...(data.tiposProduto || {}) };
  merged.parametrosTecnicos = { ...base.parametrosTecnicos, ...(data.parametrosTecnicos || {}) };
  merged.configuracoes = { ...base.configuracoes, ...(data.configuracoes || {}) };
  merged.__acesso = { ...base.__acesso, ...(data.__acesso || {}) };

  return merged;
}

function ensureConfigured() {
  if (!configuredFirebase()) {
    throw new Error("O sistema ainda não foi conectado ao banco da operação. Finalize a configuração antes de usar.");
  }
}

function basePath(collection = "") {
  const suffix = collection ? `/${collection}` : "";
  return `empresas/${APP_CONFIG.empresaId}${suffix}`;
}

function perfilFallbackDono(user) {
  return {
    uid: user?.uid || "",
    id: user?.uid || "",
    nome: "Vitor Gomes",
    email: user?.email || "vtgomes@ts.com",
    papel: "dono",
    cargo: "Dono da empresa",
    ativo: true
  };
}

async function tryGet(path, fallback = {}) {
  try {
    const snap = await get(ref(database, path));
    return snap.exists() ? snap.val() : fallback;
  } catch (err) {
    if (err?.code === "PERMISSION_DENIED") return fallback;
    console.warn(`Leitura ignorada em ${path}:`, err);
    return fallback;
  }
}

function roleOf(profile = {}, gestorConfig = false) {
  if (gestorConfig) return "dono";
  return String(profile?.papel || "sem_acesso").toLowerCase();
}

function isActive(profile = {}, gestorConfig = false) {
  if (gestorConfig) return true;
  return Boolean(profile && Object.keys(profile).length && profile.ativo !== false);
}

function canReadAdminCollections(role, gestorConfig = false) {
  return gestorConfig || role === "dono" || role === "gerente";
}

function canReadOwnerCollections(role, gestorConfig = false) {
  return gestorConfig || role === "dono";
}

export const FirebaseClient = {
  mode: configuredFirebase() ? "firebase" : "aguardando_configuracao",

  isFirebaseConfigured: configuredFirebase,

  async init() {
    if (!configuredFirebase()) return { mode: "aguardando_configuracao" };
    if (!firebaseApp) {
      firebaseApp = initializeApp(APP_CONFIG.firebase);
      auth = getAuth(firebaseApp);
      database = getDatabase(firebaseApp);
    }
    return { mode: "firebase" };
  },

  onAuth(callback) {
    if (!configuredFirebase()) {
      callback(null);
      return () => {};
    }
    if (authListener) authListener();
    authListener = onAuthStateChanged(auth, callback);
    return authListener;
  },

  async signIn(email, password) {
    ensureConfigured();
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  },

  async signOut() {
    ensureConfigured();
    await firebaseSignOut(auth);
  },

  isGestor(user) {
    if (!user) return false;
    const email = (user.email || "").toLowerCase();
    const uidValue = user.uid || "";
    const emails = (APP_CONFIG.gestores?.emails || []).map((item) => String(item).toLowerCase());
    const uids = APP_CONFIG.gestores?.uids || [];
    return emails.includes(email) || uids.includes(uidValue);
  },

  /**
   * V21: leitura segura por coleção.
   *
   * Importante:
   * - Não lê mais "empresas/{empresaId}" inteiro.
   * - Carrega primeiro o perfil do usuário em "usuarios/{uid}".
   * - Carrega "comissoes" somente para Vitor/dono.
   * - Carrega "auditoria" e lista de "usuarios" somente para dono/gerente.
   */
  async loadSecureData() {
    ensureConfigured();

    const user = auth?.currentUser;
    if (!user) return mergeDefaults({});

    const uidValue = user.uid || "";
    const email = String(user.email || "").toLowerCase();

    const gestorConfigLocal = this.isGestor(user);
    const gestorBanco = await tryGet(`gestores/${uidValue}`, false);
    const gestorConfig = gestorConfigLocal || gestorBanco === true;

    let ownProfile = await tryGet(basePath(`usuarios/${uidValue}`), {});
    if ((!ownProfile || !Object.keys(ownProfile).length) && gestorConfig) {
      ownProfile = perfilFallbackDono(user);
    }

    const role = roleOf(ownProfile, gestorConfig);
    const active = isActive(ownProfile, gestorConfig);

    const data = defaultData();
    data.usuarios = ownProfile && Object.keys(ownProfile).length
      ? { [uidValue]: { ...ownProfile, uid: ownProfile.uid || uidValue, email: ownProfile.email || email } }
      : {};

    data.__acesso = {
      uid: uidValue,
      email,
      papel: role,
      gestorConfig,
      ativo: active,
      colecoesCarregadas: []
    };

    if (!active) return mergeDefaults(data);

    const colecoesOperacionais = [
      "configuracoes",
      "tiposProduto",
      "produtos",
      "clientes",
      "vendedores",
      "pedidos",
      "vendas",
      "consignacoes",
      "cadastrosMostruario",
      "inventariosEstoque",
      "pedidosProducao",
      "lotes",
      "pecasEstoque",
      "movimentos",
      "estoqueMovimentos",
      "alertasOperacionais"
    ];

    const colecoesAdmin = [
      "usuarios",
      "auditoria",
      "iaConsultas",
      "parametrosTecnicos",
      "producoes"
    ];

    const colecoesDono = [
      "comissoes"
    ];

    const colecoesParaLer = [
      ...colecoesOperacionais,
      ...(canReadAdminCollections(role, gestorConfig) ? colecoesAdmin : []),
      ...(canReadOwnerCollections(role, gestorConfig) ? colecoesDono : [])
    ];

    await Promise.all(colecoesParaLer.map(async (collection) => {
      const value = await tryGet(basePath(collection), {});
      data[collection] = value || {};
      data.__acesso.colecoesCarregadas.push(collection);
    }));

    if (!canReadAdminCollections(role, gestorConfig)) {
      data.usuarios = ownProfile && Object.keys(ownProfile).length
        ? { [uidValue]: { ...ownProfile, uid: ownProfile.uid || uidValue, email: ownProfile.email || email } }
        : {};
      data.auditoria = {};
      data.iaConsultas = {};
      data.parametrosTecnicos = {};
      data.producoes = {};
    }

    if (!canReadOwnerCollections(role, gestorConfig)) {
      data.comissoes = {};
    }

    return mergeDefaults(data);
  },

  async getCollection(collection) {
    ensureConfigured();
    const snap = await get(ref(database, basePath(collection)));
    return snap.exists() ? snap.val() : {};
  },

  async save(collection, id, value) {
    ensureConfigured();
    if (!id) id = uid(collection);
    await set(ref(database, `${basePath(collection)}/${id}`), value);
    return id;
  },

  async patch(collection, id, value) {
    ensureConfigured();
    await update(ref(database, `${basePath(collection)}/${id}`), value);
    return id;
  },

  async push(collection, value) {
    ensureConfigured();
    const newRef = push(ref(database, basePath(collection)));
    await set(newRef, value);
    return newRef.key;
  },

  async setCollection(collection, value) {
    ensureConfigured();
    await set(ref(database, basePath(collection)), value);
  },

  async remove(collection, id) {
    ensureConfigured();
    await remove(ref(database, `${basePath(collection)}/${id}`));
  }
};
