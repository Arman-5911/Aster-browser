import {resolveStudio} from './studio';
import type {Settings} from './schema';
import { splitCount, type Split } from './workspace';
export const CHROME_HEIGHT=100;
export const SIDEBAR_WIDTH=240;
export const SPLIT_BAR_HEIGHT=42;
export const PANE_HEADER_HEIGHT=34;
export const SPLIT_GAP=10;
export type Rect={x:number;y:number;width:number;height:number};
export function paneRects(width:number,height:number,split:Split):Rect[]{
  width=Math.max(0,Math.floor(width));height=Math.max(0,Math.floor(height));
  if(!splitCount(split.mode))return [{x:0,y:0,width,height}];
  const left=Math.round((width-SPLIT_GAP)*split.x),top=Math.round((height-SPLIT_GAP)*split.y);
  const right=Math.max(0,width-left-SPLIT_GAP),bottom=Math.max(0,height-top-SPLIT_GAP);
  if(split.mode==='columns')return [{x:0,y:0,width:left,height},{x:left+SPLIT_GAP,y:0,width:right,height}];
  if(split.mode==='rows')return [{x:0,y:0,width,height:top},{x:0,y:top+SPLIT_GAP,width,height:bottom}];
  if(split.mode==='three')return [{x:0,y:0,width:left,height},{x:left+SPLIT_GAP,y:0,width:right,height:top},{x:left+SPLIT_GAP,y:top+SPLIT_GAP,width:right,height:bottom}];
  return [{x:0,y:0,width:left,height:top},{x:left+SPLIT_GAP,y:0,width:right,height:top},{x:0,y:top+SPLIT_GAP,width:left,height:bottom},{x:left+SPLIT_GAP,y:top+SPLIT_GAP,width:right,height:bottom}];
}

export function chromeGeometry(settings:Settings,workspaceId:string,url='',hidden=false,collapsed=false){
  const studio=resolveStudio(settings,workspaceId,url);
  const vertical=['left','right','floating','auto'].includes(studio.tabPosition)||(studio.tabPosition==='inherit'&&settings.tabLayout==='vertical');
  const side=studio.tabPosition==='right'?'right':studio.tabPosition==='left'?'left':studio.sidebarSide;
  const canCollapse=studio.sidebarMode==='auto'||studio.tabPosition==='auto'||studio.verticalMode==='hover';
  const sidebar=studio.sidebarMode==='hidden'?0:vertical||settings.sidebarVisible?(canCollapse&&collapsed?24:studio.verticalMode==='icons'?64:studio.sidebarWidth):0;
  return {height:hidden&&studio.immersive?44:44+studio.toolbarHeight,left:side==='left'?sidebar:0,right:side==='right'?sidebar:0,sidebar};
}
export function topTabs(settings:Settings,workspaceId:string,url=''){const s=resolveStudio(settings,workspaceId,url);return s.tabPosition==='top'||s.tabPosition==='inherit'&&settings.tabLayout==='horizontal';}
