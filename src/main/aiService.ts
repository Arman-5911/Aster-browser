import {createHash,randomUUID} from 'node:crypto';
import {aiConfigSchema,buildAIMessages,sourceSchema,type AIConfig,type AIAction,type AISource,type AIMessage,type AIPreview} from '../shared/ai';
import type {Repository} from './database';
export class AIProvider{
  config:AIConfig;private key='';private requests=new Set<AbortController>();
  constructor(private repo:Repository,private fetcher:typeof fetch=fetch){this.config=repo.aiConfig();}
  get keySet(){return !!this.key;}
  configure(config:AIConfig,key?:string){for(const request of this.requests)request.abort();const next=aiConfigSchema.parse(config);if(next.endpoint!==this.config.endpoint||next.provider!==this.config.provider||next.provider==='disabled')this.key='';if(key!==undefined&&next.provider!=='disabled')this.key=key;this.config=next;this.repo.setAIConfig(next);}
  fingerprint(){return JSON.stringify(this.config);}
  async request(messages:AIMessage[],signal:AbortSignal){
    const config=aiConfigSchema.parse(this.config);if(config.provider==='disabled')throw new Error('AI provider is disabled.');if(this.requests.size>=2)throw new Error('AI is handling two requests already.');
    const abort=new AbortController(),stop=()=>abort.abort();signal.addEventListener('abort',stop,{once:true});if(signal.aborted)abort.abort();this.requests.add(abort);const timer=setTimeout(()=>abort.abort(),90000);
    try{
      const body=config.provider==='ollama'?{model:config.model,messages,stream:false,options:{num_predict:config.maxTokens}}:{model:config.model,messages,stream:false,store:false,max_completion_tokens:config.maxTokens};
      const response=await this.fetcher(config.endpoint,{method:'POST',redirect:'error',credentials:'omit',headers:{'Content-Type':'application/json',...(this.key?{Authorization:`Bearer ${this.key}`}:{})},body:JSON.stringify(body),signal:abort.signal});
      if(!response.ok){await response.body?.cancel();throw new Error(`AI provider returned HTTP ${response.status}. Check provider settings and quota.`);}
      const reader=response.body?.getReader();if(!reader)throw new Error('AI provider returned an empty response.');let size=0;const chunks:Uint8Array[]=[];
      try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>256000){await reader.cancel();throw new Error('AI response exceeded the 256 KB limit.');}chunks.push(value);}}finally{reader.releaseLock();}
      const json=JSON.parse(Buffer.concat(chunks).toString('utf8'));const result=config.provider==='ollama'?json.message?.content:json.choices?.[0]?.message?.content;
      if(typeof result!=='string'||!result.trim()||result.length>60000)throw new Error('AI provider returned unsupported or empty text.');return result;
    }catch(error){if(error instanceof Error&&error.message.startsWith('AI '))throw error;throw new Error(abort.signal.aborted?'AI request canceled or timed out.':'AI connection failed. Check the endpoint, model and credentials.');}
    finally{clearTimeout(timer);signal.removeEventListener('abort',stop);this.requests.delete(abort);}
  }
}
export class AISession{
  answerSources:AISource[]=[];sources:AISource[]=[];preview?:AIPreview;history:AIMessage[]=[];answer='';error='';cached=false;private controller?:AbortController;private reviewConfig='';private generation=0;
  constructor(private repo:Repository,readonly provider:AIProvider,private changed:()=>void){}
  get busy(){return !!this.controller;}
  cancel(){this.generation++;this.controller?.abort();this.controller=undefined;this.preview=undefined;this.changed();}
  clear(){this.cancel();this.sources=[];this.answerSources=[];this.history=[];this.answer='';this.error='';this.cached=false;}
  add(source:AISource){if(this.sources.length>=5)throw new Error('AI supports up to five sources per request. Remove one first.');this.cancel();this.sources.push(sourceSchema.parse(source));this.history=[];}
  prepare(action:AIAction,prompt:string,ids:string[]){
    if(this.busy)throw new Error('AI request is already running.');if(this.provider.config.provider==='disabled')throw new Error('AI provider is disabled. Configure one first.');
    const sources=ids.map(id=>this.sources.find(s=>s.id===id));if(!sources.length||sources.some(s=>!s))throw new Error('AI needs captured source text.');
    const chosen=sources as AISource[];if(chosen.reduce((sum,s)=>sum+s.text.length,0)>60000)throw new Error('AI source text exceeds 60,000 characters. Shorten the excerpts.');
    const messages=buildAIMessages(action,prompt,chosen,this.history);if(messages.reduce((n,m)=>n+m.content.length,0)>100000)throw new Error('AI conversation exceeds 100,000 characters. Clear context and capture again.');this.reviewConfig=this.provider.fingerprint();this.preview={id:randomUUID(),action,destination:this.provider.config.endpoint,model:this.provider.config.model,messages,characters:messages.reduce((n,m)=>n+m.content.length,0),sources:structuredClone(chosen)};this.error='';
  }
  async send(id:string,scope:string,cache:boolean){
    if(this.busy||!this.preview||this.preview.id!==id||this.reviewConfig!==this.provider.fingerprint())throw new Error('AI preview expired. Review the content again.');
    const preview=this.preview;this.preview=undefined;const signature=createHash('sha256').update(this.reviewConfig+JSON.stringify(preview.messages)).digest('hex');
    this.cached=false;this.error='';this.answer='';const controller=new AbortController();this.controller=controller;const generation=++this.generation;this.changed();
    try{
      const cached=cache?this.repo.aiCache(scope,signature):undefined;const answer=cached??await this.provider.request(preview.messages,controller.signal);if(generation!==this.generation||controller.signal.aborted)return;
      this.answerSources=preview.sources;this.answer=answer;this.cached=!!cached;if(cache&&!cached)this.repo.saveAICache(scope,signature,answer);
      if(preview.action==='chat')this.history=[...this.history,preview.messages.at(-1)!,{role:'assistant',content:answer}].slice(-8) as AIMessage[];
    }catch(error){if(generation===this.generation)this.error=error instanceof Error?error.message:'AI request failed.';}
    finally{if(generation===this.generation){this.controller=undefined;this.changed();}}
  }
}
