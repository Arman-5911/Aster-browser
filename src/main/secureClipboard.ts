import {createHash,timingSafeEqual} from 'node:crypto';
type ClipboardPort={writeText(text:string):Promise<void>;readText():Promise<string>;clear():void};
export class SecureClipboard{
  private digest?:Buffer;private timer?:ReturnType<typeof setTimeout>;private queue:Promise<void>=Promise.resolve();
  constructor(private port:ClipboardPort){}
  private run(work:()=>Promise<void>){const next=this.queue.then(work,work);this.queue=next.catch(()=>{});return next;}
  copy(secret:string,seconds:number){return this.run(async()=>{await this.port.writeText(secret);clearTimeout(this.timer);this.digest?.fill(0);const digest=createHash('sha256').update(secret).digest();this.digest=digest;if(seconds>0){this.timer=setTimeout(()=>void this.clear(digest),seconds*1000);this.timer.unref?.();}});}
  clear(expected?:Buffer){return this.run(async()=>{if(expected&&this.digest!==expected)return;clearTimeout(this.timer);const digest=this.digest;this.digest=undefined;if(!digest)return;try{const current=createHash('sha256').update(await this.port.readText()).digest();if(timingSafeEqual(digest,current))this.port.clear();}catch{/* Do not log clipboard contents or overwrite unreadable data. */}finally{digest.fill(0);}});}
}
