/**
 * Math Runner Game - Wave-Based Lane Runner
 * 
 * CONCEPT: Player runs forward in 3 lanes. Answer gates approach.
 * Each wave = 1 question + 3 gates (1 correct, 2 wrong).
 * Player switches lanes to pick the right answer.
 * Feels like Temple Run / Subway Surfers meets math.
 */

class RunnerGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 800;
        this.canvas.height = 400;

        // Config (overridden by session if available)
        this.gameConfig = null;
        this.sessionId = null;
        this.studentId = null;

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;
        this.score = 0;
        this.lives = 5;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.startTime = null;
        this.timerInterval = null;
        this.questionStartTime = null;

        // ── Adaptive Difficulty ──
        this.currentDifficulty = 'easy'; // Start on easy
        this.consecutiveCorrect = 0;
        this.consecutiveWrong = 0;
        // Speed per difficulty level
        this.difficultySpeed = { easy: 2.5, medium: 3.5, hard: 5 };
        // Points per difficulty level
        this.difficultyPoints = { easy: 10, medium: 15, hard: 25 };
        // Wave gap per difficulty (more time on easy)
        this.difficultyGap = { easy: 700, medium: 550, hard: 420 };

        // Lanes
        this.lanes = [0, 1, 2]; // top, middle, bottom
        this.laneY = [100, 200, 300]; // Y centers for each lane
        this.playerLane = 1; // start in middle
        this.targetLane = 1;

        // Player
        this.player = {
            x: 120,
            y: this.laneY[1],
            width: 50,
            height: 50,
            targetY: this.laneY[1],
            emoji: '🏃'
        };

        // Speed
        this.gameSpeed = this.difficultySpeed.easy;
        this.speedMultiplier = 1;
        this.baseSpeed = 2.5;
        this.maxSpeed = 7;

        // Waves / Gates
        this.gates = []; // {x, laneIndex, answer, isCorrect, hit}
        this.currentQuestion = null;
        this.nextWaveX = 900; // Where the next wave spawns
        this.waveGap = this.difficultyGap.easy;
        this.wavesPassed = 0;

        // Visual
        this.roadLines = [];
        this.particles = [];
        this.shakeTimer = 0;
        this.flashColor = null;
        this.flashTimer = 0;
        this.comboCount = 0;
        this.comboTexts = [];
        this.distance = 0;

        // Theme colors
        this.colors = {
            road: '#2d3748',
            lane: '#4a5568',
            divider: '#a0aec0',
            correct: '#48bb78',
            wrong: '#f56565',
            neutral: '#667eea',
            sky: '#1a202c',
            ground: '#2d3748'
        };

        // AI Integration
        this.aiTopic = null;
        this.wrongAnswers = [];
        this.previousQuestions = [];
        this.loadAITopic();

        this.init();
    }

    loadAITopic() {
        try {
            const cfg = JSON.parse(sessionStorage.getItem('aiTopicConfig') || '{}');
            if (cfg.topic) {
                this.aiTopic = cfg;
                console.log('Runner AI Topic loaded:', cfg);
            }
            this.customPrompt = sessionStorage.getItem('aiCustomPrompt') || '';
        } catch (e) { console.log('No AI topic config'); }
    }

    async init() {
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'play' && pathParts[2]) {
            this.sessionId = pathParts[2].toUpperCase();
            await this.loadFromSession();
        } else {
            await this.loadFromStorage();
        }
        this.applyConfiguration();
        await this.registerStudent();
        this.setupEventListeners();
        this.initRoadLines();
        this.gameLoop();
    }

    // ===================== CONFIG LOADING =====================

    async loadFromSession() {
        try {
            const response = await fetch(`/api/session_config/${this.sessionId}`);
            const data = await response.json();
            if (data.success) {
                this.gameConfig = data.config;
                return;
            }
        } catch (e) {
            console.log('Session load failed, using defaults');
        }
        this.loadDefaultConfig();
    }

    async loadFromStorage() {
        const stored = sessionStorage.getItem('gameConfig');
        if (stored) {
            try {
                this.gameConfig = JSON.parse(stored);
                return;
            } catch (e) { }
        }
        this.loadDefaultConfig();
    }

    loadDefaultConfig() {
        this.gameConfig = {
            class_level: 3,
            operations: ['addition', 'subtraction'],
            difficulty: 'easy',
            speed_baseline: 'normal',
            theme: 'default',
            session_config: { questions_per_round: 15, adaptive_difficulty: true }
        };
    }

    applyConfiguration() {
        if (!this.gameConfig) return;
        const speedMap = { slow: 0.7, normal: 1.0, fast: 1.4 };
        this.speedMultiplier = speedMap[this.gameConfig.speed_baseline] || 1.0;
    }

    getRandomOperation() {
        const ops = this.gameConfig?.operations || ['addition'];
        return ops[Math.floor(Math.random() * ops.length)];
    }

    async registerStudent() {
        this.studentId = 'runner_' + Date.now();
        try {
            await fetch('/api/register_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    class: this.gameConfig?.class_level || 3
                })
            });
        } catch (e) { }
    }

    // ===================== EVENT LISTENERS =====================

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.isRunning || this.gameOver) return;

            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    e.preventDefault();
                    this.switchLane(-1);
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    e.preventDefault();
                    this.switchLane(1);
                    break;
                case ' ':
                    e.preventDefault();
                    // Space acts as "confirm" — doesn't move
                    break;
            }
        });

        // Touch/swipe support
        let touchStartY = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });
        this.canvas.addEventListener('touchend', (e) => {
            const deltaY = e.changedTouches[0].clientY - touchStartY;
            if (Math.abs(deltaY) > 30) {
                this.switchLane(deltaY > 0 ? 1 : -1);
            }
        });
    }

    switchLane(direction) {
        if (this.isPaused) return;
        const newLane = this.playerLane + direction;
        if (newLane >= 0 && newLane <= 2) {
            this.playerLane = newLane;
            this.player.targetY = this.laneY[newLane];
        }
    }

    // ===================== ROAD VISUALS =====================

    initRoadLines() {
        for (let i = 0; i < 10; i++) {
            this.roadLines.push({ x: i * 100 });
        }
    }

    // ===================== GAME CONTROL =====================

    async startGame() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.gameOver = false;
        this.score = 0;
        this.lives = 5;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.comboCount = 0;
        this.distance = 0;
        this.wavesPassed = 0;
        this.gameSpeed = this.baseSpeed * this.speedMultiplier;
        this.gates = [];
        this.particles = [];
        this.comboTexts = [];
        this.nextWaveX = 700;

        this.playerLane = 1;
        this.player.y = this.laneY[1];
        this.player.targetY = this.laneY[1];

        // Fetch first question and spawn first wave
        await this.fetchQuestion();
        this.spawnWave();

        this.startTime = Date.now();
        this.questionStartTime = Date.now();
        this.startTimer();

        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        const banner = document.getElementById('questionBanner');
        if (banner) banner.style.display = 'block';
        this.updateStats();
    }

    pauseGame() {
        this.isPaused = !this.isPaused;
        document.getElementById('pauseBtn').textContent = this.isPaused ? '▶️ Resume' : '⏸️ Pause';
    }

    resetGame() {
        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;
        this.gates = [];
        this.particles = [];
        this.comboTexts = [];
        this.stopTimer();
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        const banner = document.getElementById('questionBanner');
        if (banner) banner.style.display = 'none';
        this.updateStats();
    }

    // ===================== QUESTION FETCHING =====================

    async fetchQuestion() {
        // If AI topic is set, use AI-generated questions first
        if (this.aiTopic) {
            try {
                const res = await fetch('/api/ai_question', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: this.aiTopic.topic,
                        subtopic: this.aiTopic.subtopic,
                        difficulty: this.currentDifficulty,
                        previous_questions: this.previousQuestions.slice(-8),
                        custom_prompt: this.customPrompt || ''
                    })
                });
                const data = await res.json();
                if (data.success && data.options && data.options.length >= 3) {
                    this.previousQuestions.push(data.question);
                    this.currentQuestion = {
                        question: data.question,
                        correct_answer: data.answer,
                        answers: data.options.slice(0, 3),
                        question_id: 'ai_' + Date.now(),
                        topic: data.subtopic,
                        difficulty: data.difficulty,
                        explanation: data.explanation
                    };
                    // Ensure correct answer is in the 3 choices
                    if (!this.currentQuestion.answers.includes(data.answer)) {
                        this.currentQuestion.answers[Math.floor(Math.random() * 3)] = data.answer;
                    }
                    this.updateQuestionDisplay();
                    return;
                }
            } catch (e) { console.error('AI question fetch failed:', e); }
        }

        // Fallback: trig dataset
        if (typeof questions !== 'undefined' && questions.length > 0) {
            this.pickTrigQuestion();
            return;
        }

        // Fallback: backend API
        try {
            const op = this.getRandomOperation();
            const response = await fetch('/api/generate_question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    class: this.gameConfig.class_level || 3,
                    operation: op,
                    game_type: 'runner',
                    theme: this.gameConfig.theme || 'default'
                })
            });
            const data = await response.json();
            if (data.success) {
                this.currentQuestion = data.question;
                this.updateQuestionDisplay();
            }
        } catch (e) {
            console.error('Question fetch failed:', e);
            this.currentQuestion = this.generateLocalQuestion();
            this.updateQuestionDisplay();
        }
    }

    pickTrigQuestion() {
        if (!this.usedQuestionIndices) this.usedQuestionIndices = new Set();

        // ── Adaptive: filter by current difficulty ──
        const targetDiff = this.currentDifficulty;
        const pool = questions
            .map((q, i) => ({ ...q, _idx: i }))
            .filter(q => q.difficulty === targetDiff && !this.usedQuestionIndices.has(q._idx));

        // Fallback: if no questions left at this difficulty, try any difficulty
        const fallbackPool = pool.length > 0 ? pool :
            questions.map((q, i) => ({ ...q, _idx: i })).filter(q => !this.usedQuestionIndices.has(q._idx));

        // Reset if truly exhausted
        if (fallbackPool.length === 0) {
            this.usedQuestionIndices.clear();
            return this.pickTrigQuestion();
        }

        const chosen = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
        this.usedQuestionIndices.add(chosen._idx);

        const correctAnswer = chosen.a;

        // Generate distractors
        let allChoices;
        if (typeof generateMultipleChoices === 'function') {
            allChoices = generateMultipleChoices(correctAnswer, chosen.topic);
        } else {
            allChoices = [correctAnswer, '???', '???'];
        }

        const choiceSet = new Set([correctAnswer]);
        for (const c of allChoices) {
            if (choiceSet.size >= 3) break;
            if (c !== undefined && c !== null) choiceSet.add(c);
        }
        const finalChoices = Array.from(choiceSet);

        this.currentQuestion = {
            question: chosen.q,
            correct_answer: correctAnswer,
            answers: finalChoices,
            question_id: 'trig_' + chosen._idx,
            topic: chosen.topic,
            difficulty: chosen.difficulty
        };

        this.updateQuestionDisplay();
    }

    updateQuestionDisplay() {
        if (!this.currentQuestion) return;
        const qEl = document.getElementById('questionText');
        if (qEl) qEl.textContent = this.currentQuestion.question;
        const bEl = document.getElementById('bannerQuestionText');
        if (bEl) bEl.textContent = this.currentQuestion.question + ' = ?';
    }

    // ===================== WAVE SPAWNING =====================

    spawnWave() {
        if (!this.currentQuestion) return;

        const correct = this.currentQuestion.correct_answer;

        // Build exactly 3 answers: 1 correct + 2 wrong
        const wrongPool = (this.currentQuestion.answers || [])
            .filter(a => a !== correct && a !== undefined && a !== null);

        // Pick 2 wrong answers from pool, or generate random ones
        const wrongs = [];
        const usedAnswers = new Set([correct]);
        for (const w of wrongPool) {
            if (wrongs.length >= 2) break;
            if (!usedAnswers.has(w)) {
                wrongs.push(w);
                usedAnswers.add(w);
            }
        }
        // Fill remaining with random wrong answers
        while (wrongs.length < 2) {
            const w = correct + Math.floor(Math.random() * 11) - 5;
            if (w > 0 && !usedAnswers.has(w)) {
                wrongs.push(w);
                usedAnswers.add(w);
            }
        }

        const answers = [correct, wrongs[0], wrongs[1]];

        // Shuffle lane assignment
        const laneOrder = [0, 1, 2];
        for (let i = 2; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [laneOrder[i], laneOrder[j]] = [laneOrder[j], laneOrder[i]];
        }

        for (let i = 0; i < 3; i++) {
            this.gates.push({
                x: this.nextWaveX,
                laneIndex: laneOrder[i],
                answer: answers[i],
                isCorrect: answers[i] === correct,
                hit: false,
                width: 140,
                height: 60
            });
        }

        this.nextWaveX += this.waveGap;
    }

    // ===================== GAME UPDATE =====================

    update() {
        if (!this.isRunning || this.isPaused || this.gameOver) return;

        // Smooth lane switching
        const dy = this.player.targetY - this.player.y;
        this.player.y += dy * 0.2;

        // Move gates toward player
        for (let i = this.gates.length - 1; i >= 0; i--) {
            const gate = this.gates[i];
            gate.x -= this.gameSpeed;

            // Check collision
            if (!gate.hit && this.playerLane === gate.laneIndex) {
                const px = this.player.x;
                const gx = gate.x;
                if (px + this.player.width > gx && px < gx + gate.width) {
                    gate.hit = true;
                    this.handleGateHit(gate);
                }
            }

            // Remove gates that are way off screen
            if (gate.x < -100) {
                this.gates.splice(i, 1);
            }
        }

        // Check if all gates in current wave are past player → spawn next wave
        const activeGates = this.gates.filter(g => g.x > this.player.x - 50);
        if (activeGates.length === 0 && this.gates.length === 0) {
            this.spawnWave();
        }

        // Update road lines
        this.roadLines.forEach(line => {
            line.x -= this.gameSpeed;
            if (line.x < -20) line.x += 1000;
        });

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update combo texts
        for (let i = this.comboTexts.length - 1; i >= 0; i--) {
            const ct = this.comboTexts[i];
            ct.y -= 1.5;
            ct.life -= 0.02;
            if (ct.life <= 0) this.comboTexts.splice(i, 1);
        }

        // Shake timer
        if (this.shakeTimer > 0) this.shakeTimer--;
        if (this.flashTimer > 0) this.flashTimer--;

        // Increase distance
        this.distance += this.gameSpeed * 0.1;

        // Speed is set by adaptive difficulty — no random acceleration
    }

    handleGateHit(gate) {
        this.totalQuestions++;
        const timeTaken = this.questionStartTime ? (Date.now() - this.questionStartTime) / 1000 : 10;

        if (gate.isCorrect) {
            // ── CORRECT ──
            this.correctAnswers++;
            this.comboCount++;
            this.consecutiveCorrect++;
            this.consecutiveWrong = 0;

            // Scoring: base (by difficulty) + combo bonus + time bonus
            const basePoints = this.difficultyPoints[this.currentDifficulty] || 10;
            const comboBonus = this.comboCount >= 5 ? 10 : this.comboCount >= 3 ? 5 : 0;
            const timeBonus = timeTaken < 3 ? 5 : timeTaken < 6 ? 3 : 0;
            const points = basePoints + comboBonus + timeBonus;
            this.score += points;

            // ── Adaptive: promote difficulty after 3 consecutive correct ──
            if (this.consecutiveCorrect >= 3) {
                this.consecutiveCorrect = 0;
                if (this.currentDifficulty === 'easy') {
                    this.currentDifficulty = 'medium';
                    this.showFeedback('📈 Difficulty UP → MEDIUM', 'success');
                } else if (this.currentDifficulty === 'medium') {
                    this.currentDifficulty = 'hard';
                    this.showFeedback('📈 Difficulty UP → HARD', 'success');
                }
                // Update speed and wave gap for new difficulty
                this.gameSpeed = this.difficultySpeed[this.currentDifficulty] * this.speedMultiplier;
                this.waveGap = this.difficultyGap[this.currentDifficulty];
            }

            // Green flash
            this.flashColor = 'rgba(72, 187, 120, 0.3)';
            this.flashTimer = 15;

            // Celebration particles
            for (let i = 0; i < 15; i++) {
                this.particles.push({
                    x: this.player.x + 25, y: this.player.y,
                    vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
                    color: ['#48bb78', '#68d391', '#ffd700', '#ffffff'][Math.floor(Math.random() * 4)],
                    life: 1, size: Math.random() * 5 + 2
                });
            }

            // Combo floating text
            let comboMsg = `+${points}`;
            if (this.comboCount >= 5) comboMsg = `🔥 x${this.comboCount}! +${points}`;
            else if (this.comboCount >= 3) comboMsg = `⚡ x${this.comboCount} +${points}`;
            if (timeBonus > 0) comboMsg += ` ⏱`;
            this.comboTexts.push({ text: comboMsg, x: this.player.x + 60, y: this.player.y - 10, life: 1, color: '#48bb78' });

            this.showFeedback(`✅ Correct! +${points} (${this.currentDifficulty.toUpperCase()})`, 'success');
            this.submitAndFetchNext(gate.answer, true);
            this.gates.forEach(g => { if (Math.abs(g.x - gate.x) < 20) g.hit = true; });

        } else {
            // ── WRONG ──
            this.lives--;
            this.comboCount = 0;
            this.consecutiveWrong++;
            this.consecutiveCorrect = 0;

            // No score penalty — just miss the points
            // this.score stays the same

            // ── Adaptive: demote difficulty after 2 consecutive wrong ──
            if (this.consecutiveWrong >= 2) {
                this.consecutiveWrong = 0;
                if (this.currentDifficulty === 'hard') {
                    this.currentDifficulty = 'medium';
                    this.showFeedback('📉 Difficulty DOWN → MEDIUM', 'error');
                } else if (this.currentDifficulty === 'medium') {
                    this.currentDifficulty = 'easy';
                    this.showFeedback('📉 Difficulty DOWN → EASY', 'error');
                }
            }

            // ── SLOW DOWN on wrong — recovery mechanic ──
            this.gameSpeed = this.difficultySpeed[this.currentDifficulty] * this.speedMultiplier;
            this.waveGap = this.difficultyGap[this.currentDifficulty];

            // Red flash + shake
            this.flashColor = 'rgba(245, 101, 101, 0.3)';
            this.flashTimer = 20;
            this.shakeTimer = 15;

            for (let i = 0; i < 10; i++) {
                this.particles.push({
                    x: this.player.x + 25, y: this.player.y,
                    vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                    color: '#f56565', life: 1, size: Math.random() * 4 + 2
                });
            }

            this.comboTexts.push({
                text: `❌ Answer: ${this.currentQuestion?.correct_answer}`,
                x: this.player.x + 60, y: this.player.y - 10, life: 1.5, color: '#f56565'
            });

            this.showFeedback(`❌ Wrong! Answer was: ${this.currentQuestion?.correct_answer}`, 'error');

            // Track wrong answers for AI report
            this.wrongAnswers.push(`Q: ${this.currentQuestion?.question}, answered: ${gate.answer}, correct: ${this.currentQuestion?.correct_answer}`);

            // Fetch AI hint
            this.fetchAIHint();

            if (this.lives <= 0) { this.endGame(false); return; }

            this.submitAndFetchNext(gate.answer, false);
            this.gates.forEach(g => { if (Math.abs(g.x - gate.x) < 20) g.hit = true; });
        }

        this.wavesPassed++;
        this.updateStats();
    }

    async submitAndFetchNext(answer, isCorrect) {
        const timeTaken = this.questionStartTime ? (Date.now() - this.questionStartTime) / 1000 : 0;

        try {
            fetch('/api/submit_answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    question_id: this.currentQuestion?.question_id,
                    answer: answer,
                    time_taken: timeTaken
                })
            });
        } catch (e) { }

        // Fetch next question
        this.questionStartTime = Date.now();
        await this.fetchQuestion();
        this.spawnWave();
    }

    // ===================== RENDERING =====================

    render() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;

        // Screen shake
        ctx.save();
        if (this.shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * 6;
            const sy = (Math.random() - 0.5) * 6;
            ctx.translate(sx, sy);
        }

        // Background - dark gradient
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#0f0c29');
        bg.addColorStop(0.5, '#302b63');
        bg.addColorStop(1, '#24243e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // Road / lane area
        const roadTop = 60;
        const roadBottom = H - 20;
        ctx.fillStyle = 'rgba(45, 55, 72, 0.8)';
        ctx.fillRect(0, roadTop, W, roadBottom - roadTop);

        // Lane dividers
        ctx.setLineDash([20, 15]);
        ctx.strokeStyle = 'rgba(160, 174, 192, 0.4)';
        ctx.lineWidth = 2;
        const laneDiv1 = (this.laneY[0] + this.laneY[1]) / 2 + 25;
        const laneDiv2 = (this.laneY[1] + this.laneY[2]) / 2 + 25;
        ctx.beginPath();
        ctx.moveTo(0, laneDiv1);
        ctx.lineTo(W, laneDiv1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, laneDiv2);
        ctx.lineTo(W, laneDiv2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Road lines (moving)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 3;
        this.roadLines.forEach(line => {
            ctx.beginPath();
            ctx.moveTo(line.x, roadTop);
            ctx.lineTo(line.x, roadBottom);
            ctx.stroke();
        });

        // Lane labels
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('▲ UP', 10, this.laneY[0] + 30);
        ctx.fillText('● MID', 10, this.laneY[1] + 30);
        ctx.fillText('▼ DOWN', 10, this.laneY[2] + 30);

        // Draw gates
        this.gates.forEach(gate => {
            if (gate.x > W + 50 || gate.x < -100) return;

            const gy = this.laneY[gate.laneIndex];
            const gx = gate.x;

            let color, borderColor;
            if (gate.hit) {
                color = gate.isCorrect ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)';
                borderColor = gate.isCorrect ? '#48bb78' : '#f56565';
            } else {
                // All gates look the same — neutral — player must know the answer
                color = 'rgba(102, 126, 234, 0.2)';
                borderColor = '#667eea';
            }

            // Gate shape
            ctx.fillStyle = color;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(gx, gy - gate.height / 2 + 25, gate.width, gate.height, 10);
            ctx.fill();
            ctx.stroke();

            // Answer text on gate — use smaller font for longer trig answers
            const answerStr = String(gate.answer);
            const fontSize = answerStr.length > 6 ? 14 : answerStr.length > 4 ? 18 : 22;
            ctx.fillStyle = gate.hit ? (gate.isCorrect ? '#48bb78' : '#f56565') : '#ffffff';
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(answerStr, gx + gate.width / 2, gy + 30);

            // Glow effect for approaching gates
            if (!gate.hit && gx < 300) {
                ctx.shadowColor = borderColor;
                ctx.shadowBlur = 15;
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.roundRect(gx - 2, gy - gate.height / 2 + 23, gate.width + 4, gate.height + 4, 12);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        });

        // Draw player
        ctx.font = '40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.player.emoji, this.player.x + 25, this.player.y + 38);

        // Player glow
        ctx.beginPath();
        ctx.arc(this.player.x + 25, this.player.y + 25, 30, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(102, 126, 234, 0.15)';
        ctx.fill();

        // Draw particles
        this.particles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Draw combo texts
        this.comboTexts.forEach(ct => {
            ctx.globalAlpha = ct.life;
            ctx.fillStyle = ct.color;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(ct.text, ct.x, ct.y);
        });
        ctx.globalAlpha = 1;

        // Flash overlay
        if (this.flashTimer > 0 && this.flashColor) {
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, W, H);
        }

        // Question text + difficulty badge on canvas
        if (this.isRunning && !this.gameOver && this.currentQuestion) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, W, 55);

            // Difficulty badge (left side)
            const diffColors = { easy: '#48bb78', medium: '#ecc94b', hard: '#f56565' };
            const diffEmoji = { easy: '🟢', medium: '🟡', hard: '🔴' };
            ctx.fillStyle = diffColors[this.currentDifficulty] || '#fff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${diffEmoji[this.currentDifficulty]} ${this.currentDifficulty.toUpperCase()}`, 12, 35);

            // Question text (center)
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('SOLVE:', W / 2, 18);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial';
            ctx.fillText(this.currentQuestion.question, W / 2, 45);

            // Score (right side)
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`⭐ ${this.score}`, W - 12, 35);
        }

        // "Press Start" screen
        if (!this.isRunning && !this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🏃 MATH RUNNER', W / 2, H / 2 - 30);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.fillText('Use ▲ ▼ Arrow Keys to switch lanes', W / 2, H / 2 + 10);
            ctx.fillText('Run through the gate with the correct answer!', W / 2, H / 2 + 38);
            ctx.fillStyle = '#48bb78';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('Press "Start Game" →', W / 2, H / 2 + 75);
        }

        // Paused
        if (this.isPaused && !this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⏸ PAUSED', W / 2, H / 2);
        }

        ctx.restore();
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    // ===================== STATS & UI =====================

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const el = document.getElementById('timer');
            if (el) el.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    updateStats() {
        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('score', this.score);
        el('lives', this.lives);
        el('speed', `${(this.gameSpeed / this.baseSpeed).toFixed(1)}x`);
        el('distance', `${Math.floor(this.distance)}m`);
        el('correctAnswers', this.correctAnswers);
    }

    endGame(victory) {
        this.isRunning = false;
        this.gameOver = true;
        this.stopTimer();

        const accuracy = this.totalQuestions > 0 ? Math.round(this.correctAnswers / this.totalQuestions * 100) : 0;
        const elapsed = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;

        const title = document.getElementById('gameOverTitle');
        const msg = document.getElementById('gameOverMessage');
        if (title) {
            title.textContent = victory ? '🏆 Victory!' : '💀 Game Over';
            title.className = 'game-over-title ' + (victory ? 'victory' : 'defeat');
        }
        if (msg) msg.textContent = victory
            ? `Amazing! You conquered the Math Runner!`
            : `You ran ${Math.floor(this.distance)}m and answered ${this.correctAnswers} questions correctly!`;

        const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        el('finalScore', this.score);
        el('finalDistance', `${Math.floor(this.distance)}m`);
        el('finalAccuracy', `${accuracy}%`);
        el('finalTime', `${mins}:${secs < 10 ? '0' : ''}${secs}`);

        document.getElementById('gameOverScreen').style.display = 'flex';

        // Fetch AI report
        this.fetchAIReport();
    }

    showFeedback(message, type) {
        const el = document.getElementById('feedbackMessage');
        if (!el) return;
        el.textContent = message;
        el.className = `feedback-message ${type}`;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 2500);
    }

    hideFeedback() {
        const el = document.getElementById('feedbackMessage');
        if (el) el.style.display = 'none';
    }

    // Legacy methods for overlay (not used in new design, but kept for compatibility)
    showQuestionOverlay() { }
    selectAnswer() { }
    confirmAnswer() { }
    generatePlatformsFromAnswer() { }
    generateInitialPlatforms() { }

    async fetchAIHint() {
        if (!this.currentQuestion) return;
        try {
            const res = await fetch('/api/ai_hint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: this.currentQuestion.question,
                    wrong_answer: 'incorrect',
                    correct_answer: String(this.currentQuestion.correct_answer),
                    topic: this.aiTopic?.topicLabel || this.currentQuestion.topic || 'math'
                })
            });
            const data = await res.json();
            if (data.success && data.hint) {
                this.showFeedback('💡 ' + data.hint, 'info');
            }
        } catch (e) { console.error('AI hint error:', e); }
    }

    async fetchAIReport() {
        try {
            const res = await fetch('/api/ai_report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    score: this.score,
                    total_questions: this.totalQuestions,
                    correct: this.correctAnswers,
                    wrong_answers: this.wrongAnswers.slice(-5),
                    difficulty_progression: this.currentDifficulty,
                    topic: this.aiTopic?.topicLabel || 'Trigonometry',
                    max_streak: this.comboCount,
                    game_name: 'Math Runner'
                })
            });
            const data = await res.json();
            if (data.success && data.report) {
                // Inject AI report into game-over screen
                const reportEl = document.getElementById('aiReport');
                if (reportEl) {
                    reportEl.textContent = data.report;
                    reportEl.style.display = 'block';
                }
            }
        } catch (e) { console.error('AI report error:', e); }
    }
}

// ============================================================================
// GLOBAL FUNCTIONS
// ============================================================================

let game;

function startGame() {
    if (game) game.startGame();
}

function pauseGame() {
    if (game) game.pauseGame();
}

function resetGame() {
    if (game) game.resetGame();
}

function confirmAnswer() {
    // No-op in new design
}

function playAgain() {
    document.getElementById('gameOverScreen').style.display = 'none';
    if (game) game.resetGame();
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    game = new RunnerGame();
});
