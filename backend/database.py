"""
Database module for Code Debugger
- Debug history tracking
- Daily usage limits
"""

import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "debugger.db"

class DebuggerDatabase:
    """Manage debug history and usage limits"""

    def __init__(self):
        self.db_path = str(DB_PATH)
        self.init_db()

    def init_db(self):
        """Initialize database tables"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        # Debug history table
        c.execute('''
            CREATE TABLE IF NOT EXISTS debug_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                code TEXT,
                language TEXT,
                errors_found TEXT,
                fixes_applied TEXT,
                explanation TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Usage tracking table
        c.execute('''
            CREATE TABLE IF NOT EXISTS usage_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                debug_count INTEGER DEFAULT 0,
                reset_date DATE NOT NULL,
                UNIQUE(user_id, reset_date)
            )
        ''')

        # Adaptive learning tables
        c.execute('''
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT UNIQUE NOT NULL,
                teacher_id TEXT NOT NULL,
                name TEXT NOT NULL,
                grade_level TEXT NOT NULL,
                subject TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                language TEXT NOT NULL,
                problem_type TEXT,
                is_correct INTEGER NOT NULL,
                time_taken REAL,
                difficulty_rating REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS learning_objectives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                language TEXT NOT NULL,
                mastery_level REAL DEFAULT 0.0,
                attempts_made INTEGER DEFAULT 0,
                correct_answers INTEGER DEFAULT 0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                recommended_language TEXT NOT NULL,
                reasoning TEXT,
                difficulty_level TEXT,
                priority_score REAL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()
        print("[DB] Code Debugger database initialized with adaptive learning tables")

    def save_debug(self, user_id: str, code: str, language: str,
                   errors_found: list, fixes_applied: list, explanation: str) -> int:
        """Save debug session to history"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            INSERT INTO debug_history (user_id, code, language, errors_found, fixes_applied, explanation)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, code, language, json.dumps(errors_found), json.dumps(fixes_applied), explanation))

        debug_id = c.lastrowid
        conn.commit()
        conn.close()

        # Cleanup old debugs (keep only last 7)
        self.cleanup_old_debugs(user_id)

        return debug_id

    def get_last_7_debugs(self, user_id: str) -> list:
        """Get last 7 debug sessions for a user"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT id, code, language, errors_found, fixes_applied, explanation, created_at
            FROM debug_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 7
        ''', (user_id,))

        rows = c.fetchall()
        conn.close()

        debugs = []
        for row in rows:
            debugs.append({
                'id': row[0],
                'code': row[1],
                'language': row[2],
                'errors': json.loads(row[3]) if row[3] else [],
                'fixes': json.loads(row[4]) if row[4] else [],
                'explanation': row[5],
                'created_at': row[6],
                'preview': (row[1][:50] + '...') if row[1] and len(row[1]) > 50 else (row[1] or '')
            })

        return debugs

    def cleanup_old_debugs(self, user_id: str, keep_count: int = 7) -> int:
        """Delete debugs older than the last N per user"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT id FROM debug_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT -1 OFFSET ?
        ''', (user_id, keep_count))

        rows_to_delete = c.fetchall()
        deleted_count = len(rows_to_delete)

        if deleted_count > 0:
            ids_to_delete = [row[0] for row in rows_to_delete]
            placeholders = ','.join('?' * len(ids_to_delete))
            c.execute(f'DELETE FROM debug_history WHERE id IN ({placeholders})', ids_to_delete)

        conn.commit()
        conn.close()
        return deleted_count

    def check_usage(self, user_id: str) -> dict:
        """Check daily usage for a user"""
        from datetime import date
        today = str(date.today())

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT debug_count FROM usage_tracking
            WHERE user_id = ? AND reset_date = ?
        ''', (user_id, today))

        row = c.fetchone()
        conn.close()

        if row:
            debug_count = row[0]
        else:
            debug_count = 0

        limit = 50
        remaining = max(0, limit - debug_count)
        exceeded = debug_count >= limit

        return {
            'debug_count': debug_count,
            'limit': limit,
            'remaining': remaining,
            'exceeded': exceeded
        }

    def increment_usage(self, user_id: str) -> dict:
        """Increment usage count for today"""
        from datetime import date
        today = str(date.today())

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        # Check if entry exists for today
        c.execute('''
            SELECT debug_count FROM usage_tracking
            WHERE user_id = ? AND reset_date = ?
        ''', (user_id, today))

        row = c.fetchone()

        if row:
            # Update existing entry
            new_count = row[0] + 1
            c.execute('''
                UPDATE usage_tracking
                SET debug_count = ?
                WHERE user_id = ? AND reset_date = ?
            ''', (new_count, user_id, today))
        else:
            # Create new entry
            c.execute('''
                INSERT INTO usage_tracking (user_id, debug_count, reset_date)
                VALUES (?, 1, ?)
            ''', (user_id, today))
            new_count = 1

        conn.commit()
        conn.close()

        limit = 50
        remaining = max(0, limit - new_count)
        exceeded = new_count >= limit

        return {
            'debug_count': new_count,
            'limit': limit,
            'remaining': remaining,
            'exceeded': exceeded
        }

    def add_student(self, student_id: str, teacher_id: str, name: str, grade_level: str, subject: str) -> bool:
        """Register a new student for adaptive learning"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        try:
            c.execute('''
                INSERT INTO students (student_id, teacher_id, name, grade_level, subject)
                VALUES (?, ?, ?, ?, ?)
            ''', (student_id, teacher_id, name, grade_level, subject))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()

    def record_assessment(self, student_id: str, language: str, is_correct: bool,
                         time_taken: float = None, difficulty_rating: float = None) -> int:
        """Record a student assessment for adaptive learning"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            INSERT INTO assessments (student_id, language, is_correct, time_taken, difficulty_rating)
            VALUES (?, ?, ?, ?, ?)
        ''', (student_id, language, 1 if is_correct else 0, time_taken, difficulty_rating))

        assessment_id = c.lastrowid

        # Update learning objective
        self._update_learning_objective(c, student_id, language, is_correct)

        conn.commit()
        conn.close()
        return assessment_id

    def get_student_progress(self, student_id: str) -> dict:
        """Get overall progress and per-language mastery for a student"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT language, mastery_level, attempts_made, correct_answers
            FROM learning_objectives
            WHERE student_id = ?
            ORDER BY mastery_level DESC
        ''', (student_id,))

        objectives = c.fetchall()
        conn.close()

        total_mastery = 0
        languages = []

        for obj in objectives:
            lang, mastery, attempts, correct = obj
            languages.append({
                'language': lang,
                'mastery': round(mastery, 2),
                'attempts': attempts,
                'correct': correct
            })
            total_mastery += mastery

        avg_mastery = (total_mastery / len(languages)) if languages else 0

        return {
            'student_id': student_id,
            'overall_mastery': round(avg_mastery, 2),
            'objectives': languages
        }

    def add_recommendation(self, student_id: str, recommended_language: str,
                          reasoning: str, difficulty_level: str, priority_score: float) -> int:
        """Add a personalized learning recommendation"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            INSERT INTO recommendations (student_id, recommended_language, reasoning, difficulty_level, priority_score)
            VALUES (?, ?, ?, ?, ?)
        ''', (student_id, recommended_language, reasoning, difficulty_level, priority_score))

        rec_id = c.lastrowid
        conn.commit()
        conn.close()
        return rec_id

    def get_recommendations(self, student_id: str, limit: int = 3) -> list:
        """Get pending recommendations for a student"""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT recommended_language, reasoning, difficulty_level, priority_score
            FROM recommendations
            WHERE student_id = ? AND status = 'pending'
            ORDER BY priority_score DESC
            LIMIT ?
        ''', (student_id, limit))

        rows = c.fetchall()
        conn.close()

        recommendations = []
        for row in rows:
            lang, reasoning, difficulty, priority = row
            recommendations.append({
                'language': lang,
                'reasoning': reasoning,
                'difficulty': difficulty,
                'priority': round(priority, 2)
            })

        return recommendations

    def _update_learning_objective(self, cursor, student_id: str, language: str, is_correct: bool):
        """Update or create learning objective for a student/language"""
        cursor.execute('''
            SELECT id, attempts_made, correct_answers FROM learning_objectives
            WHERE student_id = ? AND language = ?
        ''', (student_id, language))

        row = cursor.fetchone()

        if row:
            obj_id, attempts, correct = row
            new_attempts = attempts + 1
            new_correct = correct + (1 if is_correct else 0)
            mastery = new_correct / new_attempts if new_attempts > 0 else 0

            cursor.execute('''
                UPDATE learning_objectives
                SET attempts_made = ?, correct_answers = ?, mastery_level = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (new_attempts, new_correct, mastery, obj_id))
        else:
            new_correct = 1 if is_correct else 0
            mastery = float(new_correct)

            cursor.execute('''
                INSERT INTO learning_objectives (student_id, language, attempts_made, correct_answers, mastery_level)
                VALUES (?, ?, 1, ?, ?)
            ''', (student_id, language, new_correct, mastery))

# Create global database instance
db = DebuggerDatabase()
