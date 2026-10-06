import {it,expect,vi} from 'vitest';
import type {Session} from 'electron';
import {PrivacyService} from '../src/main/privacyService';
import {Repository} from '../src/main/database';
it('rejects late requests without reading the closed database or scheduling UI updates',()=>{
 vi.useFakeTimers();const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 const repo=new Repository(':memory:');const changed=vi.fn();const privacy=new PrivacyService(repo,changed);
 const handlers:Record<string,Function>={};const session={setPermissionCheckHandler:vi.fn(),setPermissionRequestHandler:vi.fn(),setDevicePermissionHandler:vi.fn(),webRequest:Object.fromEntries(['onBeforeRequest','onBeforeSendHeaders','onHeadersReceived','onCompleted','onErrorOccurred'].map(name=>[name,(handler:Function)=>{handlers[name]=handler;}]))} as unknown as Session;
 try{privacy.attach(session,{id:'workspace',temporary:false});privacy.dispose();privacy.dispose();repo.close();const callback=vi.fn();expect(()=>handlers.onBeforeRequest({id:1,url:'https://example.com',resourceType:'mainFrame'},callback)).not.toThrow();expect(callback).toHaveBeenCalledWith({cancel:true});for(const name of ['onBeforeSendHeaders','onHeadersReceived']){const reply=vi.fn();expect(()=>handlers[name]({id:1,requestHeaders:{Cookie:'test'},responseHeaders:{'Set-Cookie':['test']}},reply)).not.toThrow();expect(reply).toHaveBeenCalledWith({cancel:true});}handlers.onErrorOccurred({id:1,error:'net::ERR_ABORTED'});vi.runAllTimers();expect(changed).not.toHaveBeenCalled();}finally{vi.useRealTimers();log.mockRestore();}
});
it('never queries the repository through late privacy decisions after disposal',()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});const repo=new Repository(':memory:');const privacy=new PrivacyService(repo,()=>{});log.mockRestore();const scope={id:'default',temporary:false};privacy.dispose();repo.close();
 expect(()=>privacy.mode(scope,'https://example.com')).not.toThrow();
 expect(privacy.decision(scope,'https://example.com','camera')).toBe('block');
 expect(privacy.automaticCompatibility('https://aistudio.google.com')).toBe(false);
 expect(()=>privacy.setException(scope,'https://example.com',true)).not.toThrow();
});
it('reuses lightweight privacy settings during request bursts and invalidates on edits',()=>{
 const repo=new Repository(':memory:');try{const settings=vi.spyOn(repo,'settings');for(let i=0;i<1000;i++)repo.privacySettings();expect(settings).toHaveBeenCalledTimes(1);const value=repo.settings();repo.setSettings({...value,protection:'off',aiSiteCompatibility:false});expect(repo.privacySettings()).toEqual({protection:'off',aiSiteCompatibility:false});expect(repo.settings().protection).toBe('off');}finally{repo.close();}
});
