import {z} from 'zod';
export const vaultOrigin=z.string().max(2048).refine(value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.origin===value&&!url.username&&!url.password;}catch{return false;}});
export const credentialSchema=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(120),origin:vaultOrigin,username:z.string().max(300),password:z.string().min(1).max(4096)}).strict();
export type Credential=z.infer<typeof credentialSchema>;
export interface VaultSnapshot{exists:boolean;locked:boolean;deviceAvailable:boolean;deviceEnabled:boolean;invalid:boolean;entries:Omit<Credential,'password'>[]}
export function generatePassword(length:number,options:{upper:boolean;lower:boolean;digits:boolean;symbols:boolean}){
  if(!Number.isInteger(length)||length<12||length>128)throw new Error('Choose 12–128 characters.');
  const groups=[options.upper?'ABCDEFGHJKLMNPQRSTUVWXYZ':'',options.lower?'abcdefghijkmnopqrstuvwxyz':'',options.digits?'23456789':'',options.symbols?'!@#$%^&*()-_=+[]{}:,.?':''].filter(Boolean);
  if(!groups.length)throw new Error('Select at least one character set.');
  const pick=(n:number)=>{const bytes=new Uint8Array(1);let value:number;do{crypto.getRandomValues(bytes);value=bytes[0];}while(value>=256-256%n);return value%n;};
  const all=groups.join('');const result=groups.map(group=>group[pick(group.length)]);while(result.length<length)result.push(all[pick(all.length)]);
  for(let i=result.length-1;i>0;i--){const j=pick(i+1);[result[i],result[j]]=[result[j],result[i]];}return result.join('');
}
