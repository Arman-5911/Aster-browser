import {isWebUrl} from './navigation';
export interface SuggestionSource {url:string;title:string;kind:'Open tab'|'Bookmark'|'History'|'Shortcut'}
export function searchSuggestions(query:string,sources:SuggestionSource[],limit=8){
 const needle=query.trim().toLocaleLowerCase();if(!needle||needle.length>2048)return [];
 const seen=new Set<string>();return sources.map((s,index)=>({...s,index,text:(s.title+' '+s.url).toLocaleLowerCase()})).filter(s=>isWebUrl(s.url)&&s.text.includes(needle)).sort((a,b)=>Number(b.url.toLocaleLowerCase().startsWith(needle)||b.title.toLocaleLowerCase().startsWith(needle))-Number(a.url.toLocaleLowerCase().startsWith(needle)||a.title.toLocaleLowerCase().startsWith(needle))||a.index-b.index).filter(s=>{if(seen.has(s.url))return false;seen.add(s.url);return true;}).slice(0,limit).map(({url,title,kind})=>({url,title,kind}));
}
