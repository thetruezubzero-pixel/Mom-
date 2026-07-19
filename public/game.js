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

const overlay = document.getElementById('overlay');
const flashEl = document.getElementById('flash');
const travelListEl = document.getElementById('travelList');

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
function travelTo(name) {
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
  const d = radius * 3.5;
  const towardSun = name === 'Sun' ? new THREE.Vector3(1, 0, 0) : p.clone().negate().normalize();
  const tangent = new THREE.Vector3(0, 1, 0).cross(towardSun).normalize();
  camera.position.copy(p).addScaledVector(towardSun, d * 0.6).addScaledVector(tangent, d * 0.8);
  camera.lookAt(p);
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  yaw = e.y;
  pitch = e.x;
  velocity.set(0, 0, 0);
  flash(`WARPED TO ${name.toUpperCase()}`);
}

function enterFreeRoam() {
  velocity.set(0, 0, 0);
  yaw = -Math.PI / 2;
  pitch = -0.05;
  camera.position.set(sceneDistance(startAU), 6, 0);
  overlay.classList.add('hidden');
  roaming = true;
}

document.getElementById('start').addEventListener('click', enterFreeRoam);

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
  document.getElementById('speedVal').textContent = velocity.length().toFixed(0) + ' u/s';
  drawGyroRadar(pitchDeg, rollDeg);

  // nearest planet — pure telemetry, no objective attached to it
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

  if (roaming) {
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
