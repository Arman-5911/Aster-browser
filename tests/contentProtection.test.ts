import {it,expect} from 'vitest';
import {supportsPlayerProtection} from '../src/shared/contentProtection';
it('limits player protection to supported HTTPS YouTube hosts',()=>{
  for(const host of ['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'])expect(supportsPlayerProtection(`https://${host}/watch?v=test`)).toBe(true);
  for(const value of ['https://youtube.com.evil.test','https://evil.test/youtube.com','http://www.youtube.com','file:///youtube.com','https://example.com'])expect(supportsPlayerProtection(value)).toBe(false);
});
