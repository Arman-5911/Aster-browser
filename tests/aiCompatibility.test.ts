import {it,expect,vi} from 'vitest';
import type {Session,WebContents} from 'electron';
import {aiCompatibilitySite} from '../src/shared/privacy';
import {PrivacyService} from '../src/main/privacyService';
import {Repository} from '../src/main/database';
it('matches exact HTTPS AI application hosts, not lookalikes or unrelated Google sites',()=>{
 for(const host of ['aistudio.google.com','gemini.google.com','chatgpt.com','claude.ai','copilot.microsoft.com','www.perplexity.ai','chat.deepseek.com','grok.com'])expect(aiCompatibilitySite('https://'+host+'/chat')).toBe(true);
 for(const url of ['https://aistudio.google.com.evil.test','https://evil.test/?site=chatgpt.com','https://google.com','https://youtube.com','http://aistudio.google.com','https://user:pass@chatgpt.com','not a URL'])expect(aiCompatibilitySite(url)).toBe(false);
});
it('preserves AI page cookies under Strict, restores Strict on navigation, and supports opting out',()=>{
 const repo=new Repository(':memory:');const log=vi.spyOn(console,'error').mockImplementation(()=>{});const privacy=new PrivacyService(repo,()=>{});log.mockRestore();
 const scope={id:'default',temporary:false};const handlers:Record<string,Function>={};const session={setPermissionCheckHandler:vi.fn(),setPermissionRequestHandler:vi.fn(),setDevicePermissionHandler:vi.fn(),webRequest:Object.fromEntries(['onBeforeRequest','onBeforeSendHeaders','onHeadersReceived','onCompleted','onErrorOccurred'].map(name=>[name,(handler:Function)=>{handlers[name]=handler;}]))} as unknown as Session;
 let top='https://aistudio.google.com/prompts/new_chat';const wc={id:7,getURL:()=>top,isDestroyed:()=>false,once:vi.fn()} as unknown as WebContents;
 try{repo.setSettings({...repo.settings(),protection:'strict'});privacy.register(wc,scope);privacy.attach(session,scope);
 const request=(id:number)=>handlers.onBeforeRequest({id,webContentsId:7,resourceType:'xhr',url:'https://api.example.net/generate',method:'POST'},vi.fn());
 request(1);const send=vi.fn(),receive=vi.fn();handlers.onBeforeSendHeaders({id:1,requestHeaders:{Cookie:'session=test'}},send);handlers.onHeadersReceived({id:1,responseHeaders:{'Set-Cookie':['session=test']}},receive);expect(send).toHaveBeenCalledWith({requestHeaders:{Cookie:'session=test'}});expect(receive).toHaveBeenCalledWith({responseHeaders:{'Set-Cookie':['session=test']}});expect(privacy.mode(scope,top)).toBe('off');expect(privacy.mode({...scope,temporary:true},top)).toBe('off');expect(privacy.decision(scope,top,'camera')).toBe('ask');
 top='https://ordinary.example/';request(2);const stripped=vi.fn();handlers.onBeforeSendHeaders({id:2,requestHeaders:{Cookie:'session=test'}},stripped);expect(stripped).toHaveBeenCalledWith({requestHeaders:{}});expect(privacy.mode(scope,top)).toBe('strict');
 repo.setSettings({...repo.settings(),aiSiteCompatibility:false});expect(privacy.mode(scope,'https://aistudio.google.com')).toBe('strict');privacy.setException(scope,'https://aistudio.google.com',true);expect(privacy.mode(scope,'https://aistudio.google.com')).toBe('off');
 }finally{privacy.dispose();repo.close();}
});
