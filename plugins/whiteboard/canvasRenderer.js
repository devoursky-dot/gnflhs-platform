/**
 * GNFLHS 전자칠판 필기 노트 - 듀얼 레이어 캔버스 렌더링 및 PNG 내보내기 엔진 (canvasRenderer.js)
 */
import { drawSmoothStroke } from '@gnflhs/canvas';
import { WHITEBOARD_CONFIG } from './config.js';

export function resizeCanvasPair(staticCanvas, activeCanvas, onAfterResize) {
  const dpr = Math.min(window.devicePixelRatio || 1, WHITEBOARD_CONFIG.maxDpr);
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);

  [staticCanvas, activeCanvas].forEach((c) => {
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  });

  if (typeof onAfterResize === 'function') {
    onAfterResize();
  }
}

export function redrawStaticHistory(sCtx, history) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  sCtx.clearRect(0, 0, w, h);

  for (const s of history) {
    if (s.tool === 'eraser') {
      sCtx.save();
      sCtx.globalCompositeOperation = 'destination-out';
      sCtx.lineWidth = s.width * WHITEBOARD_CONFIG.eraserWidthRatio;
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
}

export function renderActivePreview(sCtx, aCtx, points, tool, color, baseWidth) {
  aCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  if (points.length < 2) return;

  if (tool === 'eraser') {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const eraseLineWidth = baseWidth * WHITEBOARD_CONFIG.eraserWidthRatio;

    sCtx.save();
    sCtx.globalCompositeOperation = 'destination-out';
    sCtx.lineWidth = eraseLineWidth;
    sCtx.lineCap = 'round';
    sCtx.beginPath();
    sCtx.moveTo(prev.x, prev.y);
    sCtx.lineTo(last.x, last.y);
    sCtx.stroke();
    sCtx.restore();

    aCtx.save();
    aCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    aCtx.lineWidth = 1.5;
    aCtx.beginPath();
    aCtx.arc(last.x, last.y, eraseLineWidth * 0.5, 0, Math.PI * 2);
    aCtx.stroke();
    aCtx.restore();
  } else {
    const drawW =
      tool === 'highlighter'
        ? baseWidth * WHITEBOARD_CONFIG.highlighterWidthRatio
        : baseWidth;
    drawSmoothStroke(aCtx, points, color, drawW, tool === 'highlighter');
  }
}

export function exportBoardAsPng(staticCanvas, bgColor) {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = staticCanvas.width;
  exportCanvas.height = staticCanvas.height;
  const eCtx = exportCanvas.getContext('2d');

  eCtx.fillStyle = bgColor || WHITEBOARD_CONFIG.boardThemes[0];
  eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  eCtx.drawImage(staticCanvas, 0, 0);

  const link = document.createElement('a');
  const dateStamp = new Date().toISOString().slice(0, 10);
  link.download = `${WHITEBOARD_CONFIG.exportFilenamePrefix}_${dateStamp}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
}
