import { EN_MESSAGES } from './i18n-en.js';

/** Presentation-only localization. Game IDs, RNG, state, saves, and canonical log messages
 * never depend on locale. Exact messages and parameterized legacy messages are translated
 * before display; HTML/attributes are never passed through a text replacement operation. */
export const LANGUAGE_KEY = 'eclipse-labyrinth.language';
export const LANGUAGES = Object.freeze(['auto', 'zh', 'en']);
let language = 'zh';
let preference = 'auto';
let environment = null;
const cache = new Map();
const cjk = /[\u3400-\u9fff\u3040-\u30ff]/;
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const placeholder = /\{(\d+)\}/g;
const patterns = Object.entries(EN_MESSAGES).filter(([key]) => /\{\d+\}/.test(key)).map(([key, value]) => {
  const slots = [], literals = key.split(/\{\d+\}/);
  for (const match of key.matchAll(placeholder)) slots.push(match[1]);
  return { key, value, slots, weight:literals.join('').length,
    regex:new RegExp('^' + literals.map(escapeRegex).join(key === '冷却 {0}' ? '(\\d+)' : '([\\s\\S]*?)') + '$') };
}).sort((a,b) => b.weight - a.weight);
const literals = Object.keys(EN_MESSAGES).filter(key => !/\{\d+\}/.test(key)).sort((a,b)=>b.length-a.length);
const fragmentRegex = new RegExp(literals.map(escapeRegex).join('|'), 'g');

/** First supported browser language wins. All zh variants use simplified Chinese;
 * all en variants use English. Unsupported lists fall back to English. */
export function detectLanguage(nav = {}) {
  const list = Array.isArray(nav.languages) && nav.languages.length ? nav.languages : [nav.language];
  for (const tag of list) {
    if (typeof tag !== 'string') continue;
    const primary = tag.toLowerCase().replaceAll('_','-').split('-')[0];
    if (primary === 'zh' || primary === 'en') return primary;
  }
  return 'en';
}
export function getLanguage() { return language; }
export function getLanguagePreference() { return preference; }
export function initLanguage(env = {}) {
  environment = env;
  let stored;
  try { stored = env.storage?.getItem(LANGUAGE_KEY); } catch { /* Storage may be unavailable offline. */ }
  preference = LANGUAGES.includes(stored) ? stored : 'auto';
  language = preference === 'auto' ? detectLanguage(env.navigator) : preference;
  cache.clear();
  return language;
}
export function setLanguage(value) {
  if (!LANGUAGES.includes(value)) return false;
  preference = value;
  language = value === 'auto' ? detectLanguage(environment?.navigator) : value;
  try { environment?.storage?.setItem(LANGUAGE_KEY, value); } catch { /* Keep in-session choice. */ }
  cache.clear();
  return true;
}
export function refreshBrowserLanguage() {
  if (preference !== 'auto') return false;
  const next = detectLanguage(environment?.navigator);
  if (next === language) return false;
  language = next; cache.clear(); return true;
}
function english(text, depth = 0) {
  if (!cjk.test(text)) return text;
  if (Object.hasOwn(EN_MESSAGES, text)) return EN_MESSAGES[text];
  const core = text.trim();
  if (core !== text) return text.slice(0,text.indexOf(core)) + english(core,depth) + text.slice(text.indexOf(core)+core.length);
  if (depth < 5 && text.length < 2400) {
    for (const p of patterns) {
      const match = p.regex.exec(text);
      if (!match) continue;
      const args = Object.fromEntries(p.slots.map((slot,i)=>[slot,english(match[i+1],depth+1)]));
      const result = p.value.replace(placeholder, (_,slot)=>args[slot]??'');
      // Ambiguous legacy fragments must not swallow a more specific complete message.
      if (!cjk.test(result)) return result;
    }
  }
  // A reward/help node may concatenate several independently parameterized sentences.
  // Preserve sentence terminators so each catalog template can still match exactly.
  if (depth < 5) {
    const sentences = text.match(/[^。；]*[。；]|[^。；]+$/g) || [];
    if (sentences.length > 1) {
      const result = sentences.map(part=>english(part,depth+1)).join(' ');
      if (!cjk.test(result)) return result;
    }
  }
  // Legacy UI composes complete sentences/names with numeric suffixes. Use the
  // longest known fragment in one pass: never reprocess translated output as HTML.
  return text.replace(fragmentRegex, match => EN_MESSAGES[match])
    .replace(/。/g,'. ').replace(/，/g,', ').replace(/：/g,': ')
    .replace(/；/g,'; ').replace(/、/g,', ').replace(/[「『]/g,'“').replace(/[」』]/g,'”')
    .replace(/（/g,' (').replace(/）/g,')');
}
export function translate(text, locale = language) {
  text = String(text ?? '');
  if (locale !== 'en' || !cjk.test(text)) return text;
  if (cache.has(text)) return cache.get(text);
  const result = english(text);
  if (cache.size >= 4096) cache.clear();
  cache.set(text,result);
  return result;
}
export function localizeDom(root) {
  if (language !== 'en' || !root) return;
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4); // SHOW_TEXT
  for (let node=walker.nextNode(); node; node=walker.nextNode()) {
    if (node.parentElement?.closest('script,style,noscript,input,textarea,[data-i18n-skip]')) continue;
    const result = translate(node.nodeValue);
    if (result !== node.nodeValue) node.nodeValue = result;
  }
  for (const el of [root,...root.querySelectorAll('[title],[aria-label],[alt],[placeholder]')]) {
    if (el.closest?.('[data-i18n-skip]')) continue;
    for (const attr of ['title','aria-label','alt','placeholder']) {
      if (el.hasAttribute(attr)) {
        const before=el.getAttribute(attr), after=translate(before);
        if (before!==after) el.setAttribute(attr,after);
      }
    }
  }
}
export function syncDocumentLanguage(doc) {
  doc.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  doc.title = language === 'en' ? 'Eclipse Labyrinth — Roguelike Dungeon RPG' : '月蝕の迷宮 · Eclipse Labyrinth';
  doc.querySelector('meta[name="description"]')?.setAttribute('content',language === 'en'
    ? 'A first-person roguelike dungeon RPG. Build a party, master cooldown combat, and explore five shifting floors.'
    : '月蝕の迷宮：第一人称探索 × 职业联动 × Roguelike 构筑。每一轮，重新书写你的命运。');
}

/** Short, readable action labels; complete names remain in descriptions and accessible labels. */
const SHORT_ACTIONS = Object.freeze({
  attack:'Attack',guard:'Guard',tonic:'Potion',ether:'Time Drop',salt:'Dispel',
  cleave:'Star Slash',aegis:'Aegis',counterwall:'Riposte',intercept:'Cover',starfall:'Starfall',
  fire:'Flame',frost:'Frost',nova:'Nova',focuscast:'Dualcast',thunderchain:'Thunder',
  mend:'Mend',cleanse:'Cleanse',ray:'Moon Ray',revive:'Revive',sanctuary:'Sanctum',
  venom:'Venom',seal:'Silence',disarm:'Disarm',execute:'Flurry',phantom:'Decoy',
  pulse:'Pulse',haste:'Haste',unweave:'Unweave',delay:'Delay',echoTime:'Echo',
  rend:'Rend',bloodpact:'Pact',reap:'Reap',revenge:'Revenge',laststand:'Last Stand'
});
export function actionLabel(id, name) { return language === 'en' ? SHORT_ACTIONS[id] || translate(name) : name; }
