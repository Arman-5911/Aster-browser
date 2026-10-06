/** Exact hosts only: a lookalike domain must never receive site-specific hooks. */
export function supportsPlayerProtection(value:string):boolean{
  try{const url=new URL(value);return url.protocol==='https:'&&['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(url.hostname);}catch{return false;}
}
