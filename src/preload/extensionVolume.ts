import {contextBridge,ipcRenderer} from 'electron';
if(process.isMainFrame){
 contextBridge.exposeInMainWorld('asterVolumeAdapter',{request:(value:unknown)=>ipcRenderer.invoke('aster:extension-volume',value)});
 contextBridge.executeInMainWorld({func:()=>{
  const install=()=>{const root=window as any,chrome=root.chrome,bridge=root.asterVolumeAdapter;
  const query=chrome.tabs.query.bind(chrome.tabs),send=chrome.runtime.sendMessage.bind(chrome.runtime);
  chrome.tabs.query=(filter:any,callback?:any)=>{if(filter?.active===true){const result=bridge.request('target').then((tab:any)=>[tab]);if(callback){void result.then(callback);return;}return result;}return query(filter,callback);};
  chrome.runtime.sendMessage=(message:any,...args:any[])=>{if(message?.type==='SET_VOLUME'&&typeof message.volume==='number'){
   const callback=args.find(a=>typeof a==='function');const result=bridge.request(message.volume).catch((error:any)=>({ok:false,message:error.message}));if(callback){void result.then(callback);return;}return result;
  }return send(message,...args);};
 };if((window as any).chrome?.tabs?.query)install();else document.addEventListener('DOMContentLoaded',install,{once:true});
 }});
}
