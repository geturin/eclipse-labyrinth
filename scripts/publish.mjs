#!/usr/bin/env node
/** First publication only. Never publishes a website or overwrites an existing repository.
 * Requires an existing, local GitHub CLI login. Tokens are never read or printed here.
 * Run from a freshly extracted project: node scripts/publish.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_OWNER = 'geturin';
export const DEFAULT_NAME = 'eclipse-labyrinth';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLICATION_FILES = [
  '.gitignore', 'package.json', 'index.html', 'style.css', 'README.md',
  'AGENTS.md', 'src', 'scripts', 'tests', 'docs', 'dist',
];

export function validateName(name) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(name) || name.endsWith('.git')) {
    throw new Error('仓库名只能使用字母、数字、点、短横线或下划线，不能以 .git 结尾。');
  }
  return name;
}

export function verifyPrivateRepo(meta, name) {
  if (meta?.private !== true || meta.owner?.login?.toLowerCase() !== EXPECTED_OWNER || meta.name !== name) {
    throw new Error('仓库的私密性、所有者或名称验证失败；已停止，不会上传代码。');
  }
}

export function parseArguments(args) {
  let name = DEFAULT_NAME, checkOnly = false;
  for (let i=0;i<args.length;i++) {
    if (args[i] === '--check') checkOnly = true;
    else if (args[i] === '--name') name = validateName(args[++i]);
    else throw new Error(`未知参数：${args[i]}。支持 --check 或 --name <仓库名>。`);
  }
  return {name:validateName(name),checkOnly};
}

/** Adapter is injectable so safety checks can be tested without GitHub writes. */
export function makeExecutor(root = ROOT) {
  return (command,args,{optional=false,stream=false}={}) => {
    const result = spawnSync(command,args,{
      cwd:root, encoding:'utf8', shell:false,
      stdio:stream?'inherit':'pipe',
      env:{...process.env,GH_HOST:'github.com',GIT_TERMINAL_PROMPT:'0'},
    });
    if (result.error) throw new Error(`无法执行 ${command}：${result.error.message}\n请先安装 Git / GitHub CLI / Node.js，并重新打开终端。`);
    const reply = {code:result.status ?? 1,stdout:(result.stdout||'').trim(),stderr:(result.stderr||'').trim()};
    if (reply.code !== 0 && !optional) {
      throw new Error(`${command} ${args.join(' ')} 执行失败。\n${reply.stderr}\n未登录时，请先运行：gh auth login --hostname github.com --web --git-protocol https`);
    }
    return reply;
  };
}

export function publishPrivate({name=DEFAULT_NAME,checkOnly=false,root=ROOT,execute=makeExecutor(root),testFiles=null,announce=console.log}={}) {
  validateName(name);
  const target=`${EXPECTED_OWNER}/${name}`;
  execute('git',['--version']);
  execute('gh',['--version']);
  const user=execute('gh',['api','user','--jq','.login','--hostname','github.com']).stdout;
  if(user.toLowerCase()!==EXPECTED_OWNER) throw new Error(`当前 GitHub CLI 账号是 ${user}，预期为 ${EXPECTED_OWNER}。已停止。请使用 gh auth switch 切换正确账号。`);
  const existing=execute('git',['rev-parse','--show-toplevel'],{optional:true});
  if(existing.code===0) throw new Error('此目录已经位于一个 Git 仓库中。首次发布脚本拒绝修改现有仓库或父目录。请将下载包解压到独立的新目录；已有仓库后续请使用正常的 git 提交/推送流程。');
  const files=testFiles || readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.mjs')).map(f=>`tests/${f}`);
  execute(process.execPath,['--test',...files],{stream:true});
  execute(process.execPath,['scripts/build.mjs'],{stream:true});
  announce(`检查通过。目标：${target}；可见性：private。`);
  if(checkOnly){announce('仅检查：没有初始化仓库、创建远程仓库或上传文件。');return {target,published:false};}

  execute('git',['init','--initial-branch=main'],{stream:true});
  execute('git',['add','--',...PUBLICATION_FILES]);
  // Command-local identity and credential helper: no global Git configuration changes.
  execute('git',['-c',`user.name=${EXPECTED_OWNER}`,'-c','user.email=87827677+geturin@users.noreply.github.com','-c','commit.gpgsign=false','commit','-m','feat: playable Eclipse Labyrinth roguelike DRPG'],{stream:true});
  // Deliberately do not use --push: verify PRIVATE before sending any source code.
  execute('gh',['repo','create',target,'--private','--description','月蝕の迷宮 — 第一人称探索 × 职业联携 × 随机构筑 DRPG'],{stream:true});
  let meta=JSON.parse(execute('gh',['api',`repos/${target}`,'--hostname','github.com']).stdout);
  verifyPrivateRepo(meta,name);
  const remote=`https://github.com/${target}.git`;
  execute('git',['remote','add','origin',remote]);
  execute('git',['-c','credential.https://github.com.helper=','-c','credential.https://github.com.helper=!gh auth git-credential','push','--set-upstream','origin','main'],{stream:true});
  const local=execute('git',['rev-parse','HEAD']).stdout;
  const pushed=JSON.parse(execute('gh',['api',`repos/${target}/git/ref/heads/main`,'--hostname','github.com']).stdout);
  if(pushed.object?.sha!==local) throw new Error('远端提交与本地提交不一致，请检查推送结果。');
  meta=JSON.parse(execute('gh',['api',`repos/${target}`,'--hostname','github.com']).stdout);
  verifyPrivateRepo(meta,name);
  const url=`https://github.com/${target}`;
  announce(`已发布并验证：${url}\n私密仓库；main 提交：${local}\n没有启用 GitHub Pages，也没有公开部署游戏。`);
  return {target,published:true,url,commit:local};
}

if(process.argv[1] && realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url))) {
  try { publishPrivate(parseArguments(process.argv.slice(2))); }
  catch(error) { console.error(`\n发布停止：${error.message}\n若远程已创建但推送中断，请参见 docs/PUBLISH.md。不要删除现有仓库或使用强制推送。`); process.exitCode=1; }
}
