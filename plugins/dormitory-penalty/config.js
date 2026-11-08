/**
 * GNFLHS 기숙사 상·벌점 관리 시스템 - 환경변수 안전 로더 및 검증 모듈 (config.js)
 */
import { env } from '@gnflhs/sdk';

function safeStr(key, fallback) {
  const val = env.str(key, fallback);
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;
}

function clampInt(val, fallback, min, max) {
  const n = Number.parseInt(String(val ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export const DORM_CONFIG = Object.freeze({
  appTitle: safeStr('APP_TITLE', '기숙사 상·벌점 관리 시스템'),
  schoolName: safeStr('SCHOOL_NAME', '경남외국어고등학교'),
  dormSubtitle: safeStr('DORM_SUBTITLE', '생활관 통합 관리'),
  dataCollectionKey: safeStr('DATA_COLLECTION_KEY', 'dormitory_records_v1'),
  defaultSupervisor: safeStr('DEFAULT_SUPERVISOR', '사감교사'),
  cacheCountKey: safeStr('CACHE_COUNT_KEY', 'dorm_record_count'),
  cacheTtlSec: clampInt(env.int('CACHE_TTL_SEC', 600), 600, 10, 86400),
  roomSuffix: safeStr('ROOM_SUFFIX', '호')
});
