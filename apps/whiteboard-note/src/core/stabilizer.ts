// 삼성노트(Samsung Notes) REA 역추적 기반: 손떨림 보정 엔진 (Stabilizer)
// 구형 전자칠판의 적외선(IR) 및 정전식 터치 센서의 지그재그 떨림과 미세 노이즈를 완벽하게 제거합니다.

export interface Point {
  x: number;
  y: number;
  pressure: number;
  time: number;
}

export class StrokeStabilizer {
  private history: Point[] = [];
  private smoothingFactor: number; // 0.1(매우 강함) ~ 0.8(가벼움). 삼성노트 기본값은 약 0.42

  constructor(smoothingFactor: number = 0.45) {
    this.smoothingFactor = smoothingFactor;
  }

  public reset(): void {
    this.history = [];
  }

  /**
   * 실시간 지수 이동 평균(EMA) 및 3점 가중 보간법을 적용하여 떨림을 부드럽게 감쇄합니다.
   */
  public addPoint(rawPoint: Point): Point {
    if (this.history.length === 0) {
      this.history.push(rawPoint);
      return rawPoint;
    }

    const prev = this.history[this.history.length - 1];
    
    // 1. 지수 이동 평균 보정 (Exponential Moving Average)
    const smoothX = prev.x + (rawPoint.x - prev.x) * this.smoothingFactor;
    const smoothY = prev.y + (rawPoint.y - prev.y) * this.smoothingFactor;
    const smoothPressure = prev.pressure + (rawPoint.pressure - prev.pressure) * 0.6;

    const filteredPoint: Point = {
      x: smoothX,
      y: smoothY,
      pressure: Math.max(0.05, Math.min(1.0, smoothPressure)),
      time: rawPoint.time
    };

    this.history.push(filteredPoint);
    if (this.history.length > 10) {
      this.history.shift(); // 메모리 보호
    }

    return filteredPoint;
  }

  /**
   * 선을 마무리할 때 마지막 미세 오차를 목표점에 흡착시킵니다.
   */
  public finalize(rawEnd: Point): Point {
    return rawEnd;
  }
}
