/**
 * GNFLHS 스마트 좌석배치도 - 상태 저장소(localStorage + Firestore SDK) 및 명렬표/분단 도메인 모듈 (state.js)
 */
import { db } from '@gnflhs/sdk';
import { SEATING_CONFIG, clampInt } from './config.js';

export const appState = {
  activeTabId: '',
  tabs: [],
  isEditMode: false,
  rosterOpen: true
};

export function createZoneObject(zIdx, rowCount, maxDesks) {
  const span = SEATING_CONFIG.minDeskSlotSpan;
  const stamp = Date.now();
  return {
    id: `zone_${zIdx}_${stamp}_${Math.random().toString(36).slice(2, 5)}`,
    name: `${zIdx + 1}분단`,
    rowCount,
    maxDesks,
    rows: Array.from({ length: rowCount }).map((_, rIdx) => ({
      id: `row_${zIdx}_${rIdx}_${stamp}`,
      desks: Array.from({ length: maxDesks }).map((_, dIdx) => ({
        id: `desk_${zIdx}_${rIdx}_${dIdx}_${stamp}`,
        pos: Number((dIdx * span).toFixed(2)),
        studentNo: '',
        studentName: ''
      }))
    }))
  };
}

export function createDefaultTab(
  title = `${SEATING_CONFIG.defaultClassName} 일반배치`,
  className = SEATING_CONFIG.defaultClassName,
  zoneCount = SEATING_CONFIG.defaultZones,
  rowCount = SEATING_CONFIG.defaultRows,
  maxDesks = SEATING_CONFIG.defaultMaxDesks,
  totalStudents = SEATING_CONFIG.defaultStudents
) {
  const safeZones = clampInt(zoneCount, SEATING_CONFIG.defaultZones, 1, SEATING_CONFIG.maxZones);
  const safeRows = clampInt(rowCount, SEATING_CONFIG.defaultRows, 1, SEATING_CONFIG.maxRowsPerZone);
  const safeDesks = clampInt(maxDesks, SEATING_CONFIG.defaultMaxDesks, 1, SEATING_CONFIG.maxDesksPerRow);
  const safeTotal = clampInt(totalStudents, SEATING_CONFIG.defaultStudents, 1, SEATING_CONFIG.maxStudents);

  const tabId = 'tab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const zones = Array.from({ length: safeZones }).map((_, zIdx) =>
    createZoneObject(zIdx, safeRows, safeDesks)
  );

  const sampleNames = SEATING_CONFIG.sampleStudentNames;
  const roster = Array.from({ length: safeTotal }).map((_, i) => ({
    id: `stu_${i + 1}`,
    no: i + 1,
    name: sampleNames[i] || `학생 ${i + 1}`,
    assignedDeskId: null
  }));

  return {
    id: tabId,
    title,
    className,
    totalCount: safeTotal,
    autoNumber: true,
    isEditMode: false,
    zones,
    roster
  };
}

export function loadState() {
  try {
    const saved = localStorage.getItem(SEATING_CONFIG.storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        appState.tabs = parsed.tabs;
        appState.activeTabId = parsed.activeTabId || parsed.tabs[0].id;
        appState.rosterOpen = parsed.rosterOpen !== undefined ? parsed.rosterOpen : true;
        appState.isEditMode = Boolean(parsed.isEditMode);
        return;
      }
    }
  } catch (e) {
    console.warn('Failed to load local seating state:', e);
  }

  const tab1 = createDefaultTab(
    `${SEATING_CONFIG.defaultClassName} 일반배치`,
    SEATING_CONFIG.defaultClassName,
    SEATING_CONFIG.defaultZones,
    SEATING_CONFIG.defaultRows,
    SEATING_CONFIG.defaultMaxDesks,
    SEATING_CONFIG.defaultStudents
  );
  const tab2 = createDefaultTab(
    '모둠 활동형 배치',
    `${SEATING_CONFIG.defaultClassName} (모둠)`,
    SEATING_CONFIG.groupTabZones,
    SEATING_CONFIG.groupTabRows,
    SEATING_CONFIG.groupTabMaxDesks,
    SEATING_CONFIG.defaultStudents
  );
  appState.tabs = [tab1, tab2];
  appState.activeTabId = tab1.id;
  appState.isEditMode = false;
  appState.rosterOpen = true;
}

export function saveState(onSavedPulse) {
  try {
    localStorage.setItem(
      SEATING_CONFIG.storageKey,
      JSON.stringify({
        activeTabId: appState.activeTabId,
        tabs: appState.tabs,
        rosterOpen: appState.rosterOpen,
        isEditMode: appState.isEditMode
      })
    );

    db.set(SEATING_CONFIG.dbLayoutsKey, appState.tabs).catch(() => {});

    if (typeof onSavedPulse === 'function') {
      onSavedPulse();
    }
  } catch (e) {
    console.warn('Auto-save error:', e);
  }
}

export function getActiveTab() {
  return appState.tabs.find((t) => t.id === appState.activeTabId) || appState.tabs[0];
}

export function isStudentAssigned(studentName) {
  if (!studentName) return false;
  const tab = getActiveTab();
  if (!tab) return false;
  for (const z of tab.zones) {
    for (const r of z.rows) {
      for (const d of r.desks) {
        if (d.studentName === studentName) return true;
      }
    }
  }
  return false;
}

export function clearStudentFromAllDesks(name) {
  if (!name) return;
  const tab = getActiveTab();
  if (!tab) return;
  for (const z of tab.zones) {
    for (const r of z.rows) {
      for (const d of r.desks) {
        if (d.studentName === name) {
          d.studentName = '';
          d.studentNo = '';
        }
      }
    }
  }
}

export function assignStudentToDesk(studentId, desk) {
  const tab = getActiveTab();
  if (!tab) return false;
  const student = tab.roster.find((s) => s.id === studentId);
  if (!student) return false;

  clearStudentFromAllDesks(student.name);
  desk.studentName = student.name;
  desk.studentNo = String(student.no);
  return true;
}

export function swapDesks(sourceDeskId, targetDeskId) {
  if (sourceDeskId === targetDeskId) return false;
  const tab = getActiveTab();
  if (!tab) return false;
  let sDesk = null;
  let tDesk = null;

  for (const z of tab.zones) {
    for (const r of z.rows) {
      for (const d of r.desks) {
        if (d.id === sourceDeskId) sDesk = d;
        if (d.id === targetDeskId) tDesk = d;
      }
    }
  }

  if (!sDesk || !tDesk) return false;

  const tempName = sDesk.studentName;
  const tempNo = sDesk.studentNo;
  sDesk.studentName = tDesk.studentName;
  sDesk.studentNo = tDesk.studentNo;
  tDesk.studentName = tempName;
  tDesk.studentNo = tempNo;
  return true;
}

export function renumberRosterIfNeeded(tab) {
  if (tab && tab.autoNumber) {
    tab.roster.forEach((s, idx) => {
      s.no = idx + 1;
    });
  }
}

export function applyTotalStudentCount(count) {
  const tab = getActiveTab();
  if (!tab) return;
  const target = clampInt(count, SEATING_CONFIG.defaultStudents, 1, SEATING_CONFIG.maxStudents);
  tab.totalCount = target;

  if (tab.roster.length < target) {
    const start = tab.roster.length + 1;
    for (let i = start; i <= target; i++) {
      tab.roster.push({
        id: `stu_${Date.now()}_${i}`,
        no: i,
        name: `학생 ${i}`,
        assignedDeskId: null
      });
    }
  } else if (tab.roster.length > target) {
    tab.roster = tab.roster.slice(0, target);
  }

  renumberRosterIfNeeded(tab);
}

export function clearAllDesksInTab(tab) {
  if (!tab) return;
  tab.zones.forEach((z) => {
    z.rows.forEach((r) => {
      r.desks.forEach((d) => {
        d.studentName = '';
        d.studentNo = '';
      });
    });
  });
}

export function updateZoneRowCount(zone, delta) {
  const next = clampInt(zone.rowCount + delta, zone.rowCount, 1, SEATING_CONFIG.maxRowsPerZone);
  if (next === zone.rowCount) return false;

  const span = SEATING_CONFIG.minDeskSlotSpan;
  if (delta > 0) {
    const maxDesks = zone.maxDesks || SEATING_CONFIG.defaultMaxDesks;
    for (let i = zone.rowCount; i < next; i++) {
      zone.rows.push({
        id: `row_${zone.id}_${i}_${Date.now()}`,
        desks: Array.from({ length: maxDesks }).map((_, di) => ({
          id: `desk_${zone.id}_${i}_${di}_${Date.now()}`,
          pos: Number((di * span).toFixed(2)),
          studentNo: '',
          studentName: ''
        }))
      });
    }
  } else {
    zone.rows = zone.rows.slice(0, next);
  }

  zone.rowCount = next;
  return true;
}

export function updateZoneMaxDesks(zone, delta) {
  const currentMax = zone.maxDesks || SEATING_CONFIG.defaultMaxDesks;
  const next = clampInt(currentMax + delta, currentMax, 1, SEATING_CONFIG.maxDesksPerRow);
  if (next === zone.maxDesks) return false;

  const span = SEATING_CONFIG.minDeskSlotSpan;
  zone.maxDesks = next;
  zone.rows.forEach((r) => {
    r.desks = r.desks.filter((d) => (d.pos || 0) + span <= next + 1e-6);
  });
  return true;
}

export function parseBatchRosterLines(rawText) {
  const lines = String(rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, SEATING_CONFIG.maxStudents);

  return lines.map((line, idx) => {
    const match = line.match(/^(\d+)[.\s\t]+(.+)$/);
    if (match) {
      return {
        id: `stu_${Date.now()}_${idx}`,
        no: parseInt(match[1], 10),
        name: match[2].trim(),
        assignedDeskId: null
      };
    }
    return {
      id: `stu_${Date.now()}_${idx}`,
      no: idx + 1,
      name: line,
      assignedDeskId: null
    };
  });
}
