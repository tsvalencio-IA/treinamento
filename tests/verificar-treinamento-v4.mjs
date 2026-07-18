import fs from "node:fs";
const root = new URL("../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const assertions = [
  [read("index.html").includes("video-stage"), "video stage"],
  [read("css/treinamento.css").includes("100dvh"), "viewport fixed"],
  [read("js/treinamento.js").includes("locateTarget"), "exact locator"],
  [read("js/treinamento.js").includes("showFatal"), "safe pause"],
  [!read("js/treinamento.js").includes('querySelector("main.main,#app,body")'), "no generic fallback"],
  [read("sistema/js/training-bridge.js").includes("GlamoreTrainingBridge"), "bridge"],
  [read("sistema/index.html").includes("training-bridge.js"), "bridge loaded"],
  [read("sistema/js/firebaseClient.js").includes('mode: "treinamento_local"'), "local firebase client"]
];
for (const [ok,label] of assertions) { if(!ok) throw new Error(`Falhou: ${label}`); console.log(`OK: ${label}`); }
console.log("VIDEOAULA V4: APROVADA");
