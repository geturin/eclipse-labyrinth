/** All gameplay content is declarative. No art or names from an existing franchise. */
export const VERSION = 1;
export const SAVE_KEY = 'eclipse-labyrinth.run.v1';
export const MAX_FLOOR = 5;
export const DIRECTIONS = [{ x: 0, y: -1, label: '北', short: 'N' }, { x: 1, y: 0, label: '东', short: 'E' }, { x: 0, y: 1, label: '南', short: 'S' }, { x: -1, y: 0, label: '西', short: 'W' }];
export const FLOORS = [
  { name: '遗忘的回廊', jp: '忘却の回廊', color: '#8ca3ed', lore: '你再次醒来。只有月亮记得，你曾经来过这里。' },
  { name: '磷光庭园', jp: '燐光の庭', color: '#67d8c4', lore: '没有阳光的庭园里，花依旧向着某个方向盛开。' },
  { name: '绯色礼拜堂', jp: '緋の礼拝堂', color: '#e893a8', lore: '祈祷早已停息，钟声却还在回响。' },
  { name: '坠星书库', jp: '墜星の書庫', color: '#c3a6f1', lore: '书页间夹着某个人未曾抵达的明天。' },
  { name: '无月王座', jp: '月なき玉座', color: '#edc686', lore: '故事的最后一页，只为还在前进的人留白。' },
];
export const JOBS = {
  knight: { id:'knight', name:'星刃骑士', jp:'星剣士', person:'希露菲', roman:'SYLPHIE', role:'守护 · 破甲', color:'#9caef9', weapon:'moonblade', hp:118, mp:28, atk:18, mag:10, def:9, spd:9, skills:['cleave','aegis','starfall'], passive:'星纹护佑', passiveDesc:'受到的伤害减少 12%。攻击破甲目标时额外回复 4 MP。', synopsis:'将星光铸为剑锋。能独自守住阵线，也能为同伴击穿敌人的防御。' },
  mage: { id:'mage', name:'焰咒魔导师', jp:'焔の魔導士', person:'莉瑟', roman:'LYS', role:'元素 · 爆发', color:'#eda58c', weapon:'emberstaff', hp:82, mp:48, atk:9, mag:23, def:4, spd:11, skills:['fire','frost','nova'], passive:'余烬循环', passiveDesc:'技能命中燃烧目标后回复 3 MP；普通攻击使用魔力计算。', synopsis:'冰与火，毁灭与重生。先点燃敌人，再用连锁魔法让火焰蔓延。' },
  shrine: { id:'shrine', name:'祈星巫女', jp:'星詠みの巫女', person:'澪', roman:'MIO', role:'治疗 · 共鸣', color:'#9dd5c7', weapon:'bellwand', hp:92, mp:42, atk:10, mag:19, def:6, spd:10, skills:['ray','mend','revive'], passive:'祈愿回声', passiveDesc:'每次造成伤害，自动治疗生命比例最低的存活队友（伤害的 20%）。', synopsis:'祈祷不意味着等待救援。以光驱散阴影，让每一次攻击都成为治愈。' },
  ninja: { id:'ninja', name:'影缝忍者', jp:'影縫い', person:'紫苑', roman:'SHION', role:'毒刃 · 追击', color:'#ccabea', weapon:'shadowfang', hp:88, mp:32, atk:19, mag:9, def:5, spd:18, skills:['venom','execute','veil'], passive:'猎影', passiveDesc:'攻击有负面状态的敌人，伤害提高 25%。', synopsis:'在破绽出现之前隐去身形。无论是毒、火，还是同伴留下的剑痕，都是信号。' },
  chrono: { id:'chrono', name:'刻时术士', jp:'刻の術師', person:'伊欧', roman:'IO', role:'加速 · 延迟', color:'#e8c783', weapon:'clockstaff', hp:90, mp:40, atk:11, mag:18, def:6, spd:13, skills:['pulse','haste','rewind'], passive:'时间利息', passiveDesc:'每回合开始时回复 2 MP；普通攻击使用魔力计算。', synopsis:'让敌人的一秒变得漫长，让同伴的下一秒提早到来。' },
  reaver: { id:'reaver', name:'血誓剑士', jp:'血誓の剣士', person:'绯音', roman:'AKANE', role:'吸血 · 背水', color:'#e389a3', weapon:'bloodedge', hp:126, mp:26, atk:22, mag:7, def:5, spd:12, skills:['rend','bloodpact','reap'], passive:'赤月誓约', passiveDesc:'生命低于 50% 时，造成的伤害提高 35%；所有伤害附带 10% 吸血。', synopsis:'以生命下注，把伤口化为力量。最危险的一刻，也离胜利最近。' },
};
export const SKILLS = {
  attack: { id:'attack', name:'普通攻击', icon:'sword', cost:0, power:1, target:'enemy', kind:'attack', desc:'造成武器伤害，回复 5 MP。' },
  guard: { id:'guard', name:'防御', icon:'shield', cost:0, target:'self', kind:'guard', desc:'直到下次行动，受到伤害减半并回复 7 MP。' },
  cleave: { id:'cleave', name:'碎星斩', icon:'sword', cost:6, power:1.35, target:'enemy', kind:'physical', status:'break', turns:3, desc:'135% 物理伤害，施加 3 回合破甲。破甲使物理伤害 +35%。' },
  aegis: { id:'aegis', name:'星纹壁垒', icon:'shield', cost:8, power:1, target:'self', kind:'aegis', desc:'自身回复 30% 生命，为全队施加 2 回合守护（减伤 30%）。' },
  starfall: { id:'starfall', name:'星陨剑阵', icon:'star', cost:13, power:1.05, target:'enemies', kind:'physical', desc:'对所有敌人造成 105% 物理伤害。' },
  fire: { id:'fire', name:'绯焰', icon:'flame', cost:6, power:1.25, target:'enemy', kind:'magic', element:'fire', status:'burn', turns:3, desc:'125% 火焰伤害，附加 3 回合燃烧。燃烧每回合造成生命上限 7% 伤害。' },
  frost: { id:'frost', name:'霜华', icon:'ice', cost:7, power:1.1, target:'enemy', kind:'magic', element:'ice', status:'slow', turns:2, desc:'110% 冰属性伤害并减速。击中燃烧目标触发融解，额外 +60% 伤害。' },
  nova: { id:'nova', name:'红莲终曲', icon:'flame', cost:15, power:1.05, target:'enemies', kind:'magic', element:'fire', status:'burn', turns:2, desc:'对全体敌人造成 105% 火焰伤害，附加 2 回合燃烧。' },
  ray: { id:'ray', name:'月光裁决', icon:'star', cost:5, power:1.3, target:'enemy', kind:'magic', element:'light', status:'marked', turns:2, desc:'130% 光属性伤害，留下 2 回合星标（受到所有伤害 +20%）。' },
  mend: { id:'mend', name:'花雨祈愿', icon:'heart', cost:10, power:1, target:'allies', kind:'heal', desc:'治疗全队：魔力 × 1.5 + 生命上限的 12%，净化燃烧与中毒。' },
  revive: { id:'revive', name:'晨星归还', icon:'heart', cost:14, power:1, target:'ally', kind:'revive', desc:'复活一名队友并恢复 40% 生命；目标存活时改为恢复 55%。' },
  venom: { id:'venom', name:'紫雾双刃', icon:'venom', cost:5, power:1.1, target:'enemy', kind:'physical', status:'poison', turns:4, desc:'110% 物理伤害，附加 4 回合中毒。中毒每回合造成生命上限 6% 伤害。' },
  execute: { id:'execute', name:'影缝·一闪', icon:'sword', cost:9, power:1.6, target:'enemy', kind:'physical', exploit:true, desc:'160% 物理伤害；每种负面状态额外 +20%（最高 +80%）。' },
  veil: { id:'veil', name:'胧月步', icon:'moon', cost:7, power:1, target:'self', kind:'veil', desc:'恢复 25% 生命并获得 2 回合迅捷（速度 +50%，伤害 +15%）。' },
  pulse: { id:'pulse', name:'时空脉冲', icon:'clock', cost:6, power:1.25, target:'enemy', kind:'magic', status:'slow', turns:3, desc:'125% 魔法伤害，使目标减速 3 回合。' },
  haste: { id:'haste', name:'加速咏唱', icon:'clock', cost:9, power:1, target:'allies', kind:'haste', desc:'全队获得 3 回合迅捷（速度 +50%，伤害 +15%）。行动顺序下一回合生效。' },
  rewind: { id:'rewind', name:'逆时针', icon:'heart', cost:8, power:1, target:'ally', kind:'rewind', desc:'治疗一名队友：魔力 × 2 + 15，解除所有负面状态。' },
  rend: { id:'rend', name:'绯红裂刃', icon:'sword', cost:5, power:1.45, target:'enemy', kind:'physical', drain:0.35, desc:'145% 物理伤害，恢复造成伤害的 35% 生命。' },
  bloodpact: { id:'bloodpact', name:'血之契约', icon:'heart', cost:0, power:1, target:'self', kind:'bloodpact', desc:'消耗当前生命 20%（不会自杀），恢复 12 MP，获得 3 回合狂热（伤害 +30%）。' },
  reap: { id:'reap', name:'赤月收割', icon:'moon', cost:12, power:1.15, target:'enemies', kind:'physical', drain:0.2, desc:'对全体敌人造成 115% 物理伤害，恢复伤害的 20%。' },
};
export const STATUS = {
  burn:{name:'燃烧',color:'#ffb58b',negative:true}, poison:{name:'中毒',color:'#b8da83',negative:true},
  break:{name:'破甲',color:'#e5a9b9',negative:true}, slow:{name:'迟缓',color:'#a8c9ef',negative:true},
  marked:{name:'星标',color:'#efdb94',negative:true}, haste:{name:'迅捷',color:'#85dfd1'},
  protect:{name:'守护',color:'#a9b9ff'}, fury:{name:'狂热',color:'#efa6ad'},
};
export const WEAPONS = {
  moonblade:{name:'未明之剑',type:'剑',atk:4,mag:1,effect:'guardbreak',effectName:'星痕',desc:'所有攻击有 30% 概率附加 2 回合破甲。',rarity:'common'},
  emberstaff:{name:'余烬枝',type:'法杖',atk:0,mag:5,effect:'kindle',effectName:'余火',desc:'攻击有 25% 概率附加 2 回合燃烧。',rarity:'common'},
  bellwand:{name:'初祈铃',type:'铃杖',atk:1,mag:4,effect:'lifewell',effectName:'祈愿',desc:'战斗中每次行动后，恢复自身 4% 生命。',rarity:'common'},
  shadowfang:{name:'薄暮牙',type:'双刃',atk:5,mag:0,effect:'toxin',effectName:'蛇吻',desc:'攻击有 25% 概率附加 2 回合中毒。',rarity:'common'},
  clockstaff:{name:'停摆的秒针',type:'时杖',atk:1,mag:4,effect:'mana',effectName:'滴答',desc:'每次行动后，额外回复 3 MP。',rarity:'common'},
  bloodedge:{name:'朱誓',type:'大剑',atk:6,mag:0,effect:'vampire',effectName:'血契',desc:'造成的伤害附带 18% 吸血。',rarity:'common'},
  eclipse:{name:'月蚀·无声',type:'剑',atk:11,mag:3,effect:'execution',effectName:'终幕',desc:'对生命低于 40% 的目标，伤害提高 50%。',rarity:'rare'},
  winter:{name:'白夜之枝',type:'法杖',atk:2,mag:12,effect:'frostbite',effectName:'永冬',desc:'对迟缓目标伤害提高 40%，攻击有 30% 概率施加迟缓。',rarity:'rare'},
  duet:{name:'双生誓言',type:'双刃',atk:9,mag:4,effect:'echo',effectName:'回响',desc:'攻击有 28% 概率追加一次 45% 伤害的回声。',rarity:'rare'},
  aurora:{name:'极光咏叹',type:'铃杖',atk:3,mag:11,effect:'chorus',effectName:'合唱',desc:'每次行动后，治疗生命比例最低的存活队友 8 点。',rarity:'rare'},
  sundial:{name:'第十三刻',type:'时杖',atk:5,mag:10,effect:'firstlight',effectName:'破晓',desc:'每场战斗的前两回合，伤害提高 40%。',rarity:'rare'},
  thorn:{name:'绯棘王冠',type:'大剑',atk:14,mag:0,effect:'bloodmoon',effectName:'背水',desc:'生命低于 50% 时，伤害提高 45%。',rarity:'rare'},
  comet:{name:'坠星裁决',type:'剑',atk:16,mag:7,effect:'cleave',effectName:'星屑',desc:'对单个目标造成伤害后，对其他敌人追加 25% 溅射伤害。',rarity:'legendary'},
  grimoire:{name:'禁书·第零页',type:'法杖',atk:2,mag:20,effect:'overload',effectName:'超载',desc:'技能伤害提高 40%，技能 MP 消耗额外 +2。',rarity:'legendary'},
  eternity:{name:'永恒的安可',type:'铃杖',atk:7,mag:16,effect:'phoenix',effectName:'返魂',desc:'每场战斗首次倒下时，立即以 35% 生命复活一次。',rarity:'legendary'},
  obsidian:{name:'黒羽·绝影',type:'双刃',atk:19,mag:3,effect:'affliction',effectName:'蚀骨',desc:'每种目标负面状态使伤害提高 18%。',rarity:'legendary'},
  genesis:{name:'创世时计',type:'时杖',atk:5,mag:18,effect:'economy',effectName:'零时',desc:'技能 MP 消耗降低 35%（向下取整，最低 1）。',rarity:'legendary'},
  requiem:{name:'葬月挽歌',type:'大剑',atk:22,mag:0,effect:'soulsteal',effectName:'噬魂',desc:'击败一个敌人后，回复 18% 生命和 6 MP。',rarity:'legendary'},
};
export const BOONS = [
  {id:'vitality',name:'生命之露',icon:'heart',desc:'全队生命上限 +14，并恢复 14 生命。',type:'stat',stat:'maxHp',value:14},
  {id:'power',name:'刃之记忆',icon:'sword',desc:'全队攻击力 +3。',type:'stat',stat:'atk',value:3},
  {id:'wisdom',name:'星语残篇',icon:'star',desc:'全队魔力 +3。',type:'stat',stat:'mag',value:3},
  {id:'armor',name:'银月鳞片',icon:'shield',desc:'全队防御 +2。',type:'stat',stat:'def',value:2},
  {id:'spirit',name:'澄澈魔泉',icon:'drop',desc:'全队 MP 上限 +8，并恢复 8 MP。',type:'stat',stat:'maxMp',value:8},
  {id:'swift',name:'流风羽',icon:'wind',desc:'全队速度 +2。',type:'stat',stat:'spd',value:2},
  {id:'embers',name:'不灭余烬',icon:'flame',desc:'燃烧与中毒的持续伤害 +40%（可叠加）。',type:'boon'},
  {id:'siphon',name:'赤色露珠',icon:'heart',desc:'全队所有伤害附带额外 7% 吸血。',type:'boon'},
  {id:'victory',name:'凯旋花束',icon:'flower',desc:'每次战斗胜利，全队额外恢复 10% 生命。',type:'boon'},
  {id:'focus',name:'静谧冥想',icon:'moon',desc:'全队每回合开始时，额外回复 2 MP。',type:'boon'},
  {id:'critical',name:'猎星之眼',icon:'eye',desc:'全队暴击率 +8%。暴击造成 150% 伤害。',type:'boon'},
  {id:'harmony',name:'共鸣之环',icon:'link',desc:'联携造成的伤害 +20%。不同角色连续攻击同一目标即可联携。',type:'boon'},
];
export const ENEMY_TYPES = {
  wisp:{name:'月灯灵',kind:'wisp',hp:43,atk:12,mag:13,def:2,spd:9,weak:'ice',tint:'#93a6ff',intent:['attack','hex','attack']},
  slime:{name:'墨滴史莱姆',kind:'slime',hp:57,atk:12,mag:8,def:3,spd:6,weak:'fire',tint:'#ac98de',intent:['attack','poison','guard']},
  moth:{name:'夜蝶',kind:'moth',hp:45,atk:14,mag:12,def:2,spd:16,weak:'fire',tint:'#d5aae8',intent:['attack','hex','heavy']},
  sentinel:{name:'失心卫士',kind:'sentinel',hp:76,atk:16,mag:5,def:7,spd:7,weak:'light',tint:'#9fb7d3',intent:['guard','heavy','attack']},
  revenant:{name:'无声的祈祷者',kind:'ghost',hp:58,atk:10,mag:20,def:3,spd:12,weak:'light',tint:'#c5b1e1',intent:['hex','drain','attack']},
  guardian:{name:'月门守卫',kind:'sentinel',hp:140,atk:17,mag:12,def:6,spd:8,weak:'ice',tint:'#d1ba8e',intent:['charge','sweep','heavy','guard']},
  sovereign:{name:'蚀月的圣女',kind:'sovereign',hp:350,atk:23,mag:23,def:9,spd:13,weak:'light',tint:'#d8b4f7',intent:['hex','charge','sweep','drain','heavy']},
};
export const INTENTS = {attack:{name:'攻击',icon:'sword'},heavy:{name:'重击',icon:'sword'},hex:{name:'咒火',icon:'flame'},poison:{name:'毒雾',icon:'venom'},guard:{name:'防御',icon:'shield'},charge:{name:'蓄力',icon:'star'},sweep:{name:'全体攻击',icon:'wind'},drain:{name:'汲取',icon:'heart'}};
export const RARITIES = {common:{name:'初始',color:'#adb5d0'},rare:{name:'稀有',color:'#b69af6'},legendary:{name:'传说',color:'#e5c083'}};
