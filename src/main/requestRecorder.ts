import {inspectorUrl,type RequestRecord} from '../shared/developer';
export class RequestRecorder{
  private records=new Map<number,RequestRecord[]>();private enabled=new Set<number>();
  set(id:number,on:boolean){if(on){this.enabled.add(id);if(!this.records.has(id))this.records.set(id,[]);}else this.enabled.delete(id);}
  snapshot(id:number){return {recording:this.enabled.has(id),requests:(this.records.get(id)??[]).map(r=>({...r}))};}
  clear(id:number){this.records.delete(id);}
  forget(id:number){this.clear(id);this.enabled.delete(id);}
  start(wcId:number,id:number,url:string,method:string,type:string,blocked:boolean){
    if(!this.enabled.has(wcId))return;
    const rows=this.records.get(wcId)??[];
    rows.push({id,url:inspectorUrl(url),method:method.slice(0,20),type,started:Date.now(),result:blocked?'blocked':'pending',...(blocked?{elapsed:0}:{})});
    this.records.set(wcId,rows.slice(-200));
  }
  finish(wcId:number,id:number,status:number|undefined,error?:string){const row=[...(this.records.get(wcId)??[])].reverse().find(r=>r.id===id&&r.result==='pending');if(row){row.status=status;row.elapsed=Math.max(0,Date.now()-row.started);row.result=error?'failed':'completed';if(error)row.error=/^net::ERR_[A-Z0-9_]{1,80}$/.test(error)?error:'Network request failed';}}
}
