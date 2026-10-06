import {z} from 'zod';
export const articleSchema=z.object({title:z.string().max(500),text:z.string().min(200).max(300000),byline:z.string().max(300)});
export type Article=z.infer<typeof articleSchema>&{url:string;tabId:string};
/** Serialized into the isolated page world. Extract text, never remote markup. */
export function extractArticle(){
  const source=document.querySelector('article')??document.querySelector('main')??document.body;
  if(!source)return null;
  const copy=source.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,button,input,textarea,select,iframe,video,audio,[hidden],[aria-hidden="true"]').forEach(node=>node.remove());
  const blocks=[...copy.querySelectorAll('h1,h2,h3,p,blockquote,pre,li')].filter(node=>!node.parentElement?.closest('blockquote,pre,li'));
  const text=(blocks.length?blocks.map(node=>node.textContent?.trim()).filter(Boolean).join('\n\n'):copy.textContent??'').trim().slice(0,300000);
  return {title:(document.querySelector('h1')?.textContent||document.title).trim().slice(0,500),text,byline:(document.querySelector('meta[name="author"]')?.getAttribute('content')??'').slice(0,300)};
}
