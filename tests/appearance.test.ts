import {it,expect} from 'vitest';
import {checkImageBounds} from '../src/main/imageBounds';
it('rejects oversized and non-raster wallpaper before decoding',()=>{
  const png=Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(800,16);png.writeUInt32BE(500,20);expect(()=>checkImageBounds(png)).not.toThrow();
  png.writeUInt32BE(100000,16);expect(()=>checkImageBounds(png)).toThrow();expect(()=>checkImageBounds(Buffer.from('<svg/>'))).toThrow();
  const jpeg=Buffer.from([255,216,255,192,0,7,8,1,244,3,32]);expect(()=>checkImageBounds(jpeg)).not.toThrow();
});
