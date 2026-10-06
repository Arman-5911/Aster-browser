import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtempSync,rmSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
test('theme presets, tab controls and local wallpaper survive restart and respect reduced motion',async()=>{
  const profile=mkdtempSync(path.join(tmpdir(),'aster-appearance-'));const env=Object.fromEntries(Object.entries(process.env).filter((e):e is [string,string]=>e[1]!==undefined));delete env.ELECTRON_RUN_AS_NODE;env.ASTER_TEST_PROFILE=profile;
  let app=await electron.launch({args:['.'],env});
  const chrome=async()=>{await expect.poll(()=>app.windows().some(p=>p.url().startsWith('aster://app/'))).toBe(true);const p=app.windows().find(p=>p.url().startsWith('aster://app/'))!;await p.waitForFunction(()=>!!window.aster);return p;};
  try{
    let page=await chrome();await page.evaluate(()=>window.aster.command({type:'panel',value:'settings'}));
    await page.getByRole('button',{name:'Amethyst',exact:false}).click();
    await expect(page.locator('html')).toHaveAttribute('data-tab-style','pill');
    await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
    await expect.poll(()=>page.locator('.tab.active').evaluate(el=>getComputedStyle(el).borderRadius)).toBe('22px');
    await page.getByLabel('Tab close buttons',{exact:true}).selectOption('hover');
    const invalid=await page.evaluate(()=>window.aster.command({type:'settings-patch',value:{tabColor:'red;url(file:///secret)'} as never}));expect(invalid.ok).toBe(false);
    const source=path.join(profile,'test-background.png');
    const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;const c=canvas.getContext('2d')!;const gradient=c.createLinearGradient(0,0,800,500);gradient.addColorStop(0,'#204a77');gradient.addColorStop(1,'#ad67a2');c.fillStyle=gradient;c.fillRect(0,0,800,500);return canvas.toDataURL('image/png').split(',')[1];});writeFileSync(source,Buffer.from(png,'base64'));
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},source);
    await page.getByRole('button',{name:'Choose background image',exact:true}).click();
    await expect(page.getByAltText('Current new-tab background')).toBeVisible();
    await expect.poll(()=>page.getByAltText('Current new-tab background').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBe(800);
    expect(existsSync(path.join(profile,'wallpaper.jpg'))).toBe(true);
    await page.evaluate(()=>window.aster.command({type:'new-tab'}));
    await expect(page.locator('.start-page')).toHaveAttribute('data-wallpaper','true');
    await page.emulateMedia({reducedMotion:'reduce'});
    expect(await page.locator('.tab.active').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
    await page.screenshot({path:'test-results/theme-studio-result.png'});
    await app.close();app=await electron.launch({args:['.'],env});page=await chrome();
    const settings=(await page.evaluate(()=>window.aster.snapshot())).settings;expect(settings).toMatchObject({tabStyle:'pill',tabClose:'hover',tabColor:'#8b72e8',motion:'expressive'});expect(settings.wallpaper).toBeTruthy();
    await page.evaluate(()=>window.aster.command({type:'wallpaper-remove'}));
    expect((await page.evaluate(()=>window.aster.snapshot())).settings.wallpaper).toBeNull();expect(existsSync(path.join(profile,'wallpaper.jpg'))).toBe(false);
  }finally{await app.close();rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
});
