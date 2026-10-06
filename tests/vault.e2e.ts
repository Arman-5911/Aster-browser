import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('vault encryption, restart locking, explicit HTTPS fill, OS unlock and clipboard isolation',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-vault-e2e-'));const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;env.ASTER_TEST_PROFILE=profile;
  let app=await electron.launch({args:['.'],env});const chrome=async()=>{await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);const p=app.windows().find(p=>p.url().startsWith('aster://app/'))!;await p.waitForFunction(()=>!!window.aster);return p;};
  const master='synthetic master for vault test';
  try{
    let page=await chrome();await page.evaluate(()=>window.aster.command({type:'panel',value:'vault'}));
    await page.getByLabel('Master password',{exact:true}).fill(master);await page.getByLabel('Repeat master password',{exact:true}).fill(master);await page.getByRole('button',{name:'Create encrypted vault',exact:true}).click();
    await expect(page.getByRole('button',{name:'Lock vault now'})).toBeVisible();
    await page.getByRole('button',{name:'Add password',exact:true}).click();
    await page.getByLabel('Credential name').fill('Fixture login');await page.getByLabel('Credential website').fill('https://vault.example/login');await page.getByLabel('Credential username').fill('fixture-user');await page.getByLabel('Credential password').fill('fixture-secret-password');await page.getByRole('button',{name:'Save encrypted credential',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Fixture login',exact:true})).toBeVisible();
    const id=(await page.evaluate(()=>window.aster.snapshot())).vault.entries[0].id;
    expect(JSON.stringify(await page.evaluate(()=>window.aster.snapshot()))).not.toContain('fixture-secret-password');
    const file=readFileSync(path.join(profile,'aster.vault.json'),'utf8');for(const text of [master,'fixture-user','Fixture login','fixture-secret-password'])expect(file).not.toContain(text);
    await app.evaluate(async({session,clipboard})=>{
      let copied='';clipboard.writeText=async text=>{copied=text;};clipboard.readText=async()=>copied;clipboard.clear=()=>{copied='';};
      await session.fromPartition('persist:aster-default').protocol.handle('https',()=>new Response('<!doctype html><title>Vault login fixture</title><form method="post"><input name="username" autocomplete="username"><input name="password" type="password" autocomplete="current-password"><button>Sign in</button></form><script>document.forms[0].onsubmit=e=>{e.preventDefault();window.submitted=true;}</script>',{headers:{'Content-Type':'text/html'}}));
    });
    await page.getByRole('button',{name:'Copy password',exact:true}).click();await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).toBe('fixture-secret-password');
    await page.getByRole('button',{name:'Lock vault now',exact:true}).click();await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).toBe('');
    expect((await page.evaluate(()=>window.aster.snapshot())).vault.entries).toEqual([]);
    expect((await page.evaluate(id=>window.aster.command({type:'vault-copy',id}),id)).ok).toBe(false);
    await page.getByLabel('Master password',{exact:true}).fill(master);await page.getByRole('button',{name:'Unlock vault',exact:true}).click();await expect(page.getByRole('heading',{name:'Fixture login',exact:true})).toBeVisible();
    await page.evaluate(()=>window.aster.command({type:'navigate',input:'https://vault.example/login'}));
    await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).tabs[0].title).toBe('Vault login fixture');
    expect((await page.evaluate(id=>window.aster.command({type:'vault-fill',id}),id)).ok).toBe(true);
    const filled=await app.evaluate(async({webContents})=>webContents.getAllWebContents().find(w=>w.getURL()==='https://vault.example/login')!.executeJavaScript('({username:document.querySelector("input[name=username]").value,password:document.querySelector("input[type=password]").value,submitted:!!window.submitted,bridge:typeof window.aster,node:typeof require})'));
    expect(filled).toEqual({username:'fixture-user',password:'fixture-secret-password',submitted:false,bridge:'undefined',node:'undefined'});
    await app.evaluate(async({webContents})=>webContents.getAllWebContents().find(w=>w.getURL()==='https://vault.example/login')!.executeJavaScript('document.querySelector("input[type=password]").value="";document.forms[0].style.opacity="0";'));
    expect((await page.evaluate(id=>window.aster.command({type:'vault-fill',id}),id)).ok).toBe(false);
    await app.evaluate(async({webContents})=>webContents.getAllWebContents().find(w=>w.getURL()==='https://vault.example/login')!.executeJavaScript('document.forms[0].style.opacity="1";document.forms[0].action="https://other.example/collect";'));
    expect((await page.evaluate(id=>window.aster.command({type:'vault-fill',id}),id)).ok).toBe(false);
    expect(await app.evaluate(async({webContents})=>webContents.getAllWebContents().find(w=>w.getURL()==='https://vault.example/login')!.executeJavaScript('document.querySelector("input[type=password]").value'))).toBe('');
    await page.evaluate(()=>window.aster.command({type:'navigate',input:'https://vault.example.evil.test/login'}));
    await expect.poll(async()=>(await page.evaluate(()=>window.aster.snapshot())).privacy.origin).toBe('https://vault.example.evil.test');
    expect((await page.evaluate(id=>window.aster.command({type:'vault-fill',id}),id)).ok).toBe(false);
    await page.evaluate(()=>window.aster.command({type:'panel',value:'vault'}));
    if((await page.evaluate(()=>window.aster.snapshot())).vault.deviceAvailable){
      await page.getByRole('button',{name:'Enable OS account unlock',exact:true}).click();await expect(page.getByRole('button',{name:'Disable OS account unlock',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Lock vault now',exact:true}).click();await page.getByRole('button',{name:'Unlock using this OS account',exact:true}).click();await expect(page.getByRole('heading',{name:'Fixture login',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Disable OS account unlock',exact:true}).click();
    }
    await page.evaluate(()=>window.aster.command({type:'temporary-create'}));
    expect((await page.evaluate(()=>window.aster.snapshot())).vault.entries).toEqual([]);expect((await page.evaluate(id=>window.aster.command({type:'vault-copy',id}),id)).ok).toBe(false);
    await app.close();app=await electron.launch({args:['.'],env});page=await chrome();expect((await page.evaluate(()=>window.aster.snapshot())).vault).toMatchObject({locked:true,entries:[]});
    const database=readFileSync(path.join(profile,'aster.sqlite'),'utf8');for(const text of [master,'fixture-user','fixture-secret-password'])expect(database).not.toContain(text);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
