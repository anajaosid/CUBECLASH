import {addSolve,getSolves,deleteSolve,clearSolves,exportData,importData} from "./storage.js";
import {bindSolveDeleteButtons} from "./solo-actions.js";
import {MOVES,CUBE_COLORS,MOVE_AXIS,MOVE_LAYER,MOVE_SIGN,COLOR_HEX,buildSolvedCubeState,applyMove,buildCubeState,inverseScramble,auditCubeEngine} from "./cube-engine.js";
import {wipeCubeClashData} from "./reset.js";
import {P2PRoom} from "./p2p.js";
const app=document.querySelector("#app"),toastEl=document.querySelector("#toast"); app.dataset.started="1";let deferredInstall=null;let settings={};try{settings=JSON.parse(localStorage.getItem("cubeclash-settings")||"{}")}catch{settings={}}settings.inspection??=15;settings.sound??=true;settings.name??="";settings.scrambleSpeed??=1;let s={puzzle:"333",scramble:"",phase:"ready",matchPhase:"ready",inspectionStart:0,solveStart:0,raf:0,last:null,room:null,role:null,opponent:{time:"0.00",status:"WAITING"},round:1,mediaQuality:"FAIR",mediaStatsRaf:0,nextRoundReady:false,matchHistory:[],blindMode:false,solveFolder:null};
const THEME_PRESETS={dark:{label:"Midnight",note:"Obsidian / High contrast",scheme:"dark"},light:{label:"Paper",note:"Clean / Light grid",scheme:"light"},aurora:{label:"Aurora",note:"Electric cyan / violet",scheme:"dark"},sunset:{label:"Sunset",note:"Warm amber / coral",scheme:"dark"},ice:{label:"Ice",note:"Cool blue / silver",scheme:"light"},forest:{label:"Forest",note:"Deep green / moss",scheme:"dark"},violet:{label:"Violet",note:"Neon purple / midnight",scheme:"dark"}};
const SOLVE_FOLDERS_KEY="cubeclash-solve-folders";
const ACTIVE_SOLVE_FOLDER_KEY="cubeclash-active-solve-folder";
const BLIND_RECORD_KEY="cubeclash-blind-record";
const PUZZLE_SIZES=[2,3,4,5,6,7];
function puzzleSizeFromCode(code){const size=Number(String(code||"333").charAt(0));return Number.isFinite(size)&&size>=2&&size<=7?size:3}
function puzzleCodeFromSize(size){return `${size}${size}${size}`}
function puzzleLabel(code){const size=puzzleSizeFromCode(code);return `${size}×${size}`}
function puzzleOptionsMarkup(selected="333"){const active=puzzleSizeFromCode(selected);return PUZZLE_SIZES.map(size=>`<option value="${puzzleCodeFromSize(size)}" ${active===size?"selected":""}>${size}×${size}</option>`).join("")}
function loadSolveFolders(){try{const data=JSON.parse(localStorage.getItem(SOLVE_FOLDERS_KEY)||"[]");return Array.isArray(data)?data:[]}catch{return[]}}
function saveSolveFolders(folders){localStorage.setItem(SOLVE_FOLDERS_KEY,JSON.stringify(folders.slice(0,24)))}
function loadActiveSolveFolder(){try{return JSON.parse(localStorage.getItem(ACTIVE_SOLVE_FOLDER_KEY)||"null")}catch{return null}}
function saveActiveSolveFolder(folder){localStorage.setItem(ACTIVE_SOLVE_FOLDER_KEY,JSON.stringify(folder))}
function loadBlindRecord(){try{return JSON.parse(localStorage.getItem(BLIND_RECORD_KEY)||"{\"best\":null,\"solves\":0}")}catch{return{best:null,solves:0}}}
function saveBlindRecord(record){localStorage.setItem(BLIND_RECORD_KEY,JSON.stringify(record))}
let solveFolders=loadSolveFolders();
let blindRecord=loadBlindRecord();
function defaultSolveFolder(){return {id:crypto.randomUUID(),name:"Cube Session",puzzle:"333",mode:"normal",inspection:settings.inspection||15,createdAt:Date.now(),updatedAt:Date.now()}}
function currentSolveFolder(){return loadActiveSolveFolder()||solveFolders[0]||null}
function normalizeSolveFolder(folder){const size=puzzleSizeFromCode(folder?.puzzle||"333");return {id:folder?.id||crypto.randomUUID(),name:(folder?.name||"Cube Session").trim().slice(0,32)||"Cube Session",puzzle:puzzleCodeFromSize(size),mode:folder?.mode==="blind"?"blind":folder?.mode==="onehand"?"onehand":"normal",inspection:Math.max(0,Math.min(30,Number(folder?.inspection??settings.inspection??15)||15)),createdAt:folder?.createdAt||Date.now(),updatedAt:Date.now()}}
function upsertSolveFolder(folder){const next=normalizeSolveFolder(folder);const index=solveFolders.findIndex(x=>x.id===next.id);if(index>=0)solveFolders[index]=next;else solveFolders.unshift(next);solveFolders=solveFolders.slice(0,24);saveSolveFolders(solveFolders);saveActiveSolveFolder(next);return next}
function applySolveFolder(folder){const next=normalizeSolveFolder(folder);s.solveFolder=next;s.puzzle=next.puzzle;s.blindMode=next.mode==="blind";s.oneHandMode=next.mode==="onehand";settings.inspection=next.inspection;return next}
function solveFolderSummary(folder){if(!folder)return"NO SESSION FOLDER";return `${folder.name} · ${puzzleLabel(folder.puzzle)}${folder.mode==="blind"?" · BLIND":folder.mode==="onehand"?" · ONE-HAND":""} · ${folder.inspection}s`}
const SOUND_URLS={start:"https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg",solve:"https://actions.google.com/sounds/v1/cartoon/pop.ogg",complete:"https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg"};
function playSound(name){if(!settings.sound)return;const url=SOUND_URLS[name];if(!url)return;try{const audio=new Audio(url);audio.volume=name==="complete"?.45:.35;audio.play().catch(()=>{});}catch{}}
function currentTheme(){const current=localStorage.getItem("cubeclash-theme")||"dark";return THEME_PRESETS[current]?current:"dark";}
function applyTheme(theme){const selected=THEME_PRESETS[theme]?theme:"dark";document.body.classList.remove("theme-light","theme-dark","theme-aurora","theme-sunset","theme-ice","theme-forest","theme-violet");document.body.classList.add(`theme-${selected}`);document.documentElement.style.colorScheme=THEME_PRESETS[selected].scheme;localStorage.setItem("cubeclash-theme",selected);document.querySelectorAll(".theme-option").forEach(x=>x.classList.toggle("active",x.dataset.theme===selected));}
function bindTheme(){document.querySelectorAll(".theme-option").forEach(b=>b.onclick=()=>applyTheme(b.dataset.theme));}
function themeOptionMarkup(name,label,note){return `<button class="theme-option" data-theme="${name}"><div class="theme-preview ${name}"></div><strong>${label}</strong><small>${note}</small></button>`;}
function themePanel(){return `<div class="theme-panel"><div class="theme-head"><strong>SELECT THEME</strong><span>APPEARANCE</span></div><div class="theme-options">${["dark","light","aurora","sunset","ice","forest","violet"].map(name=>themeOptionMarkup(name,THEME_PRESETS[name].label,THEME_PRESETS[name].note)).join("")}</div><div class="menu-note">YOUR THEME IS SAVED ON THIS DEVICE. YOU CAN CHANGE IT LATER IN SETTINGS.</div></div>`}
const toast=x=>{toastEl.textContent=x;toastEl.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>toastEl.classList.remove("show"),1800)};const esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));const fmt=ms=>(ms/1000).toFixed(2);function v(x){app.innerHTML=`<section class="view">${x}</section>`}function randomInt(max){return Math.floor(Math.random()*max)}
function ownScramble(){
  const size=puzzleSizeFromCode(s.puzzle);
  const faces=MOVES[333];
  const suffix=["","'","2"];
  const count=size===2?11:size===3?25:size===4?28:size===5?32:size===6?36:40;
  const out=[];
  let lastAxis="";
  let lastFace="";
  while(out.length<count){
    const face=faces[randomInt(faces.length)];
    const axis=MOVE_AXIS[face];
    if(axis===lastAxis||face===lastFace)continue;
    out.push(face+suffix[randomInt(suffix.length)]);
    lastAxis=axis;lastFace=face;
  }
  return out.join(" ");
}
function normalizeWcaScramble(scramble){return String(scramble).replace(/\s+/g," ").trim()}
function validCubeScramble(text){
  const tokens=normalizeWcaScramble(text).split(/\s+/).filter(Boolean);
  if(!tokens.length)return false;
  const size=puzzleSizeFromCode(s.puzzle);
  const max=size===2?30:size===3?40:size===4?55:size===5?65:size===6?75:85;
  return tokens.length<=max&&tokens.every(t=>/^[RLUDFB](2|')?$/.test(t));
}
function randomScramble(){
  let text=ownScramble();
  let guard=0;
  const size=puzzleSizeFromCode(s.puzzle);
  while((!validCubeScramble(text)||!auditCubeEngine(size,text))&&guard++<20)text=ownScramble();
  return text;
}
async function scr(){s.scramble=randomScramble();return s.scramble}

function stickerTransform(normal,d){
  const [x,y,z]=normal;
  if(x===1)return `rotateY(90deg) translateZ(${d}px)`;
  if(x===-1)return `rotateY(-90deg) translateZ(${d}px)`;
  if(y===1)return `rotateX(90deg) translateZ(${d}px)`;
  if(y===-1)return `rotateX(-90deg) translateZ(${d}px)`;
  if(z===1)return `translateZ(${d}px)`;
  return `rotateY(180deg) translateZ(${d}px)`;
}

function makeCubePiece(cubie,size,half,stickers,pieceStyle){
  const piece=document.createElement("div");
  piece.className="cubelet";
  piece.style.cssText=pieceStyle;
  const faces=[
    {normal:[1,0,0],transform:"rotateY(90deg)"},{normal:[-1,0,0],transform:"rotateY(-90deg)"},
    {normal:[0,1,0],transform:"rotateX(90deg)"},{normal:[0,-1,0],transform:"rotateX(-90deg)"},
    {normal:[0,0,1],transform:"translateZ(0)"},{normal:[0,0,-1],transform:"rotateY(180deg)"}
  ];
  for(const f of faces){
    const faceEl=document.createElement("div");
    faceEl.style.cssText=`position:absolute;inset:0;width:${cubie}px;height:${cubie}px;box-sizing:border-box;background:#111;border:1px solid #050505;border-radius:${Math.max(3,cubie*.045)}px;backface-visibility:hidden;transform:${f.transform} translateZ(${half}px);`;
    const color=stickers.get(f.normal.join(","));
    if(color) faceEl.style.background=COLOR_HEX[color];
    if(color){
      const inset=size===2?Math.max(6,cubie*.075):Math.max(5,cubie*.085);
      const sticker=document.createElement("div");
      sticker.className=`cube-sticker cube-sticker-${color}`;
      sticker.dataset.color=color;
      sticker.style.cssText=`position:absolute;left:${inset}px;top:${inset}px;width:${cubie-inset*2}px;height:${cubie-inset*2}px;box-sizing:border-box;background:${COLOR_HEX[color]} !important;border:2px solid rgba(0,0,0,.32);border-radius:${Math.max(3,cubie*.05)}px;box-shadow:inset 2px 2px 4px rgba(255,255,255,.2),inset -3px -3px 5px rgba(0,0,0,.26),0 1px 2px rgba(0,0,0,.55);transform:translateZ(2px);backface-visibility:visible;`;
      faceEl.appendChild(sticker);
    }
    piece.appendChild(faceEl);
  }
  return piece;
}
function render222Cube(root,state=buildCubeState(2,s.scramble)){
  const size=2;
  const cubie=82,gap=4,pitch=cubie+gap,half=cubie/2;
  root.innerHTML="";
  root.style.cssText=`position:relative;width:100%;height:100%;min-height:420px;display:grid;place-items:center;perspective:1250px;overflow:hidden;touch-action:none;user-select:none;`;
  const model=document.createElement("div");model.className="cube-model cube-model-222";
  model.style.cssText=`position:relative;width:0;height:0;transform-style:preserve-3d;transform:rotateX(-18deg) rotateY(0deg);will-change:transform;`;
  root.appendChild(model);
  for(const c of state){
    const stickers=new Map(c.stickers.map(st=>[st.normal.join(","),st.color]));
    const piece=makeCubePiece(c,size,half,stickers,`position:absolute;left:${-half}px;top:${-half}px;width:${cubie}px;height:${cubie}px;transform-style:preserve-3d;transform:translate3d(${c.p[0]*(pitch/2)}px,${-c.p[1]*(pitch/2)}px,${c.p[2]*(pitch/2)}px);background:#111;border:2px solid #030303;border-radius:9px;box-shadow:inset 0 0 0 1px #383838,inset 0 -7px 12px #000b,0 5px 10px #0009;`);
    model.appendChild(piece);
  }
  bindCubeDrag(root,model,-18,0);
}
function render333Cube(root,state=buildCubeState(3,s.scramble)){
  const size=3;
  const cubie=54,gap=3,pitch=cubie+gap,half=cubie/2;
  root.innerHTML="";
  root.style.cssText=`position:relative;width:100%;height:100%;min-height:420px;display:grid;place-items:center;perspective:1250px;overflow:hidden;touch-action:none;user-select:none;`;
  const model=document.createElement("div");model.className="cube-model cube-model-333";
  model.style.cssText=`position:relative;width:0;height:0;transform-style:preserve-3d;transform:rotateX(-18deg) rotateY(0deg);will-change:transform;`;
  root.appendChild(model);
  for(const c of state){
    const stickers=new Map(c.stickers.map(st=>[st.normal.join(","),st.color]));
    const piece=makeCubePiece(c,size,half,stickers,`position:absolute;left:${-half}px;top:${-half}px;width:${cubie}px;height:${cubie}px;transform-style:preserve-3d;transform:translate3d(${c.p[0]*pitch}px,${-c.p[1]*pitch}px,${c.p[2]*pitch}px);background:#111;border:2px solid #030303;border-radius:7px;box-shadow:inset 0 0 0 1px #383838,inset 0 -5px 9px #000b,0 4px 8px #0008;`);
    model.appendChild(piece);
  }
  bindCubeDrag(root,model,-18,0);
}
function bindCubeDrag(root,model,rx0,ry0){
  let dragging=false,sx=0,sy=0,rx=rx0,ry=ry0;
  root.style.cursor="grab";
  root.onpointerdown=e=>{dragging=true;sx=e.clientX;sy=e.clientY;root.setPointerCapture?.(e.pointerId);root.style.cursor="grabbing"};
  root.onpointermove=e=>{if(!dragging)return;const dx=e.clientX-sx,dy=e.clientY-sy;model.style.transform=`rotateX(${rx-dy*.3}deg) rotateY(${ry+dx*.3}deg)`};
  const end=e=>{if(!dragging)return;dragging=false;root.style.cursor="grab";if(e?.pointerId!=null)try{root.releasePointerCapture(e.pointerId)}catch{}};
  root.onpointerup=end;root.onpointercancel=end;
}
function renderCube(root=document.querySelector("#cube3d"),state=buildCubeState(puzzleSizeFromCode(s.puzzle),s.scramble)){
  if(!root)return;
  const size=puzzleSizeFromCode(s.puzzle);
  if(size===2)render222Cube(root,state);else if(size===3)render333Cube(root,state);else renderGenericCube(root,size,state);
  return root.querySelector(size===2?".cube-model-222":size===3?".cube-model-333":`.cube-model-${size}x${size}`);
}

function renderGenericCube(root,size,state=buildCubeState(size,s.scramble)){
  const cubie=Math.max(18,Math.floor(250/size));
  const gap=Math.max(2,Math.floor(cubie*.08));
  const pitch=cubie+gap;
  const half=cubie/2;
  const spread=pitch*(size-1)/2;
  root.innerHTML="";
  root.style.cssText=`position:relative;width:100%;height:100%;min-height:${Math.max(380,72*size)}px;display:grid;place-items:center;perspective:1250px;overflow:hidden;touch-action:none;user-select:none;`;
  const model=document.createElement("div");model.className=`cube-model cube-model-${size}x${size}`;
  model.style.cssText=`position:relative;width:0;height:0;transform-style:preserve-3d;transform:rotateX(-18deg) rotateY(0deg);will-change:transform;`;
  root.appendChild(model);
  for(const c of state){
    const stickers=new Map(c.stickers.map(st=>[st.normal.join(","),st.color]));
    const piece=makeCubePiece(c,size,half,stickers,`position:absolute;left:${-half}px;top:${-half}px;width:${cubie}px;height:${cubie}px;transform-style:preserve-3d;transform:translate3d(${c.p[0]*spread}px,${-c.p[1]*spread}px,${c.p[2]*spread}px);background:#111;border:2px solid #030303;border-radius:${Math.max(5,9-size)}px;box-shadow:inset 0 0 0 1px #383838,inset 0 -5px 9px #000b,0 4px 8px #0008;`);
    model.appendChild(piece);
  }
  bindCubeDrag(root,model,-18,0);
}

function cubeMoveDuration(){const size=puzzleSizeFromCode(s.puzzle);const base=size===2?260:size===3?220:size<=5?200:180;const speed=Math.max(.05,Math.min(2,Number(settings.scrambleSpeed)||1));return Math.round(base/speed)}
function cubeMoveAngle(token, quarterSignOverride=null){
  const face=token[0];
  const axis=MOVE_AXIS[face];
  const sign=MOVE_SIGN[face]*(token.includes("'")?-1:1);
  const quarter=quarterSignOverride==null?sign:quarterSignOverride;
  // CubeClash state coordinates use +Y as up, while CSS 3D uses +Y down.
  // X/Z CSS rotations therefore need their visual direction inverted so the
  // animation performs the same physical turn as applyMove().
  const cssQuarter=(axis==="x"||axis==="z")?-quarter:quarter;
  return {axis,angle:cssQuarter*90};
}
function cubePosition(c,size){
  const cubie=size===2?82:size===3?54:Math.max(18,Math.floor(250/size));
  const gap=size===2?4:size===3?3:Math.max(2,Math.floor(cubie*.08));
  const pitch=cubie+gap;
  const spread=pitch*(size-1)/2;
  return [c.p[0]*spread,-c.p[1]*spread,c.p[2]*spread];
}
function tokenQuarterMoves(token){
  const face=token[0];
  const direction=token.includes("'")?-1:1;
  const count=token.endsWith("2")?2:1;
  return Array.from({length:count},()=>({face,direction}));
}
function quarterToken(face,direction){
  if(direction===1)return face;
  return `${face}'`;
}
function applyQuarterToTokens(tokens,index,face,direction,quarterIndex){
  const before=tokens.slice(0,index).join(" ");
  const extra=Array.from({length:quarterIndex},()=>quarterToken(face,direction)).join(" ");
  return [before,extra].filter(Boolean).join(" ");
}
function animateOwnScramble(){
  const root=document.querySelector("#cube3d");
  if(!root)return;
  const size=puzzleSizeFromCode(s.puzzle);
  const tokens=s.scramble.trim().split(/\s+/).filter(Boolean);
  const runId=(s.scrambleRunId||0)+1;
  s.scrambleRunId=runId;
  const moveLabel=document.querySelector("#scrambleMoveLabel");
  const replay=document.querySelector("#replayScramble");
  const play=async()=>{
    if(runId!==s.scrambleRunId)return;
    renderCube(root,buildSolvedCubeState(size));
    if(moveLabel)moveLabel.textContent="START / SOLVED";
    if(replay)replay.disabled=true;
    await new Promise(r=>setTimeout(r,220));
    for(let i=0;i<tokens.length;i++){
      if(runId!==s.scrambleRunId)return;
      const token=tokens[i];
      const quarters=token.endsWith("2")?2:1;
      const direction=token.includes("'")?-1:1;
      for(let q=0;q<quarters;q++){
        if(runId!==s.scrambleRunId)return;
        const single=direction===1?token[0]:`${token[0]}'`;
        const completedTokens=tokens.slice(0,i);
        const beforeTokens=[...completedTokens,...Array.from({length:q},()=>single)];
        const afterTokens=[...completedTokens,...Array.from({length:q+1},()=>single)];
        const before=buildCubeState(size,beforeTokens.join(" "));
        const after=buildCubeState(size,afterTokens.join(" "));
        const axis=MOVE_AXIS[token[0]],layer=MOVE_LAYER[token[0]],idx=axis==="x"?0:axis==="y"?1:2;
        const rootModel=renderCube(root,before);
        if(!rootModel)return;
        const turnGroup=document.createElement("div");
        turnGroup.className="cube-turn-group";
        turnGroup.style.cssText="position:absolute;left:0;top:0;width:0;height:0;transform-style:preserve-3d;will-change:transform;";
        rootModel.appendChild(turnGroup);
        const pieces=[...rootModel.children].filter(el=>el!==turnGroup);
        pieces.forEach((piece,index)=>{
          const cubie=before[index];
          if(!cubie||cubie.p[idx]!==layer)return;
          const pos=cubePosition(cubie,size);
          piece.style.transform=`translate3d(${pos[0]}px,${pos[1]}px,${pos[2]}px)`;
          turnGroup.appendChild(piece);
        });
        if(moveLabel)moveLabel.textContent=`MOVE ${i+1} / ${tokens.length} · ${token}${quarters===2?` · TURN ${q+1}/2`:""}`;
        const angle=cubeMoveAngle(token,direction).angle;
        const duration=cubeMoveDuration();
        await new Promise(resolve=>{
          requestAnimationFrame(()=>{
            turnGroup.style.transition=`transform ${duration}ms cubic-bezier(.2,.7,.2,1)`;
            turnGroup.style.transform=`rotate${axis.toUpperCase()}(${angle}deg)`;
            setTimeout(resolve,duration+70);
          });
        });
        if(runId!==s.scrambleRunId)return;
        renderCube(root,after);
        await new Promise(r=>setTimeout(r,100));
      }
    }
    if(runId===s.scrambleRunId){
      if(moveLabel)moveLabel.textContent="SCRAMBLE READY · FOLLOW THE MOVES ABOVE";
      if(replay)replay.disabled=false;
    }
  };
  s.replayScramble=()=>{s.scrambleRunId=(s.scrambleRunId||0)+1;animateOwnScramble()};
  play();
}
function renderMenuHeroCube(root=document.querySelector("#menuHeroCube")){
  if(!root)return;
  render333Cube(root,buildSolvedCubeState(3));
}
let menuHeroLoop=0;
function stopMenuHeroCube(){menuHeroLoop++;}
async function animateMenuHeroCube(root=document.querySelector("#menuHeroCube")){
  if(!root)return;
  const loopId=++menuHeroLoop;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const scrambleMoves=()=>{
    const faces=["R","L","U","D","F","B"];
    const suffix=["","'","2"];
    const out=[];
    let lastAxis="";
    let lastFace="";
    while(out.length<9){
      const face=faces[randomInt(faces.length)];
      const axis=MOVE_AXIS[face];
      if(axis===lastAxis||face===lastFace)continue;
      out.push(face+suffix[randomInt(suffix.length)]);
      lastAxis=axis;
      lastFace=face;
    }
    return out;
  };
  const inverseMove=token=>token.endsWith("2")?token:token.endsWith("'")?token.slice(0,-1):`${token}'`;
  while(loopId===menuHeroLoop){
    const scramble=scrambleMoves();
    const solve=scramble.slice().reverse().map(inverseMove);
    for(let i=0;i<=scramble.length;i++){
      if(loopId!==menuHeroLoop)return;
      render333Cube(root,buildCubeState(3,scramble.slice(0,i).join(" ")));
      await pause(i===0?140:155);
    }
    await pause(220);
    for(let i=0;i<=solve.length;i++){
      if(loopId!==menuHeroLoop)return;
      render333Cube(root,buildCubeState(3,[...scramble,...solve.slice(0,i)].join(" ")));
      await pause(i===0?120:150);
    }
    await pause(280);
  }
}
function cubeStateKey(c){return `${c.p.join(",")}:${c.stickers.map(x=>x.normal.join(",")+x.color).sort().join("|")}`}

async function mountCube(){
  const h=document.querySelector("#cube3d");
  if(!h)return;
  renderCube(h,buildSolvedCubeState(puzzleSizeFromCode(s.puzzle)));
  animateOwnScramble();
}

function adjustedSolveMs(x){
  if(!x||x.penalty==="DNF"||x.display==="DNF")return Infinity;
  const base=Number(x.timeMs)||0;
  return base+(x.penalty==="+2"?2000:0);
}
function rollingAverage(solves,n){
  if(solves.length<n)return "—";
  const window=solves.slice(0,n).map(adjustedSolveMs);
  const dnf=window.filter(x=>!Number.isFinite(x)).length;
  if(dnf>=2)return "DNF";
  const finite=window.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!finite.length)return "DNF";
  const values=finite.slice(1,Math.max(1,finite.length-1));
  if(!values.length)return "DNF";
  return fmt(values.reduce((a,b)=>a+b,0)/values.length);
}
function bestSolve(solves){
  const values=solves.map(adjustedSolveMs).filter(Number.isFinite);
  return values.length?fmt(Math.min(...values)):"—";
}
function buildTimeGraph(solves){
  const values=solves.slice(0,50).map(adjustedSolveMs).reverse().filter(Number.isFinite);
  if(!values.length)return '<div class="graph-empty">NO TIMED SOLVES YET</div>';
  const w=760,h=230,pad=28,min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min);
  const points=values.map((v,i)=>{const x=pad+(values.length===1?(w-pad*2)/2:i*(w-pad*2)/(values.length-1));const y=h-pad-((v-min)/span)*(h-pad*2);return [x,y,v]});
  const line=points.map(x=>x[0].toFixed(1)+","+x[1].toFixed(1)).join(" ");
  const dots=points.map(x=>`<circle cx="${x[0].toFixed(1)}" cy="${x[1].toFixed(1)}" r="3"><title>${fmt(x[2])}</title></circle>`).join("");
  return `<div class="time-graph-wrap"><svg class="time-graph" viewBox="0 0 ${w} ${h}" role="img" aria-label="Solve time graph"><line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" class="graph-axis"/><line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" class="graph-axis"/><polyline points="${line}" class="graph-line" fill="none"/>${dots}<text x="${pad}" y="16" class="graph-label">${fmt(max)}</text><text x="${pad}" y="${h-6}" class="graph-label">${fmt(min)}</text><text x="${w-pad}" y="${h-6}" text-anchor="end" class="graph-label">LAST ${values.length}</text></svg></div>`;
}
function withTimeout(promise,ms,fallback){
  return Promise.race([Promise.resolve(promise),new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
}
function soloStatsMarkup(a=[]){
  const averages=[5,12,50,100,1000];
  const label=puzzleLabel(s.puzzle);
  return `<div class="stats-panel"><div class="stats-section-head"><div><div class="stats-kicker">CURRENT PUZZLE</div><h2>${label} STATISTICS</h2></div><span class="stats-note">${s.blindMode?"BLIND MODE":"LATEST SOLVES FIRST"}</span></div><div class="stats-grid stats-grid-wide"><div class="stat-box"><small>SOLVES</small><strong>${a.length}</strong></div><div class="stat-box"><small>BEST</small><strong>${bestSolve(a)}</strong></div>${s.blindMode?`<div class="stat-box"><small>BLIND PB</small><strong>${blindRecord.best!=null?fmt(blindRecord.best):"—"}</strong></div><div class="stat-box"><small>BLIND RUNS</small><strong>${blindRecord.solves||0}</strong></div>`:""}${averages.map(n=>`<div class="stat-box"><small>AO${n}</small><strong>${rollingAverage(a,n)}</strong></div>`).join("")}</div><div class="graph-panel"><div class="graph-head"><div><div class="stats-kicker">TIME TREND</div><h3>LAST 50 SOLVES</h3></div><span class="stats-note">+2 INCLUDED · DNF EXCLUDED</span></div>${buildTimeGraph(a)}</div><div class="solves-list"><div class="solve-list-head"><span>RECENT SOLVES</span><span>${a.length} TOTAL</span></div>${a.slice(0,12).map((x,i)=>`<div class="solve-row"><span>${a.length-i}</span><span class="solve-scramble">${esc(x.scramble)}</span><span class="solve-time">${esc(x.display)}</span><span class="muted solve-puzzle">${puzzleLabel(x.puzzle)}</span><button class="delete-solve-btn" data-delete-solve="${esc(x.id)}" title="Delete this solve" aria-label="Delete solve">DELETE</button></div>`).join("")||'<div class="empty">NO SOLVES YET</div>'}</div></div>`;
}
function cube(){
  const speed=Math.max(.05,Math.min(2,Number(settings.scrambleSpeed)||1));
  return `<div class="cube-player-wrap">
    <div class="cube-follow-head"><span>FOLLOW THE SCRAMBLE</span><span>WHITE TOP · GREEN FRONT</span></div>
    <div id="cube3d" aria-label="Animated Rubik's cube scramble"></div>
    <div id="scrambleMoveLabel" class="cube-move-label">PREPARING SCRAMBLE</div>
    <div class="scramble-speed">
      <div class="scramble-speed-head"><span>SCRAMBLE SPEED</span><strong id="scrambleSpeedValue">${speed.toFixed(2)}×</strong></div>
      <input id="scrambleSpeed" type="range" min="0.05" max="2" step="0.05" value="${speed}">
      <div class="scramble-speed-scale"><span>0.05× NEWBIE</span><span>1.00× NORMAL</span><span>2.00× FAST</span></div>
    </div>
    <div class="cube-follow-foot"><span>WATCH EACH TURN</span><button class="ghost-btn" id="replayScramble" disabled>REPLAY SCRAMBLE</button></div>
  </div>`;
}

function renderSoloView(a=[]){
  const label=puzzleLabel(s.puzzle);
  const solveVisual=s.blindMode&&s.phase==="solving"?`<div class="blind-panel"><div class="blind-head">BLIND SOLVE IN PROGRESS</div><p>Scramble hidden. Focus on recall and execution.</p><div class="blind-records"><div><span>BLIND PB</span><strong>${blindRecord.best!=null?fmt(blindRecord.best):"—"}</strong></div><div><span>BLIND RUNS</span><strong>${blindRecord.solves||0}</strong></div></div></div>`:cube();
  v(`<div class="timer-page"><div class="timer-top"><div class="section-title" style="flex:1;margin:0"><h1>${label} SOLO TIMER</h1><small>${s.solveFolder?esc(solveFolderSummary(s.solveFolder)):"LOCAL SESSION"}</small></div><div class="room-actions"><select id="p">${puzzleOptionsMarkup(s.puzzle)}</select><button class="ghost-btn" id="new">NEW SCRAMBLE</button><button class="ghost-btn" id="switchFolder">SESSION FOLDER</button><button class="ghost-btn" data-view="home">BACK</button></div></div><div class="scramble-bar"><div class="scramble-text">${s.blindMode&&s.phase==="solving"?"BLIND MODE ACTIVE":esc(s.scramble)}</div><button class="ghost-btn" id="copy">COPY</button></div><div class="timer-layout"><div class="timer-panel"><div class="timer-zone" id="zone" role="button" tabindex="0" aria-label="Solo timer"><div class="timer-status"><div class="timer-value" id="tv">${s.last?.display||"0.00"}</div><div class="timer-label" id="tl">READY</div><div class="timer-hint">SPACE: INSPECTION · HOLD TO START · PRESS TO FINISH${s.blindMode?" · BLIND MODE":s.oneHandMode?" · ONE-HAND MODE":""}</div></div></div><div class="timer-panel-footer"><div class="metric"><small>PUZZLE</small><strong>${label}</strong></div><div class="metric"><small>INSPECTION</small><strong>${settings.inspection}s</strong></div><div class="metric"><small>MODE</small><strong>${s.blindMode?"BLIND":s.oneHandMode?"ONE-HAND":"NORMAL"}</strong></div><div class="metric"><small>LAST</small><strong>${s.last?.display||"—"}</strong></div></div><div class="timer-inline-actions"><button class="primary-btn" id="timerAction">START / STOP</button></div></div><div class="cube-panel"><div class="cube-head"><span>SCRAMBLE VISUALIZATION</span><span>${s.blindMode?"BLIND":s.oneHandMode?"ONE-HAND":"3D"}</span></div>${solveVisual}</div></div><div id="soloStats">${soloStatsMarkup(a)}</div></div>`);
}
function folderSetupView(){
  const current=normalizeSolveFolder(currentSolveFolder()||defaultSolveFolder());
  const list=solveFolders.length?solveFolders.slice(0,8):[current];
  v(`<div class="folder-screen"><div class="folder-card"><div class="folder-kicker">SESSION SETUP / SOLVE FOLDER</div><h1 class="folder-title">NAME THE FOLDER</h1><p class="folder-copy">Pick the cube size and mode before you start. This keeps solo sessions organized and lets blind solves track their own record.</p><div class="folder-form"><div class="field"><label>FOLDER NAME</label><input id="folderName" maxlength="32" value="${esc(current.name)}" placeholder="e.g. MARCH TRAINING"></div><div class="field"><label>PUZZLE SIZE</label><select id="folderPuzzle">${puzzleOptionsMarkup(current.puzzle)}</select></div><div class="field"><label>MODE</label><select id="folderMode"><option value="normal" ${current.mode==="normal"?"selected":""}>NORMAL</option><option value="blind" ${current.mode==="blind"?"selected":""}>BLIND</option><option value="onehand" ${current.mode==="onehand"?"selected":""}>ONE-HAND</option></select></div><div class="field"><label>INSPECTION SECONDS</label><input id="folderInspection" type="range" min="0" max="30" step="1" value="${current.inspection}"><div class="scramble-speed-scale"><span>0</span><strong id="folderInspectionValue">${current.inspection}s</strong><span>30</span></div></div></div><div class="folder-actions"><button class="primary-btn" id="folderContinue">OPEN FOLDER</button><button class="ghost-btn" id="folderCancel">BACK</button></div></div><div class="folder-list-card"><div class="folder-list-head"><strong>RECENT FOLDERS</strong><span>${list.length}</span></div><div class="folder-list">${list.map(folder=>`<button class="folder-item" data-folder-id="${folder.id}"><span>${esc(folder.name)}</span><small>${puzzleLabel(folder.puzzle)} · ${folder.mode==="blind"?"BLIND":folder.mode==="onehand"?"ONE-HAND":"NORMAL"} · ${folder.inspection}s</small></button>`).join("")}</div><div class="folder-note">A folder is a local solve session. You can switch folders any time.</div></div></div>`);
  const name=document.querySelector("#folderName");
  const puzzle=document.querySelector("#folderPuzzle");
  const mode=document.querySelector("#folderMode");
  const inspection=document.querySelector("#folderInspection");
  const inspectionValue=document.querySelector("#folderInspectionValue");
  const syncLabel=()=>{if(inspectionValue)inspectionValue.textContent=`${inspection.value}s`;};
  const currentData=()=>normalizeSolveFolder({id:current.id,name:name.value,puzzle:puzzle.value,mode:mode.value,inspection:inspection.value,createdAt:current.createdAt});
  inspection?.addEventListener("input",syncLabel);
  document.querySelectorAll("[data-folder-id]").forEach(btn=>btn.addEventListener("click",()=>{
    const folder=solveFolders.find(x=>x.id===btn.dataset.folderId);
    if(!folder)return;
    name.value=folder.name;
    puzzle.value=folder.puzzle;
    mode.value=folder.mode;
    inspection.value=String(folder.inspection);
    syncLabel();
  }));
  document.querySelector("#folderCancel").onclick=()=>home();
  document.querySelector("#folderContinue").onclick=async()=>{
    const folder=upsertSolveFolder(currentData());
    applySolveFolder(folder);
    await scr();
    await solo();
  };
}
async function refreshSoloHistory(){
  try{
    const all=await withTimeout(getSolves(),900,[]);
    if(!Array.isArray(all))return;
    const a=all.filter(x=>x.puzzle===s.puzzle);
    const holder=document.querySelector("#soloStats");
    if(holder){
      holder.innerHTML=soloStatsMarkup(a);
      bindSolveDeleteButtons(holder,{deleteSolve,getSolves,toast,solo,s,confirmFn:(message)=>confirm(message)});
    }
  }catch(err){console.error("CubeClash history load failed",err)}
}
async function solo(){
  try{
    const folder=currentSolveFolder()||defaultSolveFolder();
    if(!loadActiveSolveFolder()&&!s.solveFolder){folderSetupView();return}
    applySolveFolder(folder);
    if(!s.scramble)s.scramble=randomScramble();
    renderSoloView([]);
    bindSolo();
    refreshSoloHistory();
  }catch(err){
    console.error("CubeClash solo view failed",err);
    v(`<div class="empty"><strong>SOLO TIMER COULD NOT OPEN</strong><br><br><button class="primary-btn" data-view="solo">TRY AGAIN</button></div>`);
  }
}
function set(ms,label){const tv=document.querySelector("#tv"),tl=document.querySelector("#tl");if(tv)tv.textContent=fmt(ms);if(tl)tl.textContent=label}
function stop(){cancelAnimationFrame(s.raf);s.raf=0}
function loop(){cancelAnimationFrame(s.raf);const tick=()=>{const n=performance.now();if(s.phase==="inspection"){set(Math.max(0,settings.inspection*1000-(n-s.inspectionStart)),"INSPECTION");}else if(s.phase==="solving"){set(n-s.solveStart,"SOLVING");}else{return;}s.raf=requestAnimationFrame(tick)};tick()}
function startInspection(){
  stop();
  s.phase="inspection";
  s.penalty="";
  s.inspectionStart=performance.now();
  set(settings.inspection*1000,"INSPECTION");
  playSound("start");
  loop();
}
function startSolve(){
  if(s.phase!=="inspection")return;
  const elapsed=performance.now()-s.inspectionStart;
  s.penalty=elapsed>=17000?"DNF":elapsed>=15000?"+2":"";
  s.phase="solving";
  s.solveStart=performance.now();
  set(0,"SOLVING");
  playSound("solve");
  if(s.blindMode){
    const scrambleText=document.querySelector(".scramble-text");
    const cubePanel=document.querySelector(".cube-panel");
    if(scrambleText)scrambleText.textContent="BLIND MODE ACTIVE";
    if(cubePanel)cubePanel.innerHTML=`<div class="blind-panel"><div class="blind-head">BLIND SOLVE IN PROGRESS</div><p>Scramble hidden. Execute from memory.</p><div class="blind-records"><div><span>BLIND PB</span><strong>${blindRecord.best!=null?fmt(blindRecord.best):"—"}</strong></div><div><span>BLIND RUNS</span><strong>${blindRecord.solves||0}</strong></div></div></div>`;
  }
}
async function finish(){
  if(s.phase!=="solving")return;
  const ms=performance.now()-s.solveStart;
  // Ignore accidental same-frame/double-event finishes such as 0.003s.
  if(ms<100){set(ms,"SOLVING");return;}
  stop();
  s.phase="stopped";
  const display=s.penalty==="DNF"?"DNF":fmt(ms+(s.penalty==="+2"?2000:0));
  s.last={display};
  playSound("complete");
  if(s.blindMode&&Number.isFinite(ms)){
    blindRecord.solves=(blindRecord.solves||0)+1;
    if(blindRecord.best==null||ms<blindRecord.best)blindRecord.best=ms;
    saveBlindRecord(blindRecord);
  }
  try{
    await addSolve({id:crypto.randomUUID(),createdAt:Date.now(),puzzle:s.puzzle,scramble:s.scramble,timeMs:ms,penalty:s.penalty,display});
    toast(display);
  }catch(err){
    console.error("CubeClash save solve failed",err);
    toast("SOLVE SAVE FAILED");
  }
  setTimeout(async()=>{s.phase="ready";await scr();solo()},300);
}
function bindSolo(){
  mountCube();
  const runTimerToggle=()=>{
    if(s.phase==="ready"||s.phase==="stopped"){startInspection();return;}
    if(s.phase==="inspection"){beginHold();return;}
    if(s.phase==="solving"){finish();return;}
  };
  document.querySelector("#new").onclick=async()=>{stop();s.replayScramble=null;s.phase="ready";await scr();solo()};
  document.querySelector("#switchFolder").onclick=()=>folderSetupView();
  document.querySelector("#p").onchange=async e=>{const base=currentSolveFolder()||defaultSolveFolder();const folder=upsertSolveFolder({...base,puzzle:e.target.value});applySolveFolder(folder);stop();s.replayScramble=null;s.phase="ready";await scr();solo()};
  document.querySelector("#timerAction")?.addEventListener("click",runTimerToggle);
  document.querySelector("#replayScramble")?.addEventListener("click",()=>{
    if(s.replayScramble) s.replayScramble();
  });
  const speedRange=document.querySelector("#scrambleSpeed");
  const speedValue=document.querySelector("#scrambleSpeedValue");
  speedRange?.addEventListener("input",()=>{
    const value=Math.max(.05,Math.min(2,Number(speedRange.value)||1));
    settings.scrambleSpeed=value;
    if(speedValue)speedValue.textContent=`${value.toFixed(2)}×`;
    localStorage.setItem("cubeclash-settings",JSON.stringify(settings));
  });
  document.querySelector("#copy").onclick=()=>navigator.clipboard?.writeText(s.scramble).then(()=>toast("SCRAMBLE COPIED"));
  bindSolveDeleteButtons(document,{deleteSolve,getSolves,toast,solo,s,confirmFn:(message)=>confirm(message)});
  let held=false,holdFired=false,timer=0;
  const canUseKeyboard=()=>{
    const ae=document.activeElement;
    return !(ae && (ae.tagName==="INPUT"||ae.tagName==="SELECT"||ae.tagName==="TEXTAREA"||ae.isContentEditable));
  };
  const beginHold=()=>{
    if(s.phase!=="inspection"||held)return;
    held=true;holdFired=false;clearTimeout(timer);
    set(Math.max(0,settings.inspection*1000-(performance.now()-s.inspectionStart)),"HOLD SPACE / ENTER");
    timer=setTimeout(()=>{
      if(s.phase==="inspection"&&held){
        holdFired=true;
        startSolve();
      }
    },650);
  };
  const releaseHold=()=>{
    clearTimeout(timer);timer=0;
    const started=holdFired;
    held=false;holdFired=false;
    // A completed long press has already entered SOLVING. Releasing must NOT stop it.
    if(!started&&s.phase==="inspection")toast("HOLD SPACE TO START SOLVE");
  };
  const zone=document.querySelector("#zone");
  zone.onpointerdown=e=>{
    e.preventDefault();
    if(s.phase==="ready"||s.phase==="stopped"){startInspection();return;}
    if(s.phase==="inspection")beginHold();
    else if(s.phase==="solving")finish();
  };
  zone.onpointerup=e=>{
    e.preventDefault();
    if(s.phase==="inspection")releaseHold();
  };
  zone.onpointercancel=()=>{if(s.phase==="inspection")releaseHold();};
  const keyDown=e=>{
    if(e.code!=="Space"&&e.code!=="Enter")return;
    if(!canUseKeyboard())return;
    e.preventDefault();
    if(e.repeat)return;
    if(s.phase==="ready"||s.phase==="stopped"){startInspection();return;}
    if(s.phase==="inspection"){beginHold();return;}
    if(s.phase==="solving"){finish();return;}
  };
  const keyUp=e=>{
    if(e.code!=="Space"&&e.code!=="Enter")return;
    if(!canUseKeyboard())return;
    e.preventDefault();
    if(s.phase==="inspection")releaseHold();
    // When solving, keyup is intentionally ignored. The next keydown is the stop action.
  };
  document.addEventListener("keydown",keyDown,true);document.addEventListener("keyup",keyUp,true);
  window._cubeClashSoloKeyHandler=keyDown;window._cubeClashSoloKeyUpHandler=keyUp;
}
function tutorial(){v(`<div class="tutorial-screen"><div class="tutorial-card"><div class="tutorial-kicker">FIRST TIME SETUP / 01</div><h1 class="tutorial-title">HOW CUBECLASH WORKS</h1><p class="tutorial-intro">A quick guide before you start. You can reopen this tutorial later from the menu.</p><div class="tutorial-steps"><article><span>01</span><h2>CHOOSE A PUZZLE</h2><p>Select 2×2 through 7×7. CubeClash generates a new internally generated scramble for every solve.</p></article><article><span>02</span><h2>READ THE SCRAMBLE</h2><p>The 3D cube shows the exact state produced by the scramble, so the visual matches the moves shown above it.</p></article><article><span>03</span><h2>INSPECTION</h2><p>Press Space, Enter, or tap the timer once to begin inspection. Under 15 seconds is normal, 15 to under 17 seconds is +2, and 17 seconds or more is DNF.</p></article><article><span>04</span><h2>SOLVE</h2><p>During inspection, hold Space or Enter and release after the hold indicator appears to start the solve. Press the key again to finish. Your result is saved on this device.</p></article><article><span>05</span><h2>1V1 ROOMS</h2><p>For beta, rooms use a browser-to-browser WebRTC connection. The host and guest exchange connection data to connect.</p></article><article><span>06</span><h2>YOUR DATA</h2><p>Solves and settings stay in your browser. Use JSON export if you want a backup or to move your timer data.</p></article></div><div class="tutorial-actions"><button class="primary-btn" id="tutorialStart">I UNDERSTAND — OPEN MENU</button></div></div></div>`);document.querySelector("#tutorialStart").onclick=()=>{localStorage.setItem("cubeclash-tutorial-seen","1");home()}}
function dashboard(){v(`<div class="hero"><div class="hero-grid"><div><div class="section-title"><small>01 / SPEEDCUBING PLATFORM</small><small>BETA</small></div><h1 class="hero-title cube-font">CUBE<span>CLASH</span></h1><p class="hero-copy">A smooth responsive speedcubing timer for 2×2 through 7×7 with an internal scramble engine, real 3D scramble visualization, local history, installable PWA support, and peer-to-peer 1v1 rooms.</p><div class="hero-actions"><button class="primary-btn" data-view="solo">SOLO TIMER</button><button class="ghost-btn" data-view="room">CREATE / JOIN 1V1</button></div></div><div class="technical-card"><div class="spec-list"><div class="spec"><span>PUZZLES</span><span>2×2 / 7×7</span></div><div class="spec"><span>SCRAMBLES</span><span>INTERNAL ENGINE</span></div><div class="spec"><span>SYNC</span><span>WEBRTC P2P</span></div><div class="spec"><span>STORAGE</span><span>INDEXEDDB</span></div><div class="spec"><span>INSTALL</span><span>PWA</span></div></div></div></div></div>`)}
function home(){const folder=currentSolveFolder()||defaultSolveFolder();const modeLabel=folder.mode==="blind"?"BLIND":folder.mode==="onehand"?"ONE-HAND":"NORMAL";v(`<div class="menu-screen menu-home"><div class="menu-home-frame"><div class="menu-home-logo"><span class="logo-mark">◈</span><div><strong>CUBECLASH</strong><small>${modeLabel} · ${puzzleLabel(folder.puzzle)}</small></div></div><div class="menu-home-cube-shell"><div class="menu-home-cube" id="menuHeroCube"></div><div class="menu-home-hint">DRAG TO ROTATE</div></div><div class="menu-home-actions"><button class="menu-action" data-view="solo"><span>SOLO TIMER</span><span class="arrow">→</span></button><button class="menu-action" data-view="room"><span>CREATE / JOIN 1V1</span><span class="arrow">→</span></button><button class="menu-action" data-view="settings"><span>SETTINGS</span><span class="arrow">→</span></button></div></div></div>`);applyTheme(currentTheme());bindTheme();requestAnimationFrame(()=>renderMenuHeroCube());}

function exposeMatchBridge(){
  window.CubeClashBridge={get state(){return {role:s.role,roomCode:s.roomCode||"",scramble:s.scramble||"",puzzle:s.puzzle||"333",match:s.match||null,opponent:s.opponent||{time:"0.00",status:"WAITING"},phase:s.matchPhase||"ready",theme:localStorage.getItem("cubeclash-theme")||"dark",name:settings.name||""}},get localStream(){return s.localStream||null},get remoteStream(){return s.remoteStream||null}};
}
exposeMatchBridge();
function room(){
  v(`<div class="room-page"><div class="section-title"><h1>1V1 ROOM</h1><small>LIVE WEBRTC / PEER-TO-PEER</small></div><div class="room-layout"><div class="room-card"><h2>CREATE ROOM</h2><p class="room-help">Choose the puzzle, number of rounds, inspection time, and penalties. Share the room code with Player 2.</p><div class="form-grid"><div class="field"><label>PUZZLE</label><select id="rp">${puzzleOptionsMarkup(s.puzzle)}</select></div><div class="field"><label>ROUNDS</label><select id="rr"><option>1</option><option>3</option><option selected>5</option><option>7</option></select></div><div class="field"><label>INSPECTION</label><select id="ri"><option>15</option><option>10</option><option>0</option></select></div><div class="field"><label>FORMAT</label><select id="rf"><option>FIRST TO</option><option>BEST OF</option></select></div></div><div class="checks"><label class="check"><input id="rp2" type="checkbox" checked> +2</label><label class="check"><input id="rdnf" type="checkbox" checked> DNF</label></div><button class="primary-btn" id="create">CREATE ROOM</button><div id="hostRoom" class="room-code-box" hidden></div></div><div class="room-card"><h2>JOIN ROOM</h2><p class="room-help">Enter the room code shown by Player 1. The match stays on this same page.</p><div class="field"><label>ROOM CODE</label><input id="roomCode" class="code-input" autocomplete="off" autocapitalize="characters" placeholder="e.g. CC7A9P2Q"></div><button class="primary-btn" id="join">JOIN ROOM</button></div></div><div id="rs" class="empty">NO ACTIVE ROOM</div></div>`);
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
    s.match={rounds:+document.querySelector("#rr").value,inspection:+document.querySelector("#ri").value,format:document.querySelector("#rf").value,allowPlus2:document.querySelector("#rp2").checked,allowDNF:document.querySelector("#rdnf").checked,round:1,score:[0,0],status:"WAITING",scramble:"",history:[]};
    s.matchHistory=[]; s.room=new P2PRoom("host"); wireRoom();
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
  s.room.on("state",async state=>{
    if(state==="connected"){
      if(s.role==="host"){
        if(!s.scramble)s.scramble=await randomScramble();
        try{s.room.send({type:"match-config",match:{...s.match,puzzle:s.puzzle,names:{host:settings.name||"PLAYER 1",guest:"PLAYER 2"}},scramble:s.scramble,history:s.matchHistory})}catch(e){console.error(e)}
      }else{
        try{s.room.send({type:"player-name",name:settings.name||"PLAYER 2"})}catch(e){console.error(e)}
      }
      setTimeout(()=>showCameraPermission(),120);
    }
    if(state==="camera-requested"&&s.localStream){try{s.room.answerWithMedia(s.localStream)}catch(e){console.error(e)}}
    if(state==="closed")showRoomStatus("PLAYER DISCONNECTED","The peer connection closed.","error");
    if(state==="signaling-disconnected")showRoomStatus("SIGNALING DISCONNECTED","The signaling service was lost. The current peer connection may continue.","error");
  }).on("message",async msg=>{
    if(!msg||typeof msg!=="object")return;
    if(msg.type==="match-config"&&s.role==="guest"){
      s.match=msg.match; s.matchHistory=Array.isArray(msg.history)?msg.history.slice().sort((a,b)=>a.round-b.round):[]; s.puzzle=msg.match.puzzle; s.scramble=msg.scramble||await randomScramble();
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
      if(msg.round===s.match?.round){s.remoteRoundResult=msg.display||"DNF";s.remotePenalty=msg.penalty||"";s.remoteRawMs=msg.rawMs||0;s.opponent.time=msg.display||s.opponent.time;s.opponent.result=msg.display||s.opponent.result;updateMatchUI();maybeResolveRound(true)}
    }
    if(msg.type==="round-result"){
      if(Array.isArray(msg.history))s.matchHistory=msg.history.slice().sort((a,b)=>a.round-b.round);
      else upsertMatchHistory({round:msg.round,p1:msg.p1,p2:msg.p2,final:msg.final});
      if(msg.round===s.match?.round)s.roundResult={round:msg.round,p1:msg.p1,p2:msg.p2,final:msg.final};
      updateMatchUI();
    }
    if(msg.type==="next-round-ready"){
      if(msg.round===s.match?.round){
        s.remoteNextRoundReady=true;
        if(s.match.round>=(s.match.rounds||1)&&s.nextRoundReady){
          s.match.status="FINISHED";
          try{s.room.send({type:"match-over",winner:s.roundResult?.winner||"DRAW",history:s.matchHistory})}catch{}
          requestAnimationFrame(()=>document.querySelector("#roundResultPanel")?.scrollIntoView({behavior:"smooth",block:"center"}));
        }
        updateMatchUI();
      }
    }
    if(msg.type==="next-round-request"){
      if(msg.round===s.match?.round && s.nextRoundReady && s.remoteNextRoundReady && s.match.round<(s.match.rounds||1))advanceRound();
    }
    if(msg.type==="next-round"){
      s.match.round=msg.round; s.match.score=msg.score||s.match.score; if(Array.isArray(msg.history))s.matchHistory=msg.history.slice().sort((a,b)=>a.round-b.round); s.scramble=msg.scramble||await randomScramble(); s.nextRoundReady=false;s.remoteNextRoundReady=false; resetMatchRound();
    }
    if(msg.type==="match-history"){
      if(Array.isArray(msg.history)){s.matchHistory=msg.history.slice().sort((a,b)=>a.round-b.round);updateMatchUI();}
    }
    if(msg.type==="match-over"){
      s.match.status="FINISHED"; s.match.winner=msg.winner||"DRAW";
      if(Array.isArray(msg.history))s.matchHistory=msg.history.slice().sort((a,b)=>a.round-b.round);
      updateMatchUI();
      requestAnimationFrame(()=>document.querySelector("#roundResultPanel")?.scrollIntoView({behavior:"smooth",block:"center"}));
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
  const size=puzzleSizeFromCode(s.puzzle);
  const state=buildCubeState(size,s.scramble||"");
  const by={U:[],D:[],F:[],B:[],R:[],L:[]};
  const normals={U:[0,1,0],D:[0,-1,0],F:[0,0,1],B:[0,0,-1],R:[1,0,0],L:[-1,0,0]};
  for(const c of state){
    for(const sticker of c.stickers){
      const normal=sticker.normal, color=sticker.color;
      for(const face of Object.keys(normals)){
        const n=normals[face];
        if(normal[0]===n[0]&&normal[1]===n[1]&&normal[2]===n[2]){by[face].push([c.p,normal,color]);break;}
      }
    }
  }
  const faces=["U","L","F","R","B","D"];
  root.dataset.puzzle=s.puzzle;
  root.innerHTML=faces.map(face=>`<div class="net-face net-${face}" style="--n:${size}" data-face="${face}" aria-label="${face} face">${faceletGrid(size,by[face],face)}</div>`).join("");
}
function renderMatch(preconnect=false){
  if(window._cubeClashMatchKeyHandler){document.removeEventListener("keydown",window._cubeClashMatchKeyHandler,true);document.removeEventListener("keyup",window._cubeClashMatchKeyHandler,true);window._cubeClashMatchKeyHandler=null;}
  const rounds=s.match?.rounds||1, round=s.match?.round||1, score=s.match?.score||[0,0];
  v(`<div class="match-page"><div class="match-head"><div><div class="section-title" style="margin:0"><h1>1V1 MATCH</h1><small>${s.role==="host"?(settings.name||"PLAYER 1")+" / HOST":(s.match?.names?.guest||"PLAYER 2")+" / GUEST"}</small></div></div><div class="match-meta"><span id="matchRound">ROUND ${round} / ${rounds}</span><span id="matchScore">${score[0]} — ${score[1]}</span><button class="ghost-btn" id="exitMatch">EXIT</button></div></div><div class="video-row"><div class="video-card"><div class="video-label">YOU</div><video id="localVideo" autoplay muted playsinline></video><div class="video-state" id="localCamState">${s.localStream?"CAMERA + MIC READY":"CAMERA + MIC WAITING"}</div></div><div class="video-card"><div class="video-label">OPPONENT</div><video id="remoteVideo" autoplay playsinline></video><div class="video-state" id="remoteCamState">WAITING FOR CAMERA + MIC</div></div></div><div class="match-grid"><div class="player-card"><div class="player-name">${s.role==="host"?(settings.name||"PLAYER 1"):(s.match?.names?.guest||"PLAYER 2")}</div><div class="player-state"><div class="player-timer" id="myTimer">0.00</div><small id="myState">READY</small></div><div></div></div><div class="center-match"><div class="scramble-2d"><div class="scramble-2d-label">2D SCRAMBLE VISUALIZATION</div><div class="scramble-net" id="scramble2DVisual"></div><div class="center-scramble" id="matchScramble">${esc(s.scramble||"WAITING FOR SCRAMBLE")}</div></div><div class="match-instructions"><span class="desktop-only">SPACE / ENTER — INSPECTION → SOLVE → FINISH</span><span class="mobile-only">TAP TIMER — INSPECTION · LONG PRESS — START · TAP — FINISH</span></div><div class="match-timer-zone" id="matchTimerZone"><div class="match-main-timer" id="matchMainTimer">0.00</div><div class="match-main-label" id="matchMainLabel">READY</div></div><div class="round-result-panel" id="roundResultPanel" hidden><div class="round-result-title" id="roundResultTitle">ROUND RESULTS</div><div id="roundHistoryList" class="round-history-list"></div></div><div class="match-result-tools" id="matchResultTools" hidden><div class="penalty-label">RESULT ADJUSTMENT</div><div class="penalty-buttons"><button class="ghost-btn penalty-btn" id="penaltyPlus2">+2</button><button class="ghost-btn penalty-btn" id="penaltyDnf">DNF</button></div><div class="result-note" id="resultNote"></div></div><div class="match-controls"><span class="match-connection" id="matchConnection">${preconnect?"CONNECTING":"CONNECTED"}</span><span class="media-quality" id="mediaQuality">CONNECTION: ${s.mediaQuality||"FAIR"}</span><button class="ghost-btn" id="muteMic">MIC ON</button><button class="ghost-btn" id="nextRound" hidden>NEXT ROUND</button></div></div><div class="player-card"><div class="player-name">${s.role==="host"?(s.match?.names?.guest||"PLAYER 2"):(s.match?.names?.host||"PLAYER 1")}</div><div class="player-state"><div class="player-timer" id="oppTimer">${s.opponent.time||"0.00"}</div><small id="oppState">${s.opponent.status||"WAITING"}</small></div><div></div></div></div><div class="camera-modal" id="cameraModal" hidden><div class="camera-modal-card"><div class="room-code-label">MATCH CAMERA + MICROPHONE</div><h2>ALLOW CAMERA + MIC</h2><p>Both players are connected. Allow CubeClash to use your camera and microphone for the 1v1 match.</p><div class="room-actions"><button class="primary-btn" id="allowCamera">ALLOW CAMERA + MIC</button><button class="ghost-btn" id="skipCamera">CONTINUE WITHOUT CAMERA + MIC</button></div></div></div></div>`);
  requestAnimationFrame(()=>{render2DScramble();setTimeout(render2DScramble,60);setTimeout(render2DScramble,220);});
  if(s.localStream){const lv=document.querySelector("#localVideo");if(lv)lv.srcObject=s.localStream}
  if(s.remoteStream){const rv=document.querySelector("#remoteVideo");if(rv)rv.srcObject=s.remoteStream}
  document.querySelector("#exitMatch").onclick=exitMatch;
  document.querySelector("#nextRound").onclick=()=>{if(s.nextRoundReady&&s.remoteNextRoundReady){advanceRound()}else{nextRound()}};
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
    if(e.code!=="Space"&&e.code!=="Enter")return;
    e.preventDefault(); e.stopPropagation();
    if(e.type==="keydown"){
      if(e.repeat)return;
      if(s.matchPhase==="ready"||s.matchPhase==="finished"){matchInspection();return;}
      if(s.matchPhase==="inspection"){
        window._cubeClashDesktopHoldFired=false;
        clearTimeout(window._cubeClashDesktopHoldTimer);
        window._cubeClashDesktopHoldTimer=setTimeout(()=>{
          window._cubeClashDesktopHoldFired=true;
          if(s.matchPhase==="inspection")setMatchTimer((s.match?.inspection||15)*1000-(performance.now()-s.matchInspectionStart),"RELEASE TO START");
        },600);
      }
    }else if(e.type==="keyup"){
      clearTimeout(window._cubeClashDesktopHoldTimer);
      const fired=!!window._cubeClashDesktopHoldFired;
      window._cubeClashDesktopHoldFired=false;
      if(s.matchPhase==="inspection"){
        if(fired)matchStart();
        else toast("HOLD SPACE TO START SOLVE");
      }else if(s.matchPhase==="solving"){
        matchFinish();
      }
    }
  };
  document.addEventListener("keyup",keyHandler,true);
  document.addEventListener("keydown",keyHandler,true);
  window._cubeClashMatchKeyHandler=keyHandler;
}

function cleanupMatchMedia(){
  clearTimeout(window._cubeClashDesktopHoldTimer); window._cubeClashDesktopHold=false; window._cubeClashDesktopHoldFired=false;
  try{
    if(s.mediaStatsRaf)clearTimeout(s.mediaStatsRaf);
    s.mediaStatsRaf=0;
    cancelAnimationFrame(s.matchRaf);
    cancelAnimationFrame(s.opponentRaf);
    cancelAnimationFrame(s.raf);
    const local=document.querySelector("#localVideo");
    const remote=document.querySelector("#remoteVideo");
    if(local){local.pause?.();local.srcObject=null;}
    if(remote){remote.pause?.();remote.srcObject=null;}
    if(s.localStream)for(const track of s.localStream.getTracks())track.stop();
    if(s.remoteStream)for(const track of s.remoteStream.getTracks())track.stop();
    s.room?.close();
  }catch(e){console.warn("Match media cleanup failed",e)}
  s.localStream=null;s.remoteStream=null;s.remoteMediaReady=false;s.pendingCamera=false;
}
function exitMatch(){
  cleanupMatchMedia();
  s.room=null;s.role=null;s.roomCode="";
  window.location.reload();
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
  if(t)t.textContent=s.opponent.time||"0.00";
  if(st)st.textContent=s.opponent.status||"WAITING";
  if(sc)sc.textContent=`${s.match?.score?.[0]||0} — ${s.match?.score?.[1]||0}`;
  if(r)r.textContent=`ROUND ${s.match?.round||1} / ${s.match?.rounds||1}`;
  if(mt&&s.matchPhase==="ready")mt.textContent="0.00";
  if(ml)ml.textContent=s.matchPhase==="inspection"?"INSPECTION":s.matchPhase==="solving"?"SOLVING":s.matchPhase==="finished"?"FINISHED":"READY";
  const nr=document.querySelector("#nextRound"),tools=document.querySelector("#matchResultTools"),note=document.querySelector("#resultNote"),panel=document.querySelector("#roundResultPanel"),historyList=document.querySelector("#roundHistoryList"),title=document.querySelector("#roundResultTitle");
  const bothFinished=!!s.myRoundResult&&!!s.remoteRoundResult;
  const finalRound=s.match?.round>=(s.match?.rounds||1);
  const bothReady=!!s.nextRoundReady&&!!s.remoteNextRoundReady;
  const history=(s.matchHistory||[]).filter(item=>!(item.final&&finalRound&&!bothReady));
  const matchFinished=s.match?.status==="FINISHED";
  if(nr){
    nr.hidden=!bothFinished;
    const waiting=s.nextRoundReady&&!s.remoteNextRoundReady;
    nr.disabled=!bothFinished||waiting||(!finalRound&&bothReady);
    if(waiting)nr.textContent="WAITING FOR OPPONENT";
    else if(finalRound)nr.textContent="FINISH ROUND";
    else nr.textContent="NEXT ROUND";
  }
  if(panel){
    panel.hidden=history.length===0;
    panel.classList.toggle("match-final-results",matchFinished);
    if(history.length&&historyList){
      if(title)title.textContent=s.match?.status==="FINISHED"?"MATCH RESULTS":"ROUND RESULTS";
      const p1n=s.match?.names?.host||"PLAYER 1",p2n=s.match?.names?.guest||"PLAYER 2";
      historyList.innerHTML=history.slice().sort((a,b)=>a.round-b.round).map(item=>{
        const a=resultValue(item.p1),b=resultValue(item.p2);
        const diff=(!Number.isFinite(a)||!Number.isFinite(b))?"—":`${fmt(Math.abs(a-b)*1000)} DIFFERENCE`;
        return `<div class="round-history-card"><div class="round-history-head"><span>ROUND ${item.round}</span><span>${item.final?"FINAL":"COMPLETED"}</span></div><div class="round-history-players"><div><div class="round-history-name">${esc(p1n)}</div><div class="round-history-time">${esc(item.p1||"DNF")}</div></div><div class="round-history-diff">${esc(diff)}</div><div><div class="round-history-name">${esc(p2n)}</div><div class="round-history-time">${esc(item.p2||"DNF")}</div></div></div></div>`;
      }).join("");
    }
  }
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
  try{s.room?.send({type:"timer-result-update",display,penalty:s.matchPenalty,rawMs:base,round:s.match?.round||1})}catch{}
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
function upsertMatchHistory(item){
  const list=s.matchHistory||[];
  const i=list.findIndex(x=>x.round===item.round);
  if(i>=0)list[i]={...list[i],...item};else list.push(item);
  s.matchHistory=list.sort((a,b)=>a.round-b.round);
}
function sendMatchHistory(){try{s.room?.send({type:"match-history",history:s.matchHistory||[]})}catch{}}
function maybeResolveRound(force=false){
  if(!s.myRoundResult||!s.remoteRoundResult)return;
  const round=s.match?.round||1;
  const alreadyResolved=s._roundResolved===round;
  const a=resultValue(s.myRoundResult),b=resultValue(s.remoteRoundResult);
  let winner="DRAW";
  if(a<b)winner="PLAYER 1";
  if(b<a)winner="PLAYER 2";
  if(!alreadyResolved){
    if(winner==="PLAYER 1")s.match.score[0]++;
    if(winner==="PLAYER 2")s.match.score[1]++;
    s._roundResolved=round;
  }
  const item={round,p1:s.role==="host"?s.myRoundResult:s.remoteRoundResult,p2:s.role==="host"?s.remoteRoundResult:s.myRoundResult,final:round>=(s.match?.rounds||1)};
  upsertMatchHistory(item); s.roundResult=item;
  if(s.role==="host"){try{s.room.send({type:"round-result",...item,score:s.match.score,history:s.matchHistory})}catch{} sendMatchHistory();}
  updateMatchUI();
}
function nextRound(){
  if(!s.myRoundResult||!s.remoteRoundResult)return;
  if(s.nextRoundReady)return;
  s.nextRoundReady=true; updateMatchUI();
  try{s.room.send({type:"next-round-ready",round:s.match.round})}catch{}
  if(s.remoteNextRoundReady)advanceRound();
}
async function advanceRound(){
  if(!s.nextRoundReady||!s.remoteNextRoundReady)return;
  if(s.match.round>=(s.match.rounds||1)){s.match.status="FINISHED";try{s.room.send({type:"match-over",winner:s.roundResult?.winner||"DRAW",history:s.matchHistory})}catch{}updateMatchUI();return;}
  if(s.role==="host"){
    s.match.round++; s.match.status="PLAYING"; s.scramble=await randomScramble(); s.myRoundResult="";s.remoteRoundResult="";s.roundResult=null;s.opponent={time:"0.00",status:"WAITING"};s.nextRoundReady=false;s.remoteNextRoundReady=false;s.advanceRequested=false;s._roundResolved=null;
    try{s.room.send({type:"next-round",round:s.match.round,score:s.match.score,scramble:s.scramble,history:s.matchHistory})}catch{}
    resetMatchRound();
  }else{try{s.room.send({type:"next-round-request",round:s.match.round})}catch{}}
}
function resetMatchRound(){
  s.matchPhase="ready";s.matchPenalty="";cancelAnimationFrame(s.matchRaf);cancelAnimationFrame(s.opponentRaf);s.opponent={time:"0.00",status:"WAITING"};s.myRoundResult="";s.remoteRoundResult="";s.roundResult=null;s.matchRawMs=0;s.matchPenalty="";s.nextRoundReady=false;s.remoteNextRoundReady=false;s.advanceRequested=false;s._roundResolved=null;renderMatch(false);
}

function settingsView(){v(`<div class="section-title"><h1>SETTINGS</h1><small>LOCAL DEVICE</small></div><div class="settings-grid"><div class="setting-card"><h2>APPEARANCE</h2><div class="theme-options" style="margin-top:14px">${["dark","light","aurora","sunset","ice","forest","violet"].map(name=>themeOptionMarkup(name,THEME_PRESETS[name].label,THEME_PRESETS[name].note)).join("")}</div></div><div class="setting-card"><h2>PROFILE</h2><div class="field"><label>DISPLAY NAME</label><input id="displayName" maxlength="24" value="${esc(settings.name||"")}" placeholder="YOUR NAME" autocomplete="nickname"></div><p style="color:#666;font-size:12px;line-height:1.6">Your name is shown to the other player during 1v1 matches.</p></div><div class="setting-card creator-card"><h2>CREATOR</h2><div class="creator-name">SID ANAJAO</div><p>Created and developed by Sid Anajao.</p></div><div class="setting-card"><h2>TIMER</h2><div class="field"><label>SCRAMBLE ANIMATION SPEED</label><input id="scrambleSpeedSetting" type="range" min="0.05" max="2" step="0.05" value="${Math.max(.05,Math.min(2,Number(settings.scrambleSpeed)||1))}"><div class="scramble-speed-scale"><span>SLOW</span><strong id="scrambleSpeedSettingValue">${(Math.max(.05,Math.min(2,Number(settings.scrambleSpeed)||1))).toFixed(2)}×</strong><span>FAST</span></div></div><div class="field"><label>INSPECTION SECONDS</label><select id="ins"><option ${settings.inspection===0?"selected":""}>0</option><option ${settings.inspection===10?"selected":""}>10</option><option ${settings.inspection===15?"selected":""}>15</option></select></div><div class="room-actions"><button class="primary-btn" id="save">SAVE SETTINGS</button></div></div><div class="setting-card"><h2>DATA</h2><p style="color:#666;font-size:12px;line-height:1.6">Solves are stored locally in IndexedDB. Export your times before clearing browser data or moving to another device.</p><div class="room-actions"><button class="ghost-btn" id="ex">EXPORT JSON</button><label class="ghost-btn" style="display:grid;place-items:center;cursor:pointer">IMPORT JSON<input id="im" type="file" accept=".json" hidden></label><button class="danger-btn" id="cl">CLEAR SOLVES</button></div></div><div class="setting-card wipe-card"><h2>RESET / UPDATE</h2><p style="color:#666;font-size:12px;line-height:1.6">Use this when a new CubeClash update is installed and the old service worker or cached files are causing problems. CubeClash will automatically download a JSON backup of your solve history first, then clear local app data, caches, and the service worker.</p><div class="room-actions"><button class="danger-btn" id="wipeAll">EXPORT + WIPE APP DATA</button></div></div></div>`);bindTheme();applyTheme(currentTheme());document.querySelector("#scrambleSpeedSetting")?.addEventListener("input",e=>{const value=Math.max(.05,Math.min(2,Number(e.target.value)||1));document.querySelector("#scrambleSpeedSettingValue").textContent=`${value.toFixed(2)}×`});document.querySelector("#save").onclick=()=>{settings.inspection=+document.querySelector("#ins").value;settings.scrambleSpeed=Math.max(.05,Math.min(2,Number(document.querySelector("#scrambleSpeedSetting")?.value)||1));settings.name=(document.querySelector("#displayName")?.value||"").trim().slice(0,24);const selected=document.querySelector(".theme-option.active")?.dataset.theme||currentTheme();applyTheme(selected);localStorage.setItem("cubeclash-settings",JSON.stringify(settings));toast("SETTINGS SAVED")};document.querySelector("#ex").onclick=async()=>{const b=new Blob([JSON.stringify(await exportData(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`cubeclash-${Date.now()}.json`;a.click()};document.querySelector("#im").onchange=async e=>{try{await importData(JSON.parse(await e.target.files[0].text()));toast("DATA IMPORTED")}catch{toast("IMPORT FAILED")}};document.querySelector("#cl").onclick=async()=>{if(confirm("Clear all local solves? This cannot be undone unless you exported them.")){await clearSolves();toast("SOLVES CLEARED")}};document.querySelector("#wipeAll").onclick=async()=>{if(!confirm("CubeClash will export your solve history and then clear local app data, cache, settings, and service worker. Continue?"))return;try{await wipeCubeClashData({downloadBackup:true});alert("Backup downloaded. CubeClash will reload with a clean installation.");location.reload()}catch(e){console.error(e);toast("RESET FAILED")}}}
async function nav(x){
  if(window._cubeClashSoloKeyHandler){document.removeEventListener("keydown",window._cubeClashSoloKeyHandler,true);window._cubeClashSoloKeyHandler=null;}
  if(window._cubeClashSoloKeyUpHandler){document.removeEventListener("keyup",window._cubeClashSoloKeyUpHandler,true);window._cubeClashSoloKeyUpHandler=null;}
  stopMenuHeroCube();
  if(s.room||s.localStream||s.remoteStream)cleanupMatchMedia();
  s.room=null;s.role=null;s.roomCode="";
  try{
    if(x==="home")return home();
    if(x==="solo")return await solo();
    if(x==="room")return room();
    if(x==="settings")return settingsView();
  }catch(err){
    console.error("CubeClash navigation failed",x,err);
    toast(x.toUpperCase()+" FAILED TO OPEN");
    if(x==="solo")renderSoloView([]);
  }
}
document.addEventListener("click",e=>{const x=e.target.closest("[data-view]");if(x)nav(x.dataset.view)});window.addEventListener("online",()=>{document.querySelector("#networkText").textContent="ONLINE"});window.addEventListener("offline",()=>{document.querySelector("#networkText").textContent="OFFLINE"});window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;document.querySelector("#installBtn").hidden=false});document.querySelector("#installBtn").onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null}};if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./service-worker.js");
if(localStorage.getItem("cubeclash-tutorial-seen")==="1")home();else tutorial();
