/** A quiet generative score and SFX, synthesized locally after an explicit user gesture. */
export class AudioSystem {
  constructor(){this.ctx=null;this.enabled=false;this.timer=null;this.step=0;}
  async toggle(){
    if(this.enabled){this.enabled=false;clearInterval(this.timer);if(this.ctx)await this.ctx.suspend();return false;}
    const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)return false;
    if(!this.ctx)this.ctx=new AudioContext();await this.ctx.resume();this.enabled=true;this.tick();this.timer=setInterval(()=>this.tick(),1400);return true;
  }
  note(frequency,duration=.25,volume=.035,type='sine',delay=0){
    if(!this.ctx||!this.enabled)return;
    const start=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(frequency,start);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume,start+.025);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g);g.connect(this.ctx.destination);o.start(start);o.stop(start+duration+.05);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  tick(){
    if(document.hidden)return;
    const progression=[[146.83,220,293.66],[130.81,196,261.63],[110,164.81,220],[130.81,196,293.66]];
    const chord=progression[Math.floor(this.step/4)%4];for(const f of chord)this.note(f,2.8,.009);
    const melody=[587.33,440,659.25,523.25,587.33,392,440,293.66];this.note(melody[this.step%melody.length],1.8,.02);this.step++;
  }
  sfx(name){
    if(name==='move')this.note(100,.08,.013,'triangle');
    else if(name==='select')this.note(660,.11,.03);
    else if(name==='attack'){this.note(160,.16,.025,'sawtooth');this.note(90,.1,.025,'triangle',.03);}
    else if(name==='magic'){this.note(523.25,.3,.025);this.note(783.99,.45,.025,'sine',.08);this.note(1046.5,.5,.02,'sine',.16);}
    else if(name==='heal'){[392,493.88,587.33].forEach((f,i)=>this.note(f,.6,.022,'sine',i*.1));}
    else if(name==='victory'){[293.66,369.99,440,587.33].forEach((f,i)=>this.note(f,.8,.03,'triangle',i*.12));}
    else if(name==='battle'){this.note(146.83,.6,.03,'triangle');this.note(155.56,.5,.017,'triangle',.1);}
  }
}
