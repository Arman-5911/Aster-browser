import {test,expect,_electron as electron} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('developer workspace records real requests, formats JSON, previews layout and saves PNG',async()=>{
  const server=createServer((req,res)=>{if(req.url?.startsWith('/api')){res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Developer fixture</title><style>body{background:rgb(209,42,53);margin:0}h1{padding:30px}</style><h1>Developer fixture</h1>');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const profile=mkdtempSync(path.join(tmpdir(),'aster-developer-'));const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;env.ASTER_TEST_PROFILE=profile;const app=await electron.launch({args:['.'],env});
  try{
    await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);const page=app.windows().find(p=>p.url().startsWith('aster://app/'))!;await page.waitForFunction(()=>!!window.aster);
    await page.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
    await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).tabs[0].title).toBe('Developer fixture');
    await page.evaluate(()=>window.aster.command({type:'panel',value:'developer'}));
    await page.getByRole('button',{name:'Start recording',exact:true}).click();
    await app.evaluate(async({webContents},url)=>{await webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))!.executeJavaScript('fetch("/api?token=secret-fixture").then(r=>r.json())');},origin);
    await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).developer.requests.some(r=>r.url.endsWith('/api')&&r.status===200)).toBe(true);
    expect(JSON.stringify((await page.evaluate(()=>window.aster.snapshot())).developer)).not.toContain('secret-fixture');
    await page.getByRole('button',{name:'Stop recording',exact:true}).click();
    await page.getByRole('button',{name:'Clear requests',exact:true}).click();
    expect((await page.evaluate(()=>window.aster.snapshot())).developer.requests).toEqual([]);
    await page.getByRole('button',{name:'Open Chromium DevTools (F12)',exact:true}).click();
    await expect.poll(()=>app.evaluate(({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))!.isDevToolsOpened(),origin)).toBe(true);
    await app.evaluate(({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))!.closeDevTools(),origin);
    await page.getByRole('button',{name:'JSON tools',exact:true}).click();
    await page.getByLabel('JSON input',{exact:true}).fill('{"hello": [1,2]}');
    await page.getByRole('button',{name:'Validate & format',exact:true}).click();
    await expect(page.getByLabel('JSON output',{exact:true})).toHaveValue('{\n  "hello": [\n    1,\n    2\n  ]\n}');
    await page.getByLabel('JSON input',{exact:true}).fill('not JSON');await page.getByRole('button',{name:'Validate & format',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button',{name:'Responsive preview',exact:true}).click();
    await page.getByRole('button',{name:'Apply viewport',exact:true}).click();
    await expect(page.getByRole('button',{name:'Exit responsive preview',exact:true})).toBeVisible();
    await expect.poll(()=>app.evaluate(async({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))!.executeJavaScript('innerWidth'),origin)).toBe(390);
    const preview=await app.evaluate(async({BrowserWindow,WebContentsView},url)=>{const child=BrowserWindow.getAllWindows().flatMap(w=>w.contentView.children).find(v=>v instanceof WebContentsView&&v.webContents.getURL().startsWith(url)) as InstanceType<typeof WebContentsView>;const image=await child.webContents.capturePage();return {visible:child.getVisible(),bounds:child.getBounds(),png:image.toPNG().toString('base64'),pixel:[...image.toBitmap().subarray(0,4)]};},origin);
    expect(preview.visible).toBe(true);expect(preview.bounds.width).toBeLessThanOrEqual(390);expect(preview.pixel.slice(0,3)).toEqual([53,42,209]);
    writeFileSync('test-results/responsive-page.png',Buffer.from(preview.png,'base64'));
    await page.getByRole('button',{name:'Exit responsive preview',exact:true}).click();
    await expect.poll(()=>app.evaluate(async({webContents},url)=>webContents.getAllWebContents().find(w=>w.getURL().startsWith(url))!.executeJavaScript('innerWidth'),origin)).toBeGreaterThan(390);
    const target=path.join(profile,'viewport.png');
    // Only the harness supplies a destination. Production always uses the OS dialog.
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},target);
    await page.evaluate(()=>window.aster.command({type:'panel',value:'developer'}));
    await page.getByRole('button',{name:'Screenshots',exact:true}).click();
    await page.getByRole('button',{name:'Save viewport PNG',exact:true}).click();
    await expect(page.getByText('Viewport screenshot saved as PNG.',{exact:true})).toBeVisible();
    expect(readFileSync(target).subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
    const pixels=await app.evaluate(({nativeImage},file)=>{const image=nativeImage.createFromPath(file);return {size:image.getSize(),pixel:[...image.toBitmap().subarray(0,4)]};},target);
    expect(pixels.size.width).toBeGreaterThan(390);expect(pixels.pixel.slice(0,3)).toEqual([53,42,209]);
    // Intercept clipboard writes in the harness to preserve the user's clipboard.
    await app.evaluate(({clipboard})=>{clipboard.write=async items=>{if(!items[0]?.types.includes('image/png'))throw new Error('Missing image');const data=await items[0].getType('image/png');if(!(data instanceof Blob)||data.size===0)throw new Error('Empty image');};});
    await page.getByRole('button',{name:'Copy viewport image',exact:true}).click();
    await expect(page.getByText('Viewport image copied to clipboard.',{exact:true})).toBeVisible();
    await page.evaluate(()=>window.aster.command({type:'temporary-create'}));
    expect((await page.evaluate(()=>window.aster.snapshot())).developer).toMatchObject({recording:false,requests:[]});
  }finally{await app.close();await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
