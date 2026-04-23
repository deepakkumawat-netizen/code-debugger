import React, { useState, useEffect } from 'react';
import './RecommendationPanel.css';

export default function RecommendationPanel({ studentId, teacherId }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecommendations();
  }, [studentId]);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/adaptive/recommend-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          num_recommendations: 3
        })
      });

      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const data = await response.json();

      if (data.success) {
        setRecommendations(data.recommendations);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTopic = (topic) => {
    console.log('Selected topic:', topic);
    // Trigger parent to load this topic
    window.dispatchEvent(
      new CustomEvent('topic-selected', {
        detail: { topic }
      })
    );
  };

  if (loading) return <div className="rec-loading">Finding personalized recommendations...</div>;
  if (error) return <div className="rec-error">Error: {error}</div>;

  return (
    <div className="recommendation-panel">
      <div className="rec-header">
        <h3>📚 Recommended Next Steps</h3>
        <button
          className="rec-refresh-btn"
          onClick={fetchRecommendations}
          title="Refresh recommendations"
        >
          🔄
        </button>
      </div>

      {recommendations.length > 0 ? (
        <div className="recommendations-list">
          {recommendations.map((rec, idx) => (
            <div key={idx} className={`recommendation-card rec-${rec.reason}`}>
              <div className="rec-content">
                <div className="rec-topic">
                  <span className="rec-emoji">
                    {getRecommendationEmoji(rec.reason)}
                  </span>
                  <span className="rec-text">{rec.topic}</span>
                </div>

                <div className="rec-meta">
                  <span className={`rec-badge rec-${rec.reason}`}>
                    {getRecommendationLabel(rec.reason)}
                  </span>
                  <span className="rec-difficulty">
                    Difficulty: {rec.difficulty}
                  </span>
                </div>

                <div className="rec-priority-bar">
                  <div
                    className="rec-priority-fill"
                    style={{ width: `${rec.priority * 100}%` }}
                  />
                </div>
              </div>

              <button
                className="rec-select-btn"
                onClick={() => handleSelectTopic(rec.topic)}
                title={`Learn ${rec.topic}`}
              >
                Start →
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-recommendations">
          <p>No specific recommendations yet.</p>
          <small>Complete more assessments to get personalized recommendations.</small>
        </div>
      )}
    </div>
  );
}

function getRecommendationEmoji(reason) {
  const emojis = {
    'foundational': '🏗️',
    'reinforce': '💪',
    'advance': '🚀',
    'new': '✨'
  };
  return emojis[reason] || '📖';
}

function getRecommendationLabel(reason) {
  const labels = {
    'foundational': 'Foundation',
    'reinforce': 'Reinforce',
    'advance': 'Advance',
    'new': 'New Topic'
  };
  return labels[reason] || 'Recommended';
}
