const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const badge = document.getElementById('deviceBadge');
let drawing = false;
let color = '#ffffff';
let isEraser = false;
let showGrid = false;

function updateDeviceLabel() {
  if (badge) badge.textContent = GNFLHS.ui.getDevice().toUpperCase();
}
updateDeviceLabel();
GNFLHS.ui.onDeviceChange(updateDeviceLabel);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function getPt(e) {
  const p = e.touches ? e.touches[0] : e;
  return { x: p.clientX, y: p.clientY, pressure: e.pressure || 1 };
}

canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  ctx.beginPath();
  const p = getPt(e);
  ctx.moveTo(p.x, p.y);
});

canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = getPt(e);
  ctx.strokeStyle = isEraser ? '#0f172a' : color;
  ctx.lineWidth = isEraser ? 36 : (5 * (p.pressure || 1));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

canvas.addEventListener('pointerup', () => { drawing = false; });

document.getElementById('btnPen').onclick = () => { isEraser = false; color = '#ffffff'; };
document.getElementById('btnRed').onclick = () => { isEraser = false; color = '#ef4444'; };
document.getElementById('btnYellow').onclick = () => { isEraser = false; color = '#facc15'; };
const btnBlue = document.getElementById('btnBlue');
if (btnBlue) btnBlue.onclick = () => { isEraser = false; color = '#38bdf8'; };
const btnGrid = document.getElementById('btnGrid');
if (btnGrid) btnGrid.onclick = () => {
  showGrid = !showGrid;
  document.body.classList.toggle('grid-bg', showGrid);
};
document.getElementById('btnEraser').onclick = () => { isEraser = true; };
document.getElementById('btnClear').onclick = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  console.log('캔버스 초기화 완료');
};