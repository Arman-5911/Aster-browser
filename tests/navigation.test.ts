import { describe,it,expect } from 'vitest';
import { resolveInput,isWebUrl } from '../src/shared/navigation';
import { commandSchema, settingsSchema } from '../src/shared/schema';
import { trustedSender } from '../src/main/security';
describe('navigation trust boundary',()=>{
  it('resolves URLs, local development and explicit searches',()=>{expect(resolveInput('example.com')).toBe('https://example.com/');expect(resolveInput('localhost:3000')).toBe('http://localhost:3000/');expect(resolveInput('react hooks','google')).toBe('https://www.google.com/search?q=react%20hooks');expect(resolveInput('aster://newtab')).toBe('aster://newtab');});
  it.each(['javascript:alert(1)','file:///etc/passwd','data:text/html,test','aster://app/index.html','https://name:secret@example.com','vbscript:msgbox(1)'])('rejects unsafe input %s',value=>expect(()=>resolveInput(value)).toThrow());
  it('rejects non-web schemes and embedded credentials',()=>{expect(isWebUrl('https://example.com')).toBe(true);expect(isWebUrl('https://a:b@example.com')).toBe(false);expect(isWebUrl('file:///tmp/x')).toBe(false);});
});
describe('IPC contract',()=>{
  it('requires registered sender, exact UI URL and top frame',()=>{expect(trustedSender(1,1,'aster://app/index.html',true)).toBe(true);expect(trustedSender(2,1,'aster://app/index.html',true)).toBe(false);expect(trustedSender(1,1,'https://evil.test',true)).toBe(false);expect(trustedSender(1,1,'aster://app/index.html',false)).toBe(false);expect(trustedSender(1,1,'aster://app/index.html#evil',true)).toBe(false);});
  it.each([{type:'exec',value:'whoami'},{type:'new-tab',extra:1},{type:'navigate',input:'x'.repeat(8193)},{type:'zoom',delta:100},{type:'download-action',id:'1',action:'execute'},{type:'panel',value:'evil'}])('rejects malformed or excessive commands',command=>expect(commandSchema.safeParse(command).success).toBe(false));
  it('validates settings and fills safe defaults',()=>{expect(settingsSchema.parse({}).recordHistory).toBe(true);expect(settingsSchema.safeParse({theme:'neon'}).success).toBe(false);expect(settingsSchema.safeParse({home:'javascript:alert(1)'}).success).toBe(false);expect(settingsSchema.safeParse({telemetry:true}).success).toBe(false);});
});
