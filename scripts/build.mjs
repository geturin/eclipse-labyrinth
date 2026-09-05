import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// A deliberately tiny closed-world bundler for the local ES modules.
// It supports only named imports and declarations used by this project. No eval or network.
const modules=['data','rng','world','engine','art','sprite-art','sprite-scene','renderer','audio','app'];
let bundle=`(()=>{'use strict';const modules=Object.create(null);const cache=Object.create(null);function require(id){if(cache[id])return cache[id];if(!modules[id])throw Error('Unknown module '+id);const exports=cache[id]={};modules[id](exports,require);return exports;}\n`;
for(const id of modules){
  let code=await readFile(path.join(root,'src',`${id}.js`),'utf8');
  const names=[...code.matchAll(/^export\s+(?:async\s+)?(?:const|let|class|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  code=code.replace(/^import\s+\{([^}]+)\}\s+from\s+['"]\.\/([^'"]+)\.js['"];?\s*$/gm,(_,items,dep)=>`const {${items}}=require('${dep}');`);
  code=code.replace(/^export\s+(?=(?:async\s+)?(?:const|let|class|function)\s)/gm,'');
  if(/^import\s|^export\s/m.test(code))throw Error(`Unsupported module syntax in ${id}`);
  bundle+=`modules['${id}']=(exports,require)=>{\n${code}\nObject.assign(exports,{${names.join(',')}});\n};\n`;
}
bundle+=`require('app');})();`;
let html=await readFile(path.join(root,'index.html'),'utf8');
const css=await readFile(path.join(root,'style.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">',`<style>\n${css}\n</style>`).replace('<script type="module" src="./src/app.js"></script>',`<script>\n${bundle.replace(/<\/script/gi,'<\\/script')}\n</script>`);
await mkdir(path.join(root,'dist'),{recursive:true});await writeFile(path.join(root,'dist/index.html'),html);
console.log(`Built dist/index.html (${Math.round(Buffer.byteLength(html)/1024)} KB), self-contained, zero runtime requests.`);
