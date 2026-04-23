"""
Machine Learning Models for Adaptive Learning
- Item Response Theory (IRT) for difficulty calibration
- Bayesian Knowledge Tracing (BKT) for mastery estimation
- Difficulty adaptor for dynamic question selection
- Learning path recommender for next topic suggestion
"""

import numpy as np
from datetime import datetime, timedelta
import json
from database import db


class ItemResponseTheory:
    """
    Item Response Theory (IRT) for calibrating question difficulty
    Based on Rasch Model: P(correct) = 1 / (1 + exp(-(ability - difficulty)))
    """

    def __init__(self):
        self.learning_rate = 0.1

    def update_difficulty(self, question_id: int, is_correct: bool,
                         ability: float, current_difficulty: float) -> float:
        """
        Update question difficulty based on student response
        - If student (with known ability) answers correctly: question is harder
        - If student answers incorrectly: question is easier
        """
        # Calculate discrimination using logistic function
        discrimination = self._calculate_discrimination(ability, current_difficulty)

        # Adjustment based on correctness
        if is_correct:
            # Student got it right - question might be too easy
            new_difficulty = current_difficulty + (self.learning_rate * discrimination)
        else:
            # Student got it wrong - question might be too hard
            new_difficulty = current_difficulty - (self.learning_rate * discrimination)

        # Keep difficulty bounded [0, 1]
        return max(0.0, min(1.0, new_difficulty))

    def _calculate_discrimination(self, ability: float, difficulty: float) -> float:
        """Calculate discrimination index (how well question differentiates students)"""
        # Higher when ability ≈ difficulty (most discriminating)
        diff = abs(ability - difficulty)
        return max(0.1, 1.0 - (diff ** 2))

    def estimate_ability(self, correct_answers: int, total_attempts: int) -> float:
        """Estimate student ability from raw score"""
        if total_attempts == 0:
            return 0.5

        raw_score = correct_answers / total_attempts

        # Convert raw score to ability (0-1 scale)
        # Using logit transformation: ability = ln(raw_score / (1 - raw_score))
        if raw_score == 0:
            ability = 0.1
        elif raw_score == 1:
            ability = 0.9
        else:
            ability = raw_score

        return max(0.0, min(1.0, ability))

    def probability_correct(self, ability: float, difficulty: float) -> float:
        """
        Calculate probability of correct response given ability and difficulty
        P(correct) = 1 / (1 + exp(-(ability - difficulty) * 5))
        """
        try:
            exponent = -(ability - difficulty) * 5
            return 1.0 / (1.0 + np.exp(exponent))
        except:
            return 0.5


class BayesianKnowledgeTracing:
    """
    Bayesian Knowledge Tracing for estimating knowledge state
    Tracks: mastery probability, learn rate, guess rate, slip rate
    """

    def __init__(self):
        self.learn_rate = 0.1  # Probability of learning from one attempt
        self.guess_rate = 0.1  # Probability of correct guess when not mastered
        self.slip_rate = 0.05  # Probability of error when mastered

    def update_mastery(self, current_mastery: float, is_correct: bool,
                      confidence: float = 1.0) -> float:
        """
        Update mastery probability based on response
        Using Bayesian update: P(mastery|evidence)
        """
        if is_correct:
            # Correct answer - increases mastery probability
            # More increase if high confidence
            increase = (1.0 - current_mastery) * (confidence * 0.3)
            return min(1.0, current_mastery + increase)
        else:
            # Incorrect answer - decreases mastery probability
            # More decrease if it's a common response (high confidence)
            decrease = current_mastery * (confidence * 0.2)
            return max(0.0, current_mastery - decrease)

    def predict_mastery(self, correct_count: int, total_attempts: int,
                       time_since_last_attempt: float) -> float:
        """
        Predict mastery probability from performance
        Factors: correctness ratio, time decay, learning trajectory
        """
        if total_attempts == 0:
            return 0.0

        # Base mastery from performance
        performance_score = correct_count / total_attempts

        # Time decay - older attempts have less weight
        time_decay = max(0.5, 1.0 - (time_since_last_attempt / 30))  # 30-day decay

        # Learning trajectory - accelerating improvement shows learning
        mastery = performance_score * 0.7 + (time_decay * 0.3)

        return max(0.0, min(1.0, mastery))

    def estimate_knowledge_state(self, mastery: float) -> dict:
        """Estimate current knowledge state (not learned, learning, mastered)"""
        if mastery < 0.33:
            return {'state': 'not_learned', 'confidence': 'low'}
        elif mastery < 0.66:
            return {'state': 'learning', 'confidence': 'medium'}
        else:
            return {'state': 'mastered', 'confidence': 'high'}


class DifficultyAdaptor:
    """
    Dynamically adjust question difficulty based on student performance
    """

    def __init__(self):
        self.irt = ItemResponseTheory()

    def get_next_difficulty(self, student_ability: float, current_difficulty: float,
                           recent_performance: list) -> float:
        """
        Suggest next question difficulty
        Strategy: Keep difficulty slightly above current ability for optimal learning
        """
        if not recent_performance:
            return student_ability

        # Analyze recent performance trend
        recent_correct = sum(recent_performance[-5:]) / len(recent_performance[-5:])

        # Target: 70-80% success rate (optimal learning zone)
        if recent_correct > 0.85:
            # Student doing too well - increase difficulty
            return min(1.0, current_difficulty + 0.15)
        elif recent_correct < 0.50:
            # Student struggling - decrease difficulty
            return max(0.0, current_difficulty - 0.15)
        else:
            # Student in sweet spot - maintain or slightly adjust
            return current_difficulty

    def suggest_difficulty_sequence(self, student_ability: float,
                                    topic: str, num_questions: int = 5) -> list:
        """
        Suggest a sequence of question difficulties for optimal learning
        """
        difficulties = []
        current_diff = student_ability

        for i in range(num_questions):
            difficulties.append(current_diff)
            # Gradually increase difficulty for practice
            current_diff = min(1.0, current_diff + 0.05)

        return difficulties


class LearningPathRecommender:
    """
    Recommend next topics based on student's current mastery levels
    """

    def __init__(self):
        self.bkt = BayesianKnowledgeTracing()

    def get_recommendations(self, student_id: str, num_recommendations: int = 3) -> list:
        """
        Get personalized learning path recommendations
        Based on: current mastery, topic prerequisites, learning gap analysis
        """
        # Get student progress
        progress = db.get_student_progress(student_id)

        if not progress['objectives']:
            # No progress yet - recommend foundational topics
            return self._recommend_foundational_topics(num_recommendations)

        # Identify gaps and recommend next steps
        recommendations = []

        # 1. Topics with <70% mastery (needs reinforcement)
        weak_topics = [obj for obj in progress['objectives']
                      if obj['mastery_level'] < 0.7]

        for topic in weak_topics[:num_recommendations]:
            recommendations.append({
                'topic': topic['topic'],
                'reason': 'reinforce',
                'priority': 1.0 - topic['mastery_level'],  # Higher priority for weaker topics
                'difficulty': 'medium'
            })

        # 2. Topics with >70% mastery (ready to advance)
        ready_topics = [obj for obj in progress['objectives']
                       if obj['mastery_level'] >= 0.7]

        for topic in ready_topics[:num_recommendations]:
            recommendations.append({
                'topic': self._get_advanced_topic(topic['topic']),
                'reason': 'advance',
                'priority': topic['mastery_level'],
                'difficulty': 'hard'
            })

        # 3. New topics based on prerequisites
        if len(recommendations) < num_recommendations:
            new_topics = self._recommend_new_topics(progress['objectives'],
                                                   num_recommendations - len(recommendations))
            recommendations.extend(new_topics)

        # Sort by priority and return
        recommendations.sort(key=lambda x: x['priority'], reverse=True)
        return recommendations[:num_recommendations]

    def _recommend_foundational_topics(self, num: int) -> list:
        """Recommend foundational topics for new students"""
        foundational = [
            {'topic': 'Basic Arithmetic', 'reason': 'foundational', 'difficulty': 'easy'},
            {'topic': 'Fractions', 'reason': 'foundational', 'difficulty': 'easy'},
            {'topic': 'Decimals', 'reason': 'foundational', 'difficulty': 'easy'},
            {'topic': 'Percentages', 'reason': 'foundational', 'difficulty': 'medium'},
        ]

        recs = []
        for topic in foundational[:num]:
            topic['priority'] = 0.8
            recs.append(topic)

        return recs

    def _get_advanced_topic(self, current_topic: str) -> str:
        """Map current topic to advanced topic"""
        topic_progression = {
            'Basic Arithmetic': 'Algebra Basics',
            'Fractions': 'Ratio and Proportion',
            'Decimals': 'Scientific Notation',
            'Percentages': 'Compound Interest',
        }
        return topic_progression.get(current_topic, 'Advanced ' + current_topic)

    def _recommend_new_topics(self, completed_objectives: list, num: int) -> list:
        """Recommend new topics based on current mastery"""
        all_topics = [
            'Number Theory', 'Geometry Basics', 'Algebra',
            'Calculus Basics', 'Statistics', 'Probability'
        ]

        completed = {obj['topic'] for obj in completed_objectives}
        available = [t for t in all_topics if t not in completed]

        recs = []
        for topic in available[:num]:
            recs.append({
                'topic': topic,
                'reason': 'new',
                'priority': 0.6,
                'difficulty': 'medium'
            })

        return recs

    def calculate_priority_score(self, topic: str, mastery: float,
                                time_since_practice: float) -> float:
        """
        Calculate priority score for a topic (0-1)
        Higher = more urgent to practice
        """
        # Factor 1: Mastery gap (how far from mastery)
        mastery_gap = max(0.0, 1.0 - mastery)

        # Factor 2: Time decay (when was last practice)
        time_factor = min(1.0, time_since_practice / 30)  # Normalized to 30 days

        # Combine: equal weight
        priority = (mastery_gap * 0.5) + (time_factor * 0.5)

        return max(0.0, min(1.0, priority))


# Initialize models
irt_model = ItemResponseTheory()
bkt_model = BayesianKnowledgeTracing()
difficulty_adaptor = DifficultyAdaptor()
path_recommender = LearningPathRecommender()
