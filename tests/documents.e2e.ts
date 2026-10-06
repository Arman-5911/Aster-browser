import {test,expect,_electron as electron,type ElectronApplication} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

function pdf(){
  const content='BT /F1 20 Tf 30 100 Td (Aster PDF preview) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let text='%PDF-1.4\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(text);text+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return text;
}
let server:Server,origin:string;
test.beforeAll(async()=>{server=createServer((req,res)=>{
  if(req.url==='/file.pdf'){res.writeHead(200,{'Content-Type':'application/pdf'});res.end(pdf());return;}
  if(req.url?.startsWith('/download')){res.writeHead(200,{'Content-Type':'text/plain','Content-Disposition':'attachment; filename="download.txt"'});res.end('Saved by Aster');return;}
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><title>Documents fixture</title><a id="download" href="/download">Download file</a><a id="blank" href="/download?blank" target="_blank">New tab download</a><button id="blob" onclick="let a=document.createElement('a');a.href=window.URL.createObjectURL(new Blob(['Generated export'],{type:'text/plain'}));a.download='export.txt';a.click()">Export</button><input type="file" id="upload"><iframe srcdoc="<h1>Embedded content</h1>"></iframe>`);
});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;});
test.afterAll(()=>new Promise<void>(r=>server.close(()=>r())));
async function start(){const profile=mkdtempSync(path.join(tmpdir(),'aster-documents-'));const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;env.ASTER_TEST_PROFILE=profile;const app=await electron.launch({args:process.env.ASTER_PACKAGED_EXE?[]:['.'],executablePath:process.env.ASTER_PACKAGED_EXE,env});await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);const ui=app.windows().find(p=>p.url().startsWith('aster://app/'))!;await ui.waitForFunction(()=>!!window.aster);await ui.evaluate(()=>window.aster.command({type:'startup-ready'}));return {app,ui,profile};}
async function saveNext(app:ElectronApplication,file:string){await app.evaluate(({session},file)=>{session.fromPartition('persist:aster-default').once('will-download',(_event,item)=>item.setSavePath(file));},file);}
function cleanup(profile:string){if(path.dirname(profile)!==path.resolve(tmpdir())||!path.basename(profile).startsWith('aster-documents-'))throw Error('Unsafe cleanup');rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}

test('real link and blob downloads, file preview, deleted file and uploads',async()=>{
 const {app,ui,profile}=await start();try{
 await ui.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin);
 await expect.poll(async()=>(await ui.evaluate(()=>window.aster.snapshot())).tabs[0].title).toBe('Documents fixture');

 const click=async(id:string)=>app.evaluate(async({webContents,BrowserWindow},id)=>{BrowserWindow.getAllWindows()[0].show();BrowserWindow.getAllWindows()[0].focus();const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith('http://127.0.0.1')&&w.getTitle()==='Documents fixture')!;wc.focus();const point=await wc.executeJavaScript(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);wc.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...point});wc.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...point});},id);
 const target=path.join(profile,'renamed.txt');await saveNext(app,target);await click('download');
 await expect.poll(async()=>(await ui.evaluate(()=>window.aster.snapshot())).downloads[0]?.state).toBe('completed');
 expect(readFileSync(target,'utf8')).toBe('Saved by Aster');
 const d=(await ui.evaluate(()=>window.aster.snapshot())).downloads[0];expect(d.filename).toBe('renamed.txt');
 const generated=path.join(profile,'export.txt');await saveNext(app,generated);await click('blob');
 await expect.poll(()=>{try{return readFileSync(generated,'utf8');}catch{return '';}}).toBe('Generated export');
 const blank=path.join(profile,'blank.txt');await saveNext(app,blank);await click('blank');
 await expect.poll(()=>{try{return readFileSync(blank,'utf8');}catch{return '';}}).toBe('Saved by Aster');
 expect(await ui.evaluate(id=>window.aster.command({type:'download-action',id,action:'open'}),d.id)).toEqual({ok:true});
 await expect.poll(()=>app.evaluate(({webContents})=>webContents.getAllWebContents().some(w=>w.getURL().startsWith('file:')))).toBe(true);
 const local=await app.evaluate(async({webContents})=>{const w=webContents.getAllWebContents().find(w=>w.getURL().startsWith('file:'))!;return w.executeJavaScript('({text:document.body.innerText,node:typeof require,bridge:typeof window.aster})');});
 expect(local).toEqual({text:'Saved by Aster',node:'undefined',bridge:'undefined'});
 rmSync(target);const missing=await ui.evaluate(id=>window.aster.command({type:'download-action',id,action:'open'}),d.id);expect(missing).toMatchObject({ok:false,error:'Download file was moved or deleted.'});
 const fixture=(await ui.evaluate(()=>window.aster.snapshot())).tabs.find(t=>t.title==='Documents fixture')!;await ui.evaluate(id=>window.aster.command({type:'select-tab',id}),fixture.id);
 const uploaded=await app.evaluate(async({webContents},file)=>{const w=webContents.getAllWebContents().find(w=>w.getTitle()==='Documents fixture')!;w.debugger.attach('1.3');try{const {root}=await w.debugger.sendCommand('DOM.getDocument');const {nodeId}=await w.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:'#upload'});await w.debugger.sendCommand('DOM.setFileInputFiles',{nodeId,files:[file]});return await w.executeJavaScript('document.querySelector("#upload").files[0].text()');}finally{w.debugger.detach();}},generated);expect(uploaded).toBe('Generated export');
 const unsafe=await ui.evaluate(()=>window.aster.command({type:'navigate',input:'file:///C:/Windows/win.ini'}));expect(unsafe.ok).toBe(false);

 }finally{await app.close();cleanup(profile);}
});


test('remote PDF and picked local PDF load with the built-in viewer',async()=>{
 const {app,ui,profile}=await start();try{
 const local=path.join(profile,'local.pdf');writeFileSync(local,pdf());
 await ui.evaluate(url=>window.aster.command({type:'navigate',input:url}),origin+'/file.pdf');
 await expect.poll(()=>app.evaluate(({webContents})=>webContents.getAllWebContents().flatMap(w=>w.mainFrame.framesInSubtree.map(f=>f.url)).some(url=>url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'))),{timeout:15000}).toBe(true);
 await expect.poll(()=>app.evaluate(async({webContents})=>{const frame=webContents.getAllWebContents().flatMap(w=>w.mainFrame.framesInSubtree).find(f=>f.url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'));return frame?.executeJavaScript(`document.querySelector('pdf-viewer')?.documentDimensions?.pageDimensions?.length`);})).toBe(1);
 expect((await ui.evaluate(()=>window.aster.snapshot())).downloads).toHaveLength(0);
 const saved=path.join(profile,'saved.pdf');await saveNext(app,saved);await ui.evaluate(()=>window.aster.command({type:'save-page'}));await expect.poll(()=>{try{return readFileSync(saved,'utf8');}catch{return '';}}).toBe(pdf());
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]})) as typeof dialog.showOpenDialog;},local);
 expect(await ui.evaluate(()=>window.aster.command({type:'open-file'}))).toEqual({ok:true});
 await expect.poll(()=>app.evaluate(({webContents},url)=>webContents.getAllWebContents().some(w=>w.getURL()===url),pathToFileURL(local).href)).toBe(true);
 await expect.poll(()=>app.evaluate(({webContents},url)=>{const w=webContents.getAllWebContents().find(w=>w.getURL()===url);return w?.mainFrame.framesInSubtree.some(f=>f.url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'));},pathToFileURL(local).href)).toBe(true);
 expect((await ui.evaluate(()=>window.aster.snapshot())).tabs.some(t=>t.error)).toBe(false);
 await expect.poll(()=>app.evaluate(async({webContents},url)=>{const frame=webContents.getAllWebContents().find(w=>w.getURL()===url)?.mainFrame.framesInSubtree.find(f=>f.url.startsWith('chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/'));return frame?.executeJavaScript(`document.querySelector('pdf-viewer')?.documentDimensions?.pageDimensions?.length`);},pathToFileURL(local).href)).toBe(1);
 await ui.screenshot({path:'test-results/document-pdf.png'});
 }finally{await app.close();cleanup(profile);}
});
