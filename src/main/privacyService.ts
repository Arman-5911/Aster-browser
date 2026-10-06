import {fileAccessKey,PDF_VIEWER} from './documentPolicy';
import type {Session,WebContents} from 'electron';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {FiltersEngine,Request} from '@ghostery/adblocker';
import type {Repository} from './database';
import {aiCompatibilitySite,emptyStats,permissionDefaults,permissionSchema,type SitePermission,type PermissionValue,type PrivacyStats,type PermissionPrompt,type Protection} from '../shared/privacy';
import {originOf,isThirdParty,permissionNames,validPermissionContext} from './privacyPolicy';
import {supportsPlayerProtection} from '../shared/contentProtection';
import {RequestRecorder} from './requestRecorder';

type Scope={id:string;temporary:boolean};
type Owner={wc:WebContents;scope:Scope};
type Pending=PermissionPrompt&{wcId:number;scope:Scope;callback:(allowed:boolean)=>void;timer:ReturnType<typeof setTimeout>};
const requestType:Record<string,string>={mainFrame:'main_frame',subFrame:'sub_frame',stylesheet:'stylesheet',script:'script',image:'image',font:'font',object:'object',xhr:'xmlhttprequest',ping:'ping',cspReport:'csp_report',media:'media',webSocket:'websocket',other:'other'};

/** One handler set per Chromium session; no competing webRequest listeners. */
export class PrivacyService{
  readonly recorder=new RequestRecorder();
  private attached=new WeakSet<Session>();
  private disposed=false;
  private owners=new Map<number,Owner>();
  private stats=new Map<number,PrivacyStats>();
  private fileEpoch=new Map<number,number>();
  private fileGrants=new Map<number,Set<string>>();
  private filePrompts=new Set<number>();
  private pending=new Map<string,Pending>();
  private memoryPermissions=new Map<string,PermissionValue>();
  private memoryExceptions=new Set<string>();
  private documentGrants=new Map<number,Set<SitePermission>>();
  private lastPrompt=new Map<number,number>();
  private requests=new Map<number,{wcId:number;thirdParty:boolean;source:string;scope:Scope;mode:Protection}>();
  private notifyTimer?:ReturnType<typeof setTimeout>;
  private trackers?:FiltersEngine;private ads?:FiltersEngine;
  readonly filters={ready:false,retrievedAt:''};
  constructor(private repo:Repository,private changed:()=>void){
    try{this.trackers=FiltersEngine.deserialize(readFileSync(path.join(__dirname,'filters/easyprivacy.bin')));this.ads=FiltersEngine.deserialize(readFileSync(path.join(__dirname,'filters/easylist.bin')));this.filters.retrievedAt=JSON.parse(readFileSync(path.join(__dirname,'filters/metadata.json'),'utf8')).retrievedAt;this.filters.ready=true;}catch{console.error(JSON.stringify({category:'security',event:'filter-load-failed'}));}
  }
  private notify(){if(this.disposed||this.notifyTimer)return;this.notifyTimer=setTimeout(()=>{this.notifyTimer=undefined;this.changed();},250);}
  register(wc:WebContents,scope:Scope){if(this.disposed||wc.isDestroyed())return;const id=wc.id;this.owners.set(id,{wc,scope});this.stats.set(id,emptyStats());wc.once('destroyed',()=>this.forget(id));}
  private forget(id:number){this.fileGrants.delete(id);this.filePrompts.delete(id);this.fileEpoch.delete(id);this.recorder.forget(id);this.cancel(id);this.owners.delete(id);this.stats.delete(id);this.documentGrants.delete(id);this.lastPrompt.delete(id);for(const [key,value]of this.requests)if(value.wcId===id)this.requests.delete(key);}
  reset(id:number){if(this.disposed)return;this.fileGrants.delete(id);this.fileEpoch.set(id,(this.fileEpoch.get(id)??0)+1);this.cancel(id);this.stats.set(id,emptyStats());this.documentGrants.delete(id);this.notify();}
  private key(scope:string,origin:string,permission:string){return `${scope}|${origin}|${permission}`;}
  decision(scope:Scope,origin:string,permission:SitePermission):PermissionValue{if(this.disposed)return 'block';return (scope.temporary?this.memoryPermissions.get(this.key(scope.id,origin,permission)):this.repo.permission(scope.id,origin,permission))??permissionDefaults[permission];}
  permissions(scope:Scope,origin:string){return Object.fromEntries(permissionSchema.options.map(p=>[p,this.decision(scope,origin,p)])) as Record<SitePermission,PermissionValue>;}
  setPermission(scope:Scope,origin:string,permission:SitePermission,value:PermissionValue){if(this.disposed||!origin)return;if(scope.temporary)this.memoryPermissions.set(this.key(scope.id,origin,permission),value);else this.repo.setPermission(scope.id,origin,permission,value);for(const [id,owner]of this.owners)if(owner.scope.id===scope.id&&!owner.wc.isDestroyed()&&originOf(owner.wc.getURL())===origin){this.documentGrants.delete(id);this.cancel(id);}this.notify();}
  resetPermissions(scope:Scope,origin:string){if(this.disposed)return;if(scope.temporary)for(const key of this.memoryPermissions.keys()){if(key.startsWith(`${scope.id}|${origin}|`))this.memoryPermissions.delete(key);}else this.repo.resetPermissions(scope.id,origin);for(const [id,owner]of this.owners)if(owner.scope.id===scope.id&&!owner.wc.isDestroyed()&&originOf(owner.wc.getURL())===origin){this.documentGrants.delete(id);this.cancel(id);}this.notify();}
  exception(scope:Scope,origin:string){if(this.disposed)return false;return scope.temporary?this.memoryExceptions.has(`${scope.id}|${origin}`):this.repo.exception(scope.id,origin);}
  setException(scope:Scope,origin:string,disabled:boolean){if(this.disposed||!origin)return;if(scope.temporary){const key=`${scope.id}|${origin}`;if(disabled)this.memoryExceptions.add(key);else this.memoryExceptions.delete(key);}else this.repo.setException(scope.id,origin,disabled);this.notify();}
  automaticCompatibility(source:string){return !this.disposed&&aiCompatibilitySite(source)&&this.repo.privacySettings().aiSiteCompatibility;}
  mode(scope:Scope,source:string):Protection{if(this.disposed)return 'strict';if(this.automaticCompatibility(source)||this.exception(scope,originOf(source)))return 'off';return scope.temporary?'strict':this.repo.privacySettings().protection;}
  playerProtection(wcId:number,frameUrl:string,isMainFrame:boolean){const owner=this.owners.get(wcId);return !!owner&&isMainFrame&&supportsPlayerProtection(frameUrl)&&this.mode(owner.scope,frameUrl)!=='off';}
  getStats(wcId?:number){return {...(wcId?this.stats.get(wcId):undefined)??emptyStats()};}
  record(wcId:number,key:'popupsBlocked'|'redirects'|'permissionsBlocked'){const stats=this.stats.get(wcId);if(stats){stats[key]++;this.notify();}}
  prompts(ids:number[]):PermissionPrompt[]{return [...this.pending.values()].filter(p=>ids.includes(p.wcId)).map(({id,origin,permissions,expiresAt})=>({id,origin,permissions,expiresAt}));}
  cancel(id:number){for(const prompt of [...this.pending.values()])if(prompt.wcId===id)this.finish(prompt,false);}
  private finish(prompt:Pending,allow:boolean){if(!this.pending.delete(prompt.id))return;clearTimeout(prompt.timer);prompt.callback(allow);if(!allow)this.record(prompt.wcId,'permissionsBlocked');this.notify();}
  answer(id:string,allow:boolean,remember:boolean,ownedIds:number[]){const prompt=this.pending.get(id);if(!prompt||!ownedIds.includes(prompt.wcId))return;const owner=this.owners.get(prompt.wcId);if(!owner||owner.wc.isDestroyed()||originOf(owner.wc.getURL())!==prompt.origin||Date.now()>prompt.expiresAt){this.finish(prompt,false);return;}
    if(remember)for(const permission of prompt.permissions){if(prompt.scope.temporary)this.memoryPermissions.set(this.key(prompt.scope.id,prompt.origin,permission),allow?'allow':'block');else this.repo.setPermission(prompt.scope.id,prompt.origin,permission,allow?'allow':'block');}
    if(allow){const grants=this.documentGrants.get(prompt.wcId)??new Set();for(const p of prompt.permissions)grants.add(p);this.documentGrants.set(prompt.wcId,grants);}this.finish(prompt,allow);
  }
  ask(wc:WebContents,permissions:SitePermission[],callback:(allow:boolean)=>void){
    if(this.disposed||wc.isDestroyed()){callback(false);return;}
    const owner=this.owners.get(wc.id);const origin=originOf(wc.getURL());if(!owner||!origin||!permissions.length){callback(false);return;}
    const decisions=permissions.map(p=>this.documentGrants.get(wc.id)?.has(p)?'allow':this.decision(owner.scope,origin,p));
    if(decisions.includes('block')){this.record(wc.id,'permissionsBlocked');callback(false);return;}
    if(decisions.every(d=>d==='allow')){callback(true);return;}
    if([...this.pending.values()].some(p=>p.wcId===wc.id)||Date.now()-(this.lastPrompt.get(wc.id)??0)<15000){this.record(wc.id,'permissionsBlocked');callback(false);return;}
    this.lastPrompt.set(wc.id,Date.now());const id=randomUUID();const prompt:Pending={id,wcId:wc.id,scope:owner.scope,origin,permissions,expiresAt:Date.now()+30000,callback,timer:setTimeout(()=>{const p=this.pending.get(id);if(p)this.finish(p,false);},30000)};this.pending.set(id,prompt);this.changed();
  }
  private fileKey(wc:WebContents,request:string,details:{filePath?:string;isDirectory?:boolean;fileAccessType?:string}){
    return fileAccessKey(wc.getURL(),request,details,wc.mainFrame.framesInSubtree.some(f=>f.url.startsWith(PDF_VIEWER)));
  }
  private async requestFile(wc:WebContents,request:string,details:{filePath?:string;isDirectory?:boolean;fileAccessType?:string},callback:(allow:boolean)=>void){
    const id=wc.id,key=this.fileKey(wc,request,details),document=wc.mainFrame,url=wc.getURL(),epoch=this.fileEpoch.get(id);
    if(!key||this.filePrompts.has(id)){callback(false);return;}
    if(this.fileGrants.get(id)?.has(key)){callback(true);return;}
    this.filePrompts.add(id);
    try{
      const {dialog}=await import('electron');
      const result=await dialog.showMessageBox({type:'question',title:'File access',message:`Allow ${request.startsWith(PDF_VIEWER)?'the PDF viewer':new URL(request).hostname} to ${details.fileAccessType==='writable'?'save changes to':'read'} this file?`,detail:details.filePath,buttons:['Cancel','Allow'],defaultId:0,cancelId:0});
      const allow=result.response===1&&!this.disposed&&!wc.isDestroyed()&&wc.mainFrame===document&&wc.getURL()===url&&this.fileEpoch.get(id)===epoch&&this.owners.has(id);
      if(allow){const grants=this.fileGrants.get(id)??new Set<string>();grants.add(key);this.fileGrants.set(id,grants);}callback(allow);
    }catch{callback(false);}finally{this.filePrompts.delete(id);}
  }
  attach(browsing:Session,scope:Scope){
    if(this.disposed||this.attached.has(browsing))return;this.attached.add(browsing);
    browsing.setPermissionCheckHandler((wc,permission,requestingOrigin,details)=>{
      if(!this.disposed&&wc&&!wc.isDestroyed()&&this.owners.has(wc.id)&&permission==='fileSystem')return this.fileGrants.get(wc.id)?.has(this.fileKey(wc,details.requestingUrl??requestingOrigin,details))??false;
      if(this.disposed||!wc||wc.isDestroyed()||!this.owners.has(wc.id)||!validPermissionContext(wc.getURL(),details.requestingUrl??requestingOrigin,details.isMainFrame))return false;
      const permissions=permissionNames(permission,details.mediaType?[details.mediaType]:[]);return permissions.length>0&&permissions.every(p=>this.documentGrants.get(wc.id)?.has(p)||this.decision(scope,originOf(wc.getURL()),p)==='allow');
    });
    browsing.setPermissionRequestHandler((wc,permission,callback,details)=>{
      if(!this.disposed&&!wc.isDestroyed()&&this.owners.has(wc.id)&&permission==='fileSystem'){void this.requestFile(wc,details.requestingUrl,details as Electron.FilesystemPermissionRequest,callback);return;}
      if(this.disposed||wc.isDestroyed()||!this.owners.has(wc.id)||!validPermissionContext(wc.getURL(),details.requestingUrl,details.isMainFrame)){callback(false);return;}
      this.ask(wc,permissionNames(permission,'mediaTypes'in details?details.mediaTypes:[]),callback);
    });
    browsing.setDevicePermissionHandler(()=>false);
    browsing.webRequest.onBeforeRequest((details,callback)=>{
      if(this.disposed){callback({cancel:true});return;}
      const owner=this.owners.get((details.webContentsId??-1));const main=details.resourceType==='mainFrame';const source=main?details.url:(owner&&!owner.wc.isDestroyed()?owner.wc.getURL():details.referrer)||details.referrer;
      const thirdParty=!main&&isThirdParty(details.url,source);const stats=this.stats.get((details.webContentsId??-1));
      if(stats){stats.requests++;if(thirdParty)stats.thirdParty++;}
      const mode=this.mode(scope,source);let reason:'trackersBlocked'|'adsBlocked'|undefined;
      if(!main&&mode!=='off'&&/^https?:/.test(details.url)){
        const request=Request.fromRawDetails({url:details.url,sourceUrl:source,type:(requestType[details.resourceType]??'other') as 'script'});
        if(this.trackers?.match(request).match)reason='trackersBlocked';else if(this.ads?.match(request).match)reason='adsBlocked';
      }
      if(reason&&stats){stats[reason]++;const hostname=new URL(details.url).hostname;if(!stats.blockedDomains.includes(hostname)&&stats.blockedDomains.length<30)stats.blockedDomains.push(hostname);}
      this.recorder.start(details.webContentsId??-1,details.id,details.url,details.method,details.resourceType,!!reason);
      if(!reason)this.requests.set(details.id,{wcId:(details.webContentsId??-1),thirdParty,source,scope,mode});this.notify();callback({cancel:!!reason});
    });
    browsing.webRequest.onBeforeSendHeaders((details,callback)=>{if(this.disposed){callback({cancel:true});return;}const entry=this.requests.get(details.id);const headers={...details.requestHeaders};if(entry?.thirdParty&&entry.mode==='strict')for(const key of Object.keys(headers))if(key.toLowerCase()==='cookie'){delete headers[key];const stats=this.stats.get(entry.wcId);if(stats)stats.cookieHeadersBlocked++;}callback({requestHeaders:headers});});
    browsing.webRequest.onHeadersReceived((details,callback)=>{if(this.disposed){callback({cancel:true});return;}const entry=this.requests.get(details.id);const headers={...details.responseHeaders};if(entry?.thirdParty&&entry.mode==='strict')for(const key of Object.keys(headers))if(key.toLowerCase()==='set-cookie'){delete headers[key];const stats=this.stats.get(entry.wcId);if(stats)stats.cookieHeadersBlocked++;}callback({responseHeaders:headers});});
    const done=(details:{id:number;webContentsId?:number;statusCode?:number;error?:string})=>{if(this.disposed)return;this.recorder.finish(details.webContentsId??-1,details.id,details.statusCode,details.error);this.requests.delete(details.id);this.notify();};browsing.webRequest.onCompleted(done);browsing.webRequest.onErrorOccurred(done);
  }
  clearTemporary(scopeId:string){for(const key of this.memoryPermissions.keys())if(key.startsWith(scopeId+'|'))this.memoryPermissions.delete(key);for(const key of this.memoryExceptions)if(key.startsWith(scopeId+'|'))this.memoryExceptions.delete(key);}
  dispose(){if(this.disposed)return;this.disposed=true;clearTimeout(this.notifyTimer);this.notifyTimer=undefined;for(const prompt of [...this.pending.values()])this.finish(prompt,false);for(const id of this.owners.keys())this.recorder.forget(id);this.owners.clear();this.fileGrants.clear();this.filePrompts.clear();this.fileEpoch.clear();this.requests.clear();this.stats.clear();this.documentGrants.clear();this.lastPrompt.clear();}
}
