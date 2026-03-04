"""
Database Initialization Script
This script initializes the SQLite database with required tables
"""

import sys
import os

# Add the backend directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from student_model import StudentModel

def main():
    """Initialize the database"""
    print("Initializing AI Math Learning Game Database...")
    
    try:
        # Initialize the student model (this will create the database and tables)
        student_model = StudentModel('database/students.db')
        
        print("Database initialized successfully!")
        print("Tables created: students, performance, difficulty_tracking")
        print("Database location: database/students.db")
        
        # Test the database connection
        conn = student_model.db_path
        print(f"Database connection test: {conn}")
        
        print("\nDatabase is ready for use!")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    if success:
        print("\nYou can now start the Flask server:")
        print("cd backend && python app.py")
    else:
        print("\nPlease check the error above and try again.")
