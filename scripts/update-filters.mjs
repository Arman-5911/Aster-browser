import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('resources/filters',{recursive:true});
const metadata={retrievedAt:new Date().toISOString(),lists:[]};
for(const name of ['easyprivacy','easylist']){
  const url=`https://easylist.to/easylist/${name}.txt`;
  const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error(`Filter download failed: ${response.status}`);
  const data=await response.text();
  if(!data.startsWith('[Adblock Plus')||data.length>8_000_000)throw new Error('Unexpected filter list format.');
  await writeFile(`resources/filters/${name}.txt`,data);
  metadata.lists.push({name,url,sha256:createHash('sha256').update(data).digest('hex'),bytes:Buffer.byteLength(data)});
}
await writeFile('resources/filters/metadata.json',JSON.stringify(metadata,null,2)+'\n');
console.log('Downloaded public filter lists. No browsing data was sent.');
