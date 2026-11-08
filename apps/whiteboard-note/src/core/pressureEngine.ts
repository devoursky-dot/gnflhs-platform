// 삼성노트(Samsung Notes) REA 역추적 기반: 필압 및 가변 선두께 계산 엔진
// 하드웨어 S-Pen 필압이 있는 기기는 실측 압력을 반영하고,
// 구형 전자칠판처럼 필압 센서가 없는 일반 터치펜은 '이동 속도(Velocity)'를 역산하여 만년필 붓글씨 효과를 생성합니다.

import { Point } from './stabilizer';

export class PressureEngine {
  private lastPoint: Point | null = null;
  private minWidth: number;
  private maxWidth: number;

  constructor(minWidth: number = 2, maxWidth: number = 8) {
    this.minWidth = minWidth;
    this.maxWidth = maxWidth;
  }

  public setWidths(baseWidth: number) {
    this.minWidth = Math.max(1, baseWidth * 0.4);
    this.maxWidth = baseWidth * 1.6;
  }

  public reset() {
    this.lastPoint = null;
  }

  /**
   * 삼성노트 특유의 끝선 뾰족함(Tapering)과 중간 누름 강조 계산
   */
  public computeWidth(current: Point, hardwarePressure: number = 0.5): number {
    // 1. 하드웨어 필압이 유효하게 들어오는 경우 (0과 0.5 고정값이 아닌 경우)
    if (hardwarePressure > 0 && hardwarePressure !== 0.5 && hardwarePressure <= 1.0) {
      return this.minWidth + (this.maxWidth - this.minWidth) * Math.pow(hardwarePressure, 1.2);
    }

    // 2. 구형 전자칠판용 속도 기반 동적 필압 에뮬레이션 (Velocity-based simulated pressure)
    if (!this.lastPoint) {
      this.lastPoint = current;
      return (this.minWidth + this.maxWidth) / 2;
    }

    const dx = current.x - this.lastPoint.x;
    const dy = current.y - this.lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const dt = Math.max(1, current.time - this.lastPoint.time);
    const velocity = distance / dt; // 픽셀 / ms

    this.lastPoint = current;

    // 속도가 빠르면 얇아지고, 천천히 꾹 누르면 두꺼워지는 물리 잉크 모델
    const speedFactor = Math.max(0, Math.min(1, velocity / 2.5));
    const simulatedPressure = 1.0 - (speedFactor * 0.65); // 0.35 ~ 1.0

    return this.minWidth + (this.maxWidth - this.minWidth) * simulatedPressure;
  }
}
