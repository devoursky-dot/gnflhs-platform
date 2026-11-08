// 삼성노트(Samsung Notes) REA 역추적 기반: 벡터 곡선(Bézier Vector Path) 생성기
// 픽셀 비트맵이 아닌 2차 베지에 곡선(Quadratic Bézier Spline)으로 경로를 벡터화하여
// 4K 전자칠판에서도 깨짐 없이 부드럽고 가벼운 스트로크 데이터를 만듭니다.

import { Point } from './stabilizer';

export interface VectorSegment {
  p0: Point;
  p1: Point;
  width: number;
}

export class VectorEngine {
  /**
   * 점 배열을 받아 부드러운 SVG 경로 문자열("M ... Q ...")로 변환합니다.
   */
  public static pointsToSvgPath(points: Point[]): string {
    if (points.length === 0) return "";
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
    }

    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      // 중간점을 제어점(Control Point)으로 사용하는 Quadratic Bézier
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      d += ` Q ${p1.x} ${p1.y}, ${midX} ${midY}`;
    }

    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  /**
   * 캔버스 2D 컨텍스트에 벡터 곡선을 즉시 하드웨어 가속 렌더링
   */
  public static drawSmoothStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    width: number,
    isHighlighter: boolean = false
  ) {
    if (points.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    if (isHighlighter) {
      ctx.globalAlpha = 0.35;
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.globalAlpha = 1.0;
    }

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
}
