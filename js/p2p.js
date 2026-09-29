const ICE={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun.cloudflare.com:3478"}]};

export class P2PRoom{
  constructor(role){
    if(!window.Peer) throw new Error("PeerJS could not load. Check your internet connection and reload the page.");
    this.role=role; this.peer=null; this.conn=null; this.call=null; this.calls=[]; this.pendingCall=null; this.outgoingCall=null; this.handlers={message:[],state:[],error:[],stream:[]};
  }
  on(type,fn){(this.handlers[type]??=[]).push(fn);return this}
  emit(type,data){for(const fn of this.handlers[type]??[])try{fn(data)}catch(e){console.error(e)}}
  async waitOpen(){if(this.peer?.open)return this.peer.id;return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("Signaling server timed out. Please try again.")),15000);this.peer.once("open",id=>{clearTimeout(timeout);resolve(id)});this.peer.once("error",e=>{clearTimeout(timeout);reject(normalizePeerError(e))})})}
  async createRoom(){
    for(let attempt=0;attempt<4;attempt++){
      const roomId="CC"+Math.random().toString(36).slice(2,8).toUpperCase();
      try{
        this.peer=new Peer(roomId,{config:ICE,debug:1});
        this.bindPeer();
        const id=await this.waitOpen();
        this.emit("state","room-open");
        return id;
      }catch(e){
        try{this.peer?.destroy()}catch{}
        if(!String(e.message||e).includes("already in use")&&!String(e.message||e).includes("taken"))throw e;
      }
    }
    throw new Error("Could not reserve a room code. Please try again.");
  }
  async joinRoom(roomId){
    if(!roomId)throw new Error("Enter the room code from Player 1.");
    this.peer=new Peer(undefined,{config:ICE,debug:1});
    this.bindPeer();
    await this.waitOpen();
    const conn=this.peer.connect(roomId,{reliable:true,serialization:"json",metadata:{role:"guest"}});
    this.attachConnection(conn);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("Player 1 was not found. Check the room code and make sure the host is still in the room.")),15000);conn.once("open",()=>{clearTimeout(timer);resolve()});conn.once("error",e=>{clearTimeout(timer);reject(e)})});
    return true;
  }
  bindPeer(){
    this.peer.on("connection",conn=>this.attachConnection(conn));
    this.peer.on("call",call=>this.handleIncomingCall(call));
    this.peer.on("disconnected",()=>this.emit("state","signaling-disconnected"));
    this.peer.on("error",e=>this.emit("error",normalizePeerError(e)));
  }
  attachConnection(conn){
    this.conn=conn;
    conn.on("open",()=>{this.emit("state","connected");this.emit("message",{type:"peer-open"})});
    conn.on("data",data=>this.emit("message",data));
    conn.on("close",()=>this.emit("state","closed"));
    conn.on("error",e=>this.emit("error",normalizePeerError(e)));
  }
  send(data){if(!this.conn||!this.conn.open)throw new Error("Player is not connected yet.");this.conn.send(data)}
  startMediaCall(stream){
    if(!this.peer||!this.conn?.peer)throw new Error("Peer connection is not ready.");
    if(this.outgoingCall && this.outgoingCall.open)return this.outgoingCall;
    const call=this.peer.call(this.conn.peer,stream,{metadata:{kind:"cubeclash-camera"}});
    this.outgoingCall=call;
    this.attachCall(call);
    return call;
  }
  handleIncomingCall(call){
    this.pendingCall=call;
    this.emit("state","camera-requested");
  }
  answerWithMedia(stream){
    if(!this.pendingCall)throw new Error("No incoming media request.");
    const call=this.pendingCall;
    this.pendingCall=null;
    call.answer(stream);
    this.attachCall(call);
  }
  startCameraCall(stream){return this.startMediaCall(stream)}
  async configureMedia(stream){
    if(!stream)return;
    const pcs=this.calls.map(c=>c?.peerConnection).filter(Boolean);
    for(const pc of pcs){
    for(const sender of pc.getSenders()){
      if(sender.track?.kind!=="video")continue;
      const p=sender.getParameters();p.encodings??=[{}];const e=p.encodings[0];e.maxBitrate=1200000;e.maxFramerate=30;e.degradationPreference="maintain-framerate";try{await sender.setParameters(p)}catch{}
    }
    }
  }
  answerWithCamera(stream){return this.answerWithMedia(stream)}
  attachCall(call){
    this.call=call;
    if(!this.calls.includes(call))this.calls.push(call);
    call.on("stream",stream=>this.emit("stream",stream));
    call.on("close",()=>this.emit("state","camera-closed"));
    call.on("error",e=>this.emit("error",normalizePeerError(e)));
  }
  close(){try{this.conn?.close();this.call?.close();this.peer?.destroy()}catch{}}
}
function normalizePeerError(e){
  const t=e?.type||"";
  const map={"peer-unavailable":"Room not found or Player 1 is offline.","network":"Could not reach the signaling server.","server-error":"The signaling server returned an error.","ssl-unavailable":"Secure connection is unavailable.","browser-incompatible":"This browser does not support the required WebRTC features.","unavailable-id":"That room ID is already in use. Please create another room."};
  return new Error(map[t]||e?.message||String(e||"WebRTC error"));
}
