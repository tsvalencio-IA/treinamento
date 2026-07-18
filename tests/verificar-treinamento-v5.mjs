import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const training = read("js/treinamento.js");
const knowledge = read("js/conhecimento.js");
const details = read("js/explicacoes.js");
const sync = read("js/roteiro-sincronizado.js");

const assertions = [
  [training.includes("locateTarget") && training.includes("paintSpotlight"), "sincronização visual preservada"],
  [!training.includes("O que o sistema faz:"), "sem rótulo narrado O que o sistema faz"],
  [!training.includes("Resultado esperado:"), "sem rótulo narrado Resultado esperado"],
  [!training.includes("Atenção:"), "sem rótulo narrado Atenção"],
  [!details.includes("Você está em uma cópia segura"), "sem introdução sobre cópia de treinamento"],
  [knowledge.includes("Visão geral do Ateliê Digital"), "primeira aula ensina o sistema"],
  [sync.includes("Use esta área para continuar a rotina"), "fallback operacional"],
  [read("sistema/js/firebaseClient.js").includes('mode: "treinamento_local"'), "dados locais"],
  [!read("sistema/js/config.js").includes("firebaseio.com"), "sem Firebase oficial"]
];

for (const [ok, label] of assertions) {
  if (!ok) throw new Error(`Falhou: ${label}`);
  console.log(`OK: ${label}`);
}
console.log("TREINAMENTO V5: APROVADO");
