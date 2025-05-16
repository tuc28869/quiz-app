require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { perplexity } = require('@ai-sdk/perplexity');
const { generateText } = require('ai');
const { jsonrepair } = require('jsonrepair');

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CLIENT_URL 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Improved quiz generation endpoint
app.post('/generate-quiz', async (req, res) => {
  try {
    const { certification } = req.body;
    if (!certification || typeof certification !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request: certification parameter required' 
      });
    }

    let validatedQuestions = [];
    let attempts = 0;
    const maxAttempts = 3;

    while (validatedQuestions.length < 5 && attempts < maxAttempts) {
      attempts++;
      
      const prompt = `Generate 5 NEW multiple-choice questions for ${certification} exam.
      Session: ${Date.now()}-${Math.random().toString(36).substring(2, 7)}
      STRICTLY FOLLOW:
      1. Valid JSON with double quotes
      2. No markdown/extra text
      3. 4 options per question
      4. Correct answer A/B/C/D
      5. Vary question types and topics
      
      {
        "questions": [
          {
            "text": "Question text (max 120 chars)",
            "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
            "correct": "A",
            "explanation": "Brief explanation (60 chars)"
          }
        ]
      }`;

      const result = await generateText({
        model: perplexity('sonar-pro'),
        prompt: prompt,
        apiKey: process.env.PERPLEXITY_API_KEY,
        maxTokens: 1500,
        temperature: 1.2,
        topP: 0.95
      });

      if (!result?.text) continue;

      try {
        const repairedJson = jsonrepair(result.text);
        const quizData = JSON.parse(repairedJson);
        
        if (!Array.isArray(quizData?.questions)) continue;

        validatedQuestions = quizData.questions
          .map((q, index) => {
            const base = {
              text: sanitizeText(q.text, `Question ${index + 1}`),
              options: validateOptions(q.options, certification),
              correct: validateCorrectAnswer(q.correct),
              explanation: sanitizeText(q.explanation, '')
            };
            
            // Relax validation for certain certifications
            const minOptions = certification === 'CFP' ? 3 : 4;
            return (base.options.length >= minOptions && base.text.includes('?')) 
              ? base 
              : null;
          })
          .filter(Boolean)
          .slice(0, 5);

      } catch (parseError) {
        console.error('Parse error:', parseError.message);
      }
    }

    if (validatedQuestions.length < 3) {
      throw new Error(`Only generated ${validatedQuestions.length} valid questions`);
    }

    res.json({ questions: validatedQuestions });

  } catch (error) {
    console.error('Server Error:', error.message);
    return res.status(500).json({ 
      error: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Quiz generation failed. Please try again.'
    });
  }
});

// Enhanced helper functions
const sanitizeText = (text, fallback) => {
  if (typeof text !== 'string' || text.trim().length < 10) return fallback;
  return text.substring(0, 200).trim();
};

const validateOptions = (options, certification) => {
  if (!Array.isArray(options)) return [];
  const validated = options
    .slice(0, 4)
    .map(opt => typeof opt === 'string' ? opt.substring(0, 150) : 'Invalid option')
    .filter(opt => opt.length > 3);

  // Add default option if needed for CFP
  if (certification === 'CFP' && validated.length === 3) {
    validated.push('D) Not applicable');
  }
  return validated;
};

const validateCorrectAnswer = (correct) => {
  const firstChar = String(correct).toUpperCase()[0];
  return ['A','B','C','D'].includes(firstChar) ? firstChar : 'A';
};

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => 
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`)
);