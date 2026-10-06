import {describe,it,expect} from 'vitest';
import {originOf,isThirdParty,permissionNames,validPermissionContext} from '../src/main/privacyPolicy';
import {siteOriginSchema} from '../src/shared/privacy';
import {Repository} from '../src/main/database';
describe('privacy boundaries',()=>{
  it('uses registrable domains, including private hosting suffixes',()=>{
    expect(isThirdParty('https://cdn.example.co.uk/a','https://www.example.co.uk')).toBe(false);
    expect(isThirdParty('https://other.co.uk','https://example.co.uk')).toBe(true);
    expect(isThirdParty('https://alice.github.io','https://bob.github.io')).toBe(true);
    expect(isThirdParty('http://localhost:123','http://127.0.0.1:123')).toBe(true);
  });
  it('rejects embedded frames, opaque origins and origin lookalikes',()=>{
    expect(validPermissionContext('https://example.com/a','https://example.com/b',true)).toBe(true);
    expect(validPermissionContext('https://example.com','https://example.com',false)).toBe(false);
    expect(validPermissionContext('https://example.com','https://example.com.evil.test',true)).toBe(false);
    expect(validPermissionContext('about:blank','about:blank',true)).toBe(false);
    expect(originOf('file:///secret')).toBe('');
    expect(siteOriginSchema.safeParse('https://example.com/path').success).toBe(false);
    expect(siteOriginSchema.safeParse('https://user:pass@example.com').success).toBe(false);
  });
  it('maps media capabilities separately and denies unknown devices',()=>{
    expect(permissionNames('media',['audio'])).toEqual(['microphone']);
    expect(permissionNames('media',['video'])).toEqual(['camera']);
    expect(permissionNames('usb')).toEqual([]);
  });
  it('isolates stored permissions and exceptions by workspace and origin',()=>{
    const repo=new Repository(':memory:');try{
      repo.setPermission('a','https://example.com','camera','allow');
      repo.setException('a','https://example.com',true);
      expect(repo.permission('a','https://example.com','camera')).toBe('allow');
      expect(repo.permission('b','https://example.com','camera')).toBeUndefined();
      expect(repo.permission('a','https://other.test','camera')).toBeUndefined();
      expect(repo.exception('b','https://example.com')).toBe(false);
      repo.resetPermissions('a','https://example.com');
      expect(repo.permission('a','https://example.com','camera')).toBeUndefined();
      repo.setException('a','https://example.com',false);
      expect(repo.exception('a','https://example.com')).toBe(false);
    }finally{repo.close();}
  });
});
