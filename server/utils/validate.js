const VALID_DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const VALID_FORMATS = ['form', 'slide'];

function validateGenerateBody(req, res, next) {
  const { topic, difficulty, type, num } = req.body;
  const errors = [];

  if (!req.file && (!topic || typeof topic !== 'string' || topic.trim().length === 0)) {
    errors.push('topic is required');
  }

  if (!difficulty || !VALID_DIFFICULTIES.includes(difficulty)) {
    errors.push('difficulty must be Easy, Medium, or Hard');
  }

  if (!type) {
    errors.push('type is required');
  } else {
    const selectedTypes = type === 'all' ? ['multiple', 'truefalse', 'dropdown'] : type.split(',');
    if (!selectedTypes.every(t => ['multiple', 'truefalse', 'dropdown'].includes(t))) {
      errors.push('type must be one or more of: multiple, truefalse, dropdown');
    }
  }

  const numVal = Number(num);
  if (num === undefined || num === null || !Number.isInteger(numVal) || numVal < 1 || numVal > 30) {
    errors.push('num must be an integer between 1 and 30');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  next();
}

function validateQuizSaveBody(req, res, next) {
  const { questions, format } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'questions must be a non-empty array' });
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q.question || !q.type || !q.options || !q.answer) {
      return res.status(400).json({
        error: `Question ${i + 1} is missing required fields (question, type, options, answer)`
      });
    }
    if (!['multiple', 'truefalse', 'dropdown'].includes(q.type)) {
      return res.status(400).json({ error: `Question ${i + 1} has invalid type: ${q.type}` });
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return res.status(400).json({ error: `Question ${i + 1} must have at least 2 options` });
    }
  }

  if (format && !VALID_FORMATS.includes(format)) {
    return res.status(400).json({ error: 'format must be "form" or "slide"' });
  }

  next();
}

module.exports = { validateGenerateBody, validateQuizSaveBody };
