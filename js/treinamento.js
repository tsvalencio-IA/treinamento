import { MANUAL_TOUR, MANUAL_KNOWLEDGE, MANUAL_SOURCE_FILES, TRAINING_TRACKS } from "./conhecimento.js";
import { LESSON_DETAILS } from "./explicacoes.js";
import { synchronizedTargetsFor } from "./roteiro-sincronizado.js";

const $ = (id) => document.getElementById(id);
const frame = $("systemFrame");
const cameraFrame = $("cameraFrame");
const videoStage = $("videoStage");
const shades = {
  top: $("shadeTop"), right: $("shadeRight"),
  bottom: $("shadeBottom"), left: $("shadeLeft")
};
const ring = $("targetRing");
const targetLabelEl = $("targetLabel");
const cursor = $("simCursor");
const ripple = $("clickRipple");
const narration = $("narrationCard");
const spokenNow = $("spokenNow");
const narrationTarget = $("narrationTarget");
const narrationProgress = $("narrationProgress");
const wordProgress = $("wordProgress");
const frameStatus = $("frameStatus");
const stageWaiting = $("stageWaiting");
const fatalScene = $("fatalScene");

let activeTrack = null;
let steps = [];
let stepIndex = 0;
let cueIndex = 0;
let cues = [];
let playing = false;
let playbackToken = 0;
let voice = localStorage.getItem("glamore.training.voice") !== "off";
let currentPage = "index.html";
let lastContext = "";
let activeUtterance = null;
let currentTarget = null;
let currentScale = 1;
let sourceIndexPromise = null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const normalize = (value = "") => String(value).normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const escapeHtml = (value = "") => String(value)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");

function currentStep(){ return steps[stepIndex] || steps[0]; }
function currentCue(){ return cues[cueIndex] || cues[0]; }
function roleForStep(step){ return step?.id === "login" ? { loggedOut:true } : { loggedOut:false, role:activeTrack?.role || $("roleSelect").value || "dono" }; }
function pageUrl(step){ return step.page ? `./sistema/${step.page}` : `./sistema/index.html#/${step.route || "dashboard"}`; }

function detailFor(step){
  return LESSON_DETAILS[step.id] || {
    simple:step.body, user:"Observe a função indicada.",
    system:step.body, result:"A função é demonstrada sem alterar dados reais.",
    attention:"Execute no sistema oficial somente depois de compreender a etapa.",
    audit:"O ambiente de treinamento não grava no Firebase oficial."
  };
}

function buildCues(step){
  const detail = detailFor(step);
  const targets = synchronizedTargetsFor(step);
  const firstTarget = targets[0] || step.target;
  const lastTarget = targets.at(-1) || step.target;
  const result = [];

  // Abertura curta da função, sem explicar o motor do treinamento.
  if (detail.simple) {
    result.push({
      target:firstTarget,
      text:detail.simple,
      click:false,
      section:"objetivo"
    });
  }

  // Passo a passo visual: cada frase permanece ligada ao campo, botão,
  // aba ou card exato citado na narração.
  for (const target of targets) {
    const text = String(target.say || "").trim();
    if (!text) continue;
    result.push({
      target,
      text,
      click:Boolean(target.click),
      section:"passo"
    });
  }

  // Encerramento prático: como o usuário confere que concluiu corretamente.
  if (detail.result) {
    result.push({
      target:lastTarget,
      text:detail.result,
      click:false,
      section:"conferência"
    });
  }

  // Alerta curto e operacional, sem linguagem técnica desnecessária.
  if (detail.attention) {
    result.push({
      target:lastTarget,
      text:detail.attention,
      click:false,
      section:"cuidado"
    });
  }

  return result.filter(c => String(c.text || "").trim());
}

function updateHeader(){
  const step = currentStep();
  $("chapterLabel").textContent = step?.chapter || "Começo";
  $("stepTitle").textContent = step?.title || "Videoaula";
  $("stepCount").textContent = `${steps.length ? stepIndex + 1 : 0} / ${steps.length}`;
  $("cueCount").textContent = `cena ${cues.length ? cueIndex + 1 : 0} / ${cues.length}`;
  const totalScenes = steps.reduce((sum, s) => sum + buildCues(s).length, 0) || 1;
  const completed = steps.slice(0, stepIndex).reduce((sum, s) => sum + buildCues(s).length, 0) + cueIndex;
  $("progressBar").style.width = `${Math.min(100, completed / totalScenes * 100)}%`;
}

function fillSummary(){
  const step = currentStep(); if (!step) return;
  const detail = detailFor(step);
  $("summaryTitle").textContent = step.title;
  $("lessonLead").textContent = detail.simple;
  $("lessonUser").textContent = detail.user;
  $("lessonSystem").textContent = detail.system;
  $("lessonResult").textContent = detail.result;
  $("lessonAttention").textContent = detail.attention;
  $("lessonAudit").textContent = detail.audit;
  $("stepBody").textContent = step.body || "";
  const refs = MANUAL_KNOWLEDGE.filter(k => k.step === step.id).flatMap(k => k.sources || []).slice(0,5);
  $("stepSource").innerHTML = refs.length ? `<strong>Fontes:</strong> ${refs.map(escapeHtml).join(" · ")}` : "A explicação é baseada na lógica e nos testes incluídos no pacote.";
}

function applyContext(step){
  const context = roleForStep(step);
  if (context.role) localStorage.setItem("glamore.training.role", context.role);
  localStorage.setItem("glamore.training.loggedOut", context.loggedOut ? "true" : "false");
  if (context.role) $("roleSelect").value = context.role;
}

async function setFrame(step){
  applyContext(step);
  const contextKey = `${localStorage.getItem("glamore.training.role")}|${localStorage.getItem("glamore.training.loggedOut")}`;
  const nextPage = step.page || "index.html";
  let changed = false;
  if (contextKey !== lastContext || currentPage !== nextPage){
    lastContext = contextKey; currentPage = nextPage; frame.src = pageUrl(step); changed = true;
  } else if (step.page) {
    frame.src = pageUrl(step); changed = true;
  } else {
    try{
      const wanted = `#/${step.route || "dashboard"}`;
      if (frame.contentWindow.location.hash !== wanted){ frame.contentWindow.location.hash = wanted; changed = true; }
    }catch{ frame.src = pageUrl(step); changed = true; }
  }
  if (changed){
    frameStatus.textContent = "Abrindo a tela correta...";
    await waitBridge(9000);
    await sleep(350);
  }
}

async function waitBridge(timeout=6500){
  const until = Date.now() + timeout;
  while (Date.now() < until){
    try{
      const bridge = frame.contentWindow?.GlamoreTrainingBridge;
      if (bridge?.find){ bridge.lockUserNavigation(); return bridge; }
    }catch{}
    await sleep(100);
  }
  return null;
}

function cueLabel(cue){
  return cue?.target?.label || cue?.target?.text || currentStep()?.title || "Item da aula";
}

async function locateTarget(step, cue){
  const bridge = await waitBridge();
  if (!bridge) return null;
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline){
    let el = null;
    try{ el = bridge.find(cue.target || step.target || {}); }catch{}
    if (el) return { bridge, el };
    await sleep(180);
  }
  return null;
}

function resetCamera(){
  currentScale = 1;
  cameraFrame.style.transform = "scale(1)";
  ring.classList.remove("active");
  targetLabelEl.classList.remove("active");
  cursor.classList.remove("active");
  Object.values(shades).forEach(s => s.classList.remove("active"));
  currentTarget = null;
}

function chooseScale(rect){
  const area = rect.width * rect.height;
  if (rect.width < 90 || rect.height < 34) return 1.22;
  if (area < 26000) return 1.15;
  if (area < 70000) return 1.08;
  return 1.02;
}

function scaledRect(innerRect, scale){
  const stageRect = videoStage.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  const fw = frameRect.width, fh = frameRect.height;
  const x = (innerRect.left - fw/2) * scale + fw/2 + (frameRect.left - stageRect.left);
  const y = (innerRect.top - fh/2) * scale + fh/2 + (frameRect.top - stageRect.top);
  return { left:x, top:y, width:innerRect.width*scale, height:innerRect.height*scale,
    right:x+innerRect.width*scale, bottom:y+innerRect.height*scale };
}

function paintSpotlight(rect, label){
  const stage = videoStage.getBoundingClientRect();
  const pad = 9;
  const r = {
    left:Math.max(5, rect.left-pad), top:Math.max(5, rect.top-pad),
    right:Math.min(stage.width-5, rect.right+pad), bottom:Math.min(stage.height-5, rect.bottom+pad)
  };
  r.width = Math.max(10, r.right-r.left); r.height = Math.max(10, r.bottom-r.top);

  ring.style.cssText += `;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  ring.classList.add("active");

  shades.top.style.cssText += `;left:0;top:0;width:100%;height:${r.top}px`;
  shades.bottom.style.cssText += `;left:0;top:${r.bottom}px;width:100%;height:${Math.max(0,stage.height-r.bottom)}px`;
  shades.left.style.cssText += `;left:0;top:${r.top}px;width:${r.left}px;height:${r.height}px`;
  shades.right.style.cssText += `;left:${r.right}px;top:${r.top}px;width:${Math.max(0,stage.width-r.right)}px;height:${r.height}px`;
  Object.values(shades).forEach(s => s.classList.add("active"));

  targetLabelEl.textContent = label;
  const labelTop = r.top > 48 ? r.top - 38 : r.bottom + 10;
  targetLabelEl.style.left = `${Math.max(8,Math.min(r.left,stage.width-350))}px`;
  targetLabelEl.style.top = `${Math.max(8,Math.min(labelTop,stage.height-38))}px`;
  targetLabelEl.classList.add("active");

  const cursorX = Math.min(stage.width-30, r.left + Math.max(20, Math.min(r.width*.62,r.width-14)));
  const cursorY = Math.min(stage.height-30, r.top + Math.max(20, Math.min(r.height*.58,r.height-14)));
  cursor.style.left = `${cursorX}px`; cursor.style.top = `${cursorY}px`; cursor.classList.add("active");

  const captionHeight = narration.getBoundingClientRect().height || 120;
  if (r.bottom > stage.height * .58 && r.top > captionHeight + 36){
    narration.classList.remove("bottom"); narration.classList.add("top");
  }else{
    narration.classList.remove("top"); narration.classList.add("bottom");
  }
}

async function animateClick(){
  cursor.classList.add("clicking");
  const c = cursor.getBoundingClientRect(), s = videoStage.getBoundingClientRect();
  ripple.style.left = `${c.left-s.left+5}px`; ripple.style.top = `${c.top-s.top+5}px`;
  ripple.classList.remove("active"); void ripple.offsetWidth; ripple.classList.add("active");
  await sleep(150); cursor.classList.remove("clicking");
}

async function focusCue(step, cue){
  resetCamera();
  frameStatus.textContent = `Abrindo: ${cueLabel(cue)}...`;
  const located = await locateTarget(step,cue);
  if (!located){
    showFatal(`O elemento “${cueLabel(cue)}” não foi encontrado na tela ${step.title}. A aula foi pausada para não destacar uma área genérica ou ensinar uma posição errada.`);
    return false;
  }
  const {bridge,el} = located;
  try{
    await bridge.scrollTo(el);
    await sleep(180);
    const before = bridge.rect(el);
    currentScale = chooseScale(before);
    cameraFrame.style.transform = `scale(${currentScale})`;
    await sleep(560);
    const after = bridge.rect(el);
    const rect = scaledRect(after,currentScale);
    currentTarget = {bridge,el,cue,rect};
    paintSpotlight(rect,cueLabel(cue));
    if (cue.click){
      await sleep(250); await animateClick();
      try{ bridge.safeActivate(el,cueLabel(cue)); }catch{}
    }
    frameStatus.textContent = `Mostrando: ${cueLabel(cue)}.`;
    return true;
  }catch(err){
    showFatal(`A tela não conseguiu mostrar “${cueLabel(cue)}”: ${err?.message || err}`);
    return false;
  }
}

function showFatal(message){
  stopPlayback(false);
  $("fatalSceneText").textContent = message;
  fatalScene.hidden = false;
}
function hideFatal(){ fatalScene.hidden = true; }

function visualDuration(text){
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2500, words / (2.55 * Number($("speedSelect").value || 1)) * 1000);
}

function speak(text, token){
  wordProgress.style.width = "0%";
  if (!voice || !("speechSynthesis" in window)){
    return new Promise(resolve=>{
      const duration = visualDuration(text), started=performance.now();
      const tick=()=>{
        if(token!==playbackToken||!playing)return resolve(false);
        const pct=Math.min(100,(performance.now()-started)/duration*100);
        wordProgress.style.width=`${pct}%`;
        if(pct>=100)return resolve(true);
        requestAnimationFrame(tick);
      }; tick();
    });
  }
  return new Promise(resolve=>{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    activeUtterance = u;
    u.lang="pt-BR"; u.rate=Number($("speedSelect").value||1); u.pitch=1; u.volume=1;
    const duration = visualDuration(text);
    const started=performance.now();
    let done=false;
    const finish=()=>{if(done)return;done=true;clearTimeout(safety);wordProgress.style.width="100%";resolve(token===playbackToken&&playing)};
    const safety=setTimeout(finish,Math.max(14000,duration*2.4));
    u.onboundary=(event)=>{
      if(event.name==="word"||Number.isFinite(event.charIndex)){
        wordProgress.style.width=`${Math.min(98,event.charIndex/Math.max(1,text.length)*100)}%`;
      }
    };
    u.onend=finish;u.onerror=finish;
    speechSynthesis.speak(u);
  });
}

async function presentCue(position,token,{narrate=true}={}){
  cueIndex=position; updateHeader();
  const step=currentStep(),cue=currentCue();
  narrationTarget.textContent=`PASSO ATUAL · ${cueLabel(cue)}`;
  narrationProgress.textContent=`Cena ${cueIndex+1} de ${cues.length}`;
  spokenNow.textContent="Abrindo a função...";
  const ok=await focusCue(step,cue);
  if(!ok||token!==playbackToken)return false;
  spokenNow.textContent=cue.text;
  await sleep(180);
  return narrate ? await speak(cue.text,token) : true;
}

async function run(start=cueIndex){
  if(!steps.length)return $("trackDialog").showModal();
  playing=true;const token=++playbackToken;
  $("playBtn").textContent="Ⅱ Pausar";
  stageWaiting.classList.add("hidden");
  hideFatal();
  await setFrame(currentStep());
  for(let i=start;i<cues.length;i++){
    if(!playing||token!==playbackToken)return;
    const complete=await presentCue(i,token,{narrate:true});
    if(!complete||!playing||token!==playbackToken)return;
    await sleep(420);
  }
  if(!playing||token!==playbackToken)return;
  if(stepIndex>=steps.length-1){
    stopPlayback(false);spokenNow.textContent="Trilha concluída. Use Aulas para rever uma função ou Perguntar para tirar uma dúvida.";return;
  }
  stepIndex++;cueIndex=0;cues=buildCues(currentStep());fillSummary();updateHeader();
  saveProgress();resetCamera();await setFrame(currentStep());await run(0);
}

function stopPlayback(showPaused=true){
  playing=false;playbackToken++;
  if("speechSynthesis" in window)speechSynthesis.cancel();
  activeUtterance=null;
  $("playBtn").textContent="▶ Continuar";
  if(showPaused)frameStatus.textContent="Videoaula pausada no item atual.";
}

async function goStep(next){
  stopPlayback(false);hideFatal();stepIndex=Math.max(0,Math.min(steps.length-1,next));
  cueIndex=0;cues=buildCues(currentStep());fillSummary();updateHeader();saveProgress();
  resetCamera();stageWaiting.classList.add("hidden");await setFrame(currentStep());
  await presentCue(0,++playbackToken,{narrate:false});
}

async function goCue(next){
  if(!steps.length)return;
  stopPlayback(false);hideFatal();cueIndex=Math.max(0,Math.min(cues.length-1,next));updateHeader();
  await presentCue(cueIndex,++playbackToken,{narrate:false});
}

function resolveTrack(track){
  if(track.steps==="ALL")return [...MANUAL_TOUR];
  if(Array.isArray(track.steps))return track.steps.map(id=>MANUAL_TOUR.find(s=>s.id===id)).filter(Boolean);
  if(track.chapters)return MANUAL_TOUR.filter(s=>track.chapters.includes(s.chapter));
  return [...MANUAL_TOUR];
}
function selectTrack(id){
  activeTrack=TRAINING_TRACKS.find(t=>t.id===id)||TRAINING_TRACKS[0];
  steps=resolveTrack(activeTrack);
  $("roleSelect").value=activeTrack.role||"dono";
  localStorage.setItem("glamore.training.track",activeTrack.id);
  localStorage.setItem("glamore.training.role",$("roleSelect").value);
  stepIndex=Math.min(Number(localStorage.getItem(`glamore.training.progress.${activeTrack.id}`)||0),steps.length-1);
  cueIndex=0;cues=buildCues(currentStep());fillSummary();updateHeader();
  $("trackDialog").close();stageWaiting.classList.add("hidden");goStep(stepIndex);
}
function saveProgress(){if(activeTrack)localStorage.setItem(`glamore.training.progress.${activeTrack.id}`,String(stepIndex));}

function renderTracks(){
  $("trackGrid").innerHTML=TRAINING_TRACKS.map(track=>{
    const count=resolveTrack(track).length;
    return `<button class="track-card" data-track="${escapeHtml(track.id)}"><span class="icon">${escapeHtml(track.icon)}</span><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.subtitle)}</span><em>${count} videoaulas</em></button>`;
  }).join("");
  document.querySelectorAll("[data-track]").forEach(b=>b.onclick=()=>selectTrack(b.dataset.track));
}
function renderMap(){
  $("mapContent").innerHTML=steps.map((s,i)=>`<button class="map-step ${i===stepIndex?"active":""}" data-step="${i}"><small>${escapeHtml(s.chapter)} · aula ${i+1}</small><strong>${escapeHtml(s.title)}</strong></button>`).join("");
  document.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{$("mapDialog").close();goStep(Number(b.dataset.step));});
}

function tokens(text){return new Set(normalize(text).split(" ").filter(w=>w.length>2));}
function scoreKnowledge(question,item){
  const q=tokens(question),title=normalize(item.title),keywords=(item.keywords||[]).map(normalize),answer=normalize(item.answer);let score=0;
  for(const word of q){if(title.includes(word))score+=5;if(keywords.some(k=>k.includes(word)))score+=4;if(answer.includes(word))score+=1}
  const nq=normalize(question);if(keywords.some(k=>nq.includes(k)||k.includes(nq)))score+=10;return score;
}
async function sourceIndex(){
  if(sourceIndexPromise)return sourceIndexPromise;
  sourceIndexPromise=(async()=>{const rows=[];for(const file of MANUAL_SOURCE_FILES){try{const r=await fetch(`./fontes/${file}`);if(!r.ok)continue;const clean=(await r.text()).replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g,"[imagem omitida]");const lines=clean.split(/\r?\n/);for(let i=0;i<lines.length;i+=18){const chunk=lines.slice(i,i+24).join("\n").trim();if(chunk.length>80)rows.push({file,line:i+1,text:chunk,norm:normalize(chunk)})}}catch{}}return rows})();
  return sourceIndexPromise;
}
function addMessage(cls,html){const d=document.createElement("div");d.className=cls;d.innerHTML=html;$("qaMessages").appendChild(d);$("qaMessages").scrollTop=$("qaMessages").scrollHeight}
async function answerQuestion(question){
  addMessage("qa-user",escapeHtml(question));
  const ranked=MANUAL_KNOWLEDGE.map(item=>({item,score:scoreKnowledge(question,item)})).sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  if(best&&best.score>=5){
    const item=best.item;
    addMessage("qa-answer",`<h3>${escapeHtml(item.title)}</h3><div>${escapeHtml(item.answer)}</div><div class="answer-sources"><strong>Fontes:</strong> ${(item.sources||[]).map(escapeHtml).join(" · ")}</div><button data-answer-step="${escapeHtml(item.step||"")}">Mostrar esta função na videoaula</button>`);
    document.querySelectorAll("[data-answer-step]").forEach(b=>b.onclick=()=>{const pos=steps.findIndex(s=>s.id===b.dataset.answerStep);if(pos>=0){$("qaDialog").close();goStep(pos)}});
    return;
  }
  const rows=await sourceIndex(),words=[...tokens(question)];
  const matches=rows.map(row=>({row,score:words.reduce((n,w)=>n+(row.norm.includes(w)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3);
  if(matches.length)addMessage("qa-answer",`<h3>Evidências próximas encontradas</h3><div>Não existe uma resposta preparada suficiente para afirmar isso com segurança.</div><div class="answer-sources">${matches.map(m=>`${escapeHtml(m.row.file)}:${m.row.line} — ${escapeHtml(m.row.text.slice(0,260))}`).join("<br><br>")}</div>`);
  else addMessage("qa-answer","<h3>Não há evidência segura</h3><div>Não encontrei base suficiente no código, nos documentos e nos testes para responder sem suposição.</div>");
}
function renderQuickQuestions(){
  const questions=["O que acontece quando falta peça em uma venda?","Quantidade e peso são independentes?","Por que produção aprovada não cria ordem?","Como funciona o estorno de inventário?","Quem pode ver a Auditoria?","Como a produção pronta atende uma venda?"];
  $("quickQuestions").innerHTML=questions.map(q=>`<button>${escapeHtml(q)}</button>`).join("");
  document.querySelectorAll("#quickQuestions button").forEach(b=>b.onclick=()=>answerQuestion(b.textContent));
}

$("chooseTrackBtn").onclick=()=>{$("trackDialog").showModal()};
$("mapBtn").onclick=()=>{renderMap();$("mapDialog").showModal()};
$("summaryBtn").onclick=()=>{fillSummary();$("summaryDialog").showModal()};
$("qaBtn").onclick=()=>{$("qaDialog").showModal()};
$("playBtn").onclick=()=>playing?stopPlayback():run(cueIndex);
$("prevStepBtn").onclick=()=>goStep(stepIndex-1);
$("nextStepBtn").onclick=()=>goStep(stepIndex+1);
$("prevCueBtn").onclick=()=>goCue(cueIndex-1);
$("nextCueBtn").onclick=()=>goCue(cueIndex+1);
$("repeatBtn").onclick=()=>{stopPlayback(false);run(cueIndex)};
$("retrySceneBtn").onclick=()=>{hideFatal();goCue(cueIndex)};
$("skipSceneBtn").onclick=()=>{hideFatal();goCue(cueIndex+1)};
$("voiceBtn").onclick=()=>{
  voice=!voice;localStorage.setItem("glamore.training.voice",voice?"on":"off");
  $("voiceBtn").textContent=voice?"🔊 Áudio ligado":"🔇 Áudio desligado";
  $("voiceBtn").setAttribute("aria-pressed",String(voice));
  if(!voice&&"speechSynthesis" in window)speechSynthesis.cancel();
};
$("fullscreenBtn").onclick=async()=>{if(!document.fullscreenElement)await $("videoCourse").requestFullscreen?.();else await document.exitFullscreen?.()};
$("roleSelect").onchange=()=>{localStorage.setItem("glamore.training.role",$("roleSelect").value);lastContext="";goStep(stepIndex)};
$("qaForm").onsubmit=e=>{e.preventDefault();const q=$("qaInput").value.trim();if(q){$("qaInput").value="";answerQuestion(q)}};
document.querySelectorAll("[data-close-dialog]").forEach(b=>b.onclick=()=>b.closest("dialog").close());

window.addEventListener("message",event=>{
  if(event.data?.type==="training-user-scroll-blocked"||event.data?.type==="training-action-blocked"){
    $("cameraMessage").classList.add("show");setTimeout(()=>$("cameraMessage").classList.remove("show"),1800);
  }
});
window.addEventListener("resize",async()=>{if(currentTarget){await sleep(100);const r=currentTarget.bridge.rect(currentTarget.el);paintSpotlight(scaledRect(r,currentScale),cueLabel(currentTarget.cue))}});
videoStage.addEventListener("wheel",e=>{e.preventDefault();$("cameraMessage").classList.add("show");setTimeout(()=>$("cameraMessage").classList.remove("show"),1800)},{passive:false});

renderTracks();renderQuickQuestions();
$("voiceBtn").textContent=voice?"🔊 Áudio ligado":"🔇 Áudio desligado";
$("trackDialog").showModal();
