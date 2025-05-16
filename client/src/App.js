import React, { useState } from 'react';
import './App.css';
import Quiz from './Quiz';

function App() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startQuiz = async (certification) => {
    setLoading(true);
    setError(null);
    setQuestions([]);

    try {
      const response = await fetch('https://quiz-app-36wj5.ondigitalocean.app/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certification }),
      });

      // First get raw response text
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonErr) {
        // Show partial response for debugging
        throw new Error(`Invalid server response: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data?.error || `Server error: ${response.status}`);
      }

      // Deep validation of questions
      if (!data?.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid question format from server');
      }

      const validQuestions = data.questions.filter(q => 
        q.text && q.options?.length >= 2 && ['A','B','C','D'].includes(q.correct?.[0])
      );

      if (validQuestions.length === 0) {
        throw new Error('No valid questions received');
      }

      setQuestions(validQuestions);

    } catch (err) {
      setError(err.message);
      console.error('Quiz Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setQuestions([]);
    setError(null);
  };

  return (
    <div className="app">
      <h1>Welcome to QuizBull - Select the certification you would like to take a practice quiz on:</h1>

      {loading && <div className="loading">Loading questions...</div>}
      
      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
          <button onClick={handleRestart} style={{ marginLeft: '1rem' }}>
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (!questions || questions.length === 0) && (
        <div className="cert-buttons">
          <button onClick={() => startQuiz('SIE')}>SIE</button>
          <button onClick={() => startQuiz('Series 7')}>Series 7</button>
          <button onClick={() => startQuiz('Series 63')}>Series 63</button>
          <button onClick={() => startQuiz('Series 65')}>Series 65</button>
          <button onClick={() => startQuiz('Series 66')}>Series 66</button>
          <button onClick={() => startQuiz('CFP')}>CFP</button>
        </div>
      )}

      {!loading && !error && questions.length > 0 && (
        <Quiz questions={questions} onRestart={handleRestart} />
      )}
    </div>
  );
}

export default App;