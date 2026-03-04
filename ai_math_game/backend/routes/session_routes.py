"""
Session Management Routes Blueprint
Handles: orchestrator session create/join/stats/end, themes, level generation, play routing
"""

from flask import Blueprint, request, jsonify, send_from_directory
import uuid
import json
from datetime import datetime

session_bp = Blueprint('sessions', __name__)


def init_session_routes(question_generator, student_model, prompt_parser, game_sessions, client, MODEL_ID, static_folder):
    """Initialize session routes with shared dependencies."""

    @session_bp.route('/api/create_session', methods=['POST'])
    def create_session():
        """Creates a new game session from the orchestrator configuration."""
        try:
            data = request.get_json()
            game_config = data.get('game_config', {})

            if not game_config:
                return jsonify({'error': 'Game configuration is required'}), 400

            session_id = str(uuid.uuid4())[:8].upper()

            session = {
                'session_id': session_id,
                'game_config': game_config,
                'created_at': datetime.now().isoformat(),
                'status': 'waiting',
                'students': [],
                'questions_served': 0,
                'total_correct': 0
            }

            game_sessions[session_id] = session

            return jsonify({
                'success': True,
                'session_id': session_id,
                'session': session,
                'join_url': f'/play/{session_id}'
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/get_session/<session_id>', methods=['GET'])
    def get_session(session_id):
        """Retrieves session configuration for game engines."""
        try:
            session_id = session_id.upper()

            if session_id not in game_sessions:
                return jsonify({'error': 'Session not found', 'valid': False}), 404

            session = game_sessions[session_id]

            if session['status'] == 'waiting':
                session['status'] = 'active'

            return jsonify({
                'success': True,
                'valid': True,
                'session': session,
                'game_config': session['game_config']
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/join_session', methods=['POST'])
    def join_session():
        """Student joins a session with their ID."""
        try:
            data = request.get_json()
            session_id = data.get('session_id', '').upper()
            student_id = data.get('student_id', '')

            if not session_id or not student_id:
                return jsonify({'error': 'Session ID and Student ID required'}), 400

            if session_id not in game_sessions:
                return jsonify({'error': 'Session not found'}), 404

            session = game_sessions[session_id]

            if student_id not in session['students']:
                session['students'].append(student_id)

            student_model.add_student(student_id, session['game_config'].get('class_level', 3))

            return jsonify({
                'success': True,
                'session': session,
                'game_config': session['game_config']
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/session_stats/<session_id>', methods=['GET'])
    def session_stats(session_id):
        """Get real-time stats for a session (for teacher dashboard)."""
        try:
            session_id = session_id.upper()

            if session_id not in game_sessions:
                return jsonify({'error': 'Session not found'}), 404

            session = game_sessions[session_id]

            student_stats = []
            for sid in session['students']:
                perf = student_model.get_student_performance(sid)
                student_stats.append({
                    'student_id': sid,
                    'accuracy': perf.get('accuracy', 0),
                    'questions_answered': perf.get('total_questions', 0)
                })

            return jsonify({
                'success': True,
                'session_id': session_id,
                'status': session['status'],
                'student_count': len(session['students']),
                'students': student_stats,
                'questions_served': session['questions_served']
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/end_session/<session_id>', methods=['POST'])
    def end_session(session_id):
        """Teacher ends a session."""
        try:
            session_id = session_id.upper()

            if session_id not in game_sessions:
                return jsonify({'error': 'Session not found'}), 404

            game_sessions[session_id]['status'] = 'completed'

            return jsonify({
                'success': True,
                'message': 'Session ended'
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/get_themes', methods=['GET'])
    def get_themes():
        """Get available themes for the orchestrator UI."""
        try:
            themes = prompt_parser.get_available_themes()
            theme_previews = {t: prompt_parser.get_theme_preview(t) for t in themes}

            return jsonify({
                'success': True,
                'themes': themes,
                'previews': theme_previews
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/generate_level', methods=['POST'])
    def generate_level():
        """AI-powered level generation for games."""
        try:
            data = request.get_json()

            student_id = data.get('student_id', 'unknown')
            current_level = data.get('current_level', 1)
            class_level = data.get('class_level', 3)
            operations = data.get('operations', ['addition'])
            player_accuracy = data.get('player_accuracy', 0.5)
            player_avg_time = data.get('player_avg_time', 3000)
            streak = data.get('streak', 0)

            level_prompt = f"""
Generate a game level configuration for an educational math game.

Player Context:
- Student ID: {student_id}
- Current Level: {current_level}
- Class/Grade: {class_level}
- Math Operations: {', '.join(operations)}
- Recent Accuracy: {player_accuracy * 100:.0f}%
- Average Response Time: {player_avg_time}ms
- Current Streak: {streak}

Generate a JSON configuration for level {current_level} with these fields:
{{
    "level": {current_level},
    "ufo_speed": (float 0.2-1.5, based on player skill),
    "max_number": (int, appropriate for class level and performance),
    "operations": (array of operations to include),
    "spawn_rate": (int milliseconds between spawns, 1000-4000),
    "bonus_multiplier": (float 1.0-2.5 for score bonus),
    "level_message": (encouraging message for the player)
}}

Rules:
- If accuracy > 80%, increase difficulty (faster speed, higher numbers)
- If accuracy < 40%, decrease difficulty (slower speed, lower numbers)
- Higher streaks should unlock harder content
- Level 1 should always be approachable
- Class 1-2: max_number should be 1-20
- Class 3-4: max_number should be 10-50
- Class 5: max_number can go up to 100

Return ONLY the JSON object, no explanation.
"""

            try:
                response = client.models.generate_content(
                    model=MODEL_ID,
                    contents=level_prompt
                )

                raw_text = response.text.strip()

                if "```json" in raw_text:
                    raw_text = raw_text.split("```json")[1].split("```")[0]
                elif "```" in raw_text:
                    raw_text = raw_text.split("```")[1].split("```")[0]

                level_config = json.loads(raw_text.strip())

                return jsonify({
                    'success': True,
                    'level_config': level_config
                })

            except Exception as ai_error:
                print(f"AI Level Generation Error: {ai_error}")
                base_speed = 0.3 + (current_level * 0.08)
                max_num = min(5 + (current_level * 2) + (class_level * 2), 100)

                if player_accuracy > 0.8:
                    base_speed *= 1.2
                    max_num = int(max_num * 1.3)
                elif player_accuracy < 0.4:
                    base_speed *= 0.8
                    max_num = int(max_num * 0.7)

                fallback_config = {
                    "level": current_level,
                    "ufo_speed": round(min(base_speed, 1.5), 2),
                    "max_number": max(5, max_num),
                    "operations": operations,
                    "spawn_rate": max(1000, 3500 - (current_level * 150)),
                    "bonus_multiplier": round(1 + (current_level * 0.1), 1),
                    "level_message": f"Level {current_level} - You've got this!"
                }

                return jsonify({
                    'success': True,
                    'level_config': fallback_config
                })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/play/<session_id>')
    def play_session(session_id):
        """Serve the appropriate game based on session configuration."""
        session_id = session_id.upper()

        if session_id not in game_sessions:
            return "Session not found", 404

        session = game_sessions[session_id]
        game_type = session['game_config'].get('game_type', 'puzzle')

        game_templates = {
            'runner': 'runner_game.html',
            'shooter': 'alien_blaster.html',
            'quiz': 'quiz_game.html',
            'kangaroo': 'kang.html'
        }
        template = game_templates.get(game_type, 'puzzle_game.html')
        return send_from_directory(static_folder, template)

    return session_bp
