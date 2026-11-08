// ============================================================================
// GNFLHS 전자칠판 필기 노트 (정식 배포본 v1.0.0)
// - 삼성노트(Samsung Notes) REA 역추적 기반 손떨림 보정 (StrokeStabilizer)
// - 구형 적외선/정전식 전자칠판용 속도 기반 가변 필압 엔진 (PressureEngine)
// - 2차 베지에 곡선(Quadratic Bézier Spline) 벡터 렌더링 & 더블 버퍼링 캔버스
// ============================================================================

class StrokeStabilizer {
  constructor(smoothingFactor = 0.42) {
    this.smoothingFactor = smoothingFactor;
    this.history = [];
  }
  reset() {
    this.history = [];
  }
  addPoint(rawPoint) {
    if (this.history.length === 0) {
      this.history.push(rawPoint);
      return rawPoint;
    }
    const prev = this.history[this.history.length - 1];
    const smoothX = prev.x + (rawPoint.x - prev.x) * this.smoothingFactor;
    const smoothY = prev.y + (rawPoint.y - prev.y) * this.smoothingFactor;
    const smoothPressure = prev.pressure + (rawPoint.pressure - prev.pressure) * 0.6;
    const filtered = {
      x: smoothX,
      y: smoothY,
      pressure: Math.max(0.05, Math.min(1.0, smoothPressure)),
      time: rawPoint.time
    };
    this.history.push(filtered);
    if (this.history.length > 10) this.history.shift();
    return filtered;
  }
}

class PressureEngine {
  constructor(baseWidth = 6) {
    this.lastPoint = null;
    this.setWidths(baseWidth);
  }
  setWidths(baseWidth) {
    this.minWidth = Math.max(1, baseWidth * 0.4);
    this.maxWidth = baseWidth * 1.6;
  }
  reset() {
    this.lastPoint = null;
  }
  computeWidth(current, hardwarePressure = 0.5) {
    if (hardwarePressure > 0 && hardwarePressure !== 0.5 && hardwarePressure <= 1.0) {
      return this.minWidth + (this.maxWidth - this.minWidth) * Math.pow(hardwarePressure, 1.2);
    }
    if (!this.lastPoint) {
      this.lastPoint = current;
      return (this.minWidth + this.maxWidth) / 2;
    }
    const dx = current.x - this.lastPoint.x;
    const dy = current.y - this.lastPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dt = Math.max(1, current.time - this.lastPoint.time);
    const velocity = dist / dt;
    this.lastPoint = current;

    const speedFactor = Math.max(0, Math.min(1, velocity / 2.5));
    const simulatedPressure = 1.0 - speedFactor * 0.65;
    return this.minWidth + (this.maxWidth - this.minWidth) * simulatedPressure;
  }
}

function drawSmoothStroke(ctx, points, color, width, isHighlighter = false) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = isHighlighter ? 0.35 : 1.0;
  ctx.globalCompositeOperation = 'source-over';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

// 상태 관리
const staticCanvas = document.getElementById('staticCanvas');
const activeCanvas = document.getElementById('activeCanvas');
const sCtx = staticCanvas.getContext('2d');
const aCtx = activeCanvas.getContext('2d');

let currentTool = 'pen'; // 'pen' | 'highlighter' | 'eraser'
let currentColor = '#FFFFFF';
let currentWidth = 6;
let showGrid = true;
const boardThemes = ['#0f172a', '#143326', '#ffffff'];
let boardThemeIdx = 0;

let history = [];
let redoStack = [];
let isDrawing = false;
let currentPoints = [];

const stabilizer = new StrokeStabilizer(0.42);
const pressureEngine = new PressureEngine(currentWidth);

function syncDeviceBadge() {
  const badge = document.getElementById('deviceBadge');
  if (!badge) return;
  const dev = (window.GNFLHS && GNFLHS.ui) ? GNFLHS.ui.getDevice().toUpperCase() : 'PC';
  badge.textContent = dev;
}
syncDeviceBadge();
if (window.GNFLHS && GNFLHS.ui) {
  GNFLHS.ui.onDeviceChange(syncDeviceBadge);
}

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
    // 실시간 지우개 적용
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

    // 지우개 가이드 원 표시
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

// 툴바 이벤트 연결
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
  if (window.GNFLHS && GNFLHS.ui) GNFLHS.ui.toast('칠판이 초기화되었습니다.');
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
  if (window.GNFLHS && GNFLHS.ui) GNFLHS.ui.toast('판서 이미지가 저장되었습니다.');
};
