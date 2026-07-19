const scores = [];

function addScore(playerId, name, score) {
  const entry = { playerId, name: name.slice(0, 16), score, at: Date.now() };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  scores.length = Math.min(scores.length, 50);
  return entry;
}

function topScores(limit = 10) {
  return scores.slice(0, limit);
}

module.exports = { addScore, topScores };
