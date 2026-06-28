// NG Whot — Sound Engine (Web Audio API + Speech Synthesis)
const SoundEngine = {
  enabled: true,
  voiceEnabled: true,
  _ctx: null,

  get ctx() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return this._ctx;
  },

  _tone(freq, vol, type, dur, delayMs = 0) {
    if (!this.enabled || !this.ctx) return;
    setTimeout(() => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.start(); o.stop(this.ctx.currentTime + dur);
    }, delayMs);
  },

  play(type) {
    if (!this.enabled) return;
    switch(type) {
      case 'deal':   this._tone(800, 0.08, 'sine', 0.06); break;
      case 'card':   this._tone(350, 0.2, 'triangle', 0.12); this._tone(500, 0.1, 'triangle', 0.08, 80); break;
      case 'draw':   this._tone(280, 0.1, 'sine', 0.1); break;
      case 'pick2':  this._tone(550, 0.25, 'square', 0.15); this._tone(700, 0.2, 'square', 0.15, 180); break;
      case 'pick3':  this._tone(450, 0.25, 'square', 0.15); this._tone(600, 0.2, 'square', 0.15, 180); this._tone(750, 0.15, 'square', 0.15, 360); break;
      case 'market': [400,300,400,500].forEach((f,i) => this._tone(f, 0.2, 'square', 0.12, i*120)); break;
      case 'holdon': this._tone(700, 0.2, 'sawtooth', 0.2); this._tone(600, 0.15, 'sawtooth', 0.2, 220); break;
      case 'whot':   [600,800,1000].forEach((f,i) => this._tone(f, 0.2, 'sine', 0.18, i*150)); break;
      case 'win':    [523,659,784,1047].forEach((f,i) => this._tone(f, 0.3, 'sine', 0.35, i*160)); break;
      case 'lose':   [400,340,280,220].forEach((f,i) => this._tone(f, 0.2, 'sine', 0.4, i*200)); break;
      case 'out':    this._tone(220, 0.3, 'sawtooth', 0.5); break;
      case 'warning':  this._tone(900, 0.18, 'triangle', 0.12); this._tone(900, 0.18, 'triangle', 0.12, 160); break;
      case 'lastcard': [1000,800,1000].forEach((f,i) => this._tone(f, 0.22, 'square', 0.14, i*130)); break;
      case 'checkup':  [600,500,600,500].forEach((f,i) => this._tone(f, 0.18, 'sine', 0.15, i*140)); break;
    }
  },

  speak(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 1.1; u.volume = 0.9;
    window.speechSynthesis.speak(u);
  },

  announce(type, count = null) {
    const lines = {
      pick2:  count && count > 2 ? `Pick ${count}!` : 'Pick Two!',
      pick3:  count && count > 3 ? `Pick ${count}!` : 'Pick Three!',
      market: 'General Market!',
      holdon: 'Hold On!',
      whot:   'Whot!',
      win:    'We have a winner!',
      out:    'Player Out!',
      warning:  'Two cards left!',
      lastcard: 'Last card!',
      checkup:  'Check up!'
    };
    this.play(type);
    if (lines[type]) setTimeout(() => this.speak(lines[type]), 100);
  }
};

window.SoundEngine = SoundEngine;
