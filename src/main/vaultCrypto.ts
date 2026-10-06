import {createCipheriv,createDecipheriv,randomBytes,scrypt} from 'node:crypto';
import {z} from 'zod';
const encoded=(bytes:number)=>z.string().refine(s=>/^[A-Za-z0-9+/]*={0,2}$/.test(s)&&Buffer.from(s,'base64').length===bytes);
export const boxSchema=z.object({iv:encoded(12),tag:encoded(16),data:z.string().max(4000000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).strict();
export const envelopeSchema=z.object({version:z.literal(1),salt:encoded(16),wrapped:boxSchema,contents:boxSchema,device:z.string().max(20000).optional()}).strict();
export type Envelope=z.infer<typeof envelopeSchema>;
export function deriveKey(master:string,salt:Buffer):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(master,salt,32,{N:131072,r:8,p:1,maxmem:256*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
export function encrypt(key:Buffer,plain:Buffer,context:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('aster-vault-v1:'+context));const data=Buffer.concat([cipher.update(plain),cipher.final()]);return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};}
export function decrypt(key:Buffer,box:z.infer<typeof boxSchema>,context:string){const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));cipher.setAAD(Buffer.from('aster-vault-v1:'+context));cipher.setAuthTag(Buffer.from(box.tag,'base64'));const first=cipher.update(Buffer.from(box.data,'base64'));try{return Buffer.concat([first,cipher.final()]);}finally{first.fill(0);}}
