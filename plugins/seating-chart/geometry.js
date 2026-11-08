/**
 * GNFLHS 스마트 좌석배치도 - 반 칸(0.5칸) 이동 및 1칸 여유 슬롯 기하 계산 모듈 (geometry.js)
 */
import { SEATING_CONFIG } from './config.js';

/**
 * 특정 줄(row)에서 연속된 책상 1개 폭(minDeskSlotSpan = 1.0칸)의 빈 공간이 존재하는지 검사하여
 * 투입 가능한 시작 슬롯 좌표(0.0 이상)를 반환합니다. 공간이 없으면 null을 반환합니다.
 */
export function findAvailableSlotForNewDesk(row, maxDesks) {
  const span = SEATING_CONFIG.minDeskSlotSpan;
  const sorted = [...(row.desks || [])].sort((a, b) => a.pos - b.pos);

  // 1. 첫 책상 앞 공간 검사
  if (sorted.length === 0) return 0.0;
  if (sorted[0].pos >= span) return 0.0;

  // 2. 인접한 책상들 사이의 빈 공간 검사
  for (let i = 0; i < sorted.length - 1; i++) {
    const endCurrent = Number((sorted[i].pos + span).toFixed(2));
    const startNext = sorted[i + 1].pos;
    if (startNext - endCurrent >= span - 1e-6) {
      return endCurrent;
    }
  }

  // 3. 마지막 책상 뒤쪽의 빈 공간 검사
  const lastEnd = Number((sorted[sorted.length - 1].pos + span).toFixed(2));
  if (maxDesks - lastEnd >= span - 1e-6) {
    return lastEnd;
  }

  return null;
}

/**
 * 반 칸(deskShiftStep = 0.5칸) 이동 시 분단 경계 이탈 및 다른 책상과의 충돌 여부를 검증하고
 * 이동 가능할 경우 desk.pos를 정밀 갱신한 뒤 true를 반환합니다.
 */
export function tryShiftDeskPosition(row, desk, delta, maxDesks) {
  const span = SEATING_CONFIG.minDeskSlotSpan;
  const nextPos = Number(((desk.pos || 0) + delta).toFixed(2));

  if (nextPos < 0 || nextPos + span > maxDesks + 1e-6) {
    return false;
  }

  const otherDesks = (row.desks || []).filter((d) => d.id !== desk.id);
  const isOverlapping = otherDesks.some((other) => {
    const otherStart = other.pos || 0;
    return Math.max(nextPos, otherStart) < Math.min(nextPos + span, otherStart + span) - 1e-6;
  });

  if (isOverlapping) {
    return false;
  }

  desk.pos = nextPos;
  return true;
}
