import * as THREE from '/vendor/three.module.js';

// ---------------------------------------------------------------------------
// Real planetary data (AU, km, degC, moon count, orbital period in days).
// Distances use a sqrt scale and sizes are hand-tuned for legibility, but the
// underlying numbers and Kepler's third law (T ∝ a^1.5) driving orbital
// speed are the genuine values.
// ---------------------------------------------------------------------------
const AU_UNIT = 150;
const MERCURY_AU = 0.39;
// Slower than the old timed-mission pacing on purpose: free-roam means people
// linger up close (especially at Earth Ops), and inner planets moved fast
// enough at 42s that a stationary close-up camera lost the planet within a
// few seconds as it visibly orbited away. 240s keeps real relative motion
// (and Kepler's laws) intact while staying comfortable to examine up close.
const MERCURY_SCENE_PERIOD_S = 240;

// Axial tilt (deg, real obliquity) and orbital eccentricity are genuine values too.
const PLANETS = [
  { name: 'Mercury', au: 0.39, diameterKm: 4879, tempC: 167, moons: 0, periodDays: 88, rotHours: 1408, color: 0x9c8a7a, gameRadius: 3.0, tilt: 0.03, ecc: 0.206 },
  { name: 'Venus', au: 0.72, diameterKm: 12104, tempC: 464, moons: 0, periodDays: 225, rotHours: -5832, color: 0xd9c27a, gameRadius: 5.0, tilt: 177.4, ecc: 0.007 },
  { name: 'Earth', au: 1.00, diameterKm: 12742, tempC: 15, moons: 1, periodDays: 365, rotHours: 24, color: 0x3d7fd6, gameRadius: 5.2, tilt: 23.44, ecc: 0.017 },
  { name: 'Mars', au: 1.52, diameterKm: 6779, tempC: -63, moons: 2, periodDays: 687, rotHours: 24.6, color: 0xc1553a, gameRadius: 4.0, tilt: 25.19, ecc: 0.093 },
  { name: 'Jupiter', au: 5.20, diameterKm: 139820, tempC: -110, moons: 95, periodDays: 4333, rotHours: 9.9, color: 0xc9a074, gameRadius: 14.0, tilt: 3.13, ecc: 0.048 },
  { name: 'Saturn', au: 9.58, diameterKm: 116460, tempC: -178, moons: 146, periodDays: 10759, rotHours: 10.7, color: 0xd8c48a, gameRadius: 12.0, rings: true, tilt: 26.73, ecc: 0.056 },
  { name: 'Uranus', au: 19.20, diameterKm: 50724, tempC: -195, moons: 27, periodDays: 30687, rotHours: -17.2, color: 0x8fd4d0, gameRadius: 8.0, tilt: 97.77, ecc: 0.046 },
  { name: 'Neptune', au: 30.05, diameterKm: 49244, tempC: -201, moons: 14, periodDays: 60190, rotHours: 16.1, color: 0x4361c9, gameRadius: 7.8, tilt: 28.32, ecc: 0.010 },
];

// A handful of the real Solar System's biggest moons (real color/relative size/period),
// rendered orbiting their parent planet so the sky isn't just eight bare spheres.
// Negative periodDays encodes a genuine retrograde orbit (Triton really does orbit backwards).
const MOONS = {
  Earth: [{ name: 'Moon', color: 0xb8b3ab, radiusRatio: 0.27, orbitRatio: 3.4, periodDays: 27.3 }],
  Mars: [
    { name: 'Phobos', color: 0x8a7a68, radiusRatio: 0.05, orbitRatio: 1.7, periodDays: 0.32 },
    { name: 'Deimos', color: 0x9a8c78, radiusRatio: 0.035, orbitRatio: 2.4, periodDays: 1.26 },
  ],
  Jupiter: [
    { name: 'Io', color: 0xe8d27a, radiusRatio: 0.12, orbitRatio: 1.7, periodDays: 1.77 },
    { name: 'Europa', color: 0xe4e0d4, radiusRatio: 0.10, orbitRatio: 2.05, periodDays: 3.55 },
    { name: 'Ganymede', color: 0x9a8f7d, radiusRatio: 0.17, orbitRatio: 2.45, periodDays: 7.15 },
    { name: 'Callisto', color: 0x6c6357, radiusRatio: 0.15, orbitRatio: 2.9, periodDays: 16.7 },
  ],
  Saturn: [{ name: 'Titan', color: 0xd9a558, radiusRatio: 0.14, orbitRatio: 2.7, periodDays: 15.9 }],
  Uranus: [{ name: 'Titania', color: 0xa8a0a0, radiusRatio: 0.10, orbitRatio: 2.1, periodDays: 8.7 }],
  Neptune: [{ name: 'Triton', color: 0xbcd8dc, radiusRatio: 0.14, orbitRatio: 2.3, periodDays: -5.9 }],
};
// Tuned so Phobos (real fastest moon, 0.32 real days) completes a game-visible orbit in ~4s;
// every other moon's relative speed still follows its own real period off that anchor.
const MOON_ANGULAR_BASE = (Math.PI * 2 / 4) * 0.32;

// The ~80 brightest naked-eye stars at their approximate real right ascension (hours) /
// declination (degrees) / apparent magnitude, so the backdrop traces real constellations
// instead of a random point cloud. Coordinates are well-known approximations, not a live
// astronomical catalog feed.
const BRIGHT_STARS = [
  ['Sirius', 6.75, -16.7, -1.46], ['Canopus', 6.4, -52.7, -0.74], ['Rigil Kentaurus', 14.66, -60.8, -0.27],
  ['Arcturus', 14.26, 19.2, -0.05], ['Vega', 18.62, 38.8, 0.03], ['Capella', 5.28, 46.0, 0.08],
  ['Rigel', 5.24, -8.2, 0.13], ['Procyon', 7.66, 5.2, 0.34], ['Achernar', 1.63, -57.2, 0.46],
  ['Betelgeuse', 5.92, 7.4, 0.5], ['Hadar', 14.06, -60.4, 0.61], ['Altair', 19.85, 8.9, 0.77],
  ['Acrux', 12.44, -63.1, 0.77], ['Aldebaran', 4.6, 16.5, 0.85], ['Spica', 13.42, -11.2, 1.04],
  ['Antares', 16.49, -26.4, 1.09], ['Pollux', 7.76, 28.0, 1.14], ['Fomalhaut', 22.96, -29.6, 1.16],
  ['Deneb', 20.69, 45.3, 1.25], ['Mimosa', 12.79, -59.7, 1.25], ['Regulus', 10.14, 12.0, 1.36],
  ['Adhara', 6.98, -29.0, 1.5], ['Castor', 7.58, 31.9, 1.58], ['Gacrux', 12.52, -57.1, 1.63],
  ['Shaula', 17.56, -37.1, 1.63], ['Bellatrix', 5.42, 6.3, 1.64], ['Elnath', 5.44, 28.6, 1.65],
  ['Miaplacidus', 9.22, -69.7, 1.67], ['Alnilam', 5.6, -1.2, 1.69], ['Alnitak', 5.68, -1.9, 1.79],
  ['Alioth', 12.9, 56.0, 1.76], ['Dubhe', 11.06, 61.75, 1.79], ['Mirfak', 3.4, 49.9, 1.79],
  ['Wezen', 7.14, -26.4, 1.83], ['Sargas', 17.62, -43.0, 1.87], ['Kaus Australis', 18.4, -34.4, 1.85],
  ['Avior', 8.38, -59.5, 1.86], ['Alkaid', 13.79, 49.3, 1.85], ['Menkalinan', 6.0, 44.9, 1.9],
  ['Atria', 16.81, -69.0, 1.91], ['Alhena', 6.63, 16.4, 1.93], ['Peacock', 20.43, -56.7, 1.94],
  ['Alsephina', 8.75, -54.7, 1.96], ['Mirzam', 6.38, -18.0, 1.98], ['Polaris', 2.53, 89.26, 1.98],
  ['Alphard', 9.46, -8.66, 1.99], ['Hamal', 2.12, 23.5, 2.0], ['Diphda', 0.73, -17.99, 2.04],
  ['Nunki', 18.92, -26.3, 2.05], ['Menkent', 14.11, -36.37, 2.06], ['Mizar', 13.4, 54.9, 2.04],
  ['Saiph', 5.8, -9.67, 2.07], ['Sadr', 20.37, 40.3, 2.23], ['Rasalhague', 17.58, 12.56, 2.08],
  ['Algol', 3.14, 40.96, 2.12], ['Almach', 2.07, 42.33, 2.1], ['Denebola', 11.82, 14.57, 2.14],
  ['Naos', 8.06, -40.0, 2.21], ['Muhlifain', 12.69, -48.96, 2.2], ['Mirach', 1.16, 35.6, 2.06],
  ['Alnair', 22.14, -46.96, 1.74], ['Kochab', 14.85, 74.16, 2.08], ['Merak', 11.03, 56.38, 2.37],
  ['Phecda', 11.9, 53.7, 2.44], ['Megrez', 12.26, 57.03, 3.31], ['Deneb Algedi', 21.78, -16.13, 2.87],
  ['Albireo', 19.51, 27.96, 3.18], ['Schedar', 0.67, 56.54, 2.24], ['Caph', 0.15, 59.15, 2.28],
  ['Tsih', 0.95, 60.72, 2.47], ['Ruchbah', 1.43, 60.24, 2.68], ['Segin', 1.9, 63.67, 3.35],
];

const SUN_RADIUS = 26;

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

scene.add(new THREE.AmbientLight(0x404050, 0.45));
// Gentle decay so outer planets still read dimmer than inner ones (real inverse-square
// falloff would leave Neptune essentially invisible at this scale) but nothing goes black.
const sunLight = new THREE.PointLight(0xfff2d0, 14, 0, 0.3);
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

function starTier(mag) {
  if (mag < 0.5) return 0;
  if (mag < 1.5) return 1;
  if (mag < 2.3) return 2;
  return 3;
}

function buildRealStars() {
  const R = 3200;
  const tierSizes = [7, 5, 3.4, 2.2];
  const warm = new Set(['Betelgeuse', 'Antares', 'Aldebaran', 'Arcturus', 'Gacrux', 'Mirach']);
  const hot = new Set(['Rigel', 'Sirius', 'Vega', 'Spica', 'Regulus', 'Bellatrix', 'Achernar', 'Altair', 'Alnitak', 'Alnilam']);

  const buckets = [[], [], [], []];
  for (const star of BRIGHT_STARS) buckets[starTier(star[3])].push(star);

  buckets.forEach((list, tier) => {
    if (!list.length) return;
    const positions = new Float32Array(list.length * 3);
    const colors = new Float32Array(list.length * 3);
    list.forEach(([name, raH, decD], i) => {
      const theta = THREE.MathUtils.degToRad(raH * 15);
      const phi = THREE.MathUtils.degToRad(90 - decD);
      positions[i * 3] = R * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = R * Math.cos(phi);
      positions[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
      const c = new THREE.Color(warm.has(name) ? 0xffb37a : hot.has(name) ? 0xbfd4ff : 0xffffff);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: tierSizes[tier], vertexColors: true, sizeAttenuation: false, transparent: true, opacity: 0.95 });
    scene.add(new THREE.Points(geo, mat));
  });
}
buildRealStars();

// ---------------------------------------------------------------------------
// Elliptical orbit math (real Kepler mechanics, not circles)
// ---------------------------------------------------------------------------
function solveEccentricAnomaly(meanAnomaly, ecc) {
  let E = meanAnomaly;
  for (let i = 0; i < 6; i++) {
    E -= (E - ecc * Math.sin(E) - meanAnomaly) / (1 - ecc * Math.cos(E));
  }
  return E;
}

// ---------------------------------------------------------------------------
// Procedural planet + sun textures (no external image assets required)
// ---------------------------------------------------------------------------
function noiseTexture(baseColor, { bands = 0, spots = 40, roughness = 24, iceCaps = false, bigSpot = null } = {}) {
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

  // A single large storm (Jupiter's Great Red Spot / Neptune's Great Dark Spot).
  if (bigSpot) {
    const x = cnv.width * 0.62, y = cnv.height * 0.62;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, cnv.height * 0.22);
    grad.addColorStop(0, bigSpot);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, cnv.height * 0.24, cnv.height * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar ice caps for rocky worlds with real ice/frost at their poles.
  if (iceCaps) {
    ctx.fillStyle = 'rgba(238,242,246,0.85)';
    ctx.fillRect(0, 0, cnv.width, cnv.height * 0.08);
    ctx.fillRect(0, cnv.height * 0.92, cnv.width, cnv.height * 0.08);
  }

  const tex = new THREE.CanvasTexture(cnv);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function earthTexture() {
  const w = 256, h = 128;
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');
  ctx.fillStyle = '#1c4d82';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * w, y = h * 0.15 + Math.random() * h * 0.7, r = 8 + Math.random() * 22;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(88,120,58,0.9)');
    grad.addColorStop(0.7, 'rgba(96,110,55,0.6)');
    grad.addColorStop(1, 'rgba(96,110,55,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,245,250,0.9)';
  ctx.fillRect(0, 0, w, h * 0.07);
  ctx.fillRect(0, h * 0.93, w, h * 0.07);
  return new THREE.CanvasTexture(cnv);
}

function earthCloudsTexture() {
  const w = 256, h = 128;
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');
  for (let i = 0; i < 45; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 6 + Math.random() * 18;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(cnv);
}

function ringTexture() {
  const w = 256, h = 32;
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0.0, 'rgba(212,197,162,0.85)');
  grad.addColorStop(0.32, 'rgba(200,185,150,0.55)');
  grad.addColorStop(0.4, 'rgba(120,110,90,0.12)');
  grad.addColorStop(0.48, 'rgba(215,200,165,0.75)');
  grad.addColorStop(0.75, 'rgba(190,175,140,0.5)');
  grad.addColorStop(1.0, 'rgba(160,148,120,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return new THREE.CanvasTexture(cnv);
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

// Real Sun data (surface temp, diameter) so the Nearest Body panel makes
// sense when you're parked at the Sun rather than reporting a planet instead.
const SUN_BODY = {
  name: 'Sun', au: 0, diameterKm: 1392700, tempC: 5505, moons: 0, periodDays: null,
  gameRadius: SUN_RADIUS, mesh: sunMesh,
};

// ---------------------------------------------------------------------------
// Planets
// ---------------------------------------------------------------------------
function planetTexture(p) {
  if (p.name === 'Earth') return earthTexture();
  if (p.name === 'Mars') return noiseTexture(p.color, { spots: 50, roughness: 14, iceCaps: true });
  if (p.name === 'Jupiter') return noiseTexture(p.color, { bands: 10, spots: 60, bigSpot: 'rgba(196,90,60,0.75)' });
  if (p.name === 'Saturn') return noiseTexture(p.color, { bands: 8, spots: 40 });
  if (p.name === 'Neptune') return noiseTexture(p.color, { spots: 30, roughness: 18, bigSpot: 'rgba(30,40,70,0.6)' });
  return noiseTexture(p.color, { spots: 45, roughness: 24 });
}

const bodies = PLANETS.map((p) => {
  const orbitRadius = sceneDistance(p.au); // semi-major axis
  const semiMinor = orbitRadius * Math.sqrt(1 - p.ecc * p.ecc);
  const angularSpeed = orbitalAngularSpeed(p.au);
  const meanAnomaly = Math.random() * Math.PI * 2;
  const argPeriapsis = Math.random() * Math.PI * 2;

  // pivot tracks the planet's current orbital position (updated per-frame below);
  // tiltGroup carries the real axial tilt; mesh spins around that tilted axis.
  const pivot = new THREE.Object3D();
  scene.add(pivot);
  const tiltGroup = new THREE.Object3D();
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(p.tilt);
  pivot.add(tiltGroup);

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(p.gameRadius, 40, 28),
    new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 0.9, metalness: 0.05 }),
  );
  tiltGroup.add(mesh);

  if (p.name === 'Earth') {
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(p.gameRadius * 1.03, 32, 24),
      new THREE.MeshStandardMaterial({ map: earthCloudsTexture(), transparent: true, opacity: 0.7, roughness: 1 }),
    );
    tiltGroup.add(clouds);
    mesh.userData.clouds = clouds;
  }

  if (p.rings) {
    const ringGeo = new THREE.RingGeometry(p.gameRadius * 1.4, p.gameRadius * 2.3, 64);
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1);
    const ringMat = new THREE.MeshBasicMaterial({ map: ringTexture(), side: THREE.DoubleSide, transparent: true });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    tiltGroup.add(ring);
  }

  // Orbit path line — a real ellipse (periapsis-oriented), not a circle.
  const curvePts = [];
  for (let i = 0; i <= 128; i++) {
    const t = (i / 128) * Math.PI * 2;
    curvePts.push(new THREE.Vector3(Math.cos(t) * orbitRadius, 0, Math.sin(t) * semiMinor));
  }
  const orbitLine = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(curvePts),
    new THREE.LineBasicMaterial({ color: 0x2a4a48, transparent: true, opacity: 0.35 }),
  );
  orbitLine.rotation.y = argPeriapsis;
  scene.add(orbitLine);

  return {
    ...p,
    orbitRadius,
    semiMinor,
    angularSpeed,
    meanAnomaly,
    argPeriapsis,
    pivot,
    tiltGroup,
    mesh,
  };
});

// ---------------------------------------------------------------------------
// Moons — orbit their planet's pivot directly, independent of the planet's
// own axial tilt/spin (a reasonable simplification for a game).
// ---------------------------------------------------------------------------
function addMoons(planetBody) {
  const list = MOONS[planetBody.name];
  if (!list) return [];
  return list.map((m) => {
    const orbitRadius = planetBody.gameRadius * m.orbitRatio;
    const gameRadius = Math.max(0.4, planetBody.gameRadius * m.radiusRatio);
    const angularSpeed = (MOON_ANGULAR_BASE / Math.abs(m.periodDays)) * Math.sign(m.periodDays);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(gameRadius, 16, 12),
      new THREE.MeshStandardMaterial({ map: noiseTexture(m.color, { spots: 18, roughness: 10 }), roughness: 1 }),
    );
    planetBody.pivot.add(mesh);
    return { name: m.name, mesh, orbitRadius, angularSpeed, angle: Math.random() * Math.PI * 2 };
  });
}
const allMoons = bodies.flatMap(addMoons);

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
// EARTH OPS — a real-world logistics/transport digital-twin layer on Earth.
//
// Honesty note: city/airport/port coordinates and satellite altitudes below
// are genuine real-world values, and satellite angular speeds are derived
// from actual Keplerian orbital mechanics for Earth (same math used for the
// planets above). Flight/shipping/logistics *traffic* is simulated motion
// along real-world corridors, not live positions — this section is built so
// each data source is an isolated adapter that can be swapped for a real
// feed. Two adapters (ISS position, live flight states) hit free, no-key
// public APIs and fall back to simulation if the request fails; the rest
// are clearly marked NEEDS KEY and simulate until one is supplied.
//
// Data-flow map (Earth Ops):
// 1) Route definitions (air/sea/land + class tags) -> weighted speed/visibility
//    profiles -> route entities in earthOpsRoutes.
// 2) UI filters (layer toggles + class selector) -> applyEarthOpsFilters() ->
//    route and satellite visibility + metrics recompute.
// 3) Live adapters (ISS + flights) -> poll handlers -> source status state
//    machine (connecting/live/stale/simulated/needs_key).
// 4) Frame loop -> weighted route animation + source-driven pacing/opacity ->
//    final render.
// ---------------------------------------------------------------------------
const earth = bodies.find((b) => b.name === 'Earth');
const EARTH_RADIUS_KM = 6371;
const EARTH_MU = 398600; // km^3/s^2, real Earth gravitational parameter
const toRad = (degrees) => THREE.MathUtils.degToRad(degrees);

function kmToGameUnits(km) {
  return (km * earth.gameRadius) / EARTH_RADIUS_KM;
}

function greatCircleDistanceKm(a, b) {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const haversineA = Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const h = THREE.MathUtils.clamp(haversineA, 0, 1);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

// Normalization cap: ~15,000 km is in the upper band of common long-haul city
// pairs (well below the absolute antipodal max), giving useful pacing spread
// without letting a few ultra-long routes dominate the whole speed scale.
const MAX_ROUTE_DISTANCE_KM = 15000;

// Per-category/class pacing calibration — pure animation tuning (how long a
// marker takes to cross a route of a given real distance), not a claim about
// real-world shipment timing. baseOpacity/markerScale are fixed cosmetic
// values per category so the three route types stay visually distinct.
const ROUTE_CATEGORY_WEIGHT = {
  air: { pace: 0.95, baseOpacity: 0.5, markerScale: 1.12 },
  sea: { pace: 1.35, baseOpacity: 0.4, markerScale: 0.92 },
  land: { pace: 1.12, baseOpacity: 0.44, markerScale: 1.0 },
};
const ROUTE_CLASS_PACE = {
  passenger: 0.92, consumer: 1.0, energy: 1.18, food: 1.06, industrial: 1.12,
};

const ROUTE_CYCLE_RANGE_SECONDS = {
  air: [18, 46], // commercial flight corridors
  sea: [42, 110], // maritime freight lanes
  land: [26, 70], // regional freight corridors
};
const ROUTE_MARKER_BASE_RADIUS = 0.18;
const SOURCE_AGE_SECOND_CUTOFF = 120;
// If a source has been "connecting" for >1.6 polling windows, treat it as
// effectively unavailable and switch to simulation until a live fix returns
// (roughly one missed poll plus 60% of the next window).
const CONNECTION_TIMEOUT_MULTIPLIER = 1.6;

function routeCycleSeconds(category, classTag, distanceKm) {
  const distT = THREE.MathUtils.clamp(distanceKm / MAX_ROUTE_DISTANCE_KM, 0, 1);
  const categoryProfile = ROUTE_CATEGORY_WEIGHT[category] || ROUTE_CATEGORY_WEIGHT.land;
  const classPace = ROUTE_CLASS_PACE[classTag] ?? ROUTE_CLASS_PACE.consumer;
  const [minS, maxS] = ROUTE_CYCLE_RANGE_SECONDS[category] || ROUTE_CYCLE_RANGE_SECONDS.land;
  return THREE.MathUtils.lerp(minS, maxS, distT) * categoryProfile.pace * classPace;
}

function routeSpeedForCategory(category, classTag, a, b) {
  const distanceKm = greatCircleDistanceKm(a, b);
  const cycleSeconds = routeCycleSeconds(category, classTag, distanceKm);
  const categoryProfile = ROUTE_CATEGORY_WEIGHT[category] || ROUTE_CATEGORY_WEIGHT.land;
  return {
    speed: 1 / cycleSeconds,
    distanceKm,
    baseOpacity: categoryProfile.baseOpacity,
    markerScale: categoryProfile.markerScale,
  };
}

function latLonToVec3(lat, lon, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function validateCoordinates(lat, lon) {
  const safeLat = Number(lat);
  const safeLon = Number(lon);
  if (!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) return null;
  if (safeLat < -90 || safeLat > 90) return null;
  if (safeLon < -180 || safeLon > 180) return null;
  return [safeLat, safeLon];
}

function greatCircleArc(a, b, altPeak, segments = 40) {
  const ua = latLonToVec3(a[0], a[1], 1);
  const ub = latLonToVec3(b[0], b[1], 1);
  const omega = Math.acos(THREE.MathUtils.clamp(ua.dot(ub), -1, 1));
  const sinOmega = Math.sin(omega) || 1e-6;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const A = Math.sin((1 - t) * omega) / sinOmega;
    const B = Math.sin(t * omega) / sinOmega;
    const p = new THREE.Vector3(A * ua.x + B * ub.x, A * ua.y + B * ub.y, A * ua.z + B * ub.z).normalize();
    const alt = 1 + altPeak * Math.sin(t * Math.PI);
    pts.push(p.multiplyScalar((earth.gameRadius + kmToGameUnits(0)) * alt));
  }
  return pts;
}

function samplePolyline(points, t) {
  const n = points.length - 1;
  const f = THREE.MathUtils.clamp(t, 0, 1) * n;
  const i = Math.floor(f);
  const a = points[Math.min(i, n)];
  const b = points[Math.min(i + 1, n)];
  return a.clone().lerp(b, f - i);
}

// Real-world reference points (lat, lon).
const EARTH_CITIES = [
  ['New York', 40.71, -74.01], ['Los Angeles', 34.05, -118.24], ['Chicago', 41.88, -87.63],
  ['London', 51.51, -0.13], ['Paris', 48.85, 2.35], ['Berlin', 52.52, 13.40],
  ['Moscow', 55.76, 37.62], ['Tokyo', 35.68, 139.69], ['Beijing', 39.90, 116.41],
  ['Shanghai', 31.23, 121.47], ['Mumbai', 19.08, 72.88], ['Delhi', 28.61, 77.21],
  ['Singapore', 1.35, 103.82], ['Dubai', 25.20, 55.27], ['Sydney', -33.87, 151.21],
  ['Sao Paulo', -23.55, -46.63], ['Mexico City', 19.43, -99.13], ['Lagos', 6.52, 3.38],
  ['Cairo', 30.04, 31.24], ['Johannesburg', -26.20, 28.05], ['Seoul', 37.57, 126.98],
  ['Jakarta', -6.21, 106.85], ['Bangkok', 13.76, 100.50], ['Istanbul', 41.01, 28.98],
  ['Toronto', 43.65, -79.38], ['Buenos Aires', -34.60, -58.38], ['Nairobi', -1.29, 36.82],
];

const EARTH_AIRPORTS = {
  JFK: [40.64, -73.78], LAX: [33.94, -118.41], ORD: [41.98, -87.90], LHR: [51.47, -0.45],
  CDG: [49.01, 2.55], FRA: [50.03, 8.57], DXB: [25.25, 55.36], HND: [35.55, 139.78],
  PEK: [40.08, 116.58], SIN: [1.35, 103.99], SYD: [-33.95, 151.18], GRU: [-23.43, -46.47],
  JNB: [-26.14, 28.25], ICN: [37.46, 126.44], DEL: [28.56, 77.10], IST: [41.26, 28.74],
  YYZ: [43.68, -79.63],
};

const EARTH_PORTS = {
  Shanghai: [31.36, 121.50], Singapore: [1.26, 103.82], Rotterdam: [51.95, 4.14],
  Busan: [35.10, 129.04], 'Los Angeles/Long Beach': [33.74, -118.26],
  'Jebel Ali': [24.98, 55.06], Hamburg: [53.54, 9.98], 'New York/New Jersey': [40.68, -74.13],
  Santos: [-23.96, -46.30],
};

// Illustrative corridors along genuine real-world trade/travel routes — the
// *paths* are real, the moving markers are simulated traffic, not live
// shipment/flight data.
const FLIGHT_ROUTES = [
  ['JFK', 'LHR', 'passenger'], ['LAX', 'HND', 'passenger'], ['LHR', 'DXB', 'passenger'],
  ['DXB', 'SIN', 'passenger'], ['FRA', 'JFK', 'passenger'], ['CDG', 'JFK', 'passenger'],
  ['SIN', 'SYD', 'passenger'], ['PEK', 'LAX', 'passenger'], ['GRU', 'CDG', 'passenger'],
  ['JNB', 'LHR', 'passenger'], ['DEL', 'LHR', 'passenger'], ['IST', 'JFK', 'passenger'],
];
const SHIPPING_LANES = [
  ['Shanghai', 'Los Angeles/Long Beach', 'consumer'], ['Rotterdam', 'New York/New Jersey', 'consumer'],
  ['Singapore', 'Rotterdam', 'consumer'], ['Jebel Ali', 'Singapore', 'energy'],
  ['Santos', 'Rotterdam', 'food'], ['Busan', 'Los Angeles/Long Beach', 'consumer'],
];
const LOGISTICS_CORRIDORS = [
  ['Los Angeles', 'Chicago', 'consumer'], ['Chicago', 'New York', 'consumer'],
  ['Mumbai', 'Delhi', 'food'], ['Mexico City', 'Los Angeles', 'consumer'],
  ['Johannesburg', 'Nairobi', 'food'], ['Berlin', 'Paris', 'industrial'],
];

function earthOrbitalPeriodSeconds(altitudeKm) {
  const a = EARTH_RADIUS_KM + altitudeKm;
  return 2 * Math.PI * Math.sqrt((a * a * a) / EARTH_MU);
}
const ISS_ALTITUDE_KM = 408;
const ISS_REAL_PERIOD_S = earthOrbitalPeriodSeconds(ISS_ALTITUDE_KM); // ~5561s — genuinely the ISS's real period
const ISS_GAME_PERIOD_S = 20; // gameplay pacing anchor, same idea as MERCURY_SCENE_PERIOD_S
function satelliteAngularSpeed(altitudeKm) {
  const realPeriod = earthOrbitalPeriodSeconds(altitudeKm);
  return (Math.PI * 2) / (ISS_GAME_PERIOD_S * (realPeriod / ISS_REAL_PERIOD_S));
}
const SATELLITE_SHELLS = [
  { name: 'ISS', altitudeKm: ISS_ALTITUDE_KM, color: 0x9fe6ff },
  { name: 'Starlink shell', altitudeKm: 550, color: 0x6fd6c8 },
  { name: 'GPS constellation', altitudeKm: 20200, color: 0xe0b04a },
  { name: 'Geostationary belt', altitudeKm: 35786, color: 0xd65f6f },
];

const earthOpsLayers = { air: true, sea: true, land: true, sat: true, iot: true };
let earthOpsClassFilter = 'all';
const earthOpsRoutes = []; // { category, classTag, points, marker, line, progress, speed, distanceKm }
const earthOpsSatellites = []; // { name, marker, ring, angle, angularSpeed, live }

function addRoute(category, classTag, points, color, speed, group, distanceKm = 0, baseOpacity = 0.45, markerScale = 1) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: baseOpacity }));
  // 0.18 base radius keeps markers readable near Earth without obscuring route paths.
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(ROUTE_MARKER_BASE_RADIUS * markerScale, 8, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  group.add(line, marker);
  earthOpsRoutes.push({ category, classTag, points, marker, line, progress: Math.random(), speed, distanceKm });
}

// Surface layers rotate with Earth's spin (real geography is fixed to the
// rotating body); satellites are attached to the non-spinning pivot instead,
// since orbits don't co-rotate with the surface (geostationary aside).
const surfaceGroup = new THREE.Group();
earth.tiltGroup.add(surfaceGroup);
const satelliteGroup = new THREE.Group();
earth.pivot.add(satelliteGroup);

for (const [a, b, cls] of FLIGHT_ROUTES) {
  const start = EARTH_AIRPORTS[a];
  const end = EARTH_AIRPORTS[b];
  const { speed, distanceKm, baseOpacity, markerScale } = routeSpeedForCategory('air', cls, start, end);
  addRoute('air', cls, greatCircleArc(start, end, 0.06), 0xbfd4ff, speed, surfaceGroup, distanceKm, baseOpacity, markerScale);
}
for (const [a, b, cls] of SHIPPING_LANES) {
  const start = EARTH_PORTS[a];
  const end = EARTH_PORTS[b];
  const { speed, distanceKm, baseOpacity, markerScale } = routeSpeedForCategory('sea', cls, start, end);
  addRoute('sea', cls, greatCircleArc(start, end, 0.006), 0x5fb0d6, speed, surfaceGroup, distanceKm, baseOpacity, markerScale);
}
for (const [a, b, cls] of LOGISTICS_CORRIDORS) {
  const cityLatLon = (name) => {
    const c = EARTH_CITIES.find((x) => x[0] === name);
    if (!c) {
      console.warn(`Earth Ops: missing city coordinates for "${name}"`);
      return null;
    }
    const coords = validateCoordinates(c[1], c[2]);
    if (!coords) {
      console.warn(`Earth Ops: invalid city coordinates for "${name}"`);
      return null;
    }
    return coords;
  };
  const start = cityLatLon(a);
  const end = cityLatLon(b);
  if (!start || !end) continue;
  const { speed, distanceKm, baseOpacity, markerScale } = routeSpeedForCategory('land', cls, start, end);
  addRoute('land', cls, greatCircleArc(start, end, 0.01), 0xe0b04a, speed, surfaceGroup, distanceKm, baseOpacity, markerScale);
}

// City/airport/port reference markers — small static points, real coordinates.
function addPointMarkers(entries, color, size) {
  const positions = new Float32Array(entries.length * 3);
  entries.forEach(([, lat, lon], i) => {
    const p = latLonToVec3(lat, lon, earth.gameRadius * 1.002);
    positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, sizeAttenuation: false }));
  surfaceGroup.add(pts);
  return pts;
}
addPointMarkers(EARTH_CITIES, 0xffffff, 2.2);
addPointMarkers(Object.entries(EARTH_AIRPORTS).map(([k, v]) => [k, ...v]), 0xbfd4ff, 2.2);
addPointMarkers(Object.entries(EARTH_PORTS).map(([k, v]) => [k, ...v]), 0x5fb0d6, 2.2);

// IoT telemetry — simulated device pings scattered near population centers.
const iotGroup = new THREE.Group();
surfaceGroup.add(iotGroup);
const iotPulses = [];
for (let i = 0; i < 24; i++) {
  const base = EARTH_CITIES[Math.floor(Math.random() * EARTH_CITIES.length)];
  const lat = base[1] + (Math.random() - 0.5) * 8;
  const lon = base[2] + (Math.random() - 0.5) * 8;
  const p = latLonToVec3(lat, lon, earth.gameRadius * 1.004);
  const mat = new THREE.MeshBasicMaterial({ color: 0xa6e6a0, transparent: true, opacity: 0.8 });
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), mat);
  dot.position.copy(p);
  iotGroup.add(dot);
  iotPulses.push({ dot, mat, phase: Math.random() * Math.PI * 2 });
}

// Satellite shells — illustrative rings at real altitude, one marker per
// shell orbiting at the real relative angular speed for that altitude.
for (const shell of SATELLITE_SHELLS) {
  const ringRadius = earth.gameRadius + kmToGameUnits(shell.altitudeKm);
  const ringPts = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    ringPts.push(new THREE.Vector3(Math.cos(t) * ringRadius, 0, Math.sin(t) * ringRadius));
  }
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(ringPts),
    new THREE.LineBasicMaterial({ color: shell.color, transparent: true, opacity: 0.25 }),
  );
  satelliteGroup.add(ring);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: shell.color }));
  satelliteGroup.add(marker);
  earthOpsSatellites.push({
    name: shell.name, marker, ring, ringRadius,
    angle: Math.random() * Math.PI * 2,
    angularSpeed: satelliteAngularSpeed(shell.altitudeKm),
    live: false,
  });
}

// ---------------------------------------------------------------------------
// Data source adapters — "easements" for real integrations.
//
// LIVE sources hit free, key-less, CORS-friendly public APIs directly from
// the browser and fall back to simulation on any failure (rate limit,
// network policy, offline). NEEDS_KEY sources are architected the same way
// but require a real credential this app can't obtain on your behalf —
// paste one into Configure API Keys and fetchLive() below is where it plugs in.
// ---------------------------------------------------------------------------
const API_KEY_STORAGE = 'solar-explorer-api-keys';
function loadApiKeys() {
  try { return JSON.parse(localStorage.getItem(API_KEY_STORAGE)) || {}; } catch { return {}; }
}
function saveApiKeys(keys) {
  try { localStorage.setItem(API_KEY_STORAGE, JSON.stringify(keys)); } catch { /* private browsing, etc. */ }
}

async function fetchWithTimeout(url, ms = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const dataSources = {
  iss: {
    label: 'ISS position', needsKey: false, status: 'connecting', pollMs: 20000, staleMs: 60000,
    async fetchLive() {
      const res = await fetchWithTimeout('https://api.wheretheiss.at/v1/satellites/25544');
      if (!res.ok) throw new Error('bad response');
      const d = await res.json();
      return { lat: d.latitude, lon: d.longitude };
    },
  },
  flights: {
    label: 'Live flight traffic (OpenSky Network)', needsKey: false, status: 'connecting', pollMs: 30000, staleMs: 90000,
    async fetchLive() {
      const res = await fetchWithTimeout('https://opensky-network.org/api/states/all');
      if (!res.ok) throw new Error('bad response');
      const d = await res.json();
      return d.states || [];
    },
  },
  maritime: { label: 'Maritime AIS (MarineTraffic / AISHub)', needsKey: true, status: 'needs_key', pollMs: 45000, staleMs: 135000, fetchLive: null },
  freight: { label: 'Freight / carrier data (FMCSA SAFER, project44, FourKites)', needsKey: true, status: 'needs_key', pollMs: 45000, staleMs: 135000, fetchLive: null },
  iot: { label: 'IoT device telemetry (AWS IoT / Azure IoT / generic MQTT)', needsKey: true, status: 'needs_key', pollMs: 30000, staleMs: 90000, fetchLive: null },
  maps: { label: 'Map imagery (Google Maps / Apple MapKit)', needsKey: true, status: 'needs_key', pollMs: 60000, staleMs: 180000, fetchLive: null },
};

for (const source of Object.values(dataSources)) {
  source.lastAttemptAt = 0;
  source.lastSuccessAt = 0;
  source.failures = 0;
  source.lastError = '';
  source.lastCount = null;
}

function sourceAgeMs(source) {
  return source.lastSuccessAt ? Math.max(0, Date.now() - source.lastSuccessAt) : null;
}

function fallbackStatusFromAge(source) {
  const age = sourceAgeMs(source);
  return age != null && age <= source.staleMs ? 'stale' : 'simulated';
}

function markSourceAttempt(key) {
  const source = dataSources[key];
  if (!source) return;
  source.lastAttemptAt = Date.now();
  if (!source.needsKey && !source.lastSuccessAt) source.status = 'connecting';
}

function markSourceLive(key, liveCount = null) {
  const source = dataSources[key];
  if (!source) return;
  source.lastSuccessAt = Date.now();
  source.failures = 0;
  source.lastError = '';
  source.status = 'live';
  source.lastCount = liveCount;
}

function markSourceFallback(key, errorLabel = 'fallback') {
  const source = dataSources[key];
  if (!source) return;
  source.failures += 1;
  source.lastError = errorLabel;
  source.status = fallbackStatusFromAge(source);
}

function refreshSourceHealth() {
  let changed = false;
  for (const source of Object.values(dataSources)) {
    if (source.needsKey) continue;
    const age = sourceAgeMs(source);
    if (source.status === 'live' && age != null && age > source.staleMs) {
      source.status = 'stale';
      changed = true;
    } else if (source.status === 'connecting' && source.lastAttemptAt) {
      const waitingMs = Date.now() - source.lastAttemptAt;
      if (waitingMs > source.pollMs * CONNECTION_TIMEOUT_MULTIPLIER) {
        source.status = 'simulated';
        changed = true;
      }
    }
  }
  if (changed) renderDataSourceStatus();
}

async function pollLiveIss() {
  markSourceAttempt('iss');
  try {
    const result = await dataSources.iss.fetchLive();
    const coords = validateCoordinates(result?.lat, result?.lon);
    if (!coords) throw new Error('bad-coordinates');
    const [lat, lon] = coords;
    const sat = earthOpsSatellites.find((s) => s.name === 'ISS');
    if (sat) {
      const p = latLonToVec3(lat, lon, sat.ringRadius);
      sat.marker.position.copy(p);
      sat.live = true;
    }
    markSourceLive('iss');
  } catch (err) {
    const sat = earthOpsSatellites.find((s) => s.name === 'ISS');
    if (sat) sat.live = false;
    markSourceFallback('iss', err?.message || 'request-failed');
  }
  renderDataSourceStatus();
}

async function pollLiveFlights() {
  markSourceAttempt('flights');
  try {
    const states = await dataSources.flights.fetchLive();
    const liveCount = Array.isArray(states) ? states.length : 0;
    if (liveCount > 0) {
      markSourceLive('flights', liveCount);
    } else {
      markSourceFallback('flights', 'empty-feed');
    }
  } catch (err) {
    markSourceFallback('flights', err?.message || 'request-failed');
  }
  renderDataSourceStatus();
}

function renderDataSourceStatus() {
  const el = document.getElementById('dataSourceStatus');
  if (!el) return;
  const badge = (s) => {
    if (s === 'live') return 'LIVE';
    if (s === 'stale') return 'STALE';
    if (s === 'needs_key') return 'NEEDS KEY';
    if (s === 'connecting') return 'CONNECTING';
    return 'SIMULATED';
  };
  const ageLabel = (source) => {
    const age = sourceAgeMs(source);
    if (age == null) return source.status === 'connecting' ? 'awaiting first fix' : 'no live fix yet';
    const sec = Math.round(age / 1000);
    return sec < SOURCE_AGE_SECOND_CUTOFF ? `${sec}s ago` : `${Math.round(sec / 60)}m ago`;
  };
  el.innerHTML = Object.values(dataSources).map((s) => `
    <div class="row">
      <span>${s.label}<small class="source-detail">${ageLabel(s)}</small></span>
      <b class="badge badge-${badge(s.status).toLowerCase().replace(' ', '-')}">${badge(s.status)}</b>
    </div>
  `).join('');
  renderEarthOpsMetrics();
}
renderDataSourceStatus();
pollLiveIss();
pollLiveFlights();
setInterval(pollLiveIss, 20000);
setInterval(pollLiveFlights, 30000);
setInterval(refreshSourceHealth, 10000);

// Plain, countable facts only — no synthesized "coverage %" or composite
// score. If a number here can't be traced to something you could count by
// hand, it doesn't belong in this panel.
function renderEarthOpsMetrics() {
  const el = document.getElementById('earthOpsMetrics');
  if (!el) return;
  const classMatchedRoutes = earthOpsRoutes.filter((r) => earthOpsClassFilter === 'all' || earthOpsClassFilter === r.classTag);
  const visibleRoutes = classMatchedRoutes.filter((r) => earthOpsLayers[r.category]).length;
  const distances = classMatchedRoutes.map((r) => r.distanceKm).filter(Number.isFinite);
  const avgRouteKm = distances.length ? Math.round(distances.reduce((sum, km) => sum + km, 0) / distances.length) : 0;
  const liveFeeds = Object.values(dataSources).filter((s) => s.status === 'live').length;
  const issAge = sourceAgeMs(dataSources.iss);
  const issAgeLabel = issAge == null ? 'n/a' : `${Math.round(issAge / 1000)}s`;
  const visibleSatellites = earthOpsLayers.sat ? earthOpsSatellites.length : 0;
  const liveSatellites = earthOpsLayers.sat ? earthOpsSatellites.filter((s) => s.live).length : 0;
  const enabledLayers = Object.values(earthOpsLayers).filter(Boolean).length;
  el.innerHTML = `
    <div class="row"><span>Enabled layers</span><b class="mono">${enabledLayers}/5</b></div>
    <div class="row"><span>Visible routes</span><b class="mono">${visibleRoutes}/${classMatchedRoutes.length}</b></div>
    <div class="row"><span>Avg route distance</span><b class="mono">${avgRouteKm.toLocaleString()} km</b></div>
    <div class="row"><span>Satellites live</span><b class="mono">${liveSatellites}/${visibleSatellites}</b></div>
    <div class="row"><span>ISS telemetry age</span><b class="mono">${issAgeLabel}</b></div>
    <div class="row"><span>Live feeds</span><b class="mono">${liveFeeds}/${Object.keys(dataSources).length}</b></div>
  `;
}

function applyEarthOpsFilters() {
  for (const r of earthOpsRoutes) {
    const layerOn = earthOpsLayers[r.category];
    const classOn = earthOpsClassFilter === 'all' || earthOpsClassFilter === r.classTag;
    const visible = layerOn && classOn;
    // Keep route paths and moving markers aligned to the same active filter so
    // both visuals follow layer + class filtering consistently.
    r.marker.visible = visible;
    r.line.visible = visible;
  }
  for (const s of earthOpsSatellites) {
    s.marker.visible = earthOpsLayers.sat;
    s.ring.visible = earthOpsLayers.sat;
  }
  iotGroup.visible = earthOpsLayers.iot;
  renderEarthOpsMetrics();
}

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
  if (!roaming) return;
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
// Free-roam state — no objectives, no timer, no fail state.
// ---------------------------------------------------------------------------
let roaming = false;

// Earth Lock: holds the camera at a fixed distance from Earth's actual
// current position every frame, so real orbital motion can't carry Earth out
// of view the way it does with a free-flight camera left stationary (Earth's
// own orbital speed is fast enough that this happens within seconds). Thrust
// zooms in/out instead of flying freely while locked.
const EARTH_LOCK_DISTANCE_MULTIPLIER = 3.5; // matches the normal travelTo approach distance
const earthLockState = {
  active: false,
  distance: earth.gameRadius * EARTH_LOCK_DISTANCE_MULTIPLIER,
  minDistance: earth.gameRadius * 1.35,
  maxDistance: earth.gameRadius * 18,
};

const overlay = document.getElementById('overlay');
const flashEl = document.getElementById('flash');
const travelListEl = document.getElementById('travelList');
const earthLockToggle = document.getElementById('earthLockToggle');

function getEarthWorldPosition(target = new THREE.Vector3()) {
  earth.mesh.getWorldPosition(target);
  return target;
}

function syncEarthLockButton() {
  earthLockToggle.textContent = earthLockState.active ? 'UNLOCK EARTH' : 'LOCK EARTH';
  earthLockToggle.classList.toggle('active', earthLockState.active);
}

function syncEarthLockCamera() {
  const camQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
  const earthPos = getEarthWorldPosition();
  camera.position.copy(earthPos).addScaledVector(forwardVec, -earthLockState.distance);
  camera.lookAt(earthPos);
}

function setEarthLock(active, { warpFirst = false, silent = false } = {}) {
  if (active) {
    if (warpFirst) travelTo('Earth', { suppressFlash: true, preserveEarthLock: true });
    const currentDistance = camera.position.distanceTo(getEarthWorldPosition());
    earthLockState.distance = THREE.MathUtils.clamp(
      currentDistance > 0 ? currentDistance : earth.gameRadius * EARTH_LOCK_DISTANCE_MULTIPLIER,
      earthLockState.minDistance,
      earthLockState.maxDistance,
    );
    earthLockState.active = true;
    velocity.set(0, 0, 0);
    syncEarthLockCamera();
    if (!silent) flash('EARTH LOCK ON — THRUST TO ZOOM');
  } else {
    earthLockState.active = false;
    velocity.set(0, 0, 0);
    if (!silent) flash('EARTH LOCK OFF');
  }
  syncEarthLockButton();
}

function flash(msg) {
  flashEl.textContent = msg;
  flashEl.classList.add('show');
  clearTimeout(flash._t);
  flash._t = setTimeout(() => flashEl.classList.remove('show'), 1600);
}

function renderTravelList() {
  const targets = [{ name: 'Sun' }, ...bodies];
  travelListEl.innerHTML = targets.map((b) => `<button class="travel-btn" data-name="${b.name}">${b.name}</button>`).join('');
  travelListEl.querySelectorAll('.travel-btn').forEach((btn) => {
    btn.addEventListener('click', () => travelTo(btn.dataset.name));
  });
}
renderTravelList();

// Places the ship a comfortable distance from the target, on its sunlit side,
// looking straight at it — the camera is a real THREE.Camera so lookAt()
// orients correctly (a plain Object3D would orient the opposite way).
function travelTo(name, { suppressFlash = false, preserveEarthLock = false } = {}) {
  if (name !== 'Earth' && earthLockState.active && !preserveEarthLock) setEarthLock(false, { silent: true });
  let p, radius;
  if (name === 'Sun') {
    p = new THREE.Vector3(0, 0, 0);
    radius = SUN_RADIUS;
  } else {
    const b = bodies.find((x) => x.name === name);
    if (!b) return;
    p = new THREE.Vector3();
    b.mesh.getWorldPosition(p);
    radius = b.gameRadius;
  }
  // A tighter approach distance would make the Sun a more reliable "nearest
  // body" winner over Mercury (whose perihelion can pass close by), but it
  // also parks the camera inside the sun glow sprite's bright zone and washes
  // out the whole screen — a real visual regression that matters more than
  // the rare case of Mercury edging out the Sun for "nearest" at some orbital
  // phases. Keep the same comfortable approach distance as every other body.
  const d = radius * 3.5;
  const towardSun = name === 'Sun' ? new THREE.Vector3(1, 0, 0) : p.clone().negate().normalize();
  const tangent = new THREE.Vector3(0, 1, 0).cross(towardSun).normalize();
  camera.position.copy(p).addScaledVector(towardSun, d * 0.6).addScaledVector(tangent, d * 0.8);
  camera.lookAt(p);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  yaw = e.y;
  pitch = e.x;
  velocity.set(0, 0, 0);
  if (name === 'Earth' && earthLockState.active) {
    earthLockState.distance = THREE.MathUtils.clamp(
      camera.position.distanceTo(getEarthWorldPosition()),
      earthLockState.minDistance,
      earthLockState.maxDistance,
    );
    syncEarthLockCamera();
  }
  if (!suppressFlash) flash(`WARPED TO ${name.toUpperCase()}`);
}

function enterFreeRoam() {
  setEarthLock(false, { silent: true });
  velocity.set(0, 0, 0);
  yaw = -Math.PI / 2;
  pitch = -0.05;
  camera.position.set(sceneDistance(startAU), 6, 0);
  overlay.classList.add('hidden');
  roaming = true;
  syncEarthLockButton();
}

document.getElementById('start').addEventListener('click', enterFreeRoam);
earthLockToggle.addEventListener('click', () => {
  setEarthLock(!earthLockState.active, { warpFirst: !earthLockState.active });
});
syncEarthLockButton();

// ---------------------------------------------------------------------------
// Earth Ops panel wiring — layer toggles, class filter, API key modal.
// ---------------------------------------------------------------------------
const earthOpsPanel = document.getElementById('earthOpsPanel');
document.getElementById('earthOpsToggle').addEventListener('click', () => {
  earthOpsPanel.classList.toggle('hidden');
});
document.getElementById('closeEarthOps').addEventListener('click', () => earthOpsPanel.classList.add('hidden'));
earthOpsPanel.addEventListener('click', (e) => { if (e.target === earthOpsPanel) earthOpsPanel.classList.add('hidden'); });
document.querySelectorAll('#earthOpsPanel input[type=checkbox][data-layer]').forEach((cb) => {
  cb.addEventListener('change', () => {
    earthOpsLayers[cb.dataset.layer] = cb.checked;
    applyEarthOpsFilters();
  });
});
document.getElementById('earthOpsClassFilter').addEventListener('change', (e) => {
  earthOpsClassFilter = e.target.value;
  applyEarthOpsFilters();
});
applyEarthOpsFilters();

const apiKeyModal = document.getElementById('apiKeyModal');
document.getElementById('configureKeys').addEventListener('click', () => {
  const keys = loadApiKeys();
  for (const input of document.querySelectorAll('#apiKeyModal input[data-source]')) {
    input.value = keys[input.dataset.source] || '';
  }
  apiKeyModal.classList.remove('hidden');
});
document.getElementById('closeApiKeyModal').addEventListener('click', () => apiKeyModal.classList.add('hidden'));
document.getElementById('closeApiKeyModalX').addEventListener('click', () => apiKeyModal.classList.add('hidden'));
apiKeyModal.addEventListener('click', (e) => { if (e.target === apiKeyModal) apiKeyModal.classList.add('hidden'); });
document.getElementById('saveApiKeys').addEventListener('click', () => {
  const keys = {};
  for (const input of document.querySelectorAll('#apiKeyModal input[data-source]')) {
    if (input.value.trim()) keys[input.dataset.source] = input.value.trim();
  }
  saveApiKeys(keys);
  flash('API KEYS SAVED (this browser only)');
  apiKeyModal.classList.add('hidden');
});

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

function updateHud(now, dt) {
  document.getElementById('clock').textContent = new Date().toISOString().slice(11, 19);

  const pitchDeg = THREE.MathUtils.radToDeg(pitch);
  const yawDeg = THREE.MathUtils.radToDeg(yaw);
  const rollDeg = motionEnabled ? (liveOrientation.gamma || 0) : 0;
  document.getElementById('pitchVal').textContent = pitchDeg.toFixed(1) + '°';
  document.getElementById('rollVal').textContent = rollDeg.toFixed(1) + '°';
  document.getElementById('yawVal').textContent = ((yawDeg + 360) % 360).toFixed(1) + '°';
  document.getElementById('speedVal').textContent = earthLockState.active
    ? `LOCK ${earthLockState.distance.toFixed(1)}u`
    : velocity.length().toFixed(0) + ' u/s';
  drawGyroRadar(pitchDeg, rollDeg);

  // nearest body — pure telemetry, no objective attached to it. Includes the
  // Sun (real diameter/surface temp) so parking there doesn't misleadingly
  // report whichever planet happens to be next-closest instead.
  let nearest = null, nearestDist = Infinity;
  for (const b of [SUN_BODY, ...bodies]) {
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
    document.getElementById('tPeriod').textContent = nearest.periodDays == null
      ? '—'
      : nearest.periodDays >= 1000
        ? (nearest.periodDays / 365).toFixed(1) + ' yr'
        : nearest.periodDays + ' d';
    const surfaceDist = Math.max(0, nearestDist - nearest.gameRadius);
    const kmPerUnit = nearest.diameterKm / (nearest.gameRadius * 2);
    document.getElementById('tRange').textContent = `${Math.round(surfaceDist * kmPerUnit).toLocaleString()} km`;
  }
  document.getElementById('tLock').textContent = earthLockState.active ? 'EARTH' : 'OFF';
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
    b.meanAnomaly += b.angularSpeed * dt;
    const E = solveEccentricAnomaly(b.meanAnomaly, b.ecc);
    const lx = b.orbitRadius * (Math.cos(E) - b.ecc);
    const lz = b.semiMinor * Math.sin(E);
    const cosP = Math.cos(b.argPeriapsis), sinP = Math.sin(b.argPeriapsis);
    b.pivot.position.set(lx * cosP - lz * sinP, 0, lx * sinP + lz * cosP);
    b.mesh.rotation.y += (Math.PI * 2) / Math.max(2, Math.abs(b.rotHours) / 3) * dt * Math.sign(b.rotHours || 1);
    if (b.mesh.userData.clouds) b.mesh.userData.clouds.rotation.y += 0.02 * dt;
  }
  for (const m of allMoons) {
    m.angle += m.angularSpeed * dt;
    m.mesh.position.set(Math.cos(m.angle) * m.orbitRadius, 0, Math.sin(m.angle) * m.orbitRadius);
  }
  for (let i = 0; i < ASTEROID_COUNT; i++) {
    const a = asteroidData[i];
    a.theta += a.speed * dt * 0.05;
  }
  updateAsteroidMatrices();

  for (const r of earthOpsRoutes) {
    // Speed is purely a function of real great-circle distance (set once in
    // routeSpeedForCategory) — nothing here ties a route's motion or
    // brightness to an unrelated API's live/simulated status.
    r.progress = (r.progress + r.speed * dt) % 1;
    r.marker.position.copy(samplePolyline(r.points, r.progress));
  }
  for (const s of earthOpsSatellites) {
    if (s.live) continue; // live-positioned marker (e.g. real ISS fix) holds until the next poll
    s.angle += s.angularSpeed * dt;
    s.marker.position.set(Math.cos(s.angle) * s.ringRadius, 0, Math.sin(s.angle) * s.ringRadius);
  }
  for (const p of iotPulses) {
    p.phase += dt * 2;
    p.mat.opacity = 0.35 + Math.abs(Math.sin(p.phase)) * 0.5;
  }

  if (roaming) {
    readKeyboard();
    const dir = input.forward !== 0 ? Math.sign(input.forward) : (touchThrust ? 1 : 0);
    const boosting = input.boost || touchBoost;

    if (earthLockState.active) {
      // Thrust/brake zoom the fixed orbit distance in/out instead of flying
      // freely — the camera re-anchors to Earth's actual position every
      // frame, so its real orbital motion can never carry it out of view.
      const zoomDir = dir - (input.brake ? 1 : 0);
      if (zoomDir !== 0) {
        const zoomRate = ACCEL * 0.5 * (boosting ? BOOST_MULT : 1);
        earthLockState.distance = THREE.MathUtils.clamp(
          earthLockState.distance - zoomDir * zoomRate * dt,
          earthLockState.minDistance,
          earthLockState.maxDistance,
        );
      }
      velocity.set(0, 0, 0);
      syncEarthLockCamera();
    } else {
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
    }

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
