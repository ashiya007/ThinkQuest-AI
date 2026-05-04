"""
Session Management Routes Blueprint
Handles: orchestrator session create/join/stats/end, score updates, themes, level generation, play routing
"""

from flask import Blueprint, request, jsonify, send_from_directory
import uuid
import json
from datetime import datetime

session_bp = Blueprint('sessions', __name__)


def init_session_routes(question_generator, student_model, prompt_parser, game_sessions, client, MODEL_ID, static_folder):
    """Initialize session routes with shared dependencies."""

    # -------------------------------------------------------------------------
    # SESSION CRUD
    # -------------------------------------------------------------------------

    @session_bp.route('/api/create_session', methods=['POST'])
    def create_session():
        """Creates a new game session from the orchestrator configuration.

        Accepts an optional 'session_code' field so the frontend can supply
        the 6-char code it generated.  Falls back to a UUID slice if not given.
        """
        try:
            data = request.get_json()
            game_config = data.get('game_config', {})

            if not game_config:
                return jsonify({'error': 'Game configuration is required'}), 400

            # Prefer the caller-supplied code; fall back to uuid slice
            raw_code = data.get('session_code', '')
            session_id = raw_code.strip().upper() if raw_code else str(uuid.uuid4())[:6].upper()

            # Reject obviously bad codes
            if not session_id.isalnum() or len(session_id) < 4:
                return jsonify({'error': 'Invalid session code format'}), 400

            # If this session already exists and is still active, reject
            existing = game_sessions.get(session_id)
            if existing and existing.get('status') not in ('completed', 'expired'):
                return jsonify({'error': 'Session code already in use. Try a different one.'}), 409

            session = {
                'session_id': session_id,
                'game_config': game_config,
                'created_at': datetime.now().isoformat(),
                'status': 'waiting',
                'players': [],          # list of {player_name, student_id, score, correct, total}
                'questions_served': 0,
                'total_correct': 0
            }

            game_sessions.set(session_id, session)

            return jsonify({
                'success': True,
                'session_id': session_id,
                'session': session,
                'join_url': f'/session_join.html?code={session_id}'
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/get_session/<session_id>', methods=['GET'])
    def get_session(session_id):
        """Retrieves session configuration for game engines."""
        try:
            session_id = session_id.upper()
            session = game_sessions.get(session_id)

            if session is None:
                return jsonify({'error': 'Session not found', 'valid': False}), 404

            if session['status'] == 'waiting':
                session['status'] = 'active'
                game_sessions.update(session_id, session)

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
        """Student joins a session by providing a session code and their name."""
        try:
            data = request.get_json()
            session_id = data.get('session_id', '').strip().upper()
            player_name = data.get('player_name', '').strip()
            student_id = data.get('student_id', '')

            # --- Validation ---
            if not session_id:
                return jsonify({'error': 'Session code is required'}), 400
            if not session_id.isalnum() or len(session_id) < 4:
                return jsonify({'error': 'Invalid session code format (must be 4-8 alphanumeric characters)'}), 400
            if not player_name:
                return jsonify({'error': 'Player name is required'}), 400
            if len(player_name) > 32:
                return jsonify({'error': 'Player name must be 32 characters or fewer'}), 400

            session = game_sessions.get(session_id)

            if session is None:
                return jsonify({'error': 'Session not found. Check your code and try again.'}), 404

            if session['status'] == 'completed':
                return jsonify({'error': 'This session has ended.'}), 410

            if session['status'] == 'expired':
                return jsonify({'error': 'This session has expired.'}), 410

            # Generate a stable student_id based on player name + session to avoid duplicates
            if not student_id:
                student_id = f"s_{session_id}_{player_name.lower().replace(' ', '_')}"

            # Update player list — upsert by student_id
            players = session.get('players', [])
            existing_player = next((p for p in players if p['student_id'] == student_id), None)
            if not existing_player:
                players.append({
                    'player_name': player_name,
                    'student_id': student_id,
                    'score': 0,
                    'correct': 0,
                    'total': 0,
                    'joined_at': datetime.now().isoformat()
                })
                session['players'] = players
                if session['status'] == 'waiting':
                    session['status'] = 'active'
                game_sessions.update(session_id, session)

            # Register student in the learning database
            try:
                student_model.add_student(student_id, session['game_config'].get('class_level', 3))
            except Exception:
                pass  # Non-fatal; carry on

            return jsonify({
                'success': True,
                'session_id': session_id,
                'student_id': student_id,
                'player_name': player_name,
                'session': session,
                'game_config': session['game_config'],
                'game_url': _game_url(session)
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/session_stats/<session_id>', methods=['GET'])
    def session_stats(session_id):
        """Get real-time player stats for a session (teacher dashboard polls this)."""
        try:
            session_id = session_id.upper()
            session = game_sessions.get(session_id)

            if session is None:
                return jsonify({'error': 'Session not found'}), 404

            players = session.get('players', [])

            # Sort by score descending for leaderboard
            sorted_players = sorted(players, key=lambda p: p.get('score', 0), reverse=True)

            return jsonify({
                'success': True,
                'session_id': session_id,
                'status': session['status'],
                'player_count': len(players),
                'players': sorted_players,
                'questions_served': session.get('questions_served', 0),
                'game_config': session.get('game_config', {})
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/update_player_score', methods=['POST'])
    def update_player_score():
        """Games call this endpoint to push live score updates to the teacher dashboard."""
        try:
            data = request.get_json()
            session_id = data.get('session_id', '').strip().upper()
            student_id = data.get('student_id', '').strip()
            score = int(data.get('score', 0))
            correct = int(data.get('correct', 0))
            total = int(data.get('total', 0))

            if not session_id or not student_id:
                return jsonify({'error': 'session_id and student_id are required'}), 400

            session = game_sessions.get(session_id)
            if session is None:
                return jsonify({'error': 'Session not found'}), 404

            players = session.get('players', [])
            for player in players:
                if player['student_id'] == student_id:
                    player['score'] = score
                    player['correct'] = correct
                    player['total'] = total
                    break

            session['players'] = players
            game_sessions.update(session_id, session)

            return jsonify({'success': True})

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @session_bp.route('/api/validate_session/<session_id>', methods=['GET'])
    def validate_session(session_id):
        """Lightweight endpoint: returns whether a session code is valid and joinable."""
        try:
            session_id = session_id.strip().upper()
            if not session_id.isalnum() or len(session_id) < 4:
                return jsonify({'valid': False, 'error': 'Invalid code format'}), 200

            session = game_sessions.get(session_id)
            if session is None:
                return jsonify({'valid': False, 'error': 'Session not found'}), 200
            if session['status'] == 'completed':
                return jsonify({'valid': False, 'error': 'Session has ended'}), 200
            if session['status'] == 'expired':
                return jsonify({'valid': False, 'error': 'Session has expired'}), 200

            return jsonify({
                'valid': True,
                'session_id': session_id,
                'player_count': len(session.get('players', [])),
                'game_config': session.get('game_config', {})
            })
        except Exception as e:
            return jsonify({'valid': False, 'error': str(e)}), 200

    @session_bp.route('/api/end_session/<session_id>', methods=['POST'])
    def end_session(session_id):
        """Teacher ends a session."""
        try:
            session_id = session_id.upper()
            session = game_sessions.get(session_id)

            if session is None:
                return jsonify({'error': 'Session not found'}), 404

            session['status'] = 'completed'
            game_sessions.update(session_id, session)

            return jsonify({'success': True, 'message': 'Session ended'})

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # -------------------------------------------------------------------------
    # THEMES & AI LEVEL GENERATION
    # -------------------------------------------------------------------------

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
                    "level_message": f"Level {current_level} — You've got this!"
                }

                return jsonify({
                    'success': True,
                    'level_config': fallback_config
                })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # -------------------------------------------------------------------------
    # PLAY ROUTING
    # -------------------------------------------------------------------------

    @session_bp.route('/play/<session_id>')
    def play_session(session_id):
        """Serve the appropriate game based on session configuration."""
        session_id = session_id.upper()
        session = game_sessions.get(session_id)

        if session is None:
            return "Session not found", 404

        game_type = session['game_config'].get('game_type', 'puzzle')

        game_templates = {
            'runner':   'runner_game.html',
            'shooter':  'alien_blaster.html',
            'quiz':     'quiz_game.html',
            'kangaroo': 'kang.html'
        }
        template = game_templates.get(game_type, 'puzzle_game.html')
        return send_from_directory(static_folder, template)

    return session_bp


# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------

def _game_url(session):
    """Return the in-game URL for a session."""
    game_type = session['game_config'].get('game_type', 'puzzle')
    game_templates = {
        'runner':   'runner_game.html',
        'shooter':  'alien_blaster.html',
        'quiz':     'quiz_game.html',
        'kangaroo': 'kang.html'
    }
    template = game_templates.get(game_type, 'puzzle_game.html')
    return f'/{template}'
