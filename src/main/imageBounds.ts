/** Reject oversized raster dimensions before asking Chromium to decode pixels. */
export function checkImageBounds(data:Buffer){
  let width=0,height=0;
  if(data.length>=24&&data.subarray(0,8).toString('hex')==='89504e470d0a1a0a'){
    width=data.readUInt32BE(16);height=data.readUInt32BE(20);
  }else if(data.length>4&&data[0]===255&&data[1]===216){
    let offset=2;
    while(offset+4<=data.length&&data[offset]===255){
      const marker=data[offset+1];if(marker===255){offset++;continue;}if(marker===218||marker===217)break;
      const length=data.readUInt16BE(offset+2);if(length<2||offset+length+2>data.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=data.readUInt16BE(offset+5);width=data.readUInt16BE(offset+7);break;}
      offset+=length+2;
    }
  }
  if(!width||!height||width*height>24000000||width>16000||height>16000)throw new Error('Use a PNG or JPEG image under 24 megapixels and 16,000 pixels per side.');
}
