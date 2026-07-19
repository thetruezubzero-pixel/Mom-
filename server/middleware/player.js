const crypto = require('crypto');

function parseCookies(header) {
  const jar = {};
  if (!header) return jar;
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    jar[key] = decodeURIComponent(value);
  }
  return jar;
}

function player(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  let playerId = cookies.playerId;

  if (!playerId) {
    playerId = crypto.randomUUID();
    res.setHeader('Set-Cookie', `playerId=${playerId}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }

  req.playerId = playerId;
  next();
}

module.exports = player;
