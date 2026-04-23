"""
Integration layer for adaptive learning with existing AI systems
- Hooks adaptive models into existing endpoints
- Automatically tracks student performance
- Adjusts difficulty based on response quality
"""

from database import db
from ml_models import (
    irt_model, bkt_model, difficulty_adaptor,
    path_recommender
)
from datetime import datetime
import json


class AdaptiveIntegration:
    """Bridge between existing AI systems and adaptive learning models"""

    def __init__(self):
        self.irt = irt_model
        self.bkt = bkt_model
        self.adaptor = difficulty_adaptor
        self.recommender = path_recommender

    def register_student_interaction(self, student_id: str, teacher_id: str,
                                    tool_name: str, topic: str,
                                    grade_level: str, subject: str) -> dict:
        """
        Register when a student starts an activity
        Creates student record if needed
        """
        # Ensure student is registered
        db.add_student(
            student_id=student_id,
            teacher_id=teacher_id,
            name=f"Student-{student_id}",  # Placeholder
            grade_level=grade_level,
            subject=subject
        )

        return {
            "student_registered": True,
            "student_id": student_id,
            "topic": topic
        }

    def adapt_generation_difficulty(self, student_id: str, topic: str,
                                    grade_level: str) -> float:
        """
        Determine appropriate difficulty for generating new content
        Returns difficulty score (0-1)
        """
        progress = db.get_student_progress(student_id)

        if not progress['objectives']:
            # New student - start with medium difficulty
            return 0.5

        # Find topic mastery if available
        topic_mastery = 0.5
        for obj in progress['objectives']:
            if obj['topic'].lower() == topic.lower():
                topic_mastery = obj['mastery_level']
                break

        # Use adaptor to suggest next difficulty
        student_ability = self.irt.estimate_ability(
            sum(obj['correct_answers'] for obj in progress['objectives']),
            sum(obj['total_attempts'] for obj in progress['objectives'])
        )

        next_difficulty = self.adaptor.get_next_difficulty(
            student_ability=student_ability,
            current_difficulty=topic_mastery,
            recent_performance=[]
        )

        return next_difficulty

    def record_generation(self, student_id: str, teacher_id: str,
                         tool_name: str, topic: str, content: str,
                         grade_level: str, subject: str) -> dict:
        """
        Record when student generates content (worksheet, lesson, etc.)
        Updates learning objectives
        """
        # This would be integrated with existing save_chat
        # For now, just update learning objective
        mastery = 0.3  # Default initial mastery for new attempt

        # Log to database via existing chat history
        chat_id = db.save_chat(
            teacher_id=teacher_id,
            tool_name=tool_name,
            topic=topic,
            grade_level=grade_level,
            subject=subject,
            request_data={"student_id": student_id},
            response_preview=content[:200],
            response_content=content
        )

        return {
            "chat_id": chat_id,
            "tracked": True,
            "student_id": student_id
        }

    def record_student_answer(self, student_id: str, teacher_id: str,
                             question_id: int, answer: str, is_correct: bool,
                             time_taken: float, topic: str) -> dict:
        """
        Record when student answers a question
        Updates difficulty rating based on response
        """
        # Estimate difficulty rating
        difficulty_rating = 0.5  # Placeholder

        # Record assessment
        assessment_id = db.record_assessment(
            student_id=student_id,
            question_id=question_id,
            teacher_id=teacher_id,
            answer=answer,
            is_correct=is_correct,
            time_taken=time_taken,
            difficulty_rating=difficulty_rating
        )

        # Get updated progress
        progress = db.get_student_progress(student_id)

        return {
            "assessment_id": assessment_id,
            "recorded": True,
            "updated_progress": progress
        }

    def suggest_next_topic(self, student_id: str) -> dict:
        """
        Suggest personalized next topic based on current mastery
        """
        recommendations = self.recommender.get_recommendations(
            student_id=student_id,
            num_recommendations=1
        )

        if recommendations:
            rec = recommendations[0]
            return {
                "next_topic": rec['topic'],
                "reason": rec['reason'],
                "difficulty": rec['difficulty'],
                "priority": rec['priority']
            }

        return {"next_topic": None, "reason": "foundational"}

    def get_adaptive_explanation(self, student_id: str, topic: str,
                                grade_level: str, explanation: str) -> str:
        """
        Customize explanation based on student's mastery level
        Shorter for low mastery, more detailed for advanced
        """
        progress = db.get_student_progress(student_id)

        # Find mastery for this topic
        mastery = 0.5
        for obj in progress['objectives']:
            if obj['topic'].lower() == topic.lower():
                mastery = obj['mastery_level']
                break

        # Adjust explanation length based on mastery
        if mastery < 0.33:
            # Struggling - simplify explanation
            return self._simplify_explanation(explanation)
        elif mastery > 0.66:
            # Advanced - add complexity
            return self._enhance_explanation(explanation)

        return explanation

    def _simplify_explanation(self, explanation: str) -> str:
        """Simplify explanation for struggling students"""
        # Keep first 70% of text (more concise)
        cutoff = int(len(explanation) * 0.7)
        return explanation[:cutoff] + "..."

    def _enhance_explanation(self, explanation: str) -> str:
        """Add depth to explanation for advanced students"""
        # In real implementation, would add advanced concepts
        return explanation + "\n\nFor advanced learners: Consider how this relates to..."

    def should_present_challenge(self, student_id: str, topic: str) -> bool:
        """
        Determine if student is ready for challenge problem
        Based on recent performance and mastery level
        """
        progress = db.get_student_progress(student_id)

        for obj in progress['objectives']:
            if obj['topic'].lower() == topic.lower():
                # Present challenge if >70% mastery and recent successes
                return obj['mastery_level'] > 0.7

        return False

    def create_adaptive_question_sequence(self, student_id: str,
                                         topic: str, num_questions: int = 5) -> list:
        """
        Create difficulty-adapted sequence of questions
        """
        progress = db.get_student_progress(student_id)

        # Estimate student ability
        if progress['objectives']:
            ability = sum(obj['mastery_level'] for obj in progress['objectives']) / len(progress['objectives'])
        else:
            ability = 0.5

        # Get difficulty sequence
        difficulties = self.adaptor.suggest_difficulty_sequence(
            student_ability=ability,
            topic=topic,
            num_questions=num_questions
        )

        return [
            {
                "sequence_number": i + 1,
                "topic": topic,
                "difficulty": diff,
                "difficulty_label": self._difficulty_label(diff)
            }
            for i, diff in enumerate(difficulties)
        ]

    def _difficulty_label(self, difficulty: float) -> str:
        """Convert difficulty score to label"""
        if difficulty < 0.33:
            return "Easy"
        elif difficulty < 0.66:
            return "Medium"
        else:
            return "Hard"

    def get_student_insights(self, teacher_id: str) -> dict:
        """
        Get insights for teacher about all their students
        """
        # This would query all students for a teacher
        # Placeholder implementation
        return {
            "total_students": 0,
            "average_mastery": 0.0,
            "mastery_distribution": {
                "low": 0,
                "medium": 0,
                "high": 0
            },
            "recent_activity": [],
            "recommendations": []
        }


# Initialize integration
adaptive_integration = AdaptiveIntegration()
