import * as THREE from '/vendor/three.module.js';

// ---------------------------------------------------------------------------
// Real planetary data (AU, km, degC, moon count, orbital period in days).
// Distances use a sqrt scale and sizes are hand-tuned for legibility, but the
// underlying numbers and Kepler's third law (T ∝ a^1.5) driving orbital
// speed are the genuine values.
// ---------------------------------------------------------------------------
const AU_UNIT = 150;
const MERCURY_PERIOD_DAYS = 88;
const MERCURY_AU = 0.39;
const MERCURY_SCENE_PERIOD_S = 42; // gameplay pacing anchor

const PLANETS = [
  { name: 'Mercury', au: 0.39, diameterKm: 4879, tempC: 167, moons: 0, periodDays: 88, rotHours: 1408, color: 0x9c8a7a, gameRadius: 3.0 },
  { name: 'Venus', au: 0.72, diameterKm: 12104, tempC: 464, moons: 0, periodDays: 225, rotHours: -5832, color: 0xd9c27a, gameRadius: 5.0 },
  { name: 'Earth', au: 1.00, diameterKm: 12742, tempC: 15, moons: 1, periodDays: 365, rotHours: 24, color: 0x3d7fd6, gameRadius: 5.2 },
  { name: 'Mars', au: 1.52, diameterKm: 6779, tempC: -63, moons: 2, periodDays: 687, rotHours: 24.6, color: 0xc1553a, gameRadius: 4.0 },
  { name: 'Jupiter', au: 5.20, diameterKm: 139820, tempC: -110, moons: 95, periodDays: 4333, rotHours: 9.9, color: 0xc9a074, gameRadius: 14.0 },
  { name: 'Saturn', au: 9.58, diameterKm: 116460, tempC: -178, moons: 146, periodDays: 10759, rotHours: 10.7, color: 0xd8c48a, gameRadius: 12.0, rings: true },
  { name: 'Uranus', au: 19.20, diameterKm: 50724, tempC: -195, moons: 27, periodDays: 30687, rotHours: -17.2, color: 0x8fd4d0, gameRadius: 8.0 },
  { name: 'Neptune', au: 30.05, diameterKm: 49244, tempC: -201, moons: 14, periodDays: 60190, rotHours: 16.1, color: 0x4361c9, gameRadius: 7.8 },
];

const SUN_RADIUS = 26;
const SCAN_TIME = 1.2;
const MISSION_SECONDS = 300;
const ASTEROID_HIT_DAMAGE = 15;
const ASTEROID_INVULN_S = 1.2;

function sceneDistance(au) {
  return AU_UNIT * Math.sqrt(au);
}

function orbitalAngularSpeed(au) {
  // T ∝ a^1.5 (Kepler's third law) anchored to Mercury's gameplay period.
  const ratio = Math.pow(MERCURY_AU / au, 1.5);
  const periodS = MERCURY_SCENE_PERIOD_S / ratio;
  return (Math.PI * 2) / periodS;
}

// ---------------------------------------------------------------------------
// Renderer / scene setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 20000);

const startAU = 0.15;
camera.position.set(sceneDistance(startAU), 6, 0);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x404050, 0.35));
const sunLight = new THREE.PointLight(0xfff2d0, 3.2, 0, 0.55);
scene.add(sunLight);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// Starfield
// ---------------------------------------------------------------------------
function buildStarfield() {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 2500 + Math.random() * 3500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, opacity: 0.85, transparent: true });
  scene.add(new THREE.Points(geo, mat));
}
buildStarfield();

// ---------------------------------------------------------------------------
// Procedural planet + sun textures (no external image assets required)
// ---------------------------------------------------------------------------
function noiseTexture(baseColor, { bands = 0, spots = 40, roughness = 24 } = {}) {
  const size = 256;
  const cnv = document.createElement('canvas');
  cnv.width = size; cnv.height = size / 2;
  const ctx = cnv.getContext('2d');
  const base = new THREE.Color(baseColor);

  ctx.fillStyle = `rgb(${base.r * 255}, ${base.g * 255}, ${base.b * 255})`;
  ctx.fillRect(0, 0, cnv.width, cnv.height);

  if (bands > 0) {
    for (let i = 0; i < bands; i++) {
      const y = (i / bands) * cnv.height + (Math.random() - 0.5) * 8;
      const h = cnv.height / bands * (0.5 + Math.random() * 0.7);
      const shade = 1 + (Math.random() - 0.5) * 0.5;
      ctx.fillStyle = `rgba(${base.r * 255 * shade}, ${base.g * 255 * shade}, ${base.b * 255 * shade}, 0.5)`;
      ctx.fillRect(0, y, cnv.width, h);
    }
  }

  for (let i = 0; i < spots; i++) {
    const x = Math.random() * cnv.width;
    const y = Math.random() * cnv.height;
    const r = 4 + Math.random() * roughness;
    const shade = 1 + (Math.random() - 0.5) * 0.6;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${base.r * 255 * shade}, ${base.g * 255 * shade}, ${base.b * 255 * shade}, 0.5)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function sunTexture() {
  const size = 256;
  const cnv = document.createElement('canvas');
  cnv.width = size; cnv.height = size / 2;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#ffdf7a';
  ctx.fillRect(0, 0, cnv.width, cnv.height);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * cnv.width;
    const y = Math.random() * cnv.height;
    const r = 6 + Math.random() * 20;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,150,40,0.55)');
    grad.addColorStop(1, 'rgba(255,150,40,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(cnv);
}

function glowSprite(color, scale) {
  const size = 256;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = size;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c = new THREE.Color(color);
  grad.addColorStop(0, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 0.9)`);
  grad.addColorStop(0.4, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 0.35)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cnv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

// ---------------------------------------------------------------------------
// Sun
// ---------------------------------------------------------------------------
const sunMesh = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_RADIUS, 48, 32),
  new THREE.MeshBasicMaterial({ map: sunTexture() }),
);
scene.add(sunMesh);
scene.add(glowSprite(0xffcc66, SUN_RADIUS * 6));

// ---------------------------------------------------------------------------
// Planets
// ---------------------------------------------------------------------------
const bodies = PLANETS.map((p) => {
  const orbitRadius = sceneDistance(p.au);
  const angularSpeed = orbitalAngularSpeed(p.au);
  const angle = Math.random() * Math.PI * 2;

  const pivot = new THREE.Object3D();
  scene.add(pivot);

  const bands = p.name === 'Jupiter' || p.name === 'Saturn' ? 10 : 0;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(p.gameRadius, 40, 28),
    new THREE.MeshStandardMaterial({ map: noiseTexture(p.color, { bands, spots: bands ? 60 : 45 }), roughness: 0.9, metalness: 0.05 }),
  );
  mesh.position.set(orbitRadius, 0, 0);
  mesh.rotation.z = p.name === 'Uranus' ? Math.PI * 0.55 : 0.1;
  pivot.add(mesh);
  pivot.rotation.y = angle;

  if (p.rings) {
    const ringGeo = new THREE.RingGeometry(p.gameRadius * 1.4, p.gameRadius * 2.3, 64);
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xcbb98f, side: THREE.DoubleSide, transparent: true, opacity: 0.55 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.4;
    mesh.add(ring);
  }

  // Orbit path line
  const curvePts = [];
  for (let i = 0; i <= 128; i++) {
    const t = (i / 128) * Math.PI * 2;
    curvePts.push(new THREE.Vector3(Math.cos(t) * orbitRadius, 0, Math.sin(t) * orbitRadius));
  }
  const orbitLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(curvePts),
    new THREE.LineBasicMaterial({ color: 0x2a4a48, transparent: true, opacity: 0.35 }),
  );
  scene.add(orbitLine);

  const tangentialSpeed = angularSpeed * orbitRadius;
  const scanRange = Math.max(p.gameRadius * 3, tangentialSpeed * SCAN_TIME * 1.5);

  return {
    ...p,
    orbitRadius,
    angularSpeed,
    scanRange,
    pivot,
    mesh,
    scanned: false,
    scanProgress: 0,
  };
});

// ---------------------------------------------------------------------------
// Asteroid belt (between Mars and Jupiter)
// ---------------------------------------------------------------------------
const beltInner = sceneDistance(1.52) + 25;
const beltOuter = sceneDistance(5.20) - 30;
const ASTEROID_COUNT = 420;
const asteroidMesh = new THREE.InstancedMesh(
  new THREE.DodecahedronGeometry(1, 0),
  new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 1 }),
  ASTEROID_COUNT,
);
const asteroidData = [];
{
  const dummy = new THREE.Object3D();
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const r = beltInner + Math.random() * (beltOuter - beltInner);
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 18;
    const scale = 0.6 + Math.random() * 2.2;
    const pos = new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
    dummy.position.copy(pos);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    asteroidMesh.setMatrixAt(i, dummy.matrix);
    asteroidData.push({ r, theta, y, scale, speed: 0.01 + Math.random() * 0.01 });
  }
}
scene.add(asteroidMesh);

// ---------------------------------------------------------------------------
// Flight controls
// ---------------------------------------------------------------------------
const input = { forward: 0, boost: false, brake: false, strafe: 0 };
let yaw = -Math.PI / 2;
let pitch = -0.05;
const velocity = new THREE.Vector3();
const MAX_SPEED = 90;
const BOOST_MULT = 2.6;
const ACCEL = 55;
const DRAG = 0.6;
const MOUSE_SENS = 0.0024;
const TOUCH_SENS = 0.0032;

let pointerLocked = false;
canvas.addEventListener('click', () => {
  if (!gameRunning) return;
  if (!motionEnabled) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  yaw -= e.movementX * MOUSE_SENS;
  pitch -= e.movementY * MOUSE_SENS;
  pitch = Math.max(-1.5, Math.min(1.5, pitch));
});

const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function readKeyboard() {
  input.forward = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  input.strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  input.boost = keys.has('shift');
  input.brake = keys.has(' ');
}

// Touch look
const touchLook = document.getElementById('touchLook');
let touchId = null;
let lastTouch = { x: 0, y: 0 };
touchLook.addEventListener('touchstart', (e) => {
  const t = e.changedTouches[0];
  touchId = t.identifier;
  lastTouch = { x: t.clientX, y: t.clientY };
}, { passive: true });
touchLook.addEventListener('touchmove', (e) => {
  if (motionEnabled) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== touchId) continue;
    const dx = t.clientX - lastTouch.x;
    const dy = t.clientY - lastTouch.y;
    lastTouch = { x: t.clientX, y: t.clientY };
    yaw -= dx * TOUCH_SENS;
    pitch -= dy * TOUCH_SENS;
    pitch = Math.max(-1.5, Math.min(1.5, pitch));
  }
}, { passive: true });
touchLook.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) if (t.identifier === touchId) touchId = null;
});

const thrustBtn = document.getElementById('thrustBtn');
const boostBtn = document.getElementById('boostBtn');
let touchThrust = 0;
let touchBoost = false;
const holdEvents = (el, onDown, onUp) => {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
  el.addEventListener('touchend', onUp);
  el.addEventListener('touchcancel', onUp);
  el.addEventListener('mousedown', onDown);
  el.addEventListener('mouseup', onUp);
};
holdEvents(thrustBtn, () => { touchThrust = 1; }, () => { touchThrust = 0; });
holdEvents(boostBtn, () => { touchBoost = true; }, () => { touchBoost = false; });

// Gyroscope / motion look
let motionEnabled = false;
let motionRef = null;
let liveOrientation = { alpha: 0, beta: 0, gamma: 0 };
const motionToggle = document.getElementById('motionToggle');

function handleOrientation(e) {
  if (e.alpha === null) return;
  liveOrientation = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
  if (!motionEnabled) return;
  if (!motionRef) motionRef = { ...liveOrientation };
  let dAlpha = e.alpha - motionRef.alpha;
  if (dAlpha > 180) dAlpha -= 360;
  if (dAlpha < -180) dAlpha += 360;
  const dBeta = e.beta - motionRef.beta;
  yaw = Math.PI / 2 - THREE.MathUtils.degToRad(dAlpha);
  pitch = THREE.MathUtils.degToRad(dBeta) * -1;
  pitch = Math.max(-1.5, Math.min(1.5, pitch));
}

async function enableMotion() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') return;
    } catch { return; }
  }
  motionEnabled = true;
  motionRef = null;
  motionToggle.textContent = 'motion look: on';
  motionToggle.classList.add('active');
  addEventListener('deviceorientation', handleOrientation);
}

motionToggle.addEventListener('click', () => {
  if (motionEnabled) {
    motionEnabled = false;
    motionToggle.textContent = 'enable motion look';
    motionToggle.classList.remove('active');
  } else {
    enableMotion();
  }
});

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
let gameRunning = false;
let hull = 100;
let score = 0;
let timeLeft = MISSION_SECONDS;
let asteroidCooldown = 0;
let scannedCount = 0;

const overlay = document.getElementById('overlay');
const flashEl = document.getElementById('flash');
const missionListEl = document.getElementById('missionList');
const reticleProgress = document.getElementById('reticleProgress');
const reticleLabel = document.getElementById('reticleLabel');

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.max(0, Math.floor(s % 60));
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function renderMissionList() {
  missionListEl.innerHTML = bodies.map((b) => `
    <div class="m-row ${b.scanned ? 'done' : ''}">
      <span class="m-name">${b.name}</span>
      <span>${b.scanned ? 'SCANNED' : Math.round(b.au * 10 + 50) + ' pts'}</span>
    </div>
  `).join('');
}
renderMissionList();

function flash(msg) {
  flashEl.textContent = msg;
  flashEl.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => flashEl.classList.remove('show'), 1600);
}

function resetGame() {
  hull = 100;
  score = 0;
  timeLeft = MISSION_SECONDS;
  scannedCount = 0;
  velocity.set(0, 0, 0);
  yaw = -Math.PI / 2;
  pitch = -0.05;
  camera.position.set(sceneDistance(startAU), 6, 0);
  for (const b of bodies) { b.scanned = false; b.scanProgress = 0; }
  renderMissionList();
  document.getElementById('hullValue').textContent = '100';
  document.getElementById('hullBar').style.width = '100%';
  document.getElementById('hullBar').style.background = '';
  document.getElementById('scoreValue').textContent = '0';
}

function startMission() {
  resetGame();
  overlay.classList.add('hidden');
  gameRunning = true;
}

function endMission(reason) {
  gameRunning = false;
  document.exitPointerLock?.();
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <h1>${reason}</h1>
    <div class="summary">
      <div><b id="sumScore">${score}</b>score</div>
      <div><b>${scannedCount}/${bodies.length}</b>planets scanned</div>
      <div><b>${fmtTime(MISSION_SECONDS - timeLeft)}</b>elapsed</div>
    </div>
    <div class="name-entry">
      <input id="name" maxlength="16" placeholder="your name" autocomplete="off" />
      <button id="submit">Save</button>
    </div>
    <p id="submit-error" class="error hidden"></p>
    <div id="board"></div>
    <button id="start" class="primary">Fly Again</button>
  `;
  document.getElementById('submit').addEventListener('click', submitScore);
  document.getElementById('name').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitScore(); });
  document.getElementById('start').addEventListener('click', startMission);
  renderLeaderboard();
}

async function submitScore() {
  const nameInput = document.getElementById('name');
  const submitBtn = document.getElementById('submit');
  const errorEl = document.getElementById('submit-error');
  const name = (nameInput.value || 'anon').trim() || 'anon';
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `request failed (${res.status})`);
    }
    nameInput.disabled = true;
    await renderLeaderboard();
  } catch (err) {
    submitBtn.disabled = false;
    errorEl.textContent = `Couldn't save score: ${err.message}. Try again.`;
    errorEl.classList.remove('hidden');
  }
}

async function renderLeaderboard() {
  const target = document.getElementById('board');
  if (!target) return;
  try {
    const res = await fetch('/api/leaderboard');
    const { scores } = await res.json();
    target.innerHTML = scores.slice(0, 8)
      .map((s, i) => `<div class="row"><span>${i + 1}. ${escapeHTML(s.name)}</span><b>${s.score}</b></div>`)
      .join('') || '<div class="row"><span>no scores yet</span></div>';
  } catch {
    target.innerHTML = '<div class="row"><span>leaderboard unavailable</span></div>';
  }
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.getElementById('start').addEventListener('click', startMission);
renderLeaderboard();

// ---------------------------------------------------------------------------
// HUD helpers
// ---------------------------------------------------------------------------
const gyroCtx = document.getElementById('gyroRadar').getContext('2d');
function drawGyroRadar(p, r) {
  gyroCtx.clearRect(0, 0, 120, 120);
  gyroCtx.strokeStyle = 'rgba(95,214,200,0.4)';
  gyroCtx.beginPath(); gyroCtx.arc(60, 60, 50, 0, Math.PI * 2); gyroCtx.stroke();
  gyroCtx.beginPath(); gyroCtx.arc(60, 60, 25, 0, Math.PI * 2); gyroCtx.stroke();
  gyroCtx.beginPath(); gyroCtx.moveTo(10, 60); gyroCtx.lineTo(110, 60); gyroCtx.moveTo(60, 10); gyroCtx.lineTo(60, 110); gyroCtx.stroke();
  const x = 60 + Math.max(-1, Math.min(1, r / 90)) * 48;
  const y = 60 + Math.max(-1, Math.min(1, p / 90)) * 48;
  gyroCtx.fillStyle = '#5fd6c8';
  gyroCtx.beginPath(); gyroCtx.arc(x, y, 5, 0, Math.PI * 2); gyroCtx.fill();
}

let lastHudUpdate = 0;
function updateHud(now, dt) {
  document.getElementById('clock').textContent = new Date().toISOString().slice(11, 19);

  const pitchDeg = THREE.MathUtils.radToDeg(pitch);
  const yawDeg = THREE.MathUtils.radToDeg(yaw);
  const rollDeg = motionEnabled ? (liveOrientation.gamma || 0) : 0;
  document.getElementById('pitchVal').textContent = pitchDeg.toFixed(1) + '°';
  document.getElementById('rollVal').textContent = rollDeg.toFixed(1) + '°';
  document.getElementById('yawVal').textContent = ((yawDeg + 360) % 360).toFixed(1) + '°';
  document.getElementById('speedVal').textContent = velocity.length().toFixed(0) + ' u/s';
  drawGyroRadar(pitchDeg, rollDeg);

  document.getElementById('hullValue').textContent = Math.round(hull);
  const hullBar = document.getElementById('hullBar');
  hullBar.style.width = `${Math.max(0, hull)}%`;
  hullBar.style.background = hull > 50 ? '' : hull > 20 ? '#e0b04a' : '#d65f6f';
  document.getElementById('scoreValue').textContent = score;
  document.getElementById('timerValue').textContent = fmtTime(timeLeft);

  // nearest planet
  let nearest = null, nearestDist = Infinity;
  for (const b of bodies) {
    const worldPos = new THREE.Vector3();
    b.mesh.getWorldPosition(worldPos);
    const d = camera.position.distanceTo(worldPos);
    if (d < nearestDist) { nearestDist = d; nearest = b; }
  }
  if (nearest) {
    document.getElementById('tName').textContent = nearest.name;
    document.getElementById('tAU').textContent = nearest.au.toFixed(2);
    document.getElementById('tDiam').textContent = nearest.diameterKm.toLocaleString();
    document.getElementById('tTemp').textContent = `${nearest.tempC}°C`;
    document.getElementById('tMoons').textContent = nearest.moons;
    document.getElementById('tPeriod').textContent = nearest.periodDays >= 1000
      ? (nearest.periodDays / 365).toFixed(1) + ' yr'
      : nearest.periodDays + ' d';
    const surfaceDist = Math.max(0, nearestDist - nearest.gameRadius);
    const kmPerUnit = nearest.diameterKm / (nearest.gameRadius * 2);
    document.getElementById('tRange').textContent = `${Math.round(surfaceDist * kmPerUnit).toLocaleString()} km`;
    document.getElementById('tStatus').textContent = nearest.scanned ? 'SCANNED' : 'PENDING';
  }

  // scan reticle
  const scanRange = nearest ? nearest.scanRange : 0;
  if (nearest && !nearest.scanned && nearestDist < scanRange) {
    nearest.scanProgress += dt;
    const frac = Math.min(1, nearest.scanProgress / SCAN_TIME);
    reticleProgress.style.strokeDashoffset = String(289 * (1 - frac));
    reticleLabel.textContent = `SCANNING ${nearest.name}…`;
    if (nearest.scanProgress >= SCAN_TIME) {
      nearest.scanned = true;
      scannedCount++;
      const pts = Math.round(nearest.au * 10 + 50);
      score += pts;
      flash(`${nearest.name.toUpperCase()} SCANNED +${pts}`);
      renderMissionList();
      if (scannedCount === bodies.length) {
        score += Math.round(timeLeft * 2);
        endMission('ALL SCANS COMPLETE');
      }
    }
  } else {
    reticleProgress.style.strokeDashoffset = '289';
    reticleLabel.textContent = nearest && nearest.scanned ? `${nearest.name} already scanned` : '';
    if (nearest) nearest.scanProgress = Math.max(0, nearest.scanProgress - dt * 2);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  for (const b of bodies) {
    b.pivot.rotation.y += b.angularSpeed * dt;
    b.mesh.rotation.y += (Math.PI * 2) / Math.max(2, Math.abs(b.rotHours) / 3) * dt * Math.sign(b.rotHours || 1);
  }
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const a = asteroidData[i];
    a.theta += a.speed * dt * 0.05;
  }
  updateAsteroidMatrices();

  if (gameRunning) {
    readKeyboard();
    const dir = input.forward !== 0 ? Math.sign(input.forward) : (touchThrust ? 1 : 0);
    const boosting = input.boost || touchBoost;

    const camQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
    camera.quaternion.copy(camQuat);

    const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camQuat);

    if (dir !== 0) velocity.addScaledVector(forwardVec, ACCEL * dir * (boosting ? BOOST_MULT : 1) * dt);
    if (input.strafe) velocity.addScaledVector(rightVec, ACCEL * dt * input.strafe);

    if (input.brake) velocity.multiplyScalar(Math.max(0, 1 - 3 * dt));

    const maxSpd = MAX_SPEED * (boosting ? BOOST_MULT : 1);
    if (velocity.length() > maxSpd) velocity.setLength(maxSpd);
    velocity.multiplyScalar(Math.max(0, 1 - DRAG * dt));

    camera.position.addScaledVector(velocity, dt);

    // Keep a sane distance from the sun's core — slide tangentially rather
    // than killing all momentum, so the ship glides past instead of sticking.
    const distFromSun = camera.position.length();
    if (distFromSun < SUN_RADIUS + 4) {
      const normal = distFromSun > 0.001
        ? camera.position.clone().normalize()
        : new THREE.Vector3(1, 0, 0);
      camera.position.copy(normal.clone().multiplyScalar(SUN_RADIUS + 4));
      const radialSpeed = velocity.dot(normal);
      if (radialSpeed < 0) velocity.addScaledVector(normal, -radialSpeed);
    }

    // Asteroid collisions
    asteroidCooldown = Math.max(0, asteroidCooldown - dt);
    if (asteroidCooldown <= 0) {
      for (const a of asteroidData) {
        const ax = Math.cos(a.theta) * a.r;
        const az = Math.sin(a.theta) * a.r;
        const dx = camera.position.x - ax;
        const dy = camera.position.y - a.y;
        const dz = camera.position.z - az;
        const distSq = dx * dx + dy * dy + dz * dz;
        const hitDist = 3 + a.scale;
        if (distSq < hitDist * hitDist) {
          hull -= ASTEROID_HIT_DAMAGE;
          asteroidCooldown = ASTEROID_INVULN_S;
          flash('HULL DAMAGE — ASTEROID IMPACT');
          if (hull <= 0) { hull = 0; endMission('HULL BREACH — MISSION FAILED'); }
          break;
        }
      }
    }

    timeLeft -= dt;
    if (timeLeft <= 0) { timeLeft = 0; endMission('MISSION TIME EXPIRED'); }

    updateHud(ts, dt);
  }

  renderer.render(scene, camera);
}

function updateAsteroidMatrices() {
  const dummy = new THREE.Object3D();
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const a = asteroidData[i];
    dummy.position.set(Math.cos(a.theta) * a.r, a.y, Math.sin(a.theta) * a.r);
    dummy.rotation.set(a.theta, a.theta * 0.6, 0);
    dummy.scale.setScalar(a.scale);
    dummy.updateMatrix();
    asteroidMesh.setMatrixAt(i, dummy.matrix);
  }
  asteroidMesh.instanceMatrix.needsUpdate = true;
}

requestAnimationFrame(frame);
