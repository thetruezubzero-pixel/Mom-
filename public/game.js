(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const timeEl = document.getElementById('time');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start');
  const board = document.getElementById('board');

  const W = canvas.width;
  const H = canvas.height;
  const ROUND_SECONDS = 60;

  const paddle = { w: 70, h: 10, x: (W - 70) / 2, y: H - 30 };
  let drops = [];
  let score = 0;
  let timeLeft = ROUND_SECONDS;
  let running = false;
  let lastSpawn = 0;
  let lastTick = 0;
  let rafId = null;

  function resetState() {
    drops = [];
    score = 0;
    timeLeft = ROUND_SECONDS;
    paddle.x = (W - paddle.w) / 2;
    scoreEl.textContent = '0';
    timeEl.textContent = String(ROUND_SECONDS);
  }

  function spawnDrop() {
    const isNoise = Math.random() < 0.28;
    drops.push({
      x: Math.random() * (W - 16) + 8,
      y: -10,
      r: 8,
      speed: 90 + Math.random() * 90 + (ROUND_SECONDS - timeLeft) * 1.2,
      noise: isNoise,
    });
  }

  function movePaddleTo(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    paddle.x = Math.min(W - paddle.w, Math.max(0, x - paddle.w / 2));
  }

  canvas.addEventListener('pointerdown', (e) => movePaddleTo(e.clientX));
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons === 1 || e.pointerType === 'touch') movePaddleTo(e.clientX);
  });

  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.key));
  window.addEventListener('keyup', (e) => keys.delete(e.key));

  function update(dt) {
    if (keys.has('ArrowLeft')) paddle.x = Math.max(0, paddle.x - 260 * dt);
    if (keys.has('ArrowRight')) paddle.x = Math.min(W - paddle.w, paddle.x + 260 * dt);

    lastSpawn += dt;
    const spawnEvery = Math.max(0.35, 0.9 - (ROUND_SECONDS - timeLeft) * 0.01);
    if (lastSpawn > spawnEvery) {
      lastSpawn = 0;
      spawnDrop();
    }

    for (const drop of drops) {
      drop.y += drop.speed * dt;
    }

    const paddleTop = paddle.y;
    drops = drops.filter((drop) => {
      const caught =
        drop.y + drop.r >= paddleTop &&
        drop.y - drop.r <= paddle.y + paddle.h &&
        drop.x >= paddle.x - drop.r &&
        drop.x <= paddle.x + paddle.w + drop.r;

      if (caught) {
        score += drop.noise ? -5 : 10;
        score = Math.max(0, score);
        scoreEl.textContent = String(score);
        return false;
      }
      return drop.y - drop.r < H;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#e8ecec';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    for (const drop of drops) {
      ctx.beginPath();
      ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
      ctx.fillStyle = drop.noise ? '#d65f6f' : '#5fd6c8';
      ctx.fill();
    }
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTick) lastTick = ts;
    const dt = Math.min(0.05, (ts - lastTick) / 1000);
    lastTick = ts;

    update(dt);
    draw();

    rafId = requestAnimationFrame(loop);
  }

  let tickInterval = null;

  function startRound() {
    resetState();
    overlay.classList.add('hidden');
    running = true;
    lastTick = 0;
    rafId = requestAnimationFrame(loop);

    tickInterval = setInterval(() => {
      timeLeft -= 1;
      timeEl.textContent = String(Math.max(0, timeLeft));
      if (timeLeft <= 0) endRound();
    }, 1000);
  }

  async function endRound() {
    running = false;
    cancelAnimationFrame(rafId);
    clearInterval(tickInterval);

    overlay.classList.remove('hidden');
    overlay.innerHTML = `
      <h1>signal caught</h1>
      <p>Final score: <b>${score}</b></p>
      <div class="name-entry">
        <input id="name" maxlength="16" placeholder="your name" autocomplete="off" />
        <button id="submit">Submit</button>
      </div>
      <div id="board"></div>
    `;

    document.getElementById('submit').addEventListener('click', submitScore);
    document.getElementById('name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitScore();
    });

    await renderLeaderboard();
  }

  async function submitScore() {
    const nameInput = document.getElementById('name');
    const name = (nameInput.value || 'anon').trim() || 'anon';

    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });

    if (res.ok) {
      nameInput.disabled = true;
      document.getElementById('submit').disabled = true;
      await renderLeaderboard();
    }
  }

  async function renderLeaderboard() {
    const target = document.getElementById('board');
    if (!target) return;
    try {
      const res = await fetch('/api/leaderboard');
      const { scores } = await res.json();
      target.innerHTML = scores
        .slice(0, 8)
        .map((s, i) => `<div class="row"><span>${i + 1}. ${escapeHTML(s.name)}</span><b>${s.score}</b></div>`)
        .join('') || '<div class="row"><span>no scores yet</span></div>';
    } catch {
      target.innerHTML = '<div class="row"><span>leaderboard unavailable</span></div>';
    }
  }

  function escapeHTML(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  startBtn.addEventListener('click', startRound);
  renderLeaderboard();
})();
