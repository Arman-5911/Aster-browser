import {existsSync,readFileSync,writeFileSync,renameSync,rmSync,statSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {credentialSchema,type Credential,type VaultSnapshot} from '../shared/vault';
import {deriveKey,encrypt,decrypt,envelopeSchema,type Envelope} from './vaultCrypto';
export interface DeviceCrypto{available():boolean;encrypt(key:Buffer):Promise<string>;decrypt(wrapped:string):Promise<Buffer>}
const entriesSchema=z.array(credentialSchema).max(300).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length);
export class VaultStore{
  private envelope?:Envelope;private key?:Buffer;private entries:Credential[]=[];private timer?:ReturnType<typeof setTimeout>;private deadline=0;private epoch=0;private busy=false;private nextAttempt=0;private failures=0;private invalid=false;
  constructor(private file:string,private changed:()=>void,private timeout:()=>number,private device?:DeviceCrypto){if(existsSync(file))try{this.envelope=this.read();}catch{this.invalid=true;}}
  snapshot():VaultSnapshot{if(this.key&&Date.now()>=this.deadline)this.lock();return {exists:existsSync(this.file),locked:!this.key,deviceAvailable:this.device?.available()??false,deviceEnabled:!!this.envelope?.device,invalid:this.invalid,entries:this.key?this.entries.map(({password,...entry})=>entry):[]};}
  private read(){if(statSync(this.file).size>4000000)throw new Error('Invalid vault');return envelopeSchema.parse(JSON.parse(readFileSync(this.file,'utf8')));}
  private write(value:Envelope){const data=JSON.stringify(value);if(Buffer.byteLength(data)>4000000)throw new Error('Vault is too large.');const tmp=this.file+'.'+randomUUID()+'.tmp';try{writeFileSync(tmp,data,{flag:'wx',mode:0o600});const fd=openSync(tmp,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,this.file);this.envelope=value;this.invalid=false;}finally{rmSync(tmp,{force:true});}}
  private async operation(work:(epoch:number)=>Promise<void>){if(this.busy)throw new Error('Vault is busy. Try again.');this.busy=true;const epoch=this.epoch;try{await work(epoch);}finally{this.busy=false;this.changed();}}
  private touch(){clearTimeout(this.timer);this.deadline=Date.now()+this.timeout();this.timer=setTimeout(()=>this.lock(),this.timeout());this.timer.unref?.();}
  refreshTimeout(){if(this.key)this.requireKey();}
  lock(){this.epoch++;this.deadline=0;clearTimeout(this.timer);this.timer=undefined;this.key?.fill(0);this.key=undefined;this.entries=[];this.changed();}
  private requireKey(){if(this.key&&Date.now()>=this.deadline)this.lock();if(!this.key)throw new Error('Vault is locked.');this.touch();return this.key;}
  private attach(key:Buffer,envelope:Envelope,epoch:number){let plain:Buffer|undefined;try{plain=decrypt(key,envelope.contents,'entries');const entries=entriesSchema.parse(JSON.parse(plain.toString('utf8')));if(epoch!==this.epoch)throw new Error('Vault operation canceled.');this.key?.fill(0);this.key=key;this.entries=entries;this.envelope=envelope;this.touch();}catch(error){key.fill(0);throw error;}finally{plain?.fill(0);}}
  async create(master:string){await this.operation(async epoch=>{
    if(master.length<12||master.length>1024)throw new Error('Vault master password must have 12-1024 characters.');
    if(existsSync(this.file))throw new Error('Vault already exists.');
    const salt=randomBytes(16),key=randomBytes(32);let wrapping:Buffer|undefined;
    try{wrapping=await deriveKey(master,salt);if(epoch!==this.epoch)throw new Error('Vault operation canceled.');const envelope:Envelope={version:1,salt:salt.toString('base64'),wrapped:encrypt(wrapping,key,'key'),contents:encrypt(key,Buffer.from('[]'),'entries')};this.write(envelope);this.attach(key,envelope,epoch);}catch(error){key.fill(0);throw error;}finally{wrapping?.fill(0);}
  });}
  async unlock(master?:string){await this.operation(async epoch=>{if(Date.now()<this.nextAttempt)throw new Error('Vault unlock paused. Wait before retrying.');let key:Buffer|undefined;try{const envelope=this.read();if(master!==undefined){const wrapping=await deriveKey(master,Buffer.from(envelope.salt,'base64'));try{key=decrypt(wrapping,envelope.wrapped,'key');}finally{wrapping.fill(0);}}else{if(!this.device?.available()||!envelope.device)throw new Error('Unavailable');key=await this.device.decrypt(envelope.device);}if(key.length!==32)throw new Error('Invalid key');this.attach(key,envelope,epoch);this.failures=0;this.nextAttempt=0;}catch{key?.fill(0);this.nextAttempt=Date.now()+Math.min(30000,1000*2**Math.min(this.failures++,5));throw new Error('Vault could not be unlocked. Check the password or encrypted file.');}});}
  private persist(entries:Credential[]){const key=this.requireKey();const validated=entriesSchema.parse(entries);const plain=Buffer.from(JSON.stringify(validated));try{this.write({...this.envelope!,contents:encrypt(key,plain,'entries')});this.entries=validated;}finally{plain.fill(0);}this.changed();}
  save(value:Credential){this.requireKey();if(this.busy)throw new Error('Vault is busy.');const entry=credentialSchema.parse(value);const rows=this.entries.filter(r=>r.id!==entry.id);if(rows.length>=300)throw new Error('Vault supports up to 300 entries.');this.persist([...rows,entry]);}
  remove(id:string){this.requireKey();if(this.busy)throw new Error('Vault is busy.');this.persist(this.entries.filter(row=>row.id!==id));}
  get(id:string){this.requireKey();const entry=this.entries.find(row=>row.id===id);if(!entry)throw new Error('Vault entry not found.');return {...entry};}
  async remember(enabled:boolean){await this.operation(async epoch=>{const key=Buffer.from(this.requireKey());try{const envelope={...this.envelope!};if(enabled){if(!this.device?.available())throw new Error('Vault OS encryption is unavailable.');envelope.device=await this.device.encrypt(key);}else delete envelope.device;if(epoch!==this.epoch)throw new Error('Vault operation canceled.');this.write(envelope);}finally{key.fill(0);}});}
  async changeMaster(master:string){await this.operation(async epoch=>{
    if(master.length<12||master.length>1024)throw new Error('Vault master password must have 12-1024 characters.');
    const key=Buffer.from(this.requireKey()),salt=randomBytes(16);let wrapping:Buffer|undefined;
    try{wrapping=await deriveKey(master,salt);if(epoch!==this.epoch)throw new Error('Vault operation canceled.');const envelope={...this.envelope!,salt:salt.toString('base64'),wrapped:encrypt(wrapping,key,'key')};delete envelope.device;this.write(envelope);}finally{key.fill(0);wrapping?.fill(0);}
  });}
  exportEncrypted(){this.requireKey();const envelope={...this.envelope!};delete envelope.device;return JSON.stringify(envelope);}
  async importEncrypted(data:string,master:string){await this.operation(async epoch=>{if(existsSync(this.file))throw new Error('Vault import requires a fresh profile with no existing vault.');if(data.length>4000000)throw new Error('Vault file is too large.');const envelope=envelopeSchema.parse(JSON.parse(data));delete envelope.device;const wrapping=await deriveKey(master,Buffer.from(envelope.salt,'base64'));let key:Buffer|undefined;try{key=decrypt(wrapping,envelope.wrapped,'key');this.attach(key,envelope,epoch);this.write(envelope);}catch{this.lock();throw new Error('Vault import failed. Check the password and backup.');}finally{wrapping.fill(0);if(key!==this.key)key?.fill(0);}});}
}
