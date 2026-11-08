// ============================================================================
// GNFLHS 기숙사 상·벌점 관리 시스템 (정식 배포본 v1.0.0)
// - GNFLHS.db (Firestore) 영구 저장 및 실시간 검색/층별/구분별 필터링
// - 학번, 이름, 호실, 상벌점 점수, 사유, 사감교사 등록 및 삭제 관리
// ============================================================================

const INITIAL_SAMPLE_RECORDS = [
  {
    id: 'rec-1',
    studentId: '10101',
    studentName: '홍길동',
    room: '301호',
    points: 2,
    reason: '점호 시간 지각 (10분)',
    supervisorName: '사감교사',
    date: '2026-11-07',
    createdAt: Date.now() - 86400000 * 2
  },
  {
    id: 'rec-2',
    studentId: '10204',
    studentName: '이몽룡',
    room: '305호',
    points: -2,
    reason: '기숙사 분리수거 및 호실 정리정돈 우수 표창',
    supervisorName: '사감교사',
    date: '2026-11-06',
    createdAt: Date.now() - 86400000 * 3
  },
  {
    id: 'rec-3',
    studentId: '20110',
    studentName: '성춘향',
    room: '402호',
    points: 3,
    reason: '취침 소등 이후 전자기기 무단 사용',
    supervisorName: '야간사감',
    date: '2026-11-05',
    createdAt: Date.now() - 86400000 * 4
  },
  {
    id: 'rec-4',
    studentId: '10312',
    studentName: '박지훈',
    room: '204호',
    points: -1,
    reason: '자습실 환경 미화 봉사활동 참여',
    supervisorName: '사감교사',
    date: '2026-11-08',
    createdAt: Date.now() - 3600000
  }
];

let records = [];
let selectedFloor = 'all'; // 'all' | '2' | '3' | '4'
let selectedType = 'all';  // 'all' | 'merit' | 'demerit'
let searchQuery = '';

function updateHeaderBadge() {
  const badge = document.getElementById('schoolBadge');
  if (!badge) return;
  let school = '경남외국어고등학교';
  if (window.PropertiesService) {
    school = PropertiesService.getScriptProperties().getProperty('SCHOOL_NAME') || school;
  }
  const dev = (window.GNFLHS && GNFLHS.ui) ? GNFLHS.ui.getDevice().toUpperCase() : 'PC';
  badge.textContent = `${school} · 생활관 통합 관리 (${dev})`;
}

updateHeaderBadge();
if (window.GNFLHS && GNFLHS.ui) {
  GNFLHS.ui.onDeviceChange(updateHeaderBadge);
}

async function loadRecords() {
  try {
    if (window.GNFLHS && GNFLHS.db) {
      const saved = await GNFLHS.db.get('dormitory_records_v1');
      if (saved && Array.isArray(saved) && saved.length > 0) {
        records = saved;
        renderDashboard();
        return;
      }
      records = [...INITIAL_SAMPLE_RECORDS];
      await GNFLHS.db.set('dormitory_records_v1', records);
    } else {
      records = [...INITIAL_SAMPLE_RECORDS];
    }
  } catch (e) {
    console.warn('Failed to load records from GNFLHS.db, using initial records:', e);
    records = [...INITIAL_SAMPLE_RECORDS];
  }
  renderDashboard();
}

async function persistRecords() {
  try {
    if (window.GNFLHS && GNFLHS.db) {
      await GNFLHS.db.set('dormitory_records_v1', records);
    }
    if (window.CacheService) {
      CacheService.getScriptCache().put('dorm_record_count', String(records.length), 600);
    }
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
          <td class="col-supervisor" data-tier="detail">${escapeHtml(r.supervisorName || '사감교사')}</td>
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
      if (!confirm(`'${target.studentName}' 학생의 상·벌점 내역을 삭제하시겠습니까?`)) return;
      records = records.filter((x) => x.id !== targetId);
      await persistRecords();
      renderDashboard();
      if (window.GNFLHS && GNFLHS.ui) GNFLHS.ui.toast('내역이 삭제되었습니다.');
    };
  });
}

// 필터 버튼 이벤트
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

// 검색 이벤트
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

// 모달 열기/닫기 및 등록
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
  const supervisorName = document.getElementById('inputSupervisor').value.trim() || '사감교사';

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

  if (window.GNFLHS && GNFLHS.ui) {
    GNFLHS.ui.toast(`${studentName} 학생 상·벌점이 등록되었습니다.`);
  }
});

loadRecords();
