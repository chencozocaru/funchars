// ─── Audio Engine (Web Audio API - no files needed) ─────
class GameAudio {
    constructor() {
        this.ctx = null;
        this.bgGain = null;
        this.bgPlaying = false;
        this.muted = false;
        this.initialized = false;
        this.currentWorld = null;
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1;
        this.masterGain.connect(this.ctx.destination);

        this.bgGain = this.ctx.createGain();
        this.bgGain.gain.value = 0.15;
        this.bgGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.4;
        this.sfxGain.connect(this.masterGain);

        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 1;
        }
        return !this.muted;
    }

    // ─── Background Music ───────────────────────────────
    startBgMusic(worldType) {
        if (!this.initialized) this.init();
        if (this.bgPlaying) return;
        this.bgPlaying = true;
        this.currentWorld = worldType || 'dino';
        this._bgOscillators = [];
        this._playMusicLoop();
    }

    _playMusicLoop() {
        if (!this.bgPlaying) return;
        const now = this.ctx.currentTime;

        let loopDuration;
        switch (this.currentWorld) {
            case 'dino':
                loopDuration = this._playDinoMusic(now);
                break;
            case 'dog':
                loopDuration = this._playDogMusic(now);
                break;
            case 'meerkat':
                loopDuration = this._playMeerkatMusic(now);
                break;
            case 'warthog':
                loopDuration = this._playWarthogMusic(now);
                break;
            case 'cheetah':
                loopDuration = this._playMeerkatMusic(now);
                break;
            case 'bird':
                loopDuration = this._playBirdMusic(now);
                break;
            default:
                loopDuration = this._playDinoMusic(now);
        }

        this._bgTimeout = setTimeout(() => {
            this._playMusicLoop();
        }, loopDuration * 1000 - 50);
    }

    // ─── DINO WORLD: Epic prehistoric adventure ─────────
    // Deep drums, mysterious tones, primitive feel
    _playDinoMusic(now) {
        const dur = 12;

        // Deep rhythmic drums (low frequency pulses)
        const drumBeats = [0, 0.5, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 3.25, 3.5,
            4.0, 4.5, 5.0, 5.25, 5.5, 6.0, 6.5, 7.0, 7.25, 7.5,
            8.0, 8.5, 9.0, 9.25, 9.5, 10.0, 10.5, 11.0, 11.25, 11.5];
        for (const beat of drumBeats) {
            this._playDrum(80, now + beat, 0.15);
        }
        // Accent beats
        for (const beat of [0, 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5]) {
            this._playDrum(60, now + beat, 0.25);
        }

        // Mysterious pentatonic melody (D minor pentatonic - primitive feel)
        const melody = [
            { freq: 293.66, start: 0, dur: 0.4 },     // D4
            { freq: 349.23, start: 0.5, dur: 0.4 },    // F4
            { freq: 392.00, start: 1.0, dur: 0.7 },    // G4
            { freq: 440.00, start: 1.75, dur: 0.2 },   // A4
            { freq: 392.00, start: 2.0, dur: 0.9 },    // G4
            { freq: 349.23, start: 3.0, dur: 0.4 },    // F4
            { freq: 293.66, start: 3.5, dur: 0.4 },    // D4
            { freq: 261.63, start: 4.0, dur: 0.7 },    // C4
            { freq: 293.66, start: 4.75, dur: 0.2 },   // D4
            { freq: 349.23, start: 5.0, dur: 0.9 },    // F4
            // Second phrase
            { freq: 440.00, start: 6.0, dur: 0.4 },    // A4
            { freq: 523.25, start: 6.5, dur: 0.4 },    // C5
            { freq: 440.00, start: 7.0, dur: 0.7 },    // A4
            { freq: 392.00, start: 7.75, dur: 0.2 },   // G4
            { freq: 349.23, start: 8.0, dur: 0.9 },    // F4
            { freq: 392.00, start: 9.0, dur: 0.4 },    // G4
            { freq: 349.23, start: 9.5, dur: 0.4 },    // F4
            { freq: 293.66, start: 10.0, dur: 0.7 },   // D4
            { freq: 261.63, start: 10.75, dur: 0.2 },  // C4
            { freq: 293.66, start: 11.0, dur: 0.9 },   // D4
        ];

        for (const note of melody) {
            this._playBgNote(note.freq, now + note.start, note.dur, 'triangle');
        }

        // Deep bass drone
        const bass = [
            { freq: 146.83, start: 0, dur: 3 },    // D3
            { freq: 130.81, start: 3, dur: 3 },    // C3
            { freq: 146.83, start: 6, dur: 3 },    // D3
            { freq: 130.81, start: 9, dur: 3 },    // C3
        ];
        for (const b of bass) {
            this._playBgPad(b.freq, now + b.start, b.dur);
        }

        return dur;
    }

    // ─── DOG WORLD: Cheerful neighborhood stroll ────────
    // Bouncy, bright, playful xylophone-like feel
    _playDogMusic(now) {
        const dur = 16;

        const melody = [
            // bar 1 - bouncy opening
            { freq: 523.25, start: 0.0, dur: 0.25 },   // C5
            { freq: 659.25, start: 0.25, dur: 0.25 },  // E5
            { freq: 783.99, start: 0.5, dur: 0.25 },   // G5
            { freq: 659.25, start: 0.75, dur: 0.25 },  // E5
            { freq: 783.99, start: 1.0, dur: 0.5 },    // G5
            { freq: 880.00, start: 1.5, dur: 0.5 },    // A5
            // bar 2
            { freq: 783.99, start: 2.0, dur: 0.25 },   // G5
            { freq: 659.25, start: 2.25, dur: 0.25 },  // E5
            { freq: 587.33, start: 2.5, dur: 0.25 },   // D5
            { freq: 523.25, start: 2.75, dur: 0.25 },  // C5
            { freq: 587.33, start: 3.0, dur: 0.5 },    // D5
            { freq: 659.25, start: 3.5, dur: 0.5 },    // E5
            // bar 3
            { freq: 523.25, start: 4.0, dur: 0.25 },   // C5
            { freq: 587.33, start: 4.25, dur: 0.25 },  // D5
            { freq: 659.25, start: 4.5, dur: 0.5 },    // E5
            { freq: 783.99, start: 5.0, dur: 0.25 },   // G5
            { freq: 880.00, start: 5.25, dur: 0.25 },  // A5
            { freq: 783.99, start: 5.5, dur: 0.5 },    // G5
            // bar 4
            { freq: 659.25, start: 6.0, dur: 0.5 },    // E5
            { freq: 523.25, start: 6.5, dur: 0.25 },   // C5
            { freq: 587.33, start: 6.75, dur: 0.25 },  // D5
            { freq: 523.25, start: 7.0, dur: 1.0 },    // C5
            // bar 5
            { freq: 783.99, start: 8.0, dur: 0.25 },   // G5
            { freq: 880.00, start: 8.25, dur: 0.25 },  // A5
            { freq: 783.99, start: 8.5, dur: 0.25 },   // G5
            { freq: 659.25, start: 8.75, dur: 0.25 },  // E5
            { freq: 783.99, start: 9.0, dur: 0.5 },    // G5
            { freq: 1046.50, start: 9.5, dur: 0.5 },   // C6
            // bar 6
            { freq: 880.00, start: 10.0, dur: 0.25 },  // A5
            { freq: 783.99, start: 10.25, dur: 0.25 }, // G5
            { freq: 659.25, start: 10.5, dur: 0.25 },  // E5
            { freq: 587.33, start: 10.75, dur: 0.25 }, // D5
            { freq: 523.25, start: 11.0, dur: 0.5 },   // C5
            { freq: 659.25, start: 11.5, dur: 0.5 },   // E5
            // bar 7
            { freq: 587.33, start: 12.0, dur: 0.25 },  // D5
            { freq: 659.25, start: 12.25, dur: 0.25 }, // E5
            { freq: 783.99, start: 12.5, dur: 0.25 },  // G5
            { freq: 880.00, start: 12.75, dur: 0.25 }, // A5
            { freq: 783.99, start: 13.0, dur: 0.5 },   // G5
            { freq: 659.25, start: 13.5, dur: 0.5 },   // E5
            // bar 8
            { freq: 587.33, start: 14.0, dur: 0.25 },  // D5
            { freq: 523.25, start: 14.25, dur: 0.25 }, // C5
            { freq: 587.33, start: 14.5, dur: 0.25 },  // D5
            { freq: 659.25, start: 14.75, dur: 0.25 }, // E5
            { freq: 523.25, start: 15.0, dur: 0.75 },  // C5
        ];

        for (const note of melody) {
            this._playBgNote(note.freq, now + note.start, note.dur, 'triangle');
        }

        const chords = [
            { freq: 261.63, start: 0, dur: 2 },    // C4
            { freq: 196.00, start: 2, dur: 2 },    // G3
            { freq: 220.00, start: 4, dur: 2 },    // A3
            { freq: 196.00, start: 6, dur: 2 },    // G3
            { freq: 261.63, start: 8, dur: 2 },    // C4
            { freq: 196.00, start: 10, dur: 2 },   // G3
            { freq: 174.61, start: 12, dur: 2 },   // F3
            { freq: 196.00, start: 14, dur: 2 },   // G3
        ];

        for (const chord of chords) {
            this._playBgPad(chord.freq, now + chord.start, chord.dur);
        }

        return dur;
    }

    // ─── MEERKAT WORLD: African savanna groove ──────────
    // Syncopated rhythm, call-and-response, warm pentatonic scale
    _playMeerkatMusic(now) {
        const dur = 12;

        // African-style percussion pattern (syncopated)
        // Main djembe-like beats
        const mainBeats = [0, 0.375, 0.75, 1.5, 1.875, 2.25, 3.0, 3.375, 3.75,
            4.5, 4.875, 5.25, 6.0, 6.375, 6.75, 7.5, 7.875, 8.25,
            9.0, 9.375, 9.75, 10.5, 10.875, 11.25];
        for (const beat of mainBeats) {
            this._playDrum(120, now + beat, 0.1);
        }
        // Low bass drum on 1 and 3
        for (const beat of [0, 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5]) {
            this._playDrum(65, now + beat, 0.2);
        }
        // Shaker/high percussion (off-beats)
        for (let i = 0; i < dur; i += 0.375) {
            if (Math.sin(i * 5) > 0) {
                this._playShaker(now + i);
            }
        }

        // African pentatonic melody (A minor pentatonic, warm & earthy)
        // Call and response style
        const melody = [
            // Call 1
            { freq: 440.00, start: 0, dur: 0.3 },      // A4
            { freq: 523.25, start: 0.375, dur: 0.3 },   // C5
            { freq: 587.33, start: 0.75, dur: 0.5 },    // D5
            // Response 1
            { freq: 659.25, start: 1.5, dur: 0.3 },     // E5
            { freq: 587.33, start: 1.875, dur: 0.3 },   // D5
            { freq: 523.25, start: 2.25, dur: 0.5 },    // C5
            // Call 2
            { freq: 587.33, start: 3.0, dur: 0.3 },     // D5
            { freq: 659.25, start: 3.375, dur: 0.3 },   // E5
            { freq: 783.99, start: 3.75, dur: 0.5 },    // G5
            // Response 2
            { freq: 659.25, start: 4.5, dur: 0.3 },     // E5
            { freq: 587.33, start: 4.875, dur: 0.3 },   // D5
            { freq: 440.00, start: 5.25, dur: 0.5 },    // A4
            // Call 3 - higher energy
            { freq: 783.99, start: 6.0, dur: 0.2 },     // G5
            { freq: 880.00, start: 6.25, dur: 0.2 },    // A5
            { freq: 783.99, start: 6.5, dur: 0.2 },     // G5
            { freq: 659.25, start: 6.75, dur: 0.5 },    // E5
            // Response 3
            { freq: 587.33, start: 7.5, dur: 0.3 },     // D5
            { freq: 523.25, start: 7.875, dur: 0.3 },   // C5
            { freq: 440.00, start: 8.25, dur: 0.5 },    // A4
            // Call 4 - descending resolution
            { freq: 659.25, start: 9.0, dur: 0.2 },     // E5
            { freq: 587.33, start: 9.25, dur: 0.2 },    // D5
            { freq: 523.25, start: 9.5, dur: 0.2 },     // C5
            { freq: 440.00, start: 9.75, dur: 0.5 },    // A4
            // Response 4 - loop back
            { freq: 523.25, start: 10.5, dur: 0.3 },    // C5
            { freq: 440.00, start: 10.875, dur: 0.3 },  // A4
            { freq: 392.00, start: 11.25, dur: 0.5 },   // G4
        ];

        for (const note of melody) {
            // Use a warmer 'sine' for African feel
            this._playBgNote(note.freq, now + note.start, note.dur, 'sine');
        }

        // Warm bass ostinato (repeating pattern, African style)
        const bass = [
            { freq: 110.00, start: 0, dur: 0.7 },      // A2
            { freq: 130.81, start: 0.75, dur: 0.5 },    // C3
            { freq: 146.83, start: 1.5, dur: 0.7 },     // D3
            { freq: 130.81, start: 2.25, dur: 0.5 },    // C3
            { freq: 110.00, start: 3.0, dur: 0.7 },     // A2
            { freq: 130.81, start: 3.75, dur: 0.5 },    // C3
            { freq: 146.83, start: 4.5, dur: 0.7 },     // D3
            { freq: 130.81, start: 5.25, dur: 0.5 },    // C3
            { freq: 110.00, start: 6.0, dur: 0.7 },     // A2
            { freq: 130.81, start: 6.75, dur: 0.5 },    // C3
            { freq: 146.83, start: 7.5, dur: 0.7 },     // D3
            { freq: 130.81, start: 8.25, dur: 0.5 },    // C3
            { freq: 110.00, start: 9.0, dur: 0.7 },     // A2
            { freq: 130.81, start: 9.75, dur: 0.5 },    // C3
            { freq: 98.00, start: 10.5, dur: 0.7 },     // G2
            { freq: 110.00, start: 11.25, dur: 0.5 },   // A2
        ];

        for (const b of bass) {
            this._playBgPad(b.freq, now + b.start, b.dur);
        }

        return dur;
    }

    // ─── WARTHOG WORLD: Jungle groove ────────────────────
    // Funky, tribal rhythm with deep bass, playful Hakuna Matata vibe
    _playWarthogMusic(now) {
        const dur = 12;

        // Tribal jungle drums — syncopated, funky
        const drums = [
            0, 0.25, 0.75, 1.0, 1.5, 1.75,
            3.0, 3.25, 3.75, 4.0, 4.5, 4.75,
            6.0, 6.25, 6.75, 7.0, 7.5, 7.75,
            9.0, 9.25, 9.75, 10.0, 10.5, 10.75,
        ];
        for (const beat of drums) {
            this._playDrum(90, now + beat, 0.15);
        }
        // Deep jungle bass drum
        for (const beat of [0, 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5]) {
            this._playDrum(50, now + beat, 0.3);
        }
        // High bongo accents
        for (const beat of [0.5, 2.25, 3.5, 5.25, 6.5, 8.25, 9.5, 11.25]) {
            this._playDrum(200, now + beat, 0.08);
        }

        // Playful melody — carefree, bouncy, Hakuna Matata feel
        // F major / Bb major, warm tropical
        const melody = [
            { freq: 349.23, start: 0, dur: 0.3 },       // F4
            { freq: 440.00, start: 0.375, dur: 0.3 },   // A4
            { freq: 523.25, start: 0.75, dur: 0.5 },    // C5
            { freq: 466.16, start: 1.5, dur: 0.3 },     // Bb4
            { freq: 440.00, start: 1.875, dur: 0.3 },   // A4
            { freq: 349.23, start: 2.25, dur: 0.5 },    // F4
            // Playful repeat higher
            { freq: 523.25, start: 3.0, dur: 0.3 },     // C5
            { freq: 587.33, start: 3.375, dur: 0.3 },   // D5
            { freq: 698.46, start: 3.75, dur: 0.5 },    // F5
            { freq: 587.33, start: 4.5, dur: 0.3 },     // D5
            { freq: 523.25, start: 4.875, dur: 0.3 },   // C5
            { freq: 466.16, start: 5.25, dur: 0.5 },    // Bb4
            // Carefree bridge
            { freq: 440.00, start: 6.0, dur: 0.2 },     // A4
            { freq: 523.25, start: 6.25, dur: 0.2 },    // C5
            { freq: 587.33, start: 6.5, dur: 0.2 },     // D5
            { freq: 523.25, start: 6.75, dur: 0.5 },    // C5
            { freq: 440.00, start: 7.5, dur: 0.3 },     // A4
            { freq: 349.23, start: 7.875, dur: 0.3 },   // F4
            { freq: 440.00, start: 8.25, dur: 0.5 },    // A4
            // Ending phrase
            { freq: 523.25, start: 9.0, dur: 0.2 },     // C5
            { freq: 466.16, start: 9.25, dur: 0.2 },    // Bb4
            { freq: 440.00, start: 9.5, dur: 0.2 },     // A4
            { freq: 349.23, start: 9.75, dur: 0.5 },    // F4
            { freq: 440.00, start: 10.5, dur: 0.3 },    // A4
            { freq: 349.23, start: 10.875, dur: 0.3 },  // F4
            { freq: 293.66, start: 11.25, dur: 0.5 },   // D4
        ];

        for (const note of melody) {
            this._playBgNote(note.freq, now + note.start, note.dur, 'triangle');
        }

        // Warm bass groove
        const bass = [
            { freq: 87.31, start: 0, dur: 0.7 },       // F2
            { freq: 116.54, start: 0.75, dur: 0.5 },    // Bb2
            { freq: 87.31, start: 1.5, dur: 0.7 },      // F2
            { freq: 110.00, start: 2.25, dur: 0.5 },    // A2
            { freq: 87.31, start: 3.0, dur: 0.7 },      // F2
            { freq: 116.54, start: 3.75, dur: 0.5 },    // Bb2
            { freq: 87.31, start: 4.5, dur: 0.7 },      // F2
            { freq: 110.00, start: 5.25, dur: 0.5 },    // A2
            { freq: 87.31, start: 6.0, dur: 0.7 },      // F2
            { freq: 116.54, start: 6.75, dur: 0.5 },    // Bb2
            { freq: 87.31, start: 7.5, dur: 0.7 },      // F2
            { freq: 110.00, start: 8.25, dur: 0.5 },    // A2
            { freq: 87.31, start: 9.0, dur: 0.7 },      // F2
            { freq: 116.54, start: 9.75, dur: 0.5 },    // Bb2
            { freq: 73.42, start: 10.5, dur: 0.7 },     // D2
            { freq: 87.31, start: 11.25, dur: 0.5 },    // F2
        ];

        for (const b of bass) {
            this._playBgPad(b.freq, now + b.start, b.dur);
        }

        return dur;
    }

    // ─── BIRD WORLD: Light airy soaring melody ─────────
    _playBirdMusic(now) {
        const dur = 12;

        // Light high-register arpeggios in C major - soaring feel
        // C5=523, E5=659, G5=784, A5=880, C6=1047, D5=587, F5=698, B4=494
        const melody = [
            { freq: 523, start: 0, dur: 0.4 },
            { freq: 659, start: 0.4, dur: 0.4 },
            { freq: 784, start: 0.8, dur: 0.4 },
            { freq: 1047, start: 1.2, dur: 0.6 },
            { freq: 880, start: 2.0, dur: 0.4 },
            { freq: 784, start: 2.4, dur: 0.4 },
            { freq: 659, start: 2.8, dur: 0.6 },

            { freq: 587, start: 3.6, dur: 0.4 },
            { freq: 698, start: 4.0, dur: 0.4 },
            { freq: 880, start: 4.4, dur: 0.4 },
            { freq: 1047, start: 4.8, dur: 0.8 },
            { freq: 784, start: 5.8, dur: 0.5 },

            { freq: 523, start: 6.5, dur: 0.3 },
            { freq: 659, start: 6.8, dur: 0.3 },
            { freq: 784, start: 7.1, dur: 0.3 },
            { freq: 880, start: 7.4, dur: 0.5 },
            { freq: 1047, start: 8.0, dur: 0.8 },

            { freq: 880, start: 9.0, dur: 0.3 },
            { freq: 784, start: 9.3, dur: 0.3 },
            { freq: 659, start: 9.6, dur: 0.3 },
            { freq: 523, start: 9.9, dur: 0.3 },
            { freq: 659, start: 10.4, dur: 0.4 },
            { freq: 784, start: 10.8, dur: 0.8 },
        ];

        for (const note of melody) {
            this._playBgNote(note.freq, now + note.start, note.dur, 'sine');
        }

        // Gentle windchime accents
        const chimes = [
            { freq: 1568, start: 1.5, dur: 0.3 },
            { freq: 2093, start: 3.2, dur: 0.2 },
            { freq: 1760, start: 5.5, dur: 0.25 },
            { freq: 2093, start: 7.8, dur: 0.2 },
            { freq: 1568, start: 10.2, dur: 0.3 },
        ];

        for (const c of chimes) {
            this._playBgNote(c.freq, now + c.start, c.dur, 'sine');
        }

        // Soft warm pad
        const pads = [
            { freq: 262, start: 0, dur: 3.5 },
            { freq: 294, start: 3.5, dur: 3.0 },
            { freq: 262, start: 6.5, dur: 3.0 },
            { freq: 247, start: 9.5, dur: 2.5 },
        ];

        for (const p of pads) {
            this._playBgPad(p.freq, now + p.start, p.dur);
        }

        return dur;
    }

    // ─── Sound Helpers ──────────────────────────────────
    _playBgNote(freq, startTime, duration, type) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type || 'triangle';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.18, startTime + duration * 0.4);
        gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.bgGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.01);
        if (this._bgOscillators) this._bgOscillators.push(osc);
    }

    _playBgPad(freq, startTime, duration) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + Math.min(0.5, duration * 0.3));
        gain.gain.setValueAtTime(0.1, startTime + duration - Math.min(0.5, duration * 0.3));
        gain.gain.linearRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.bgGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.01);
        if (this._bgOscillators) this._bgOscillators.push(osc);
    }

    _playDrum(freq, startTime, duration) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + duration);

        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.bgGain);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.01);
        if (this._bgOscillators) this._bgOscillators.push(osc);
    }

    _playShaker(startTime) {
        const ctx = this.ctx;
        // Noise-like shaker using high-frequency oscillator with fast decay
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.value = 6000 + Math.random() * 4000;

        gain.gain.setValueAtTime(0.06, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

        osc.connect(gain);
        gain.connect(this.bgGain);

        osc.start(startTime);
        osc.stop(startTime + 0.05);
        if (this._bgOscillators) this._bgOscillators.push(osc);
    }

    stopBgMusic() {
        this.bgPlaying = false;
        if (this._bgTimeout) {
            clearTimeout(this._bgTimeout);
            this._bgTimeout = null;
        }
        if (this._bgOscillators) {
            for (const osc of this._bgOscillators) {
                try { osc.stop(); } catch (e) { /* already stopped */ }
            }
            this._bgOscillators = [];
        }
    }

    // ─── Happy Sound (correct letter) ──────────────────
    playCorrect() {
        if (!this.initialized) return;
        this.resume();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [
            { freq: 523.25, delay: 0 },
            { freq: 659.25, delay: 0.08 },
            { freq: 783.99, delay: 0.16 },
            { freq: 1046.50, delay: 0.24 },
        ];

        for (const note of notes) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = note.freq;
            const t = now + note.delay;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.4);
        }

        const sparkle = ctx.createOscillator();
        const sparkleGain = ctx.createGain();
        sparkle.type = 'sine';
        sparkle.frequency.setValueAtTime(1568, now + 0.3);
        sparkle.frequency.exponentialRampToValueAtTime(2093, now + 0.45);
        sparkleGain.gain.setValueAtTime(0, now + 0.3);
        sparkleGain.gain.linearRampToValueAtTime(0.2, now + 0.32);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        sparkle.connect(sparkleGain);
        sparkleGain.connect(this.sfxGain);
        sparkle.start(now + 0.3);
        sparkle.stop(now + 0.6);
    }

    // ─── Sad Sound (wrong letter) ──────────────────────
    playWrong() {
        if (!this.initialized) return;
        this.resume();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(400, now);
        osc1.frequency.linearRampToValueAtTime(350, now + 0.2);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.5, now + 0.02);
        gain1.gain.linearRampToValueAtTime(0.1, now + 0.2);
        gain1.gain.linearRampToValueAtTime(0.001, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(this.sfxGain);
        osc1.start(now);
        osc1.stop(now + 0.35);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(350, now + 0.25);
        osc2.frequency.linearRampToValueAtTime(280, now + 0.55);
        gain2.gain.setValueAtTime(0, now + 0.25);
        gain2.gain.linearRampToValueAtTime(0.5, now + 0.27);
        gain2.gain.linearRampToValueAtTime(0.001, now + 0.6);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(now + 0.25);
        osc2.stop(now + 0.65);
    }

    // ─── Level Complete Fanfare ────────────────────────
    playLevelComplete() {
        if (!this.initialized) return;
        this.resume();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [
            { freq: 523.25, delay: 0 },
            { freq: 587.33, delay: 0.12 },
            { freq: 659.25, delay: 0.24 },
            { freq: 783.99, delay: 0.36 },
            { freq: 1046.50, delay: 0.55 },
        ];

        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const isLast = i === notes.length - 1;
            osc.type = 'sine';
            osc.frequency.value = note.freq;
            const t = now + note.delay;
            const d = isLast ? 0.8 : 0.2;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, t + d);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + d + 0.01);
        }
    }

    destroy() {
        this.stopBgMusic();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this.initialized = false;
    }
}

var gameAudio = new GameAudio();
