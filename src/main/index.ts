import {ExtensionService} from './extensionService';
import {AIProvider} from './aiService';
import {serveAsset} from './wallpaperAssets';
import { app, session, protocol, ipcMain,clipboard,safeStorage,powerMonitor } from 'electron';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { Repository } from './database';
import { BrowserController } from './browser';
import { commandSchema } from '../shared/schema';
import { trustedSender } from './security';
import { SessionCoordinator } from './sessionCoordinator';
import type { WindowSession } from '../shared/workspace';
import {PrivacyService} from './privacyService';
import {wallpaperPath} from './wallpaper';
import {VaultStore} from './vaultStore';
import {SecureClipboard} from './secureClipboard';

protocol.registerSchemesAsPrivileged([{scheme:'aster',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
if (process.env.ASTER_TEST_PROFILE) app.setPath('userData',path.resolve(process.env.ASTER_TEST_PROFILE));
app.setName('Aster');
if(process.platform==='win32')app.setAppUserModelId('dev.aster.browser');
const windows = new Map<number,BrowserController>();
let repo: Repository;
let coordinator:SessionCoordinator;
let quitting=false;
let privacy:PrivacyService;
let vault:VaultStore;let secrets:SecureClipboard;let finalizing=false;
if(!app.requestSingleInstanceLock())app.quit();
app.on('second-instance',()=>{const window=windows.values().next().value?.window;if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
app.whenReady().then(async () => {
  const root=path.resolve(__dirname,'../renderer');
  await session.fromPartition('aster-ui').protocol.handle('aster',async request => {
    try {
      const url=new URL(request.url);
      if(url.host!=='app'||request.method!=='GET') return new Response('Forbidden',{status:403});
      const requested=decodeURIComponent(url.pathname);
      if(/^\/wallpaper-asset\/[0-9a-f-]{36}$/.test(requested))return serveAsset(repo,requested.split('/')[2],request.headers.get('Range'));
      if(requested==='/wallpaper.jpg'){if(!repo?.settings().wallpaper)return new Response('Not found',{status:404});return new Response(await readFile(wallpaperPath()),{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
      const filename=path.resolve(root,'.'+requested);
      if(!filename.startsWith(root+path.sep)||!['.html','.js','.css','.svg','.png','.woff2'].includes(path.extname(filename))) return new Response('Forbidden',{status:403});
      const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
      return new Response(await readFile(filename),{headers:{'Content-Type':mime[path.extname(filename)],'X-Content-Type-Options':'nosniff'}});
    } catch {return new Response('Not found',{status:404});}
  });
  repo=new Repository(path.join(app.getPath('userData'),'aster.sqlite'));
  secrets=new SecureClipboard(clipboard);
  const powerChanged=()=>{for(const controller of windows.values())controller.emit();};powerMonitor.on('on-ac',powerChanged);powerMonitor.on('on-battery',powerChanged);
  vault=new VaultStore(path.join(app.getPath('userData'),'aster.vault.json'),()=>{if(vault?.snapshot().locked)void secrets.clear();for(const controller of windows.values())controller.emit();},()=>repo.settings().vaultLockMinutes*60000,{
    available:()=>safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(safeStorage.getSelectedStorageBackend())),
    encrypt:async key=>(await safeStorage.encryptStringAsync(key.toString('base64'))).toString('base64'),
    decrypt:async value=>Buffer.from((await safeStorage.decryptStringAsync(Buffer.from(value,'base64'))).result,'base64')
  });
  powerMonitor.on('lock-screen',()=>vault.lock());powerMonitor.on('suspend',()=>vault.lock());
  privacy=new PrivacyService(repo,()=>{for(const window of windows.values())window.emit();});
  ipcMain.on('aster:player-protection',event=>{event.returnValue=privacy.playerProtection(event.sender.id,event.senderFrame?.url??'',event.senderFrame===event.sender.mainFrame);});
  coordinator=new SessionCoordinator(repo,()=>[...windows.values()].map(w=>w.serialize()).filter((saved):saved is WindowSession=>!!saved));
  const aiProvider=new AIProvider(repo);
  const extensions=new ExtensionService(path.join(app.getPath('userData'),'extensions'),()=>{for(const controller of windows.values())controller.emit();});
  const createWindow=(saved?:WindowSession,privateOnly=false)=>{
    if(windows.size>=8)throw new Error('The prototype supports up to eight browser windows.');
    const controller=new BrowserController(repo,privacy,vault,secrets,createWindow,()=>coordinator.changed(),saved,()=>coordinator.pending.length>0,restore=>{
      const savedWindows=coordinator.recover(restore);if(savedWindows.length){controller.replaceSession(savedWindows[0]);for(const state of savedWindows.slice(1))createWindow(state);}
      for(const other of windows.values())other.emit();coordinator.flush(false);
    },privateOnly,aiProvider,extensions);
    const id=controller.window.webContents.id;windows.set(id,controller);
    controller.window.on('close',()=>{if(!quitting)coordinator.closing();});
    controller.window.on('closed',()=>{windows.delete(id);if(!quitting)coordinator.changed();});
  };
  const getController=(event: Electron.IpcMainInvokeEvent)=>{
    const controller=windows.get(event.sender.id);
    if(!controller||!trustedSender(event.sender.id,controller.window.webContents.id,event.senderFrame?.url??'',event.senderFrame===event.sender.mainFrame)) throw new Error('Unauthorized browser request.');
    return controller;
  };
  ipcMain.handle('aster:snapshot',event=>getController(event).snapshot());
  ipcMain.handle('aster:command',async(event,payload:unknown)=>{const controller=getController(event);const parsed=commandSchema.safeParse(payload);if(!parsed.success)return{ok:false,error:'Invalid browser command.'};const result=await controller.command(parsed.data);for(const other of windows.values())other.emit();return result;});
  const startup=coordinator.startup();if(startup.length)for(const saved of startup)createWindow(saved);else createWindow();
  coordinator.flush(false);
  app.on('activate',()=>{if(!windows.size)createWindow();});
}).catch(()=>{console.error(JSON.stringify({category:'browser',event:'startup-failed'}));app.exit(1);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',event=>{if(!finalizing){event.preventDefault();finalizing=true;vault?.lock();void (secrets?.clear()??Promise.resolve()).catch(()=>{console.error(JSON.stringify({category:'shutdown',event:'secret-cleanup-failed'}));}).finally(()=>app.quit());return;}quitting=true;privacy?.dispose();coordinator?.quit();});
app.on('will-quit',()=>{privacy?.dispose();repo?.close();});
