"""
API Routes Blueprint
Handles: question generation, answer submission, student management, difficulty, reports
"""

from flask import Blueprint, request, jsonify
import uuid
import random

api_bp = Blueprint('api', __name__)


def init_api_routes(question_generator, student_model, adaptive_ai, prompt_parser, session_store, client, MODEL_ID):
    """Initialize API routes with shared dependencies."""

    @api_bp.route('/api/parse_prompt', methods=['POST'])
    def parse_prompt():
        try:
            data = request.get_json()
            prompt = data.get('prompt', '')

            if not prompt:
                return jsonify({'error': 'Prompt is required'}), 400

            game_config = prompt_parser.parse_prompt(prompt)

            return jsonify({
                'success': True,
                'game_config': game_config
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/generate_question', methods=['POST'])
    def generate_question():
        """Generate a math question based on student's current level"""
        try:
            data = request.get_json()

            student_id = data.get('student_id')
            student_class = data.get('class')
            operation = data.get('operation')
            game_type = data.get('game_type', 'puzzle')
            theme = data.get('theme', 'space')

            if not student_id or not student_class:
                return jsonify({'error': 'Missing student_id or class'}), 400

            # Get current difficulty for this operation
            override_diff = data.get('difficulty_override')
            if override_diff:
                current_difficulty = override_diff
            elif operation:
                current_difficulty = student_model.get_current_difficulty(student_id, operation)
            else:
                current_difficulty = 'easy'

            # Generate question with theme support
            question_data = question_generator.generate_question(
                student_class,
                current_difficulty,
                operation,
                theme=theme
            )

            # Add metadata
            question_data['student_id'] = student_id
            question_data['class'] = student_class
            question_data['game_type'] = game_type
            question_data['question_id'] = str(uuid.uuid4())

            # Store FULL question data in SQLite (server-side, includes correct_answer)
            session_store.store(student_id, question_data['question_id'], question_data)

            # Build client-safe response: strip correct_answer so frontend can't cheat
            client_question = dict(question_data)
            correct = client_question.pop('correct_answer', None)
            wrong = client_question.pop('wrong_answers', [])
            answers = [correct] + list(wrong)
            random.shuffle(answers)
            client_question['answers'] = answers

            return jsonify({
                'success': True,
                'question': client_question
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    def _generate_hint(question_data, student_answer):
        """Generate a fast, local hint — no API call to avoid blocking."""
        operation = question_data.get('operation', '')
        correct = question_data.get('correct_answer')

        hints = {
            'addition': f"Hint: Try counting up from the larger number. Think again!",
            'subtraction': f"Hint: Think about what number you need to add to get the bigger number.",
            'multiplication': f"Hint: Multiplication means adding a number to itself multiple times.",
            'division': f"Hint: Division is splitting into equal groups. Try again!",
            'comparison': "Hint: Check the symbols: > (Greater), < (Less), = (Equal).",
            'word_problems': f"Hint: Read the problem carefully. What operation is it asking for?",
        }
        return hints.get(operation, "Take your time and double-check your calculation!")

    @api_bp.route('/api/submit_answer', methods=['POST'])
    def submit_answer():
        """Submit student's answer and provide feedback"""
        try:
            data = request.get_json()

            student_id = data.get('student_id')
            question_id = data.get('question_id')
            student_answer = data.get('answer')
            time_taken = data.get('time_taken', 0)

            if not all([student_id, question_id, student_answer is not None]):
                return jsonify({'error': 'Missing required fields'}), 400

            # Get question data from SQLite session store
            question_data = session_store.get(student_id, question_id)
            if not question_data:
                return jsonify({'error': 'Invalid question ID or session expired'}), 400

            # Convert answer to integer if possible
            try:
                student_answer_int = int(student_answer)
            except (ValueError, TypeError):
                if question_data['operation'] == 'comparison':
                    student_answer_int = student_answer
                else:
                    student_answer_int = 0

            # Record answer in database
            is_correct = student_model.record_answer(
                student_id,
                question_data,
                student_answer_int,
                time_taken
            )

            # Get adaptive AI recommendation
            student_performance = student_model.get_student_performance(student_id)
            student_performance['student_id'] = student_id
            student_performance['_last_is_correct'] = is_correct
            student_performance['_last_time_taken'] = time_taken
            ai_analysis = adaptive_ai.analyze_performance(
                student_performance,
                question_data['operation']
            )

            # Update difficulty if recommended
            if ai_analysis['recommendation'] in ['increase', 'decrease']:
                student_model.update_difficulty(
                    student_id,
                    question_data['operation'],
                    ai_analysis['new_difficulty']
                )

            # Generate hint if wrong answer
            hint = None
            if not is_correct:
                hint = _generate_hint(question_data, student_answer_int)

            # Only clean up session on correct answer (allow retries on wrong answer)
            if is_correct:
                session_store.delete(student_id, question_id)

            response = {
                'success': True,
                'is_correct': is_correct,
                'correct_answer': question_data['correct_answer'],
                'hint': hint,
                'ai_analysis': ai_analysis,
                'performance_update': {
                    'accuracy': student_performance.get('accuracy', 0),
                    'total_questions': student_performance.get('total_questions', 0)
                }
            }

            return jsonify(response)

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/get_difficulty', methods=['POST'])
    def get_difficulty():
        """Get current difficulty levels for a student"""
        try:
            data = request.get_json()
            student_id = data.get('student_id')

            if not student_id:
                return jsonify({'error': 'Missing student_id'}), 400

            student_performance = student_model.get_student_performance(student_id)
            current_difficulties = student_performance.get('current_difficulties', {})

            return jsonify({
                'success': True,
                'current_difficulties': current_difficulties
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/get_report', methods=['POST'])
    def get_report():
        """Get comprehensive performance report for a student"""
        try:
            data = request.get_json()
            student_id = data.get('student_id')

            if not student_id:
                return jsonify({'error': 'Missing student_id'}), 400

            from datetime import datetime

            student_performance = student_model.get_student_performance(student_id)
            recent_performance = student_model.get_recent_performance(student_id, 10)

            learning_insights = adaptive_ai.get_learning_insights(student_performance, client=client)
            personalized_recommendations = adaptive_ai.get_personalized_recommendations(student_performance)
            learning_score = adaptive_ai.calculate_learning_score(student_performance)

            report = {
                'student_id': student_id,
                'class': student_performance.get('class', 0),
                'overall_performance': {
                    'total_questions': student_performance.get('total_questions', 0),
                    'correct_answers': student_performance.get('correct_answers', 0),
                    'accuracy': student_performance.get('accuracy', 0),
                    'avg_time': student_performance.get('avg_time', 0),
                    'learning_score': learning_score
                },
                'operation_breakdown': student_performance.get('operation_stats', {}),
                'difficulty_breakdown': student_performance.get('difficulty_stats', {}),
                'current_difficulties': student_performance.get('current_difficulties', {}),
                'recent_performance': recent_performance,
                'learning_insights': learning_insights,
                'personalized_recommendations': personalized_recommendations,
                'generated_at': datetime.now().isoformat()
            }

            return jsonify({
                'success': True,
                'report': report
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/register_student', methods=['POST'])
    def register_student():
        """Register a new student"""
        try:
            data = request.get_json()
            student_id = data.get('student_id')
            student_class = data.get('class')

            if not student_id or not student_class:
                return jsonify({'error': 'Missing student_id or class'}), 400

            if student_class not in [1, 2, 3, 4, 5]:
                return jsonify({'error': 'Class must be between 1 and 5'}), 400

            success = student_model.add_student(student_id, student_class)

            if success:
                return jsonify({
                    'success': True,
                    'message': 'Student registered successfully'
                })
            else:
                return jsonify({'error': 'Failed to register student'}), 500

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/get_operations', methods=['GET'])
    def get_operations():
        """Get available operations for different classes"""
        operations = {
            1: ['addition', 'subtraction', 'comparison'],
            2: ['addition', 'subtraction', 'comparison'],
            3: ['addition', 'subtraction', 'multiplication', 'division', 'word_problems'],
            4: ['addition', 'subtraction', 'multiplication', 'division', 'word_problems'],
            5: ['addition', 'subtraction', 'multiplication', 'division', 'word_problems']
        }

        return jsonify({
            'success': True,
            'operations': operations
        })

    @api_bp.route('/api/get_prompt_examples', methods=['GET'])
    def get_prompt_examples():
        """Get example prompts for teachers"""
        try:
            examples = prompt_parser.get_prompt_examples()
            return jsonify({
                'success': True,
                'examples': examples
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/generate_game', methods=['POST'])
    def generate_game():
        """Generate a complete game based on configuration"""
        try:
            data = request.get_json()
            game_config = data.get('game_config', {})

            if not game_config:
                return jsonify({'error': 'Game configuration is required'}), 400

            question_data = question_generator.generate_question(
                game_config.get('class_level', 3),
                game_config.get('difficulty', 'medium'),
                game_config.get('math_topic', 'addition')
            )

            game_config['initial_question'] = question_data

            return jsonify({
                'success': True,
                'game_data': {
                    'config': game_config,
                    'question': question_data
                }
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return api_bp
