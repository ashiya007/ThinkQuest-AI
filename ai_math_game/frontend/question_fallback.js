/**
 * Shared Local Question Fallback Generator
 * Used by all game frontends when the backend API is unavailable.
 * Matches difficulty params from backend math_pcg.py.
 */

const DIFFICULTY_PARAMS = {
    easy: { addition: { min: 1, max: 10 }, subtraction: { min: 1, max: 10 }, multiplication: { min: 1, max: 5 }, division: { min: 1, max: 10 }, comparison: { min: 1, max: 20 } },
    medium: { addition: { min: 10, max: 99 }, subtraction: { min: 10, max: 99 }, multiplication: { min: 2, max: 10 }, division: { min: 2, max: 20 }, comparison: { min: 20, max: 100 } },
    hard: { addition: { min: 50, max: 200 }, subtraction: { min: 50, max: 200 }, multiplication: { min: 5, max: 15 }, division: { min: 5, max: 50 }, comparison: { min: 100, max: 500 } }
};

function _rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _wrongAnswers(correct, difficulty) {
    const spread = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 10;
    const wrongs = new Set();
    let attempts = 0;
    while (wrongs.size < 3 && attempts < 20) {
        const offset = _rand(1, spread) * (Math.random() < 0.5 ? 1 : -1);
        const w = correct + offset;
        if (w > 0 && w !== correct) wrongs.add(w);
        attempts++;
    }
    // Ensure we always have 3 wrong answers
    while (wrongs.size < 3) wrongs.add(correct + wrongs.size + 1);
    return [...wrongs];
}

/**
 * Generate a local math question.
 * @param {string} operation - 'addition', 'subtraction', 'multiplication', 'division', 'comparison'
 * @param {string} difficulty - 'easy', 'medium', 'hard'
 * @returns {{ question: string, correct_answer: number|string, wrong_answers: number[]|string[], answers: any[], question_id: string, operation: string, difficulty: string }}
 */
function generateLocalMathQuestion(operation = 'addition', difficulty = 'easy') {
    const params = (DIFFICULTY_PARAMS[difficulty] || DIFFICULTY_PARAMS.easy)[operation] || DIFFICULTY_PARAMS.easy.addition;
    let question, correct, wrongAnswers;

    switch (operation) {
        case 'subtraction': {
            const a = _rand(params.min, params.max);
            const b = _rand(params.min, Math.min(a, params.max));
            question = `What is ${a} - ${b}?`;
            correct = a - b;
            wrongAnswers = _wrongAnswers(correct, difficulty);
            break;
        }
        case 'multiplication': {
            const a = _rand(params.min, params.max);
            const b = _rand(params.min, params.max);
            question = `What is ${a} × ${b}?`;
            correct = a * b;
            wrongAnswers = _wrongAnswers(correct, difficulty);
            break;
        }
        case 'division': {
            const b = _rand(Math.max(1, params.min), params.max);
            const correct_val = _rand(1, params.max);
            const a = b * correct_val;
            question = `What is ${a} ÷ ${b}?`;
            correct = correct_val;
            wrongAnswers = _wrongAnswers(correct, difficulty);
            break;
        }
        case 'comparison': {
            const a = _rand(params.min, params.max);
            const b = _rand(params.min, params.max);
            question = `Compare: ${a} ___ ${b}`;
            correct = a > b ? '>' : a < b ? '<' : '=';
            wrongAnswers = ['>', '<', '='].filter(s => s !== correct);
            break;
        }
        default: { // addition
            const a = _rand(params.min, params.max);
            const b = _rand(params.min, params.max);
            question = `What is ${a} + ${b}?`;
            correct = a + b;
            wrongAnswers = _wrongAnswers(correct, difficulty);
            break;
        }
    }

    const answers = [correct, ...wrongAnswers].sort(() => Math.random() - 0.5);

    return {
        question,
        correct_answer: correct,
        wrong_answers: wrongAnswers,
        answers,
        question_id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        operation,
        difficulty
    };
}
