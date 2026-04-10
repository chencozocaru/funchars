// Hebrew alphabet in order
const HEBREW_LETTERS = [
    'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
    'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'
];

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
    }
};

var game = null;

// ─── Main Game Class ───────────────────────────────────────
class Game {
    constructor(worldType) {
        this.worldType = worldType;
        this.world = WORLDS[worldType];
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Game state
        this.lives = MAX_LIVES;
        this.score = 0;
        this.currentLetterIndex = 0;
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

        // Start loop
        this.running = true;
        this.startLoop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.updateGround();
    }

    updateGround() {
        this.groundY = this.canvas.height - 100;
        this.player.y = this.groundY - this.player.height;
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
                this.player.vy = this.player.jumpPower;
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

    // ─── Spawning letters ───────────────────────────────────
    spawnLetter() {
        const isCorrect = Math.random() < 0.45;
        let letter;
        if (isCorrect) {
            letter = this.currentLetter;
        } else {
            // Pick a random different letter
            let idx;
            do {
                idx = Math.floor(Math.random() * HEBREW_LETTERS.length);
            } while (idx === this.currentLetterIndex);
            letter = HEBREW_LETTERS[idx];
        }

        const floatY = this.groundY - 130 - Math.random() * 80;

        this.letters.push({
            letter,
            correct: letter === this.currentLetter,
            x: this.canvas.width + 50,
            y: floatY,
            baseY: floatY,
            size: 48,
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

            if (dist < 45) {
                l.collected = true;
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
        // Bonus life for completing a letter!
        if (this.lives < MAX_LIVES) {
            this.lives++;
        }
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
        document.getElementById('level-complete-overlay').classList.remove('hidden');
    }

    nextLevel() {
        this.currentLetterIndex++;
        this.score = 0;
        this.letters = [];
        this.letterSpawnTimer = 0;
        this.paused = false;
        // Slightly increase speed each level
        this.speed = Math.min(6 + this.currentLetterIndex * 0.2, 10);
        document.getElementById('level-complete-overlay').classList.add('hidden');
    }

    triggerGameOver() {
        this.gameOver = true;
        document.getElementById('final-score').textContent =
            `הגעתם לאות ${this.currentLetter} עם ${this.score} נקודות`;
        document.getElementById('game-over-overlay').classList.remove('hidden');
    }

    restart() {
        this.lives = MAX_LIVES;
        this.score = 0;
        this.currentLetterIndex = 0;
        this.speed = this.worldType === 'cheetah' ? 9 : 6;
        this.letters = [];
        this.particles = [];
        this.gameOver = false;
        this.paused = false;
        this.scrollX = 0;
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
            ctx.font = 'bold 42px Arial';
            ctx.fillStyle = this.flashColor;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.textAlign = 'center';
            const fy = this.player.y - 30 - (40 - this.flashTimer);
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

            const bubbleRadius = 30;
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

        if (this.worldType === 'dino') {
            this.drawDino(ctx, p);
        } else if (this.worldType === 'meerkat') {
            this.drawMeerkat(ctx, p);
        } else if (this.worldType === 'warthog') {
            this.drawWarthog(ctx, p);
        } else if (this.worldType === 'cheetah') {
            this.drawCheetah(ctx, p);
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
        // Lives as bones - top right
        const boneStartX = W - 30;
        for (let i = 0; i < MAX_LIVES; i++) {
            const bx = boneStartX - i * 38;
            const by = 30;
            if (i < this.lives) {
                this.drawBone(ctx, bx, by, 1);
            } else {
                this.drawBone(ctx, bx, by, 0.3);
            }
        }

        // Current letter target - top center
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, W / 2 - 70, 10, 140, 55, 12);
        ctx.fill();

        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('?תפסו את', W / 2, 30);

        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(this.currentLetter, W / 2, 58);

        // Score - top left
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, 10, 10, 130, 55, 12);
        ctx.fill();

        ctx.textAlign = 'left';
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#aaa';
        ctx.fillText('נקודות', 75, 28);

        ctx.font = 'bold 26px Arial';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${this.score} / ${POINTS_TO_PASS}`, 20, 55);

        // Level indicator
        ctx.font = '13px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(`אות ${this.currentLetterIndex + 1} מתוך ${HEBREW_LETTERS.length}`, W / 2, 80);

        // Score bar
        const barW = 120;
        const barH = 6;
        const barX = 15;
        const barY = 62;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        roundRect(ctx, barX, barY, barW, barH, 3);
        ctx.fill();
        ctx.fillStyle = '#FFD700';
        const progress = Math.min(this.score / POINTS_TO_PASS, 1);
        roundRect(ctx, barX, barY, barW * progress, barH, 3);
        ctx.fill();
    }

    drawBone(ctx, x, y, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#f5f5dc';
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;

        // Bone shaft
        ctx.beginPath();
        ctx.roundRect(x - 12, y - 3, 24, 6, 3);
        ctx.fill();
        ctx.stroke();

        // Bone ends
        for (const dx of [-12, 12]) {
            ctx.beginPath();
            ctx.arc(x + dx, y - 4, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x + dx, y + 4, 4, 0, Math.PI * 2);
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

function chooseWorld(worldType) {
    pendingWorld = worldType;
    document.getElementById('difficulty-screen').classList.remove('hidden');
}

function selectDifficulty(level) {
    if (level === 'easy') POINTS_TO_PASS = 10;
    else if (level === 'medium') POINTS_TO_PASS = 20;
    else POINTS_TO_PASS = 40;

    document.getElementById('difficulty-screen').classList.add('hidden');
    startGame(pendingWorld);
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
    document.getElementById('pause-btn').classList.add('hidden');
    document.getElementById('difficulty-screen').classList.add('hidden');
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
function drawMeerkatCard() {
    const canvas = document.getElementById('meerkat-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 60, cy = 110;

    ctx.clearRect(0, 0, 120, 120);

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
}

// Draw on page load
function drawWarthogCard() {
    const canvas = document.getElementById('warthog-card-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 55, cy = 105;

    ctx.clearRect(0, 0, 120, 120);

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
                      worldType === 'cheetah' ? '#e8b840' : '#7ec8e3';

        const darkColor = worldType === 'dino' ? '#6bb8d4' :
                          worldType === 'dog' ? '#5cb3d0' :
                          worldType === 'meerkat' ? '#b89050' :
                          worldType === 'warthog' ? '#8a5030' :
                          worldType === 'cheetah' ? '#d4a030' : '#6bb8d4';

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
        ctx.fillStyle = worldType === 'cheetah' ? '#f5e0a0' : '#b8e6f5';
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
    const cx = 55, cy = 95;

    ctx.clearRect(0, 0, 120, 120);

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
}

window.addEventListener('DOMContentLoaded', () => {
    drawMeerkatCard();
    drawWarthogCard();
    drawCheetahCard();
});
