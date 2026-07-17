export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeKey(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function parseNumberBR(value) {
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
    // O separador decimal é o último símbolo encontrado. O outro é milhar.
    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalized = raw.replace(/,/g, ".");
  } else if (lastDot >= 0) {
    const parts = raw.split(".");
    // 1.234 vira milhar; 0.75 continua decimal.
    normalized = parts.length === 2 && parts[1].length === 3 && parts[0].length > 1
      ? parts.join("")
      : raw;
  }

  const n = Number((isNegative ? "-" : "") + normalized);
  return Number.isFinite(n) ? n : 0;
}

export function formatNumber(value, decimals = 2) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCurrency(value) {
  const num = Number(value || 0);
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export function formatDate(isoOrDate) {
  if (!isoOrDate) return "-";
  const date = new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return String(isoOrDate);
  return date.toLocaleDateString("pt-BR");
}

export function brDateToIso(value) {
  if (!value) return "";
  const parts = String(value).trim().split("/");
  if (parts.length !== 3) return value;
  let [day, month, year] = parts;
  if (year.length === 2) year = Number(year) > 70 ? `19${year}` : `20${year}`;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function objectToArray(obj = {}) {
  return Object.entries(obj || {}).map(([id, value]) => ({ id, ...value }));
}

export function daysBetween(dateIso, now = new Date()) {
  if (!dateIso) return 9999;
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return 9999;
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function productIdFrom({ codigo, medida, material }) {
  const medidaNormalizada = String(medida || "").trim().replace(/^0+(?=\d)/, "");
  return normalizeKey(`${codigo || "SEM_CODIGO"}_${medidaNormalizada || "SEM_MEDIDA"}_${material || "SEM_MATERIAL"}`);
}

export function inferTipo(descricao = "", codigo = "") {
  const text = `${descricao} ${codigo}`.toUpperCase();
  if (text.includes("ALIAN")) return "Aliança";
  if (text.includes("ANEL")) return "Anel";
  if (text.includes("APARADOR")) return "Aparador";
  if (text.includes("BRINCO")) return "Brinco";
  if (text.includes("CORRENTE")) return "Corrente";
  if (text.includes("PINGENTE")) return "Pingente";
  if (text.includes("PULSEIRA")) return "Pulseira";
  return "Produto";
}

export function inferMaterial(text = "") {
  const upper = String(text).toUpperCase();
  if (upper.includes("PRATA")) return "Prata";
  if (upper.includes("10K")) return "Ouro 10K";
  if (upper.includes("18K")) return "Ouro 18K";
  if (upper.includes("OURO")) return "Ouro";
  return "";
}

export function inferMedida(text = "") {
  const upper = String(text).toUpperCase();
  const n = upper.match(/N[°ºO]?\s*\.?\s*(\d{1,2})(?!\d)/);
  if (n) return n[1];
  const faixa = upper.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if (faixa) return `${faixa[1]}/${faixa[2]}`;
  return "";
}

export function sum(arr, selector) {
  return arr.reduce((acc, item) => acc + parseNumberBR(selector(item) || 0), 0);
}

export function downloadText(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
