require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { perplexity } = require('@ai-sdk/perplexity');
const { generateText } = require('ai');
const jsonrepair = require('jsonrepair'); // Added JSON repair

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
    // Validate input
    const { certification } = req.body;
    if (!certification || typeof certification !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request: certification parameter required' 
      });
    }

    // Construct prompt with stricter validation
    const prompt = `Generate 5 multiple-choice questions for ${certification} exam.
    STRICTLY FOLLOW:
    1. Valid JSON with double quotes
    2. No markdown or extra text
    3. Exactly 4 options per question
    4. Correct answer as A/B/C/D
    5. Escape special characters with \\
    
    {
      "questions": [
        {
          "text": "Question text",
          "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
          "correct": "A",
          "explanation": "Brief explanation"
        }
      ]
    }`;

    // Generate questions with Perplexity
    const result = await generateText({
      model: perplexity('sonar-medium-chat'),
      prompt: prompt,
      apiKey: process.env.PERPLEXITY_API_KEY,
      maxTokens: 1200,
      temperature: 0.7
    });

    // Validate response exists
    if (!result?.text) {
      console.error('Perplexity API Error:', result);
      throw new Error('AI model failed to generate questions');
    }

    // Parse and validate response with JSON repair
    let quizData;
    try {
      const repairedJson = jsonrepair(result.text); // Repair JSON first
      quizData = JSON.parse(repairedJson);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      console.error('Repaired JSON:', jsonrepair(result.text));
      return res.status(500).json({ 
        error: 'AI response format issue',
        diagnostic: process.env.NODE_ENV === 'development' 
          ? result.text.substring(0, 200) + '...' 
          : undefined
      });
    }

    // Enhanced validation
    if (!Array.isArray(quizData?.questions)) {
      throw new Error('Invalid question format from AI');
    }

    // Strict question validation
    const validatedQuestions = quizData.questions
      .map((q, index) => {
        const base = {
          text: sanitizeText(q.text, `Question ${index + 1}`),
          options: validateOptions(q.options),
          correct: validateCorrectAnswer(q.correct),
          explanation: sanitizeText(q.explanation, '')
        };
        
        // Additional validation
        if (base.options.length !== 4 || !base.text.includes('?')) {
          return null;
        }
        return base;
      })
      .filter(Boolean); // Remove invalid questions

    if (validatedQuestions.length < 3) {
      throw new Error(`Only ${validatedQuestions.length} valid questions generated`);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.json({ questions: validatedQuestions.slice(0, 5) });

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
  if (typeof text !== 'string' || text.length < 10) return fallback;
  return text.substring(0, 200).trim();
};

const validateOptions = (options) => {
  if (!Array.isArray(options)) return [];
  return options
    .slice(0, 4)
    .map(opt => typeof opt === 'string' ? opt.substring(0, 150) : 'Invalid option')
    .filter(opt => opt.length > 3); // Remove empty options
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