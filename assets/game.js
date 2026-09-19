/* ============================================================
   Snake X — Arcade Edition
   Vanilla JS, zero dependencies. Clean flat 2D rendering.
   Features: power-ups, levels, skins with unlocks, high scores,
   settings, WebAudio sound, PWA support.
   ============================================================ */
'use strict';

/* ============================== Utilities ============================== */
const $ = (sel) => document.querySelector(sel);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/* ============================== Storage ============================== */
const Store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — settings just won't persist */
    }
  },
};

const KEYS = {
  best: 'snakex3d.best',
  scores: 'snakex3d.scores',
  settings: 'snakex3d.settings',
  skin: 'snakex3d.skin',
  unlocked: 'snakex3d.unlocked',
};

/* ============================== Skins ============================== */
const SKINS = [
  { id: 'emerald', name: 'Emerald', c1: '#34d399', c2: '#065f46', glow: '#00ff85', unlock: 0 },
  { id: 'sapphire', name: 'Sapphire', c1: '#60a5fa', c2: '#1e3a8a', glow: '#3b82f6', unlock: 0 },
  { id: 'ruby', name: 'Ruby', c1: '#f87171', c2: '#7f1d1d', glow: '#ff3d71', unlock: 0 },
  { id: 'gold', name: 'Gold', c1: '#fbbf24', c2: '#78350f', glow: '#ffd600', unlock: 50 },
  { id: 'violet', name: 'Violet', c1: '#c084fc', c2: '#581c87', glow: '#a855f7', unlock: 150 },
  { id: 'cyan', name: 'Neon', c1: '#22d3ee', c2: '#155e75', glow: '#00e5ff', unlock: 300 },
  { id: 'shadow', name: 'Shadow', c1: '#9ca3af', c2: '#111827', glow: '#e5e7eb', unlock: 500 },
];
const DEFAULT_SKIN = 'emerald';

/* ============================== Sound (WebAudio, no files) ============================== */
const Sound = (() => {
  let ctx = null;
  const ensure = () => {
    if (!settings.sound) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch {
      return null;
    }
  };
  const tone = (freq, dur, type = 'square', vol = 0.06, when = 0) => {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  return {
    playClick: () => tone(660, 0.06, 'square', 0.04),
    playEat: () => tone(520, 0.09, 'square', 0.06),
    playPowerUp: () => { tone(440, 0.08); tone(660, 0.08, 'square', 0.06, 0.08); tone(880, 0.12, 'square', 0.06, 0.16); },
    playLevelUp: () => { tone(523, 0.09, 'triangle', 0.07); tone(659, 0.09, 'triangle', 0.07, 0.09); tone(784, 0.14, 'triangle', 0.07, 0.18); },
    playGameOver: () => { tone(300, 0.2, 'sawtooth', 0.07); tone(220, 0.22, 'sawtooth', 0.07, 0.18); tone(140, 0.4, 'sawtooth', 0.07, 0.38); },
    playCountdown: (last) => tone(last ? 880 : 440, last ? 0.22 : 0.1, 'triangle', 0.06),
    playTick: () => tone(980, 0.03, 'square', 0.025),
  };
})();

/* ============================== Game state ============================== */
const GRID = 20;                 // 20x20 cells
const FOOD = { normal: 10, speed: 25, shield: 30, slow: 20, magnet: 35 };
const POWERUPS = ['speed', 'shield', 'slow', 'magnet'];
const POWERUP_MS = 8000;

const settings = Object.assign(
  { sound: true, walls: true, dpad: true, difficulty: 'normal' },
  Store.get(KEYS.settings, {})
);
const saveSettings = () => Store.set(KEYS.settings, settings);

const canvas = $('#game');
const ctx = canvas.getContext('2d');

const state = {
  screen: 'menu',              // menu | playing | paused | countdown | over
  snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
  dir: { x: 1, y: 0 },
  nextDir: { x: 1, y: 0 },
  food: { x: 5, y: 5, type: 'normal' },
  score: 0,
  level: 1,
  eaten: 0,
  best: Store.get(KEYS.best, 0),
  powerups: [],                // [{type, expiresAt}]
  startedAt: Date.now(),
  pausedTotal: 0,
  pausedAt: 0,
  dead: false,
  raf: 0,
  lastStep: 0,
  shake: 0,
  particles: [],
  flyScores: [],
};

/* ============================== Screens ============================== */
const SCREENS = {
  menu: $('#screen-menu'),
  countdown: $('#screen-countdown'),
  pause: $('#screen-pause'),
  over: $('#screen-gameover'),
  scores: $('#screen-scores'),
  skins: $('#screen-skins'),
  settings: $('#screen-settings'),
  howto: $('#screen-howto'),
};
const hud = $('#hud');
const gameWrap = $('#game-wrap');
const powerupBar = $('#powerup-bar');
const dpad = $('#dpad');

function showScreen(name) {
  Object.entries(SCREENS).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  const inGame = name === null;
  hud.classList.toggle('hidden', !inGame);
  gameWrap.classList.toggle('hidden', !inGame);
  // On-screen keys are shown whenever enabled in settings (default: on)
  dpad.classList.toggle('hidden', !(inGame && settings.dpad));
}

/* ============================== Rendering — flat 2D ============================== */
let cell = 26;                       // px per cell (updated on resize)
let boardOx = 0, boardOy = 0;        // board top-left inside the canvas
const cx = (gx) => boardOx + gx * cell + cell / 2;
const cy = (gy) => boardOy + gy * cell + cell / 2;

// Rounded rectangle path helper
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Brighten a hex color by amount 0..1
function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + 255 * amt, 0, 255) | 0;
  const g = clamp(((n >> 8) & 255) + 255 * amt, 0, 255) | 0;
  const b = clamp((n & 255) + 255 * amt, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
function darken(hex, amt) { return lighten(hex, -amt); }

/* ============================== Background ============================== */
const stars = Array.from({ length: 80 }, () => ({
  x: Math.random(), y: Math.random(),
  r: 0.6 + Math.random() * 1.4,
  ph: Math.random() * Math.PI * 2,
  sp: 0.4 + Math.random() * 1.4,
}));

function drawBackground(W, H, now) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#08131f');
  bg.addColorStop(0.55, '#071018');
  bg.addColorStop(1, '#050a07');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (const st of stars) {
    const a = 0.15 + 0.4 * (0.5 + 0.5 * Math.sin(now / 1000 * st.sp + st.ph));
    ctx.fillStyle = `rgba(190,255,220,${a.toFixed(3)})`;
    ctx.fillRect(st.x * W, st.y * H, st.r, st.r);
  }
}

function drawBoard() {
  const ox = boardOx, oy = boardOy, size = GRID * cell;

  // Checkerboard tiles — classic snake look
  const cA = '#104022', cB = '#0b2e19';
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      ctx.fillStyle = (i + j) % 2 ? cB : cA;
      ctx.fillRect(ox + i * cell, oy + j * cell, cell + 0.5, cell + 0.5);
    }
  }

  // Neon border (the wall) — thick glowing frame when wall-collision is on
  ctx.save();
  if (settings.walls) {
    ctx.shadowColor = '#00ff85';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(64,255,160,0.8)';
    ctx.lineWidth = Math.max(3, cell * 0.18);
  } else {
    // Wrap mode: dashed border hints edges connect
    ctx.setLineDash([cell * 0.3, cell * 0.3]);
    ctx.strokeStyle = 'rgba(64,255,160,0.35)';
    ctx.lineWidth = 2;
  }
  ctx.strokeRect(ox, oy, size, size);
  ctx.restore();
}

/* ============================== Snake, food & effects ============================== */
function currentSkin() {
  const id = Store.get(KEYS.skin, DEFAULT_SKIN);
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

function drawSnake() {
  const skin = currentSkin();
  const body = state.snake;
  const n = body.length;

  // Tail-first so head draws on top
  for (let i = n - 1; i >= 0; i--) {
    const seg = body[i];
    const head = i === 0;
    const t = i / Math.max(1, n - 1);
    const pad = head ? cell * 0.06 : cell * 0.1 + t * cell * 0.08;
    const x = boardOx + seg.x * cell + pad;
    const y = boardOy + seg.y * cell + pad;
    const w = cell - pad * 2;
    const r = w * 0.32;

    ctx.save();
    if (head) {
      ctx.shadowColor = skin.glow;
      ctx.shadowBlur = 14;
    }
    ctx.fillStyle = head ? lighten(skin.c1, 0.3) : darken(skin.c1, 0.05 + t * 0.35);
    rr(x, y, w, w, r);
    ctx.fill();
    ctx.restore();

    if (head) {
      // Eyes — offset by direction so the head "looks" where it goes
      const hx = cx(seg.x), hy = cy(seg.y);
      const e = cell * 0.1;
      const px = state.dir.x * cell * 0.14;
      const py = state.dir.y * cell * 0.14;
      const sx = state.dir.x === 0 ? cell * 0.14 : 0;
      const sy = state.dir.y === 0 ? cell * 0.14 : 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(hx + px - sx, hy + py - sy, e, 0, Math.PI * 2);
      ctx.arc(hx + px + sx, hy + py + sy, e, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(hx + px - sx + state.dir.x * e * 0.4, hy + py - sy + state.dir.y * e * 0.4, e * 0.5, 0, Math.PI * 2);
      ctx.arc(hx + px + sx + state.dir.x * e * 0.4, hy + py + sy + state.dir.y * e * 0.4, e * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ============================== Food & power-ups ============================== */
const POWERUP_STYLE = {
  speed:  { color: '#f59e0b', icon: '⚡', label: 'Speed' },
  shield: { color: '#3b82f6', icon: '🛡️', label: 'Shield' },
  slow:   { color: '#06b6d4', icon: '🕐', label: 'Slow' },
  magnet: { color: '#a855f7', icon: '🧲', label: 'Magnet' },
};

function spawnFood(snakeBody) {
  let x, y;
  do {
    x = Math.floor(Math.random() * GRID);
    y = Math.floor(Math.random() * GRID);
  } while (snakeBody.some((s) => s.x === x && s.y === y));
  const roll = Math.random();
  const type = roll < 0.05 ? 'speed' : roll < 0.1 ? 'shield' : roll < 0.15 ? 'slow' : roll < 0.2 ? 'magnet' : 'normal';
  state.food = { x, y, type };
}

function drawFood() {
  const f = state.food;
  const pulse = 1 + Math.sin(performance.now() / 300) * 0.06;

  if (f.type === 'normal') {
    // Glossy apple
    const x = cx(f.x), y = cy(f.y);
    const r = cell * 0.34 * pulse;
    ctx.save();
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 12;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#ff8a9a');
    g.addColorStop(0.55, '#e81533');
    g.addColorStop(1, '#8f0019');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.28, y - r * 0.35, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3d6b2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + 2, y - r - 4);
    ctx.stroke();
    ctx.restore();
  } else {
    // Power-up: rounded glowing tile with its icon
    const s = POWERUP_STYLE[f.type];
    const pad = cell * 0.16;
    const x = boardOx + f.x * cell + pad;
    const y = boardOy + f.y * cell + pad;
    const w = cell - pad * 2;
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = s.color;
    rr(x, y, w, w, w * 0.28);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(x, y, w, w * 0.45, w * 0.22);
    ctx.fill();
    ctx.font = `${cell * 0.5}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.icon, cx(f.x), cy(f.y) + 1);
  }
}

/* ============================== Particles & floating scores ============================== */
function burst(gx, gy, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 0.6 + Math.random() * 2;
    state.particles.push({
      x: cx(gx), y: cy(gy),
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2,
      life: 1, color, size: 2 + Math.random() * 3,
    });
  }
}
function flyScore(gx, gy, text, color) {
  state.flyScores.push({ x: cx(gx), y: cy(gy) - cell * 0.6, text, color, life: 1 });
}
function drawEffects() {
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const p of state.particles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.025;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  state.flyScores = state.flyScores.filter((f) => f.life > 0);
  ctx.textAlign = 'center';
  for (const f of state.flyScores) {
    f.y -= 0.7; f.life -= 0.02;
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.font = `900 ${cell * 0.55}px Consolas, monospace`;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

/* ============================== HUD ============================== */
function updateHUD() {
  $('#stat-score').textContent = state.score;
  $('#stat-best').textContent = Math.max(state.score, state.best);
  $('#stat-level').textContent = state.level;
  const now = performance.now();
  state.powerups = state.powerups.filter((p) => p.expiresAt > now);
  if (state.powerups.length && !state.dead) {
    powerupBar.classList.remove('hidden');
    powerupBar.innerHTML = state.powerups
      .map((p) => {
        const s = POWERUP_STYLE[p.type];
        const left = Math.ceil((p.expiresAt - now) / 1000);
        return `<span class="pu-chip" style="border-color:${s.color}66;color:${s.color}">${s.icon} ${s.label} · ${left}s</span>`;
      })
      .join('');
  } else {
    powerupBar.classList.add('hidden');
    powerupBar.innerHTML = '';
  }
}

/* ============================== Game logic ============================== */
function baseInterval() {
  const d = { easy: 160, normal: 130, hard: 100 }[settings.difficulty] ?? 130;
  return Math.max(70, d - (state.level - 1) * 10);
}
function hasPower(type) { return state.powerups.some((p) => p.type === type); }

function magnetPull() {
  if (!hasPower('magnet')) return;
  const head = state.snake[0];
  const f = state.food;
  const free = (nx, ny) => !state.snake.some((s) => s.x === nx && s.y === ny);
  if (f.x !== head.x && free(f.x + Math.sign(head.x - f.x), f.y)) f.x += Math.sign(head.x - f.x);
  else if (f.y !== head.y && free(f.x, f.y + Math.sign(head.y - f.y))) f.y += Math.sign(head.y - f.y);
}

function consumeShield() {
  state.powerups = state.powerups.filter((p) => p.type !== 'shield');
  state.shake = 8;
  Sound.playTick();
}

function step() {
  state.dir = state.nextDir;
  const head = state.snake[0];
  let nx = head.x + state.dir.x;
  let ny = head.y + state.dir.y;
  const shielded = hasPower('shield');

  // Walls
  if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
    if (settings.walls && !shielded) return gameOver();
    if (settings.walls && shielded) consumeShield();
    nx = (nx + GRID) % GRID;
    ny = (ny + GRID) % GRID;
  }

  // Self collision
  if (state.snake.slice(1).some((s) => s.x === nx && s.y === ny)) {
    if (!shielded) return gameOver();
    consumeShield();
  }

  state.snake.unshift({ x: nx, y: ny });

  const f = state.food;
  if (nx === f.x && ny === f.y) {
    state.eaten += 1;
    state.score += FOOD[f.type];
    if (f.type === 'normal') Sound.playEat(); else Sound.playPowerUp();
    if (f.type !== 'normal') {
      const now = performance.now();
      state.powerups = [...state.powerups.filter((p) => p.type !== f.type), { type: f.type, expiresAt: now + POWERUP_MS }];
    }
    const color = f.type === 'normal' ? '#ff4455' : POWERUP_STYLE[f.type].color;
    burst(nx, ny, color);
    flyScore(nx, ny, `+${FOOD[f.type]}`, color);
    const lvl = Math.floor(state.score / 100) + 1;
    if (lvl > state.level) {
      state.level = lvl;
      Sound.playLevelUp();
      flyScore(nx, Math.max(0, ny - 1), `LEVEL ${lvl}!`, '#ffd600');
    }
    spawnFood(state.snake);
    updateHUD();
  } else {
    state.snake.pop();
  }
}

function elapsedSecs() {
  const paused = state.pausedTotal + (state.pausedAt ? Date.now() - state.pausedAt : 0);
  return (Date.now() - state.startedAt - paused) / 1000;
}

function gameOver() {
  if (state.dead) return;
  state.dead = true;
  state.shake = 14;
  Sound.playGameOver();
  updateHUD();

  const secs = Math.floor(elapsedSecs());
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  const isBest = state.score > state.best;
  if (isBest) { state.best = state.score; Store.set(KEYS.best, state.best); }

  const scores = Store.get(KEYS.scores, []);
  scores.push({ score: state.score, time: `${mm}:${ss}`, date: new Date().toISOString().slice(0, 10) });
  scores.sort((a, b) => b.score - a.score);
  Store.set(KEYS.scores, scores.slice(0, 10));

  $('#go-score').textContent = state.score;
  $('#go-level').textContent = state.level;
  $('#go-length').textContent = state.snake.length;
  $('#go-time').textContent = `${mm}:${ss}`;
  $('#go-title').textContent = isBest ? 'NEW HIGH SCORE!' : 'GAME OVER';
  $('#go-newbest').classList.toggle('hidden', !isBest);
  setTimeout(() => { state.screen = 'over'; showScreen('over'); }, 600);
}

/* ============================== Main loop ============================== */
function loop(now) {
  state.raf = requestAnimationFrame(loop);
  if (state.screen !== 'playing') return;
  const interval = baseInterval() * (hasPower('speed') ? 0.65 : 1) * (hasPower('slow') ? 1.4 : 1);
  if (now - state.lastStep >= interval) {
    state.lastStep = now;
    magnetPull();
    step();
  }
  render(now);
  if (!state.dead && Math.floor(now / 500) !== Math.floor((now - 16) / 500)) updateHUD();
}

/* ============================== Render frame ============================== */
function render(now) {
  const W = canvas.width, H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  drawBackground(W, H, now);

  // Center the board; shake offsets everything slightly
  const size = GRID * cell;
  boardOx = Math.round((W - size) / 2);
  boardOy = Math.round((H - size) / 2);
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    state.shake *= 0.88;
  }

  drawBoard();
  drawFood();
  drawSnake();
  drawEffects();

  if (state.dead) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8, 20, 35, 0.45)';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ============================== Input ============================== */
function setDir(x, y) {
  const cur = state.nextDir;
  if ((cur.x === -x && cur.y === -y) || (cur.x === x && cur.y === y)) return;
  state.nextDir = { x, y };
}

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  if (state.screen === 'playing') {
    if (k === ' ' || k === 'Escape') return pauseGame();
    if (k === 'ArrowUp' || k === 'w' || k === 'W') setDir(0, -1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') setDir(0, 1);
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') setDir(-1, 0);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') setDir(1, 0);
  } else if (state.screen === 'paused' && (k === ' ' || k === 'Escape')) {
    resumeGame();
  }
});

let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
  else setDir(0, dy > 0 ? 1 : -1);
}, { passive: true });

dpad.querySelectorAll('.dpad-btn').forEach((btn) => {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[btn.dataset.dir];
    if (d) setDir(d[0], d[1]);
  });
});

/* ============================== Flow control ============================== */
function pauseGame() {
  if (state.screen !== 'playing' || state.dead) return;
  state.screen = 'paused';
  state.pausedAt = Date.now();
  showScreen('pause');
}
function resumeGame() {
  if (state.screen !== 'paused') return;
  if (state.pausedAt) { state.pausedTotal += Date.now() - state.pausedAt; state.pausedAt = 0; }
  state.screen = 'playing';
  state.lastStep = performance.now();
  showScreen(null);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

function startGame() {
  state.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  state.dir = { x: 1, y: 0 };
  state.nextDir = { x: 1, y: 0 };
  state.score = 0; state.level = 1; state.eaten = 0;
  state.powerups = [];
  state.dead = false;
  state.startedAt = Date.now();
  state.pausedTotal = 0; state.pausedAt = 0;
  state.particles = []; state.flyScores = []; state.shake = 0;
  spawnFood(state.snake);
  updateHUD();

  state.screen = 'countdown';
  showScreen('countdown');
  const el = $('#countdown-num');
  const seq = ['3', '2', '1', 'GO!'];
  let i = 0;
  el.textContent = seq[0];
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  Sound.playCountdown(false);
  const iv = setInterval(() => {
    i += 1;
    if (i >= seq.length) {
      clearInterval(iv);
      state.screen = 'playing';
      state.lastStep = performance.now();
      showScreen(null);
      return;
    }
    el.textContent = seq[i];
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    Sound.playCountdown(i === seq.length - 1);
  }, 800);
}

/* ============================== Menu screens ============================== */
function renderScores() {
  const scores = Store.get(KEYS.scores, []);
  const list = $('#score-list');
  list.innerHTML = scores.length
    ? scores.map((s, i) => `<li><span>#${i + 1} · ${s.date}</span><b>${s.score}</b></li>`).join('')
    : '<li class="empty">No scores yet — go play!</li>';
}

function renderSkins() {
  const best = Store.get(KEYS.best, 0);
  const current = Store.get(KEYS.skin, DEFAULT_SKIN);
  const grid = $('#skin-grid');
  grid.innerHTML = '';
  for (const s of SKINS) {
    const unlocked = best >= s.unlock;
    const req = unlocked ? (current === s.id ? 'Selected' : 'Tap to use') : `Best ${s.unlock}+`;
    const btn = document.createElement('button');
    btn.className = 'skin-card' + (unlocked ? '' : ' locked') + (current === s.id ? ' selected' : '');
    btn.style.setProperty('--c1', s.c1);
    btn.style.setProperty('--c2', s.c2);
    btn.innerHTML = `<span class="skin-preview"></span><span class="skin-name">${s.name}</span><span class="skin-req">${req}</span>`;
    if (unlocked) {
      btn.addEventListener('click', () => { Store.set(KEYS.skin, s.id); Sound.playClick(); renderSkins(); });
    }
    grid.appendChild(btn);
  }
}

function syncSettingsUI() {
  $('#set-sound').checked = settings.sound;
  $('#set-walls').checked = settings.walls;
  $('#set-dpad').checked = settings.dpad;
  $('#set-difficulty').value = settings.difficulty;
}
$('#set-sound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });
$('#set-walls').addEventListener('change', (e) => { settings.walls = e.target.checked; saveSettings(); });
$('#set-dpad').addEventListener('change', (e) => { settings.dpad = e.target.checked; saveSettings(); });
$('#set-difficulty').addEventListener('change', (e) => { settings.difficulty = e.target.value; saveSettings(); });

$('#btn-start').addEventListener('click', () => { Sound.playClick(); startGame(); });
document.querySelectorAll('.menu-card').forEach((card) => {
  card.addEventListener('click', () => {
    Sound.playClick();
    const action = card.dataset.action;
    if (action === 'scores') renderScores();
    if (action === 'skins') renderSkins();
    if (action === 'settings') syncSettingsUI();
    showScreen(action);
  });
});
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => { Sound.playClick(); state.screen = 'menu'; showScreen('menu'); });
});
$('#btn-pause').addEventListener('click', pauseGame);
$('#btn-resume').addEventListener('click', resumeGame);
$('#btn-restart').addEventListener('click', () => { Sound.playClick(); startGame(); });
$('#btn-quit').addEventListener('click', () => { Sound.playClick(); state.screen = 'menu'; showScreen('menu'); });
$('#btn-play-again').addEventListener('click', () => { Sound.playClick(); startGame(); });
$('#btn-menu').addEventListener('click', () => { Sound.playClick(); state.screen = 'menu'; showScreen('menu'); });

/* ============================== PWA ============================== */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $('#btn-install').classList.remove('hidden');
});
$('#btn-install').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#btn-install').classList.add('hidden');
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/* ============================== Init ============================== */
function resize() {
  const cssW = Math.min(window.innerWidth * 0.9, 500);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const px = Math.max(300, Math.round(cssW * dpr));
  if (canvas.width !== px) {
    canvas.width = px;
    canvas.height = px; // square board
  }
  cell = px / GRID;
}

function init() {
  resize();
  window.addEventListener('resize', resize);
  $('#stat-best').textContent = state.best;
  state.screen = 'menu';
  showScreen('menu');
  requestAnimationFrame(loop);
}
init();
