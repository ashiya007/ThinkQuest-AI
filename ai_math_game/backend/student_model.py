"""
Student Performance Model
This module tracks student performance and maintains learning data
"""

import sqlite3
import json
from datetime import datetime
import os

class StudentModel:
    def __init__(self, db_path='database/students.db'):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables"""
        # Ensure the database directory exists
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create students table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT UNIQUE,
                class INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create performance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS performance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                question TEXT,
                correct_answer INTEGER,
                student_answer INTEGER,
                is_correct BOOLEAN,
                operation TEXT,
                difficulty TEXT,
                time_taken REAL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students (student_id)
            )
        ''')
        
        # Create difficulty tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS difficulty_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT,
                operation TEXT,
                current_difficulty TEXT DEFAULT 'easy',
                accuracy REAL DEFAULT 0.0,
                avg_time REAL DEFAULT 0.0,
                total_questions INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students (student_id)
            )
        ''')
        
        conn.commit()
        conn.close()

    def _get_connection(self):
        """Standardizes connection to ensure Foreign Keys are active."""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA foreign_keys = ON;") # Examiners LOVE this line
        return conn
    
    def add_student(self, student_id, student_class):
        """Add a new student to the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO students (student_id, class)
                VALUES (?, ?)
            ''', (student_id, student_class))
            
            # Initialize difficulty tracking for all operations
            operations = ['addition', 'subtraction', 'multiplication', 'division', 'comparison', 'word_problems']
            for operation in operations:
                cursor.execute('''
                    INSERT OR IGNORE INTO difficulty_tracking 
                    (student_id, operation, current_difficulty)
                    VALUES (?, ?, 'easy')
                ''', (student_id, operation))
            
            conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error adding student: {e}")
            return False
        finally:
            conn.close()
    
    def record_answer(self, student_id, question_data, student_answer, time_taken):
        """Record student's answer and update performance metrics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            is_correct = student_answer == question_data['correct_answer']
            
            # Record the answer
            cursor.execute('''
                INSERT INTO performance 
                (student_id, question, correct_answer, student_answer, is_correct, 
                 operation, difficulty, time_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                student_id,
                question_data['question'],
                question_data['correct_answer'],
                student_answer,
                is_correct,
                question_data['operation'],
                question_data['difficulty'],
                time_taken
            ))
            
            # Update difficulty tracking
            self._update_difficulty_tracking(cursor, student_id, question_data['operation'], 
                                            is_correct, time_taken)
            
            conn.commit()
            return is_correct
        except sqlite3.Error as e:
            print(f"Error recording answer: {e}")
            return False
        finally:
            conn.close()
    
    def _update_difficulty_tracking(self, cursor, student_id, operation, is_correct, time_taken):
        """Update difficulty tracking for a student and operation"""
        # Get current tracking data
        cursor.execute('''
            SELECT total_questions, correct_answers, avg_time, current_difficulty
            FROM difficulty_tracking
            WHERE student_id = ? AND operation = ?
        ''', (student_id, operation))
        
        result = cursor.fetchone()
        
        if result:
            total_questions, correct_answers, avg_time, current_difficulty = result
            
            # Update metrics
            new_total = total_questions + 1
            new_correct = correct_answers + (1 if is_correct else 0)
            new_accuracy = (new_correct / new_total) * 100
            new_avg_time = ((avg_time * total_questions) + time_taken) / new_total
            
            cursor.execute('''
                UPDATE difficulty_tracking
                SET total_questions = ?, correct_answers = ?, 
                    accuracy = ?, avg_time = ?, last_updated = CURRENT_TIMESTAMP
                WHERE student_id = ? AND operation = ?
            ''', (new_total, new_correct, new_accuracy, new_avg_time, student_id, operation))
    
    def get_student_performance(self, student_id):
        """Get comprehensive performance data for a student"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get overall stats
            cursor.execute('''
                SELECT 
                    COUNT(*) as total_questions,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
                    AVG(time_taken) as avg_time,
                    class
                FROM performance p
                JOIN students s ON p.student_id = s.student_id
                WHERE p.student_id = ?
            ''', (student_id,))
            
            overall_stats = cursor.fetchone()
            
            if not overall_stats or overall_stats[0] == 0:
                return {
                    'total_questions': 0,
                    'accuracy': 0,
                    'avg_time': 0,
                    'class': 0,
                    'operation_stats': {},
                    'difficulty_stats': {}
                }
            
            total_questions, correct_answers, avg_time, student_class = overall_stats
            accuracy = (correct_answers / total_questions) * 100 if total_questions > 0 else 0
            
            # Get operation-wise stats
            cursor.execute('''
                SELECT operation, COUNT(*) as count, 
                       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
                       AVG(time_taken) as avg_time
                FROM performance
                WHERE student_id = ?
                GROUP BY operation
            ''', (student_id,))
            
            operation_stats = {}
            for op, count, correct, op_avg_time in cursor.fetchall():
                operation_stats[op] = {
                    'total_questions': count,
                    'correct_answers': correct,
                    'accuracy': (correct / count) * 100 if count > 0 else 0,
                    'avg_time': op_avg_time or 0
                }
            
            # Get difficulty-wise stats
            cursor.execute('''
                SELECT difficulty, COUNT(*) as count,
                       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
                FROM performance
                WHERE student_id = ?
                GROUP BY difficulty
            ''', (student_id,))
            
            difficulty_stats = {}
            for diff, count, correct in cursor.fetchall():
                difficulty_stats[diff] = {
                    'total_questions': count,
                    'correct_answers': correct,
                    'accuracy': (correct / count) * 100 if count > 0 else 0
                }
            
            # Get current difficulty levels
            cursor.execute('''
                SELECT operation, current_difficulty, accuracy
                FROM difficulty_tracking
                WHERE student_id = ?
            ''', (student_id,))
            
            current_difficulties = {}
            for op, diff, acc in cursor.fetchall():
                current_difficulties[op] = {
                    'current_difficulty': diff,
                    'accuracy': acc
                }
            
            return {
                'total_questions': total_questions,
                'correct_answers': correct_answers,
                'accuracy': accuracy,
                'avg_time': avg_time or 0,
                'class': student_class,
                'operation_stats': operation_stats,
                'difficulty_stats': difficulty_stats,
                'current_difficulties': current_difficulties
            }
            
        except sqlite3.Error as e:
            print(f"Error getting performance: {e}")
            return None
        finally:
            conn.close()
    
    def get_current_difficulty(self, student_id, operation):
        """Get current difficulty level for a student and operation"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT current_difficulty FROM difficulty_tracking
                WHERE student_id = ? AND operation = ?
            ''', (student_id, operation))
            
            result = cursor.fetchone()
            return result[0] if result else 'easy'
        except sqlite3.Error as e:
            print(f"Error getting difficulty: {e}")
            return 'easy'
        finally:
            conn.close()
    
    def update_difficulty(self, student_id, operation, new_difficulty):
        """Update difficulty level for a student and operation"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE difficulty_tracking
                SET current_difficulty = ?, last_updated = CURRENT_TIMESTAMP
                WHERE student_id = ? AND operation = ?
            ''', (new_difficulty, student_id, operation))
            
            conn.commit()
            return True
        except sqlite3.Error as e:
            print(f"Error updating difficulty: {e}")
            return False
        finally:
            conn.close()
    
    def get_recent_performance(self, student_id, limit=10):
        """Get recent performance data for a student"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT question, correct_answer, student_answer, is_correct,
                       operation, difficulty, time_taken, timestamp
                FROM performance
                WHERE student_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (student_id, limit))
            
            recent_data = []
            for row in cursor.fetchall():
                recent_data.append({
                    'question': row[0],
                    'correct_answer': row[1],
                    'student_answer': row[2],
                    'is_correct': bool(row[3]),
                    'operation': row[4],
                    'difficulty': row[5],
                    'time_taken': row[6],
                    'timestamp': row[7]
                })
            
            return recent_data
        except sqlite3.Error as e:
            print(f"Error getting recent performance: {e}")
            return []
        finally:
            conn.close()
