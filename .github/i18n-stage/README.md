# Eclipse Labyrinth · 月蝕の迷宮

**[Play in your browser / 在线试玩 → https://tool.kero.zone/](https://tool.kero.zone/)**

**v0.3.3 — 中文 / English.** An original anime-inspired, first-person roguelike dungeon RPG. Form a party of 1–3 adventurers, explore five random floors, and build a new combination of weapons, abilities, awakenings, and blessings on every run.

## English

### Language and saves

The game automatically selects **Chinese or English** from the browser's preferred languages. The first supported language wins: `zh-*` uses simplified Chinese, `en-*` uses English, and an unsupported language list falls back to English. Use the **EN / 中** button in the header to override the choice or return to **Automatic**. No translation service or network request is used.

The v0.3 save format is unchanged. Switching languages changes presentation only: it does not reset the run or alter combat, cooldowns, random generation, or enemy movement. Language preference is saved separately. Saves from v0.1/v0.2 remain untouched and are not migrated. Different websites or offline file locations may not share browser storage.

### How to play

**Prepare → Attack → enemy turn.** Select an adventurer by clicking their HP/status card. Use multiple ready abilities and finite supplies, then press **Attack** to commit the round. Abilities have independent cooldowns, not MP costs. A CD 3 ability used in round 1 is ready in round 4. Guarding skips that adventurer's normal attack and reduces damage taken.

Only walking, waiting, and a committed combat round advance dungeon time. Ordinary packs follow fixed patrols; a successfully cast alarm draws nearby patrols to the battle. Elites track the party. Field tools can lure, briefly stop, or silence enemies before combat. Reinforcements begin acting on the next round.

Each of six jobs starts with two abilities and can learn three advanced abilities during the run. Awakenings change mechanics rather than only increasing numbers. Equipment is **one weapon per adventurer**, with one fixed special effect per weapon; no armor or accessory slots. Bosses have turn- and HP-triggered omens with visible counterplay.

Exploration uses short, finite grid movement and quarter turns, a north-up minimap, and heading cues. Movement style is configurable; reduced-motion preferences take priority. Combat animation can be skipped without skipping or repeating its result.

### Controls

| Exploration | Combat |
| --- | --- |
| W / S: forward / back | Click a party card: select that hero or an ally target |
| A / D: turn; Q / E: strafe | 3–7: use selected hero's abilities |
| Space: wait; F: interact | 2: toggle Guard; [ / ]: switch hero |
| M: map; I: inventory; T: field tools | 1 / Enter: Attack; Esc: skip presentation |

Enter/Space retain normal button activation when a button is focused. Mouse and touch controls are also available. Full ability and item explanations are accessible from **Details**, not only by hovering.

### Offline play

Download **[`dist/index.html`](dist/index.html)** and open it in a browser. This is the complete self-contained build; the root `index.html` is the development entry point. There is no backend, account, telemetry, or external asset download. The online play link above is the project owner's hosting; this repository does not configure GitHub Pages or deploy to that server.

## 中文

### 语言与存档

首次访问时按照浏览器的语言优先顺序，选择支持的**中文或英文**。`zh-*` 显示简体中文，`en-*` 显示英文；列表中没有支持的语言时使用英文。点击页头 **EN / 中** 可手动选择，也可恢复自动。两种语言都包含在离线静态页中，不调用翻译服务。

沿用 v0.3 存档，**无需新开一局**。切换语言只影响界面，不改变角色、回合、冷却、随机数或地图敌人；语言偏好独立保存。旧 v1/v2 存档不删除、不迁移。不同网站或离线文件位置能否共享存储取决于浏览器。

### 玩法

第一人称探索五层随机地牢，六职业选择 1～3 人编队。每局武器、技能、觉醒和祝福从零开始。

**我方准备 → 全队攻击 → 敌方行动。** 点击人物状态卡切换角色，自由使用就绪技能与有限物品，最后提交全队攻击。技能使用独立 CD，不消耗 MP；CD 3 在 R1 使用后 R4 就绪。防御、物品、换人和战前工具不耗回合。每人仅装备一把武器，每把一个固有效果。

普通怪固定巡逻，报警怪成功施法才吸引附近敌群；精英持续寻路追踪。诱导铃、眠缚铃、静音粉可在战前控场，增援下一轮才行动。Boss 保留回合/血线预兆和驱散、封印、多段、清理侍从及防御等应对。

W/S 前后、A/D 转向、Q/E 平移、Space 等待、F 调查、M 地图、I 行囊、T 战前工具。战斗 1/Enter 全队攻击、2 防御、3～7 技能、[ / ] 换人。焦点在按钮上时 Enter/Space 只操作该按钮，避免误提交回合。支持点击/触控。

在线体验见页首链接；离线使用下载后的 `dist/index.html`。紧凑 UI、移动视角设置和北向地图均保留；完整说明在「详情」，首领当前预兆不会隐藏。

## Development / 开发与交付

Node.js **20+**, no npm dependencies. / 不需要安装 npm 依赖。

```sh
npm test
npm run build
npm run verify:dist
npm run dev
```

**Every source change ships its rebuilt `dist/index.html` in the same commit.** 每次修改源码，都把重编译的静态页一起提交；CI 检查字节一致性，不强推。`package.json` 的 `private: true` 仅用于防止误发布到 npm，与 GitHub 仓库可见性无关。

Browser suites require Python Playwright and Chromium. / 浏览器回归额外需要 Python Playwright 与 Chromium：

```sh
CHROMIUM_PATH=/usr/bin/chromium python tests/render_browser.py
CHROMIUM_PATH=/usr/bin/chromium python tests/battle_browser.py
CHROMIUM_PATH=/usr/bin/chromium python tests/browser_smoke.py
CHROMIUM_PATH=/usr/bin/chromium python tests/compact_browser.py
CHROMIUM_PATH=/usr/bin/chromium python tests/navigation_browser.py
CHROMIUM_PATH=/usr/bin/chromium python tests/i18n_browser.py
```

English text lives in `src/i18n-en.js`; locale selection and presentation-only translation live in `src/i18n.js`. Canonical content and existing saved logs remain language-independent. New UI/data text needs a catalog entry and bilingual tests. No runtime translation API is required.

Current rules: [`docs/V03.md`](docs/V03.md). UI: [`docs/UI031.md`](docs/UI031.md). Movement: [`docs/MOVEMENT032.md`](docs/MOVEMENT032.md). Localization: [`docs/I18N033.md`](docs/I18N033.md). Earlier design/QA files are historical, not current balance claims.

Tests use controlled scenarios and in-memory Storage. They do not establish real iPhone Safari support, native `file:` storage behavior, low-end performance, long-run balance, or freedom from motion sickness. Repository visibility does not grant a new software license; no license change is included in this update.
