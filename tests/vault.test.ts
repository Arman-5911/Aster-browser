import {it,expect,vi} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {VaultStore} from '../src/main/vaultStore';
import {encrypt,decrypt} from '../src/main/vaultCrypto';
import {SecureClipboard} from '../src/main/secureClipboard';
import {generatePassword} from '../src/shared/vault';
import {commandSchema} from '../src/shared/schema';
it('authenticates ciphertext, tag and encryption context',()=>{
  const key=randomBytes(32);const box=encrypt(key,Buffer.from('synthetic-secret'),'entries');expect(decrypt(key,box,'entries').toString()).toBe('synthetic-secret');
  expect(()=>decrypt(key,box,'key')).toThrow();const altered={...box,tag:Buffer.alloc(16).toString('base64')};expect(()=>decrypt(key,altered,'entries')).toThrow();key.fill(0);
});
it('stores no plaintext, persists locked, supports rekey and portable encrypted backup',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'aster-vault-unit-'));const file=path.join(dir,'vault.json');let vault=new VaultStore(file,()=>{},()=>60000);
  const master='a synthetic master phrase';const next='another synthetic master phrase';
  try{
    await vault.create(master);const id=randomUUID();vault.save({id,title:'Secret title',origin:'https://login.example',username:'secret-user',password:'secret-password-unique'});
    const disk=readFileSync(file,'utf8');for(const value of [master,'Secret title','secret-user','secret-password-unique'])expect(disk).not.toContain(value);
    expect(JSON.stringify(vault.snapshot())).not.toContain('secret-password-unique');vault.lock();expect(vault.snapshot().entries).toEqual([]);expect(()=>vault.get(id)).toThrow();
    await expect(vault.unlock('incorrect-password')).rejects.toThrow('could not be unlocked');
    vault=new VaultStore(file,()=>{},()=>60000);await vault.unlock(master);expect(vault.get(id).password).toBe('secret-password-unique');
    await vault.changeMaster(next);const backup=vault.exportEncrypted();expect(JSON.parse(backup).device).toBeUndefined();vault.lock();
    const restored=new VaultStore(path.join(dir,'restored.json'),()=>{},()=>60000);try{await restored.importEncrypted(backup,next);expect(restored.get(id).username).toBe('secret-user');await expect(restored.importEncrypted(backup,next)).rejects.toThrow('fresh profile');}finally{restored.lock();}
    const stale=new VaultStore(file,()=>{},()=>60000);await expect(stale.unlock(master)).rejects.toThrow();stale.lock();
    const data=JSON.parse(readFileSync(file,'utf8'));data.contents.tag=Buffer.alloc(16).toString('base64');writeFileSync(file,JSON.stringify(data));const tampered=new VaultStore(file,()=>{},()=>60000);await expect(tampered.unlock(next)).rejects.toThrow();expect(tampered.snapshot().entries).toEqual([]);tampered.lock();
  }finally{vault.lock();rmSync(dir,{recursive:true,force:true});}
},15000);
it('locks on timeout and cancels an unlock that overlaps an explicit lock',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'aster-vault-lock-'));const file=path.join(dir,'vault.json');const vault=new VaultStore(file,()=>{},()=>1000);
  try{vi.useFakeTimers();await vault.create('synthetic master password');await vi.advanceTimersByTimeAsync(1001);expect(vault.snapshot().locked).toBe(true);vi.useRealTimers();const attempt=vault.unlock('synthetic master password');vault.lock();await expect(attempt).rejects.toThrow();expect(vault.snapshot().locked).toBe(true);}finally{vi.useRealTimers();vault.lock();rmSync(dir,{recursive:true,force:true});}
});
it('uses OS-wrapped key only after opt-in and removes it on disable',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'aster-vault-device-'));let deviceKey:Buffer|undefined;
  const vault=new VaultStore(path.join(dir,'vault.json'),()=>{},()=>60000,{available:()=>true,encrypt:async key=>{deviceKey=Buffer.from(key);return 'test-os-token';},decrypt:async token=>{if(token!=='test-os-token'||!deviceKey)throw new Error();return Buffer.from(deviceKey);}});
  try{await vault.create('synthetic master password');expect(vault.snapshot().deviceEnabled).toBe(false);await vault.remember(true);expect(vault.snapshot().deviceEnabled).toBe(true);expect(JSON.parse(vault.exportEncrypted()).device).toBeUndefined();vault.lock();await vault.unlock();expect(vault.snapshot().locked).toBe(false);await vault.remember(false);expect(vault.snapshot().deviceEnabled).toBe(false);}finally{vault.lock();deviceKey?.fill(0);rmSync(dir,{recursive:true,force:true});}
});
it('clears only its copied text, preserves replacements and serializes copy/lock',async()=>{
  vi.useFakeTimers();let text='';const secure=new SecureClipboard({writeText:async value=>{text=value;},readText:async()=>text,clear:()=>{text='';}});
  try{await secure.copy('dummy-password',1);await vi.advanceTimersByTimeAsync(1001);expect(text).toBe('');await secure.copy('dummy-password',1);text='new clipboard content';await vi.advanceTimersByTimeAsync(1001);expect(text).toBe('new clipboard content');const copy=secure.copy('racing-password',10);const clear=secure.clear();await Promise.all([copy,clear]);expect(text).toBe('');await secure.copy('timer-off',0);await vi.advanceTimersByTimeAsync(20000);expect(text).toBe('timer-off');await secure.clear();expect(text).toBe('');}finally{vi.useRealTimers();}
});
it('generates bounded random passwords and rejects unsafe origins and payloads',()=>{
  const generated=generatePassword(32,{upper:true,lower:true,digits:true,symbols:true});expect(generated).toHaveLength(32);expect(generated).toMatch(/[A-Z]/);expect(generated).toMatch(/[a-z]/);expect(generated).toMatch(/[2-9]/);expect(generated).toMatch(/[^a-zA-Z0-9]/);
  expect(()=>generatePassword(12,{upper:false,lower:false,digits:false,symbols:false})).toThrow();
  expect(commandSchema.safeParse({type:'vault-create',master:'short'}).success).toBe(false);
  expect(commandSchema.safeParse({type:'vault-export',path:'C:/secret'}).success).toBe(false);
  for(const origin of ['http://example.com','https://example.com/path','https://user:pass@example.com'])expect(commandSchema.safeParse({type:'vault-save',entry:{id:randomUUID(),title:'test',username:'a',password:'b',origin}}).success).toBe(false);
});
