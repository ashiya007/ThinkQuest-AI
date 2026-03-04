"""
Flask Backend Server for AI Math Learning Game
Main application - slim entry point using Blueprints
"""

from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
import sys
import uuid
import json
import time
from datetime import datetime
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()

# Configure the Gemini API client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-3-flash-preview"

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from math_pcg import MathQuestionGenerator
from student_model import StudentModel
from adaptive_ai import AdaptiveAI
from prompt_parser import PromptParser


# ============================================================================
# SQLite-backed Session Store (survives server restarts)
# ============================================================================
import sqlite3

class SessionStore:
    """Stores active question sessions in SQLite instead of memory."""
    
    def __init__(self, db_path='database/sessions.db'):
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()
    
    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute('''
            CREATE TABLE IF NOT EXISTS question_sessions (
                student_id TEXT NOT NULL,
                question_id TEXT NOT NULL,
                question_data TEXT NOT NULL,
                created_at REAL NOT NULL,
                PRIMARY KEY (student_id, question_id)
            )
        ''')
        conn.commit()
        conn.close()
    
    def store(self, student_id, question_id, question_data):
        """Store a question session."""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            'INSERT OR REPLACE INTO question_sessions VALUES (?, ?, ?, ?)',
            (student_id, question_id, json.dumps(question_data), time.time())
        )
        conn.commit()
        conn.close()
    
    def get(self, student_id, question_id):
        """Retrieve question data. Returns None if not found or expired."""
        self._cleanup_expired()
        conn = sqlite3.connect(self.db_path)
        cur = conn.execute(
            'SELECT question_data FROM question_sessions WHERE student_id=? AND question_id=?',
            (student_id, question_id)
        )
        row = cur.fetchone()
        conn.close()
        if row:
            return json.loads(row[0])
        return None
    
    def delete(self, student_id, question_id):
        """Remove a consumed session."""
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            'DELETE FROM question_sessions WHERE student_id=? AND question_id=?',
            (student_id, question_id)
        )
        conn.commit()
        conn.close()
    
    def _cleanup_expired(self):
        """Remove sessions older than 1 hour."""
        cutoff = time.time() - 3600
        conn = sqlite3.connect(self.db_path)
        conn.execute('DELETE FROM question_sessions WHERE created_at < ?', (cutoff,))
        conn.commit()
        conn.close()


# ============================================================================
# APP SETUP
# ============================================================================

app = Flask(__name__, static_folder='../frontend', template_folder='../frontend')
CORS(app)

# Initialize shared components
question_generator = MathQuestionGenerator(client)
student_model = StudentModel()
adaptive_ai = AdaptiveAI()
prompt_parser = PromptParser(client)
session_store = SessionStore()

# Game sessions (teacher-launched, kept in memory — short-lived)
game_sessions = {}


# ============================================================================
# REGISTER BLUEPRINTS
# ============================================================================
from routes.api_routes import api_bp, init_api_routes
from routes.session_routes import session_bp, init_session_routes

init_api_routes(question_generator, student_model, adaptive_ai, prompt_parser, session_store, client, MODEL_ID)
init_session_routes(question_generator, student_model, prompt_parser, game_sessions, client, MODEL_ID, app.static_folder)

app.register_blueprint(api_bp)
app.register_blueprint(session_bp)


# ============================================================================
# PAGE SERVING — single catch-all replaces 15+ individual routes
# ============================================================================

@app.route('/')
def index():
    """Serve the main teacher interface page"""
    return send_from_directory(app.static_folder, 'teacher_prompt.html')

@app.route('/<path:filename>')
def serve_frontend(filename):
    """
    Catch-all route: serves any file from the frontend directory.
    Replaces ~20 individual routes for HTML, CSS, JS, and asset files.
    """
    return send_from_directory(app.static_folder, filename)


# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    print("Starting AI Math Learning Game Server...")
    print("Server will be available at: http://localhost:5000")
    print("Frontend will be available at: http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
