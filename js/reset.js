export async function wipeCubeClashData({downloadBackup=true}={}){
  if(downloadBackup){
    const {exportData}=await import('./storage.js');
    const backup=await exportData();
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`cubeclash-backup-${Date.now()}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  try{await new Promise((resolve,reject)=>{const r=indexedDB.deleteDatabase('cubeclash');r.onsuccess=resolve;r.onerror=()=>reject(r.error);r.onblocked=resolve})}catch(e){console.warn(e)}
  try{localStorage.clear()}catch(e){console.warn(e)}
  try{for(const k of await caches.keys())await caches.delete(k)}catch(e){console.warn(e)}
  try{const regs=await navigator.serviceWorker?.getRegistrations?.()||[];for(const reg of regs)await reg.unregister()}catch(e){console.warn(e)}
}
