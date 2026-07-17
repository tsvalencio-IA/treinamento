import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const required = [
  "index.html",
  "css/treinamento.css",
  "js/treinamento.js",
  "js/conhecimento.js",
  "js/explicacoes.js",
  "js/roteiro-sincronizado.js",
  "sistema/index.html",
  "sistema/css/styles.css",
  "sistema/js/app.js",
  "sistema/js/firebaseClient.js",
  "sistema/js/demo-data.js",
  ".nojekyll"
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Arquivo ausente: ${file}`);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "css/treinamento.css"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/treinamento.js"), "utf8");
const explanations = fs.readFileSync(path.join(root, "js/explicacoes.js"), "utf8");
const knowledge = fs.readFileSync(path.join(root, "js/conhecimento.js"), "utf8");
const syncScript = fs.readFileSync(path.join(root, "js/roteiro-sincronizado.js"), "utf8");
const demoClient = fs.readFileSync(path.join(root, "sistema/js/firebaseClient.js"), "utf8");
const config = fs.readFileSync(path.join(root, "sistema/js/config.js"), "utf8");

if (!index.includes("./sistema/index.html#/dashboard")) throw new Error("Iframe local não configurado.");
if (index.includes("../index.html")) throw new Error("Referência antiga ../index.html encontrada.");
if (index.includes("targetBalloon") || css.includes(".target-balloon")) throw new Error("Balão sobreposto antigo ainda existe.");
for (const id of ["spokenNow", "cueCount", "repeatCueBtn", "syncNow"]) {
  if (!index.includes(`id=\"${id}\"`)) throw new Error(`Componente sincronizado ausente: ${id}`);
}
if (!css.includes(".sync-now") || !css.includes(".cue-active")) throw new Error("Estilo da narração sincronizada ausente.");
if (demoClient.includes("gstatic.com/firebase")) throw new Error("Treinamento ainda importa Firebase real.");
if (config.includes("AIza") || config.includes("firebaseio.com")) throw new Error("Configuração oficial encontrada no treinamento.");
for (const term of ["runSynchronizedLesson", "presentCue", "speakAndWait", "focusCue", "synchronizedTargetsFor"]) {
  if (!engine.includes(term)) throw new Error(`Motor sincronizado ausente: ${term}`);
}
if (engine.includes("function schedule()") || engine.includes("estimatedSeconds(")) {
  throw new Error("Temporizador antigo independente do áudio ainda existe.");
}
if (!syncScript.includes("Cada cena liga uma frase curta a um único elemento real")) {
  throw new Error("Roteiro sincronizado não identificado.");
}

const tourMatch = knowledge.match(/export const MANUAL_TOUR = (\[[\s\S]*?\]);\n\nexport const MANUAL_KNOWLEDGE/);
if (!tourMatch) throw new Error("Não foi possível ler as aulas.");
const tour = JSON.parse(tourMatch[1]);

const detailMatch = explanations.match(/export const LESSON_DETAILS = (\{[\s\S]*\});\s*$/);
if (!detailMatch) throw new Error("Não foi possível ler as explicações.");
const details = JSON.parse(detailMatch[1]);

const syncModule = await import(pathToFileURL(path.join(root, "js/roteiro-sincronizado.js")));
if (tour.length !== 57) throw new Error(`Esperadas 57 aulas; encontradas ${tour.length}.`);
let synchronizedTargets = 0;
for (const step of tour) {
  const detail = details[step.id];
  if (!detail) throw new Error(`Explicação ausente: ${step.id}`);
  for (const field of ["simple", "user", "system", "result", "attention", "audit"]) {
    if (!String(detail[field] || "").trim()) throw new Error(`Campo ${field} ausente em ${step.id}`);
  }
  const targets = syncModule.synchronizedTargetsFor(step);
  if (!Array.isArray(targets) || !targets.length) throw new Error(`Roteiro sincronizado ausente: ${step.id}`);
  for (const target of targets) {
    if (!String(target.say || "").trim()) throw new Error(`Frase sincronizada ausente: ${step.id}`);
    if (!target.text && !target.selector) throw new Error(`Alvo sincronizado ausente: ${step.id}`);
  }
  synchronizedTargets += targets.length;
}
if (synchronizedTargets < 200) throw new Error(`Poucas cenas sincronizadas: ${synchronizedTargets}.`);

console.log(`Treinamento V3 aprovado: 57 aulas, ${synchronizedTargets} cenas sincronizadas e zero temporizador independente do áudio.`);
