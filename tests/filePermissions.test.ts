import {it,expect,vi} from 'vitest';
import type {Session,WebContents} from 'electron';
import path from 'node:path';
import {Repository} from '../src/main/database';
import {PrivacyService} from '../src/main/privacyService';

const dialogs=vi.hoisted(()=>({showMessageBox:vi.fn()}));
vi.mock('electron',()=>({dialog:dialogs}));
function setup(){
 const repo=new Repository(':memory:');const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 const privacy=new PrivacyService(repo,()=>{});log.mockRestore();
 const handlers:Record<string,Function>={};
 const session={setPermissionCheckHandler:(f:Function)=>handlers.check=f,setPermissionRequestHandler:(f:Function)=>handlers.request=f,setDevicePermissionHandler:vi.fn(),webRequest:Object.fromEntries(['onBeforeRequest','onBeforeSendHeaders','onHeadersReceived','onCompleted','onErrorOccurred'].map(k=>[k,vi.fn()]))} as unknown as Session;
 const wc={id:10,isDestroyed:()=>false,getURL:()=> 'https://example.com/editor',mainFrame:{framesInSubtree:[]},once:vi.fn()} as unknown as WebContents;
 privacy.register(wc,{id:'default',temporary:false});privacy.attach(session,{id:'default',temporary:false});
 const details={requestingUrl:'https://example.com/editor',isMainFrame:false,filePath:path.resolve('chosen.pdf'),fileAccessType:'writable',isDirectory:false};
 return {privacy,repo,wc,handlers,details};
}
it('grants only a confirmed file and clears permission on page navigation',async()=>{
 const {privacy,repo,wc,handlers,details}=setup();dialogs.showMessageBox.mockResolvedValue({response:1});
 try{
  expect(handlers.check(wc,'fileSystem','https://example.com',details)).toBe(false);
  const allowed=await new Promise<boolean>(r=>handlers.request(wc,'fileSystem',r,details));expect(allowed).toBe(true);
  expect(handlers.check(wc,'fileSystem','https://example.com',details)).toBe(true);
  expect(handlers.check(wc,'fileSystem','https://example.com',{...details,filePath:path.resolve('different.pdf')})).toBe(false);
  privacy.reset(wc.id);expect(handlers.check(wc,'fileSystem','https://example.com',details)).toBe(false);
 }finally{privacy.dispose();repo.close();}
});
it('rejects a pending file confirmation after navigation or window shutdown',async()=>{
 for(const shutDown of [false,true]){
  const {privacy,repo,wc,handlers,details}=setup();let answer!:(v:{response:number})=>void;dialogs.showMessageBox.mockImplementation(()=>new Promise(r=>answer=r));
  try{const result=new Promise<boolean>(r=>handlers.request(wc,'fileSystem',r,details));await vi.waitFor(()=>expect(answer).toBeTypeOf('function'));if(shutDown)privacy.dispose();else privacy.reset(wc.id);answer({response:1});expect(await result).toBe(false);}finally{privacy.dispose();repo.close();}
 }
});
