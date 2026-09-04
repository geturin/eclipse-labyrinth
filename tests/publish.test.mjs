import test from 'node:test';
import assert from 'node:assert/strict';
import { publishPrivate, parseArguments, validateName, verifyPrivateRepo } from '../scripts/publish.mjs';

function fake({user='geturin',privateRepo=true,owner='geturin',name='eclipse-labyrinth',existing=false,sha='abc123',failCreate=false}={}) {
  const calls=[];
  const execute=(command,args,options={})=>{
    calls.push({command,args,options});
    const key=args.join(' ');
    if(command==='gh'&&args[0]==='api'&&args[1]==='user')return {code:0,stdout:user};
    if(command==='git'&&key==='rev-parse --show-toplevel')return {code:existing?0:128,stdout:existing?'/parent/project':''};
    if(command==='git'&&key==='rev-parse HEAD')return {code:0,stdout:'abc123'};
    if(command==='gh'&&args[0]==='repo'&&failCreate)throw Error('already exists');
    if(command==='gh'&&args[0]==='api'&&args[1].includes('/git/ref/'))return {code:0,stdout:JSON.stringify({object:{sha}})};
    if(command==='gh'&&args[0]==='api')return {code:0,stdout:JSON.stringify({private:privateRepo,owner:{login:owner},name})};
    return {code:0,stdout:''};
  };
  return {calls,execute};
}
const hasPush=f=>f.calls.some(c=>c.command==='git'&&c.args.includes('push'));
const hasCreate=f=>f.calls.some(c=>c.command==='gh'&&c.args[0]==='repo');
function run(f,options={}){return publishPrivate({execute:f.execute,testFiles:['tests/engine.test.mjs'],announce:()=>{},...options});}

test('publish: successful plan uses private, verifies before push, and no force',()=>{
  const f=fake(),result=run(f);assert.equal(result.published,true);
  const create=f.calls.find(c=>c.command==='gh'&&c.args[0]==='repo');
  assert.ok(create.args.includes('--private'));assert.ok(!create.args.includes('--push'));assert.ok(!create.args.includes('--public'));
  const verified=f.calls.findIndex(c=>c.command==='gh'&&c.args[1]==='repos/geturin/eclipse-labyrinth');
  const pushed=f.calls.findIndex(c=>c.command==='git'&&c.args.includes('push'));assert.ok(verified<pushed);
  assert.ok(!f.calls.some(c=>c.args.some(a=>a==='--force'||a==='--global'||a==='--public'||a.includes('/pages'))));
});
test('publish: wrong account fails before all writes',()=>{const f=fake({user:'someoneelse'});assert.throws(()=>run(f));assert.ok(!hasCreate(f));assert.ok(!hasPush(f));});
test('publish: refuses existing parent/local Git repository',()=>{const f=fake({existing:true});assert.throws(()=>run(f));assert.ok(!hasCreate(f));assert.ok(!hasPush(f));});
test('publish: public repository never receives code',()=>{const f=fake({privateRepo:false});assert.throws(()=>run(f));assert.ok(!hasPush(f));});
test('publish: unexpected owner never receives code',()=>{const f=fake({owner:'someoneelse'});assert.throws(()=>run(f));assert.ok(!hasPush(f));});
test('publish: unexpected repository name never receives code',()=>{const f=fake({name:'wrong'});assert.throws(()=>run(f));assert.ok(!hasPush(f));});
test('publish: creation conflict stops without push or overwrite',()=>{const f=fake({failCreate:true});assert.throws(()=>run(f));assert.ok(!hasPush(f));});
test('publish: mismatched remote SHA cannot report success',()=>{const f=fake({sha:'different'});assert.throws(()=>run(f));});
test('publish: check-only mode has no GitHub/local Git writes',()=>{const f=fake();assert.equal(run(f,{checkOnly:true}).published,false);assert.ok(!hasCreate(f));assert.ok(!hasPush(f));assert.ok(!f.calls.some(c=>c.command==='git'&&c.args.includes('init')));});
test('publish: argument validation rejects injection and supports explicit safe name',()=>{
  for(const n of ['../other','a/b','--public','foo;exit','repo.git',''])assert.throws(()=>validateName(n));
  assert.deepEqual(parseArguments(['--check','--name','eclipse-labyrinth-v2']),{checkOnly:true,name:'eclipse-labyrinth-v2'});
  assert.throws(()=>parseArguments(['--public']));assert.throws(()=>verifyPrivateRepo(null,'test'));
});
