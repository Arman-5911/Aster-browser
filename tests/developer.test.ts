import {it,expect} from 'vitest';
import {RequestRecorder} from '../src/main/requestRecorder';
import {formatJson,inspectorUrl} from '../src/shared/developer';
import {commandSchema} from '../src/shared/schema';
it('records only opted-in tabs, redacts URL secrets and bounds memory',()=>{
  const r=new RequestRecorder();r.start(1,1,'https://example.com/a?token=secret','GET','xhr',false);expect(r.snapshot(1).requests).toEqual([]);
  r.set(1,true);for(let i=0;i<205;i++)r.start(1,i,'https://user:pass@example.com/api?token=secret#fragment','GET','xhr',false);
  expect(r.snapshot(1).requests).toHaveLength(200);expect(r.snapshot(1).requests[0].url).toBe('https://example.com/api');
  r.finish(1,204,201);expect(r.snapshot(1).requests.at(-1)).toMatchObject({status:201,result:'completed'});
  r.set(1,false);r.start(1,300,'https://example.com/b','GET','xhr',false);expect(r.snapshot(1).requests.at(-1)?.id).toBe(204);
  expect(r.snapshot(2).requests).toEqual([]);r.forget(1);expect(r.snapshot(1)).toEqual({recording:false,requests:[]});
  expect(inspectorUrl('not a url')).toBe('(invalid URL)');
});
it('formats JSON without execution and rejects oversized input',()=>{
  expect(formatJson('{"a":1}')).toBe('{\n  "a": 1\n}');expect(formatJson('{ "a": 1 }',true)).toBe('{"a":1}');
  expect(()=>formatJson('({a:process.exit()})')).toThrow();expect(()=>formatJson(' '.repeat(500001))).toThrow();
});
it('rejects arbitrary file destinations and invalid viewport sizes at IPC',()=>{
  expect(commandSchema.safeParse({type:'screenshot',action:'save',path:'C:/secret'}).success).toBe(false);
  expect(commandSchema.safeParse({type:'responsive',size:{width:99999,height:800}}).success).toBe(false);
  expect(commandSchema.safeParse({type:'responsive',size:{width:390,height:844}}).success).toBe(true);
});
it('retains safe Chromium failure codes without leaking arbitrary error text',()=>{
 const r=new RequestRecorder();r.set(1,true);r.start(1,1,'https://example.com/api','POST','xhr',false);r.finish(1,1,undefined,'net::ERR_CONNECTION_RESET');expect(r.snapshot(1).requests[0]).toMatchObject({result:'failed',error:'net::ERR_CONNECTION_RESET'});
 r.start(1,2,'https://example.com/api','POST','xhr',false);r.finish(1,2,undefined,'Error with token=secret');expect(r.snapshot(1).requests[1].error).toBe('Network request failed');
});
