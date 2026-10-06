import {isWebUrl} from '../shared/navigation';
import path from 'node:path';

export const PDF_VIEWER='chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/';
export function fileAccessKey(top:string,request:string,details:{filePath?:string;isDirectory?:boolean;fileAccessType?:string},hasPdfViewer:boolean){
  if(!details.filePath||!path.isAbsolute(details.filePath)||details.isDirectory!==false||!['readable','writable'].includes(details.fileAccessType??''))return '';
  const pdf=hasPdfViewer&&request.startsWith(PDF_VIEWER);
  try{if(!pdf&&(!isWebUrl(top)||!isWebUrl(request)||new URL(top).origin!==new URL(request).origin))return '';}catch{return '';}
  return `${pdf?PDF_VIEWER:new URL(request).origin}|${path.resolve(details.filePath)}|${details.fileAccessType}`;
}

// Blob URLs are usable only by the site that created them, never arbitrary origins.
export function siteBlob(url:string,source:string){
  try{return url.startsWith('blob:')&&isWebUrl(new URL(url).origin)&&new URL(url).origin===new URL(source).origin;}catch{return false;}
}
export function documentKey(url:string){try{const parsed=new URL(url);parsed.hash='';return parsed.href;}catch{return '';}}
export function documentNavigation(url:string,source:string,approved:ReadonlySet<string>){
  return isWebUrl(url)||siteBlob(url,source)||(approved.has(documentKey(url))&&documentKey(url)===documentKey(source));
}
export function documentFrame(url:string,source:string,approved:ReadonlySet<string>){
  return documentNavigation(url,source,approved)||url==='about:blank'||url==='about:srcdoc'||
    url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/');
}
export const previewExtensions=new Set(['.pdf','.txt','.html','.htm','.png','.jpg','.jpeg','.gif','.webp','.svg','.avif']);
