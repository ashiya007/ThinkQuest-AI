"""
Adaptive Learning AI
This module implements adaptive difficulty adjustment based on student performance.
Uses ML (RandomForest + Bayesian Knowledge Tracing) with rule-based fallback.
"""

# Try to load ML engine; fall back to rules-only if scikit-learn not installed
try:
    from ml_adaptive import MLAdaptiveEngine
    _ml_engine = MLAdaptiveEngine()
    _ML_AVAILABLE = True
    print("[AdaptiveAI] ML engine loaded successfully")
except Exception as e:
    _ml_engine = None
    _ML_AVAILABLE = False
    print(f"[AdaptiveAI] ML engine unavailable ({e}), using rule-based fallback")


class AdaptiveAI:
    def __init__(self):
        # Performance thresholds for difficulty adjustment
        self.thresholds = {
            'accuracy_high': 80,    # Increase difficulty if accuracy > 80%
            'accuracy_low': 50,     # Decrease difficulty if accuracy <= 50%
            'time_fast': 8.0,       # Consider fast if time < 8 seconds
            'time_slow': 20.0,      # Consider slow if time > 20 seconds
            'min_questions': 2      # Minimum questions before adjustment
        }
        
        # Difficulty progression order
        self.difficulty_progression = ['easy', 'medium', 'hard']
        
        # Reference to shared ML engine
        self.ml_engine = _ml_engine
    
    def analyze_performance(self, student_performance, operation):
        """
        Analyze student performance and recommend difficulty adjustment.
        Uses ML model when available, falls back to rule-based heuristics.
        """
        if operation not in student_performance.get('operation_stats', {}):
            return {
                'recommendation': 'maintain',
                'reason': 'No performance data available for this operation',
                'new_difficulty': 'easy',
                'model_type': 'none'
            }
        
        op_stats = student_performance['operation_stats'][operation]
        total_questions = op_stats['total_questions']
        accuracy = op_stats['accuracy']
        avg_time = op_stats['avg_time']
        
        # Need minimum questions before making adjustments
        if total_questions < self.thresholds['min_questions']:
            return {
                'recommendation': 'maintain',
                'reason': f'Need at least {self.thresholds["min_questions"]} questions before adjustment (currently {total_questions})',
                'new_difficulty': student_performance.get('current_difficulties', {}).get(operation, {}).get('current_difficulty', 'easy'),
                'model_type': 'none'
            }
        
        current_difficulty = student_performance.get('current_difficulties', {}).get(operation, {}).get('current_difficulty', 'easy')
        
        # --- ML-based analysis (primary) ---
        ml_result = None
        if _ML_AVAILABLE and self.ml_engine:
            try:
                student_id = student_performance.get('student_id', 'unknown')
                is_correct = accuracy > 50  # approximate from last batch
                ml_result = self.ml_engine.record_and_analyze(
                    student_id=student_id,
                    operation=operation,
                    is_correct=is_correct,
                    time_taken=avg_time,
                    student_performance=student_performance
                )
            except Exception as e:
                print(f"[AdaptiveAI] ML analysis failed: {e}")
                ml_result = None
        
        # --- Rule-based analysis (fallback or supplement) ---
        rule_result = self._determine_recommendation(accuracy, avg_time, current_difficulty)
        
        # Use ML result if available, otherwise fall back to rules
        if ml_result:
            return {
                'recommendation': ml_result['recommendation'],
                'reason': f"ML model (mastery={ml_result['mastery']:.0%}, p_correct={ml_result['ml_prediction']['p_correct']:.0%})",
                'new_difficulty': ml_result['new_difficulty'],
                'ml_prediction': ml_result['ml_prediction'],
                'mastery': ml_result['mastery'],
                'mastery_all': ml_result.get('mastery_all', {}),
                'model_type': ml_result['model_type'],
                'performance_metrics': {
                    'accuracy': accuracy,
                    'avg_time': avg_time,
                    'total_questions': total_questions
                }
            }
        
        return {
            'recommendation': rule_result['action'],
            'reason': rule_result['reason'],
            'new_difficulty': rule_result['new_difficulty'],
            'model_type': 'rule_based',
            'performance_metrics': {
                'accuracy': accuracy,
                'avg_time': avg_time,
                'total_questions': total_questions
            }
        }
    
    def _determine_recommendation(self, accuracy, avg_time, current_difficulty):
        """
        Determine difficulty adjustment recommendation based on performance metrics
        """
        # High performing students - increase difficulty
        # Requires BOTH high accuracy AND fast answers to bump up
        if accuracy >= self.thresholds['accuracy_high'] and avg_time <= self.thresholds['time_fast']:
            if current_difficulty == 'easy':
                return {
                    'action': 'increase',
                    'reason': 'High accuracy and fast response time - ready for medium difficulty',
                    'new_difficulty': 'medium'
                }
            elif current_difficulty == 'medium':
                return {
                    'action': 'increase',
                    'reason': 'High accuracy and fast response time - ready for hard difficulty',
                    'new_difficulty': 'hard'
                }
            else:  # already hard
                return {
                    'action': 'maintain',
                    'reason': 'Already at maximum difficulty level',
                    'new_difficulty': 'hard'
                }
        
        # Low performing students - decrease difficulty
        elif accuracy <= self.thresholds['accuracy_low'] or avg_time >= self.thresholds['time_slow']:
            if current_difficulty == 'hard':
                return {
                    'action': 'decrease',
                    'reason': 'Low accuracy or slow response time - moving to medium difficulty',
                    'new_difficulty': 'medium'
                }
            elif current_difficulty == 'medium':
                return {
                    'action': 'decrease',
                    'reason': 'Low accuracy or slow response time - moving to easy difficulty',
                    'new_difficulty': 'easy'
                }
            else:  # already easy
                return {
                    'action': 'maintain',
                    'reason': 'Already at minimum difficulty level',
                    'new_difficulty': 'easy'
                }
        
        # Moderate performance - maintain current difficulty
        else:
            return {
                'action': 'maintain',
                'reason': 'Performance is within acceptable range - maintaining current difficulty',
                'new_difficulty': current_difficulty
            }
    
    def get_learning_insights(self, student_performance):
        """
        Generate learning insights and recommendations for students
        """
        insights = []
        
        # Overall performance insight
        overall_accuracy = student_performance.get('accuracy', 0)
        if overall_accuracy >= 80:
            insights.append("Excellent performance! Keep up the great work!")
        elif overall_accuracy >= 60:
            insights.append("Good progress! With more practice, you'll improve further.")
        elif overall_accuracy >= 40:
            insights.append("You're making progress. Focus on understanding the concepts.")
        else:
            insights.append("Keep practicing! Don't worry, everyone learns at their own pace.")
        
        # Operation-specific insights
        operation_stats = student_performance.get('operation_stats', {})
        for operation, stats in operation_stats.items():
            if stats['total_questions'] >= 3:  # Only analyze if enough data
                op_accuracy = stats['accuracy']
                if op_accuracy < 50:
                    insights.append(f"Consider practicing more {operation} problems to improve accuracy.")
                elif op_accuracy > 85:
                    insights.append(f"Great job with {operation}! You're mastering this concept.")
        
        # Time-based insights
        avg_time = student_performance.get('avg_time', 0)
        if avg_time > 12:
            insights.append("Try to solve problems more quickly with regular practice.")
        elif avg_time < 6:
            insights.append("Excellent speed! Make sure you're not rushing through problems.")
        
        # Difficulty distribution insight
        difficulty_stats = student_performance.get('difficulty_stats', {})
        if difficulty_stats:
            easy_questions = difficulty_stats.get('easy', {}).get('total_questions', 0)
            medium_questions = difficulty_stats.get('medium', {}).get('total_questions', 0)
            hard_questions = difficulty_stats.get('hard', {}).get('total_questions', 0)
            
            if easy_questions > medium_questions + hard_questions:
                insights.append("You're ready to try more medium difficulty challenges!")
            elif hard_questions > easy_questions + medium_questions:
                insights.append("Excellent! You're tackling difficult problems successfully.")
        
        return insights
    
    def predict_next_difficulty(self, student_performance, operation):
        """
        Predict the next difficulty level based on recent performance trends
        """
        if operation not in student_performance.get('operation_stats', {}):
            return 'easy'
        
        analysis = self.analyze_performance(student_performance, operation)
        return analysis['new_difficulty']
    
    def get_personalized_recommendations(self, student_performance):
        """
        Get personalized learning recommendations based on performance patterns
        """
        recommendations = []
        
        operation_stats = student_performance.get('operation_stats', {})
        
        # Find weakest operation
        weakest_op = None
        lowest_accuracy = 100
        
        for operation, stats in operation_stats.items():
            if stats['total_questions'] >= 3:  # Only consider if enough data
                if stats['accuracy'] < lowest_accuracy:
                    lowest_accuracy = stats['accuracy']
                    weakest_op = operation
        
        if weakest_op:
            recommendations.append(f"Focus more on {weakest_op} to improve overall performance.")
        
        # Time-based recommendations
        avg_time = student_performance.get('avg_time', 0)
        if avg_time > 15:
            recommendations.append("Practice mental math to improve problem-solving speed.")
        
        # Difficulty-based recommendations
        current_difficulties = student_performance.get('current_difficulties', {})
        easy_ops = [op for op, data in current_difficulties.items() if data['current_difficulty'] == 'easy']
        
        if len(easy_ops) > 2:
            recommendations.append("You're doing well! Try challenging yourself with harder problems.")
        
        # Consistency recommendations
        total_questions = student_performance.get('total_questions', 0)
        if total_questions < 10:
            recommendations.append("Practice regularly to build a strong foundation.")
        elif total_questions < 30:
            recommendations.append("Good consistency! Keep practicing to maintain momentum.")
        else:
            recommendations.append("Excellent dedication to learning! Your hard work is paying off.")
        
        return recommendations
    
    def calculate_learning_score(self, student_performance):
        """
        Calculate an overall learning score based on multiple factors
        """
        # Base score from accuracy
        accuracy_score = student_performance.get('accuracy', 0)
        
        # Time bonus (faster is better, but not too fast)
        avg_time = student_performance.get('avg_time', 10)
        time_score = max(0, 100 - (avg_time - 5) * 5)  # Optimal time is 5 seconds
        time_score = min(100, time_score)  # Cap at 100
        
        # Difficulty bonus (harder questions give more points)
        difficulty_stats = student_performance.get('difficulty_stats', {})
        difficulty_bonus = 0
        total_weighted = 0
        
        for difficulty, stats in difficulty_stats.items():
            weight = {'easy': 1, 'medium': 2, 'hard': 3}.get(difficulty, 1)
            accuracy = stats.get('accuracy', 0)
            difficulty_bonus += accuracy * weight
            total_weighted += weight * 100
        
        if total_weighted > 0:
            difficulty_score = (difficulty_bonus / total_weighted) * 100
        else:
            difficulty_score = 0
        
        # Consistency bonus (more questions = more consistent)
        total_questions = student_performance.get('total_questions', 0)
        consistency_score = min(100, total_questions * 2)  # Max 100 at 50 questions
        
        # Calculate weighted overall score
        overall_score = (
            accuracy_score * 0.4 +      # 40% weight to accuracy
            time_score * 0.2 +          # 20% weight to time
            difficulty_score * 0.3 +     # 30% weight to difficulty
            consistency_score * 0.1      # 10% weight to consistency
        )
        
        return min(100, max(0, overall_score))  # Ensure score is between 0-100
