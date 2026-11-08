/**
 * GNFLHS 스마트 좌석배치도 - 환경변수 안전 로더 및 검증 모듈 (config.js)
 * - env.json 또는 스튜디오 속성 패널에서 잘못된 값(빈 문자열, 음수, NaN 등)이 입력되더라도
 *   책상 폭 0px, 무한 루프, 레이아웃 붕괴 등의 오작동이 절대 일어나지 않도록 상·하한 클램핑을 보장합니다.
 */
import { env } from '@gnflhs/sdk';

const FALLBACK_SAMPLE_NAMES = [
  '김민준', '이서연', '박도윤', '정예원', '최시우', '강하은', '조지호', '윤지우',
  '장서진', '임수아', '한주원', '오채원', '서도현', '신유나', '권건우', '황다은',
  '안우진', '송민서', '유준서', '홍시은', '전승우', '고하윤', '문태윤', '손지민'
];

export function clampInt(val, fallback, min, max) {
  const n = Number.parseInt(String(val ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampFloat(val, fallback, min, max) {
  const n = Number.parseFloat(String(val ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function safeNonEmptyStr(key, fallback) {
  const raw = env.str(key, fallback);
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : fallback;
}

function safeNameList(key, fallback) {
  const parsed = env.json(key, fallback);
  if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
  const cleaned = parsed.map((item) => String(item || '').trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : fallback;
}

const maxZones = clampInt(env.int('MAX_ZONES', 6), 6, 1, 10);
const maxRowsPerZone = clampInt(env.int('MAX_ROWS_PER_ZONE', 12), 12, 1, 20);
const maxDesksPerRow = clampInt(env.int('MAX_DESKS_PER_ROW', 5), 5, 1, 8);
const maxStudents = clampInt(env.int('MAX_STUDENTS', 60), 60, 1, 120);

export const SEATING_CONFIG = Object.freeze({
  appTitle: safeNonEmptyStr('APP_TITLE', '스마트 좌석배치도'),
  schoolName: safeNonEmptyStr('SCHOOL_NAME', '경남외국어고등학교'),
  storageKey: safeNonEmptyStr('STORAGE_KEY', 'gnflhs_seating_app_v1'),
  dbLayoutsKey: safeNonEmptyStr('DB_LAYOUTS_KEY', 'seating_layouts'),
  defaultClassName: safeNonEmptyStr('DEFAULT_CLASS_NAME', '1학년 2반'),

  maxZones,
  maxRowsPerZone,
  maxDesksPerRow,
  maxStudents,

  defaultZones: clampInt(env.int('DEFAULT_ZONES', 3), 3, 1, maxZones),
  defaultRows: clampInt(env.int('DEFAULT_ROWS', 4), 4, 1, maxRowsPerZone),
  defaultMaxDesks: clampInt(env.int('DEFAULT_MAX_DESKS', 2), 2, 1, maxDesksPerRow),
  defaultStudents: clampInt(env.int('DEFAULT_STUDENTS', 24), 24, 1, maxStudents),

  groupTabZones: clampInt(env.int('GROUP_TAB_ZONES', 2), 2, 1, maxZones),
  groupTabRows: clampInt(env.int('GROUP_TAB_ROWS', 3), 3, 1, maxRowsPerZone),
  groupTabMaxDesks: clampInt(env.int('GROUP_TAB_MAX_DESKS', 3), 3, 1, maxDesksPerRow),

  deskWidthPx: clampInt(env.int('DESK_WIDTH_PX', 90), 90, 64, 160),
  zoneTrackPaddingPx: clampInt(env.int('ZONE_TRACK_PADDING_PX', 16), 16, 8, 48),
  deskShiftStep: clampFloat(env.float('DESK_SHIFT_STEP', 0.5), 0.5, 0.25, 1.0),
  minDeskSlotSpan: clampFloat(env.float('MIN_DESK_SLOT_SPAN', 1.0), 1.0, 0.5, 2.0),

  printTwoLineFontPx: clampInt(env.int('PRINT_TWOLINE_FONT_PX', 26), 26, 14, 42),
  printOneLineFontPx: clampInt(env.int('PRINT_ONELINE_FONT_PX', 21), 21, 12, 36),
  printMinFontPx: clampInt(env.int('PRINT_MIN_FONT_PX', 11), 11, 8, 18),
  printCardInnerWidthPx: clampInt(env.int('PRINT_CARD_INNER_WIDTH_PX', 82), 82, 50, 150),
  printMinSingleLineNamePx: clampInt(env.int('PRINT_MIN_SINGLELINE_NAME_PX', 44), 44, 28, 100),

  sampleStudentNames: safeNameList('SAMPLE_STUDENT_NAMES', FALLBACK_SAMPLE_NAMES)
});
