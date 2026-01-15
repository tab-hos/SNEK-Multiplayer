// Sound effects using Web Audio API
class SoundManager {
    constructor() {
      this.audioContext = null;
      this.enabled = true;
    }
  
    init() {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      return this;
    }
  
    playTone(frequency, duration, type = 'sine', volume = 0.3) {
      if (!this.enabled || !this.audioContext) return;
      
      try {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
      } catch (e) {
        console.log('Sound error:', e);
      }
    }
  
    playStart() {
      this.playTone(523.25, 0.1, 'square', 0.2); // C5
      setTimeout(() => this.playTone(659.25, 0.1, 'square', 0.2), 100); // E5
      setTimeout(() => this.playTone(783.99, 0.2, 'square', 0.2), 200); // G5
    }
  
playEat() {
  // initial bite "click"
  this.playTone(900, 0.03, 'square', 0.25);

  // chew / crunch drop
  setTimeout(() => {
    this.playTone(420, 0.07, 'triangle', 0.22);
  }, 30);
}
  
    playDeath() {
      this.playTone(200, 0.3, 'sawtooth', 0.3);
      setTimeout(() => this.playTone(150, 0.3, 'sawtooth', 0.25), 150);
      setTimeout(() => this.playTone(100, 0.5, 'sawtooth', 0.2), 300);
    }
  
    playPause() {
      this.playTone(440, 0.15, 'triangle', 0.2);
    }
  
    playResume() {
      this.playTone(440, 0.1, 'triangle', 0.2);
      setTimeout(() => this.playTone(554.37, 0.1, 'triangle', 0.2), 80);
    }
  
    playWin() {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((note, i) => {
        setTimeout(() => this.playTone(note, 0.15, 'square', 0.2), i * 100);
      });
    }

    playPowerUp() {
  // Mario-ish rising "power-up" blip (quick arpeggio)
  const base = 520 + Math.random() * 40; // tiny variation so it’s not identical
  const notes = [1, 1.25, 1.5, 2]; // jump up in pitch

  notes.forEach((mult, i) => {
    setTimeout(() => {
      this.playTone(base * mult, 0.08, 'square', 0.22);
    }, i * 70);
  });
}
  
    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }
  }
  
  export const soundManager = new SoundManager();

