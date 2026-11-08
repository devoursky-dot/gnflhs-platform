// ============================================================================
// GNFLHS 전자칠판 필기 노트 (V2 멀티모듈 + env.json 안전 클램핑 정식 배포본 v1.2.0)
// - ./config.js         : env.json 환경변수 로드 및 안전 범위 검증
// - ./canvasRenderer.js : 듀얼 캔버스 렌더링 · 지우개 합성 · PNG 저장 엔진
// - @gnflhs/canvas      : 삼성노트 REA 손떨림 보정 (StrokeStabilizer) · 가변 필압 (PressureEngine)
// ============================================================================

import { toast, getDevice, onDeviceChange } from '@gnflhs/ui';
import { StrokeStabilizer, PressureEngine } from '@gnflhs/canvas';
import { WHITEBOARD_CONFIG } from './config.js';
import {
  resizeCanvasPair,
  redrawStaticHistory,
  renderActivePreview,
  exportBoardAsPng
} from './canvasRenderer.js';

const staticCanvas = document.getElementById('staticCanvas');
const activeCanvas = document.getElementById('activeCanvas');
const sCtx = staticCanvas.getContext('2d');
const aCtx = activeCanvas.getContext('2d');

let currentTool = 'pen'; // 'pen' | 'highlighter' | 'eraser'
let currentColor = WHITEBOARD_CONFIG.defaultPenColor;
let currentWidth = WHITEBOARD_CONFIG.defaultPenWidth;
let showGrid = WHITEBOARD_CONFIG.showGridDefault;
const boardThemes = WHITEBOARD_CONFIG.boardThemes;
let boardThemeIdx = 0;

let history = [];
let redoStack = [];
let isDrawing = false;
let currentPoints = [];

const stabilizer = new StrokeStabilizer(WHITEBOARD_CONFIG.smoothingFactor);
const pressureEngine = new PressureEngine(currentWidth);

function syncDeviceBadge() {
  const badge = document.getElementById('deviceBadge');
  if (badge) {
    badge.textContent = getDevice().toUpperCase();
  }
}
syncDeviceBadge();
onDeviceChange(syncDeviceBadge);

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) btnUndo.disabled = history.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

function refreshStaticBoard() {
  redrawStaticHistory(sCtx, history);
  updateUndoRedoButtons();
}

function handleResize() {
  resizeCanvasPair(staticCanvas, activeCanvas, refreshStaticBoard);
}

window.addEventListener('resize', handleResize);
document.body.classList.toggle('grid-bg', showGrid);
handleResize();

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
  renderActivePreview(sCtx, aCtx, currentPoints, currentTool, currentColor, currentWidth);
});

activeCanvas.addEventListener('pointermove', (e) => {
  if (!isDrawing) return;
  e.preventDefault();
  const raw = getPointFromEvent(e);
  const smoothPt = stabilizer.addPoint(raw);
  pressureEngine.computeWidth(smoothPt, raw.pressure);
  currentPoints.push(smoothPt);
  renderActivePreview(sCtx, aCtx, currentPoints, currentTool, currentColor, currentWidth);
});

function finishStroke() {
  if (!isDrawing) return;
  isDrawing = false;
  aCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (currentPoints.length >= 2) {
    const strokeWidth =
      currentTool === 'highlighter'
        ? currentWidth * WHITEBOARD_CONFIG.highlighterWidthRatio
        : currentWidth;
    history.push({
      points: [...currentPoints],
      tool: currentTool,
      color: currentColor,
      width: strokeWidth
    });
    redoStack = [];
    refreshStaticBoard();
  }
  currentPoints = [];
}

activeCanvas.addEventListener('pointerup', finishStroke);
activeCanvas.addEventListener('pointercancel', finishStroke);

function setActiveTool(tool) {
  currentTool = tool;
  document.getElementById('btnToolPen').classList.toggle('active', tool === 'pen');
  document
    .getElementById('btnToolHighlighter')
    .classList.toggle('active', tool === 'highlighter');
  document.getElementById('btnToolEraser').classList.toggle('active', tool === 'eraser');
}

document.getElementById('btnToolPen').onclick = () => setActiveTool('pen');
document.getElementById('btnToolHighlighter').onclick = () => setActiveTool('highlighter');
document.getElementById('btnToolEraser').onclick = () => setActiveTool('eraser');

document.querySelectorAll('.color-swatch').forEach((btn) => {
  btn.onclick = () => {
    currentColor = btn.getAttribute('data-color') || WHITEBOARD_CONFIG.defaultPenColor;
    if (currentTool === 'eraser') setActiveTool('pen');
    document.querySelectorAll('.color-swatch').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

document.querySelectorAll('.width-btn').forEach((btn) => {
  btn.onclick = () => {
    currentWidth = Number(btn.getAttribute('data-width') || WHITEBOARD_CONFIG.defaultPenWidth);
    pressureEngine.setWidths(currentWidth);
    document.querySelectorAll('.width-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  };
});

function performUndo() {
  if (history.length === 0) return;
  redoStack.push(history.pop());
  refreshStaticBoard();
}

function performRedo() {
  if (redoStack.length === 0) return;
  history.push(redoStack.pop());
  refreshStaticBoard();
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
  refreshStaticBoard();
  toast('칠판이 초기화되었습니다.');
};

document.getElementById('btnSave').onclick = () => {
  exportBoardAsPng(staticCanvas, boardThemes[boardThemeIdx]);
  toast('판서 이미지가 저장되었습니다.', 'success');
};
