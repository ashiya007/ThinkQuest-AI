/**
 * adaptive_difficulty.js
 * ═══════════════════════════════════════════════════════════════════
 * Shared Dynamic Difficulty Adjustment (DDA) engine for ThinkQuest.
 *
 * ALGORITHM
 * ──────────
 *  performanceScore = 0.5 × accuracy + 0.3 × speedFactor + 0.2 × streakFactor
 *
 *  accuracy     = correct answers in the last WINDOW_SIZE questions
 *  speedFactor  = fraction answered within the time budget
 *                 (easy 20s | medium 15s | hard 10s)
 *  streakFactor = min(consecutiveCorrect / 5, 1)
 *
 *  score ≥ PROMOTE_THRESHOLD for PROMOTE_AFTER consecutive evals → increase level
 *  score ≤ DEMOTE_THRESHOLD  for DEMOTE_AFTER  consecutive evals → decrease level
 *
 * USAGE
 * ─────
 *  const dda = new DifficultyEngine({ onIncrease, onDecrease });
 *  const result = dda.record(isCorrect, timeTakenSeconds);
 *  if (result.changed) showToast(result.direction, result.difficulty);
 *  const diff = dda.difficulty;   // 'easy' | 'medium' | 'hard'
 */

class DifficultyEngine {

    constructor(options = {}) {
        // ── Tunable parameters ────────────────────────────────────────────
        this._levels         = ['easy', 'medium', 'hard'];
        this._levelIndex     = 0;                           // start at easy

        this.windowSize      = options.windowSize     || 5;   // rolling window
        this.promoteAfter    = options.promoteAfter   || 3;   // consecutive high-perf evals
        this.demoteAfter     = options.demoteAfter    || 2;   // consecutive low-perf evals
        this.promoteThreshold = options.promoteThreshold || 0.75;
        this.demoteThreshold  = options.demoteThreshold  || 0.40;

        // Time budget (seconds) per level. Fast → high speedFactor.
        this.timeBudget = options.timeBudget || { easy: 20, medium: 15, hard: 10 };

        // ── Runtime state ─────────────────────────────────────────────────
        this._history         = [];   // { correct, timeTaken }
        this._streak          = 0;    // consecutive correct
        this._consecutiveHigh = 0;
        this._consecutiveLow  = 0;
        this.questionsAnswered = 0;
        this.totalCorrect      = 0;

        // ── Callbacks (set by game) ───────────────────────────────────────
        this.onIncrease = options.onIncrease || null;  // fn(newDifficulty)
        this.onDecrease = options.onDecrease || null;  // fn(newDifficulty, hint)
        this.onRecord   = options.onRecord   || null;  // fn(result)
    }

    // ── Public getters ────────────────────────────────────────────────────

    get difficulty()  { return this._levels[this._levelIndex]; }
    get levelIndex()  { return this._levelIndex; }
    get streak()      { return this._streak; }

    /**
     * Record one answer and (optionally) shift difficulty.
     *
     * @param  {boolean} isCorrect  - Whether the answer was correct.
     * @param  {number}  timeTaken  - Seconds taken (0 if unknown).
     * @returns {{ changed, direction, difficulty, score, accuracy, speedFactor, hint }}
     */
    record(isCorrect, timeTaken = 0) {
        this.questionsAnswered++;
        if (isCorrect) { this._streak++; this.totalCorrect++; }
        else            { this._streak = 0; }

        this._history.push({ correct: isCorrect, timeTaken: Math.max(0, timeTaken) });
        // Keep history bounded to avoid memory growth
        if (this._history.length > this.windowSize * 4) this._history.shift();

        const result = this._evaluate();
        if (this.onRecord) this.onRecord(result);
        return result;
    }

    /** Force-set the difficulty level (e.g., restore saved state). */
    setLevel(level) {
        const idx = this._levels.indexOf(level);
        if (idx !== -1) this._levelIndex = idx;
    }

    /**
     * Return a live performance snapshot (for HUD display).
     * @returns {{ accuracy, avgTime, score, streak, level }}
     */
    getStats() {
        const w = this._history.slice(-this.windowSize);
        if (!w.length) return { accuracy: 0, avgTime: 0, score: 0.5, streak: 0, level: this.difficulty };
        const accuracy    = w.filter(h => h.correct).length / w.length;
        const avgTime     = w.reduce((s, h) => s + h.timeTaken, 0) / w.length;
        const budget      = this.timeBudget[this.difficulty];
        const speedFactor = w.reduce((s, h) => s + (h.timeTaken <= budget ? 1 : 0), 0) / w.length;
        const score       = 0.5 * accuracy + 0.3 * speedFactor + 0.2 * Math.min(this._streak / 5, 1);
        return { accuracy, avgTime, score, speedFactor, streak: this._streak, level: this.difficulty };
    }

    /** Persist engine state to sessionStorage (call on page unload or between levels). */
    save(storageKey = 'tq_dda_state') {
        try {
            sessionStorage.setItem(storageKey, JSON.stringify({
                levelIndex:       this._levelIndex,
                history:          this._history.slice(-this.windowSize),
                streak:           this._streak,
                questionsAnswered: this.questionsAnswered,
                totalCorrect:     this.totalCorrect,
                consecutiveHigh:  this._consecutiveHigh,
                consecutiveLow:   this._consecutiveLow
            }));
        } catch (_) { /* silent — storage may be full */ }
    }

    /** Restore engine state from sessionStorage. */
    load(storageKey = 'tq_dda_state') {
        try {
            const raw = sessionStorage.getItem(storageKey);
            if (!raw) return;
            const s = JSON.parse(raw);
            this._levelIndex       = Math.min(Math.max(s.levelIndex       || 0, 0), 2);
            this._history          = Array.isArray(s.history) ? s.history : [];
            this._streak           = s.streak           || 0;
            this.questionsAnswered = s.questionsAnswered || 0;
            this.totalCorrect      = s.totalCorrect      || 0;
            this._consecutiveHigh  = s.consecutiveHigh  || 0;
            this._consecutiveLow   = s.consecutiveLow   || 0;
        } catch (_) { /* silent */ }
    }

    // ── Private helpers ───────────────────────────────────────────────────

    _evaluate() {
        const w = this._history.slice(-this.windowSize);

        // Need at least 3 data points before making a decision
        if (w.length < 3) {
            return { changed: false, direction: null, difficulty: this.difficulty,
                     score: 0.5, accuracy: 0.5, speedFactor: 0.5, hint: null };
        }

        const accuracy    = w.filter(h => h.correct).length / w.length;
        const budget      = this.timeBudget[this.difficulty];
        const speedFactor = w.reduce((s, h) => s + (h.timeTaken <= budget ? 1 : 0), 0) / w.length;
        const streakFac   = Math.min(this._streak / 5, 1);
        const score       = 0.5 * accuracy + 0.3 * speedFactor + 0.2 * streakFac;

        let changed   = false;
        let direction = null;
        let hint      = null;

        if (score >= this.promoteThreshold) {
            this._consecutiveHigh++;
            this._consecutiveLow = 0;

            if (this._consecutiveHigh >= this.promoteAfter && this._levelIndex < 2) {
                this._levelIndex++;
                this._consecutiveHigh = 0;
                changed   = true;
                direction = 'increase';
                console.log(`[DDA] ↑ Promoted to ${this.difficulty} (score=${score.toFixed(2)})`);
                if (this.onIncrease) this.onIncrease(this.difficulty);
            }

        } else if (score <= this.demoteThreshold) {
            this._consecutiveLow++;
            this._consecutiveHigh = 0;

            if (this._consecutiveLow >= this.demoteAfter && this._levelIndex > 0) {
                this._levelIndex--;
                this._consecutiveLow = 0;
                changed   = true;
                direction = 'decrease';
                hint      = this._pickHint(accuracy);
                console.log(`[DDA] ↓ Demoted to ${this.difficulty} (score=${score.toFixed(2)}) — hint: ${hint}`);
                if (this.onDecrease) this.onDecrease(this.difficulty, hint);
            }

        } else {
            // Performance is in the "stable" zone — reset counters
            this._consecutiveHigh = 0;
            this._consecutiveLow  = 0;
        }

        return { changed, direction, difficulty: this.difficulty, score, accuracy, speedFactor, hint };
    }

    _pickHint(accuracy) {
        const hints = [
            'Take your time — accuracy is more important than speed! 🎯',
            'Try breaking the problem into smaller steps. 📝',
            'Read the question carefully before answering. 👀',
            'No rush — think it through! 🤔',
            'You\'re doing great — keep going! 💪'
        ];
        // Skew towards helpful hints when accuracy is very low
        const idx = accuracy < 0.3
            ? Math.floor(Math.random() * 3)
            : Math.floor(Math.random() * hints.length);
        return hints[idx];
    }
}
