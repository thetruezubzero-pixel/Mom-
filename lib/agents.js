const { applyLens } = require('./lenses');

function primaryAgent(text, lensName) {
  const framed = applyLens(lensName, text);
  return {
    agent: 'primary',
    lens: lensName,
    text: framed,
  };
}

function twinAgent(text, lensName) {
  const framed = applyLens(lensName, text);
  const reversed = framed.split('').reverse().join('');
  return {
    agent: 'twin',
    lens: lensName,
    text: `${framed}\n  [twin counter-read: consider the inverse — ${reversed.slice(0, 60)}${reversed.length > 60 ? '...' : ''}]`,
  };
}

function respond(text, lensName) {
  return [primaryAgent(text, lensName), twinAgent(text, lensName)];
}

module.exports = { primaryAgent, twinAgent, respond };
