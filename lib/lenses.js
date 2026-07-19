function literalLens(text) {
  return text.trim();
}

function patternLens(text) {
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);

  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  const repeated = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => `${word} (${count}x)`);

  if (repeated.length === 0) {
    return `${text.trim()}\n  [no repeated terms detected]`;
  }
  return `${text.trim()}\n  [repeated terms: ${repeated.join(', ')}]`;
}

function metaphorLens(text) {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return `Treat "${trimmed}" as a landscape: what is the terrain, what is the weather, and what is the traveler looking for?`;
}

const lenses = {
  literal: literalLens,
  pattern: patternLens,
  metaphor: metaphorLens,
};

function listLenses() {
  return Object.keys(lenses);
}

function applyLens(name, text) {
  const lens = lenses[name];
  if (!lens) {
    throw new Error(`Unknown lens: ${name}. Available: ${listLenses().join(', ')}`);
  }
  return lens(text);
}

module.exports = { lenses, listLenses, applyLens };
