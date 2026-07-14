// Procedural "illustrated photograph" art for the two Phase 2 photograph
// props (see clues.js CLUES.PHOTOGRAPH). Higgsfield generation for these was
// blocked by a zero-credit workspace with no free path (see
// GENERATED_ASSETS.md) — these are Canvas2D renders instead: flat-shaded,
// low-poly-silhouette figures in the same dusk-orange/slate-blue palette as
// the five Higgsfield-generated textures, aged with a sepia tint, vignette,
// and grain so they read as found photographs rather than in-world 3D
// snapshots. `vignette()` is also reused by PortraitRenderer.js so the NPC
// portraits carry a touch of the same treatment.

const SKY_TOP = '#232a3d'; // matches World.js SKY_ZENITH
const SKY_HORIZON = '#d98a52'; // matches World.js SKY_HORIZON
const DOCK_WOOD = '#4a3a28'; // matches Terrain.js dockMat base color
const PAPER = '#e8dcc0';

function drawSky(ctx, w, horizonY) {
  const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, horizonY);
}

function drawDock(ctx, w, h, horizonY) {
  ctx.fillStyle = DOCK_WOOD;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  const planks = 6;
  for (let i = 1; i < planks; i++) {
    const y = horizonY + ((h - horizonY) * i) / planks;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

/** A simple flat-shaded standing figure — trapezoid coat, circle head, no facial detail (this is meant to read as a found photograph, not a portrait). */
function drawFigure(ctx, { x, groundY, height, coatColor, skinColor, hairColor, windSwept = false, wave = false }) {
  const headR = height * 0.09;
  const headY = groundY - height + headR;
  const shoulderY = headY + headR * 1.3;
  const hipY = groundY - height * 0.42;
  const shoulderW = height * 0.16;
  const hipW = height * 0.12;

  ctx.fillStyle = coatColor;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * hipW * 0.5, hipY);
    ctx.lineTo(x + side * hipW * 0.35, groundY);
    ctx.lineTo(x + side * height * 0.02, groundY);
    ctx.lineTo(x + side * hipW * 0.15, hipY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.beginPath();
  ctx.moveTo(x - shoulderW * 0.5, shoulderY);
  ctx.lineTo(x + shoulderW * 0.5, shoulderY);
  ctx.lineTo(x + hipW * 0.55, hipY);
  ctx.lineTo(x - hipW * 0.55, hipY);
  ctx.closePath();
  ctx.fill();

  const armSway = wave ? 0.4 : 0.12;
  ctx.strokeStyle = coatColor;
  ctx.lineWidth = shoulderW * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - shoulderW * 0.48, shoulderY + headR * 0.2);
  ctx.lineTo(x - shoulderW * (0.48 + armSway * 0.3), hipY - headR * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + shoulderW * 0.48, shoulderY + headR * 0.2);
  const wristY = wave ? headY : hipY - headR * 0.3;
  ctx.lineTo(x + shoulderW * (0.48 + armSway), wristY);
  ctx.stroke();

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hairColor;
  if (windSwept) {
    ctx.beginPath();
    ctx.moveTo(x - headR * 0.2, headY - headR * 0.9);
    ctx.quadraticCurveTo(x + headR * 1.6, headY - headR * 0.4, x + headR * 2.1, headY + headR * 0.5);
    ctx.quadraticCurveTo(x + headR * 1.3, headY + headR * 0.2, x + headR * 0.4, headY - headR * 0.3);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.15, headR * 0.85, Math.PI, Math.PI * 2);
    ctx.fill();
  }
}

/** Sepia tint + darkened edges — exported so PortraitRenderer.js can reuse the vignette for a consistent "aged/dusk" feel across both asset kinds. */
export function vignette(ctx, w, h, strength = 0.45) {
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(20,14,8,${strength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

function agePhoto(ctx, w, h) {
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(196, 162, 112, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';

  vignette(ctx, w, h, 0.45);

  for (let i = 0; i < 900; i++) {
    const gx = Math.random() * w;
    const gy = Math.random() * h;
    const a = Math.random() * 0.06;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,240,210,${a})` : `rgba(20,14,8,${a})`;
    ctx.fillRect(gx, gy, 1, 1);
  }
}

function makePhotoCanvas(draw, { label } = {}) {
  const W = 480;
  const H = 360;
  const BORDER = 22;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const innerW = W - BORDER * 2;
  const innerH = H - BORDER * 2 - 14;
  ctx.save();
  ctx.translate(BORDER, BORDER);
  ctx.beginPath();
  ctx.rect(0, 0, innerW, innerH);
  ctx.clip();
  draw(ctx, innerW, innerH);
  agePhoto(ctx, innerW, innerH);
  ctx.restore();

  if (label) {
    ctx.font = 'italic 15px Georgia, serif';
    ctx.fillStyle = '#3a3226';
    ctx.textAlign = 'right';
    ctx.fillText(label, W - BORDER - 4, H - 6);
  }

  return canvas;
}

/** Elias and Rina on the dock — younger, laughing, wind pulling her hair sideways. */
export function renderDockPhoto() {
  return makePhotoCanvas(
    (ctx, w, h) => {
      const horizonY = h * 0.55;
      drawSky(ctx, w, horizonY);
      drawDock(ctx, w, h, horizonY);
      drawFigure(ctx, {
        x: w * 0.4,
        groundY: h * 0.92,
        height: h * 0.62,
        coatColor: '#4a3a28',
        skinColor: '#c9a883',
        hairColor: '#2b211a',
      });
      drawFigure(ctx, {
        x: w * 0.58,
        groundY: h * 0.92,
        height: h * 0.56,
        coatColor: '#6b4a52',
        skinColor: '#d3b593',
        hairColor: '#4a3222',
        windSwept: true,
        wave: true,
      });
    },
    { label: 'R. & E.' }
  );
}

/** Elias alone, older, standing in the exact spot where she stood — a self-timer snapshot. */
export function renderSoloPhoto() {
  return makePhotoCanvas((ctx, w, h) => {
    const horizonY = h * 0.55;
    drawSky(ctx, w, horizonY);
    drawDock(ctx, w, h, horizonY);
    drawFigure(ctx, {
      x: w * 0.58,
      groundY: h * 0.92,
      height: h * 0.64,
      coatColor: '#3a4f5c',
      skinColor: '#b98a68',
      hairColor: '#332a20',
    });
  });
}
