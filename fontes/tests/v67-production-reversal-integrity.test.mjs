import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

assert.ok(
  app.includes("v67-estorno-producao-id-valido-auditoria-segura-20260716"),
  "Build V67 deve estar identificado."
);

const contextStart = app.indexOf("function productionReversalContext");
const contextEnd = app.indexOf("function productionReversalCoverage", contextStart);
const contextBlock = app.slice(contextStart, contextEnd);

assert.ok(
  contextBlock.includes('const root = { ...storedRoot, id: String(referenceId) };'),
  "A chave do Realtime Database deve ser anexada ao cabeçalho da produção."
);
assert.ok(
  !contextBlock.includes("const root = state.data?.producoes?.[referenceId]"),
  "O contexto não pode voltar a usar cabeçalho sem ID."
);

const reverseStart = app.indexOf("async function reverseProductionDocument");
const reverseEnd = app.indexOf("async function requestReverseProduction", reverseStart);
const reverseBlock = app.slice(reverseStart, reverseEnd);

const preflightIndex = reverseBlock.indexOf("const recordsToPatch = new Map()");
const firstPiecePatchIndex = reverseBlock.indexOf('await DB.patch("pecasEstoque"');
assert.ok(preflightIndex >= 0, "Estorno deve preparar IDs válidos.");
assert.ok(firstPiecePatchIndex > preflightIndex, "Pré-validação precisa ocorrer antes de alterar peças.");
assert.ok(
  reverseBlock.includes('if (!id || id === "undefined" || id === "null") return;'),
  "IDs inválidos devem ser descartados antes das gravações."
);
assert.ok(
  reverseBlock.includes("if (!recordsToPatch.size)"),
  "Estorno deve ser bloqueado antes de mutações quando nenhum ID válido existe."
);
assert.ok(
  !reverseBlock.includes("new Map([[coverage.root.id, coverage.root]])"),
  "Não pode existir criação tardia de mapa com coverage.root.id possivelmente indefinido."
);
assert.ok(
  reverseBlock.includes('producaoIds: [...recordsToPatch.keys()].filter'),
  "Auditoria deve receber apenas IDs válidos."
);

const auditStart = app.indexOf("function firebaseSafeAuditValue");
const auditEnd = app.indexOf("function auditReason", auditStart);
const auditBlock = app.slice(auditStart, auditEnd);
assert.ok(auditStart >= 0, "Sanitização de Auditoria precisa existir.");
assert.ok(
  auditBlock.includes("value === undefined") &&
  auditBlock.includes("firebaseSafeAuditValue(buildAuditRecord"),
  "Auditoria deve remover valores undefined antes de enviar ao Firebase."
);
assert.ok(
  auditBlock.includes("const payload = firebaseSafeAuditValue"),
  "Atualizações de Auditoria também devem ser sanitizadas."
);

const inventoryStart = app.indexOf("async function reverseInventoryDocument");
const inventoryEnd = app.indexOf("function productionHeaderRecord", inventoryStart);
const inventoryBlock = app.slice(inventoryStart, inventoryEnd);
assert.ok(
  inventoryBlock.indexOf("coverage.blockedPieces.length") <
  inventoryBlock.indexOf('await DB.patch("pecasEstoque"'),
  "Bloqueio do inventário deve acontecer antes de qualquer alteração de peça."
);

console.log(
  "V67 OK: estorno de produção usa IDs reais, valida antes de mutar e envia Auditoria sem undefined."
);
