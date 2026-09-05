# v0.3.3 · 中文 / English

## 玩家可见变化

读取浏览器语言偏好列表，按顺序选择第一个支持的 `zh` 或 `en`。所有 `zh-*` 使用简体中文；
所有 `en-*` 使用英文。没有支持项时默认英文。没有列表时读取 `navigator.language`。
例如 `ja-JP, zh-CN, en-US` 使用中文；仅 `ja-JP` 使用英文，不根据 IP、地区或时区猜语言。

页头 EN / 中 打开语言设置，支持「自动」「简体中文」「English」。手动选择以独立 key
`eclipse-labyrinth.language` 保存，优先于浏览器；返回自动后重新采用浏览器偏好。
自动模式响应 `languagechange`。存储被禁用时仍可启动、使用本次会话的选择。

覆盖标题页、六职业、全部基础/高阶/觉醒技能、武器、祝福、物品、事件、奖励、结局、
首领预兆、敌人意图、状态说明、战斗记录、地图工具、方向文字与画布目标标签。
英文按钮使用较短的技能名称以避免手机逐字折行，完整名称与规则保留在「Details」及无障碍说明中。
保留原来的紧凑人物卡选人、技能/物品共用区域和完整移动过渡，不增加新的常驻面板。

## 存档和架构

继续使用 `eclipse-labyrinth.run.v3`，v0.3 玩家无需重开。
既有数据与日志保持原来的稳定 ID、原文和数值；在显示层翻译，因此既有中文存档也能显示英文。
切换语言不会调用游戏行动、增加世界节拍、减少 CD、改变 RNG、修改角色或清空存档。
自定义种子不翻译，也不会解释成 HTML。不同域名/离线文件位置的存储隔离依然由浏览器决定。

`src/i18n-en.js` 是静态英文文案表；`src/i18n.js` 包含浏览器语言协商、独立偏好、
完整消息与参数模板匹配、旧复合句子翻译以及 DOM 文本/可访问性属性处理。
不替换原始 HTML、元素 ID、事件属性或 input value；画布文本先翻译后测量，避免英文标签超出边界。
主页面、弹窗、Toast、动画按钮和持续更新的罗盘分别在各自的显示边界处理。
`lang`、文档标题和描述跟随当前语言。完全离线，不使用翻译 API。

新增文案应更新英文目录和测试。游戏规则不应读取当前语言，也不应在数据对象上原地覆盖名称。
静态构建现在使用函数形式的字符串替换：内嵌代码中的 `$&`、`$'` 等字符必须按字面保留，
不能被误作替换模板导致静态页脚本损坏。包含专门的脚本解析回归。

## README、公开与托管

README 已加入中英文介绍及 https://tool.kero.zone/ 试玩入口。
提交 `dist/index.html` 并不等于已将该文件部署到用户的服务器；本项目未增加服务器部署或 Pages 配置。

用户已授权公开 GitHub 仓库。本次可用连接支持源码读写和 PR 合并，但没有修改仓库可见性的管理操作。
可见性必须单独确认，不能因为 README 放了试玩链接就宣称仓库公开。
仓库所有者可在 Settings → General → Danger Zone → Change repository visibility 选择 Public，
或在自己已登录的 GitHub CLI 中执行：

```sh
gh repo edit geturin/eclipse-labyrinth --visibility public --accept-visibility-change-consequences
```

官方说明：https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
CLI 参数：https://cli.github.com/manual/gh_repo_edit

公开也会开放代码历史及 Actions 历史/日志。已对读取到的 Git 历史进行有限的常见密钥模式检查：
7 个引用、149 个可达 blob 未匹配常见私钥、GitHub token、AWS access key、OpenAI token 或嵌入式凭据 URL，
未发现 `.env`、私钥、证书密钥等疑似路径。这不是完整安全审计，不包括所有 Actions 日志、附件、PR 讨论，
也不能证明绝无敏感信息。没有清理或重写历史，没有强制推送。

仅公开源代码，不自动授予新的软件许可；没有修改 license。npm 的 `private: true` 继续防止误发布 npm 包，
它不控制 GitHub 仓库可见性。

## 验证范围

新增 23 项 Node 语言/构建测试，以及 155 项英文浏览器检查；英文套件覆盖浏览器协商、覆盖偏好、
实时切换、被禁用存储、旧存档只读翻译、六职业/所有武器和祝福、技能冷却/物品/整轮攻击、五层首领、
事件/奖励/胜败结局、移动朝向、触屏详情和 360/390/768/1440px 布局。
扫描实际文案和 title/aria-label/alt/placeholder，检查没有意外剩余中文；语言选项中的「简体中文」
和自定义种子是刻意保留的例外。关键按钮内容与回合标题也检查了裁切和重叠。

旧浏览器测试显式指定中文，不把环境默认语言作为隐含前提；新测试独立指定英文及其他浏览器语言。
控件演出在点击前自然结束时，测试不再将已消失的跳过按钮误报为失败，但仍检查最终状态。
全部测试仍运行真实构建和指定场景，存储为内存替身；不是原生离线文件存储或真实 iPhone/Safari 验证。
未重新验证长期数值平衡或眩晕改善。远端 CI 成败以 Actions 实际结果为准。
