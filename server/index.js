const path = require('path');
const express = require('express');

const logger = require('./middleware/logger');
const player = require('./middleware/player');
const { addScore, topScores } = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(logger);
app.use(player);
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/leaderboard', (req, res) => {
  res.json({ scores: topScores() });
});

app.post('/api/score', (req, res) => {
  const { name, score } = req.body || {};

  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    return res.status(400).json({ error: 'score must be a non-negative number' });
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }

  const entry = addScore(req.playerId, name.trim(), Math.floor(score));
  res.status(201).json({ entry, scores: topScores() });
});

app.listen(PORT, () => {
  console.log(`signal-catcher listening on http://localhost:${PORT}`);
});
