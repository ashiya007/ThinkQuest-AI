/**
 * Math Puzzle Quest - AI-Powered Puzzle Game
 * Features: Level progression, AI difficulty scaling, theme support, visual effects
 */

class PuzzleGame {
    constructor() {
        this.sessionId = null;
        this.studentId = null;
        this.gameConfig = null;

        // Level system - FIXED grid sizes per level
        this.level = 1;
        this.maxLevel = 5;
        this.levelGridSizes = {
            1: 2,  // 2x2 = 4 tiles
            2: 3,  // 3x3 = 9 tiles
            3: 4,  // 4x4 = 16 tiles
            4: 5,  // 5x5 = 25 tiles
            5: 6   // 6x6 = 36 tiles
        };

        // Difficulty scaling per level
        this.levelDifficulty = {
            1: { maxNumber: 10, operations: ['addition'] },
            2: { maxNumber: 15, operations: ['addition', 'subtraction'] },
            3: { maxNumber: 20, operations: ['addition', 'subtraction'] },
            4: { maxNumber: 25, operations: ['addition', 'subtraction', 'multiplication'] },
            5: { maxNumber: 30, operations: ['addition', 'subtraction', 'multiplication', 'division'] }
        };

        // Grid properties
        this.gridSize = 2;
        this.tiles = [];
        this.currentPosition = { x: 0, y: 0 };
        this.goalPosition = { x: 1, y: 1 };
        this.unlockedTiles = new Set();
        this.targetTile = null;

        // Game state
        this.score = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.isProcessing = false; // Prevent double-clicks

        // Timing
        this.startTime = null;
        this.levelStartTime = null;
        this.questionStartTime = null;
        this.timerInterval = null;

        // Theme
        this.theme = {
            characterEmoji: '🤖',
            goalEmoji: '🏁',
            correctEmoji: '✅',
            wrongEmoji: '❌',
            lockedEmoji: '🔒'
        };

        this.init();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    async init() {
        // Check for session
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'play' && pathParts[2]) {
            this.sessionId = pathParts[2].toUpperCase();
            await this.loadFromSession();
        } else {
            await this.loadFromStorage();
        }

        // Apply theme
        this.applyTheme();

        // Update start screen info
        this.updateStartScreen();
    }

    async loadFromSession() {
        try {
            this.studentId = prompt('Enter your Student ID:') || 'puzzle_' + Date.now();

            const res = await fetch('/api/join_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    student_id: this.studentId
                })
            });

            const data = await res.json();
            if (data.success) {
                this.gameConfig = data.game_config;
            } else {
                this.loadDefaultConfig();
            }
        } catch (e) {
            console.error('Session load failed:', e);
            this.loadDefaultConfig();
        }
    }

    async loadFromStorage() {
        const configData = sessionStorage.getItem('gameConfig');
        if (configData) {
            this.gameConfig = JSON.parse(configData);
        } else {
            this.loadDefaultConfig();
        }
        this.studentId = 'puzzle_' + Date.now();
    }

    loadDefaultConfig() {
        this.gameConfig = {
            class_level: 3,
            operations: ['addition'],
            difficulty: 'medium',
            theme: 'default',
            visual_assets: {
                primary_color: '#667eea',
                secondary_color: '#764ba2',
                character_emoji: '🤖',
                goal_emoji: '🏁'
            }
        };
    }

    applyTheme() {
        if (this.gameConfig.visual_assets) {
            const va = this.gameConfig.visual_assets;
            this.theme.characterEmoji = va.character_emoji || '🤖';
            this.theme.goalEmoji = va.goal_emoji || '🏁';
            this.theme.correctEmoji = va.correct_emoji || '✅';

            // Apply CSS variables
            document.documentElement.style.setProperty('--primary', va.primary_color || '#667eea');
            document.documentElement.style.setProperty('--secondary', va.secondary_color || '#764ba2');

            if (va.background_gradient) {
                document.body.style.background = va.background_gradient;
            }
        }
    }

    updateStartScreen() {
        const ops = (this.gameConfig.operations || ['addition']).join(', ');
        const classLevel = this.gameConfig.class_level || 3;
        const theme = this.gameConfig.theme || 'default';

        document.getElementById('configInfo').innerHTML = `
            <div style="font-size: 1.1rem; margin-bottom: 10px;">
                <strong>Class ${classLevel}</strong> • ${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme
            </div>
            <div style="opacity: 0.8;">Operations: ${ops}</div>
        `;

        // Show operations in game
        const opsList = document.getElementById('operationsList');
        if (opsList) {
            opsList.innerHTML = (this.gameConfig.operations || ['addition'])
                .map(op => `<span class="op-tag">${op}</span>`)
                .join('');
        }
    }

    // ========================================================================
    // GAME START & LEVEL MANAGEMENT
    // ========================================================================

    async startGame() {
        document.getElementById('startScreen').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';

        // Register student
        await this.registerStudent();

        // Start first level
        await this.initLevel();

        // Start global timer
        this.startTime = Date.now();
        this.startTimer();
    }

    async initLevel() {
        // Set FIXED grid size based on level
        this.gridSize = this.levelGridSizes[this.level] || 4;

        // Reset level state
        this.currentPosition = { x: 0, y: 0 };
        this.goalPosition = { x: this.gridSize - 1, y: this.gridSize - 1 };
        this.unlockedTiles = new Set();
        this.targetTile = null;
        this.currentQuestion = null;
        this.isProcessing = false;
        this.levelStartTime = Date.now();

        // Build grid
        this.createGrid();
        this.placeCharacter();
        this.highlightAdjacentTiles();

        // Update UI
        this.updateUI();
        document.getElementById('levelBadge').textContent = `Level ${this.level}`;
        document.getElementById('questionText').textContent = 'Loading next question...';
        document.getElementById('answerGrid').innerHTML = '';
        document.getElementById('submitBtn').disabled = true;
        this.hideFeedback();

        // Show level intro message
        this.showFeedback(`Level ${this.level}: ${this.gridSize}×${this.gridSize} grid - Solve to progress!`, 'hint');
        setTimeout(() => {
            this.hideFeedback();
            // Automatically find the first target and generate a question
            this.setNextTargetTile();
        }, 2000);
    }

    async generateLevelConfig() {
        try {
            const res = await fetch('/api/generate_level', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    game_type: 'puzzle',
                    current_level: this.level,
                    class_level: this.gameConfig.class_level || 3,
                    operations: this.gameConfig.operations || ['addition'],
                    player_accuracy: this.totalQuestions > 0 ? this.correctAnswers / this.totalQuestions : 0.5,
                    streak: this.streak
                })
            });

            const data = await res.json();
            if (data.success) {
                this.levelConfig = data.level_config;
                // Add grid size based on level
                this.levelConfig.grid_size = Math.min(3 + this.level, 7);
            } else {
                this.levelConfig = this.getDefaultLevelConfig();
            }
        } catch (e) {
            console.error('Level config generation failed:', e);
            this.levelConfig = this.getDefaultLevelConfig();
        }

        console.log('Level config:', this.levelConfig);
    }

    getDefaultLevelConfig() {
        return {
            level: this.level,
            grid_size: Math.min(3 + this.level, 7),
            max_number: 5 + (this.level * 3),
            operations: this.gameConfig.operations || ['addition'],
            bonus_multiplier: 1 + (this.level * 0.1),
            level_message: `Level ${this.level} - Good luck!`
        };
    }

    async registerStudent() {
        try {
            await fetch('/api/register_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    class: this.gameConfig.class_level || 3
                })
            });
        } catch (e) {
            console.error('Registration failed:', e);
        }
    }

    // ========================================================================
    // GRID CREATION & MANAGEMENT
    // ========================================================================

    createGrid() {
        const grid = document.getElementById('puzzleGrid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${this.gridSize}, 1fr)`;

        this.tiles = [];

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const tile = document.createElement('div');
                tile.className = 'puzzle-tile';
                tile.dataset.x = x;
                tile.dataset.y = y;

                const tileKey = `${x}-${y}`;

                if (this.unlockedTiles.has(tileKey)) {
                    tile.classList.add('unlocked');
                    tile.innerHTML = this.theme.correctEmoji;
                } else {
                    tile.classList.add('locked');
                    tile.innerHTML = this.theme.lockedEmoji;
                }

                tile.addEventListener('click', () => this.handleTileClick(x, y));

                grid.appendChild(tile);
                this.tiles.push(tile);
            }
        }
    }

    getTileAt(x, y) {
        return this.tiles.find(t =>
            parseInt(t.dataset.x) === x && parseInt(t.dataset.y) === y
        );
    }

    placeCharacter() {
        // Remove existing character
        document.querySelectorAll('.character').forEach(c => c.remove());

        // Add character to current tile
        const tile = this.getTileAt(this.currentPosition.x, this.currentPosition.y);
        if (tile) {
            const character = document.createElement('div');
            character.className = 'character';
            character.textContent = this.theme.characterEmoji;
            tile.appendChild(character);
            tile.classList.add('current');
        }
    }

    highlightAdjacentTiles() {
        // Remove all adjacent highlights
        this.tiles.forEach(t => t.classList.remove('adjacent'));

        // Highlight adjacent locked tiles
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dy] of dirs) {
            const nx = this.currentPosition.x + dx;
            const ny = this.currentPosition.y + dy;

            if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                const tileKey = `${nx}-${ny}`;
                if (!this.unlockedTiles.has(tileKey)) {
                    const tile = this.getTileAt(nx, ny);
                    if (tile) tile.classList.add('adjacent');
                }
            }
        }
    }

    // ========================================================================
    // TILE INTERACTION (Auto-Advance)
    // ========================================================================

    setNextTargetTile() {
        // Find the next locked tile in a linear sequence (e.g. spiral or simple row-by-row)
        // For simplicity, we navigate row by row.
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const tileKey = `${x}-${y}`;
                if (!this.unlockedTiles.has(tileKey)) {
                    this.targetTile = { x, y };
                    this.moveCharacter(x, y, true); // highlight it
                    this.generateQuestion();
                    return;
                }
            }
        }
    }

    handleTileClick(x, y) {
        // Disabled manual tile clicking. Game auto-advances.
    }

    moveCharacter(x, y, isHighlightOnly = false) {
        // Remove current highlight from old position
        const oldTile = this.getTileAt(this.currentPosition.x, this.currentPosition.y);

        if (isHighlightOnly) {
            const target = this.getTileAt(x, y);
            if (target) {
                target.style.boxShadow = '0 0 20px #00ffff';
                target.classList.add('adjacent');
            }
            return;
        }

        if (oldTile) {
            oldTile.classList.remove('current');
            oldTile.innerHTML = this.theme.correctEmoji;
        }

        this.currentPosition = { x, y };
        this.placeCharacter();

        // Remove highlighting from all tiles
        this.tiles.forEach(t => {
            t.classList.remove('adjacent');
            t.style.boxShadow = '';
        });

        // Check if all tiles are unlocked
        if (this.unlockedTiles.size === this.gridSize * this.gridSize) {
            setTimeout(() => this.levelComplete(), 600);
        } else {
            // Wait a moment then set next target
            setTimeout(() => {
                this.setNextTargetTile();
            }, 500);
        }
    }

    // ========================================================================
    // QUESTION GENERATION & HANDLING
    // ========================================================================

    async generateQuestion() {
        document.getElementById('questionText').textContent = 'Loading next question...';
        document.getElementById('answerGrid').innerHTML = '';
        document.getElementById('submitBtn').disabled = true;
        this.isProcessing = true;

        try {
            const operation = this.getRandomOperation();

            const reqData = {
                student_id: this.studentId,
                class: this.gameConfig.class_level || 3,
                operation: operation,
                game_type: 'puzzle',
                theme: this.gameConfig.theme || 'default'
            };

            // Cap difficulty based on level so players don't get 3-digit sums early on
            if (this.level === 1) {
                reqData.difficulty_override = 'easy';
            }
            // For level 2, cap at medium
            else if (this.level === 2) {
                // We'll let the backend use current adaptive difficulty, but we could clamp it here if API supported max_diff
                // Since it doesn't, we will let it ride, but AI won't reach 'hard' as easily now.
            }

            const res = await fetch('/api/generate_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reqData)
            });

            const data = await res.json();

            if (data.success && data.question) {
                this.currentQuestion = data.question;
                this.displayQuestion();
            } else {
                console.error('Failed to generate question:', data.error);
                // Fallback to local generation if backend fails
                this._generateLocalFallback();
            }
        } catch (error) {
            console.error('Error fetching question:', error);
            this._generateLocalFallback();
        } finally {
            this.isProcessing = false;
        }
    }

    _generateLocalFallback() {
        const operation = this.getRandomOperation();
        const difficulty = this.currentDifficulty || 'easy';
        this.currentQuestion = generateLocalMathQuestion(operation, difficulty);
        this.displayQuestion();
    }

    getRandomOperation() {
        const ops = this.gameConfig.operations || ['addition'];
        return ops[Math.floor(Math.random() * ops.length)];
    }

    displayQuestion() {
        this.questionStartTime = Date.now();
        this.selectedAnswer = null;

        document.getElementById('questionText').textContent = this.currentQuestion.question;

        const grid = document.getElementById('answerGrid');
        grid.innerHTML = '';

        // Use pre-shuffled 'answers' array from backend, or build from local fallback
        let answers = this.currentQuestion.answers;
        if (!answers) {
            answers = [this.currentQuestion.correct_answer, ...this.currentQuestion.wrong_answers];
            this.shuffleArray(answers);
        }

        answers.forEach(ans => {
            const btn = document.createElement('div');
            btn.className = 'answer-option';
            btn.textContent = ans;
            btn.addEventListener('click', () => this.selectAnswer(ans, btn));
            grid.appendChild(btn);
        });

        document.getElementById('submitBtn').disabled = false;
        this.hideFeedback();
    }

    selectAnswer(answer, element) {
        document.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
        element.classList.add('selected');
        this.selectedAnswer = answer;
    }

    async submitAnswer() {
        if (this.selectedAnswer === null || !this.currentQuestion || this.isProcessing) return;

        this.totalQuestions++;
        const timeTaken = (Date.now() - this.questionStartTime) / 1000;

        // Temporarily disable to prevent double-clicks
        document.getElementById('submitBtn').disabled = true;
        this.isProcessing = true;

        // If local fallback was used, check locally
        if (this.currentQuestion.question_id && this.currentQuestion.question_id.startsWith('local_')) {
            const isCorrect = this.selectedAnswer === this.currentQuestion.correct_answer;
            if (isCorrect) {
                document.querySelectorAll('.answer-option').forEach(opt => {
                    opt.style.pointerEvents = 'none';
                    if (parseInt(opt.textContent) === this.currentQuestion.correct_answer) opt.classList.add('correct');
                });
                this.handleCorrectAnswer();
            } else {
                document.querySelectorAll('.answer-option').forEach(opt => {
                    if (opt.classList.contains('selected')) opt.classList.add('incorrect', 'wrong-shake');
                });
                this.handleWrongAnswer();
            }
            this.updateUI();
            this.isProcessing = false;
            return;
        }

        // === BACKEND VALIDATION ===
        try {
            const res = await fetch('/api/submit_answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    question_id: this.currentQuestion.question_id,
                    answer: this.selectedAnswer,
                    time_taken: timeTaken
                })
            });
            const data = await res.json();

            if (data.success) {
                if (data.is_correct) {
                    // Highlight correct answer
                    document.querySelectorAll('.answer-option').forEach(opt => {
                        opt.style.pointerEvents = 'none';
                        if (parseInt(opt.textContent) === data.correct_answer) opt.classList.add('correct');
                    });
                    this.handleCorrectAnswer(data.performance_update, data.ai_analysis);
                } else {
                    // Shake wrong selection
                    document.querySelectorAll('.answer-option').forEach(opt => {
                        if (opt.classList.contains('selected')) opt.classList.add('incorrect', 'wrong-shake');
                    });
                    this.handleWrongAnswer(data.hint, data.ai_analysis);
                }
            } else {
                // API returned error — use local fallback
                this.handleWrongAnswer('Something went wrong. Try again.');
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
            this.handleWrongAnswer('Connection error. Try again.');
        } finally {
            this.updateUI();
            this.isProcessing = false;
        }
    }

    handleCorrectAnswer(perfUpdate = null, aiAnalysis = null) {
        this.correctAnswers++;
        this.streak++;
        this.maxStreak = Math.max(this.maxStreak, this.streak);

        // Calculate points with streak and level bonus
        const basePoints = 10 * this.level;
        const streakBonus = Math.min(this.streak, 10);
        const points = Math.round(basePoints * (1 + streakBonus * 0.1));
        this.score += points;

        // Show correct message, check if difficulty increased
        let feedbackMessage = `✓ Correct! +${points} points`;
        if (aiAnalysis && aiAnalysis.recommendation === 'increase') {
            feedbackMessage += ` | 🔥 Difficulty Increased to ${aiAnalysis.new_difficulty}`;
        }
        this.showFeedback(feedbackMessage, 'success');

        // Unlock tile and AUTO-MOVE
        if (this.targetTile) {
            const targetX = this.targetTile.x;
            const targetY = this.targetTile.y;
            const tileKey = `${targetX}-${targetY}`;
            this.unlockedTiles.add(tileKey);

            const tile = this.getTileAt(targetX, targetY);
            if (tile) {
                tile.classList.remove('locked', 'adjacent');
                tile.classList.add('unlocked');
                tile.innerHTML = this.theme.correctEmoji;
                tile.style.boxShadow = '';
                tile.style.transform = 'scale(1.2)';
                setTimeout(() => tile.style.transform = '', 300);
            }

            // Store target and clear
            const moveToX = targetX;
            const moveToY = targetY;
            this.targetTile = null;

            // AUTO-MOVE after short delay
            setTimeout(() => {
                this.moveCharacter(moveToX, moveToY);
                this.updateUI();

                // Clear question area for next auto-gen
                document.getElementById('questionText').textContent = 'Loading next question...';
                document.getElementById('answerGrid').innerHTML = '';
                document.getElementById('submitBtn').disabled = true;
            }, 800);
        }
    }

    handleWrongAnswer(hintMessage = null, aiAnalysis = null) {
        this.streak = 0;
        this.score = Math.max(0, this.score - 5);

        // Build feedback message
        let feedbackText = `✗ Wrong answer! Try again.`;
        if (hintMessage) {
            feedbackText += ` ${hintMessage}`;
        }
        if (aiAnalysis && aiAnalysis.recommendation === 'decrease') {
            feedbackText += ` Difficulty eased to ${aiAnalysis.new_difficulty}.`;
        }
        this.showFeedback(feedbackText, 'error');

        // After a short delay, RESET the answer options so the player can retry the SAME question
        setTimeout(() => {
            // Clear visual states from all answer options
            document.querySelectorAll('.answer-option').forEach(opt => {
                opt.classList.remove('selected', 'incorrect', 'correct', 'wrong-shake');
                opt.style.pointerEvents = ''; // Re-enable clicking
            });

            // Reset selection state
            this.selectedAnswer = null;

            // Re-enable submit button
            document.getElementById('submitBtn').disabled = false;

            // Hide error feedback after reset
            this.hideFeedback();
        }, 1500);
    }

    // ========================================================================
    // LEVEL COMPLETION
    // ========================================================================

    levelComplete() {
        const levelTime = Math.floor((Date.now() - this.levelStartTime) / 1000);
        const accuracy = this.totalQuestions > 0
            ? Math.round((this.correctAnswers / this.totalQuestions) * 100)
            : 100;

        // Update modal
        document.getElementById('modalScore').textContent = this.score;
        document.getElementById('modalAccuracy').textContent = accuracy + '%';
        document.getElementById('modalTime').textContent = this.formatTime(levelTime);
        document.getElementById('modalStreak').textContent = this.maxStreak;

        if (this.level >= this.maxLevel) {
            // Final victory
            this.showVictory();
        } else {
            // Show level complete modal
            const nextGrid = this.levelGridSizes[this.level + 1] || (this.level + 4);
            const nextDiff = this.levelDifficulty[this.level + 1];

            document.getElementById('nextLevelNum').textContent = this.level + 1;
            document.getElementById('modalTitle').textContent = `Level ${this.level} Complete!`;
            document.getElementById('modalMessage').textContent =
                `Next: ${nextGrid}×${nextGrid} grid with ${nextDiff?.operations?.join(', ') || 'harder'} questions!`;
            document.getElementById('levelModal').classList.add('active');

            this.spawnConfetti();
        }
    }

    nextLevel() {
        document.getElementById('levelModal').classList.remove('active');
        this.level++;
        this.initLevel();
    }

    showVictory() {
        const totalTime = Math.floor((Date.now() - this.startTime) / 1000);
        const accuracy = this.totalQuestions > 0
            ? Math.round((this.correctAnswers / this.totalQuestions) * 100)
            : 100;

        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalAccuracy').textContent = accuracy + '%';
        document.getElementById('finalTime').textContent = this.formatTime(totalTime);
        document.getElementById('victoryModal').classList.add('active');

        this.spawnConfetti();
    }

    // ========================================================================
    // UI HELPERS
    // ========================================================================

    updateUI() {
        document.getElementById('scoreDisplay').textContent = this.score;
        document.getElementById('levelDisplay').textContent = this.level;
        document.getElementById('streakDisplay').textContent = this.streak;

        const totalTiles = this.gridSize * this.gridSize;
        document.getElementById('tilesDisplay').textContent = `${this.unlockedTiles.size}/${totalTiles}`;

        // Progress bar
        const progress = (this.unlockedTiles.size / totalTiles) * 100;
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('progressText').textContent = Math.round(progress) + '%';

        // Show current level's operations
        const levelDiff = this.levelDifficulty[this.level];
        const opsList = document.getElementById('operationsList');
        if (opsList && levelDiff) {
            opsList.innerHTML = levelDiff.operations
                .map(op => `<span class="op-tag">${op}</span>`)
                .join('');
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            document.getElementById('timerDisplay').textContent = this.formatTime(elapsed);
        }, 1000);
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    showFeedback(message, type) {
        const fb = document.getElementById('feedback');
        fb.textContent = message;
        fb.className = 'feedback ' + type;
    }

    hideFeedback() {
        document.getElementById('feedback').className = 'feedback';
    }

    getHint() {
        if (!this.currentQuestion) {
            this.showFeedback('Click a locked tile first!', 'hint');
            return;
        }

        this.score = Math.max(0, this.score - 2);
        this.updateUI();

        const hints = {
            'addition': 'Try counting up from the larger number.',
            'subtraction': 'Count backwards or think: what plus the smaller equals the larger?',
            'multiplication': 'Use skip counting or think of groups.',
            'division': 'How many times does the divisor fit?'
        };

        const hint = hints[this.currentQuestion.operation] || 'Think carefully!';
        this.showFeedback(hint, 'hint');
    }

    resetLevel() {
        this.currentPosition = { x: 0, y: 0 };
        this.unlockedTiles = new Set();
        this.levelStartTime = Date.now();
        this.currentQuestion = null;
        this.targetTile = null;
        this.isProcessing = false;

        this.createGrid();
        this.placeCharacter();
        this.updateUI();

        document.getElementById('questionText').textContent = 'Loading next question...';
        document.getElementById('answerGrid').innerHTML = '';
        document.getElementById('submitBtn').disabled = true;
        this.hideFeedback();

        setTimeout(() => {
            this.setNextTargetTile();
        }, 500);
    }

    spawnConfetti() {
        const colors = ['#667eea', '#764ba2', '#48bb78', '#ed8936', '#f56565', '#00ffff'];
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
                document.body.appendChild(confetti);

                setTimeout(() => confetti.remove(), 4000);
            }, i * 30);
        }
    }

    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}

// ============================================================================
// GLOBAL FUNCTIONS
// ============================================================================

let game;

function startGame() {
    game.startGame();
}

function submitAnswer() {
    if (game) game.submitAnswer();
}

function getHint() {
    if (game) game.getHint();
}

function resetLevel() {
    if (game) game.resetLevel();
}

function nextLevel() {
    if (game) game.nextLevel();
}

function playAgain() {
    location.reload();
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    game = new PuzzleGame();
});
