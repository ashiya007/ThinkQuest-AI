// AI Math Learning Game - Frontend JavaScript
// Main game logic and API communication

// Game State Management
class GameState {
    constructor() {
        this.currentStudent = null;
        this.currentClass = null;
        this.currentGame = null;
        this.currentOperation = null;
        this.score = 0;
        this.level = 1;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.currentQuestion = null;
        this.questionStartTime = null;
        this.gameStartTime = null;
        this.isPaused = false;
        this.lives = 3;
        this.gameSpeed = 1;
    }

    reset() {
        this.score = 0;
        this.level = 1;
        this.totalQuestions = 0;
        this.correctAnswers = 0;
        this.currentQuestion = null;
        this.questionStartTime = null;
        this.gameStartTime = null;
        this.isPaused = false;
        this.lives = 3;
        this.gameSpeed = 1;
    }
}

// API Communication
class API {
    constructor() {
        this.baseURL = '';
    }

    async request(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            console.log(`Making ${method} request to ${endpoint}`, data);
            const response = await fetch(this.baseURL + endpoint, options);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log(`Response from ${endpoint}:`, result);
            return result;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async registerStudent(studentId, studentClass) {
        return this.request('/api/register_student', 'POST', {
            student_id: studentId,
            class: studentClass
        });
    }

    async generateQuestion(studentId, studentClass, operation, gameType) {
        return this.request('/api/generate_question', 'POST', {
            student_id: studentId,
            class: studentClass,
            operation: operation,
            game_type: gameType
        });
    }

    async submitAnswer(studentId, questionId, answer, timeTaken) {
        return this.request('/api/submit_answer', 'POST', {
            student_id: studentId,
            question_id: questionId,
            answer: answer,
            time_taken: timeTaken
        });
    }

    async getDifficulty(studentId) {
        return this.request('/api/get_difficulty', 'POST', {
            student_id: studentId
        });
    }

    async getReport(studentId) {
        return this.request('/api/get_report', 'POST', {
            student_id: studentId
        });
    }

    async getOperations() {
        return this.request('/api/get_operations', 'GET');
    }
}

// UI Helper Functions
class UIHelper {
    static showLoading(show = true) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    static showModal(title, message) {
        const modal = document.getElementById('messageModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        
        if (modal && modalTitle && modalMessage) {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modal.style.display = 'block';
        }
    }

    static hideModal() {
        const modal = document.getElementById('messageModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    static updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }

    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Main Game Controller
class GameController {
    constructor() {
        console.log('GameController constructor called');
        this.api = new API();
        this.state = new GameState();
        this.timer = null;
        this.runnerGame = null;
        
        // Initialize with a delay to ensure DOM is ready
        setTimeout(() => {
            this.init();
        }, 50);
    }

    init() {
        console.log('GameController init() called');
        try {
            this.setupEventListeners();
            this.setupModalListeners();
            this.detectCurrentPage();
            console.log('GameController initialization complete');
        } catch (error) {
            console.error('Error in GameController init:', error);
        }
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('puzzle.html')) {
            this.initPuzzleGame();
        } else if (path.includes('runner.html')) {
            this.initRunnerGame();
        } else {
            this.initHomePage();
        }
    }

    setupEventListeners() {
        // Home page events
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.handleRegistration());
        }

        // Game selection events
        document.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                const gameType = card.dataset.game;
                this.selectGame(gameType);
            });
        });

        // Navigation events
        const backToGamesBtn = document.getElementById('backToGamesBtn');
        if (backToGamesBtn) {
            backToGamesBtn.addEventListener('click', () => this.showGameSelection());
        }

        const backToHomeBtn = document.getElementById('backToHomeBtn');
        if (backToHomeBtn) {
            backToHomeBtn.addEventListener('click', () => this.goToHome());
        }

        const refreshReportBtn = document.getElementById('refreshReportBtn');
        if (refreshReportBtn) {
            refreshReportBtn.addEventListener('click', () => this.loadPerformanceReport());
        }
    }

    setupModalListeners() {
        const closeBtn = document.querySelector('.close');
        const modalOkBtn = document.getElementById('modalOkBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', UIHelper.hideModal);
        }
        
        if (modalOkBtn) {
            modalOkBtn.addEventListener('click', UIHelper.hideModal);
        }

        window.addEventListener('click', (event) => {
            const modal = document.getElementById('messageModal');
            if (event.target === modal) {
                UIHelper.hideModal();
            }
        });
    }

    // Home Page Functions
    initHomePage() {
        console.log('Home page initialized');
        // Add smooth scroll behavior
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    }

    async handleRegistration() {
        console.log('Registration clicked');
        
        const studentId = document.getElementById('studentId').value.trim();
        const studentClass = parseInt(document.getElementById('studentClass').value);

        console.log('Form data:', { studentId, studentClass });

        // Validation
        if (!studentId) {
            UIHelper.showModal('Validation Error', 'Please enter a Student ID');
            return;
        }

        if (studentId.length < 2) {
            UIHelper.showModal('Validation Error', 'Student ID must be at least 2 characters long');
            return;
        }

        if (!studentClass || studentClass < 1 || studentClass > 5) {
            UIHelper.showModal('Validation Error', 'Please select a valid class (1-5)');
            return;
        }

        try {
            UIHelper.showLoading(true);
            console.log('Sending registration request...');
            
            const response = await this.api.registerStudent(studentId, studentClass);
            console.log('Registration response:', response);
            
            if (response.success) {
                this.state.currentStudent = studentId;
                this.state.currentClass = studentClass;
                
                // Store in session storage for persistence
                sessionStorage.setItem('currentStudent', studentId);
                sessionStorage.setItem('currentClass', studentClass);
                
                console.log('Registration successful, showing game selection');
                this.showGameSelection();
                UIHelper.showModal('Success', 'Registration successful! Choose your game.');
            } else {
                console.error('Registration failed:', response);
                UIHelper.showModal('Registration Error', response.error || 'Unknown error occurred');
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            UIHelper.showModal('Registration Error', error.message || 'Failed to register. Please try again.');
        } finally {
            UIHelper.showLoading(false);
        }
    }

    showGameSelection() {
        console.log('Showing game selection...');
        
        const gameSelection = document.getElementById('gameSelection');
        const registrationSection = document.getElementById('registrationSection');
        const topicSelection = document.getElementById('topicSelection');
        const performanceSection = document.getElementById('performanceSection');
        
        if (gameSelection) gameSelection.style.display = 'block';
        if (registrationSection) registrationSection.style.display = 'none';
        if (topicSelection) topicSelection.style.display = 'none';
        if (performanceSection) performanceSection.style.display = 'none';
        
        console.log('Game selection shown');
    }

    async selectGame(gameType) {
        console.log('Game selected:', gameType);
        console.log('Current student:', this.state.currentStudent);
        
        if (!this.state.currentStudent) {
            UIHelper.showModal('Registration Required', 'Please register first before selecting a game');
            return;
        }

        this.state.currentGame = gameType;
        
        try {
            UIHelper.showLoading(true);
            
            const operations = await this.api.getOperations();
            const availableOps = operations.operations[this.state.currentClass];
            
            this.showTopicSelection(availableOps);
            
        } catch (error) {
            UIHelper.showModal('Error', error.message);
        } finally {
            UIHelper.showLoading(false);
        }
    }

    showTopicSelection(operations) {
        const topicGrid = document.getElementById('topicGrid');
        const operationIcons = {
            'addition': '➕',
            'subtraction': '➖',
            'multiplication': '✖️',
            'division': '➗',
            'comparison': '🔍',
            'word_problems': '📝'
        };

        const operationNames = {
            'addition': 'Addition',
            'subtraction': 'Subtraction',
            'multiplication': 'Multiplication',
            'division': 'Division',
            'comparison': 'Number Comparison',
            'word_problems': 'Word Problems'
        };

        topicGrid.innerHTML = '';

        operations.forEach(operation => {
            const card = document.createElement('div');
            card.className = 'topic-card';
            card.innerHTML = `
                <div class="topic-icon">${operationIcons[operation] || '📚'}</div>
                <div class="topic-name">${operationNames[operation] || operation}</div>
                <div class="topic-description">Practice ${operationNames[operation] || operation}</div>
            `;
            
            card.addEventListener('click', () => {
                document.querySelectorAll('.topic-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.state.currentOperation = operation;
                
                setTimeout(() => {
                    this.startGame();
                }, 500);
            });
            
            topicGrid.appendChild(card);
        });

        document.getElementById('gameSelection').style.display = 'none';
        document.getElementById('topicSelection').style.display = 'block';
    }

    startGame() {
        if (this.state.currentGame === 'puzzle') {
            window.location.href = 'puzzle.html';
        } else if (this.state.currentGame === 'runner') {
            window.location.href = 'runner.html';
        }
    }

    goToHome() {
        window.location.href = 'index.html';
    }

    // Puzzle Game Functions
    initPuzzleGame() {
        console.log('Puzzle game initialized');
        
        // Load student data from session storage
        const studentData = sessionStorage.getItem('studentData');
        if (studentData) {
            const data = JSON.parse(studentData);
            this.state.currentStudent = data.studentId;
            this.state.currentClass = data.class;
            this.state.currentGame = data.gameType;
            this.state.currentOperation = data.operation;
        } else {
            UIHelper.showModal('Error', 'No student data found. Please start from home page.');
            setTimeout(() => this.goToHome(), 2000);
            return;
        }

        this.setupPuzzleGameEvents();
        this.updatePuzzleGameUI();
        this.startPuzzleGame();
    }

    setupPuzzleGameEvents() {
        const pauseBtn = document.getElementById('pauseBtn');
        const hintBtn = document.getElementById('hintBtn');
        const quitBtn = document.getElementById('quitBtn');
        const nextQuestionBtn = document.getElementById('nextQuestionBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        const quitFromPauseBtn = document.getElementById('quitFromPauseBtn');
        const playAgainBtn = document.getElementById('playAgainBtn');
        const viewReportBtn = document.getElementById('viewReportBtn');
        const homeBtn = document.getElementById('homeBtn');

        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pausePuzzleGame());
        if (hintBtn) hintBtn.addEventListener('click', () => this.showHint());
        if (quitBtn) quitBtn.addEventListener('click', () => this.quitPuzzleGame());
        if (nextQuestionBtn) nextQuestionBtn.addEventListener('click', () => this.nextPuzzleQuestion());
        if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumePuzzleGame());
        if (quitFromPauseBtn) quitFromPauseBtn.addEventListener('click', () => this.quitPuzzleGame());
        if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.restartPuzzleGame());
        if (viewReportBtn) viewReportBtn.addEventListener('click', () => this.viewReport());
        if (homeBtn) homeBtn.addEventListener('click', () => this.goToHome());
    }

    updatePuzzleGameUI() {
        UIHelper.updateElement('studentIdDisplay', `Student: ${this.state.currentStudent}`);
        UIHelper.updateElement('classDisplay', `Class: ${this.state.currentClass}`);
        UIHelper.updateElement('score', this.state.score);
        UIHelper.updateElement('level', this.state.level);
        UIHelper.updateElement('currentQuestion', this.state.totalQuestions + 1);
        UIHelper.updateElement('totalQuestions', '10');
    }

    async startPuzzleGame() {
        this.state.reset();
        this.state.gameStartTime = Date.now();
        await this.loadPuzzleQuestion();
    }

    async loadPuzzleQuestion() {
        try {
            UIHelper.showLoading(true);
            
            const response = await this.api.generateQuestion(
                this.state.currentStudent,
                this.state.currentClass,
                this.state.currentOperation,
                'puzzle'
            );

            this.state.currentQuestion = response.question;
            this.state.questionStartTime = Date.now();
            
            this.displayPuzzleQuestion(response.question);
            this.startTimer();
            
        } catch (error) {
            UIHelper.showModal('Error', error.message);
        } finally {
            UIHelper.showLoading(false);
        }
    }

    displayPuzzleQuestion(questionData) {
        UIHelper.updateElement('questionText', questionData.question);
        UIHelper.updateElement('operationBadge', questionData.operation.charAt(0).toUpperCase() + questionData.operation.slice(1));
        UIHelper.updateElement('difficultyBadge', questionData.difficulty.charAt(0).toUpperCase() + questionData.difficulty.slice(1));

        const answersGrid = document.getElementById('answersGrid');
        answersGrid.innerHTML = '';

        const allAnswers = [questionData.correct_answer, ...questionData.wrong_answers];
        this.shuffleArray(allAnswers);

        allAnswers.forEach(answer => {
            const answerDiv = document.createElement('div');
            answerDiv.className = 'answer-option';
            answerDiv.textContent = answer;
            answerDiv.addEventListener('click', () => this.checkPuzzleAnswer(answer, questionData));
            answersGrid.appendChild(answerDiv);
        });

        document.getElementById('feedbackSection').style.display = 'none';
    }

    async checkPuzzleAnswer(selectedAnswer, questionData) {
        if (this.state.isPaused) return;

        clearInterval(this.timer);
        const timeTaken = (Date.now() - this.state.questionStartTime) / 1000;

        // Disable all answer options
        document.querySelectorAll('.answer-option').forEach(option => {
            option.style.pointerEvents = 'none';
            if (parseInt(option.textContent) === questionData.correct_answer) {
                option.classList.add('correct');
            } else if (parseInt(option.textContent) === selectedAnswer && selectedAnswer !== questionData.correct_answer) {
                option.classList.add('incorrect');
            }
        });

        try {
            const response = await this.api.submitAnswer(
                this.state.currentStudent,
                questionData.question_id,
                selectedAnswer,
                timeTaken
            );

            this.state.totalQuestions++;
            
            if (response.is_correct) {
                this.state.correctAnswers++;
                this.state.score += 10;
                this.showPuzzleFeedback(true, response.hint);
            } else {
                this.state.score = Math.max(0, this.state.score - 5);
                this.showPuzzleFeedback(false, response.hint);
            }

            this.updatePuzzleGameUI();
            this.updateAccuracy();

        } catch (error) {
            UIHelper.showModal('Error', error.message);
        }
    }

    showPuzzleFeedback(isCorrect, hint) {
        const feedbackSection = document.getElementById('feedbackSection');
        const feedbackCard = document.getElementById('feedbackCard');
        const feedbackIcon = document.getElementById('feedbackIcon');
        const feedbackTitle = document.getElementById('feedbackTitle');
        const feedbackMessage = document.getElementById('feedbackMessage');
        const hintBox = document.getElementById('hintBox');
        const hintText = document.getElementById('hintText');

        feedbackIcon.textContent = isCorrect ? '✅' : '❌';
        feedbackTitle.textContent = isCorrect ? 'Correct!' : 'Try Again!';
        feedbackMessage.textContent = isCorrect ? 
            'Great job! You got it right!' : 
            'Not quite right. Keep practicing!';

        if (hint && !isCorrect) {
            hintText.textContent = hint;
            hintBox.style.display = 'block';
        } else {
            hintBox.style.display = 'none';
        }

        feedbackSection.style.display = 'block';
    }

    async nextPuzzleQuestion() {
        if (this.state.totalQuestions >= 10) {
            this.endPuzzleGame();
        } else {
            await this.loadPuzzleQuestion();
        }
    }

    updateAccuracy() {
        const accuracy = this.state.totalQuestions > 0 ? 
            Math.round((this.state.correctAnswers / this.state.totalQuestions) * 100) : 100;
        UIHelper.updateElement('accuracy', `${accuracy}%`);
        
        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        if (progressFill) {
            progressFill.style.width = `${(this.state.totalQuestions / 10) * 100}%`;
        }
    }

    startTimer() {
        let seconds = 0;
        this.timer = setInterval(() => {
            seconds++;
            UIHelper.updateElement('timeDisplay', `${seconds}s`);
        }, 1000);
    }

    pausePuzzleGame() {
        this.state.isPaused = true;
        clearInterval(this.timer);
        document.getElementById('pauseOverlay').style.display = 'flex';
    }

    resumePuzzleGame() {
        this.state.isPaused = false;
        document.getElementById('pauseOverlay').style.display = 'none';
        this.startTimer();
    }

    quitPuzzleGame() {
        if (confirm('Are you sure you want to quit the game?')) {
            this.goToHome();
        }
    }

    async endPuzzleGame() {
        clearInterval(this.timer);
        
        const totalTime = Math.round((Date.now() - this.state.gameStartTime) / 1000);
        const accuracy = Math.round((this.state.correctAnswers / this.state.totalQuestions) * 100);

        UIHelper.updateElement('finalScore', this.state.score);
        UIHelper.updateElement('finalAccuracy', `${accuracy}%`);
        UIHelper.updateElement('totalTime', UIHelper.formatTime(totalTime));

        let message = '';
        if (accuracy >= 80) {
            message = '🎉 Excellent performance! You\'re a math champion!';
        } else if (accuracy >= 60) {
            message = '👏 Good job! Keep practicing to improve further!';
        } else {
            message = '💪 Nice effort! Practice makes perfect!';
        }

        UIHelper.updateElement('performanceMessage', message);
        document.getElementById('gameOverOverlay').style.display = 'flex';
    }

    restartPuzzleGame() {
        document.getElementById('gameOverOverlay').style.display = 'none';
        this.startPuzzleGame();
    }

    // Runner Game Functions
    initRunnerGame() {
        console.log('Runner game initialized');
        
        // Load student data from session storage
        const studentData = sessionStorage.getItem('studentData');
        if (studentData) {
            const data = JSON.parse(studentData);
            this.state.currentStudent = data.studentId;
            this.state.currentClass = data.class;
            this.state.currentGame = data.gameType;
            this.state.currentOperation = data.operation;
        } else {
            UIHelper.showModal('Error', 'No student data found. Please start from home page.');
            setTimeout(() => this.goToHome(), 2000);
            return;
        }

        this.setupRunnerGameEvents();
        this.updateRunnerGameUI();
        this.runnerGame = new RunnerGame(this);
    }

    setupRunnerGameEvents() {
        const startBtn = document.getElementById('startBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const quitBtn = document.getElementById('quitBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        const quitFromPauseBtn = document.getElementById('quitFromPauseBtn');
        const playAgainBtn = document.getElementById('playAgainBtn');
        const viewReportBtn = document.getElementById('viewReportBtn');
        const homeBtn = document.getElementById('homeBtn');

        if (startBtn) startBtn.addEventListener('click', () => this.startRunnerGame());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseRunnerGame());
        if (quitBtn) quitBtn.addEventListener('click', () => this.quitRunnerGame());
        if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumeRunnerGame());
        if (quitFromPauseBtn) quitFromPauseBtn.addEventListener('click', () => this.quitRunnerGame());
        if (playAgainBtn) playAgainBtn.addEventListener('click', () => this.restartRunnerGame());
        if (viewReportBtn) viewReportBtn.addEventListener('click', () => this.viewReport());
        if (homeBtn) homeBtn.addEventListener('click', () => this.goToHome());
    }

    updateRunnerGameUI() {
        UIHelper.updateElement('studentIdDisplay', `Student: ${this.state.currentStudent}`);
        UIHelper.updateElement('classDisplay', `Class: ${this.state.currentClass}`);
        UIHelper.updateElement('score', this.state.score);
        this.updateLives();
        UIHelper.updateElement('speed', `${this.state.gameSpeed}x`);
    }

    updateLives() {
        const livesElement = document.getElementById('lives');
        if (livesElement) {
            livesElement.textContent = '❤️'.repeat(Math.max(0, this.state.lives));
        }
    }

    async startRunnerGame() {
        this.state.reset();
        this.state.gameStartTime = Date.now();
        
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('pauseBtn').style.display = 'inline-block';
        
        if (this.runnerGame) {
            this.runnerGame.start();
        }
    }

    pauseRunnerGame() {
        this.state.isPaused = true;
        if (this.runnerGame) {
            this.runnerGame.pause();
        }
        document.getElementById('pauseOverlay').style.display = 'flex';
    }

    resumeRunnerGame() {
        this.state.isPaused = false;
        document.getElementById('pauseOverlay').style.display = 'none';
        if (this.runnerGame) {
            this.runnerGame.resume();
        }
    }

    quitRunnerGame() {
        if (confirm('Are you sure you want to quit the game?')) {
            if (this.runnerGame) {
                this.runnerGame.stop();
            }
            this.goToHome();
        }
    }

    restartRunnerGame() {
        document.getElementById('gameOverOverlay').style.display = 'none';
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('pauseBtn').style.display = 'none';
        this.startRunnerGame();
    }

    async runnerGameEnd() {
        const totalTime = Math.round((Date.now() - this.state.gameStartTime) / 1000);

        UIHelper.updateElement('finalScore', this.state.score);
        UIHelper.updateElement('correctAnswers', this.state.correctAnswers);
        UIHelper.updateElement('totalTime', UIHelper.formatTime(totalTime));

        let message = '';
        if (this.state.score >= 100) {
            message = '🏆 Amazing performance! You\'re a math runner champion!';
        } else if (this.state.score >= 50) {
            message = '🌟 Great job! You\'re getting better at math!';
        } else {
            message = '💪 Good effort! Keep practicing to improve!';
        }

        UIHelper.updateElement('performanceMessage', message);
        document.getElementById('gameOverOverlay').style.display = 'flex';
    }

    // Performance Report
    async viewReport() {
        try {
            UIHelper.showLoading(true);
            
            const response = await this.api.getReport(this.state.currentStudent);
            this.displayPerformanceReport(response.report);
            
            // Hide game over overlay and show performance section
            document.getElementById('gameOverOverlay').style.display = 'none';
            document.getElementById('performanceSection').style.display = 'block';
            
        } catch (error) {
            UIHelper.showModal('Error', error.message);
        } finally {
            UIHelper.showLoading(false);
        }
    }

    async loadPerformanceReport() {
        await this.viewReport();
    }

    displayPerformanceReport(report) {
        const reportContent = document.getElementById('reportContent');
        
        const html = `
            <div class="report-header">
                <h3>Student: ${report.student_id} | Class: ${report.class}</h3>
                <p>Generated on: ${new Date(report.generated_at).toLocaleString()}</p>
            </div>
            
            <div class="overall-performance">
                <h4>📊 Overall Performance</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">${report.overall_performance.total_questions}</span>
                        <span class="stat-name">Total Questions</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${report.overall_performance.accuracy.toFixed(1)}%</span>
                        <span class="stat-name">Accuracy</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${report.overall_performance.avg_time.toFixed(1)}s</span>
                        <span class="stat-name">Avg Time</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${report.overall_performance.learning_score.toFixed(1)}</span>
                        <span class="stat-name">Learning Score</span>
                    </div>
                </div>
            </div>
            
            <div class="operation-breakdown">
                <h4>🔢 Operation Breakdown</h4>
                ${Object.entries(report.operation_breakdown).map(([op, stats]) => `
                    <div class="operation-stat">
                        <strong>${op.charAt(0).toUpperCase() + op.slice(1)}:</strong>
                        ${stats.total_questions} questions, 
                        ${stats.accuracy.toFixed(1)}% accuracy, 
                        ${stats.avg_time.toFixed(1)}s avg time
                    </div>
                `).join('')}
            </div>
            
            <div class="insights">
                <h4>💡 Learning Insights</h4>
                <ul>
                    ${report.learning_insights.map(insight => `<li>${insight}</li>`).join('')}
                </ul>
            </div>
            
            <div class="recommendations">
                <h4>🎯 Personalized Recommendations</h4>
                <ul>
                    ${report.personalized_recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;
        
        reportContent.innerHTML = html;
    }

    showHint() {
        if (this.state.currentQuestion && this.state.currentQuestion.hint) {
            UIHelper.showModal('💡 Hint', this.state.currentQuestion.hint);
        } else {
            UIHelper.showModal('Hint', 'No hint available for this question.');
        }
    }

    // Utility Functions
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Runner Game Canvas Implementation
class RunnerGame {
    constructor(gameController) {
        this.gameController = gameController;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.isRunning = false;
        this.isPaused = false;
        
        // Game objects
        this.player = {
            x: 100,
            y: 300,
            width: 40,
            height: 40,
            velocityY: 0,
            jumping: false,
            color: '#4a5568'
        };
        
        this.obstacles = [];
        this.coins = [];
        this.currentQuestion = null;
        this.correctAnswerTiles = [];
        this.gameSpeed = 3;
        this.gravity = 0.8;
        this.jumpPower = -15;
        this.groundY = 340;
        
        this.setupCanvas();
        this.setupControls();
    }

    setupCanvas() {
        // Set canvas size
        this.canvas.width = 800;
        this.canvas.height = 400;
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isRunning && !this.isPaused) {
                e.preventDefault();
                this.jump();
            }
        });

        // Mouse/Touch controls
        this.canvas.addEventListener('click', () => {
            if (this.isRunning && !this.isPaused) {
                this.jump();
            }
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.isRunning && !this.isPaused) {
                this.jump();
            }
        });
    }

    async start() {
        this.isRunning = true;
        this.isPaused = false;
        this.gameSpeed = 3;
        this.obstacles = [];
        this.coins = [];
        this.correctAnswerTiles = [];
        
        await this.loadNewQuestion();
        this.gameLoop();
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        this.isPaused = false;
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
    }

    async loadNewQuestion() {
        try {
            const response = await this.gameController.api.generateQuestion(
                this.gameController.state.currentStudent,
                this.gameController.state.currentClass,
                this.gameController.state.currentOperation,
                'runner'
            );

            this.currentQuestion = response.question;
            this.correctAnswerTiles = [response.question.correct_answer];
            
            // Update question display
            UIHelper.updateElement('questionText', response.question.question);
            UIHelper.updateElement('operationBadge', response.question.operation);
            UIHelper.updateElement('difficultyBadge', response.question.difficulty);
            
            // Generate obstacles with wrong answers
            this.generateObstacles(response.question);
            
        } catch (error) {
            console.error('Error loading question:', error);
        }
    }

    generateObstacles(questionData) {
        const allAnswers = [questionData.correct_answer, ...questionData.wrong_answers];
        this.gameController.shuffleArray(allAnswers);
        
        // Create answer tiles as obstacles
        for (let i = 0; i < allAnswers.length; i++) {
            this.obstacles.push({
                x: 900 + (i * 300),
                y: this.groundY - 40,
                width: 80,
                height: 40,
                answer: allAnswers[i],
                isCorrect: allAnswers[i] === questionData.correct_answer,
                color: allAnswers[i] === questionData.correct_answer ? '#48bb78' : '#f56565',
                passed: false
            });
        }
    }

    jump() {
        if (!this.player.jumping) {
            this.player.velocityY = this.jumpPower;
            this.player.jumping = true;
        }
    }

    update() {
        if (!this.isRunning || this.isPaused) return;

        // Update player physics
        this.player.velocityY += this.gravity;
        this.player.y += this.player.velocityY;

        // Ground collision
        if (this.player.y > this.groundY - this.player.height) {
            this.player.y = this.groundY - this.player.height;
            this.player.velocityY = 0;
            this.player.jumping = false;
        }

        // Update obstacles
        this.obstacles.forEach(obstacle => {
            obstacle.x -= this.gameSpeed;
            
            // Check collision
            if (!obstacle.passed && this.checkCollision(this.player, obstacle)) {
                obstacle.passed = true;
                
                if (obstacle.isCorrect) {
                    // Correct answer - increase score
                    this.gameController.state.score += 10;
                    this.gameController.state.correctAnswers++;
                    this.showStatus('Correct! +10', '#48bb78');
                } else {
                    // Wrong answer - lose life
                    this.gameController.state.lives--;
                    this.gameController.state.score = Math.max(0, this.gameController.state.score - 5);
                    this.showStatus('Wrong! -1 Life', '#f56565');
                    this.gameController.updateLives();
                    
                    if (this.gameController.state.lives <= 0) {
                        this.gameOver();
                    }
                }
                
                this.gameController.updateRunnerGameUI();
            }
        });

        // Remove off-screen obstacles
        this.obstacles = this.obstacles.filter(obstacle => obstacle.x > -100);

        // Generate new obstacles when needed
        if (this.obstacles.length === 0 || this.obstacles[this.obstacles.length - 1].x < 400) {
            this.loadNewQuestion();
        }

        // Increase difficulty over time
        if (this.gameController.state.score > 0 && this.gameController.state.score % 50 === 0) {
            this.gameSpeed = Math.min(8, this.gameSpeed + 0.5);
            this.gameController.state.gameSpeed = (this.gameSpeed / 3).toFixed(1);
            this.gameController.updateRunnerGameUI();
        }
    }

    checkCollision(player, obstacle) {
        return player.x < obstacle.x + obstacle.width &&
               player.x + player.width > obstacle.x &&
               player.y < obstacle.y + obstacle.height &&
               player.y + player.height > obstacle.y;
    }

    showStatus(message, color) {
        const statusOverlay = document.getElementById('statusOverlay');
        const statusIcon = document.getElementById('statusIcon');
        const statusTitle = document.getElementById('statusTitle');
        const statusMessage = document.getElementById('statusMessage');
        
        statusIcon.textContent = color === '#48bb78' ? '✅' : '❌';
        statusIcon.style.color = color;
        statusTitle.textContent = color === '#48bb78' ? 'Correct!' : 'Wrong!';
        statusTitle.style.color = color;
        statusMessage.textContent = message;
        
        statusOverlay.style.display = 'block';
        
        setTimeout(() => {
            statusOverlay.style.display = 'none';
        }, 1500);
    }

    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw sky gradient
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#87ceeb');
        gradient.addColorStop(1, '#98d8e8');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ground
        this.ctx.fillStyle = '#8b7355';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, this.canvas.height - this.groundY);
        
        // Draw grass
        this.ctx.fillStyle = '#90ee90';
        this.ctx.fillRect(0, this.groundY, this.canvas.width, 5);

        // Draw player
        this.ctx.fillStyle = this.player.color;
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // Draw player face
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(this.player.x + 8, this.player.y + 8, 6, 6);
        this.ctx.fillRect(this.player.x + 26, this.player.y + 8, 6, 6);
        this.ctx.fillRect(this.player.x + 12, this.player.y + 24, 16, 4);

        // Draw obstacles (answer tiles)
        this.obstacles.forEach(obstacle => {
            this.ctx.fillStyle = obstacle.color;
            this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Draw answer text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(obstacle.answer, obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2 + 6);
        });

        // Draw score
        this.ctx.fillStyle = '#2d3748';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.gameController.state.score}`, 20, 30);
    }

    gameLoop() {
        if (!this.isRunning || this.isPaused) return;

        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    gameOver() {
        this.stop();
        this.gameController.runnerGameEnd();
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    
    try {
        // Simple initialization first
        window.gameController = new GameController();
        console.log('Game controller initialized successfully');
        
        // Show a simple message to verify it's working
        setTimeout(() => {
            const registerBtn = document.getElementById('registerBtn');
            if (registerBtn) {
                console.log('Register button found, adding click handler');
                // Remove any existing listeners
                registerBtn.replaceWith(registerBtn.cloneNode(true));
                const newBtn = document.getElementById('registerBtn');
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('Register button clicked');
                    window.gameController.handleRegistration();
                });
            } else {
                console.log('Register button not found');
            }
        }, 100);
        
    } catch (error) {
        console.error('Error initializing game:', error);
        // Fallback: show basic functionality
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Game is loading... Please wait a moment and try again.');
            });
        }
    }
});
