/** All gameplay content is declarative. No art or names from an existing franchise. */
export const VERSION = 2;
export const SAVE_KEY = 'eclipse-labyrinth.run.v2';
export const MAX_FLOOR = 5;
export const DIRECTIONS = [{ x: 0, y: -1, label: '北', short: 'N' }, { x: 1, y: 0, label: '东', short: 'E' }, { x: 0, y: 1, label: '南', short: 'S' }, { x: -1, y: 0, label: '西', short: 'W' }];
export const FLOORS = [
  { name: '遗忘的回廊', jp: '忘却の回廊', color: '#8ca3ed', lore: '你再次醒来。只有月亮记得，你曾经来过这里。' },
  { name: '磷光庭园', jp: '燐光の庭', color: '#67d8c4', lore: '没有阳光的庭园里，花依旧向着某个方向盛开。' },
  { name: '绯色礼拜堂', jp: '緋の礼拝堂', color: '#e893a8', lore: '祈祷早已停息，钟声却还在回响。' },
  { name: '坠星书库', jp: '墜星の書庫', color: '#c3a6f1', lore: '书页间夹着某个人未曾抵达的明天。' },
  { name: '无月王座', jp: '月なき玉座', color: '#edc686', lore: '故事的最后一页，只为还在前进的人留白。' },
];
// Two starting skills; advanced arts are discovered inside this run, never inherited.
export const JOBS = {
  knight: {id:'knight',name:'星刃骑士',jp:'星剣士',person:'希露菲',roman:'SYLPHIE',role:'承伤 · 破甲 · 反击',color:'#9caef9',weapon:'moonblade',hp:142,mp:30,atk:15,mag:5,def:12,spd:8,skills:['cleave','aegis'],advanced:['counterwall','intercept','starfall'],growth:'atk',passive:'不退之盾',passiveDesc:'物理承伤减少 18%。壁垒能吸引单体攻击；没有治疗能力。',synopsis:'保护脆弱的施法者，用破甲创造突破口。反击与拦截要靠本局探索习得。'},
  mage: {id:'mage',name:'焰咒魔导师',jp:'焔の魔導士',person:'莉瑟',roman:'LYS',role:'弱点 · 元素 · 蓄能',color:'#eda58c',weapon:'emberstaff',hp:76,mp:42,atk:6,mag:24,def:3,spd:11,skills:['fire','frost'],advanced:['nova','focuscast','thunderchain'],growth:'mag',passive:'元素学识',passiveDesc:'技能命中元素弱点时额外增伤 20%。普攻仅使用 55% 魔力；没有治疗或护盾。',synopsis:'MP 是输出窗口，不是无限燃料。蓄能爆发、连锁法术与群攻构筑各有用途。'},
  shrine: {id:'shrine',name:'祈星巫女',jp:'星詠みの巫女',person:'澪',roman:'MIO',role:'治疗 · 净化 · 复苏',color:'#9dd5c7',weapon:'bellwand',hp:90,mp:44,atk:6,mag:19,def:5,spd:12,skills:['mend','cleanse'],advanced:['ray','revive','sanctuary'],growth:'mag',passive:'救护祈愿',passiveDesc:'主动治疗量提高 15%。攻击不再附带免费治疗；攻击魔法需在局内学习。',synopsis:'负责维持队伍，而不是另一个输出职业。治疗与净化是不同的行动，必须判断优先级。'},
  ninja: {id:'ninja',name:'影缝忍者',jp:'影縫い',person:'紫苑',roman:'SHION',role:'封印 · 剧毒 · 追击',color:'#ccabea',weapon:'shadowfang',hp:84,mp:34,atk:18,mag:8,def:4,spd:19,skills:['venom','seal'],advanced:['disarm','execute','phantom'],growth:'atk',passive:'猎影',passiveDesc:'对负面状态目标增伤 20%。封头压制施法，封腕压制重击；没有自疗。',synopsis:'用封印破坏敌方配合，之后再追击破绽。控制有抗性窗口，不能无限封锁同一目标。'},
  chrono: {id:'chrono',name:'刻时术士',jp:'刻の術師',person:'伊欧',roman:'IO',role:'速度 · 驱散 · 延期',color:'#e8c783',weapon:'clockstaff',hp:86,mp:40,atk:6,mag:17,def:5,spd:15,skills:['pulse','haste'],advanced:['unweave','delay','echoTime'],growth:'mag',passive:'时间利息',passiveDesc:'每次行动开始回复 1 MP。没有治疗；高阶技能可驱散强化、延后预兆。',synopsis:'让关键队友先出手，把危险回合拆开。延后一次不等于取消，需要真正完成应对。'},
  reaver: {id:'reaver',name:'血誓剑士',jp:'血誓の剣士',person:'绯音',roman:'AKANE',role:'背水 · 换血 · 斩杀',color:'#e389a3',weapon:'bloodedge',hp:124,mp:26,atk:23,mag:4,def:4,spd:10,skills:['rend','bloodpact'],advanced:['reap','revenge','laststand'],growth:'atk',passive:'赤月誓约',passiveDesc:'生命低于 50% 时伤害提高 30%。只有指定技能与武器能吸血，不再被动全伤害吸血。',synopsis:'保留伤口以换取爆发，但不能用伤害解决一切。高压回合需要同伴保护或及时止损。'},
};
export const SKILLS = {
  attack:{id:'attack',name:'普通攻击',icon:'sword',cost:0,power:.85,target:'enemy',kind:'attack',desc:'低效能攻击，回复 1 MP。施法职业仅以 55% 魔力计算，不能代替法术。'},
  guard:{id:'guard',name:'防御',icon:'shield',cost:0,target:'self',kind:'guard',desc:'直到下次行动承伤减少 65%，回复 3 MP。能应对多数预兆，但无法解除敌方强化。'},
  tonic:{id:'tonic',name:'急救药',icon:'heart',cost:0,target:'ally',kind:'itemHeal',supply:'tonic',desc:'消耗队伍 1 份急救药，治疗存活队友 35% 生命。不会复活；占用行动。'},
  ether:{id:'ether',name:'以太滴',icon:'drop',cost:0,target:'ally',kind:'itemMp',supply:'ether',desc:'消耗队伍 1 份以太滴，回复一名存活队友 14 MP；占用行动。'},
  salt:{id:'salt',name:'破咒盐',icon:'star',cost:0,target:'enemy',kind:'dispel',supply:'salt',dispel:1,desc:'消耗队伍 1 份破咒盐，移除敌人 1 个可驱散强化；用于针对结界预兆。'},
  cleave:{id:'cleave',name:'碎星斩',icon:'sword',cost:5,power:1.1,target:'enemy',kind:'physical',status:'break',turns:3,desc:'110% 物理伤害并破甲 3 次行动；物理承伤 +30%，穿透月铠。'},
  aegis:{id:'aegis',name:'星纹壁垒',icon:'shield',cost:7,target:'self',kind:'aegis',desc:'本回合全队减伤 40%，自身吸引单体攻击 2 次行动。不恢复生命。'},
  counterwall:{id:'counterwall',name:'镜盾反阵',icon:'shield',cost:9,target:'self',kind:'counter',minFloor:1,desc:'自身减伤 50%，本回合每次被直接命中反击 110% 攻击。反击计入破势次数。'},
  intercept:{id:'intercept',name:'绝对拦截',icon:'shield',cost:11,target:'allies',kind:'intercept',minFloor:2,desc:'本回合全队减伤 60% 并免疫新异常；不提供治疗，保护在回合结算后消失。'},
  starfall:{id:'starfall',name:'星陨剑阵',icon:'star',cost:13,power:1.3,target:'enemies',kind:'physical',status:'break',turns:2,minFloor:3,desc:'全体 130% 物理伤害并破甲，结束后自身获得一次反击。'},
  fire:{id:'fire',name:'绯焰',icon:'flame',cost:6,power:1.65,target:'enemy',kind:'magic',element:'fire',status:'burn',turns:3,desc:'165% 火伤并燃烧 3 次行动。持续伤害基于施法者能力，不能按 Boss 总生命偷取巨额伤害。'},
  frost:{id:'frost',name:'霜华',icon:'ice',cost:6,power:1.45,target:'enemy',kind:'magic',element:'ice',status:'slow',turns:2,desc:'145% 冰伤并迟缓；命中燃烧目标触发融解 +50%，并消耗燃烧。'},
  nova:{id:'nova',name:'红莲终曲',icon:'flame',cost:14,power:1.3,target:'enemies',kind:'magic',element:'fire',status:'burn',turns:2,minFloor:1,desc:'对全体敌人造成 130% 火伤并燃烧。用于拆解护卫和支援者的小队。'},
  focuscast:{id:'focuscast',name:'双重咏唱',icon:'star',cost:4,target:'self',kind:'focus',minFloor:2,desc:'下一个攻击法术变为两次独立命中，各造成 90% 伤害。每次命中分别计入破势。'},
  thunderchain:{id:'thunderchain',name:'雷锁连环',icon:'star',cost:12,power:.8,hits:3,target:'enemy',kind:'magic',element:'light',minFloor:3,desc:'连续 3 次 80% 光伤。多段命中用于打破需要连击的预兆。'},
  mend:{id:'mend',name:'缝光祈愿',icon:'heart',cost:6,power:1,target:'ally',kind:'heal',desc:'治疗一名队友：魔力 × 1.65 + 12。不附赠净化或输出。'},
  cleanse:{id:'cleanse',name:'净铃',icon:'drop',cost:5,target:'allies',kind:'cleanse',desc:'解除全队异常；不回复生命。何时净化、何时治疗需要分开判断。'},
  ray:{id:'ray',name:'月光裁决',icon:'star',cost:7,power:1.35,target:'enemy',kind:'magic',element:'light',dispel:1,status:'marked',turns:2,minFloor:1,desc:'135% 光伤，移除 1 个强化并施加星标。习得后才获得专用攻击法术。'},
  revive:{id:'revive',name:'晨星归还',icon:'heart',cost:14,target:'ally',kind:'revive',minFloor:1,desc:'复活倒下的队友至 35% 生命；目标存活时治疗 35%。'},
  sanctuary:{id:'sanctuary',name:'无垢圣域',icon:'flower',cost:14,target:'allies',kind:'sanctuary',minFloor:3,desc:'治疗全队并解除异常，本回合免疫新异常。与净铃、单体治疗承担不同职责。'},
  venom:{id:'venom',name:'紫雾双刃',icon:'venom',cost:5,power:.85,target:'enemy',kind:'physical',status:'poison',turns:3,desc:'85% 物理伤害并中毒 3 次行动。毒伤基于施术者攻击，毒与破甲为后续追击铺路。'},
  seal:{id:'seal',name:'封头·缄默',icon:'venom',cost:6,target:'enemy',kind:'seal',status:'headbind',turns:2,desc:'封头 2 次行动：施法、治疗和强化改为低效普攻。解除后 2 回合内不能再封同部位。'},
  disarm:{id:'disarm',name:'封腕·断弦',icon:'sword',cost:7,power:.75,target:'enemy',kind:'physical',status:'armbind',turns:2,minFloor:1,desc:'75% 伤害并封腕，压制重击、猎杀和群体物理技。预兆仍需按提示应对。'},
  execute:{id:'execute',name:'影缝·三闪',icon:'sword',cost:11,power:.65,hits:3,target:'enemy',kind:'physical',exploit:true,minFloor:2,desc:'3 次 65% 物理伤害，每种负面状态增伤 15%（最高 60%）。多段攻击可破势。'},
  phantom:{id:'phantom',name:'残影诱饵',icon:'moon',cost:8,target:'self',kind:'phantom',minFloor:3,desc:'本回合吸引单体攻击，并完全闪避接下来的两次直接命中。不治疗，不回避持续伤害。'},
  pulse:{id:'pulse',name:'时空脉冲',icon:'clock',cost:5,power:.9,target:'enemy',kind:'magic',status:'slow',turns:3,desc:'90% 魔法伤害并迟缓 3 次行动，改变下一轮行动顺序。'},
  haste:{id:'haste',name:'加速咏唱',icon:'clock',cost:6,target:'ally',kind:'haste',desc:'一名队友获得 3 次行动迅捷：速度 +50%，伤害 +10%。顺序在下一回合重排。'},
  unweave:{id:'unweave',name:'术式解体',icon:'clock',cost:7,target:'enemy',kind:'dispel',dispel:2,minFloor:1,desc:'移除目标最多 2 个可驱散强化。解除结界能取消相应预兆，不依赖补给。'},
  delay:{id:'delay',name:'延宕一刻',icon:'clock',cost:10,target:'enemy',kind:'delay',minFloor:2,desc:'延后目标当前预兆 1 回合（每个预兆仅一次）；普通敌人跳过下一次行动，之后 2 回合免疫。'},
  echoTime:{id:'echoTime',name:'昨日回声',icon:'link',cost:10,target:'ally',kind:'echoTime',minFloor:3,desc:'队友下一次攻击技能追加一次 60% 强度的施放，随后消耗。额外命中可破势。'},
  rend:{id:'rend',name:'绯红裂刃',icon:'sword',cost:6,power:1.55,target:'enemy',kind:'physical',drain:.2,desc:'155% 物理伤害并吸取伤害的 20%。不会替其他队员治疗。'},
  bloodpact:{id:'bloodpact',name:'血之契约',icon:'heart',cost:0,target:'self',kind:'bloodpact',desc:'消耗生命上限 18%（至少留 1），回复 8 MP，获得 3 次行动狂热。'},
  reap:{id:'reap',name:'赤月收割',icon:'moon',cost:13,power:1.2,target:'enemies',kind:'physical',drain:.12,minFloor:1,desc:'全体 120% 物理伤害，吸取 12% 伤害。对落单目标不如单体技能。'},
  revenge:{id:'revenge',name:'伤痕偿还',icon:'sword',cost:10,power:1.35,target:'enemy',kind:'physical',revenge:true,minFloor:2,desc:'基础 135% 伤害；随自身已损生命提高，最高额外 140%，并忽略一半防御。'},
  laststand:{id:'laststand',name:'不归之誓',icon:'moon',cost:8,target:'self',kind:'laststand',minFloor:3,desc:'本回合一次致死直接伤害改为剩余 1 HP；每场战斗限用一次。持续伤害仍会致死。'},
};
// Evolution is a mechanical change, not a third numerical rank. Each starting art has one.
export const EVOLUTIONS = {
  cleave:{id:'cleave',name:'破阵斩',desc:'碎星斩命中前额外移除 1 个强化，能立即打破结界。',patch:{name:'破阵斩',dispel:1}},
  aegis:{id:'aegis',name:'镜星壁垒',desc:'壁垒额外赋予骑士一次反击；承伤后反击也计入 Boss 破势。',patch:{name:'镜星壁垒',retaliate:true}},
  fire:{id:'fire',name:'传火',desc:'绯焰的燃烧同时扩散给其余敌人，形成持续的群体施压。',patch:{name:'传火',spread:true}},
  frost:{id:'frost',name:'寂冻',desc:'霜华触发融解时同时封头 1 次行动，打断敌方施法节奏。',patch:{name:'寂冻',freezeSeal:true}},
  mend:{id:'mend',name:'缝光·余辉',desc:'溢出治疗转为护盾，最高相当于目标生命上限 25%。',patch:{name:'缝光·余辉',overflow:true}},
  cleanse:{id:'cleanse',name:'净铃·无垢',desc:'净化后本回合全队免疫新的异常，不再被后手重新上毒。',patch:{name:'净铃·无垢',immunity:true}},
  venom:{id:'venom',name:'毒蔓连锁',desc:'攻击已经中毒的目标时，将其毒素传播给全部敌人。',patch:{name:'毒蔓连锁',spreadPoison:true}},
  seal:{id:'seal',name:'缄默领域',desc:'封头改为覆盖全体敌人；各目标的封印抗性仍各自生效。',patch:{name:'缄默领域',target:'enemies'}},
  pulse:{id:'pulse',name:'时锈脉冲',desc:'时空脉冲额外施加衰弱，目标直接伤害降低 25%。',patch:{name:'时锈脉冲',weaken:true}},
  haste:{id:'haste',name:'星轨共振',desc:'加速咏唱从单体变为全队，使行动顺序构筑成为可能。',patch:{name:'星轨共振',target:'allies'}},
  rend:{id:'rend',name:'双刃血吻',desc:'裂刃变为两次各 85% 的命中，分别吸血，并可用于破势。',patch:{name:'双刃血吻',hits:2,power:.85}},
  bloodpact:{id:'bloodpact',name:'孤注契约',desc:'契约额外储存一次斩决：下一次物理技能无视防御，之后消耗。',patch:{name:'孤注契约',pierce:true}},
};
export const STATUS = {
  burn:{name:'燃烧',color:'#ffb58b',negative:true},poison:{name:'中毒',color:'#b8da83',negative:true},
  break:{name:'破甲',color:'#e5a9b9',negative:true},slow:{name:'迟缓',color:'#a8c9ef',negative:true},
  marked:{name:'星标',color:'#efdb94',negative:true},headbind:{name:'封头',color:'#cb97ed',negative:true},
  armbind:{name:'封腕',color:'#e3b391',negative:true},weak:{name:'衰弱',color:'#acb7db',negative:true},
  haste:{name:'迅捷',color:'#85dfd1',dispellable:true},protect:{name:'守护',color:'#a9b9ff',dispellable:true},
  fury:{name:'狂热',color:'#efa6ad',dispellable:true},taunt:{name:'挑衅',color:'#a9b9ff'},
  counter:{name:'反击',color:'#edc58c'},immune:{name:'无垢',color:'#a6dec8'},focus:{name:'双咏',color:'#eda58c'},
  echo:{name:'回声',color:'#dac785'},pierce:{name:'斩决',color:'#ee9fbb'},dodge:{name:'残影',color:'#b797df'},
  laststand:{name:'不归',color:'#efa6ad'},moonarmor:{name:'月铠',color:'#c4cee7',dispellable:true},
  veil:{name:'仪式结界',color:'#dca5e9',dispellable:true},thorns:{name:'荆棘反甲',color:'#adc690',dispellable:true},
  mirror:{name:'魔镜',color:'#80d7db',dispellable:true},rage:{name:'暴走',color:'#ff9d85'},
};
export const WEAPONS = {
  moonblade:{name:'未明之剑',type:'剑',atk:4,mag:1,effect:'guardbreak',effectName:'星痕',desc:'所有攻击有 30% 概率附加 2 回合破甲。',rarity:'common'},
  emberstaff:{name:'余烬枝',type:'法杖',atk:0,mag:5,effect:'kindle',effectName:'余火',desc:'攻击有 25% 概率附加 2 回合燃烧。',rarity:'common'},
  bellwand:{name:'初祈铃',type:'铃杖',atk:1,mag:4,effect:'lifewell',effectName:'祈愿',desc:'战斗中每次行动后，恢复自身 2% 生命。',rarity:'common'},
  shadowfang:{name:'薄暮牙',type:'双刃',atk:5,mag:0,effect:'toxin',effectName:'蛇吻',desc:'攻击有 25% 概率附加 2 回合中毒。',rarity:'common'},
  clockstaff:{name:'停摆的秒针',type:'时杖',atk:1,mag:4,effect:'mana',effectName:'滴答',desc:'每次行动后，额外回复 1 MP。',rarity:'common'},
  bloodedge:{name:'朱誓',type:'大剑',atk:6,mag:0,effect:'vampire',effectName:'血契',desc:'造成的伤害附带 8% 吸血。',rarity:'common'},
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
  {id:'vitality',name:'生命之露',icon:'heart',desc:'全队生命上限 +10，并恢复 10 生命。上限 3 层。',type:'stat',stat:'maxHp',value:10,cap:3},
  {id:'power',name:'刃之记忆',icon:'sword',desc:'全队攻击力 +2。上限 3 层。',type:'stat',stat:'atk',value:2,cap:3},
  {id:'wisdom',name:'星语残篇',icon:'star',desc:'全队魔力 +2。上限 3 层。',type:'stat',stat:'mag',value:2,cap:3},
  {id:'armor',name:'银月鳞片',icon:'shield',desc:'全队防御 +1。上限 3 层。',type:'stat',stat:'def',value:1,cap:3},
  {id:'spirit',name:'澄澈魔泉',icon:'drop',desc:'全队 MP 上限 +5，并恢复 5 MP。上限 3 层。',type:'stat',stat:'maxMp',value:5,cap:3},
  {id:'swift',name:'流风羽',icon:'wind',desc:'全队速度 +1。上限 3 层。',type:'stat',stat:'spd',value:1,cap:3},
  {id:'embers',name:'不灭余烬',icon:'flame',desc:'燃烧和毒伤 +20%。上限 3 层。',type:'boon',cap:3},
  {id:'siphon',name:'赤色露珠',icon:'heart',desc:'所有直接伤害额外吸血 3%。上限 3 层。',type:'boon',cap:3},
  {id:'victory',name:'凯旋花束',icon:'flower',desc:'胜利额外恢复全队 4% 生命。上限 3 层。',type:'boon',cap:3},
  {id:'focus',name:'静谧冥想',icon:'moon',desc:'每次行动開始額外回复 1 MP。上限 2 层。',type:'boon',cap:2},
  {id:'critical',name:'猎星之眼',icon:'eye',desc:'暴击率 +5%。上限 3 层。',type:'boon',cap:3},
  {id:'harmony',name:'共鸣之环',icon:'link',desc:'技能联携增伤额外 +10%。普攻不会累积联携。上限 3 层。',type:'boon',cap:3},
];
export const ENEMY_TYPES = {
  wisp:{name:'烙印灯灵',kind:'wisp',hp:69,atk:15,mag:23,def:3,spd:11,weak:'ice',tint:'#93a6ff',role:'施法 / 标记',hint:'先标记脆弱队员，猎手会追击标记。封头可压制。',intent:['mark','hex','hex']},
  slime:{name:'腐蚀墨滴',kind:'slime',hp:90,atk:20,mag:11,def:7,spd:6,weak:'fire',tint:'#ac98de',role:'减益 / 腐甲',hint:'腐甲后重击更危险。用火攻击或净化破甲。',intent:['corrode','poison','attack']},
  moth:{name:'逐痕夜蝶',kind:'moth',hp:62,atk:25,mag:11,def:3,spd:17,weak:'fire',tint:'#d5aae8',role:'猎杀 / 高速',hint:'优先攻击星标或中毒目标，猎杀额外增伤。可封腕。',intent:['hunt','attack','hunt']},
  sentinel:{name:'失心卫士',kind:'sentinel',hp:110,atk:24,mag:5,def:12,spd:8,weak:'light',tint:'#9fb7d3',role:'护卫 / 重击',hint:'给全队守护、为低血量友军分担单体攻击。驱散或先破甲。',intent:['cover','heavy','attack']},
  revenant:{name:'无声的祈祷者',kind:'ghost',hp:72,atk:10,mag:23,def:3,spd:13,weak:'light',tint:'#c5b1e1',role:'治疗 / 强化',hint:'治疗最低血量同伴，并强化全队。封头或优先击杀。',intent:['bless','enemyHeal','hex']},
  briar:{name:'荆棘甲兽',kind:'sentinel',hp:98,atk:25,mag:8,def:10,spd:9,weak:'fire',tint:'#a8c386',role:'反甲 / 物理抗性',hint:'荆棘反甲会反伤物理攻击。法术或驱散破解。',intent:['thorns','heavy','corrode']},
  prism:{name:'折光晶核',kind:'wisp',hp:78,atk:14,mag:29,def:5,spd:10,weak:'ice',tint:'#7ce0d7',role:'魔法屏障 / 咒术',hint:'魔镜削减 80% 魔法伤害。用物理或驱散处理。',intent:['mirror','hex','sweepMagic']},
  caller:{name:'孵月祭司',kind:'ghost',hp:88,atk:12,mag:24,def:4,spd:12,weak:'light',tint:'#daa48d',role:'召唤 / 治疗',hint:'召唤一只夜蝶（每场限一次），随后治疗。封头会推迟其召唤。',intent:['summon','enemyHeal','hex']},
  guardian:{name:'月门守卫',kind:'sentinel',hp:340,atk:31,mag:27,def:10,spd:9,weak:'ice',tint:'#d1ba8e',role:'首领',hint:'预兆在回合末结算。血线阶段有一次相位锁，不能跳过。',intent:['heavy','attack','sweep']},
  sovereign:{name:'蚀月的圣女',kind:'sovereign',hp:390,atk:32,mag:32,def:11,spd:13,weak:'light',tint:'#d8b4f7',role:'最终首领',hint:'驱散结界、清除仪式侍从、连击破势；预兆必须在期限内应对。',intent:['hex','heavy','sweepMagic']},
};
export const ENCOUNTERS = [
  [['slime','wisp'],['wisp','moth'],['sentinel','revenant'],['slime','moth']],
  [['briar','moth'],['caller','slime'],['wisp','moth','moth'],['sentinel','revenant']],
  [['sentinel','revenant','wisp'],['prism','moth'],['caller','briar'],['revenant','moth','slime']],
  [['prism','revenant','moth'],['briar','sentinel','wisp'],['caller','prism'],['wisp','moth','moth']],
  [['caller','sentinel','revenant'],['prism','briar','moth'],['sentinel','wisp','moth'],['revenant','prism','slime']],
];
export const BOSS_SPECS = [
  {name:'星锁统御者',kind:'sentinel',tint:'#d1ba8e',trait:'月铠：物理减伤 65%；破甲或驱散解除。',buff:'moonarmor',period:4,turnName:'坠月震荡',turnCounter:'guard',hp:[{at:.7,name:'星锁封界',counter:'dispel'},{at:.35,name:'审判大剑',counter:'hits'}]},
  {name:'磷庭孵月者',kind:'moth',tint:'#91d8ab',trait:'荆棘反甲：反击物理伤害；可驱散。',buff:'thorns',period:4,turnName:'瘴雨降临',turnCounter:'guard',hp:[{at:.7,name:'孵月仪式',counter:'adds'},{at:.35,name:'荆棘暴食',counter:'dispel'}]},
  {name:'绯钟执祷者',kind:'ghost',tint:'#f0a0b1',trait:'魔镜：法术减伤 80%；可驱散。',buff:'mirror',period:4,turnName:'恸哭钟声',turnCounter:'seal',hp:[{at:.7,name:'不净祝圣',counter:'dispel'},{at:.35,name:'双钟共鸣',counter:'adds'}]},
  {name:'逆行刻盘',kind:'sentinel',tint:'#acb5f3',trait:'迅捷：高速行动；可驱散。',buff:'haste',period:3,turnName:'时针断层',turnCounter:'hits',hp:[{at:.7,name:'停滞结界',counter:'dispel'},{at:.35,name:'终刻坠落',counter:'hits'}]},
  {name:'蚀月的圣女',kind:'sovereign',tint:'#d8b4f7',trait:'月铠：物理减伤 65%；破甲或驱散解除。',buff:'moonarmor',period:4,turnName:'无月审判',turnCounter:'guard',hp:[{at:.75,name:'零月结界',counter:'dispel'},{at:.5,name:'仪式双星',counter:'adds'},{at:.25,name:'黎明禁令',counter:'hits'}]},
];
export const INTENTS = {
 attack:{name:'攻击',icon:'sword'},heavy:{name:'重击',icon:'sword'},hex:{name:'咒火',icon:'flame'},poison:{name:'毒雾',icon:'venom'},guard:{name:'防御',icon:'shield'},charge:{name:'蓄力',icon:'star'},sweep:{name:'横扫',icon:'wind'},drain:{name:'汲取',icon:'heart'},
 mark:{name:'弱者烙印',icon:'eye'},corrode:{name:'腐甲',icon:'venom'},hunt:{name:'猎杀标记者',icon:'sword'},cover:{name:'全队守护',icon:'shield'},bless:{name:'全队狂热',icon:'star'},enemyHeal:{name:'救援同伴',icon:'heart'},thorns:{name:'荆棘反甲',icon:'shield'},mirror:{name:'折光魔镜',icon:'star'},sweepMagic:{name:'咒术群攻',icon:'flame'},summon:{name:'召唤夜蝶',icon:'moon'},bound:{name:'封印压制 · 弱攻',icon:'venom'},delay:{name:'行动被延后',icon:'clock'},
};
export const RARITIES = {common:{name:'初始',color:'#adb5d0'},rare:{name:'稀有',color:'#b69af6'},legendary:{name:'传说',color:'#e5c083'}};
