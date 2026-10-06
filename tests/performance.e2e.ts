import AxeBuilder from '@axe-core/playwright';
import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import {createServer} from 'node:http';
test('sleep releases background pages, protects forms and wakes on selection',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'aster-performance-'));const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Memory fixture</title><h1>Fixture</h1>'+(req.url==='/form'?'<input aria-label="Draft">':''));});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+(server.address() as {port:number}).port;
 const env:Record<string,string>={...Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined)),ASTER_TEST_PROFILE:root};delete env.ELECTRON_RUN_AS_NODE;const app=await electron.launch({executablePath:process.env.ASTER_PACKAGED_EXE,args:process.env.ASTER_PACKAGED_EXE?[]:['.'],env});
 try{await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);const page=app.windows().find(p=>p.url().startsWith('aster://app/'))!;await page.waitForFunction(()=>!!window.aster);
 await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/plain');await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).tabs[0].loading).toBe(false);const id=(await page.evaluate(()=>window.aster.snapshot())).activeId;
 expect((await page.evaluate(id=>window.aster.command({type:'sleep-tab',id}),id)).ok).toBe(false);
 await page.evaluate(()=>window.aster.command({type:'panel',value:'performance'}));await expect(page.getByRole('heading',{name:'A lighter browser.'})).toBeVisible();expect((await page.evaluate(()=>window.aster.snapshot())).performance.memoryMB).toBeGreaterThan(0);expect((await new AxeBuilder({page}).setLegacyMode().include('.panel-content').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
 // Playwright captures native pages for snapshots. Verify protection, then simulate capture ending.
 expect((await page.evaluate(id=>window.aster.command({type:'sleep-tab',id}),id)).ok).toBe(false);
 await app.evaluate(({webContents},url)=>{webContents.getAllWebContents().find(w=>w.getURL()===url)!.isBeingCaptured=()=>false;},origin+'/plain');
 expect(await page.evaluate(id=>window.aster.command({type:'sleep-tab',id}),id)).toEqual({ok:true});expect(await app.evaluate(({webContents},url)=>webContents.getAllWebContents().some(w=>w.getURL()===url),origin+'/plain')).toBe(false);
 expect((await page.evaluate(()=>window.aster.snapshot())).tabs.find(t=>t.id===id)?.sleeping).toBe(true);
 await page.evaluate(id=>window.aster.command({type:'select-tab',id}),id);await expect.poll(()=>app.evaluate(({webContents},url)=>webContents.getAllWebContents().some(w=>w.getURL()===url),origin+'/plain')).toBe(true);
 await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/form');await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).tabs.find(t=>t.id===id)?.loading).toBe(false);await page.evaluate(()=>window.aster.command({type:'panel',value:'performance'}));await app.evaluate(({webContents},url)=>{webContents.getAllWebContents().find(w=>w.getURL()===url)!.isBeingCaptured=()=>false;},origin+'/form');expect((await page.evaluate(id=>window.aster.command({type:'sleep-tab',id}),id)).ok).toBe(false);
 await page.evaluate(id=>window.aster.command({type:'pin-tab',id}),id);expect((await page.evaluate(id=>window.aster.command({type:'sleep-tab',id}),id)).ok).toBe(false);
 await page.getByRole('checkbox',{name:'Automatically sleep idle background tabs'}).click();await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).settings.autoSleep).toBe(true);
 await page.getByRole('tab',{name:'Performance',exact:true}).focus();await page.keyboard.press('Home');await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).activeId).toBe(id);
 }finally{await app.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(!path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep))throw Error('Unsafe cleanup');rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

