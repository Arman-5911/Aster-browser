import {z} from 'zod';
export const dashboardKinds=['clock','date','calendar','timer','calculator','notes','reading','bookmarks','history','downloads','workspaces','tasks','system','media','quicklinks'] as const;
export const dashboardWidget=z.object({id:z.string().uuid(),kind:z.enum(dashboardKinds),zone:z.enum(['start','sidebar','floating']),size:z.enum(['small','medium','large','icon']),x:z.number().int().min(0).max(90),y:z.number().int().min(0).max(2000)}).strict();
const n=(min:number,max:number,d:number)=>z.number().int().min(min).max(max).default(d);
export const advancedShape={
  wallpaperMode:z.enum(['static','image','animated','collection','time','video']).default('static'),
  wallpaperSlot:n(0,7,0),rotationMinutes:n(1,120,15),dayDim:n(0,80,35),nightDim:n(0,80,60),scheduledDim:z.boolean().default(false),
  adaptiveColors:z.boolean().default(false),adaptiveTime:z.boolean().default(false),autoPerformance:z.boolean().default(true),
  parallax:n(0,8,0),noise:z.enum(['none','soft','medium']).default('none'),refraction:z.enum(['off','low','medium']).default('off'),frost:n(0,100,30),highlightThickness:n(1,3,1),lightDirection:n(0,360,135),
  toolbarOpacity:n(65,100,85),tabsOpacity:n(65,100,85),sidebarOpacity:n(65,100,85),panelOpacity:n(65,100,90),widgetOpacity:n(65,100,85),separateOpacity:z.boolean().default(false),
  tabPosition:z.enum(['inherit','top','left','right','hidden','floating','auto']).default('inherit'),verticalMode:z.enum(['full','icons','hover']).default('full'),
  sidebarMode:z.enum(['docked','floating','hidden','auto']).default('docked'),immersive:z.boolean().default(false),
  tabHeight:n(28,40,34),tabPadding:n(2,16,8),tabIconSize:n(12,22,14),tabBorder:z.boolean().default(true),tabShadow:z.boolean().default(true),tabAudio:z.boolean().default(true),tabContainer:z.boolean().default(true),tabCloseHidden:z.boolean().default(false),pinnedStyle:z.enum(['normal','circle','square']).default('normal'),groupStyle:z.enum(['normal','underline','subtle']).default('normal'),
  fontWeight:n(400,600,400),letterSpacing:n(0,2,0),sidebarFont:n(11,17,12),menuFont:n(11,17,12),motionDuration:n(100,400,180),spring:n(0,100,20),workspaceTransition:z.enum(['none','fade','slide']).default('none'),
  dashboard:z.boolean().default(false),gridColumns:n(1,4,2),freeLayout:z.boolean().default(false),dynamicWidgets:z.boolean().default(true),widgets:z.array(dashboardWidget).max(24).refine(v=>new Set(v.map(w=>w.id)).size===v.length).default([]),
  toolbarZones:z.boolean().default(false),widgetZones:z.partialRecord(z.enum(['back','forward','reload','home','address','workspace','tabs','split','downloads','history','notes','reading','privacy','screenshot','developer','extensions','settings','separator','spacer','menu']),z.enum(['left','center','right'])).default({})
};
export const wallpaperAsset=z.object({id:z.string().uuid(),kind:z.enum(['image','video']),format:z.enum(['jpg','mp4','webm']),name:z.string().max(80),brightness:z.number().min(0).max(1),color:z.string().regex(/^#[0-9a-f]{6}$/)}).strict();
export type WallpaperAsset=z.infer<typeof wallpaperAsset>;
export function websiteOrigin(value:string){try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.origin:'';}catch{return '';}}
export function imageColors(rgba:Uint8ClampedArray|Uint8Array){let r=0,g=0,b=0,count=0;for(let i=0;i<rgba.length;i+=4){if(rgba[i+3]<128)continue;r+=rgba[i];g+=rgba[i+1];b+=rgba[i+2];count++;}if(!count)return {brightness:.5,color:'#71877f'};r=Math.round(r/count);g=Math.round(g/count);b=Math.round(b/count);return {brightness:(r*.2126+g*.7152+b*.0722)/255,color:'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')};}
export function wallpaperIndex(mode:string,slot:number,count:number,rotationMinutes:number,time=Date.now()){if(!count)return -1;if(mode==='time')return Math.floor(new Date(time).getHours()/24*count);if(mode==='collection')return Math.floor(time/(rotationMinutes*60000))%count;return Math.min(slot,count-1);}
