import React, { useState, useEffect } from 'react';
import './AdaptiveProgressTracker.css';

export default function AdaptiveProgressTracker({ studentId, teacherId }) {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStudentProgress();
    const interval = setInterval(fetchStudentProgress, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [studentId]);

  const fetchStudentProgress = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/adaptive/student-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId })
      });

      if (!response.ok) throw new Error('Failed to fetch progress');
      const data = await response.json();

      if (data.success) {
        setProgress(data.progress);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching progress:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="progress-loading">Loading progress...</div>;
  if (error) return <div className="progress-error">Error: {error}</div>;
  if (!progress) return null;

  return (
    <div className="adaptive-progress-tracker">
      <h3>Learning Progress</h3>

      {/* Overall Mastery */}
      <div className="overall-mastery">
        <h4>Overall Mastery</h4>
        <div className="mastery-bar-container">
          <div
            className="mastery-bar"
            style={{
              width: `${progress.overall_mastery * 100}%`
            }}
          >
            <span className="mastery-text">
              {Math.round(progress.overall_mastery * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Topic Progress */}
      <div className="topic-progress">
        <h4>Topic Mastery Levels</h4>
        {progress.objectives.length > 0 ? (
          <div className="objectives-list">
            {progress.objectives.map((obj, idx) => (
              <div key={idx} className="objective-item">
                <div className="objective-header">
                  <span className="topic-name">{obj.topic}</span>
                  <span className="mastery-badge">
                    {Math.round(obj.mastery_level * 100)}%
                  </span>
                </div>
                <div className="objective-bar">
                  <div
                    className={`fill ${getMasteryLevel(obj.mastery_level)}`}
                    style={{ width: `${obj.mastery_level * 100}%` }}
                  />
                </div>
                <div className="objective-stats">
                  <small>
                    {obj.correct_answers}/{obj.total_attempts} correct
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-progress">No progress data yet</p>
        )}
      </div>

      {/* Summary Stats */}
      <div className="progress-summary">
        <div className="stat">
          <span className="stat-label">Topics Covered:</span>
          <span className="stat-value">{progress.total_topics}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg Mastery:</span>
          <span className="stat-value">
            {Math.round(progress.overall_mastery * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function getMasteryLevel(mastery) {
  if (mastery < 0.33) return 'low';
  if (mastery < 0.66) return 'medium';
  return 'high';
}
