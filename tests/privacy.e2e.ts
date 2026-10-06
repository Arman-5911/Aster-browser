import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
let server:Server;let origin:string;let trackingHits=0;let adHits=0;
test.beforeAll(async()=>{server=createServer((req,res)=>{
  if(req.url==='/article'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Quiet reading</title><meta name="author" content="Aster fixture"><nav>NOISY NAVIGATION</nav><article><h1>Quiet reading</h1><p>'+('A garden offers a quiet place to read and think. '.repeat(20))+'</p><script>window.siteOnly=true</script></article>');return;}
  if(req.url?.startsWith('/-universal-analytics/')){trackingHits++;res.setHeader('Content-Type','text/javascript');res.end('window.trackingLoaded=true');return;}
  if(req.url==='/ad-scroll.js'){adHits++;res.setHeader('Content-Type','text/javascript');res.end('window.adLoaded=true');return;}
  if(req.url==='/download'){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="private-file.txt"'});res.end('private download');return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Privacy fixture</title><h1>Privacy fixture</h1><script src="/-universal-analytics/probe.js"></script><script src="/ad-scroll.js"></script>');
});await new Promise<void>(resolve=>server.listen(0,resolve));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;});
test.afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
async function launch(profile:string){const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;env.ASTER_TEST_PROFILE=profile;return electron.launch({args:['.'],env});}
async function chrome(app:ElectronApplication){await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);const page=app.windows().find(p=>p.url().startsWith('aster://app/'))!;await page.waitForFunction(()=>!!window.aster);return page;}
test('reader, keyboard palette and start customization persist safely',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-phase4-'));let app=await launch(profile);
  try{
    let page=await chrome(app);
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/article');
    await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).tabs[0].title).toBe('Quiet reading');
    await app.evaluate(({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url)!;wc.sendInputEvent({type:'keyDown',keyCode:'F9'});wc.sendInputEvent({type:'keyUp',keyCode:'F9'});},origin+'/article');
    await expect(page.locator('.reader-article h1')).toHaveText('Quiet reading');
    await expect(page.locator('.reader-article')).not.toContainText('NOISY NAVIGATION');
    expect(await page.evaluate(()=>Object.hasOwn(window,'siteOnly'))).toBe(false);
    await page.getByLabel('Reader font',{exact:true}).selectOption('sans');
    await page.getByLabel('Reader width',{exact:true}).selectOption('wide');
    await page.getByRole('button',{name:'Exit reading mode'}).click();
    await app.evaluate(({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url)!;wc.sendInputEvent({type:'keyDown',keyCode:'k',modifiers:['control']});wc.sendInputEvent({type:'keyUp',keyCode:'k',modifiers:['control']});},origin+'/article');
    await expect(page.getByRole('combobox',{name:'Command search'})).toBeFocused();
    await page.getByRole('combobox',{name:'Command search'}).fill('settings');
    await page.getByRole('combobox',{name:'Command search'}).press('Enter');
    await expect(page.getByRole('heading',{name:'Make yourself at home.'})).toBeVisible();
    await page.getByLabel('Start page greeting',{exact:true}).fill('A place for my ideas');
    await page.getByRole('button',{name:'Save greeting'}).click();
    await page.getByLabel('Start background',{exact:true}).selectOption('sage');
    await page.getByLabel('Recent history on start page',{exact:true}).uncheck();
    await page.getByLabel('Quick link name',{exact:true}).fill('My article');
    await page.getByLabel('Quick link URL',{exact:true}).fill(origin+'/article');
    await page.getByRole('button',{name:'Add quick link'}).click();
    await expect(page.getByRole('button',{name:'Remove quick link My article'})).toBeVisible();
    await page.evaluate(()=>window.aster.command({type:'new-tab'}));
    await expect(page.getByRole('heading',{name:'A place for my ideas'})).toBeVisible();
    await expect(page.locator('.start-page')).toHaveAttribute('data-background','sage');
    await expect(page.getByRole('heading',{name:'Pick up where you left off'})).toHaveCount(0);
    await expect(page.getByRole('button',{name:'M My article'})).toBeVisible();
    await page.screenshot({path:'test-results/phase4-start.png'});
    await app.close();app=await launch(profile);page=await chrome(app);
    const settings=(await page.evaluate(()=>window.aster.snapshot())).settings;
    expect(settings).toMatchObject({startTitle:'A place for my ideas',startBackground:'sage',showRecent:false,readerFont:'sans',readerWidth:'wide'});
    expect(settings.quickLinks.some(link=>link.name==='My article')).toBe(true);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('notes and reading queue work through UI and persist across restart',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-productivity-'));let app=await launch(profile);
  try{
    let page=await chrome(app);
    await page.evaluate(()=>window.aster.command({type:'panel',value:'menu'}));
    await page.getByRole('button',{name:'Notes',exact:true}).last().click();
    await page.getByRole('button',{name:'New note',exact:true}).click();
    await page.getByLabel('Note title',{exact:true}).fill('Research idea');
    await page.getByLabel('Note text',{exact:true}).fill('<script>window.unwanted=true</script> A useful thought.');
    await page.getByRole('button',{name:'Save note',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Research idea'})).toBeVisible();
    expect(await page.evaluate(()=>Object.hasOwn(window,'unwanted'))).toBe(false);
    await page.getByRole('button',{name:'Edit Research idea',exact:true}).click();
    await page.getByLabel('Note text',{exact:true}).fill('Revised thought');
    await page.getByRole('button',{name:'Save note',exact:true}).click();
    await expect(page.getByText('Revised thought',{exact:true})).toBeVisible();
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).tabs[0].title).toBe('Privacy fixture');
    await page.evaluate(()=>window.aster.command({type:'panel',value:'reading'}));
    await page.getByRole('button',{name:'Save current page',exact:true}).click();
    await page.getByRole('button',{name:'Mark read',exact:true}).click();
    await expect(page.getByRole('button',{name:'Mark unread',exact:true})).toBeVisible();
    await app.close();app=await launch(profile);page=await chrome(app);
    const state=await page.evaluate(()=>window.aster.snapshot());
    expect(state.notes[0]).toMatchObject({title:'Research idea',body:'Revised thought'});
    expect(state.readingList[0]).toMatchObject({title:'Privacy fixture',is_read:1});
    await page.evaluate(()=>window.aster.command({type:'workspace-create',name:'Isolated',color:'slate'}));
    expect((await page.evaluate(()=>window.aster.snapshot())).notes).toEqual([]);
    expect((await page.evaluate(()=>window.aster.snapshot())).readingList).toEqual([]);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('network filtering, origin exceptions, cookie metadata and real permission prompt',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-privacy-'));const app=await launch(profile);
  try{const page=await chrome(app);const snapshot=()=>page.evaluate(()=>window.aster.snapshot());
    trackingHits=0;adHits=0;
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await snapshot()).privacy.stats.trackersBlocked).toBeGreaterThan(0);
    expect(trackingHits).toBe(0);expect((await snapshot()).privacy.filters.ready).toBe(true);
    expect((await snapshot()).privacy.mode).toBe('standard');
    await expect.poll(async()=>(await snapshot()).privacy.stats.adsBlocked).toBeGreaterThan(0);
    expect(adHits).toBe(0);
    await page.evaluate(()=>window.aster.command({type:'site-exception',disabled:true}));
    await page.evaluate(()=>window.aster.command({type:'reload'}));
    await expect.poll(()=>trackingHits).toBeGreaterThan(0);
    await expect.poll(()=>adHits).toBeGreaterThan(0);
    await app.evaluate(async({session},url)=>{await session.fromPartition('persist:aster-default').cookies.set({url,name:'secret-cookie',value:'never-send-this-value',httpOnly:true});},origin);
    await page.evaluate(()=>window.aster.command({type:'cookies-refresh'}));
    const cookies=(await snapshot()).privacy.cookies;expect(cookies.some(c=>c.name==='secret-cookie'&&c.httpOnly)).toBe(true);
    expect(JSON.stringify(await snapshot())).not.toContain('never-send-this-value');
    await page.evaluate(id=>window.aster.command({type:'cookie-remove',id}),cookies.find(c=>c.name==='secret-cookie')!.id);
    expect((await snapshot()).privacy.cookies.some(c=>c.name==='secret-cookie')).toBe(false);
    await page.evaluate(()=>window.aster.command({type:'permission-set',permission:'notifications',value:'ask'}));
    await app.evaluate(({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))!;void wc.executeJavaScript('Notification.requestPermission().then(value=>window.permissionResult=value)');},origin);
    await expect(page.getByRole('alertdialog')).toBeVisible();
    expect((await snapshot()).permissionPrompts[0].origin).toBe(origin);
    await page.getByLabel('Remember for this origin and container').check();
    await page.getByRole('button',{name:'Allow request',exact:true}).click();
    await expect.poll(async()=>app.evaluate(async({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))?.executeJavaScript('window.permissionResult'),origin)).toBe('granted');
    expect((await snapshot()).privacy.permissions.notifications).toBe('allow');
    await page.evaluate(()=>window.aster.command({type:'permission-reset'}));
    expect((await snapshot()).privacy.permissions.notifications).toBe('block');
    await page.evaluate(()=>window.aster.command({type:'panel',value:'privacy'}));
    await page.screenshot({path:'test-results/privacy-dashboard.png',fullPage:true});
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('YouTube player protection runs before page scripts and respects Off and site pause',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-youtube-'));const app=await launch(profile);
  try{
    const page=await chrome(app);
    // Intercept only this test profile: exercise a real HTTPS YouTube origin,
    // document-start preload and IPC provenance without relying on ad auctions.
    await app.evaluate(async({session})=>{
      await session.fromPartition('persist:aster-default').protocol.handle('https',()=>new Response(`<!doctype html><title>Player fixture</title><script>
        const fixture={videoDetails:{videoId:'song'},playabilityStatus:{status:'OK'},streamingData:{formats:[{url:'https://media.test/song'}]},adPlacements:[{ad:1}],adSlots:[{ad:2}],playerAds:[{ad:3}]};
        const raw=JSON.stringify(fixture);
        window.ytInitialPlayerResponse=fixture;
        window.result={initial:window.ytInitialPlayerResponse,parsed:JSON.parse(raw),unrelated:JSON.parse('{"adSlots":["ordinary data"],"value":3}'),node:typeof require,bridge:typeof window.aster};
        new Response(raw).json().then(value=>window.result.fetched=value);
      </script>`,{headers:{'Content-Type':'text/html'}}));
    });
    const read=()=>app.evaluate(async({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('https://www.youtube.com/'))?.executeJavaScript('window.result'));
    await page.evaluate(()=>window.aster.command({type:'navigate',input:'https://www.youtube.com/watch?v=fixture'}));
    await expect.poll(async()=>!!(await read())?.fetched).toBe(true);
    const protectedResult=await read();
    for(const key of ['initial','parsed','fetched']){
      expect(protectedResult[key].adPlacements).toBeUndefined();expect(protectedResult[key].adSlots).toBeUndefined();expect(protectedResult[key].playerAds).toBeUndefined();
      expect(protectedResult[key].streamingData.formats[0].url).toBe('https://media.test/song');
    }
    expect(protectedResult.unrelated.adSlots).toEqual(['ordinary data']);
    expect(protectedResult.node).toBe('undefined');expect(protectedResult.bridge).toBe('undefined');
    await page.evaluate(()=>window.aster.command({type:'site-exception',disabled:true}));
    await page.evaluate(()=>window.aster.command({type:'reload'}));
    await expect.poll(async()=>(await read())?.initial?.adPlacements?.length).toBe(1);
    await page.evaluate(()=>window.aster.command({type:'site-exception',disabled:false}));
    await page.evaluate(async()=>window.aster.command({type:'settings',value:{...(await window.aster.snapshot()).settings,protection:'off'}}));
    await page.evaluate(()=>window.aster.command({type:'reload'}));
    await expect.poll(async()=>(await read())?.fetched?.adSlots?.length).toBe(1);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
test('temporary cookies and downloads stay out of durable sessions and clear on close',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-private-'));let app=await launch(profile);let closed=false;
  try{const page=await chrome(app);const snapshot=()=>page.evaluate(()=>window.aster.snapshot());
    await page.evaluate(()=>window.aster.command({type:'temporary-create'}));
    const scope=(await snapshot()).activeWorkspaceId;
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/private-secret-unique');
    await expect.poll(async()=>(await snapshot()).tabs[0].title).toBe('Privacy fixture');
    expect((await snapshot()).privacy.mode).toBe('strict');expect((await snapshot()).history).toEqual([]);
    expect((await page.evaluate(()=>window.aster.command({type:'session-save',name:'Private should fail'}))).ok).toBe(false);
    expect((await page.evaluate(()=>window.aster.command({type:'bookmark'}))).ok).toBe(false);
    expect((await page.evaluate(()=>window.aster.command({type:'note-save',title:'Private note',body:'private-note-unique'}))).ok).toBe(false);
    expect((await page.evaluate(()=>window.aster.command({type:'reading-add'}))).ok).toBe(false);
    expect((await page.evaluate(id=>window.aster.command({type:'tab-move',id,workspaceId:'default'}),(await snapshot()).activeId)).ok).toBe(false);
    await page.evaluate(()=>window.aster.command({type:'permission-set',permission:'camera',value:'allow'}));
    await app.evaluate(async({session,webContents},{scope,origin,target})=>{
      const browsing=session.fromPartition('aster-temporary-'+scope);
      await browsing.cookies.set({url:origin,name:'private-cookie',value:'private-value-unique'});
      const wc=webContents.getAllWebContents().find(w=>w.getURL().includes('/private-secret-unique'))!;
      await wc.executeJavaScript('localStorage.setItem("private","private-storage-unique")');
      browsing.once('will-download',(_event,item)=>item.setSavePath(target));wc.downloadURL(origin+'/download');
    },{scope,origin,target:path.join(profile,'private-file.txt')});
    await expect.poll(async()=>(await snapshot()).downloads[0]?.state).toBe('completed');
    await page.evaluate(id=>window.aster.command({type:'close-tab',id}),(await snapshot()).activeId);
    expect((await snapshot()).privacy.receipt).toMatchObject({cleared:true,cookies:1});
    expect((await snapshot()).downloads).toEqual([]);
    expect(await app.evaluate(async({session},id)=>session.fromPartition('aster-temporary-'+id).cookies.get({}),scope)).toEqual([]);
    expect(readFileSync(path.join(profile,'private-file.txt'),'utf8')).toBe('private download');
    await page.evaluate(()=>window.aster.command({type:'private-window'}));
    await expect.poll(()=>app.windows().filter(p=>p.url().startsWith('aster://app/')).length).toBe(2);
    const privatePage=app.windows().find(p=>p.url().startsWith('aster://app/')&&p!==page)!;
    await privatePage.waitForFunction(()=>!!window.aster);
    await privatePage.evaluate(()=>window.aster.command({type:'workspace-create',name:'Private second space',color:'slate'}));
    expect((await privatePage.evaluate(()=>window.aster.snapshot())).workspaces.every(w=>w.temporary)).toBe(true);
    await privatePage.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/private-window-unique');
    await app.close();closed=true;
    const db=readFileSync(path.join(profile,'aster.sqlite')).toString('utf8');
    for(const secret of ['private-secret-unique','private-window-unique','private-value-unique','private-storage-unique','private-note-unique',scope,'private-file.txt'])expect(db).not.toContain(secret);
    app=await launch(profile);closed=false;const restored=await chrome(app);
    expect((await restored.evaluate(()=>window.aster.snapshot())).workspaces.every(w=>!w.temporary)).toBe(true);
    expect(app.windows().filter(p=>p.url().startsWith('aster://app/'))).toHaveLength(1);
  }finally{if(!closed)await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
