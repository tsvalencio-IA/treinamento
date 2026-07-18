import fs from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("css/treinamento.css"),data=read("js/dados.js"),app=read("js/treinamento.js");
const assertions=[
 [html.includes("system-window")&&html.includes("teacher-panel"),"estrutura profissional"],
 [css.includes("@media(max-width:680px)")&&css.includes("orientation:landscape"),"responsividade"],
 [data.includes("Produção aprovada e produção pronta"),"fluxo de produção"],
 [data.includes("Estornos na ordem correta"),"fluxo de estornos"],
 [app.includes("__GLAMORE_TRAINING_SELFTEST__"),"autoteste de cenas"],
 [app.includes("data-training-id"),"alvos exclusivos"],
 [!app.includes("firebaseio.com")&&!data.includes("firebaseio.com"),"sem Firebase oficial"],
 [read("MANIFESTO-INTEGRIDADE.json").includes('"firebase_oficial": false'),"manifesto seguro"]
];
for(const [ok,label] of assertions){if(!ok)throw new Error(`Falhou: ${label}`);console.log(`OK: ${label}`)}
console.log("TREINAMENTO PRÁTICO FINAL: ESTRUTURA APROVADA");