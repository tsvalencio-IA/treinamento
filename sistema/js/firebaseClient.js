import { DEMO_DATA, DEMO_USERS } from "./demo-data.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const roleMap = {
  dono: "demo-owner",
  gerente: "demo-manager",
  vendedor: "demo-seller",
  atendente: "demo-attendant",
  entregador: "demo-delivery"
};
let memory = clone(DEMO_DATA);
let authCallback = null;

function selectedRole() {
  const role = String(localStorage.getItem("glamore.training.role") || "dono").toLowerCase();
  return roleMap[role] ? role : "dono";
}
function currentUser() {
  if (localStorage.getItem("glamore.training.loggedOut") === "true") return null;
  const id = roleMap[selectedRole()];
  const profile = DEMO_USERS[id];
  return { uid: id, email: profile.email, displayName: profile.nome };
}
function accessData() {
  const role = selectedRole();
  const user = currentUser();
  const result = clone(memory);
  result.__acesso = {
    uid: user?.uid || "",
    email: user?.email || "",
    papel: role,
    gestorConfig: role === "dono",
    ativo: Boolean(user),
    colecoesCarregadas: Object.keys(result)
  };
  if (!["dono", "gerente"].includes(role)) {
    result.auditoria = {};
    result.producoes = {};
    result.parametrosTecnicos = {};
    result.usuarios = user ? { [user.uid]: clone(DEMO_USERS[user.uid]) } : {};
  }
  if (role !== "dono") result.comissoes = {};
  return result;
}
function id(prefix="demo") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function blocked() {
  throw new Error("Modo de treinamento: nenhuma alteração é enviada ao sistema real.");
}

export const FirebaseClient = {
  mode: "treinamento_local",
  isFirebaseConfigured: () => true,
  async init() { return { mode: "treinamento_local" }; },
  onAuth(callback) {
    authCallback = callback;
    queueMicrotask(() => callback(currentUser()));
    return () => { authCallback = null; };
  },
  async signIn() {
    localStorage.removeItem("glamore.training.loggedOut");
    const user = currentUser();
    authCallback?.(user);
    return user;
  },
  async signOut() {
    localStorage.setItem("glamore.training.loggedOut", "true");
    authCallback?.(null);
  },
  isGestor(user) { return Boolean(user) && selectedRole() === "dono"; },
  async loadSecureData() { return accessData(); },
  async getCollection(collection) { return clone(memory[collection] || {}); },
  async save(collection, recordId, value) {
    // Training data can change only in memory if an action bypasses the visual guard.
    const finalId = recordId || id(collection);
    memory[collection] = memory[collection] || {};
    memory[collection][finalId] = clone(value);
    return finalId;
  },
  async patch(collection, recordId, value) {
    memory[collection] = memory[collection] || {};
    memory[collection][recordId] = { ...(memory[collection][recordId] || {}), ...clone(value) };
    return recordId;
  },
  async push(collection, value) {
    const finalId = id(collection);
    memory[collection] = memory[collection] || {};
    memory[collection][finalId] = clone(value);
    return finalId;
  },
  async setCollection(collection, value) { memory[collection] = clone(value || {}); },
  async remove(collection, recordId) { if (memory[collection]) delete memory[collection][recordId]; },
  resetDemo() { memory = clone(DEMO_DATA); }
};
