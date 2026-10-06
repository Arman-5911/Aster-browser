import {getDomain} from 'tldts';
import type {SitePermission} from '../shared/privacy';
export function originOf(value:string){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.origin:'';}catch{return '';}}
export function isThirdParty(url:string,source:string){try{const a=new URL(url).hostname,b=new URL(source).hostname;return (getDomain(a,{allowPrivateDomains:true})??a)!==(getDomain(b,{allowPrivateDomains:true})??b);}catch{return false;}}
export function permissionNames(permission:string,mediaTypes:string[]=[]):SitePermission[]{
  if(permission==='media')return mediaTypes.length?mediaTypes.map(t=>t==='video'?'camera':t==='audio'?'microphone':null).filter((p):p is 'camera'|'microphone'=>p!==null):['camera','microphone'];
  if(permission==='geolocation'||permission==='geolocation-approximate')return ['location'];
  if(['notifications','clipboard-read','fullscreen'].includes(permission))return [permission as SitePermission];
  return [];
}
export function validPermissionContext(topUrl:string,requestUrl:string,isMainFrame:boolean){const top=originOf(topUrl);return !!top&&isMainFrame&&originOf(requestUrl)===top;}
