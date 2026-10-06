import {z} from 'zod';
export const permissionSchema=z.enum(['camera','microphone','location','notifications','clipboard-read','fullscreen','popups']);
export const permissionValueSchema=z.enum(['allow','ask','block']);
export const protectionSchema=z.enum(['standard','strict','off']);
export const siteOriginSchema=z.string().max(2048).refine(value=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&url.origin===value&&!url.username&&!url.password;}catch{return false;}});
export type SitePermission=z.infer<typeof permissionSchema>;
export type PermissionValue=z.infer<typeof permissionValueSchema>;
export type Protection=z.infer<typeof protectionSchema>;
export const permissionLabels:Record<SitePermission,string>={camera:'Camera',microphone:'Microphone',location:'Location',notifications:'Notifications','clipboard-read':'Read clipboard',fullscreen:'Fullscreen',popups:'Popups'};
export const permissionDefaults:Record<SitePermission,PermissionValue>={camera:'ask',microphone:'ask',location:'ask',notifications:'block','clipboard-read':'block',fullscreen:'ask',popups:'block'};
export interface PermissionPrompt{id:string;origin:string;permissions:SitePermission[];expiresAt:number}
export interface PrivacyStats{requests:number;thirdParty:number;trackersBlocked:number;adsBlocked:number;cookieHeadersBlocked:number;popupsBlocked:number;redirects:number;permissionsBlocked:number;blockedDomains:string[]}
export interface CookieInfo{id:string;name:string;domain:string;path:string;secure:boolean;httpOnly:boolean;session:boolean}
export interface PrivacySnapshot{origin:string;mode:Protection;exception:boolean;automaticCompatibility:boolean;temporary:boolean;stats:PrivacyStats;permissions:Record<SitePermission,PermissionValue>;filters:{ready:boolean;retrievedAt:string};cookies:CookieInfo[];cookiesLoaded:boolean;receipt?:{cookies:number;cleared:boolean;message:string}}
export const emptyStats=():PrivacyStats=>({requests:0,thirdParty:0,trackersBlocked:0,adsBlocked:0,cookieHeadersBlocked:0,popupsBlocked:0,redirects:0,permissionsBlocked:0,blockedDomains:[]});

// Exact application hosts only: do not exempt all Google domains or embedded AI widgets.
const aiCompatibilityHosts=new Set(['aistudio.google.com','gemini.google.com','chatgpt.com','chat.openai.com','claude.ai','copilot.microsoft.com','www.perplexity.ai','perplexity.ai','chat.deepseek.com','grok.com']);
export function aiCompatibilitySite(value:string){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&aiCompatibilityHosts.has(url.hostname);}catch{return false;}}
