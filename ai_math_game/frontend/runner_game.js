/**
 * Math Runner Game - Template Orchestration Pattern
 * Game engine loads empty, then fetches configuration from session API or sessionStorage.
 * Supports dynamic visual assets, speed configs, and multi-operation gameplay.
 */

class RunnerGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameConfig = null;
        this.sessionId = null;
        this.studentId = null;

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.startTime = null;
        this.timerInterval = null;

        // Player properties
        this.player = {
            x: 100,
            y: 300,
            width: 40,
            height: 40,
            velocityY: 0,
            jumping: false,
            grounded: false,
            color: '#f6ad55'
        };

        // Game physics (will be overridden by speed_config)
        this.gravity = 0.8;
        this.jumpPower = -15;
        this.gameSpeed = 3;
        this.speedMultiplier = 1;
        this.baseGameSpeed = 3;

        // Platforms
        this.platforms = [];
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.platformSpacing = 200;
        this.lastPlatformX = 400;

        // Background elements
        this.clouds = [];
        this.groundY = 340;

        // Visual theme colors
        this.themeColors = {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#5a67d8',
            highlight: '#48bb78',
            correct: '#48bb78',
            wrong: '#f56565'
        };

        this.init();
    }

    async init() {
        // Check if we're in a session (URL pattern: /play/SESSION_ID)
        const pathParts = window.location.pathname.split('/');
        if (pathParts[1] === 'play' && pathParts[2]) {
            this.sessionId = pathParts[2].toUpperCase();
            await this.loadFromSession();
        } else {
            // Load from sessionStorage (Quick Test mode)
            await this.loadFromStorage();
        }

        // Apply visual theme and speed config
        this.applyConfiguration();

        // Register student
        await this.registerStudent();

        // Initialize clouds
        this.initClouds();

        // Set up event listeners
        this.setupEventListeners();

        // Start game loop
        this.gameLoop();
    }

    async loadFromSession() {
        try {
            // Prompt for student ID if in session mode
            this.studentId = prompt('Enter your Student ID to join:') || 'student_' + Date.now();

            const res = await fetch(`/api/join_session`, {
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
                console.log('Loaded config from session:', this.sessionId);
            } else {
                alert('Session not found. Loading default configuration.');
                this.loadDefaultConfig();
            }
        } catch (error) {
            console.error('Failed to load session:', error);
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
        this.studentId = 'runner_player_' + Date.now();
    }

    loadDefaultConfig() {
        this.gameConfig = {
            class_level: 3,
            operations: ['addition'],
            difficulty: 'medium',
            speed_baseline: 'normal',
            theme: 'default',
            visual_assets: {
                primary_color: '#667eea',
                secondary_color: '#764ba2',
                accent_color: '#5a67d8',
                highlight_color: '#48bb78'
            },
            speed_config: {
                platform_speed: 4,
                question_time_limit: 20,
                spawn_interval: 2000
            }
        };
    }

    applyConfiguration() {
        // Apply speed configuration from orchestrator
        if (this.gameConfig.speed_config) {
            const sc = this.gameConfig.speed_config;
            this.baseGameSpeed = sc.platform_speed || 4;
            this.gameSpeed = this.baseGameSpeed;
            this.platformSpacing = Math.max(150, 300 - (sc.platform_speed * 20));
        } else {
            // Fallback to difficulty-based speed
            if (this.gameConfig.difficulty === 'easy' || this.gameConfig.speed_baseline === 'slow') {
                this.gameSpeed = 2;
                this.baseGameSpeed = 2;
                this.speedMultiplier = 0.8;
            } else if (this.gameConfig.difficulty === 'hard' || this.gameConfig.speed_baseline === 'fast') {
                this.gameSpeed = 5;
                this.baseGameSpeed = 5;
                this.speedMultiplier = 1.5;
            }
        }

        // Apply visual theme colors
        if (this.gameConfig.visual_assets) {
            const va = this.gameConfig.visual_assets;
            this.themeColors = {
                primary: va.primary_color || '#667eea',
                secondary: va.secondary_color || '#764ba2',
                accent: va.accent_color || '#5a67d8',
                highlight: va.highlight_color || '#48bb78',
                correct: va.highlight_color || '#48bb78',
                wrong: '#f56565'
            };
            this.player.color = va.accent_color || '#f6ad55';
        }
    }

    getRandomOperation() {
        const ops = this.gameConfig.operations || [this.gameConfig.math_topic] || ['addition'];
        return ops[Math.floor(Math.random() * ops.length)];
    }

    async registerStudent() {
        try {
            await fetch('/api/register_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    student_id: this.studentId,
                    class: this.gameConfig ? this.gameConfig.class_level : 3
                })
            });
        } catch (error) {
            console.error('Error registering student:', error);
        }
    }

    initClouds() {
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * 150,
                width: 60 + Math.random() * 40,
                height: 30 + Math.random() * 20,
                speed: 0.5 + Math.random() * 0.5
            });
        }
    }

    setupEventListeners() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isRunning && !this.isPaused) {
                e.preventDefault();
                this.jump();
            }
        });

        // Touch/click controls for mobile
        this.canvas.addEventListener('click', () => {
            if (this.isRunning && !this.isPaused) {
                this.jump();
            }
        });

        // Prevent space bar from scrolling
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
            }
        });
    }

    jump() {
        if (this.player.grounded && !this.player.jumping) {
            this.player.velocityY = this.jumpPower;
            this.player.jumping = true;
            this.player.grounded = false;
        }
    }

    async startGame() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.gameOver = false;
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.gameSpeed = 3 * this.speedMultiplier;
        this.platforms = [];
        this.lastPlatformX = 400;

        // Reset player position
        this.player.x = 100;
        this.player.y = 300;
        this.player.velocityY = 0;
        this.player.jumping = false;
        this.player.grounded = false;

        // Generate initial platforms
        await this.generateQuestion();
        this.generateInitialPlatforms();

        // Start timer
        this.startTime = Date.now();
        this.questionStartTime = Date.now();
        this.startTimer();

        // Update UI
        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        this.updateStats();
    }

    pauseGame() {
        if (!this.isRunning || this.gameOver) return;

        this.isPaused = !this.isPaused;
        document.getElementById('pauseBtn').textContent = this.isPaused ? '▶️ Resume' : '⏸️ Pause';
    }

    resetGame() {
        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;
        this.stopTimer();

        // Reset everything
        this.score = 0;
        this.lives = 3;
        this.distance = 0;
        this.correctAnswers = 0;
        this.totalQuestions = 0;
        this.platforms = [];
        this.currentQuestion = null;
        this.selectedAnswer = null;

        // Reset player
        this.player.x = 100;
        this.player.y = 300;
        this.player.velocityY = 0;
        this.player.jumping = false;
        this.player.grounded = false;

        // Update UI
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('pauseBtn').textContent = '⏸️ Pause';
        document.getElementById('questionOverlay').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
        this.updateStats();
        this.hideFeedback();
    }

    async generateQuestion() {
        try {
            // Use random operation from the configured operations array
            const operation = this.getRandomOperation();

            const response = await fetch('/api/generate_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    student_id: this.studentId,
                    class: this.gameConfig.class_level,
                    operation: operation,
                    game_type: 'runner',
                    theme: this.gameConfig.theme || 'default'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentQuestion = data.question;
                this.showQuestionOverlay();
            } else {
                console.error('Failed to generate question:', data.error);
            }

        } catch (error) {
            console.error('Error generating question:', error);
        }
    }

    showQuestionOverlay() {
        const overlay = document.getElementById('questionOverlay');
        const questionText = document.getElementById('questionText');
        const platformOptions = document.getElementById('platformOptions');

        questionText.textContent = this.currentQuestion.question;
        platformOptions.innerHTML = '';

        // Create platform options - use pre-shuffled answers from backend, or fallback
        let allAnswers = this.currentQuestion.answers;
        if (!allAnswers) {
            allAnswers = [this.currentQuestion.correct_answer, ...this.currentQuestion.wrong_answers];
            this.shuffleArray(allAnswers);
        }

        allAnswers.forEach((answer, index) => {
            const option = document.createElement('div');
            option.className = 'platform-option';
            option.textContent = answer;
            option.addEventListener('click', () => this.selectAnswer(answer, option));
            platformOptions.appendChild(option);
        });

        overlay.style.display = 'block';
        this.isPaused = true;
    }

    selectAnswer(answer, element) {
        // Remove previous selection
        document.querySelectorAll('.platform-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Select new answer
        element.classList.add('selected');
        this.selectedAnswer = answer;
    }

    confirmAnswer() {
        if (!this.selectedAnswer) {
            this.showFeedback('Please select an answer!', 'error');
            return;
        }

        // Hide overlay
        document.getElementById('questionOverlay').style.display = 'none';
        this.isPaused = false;
        this.questionStartTime = Date.now();

        // Generate platforms with the selected answer as correct
        this.generatePlatformsFromAnswer();
    }

    generatePlatformsFromAnswer() {
        // Clear existing platforms
        this.platforms = [];
        this.lastPlatformX = 400;

        // Generate starting platform with theme color
        this.platforms.push({
            x: 50,
            y: this.groundY,
            width: 150,
            height: 20,
            answer: null,
            isCorrect: true,
            color: this.themeColors.correct
        });

        // Generate platforms with mixed answers
        for (let i = 0; i < 8; i++) {
            const isCorrect = Math.random() < 0.3; // 30% chance of correct answer
            const answer = isCorrect ? this.currentQuestion.correct_answer :
                this.currentQuestion.wrong_answers[Math.floor(Math.random() * this.currentQuestion.wrong_answers.length)];

            this.platforms.push({
                x: this.lastPlatformX + this.platformSpacing,
                y: this.groundY - Math.random() * 100, // Vary heights
                width: 120,
                height: 20,
                answer: answer,
                isCorrect: isCorrect,
                color: isCorrect ? this.themeColors.correct : this.themeColors.wrong,
                passed: false
            });

            this.lastPlatformX += this.platformSpacing;
        }
    }

    generateInitialPlatforms() {
        // Generate some initial platforms without questions for practice
        this.platforms = [
            {
                x: 50,
                y: this.groundY,
                width: 150,
                height: 20,
                answer: null,
                isCorrect: true,
                color: this.themeColors.correct
            }
        ];

        for (let i = 0; i < 5; i++) {
            this.platforms.push({
                x: 250 + i * 200,
                y: this.groundY - Math.random() * 50,
                width: 120,
                height: 20,
                answer: null,
                isCorrect: true,
                color: this.themeColors.correct,
                passed: false
            });
        }
    }

    async submitAnswer(answer, isCorrect) {
        if (!this.currentQuestion) return;

        const timeTaken = this.questionStartTime ? (Date.now() - this.questionStartTime) / 1000 : 0;

        try {
            await fetch('/api/submit_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    student_id: this.studentId,
                    question_id: this.currentQuestion.question_id,
                    answer: answer,
                    time_taken: timeTaken
                })
            });

            // If correct, generate a new question
            if (isCorrect) {
                // Clear existing platforms with answers to avoid confusion
                this.platforms = this.platforms.filter(p => p.answer === null);

                // Fetch new question
                await this.generateQuestion();
            }

        } catch (error) {
            console.error('Error submitting answer:', error);
        }
    }

    update() {
        if (!this.isRunning || this.isPaused || this.gameOver) return;

        // Update player physics
        this.player.velocityY += this.gravity;
        this.player.y += this.player.velocityY;

        // Ground collision
        if (this.player.y + this.player.height >= this.groundY) {
            this.player.y = this.groundY - this.player.height;
            this.player.velocityY = 0;
            this.player.grounded = true;
            this.player.jumping = false;
        }

        // Update platforms
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const platform = this.platforms[i];
            platform.x -= this.gameSpeed;

            // Remove off-screen platforms
            if (platform.x + platform.width < 0) {
                this.platforms.splice(i, 1);
                continue;
            }

            // Check collision with player
            if (this.checkCollision(this.player, platform)) {
                if (!platform.passed) {
                    platform.passed = true;

                    if (platform.answer !== null) {
                        this.totalQuestions++;

                        if (platform.isCorrect) {
                            this.correctAnswers++;
                            this.score += 10;
                            this.showFeedback('Correct! +10 points', 'success');

                            // Submit correct answer and get new question
                            this.submitAnswer(platform.answer, true);
                        } else {
                            this.lives--;
                            this.score = Math.max(0, this.score - 5);
                            this.showFeedback(`Wrong! ${platform.answer} is incorrect. -1 life`, 'error');

                            // Submit wrong answer (optional, but good for tracking)
                            // For now, we just penalize lives locally to keep flow

                            if (this.lives <= 0) {
                                this.endGame(false);
                                return;
                            }
                        }

                        this.updateStats();
                    }
                }

                // Land on platform
                if (this.player.velocityY > 0 &&
                    this.player.y < platform.y) {
                    this.player.y = platform.y - this.player.height;
                    this.player.velocityY = 0;
                    this.player.grounded = true;
                    this.player.jumping = false;
                }
            }
        }

        // Update distance and speed
        this.distance += this.gameSpeed / 10;
        if (this.distance > 0 && this.distance % 50 === 0) {
            this.gameSpeed = Math.min(this.gameSpeed * 1.05, 8); // Gradually increase speed
        }

        // Update clouds
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed;
            if (cloud.x + cloud.width < 0) {
                cloud.x = this.canvas.width;
            }
        });

        // Generate new platforms when needed
        if (this.platforms.length < 5) {
            if (this.currentQuestion) {
                const isCorrect = Math.random() < 0.3;
                const answer = isCorrect ? this.currentQuestion.correct_answer :
                    this.currentQuestion.wrong_answers[Math.floor(Math.random() * this.currentQuestion.wrong_answers.length)];

                this.platforms.push({
                    x: this.canvas.width + Math.random() * 200,
                    y: this.groundY - Math.random() * 100,
                    width: 120,
                    height: 20,
                    answer: answer,
                    isCorrect: isCorrect,
                    color: isCorrect ? this.themeColors.correct : this.themeColors.wrong,
                    passed: false
                });
            } else {
                // Generate neutral platforms
                this.platforms.push({
                    x: this.canvas.width + Math.random() * 200,
                    y: this.groundY - Math.random() * 50,
                    width: 120,
                    height: 20,
                    answer: null,
                    isCorrect: true,
                    color: this.themeColors.correct,
                    passed: false
                });
            }
        }

        // Check if player fell off the screen
        if (this.player.y > this.canvas.height) {
            this.lives--;
            this.updateStats();

            if (this.lives <= 0) {
                this.endGame(false);
            } else {
                // Reset player position
                this.player.x = 100;
                this.player.y = 300;
                this.player.velocityY = 0;
                this.showFeedback(`You fell! ${this.lives} lives remaining`, 'error');
            }
        }
    }

    checkCollision(player, platform) {
        return player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y;
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87ceeb');
        gradient.addColorStop(1, '#98fb98');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw clouds
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.clouds.forEach(cloud => {
            this.ctx.beginPath();
            this.ctx.ellipse(cloud.x, cloud.y, cloud.width / 2, cloud.height / 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw ground
        this.ctx.fillStyle = '#8b7355';
        this.ctx.fillRect(0, this.groundY + 20, this.canvas.width, this.canvas.height - this.groundY - 20);

        // Draw platforms
        this.platforms.forEach(platform => {
            this.ctx.fillStyle = platform.color;
            this.ctx.fillRect(platform.x, platform.y, platform.width, platform.height);

            // Draw answer text on platform
            if (platform.answer !== null) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(platform.answer, platform.x + platform.width / 2, platform.y + platform.height / 2 + 5);
            }
        });

        // Draw player
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);

        // Draw player face
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(this.player.x + 8, this.player.y + 8, 8, 8);
        this.ctx.fillRect(this.player.x + 24, this.player.y + 8, 8, 8);
        this.ctx.fillRect(this.player.x + 12, this.player.y + 24, 16, 4);

        // Draw game state text
        if (!this.isRunning && !this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Press Start to Begin!', this.canvas.width / 2, this.canvas.height / 2);
        }

        if (this.isPaused && !this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    gameLoop() {
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }

    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            document.getElementById('timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }

    updateStats() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('speed').textContent = `${(this.gameSpeed / 3).toFixed(1)}x`;
        document.getElementById('distance').textContent = `${Math.floor(this.distance)}m`;
        document.getElementById('correctAnswers').textContent = this.correctAnswers;
    }

    endGame(victory) {
        this.gameOver = true;
        this.isRunning = false;
        this.stopTimer();

        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const accuracy = this.totalQuestions > 0 ? Math.round((this.correctAnswers / this.totalQuestions) * 100) : 0;

        document.getElementById('gameOverTitle').textContent = victory ? '🎉 Victory!' : '💔 Game Over';
        document.getElementById('gameOverTitle').className = victory ? 'game-over-title victory' : 'game-over-title defeat';
        document.getElementById('gameOverMessage').textContent = victory ?
            'Excellent work! You mastered the math challenges!' :
            'Keep practicing! You\'ll do better next time!';
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalDistance').textContent = `${Math.floor(this.distance)}m`;
        document.getElementById('finalAccuracy').textContent = `${accuracy}%`;
        document.getElementById('finalTime').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('gameOverScreen').style.display = 'flex';

        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    }

    showFeedback(message, type) {
        const feedbackElement = document.getElementById('feedbackMessage');
        feedbackElement.textContent = message;
        feedbackElement.className = `feedback-message ${type}`;
        feedbackElement.style.display = 'block';

        setTimeout(() => {
            feedbackElement.style.display = 'none';
        }, 3000);
    }

    hideFeedback() {
        const feedbackElement = document.getElementById('feedbackMessage');
        feedbackElement.style.display = 'none';
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Global functions for button handlers
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
    if (game) game.confirmAnswer();
}

function playAgain() {
    document.getElementById('gameOverScreen').style.display = 'none';
    if (game) game.resetGame();
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    game = new RunnerGame();
});
