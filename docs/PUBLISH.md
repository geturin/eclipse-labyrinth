# 首次发布到私密 GitHub 仓库

## 当前交付状态

游戏源码和离线构建已经生成、测试。**远端仓库没有由本次交付创建或推送。** 当前可用 GitHub 连接仅提供读取能力；本机发布脚本完成缺少的写入步骤。目标为 `geturin/eclipse-labyrinth`，这只是目标名称，不是已发布声明。

## 正常操作

安装 Node.js 20+、Git 2.28+、GitHub CLI。将源码包解压到独立目录，不要放在另一个 Git 仓库内部。

在该目录打开 PowerShell、终端或 VS Code 终端：

```sh
gh auth login --hostname github.com --web --git-protocol https
node scripts/publish.mjs
```

已经正确登录 `geturin` 时，不必重复登录。脚本会读取当前登录名，不会读取或打印 token。登录了错误账号时脚本会停止；可通过 `gh auth switch --hostname github.com --user geturin` 切换已登录账号。

仅检查环境、账号、引擎测试和构建，不初始化 Git 或创建远程：

```sh
node scripts/publish.mjs --check
```

更改**新**仓库名称：

```sh
node scripts/publish.mjs --name eclipse-labyrinth-v2
```

不能通过参数更换所有者、改成公开仓库或绕过私密性检查。

## 安全边界

脚本只处理第一次发布，拒绝已有 Git 仓库及其子目录。文件通过固定白名单加入提交；使用命令级作者身份和 GitHub 凭据助手，不修改全局 Git 配置。不在脚本中记录、输出或嵌入凭据。

创建命令明确使用 `gh repo create ... --private`，**不同时使用 `--push`**。创建后先读取远端 metadata，确认 `private === true`、所有者为 `geturin`、名称吻合，才执行非强制 `git push`。推送后再次检查私密性，并比对本地与远端 `main` 的提交 SHA。

仓库同名已存在时创建会失败；脚本不会删除它，不会切换可见性，也不会推送到原有仓库。需要保留已有仓库时，应选择新的仓库名。

脚本不会开启 GitHub Pages 或任何网站托管。**将源代码放进私密仓库不等于已经部署了可在线访问的游戏。** 网站部署和访问控制需要另行决定，本交付不擅自公开页面。

## 中途失败

如果在创建之前失败，没有远端新仓库；可能已有本地 `.git` 和初始提交。如果创建成功而推送中断，可能留下一个空的私密远端。脚本会停止，而不是删除或强制重试。

先检查，不要直接删除或重建：

```sh
git status
git remote -v
gh repo view geturin/eclipse-labyrinth --json nameWithOwner,isPrivate,url
```

确认显示的是自己的正确私密仓库，且本地是本游戏项目。若脚本已配置正确 `origin`，正常重试推送：

```sh
git -c credential.https://github.com.helper= -c "credential.https://github.com.helper=!gh auth git-credential" push --set-upstream origin main
```

若 `origin` 尚不存在，只在确认仓库所有者、名称和 `isPrivate: true` 后添加：

```sh
git remote add origin https://github.com/geturin/eclipse-labyrinth.git
```

不要对任何已有仓库使用 `--force`，也不要为了“解决权限”改为 public。

后续代码更新是普通 Git 工作流：修改源码、运行 `npm run check`、提交并推送。单文件 `dist/index.html` 也应随着源码重新构建并提交。

## 官方参考

- GitHub CLI 新建仓库参数：https://cli.github.com/manual/gh_repo_create
- GitHub CLI 登录：https://cli.github.com/manual/gh_auth_login
- GitHub CLI 配置 Git 凭据：https://cli.github.com/manual/gh_auth_setup-git

本脚本通过了模拟执行器的安全测试，包括账号错误、误建公开仓库、所有者错误、名称错误、重名失败与 SHA 不符时拒绝报告成功；**没有在交付环境进行真实 GitHub 推送验证**。
