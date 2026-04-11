// ─── Mobile scale factor ──────────────────────────────────
function getScale() {
    const w = window.innerWidth;
    if (w < 480) return 0.55;
    if (w < 768) return 0.7;
    return 1;
}

// Hebrew alphabet in order
const HEBREW_LETTERS = [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
    'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
];

// Cache Hebrew voice
let hebrewVoice = null;

function loadHebrewVoice() {
    const voices = speechSynthesis.getVoices();
    hebrewVoice = voices.find(v => v.lang.startsWith('he'))
        || voices.find(v => v.lang.startsWith('iw'));
}

if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = loadHebrewVoice;
    loadHebrewVoice();
}

let narrationEnabled = true;

function toggleNarration() {
    narrationEnabled = !narrationEnabled;
    document.getElementById('narration-btn').textContent = narrationEnabled ? '🗣️' : '🤫';
    if (!narrationEnabled) speechSynthesis.cancel();
}

function speakLetter(letter) {
    if (!narrationEnabled) return;
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(letter);
        utterance.lang = 'he-IL';
        utterance.rate = 0.8;
        utterance.pitch = 1.0;
        utterance.volume = 1;
        if (hebrewVoice) utterance.voice = hebrewVoice;
        speechSynthesis.speak(utterance);
    }
}

const POINTS_PER_CHAR = 2;
var POINTS_TO_PASS = 20; // default medium, set by difficulty selection
const MAX_LIVES = 5;

// ─── World themes ──────────────────────────────────────────
const WORLDS = {
    dino: {
        name: 'Dino World',
        groundColor: '#5a3d2b',
        groundTopColor: '#7cba3f',
        skyColors: ['#87CEEB', '#c8e6f0'],
        // We'll draw the dino procedurally
        bgElements: 'prehistoric',
    },
    dog: {
        name: 'Dog World',
        groundColor: '#8B7355',
        groundTopColor: '#90c060',
        skyColors: ['#87CEEB', '#e0f0ff'],
        bgElements: 'neighborhood',
    },
    meerkat: {
        name: 'Meerkat World',
        groundColor: '#c4a35a',
        groundTopColor: '#d4b96a',
        skyColors: ['#f0c27f', '#fce38a'],
        bgElements: 'savanna',
    },
    cheetah: {
        name: 'Cheetah World',
        groundColor: '#b8903a',
        groundTopColor: '#c8a848',
        skyColors: ['#e8a040', '#f5d080'],
        bgElements: 'savanna',
    },
    warthog: {
        name: 'Warthog World',
        groundColor: '#3a2a15',
        groundTopColor: '#3a7a30',
        skyColors: ['#1a4a20', '#4a9a50'],
        bgElements: 'jungle',
    },
    bird: {
        name: 'Bird World',
        groundColor: '#7cba3f',
        groundTopColor: '#90d060',
        skyColors: ['#87CEEB', '#d0eaff'],
        bgElements: 'sky',
    },
    lion: {
        name: 'Lion World',
        groundColor: '#b89050',
        groundTopColor: '#c8a858',
        skyColors: ['#f5c842', '#fce38a'],
        bgElements: 'savanna_king',
    }
};

var game = null;

// ─── Main Game Class ───────────────────────────────────────
class Game {
    constructor(worldType) {
        this.worldType = worldType;
        this.world = WORLDS[worldType];
        this.isBirdWorld = (worldType === 'bird');
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Game state
        this.lives = MAX_LIVES;
        this.score = 0;
        this.currentLetterIndex = 0;
        this.gameMode = gameMode; // 'letters' or 'math'
        this.exerciseCount = 0;
        this.totalExercises = 0;
        this.currentExercise = null;
        this.gameOver = false;
        this.paused = false;
        this.speed = worldType === 'cheetah' ? 9 : 6;
        this.frameCount = 0;
        this.scrollX = 0;

        // Ground
        this.groundY = 0;

        // Player
        this.player = {
            x: 120,
            y: 0,
            width: 60,
            height: 65,
            vy: 0,
            jumping: false,
            grounded: true,
            jumpPower: -14,
            gravity: 0.6,
            frame: 0,
            frameTimer: 0,
        };

        // Now safe to resize (player exists)
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Floating letters
        this.letters = [];
        this.letterSpawnTimer = 0;
        this.letterSpawnInterval = 70; // frames (~1.2 sec at 60fps)

        // Particles (for collecting)
        this.particles = [];

        // Flash messages
        this.flashMessage = null;
        this.flashTimer = 0;

        // Background elements
        this.bgElements = [];
        this.initBackground();

        // Clouds
        this.clouds = [];
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width * 2,
                y: 30 + Math.random() * 100,
                size: 30 + Math.random() * 50,
                speed: 0.3 + Math.random() * 0.5
            });
        }

        // Time tracking
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.fixedDt = 1000 / 60; // simulate at 60fps

        // Input
        this.setupInput();

        // Math mode init
        if (this.gameMode === 'math') {
            this.totalExercises = Math.round(POINTS_TO_PASS / POINTS_PER_CHAR);
            this.generateExercise();
        }

        // Start loop
        this.running = true;
        this.startLoop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.scale = getScale();
        this.player.width = Math.round(60 * this.scale);
        this.player.height = Math.round(65 * this.scale);
        this.player.jumpPower = -14 * this.scale;
        this.player.gravity = 0.6 * this.scale;
        this.player.x = Math.round(120 * this.scale);
        this.updateGround();
    }

    updateGround() {
        // On tall portrait screens, raise the ground so action is centered
        const h = this.canvas.height;
        const w = this.canvas.width;
        if (w < 768 && h > w) {
            // Portrait mobile: ground at ~65% of screen height
            this.groundY = Math.round(h * 0.65);
        } else {
            this.groundY = h - Math.round(100 * this.scale);
        }
        this.player.y = this.groundY - this.player.height;

        if (this.isBirdWorld) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            if (w < 768 && h > w) {
                // Portrait mobile: hover with room to dive
                this.player.hoverY = Math.round(h * 0.42);
            } else {
                this.player.hoverY = Math.round(h * 0.55);
            }
            this.player.maxDiveY = this.groundY - this.player.height - Math.round(10 * this.scale);
            this.player.y = this.player.hoverY;
        }
    }

    initBackground() {
        this.bgElements = [];
        if (this.world.bgElements === 'prehistoric') {
            // Volcanoes, palm trees, rocks
            for (let i = 0; i < 20; i++) {
                const type = ['volcano', 'palmtree', 'rock', 'fern'][Math.floor(Math.random() * 4)];
                this.bgElements.push({
                    type,
                    x: i * 400 + Math.random() * 300,
                    size: 0.6 + Math.random() * 0.8
                });
            }
        } else if (this.world.bgElements === 'savanna') {
            for (let i = 0; i < 20; i++) {
                const type = ['acacia', 'drybush', 'termitemound', 'baobab'][Math.floor(Math.random() * 4)];
                this.bgElements.push({
                    type,
                    x: i * 450 + Math.random() * 350,
                    size: 0.6 + Math.random() * 0.8
                });
            }
        } else if (this.world.bgElements === 'jungle') {
            for (let i = 0; i < 25; i++) {
                const type = ['jungletree', 'vine', 'fern_big', 'bamboo', 'mushroom'][Math.floor(Math.random() * 5)];
                this.bgElements.push({
                    type,
                    x: i * 300 + Math.random() * 250,
                    size: 0.6 + Math.random() * 0.8
                });
            }
        } else if (this.world.bgElements === 'savanna_king') {
            for (let i = 0; i < 25; i++) {
                const type = ['cheering_zebra', 'cheering_elephant', 'cheering_giraffe', 'cheering_monkey', 'acacia', 'drybush'][Math.floor(Math.random() * 6)];
                this.bgElements.push({
                    type,
                    x: i * 350 + Math.random() * 300,
                    size: 0.6 + Math.random() * 0.6
                });
            }
        } else if (this.world.bgElements === 'sky') {
            for (let i = 0; i < 15; i++) {
                const type = ['mountain', 'hill', 'pinetree'][Math.floor(Math.random() * 3)];
                this.bgElements.push({
                    type,
                    x: i * 500 + Math.random() * 400,
                    size: 0.6 + Math.random() * 0.8
                });
            }
        } else {
            // Houses, trees, fences
            for (let i = 0; i < 20; i++) {
                const type = ['house', 'tree', 'fence', 'bush'][Math.floor(Math.random() * 4)];
                this.bgElements.push({
                    type,
                    x: i * 350 + Math.random() * 250,
                    size: 0.6 + Math.random() * 0.6
                });
            }
        }
    }

    setupInput() {
        const jump = () => {
            if (!this.paused && !this.gameOver && this.player.grounded) {
                if (this.isBirdWorld) {
                    this.player.vy = Math.abs(this.player.jumpPower) * 1.5;
                } else {
                    this.player.vy = this.player.jumpPower;
                }
                this.player.jumping = true;
                this.player.grounded = false;
            }
        };

        this._keyHandler = (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                jump();
            }
        };
        this._touchHandler = (e) => {
            e.preventDefault();
            jump();
        };

        window.addEventListener('keydown', this._keyHandler);
        this.canvas.addEventListener('touchstart', this._touchHandler);
        this.canvas.addEventListener('mousedown', jump);
        this._clickHandler = jump;
    }

    removeInput() {
        window.removeEventListener('keydown', this._keyHandler);
        this.canvas.removeEventListener('touchstart', this._touchHandler);
        this.canvas.removeEventListener('mousedown', this._clickHandler);
    }

    get currentLetter() {
        return HEBREW_LETTERS[this.currentLetterIndex];
    }

    generateExercise() {
        const op = Math.random() < 0.5 ? '+' : '-';
        let a, b, answer;
        if (op === '+') {
            a = Math.floor(Math.random() * 10) + 1; // 1-10
            b = Math.floor(Math.random() * (10 - a)) + 1; // 1 to (10-a)
            answer = a + b;
        } else {
            a = Math.floor(Math.random() * 9) + 2; // 2-10
            b = Math.floor(Math.random() * a) + 1; // 1 to a
            answer = a - b;
        }
        this.currentExercise = { text: `${a}${op}${b}`, answer: answer };
    }

    // ─── Spawning letters ───────────────────────────────────
    spawnLetter() {
        const isCorrect = Math.random() < 0.45;
        let letter;

        if (this.gameMode === 'math') {
            if (isCorrect) {
                letter = String(this.currentExercise.answer);
            } else {
                let wrong;
                do {
                    wrong = Math.floor(Math.random() * 11); // 0-10
                } while (wrong === this.currentExercise.answer);
                letter = String(wrong);
            }
        } else {
            if (isCorrect) {
                letter = this.currentLetter;
            } else {
                let idx;
                do {
                    idx = Math.floor(Math.random() * HEBREW_LETTERS.length);
                } while (idx === this.currentLetterIndex);
                letter = HEBREW_LETTERS[idx];
            }
        }

        const s = this.scale;
        let floatY;
        if (this.isBirdWorld) {
            // Letters near ground level — bird dives down to get them
            floatY = this.groundY - Math.round(50 * s) - Math.random() * Math.round(70 * s);
        } else {
            floatY = this.groundY - Math.round(130 * s) - Math.random() * Math.round(80 * s);
        }

        const isCorrectAnswer = this.gameMode === 'math'
            ? letter === String(this.currentExercise.answer)
            : letter === this.currentLetter;

        this.letters.push({
            letter,
            correct: isCorrectAnswer,
            x: this.canvas.width + 50,
            y: floatY,
            baseY: floatY,
            size: Math.round(48 * s),
            floatPhase: Math.random() * Math.PI * 2,
            collected: false,
        });
    }

    // ─── Particles ──────────────────────────────────────────
    spawnParticles(x, y, color, count = 10) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 1) * 6,
                life: 30 + Math.random() * 20,
                maxLife: 50,
                color,
                size: 3 + Math.random() * 5,
            });
        }
    }

    // ─── Update ─────────────────────────────────────────────
    update() {
        if (this.paused || this.gameOver) return;

        this.frameCount++;
        this.scrollX += this.speed;

        // Player physics
        if (this.isBirdWorld) {
            if (!this.player.grounded) {
                // Spring-damper: pull bird back up toward hoverY
                this.player.vy -= this.player.gravity * 0.8;
                this.player.vy *= 0.97;
                this.player.y += this.player.vy;

                // Don't go below max dive depth
                if (this.player.y >= this.player.maxDiveY) {
                    this.player.y = this.player.maxDiveY;
                    this.player.vy = -Math.abs(this.player.vy) * 0.5;
                }

                // Settled back at hover position
                if (this.player.y <= this.player.hoverY && this.player.vy <= 0) {
                    this.player.y = this.player.hoverY;
                    this.player.vy = 0;
                    this.player.grounded = true;
                    this.player.jumping = false;
                }
            }
        } else {
            if (!this.player.grounded) {
                this.player.vy += this.player.gravity;
                this.player.y += this.player.vy;

                if (this.player.y >= this.groundY - this.player.height) {
                    this.player.y = this.groundY - this.player.height;
                    this.player.vy = 0;
                    this.player.grounded = true;
                    this.player.jumping = false;
                }
            }
        }

        // Animate player walk
        this.player.frameTimer++;
        if (this.player.frameTimer > 8) {
            this.player.frame = (this.player.frame + 1) % 4;
            this.player.frameTimer = 0;
        }

        // Spawn letters
        this.letterSpawnTimer++;
        if (this.letterSpawnTimer >= this.letterSpawnInterval) {
            this.spawnLetter();
            this.letterSpawnTimer = 0;
        }

        // Move letters
        for (const l of this.letters) {
            l.x -= this.speed;
            l.floatPhase += 0.05;
            l.y = l.baseY + Math.sin(l.floatPhase) * 8;
        }

        // Collision detection
        for (const l of this.letters) {
            if (l.collected) continue;
            const dx = (this.player.x + this.player.width / 2) - l.x;
            const dy = (this.player.y + this.player.height / 2) - l.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 45 * this.scale) {
                l.collected = true;
                setTimeout(() => speakLetter(l.letter), 400);
                if (l.correct) {
                    this.score += POINTS_PER_CHAR;
                    this.spawnParticles(l.x, l.y, '#FFD700', 15);
                    this.showFlash('+2 ⭐', '#FFD700');
                    gameAudio.playCorrect();

                    if (this.score >= POINTS_TO_PASS) {
                        this.levelComplete();
                    }
                } else {
                    this.lives--;
                    this.spawnParticles(l.x, l.y, '#ff4444', 10);
                    this.showFlash('אוי! ✗', '#ff4444');
                    gameAudio.playWrong();

                    if (this.lives <= 0) {
                        this.triggerGameOver();
                    }
                }
            }
        }

        // Remove off-screen letters
        this.letters = this.letters.filter(l => l.x > -60);

        // Update particles
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2;
            p.life--;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        // Flash timer
        if (this.flashTimer > 0) this.flashTimer--;

        // Move clouds
        for (const c of this.clouds) {
            c.x -= c.speed;
            if (c.x + c.size < 0) {
                c.x = this.canvas.width + c.size;
                c.y = 30 + Math.random() * 100;
            }
        }

        // Recycle bg elements
        for (const el of this.bgElements) {
            const screenX = el.x - this.scrollX * 0.3;
            if (screenX < -200) {
                el.x += this.bgElements.length * 400;
            }
        }
    }

    showFlash(text, color) {
        this.flashMessage = text;
        this.flashColor = color;
        this.flashTimer = 40;
    }

    levelComplete() {
        this.paused = true;
        gameAudio.playLevelComplete();
        // Bonus life for completing a level!
        if (this.lives < MAX_LIVES) {
            this.lives++;
        }

        if (this.gameMode === 'math') {
            this.exerciseCount++;
            if (this.exerciseCount >= this.totalExercises) {
                // Won all exercises!
                document.getElementById('win-overlay').classList.remove('hidden');
                startVictoryDance(this.worldType);
                spawnConfetti();
                startGiftAnimation();
                return;
            }
            document.getElementById('next-letter-display').textContent = `תרגיל ${this.exerciseCount + 1}`;
            document.getElementById('level-complete-msg').textContent = 'כל הכבוד! עכשיו התרגיל הבא';
            document.getElementById('level-complete-overlay').classList.remove('hidden');
        } else {
            const nextIdx = this.currentLetterIndex + 1;
            if (nextIdx >= HEBREW_LETTERS.length) {
                // Won the whole game!
                document.getElementById('win-overlay').classList.remove('hidden');
                startVictoryDance(this.worldType);
                spawnConfetti();
                startGiftAnimation();
                return;
            }
            document.getElementById('next-letter-display').textContent = HEBREW_LETTERS[nextIdx];
            document.getElementById('level-complete-msg').textContent = 'way to go - now catch the next letter!';
            document.getElementById('level-complete-overlay').classList.remove('hidden');
        }
    }

    nextLevel() {
        if (this.gameMode === 'math') {
            this.generateExercise();
        } else {
            this.currentLetterIndex++;
        }
        this.score = 0;
        this.letters = [];
        this.letterSpawnTimer = 0;
        this.paused = false;
        // Slightly increase speed each level
        const levelNum = this.gameMode === 'math' ? this.exerciseCount : this.currentLetterIndex;
        this.speed = Math.min(6 + levelNum * 0.2, 10);
        document.getElementById('level-complete-overlay').classList.add('hidden');
    }

    triggerGameOver() {
        this.gameOver = true;
        if (this.gameMode === 'math') {
            document.getElementById('final-score').textContent =
                `השלמתם ${this.exerciseCount} תרגילים עם ${this.score} נקודות`;
        } else {
            document.getElementById('final-score').textContent =
                `הגעתם לאות ${this.currentLetter} עם ${this.score} נקודות`;
        }
        document.getElementById('game-over-overlay').classList.remove('hidden');
    }

    restart() {
        this.lives = MAX_LIVES;
        this.score = 0;
        this.currentLetterIndex = 0;
        this.exerciseCount = 0;
        if (this.gameMode === 'math') {
            this.generateExercise();
        }
        this.speed = this.worldType === 'cheetah' ? 9 : 6;
        this.letters = [];
        this.particles = [];
        this.gameOver = false;
        this.paused = false;
        this.scrollX = 0;
        if (this.isBirdWorld) {
            this.player.y = this.player.hoverY;
            this.player.vy = 0;
            this.player.grounded = true;
        }
        document.getElementById('game-over-overlay').classList.add('hidden');
    }

    destroy() {
        this.running = false;
        this.stopLoop();
        this.removeInput();
    }

    // ─── Drawing ────────────────────────────────────────────
    draw() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, this.groundY);
        skyGrad.addColorStop(0, this.world.skyColors[0]);
        skyGrad.addColorStop(1, this.world.skyColors[1]);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);

        // Clouds
        this.drawClouds(ctx);

        // Background elements (parallax)
        this.drawBgElements(ctx);

        // Ground
        this.drawGround(ctx, W, H);

        // Floating letters
        this.drawLetters(ctx);

        // Speed lines (cheetah race effect)
        if (this.worldType === 'cheetah' && !this.paused) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const ly = 100 + i * (this.groundY - 100) / 8;
                const lx = ((this.frameCount * 10 + i * 137) % (W + 200)) - 100;
                ctx.beginPath();
                ctx.moveTo(lx, ly);
                ctx.lineTo(lx - 30 - Math.random() * 20, ly);
                ctx.stroke();
            }
        }

        // Player
        this.drawPlayer(ctx);

        // Particles
        this.drawParticles(ctx);

        // HUD
        this.drawHUD(ctx, W);

        // Flash message
        if (this.flashTimer > 0 && this.flashMessage) {
            const alpha = Math.min(1, this.flashTimer / 15);
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${Math.round(42 * this.scale)}px Arial`;
            ctx.fillStyle = this.flashColor;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = Math.round(4 * this.scale);
            ctx.textAlign = 'center';
            const fy = this.player.y - Math.round(30 * this.scale) - (40 - this.flashTimer);
            ctx.strokeText(this.flashMessage, this.player.x + this.player.width / 2, fy);
            ctx.fillText(this.flashMessage, this.player.x + this.player.width / 2, fy);
            ctx.globalAlpha = 1;
        }
    }

    drawClouds(ctx) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (const c of this.clouds) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size * 0.5, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.3, c.y - c.size * 0.15, c.size * 0.4, 0, Math.PI * 2);
            ctx.arc(c.x + c.size * 0.6, c.y, c.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawBgElements(ctx) {
        for (const el of this.bgElements) {
            const sx = el.x - this.scrollX * 0.3;
            if (sx < -200 || sx > this.canvas.width + 200) continue;
            const s = el.size;

            ctx.save();
            ctx.translate(sx, this.groundY);

            if (this.world.bgElements === 'prehistoric') {
                this.drawPrehistoricElement(ctx, el.type, s);
            } else if (this.world.bgElements === 'savanna') {
                this.drawSavannaElement(ctx, el.type, s);
            } else if (this.world.bgElements === 'jungle') {
                this.drawJungleElement(ctx, el.type, s);
            } else if (this.world.bgElements === 'savanna_king') {
                this.drawSavannaKingElement(ctx, el.type, s);
            } else if (this.world.bgElements === 'sky') {
                this.drawSkyElement(ctx, el.type, s);
            } else {
                this.drawNeighborhoodElement(ctx, el.type, s);
            }

            ctx.restore();
        }
    }

    drawPrehistoricElement(ctx, type, s) {
        switch (type) {
            case 'volcano':
                ctx.fillStyle = '#5c4033';
                ctx.beginPath();
                ctx.moveTo(-60 * s, 0);
                ctx.lineTo(-10 * s, -120 * s);
                ctx.lineTo(10 * s, -120 * s);
                ctx.lineTo(60 * s, 0);
                ctx.fill();
                // Lava glow
                ctx.fillStyle = '#ff4500';
                ctx.beginPath();
                ctx.arc(0, -120 * s, 10 * s, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'palmtree':
                // Trunk
                ctx.fillStyle = '#8B6914';
                ctx.fillRect(-6 * s, -90 * s, 12 * s, 90 * s);
                // Leaves
                ctx.fillStyle = '#2d8f2d';
                for (let a = 0; a < 5; a++) {
                    ctx.save();
                    ctx.translate(0, -90 * s);
                    ctx.rotate((a / 5) * Math.PI * 2);
                    ctx.beginPath();
                    ctx.ellipse(20 * s, 0, 30 * s, 8 * s, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                break;
            case 'rock':
                ctx.fillStyle = '#777';
                ctx.beginPath();
                ctx.ellipse(0, -10 * s, 25 * s, 18 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#888';
                ctx.beginPath();
                ctx.ellipse(-5 * s, -14 * s, 15 * s, 10 * s, -0.2, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'fern':
                ctx.fillStyle = '#3a9f3a';
                for (let i = -2; i <= 2; i++) {
                    ctx.save();
                    ctx.rotate(i * 0.3);
                    ctx.beginPath();
                    ctx.ellipse(0, -35 * s, 5 * s, 35 * s, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                break;
        }
    }

    drawNeighborhoodElement(ctx, type, s) {
        switch (type) {
            case 'house':
                // Wall
                const colors = ['#e8c170', '#d4a574', '#c9b89e', '#f0d0a0'];
                ctx.fillStyle = colors[Math.floor(s * 10) % colors.length];
                ctx.fillRect(-35 * s, -60 * s, 70 * s, 60 * s);
                // Roof
                ctx.fillStyle = '#c0392b';
                ctx.beginPath();
                ctx.moveTo(-45 * s, -60 * s);
                ctx.lineTo(0, -95 * s);
                ctx.lineTo(45 * s, -60 * s);
                ctx.fill();
                // Door
                ctx.fillStyle = '#6d4c2a';
                ctx.fillRect(-8 * s, -30 * s, 16 * s, 30 * s);
                // Window
                ctx.fillStyle = '#87CEEB';
                ctx.fillRect(-28 * s, -50 * s, 14 * s, 14 * s);
                ctx.fillRect(14 * s, -50 * s, 14 * s, 14 * s);
                break;
            case 'tree':
                ctx.fillStyle = '#6d4c2a';
                ctx.fillRect(-5 * s, -50 * s, 10 * s, 50 * s);
                ctx.fillStyle = '#27ae60';
                ctx.beginPath();
                ctx.arc(0, -65 * s, 30 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath();
                ctx.arc(-8 * s, -72 * s, 20 * s, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'fence':
                ctx.fillStyle = '#f5f5dc';
                for (let i = -2; i <= 2; i++) {
                    ctx.fillRect(i * 15 * s - 3 * s, -35 * s, 6 * s, 35 * s);
                }
                ctx.fillRect(-35 * s, -28 * s, 70 * s, 5 * s);
                ctx.fillRect(-35 * s, -15 * s, 70 * s, 5 * s);
                break;
            case 'bush':
                ctx.fillStyle = '#27ae60';
                ctx.beginPath();
                ctx.arc(0, -15 * s, 22 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2ecc71';
                ctx.beginPath();
                ctx.arc(10 * s, -18 * s, 16 * s, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    drawSavannaElement(ctx, type, s) {
        switch (type) {
            case 'acacia':
                // Trunk
                ctx.fillStyle = '#8B6914';
                ctx.fillRect(-4 * s, -80 * s, 8 * s, 80 * s);
                // Flat canopy (iconic acacia shape)
                ctx.fillStyle = '#6b8e23';
                ctx.beginPath();
                ctx.ellipse(0, -85 * s, 45 * s, 12 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#7a9e32';
                ctx.beginPath();
                ctx.ellipse(-5 * s, -90 * s, 35 * s, 10 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'drybush':
                // Dry tumbleweed / scrub
                ctx.fillStyle = '#b8a040';
                ctx.beginPath();
                ctx.arc(0, -12 * s, 18 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#a89030';
                ctx.beginPath();
                ctx.arc(8 * s, -16 * s, 12 * s, 0, Math.PI * 2);
                ctx.fill();
                // Dry grass blades
                ctx.strokeStyle = '#c0a840';
                ctx.lineWidth = 2;
                for (let i = -2; i <= 2; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * 8 * s, 0);
                    ctx.quadraticCurveTo(i * 8 * s + 5 * s, -25 * s, i * 10 * s, -30 * s);
                    ctx.stroke();
                }
                break;
            case 'termitemound':
                ctx.fillStyle = '#b5883a';
                ctx.beginPath();
                ctx.moveTo(-20 * s, 0);
                ctx.quadraticCurveTo(-15 * s, -55 * s, 0, -65 * s);
                ctx.quadraticCurveTo(15 * s, -55 * s, 20 * s, 0);
                ctx.fill();
                // Texture
                ctx.fillStyle = '#a07830';
                ctx.beginPath();
                ctx.ellipse(-5 * s, -30 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(4 * s, -45 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'baobab':
                // Thick trunk
                ctx.fillStyle = '#8a7050';
                ctx.beginPath();
                ctx.moveTo(-18 * s, 0);
                ctx.quadraticCurveTo(-22 * s, -40 * s, -15 * s, -70 * s);
                ctx.lineTo(15 * s, -70 * s);
                ctx.quadraticCurveTo(22 * s, -40 * s, 18 * s, 0);
                ctx.fill();
                // Branches (sparse, iconic baobab look)
                ctx.strokeStyle = '#8a7050';
                ctx.lineWidth = 4 * s;
                for (const angle of [-0.6, -0.2, 0.2, 0.6]) {
                    ctx.beginPath();
                    ctx.moveTo(angle * 15 * s, -70 * s);
                    ctx.lineTo(angle * 35 * s, -95 * s);
                    ctx.stroke();
                }
                // Small canopy tufts
                ctx.fillStyle = '#7a9030';
                for (const angle of [-0.6, -0.2, 0.2, 0.6]) {
                    ctx.beginPath();
                    ctx.arc(angle * 35 * s, -95 * s, 10 * s, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
        }
    }

    drawJungleElement(ctx, type, s) {
        switch (type) {
            case 'jungletree':
                // Thick tropical trunk
                ctx.fillStyle = '#5a3a20';
                ctx.fillRect(-8 * s, -100 * s, 16 * s, 100 * s);
                // Roots
                ctx.fillStyle = '#4a3018';
                ctx.beginPath();
                ctx.moveTo(-20 * s, 0);
                ctx.quadraticCurveTo(-12 * s, -10 * s, -8 * s, -15 * s);
                ctx.lineTo(-8 * s, 0);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(20 * s, 0);
                ctx.quadraticCurveTo(12 * s, -10 * s, 8 * s, -15 * s);
                ctx.lineTo(8 * s, 0);
                ctx.fill();
                // Dense canopy layers
                ctx.fillStyle = '#1a6a20';
                ctx.beginPath();
                ctx.arc(0, -100 * s, 35 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2a8a30';
                ctx.beginPath();
                ctx.arc(-10 * s, -110 * s, 25 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#207a28';
                ctx.beginPath();
                ctx.arc(12 * s, -105 * s, 28 * s, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'vine':
                // Hanging vine
                ctx.strokeStyle = '#2a6a20';
                ctx.lineWidth = 3 * s;
                ctx.beginPath();
                ctx.moveTo(0, -90 * s);
                ctx.quadraticCurveTo(15 * s, -60 * s, 5 * s, -30 * s);
                ctx.quadraticCurveTo(-10 * s, -10 * s, 0, 0);
                ctx.stroke();
                // Leaves on vine
                ctx.fillStyle = '#3a9a30';
                for (let i = 0; i < 4; i++) {
                    const vy = -20 * s - i * 18 * s;
                    ctx.beginPath();
                    ctx.ellipse(5 * s * (i % 2 === 0 ? 1 : -1), vy, 8 * s, 4 * s, i % 2 === 0 ? 0.3 : -0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'fern_big':
                // Large tropical fern
                ctx.fillStyle = '#2a8a28';
                for (let i = -3; i <= 3; i++) {
                    ctx.save();
                    ctx.rotate(i * 0.25);
                    ctx.beginPath();
                    ctx.ellipse(0, -30 * s, 6 * s, 35 * s, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                ctx.fillStyle = '#3aaa38';
                for (let i = -2; i <= 2; i++) {
                    ctx.save();
                    ctx.rotate(i * 0.2);
                    ctx.beginPath();
                    ctx.ellipse(0, -25 * s, 4 * s, 28 * s, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                break;
            case 'bamboo':
                // Bamboo stalks
                for (let b = -1; b <= 1; b++) {
                    const bx = b * 8 * s;
                    ctx.fillStyle = '#6aaa40';
                    ctx.fillRect(bx - 3 * s, -85 * s, 6 * s, 85 * s);
                    // Segments
                    ctx.fillStyle = '#5a9a35';
                    for (let j = 0; j < 5; j++) {
                        ctx.fillRect(bx - 4 * s, -j * 18 * s, 8 * s, 2 * s);
                    }
                    // Leaves at top
                    ctx.fillStyle = '#4aaa38';
                    ctx.beginPath();
                    ctx.ellipse(bx + 8 * s, -85 * s, 12 * s, 4 * s, 0.4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.ellipse(bx - 8 * s, -80 * s, 10 * s, 3 * s, -0.3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'mushroom':
                // Big tropical mushroom
                ctx.fillStyle = '#e8d0a0';
                ctx.fillRect(-3 * s, -20 * s, 6 * s, 20 * s);
                ctx.fillStyle = '#e04040';
                ctx.beginPath();
                ctx.arc(0, -22 * s, 14 * s, Math.PI, 0);
                ctx.fill();
                // Spots
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(-5 * s, -28 * s, 3 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(5 * s, -26 * s, 2 * s, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
    }

    drawSavannaKingElement(ctx, type, s) {
        const bounce = Math.sin(this.frameCount * 0.08 + Math.random() * 0.01) * 4;
        const wave = Math.sin(this.frameCount * 0.12) * 0.3;
        switch (type) {
            case 'cheering_zebra':
                // Small zebra bouncing
                ctx.save();
                ctx.translate(0, bounce);
                // Body
                ctx.fillStyle = '#f0f0f0';
                ctx.beginPath();
                ctx.ellipse(0, -20 * s, 16 * s, 10 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Stripes
                ctx.fillStyle = '#222';
                for (let i = -10; i < 12; i += 5) {
                    ctx.fillRect(i * s, -28 * s, 2 * s, 16 * s);
                }
                // Head
                ctx.fillStyle = '#f0f0f0';
                ctx.beginPath();
                ctx.ellipse(14 * s, -30 * s, 7 * s, 6 * s, 0.3, 0, Math.PI * 2);
                ctx.fill();
                // Legs
                ctx.fillStyle = '#ddd';
                ctx.fillRect(-8 * s, -12 * s, 3 * s, 12 * s);
                ctx.fillRect(6 * s, -12 * s, 3 * s, 12 * s);
                // Raised front leg (cheering!)
                ctx.save();
                ctx.translate(12 * s, -12 * s);
                ctx.rotate(-0.5 + wave);
                ctx.fillRect(0, 0, 3 * s, 10 * s);
                ctx.restore();
                ctx.restore();
                break;
            case 'cheering_elephant':
                ctx.save();
                ctx.translate(0, bounce * 0.5);
                // Body
                ctx.fillStyle = '#a0a0a8';
                ctx.beginPath();
                ctx.ellipse(0, -22 * s, 20 * s, 14 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Head
                ctx.fillStyle = '#909098';
                ctx.beginPath();
                ctx.arc(18 * s, -30 * s, 10 * s, 0, Math.PI * 2);
                ctx.fill();
                // Ear
                ctx.fillStyle = '#b0a0a8';
                ctx.beginPath();
                ctx.ellipse(10 * s, -30 * s, 8 * s, 10 * s, -0.2, 0, Math.PI * 2);
                ctx.fill();
                // Trunk raised (cheering!)
                ctx.strokeStyle = '#909098';
                ctx.lineWidth = 4 * s;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(26 * s, -30 * s);
                ctx.quadraticCurveTo(34 * s, -35 * s, 30 * s, -48 * s + bounce);
                ctx.stroke();
                // Eye
                ctx.fillStyle = '#333';
                ctx.beginPath();
                ctx.arc(22 * s, -33 * s, 2 * s, 0, Math.PI * 2);
                ctx.fill();
                // Legs
                ctx.fillStyle = '#888890';
                ctx.fillRect(-12 * s, -10 * s, 5 * s, 12 * s);
                ctx.fillRect(-2 * s, -10 * s, 5 * s, 12 * s);
                ctx.fillRect(8 * s, -10 * s, 5 * s, 12 * s);
                ctx.restore();
                break;
            case 'cheering_giraffe':
                ctx.save();
                ctx.translate(0, 0);
                ctx.rotate(wave * 0.15);
                // Body
                ctx.fillStyle = '#e8c040';
                ctx.beginPath();
                ctx.ellipse(0, -25 * s, 12 * s, 10 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Spots
                ctx.fillStyle = '#c0900a';
                ctx.beginPath();
                ctx.arc(-4 * s, -22 * s, 3 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(4 * s, -28 * s, 2.5 * s, 0, Math.PI * 2);
                ctx.fill();
                // Long neck
                ctx.fillStyle = '#e8c040';
                ctx.fillRect(6 * s, -65 * s, 6 * s, 42 * s);
                // Neck spots
                ctx.fillStyle = '#c0900a';
                ctx.beginPath();
                ctx.arc(9 * s, -45 * s, 2 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(9 * s, -55 * s, 2 * s, 0, Math.PI * 2);
                ctx.fill();
                // Head
                ctx.fillStyle = '#e8c040';
                ctx.beginPath();
                ctx.ellipse(9 * s, -68 * s, 6 * s, 5 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Horns
                ctx.fillStyle = '#c0900a';
                ctx.fillRect(6 * s, -76 * s, 2 * s, 8 * s);
                ctx.fillRect(11 * s, -76 * s, 2 * s, 8 * s);
                ctx.fillStyle = '#e8c040';
                ctx.beginPath();
                ctx.arc(7 * s, -76 * s, 2 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(12 * s, -76 * s, 2 * s, 0, Math.PI * 2);
                ctx.fill();
                // Legs
                ctx.fillStyle = '#d4b030';
                ctx.fillRect(-6 * s, -16 * s, 3 * s, 16 * s);
                ctx.fillRect(2 * s, -16 * s, 3 * s, 16 * s);
                ctx.restore();
                break;
            case 'cheering_monkey':
                ctx.save();
                ctx.translate(0, bounce * 1.5);
                // Body
                ctx.fillStyle = '#8a5a30';
                ctx.beginPath();
                ctx.ellipse(0, -18 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Belly
                ctx.fillStyle = '#c8a060';
                ctx.beginPath();
                ctx.ellipse(0, -15 * s, 5 * s, 7 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Head
                ctx.fillStyle = '#8a5a30';
                ctx.beginPath();
                ctx.arc(0, -30 * s, 7 * s, 0, Math.PI * 2);
                ctx.fill();
                // Face
                ctx.fillStyle = '#c8a060';
                ctx.beginPath();
                ctx.ellipse(0, -28 * s, 5 * s, 4 * s, 0, 0, Math.PI * 2);
                ctx.fill();
                // Eyes
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(-2 * s, -31 * s, 1.5 * s, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(2 * s, -31 * s, 1.5 * s, 0, Math.PI * 2);
                ctx.fill();
                // Arms waving!
                ctx.strokeStyle = '#8a5a30';
                ctx.lineWidth = 3 * s;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-7 * s, -20 * s);
                ctx.lineTo(-14 * s, -32 * s + bounce);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(7 * s, -20 * s);
                ctx.lineTo(14 * s, -32 * s - bounce);
                ctx.stroke();
                // Tail curled
                ctx.strokeStyle = '#8a5a30';
                ctx.lineWidth = 2 * s;
                ctx.beginPath();
                ctx.moveTo(-4 * s, -10 * s);
                ctx.quadraticCurveTo(-15 * s, -5 * s, -12 * s, -18 * s);
                ctx.stroke();
                ctx.restore();
                break;
            case 'acacia':
                this.drawSavannaElement(ctx, 'acacia', s);
                break;
            case 'drybush':
                this.drawSavannaElement(ctx, 'drybush', s);
                break;
        }
    }

    drawSkyElement(ctx, type, s) {
        switch (type) {
            case 'mountain':
                ctx.fillStyle = '#6a8a6a';
                ctx.beginPath();
                ctx.moveTo(-60 * s, 0);
                ctx.lineTo(0, -120 * s);
                ctx.lineTo(60 * s, 0);
                ctx.fill();
                // Snow cap
                ctx.fillStyle = '#e8e8f0';
                ctx.beginPath();
                ctx.moveTo(-12 * s, -100 * s);
                ctx.lineTo(0, -120 * s);
                ctx.lineTo(12 * s, -100 * s);
                ctx.fill();
                // Darker side
                ctx.fillStyle = 'rgba(0,0,0,0.1)';
                ctx.beginPath();
                ctx.moveTo(0, -120 * s);
                ctx.lineTo(60 * s, 0);
                ctx.lineTo(0, 0);
                ctx.fill();
                break;
            case 'hill':
                ctx.fillStyle = '#7aaa60';
                ctx.beginPath();
                ctx.arc(0, 10 * s, 50 * s, Math.PI, 0);
                ctx.fill();
                ctx.fillStyle = '#8aba70';
                ctx.beginPath();
                ctx.arc(20 * s, 10 * s, 35 * s, Math.PI, 0);
                ctx.fill();
                break;
            case 'pinetree':
                // Small distant pine tree
                ctx.fillStyle = '#5a3a20';
                ctx.fillRect(-3 * s, -40 * s, 6 * s, 40 * s);
                ctx.fillStyle = '#2a7a30';
                ctx.beginPath();
                ctx.moveTo(-18 * s, -25 * s);
                ctx.lineTo(0, -65 * s);
                ctx.lineTo(18 * s, -25 * s);
                ctx.fill();
                ctx.fillStyle = '#3a8a40';
                ctx.beginPath();
                ctx.moveTo(-14 * s, -35 * s);
                ctx.lineTo(0, -70 * s);
                ctx.lineTo(14 * s, -35 * s);
                ctx.fill();
                break;
        }
    }

    drawGround(ctx, W, H) {
        if (this.worldType === 'cheetah') {
            // Race track ground!
            // Track surface (terracotta)
            ctx.fillStyle = '#c86830';
            ctx.fillRect(0, this.groundY, W, H - this.groundY);

            // Lane lines (white dashes moving)
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 2;
            ctx.setLineDash([20, 15]);
            ctx.lineDashOffset = -this.scrollX;
            for (let lane = 0; lane < 3; lane++) {
                const ly = this.groundY + 20 + lane * 25;
                ctx.beginPath();
                ctx.moveTo(0, ly);
                ctx.lineTo(W, ly);
                ctx.stroke();
            }
            ctx.setLineDash([]);

            // Track edge (white solid line at top)
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, this.groundY, W, 3);

            // Track edge bottom
            ctx.fillStyle = '#a05020';
            ctx.fillRect(0, this.groundY + 85, W, H - this.groundY - 85);
        } else if (this.worldType === 'bird') {
            // Lush green ground far below
            ctx.fillStyle = '#90d060';
            ctx.fillRect(0, this.groundY, W, 12);
            ctx.fillStyle = '#7cba3f';
            ctx.fillRect(0, this.groundY + 12, W, H - this.groundY - 12);
            // Grass tufts
            ctx.fillStyle = '#a0e070';
            for (let i = 0; i < W; i += 25) {
                const offset = (i + this.scrollX * 0.5) % 50;
                ctx.beginPath();
                ctx.moveTo(i - offset - 4, this.groundY);
                ctx.lineTo(i - offset, this.groundY - 6);
                ctx.lineTo(i - offset + 4, this.groundY);
                ctx.fill();
            }
        } else {
            // Grass top
            ctx.fillStyle = this.world.groundTopColor;
            ctx.fillRect(0, this.groundY, W, 15);

            // Dirt
            ctx.fillStyle = this.world.groundColor;
            ctx.fillRect(0, this.groundY + 15, W, H - this.groundY - 15);

            // Ground detail lines
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            for (let i = 0; i < W; i += 30) {
                const offset = (i + this.scrollX * 0.5) % 60;
                ctx.beginPath();
                ctx.moveTo(i - offset, this.groundY + 25);
                ctx.lineTo(i - offset + 15, this.groundY + 25);
                ctx.stroke();
            }
        }
    }

    drawLetters(ctx) {
        for (const l of this.letters) {
            if (l.collected) continue;

            // Bubble - all letters look identical
            ctx.save();
            ctx.shadowColor = 'rgba(100, 180, 255, 0.5)';
            ctx.shadowBlur = 15;

            const bubbleRadius = Math.round(30 * this.scale);
            ctx.beginPath();
            ctx.arc(l.x, l.y, bubbleRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(180, 220, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = '#7ab8e0';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Letter - same style for all
            ctx.font = `bold ${l.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#2c5f8a';
            ctx.fillText(l.letter, l.x, l.y + 2);
        }
    }

    drawPlayer(ctx) {
        const p = this.player;
        ctx.save();
        ctx.translate(p.x + p.width / 2, p.y + p.height);
        ctx.scale(this.scale, this.scale);

        if (this.worldType === 'dino') {
            this.drawDino(ctx, p);
        } else if (this.worldType === 'meerkat') {
            this.drawMeerkat(ctx, p);
        } else if (this.worldType === 'warthog') {
            this.drawWarthog(ctx, p);
        } else if (this.worldType === 'cheetah') {
            this.drawCheetah(ctx, p);
        } else if (this.worldType === 'bird') {
            this.drawBird(ctx, p);
        } else if (this.worldType === 'lion') {
            this.drawLion(ctx, p);
        } else {
            this.drawDog(ctx, p);
        }
        ctx.restore();
    }

    drawDino(ctx, p) {
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.15) * 2 : 0;
        const legPhase = p.grounded ? this.player.frame : 0;
        const lo1 = Math.sin(legPhase * 1.5) * 5;
        const lo2 = Math.sin(legPhase * 1.5 + Math.PI) * 5;

        // Tail (thick, T-rex style, behind body)
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.moveTo(-16, -18 + bobY);
        ctx.quadraticCurveTo(-35, -15 + bobY, -45, -28 + bobY);
        ctx.quadraticCurveTo(-48, -35 + bobY, -42, -38 + bobY);
        ctx.quadraticCurveTo(-35, -32 + bobY, -16, -28 + bobY);
        ctx.fill();
        // Tail tip
        ctx.fillStyle = '#6bb8d4';
        ctx.beginPath();
        ctx.ellipse(-44, -34 + bobY, 6, 4, -0.4, 0, Math.PI * 2);
        ctx.fill();

        // Big back legs (T-rex has powerful legs)
        ctx.fillStyle = '#6bb8d4';
        // Thighs
        ctx.beginPath();
        ctx.ellipse(-6 + lo1, -8, 8, 12, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8 + lo2, -8, 8, 12, -0.1, 0, Math.PI * 2);
        ctx.fill();
        // Shins
        ctx.fillRect(-10 + lo1, -2, 8, 6);
        ctx.fillRect(4 + lo2, -2, 8, 6);
        // Feet with claws
        ctx.fillStyle = '#5a9fb0';
        ctx.beginPath();
        ctx.ellipse(-6 + lo1, 4, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8 + lo2, 4, 9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Toe claws
        ctx.fillStyle = '#eee';
        for (const lx of [-6 + lo1, 8 + lo2]) {
            for (const cx of [-5, 0, 5]) {
                ctx.beginPath();
                ctx.ellipse(lx + cx, 6, 1.5, 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Body (rounder, baby proportions - big head, round body)
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.ellipse(0, -28 + bobY, 20, 22, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // ─── Back spikes ───
        ctx.fillStyle = '#5ab8d4';
        const spikePositions = [
            { x: -14, y: -42 + bobY, h: 8 },
            { x: -10, y: -46 + bobY, h: 10 },
            { x: -5, y: -48 + bobY, h: 12 },
            { x: 0, y: -47 + bobY, h: 10 },
            { x: 5, y: -44 + bobY, h: 8 },
        ];
        for (const sp of spikePositions) {
            ctx.beginPath();
            ctx.moveTo(sp.x - 4, sp.y + 4);
            ctx.lineTo(sp.x, sp.y - sp.h);
            ctx.lineTo(sp.x + 4, sp.y + 4);
            ctx.fill();
        }
        // Spike highlights
        ctx.fillStyle = '#8ad4ef';
        for (const sp of spikePositions) {
            ctx.beginPath();
            ctx.moveTo(sp.x - 1, sp.y + 2);
            ctx.lineTo(sp.x + 1, sp.y - sp.h + 3);
            ctx.lineTo(sp.x + 3, sp.y + 2);
            ctx.fill();
        }

        // Belly
        ctx.fillStyle = '#b8e6f5';
        ctx.beginPath();
        ctx.ellipse(5, -22 + bobY, 12, 16, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // ─── Diaper ───
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, -10 + bobY, 18, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        // Diaper tape/tabs
        ctx.fillStyle = '#8ad4f0';
        ctx.beginPath();
        ctx.ellipse(-12, -14 + bobY, 4, 3, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12, -14 + bobY, 4, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // ─── Short shirt ───
        ctx.fillStyle = '#f0e050';
        // Shirt body
        ctx.beginPath();
        ctx.moveTo(-17, -38 + bobY);
        ctx.quadraticCurveTo(-19, -28 + bobY, -17, -18 + bobY);
        ctx.lineTo(17, -18 + bobY);
        ctx.quadraticCurveTo(19, -28 + bobY, 17, -38 + bobY);
        ctx.quadraticCurveTo(0, -42 + bobY, -17, -38 + bobY);
        ctx.fill();
        // Shirt collar
        ctx.fillStyle = '#e0d040';
        ctx.beginPath();
        ctx.ellipse(0, -38 + bobY, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Bone icon on shirt
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.roundRect(-8, -32 + bobY, 16, 4, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-8, -32 + bobY, 3, 0, Math.PI * 2);
        ctx.arc(-8, -28 + bobY, 3, 0, Math.PI * 2);
        ctx.arc(8, -32 + bobY, 3, 0, Math.PI * 2);
        ctx.arc(8, -28 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Big head (baby T-rex has oversized head)
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.ellipse(16, -48 + bobY, 20, 18, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Snout / jaw (T-rex shape)
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.ellipse(30, -42 + bobY, 12, 10, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Lower jaw
        ctx.fillStyle = '#6bb8d4';
        ctx.beginPath();
        ctx.ellipse(28, -37 + bobY, 10, 5, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Cute closed-mouth smile
        ctx.strokeStyle = '#4a8a9a';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(30, -42 + bobY, 8, 0.15, Math.PI * 0.6);
        ctx.stroke();
        // One tiny tooth peeking out
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(35, -39 + bobY);
        ctx.lineTo(36, -37 + bobY);
        ctx.lineTo(37, -39 + bobY);
        ctx.fill();

        // Nostril
        ctx.fillStyle = '#5a9fb0';
        ctx.beginPath();
        ctx.ellipse(38, -46 + bobY, 2, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Big cute eyes (baby style - oversized)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(20, -54 + bobY, 8, 0, Math.PI * 2);
        ctx.fill();
        // Iris
        ctx.fillStyle = '#3a7a40';
        ctx.beginPath();
        ctx.arc(22, -54 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(23, -54 + bobY, 2.8, 0, Math.PI * 2);
        ctx.fill();
        // Eye shine (big, cute sparkle)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(25, -56 + bobY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(21, -52 + bobY, 1, 0, Math.PI * 2);
        ctx.fill();

        // Brow ridge (raised, happy expression)
        ctx.fillStyle = '#6bb8d4';
        ctx.beginPath();
        ctx.ellipse(18, -63 + bobY, 10, 3, 0.15, 0, Math.PI);
        ctx.fill();

        // Rosy cheeks (both sides, girlish)
        ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
        ctx.beginPath();
        ctx.ellipse(14, -46 + bobY, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(34, -44 + bobY, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyelashes (cute girl dino!)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        // Top lashes
        ctx.beginPath();
        ctx.moveTo(16, -60 + bobY);
        ctx.lineTo(14, -64 + bobY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(20, -61 + bobY);
        ctx.lineTo(20, -65 + bobY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(24, -60 + bobY);
        ctx.lineTo(26, -64 + bobY);
        ctx.stroke();

        // Pink bow on head!
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.ellipse(4, -68 + bobY, 10, 7, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(16, -70 + bobY, 10, 7, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Bow center
        ctx.fillStyle = '#e0508a';
        ctx.beginPath();
        ctx.arc(10, -69 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();
        // Bow tails
        ctx.fillStyle = '#ff69b4';
        ctx.beginPath();
        ctx.moveTo(8, -66 + bobY);
        ctx.quadraticCurveTo(2, -58 + bobY, 0, -55 + bobY);
        ctx.lineTo(5, -58 + bobY);
        ctx.quadraticCurveTo(6, -64 + bobY, 8, -66 + bobY);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(12, -66 + bobY);
        ctx.quadraticCurveTo(18, -58 + bobY, 20, -55 + bobY);
        ctx.lineTo(15, -58 + bobY);
        ctx.quadraticCurveTo(14, -64 + bobY, 12, -66 + bobY);
        ctx.fill();

        // Tiny T-rex arms (iconic!)
        const armWave = Math.sin(this.frameCount * 0.12) * 0.2;
        ctx.fillStyle = '#6bb8d4';
        // Left arm
        ctx.save();
        ctx.translate(14, -28 + bobY);
        ctx.rotate(0.4 + armWave);
        ctx.beginPath();
        ctx.ellipse(5, 2, 3, 7, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Tiny hand with 2 claws
        ctx.fillStyle = '#5a9fb0';
        ctx.beginPath();
        ctx.arc(8, 7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.ellipse(9, 10, 1, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(6, 10, 1, 2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Right arm (slightly behind)
        ctx.save();
        ctx.translate(10, -26 + bobY);
        ctx.rotate(0.6 - armWave);
        ctx.fillStyle = '#6bb8d4';
        ctx.beginPath();
        ctx.ellipse(4, 2, 2.5, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a9fb0';
        ctx.beginPath();
        ctx.arc(6, 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Back ridges (small baby bumps along the back)
        ctx.fillStyle = '#5cb3d0';
        const ridgePoints = [
            { x: -12, y: -46 }, { x: -6, y: -49 }, { x: 0, y: -48 },
        ];
        for (const rp of ridgePoints) {
            ctx.beginPath();
            ctx.moveTo(rp.x - 3, rp.y + bobY + 2);
            ctx.lineTo(rp.x, rp.y + bobY - 5);
            ctx.lineTo(rp.x + 3, rp.y + bobY + 2);
            ctx.fill();
        }
    }

    drawDog(ctx, p) {
        const s = 1;
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.15) * 2 : 0;

        // Body
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.ellipse(0, -25 + bobY, 24 * s, 20 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#b8e6f5';
        ctx.beginPath();
        ctx.ellipse(2, -20 + bobY, 16 * s, 12 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Collar
        ctx.fillStyle = '#e03030';
        ctx.beginPath();
        ctx.ellipse(10, -36 + bobY, 14, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Collar tag
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(12, -31 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e0b800';
        ctx.beginPath();
        ctx.arc(12, -31 + bobY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.arc(18, -44 + bobY, 16, 0, Math.PI * 2);
        ctx.fill();

        // Ears (floppy!)
        ctx.fillStyle = '#5cb3d0';
        ctx.beginPath();
        ctx.ellipse(8, -52 + bobY, 8, 14, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(28, -52 + bobY, 8, 14, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#b8e6f5';
        ctx.beginPath();
        ctx.ellipse(26, -40 + bobY, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(32, -42 + bobY, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(16, -48 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(24, -48 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(17, -48 + bobY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(25, -48 + bobY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(18, -49 + bobY, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(26, -49 + bobY, 1, 0, Math.PI * 2);
        ctx.fill();

        // Mouth / smile
        ctx.strokeStyle = '#5a9fb0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(26, -38 + bobY, 4, 0.2, Math.PI * 0.8);
        ctx.stroke();

        // Tongue (when jumping)
        if (p.jumping) {
            ctx.fillStyle = '#ff7f9f';
            ctx.beginPath();
            ctx.ellipse(30, -34 + bobY, 3, 6, 0.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tail (wagging!)
        ctx.fillStyle = '#7ec8e3';
        const tailWag = Math.sin(this.frameCount * 0.2) * 0.5;
        ctx.save();
        ctx.translate(-22, -30 + bobY);
        ctx.rotate(-0.8 + tailWag);
        ctx.beginPath();
        ctx.ellipse(0, -12, 4, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Legs
        const legPhase = p.grounded ? this.player.frame : 0;
        const lo1 = Math.sin(legPhase * 1.5) * 6;
        const lo2 = Math.sin(legPhase * 1.5 + Math.PI) * 6;

        ctx.fillStyle = '#6bb8d4';
        ctx.fillRect(-14 + lo1, -7, 9, 10);
        ctx.fillRect(-2 + lo2, -7, 9, 10);
        ctx.fillRect(8 + lo1, -7, 9, 10);
        ctx.fillRect(18 + lo2, -7, 9, 10);

        // Paws
        ctx.fillStyle = '#b8e6f5';
        ctx.beginPath();
        ctx.ellipse(-10 + lo1, 3, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(3 + lo2, 3, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(12 + lo1, 3, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(22 + lo2, 3, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMeerkat(ctx, p) {
        const s = 1;
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.15) * 2 : 0;

        // Meerkats stand upright — tall slim body
        // Body
        ctx.fillStyle = '#c8a060';
        ctx.beginPath();
        ctx.ellipse(0, -35 + bobY, 14 * s, 28 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly (lighter)
        ctx.fillStyle = '#e8d0a0';
        ctx.beginPath();
        ctx.ellipse(3, -30 + bobY, 9 * s, 20 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#c8a060';
        ctx.beginPath();
        ctx.ellipse(2, -62 + bobY, 12 * s, 11 * s, 0.1, 0, Math.PI * 2);
        ctx.fill();

        // Dark eye patches (iconic meerkat look)
        ctx.fillStyle = '#4a3520';
        ctx.beginPath();
        ctx.ellipse(-2, -64 + bobY, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8, -64 + bobY, 7, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (bright, alert)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-1, -65 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -65 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, -65 + bobY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(9, -65 + bobY, 2, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(1, -66 + bobY, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -66 + bobY, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(5, -58 + bobY, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears (small, round)
        ctx.fillStyle = '#b89050';
        ctx.beginPath();
        ctx.arc(-6, -70 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, -70 + bobY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#8a6040';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(5, -56 + bobY, 4, 0.2, Math.PI * 0.8);
        ctx.stroke();

        // Arms (held up when jumping — alert pose!)
        ctx.fillStyle = '#b89050';
        if (p.jumping) {
            // Arms up! Alert meerkat pose
            ctx.save();
            ctx.translate(-10, -40 + bobY);
            ctx.rotate(-0.5);
            ctx.fillRect(0, -12, 6, 14);
            ctx.restore();
            ctx.save();
            ctx.translate(10, -40 + bobY);
            ctx.rotate(0.5);
            ctx.fillRect(0, -12, 6, 14);
            ctx.restore();
        } else {
            // Arms down at sides
            ctx.fillRect(-14, -35 + bobY, 6, 16);
            ctx.fillRect(12, -35 + bobY, 6, 16);
        }

        // Tail (thin, slightly curved)
        ctx.fillStyle = '#a08040';
        ctx.save();
        ctx.translate(-10, -12 + bobY);
        ctx.rotate(-0.3);
        ctx.beginPath();
        ctx.ellipse(0, -10, 3, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Legs
        const legPhase = p.grounded ? this.player.frame : 0;
        const lo1 = Math.sin(legPhase * 1.5) * 4;
        const lo2 = Math.sin(legPhase * 1.5 + Math.PI) * 4;

        ctx.fillStyle = '#b89050';
        ctx.fillRect(-8 + lo1, -7, 8, 10);
        ctx.fillRect(4 + lo2, -7, 8, 10);

        // Feet
        ctx.fillStyle = '#a08040';
        ctx.beginPath();
        ctx.ellipse(-4 + lo1, 3, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8 + lo2, 3, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawWarthog(ctx, p) {
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.15) * 2 : 0;
        const legPhase = p.grounded ? this.player.frame : 0;
        const lo1 = Math.sin(legPhase * 1.5) * 5;
        const lo2 = Math.sin(legPhase * 1.5 + Math.PI) * 5;

        // Tail (thin, curly, up in the air like Pumba running)
        ctx.strokeStyle = '#8a5030';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-20, -25 + bobY);
        ctx.quadraticCurveTo(-35, -35 + bobY, -30, -50 + bobY);
        ctx.stroke();
        // Tail tuft
        ctx.fillStyle = '#4a2a10';
        ctx.beginPath();
        ctx.ellipse(-30, -52 + bobY, 4, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Back legs (strong)
        ctx.fillStyle = '#8a5030';
        ctx.fillRect(-12 + lo1, -8, 10, 12);
        ctx.fillRect(6 + lo2, -8, 10, 12);
        // White gloves on back legs
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-7 + lo1, 3, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(11 + lo2, 3, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (round, Pumba-style big belly)
        ctx.fillStyle = '#a06030';
        ctx.beginPath();
        ctx.ellipse(0, -25 + bobY, 24, 22, 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Belly (lighter, big round Pumba belly)
        ctx.fillStyle = '#c8956a';
        ctx.beginPath();
        ctx.ellipse(3, -18 + bobY, 16, 14, 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Front legs
        ctx.fillStyle = '#8a5030';
        ctx.fillRect(12 + lo2, -8, 9, 12);
        ctx.fillRect(24 + lo1, -8, 9, 12);
        // White gloves on front legs
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(16 + lo2, 3, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(28 + lo1, 3, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head (big, long snout - Pumba style)
        ctx.fillStyle = '#a06030';
        ctx.beginPath();
        ctx.ellipse(22, -40 + bobY, 16, 15, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Long snout
        ctx.fillStyle = '#b07040';
        ctx.beginPath();
        ctx.ellipse(38, -36 + bobY, 13, 9, 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Snout disc (flat pig nose)
        ctx.fillStyle = '#c08050';
        ctx.beginPath();
        ctx.ellipse(48, -36 + bobY, 7, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Nostrils
        ctx.fillStyle = '#6a3820';
        ctx.beginPath();
        ctx.ellipse(46, -37 + bobY, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(50, -37 + bobY, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tusks (curved upward, iconic Pumba feature!)
        ctx.fillStyle = '#f5f0e0';
        ctx.strokeStyle = '#d0c8a0';
        ctx.lineWidth = 1;
        // Left tusk
        ctx.beginPath();
        ctx.moveTo(42, -38 + bobY);
        ctx.quadraticCurveTo(44, -48 + bobY, 40, -52 + bobY);
        ctx.quadraticCurveTo(38, -48 + bobY, 40, -38 + bobY);
        ctx.fill();
        ctx.stroke();
        // Right tusk
        ctx.beginPath();
        ctx.moveTo(48, -38 + bobY);
        ctx.quadraticCurveTo(52, -48 + bobY, 50, -52 + bobY);
        ctx.quadraticCurveTo(47, -48 + bobY, 46, -38 + bobY);
        ctx.fill();
        ctx.stroke();

        // Warts (Pumba's iconic warts!)
        ctx.fillStyle = '#8a4828';
        ctx.beginPath();
        ctx.arc(30, -42 + bobY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(26, -36 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (big, friendly like Pumba)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(18, -44 + bobY, 7, 0, Math.PI * 2);
        ctx.fill();
        // Iris
        ctx.fillStyle = '#5a3a20';
        ctx.beginPath();
        ctx.arc(20, -44 + bobY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(21, -44 + bobY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(22, -46 + bobY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Ears (big, floppy Pumba ears)
        ctx.fillStyle = '#a06030';
        ctx.beginPath();
        ctx.ellipse(10, -52 + bobY, 8, 12, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c08860';
        ctx.beginPath();
        ctx.ellipse(10, -52 + bobY, 5, 8, -0.5, 0, Math.PI * 2);
        ctx.fill();

        // Mane (dark hair along the back - Pumba's mohawk!)
        ctx.fillStyle = '#4a2a10';
        for (let i = 0; i < 8; i++) {
            const mx = -15 + i * 5;
            const my = -44 + (i < 3 ? -i * 2 : (i - 3) * 1.5);
            ctx.beginPath();
            ctx.moveTo(mx - 2, my + bobY + 5);
            ctx.lineTo(mx, my + bobY - 4);
            ctx.lineTo(mx + 2, my + bobY + 5);
            ctx.fill();
        }

        // Friendly smile
        ctx.strokeStyle = '#6a3820';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(42, -32 + bobY, 6, 0.1, Math.PI * 0.7);
        ctx.stroke();

        // Rosy cheek
        ctx.fillStyle = 'rgba(255, 150, 130, 0.3)';
        ctx.beginPath();
        ctx.ellipse(34, -32 + bobY, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawCheetah(ctx, p) {
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.15) * 2 : 0;
        const legPhase = p.grounded ? this.player.frame : 0;
        const lo1 = Math.sin(legPhase * 1.5) * 7;
        const lo2 = Math.sin(legPhase * 1.5 + Math.PI) * 7;

        // Long tail (cheetah's balancing tail)
        ctx.strokeStyle = '#d4a030';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-20, -22 + bobY);
        ctx.quadraticCurveTo(-38, -18 + bobY, -48, -30 + bobY);
        ctx.quadraticCurveTo(-52, -38 + bobY, -45, -42 + bobY);
        ctx.stroke();
        // Tail tip (dark)
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-48, -38 + bobY);
        ctx.quadraticCurveTo(-50, -42 + bobY, -45, -42 + bobY);
        ctx.stroke();

        // Back legs (connected to body with thigh, knee, lower leg)
        for (const [lx, lo] of [[-10, lo1], [0, lo2]]) {
            ctx.fillStyle = '#d4a030';
            // Thigh (connected to body)
            ctx.beginPath();
            ctx.ellipse(lx, -14 + bobY, 7, 10, 0.1, 0, Math.PI * 2);
            ctx.fill();
            // Lower leg
            ctx.fillStyle = '#c89828';
            ctx.beginPath();
            ctx.moveTo(lx - 3 + lo, -8);
            ctx.lineTo(lx - 4 + lo, 0);
            ctx.lineTo(lx + 4 + lo, 0);
            ctx.lineTo(lx + 3 + lo, -8);
            ctx.fill();
            // Paw
            ctx.fillStyle = '#d4a030';
            ctx.beginPath();
            ctx.ellipse(lx + lo, 1, 6, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Claws
            ctx.fillStyle = '#eee';
            for (const cx of [-4, 0, 4]) {
                ctx.beginPath();
                ctx.moveTo(lx + lo + cx - 1, 2);
                ctx.lineTo(lx + lo + cx, 5);
                ctx.lineTo(lx + lo + cx + 1, 2);
                ctx.fill();
            }
        }

        // Body (sleek, athletic)
        ctx.fillStyle = '#e8b840';
        ctx.beginPath();
        ctx.ellipse(2, -24 + bobY, 22, 16, 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Belly (lighter)
        ctx.fillStyle = '#f5e0a0';
        ctx.beginPath();
        ctx.ellipse(4, -18 + bobY, 14, 10, 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Spots on body
        ctx.fillStyle = '#333';
        const spots = [
            [-8, -30], [-2, -32], [5, -30], [10, -28],
            [-10, -22], [0, -25], [8, -24], [14, -22],
            [-5, -16], [4, -14], [12, -18],
        ];
        for (const [sx, sy] of spots) {
            ctx.beginPath();
            ctx.arc(sx, sy + bobY, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Front legs (connected to body with shoulder)
        for (const [lx, lo] of [[16, lo2], [26, lo1]]) {
            ctx.fillStyle = '#d4a030';
            // Shoulder
            ctx.beginPath();
            ctx.ellipse(lx, -16 + bobY, 6, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            // Lower leg
            ctx.fillStyle = '#c89828';
            ctx.beginPath();
            ctx.moveTo(lx - 3 + lo, -10);
            ctx.lineTo(lx - 4 + lo, 0);
            ctx.lineTo(lx + 4 + lo, 0);
            ctx.lineTo(lx + 3 + lo, -10);
            ctx.fill();
            // Paw
            ctx.fillStyle = '#d4a030';
            ctx.beginPath();
            ctx.ellipse(lx + lo, 1, 6, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Claws
            ctx.fillStyle = '#eee';
            for (const cx of [-4, 0, 4]) {
                ctx.beginPath();
                ctx.moveTo(lx + lo + cx - 1, 2);
                ctx.lineTo(lx + lo + cx, 5);
                ctx.lineTo(lx + lo + cx + 1, 2);
                ctx.fill();
            }
        }

        // Head (small, round - cheetah proportions)
        ctx.fillStyle = '#e8b840';
        ctx.beginPath();
        ctx.arc(26, -40 + bobY, 13, 0, Math.PI * 2);
        ctx.fill();

        // Muzzle
        ctx.fillStyle = '#f5e0a0';
        ctx.beginPath();
        ctx.ellipse(34, -37 + bobY, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.ellipse(39, -38 + bobY, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tear marks (iconic cheetah feature!)
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        // Left tear mark
        ctx.beginPath();
        ctx.moveTo(21, -42 + bobY);
        ctx.quadraticCurveTo(20, -36 + bobY, 22, -30 + bobY);
        ctx.stroke();
        // Right tear mark
        ctx.beginPath();
        ctx.moveTo(29, -42 + bobY);
        ctx.quadraticCurveTo(30, -36 + bobY, 32, -30 + bobY);
        ctx.stroke();

        // Eyes (alert, focused)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(22, -44 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(30, -44 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        // Iris (amber)
        ctx.fillStyle = '#c88020';
        ctx.beginPath();
        ctx.arc(23, -44 + bobY, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(31, -44 + bobY, 3.2, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(24, -44 + bobY, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(32, -44 + bobY, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(24.5, -45.5 + bobY, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(32.5, -45.5 + bobY, 1, 0, Math.PI * 2);
        ctx.fill();

        // Ears (small, round)
        ctx.fillStyle = '#d4a030';
        ctx.beginPath();
        ctx.arc(18, -51 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(32, -51 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        // Inner ear
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(18, -51 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(32, -51 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Spots on head
        ctx.fillStyle = '#333';
        for (const [sx, sy] of [[16, -40], [34, -40], [24, -35]]) {
            ctx.beginPath();
            ctx.arc(sx, sy + bobY, 1.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Smile
        ctx.strokeStyle = '#a08020';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(35, -35 + bobY, 4, 0.1, Math.PI * 0.7);
        ctx.stroke();
    }

    drawBird(ctx, p) {
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.1) * 4 : 0;
        const diving = !p.grounded && p.vy > 0;
        const rising = !p.grounded && p.vy < 0;

        const flapSpeed = diving ? 0.5 : 0.15;
        const wingAngle = Math.sin(this.frameCount * flapSpeed) * 0.7;
        const bodyTilt = diving ? 0.3 : (rising ? -0.2 : 0);

        ctx.save();
        ctx.rotate(bodyTilt);

        // Tail feathers
        ctx.fillStyle = '#5aa8c8';
        ctx.save();
        ctx.translate(-18, -30 + bobY);
        ctx.rotate(0.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a98b8';
        ctx.beginPath();
        ctx.ellipse(-2, -4, 12, 4, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Body
        ctx.fillStyle = '#7ec8e3';
        ctx.beginPath();
        ctx.ellipse(0, -32 + bobY, 22, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#c8ecf8';
        ctx.beginPath();
        ctx.ellipse(2, -28 + bobY, 14, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // ─── Baby diaper ───
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, -20 + bobY, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Diaper tape/tabs
        ctx.fillStyle = '#8ad4f0';
        ctx.beginPath();
        ctx.ellipse(-10, -23 + bobY, 3.5, 2.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, -23 + bobY, 3.5, 2.5, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Left wing
        ctx.save();
        ctx.translate(-6, -38 + bobY);
        ctx.rotate(-wingAngle - 0.3);
        ctx.fillStyle = '#5ab8d8';
        ctx.beginPath();
        ctx.ellipse(-10, 0, 20, 8, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4aa8c8';
        ctx.beginPath();
        ctx.ellipse(-14, -2, 14, 5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Right wing
        ctx.save();
        ctx.translate(-6, -26 + bobY);
        ctx.rotate(wingAngle + 0.3);
        ctx.fillStyle = '#5ab8d8';
        ctx.beginPath();
        ctx.ellipse(-10, 0, 18, 7, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Head
        ctx.fillStyle = '#8ad4ef';
        ctx.beginPath();
        ctx.arc(18, -44 + bobY, 13, 0, Math.PI * 2);
        ctx.fill();

        // Cheek blush
        ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
        ctx.beginPath();
        ctx.ellipse(14, -38 + bobY, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(22, -46 + bobY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Eye highlight
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(23.5, -47.5 + bobY, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#ff9933';
        ctx.beginPath();
        ctx.moveTo(29, -45 + bobY);
        ctx.lineTo(39, -42 + bobY);
        ctx.lineTo(29, -40 + bobY);
        ctx.fill();
        // Beak line
        ctx.strokeStyle = '#e07720';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(29, -42.5 + bobY);
        ctx.lineTo(37, -42 + bobY);
        ctx.stroke();

        // Small crest/tuft on head
        ctx.fillStyle = '#5ab8d8';
        ctx.save();
        ctx.translate(16, -56 + bobY);
        ctx.rotate(-0.3);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tucked feet
        ctx.strokeStyle = '#ff9933';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        if (!diving) {
            ctx.beginPath();
            ctx.moveTo(-4, -18 + bobY);
            ctx.lineTo(-6, -12 + bobY);
            ctx.lineTo(-10, -10 + bobY);
            ctx.moveTo(-6, -12 + bobY);
            ctx.lineTo(-4, -10 + bobY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(6, -18 + bobY);
            ctx.lineTo(8, -12 + bobY);
            ctx.lineTo(12, -10 + bobY);
            ctx.moveTo(8, -12 + bobY);
            ctx.lineTo(6, -10 + bobY);
            ctx.stroke();
        } else {
            // Feet tucked back during dive
            ctx.beginPath();
            ctx.moveTo(-2, -18 + bobY);
            ctx.lineTo(-8, -16 + bobY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(4, -18 + bobY);
            ctx.lineTo(-2, -16 + bobY);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawLion(ctx, p) {
        const bobY = p.grounded ? Math.sin(this.frameCount * 0.15) * 2 : 0;
        const legPhase = p.grounded ? this.player.frame : 0;
        const lo1 = Math.sin(legPhase * 1.5) * 5;
        const lo2 = Math.sin(legPhase * 1.5 + Math.PI) * 5;
        const tailWag = Math.sin(this.frameCount * 0.1) * 0.4;

        // Tail with tuft
        ctx.strokeStyle = '#c89030';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-14, -22 + bobY);
        ctx.quadraticCurveTo(-30, -18 + bobY, -38, -30 + bobY + Math.sin(this.frameCount * 0.1) * 5);
        ctx.stroke();
        // Tuft
        ctx.fillStyle = '#8a5a20';
        ctx.beginPath();
        ctx.arc(-38, -30 + bobY + Math.sin(this.frameCount * 0.1) * 5, 5, 0, Math.PI * 2);
        ctx.fill();

        // Back legs
        ctx.fillStyle = '#d4a040';
        ctx.fillRect(-10 + lo1, -8, 9, 14);
        ctx.fillRect(4 + lo2, -8, 9, 14);
        // Paws
        ctx.fillStyle = '#c09030';
        ctx.beginPath();
        ctx.ellipse(-6 + lo1, 5, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(8 + lo2, 5, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#e8b840';
        ctx.beginPath();
        ctx.ellipse(0, -26 + bobY, 22, 18, 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#f5d880';
        ctx.beginPath();
        ctx.ellipse(4, -20 + bobY, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // ─── Mane (big fluffy circle behind head) ───
        ctx.fillStyle = '#b07020';
        ctx.beginPath();
        ctx.arc(12, -48 + bobY, 22, 0, Math.PI * 2);
        ctx.fill();
        // Mane detail - lighter inner
        ctx.fillStyle = '#c08028';
        ctx.beginPath();
        ctx.arc(12, -48 + bobY, 17, 0, Math.PI * 2);
        ctx.fill();
        // Mane spikes around edge
        ctx.fillStyle = '#a06018';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const sx = 12 + Math.cos(angle) * 20;
            const sy = -48 + bobY + Math.sin(angle) * 20;
            ctx.beginPath();
            ctx.ellipse(sx, sy, 6, 4, angle, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head
        ctx.fillStyle = '#e8b840';
        ctx.beginPath();
        ctx.arc(12, -48 + bobY, 14, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.fillStyle = '#d4a040';
        ctx.beginPath();
        ctx.arc(2, -60 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(22, -60 + bobY, 5, 0, Math.PI * 2);
        ctx.fill();
        // Inner ear
        ctx.fillStyle = '#f0c8a0';
        ctx.beginPath();
        ctx.arc(2, -60 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(22, -60 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.fillStyle = '#f0d070';
        ctx.beginPath();
        ctx.ellipse(18, -43 + bobY, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#6a4020';
        ctx.beginPath();
        ctx.ellipse(22, -45 + bobY, 3.5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(8, -52 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(18, -52 + bobY, 3, 0, Math.PI * 2);
        ctx.fill();
        // Highlights
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(9, -53 + bobY, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(19, -53 + bobY, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#8a5a20';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(14, -43 + bobY, 5, 0.1, Math.PI * 0.7);
        ctx.stroke();

        // Whiskers
        ctx.strokeStyle = '#d4a040';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, -44 + bobY);
        ctx.lineTo(34, -46 + bobY);
        ctx.moveTo(24, -42 + bobY);
        ctx.lineTo(34, -42 + bobY);
        ctx.moveTo(24, -40 + bobY);
        ctx.lineTo(34, -38 + bobY);
        ctx.stroke();

        // ─── Crown ───
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(2, -64 + bobY);
        ctx.lineTo(4, -76 + bobY);
        ctx.lineTo(8, -68 + bobY);
        ctx.lineTo(12, -80 + bobY);
        ctx.lineTo(16, -68 + bobY);
        ctx.lineTo(20, -76 + bobY);
        ctx.lineTo(22, -64 + bobY);
        ctx.closePath();
        ctx.fill();
        // Crown base band
        ctx.fillStyle = '#e8b800';
        ctx.fillRect(2, -66 + bobY, 20, 4);
        // Gems
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(7, -64 + bobY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3498db';
        ctx.beginPath();
        ctx.arc(12, -64 + bobY, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(17, -64 + bobY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Front legs
        ctx.fillStyle = '#d4a040';
        ctx.fillRect(12 + lo2, -8, 8, 12);
        ctx.fillRect(22 + lo1, -8, 8, 12);
        ctx.fillStyle = '#c09030';
        ctx.beginPath();
        ctx.ellipse(16 + lo2, 4, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(26 + lo1, 4, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawParticles(ctx) {
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawHUD(ctx, W) {
        const s = this.scale;

        // Lives as bones - top right
        const boneStartX = W - Math.round(30 * s);
        for (let i = 0; i < MAX_LIVES; i++) {
            const bx = boneStartX - i * Math.round(38 * s);
            const by = Math.round(24 * s);
            if (i < this.lives) {
                this.drawBone(ctx, bx, by, 1, s);
            } else {
                this.drawBone(ctx, bx, by, 0.3, s);
            }
        }

        // Current target - top center
        const isMath = this.gameMode === 'math';
        const targetW = Math.round((isMath ? 150 : 120) * s);
        const targetH = Math.round(50 * s);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, W / 2 - targetW / 2, Math.round(8 * s), targetW, targetH, Math.round(12 * s));
        ctx.fill();

        ctx.font = `bold ${Math.round(14 * s)}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(isMath ? 'כמה זה?' : 'תפסו את?', W / 2, Math.round(26 * s));

        ctx.font = `bold ${Math.round(26 * s)}px Arial`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText(isMath ? this.currentExercise.text : this.currentLetter, W / 2, Math.round(52 * s));

        // Score - top left
        const scoreW = Math.round(110 * s);
        const scoreH = Math.round(50 * s);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, Math.round(8 * s), Math.round(8 * s), scoreW, scoreH, Math.round(12 * s));
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.font = `bold ${Math.round(12 * s)}px Arial`;
        ctx.fillStyle = '#aaa';
        ctx.fillText('נקודות', Math.round(65 * s), Math.round(24 * s));

        ctx.font = `bold ${Math.round(22 * s)}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.fillText(`${this.score} / ${POINTS_TO_PASS}`, Math.round(16 * s), Math.round(48 * s));

        // Level indicator
        ctx.font = `${Math.round(11 * s)}px Arial`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        if (isMath) {
            ctx.fillText(`תרגיל ${this.exerciseCount + 1} מתוך ${this.totalExercises}`, W / 2, Math.round(72 * s));
        } else {
            ctx.fillText(`אות ${this.currentLetterIndex + 1} מתוך ${HEBREW_LETTERS.length}`, W / 2, Math.round(72 * s));
        }

        // Score bar
        const barW = Math.round(100 * s);
        const barH = Math.round(5 * s);
        const barX = Math.round(13 * s);
        const barY = Math.round(55 * s);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        roundRect(ctx, barX, barY, barW, barH, 3);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        const progress = Math.min(this.score / POINTS_TO_PASS, 1);
        roundRect(ctx, barX, barY, barW * progress, barH, 3);
        ctx.fill();
    }

    drawBone(ctx, x, y, alpha, s = 1) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f5f5dc';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;

        const sw = 12 * s, sh = 3 * s, r = 3 * s, er = 4 * s;

        // Bone shaft
        ctx.beginPath();
        ctx.roundRect(x - sw, y - sh, sw * 2, sh * 2, r);
        ctx.fill();
        ctx.stroke();

        // Bone ends
        for (const dir of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(x + sw * dir, y - er, er, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x + sw * dir, y + er, er, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    // ─── Game Loop ──────────────────────────────────────────
    tick() {
        if (!this.running) return;
        const now = performance.now();
        let elapsed = now - this.lastTime;
        this.lastTime = now;

        // Cap elapsed to avoid spiral of death after tab switch
        if (elapsed > 200) elapsed = 200;

        this.accumulator += elapsed;

        while (this.accumulator >= this.fixedDt) {
            this.update();
            this.accumulator -= this.fixedDt;
        }

        this.draw();
        this._rafId = requestAnimationFrame(() => this.tick());
    }

    startLoop() {
        this.lastTime = performance.now();
        this.tick();
        // Fallback for hidden/headless tabs where rAF is throttled
        this._intervalId = setInterval(() => {
            if (!this.running) return;
            const now = performance.now();
            let elapsed = now - this.lastTime;
            this.lastTime = now;
            if (elapsed > 200) elapsed = 200;
            this.accumulator += elapsed;
            while (this.accumulator >= this.fixedDt) {
                this.update();
                this.accumulator -= this.fixedDt;
            }
            this.draw();
        }, 16);
    }

    stopLoop() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this._intervalId) clearInterval(this._intervalId);
    }
}

// ─── Utility ────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─── Navigation ─────────────────────────────────────────────
var pendingWorld = null;
var gameMode = 'letters';

function chooseWorld(worldType) {
    pendingWorld = worldType;
    document.getElementById('difficulty-screen').classList.remove('hidden');
}

function selectDifficulty(level) {
    if (level === 'fast') POINTS_TO_PASS = 6;
    else if (level === 'easy') POINTS_TO_PASS = 10;
    else if (level === 'medium') POINTS_TO_PASS = 20;
    else POINTS_TO_PASS = 40;

    document.getElementById('difficulty-screen').classList.add('hidden');
    document.getElementById('mode-screen').classList.remove('hidden');
}

function selectMode(mode) {
    gameMode = mode;
    document.getElementById('mode-screen').classList.add('hidden');
    startGame(pendingWorld);
}

function cancelMode() {
    document.getElementById('mode-screen').classList.add('hidden');
    document.getElementById('difficulty-screen').classList.remove('hidden');
}

function cancelDifficulty() {
    document.getElementById('difficulty-screen').classList.add('hidden');
    pendingWorld = null;
}

function startGame(worldType) {
    document.getElementById('home-screen').style.display = 'none';
    const canvas = document.getElementById('game-canvas');
    canvas.style.display = 'block';
    document.getElementById('mute-btn').classList.remove('hidden');
    document.getElementById('home-btn').classList.remove('hidden');
    document.getElementById('narration-btn').classList.remove('hidden');
    document.getElementById('pause-btn').classList.remove('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    if (game) game.destroy();
    game = new Game(worldType);

    // Start audio (needs user gesture - the click on the world card counts)
    gameAudio.init();
    gameAudio.resume();
    gameAudio.startBgMusic(worldType);
}

function goHome() {
    if (game) {
        game.destroy();
        game = null;
    }
    gameAudio.stopBgMusic();
    stopVictoryDance();
    stopGiftAnimation();
    document.getElementById('game-canvas').style.display = 'none';
    document.getElementById('mute-btn').classList.add('hidden');
    document.getElementById('home-btn').classList.add('hidden');
    document.getElementById('narration-btn').classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
    document.getElementById('difficulty-screen').classList.add('hidden');
    document.getElementById('mode-screen').classList.add('hidden');
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('level-complete-overlay').classList.add('hidden');
    document.getElementById('game-over-overlay').classList.add('hidden');
    document.getElementById('win-overlay').classList.add('hidden');
    document.getElementById('home-screen').style.display = 'flex';
}

function toggleMute() {
    const on = gameAudio.toggle();
    document.getElementById('mute-btn').textContent = on ? '🔊' : '🔇';
}

function togglePause() {
    if (!game) return;
    game.paused = !game.paused;
    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseBtn = document.getElementById('pause-btn');
    if (game.paused) {
        pauseOverlay.classList.remove('hidden');
        pauseBtn.textContent = '▶️';
    } else {
        pauseOverlay.classList.add('hidden');
        pauseBtn.textContent = '⏸️';
        // Reset time tracking so we don't get a huge delta after unpause
        game.lastTime = performance.now();
        game.accumulator = 0;
    }
}

// ─── Draw meerkat on home screen card ───────────────────────
function drawCardBackground(ctx, worldType) {
    const W = 120, H = 120;
    // Ground line varies per world
    const gy = worldType === 'bird' ? 105 : 95;

    // Fill sky based on world theme
    const skyMap = {
        dino: ['#87CEEB', '#c8e6f0'],
        dog: ['#87CEEB', '#e0f0ff'],
        meerkat: ['#f0c27f', '#fce38a'],
        warthog: ['#1a4a20', '#4a9a50'],
        cheetah: ['#e8a040', '#f5d080'],
        bird: ['#87CEEB', '#d0eaff'],
    };
    const sky = skyMap[worldType] || ['#87CEEB', '#d0eaff'];
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, sky[0]);
    grad.addColorStop(1, sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (worldType === 'dino') {
        // Volcano
        ctx.fillStyle = '#6a4a2a';
        ctx.beginPath();
        ctx.moveTo(85, gy);
        ctx.lineTo(100, gy - 40);
        ctx.lineTo(115, gy);
        ctx.fill();
        // Lava glow
        ctx.fillStyle = '#ff6030';
        ctx.beginPath();
        ctx.ellipse(100, gy - 40, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Palm tree
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(8, gy - 30, 4, 30);
        ctx.fillStyle = '#4a8a30';
        ctx.beginPath();
        ctx.ellipse(10, gy - 32, 14, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(10, gy - 35, 12, 4, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Ground
        ctx.fillStyle = '#7cba3f';
        ctx.fillRect(0, gy, W, H - gy);
    } else if (worldType === 'dog') {
        // House
        ctx.fillStyle = '#d4a070';
        ctx.fillRect(5, gy - 30, 25, 30);
        // Roof
        ctx.fillStyle = '#c04040';
        ctx.beginPath();
        ctx.moveTo(2, gy - 30);
        ctx.lineTo(17, gy - 45);
        ctx.lineTo(33, gy - 30);
        ctx.fill();
        // Window
        ctx.fillStyle = '#ffffaa';
        ctx.fillRect(12, gy - 22, 8, 8);
        ctx.strokeStyle = '#8a6a40';
        ctx.lineWidth = 1;
        ctx.strokeRect(12, gy - 22, 8, 8);
        // Fence
        ctx.fillStyle = '#e8d8c0';
        ctx.fillRect(90, gy - 12, 3, 12);
        ctx.fillRect(100, gy - 12, 3, 12);
        ctx.fillRect(110, gy - 12, 3, 12);
        ctx.fillRect(88, gy - 10, 28, 2);
        // Tree
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(108, gy - 28, 4, 28);
        ctx.fillStyle = '#4aaa40';
        ctx.beginPath();
        ctx.arc(110, gy - 32, 12, 0, Math.PI * 2);
        ctx.fill();
        // Ground
        ctx.fillStyle = '#90c060';
        ctx.fillRect(0, gy, W, H - gy);
    } else if (worldType === 'meerkat') {
        // Acacia tree
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(90, gy - 35, 3, 35);
        ctx.fillStyle = '#5a8a30';
        ctx.beginPath();
        ctx.ellipse(91, gy - 35, 18, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Termite mound
        ctx.fillStyle = '#c4a050';
        ctx.beginPath();
        ctx.moveTo(10, gy);
        ctx.quadraticCurveTo(12, gy - 20, 18, gy - 22);
        ctx.quadraticCurveTo(24, gy - 20, 26, gy);
        ctx.fill();
        // Ground
        ctx.fillStyle = '#d4b96a';
        ctx.fillRect(0, gy, W, H - gy);
    } else if (worldType === 'warthog') {
        // Jungle trees
        ctx.fillStyle = '#1a5a20';
        ctx.beginPath();
        ctx.arc(10, gy - 25, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a7a30';
        ctx.beginPath();
        ctx.arc(105, gy - 30, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a2a15';
        ctx.fillRect(8, gy - 10, 4, 10);
        ctx.fillRect(103, gy - 12, 4, 12);
        // Vine
        ctx.strokeStyle = '#2a6a20';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, gy - 35);
        ctx.quadraticCurveTo(25, gy - 20, 20, gy - 10);
        ctx.stroke();
        // Ground
        ctx.fillStyle = '#3a7a30';
        ctx.fillRect(0, gy, W, H - gy);
    } else if (worldType === 'cheetah') {
        // Race track with lane markings
        ctx.fillStyle = '#c86830';
        ctx.fillRect(0, gy, W, H - gy);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, gy + 8);
        ctx.lineTo(W, gy + 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, gy + 16);
        ctx.lineTo(W, gy + 16);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, gy, W, 2);
        // Savanna elements in distance
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(95, gy - 25, 3, 25);
        ctx.fillStyle = '#8a9a40';
        ctx.beginPath();
        ctx.ellipse(96, gy - 25, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    } else if (worldType === 'lion') {
        // Cheering animals silhouettes
        // Small zebra
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.ellipse(15, gy - 12, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillRect(10, gy - 16, 1.5, 8);
        ctx.fillRect(13, gy - 16, 1.5, 8);
        // Small elephant
        ctx.fillStyle = '#a0a0a8';
        ctx.beginPath();
        ctx.ellipse(95, gy - 14, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(103, gy - 18, 5, 0, Math.PI * 2);
        ctx.fill();
        // Trunk up
        ctx.strokeStyle = '#909098';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(107, gy - 18);
        ctx.quadraticCurveTo(112, gy - 22, 110, gy - 28);
        ctx.stroke();
        // Acacia
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(55, gy - 30, 3, 30);
        ctx.fillStyle = '#5a8a30';
        ctx.beginPath();
        ctx.ellipse(56, gy - 30, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Ground
        ctx.fillStyle = '#c8a858';
        ctx.fillRect(0, gy, W, H - gy);
    } else if (worldType === 'bird') {
        // Clouds
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(25, 25, 10, 0, Math.PI * 2);
        ctx.arc(35, 22, 12, 0, Math.PI * 2);
        ctx.arc(45, 26, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(95, 15, 8, 0, Math.PI * 2);
        ctx.arc(103, 13, 9, 0, Math.PI * 2);
        ctx.fill();
        // Mountain
        ctx.fillStyle = '#6a8a6a';
        ctx.beginPath();
        ctx.moveTo(70, gy);
        ctx.lineTo(90, gy - 30);
        ctx.lineTo(110, gy);
        ctx.fill();
        ctx.fillStyle = '#e8e8f0';
        ctx.beginPath();
        ctx.moveTo(85, gy - 24);
        ctx.lineTo(90, gy - 30);
        ctx.lineTo(95, gy - 24);
        ctx.fill();
        // Hill
        ctx.fillStyle = '#7aaa60';
        ctx.beginPath();
        ctx.arc(20, gy + 5, 22, Math.PI, 0);
        ctx.fill();
        // Ground
        ctx.fillStyle = '#90d060';
        ctx.fillRect(0, gy, W, H - gy);
    }
}

function drawMeerkatCard() {
    const canvas = document.getElementById('meerkat-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);
    drawCardBackground(ctx, 'meerkat');
    ctx.save();
    ctx.translate(60, 95);
    ctx.scale(0.75, 0.75);
    ctx.translate(-60, -95);
    const cx = 60, cy = 110;

    // Tail
    ctx.fillStyle = '#a08040';
    ctx.save();
    ctx.translate(cx - 18, cy - 20);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, -14, 4, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body (upright, slim)
    ctx.fillStyle = '#c8a060';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 42, 18, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#eed8a8';
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy - 36, 12, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#b89050';
    ctx.fillRect(cx - 10, cy - 10, 9, 14);
    ctx.fillRect(cx + 3, cy - 10, 9, 14);
    // Feet
    ctx.fillStyle = '#a08040';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy + 4, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 7, cy + 4, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms (hands on hips - Timon style!)
    ctx.fillStyle = '#b89050';
    ctx.save();
    ctx.translate(cx - 16, cy - 45);
    ctx.rotate(0.4);
    ctx.fillRect(0, 0, 7, 18);
    ctx.restore();
    ctx.save();
    ctx.translate(cx + 14, cy - 45);
    ctx.rotate(-0.4);
    ctx.fillRect(-3, 0, 7, 18);
    ctx.restore();

    // Head
    ctx.fillStyle = '#c8a060';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 76, 16, 14, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Face fur / lighter muzzle area
    ctx.fillStyle = '#eed8a8';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 72, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark eye patches (iconic meerkat / Timon look)
    ctx.fillStyle = '#4a3520';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 78, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 9, cy - 78, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (large, expressive like Timon)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 79, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 9, cy - 79, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 79, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 10, cy - 79, 2.8, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 80, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 11, cy - 80, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 71, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Big smile (Timon's cheeky grin)
    ctx.strokeStyle = '#8a6040';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx + 4, cy - 68, 6, 0.1, Math.PI * 0.9);
    ctx.stroke();

    // Ears (round, on top)
    ctx.fillStyle = '#b89050';
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 87, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 87, 5, 0, Math.PI * 2);
    ctx.fill();
    // Inner ear
    ctx.fillStyle = '#d4a870';
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 87, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 87, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tuft of hair on top (like Timon!)
    ctx.fillStyle = '#a07030';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 89);
    ctx.quadraticCurveTo(cx - 3, cy - 100, cx + 2, cy - 98);
    ctx.quadraticCurveTo(cx + 1, cy - 103, cx + 6, cy - 97);
    ctx.quadraticCurveTo(cx + 8, cy - 101, cx + 10, cy - 95);
    ctx.quadraticCurveTo(cx + 8, cy - 89, cx + 4, cy - 89);
    ctx.fill();
    ctx.restore();
}

// Draw on page load
function drawWarthogCard() {
    const canvas = document.getElementById('warthog-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);
    drawCardBackground(ctx, 'warthog');
    ctx.save();
    ctx.translate(60, 95);
    ctx.scale(0.75, 0.75);
    ctx.translate(-60, -95);
    const cx = 55, cy = 105;

    // Tail
    ctx.strokeStyle = '#8a5030';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 22);
    ctx.quadraticCurveTo(cx - 38, cy - 35, cx - 32, cy - 48);
    ctx.stroke();
    ctx.fillStyle = '#4a2a10';
    ctx.beginPath();
    ctx.ellipse(cx - 32, cy - 50, 3, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#a06030';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 25, 24, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#c8956a';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 18, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#8a5030';
    ctx.fillRect(cx - 14, cy - 8, 10, 12);
    ctx.fillRect(cx + 6, cy - 8, 10, 12);
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(cx - 15, cy + 2, 12, 5);
    ctx.fillRect(cx + 5, cy + 2, 12, 5);

    // Head
    ctx.fillStyle = '#a06030';
    ctx.beginPath();
    ctx.ellipse(cx + 22, cy - 38, 14, 13, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#b07040';
    ctx.beginPath();
    ctx.ellipse(cx + 36, cy - 34, 11, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Nose disc
    ctx.fillStyle = '#c08050';
    ctx.beginPath();
    ctx.arc(cx + 44, cy - 34, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a3820';
    ctx.beginPath();
    ctx.arc(cx + 42, cy - 35, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 46, cy - 35, 2, 0, Math.PI * 2);
    ctx.fill();

    // Tusks
    ctx.fillStyle = '#f5f0e0';
    ctx.beginPath();
    ctx.moveTo(cx + 40, cy - 36);
    ctx.quadraticCurveTo(cx + 41, cy - 46, cx + 38, cy - 50);
    ctx.quadraticCurveTo(cx + 36, cy - 46, cx + 38, cy - 36);
    ctx.fill();

    // Warts
    ctx.fillStyle = '#8a4828';
    ctx.beginPath();
    ctx.arc(cx + 28, cy - 40, 3, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 18, cy - 42, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.arc(cx + 19, cy - 42, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx + 20, cy - 42, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 21, cy - 43, 1, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.fillStyle = '#a06030';
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy - 50, 6, 10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c08860';
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy - 50, 4, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Mane mohawk
    ctx.fillStyle = '#4a2a10';
    for (let i = 0; i < 6; i++) {
        const mx = cx - 12 + i * 6;
        const my = cy - 44 + (i < 2 ? -i * 2 : (i - 2) * 1.5);
        ctx.beginPath();
        ctx.moveTo(mx - 2, my + 4);
        ctx.lineTo(mx, my - 4);
        ctx.lineTo(mx + 2, my + 4);
        ctx.fill();
    }

    // Smile
    ctx.strokeStyle = '#6a3820';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 38, cy - 30, 5, 0.1, Math.PI * 0.7);
    ctx.stroke();
    ctx.restore();
}

// ─── Victory Dance Animation ────────────────────────────
var victoryDanceInterval = null;

function startVictoryDance(worldType) {
    const canvas = document.getElementById('victory-dance-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    if (victoryDanceInterval) clearInterval(victoryDanceInterval);

    victoryDanceInterval = setInterval(() => {
        ctx.clearRect(0, 0, 300, 200);
        frame++;

        // Draw mini heroes following behind the winner
        if (currentHeroes) {
            for (let i = 0; i < currentHeroes.length; i++) {
                const hero = currentHeroes[i];
                const hx = 30 + i * 28;
                const delay = (i + 1) * 5;
                const hBounce = Math.sin((frame - delay) * 0.3) * 6;
                const hy = 155 + hBounce;
                const hLean = Math.sin((frame - delay) * 0.15) * 0.1;

                ctx.save();
                ctx.translate(hx, hy);
                ctx.rotate(hLean);
                ctx.scale(0.45, 0.45);

                // Mini cape
                ctx.fillStyle = hero.cape;
                ctx.beginPath();
                ctx.moveTo(-6, -10);
                ctx.quadraticCurveTo(-10 + Math.sin(frame * 0.15) * 3, 8, -8, 14);
                ctx.lineTo(8, 14);
                ctx.quadraticCurveTo(10 + Math.sin(frame * 0.15 + 1) * 3, 8, 6, -10);
                ctx.fill();

                // Mini body
                ctx.fillStyle = hero.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, 8, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                // Belt
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(-7, 2, 14, 3);

                // Legs kicking
                const lk = Math.sin(frame * 0.25 + i * 2) * 3;
                ctx.fillStyle = hero.color;
                ctx.fillRect(-5, 8 + lk, 4, 8);
                ctx.fillRect(1, 8 - lk, 4, 8);
                ctx.fillStyle = hero.cape;
                ctx.beginPath();
                ctx.ellipse(-3, 17 + lk, 4, 2, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(3, 17 - lk, 4, 2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Arms waving
                const aW = Math.sin(frame * 0.2 + i) * 0.6;
                ctx.fillStyle = hero.color;
                ctx.save();
                ctx.translate(-8, -4);
                ctx.rotate(-1 + aW);
                ctx.fillRect(0, 0, 3, 10);
                ctx.fillStyle = '#f5d0a0';
                ctx.beginPath();
                ctx.arc(1.5, 10, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                ctx.fillStyle = hero.color;
                ctx.save();
                ctx.translate(8, -4);
                ctx.rotate(1 - aW);
                ctx.fillRect(-3, 0, 3, 10);
                ctx.fillStyle = '#f5d0a0';
                ctx.beginPath();
                ctx.arc(-1.5, 10, 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Head
                ctx.fillStyle = '#f5d0a0';
                ctx.beginPath();
                ctx.arc(0, -16, 10, 0, Math.PI * 2);
                ctx.fill();
                // Mask
                ctx.fillStyle = hero.mask;
                ctx.beginPath();
                ctx.ellipse(0, -17, 10, 5, 0, 0, Math.PI * 2);
                ctx.fill();
                // Eyes
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(-4, -17, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(4, -17, 3.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#222';
                ctx.beginPath();
                ctx.arc(-3, -17, 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(5, -17, 2, 0, Math.PI * 2);
                ctx.fill();
                // Smile
                ctx.strokeStyle = '#c0392b';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(0, -13, 4, 0.2, Math.PI * 0.8);
                ctx.stroke();

                ctx.restore();
            }
        }

        const cx = 200;
        const cy = 160;
        const bounce = Math.sin(frame * 0.3) * 10;
        const lean = Math.sin(frame * 0.15) * 0.15;
        const armWave = Math.sin(frame * 0.25) * 0.6;

        ctx.save();
        ctx.translate(cx, cy + bounce);
        ctx.rotate(lean);

        // Draw a simple dancing character based on world
        const color = worldType === 'dino' ? '#7ec8e3' :
                      worldType === 'dog' ? '#7ec8e3' :
                      worldType === 'meerkat' ? '#c8a060' :
                      worldType === 'warthog' ? '#a06030' :
                      worldType === 'cheetah' ? '#e8b840' :
                      worldType === 'bird' ? '#7ec8e3' :
                      worldType === 'lion' ? '#e8b840' : '#7ec8e3';

        const darkColor = worldType === 'dino' ? '#6bb8d4' :
                          worldType === 'dog' ? '#5cb3d0' :
                          worldType === 'meerkat' ? '#b89050' :
                          worldType === 'warthog' ? '#8a5030' :
                          worldType === 'cheetah' ? '#d4a030' :
                          worldType === 'bird' ? '#5ab8d8' :
                          worldType === 'lion' ? '#c08028' : '#6bb8d4';

        // Legs (dancing!)
        const legL = Math.sin(frame * 0.3) * 8;
        const legR = Math.sin(frame * 0.3 + Math.PI) * 8;
        ctx.fillStyle = darkColor;
        ctx.fillRect(-12 + legL, -8, 10, 14);
        ctx.fillRect(4 + legR, -8, 10, 14);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(-7 + legL, 6, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(9 + legR, 6, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, -30, 22, 24, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = worldType === 'cheetah' ? '#f5e0a0' :
                        worldType === 'bird' ? '#c8ecf8' :
                        worldType === 'lion' ? '#f5d880' : '#b8e6f5';
        if (worldType === 'meerkat') ctx.fillStyle = '#eed8a8';
        if (worldType === 'warthog') ctx.fillStyle = '#c8956a';
        ctx.beginPath();
        ctx.ellipse(0, -24, 14, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Arms waving!
        ctx.fillStyle = darkColor;
        // Left arm UP
        ctx.save();
        ctx.translate(-20, -38);
        ctx.rotate(-1.2 + armWave);
        ctx.fillRect(0, -20, 8, 22);
        // Hand
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(4, -22, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Right arm UP
        ctx.fillStyle = darkColor;
        ctx.save();
        ctx.translate(20, -38);
        ctx.rotate(1.2 - armWave);
        ctx.fillRect(-8, -20, 8, 22);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(-4, -22, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Head
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, -58, 18, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (happy squint!)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        // Happy closed eyes ^_^
        ctx.beginPath();
        ctx.arc(-7, -60, 5, Math.PI + 0.3, -0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(7, -60, 5, Math.PI + 0.3, -0.3);
        ctx.stroke();

        // Big happy open mouth
        ctx.fillStyle = '#ff8a9e';
        ctx.beginPath();
        ctx.arc(0, -50, 8, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -50, 8, 0, Math.PI);
        ctx.stroke();

        // Party hat!
        const hatColors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];
        ctx.fillStyle = hatColors[Math.floor(frame / 15) % hatColors.length];
        ctx.beginPath();
        ctx.moveTo(-10, -73);
        ctx.lineTo(0, -95);
        ctx.lineTo(10, -73);
        ctx.fill();
        // Hat ball
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -95, 4, 0, Math.PI * 2);
        ctx.fill();

        // Musical notes floating around
        ctx.font = '20px Arial';
        ctx.fillStyle = '#e74c3c';
        const noteX1 = 30 + Math.sin(frame * 0.1) * 15;
        const noteY1 = -70 - (frame % 60);
        ctx.globalAlpha = 1 - (frame % 60) / 60;
        ctx.fillText('♪', noteX1, noteY1);
        ctx.fillStyle = '#3498db';
        const noteX2 = -35 + Math.cos(frame * 0.12) * 15;
        const noteY2 = -60 - ((frame + 30) % 60);
        ctx.globalAlpha = 1 - ((frame + 30) % 60) / 60;
        ctx.fillText('♫', noteX2, noteY2);
        ctx.globalAlpha = 1;

        // Balloons floating up
        const balloonColors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#ff69b4'];
        for (let i = 0; i < 6; i++) {
            const bx = -80 + i * 32 + Math.sin(frame * 0.05 + i * 2) * 10;
            const by = -40 - Math.abs(Math.sin(frame * 0.03 + i)) * 50 - i * 8;
            const bcolor = balloonColors[i];

            // String
            ctx.strokeStyle = '#888';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bx, by + 14);
            ctx.quadraticCurveTo(bx + Math.sin(frame * 0.1 + i) * 5, by + 30, bx, by + 40);
            ctx.stroke();

            // Balloon
            ctx.fillStyle = bcolor;
            ctx.beginPath();
            ctx.ellipse(bx, by, 12, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            // Balloon knot
            ctx.beginPath();
            ctx.moveTo(bx - 3, by + 14);
            ctx.lineTo(bx, by + 18);
            ctx.lineTo(bx + 3, by + 14);
            ctx.fill();
            // Shine
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.ellipse(bx - 4, by - 5, 3, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }, 1000 / 30);
}

function stopVictoryDance() {
    if (victoryDanceInterval) {
        clearInterval(victoryDanceInterval);
        victoryDanceInterval = null;
    }
}

function spawnConfetti() {
    const container = document.getElementById('confetti-container');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#ff69b4'];

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (2 + Math.random() * 3) + 's';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.width = (6 + Math.random() * 8) + 'px';
        confetti.style.height = (6 + Math.random() * 8) + 'px';
        container.appendChild(confetti);
    }
}

// ─── Gift Box with Superheroes ──────────────────────────
var giftOpened = false;
var giftAnimFrame = 0;
var giftAnimInterval = null;

function drawGiftBox() {
    const canvas = document.getElementById('gift-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 300, H = 280;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;

    // Gift box wobble
    const wobble = Math.sin(giftAnimFrame * 0.15) * 3;
    const scale = 1 + Math.sin(giftAnimFrame * 0.1) * 0.02;

    ctx.save();
    ctx.translate(cx, H - 20);
    ctx.rotate(wobble * 0.01);
    ctx.scale(scale, scale);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 65, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Box body
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-55, -80, 110, 80);
    // Box side shading
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-55, -80, 15, 80);
    ctx.fillRect(40, -80, 15, 80);

    // Ribbon vertical
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-8, -80, 16, 80);

    // Box lid
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(-62, -100, 124, 25);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-62, -100, 124, 5);

    // Ribbon horizontal
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-62, -92, 124, 14);

    // Bow
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.ellipse(-15, -102, 18, 12, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(15, -102, 18, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Bow center
    ctx.fillStyle = '#e67e22';
    ctx.beginPath();
    ctx.arc(0, -102, 8, 0, Math.PI * 2);
    ctx.fill();

    // Sparkles around box
    ctx.fillStyle = '#f1c40f';
    const sparkles = [[-70, -60], [70, -50], [-60, -110], [65, -105], [-75, -20], [75, -30]];
    for (const [sx, sy] of sparkles) {
        const sparkAlpha = (Math.sin(giftAnimFrame * 0.2 + sx) + 1) / 2;
        ctx.globalAlpha = sparkAlpha * 0.8;
        ctx.font = '14px Arial';
        ctx.fillText('✨', sx - 7, sy);
    }
    ctx.globalAlpha = 1;

    // Question mark
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('?', 0, -40);

    ctx.restore();
}

function openGift() {
    if (giftOpened) return;
    giftOpened = true;

    const canvas = document.getElementById('gift-canvas');
    if (!canvas) return;
    canvas.style.cursor = 'default';
    document.querySelector('.gift-prompt').textContent = 'הנה הגיבורים שלכם!';

    // Animate opening
    let openFrame = 0;
    if (giftAnimInterval) clearInterval(giftAnimInterval);

    giftAnimInterval = setInterval(() => {
        const ctx = canvas.getContext('2d');
        const W = 300, H = 280;
        ctx.clearRect(0, 0, W, H);
        openFrame++;

        const cx = W / 2;
        const lidY = Math.min(openFrame * 3, 60);
        const heroesY = Math.min(openFrame * 2, 50);

        // Draw superheroes rising from box
        if (openFrame > 10) {
            drawMiniSuperheroes(ctx, cx, H - 80 - heroesY, Math.min((openFrame - 10) / 20, 1), openFrame);
        }

        // Box body (bottom half visible)
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(cx - 55, H - 100, 110, 80);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(cx - 55, H - 100, 15, 80);
        ctx.fillRect(cx + 40, H - 100, 15, 80);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(cx - 8, H - 100, 16, 80);

        // Lid flying off
        ctx.save();
        ctx.translate(cx, H - 120 - lidY);
        ctx.rotate(openFrame * 0.05);
        ctx.globalAlpha = Math.max(0, 1 - lidY / 60);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(-62, 0, 124, 25);
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(-62, 8, 124, 14);
        ctx.restore();
        ctx.globalAlpha = 1;

        // Stars burst
        if (openFrame < 40) {
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + openFrame * 0.1;
                const dist = openFrame * 2;
                const sx = cx + Math.cos(angle) * dist;
                const sy = H - 100 + Math.sin(angle) * dist * 0.6;
                ctx.globalAlpha = Math.max(0, 1 - openFrame / 40);
                ctx.font = '16px Arial';
                ctx.fillStyle = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'][i % 4];
                ctx.fillText('⭐', sx - 8, sy);
            }
            ctx.globalAlpha = 1;
        }

        if (openFrame > 60) {
            clearInterval(giftAnimInterval);
            // Keep drawing final state
            giftAnimInterval = setInterval(() => {
                openFrame++;
                ctx.clearRect(0, 0, W, H);
                drawMiniSuperheroes(ctx, cx, H - 130, 1, openFrame);
                // Box bottom
                ctx.fillStyle = '#e74c3c';
                ctx.fillRect(cx - 55, H - 100, 110, 80);
                ctx.fillStyle = '#c0392b';
                ctx.fillRect(cx - 55, H - 100, 15, 80);
                ctx.fillRect(cx + 40, H - 100, 15, 80);
                ctx.fillStyle = '#f1c40f';
                ctx.fillRect(cx - 8, H - 100, 16, 80);
            }, 1000 / 20);
        }
    }, 1000 / 30);
}

// All possible superheroes - 4 random ones are picked each win
const ALL_HEROES = [
    { color: '#e74c3c', cape: '#c0392b', mask: '#222', name: 'S', hair: '#4a2a10' },       // Superman
    { color: '#3498db', cape: '#2980b9', mask: '#1a5276', name: 'B', hair: '#222' },        // Batman
    { color: '#f1c40f', cape: '#e67e22', mask: '#7d3c98', name: 'W', hair: '#1a1a1a' },     // Wonder Woman
    { color: '#2ecc71', cape: '#27ae60', mask: '#145a32', name: 'H', hair: '#2a1a10' },     // Hulk
    { color: '#e74c3c', cape: '#1a5276', mask: '#e74c3c', name: 'P', hair: '#4a2a10' },     // Spiderman
    { color: '#c0392b', cape: '#8e44ad', mask: '#c0392b', name: 'F', hair: '#e74c3c' },     // Flash
    { color: '#8e44ad', cape: '#6c3483', mask: '#4a235a', name: 'T', hair: '#222' },        // Thanos (cute)
    { color: '#1abc9c', cape: '#16a085', mask: '#0e6655', name: 'A', hair: '#f39c12' },     // Aquaman
    { color: '#2c3e50', cape: '#1a252f', mask: '#2c3e50', name: 'N', hair: '#222' },        // Black Panther
    { color: '#f39c12', cape: '#d4ac0d', mask: '#7d6608', name: 'I', hair: '#4a2a10' },     // Iron Man
    { color: '#ecf0f1', cape: '#bdc3c7', mask: '#95a5a6', name: 'S', hair: '#f5e6ce' },     // Silver Surfer
    { color: '#e91e63', cape: '#c2185b', mask: '#880e4f', name: 'G', hair: '#1a1a1a' },     // Gamora
];

var currentHeroes = null;

function pickRandomHeroes() {
    const shuffled = [...ALL_HEROES].sort(() => Math.random() - 0.5);
    currentHeroes = shuffled.slice(0, 4);
}

function drawMiniSuperheroes(ctx, cx, baseY, alpha, frame) {
    ctx.globalAlpha = alpha;

    if (!currentHeroes) pickRandomHeroes();

    // Position heroes behind the winner (winner in front, heroes following)
    const heroes = currentHeroes.map((h, i) => ({
        ...h,
        x: cx - 50 + i * 34,
    }));

    for (const hero of heroes) {
        const hx = hero.x;
        const bounce = Math.sin(frame * 0.2 + hero.x * 0.1) * 4;
        const hy = baseY + bounce;

        // Cape (fluttering!)
        ctx.fillStyle = hero.cape;
        ctx.beginPath();
        ctx.moveTo(hx - 6, hy - 10);
        ctx.quadraticCurveTo(hx - 10 + Math.sin(frame * 0.15) * 3, hy + 8, hx - 8, hy + 14);
        ctx.lineTo(hx + 8, hy + 14);
        ctx.quadraticCurveTo(hx + 10 + Math.sin(frame * 0.15 + 1) * 3, hy + 8, hx + 6, hy - 10);
        ctx.fill();

        // Tiny body
        ctx.fillStyle = hero.color;
        ctx.beginPath();
        ctx.ellipse(hx, hy, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belt
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(hx - 7, hy + 2, 14, 3);

        // Emblem on chest
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(hero.name, hx, hy - 1);

        // Tiny legs
        ctx.fillStyle = hero.color;
        const legKick = Math.sin(frame * 0.25 + hero.x) * 2;
        ctx.fillRect(hx - 5, hy + 8 + legKick, 4, 8);
        ctx.fillRect(hx + 1, hy + 8 - legKick, 4, 8);
        // Boots
        ctx.fillStyle = hero.cape;
        ctx.beginPath();
        ctx.ellipse(hx - 3, hy + 17 + legKick, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + 3, hy + 17 - legKick, 4, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tiny arms (waving!)
        const armAngle = Math.sin(frame * 0.2 + hero.x * 0.05) * 0.5;
        ctx.fillStyle = hero.color;
        ctx.save();
        ctx.translate(hx - 8, hy - 4);
        ctx.rotate(-0.8 + armAngle);
        ctx.fillRect(0, 0, 3, 10);
        // Tiny fist
        ctx.fillStyle = '#f5d0a0';
        ctx.beginPath();
        ctx.arc(1.5, 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = hero.color;
        ctx.save();
        ctx.translate(hx + 8, hy - 4);
        ctx.rotate(0.8 - armAngle);
        ctx.fillRect(-3, 0, 3, 10);
        ctx.fillStyle = '#f5d0a0';
        ctx.beginPath();
        ctx.arc(-1.5, 10, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Big cute head
        ctx.fillStyle = '#f5d0a0';
        ctx.beginPath();
        ctx.arc(hx, hy - 16, 10, 0, Math.PI * 2);
        ctx.fill();

        // Mask
        ctx.fillStyle = hero.mask;
        ctx.beginPath();
        ctx.ellipse(hx, hy - 17, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (big, cute, through mask)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hx - 4, hy - 17, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx + 4, hy - 17, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(hx - 3, hy - 17, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx + 5, hy - 17, 2, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(hx - 2.5, hy - 18, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(hx + 5.5, hy - 18, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(hx, hy - 13, 4, 0.2, Math.PI * 0.8);
        ctx.stroke();

        // Rosy cheeks
        ctx.fillStyle = 'rgba(255, 150, 150, 0.4)';
        ctx.beginPath();
        ctx.ellipse(hx - 7, hy - 14, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(hx + 7, hy - 14, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hair
        ctx.fillStyle = hero.hair || '#222';
        ctx.beginPath();
        ctx.arc(hx, hy - 24, 7, Math.PI, 0);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

// Start gift box animation when win screen shows
function startGiftAnimation() {
    giftOpened = false;
    giftAnimFrame = 0;
    // Pick new random heroes each time!
    pickRandomHeroes();
    const canvas = document.getElementById('gift-canvas');
    if (canvas) canvas.style.cursor = 'pointer';
    const prompt = document.querySelector('.gift-prompt');
    if (prompt) prompt.textContent = 'יש לכם מתנה - לחצו לפתוח!';

    if (giftAnimInterval) clearInterval(giftAnimInterval);
    giftAnimInterval = setInterval(() => {
        giftAnimFrame++;
        drawGiftBox();
    }, 1000 / 20);
}

function stopGiftAnimation() {
    if (giftAnimInterval) {
        clearInterval(giftAnimInterval);
        giftAnimInterval = null;
    }
}

function drawCheetahCard() {
    const canvas = document.getElementById('cheetah-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);
    drawCardBackground(ctx, 'cheetah');
    ctx.save();
    ctx.translate(60, 95);
    ctx.scale(0.75, 0.75);
    ctx.translate(-60, -95);
    const cx = 55, cy = 95;

    // Tail
    ctx.strokeStyle = '#d4a030';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 25, cy - 10);
    ctx.quadraticCurveTo(cx - 40, cy - 5, cx - 48, cy - 20);
    ctx.quadraticCurveTo(cx - 50, cy - 28, cx - 44, cy - 30);
    ctx.stroke();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 47, cy - 26);
    ctx.lineTo(cx - 44, cy - 30);
    ctx.stroke();

    // Back legs
    ctx.fillStyle = '#d4a030';
    ctx.fillRect(cx - 12, cy - 2, 7, 14);
    ctx.fillRect(cx + 4, cy - 2, 7, 14);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(cx - 9, cy + 12, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 7, cy + 12, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#e8b840';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 14, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly
    ctx.fillStyle = '#f5e0a0';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 8, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Spots
    ctx.fillStyle = '#333';
    for (const [sx, sy] of [[-8, -20], [0, -22], [8, -20], [14, -18], [-6, -12], [4, -10], [12, -14]]) {
        ctx.beginPath();
        ctx.arc(cx + sx, cy + sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Front legs
    ctx.fillStyle = '#d4a030';
    ctx.fillRect(cx + 14, cy - 2, 7, 14);
    ctx.fillRect(cx + 24, cy - 2, 7, 14);
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(cx + 17, cy + 12, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 27, cy + 12, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#e8b840';
    ctx.beginPath();
    ctx.arc(cx + 26, cy - 28, 12, 0, Math.PI * 2);
    ctx.fill();
    // Muzzle
    ctx.fillStyle = '#f5e0a0';
    ctx.beginPath();
    ctx.ellipse(cx + 33, cy - 25, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Nose
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(cx + 37, cy - 26, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tear marks
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + 22, cy - 30);
    ctx.quadraticCurveTo(cx + 21, cy - 24, cx + 22, cy - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 29, cy - 30);
    ctx.quadraticCurveTo(cx + 30, cy - 24, cx + 31, cy - 18);
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 22, cy - 32, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 30, cy - 32, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c88020';
    ctx.beginPath();
    ctx.arc(cx + 23, cy - 32, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 31, cy - 32, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx + 23.5, cy - 32, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 31.5, cy - 32, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 24, cy - 33, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#d4a030';
    ctx.beginPath();
    ctx.arc(cx + 18, cy - 39, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 32, cy - 39, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx + 18, cy - 39, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 32, cy - 39, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#a08020';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx + 34, cy - 23, 3.5, 0.1, Math.PI * 0.7);
    ctx.stroke();
    ctx.restore();
}

function drawDinoCard() {
    const canvas = document.getElementById('dino-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawCardBackground(ctx, 'dino');
    ctx.save();
    ctx.translate(60, 95);
    ctx.scale(0.75, 0.75);
    ctx.translate(-60, -95);
    const cx = 60, cy = 95;

    // Tail
    ctx.fillStyle = '#7ec8e3';
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - 18);
    ctx.quadraticCurveTo(cx - 35, cy - 15, cx - 45, cy - 28);
    ctx.quadraticCurveTo(cx - 48, cy - 35, cx - 42, cy - 38);
    ctx.quadraticCurveTo(cx - 35, cy - 32, cx - 16, cy - 28);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#6bb8d4';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 6, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy - 6, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Feet
    ctx.fillStyle = '#5a9fb0';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy + 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#7ec8e3';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 28, 20, 22, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Back spikes
    ctx.fillStyle = '#5ab8d4';
    const cardSpikes = [
        { x: cx - 14, y: cy - 42, h: 8 },
        { x: cx - 10, y: cy - 46, h: 10 },
        { x: cx - 5, y: cy - 48, h: 12 },
        { x: cx, y: cy - 47, h: 10 },
        { x: cx + 5, y: cy - 44, h: 8 },
    ];
    for (const sp of cardSpikes) {
        ctx.beginPath();
        ctx.moveTo(sp.x - 4, sp.y + 4);
        ctx.lineTo(sp.x, sp.y - sp.h);
        ctx.lineTo(sp.x + 4, sp.y + 4);
        ctx.fill();
    }

    // Belly
    ctx.fillStyle = '#b8e6f5';
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 22, 12, 16, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Diaper
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, 18, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8ad4f0';
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy - 14, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 12, cy - 14, 4, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Shirt
    ctx.fillStyle = '#f0e050';
    ctx.beginPath();
    ctx.moveTo(cx - 17, cy - 38);
    ctx.quadraticCurveTo(cx - 19, cy - 28, cx - 17, cy - 18);
    ctx.lineTo(cx + 17, cy - 18);
    ctx.quadraticCurveTo(cx + 19, cy - 28, cx + 17, cy - 38);
    ctx.quadraticCurveTo(cx, cy - 42, cx - 17, cy - 38);
    ctx.fill();
    // Bone on shirt
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(cx - 8, cy - 32, 16, 4, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 8, cy - 32, 3, 0, Math.PI * 2);
    ctx.arc(cx - 8, cy - 28, 3, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy - 32, 3, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy - 28, 3, 0, Math.PI * 2);
    ctx.fill();

    // Tiny arms
    ctx.fillStyle = '#6bb8d4';
    ctx.save();
    ctx.translate(cx + 16, cy - 32);
    ctx.rotate(0.5);
    ctx.fillRect(0, 0, 4, 12);
    ctx.restore();
    ctx.save();
    ctx.translate(cx - 18, cy - 32);
    ctx.rotate(-0.5);
    ctx.fillRect(0, 0, 4, 12);
    ctx.restore();

    // Head (big, baby proportions)
    ctx.fillStyle = '#8ad4ef';
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy - 55, 18, 17, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 58, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 15.5, cy - 59, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Closed-mouth smile
    ctx.strokeStyle = '#5a9fb0';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 50, 6, 0.1, Math.PI * 0.6);
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = '#5a9fb0';
    ctx.beginPath();
    ctx.ellipse(cx + 22, cy - 54, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pink bow
    ctx.fillStyle = '#ff88aa';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 68, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 70, 6, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6690';
    ctx.beginPath();
    ctx.arc(cx, cy - 69, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawDogCard() {
    const canvas = document.getElementById('dog-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawCardBackground(ctx, 'dog');
    ctx.save();
    ctx.translate(60, 95);
    ctx.scale(0.75, 0.75);
    ctx.translate(-60, -95);
    const cx = 60, cy = 92;

    // Tail (wagging)
    ctx.strokeStyle = '#c8a060';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 25);
    ctx.quadraticCurveTo(cx - 28, cy - 40, cx - 22, cy - 50);
    ctx.stroke();

    // Back legs
    ctx.fillStyle = '#c8a060';
    ctx.fillRect(cx - 14, cy - 7, 9, 14);
    ctx.fillRect(cx + 6, cy - 7, 9, 14);
    // Paws
    ctx.fillStyle = '#b89050';
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy + 7, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy + 7, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#d4b070';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 20, 22, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#e8d4a8';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy - 14, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Collar
    ctx.fillStyle = '#e04040';
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy - 32, 10, 3, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Tag
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 28, 3, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#d4b070';
    ctx.beginPath();
    ctx.arc(cx + 16, cy - 42, 14, 0, Math.PI * 2);
    ctx.fill();

    // Floppy ears
    ctx.fillStyle = '#b89050';
    ctx.save();
    ctx.translate(cx + 6, cy - 48);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx + 26, cy - 48);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Snout
    ctx.fillStyle = '#e0c088';
    ctx.beginPath();
    ctx.ellipse(cx + 24, cy - 38, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(cx + 29, cy - 40, 3, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx + 20, cy - 45, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 21, cy - 46, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#8a6a40';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 24, cy - 36, 4, 0.1, Math.PI * 0.7);
    ctx.stroke();

    // Tongue
    ctx.fillStyle = '#ff8888';
    ctx.beginPath();
    ctx.ellipse(cx + 26, cy - 33, 3, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawLionCard() {
    const canvas = document.getElementById('lion-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawCardBackground(ctx, 'lion');
    ctx.save();
    ctx.translate(60, 95);
    ctx.scale(0.7, 0.7);
    ctx.translate(-60, -95);
    const cx = 55, cy = 95;

    // Tail
    ctx.strokeStyle = '#c89030';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 22);
    ctx.quadraticCurveTo(cx - 30, cy - 18, cx - 36, cy - 30);
    ctx.stroke();
    ctx.fillStyle = '#8a5a20';
    ctx.beginPath();
    ctx.arc(cx - 36, cy - 30, 4, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#d4a040';
    ctx.fillRect(cx - 8, cy - 6, 8, 12);
    ctx.fillRect(cx + 4, cy - 6, 8, 12);
    ctx.fillRect(cx + 14, cy - 6, 8, 10);
    ctx.fillStyle = '#c09030';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 5, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 5, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 18, cy + 3, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#e8b840';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 24, 20, 16, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#f5d880';
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 18, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mane
    ctx.fillStyle = '#b07020';
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 44, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c08028';
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 44, 15, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = '#e8b840';
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 44, 12, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#d4a040';
    ctx.beginPath();
    ctx.arc(cx + 3, cy - 54, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 21, cy - 54, 4, 0, Math.PI * 2);
    ctx.fill();

    // Snout
    ctx.fillStyle = '#f0d070';
    ctx.beginPath();
    ctx.ellipse(cx + 17, cy - 40, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#6a4020';
    ctx.beginPath();
    ctx.ellipse(cx + 20, cy - 42, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 48, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 16, cy - 48, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 9, cy - 49, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 17, cy - 49, 1, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#8a5a20';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 39, 4, 0.1, Math.PI * 0.7);
    ctx.stroke();

    // Crown
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy - 58);
    ctx.lineTo(cx + 5, cy - 68);
    ctx.lineTo(cx + 8, cy - 62);
    ctx.lineTo(cx + 12, cy - 72);
    ctx.lineTo(cx + 16, cy - 62);
    ctx.lineTo(cx + 19, cy - 68);
    ctx.lineTo(cx + 21, cy - 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e8b800';
    ctx.fillRect(cx + 3, cy - 60, 18, 3);
    // Gems
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(cx + 8, cy - 58, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3498db';
    ctx.beginPath();
    ctx.arc(cx + 12, cy - 58, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(cx + 16, cy - 58, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawBirdCard() {
    const canvas = document.getElementById('bird-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawCardBackground(ctx, 'bird');
    ctx.save();
    ctx.translate(60, 70);
    ctx.scale(0.75, 0.75);
    ctx.translate(-60, -70);
    const cx = 60, cy = 55;

    // Tail feathers
    ctx.fillStyle = '#5aa8c8';
    ctx.save();
    ctx.translate(cx - 22, cy - 2);
    ctx.rotate(0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = '#7ec8e3';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#c8ecf8';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 4, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Baby diaper
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 12, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8ad4f0';
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy + 9, 3.5, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 10, cy + 9, 3.5, 2.5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = '#5ab8d8';
    ctx.save();
    ctx.translate(cx - 8, cy - 8);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.ellipse(-8, 0, 18, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Head
    ctx.fillStyle = '#8ad4ef';
    ctx.beginPath();
    ctx.arc(cx + 18, cy - 14, 13, 0, Math.PI * 2);
    ctx.fill();

    // Blush
    ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cx + 14, cy - 8, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx + 22, cy - 16, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx + 23.5, cy - 17.5, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ff9933';
    ctx.beginPath();
    ctx.moveTo(cx + 29, cy - 16);
    ctx.lineTo(cx + 39, cy - 13);
    ctx.lineTo(cx + 29, cy - 10);
    ctx.fill();

    // Crest
    ctx.fillStyle = '#5ab8d8';
    ctx.save();
    ctx.translate(cx + 16, cy - 26);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Feet
    ctx.strokeStyle = '#ff9933';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy + 14);
    ctx.lineTo(cx - 6, cy + 22);
    ctx.lineTo(cx - 10, cy + 24);
    ctx.moveTo(cx - 6, cy + 22);
    ctx.lineTo(cx - 4, cy + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy + 14);
    ctx.lineTo(cx + 8, cy + 22);
    ctx.lineTo(cx + 12, cy + 24);
    ctx.moveTo(cx + 8, cy + 22);
    ctx.lineTo(cx + 6, cy + 24);
    ctx.stroke();
    ctx.restore();
}

window.addEventListener('DOMContentLoaded', () => {
    drawDinoCard();
    drawDogCard();
    drawMeerkatCard();
    drawWarthogCard();
    drawCheetahCard();
    drawLionCard();
    drawBirdCard();
});
