import {it,expect} from 'vitest';
import {settingsSchema,commandSchema} from '../src/shared/schema';
import {studioDefaults,studioSchema,parseTheme,exportTheme,resolveStudio} from '../src/shared/studio';
import {chromeGeometry} from '../src/shared/layout';
it('migrates existing settings and keeps native geometry in sync with workspace layout',()=>{
  const settings=settingsSchema.parse({});expect(chromeGeometry(settings,'default')).toEqual({height:100,left:0,right:0,sidebar:0});
  settings.tabLayout='vertical';settings.workspaceStudios.default={...studioDefaults(),toolbarHeight:72,sidebarSide:'right',sidebarWidth:320};
  expect(chromeGeometry(settings,'default')).toEqual({height:116,left:0,right:320,sidebar:320});
  expect(chromeGeometry(settings,'another')).toEqual({height:100,left:240,right:0,sidebar:240});
  expect(resolveStudio(settings,'default').toolbarHeight).toBe(72);
});
it('rejects unsafe layouts, CSS, scripts, excessive files and invalid themes',()=>{
  for(const toolbar of [['menu'],['address'],['address','menu','menu'],['address','menu','javascript']])expect(studioSchema.safeParse({toolbar}).success).toBe(false);
  expect(studioSchema.safeParse({backgroundColor:'url(file:///private)'}).success).toBe(false);
  expect(studioSchema.safeParse({toolbarHeight:1000}).success).toBe(false);
  const settings=settingsSchema.parse({home:'https://private.example',wallpaper:'00000000-0000-4000-8000-000000000000'});
  const encoded=exportTheme('Example',settings,studioDefaults());expect(encoded).not.toContain('private.example');expect(encoded).not.toContain('00000000');
  expect(parseTheme(encoded).version).toBe(1);
  expect(()=>parseTheme(encoded.replace('"version": 1','"version": 2'))).toThrow();
  expect(()=>parseTheme(JSON.stringify({...JSON.parse(encoded),script:'alert(1)'}))).toThrow();
  expect(()=>parseTheme(' '.repeat(64001))).toThrow();
  expect(commandSchema.safeParse({type:'theme-export',value:JSON.parse(encoded)}).success).toBe(true);
});
