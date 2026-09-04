import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const filename=path.join(root,'dist/index.html');
const before=await readFile(filename,'utf8').catch(()=>null);
const result=spawnSync(process.execPath,[path.join(root,'scripts/build.mjs')],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
const after=await readFile(filename,'utf8');
if(before!==after){console.error('dist/index.html was stale and has been rebuilt. Review and commit it with the source.');process.exitCode=1;}
else console.log('Verified: committed static HTML matches the source byte for byte.');
