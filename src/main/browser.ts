import {pathToFileURL} from 'node:url';
import {documentKey,documentNavigation,documentFrame,siteBlob,previewExtensions} from './documentPolicy';
import type {ExtensionService} from './extensionService';
import {AIProvider,AISession} from './aiService';
import {extractAIContent,sourceURL,learningSchema,type AISource} from '../shared/ai';
import {resolveStudio} from '../shared/studio';
import {cpus,totalmem,freemem} from 'node:os';
import {importAsset,removeAsset} from './wallpaperAssets';
import { app, BrowserWindow, WebContentsView, powerMonitor, session, Menu, dialog, shell, clipboard, ClipboardItem, type DownloadItem, type Session, type Input } from 'electron';
import {writeFile,readFile,stat} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Repository } from './database';
import type { Command } from '../shared/schema';
import type { Tab, Snapshot, Panel, Download } from '../shared/types';
import { isWebUrl, resolveInput,settingsPanel } from '../shared/navigation';
import { APP_URL } from './security';
import { emptySplit, splitCount, partitionFor, windowSessionSchema, type SavedWorkspace, type WindowSession, type WorkspaceInfo } from '../shared/workspace';
import { chromeGeometry, SPLIT_BAR_HEIGHT, PANE_HEADER_HEIGHT, paneRects } from '../shared/layout';
import type {PrivacyService} from './privacyService';
import {originOf} from './privacyPolicy';
import type {CookieInfo,PrivacySnapshot} from '../shared/privacy';
import {extractArticle,articleSchema,type Article} from '../shared/reader';
import type {ResponsiveSize} from '../shared/developer';
import {importWallpaper,removeWallpaper} from './wallpaper';
import type {VaultStore} from './vaultStore';
import type {SecureClipboard} from './secureClipboard';
import {fillLogin} from './autofill';

type LiveTab = { lastActive?:number; state: Tab; view?: WebContentsView;responsive?:ResponsiveSize;emulationKey?:string };
export class BrowserController {
  readonly window: BrowserWindow;
  private tabs: LiveTab[] = [];
  private sleepTimer?:ReturnType<typeof setInterval>;
  private maintenanceBusy=false;
  private protectedFromSleep(tab:LiveTab){
    if(this.disposed||!this.tabs.includes(tab))return true;
    const wc=tab.view?.webContents,w=this.workspace(tab.state.workspaceId);
    return this.disposed||!wc||wc.isDestroyed()||!isWebUrl(tab.state.url)||tab.state.id===this.activeId||tab.state.pinned||tab.state.floating||tab.state.loading||!!tab.state.error||w.temporary||(w.id===this.workspaceId&&w.split.mode!=='off'&&w.split.tabs.includes(tab.state.id))||wc.isCurrentlyAudible()||wc.isBeingCaptured()||wc.isDevToolsOpened()||this.items.size>0||this.privacy.prompts(this.ownedIds()).length>0;
  }
  private async sleepTab(tab:LiveTab){
    if(this.protectedFromSleep(tab))return false;
    const wc=tab.view!.webContents,url=tab.state.url;
    let safe=false;
    try{safe=await Promise.race([wc.executeJavaScriptInIsolatedWorld(999,[{code:`!document.querySelector('input,textarea,select,[contenteditable],iframe,frame,audio,video')`}]),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),1500))]);}catch{return false;}
    if(safe!==true||this.protectedFromSleep(tab)||tab.view?.webContents!==wc||tab.state.url!==url||!this.tabs.includes(tab))return false;
    this.destroyView(tab);tab.state.sleeping=true;tab.state.loading=false;tab.state.canGoBack=false;tab.state.canGoForward=false;this.emit();return true;
  }
  private async maintainTabs(){
    if(this.maintenanceBusy||this.disposed)return;this.maintenanceBusy=true;
    try{const now=Date.now(),settings=this.repo.settings();for(const tab of this.tabs){if(this.protectedFromSleep(tab)){tab.lastActive=now;continue;}tab.lastActive??=now;if(settings.autoSleep&&now-tab.lastActive>=settings.sleepMinutes*60000)await this.sleepTab(tab);}if(this.panel==='performance')this.emit();}finally{this.maintenanceBusy=false;}
  }

  private activeId = '';
  private panelOverlay:Panel='none';
  private get panel():Panel{return this.panelOverlay!=='none'?this.panelOverlay:settingsPanel(this.tabs.find(t=>t.state.id===this.activeId)?.state.url??'')??'none';}
  private set panel(value:Panel){this.panelOverlay=value;}
  private ai:AISession;private focus?:{started:number;ends:number;blocked:string[];scope:string};private focusTimer?:ReturnType<typeof setTimeout>;
  private chromeHidden=false;private sidebarCollapsed=false;
  private closed: string[] = [];
  private approvedDocuments=new Set<string>();
  private items = new Map<string, DownloadItem>();
  private sessions = new Map<string,Session>();
  private workspaces: WorkspaceInfo[] = [];
  private workspaceId='default';
  private windowId:string=randomUUID();
  private floats=new Map<string,BrowserWindow>();
  private splitDragging=false;
  private disposed = false;
  private startupPending=true;
  private startupTimer?:ReturnType<typeof setTimeout>;
  private broadcastTimer?: ReturnType<typeof setTimeout>;
  private cookieRows:CookieInfo[]=[];
  private cookieKeys=new Map<string,Electron.Cookie>();
  private cookieContext='';
  private receipt?:PrivacySnapshot['receipt'];
  private privateDownloads=new Map<string,Download>();
  private downloadScopes=new Map<string,string>();
  private retiredTemporary=new Set<string>();
  private popupTimes=new Map<number,number[]>();
  private article?:Article;
  private commandGeneration=0;
  private developerMessage='';
  private screenshotBusy=false;
  constructor(private repo: Repository, private privacy:PrivacyService,private vault:VaultStore,private secrets:SecureClipboard, private createWindow: (saved?:WindowSession,privateOnly?:boolean) => void, private changed:()=>void=()=>{}, saved?:WindowSession, private recoveryPending:()=>boolean=()=>false, private recover:(restore:boolean)=>void=()=>{},private readonly privateOnly=false,private aiProvider:AIProvider=new AIProvider(repo),private extensions?:ExtensionService) {
    this.ai=new AISession(repo,aiProvider,()=>{if(this.tabs.some(t=>t.state.id===this.activeId))this.emit();});
    this.window = new BrowserWindow({ icon:path.join(__dirname,'icons',process.platform==='win32'?'aster.ico':'aster.png'),width: 1360, height: 900, minWidth: 850, minHeight: 600, frame: false, backgroundColor: '#050b15', show: false,
      webPreferences: { preload: path.join(__dirname, '../preload/index.cjs'), partition: 'aster-ui', contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false } });
    this.window.webContents.on('will-navigate', e => e.preventDefault());
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('before-input-event', (e, input) => this.shortcut(e, input));
    this.window.webContents.on('did-finish-load', () => this.emit());
    this.window.on('resize', () => this.layout());
    this.window.once('ready-to-show', () => {
      if(this.window.isDestroyed())return;
      this.window.maximize();
      this.window.show();
    });
    this.startupTimer=setTimeout(()=>{this.startupPending=false;this.layout();},10000);
    this.window.on('closed', () => {
      this.disposed = true;clearTimeout(this.startupTimer);clearInterval(this.sleepTimer);this.ai.clear();this.finishFocus(false); clearTimeout(this.broadcastTimer);
      for(const browsing of this.sessions.values())browsing.removeListener('will-download',this.onDownload);
      for (const item of this.items.values()) item.cancel();
      for (const tab of this.tabs) this.destroyView(tab);
      for(const w of this.workspaces)if(w.temporary)void this.cleanTemporary(w.id);
    });
    if(saved)this.restore(saved);else{const w=this.makeWorkspace(privateOnly?'Private browsing':'Personal',privateOnly?randomUUID():'default');w.temporary=privateOnly;this.workspaces.push(w);this.workspaceId=w.id;this.newTab();}
    this.sleepTimer=setInterval(()=>{void this.maintainTabs();},10000);
    void this.window.loadURL(APP_URL);
  }
  snapshot(): Snapshot {
    const temporary=this.workspace().temporary;const studio=resolveStudio(this.repo.settings(),this.workspaceId,this.active().state.url);
    return { performance:processMetrics(),extensions:temporary?{items:[],busy:false,error:''}:this.extensions?.snapshot(this.workspaceId)??{items:[],busy:false,error:''},ai:{config:this.aiProvider.config,keySet:this.aiProvider.keySet,answerSources:temporary?[]:this.ai.answerSources,sources:temporary?[]:this.ai.sources,preview:temporary?undefined:this.ai.preview,busy:!temporary&&this.ai.busy,answer:temporary?'':this.ai.answer,error:temporary?'':this.ai.error,cached:this.ai.cached,history:temporary?[]:this.ai.history,cacheCount:temporary?0:this.repo.aiCacheCount(this.workspaceId),learning:temporary?learningSchema.parse({}):this.repo.learning(this.workspaceId),focus:this.focus?.scope===this.workspaceId?this.focus:undefined},chromeHidden:studio.immersive&&this.chromeHidden&&this.panel==='none',sidebarCollapsed:(studio.sidebarMode==='auto'||studio.tabPosition==='auto'||studio.verticalMode==='hover')&&this.sidebarCollapsed&&this.panel==='none',system:{onBattery:powerMonitor.isOnBatteryPower(),memoryTotal:totalmem(),memoryFree:freemem(),cpuCount:cpus().length},vault:this.workspace().temporary?{...this.vault.snapshot(),locked:true,entries:[]}:this.vault.snapshot(),developer:{...this.privacy.recorder.snapshot(this.active().view?.webContents.id??-1),responsive:this.active().responsive,message:this.developerMessage},tabs: this.workspaceTabs().map(t => ({...t.state})), activeId: this.activeId, panel: this.panel, settings: this.repo.settings(), bookmarks: temporary?[]:this.repo.bookmarks(this.workspaceId), history: temporary?[]:this.repo.history('',this.workspaceId), downloads: temporary?[...this.privateDownloads.values()].filter(d=>this.downloadScopes.get(d.id)===this.workspaceId):this.repo.downloads(), platform: process.platform,workspaces:this.workspaces.map(w=>({...w,tabCount:this.workspaceTabs(w.id).length})),activeWorkspaceId:this.workspaceId,sessions:this.repo.sessions(),recoveryPending:this.recoveryPending(),privacy:this.privacySnapshot(),permissionPrompts:this.privacy.prompts(this.ownedIds()),notes:temporary?[]:this.repo.notes(this.workspaceId),readingList:temporary?[]:this.repo.readingList(this.workspaceId),article:this.article?.tabId===this.activeId&&this.article.url===this.active().state.url?this.article:undefined };
  }
  emit() {
    if (this.disposed || this.window.isDestroyed() || this.window.webContents.isDestroyed()) return;
    this.layout();
    this.changed();
    // Coalesce frequent Chromium loading/title/download events.
    if (this.broadcastTimer) return;
    this.broadcastTimer = setTimeout(() => { this.broadcastTimer = undefined; if (!this.disposed && !this.window.isDestroyed() && !this.window.webContents.isDestroyed()) this.window.webContents.send('aster:state', this.snapshot()); }, 35);
  }
  private async captureAI(selection:boolean){const tab=this.active(),wc=tab.view?.webContents,scope=this.workspaceId,url=tab.state.url;if(!wc||!isWebUrl(url))throw new Error('Open a website before capturing AI context.');const result=await wc.executeJavaScriptInIsolatedWorld(1003,[{code:'('+extractAIContent.toString()+')('+JSON.stringify(selection)+')'}]);if(this.workspaceId!==scope||this.activeId!==tab.state.id||tab.state.url!==url)throw new Error('AI page changed. Capture again.');if(!result||typeof result.text!=='string'||!result.text.trim())throw new Error('AI could not find eligible visible text. Select non-form text and try again.');this.ai.add({id:randomUUID(),title:String(result.title).slice(0,300),url:sourceURL(url),text:result.text.slice(0,20000),captured:Date.now(),annotation:''});}
  private studyBlocked(url:string,scope:string){if(!this.focus||this.focus.scope!==scope||Date.now()>=this.focus.ends)return false;try{return this.focus.blocked.includes(new URL(url).origin);}catch{return false;}}
  private finishFocus(completed:boolean){clearTimeout(this.focusTimer);if(!this.focus)return;const focus=this.focus;this.focus=undefined;const data=this.repo.learning(focus.scope);data.sessions=[...data.sessions,{started:focus.started,seconds:Math.min(10800,Math.max(0,Math.floor((Date.now()-focus.started)/1000))),completed}].slice(-100);this.repo.saveLearning(focus.scope,data);for(const tab of this.tabs)if(tab.state.error==='Study focus is blocking this website.')tab.state.error=undefined;this.emit();}
  private active() { const tab = this.tabs.find(t => t.state.id === this.activeId); if (!tab) throw new Error('Tab no longer exists.'); return tab; }
  private byId(id: string) { const tab = this.tabs.find(t => t.state.id === id); if (!tab) throw new Error('Tab no longer exists.'); return tab; }
  private destroyView(tab: LiveTab) {
    tab.responsive=undefined;tab.emulationKey=undefined;
    if(this.article?.tabId===tab.state.id)this.article=undefined;
    const view=tab.view;
    if (!view) return;
    // Detach state before native close events can re-enter layout or teardown.
    tab.view=undefined;
    const floating=this.floats.get(tab.state.id);
    if(floating){this.floats.delete(tab.state.id);if(!floating.isDestroyed()){floating.contentView.removeChildView(view);floating.destroy();}tab.state.floating=false;tab.state.alwaysOnTop=false;}
    if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
  }
  private layout() {
    if (this.disposed || this.window.isDestroyed()) return;
    const [width, height] = this.window.getContentSize();
    const settings=this.repo.settings();const geometry=chromeGeometry(settings,this.workspaceId,this.active().state.url,this.panel==='none'&&this.chromeHidden,this.panel==='none'&&this.sidebarCollapsed);const {left,right}=geometry;const chromeHeight=geometry.height;
    const split=this.workspace().split;const isSplit=split.mode!=='off';
    const rects=paneRects(width-left-right,height-chromeHeight-(isSplit?SPLIT_BAR_HEIGHT:0),split);
    for (const tab of this.tabs) if (tab.view) {
      if(this.startupPending){tab.view.setVisible(false);continue;}
      if(tab.state.floating){tab.view.setVisible(!this.studyBlocked(tab.state.url,tab.state.workspaceId)&&!this.privacy.prompts(this.ownedIds()).length);continue;}
      const index=isSplit?split.tabs.indexOf(tab.state.id):tab.state.id===this.activeId?0:-1;
      const rect=rects[Math.max(0,index)];
      tab.view.setBounds({x:left+rect.x,y:chromeHeight+(isSplit?SPLIT_BAR_HEIGHT+PANE_HEADER_HEIGHT:0)+rect.y,width:Math.max(0,rect.width),height:Math.max(0,rect.height-(isSplit?PANE_HEADER_HEIGHT:0))});
      if(tab.responsive&&!isSplit){
        const availableWidth=Math.max(1,width-left-right-24),availableHeight=Math.max(1,height-chromeHeight-54);
        const scale=Math.min(1,availableWidth/tab.responsive.width,availableHeight/tab.responsive.height);
        const previewWidth=Math.max(1,Math.floor(tab.responsive.width*scale)),previewHeight=Math.max(1,Math.floor(tab.responsive.height*scale));
        tab.view.setBounds({x:left+Math.floor((width-left-right-previewWidth)/2),y:chromeHeight+48,width:previewWidth,height:previewHeight});
        const key=JSON.stringify({...tab.responsive,scale});
        if(tab.emulationKey!==key){tab.view.webContents.enableDeviceEmulation({screenPosition:'desktop',screenSize:tab.responsive,viewPosition:{x:0,y:0},deviceScaleFactor:1,viewSize:tab.responsive,scale});tab.emulationKey=key;}
      }else if(tab.emulationKey){tab.view.webContents.disableDeviceEmulation();tab.emulationKey=undefined;}
      tab.view.setVisible(index>=0&&tab.state.workspaceId===this.workspaceId&&this.panel==='none'&&!tab.state.error&&!this.splitDragging&&!this.recoveryPending()&&!this.privacy.prompts(this.ownedIds()).length);
    }
  }
  private newTab(url = 'aster://newtab') {
    this.ai.cancel();
    if (this.tabs.length >= 100) throw new Error('The prototype supports up to 100 tabs per window.');
    const previous=this.activeId;
    const tab: LiveTab = { state: { id: randomUUID(), title: 'New tab', url: 'aster://newtab', loading: false, canGoBack: false, canGoForward: false, pinned: false, muted: false, zoom: 1, workspaceId:this.workspaceId, groupId:null,floating:false,alwaysOnTop:false } };
    this.tabs.push(tab); this.activeId = tab.state.id; this.panel = 'none';
    this.workspace().activeId=this.activeId;
    const split=this.workspace().split;if(split.mode!=='off')split.tabs[Math.max(0,split.tabs.indexOf(previous))]=this.activeId;
    if (url !== 'aster://newtab') this.navigate(tab, url);
    this.emit();return tab;
  }
  private ensureView(tab: LiveTab) {
    if (tab.view) return tab.view;
    const view = new WebContentsView({ webPreferences: { session: this.sessionFor(tab.state.workspaceId), preload:path.join(__dirname,'../preload/content.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, plugins:true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false } });
    view.setVisible(false);
    tab.view = view; this.window.contentView.addChildView(view);
    const wc = view.webContents;
    this.privacy.register(wc,this.scope(tab.state.workspaceId));
    wc.setAudioMuted(tab.state.muted);
    wc.setZoomFactor(tab.state.zoom);
    // Chromium can focus a renderer while it loads. Only real input changes the
    // selected pane, otherwise a background load can redirect omnibox commands.
    const activateFromInput=()=>{if(tab.state.workspaceId===this.workspaceId&&this.panel==='none'&&this.activeId!==tab.state.id){this.ai.cancel();this.activeId=tab.state.id;this.workspace().activeId=this.activeId;this.emit();}};
    let lastUserInput=0;
    wc.on('before-mouse-event',(_event,input)=>{if(input.type==='mouseDown'){lastUserInput=Date.now();activateFromInput();}});
    const sync = () => {
      if (wc.isDestroyed()) return;
      tab.state.canGoBack = wc.navigationHistory.canGoBack(); tab.state.canGoForward = wc.navigationHistory.canGoForward();
      tab.state.loading = wc.isLoading(); tab.state.zoom = wc.getZoomFactor(); this.emit();
    };
    wc.once('destroyed',()=>this.popupTimes.delete(wc.id));
    wc.setWindowOpenHandler(details => {
      const times=(this.popupTimes.get(wc.id)??[]).filter(time=>Date.now()-time<30000);
      const userOpened=Date.now()-lastUserInput<1000&&(details.disposition==='foreground-tab'||details.disposition==='background-tab');
      if(!documentNavigation(details.url,wc.getURL(),this.approvedDocuments)||details.postBody||(!userOpened&&originOf(details.referrer.url)!==originOf(wc.getURL()))||(!userOpened&&times.length>=3)){this.privacy.record(wc.id,'popupsBlocked');return {action:'deny'};}
      times.push(Date.now());this.popupTimes.set(wc.id,times);
      if(siteBlob(details.url,wc.getURL()))this.approvedDocuments.add(documentKey(details.url));
      if(userOpened){try{this.switchWorkspace(tab.state.workspaceId);this.newTab(details.url);}catch{this.privacy.record(wc.id,'popupsBlocked');}return {action:'deny'};}

      this.privacy.ask(wc,['popups'],allow=>{if(allow&&!wc.isDestroyed()){try{this.switchWorkspace(tab.state.workspaceId);this.newTab(details.url);}catch{this.privacy.record(wc.id,'popupsBlocked');}}else this.privacy.record(wc.id,'popupsBlocked');});return {action:'deny'};
    });
    wc.on('will-navigate', (event, url) => { if (!documentNavigation(url,wc.getURL(),this.approvedDocuments)||this.studyBlocked(url,tab.state.workspaceId)) event.preventDefault(); });
    wc.on('will-redirect', (event, url) => {this.privacy.record(wc.id,'redirects'); if (!documentNavigation(url,wc.getURL(),this.approvedDocuments)||this.studyBlocked(url,tab.state.workspaceId)) event.preventDefault(); });
    wc.on('did-start-navigation',(_event,_url,inPlace,main)=>{if(main&&!inPlace){this.privacy.reset(wc.id);if(this.activeId===tab.state.id){this.commandGeneration++;this.ai.cancel();}if(this.article?.tabId===tab.state.id)this.article=undefined;}});
    wc.on('will-frame-navigate', event => { if (!(event.isMainFrame?documentNavigation(event.url,wc.getURL(),this.approvedDocuments):documentFrame(event.url,wc.getURL(),this.approvedDocuments))) event.preventDefault(); });
    wc.on('did-start-loading', () => { tab.state.error = undefined; sync(); });
    wc.on('did-stop-loading', sync);
    wc.on('did-navigate', (_e, url) => { tab.state.url = url; tab.state.error = undefined; sync(); });
    wc.on('did-navigate-in-page', (_e, url, main) => { if (main) { tab.state.url = url; sync(); } });
    wc.on('page-title-updated', (_e, title) => { tab.state.title = title.slice(0,500); this.emit(); });
    wc.on('did-finish-load', () => {
      if (!this.workspace(tab.state.workspaceId).temporary && this.repo.settings().recordHistory && this.workspace(tab.state.workspaceId).recordHistory && isWebUrl(wc.getURL())) this.repo.visit(wc.getTitle() || wc.getURL(), wc.getURL(),tab.state.workspaceId);
      sync();
    });
    wc.on('did-fail-load', (_e, code, _description, _url, main) => { if (main && code !== -3) { tab.state.error = code === -200 || code === -202 || code === -201 ? 'The site’s certificate could not be verified. Aster did not bypass this check.' : 'This page could not be loaded. Check the address and your connection, then try again.'; tab.state.loading = false; this.emit(); } });
    wc.on('render-process-gone', () => { tab.state.error = 'This tab stopped responding. Reload to continue.'; tab.state.loading = false; this.emit(); });
    wc.on('before-input-event', (e, input) => {if(input.type==='keyDown')lastUserInput=Date.now();activateFromInput();this.shortcut(e, input);});
    wc.on('context-menu', (_event, params) => {
      const template: Electron.MenuItemConstructorOptions[] = [];
      if (isWebUrl(params.linkURL)) template.push({label: 'Open link in new tab', click: () => this.newTab(params.linkURL)});
      if(documentNavigation(params.linkURL,wc.getURL(),this.approvedDocuments))template.push({label:'Save link as?',click:()=>wc.downloadURL(params.linkURL)},{label:'Copy link address',click:()=>clipboard.writeText(params.linkURL)});
      if(params.mediaType==='image'&&documentNavigation(params.srcURL,wc.getURL(),this.approvedDocuments))template.push({label:'Save image as?',click:()=>wc.downloadURL(params.srcURL)});
      if (params.isEditable) template.push({role:'undo'}, {role:'redo'}, {type:'separator'}, {role:'cut'}, {role:'copy'}, {role:'paste'}, {role:'selectAll'});
      else if (params.selectionText) template.push({role:'copy'}, {label:'Search selected text', click: () => this.newTab(resolveInput(params.selectionText.slice(0,8192), this.repo.settings().searchEngine))});
      if(params.selectionText&&!params.isEditable&&!this.workspace(tab.state.workspaceId).temporary)template.push({label:'Preview selected text for AI',click:()=>{this.selectTab(tab.state.id);void this.command({type:'ai-capture',selection:true});}});
      template.push({type:'separator'}, {label:'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack()}, {label:'Reload', click: () => wc.reload()}, {label:'Inspect element', click: () => wc.inspectElement(params.x,params.y)});
      Menu.buildFromTemplate(template).popup({window:this.window});
    });
    return view;
  }
  private loadEpoch=new WeakMap<LiveTab,number>();
  private loadWithExtensions(tab:LiveTab,url:string){const wc=tab.view!.webContents,epoch=(this.loadEpoch.get(tab)??0)+1;this.loadEpoch.set(tab,epoch);const ready=this.workspace(tab.state.workspaceId).temporary?Promise.resolve():this.extensions?.attach(tab.state.workspaceId,wc.session)??Promise.resolve();void ready.then(()=>{if(!wc.isDestroyed()&&tab.view?.webContents===wc&&this.loadEpoch.get(tab)===epoch&&tab.state.url===url)return wc.loadURL(url);}).catch(()=>{});}
  private navigate(tab: LiveTab, input: string) {
    this.ai.cancel();
    this.chromeHidden=false;this.sidebarCollapsed=false;
    const url = this.approvedDocuments.has(documentKey(input))?input:resolveInput(input, this.repo.settings().searchEngine);if(this.studyBlocked(url,tab.state.workspaceId))throw new Error('Study focus is blocking this website. Stop the timer in Study mode to continue.');
    tab.state.error = undefined; this.panel = 'none';
    if(settingsPanel(url)){this.destroyView(tab);Object.assign(tab.state,{url,title:settingsPanel(url)==='performance'?'Performance':settingsPanel(url)==='studio'?'Theme Studio':settingsPanel(url)==='extensions'?'Extensions':'Settings',loading:false,canGoBack:false,canGoForward:false});this.emit();return;}
    if (url === 'aster://newtab') { this.destroyView(tab); Object.assign(tab.state, {url, title:'New tab', loading:false, canGoBack:false, canGoForward:false}); this.emit(); return; }
    const view = this.ensureView(tab); tab.state.url = url; tab.state.title = new URL(url).hostname; tab.state.loading = true;
    this.loadWithExtensions(tab,url); this.emit();
  }
  private shortcut(event: Electron.Event, input: Input) {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta; const key = input.key.toLowerCase();
    let command: Command | undefined; let action = '';
    if (mod && key === 'l') {this.chromeHidden=false;this.emit();action = 'address';}
    else if (mod && key === 'k') command={type:'panel',value:'palette'};
    else if (key==='f9') command={type:'panel',value:this.panel==='reader'?'none':'reader'};
    else if (mod && key === 't') command = {type: input.shift ? 'restore-tab':'new-tab'};
    else if (mod && key === 'w') command = {type:'close-tab',id:this.activeId};
    else if (mod && key === 'r') command = {type:'reload'};
    else if (mod && key === 'd') command = {type:'bookmark'};
    else if (mod && key === 'h') command = {type:'panel',value:'history'};
    else if (mod && key === 'j') command = {type:'panel',value:'downloads'};
    else if (mod && key === 'b') {const settings=this.repo.settings();command = {type:'settings',value:{...settings,sidebarVisible:!(settings.sidebarVisible||settings.tabLayout==='vertical'),tabLayout:'horizontal'}};}
    else if (mod && input.shift && key === 's') command={type:'split-set',mode:this.workspace().split.mode==='off'?'columns':'off'};
    else if (mod && key === 'f') { this.panel = 'none'; action = 'find'; }
    else if (mod && key === 'n') command = {type:input.shift?'private-window':'new-window'};
    else if (mod && key === 'o') command={type:'open-file'};
    else if (mod && key === 's') command={type:'save-page'};
    else if (mod && key === 'p') command = {type:'print'};
    else if (mod && ['+','=','-','0'].includes(key)) command = {type:'zoom',delta:key==='0'?0:key==='-'?-0.1:0.1};
    else if (input.alt && key === 'arrowleft') command = {type:'back'};
    else if (input.alt && key === 'arrowright') command = {type:'forward'};
    else if (key === 'f5') command = {type:'reload'};
    else if (key === 'f11') command = {type:'fullscreen'};
    else if (key === 'f12') command = {type:'devtools'};
    else if (mod && key === 'tab') { const tabs=this.workspaceTabs();const i=tabs.findIndex(t=>t.state.id===this.activeId); command={type:'select-tab',id:tabs[(i+(input.shift?-1:1)+tabs.length)%tabs.length].state.id}; }
    if (command || action) { event.preventDefault(); if (command) void this.command(command); if (action) { this.window.webContents.focus(); this.window.webContents.send('aster:shortcut',action); } }
  }
  private workspace(id=this.workspaceId){const w=this.workspaces.find(w=>w.id===id);if(!w)throw new Error('Workspace no longer exists.');return w;}
  private scope(id=this.workspaceId){return {id,temporary:this.workspace(id).temporary};}
  private ownedIds(){return this.tabs.flatMap(t=>t.view?[t.view.webContents.id]:[]);}
  private privacySnapshot():PrivacySnapshot{
    const tab=this.active();const scope=this.scope();const origin=originOf(tab.state.url);
    return {origin,automaticCompatibility:this.privacy.automaticCompatibility(tab.state.url),temporary:scope.temporary,mode:this.privacy.mode(scope,tab.state.url),exception:this.privacy.exception(scope,origin),stats:this.privacy.getStats(tab.view?.webContents.id),permissions:this.privacy.permissions(scope,origin),filters:this.privacy.filters,cookies:this.cookieContext===`${scope.id}|${origin}`?this.cookieRows:[],cookiesLoaded:this.cookieContext===`${scope.id}|${origin}`,receipt:this.receipt};
  }
  private async refreshCookies(){const tab=this.active();const origin=originOf(tab.state.url);const scope=this.workspaceId;this.cookieKeys.clear();this.cookieRows=[];this.cookieContext='';if(!origin)return;const cookies=await this.sessionFor(scope).cookies.get({url:origin});if(scope!==this.workspaceId||origin!==originOf(this.active().state.url))return;this.cookieContext=`${scope}|${origin}`;this.cookieRows=cookies.slice(0,200).map(cookie=>{const id=randomUUID();this.cookieKeys.set(id,cookie);return {id,name:cookie.name,domain:cookie.domain??new URL(origin).hostname,path:cookie.path??'/',secure:!!cookie.secure,httpOnly:!!cookie.httpOnly,session:!!cookie.session};});}
  private async cleanTemporary(id:string){
    this.retiredTemporary.add(id);
    for(const [downloadId,scope]of this.downloadScopes)if(scope===id){this.items.get(downloadId)?.cancel();this.privateDownloads.delete(downloadId);this.downloadScopes.delete(downloadId);}
    const browsing=this.sessions.get(id);this.privacy.clearTemporary(id);if(!browsing)return {cookies:0,cleared:true,message:'Temporary session closed. No website storage was created.'};
    browsing.removeListener('will-download',this.onDownload);
    try{const cookies=(await browsing.cookies.get({})).length;await browsing.closeAllConnections();await browsing.clearStorageData();await browsing.clearCache();const cleared=(await browsing.cookies.get({})).length===0;this.sessions.delete(id);return {cookies,cleared,message:cleared?'Temporary cookies and website storage cleared. Downloaded files remain on disk.':'Some temporary cookies remain. Close Aster to discard this memory-only session.'};}catch{return {cookies:0,cleared:false,message:'Cleanup could not be confirmed. Close Aster to discard this memory-only session.'};}
  }
  private async closeWorkspace(id:string){
    const w=this.workspace(id);if(this.workspaces.length===1&&!w.temporary)throw new Error('Keep at least one workspace.');
    for(const t of this.workspaceTabs(id))this.destroyView(t);this.tabs=this.tabs.filter(t=>t.state.workspaceId!==id);this.workspaces=this.workspaces.filter(w=>w.id!==id);
    if(!this.workspaces.length){const fresh=this.makeWorkspace('Private browsing');fresh.temporary=true;this.workspaces.push(fresh);this.workspaceId=fresh.id;this.newTab();}else if(this.workspaceId===id)this.switchWorkspace(this.workspaces[0].id);
    if(w.temporary){this.receipt=await this.cleanTemporary(id);this.panel='privacy';}this.cookieContext='';
  }
  private workspaceTabs(id=this.workspaceId){return this.tabs.filter(t=>t.state.workspaceId===id);}
  private makeWorkspace(name:string,id:string=randomUUID()):WorkspaceInfo{return {id,name,color:'forest',theme:'inherit',recordHistory:true,activeId:'',groups:[],split:emptySplit(),tabCount:0,temporary:false};}
  private sessionFor(id:string){
    let browsing=this.sessions.get(id);if(browsing)return browsing;
    const temporary=this.workspace(id).temporary;
    browsing=session.fromPartition(temporary?`aster-temporary-${id}`:partitionFor(id),{cache:!temporary});
    this.privacy.attach(browsing,this.scope(id));
    if(!temporary)void this.extensions?.attach(id,browsing);
    browsing.on('will-download',this.onDownload);
    this.sessions.set(id,browsing);return browsing;
  }
  serialize():WindowSession|undefined{
    const durable=this.workspaces.filter(w=>!w.temporary);if(!durable.length)return;
    return {version:2,id:this.windowId,activeWorkspaceId:durable.some(w=>w.id===this.workspaceId)?this.workspaceId:durable[0].id,workspaces:durable.map(w=>{
      const {tabCount,temporary,...data}=w;
      return {...data,tabs:this.workspaceTabs(w.id).map(({state:t})=>({id:t.id,title:isWebUrl(t.url)||t.url.startsWith('aster://')?t.title:'New tab',url:isWebUrl(t.url)||t.url.startsWith('aster://')?t.url:'aster://newtab',pinned:t.pinned,muted:t.muted,zoom:t.zoom,groupId:t.groupId}))};
    })};
  }
  private restore(value:WindowSession){
    this.panel='none';
    const saved=windowSessionSchema.parse(value);this.windowId=saved.id;this.workspaceId=saved.activeWorkspaceId;
    this.workspaces=saved.workspaces.map(({tabs,...w})=>({...w,tabCount:tabs.length,temporary:false}));
    this.tabs=saved.workspaces.flatMap(w=>w.tabs.map(t=>({state:{...t,workspaceId:w.id,loading:false,canGoBack:false,canGoForward:false,floating:false,alwaysOnTop:false}})));
    this.activeId=this.workspace().activeId;this.wakeVisible();
  }
  replaceSession(saved:WindowSession){this.ai.clear();this.finishFocus(false);for(const tab of this.tabs)this.destroyView(tab);this.restore(saved);this.emit();}
  private wake(tab:LiveTab){tab.lastActive=Date.now();tab.state.sleeping=false;if(!tab.view&&isWebUrl(tab.state.url)){const view=this.ensureView(tab);tab.state.loading=true;this.loadWithExtensions(tab,tab.state.url);}}
  private wakeVisible(){const w=this.workspace();const visible=w.split.mode==='off'?[w.activeId]:w.split.tabs;for(const id of visible)this.wake(this.byId(id));}
  private selectTab(id:string){
    this.ai.cancel();const tab=this.byId(id);if(tab.state.workspaceId!==this.workspaceId)this.switchWorkspace(tab.state.workspaceId);
    const w=this.workspace();
    if(w.split.mode!=='off'&&!w.split.tabs.includes(id)){const old=w.split.tabs.indexOf(this.activeId);w.split.tabs[Math.max(0,old)]=id;}
    this.activeId=id;w.activeId=id;this.panel='none';
    if(tab.state.groupId){const group=w.groups.find(g=>g.id===tab.state.groupId);if(group)group.collapsed=false;}
    this.wake(tab);this.floats.get(id)?.focus();
  }
  private switchWorkspace(id:string){
    this.ai.clear();
    this.chromeHidden=false;this.sidebarCollapsed=false;
    this.workspace(id);this.workspaceId=id;this.activeId=this.workspace().activeId;this.panel='none';this.splitDragging=false;this.wakeVisible();
  }
  private repairWorkspace(id:string){
    const w=this.workspace(id);const tabs=this.workspaceTabs(id);
    if(!tabs.length){const current=this.workspaceId;this.workspaceId=id;this.newTab();this.workspaceId=current;}
    const remaining=this.workspaceTabs(id);
    if(!remaining.some(t=>t.state.id===w.activeId))w.activeId=remaining[0].state.id;
    if(w.split.tabs.some(id=>!remaining.some(t=>t.state.id===id)))w.split=emptySplit();
    this.activeId=this.workspace().activeId;
  }
  private moveTab(id:string,targetId:string){
    const tab=this.byId(id);this.workspace(targetId);const from=tab.state.workspaceId;if(from===targetId)return;
    if(this.workspace(from).temporary||this.workspace(targetId).temporary)throw new Error('Private tabs cannot move between containers. Open the address separately instead.');
    if(this.workspaceTabs(from).length===1&&this.tabs.length>=100)throw new Error('The prototype needs room for a replacement tab in the source workspace.');
    this.destroyView(tab);tab.state.workspaceId=targetId;tab.state.groupId=null;tab.state.canGoBack=false;tab.state.canGoForward=false;
    this.repairWorkspace(from);this.wakeVisible();
  }
  private setSplit(mode:WorkspaceInfo['split']['mode']){
    const w=this.workspace();const count=splitCount(mode);
    if(count)for(const tab of this.workspaceTabs())tab.responsive=undefined;
    if(!count){w.split=emptySplit();this.wakeVisible();return;}
    const active=this.activeId;const ids=[active,...w.split.tabs.filter(id=>id!==active),...this.workspaceTabs().map(t=>t.state.id).filter(id=>id!==active)];
    const unique=[...new Set(ids)].slice(0,count);
    if(this.tabs.length+Math.max(0,count-unique.length)>100)throw new Error('The prototype supports up to 100 tabs per window.');
    while(unique.length<count)unique.push(this.newTab().state.id);
    w.activeId=active;this.activeId=active;w.split={...w.split,mode,tabs:unique};this.panel='none';this.wakeVisible();
  }
  private floatTab(id:string){
    const tab=this.byId(id);if(tab.responsive){tab.responsive=undefined;tab.emulationKey=undefined;tab.view?.webContents.disableDeviceEmulation();}if(!isWebUrl(tab.state.url))throw new Error('Open a website before floating this tab.');
    if(this.floats.has(id)){this.floats.get(id)!.focus();return;}
    this.wake(tab);const view=tab.view!;
    const mini=new BrowserWindow({icon:path.join(__dirname,'icons',process.platform==='win32'?'aster.ico':'aster.png'),width:520,height:460,minWidth:280,minHeight:220,title:tab.state.title,autoHideMenuBar:true,backgroundColor:'#f6f5f1',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
    mini.webContents.setWindowOpenHandler(()=>({action:'deny'}));mini.webContents.on('will-navigate',e=>e.preventDefault());
    this.window.contentView.removeChildView(view);mini.contentView.addChildView(view);this.floats.set(id,mini);tab.state.floating=true;
    const resize=()=>{const [width,height]=mini.getContentSize();view.setBounds({x:0,y:0,width,height});view.setVisible(true);};resize();mini.on('resize',resize);
    mini.on('close',()=>{if(this.floats.get(id)!==mini)return;this.floats.delete(id);mini.contentView.removeChildView(view);tab.state.floating=false;tab.state.alwaysOnTop=false;if(!this.disposed&&!this.window.isDestroyed()&&!view.webContents.isDestroyed()){this.window.contentView.addChildView(view);this.emit();}});
  }
  private async openDocument(file:string){
    if(!previewExtensions.has(path.extname(file).toLowerCase()))throw new Error('File type is not supported for preview.');
    if(!(await stat(file).catch(()=>undefined))?.isFile())throw new Error('File was moved or deleted.');
    if(this.disposed)return;
    const url=pathToFileURL(file).href;this.approvedDocuments.add(documentKey(url));
    const tab=this.newTab(url);tab.state.title=path.basename(file);this.emit();
  }
  private onDownload = (event: Electron.Event, item: DownloadItem, source: Electron.WebContents) => {
    const owner=this.tabs.find(t=>t.view?.webContents===source);if(!owner)return;
    if(this.disposed){event.preventDefault();return;}
    const id = randomUUID(); this.items.set(id,item);
    const scope=owner.state.workspaceId;const temporary=this.workspace(scope).temporary;this.downloadScopes.set(id,scope);
    const d: Download = {id, filename:item.getFilename(), url:item.getURL(), path:'', received:0, total:item.getTotalBytes(), state:'progressing', started_at:Date.now()};
    // With no setSavePath, Electron presents a native save dialog.
    let lastWrite = 0;
    const save=()=>{if(temporary){if(!this.retiredTemporary.has(scope))this.privateDownloads.set(id,{...d});}else this.repo.saveDownload(d);};
    const update = (force=false) => { if(this.disposed)return;d.path=item.getSavePath(); if(d.path)d.filename=path.basename(d.path); d.received=item.getReceivedBytes(); d.total=item.getTotalBytes(); if(force || Date.now()-lastWrite>300) { lastWrite=Date.now(); save(); this.emit(); } };
    save(); this.emit();
    item.on('updated', (_e,state) => { if(this.disposed)return;d.state=item.isPaused()?'paused':state; update(); });
    item.once('done', (_e,state) => { d.state=state; update(true); this.items.delete(id); });
  };
  async command(c: Command): Promise<{ok:boolean;error?:string}> {
    if(this.disposed||this.window.isDestroyed())return {ok:false,error:'This browser window has closed.'};
    const generation=++this.commandGeneration;
    try {
      const tab = this.active(); const wc = tab.view?.webContents;
      if(c.type.startsWith('vault-')&&c.type!=='vault-lock'&&this.workspace().temporary)throw new Error('Private containers cannot access the password vault.');
      if(this.workspace().temporary&&(/^(ai-|research-|study-|learning-)/.test(c.type))&&!['ai-cancel','ai-clear'].includes(c.type))throw new Error('Private containers cannot use AI or save research/study data.');
      if(c.type.startsWith('extension-')&&this.workspace().temporary)throw new Error('Extension management is unavailable in private containers.');
      switch(c.type) {
        case 'extension-choose': {const scope=this.workspaceId;const result=await dialog.showOpenDialog(this.window,{title:'Choose an unpacked extension folder',properties:['openDirectory']});if(!result.canceled&&result.filePaths[0]&&this.workspaceId===scope){await this.extensions?.attach(scope,this.sessionFor(scope));this.extensions?.prepare(scope,result.filePaths[0]);}break;}
        case 'extension-reload-pages': for(const target of this.workspaceTabs()){const contents=target.view?.webContents;if(contents&&!contents.isDestroyed()&&isWebUrl(target.state.url))contents.reload();}break;
        case 'extension-cancel': this.extensions?.cancel(this.workspaceId);break;
        case 'extension-install': await this.extensions?.install(this.workspaceId,c.id);break;
        case 'extension-change': await this.extensions?.change(this.workspaceId,c.id,c.action);break;
        case 'extension-toolbar': {
 const scope=this.workspaceId;await this.extensions?.attach(scope,this.sessionFor(scope));if(scope!==this.workspaceId)break;
 const items=this.extensions?.snapshot(scope).items.filter(item=>item.loaded&&item.popup)??[];
 const originTab=this.active(),target=isWebUrl(originTab.state.url)?originTab.view?.webContents:undefined;
 const open=(item:typeof items[number])=>{this.extensions?.open(scope,item.id,'popup',this.window,item.volumeAdapter?target:undefined,{x:c.x,y:c.y});};
 if(items.length===1){open(items[0]);break;}
 const bounds=this.window.getContentBounds();Menu.buildFromTemplate([
 ...items.map(item=>({label:item.name,click:()=>{try{open(item);}catch(error){void dialog.showMessageBox(this.window,{type:'info',message:error instanceof Error?error.message:'Extension could not open.'});}}})),
 ...(items.length?[{type:'separator' as const}]:[{label:'No enabled extension controls',enabled:false}]),
 {label:'Manage extensions',click:()=>{void this.command({type:'panel',value:'extensions'});}}
 ]).popup({window:this.window,x:bounds.x+Math.min(c.x,bounds.width),y:bounds.y+Math.min(c.y,bounds.height)});break;
 }
 case 'extension-open': {const target=c.tabId?this.byId(c.tabId):undefined;if(target&&(target.state.workspaceId!==this.workspaceId||!isWebUrl(target.state.url)||!target.view))throw Error('Extension audio target must be an awake website in this workspace.');this.extensions?.open(this.workspaceId,c.id,c.page,this.window,target?.view?.webContents);break;}
        case 'chrome-state': if(c.toolbar!==undefined)this.chromeHidden=c.toolbar;if(c.sidebar!==undefined)this.sidebarCollapsed=c.sidebar;break;
        case 'ai-configure': this.aiProvider.configure(c.value,c.key);this.ai.cancel();break;
        case 'ai-capture': await this.captureAI(c.selection);this.panel='ai';break;
        case 'ai-source-edit': {const source=this.ai.sources.find(s=>s.id===c.id);if(source){source.text=c.text;this.ai.cancel();this.ai.history=[];}break;}
        case 'ai-source-remove': this.ai.sources=this.ai.sources.filter(s=>s.id!==c.id);this.ai.cancel();this.ai.history=[];break;
        case 'ai-preview': this.ai.prepare(c.action,c.prompt,c.sources);break;
        case 'ai-send': await this.ai.send(c.id,this.workspaceId,c.cache);break;
        case 'ai-cancel': this.ai.cancel();break;
        case 'ai-clear': this.ai.clear();break;
        case 'ai-cache-clear': this.repo.clearAICache(this.workspaceId);break;
        case 'ai-save-note': if(this.ai.answer)this.repo.saveNote(this.workspaceId,undefined,'AI reading notes',this.ai.answer.slice(0,18000)+'\n\nSources:\n'+this.ai.answerSources.map((s,i)=>`[S${i+1}] ${s.title}: ${s.url}`).join('\n'));break;
        case 'research-source': {const learning=this.repo.learning(this.workspaceId);if(c.action==='load'){const source=learning.sources.find(s=>s.id===c.id);if(source)this.ai.add({...source,id:randomUUID()});this.panel='ai';}else{if(c.action==='save'){const source=this.ai.sources.find(s=>s.id===c.id);if(source&&!learning.sources.some(s=>s.id===source.id))learning.sources.push(source);}else learning.sources=learning.sources.filter(s=>s.id!==c.id);this.repo.saveLearning(this.workspaceId,learning);}break;}
        case 'research-annotate': {const data=this.repo.learning(this.workspaceId);const source=data.sources.find(s=>s.id===c.id);if(source)source.annotation=c.text;this.repo.saveLearning(this.workspaceId,data);break;}
        case 'research-export': {const data=this.repo.learning(this.workspaceId);const text='# Research notes\n\n'+data.sources.map((s,i)=>`## [S${i+1}] ${s.title}\n${s.url}\nCaptured: ${new Date(s.captured).toISOString()}\n\n${s.text}\n\nNotes: ${s.annotation}`).join('\n\n')+'\n\n'+this.repo.notes(this.workspaceId).map(n=>`## ${n.title}\n${n.body}`).join('\n\n');const result=await dialog.showSaveDialog(this.window,{defaultPath:'aster-research.md',filters:[{name:'Markdown notes',extensions:['md']}]});if(!result.canceled&&result.filePath)await writeFile(result.filePath,text,'utf8');break;}
        case 'study-card-save': {const data=this.repo.learning(this.workspaceId);const index=data.cards.findIndex(card=>card.id===c.card.id);if(index>=0)data.cards[index]=c.card;else data.cards.push(c.card);this.repo.saveLearning(this.workspaceId,data);break;}
        case 'study-card': {const data=this.repo.learning(this.workspaceId);if(c.action==='delete')data.cards=data.cards.filter(card=>card.id!==c.id);else{const card=data.cards.find(card=>card.id===c.id);if(card)card.reviews++;}this.repo.saveLearning(this.workspaceId,data);break;}
        case 'study-focus': {this.finishFocus(false);if(c.minutes){this.focus={started:Date.now(),ends:Date.now()+c.minutes*60000,blocked:c.blocked,scope:this.workspaceId};this.focusTimer=setTimeout(()=>this.finishFocus(true),c.minutes*60000);for(const current of this.workspaceTabs()){if(this.studyBlocked(current.state.url,current.state.workspaceId)){current.view?.webContents.stop();current.state.error='Study focus is blocking this website.';}}}break;}
        case 'learning-workspace': {if(this.workspaces.length>=20||this.tabs.length>=100)throw new Error('The prototype workspace limit was reached.');const workspace=this.makeWorkspace(c.kind==='research'?'Research':'Study');this.workspaces.push(workspace);this.ai.clear();this.workspaceId=workspace.id;this.newTab();this.panel=c.kind;break;}
        case 'wallpaper-asset-import': await importAsset(this.window,this.repo,c.kind);break;
        case 'wallpaper-asset-remove': await removeAsset(this.repo,c.id);break;
        case 'vault-create': await this.vault.create(c.master);break;
        case 'vault-unlock': await this.vault.unlock(c.master);break;
        case 'vault-device-unlock': await this.vault.unlock();break;
        case 'vault-lock': this.vault.lock();await this.secrets.clear();break;
        case 'vault-save': this.vault.save(c.entry);break;
        case 'vault-delete': this.vault.remove(c.id);break;
        case 'vault-copy': await this.secrets.copy(this.vault.get(c.id).password,this.repo.settings().secretClipboardSeconds);break;
        case 'vault-device': await this.vault.remember(c.enabled);break;
        case 'vault-change-master': await this.vault.changeMaster(c.master);break;
        case 'vault-fill': {
          const entry=this.vault.get(c.id);
          if(!wc||originOf(wc.getURL())!==entry.origin)throw new Error('Vault fill requires the exact saved HTTPS origin.');
          const filled=await wc.executeJavaScriptInIsolatedWorld(1002,[{code:'('+fillLogin.toString()+')('+JSON.stringify({origin:entry.origin,username:entry.username,password:entry.password})+')'}]);
          if(!filled)throw new Error('Vault could not find one visible, same-origin POST login form.');this.panel='none';break;
        }
        case 'vault-export': {const encrypted=this.vault.exportEncrypted();const result=await dialog.showSaveDialog(this.window,{defaultPath:'aster-vault.encrypted.json',filters:[{name:'Encrypted vault backup',extensions:['json']}]});if(!result.canceled&&result.filePath)await writeFile(result.filePath,encrypted,{mode:0o600});break;}
        case 'vault-import': {const result=await dialog.showOpenDialog(this.window,{properties:['openFile'],filters:[{name:'Encrypted vault backup',extensions:['json']}]});if(!result.canceled&&result.filePaths[0]){const file=result.filePaths[0];if((await stat(file)).size>4000000)throw new Error('Vault backup is too large.');await this.vault.importEncrypted(await readFile(file,'utf8'),c.master);}break;}
        case 'wallpaper-import': await importWallpaper(this.window,this.repo);break;
        case 'wallpaper-remove': await removeWallpaper(this.repo);break;
        case 'inspector-record': if(!wc)throw new Error('Open a website before recording requests.');this.privacy.recorder.set(wc.id,c.enabled);break;
        case 'inspector-clear': if(wc)this.privacy.recorder.clear(wc.id);break;
        case 'responsive': if(!wc)throw new Error('Open a website to preview its layout.');if(c.size&&(tab.state.floating||this.workspace().split.mode!=='off'))throw new Error('Open a docked tab outside split view for responsive preview.');tab.responsive=c.size??undefined;this.panel='none';break;
        case 'json-copy': await clipboard.writeText(c.text);this.developerMessage='JSON output copied to clipboard.';break;
        case 'screenshot': {
          if(!wc||!isWebUrl(tab.state.url))throw new Error('Open a website to capture a screenshot.');
          if(this.screenshotBusy)break;this.screenshotBusy=true;
          try{const image=await wc.capturePage(undefined,{stayHidden:true});if(image.isEmpty())throw new Error('Open a visible page before capturing.');
            if(c.action==='copy'){await clipboard.write([new ClipboardItem({'image/png':new Blob([new Uint8Array(image.toPNG())],{type:'image/png'})})]);this.developerMessage='Viewport image copied to clipboard.';}
            else{const result=await dialog.showSaveDialog(this.window,{defaultPath:'aster-screenshot.png',filters:[{name:'PNG image',extensions:['png']}]});if(!result.canceled&&result.filePath){await writeFile(result.filePath,image.toPNG());this.developerMessage='Viewport screenshot saved as PNG.';}else this.developerMessage='Screenshot save canceled.';}
          }finally{this.screenshotBusy=false;}break;
        }
        case 'theme-export': {const result=await dialog.showSaveDialog(this.window,{defaultPath:'aster.theme.json',filters:[{name:'Aster theme',extensions:['theme.json']}]});if(!result.canceled&&result.filePath)await writeFile(result.filePath,JSON.stringify(c.value,null,2),'utf8');break;}
        case 'settings-patch': if(this.workspace().temporary&&(c.value.tasks!==undefined||c.value.siteStudios!==undefined))throw new Error('Private containers cannot save tasks or website profiles.');if(c.value.workspaceStudios&&this.workspaces.some(w=>w.temporary&&Object.hasOwn(c.value.workspaceStudios!,w.id)))throw new Error('Private workspace styling cannot be saved.');this.repo.setSettings({...this.repo.settings(),...c.value});if(c.value.vaultLockMinutes!==undefined)this.vault.refreshTimeout();break;
        case 'note-save': if(this.workspace().temporary)throw new Error('Private notes cannot be saved.');this.repo.saveNote(this.workspaceId,c.id,c.title,c.body);break;
        case 'note-delete': this.repo.deleteNote(this.workspaceId,c.id);break;
        case 'reading-add': if(this.workspace().temporary)throw new Error('Private pages cannot be saved to the reading list.');if(isWebUrl(tab.state.url))this.repo.addReading(this.workspaceId,tab.state.title,tab.state.url);break;
        case 'reading-mark': this.repo.markReading(this.workspaceId,c.id,c.read);break;
        case 'reading-delete': this.repo.deleteReading(this.workspaceId,c.id);break;
        case 'new-tab': this.newTab(c.url); break;
        case 'navigate': this.navigate(tab,c.input); break;
        case 'sleep-tab': if(!await this.sleepTab(this.byId(c.id)))throw new Error('Tab is protected or in use and cannot sleep.');break;
        case 'select-tab': this.selectTab(c.id); break;
        case 'close-tab': { const target=this.byId(c.id);if(target.state.id===this.activeId)this.panel='none'; const workspaceId=target.state.workspaceId;const temporary=this.workspace(workspaceId).temporary;if(temporary&&this.workspaceTabs(workspaceId).length===1){await this.closeWorkspace(workspaceId);break;}if(!temporary){this.closed.push(target.state.url);this.closed=this.closed.slice(-30);}this.destroyView(target); this.tabs.splice(this.tabs.indexOf(target),1);this.repairWorkspace(workspaceId);this.wakeVisible();break; }
        case 'duplicate-tab': {const target=this.byId(c.id);this.switchWorkspace(target.state.workspaceId);this.newTab(target.state.url);break;}
        case 'restore-tab': {const url=this.closed.pop(); if(url) this.newTab(url); break;}
        case 'pin-tab': {const t=this.byId(c.id); t.state.pinned=!t.state.pinned; this.tabs.sort((a,b)=>Number(b.state.pinned)-Number(a.state.pinned)); break;}
        case 'mute-tab': {const t=this.byId(c.id); t.state.muted=!t.state.muted; t.view?.webContents.setAudioMuted(t.state.muted); break;}
        case 'reorder-tab': { const from=this.byId(c.id); const to=this.byId(c.target); if(from===to||from.state.pinned!==to.state.pinned||from.state.workspaceId!==to.state.workspaceId) break; const targetIndex=this.tabs.indexOf(to);this.tabs.splice(this.tabs.indexOf(from),1); this.tabs.splice(targetIndex,0,from);from.state.groupId=to.state.groupId;break; }
        case 'back': if(wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
        case 'forward': if(wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
        case 'reload': if(wc) {tab.state.error=undefined; wc.reload();} break;
        case 'stop': wc?.stop(); break;
        case 'home': this.navigate(tab,this.repo.settings().home); break;
        case 'bookmark': if(this.workspace().temporary)throw new Error('Private pages are not saved to bookmarks.');if(isWebUrl(tab.state.url)) this.repo.bookmark(tab.state.title,tab.state.url,this.workspaceId); break;
        case 'remove-bookmark': this.repo.removeBookmark(c.id,this.workspaceId); break;
        case 'settings': if(this.workspaces.some(w=>w.temporary&&Object.hasOwn(c.value.workspaceStudios,w.id)))throw new Error('Private workspace styling cannot be saved.');if(c.value.home!=='aster://newtab'&&!isWebUrl(c.value.home)) throw new Error('Enter a valid HTTP or HTTPS home page.'); this.repo.setSettings(c.value); break;
        case 'panel': {
          if(c.value==='settings'||c.value==='studio'||c.value==='extensions'||c.value==='performance'){if(c.value==='extensions'&&!this.workspace().temporary){const browsing=this.sessionFor(this.workspaceId);await this.extensions?.attach(this.workspaceId,browsing);}const url='aster://'+c.value,existing=this.workspaceTabs().find(t=>t.state.url===url);const origin=isWebUrl(tab.state.url)?new URL(tab.state.url).origin:tab.state.settingsOrigin;if(existing){if(origin)existing.state.settingsOrigin=origin;this.selectTab(existing.state.id);}else{const created=this.newTab(url);created.state.settingsOrigin=origin;}this.window.webContents.focus();break;}
          if(c.value==='reader'){
            if(!wc||!isWebUrl(tab.state.url))throw new Error('Open a website with article text first.');
            const url=tab.state.url;this.article=undefined;
            const raw=await wc.executeJavaScriptInIsolatedWorld(1001,[{code:'('+extractArticle.toString()+')()'}]);
            if(generation!==this.commandGeneration||this.activeId!==tab.state.id||tab.state.url!==url||wc.isDestroyed())break;
            const parsed=articleSchema.safeParse(raw);if(!parsed.success)throw new Error('Open a website with at least 200 characters of article text.');
            this.article={...parsed.data,url,tabId:tab.state.id};
          }
          this.panel=c.value==='security'?'privacy':c.value;if(this.panel==='privacy')await this.refreshCookies();if(this.panel!=='none')this.window.webContents.focus();break;
        }
        case 'clear-history': this.repo.clearHistory(this.workspaceId); break;
        case 'clear-cache': await this.sessionFor(this.workspaceId).clearCache(); break;
        case 'clear-cookies': await this.sessionFor(this.workspaceId).clearStorageData({storages:['cookies','localstorage','indexdb','serviceworkers','cachestorage']}); break;
        case 'new-window': this.createWindow(); break;
        case 'startup-ready': this.startupPending=false;clearTimeout(this.startupTimer);break;
        case 'minimize': this.window.minimize(); break;
        case 'maximize': this.window.isMaximized()?this.window.unmaximize():this.window.maximize(); break;
        case 'close-window': this.window.close(); break;
        case 'fullscreen': this.window.setFullScreen(!this.window.isFullScreen()); break;
        case 'devtools': wc?.openDevTools({mode:'detach'}); break;
        case 'print': wc?.print({silent:false,printBackground:true}); break;
        case 'open-file': {const picked=await dialog.showOpenDialog(this.window,{title:'Open a file',properties:['openFile'],filters:[{name:'Documents and images',extensions:[...previewExtensions].map(e=>e.slice(1))}]});if(!picked.canceled&&picked.filePaths[0])await this.openDocument(picked.filePaths[0]);break;}
        case 'save-page': if(wc) {if(wc.mainFrame.framesInSubtree.some(frame=>frame.url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'))){wc.downloadURL(wc.getURL());break;}const result=await dialog.showSaveDialog(this.window,{defaultPath:'page.html',filters:[{name:'Web page',extensions:['html']}]}); if(!result.canceled&&result.filePath) await wc.savePage(result.filePath,'HTMLComplete');} break;
        case 'find': if(wc) {if(c.text) wc.findInPage(c.text,{forward:c.forward}); else wc.stopFindInPage('clearSelection');} break;
        case 'zoom': if(wc) {wc.setZoomFactor(c.delta===0?1:Math.min(3,Math.max(0.3,wc.getZoomFactor()+c.delta))); tab.state.zoom=wc.getZoomFactor();} break;
        case 'download-action': {
          const d=this.snapshot().downloads.find(row=>row.id===c.id);if(!d)throw new Error('Download is no longer available.');
          const item=this.items.get(c.id);
          if(c.action==='open'||c.action==='reveal'){
            if(d.state!=='completed'||!d.path)throw new Error('Download has not finished.');
            if(!(await stat(d.path).catch(()=>undefined))?.isFile())throw new Error('Download file was moved or deleted.');
            if(c.action==='reveal')shell.showItemInFolder(d.path);
            else if(previewExtensions.has(path.extname(d.path).toLowerCase()))await this.openDocument(d.path);
            else {const confirmed=await dialog.showMessageBox(this.window,{type:'question',message:`Open ${d.filename} in its default app?`,detail:'Only open files from sources you trust.',buttons:['Cancel','Open'],defaultId:0,cancelId:0});if(confirmed.response===1){const error=await shell.openPath(d.path);if(error)throw new Error('Download could not be opened in its default app.');}}
          }else if(c.action==='retry'){
            if(item){if(!item.canResume())throw new Error('Download cannot resume yet. Cancel and retry.');item.resume();}
            else{if(!isWebUrl(d.url))throw new Error('Download must be generated again on its original page.');if(wc)wc.downloadURL(d.url);else this.newTab(d.url);}
          }else {if(!item)throw new Error('Download is no longer active.');if(c.action==='cancel')item.cancel();if(c.action==='pause')item.pause();if(c.action==='resume')item.resume();}break;
        }
        case 'workspace-create': {if(this.workspaces.length>=20||this.tabs.length>=100)throw new Error('The prototype workspace or tab limit has been reached.');const w=this.makeWorkspace(c.name);w.color=c.color;w.temporary=this.privateOnly;this.ai.clear();this.workspaces.push(w);this.workspaceId=w.id;this.newTab();break;}
        case 'workspace-update': {const w=this.workspace(c.id);Object.assign(w,{name:c.name,color:c.color,theme:c.theme,recordHistory:c.recordHistory});break;}
        case 'workspace-switch': this.switchWorkspace(c.id);break;
        case 'workspace-delete': await this.closeWorkspace(c.id);break;
        case 'tab-move': this.moveTab(c.id,c.workspaceId);break;
        case 'group-create': {const w=this.workspace();if(w.groups.length>=50)throw new Error('The prototype supports up to 50 groups per workspace.');const group={id:randomUUID(),name:c.name,color:c.color,icon:c.icon,collapsed:false};w.groups.push(group);tab.state.groupId=group.id;break;}
        case 'group-update': {const w=this.workspace();const index=w.groups.findIndex(g=>g.id===c.value.id);if(index<0)throw new Error('Group no longer exists.');w.groups[index]=c.value;break;}
        case 'group-toggle': {const g=this.workspace().groups.find(g=>g.id===c.id);if(g)g.collapsed=!g.collapsed;break;}
        case 'group-delete': {this.workspace().groups=this.workspace().groups.filter(g=>g.id!==c.id);for(const t of this.workspaceTabs())if(t.state.groupId===c.id)t.state.groupId=null;break;}
        case 'tab-group': {const t=this.byId(c.id);if(t.state.workspaceId!==this.workspaceId||c.groupId&&!this.workspace().groups.some(g=>g.id===c.groupId))throw new Error('Group no longer exists.');t.state.groupId=c.groupId;break;}
        case 'group-move': {const from=this.workspace();const to=this.workspace(c.workspaceId);if(from.temporary||to.temporary)throw new Error('Private groups cannot move between containers.');const group=from.groups.find(g=>g.id===c.id);if(!group||from===to)break;if(to.groups.length>=50)throw new Error('The prototype supports up to 50 groups per workspace.');const ids=this.workspaceTabs().filter(t=>t.state.groupId===c.id).map(t=>t.state.id);if(ids.length===this.workspaceTabs().length&&this.tabs.length>=100)throw new Error('The prototype needs room for a replacement tab in the source workspace.');to.groups.push(group);for(const id of ids){this.moveTab(id,to.id);this.byId(id).state.groupId=group.id;}from.groups=from.groups.filter(g=>g.id!==c.id);break;}
        case 'split-set': this.setSplit(c.mode);break;
        case 'split-tab': {const split=this.workspace().split;const t=this.byId(c.id);if(c.index>=split.tabs.length||t.state.workspaceId!==this.workspaceId)throw new Error('Invalid split pane.');const old=split.tabs.indexOf(c.id);if(old>=0)[split.tabs[old],split.tabs[c.index]]=[split.tabs[c.index],split.tabs[old]];else split.tabs[c.index]=c.id;this.activeId=c.id;this.workspace().activeId=c.id;this.wake(t);break;}
        case 'split-resize': this.workspace().split.x=c.x;this.workspace().split.y=c.y;break;
        case 'split-drag': this.splitDragging=c.active;break;
        case 'float-tab': this.floatTab(c.id);this.panel='none';break;
        case 'dock-tab': this.floats.get(c.id)?.close();break;
        case 'float-top': {const mini=this.floats.get(c.id);if(mini){mini.setAlwaysOnTop(c.value,process.platform==='win32'?'pop-up-menu':'floating');this.byId(c.id).state.alwaysOnTop=mini.isAlwaysOnTop();}break;}
        case 'session-save': {const saved=this.serialize();if(this.workspace().temporary||!saved)throw new Error('Private sessions cannot be saved.');this.repo.saveSession(c.name,saved);break;}
        case 'session-delete': this.repo.deleteSession(c.id);break;
        case 'session-restore': {const saved=this.repo.loadSession(c.id);if(!saved)throw new Error('Saved session is unavailable or invalid.');this.createWindow({...saved,id:randomUUID()});break;}
        case 'recovery': this.recover(c.restore);break;
        case 'private-window': this.createWindow(undefined,true);break;
        case 'temporary-create': {if(this.workspaces.length>=20||this.tabs.length>=100)throw new Error('The prototype workspace or tab limit has been reached.');const w=this.makeWorkspace('Temporary session');w.temporary=true;w.color='lavender';this.ai.clear();this.workspaces.push(w);this.workspaceId=w.id;this.newTab();break;}
        case 'permission-set': this.privacy.setPermission(this.scope(),originOf(tab.state.url),c.permission,c.value);break;
        case 'permission-reset': this.privacy.resetPermissions(this.scope(),originOf(tab.state.url));break;
        case 'permission-answer': this.privacy.answer(c.id,c.allow,c.remember,this.ownedIds());break;
        case 'site-exception': this.privacy.setException(this.scope(),originOf(tab.state.url),c.disabled);break;
        case 'cookies-refresh': await this.refreshCookies();break;
        case 'cookie-remove': {if(this.cookieContext!==`${this.workspaceId}|${originOf(tab.state.url)}`)break;const cookie=this.cookieKeys.get(c.id);if(cookie){await this.sessionFor(this.workspaceId).cookies.remove(`${cookie.secure?'https':'http'}://${(cookie.domain??new URL(tab.state.url).hostname).replace(/^\./,'')}${cookie.path??'/'}`,cookie.name);await this.refreshCookies();}break;}
        case 'site-data-clear': {const origin=originOf(tab.state.url);if(origin){const browsing=this.sessionFor(this.workspaceId);const cookies=await browsing.cookies.get({url:origin});for(const cookie of cookies)await browsing.cookies.remove(`${cookie.secure?'https':'http'}://${(cookie.domain??new URL(tab.state.url).hostname).replace(/^\./,'')}${cookie.path??'/'}`,cookie.name);await browsing.clearStorageData({origin,storages:['localstorage','indexdb','serviceworkers','cachestorage']});await this.refreshCookies();}break;}
      }
      this.emit(); return {ok:true};
    } catch (error) { return {ok:false,error:error instanceof Error && /^(Download |File |Tab |Extension |AI |Study |Vault |Use an image|Use a PNG|Enter |Only HTTP|This address|Tab no longer|The prototype|Workspace |Group |Open a website|Keep at least|Saved session|Private )/.test(error.message)?error.message:'The action could not be completed. Please try again.'}; }
  }
}

let cachedMetrics={processes:0,memoryMB:0,cpu:0,sampledAt:0};
function processMetrics(){
 if(Date.now()-cachedMetrics.sampledAt>=3000){const rows=app.getAppMetrics();cachedMetrics={processes:rows.length,memoryMB:Math.round(rows.reduce((n,p)=>n+p.memory.workingSetSize,0)/1024),cpu:Math.round(rows.reduce((n,p)=>n+p.cpu.percentCPUUsage,0)*10)/10,sampledAt:Date.now()};}
 return cachedMetrics;
}
