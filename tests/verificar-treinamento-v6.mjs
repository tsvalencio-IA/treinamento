import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const html = read("index.html");
const css = read("css/treinamento.css");
const js = read("js/treinamento.js");
const assertions = [
  [html.includes("lesson-studio") && html.includes("instructor-panel"), "layout de estúdio"],
  [html.indexOf("instructor-panel") > html.indexOf("video-stage"), "painel fora da tela"],
  [js.includes("cameraShot") && js.includes("translate3d"), "pan e zoom"],
  [js.includes("focusWidth"), "tratamento de alvo largo"],
  [css.includes("rgba(10,20,36,.18)"), "escurecimento leve"],
  [!html.includes("narration-card bottom"), "sem legenda sobre o sistema"],
  [read("sistema/js/firebaseClient.js").includes('mode: "treinamento_local"'), "dados locais"],
  [!read("sistema/js/config.js").includes("firebaseio.com"), "sem Firebase oficial"]
];
for (const [ok,label] of assertions) {
  if (!ok) throw new Error(`Falhou: ${label}`);
  console.log(`OK: ${label}`);
}
console.log("TREINAMENTO V6: APROVADO");
