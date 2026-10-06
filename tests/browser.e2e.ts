import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

let server:Server;let origin:string;
test.beforeAll(async()=>{server=createServer((req,res)=>{
  if(req.url==='/download'){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="aster-test.txt"'});res.end('Aster download test');return;}
  if(req.url==='/redirect'){res.writeHead(302,{Location:'file:///C:/Windows/win.ini'});res.end();return;}
  res.writeHead(200,{'Content-Type':'text/html'});res.end(`<!doctype html><html><head><title>${req.url==='/two'?'Second page':'Test garden'}</title></head><body><h1>Real Chromium content</h1><a href="/two">Next page</a><a href="/download">Download</a><input type="file"/><script>window.siteCheck={node:typeof require,bridge:typeof window.aster};</script></body></html>`);
});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;});
test.afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));

async function launch(profile:string){const env:Record<string,string>=Object.fromEntries(Object.entries(process.env).filter((entry):entry is [string,string]=>entry[1]!==undefined));env.ASTER_TEST_PROFILE=profile;delete env.ELECTRON_RUN_AS_NODE;return electron.launch({args:['.'],env,timeout:30000});}
async function chrome(app:ElectronApplication){await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);return app.windows().find(p=>p.url().startsWith('aster://app/'))!;}
async function snapshot(app:ElectronApplication){const page=await chrome(app);await page.waitForFunction(()=>typeof window.aster?.snapshot==='function');return page.evaluate(()=>window.aster.snapshot());}
test('real browsing, tabs, persistence and isolation',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-e2e-'));let app=await launch(profile);
  try{
    const page=await chrome(app);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await expect(page.getByRole('heading',{name:'Make space for something great.'})).toBeVisible();
    expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible())).toBe(true);
    await page.screenshot({path:'test-results/start-page.png'});
    await page.getByRole('combobox',{name:'Address and search',exact:true}).fill(origin);
    await page.getByRole('combobox',{name:'Address and search',exact:true}).press('Enter');
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    await expect.poll(async()=>(await snapshot(app)).history.length).toBe(1);
    const isolation=await app.evaluate(async({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1'));return site?.executeJavaScript('window.siteCheck');});
    expect(isolation).toEqual({node:'undefined',bridge:'undefined'});
    const prefs=await app.evaluate(({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1'));return (site as unknown as {getLastWebPreferences():unknown})?.getLastWebPreferences();});
    expect(prefs).toMatchObject({sandbox:true,contextIsolation:true,nodeIntegration:false});
    const denied=await app.evaluate(async({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1'));return site?.executeJavaScript('Notification.requestPermission()');});expect(denied).toBe('denied');
    await page.getByRole('button',{name:'Bookmark this page (Ctrl+D)'}).click();
    await expect.poll(async()=>(await snapshot(app)).bookmarks.length).toBe(1);
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/two');
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Second page');
    await page.getByRole('button',{name:'Back (Alt+Left)'}).click();
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    await page.getByRole('button',{name:'Forward (Alt+Right)'}).click();
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Second page');
    const first=(await snapshot(app)).tabs[0].id;
    await page.evaluate(id=>window.aster.command({type:'duplicate-tab',id}),first);
    await expect.poll(async()=>(await snapshot(app)).tabs.length).toBe(2);
    const second=(await snapshot(app)).activeId;
    await page.evaluate(id=>window.aster.command({type:'pin-tab',id}),second);
    expect((await snapshot(app)).tabs[0].pinned).toBe(true);
    await page.evaluate(id=>window.aster.command({type:'mute-tab',id}),second);
    expect((await snapshot(app)).tabs[0].muted).toBe(true);
    await page.evaluate(id=>window.aster.command({type:'close-tab',id}),second);
    expect((await snapshot(app)).tabs).toHaveLength(1);
    await page.evaluate(()=>window.aster.command({type:'restore-tab'}));
    expect((await snapshot(app)).tabs).toHaveLength(2);
    await page.getByRole('button',{name:'Browser menu',exact:true}).click();
    await page.getByRole('button',{name:'Settings',exact:true}).click();
    await page.getByRole('button',{name:'dark',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await expect(page.getByRole('button',{name:'dark',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.screenshot({path:'test-results/settings-dark.png',animations:'disabled'});
    const malformed=await page.evaluate(()=>window.aster.command({type:'exec'} as never));expect(malformed.ok).toBe(false);
    const invalid=await page.evaluate(()=>window.aster.command({type:'navigate',input:'javascript:alert(1)'}));expect(invalid.ok).toBe(false);
    expect(errors).toEqual([]);
    await app.close();app=await launch(profile);
    const restored=await snapshot(app);expect(restored.settings.theme).toBe('dark');expect(restored.bookmarks).toHaveLength(1);expect(restored.history.length).toBeGreaterThan(0);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('download lifecycle and site-to-UI boundary',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-download-e2e-'));const app=await launch(profile);
  try{
    const page=await chrome(app);await expect(page.getByRole('heading',{name:'Make space for something great.'})).toBeVisible();
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    const target=path.join(profile,'aster-test.txt');
    // Supply a path in the test harness only to bypass the OS save dialog.
    await app.evaluate(({session},savePath)=>{session.fromPartition('persist:aster-default').once('will-download',(_e,item)=>item.setSavePath(savePath));},target);
    await app.evaluate(async({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1'));if(site)site.downloadURL(new URL('/download',site.getURL()).href);});
    await expect.poll(async()=>(await snapshot(app)).downloads[0]?.state).toBe('completed');
    expect((await snapshot(app)).downloads[0].received).toBe(19);
    const blocked=await app.evaluate(async({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1'));return site?.executeJavaScript(`fetch('aster://app/index.html').then(()=>false).catch(()=>true)`);});expect(blocked).toBe(true);
    await app.evaluate(async({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1'));await site?.executeJavaScript(`window.open('https://example.com')`);});
    expect((await snapshot(app)).tabs).toHaveLength(1);
    await page.evaluate(()=>window.aster.command({type:'panel',value:'downloads'}));
    await expect(page.getByText('aster-test.txt', {exact:true})).toBeVisible();
    await page.screenshot({path:'test-results/downloads.png'});
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('vertical tabs, workspace cookies, groups and moved tabs',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-workspaces-e2e-'));const app=await launch(profile);
  try{
    const page=await chrome(app);await snapshot(app);
    const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    await page.evaluate(()=>window.aster.command({type:'bookmark'}));
    await app.evaluate(async({session},url)=>{await session.fromPartition('persist:aster-default').cookies.set({url,name:'identity',value:'personal'});},origin);
    await page.getByRole('button',{name:'Toggle vertical tabs',exact:true}).click();
    await expect(page.getByRole('tablist',{name:'Vertical tabs'})).toBeVisible();
    await page.getByRole('button',{name:'Manage workspaces and groups'}).click();
    await page.getByRole('textbox',{name:'New workspace name'}).fill('Study');
    await page.getByRole('button',{name:'Create workspace',exact:true}).click();
    await expect.poll(async()=>(await snapshot(app)).workspaces.length).toBe(2);
    let state=await snapshot(app);const studyId=state.activeWorkspaceId;
    expect(state.bookmarks).toHaveLength(0);expect(state.history).toHaveLength(0);
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    const cookies=await app.evaluate(async({session},id)=>session.fromPartition(`persist:aster-workspace-${id}`).cookies.get({name:'identity'}),studyId);expect(cookies).toEqual([]);
    await page.evaluate(()=>window.aster.command({type:'bookmark'}));
    await page.getByRole('button',{name:'Manage workspaces and groups'}).click();
    await page.getByRole('textbox',{name:'New group name'}).fill('Sources');
    await page.getByRole('button',{name:'Create group',exact:true}).click();
    await expect.poll(async()=>(await snapshot(app)).workspaces.find(w=>w.id===studyId)!.groups.length).toBe(1);
    await page.getByRole('button',{name:'Collapse Sources',exact:true}).click();
    await expect(page.getByRole('button',{name:'Expand Sources',exact:true})).toBeVisible();
    await page.getByRole('textbox',{name:'Search open tabs'}).fill('garden');
    await expect(page.getByRole('tab',{name:'Test garden',exact:true})).toBeVisible();
    await page.getByRole('textbox',{name:'Search open tabs'}).fill('');
    await page.getByRole('button',{name:'Expand Sources',exact:true}).click();
    await page.evaluate(()=>window.aster.command({type:'new-tab'}));
    const moved=(await snapshot(app)).activeId;
    await page.evaluate(({id,target})=>window.aster.command({type:'tab-move',id,workspaceId:target}),{id:moved,target:'default'});
    expect((await snapshot(app)).tabs).toHaveLength(1);
    await page.getByRole('combobox',{name:'Workspace',exact:true}).selectOption('default');
    state=await snapshot(app);expect(state.bookmarks).toHaveLength(1);expect(state.tabs).toHaveLength(2);
    const identity=await app.evaluate(async({session})=>session.fromPartition('persist:aster-default').cookies.get({name:'identity'}));expect(identity[0].value).toBe('personal');
    await page.evaluate(id=>window.aster.command({type:'workspace-switch',id}),studyId);
    const group=(await snapshot(app)).workspaces.find(w=>w.id===studyId)!.groups[0];
    await page.evaluate(id=>window.aster.command({type:'group-move',id,workspaceId:'default'}),group.id);
    expect((await snapshot(app)).tabs).toHaveLength(1);
    await page.evaluate(()=>window.aster.command({type:'workspace-switch',id:'default'}));
    expect((await snapshot(app)).workspaces.find(w=>w.id==='default')!.groups[0].name).toBe('Sources');
    await page.evaluate(id=>window.aster.command({type:'workspace-delete',id}),studyId);
    expect((await snapshot(app)).workspaces).toHaveLength(1);
    await page.getByRole('button',{name:'Manage workspaces and groups'}).click();
    await expect(page.getByRole('heading',{name:'Give your ideas a place.'})).toBeVisible();
    await page.screenshot({path:'test-results/phase2-workspaces.png',animations:'disabled'});
    expect(errors).toEqual([]);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('split layouts resize real views and floating tabs dock without reload',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-split-e2e-'));const app=await launch(profile);
  try{
    const page=await chrome(app);await snapshot(app);
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    await page.getByRole('button',{name:'Toggle vertical tabs',exact:true}).click();
    await page.getByRole('button',{name:'Toggle split view (Ctrl+Shift+S)'}).click();
    await expect(page.getByRole('combobox',{name:'Split layout'})).toHaveValue('columns');
    await page.getByRole('combobox',{name:'Split layout'}).selectOption('grid');
    const tabs=(await snapshot(app)).tabs;
    expect(tabs).toHaveLength(4);
    for(const [index,tab] of tabs.entries()){
      await page.evaluate(id=>window.aster.command({type:'select-tab',id}),tab.id);
      await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),`${origin}/two?pane=${index}`);
    }
    await expect.poll(async()=>app.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>w.getURL().startsWith('http://127.0.0.1')).length)).toBe(4);
    expect((await snapshot(app)).tabs.map(t=>t.url)).toEqual(tabs.map((_t,index)=>`${origin}/two?pane=${index}`));
    await app.evaluate(({webContents})=>{const site=webContents.getAllWebContents().find(w=>w.getURL().includes('pane=0'));site?.sendInputEvent({type:'mouseDown',x:20,y:20,button:'left',clickCount:1});site?.sendInputEvent({type:'mouseUp',x:20,y:20,button:'left',clickCount:1});});
    await expect.poll(async()=>(await snapshot(app)).activeId).toBe(tabs[0].id);
    await expect(page.getByRole('combobox',{name:'Tab in pane 4'})).toBeVisible();
    const separator=page.getByRole('separator',{name:'Resize columns'});
    await separator.focus();await separator.press('ArrowRight');
    await expect(separator).toHaveAttribute('aria-valuenow','55');
    const bounds=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.map(v=>v.getBounds()));
    expect(bounds.filter(b=>b.y>=176&&b.x>=240).length).toBe(4);
    const box=await separator.boundingBox();expect(box).not.toBeNull();
    await page.mouse.move(box!.x+box!.width/2,box!.y+50);await page.mouse.down();await page.mouse.move(box!.x+70,box!.y+50,{steps:5});await page.mouse.up();
    await expect.poll(async()=>(await snapshot(app)).workspaces[0].split.x).toBeGreaterThan(.55);
    await expect.poll(async()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children.filter(v=>v.getBounds().y>=176&&v.getVisible()).length)).toBe(4);
    await page.screenshot({path:'test-results/phase2-split.png',animations:'disabled'});
    const first=tabs[0].id;
    const before=await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().includes('pane=0'))?.id);
    await page.evaluate(id=>window.aster.command({type:'float-tab',id}),first);
    await expect.poll(async()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(2);
    await page.evaluate(id=>window.aster.command({type:'float-top',id,value:true}),first);
    await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.isAlwaysOnTop()))).toBe(true);
    await page.evaluate(id=>window.aster.command({type:'dock-tab',id}),first);
    await expect.poll(async()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1);
    const after=await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().includes('pane=0'))?.id);expect(after).toBe(before);
    await page.getByRole('combobox',{name:'Split layout'}).selectOption('rows');
    await expect(page.getByRole('separator',{name:'Resize rows'})).toBeVisible();
    await page.getByRole('combobox',{name:'Split layout'}).selectOption('three');
    await expect(page.getByRole('combobox',{name:'Tab in pane 3'})).toBeVisible();
    await page.getByRole('button',{name:'Exit split',exact:false}).click();
    expect((await snapshot(app)).tabs).toHaveLength(4);
    expect((await snapshot(app)).workspaces[0].split.mode).toBe('off');
    await page.evaluate(()=>window.aster.command({type:'split-set',mode:'columns'}));
    await page.evaluate(()=>window.aster.command({type:'new-tab'}));
    const added=await snapshot(app);expect(added.workspaces[0].split.tabs).toContain(added.activeId);
    await page.evaluate(id=>window.aster.command({type:'close-tab',id}),added.activeId);
    expect((await snapshot(app)).workspaces[0].split.mode).toBe('off');
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('automatic and named sessions restore groups, metadata and split state',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-restore-e2e-'));let app=await launch(profile);
  try{
    let page=await chrome(app);await snapshot(app);
    await page.evaluate(()=>window.aster.command({type:'workspace-create',name:'Research',color:'slate'}));
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
    const id=(await snapshot(app)).activeId;
    await page.evaluate(id=>window.aster.command({type:'pin-tab',id}),id);
    await page.evaluate(id=>window.aster.command({type:'mute-tab',id}),id);
    await page.evaluate(()=>window.aster.command({type:'group-create',name:'References',color:'clay',icon:'book'}));
    await page.evaluate(()=>window.aster.command({type:'split-set',mode:'three'}));
    await page.evaluate(()=>window.aster.command({type:'split-resize',x:.62,y:.4}));
    await page.evaluate(()=>window.aster.command({type:'panel',value:'sessions'}));
    await page.getByRole('textbox',{name:'Session name'}).fill('Research project');
    await page.getByRole('button',{name:'Save session',exact:true}).click();
    await expect.poll(async()=>(await snapshot(app)).sessions.length).toBe(1);
    await app.close();app=await launch(profile);page=await chrome(app);
    const restored=await snapshot(app);const workspace=restored.workspaces.find(w=>w.id===restored.activeWorkspaceId)!;
    expect(workspace.name).toBe('Research');expect(workspace.groups[0].name).toBe('References');expect(workspace.split).toMatchObject({mode:'three',x:.62,y:.4});expect(restored.tabs.find(t=>t.id===id)).toMatchObject({pinned:true,muted:true});expect(restored.recoveryPending).toBe(false);
    await page.evaluate(()=>window.aster.command({type:'panel',value:'sessions'}));
    await page.getByRole('button',{name:'Restore in new window'}).click();
    await expect.poll(async()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(2);
    await page.screenshot({path:'test-results/phase2-sessions.png',animations:'disabled'});
    await app.close();app=await launch(profile);await snapshot(app);
    await expect.poll(async()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(2);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});

test('crash recovery waits for consent before reopening sites',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-crash-e2e-'));let app=await launch(profile);
  try{
    let page=await chrome(app);await snapshot(app);
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot(app)).history.length).toBe(1);
    // Wait for the bounded 200 ms checkpoint debounce before abrupt termination.
    await page.waitForTimeout(400);
    const closed=app.waitForEvent('close');await app.evaluate(({app})=>app.exit(42)).catch(()=>{});await closed;
    app=await launch(profile);page=await chrome(app);
    expect((await snapshot(app)).recoveryPending).toBe(true);
    const sites=await app.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>w.getURL().startsWith('http')).length);expect(sites).toBe(0);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button',{name:'Restore session',exact:true}).click();
    await expect.poll(async()=>(await snapshot(app)).recoveryPending).toBe(false);
    await expect.poll(async()=>(await snapshot(app)).tabs[0].title).toBe('Test garden');
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
