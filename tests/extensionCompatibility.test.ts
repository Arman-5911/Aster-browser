import {describe,it,expect} from 'vitest';
import {extensionManifest,extensionWarnings,supportsVolumeAdapter} from '../src/shared/extensions';
import {commandSchema} from '../src/shared/schema';
describe('extension compatibility diagnostics',()=>{
 it('limits the volume adapter to its known manifest contract',()=>{const manifest=extensionManifest.parse({manifest_version:3,name:'Tab Volume Booster',version:'1.1.0',permissions:['tabCapture','offscreen','activeTab']});expect(supportsVolumeAdapter(manifest)).toBe(true);expect(extensionWarnings(manifest)).toHaveLength(1);expect(supportsVolumeAdapter({...manifest,version:'2.0'})).toBe(false);expect(supportsVolumeAdapter({...manifest,permissions:[]})).toBe(false);});
 it('flags capture and action-dependent extensions before installation',()=>{
  const manifest=extensionManifest.parse({manifest_version:3,name:'Volume booster',version:'1',permissions:['activeTab','tabCapture','offscreen','storage']});
  const warnings=extensionWarnings(manifest);expect(warnings).toHaveLength(3);expect(warnings.join(' ')).toContain('toolbar-action');
 });
 it('does not mark basic content scripts as incompatible',()=>{expect(extensionWarnings(extensionManifest.parse({manifest_version:3,name:'Content fixture',version:'1',permissions:['storage'],content_scripts:[{matches:['https://example.com/*'],js:['content.js']}]}))).toEqual([]);});
 it('reload command cannot target an arbitrary workspace or filesystem path',()=>{expect(commandSchema.safeParse({type:'extension-reload-pages'}).success).toBe(true);expect(commandSchema.safeParse({type:'extension-reload-pages',scope:'private'}).success).toBe(false);});
});
