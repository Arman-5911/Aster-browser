import {BrowserWindow,ipcMain,session,type WebContents} from 'electron';
import {randomUUID} from 'node:crypto';
const bindings=new Map<number,{popup:WebContents;target:WebContents;origin:string;url:string;host?:BrowserWindow;queue:Promise<unknown>;pending:number}>();
let registered=false;
export function bindVolumePopup(popup:BrowserWindow,target:WebContents,origin:string){
 if(!registered){registered=true;ipcMain.handle('aster:extension-volume',async(event,volume:unknown)=>{
  const senderId=event.sender.id;const binding=bindings.get(senderId);
  if(!binding||event.senderFrame!==event.sender.mainFrame||!event.senderFrame.url.startsWith(binding.origin+'/')||binding.target.isDestroyed()||binding.target.getURL()!==binding.url)throw Error('Audio control is no longer authorized. Reopen the popup.');
  if(volume==='target')return {id:binding.target.id,url:binding.url,title:binding.target.getTitle(),active:true};
  if(typeof volume!=='number'||!Number.isFinite(volume)||volume<0||volume>500)throw Error('Volume must be between 0 and 500 percent.');
  if(binding.pending>=20)throw Error('Too many volume changes. Try again shortly.');
  binding.pending++;
  const operation=binding.queue.catch(()=>{}).then(async()=>{
   if(!bindings.has(senderId)||binding.target.isDestroyed())throw Error('Audio tab closed.');
   if(!binding.host){
    if([...bindings.values()].some(other=>other!==binding&&other.target===binding.target&&other.host&&!other.host.isDestroyed()))throw Error('This tab already has an audio controller. Close its other popup first.');
    const isolated=session.fromPartition('aster-audio-'+randomUUID());
    isolated.setPermissionCheckHandler((_wc,permission)=>(permission==='media'||permission==='display-capture'||permission==='speaker-selection'));isolated.setPermissionRequestHandler((_wc,permission,callback)=>callback((permission==='media'||permission==='display-capture'||permission==='speaker-selection')));
    isolated.setDisplayMediaRequestHandler((_request,callback)=>{if(binding.target.isDestroyed()){callback({});return;}callback({video:binding.target.mainFrame,audio:binding.target.mainFrame});});
    await isolated.protocol.handle('aster',()=>new Response('<!doctype html><title>Aster tab audio</title>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'none'; connect-src 'none'"}}));
    if(!bindings.has(senderId))throw Error('Audio popup closed.');
    const host=new BrowserWindow({show:false,opacity:0,skipTaskbar:true,focusable:false,width:1,height:1,webPreferences:{session:isolated,sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});binding.host=host;let phase='opening audio host';let timeout:ReturnType<typeof setTimeout>|undefined;let rejectClosed:(error:Error)=>void=()=>{};const deadline=new Promise<never>((_resolve,reject)=>{rejectClosed=reject;timeout=setTimeout(()=>reject(new Error('Audio startup timed out while '+phase+'.')),10000);});const hostClosed=()=>rejectClosed(new Error('Audio host closed.'));host.once('closed',hostClosed);
    host.webContents.setWindowOpenHandler(()=>({action:'deny'}));host.webContents.on('will-navigate',e=>e.preventDefault());
    try{await Promise.race([(async()=>{await host.loadURL('aster://audio/index.html');if(!bindings.has(senderId)||binding.target.isDestroyed())throw Error('Audio tab closed.');
     phase='capturing tab audio';await host.webContents.executeJavaScript(`(async()=>{const stream=await navigator.mediaDevices.getDisplayMedia({audio:true,video:true});stream.getVideoTracks().forEach(track=>{track.stop();stream.removeTrack(track);});const context=new AudioContext();const gain=context.createGain();gain.gain.value=${volume/100};const input=context.createMediaStreamSource(stream);const analyser=context.createAnalyser();input.connect(analyser);analyser.connect(gain);const output=context.createAnalyser();gain.connect(output);output.connect(context.destination);window.audioSession={stream,context,gain,analyser,output};return stream.getAudioTracks().length;})()`,true);phase='starting audio output';await host.webContents.executeJavaScript('window.audioSession.context.resume()',true);})(),deadline]);
    }catch(error){if(!host.isDestroyed())host.destroy();binding.host=undefined;throw new Error('Audio capture could not start ('+phase+'). Check the audio output device and reopen the popup.');}finally{clearTimeout(timeout);host.removeListener('closed',hostClosed);}
   }else await binding.host.webContents.executeJavaScript(`window.audioSession.gain.gain.setValueAtTime(${volume/100},window.audioSession.context.currentTime)`);
   return {ok:true,message:'Volume set to '+volume+'% (keep this popup open)'};
  }).finally(()=>{binding.pending--;});binding.queue=operation;return operation;
 });}
 const binding={popup:popup.webContents,target,origin,url:target.getURL(),queue:Promise.resolve() as Promise<unknown>,pending:0,host:undefined as BrowserWindow|undefined};bindings.set(popup.webContents.id,binding);
 const id=popup.webContents.id;let stopped=false;const stop=()=>{if(stopped)return;stopped=true;bindings.delete(id);const host=binding.host;binding.host=undefined;if(host&&!host.isDestroyed())host.destroy();target.removeListener('destroyed',close);target.removeListener('did-start-navigation',navigation);};
 const close=()=>{stop();if(!popup.isDestroyed())popup.destroy();};const navigation=(_event:unknown,_url:string,_inPlace:boolean,isMainFrame:boolean)=>{if(isMainFrame)close();};
 popup.once('close',stop);popup.once('closed',stop);popup.webContents.once('destroyed',stop);popup.webContents.on('will-navigate',close);popup.webContents.once('render-process-gone',close);target.once('destroyed',close);target.on('did-start-navigation',navigation);
}
