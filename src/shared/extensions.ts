import {z} from 'zod';
const strings=z.array(z.string().max(2048)).max(200).default([]);
export const extensionManifest=z.object({manifest_version:z.union([z.literal(2),z.literal(3)]),name:z.string().min(1).max(200),version:z.string().min(1).max(80),description:z.string().max(4000).optional(),permissions:strings,host_permissions:strings,optional_permissions:strings,optional_host_permissions:strings,content_scripts:z.array(z.object({matches:strings}).passthrough()).max(200).default([])}).passthrough();
export type Manifest=z.infer<typeof extensionManifest>;
export interface ExtensionInfo{id:string;name:string;version:string;description:string;manifestVersion:number;permissions:string[];hosts:string[];optional:string[];enabled:boolean;loaded:boolean;error:string;popup:boolean;options:boolean;runtimeId?:string;warnings?:string[];volumeAdapter?:boolean}
export interface ExtensionPreview extends ExtensionInfo{files:number;bytes:number}
export interface ExtensionSnapshot{items:ExtensionInfo[];preview?:ExtensionPreview;busy:boolean;error:string}
export function extensionDetails(id:string,manifest:Manifest){return {volumeAdapter:supportsVolumeAdapter(manifest),warnings:extensionWarnings(manifest),id,name:manifest.name,version:manifest.version,description:manifest.description??'',manifestVersion:manifest.manifest_version,permissions:manifest.permissions,hosts:[...new Set([...manifest.host_permissions,...manifest.content_scripts.flatMap(s=>s.matches),...manifest.permissions.filter(s=>s.includes('://')||s==='<all_urls>')])],optional:[...manifest.optional_permissions,...manifest.optional_host_permissions]};}
export function extensionPage(manifest:Manifest,kind:'popup'|'options'){const raw=kind==='popup'?(manifest.action as {default_popup?:unknown}|undefined)?.default_popup??(manifest.browser_action as {default_popup?:unknown}|undefined)?.default_popup:(manifest.options_ui as {page?:unknown}|undefined)?.page??manifest.options_page;if(typeof raw!=='string'||!raw||raw.length>2048||/[:\\?#%]/.test(raw)||raw.startsWith('/')||raw.split('/').some(p=>p==='..'||p==='.'||!p))return undefined;return raw;}

export function extensionWarnings(manifest:Manifest):string[]{
 const warnings:string[]=[];
 for(const permission of ['tabCapture','offscreen','desktopCapture','debugger','nativeMessaging','identity','sidePanel','declarativeNetRequest']){
  if(manifest.permissions.includes(permission)&&!(permission==='offscreen'&&supportsVolumeAdapter(manifest)))warnings.push(permission==='tabCapture'?(supportsVolumeAdapter(manifest)?'Audio adapter available: choose a website tab and keep the popup open. Capture ends when the popup closes or the tab navigates.':'tabCapture: no compatibility adapter for this extension.'):`${permission}: compatibility is not verified by Aster; features requiring this API may fail.`);
 }
 if(manifest.permissions.includes('activeTab')&&!supportsVolumeAdapter(manifest))warnings.push('activeTab: opening a popup from the manager does not grant Chrome toolbar-action access to the active website.');
 return warnings;
}

export function supportsVolumeAdapter(manifest:Manifest){return manifest.name==='Tab Volume Booster'&&manifest.version==='1.1.0'&&manifest.permissions.includes('tabCapture')&&manifest.permissions.includes('offscreen');}
