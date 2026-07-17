import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "index.html",
  "css/treinamento.css",
  "js/treinamento.js",
  "js/conhecimento.js",
  "js/explicacoes.js",
  "sistema/index.html",
  "sistema/css/styles.css",
  "sistema/js/app.js",
  "sistema/js/firebaseClient.js",
  "sistema/js/demo-data.js",
  ".nojekyll"
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Arquivo ausente: ${file}`);
  }
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/treinamento.css"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/treinamento.js"), "utf8");
const explanations = fs.readFileSync(path.join(root, "js/explicacoes.js"), "utf8");
const knowledge = fs.readFileSync(path.join(root, "js/conhecimento.js"), "utf8");
const demoClient = fs.readFileSync(path.join(root, "sistema/js/firebaseClient.js"), "utf8");
const config = fs.readFileSync(path.join(root, "sistema/js/config.js"), "utf8");

if (!index.includes("./sistema/index.html#/dashboard")) {
  throw new Error("Iframe local não configurado.");
}
if (index.includes("../index.html")) {
  throw new Error("Referência antiga ../index.html encontrada.");
}
if (index.includes("targetBalloon") || css.includes(".target-balloon")) {
  throw new Error("Balão sobreposto antigo ainda existe.");
}
if (!index.includes('id="lessonLead"') || !index.includes('id="lessonUser"') || !index.includes('id="lessonSystem"')) {
  throw new Error("Estrutura clara da aula não foi encontrada.");
}
if (!css.includes("grid-template-columns:440px minmax(0,1fr)")) {
  throw new Error("Painel separado da explicação não foi configurado.");
}
if (demoClient.includes("gstatic.com/firebase")) {
  throw new Error("Treinamento ainda importa Firebase real.");
}
if (config.includes("AIza") || config.includes("firebaseio.com")) {
  throw new Error("Configuração oficial encontrada no treinamento.");
}
for (const term of ["simCursor", "TRAINING_TRACKS", "sourceIndex", "training-highlight", "LESSON_DETAILS"]) {
  if (!engine.includes(term)) throw new Error(`Recurso ausente: ${term}`);
}

const tourMatch = knowledge.match(/export const MANUAL_TOUR = (\[[\s\S]*?\]);\n\nexport const MANUAL_KNOWLEDGE/);
if (!tourMatch) throw new Error("Não foi possível ler as aulas.");
const tour = JSON.parse(tourMatch[1]);

const detailMatch = explanations.match(/export const LESSON_DETAILS = (\{[\s\S]*\});\s*$/);
if (!detailMatch) throw new Error("Não foi possível ler as explicações.");
const details = JSON.parse(detailMatch[1]);

if (tour.length !== 57) throw new Error(`Esperadas 57 aulas; encontradas ${tour.length}.`);
for (const step of tour) {
  const detail = details[step.id];
  if (!detail) throw new Error(`Explicação ausente: ${step.id}`);
  for (const field of ["simple", "user", "system", "result", "attention", "audit"]) {
    if (!String(detail[field] || "").trim()) throw new Error(`Campo ${field} ausente em ${step.id}`);
  }
}

console.log("Treinamento profissional V2: clareza, isolamento e 57 aulas aprovados.");
