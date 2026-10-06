import {advancedShape,websiteOrigin} from './studioAdvanced';
import {z} from 'zod';

export const widgetIds=['back','forward','reload','home','address','workspace','tabs','split','downloads','history','notes','reading','privacy','screenshot','developer','extensions','settings','separator','spacer','menu'] as const;
export type WidgetId=typeof widgetIds[number];
export const widgetLabels:Record<WidgetId,string>={back:'Back',forward:'Forward',reload:'Reload',home:'Home',address:'Address and search',workspace:'Workspace',tabs:'Vertical tabs',split:'Split view',downloads:'Downloads',history:'History',notes:'Notes',reading:'Reading list',privacy:'Privacy',screenshot:'Screenshot',developer:'Developer tools',extensions:'Extensions',settings:'Theme Studio',separator:'Separator',spacer:'Spacer',menu:'Browser menu'};
export const defaultToolbar:WidgetId[]=['back','forward','reload','home','address','workspace','tabs','split','downloads','menu'];
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const number=(min:number,max:number,value:number)=>z.number().int().min(min).max(max).default(value);
export const studioSchema=z.object({
  ...advancedShape,
  interfaceStyle:z.enum(['modern','classic']).default('modern'),
  palette:z.enum(['inherit','graphite','midnight','paper']).default('inherit'),
  wallpaperEverywhere:z.boolean().default(false),
  background:z.enum(['existing','solid','gradient']).default('existing'),
  backgroundColor:color.default('#23302e'),gradientColor:color.default('#536a72'),
  imageFit:z.enum(['cover','contain','stretch','center','tile']).default('cover'),
  imageX:number(0,100,50),imageY:number(0,100,50),imageScale:number(100,150,100),
  brightness:number(50,150,100),saturation:number(0,150,100),contrast:number(50,150,100),
  glass:z.boolean().default(false),glassOpacity:number(65,100,85),glassTint:color.default('#71877f'),
  toolbarBlur:number(0,50,16),sidebarBlur:number(0,50,12),tabBlur:number(0,50,6),panelBlur:number(0,50,12),widgetBlur:number(0,50,8),
  quality:z.enum(['performance','balanced','maximum']).default('balanced'),
  highlight:number(0,30,12),shadow:z.enum(['none','minimal','soft','deep']).default('soft'),
  radius:number(0,24,10),font:z.enum(['system','humanist','mono']).default('system'),fontSize:number(11,15,12),
  spacing:z.enum(['compact','balanced','comfortable']).default('balanced'),
  toolbarHeight:number(48,72,56),sidebarWidth:number(200,320,240),sidebarSide:z.enum(['left','right']).default('left'),
  addressMode:z.enum(['full','centered','compact','expand']).default('full'),addressWidth:number(240,1000,600),addressRadius:number(0,28,7),addressFont:number(11,17,12),
  searchStyle:z.enum(['classic','soft','glass','minimal']).default('classic'),searchTint:color.default('#8ba9c4'),searchOpacity:number(65,100,90),searchBorder:number(0,2,1),searchShadow:z.enum(['none','soft','lifted']).default('soft'),searchNewTab:z.boolean().default(true),
  tabRadius:number(0,24,10),tabGap:number(0,12,5),tabTitles:z.boolean().default(true),
  cleanStart:z.boolean().default(false),
  toolbar:z.array(z.enum(widgetIds)).min(2).max(widgetIds.length).refine(ids=>new Set(ids).size===ids.length&&ids.includes('address')&&ids.includes('menu'),'Keep one address bar and browser menu.').default(defaultToolbar)
}).strict();
export type Studio=z.infer<typeof studioSchema>;
export const studioDefaults=():Studio=>studioSchema.parse({});
export function resolveStudio(settings:{studio:Studio;workspaceStudios:Record<string,Studio>},workspaceId:string,url=''):Studio{const base=settings.workspaceStudios[workspaceId]??settings.studio;const profiles=(settings as typeof settings & {siteStudios?:{origin:string;studio:Studio}[]}).siteStudios;return profiles?.find(p=>p.origin===websiteOrigin(url))?.studio??base;}
export const themeVisualSchema=z.object({
  theme:z.enum(['light','dark','system']),accent:z.enum(['forest','slate','clay']),density:z.enum(['comfortable','compact']),
  tabStyle:z.enum(['classic','soft','pill']),tabWidth:z.number().int().min(140).max(280),tabFontSize:z.number().int().min(10).max(15),tabColor:color.nullable(),tabClose:z.enum(['always','hover']),motion:z.enum(['off','calm','expressive']),
  startBackground:z.enum(['plain','sage','sand','aurora']),wallpaperShade:z.number().int().min(50).max(95),wallpaperBlur:z.number().int().min(0).max(50),tabLayout:z.enum(['horizontal','vertical']),sidebarVisible:z.boolean()
}).strict();
export const themePackageSchema=z.object({version:z.literal(1),name:z.string().trim().min(1).max(60),visual:themeVisualSchema,studio:studioSchema}).strict();
export function parseTheme(text:string){if(text.length>64000)throw new Error('Theme file exceeds 64 KB.');return themePackageSchema.parse(JSON.parse(text));}
export function exportTheme(name:string,settings:z.infer<typeof themeVisualSchema>,studio:Studio){return JSON.stringify(themePackageSchema.parse({version:1,name,visual:themeVisualSchema.parse(Object.fromEntries(Object.keys(themeVisualSchema.shape).map(key=>[key,settings[key as keyof typeof settings]]))),studio}),null,2);}
