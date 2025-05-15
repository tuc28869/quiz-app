import React, { useState } from 'react';

function Quiz({ questions, onRestart }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);

  const handleAnswer = (selected) => {
    setSelectedAnswer(selected);
    if (selected === questions[currentQuestion].correct) {
      setScore(score + 1);
    }
    setTimeout(() => {
      setSelectedAnswer(null);
      setCurrentQuestion(currentQuestion + 1);
    }, 1000); // 1 second delay for feedback
  };

  if (currentQuestion >= questions.length) {
    return (
      <div className="results">
        <h2>Final Score: {score}/{questions.length}</h2>
        <button onClick={onRestart}>Restart</button>
      </div>
    );
  }

  const q = questions[currentQuestion];

  return (
    <div className="question-card">
      <h3>Question {currentQuestion + 1} of {questions.length}</h3>
      <p>{q.text}</p>
      <div className="options">
        {q.options.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => handleAnswer(opt[0])}
            disabled={selectedAnswer !== null}
            style={{
              backgroundColor:
                selectedAnswer
                  ? opt[0] === q.correct
                    ? 'lightgreen'
                    : opt[0] === selectedAnswer
                      ? 'salmon'
                      : ''
                  : ''
            }}
          >
            {opt}
          </button>
        ))}
      </div>
      <div>Score: {score}</div>
    </div>
  );
}

export default Quiz;
