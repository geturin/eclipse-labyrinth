// One-time migration helper. Acorn is only used by staging, not by the shipped game.
const acorn=require(process.env.ACORN_PATH||'/opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/acorn');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.argv[2],stage=process.argv[3],out=process.argv[4];
const files=['app.js','data.js','engine.js','navigation.js','renderer.js','sprite-scene.js','world.js'];
const list=[],has=s=>/[\u4e00-\u9fff\u3040-\u30ff]/.test(s);
function add(s){s=s.trim();if(has(s)&&!list.includes(s))list.push(s);}
function html(s){for(const m of s.matchAll(/(?:title|aria-label|alt|placeholder)="([^"]*)"/g))add(m[1]);s.replace(/<[^>]*>/g,'\n').split('\n').forEach(add);}
function accept(s){if(has(s)){if(s.includes('<'))html(s);else add(s);}}
function walk(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='Literal'&&typeof node.value==='string')accept(node.value);
 if(node.type==='TemplateLiteral')accept(node.quasis.map((q,i)=>(q.value.cooked??q.value.raw)+(i<node.expressions.length?(node.expressions[i].type==='CallExpression'&&node.expressions[i].callee.name==='icon'?'':`{${i}}`):'')).join(''));
 for(const [key,value] of Object.entries(node)){if(key==='type')continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
}
for(const file of files)walk(acorn.parse(fs.readFileSync(path.join(root,'src',file),'utf8'),{ecmaVersion:'latest',sourceType:'module'}));
const values=Array.from({length:6},(_,i)=>JSON.parse(fs.readFileSync(path.join(stage,`en-${i}.json`),'utf8'))).flat();
assert.equal(list.length,854);assert.equal(values.length,list.length);
const messages=Object.fromEntries(list.map((s,i)=>[s.replaceAll('v0.3.2','v0.3.3'),values[i]]));
Object.assign(messages,{
 'Language / 语言':'Language','语言 / Language':'Language',
 '跟随浏览器语言，也可以手动选择。':'Follow your browser preferences, or choose a language manually.',
 '自动 / Browser default':'Automatic / Browser default','简体中文':'简体中文',
 ' · 第 {0} 层 · 本局已自动保存':' · Floor {0} · Autosaved',
 '· 第 {0} 层 · 本局已自动保存':'· Floor {0} · Autosaved',
 '· 新一局将清空所有等级、武器、技能强化与祝福。':'· A new run resets levels, weapons, skill upgrades, and blessings.',
 '{0} 技能可用':'{0} skills ready','{0}：剩余 {1} 次行动{2}':'{0}: {1} actions remaining{2}',
 '{0}：本回合有效{1}':'{0}: active this round{1}'
});
fs.writeFileSync(out,'/** Hand-authored English presentation catalog. Canonical game IDs and saved state remain unchanged.\n * {n} denotes a captured parameter in a legacy display message, not HTML. */\nexport const EN_MESSAGES = '+JSON.stringify(messages,null,2)+';\n');
