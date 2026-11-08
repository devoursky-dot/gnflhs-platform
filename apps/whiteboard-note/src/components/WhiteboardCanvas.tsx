import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StrokeStabilizer, Point } from '../core/stabilizer';
import { PressureEngine } from '../core/pressureEngine';
import { VectorEngine } from '../core/vectorEngine';

interface StrokeData {
  points: Point[];
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  width: number;
}

interface WhiteboardCanvasProps {
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  width: number;
  onStrokeComplete?: (stroke: StrokeData) => void;
  undoTrigger?: number;
  redoTrigger?: number;
  clearTrigger?: number;
  saveTrigger?: number;
}

export const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  tool,
  color,
  width,
  undoTrigger,
  redoTrigger,
  clearTrigger,
  saveTrigger
}) => {
  // 1. 구형 안드로이드 전자칠판 렉 제로를 위한 듀얼 캔버스 (Double-Buffering)
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null); // 완료된 모든 선 (캐시된 비트맵)
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null); // 지금 그리고 있는 1개의 선 (실시간)

  const [history, setHistory] = useState<StrokeData[]>([]);
  const [redoStack, setRedoStack] = useState<StrokeData[]>([]);

  const isDrawing = useRef(false);
  const currentPoints = useRef<Point[]>([]);
  const stabilizer = useRef(new StrokeStabilizer(0.42)); // 삼성노트 감도
  const pressureEngine = useRef(new PressureEngine(width * 0.4, width * 1.6));
  const rafId = useRef<number | null>(null);

  // 선 두께 변경 시 압력 엔진 동기화
  useEffect(() => {
    pressureEngine.current.setWidths(width);
  }, [width]);

  // 캔버스 크기 초기화 (고해상도 Retina / 4K 전자칠판 대응)
  const resizeCanvas = useCallback(() => {
    const sCanvas = staticCanvasRef.current;
    const aCanvas = activeCanvasRef.current;
    if (!sCanvas || !aCanvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // 구형 칠판 성능을 위해 최대 2배율 제한
    const w = window.innerWidth;
    const h = window.innerHeight;

    sCanvas.width = w * dpr;
    sCanvas.height = h * dpr;
    aCanvas.width = w * dpr;
    aCanvas.height = h * dpr;

    sCanvas.style.width = `${w}px`;
    sCanvas.style.height = `${h}px`;
    aCanvas.style.width = `${w}px`;
    aCanvas.style.height = `${h}px`;

    const sCtx = sCanvas.getContext('2d');
    const aCtx = aCanvas.getContext('2d');
    if (sCtx) sCtx.scale(dpr, dpr);
    if (aCtx) aCtx.scale(dpr, dpr);

    // 크기 변경 후 히스토리 전체 다시 굽기
    redrawAllStaticStrokes(history);
  }, [history]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // 완료된 모든 선을 staticCanvas에 영구 렌더링
  const redrawAllStaticStrokes = (strokes: StrokeData[]) => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((s) => {
      if (s.tool === 'eraser') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = s.width * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        s.points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
      } else {
        VectorEngine.drawSmoothStroke(ctx, s.points, s.color, s.width, s.tool === 'highlighter');
      }
    });
  };

  // 실행 취소 (Undo)
  useEffect(() => {
    if (undoTrigger && history.length > 0) {
      const newHistory = [...history];
      const popped = newHistory.pop()!;
      setRedoStack((prev) => [...prev, popped]);
      setHistory(newHistory);
      redrawAllStaticStrokes(newHistory);
    }
  }, [undoTrigger]);

  // 다시 실행 (Redo)
  useEffect(() => {
    if (redoTrigger && redoStack.length > 0) {
      const newRedo = [...redoStack];
      const restored = newRedo.pop()!;
      const newHistory = [...history, restored];
      setHistory(newHistory);
      setRedoStack(newRedo);
      redrawAllStaticStrokes(newHistory);
    }
  }, [redoTrigger]);

  // 전체 지우기 (Clear)
  useEffect(() => {
    if (clearTrigger) {
      setHistory([]);
      setRedoStack([]);
      const sCanvas = staticCanvasRef.current;
      const aCanvas = activeCanvasRef.current;
      if (sCanvas) sCanvas.getContext('2d')?.clearRect(0, 0, sCanvas.width, sCanvas.height);
      if (aCanvas) aCanvas.getContext('2d')?.clearRect(0, 0, aCanvas.width, aCanvas.height);
    }
  }, [clearTrigger]);

  // 이미지 저장 (Save)
  useEffect(() => {
    if (saveTrigger && staticCanvasRef.current) {
      const url = staticCanvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    }
  }, [saveTrigger]);

  // =================== 터치 / 포인터 이벤트 핸들링 ===================

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 팜 리젝션: 펜이 감지되면 손바닥 터치 무시
    if (e.pointerType === 'touch' && e.width > 25 && e.height > 25) {
      return; // 손바닥 오터치 무시
    }

    isDrawing.current = true;
    stabilizer.current.reset();
    pressureEngine.current.reset();

    const rect = e.currentTarget.getBoundingClientRect();
    const rawPoint: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
      time: performance.now()
    };

    const smoothed = stabilizer.current.addPoint(rawPoint);
    currentPoints.current = [smoothed];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const rawPoint: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
      time: performance.now()
    };

    const smoothed = stabilizer.current.addPoint(rawPoint);
    currentPoints.current.push(smoothed);

    // requestAnimationFrame을 활용한 60fps 부드러운 렌더링 (구형 CPU 락 방지)
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        const aCanvas = activeCanvasRef.current;
        if (aCanvas) {
          const aCtx = aCanvas.getContext('2d');
          if (aCtx) {
            aCtx.clearRect(0, 0, aCanvas.width, aCanvas.height);
            if (tool === 'eraser') {
              // 지우개 프리뷰 원형 표시
              const lastP = currentPoints.current[currentPoints.current.length - 1];
              aCtx.save();
              aCtx.strokeStyle = '#ef4444';
              aCtx.lineWidth = 2;
              aCtx.beginPath();
              aCtx.arc(lastP.x, lastP.y, width * 1.5, 0, Math.PI * 2);
              aCtx.stroke();
              aCtx.restore();
            } else {
              VectorEngine.drawSmoothStroke(
                aCtx,
                currentPoints.current,
                color,
                width,
                tool === 'highlighter'
              );
            }
          }
        }
        rafId.current = null;
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentPoints.current.length > 0) {
      const newStroke: StrokeData = {
        points: [...currentPoints.current],
        tool,
        color,
        width
      };

      const newHistory = [...history, newStroke];
      setHistory(newHistory);
      setRedoStack([]);

      // 1. staticCanvas에 이번 선 1회만 베이킹
      const sCanvas = staticCanvasRef.current;
      if (sCanvas) {
        const sCtx = sCanvas.getContext('2d');
        if (sCtx) {
          if (tool === 'eraser') {
            redrawAllStaticStrokes(newHistory);
          } else {
            VectorEngine.drawSmoothStroke(
              sCtx,
              newStroke.points,
              newStroke.color,
              newStroke.width,
              newStroke.tool === 'highlighter'
            );
          }
        }
      }

      // 2. activeCanvas 청소
      const aCanvas = activeCanvasRef.current;
      if (aCanvas) {
        aCanvas.getContext('2d')?.clearRect(0, 0, aCanvas.width, aCanvas.height);
      }
    }

    currentPoints.current = [];
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#1e293b', overflow: 'hidden' }}>
      {/* 바닥 레이어: 이전 선들이 캐싱된 정적 캔버스 */}
      <canvas
        ref={staticCanvasRef}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />
      {/* 윗 레이어: 현재 그리고 있는 선을 받는 상호작용 캔버스 */}
      <canvas
        ref={activeCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          touchAction: 'none', // 브라우저 기본 스크롤/줌 제스처 완전 차단
          cursor: tool === 'eraser' ? 'cell' : 'crosshair'
        }}
      />
    </div>
  );
};
