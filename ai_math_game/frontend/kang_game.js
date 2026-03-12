const config = {
    type: Phaser.AUTO,
    width: 900, height: 650,
    parent: 'game-container',
    backgroundColor: '#2ECC71',
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player, opponents = [], shapesGroup;
let currentTarget = "", totalAttempts = 0, correctClicks = 0;
let missedShapes = new Set(), finishers = [], gameStarted = false;
let startTime, currentRowIndex = 0;
let score = 0, combo = 0, bestCombo = 0;
let timeLimit = 60; // Dynamic time limit
let playerAccuracy = 0; // Track player performance
let adaptiveLevel = 1; // 1=Low, 2=Medium, 3=High
const totalRows = 20;

const shapesList = ['rhombus', 'hexagon', 'cylinder', 'trapezoid', 'cone', 'sphere', 'cube', 'rectangle', 'octagon', 'pentagon'];

function preload() {
    console.log('Loading kangaroo image...');
    this.load.image('kangaroo', '/assets/kangaroo.png'); // use absolute path for backend serving

    // Add error handling for image loading
    this.load.on('filecomplete', function (loader) {
        if (loader.key === 'kangaroo') {
            console.log('✅ Kangaroo image loaded successfully');
        }
    });

    this.load.on('loaderror', function (loader) {
        if (loader.key === 'kangaroo') {
            console.error('❌ Failed to load kangaroo image:', loader.src);
        }
    });
}

function create() {
    // 1. Background elements
    let bgGradient = this.add.graphics();
    bgGradient.fillGradientStyle(0, 0, 900, 650, [
        { color: '#87CEEB', stop: 0 },
        { color: '#4CAF50', stop: 0.3 },
        { color: '#2ECC71', stop: 1 }
    ]);
    bgGradient.fillRect(0, 0, 900, 650);

    // Add grass patches
    for (let i = 0; i < 8; i++) {
        let grass = this.add.graphics();
        grass.fillStyle(0x4CAF50);
        grass.fillRoundedRect(80 + (i * 100), 600, 70, 18, 9);
        grass.setDepth(1);
    }

    // 1. Grid
    let grid = this.add.graphics().lineStyle(2, 0x2d8a77, 0.4);
    for (let i = -600; i <= 1400; i += 200) { grid.lineBetween(i, 600, 400 + (i - 400) * 0.1, -8000); }

    shapesGroup = this.add.group();
    for (let i = 1; i <= totalRows + 2; i++) { spawnRow.call(this, 500 - (i * 250), i); }

    // 2. Characters (Fixed positioning)
    player = this.add.sprite(450, 550, 'kangaroo').setScale(0.35).setDepth(100).setTint(0x2E86AB);

    // Enhanced glow effect for player
    const playerGlow = this.add.graphics();
    playerGlow.lineStyle(3, 0x2E86AB, 0.5);
    playerGlow.strokeCircle(player.x, player.y, 40);
    playerGlow.setDepth(99);

    const colors = [0xF4A460, 0xF39C12, 0xFF6B35];
    for (let i = 0; i < 3; i++) {
        let ai = this.add.sprite(250 + (i * 200), 550, 'kangaroo').setTint(colors[i]).setScale(0.25).setDepth(90);
        ai.speed = 0.6 + (Math.random() * 0.4);
        opponents.push(ai);
    }

    this.cameras.main.startFollow(player, true, 0, 0.1, 0, 150);

    // 3. Start System
    document.getElementById('start-btn').onclick = function () {
        startAdaptiveGame.call(this);
    };
}

function startAdaptiveGame() {
    // Initialize adaptive parameters
    adaptiveLevel = 1; // Start at Low level
    playerAccuracy = 0;

    // Set initial time based on adaptive level
    switch (adaptiveLevel) {
        case 1: timeLimit = 120; break; // Low: 2 minutes
        case 2: timeLimit = 90; break;  // Medium: 1.5 minutes
        case 3: timeLimit = 60; break;  // High: 1 minute
    }

    document.getElementById('start-screen').classList.add('hidden');
    setupAdaptiveDifficulty.call(this);
    startCountdown.call(this);
}

function setupAdaptiveDifficulty() {
    // Adjust AI speed based on adaptive level
    opponents.forEach((ai, i) => {
        let baseSpeed;
        switch (adaptiveLevel) {
            case 1: baseSpeed = 0.2; break;  // Low: slower
            case 2: baseSpeed = 0.35; break; // Medium: moderate
            case 3: baseSpeed = 0.5; break;  // High: faster
        }
        ai.speed = baseSpeed + (Math.random() * 0.1) + (i * 0.02);
        console.log(`🤖 AI ${i + 1} speed: ${ai.speed.toFixed(2)} (${getLevelName(adaptiveLevel)})`);
    });
}

function updateAdaptiveDifficulty() {
    // Calculate current accuracy
    if (totalAttempts > 0) {
        playerAccuracy = correctClicks / totalAttempts;
    }

    // Adaptive difficulty adjustment - check every 5 attempts
    if (totalAttempts > 0 && totalAttempts % 5 === 0) {
        console.log(`🔍 Checking: attempts=${totalAttempts}, accuracy=${(playerAccuracy * 100).toFixed(1)}%, level=${getLevelName(adaptiveLevel)}`);

        // Three-level system thresholds
        if (playerAccuracy >= 0.6 && adaptiveLevel < 3) {
            adaptiveLevel++; // Increase difficulty
            console.log(`⬆️ Difficulty INCREASED to ${getLevelName(adaptiveLevel)}`);

            // Update time limit immediately
            switch (adaptiveLevel) {
                case 1: timeLimit = 120; break; // Low: 2 minutes
                case 2: timeLimit = 90; break;  // Medium: 1.5 minutes
                case 3: timeLimit = 60; break;  // High: 1 minute
            }
            console.log(`⏱️ Time limit REDUCED to ${timeLimit} seconds`);

            // Show visual alert
            showAdaptiveAlert('Difficulty Increased!', `${getLevelName(adaptiveLevel)} - ${timeLimit / 60} min!`, '#e74c3c');

        } else if (playerAccuracy < 0.4 && adaptiveLevel > 1) {
            adaptiveLevel--; // Decrease difficulty if accuracy drops below 40%
            console.log(`⬇️ Difficulty DECREASED to ${getLevelName(adaptiveLevel)}`);

            // Update time limit immediately
            switch (adaptiveLevel) {
                case 1: timeLimit = 120; break; // Low: 2 minutes
                case 2: timeLimit = 90; break;  // Medium: 1.5 minutes
                case 3: timeLimit = 60; break;  // High: 1 minute
            }
            console.log(`⏱️ Time limit INCREASED to ${timeLimit} seconds`);

            // Show visual alert
            showAdaptiveAlert('Difficulty Decreased!', `${getLevelName(adaptiveLevel)} - ${timeLimit / 60} min!`, '#27ae60');
        }

        // Update AI speeds dynamically
        setupAdaptiveDifficulty.call(this);

        // Show difficulty indicator
        document.getElementById('rate-val').innerText = `${getLevelName(adaptiveLevel)} | ${Math.round(playerAccuracy * 100)}%`;
    }
}

function getLevelName(level) {
    switch (level) {
        case 1: return 'Low';
        case 2: return 'Medium';
        case 3: return 'High';
        default: return 'Unknown';
    }
}

function showAdaptiveAlert(title, message, color) {
    // Create visual alert for adaptive changes
    const alertEl = document.createElement('div');
    alertEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${color};
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        font-size: 24px;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        animation: alertPulse 2s ease-in-out;
    `;
    alertEl.innerHTML = `<div style="font-size: 28px; margin-bottom: 10px;">${title}</div><div>${message}</div>`;
    document.body.appendChild(alertEl);

    // Remove alert after 3 seconds
    setTimeout(() => {
        if (alertEl.parentNode) {
            alertEl.parentNode.removeChild(alertEl);
        }
    }, 3000);
}

function startCountdown() {
    let count = 3;
    const cdText = document.getElementById('countdown');
    cdText.classList.remove('hidden');

    const timer = setInterval(() => {
        count--;
        if (count > 0) { cdText.innerText = count; }
        else if (count === 0) { cdText.innerText = "GO!"; }
        else {
            clearInterval(timer);
            cdText.classList.add('hidden');
            gameStarted = true;
            startTime = Date.now();
            document.getElementById('shape-prompt-label').classList.remove('hidden');
            setNextTarget();
        }
    }, 1000);
}

function spawnRow(yPos, id) {
    let rowOptions = Phaser.Utils.Array.Shuffle([...shapesList]).slice(0, 4);
    rowOptions.forEach((name, i) => {
        let container = this.add.container(140 + (i * 175), yPos);

        // Enhanced shadow
        let shadow = this.add.graphics().fillStyle(0x333333, 0.3).fillEllipse(0, 30, 120, 55);

        // Shape with better contrast
        let shapeGfx = this.add.graphics();
        shapeGfx.fillStyle(0xFFD700).setScale(1, 0.8);
        shapeGfx.lineStyle(3, 0x000000, 0.8);
        drawShape(shapeGfx, name);

        // Add white outline
        let outline = this.add.graphics();
        outline.lineStyle(2, 0xffffff, 1);
        drawShape(outline, name);

        container.add([shadow, shapeGfx, outline]);
        container.setSize(120, 100).setInteractive().name = name;
        container.rowId = id;
        container.on('pointerdown', () => {
            if (gameStarted && container.rowId === currentRowIndex + 1) handleInput.call(this, container);
        });
        shapesGroup.add(container);
    });
}

function drawShape(gfx, name) {
    if (name === 'circle') gfx.fillCircle(0, 0, 35);
    else if (name === 'square') gfx.fillRect(-35, -35, 70, 70);
    else if (name === 'trapezoid') gfx.fillPoints([{ x: -50, y: 30 }, { x: 50, y: 30 }, { x: 25, y: -30 }, { x: -25, y: -30 }], true);
    else if (name === 'hexagon') gfx.fillPoints([{ x: 0, y: -40 }, { x: 38, y: -20 }, { x: 38, y: 20 }, { x: 0, y: 40 }, { x: -38, y: 20 }, { x: -38, y: -20 }], true);
    else if (name === 'cone') { gfx.fillTriangle(0, -45, -35, 20, 35, 20); gfx.fillEllipse(0, 20, 70, 25); }
    else if (name === 'cylinder') { gfx.fillRect(-35, -30, 70, 60); gfx.fillEllipse(0, -30, 70, 20); gfx.fillEllipse(0, 30, 70, 20); }
    else if (name === 'rhombus') gfx.fillPoints([{ x: 0, y: -45 }, { x: 45, y: 0 }, { x: 0, y: 45 }, { x: -45, y: 0 }], true);
    else if (name === 'rectangle') gfx.fillRect(-55, -25, 110, 50);
    else if (name === 'octagon') gfx.fillPoints([{ x: -18, y: -38 }, { x: 18, y: -38 }, { x: 38, y: -18 }, { x: 38, y: 18 }, { x: 18, y: 38 }, { x: -18, y: 38 }, { x: -38, y: 18 }, { x: -38, y: -18 }], true);
    else if (name === 'pentagon') gfx.fillPoints([{ x: 0, y: -40 }, { x: 38, y: -10 }, { x: 25, y: 35 }, { x: -25, y: 35 }, { x: -38, y: -10 }], true);
    else if (name === 'sphere') { gfx.fillCircle(0, 0, 35); gfx.lineStyle(2, 0xffffff, 0.4); gfx.strokeEllipse(0, 0, 70, 20); }
    else if (name === 'cube') { gfx.fillRect(-35, -35, 70, 70); gfx.lineStyle(2, 0x000000, 0.2); gfx.strokeRect(-25, -25, 70, 70); }
}

function handleInput(target) {
    totalAttempts++;
    console.log(`📊 Answer ${totalAttempts}: ${target.name === currentTarget ? 'CORRECT' : 'WRONG'} (Target: ${currentTarget})`);

    if (target.name === currentTarget) {
        correctClicks++;
        currentRowIndex++;
        combo++;
        if (combo > bestCombo) bestCombo = combo;
        score += 100 * (1 + combo * 0.1);

        // Adaptive bonus: easier shapes if struggling
        if (playerAccuracy < 0.5 && Math.random() < 0.3) {
            // Give easier shape next time
            console.log('Player struggling, will provide easier shapes');
        }

        this.tweens.add({
            targets: player,
            x: target.x,
            y: target.y - 15,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                setNextTarget();
                updateAdaptiveDifficulty.call(this); // Check for difficulty adjustment
            }
        });
    } else {
        missedShapes.add(currentTarget);
        combo = 0;

        // Show hint immediately when wrong answer
        showAdaptiveHint(currentTarget);

        this.cameras.main.shake(100, 0.005);
        this.tweens.add({
            targets: player,
            alpha: 0,
            y: player.y + 60,
            duration: 400,
            onComplete: () => {
                player.setAlpha(1).y -= 60;
                updateAdaptiveDifficulty.call(this); // Check for difficulty adjustment
            }
        });
    }
}

function setNextTarget() {
    let nextRow = shapesGroup.getChildren().filter(s => s.rowId === currentRowIndex + 1);
    if (nextRow.length > 0) {
        // Adaptive shape selection
        let selectedShape;

        if (playerAccuracy < 0.4) {
            // Struggling: prioritize basic shapes
            const basicShapes = ['circle', 'square', 'rectangle'];
            const availableBasic = nextRow.filter(s => basicShapes.includes(s.name));
            selectedShape = availableBasic.length > 0 ?
                Phaser.Utils.Array.GetRandom(availableBasic) :
                Phaser.Utils.Array.GetRandom(nextRow);
        } else if (playerAccuracy > 0.8) {
            // Doing well: include complex shapes
            selectedShape = Phaser.Utils.Array.GetRandom(nextRow);
        } else {
            // Average: random selection
            selectedShape = Phaser.Utils.Array.GetRandom(nextRow);
        }

        currentTarget = selectedShape.name;
        document.getElementById('shape-prompt-label').innerText = currentTarget;
    }
}

function showAdaptiveHint(shape) {
    const hints = {
        'rhombus': 'Diamond shape with 4 equal sides',
        'hexagon': '6-sided shape like a honeycomb',
        'cylinder': '3D shape with circular top and bottom',
        'trapezoid': '4-sided shape with one pair of parallel sides',
        'cone': '3D shape with circular base and pointy top',
        'sphere': 'Perfectly round 3D ball shape',
        'cube': '3D box with 6 square faces',
        'rectangle': '4-sided shape with opposite sides equal',
        'octagon': '8-sided shape like a stop sign',
        'pentagon': '5-sided shape like a house',
        'circle': 'Perfectly round shape with no corners',
        'square': '4 equal sides and 4 right angles'
    };

    if (hints[shape]) {
        // Create side hint box
        const hintEl = document.createElement('div');
        hintEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: bold;
            z-index: 2000;
            box-shadow: 0 5px 15px rgba(238, 90, 36, 0.4);
            border: 2px solid #fff;
            max-width: 250px;
            font-family: 'Segoe UI', sans-serif;
            animation: slideIn 0.3s ease-out;
        `;
        hintEl.innerHTML = `<div style="font-size: 16px; margin-bottom: 5px;">💡 Hint</div><div>${hints[shape]}</div>`;
        document.body.appendChild(hintEl);

        // Remove hint after 4 seconds
        setTimeout(() => {
            if (hintEl.parentNode) {
                hintEl.parentNode.removeChild(hintEl);
            }
        }, 4000);
    }
}

function update() {
    if (!gameStarted) return;
    let elapsed = Math.floor((Date.now() - startTime) / 1000);
    let remainingTime = Math.max(0, timeLimit - elapsed);

    // Update accuracy and check for adaptive adjustment
    updateAdaptiveDifficulty.call(this);

    document.getElementById('timer-val').innerText = `${Math.floor(remainingTime / 60).toString().padStart(2, '0')}:${(remainingTime % 60).toString().padStart(2, '0')}`;
    let rate = elapsed > 0 ? Math.round((correctClicks / elapsed) * 60) : 0;
    // Don't overwrite rate display - let adaptive system handle it

    // Check time limit OR completion condition
    if ((remainingTime <= 0 || currentRowIndex >= totalRows) && !player.finished) {
        player.finished = true;
        finishers.push("Player (You)");
        endGame();
        return;
    }

    opponents.forEach((ai, i) => {
        if (!ai.finished) {
            ai.y -= ai.speed;
            if (ai.y < 500 - (totalRows * 250)) {
                ai.finished = true;
                finishers.push(`Computer ${i + 1}`);
            }
        }
    });
}

function endGame() {
    gameStarted = false;
    document.getElementById('shape-prompt-label').classList.add('hidden');
    document.getElementById('results-overlay').classList.remove('hidden');

    // Calculate results
    const accuracy = totalAttempts > 0 ? Math.round((correctClicks / totalAttempts) * 100) : 0;
    const completionReason = currentRowIndex >= totalRows ?
        `Completed in ${Math.floor((Date.now() - startTime) / 1000)}s` :
        `Time's up!`;

    // Update results screen
    document.getElementById('accuracy-val').innerText = accuracy + "%";
    document.getElementById('missed-list').innerText = Array.from(missedShapes).join(', ') || "None!";
    document.getElementById('leaderboard-body').innerHTML = finishers.map((n, i) => `<tr><td>${i + 1}</td><td>${n}</td><td>${completionReason}</td></tr>`).join('');

    // Update title based on performance
    const playerRank = finishers.findIndex(f => f.includes('Player'));
    let title = currentRowIndex >= totalRows ? '🏆 Victory! You Completed All Levels!' : 'Time\'s Up!';
    if (playerRank === 0 && currentRowIndex < totalRows) title = '🏆 Victory! You Won!';
    else if (playerRank === 1) title = '🥈 Second Place!';
    else if (playerRank === 2) title = '🥉 Third Place!';
    document.getElementById('results-title').innerText = title;

    // Fetch AI post-game report
    fetchKangAIReport(accuracy);
}

async function fetchKangAIReport(accuracy) {
    try {
        const res = await fetch('/api/ai_report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score: Math.round(score),
                total_questions: totalAttempts,
                correct: correctClicks,
                wrong_answers: Array.from(missedShapes).map(s => `Missed: ${s}`).slice(-5),
                difficulty_progression: getLevelName(adaptiveLevel),
                topic: 'Geometry - Shape Recognition',
                max_streak: bestCombo,
                game_name: 'Kangaroo Jump'
            })
        });
        const data = await res.json();
        if (data.success && data.report) {
            // Create AI report element in results
            let reportEl = document.getElementById('kangAIReport');
            if (!reportEl) {
                reportEl = document.createElement('div');
                reportEl.id = 'kangAIReport';
                reportEl.style.cssText = 'background:#f0f4ff; border:1px solid #667eea; border-radius:10px; padding:14px; margin:12px 0; font-size:13px; color:#2d3748; text-align:left; line-height:1.5;';
                const missedContainer = document.querySelector('.missed-container');
                if (missedContainer) missedContainer.after(reportEl);
                else document.querySelector('.results-content').appendChild(reportEl);
            }
            reportEl.innerHTML = '<strong style="color:#667eea;">\ud83e\udd16 AI Analysis:</strong> ' + data.report;
        }
    } catch (e) { console.error('AI report error:', e); }
}
