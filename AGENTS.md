# Agent 维护指引

先阅读 README.md、docs/GAME_DESIGN.md 和 docs/QA.md。这个项目是已可玩的首版，修改应围绕用户指定目标，不顺手扩展或替换玩法。

## 必須保持的规则

- 第一人称随机迷宫 + JRPG 指令回合制，不改成俯视动作游戏或战棋。
- 1～3 人编队；职业可独行，也有状态与行动顺序联动。
- 每局从零，没有永久数值加成。保留当前局的保存和恢复，不把存档误当成跨局成长。
- 装备只有武器，每把只有一个固有效果；不要擅自添加护甲、饰品或随机多词条。
- 仅发布私密仓库。未得到用户明确授权，不启用 Pages、外部托管、遥测、账号系统或公开可见性。
- 不使用任何外部游戏的角色、音乐、商标素材或未经授权的美术。

## 入口和验证

`src/data.js` 内容，`src/engine.js` 规则，`src/app.js` UI，`src/renderer.js` 第一人称画面，`src/art.js` 矢量图，`src/audio.js` 音频。无运行时依赖。

```sh
npm run check
npm run dev
```

可选 UI 验证：`CHROMIUM_PATH=/usr/bin/chromium python tests/browser_smoke.py`。测试使用内存页面与 Storage 替身，因此其通过不代表所有真实浏览器存储策略验证通过。

改源码后重新生成并提交 `dist/index.html`，不要只改 dist。引擎要继续保持无 DOM 依赖、确定性 RNG 和序列化状态。新效果必须写测试，尤其是击杀、死亡/返魂、强化上限、目标合法性和状态持续回合。

## GitHub 发布边界

`scripts/publish.mjs` 是首次发布脚本，目标所有者 `geturin`；默认仓库名 `eclipse-labyrinth`。不要绕过账号/私密性验证、自动删除现有仓库或添加 force push。对真实写入结果必须读取验证，不能把本地构建或脚本生成说成远端发布成功。
