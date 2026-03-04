"""
ML-Based Adaptive Difficulty Engine
Uses scikit-learn RandomForest + Bayesian Knowledge Tracing (BKT)
to predict student performance and recommend difficulty changes.

This replaces the rule-based heuristics with an actual trained ML model.
"""

import os
import json
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score


# ============================================================================
# BAYESIAN KNOWLEDGE TRACING (BKT)
# Research paper: Corbett & Anderson, 1994
# Estimates P(know) — the probability a student has mastered a skill.
# ============================================================================

class BayesianKnowledgeTracer:
    """
    Implements the Bayesian Knowledge Tracing algorithm.
    
    Four parameters per skill:
    - P(L0)  : prior probability of knowing the skill (init)
    - P(T)   : probability of learning the skill after each opportunity
    - P(G)   : probability of guessing correctly without knowing
    - P(S)   : probability of slipping (wrong answer despite knowing)
    """
    
    def __init__(self):
        # Default BKT parameters (can be tuned per operation)
        self.params = {
            'addition':       {'p_l0': 0.10, 'p_t': 0.20, 'p_g': 0.25, 'p_s': 0.10},
            'subtraction':    {'p_l0': 0.08, 'p_t': 0.18, 'p_g': 0.25, 'p_s': 0.12},
            'multiplication': {'p_l0': 0.05, 'p_t': 0.15, 'p_g': 0.25, 'p_s': 0.15},
            'division':       {'p_l0': 0.05, 'p_t': 0.12, 'p_g': 0.25, 'p_s': 0.15},
            'comparison':     {'p_l0': 0.15, 'p_t': 0.25, 'p_g': 0.33, 'p_s': 0.08},
            'word_problems':  {'p_l0': 0.03, 'p_t': 0.10, 'p_g': 0.25, 'p_s': 0.18},
        }
        
        # Student mastery state: {student_id: {operation: P(know)}}
        self.mastery = {}
    
    def get_mastery(self, student_id, operation):
        """Get current P(know) for a student-skill pair."""
        if student_id not in self.mastery:
            self.mastery[student_id] = {}
        if operation not in self.mastery[student_id]:
            params = self.params.get(operation, self.params['addition'])
            self.mastery[student_id][operation] = params['p_l0']
        return self.mastery[student_id][operation]
    
    def update(self, student_id, operation, is_correct):
        """
        Update P(know) after observing a student response.
        Returns the updated mastery probability.
        """
        params = self.params.get(operation, self.params['addition'])
        p_l = self.get_mastery(student_id, operation)
        p_t = params['p_t']
        p_g = params['p_g']
        p_s = params['p_s']
        
        # Posterior update using Bayes' rule
        if is_correct:
            # P(know | correct) = P(correct | know) * P(know) / P(correct)
            p_correct = p_l * (1 - p_s) + (1 - p_l) * p_g
            p_know_given_obs = (p_l * (1 - p_s)) / p_correct if p_correct > 0 else p_l
        else:
            # P(know | wrong) = P(wrong | know) * P(know) / P(wrong)
            p_wrong = p_l * p_s + (1 - p_l) * (1 - p_g)
            p_know_given_obs = (p_l * p_s) / p_wrong if p_wrong > 0 else p_l
        
        # Learning transition: P(know_new) = P(know|obs) + (1 - P(know|obs)) * P(T)
        p_know_new = p_know_given_obs + (1 - p_know_given_obs) * p_t
        
        # Clamp to [0, 1]
        p_know_new = max(0.0, min(1.0, p_know_new))
        
        self.mastery[student_id][operation] = p_know_new
        return p_know_new
    
    def get_all_mastery(self, student_id):
        """Get mastery probabilities for all operations."""
        if student_id not in self.mastery:
            return {}
        return dict(self.mastery[student_id])


# ============================================================================
# ML PERFORMANCE PREDICTOR (Random Forest)
# Predicts P(correct) for the next question given student features.
# ============================================================================

class PerformancePredictor:
    """
    Random Forest classifier that predicts whether a student will
    answer the next question correctly, given their recent performance.
    
    Features:
     0. accuracy (rolling)
     1. avg_response_time (seconds)
     2. streak (current correct streak)
     3. total_questions_answered
     4. difficulty_level (0=easy, 1=medium, 2=hard)
     5. mastery_probability (from BKT)
     6. recent_accuracy_5 (last 5 questions)
     7. time_trend (speeding up or slowing down)
    """
    
    MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'performance_model.pkl')
    
    def __init__(self):
        self.model = None
        self.is_trained = False
        self._load_or_train()
    
    def _load_or_train(self):
        """Load saved model or train on synthetic data."""
        if os.path.exists(self.MODEL_PATH):
            try:
                self.model = joblib.load(self.MODEL_PATH)
                self.is_trained = True
                print(f"[ML] Loaded trained model from {self.MODEL_PATH}")
                return
            except Exception as e:
                print(f"[ML] Failed to load model: {e}")
        
        # Train on synthetic data
        print("[ML] Training new model on synthetic data...")
        self._train_on_synthetic_data()
    
    def _generate_synthetic_data(self, n_samples=5000):
        """
        Generate realistic synthetic student performance data.
        This simulates how students with different skill levels perform.
        """
        np.random.seed(42)
        X = []
        y = []
        
        for _ in range(n_samples):
            # Simulate student "true skill" (hidden)
            true_skill = np.random.beta(2, 3)  # Most students are learning
            
            accuracy = np.clip(true_skill + np.random.normal(0, 0.1), 0, 1)
            avg_time = np.clip(15 - true_skill * 12 + np.random.normal(0, 2), 1, 30)
            streak = int(np.clip(np.random.geometric(1 - true_skill * 0.7) - 1, 0, 20))
            total_questions = np.random.randint(1, 100)
            difficulty = np.random.choice([0, 1, 2])  # easy/medium/hard
            mastery = np.clip(true_skill + np.random.normal(0, 0.15), 0, 1)
            recent_acc_5 = np.clip(true_skill + np.random.normal(0, 0.15), 0, 1)
            time_trend = np.random.normal(0, 1)  # negative = speeding up
            
            features = [accuracy, avg_time, streak, total_questions, 
                       difficulty, mastery, recent_acc_5, time_trend]
            
            # Probability of getting next question correct
            # Depends on skill, difficulty, and mastery
            difficulty_penalty = [0, 0.15, 0.30][difficulty]
            p_correct = true_skill * 0.5 + mastery * 0.3 + accuracy * 0.2 - difficulty_penalty
            p_correct = np.clip(p_correct, 0.05, 0.95)
            
            correct = 1 if np.random.random() < p_correct else 0
            
            X.append(features)
            y.append(correct)
        
        return np.array(X), np.array(y)
    
    def _train_on_synthetic_data(self):
        """Train the Random Forest on synthetic data."""
        X, y = self._generate_synthetic_data(5000)
        
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=8,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train, y_train)
        self.is_trained = True
        
        # Evaluate
        y_pred = self.model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        print(f"[ML] Model trained. Test accuracy: {acc:.2%}")
        print(f"[ML] Feature importances: {dict(zip(['accuracy','avg_time','streak','total_q','difficulty','mastery','recent_5','time_trend'], [f'{x:.3f}' for x in self.model.feature_importances_]))}")
        
        # Save model
        os.makedirs(os.path.dirname(self.MODEL_PATH), exist_ok=True)
        joblib.dump(self.model, self.MODEL_PATH)
        print(f"[ML] Model saved to {self.MODEL_PATH}")
    
    def predict(self, accuracy, avg_time, streak, total_questions, 
                difficulty_level, mastery_prob, recent_acc_5, time_trend):
        """
        Predict P(correct) for the next question.
        Returns: {'p_correct': float, 'prediction': 'correct'|'incorrect', 'confidence': float}
        """
        if not self.is_trained:
            return {'p_correct': 0.5, 'prediction': 'unknown', 'confidence': 0.0}
        
        diff_map = {'easy': 0, 'medium': 1, 'hard': 2}
        diff_num = diff_map.get(difficulty_level, 0) if isinstance(difficulty_level, str) else difficulty_level
        
        features = np.array([[accuracy, avg_time, streak, total_questions,
                              diff_num, mastery_prob, recent_acc_5, time_trend]])
        
        prediction = self.model.predict(features)[0]
        probabilities = self.model.predict_proba(features)[0]
        p_correct = probabilities[1] if len(probabilities) > 1 else 0.5
        
        return {
            'p_correct': round(float(p_correct), 4),
            'prediction': 'correct' if prediction == 1 else 'incorrect',
            'confidence': round(float(max(probabilities)), 4)
        }
    
    def retrain(self, X_real, y_real):
        """
        Retrain model with real student data (called periodically).
        Combines synthetic base with real data.
        """
        X_syn, y_syn = self._generate_synthetic_data(2000)
        X_combined = np.vstack([X_syn, np.array(X_real)])
        y_combined = np.concatenate([y_syn, np.array(y_real)])
        
        self.model.fit(X_combined, y_combined)
        joblib.dump(self.model, self.MODEL_PATH)
        print(f"[ML] Model retrained with {len(X_real)} real samples + 2000 synthetic")


# ============================================================================
# UNIFIED ML ADAPTIVE ENGINE
# Combines BKT + RandomForest to make difficulty recommendations.
# ============================================================================

class MLAdaptiveEngine:
    """
    Production-ready adaptive engine combining:
    1. Bayesian Knowledge Tracing (mastery estimation)
    2. RandomForest Performance Predictor (next-question prediction)
    
    Replaces the rule-based heuristics in adaptive_ai.py.
    """
    
    DIFFICULTY_LEVELS = ['easy', 'medium', 'hard']
    
    def __init__(self):
        self.bkt = BayesianKnowledgeTracer()
        self.predictor = PerformancePredictor()
    
    def record_and_analyze(self, student_id, operation, is_correct, 
                           time_taken, student_performance):
        """
        Record a student response and produce an ML-driven recommendation.
        
        Returns: {
            'recommendation': 'increase'|'decrease'|'maintain',
            'new_difficulty': 'easy'|'medium'|'hard',
            'current_difficulty': str,
            'ml_prediction': {...},
            'mastery': float,
            'model_type': 'ml_random_forest + bkt'
        }
        """
        # 1. Update BKT mastery
        mastery = self.bkt.update(student_id, operation, is_correct)
        
        # 2. Extract features for prediction
        accuracy = student_performance.get('accuracy', 0.5)
        total_q = student_performance.get('total_questions', 0)
        avg_time = student_performance.get('avg_time', 10.0)
        
        # Compute recent accuracy (from operation stats if available)
        op_stats = student_performance.get('operation_stats', {})
        op_data = op_stats.get(operation, {})
        recent_acc = op_data.get('accuracy', accuracy)
        
        # Time trend (negative = getting faster)
        time_trend = time_taken - avg_time if avg_time > 0 else 0
        
        # Current difficulty (handle both dict and string formats)
        current_difficulties = student_performance.get('current_difficulties', {})
        current_diff_raw = current_difficulties.get(operation, 'easy')
        if isinstance(current_diff_raw, dict):
            current_diff = current_diff_raw.get('current_difficulty', 'easy')
        else:
            current_diff = current_diff_raw
        
        streak = 0  # We'd need to track this per-student; use 0 as baseline
        
        # 3. ML prediction for next question at CURRENT difficulty
        prediction = self.predictor.predict(
            accuracy=accuracy,
            avg_time=avg_time,
            streak=streak,
            total_questions=total_q,
            difficulty_level=current_diff,
            mastery_prob=mastery,
            recent_acc_5=recent_acc,
            time_trend=time_trend
        )
        
        # 4. Decision logic using ML outputs
        p_correct = prediction['p_correct']
        
        current_idx = self.DIFFICULTY_LEVELS.index(current_diff) if current_diff in self.DIFFICULTY_LEVELS else 0
        
        if mastery >= 0.85 and p_correct >= 0.80 and total_q >= 3:
            # Student has mastered this level — move up
            recommendation = 'increase'
            new_idx = min(current_idx + 1, 2)
        elif mastery < 0.40 and p_correct < 0.45 and total_q >= 3:
            # Student is struggling — move down
            recommendation = 'decrease'
            new_idx = max(current_idx - 1, 0)
        else:
            recommendation = 'maintain'
            new_idx = current_idx
        
        new_difficulty = self.DIFFICULTY_LEVELS[new_idx]
        
        return {
            'recommendation': recommendation,
            'new_difficulty': new_difficulty,
            'current_difficulty': current_diff,
            'ml_prediction': prediction,
            'mastery': round(mastery, 4),
            'mastery_all': self.bkt.get_all_mastery(student_id),
            'model_type': 'ml_random_forest + bayesian_knowledge_tracing'
        }
