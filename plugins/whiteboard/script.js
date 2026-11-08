// GNFLHS 전자칠판 필기 스크립트 (삼성노트 REA 필압 보정)
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let color = '#ffffff';
let isEraser = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function start(e) {
  drawing = true;
  ctx.beginPath();
  const p = getPt(e);
  ctx.moveTo(p.x, p.y);
}

function draw(e) {
  if (!drawing) return;
  const p = getPt(e);
  ctx.strokeStyle = isEraser ? '#0f172a' : color;
  ctx.lineWidth = isEraser ? 36 : (6 * (p.pressure || 1));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function end() { drawing = false; }

function getPt(e) {
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX, y: p.clientY, pressure: e.pressure || 1 };
}

canvas.addEventListener('pointerdown', start);
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', end);

document.getElementById('btnPen').onclick = () => { isEraser = false; color = '#ffffff'; };
document.getElementById('btnRed').onclick = () => { isEraser = false; color = '#ef4444'; };
document.getElementById('btnYellow').onclick = () => { isEraser = false; color = '#facc15'; };
document.getElementById('btnEraser').onclick = () => { isEraser = true; };
document.getElementById('btnClear').onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); };
