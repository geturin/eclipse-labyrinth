# 已有私密仓库的更新流程

目标：`geturin/eclipse-labyrinth`。仓库已经创建，日常更新不要重跑首次创建脚本。
不要把仓库改为 public，不启用公开 Pages。

## 每次源码修改

```sh
npm test
npm run build
npm run verify:dist
git status
```

核对修改范围后，将相关源码/测试/文档与 `dist/index.html` **一起**提交；随后正常
`git push`，不强推。根目录 `index.html` 不是最终单文件，编译产物是 `dist/index.html`。
使用 feature 分支时，PR 中也必须带此文件；检查通过后可合并到 main。

## 自动安全网

`.github/workflows/static-build.yml`：
- 所有分支源码 push 会运行 Node 测试和静态构建。
- PR 使用只读 contents 权限，检查产物与源码是否一致；不同则失败。
- push/workflow_dispatch 才有独立 contents-write 同步任务；发现陈旧产物则只提交
  `dist/index.html`，不强推，不覆盖同期新提交。
- 纯 dist、文档修改不反复触发 push 构建，避免静态页提交循环；PR 仍检查。
- 没有 deploy、公开托管、外部存储或用户数据上传步骤。

若分支保护阻止 bot 写入，应在本地重建并提交静态页，或在有权限的 feature 分支完成。
不要为此关闭保护、扩大凭据权限或改仓库可见性。

## 初次创建脚本

`scripts/publish.mjs` 是 v0.1 保留的首次私密创建工具，需要 Git、Node.js 和已授权的
GitHub CLI。它会拒绝已存在的同名仓库，因此不是本仓库的日常更新命令。

## 试玩与备份

用户从仓库下载 `dist/index.html` 后可以离线打开。仅推送私密源码不产生在线试玩 URL。
迁移或替换文件前可保留原 HTML；v2 不会读取/删除 v1 的存档 key。
