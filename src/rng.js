/** Serializable PRNG shared by world generation and combat; rendering never draws randomness. */
export function hash(text) {
  let h=2166136261;
  for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
}
export function next(state) {
  state.rng=(state.rng+0x6D2B79F5)>>>0;
  let t=state.rng;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
  return ((t^(t>>>14))>>>0)/4294967296;
}
export function int(state,min,max){return Math.floor(next(state)*(max-min+1))+min;}
export function pick(state,items){return items[int(state,0,items.length-1)];}
export function shuffle(state,items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=int(state,0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
