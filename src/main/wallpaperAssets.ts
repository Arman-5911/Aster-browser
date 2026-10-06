import {app,dialog,nativeImage,type BrowserWindow} from 'electron';
import {readFile,writeFile,stat,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {checkImageBounds} from './imageBounds';
import {imageColors,type WallpaperAsset} from '../shared/studioAdvanced';
import type {Repository} from './database';
let importing=false;
export const assetPath=(asset:WallpaperAsset)=>path.join(app.getPath('userData'),`wallpaper-asset-${asset.id}.${asset.format}`);
export async function importAsset(window:BrowserWindow,repo:Repository,kind:'image'|'video'){
  if(importing)throw new Error('A wallpaper import is already in progress.');importing=true;
  let target='';
  try{
    if(repo.settings().wallpaperAssets.length>=8)throw new Error('Remove a wallpaper before adding another (8 maximum).');
    const pick=await dialog.showOpenDialog(window,{title:kind==='image'?'Add image to wallpaper collection':'Choose a silent video wallpaper',properties:['openFile'],filters:[{name:kind==='image'?'PNG / JPEG':'MP4 / WebM',extensions:kind==='image'?['png','jpg','jpeg']:['mp4','webm']}]});
    if(pick.canceled||!pick.filePaths[0])return;
    const source=pick.filePaths[0],limit=(kind==='image'?12:32)*1024*1024;if((await stat(source)).size>limit)throw new Error(`Wallpaper exceeds ${limit/1024/1024} MB.`);
    let data:Buffer=await readFile(source);if(data.length>limit)throw new Error('Wallpaper exceeds size limit.');
    let format:WallpaperAsset['format']='jpg',colors={brightness:.5,color:'#71877f'};
    if(kind==='image'){
      checkImageBounds(data);const original=nativeImage.createFromBuffer(data),size=original.getSize();if(original.isEmpty()||size.width*size.height>24000000)throw new Error('Use a valid image under 24 megapixels.');
      const image=size.width>2560||size.height>2560?original.resize(size.width>=size.height?{width:2560}:{height:2560}):original;
      const bitmap=image.resize({width:32,height:32}).toBitmap();for(let i=0;i<bitmap.length;i+=4)[bitmap[i],bitmap[i+2]]=[bitmap[i+2],bitmap[i]];colors=imageColors(bitmap);data=image.toJPEG(88);
    }else{
      const ext=path.extname(source).toLowerCase();if(ext==='.mp4'&&data.subarray(4,8).toString()==='ftyp')format='mp4';else if(ext==='.webm'&&data.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))format='webm';else throw new Error('Use a valid MP4 or WebM video.');
    }
    const asset:WallpaperAsset={id:randomUUID(),kind,format,name:path.basename(source).slice(0,80),...colors};target=assetPath(asset);await writeFile(target,data,{flag:'wx'});
    repo.setSettings({...repo.settings(),wallpaperAssets:[...repo.settings().wallpaperAssets,asset]});target='';
  }finally{if(target)await rm(target,{force:true});importing=false;}
}
export async function removeAsset(repo:Repository,id:string){const asset=repo.settings().wallpaperAssets.find(a=>a.id===id);if(!asset)return;repo.setSettings({...repo.settings(),wallpaperAssets:repo.settings().wallpaperAssets.filter(a=>a.id!==id)});await rm(assetPath(asset),{force:true});}
export async function serveAsset(repo:Repository,id:string,range:string|null){
  const asset=repo.settings().wallpaperAssets.find(a=>a.id===id);if(!asset)return new Response('Not found',{status:404});
  const data=await readFile(assetPath(asset));const headers:Record<string,string>={'Content-Type':asset.format==='jpg'?'image/jpeg':asset.format==='mp4'?'video/mp4':'video/webm','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'};
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);const start=Number(match?.[1]),end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;if(!match||!Number.isSafeInteger(start)||start<0||start>=data.length||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${data.length}`}});headers['Content-Range']=`bytes ${start}-${end}/${data.length}`;headers['Content-Length']=String(end-start+1);return new Response(data.subarray(start,end+1),{status:206,headers});}
  headers['Content-Length']=String(data.length);return new Response(data,{headers});
}
