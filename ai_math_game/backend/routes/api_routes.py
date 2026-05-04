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

    # ====================================================================
    # AI-POWERED ENDPOINTS
    # ====================================================================

    MATH_TOPICS = {
        "basic_arithmetic": {
            "label": "Basic Arithmetic",
            "subtopics": ["addition", "subtraction", "multiplication", "division"]
        },
        "fractions": {
            "label": "Fractions",
            "subtopics": ["simplifying_fractions", "adding_fractions", "subtracting_fractions",
                          "multiplying_fractions", "dividing_fractions"]
        },
        "decimals": {
            "label": "Decimals",
            "subtopics": ["decimal_addition", "decimal_subtraction",
                          "decimal_multiplication", "decimal_division"]
        },
        "percentages": {
            "label": "Percentages",
            "subtopics": ["percentage_of_number", "percentage_increase_decrease",
                          "fraction_percent_decimal_conversion"]
        },
        "algebra": {
            "label": "Algebra",
            "subtopics": ["simplifying_expressions", "solving_linear_equations",
                          "quadratic_equations", "polynomials"]
        },
        "trigonometry": {
            "label": "Trigonometry",
            "subtopics": ["sin_cos_tan_values", "trigonometric_identities",
                          "trigonometric_equations"]
        },
        "geometry": {
            "label": "Geometry",
            "subtopics": ["area", "perimeter", "volume", "angles",
                          "circles_triangles_polygons"]
        },
        "coordinate_geometry": {
            "label": "Coordinate Geometry",
            "subtopics": ["distance_formula", "midpoint_formula",
                          "equation_of_line", "slope"]
        },
        "calculus": {
            "label": "Calculus",
            "subtopics": ["differentiation", "integration", "limits"]
        },
        "statistics": {
            "label": "Statistics",
            "subtopics": ["mean", "median", "mode", "standard_deviation"]
        },
        "probability": {
            "label": "Probability",
            "subtopics": ["probability_of_events", "permutations", "combinations"]
        },
        "number_systems": {
            "label": "Number Systems",
            "subtopics": ["natural_integers", "rational_irrational",
                          "real_numbers", "complex_numbers"]
        }
    }

    @api_bp.route('/api/topics', methods=['GET'])
    def get_topics():
        """Return full topic catalog"""
        return jsonify({'success': True, 'topics': MATH_TOPICS})

    @api_bp.route('/api/ai_question', methods=['POST'])
    def ai_question():
        """Generate a math question for any topic using AI"""
        try:
            data = request.get_json()
            topic = data.get('topic', 'basic_arithmetic')
            subtopic = data.get('subtopic', 'addition')
            difficulty = data.get('difficulty', 'easy')
            previous = data.get('previous_questions', [])
            custom_prompt = data.get('custom_prompt', '')

            topic_label = MATH_TOPICS.get(topic, {}).get('label', topic)
            subtopic_label = subtopic.replace('_', ' ')

            # Build avoid-repeat clause
            avoid_clause = ''
            if previous:
                avoid_list = ', '.join(f'"{q}"' for q in previous[-8:])
                avoid_clause = f'\n- Do NOT repeat these questions: {avoid_list}'

            # Build custom prompt clause
            custom_clause = ''
            if custom_prompt:
                custom_clause = f'\n- Additional instructions from teacher: {custom_prompt}'

            import random as rnd
            seed = rnd.randint(1000, 9999)

            prompt = f"""Generate exactly 1 math question about {topic_label} — specifically {subtopic_label}.
Difficulty: {difficulty}
Seed: {seed}

IMPORTANT: Return ONLY valid JSON, nothing else. No markdown, no explanation.
Format:
{{"question": "the question text (use × for multiply, ÷ for divide)", "answer": "the correct answer (number or short text)", "options": ["option1", "option2", "option3", "option4"], "explanation": "1-sentence explanation of how to solve it"}}

Rules:
- The correct answer MUST be one of the 4 options
- Options should be plausible (common mistakes as distractors)
- For {difficulty} difficulty, adjust complexity accordingly
- Keep the question concise (under 80 characters)
- Answer must be a simple value (number, fraction, or short expression)
- Use DIFFERENT numbers each time — be creative and varied{avoid_clause}{custom_clause}"""

            try:
                response = client.models.generate_content(
                    model=MODEL_ID,
                    contents=prompt
                )
                text = response.text.strip()
                # Clean markdown wrapping if present
                if text.startswith('```'):
                    text = text.split('\n', 1)[1]
                    if text.endswith('```'):
                        text = text[:-3]
                    text = text.strip()

                import json as json_mod
                q = json_mod.loads(text)

                return jsonify({
                    'success': True,
                    'question': q.get('question', ''),
                    'answer': str(q.get('answer', '')),
                    'options': [str(o) for o in q.get('options', [])],
                    'explanation': q.get('explanation', ''),
                    'topic': topic,
                    'subtopic': subtopic,
                    'difficulty': difficulty,
                    'ai_generated': True
                })
            except Exception as api_err:
                print(f"[AI Question] API error: {api_err}")
                # Fallback: generate a local question for the *requested* operation,
                # not always multiplication.
                import random as rnd

                # Map subtopic names to backend operation keys
                subtopic_op_map = {
                    'addition': 'addition', 'decimal_addition': 'addition',
                    'subtraction': 'subtraction', 'decimal_subtraction': 'subtraction',
                    'multiplication': 'multiplication', 'decimal_multiplication': 'multiplication',
                    'division': 'division', 'decimal_division': 'division',
                }
                op = subtopic_op_map.get(subtopic, None)

                if op == 'addition':
                    a, b = rnd.randint(1, 50), rnd.randint(1, 50)
                    ans = a + b
                    q_text = f'{a} + {b} = ?'
                    opts = list(set([str(ans), str(ans + rnd.randint(1, 5)),
                                     str(ans - rnd.randint(1, 5)), str(ans + rnd.randint(6, 12))]))
                elif op == 'subtraction':
                    a = rnd.randint(10, 50); b = rnd.randint(1, a)
                    ans = a - b
                    q_text = f'{a} - {b} = ?'
                    opts = list(set([str(ans), str(ans + rnd.randint(1, 5)),
                                     str(ans - rnd.randint(1, 5)), str(ans + rnd.randint(6, 12))]))
                elif op == 'division':
                    b = rnd.randint(2, 10); q = rnd.randint(1, 12); a = b * q
                    ans = q
                    q_text = f'{a} ÷ {b} = ?'
                    opts = list(set([str(ans), str(ans + rnd.randint(1, 3)),
                                     str(ans - rnd.randint(1, 3)), str(ans + rnd.randint(4, 7))]))
                else:
                    # Default: multiplication
                    a, b = rnd.randint(1, 12), rnd.randint(1, 12)
                    ans = a * b
                    q_text = f'{a} × {b} = ?'
                    opts = list(set([str(ans), str(ans + rnd.randint(1, 5)),
                                     str(ans - rnd.randint(1, 5)), str(a * (b + 1))]))
                    op = 'multiplication'

                while len(opts) < 4:
                    opts.append(str(ans + rnd.randint(-10, 10)))
                rnd.shuffle(opts)
                return jsonify({
                    'success': True,
                    'question': q_text,
                    'answer': str(ans),
                    'options': opts[:4],
                    'explanation': f'The correct answer is {ans}.',
                    'topic': topic,
                    'subtopic': subtopic,
                    'difficulty': difficulty,
                    'ai_generated': False
                })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/ai_hint', methods=['POST'])
    def ai_hint():
        """Generate a personalized AI hint for a wrong answer"""
        try:
            data = request.get_json()
            question = data.get('question', '')
            wrong_answer = data.get('wrong_answer', '')
            correct_answer = data.get('correct_answer', '')
            topic = data.get('topic', 'math')

            prompt = f"""You are a friendly math tutor for students. A student got this wrong:

Question: {question}
Student's answer: {wrong_answer}
Correct answer: {correct_answer}
Topic: {topic}

Give a helpful hint in EXACTLY 2 sentences. First sentence: explain WHY their answer is wrong. Second sentence: guide them toward the right approach. Be encouraging. Return ONLY the hint text, nothing else."""

            try:
                response = client.models.generate_content(
                    model=MODEL_ID,
                    contents=prompt
                )
                hint_text = response.text.strip()
                return jsonify({'success': True, 'hint': hint_text, 'ai_generated': True})
            except Exception as api_err:
                print(f"[AI Hint] API error: {api_err}")
                return jsonify({
                    'success': True,
                    'hint': f'The correct answer is {correct_answer}. Take your time and try a different approach!',
                    'ai_generated': False
                })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/ai_report', methods=['POST'])
    def ai_report():
        """Generate an AI-powered post-game performance report"""
        try:
            data = request.get_json()
            score = data.get('score', 0)
            total_questions = data.get('total_questions', 0)
            correct = data.get('correct', 0)
            wrong_answers = data.get('wrong_answers', [])
            difficulty_progression = data.get('difficulty_progression', '')
            topic = data.get('topic', 'math')
            max_streak = data.get('max_streak', 0)
            game_name = data.get('game_name', 'Math Game')

            accuracy = round(correct / max(total_questions, 1) * 100)
            wrong_summary = '; '.join(wrong_answers[:5]) if wrong_answers else 'None'

            prompt = f"""You are a friendly math tutor. A student just finished playing "{game_name}". Analyze their performance and give 3-4 sentences of personalized feedback.

Stats:
- Score: {score}
- Questions answered: {total_questions}
- Correct: {correct} ({accuracy}% accuracy)
- Max streak: {max_streak}
- Topic: {topic}
- Difficulty progression: {difficulty_progression}
- Examples of wrong answers: {wrong_summary}

Rules:
- Be encouraging and specific
- Mention what they did well
- If they had wrong answers, suggest what to practice
- End with a motivating sentence
- Return ONLY the feedback text, no headers or formatting"""

            try:
                response = client.models.generate_content(
                    model=MODEL_ID,
                    contents=prompt
                )
                report_text = response.text.strip()
                return jsonify({'success': True, 'report': report_text, 'ai_generated': True})
            except Exception as api_err:
                print(f"[AI Report] API error: {api_err}")
                msg = f"You scored {score} points with {accuracy}% accuracy!"
                if accuracy >= 80:
                    msg += " Great job — you're showing strong skills! Keep challenging yourself."
                elif accuracy >= 50:
                    msg += " Good effort! Keep practicing to improve your speed and accuracy."
                else:
                    msg += " Don't give up! Practice makes perfect. Try again with easier questions."
                return jsonify({'success': True, 'report': msg, 'ai_generated': False})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # ====================================================================
    # ANALYTICS ENDPOINTS
    # ====================================================================

    @api_bp.route('/api/analytics/<student_id>', methods=['GET'])
    def get_analytics(student_id):
        """
        Comprehensive analytics for a single student.
        Returns time-series data, per-operation stats, difficulty trend,
        and computed scores — all consumed by analytics_dashboard.html.
        """
        import sqlite3 as _sq
        db_path = student_model.db_path
        try:
            conn = _sq.connect(db_path)
            conn.row_factory = _sq.Row
            cur = conn.cursor()

            # ── 1. Time-series: accuracy over last 50 answers ──────────────
            cur.execute('''
                SELECT is_correct, time_taken, operation, difficulty, timestamp
                FROM performance
                WHERE student_id = ?
                ORDER BY timestamp ASC
                LIMIT 50
            ''', (student_id,))
            rows = cur.fetchall()

            timeline = []
            running_correct = 0
            for i, r in enumerate(rows, 1):
                running_correct += (1 if r['is_correct'] else 0)
                timeline.append({
                    'index': i,
                    'is_correct': bool(r['is_correct']),
                    'time_taken': round(r['time_taken'] or 0, 2),
                    'operation': r['operation'],
                    'difficulty': r['difficulty'],
                    'rolling_accuracy': round(running_correct / i * 100, 1),
                    'timestamp': r['timestamp']
                })

            # ── 2. Per-operation summary ───────────────────────────────────
            cur.execute('''
                SELECT operation,
                       COUNT(*) AS total,
                       SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct,
                       AVG(time_taken) AS avg_time,
                       MIN(time_taken) AS best_time
                FROM performance
                WHERE student_id = ?
                GROUP BY operation
            ''', (student_id,))
            ops = {}
            for r in cur.fetchall():
                ops[r['operation']] = {
                    'total': r['total'],
                    'correct': r['correct'],
                    'accuracy': round(r['correct'] / r['total'] * 100, 1) if r['total'] else 0,
                    'avg_time': round(r['avg_time'] or 0, 2),
                    'best_time': round(r['best_time'] or 0, 2)
                }

            # ── 3. Difficulty breakdown ────────────────────────────────────
            cur.execute('''
                SELECT difficulty,
                       COUNT(*) AS total,
                       SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct
                FROM performance
                WHERE student_id = ?
                GROUP BY difficulty
            ''', (student_id,))
            diff_breakdown = {}
            for r in cur.fetchall():
                diff_breakdown[r['difficulty']] = {
                    'total': r['total'],
                    'correct': r['correct'],
                    'accuracy': round(r['correct'] / r['total'] * 100, 1) if r['total'] else 0
                }

            # ── 4. Recent 10 answers (for activity feed) ───────────────────
            cur.execute('''
                SELECT question, correct_answer, student_answer, is_correct,
                       operation, difficulty, time_taken, timestamp
                FROM performance
                WHERE student_id = ?
                ORDER BY timestamp DESC
                LIMIT 10
            ''', (student_id,))
            recent = [{
                'question': r['question'],
                'correct_answer': r['correct_answer'],
                'student_answer': r['student_answer'],
                'is_correct': bool(r['is_correct']),
                'operation': r['operation'],
                'difficulty': r['difficulty'],
                'time_taken': round(r['time_taken'] or 0, 2),
                'timestamp': r['timestamp']
            } for r in cur.fetchall()]

            # ── 5. Daily activity (answers per day, last 14 days) ──────────
            cur.execute('''
                SELECT DATE(timestamp) AS day, COUNT(*) AS total,
                       SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct
                FROM performance
                WHERE student_id = ?
                  AND timestamp >= DATE('now', '-14 days')
                GROUP BY DATE(timestamp)
                ORDER BY day ASC
            ''', (student_id,))
            daily = [{'day': r['day'], 'total': r['total'], 'correct': r['correct']} for r in cur.fetchall()]

            # ── 6. Overall summary ─────────────────────────────────────────
            cur.execute('''
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) AS correct,
                       AVG(time_taken) AS avg_time,
                       MIN(time_taken) AS best_time
                FROM performance WHERE student_id = ?
            ''', (student_id,))
            ov = cur.fetchone()

            total_q = ov['total'] or 0
            correct_q = ov['correct'] or 0
            overall_acc = round(correct_q / total_q * 100, 1) if total_q else 0
            learning_score = adaptive_ai.calculate_learning_score(
                student_model.get_student_performance(student_id) or {}
            )

            conn.close()

            return jsonify({
                'success': True,
                'student_id': student_id,
                'summary': {
                    'total_questions': total_q,
                    'correct_answers': correct_q,
                    'accuracy': overall_acc,
                    'avg_time': round(ov['avg_time'] or 0, 2),
                    'best_time': round(ov['best_time'] or 0, 2),
                    'learning_score': round(learning_score, 1)
                },
                'timeline': timeline,
                'operations': ops,
                'difficulty_breakdown': diff_breakdown,
                'recent_answers': recent,
                'daily_activity': daily
            })

        except Exception as e:
            print(f"[Analytics] Error: {e}")
            return jsonify({'error': str(e)}), 500

    @api_bp.route('/api/analytics/all_students', methods=['GET'])
    def all_students_analytics():
        """Returns a leaderboard of all students with summary stats."""
        import sqlite3 as _sq
        db_path = student_model.db_path
        try:
            conn = _sq.connect(db_path)
            conn.row_factory = _sq.Row
            cur = conn.cursor()
            cur.execute('''
                SELECT s.student_id, s.class,
                       COUNT(p.id) AS total,
                       SUM(CASE WHEN p.is_correct=1 THEN 1 ELSE 0 END) AS correct,
                       AVG(p.time_taken) AS avg_time,
                       MAX(p.timestamp) AS last_active
                FROM students s
                LEFT JOIN performance p ON s.student_id = p.student_id
                GROUP BY s.student_id
                ORDER BY correct DESC
            ''')
            students = [{
                'student_id': r['student_id'],
                'class': r['class'],
                'total': r['total'] or 0,
                'correct': r['correct'] or 0,
                'accuracy': round((r['correct'] or 0) / max(r['total'] or 1, 1) * 100, 1),
                'avg_time': round(r['avg_time'] or 0, 2),
                'last_active': r['last_active']
            } for r in cur.fetchall()]
            conn.close()
            return jsonify({'success': True, 'students': students})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return api_bp
