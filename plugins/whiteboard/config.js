/**
 * GNFLHS 전자칠판 필기 노트 - 환경변수 안전 로더 및 검증 모듈 (config.js)
 * - env.json에서 펜 굵기, 손떨림 보정 계수, 형광펜/지우개 배율, DPR 상한 등을 로드하며
 *   잘못된 수치가 입력되더라도 캔버스 오류가 발생하지 않도록 안전 범위로 클램핑합니다.
 */
import { env } from '@gnflhs/sdk';

const FALLBACK_THEMES = ['#0f172a', '#143326', '#ffffff'];

function clampNumber(val, fallback, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeStr(key, fallback) {
  const raw = env.str(key, fallback);
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
}

function safeThemes(key, fallback) {
  const parsed = env.json(key, fallback);
  if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
  const valid = parsed.map((c) => String(c || '').trim()).filter(Boolean);
  return valid.length > 0 ? valid : fallback;
}

export const WHITEBOARD_CONFIG = Object.freeze({
  appTitle: safeStr('APP_TITLE', '전자칠판 필기 노트'),
  schoolName: safeStr('SCHOOL_NAME', '경남외국어고등학교'),
  defaultPenColor: safeStr('DEFAULT_PEN_COLOR', '#FFFFFF'),
  defaultPenWidth: Math.round(clampNumber(env.int('DEFAULT_PEN_WIDTH', 6), 6, 1, 40)),
  showGridDefault: env.bool('SHOW_GRID_DEFAULT', true),
  smoothingFactor: clampNumber(env.float('SMOOTHING_FACTOR', 0.42), 0.42, 0.05, 0.95),
  highlighterWidthRatio: clampNumber(env.float('HIGHLIGHTER_WIDTH_RATIO', 2.4), 2.4, 1.2, 5.0),
  eraserWidthRatio: clampNumber(env.float('ERASER_WIDTH_RATIO', 2.5), 2.5, 1.2, 6.0),
  maxDpr: clampNumber(env.float('MAX_DPR', 2), 2, 1, 3),
  exportFilenamePrefix: safeStr('EXPORT_FILENAME_PREFIX', 'GNFLHS_전자칠판'),
  boardThemes: safeThemes('BOARD_THEMES', FALLBACK_THEMES)
});
