import {it,expect} from 'vitest';
import {calculate} from '../src/shared/calculator';
import {imageColors,wallpaperIndex} from '../src/shared/studioAdvanced';
import {settingsSchema} from '../src/shared/schema';
import {studioDefaults,resolveStudio,exportTheme,parseTheme} from '../src/shared/studio';
import {chromeGeometry,topTabs} from '../src/shared/layout';
it('evaluates arithmetic without allowing executable input',()=>{
  expect(calculate('(24 + 8) / 2')).toBe(16);expect(calculate('-3 * (2 + .5)')).toBe(-7.5);
  for(const text of ['globalThis.alert(1)','1/0','2**3','2 +','('.repeat(32)+'1'+')'.repeat(32)])expect(()=>calculate(text)).toThrow();
});
it('extracts local image colors and schedules wallpapers deterministically',()=>{
  const white=imageColors(new Uint8Array([255,255,255,255]));expect(white.brightness).toBeCloseTo(1);expect(white.color).toBe('#ffffff');
  expect(imageColors(new Uint8Array([0,0,0,255]))).toEqual({brightness:0,color:'#000000'});
  expect(wallpaperIndex('collection',0,3,1,120000)).toBe(2);expect(wallpaperIndex('video',7,1,1)).toBe(0);
  expect(wallpaperIndex('time',0,4,1,new Date(2026,8,12,18).getTime())).toBe(3);expect(wallpaperIndex('time',0,0,1)).toBe(-1);
});
it('matches website profiles exactly and synchronizes immersive/compact native geometry',()=>{
  const settings=settingsSchema.parse({});settings.siteStudios=[{origin:'https://example.com',studio:{...studioDefaults(),palette:'midnight',immersive:true,tabPosition:'right',verticalMode:'icons'}}];
  expect(resolveStudio(settings,'default','https://example.com/path').palette).toBe('midnight');expect(resolveStudio(settings,'default','https://example.com.evil.test').palette).toBe('inherit');
  expect(chromeGeometry(settings,'default','https://example.com',true,true)).toEqual({height:44,sidebar:64,left:0,right:64});expect(topTabs(settings,'default','https://example.com')).toBe(false);
  expect(settingsSchema.safeParse({...settings,siteStudios:[{origin:'javascript:alert(1)',studio:studioDefaults()}]}).success).toBe(false);
  const encoded=exportTheme('Advanced',settings,settings.siteStudios[0].studio);expect(encoded).not.toContain('example.com');expect(parseTheme(encoded).studio.immersive).toBe(true);
});
