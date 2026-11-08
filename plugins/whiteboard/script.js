// ============================================================================
// GNFLHS 전자칠판 필기 노트 (V2 ES Module + env.json 정식 배포본 v1.1.0)
// - @gnflhs/canvas 공유 모듈: 삼성노트 REA 손떨림 보정 (StrokeStabilizer) · 가변 필압 (PressureEngine) · 2차 베지에 곡선 (drawSmoothStroke)
// - env.json 선언형 환경변수로 기본 펜 색상/굵기/모눈/보정 계수 제어
// ============================================================================

import { env } from '@gnflhs/sdk';
import { toast, getDevice, onDeviceChange } from '@gnflhs/ui';
import { StrokeStabilizer, PressureEngine, drawSmoothStroke } from '@gnflhs/canvas';

const staticCanvas = document.getElementById('staticCanvas');
const activeCanvas = document.getElementById('activeCanvas');
const sCtx = staticCanvas.getContext('2d');
const aCtx = activeCanvas.getContext('2d');

let currentTool = 'pen'; // 'pen' | 'highlighter' | 'eraser'
let currentColor = env.str('DEFAULT_PEN_COLOR', '#FFFFFF');
let currentWidth = env.int('DEFAULT_PEN_WIDTH', 6);
let showGrid = env.bool('SHOW_GRID_DEFAULT', true);
const boardThemes = env.json('BOARD_THEMES', ['#0f172a', '#143326', '#ffffff']);
let boardThemeIdx = 0;

let history = [];
let redoStack = [];
let isDrawing = false;
let currentPoints = [];

const stabilizer = new StrokeStabilizer(env.float('SMOOTHING_FACTOR', 0.42));
const pressureEngine = new PressureEngine(currentWidth);

function syncDeviceBadge() {
  const badge = document.getElementById('deviceBadge');
  if (!badge) return;
  badge.textContent = getDevice().toUpperCase();
}
syncDeviceBadge();
onDeviceChange(syncDeviceBadge);

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.disabled = history.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

function redrawAllStaticStrokes() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  sCtx.clearRect(0, 0, w, h);

  for (const s of history) {
    if (s.tool === 'eraser') {
      sCtx.save();
      sCtx.globalCompositeOperation = 'destination-out';
      sCtx.lineWidth = s.width * 2.5;
      sCtx.lineCap = 'round';
      sCtx.lineJoin = 'round';
      sCtx.beginPath();
      s.points.forEach((p, idx) => {
        if (idx === 0) sCtx.moveTo(p.x, p.y);
        else sCtx.lineTo(p.x, p.y);
      });
      sCtx.stroke();
      sCtx.restore();
    } else {
      drawSmoothStroke(sCtx, s.points, s.color, s.width, s.tool === 'highlighter');
    }
  }
  updateUndoRedoButtons();
}

function resizeCanvases() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  [staticCanvas, activeCanvas].forEach((c) => {
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  });

  redrawAllStaticStrokes();
}

window.addEventListener('resize', resizeCanvases);
document.body.classList.toggle('grid-bg', showGrid);
resizeCanvases();

function getPointFromEvent(e) {
  return {
    x: e.clientX,
    y: e.clientY,
    pressure: e.pressure || 0.5,
    time: performance.now()
  };
}

activeCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  activeCanvas.setPointerCapture(e.pointerId);
  isDrawing = true;
  stabilizer.reset();
  pressureEngine.reset();

  const pt = stabilizer.addPoint(getPointFromEvent(e));
  currentPoints = [pt, { ...pt, x: pt.x + 0.1, y: pt.y + 0.1 }];
  renderActiveStroke();
});

activeCanvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  const raw = getPointFromEvent(e);
  const smoothPt = stabilizer.addPoint(raw);
  pressureEngine.computeWidth(smoothPt, raw.pressure);
  currentPoints.push(smoothPt);
  renderActiveStroke();
});

function finishStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  aCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (currentPoints.length >= 2) {
    const newStroke = {
      points: [...currentPoints],
      tool: currentTool,
      color: currentColor,
      width: currentTool === 'highlighter' ? currentWidth * 2.4 : currentWidth
    };
    history.push(newStroke);
    redoStack = [];
    redrawAllStaticStrokes();
  }
  currentPoints = [];
}

activeCanvas.addEventListener('pointerup', finishStroke);
activeCanvas.addEventListener('pointercancel', finishStroke);

function renderActiveStroke() {
  aCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (currentPoints.length < 2) return;

  if (currentTool === 'eraser') {
    const last = currentPoints[currentPoints.length - 1];
    sCtx.save();
    sCtx.globalCompositeOperation = 'destination-out';
    sCtx.lineWidth = currentWidth * 2.5;
    sCtx.lineCap = 'round';
    sCtx.beginPath();
    const prev = currentPoints[currentPoints.length - 2];
    sCtx.moveTo(prev.x, prev.y);
    sCtx.lineTo(last.x, last.y);
    sCtx.stroke();
    sCtx.restore();

    aCtx.save();
    aCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    aCtx.lineWidth = 1.5;
    aCtx.beginPath();
    aCtx.arc(last.x, last.y, currentWidth * 1.25, 0, Math.PI * 2);
    aCtx.stroke();
    aCtx.restore();
  } else {
    const drawW = currentTool === 'highlighter' ? currentWidth * 2.4 : currentWidth;
    drawSmoothStroke(aCtx, currentPoints, currentColor, drawW, currentTool === 'highlighter');
  }
}

function setActiveTool(tool) {
  currentTool = tool;
  document.getElementById('btnToolPen').classList.toggle('active', tool === 'pen');
  document.getElementById('btnToolHighlighter').classList.toggle('active', tool === 'highlighter');
  document.getElementById('btnToolEraser').classList.toggle('active', tool === 'eraser');
}

document.getElementById('btnToolPen').onclick = () => setActiveTool('pen');
document.getElementById('btnToolHighlighter').onclick = () => setActiveTool('highlighter');
document.getElementById('btnToolEraser').onclick = () => setActiveTool('eraser');

document.querySelectorAll('.color-swatch').forEach((btn) => {
  btn.onclick = () => {
    currentColor = btn.getAttribute('data-color') || '#FFFFFF';
    if (currentTool === 'eraser') setActiveTool('pen');
    document.querySelectorAll('.color-swatch').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

document.querySelectorAll('.width-btn').forEach((btn) => {
  btn.onclick = () => {
    currentWidth = Number(btn.getAttribute('data-width') || 6);
    pressureEngine.setWidths(currentWidth);
    document.querySelectorAll('.width-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

function performUndo() {
  if (history.length === 0) return;
  const popped = history.pop();
  redoStack.push(popped);
  redrawAllStaticStrokes();
}

function performRedo() {
  if (redoStack.length === 0) return;
  const restored = redoStack.pop();
  history.push(restored);
  redrawAllStaticStrokes();
}

document.getElementById('btnUndo').onclick = performUndo;
document.getElementById('btnRedo').onclick = performRedo;

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) performRedo();
    else performUndo();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    performRedo();
  }
});

const btnGrid = document.getElementById('btnGrid');
if (btnGrid) {
  btnGrid.classList.toggle('active', showGrid);
  btnGrid.onclick = () => {
    showGrid = !showGrid;
    document.body.classList.toggle('grid-bg', showGrid);
    btnGrid.classList.toggle('active', showGrid);
  };
}

const btnBoardTheme = document.getElementById('btnBoardTheme');
if (btnBoardTheme) {
  btnBoardTheme.onclick = () => {
    boardThemeIdx = (boardThemeIdx + 1) % boardThemes.length;
    document.body.style.backgroundColor = boardThemes[boardThemeIdx];
  };
}

document.getElementById('btnClear').onclick = () => {
  if (history.length === 0) return;
  history = [];
  redoStack = [];
  redrawAllStaticStrokes();
  toast('칠판이 초기화되었습니다.');
};

document.getElementById('btnSave').onclick = () => {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = staticCanvas.width;
  exportCanvas.height = staticCanvas.height;
  const eCtx = exportCanvas.getContext('2d');

  eCtx.fillStyle = boardThemes[boardThemeIdx] || '#0f172a';
  eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  eCtx.drawImage(staticCanvas, 0, 0);

  const link = document.createElement('a');
  link.download = `GNFLHS_전자칠판_${new Date().toISOString().slice(0, 10)}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
  toast('판서 이미지가 저장되었습니다.', 'success');
};
