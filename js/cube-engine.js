// CubeClash internal cube engine. No runtime scramble API dependency.
const MOVES={333:["R","L","U","D","F","B"],222:["R","L","U","D","F","B"]};
const CUBE_COLORS={R:"R",L:"O",U:"W",D:"Y",F:"G",B:"B"};
const MOVE_AXIS={R:"x",L:"x",U:"y",D:"y",F:"z",B:"z"};
const MOVE_LAYER={R:1,L:-1,U:1,D:-1,F:1,B:-1};
const MOVE_SIGN={R:-1,L:1,U:-1,D:1,F:1,B:-1};
const COLOR_HEX={R:"#d71920",O:"#ff6a00",W:"#f7f7f7",Y:"#ffd500",G:"#009b48",B:"#0051ba"};

function rotateVector(v,axis,quarterTurns){
  let [x,y,z]=v;
  let n=((quarterTurns%4)+4)%4;
  while(n--){
    if(axis==="x")[y,z]=[-z,y];
    else if(axis==="y")[x,z]=[z,-x];
    else [x,y]=[y,-x];
  }
  return [x,y,z];
}

function buildSolvedCubeState(size){
  const state=[];
  for(let x=0;x<size;x++)for(let y=0;y<size;y++)for(let z=0;z<size;z++){
    const p=[x*2/(size-1)-1,y*2/(size-1)-1,z*2/(size-1)-1];
    const stickers=[];
    if(x===size-1)stickers.push({normal:[1,0,0],color:CUBE_COLORS.R});
    if(x===0)stickers.push({normal:[-1,0,0],color:CUBE_COLORS.L});
    if(y===size-1)stickers.push({normal:[0,1,0],color:CUBE_COLORS.U});
    if(y===0)stickers.push({normal:[0,-1,0],color:CUBE_COLORS.D});
    if(z===size-1)stickers.push({normal:[0,0,1],color:CUBE_COLORS.F});
    if(z===0)stickers.push({normal:[0,0,-1],color:CUBE_COLORS.B});
    state.push({p,stickers});
  }
  return state;
}

function applyMove(state,token){
  const face=token[0];
  const axis=MOVE_AXIS[face];
  const layer=MOVE_LAYER[face];
  const base=MOVE_SIGN[face]*(token.includes("'")?-1:1);
  const turns=token.endsWith("2")?2:1;
  const index=axis==="x"?0:axis==="y"?1:2;
  const affected=state.filter(cubie=>cubie.p[index]===layer);
  for(let t=0;t<turns;t++){
    for(const cubie of affected){
      cubie.p=rotateVector(cubie.p,axis,base);
      cubie.stickers=cubie.stickers.map(st=>({normal:rotateVector(st.normal,axis,base),color:st.color}));
    }
  }
}

function buildCubeState(size,scramble){
  const state=buildSolvedCubeState(size);
  const tokens=scramble.trim()?scramble.trim().split(/\s+/):[];
  for(const token of tokens)if(/^[RLUDFB](2|')?$/.test(token))applyMove(state,token);
  return state;
}

function cubeStateSignature(state){
  return state.map(c=>`${c.p.join(",")}:${c.stickers.map(s=>s.normal.join(",")+s.color).sort().join("|")}`).sort().join(";");
}
function inverseScramble(scramble){
  return scramble.trim().split(/\s+/).reverse().map(t=>t.endsWith("2")?t:t.endsWith("'")?t.slice(0,-1):`${t}'`).join(" ");
}
const STANDARD_CORNER_CYCLES={
  U:[[1,1,1],[-1,1,1],[-1,1,-1],[1,1,-1]],
  D:[[1,-1,1],[1,-1,-1],[-1,-1,-1],[-1,-1,1]],
  R:[[1,1,1],[1,1,-1],[1,-1,-1],[1,-1,1]],
  L:[[-1,1,1],[-1,-1,1],[-1,-1,-1],[-1,1,-1]],
  F:[[1,1,1],[1,-1,1],[-1,-1,1],[-1,1,1]],
  B:[[1,1,-1],[-1,1,-1],[-1,-1,-1],[1,-1,-1]]
};
function validateCubeState(size,state){
  const expected=size===3?54:24;
  const seen=new Set(),counts={R:0,O:0,W:0,Y:0,G:0,B:0};
  for(const c of state){
    const key=c.p.join(",");
    if(seen.has(key))return false;
    seen.add(key);
    for(const st of c.stickers){
      if(!counts.hasOwnProperty(st.color)||!Array.isArray(st.normal)||st.normal.filter(Boolean).length===0)return false;
      counts[st.color]++;
    }
  }
  return [...Object.values(counts)].reduce((a,b)=>a+b,0)===expected && Object.values(counts).every((n)=>n===size*size);
}
function auditStandardMoveGeometry(size){
  const solved=buildSolvedCubeState(size);
  for(const face of Object.keys(STANDARD_CORNER_CYCLES)){
    const after=buildCubeState(size,face);
    const cycle=STANDARD_CORNER_CYCLES[face];
    for(let i=0;i<cycle.length;i++){
      const source=cycle[i],expected=cycle[(i+1)%cycle.length];
      const sourceIndex=solved.findIndex(c=>c.p.every((v,j)=>v===source[j]));
      if(sourceIndex<0)return false;
      const actual=after[sourceIndex].p;
      if(actual[0]!==expected[0]||actual[1]!==expected[1]||actual[2]!==expected[2])return false;
    }
  }
  return true;
}
function auditCubeEngine(size,scramble){
  const solved=buildSolvedCubeState(size);
  const state=buildCubeState(size,scramble);
  const restored=buildCubeState(size,`${scramble} ${inverseScramble(scramble)}`);
  const ok=validateCubeState(size,state)&&validateCubeState(size,restored)&&auditStandardMoveGeometry(size)&&cubeStateSignature(restored)===cubeStateSignature(solved);
  if(!ok)console.error("CubeClash cube-engine audit failed",{size,scramble});
  return ok;
}



const FACE_ORDER=["U","R","F","D","L","B"];
function stateToFaceletString(state,size=3){
  if(size!==2&&size!==3) throw new Error("Unsupported cube size");
  const out={U:Array(size*size).fill(null),R:Array(size*size).fill(null),F:Array(size*size).fill(null),D:Array(size*size).fill(null),L:Array(size*size).fill(null),B:Array(size*size).fill(null)};
  const max=size-1;
  const coordToIndex=v=>Math.round(v*max/2+max/2);
  for(const cubie of state){
    const [x,y,z]=cubie.p;
    for(const sticker of cubie.stickers){
      const [nx,ny,nz]=sticker.normal;
      let face,row,col;
      if(ny===1){face="U";row=coordToIndex(z);col=coordToIndex(x);}
      else if(nx===1){face="R";row=coordToIndex(-y);col=coordToIndex(-z);}
      else if(nz===1){face="F";row=coordToIndex(-y);col=coordToIndex(x);}
      else if(ny===-1){face="D";row=coordToIndex(-z);col=coordToIndex(x);}
      else if(nx===-1){face="L";row=coordToIndex(-y);col=coordToIndex(z);}
      else if(nz===-1){face="B";row=coordToIndex(-y);col=coordToIndex(-x);}
      else continue;
      out[face][row*size+col]=sticker.color;
    }
  }
  return FACE_ORDER.map(face=>out[face].join("")) .join("");
}

export {MOVES,CUBE_COLORS,MOVE_AXIS,MOVE_LAYER,MOVE_SIGN,COLOR_HEX,rotateVector,buildSolvedCubeState,applyMove,buildCubeState,cubeStateSignature,inverseScramble,validateCubeState,auditStandardMoveGeometry,auditCubeEngine,stateToFaceletString};
