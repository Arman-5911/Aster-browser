import { build } from 'esbuild';
import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {FiltersEngine} from '@ghostery/adblocker';
await build({ entryPoints: ['src/main/index.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: 'dist/main/index.cjs' });
await build({ entryPoints: ['src/preload/index.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: 'dist/preload/index.cjs' });
await build({ entryPoints: ['src/preload/content.ts'], bundle: true, platform: 'node', format: 'cjs', external: ['electron'], outfile: 'dist/preload/content.cjs' });
await mkdir('dist/main/filters',{recursive:true});
for(const name of ['easyprivacy','easylist']){
  const rules=await readFile(`resources/filters/${name}.txt`,'utf8');
  const engine=FiltersEngine.parse(rules,{loadCosmeticFilters:false,loadCSPFilters:false,enableHtmlFiltering:false});
  await writeFile(`dist/main/filters/${name}.bin`,engine.serialize());
}
await cp('resources/filters','dist/main/filters',{recursive:true});

await cp('resources/icons','dist/main/icons',{recursive:true});

await build({entryPoints:['src/preload/extensionVolume.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:'dist/preload/extensionVolume.cjs'});
