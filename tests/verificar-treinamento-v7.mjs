import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const html = read("index.html");
const css = read("css/treinamento.css");
const js = read("js/treinamento.js");

const assertions = [
  [html.includes('viewport-fit=cover'), "safe area habilitada"],
  [js.includes("visualViewport") && js.includes("--app-height"), "viewport dinâmico"],
  [css.includes("clamp(320px,27vw,390px)"), "computador"],
  [css.includes("@media (max-width:1100px) and (orientation:portrait)"), "tablet retrato"],
  [css.includes("@media (max-width:760px) and (orientation:portrait)"), "celular retrato"],
  [css.includes("@media (orientation:landscape) and (max-height:580px)"), "paisagem baixa"],
  [css.includes("@media (orientation:landscape) and (max-height:430px)"), "paisagem extrema"],
  [css.includes("html.settings-open .panel-settings"), "ajustes móveis"],
  [css.includes("overflow:hidden") && css.includes("overscroll-behavior:none"), "sem rolagem externa"],
  [read("sistema/js/firebaseClient.js").includes('mode: "treinamento_local"'), "dados locais"],
  [!read("sistema/js/config.js").includes("firebaseio.com"), "sem Firebase oficial"]
];

for (const [ok,label] of assertions) {
  if (!ok) throw new Error(`Falhou: ${label}`);
  console.log(`OK: ${label}`);
}
console.log("TREINAMENTO RESPONSIVO V7: APROVADO");
