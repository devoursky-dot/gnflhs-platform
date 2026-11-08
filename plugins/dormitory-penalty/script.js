// ============================================================================
// GNFLHS 기숙사 상·벌점 관리 시스템 (V2 ES Module + env.json 정식 배포본 v1.1.0)
// - @gnflhs/sdk (env, db, cache) 및 @gnflhs/ui (toast, confirmDialog) 모듈 활용
// - ./seed.js 멀티파일 ES Module 분리 구조
// ============================================================================

import { env, db, cache } from '@gnflhs/sdk';
import { toast, confirmDialog, getDevice, onDeviceChange } from '@gnflhs/ui';
import { INITIAL_SAMPLE_RECORDS } from './seed.js';

const DATA_KEY = env.str('DATA_COLLECTION_KEY', 'dormitory_records_v1');
const DEFAULT_SUPERVISOR = env.str('DEFAULT_SUPERVISOR', '사감교사');

let records = [];
let selectedFloor = 'all'; // 'all' | '2' | '3' | '4'
let selectedType = 'all';  // 'all' | 'merit' | 'demerit'
let searchQuery = '';

function updateHeaderBadge() {
  const badge = document.getElementById('schoolBadge');
  if (!badge) return;
  const school = env.str('SCHOOL_NAME', '경남외국어고등학교');
  const subtitle = env.str('DORM_SUBTITLE', '생활관 통합 관리');
  badge.textContent = `${school} · ${subtitle} (${getDevice().toUpperCase()})`;
}

updateHeaderBadge();
onDeviceChange(updateHeaderBadge);

async function loadRecords() {
  try {
    const saved = await db.get(DATA_KEY);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      records = saved;
      renderDashboard();
      return;
    }
    records = [...INITIAL_SAMPLE_RECORDS];
    await db.set(DATA_KEY, records);
  } catch (e) {
    console.warn('Failed to load records from db, using initial records:', e);
    records = [...INITIAL_SAMPLE_RECORDS];
  }
  renderDashboard();
}

async function persistRecords() {
  try {
    await db.set(DATA_KEY, records);
    cache.put('dorm_record_count', String(records.length), 600);
  } catch (e) {
    console.warn('Persist error:', e);
  }
}

function getFilteredRecords() {
  return records.filter((r) => {
    const roomStr = String(r.room || '');
    if (selectedFloor !== 'all' && !roomStr.startsWith(selectedFloor)) {
      return false;
    }
    const pts = Number(r.points || 0);
    if (selectedType === 'merit' && pts >= 0) return false;
    if (selectedType === 'demerit' && pts <= 0) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = String(r.studentName || '').toLowerCase().includes(q);
      const matchId = String(r.studentId || '').toLowerCase().includes(q);
      const matchRoom = roomStr.toLowerCase().includes(q);
      const matchReason = String(r.reason || '').toLowerCase().includes(q);
      if (!matchName && !matchId && !matchRoom && !matchReason) return false;
    }
    return true;
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderDashboard() {
  const filtered = getFilteredRecords();

  const meritRecords = filtered.filter((r) => Number(r.points) < 0);
  const demeritRecords = filtered.filter((r) => Number(r.points) > 0);

  const meritSum = meritRecords.reduce((acc, r) => acc + Math.abs(Number(r.points)), 0);
  const demeritSum = demeritRecords.reduce((acc, r) => acc + Number(r.points), 0);

  document.getElementById('statTotalCount').textContent = `${filtered.length}건`;
  document.getElementById('statMeritSum').textContent = `${meritSum}점 (${meritRecords.length}건)`;
  document.getElementById('statDemeritSum').textContent = `${demeritSum}점 (${demeritRecords.length}건)`;

  const tbody = document.getElementById('recordsTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">조건에 해당하는 상·벌점 내역이 없습니다.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((r) => {
      const pts = Number(r.points || 0);
      const isDemerit = pts > 0;
      const badgeClass = isDemerit ? 'badge-demerit' : 'badge-merit';
      const badgeLabel = isDemerit ? `벌점 +${pts}점` : `상점 ${Math.abs(pts)}점`;

      return `
        <tr>
          <td class="col-date">${escapeHtml(r.date)}</td>
          <td class="col-id">${escapeHtml(r.studentId)}</td>
          <td class="col-name">${escapeHtml(r.studentName)}</td>
          <td class="col-room"><span class="room-pill">${escapeHtml(r.room)}</span></td>
          <td><span class="score-badge ${badgeClass}">${badgeLabel}</span></td>
          <td class="col-reason">${escapeHtml(r.reason)}</td>
          <td class="col-supervisor" data-tier="detail">${escapeHtml(r.supervisorName || DEFAULT_SUPERVISOR)}</td>
          <td style="text-align:right;">
            <button class="btn-delete-row" data-id="${escapeHtml(r.id)}" title="내역 삭제">삭제</button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('.btn-delete-row').forEach((btn) => {
    btn.onclick = async () => {
      const targetId = btn.getAttribute('data-id');
      const target = records.find((x) => x.id === targetId);
      if (!target) return;
      const ok = await confirmDialog(`'${target.studentName}' 학생의 상·벌점 내역을 삭제하시겠습니까?`);
      if (!ok) return;
      records = records.filter((x) => x.id !== targetId);
      await persistRecords();
      renderDashboard();
      toast('내역이 삭제되었습니다.');
    };
  });
}

document.querySelectorAll('#floorFilterGroup .filter-btn').forEach((btn) => {
  btn.onclick = () => {
    selectedFloor = btn.getAttribute('data-floor') || 'all';
    document.querySelectorAll('#floorFilterGroup .filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
  };
});

document.querySelectorAll('#typeFilterGroup .filter-btn').forEach((btn) => {
  btn.onclick = () => {
    selectedType = btn.getAttribute('data-type') || 'all';
    document.querySelectorAll('#typeFilterGroup .filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
  };
});

const searchInput = document.getElementById('searchInput');
const btnClearSearch = document.getElementById('btnClearSearch');

searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  btnClearSearch.style.display = searchQuery ? 'inline-block' : 'none';
  renderDashboard();
});

btnClearSearch.onclick = () => {
  searchInput.value = '';
  searchQuery = '';
  btnClearSearch.style.display = 'none';
  renderDashboard();
};

const addModalOverlay = document.getElementById('addModalOverlay');
const openModal = () => {
  addModalOverlay.style.display = 'flex';
  document.getElementById('inputStudentId').focus();
};
const closeModal = () => {
  addModalOverlay.style.display = 'none';
};

document.getElementById('btnOpenAddModal').onclick = openModal;
document.getElementById('btnCloseAddModal').onclick = closeModal;
document.getElementById('btnCancelAddModal').onclick = closeModal;

document.getElementById('addRecordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('inputStudentId').value.trim();
  const studentName = document.getElementById('inputStudentName').value.trim();
  const rawRoom = document.getElementById('inputRoom').value.trim();
  const room = rawRoom.endsWith('호') ? rawRoom : `${rawRoom}호`;
  const points = Number(document.getElementById('inputPoints').value || 1);
  const reason = document.getElementById('inputReason').value.trim();
  const supervisorName = document.getElementById('inputSupervisor').value.trim() || DEFAULT_SUPERVISOR;

  if (!studentId || !studentName || !reason) return;

  const newRecord = {
    id: `rec-${Date.now()}`,
    studentId,
    studentName,
    room,
    points,
    reason,
    supervisorName,
    date: new Date().toISOString().slice(0, 10),
    createdAt: Date.now()
  };

  records.unshift(newRecord);
  await persistRecords();
  renderDashboard();
  closeModal();

  document.getElementById('inputStudentId').value = '';
  document.getElementById('inputStudentName').value = '';
  document.getElementById('inputRoom').value = '';
  document.getElementById('inputReason').value = '';

  toast(`${studentName} 학생 상·벌점이 등록되었습니다.`, 'success');
});

loadRecords();
