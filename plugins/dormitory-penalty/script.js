// ============================================================================
// GNFLHS 기숙사 상·벌점 관리 시스템 (V2 멀티모듈 + env.json 정식 배포본 v1.2.0)
// - ./config.js      : env.json 환경변수 로드 및 안전 범위 검증
// - ./seed.js        : 초기 시드 레코드 데이터 분리 모듈
// - ./recordStore.js : Firestore/Cache 영속화 · 층별/유형별 필터링 · 통계 계산 모듈
// ============================================================================

import { toast, confirmDialog, getDevice, onDeviceChange } from '@gnflhs/ui';
import { DORM_CONFIG } from './config.js';
import {
  fetchDormRecords,
  saveDormRecords,
  filterDormRecords,
  computeDormStats,
  normalizeRoomLabel,
  escapeHtml
} from './recordStore.js';

let records = [];
let selectedFloor = 'all'; // 'all' | '2' | '3' | '4'
let selectedType = 'all';  // 'all' | 'merit' | 'demerit'
let searchQuery = '';

function updateHeaderBadge() {
  const badge = document.getElementById('schoolBadge');
  if (!badge) return;
  badge.textContent = `${DORM_CONFIG.schoolName} · ${DORM_CONFIG.dormSubtitle} (${getDevice().toUpperCase()})`;
}

updateHeaderBadge();
onDeviceChange(updateHeaderBadge);

const supervisorInput = document.getElementById('inputSupervisor');
if (supervisorInput && !supervisorInput.value) {
  supervisorInput.value = DORM_CONFIG.defaultSupervisor;
}

function renderDashboard() {
  const filtered = filterDormRecords(records, {
    floor: selectedFloor,
    type: selectedType,
    query: searchQuery
  });
  const stats = computeDormStats(filtered);

  document.getElementById('statTotalCount').textContent = `${stats.totalCount}건`;
  document.getElementById('statMeritSum').textContent = `${stats.meritSum}점 (${stats.meritCount}건)`;
  document.getElementById('statDemeritSum').textContent = `${stats.demeritSum}점 (${stats.demeritCount}건)`;

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
          <td class="col-supervisor" data-tier="detail">${escapeHtml(r.supervisorName || DORM_CONFIG.defaultSupervisor)}</td>
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
      const ok = await confirmDialog(
        `'${target.studentName}' 학생의 상·벌점 내역을 삭제하시겠습니까?`
      );
      if (!ok) return;
      records = records.filter((x) => x.id !== targetId);
      await saveDormRecords(records);
      renderDashboard();
      toast('내역이 삭제되었습니다.');
    };
  });
}

document.querySelectorAll('#floorFilterGroup .filter-btn').forEach((btn) => {
  btn.onclick = () => {
    selectedFloor = btn.getAttribute('data-floor') || 'all';
    document
      .querySelectorAll('#floorFilterGroup .filter-btn')
      .forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
  };
});

document.querySelectorAll('#typeFilterGroup .filter-btn').forEach((btn) => {
  btn.onclick = () => {
    selectedType = btn.getAttribute('data-type') || 'all';
    document
      .querySelectorAll('#typeFilterGroup .filter-btn')
      .forEach((b) => b.classList.remove('active'));
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
  const room = normalizeRoomLabel(document.getElementById('inputRoom').value);
  const points = Number(document.getElementById('inputPoints').value || 1);
  const reason = document.getElementById('inputReason').value.trim();
  const supervisorName =
    document.getElementById('inputSupervisor').value.trim() || DORM_CONFIG.defaultSupervisor;

  if (!studentId || !studentName || !room || !reason) return;

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
  await saveDormRecords(records);
  renderDashboard();
  closeModal();

  document.getElementById('inputStudentId').value = '';
  document.getElementById('inputStudentName').value = '';
  document.getElementById('inputRoom').value = '';
  document.getElementById('inputReason').value = '';

  toast(`${studentName} 학생 상·벌점이 등록되었습니다.`, 'success');
});

async function bootstrapDormApp() {
  records = await fetchDormRecords();
  renderDashboard();
}

bootstrapDormApp();
