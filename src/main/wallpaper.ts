import {app,dialog,nativeImage,type BrowserWindow} from 'electron';
import {readFile,writeFile,stat,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Repository} from './database';
import {checkImageBounds} from './imageBounds';
export function wallpaperPath(){return path.join(app.getPath('userData'),'wallpaper.jpg');}
export async function importWallpaper(window:BrowserWindow,repo:Repository){
  const result=await dialog.showOpenDialog(window,{title:'Choose a new-tab background',properties:['openFile'],filters:[{name:'Background image',extensions:['png','jpg','jpeg']}]});
  if(result.canceled||!result.filePaths[0])return;
  const file=result.filePaths[0];if((await stat(file)).size>12*1024*1024)throw new Error('Use an image smaller than 12 MB.');
  const data=await readFile(file);if(data.length>12*1024*1024)throw new Error('Use an image smaller than 12 MB.');
  checkImageBounds(data);
  const image=nativeImage.createFromBuffer(data);const size=image.getSize();
  if(image.isEmpty()||size.width<1||size.height<1||size.width*size.height>24000000)throw new Error('Use a PNG or JPEG image under 24 megapixels.');
  const normalized=size.width>2560||size.height>2560?image.resize(size.width>=size.height?{width:2560}:{height:2560}):image;
  const temporary=path.join(app.getPath('userData'),'wallpaper-'+randomUUID()+'.tmp');
  try{await writeFile(temporary,normalized.toJPEG(88));await rename(temporary,wallpaperPath());repo.setSettings({...repo.settings(),wallpaper:randomUUID()});}finally{await rm(temporary,{force:true});}
}
export async function removeWallpaper(repo:Repository){repo.setSettings({...repo.settings(),wallpaper:null});await rm(wallpaperPath(),{force:true});}
