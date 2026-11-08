/**
 * GNFLHS 기숙사 상·벌점 관리 시스템 - 데이터 저장소 · 필터링 · 통계 도메인 모듈 (recordStore.js)
 */
import { db, cache } from '@gnflhs/sdk';
import { DORM_CONFIG } from './config.js';
import { INITIAL_SAMPLE_RECORDS } from './seed.js';

export async function fetchDormRecords() {
  try {
    const saved = await db.get(DORM_CONFIG.dataCollectionKey);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
    const seeded = [...INITIAL_SAMPLE_RECORDS];
    await db.set(DORM_CONFIG.dataCollectionKey, seeded);
    return seeded;
  } catch (e) {
    console.warn('Failed to load records from db, using initial records:', e);
    return [...INITIAL_SAMPLE_RECORDS];
  }
}

export async function saveDormRecords(records) {
  try {
    await db.set(DORM_CONFIG.dataCollectionKey, records);
    cache.put(DORM_CONFIG.cacheCountKey, String(records.length), DORM_CONFIG.cacheTtlSec);
  } catch (e) {
    console.warn('Persist error:', e);
  }
}

export function filterDormRecords(records, { floor = 'all', type = 'all', query = '' }) {
  const q = String(query || '').trim().toLowerCase();
  return records.filter((r) => {
    const roomStr = String(r.room || '');
    if (floor !== 'all' && !roomStr.startsWith(floor)) {
      return false;
    }

    const pts = Number(r.points || 0);
    if (type === 'merit' && pts >= 0) return false;
    if (type === 'demerit' && pts <= 0) return false;

    if (q) {
      const matchName = String(r.studentName || '').toLowerCase().includes(q);
      const matchId = String(r.studentId || '').toLowerCase().includes(q);
      const matchRoom = roomStr.toLowerCase().includes(q);
      const matchReason = String(r.reason || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchRoom && !matchReason) return false;
    }
    return true;
  });
}

export function computeDormStats(filteredRecords) {
  const meritRecords = filteredRecords.filter((r) => Number(r.points) < 0);
  const demeritRecords = filteredRecords.filter((r) => Number(r.points) > 0);
  const meritSum = meritRecords.reduce((acc, r) => acc + Math.abs(Number(r.points)), 0);
  const demeritSum = demeritRecords.reduce((acc, r) => acc + Number(r.points), 0);

  return {
    totalCount: filteredRecords.length,
    meritCount: meritRecords.length,
    meritSum,
    demeritCount: demeritRecords.length,
    demeritSum
  };
}

export function normalizeRoomLabel(rawRoom) {
  const trimmed = String(rawRoom || '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith(DORM_CONFIG.roomSuffix)
    ? trimmed
    : `${trimmed}${DORM_CONFIG.roomSuffix}`;
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
