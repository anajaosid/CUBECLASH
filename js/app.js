import {addSolve,getSolves,clearSolves,exportData,importData} from "./storage.js";
import {wipeCubeClashData} from "./reset.js";
import {P2PRoom} from "./p2p.js";
const app=document.querySelector("#app"),toastEl=document.querySelector("#toast");let deferredInstall=null;let settings={};try{settings=JSON.parse(localStorage.getItem("cubeclash-settings")||"{}")}catch{settings={}}settings.inspection??=15;settings.sound??=true;settings.name??="";let s={puzzle:"333",scramble:"",phase:"ready",matchPhase:"ready",inspectionStart:0,solveStart:0,raf:0,last:null,room:null,role:null,opponent:{time:"0.00",status:"WAITING"},round:1,mediaQuality:"FAIR",mediaStatsRaf:0,nextRoundReady:false};
const savedTheme=localStorage.getItem("cubeclash-theme")||"dark";
function applyTheme(theme){document.body.classList.toggle("theme-light",theme==="light");document.documentElement.style.colorScheme=theme;localStorage.setItem("cubeclash-theme",theme);document.querySelectorAll(".theme-option").forEach(x=>x.classList.toggle("active",x.dataset.theme===theme));}
function bindTheme(){document.querySelectorAll(".theme-option").forEach(b=>b.onclick=()=>applyTheme(b.dataset.theme));}
function themePanel(){return `<div class="theme-panel"><div class="theme-head"><strong>SELECT THEME</strong><span>APPEARANCE</span></div><div class="theme-options"><button class="theme-option" data-theme="dark"><div class="theme-preview dark"></div><strong>DARK</strong><small>OBSIDIAN / HIGH CONTRAST</small></button><button class="theme-option" data-theme="light"><div class="theme-preview light"></div><strong>WHITE</strong><small>CLEAN / LIGHT GRID</small></button></div><div class="menu-note">YOUR THEME IS SAVED ON THIS DEVICE. YOU CAN CHANGE IT LATER IN SETTINGS.</div></div>`}
const toast=x=>{toastEl.textContent=x;toastEl.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>toastEl.classList.remove("show"),1800)};const esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));const fmt=ms=>(ms/1000).toFixed(2);function v(x){app.innerHTML=`<section class="view">${x}</section>`}const MOVES={333:["R","L","U","D","F","B"],222:["R","L","U","D","F","B"]};
function randomScramble(){const faces=MOVES[s.puzzle]||MOVES[333],suffix=["","'","2"];let out=[],lastAxis="";const axis={R:"x",L:"x",U:"y",D:"y",F:"z",B:"z"};while(out.length<(s.puzzle==="222"?9:20)){const f=faces[Math.floor(Math.random()*faces.length)];if(axis[f]===lastAxis)continue;lastAxis=axis[f];out.push(f+suffix[Math.floor(Math.random()*suffix.length)]);}return out.join(" ");}
async function scr(){s.scramble=randomScramble();return s.scramble}function cube(){return `<div class="cube3d-wrap"><div class="cube3d" id="cube3d" data-puzzle="${s.puzzle}" data-scramble="${esc(s.scramble)}"></div></div>`}
function rot(v,axis,dir){let [x,y,z]=v;if(axis==="x")return dir>0?[x,-z,y]:[x,z,-y];if(axis==="y")return dir>0?[z,y,-x]:[-z,y,x];return dir>0?[-y,x,z]:[y,-x,z]}
function buildCubeState(size,scramble){const vals=[-1,1],coords=[];for(let x=0;x<size;x++)for(let y=0;y<size;y++)for(let z=0;z<size;z++)coords.push({p:[x*2/(size-1)-1,y*2/(size-1)-1,z*2/(size-1)-1],stickers:[]});const colors={x1:"R",x0:"O",y1:"W",y0:"Y",z1:"G",z0:"B"};for(const c of coords){const [x,y,z]=c.p;if(x===1)c.stickers.push([[1,0,0],colors.x1]);if(x===-1)c.stickers.push([[-1,0,0],colors.x0]);if(y===1)c.stickers.push([[0,1,0],colors.y1]);if(y===-1)c.stickers.push([[0,-1,0],colors.y0]);if(z===1)c.stickers.push([[0,0,1],colors.z1]);if(z===-1)c.stickers.push([[0,0,-1],colors.z0]);}
for(const token of scramble.trim().split(/\s+/)){if(!token)continue;const face=token[0],turns=token.endsWith("2")?2:1,dir=token.includes("'")?-1:1;const axis={R:"x",L:"x",U:"y",D:"y",F:"z",B:"z"}[face];const layer={R:1,L:-1,U:1,D:-1,F:1,B:-1}[face];const sign={R:-1,L:1,U:1,D:-1,F:-1,B:1}[face];for(let n=0;n<turns;n++)for(const c of coords){if(c.p[axis==="x"?0:axis==="y"?1:2]!==layer)continue;c.p=rot(c.p,axis,sign*dir);c.stickers=c.stickers.map(([normal,color])=>[rot(normal,axis,sign*dir),color]);}}
return coords}
function stickerTransform(n){const [x,y,z]=n;const d=31;if(x===1)return `rotateY(90deg) translateZ(${d}px)`;if(x===-1)return `rotateY(-90deg) translateZ(${d}px)`;if(y===1)return `rotateX(90deg) translateZ(${d}px)`;if(y===-1)return `rotateX(-90deg) translateZ(${d}px)`;if(z===1)return `translateZ(${d}px)`;return `rotateY(180deg) translateZ(${d}px)`}
function renderCube(){const root=document.querySelector("#cube3d");if(!root)return;const size=s.puzzle==="222"?2:3;const gap=size===2?7:5;const cubie=size===2?76:58;const pitch=cubie+gap;const step=size===2?pitch/2:pitch;const state=buildCubeState(size,s.scramble);root.innerHTML="";root.style.width=`${size*pitch}px`;root.style.height=`${size*pitch}px`;root.dataset.size=size;for(const c of state){const el=document.createElement("div");el.className="cubelet";el.style.width=`${cubie}px`;el.style.height=`${cubie}px`;el.style.setProperty("--half",`${cubie/2}px`);el.style.transform=`translate3d(${c.p[0]*step}px,${-c.p[1]*step}px,${c.p[2]*step}px)`;for(const [n,color] of c.stickers){const st=document.createElement("i");st.className=`sticker sticker-${color}`;st.style.transform=stickerTransform(n);el.appendChild(st)}root.appendChild(el)}
  root.onpointerdown=e=>{root.setPointerCapture(e.pointerId);root.dataset.dragging="1";root._sx=e.clientX;root._sy=e.clientY;root._rx=parseFloat(root.dataset.rx||"-28");root._ry=parseFloat(root.dataset.ry||"-38")};root.onpointermove=e=>{if(root.dataset.dragging!=="1")return;const dx=e.clientX-root._sx,dy=e.clientY-root._sy;root.style.transform=`rotateX(${root._rx-dy*.35}deg) rotateY(${root._ry+dx*.35}deg)`};root.onpointerup=root.onpointercancel=e=>{root.dataset.dragging="0";const m=getComputedStyle(root).transform;if(m&&m!=="none"){} };}
async function mountCube(){try{renderCube()}catch(err){console.error("CubeClash cube renderer error:",err);const h=document.querySelector("#cube3d");if(h)h.innerHTML=`<div class="cube-error"><strong>3D CUBE ERROR</strong><span>${esc(err.message||String(err))}</span></div>`}}
async function solo(){if(!s.scramble)await scr();const a=await getSolves(),valid=a.filter(x=>x.penalty!=="DNF").map(x=>x.timeMs+(x.penalty==="+2"?2000:0));const avg=n=>valid.length>=n?fmt(valid.slice(0,n).reduce((a,b)=>a+b,0)/n):"—";v(`<div class="timer-page"><div class="timer-top"><div class="section-title" style="flex:1;margin:0"><h1>SOLO TIMER</h1><small>LOCAL SESSION</small></div><div class="room-actions"><select id="p"><option value="333" ${s.puzzle==="333"?"selected":""}>3×3</option><option value="222" ${s.puzzle==="222"?"selected":""}>2×2</option></select><button class="ghost-btn" id="new">NEW SCRAMBLE</button><button class="ghost-btn" data-view="home">BACK</button></div></div><div class="scramble-bar"><div class="scramble-text">${esc(s.scramble)}</div><button class="ghost-btn" id="copy">COPY</button></div><div class="timer-layout"><div class="timer-panel"><div class="timer-zone" id="zone"><div class="timer-status"><div class="timer-value" id="tv">${s.last?.display||"0.00"}</div><div class="timer-label" id="tl">READY</div><div class="timer-hint">SPACE / ENTER · TOUCH TO START</div></div></div><div class="timer-panel-footer"><div class="metric"><small>PUZZLE</small><strong>${s.puzzle==="333"?"3×3":"2×2"}</strong></div><div class="metric"><small>INSPECTION</small><strong>${settings.inspection}s</strong></div><div class="metric"><small>LAST</small><strong>${s.last?.display||"—"}</strong></div></div></div><div class="cube-panel"><div class="cube-head"><span>SCRAMBLE VISUALIZATION</span><span>3D</span></div>${cube()}</div></div><div class="stats-panel"><div class="stats-grid"><div class="stat-box"><small>SOLVES</small><strong>${a.length}</strong></div><div class="stat-box"><small>BEST</small><strong>${valid.length?fmt(Math.min(...valid)):"—"}</strong></div><div class="stat-box"><small>AO5</small><strong>${avg(5)}</strong></div><div class="stat-box"><small>AO12</small><strong>${avg(12)}</strong></div></div><div class="solves-list">${a.slice(0,12).map((x,i)=>`<div class="solve-row"><span>${a.length-i}</span><span>${esc(x.scramble)}</span><span>${esc(x.display)}</span><span class="muted">${x.puzzle==="333"?"3×3":"2×2"}</span></div>`).join("")||'<div class="empty">NO SOLVES YET</div>'}</div></div></div>`);bindSolo()}
function set(ms,label){document.querySelector("#tv").textContent=fmt(ms);document.querySelector("#tl").textContent=label}function stop(){cancelAnimationFrame(s.raf)}function loop(){const n=performance.now();if(s.phase==="inspection")set(Math.max(0,settings.inspection*1000-(n-s.inspectionStart)),"INSPECTION");if(s.phase==="solving")set(n-s.solveStart,"SOLVING");s.raf=requestAnimationFrame(loop)}function press(){if(s.phase==="ready"||s.phase==="stopped"){s.phase="inspection";s.inspectionStart=performance.now();loop();return}if(s.phase==="inspection"){const e=performance.now()-s.inspectionStart;s.penalty=e>=17000?"DNF":e>=15000?"+2":"";s.phase="solving";s.solveStart=performance.now();return}if(s.phase==="solving")finish()}async function finish(){const ms=performance.now()-s.solveStart;stop();s.phase="stopped";const display=s.penalty==="DNF"?"DNF":fmt(ms+(s.penalty==="+2"?2000:0));s.last={display};await addSolve({id:crypto.randomUUID(),createdAt:Date.now(),puzzle:s.puzzle,scramble:s.scramble,timeMs:ms,penalty:s.penalty,display});toast(display);setTimeout(async()=>{s.phase="ready";await scr();solo()},300)}function bindSolo(){mountCube();document.querySelector("#new").onclick=async()=>{stop();s.phase="ready";await scr();solo()};document.querySelector("#p").onchange=async e=>{s.puzzle=e.target.value;stop();s.phase="ready";await scr();solo()};document.querySelector("#copy").onclick=()=>navigator.clipboard?.writeText(s.scramble).then(()=>toast("SCRAMBLE COPIED"));document.querySelector("#zone").onpointerdown=()=>press();window.onkeydown=e=>{if((e.code==="Space"||e.code==="Enter")&&!e.repeat){e.preventDefault();press()}}}
function tutorial(){v(`<div class="tutorial-screen"><div class="tutorial-card"><div class="tutorial-kicker">FIRST TIME SETUP / 01</div><h1 class="tutorial-title">HOW CUBECLASH WORKS</h1><p class="tutorial-intro">A quick guide before you start. You can reopen this tutorial later from the menu.</p><div class="tutorial-steps"><article><span>01</span><h2>CHOOSE A PUZZLE</h2><p>Select 2×2 or 3×3. CubeClash generates a new random-state scramble for every solve.</p></article><article><span>02</span><h2>READ THE SCRAMBLE</h2><p>The 3D cube shows the exact state produced by the scramble, so the visual matches the moves shown above it.</p></article><article><span>03</span><h2>INSPECTION</h2><p>Press Space, Enter, or touch the timer to begin inspection. Under 15 seconds is normal, 15 to under 17 seconds is +2, and 17 seconds or more is DNF.</p></article><article><span>04</span><h2>SOLVE</h2><p>Press again to start the solve, then press again when you finish. Your result is saved on this device.</p></article><article><span>05</span><h2>1V1 ROOMS</h2><p>For beta, rooms use a browser-to-browser WebRTC connection. The host and guest exchange connection data to connect.</p></article><article><span>06</span><h2>YOUR DATA</h2><p>Solves and settings stay in your browser. Use JSON export if you want a backup or to move your timer data.</p></article></div><div class="tutorial-actions"><button class="primary-btn" id="tutorialStart">I UNDERSTAND — OPEN MENU</button></div></div></div>`);document.querySelector("#tutorialStart").onclick=()=>{localStorage.setItem("cubeclash-tutorial-seen","1");home()}}
function dashboard(){v(`<div class="hero"><div class="hero-grid"><div><div class="section-title"><small>01 / SPEEDCUBING PLATFORM</small><small>BETA</small></div><h1 class="hero-title cube-font">CUBE<span>CLASH</span></h1><p class="hero-copy">A smooth responsive 2×2 and 3×3 speedcubing timer with random-state scrambles, real 3D scramble visualization, local history, installable PWA support, and peer-to-peer 1v1 rooms.</p><div class="hero-actions"><button class="primary-btn" data-view="solo">SOLO TIMER</button><button class="ghost-btn" data-view="room">CREATE / JOIN 1V1</button></div></div><div class="technical-card"><div class="spec-list"><div class="spec"><span>PUZZLES</span><span>2×2 / 3×3</span></div><div class="spec"><span>SCRAMBLES</span><span>RANDOM-STATE</span></div><div class="spec"><span>SYNC</span><span>WEBRTC P2P</span></div><div class="spec"><span>STORAGE</span><span>INDEXEDDB</span></div><div class="spec"><span>INSTALL</span><span>PWA</span></div></div></div></div></div>`)}
function home(){v(`<div class="menu-screen"><div class="menu-wrap"><section class="menu-main"><div class="menu-content"><div class="menu-kicker">WELCOME / CUBECLASH BETA</div><h1 class="menu-title">CUBE<span>CLASH</span></h1><p class="menu-sub">A competitive speedcubing platform for 2×2 and 3×3. Choose your appearance, then enter the timer or a 1v1 room.</p><div class="menu-actions"><button class="menu-action" data-view="solo"><span>SOLO TIMER</span><span class="arrow">→</span></button><button class="menu-action" data-view="room"><span>CREATE / JOIN 1V1</span><span class="arrow">→</span></button><button class="menu-action" data-view="settings"><span>SETTINGS</span><span class="arrow">→</span></button></div></div></section></div></div>`);applyTheme(savedTheme||"dark")}

function exposeMatchBridge(){
  window.CubeClashBridge={get state(){return {role:s.role,roomCode:s.roomCode||"",scramble:s.scramble||"",puzzle:s.puzzle||"333",match:s.match||null,opponent:s.opponent||{time:"0.00",status:"WAITING"},phase:s.matchPhase||"ready",theme:localStorage.getItem("cubeclash-theme")||"dark",name:settings.name||""}},get localStream(){return s.localStream||null},get remoteStream(){return s.remoteStream||null}};
}
exposeMatchBridge();
function room(){
  v(`<div class="room-page"><div class="section-title"><h1>1V1 ROOM</h1><small>LIVE WEBRTC / PEER-TO-PEER</small></div><div class="room-layout"><div class="room-card"><h2>CREATE ROOM</h2><p class="room-help">Choose the puzzle, number of rounds, inspection time, and penalties. Share the room code with Player 2.</p><div class="form-grid"><div class="field"><label>PUZZLE</label><select id="rp"><option value="333">3×3</option><option value="222">2×2</option></select></div><div class="field"><label>ROUNDS</label><select id="rr"><option>1</option><option>3</option><option selected>5</option><option>7</option></select></div><div class="field"><label>INSPECTION</label><select id="ri"><option>15</option><option>10</option><option>0</option></select></div><div class="field"><label>FORMAT</label><select id="rf"><option>FIRST TO</option><option>BEST OF</option></select></div></div><div class="checks"><label class="check"><input id="rp2" type="checkbox" checked> +2</label><label class="check"><input id="rdnf" type="checkbox" checked> DNF</label></div><button class="primary-btn" id="create">CREATE ROOM</button><div id="hostRoom" class="room-code-box" hidden></div></div><div class="room-card"><h2>JOIN ROOM</h2><p class="room-help">Enter the room code shown by Player 1. The match stays on this same page.</p><div class="field"><label>ROOM CODE</label><input id="roomCode" class="code-input" autocomplete="off" autocapitalize="characters" placeholder="e.g. CC7A9P2Q"></div><button class="primary-btn" id="join">JOIN ROOM</button></div></div><div id="rs" class="empty">NO ACTIVE ROOM</div></div>`);
  document.querySelector("#create").onclick=createRoom;
  document.querySelector("#join").onclick=joinRoom;
}
function showRoomStatus(title,body="",kind=""){
  const e=document.querySelector("#rs");
  if(!e)return;
  e.className=`room-card ${kind}`;
  e.innerHTML=`<h2>${esc(title)}</h2>${body?`<p class="room-help">${esc(body)}</p>`:""}`;
}
function makeRoomCode(id){return id.slice(-8).toUpperCase()}
async function createRoom(){
  try{
    s.role="host";
    s.puzzle=document.querySelector("#rp").value;
    s.match={rounds:+document.querySelector("#rr").value,inspection:+document.querySelector("#ri").value,format:document.querySelector("#rf").value,allowPlus2:document.querySelector("#rp2").checked,allowDNF:document.querySelector("#rdnf").checked,round:1,score:[0,0],status:"WAITING",scramble:""};
    s.room=new P2PRoom("host"); wireRoom();
    showRoomStatus("CREATING ROOM","Connecting to the room service…");
    const peerId=await s.room.createRoom(); s.roomCode=makeRoomCode(peerId);
    const hostBox=document.querySelector("#hostRoom");
    if(hostBox){hostBox.hidden=false;hostBox.innerHTML=`<div class="room-code-label">ROOM CODE</div><div class="room-code">${esc(s.roomCode)}</div><button class="ghost-btn" id="copyRoomCode">COPY CODE</button>`;document.querySelector("#copyRoomCode").onclick=()=>copyText(s.roomCode)}
    showRoomStatus("ROOM READY","Give the room code to Player 2. The match will appear here when they join."); toast("ROOM CREATED");
  }catch(err){console.error(err);showRoomStatus("ROOM CREATION FAILED",err.message||String(err),"error");toast("CREATE ROOM FAILED")}
}
async function joinRoom(){
  try{
    const code=(document.querySelector("#roomCode")?.value||"").trim(); if(!code)throw new Error("Enter the room code first.");
    s.role="guest"; s.room=new P2PRoom("guest"); wireRoom();
    showRoomStatus("CONNECTING",`Looking for room ${code.toUpperCase()}…`);
    const ok=await s.room.joinRoom(code); if(ok)toast("PLAYER 1 CONNECTED");
  }catch(err){console.error(err);showRoomStatus("JOIN FAILED",err.message||String(err),"error");toast("JOIN FAILED")}
}
function copyText(text){
  navigator.clipboard?.writeText(text).then(()=>toast("COPIED")).catch(()=>{const a=document.createElement("textarea");a.value=text;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();toast("COPIED")});
}
function wireRoom(){
  if(s.room._wired)return; s.room._wired=true;
  s.room.on("state",state=>{
    if(state==="connected"){
      if(s.role==="host"){
        if(!s.scramble)s.scramble=randomScramble();
        try{s.room.send({type:"match-config",match:{...s.match,puzzle:s.puzzle,names:{host:settings.name||"PLAYER 1",guest:"PLAYER 2"}},scramble:s.scramble})}catch(e){console.error(e)}
      }else{
        try{s.room.send({type:"player-name",name:settings.name||"PLAYER 2"})}catch(e){console.error(e)}
      }
      setTimeout(()=>showCameraPermission(),120);
    }
    if(state==="camera-requested"&&s.localStream){try{s.room.answerWithMedia(s.localStream)}catch(e){console.error(e)}}
    if(state==="closed")showRoomStatus("PLAYER DISCONNECTED","The peer connection closed.","error");
    if(state==="signaling-disconnected")showRoomStatus("SIGNALING DISCONNECTED","The signaling service was lost. The current peer connection may continue.","error");
  }).on("message",msg=>{
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="match-config"&&s.role==="guest"){
      s.match=msg.match; s.puzzle=msg.match.puzzle; s.scramble=msg.scramble||randomScramble();
      renderMatch(true); setTimeout(()=>showCameraPermission(),0); toast("MATCH READY"); return;
    }
    if(msg.type==="player-name"&&s.role==="host"){
      s.match=s.match||{}; s.match.names=s.match.names||{}; s.match.names.guest=(msg.name||"PLAYER 2").slice(0,24);
      if(document.querySelector("#matchTimerZone"))renderMatch(false);
      return;
    }
    if(msg.type==="camera-ready"){
      s.remoteMediaReady=true;
      if(s.localStream){try{s.room.startMediaCall(s.localStream)}catch(e){console.error(e)}}
    }
    if(msg.type==="camera-skipped"){s.remoteMediaReady=false;updateMatchUI()}
    if(msg.type==="timer-inspection")setOpponentState("INSPECTION",msg.startedAt,msg.round);
    if(msg.type==="timer-start")setOpponentState("SOLVING",msg.startedAt,msg.round);
    if(msg.type==="timer-tick"){
      if(msg.round===s.match?.round && (msg.status==="INSPECTION"||msg.status==="SOLVING")){
        s.opponent.status=msg.status; s.opponent.startedAt=msg.startedAt||s.opponent.startedAt; s.opponent.inspection=msg.inspection??(s.match?.inspection||15); s.opponent.round=msg.round; s.opponent.time=msg.time||s.opponent.time||"0.00"; updateMatchUI();
      }
    }
    if(msg.type==="timer-finish"){
      s.opponent.status="FINISHED"; s.opponent.time=msg.display||"—"; s.opponent.result=msg.display||"—"; s.opponent.rawMs=msg.rawMs||0; s.opponent.finishedAt=Date.now(); updateMatchUI();
      if(msg.round===s.match?.round){s.remoteRoundResult=msg.display||"DNF";s.remotePenalty=msg.penalty||"";s.remoteRawMs=msg.rawMs||0;}
      maybeResolveRound();
    }
    if(msg.type==="timer-result-update"){
      if(msg.round===s.match?.round){s.remoteRoundResult=msg.display||"DNF";s.remotePenalty=msg.penalty||"";s.opponent.time=msg.display||s.opponent.time;s.opponent.result=msg.display||s.opponent.result;updateMatchUI();maybeResolveRound(true)}
    }
    if(msg.type==="round-result"){
      if(msg.round===s.match?.round){s.roundResult=msg;updateMatchUI();}
    }
    if(msg.type==="next-round-ready"){
      if(msg.round===s.match?.round){s.remoteNextRoundReady=true;updateMatchUI();if(s.nextRoundReady)advanceRound();}
    }
    if(msg.type==="next-round"){
      s.match.round=msg.round; s.match.score=msg.score||s.match.score; s.scramble=msg.scramble||randomScramble(); s.nextRoundReady=false;s.remoteNextRoundReady=false; resetMatchRound();
    }
    if(msg.type==="match-over"){
      s.match.status="FINISHED"; s.match.winner=msg.winner||"DRAW"; updateMatchUI();
    }
  }).on("stream",stream=>{
    s.remoteStream=stream; const v=document.querySelector("#remoteVideo"); if(v){v.srcObject=stream; v.autoplay=true; v.playsInline=true; v.play().catch(()=>{document.querySelector("#remoteVideo")?.setAttribute("controls","true")})} const note=document.querySelector("#remoteCamState"); if(note)note.textContent="OPPONENT CAMERA + MIC CONNECTED";
  }).on("error",err=>{console.error("CubeClash P2P error",err);toast(err.message||String(err));});
}
async function startMediaQualityMonitor(){
  cancelAnimationFrame(s.mediaStatsRaf);
  const tick=async()=>{
    let quality="GOOD";
    try{
      const call=s.room?.call, pc=call?.peerConnection;
      if(pc?.getStats){let rtt=0,loss=0,packets=0,bytes=0;const stats=await pc.getStats();stats.forEach(x=>{if(x.type==="candidate-pair"&&(x.state==="succeeded"||x.nominated)){rtt=Math.max(rtt,(x.currentRoundTripTime||0)*1000)}if(x.type==="inbound-rtp"&&x.kind==="video"){loss+=x.packetsLost||0;packets+=x.packetsReceived||0;bytes+=x.bytesReceived||0}});const lossRate=packets?loss/(packets+loss):0;if(rtt>250||lossRate>.08)quality="POOR";else if(rtt>120||lossRate>.03)quality="FAIR";else quality="GOOD";}
    }catch{}
    s.mediaQuality=quality;updateMatchUI();try{await s.room?.configureMediaQuality(quality)}catch{};s.mediaStatsRaf=setTimeout(()=>startMediaQualityMonitor(),1200);
  };
  tick();
}
function setMediaSenderParams(){try{s.room?.configureMedia(s.localStream)}catch(e){console.warn(e)}}
async function showCameraPermission(){
  if(!s.room)return;
  renderMatch(true);
  const modal=document.querySelector("#cameraModal"); if(!modal)return; modal.hidden=false;
  document.querySelector("#matchConnection")?.replaceChildren(document.createTextNode("CONNECTED"));
  const allow=document.querySelector("#allowCamera"),skip=document.querySelector("#skipCamera");
  allow.onclick=async()=>{
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera and microphone access is not supported in this browser.");
      s.localStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280,max:1280},height:{ideal:720,max:720},frameRate:{ideal:30,max:30},resizeMode:"crop-and-scale"},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:{ideal:1}}});
      const local=document.querySelector("#localVideo"); if(local){local.srcObject=s.localStream;local.play().catch(()=>{})}
      try{await s.room.configureMedia(s.localStream)}catch(e){console.warn("media tuning",e)}
      startMediaQualityMonitor();
      modal.hidden=true; updateCameraState("CAMERA + MIC READY");
      if(s.room.pendingCall){try{s.room.answerWithMedia(s.localStream)}catch(e){console.error(e)}}
      try{s.room.send({type:"camera-ready"})}catch(e){console.error(e)}
      if(s.remoteMediaReady){try{s.room.startMediaCall(s.localStream)}catch(e){console.error(e)}}
      updateMatchUI(); toast("CAMERA + MIC READY");
    }catch(err){console.error("Media permission error",err);updateCameraState("PERMISSION BLOCKED — CHECK BROWSER SETTINGS");toast(err?.name==="NotAllowedError"?"CAMERA/MIC PERMISSION DENIED":"CAMERA OR MIC UNAVAILABLE")}
  };
  skip.onclick=()=>{modal.hidden=true;updateCameraState("CAMERA + MIC OFF");try{s.room.send({type:"camera-skipped"})}catch{};updateMatchUI()};
}
function colorClass(c){return `face-${c}`}
function faceletGrid(size,stickers,face){
  const n=size, cells=Array.from({length:n*n},()=>"face-X");
  for(const item of stickers){
    const [pos,normal,color]=item; const [x,y,z]=pos;
    let row=0,col=0;
    if(face==="U"){row=Math.round(z*(n-1)/2+(n-1)/2);col=Math.round(x*(n-1)/2+(n-1)/2)}
    if(face==="D"){row=Math.round(-z*(n-1)/2+(n-1)/2);col=Math.round(x*(n-1)/2+(n-1)/2)}
    if(face==="F"){row=Math.round(-y*(n-1)/2+(n-1)/2);col=Math.round(x*(n-1)/2+(n-1)/2)}
    if(face==="B"){row=Math.round(-y*(n-1)/2+(n-1)/2);col=Math.round(-x*(n-1)/2+(n-1)/2)}
    if(face==="R"){row=Math.round(-y*(n-1)/2+(n-1)/2);col=Math.round(-z*(n-1)/2+(n-1)/2)}
    if(face==="L"){row=Math.round(-y*(n-1)/2+(n-1)/2);col=Math.round(z*(n-1)/2+(n-1)/2)}
    if(row>=0&&row<n&&col>=0&&col<n)cells[row*n+col]=colorClass(color)
  }
  return cells.map(c=>`<i class="facelet ${c}"></i>`).join("")
}
function render2DScramble(){
  const root=document.querySelector("#scramble2DVisual"); if(!root)return;
  const size=s.puzzle==="222"?2:3, state=buildCubeState(size,s.scramble), by={U:[],D:[],F:[],B:[],R:[],L:[]};
  const normals={U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],R:[1,0,0],L:[-1,0,0]};
  for(const c of state)for(const [normal,color] of c.stickers){
    for(const [face,n] of Object.entries(normals))if(normal[0]===n[0]&&normal[1]===n[1]&&normal[2]===n[2])by[face].push([c.p,normal,color]);
  }
  const faces=["U","L","F","R","B","D"];
  root.innerHTML=faces.map(face=>`<div class="net-face net-${face}" style="--n:${size}"><span class="net-label">${face}</span>${faceletGrid(size,by[face],face)}</div>`).join("");
}
function renderMatch(preconnect=false){
  if(window._cubeClashMatchKeyHandler){document.removeEventListener("keydown",window._cubeClashMatchKeyHandler,true);window._cubeClashMatchKeyHandler=null;}
  const rounds=s.match?.rounds||1, round=s.match?.round||1, score=s.match?.score||[0,0];
  v(`<div class="match-page"><div class="match-head"><div><div class="section-title" style="margin:0"><h1>1V1 MATCH</h1><small>${s.role==="host"?(settings.name||"PLAYER 1")+" / HOST":(s.match?.names?.guest||"PLAYER 2")+" / GUEST"}</small></div></div><div class="match-meta"><span id="matchRound">ROUND ${round} / ${rounds}</span><span id="matchScore">${score[0]} — ${score[1]}</span><button class="ghost-btn" id="exitMatch">EXIT</button></div></div><div class="video-row"><div class="video-card"><div class="video-label">YOU</div><video id="localVideo" autoplay muted playsinline></video><div class="video-state" id="localCamState">${s.localStream?"CAMERA + MIC READY":"CAMERA + MIC WAITING"}</div></div><div class="video-card"><div class="video-label">OPPONENT</div><video id="remoteVideo" autoplay playsinline></video><div class="video-state" id="remoteCamState">WAITING FOR CAMERA + MIC</div></div></div><div class="match-grid"><div class="player-card"><div class="player-name">${s.role==="host"?(settings.name||"PLAYER 1"):(s.match?.names?.guest||"PLAYER 2")}</div><div class="player-state"><div class="player-timer" id="myTimer">0.00</div><small id="myState">READY</small></div><div></div></div><div class="center-match"><div class="scramble-2d"><div class="scramble-2d-label">2D SCRAMBLE VISUALIZATION</div><div class="scramble-net" id="scramble2DVisual"></div><div class="center-scramble" id="matchScramble">${esc(s.scramble||"WAITING FOR SCRAMBLE")}</div></div><div class="match-instructions"><span class="desktop-only">SPACE / ENTER — INSPECTION → SOLVE → FINISH</span><span class="mobile-only">TAP TIMER — INSPECTION · LONG PRESS — START · TAP — FINISH</span></div><div class="match-timer-zone" id="matchTimerZone"><div class="match-main-timer" id="matchMainTimer">0.00</div><div class="match-main-label" id="matchMainLabel">READY</div></div><div class="match-result-tools" id="matchResultTools" hidden><div class="penalty-label">RESULT ADJUSTMENT</div><div class="penalty-buttons"><button class="ghost-btn penalty-btn" id="penaltyPlus2">+2</button><button class="ghost-btn penalty-btn" id="penaltyDnf">DNF</button></div><div class="result-note" id="resultNote"></div></div><div class="match-controls"><span class="match-connection" id="matchConnection">${preconnect?"CONNECTING":"CONNECTED"}</span><span class="media-quality" id="mediaQuality">CONNECTION: ${s.mediaQuality||"FAIR"}</span><button class="ghost-btn" id="muteMic">MIC ON</button><button class="ghost-btn" id="nextRound" hidden>NEXT ROUND</button></div></div><div class="player-card"><div class="player-name">${s.role==="host"?(s.match?.names?.guest||"PLAYER 2"):(s.match?.names?.host||"PLAYER 1")}</div><div class="player-state"><div class="player-timer" id="oppTimer">${s.opponent.time||"0.00"}</div><small id="oppState">${s.opponent.status||"WAITING"}</small></div><div></div></div></div><div class="camera-modal" id="cameraModal" hidden><div class="camera-modal-card"><div class="room-code-label">MATCH CAMERA + MICROPHONE</div><h2>ALLOW CAMERA + MIC</h2><p>Both players are connected. Allow CubeClash to use your camera and microphone for the 1v1 match.</p><div class="room-actions"><button class="primary-btn" id="allowCamera">ALLOW CAMERA + MIC</button><button class="ghost-btn" id="skipCamera">CONTINUE WITHOUT CAMERA + MIC</button></div></div></div></div>`);
  requestAnimationFrame(()=>{render2DScramble();setTimeout(render2DScramble,60);});
  if(s.localStream){const lv=document.querySelector("#localVideo");if(lv)lv.srcObject=s.localStream}
  if(s.remoteStream){const rv=document.querySelector("#remoteVideo");if(rv)rv.srcObject=s.remoteStream}
  document.querySelector("#exitMatch").onclick=()=>home();
  document.querySelector("#nextRound").onclick=nextRound;
  document.querySelector("#penaltyPlus2").onclick=()=>setMatchPenalty("+2");
  document.querySelector("#penaltyDnf").onclick=()=>setMatchPenalty("DNF");
  document.querySelector("#muteMic").onclick=toggleMic;
  bindMatchTimer(); updateCameraState(s.localStream?"CAMERA + MIC READY":"CAMERA + MIC WAITING"); updateMatchUI();
}
function isMobileTimer(){return window.matchMedia?.("(pointer:coarse)").matches||window.innerWidth<=760}
function bindMatchTimer(){
  const zone=document.querySelector("#matchTimerZone"); if(!zone)return;
  zone.tabIndex=0;
  let downAt=0,longTimer=0,longFired=false;
  const mobile=isMobileTimer();
  if(mobile){
    zone.onpointerdown=e=>{
      e.preventDefault();
      downAt=performance.now(); longFired=false; clearTimeout(longTimer);
      longTimer=setTimeout(()=>{longFired=true;if(s.matchPhase==="inspection")matchStart()},600);
    };
    zone.onpointerup=e=>{
      e.preventDefault(); clearTimeout(longTimer);
      if(longFired)return;
      const held=performance.now()-downAt;
      if(s.matchPhase==="ready"||s.matchPhase==="finished")matchInspection();
      else if(s.matchPhase==="solving")matchFinish();
      else if(s.matchPhase==="inspection"&&held<600)toast("LONG PRESS TO START SOLVE");
    };
    zone.onpointerleave=()=>clearTimeout(longTimer);
    zone.onpointercancel=()=>clearTimeout(longTimer);
  }
  const keyHandler=e=>{
    if(mobile)return;
    if(!document.querySelector("#matchTimerZone"))return;
    if((e.code==="Space"||e.code==="Enter")&&!e.repeat){
      e.preventDefault(); e.stopPropagation(); matchToggle();
    }
  };
  document.addEventListener("keydown",keyHandler,true);
  window._cubeClashMatchKeyHandler=keyHandler;
}

function toggleMic(){const tracks=s.localStream?.getAudioTracks()||[];if(!tracks.length){toast("MIC NOT AVAILABLE");return}const on=!tracks[0].enabled;tracks.forEach(t=>t.enabled=on);const b=document.querySelector("#muteMic");if(b)b.textContent=on?"MIC ON":"MIC OFF";toast(on?"MIC ON":"MIC MUTED")}
function updateCameraState(text){const e=document.querySelector("#localCamState");if(e)e.textContent=text}
function setOpponentState(status,time,round){
  s.opponent.status=status;
  if(time)s.opponent.startedAt=time;
  s.opponent.round=round||s.match?.round||1;
  s.opponent.inspection=s.match?.inspection||15;
  if(status==="INSPECTION"||status==="SOLVING")startOpponentLoop();
  updateMatchUI();
}
function startOpponentLoop(){
  cancelAnimationFrame(s.opponentRaf);
  const tick=()=>{
    if(!s.opponent.startedAt || (s.opponent.round||1)!==(s.match?.round||1))return;
    const elapsed=Math.max(0,Date.now()-s.opponent.startedAt);
    let ms=0;
    if(s.opponent.status==="INSPECTION") ms=Math.max(0,(s.opponent.inspection||15)*1000-elapsed);
    else if(s.opponent.status==="SOLVING") ms=elapsed;
    else return;
    s.opponent.time=fmt(ms);
    const t=document.querySelector("#oppTimer"); if(t)t.textContent=s.opponent.time;
    s.opponentRaf=requestAnimationFrame(tick);
  };
  tick();
}
function updateMatchUI(){
  const t=document.querySelector("#oppTimer"),st=document.querySelector("#oppState"),sc=document.querySelector("#matchScore"),r=document.querySelector("#matchRound"),mt=document.querySelector("#matchMainTimer"),ml=document.querySelector("#matchMainLabel");
  if(t)t.textContent=s.opponent.time||"0.00"; if(st)st.textContent=s.opponent.status||"WAITING"; if(sc)sc.textContent=`${s.match?.score?.[0]||0} — ${s.match?.score?.[1]||0}`; if(r)r.textContent=`ROUND ${s.match?.round||1} / ${s.match?.rounds||1}`;
  if(mt&&s.matchPhase==="ready")mt.textContent="0.00"; if(ml)ml.textContent=s.matchPhase==="inspection"?"INSPECTION":s.matchPhase==="solving"?"SOLVING":s.matchPhase==="finished"?"FINISHED":"READY";
  const nr=document.querySelector("#nextRound"), tools=document.querySelector("#matchResultTools"), note=document.querySelector("#resultNote");
  const bothFinished=!!s.myRoundResult&&!!s.remoteRoundResult;
  const finalRound=s.match?.round>=(s.match?.rounds||1);
  if(nr){const allowed=bothFinished&&!finalRound;nr.hidden=!allowed;nr.disabled=!allowed;nr.textContent=s.nextRoundReady?"WAITING FOR OPPONENT":"NEXT ROUND";}
  if(tools)tools.hidden=s.matchPhase!=="finished";
  if(note)note.textContent=s.matchPhase==="finished"?`YOUR RESULT: ${s.myRoundResult||"—"}${s.matchPenalty?` / ${s.matchPenalty}`:""}`:"";
  const q=document.querySelector("#mediaQuality");if(q)q.textContent=`CONNECTION: ${s.mediaQuality||"FAIR"}`;
}
function setMatchPenalty(penalty){
  if(s.matchPhase!=="finished"||!s.myRoundResult)return;
  s.matchPenalty=s.matchPenalty===penalty?"":penalty;
  const base=s.matchRawMs||0;
  const display=s.matchPenalty==="DNF"?"DNF":fmt(base+(s.matchPenalty==="+2"?2000:0));
  s.myRoundResult=display;
  const a=document.querySelector("#matchMainTimer"),b=document.querySelector("#myTimer");if(a)a.textContent=display;if(b)b.textContent=display;
  document.querySelectorAll(".penalty-btn").forEach(x=>x.classList.remove("active"));
  if(s.matchPenalty)document.querySelector(s.matchPenalty==="+2"?"#penaltyPlus2":"#penaltyDnf")?.classList.add("active");
  try{s.room?.send({type:"timer-result-update",display,penalty:s.matchPenalty,round:s.match?.round||1})}catch{}
  maybeResolveRound(true);
}

function matchInspection(){
  if(s.matchPhase&&s.matchPhase!=="ready"&&s.matchPhase!=="finished")return;
  s.matchPhase="inspection"; s.matchPenalty=""; s.matchInspectionStart=performance.now(); s.matchInspectionStartedAt=Date.now();
  try{s.room?.send({type:"timer-inspection",startedAt:Date.now(),round:s.match?.round||1,inspection:s.match?.inspection||15})}catch{}
  matchLoop(); updateMatchUI(); sendMatchTimerTick();
}
function matchStart(){
  if(s.matchPhase!=="inspection")return;
  const elapsed=performance.now()-s.matchInspectionStart; s.matchPenalty=elapsed>=17000?"DNF":elapsed>=15000?"+2":"";
  s.matchPhase="solving"; s.matchSolveStart=performance.now(); s.matchSolveStartedAt=Date.now();
  try{s.room?.send({type:"timer-start",startedAt:Date.now(),round:s.match?.round||1,inspection:s.match?.inspection||15})}catch{}
  matchLoop(); updateMatchUI(); sendMatchTimerTick();
}
function matchToggle(){if(s.matchPhase==="ready"||s.matchPhase==="finished")matchInspection();else if(s.matchPhase==="inspection")matchStart();else if(s.matchPhase==="solving")matchFinish()}
function matchLoop(){cancelAnimationFrame(s.matchRaf);const tick=()=>{const now=performance.now();if(s.matchPhase==="inspection"){const ms=Math.max(0,(s.match?.inspection||15)*1000-(now-s.matchInspectionStart));setMatchTimer(ms,"INSPECTION");}else if(s.matchPhase==="solving"){setMatchTimer(now-s.matchSolveStart,"SOLVING");}else{return} sendMatchTimerTick(); s.matchRaf=requestAnimationFrame(tick)};tick()}
function sendMatchTimerTick(){
  if(!s.room||!s.matchPhase)return;
  const now=performance.now();
  if(s._lastMatchTick&&now-s._lastMatchTick<100)return;
  s._lastMatchTick=now;
  const round=s.match?.round||1;
  if(s.matchPhase==="inspection"){
    const ms=Math.max(0,(s.match?.inspection||15)*1000-(performance.now()-s.matchInspectionStart));
    try{s.room.send({type:"timer-tick",status:"INSPECTION",startedAt:s.matchInspectionStartedAt||Date.now(),inspection:s.match?.inspection||15,round,time:fmt(ms)})}catch{}
  }else if(s.matchPhase==="solving"){
    const ms=Math.max(0,performance.now()-s.matchSolveStart);
    try{s.room.send({type:"timer-tick",status:"SOLVING",startedAt:s.matchSolveStartedAt||Date.now(),inspection:s.match?.inspection||15,round,time:fmt(ms)})}catch{}
  }
}
function setMatchTimer(ms,label){const a=document.querySelector("#matchMainTimer");if(a)a.textContent=fmt(ms);const b=document.querySelector("#matchMainLabel");if(b)b.textContent=label;const c=document.querySelector("#myTimer");if(c)c.textContent=fmt(ms)}
function matchFinish(){
  if(s.matchPhase!=="solving")return; cancelAnimationFrame(s.matchRaf); const ms=performance.now()-s.matchSolveStart; s.matchPhase="finished";
  s.matchRawMs=ms; const display=fmt(ms); s.myRoundResult=display; s.opponent.self=display;
  const a=document.querySelector("#matchMainTimer"),b=document.querySelector("#myTimer"),c=document.querySelector("#myState");if(a)a.textContent=display;if(b)b.textContent=display;if(c)c.textContent=s.matchPenalty?`FINISHED / ${s.matchPenalty}`:"FINISHED";
  try{s.room?.send({type:"timer-finish",display,rawMs:ms,penalty:"",round:s.match?.round||1})}catch{} updateMatchUI(); maybeResolveRound();
}
function resultValue(x){if(!x||x==="DNF")return Infinity;return parseFloat(x)}
function maybeResolveRound(force=false){
  if(!s.myRoundResult||!s.remoteRoundResult)return;
  const alreadyResolved=s._roundResolved===s.match?.round;
  if(alreadyResolved && !force)return;
  if(!alreadyResolved)s._roundResolved=s.match?.round;
  const a=resultValue(s.myRoundResult),b=resultValue(s.remoteRoundResult);let winner="DRAW";if(a<b)winner=s.role==="host"?(settings.name||"PLAYER 1"):(s.match?.names?.guest||"PLAYER 2");if(b<a)winner=s.role==="host"?(s.match?.names?.guest||"PLAYER 2"):(settings.name||"PLAYER 1");
  if(!alreadyResolved){if(winner==="PLAYER 1")s.match.score[0]++; if(winner==="PLAYER 2")s.match.score[1]++;}
  s.roundResult={round:s.match.round,winner,p1:s.role==="host"?s.myRoundResult:s.remoteRoundResult,p2:s.role==="host"?s.remoteRoundResult:s.myRoundResult};
  if(s.role==="host"){
    try{s.room.send({type:"round-result",...s.roundResult,round:s.match.round,score:s.match.score})}catch{}
    if(s.match.round>=s.match.rounds){s.match.status="FINISHED";s.match.winner=winner;try{s.room.send({type:"match-over",winner})}catch{}}
  }
  updateMatchUI();
}
function nextRound(){
  if(!s.roundResult||s.match.round>=(s.match.rounds||1)||!s.myRoundResult||!s.remoteRoundResult)return;
  if(s.nextRoundReady)return;
  s.nextRoundReady=true; updateMatchUI();
  try{s.room.send({type:"next-round-ready",round:s.match.round})}catch{}
  if(s.remoteNextRoundReady)advanceRound();
}
function advanceRound(){
  if(!s.nextRoundReady||!s.remoteNextRoundReady||s.match.round>=(s.match.rounds||1))return;
  if(s.role==="host"){
    s.match.round++; s.match.status="PLAYING"; s.scramble=randomScramble(); s.myRoundResult="";s.remoteRoundResult="";s.roundResult=null;s.opponent={time:"0.00",status:"WAITING"};s.nextRoundReady=false;s.remoteNextRoundReady=false;s._roundResolved=null;
    try{s.room.send({type:"next-round",round:s.match.round,score:s.match.score,scramble:s.scramble})}catch{} resetMatchRound();
  }
}

function resetMatchRound(){s.matchPhase="ready";s.matchPenalty="";cancelAnimationFrame(s.matchRaf);cancelAnimationFrame(s.opponentRaf);s.opponent={time:"0.00",status:"WAITING"};s.myRoundResult="";s.remoteRoundResult="";s.roundResult=null;s.matchRawMs=0;s.matchPenalty="";s.nextRoundReady=false;s.remoteNextRoundReady=false;s._roundResolved=null;renderMatch(false)}
function settingsView(){v(`<div class="section-title"><h1>SETTINGS</h1><small>LOCAL DEVICE</small></div><div class="settings-grid"><div class="setting-card"><h2>APPEARANCE</h2><div class="theme-options" style="margin-top:14px"><button class="theme-option" data-theme="dark"><div class="theme-preview dark"></div><strong>DARK</strong><small>OBSIDIAN / HIGH CONTRAST</small></button><button class="theme-option" data-theme="light"><div class="theme-preview light"></div><strong>WHITE</strong><small>CLEAN / LIGHT GRID</small></button></div></div><div class="setting-card"><h2>PROFILE</h2><div class="field"><label>DISPLAY NAME</label><input id="displayName" maxlength="24" value="${esc(settings.name||"")}" placeholder="YOUR NAME" autocomplete="nickname"></div><p style="color:#666;font-size:12px;line-height:1.6">Your name is shown to the other player during 1v1 matches.</p></div><div class="setting-card creator-card"><h2>CREATOR</h2><div class="creator-name">SID ANAJAO</div><p>Created and developed by Sid Anajao.</p></div><div class="setting-card"><h2>TIMER</h2><div class="field"><label>INSPECTION SECONDS</label><select id="ins"><option ${settings.inspection===0?"selected":""}>0</option><option ${settings.inspection===10?"selected":""}>10</option><option ${settings.inspection===15?"selected":""}>15</option></select></div><div class="room-actions"><button class="primary-btn" id="save">SAVE SETTINGS</button></div></div><div class="setting-card"><h2>DATA</h2><p style="color:#666;font-size:12px;line-height:1.6">Solves are stored locally in IndexedDB. Export your times before clearing browser data or moving to another device.</p><div class="room-actions"><button class="ghost-btn" id="ex">EXPORT JSON</button><label class="ghost-btn" style="display:grid;place-items:center;cursor:pointer">IMPORT JSON<input id="im" type="file" accept=".json" hidden></label><button class="danger-btn" id="cl">CLEAR SOLVES</button></div></div><div class="setting-card wipe-card"><h2>RESET / UPDATE</h2><p style="color:#666;font-size:12px;line-height:1.6">Use this when a new CubeClash update is installed and the old service worker or cached files are causing problems. CubeClash will automatically download a JSON backup of your solve history first, then clear local app data, caches, and the service worker.</p><div class="room-actions"><button class="danger-btn" id="wipeAll">EXPORT + WIPE APP DATA</button></div></div></div>`);bindTheme();applyTheme(localStorage.getItem("cubeclash-theme")||"dark");document.querySelector("#save").onclick=()=>{settings.inspection=+document.querySelector("#ins").value;settings.name=(document.querySelector("#displayName")?.value||"").trim().slice(0,24);localStorage.setItem("cubeclash-settings",JSON.stringify(settings));toast("SETTINGS SAVED")};document.querySelector("#ex").onclick=async()=>{const b=new Blob([JSON.stringify(await exportData(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`cubeclash-${Date.now()}.json`;a.click()};document.querySelector("#im").onchange=async e=>{try{await importData(JSON.parse(await e.target.files[0].text()));toast("DATA IMPORTED")}catch{toast("IMPORT FAILED")}};document.querySelector("#cl").onclick=async()=>{if(confirm("Clear all local solves? This cannot be undone unless you exported them.")){await clearSolves();toast("SOLVES CLEARED")}};document.querySelector("#wipeAll").onclick=async()=>{if(!confirm("CubeClash will export your solve history and then clear local app data, cache, settings, and service worker. Continue?"))return;try{await wipeCubeClashData({downloadBackup:true});alert("Backup downloaded. CubeClash will reload with a clean installation.");location.reload()}catch(e){console.error(e);toast("RESET FAILED")}}}
async function nav(x){if(x==="home")home();if(x==="solo")await solo();if(x==="room")room();if(x==="settings")settingsView()}document.addEventListener("click",e=>{const x=e.target.closest("[data-view]");if(x)nav(x.dataset.view)});window.addEventListener("online",()=>{document.querySelector("#networkText").textContent="ONLINE"});window.addEventListener("offline",()=>{document.querySelector("#networkText").textContent="OFFLINE"});window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;document.querySelector("#installBtn").hidden=false});document.querySelector("#installBtn").onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null}};if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./service-worker.js");
if(localStorage.getItem("cubeclash-tutorial-seen")==="1")home();else tutorial();
