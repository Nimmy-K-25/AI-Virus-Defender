"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const els = {
    welcome: $("welcomeDialog"), nameForm: $("nameForm"), playerName: $("playerName"), nameError: $("nameError"),
    instructions: $("instructionsDialog"), result: $("resultDialog"), leaderboard: $("leaderboardDialog"),
    player: $("playerDisplay"), score: $("scoreDisplay"), time: $("timeDisplay"), combo: $("comboDisplay"), core: $("coreDisplay"),
    layer: $("threatLayer"), messages: $("messageLayer"), startOverlay: $("startOverlay"), startBtn: $("startBtn"),
    muteBtn: $("muteBtn"), instructionsBtn: $("instructionsBtn")
  };
  const TYPES = {
    virus: {label:"VIRUS", symbol:"🦠", points:10, weight:30},
    malware:{label:"MALWARE", symbol:"⚠", points:15, weight:22},
    phishing:{label:"PHISHING", symbol:"✉", points:12, weight:23},
    safe:{label:"SAFE FILE", symbol:"✓", points:-20, weight:25}
  };
  let state = {};
  let audioCtx = null;
  function freshState(){ return {player:"", running:false, score:0, combo:0, bestCombo:0, core:100, stopped:0, correct:0, clicks:0, startAt:0, endAt:0, spawnTimer:null, frame:null, muted:false}; }
  state = freshState();

  function safeName(value){ return value.trim().replace(/[<>]/g, "").slice(0,24); }
  function showWelcome(){ if (!els.welcome.open) els.welcome.showModal(); setTimeout(()=>els.playerName.focus(),50); }
  function showInstructions(){ if (!els.instructions.open) els.instructions.showModal(); }
  function closeDialog(id){ const d=$(id); if(d && d.open) d.close(); }
  function updateHud(){
    els.player.textContent=state.player||"—"; els.score.textContent=state.score; els.combo.textContent=`x${state.combo}`;
    els.core.textContent=`${state.core}%`; els.core.closest(".hud-card").classList.toggle("core-critical",state.core<=30);
  }
  function tone(freq=440, duration=.06){
    if(state.muted) return;
    try{ audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=freq; g.gain.setValueAtTime(.04,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration); o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+duration); }catch(e){}
  }
  function weightedType(){ const n=Math.random()*100; let sum=0; for(const [key,val] of Object.entries(TYPES)){sum+=val.weight;if(n<sum)return key;} return "safe"; }
  function difficulty(){ const elapsed=(performance.now()-state.startAt)/1000; return {interval:Math.max(360,850-elapsed*7), duration:Math.max(2.3,5.2-elapsed*.035)}; }
  function spawn(){
    if(!state.running) return;
    const type=weightedType(), meta=TYPES[type], node=document.createElement("button");
    node.type="button"; node.className=`threat ${type}`; node.dataset.type=type;
    node.setAttribute("aria-label",`${meta.label}${type==='safe'?', do not click':`, worth ${meta.points} points`}`);
    node.style.left=`${Math.floor(Math.random()*88)+2}%`; node.style.setProperty("--duration",`${difficulty().duration}s`);
    node.innerHTML=`<span class="symbol" aria-hidden="true">${meta.symbol}</span><span class="label">${meta.label}</span>`;
    node.addEventListener("click",()=>hit(node)); node.addEventListener("animationend",()=>miss(node)); els.layer.appendChild(node);
  }
  function hit(node){
    if(!state.running || node.dataset.done) return; node.dataset.done="1"; state.clicks++;
    const type=node.dataset.type, meta=TYPES[type];
    if(type==="safe") { state.score=Math.max(0,state.score-20); state.combo=0; feedback(node,"SAFE FILE −20","#ff5b79"); tone(150,.15); }
    else { state.score+=meta.points; state.combo++; state.correct++; state.stopped++; state.bestCombo=Math.max(state.bestCombo,state.combo); feedback(node,`+${meta.points}`,"#63efff"); tone(620+state.combo*20); if(state.combo%5===0){state.score+=25; feedback(node,"COMBO +25","#ffd166"); tone(900,.12);} }
    node.classList.add("destroyed"); setTimeout(()=>node.remove(),260); updateHud();
  }
  function miss(node){
    if(node.dataset.done){node.remove();return;} node.dataset.done="1";
    if(state.running && node.dataset.type!=="safe"){ state.score=Math.max(0,state.score-5); state.core=Math.max(0,state.core-10); state.combo=0; feedback(node,"BREACH −5","#ff5b79"); tone(110,.2); updateHud(); }
    node.remove();
  }
  function feedback(node,text,color){const r=node.getBoundingClientRect(),g=$("gameArea").getBoundingClientRect(),m=document.createElement("span");m.className="float-message";m.textContent=text;m.style.color=color;m.style.left=`${r.left-g.left}px`;m.style.top=`${r.top-g.top}px`;els.messages.appendChild(m);setTimeout(()=>m.remove(),850);}
  function scheduleSpawn(){ if(!state.running)return; spawn(); state.spawnTimer=setTimeout(scheduleSpawn,difficulty().interval); }
  function tick(){
    if(!state.running)return; const left=Math.max(0,state.endAt-performance.now()), sec=Math.ceil(left/1000); els.time.textContent=sec;
    els.time.classList.toggle("warning",sec<=10&&sec>5); els.time.classList.toggle("urgent",sec<=5);
    if(left<=0){endGame();return;} state.frame=requestAnimationFrame(tick);
  }
  function startGame(){
    clearTimers(); els.layer.replaceChildren(); els.messages.replaceChildren();
    const previousPlayer=state.player, muted=state.muted; state=freshState(); state.player=previousPlayer; state.muted=muted; state.running=true; state.startAt=performance.now(); state.endAt=state.startAt+60000;
    els.startOverlay.hidden=true; els.startOverlay.classList.add("is-hidden"); els.time.textContent="60"; els.time.className=""; updateHud(); tone(520,.12); scheduleSpawn(); tick(); $("gameArea").focus();
  }
  function clearTimers(){clearTimeout(state.spawnTimer);cancelAnimationFrame(state.frame);}
  function endGame(){
    if(!state.running)return; state.running=false; clearTimers(); [...els.layer.children].forEach(n=>{n.dataset.done="1";n.remove();}); els.time.textContent="0";
    const accuracy=state.clicks?Math.round(state.correct/state.clicks*100):0, best=saveScore();
    $("resultGreeting").textContent=`Well played, ${state.player}. Your 60-second defense mission is complete.`; $("finalScore").textContent=state.score; $("stoppedStat").textContent=state.stopped; $("accuracyStat").textContent=`${accuracy}%`; $("bestComboStat").textContent=state.bestCombo; $("coreStat").textContent=`${state.core}%`; $("personalBestStat").textContent=best; $("statusStat").textContent="Completed"; tone(760,.3); els.result.showModal();
  }
  function getScores(){try{return JSON.parse(localStorage.getItem("avd_scores")||"[]")}catch{return[]}}
  function saveScore(){const list=getScores();list.push({name:state.player,score:state.score,date:new Date().toISOString()});list.sort((a,b)=>b.score-a.score);localStorage.setItem("avd_scores",JSON.stringify(list.slice(0,10)));return Math.max(...list.filter(x=>x.name===state.player).map(x=>x.score),state.score);}
  function renderLeaderboard(){const list=getScores(),target=$("leaderboardList");target.replaceChildren();if(!list.length){const li=document.createElement("li");li.textContent="No local scores yet.";target.append(li);return;}list.forEach((x,i)=>{const li=document.createElement("li");li.textContent=`${x.name} — ${x.score} points — ${new Date(x.date).toLocaleDateString()}`;target.append(li);});}

  els.nameForm.addEventListener("submit",e=>{e.preventDefault();const name=safeName(els.playerName.value);if(!name){els.nameError.textContent="Please enter a valid player name.";return;}state.player=name;updateHud();els.nameError.textContent="";els.welcome.close();showInstructions();});
  $("briefingDoneBtn").addEventListener("click",()=>{els.instructions.close();els.startOverlay.hidden=false;els.startOverlay.classList.remove("is-hidden");});
  els.startBtn.addEventListener("click",startGame); $("replayBtn").addEventListener("click",()=>{els.result.close();startGame();});
  els.instructionsBtn.addEventListener("click",showInstructions); els.muteBtn.addEventListener("click",()=>{state.muted=!state.muted;els.muteBtn.setAttribute("aria-pressed",String(state.muted));els.muteBtn.textContent=state.muted?"🔇 Muted":"🔊 Sound";});
  $("leaderboardBtn").addEventListener("click",()=>{els.result.close();renderLeaderboard();els.leaderboard.showModal();});
  $("clearLeaderboardBtn").addEventListener("click",()=>{localStorage.removeItem("avd_scores");renderLeaderboard();});
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
  document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.running) endGame();});
  window.addEventListener("beforeunload",clearTimers); showWelcome();
})();